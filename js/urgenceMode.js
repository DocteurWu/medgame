/**
 * js/urgenceMode.js — Moteur de jeu dynamique (nodes, transitions, constantes évolutives)
 * Utilise les nodes JSON (startNode, descriptionClinique, constantesCibles,
 * actionsDisponibles, evolutionAuto, isEndState, success) pour piloter le jeu.
 * Réutilise displayValue (ui.js) et animateSectionTransition (game.js).
 */

const urgenceState = {
    isUrgenceMode: false,
    currentUrgenceNode: null,
    urgenceTimerTimeout: null,
    evolutionCountdownInterval: null,
    evolutionTimeLeft: 0,
    currentCase: null,
    vitalMonitorInstance: null,
    nodeHistory: [], // Track visited nodes for correction
    actionsPerformed: [] // Track player actions
};

/**
 * Afficher/masquer la section urgence selon l'état
 */
function toggleUrgenceSection(show) {
    const navIntervention = document.getElementById('nav-intervention-rapide');
    const mobileIntervention = document.getElementById('mobile-tab-intervention');
    const sectionIntervention = document.getElementById('section-intervention-rapide');

    if (navIntervention) navIntervention.style.display = show ? '' : 'none';
    if (mobileIntervention) mobileIntervention.style.display = show ? '' : 'none';
    if (sectionIntervention) sectionIntervention.style.display = show ? '' : 'none';
}

/**
 * Rendre l'état urgence actuel : description clinique, constantes, actions
 */
function renderUrgenceState() {
    if (!urgenceState.isUrgenceMode || !urgenceState.currentUrgenceNode) return;

    const currentUrgenceNode = urgenceState.currentUrgenceNode;
    const currentCase = urgenceState.currentCase;

    // Track node in history
    if (!urgenceState.nodeHistory.includes(currentUrgenceNode.id)) {
        urgenceState.nodeHistory.push(currentUrgenceNode.id);
    }

    // === 1. Mettre à jour la description clinique du node ===
    const banner = document.getElementById('urgence-description-banner');
    if (banner && currentUrgenceNode.descriptionClinique) {
        // Flash rouge pour attirer l'attention
        banner.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${escapeHtml(currentUrgenceNode.descriptionClinique)}`;
        banner.style.background = 'rgba(255, 71, 87, 0.3)';
        banner.style.transition = 'background 0.5s ease';
        setTimeout(() => { banner.style.background = 'rgba(255, 71, 87, 0.1)'; }, 1000);
    }

    // === 2. Mettre à jour les constantes vitales via displayValue ===
    if (currentUrgenceNode.constantesCibles) {
        const cibles = currentUrgenceNode.constantesCibles;

        // Mettre à jour les spans cachés avec displayValue (lock-aware)
        const tensionEl = document.getElementById('tension');
        const poulsEl = document.getElementById('pouls');
        const satEl = document.getElementById('saturationO2');
        const tempEl = document.getElementById('temperature');
        const freqEl = document.getElementById('frequenceRespiratoire');

        if (typeof displayValue === 'function') {
            displayValue(tensionEl, cibles.tension || '', 'examenClinique.constantes.tension');
            displayValue(poulsEl, cibles.pouls || '', 'examenClinique.constantes.pouls');
            displayValue(satEl, cibles.saturationO2 || '', 'examenClinique.constantes.saturationO2');
            displayValue(tempEl, cibles.temperature || '', 'examenClinique.constantes.temperature');
            displayValue(freqEl, cibles.frequenceRespiratoire || '', 'examenClinique.constantes.frequenceRespiratoire');
        } else {
            // Fallback direct
            if (tensionEl) tensionEl.textContent = cibles.tension || '';
            if (poulsEl) poulsEl.textContent = cibles.pouls || '';
            if (satEl) satEl.textContent = cibles.saturationO2 || '';
            if (tempEl) tempEl.textContent = cibles.temperature || '';
            if (freqEl) freqEl.textContent = cibles.frequenceRespiratoire || '';
        }

        // Mettre à jour le moniteur vital graphique
        if (urgenceState.vitalMonitorInstance) {
            const bpStr = cibles.tension || "120/80";
            const bp = parseBP(bpStr);
            urgenceState.vitalMonitorInstance.updateProps({
                systolic: bp.systolic,
                diastolic: bp.diastolic,
                heartRate: parseInt(cibles.pouls) || 72,
                spo2: parseInt(cibles.saturationO2) || 98,
                temperature: parseFloat(cibles.temperature) || 36.6,
                respiratoryRate: parseInt(cibles.frequenceRespiratoire) || 16
            });
        }

        // Flash visuel sur les constantes critiques
        highlightCriticalVitals(cibles);
    }

    // Mettre à jour aspectGeneral si disponible
    const aspectGeneral = document.getElementById('aspectGeneral');
    if (aspectGeneral && currentUrgenceNode.descriptionClinique) {
        if (typeof displayValue === 'function') {
            displayValue(aspectGeneral, currentUrgenceNode.descriptionClinique, 'examenClinique.aspectGeneral');
        } else {
            aspectGeneral.textContent = currentUrgenceNode.descriptionClinique;
        }
    }

    // === 3. Afficher les actionsDisponibles comme boutons cliquables ===
    const actionsContainer = document.getElementById('urgence-actions-container');
    if (actionsContainer) {
        actionsContainer.innerHTML = '';

        if (currentUrgenceNode.actionsDisponibles && currentUrgenceNode.actionsDisponibles.length > 0) {
            currentUrgenceNode.actionsDisponibles.forEach((action, index) => {
                const btn = document.createElement('button');
                btn.className = 'urgence-action-btn';
                btn.id = `urg-action-btn-${index}`;

                // Icône contextuelle
                let icon = getActionIcon(action.label);
                const typeClass = getActionTypeClass(action.type);

                btn.innerHTML = `
                    <i class="fas ${icon}"></i>
                    <span class="btn-text" style="flex:1;">${escapeHtml(action.label)}</span>
                    <span class="time-badge">-${action.tempsExecutionSec}s</span>
                `;

                // Style selon le type d'action
                if (typeClass) btn.classList.add(typeClass);

                // Animation d'entrée staggerée
                btn.style.opacity = '0';
                btn.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    btn.style.transition = 'opacity 0.4s ease, transform 0.4s ease, background 0.2s ease';
                    btn.style.opacity = '1';
                    btn.style.transform = 'translateY(0)';
                }, 80 + index * 120);

                btn.onclick = () => executeUrgenceAction(action, btn);
                actionsContainer.appendChild(btn);
            });
        } else {
            // Pas d'actions disponibles (état terminal)
            actionsContainer.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center; padding: 20px;">Aucune action disponible — observation en cours...</p>';
        }
    }

    // === 4. Gérer l'évolution automatique (timer de dégradation) ===
    if (urgenceState.urgenceTimerTimeout) clearTimeout(urgenceState.urgenceTimerTimeout);
    if (urgenceState.evolutionCountdownInterval) clearInterval(urgenceState.evolutionCountdownInterval);

    // Supprimer l'ancien compte à rebours visuel s'il existe
    const oldCountdown = document.getElementById('evolution-countdown-bar');
    if (oldCountdown) oldCountdown.remove();

    if (currentUrgenceNode.evolutionAuto && currentUrgenceNode.evolutionAuto.delaiSecondes && !currentUrgenceNode.isEndState) {
        const delaiSec = currentUrgenceNode.evolutionAuto.delaiSecondes;
        urgenceState.evolutionTimeLeft = delaiSec;

        // Créer un compte à rebours visuel
        createEvolutionCountdown(delaiSec, currentUrgenceNode.evolutionAuto.motif);

        // Déduire du timer principal quand l'évolution auto se déclenche
        urgenceState.urgenceTimerTimeout = setTimeout(() => {
            if (urgenceState.evolutionCountdownInterval) clearInterval(urgenceState.evolutionCountdownInterval);
            const oldBar = document.getElementById('evolution-countdown-bar');
            if (oldBar) oldBar.remove();

            showNotification(`⚠️ ALERTE : ${currentUrgenceNode.evolutionAuto.motif}`);

            // Déduire le temps d'évolution du timer principal
            if (typeof window.deductTime === 'function') {
                window.deductTime(delaiSec);
            }

            transitionUrgenceState(currentUrgenceNode.evolutionAuto.nextNode);
        }, delaiSec * 1000);
    }

    // === 5. Gérer les états finaux (isEndState) ===
    if (currentUrgenceNode.isEndState) {
        handleEndState(currentUrgenceNode, currentCase);
    }
}

/**
 * Créer une barre de compte à rebours pour l'évolution automatique
 */
function createEvolutionCountdown(delaiSec, motif) {
    const banner = document.getElementById('urgence-description-banner');
    if (!banner) return;

    const countdownDiv = document.createElement('div');
    countdownDiv.id = 'evolution-countdown-bar';
    countdownDiv.style.cssText = `
        margin-top: 12px;
        padding: 10px 15px;
        background: rgba(255, 165, 0, 0.15);
        border: 1px solid rgba(255, 165, 0, 0.4);
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.3s ease;
    `;
    countdownDiv.innerHTML = `
        <i class="fas fa-hourglass-half" style="color: #ffa500; font-size: 1.2rem;"></i>
        <div style="flex: 1;">
            <div style="font-size: 0.85rem; color: #ffa500; margin-bottom: 4px;">
                <span id="evolution-countdown-text">${delaiSec}s</span> — Évolution naturelle
            </div>
            <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                <div id="evolution-progress-bar" style="width: 100%; height: 100%; background: linear-gradient(90deg, #ffa500, #ff4757); border-radius: 2px; transition: width 1s linear;"></div>
            </div>
        </div>
    `;
    banner.parentNode.insertBefore(countdownDiv, banner.nextSibling);

    // Mise à jour chaque seconde
    urgenceState.evolutionCountdownInterval = setInterval(() => {
        urgenceState.evolutionTimeLeft--;
        const countdownText = document.getElementById('evolution-countdown-text');
        const progressBar = document.getElementById('evolution-progress-bar');

        if (countdownText) {
            countdownText.textContent = `${urgenceState.evolutionTimeLeft}s`;
            // Changer la couleur quand critique
            if (urgenceState.evolutionTimeLeft <= 10) {
                countdownText.style.color = '#ff4757';
                countdownText.style.fontWeight = 'bold';
            }
        }
        if (progressBar) {
            const pct = (urgenceState.evolutionTimeLeft / delaiSec) * 100;
            progressBar.style.width = `${pct}%`;
        }

        // Flash rouge sur les dernières secondes
        if (urgenceState.evolutionTimeLeft <= 5 && countdownDiv) {
            countdownDiv.style.background = countdownDiv.style.background === 'rgba(255, 71, 87, 0.25)'
                ? 'rgba(255, 165, 0, 0.15)'
                : 'rgba(255, 71, 87, 0.25)';
        }

        if (urgenceState.evolutionTimeLeft <= 0) {
            clearInterval(urgenceState.evolutionCountdownInterval);
        }
    }, 1000);
}

/**
 * Mettre en surbrillance les constantes vitales critiques
 */
function highlightCriticalVitals(cibles) {
    // Pouls critique (>130 ou <50)
    const poulsEl = document.getElementById('pouls');
    if (poulsEl) {
        const pouls = parseInt(cibles.pouls) || 72;
        if (pouls > 130 || pouls < 50) {
            poulsEl.style.color = '#ff4757';
            poulsEl.style.fontWeight = 'bold';
        } else {
            poulsEl.style.color = '';
            poulsEl.style.fontWeight = '';
        }
    }

    // Saturation critique (<90%)
    const satEl = document.getElementById('saturationO2');
    if (satEl) {
        const sat = parseInt(cibles.saturationO2) || 98;
        if (sat < 90) {
            satEl.style.color = '#ff4757';
            satEl.style.fontWeight = 'bold';
        } else {
            satEl.style.color = '';
            satEl.style.fontWeight = '';
        }
    }

    // Tension critique (systolique <90)
    const tensionEl = document.getElementById('tension');
    if (tensionEl && cibles.tension) {
        const bp = parseBP(cibles.tension);
        if (bp.systolic < 90) {
            tensionEl.style.color = '#ff4757';
            tensionEl.style.fontWeight = 'bold';
        } else {
            tensionEl.style.color = '';
            tensionEl.style.fontWeight = '';
        }
    }
}

/**
 * Gérer un état final (victoire ou échec)
 */
function handleEndState(currentUrgenceNode, currentCase) {
    // Arrêter tous les timers
    if (urgenceState.urgenceTimerTimeout) clearTimeout(urgenceState.urgenceTimerTimeout);
    if (urgenceState.evolutionCountdownInterval) clearInterval(urgenceState.evolutionCountdownInterval);
    if (timerState.timerInterval) clearInterval(timerState.timerInterval);

    // Supprimer le compte à rebours visuel
    const countdownBar = document.getElementById('evolution-countdown-bar');
    if (countdownBar) countdownBar.remove();

    // Marquer le cas comme joué
    const playedCases = getCookie('playedCases');
    let arr = playedCases ? playedCases.split(',') : [];
    if (!arr.includes(currentCase.id)) {
        arr.push(currentCase.id);
        setCookie('playedCases', arr.join(','), 365);
    }

    // Désactiver les boutons d'action
    const actionsContainer = document.getElementById('urgence-actions-container');
    if (actionsContainer) {
        const buttons = actionsContainer.querySelectorAll('.urgence-action-btn');
        buttons.forEach(b => {
            b.disabled = true;
            b.style.opacity = '0.4';
            b.style.cursor = 'not-allowed';
        });
    }

    setTimeout(() => {
        const isSuccess = currentUrgenceNode.success === true;

        let html = `<div style="text-align:center; padding: 20px;">`;

        // Icône et titre selon succès/échec
        if (isSuccess) {
            html += `<div style="font-size: 3rem; margin-bottom: 20px;">
                        <i class="fas fa-heart-pulse" style="color: #2ecc71; text-shadow: 0 0 20px rgba(46, 204, 113, 0.5);"></i>
                     </div>`;
            html += `<h2 style="font-family: var(--font-title); font-size: 2rem; color: #2ecc71;">PATIENT SAUVÉ !</h2>`;
        } else {
            html += `<div style="font-size: 3rem; margin-bottom: 20px;">
                        <i class="fas fa-skull-crossbones" style="color: #ff4757; text-shadow: 0 0 20px rgba(255, 71, 87, 0.5);"></i>
                     </div>`;
            html += `<h2 style="font-family: var(--font-title); font-size: 2rem; color: #ff4757;">ÉCHEC CRITIQUE</h2>`;
        }

        // Description de l'état final
        html += `<div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid rgba(255,255,255,0.1);">
                    <p style="font-size: 1.1rem; line-height: 1.6; margin: 0;">${escapeHtml(currentUrgenceNode.descriptionClinique)}</p>
                 </div>`;

        // XP reward si défini
        if (currentUrgenceNode.xpReward && currentUrgenceNode.xpReward > 0 && isSuccess) {
            html += `<div style="background: linear-gradient(90deg, rgba(0, 242, 254, 0.1), rgba(179, 136, 255, 0.1)); border: 1px solid var(--primary-color); padding: 15px; border-radius: 10px; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <i class="fas fa-star" style="color: #ffb347;"></i>
                        <span style="font-weight: 800; font-family: var(--font-title); letter-spacing: 1px;">+${currentUrgenceNode.xpReward} XP GAGNÉS</span>
                     </div>`;
        }

        // Résumé du parcours
        if (urgenceState.actionsPerformed.length > 0) {
            html += `<div style="text-align: left; margin-bottom: 20px; padding: 15px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                        <h4 style="color: var(--primary-color); font-size: 0.9rem; text-transform: uppercase; margin-bottom: 10px;">
                            <i class="fas fa-route"></i> VOTRE PARCOURS
                        </h4>
                        <ul style="margin: 0; padding-left: 20px; font-size: 0.9rem; line-height: 1.8;">`;
            urgenceState.actionsPerformed.forEach(a => {
                const color = a.type === 'traitement_cle' ? '#2ecc71' : a.type === 'erreur' ? '#ff4757' : '#ffa500';
                html += `<li style="color: ${color};">${escapeHtml(a.label)}</li>`;
            });
            html += `</ul></div>`;
        }

        // Correction & protocole
        if (currentCase.correction) {
            html += `<div style="text-align: left; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; font-size: 0.95rem; opacity: 0.9;">
                        <h3 style="color: var(--primary-color); font-size: 1rem; text-transform: uppercase; margin-bottom: 10px;">
                            <i class="fas fa-book-medical"></i> CORRECTION & PROTOCOLE
                        </h3>
                        ${currentCase.correction}
                     </div>`;
        }
        html += `</div>`;

        showCorrectionModal(html);

        // Sons et effets
        if (isSuccess) {
            if (uiState.fireworksInstance) {
                try { uiState.fireworksInstance.stop(); } catch(e) {}
            }
        } else {
            try {
                const failSound = new Audio('assets/sounds/flatline.mp3');
                failSound.play().catch(() => {});
            } catch(e) {}
        }

        // === PATIENT GALLERY: Record urgence outcome ===
        if (typeof patientGallery !== 'undefined' && currentCase) {
            const isSuccess = currentUrgenceNode.success === true;
            const urgenceScore = isSuccess ? (currentUrgenceNode.xpReward ? Math.min(100, currentUrgenceNode.xpReward) : 100) : 0;
            const galleryResult = patientGallery.recordPatient(currentCase, {
                success: isSuccess,
                score: urgenceScore,
                diagnostic: isSuccess ? currentCase.correctDiagnostic : '(urgence)',
                treatments: urgenceState.actionsPerformed.map(a => a.label),
                timeSpent: 0,
                attempts: 1
            });
            if (galleryResult) {
                setTimeout(() => {
                    patientGallery.showNewPatientPopup(galleryResult);
                }, 2000);
            }
        }

        // Attribution XP
        if (isSuccess && currentUrgenceNode.xpReward && currentUrgenceNode.xpReward > 0) {
            awardUrgenceXp(currentUrgenceNode.xpReward);
        }
    }, 1200);
}

/**
 * Obtenir l'icône FontAwesome appropriée pour une action
 */
function getActionIcon(label) {
    const l = label.toLowerCase();
    if (l.includes('massage') || l.includes('acr') || l.includes('compression')) return 'fa-heartbeat';
    if (l.includes('défibrillation') || l.includes('dae') || l.includes('choc')) return 'fa-bolt';
    if (l.includes('oxygène') || l.includes('o2') || l.includes('ventilation') || l.includes('libérer') || l.includes('masque')) return 'fa-mask-ventilator';
    if (l.includes('médicament') || l.includes('injection') || l.includes('adrénaline') || l.includes('perfusion') || l.includes('antihistaminique')) return 'fa-syringe';
    if (l.includes('garrot') || l.includes('pansement') || l.includes('hémorragie')) return 'fa-band-aid';
    if (l.includes('bilan') || l.includes('samu') || l.includes('appeler')) return 'fa-phone-alt';
    if (l.includes('position') || l.includes('pls') || l.includes('debout')) return 'fa-person-falling';
    if (l.includes('intubation') || l.includes('sonde') || l.includes('voie aérienne')) return 'fa-lungs';
    if (l.includes('monitoring') || l.includes('ecg') || l.includes('surveillance')) return 'fa-monitor-waveform';
    return 'fa-user-md';
}

/**
 * Classe CSS selon le type d'action (pour le style des boutons)
 */
function getActionTypeClass(type) {
    switch (type) {
        case 'traitement_cle': return 'action-correct';
        case 'erreur': return 'action-error';
        case 'soin': return 'action-support';
        case 'geste_urgence': return 'action-urgence';
        default: return '';
    }
}

/**
 * Exécuter une action d'urgence (clic sur un bouton)
 */
function executeUrgenceAction(action, clickedButton) {
    // Annuler le timer d'évolution auto
    if (urgenceState.urgenceTimerTimeout) clearTimeout(urgenceState.urgenceTimerTimeout);
    if (urgenceState.evolutionCountdownInterval) clearInterval(urgenceState.evolutionCountdownInterval);
    const countdownBar = document.getElementById('evolution-countdown-bar');
    if (countdownBar) countdownBar.remove();

    // Track l'action
    urgenceState.actionsPerformed.push({
        label: action.label,
        type: action.type,
        node: urgenceState.currentUrgenceNode.id
    });

    // Désactiver tous les boutons
    const actionsContainer = document.getElementById('urgence-actions-container');
    if (actionsContainer) {
        const buttons = actionsContainer.querySelectorAll('.urgence-action-btn');
        buttons.forEach(b => {
            b.disabled = true;
            b.style.opacity = '0.4';
            b.style.cursor = 'not-allowed';
        });
    }

    // Animation sur le bouton cliqué
    clickedButton.style.opacity = '1';
    clickedButton.style.background = 'var(--primary-color)';
    clickedButton.style.color = '#000';
    clickedButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span class="btn-text">En cours (${action.tempsExecutionSec}s)...</span>`;

    // Déduire le temps d'exécution du timer principal
    if (typeof window.deductTime === 'function') {
        window.deductTime(action.tempsExecutionSec);
    }

    // Feedback immédiat (son)
    if (typeof playSound === 'function') {
        if (action.type === 'traitement_cle') playSound('correct');
        else if (action.type === 'erreur') playSound('incorrect');
        else playSound('click');
    }

    // Délai réaliste puis transition vers le prochain node
    // Utilise le temps d'exécution de l'action (min 2s, max 6s pour l'UX)
    const REAL_DELAY_MS = Math.min(Math.max(action.tempsExecutionSec * 400, 2000), 6000);

    setTimeout(() => {
        // Afficher le feedback de l'action
        if (action.feedback) {
            showNotification(action.feedback);
        }

        // Transition vers le prochain node
        transitionUrgenceState(action.nextNode);
    }, REAL_DELAY_MS);
}

/**
 * Transitionner vers un nouveau node
 */
function transitionUrgenceState(nextNodeId) {
    const currentCase = urgenceState.currentCase;
    if (!currentCase.nodes || !currentCase.nodes[nextNodeId]) {
        console.error(`[UrgenceMode] Node inconnu: ${nextNodeId}`);
        showNotification('Erreur: état de jeu inconnu');
        return;
    }

    // Utiliser animateSectionTransition si disponible pour une transition fluide
    const actionsContainer = document.getElementById('urgence-actions-container');
    const banner = document.getElementById('urgence-description-banner');

    if (typeof animateSectionTransition === 'function' && banner) {
        // Animation de transition sur le banner
        banner.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        banner.style.opacity = '0';
        banner.style.transform = 'translateY(-10px)';

        setTimeout(() => {
            urgenceState.currentUrgenceNode = currentCase.nodes[nextNodeId];
            renderUrgenceState();

            // Fade in
            banner.style.opacity = '1';
            banner.style.transform = 'translateY(0)';
        }, 300);
    } else {
        urgenceState.currentUrgenceNode = currentCase.nodes[nextNodeId];
        renderUrgenceState();
    }
}

/**
 * Attribuer de l'XP en mode urgence (via Supabase)
 */
async function awardUrgenceXp(xpAmount) {
    if (!window.supabase) return;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('total_xp')
                .eq('id', session.user.id)
                .single();

            if (profile) {
                const newXp = (profile.total_xp || 0) + xpAmount;
                await supabase
                    .from('profiles')
                    .update({ total_xp: newXp })
                    .eq('id', session.user.id);
                showNotification(`Tu as gagné ${xpAmount} XP !`);
            }
        }
    } catch (error) {
        console.error("[UrgenceMode] Erreur attribution XP:", error);
    }
}

/**
 * Réinitialiser l'état urgence pour un nouveau cas
 */
function resetUrgenceState() {
    if (urgenceState.urgenceTimerTimeout) clearTimeout(urgenceState.urgenceTimerTimeout);
    if (urgenceState.evolutionCountdownInterval) clearInterval(urgenceState.evolutionCountdownInterval);
    const countdownBar = document.getElementById('evolution-countdown-bar');
    if (countdownBar) countdownBar.remove();

    urgenceState.isUrgenceMode = false;
    urgenceState.currentUrgenceNode = null;
    urgenceState.currentCase = null;
    urgenceState.nodeHistory = [];
    urgenceState.actionsPerformed = [];
    urgenceState.evolutionTimeLeft = 0;
}

/**
 * Initialiser le mode urgence pour un cas avec gameplayConfig.startNode
 * @param {Object} currentCase - Le cas clinique chargé
 * @returns {boolean} true si le mode urgence a été activé
 */
function initUrgenceMode(currentCase) {
    if (!currentCase || !currentCase.gameplayConfig || !currentCase.gameplayConfig.startNode) {
        urgenceState.isUrgenceMode = false;
        toggleUrgenceSection(false);
        return false;
    }

    const startNodeId = currentCase.gameplayConfig.startNode;
    const nodes = currentCase.nodes || {};

    if (!nodes[startNodeId]) {
        console.error(`[UrgenceMode] startNode '${startNodeId}' introuvable dans les nodes du cas ${currentCase.id}`);
        urgenceState.isUrgenceMode = false;
        toggleUrgenceSection(false);
        return false;
    }

    urgenceState.isUrgenceMode = true;
    urgenceState.currentCase = currentCase;
    urgenceState.currentUrgenceNode = nodes[startNodeId];
    urgenceState.nodeHistory = [];
    urgenceState.actionsPerformed = [];

    toggleUrgenceSection(true);
    return true;
}
