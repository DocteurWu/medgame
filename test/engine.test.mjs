import { test } from 'node:test';
import assert from 'node:assert';
import { MedGameEngine } from '../engine/MedGameEngine.js';

const originalFetch = globalThis.fetch;

function setupMockFetch(dialogueResponse, exams = null, prescriptions = null) {
    globalThis.fetch = async () => {
        const jsonContent = JSON.stringify({
            dialogue: dialogueResponse,
            exams: exams,
            prescriptions: prescriptions,
            otherActions: null,
            vitalChanges: null,
            narrativeResponse: "Le patient répond."
        });
        return {
            ok: true,
            status: 200,
            json: async () => ({
                choices: [
                    {
                        message: {
                            content: jsonContent
                        }
                    }
                ]
            })
        };
    };
}

function restoreFetch() {
    globalThis.fetch = originalFetch;
}

test('MedGameEngine — Case Management & Vitals', async (t) => {
    const engine = new MedGameEngine();

    await t.test('listCases should return case index structure', async () => {
        const cases = await engine.listCases();
        assert.ok(cases);
        assert.ok(cases.cardiologie);
        assert.ok(Array.isArray(cases.cardiologie));
    });

    await t.test('startCase should initialize case and shims', async () => {
        const state = await engine.startCase('CARDIO_angor_stable.json');
        assert.equal(state.success, true);
        assert.equal(state.caseId, 'cardio_angor_stable');
        assert.equal(state.patient.nom, 'Bennet');
        assert.equal(state.patient.age, 58);
        assert.equal(state.vitals.heartRate, 78);
        assert.equal(state.vitals.systolic, 135);
        assert.equal(state.vitals.diastolic, 85);
        assert.equal(state.isFinished, false);
    });

    await t.test('updateVitals should follow dynamics and physiological changes', async () => {
        await engine.startCase('CARDIO_angor_stable.json');
        
        // Vitals before
        const hrBefore = engine.vitals.heartRate;
        
        // Simulate time passing (fast forward) by adding time penalty
        engine.timePenalties += 300; // 5 min
        engine.updateVitals();
        
        const hrAfter = engine.vitals.heartRate;
        
        // Angor stable trend goes up towards 95 bpm
        assert.ok(hrAfter > hrBefore, `Vitals should change towards aggravation targets. hrBefore: ${hrBefore}, hrAfter: ${hrAfter}`);
    });
});

test('MedGameEngine — Semio Locks & Solving', async (t) => {
    const engine = new MedGameEngine();
    await engine.startCase('CARDIO_angor_stable.json');

    await t.test('locks should initially be locked and target fields obscured', async () => {
        // Order ECG to see results
        engine.orderExams(['ECG']);
        const state = engine.getState();
        const lock = state.locks.find(l => l.id === 'lock_CARDIO_angor_01');
        assert.equal(lock.unlocked, false);
        assert.ok(state.examResults.ECG.includes('🔒'), "ECG target fields should be locked initially");
    });

    await t.test('submitLock with correct MCQ answer should unlock', async () => {
        const result = engine.submitLock('lock_CARDIO_angor_01', 0); // Correct choice is index 0
        assert.equal(result.success, true);
        assert.equal(result.unlocked, true);
        
        const state = engine.getState();
        const lock = state.locks.find(l => l.id === 'lock_CARDIO_angor_01');
        assert.equal(lock.unlocked, true);
        assert.ok(!state.examResults.ECG.includes('🔒'), "ECG result should be unlocked now");
    });
});

test('MedGameEngine — LLM Chat & GM Responses', async (t) => {
    const engine = new MedGameEngine();
    engine.apiKey = 'test-key'; // Activate LLM pathway
    await engine.startCase('CARDIO_angor_stable.json');

    await t.test('LLM chat should return relevant case responses', async () => {
        setupMockFetch("Bonjour docteur. J'ai une douleur thoracique...");
        const result = await engine.chat('Bonjour, quel est le motif de votre hospitalisation ?');
        assert.ok(result.response.toLowerCase().includes('douleur thoracique'));
        assert.equal(engine.chatHistory.length, 3); // Greeting + user message + response
        restoreFetch();
    });
});

test('MedGameEngine — Full Game Flow & Scoring', async (t) => {
    const engine = new MedGameEngine();
    await engine.startCase('CARDIO_angor_stable.json');

    await t.test('should prescribe, order exams, select diagnostic and submit for score', async () => {
        // Prescribe correct treatments
        engine.prescribe(['Bêta-bloquant', 'Trinitrine sublinguale (dérivé nitré)']);
        
        // Order some exams
        engine.orderExams(['ECG', 'Test d\'effort']);

        // Solve first lock
        engine.submitLock('lock_CARDIO_angor_01', 0);

        // Select diagnostic
        engine.selectDiagnostic('Angor stable');

        // Submit
        const submitResult = engine.submit();
        assert.equal(submitResult.success, true);
        assert.ok(submitResult.score > 50, `Score should be high for correct diagnostic & treatments. Got: ${submitResult.score}`);
        assert.equal(engine.isFinished, true);
    });

    await t.test('should auto-order exams and auto-prescribe treatments mentioned in chat via LLM output', async () => {
        const testEngine = new MedGameEngine();
        testEngine.apiKey = 'test-key'; // Activate LLM pathway
        await testEngine.startCase('CARDIO_angor_stable.json');

        // Check initial state
        assert.deepEqual(testEngine.activeExams, []);
        assert.deepEqual(testEngine.selectedTreatments, []);

        // Mock LLM response extracting ECG and Bêta-bloquant
        setupMockFetch(
            "D'accord, faites l'examen.",
            [{ type: "ECG" }],
            [{ nom: "Bêta-bloquant" }]
        );

        await testEngine.chat('Je veux faire un ECG rapidement et je lui prescris un Bêta-bloquant');
        
        assert.ok(testEngine.activeExams.includes('ECG'), 'ECG should be auto-ordered');
        assert.ok(testEngine.selectedTreatments.includes('Bêta-bloquant'), 'Bêta-bloquant should be auto-prescribed');
        restoreFetch();
    });

    await t.test('should auto-submit the game when time runs out in getState()', async () => {
        const testEngine = new MedGameEngine();
        await testEngine.startCase('CARDIO_angor_stable.json');
        
        assert.equal(testEngine.isFinished, false);
        
        // Force time Limit to expire by manipulating startedAt
        testEngine.startedAt = Date.now() - (testEngine.timeLimit + 10) * 1000;
        
        // Retrieve state, which should trigger auto-submit
        const state = testEngine.getState();
        assert.equal(testEngine.isFinished, true, 'Game should be auto-finished on timeout');
        assert.equal(state.isFinished, true);
        assert.ok(state.scoreBreakdown);
    });
});
