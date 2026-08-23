/**
 * js/sessionSnapshot.js — Sauvegarde & reprise de session
 *
 * Un F5 ou une fermeture d'onglet ne fait plus perdre la partie en cours :
 * l'état complet du cas (index, timer, démarche, traitements, verrous) est
 * capturé en sessionStorage à chaque chargement de cas et restauré au retour.
 *
 * Usage :
 *   SessionSnapshot.capture()            — après chaque loadCase()
 *   SessionSnapshot.tryRestore(caseIds)  — dans initializeGame(), avant le 1er cas
 *   SessionSnapshot.clear()              — à la validation finale du cas
 *   SessionSnapshot.clearFullSession()   — quand toute la session est terminée
 */
const SessionSnapshot = (() => {
    const KEY = 'medgame_session_snapshot';
    const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 h

    function _save(data) {
        try { sessionStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* quota */ }
    }

    function _load() {
        try { return JSON.parse(sessionStorage.getItem(KEY)); } catch (e) { return null; }
    }

    /** Capture l'état courant du jeu (appelé après chaque loadCase complet). */
    function capture() {
        const gs = window.gameState;
        if (!gs || !gs.currentCase || gs.cases.length === 0) return;

        const dem = (window.scoringState && window.scoringState.demarche) || {};

        _save({
            savedAt: Date.now(),
            caseIndex: gs.currentCaseIndex,
            caseId: gs.currentCase.id,
            caseIds: gs.cases.map(c => c.id),
            timeLeft: (window.timerState && window.timerState.timeLeft) || null,
            totalTime: (window.timerState && window.timerState.totalTime) || null,
            activeExams: gs.activeExams || [],
            selectedTreatments: (window.scoringState && window.scoringState.selectedTreatments) || [],
            selectedDiagnostic: (window.scoringState && window.scoringState.selectedDiagnostic) || '',
            demarche: {
                interrogatoireAsked: [...(dem.interrogatoireAsked || [])],
                examsOrdered: dem.examsOrdered || [],
                examSectionsViewed: [...(dem.examSectionsViewed || [])],
                startedAt: dem.startedAt || Date.now()
            },
            unlockedLocks: (window.lockSystem && [...window.lockSystem.unlockedLocks]) || []
        });
    }

    /**
     * Tente de restaurer une session compatible avec la liste de cas chargée.
     * @param {string[]} currentCaseIds — ids des cas actuellement chargés
     * @returns {object|null} le snapshot restauré (état appliqué) ou null
     */
    function tryRestore(currentCaseIds) {
        const snap = _load();
        if (!snap || !Array.isArray(snap.caseIds)) return null;

        // Expiré ?
        if (snap.savedAt && (Date.now() - snap.savedAt) > MAX_AGE_MS) { clear(); return null; }

        // La liste de cas doit correspondre exactement (même sélection)
        if (JSON.stringify(snap.caseIds) !== JSON.stringify(currentCaseIds)) { clear(); return null; }

        // Cas déjà validé ? Reprendre au suivant plutôt qu'un cas terminé.
        const gs = window.gameState;
        if (!gs) return null;

        gs.currentCaseIndex = Math.min(Math.max(0, snap.caseIndex), gs.cases.length - 1);

        // Ré-appliquer l'état APRÈS que loadCase aura reconstruit le DOM :
        // on expose un hook que game.js exécute en fin de loadCase.
        _pendingApply = snap;
        return snap;
    }

    let _pendingApply = null;

    /** Applique l'état restauré sur les modules (à appeler EN FIN de loadCase). */
    function applyPendingRestore() {
        const snap = _pendingApply;
        _pendingApply = null;
        if (!snap) return false;

        try {
            // Timer : temps restant sauvegardé (endTime recalculé au startTimerNow)
            if (window.timerState && typeof snap.timeLeft === 'number' && snap.timeLeft > 0) {
                window.timerState.timeLeft = snap.timeLeft;
                if (snap.totalTime) window.timerState.totalTime = snap.totalTime;
            }

            // Démarche clinique
            if (window.scoringState) {
                window.scoringState.selectedTreatments = snap.selectedTreatments || [];
                window.scoringState.selectedDiagnostic = snap.selectedDiagnostic || '';
                if (snap.demarche) {
                    window.scoringState.demarche.interrogatoireAsked = new Set(snap.demarche.interrogatoireAsked || []);
                    window.scoringState.demarche.examsOrdered = snap.demarche.examsOrdered || [];
                    window.scoringState.demarche.examSectionsViewed = new Set(snap.demarche.examSectionsViewed || []);
                    window.scoringState.demarche.startedAt = snap.demarche.startedAt || Date.now();
                }
            }

            // Verrous déverrouillés (clés déjà namespacées)
            if (window.lockSystem && Array.isArray(snap.unlockedLocks)) {
                window.lockSystem.unlockedLocks = new Set(snap.unlockedLocks);
            }

            // Examens complémentaires actifs
            if (window.gameState && Array.isArray(snap.activeExams)) {
                window.gameState.activeExams = snap.activeExams;
            }

            console.info('[SessionSnapshot] Session restaurée — cas', snap.caseIndex + 1, '/', snap.caseIds.length);
            return true;
        } catch (e) {
            console.warn('[SessionSnapshot] Restauration partielle échouée :', e);
            return false;
        }
    }

    /** Efface le snapshot (cas clôturé — on passe au suivant proprement). */
    function clear() {
        try { sessionStorage.removeItem(KEY); } catch (e) {}
    }

    /**
     * Fin de la session complète (dernier cas validé / retour accueil) :
     * purge le snapshot ET la sélection de cas conservée par caseLoader.
     */
    function clearFullSession() {
        clear();
        try {
            localStorage.removeItem('selectedCaseFiles');
            localStorage.removeItem('selectedCaseFile');
        } catch (e) {}
    }

    window.SessionSnapshot = { capture, tryRestore, applyPendingRestore, clear, clearFullSession };
    return window.SessionSnapshot;
})();
