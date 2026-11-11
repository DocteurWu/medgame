/**
 * test/patient-brain.test.mjs — Le moteur patient UNIQUE (js/patient-brain.js)
 * et les outils des agents testeurs (engine/agent-tools.js).
 *
 * Le jeu avait trois cerveaux pour un même patient (2D, 3D, serveur MCP) ;
 * ces tests verrouillent qu'il n'en reste qu'un, partagé par tous.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../js/patient-live-core.js';
import '../js/patient-brain.js';
import { auditCase, mergePatch, changedPaths, caseFileName } from '../engine/agent-tools.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const B = globalThis.PatientBrain;
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const bennet = JSON.parse(read('data/cardio_douleur_thoracique_mme_bennet.json'));

test('un seul moteur patient : plus de LLMPatient ni de second routeur', () => {
    assert.ok(!fs.existsSync(path.join(ROOT, 'js', 'llm-patient.js')), 'js/llm-patient.js supprimé');
    const jsFiles = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'));
    for (const f of jsFiles) {
        const src = read(`js/${f}`);
        assert.doesNotMatch(src, /new\s+(window\.)?LLMPatient\b/, `${f} instancie encore LLMPatient`);
    }
    // Le 3D n'appelle plus de LLM en propre.
    assert.doesNotMatch(read('js/clinicalAgentAI.js'), /fetch\(|LLMClient/);
    // Le Maître du Jeu et l'engine utilisent le même cerveau.
    assert.match(read('js/MedicalGameManager.js'), /PatientBrain/);
    assert.match(read('js/MedicalGameManager.js'), /buildSystemPrompt/);
    assert.match(read('engine/MedGameEngine.js'), /import '\.\.\/js\/patient-brain\.js'/);
});

test('game.html charge le cerveau avant le Maître du Jeu ne s’en serve', () => {
    const html = read('game.html');
    const brain = html.indexOf('js/patient-brain.js');
    assert.ok(brain > 0);
    assert.ok(html.indexOf('js/patient-live-core.js') < brain, 'le cœur d’alliance est chargé avant');
    assert.doesNotMatch(html, /llm-patient\.js/);
});

test('le prompt incarne le patient du cas et porte les règles du jeu', () => {
    const prompt = B.buildSystemPrompt({
        caseData: bennet,
        vitals: { heartRate: 80, systolic: 135, diastolic: 85, spo2: 97, respiratoryRate: 17, temperature: 37 },
        pain: 4,
        alliance: { trust: 65, anxiety: 55 },
        administered: []
    });
    assert.match(prompt, /Bennet/);
    assert.match(prompt, /MAÎTRE DU JEU/);
    assert.match(prompt, /CE QUE LE PATIENT DIT, ET QUAND/);
    assert.match(prompt, /ALLIANCE THÉRAPEUTIQUE/);
    assert.match(prompt, /"emotion"[\s\S]*"dialogue"[\s\S]*"alliance"/, 'emotion puis dialogue en tête (voix en flux)');
    assert.match(prompt, /NOUVELLE VALEUR ABSOLUE/, 'constantes en valeurs absolues, partout');
    if (bennet.correctDiagnostic) assert.match(prompt, new RegExp(`NE JAMAIS RÉVÉLER[\\s\\S]*${bennet.correctDiagnostic.slice(0, 12).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});

test('la divulgation s’ouvre avec la confiance ou l’insistance', () => {
    const c = { dialogue: { si_insiste: ['modeDeVie.alcool'] }, interrogatoire: { modeDeVie: { alcool: '4 verres par jour' } } };
    assert.match(B.disclosureBlock(c, { trust: 40 }), /reste évasif/);
    assert.match(B.disclosureBlock(c, { trust: 70 }), /avouer/);
    assert.match(B.disclosureBlock(c, { trust: 40, insistence: { 'interrogatoire.modeDeVie.alcool': 2 } }), /avouer/);
    assert.match(B.disclosureBlock(c, { trust: 40 }), /4 verres par jour/, 'la valeur du dossier est résolue');
});

test('la voix suit la physiologie', () => {
    assert.match(B.physioBlock({ vitals: { respiratoryRate: 30, spo2: 88 } }), /Dyspnée sévère/);
    assert.match(B.physioBlock({ vitals: {}, pain: 9 }), /atroce/);
    assert.match(B.physioBlock({ vitals: {} }), /naturelle/);
});

test('analyse de réponse : normalisation, bornes, compatibilité', () => {
    const r = B.parseReply('```json\n{"emotion":"Anxieuse","dialogue":"  J\'ai peur. ","alliance":{"trustDelta":40,"anxietyDelta":-3,"communication":"empathique","reason":"Reformulation"},"vitalChanges":{"heartRate":300,"spo2":"x"},"exams":[{"type":"ECG"},{"type":"auscultation_card","description":"B1 B2 réguliers"}],"scene":{"spawnAsset":"bazooka","sound":"alarm"},"gameState":{"status":"stable"}}\n```');
    assert.equal(r.emotion, 'peur');
    assert.equal(r.dialogue, "J'ai peur.");
    assert.equal(r.alliance.trustDelta, 15, 'borné à ±15');
    assert.deepEqual(r.vitalChanges, { heartRate: 250 }, 'bornes physiologiques, non-nombres ignorés');
    assert.equal(r.exams[0].type, 'other');
    assert.equal(r.exams[0].nom, 'ECG', 'un examen nommé garde son nom');
    assert.equal(r.scene.spawnAsset, null, 'objet 3D inconnu refusé');
    assert.equal(r.scene.sound, 'alarm');

    const legacy = B.parseReply('{"dialogue":"Oui","intentAnalysis":{"trustDelta":-5,"communicationQuality":"jargonneux"}}');
    assert.equal(legacy.alliance.trustDelta, -5);
    assert.equal(legacy.alliance.communication, 'jargonneux');

    const dead = B.parseReply('{"dialogue":"Je vais bien","gameState":{"status":"dead"}}');
    assert.equal(dead.dialogue, null, 'un patient décédé ne parle pas');
    assert.throws(() => B.parseReply('pas du json'));
});

test('agents : audit de cas', () => {
    const a = auditCase({ id: 'x', interrogatoire: {}, correctDiagnostic: 'IDM', possibleDiagnostics: ['Angor'], correctTreatments: ['Aspirine'], possibleTreatments: [], availableExams: ['ECG'], examResults: {}, patient: {} });
    const fields = a.issues.map(i => i.field);
    assert.ok(fields.includes('possibleDiagnostics'));
    assert.ok(fields.includes('correctTreatments'));
    assert.ok(fields.includes('examResults.ECG'));
    assert.ok(fields.includes('patient.persona.confiance'));
    assert.ok(a.score < 50);
    const good = auditCase(bennet);
    assert.ok(good.score > a.score);
});

test('agents : merge patch et chemins modifiés', () => {
    const base = { a: 1, b: { c: 2, d: [1, 2] }, e: 'x' };
    const next = mergePatch(base, { b: { c: 3, d: [9] }, e: null, f: { g: true }, __proto__: { pollué: 1 } });
    assert.deepEqual(next, { a: 1, b: { c: 3, d: [9] }, f: { g: true } });
    assert.equal({}.pollué, undefined);
    assert.deepEqual(changedPaths(base, next).sort(), ['b.c', 'b.d', 'e', 'f'].sort());
    assert.equal(base.b.c, 2, 'la cible n’est pas mutée');
    assert.throws(() => caseFileName('case-index.json'));
    assert.equal(caseFileName('../../etc/passwd'), 'passwd.json', 'pas de traversée de répertoire');
});
