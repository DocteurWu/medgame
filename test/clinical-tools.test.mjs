/**
 * test/clinical-tools.test.mjs — Validation des Outils Cliniques & Biologie R2C
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve('.');

function loadModuleInContext(filePath, extraGlobals = {}) {
    const code = fs.readFileSync(path.join(ROOT, filePath), 'utf8');
    const sandbox = {
        window: { ...extraGlobals },
        document: {
            createElement: () => ({
                setAttribute: () => {},
                addEventListener: () => {},
                querySelector: () => null,
                querySelectorAll: () => [],
                classList: { add: () => {}, remove: () => {} }
            }),
            body: { appendChild: () => {} },
            querySelectorAll: () => [],
            addEventListener: () => {},
            getElementById: () => null
        },
        escapeHtml: (str) => String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
        console,
        ...extraGlobals
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox;
}

describe('Outils Cliniques — Normes Biologiques CHU (js/clinical-lab-norms.js)', () => {
    const ctx = loadModuleInContext('js/clinical-lab-norms.js');
    const LabNorms = ctx.window.MedGameLabNorms;

    test('Le module MedGameLabNorms est correctement exposé avec son dictionnaire de normes', () => {
        assert.ok(LabNorms, 'MedGameLabNorms doit être défini sur window');
        assert.ok(LabNorms.NORMS.potassium, 'Potassium présent dans les normes');
        assert.ok(LabNorms.NORMS.troponine, 'Troponine présente dans les normes');
        assert.ok(LabNorms.NORMS.ddimeres, 'D-Dimères présents dans les normes');
        assert.ok(LabNorms.NORMS.creatinine, 'Créatinine présente dans les normes');
        assert.ok(LabNorms.NORMS.crp, 'CRP présente dans les normes');
        assert.ok(LabNorms.NORMS.lactates, 'Lactates présents dans les normes');
    });

    test('Détection automatique et statut de criticité sur une hyperkaliémie menaçante', () => {
        const text = 'Ionogramme : Na+ 138 mmol/L, K+ 6.4 mmol/L, Cl- 101 mmol/L';
        const parsed = LabNorms.parseLabResults('Ionogramme sanguin', text);

        assert.equal(parsed.hasStructuredAnalytes, true);
        const k = parsed.analytes.find(a => a.key === 'potassium');
        assert.ok(k, 'Potassium extrait');
        assert.equal(k.value, 6.4);
        assert.equal(k.status, 'critical', 'K+ 6.4 doit être classé critique');
        assert.ok(parsed.alerts.length > 0, 'Une alerte sémiologique doit être émise');
        assert.match(parsed.alerts[0].msg, /ECG|troubles du rythme/i);
    });

    test('Détection automatique d’une élévation de troponine (SCA)', () => {
        const text = 'Bilan : Troponine I : 450 ng/L';
        const parsed = LabNorms.parseLabResults('Troponine', text);

        assert.equal(parsed.hasStructuredAnalytes, true);
        const tropo = parsed.analytes.find(a => a.key === 'troponine');
        assert.ok(tropo, 'Troponine extraite');
        assert.equal(tropo.value, 450);
        assert.equal(tropo.status, 'critical');
    });

    test('Rendu HTML de la feuille de laboratoire hospitalière', () => {
        const text = 'Créatininémie : 180 µmol/L, Urée : 12 mmol/L';
        const html = LabNorms.renderHospitalLabReport('Bilan Rénal', text, false);

        assert.match(html, /clinical-lab-card/);
        assert.match(html, /Service de Biologie Médicale/);
        assert.match(html, /Créatininémie/);
        assert.match(html, /Élevé|CRITIQUE/);
        assert.match(html, /180/);
    });
});

describe('Outils Cliniques — Calculateur de Scores Décisionnels (js/clinical-scores.js)', () => {
    const ctx = loadModuleInContext('js/clinical-scores.js');
    const Scores = ctx.window.MedGameScores;

    test('Les scores majeurs R2C sont configurés et enrichis', () => {
        assert.ok(Scores, 'MedGameScores doit être défini');
        assert.ok(Scores.SCORES.wells_ep, 'Score de Wells présent');
        assert.ok(Scores.SCORES.qsofa, 'Score qSOFA présent');
        assert.ok(Scores.SCORES.glasgow, 'Score de Glasgow présent');
        assert.ok(Scores.SCORES.cha2ds2_vasc, 'Score CHA2DS2-VASc présent');
        assert.ok(Scores.SCORES.crb65, 'Score CRB-65 présent');
        assert.ok(Scores.SCORES.has_bled, 'Score HAS-BLED présent');
        assert.ok(Scores.SCORES.ottawa_ankle, 'Règles d’Ottawa cheville/pied présentes');
    });

    test('Interprétation du Score CRB-65 (Pneumonie)', () => {
        const crb = Scores.SCORES.crb65;
        const ambulatoire = crb.interpret(0);
        assert.equal(ambulatoire.level, 'low');
        assert.match(ambulatoire.recommendation, /ambulatoire|domicile/i);

        const rea = crb.interpret(3);
        assert.equal(rea.level, 'high');
        assert.match(rea.recommendation, /soins intensifs|réanimation/i);
    });

    test('Interprétation des Règles d’Ottawa', () => {
        const ottawa = Scores.SCORES.ottawa_ankle;
        const sansRadio = ottawa.interpret(0);
        assert.equal(sansRadio.level, 'low');
        assert.match(sansRadio.recommendation, /PAS DE RADIOGRAPHIE/i);

        const avecRadio = ottawa.interpret(1);
        assert.equal(avecRadio.level, 'high');
        assert.match(avecRadio.recommendation, /INDICATION À LA RADIOGRAPHIE/i);
    });

    test('Interprétation du Score de Wells pour l’Embolie Pulmonaire', () => {
        const wells = Scores.SCORES.wells_ep;
        const faible = wells.interpret(1.0);
        assert.equal(faible.level, 'low');
        assert.match(faible.recommendation, /D-Dimères/i);

        const fort = wells.interpret(7.5);
        assert.equal(fort.level, 'high');
        assert.match(fort.recommendation, /PAS DE D-DIMÈRES/i);
        assert.match(fort.recommendation, /Angioscanner/i);
    });

    test('Interprétation du Score de Glasgow (IOT si <= 8)', () => {
        const gcs = Scores.SCORES.glasgow;
        const comaGrave = gcs.interpret(7);
        assert.equal(comaGrave.level, 'critical');
        assert.match(comaGrave.recommendation, /Intubation Oro-Trachéale|IOT/i);

        const normal = gcs.interpret(15);
        assert.equal(normal.level, 'normal');
    });

    test('Interprétation du Score qSOFA (Sepsis)', () => {
        const qsofa = Scores.SCORES.qsofa;
        const positif = qsofa.interpret(2);
        assert.equal(positif.level, 'high');
        assert.match(positif.recommendation, /SEPSIS GRAVE|antibiothérapie/i);
    });
});
