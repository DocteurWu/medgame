/**
 * test/study-level.test.mjs — L'année d'étude (js/study-level.js).
 *
 * Medgame vise les étudiants de la 2e à la 6e année : ces tests verrouillent
 * que les cinq années existent partout où on les choisit, que chaque année
 * change bien le patient, les cas conseillés et la lecture du débriefing, et
 * que la note, elle, n'en dépend pas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../js/patient-live-core.js';
import '../js/study-level.js';
import '../js/patient-brain.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const S = globalThis.StudyLevel;
const B = globalThis.PatientBrain;
const bennet = JSON.parse(read('data/cardio_douleur_thoracique_mme_bennet.json'));

test('cinq années, de la 2e à la 6e, dans l’ordre', () => {
    assert.deepEqual(S.ORDER, ['DFGSM2', 'DFGSM3', 'DFASM1', 'DFASM2', 'DFASM3']);
    assert.deepEqual(S.ORDER.map(id => S.LEVELS[id].year), [2, 3, 4, 5, 6]);
    for (const id of S.ORDER) {
        const lv = S.LEVELS[id];
        assert.equal(lv.id, id);
        assert.equal(lv.cycle, lv.year <= 3 ? 1 : 2);
        assert.ok(lv.objectives.length >= 3, `${id} : objectifs`);
        const sum = S.PILLARS.reduce((n, k) => n + lv.weights[k], 0);
        assert.equal(sum, 100, `${id} : les poids font 100`);
        assert.ok(lv.difficulty[0] <= lv.difficulty[1]);
    }
});

test('les attendus montent avec les années', () => {
    for (const k of S.PILLARS) {
        let prev = -1;
        for (const id of S.ORDER) {
            const e = S.LEVELS[id].expected[k];
            if (e == null) { assert.equal(prev, -1, `${k} : une découverte ne revient pas après un attendu`); continue; }
            assert.ok(e >= prev, `${k} régresse en ${id}`);
            prev = e;
        }
    }
    // La thérapeutique n'est pas exigée en premier cycle.
    assert.equal(S.LEVELS.DFGSM2.expected.therapeutique, null);
    assert.equal(S.LEVELS.DFGSM3.expected.therapeutique, null);
    assert.ok(S.LEVELS.DFASM1.expected.therapeutique > 0);
});

test('normalize accepte les écritures courantes et refuse le reste', () => {
    assert.equal(S.normalize('dfasm 1'), 'DFASM1');
    assert.equal(S.normalize('D4'), 'DFASM3');
    assert.equal(S.normalize(2), 'DFGSM2');
    assert.equal(S.normalize('5e année'), 'DFASM2');
    assert.equal(S.normalize('Autre'), null);
    assert.equal(S.normalize(null), null);
    assert.equal(S.normalize('7'), null);
});

test('sans stockage, l’année par défaut est servie et rien n’est « choisi »', () => {
    assert.equal(S.isSet(), false);
    assert.equal(S.currentId(), S.DEFAULT_LEVEL);
    assert.equal(S.get().id, S.DEFAULT_LEVEL);
    assert.equal(S.get('DFASM3').year, 6);
});

test('le choix est persisté et diffusé', () => {
    const store = new Map();
    globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
    try {
        store.set('medgame_profile', JSON.stringify({ rank: 'DFASM2' }));
        assert.equal(S.currentId(), 'DFASM2', 'repli sur le rang du profil');
        assert.equal(S.isSet(), false);
        assert.equal(S.set('Autre'), null);
        assert.equal(S.set('4'), 'DFASM1');
        assert.equal(store.get(S.STORAGE_KEY), 'DFASM1');
        assert.equal(S.isSet(), true);
        assert.equal(S.currentId(), 'DFASM1');
    } finally {
        delete globalThis.localStorage;
    }
});

test('les cas conseillés suivent l’année', () => {
    assert.equal(S.caseFit('DFGSM2', { difficulty: 1 }).fit, 'ideal');
    assert.equal(S.caseFit('DFGSM2', { difficulty: 3 }).fit, 'ambitieux');
    assert.equal(S.caseFit('DFASM3', { difficulty: 1 }).fit, 'revision');
    assert.equal(S.caseFit('DFASM3', { difficulty: 3 }).fit, 'ideal');
    assert.equal(S.caseFit('DFASM1', {}).fit, 'ideal', 'difficulté absente = 2');

    const cases = [
        { id: 'dur', difficulty: 3 },
        { id: 'fait', difficulty: 2, isPlayed: true },
        { id: 'facile', difficulty: 1 },
        { id: 'neuf', difficulty: 2 }
    ];
    assert.deepEqual(S.sortForLevel(cases, 'DFASM1').map(c => c.id), ['neuf', 'fait', 'dur', 'facile']);
    assert.equal(cases[0].id, 'dur', 'le tableau d’entrée n’est pas modifié');
});

test('chaque année a de quoi jouer dans les cas livrés', () => {
    const meta = JSON.parse(read('data/case-meta.json'));
    const all = Object.values(meta);
    for (const id of S.ORDER) {
        const n = all.filter(m => S.caseFit(id, m).fit === 'ideal').length;
        assert.ok(n >= 10, `${id} : seulement ${n} cas conseillés`);
    }
});

test('le bilan lit le même profil différemment selon l’année', () => {
    const profile = { anamnese: 60, examen: 50, paraclinique: 45, therapeutique: 20, communication: 60 };
    const p2 = S.expectations('DFGSM2', profile);
    const d4 = S.expectations('DFASM3', profile);

    const row = (b, k) => b.rows.find(r => r.key === k);
    assert.equal(row(p2, 'therapeutique').status, 'decouverte');
    assert.equal(row(p2, 'therapeutique').advice, '');
    assert.equal(row(p2, 'anamnese').status, 'acquis');
    assert.equal(p2.acquired, p2.total, 'tous les attendus de 2e année sont atteints');
    assert.match(p2.verdict, /Tous les attendus de 2e année/);

    assert.equal(row(d4, 'therapeutique').status, 'a_travailler');
    assert.ok(row(d4, 'therapeutique').advice.length > 10);
    assert.equal(row(d4, 'anamnese').status, 'en_cours');
    assert.match(d4.verdict, /À travailler en priorité/);

    // Un domaine en découverte ne pèse pas dans le bilan.
    const sans = S.expectations('DFGSM2', { ...profile, therapeutique: 0, paraclinique: 0 });
    assert.equal(sans.score, p2.score);
    // Valeurs absentes ou hors bornes : bornées, jamais NaN.
    const vide = S.expectations('DFASM1', { anamnese: 250 });
    assert.equal(vide.rows[0].value, 100);
    assert.ok(Number.isFinite(vide.score));
});

test('le patient reçoit l’année de l’étudiant, sans changer le reste du prompt', () => {
    const base = { caseData: bennet, vitals: { heartRate: 78, systolic: 135, diastolic: 85, spo2: 97, respiratoryRate: 18, temperature: 36.7 } };
    const sans = B.buildSystemPrompt(base);
    assert.doesNotMatch(sans, /NIVEAU DE L'ÉTUDIANT/, 'sans année (agents MCP), aucun bloc');

    const p2 = B.buildSystemPrompt({ ...base, studyLevel: 'DFGSM2' });
    const d4 = B.buildSystemPrompt({ ...base, studyLevel: 'DFASM3' });
    assert.match(p2, /NIVEAU DE L'ÉTUDIANT/);
    assert.match(p2, /2e année/);
    assert.match(p2, /tuteur discret/);
    assert.match(d4, /Conditions d'examen/);
    assert.doesNotMatch(d4, /tuteur discret/);
    assert.notEqual(p2, d4);

    // Le bloc s'insère, il ne remplace rien : le prompt sans année se retrouve
    // intact une fois le bloc retiré.
    const block = `\n═══ NIVEAU DE L'ÉTUDIANT ═══\n${S.promptBlock('DFGSM2')}\n`;
    assert.equal(p2.replace(block, ''), sans);
    // Une année inconnue n'ajoute rien.
    assert.equal(B.buildSystemPrompt({ ...base, studyLevel: 'Autre' }), sans);
    // Le schéma de réponse reste en fin de prompt (ordre emotion → dialogue).
    assert.ok(p2.trimEnd().endsWith(B.SCHEMA.trimEnd()));
});

test('aucune année ne souffle le diagnostic ni ne touche à la note', () => {
    for (const id of S.ORDER) {
        const block = S.promptBlock(id);
        assert.match(block, /ne change ni le dossier, ni la physiologie/);
        assert.doesNotMatch(block, /donne le diagnostic|révèle le diagnostic/i);
    }
    assert.doesNotMatch(read('engine/scoring.js'), /StudyLevel|study-level/);
    assert.doesNotMatch(read('js/study-level.js'), /scoring\.js'|computeClassicScore/);
});

test('les pages proposent les cinq années et chargent le module avant ses lecteurs', () => {
    const index = read('index.html');
    const login = read('login.html');
    for (const id of S.ORDER) {
        assert.match(index, new RegExp(`<option value="${id}"`), `index.html : ${id}`);
        assert.match(login, new RegExp(`name="rank" value="${id}"`), `login.html : ${id}`);
    }
    const game = read('game.html');
    const pos = (html, f) => html.indexOf(`src="js/${f}"`);
    assert.ok(pos(game, 'study-level.js') > 0);
    assert.ok(pos(game, 'study-level.js') < pos(game, 'study-level-ui.js'));
    assert.ok(pos(game, 'study-level.js') < pos(game, 'MedicalGameManager.js'));
    assert.ok(pos(game, 'study-level.js') < pos(game, 'clinical-debriefing.js'));
    assert.match(game, /css\/study-level\.css/);

    const themes = read('themes.html');
    assert.ok(pos(themes, 'study-level.js') > 0 && pos(themes, 'study-level.js') < pos(themes, 'themes.js'));
    assert.match(themes, /data-study-level-picker/);
    assert.match(read('js/MedicalGameManager.js'), /studyLevel:\s*window\.StudyLevel/);
    assert.match(read('js/clinical-debriefing.js'), /StudyLevel/);
});
