import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Import the database
const dbPath = path.resolve('data/auscultation-database.js');
const dbCode = fs.readFileSync(dbPath, 'utf-8');
const vmContext = { module: { exports: {} } };
const fn = new Function('module', 'exports', 'window', dbCode);
fn(vmContext.module, vmContext.module.exports, {});
const { AUSCULTATION_DATABASE } = vmContext.module.exports;

test('Auscultation Database Integrity & HLS-CMDS Integration', async (t) => {
    await t.test('database contains 18 total cases with 11 cardiac and 7 pulmonary', () => {
        assert.equal(Array.isArray(AUSCULTATION_DATABASE), true);
        assert.equal(AUSCULTATION_DATABASE.length, 18, 'Must have exactly 18 clinical cases');
        
        const cardiac = AUSCULTATION_DATABASE.filter(c => c.type === 'cardiac');
        const pulmonary = AUSCULTATION_DATABASE.filter(c => c.type === 'pulmonary');
        assert.equal(cardiac.length, 11, 'Must have 11 cardiac cases');
        assert.equal(pulmonary.length, 7, 'Must have 7 pulmonary cases');
    });

    await t.test('all cases have valid metadata, options and explanation', () => {
        const validDifficulties = ['debutant', 'intermediaire', 'expert'];
        const validTypes = ['cardiac', 'pulmonary'];

        for (const c of AUSCULTATION_DATABASE) {
            assert.ok(c.id, `Case missing id`);
            assert.ok(c.title, `Case ${c.id} missing title`);
            assert.ok(validTypes.includes(c.type), `Case ${c.id} invalid type: ${c.type}`);
            assert.ok(validDifficulties.includes(c.difficulty), `Case ${c.id} invalid difficulty: ${c.difficulty}`);
            assert.ok(c.patient && c.patient.length > 10, `Case ${c.id} invalid patient description`);
            assert.ok(c.semiology && c.semiology.length > 10, `Case ${c.id} invalid semiology`);
            assert.ok(c.audioParams, `Case ${c.id} missing audioParams fallback`);
            assert.ok(c.question && c.question.length > 5, `Case ${c.id} missing question`);
            assert.ok(Array.isArray(c.options) && c.options.length === 4, `Case ${c.id} must have exactly 4 options`);
            assert.ok(Number.isInteger(c.correctIndex) && c.correctIndex >= 0 && c.correctIndex < 4, `Case ${c.id} correctIndex invalid`);
            assert.ok(c.explanation && c.explanation.length > 20, `Case ${c.id} missing detailed explanation`);
        }
    });

    await t.test('all referenced HLS-CMDS wav files exist on disk and have valid WAV header', () => {
        let totalWavsReferenced = 0;
        for (const c of AUSCULTATION_DATABASE) {
            if (c.audioFiles) {
                for (const [hotspot, filePath] of Object.entries(c.audioFiles)) {
                    totalWavsReferenced++;
                    const fullPath = path.resolve(filePath);
                    assert.ok(fs.existsSync(fullPath), `Referenced wav does not exist: ${filePath} in case ${c.id}`);
                    const stat = fs.statSync(fullPath);
                    assert.ok(stat.size > 10000, `File ${filePath} is too small: ${stat.size} bytes`);
                    
                    // Verify WAV header
                    const fd = fs.openSync(fullPath, 'r');
                    const header = Buffer.alloc(12);
                    fs.readSync(fd, header, 0, 12, 0);
                    fs.closeSync(fd);
                    assert.equal(header.toString('ascii', 0, 4), 'RIFF');
                    assert.equal(header.toString('ascii', 8, 12), 'WAVE');
                }
            }
        }
        assert.ok(totalWavsReferenced >= 25, `Expected at least 25 audio file mappings, found ${totalWavsReferenced}`);
    });

    await t.test('cases intended for real audio vs synthesis comply with clinical rules', () => {
        const realAudioCases = AUSCULTATION_DATABASE.filter(c => !!c.audioFiles);
        const synthCases = AUSCULTATION_DATABASE.filter(c => !c.audioFiles);

        // Rétrécissement aortique serré must be preserved in synthesis
        const asCase = AUSCULTATION_DATABASE.find(c => c.id === 'auscult_as');
        assert.ok(!asCase.audioFiles, 'auscult_as must remain synthetic to preserve B2 abolition and carotid radiation');

        // Frottement péricardique and stridor must remain synthetic
        const rubCase = AUSCULTATION_DATABASE.find(c => c.id === 'auscult_pericardial_rub');
        assert.ok(!rubCase.audioFiles, 'auscult_pericardial_rub must remain synthetic (absent in HLS-CMDS)');
        const stridorCase = AUSCULTATION_DATABASE.find(c => c.id === 'auscult_stridor');
        assert.ok(!stridorCase.audioFiles, 'auscult_stridor must remain synthetic (absent in HLS-CMDS)');

        // New cases: AF, B4, AVB, Tachycardia, ESM, Rhonchi, Coarse Crackles, Pleural Rub have real audio
        const expectedReal = ['auscult_af', 'auscult_gallop_b4', 'auscult_avb', 'auscult_tachycardia', 'auscult_esm', 'auscult_rhonchi', 'auscult_coarse_crackles', 'auscult_pleural_rub'];
        for (const id of expectedReal) {
            const found = AUSCULTATION_DATABASE.find(c => c.id === id);
            assert.ok(found, `Missing case ${id}`);
            assert.ok(found.audioFiles, `Case ${id} must have real audioFiles`);
        }
    });
});

test('Auscultation Audio Engine Logic & Normalization', async (t) => {
    // Import AudioEngine
    const engineCode = fs.readFileSync(path.resolve('js/auscultation-audio.js'), 'utf-8');
    const vm = { module: { exports: {} } };
    const fnEngine = new Function('module', 'exports', 'window', engineCode);
    fnEngine(vm.module, vm.module.exports, {});
    const { AuscultationAudioEngine } = vm.module.exports;

    await t.test('instantiates and provides expected methods', () => {
        const engine = new AuscultationAudioEngine();
        assert.equal(typeof engine.play, 'function');
        assert.equal(typeof engine.stop, 'function');
        assert.equal(typeof engine.setCase, 'function');
        assert.equal(typeof engine.setHotspot, 'function');
        assert.equal(typeof engine.setFilterMode, 'function');
        assert.equal(typeof engine.getWaveform, 'function');
        assert.equal(typeof engine.hasRealAudio, 'function');
        assert.equal(typeof engine.getAudioMode, 'function');
    });

    await t.test('calculates hotspot attenuation correctly', () => {
        const engine = new AuscultationAudioEngine();
        const testCase = {
            optimalHotspot: 'apex',
            secondaryHotspots: ['tricuspide', 'aisselle_gauche']
        };
        engine.currentCase = testCase;

        engine.currentHotspot = 'apex';
        assert.equal(engine._getHotspotAttenuation(), 1.0, 'Optimal hotspot must have attenuation 1.0');

        engine.currentHotspot = 'tricuspide';
        assert.equal(engine._getHotspotAttenuation(), 0.65, 'Secondary hotspot must have attenuation 0.65');

        engine.currentHotspot = 'aortique';
        assert.equal(engine._getHotspotAttenuation(), 0.25, 'Distant hotspot must have attenuation 0.25');
    });

    await t.test('normalization algorithm scales low amplitude buffers properly', () => {
        const engine = new AuscultationAudioEngine();

        // Create mock AudioBuffer
        const length = 1000;
        const channelData = new Float32Array(length);
        // Peak at 0.05
        for (let i = 0; i < length; i++) {
            channelData[i] = 0.05 * Math.sin(i * 0.1);
        }

        const mockBuffer = {
            numberOfChannels: 1,
            getChannelData: () => channelData
        };

        engine._normalizeBuffer(mockBuffer, 0.85);

        let max = 0;
        for (let i = 0; i < length; i++) {
            if (Math.abs(channelData[i]) > max) max = Math.abs(channelData[i]);
        }

        assert.ok(max >= 0.80 && max <= 0.86, `Expected normalized peak near 0.85, got ${max}`);
    });

    await t.test('_getAudioUrlForCase selects appropriate hotspot or optimal fallback', () => {
        const engine = new AuscultationAudioEngine();
        const testCase = {
            optimalHotspot: 'apex',
            audioFiles: {
                'apex': 'assets/audio/auscultation/heart/F_N_A.wav',
                'aortique': 'assets/audio/auscultation/heart/M_N_RUSB.wav'
            }
        };

        assert.equal(engine._getAudioUrlForCase(testCase, 'aortique'), 'assets/audio/auscultation/heart/M_N_RUSB.wav');
        assert.equal(engine._getAudioUrlForCase(testCase, 'apex'), 'assets/audio/auscultation/heart/F_N_A.wav');
        // Remote hotspot falls back to optimal
        assert.equal(engine._getAudioUrlForCase(testCase, 'carotide_droite'), 'assets/audio/auscultation/heart/F_N_A.wav');
    });
});
