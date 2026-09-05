/**
 * js/hints.js — Indices progressifs + avis infirmier (P0)
 * Coût : -15s en examen, -15s aussi en entraînement mais sans pénalité de score ;
 * max 3 indices par cas. Ne révèle jamais directement le diagnostic.
 */
(function () {
    'use strict';

    const MAX_HINTS = 3;
    let hintsUsedThisCase = 0;
    let lastCaseId = null;

    function getCase() {
        if (typeof gameState !== 'undefined' && gameState.currentCase) return gameState.currentCase;
        if (window.scoringState && window.scoringState.currentCase) return window.scoringState.currentCase;
        return null;
    }

    function resetIfNewCase(currentCase) {
        const id = currentCase && currentCase.id;
        if (id !== lastCaseId) {
            lastCaseId = id;
            hintsUsedThisCase = 0;
        }
    }

    function buildHints(currentCase) {
        if (!currentCase) return ['Relis le motif et l’histoire de la maladie, puis examine par appareil.'];
        // 1. Hints auteur si présents
        if (Array.isArray(currentCase.hints) && currentCase.hints.length > 0) {
            return currentCase.hints.map(h => (typeof h === 'string' ? h : h.texte || h.text)).filter(Boolean);
        }
        const hints = [];
        const relevant = currentCase.relevantExams || [];
        const locks = currentCase.locks || [];
        const ordered = ((window.scoringState && window.scoringState.demarche && window.scoringState.demarche.examsOrdered) || []);
        const missingExams = relevant.filter(e => !ordered.includes(e));
        if (missingExams.length > 0) hints.push(`💡 Pense à demander : ${missingExams.slice(0, 2).join(', ')}.`);
        else if ((currentCase.availableExams || []).length > 0) hints.push('💡 Tu as couvert les examens clés — confronte-les à l’examen clinique.');
        const locked = locks.filter(l => !(window.isLockUnlocked && window.isLockUnlocked(l.id)));
        if (locked.length > 0) {
            const first = locked[0];
            const q = (first.challenge && first.challenge.question) || first.label || first.id;
            hints.push(`🔐 Défi restant : « ${q} ». Relis le champ concerné avant de répondre (2e tentative = indice).`);
        }
        hints.push('🩺 Repasse l’examen par appareil manquant, puis tranche entre 2 hypothèses dans Synthèse.');
        const correction = currentCase.correction || '';
        if (correction.length > 20) hints.push(`📚 Point cours : ${correction.slice(0, 160)}…`);
        return hints;
    }

    function requestHint() {
        const currentCase = getCase();
        if (!currentCase) {
            if (typeof showNotification === 'function') showNotification('Aucun cas chargé.');
            return;
        }
        resetIfNewCase(currentCase);
        if (hintsUsedThisCase >= MAX_HINTS) {
            if (typeof showNotification === 'function') showNotification('⛔ 3 indices déjà utilisés pour ce cas — à toi de trancher !', 'info');
            return;
        }
        const cost = (window.MedGameModes) ? window.MedGameModes.getActionTimeCost('hint', 30) : 30;
        if (cost > 0 && typeof window.deductTime === 'function') {
            const ok = window.deductTime(cost);
            if (!ok) {
                if (typeof showNotification === 'function') showNotification('Temps insuffisant pour un indice.');
                return;
            }
        }
        const hints = buildHints(currentCase);
        const hint = hints[Math.min(hintsUsedThisCase, hints.length - 1)];
        hintsUsedThisCase += 1;
        if (window.MedGameProgress && window.MedGameProgress.refresh) window.MedGameProgress.refresh();
        if (typeof showNotification === 'function') showNotification(`💡 Indice ${hintsUsedThisCase}/${MAX_HINTS} (−${cost}s) : ${hint}`, 'info');
        if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('reveal');
        if (typeof feedbackTimeline !== 'undefined') feedbackTimeline.log('indice', `Indice ${hintsUsedThisCase} demandé`);
    }

    function askNurse() {
        const currentCase = getCase();
        const dem = (window.scoringState && window.scoringState.demarche) || {};
        let advice = 'Je prépare le patient — suis la checklist : interro, examen, examens, décision.';
        if (currentCase) {
            const ordered = dem.examsOrdered || [];
            const relevant = currentCase.relevantExams || [];
            const missing = relevant.filter(e => !ordered.includes(e));
            if ((dem.interrogatoireAsked ? dem.interrogatoireAsked.size : 0) < 3) {
                advice = '👩‍⚕️ Infirmier : « Docteur, vous n’avez posé que peu de questions — creusez le début, le contexte et les signes associés. »';
            } else if (!(dem.examSectionsViewed && (dem.examSectionsViewed.has('section-examen-clinique') || dem.examSectionsViewed.has('section-examen')))) {
                advice = '👩‍⚕️ Infirmier : « Passez voir le patient pour l’examen clinique avant de commander la biologie. »';
            } else if (missing.length > 0) {
                advice = `👩‍⚕️ Infirmier : « À votre place je demanderais ${missing.slice(0, 2).join(' + ')} en priorité. »`;
            } else {
                advice = '👩‍⚕️ Infirmier : « Le dossier est bien avancé — allez trancher dans Synthèse & Décision. »';
            }
        }
        if (typeof showNotification === 'function') showNotification(advice, 'info');
        if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('click');
    }

    window.MedGameHints = { requestHint, askNurse };
})();
