import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// 1. Chargement de la base PCG Trainer
const dbPath = path.resolve('data/pcg-trainer-database.js');
const dbCode = fs.readFileSync(dbPath, 'utf-8');
const vmContext = { module: { exports: {} }, window: {} };
const fnDb = new Function('module', 'exports', 'window', dbCode);
fnDb(vmContext.module, vmContext.module.exports, vmContext.window);
const PCG_TRAINER_DATABASE = vmContext.module.exports.PCG_TRAINER_DATABASE || vmContext.window.PCG_TRAINER_DATABASE;

test('PhysioNet CinC 2016 PCG Trainer Database Integrity', async (t) => {
    await t.test('database contains exactly 120 clips with a strict 60/60 normal/abnormal balance', () => {
        assert.ok(Array.isArray(PCG_TRAINER_DATABASE), 'PCG_TRAINER_DATABASE must be an array');
        assert.equal(PCG_TRAINER_DATABASE.length, 120, 'Expected exactly 120 PCG clips');

        const normalCases = PCG_TRAINER_DATABASE.filter(c => c.label === 'normal');
        const abnormalCases = PCG_TRAINER_DATABASE.filter(c => c.label === 'abnormal');

        assert.equal(normalCases.length, 60, 'Expected exactly 60 normal clips');
        assert.equal(abnormalCases.length, 60, 'Expected exactly 60 abnormal clips');
    });

    await t.test('all 6 PhysioNet challenge cohorts (training-a to training-f) are represented', () => {
        const expectedSets = ['training-a', 'training-b', 'training-c', 'training-d', 'training-e', 'training-f'];
        const foundSets = new Set(PCG_TRAINER_DATABASE.map(c => c.set));

        for (const s of expectedSets) {
            assert.ok(foundSets.has(s), `Missing cohort set: ${s}`);
            const inSet = PCG_TRAINER_DATABASE.filter(c => c.set === s);
            const norm = inSet.filter(c => c.label === 'normal').length;
            const abnorm = inSet.filter(c => c.label === 'abnormal').length;
            assert.ok(norm > 0, `Expected normal clips in ${s}`);
            assert.ok(abnorm > 0, `Expected abnormal clips in ${s}`);
            assert.equal(norm, abnorm, `Cohort ${s} must have balanced normal/abnormal distribution`);
        }
    });

    await t.test('all cases have valid clinical metadata, diagnosis, and decision', () => {
        for (const c of PCG_TRAINER_DATABASE) {
            assert.ok(c.id && c.id.startsWith('pcg_'), `Invalid ID in case ${c.id}`);
            assert.ok(c.record, `Missing record name in ${c.id}`);
            assert.ok(c.file && c.file.endsWith('.mp3'), `Invalid MP3 path in ${c.id}: ${c.file}`);
            assert.ok(c.patient && c.patient.length > 5, `Missing patient description in ${c.id}`);
            assert.ok(c.diagnosis && c.diagnosis.length > 3, `Missing diagnosis in ${c.id}`);
            assert.ok(c.transducerSite && c.transducerSite.length > 3, `Missing transducer site in ${c.id}`);
            assert.ok(c.explanation && c.explanation.length > 30, `Missing detailed clinical explanation in ${c.id}`);
            assert.ok(c.clinicalDecision && c.clinicalDecision.length > 5, `Missing clinical decision in ${c.id}`);

            // Validation de l'orientation selon le label
            if (c.label === 'normal') {
                assert.match(c.clinicalDecision, /Surveillance standard/i);
            } else {
                assert.match(c.clinicalDecision, /Référer au cardiologue/i);
            }
        }
    });

    await t.test('all referenced audio files exist on disk with valid MP3 headers and acceptable size', () => {
        let totalBytes = 0;
        for (const c of PCG_TRAINER_DATABASE) {
            const fullPath = path.resolve(c.file);
            assert.ok(fs.existsSync(fullPath), `Audio file does not exist: ${c.file}`);
            const stat = fs.statSync(fullPath);
            assert.ok(stat.size > 5000, `Audio file ${c.file} is suspiciously small: ${stat.size} bytes`);
            totalBytes += stat.size;

            // Vérification simple du header audio (ID3 ou sync word MPEG 0xFF)
            const fd = fs.openSync(fullPath, 'r');
            const buf = Buffer.alloc(4);
            fs.readSync(fd, buf, 0, 4, 0);
            fs.closeSync(fd);
            const isId3 = buf.toString('ascii', 0, 3) === 'ID3';
            const isMpegSync = buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0;
            assert.ok(isId3 || isMpegSync, `File ${c.file} is not a valid MP3 file`);
        }

        const totalMb = totalBytes / (1024 * 1024);
        assert.ok(totalMb < 15, `Total PCG audio size must remain under 15 MB, got ${totalMb.toFixed(2)} MB`);
    });

    await t.test('temporal S1 and S2 annotations are chronologically valid', () => {
        let annotatedCount = 0;
        for (const c of PCG_TRAINER_DATABASE) {
            assert.ok(c.annotations, `Missing annotations object in ${c.id}`);
            const { s1, s2 } = c.annotations;
            assert.ok(Array.isArray(s1), `s1 must be an array in ${c.id}`);
            assert.ok(Array.isArray(s2), `s2 must be an array in ${c.id}`);

            if (s1.length > 0 && s2.length > 0) {
                annotatedCount++;
                for (const seg of s1) {
                    assert.equal(seg.length, 2, `S1 segment must have [start, end] in ${c.id}`);
                    assert.ok(seg[0] >= 0, `S1 start time must be non-negative: ${seg[0]}`);
                    assert.ok(seg[1] > seg[0], `S1 end time must exceed start time: ${seg[1]} > ${seg[0]}`);
                }
                for (const seg of s2) {
                    assert.equal(seg.length, 2, `S2 segment must have [start, end] in ${c.id}`);
                    assert.ok(seg[0] >= 0, `S2 start time must be non-negative: ${seg[0]}`);
                    assert.ok(seg[1] > seg[0], `S2 end time must exceed start time: ${seg[1]} > ${seg[0]}`);
                }
            }
        }
        assert.equal(annotatedCount, 120, 'All 120 clips must possess valid S1 and S2 annotations');
    });
});

test('Auscultation Audio Engine Extended Methods', async (t) => {
    const engineCode = fs.readFileSync(path.resolve('js/auscultation-audio.js'), 'utf-8');
    const vmEngine = { module: { exports: {} }, window: {} };
    const fnEngine = new Function('module', 'exports', 'window', engineCode);
    fnEngine(vmEngine.module, vmEngine.module.exports, vmEngine.window);
    const { AuscultationAudioEngine } = vmEngine.module.exports;

    await t.test('engine includes setVolume and playFile methods', () => {
        const proto = AuscultationAudioEngine.prototype;
        assert.equal(typeof proto.setVolume, 'function', 'AuscultationAudioEngine must have setVolume()');
        assert.equal(typeof proto.playFile, 'function', 'AuscultationAudioEngine must have playFile()');
    });
});

test('PCG Trainer Controller & UI Integration', async (t) => {
    await t.test('js/auscultation-pcg.js exports PCGTrainer with expected API', () => {
        const pcgCode = fs.readFileSync(path.resolve('js/auscultation-pcg.js'), 'utf-8');
        const vmPcg = { module: { exports: {} }, window: {} };
        const fnPcg = new Function('module', 'exports', 'window', pcgCode);
        fnPcg(vmPcg.module, vmPcg.module.exports, vmPcg.window);
        const { PCGTrainer } = vmPcg.module.exports;

        assert.ok(PCGTrainer, 'PCGTrainer must be exported');
        assert.equal(typeof PCGTrainer.init, 'function');
        assert.equal(typeof PCGTrainer.loadCase, 'function');
        assert.equal(typeof PCGTrainer.playAudio, 'function');
        assert.equal(typeof PCGTrainer.stopAudio, 'function');
        assert.equal(typeof PCGTrainer.submitAnswer, 'function');
        assert.equal(typeof PCGTrainer.nextCase, 'function');
        assert.equal(typeof PCGTrainer.getState, 'function');
    });

    await t.test('auscultation.html contains the 3 navigation tabs and the PCG workspace', () => {
        const html = fs.readFileSync(path.resolve('auscultation.html'), 'utf-8');
        assert.ok(html.includes('id="tab-mode-learn"'), 'Missing tab-mode-learn');
        assert.ok(html.includes('id="tab-mode-quiz"'), 'Missing tab-mode-quiz');
        assert.ok(html.includes('id="tab-mode-pcg"'), 'Missing tab-mode-pcg');
        assert.ok(html.includes('id="pcg-workspace"'), 'Missing pcg-workspace container');
        assert.ok(html.includes('id="pcg-sidebar-panel"'), 'Missing pcg-sidebar-panel');
        assert.ok(html.includes('pcg-trainer-database.js'), 'Missing pcg-trainer-database.js script inclusion');
        assert.ok(html.includes('auscultation-pcg.js'), 'Missing auscultation-pcg.js script inclusion');
    });

    await t.test('auscultation-pcg.html exists as standalone mode page', () => {
        assert.ok(fs.existsSync(path.resolve('auscultation-pcg.html')), 'auscultation-pcg.html must exist');
        const html = fs.readFileSync(path.resolve('auscultation-pcg.html'), 'utf-8');
        assert.ok(html.includes('id="pcg-trainer-container"'), 'Missing pcg-trainer-container');
        assert.ok(html.includes('btn-pcg-normal'), 'Missing btn-pcg-normal');
        assert.ok(html.includes('btn-pcg-abnormal'), 'Missing btn-pcg-abnormal');
    });

    await t.test('ATTRIBUTIONS.md documents PhysioNet Challenge 2016 under ODC-BY 1.0', () => {
        const attr = fs.readFileSync(path.resolve('ATTRIBUTIONS.md'), 'utf-8');
        assert.ok(attr.includes('PhysioNet / CinC Challenge 2016'), 'Missing PhysioNet attribution heading');
        assert.ok(attr.includes('ODC-BY'), 'Missing ODC-BY license mention');
        assert.ok(attr.includes('Liu C, Springer D'), 'Missing authors citation in ATTRIBUTIONS.md');
    });
});
