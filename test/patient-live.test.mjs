/**
 * test/patient-live.test.mjs — Logique pure de la consultation en direct
 * (js/patient-live-core.js) : alliance, ultimatum, analyse des répliques,
 * décodage du dialogue en flux et découpage pour la voix.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../js/patient-live-core.js';

const C = globalThis.PatientLiveCore;

test('le cœur est publié sur globalThis', () => {
    assert.ok(C);
    for (const fn of ['createAlliance', 'analyzeUtterance', 'extractStreamingField', 'takeSentences', 'prosody', 'promptBlock']) {
        assert.equal(typeof C[fn], 'function', fn);
    }
});

test('paliers de confiance', () => {
    assert.equal(C.stageOf(90).id, 'confiant');
    assert.equal(C.stageOf(70).id, 'confiant');
    assert.equal(C.stageOf(55).id, 'reserve');
    assert.equal(C.stageOf(25).id, 'ferme');
    assert.equal(C.stageOf(3).id, 'rupture');
    assert.equal(C.stageOf(-20).id, 'rupture');
});

test('le jargon est détecté avec sa traduction profane', () => {
    const a = C.analyzeUtterance('Avez-vous une orthopnée ou un méléna ?');
    const terms = a.jargon.map(j => j.term);
    assert.ok(terms.includes('orthopnee'));
    assert.ok(terms.includes('melena'));
    assert.ok(a.hint < 0);
    assert.match(a.jargon[0].lay, /allongé/);
});

test('empathie, reformulation et présentation sont valorisées', () => {
    const a = C.analyzeUtterance("Bonjour, je suis l'interne. Si je comprends bien, vous avez mal depuis hier ; ça doit être difficile.");
    assert.ok(a.greeting && a.reformulation && a.empathy);
    assert.ok(a.hint > 0);
    assert.equal(C.analyzeUtterance('Depuis quand ? Où ? Ça irradie ? Fumeur ?').questionCount, 4);
    assert.ok(C.analyzeUtterance('Bon alors, répondez vite').brusque);
});

test("l'alliance accepte des deltas et des valeurs absolues, bornées", () => {
    const a = C.createAlliance({ trust: 50, anxiety: 50 });
    let r = a.applyTurn({ trustDelta: 10, reason: 'Écoute active' });
    assert.equal(a.state.trust, 60);
    assert.equal(r.delta, 10);
    assert.equal(r.label, 'Écoute active');
    r = a.applyTurn({ trust: 64, anxiety: 40 });
    assert.equal(a.state.trust, 64);
    assert.equal(a.state.anxiety, 40);
    r = a.applyTurn({ trustDelta: 999 });
    assert.equal(r.delta, 20, 'un tour ne peut pas dépasser ±20');
    assert.equal(a.state.trust, 84);
    assert.equal(r.stage.id, 'confiant');
    assert.ok(r.stageChanged);
});

test('le jargon pèse même si le LLM ne le sanctionne pas', () => {
    const a = C.createAlliance({ trust: 50 });
    const r = a.applyTurn({ trustDelta: 0, text: 'Vous avez une dyspnée ?' });
    assert.ok(r.delta < 0);
    assert.match(r.label, /Jargon « dyspnee » → dites « essoufflé »/);
});

test('ultimatum : une réplique empathique retient le patient', () => {
    const a = C.createAlliance({ trust: 20 });
    let r = a.applyTurn({ trustDelta: -10 });
    assert.ok(r.ultimatumStarted);
    assert.ok(a.state.ultimatum);
    r = a.applyTurn({ trustDelta: 8, communication: 'empathique' });
    assert.ok(r.recovered);
    assert.ok(!a.state.ultimatum);
    assert.ok(a.state.trust >= C.RECOVER_TO);
    // Seconde chute : plus de seconde chance.
    r = a.applyTurn({ trustDelta: -20 });
    assert.ok(r.walkedOut);
    assert.ok(a.summary().walkedOut);
    assert.ok(a.applyTurn({ trustDelta: 10 }).ignored, 'plus rien ne compte après le départ');
});

test('ultimatum : une réplique neutre ou l’expiration font partir le patient', () => {
    const a = C.createAlliance({ trust: 16 });
    a.applyTurn({ trustDelta: -5 });
    assert.ok(a.state.ultimatum);
    assert.ok(a.applyTurn({ trustDelta: 2, communication: 'neutre' }).walkedOut);

    const b = C.createAlliance({ trust: 16 });
    b.applyTurn({ trustDelta: -5 });
    assert.ok(b.expireUltimatum());
    assert.ok(b.state.walkedOut);
});

test('interruptions, silences et bilan', () => {
    let t = 0;
    const a = C.createAlliance({ trust: 60, now: () => t });
    t = 5000; a.applyTurn({ trustDelta: 12, reason: 'Reformulation' });
    t = 9000; a.applyTurn({ kind: 'interrupt', trustDelta: -4 });
    t = 30000; a.applyTurn({ kind: 'silence', trustDelta: -3 });
    const s = a.summary();
    assert.equal(s.interruptions, 1);
    assert.equal(s.silences, 1);
    assert.equal(s.turns, 1);
    assert.equal(s.best.delta, 12);
    assert.equal(s.worst.delta, -4);
    assert.equal(s.timeline.at(-1).t, 30);
    assert.equal(s.peak, 72);
});

test('extraction en flux du champ dialogue, échappements compris', () => {
    const full = '{"dialogue": "J\'ai mal \\"ici\\",\\ndocteur \\u00e9", "emotion": "douleur"}';
    for (let i = 0; i < full.length; i++) {
        const r = C.extractStreamingField(full.slice(0, i), 'dialogue');
        assert.ok(!r.done || r.text === 'J\'ai mal "ici",\ndocteur é', `coupure à ${i}`);
        assert.ok(!/\\/.test(r.text), `pas d'échappement brut à ${i}`);
    }
    const r = C.extractStreamingField(full, 'dialogue');
    assert.deepEqual([r.text, r.done], ['J\'ai mal "ici",\ndocteur é', true]);
    assert.ok(C.extractStreamingField('{"dialogue": null,', 'dialogue').isNull);
    assert.equal(C.extractStreamingField('{"emo', 'dialogue').found, false);
});

test('découpage en phrases pour la voix', () => {
    const text = "Oui. Ça a commencé hier soir, après le repas. Vous croyez que c'est grave ? Je";
    const r = C.takeSentences(text, 0, false);
    assert.deepEqual(r.sentences, ["Oui. Ça a commencé hier soir, après le repas.", "Vous croyez que c'est grave ?"]);
    const end = C.takeSentences(text, r.next, true);
    assert.deepEqual(end.sentences, ['Je']);
    assert.equal(C.speakableText('*Il grimace* (soupir) « Ça serre. »'), 'Ça serre.');
});

test('prosodie : anxiété, âge, sexe', () => {
    const calm = C.prosody({ anxiety: 20, age: 40, sex: 'M' });
    const panic = C.prosody({ anxiety: 95, age: 40, sex: 'M', emotion: 'peur' });
    const old = C.prosody({ anxiety: 40, age: 85, sex: 'F' });
    assert.ok(panic.rate > calm.rate);
    assert.ok(old.rate < calm.rate);
    assert.ok(old.female && old.elderly);
    assert.match(panic.instructions, /tremblante/);
    assert.equal(C.prosody({ age: 6 }).child, true);
});

test('émotions normalisées et expressions 3D existantes', () => {
    assert.equal(C.normalizeEmotion('Anxieux'), 'peur');
    assert.equal(C.normalizeEmotion('colère'), 'colere');
    assert.equal(C.normalizeEmotion('???'), 'neutre');
    // Les expressions renvoyées doivent exister dans PatientAnimator.
    const src = fs.readFileSync(new URL('../js/three-animations.js', import.meta.url), 'utf8');
    for (const e of C.EMOTIONS) {
        const expr = C.expressionFor(e);
        assert.match(src, new RegExp(`\\b${expr}:\\s*\\{`), `${e} → ${expr}`);
    }
});

test('le bloc de prompt reflète le palier et l’ultimatum', () => {
    const a = C.createAlliance({ trust: 18 });
    a.applyTurn({ trustDelta: -6 });
    const block = C.promptBlock(a.snapshot());
    assert.match(block, /Rupture/);
    assert.match(block, /ULTIMATUM/);
    assert.match(block, /trustDelta/);
    assert.doesNotMatch(C.promptBlock(C.createAlliance({ trust: 80 }).snapshot()), /ULTIMATUM/);
});

test('répliques locales non vides et variées', () => {
    const lines = new Set([0, 1, 2].map(i => C.relanceLine({ anxiety: 80, count: i })));
    assert.equal(lines.size, 3);
    assert.ok(C.ultimatumLine(1) && C.recoverLine(2) && C.walkoutLine(3));
});
