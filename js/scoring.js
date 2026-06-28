/**
 * js/scoring.js — Calcul de score composite avancé et gestion des traitements
 * Phase 5 du refactoring : extrait de game.js
 * Amélioration : scoring composite Démarche 40% / Diagnostic 30% / Traitement 20% / Vitesse 10%
 *
 * Dépendances injectées via initScoring() :
 *   scoringState.currentCase, scoringState.attempts, scoringState.selectedTreatments
 */

const SCORING_WEIGHTS = {
    demarche: 0.40,    // 40% — qualité de l'examen clinique
    diagnostic: 0.30,  // 30% — exactitude du diagnostic
    traitement: 0.20,  // 20% — pertinence du traitement
    vitesse: 0.10       // 10% — temps restant
};

const scoringState = {
    currentCase: null,
    attempts: 0,
    selectedTreatments: [],
    // --- Traçage de la démarche clinique ---
    demarche: {
        interrogatoireAsked: new Set(),   // chemins de champs dévoilés via boutons questions
        examsOrdered: [],                  // examens complémentaires demandés
        examSectionsViewed: new Set(),     // sections d'examen clinique consultées
        locksUnlocked: new Set(),          // verrous sémiologiques relevés
        startedAt: null                    // timestamp de début du cas
    }
};

window.scoringState = scoringState;

/**
 * Réinitialise le suivi de démarche pour un nouveau cas.
 * Appelé par gameState.setCase().
 */
function resetDemarche() {
    scoringState.demarche = {
        interrogatoireAsked: new Set(),
        examsOrdered: [],
        examSectionsViewed: new Set(),
        locksUnlocked: new Set(),
        startedAt: Date.now()
    };
}
window.resetDemarche = resetDemarche;

/**
 * Enregistre qu'un champ d'interrogatoire a été demandé par le joueur.
 * Appelé depuis ui.js (displayQuestionBtn on-click).
 * @param {string} fieldPath — chemin du champ (ex: 'interrogatoire.modeDeVie.tabac')
 */
function trackInterrogatoire(fieldPath) {
    if (fieldPath) {
        scoringState.demarche.interrogatoireAsked.add(fieldPath);
        if (window.EcosMode && typeof window.EcosMode.checkItemByFieldPath === 'function') {
            window.EcosMode.checkItemByFieldPath(fieldPath);
        }
    }
}
window.trackInterrogatoire = trackInterrogatoire;

/**
 * Enregistre qu'une section d'examen clinique a été consultée.
 * Appelé quand le joueur navigue vers un onglet d'examen.
 * @param {string} sectionId — identifiant de la section (ex: 'section-examen-clinique')
 */
function trackExamSectionViewed(sectionId) {
    if (sectionId) scoringState.demarche.examSectionsViewed.add(sectionId);
}
window.trackExamSectionViewed = trackExamSectionViewed;

/**
 * Enregistre qu'un verrou sémiologique a été relevé.
 * Appelé depuis lockSystem.js unlock().
 * @param {string} lockId — identifiant du verrou
 */
function trackLockUnlocked(lockId) {
    if (lockId) scoringState.demarche.locksUnlocked.add(lockId);
}
window.trackLockUnlocked = trackLockUnlocked;

/**
 * Enregistre les examens complémentaires demandés.
 * Appelé lors de la validation des examens.
 * @param {string[]} exams — liste des noms d'examens
 */
function trackExamsOrdered(exams) {
    scoringState.demarche.examsOrdered = exams || [];
    if (window.EcosMode && typeof window.EcosMode.checkItemByExamName === 'function') {
        (exams || []).forEach(ex => {
            window.EcosMode.checkItemByExamName(ex);
        });
    }
}
window.trackExamsOrdered = trackExamsOrdered;

// ==================== CALCULS DE SCORE ====================

/**
 * Calcule le score de DÉMARCHE CLINIQUE (0-100).
 * Évalue la complétude de l'exploration du cas par le joueur :
 *   - Interrogatoire : fraction des champs demandés sur les champs disponibles
 *   - Examens cliniques : consultation de la section examen
 *   - Examens complémentaires : fraction des examens pertinents demandés
 *   - Verrous sémiologiques : fraction relevée
 *
 * @param {object} currentCase — cas courant
 * @returns {number} score démarche 0-100
 */
function calculateDemarcheScore(currentCase) {
    if (!currentCase) return 0;

    const dem = scoringState.demarche;
    let points = 0;
    let maxPoints = 0;

    // --- 1. Interrogatoire (poids 40 pts sur 100 de démarche) ---
    // On détermine le nombre total de champs interrogatoire disponibles
    const interro = currentCase.interrogatoire || {};

    // Champs attendus en mode immersif (ceux qui ont des boutons question)
    const interrogatoireFields = [];
    const mdv = interro.modeDeVie || {};
    if (mdv.activitePhysique) interrogatoireFields.push('interrogatoire.modeDeVie.activitePhysique.description');
    if (mdv.tabac) interrogatoireFields.push('interrogatoire.modeDeVie.tabac');
    if (mdv.alcool) interrogatoireFields.push('interrogatoire.modeDeVie.alcool.quantite');
    if (mdv.alimentation) interrogatoireFields.push('interrogatoire.modeDeVie.alimentation');
    if (mdv.emploi) interrogatoireFields.push('interrogatoire.modeDeVie.emploi');
    // Antécédents
    if (interro.antecedents) {
        if (interro.antecedents.medicaux && interro.antecedents.medicaux.length > 0)
            interrogatoireFields.push('interrogatoire.antecedents.medicaux');
        if (interro.antecedents.chirurgicaux && interro.antecedents.chirurgicaux.length > 0)
            interrogatoireFields.push('interrogatoire.antecedents.chirurgicaux');
        if (interro.antecedents.familiaux && interro.antecedents.familiaux.length > 0)
            interrogatoireFields.push('interrogatoire.antecedents.familiaux');
    }
    // Traitements & allergies
    if (interro.traitements && interro.traitements.length > 0)
        interrogatoireFields.push('interrogatoire.traitements');
    if (interro.allergies && interro.allergies.presence)
        interrogatoireFields.push('interrogatoire.allergies');
    // Histoire de la maladie
    const hm = interro.histoireMaladie || {};
    if (hm.debutSymptomes) interrogatoireFields.push('interrogatoire.histoireMaladie.debutSymptomes');
    if (hm.descriptionDouleur) interrogatoireFields.push('interrogatoire.histoireMaladie.descriptionDouleur');
    if (hm.evolution) interrogatoireFields.push('interrogatoire.histoireMaladie.evolution');
    if (hm.facteursDeclenchants) interrogatoireFields.push('interrogatoire.histoireMaladie.facteursDeclenchants');
    if (hm.symptomesAssocies) interrogatoireFields.push('interrogatoire.histoireMaladie.symptomesAssocies');
    if (hm.remarques) interrogatoireFields.push('interrogatoire.histoireMaladie.remarques');

    // En mode classique, tous les champs sont dévoilés automatiquement => bonus partiel
    if (sessionStorage.getItem('immersionMode') !== 'immersif') {
        // Mode classique : le joueur a accès sans effort, mais on vérifie s'il a consulté
        // On attribue 60% du score car les données sont déjà visibles
        const viewedRatio = dem.examSectionsViewed.has('section-examen-clinique') ? 1 : 0;
        points += 24; // Bonus de visibilité automatique
        maxPoints += 40;
        points += viewedRatio * 16;
        maxPoints += 16;
    } else {
        // Mode immersif (ECOS) : le joueur doit poser des questions
        const totalInterroFields = Math.max(interrogatoireFields.length, 1);
        const askedCount = interrogatoireFields.filter(f => dem.interrogatoireAsked.has(f)).length;
        const interroRatio = askedCount / totalInterroFields;
        points += interroRatio * 40;
        maxPoints += 40;
    }

    // --- 2. Examen clinique (poids 25 pts) ---
    const hasExamView = dem.examSectionsViewed.has('section-examen-clinique') ||
                        dem.examSectionsViewed.has('section-examen');
    points += hasExamView ? 25 : 0;
    maxPoints += 25;

    // --- 3. Examens complémentaires (poids 20 pts) ---
    const availableExams = currentCase.availableExams || [];
    const relevantExams = currentCase.relevantExams || [];
    const examsOrdered = dem.examsOrdered;

    if (availableExams.length > 0) {
        // Si le cas définit des examens pertinents, on calcule la fraction couverte
        const targetExams = relevantExams.length > 0 ? relevantExams : availableExams;
        const orderedRelevant = examsOrdered.filter(e => targetExams.includes(e));
        const orderRatio = orderedRelevant.length / Math.max(targetExams.length, 1);

        // Pénalité pour les examens inutiles commandés
        const uselessExams = examsOrdered.filter(e => !targetExams.includes(e));
        const uselessPenalty = uselessExams.length * 0.05; // 5% de pénalité par examen inutile

        points += Math.max(0, orderRatio - uselessPenalty) * 20;
    } else {
        // Pas d'examens disponibles pour ce cas, points gratuits
        points += 20;
    }
    maxPoints += 20;

    // --- 4. Verrous sémiologiques (poids 15 pts) ---
    const locks = currentCase.locks || [];
    if (locks.length > 0) {
        const unlockedCount = locks.filter(l => dem.locksUnlocked.has(l.id)).length;
        const lockRatio = unlockedCount / locks.length;
        points += lockRatio * 15;
    } else {
        // Pas de verrous pour ce cas
        points += 15;
    }
    maxPoints += 15;

    const score = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 100;
    return Math.max(0, Math.min(100, score));
}

/**
 * Calcule le score de DIAGNOSTIC (0-100).
 * Scoring progressif :
 *   - 100 : diagnostic exact (match direct ou normalisé)
 *   - 80  : alias/variante acceptable (défini dans alternativeDiagnostics du cas)
 *   - 60  : diagnostic proche (inclusion partielle ou Levenshtein ≤ 2)
 *   - 30  : même catégorie/specialité que le diagnostic correct
 *   - 0   : diagnostic non pertinent
 *
 * @param {string} selectedDiagnostic — diagnostic choisi par le joueur
 * @param {string} correctDiagnostic — diagnostic correct du cas
 * @returns {number} score diagnostic 0-100
 */
function calculateDiagnosticScore(selectedDiagnostic, correctDiagnostic) {
    if (!selectedDiagnostic || !correctDiagnostic) return 0;

    // 1. Match exact (strict puis normalisé)
    if (selectedDiagnostic === correctDiagnostic) return 100;
    const normSel = normalizeText(selectedDiagnostic);
    const normCor = normalizeText(correctDiagnostic);
    if (normSel === normCor) return 100;

    // 2. Vérifier les alias/variantes acceptables définis dans le cas
    const currentCase = scoringState.currentCase;
    const alternativeDiags = (currentCase && currentCase.alternativeDiagnostics) || [];
    if (alternativeDiags.length > 0) {
        for (const alt of alternativeDiags) {
            if (normalizeText(alt) === normSel) return 80;
        }
    }

    // 3. Inclusion partielle (l'un contient l'autre)
    if (normSel.includes(normCor) || normCor.includes(normSel)) return 60;

    // 4. Distance de Levenshtein — proximité typographique
    const dist = getLevenshteinDistance(normSel, normCor);
    const maxLen = Math.max(normSel.length, normCor.length);
    if (maxLen > 0) {
        const similarity = 1 - (dist / maxLen);
        if (similarity >= 0.75) return 60;
        if (similarity >= 0.50) return 30;
    }

    // 5. Même catégorie/specialité (préfixe du cas, ex: "cardio_", "neuro_")
    const caseId = (currentCase && currentCase.id) || '';
    const caseCategories = extractCategories(caseId);
    const selCategories = extractCategories(normSel);
    const overlapCategories = selCategories.filter(c => caseCategories.includes(c));
    if (overlapCategories.length > 0) return 15;

    return 0;
}

/**
 * Extrait les mots-clés de catégorie d'un identifiant ou texte.
 * Utilisé pour la détection de proximité diagnostique par spécialité.
 * @param {string} text
 * @returns {string[]}
 */
function extractCategories(text) {
    const MEDICAL_CATEGORIES = [
        'cardio', 'neuro', 'pneumo', 'nephro', 'néphro', 'digest',
        'locomo', 'trauma', 'urg', 'onco', 'dermato', 'gyneco',
        'ped', 'psy', 'endo', 'rhumato', 'ophtalmo', 'orl',
        'angor', 'idm', 'scd', 'infarctus', 'avc', 'choc',
        'epilep', 'convuls', 'anaphylax', 'hemorr', 'hémorr'
    ];
    const norm = normalizeText(text);
    return MEDICAL_CATEGORIES.filter(cat => norm.includes(cat));
}

/**
 * Calcule le score de TRAITEMENT (0-100).
 * Évalue la sélection de traitements par rapport aux traitements corrects,
 * en pénalisant les erreurs et les traitements fatals, avec pondération
 * par ligne thérapeutique (1ère intention = poids complet, 2ème intention = 60%).
 *
 * Le cas peut définir :
 *   - correctTreatments : traitements corrects (1ère intention par défaut)
 *   - secondLineTreatments : traitements de 2ème intention acceptables (réduisent le score)
 *   - fatalTreatments : traitements contre-indiqués/fatals
 *
 * @param {string[]} selectedTreatments — traitements choisis par le joueur
 * @param {string[]} correctTreatments — traitements corrects attendus (1ère intention)
 * @param {string[]} fatalTreatments — traitements fatals/contre-indiqués
 * @returns {{ score: number, hasFatalError: boolean, selectedFatalTreatments: string[], details: object }}
 */
function calculateTraitementScore(selectedTreatments, correctTreatments, fatalTreatments) {
    fatalTreatments = fatalTreatments || [];
    const currentCase = scoringState.currentCase;
    const secondLine = (currentCase && currentCase.secondLineTreatments) || [];

    // Inclure les traitements prescrits malgré les contre-indications (outrepassés par le joueur)
    const overrideFatalTreatments = (window.scoringState && window.scoringState._fatalOverrideTreatments) || [];
    const allFatal = [...fatalTreatments, ...overrideFatalTreatments];

    const selectedFatalTreatments = (selectedTreatments || []).filter(t => allFatal.includes(t));

    // Détails pour le feedback
    const details = {
        firstLineHit: [],
        secondLineHit: [],
        unnecessary: [],
        missed: []
    };

    if (selectedFatalTreatments.length > 0) {
        // Erreur fatale = score traitement 0
        details.fatal = selectedFatalTreatments;
        return { score: 0, hasFatalError: true, selectedFatalTreatments, details };
    }

    if (!correctTreatments || correctTreatments.length === 0) {
        return { score: 100, hasFatalError: false, selectedFatalTreatments: [], details };
    }

    selectedTreatments = selectedTreatments || [];

    // --- 1ère intention : traitements corrects ---
    const firstLineHit = selectedTreatments.filter(t => correctTreatments.includes(t));
    details.firstLineHit = firstLineHit;

    // --- 2ème intention : traitements acceptables mais moins prioritaires ---
    const secondLineHit = selectedTreatments.filter(t => secondLine.includes(t));
    details.secondLineHit = secondLineHit;

    // --- Inutiles : ni 1ère, ni 2ème, ni fatals ---
    const allAcceptable = [...correctTreatments, ...secondLine, ...fatalTreatments];
    const unnecessary = selectedTreatments.filter(t => !allAcceptable.includes(t));
    details.unnecessary = unnecessary;

    // --- Manqués : traitements corrects non sélectionnés ---
    const missed = correctTreatments.filter(t => !selectedTreatments.includes(t));
    details.missed = missed;

    // Pondération : 1ère intention = 1.0, 2ème intention = 0.6
    const firstLineWeight = 1.0;
    const secondLineWeight = 0.6;

    // Sensibilité pondérée
    const maxFirstLineScore = correctTreatments.length * firstLineWeight;
    const achievedFirstLine = firstLineHit.length * firstLineWeight;
    const achievedSecondLine = secondLineHit.length * secondLineWeight;
    const achievedTotal = achievedFirstLine + achievedSecondLine;
    const maxPossibleScore = maxFirstLineScore; // Le max reste basé sur la 1ère intention

    const sensitivity = maxPossibleScore > 0 ? achievedTotal / maxPossibleScore : 0;

    // Pénalités
    const falsePositivePenalty = unnecessary.length * 0.10; // 10% par traitement inutile
    const overSelectionPenalty = Math.max(0, (selectedTreatments.length - correctTreatments.length)) * 0.05; // sur-prescription

    const rawScore = (sensitivity - falsePositivePenalty - overSelectionPenalty) * 100;
    return {
        score: Math.max(0, Math.min(100, Math.round(rawScore))),
        hasFatalError: false,
        selectedFatalTreatments,
        details
    };
}

/**
 * Calcule le score de VITESSE (0-100).
 * Basé sur la fraction du temps restant.
 *
 * @param {number} timeLeft — secondes restantes
 * @param {number} totalTime — durée totale du cas en secondes
 * @returns {number} score vitesse 0-100
 */
function calculateVitesseScore(timeLeft, totalTime) {
    if (!totalTime || totalTime <= 0) return 50; // fallback
    const ratio = Math.max(0, timeLeft) / totalTime;
    return Math.round(ratio * 100);
}

/**
 * Calcule le score composite avancé à 4 composantes.
 * Pondération : Démarche 40%, Diagnostic 30%, Traitement 20%, Vitesse 10%
 *
 * @returns {{
 *   demarcheScore: number,
 *   diagnosticScore: number,
 *   traitementScore: number,
 *   vitesseScore: number,
 *   compositeScore: number,
 *   hasFatalError: boolean,
 *   selectedFatalTreatments: string[],
 *   selectedDiagnostic: string,
 *   correctDiagnostic: string,
 *   stars: number,
 *   breakdown: object
 * }}
 */
function calculateCompositeScore() {
    const currentCase = scoringState.currentCase;
    if (!currentCase) {
        return {
            demarcheScore: 0, diagnosticScore: 0, traitementScore: 0, vitesseScore: 0,
            compositeScore: 0, hasFatalError: false, selectedFatalTreatments: [],
            selectedDiagnostic: '', correctDiagnostic: '', stars: 0,
            breakdown: {}
        };
    }

    const selectedTreatments = scoringState.selectedTreatments;
    const correctTreatments = currentCase.correctTreatments || [];
    const fatalTreatments = currentCase.fatalTreatments || [];
    const selectedDiagnostic = (document.getElementById('diagnostic-select') || {}).value || '';
    const correctDiagnostic = currentCase.correctDiagnostic || '';

    const totalTime = getTimeLimit();
    const timeLeft = (typeof timerState !== 'undefined' && timerState.timeLeft) || 0;

    // --- Calcul des 4 composantes ---
    const demarcheScore = calculateDemarcheScore(currentCase);
    const diagnosticScore = calculateDiagnosticScore(selectedDiagnostic, correctDiagnostic);
    const traitementResult = calculateTraitementScore(selectedTreatments, correctTreatments, fatalTreatments);
    const vitesseScore = calculateVitesseScore(timeLeft, totalTime);

    // --- Score composite pondéré ---
    let compositeScore = Math.round(
        demarcheScore * SCORING_WEIGHTS.demarche +
        diagnosticScore * SCORING_WEIGHTS.diagnostic +
        traitementResult.score * SCORING_WEIGHTS.traitement +
        vitesseScore * SCORING_WEIGHTS.vitesse
    );

    // Plafonner à 0 si erreur fatale de traitement
    if (traitementResult.hasFatalError) {
        compositeScore = Math.max(0, compositeScore);
    }

    compositeScore = Math.max(0, Math.min(100, compositeScore));

    // Constitution du breakdown AVANT calculateStars (nécessaire pour la garantie démarche)
    const breakdown = {
        demarche: { score: demarcheScore, weight: SCORING_WEIGHTS.demarche, contribution: Math.round(demarcheScore * SCORING_WEIGHTS.demarche * 100) / 100 },
        diagnostic: { score: diagnosticScore, weight: SCORING_WEIGHTS.diagnostic, contribution: Math.round(diagnosticScore * SCORING_WEIGHTS.diagnostic * 100) / 100 },
        traitement: { score: traitementResult.score, weight: SCORING_WEIGHTS.traitement, contribution: Math.round(traitementResult.score * SCORING_WEIGHTS.traitement * 100) / 100 },
        vitesse: { score: vitesseScore, weight: SCORING_WEIGHTS.vitesse, contribution: Math.round(vitesseScore * SCORING_WEIGHTS.vitesse * 100) / 100 }
    };

    // --- Star rating 0-3 (avec garantie démarche) ---
    const stars = calculateStars(compositeScore, traitementResult.hasFatalError, breakdown);

    return {
        demarcheScore,
        diagnosticScore,
        traitementScore: traitementResult.score,
        vitesseScore,
        compositeScore,
        hasFatalError: traitementResult.hasFatalError,
        selectedFatalTreatments: traitementResult.selectedFatalTreatments,
        treatmentDetails: traitementResult.details || {},
        selectedDiagnostic,
        correctDiagnostic,
        stars,
        breakdown
    };
}

/**
 * Calcule le nombre d'étoiles (0-3) basé sur le score composite et les sous-composantes.
 * - Erreur fatale → 0 étoile
 * - Score ≥ 90 ET diagnostic correct → 3 étoiles (excellence)
 * - Score ≥ 70 → 2 étoiles (bonne démarche)
 * - Score ≥ 40 OU (démarche ≥ 60 ET diagnostic ≥ 30) → 1 étoile (partiel)
 * - Score < 40 → 0 étoile (échec)
 *
 * Garantie minimale : une démarche clinique ≥ 80 vaut toujours au moins 1 étoile,
 * même si le diagnostic est faux (le processus reste valorisé).
 *
 * @param {number} compositeScore — score composite 0-100
 * @param {boolean} hasFatalError — erreur fatale commise
 * @param {object} [breakdown] — détails des sous-scores { demarche, diagnostic, traitement, vitesse }
 * @returns {number} nombre d'étoiles 0-3
 */
function calculateStars(compositeScore, hasFatalError, breakdown) {
    if (hasFatalError) return 0;

    // Étoiles par seuils de score composite
    if (compositeScore >= 90) return 3;
    if (compositeScore >= 70) return 2;
    if (compositeScore >= 40) return 1;

    // Garantie démarche : une bonne démarche vaut au moins 1 étoile
    if (breakdown && breakdown.demarche && breakdown.demarche.score >= 80) return 1;

    return 0;
}

// ==================== FONCTIONS EXISTANTES (compatibilité) ====================

function handleTraitementClick(event) {
    const traitement = event.target.dataset.traitement;
    if (scoringState.selectedTreatments.includes(traitement)) {
        scoringState.selectedTreatments = scoringState.selectedTreatments.filter(t => t !== traitement);
        event.target.classList.remove('selected');
        event.target.setAttribute('aria-selected', 'false');
        // Timeline feedback
        if (typeof feedbackTimeline !== 'undefined') {
            feedbackTimeline.log('traitement', `Traitement retiré : ${traitement}`);
        }
    } else {
        scoringState.selectedTreatments.push(traitement);
        event.target.classList.add('selected');
        event.target.setAttribute('aria-selected', 'true');
        // Timeline feedback
        if (typeof feedbackTimeline !== 'undefined') {
            feedbackTimeline.log('traitement', `Traitement ajouté : ${traitement}`);
        }
    }
}

/**
 * Calcule l'XP gagné en fonction du nombre de tentatives (anti-farm).
 * Maintenant utilise le score composite pour l'XP de base.
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

/**
 * Génère le HTML du panneau de détail du score composite.
 * @param {object} result — résultat de calculateCompositeScore()
 * @returns {string} HTML formaté
 */
function renderCompositeScorePanel(result) {
    const b = result.breakdown;

    function barColor(score) {
        if (score >= 80) return '#2ecc71';
        if (score >= 50) return '#f39c12';
        return '#e74c3c';
    }

    function renderBar(label, data) {
        const color = barColor(data.score);
        return `
            <div style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 0.85rem; color: rgba(255,255,255,0.85);">${label}</span>
                    <span style="font-size: 0.85rem; font-weight: 700; color: ${color};">${data.score}% <span style="font-size:0.7rem;opacity:0.6;">(×${data.weight})</span></span>
                </div>
                <div style="background: rgba(255,255,255,0.1); border-radius: 6px; height: 8px; overflow: hidden;">
                    <div style="background: ${color}; height: 100%; width: ${data.score}%; border-radius: 6px; transition: width 0.8s ease;"></div>
                </div>
                <div style="font-size: 0.7rem; color: rgba(255,255,255,0.5); margin-top: 2px;">Contribution : ${data.contribution.toFixed(1)} pts</div>
            </div>
        `;
    }

    function renderStars(count) {
        let html = '<div style="display:flex;justify-content:center;gap:8px;margin:12px 0;">';
        for (let i = 1; i <= 3; i++) {
            if (i <= count) {
                html += '<i class="fas fa-star" style="font-size:1.8rem;color:#ffc107;text-shadow:0 0 12px rgba(255,193,7,0.5);"></i>';
            } else {
                html += '<i class="far fa-star" style="font-size:1.8rem;color:rgba(255,255,255,0.15);"></i>';
            }
        }
        html += '</div>';
        return html;
    }

    const starsLabel = result.stars === 3 ? 'Excellence' : result.stars === 2 ? 'Bonne démarche' : result.stars === 1 ? 'Partiel' : 'Échec';

    // Traitement detail annotations
    let traitementDetail = '';
    if (result.treatmentDetails) {
        const td = result.treatmentDetails;
        const annotations = [];
        if (td.firstLineHit && td.firstLineHit.length > 0) {
            annotations.push(`<span style="color:#2ecc71;">✓ 1ère intention</span>`);
        }
        if (td.secondLineHit && td.secondLineHit.length > 0) {
            annotations.push(`<span style="color:#f39c12;">⚠ 2ème intention</span>`);
        }
        if (td.unnecessary && td.unnecessary.length > 0) {
            annotations.push(`<span style="color:#e74c3c;">✗ ${td.unnecessary.length} inutile(s)</span>`);
        }
        if (td.missed && td.missed.length > 0) {
            annotations.push(`<span style="color:rgba(255,255,255,0.5);">⊘ ${td.missed.length} manquant(s)</span>`);
        }
        if (annotations.length > 0) {
            traitementDetail = `<div style="font-size:0.7rem; margin-top:2px;">${annotations.join(' · ')}</div>`;
        }
    }

    return `
        <div style="text-align:center; margin-bottom:16px;">
            ${renderStars(result.stars)}
            <div style="font-size:2.2rem; font-weight:800; font-family:var(--font-title); color:${barColor(result.compositeScore)}; margin-bottom:4px;">
                ${result.compositeScore}%
            </div>
            <div style="font-size:0.8rem; color:rgba(255,255,255,0.5);">${starsLabel}</div>
            ${result.diagnosticScore > 0 && result.diagnosticScore < 100 ? `<div style="font-size:0.7rem; color:#f39c12; margin-top:4px;">Diagnostic proche : ${result.diagnosticScore}%</div>` : ''}
        </div>
        <div style="background:rgba(0,0,0,0.25); border-radius:10px; padding:12px 16px; margin-bottom:12px;">
            ${renderBar('🩺 Démarche clinique', b.demarche)}
            ${renderBar('🎯 Diagnostic', b.diagnostic)}
            <div style="position:relative;">
                ${renderBar('💊 Traitement', b.traitement)}
                ${traitementDetail}
            </div>
            ${renderBar('⏱️ Vitesse', b.vitesse)}
        </div>
    `;
}

window.calculateCompositeScore = calculateCompositeScore;
window.calculateXpEarned = calculateXpEarned;
window.calculateStars = calculateStars;
window.calculateDiagnosticScore = calculateDiagnosticScore;
window.calculateTraitementScore = calculateTraitementScore;
window.extractCategories = extractCategories;
window.renderCompositeScorePanel = renderCompositeScorePanel;
window.handleTraitementClick = handleTraitementClick;
window.SCORING_WEIGHTS = SCORING_WEIGHTS;