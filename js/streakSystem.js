/**
 * js/streakSystem.js — Système de Streak (série de succès consécutifs)
 *
 * - Compteur de streak visible (top-bar, sidebar, mobile)
 * - Multiplicateur XP basé sur la streak (x1, x1.5, x2, x3...)
 * - Jalons (milestones) : 3, 5, 10, 15, 20 cas consécutifs
 * - Célébrations visuelles (confetti, animations)
 * - Sauvegarde dans localStorage
 */

const streakSystem = {
    currentStreak: 0,
    bestStreak: 0,
    multiplier: 1.0, // visual only - no XP bonus
    lastCaseId: null,

    // Jalons : { streak: { label, icon, color, xpBonus } }
    milestones: {
        3:  { label: 'Hat-trick !',       icon: '🔥', color: '#ff6b35', xpBonus: 10 },
        5:  { label: 'En feu !',          icon: '⚡', color: '#ffd700', xpBonus: 25 },
        7:  { label: 'Inarrêtable !',     icon: '💎', color: '#00d2ff', xpBonus: 40 },
        10: { label: 'Légende !',         icon: '👑', color: '#a020f0', xpBonus: 75 },
        15: { label: 'Mythique !',        icon: '🌟', color: '#ff1493', xpBonus: 120 },
        20: { label: 'DIVIN !',           icon: '🏆', color: '#ffd700', xpBonus: 200 }
    },

    /**
     * Initialiser depuis localStorage
     */
    init() {
        try {
            const saved = localStorage.getItem('medgame_streak');
            if (saved) {
                const data = JSON.parse(saved);
                this.currentStreak = data.currentStreak || 0;
                this.bestStreak = data.bestStreak || 0;
                this.lastCaseId = data.lastCaseId || null;
            }
        } catch (e) {
            console.warn('[StreakSystem] Erreur de chargement:', e);
        }
        this.updateMultiplier();
        this.renderUI();
    },

    /**
     * Sauvegarder dans localStorage
     */
    save() {
        try {
            localStorage.setItem('medgame_streak', JSON.stringify({
                currentStreak: this.currentStreak,
                bestStreak: this.bestStreak,
                lastCaseId: this.lastCaseId
            }));
        } catch (e) {
            console.warn('[StreakSystem] Erreur de sauvegarde:', e);
        }
    },

    /**
     * Enregistrer une victoire
     * @param {string} caseId - ID du cas réussi
     * @returns {object} { milestone, newStreak, multiplier }
     */
    recordWin(caseId) {
        this.currentStreak++;
        if (this.currentStreak > this.bestStreak) {
            this.bestStreak = this.currentStreak;
        }
        this.lastCaseId = caseId;
        this.updateMultiplier();

        const milestone = this.milestones[this.currentStreak] || null;

        this.save();
        this.renderUI();

        if (milestone) {
            this.showMilestoneCelebration(milestone);
        }

        // Animation du compteur
        this.animateStreakUp();

        return {
            milestone,
            newStreak: this.currentStreak,
            multiplier: this.multiplier
        };
    },

    /**
     * Enregistrer un échec (casse la streak)
     * @returns {object} { lostStreak, bestStreak }
     */
    recordLoss() {
        const lostStreak = this.currentStreak;
        this.currentStreak = 0;
        this.updateMultiplier();
        this.save();
        this.renderUI();

        if (lostStreak >= 3) {
            this.showStreakBroken(lostStreak);
        }

        return {
            lostStreak,
            bestStreak: this.bestStreak
        };
    },

    /**
     * Calculer le multiplicateur basé sur la streak
     */
    updateMultiplier() {
        // No XP multiplier - visual streak only
        // No XP multiplier - visual streak only
        // No XP multiplier - visual streak only
        // No XP multiplier - visual streak only
        // No XP multiplier - visual streak only
        // No XP multiplier - visual streak only
        // No XP multiplier - visual streak only
    },

    /**
     * Appliquer le multiplicateur à l'XP
     */

    /**
     * Obtenir la couleur de la streak actuelle
     */
    getStreakColor() {
        if (this.currentStreak >= 20) return '#ffd700';
        if (this.currentStreak >= 15) return '#ff1493';
        if (this.currentStreak >= 10) return '#a020f0';
        if (this.currentStreak >= 7) return '#00d2ff';
        if (this.currentStreak >= 5) return '#ffd700';
        if (this.currentStreak >= 3) return '#ff6b35';
        return '#fff';
    },

    /**
     * Obtenir l'icône de la streak
     */
    getStreakIcon() {
        if (this.currentStreak >= 20) return '🏆';
        if (this.currentStreak >= 15) return '🌟';
        if (this.currentStreak >= 10) return '👑';
        if (this.currentStreak >= 7) return '💎';
        if (this.currentStreak >= 5) return '⚡';
        if (this.currentStreak >= 3) return '🔥';
        return '🎯';
    },

    /**
     * Obtenir le prochain jalon
     */
    getNextMilestone() {
        const milestoneKeys = Object.keys(this.milestones).map(Number).sort((a, b) => a - b);
        for (const key of milestoneKeys) {
            if (key > this.currentStreak) {
                return { streak: key, ...this.milestones[key] };
            }
        }
        return null;
    },

    /**
     * Mettre à jour l'UI (tous les éléments streak)
     */
    renderUI() {
        const color = this.getStreakColor();
        const icon = this.getStreakIcon();

        // Top bar streak display
        const topStreak = document.getElementById('streak-display');
        if (topStreak) {
            topStreak.innerHTML = this.currentStreak > 0
                ? `<span class="streak-icon">${icon}</span> <span class="streak-count" style="color:${color}">${this.currentStreak}</span> ${this.multiplier > 1 ? `<span class="streak-multiplier">x${this.multiplier}</span>` : ''}`
                : `<span class="streak-icon" style="opacity:0.4">🎯</span> <span class="streak-count" style="opacity:0.4">0</span>`;
            topStreak.title = `Streak: ${this.currentStreak} | Meilleure: ${this.bestStreak}`;
        }

        // Sidebar streak
        const sidebarStreak = document.getElementById('sidebar-streak');
        if (sidebarStreak) {
            sidebarStreak.innerHTML = this.currentStreak > 0
                ? `<div class="sidebar-streak-inner">
                       <span class="streak-icon-lg">${icon}</span>
                       <div>
                           <div class="streak-number" style="color:${color}">${this.currentStreak}</div>
                           <div class="streak-label">streak</div>
                       </div>
                       ${this.multiplier > 1 ? `<span class="streak-mult-badge" style="background:${color}20; border-color:${color}">x${this.multiplier}</span>` : ''}
                   </div>`
                : `<div class="sidebar-streak-inner" style="opacity:0.4">
                       <span class="streak-icon-lg">🎯</span>
                       <div>
                           <div class="streak-number">0</div>
                           <div class="streak-label">streak</div>
                       </div>
                   </div>`;
        }

        // Next milestone hint
        const nextMilestone = this.getNextMilestone();
        const milestoneHint = document.getElementById('streak-milestone-hint');
        if (milestoneHint && nextMilestone) {
            const remaining = nextMilestone.streak - this.currentStreak;
            milestoneHint.innerHTML = `<i class="fas fa-flag-checkered"></i> Plus que <strong>${remaining}</strong> pour <span style="color:${nextMilestone.color}">${nextMilestone.icon} ${nextMilestone.label}</span>`;
        } else if (milestoneHint) {
            milestoneHint.innerHTML = '';
        }

        // Mobile compact
        const mobileStreak = document.getElementById('mobile-streak');
        if (mobileStreak) {
            mobileStreak.innerHTML = this.currentStreak > 0
                ? `${icon} ${this.currentStreak}${this.multiplier > 1 ? ` <small>x${this.multiplier}</small>` : ''}`
                : '';
            mobileStreak.style.display = this.currentStreak > 0 ? '' : 'none';
        }

        // Best streak display
        const bestStreak = document.getElementById('best-streak-display');
        if (bestStreak) {
            bestStreak.textContent = this.bestStreak > 0 ? `🏆 Record: ${this.bestStreak}` : '';
        }
    },

    /**
     * Animation quand la streak monte
     */
    animateStreakUp() {
        const el = document.getElementById('streak-display');
        if (!el) return;

        el.classList.add('streak-pulse');
        setTimeout(() => el.classList.remove('streak-pulse'), 600);

        // Popup flottant
        const popup = document.createElement('div');
        popup.className = 'streak-popup';
        popup.textContent = `+1 🔥`;
        popup.style.cssText = `
            position: fixed;
            top: 60px;
            right: 30px;
            font-size: 1.5rem;
            font-weight: 800;
            color: ${this.getStreakColor()};
            z-index: 9999;
            pointer-events: none;
            text-shadow: 0 0 10px ${this.getStreakColor()}40;
            animation: streakPopupFloat 1.5s ease-out forwards;
        `;
        document.body.appendChild(popup);
        setTimeout(() => popup.remove(), 1500);
    },

    /**
     * Célébration de jalon atteint
     */
    showMilestoneCelebration(milestone) {
        // Overlay de célébration
        const overlay = document.createElement('div');
        overlay.className = 'milestone-overlay';
        overlay.innerHTML = `
            <div class="milestone-card" style="--milestone-color: ${milestone.color}">
                <div class="milestone-icon">${milestone.icon}</div>
                <h2 class="milestone-title" style="color: ${milestone.color}">${milestone.label}</h2>
                <div class="milestone-streak">${this.currentStreak} cas consécutifs !</div>
                <div class="milestone-xp">+${milestone.xpBonus} XP bonus</div>
                <div class="milestone-multiplier">Multiplicateur: x${this.multiplier}</div>
                <button class="milestone-close-btn">CONTINUER</button>
            </div>
        `;
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 10000;
            background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
            display: flex; align-items: center; justify-content: center;
            animation: fadeIn 0.3s ease;
        `;

        const card = overlay.querySelector('.milestone-card');
        card.style.cssText = `
            background: linear-gradient(135deg, rgba(20,20,40,0.95), rgba(30,30,60,0.95));
            border: 2px solid ${milestone.color};
            border-radius: 20px; padding: 40px; text-align: center;
            box-shadow: 0 0 60px ${milestone.color}40;
            animation: milestoneScaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            max-width: 400px; width: 90%;
        `;

        const icon = overlay.querySelector('.milestone-icon');
        icon.style.cssText = `font-size: 4rem; margin-bottom: 15px; animation: milestoneBounce 0.6s ease 0.3s;`;

        const title = overlay.querySelector('.milestone-title');
        title.style.cssText = `font-family: 'Outfit', sans-serif; font-size: 2rem; font-weight: 900; margin-bottom: 10px; letter-spacing: 2px;`;

        const streak = overlay.querySelector('.milestone-streak');
        streak.style.cssText = `font-size: 1.2rem; color: rgba(255,255,255,0.8); margin-bottom: 8px;`;

        const xp = overlay.querySelector('.milestone-xp');
        xp.style.cssText = `font-size: 1.1rem; color: #4facfe; font-weight: 700; margin-bottom: 5px;`;

        const mult = overlay.querySelector('.milestone-multiplier');
        mult.style.cssText = `font-size: 0.9rem; color: rgba(255,255,255,0.5); margin-bottom: 20px;`;

        const btn = overlay.querySelector('.milestone-close-btn');
        btn.style.cssText = `
            background: ${milestone.color}; color: #000; border: none;
            padding: 12px 30px; border-radius: 30px; font-weight: 800;
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

        // Auto-remove after 5s
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => overlay.remove(), 300);
            }
        }, 5000);

        // Son
        if (typeof MedGameAudio !== 'undefined') {
            MedGameAudio.play('complete');
        }

        // Ajouter XP bonus au profil (si Supabase)
        if (typeof supabase !== 'undefined' && milestone.xpBonus > 0) {
            supabase.auth.getUser().then(async ({ data: { user } }) => {
                if (user) {
                    try {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('total_xp')
                            .eq('id', user.id)
                            .single();
                        if (profile) {
                            await supabase
                                .from('profiles')
                                .update({ total_xp: profile.total_xp + milestone.xpBonus })
                                .eq('id', user.id);
                        }
                    } catch (e) { console.warn('[StreakSystem] XP save failed:', e); }
                }
            });
        }
    },

    /**
     * Notification quand la streak est cassée
     */
    showStreakBroken(lostStreak) {
        if (typeof showNotification === 'function') {
            showNotification(`💔 Streak de ${lostStreak} cassée ! La prochaine fois...`);
        }

        // Petit flash rouge sur le compteur
        const el = document.getElementById('streak-display');
        if (el) {
            el.style.transition = 'all 0.3s ease';
            el.style.background = 'rgba(255,71,87,0.2)';
            el.style.borderRadius = '8px';
            el.style.padding = '2px 8px';
            setTimeout(() => {
                el.style.background = '';
                el.style.padding = '';
            }, 2000);
        }
    },

    /**
     * Réinitialiser la streak (admin/debug)
     */
    reset() {
        this.currentStreak = 0;
        this.multiplier = 1.0;
        this.save();
        this.renderUI();
    }
};

// Expose globalement
window.streakSystem = streakSystem;

// CSS animations (injecté une fois)
(function injectStreakCSS() {
    const css = `
        @keyframes streakPopupFloat {
            0% { opacity: 1; transform: translateY(0) scale(1); }
            100% { opacity: 0; transform: translateY(-40px) scale(1.3); }
        }
        @keyframes milestoneScaleIn {
            0% { transform: scale(0.5); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }
        @keyframes milestoneBounce {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.3); }
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        .streak-pulse {
            animation: streakPulseAnim 0.6s ease !important;
        }
        @keyframes streakPulseAnim {
            0% { transform: scale(1); }
            50% { transform: scale(1.4); }
            100% { transform: scale(1); }
        }

        /* Top bar streak display */
        #streak-display {
            display: flex;
            align-items: center;
            gap: 6px;
            font-family: 'Outfit', sans-serif;
            font-weight: 700;
            font-size: 1rem;
            cursor: default;
            transition: all 0.3s ease;
            padding: 4px 12px;
            background: rgba(255,255,255,0.05);
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.08);
        }
        #streak-display .streak-icon {
            font-size: 1.1rem;
        }
        #streak-display .streak-count {
            font-size: 1.1rem;
            font-weight: 800;
            transition: color 0.3s ease;
        }
        #streak-display .streak-multiplier {
            font-size: 0.75rem;
            background: rgba(255,255,255,0.1);
            padding: 1px 6px;
            border-radius: 10px;
            color: #4facfe;
        }

        /* Sidebar streak */
        #sidebar-streak {
            padding: 12px 16px;
            margin: 8px 12px;
            background: rgba(255,255,255,0.03);
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.06);
            transition: all 0.3s ease;
        }
        .sidebar-streak-inner {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .streak-icon-lg {
            font-size: 1.8rem;
        }
        .streak-number {
            font-family: 'Outfit', sans-serif;
            font-size: 1.6rem;
            font-weight: 900;
            line-height: 1;
            transition: color 0.3s ease;
        }
        .streak-label {
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 2px;
            opacity: 0.5;
        }
        .streak-mult-badge {
            font-size: 0.75rem;
            padding: 2px 8px;
            border-radius: 10px;
            border: 1px solid;
            font-weight: 700;
            margin-left: auto;
        }
        #streak-milestone-hint {
            font-size: 0.72rem;
            padding: 6px 16px 4px;
            color: rgba(255,255,255,0.4);
            text-align: center;
        }
        #best-streak-display {
            font-size: 0.7rem;
            text-align: center;
            padding: 0 16px 8px;
            color: rgba(255,255,255,0.3);
        }

        /* Mobile streak */
        #mobile-streak {
            font-family: 'Outfit', sans-serif;
            font-weight: 700;
            font-size: 0.85rem;
            padding: 2px 10px;
            background: rgba(255,255,255,0.06);
            border-radius: 15px;
        }
        #mobile-streak small {
            color: #4facfe;
            font-size: 0.7em;
        }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
})();
