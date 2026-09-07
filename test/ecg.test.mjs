import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Load ECG database
const dbPath = path.resolve('data/ecg-database.js');
const dbCode = fs.readFileSync(dbPath, 'utf-8');
const vmContext = { module: { exports: {} } };
const fnDb = new Function('module', 'exports', 'window', dbCode);
fnDb(vmContext.module, vmContext.module.exports, {});
const { ECG_DATABASE } = vmContext.module.exports;

// Load ECG Canvas Renderer
const canvasPath = path.resolve('js/ecg-canvas.js');
const canvasCode = fs.readFileSync(canvasPath, 'utf-8');
const vmContextCanvas = { module: { exports: {} } };
const fnCanvas = new Function('module', 'exports', 'window', canvasCode);
fnCanvas(vmContextCanvas.module, vmContextCanvas.module.exports, {});
const { ECGCanvasRenderer } = vmContextCanvas.module.exports;

const LEAD_NAMES = ['DI', 'DII', 'DIII', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

test('ECG Database Structure & Integrity', async (t) => {
    await t.test('database contains exactly 20 reference clinical cases', () => {
        assert.equal(Array.isArray(ECG_DATABASE), true);
        assert.equal(ECG_DATABASE.length, 20, 'Must have exactly 20 ECG cases');

        const realCases = ECG_DATABASE.filter(c => c.signalFile);
        const simCases = ECG_DATABASE.filter(c => !c.signalFile);
        assert.equal(realCases.length, 12, 'Must have 12 cases with real PTB-XL signals');
        assert.equal(simCases.length, 8, 'Must have 8 high-fidelity simulation cases');
    });

    await t.test('all cases have valid clinical metadata, metrics, and QCM data', () => {
        const validDifficulties = ['debutant', 'intermediaire', 'urgence', 'expert'];

        for (const c of ECG_DATABASE) {
            assert.ok(c.id, `Case missing id`);
            assert.ok(c.title, `Case ${c.id} missing title`);
            assert.ok(c.category, `Case ${c.id} missing category`);
            assert.ok(validDifficulties.includes(c.difficulty), `Case ${c.id} invalid difficulty: ${c.difficulty}`);
            assert.ok(c.patient && c.patient.length >= 10, `Case ${c.id} invalid patient description`);

            // Metrics
            assert.ok(c.metrics, `Case ${c.id} missing metrics`);
            assert.ok(c.metrics.heartRate > 0, `Case ${c.id} invalid heart rate`);
            assert.ok(c.metrics.rhythm, `Case ${c.id} missing rhythm description`);
            assert.ok(c.metrics.axis, `Case ${c.id} missing axis`);
            assert.ok(typeof c.metrics.qrsDuration === 'number', `Case ${c.id} invalid qrsDuration`);
            assert.ok(typeof c.metrics.qtcInterval === 'number', `Case ${c.id} invalid qtcInterval`);

            // Morphology
            assert.ok(c.morphology, `Case ${c.id} missing morphology`);
            assert.ok(c.morphology.leads, `Case ${c.id} missing morphology.leads`);
            for (const lead of LEAD_NAMES) {
                assert.ok(c.morphology.leads[lead], `Case ${c.id} missing lead ${lead} morphology`);
            }

            // Evaluation QCM
            assert.ok(c.question && c.question.length > 5, `Case ${c.id} missing question`);
            assert.ok(Array.isArray(c.options) && c.options.length === 4, `Case ${c.id} must have exactly 4 options`);
            assert.ok(Number.isInteger(c.correctIndex) && c.correctIndex >= 0 && c.correctIndex < 4, `Case ${c.id} invalid correctIndex`);
            assert.ok(c.explanation && c.explanation.length > 25, `Case ${c.id} missing detailed EDN explanation`);
        }
    });
});

test('PTB-XL Real Clinical Signals on Disk', async (t) => {
    const realCases = ECG_DATABASE.filter(c => c.signalFile);

    for (const c of realCases) {
        await t.test(`signal file for ${c.id} exists and matches PTB-XL format`, () => {
            const fullPath = path.resolve(c.signalFile);
            assert.ok(fs.existsSync(fullPath), `Signal file not found: ${c.signalFile}`);

            const raw = fs.readFileSync(fullPath, 'utf-8');
            const data = JSON.parse(raw);

            assert.equal(data.id, c.id);
            assert.ok(data.source.includes('PTB-XL'), `Source must mention PTB-XL: ${data.source}`);
            assert.equal(data.sampleRate, 100, 'Must be sampled at 100 Hz');
            assert.equal(data.durationSec, 10, 'Must be 10 seconds duration');
            assert.ok(data.leads, 'Must have leads object');

            for (const lead of LEAD_NAMES) {
                const samples = data.leads[lead];
                assert.ok(Array.isArray(samples), `Lead ${lead} must be an array`);
                assert.equal(samples.length, 1000, `Lead ${lead} must have exactly 1000 samples (10s @ 100Hz)`);

                // Check amplitude range (-10 mV to +10 mV is physiological)
                for (let i = 0; i < samples.length; i += 50) {
                    assert.ok(samples[i] >= -10 && samples[i] <= 10, `Sample at index ${i} out of physiological range: ${samples[i]}`);
                }
            }
        });
    }
});

test('ECG Canvas Renderer & Bazett QTc Caliper Calculation', async (t) => {
    await t.test('renderer instantiates and calculates caliper metrics with Bazett QTc', () => {
        const renderer = new ECGCanvasRenderer(null, { mmPx: 4 });
        renderer.currentCase = {
            id: 'test_case',
            metrics: { heartRate: 75 }
        };
        renderer.caliper.active = true;

        // At mmPx = 4:
        // 40 px = 10 mm.
        // At 25 mm/s: 1 mm = 40 ms -> 10 mm = 400 ms.
        renderer.caliper.t1 = 100;
        renderer.caliper.t2 = 140; // delta 40 px = 10 mm = 400 ms

        // Voltage: delta 20 px = 5 mm -> at 10 mm/mV, 5 mm = 0.5 mV.
        renderer.caliper.v1 = 200;
        renderer.caliper.v2 = 220; // delta 20 px = 5 mm = 0.5 mV

        const metrics = renderer.getCaliperMetrics();
        assert.ok(metrics);
        assert.equal(metrics.durationMs, 400);
        assert.equal(metrics.voltageMv, 0.5);
        assert.equal(metrics.deltaMmT, 10);
        assert.equal(metrics.deltaMmV, 5);

        // Bazett QTc: HR = 75 bpm -> RR_sec = 60 / 75 = 0.8 s.
        // QTc = 400 / sqrt(0.8) = 400 / 0.894427... = 447 ms.
        assert.equal(metrics.qtcBazett, 447, 'QTc must follow Bazett formula');
    });

    await t.test('caliper calculates QTc correctly with HR = 60 bpm', () => {
        const renderer = new ECGCanvasRenderer(null, { mmPx: 4 });
        renderer.currentCase = {
            id: 'test_case_60',
            metrics: { heartRate: 60 } // RR = 1.0s -> sqrt(RR) = 1.0
        };
        renderer.caliper.active = true;
        renderer.caliper.t1 = 100;
        renderer.caliper.t2 = 145; // 45 px / 4 = 11.25 mm * 40 = 450 ms

        const metrics = renderer.getCaliperMetrics();
        assert.equal(metrics.durationMs, 450);
        // At 60 bpm, QTc == QT
        assert.equal(metrics.qtcBazett, 450);
    });

    await t.test('caliper estimates heart rate for RR intervals', () => {
        const renderer = new ECGCanvasRenderer(null, { mmPx: 4 });
        renderer.caliper.active = true;
        // 80 px / 4 = 20 mm * 40 = 800 ms.
        // Estimated HR = 60000 / 800 = 75 bpm.
        renderer.caliper.t1 = 100;
        renderer.caliper.t2 = 180;

        const metrics = renderer.getCaliperMetrics();
        assert.equal(metrics.durationMs, 800);
        assert.equal(metrics.estimatedHr, 75);
    });

    await t.test('renderer setCase caches signals and gracefully falls back to synthesis without canvas errors', () => {
        const renderer = new ECGCanvasRenderer(null);
        const testSignal = {
            id: 'mock_sig',
            sampleRate: 100,
            leads: { DI: [0, 0.1, 0.2] }
        };
        renderer.signalCache.set('mock_file.json', testSignal);

        let signalLoadedResult = 'not_called';
        renderer.onSignalLoaded = (sig) => {
            signalLoadedResult = sig;
        };

        renderer.setCase({
            id: 'mock_case',
            signalFile: 'mock_file.json',
            metrics: { heartRate: 72 }
        });

        assert.equal(renderer.currentSignal, testSignal);
        assert.equal(signalLoadedResult, testSignal);
    });
});
