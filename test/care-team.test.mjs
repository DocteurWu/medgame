/**
 * test/care-team.test.mjs — L'équipe soignante jouée par le Maître du Jeu.
 *
 * L'étudiant peut demander n'importe quel geste, examen ou avis : le Maître
 * du Jeu confie la demande à un collègue (infirmier, radiologue, laboratoire,
 * sénior…) qui répond en son nom avec les résultats du dossier. Toujours UN
 * seul appel LLM par réplique : l'équipe est un champ du schéma unique.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../js/patient-live-core.js';
import '../js/patient-brain.js';
import { MedGameEngine } from '../engine/MedGameEngine.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const B = globalThis.PatientBrain;
const bennet = JSON.parse(read('data/cardio_douleur_thoracique_mme_bennet.json'));

test('le schéma porte l’équipe, après la parole du patient', () => {
    const s = B.SCHEMA;
    assert.ok(s.indexOf('"emotion"') < s.indexOf('"dialogue"'), 'emotion puis dialogue en tête (voix en flux)');
    assert.ok(s.indexOf('"dialogue"') < s.indexOf('"team"'));
    for (const role of ['infirmier', 'radiologue', 'laboratoire', 'specialiste', 'senior', 'pharmacien', 'proche']) {
        assert.ok(B.TEAM_ROLE_IDS.includes(role), role);
        assert.match(s, new RegExp(`"${role}"`));
    }
});

test('le prompt décrit l’équipe et la règle des vrais résultats', () => {
    const p = B.buildSystemPrompt({ caseData: bennet });
    assert.match(p, /L'ÉQUIPE DE GARDE/);
    assert.match(p, /N'IMPORTE QUEL geste, examen ou avis/);
    assert.match(p, /rapporte CE résultat, fidèlement/);
    assert.match(p, /jamais une anomalie qui contredirait le dossier/);
    assert.match(p, /AUCUN ne donne le diagnostic final ni le traitement/);
    // Les résultats que les collègues doivent rapporter sont bien dans le prompt.
    assert.match(p, /sous-décalage ST V5-V6/);
    // Les collègues ont un nom, le même que celui affiché dans le transcript.
    const staff = B.staffFor(bennet);
    assert.ok(p.includes(`"infirmier" (${staff.infirmier}, ${B.teamRoleLabel('infirmier', bennet)})`));
    assert.ok(p.includes(`"radiologue" (${staff.radiologue}, radiologue)`));
});

test('l’équipe de garde est stable pour un cas et nommée dans le transcript', () => {
    assert.deepEqual(B.staffFor(bennet), B.staffFor({ id: bennet.id }));
    const names = new Set(fs.readdirSync(path.join(ROOT, 'data'))
        .filter(f => f.endsWith('.json') && !f.startsWith('case-') && f !== 'drugs.json')
        .map(f => B.staffFor({ id: f.replace('.json', '') }).infirmier));
    assert.ok(names.size >= 3, 'les cas n’ont pas tous le même infirmier');

    const staff = B.staffFor(bennet);
    assert.equal(B.teamSpeakerLabel({ role: 'infirmier' }, bennet), `${staff.infirmier} · ${B.teamRoleLabel('infirmier', bennet)}`);
    // Le titre s'accorde avec le prénom tiré pour le cas.
    const labels = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(id => {
        const c = { id };
        return `${B.staffFor(c).infirmier}|${B.teamRoleLabel('infirmier', c)}`;
    }));
    for (const l of labels) {
        const [name, title] = l.split('|');
        assert.equal(title, ['Julie', 'Inès', 'Sarah'].includes(name) ? 'infirmière' : 'infirmier', l);
    }
    assert.equal(B.teamSpeakerLabel({ role: 'specialiste', titre: 'cardiologue de garde' }, bennet), `${staff.specialiste} · cardiologue de garde`);
    assert.equal(B.teamSpeakerLabel({ role: 'proche', titre: 'sa fille' }, bennet), 'Sa fille');
    assert.equal(B.teamSpeakerLabel({ role: 'proche' }, bennet), 'Proche');
});

test('analyse de la réponse : équipe normalisée et bornée', () => {
    const r = B.parseReply(JSON.stringify({
        emotion: 'neutre',
        dialogue: null,
        team: [
            { role: 'infirmier', says: '  ECG fait, je vous le tends.  ', delayMin: 3 },
            { role: 'manipulateur radio', says: 'Cliché réalisé.' },
            { role: 'laboratoire', message: 'Troponine normale.', delayMin: 99999 },
            { role: 'radiologue', says: '   ' },
            { role: 'senior' },
            'texte libre'
        ],
        exams: [{ type: 'other', nom: 'ECG', description: 'Normal au repos' }]
    }));
    assert.equal(r.team.length, 3, 'paroles vides et entrées invalides écartées');
    assert.deepEqual(r.team[0], { role: 'infirmier', titre: null, says: 'ECG fait, je vous le tends.', delayMin: 3 });
    assert.equal(r.team[1].role, 'specialiste', 'rôle inconnu : spécialiste');
    assert.equal(r.team[1].titre, 'manipulateur radio', '… dont on garde l’intitulé');
    assert.equal(r.team[2].says, 'Troponine normale.', 'ancien nom de champ accepté');
    assert.equal(r.team[2].delayMin, 1440, 'délai borné à 24 h');

    assert.equal(B.parseReply('{"dialogue":"Oui"}').team, null);
    assert.equal(B.parseReply('{"dialogue":"Oui","team":[]}').team, null);
    const many = B.parseReply(JSON.stringify({ team: Array.from({ length: 9 }, () => ({ role: 'infirmier', says: 'x' })) }));
    assert.equal(many.team.length, 4, 'au plus quatre intervenants par tour');
    // Un patient décédé se tait ; l'équipe, elle, parle encore.
    const dead = B.parseReply('{"dialogue":"Je vais bien","team":[{"role":"infirmier","says":"Plus de pouls."}],"gameState":{"status":"dead"}}');
    assert.equal(dead.dialogue, null);
    assert.equal(dead.team[0].says, 'Plus de pouls.');
});

test('moteur des agents : le collègue répond et l’examen demandé à l’oral est prescrit', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
            choices: [{
                message: {
                    content: JSON.stringify({
                        emotion: 'neutre',
                        dialogue: null,
                        team: [{ role: 'infirmier', says: 'ECG fait : rythme sinusal, tracé normal au repos.', delayMin: 3 }],
                        exams: [{ type: 'other', nom: 'ECG', description: 'Normal au repos' }],
                        narrativeResponse: ''
                    })
                }
            }]
        })
    });
    try {
        const engine = new MedGameEngine({ apiKey: 'test' });
        await engine.startCase('cardio_douleur_thoracique_mme_bennet.json');
        const out = await engine.chat('Karim, vous pouvez me faire un ECG ?');
        const who = B.teamSpeakerLabel({ role: 'infirmier' }, engine.caseData);
        assert.ok(out.response.includes(`${who} : « ECG fait`), out.response);
        assert.match(out.response, /\[\+3 min\]/);
        assert.doesNotMatch(out.response, /reste silencieux/);
        assert.equal(engine.lastTurn.team[0].speaker, who);
        assert.ok(engine.activeExams.includes('ECG'), 'ECG prescrit par la conversation');
    } finally {
        globalThis.fetch = original;
    }
});

test('navigateur : un seul appel, l’équipe affichée dans les trois vues', () => {
    const gm = read('js/MedicalGameManager.js');
    assert.equal((gm.match(/LLMClient\.request\(/g) || []).length, 1, 'un seul appel LLM par réplique');
    assert.match(gm, /teamSpeakerLabel/);
    assert.match(gm, /medgame:team-reply/);
    assert.match(gm, /trackExamsOrdered/, 'un examen demandé à l’oral compte dans la démarche');
    // Régression : ces deux expressions avaient perdu leur antislash.
    assert.match(gm, /split\(\/\\s\+\/\)/);
    assert.match(gm, /\/\^interrogatoire\\\.\//);

    const chat = read('js/patientChat.js');
    assert.match(chat, /appendTeam\(/);
    assert.match(chat, /body\.textContent = m\.says/, 'la parole d’un collègue n’est jamais injectée en HTML');
    assert.match(read('js/ecosMode.js'), /result\.team/);
    assert.match(read('js/three-hud-agent.js'), /from-team/);
    assert.match(read('css/game.css'), /\.dialogue-message\.from-team/);
});
