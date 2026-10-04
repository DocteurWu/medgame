import test from 'node:test';
import assert from 'node:assert/strict';
import {
    calculateFlowRate,
    calculateDeliveredDose,
    validatePseSafety,
    DRUG_DATABASE,
    PSE_CLINICAL_CASES
} from '../js/pse-engine.js';

test('PSE Engine — Calcul de débit Noradrénaline', () => {
    // Patiente 60 kg, dose 0.3 µg/kg/min, dilution standard 8 mg / 50 mL = 0.16 mg/mL
    const flow = calculateFlowRate('noradrenaline', 0.3, 60, 0.16);
    // 0.3 * 60 * 60 = 1080 µg/h. Conc = 160 µg/mL. Débit = 1080 / 160 = 6.75 mL/h
    assert.equal(flow, 6.75);

    // Calcul inverse : 6.75 mL/h doit redonner 0.3 µg/kg/min
    const dose = calculateDeliveredDose('noradrenaline', 6.75, 60, 0.16);
    assert.equal(dose, 0.3);
});

test('PSE Engine — Calcul de débit Insuline rapide', () => {
    // Patient 70 kg, dose 0.1 UI/kg/h, concentration 1 UI/mL (50 UI / 50 mL)
    const flow = calculateFlowRate('insuline', 0.1, 70, 1.0);
    assert.equal(flow, 7.0);

    const dose = calculateDeliveredDose('insuline', 7.0, 70, 1.0);
    assert.equal(dose, 0.1);
});

test('PSE Engine — Règles de sécurité absolues pour le Chlorure de Potassium (KCl)', () => {
    // Cas 1 : Débit KCl > 1 g/h sur VVP doit être bloqué avec alarme
    const safetyCheckOverdose = validatePseSafety('kcl', 500, 4.0, 70, 'VVP'); // 500 mL/h à 4 g/L = 2 g/h
    assert.equal(safetyCheckOverdose.valid, false);
    assert.ok(safetyCheckOverdose.errors.some(e => e.includes('DANGER') || e.includes('1 g/h')));

    // Cas 2 : Débit conforme 1 g/h sur VVP (250 mL/h à 4 g/L)
    const safetyCheckOk = validatePseSafety('kcl', 250, 4.0, 70, 'VVP');
    assert.equal(safetyCheckOk.valid, true);
    assert.equal(safetyCheckOk.errors.length, 0);
});

test('PSE Engine — Cas cliniques EDN/ECOS', () => {
    assert.ok(PSE_CLINICAL_CASES.length >= 3);
    PSE_CLINICAL_CASES.forEach(c => {
        assert.ok(c.id);
        assert.ok(c.title);
        assert.ok(c.expectedFlowRange);
        assert.ok(c.expectedFlowRange[0] <= c.expectedFlowRange[1]);
    });
});
