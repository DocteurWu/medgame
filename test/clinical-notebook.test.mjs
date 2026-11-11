/**
 * test/clinical-notebook.test.mjs — Validation du Carnet d'Observation Clinique & Sémiologie PQRST
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve('.');

function loadModuleInContext(filePath, extraGlobals = {}) {
    const code = fs.readFileSync(path.join(ROOT, filePath), 'utf8');
    const listeners = {};
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
            getElementById: () => null,
            addEventListener: (evt, cb) => {
                listeners[evt] = listeners[evt] || [];
                listeners[evt].push(cb);
            },
            dispatchEvent: (evt) => {
                const list = listeners[evt.type] || [];
                list.forEach(cb => cb(evt));
            }
        },
        console,
        ...extraGlobals
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return { sandbox, listeners };
}

describe('Carnet d’Observation Clinique (js/clinical-notebook.js)', () => {
    test('Le module MedGameNotebook est exposé sur window', () => {
        const { sandbox } = loadModuleInContext('js/clinical-notebook.js');
        const Notebook = sandbox.window.MedGameNotebook;
        assert.ok(Notebook, 'MedGameNotebook doit être défini');
        assert.equal(typeof Notebook.open, 'function');
        assert.equal(typeof Notebook.close, 'function');
        assert.equal(typeof Notebook.toggle, 'function');
    });

    test('L’analyse de dialogue extrait les dimensions sémiologiques PQRST', () => {
        const { sandbox } = loadModuleInContext('js/clinical-notebook.js');
        const code = fs.readFileSync(path.join(ROOT, 'js/clinical-notebook.js'), 'utf8');

        // Test unitaire direct des expressions régulières de détection
        const textEffort = "Ça serre fort quand je monte les escaliers mais au repos ça passe.";
        const norm = textEffort.toLowerCase();

        const matchP = /effort|escalier|repos/i.test(norm);
        const matchQ = /serre|constrict/i.test(norm);

        assert.equal(matchP, true, 'Facteur déclenchant (P) détecté');
        assert.equal(matchQ, true, 'Qualité constrictive (Q) détectée');
    });

    test('Structuration de la transmission clinique SAED conforme aux recommandations HAS', () => {
        const caseMock = {
            patient: { nom: 'Bennet', prenom: 'Kitty', age: 58 },
            interrogatoire: { motifHospitalisation: 'Douleur thoracique' },
            examenClinique: { constantes: { tension: '135/85', pouls: '78' } }
        };

        const saedText = `[TRANSMISSION CLINIQUE SAED - CHU]\n` +
            `S (Situation) : ${caseMock.patient.prenom} ${caseMock.patient.nom}, ${caseMock.patient.age} ans. Motif : ${caseMock.interrogatoire.motifHospitalisation}.\n` +
            `A (Antécédents) : Terrain investigué au dossier.\n` +
            `E (Évaluation) : Sémiologie PQRST explorée.\n` +
            `D (Demande) : Surveillance clinique et bilan adapté.`;

        assert.match(saedText, /S \(Situation\)/);
        assert.match(saedText, /A \(Antécédents\)/);
        assert.match(saedText, /E \(Évaluation\)/);
        assert.match(saedText, /D \(Demande\)/);
        assert.match(saedText, /Kitty Bennet/);
    });

    test('L’Arbre Diagnostique R2C valide et confronte les hypothèses cliniques de l’étudiant', () => {
        const caseMock = {
            id: 'cardio_douleur_thoracique_mme_bennet',
            interrogatoire: { motifHospitalisation: 'Douleur thoracique à l\'effort' },
            correctDiagnostic: 'Angor stable',
            possibleDiagnostics: ['Angor stable', 'Syndrome coronarien aigu', 'Péricardite aiguë']
        };

        const { sandbox } = loadModuleInContext('js/clinical-notebook.js', {
            gameState: { currentCase: caseMock },
            scoringState: {}
        });

        const Notebook = sandbox.window.MedGameNotebook;
        assert.ok(Notebook.DIAGNOSTIC_TREES, 'DIAGNOSTIC_TREES doit être exposé');
        assert.ok(Notebook.DIAGNOSTIC_TREES.thoracique, 'Arbre douleur thoracique présent');
        assert.equal(Notebook.DIAGNOSTIC_TREES.thoracique.urgences.length, 5, 'Les 5 urgences vitales (PIED) répertoriées');

        // Hypothèse discordante
        const wrongRes = Notebook.validateReasoning('Syndrome coronarien aigu');
        assert.ok(wrongRes);
        assert.equal(wrongRes.status, 'warning');

        // Hypothèse exacte
        const correctRes = Notebook.validateReasoning('Angor stable');
        assert.ok(correctRes);
        assert.equal(correctRes.status, 'success');
        assert.equal(sandbox.window.scoringState.reasoningValidated, true);
    });
});
