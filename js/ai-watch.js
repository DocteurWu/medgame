/**
 * js/ai-watch.js
 * Spectator client bridge for ai-watch.html.
 * Connects to the local WebSocket server to render the 3D patient and update HUD dashboards in real-time.
 */

// Toast notification helper
window.showWatchToast = function(msg, icon = 'info-circle') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fas fa-${icon}"></i> <span>${msg}</span>`;
    container.appendChild(toast);

    // Auto-remove toast after 4 seconds
    setTimeout(() => {
        toast.remove();
    }, 4000);
};

async function initSpectator3D() {
    const container = document.getElementById('scene-container');
    console.log('[AI Watch] Initializing ThreeManager in spectator mode...');
    
    try {
        await window.threeManager.enable3D(container);
        console.log('[AI Watch] ThreeManager successfully enabled!');
        
        // Expose orbit controls for spectator freedom
        const sceneObj = window.threeManager.scene;
        if (sceneObj && sceneObj.controls) {
            sceneObj.controls.enableRotate = true;
            sceneObj.controls.enableZoom = true;
            sceneObj.controls.enablePan = true;
            console.log('[AI Watch] OrbitControls enabled for spectator navigation.');
        }

        // Adjust camera angle slightly for better spectator overview
        if (sceneObj && sceneObj.camera) {
            sceneObj.camera.position.set(2.5, 2.2, 3.5);
            sceneObj.controls.target.set(3.5, 0.8, 0.2); // Point towards the patient bed
            sceneObj.controls.update();
        }

    } catch (err) {
        console.error('[AI Watch] Error initializing 3D Scene:', err);
        window.showWatchToast('Erreur d\'initialisation 3D', 'exclamation-triangle');
    }
}

function updateHUD(state) {
    if (!state) return;

    // Case Info
    document.getElementById('val-patient').textContent = `${state.patient?.prenom || ''} ${state.patient?.nom || 'Inconnu'}`;
    document.getElementById('val-specialty').textContent = state.specialty || 'Général';
    document.getElementById('val-difficulty').textContent = '★'.repeat(state.difficulty || 1);
    
    // Timer format mm:ss
    const min = Math.floor(state.timeLeft / 60);
    const sec = state.timeLeft % 60;
    document.getElementById('val-timer').textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;

    // Vitals Monitor
    document.getElementById('vit-fc').textContent = state.vitals?.heartRate || '—';
    document.getElementById('vit-pa').textContent = (state.vitals?.systolic && state.vitals?.diastolic) 
        ? `${state.vitals.systolic}/${state.vitals.diastolic}` 
        : '—';
    document.getElementById('vit-spo2').textContent = state.vitals?.spo2 || '—';
    document.getElementById('vit-fr').textContent = state.vitals?.respiratoryRate || '—';
    document.getElementById('vit-temp').textContent = state.vitals?.temperature !== undefined ? `${state.vitals.temperature}` : '—';
    document.getElementById('vit-douleur').textContent = state.vitals?.painLevel !== undefined ? `${state.vitals.painLevel}` : '—';

    // Highlight critical/warning vitals
    const updateVitalColor = (elId, key, value) => {
        const el = document.getElementById(elId);
        if (!el || value === '—') return;
        const thresholds = window.VITAL_THRESHOLDS?.[key];
        if (!thresholds) return;
        
        el.style.color = '#00ff00'; // reset
        if (value <= thresholds.criticalLow || value >= thresholds.criticalHigh) {
            el.style.color = '#ff4757'; // critical red
        } else if (value <= thresholds.warningLow || value >= thresholds.warningHigh) {
            el.style.color = '#ffa502'; // warning orange
        }
    };
    updateVitalColor('vit-fc', 'heartRate', state.vitals?.heartRate);
    updateVitalColor('vit-spo2', 'spo2', state.vitals?.spo2);
    updateVitalColor('vit-fr', 'respiratoryRate', state.vitals?.respiratoryRate);
    updateVitalColor('vit-temp', 'temperature', state.vitals?.temperature);

    // Chat Feed
    const chatContainer = document.getElementById('chat-feed-container');
    if (chatContainer && state.chatHistory) {
        chatContainer.innerHTML = '';
        state.chatHistory.forEach(msg => {
            const bubble = document.createElement('div');
            const isUser = msg.role === 'user';
            bubble.className = `chat-bubble ${isUser ? 'bubble-user' : 'bubble-patient'}`;
            
            const sender = isUser ? 'Médecin' : 'Patient';
            bubble.innerHTML = `<span class="bubble-sender ${isUser ? 'bubble-sender-user' : 'bubble-sender-patient'}">${sender}</span> ${msg.content}`;
            chatContainer.appendChild(bubble);
        });
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Locks Checklist
    const locksList = document.getElementById('locks-list');
    if (locksList && state.locks) {
        locksList.innerHTML = '';
        state.locks.forEach(lock => {
            const item = document.createElement('div');
            item.className = `checklist-item ${lock.unlocked ? 'checked' : ''}`;
            item.innerHTML = lock.unlocked
                ? `<i class="fas fa-lock-open"></i> <span>${lock.id.replace('lock_', '')} (Résolu)</span>`
                : `<i class="fas fa-lock"></i> <span style="opacity: 0.6;">${lock.id.replace('lock_', '')}</span>`;
            locksList.appendChild(item);
        });
    }

    // Exams & Treatments Checklist
    const examsList = document.getElementById('exams-list');
    if (examsList) {
        examsList.innerHTML = '';
        // Prescribed treatments
        const txs = state.prescriptions?.selectedTreatments || [];
        txs.forEach(tx => {
            const item = document.createElement('div');
            item.className = 'checklist-item checked';
            item.innerHTML = `<i class="fas fa-prescription-bottle-alt"></i> <span>Prescrit: ${tx}</span>`;
            examsList.appendChild(item);
        });
        // Ordered exams
        const exms = state.activeExams || [];
        exms.forEach(ex => {
            const item = document.createElement('div');
            item.className = 'checklist-item checked';
            item.innerHTML = `<i class="fas fa-file-medical-alt"></i> <span>Examen: ${ex}</span>`;
            examsList.appendChild(item);
        });
        
        if (txs.length === 0 && exms.length === 0) {
            examsList.innerHTML = '<div style="font-size:0.75rem;color:var(--text-muted)">Aucune action prescrite</div>';
        }
    }

    // Score & Stars
    const scoreVal = document.getElementById('score-percentage');
    if (scoreVal) {
        scoreVal.textContent = state.isFinished ? `${state.score}%` : 'En cours';
    }
    
    // Stars
    const starsContainer = document.getElementById('stars-container');
    if (starsContainer) {
        const compositeResult = state.isFinished ? state.score : 0;
        const numStars = state.isFinished ? (compositeResult >= 90 ? 3 : (compositeResult >= 70 ? 2 : (compositeResult >= 40 ? 1 : 0))) : 0;
        
        starsContainer.innerHTML = '';
        for (let i = 1; i <= 3; i++) {
            const star = document.createElement('i');
            star.className = `fas fa-star ${i <= numStars ? '' : 'inactive'}`;
            starsContainer.appendChild(star);
        }
    }
}

function update3DScene(state, eventType) {
    const sceneObj = window.threeManager.scene;
    if (!sceneObj) return;

    // 1. Sync shims
    window.gameState.currentCase = {
        patient: state.patient,
        locks: state.locks,
        examResults: state.examResults
    };
    window.vitalSigns.props = state.vitals;

    // 2. Auto-load patient on case start, state sync, or change
    if ((eventType === 'case_started' || eventType === 'state_changed') && window.threeManager) {
        if (state.patient && (!window.currentLoadedPatientNom || window.currentLoadedPatientNom !== state.patient.nom)) {
            console.log('[AI Watch] Loading patient GLB/Procedural...');
            window.threeManager.loadCase({ patient: state.patient });
            window.currentLoadedPatientNom = state.patient.nom;
            if (eventType === 'case_started') {
                window.showWatchToast(`Nouveau cas chargé : ${state.caseTitle}`, 'briefcase-medical');
            }
        }
    }

    // 3. Update ECG Monitor rates
    if (sceneObj.ecgAnimator && state.vitals?.heartRate) {
        sceneObj.ecgAnimator.heartRate = state.vitals.heartRate;
    }
    if (sceneObj.wallEcgAnimator && state.vitals?.heartRate) {
        sceneObj.wallEcgAnimator.heartRate = state.vitals.heartRate;
    }

    // 4. Handle expression animations on chat reply
    if (eventType === 'chat_reply' && sceneObj.patient) {
        // Try to check if LLM changed expression (e.g. grimace, pain)
        const expression = state.patient?.expression || 'normal';
        sceneObj.patient.applyExpression(expression);
    }
}

function connect() {
    const PORT = 8081;
    const wsUrl = `ws://127.0.0.1:${PORT}`;
    console.log(`[AI Watch] Connecting to spectator WebSocket server at ${wsUrl}...`);
    
    const ws = new WebSocket(wsUrl);
    const statusEl = document.getElementById('conn-status');

    ws.onopen = () => {
        console.log('[AI Watch] Spectator Connected!');
        statusEl.className = 'status-connected';
        statusEl.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:currentColor;display:inline-block;animation: pulse 1.5s infinite;"></span> Connecté';
        window.showWatchToast('Spectateur connecté à la simulation !', 'link');

        // Turn widget border cyan
        document.querySelectorAll('.widget').forEach(w => w.classList.add('connected-widget'));
    };

    ws.onmessage = (event) => {
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch (e) {
            console.error('[AI Watch] Failed to parse message JSON:', event.data);
            return;
        }

        console.log('[AI Watch] Broadcast event received:', msg);
        
        // Update both HUD and 3D
        updateHUD(msg.state);
        update3DScene(msg.state, msg.type);

        // Display event specific toast notifications
        if (msg.type === 'chat_reply') {
            window.showWatchToast('IA: Intervention libre soumise', 'user-md');
        } else if (msg.type === 'exams_ordered') {
            window.showWatchToast('IA: Examens complémentaires ordonnés (+2 min)', 'file-medical');
        } else if (msg.type === 'lock_resolved') {
            const detail = msg.details || {};
            if (detail.unlocked) {
                window.showWatchToast(`Défi résolu : ${detail.lockId.replace('lock_', '')}`, 'unlock');
            } else {
                window.showWatchToast(`Défi échoué : ${detail.lockId.replace('lock_', '')}`, 'lock');
            }
        } else if (msg.type === 'case_submitted') {
            window.showWatchToast(`IA: Cas validé avec un score de ${msg.state.score}%`, 'award');
        }
    };

    ws.onclose = () => {
        console.warn('[AI Watch] Connection closed. Retrying in 4 seconds...');
        statusEl.className = 'status-disconnected';
        statusEl.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:currentColor;display:inline-block;"></span> Déconnecté';
        
        document.querySelectorAll('.widget').forEach(w => w.classList.remove('connected-widget'));

        setTimeout(connect, 4000);
    };

    ws.onerror = (err) => {
        console.error('[AI Watch] WebSocket error:', err.message);
    };
}

// Initialise Three scene, then connect websocket
document.addEventListener('DOMContentLoaded', async () => {
    await initSpectator3D();
    connect();
});
