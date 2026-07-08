/**
 * three-hud-agent.js — Agent de gestion du HUD en mode 3D
 * Affiche les infos vitales, les prompts d'interaction, gère la navigation,
 * et synchronise en temps réel la progression démarche / score depuis le 2D.
 */

import { LLMPatient } from './llm-patient.js';

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
        this.llmPatient = null;

        // --- Système de Scope Télémétrie ---
        this.telemetryCanvas = null;
        this.telemetryCtx = null;
        this.telemetryAnimId = null;
        this.telemetryX = 0;
        this.prevX = 0;
        this.prevEcgY = 12;
        this.prevSpo2Y = 30;
        this.prevPhi = 0;
        this.sweepSpeed = 1.6; // Pixels par frame

        // --- Système Audio Bip ECG ---
        const globalMuted = localStorage.getItem('medgame.audio.muted') === 'true';
        const sessionMuted = sessionStorage.getItem('hud_scope_muted');
        this.isSoundMuted = globalMuted || (sessionMuted !== null ? sessionMuted === 'true' : false);
        this.soundVolume = parseFloat(sessionStorage.getItem('hud_scope_volume') || '0.15');
        this.audioCtx = null;
        this._hudKeyHandler = null;
    }

    /**
     * Afficher le HUD 3D
     */
    show() {
        if (this.container) this.container.style.display = 'block';
        this.isVisible = true;
        this._updateVitals();
        this._startProgressSync();
        this.startTelemetry();
    }

    /**
     * Cacher le HUD 3D
     */
    hide() {
        if (this.container) this.container.style.display = 'none';
        this.isVisible = false;
        this._stopProgressSync();
        this.stopTelemetry();
    }

    /**
     * Démarrer le dessin de la télémétrie et lier les contrôles de volume
     */
    startTelemetry() {
        this.telemetryCanvas = document.getElementById('hud-telemetry-canvas');
        if (!this.telemetryCanvas) return;
        this.telemetryCtx = this.telemetryCanvas.getContext('2d', { alpha: true });
        
        // Initialiser la couleur de fond transparente du scope
        this.telemetryCtx.clearRect(0, 0, this.telemetryCanvas.width, this.telemetryCanvas.height);
        this.telemetryX = 0;
        this.prevX = 0;

        // Lier le bouton de son du scope
        const soundBtn = document.getElementById('hud-btn-sound');
        if (soundBtn) {
            soundBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.isSoundMuted = !this.isSoundMuted;
                sessionStorage.setItem('hud_scope_muted', this.isSoundMuted ? 'true' : 'false');
                this._updateSoundButtonUI();
                
                // Activer l'AudioContext s'il était suspendu (sécurité navigateur)
                if (!this.isSoundMuted && this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume();
                }
            };
            this._updateSoundButtonUI();
        }

        // Lier le bouton de changement de thème (Jour/Nuit)
        const themeBtn = document.getElementById('hud-btn-theme');
        if (themeBtn) {
            themeBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.manager) {
                    const newTheme = this.manager.toggleLightingTheme();
                    this._updateThemeButtonUI(newTheme);
                }
            };
            // Initialiser l'état visuel du bouton
            if (this.manager?.scene?.lightingAgent) {
                this._updateThemeButtonUI(this.manager.scene.lightingAgent.theme);
            }
        }

        // Raccourci clavier local (M pour Mute/Unmute)
        this._hudKeyHandler = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
            if (!this.isVisible) return;
            if (e.key.toLowerCase() === 'm') {
                e.preventDefault();
                this.isSoundMuted = !this.isSoundMuted;
                sessionStorage.setItem('hud_scope_muted', this.isSoundMuted ? 'true' : 'false');
                this._updateSoundButtonUI();
                if (!this.isSoundMuted && this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume();
                }
            }
        };
        document.addEventListener('keydown', this._hudKeyHandler);

        // Lancer la boucle d'animation des tracés
        const tick = () => {
            if (!this.isVisible) return;
            this._drawTelemetryFrame();
            this.telemetryAnimId = requestAnimationFrame(tick);
        };
        this.telemetryAnimId = requestAnimationFrame(tick);
    }

    /**
     * Arrête le scope et libère les écouteurs pour économiser les ressources
     */
    stopTelemetry() {
        if (this.telemetryAnimId) {
            cancelAnimationFrame(this.telemetryAnimId);
            this.telemetryAnimId = null;
        }
        if (this._hudKeyHandler) {
            document.removeEventListener('keydown', this._hudKeyHandler);
            this._hudKeyHandler = null;
        }
    }

    /**
     * Met à jour visuellement le bouton de contrôle du son
     */
    _updateSoundButtonUI() {
        const soundBtn = document.getElementById('hud-btn-sound');
        if (!soundBtn) return;
        if (this.isSoundMuted) {
            soundBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            soundBtn.style.color = '#ff4757';
            soundBtn.title = "Scope muet (Appuyez sur M pour réactiver)";
            soundBtn.classList.add('muted');
        } else {
            soundBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            soundBtn.style.color = '#00ff66';
            soundBtn.title = "Bip Scope actif (Appuyez sur M pour couper)";
            soundBtn.classList.remove('muted');
        }
    }

    /**
     * Met à jour visuellement le bouton de contrôle du thème (Jour/Nuit)
     */
    _updateThemeButtonUI(theme) {
        const themeBtn = document.getElementById('hud-btn-theme');
        if (!themeBtn) return;
        if (theme === 'light') {
            themeBtn.innerHTML = '<i class="fas fa-moon"></i>';
            themeBtn.title = "Passer en mode sombre (Nuit)";
            themeBtn.style.color = '#ffd700'; // Warm golden sun/moon color in light mode
        } else {
            themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
            themeBtn.title = "Passer en mode lumineux (Jour)";
            themeBtn.style.color = '#e2e8f0'; // Off-white color in dark mode
        }
    }

    /**
     * Génère un BIP sonore ECG réaliste via le Web Audio API
     * La tonalité varie en fonction du niveau de saturation en oxygène (SpO2)
     */
    _beepECG(spo2) {
        if (this.isSoundMuted) return;

        try {
            // Lazy-init de l'AudioContext pour respecter les politiques des navigateurs
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }

            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            // Physique médicale : plus la saturation (SpO2) baisse, plus la note baisse !
            // SpO2 à 99% -> ~740 Hz (aigu). SpO2 à 80% -> ~520 Hz (plus grave/alarmant).
            const pitch = 400 + Math.max(0, Math.min(100, spo2 - 70)) * 12;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, this.audioCtx.currentTime);

            gain.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);
            // Attack rapide
            gain.gain.linearRampToValueAtTime(this.soundVolume, this.audioCtx.currentTime + 0.015);
            // Decay
            gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 0.08);

            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.095);
        } catch (e) {
            console.warn('[HUD Telemetry] Échec AudioContext Beep:', e);
        }
    }

    /**
     * Calcule et dessine un segment des courbes ECG et SpO2 (CRT Sweep-Erase)
     */
    _drawTelemetryFrame() {
        const ctx = this.telemetryCtx;
        const canvas = this.telemetryCanvas;
        if (!ctx || !canvas) return;

        const w = canvas.width;
        const h = canvas.height;

        // Récupérer les constantes vitales courantes du patient
        const hrStr = document.getElementById('hud-hr')?.textContent || '--';
        const spo2Str = document.getElementById('hud-spo2')?.textContent || '--';
        const hr = (hrStr !== '--' && hrStr !== '') ? parseInt(hrStr) : 72;
        const spo2 = (spo2Str !== '--' && spo2Str !== '') ? parseInt(spo2Str) : 98;

        const hrMeasured = this.manager.measured.has('pouls') || this.manager.isScopeConnected;
        const spo2Measured = this.manager.measured.has('saturationO2') || this.manager.isScopeConnected;

        // Avancer le curseur de balayage CRT
        const x = this.telemetryX;
        let nextX = x + this.sweepSpeed;
        if (nextX >= w) {
            nextX = 0;
        }

        // Effacer une bande de balayage juste DEVANT le curseur
        ctx.clearRect(nextX, 0, 16, h);

        const time = performance.now() / 1000;
        const period = 60 / hr;
        const phi = (time % period) / period;

        // --- 1. Calcul et tracé ECG (Haut du scope, Y=12) ---
        let ecgY = 12;
        if (hrMeasured) {
            let v_ecg = 0;
            if (phi < 0.08) {
                // Onde P (petite bosse positive)
                v_ecg = Math.sin((phi / 0.08) * Math.PI) * 2.2;
            } else if (phi < 0.12) {
                v_ecg = 0;
            } else if (phi < 0.14) {
                // Onde Q (petit creux négatif)
                v_ecg = ((phi - 0.12) / 0.02) * -1.8;
            } else if (phi < 0.175) {
                // Onde R (grand pic positif)
                const rRatio = (phi - 0.14) / 0.035;
                v_ecg = -1.8 + rRatio * 16.5;
            } else if (phi < 0.205) {
                // Onde S (creux négatif prononcé)
                const sRatio = (phi - 0.175) / 0.03;
                v_ecg = 14.7 - sRatio * 19.2;
            } else if (phi < 0.23) {
                // Retour à la ligne isoélectrique
                const retRatio = (phi - 0.205) / 0.025;
                v_ecg = -4.5 + retRatio * 4.5;
            } else if (phi < 0.36) {
                // Onde T (bosse positive moyenne)
                if (phi > 0.26) {
                    v_ecg = Math.sin(((phi - 0.26) / 0.10) * Math.PI) * 3.8;
                }
            }
            
            // Si le patient est tachycarde ou en hypoxie, ajouter un léger tremblement / bruit musculaire
            if (hr > 115 || spo2 < 88) {
                v_ecg += (Math.random() - 0.5) * 0.7;
            }
            ecgY = 12 - v_ecg;
        }

        // --- 2. Calcul et tracé SpO2 Pleth (Bas du scope, Y=30) ---
        let spo2Y = 30;
        if (spo2Measured) {
            let v_spo2 = 0;
            // Onde plethysmographique : retardée de 0.09s par rapport au QRS électrique
            const phi_spo2 = (phi + 0.90) % 1.0;
            if (phi_spo2 < 0.28) {
                // Montée systolique rapide
                v_spo2 = Math.sin((phi_spo2 / 0.28) * Math.PI / 2) * 8.2;
            } else if (phi_spo2 < 0.38) {
                // Encoche dicrote (dicrotic notch)
                const notchRatio = (phi_spo2 - 0.28) / 0.10;
                v_spo2 = 8.2 - notchRatio * 2.2 + Math.sin(notchRatio * Math.PI) * 1.0;
            } else if (phi_spo2 < 0.75) {
                // Descente diastolique
                const diastRatio = (phi_spo2 - 0.38) / 0.37;
                v_spo2 = 6.0 * Math.cos(diastRatio * Math.PI / 2);
            }
            
            // Modulation d'amplitude si la saturation est basse (onde amortie)
            if (spo2 < 90) {
                v_spo2 *= (spo2 / 100);
            }

            spo2Y = 30 - v_spo2;
        }

        // --- 3. Déclenchement du BIP ECG ---
        // Le bip se déclenche juste au début du complexe R (phase = 0.14)
        if (hrMeasured && this.prevPhi < 0.14 && phi >= 0.14) {
            this._beepECG(spo2);
        }

        // --- 4. Rendu graphique ---
        // Ne tracer que si on ne vient pas de faire un retour chariot (wrap)
        if (x < nextX && this.prevX < x) {
            // Dessin ECG (Néon Vert)
            ctx.beginPath();
            ctx.strokeStyle = '#00ff66';
            ctx.lineWidth = 1.4;
            ctx.lineCap = 'round';
            ctx.shadowColor = '#00ff66';
            ctx.shadowBlur = 3;
            ctx.moveTo(this.prevX, this.prevEcgY);
            ctx.lineTo(x, ecgY);
            ctx.stroke();

            // Dessin SpO2 (Néon Cyan)
            ctx.beginPath();
            ctx.strokeStyle = '#00f2fe';
            ctx.lineWidth = 1.3;
            ctx.lineCap = 'round';
            ctx.shadowColor = '#00f2fe';
            ctx.shadowBlur = 3;
            ctx.moveTo(this.prevX, this.prevSpo2Y);
            ctx.lineTo(x, spo2Y);
            ctx.stroke();
        }

        // Sauvegarder les états pour le prochain frame
        this.prevX = x;
        this.prevEcgY = ecgY;
        this.prevSpo2Y = spo2Y;
        this.prevPhi = phi;
        this.telemetryX = nextX;
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

        // Utiliser les constantes dynamiques du VitalSignsMonitor si disponible
        const hasProps = window.vitalSigns && window.vitalSigns.props;
        const vitals = hasProps ? window.vitalSigns.props : constants;

        const map = {
            'hud-hr': { key: 'pouls', shown: measured.has('pouls') || mgr.isScopeConnected, thresholds: { normal: [60, 100], warning: [50, 120], critical: [40, 140] } },
            'hud-bp': { key: 'tension', shown: measured.has('tension') || mgr.isScopeConnected, thresholds: null },
            'hud-spo2': { key: 'saturationO2', shown: measured.has('saturationO2') || mgr.isScopeConnected, thresholds: { normal: [95, 100], warning: [92, 100], critical: [0, 85] } },
            'hud-temp': { key: 'temperature', shown: measured.has('temperature') || mgr.isScopeConnected, thresholds: { normal: [36.0, 37.5], warning: [35.5, 38.5], critical: [0, 35] } },
            'hud-fr': { key: 'frequenceRespiratoire', shown: measured.has('frequenceRespiratoire') || mgr.isScopeConnected, thresholds: { normal: [12, 20], warning: [10, 25], critical: [0, 8] } },
            'hud-gly': { key: 'glycemie', shown: measured.has('glycemie') || mgr.isScopeConnected, thresholds: null }
        };

        // Seuils TA spéciaux (systolique/diastolique)
        const bpThresholds = {
            systolic: { normal: [90, 140], warning: [85, 160], critical: [0, 70] },
            diastolic: { normal: [60, 90], warning: [55, 100], critical: [0, 45] }
        };

        Object.entries(map).forEach(([id, cfg]) => {
            const el = document.getElementById(id);
            if (!el) return;
            const item = el.closest('.hud-vital-item');
            
            let rawValue = '--';
            if (cfg.shown) {
                if (hasProps) {
                    if (cfg.key === 'pouls' && vitals.heartRate !== undefined) {
                        rawValue = `${Math.round(vitals.heartRate)} bpm`;
                    } else if (cfg.key === 'tension' && vitals.systolic !== undefined && vitals.diastolic !== undefined) {
                        rawValue = `${Math.round(vitals.systolic)}/${Math.round(vitals.diastolic)} mmHg`;
                    } else if (cfg.key === 'saturationO2' && vitals.spo2 !== undefined) {
                        rawValue = `${Math.round(vitals.spo2)}%`;
                    } else if (cfg.key === 'frequenceRespiratoire' && vitals.respiratoryRate !== undefined) {
                        rawValue = `${Math.round(vitals.respiratoryRate)}/min`;
                    } else if (cfg.key === 'temperature' && vitals.temperature !== undefined) {
                        rawValue = `${vitals.temperature.toFixed(1)}°C`;
                    } else {
                        rawValue = vitals[cfg.key] || constants[cfg.key] || '--';
                    }
                } else {
                    rawValue = constants[cfg.key] || '--';
                }
            }
            el.textContent = rawValue;

            // Coloration dynamique selon la gravité
            if (!cfg.shown || rawValue === '--') {
                el.style.color = 'rgba(255,255,255,0.3)';
                if (item) { item.classList.remove('warning', 'critical'); }
                return;
            }

            if (!cfg.thresholds) {
                // TA : coloration basée sur la valeur systolique
                if (id === 'hud-bp' && typeof rawValue === 'string') {
                    const m = rawValue.match(/(\d+)/);
                    if (m) {
                        const sys = parseInt(m[1]);
                        if (sys < 70 || sys > 180) {
                            el.style.color = '#ff4757';
                            el.style.textShadow = '0 0 10px rgba(255,71,87,0.5)';
                            el.style.animation = 'hudPulse 1s ease-in-out infinite';
                            if (item) item.classList.add('critical');
                        } else if (sys < 85 || sys > 160) {
                            el.style.color = '#ffc107';
                            el.style.textShadow = '0 0 10px rgba(255,193,7,0.5)';
                            el.style.animation = '';
                            if (item) { item.classList.remove('critical'); item.classList.add('warning'); }
                        } else {
                            el.style.color = '#fff';
                            el.style.textShadow = '0 0 10px rgba(0,242,254,0.5)';
                            el.style.animation = '';
                            if (item) { item.classList.remove('warning', 'critical'); }
                        }
                    }
                }
                return;
            }

            // Pour les constantes numériques, extraire la valeur
            const num = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue).replace(',', '.'));
            if (isNaN(num)) {
                el.style.color = '#fff';
                el.style.textShadow = '0 0 10px rgba(0,242,254,0.5)';
                el.style.animation = '';
                return;
            }

            // Déterminer le niveau de gravité
            const t = cfg.thresholds;
            let level = 'normal';
            // SpO2 inversé (dessous = plus grave)
            if (id === 'hud-spo2') {
                if (num <= t.critical[0]) level = 'critical';
                else if (num < t.warning[0]) level = 'warning';
                else level = 'normal';
            }
            // Température (les 2 extrêmes sont graves)
            else if (id === 'hud-temp') {
                if (num <= t.critical[0] || num >= t.critical[1]) level = 'critical';
                else if (num < t.warning[0] || num > t.warning[1]) level = 'warning';
                else level = 'normal';
            }
            // FC et FR
            else {
                if (num <= t.critical[0] || num >= t.critical[1]) level = 'critical';
                else if (num < t.warning[0] || num > t.warning[1]) level = 'warning';
            }

            // Appliquer la couleur
            if (level === 'critical') {
                el.style.color = '#ff4757';
                el.style.textShadow = '0 0 10px rgba(255,71,87,0.5)';
                el.style.animation = 'hudPulse 1s ease-in-out infinite';
                if (item) { item.classList.remove('warning'); item.classList.add('critical'); }
            } else if (level === 'warning') {
                el.style.color = '#ffc107';
                el.style.textShadow = '0 0 10px rgba(255,193,7,0.5)';
                el.style.animation = '';
                if (item) { item.classList.remove('critical'); item.classList.add('warning'); }
            } else {
                el.style.color = '#ffffff';
                el.style.textShadow = '0 0 10px rgba(0,242,254,0.5)';
                el.style.animation = '';
                if (item) { item.classList.remove('warning', 'critical'); }
            }
        });
    }

    /** 
     * Force une valeur vitale spécifique à s'afficher (après mesure instrument)
     * Met aussi à jour la coloration selon la gravité clinique.
     */
    setVital(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
            // Déclencher la mise à jour des couleurs
            this._updateVitals();
        }
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
     * Génère les questions suggérées contextuelles à partir des données du cas.
     * Extrait les thématiques clés de l'interrogatoire et les transforme en
     * questions naturelles que le joueur peut poser d'un clic.
     * @returns {Array<{text: string, category: string, icon: string}>}
     */
    _generateSuggestedQuestions() {
        const caseData = this.manager?.currentCase || window.gameState?.currentCase;
        if (!caseData) return [];

        const questions = [];
        const patient = caseData.patient || {};
        const prenom = patient.prenom || 'le patient';
        const interro = caseData.interrogatoire || {};
        const hm = interro.histoireMaladie || {};
        const mdv = interro.modeDeVie || {};
        const antec = interro.antecedents || {};
        const prenomLabel = (patient.sexe && patient.sexe.toLowerCase().startsWith('f')) ? 'elle' : 'il';

        // Motif d'hospitalisation — toujours pertinent en premier
        if (interro.motifHospitalisation) {
            questions.push({
                text: `Qu'est-ce qui vous amène à l'hôpital ?`,
                category: 'motif',
                icon: 'fa-stethoscope',
                fieldPath: 'interrogatoire.motifHospitalisation'
            });
        }

        // Douleur / Histoire de la maladie
        if (hm.debutSymptomes) {
            questions.push({
                text: `Quand les symptômes ont-ils commencé ?`,
                category: 'histoire',
                icon: 'fa-clock',
                fieldPath: 'interrogatoire.histoireMaladie.debutSymptomes'
            });
        }
        if (hm.facteursDeclenchants) {
            questions.push({
                text: `Qu'est-ce qui déclenche vos symptômes ?`,
                category: 'histoire',
                icon: 'fa-bolt',
                fieldPath: 'interrogatoire.histoireMaladie.facteursDeclenchants'
            });
        }
        if (hm.evolution) {
            questions.push({
                text: `Comment vos symptômes ont-ils évolué ?`,
                category: 'histoire',
                icon: 'fa-chart-line',
                fieldPath: 'interrogatoire.histoireMaladie.evolution'
            });
        }
        if (hm.symptomesAssocies && (Array.isArray(hm.symptomesAssocies) ? hm.symptomesAssocies.length > 0 : hm.symptomesAssocies)) {
            questions.push({
                text: `Avez-vous d'autres symptômes associés ?`,
                category: 'histoire',
                icon: 'fa-list-check',
                fieldPath: 'interrogatoire.histoireMaladie.symptomesAssocies'
            });
        }

        // Antécédents
        if (antec.medicaux && antec.medicaux.length > 0) {
            questions.push({
                text: `Avez-vous des antécédents médicaux ?`,
                category: 'antécédents',
                icon: 'fa-notes-medical',
                fieldPath: 'interrogatoire.antecedents.medicaux'
            });
        }
        if (antec.familiaux && antec.familiaux.length > 0) {
            questions.push({
                text: `Y a-t-il des maladies dans votre famille ?`,
                category: 'antécédents',
                icon: 'fa-people-group',
                fieldPath: 'interrogatoire.antecedents.familiaux'
            });
        }

        // Traitements
        if (interro.traitements && interro.traitements.length > 0) {
            questions.push({
                text: `Prenez-vous des médicaments actuellement ?`,
                category: 'traitements',
                icon: 'fa-pills',
                fieldPath: 'interrogatoire.traitements'
            });
        }

        // Allergies
        if (interro.allergies && interro.allergies.presence) {
            questions.push({
                text: `Avez-vous des allergies ?`,
                category: 'allergies',
                icon: 'fa-triangle-exclamation',
                fieldPath: 'interrogatoire.allergies'
            });
        }

        // Mode de vie
        if (mdv.tabac) {
            questions.push({
                text: `Fumez-vous ? Si oui, combien ?`,
                category: 'mode de vie',
                icon: 'fa-smoking',
                fieldPath: 'interrogatoire.modeDeVie.tabac'
            });
        }
        if (mdv.alcool) {
            questions.push({
                text: `Consommez-vous de l'alcool ?`,
                category: 'mode de vie',
                icon: 'fa-wine-glass',
                fieldPath: 'interrogatoire.modeDeVie.alcool.quantite'
            });
        }
        if (mdv.activitePhysique) {
            questions.push({
                text: `Quelle est votre activité physique ?`,
                category: 'mode de vie',
                icon: 'fa-person-running',
                fieldPath: 'interrogatoire.modeDeVie.activitePhysique.description'
            });
        }

        // Examen clinique — constantes
        if (caseData.examenClinique && caseData.examenClinique.constantes) {
            questions.push({
                text: `Comment vous sentez-vous en ce moment ?`,
                category: 'examen',
                icon: 'fa-heart-pulse',
                fieldPath: 'interrogatoire.histoireMaladie.symptomesActuels'
            });
        }

        return questions;
    }

    /**
     * Créer un dialogue flottant pour le patient (3D) avec questions suggérées contextuelles.
     */
    createFloatingDialog() {
        this.removeFloatingDialog();

        if (!this.hudElement) {
            this.hudElement = document.getElementById('three-hud');
        }
        if (!this.hudElement) return;

        const caseData = this.manager?.currentCase || window.gameState?.currentCase;
        if (caseData && (!this.llmPatient || this.llmPatient.caseData !== caseData)) {
            this.llmPatient = new LLMPatient(caseData);
        }
        const patient = caseData?.patient || {};
        const patientName = `${patient.prenom || 'Patient'} ${patient.nom || ''}`.trim();

        // Générer les suggestions contextuelles
        const suggestions = this._generateSuggestedQuestions();

        const dialog = document.createElement('div');
        dialog.id = 'floating-dialog';
        dialog.className = 'floating-dialog';

        // En-tête avec nom du patient
        let suggestionsHTML = '';
        if (suggestions.length > 0) {
            suggestionsHTML = `
                <div class="dialog-suggestions" id="dialog-suggestions-3d">
                    <div class="dialog-suggestions-header" id="dialog-suggestions-toggle-3d" style="cursor: pointer; display: flex; align-items: center; width: 100%;">
                        <i class="fas fa-lightbulb"></i> Questions suggérées
                        <i class="fas fa-chevron-down" id="dialog-suggestions-chevron-3d" style="margin-left: auto; font-size: 0.7rem; transition: transform 0.3s ease;"></i>
                    </div>
                    <div class="dialog-suggestions-list" id="dialog-suggestions-list-3d">
                        ${suggestions.map((s, i) => `
                            <button class="dialog-suggestion-btn" data-suggestion-index="${i}" data-category="${s.category}" data-field-path="${s.fieldPath || ''}">
                                <i class="fas ${s.icon}"></i>
                                <span>${s.text}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        dialog.innerHTML = `
            <div class="dialog-header">
                <span class="dialog-speaker" id="dialog-speaker">
                    <span class="dialog-speaker-icon">💬</span> ${patientName}
                </span>
                <button class="dialog-close" id="dialog-close-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="dialog-layout-wrapper">
                ${suggestionsHTML}
                <div class="dialog-chat-main">
                    <div class="dialog-body" id="dialog-messages-3d"></div>
                    <div class="dialog-input-area">
                        <input type="text" id="dialog-input-3d" placeholder="Posez une question au patient..." />
                        <button id="dialog-send-btn"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>
            </div>
        `;
        this.hudElement.appendChild(dialog);

        const closeBtn = document.getElementById('dialog-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.removeFloatingDialog());
        }

        // Toggle pour replier/déplier les suggestions latéralement
        const suggestionsToggle = dialog.querySelector('#dialog-suggestions-toggle-3d');
        const suggestionsList = dialog.querySelector('#dialog-suggestions-list-3d');
        const suggestionsChevron = dialog.querySelector('#dialog-suggestions-chevron-3d');
        const suggestionsPanel = dialog.querySelector('.dialog-suggestions');
        if (suggestionsToggle && suggestionsList && suggestionsPanel) {
            suggestionsToggle.addEventListener('click', () => {
                const isCollapsed = suggestionsList.style.display === 'none';
                suggestionsList.style.display = isCollapsed ? 'flex' : 'none';
                suggestionsPanel.style.width = isCollapsed ? '250px' : '40px';
                if (suggestionsChevron) {
                    suggestionsChevron.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(-90deg)';
                }
            });
        }

        // Brancher les boutons de suggestion
        const suggestionBtns = dialog.querySelectorAll('.dialog-suggestion-btn');
        suggestionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.querySelector('span')?.textContent || btn.textContent;
                const fieldPath = btn.dataset.fieldPath || '';
                this._askSuggestedQuestion(text, btn, fieldPath);
            });
        });

        this._observePatientChat();

        // Définir l'expression initiale du patient à l'ouverture du dialogue
        // à partir des données du cas (douleur, anxiété, etc.)
        this._applyFacialExpression(caseData?.patient?.expression || 'normal', 0.4);

        // Message d'accueil contextuel — adapté au motif d'hospitalisation
        const motif = caseData?.interrogatoire?.motifHospitalisation || '';
        const welcomeEmoji = motif ? '🏥' : '👋';
        const welcomeText = motif
            ? `${welcomeEmoji} Bonjour docteur, je suis là pour : ${motif}`
            : '👋 Bonjour docteur...';
        this._showPatientBubble(welcomeText, 4000);
    }

    /**
     * Poser une question suggérée — clique le bouton, désactive-le, et envoie la question.
     */
    _askSuggestedQuestion(text, btnEl, fieldPath = '') {
        const input = document.getElementById('dialog-input-3d');
        if (input) {
            input.value = text;
        }
        // Marquer visuellement le bouton comme utilisé
        if (btnEl) {
            btnEl.classList.add('suggestion-used');
            btnEl.disabled = true;
            // Animation de contraction
            setTimeout(() => {
                btnEl.style.maxHeight = '0';
                btnEl.style.padding = '0';
                btnEl.style.margin = '0';
                btnEl.style.opacity = '0';
                btnEl.style.overflow = 'hidden';
            }, 400);
        }
        // Déclencher l'envoi
        const sendBtn = document.getElementById('dialog-send-btn');
        if (sendBtn) sendBtn.click();

        // Suivi démarche pour le scoring composite
        if (fieldPath) {
            if (typeof trackInterrogatoire === 'function') {
                trackInterrogatoire(fieldPath);
            }
            document.dispatchEvent(new CustomEvent('interrogatoire-asked', { detail: { path: fieldPath } }));
        }

        // Marquer dans le suivi démarche
        if (window.scoringState) {
            if (!window.scoringState.hasAskedPatient) {
                window.scoringState.hasAskedPatient = true;
            }
        }

        // Vérifier s'il reste des suggestions
        const remaining = document.querySelectorAll('#dialog-suggestions-list-3d .dialog-suggestion-btn:not(.suggestion-used)');
        if (remaining.length === 0) {
            const suggestionsEl = document.getElementById('dialog-suggestions-3d');
            if (suggestionsEl) {
                suggestionsEl.style.transition = 'max-height 0.4s ease, opacity 0.3s ease';
                suggestionsEl.style.maxHeight = '0';
                suggestionsEl.style.opacity = '0';
                setTimeout(() => suggestionsEl.remove(), 500);
            }
        }
    }

    /**
     * Affiche une bulle flottante contextuelle au-dessus du patient en 3D.
     * La bulle apparaît près du HUD ou à côté du dialogue pendant quelques secondes.
     * @param {string} text - Texte à afficher dans la bulle
     * @param {number} duration - Durée en ms (défaut 3000)
     */
    _showPatientBubble(text, duration = 3000, accentColor = null) {
        // Supprimer l'ancienne bulle si présente
        const oldBubble = document.getElementById('patient-bubble-3d');
        if (oldBubble) oldBubble.remove();

        const bubble = document.createElement('div');
        bubble.id = 'patient-bubble-3d';
        bubble.className = 'patient-bubble-3d';
        // Appliquer la couleur d'accent sentimentale si fournie
        if (accentColor) {
            bubble.style.borderColor = accentColor + '55';
            bubble.style.boxShadow = `0 4px 24px ${accentColor}22, 0 0 0 1px ${accentColor}15`;
        }
        bubble.innerHTML = `
            <div class="patient-bubble-content">${text}</div>
            <div class="patient-bubble-tail" ${accentColor ? `style="border-top-color:${accentColor}cc"` : ''}></div>
        `;

        // Insérer la bulle dans le HUD 3D
        const hud = this.hudElement || document.getElementById('three-hud');
        if (hud) {
            hud.appendChild(bubble);
        } else {
            document.body.appendChild(bubble);
        }

        // Animer l'entrée
        requestAnimationFrame(() => {
            bubble.classList.add('patient-bubble-visible');
        });

        // Animer la sortie et supprimer
        setTimeout(() => {
            bubble.classList.remove('patient-bubble-visible');
            bubble.classList.add('patient-bubble-exit');
            setTimeout(() => bubble.remove(), 400);
        }, duration);

        // Déclencher l'expression "parle" sur le patient 3D
        this._applyFacialExpression('talking');
    }

    /**
     * Change l'expression du patient 3D de manière temporaire.
     * @param {string} expression - 'talking', 'douleur', 'pale', 'normal', etc.
     */
    _triggerPatientExpression(expression) {
        const scene = this.manager?.scene;
        if (!scene) return;

        // Chercher le groupe patient dans la scène
        const patientGroup = scene.scene?.getObjectByName('Patient tete')?.parent;
        if (!patientGroup) return;

        // Chercher la bouche pour l'animation "parle"
        const mouth = scene.scene?.getObjectByName('Patient bouche');
        if (expression === 'talking' && mouth) {
            // Animation de parole : faire osciller la bouche
            let tick = 0;
            const talkAnim = () => {
                tick++;
                mouth.scale.y = 1 + Math.sin(tick * 0.8) * 0.6;
                if (tick < 30) {
                    requestAnimationFrame(talkAnim);
                } else {
                    // Revenir à l'état normal
                    mouth.scale.y = 1;
                }
            };
            requestAnimationFrame(talkAnim);
        }
    }

    // ==================== ANALYSE DE SENTIMENT ====================

    /**
     * Analyse le sentiment d'une réponse du patient et retourne une émotion + emoji + couleur.
     * Mots-clés français classés par catégorie émotionnelle.
     * @param {string} text — Réponse brute du patient
     * @returns {{ expression: string, emoji: string, color: string, category: string }}
     */
    _analyzeSentiment(text) {
        const t = (text || '').toLowerCase();
        const accents = { 'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'à': 'a', 'â': 'a', 'ù': 'u', 'û': 'u', 'ü': 'u', 'î': 'i', 'ï': 'i', 'ô': 'o', 'ç': 'c' };
        const normalize = s => s.replace(/[éèêëàâùûüîïôç]/g, c => accents[c] || c);
        const n = normalize(t);

        // DOULEUR — priorité maximale
        const douleurWords = ['douleur', 'mal', 'douloureux', 'souffre', 'aie', 'aïe', 'brulure', 'brulent', 'brûle', 'brûlent', 'crampes', 'poignarde', 'serre', 'oppress', 'crampe', 'lancinant', 'lancinante', 'insupportable', 'atroce', 'violente', 'fort'];
        if (douleurWords.some(w => n.includes(w))) {
            return { expression: 'douleur', emoji: '😣', color: '#ff6b6b', category: 'douleur' };
        }

        // ANXIÉTÉ / PEUR
        const anxieteWords = ['inquiet', 'inquiète', 'peur', 'angoisse', 'angoissé', 'angoissée', 'anxieux', 'anxieuse', 'stress', 'stressé', 'stressée', 'nerveux', 'nerveuse', 'paniqu', 'appréhend', 'trembl', 'effrayé', 'effrayée', 'effroi', 'terreur', 'terrifié', 'angoiss'];
        if (anxieteWords.some(w => n.includes(w))) {
            return { expression: 'anxieux', emoji: '😰', color: '#ffa94d', category: 'anxiete' };
        }

        // SOULAGEMENT / POSITIF
        const soulagWords = ['merci', 'soulagé', 'soulagée', 'mieux', 'content', 'contente', 'heureux', 'heureuse', 'rassuré', 'rassurée', 'genial', 'génial', 'super', 'bien', 'parfait', 'excellent', 'agreable', 'agréable', 'sourire', 'content', 'reconnaissant', 'reconnaissante', 'remerci', 'confiance'];
        if (soulagWords.some(w => n.includes(w))) {
            return { expression: 'sourire', emoji: '😊', color: '#51cf66', category: 'soulagement' };
        }

        // CYANOSE / DETRESSE RESPIRATOIRE
        const cyanoWords = ['cyanose', 'cyanotique', 'bleu', 'bleuatre', 'bleuâtre', 'suffoque', 'dyspnée', 'dyspnee', 'essoufflé', 'essoufflée', 'halète', 'halete', 'respir', 'difficile'];
        if (cyanoWords.some(w => n.includes(w))) {
            return { expression: 'cyanose', emoji: '😶‍🌫️', color: '#748ffc', category: 'cyanose' };
        }

        // FIÈVRE
        const fievreWords = ['fievre', 'fièvre', 'fiévreux', 'fiévreuse', 'fièvreux', 'chaud', 'brulant', 'brûlant', 'frissons', 'frisson', 'thermo', 'temperature', 'température', 'celsius', 'trop chaud', 'transpir', 'sueur', 'sueur', 'sue'];
        if (fievreWords.some(w => n.includes(w))) {
            return { expression: 'fievre', emoji: '🤒', color: '#ff8787', category: 'fievre' };
        }

        // SURPRISE
        const surpriseWords = ['ah', 'oh', 'vraiment', 'surpris', 'surprise', 'etonné', 'étonné', 'etonnée', 'étonnée', 'incroyable', 'je ne savais pas', 'je ne m\'attendais', 'inattendu'];
        if (surpriseWords.some(w => n.includes(w))) {
            return { expression: 'etonne', emoji: '😲', color: '#fcc419', category: 'surprise' };
        }

        // TRISTESSE / ABDOMEN
        const tristeWords = ['triste', 'desole', 'désolé', 'desolée', 'désolée', 'malheureux', 'malheureuse', 'chagrin', 'pleur', 'deprimé', 'déprimé', 'deprimee', 'déprimée', 'fatigué', 'fatiguée', 'epuisé', 'épuisé', 'epuisée', 'épuisée', 'nausees', 'nausées', 'nauséeux', 'nauséeuse', 'vomi', 'vomissement'];
        if (tristeWords.some(w => n.includes(w))) {
            return { expression: 'pale', emoji: '😟', color: '#adb5bd', category: 'tristesse' };
        }

        // NEUTRE — par défaut (réponses informatives courtes)
        return { expression: 'normal', emoji: '💬', color: '#00f2fe', category: 'neutre' };
    }

    /**
     * Applique une expression faciale au patient 3D via le PatientAnimator.
     * Utilise setExpression() pour une transition douce, avec fallback direct.
     * @param {string} expression — nom de l'expression ('douleur', 'anxieux', 'sourire', etc.)
     * @param {number} duration — durée de transition en secondes (défaut 0.6)
     */
    _applyFacialExpression(expression, duration = 0.6) {
        const scene = this.manager?.scene;
        if (!scene?.patientAnimator) {
            // Fallback : animation directe par _triggerPatientExpression
            this._triggerPatientExpression(expression);
            return;
        }
        scene.patientAnimator.setExpression(expression, duration);
    }

    /**
     * Rétablit l'expression par défaut du patient (basée sur les données du cas).
     */
    _resetFacialExpression() {
        const caseData = this.manager?.currentCase || window.gameState?.currentCase;
        const defaultExpression = caseData?.patient?.expression || 'normal';
        this._applyFacialExpression(defaultExpression, 1.0);
    }

    // ==================== OBSERVATION DU CHAT PATIENT ====================

    _observePatientChat() {
        if (this._chatObserver) {
            this._chatObserver.disconnect();
        }

        const messages3d = document.getElementById('dialog-messages-3d');
        if (!messages3d) return;

        // Guard contre les doublons : chaque message 3D reçoit un ID unique basé sur horodatage
        let _msgCounter = 0;
        const makeMsgId = () => `msg3d-${Date.now()}-${++_msgCounter}`;

        const pushMessage = (speaker, text, sentiment = null) => {
            // Antidoublon : vérifier si un message identique vient d'être ajouté (dans les 100ms)
            const lastChild = messages3d.lastElementChild;
            if (lastChild) {
                const lastText = lastChild.querySelector('.dialog-msg-text')?.textContent?.trim();
                if (lastText === (typeof text === 'string' ? text.trim() : '')) {
                    return; // Doublon détecté, ignorer
                }
            }

            const row = document.createElement('div');
            row.className = speaker === 'Vous' ? 'from-user' : 'from-patient';
            row.dataset.msgId = makeMsgId();

            if (speaker !== 'Vous') {
                // Analyse automatique du sentiment si non fournie
                const sent = sentiment || this._analyzeSentiment(text);

                // Message du patient — avec émotion et bulle colorée
                row.innerHTML = `
                    <div class="dialog-msg-patient">
                        <span class="dialog-msg-avatar">${sent.emoji}</span>
                        <div class="dialog-msg-bubble" style="border-left:3px solid ${sent.color};">
                            <span class="dialog-msg-text">${typeof text === 'string' ? text : text}</span>
                        </div>
                    </div>
                `;
                // Animer l'expression du patient pendant la réponse
                this._applyFacialExpression('talking');
                // Puis transitionner vers l'émotion du sentiment après la réponse
                setTimeout(() => {
                    this._applyFacialExpression(sent.expression, 0.8);
                }, 1500);
            } else {
                // Message du joueur
                row.innerHTML = `
                    <div class="dialog-msg-user">
                        <div class="dialog-msg-bubble-user">
                            <span class="dialog-msg-text">${typeof text === 'string' ? text : text}</span>
                        </div>
                    </div>
                `;
                // Le docteur parle → le patient écoute (expression neutre ou attentive)
                // Ne PAS écraser le thinking indicator si affiché
                if (!document.getElementById('patient-thinking-bubble')) {
                    this._applyFacialExpression('normal', 0.4);
                }
            }
            messages3d.appendChild(row);
            messages3d.scrollTop = messages3d.scrollHeight;
        };

        // Re-charger l'historique existant s'il y en a pour un affichage cohérent
        if (window.patientChat?.messages && window.patientChat.messages.length > 0) {
            window.patientChat.messages.forEach(msg => {
                const speaker = (msg.role === 'user' || msg.role === 'Vous' || msg.role === 'user') ? 'Vous' : 'Patient';
                const text = msg.content.replace(/^(Patient|Vous|Directeur Clinique|Radiologue|Infirmier|Infirmière|Biologiste|Médecin Réanimateur|Cardiologue|Intervention)\s*:\s*/i, '').trim();
                pushMessage(speaker, text, null);
            });
        }

        // Patch patientChat.append pour écrire UNIQUEMENT dans le dialogue 3D enrichi.
        // L'original écrit dans le 2D, le patch écrit dans le 3D avec analyse de sentiment.
        // On NE remplace PAS les messages 3D par les clones 2D (plus de MutationObserver destructif).
        const chat = window.patientChat;
        if (chat && chat.append) {
            const origAppend = chat.append.bind(chat);
            this._origChatAppend = chat.append;
            chat.append = (speaker, text, returnTextNode) => {
                const textContent = typeof text === 'string' ? text : text.textContent || '';
                const sentiment = speaker !== 'Vous' ? this._analyzeSentiment(textContent) : null;
                // Afficher dans le dialogue 3D enrichi
                pushMessage(speaker, textContent, sentiment);
                // Afficher une bulle flottante avec émotion quand le patient répond
                if (speaker !== 'Vous' && textContent) {
                    const shortText = textContent.length > 80 ? textContent.substring(0, 77) + '...' : textContent;
                    this._showPatientBubble(`${sentiment.emoji} ${shortText}`, 4500, sentiment.color);
                }
                // Laisser l'original écrire dans le conteneur 2D classique
                return origAppend(speaker, text, returnTextNode);
            };
        }

        // Afficher l'indicateur "réflexion" pendant que l'IA répond (avec streaming SSE via LLMPatient)
        const origAsk = chat?.ask?.bind(chat);
        if (origAsk) {
            this._origChatAsk = chat.ask;
            chat.ask = async (question) => {
                if (!question.trim()) return;

                const isAction = window.clinicalAgentAI && window.clinicalAgentAI.isClinicalAction(question);
                
                if (isAction) {
                    // 1. Exécuter d'abord les conséquences cliniques (constantes, score, perf, etc.)
                    // On indique à processClinicalAction3D de NE PAS générer son propre verbatim patient
                    await window.clinicalAgentAI.processClinicalAction3D(question, this, { skipVerbatim: true });
                } else {
                    // Sinon on l'append manuellement (processClinicalAction3D va déjà l'append pour les actions)
                    chat.append('Vous', question);
                    chat.messages.push({ role: 'user', content: question });
                }
                
                if (window.scoringState) window.scoringState.hasAskedPatient = true;

                // 2. Afficher l'indicateur de réflexion
                this._showThinkingIndicator();

                try {
                    let streamingBubbleRow = null;
                    let textSpan = null;
                    let avatarSpan = null;
                    let currentFullText = '';

                    // Lancer la requête LLM streaming
                    await this.llmPatient.ask(
                        question,
                        // Callback pour chaque token reçu
                        (token) => {
                            // Masquer l'indicateur de réflexion dès que l'IA commence à répondre
                            this._hideThinkingIndicator();

                            if (!streamingBubbleRow) {
                                // Créer le conteneur du message patient
                                streamingBubbleRow = document.createElement('div');
                                streamingBubbleRow.className = 'from-patient';
                                streamingBubbleRow.dataset.msgId = makeMsgId();

                                const sent = this._analyzeSentiment('');
                                streamingBubbleRow.innerHTML = `
                                    <div class="dialog-msg-patient">
                                        <span class="dialog-msg-avatar">${sent.emoji}</span>
                                        <div class="dialog-msg-bubble" style="border-left: 3px solid ${sent.color};">
                                            <span class="dialog-msg-text"></span>
                                        </div>
                                    </div>
                                `;
                                messages3d.appendChild(streamingBubbleRow);
                                textSpan = streamingBubbleRow.querySelector('.dialog-msg-text');
                                avatarSpan = streamingBubbleRow.querySelector('.dialog-msg-avatar');

                                // Lancer l'animation de parole du patient 3D
                                this._applyFacialExpression('talking');
                            }

                            // Ajouter le token au texte courant
                            currentFullText += token;
                            if (textSpan) {
                                textSpan.textContent = currentFullText;
                            }

                            // Analyser dynamiquement le sentiment en cours de frappe pour adapter l'avatar et la couleur
                            const sent = this._analyzeSentiment(currentFullText);
                            if (avatarSpan) {
                                avatarSpan.textContent = sent.emoji;
                            }
                            const bubble = streamingBubbleRow.querySelector('.dialog-msg-bubble');
                            if (bubble) {
                                bubble.style.borderLeft = `3px solid ${sent.color}`;
                            }

                            // Défiler automatiquement vers le bas
                            messages3d.scrollTop = messages3d.scrollHeight;
                        },
                        // Callback lorsque la réponse est complète
                        (finalResponse) => {
                            this._hideThinkingIndicator();

                            // Obtenir le sentiment final
                            const sent = this._analyzeSentiment(finalResponse);

                            if (!streamingBubbleRow) {
                                // Fallback si aucun token n'a été reçu avant la complétion (ex: appel immédiat)
                                pushMessage('Patient', finalResponse, sent);
                            } else {
                                // Mettre à jour l'expression faciale finale du patient 3D après une courte transition
                                setTimeout(() => {
                                    this._applyFacialExpression(sent.expression, 0.8);
                                }, 500);

                                // Afficher la bulle flottante 3D avec émotion
                                const shortText = finalResponse.length > 80 ? finalResponse.substring(0, 77) + '...' : finalResponse;
                                this._showPatientBubble(`${sent.emoji} ${shortText}`, 4500, sent.color);
                            }

                            // Synchroniser le message final avec le conteneur 2D classique pour garder la cohérence du gameplay
                            const root2d = document.getElementById('dialogue-messages');
                            if (root2d) {
                                const row = document.createElement('div');
                                row.className = 'dialogue-message from-patient';
                                const label = document.createElement('strong');
                                label.textContent = 'Patient : ';
                                const body = document.createElement('span');
                                body.textContent = finalResponse;
                                row.append(label, body);
                                root2d.appendChild(row);
                                root2d.scrollTop = root2d.scrollHeight;
                            }
                            chat.messages.push({ role: 'assistant', content: finalResponse });

                            if (window.EcosMode && typeof window.EcosMode.classifyAndCheck === 'function') {
                                window.EcosMode.classifyAndCheck(question, finalResponse);
                            }
                        },
                        // Callback en cas d'erreur (Ollama absent, réseau coupé, etc.)
                        (errorMsg) => {
                            this._hideThinkingIndicator();
                            console.warn('[3D Chat] Erreur de flux LLM, fallback local automatique déjà géré par LLMPatient.');
                        }
                    );
                } catch (err) {
                    this._hideThinkingIndicator();
                    console.error('[3D Chat] Erreur critique dans la gestion du chat:', err);
                }
            };
        }


        // Helper de normalisation pour comparer rigoureusement sans préfixe ni guillemet
        const normalizeText = (t) => {
            if (typeof t !== 'string') return '';
            return t.replace(/^(Patient|Vous|Directeur Clinique|Radiologue|Infirmier|Infirmière|Biologiste|Médecin Réanimateur|Cardiologue|Intervention)\s*:\s*/i, '')
                    .replace(/^[«“"'`\s]+|[»”"'`\s]+$/g, '')
                    .trim()
                    .toLowerCase();
        };

        // MutationObserver SYNCHRONE : on écoute le conteneur 2D pour récupérer
        // les messages qui arrivent par d'autres chemins (boutons suggérés du 2D, etc.)
        // MAIS on ne fait qu'ajouter les messages manquants, jamais tout remplacer.
        const observer = new MutationObserver((mutations) => {
            const classicMessages = document.querySelectorAll('#dialogue-messages .dialogue-message');
            if (classicMessages.length === 0) return;

            // Construire l'ensemble des textes déjà affichés en 3D
            const existingTexts = new Set();
            messages3d.querySelectorAll('.dialog-msg-text').forEach(el => {
                existingTexts.add(normalizeText(el.textContent));
            });

            // Pour chaque message 2D, vérifier s'il manque dans le 3D
            let addedAny = false;
            classicMessages.forEach(m => {
                const span = m.querySelector('span');
                const rawText = span ? span.textContent : m.textContent;
                const norm = normalizeText(rawText);
                if (norm && !existingTexts.has(norm)) {
                    // Déterminer le type (user vs patient)
                    const isFromUser = m.classList.contains('from-user');
                    const speaker = isFromUser ? 'Vous' : 'Patient';
                    const cleanText = span ? span.textContent.trim() : rawText.replace(/^(Patient|Vous)\s*:\s*/i, '').trim();
                    pushMessage(speaker, cleanText, null);
                    existingTexts.add(norm);
                    addedAny = true;
                }
            });

            if (addedAny) {
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
            input.value = '';
            if (chat) {
                // chat.ask() appelle chat.append('Vous', question) en interne,
                // qui est monkey-patché pour aussi afficher dans le dialogue 3D.
                // On ne doit PAS appeler pushMessage('Vous', val) ici sinon doublon.
                chat.ask(val);
            } else {
                // Pas de chat 2D disponible → afficher uniquement dans le dialogue 3D
                pushMessage('Vous', val);
            }
        };

        sendBtn?.removeEventListener('click', this._sendHandler);
        input?.removeEventListener('keypress', this._keyHandler);

        this._sendHandler = sendMessage;
        this._keyHandler = (e) => { if (e.key === 'Enter') sendMessage(); };

        sendBtn?.addEventListener('click', this._sendHandler);
        input?.addEventListener('keypress', this._keyHandler);
    }

    // ==================== INDICATEUR DE RÉFLEXION ====================

    /**
     * Affiche un indicateur animé de "réflexion" (points de suspension animés)
     * au-dessus du patient 3D et change l'expression vers "attentive".
     */
    _showThinkingIndicator() {
        this._hideThinkingIndicator(); // Nettoyer l'ancien si présent

        // Expression attentive du patient en attendant la réponse
        this._applyFacialExpression('anxieux', 0.3); // Yeux davantage ouverts = attentif

        const bubble = document.createElement('div');
        bubble.id = 'patient-thinking-bubble';
        bubble.className = 'patient-bubble-3d patient-bubble-visible';
        bubble.innerHTML = `
            <div class="patient-bubble-content">
                <span class="thinking-dots">
                    <span class="thinking-dot" style="animation-delay: 0s;">●</span>
                    <span class="thinking-dot" style="animation-delay: 0.3s;">●</span>
                    <span class="thinking-dot" style="animation-delay: 0.6s;">●</span>
                </span>
            </div>
            <div class="patient-bubble-tail"></div>
        `;

        const hud = this.hudElement || document.getElementById('three-hud');
        if (hud) {
            hud.appendChild(bubble);
        } else {
            document.body.appendChild(bubble);
        }
    }

    /**
     * Masque l'indicateur de réflexion.
     */
    _hideThinkingIndicator() {
        const thinking = document.getElementById('patient-thinking-bubble');
        if (thinking) thinking.remove();
    }

    removeFloatingDialog() {
        // Restore original patientChat.append if we patched it
        if (this._origChatAppend && window.patientChat) {
            window.patientChat.append = this._origChatAppend;
            this._origChatAppend = null;
        }
        // Restore original patientChat.ask if we patched it
        if (this._origChatAsk && window.patientChat) {
            window.patientChat.ask = this._origChatAsk;
            this._origChatAsk = null;
        }
        const existing = document.getElementById('floating-dialog');
        if (existing) existing.remove();
        // Nettoyer aussi la bulle patient et l'indicateur de réflexion
        const bubble = document.getElementById('patient-bubble-3d');
        if (bubble) bubble.remove();
        this._hideThinkingIndicator();
        // Rétablir l'expression par défaut du patient
        this._resetFacialExpression();
    }
}