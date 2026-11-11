/**
 * test/clinical-lab-norms.test.mjs — Validation du Moteur de Normes Biologiques et Rendu CHU
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import '../js/clinical-lab-norms.js';

const MedGameLabNorms = globalThis.MedGameLabNorms;

describe('Normes Biologiques et Moteur de Compte-Rendu CHU (js/clinical-lab-norms.js)', () => {
    test('Le module MedGameLabNorms est exposé avec son dictionnaire de normes', () => {
        assert.ok(MedGameLabNorms, 'MedGameLabNorms doit être défini');
        assert.ok(MedGameLabNorms.NORMS, 'NORMS doit être défini');
        assert.ok(MedGameLabNorms.NORMS.potassium, 'Potassium doit être répertorié');
        assert.ok(MedGameLabNorms.NORMS.troponine, 'Troponine doit être répertoriée');
        assert.ok(MedGameLabNorms.NORMS.creatinine, 'Créatinine doit être répertoriée');
        assert.equal(typeof MedGameLabNorms.parseLabResults, 'function');
        assert.equal(typeof MedGameLabNorms.renderHospitalLabReport, 'function');
    });

    test('Détection et parsing de valeurs numériques avec unités et statut normal/critique', () => {
        const text = "Ionogramme sanguin : Potassium = 6.2 mmol/L, Sodium : 140 mmol/L, Créatinine : 85 µmol/L";
        const parsed = MedGameLabNorms.parseLabResults("Bilan métabolique", text);

        assert.equal(parsed.hasStructuredAnalytes, true);
        assert.equal(parsed.analytes.length, 3);

        const k = parsed.analytes.find(a => a.key === 'potassium');
        assert.ok(k);
        assert.equal(k.value, 6.2);
        assert.equal(k.status, 'critical', 'K+ à 6.2 mmol/L doit être classé critique (hyperkaliémie)');

        const na = parsed.analytes.find(a => a.key === 'sodium');
        assert.ok(na);
        assert.equal(na.value, 140);
        assert.equal(na.status, 'normal', 'Na+ à 140 mmol/L doit être normal');

        assert.ok(parsed.alerts.length >= 1, 'Une alerte sémiologique critique doit être générée pour l’hyperkaliémie');
    });

    test('Détection des formulations qualitatives médicales courantes (Troponine, D-dimères)', () => {
        const textNorm = "Bilan sanguin : Troponine normale, D-dimères normaux";
        const parsedNorm = MedGameLabNorms.parseLabResults("Biologie d'urgence", textNorm);

        assert.equal(parsedNorm.hasStructuredAnalytes, true);
        const tropo = parsedNorm.analytes.find(a => a.key === 'troponine');
        assert.ok(tropo);
        assert.equal(tropo.status, 'normal');

        const textHigh = "Biologie : Troponine très élevée à 120 ng/L, syndrome inflammatoire avec CRP 85 mg/L";
        const parsedHigh = MedGameLabNorms.parseLabResults("Biologie", textHigh);
        const tropoHigh = parsedHigh.analytes.find(a => a.key === 'troponine');
        assert.ok(tropoHigh);
        assert.equal(tropoHigh.status, 'critical');
    });

    test('Détection syndromique directe (Hyperkaliémie, Anémie, Thrombopénie)', () => {
        const textSyndrome = "NFS retrouvant une anémie franche et une thrombopénie modérée.";
        const parsed = MedGameLabNorms.parseLabResults("NFS", textSyndrome);

        assert.equal(parsed.hasStructuredAnalytes, true);
        const hb = parsed.analytes.find(a => a.key === 'hemoglobine');
        const plaq = parsed.analytes.find(a => a.key === 'plaquettes');
        assert.ok(hb, 'Anémie doit être liée à l’hémoglobine');
        assert.ok(plaq, 'Thrombopénie doit être liée aux plaquettes');
        assert.equal(hb.status, 'low');
    });

    test('Génération de compte-rendu hospitalier CHU formaté (HTML)', () => {
        const html = MedGameLabNorms.renderHospitalLabReport("Ionogramme", "K+ : 5.8 mmol/L, Na+ : 138 mmol/L", false);
        assert.match(html, /CHU • Service de Biologie Médicale/);
        assert.match(html, /lab-report-table/);
        assert.match(html, /col-analyte/);
        assert.match(html, /lab-val-badge/);
    });
});
