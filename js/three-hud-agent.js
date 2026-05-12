/**
 * three-hud-agent.js — Agent de gestion du HUD en mode 3D
 * Affiche les infos vitales, les prompts d'interaction, et gère la navigation
 */

export class ThreeHUD {
    constructor(threeManager) {
        this.manager = threeManager;
        this.container = document.getElementById('three-overlay');
        this.hudElement = document.getElementById('three-hud');
        this.tooltip = document.getElementById('three-tooltip');
        this.vitalsEl = document.getElementById('hud-vitals');
        this.isVisible = false;
    }

    /**
     * Afficher le HUD 3D
     */
    show() {
        if (this.container) this.container.style.display = 'block';
        this.isVisible = true;
        this._updateVitals();
    }

    /**
     * Cacher le HUD 3D
     */
    hide() {
        if (this.container) this.container.style.display = 'none';
        this.isVisible = false;
    }

    /**
     * Mettre à jour les signes vitaux dans le HUD
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