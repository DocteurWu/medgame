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

test('Auscultation Database Integrity, HLS-CMDS & SPRSound Integration', async (t) => {
    await t.test('database contains 25 total cases with 11 cardiac and 14 pulmonary', () => {
        assert.equal(Array.isArray(AUSCULTATION_DATABASE), true);
        assert.equal(AUSCULTATION_DATABASE.length, 25, 'Must have exactly 25 clinical cases');
        
        const cardiac = AUSCULTATION_DATABASE.filter(c => c.type === 'cardiac');
        const pulmonary = AUSCULTATION_DATABASE.filter(c => c.type === 'pulmonary');
        assert.equal(cardiac.length, 11, 'Must have 11 cardiac cases');
        assert.equal(pulmonary.length, 14, 'Must have 14 pulmonary cases');
    });

    await t.test('all cases have unique ids and optimalHotspot is present in audioFiles', () => {
        const ids = new Set();
        for (const c of AUSCULTATION_DATABASE) {
            assert.ok(!ids.has(c.id), `Duplicate case id found: ${c.id}`);
            ids.add(c.id);
            if (c.audioFiles) {
                assert.ok(
                    c.optimalHotspot in c.audioFiles,
                    `Case ${c.id} optimalHotspot "${c.optimalHotspot}" must be present in audioFiles`
                );
            }
        }
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

    await t.test('all referenced HLS-CMDS and SPRSound wav files exist on disk and have valid WAV header', () => {
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
        assert.ok(totalWavsReferenced >= 50, `Expected at least 50 audio file mappings, found ${totalWavsReferenced}`);
    });

    await t.test('cases intended for real audio vs synthesis comply with clinical rules', () => {
        const realAudioCases = AUSCULTATION_DATABASE.filter(c => !!c.audioFiles);
        const synthCases = AUSCULTATION_DATABASE.filter(c => !c.audioFiles);

        // Retrecissement aortique serre must be preserved in synthesis
        const asCase = AUSCULTATION_DATABASE.find(c => c.id === 'auscult_as');
        assert.ok(!asCase.audioFiles, 'auscult_as must remain synthetic to preserve B2 abolition and carotid radiation');

        // Frottement pericardique and stridor must remain synthetic
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

        // Pediatric cases from SPRSound dataset have real audio
        const expectedSprs = [
            'auscult_ped_bronchiolite',
            'auscult_ped_asthme',
            'auscult_ped_stridor',
            'auscult_ped_encombrement',
            'auscult_ped_crackles_fins',
            'auscult_ped_crackles_grossiers',
            'auscult_ped_mixte_foyers'
        ];
        for (const id of expectedSprs) {
            const found = AUSCULTATION_DATABASE.find(c => c.id === id);
            assert.ok(found, `Missing SPRSound case ${id}`);
            assert.ok(found.audioFiles, `SPRSound case ${id} must have real audioFiles`);
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

test('Auscultation Raw Sounds Catalog Integrity (126 Files)', async (t) => {
    const soundsPath = path.resolve('data/auscultation-sounds.js');
    assert.ok(fs.existsSync(soundsPath), 'data/auscultation-sounds.js must exist');

    const soundsCode = fs.readFileSync(soundsPath, 'utf-8');
    const vmSounds = { module: { exports: {} } };
    const fnSounds = new Function('module', 'exports', 'window', soundsCode);
    fnSounds(vmSounds.module, vmSounds.module.exports, {});
    const { AUSCULTATION_RAW_SOUNDS, AUSCULTATION_SOUND_PROFILES } = vmSounds.module.exports;

    await t.test('catalog contains exactly 126 raw recordings (50 cardiac, 50 pulmonary adult, 26 pediatric)', () => {
        assert.ok(Array.isArray(AUSCULTATION_RAW_SOUNDS), 'Must be an array');
        assert.equal(AUSCULTATION_RAW_SOUNDS.length, 126, 'Must have exactly 126 raw sounds');

        const cardiac = AUSCULTATION_RAW_SOUNDS.filter(s => s.category === 'cardiac');
        const pulmonary = AUSCULTATION_RAW_SOUNDS.filter(s => s.category === 'pulmonary');
        const pediatric = AUSCULTATION_RAW_SOUNDS.filter(s => s.category === 'pediatric');

        assert.equal(cardiac.length, 50, 'Must have 50 cardiac sounds');
        assert.equal(pulmonary.length, 50, 'Must have 50 adult pulmonary sounds');
        assert.equal(pediatric.length, 26, 'Must have 26 pediatric sounds');
    });

    await t.test('all 126 raw sound files exist on disk with valid RIFF/WAVE header and metadata', () => {
        const ids = new Set();
        const validHotspots = [
            'apex', 'aortique', 'pulmonaire', 'tricuspide', 'carotide_droite', 'aisselle_gauche',
            'poumon_apex_droit', 'poumon_apex_gauche', 'poumon_champs_moyen',
            'poumon_base_droite', 'poumon_base_gauche', 'trachee'
        ];

        for (const s of AUSCULTATION_RAW_SOUNDS) {
            assert.ok(s.id, 'Sound missing id');
            assert.ok(!ids.has(s.id), `Duplicate sound id: ${s.id}`);
            ids.add(s.id);

            assert.ok(s.title && s.title.length > 5, `Sound ${s.id} missing title`);
            assert.ok(validHotspots.includes(s.hotspot), `Sound ${s.id} invalid hotspot: ${s.hotspot}`);
            assert.ok(s.filePath, `Sound ${s.id} missing filePath`);

            const fullPath = path.resolve(s.filePath);
            assert.ok(fs.existsSync(fullPath), `Audio file does not exist: ${s.filePath}`);
            const stat = fs.statSync(fullPath);
            assert.ok(stat.size > 10000, `Audio file too small: ${s.filePath}`);

            const fd = fs.openSync(fullPath, 'r');
            const header = Buffer.alloc(12);
            fs.readSync(fd, header, 0, 12, 0);
            fs.closeSync(fd);
            assert.equal(header.toString('ascii', 0, 4), 'RIFF');
            assert.equal(header.toString('ascii', 8, 12), 'WAVE');
        }
    });

    await t.test('catalog contains 23 grouped sound profiles covering multi-hotspot listening', () => {
        assert.ok(Array.isArray(AUSCULTATION_SOUND_PROFILES), 'Must be an array of sound profiles');
        assert.equal(AUSCULTATION_SOUND_PROFILES.length, 23, 'Must have exactly 23 grouped sound profiles');

        const cardiacProfiles = AUSCULTATION_SOUND_PROFILES.filter(p => p.category === 'cardiac');
        const pulmonaryProfiles = AUSCULTATION_SOUND_PROFILES.filter(p => p.category === 'pulmonary');
        const pediatricProfiles = AUSCULTATION_SOUND_PROFILES.filter(p => p.category === 'pediatric');

        assert.equal(cardiacProfiles.length, 10, 'Must have 10 cardiac profiles');
        assert.equal(pulmonaryProfiles.length, 6, 'Must have 6 adult pulmonary profiles');
        assert.equal(pediatricProfiles.length, 7, 'Must have 7 pediatric profiles');

        for (const p of AUSCULTATION_SOUND_PROFILES) {
            assert.ok(p.id, `Profile missing id: ${p.title}`);
            assert.ok(p.title, `Profile missing title: ${p.id}`);
            assert.ok(p.optimalHotspot, `Profile missing optimalHotspot: ${p.id}`);
            assert.ok(Array.isArray(p.availableHotspots) && p.availableHotspots.length > 0, `Profile missing availableHotspots: ${p.id}`);
            assert.ok(p.audioFiles && Object.keys(p.audioFiles).length > 0, `Profile missing audioFiles: ${p.id}`);

            // Chaque foyer disponible doit avoir son fichier audio
            for (const h of p.availableHotspots) {
                assert.ok(p.audioFiles[h], `Profile ${p.id} missing audio for available hotspot ${h}`);
                const filePath = path.resolve(p.audioFiles[h]);
                assert.ok(fs.existsSync(filePath), `Audio file not found on disk: ${p.audioFiles[h]}`);
            }
        }
    });

    await t.test('zero em-dashes and zero emojis in auscultation modules', () => {
        const checkedFiles = [
            'data/auscultation-sounds.js',
            'auscultation.html',
            'js/auscultation.js',
            'css/auscultation.css'
        ];
        const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

        for (const file of checkedFiles) {
            const content = fs.readFileSync(path.resolve(file), 'utf-8');
            assert.ok(!/[\u2014\u2013]/.test(content), `Em-dash found in ${file}`);
            assert.ok(!emojiRegex.test(content), `Emoji found in ${file}`);
        }
    });
});

