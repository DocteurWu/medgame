/**
 * test/scoring.test.mjs — Source unique du scoring (engine/scoring.js)
 *
 * Ce module verrouille trois choses :
 *   1. la regle /100 historique a une SEULE implementation, partagee entre
 *      l'engine MCP et le reste du projet ;
 *   2. les conversions /20 <-> /100 sont exactes, bornees et inverses l'une
 *      de l'autre ;
 *   3. l'engine renvoie `scoreOn20` coherent avec `score` (le contrat MCP
 *      conserve `score` sur /100 : `ai-watch.html` en depend).
 *
 * Rappel d'architecture : le navigateur n'a qu'UN noteur, Jev (TypeSafe).
 * `js/scoring.js` ne doit pas revenir (cf. test/anticheat.test.mjs). Le
 * module teste ici est `engine/scoring.js` : regle /100 de l'engine et
 * conversions, sans notation cote navigateur.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

import {
    computeClassicScore,
    toScore20,
    toScore100,
    normalizeText,
    fuzzyMatchExam,
    DIAGNOSTIC_TYPO_SIMILARITY,
    CLASSIC_WEIGHTS
} from '../engine/scoring.js';

describe('Scoring — source unique (engine/scoring.js)', () => {

    test('le bareme /100 est bien 35 + 25 + 25 + 15 = 100', () => {
        assert.equal(CLASSIC_WEIGHTS.diagnostic, 35);
        assert.equal(CLASSIC_WEIGHTS.exam, 25);
        assert.equal(CLASSIC_WEIGHTS.treatment, 25);
        assert.equal(CLASSIC_WEIGHTS.communication, 15);
        assert.equal(
            CLASSIC_WEIGHTS.diagnostic + CLASSIC_WEIGHTS.exam
            + CLASSIC_WEIGHTS.treatment + CLASSIC_WEIGHTS.communication,
            100
        );
    });

    test('la regle UTILISE les poids (les modifier change le score)', () => {
        // Sans ce test, CLASSIC_WEIGHTS n'est qu'une constante decorative : la
        // regle pourrait garder des litteraux et la "source unique" serait
        // une demi-verite. On modifie donc reellement le bareme, on verifie
        // que le score suit, puis on restaure.
        const saved = { ...CLASSIC_WEIGHTS };
        try {
            const base = {
                caseData: { correctDiagnostic: 'Embolie pulmonaire' },
                selectedDiagnostic: 'Embolie pulmonaire',
                activeExams: [],
                selectedTreatments: [],
                anamnesisCount: 0,
                trust: 0,
                hasGestures: false
            };
            const avant = computeClassicScore(base).score;

            CLASSIC_WEIGHTS.diagnostic = 50;
            const apres = computeClassicScore(base).score;

            assert.equal(apres - avant, 15, 'passer le diagnostic de 35 a 50 doit ajouter 15 points');
        } finally {
            Object.assign(CLASSIC_WEIGHTS, saved);
        }
        assert.equal(CLASSIC_WEIGHTS.diagnostic, 35, 'le bareme doit etre restaure');
    });

    test('un diagnostic alternatif vaut la moitie des points du diagnostic', () => {
        const caseData = {
            correctDiagnostic: 'Embolie pulmonaire',
            alternativeDiagnostics: ['Fracture pulmonaire']
        };
        const res = computeClassicScore({
            caseData,
            selectedDiagnostic: 'Fracture pulmonaire',
            activeExams: [],
            selectedTreatments: [],
            anamnesisCount: 0,
            trust: 0,
            hasGestures: false
        });
        assert.equal(res.diagnosticScore, 18, '35 / 2 arrondi = 18');
    });

    test('aucun ancien moteur de note cote navigateur', () => {
        assert.equal(fs.existsSync(path.join(ROOT, 'js/scoring.js')), false,
            'js/scoring.js ne doit pas revenir : le navigateur note uniquement via Jev');
        assert.equal(fs.existsSync(path.join(ROOT, 'js/feedback.js')), false,
            'js/feedback.js ne doit pas revenir');
    });

    test('conversions /20 <-> /100 : exactes, bornees, inverses', () => {
        assert.equal(toScore20(100), 20);
        assert.equal(toScore20(50), 10);
        assert.equal(toScore20(0), 0);
        assert.equal(toScore20(75), 15);

        assert.equal(toScore100(20), 100);
        assert.equal(toScore100(10), 50);
        assert.equal(toScore100(12.4), 62);
        assert.equal(toScore100(0), 0);

        // Bornes : jamais hors echelle.
        assert.equal(toScore20(140), 20);
        assert.equal(toScore20(-10), 0);
        assert.equal(toScore100(25), 100);
        assert.equal(toScore100(-4), 0);

        // Valeur non numerique : 0, pas NaN.
        assert.equal(toScore20('abc'), 0);
        assert.equal(toScore100(undefined), 0);
    });

    test('conversion aller-retour stable sur la grille ECOS', () => {
        for (let s = 0; s <= 20; s += 0.5) {
            assert.equal(toScore20(toScore100(s)), Math.round(s * 5) / 5,
                `aller-retour instable pour ${s}/20`);
        }
    });

    test('l\'arrondi est fixe : s*5, et non (s/20)*100', () => {
        // L'ancienne formule en ligne du navigateur etait
        // Math.round((score20 / 20) * 100). Sur 11 valeurs de la grille
        // (0,7 / 2,9 / 3,3 / 8,7 / 9,1 / 10,7 / 11,1 / 11,5 / 15,7 / 17,9 /
        // 19,9) elle differe de s*5 d'UN POINT, parce que (s/20)*100 n'est
        // pas exactement s*5 en virgule flottante.
        //
        // On garde s*5 : c'est la conversion exacte (19,9/20 vaut bien
        // 100/100, pas 99/100), et la decision est desormais explicite et
        // testee au lieu d'etre une derive silencieuse de l'XP.
        const divergentes = [0.7, 2.9, 3.3, 8.7, 9.1, 10.7, 11.1, 11.5, 15.7, 17.9, 19.9];
        for (const s of divergentes) {
            assert.equal(toScore100(s), Math.round(s * 5),
                `toScore100(${s}) doit valoir la conversion exacte`);
            assert.notEqual(Math.round((s / 20) * 100), Math.round(s * 5),
                `${s} est volontairement un cas ou les deux formules diffèrent`);
        }
        // Et l'extremite haute est correcte.
        assert.equal(toScore100(19.9), 100);
        assert.equal(toScore100(20), 100);
    });

    test('computeClassicScore : diagnostic exact = 35, errone = 0', () => {
        const caseData = { correctDiagnostic: 'Fracture du col du femur', correctTreatments: [] };

        const good = computeClassicScore({
            caseData,
            selectedDiagnostic: 'Fracture du col du femur',
            activeExams: [],
            selectedTreatments: [],
            anamnesisCount: 0,
            trust: 0,
            hasGestures: false
        });
        assert.equal(good.diagnosticScore, 35);
        // Regle historique : ne rien prescrire ne coute RIEN en examens (25/25)
        // ni en traitement (25/25). Seul le relationnel est a 0.
        assert.equal(good.examScore, 25);
        assert.equal(good.treatmentScore, 25);
        assert.equal(good.communicationScore, 0);
        assert.equal(good.score, 85, '35 (diagnostic) + 25 (examens) + 25 (traitement) + 0 (relationnel)');

        const bad = computeClassicScore({
            caseData,
            selectedDiagnostic: 'Pneumopathie communautaire',
            activeExams: [],
            selectedTreatments: [],
            anamnesisCount: 0,
            trust: 0,
            hasGestures: false
        });
        assert.equal(bad.diagnosticScore, 0);
        assert.equal(bad.score, 50, '0 (diagnostic) + 25 (examens) + 25 (traitement) + 0 (relationnel)');
    });

    test('computeClassicScore : diagnostic approximatif tolere au-dessus du seuil', () => {
        const caseData = { correctDiagnostic: 'Fracture du col du femur' };
        // Une faute de frappe legere doit rester notee comme correcte.
        const typo = computeClassicScore({
            caseData,
            selectedDiagnostic: 'Fracture du col du femur ',
            activeExams: [],
            selectedTreatments: [],
            anamnesisCount: 0,
            trust: 0,
            hasGestures: false
        });
        assert.equal(typo.diagnosticScore, 35);
        assert.ok(DIAGNOSTIC_TYPO_SIMILARITY > 0 && DIAGNOSTIC_TYPO_SIMILARITY <= 1);
    });

    test('computeClassicScore : la somme des composantes vaut le total', () => {
        const res = computeClassicScore({
            caseData: {
                correctDiagnostic: 'Embolie pulmonaire',
                correctTreatments: ['Héparine', 'Anticoagulation'],
                relevantExams: ['ECG', 'Gaz du sang']
            },
            selectedDiagnostic: 'Embolie pulmonaire',
            activeExams: ['ECG'],
            selectedTreatments: ['Héparine'],
            anamnesisCount: 4,
            trust: 70,
            hasGestures: true
        });
        assert.equal(
            res.score,
            res.diagnosticScore + res.examScore + res.treatmentScore + res.communicationScore
        );
        assert.ok(res.score > 0 && res.score <= 100);
    });

    test('computeClassicScore : examen inutile penalise, examen dangereux penalise davantage', () => {
        const caseData = {
            correctDiagnostic: 'X',
            examGradation: { parfaits: ['ECG'], inutiles: ['Radiographie thorax'], dangereux: ['Ponction lombaire'] }
        };
        const base = { caseData, selectedDiagnostic: 'X', selectedTreatments: [], anamnesisCount: 0, trust: 0, hasGestures: false };

        const clean = computeClassicScore({ ...base, activeExams: ['ECG'] });
        const withUseless = computeClassicScore({ ...base, activeExams: ['ECG', 'Radiographie thorax'] });
        const withDangerous = computeClassicScore({ ...base, activeExams: ['ECG', 'Ponction lombaire'] });

        assert.ok(clean.examScore > withUseless.examScore, 'un examen inutile doit penaliser');
        assert.ok(withUseless.examScore > withDangerous.examScore, 'un examen dangereux doit penaliser plus');
    });

    test('normalizeText : insensibilite aux accents, casse et ponctuation', () => {
        assert.equal(normalizeText('Fracture du Col du Fémur !'), 'fracture du col du femur');
        assert.equal(normalizeText('  ECG   12  derivation '), 'ecg 12 derivation');
        assert.equal(normalizeText(null), '');
    });

    test('fuzzyMatchExam : variantes de libelles reconnues', () => {
        // Ordre : (libelle du menu, libelle attendu par le cas).
        assert.equal(fuzzyMatchExam('Echographie doppler des membres inférieurs', 'Écho-Doppler veineux'), true);
        assert.equal(fuzzyMatchExam('Radio thorax', 'Radiographie thorax'), true);
        assert.equal(fuzzyMatchExam('ECG', 'Electrocardiogramme (ECG)'), true);
        // Deux examens sans rapport ne doivent JAMAIS etre assimiles.
        assert.equal(fuzzyMatchExam('Radiographie thorax', 'Bilan sanguin'), false);
        // Un sigle seul ne suffit pas : "ECG" n'est pas dans "Electrocardiogramme".
        assert.equal(fuzzyMatchExam('ECG', 'Electrocardiogramme'), false);
    });

    test('fuzzyMatchExam : ne leve pas quand un libelle est vide', () => {
        assert.equal(fuzzyMatchExam('', 'ECG'), false);
        assert.equal(fuzzyMatchExam('ECG', undefined), false);
    });

    test('le navigateur utilise la MEME conversion que l\'engine', async () => {
        const jev = await import('../js/jevClient.js');
        assert.equal(jev.toScore100, toScore100, 'jevClient doit re-exporter la conversion, pas la reimplementer');
        assert.equal(jev.toScore20, toScore20);
    });

    test('l\'engine renvoie scoreOn20 coherent avec score', async () => {
        const { MedGameEngine } = await import('../engine/MedGameEngine.js');
        const engine = new MedGameEngine();
        await engine.startCase('CARDIO_thrombose_veineuse_profonde_droite.json');
        engine.selectDiagnostic('Thrombose veineuse profonde droite');
        const res = engine.submit();

        assert.equal(typeof res.score, 'number');
        assert.equal(typeof res.scoreOn20, 'number');
        assert.equal(res.scoreOn20, toScore20(res.score), 'scoreOn20 doit venir de la conversion partagee');
        assert.ok(res.scoreOn20 >= 0 && res.scoreOn20 <= 20);
    });
});
