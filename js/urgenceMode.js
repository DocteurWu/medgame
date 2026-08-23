/**
 * js/urgenceMode.js — Mode urgence (protocoles de réanimation)
 * Phase 7 du refactoring : extrait de game.js
 */

const urgenceState = {
    isUrgenceMode: false,
    currentUrgenceNode: null,
    urgenceTimerTimeout: null,
    currentCase: null,
    vitalMonitorInstance: null
};
window.urgenceState = urgenceState;

function renderUrgenceState() {
    if (!urgenceState.isUrgenceMode || !urgenceState.currentUrgenceNode) return;
    const currentUrgenceNode = urgenceState.currentUrgenceNode;
    const currentCase = urgenceState.currentCase;

    // Garde de sortie : éviter de perdre un scénario d'urgence par F5 accidentel
    if (!currentUrgenceNode.isEndState) {
        addBeforeUnloadGuard();
    }

    // Dispatcher l'événement pour l'agent urgence 3D
    document.dispatchEvent(new CustomEvent('urgence-state-render', {
        detail: { node: currentUrgenceNode, caseData: currentCase }
    }));

    const banner = document.getElementById('urgence-description-banner');
    if (banner) {
        banner.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${currentUrgenceNode.descriptionClinique}`;
        banner.style.background = 'rgba(255, 71, 87, 0.3)';
        setTimeout(() => { banner.style.background = 'rgba(255, 71, 87, 0.1)'; }, 1000);
    }

    if (currentUrgenceNode.constantesCibles && urgenceState.vitalMonitorInstance) {
        const cibles = currentUrgenceNode.constantesCibles;
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
        const tEl = document.getElementById('tension'); if (tEl) tEl.textContent = cibles.tension || '';
        const pEl = document.getElementById('pouls'); if (pEl) pEl.textContent = cibles.pouls || '';
        const sEl = document.getElementById('saturationO2'); if (sEl) sEl.textContent = cibles.saturationO2 || '';
        const fEl = document.getElementById('frequenceRespiratoire'); if (fEl) fEl.textContent = cibles.frequenceRespiratoire || '';
    }

    const actionsContainer = document.getElementById('urgence-actions-container');
    if (actionsContainer) {
        actionsContainer.innerHTML = '';
        if (currentUrgenceNode.actionsDisponibles) {
            currentUrgenceNode.actionsDisponibles.forEach((action, index) => {
                const btn = document.createElement('button');
                btn.className = 'urgence-action-btn';
                btn.id = `urg-action-btn-${index}`;

                let icon = 'fa-user-md';
                const label = action.label.toLowerCase();
                if (label.includes('massage') || label.includes('acr') || label.includes('compression')) icon = 'fa-heartbeat';
                if (label.includes('défibrillation') || label.includes('dae') || label.includes('choc')) icon = 'fa-bolt';
                if (label.includes('oxygène') || label.includes('o2') || label.includes('ventilation') || label.includes('libérer')) icon = 'fa-mask-ventilator';
                if (label.includes('médicament') || label.includes('injection') || label.includes('adrénaline') || label.includes('perfusion')) icon = 'fa-syringe';
                if (label.includes('garrot') || label.includes('pansement') || label.includes('hémorragie')) icon = 'fa-band-aid';
                if (label.includes('bilan') || label.includes('samu') || label.includes('appeler')) icon = 'fa-phone-alt';
                if (label.includes('position') || label.includes('pls') || label.includes('debout')) icon = 'fa-person-falling';

                btn.innerHTML = `
                    <i class="fas ${icon}"></i>
                    <span class="btn-text" style="flex:1;">${action.label}</span>
                    <span class="time-badge">-${action.tempsExecutionSec}s</span>
                `;
                btn.onclick = () => executeUrgenceAction(action, btn);
                actionsContainer.appendChild(btn);
            });
        }
    }

    if (urgenceState.urgenceTimerTimeout) clearTimeout(urgenceState.urgenceTimerTimeout);
    if (currentUrgenceNode.evolutionAuto && currentUrgenceNode.evolutionAuto.delaiSecondes) {
        urgenceState.urgenceTimerTimeout = setTimeout(() => {
            showNotification(`⚠️ ALERTE : ${currentUrgenceNode.evolutionAuto.motif}`);
            transitionUrgenceState(currentUrgenceNode.evolutionAuto.nextNode);
        }, currentUrgenceNode.evolutionAuto.delaiSecondes * 1000);
    }

    if (currentUrgenceNode.isEndState) {
        if (urgenceState.urgenceTimerTimeout) clearTimeout(urgenceState.urgenceTimerTimeout);
        if (timerState.timerInterval) clearInterval(timerState.timerInterval);
        removeBeforeUnloadGuard();

        const playedCases = getCookie('playedCases');
        let arr = playedCases ? playedCases.split(',') : [];
        if (!arr.includes(currentCase.id)) {
            arr.push(currentCase.id);
            setCookie('playedCases', arr.join(','), 365);
        }

        // ── Persistance de la session (comme classique/ECOS) ──
        // Sans elle, les urgences n'apparaissent ni dans l'historique,
        // ni dans les badges « Urgentiste », ni dans les stats spécialités.
        persistUrgenceSession(currentCase, currentUrgenceNode);

        setTimeout(() => {
            let html = `<div style="text-align:center; padding: 20px;">`;
            html += `<div style="font-size: 3rem; margin-bottom: 20px;">${currentUrgenceNode.success ? '<i class="fas fa-heart-pulse" style="color: #2ecc71; text-shadow: 0 0 20px rgba(46, 204, 113, 0.5);"></i>' : '<i class="fas fa-skull-crossbones" style="color: #ff4757; text-shadow: 0 0 20px rgba(255, 71, 87, 0.5);"></i>'}</div>`;
            html += `<h2 style="font-family: var(--font-title); font-size: 2rem; color: ${currentUrgenceNode.success ? '#2ecc71' : '#ff4757'};">${currentUrgenceNode.success ? 'PATIENT SAUVÉ !' : 'ÉCHEC CRITIQUE'}</h2>`;
            html += `<div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid rgba(255,255,255,0.1);">
                        <p style="font-size: 1.1rem; line-height: 1.6; margin: 0;">${currentUrgenceNode.descriptionClinique}</p>
                     </div>`;

            if (currentUrgenceNode.xpReward > 0) {
                html += `<div style="background: linear-gradient(90deg, rgba(0, 242, 254, 0.1), rgba(179, 136, 255, 0.1)); border: 1px solid var(--primary-color); padding: 15px; border-radius: 10px; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; gap: 10px;">
                            <i class="fas fa-star" style="color: #ffb347;"></i>
                            <span style="font-weight: 800; font-family: var(--font-title); letter-spacing: 1px;">+${currentUrgenceNode.xpReward} XP GAGNÉS</span>
                         </div>`;
            }

            if (currentCase.correction) {
                html += `<div style="text-align: left; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; font-size: 0.95rem; opacity: 0.9;">
                            <h3 style="color: var(--primary-color); font-size: 1rem; text-transform: uppercase; margin-bottom: 10px;">CORRECTION & PROTOCOLE</h3>
                            ${currentCase.correction}
                         </div>`;
            }
            html += `</div>`;

            showCorrectionModal(html);

            if (currentUrgenceNode.success) {
                if (uiState.fireworksInstance) {
                    try { uiState.fireworksInstance.stop(); } catch(e) {}
                }
            } else {
                try {
                    const failSound = new Audio('assets/sounds/Wrong Buzzer.mp3');
                    failSound.play().catch(() => {});
                } catch(e) {}
            }

            if (currentUrgenceNode.xpReward && currentUrgenceNode.xpReward > 0) {
                awardUrgenceXp(currentUrgenceNode.xpReward);
            }
        }, 1000);
    }
}

async function awardUrgenceXp(xpAmount) {
    if (!xpAmount || xpAmount <= 0) return;
    try {
        if (typeof addXp === 'function') {
            await addXp(xpAmount);
        } else if (typeof setLocalXp === 'function' && typeof getLocalXp === 'function') {
            setLocalXp(getLocalXp() + xpAmount);
        }
        showNotification(`Tu as gagné ${xpAmount} XP !`, 'success');
    } catch (error) {
        console.error("Erreur lors de l'attribution de l'XP urgence :", error);
    }
}

/**
 * Enregistre la session d'urgence (local + Supabase play_sessions).
 * @param {object} currentCase
 * @param {object} endNode — nœud final (isEndState)
 */
function persistUrgenceSession(currentCase, endNode) {
    const score = endNode.success ? 100 : 0;
    const durationSeconds = timerState.totalTime
        ? Math.max(0, timerState.totalTime - Math.max(0, timerState.timeLeft))
        : 0;

    const stats = {
        mode: 'urgence',
        success: !!endNode.success,
        xpEarned: endNode.xpReward || 0,
        endNodeId: endNode.id || null,
        compositeScore: score,
        demarcheScore: null,
        diagnosticScore: null,
        traitementScore: null,
        vitesseScore: null,
        stars: endNode.success ? 3 : 0
    };

    // LocalStorage pour les stats offline
    try {
        const stored = JSON.parse(localStorage.getItem('urgence_sessions') || '[]');
        stored.push({ case_id: currentCase.id, score, success: !!endNode.success, ts: Date.now(), durationSeconds });
        if (stored.length > 200) stored.splice(0, stored.length - 200);
        localStorage.setItem('urgence_sessions', JSON.stringify(stored));
    } catch (e) { console.warn('[Urgence] localStorage write failed:', e); }

    // Supabase si connecté
    if (typeof supabase !== 'undefined' && supabase.auth) {
        supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (!user) return;
            try {
                await supabase.from('play_sessions').insert([{
                    user_id: user.id,
                    case_id: currentCase.id,
                    score,
                    stats,
                    duration_seconds: durationSeconds,
                    mode: 'urgence'
                }]);
            } catch (e) {
                console.warn('[Urgence] Erreur enregistrement session Supabase :', e);
            }
        }).catch(() => {});
    }

    // ── Badges : évaluation + notification (badge Urgentiste désormais atteignable) ──
    if (window.BadgeSystem && typeof window.BadgeSystem.evaluateAndPersist === 'function') {
        try {
            const localSessions = JSON.parse(localStorage.getItem('urgence_sessions') || '[]')
                .map(s => ({ case_id: s.case_id, score: s.score, mode: 'urgence' }));
            const fresh = window.BadgeSystem.evaluateAndPersist(localSessions, null);
            window.BadgeSystem.notifyNewBadges(fresh);
        } catch (e) { console.warn('[Urgence] Badge evaluation failed:', e); }
    }
}

/**
 * Garde de sortie pendant un scénario d'urgence en cours.
 */
function addBeforeUnloadGuard() {
    window.addEventListener('beforeunload', urgenceBeforeUnload);
}
function removeBeforeUnloadGuard() {
    window.removeEventListener('beforeunload', urgenceBeforeUnload);
}
function urgenceBeforeUnload(e) {
    if (urgenceState.isUrgenceMode && !urgenceState.currentUrgenceNode?.isEndState) {
        e.preventDefault();
        e.returnValue = '';
        return '';
    }
}

function executeUrgenceAction(action, clickedButton) {
    if (urgenceState.urgenceTimerTimeout) clearTimeout(urgenceState.urgenceTimerTimeout);

    const actionsContainer = document.getElementById('urgence-actions-container');
    if (actionsContainer) {
        const buttons = actionsContainer.querySelectorAll('.urgence-action-btn');
        buttons.forEach(b => {
            b.disabled = true;
            b.style.opacity = '0.5';
            b.style.cursor = 'not-allowed';
        });
    }

    const originalContent = clickedButton.innerHTML;
    clickedButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> En cours (${action.tempsExecutionSec}s)...`;
    clickedButton.style.opacity = '1';
    clickedButton.style.background = 'var(--primary-color)';
    clickedButton.style.color = '#000';

    if (window.deductTime) {
        window.deductTime(action.tempsExecutionSec);
    }

    // Délai réel aligné sur le coût affiché (borné pour l'UX) :
    // le badge "-Xs" correspond désormais à la vraie attente ressentie.
    const realDelayMs = Math.min(7000, Math.max(2500, (action.tempsExecutionSec || 5) * 1000));
    setTimeout(() => {
        if (action.feedback) {
            showNotification(action.feedback);
        }
        transitionUrgenceState(action.nextNode);
    }, realDelayMs);
}

function transitionUrgenceState(nextNodeId) {
    const currentCase = urgenceState.currentCase;
    if (!currentCase.nodes || !currentCase.nodes[nextNodeId]) {
        console.error("Unknown node:", nextNodeId);
        return;
    }
    urgenceState.currentUrgenceNode = currentCase.nodes[nextNodeId];

    // Dispatcher l'événement de transition pour l'agent urgence 3D
    document.dispatchEvent(new CustomEvent('urgence-state-transition', {
        detail: { newNode: currentCase.nodes[nextNodeId] }
    }));

    renderUrgenceState();
}
