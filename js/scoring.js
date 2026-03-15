/**
 * js/scoring.js — Calcul de score et gestion des traitements
 * Phase 5 du refactoring : extrait de game.js
 *
 * Dépendances injectées via initScoring():
 *   scoringState.currentCase, scoringState.attempts, scoringState.selectedTreatments
 */

const scoringState = {
    currentCase: null,
    attempts: 0,
    selectedTreatments: []
};

/**
 * Calcule le score courant basé sur les règles du cas et le nombre de tentatives.
 * @returns {number} Score calculé (minimum 0)
 */
function calculateScore() {
    if (!scoringState.currentCase || !scoringState.currentCase.scoringRules) return 0;
    let baseScore = scoringState.currentCase.scoringRules.baseScore || 100;
    let attemptPenalty = scoringState.currentCase.scoringRules.attemptPenalty || 10;
    return Math.max(0, baseScore - (scoringState.attempts * attemptPenalty));
}

function handleTraitementClick(event) {
    const traitement = event.target.dataset.traitement;
    if (scoringState.selectedTreatments.includes(traitement)) {
        scoringState.selectedTreatments = scoringState.selectedTreatments.filter(t => t !== traitement);
        event.target.classList.remove('selected');
        event.target.setAttribute('aria-selected', 'false');
    } else {
        scoringState.selectedTreatments.push(traitement);
        event.target.classList.add('selected');
        event.target.setAttribute('aria-selected', 'true');
    }
}

/**
 * Calcule le score en pourcentage et le bonus temps.
 * Retourne { percentageScore, timeBonus, hasFatalError }
 */
function calculateDetailedScore() {
    const currentCase = scoringState.currentCase;
    const selectedTreatments = scoringState.selectedTreatments;
    const correctTreatments = currentCase.correctTreatments;
    const selectedDiagnostic = document.getElementById('diagnostic-select').value;
    const correctDiagnostic = currentCase.correctDiagnostic;

    const allCorrectSelected = correctTreatments.every(t => selectedTreatments.includes(t));
    const isCorrect = selectedDiagnostic === correctDiagnostic && allCorrectSelected && selectedTreatments.length === correctTreatments.length;

    // Calculate percentage score
    let percentageScore = 0;
    const diagnosticWeight = 50;
    const treatmentWeight = 50;

    if (selectedDiagnostic === correctDiagnostic) {
        percentageScore += diagnosticWeight;
    }

    // Fatal error check
    const fatalTreatments = currentCase.fatalTreatments || [];
    const selectedFatalTreatments = selectedTreatments.filter(t => fatalTreatments.includes(t));
    const hasFatalError = selectedFatalTreatments.length > 0;

    if (correctTreatments.length > 0 && !hasFatalError) {
        const correctSelectedCount = selectedTreatments.filter(t => correctTreatments.includes(t)).length;
        const treatmentPointsPerCorrect = treatmentWeight / Math.max(correctTreatments.length, selectedTreatments.length);
        percentageScore += correctSelectedCount * treatmentPointsPerCorrect;
    }

    percentageScore = Math.max(0, Math.min(100, Math.round(percentageScore)));

    // Time bonus
    const totalTime = getTimeLimit();
    const timeBonus = (timerState.timeLeft > 0)
        ? Math.round(10 * (timerState.timeLeft / totalTime))
        : 0;

    return {
        percentageScore,
        timeBonus,
        hasFatalError,
        selectedFatalTreatments,
        isCorrect,
        selectedDiagnostic,
        correctDiagnostic
    };
}

/**
 * Calcule l'XP gagné en fonction du nombre de tentatives (anti-farm).
 */
function calculateXpEarned(percentageScore, timeBonus) {
    const currentCase = scoringState.currentCase;
    const caseAttemptsKey = `case_attempts_${currentCase.id}`;
    let caseAttempts = parseInt(localStorage.getItem(caseAttemptsKey)) || 0;
    caseAttempts++;
    localStorage.setItem(caseAttemptsKey, caseAttempts);

    let xpEarned = 0;
    let xpMessage = '';

    if (caseAttempts === 1) {
        xpEarned = percentageScore + timeBonus;
        xpMessage = 'Première tentative - XP complet';
    } else if (caseAttempts === 2) {
        const previousScoreKey = `case_score_${currentCase.id}`;
        const previousScore = parseInt(localStorage.getItem(previousScoreKey)) || percentageScore;
        const averageScore = Math.round((previousScore + percentageScore) / 2);
        xpEarned = averageScore + timeBonus;
        xpMessage = `Deuxième tentative - Moyenne: ${averageScore}%`;
    } else {
        xpEarned = 0;
        xpMessage = `Tentative #${caseAttempts} - Pas d'XP`;
    }

    localStorage.setItem(`case_score_${currentCase.id}`, percentageScore);

    return { xpEarned, xpMessage, caseAttempts };
}
