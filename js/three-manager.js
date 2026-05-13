// --- ThreeManager as ES module ---
import * as THREE from 'three';
import { ThreeScene } from './three-scene.js';
import { ThreeHUD } from './three-hud-agent.js';
import { ThreeTransitionAgent } from './three-transition-agent.js';
import { initLockAgent3D } from './three-lock-agent.js';
import { initUrgenceAgent3D } from './three-urgence-agent.js';

const INTERACTION_ZONES = {
    patient: { x: 2.15, y: 0, z: -1.7 },
    desk: { x: -0.5, y: 0, z: 0.55 },
    door: { x: 0, y: 0, z: 3.5 }
};

const ROOM_BOUNDS = { minX: -4.8, maxX: 4.8, minZ: -3.8, maxZ: 3.8 };

class ThreeManager {
    constructor() {
        this.enabled = false;
        this.isImmersive3D = false;
        this.measured = new Set();
        this.tooltip = null;
        this.hudMeasurements = null;
        this.scene = null;
        this.character = null;
        this.hud = null;
        this.transition = null;
        this._initPromise = null;
    }

    async init() {
        const container = document.getElementById('scene-container');
        const urlParams = new URLSearchParams(window.location.search);
        const force2d = urlParams.get('render') === '2d' || sessionStorage.getItem('forceRender2D') === 'true';
        const force3d = urlParams.get('render') === '3d' || sessionStorage.getItem('forceRender3D') === 'true';

        if (!this.canUseWebGL() || force2d) {
            console.warn('[three-manager] WebGL indisponible, mode 2D');
            this._set2DMode();
            return;
        }

        if (!force3d && window.innerWidth < 768) {
            console.info('[three-manager] Écran < 768px, mode 2D par défaut');
            this._set2DMode();
            return;
        }

        if (force3d || sessionStorage.getItem('use3D') === 'true') {
            await this.enable3D(container);
        }
    }

    canUseWebGL() {
        try {
            const canvas = document.createElement('canvas');
            return Boolean(
                window.WebGLRenderingContext &&
                (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
            );
        } catch {
            return false;
        }
    }

    async enable3D(container) {
        if (this.enabled || this._initPromise) return this._initPromise;

        this._initPromise = this._init3D(container);
        return this._initPromise;
    }

    async _init3D(containerEl) {
        try {
            console.info('[three-manager] Démarrage du mode 3D immersif...');

            let container = containerEl || document.getElementById('scene-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'scene-container';
                document.body.appendChild(container);
            }

            // Import dynamique de CharacterController (dépendance lourde)
            let CharacterControllerClass;
            try {
                const ccModule = await import('./character-controller.js');
                CharacterControllerClass = ccModule.CharacterController;
            } catch (e) {
                console.warn('[three-manager] CharacterController non disponible:', e);
            }

            this.scene = new ThreeScene(container, {
                onPatient: () => this.goToPatient(),
                onInstrument: (instrument) => this.goToInstrument(instrument),
                onPC: () => this.goToPC(),
                onObject: (object) => this.showInfo(object),
                onHover: (object, event) => this.showTooltip(object, event)
            });
            this.scene.init();

            if (CharacterControllerClass) {
                this.character = new CharacterControllerClass(this.scene.scene);
                // Lier le contrôleur à la scène pour que moveDoctorTo fonctionne
                this.scene.characterController = this.character;
            }

            // HUD
            this.hud = new ThreeHUD(this);
            this.hud.show();

            // Transitions
            this.transition = new ThreeTransitionAgent(this);

            // Lock Agent 3D (cadenas animés)
            this.lockAgent = initLockAgent3D(this);

            // Urgence Agent 3D (overlay urgence immersif)
            this.urgenceAgent = initUrgenceAgent3D(this);

            this.enabled = true;
            this.bindControls();
            this.bindKeyboard();

            // Load current case data if available
            const currentCase = window.gameState?.currentCase;
            if (currentCase) {
                this.loadCase(currentCase);
            }

            document.dispatchEvent(new CustomEvent('three-manager-update', {
                detail: { enabled: true }
            }));

            console.info('[three-manager] Mode 3D actif ✅');
        } catch (error) {
            console.error('[three-manager] Échec 3D:', error);
            console.error('[three-manager] Stack:', error.stack);
            this._set2DMode();
            this._initPromise = null;
        }
    }

    async disable3D() {
        if (this.transition) {
            await this.transition.transitionTo2D();
        }

        this._cleanup3D();
        this._set2DMode();

        document.dispatchEvent(new CustomEvent('three-manager-update', {
            detail: { enabled: false }
        }));
    }

    async toggle3D() {
        if (this.enabled) {
            sessionStorage.removeItem('use3D');
            await this.disable3D();
        } else {
            sessionStorage.setItem('use3D', 'true');
            await this.enable3D(null);
            if (this.transition) {
                await this.transition.transitionTo3D();
            }
        }
    }

    _cleanup3D() {
        // Retirer le listener clavier pour éviter les memory leaks
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        this.closePCPanel();
        const pcOverlay = document.getElementById('pc-overlay');
        if (pcOverlay) pcOverlay.remove();
        if (this.scene) {
            try { this.scene.cleanup(); } catch(e) {}
            this.scene = null;
        }
        if (this.hud) {
            this.hud.hide();
            this.hud = null;
        }
        if (this.transition) {
            this.transition = null;
        }
        if (this.lockAgent) {
            this.lockAgent.clearAll();
            this.lockAgent = null;
        }
        if (this.urgenceAgent) {
            this.urgenceAgent.deactivate();
            this.urgenceAgent = null;
        }
        this.character = null;
        this.enabled = false;
        sessionStorage.setItem('use3D', 'false');
    }

    _set2DMode() {
        document.body.classList.add('render-2d');
        document.body.classList.remove('render-3d', 'render-3d-full');
        document.body.classList.remove('mode-3d');
        this.enabled = false;
        const appContainer = document.querySelector('.app-container');
        if (appContainer) appContainer.classList.remove('mode-3d');
    }

    bindControls() {
        document.querySelectorAll('#hud-3d [data-camera]').forEach((button) => {
            button.addEventListener('click', () => {
                if (this.scene) this.scene.setCamera(button.dataset.camera);
                if (this.hud) this.hud.showNotification(`Vue ${button.dataset.camera}`);
            });
        });

        const chatBtn = document.getElementById('hud-btn-chat');
        if (chatBtn) {
            chatBtn.addEventListener('click', () => {
                this.scene?.setCamera('patient');
                this.openPatientDialog();
            });
        }

        const pcBtn = document.getElementById('hud-btn-pc');
        if (pcBtn) {
            pcBtn.addEventListener('click', () => {
                this.scene?.setCamera('desk');
                this.openPCPanel();
            });
        }

        this._startHUDTimerSync();
    }

    _startHUDTimerSync() {
        const update = () => {
            if (!this.enabled) return;
            const timerEl = document.getElementById('hud-timer');
            if (timerEl && window.timerState) {
                const mins = Math.floor((window.timerState.timeLeft || 0) / 60);
                const secs = (window.timerState.timeLeft || 0) % 60;
                timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                timerEl.classList.remove('warning', 'critical');
                if ((window.timerState.timeLeft || 0) <= 30) timerEl.classList.add('critical');
                else if ((window.timerState.timeLeft || 0) <= 120) timerEl.classList.add('warning');
            }
            requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }

    bindKeyboard() {
        this._keyHandler = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
            if (!this.enabled) return;

            switch (e.key.toLowerCase()) {
                case 'escape':
                    this.disable3D();
                    break;
                case 'p':
                    e.preventDefault();
                    this.goToPatient();
                    break;
                case 'r':
                    e.preventDefault();
                    this.scene?.setCamera('desk');
                    this.openPCPanel();
                    break;
                case 'enter':
                    if (!document.getElementById('floating-dialog')) {
                        this.openPatientDialog();
                    }
                    break;
                case '1':
                    this.scene?.setCamera('room');
                    break;
                case '2':
                    e.preventDefault();
                    this.scene?.setCamera('patient');
                    this.goToPatient();
                    break;
                case '3':
                    e.preventDefault();
                    this.scene?.setCamera('desk');
                    this.goToPrescription();
                    break;
            }
        };
        document.addEventListener('keydown', this._keyHandler);
    }

    closeAllOverlays() {
        ['dialogue-panel', 'prescription-modal', 'diagnostic-floating-panel'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('active');
                el.setAttribute('aria-hidden', 'true');
            }
        });
        if (this.hud) this.hud.removeFloatingDialog();
    }

    goToPatient() {
        if (!this.scene) return;
        const arriveAndChat = () => {
            this.scene.setCamera('patient');
            this.openPatientDialog();
            if (this.hud) {
                this.hud.showPrompt('Appuyez sur Entrée pour poser une question au patient');
            }
            window.scoringState && (window.scoringState.hasAskedPatient = true);
        };
        if (this.character) {
            this.character.moveTo(INTERACTION_ZONES.patient, arriveAndChat);
        } else {
            arriveAndChat();
        }
    }

    goToPrescription() {
        if (!this.scene) return;
        const arriveAndPrescribe = () => {
            this.scene.setCamera('desk');
            if (this.character) this.character.reach();
            if (window.openPrescriptionTablet) window.openPrescriptionTablet();
        };
        if (this.character) {
            this.character.moveTo(INTERACTION_ZONES.desk, arriveAndPrescribe);
        } else {
            arriveAndPrescribe();
        }
    }

    goToInstrument(instrument) {
        if (!this.scene || !instrument) return;
        const arriveAndMeasure = () => {
            this.scene.setCamera('desk');
            if (this.character) this.character.reach();
            if (instrument.key === 'tablet') {
                this.openPCPanel();
                return;
            }
            if (this.currentCase) {
                // Animation: l'instrument vole vers le patient, mesure, puis revient
                const instrGroup = this.scene.instruments?.meshes?.get(instrument.id);
                if (instrGroup) {
                    this._animateInstrumentToPatient(instrGroup, instrument, () => {
                        const measurement = this.scene.instruments.showMeasurement(instrument, this.currentCase);
                        if (measurement) {
                            this.recordMeasurement(instrument.key, measurement);
                            if (this.hud) {
                                this.hud.showNotification(`${measurement.label} : ${measurement.value}`, 'info');
                            }
                        }
                        // Recharger le panneau PC pour afficher la constante mesurée
                        this._populatePCPanel();
                    });
                } else {
                    // Fallback: mesurer directement
                    const measurement = this.scene.instruments.showMeasurement(instrument, this.currentCase);
                    if (measurement) {
                        this.recordMeasurement(instrument.key, measurement);
                        if (this.hud) {
                            this.hud.showNotification(`${measurement.label} : ${measurement.value}`, 'info');
                        }
                    }
                }
            } else {
                if (this.hud) this.hud.showNotification('Aucun cas chargé', 'warning');
            }
        };
        if (this.character) {
            this.character.moveTo(INTERACTION_ZONES.desk, arriveAndMeasure);
        } else {
            arriveAndMeasure();
        }
    }

    /**
     * Anime un instrument 3D vers le patient pour effectuer une mesure
     * L'instrument vole vers le patient, fait une pause, puis revient à sa place
     */
    _animateInstrumentToPatient(instrGroup, instrument, callback) {
        if (!instrGroup) { callback?.(); return; }

        // Position actuelle de l'instrument
        const startPos = instrGroup.position.clone();
        // Position cible: vers le patient (torse)
        const endPos = new THREE.Vector3(2.0, 1.2, -1.3);

        const duration = 600; // ms vol aller
        const pauseDuration = 400; // ms pause sur le patient
        const returnDuration = 500; // ms vol retour

        const startTime = performance.now();
        const self = this;

        // Phase 1: Vol vers le patient
        function flyOut(now) {
            const t = Math.min(1, (now - startTime) / duration);
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            instrGroup.position.lerpVectors(startPos, endPos, ease);
            // Léger arc vers le haut
            instrGroup.position.y = startPos.y + (endPos.y - startPos.y) * ease + Math.sin(ease * Math.PI) * 0.3;
            // Léger rotation pendant le vol
            instrGroup.rotation.y = ease * Math.PI * 0.15;
            if (t < 1) {
                requestAnimationFrame(flyOut);
            } else {
                // Pause sur le patient (mesure en cours)
                if (self.hud) {
                    self.hud.showNotification(`⏱ Mesure en cours...`, 'info');
                }
                setTimeout(() => {
                    // Phase 2: Retour à la position initiale
                    const returnStart = performance.now();
                    function flyBack(now) {
                        const t2 = Math.min(1, (now - returnStart) / returnDuration);
                        const ease2 = t2 < 0.5 ? 2 * t2 * t2 : 1 - Math.pow(-2 * t2 + 2, 3) / 2;
                        instrGroup.position.lerpVectors(endPos, startPos, ease2);
                        instrGroup.position.y = endPos.y + (startPos.y - endPos.y) * ease2 + Math.sin(ease2 * Math.PI) * 0.15;
                        instrGroup.rotation.y = (1 - ease2) * Math.PI * 0.15;
                        if (t2 < 1) {
                            requestAnimationFrame(flyBack);
                        } else {
                            instrGroup.position.copy(startPos);
                            instrGroup.rotation.y = 0;
                            callback?.();
                        }
                    }
                    requestAnimationFrame(flyBack);
                }, pauseDuration);
            }
        }
        requestAnimationFrame(flyOut);
    }

    goToPC() {
        if (!this.scene) return;
        const arrive = () => {
            this.scene.setCamera('desk');
            this.openPCPanel();
        };
        if (this.character) {
            this.character.moveTo(INTERACTION_ZONES.desk, arrive);
        } else {
            arrive();
        }
    }

    openPCPanel() {
        let panel = document.getElementById('pc-overlay');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'pc-overlay';
            panel.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;background:rgba(0,0,0,0.5);display:none;align-items:center;justify-content:center;';
            panel.innerHTML = `
                <div class="pc-panel" style="background:rgba(10,15,30,0.95);border:1px solid rgba(0,242,254,0.25);border-radius:16px;width:90%;max-width:700px;max-height:85vh;overflow-y:auto;padding:0;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
                    <div class="pc-header" style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:rgba(0,242,254,0.08);border-bottom:1px solid rgba(0,242,254,0.15);border-radius:16px 16px 0 0;color:#00f2fe;font-weight:700;font-size:1rem;">
                        <span><i class="fas fa-desktop"></i> Dossier Médical</span>
                        <button id="pc-close-btn" style="background:none;border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.6);width:32px;height:32px;border-radius:8px;cursor:pointer;"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="pc-body" style="padding:20px;display:flex;flex-direction:column;gap:20px;">
                        <div class="pc-section" id="pc-examens" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;">
                            <h4 style="color:#00f2fe;margin:0 0 12px 0;font-size:0.9rem;"><i class="fas fa-flask"></i> Examens Complémentaires</h4>
                            <div id="pc-exam-results"></div>
                            <div id="pc-exam-buttons" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
                        </div>
                        <div class="pc-section" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;">
                            <h4 style="color:#00f2fe;margin:0 0 12px 0;font-size:0.9rem;"><i class="fas fa-stethoscope"></i> Examen Clinique</h4>
                            <div id="pc-clinical-exam"></div>
                        </div>
                        <div class="pc-section" id="pc-decision" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;">
                            <h4 style="color:#00f2fe;margin:0 0 12px 0;font-size:0.9rem;"><i class="fas fa-gavel"></i> Décision Clinique</h4>
                            <div>
                                <label style="color:rgba(255,255,255,0.7);font-size:0.85rem;">Diagnostic :</label>
                                <select id="pc-diagnostic-select" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);color:#fff;padding:10px 12px;border-radius:8px;font-size:0.9rem;margin-bottom:12px;">
                                    <option value="">-- Choisir --</option>
                                </select>
                            </div>
                            <div>
                                <label style="color:rgba(255,255,255,0.7);font-size:0.85rem;">Traitements :</label>
                                <div id="pc-treatments-grid" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;"></div>
                            </div>
                            <button id="pc-validate-btn" style="width:100%;background:linear-gradient(135deg,#a020f0,#6a0dad);border:none;color:#fff;padding:14px;border-radius:12px;cursor:pointer;font-size:1rem;font-weight:700;">
                                <i class="fas fa-check-double"></i> VALIDER LE CAS
                            </button>
                            <div id="pc-score-display" style="text-align:center;font-size:1.2rem;font-weight:700;color:#2ecc71;margin-top:10px;"></div>
                            <div id="pc-treatment-feedback" style="text-align:center;font-size:0.9rem;color:#ffc107;margin-top:6px;"></div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(panel);
            const closeBtn = document.getElementById('pc-close-btn');
            if (closeBtn) closeBtn.addEventListener('click', () => this.closePCPanel());
            this._bindPCPanelEvents();
        }
        this._populatePCPanel();
        panel.style.display = 'flex';
    }

    closePCPanel() {
        const panel = document.getElementById('pc-overlay');
        if (!panel) return;
        panel.style.display = 'none';
    }

    _bindPCPanelEvents() {
        const validateBtn = document.getElementById('pc-validate-btn');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => {
                const validateBtn2D = document.getElementById('validate-traitement');
                if (validateBtn2D) validateBtn2D.click();
                setTimeout(() => {
                    const scoreEl = document.getElementById('pc-score-display');
                    if (scoreEl) scoreEl.textContent = window.gameState?.score ? `Score: ${window.gameState.score}` : '';
                    const feedbackEl = document.getElementById('pc-treatment-feedback');
                    const feedback2D = document.getElementById('treatment-feedback');
                    if (feedbackEl && feedback2D) feedbackEl.textContent = feedback2D.textContent;
                }, 500);
            });
        }
    }

    _populatePCPanel() {
        const currentCase = this.currentCase;
        if (!currentCase) return;

        const examBtns = document.getElementById('pc-exam-buttons');
        const examResults = document.getElementById('pc-exam-results');
        if (examBtns) {
            examBtns.innerHTML = '';
            if (examResults) examResults.innerHTML = '';
            const availableExams = currentCase.availableExams || [];
            const examResultsMap = currentCase.examResults || {};
            availableExams.forEach(examName => {
                const name = (typeof examName === 'string') ? examName : (examName.nom || examName.name || String(examName));
                const id = name.toLowerCase().replace(/\s+/g, '-');
                const btn = document.createElement('button');
                btn.className = 'pc-exam-btn';
                btn.textContent = name;
                btn.dataset.examId = id;
                btn.addEventListener('click', () => {
                    if (btn.classList.contains('selected')) return;
                    btn.classList.add('selected');
                    const resultText = examResultsMap[name] || examResultsMap[id] || 'Résultat non disponible';
                    if (examResults) {
                        const result = document.createElement('div');
                        result.className = 'pc-exam-result';
                        result.textContent = `${name} : ${resultText}`;
                        examResults.appendChild(result);
                    }
                    const examBtns2D = document.querySelectorAll(`[data-exam-id="${id}"]`);
                    examBtns2D.forEach(b => { if (!b.classList.contains('selected')) b.click(); });
                    if (examBtns2D.length === 0) {
                        document.querySelectorAll('#section-examens .exam-btn, #section-examens button').forEach(b => {
                            if (b.textContent.trim() === name && !b.classList.contains('selected')) b.click();
                        });
                    }
                    if (this.hud) this.hud.showNotification(`Examen demandé : ${name}`, 'info');
                    // Notifier le HUD 3D de la progression examens
                    document.dispatchEvent(new CustomEvent('exam-ordered', { detail: { exam: name } }));
                });
                examBtns.appendChild(btn);
            });
        }

        const clinicalEl = document.getElementById('pc-clinical-exam');
        if (clinicalEl && currentCase.examenClinique) {
            const ec = currentCase.examenClinique;
            const c = ec.constantes || {};
            const measuredKeys = Array.from(this.measured);
            // N'afficher que les constantes qui ont été mesurées par le joueur
            const vitalDefs = [
                { key: 'tension', label: 'TA', value: c.tension },
                { key: 'saturationO2', label: 'SpO\u2082', value: c.saturationO2 },
                { key: 'temperature', label: 'T\u00b0', value: c.temperature },
                { key: 'pouls', label: 'FC', value: c.pouls },
                { key: 'frequenceRespiratoire', label: 'FR', value: c.frequenceRespiratoire },
                { key: 'glycemie', label: 'Glyc\u00e9mie', value: c.glycemie || c.glycemieCapillaire }
            ];
            let html = '<div class="pc-vitals-grid">';
            for (const v of vitalDefs) {
                if (measuredKeys.includes(v.key)) {
                    // Constante mesurée → afficher la valeur
                    html += `<div class="pc-vital"><span class="pc-vital-label">${v.label}</span><span class="pc-vital-value">${v.value || '--'}</span></div>`;
                } else {
                    // Constante non mesurée → afficher "?"
                    html += `<div class="pc-vital pc-vital-unknown"><span class="pc-vital-label">${v.label}</span><span class="pc-vital-value" style="color:rgba(255,255,255,0.3);">?</span></div>`;
                }
            }
            html += '</div>';
            if (ec.aspectGeneral) html += `<p class="pc-aspect">${ec.aspectGeneral}</p>`;
            clinicalEl.innerHTML = html;
        }

        const diagSelect = document.getElementById('pc-diagnostic-select');
        if (diagSelect && currentCase.possibleDiagnostics) {
            diagSelect.innerHTML = '<option value="">-- Choisir --</option>';
            currentCase.possibleDiagnostics.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                diagSelect.appendChild(opt);
            });
            const handler = () => {
                const select2D = document.getElementById('diagnostic-select');
                if (select2D) select2D.value = diagSelect.value;
                // Notifier le HUD 3D de la progression diagnostic
                if (this.hud && this.hud._syncProgress) this.hud._syncProgress();
            };
            diagSelect.removeEventListener('change', diagSelect._prevHandler);
            diagSelect._prevHandler = handler;
            diagSelect.addEventListener('change', handler);
        }

        const treatGrid = document.getElementById('pc-treatments-grid');
        if (treatGrid && currentCase.possibleTreatments) {
            treatGrid.innerHTML = '';
            currentCase.possibleTreatments.forEach(t => {
                const btn = document.createElement('button');
                btn.className = 'pc-treat-btn';
                const tName = (typeof t === 'string') ? t : (t.nom || String(t));
                btn.textContent = tName;
                btn.dataset.traitement = tName;
                btn.addEventListener('click', () => {
                    btn.classList.toggle('selected');
                    window.scoringState = window.scoringState || {};
                    if (btn.classList.contains('selected')) {
                        if (!window.scoringState.selectedTreatments) window.scoringState.selectedTreatments = [];
                        if (!window.scoringState.selectedTreatments.includes(tName)) {
                            window.scoringState.selectedTreatments.push(tName);
                        }
                    } else {
                        if (window.scoringState.selectedTreatments) {
                            window.scoringState.selectedTreatments = window.scoringState.selectedTreatments.filter(x => x !== tName);
                        }
                    }
                    const treatBtn2D = document.querySelector(`#availableTreatments button[data-traitement="${tName}"]`);
                    if (treatBtn2D) treatBtn2D.click();
                    // Notifier le HUD 3D de la progression traitement
                    if (this.hud && this.hud._syncProgress) this.hud._syncProgress();
                });
                treatGrid.appendChild(btn);
            });
        }

        const scoreEl = document.getElementById('pc-score-display');
        if (scoreEl && window.gameState) {
            scoreEl.textContent = window.gameState.score ? `Score: ${window.gameState.score}` : '';
        }
    }

    openPatientDialog() {
        if (!this.hud) return;
        this.hud.createFloatingDialog();
        window.patientChat?.open();
    }

    get currentCase() {
        return window.gameState?.currentCase || null;
    }

    loadCase(caseData) {
        this.measured.clear();
        if (this.hudMeasurements) this.hudMeasurements.innerHTML = '';
        if (this.scene) this.scene.loadCase(caseData);
        this._updateHUDVitals();
        // Synchroniser immédiatement la progression démarche dans le HUD 3D
        if (this.hud && this.hud._syncProgress) {
            this.hud._syncProgress();
        }
    }

    _updateHUDVitals() {
        if (!this.hud || !this.currentCase) return;
        this.hud._updateVitals();
    }

    recordMeasurement(key, measurement) {
        this.measured.add(key);
        window.scoringState && (window.scoringState.measuredVitals = Array.from(this.measured));

        if (this.hudMeasurements) {
            const row = document.createElement('div');
            row.textContent = `${measurement.label} : ${measurement.value}`;
            this.hudMeasurements.prepend(row);
        }

        const map = {
            tension: 'tension',
            saturationO2: 'saturationO2',
            temperature: 'temperature',
            glycemie: 'glycemie'
        };
        const el = document.getElementById(map[key]);
        if (el && measurement.value !== '--') el.textContent = measurement.value;

        this._updateHUDVitals();
    }

    showInfo(object) {
        // D'abord, vérifier si c'est un cadenas 3D
        if (object?.userData?.lockId && this.lockAgent) {
            return this.lockAgent.handleLockClick(object);
        }
        const label = object?.userData?.label || object?.name || 'Objet';
        if (this.hud) this.hud.showNotification(label, 'info');
        else if (window.showNotification) window.showNotification(label);
    }

    showTooltip(object, event) {
        if (!this.tooltip) this.tooltip = document.getElementById('three-tooltip');
        if (!this.tooltip) return;
        if (!object) {
            this.tooltip.style.display = 'none';
            return;
        }
        this.tooltip.textContent = object.userData?.label || object.name || '';
        this.tooltip.style.left = `${event.clientX + 12}px`;
        this.tooltip.style.top = `${event.clientY - 18}px`;
        this.tooltip.style.display = 'block';
    }
}

// Export de la classe pour compatibilité ES modules
export { ThreeManager };

// Singleton global — disponible pour game.js via window.threeManager
window.threeManager = new ThreeManager();

// Initialisation passive (ne démarre pas le 3D automatiquement)
const init3DManager = () => {
    // Prêt pour initialisation différée
};

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => setTimeout(init3DManager, 200), { once: true });
} else {
    setTimeout(init3DManager, 200);
}