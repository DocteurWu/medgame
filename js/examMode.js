/**
 * js/examMode.js — Mode Examen pour MedGame
 *
 * - 10 cas consécutifs
 * - Chronomètre global (8 min par cas = 80 min total)
 * - Pas de lock challenges, pas de post-game quiz
 * - Compteur de progression + streak en temps réel
 * - Écran de résultats final avec classement localStorage
 * - Anti-replay : chaque cas ne peut être rejoué dans la même session
 */

const examMode = {
    isActive: false,
    totalCases: 10,
    casesQueue: [],
    currentIndex: 0,
    results: [],          // { caseId, score, correct, timeSpent, fatalError }
    globalTimeLimit: 0,   // en secondes (totalCases * timePerCase)
    globalTimeLeft: 0,
    globalTimerInterval: null,
    sessionKey: '',       // pour éviter les replays dans la même session

    /**
     * Initialiser le mode examen
     * @param {Array} cases - Liste de tous les cas disponibles
     */
    init(cases) {
        this.isActive = true;
        this.results = [];
        this.currentIndex = 0;

        // Sélectionner 10 cas aléatoirement (ou moins si pas assez)
        const shuffled = [...cases].sort(() => Math.random() - 0.5);
        this.casesQueue = shuffled.slice(0, Math.min(this.totalCases, shuffled.length));
        this.totalCases = this.casesQueue.length;

        // Timer global : 8 min par cas
        this.globalTimeLimit = this.totalCases * 8 * 60;
        this.globalTimeLeft = this.globalTimeLimit;

        // Session key pour anti-replay
        this.sessionKey = 'exam_' + Date.now();

        // Désactiver les locks pour l'examen
        if (typeof lockSystem !== 'undefined') {
            lockSystem.unlockedLocks = new Set();
            // On bypass les locks en les unlockant tous
            this.casesQueue.forEach(c => {
                if (c.locks) {
                    c.locks.forEach(l => lockSystem.unlockedLocks.add(l.id));
                }
            });
        }

        // Sauvegarder dans sessionStorage
        sessionStorage.setItem('examModeActive', 'true');
        sessionStorage.setItem('examModeQueue', JSON.stringify(this.casesQueue.map(c => c.id)));
        sessionStorage.setItem('examModeIndex', '0');
        sessionStorage.setItem('examModeResults', JSON.stringify([]));
        sessionStorage.setItem('examModeGlobalTime', String(this.globalTimeLimit));

        // Modifier le comportement du timer
        this.startGlobalTimer();

        // Afficher l'UI examen
        this.renderExamUI();

        return this.casesQueue;
    },

    /**
     * Reprendre un examen en cours (depuis sessionStorage)
     */
    resume() {
        const active = sessionStorage.getItem('examModeActive');
        if (active !== 'true') return false;

        try {
            this.isActive = true;
            this.currentIndex = parseInt(sessionStorage.getItem('examModeIndex')) || 0;
            this.results = JSON.parse(sessionStorage.getItem('examModeResults')) || [];
            this.globalTimeLeft = parseInt(sessionStorage.getItem('examModeGlobalTime')) || 0;
            this.totalCases = (JSON.parse(sessionStorage.getItem('examModeQueue')) || []).length;

            if (this.currentIndex >= this.totalCases) {
                this.finish();
                return false;
            }

            this.startGlobalTimer();
            this.renderExamUI();
            return true;
        } catch (e) {
            console.warn('[ExamMode] Resume failed:', e);
            return false;
        }
    },

    /**
     * Démarrer le timer global
     */
    startGlobalTimer() {
        if (this.globalTimerInterval) clearInterval(this.globalTimerInterval);

        this.globalTimerInterval = setInterval(() => {
            this.globalTimeLeft--;
            this.updateTimerUI();

            if (this.globalTimeLeft <= 0) {
                this.globalTimeLeft = 0;
                clearInterval(this.globalTimerInterval);
                this.finish();
            }
        }, 1000);
    },

    /**
     * Mettre à jour l'UI du timer global
     */
    updateTimerUI() {
        const minutes = Math.floor(this.globalTimeLeft / 60);
        const seconds = this.globalTimeLeft % 60;
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Remplacer le timer standard
        const timerEl = document.getElementById('timer');
        if (timerEl) {
            timerEl.textContent = timeStr;
            timerEl.classList.remove('warning', 'critical');
            if (this.globalTimeLeft <= 300) timerEl.classList.add('critical');
            else if (this.globalTimeLeft <= 600) timerEl.classList.add('warning');
        }

        const mobileTimer = document.getElementById('mobile-timer');
        if (mobileTimer) {
            mobileTimer.textContent = timeStr;
            mobileTimer.classList.remove('warning', 'critical');
            if (this.globalTimeLeft <= 300) mobileTimer.classList.add('critical');
            else if (this.globalTimeLeft <= 600) mobileTimer.classList.add('warning');
        }

        // Mettre à jour aussi l'UI examen
        const examTimer = document.getElementById('exam-global-timer');
        if (examTimer) {
            examTimer.textContent = timeStr;
            if (this.globalTimeLeft <= 300) examTimer.style.color = '#ff4757';
            else if (this.globalTimeLeft <= 600) examTimer.style.color = '#ffa500';
        }

        // Sauvegarder
        sessionStorage.setItem('examModeGlobalTime', String(this.globalTimeLeft));
    },

    /**
     * Enregistrer le résultat d'un cas
     */
    recordResult(caseId, score, correct, timeSpent, fatalError) {
        this.results.push({
            caseId,
            score,
            correct,
            timeSpent,
            fatalError
        });

        sessionStorage.setItem('examModeResults', JSON.stringify(this.results));

        // Mettre à jour l'UI
        this.updateProgressUI();
    },

    /**
     * Passer au cas suivant
     * @returns {boolean} true s'il y a un cas suivant
     */
    nextCase() {
        this.currentIndex++;
        sessionStorage.setItem('examModeIndex', String(this.currentIndex));

        if (this.currentIndex >= this.totalCases) {
            this.finish();
            return false;
        }

        return true;
    },

    /**
     * Terminer l'examen et afficher les résultats
     */
    finish() {
        if (this.globalTimerInterval) clearInterval(this.globalTimerInterval);
        this.isActive = false;

        sessionStorage.removeItem('examModeActive');
        sessionStorage.removeItem('examModeQueue');
        sessionStorage.removeItem('examModeIndex');
        sessionStorage.removeItem('examModeResults');
        sessionStorage.removeItem('examModeGlobalTime');

        this.showResultsScreen();
    },

    /**
     * Afficher l'écran de résultats final
     */
    showResultsScreen() {
        const totalCorrect = this.results.filter(r => r.correct).length;
        const totalScore = this.results.reduce((sum, r) => sum + r.score, 0);
        const avgScore = this.results.length > 0 ? Math.round(totalScore / this.results.length) : 0;
        const timeUsed = this.globalTimeLimit - this.globalTimeLeft;
        const fatalErrors = this.results.filter(r => r.fatalError).length;

        // Calcul des étoiles
        let stars = 0;
        if (avgScore >= 90 && fatalErrors === 0) stars = 3;
        else if (avgScore >= 70 && fatalErrors === 0) stars = 2;
        else if (avgScore >= 50) stars = 1;

        // Sauvegarder dans le classement
        const leaderboardEntry = {
            date: new Date().toISOString(),
            score: avgScore,
            correct: totalCorrect,
            total: this.totalCases,
            timeUsed,
            stars,
            fatalErrors
        };

        this.saveToLeaderboard(leaderboardEntry);

        // Obtenir le rang
        const rank = this.getRank(leaderboardEntry);

        // Créer l'écran de résultats
        const overlay = document.createElement('div');
        overlay.id = 'exam-results-overlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 10000;
            background: rgba(0,0,0,0.92); backdrop-filter: blur(12px);
            display: flex; align-items: center; justify-content: center;
            overflow-y: auto; padding: 20px;
        `;

        const minutes = Math.floor(timeUsed / 60);
        const seconds = timeUsed % 60;

        // Résultats par cas
        let casesHtml = this.results.map((r, i) => {
            const icon = r.correct ? '✅' : r.fatalError ? '💀' : '❌';
            const color = r.correct ? '#2ecc71' : r.fatalError ? '#e74c3c' : '#ff4757';
            const min = Math.floor(r.timeSpent / 60);
            const sec = r.timeSpent % 60;
            return `
                <div style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:rgba(255,255,255,0.03); border-radius:8px; border-left: 3px solid ${color};">
                    <span style="font-size:1.2rem;">${icon}</span>
                    <span style="flex:1; font-size:0.9rem;">Cas ${i + 1}</span>
                    <span style="color:${color}; font-weight:700;">${r.score}%</span>
                    <span style="color:rgba(255,255,255,0.3); font-size:0.8rem;">${min}m${sec.toString().padStart(2, '0')}s</span>
                </div>
            `;
        }).join('');

        let starsHtml = '';
        for (let i = 1; i <= 3; i++) {
            const filled = i <= stars;
            starsHtml += `<i class="fa${filled ? 's' : 'r'} fa-star" style="font-size: 2.5rem; color: ${filled ? '#ffc107' : 'rgba(255,255,255,0.1)'}; text-shadow: ${filled ? '0 0 20px rgba(255,193,7,0.5)' : 'none'};"></i> `;
        }

        const rankText = rank ? `🏅 Rang #${rank.position} sur ${rank.total}` : '';

        overlay.innerHTML = `
            <div style="max-width: 600px; width: 100%; background: linear-gradient(135deg, rgba(20,20,40,0.98), rgba(30,30,60,0.98)); border-radius: 24px; border: 2px solid rgba(0,242,254,0.3); padding: 40px; box-shadow: 0 0 80px rgba(0,242,254,0.15);">
                <div style="text-align:center; margin-bottom: 30px;">
                    <div style="font-size: 3rem; margin-bottom: 10px;">📋</div>
                    <h1 style="font-family: 'Outfit', sans-serif; font-size: 2rem; font-weight: 900; margin: 0 0 5px; background: linear-gradient(135deg, #4facfe, #00f2fe); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">EXAMEN TERMINÉ</h1>
                    <p style="color: rgba(255,255,255,0.5); font-size: 0.9rem;">${this.totalCases} cas · ${minutes}m${seconds.toString().padStart(2, '0')}s utilisées</p>
                </div>

                <div style="display:flex; justify-content:center; gap: 15px; margin-bottom: 25px;">
                    ${starsHtml}
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 25px;">
                    <div style="text-align:center; padding: 15px; background: rgba(46,204,113,0.08); border-radius: 12px; border: 1px solid rgba(46,204,113,0.2);">
                        <div style="font-size: 2rem; font-weight: 900; color: #2ecc71; font-family: 'Outfit', sans-serif;">${totalCorrect}/${this.totalCases}</div>
                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5); text-transform: uppercase;">Réussis</div>
                    </div>
                    <div style="text-align:center; padding: 15px; background: rgba(79,172,254,0.08); border-radius: 12px; border: 1px solid rgba(79,172,254,0.2);">
                        <div style="font-size: 2rem; font-weight: 900; color: #4facfe; font-family: 'Outfit', sans-serif;">${avgScore}%</div>
                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5); text-transform: uppercase;">Moyenne</div>
                    </div>
                    <div style="text-align:center; padding: 15px; background: rgba(255,71,87,0.08); border-radius: 12px; border: 1px solid rgba(255,71,87,0.2);">
                        <div style="font-size: 2rem; font-weight: 900; color: ${fatalErrors > 0 ? '#ff4757' : '#2ecc71'}; font-family: 'Outfit', sans-serif;">${fatalErrors}</div>
                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5); text-transform: uppercase;">Erreurs fatales</div>
                    </div>
                </div>

                ${rankText ? `<div style="text-align:center; margin-bottom: 20px; padding: 10px; background: linear-gradient(90deg, rgba(255,215,0,0.08), rgba(255,215,0,0.02)); border: 1px solid rgba(255,215,0,0.2); border-radius: 10px;">
                    <span style="font-size: 1.1rem; font-weight: 700; color: #ffd700;">${rankText}</span>
                </div>` : ''}

                <div style="margin-bottom: 25px;">
                    <h3 style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 2px; color: rgba(255,255,255,0.4); margin-bottom: 12px;">Détail par cas</h3>
                    <div style="display: flex; flex-direction: column; gap: 6px; max-height: 250px; overflow-y: auto;">
                        ${casesHtml}
                    </div>
                </div>

                <div style="display: flex; gap: 12px;">
                    <button id="exam-retry-btn" style="flex:1; padding: 14px; background: linear-gradient(135deg, #4facfe, #00f2fe); color: #000; border: none; border-radius: 12px; font-weight: 800; font-size: 1rem; cursor: pointer; letter-spacing: 1px; transition: transform 0.2s;">
                        <i class="fas fa-redo"></i> REJOUER
                    </button>
                    <button id="exam-home-btn" style="flex:1; padding: 14px; background: rgba(255,255,255,0.06); color: #fff; border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; font-weight: 700; font-size: 1rem; cursor: pointer; transition: transform 0.2s;">
                        <i class="fas fa-home"></i> ACCUEIL
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('#exam-retry-btn').addEventListener('click', () => {
            overlay.remove();
            window.location.href = 'exam.html';
        });

        overlay.querySelector('#exam-home-btn').addEventListener('click', () => {
            overlay.remove();
            window.location.href = 'index.html';
        });

        // Son de fin
        if (typeof MedGameAudio !== 'undefined') {
            if (stars >= 2) MedGameAudio.play('complete');
            else MedGameAudio.play('alert');
        }
    },

    /**
     * Sauvegarder dans le classement localStorage
     */
    saveToLeaderboard(entry) {
        try {
            const leaderboard = JSON.parse(localStorage.getItem('medgame_exam_leaderboard') || '[]');
            leaderboard.push(entry);
            // Garder les 50 meilleurs
            leaderboard.sort((a, b) => b.score - a.score || a.timeUsed - b.timeUsed);
            localStorage.setItem('medgame_exam_leaderboard', JSON.stringify(leaderboard.slice(0, 50)));
        } catch (e) {
            console.warn('[ExamMode] Leaderboard save failed:', e);
        }
    },

    /**
     * Obtenir le rang d'une entrée
     */
    getRank(entry) {
        try {
            const leaderboard = JSON.parse(localStorage.getItem('medgame_exam_leaderboard') || '[]');
            leaderboard.sort((a, b) => b.score - a.score || a.timeUsed - b.timeUsed);
            const position = leaderboard.findIndex(e =>
                e.date === entry.date && e.score === entry.score
            ) + 1;
            return position > 0 ? { position, total: leaderboard.length } : null;
        } catch (e) {
            return null;
        }
    },

    /**
     * Rendre l'UI spécifique au mode examen
     */
    renderExamUI() {
        // Injecter la barre de progression examen
        let examBar = document.getElementById('exam-progress-bar');
        if (!examBar) {
            examBar = document.createElement('div');
            examBar.id = 'exam-progress-bar';
            examBar.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; z-index: 999;
                background: rgba(0,0,0,0.9); backdrop-filter: blur(8px);
                padding: 8px 20px; display: flex; align-items: center; justify-content: space-between;
                border-bottom: 1px solid rgba(0,242,254,0.2);
                font-family: 'Outfit', sans-serif;
            `;
            document.body.insertBefore(examBar, document.body.firstChild);

            // Ajuster le body padding
            document.body.style.paddingTop = '42px';
        }

        this.updateProgressUI();
    },

    /**
     * Mettre à jour la barre de progression
     */
    updateProgressUI() {
        const examBar = document.getElementById('exam-progress-bar');
        if (!examBar) return;

        const correctCount = this.results.filter(r => r.correct).length;
        const pct = this.totalCases > 0 ? Math.round((this.currentIndex / this.totalCases) * 100) : 0;

        examBar.innerHTML = `
            <div style="display:flex; align-items:center; gap: 15px;">
                <span style="font-weight: 800; color: #ff4757; font-size: 0.9rem;">
                    <i class="fas fa-clipboard-check"></i> EXAMEN
                </span>
                <span style="color: rgba(255,255,255,0.6); font-size: 0.85rem;">
                    Cas ${this.currentIndex + 1}/${this.totalCases}
                </span>
                <div style="width: 120px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                    <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #4facfe, #00f2fe); border-radius: 2px; transition: width 0.5s ease;"></div>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap: 15px;">
                <span style="color: #2ecc71; font-size: 0.85rem;">
                    <i class="fas fa-check"></i> ${correctCount} réussis
                </span>
                <span id="exam-global-timer" style="font-weight: 700; font-size: 1rem; color: #fff; font-variant-numeric: tabular-nums;">
                    ${Math.floor(this.globalTimeLeft / 60).toString().padStart(2, '0')}:${(this.globalTimeLeft % 60).toString().padStart(2, '0')}
                </span>
            </div>
        `;
    },

    /**
     * Vérifier si le mode examen est actif
     */
    isExamActive() {
        return sessionStorage.getItem('examModeActive') === 'true';
    },

    /**
     * Obtenir le cas actuel depuis la queue
     */
    getCurrentCase() {
        if (this.currentIndex < this.casesQueue.length) {
            return this.casesQueue[this.currentIndex];
        }
        return null;
    },

    /**
     * Nettoyer (quitter l'examen prématurément)
     */
    abort() {
        if (this.globalTimerInterval) clearInterval(this.globalTimerInterval);
        this.isActive = false;
        sessionStorage.removeItem('examModeActive');
        sessionStorage.removeItem('examModeQueue');
        sessionStorage.removeItem('examModeIndex');
        sessionStorage.removeItem('examModeResults');
        sessionStorage.removeItem('examModeGlobalTime');
        document.body.style.paddingTop = '';
        const bar = document.getElementById('exam-progress-bar');
        if (bar) bar.remove();
    }
};

window.examMode = examMode;
