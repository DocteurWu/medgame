/**
 * test/case-interview.test.mjs — Créer un cas en le racontant
 * (js/case-interview.js, js/editor-interview.js).
 *
 * L'étudiant raconte un patient, l'IA pose ses questions une à une, puis la
 * fiche est rédigée au format de la base. Ces tests verrouillent ce qui ne
 * doit pas dépendre du modèle : ce que l'étudiant a dit prime, l'identité est
 * toujours fictive, et le cas sort jouable.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import '../js/case-interview.js';
import '../js/patient-live-core.js';
import '../js/patient-brain.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const CI = globalThis.CaseInterview;
const PIXEL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

/** Un entretien type : SCA raconté en trois tours. */
function story() {
    let s = CI.start(CI.createState());
    s = CI.applyTurn(s, 'Un homme de 62 ans aux urgences pour une douleur thoracique', CI.parseTurn({
        updates: { specialite: 'Cardiologie', patient: { age: 62, sexe: 'M', nom: 'Dupont' }, interrogatoire: { motifHospitalisation: 'Douleur thoracique' } },
        question: 'Elle durait depuis combien de temps ?'
    }));
    s = CI.applyTurn(s, 'Deux heures, ECG avec sus-décalage en inférieur, tropo positive', CI.parseTurn({
        updates: {
            interrogatoire: { histoireMaladie: { debutSymptomes: 'Il y a 2 heures' } },
            examResults: { ecg: 'Sus-décalage ST en D2, D3, aVF', Troponine: 'Positive' }
        },
        question: 'Et le diagnostic ?'
    }));
    s = CI.applyTurn(s, 'SCA ST+ inférieur, aspirine et coronarographie, surtout pas de bêta-bloquant en choc', CI.parseTurn({
        updates: { correctDiagnostic: 'SCA ST+ inférieur', correctTreatments: ['Aspirine', 'Coronarographie'], fatalTreatments: ['Bêta-bloquant'] },
        skip: ['modeDeVie', 'inconnu'],
        question: 'Qu’est-ce qui t’a marqué ?'
    }));
    return s;
}

/** Ce qu'un modèle rendrait : complet, mais avec des écarts à corriger. */
function generated() {
    return {
        id: 'x', difficulty: 9,
        patient: { nom: 'Dupont', prenom: 'Jean', age: 55, sexe: 'F', persona: { ton: 'inquiet' } },
        interrogatoire: { motifHospitalisation: 'Gêne dans la poitrine', histoireMaladie: { evolution: 'Brutale' }, verbatim: 'Bonjour, je suis M. Dupont.' },
        examenClinique: { constantes: { tension: '140/85 mmHg', pouls: '92 bpm', temperature: '37°C', saturationO2: '97%', frequenceRespiratoire: '18/min' } },
        availableExams: ['ECG', 'Radio Thorax'],
        examResults: { ECG: 'Normal' },
        relevantExams: ['ECG', 'IRM cardiaque'],
        examGradation: { parfaits: ['ECG', 'Scintigraphie'], utiles: [], inutiles: ['Radio Thorax'], dangereux: [] },
        possibleDiagnostics: ['Péricardite', 'Embolie pulmonaire'],
        correctDiagnostic: 'Infarctus',
        alternativeDiagnostics: ['Péricardite'],
        possibleTreatments: ['Aspirine', 'Paracétamol'],
        correctTreatments: ['Paracétamol'],
        fatalTreatments: [],
        ecos: { vignette: { contexte: 'Vous recevez M. Dupont, adressé par Dupontel.' } },
        correction: '# SCA'
    };
}

test('la liste de contrôle suit le récit et choisit la prochaine question', () => {
    const empty = CI.createState();
    const c0 = CI.coverage(empty);
    assert.equal(c0.percent, 0);
    assert.equal(c0.canBuild, false);
    assert.deepEqual(c0.missingEssential.map(i => i.id), ['motif', 'patient', 'diagnostic']);
    assert.equal(CI.fallbackQuestion(empty), CI.CHECKLIST[0].question);
    assert.equal(CI.start(empty).transcript[0].role, 'interviewer');
    assert.equal(empty.transcript.length, 0, 'l’état d’origine n’est pas modifié');

    const s = story();
    const cov = CI.coverage(s);
    assert.equal(cov.canBuild, true);
    const byId = Object.fromEntries(cov.items.map(i => [i.id, i]));
    assert.ok(byId.motif.done && byId.patient.done && byId.examens.done && byId.diagnostic.done && byId.traitement.done);
    assert.ok(byId.modeDeVie.skipped, '« je ne sais pas » : écarté, plus redemandé');
    assert.ok(!byId.antecedents.done && !byId.antecedents.skipped);
    assert.equal(cov.next.id, 'antecedents');
    assert.ok(!s.skipped.includes('inconnu'), 'identifiant inconnu ignoré');
});

test('un tour ne retient que ce qui est dit, jamais l’identité', () => {
    const p = CI.parseTurn('```json\n{"updates":{"patient":{"age":40,"nom":"Martin","prenom":"Paul","dateNaissance":"01/02/1985"},"interrogatoire":{"motifHospitalisation":"  Fièvre ","histoireMaladie":{"evolution":"…","debutSymptomes":""}},"examResults":{}},"skip":"x","question":" Depuis quand ? ","done":"oui"}\n```');
    assert.deepEqual(p.updates, { patient: { age: 40 }, interrogatoire: { motifHospitalisation: 'Fièvre' } });
    assert.deepEqual(p.skip, []);
    assert.equal(p.question, 'Depuis quand ?');
    assert.equal(p.done, false);
    assert.throws(() => CI.parseTurn('pas du json'));

    const s = story();
    assert.equal(s.facts.patient.nom, undefined, 'le nom dicté n’entre pas dans la fiche');
    assert.equal(s.transcript.filter(m => m.role === 'student').length, 3);
    assert.equal(s.transcript.at(-1).text, 'Qu’est-ce qui t’a marqué ?');
});

test('la fusion complète les listes sans doublon et garde le reste', () => {
    const a = { examResults: { ECG: 'x' }, correctTreatments: ['Aspirine'], patient: { age: 60 } };
    const m = CI.mergeFacts(a, { examResults: { NFS: 'y' }, correctTreatments: ['Aspirine', 'Héparine'], patient: { sexe: 'F' } });
    assert.deepEqual(m, { examResults: { ECG: 'x', NFS: 'y' }, correctTreatments: ['Aspirine', 'Héparine'], patient: { age: 60, sexe: 'F' } });
    assert.deepEqual(a.correctTreatments, ['Aspirine']);
});

test('sans IA, l’entretien continue avec les questions de base', () => {
    let s = CI.start(CI.createState());
    s = CI.applyTurn(s, 'Une dame avec de la fièvre', null);
    assert.equal(s.transcript.at(-2).text, 'Une dame avec de la fièvre');
    assert.equal(s.transcript.at(-1).text, CI.CHECKLIST[0].question, 'rien retenu : même question');
    // L'IA ne peut pas clore tant qu'un élément indispensable manque.
    const closed = CI.applyTurn(s, 'ok', CI.parseTurn({ updates: {}, question: 'Merci, c’est tout !', done: true }));
    assert.equal(closed.transcript.at(-1).text, CI.CHECKLIST[0].question);
});

test('le prompt d’entretien : une question, rien d’inventé, secret médical', () => {
    const s = story();
    const prompt = CI.buildTurnPrompt(s);
    assert.match(prompt, /UNE seule question à la fois/);
    assert.match(prompt, /Tu n'inventes et ne complètes rien/);
    assert.match(prompt, /n'enregistre JAMAIS de nom/);
    assert.match(prompt, /antecedents : Antécédents/);
    assert.doesNotMatch(prompt, /- motif : Motif de venue/, 'ce qui est acquis n’est plus demandé');
    assert.match(prompt, /Sus-décalage ST/, 'la fiche déjà recueillie est rappelée');

    const msgs = CI.buildTurnMessages(s, 'Il fumait');
    assert.equal(msgs[0].role, 'system');
    assert.equal(msgs.at(-1).content, 'Il fumait');
    assert.ok(msgs.slice(1, -1).every(m => m.role === 'user' || m.role === 'assistant'));
});

test('la consigne de rédaction impose la fiche et le nom fictif', () => {
    const s = story();
    const { system, user } = CI.buildCasePrompt(s, '{FORMAT}');
    const [prenom, nom] = CI.fictionalName(s.facts, 'M');
    assert.ok(system.includes(`Le patient s'appelle ${prenom} ${nom}`));
    assert.match(system, /repris fidèlement/);
    assert.ok(system.includes('{FORMAT}'));
    assert.match(user, /SCA ST\+ inférieur/);
    assert.match(user, /À COMPLÉTER toi-même.*Antécédents/s);
    assert.match(user, /ÉTUDIANT : Un homme de 62 ans/);
});

test('mise au format : le récit prime et le cas sort cohérent', () => {
    const s = CI.addImage(story(), 'ecg', PIXEL);
    const c = CI.finalize(generated(), s, { redacteur: 'Louaï' });

    // Ce que l'étudiant a dit l'emporte sur ce que l'IA a écrit.
    assert.equal(c.patient.age, 62);
    assert.equal(c.patient.sexe, 'M');
    assert.equal(c.interrogatoire.motifHospitalisation, 'Douleur thoracique');
    assert.equal(c.interrogatoire.histoireMaladie.debutSymptomes, 'Il y a 2 heures');
    assert.equal(c.interrogatoire.histoireMaladie.evolution, 'Brutale', 'les compléments de l’IA sont gardés');
    assert.equal(c.correctDiagnostic, 'SCA ST+ inférieur');
    assert.deepEqual(c.correctTreatments, ['Aspirine', 'Coronarographie']);
    assert.deepEqual(c.fatalTreatments, ['Bêta-bloquant']);

    // Cohérence avec la base.
    assert.ok(c.possibleDiagnostics.includes(c.correctDiagnostic));
    assert.ok(!c.alternativeDiagnostics.includes(c.correctDiagnostic));
    for (const t of [...c.correctTreatments, ...c.fatalTreatments]) assert.ok(c.possibleTreatments.includes(t), t);
    for (const e of c.relevantExams) assert.ok(c.availableExams.includes(e), e);
    for (const e of c.availableExams) assert.ok(c.examResults[e], `résultat pour ${e}`);
    assert.ok(!c.relevantExams.includes('IRM cardiaque'), 'examen inexistant retiré');
    assert.deepEqual(c.examGradation.parfaits, ['ECG']);
    assert.ok(c.relevantExams.includes('Troponine'), 'un examen réellement fait est pertinent');
    assert.equal(c.difficulty, 3);
    assert.equal(c.redacteur, 'Louaï');
    assert.match(c.id, /^cardiologie_douleur_thoracique_m_[a-z]+$/);
    assert.deepEqual(CI.problems(c), []);

    // « ecg » raconté et image jointe : rattachés à l'examen « ECG » existant.
    assert.deepEqual(c.examResults.ECG, { value: 'Sus-décalage ST en D2, D3, aVF', image: PIXEL });
    assert.equal(c.examResults.ecg, undefined);

    // L'entrée n'est pas modifiée.
    assert.equal(generated().patient.age, 55);
});

test('identité : toujours fictive, même si le modèle recopie un nom', () => {
    const s = story();
    const c = CI.finalize(generated(), s);
    const [prenom, nom] = CI.fictionalName(s.facts, 'M');
    assert.equal(c.patient.nom, nom);
    assert.equal(c.patient.prenom, prenom);
    const json = JSON.stringify(c);
    assert.doesNotMatch(json, /Dupont(?!el)/, 'le nom recopié est réécrit partout');
    assert.match(json, /Dupontel/, 'sans toucher aux mots qui le contiennent');
    assert.equal(c.ecos.vignette.contexte, `Vous recevez M. ${nom}, adressé par Dupontel.`);
    assert.deepEqual(CI.finalize(generated(), s).patient, c.patient, 'tirage stable');
});

test('une fiche vide ou cassée donne quand même un cas contrôlable', () => {
    const c = CI.finalize(null, CI.createState());
    assert.equal(c.patient.age, 50);
    assert.ok(c.patient.nom && c.patient.prenom);
    assert.ok(CI.problems(c).length >= 2);
    assert.equal(CI.addImage(CI.createState(), 'Radio', 'https://exemple.test/x.png').images.length, 0, 'seules les images embarquées sont acceptées');
    assert.equal(CI.addImage(CI.createState(), '', PIXEL).images.length, 0);
});

test('le cas rédigé respecte le schéma de la base', () => {
    const schema = JSON.parse(read('schemas/case.schema.json'));
    const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
    const c = CI.finalize(generated(), story());
    assert.ok(validate(c), JSON.stringify(validate.errors, null, 2));
});

test('une image d’examen n’entre jamais dans le prompt du patient', () => {
    const B = globalThis.PatientBrain;
    const c = CI.finalize(generated(), CI.addImage(story(), 'ECG', PIXEL));
    const prompt = B.buildSystemPrompt({ caseData: c });
    assert.doesNotMatch(prompt, /base64/);
    assert.match(prompt, /Sus-décalage ST en D2, D3, aVF \(image jointe au dossier\)/);
    assert.deepEqual(B.examResultsForPrompt({ NFS: 'Normale' }), { NFS: 'Normale' });
});

test('l’éditeur branche l’entretien, le format partagé et les images', () => {
    const html = read('editor.html');
    const pos = (f) => html.indexOf(`src="js/${f}"`);
    assert.ok(pos('case-interview.js') > 0);
    assert.ok(pos('case-interview.js') < pos('editor-ai.js'));
    assert.ok(pos('editor.js') < pos('editor-interview.js'));
    assert.match(html, /data-open-interview/);
    assert.match(html, /id="interview-modal"/);
    assert.match(html, /Ne donne aucun nom/);
    assert.match(html, /css\/editor-interview\.css/);

    const ai = read('js/editor-ai.js');
    assert.match(ai, /static caseFormat\(/);
    assert.match(ai, /static async buildCaseFromInterview\(/);
    assert.equal((ai.match(/"id": "slug_unique_specialite_pathologie_patient"/g) || []).length, 1, 'un seul gabarit de cas');

    const ui = read('js/editor-interview.js');
    assert.match(ui, /buildTurnMessages/);
    assert.match(ui, /body\.textContent = text/, 'le récit n’est jamais injecté en HTML');
    assert.doesNotMatch(ui, /innerHTML/);

    const editor = read('js/editor.js');
    assert.match(editor, /function compressExamImage\(/);
    assert.match(editor, /\{ value: result \|\| 'Voir l\\'image\.', image: examImage \}/);
});
