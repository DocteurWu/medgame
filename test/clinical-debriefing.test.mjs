/**
 * test/clinical-debriefing.test.mjs — Validation du Débriefing Universitaire ECOS & Flashcards
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

describe('Débriefing ECOS & Flashcards Anki (js/clinical-debriefing.js)', () => {
    const ctx = loadModuleInContext('js/clinical-debriefing.js');
    const Debriefing = ctx.window.ClinicalDebriefing;

    const mockCase = {
        id: 'cardio_douleur_thoracique_mme_bennet',
        correctDiagnostic: 'Angor stable',
        interrogatoire: {
            motifHospitalisation: 'Douleur thoracique à l\'effort',
            histoireMaladie: {
                facteursDeclenchants: 'Montée d\'escaliers',
                descriptionDouleur: 'Constriction rétrosternale calmée par le repos'
            }
        },
        relevantExams: ['ECG', 'Test d\'effort', 'Angiographie coronarienne'],
        correctTreatments: ['Bêta-bloquant', 'Trinitrine sublinguale'],
        fatalTreatments: ['Adrénaline']
    };

    test('Le module ClinicalDebriefing est correctement exposé', () => {
        assert.ok(Debriefing, 'ClinicalDebriefing doit être défini');
        assert.equal(typeof Debriefing.generateFlashcardsForCase, 'function');
        assert.equal(typeof Debriefing.computeCompetencyProfile, 'function');
        assert.equal(typeof Debriefing.renderDebriefingHTML, 'function');
    });

    test('Génération des flashcards ciblées pour la révision Anki', () => {
        const cards = Debriefing.generateFlashcardsForCase(mockCase);
        assert.ok(Array.isArray(cards), 'Doit renvoyer une liste de cartes');
        assert.ok(cards.length >= 3, 'Au moins 3 cartes pour le cas');

        const cardDiag = cards.find(c => c.id === 'card_diag');
        assert.ok(cardDiag, 'Carte diagnostique présente');
        assert.match(cardDiag.back, /Angor stable/);

        const cardTreat = cards.find(c => c.id === 'card_treatment');
        assert.ok(cardTreat, 'Carte traitement présente');
        assert.match(cardTreat.back, /Bêta-bloquant/);
        assert.match(cardTreat.back, /Adrénaline/);
    });

    test('Calcul du profil de compétences sur 5 piliers ECOS', () => {
        const profile = Debriefing.computeCompetencyProfile(mockCase);
        assert.ok('anamnese' in profile);
        assert.ok('examen' in profile);
        assert.ok('paraclinique' in profile);
        assert.ok('therapeutique' in profile);
        assert.ok('communication' in profile);
    });

    test('Rendu HTML du débriefing avec bilan et lecteur Anki', () => {
        const html = Debriefing.renderDebriefingHTML(mockCase);
        assert.match(html, /clinical-debriefing-container/);
        assert.match(html, /Bilan par domaine de compétence/);
        assert.match(html, /Flashcards de Révision Espacée/);
        assert.match(html, /Exporter pour Anki/);
    });

    test('Avec l’année d’étude, le bilan affiche les attendus de cette année', () => {
        const sl = loadModuleInContext('js/study-level.js');
        const StudyLevel = sl.StudyLevel;
        assert.ok(StudyLevel, 'js/study-level.js publie StudyLevel');
        const withLevel = (id) => loadModuleInContext('js/clinical-debriefing.js', {
            StudyLevel: { ...StudyLevel, currentId: () => id }
        }).window.ClinicalDebriefing.renderDebriefingHTML(mockCase);

        const p2 = withLevel('DFGSM2');
        assert.match(p2, /Attendus de 2e année · DFGSM2/);
        assert.match(p2, /Bilan de l'année : \d+ %/);
        assert.match(p2, /non exigé cette année/, 'la thérapeutique est en découverte en 2e année');
        assert.match(p2, /La note du cas ne dépend pas de l'année/);

        const d4 = withLevel('DFASM3');
        assert.match(d4, /Attendus de 6e année · DFASM3/);
        assert.doesNotMatch(d4, /non exigé cette année/);
        assert.match(d4, /attendu 75 %/);
    });

    test('Sans action de l’étudiant, aucun domaine n’est crédité par défaut', () => {
        const profile = Debriefing.computeCompetencyProfile(mockCase);
        assert.equal(profile.anamnese, 0);
        assert.equal(profile.examen, 0);
        assert.equal(profile.paraclinique, 0);
    });
});
