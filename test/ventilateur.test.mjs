import test from 'node:test';
import assert from 'node:assert/strict';
import {
    calculateVentMechanics,
    sampleVentilatorWaveforms,
    VENT_PRESETS,
    VENT_MODES
} from '../js/ventilateur-engine.js';

test('Simulateur de Ventilateur — Poumon sain', () => {
    const settings = { vt: 450, fr: 15, peep: 5, fio2: 40, ieRatio: 0.5, pauseInsp: 0.2 };
    const patient = VENT_PRESETS.NORMAL;
    const mechanics = calculateVentMechanics(settings, patient);

    assert.equal(mechanics.mode, VENT_MODES.VAC);
    assert.equal(mechanics.peep, 5);
    assert.equal(mechanics.fr, 15);
    // Cycle duration = 60 / 15 = 4.0s
    assert.equal(mechanics.cycleDuration, 4.0);
    // Pplat = 450 / 60 + 5 = 7.5 + 5 = 12.5 cmH2O
    assert.ok(Math.abs(mechanics.pPlat - 12.5) < 0.5, `Pplat attendu ~12.5, obtenu ${mechanics.pPlat}`);
    // Ppeak > Pplat
    assert.ok(mechanics.pPeak > mechanics.pPlat);
    // Driving pressure = Pplat - PEEP = 7.5
    assert.ok(Math.abs(mechanics.drivingPressure - 7.5) < 0.5);
    // Pas d'alerte critique sur poumon sain
    assert.equal(mechanics.alerts.length, 0);
});

test('Simulateur de Ventilateur — SDRA (compliance effondrée)', () => {
    const settings = { vt: 500, fr: 20, peep: 12, fio2: 80, ieRatio: 0.5 };
    const patient = VENT_PRESETS.ARDS; // Compliance = 20 mL/cmH2O
    const mechanics = calculateVentMechanics(settings, patient);

    // Pplat = 500 / 20 + 12 = 25 + 12 = 37 cmH2O (toxique > 30)
    assert.ok(mechanics.pPlat > 30, 'Pplat doit dépasser 30 cmH2O dans le SDRA avec Vt 500');
    // Driving pressure = 37 - 12 = 25 cmH2O (excessive > 14)
    assert.ok(mechanics.drivingPressure > 14);
    // Doit générer des alertes de surpression
    assert.ok(mechanics.alerts.some(a => a.type === 'danger' || a.type === 'warning'));
});

test('Simulateur de Ventilateur — Asthme aigu grave (résistance élevée et auto-PEP)', () => {
    // Fréquence rapide (26/min) + résistance très haute -> auto-PEP
    const settings = { vt: 450, fr: 26, peep: 5, fio2: 50, ieRatio: 0.5 };
    const patient = VENT_PRESETS.ASTHMA;
    const mechanics = calculateVentMechanics(settings, patient);

    // Écart majeur entre Pcrête et Pplateau en raison de la résistance bronchique
    const deltaResistif = mechanics.pPeak - mechanics.pPlat;
    assert.ok(deltaResistif > 15, `Delta résistif attendu > 15 cmH2O, obtenu ${deltaResistif}`);
    // Auto-PEP présente
    assert.ok(mechanics.autoPeep > 1, `Auto-PEP attendue > 1 cmH2O, obtenue ${mechanics.autoPeep}`);
    assert.ok(mechanics.alerts.some(a => a.msg.includes('Auto-PEP') || a.msg.includes('crête')));
});

test('Simulateur de Ventilateur — Échantillonnage des formes d\'ondes', () => {
    const settings = { vt: 400, fr: 15, peep: 5 };
    const patient = VENT_PRESETS.NORMAL;
    const mechanics = calculateVentMechanics(settings, patient);

    // Échantillonner au début de l'inspiration (t = 0.1s)
    const inspSample = sampleVentilatorWaveforms(0.1, mechanics);
    assert.ok(inspSample.flow > 0, 'Débit doit être positif en inspiration');
    assert.ok(inspSample.pressure >= mechanics.peep, 'Pression doit être supérieure ou égale à la PEEP');

    // Échantillonner en expiration (t = 2.5s)
    const expSample = sampleVentilatorWaveforms(2.5, mechanics);
    assert.ok(expSample.flow <= 0, 'Débit doit être négatif en expiration passive');
    assert.ok(expSample.pressure >= mechanics.peep, 'Pression ne doit pas chuter sous la PEEP');
});
