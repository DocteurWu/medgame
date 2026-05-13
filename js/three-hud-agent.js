/**
 * three-hud-agent.js — Agent de gestion du HUD en mode 3D
 * Affiche les infos vitales, les prompts d'interaction, gère la navigation,
 * et synchronise en temps réel la progression démarche / score depuis le 2D.
 */

export class ThreeHUD {
    constructor(threeManager) {
        this.manager = threeManager;
        this.container = document.getElementById('three-overlay');
        this.hudElement = document.getElementById('three-hud');
        this.tooltip = document.getElementById('three-tooltip');
        this.vitalsEl = document.getElementById('hud-vitals');
        this.isVisible = false;
        this._syncInterval = null;
        this._lastScore = -1;
    }

    /**
     * Afficher le HUD 3D
     */
    show() {
        if (this.container) this.container.style.display = 'block';
        this.isVisible = true;
        this._updateVitals();
        this._startProgressSync();
    }

    /**
     * Cacher le HUD 3D
     */
    hide() {
        if (this.container) this.container.style.display = 'none';
        this.isVisible = false;
        this._stopProgressSync();
    }

    // ==================== SYNCHRONISATION PROGRESSION 2D ↔ 3D ====================

    /**
     * Démarre la synchronisation en temps réel de la progression (démarche, score).
     * Interroge scoringState et lockSystem toutes les seconde + écoute les événements.
     */
    _startProgressSync() {
        this._stopProgressSync();
        // Mise à jour initiale immédiate
        this._syncProgress();
        // Puis polling toutes les 1 seconde pour capturer les changements incrémentaux
        this._syncInterval = setInterval(() => this._syncProgress(), 1000);
        // Écoute des événements ponctuels pour mise à jour instantanée
        this._onLockUnlock = () => this._syncProgress();
        document.addEventListener('locksystem-unlock', this._onLockUnlock);
        this._onExamOrdered = () => this._syncProgress();
        document.addEventListener('exam-ordered', this._onExamOrdered);
        this._onSectionViewed = () => this._syncProgress();
        document.addEventListener('section-viewed', this._onSectionViewed);
        this._onInterroAsked = () => this._syncProgress();
        document.addEventListener('interrogatoire-asked', this._onInterroAsked);
    }

    _stopProgressSync() {
        if (this._syncInterval) {
            clearInterval(this._syncInterval);
            this._syncInterval = null;
        }
        if (this._onLockUnlock) {
            document.removeEventListener('locksystem-unlock', this._onLockUnlock);
            this._onLockUnlock = null;
        }
        if (this._onExamOrdered) {
            document.removeEventListener('exam-ordered', this._onExamOrdered);
            this._onExamOrdered = null;
        }
        if (this._onSectionViewed) {
            document.removeEventListener('section-viewed', this._onSectionViewed);
            this._onSectionViewed = null;
        }
        if (this._onInterroAsked) {
            document.removeEventListener('interrogatoire-asked', this._onInterroAsked);
            this._onInterroAsked = null;
        }
    }

    /**
     * Synchronise la progression démarche/score entre le game state 2D et le HUD 3D.
     * Lit scoringState et lockSystem puis met à jour les éléments HUD.
     */
    _syncProgress() {
        const ss = window.scoringState;
        const ls = window.lockSystem;
        const gs = window.gameState;
        if (!ss || !gs || !gs.currentCase) return;

        const caseData = gs.currentCase;

        // === 1. Interrogatoire ===
        const interroFields = this._getInterrogatoireFields(caseData);
        const askedCount = interroFields.filter(f => ss.demarche?.interrogatoireAsked?.has(f)).length;
        const interroTotal = interroFields.length;
        const interroDetailEl = document.getElementById('hud-detail-interrogatoire');
        const interroItem = document.getElementById('hud-check-interrogatoire');
        if (interroItem) {
            interroDetailEl.textContent = `${askedCount}/${interroTotal}`;
            interroItem.classList.remove('done', 'partial', 'locked-step');
            if (askedCount >= interroTotal && interroTotal > 0) {
                interroItem.classList.add('done');
            } else if (askedCount > 0) {
                interroItem.classList.add('partial');
            }
        }

        // === 2. Examen clinique ===
        const examViewed = ss.demarche?.examSectionsViewed?.has('section-examen-clinique')
            || ss.demarche?.examSectionsViewed?.has('section-examen');
        const examDetailEl = document.getElementById('hud-detail-examen');
        const examItem = document.getElementById('hud-check-examen');
        if (examItem) {
            examDetailEl.textContent = examViewed ? '✓' : '—';
            examItem.classList.remove('done', 'partial', 'locked-step');
            if (examViewed) {
                examItem.classList.add('done');
            }
        }

        // === 3. Examens complémentaires ===
        const availableExams = caseData.availableExams || [];
        const relevantExams = caseData.relevantExams || [];
        const targetExams = relevantExams.length > 0 ? relevantExams : availableExams;
        const orderedExams = (ss.demarche?.examsOrdered || []);
        const orderedRelevant = orderedExams.filter(e => targetExams.map(String).includes(String(e)));
        const examCompDetailEl = document.getElementById('hud-detail-examens');
        const examCompItem = document.getElementById('hud-check-examens');
        if (examCompItem) {
            examCompDetailEl.textContent = `${orderedRelevant.length}/${targetExams.length}`;
            examCompItem.classList.remove('done', 'partial', 'locked-step');
            if (targetExams.length === 0) {
                examCompDetailEl.textContent = 'N/A';
                examCompItem.classList.add('done');
            } else if (orderedRelevant.length >= targetExams.length) {
                examCompItem.classList.add('done');
            } else if (orderedRelevant.length > 0) {
                examCompItem.classList.add('partial');
            }
        }

        // === 4. Défis sémiologiques (locks) ===
        const locks = caseData.locks || [];
        const unlockedSet = ls?.unlockedLocks || new Set();
        const unlockedCount = locks.filter(l => unlockedSet.has(l.id)).length;
        const locksDetailEl = document.getElementById('hud-detail-locks');
        const locksItem = document.getElementById('hud-check-locks');
        if (locksItem) {
            locksDetailEl.textContent = locks.length === 0 ? 'N/A' : `${unlockedCount}/${locks.length}`;
            locksItem.classList.remove('done', 'partial', 'locked-step');
            if (locks.length === 0) {
                locksItem.classList.add('done');
            } else if (unlockedCount >= locks.length) {
                locksItem.classList.add('done');
            } else if (unlockedCount > 0) {
                locksItem.classList.add('partial');
            } else {
                locksItem.classList.add('locked-step');
            }
        }

        // === 5. Score composite ===
        if (typeof calculateCompositeScore === 'function') {
            const result = calculateCompositeScore();
            const newScore = result.compositeScore || 0;
            this._updateScoreDisplay(newScore);
        } else {
            // Fallback : score simple
            const score = gs.score || 0;
            this._updateScoreDisplay(score);
        }
    }

    /**
     * Met à jour l'affichage du score avec animation si changement.
     */
    _updateScoreDisplay(score) {
        const scoreEl = document.getElementById('hud-score');
        const fillEl = document.getElementById('hud-score-fill');
        if (!scoreEl) return;

        const scoreInt = Math.round(score);
        scoreEl.textContent = `${scoreInt}%`;

        if (fillEl) {
            fillEl.style.width = `${scoreInt}%`;
        }

        // Animation de score up si le score augmente
        if (scoreInt > this._lastScore && this._lastScore >= 0) {
            scoreEl.classList.remove('score-up');
            // Force reflow
            void scoreEl.offsetWidth;
            scoreEl.classList.add('score-up');
            setTimeout(() => scoreEl.classList.remove('score-up'), 700);
        }
        this._lastScore = scoreInt;
    }

    /**
     * Extrait la liste des champs d'interrogatoire disponibles (mode immersif).
     * Reproduit la logique de calculateDemarcheScore pour les noms de champs.
     */
    _getInterrogatoireFields(caseData) {
        const interro = caseData.interrogatoire || {};
        const fields = [];
        const mdv = interro.modeDeVie || {};
        if (mdv.activitePhysique) fields.push('interrogatoire.modeDeVie.activitePhysique.description');
        if (mdv.tabac) fields.push('interrogatoire.modeDeVie.tabac');
        if (mdv.alcool) fields.push('interrogatoire.modeDeVie.alcool.quantite');
        if (mdv.alimentation) fields.push('interrogatoire.modeDeVie.alimentation');
        if (mdv.emploi) fields.push('interrogatoire.modeDeVie.emploi');
        if (interro.antecedents) {
            if (interro.antecedents.medicaux?.length > 0) fields.push('interrogatoire.antecedents.medicaux');
            if (interro.antecedents.chirurgicaux?.length > 0) fields.push('interrogatoire.antecedents.chirurgicaux');
            if (interro.antecedents.familiaux?.length > 0) fields.push('interrogatoire.antecedents.familiaux');
        }
        if (interro.traitements?.length > 0) fields.push('interrogatoire.traitements');
        if (interro.allergies?.presence) fields.push('interrogatoire.allergies');
        const hm = interro.histoireMaladie || {};
        if (hm.debutSymptomes) fields.push('interrogatoire.histoireMaladie.debutSymptomes');
        if (hm.evolution) fields.push('interrogatoire.histoireMaladie.evolution');
        if (hm.facteursDeclenchants) fields.push('interrogatoire.histoireMaladie.facteursDeclenchants');
        if (hm.symptomesAssocies) fields.push('interrogatoire.histoireMaladie.symptomesAssocies');
        if (hm.remarques) fields.push('interrogatoire.histoireMaladie.remarques');
        return fields;
    }

    // ==================== SIGNES VITAUX ====================

    /**
     * Met à jour les signes vitaux dans le HUD
     * Affiche les valeurs mesurées manuellement via les instruments.
     */
    _updateVitals() {
        if (!this.vitalsEl) return;
        const mgr = this.manager;
        const c = mgr.currentCase;
        if (!c) return;
        const constants = c.examenClinique?.constantes || {};
        const measured = mgr.measured || new Set();

        const map = {
            'hud-hr': { key: 'pouls', shown: measured.has('saturationO2') },
            'hud-bp': { key: 'tension', shown: measured.has('tension') },
            'hud-spo2': { key: 'saturationO2', shown: measured.has('saturationO2') },
            'hud-temp': { key: 'temperature', shown: measured.has('temperature') }
        };

        Object.entries(map).forEach(([id, cfg]) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = cfg.shown ? (constants[cfg.key] || '--') : '--';
        });
    }

    /**
     * Force une valeur vitale spécifique à s'afficher (après mesure instrument)
     */
    setVital(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    // ==================== PROMPTS & NOTIFICATIONS ====================

    /**
     * Afficher un prompt d'interaction flottant
     */
    showPrompt(message, duration = 3000) {
        const prompt = document.createElement('div');
        prompt.className = 'hud-prompt';
        prompt.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
        this.hudElement.appendChild(prompt);

        // Animation d'entrée
        prompt.style.opacity = '0';
        prompt.style.transform = 'translateY(10px)';
        requestAnimationFrame(() => {
            prompt.style.transition = 'all 0.3s ease';
            prompt.style.opacity = '1';
            prompt.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            prompt.style.opacity = '0';
            prompt.style.transform = 'translateY(-10px)';
            setTimeout(() => prompt.remove(), 300);
        }, duration);
    }

    /**
     * Afficher une notification dans le HUD 3D
     */
    showNotification(message, type = 'info') {
        const notif = document.createElement('div');
        notif.className = `hud-notification hud-notification-${type}`;
        const icons = { info: 'fa-info-circle', success: 'fa-check-circle', warning: 'fa-exclamation-triangle', error: 'fa-times-circle' };
        notif.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
        this.hudElement.appendChild(notif);

        setTimeout(() => {
            notif.classList.add('hud-notification-exit');
            setTimeout(() => notif.remove(), 400);
        }, 3000);
    }

    /**
     * Afficher la croix pour quitter le mode 3D
     */
    updateExitButton() {
        const btn = document.getElementById('toggle-render-mode');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-cube"></i> 2D';
            btn.title = 'Passer en mode 2D';
        }
    }

    // ==================== DIALOGUE FLOTTANT PATIENT ====================

    /**
     * Créer un dialogue flottant pour le patient (3D)
     */
    createFloatingDialog() {
        this.removeFloatingDialog();

        if (!this.hudElement) {
            this.hudElement = document.getElementById('three-hud');
        }
        if (!this.hudElement) return;

        const dialog = document.createElement('div');
        dialog.id = 'floating-dialog';
        dialog.className = 'floating-dialog';
        dialog.innerHTML = `
            <div class="dialog-header">
                <span class="dialog-speaker" id="dialog-speaker">Patient</span>
                <button class="dialog-close" id="dialog-close-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="dialog-body" id="dialog-messages-3d"></div>
            <div class="dialog-input-area">
                <input type="text" id="dialog-input-3d" placeholder="Posez une question au patient..." />
                <button id="dialog-send-btn"><i class="fas fa-paper-plane"></i></button>
            </div>
        `;
        this.hudElement.appendChild(dialog);

        const closeBtn = document.getElementById('dialog-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.removeFloatingDialog());
        }

        this._observePatientChat();
    }

    _observePatientChat() {
        if (this._chatObserver) {
            this._chatObserver.disconnect();
        }

        const messages3d = document.getElementById('dialog-messages-3d');
        if (!messages3d) return;

        const pushMessage = (speaker, text) => {
            const row = document.createElement('div');
            row.className = speaker === 'Vous' ? 'from-user' : 'from-patient';
            const label = document.createElement('strong');
            label.textContent = `${speaker} : `;
            const body = document.createElement('span');
            body.textContent = text;
            row.append(label, body);
            messages3d.appendChild(row);
            messages3d.scrollTop = messages3d.scrollHeight;
        };

        // Patch patientChat.append to also write to 3D dialog
        const chat = window.patientChat;
        if (chat && chat.append) {
            const origAppend = chat.append.bind(chat);
            this._origChatAppend = chat.append;
            chat.append = (speaker, text, returnTextNode) => {
                pushMessage(speaker, typeof text === 'string' ? text : text.textContent || '');
                return origAppend(speaker, text, returnTextNode);
            };
        }

        const observer = new MutationObserver(() => {
            const classicMessages = document.querySelectorAll('#dialogue-messages .dialogue-message');
            if (classicMessages.length > 0) {
                messages3d.innerHTML = '';
                classicMessages.forEach(m => {
                    const clone = m.cloneNode(true);
                    messages3d.appendChild(clone);
                });
                messages3d.scrollTop = messages3d.scrollHeight;
            }
        });

        const classicContainer = document.getElementById('dialogue-messages');
        if (classicContainer) {
            observer.observe(classicContainer, { childList: true, subtree: true });
        } else {
            const verbatimContainer = document.getElementById('patient-verbatim-container');
            if (verbatimContainer) {
                observer.observe(verbatimContainer, { childList: true, subtree: true });
            }
        }

        this._chatObserver = observer;

        const input = document.getElementById('dialog-input-3d');
        const sendBtn = document.getElementById('dialog-send-btn');

        const sendMessage = () => {
            const val = input?.value?.trim();
            if (!val) return;
            pushMessage('Vous', val);
            input.value = '';
            if (chat) {
                chat.ask(val);
            }
        };

        sendBtn?.removeEventListener('click', this._sendHandler);
        input?.removeEventListener('keypress', this._keyHandler);

        this._sendHandler = sendMessage;
        this._keyHandler = (e) => { if (e.key === 'Enter') sendMessage(); };

        sendBtn?.addEventListener('click', this._sendHandler);
        input?.addEventListener('keypress', this._keyHandler);
    }

    removeFloatingDialog() {
        // Restore original patientChat.append if we patched it
        if (this._origChatAppend && window.patientChat) {
            window.patientChat.append = this._origChatAppend;
            this._origChatAppend = null;
        }
        const existing = document.getElementById('floating-dialog');
        if (existing) existing.remove();
    }
}