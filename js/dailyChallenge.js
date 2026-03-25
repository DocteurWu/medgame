/**
 * js/dailyChallenge.js — Défi du Jour Medgame
 *
 * Sélectionne un cas clinique comme "défi quotidien" basé sur la date.
 * - Changement automatique chaque jour (hash de la date)
 * - Bonus XP +50% si complété dans la journée
 * - Série de défis consécutifs (daily streak)
 * - Stockage localStorage
 */

const dailyChallenge = {
    // État
    todayCaseId: null,
    todayTheme: null,
    completedToday: false,
    dailyStreak: 0,
    bestDailyStreak: 0,
    lastCompletedDate: null,

    // Config
    BONUS_XP_PERCENT: 50, // +50% XP
    STORAGE_KEY: 'medgame_daily_challenge',

    /**
     * Initialiser le module
     */
    init() {
        this._loadState();
        this._selectTodayCase();
        this._checkStreak();
        this.renderUI();
    },

    /**
     * Charger l'état depuis localStorage
     */
    _loadState() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                this.dailyStreak = data.dailyStreak || 0;
                this.bestDailyStreak = data.bestDailyStreak || 0;
                this.lastCompletedDate = data.lastCompletedDate || null;

                // Vérifier si le défi d'aujourd'hui est déjà complété
                const today = this._getTodayKey();
                this.completedToday = data.lastCompletedDate === today;
            }
        } catch (e) {
            console.warn('[DailyChallenge] Erreur de chargement:', e);
        }
    },

    /**
     * Sauvegarder l'état
     */
    _save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
                dailyStreak: this.dailyStreak,
                bestDailyStreak: this.bestDailyStreak,
                lastCompletedDate: this.lastCompletedDate
            }));
        } catch (e) {
            console.warn('[DailyChallenge] Erreur de sauvegarde:', e);
        }
    },

    /**
     * Obtenir la clé de date du jour (YYYY-MM-DD)
     */
    _getTodayKey() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    },

    /**
     * Hash simple d'une string → nombre positif
     */
    _hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit int
        }
        return Math.abs(hash);
    },

    /**
     * Sélectionner le cas du jour basé sur la date
     */
    _selectTodayCase() {
        const todayKey = this._getTodayKey();
        const hash = this._hashString(todayKey);

        // Récupérer tous les cas disponibles
        const allCases = this._getAllCaseIds();
        if (allCases.length === 0) {
            console.warn('[DailyChallenge] Aucun cas disponible');
            return;
        }

        // Sélection déterministe basée sur la date
        const index = hash % allCases.length;
        const selected = allCases[index];

        this.todayCaseId = selected.id;
        this.todayTheme = selected.theme;
    },

    /**
     * Récupérer tous les cas disponibles (depuis case-index.json ou Supabase)
     */
    _getAllCaseIds() {
        // Essayer d'abord les cas Supabase en cache
        if (window.allSupabaseCases && window.allSupabaseCases.length > 0) {
            return window.allSupabaseCases.map(c => ({
                id: c.id,
                theme: c.specialty || 'autre'
            }));
        }

        // Sinon, retourner un tableau vide (sera peuplé plus tard)
        return [];
    },

    /**
     * Vérifier et mettre à jour la daily streak
     */
    _checkStreak() {
        const today = this._getTodayKey();
        const yesterday = this._getYesterdayKey();

        if (this.lastCompletedDate === today) {
            // Déjà complété aujourd'hui, streak maintenue
            return;
        }

        if (this.lastCompletedDate === yesterday) {
            // Streak continue si on complète aujourd'hui
            // (pas de changement tant qu'on n'a pas complété)
        } else if (this.lastCompletedDate && this.lastCompletedDate !== today) {
            // Streak cassée (manqué un ou plusieurs jours)
            if (!this.completedToday) {
                this.dailyStreak = 0;
                this._save();
            }
        }
    },

    /**
     * Obtenir la clé d'hier
     */
    _getYesterdayKey() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    },

    /**
     * Enregistrer la complétion du défi du jour
     * @returns {object} { bonusXp, newStreak }
     */
    recordCompletion(baseXp) {
        const today = this._getTodayKey();
        if (this.lastCompletedDate === today) {
            return { bonusXp: 0, newStreak: this.dailyStreak, alreadyCompleted: true };
        }

        // Calculer la streak
        const yesterday = this._getYesterdayKey();
        if (this.lastCompletedDate === yesterday) {
            this.dailyStreak++;
        } else {
            this.dailyStreak = 1; // Reset ou premier défi
        }

        if (this.dailyStreak > this.bestDailyStreak) {
            this.bestDailyStreak = this.dailyStreak;
        }

        this.lastCompletedDate = today;
        this.completedToday = true;

        // Calculer le bonus XP
        const bonusXp = Math.round(baseXp * this.BONUS_XP_PERCENT / 100);

        this._save();
        this.renderUI();

        return { bonusXp, newStreak: this.dailyStreak };
    },

    /**
     * Vérifier si un cas donné est le défi du jour
     */
    isTodaysChallenge(caseId) {
        return caseId === this.todayCaseId;
    },

    /**
     * Obtenir les infos du défi du jour
     */
    getTodayInfo() {
        return {
            caseId: this.todayCaseId,
            theme: this.todayTheme,
            completed: this.completedToday,
            streak: this.dailyStreak,
            bestStreak: this.bestDailyStreak,
            bonusPercent: this.BONUS_XP_PERCENT
        };
    },

    /**
     * Rendre l'UI dans la page d'accueil
     */
    renderUI() {
        // Section défi du jour sur l'accueil
        const container = document.getElementById('daily-challenge-section');
        if (!container) return;

        const info = this.getTodayInfo();
        if (!info.caseId) {
            container.style.display = 'none';
            return;
        }

        const statusIcon = info.completed ? '✅' : '🎯';
        const statusText = info.completed ? 'Défi complété !' : 'Défi du jour disponible';
        const streakText = info.streak > 0 ? `🔥 Série: ${info.streak} jour${info.streak > 1 ? 's' : ''}` : '';
        const themeEmoji = this._getThemeEmoji(info.theme);

        container.innerHTML = `
            <div class="daily-challenge-card" id="daily-challenge-card" role="button" tabindex="0"
                 aria-label="${info.completed ? 'Défi du jour complété' : 'Lancer le défi du jour'}">
                <div class="dc-glow"></div>
                <div class="dc-header">
                    <span class="dc-badge">${statusIcon} DÉFI DU JOUR</span>
                    ${streakText ? `<span class="dc-streak">${streakText}</span>` : ''}
                </div>
                <div class="dc-body">
                    <span class="dc-theme-emoji">${themeEmoji}</span>
                    <div class="dc-info">
                        <span class="dc-theme">${this._formatThemeName(info.theme)}</span>
                        <span class="dc-bonus">+${info.bonusPercent}% XP</span>
                    </div>
                </div>
                <div class="dc-footer">
                    <span class="dc-status ${info.completed ? 'completed' : ''}">${statusText}</span>
                    ${!info.completed ? '<i class="fas fa-arrow-right dc-arrow"></i>' : ''}
                </div>
            </div>
        `;

        // Attacher le click handler
        const card = document.getElementById('daily-challenge-card');
        if (card && !info.completed) {
            card.addEventListener('click', () => this._startDailyChallenge());
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._startDailyChallenge();
                }
            });
        }
    },

    /**
     * Lancer le défi du jour
     */
    _startDailyChallenge() {
        if (!this.todayCaseId) return;

        const caseId = this.todayCaseId;

        // Utiliser le mécanisme localStorage existant pour charger le cas
        localStorage.setItem('selectedCaseFiles', JSON.stringify([caseId]));

        // Naviguer vers game.html
        window.location.href = 'game.html';
    },

    /**
     * Obtenir l'emoji d'une spécialité
     */
    _getThemeEmoji(theme) {
        const emojiMap = {
            'cardiologie': '❤️', 'cardio': '❤️',
            'neurosensorielle': '👁️', 'neuro': '🧠',
            'urgences': '🚑', 'urgence': '🚑',
            'endocrinologie': '🧪', 'edn': '🧪',
            'uro-nephrologie': '🚻', 'uronephro': '🚻', 'nephro': '🚻', 'uro': '🚻',
            'pneumologie': '🫁', 'pneumo': '🫁',
            'locomoteur': '🦴',
            'orl': '👂',
            'digestif': '🫄',
            'autre': '📋'
        };
        const key = (theme || 'autre').toLowerCase();
        return emojiMap[key] || '📋';
    },

    /**
     * Formater le nom du thème
     */
    _formatThemeName(theme) {
        if (!theme) return 'Général';
        const nameMap = {
            'cardio': 'Cardiologie',
            'neuro': 'Neurologie',
            'urgence': 'Urgences',
            'edn': 'Endocrinologie',
            'nephro': 'Néphrologie',
            'uro': 'Urologie',
            'pneumo': 'Pneumologie',
            'digestif': 'Digestif',
            'locomoteur': 'Locomoteur',
            'orl': 'ORL'
        };
        const key = theme.toLowerCase();
        return nameMap[key] || theme.charAt(0).toUpperCase() + theme.slice(1);
    },

    /**
     * Afficher la notification de bonus XP
     */
    showBonusNotification(bonusXp, streak) {
        if (typeof showNotification === 'function') {
            showNotification(`🎯 Défi du Jour complété ! +${bonusXp} XP bonus | 🔥 Série: ${streak} jour${streak > 1 ? 's' : ''}`);
        }

        // Animation visuelle
        const overlay = document.createElement('div');
        overlay.className = 'daily-bonus-overlay';
        overlay.innerHTML = `
            <div class="daily-bonus-card">
                <div class="db-icon">🎯</div>
                <h2 class="db-title">Défi du Jour Complété !</h2>
                <div class="db-bonus">+${bonusXp} XP Bonus</div>
                <div class="db-streak">🔥 Série quotidienne: ${streak}</div>
                <button class="db-close">CONTINUER</button>
            </div>
        `;
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 10001;
            background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
            display: flex; align-items: center; justify-content: center;
            animation: fadeIn 0.3s ease;
        `;

        const card = overlay.querySelector('.daily-bonus-card');
        card.style.cssText = `
            background: linear-gradient(135deg, rgba(10,20,40,0.95), rgba(20,30,60,0.95));
            border: 2px solid #ffd700;
            border-radius: 20px; padding: 40px; text-align: center;
            box-shadow: 0 0 60px rgba(255,215,0,0.3);
            animation: milestoneScaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            max-width: 380px; width: 90%;
        `;

        const icon = overlay.querySelector('.db-icon');
        icon.style.cssText = `font-size: 3.5rem; margin-bottom: 12px;`;

        const title = overlay.querySelector('.db-title');
        title.style.cssText = `font-family: 'Outfit', sans-serif; font-size: 1.6rem; font-weight: 800; color: #ffd700; margin-bottom: 12px; letter-spacing: 1px;`;

        const bonus = overlay.querySelector('.db-bonus');
        bonus.style.cssText = `font-size: 2rem; font-weight: 900; color: #4facfe; margin-bottom: 8px;`;

        const streakEl = overlay.querySelector('.db-streak');
        streakEl.style.cssText = `font-size: 1rem; color: rgba(255,255,255,0.7); margin-bottom: 20px;`;

        const btn = overlay.querySelector('.db-close');
        btn.style.cssText = `
            background: linear-gradient(135deg, #ffd700, #ffaa00); color: #000; border: none;
            padding: 12px 32px; border-radius: 30px; font-weight: 800;
            font-size: 1rem; cursor: pointer; letter-spacing: 1px;
            transition: transform 0.2s;
        `;
        btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
        btn.onmouseout = () => btn.style.transform = 'scale(1)';

        document.body.appendChild(overlay);

        btn.addEventListener('click', () => {
            overlay.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => overlay.remove(), 300);
        });

        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => overlay.remove(), 300);
            }
        }, 6000);
    },

    /**
     * Réinitialiser (debug/admin)
     */
    reset() {
        this.dailyStreak = 0;
        this.bestDailyStreak = 0;
        this.lastCompletedDate = null;
        this.completedToday = false;
        this._save();
        this.renderUI();
    }
};

// Expose globalement
window.dailyChallenge = dailyChallenge;

// CSS injecté
(function injectDailyChallengeCSS() {
    const css = `
        /* Daily Challenge Card */
        .daily-challenge-card {
            position: relative;
            background: linear-gradient(135deg, rgba(20, 25, 50, 0.9), rgba(30, 35, 70, 0.9));
            border: 1px solid rgba(255, 215, 0, 0.3);
            border-radius: 16px;
            padding: 18px 20px;
            cursor: pointer;
            transition: all 0.3s ease;
            overflow: hidden;
            margin: 12px 0;
        }
        .daily-challenge-card:hover {
            border-color: rgba(255, 215, 0, 0.6);
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(255, 215, 0, 0.15);
        }
        .daily-challenge-card:focus-visible {
            outline: 2px solid #ffd700;
            outline-offset: 2px;
        }
        .dc-glow {
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255, 215, 0, 0.05) 0%, transparent 60%);
            animation: dcGlow 4s ease-in-out infinite;
            pointer-events: none;
        }
        @keyframes dcGlow {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(10%, 10%); }
        }
        .dc-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
            position: relative;
        }
        .dc-badge {
            font-family: 'Outfit', sans-serif;
            font-size: 0.7rem;
            font-weight: 800;
            letter-spacing: 2px;
            color: #ffd700;
            background: rgba(255, 215, 0, 0.1);
            border: 1px solid rgba(255, 215, 0, 0.2);
            padding: 4px 10px;
            border-radius: 20px;
        }
        .dc-streak {
            font-size: 0.75rem;
            color: #ff6b35;
            font-weight: 600;
        }
        .dc-body {
            display: flex;
            align-items: center;
            gap: 14px;
            margin-bottom: 12px;
            position: relative;
        }
        .dc-theme-emoji {
            font-size: 2rem;
            line-height: 1;
        }
        .dc-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .dc-theme {
            font-family: 'Outfit', sans-serif;
            font-size: 1rem;
            font-weight: 700;
            color: #fff;
        }
        .dc-bonus {
            font-size: 0.8rem;
            font-weight: 700;
            color: #4facfe;
        }
        .dc-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: relative;
        }
        .dc-status {
            font-size: 0.8rem;
            color: rgba(255, 255, 255, 0.5);
            font-weight: 500;
        }
        .dc-status.completed {
            color: #2ecc71;
        }
        .dc-arrow {
            color: #ffd700;
            font-size: 0.9rem;
            animation: dcArrowBounce 1.5s ease-in-out infinite;
        }
        @keyframes dcArrowBounce {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(5px); }
        }

        /* Daily badge in game page */
        .daily-game-badge {
            position: fixed;
            top: 12px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 900;
            background: linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 170, 0, 0.15));
            border: 1px solid rgba(255, 215, 0, 0.4);
            border-radius: 30px;
            padding: 6px 18px;
            font-family: 'Outfit', sans-serif;
            font-size: 0.75rem;
            font-weight: 700;
            color: #ffd700;
            letter-spacing: 1px;
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .daily-game-badge .db-xp {
            color: #4facfe;
        }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
})();
