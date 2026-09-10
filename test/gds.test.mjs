import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const gdsPath = path.resolve('js/gds.js');
const gdsCode = fs.readFileSync(gdsPath, 'utf-8');
const vmContext = { module: { exports: {} } };
const fn = new Function('module', 'exports', 'window', gdsCode);
fn(vmContext.module, vmContext.module.exports, {});
const GDS = vmContext.module.exports;

test('Simulateur Gaz du Sang — Henderson-Hasselbalch', async (t) => {
    await t.test('calcul direct de HCO3- à l\'équilibre normal', () => {
        const hco3 = GDS.computeHendersonHasselbalch({ pH: 7.40, paCO2: 40.0, target: 'hco3' });
        assert.ok(Math.abs(hco3 - 24.0) <= 0.5, `HCO3 attendu ~24.0, obtenu: ${hco3}`);
    });

    await t.test('calcul direct de PaCO2 à l\'équilibre normal', () => {
        const paCO2 = GDS.computeHendersonHasselbalch({ pH: 7.40, hco3: 24.0, target: 'paCO2' });
        assert.ok(Math.abs(paCO2 - 39.2) <= 0.2, `PaCO2 attendu ~39.2, obtenu: ${paCO2}`);
    });

    await t.test('calcul direct de pH à l\'équilibre normal', () => {
        const pH = GDS.computeHendersonHasselbalch({ paCO2: 40.0, hco3: 24.0, target: 'pH' });
        assert.ok(Math.abs(pH - 7.40) <= 0.02, `pH attendu ~7.40, obtenu: ${pH}`);
    });

    await t.test('bicarbonates dans l\'acidocétose sévère (pH 7.14, PaCO2 19)', () => {
        const hco3 = GDS.computeHendersonHasselbalch({ pH: 7.14, paCO2: 19.0, target: 'hco3' });
        assert.ok(Math.abs(hco3 - 6.4) <= 0.3, `HCO3 attendu ~6.4, obtenu: ${hco3}`);
    });

    await t.test('hypercapnie sévère dans la décompensation BPCO (pH 7.24, HCO3 32.5)', () => {
        const paCO2 = GDS.computeHendersonHasselbalch({ pH: 7.24, hco3: 32.5, target: 'paCO2' });
        assert.ok(Math.abs(paCO2 - 76.4) <= 1.0, `PaCO2 attendu ~76.4, obtenu: ${paCO2}`);
    });
});

test('Simulateur Gaz du Sang — Trou Anionique & Correction Albumine', async (t) => {
    await t.test('trou anionique normal avec albumine normale (40 g/L)', () => {
        const ag = GDS.computeAnionGap({ na: 140, cl: 104, hco3: 24, albumin: 40 });
        assert.equal(ag.measured, 12);
        assert.equal(ag.corrected, 12);
        assert.equal(ag.isElevated, false);
        assert.equal(ag.isAlbuminCorrected, false);
    });

    await t.test('trou anionique élevé dans l\'acidocétose (Na 132, Cl 96, HCO3 6.5)', () => {
        const ag = GDS.computeAnionGap({ na: 132, cl: 96, hco3: 6.5, albumin: 41 });
        assert.equal(ag.measured, 29.5);
        assert.equal(ag.isElevated, true);
    });

    await t.test('correction du trou anionique en cas d\'hypoalbuminémie sévère (28 g/L)', () => {
        const ag = GDS.computeAnionGap({ na: 138, cl: 101, hco3: 11, albumin: 28 });
        assert.equal(ag.measured, 26);
        // TA corrigé = 26 + 0.25 * (40 - 28) = 26 + 3 = 29
        assert.equal(ag.corrected, 29);
        assert.equal(ag.isAlbuminCorrected, true);
    });
});

test('Simulateur Gaz du Sang — Formule de Winter (Acidose Métabolique)', async (t) => {
    await t.test('PaCO2 attendue pour HCO3 = 6.5 mmol/L', () => {
        const w = GDS.computeWinter({ hco3: 6.5 });
        // 1.5 * 6.5 + 8 = 17.75 -> 17.8 +/- 2 -> 15.8 à 19.8
        assert.equal(w.expected, 17.8);
        assert.equal(w.min, 15.8);
        assert.equal(w.max, 19.8);
    });

    await t.test('PaCO2 attendue pour HCO3 = 12.0 mmol/L', () => {
        const w = GDS.computeWinter({ hco3: 12.0 });
        // 1.5 * 12 + 8 = 26 +/- 2 -> 24 à 28
        assert.equal(w.expected, 26.0);
        assert.equal(w.min, 24.0);
        assert.equal(w.max, 28.0);
    });
});

test('Simulateur Gaz du Sang — Compensation Alcalose Métabolique', async (t) => {
    await t.test('PaCO2 attendue pour HCO3 = 42.5 mmol/L (vomissements)', () => {
        const comp = GDS.computeMetabolicAlkalosisComp({ hco3: 42.5 });
        // 0.7 * 42.5 + 20 = 49.75 -> 49.8 (+/- 5) -> 44.8 à 54.8
        assert.equal(comp.expected, 49.8);
        assert.equal(comp.min, 44.8);
        assert.equal(comp.max, 54.8);
    });
});

test('Simulateur Gaz du Sang — Compensations Respiratoires Aiguë vs Chronique', async (t) => {
    await t.test('acidose respiratoire PaCO2 = 76 mmHg (BPCO)', () => {
        const comp = GDS.computeRespiratoryAcidosisComp({ paCO2: 76 });
        // delta = 36
        // Aiguë : 24 + 0.1 * 36 = 27.6 (+/- 2)
        assert.equal(comp.acute.expected, 27.6);
        // Chronique : 24 + 0.38 * 36 = 37.7 (+/- 2)
        assert.equal(comp.chronic.expected, 37.7);
    });

    await t.test('alcalose respiratoire PaCO2 = 23 mmHg (hyperventilation)', () => {
        const comp = GDS.computeRespiratoryAlkalosisComp({ paCO2: 23 });
        // delta = 17
        // Aiguë : 24 - 0.2 * 17 = 20.6 (+/- 2)
        assert.equal(comp.acute.expected, 20.6);
        // Chronique : 24 - 0.45 * 17 = 16.4 (+/- 2)
        assert.equal(comp.chronic.expected, 16.4);
    });
});

test('Simulateur Gaz du Sang — Delta-Ratio (Δ/Δ)', async (t) => {
    await t.test('acidose métabolique à TA élevé pure (DKA)', () => {
        // TA = 29.5, HCO3 = 6.5 -> delta TA = 17.5, delta HCO3 = 17.5 -> ratio = 1.0
        const delta = GDS.computeDeltaRatio({ anionGap: 29.5, hco3: 6.5 });
        assert.equal(delta.ratio, 1.0);
        assert.equal(delta.category, 'pure');
    });

    await t.test('acidose mixte à TA élevé + hyperchlorémique (ratio < 0.8)', () => {
        // TA = 18, HCO3 = 10 -> delta TA = 6, delta HCO3 = 14 -> 6 / 14 = 0.43
        const delta = GDS.computeDeltaRatio({ anionGap: 18.0, hco3: 10.0 });
        assert.equal(delta.ratio, 0.43);
        assert.equal(delta.category, 'hyperchloremic');
    });

    await t.test('alcalose métabolique préexistante (ratio > 2.0)', () => {
        // TA = 26, HCO3 = 20 -> delta TA = 14, delta HCO3 = 4 -> 14 / 4 = 3.5
        const delta = GDS.computeDeltaRatio({ anionGap: 26.0, hco3: 20.0 });
        assert.equal(delta.ratio, 3.5);
        assert.equal(delta.category, 'alkalosis_associated');
    });
});

test('Simulateur Gaz du Sang — Indice de Horovitz (PaO2/FiO2)', async (t) => {
    await t.test('ventilation en air ambiant normale (PaO2 95, FiO2 21%)', () => {
        const pf = GDS.computeHorovitzRatio({ paO2: 95, fiO2: 21 });
        assert.ok(pf.ratio > 400);
        assert.equal(pf.severity, 'normal');
    });

    await t.test('SDRA léger (PaO2 61, FiO2 21% -> ratio ~290)', () => {
        const pf = GDS.computeHorovitzRatio({ paO2: 61, fiO2: 21 });
        assert.equal(pf.ratio, 290);
        assert.equal(pf.severity, 'mild');
    });

    await t.test('SDRA sévère (PaO2 55, FiO2 70% -> ratio ~79)', () => {
        const pf = GDS.computeHorovitzRatio({ paO2: 55, fiO2: 70 });
        assert.ok(pf.ratio <= 100);
        assert.equal(pf.severity, 'severe');
    });
});

test('Simulateur Gaz du Sang — Analyse Pas à Pas des Cas EDN', async (t) => {
    await t.test('cas 1 : Acidocétose diabétique', () => {
        const res = GDS.analyzeBloodGas({
            pH: 7.14, paCO2: 19, hco3: 6.5,
            paO2: 102, fiO2: 21, lactates: 1.4,
            na: 132, cl: 96, k: 5.4, albumin: 41
        });
        assert.equal(res.step1.status, 'acidemia');
        assert.equal(res.step2.disorder, 'acidose_metabolique');
        assert.equal(res.step3.status, 'adapted');
        assert.equal(res.step4.anionGap.isElevated, true);
        assert.equal(res.step4.deltaRatio.category, 'pure');
    });

    await t.test('cas 2 : Choc septique avec acidose lactique', () => {
        const res = GDS.analyzeBloodGas({
            pH: 7.21, paCO2: 27, hco3: 11.0,
            paO2: 61, fiO2: 21, lactates: 7.5,
            na: 138, cl: 101, k: 4.8, albumin: 28
        });
        assert.equal(res.step1.status, 'acidemia');
        assert.equal(res.step2.disorder, 'acidose_metabolique');
        assert.equal(res.step3.status, 'insufficient');
        assert.equal(res.step4.anionGap.corrected, 29);
        assert.equal(res.step5.horovitz.severity, 'mild');
    });

    await t.test('cas 4 : Intoxication aux salicylés (trouble mixte à pH normal)', () => {
        const res = GDS.analyzeBloodGas({
            pH: 7.42, paCO2: 18, hco3: 11.5,
            paO2: 108, fiO2: 21, lactates: 2.6,
            na: 141, cl: 104, k: 3.4, albumin: 40
        });
        assert.equal(res.step1.status, 'normal');
        assert.equal(res.step2.disorder, 'trouble_mixte_salicyle');
        assert.equal(res.step4.anionGap.isElevated, true);
    });

    await t.test('cas 5 : Alcalose métabolique sur vomissements', () => {
        const res = GDS.analyzeBloodGas({
            pH: 7.56, paCO2: 49, hco3: 42.5,
            paO2: 84, fiO2: 21, lactates: 1.1,
            na: 137, cl: 79, k: 2.7, albumin: 44
        });
        assert.equal(res.step1.status, 'alkalemia');
        assert.equal(res.step2.disorder, 'alcalose_metabolique');
        assert.equal(res.step3.status, 'adapted');
    });
});

test('Simulateur Gaz du Sang — Intégrité de la Base de Cas EDN (gds-cases.js)', async (t) => {
    const casesPath = path.resolve('data/gds-cases.js');
    const casesCode = fs.readFileSync(casesPath, 'utf-8');
    const cContext = { module: { exports: {} } };
    const cFn = new Function('module', 'exports', 'window', casesCode);
    cFn(cContext.module, cContext.module.exports, {});
    const { GDS_CASES } = cContext.module.exports;

    await t.test('contient au moins 7 cas cliniques complets et documentés', () => {
        assert.ok(Array.isArray(GDS_CASES));
        assert.ok(GDS_CASES.length >= 7, `Attendu >= 7 cas, trouvé: ${GDS_CASES.length}`);
    });

    await t.test('tous les cas ont des paramètres physiologiques valides et cohérents avec Henderson-Hasselbalch', () => {
        for (const c of GDS_CASES) {
            assert.ok(c.id, `Cas sans identifiant`);
            assert.ok(c.title, `Cas ${c.id} sans titre`);
            assert.ok(c.specialty, `Cas ${c.id} sans spécialité`);
            assert.ok(c.patient && c.patient.context, `Cas ${c.id} sans contexte clinique`);
            assert.ok(c.params, `Cas ${c.id} sans paramètres biologiques`);

            const p = c.params;
            assert.ok(p.pH >= 6.80 && p.pH <= 7.80, `Cas ${c.id} : pH hors bornes (${p.pH})`);
            assert.ok(p.paCO2 >= 10 && p.paCO2 <= 120, `Cas ${c.id} : PaCO2 hors bornes (${p.paCO2})`);
            assert.ok(p.hco3 >= 2 && p.hco3 <= 55, `Cas ${c.id} : HCO3 hors bornes (${p.hco3})`);
            assert.ok(p.na >= 110 && p.na <= 170, `Cas ${c.id} : Na hors bornes (${p.na})`);
            assert.ok(p.cl >= 65 && p.cl <= 135, `Cas ${c.id} : Cl hors bornes (${p.cl})`);
            assert.ok(p.k >= 1.5 && p.k <= 8.5, `Cas ${c.id} : K hors bornes (${p.k})`);

            // Vérification de la cohérence Henderson-Hasselbalch (écart pH attendu vs saisi < 0.08)
            const expectedPH = GDS.computeHendersonHasselbalch({ paCO2: p.paCO2, hco3: p.hco3, target: 'pH' });
            assert.ok(Math.abs(expectedPH - p.pH) <= 0.08, `Cas ${c.id} : pH incohérent avec HH (saisi ${p.pH}, calculé ${expectedPH})`);
        }
    });

    await t.test('tous les cas ont des questions de quiz structurées avec correction détaillée', () => {
        for (const c of GDS_CASES) {
            assert.ok(c.quiz && Array.isArray(c.quiz.steps), `Cas ${c.id} : quiz invalide`);
            assert.ok(c.quiz.steps.length >= 3, `Cas ${c.id} : pas assez de questions (${c.quiz.steps.length})`);
            assert.ok(c.quiz.diagnosis && c.quiz.diagnosis.length > 20, `Cas ${c.id} : diagnostic synthétique manquant`);

            for (const step of c.quiz.steps) {
                assert.ok(step.question && step.question.length > 5, `Question vide dans ${c.id}`);
                assert.ok(Array.isArray(step.options) && step.options.length >= 2, `Options manquantes dans ${c.id}`);
                assert.ok(step.correctIndex >= 0 && step.correctIndex < step.options.length, `Indice correct invalide dans ${c.id}`);
                assert.ok(step.explanation && step.explanation.length > 15, `Explication trop courte dans ${c.id}`);
            }
        }
    });
});

test('Simulateur Gaz du Sang — Générateur de Cas Physiologiques Aléatoires', async (t) => {
    await t.test('génère des cas aléatoires plausibles pour tous les sous-types', () => {
        const types = ['dka', 'septic_shock', 'copd_decomp', 'salicylate', 'pyloric_alkalosis', 'hyperventilation', 'diarrhea'];
        for (const type of types) {
            const c = GDS.generateRandomCase(type);
            assert.ok(c.pH >= 6.85 && c.pH <= 7.75, `${type} : pH invalide ${c.pH}`);
            assert.ok(c.paCO2 >= 12 && c.paCO2 <= 110, `${type} : PaCO2 invalide ${c.paCO2}`);
            assert.ok(c.hco3 >= 3 && c.hco3 <= 52, `${type} : HCO3 invalide ${c.hco3}`);
            assert.ok(c.name, `${type} : nom manquant`);

            // Henderson-Hasselbalch exact
            const calcPH = GDS.computeHendersonHasselbalch({ paCO2: c.paCO2, hco3: c.hco3, target: 'pH' });
            assert.ok(Math.abs(calcPH - c.pH) <= 0.05, `${type} : écart HH trop grand`);
        }
    });
});

