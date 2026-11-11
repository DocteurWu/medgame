/**
 * test/clinical-ecg.test.mjs — Validation du Studio ECG 12 Dérivations
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
                querySelectorAll: () => []
            })
        },
        console,
        ...extraGlobals
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox;
}

describe('Studio ECG 12 Dérivations (js/clinical-ecg-viewer.js)', () => {
    const ctx = loadModuleInContext('js/clinical-ecg-viewer.js');
    const ECG = ctx.window.ClinicalECGViewer;

    test('Le module ClinicalECGViewer est correctement exposé', () => {
        assert.ok(ECG, 'ClinicalECGViewer doit être défini sur window');
        assert.equal(typeof ECG.parseECGInterpretation, 'function');
        assert.equal(typeof ECG.renderECGCard, 'function');
    });

    test('Détection sémiologique d’un sous-décalage ST ischémique en V5-V6', () => {
        const text = "Angor déclenché à l'effort modéré, sous-décalage ST V5-V6";
        const parsed = ECG.parseECGInterpretation('Test d\'effort ECG', text);

        assert.equal(parsed.isECG, true);
        assert.equal(parsed.hasSTDepression, true);
        assert.ok(parsed.leadsSTDepressed.includes('V5'));
        assert.ok(parsed.leadsSTDepressed.includes('V6'));
        assert.equal(parsed.hasSTElevation, false);
    });

    test('Détection sémiologique d’un sus-décalage ST (SCA ST+ / Pardee)', () => {
        const text = "Sus-décalage du segment ST en V1-V4 (onde de Pardee)";
        const parsed = ECG.parseECGInterpretation('ECG 12 dérivations', text);

        assert.equal(parsed.isECG, true);
        assert.equal(parsed.hasSTElevation, true);
        assert.ok(parsed.leadsSTElevated.includes('V2'));
    });

    test('Détection d’une fibrillation atriale (FA)', () => {
        const text = "Rythme de fibrillation atriale rapide, pas d'ondes P, réponse ventriculaire à 130 bpm";
        const parsed = ECG.parseECGInterpretation('ECG', text);

        assert.equal(parsed.isECG, true);
        assert.equal(parsed.hasAFib, true);
    });

    test('Rendu HTML complet de la carte ECG avec grille 12 dérivations', () => {
        const caseData = {
            examenClinique: {
                constantes: { pouls: '92 bpm' }
            }
        };
        const html = ECG.renderECGCard('ECG', "Sous-décalage ST en V5-V6", caseData);

        assert.ok(html, 'Le HTML de l\'ECG doit être généré');
        assert.match(html, /clinical-ecg-card/);
        assert.match(html, /ecg-millimeter-grid/);
        assert.match(html, /V5/);
        assert.match(html, /V6/);
        assert.match(html, /DII Long/);
        assert.match(html, /Méthode d'interprétation méthodique R2C/);
    });
});
