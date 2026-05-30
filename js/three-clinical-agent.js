/**
 * three-clinical-agent.js — Examen Clinique Interactif en 3D
 * 
 * Gère un système complet d'investigation médicale :
 * - Menu d'action contextuel selon la zone cliquée (Torse, Abdomen, Membres)
 * - Cartes de résultats immersives avec données du cas
 * - Suivi des zones examinées et de la démarche médicale
 * - Réactions physiologiques (grimace de douleur, son d'auscultation)
 * - Panel de progression clinique affiché dans le HUD
 */

export class ThreeClinicalAgent {
    constructor(manager) {
        this.manager = manager;
        this.hudElement = document.getElementById('three-hud');
        this.activeMenu = null;

        // Suivi des examens effectués (clé = actionId)
        this.examinedActions = new Set();

        // Panneau de progression clinique
        this._progressPanel = null;
        this._initProgressPanel();
    }

    // ========== PANNEAU DE PROGRESSION CLINIQUE ==========

    _initProgressPanel() {
        const existing = document.getElementById('clinical-progress-panel');
        if (existing) { this._progressPanel = existing; return; }

        const panel = document.createElement('div');
        panel.id = 'clinical-progress-panel';
        panel.style.cssText = `
            position: fixed;
            top: 80px;
            right: 16px;
            background: rgba(5, 10, 25, 0.88);
            border: 1px solid rgba(0, 242, 254, 0.25);
            border-radius: 10px;
            padding: 12px 14px;
            z-index: 9999;
            min-width: 190px;
            font-family: 'Segoe UI', system-ui, sans-serif;
            font-size: 12px;
            color: rgba(255,255,255,0.85);
            backdrop-filter: blur(6px);
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            pointer-events: none;
        `;

        const ALL_ACTIONS = [
            { id: 'auscultation_cardio', label: 'Auscultation cardiaque', icon: '🫀' },
            { id: 'auscultation_pneumo', label: 'Auscultation pulmonaire', icon: '🫁' },
            { id: 'palpation_abdo',     label: 'Palpation abdominale', icon: '🤲' },
            { id: 'inspection',         label: 'Inspection générale', icon: '👁️' },
            { id: 'reflex_osteo',       label: 'Réflexes ostéo-tendineux', icon: '🔨' },
            { id: 'palpation_membre',   label: 'Palpation des membres', icon: '🦵' },
        ];

        const title = document.createElement('div');
        title.style.cssText = 'color: #00f2fe; font-weight: 700; font-size: 11px; letter-spacing: 1px; margin-bottom: 10px; text-transform: uppercase;';
        title.textContent = '📋 Examen Clinique';
        panel.appendChild(title);

        this._progressItems = {};
        ALL_ACTIONS.forEach(a => {
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; align-items: center; gap: 7px; padding: 4px 0; opacity: 0.4; transition: opacity 0.3s, color 0.3s;';
            row.id = `clinical-prog-${a.id}`;

            const check = document.createElement('span');
            check.style.cssText = 'font-size: 12px; width: 16px; text-align: center;';
            check.textContent = '○';
            check.id = `clinical-check-${a.id}`;

            const lbl = document.createElement('span');
            lbl.style.cssText = 'font-size: 11px;';
            lbl.textContent = `${a.icon} ${a.label}`;

            row.appendChild(check);
            row.appendChild(lbl);
            panel.appendChild(row);
            this._progressItems[a.id] = { row, check };
        });

        document.body.appendChild(panel);
        this._progressPanel = panel;
    }

    _markExamDone(actionId) {
        this.examinedActions.add(actionId);
        const item = this._progressItems?.[actionId];
        if (item) {
            item.row.style.opacity = '1';
            item.row.style.color = '#00f2fe';
            item.check.textContent = '✓';
            item.check.style.color = '#00cc88';
        }
    }

    // ========== MENU D'EXAMEN CONTEXTUEL ==========

    openExaminationMenu(zone) {
        if (this.activeMenu) this.closeExaminationMenu();

        const menu = document.createElement('div');
        menu.id = 'clinical-exam-menu';
        menu.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.9);
            background: linear-gradient(145deg, rgba(5,12,30,0.97), rgba(8,18,45,0.97));
            border: 1px solid rgba(0, 200, 255, 0.4);
            border-radius: 14px;
            padding: 22px 24px;
            z-index: 10001;
            display: flex;
            flex-direction: column;
            gap: 10px;
            box-shadow: 0 0 40px rgba(0,120,200,0.3), 0 0 80px rgba(0,0,0,0.6);
            backdrop-filter: blur(12px);
            min-width: 270px;
            animation: examMenuIn 0.2s ease forwards;
        `;

        let title = '';
        let subtitle = '';
        let actions = [];

        if (zone === 'torse') {
            title = '🫀 Examen Thoracique';
            subtitle = 'Auscultation cardiaque et pulmonaire';
            actions = [
                { label: 'Auscultation Cardiaque', icon: 'fas fa-stethoscope', id: 'auscultation_cardio', done: this.examinedActions.has('auscultation_cardio') },
                { label: 'Auscultation Pulmonaire', icon: 'fas fa-lungs', id: 'auscultation_pneumo', done: this.examinedActions.has('auscultation_pneumo') }
            ];
        } else if (zone === 'abdomen') {
            title = '🤲 Examen Abdominal';
            subtitle = 'Palpation et percussion';
            actions = [
                { label: 'Palpation Abdominale', icon: 'fas fa-hand-paper', id: 'palpation_abdo', done: this.examinedActions.has('palpation_abdo') }
            ];
        } else if (zone === 'membre') {
            title = '🦵 Examen des Membres';
            subtitle = 'Palpation et réflexes';
            actions = [
                { label: 'Palpation des membres', icon: 'fas fa-hand-paper', id: 'palpation_membre', done: this.examinedActions.has('palpation_membre') },
                { label: 'Réflexes ostéo-tendineux', icon: 'fas fa-bolt', id: 'reflex_osteo', done: this.examinedActions.has('reflex_osteo') }
            ];
        } else {
            title = '👨‍⚕️ Interaction Patient';
            subtitle = 'Choisissez votre action';
            actions = [
                { label: 'Interroger le patient', icon: 'fas fa-comments', id: 'interroger', done: false },
                { label: 'Inspection Générale', icon: 'fas fa-eye', id: 'inspection', done: this.examinedActions.has('inspection') },
                { label: 'Brancher le scope multiparamétrique', icon: 'fas fa-heartbeat', id: 'brancher_scope', done: this.examinedActions.has('brancher_scope') }
            ];
        }

        const doneCount = actions.filter(a => a.done).length;
        const progressPct = actions.length ? Math.round((doneCount / actions.length) * 100) : 0;

        let html = `
            <div style="border-bottom: 1px solid rgba(0,200,255,0.2); padding-bottom: 12px; margin-bottom: 4px;">
                <div style="color: #00f2fe; font-weight: 700; font-size: 15px; margin-bottom: 3px;">${title}</div>
                <div style="color: rgba(180,210,240,0.7); font-size: 11px;">${subtitle}</div>
                <div style="margin-top: 8px; height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px;">
                    <div style="height: 100%; width: ${progressPct}%; background: linear-gradient(90deg, #00f2fe, #00cc88); border-radius: 2px; transition: width 0.5s;"></div>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
        `;

        actions.forEach(act => {
            const doneStyle = act.done ? 'opacity: 0.55; border-color: rgba(0,200,100,0.4);' : '';
            const checkmark = act.done ? ' <span style="color:#00cc88; margin-left: auto;">✓</span>' : '';
            html += `
                <button data-action="${act.id}" style="
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 11px 14px;
                    background: rgba(0,150,200,0.1);
                    border: 1px solid rgba(0,200,255,0.2);
                    border-radius: 8px;
                    color: #e0f0ff;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.15s;
                    ${doneStyle}
                " onmouseover="this.style.background='rgba(0,150,200,0.25)'" onmouseout="this.style.background='rgba(0,150,200,0.1)'">
                    <i class="${act.icon}" style="width: 18px; color: #00c8ff;"></i>
                    ${act.label}
                    ${checkmark}
                </button>`;
        });

        html += `</div>
            <button id="close-exam-menu" style="
                margin-top: 6px;
                padding: 8px;
                width: 100%;
                background: rgba(255,255,255,0.06);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 8px;
                color: rgba(255,255,255,0.5);
                font-size: 12px;
                cursor: pointer;
            ">✕ Fermer</button>`;

        menu.innerHTML = html;
        document.body.appendChild(menu);
        this.activeMenu = menu;

        // Injecter le keyframe si absent
        if (!document.getElementById('clinical-keyframes')) {
            const style = document.createElement('style');
            style.id = 'clinical-keyframes';
            style.textContent = `
                @keyframes examMenuIn { from { transform: translate(-50%,-50%) scale(0.9); opacity:0; } to { transform: translate(-50%,-50%) scale(1); opacity:1; } }
                @keyframes cardSlideIn { from { transform: translateX(40px); opacity:0; } to { transform: translateX(0); opacity:1; } }
                @keyframes cardSlideOut { from { opacity:1; } to { transform: translateX(30px); opacity:0; } }
            `;
            document.head.appendChild(style);
        }

        document.getElementById('close-exam-menu').addEventListener('click', () => this.closeExaminationMenu());

        menu.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const actionId = e.currentTarget.dataset.action;
                this.performAction(actionId);
                this.closeExaminationMenu();
            });
        });
    }

    closeExaminationMenu() {
        if (this.activeMenu?.parentNode) {
            this.activeMenu.parentNode.removeChild(this.activeMenu);
        }
        this.activeMenu = null;
    }

    // ========== EXÉCUTION D'UNE ACTION CLINIQUE ==========

    performAction(actionId) {
        if (!this.manager || !this.manager.currentCase) {
            this.manager?.hud?.showNotification('Aucun cas chargé.', 'warning');
            return;
        }

        const caseData = this.manager.currentCase;
        const exam = caseData.examenClinique || {};
        let resultText = 'Examen normal.';
        let title = 'Résultat';
        let icon = 'fas fa-info-circle';
        let severity = 'normal'; // 'normal' | 'warning' | 'critical'

        switch (actionId) {
            case 'auscultation_cardio': {
                title = 'Auscultation Cardiaque';
                icon = 'fas fa-heartbeat';
                const raw = exam.examenCardiovasculaire?.auscultation || '';
                resultText = raw || 'Bruits du cœur réguliers, pas de souffle audible.';
                // Analyse clinique
                const rl = resultText.toLowerCase();
                if (rl.includes('souffle') || rl.includes('crépitant') || rl.includes('galop')) severity = 'warning';
                if (rl.includes('râle') || rl.includes('frottement') || rl.includes('galop de galop')) severity = 'critical';
                this._playAuscultationSound(rl);
                break;
            }
            case 'auscultation_pneumo': {
                title = 'Auscultation Pulmonaire';
                icon = 'fas fa-lungs';
                const raw = exam.examenPulmonaire?.auscultation || '';
                resultText = raw || 'Murmure vésiculaire symétrique, pas de râle.';
                const rl = resultText.toLowerCase();
                if (rl.includes('crépitant') || rl.includes('sibilant') || rl.includes('diminué')) severity = 'warning';
                if (rl.includes('abolit') || rl.includes('stridor')) severity = 'critical';
                this._playAuscultationSound(rl);
                break;
            }
            case 'palpation_abdo': {
                title = 'Palpation Abdominale';
                icon = 'fas fa-hand-paper';
                const raw = exam.examenAbdominal?.palpation || '';
                resultText = raw || 'Abdomen souple, indolore, dépressible. Pas de masse. Pas de défense.';
                const rl = resultText.toLowerCase();
                if (rl.includes('sensibilité') || rl.includes('douleur')) severity = 'warning';
                if (rl.includes('défense') || rl.includes('contracture') || rl.includes('ascite')) severity = 'critical';
                this._checkPalpationPain(rl);
                break;
            }
            case 'palpation_membre': {
                title = 'Palpation des Membres';
                icon = 'fas fa-hand-paper';
                const raw = exam.examenNeurologique?.motricite || exam.examenMembre?.palpation || '';
                resultText = raw || 'Membres sans oedème, pouls distaux présents et symétriques.';
                const rl = resultText.toLowerCase();
                if (rl.includes('oedème') || rl.includes('douleur') || rl.includes('phlébite')) severity = 'warning';
                if (rl.includes('abolit') || rl.includes('ischémie') || rl.includes('nécrose')) severity = 'critical';
                break;
            }
            case 'reflex_osteo': {
                title = 'Réflexes Ostéo-Tendineux';
                icon = 'fas fa-bolt';
                const raw = exam.examenNeurologique?.reflexes || '';
                resultText = raw || 'Réflexes rotuliens et achilléens présents et symétriques (2+).';
                const rl = resultText.toLowerCase();
                if (rl.includes('diminué') || rl.includes('asymétrique') || rl.includes('vif')) severity = 'warning';
                if (rl.includes('aboli') || rl.includes('clonus') || rl.includes('signe de babinski')) severity = 'critical';
                // Déclencher un petit mouvement du patient
                this._triggerReflexAnimation();
                break;
            }
            case 'inspection': {
                title = 'Inspection Générale';
                icon = 'fas fa-eye';
                resultText = exam.aspectGeneral || `Patient ${caseData.patient?.sexe === 'F' ? 'consciente' : 'conscient'}, orienté(e) temporo-spatialement. Pas de détresse respiratoire apparente.`;
                const rl = resultText.toLowerCase();
                if (rl.includes('pâle') || rl.includes('dyspnée') || rl.includes('sueur')) severity = 'warning';
                if (rl.includes('cyanose') || rl.includes('détresse') || rl.includes('inconscient')) severity = 'critical';
                break;
            }
            case 'interroger': {
                if (this.manager) {
                    this.manager.openPatientDialog();
                    this.manager.hud?.showPrompt('Posez une question au patient...');
                    window.scoringState && (window.scoringState.hasAskedPatient = true);
                }
                return;
            }
            case 'brancher_scope': {
                title = 'Scope Multiparamétrique';
                icon = 'fas fa-heartbeat';
                resultText = 'Scope multiparamétrique branché avec succès : Électrodes ECG en place, capteur de SpO₂ connecté au doigt et brassard à tension installé.';
                severity = 'normal';
                
                if (this.manager) {
                    this.manager.isScopeConnected = true;
                    if (this.manager.hud) {
                        this.manager.hud.showNotification('🔌 Scope connecté : ECG et constantes affichés en continu.', 'success');
                        this.manager.hud._updateVitals();
                    }
                }
                break;
            }
        }

        this._showResultCard(title, resultText, icon, severity);
        this._markExamDone(actionId);

        // Tracking démarche
        if (window.scoringState) {
            if (!window.scoringState.examsPerformed) window.scoringState.examsPerformed = new Set();
            window.scoringState.examsPerformed.add(actionId);
        }

        // Suivi de l'examen clinique (section-viewed)
        document.dispatchEvent(new CustomEvent('section-viewed', {
            detail: { sectionId: 'section-examen-clinique' }
        }));
    }

    // ========== HELPERS PHYSIOLOGIQUES ==========

    _playAuscultationSound(textLower) {
        if (!window.medicalAudio) return;
        // Différenciation par contenu clinique
        if (typeof window.medicalAudio.playMeasureSound === 'function') {
            window.medicalAudio.playMeasureSound();
        }
    }

    _checkPalpationPain(textLower) {
        const isPainful = textLower.includes('douleur') || textLower.includes('défense')
            || textLower.includes('defense') || textLower.includes('sensibilité')
            || textLower.includes('contracture');

        if (isPainful && this.manager?.hud) {
            this.manager.hud._applyFacialExpression('douleur', 1.0);
            // Retour à l'expression de base après 2.5s
            setTimeout(() => this.manager.hud._resetFacialExpression(), 2500);
        }
    }

    _triggerReflexAnimation() {
        // Déclenche l'expression 'anxieux' brièvement pour simuler la surprise du réflexe
        if (this.manager?.hud) {
            this.manager.hud._applyFacialExpression('anxieux', 0.3);
            setTimeout(() => this.manager.hud._resetFacialExpression(), 800);
        }
    }

    // ========== CARTE DE RÉSULTAT CLINIQUE ==========

    _showResultCard(title, text, iconClass, severity = 'normal') {
        // Supprimer une éventuelle carte précédente de même type
        const existing = document.getElementById('clinical-result-card');
        if (existing) existing.remove();

        const borderColors = {
            normal: '#00f2fe',
            warning: '#ffc107',
            critical: '#ff4757'
        };
        const glowColors = {
            normal: 'rgba(0,242,254,0.15)',
            warning: 'rgba(255,193,7,0.15)',
            critical: 'rgba(255,71,87,0.2)'
        };
        const borderColor = borderColors[severity] || borderColors.normal;
        const glowColor = glowColors[severity] || glowColors.normal;

        const card = document.createElement('div');
        card.id = 'clinical-result-card';
        card.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: linear-gradient(145deg, rgba(5,12,30,0.97), rgba(8,18,45,0.95));
            border-left: 4px solid ${borderColor};
            border-radius: 10px;
            padding: 16px 18px;
            z-index: 10000;
            width: 320px;
            box-shadow: 0 6px 24px rgba(0,0,0,0.6), 0 0 20px ${glowColor};
            color: #fff;
            font-family: 'Segoe UI', system-ui, sans-serif;
            animation: cardSlideIn 0.3s ease-out;
        `;

        const severityLabel = severity === 'critical' ? '<span style="color:#ff4757; font-size:10px; font-weight:700; background:rgba(255,71,87,0.15); padding:2px 6px; border-radius:4px; margin-left:8px;">ANORMAL</span>'
            : severity === 'warning' ? '<span style="color:#ffc107; font-size:10px; font-weight:700; background:rgba(255,193,7,0.1); padding:2px 6px; border-radius:4px; margin-left:8px;">NOTABLE</span>'
            : '';

        card.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <i class="${iconClass}" style="color: ${borderColor}; font-size: 1.1rem; margin-right: 9px; flex-shrink:0;"></i>
                <span style="font-weight: 700; font-size: 13px; color: ${borderColor};">${title}</span>
                ${severityLabel}
            </div>
            <div style="font-size: 12.5px; color: #c8d8ee; line-height: 1.55; border-top: 1px solid rgba(255,255,255,0.07); padding-top: 9px;">
                ${text}
            </div>
            <div style="margin-top: 10px; font-size: 10px; color: rgba(255,255,255,0.3); display: flex; justify-content: space-between;">
                <span>📋 Noté dans le dossier</span>
                <span id="clinical-card-timer">5s</span>
            </div>
        `;

        document.body.appendChild(card);

        // Countdown
        let remaining = 5;
        const timerEl = document.getElementById('clinical-card-timer');
        const countdown = setInterval(() => {
            remaining--;
            if (timerEl) timerEl.textContent = `${remaining}s`;
            if (remaining <= 0) {
                clearInterval(countdown);
                card.style.animation = 'cardSlideOut 0.3s ease forwards';
                setTimeout(() => card.remove(), 300);
            }
        }, 1000);

        // Clic pour fermer manuellement
        card.addEventListener('click', () => {
            clearInterval(countdown);
            card.style.animation = 'cardSlideOut 0.3s ease forwards';
            setTimeout(() => card.remove(), 300);
        });
    }
}
