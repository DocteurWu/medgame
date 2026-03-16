/**
 * js/skillCards.js — Cartes de Compétences Actives
 *
 * Cartes activables pendant un cas clinique pour aider le joueur.
 * - Intuition Clinique : met en évidence le diagnostic le plus probable
 * - Temps Bonus : +60 secondes au timer
 * - Élimination : grise 2 mauvais traitements
 * - Stabilisation : gèle l'évolution auto pendant 30s
 * - Consultation : révèle un indice du protocole
 *
 * Inventaire : 1 carte aléatoire au départ, +1 tous les 3 streaks
 * Stockage : sessionStorage (par session de jeu)
 */

const skillCards = {
    // Cartes disponibles dans l'inventaire
    inventory: [],

    // Cartes déjà utilisées dans ce cas (pour UI)
    usedThisCase: [],

    // Définitions des cartes
    definitions: {
        intuition: {
            id: 'intuition',
            name: 'Intuition Clinique',
            icon: '🔮',
            color: '#a855f7',
            description: 'Met en évidence le diagnostic le plus probable',
            oneTime: true
        },
        temps_bonus: {
            id: 'temps_bonus',
            name: 'Temps Bonus',
            icon: '⏱️',
            color: '#3b82f6',
            description: '+60 secondes au timer',
            oneTime: true
        },
        elimination: {
            id: 'elimination',
            name: 'Élimination',
            icon: '🗑️',
            color: '#f97316',
            description: 'Élimine 2 mauvais traitements',
            oneTime: true
        },
        stabilisation: {
            id: 'stabilisation',
            name: 'Stabilisation',
            icon: '💉',
            color: '#10b981',
            description: 'Gèle l\'évolution du patient pendant 30s',
            oneTime: true
        },
        consultation: {
            id: 'consultation',
            name: 'Consultation',
            icon: '📖',
            color: '#eab308',
            description: 'Révèle un indice du protocole',
            oneTime: true
        }
    },

    /**
     * Initialiser le système
     */
    init() {
        this.loadInventory();
        this.renderUI();
    },

    /**
     * Charger l'inventaire depuis sessionStorage
     */
    loadInventory() {
        try {
            const saved = sessionStorage.getItem('medgame_skillcards');
            if (saved) {
                const data = JSON.parse(saved);
                this.inventory = data.inventory || [];
            }
        } catch (e) {
            console.warn('[SkillCards] Erreur chargement:', e);
            this.inventory = [];
        }

        // Si inventaire vide, donner une carte aléatoire
        if (this.inventory.length === 0) {
            this.inventory.push(this.getRandomCardId());
        }

        this.usedThisCase = [];
    },

    /**
     * Sauvegarder dans sessionStorage
     */
    save() {
        try {
            sessionStorage.setItem('medgame_skillcards', JSON.stringify({
                inventory: this.inventory
            }));
        } catch (e) {
            console.warn('[SkillCards] Erreur sauvegarde:', e);
        }
    },

    /**
     * Obtenir un ID de carte aléatoire
     */
    getRandomCardId() {
        const ids = Object.keys(this.definitions);
        return ids[Math.floor(Math.random() * ids.length)];
    },

    /**
     * Ajouter une carte à l'inventaire
     */
    addCard(cardId) {
        if (this.definitions[cardId]) {
            this.inventory.push(cardId);
            this.save();
            this.renderUI();
            showNotification(`${this.definitions[cardId].icon} Nouvelle carte : ${this.definitions[cardId].name} !`);
        }
    },

    /**
     * Vérifier si le joueur a une carte
     */
    hasCard(cardId) {
        return this.inventory.includes(cardId);
    },

    /**
     * Utiliser une carte
     */
    useCard(cardId) {
        if (!this.hasCard(cardId)) return false;
        if (this.usedThisCase.includes(cardId)) return false;

        const card = this.definitions[cardId];
        if (!card) return false;

        // Retirer de l'inventaire
        const idx = this.inventory.indexOf(cardId);
        this.inventory.splice(idx, 1);
        this.usedThisCase.push(cardId);
        this.save();

        // Jouer le son
        if (typeof playSound === 'function') playSound('reveal');

        // Activer l'effet
        this.activateEffect(cardId);

        // Re-rendre
        this.renderUI();

        return true;
    },

    /**
     * Activer l'effet d'une carte
     */
    activateEffect(cardId) {
        const card = this.definitions[cardId];

        switch (cardId) {
            case 'intuition':
                this.effectIntuition();
                break;
            case 'temps_bonus':
                this.effectTempsBonus();
                break;
            case 'elimination':
                this.effectElimination();
                break;
            case 'stabilisation':
                this.effectStabilisation();
                break;
            case 'consultation':
                this.effectConsultation();
                break;
        }

        // Feedback visuel commun
        this.showActivationEffect(card);
    },

    /**
     * Effet: Intuition Clinique — surligne le bon diagnostic
     */
    effectIntuition() {
        const currentCase = gameState.currentCase;
        if (!currentCase || !currentCase.correctDiagnostic) return;

        const select = document.getElementById('diagnostic-select');
        if (!select) return;

        const options = Array.from(select.options);
        const correctValue = currentCase.correctDiagnostic;

        // Trouver la bonne option et la surligner
        options.forEach(opt => {
            if (opt.value === correctValue) {
                opt.style.background = 'rgba(168, 85, 247, 0.3)';
                opt.style.color = '#c084fc';
                opt.style.fontWeight = 'bold';
                opt.textContent = `🔮 ${opt.text}`;
            }
        });

        // Auto-scroll vers le select
        select.scrollIntoView({ behavior: 'smooth', block: 'center' });
        select.focus();

        showNotification('🔮 Intuition : un diagnostic semble se démarquer...');
    },

    /**
     * Effet: Temps Bonus — +60 secondes
     */
    effectTempsBonus() {
        if (typeof timerState !== 'undefined' && timerState.timeLeft !== undefined) {
            timerState.timeLeft += 60;
            if (typeof displayTime === 'function') displayTime(timerState.timeLeft);
            if (typeof updateTimerVisualState === 'function') updateTimerVisualState();
        }
        showNotification('⏱️ +60 secondes ajoutées !');
    },

    /**
     * Effet: Élimination — grise 2 mauvais traitements
     */
    effectElimination() {
        const currentCase = gameState.currentCase;
        if (!currentCase || !currentCase.correctTreatments) return;

        const container = document.getElementById('availableTreatments');
        if (!container) return;

        const buttons = Array.from(container.querySelectorAll('button[data-traitement]'));
        const correctTreatments = currentCase.correctTreatments;
        const fatalTreatments = currentCase.fatalTreatments || [];

        // Trouver les mauvais traitements (ni corrects, ni fatals déjà affichés)
        const wrongButtons = buttons.filter(btn => {
            const t = btn.dataset.traitement;
            return !correctTreatments.includes(t) && !btn.classList.contains('selected');
        });

        // En griser 2 au hasard
        const toEliminate = wrongButtons.sort(() => Math.random() - 0.5).slice(0, 2);

        toEliminate.forEach((btn, i) => {
            setTimeout(() => {
                btn.style.opacity = '0.25';
                btn.style.textDecoration = 'line-through';
                btn.style.pointerEvents = 'none';
                btn.style.background = 'rgba(231, 76, 60, 0.1)';
                btn.style.borderColor = 'rgba(231, 76, 60, 0.3)';

                // Ajouter un badge
                const badge = document.createElement('span');
                badge.textContent = ' ✗';
                badge.style.color = '#e74c3c';
                badge.style.fontWeight = 'bold';
                btn.appendChild(badge);
            }, i * 300);
        });

        showNotification(`🗑️ ${toEliminate.length} mauvais traitements éliminés !`);
    },

    /**
     * Effet: Stabilisation — gèle le countdown d'évolution
     */
    effectStabilisation() {
        if (typeof urgenceState !== 'undefined' && urgenceState.isUrgenceMode) {
            // Arrêter les timers d'évolution
            if (urgenceState.urgenceTimerTimeout) {
                clearTimeout(urgenceState.urgenceTimerTimeout);
                urgenceState.urgenceTimerTimeout = null;
            }
            if (urgenceState.evolutionCountdownInterval) {
                clearInterval(urgenceState.evolutionCountdownInterval);
                urgenceState.evolutionCountdownInterval = null;
            }

            // Afficher un indicateur de stabilisation
            const countdownBar = document.getElementById('evolution-countdown-bar');
            if (countdownBar) {
                countdownBar.style.background = 'rgba(16, 185, 129, 0.15)';
                countdownBar.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                countdownBar.innerHTML = `
                    <i class="fas fa-shield-alt" style="color: #10b981; font-size: 1.2rem;"></i>
                    <div style="flex: 1;">
                        <div style="font-size: 0.85rem; color: #10b981; font-weight: bold;">
                            💉 PATIENT STABILISÉ — Évolution gelée
                        </div>
                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5);">
                            Vous avez 30 secondes supplémentaires pour agir
                        </div>
                    </div>
                `;
            }

            // Re-déclencher l'évolution après 30s
            setTimeout(() => {
                if (urgenceState.currentUrgenceNode && urgenceState.currentUrgenceNode.evolutionAuto) {
                    const evo = urgenceState.currentUrgenceNode.evolutionAuto;
                    if (evo.nextNode) {
                        showNotification(`⚠️ La stabilisation prend fin...`);
                        if (typeof transitionUrgenceState === 'function') {
                            transitionUrgenceState(evo.nextNode);
                        }
                    }
                }
            }, 30000);
        } else {
            // Mode classique : ajouter 30s au timer
            if (typeof timerState !== 'undefined') {
                timerState.timeLeft += 30;
                if (typeof displayTime === 'function') displayTime(timerState.timeLeft);
            }
        }
        showNotification('💉 Patient stabilisé ! Évolution temporairement gelée.');
    },

    /**
     * Effet: Consultation — révèle un indice du protocole
     */
    effectConsultation() {
        const currentCase = gameState.currentCase;
        if (!currentCase) return;

        let hint = '';

        // Chercher un indice dans correction ou dans les feedbacks
        if (currentCase.correction) {
            // Extraire les premières phrases de la correction comme indice
            const text = currentCase.correction.replace(/<[^>]*>/g, '').trim();
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
            if (sentences.length > 0) {
                hint = sentences[0].trim() + '.';
            }
        }

        if (!hint && currentCase.correctDiagnostic) {
            hint = `Le diagnostic à rechercher commence par : "${currentCase.correctDiagnostic.split(' ')[0]}"`;
        }

        if (!hint) {
            hint = 'Analysez attentivement l\'ensemble des constantes vitales et leur évolution.';
        }

        // Afficher dans une modale stylée
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 10000;
            background: rgba(0,0,0,0.7); backdrop-filter: blur(5px);
            display: flex; align-items: center; justify-content: center;
            animation: fadeIn 0.3s ease;
        `;
        overlay.innerHTML = `
            <div style="
                background: linear-gradient(135deg, rgba(30,30,50,0.98), rgba(40,40,70,0.98));
                border: 2px solid #eab308; border-radius: 20px; padding: 35px;
                max-width: 450px; width: 90%; text-align: center;
                box-shadow: 0 0 40px rgba(234, 179, 8, 0.25);
                animation: milestoneScaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            ">
                <div style="font-size: 3rem; margin-bottom: 15px;">📖</div>
                <h3 style="color: #eab308; font-family: 'Outfit', sans-serif; margin-bottom: 15px; font-size: 1.3rem;">
                    CONSULTATION DU PROTOCOLE
                </h3>
                <div style="
                    background: rgba(234, 179, 8, 0.08); border: 1px solid rgba(234, 179, 8, 0.2);
                    padding: 18px; border-radius: 12px; font-size: 1rem; line-height: 1.6;
                    color: rgba(255,255,255,0.9); text-align: left;
                ">
                    <i class="fas fa-lightbulb" style="color: #eab308; margin-right: 8px;"></i>
                    ${escapeHtml(hint)}
                </div>
                <button id="consultation-close-btn" style="
                    background: #eab308; color: #000; border: none; margin-top: 20px;
                    padding: 12px 30px; border-radius: 30px; font-weight: 800;
                    font-size: 0.95rem; cursor: pointer; letter-spacing: 1px;
                    transition: transform 0.2s;
                ">COMPRIS</button>
            </div>
        `;

        document.body.appendChild(overlay);

        const btn = overlay.querySelector('#consultation-close-btn');
        btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
        btn.onmouseout = () => btn.style.transform = 'scale(1)';
        btn.addEventListener('click', () => {
            overlay.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => overlay.remove(), 300);
        });

        // Auto-close après 8s
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => overlay.remove(), 300);
            }
        }, 8000);
    },

    /**
     * Effet visuel d'activation de carte
     */
    showActivationEffect(card) {
        const popup = document.createElement('div');
        popup.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            z-index: 9999; font-size: 4rem; pointer-events: none;
            animation: cardActivationPop 1s ease-out forwards;
            text-shadow: 0 0 30px ${card.color}80;
        `;
        popup.textContent = card.icon;
        document.body.appendChild(popup);
        setTimeout(() => popup.remove(), 1000);
    },

    /**
     * Réinitialiser pour un nouveau cas
     */
    resetForNewCase() {
        this.usedThisCase = [];
        this.renderUI();
    },

    /**
     * Récompenser un streak de 3
     */
    rewardStreak(streakCount) {
        if (streakCount > 0 && streakCount % 3 === 0) {
            // Tous les 3 streaks, ajouter une carte
            const cardId = this.getRandomCardId();
            this.addCard(cardId);
        }
    },

    /**
     * Rendre l'UI des cartes
     */
    renderUI() {
        this.renderSidebar();
        this.renderFloatingBar();
    },

    /**
     * Rendre dans la sidebar
     */
    renderSidebar() {
        const container = document.getElementById('skill-cards-sidebar');
        if (!container) return;

        if (this.inventory.length === 0) {
            container.innerHTML = `
                <div style="padding: 12px 16px; text-align: center; opacity: 0.4; font-size: 0.8rem;">
                    <i class="fas fa-layer-group"></i> Aucune carte
                </div>
            `;
            return;
        }

        let html = `
            <div style="padding: 8px 12px;">
                <div style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 2px; opacity: 0.4; margin-bottom: 8px; padding: 0 4px;">
                    CARTES ACTIVES
                </div>
        `;

        this.inventory.forEach((cardId, idx) => {
            const card = this.definitions[cardId];
            if (!card) return;

            const isUsed = this.usedThisCase.includes(cardId);

            html += `
                <button class="skill-card-btn" data-card-id="${cardId}"
                    ${isUsed ? 'disabled' : ''}
                    style="
                        width: 100%; display: flex; align-items: center; gap: 10px;
                        padding: 10px 12px; margin-bottom: 6px;
                        background: ${isUsed ? 'rgba(255,255,255,0.03)' : `rgba(${this.hexToRgb(card.color)}, 0.08)`};
                        border: 1px solid ${isUsed ? 'rgba(255,255,255,0.05)' : `rgba(${this.hexToRgb(card.color)}, 0.25)`};
                        border-radius: 10px; cursor: ${isUsed ? 'not-allowed' : 'pointer'};
                        color: white; font-size: 0.82rem; text-align: left;
                        transition: all 0.2s ease; opacity: ${isUsed ? '0.35' : '1'};
                    "
                    onmouseover="this.style.background='rgba(${this.hexToRgb(card.color)}, 0.15)'; this.style.transform='translateX(3px)';"
                    onmouseout="this.style.background='${isUsed ? 'rgba(255,255,255,0.03)' : `rgba(${this.hexToRgb(card.color)}, 0.08)`}'; this.style.transform='';"
                >
                    <span style="font-size: 1.3rem;">${card.icon}</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; color: ${isUsed ? 'rgba(255,255,255,0.4)' : card.color};">${card.name}</div>
                        <div style="font-size: 0.7rem; opacity: 0.6; margin-top: 2px;">${card.description}</div>
                    </div>
                    ${!isUsed ? '<i class="fas fa-chevron-right" style="font-size: 0.7rem; opacity: 0.4;"></i>' : '<i class="fas fa-check" style="font-size: 0.7rem; color: rgba(255,255,255,0.3);"></i>'}
                </button>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

        // Attacher les événements
        container.querySelectorAll('.skill-card-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                const cardId = btn.dataset.cardId;
                this.useCard(cardId);
            });
        });
    },

    /**
     * Rendre la barre flottante (mobile / compact)
     */
    renderFloatingBar() {
        const bar = document.getElementById('skill-cards-bar');
        if (!bar) return;

        if (this.inventory.length === 0) {
            bar.style.display = 'none';
            return;
        }

        bar.style.display = '';
        let html = '';

        this.inventory.forEach(cardId => {
            const card = this.definitions[cardId];
            if (!card) return;
            const isUsed = this.usedThisCase.includes(cardId);

            html += `
                <button class="skill-card-mini" data-card-id="${cardId}"
                    ${isUsed ? 'disabled' : ''}
                    style="
                        width: 44px; height: 44px; border-radius: 12px;
                        background: ${isUsed ? 'rgba(255,255,255,0.05)' : `rgba(${this.hexToRgb(card.color)}, 0.15)`};
                        border: 1.5px solid ${isUsed ? 'rgba(255,255,255,0.1)' : card.color};
                        cursor: ${isUsed ? 'not-allowed' : 'pointer'};
                        font-size: 1.3rem; display: flex; align-items: center; justify-content: center;
                        opacity: ${isUsed ? '0.3' : '1'};
                        transition: all 0.2s ease;
                        position: relative;
                    "
                    title="${card.name}: ${card.description}"
                >
                    ${card.icon}
                    ${!isUsed ? `<span style="position:absolute; top:-4px; right:-4px; width:10px; height:10px; background:${card.color}; border-radius:50%; border:1.5px solid rgba(20,20,40,0.9);"></span>` : ''}
                </button>
            `;
        });

        bar.innerHTML = html;

        bar.querySelectorAll('.skill-card-mini:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                const cardId = btn.dataset.cardId;
                this.useCard(cardId);
            });
        });
    },

    /**
     * Utilitaire: hex to rgb
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
            : '255, 255, 255';
    },

    /**
     * Réinitialiser complètement (admin/debug)
     */
    reset() {
        this.inventory = [];
        this.usedThisCase = [];
        sessionStorage.removeItem('medgame_skillcards');
        this.renderUI();
    }
};

// Expose globalement
window.skillCards = skillCards;

// CSS pour les animations
(function injectSkillCardCSS() {
    const css = `
        @keyframes cardActivationPop {
            0% { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
            30% { opacity: 1; transform: translate(-50%, -50%) scale(1.5); }
            100% { opacity: 0; transform: translate(-50%, -80%) scale(1); }
        }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
})();
