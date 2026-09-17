import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
    ECOS_SECTION_WEIGHTS,
    PASSING_SCORE_ON_20,
    ROUTING_CONFIDENCE_THRESHOLD,
    REDHIBITORY_THRESHOLD,
    buildUnifiedTranscript,
    buildScoringQuestions,
    computeFinalScores,
    routeMessage,
    evaluateStation
} from '../js/jevClient.js';

test('1. Transcription : journal unifie avec horodatage MM:SS et origine', () => {
    const gameState = {
        chatHistory: [
            { sender: 'user', text: 'Ou avez-vous mal ?', timestamp: 12000 },
            { sender: 'patient', text: 'Dans la poitrine', timestamp: 15000 }
        ],
        interfaceActions: [
            { type: 'exam', label: 'ECG 12 derivations', timestamp: 35000 },
            { type: 'prescription', label: 'Trinitrine sublinguale', timestamp: 65000 }
        ]
    };

    const transcript = buildUnifiedTranscript(gameState);
    const lines = transcript.trim().split('\n');

    assert.equal(lines.length, 4);
    assert.equal(lines[0], '[00:12] ETUDIANT (chat) : Ou avez-vous mal ?');
    assert.equal(lines[1], '[00:15] PATIENT (chat) : Dans la poitrine');
    assert.equal(lines[2], '[00:35] ETUDIANT (interface) : Examen realise - ECG 12 derivations');
    assert.equal(lines[3], '[01:05] ETUDIANT (interface) : Traitement prescrit - Trinitrine sublinguale');
});

test('2. Routage multi-destination : vers_patient et acte_imagerie actives simultanement', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
            decisions: [
                { id: 'dest_patient', type: 'noul', probability: 0.95 },
                { id: 'dest_radiologue', type: 'noul', probability: 0.91 },
                { id: 'dest_biologiste', type: 'noul', probability: 0.05 },
                { id: 'dest_reanimateur', type: 'noul', probability: 0.02 },
                { id: 'dest_infirmier', type: 'noul', probability: 0.10 },
                { id: 'dest_medecin', type: 'noul', probability: 0.15 },
                { id: 'acte_type', type: 'choice', value: 'acte_imagerie' }
            ]
        })
    });

    try {
        const route = await routeMessage('Bonjour Monsieur, je vais vous prescrire une radiographie du thorax');
        assert.equal(route.toPatient, true, 'Doit router vers le patient pour reponse verbatim');
        assert.ok(route.clinicalActions.includes('acte_imagerie'), 'Doit declencher le pipeline acte_imagerie');
        assert.equal(route.fallback, false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('3. Routage patient seul : question d interrogatoire simple', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
            decisions: [
                { id: 'dest_patient', type: 'noul', probability: 0.94 },
                { id: 'dest_radiologue', type: 'noul', probability: 0.05 },
                { id: 'dest_biologiste', type: 'noul', probability: 0.02 },
                { id: 'dest_reanimateur', type: 'noul', probability: 0.01 },
                { id: 'dest_infirmier', type: 'noul', probability: 0.05 },
                { id: 'dest_medecin', type: 'noul', probability: 0.10 },
                { id: 'acte_type', type: 'choice', value: 'aucun' }
            ]
        })
    });

    try {
        const route = await routeMessage('Faites-vous du sport dans la semaine ?');
        assert.equal(route.toPatient, true);
        assert.equal(route.clinicalActions.length, 0, 'Aucune action clinique ne doit etre declenchee');
        assert.equal(route.fallback, false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('4. Routage action medicamenteuse : prescription par chat', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
            decisions: [
                { id: 'dest_patient', type: 'noul', probability: 0.20 },
                { id: 'dest_radiologue', type: 'noul', probability: 0.02 },
                { id: 'dest_biologiste', type: 'noul', probability: 0.01 },
                { id: 'dest_reanimateur', type: 'noul', probability: 0.15 },
                { id: 'dest_infirmier', type: 'noul', probability: 0.88 },
                { id: 'dest_medecin', type: 'noul', probability: 0.05 },
                { id: 'acte_type', type: 'choice', value: 'acte_medicament' }
            ]
        })
    });

    try {
        const route = await routeMessage('Je mets le patient sous oxygene 3 litres');
        assert.ok(route.clinicalActions.includes('acte_medicament'), 'Doit activer acte_medicament');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('5. Couverture de la grille : nombre exact d items et erreurs pour un cas reel', () => {
    const casePath = path.resolve('data/cardio_douleur_thoracique_mme_bennet.json');
    const caseData = JSON.parse(fs.readFileSync(casePath, 'utf8'));

    const ecos = caseData.ecos || {};
    const aptitudesCount = (ecos.grilleAptitudesCliniques || ecos.consignesEvaluateur?.grille || []).length;
    const commCount = (ecos.grilleCommunication || [1, 2, 3, 4, 5]).length;
    const perfCount = (ecos.grillePerformance || [1, 2, 3]).length;
    const redhibCount = (ecos.consignesEvaluateur?.erreursRedhibitoires || []).length;

    const totalExpected = aptitudesCount + commCount + perfCount + redhibCount;

    const questions = buildScoringQuestions(caseData);
    assert.equal(questions.length, totalExpected, 'Le nombre de questions doit egaler items des 3 sections + erreurs redhibitoires');
    assert.equal(questions.length, 24);
});

test('6. Format des questions : type choice pour items, noul pour redhibitoires, sans criteria vide', () => {
    const casePath = path.resolve('data/cardio_douleur_thoracique_mme_bennet.json');
    const caseData = JSON.parse(fs.readFileSync(casePath, 'utf8'));

    const questions = buildScoringQuestions(caseData);
    assert.ok(questions.length > 0);

    questions.forEach(q => {
        assert.ok(q.id, 'Chaque question doit posseder un identifiant');
        assert.ok(q.criteria, 'criteria ne doit pas etre vide');

        if (typeof q.criteria === 'string') {
            assert.ok(q.criteria.trim().length > 0, 'criteria string ne doit pas etre vide');
        } else if (typeof q.criteria === 'object') {
            assert.ok(Object.keys(q.criteria).length > 0, 'criteria objet doit contenir des cles');
            Object.values(q.criteria).forEach(val => {
                assert.ok(typeof val === 'string' && val.trim().length > 0, 'critere ne doit pas etre vide');
            });
        }

        if (q.id.startsWith('redhib_') || q.isRedhibitoire) {
            assert.equal(q.type, 'noul', 'Les erreurs redhibitoires doivent etre de type noul');
        } else {
            assert.equal(q.type, 'choice', 'Les items de grille doivent etre de type choice');
            assert.deepEqual(q.choices, ['fait', 'en_partie', 'non_fait']);
        }
    });
});

test('7. Echelle sur 20 et invalidation sur erreur redhibitoire', () => {
    const casePath = path.resolve('data/cardio_douleur_thoracique_mme_bennet.json');
    const caseData = JSON.parse(fs.readFileSync(casePath, 'utf8'));

    const questions = buildScoringQuestions(caseData);

    // Test 1: Tout fait -> note 20.0, validee
    const perfectDecisions = {};
    questions.forEach(q => {
        if (q.type === 'choice') {
            perfectDecisions[q.id] = 'fait';
        } else if (q.type === 'noul') {
            perfectDecisions[q.id] = 0.05;
        }
    });

    const perfectScores = computeFinalScores(caseData, perfectDecisions);
    assert.equal(perfectScores.finalScore, 20.0);
    assert.equal(perfectScores.validated, true);
    assert.equal(perfectScores.redhibitoryTriggered, false);

    // Test 2: Erreur redhibitoire avec certitude > 0.35 (ex: 0.42)
    const failedDecisions = { ...perfectDecisions };
    const redhibQuestion = questions.find(q => q.isRedhibitoire || q.id.startsWith('redhib_'));
    assert.ok(redhibQuestion, 'Une question redhibitoire doit exister');
    failedDecisions[redhibQuestion.id] = 0.42;

    const failedScores = computeFinalScores(caseData, failedDecisions);
    assert.equal(failedScores.finalScore, 0.0, 'Erreur redhibitoire entraine un score final de 0');
    assert.equal(failedScores.validated, false);
    assert.equal(failedScores.redhibitoryTriggered, true);
    assert.equal(failedScores.redhibitoryErrorsFound.length, 1);
});

test('8. Absence totale de fallbacks : scan statique de js/ecosMode.js', () => {
    const ecosModeCode = fs.readFileSync(path.resolve('js/ecosMode.js'), 'utf8');

    assert.ok(!ecosModeCode.includes('evaluateAnnounce'), 'evaluateAnnounce doit etre supprime');
    assert.ok(!ecosModeCode.includes('generateFeedbackNarrative'), 'generateFeedbackNarrative doit etre supprime');
    assert.ok(!ecosModeCode.includes('computeEcosScores'), 'computeEcosScores doit etre supprime');
    assert.ok(!ecosModeCode.includes('0.75'), 'Aucune constante de secours 0.75 ne doit subsister');
    assert.ok(!ecosModeCode.includes('scores[item.id]'), 'Aucun repli de notation maison ne doit subsister');
    assert.ok(!ecosModeCode.includes('scores.presentation'), 'Aucune heuristique presentation ne doit subsister');
    assert.ok(!ecosModeCode.includes('scores.empathie'), 'Aucune heuristique empathie ne doit subsister');
});

test('9. Pas de note sans Jev : echec reseau entraine station non notee sans appel LLM', async () => {
    const casePath = path.resolve('data/cardio_douleur_thoracique_mme_bennet.json');
    const caseData = JSON.parse(fs.readFileSync(casePath, 'utf8'));

    const originalFetch = globalThis.fetch;
    let llmCalled = false;

    globalThis.fetch = async (url) => {
        if (url && url.includes('llm')) {
            llmCalled = true;
        }
        throw new Error('Connexion perdue avec le serveur Jev');
    };

    try {
        const evalResult = await evaluateStation(caseData, 'journal fictif');
        assert.equal(evalResult.success, false);
        assert.equal(evalResult.unrated, true);
        assert.ok(evalResult.message.includes('non notée') || evalResult.message.includes('non notee'));
        assert.equal(evalResult.finalScore ?? null, null);
        assert.equal(llmCalled, false, 'Aucun appel LLM ne doit remplacer la notation Jev');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('10. Fallback routage uniquement : route vers le patient sur certitude inferieure a 0.8 ou echec', async () => {
    const originalFetch = globalThis.fetch;

    // Cas 1 : score maximal inferieur au seuil de 0.8
    globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
            decisions: [
                { id: 'dest_patient', type: 'noul', probability: 0.65 },
                { id: 'dest_radiologue', type: 'noul', probability: 0.40 },
                { id: 'dest_biologiste', type: 'noul', probability: 0.10 }
            ]
        })
    });

    try {
        const route1 = await routeMessage('Phrase clinique ambigue');
        assert.equal(route1.toPatient, true, 'Doit router vers le patient');
        assert.equal(route1.clinicalActions.length, 0);
        assert.equal(route1.fallback, true);

        // Cas 2 : echec reseau sur le routage
        globalThis.fetch = async () => {
            throw new Error('Reseau indisponible');
        };

        const route2 = await routeMessage('Je veux faire une prise de sang');
        assert.equal(route2.toPatient, true, 'En cas d erreur reseau, routage de secours vers le patient');
        assert.equal(route2.clinicalActions.length, 0);
        assert.equal(route2.fallback, true);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('11. Non-regression : CSP et regles de redirection netlify.toml valides', () => {
    const tomlContent = fs.readFileSync(path.resolve('netlify.toml'), 'utf8');

    assert.ok(tomlContent.includes('/api/jev/*'), 'Redirection /api/jev/* manquante');
    assert.ok(tomlContent.includes('/.netlify/functions/jev-proxy'), 'Fonction cible jev-proxy manquante');
    assert.ok(tomlContent.includes('Content-Security-Policy'), 'En-tete Content-Security-Policy manquant');
    assert.ok(tomlContent.includes('X-Frame-Options'), 'En-tete X-Frame-Options manquant');
    assert.ok(tomlContent.includes('X-Content-Type-Options'), 'En-tete X-Content-Type-Options manquant');
});
