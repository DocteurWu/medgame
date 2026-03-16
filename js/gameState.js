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
            
            if (timerState) {
                timerState.currentCase = this.currentCase;
            }
            if (lockSystem) {
                lockSystem.currentCase = this.currentCase;
            }
            if (scoringState) {
                scoringState.currentCase = this.currentCase;
                scoringState.selectedTreatments = [];
                scoringState.attempts = 0;
            }
            if (uiState) {
                uiState.currentCase = this.currentCase;
            }
            if (typeof urgenceState !== 'undefined') {
                urgenceState.currentCase = this.currentCase;
                if (this.currentCase && this.currentCase.gameplayConfig && this.currentCase.gameplayConfig.startNode && this.currentCase.nodes && this.currentCase.nodes[this.currentCase.gameplayConfig.startNode]) {
                    urgenceState.isUrgenceMode = true;
                    urgenceState.currentUrgenceNode = this.currentCase.nodes[this.currentCase.gameplayConfig.startNode];
                } else {
                    urgenceState.isUrgenceMode = false;
                    urgenceState.currentUrgenceNode = null;
                }
            }
            
            return this.currentCase;
        }
        return null;
    },

    nextCase() {
        this.currentCaseIndex++;
        if (this.currentCaseIndex >= this.cases.length) {
            return null;
        }
        return this.setCase(this.currentCaseIndex);
    },

    addScore(points) {
        this.score += points;
        return this.score;
    },

    setScore(points) {
        this.score = points;
        return this.score;
    },

    addActiveExam(exam) {
        if (!this.activeExams.includes(exam)) {
            this.activeExams.push(exam);
        }
    },

    clearActiveExams() {
        this.activeExams = [];
    },

    reset() {
        this.currentCaseIndex = 0;
        this.currentCase = null;
        this.score = 0;
        this.activeExams = [];
        if (this.vitalMonitorInstance) {
            this.vitalMonitorInstance.stopVitalUpdates();
            this.vitalMonitorInstance = null;
        }
    },

    hasNextCase() {
        return this.currentCaseIndex < this.cases.length - 1;
    },

    getProgress() {
        return {
            current: this.currentCaseIndex + 1,
            total: this.cases.length,
            percentage: this.cases.length > 0 ? Math.round((this.currentCaseIndex / this.cases.length) * 100) : 0
        };
    }
};

window.gameState = gameState;
