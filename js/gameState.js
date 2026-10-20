/**
 * js/gameState.js — State management unifié pour Medgame
 * Centralise l'état du jeu pour éviter les variables globales orphelines
 */

const gameState = {
    cases: [],
    currentCaseIndex: 0,
    currentCase: null,
    score: 0,
    activeExams: [],
    vitalMonitorInstance: null,
    isLoaded: false,
    isPatientDead: false,

    setCases(casesList) {
        this.cases = casesList || [];
        this.isLoaded = true;
    },

    setCase(index) {
        if (index >= 0 && index < this.cases.length) {
            this.currentCaseIndex = index;
            this.currentCase = this.cases[index];
            this.score = 0;
            this.activeExams = [];
            this.isPatientDead = false;
            
            if (timerState) {
                timerState.currentCase = this.currentCase;
            }
            if (lockSystem) {
                // Étanchéité inter-cas : les verrous déverrouillés d'un cas
                // ne fuient pas dans le suivant (clés namespacées + reset).
                const caseChanged = !lockSystem.currentCase || lockSystem.currentCase.id !== this.currentCase.id;
                lockSystem.currentCase = this.currentCase;
                if (caseChanged && typeof resetLocksForNewCase === 'function') {
                    resetLocksForNewCase();
                }
            }
            if (scoringState) {
                scoringState.currentCase = this.currentCase;
                scoringState.selectedTreatments = [];
                scoringState.attempts = 0;
                // Réinitialiser les overrides de contre-indications du cas précédent
                delete scoringState._fatalOverrideTreatments;
                // Réinitialiser le suivi de démarche clinique
                if (typeof resetDemarche === 'function') {
                    resetDemarche();
                }
            }
            // Réinitialiser la timeline de feedback
            if (uiState) {
                uiState.currentCase = this.currentCase;
            }
            if (typeof urgenceState !== 'undefined') {
                urgenceState.currentCase = this.currentCase;
                if (this.currentCase && this.currentCase.gameplayConfig && this.currentCase.gameplayConfig.startNode) {
                    urgenceState.isUrgenceMode = true;
                    urgenceState.currentUrgenceNode = this.currentCase.nodes[this.currentCase.gameplayConfig.startNode];
                    // Dispatcher l'événement pour l'agent urgence 3D
                    document.dispatchEvent(new CustomEvent('urgence-mode-activated', {
                        detail: { node: urgenceState.currentUrgenceNode, caseData: this.currentCase }
                    }));
                } else {
                    urgenceState.isUrgenceMode = false;
                    urgenceState.currentUrgenceNode = null;
                    // Dispatcher la désactivation
                    document.dispatchEvent(new CustomEvent('urgence-mode-deactivated'));
                }
            }
            
            // Événement global pour déclencher le préchargement prédictif d'assets et les mises à jour
            document.dispatchEvent(new CustomEvent('case-loaded', { detail: { caseData: this.currentCase } }));

            return this.currentCase;
        }
        return null;
    },

    /**
     * Avance à l'index suivant SANS charger le corps ni construire l'état.
     * Renvoie `true` s'il reste un cas, `null` si la session est terminée.
     * Le corps est ensuite résolu par `ensureCaseLoaded()` puis `setCase()`.
     */
    nextCase() {
        if (this.currentCaseIndex >= this.cases.length - 1) {
            return null;
        }
        this.currentCaseIndex++;
        return true;
    },

    /**
     * Charge le CORPS du cas `index` s'il ne l'est pas encore (chargement
     * paresseux). `cases[index]` peut être soit un descripteur léger
     * (`{ id, file }`), soit un corps complet déjà chargé.
     * @returns {Promise<object|null>} le corps complet du cas
     */
    async ensureCaseLoaded(index) {
        if (index < 0 || index >= this.cases.length) return null;
        const slot = this.cases[index];
        if (!slot) return null;

        // Corps déjà complet (chemin `?case=`, `preview`, single-case).
        if (slot.patient) return slot;

        if (typeof window.loadCaseBody !== 'function') return null;
        const body = await window.loadCaseBody(slot);
        if (body) {
            if (!body.id) body.id = slot.id;
            this.cases[index] = body;
        }
        return body;
    },

    setScore(points) {
        this.score = points;
        return this.score;
    },

    clearActiveExams() {
        this.activeExams = [];
    },

    reset() {
        this.currentCaseIndex = 0;
        this.currentCase = null;
        this.score = 0;
        this.activeExams = [];
        this.isPatientDead = false;
        if (this.vitalMonitorInstance) {
            this.vitalMonitorInstance.stopVitalUpdates();
            this.vitalMonitorInstance = null;
        }
    },

    hasNextCase() {
        return this.currentCaseIndex < this.cases.length - 1;
    }
};

window.gameState = gameState;
