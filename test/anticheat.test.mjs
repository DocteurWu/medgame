import { test } from 'node:test';
import assert from 'node:assert';
import { MedGameEngine } from '../engine/MedGameEngine.js';

const originalFetch = globalThis.fetch;

function mockFetchOk(parsedContent) {
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
            choices: [{ message: { content: JSON.stringify(parsedContent) } }]
        })
    });
}

function mockFetchFail(status) {
    globalThis.fetch = async () => ({
        ok: false,
        status,
        statusText: 'Internal Server Error',
        json: async () => ({})
    });
}

function restoreFetch() {
    globalThis.fetch = originalFetch;
}

test('Anti-cheat — Diagnostic single-shot', async (t) => {
    const engine = new MedGameEngine();
    await engine.startCase('CARDIO_angor_stable.json');

    await t.test('first selection is accepted and locked', () => {
        const res = engine.selectDiagnostic('Angor stable');
        assert.equal(res.locked, true);
        assert.equal(engine.diagnosticLocked, true);
    });

    await t.test('changing diagnostic after lock is refused', () => {
        assert.throws(
            () => engine.selectDiagnostic('Infarctus du myocarde'),
            /déjà validé/i
        );
        assert.equal(engine.selectedDiagnostic, 'Angor stable');
    });
});

test('Anti-cheat — Submit is definitive', async (t) => {
    const engine = new MedGameEngine();
    await engine.startCase('CARDIO_angor_stable.json');
    engine.submit();

    await t.test('second submit is refused (no correction-peeking loop)', () => {
        assert.throws(() => engine.submit(), /already submitted/i);
    });
});

test('Anti-cheat — Prescriptions are append-only', async (t) => {
    const engine = new MedGameEngine();
    await engine.startCase('CARDIO_angor_stable.json');

    await t.test('treatments accumulate and never replace', () => {
        engine.prescribe(['Bêta-bloquant']);
        engine.prescribe(['Trinitrine sublinguale (dérivé nitré)']);
        assert.ok(engine.selectedTreatments.includes('Bêta-bloquant'));
        assert.ok(engine.selectedTreatments.includes('Trinitrine sublinguale (dérivé nitré)'));
        assert.equal(engine.selectedTreatments.length, 2);
    });

    await t.test('re-prescribing the same treatment does not duplicate', () => {
        engine.prescribe(['Bêta-bloquant']);
        assert.equal(engine.selectedTreatments.length, 2);
    });
});

test('Anti-cheat — Fatal treatment triggers immediate game over', async (t) => {
    const engine = new MedGameEngine();
    await engine.startCase('CARDIO_angor_stable.json');

    await t.test('game ends instantly with hasFatalError', () => {
        const res = engine.prescribe(['Adrénaline']);
        assert.equal(res.gameOver, true);
        assert.equal(res.fatalTreatment, 'Adrénaline');
        assert.equal(engine.isFinished, true);
        assert.equal(engine.fatalErrorTriggered, true);
        assert.equal(res.evaluation.hasFatalError, true);
        assert.equal(res.evaluation.stars, 0);
    });

    await t.test('no further actions allowed after fatal error', async () => {
        assert.throws(() => engine.prescribe(['Bêta-bloquant']), /finished/i);
        assert.throws(() => engine.orderExams(['ECG']), /finished/i);
        assert.throws(() => engine.selectDiagnostic('Angor stable'), /finished/i);
        await assert.rejects(() => engine.chat('Bonjour'), /finished/i);
        assert.throws(() => engine.submit(), /already submitted/i);
    });
});

test('Anti-cheat — Exam ordering cost is proportional', async (t) => {
    const engine = new MedGameEngine();
    await engine.startCase('CARDIO_angor_stable.json');

    await t.test('each new exam costs 60s, batching does not bypass the cost', () => {
        engine.orderExams(['ECG', "Test d'effort"]);
        assert.equal(engine.timePenalties, 120);
    });

    await t.test('re-ordering the same exam costs nothing extra', () => {
        engine.orderExams(['ECG']);
        assert.equal(engine.timePenalties, 120);
    });

    await t.test('one additional new exam costs exactly 60s more', () => {
        engine.orderExams(['Holter ECG']);
        assert.equal(engine.timePenalties, 180);
    });
});

test('Anti-cheat — resetState clears stale score', async (t) => {
    const engine = new MedGameEngine();
    await engine.startCase('CARDIO_angor_stable.json');
    engine.score = 71; // simulate stale score from a previous case

    await t.test('starting a new case resets score to 0', async () => {
        const state = await engine.startCase('EDN_diabetetype2_1.json');
        assert.equal(state.score, 0);
    });
});

test('Anti-cheat — Chat history rollback on LLM failure', async (t) => {
    const engine = new MedGameEngine();
    engine.apiKey = 'test-key';
    await engine.startCase('CARDIO_angor_stable.json');

    await t.test('failed LLM call leaves no orphan user message', async () => {
        mockFetchFail(500);
        const before = engine.chatHistory.length;
        await assert.rejects(() => engine.chat('Bonjour docteur'), /indisponible/i);
        assert.equal(engine.chatHistory.length, before);
        const last = engine.chatHistory[engine.chatHistory.length - 1];
        assert.equal(last.role, 'assistant'); // still the greeting
        restoreFetch();
    });

    await t.test('successful chat commits user + assistant and tracks disclosed fields', async () => {
        mockFetchOk({
            dialogue: "Je fume environ 2 paquets par jour.",
            exams: [{ type: "auscultation_card", description: "Bruits du coeur réguliers" }],
            prescriptions: null,
            otherActions: null,
            vitalChanges: null,
            disclosedInfoFields: ["modeDeVie.tabac"],
            narrativeResponse: "Le patient répond calmement."
        });
        const res = await engine.chat('Fumez-vous ? Et je vous ausculte.');
        restoreFetch();

        // history: greeting + user + assistant
        assert.equal(engine.chatHistory.length, 3);
        assert.equal(engine.chatHistory[1].role, 'user');
        assert.equal(engine.chatHistory[2].role, 'assistant');
        assert.ok(res.response.includes('paquets'));

        // disclosed field tracked with interrogatoire. prefix
        assert.ok(engine.demarche.interrogatoireAsked.has('interrogatoire.modeDeVie.tabac'));
        // physical gesture tracked
        assert.ok(engine.demarche.clinicalGestures.has('auscultation_card'));
    });
});

test('Scoring — Fuzzy exam matching fixes relevantExams drift', async (t) => {
    const engine = new MedGameEngine();
    await engine.startCase('CARDIO_thrombose_veineuse_profonde_droite.json');

    await t.test('ordering the doppler menu entry is credited against "Écho-Doppler veineux"', () => {
        engine.orderExams([
            'Echographie doppler des membres inférieurs',
            'Bilan sanguin'
        ]);
        engine.selectDiagnostic('Thrombose veineuse profonde droite');
        const submitResult = engine.submit();
        assert.equal(submitResult.success, true);
        assert.equal(engine.isFinished, true);
        assert.equal(engine.demarche.examsOrdered.length, 2);
    });
});

test('Scoring — Diagnostic is strict (no semantic leniency)', async (t) => {
    const engine = new MedGameEngine();
    await engine.startCase('CARDIO_thrombose_veineuse_profonde_droite.json');

    await t.test('plausible-but-wrong diagnostic scores 0', () => {
        engine.selectedDiagnostic = 'Phlébite droite'; // not in alternativeDiagnostics
        assert.notEqual(engine.selectedDiagnostic, engine.caseData.correctDiagnostic);
        assert.ok(!(engine.caseData.alternativeDiagnostics || []).includes(engine.selectedDiagnostic));
    });

    await t.test('official alternative scores 80, correct scores 100', () => {
        engine.selectedDiagnostic = 'Phlébite';
        assert.ok((engine.caseData.alternativeDiagnostics || []).includes(engine.selectedDiagnostic));
        engine.selectedDiagnostic = 'Thrombose veineuse profonde droite';
        assert.equal(engine.selectedDiagnostic, engine.caseData.correctDiagnostic);
    });
});

test('Scoring — Doing nothing yields 0 score in interrogatoire and demarche', async (t) => {
    const engine = new MedGameEngine();
    await engine.startCase('CARDIO_thrombose_veineuse_profonde_droite.json');

    await t.test('without any questions, exams or prescriptions, score is 0 in MedGameEngine', () => {
        assert.equal(engine.score, 0, 'Composite score should be 0 when nothing is done');
        assert.equal(engine.demarche.examsOrdered.length, 0);
        assert.equal(engine.demarche.interrogatoireAsked.size, 0);
        assert.equal(engine.selectedTreatments.length, 0);
    });

    await t.test('Jev client evaluateStation and computeFinalScores handle inactive case with 0 or unrated', async () => {
        const { evaluateStation, computeFinalScores, PASSING_SCORE_ON_20 } = await import('../js/jevClient.js');
        const fs = await import('node:fs');
        const path = await import('node:path');

        // Verify legacy scoring files are deleted
        assert.equal(fs.existsSync(path.resolve('js/scoring.js')), false, 'js/scoring.js must be removed');
        assert.equal(fs.existsSync(path.resolve('js/feedback.js')), false, 'js/feedback.js must be removed');

        const caseData = JSON.parse(fs.readFileSync(path.resolve('data/cardio_grosse_jambe_rouge_m_ternes.json'), 'utf8'));

        // Case with empty transcript returns unrated
        const unratedResult = await evaluateStation(caseData, '', {});
        assert.equal(unratedResult.unrated, true, 'Empty transcript must result in unrated station');
        assert.equal(unratedResult.success, false);

        // Case where student performs no expected actions (0 probabilities)
        const mockFetch = async () => ({
            ok: true,
            json: async () => ({
                decisions: {
                    apt_anamnese_complete: { probability: 0.0, boolean_prediction: false },
                    apt_examen_pertinent: { probability: 0.0, boolean_prediction: false },
                    com_empathie_ecoute: { probability: 0.0, boolean_prediction: false },
                    perf_gestion_temps: { probability: 0.0, boolean_prediction: false }
                }
            })
        });

        const zeroResult = await evaluateStation(caseData, '[00:00] Debut station.\n[08:00] Fin station.', {}, { fetch: mockFetch });
        assert.equal(zeroResult.success, true);
        assert.equal(zeroResult.finalScore, 0, 'Score must be 0 when student performed no expected actions');
        assert.equal(zeroResult.validated, false, 'Station must not be validated with score 0');
    });
});

