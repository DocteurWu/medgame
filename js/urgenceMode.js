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

function renderUrgenceState() {
    if (!urgenceState.isUrgenceMode || !urgenceState.currentUrgenceNode) return;
    const currentUrgenceNode = urgenceState.currentUrgenceNode;
    const currentCase = urgenceState.currentCase;

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

        const playedCases = getCookie('playedCases');
        let arr = playedCases ? playedCases.split(',') : [];
        if (!arr.includes(currentCase.id)) {
            arr.push(currentCase.id);
            setCookie('playedCases', arr.join(','), 365);
        }

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
                    const failSound = new Audio('assets/sounds/flatline.mp3');
                    failSound.play().catch(e => console.log('No fail sound playing'));
                } catch(e) {}
            }

            if (currentUrgenceNode.xpReward && currentUrgenceNode.xpReward > 0) {
                awardUrgenceXp(currentUrgenceNode.xpReward);
            }
        }, 1000);
    }
}

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
                showNotification(`Tu as gagné ${xpAmount} XP !`, 'success');
            }
        }
    } catch (error) {
        console.error("Erreur lors de l'attribution de l'XP :", error);
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

    const REAL_DELAY_MS = 5000;
    setTimeout(() => {
        if (action.feedback) {
            showNotification(action.feedback);
        }
        transitionUrgenceState(action.nextNode);
    }, REAL_DELAY_MS);
}

function transitionUrgenceState(nextNodeId) {
    const currentCase = urgenceState.currentCase;
    if (!currentCase.nodes || !currentCase.nodes[nextNodeId]) {
        console.error("Unknown node:", nextNodeId);
        return;
    }
    urgenceState.currentUrgenceNode = currentCase.nodes[nextNodeId];
    renderUrgenceState();
}
