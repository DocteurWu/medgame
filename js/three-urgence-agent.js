/**
 * three-urgence-agent.js — Agent du mode urgence en 3D
 * Atelier 2: Jouabilité & Fun par Cas
 *
 * Transforme le HUD 3D en mode urgence immersif quand le cas est un cas d'urgence :
 * - Vignette rouge pulsante sur les bords de l'écran
 * - Timer angoissant avec pulsation accélérée quand le temps diminue
 * - Constantes vitales dynamiques en temps réel (FC, TA, SpO2, T°)
 * - Bandeau clinique défilant avec la description du nœud d'urgence
 * - Boutons d'action urgence flottants dans le HUD 3D
 * - Flash d'alerte visuel à chaque transition d'état
 * - Compatible 2D : ne s'active que si le mode 3D est actif
 */

export class ThreeUrgenceAgent {
    constructor(threeManager) {
        this.manager = threeManager;
        this.active = false;
        this.urgNode = null;
        this._timerInterval = null;
        this._vitalsInterval = null;
        this._vignetteEl = null;
        this._timerEl = null;
        this._timerLabelEl = null;
        this._bannerEl = null;
        this._vitalsEl = null;
        this._actionsEl = null;
        this._overlayEl = null;
        this._pulseClassActive = false;
        this._lastTimeLeft = null;
    }

    // ==================== ACTIVATION / DÉSACTIVATION ====================

    /**
     * Active le mode urgence 3D.
     * @param {Object} urgNode — Premier nœud d'urgence (currentCase.nodes[startNode])
     * @param {Object} currentCase — Les données complètes du cas
     */
    activate(urgNode, currentCase) {
        if (this.active) this.deactivate();
        this.active = true;
        this.urgNode = urgNode;

        this._createOverlay();
        this._createVignette();
        this._createTimer();
        this._createBanner();
        this._createVitals();
        this._createActions();
        this._startVitalsSync();

        // Mettre à jour le visuel patient dès l'activation
        this._updatePatientVisuel(urgNode);

        // Flash d'entrée dramatique
        this._flashScreen('#ff4757', 800);

        console.info('[UrgenceAgent] Mode urgence 3D activé');
    }

    /**
     * Désactive le mode urgence 3D et nettoie le DOM.
     */
    deactivate() {
        this.active = false;
        this.urgNode = null;
        this._lastTimeLeft = null;

        if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }
        if (this._vitalsInterval) { clearInterval(this._vitalsInterval); this._vitalsInterval = null; }

        this._removeEl('_overlayEl');
        this._removeEl('_vignetteEl');
        this._removeEl('_timerEl');
        this._removeEl('_bannerEl');
        this._removeEl('_vitalsEl');
        this._removeEl('_actionsEl');

        // Retirer les classes CSS urgence du body
        document.body.classList.remove('urgence-3d-active');

        console.info('[UrgenceAgent] Mode urgence 3D désactivé');
    }

    // ==================== TRANSITION D'ÉTAT ====================

    /**
     * Met à jour le nœud d'urgence courant (appelé à chaque transition).
     * @param {Object} newNode — Nouveau nœud d'urgence
     */
    transitionTo(newNode) {
        if (!this.active) return;
        this.urgNode = newNode;

        // Flash d'alerte visuel
        this._flashScreen('#ff4757', 500);

        // Mettre à jour le bandeau clinique
        this._updateBanner(newNode);

        // Mettre à jour les actions disponibles
        this._updateActions(newNode);

        // Mettre à jour les constantes cibles
        this._updateVitalTargets(newNode);

        // Mettre à jour le visuel 3D du patient
        this._updatePatientVisuel(newNode);

        // Si état final (succès/échec), afficher le résultat
        if (newNode.isEndState) {
            this._showEndState(newNode);
        }
    }

    // ==================== CRÉATION DES ÉLÉMENTS DOM ====================

    _createOverlay() {
        // Conteneur principal qui recevra tous les éléments urgence
        const overlay = document.createElement('div');
        overlay.id = 'urgence-3d-overlay';
        overlay.className = 'urgence-3d-overlay';
        document.body.appendChild(overlay);
        this._overlayEl = overlay;
        document.body.classList.add('urgence-3d-active');
    }

    _createVignette() {
        // Vignette rouge pulsante sur les bords de l'écran
        const vignette = document.createElement('div');
        vignette.id = 'urgence-vignette';
        vignette.className = 'urgence-vignette';
        // L'inner shadow simule la pulsation via CSS animation
        vignette.innerHTML = '<div class="urgence-vignette-inner"></div>';
        document.body.appendChild(vignette);
        this._vignetteEl = vignette;
    }

    _createTimer() {
        // Timer angoissant positionné en haut au centre
        const timer = document.createElement('div');
        timer.id = 'urgence-timer-3d';
        timer.className = 'urgence-timer-3d';
        timer.innerHTML = `
            <div class="urgence-timer-icon"><i class="fas fa-heartbeat"></i></div>
            <div class="urgence-timer-value" id="urgence-timer-value">--:--</div>
            <div class="urgence-timer-label" id="urgence-timer-label">TEMPS RESTANT</div>
        `;
        document.body.appendChild(timer);
        this._timerEl = timer;

        // Synchroniser avec le timer 2D existant (timerState)
        this._startTimerSync();
    }

    _createBanner() {
        // Bandeau clinique défilant en bas de l'écran
        const banner = document.createElement('div');
        banner.id = 'urgence-banner-3d';
        banner.className = 'urgence-banner-3d';
        const desc = this.urgNode?.descriptionClinique || '';
        banner.innerHTML = `
            <div class="urgence-banner-icon"><i class="fas fa-exclamation-triangle"></i></div>
            <div class="urgence-banner-text">${desc}</div>
        `;
        document.body.appendChild(banner);
        this._bannerEl = banner;
    }

    _createVitals() {
        // Panneau de constantes vitales dynamiques — en haut à droite
        const vitals = document.createElement('div');
        vitals.id = 'urgence-vitals-3d';
        vitals.className = 'urgence-vitals-3d';

        const cibles = this.urgNode?.constantesCibles || {};
        const fallback = (vitalsData) => vitalsData || '--';

        vitals.innerHTML = `
            <div class="urgence-vitals-header">
                <i class="fas fa-wave-square"></i> Constantes
            </div>
            <div class="urgence-vitals-grid">
                <div class="urgence-vital-row" data-vital="fc">
                    <span class="urgence-vital-label">FC</span>
                    <span class="urgence-vital-value" id="urg-vital-fc">${fallback(cibles.pouls)}</span>
                    <span class="urgence-vital-unit">bpm</span>
                </div>
                <div class="urgence-vital-row" data-vital="ta">
                    <span class="urgence-vital-label">TA</span>
                    <span class="urgence-vital-value" id="urg-vital-ta">${fallback(cibles.tension)}</span>
                    <span class="urgence-vital-unit">mmHg</span>
                </div>
                <div class="urgence-vital-row" data-vital="spo2">
                    <span class="urgence-vital-label">SpO₂</span>
                    <span class="urgence-vital-value" id="urg-vital-spo2">${fallback(cibles.saturationO2)}</span>
                    <span class="urgence-vital-unit">%</span>
                </div>
                <div class="urgence-vital-row" data-vital="temp">
                    <span class="urgence-vital-label">T°</span>
                    <span class="urgence-vital-value" id="urg-vital-temp">${fallback(cibles.temperature)}</span>
                    <span class="urgence-vital-unit">°C</span>
                </div>
                <div class="urgence-vital-row" data-vital="fr">
                    <span class="urgence-vital-label">FR</span>
                    <span class="urgence-vital-value" id="urg-vital-fr">${fallback(cibles.frequenceRespiratoire)}</span>
                    <span class="urgence-vital-unit">/min</span>
                </div>
            </div>
        `;
        document.body.appendChild(vitals);
        this._vitalsEl = vitals;
    }

    _createActions() {
        // Boutons d'action urgence flottants — en bas à droite
        const actions = document.createElement('div');
        actions.id = 'urgence-actions-3d';
        actions.className = 'urgence-actions-3d';
        document.body.appendChild(actions);
        this._actionsEl = actions;
        this._updateActions(this.urgNode);
    }

    // ==================== MISE À JOUR DYNAMIQUE ====================

    /**
     * Met à jour le visuel 3D du patient en fonction du nœud d'urgence.
     * Lit `patientVisuel` du nœud s'il existe, sinon infère depuis les constantes et la description.
     * @param {Object} node — nœud d'urgence
     */
    _updatePatientVisuel(node) {
        if (!node) return;

        // Récupérer la scène 3D via le manager
        const scene3D = this.manager?.scene;
        if (!scene3D || !scene3D.patient) return;

        // Récupérer le visuel du nœud (explicite ou inféré)
        const visuel = node.patientVisuel || this._inferPatientVisuel(node);

        // Appliquer via applyUrgenceVisuel
        const animator = scene3D.patientAnimator;
        scene3D.patient.applyUrgenceVisuel(visuel, animator);

        // Si l'animateur a été réinitialisé (changement de position), le réattacher
        if (animator && animator.group !== scene3D.patient.group) {
            animator.group = scene3D.patient.group;
            animator._cacheResolved = false;
        }

        // Adapter le pattern respiratoire
        if (animator && visuel.respiration) {
            animator.setRespirationPattern(visuel.respiration);
        }

        // Recalibrer les hotspots si position a changé
        if (visuel.position && typeof scene3D.updateHotspotsPosition === 'function') {
            scene3D.updateHotspotsPosition();
        }

        console.info('[UrgenceAgent] Patient visuel mis à jour:', visuel);
    }

    /**
     * Infère les propriétés visuelles du patient depuis les constantes et la description clinique.
     * Utilisé quand `patientVisuel` n'est pas explicitement défini dans le nœud.
     * @param {Object} node
     * @returns {Object} visuel inféré
     */
    _inferPatientVisuel(node) {
        const desc = (node.descriptionClinique || '').toLowerCase();
        const cibles = node.constantesCibles || {};
        const spo2 = parseInt(cibles.saturationO2) || 98;
        const pouls = parseInt(cibles.pouls) || 72;

        let expression = 'douleur';
        let position = null;  // null = garder la position courante
        let respiration = null;

        // Détection par mots-clés dans la description
        if (desc.includes('inconscient') || desc.includes('ne réagit') || desc.includes('perd connaissance')) {
            expression = 'inconscient';
            position = 'allonge';
            respiration = 'agonal';
        } else if (desc.includes('arret') || desc.includes('arrêt') || desc.includes('acr') || desc.includes('ne respire plus')) {
            expression = 'acr';
            position = 'allonge';
            respiration = 'agonal';
        } else if (desc.includes('saign') || desc.includes('hémorrag') || desc.includes('gicle') || desc.includes('sang')) {
            expression = 'hemorragie';
            respiration = 'tachypnea';
        } else if (desc.includes('brûl') || desc.includes('brulure') || desc.includes('flamme')) {
            expression = 'brulure';
        } else if (desc.includes('bleu') || desc.includes('cyanose') || spo2 < 85) {
            expression = 'cyanose';
            respiration = 'dyspnea';
        } else if (desc.includes('étouffe') || desc.includes('obstruction') || desc.includes('gorge')) {
            expression = 'cyanose';
            respiration = 'dyspnea';
        } else if (desc.includes('choc') || desc.includes('livide') || desc.includes('pâli')) {
            expression = 'choc';
        } else if (desc.includes('convuls') || desc.includes('crise')) {
            expression = 'convulsion';
            respiration = 'dyspnea';
        } else if (spo2 < 90 || pouls > 140) {
            expression = 'cyanose';
        }

        return { expression, position, respiration };
    }

    _updateBanner(newNode) {
        const textEl = this._bannerEl?.querySelector('.urgence-banner-text');
        if (textEl && newNode?.descriptionClinique) {
            textEl.textContent = newNode.descriptionClinique;
            // Flash animation
            this._bannerEl.classList.remove('urgence-banner-flash');
            void this._bannerEl.offsetWidth; // force reflow
            this._bannerEl.classList.add('urgence-banner-flash');
        }
    }

    _updateActions(newNode) {
        if (!this._actionsEl || !newNode) return;
        this._actionsEl.innerHTML = '';

        if (!newNode.actionsDisponibles || newNode.actionsDisponibles.length === 0) return;

        const header = document.createElement('div');
        header.className = 'urgence-actions-header';
        header.innerHTML = '<i class="fas fa-hand-pointer"></i> Actions';
        this._actionsEl.appendChild(header);

        newNode.actionsDisponibles.forEach((action, index) => {
            const btn = document.createElement('button');
            btn.className = 'urgence-action-btn-3d';
            btn.id = `urg-3d-action-${index}`;

            // Icône contextuelle
            let icon = 'fa-user-md';
            const label = (action.label || '').toLowerCase();
            if (label.includes('massage') || label.includes('acr') || label.includes('compression')) icon = 'fa-heartbeat';
            if (label.includes('défibrillation') || label.includes('dae') || label.includes('choc')) icon = 'fa-bolt';
            if (label.includes('oxygène') || label.includes('o2') || label.includes('ventilation')) icon = 'fa-lungs';
            if (label.includes('médicament') || label.includes('injection') || label.includes('adrénaline') || label.includes('perfusion')) icon = 'fa-syringe';
            if (label.includes('garrot') || label.includes('pansement') || label.includes('hémorragie')) icon = 'fa-band-aid';
            if (label.includes('bilan') || label.includes('samu') || label.includes('appeler')) icon = 'fa-phone-alt';
            if (label.includes('position') || label.includes('pls') || label.includes('debout')) icon = 'fa-person-falling';

            btn.innerHTML = `
                <i class="fas ${icon}"></i>
                <span class="urgence-action-label">${action.label}</span>
                <span class="urgence-action-time">-${action.tempsExecutionSec}s</span>
            `;
            btn.addEventListener('click', () => {
                // Marquer visuellement le bouton 3D comme cliqué
                btn.classList.add('urgence-action-selected');
                btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span class="urgence-action-label">En cours (${action.tempsExecutionSec}s)...</span>`;

                // Synchroniser avec le bouton 2D correspondant
                const btn2D = document.getElementById(`urg-action-btn-${index}`);
                if (btn2D && !btn2D.disabled) {
                    btn2D.click();
                } else {
                    // Fallback : appeler executeUrgenceAction directement
                    if (typeof executeUrgenceAction === 'function') {
                        executeUrgenceAction(action, btn);
                    }
                }
            });
            this._actionsEl.appendChild(btn);
        });
    }

    _updateVitalTargets(newNode) {
        const cibles = newNode?.constantesCibles;
        if (!cibles) return;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val !== undefined && val !== null && val !== '') {
                el.textContent = val;
                // Animer le changement
                el.classList.remove('urgence-vital-flash');
                void el.offsetWidth;
                el.classList.add('urgence-vital-flash');
            }
        };

        setVal('urg-vital-fc', cibles.pouls);
        setVal('urg-vital-ta', cibles.tension);
        setVal('urg-vital-spo2', cibles.saturationO2);
        setVal('urg-vital-temp', cibles.temperature);
        setVal('urg-vital-fr', cibles.frequenceRespiratoire);

        // Mettre à jour le moniteur vitaux 2D aussi
        this._sync2DVitals(cibles);

        // Classification des niveaux d'alerte pour chaque constante
        this._classifyVitals(cibles);
    }

    _classifyVitals(cibles) {
        const classify = (id, value, thresholds) => {
            const el = document.getElementById(id);
            if (!el || value === undefined) return;
            const row = el.closest('.urgence-vital-row');
            if (!row) return;

            const numVal = parseFloat(value);
            if (isNaN(numVal)) return;

            row.classList.remove('urgence-vital-normal', 'urgence-vital-warning', 'urgence-vital-critical');

            // Seuils cliniques pour la classification
            const t = thresholds || { warningLow: 0, warningHigh: 999, criticalLow: 0, criticalHigh: 999 };
            if (numVal <= t.criticalLow || numVal >= t.criticalHigh) {
                row.classList.add('urgence-vital-critical');
            } else if (numVal <= t.warningLow || numVal >= t.warningHigh) {
                row.classList.add('urgence-vital-warning');
            } else {
                row.classList.add('urgence-vital-normal');
            }
        };

        // Seuils cliniques inline (indépendant du module vitalSigns)
        const TH = {
            fc:   { warningLow: 50, warningHigh: 120, criticalLow: 40, criticalHigh: 140 },
            ta:   { warningLow: 85, warningHigh: 160, criticalLow: 70, criticalHigh: 180 },
            spo2: { warningLow: 92, warningHigh: 999, criticalLow: 85, criticalHigh: 999 },
            temp: { warningLow: 35.5, warningHigh: 38.5, criticalLow: 35.0, criticalHigh: 40.0 },
        };

        const fc = parseInt(cibles.pouls) || 72;
        classify('urg-vital-fc', fc, TH.fc);

        const bpText = cibles.tension || '120/80';
        const bp = (typeof parseBP === 'function') ? parseBP(bpText) : { systolic: parseInt(bpText.split('/')[0]) || 120 };
        classify('urg-vital-ta', bp.systolic, TH.ta);

        const spo2 = parseInt(cibles.saturationO2) || 98;
        classify('urg-vital-spo2', spo2, TH.spo2);

        const temp = parseFloat(cibles.temperature) || 36.6;
        classify('urg-vital-temp', temp, TH.temp);
    }

    _sync2DVitals(cibles) {
        // Synchroniser les constantes avec le moniteur 2D existant
        if (typeof urgenceState !== 'undefined' && urgenceState.vitalMonitorInstance && cibles) {
            const bpText = cibles.tension || '120/80';
            const bp = (typeof parseBP === 'function') ? parseBP(bpText) : { systolic: parseInt(bpText.split('/')[0]) || 120, diastolic: parseInt(bpText.split('/')[1]) || 80 };
            urgenceState.vitalMonitorInstance.updateProps({
                systolic: bp.systolic,
                diastolic: bp.diastolic,
                heartRate: parseInt(cibles.pouls) || 72,
                spo2: parseInt(cibles.saturationO2) || 98,
                temperature: parseFloat(cibles.temperature) || 36.6,
                respiratoryRate: parseInt(cibles.frequenceRespiratoire) || 16
            });
        }

        // Synchroniser aussi les champs 2D simples
        const map = {
            'tension': cibles.tension,
            'pouls': cibles.pouls,
            'saturationO2': cibles.saturationO2,
            'frequenceRespiratoire': cibles.frequenceRespiratoire
        };
        Object.entries(map).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el && val) el.textContent = val;
        });
    }

    // ==================== TIMER SYNC ====================

    _startTimerSync() {
        if (this._timerInterval) clearInterval(this._timerInterval);

        const update = () => {
            if (!this.active) return;

            const timerEl = document.getElementById('urgence-timer-value');
            const labelEl = document.getElementById('urgence-timer-label');
            if (!timerEl) return;

            let timeLeft = 0;
            if (typeof timerState !== 'undefined' && timerState.timeLeft !== undefined) {
                timeLeft = timerState.timeLeft;
            } else if (typeof window.timerState !== 'undefined' && window.timerState.timeLeft !== undefined) {
                timeLeft = window.timerState.timeLeft;
            }

            const mins = Math.floor(Math.max(0, timeLeft) / 60);
            const secs = Math.max(0, timeLeft) % 60;
            timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

            // Pulsation croissante avec l'urgence
            const timerContainer = document.getElementById('urgence-timer-3d');
            if (timerContainer) {
                timerContainer.classList.remove('urgence-timer-critical', 'urgence-timer-warning', 'urgence-timer-normal');
                if (timeLeft <= 60) {
                    timerContainer.classList.add('urgence-timer-critical');
                } else if (timeLeft <= 180) {
                    timerContainer.classList.add('urgence-timer-warning');
                } else {
                    timerContainer.classList.add('urgence-timer-normal');
                }
            }

            // Intensifier la vignette quand le temps baisse
            const vignette = document.getElementById('urgence-vignette');
            if (vignette) {
                if (timeLeft <= 30) {
                    vignette.classList.remove('urgence-vig-warn', 'urgence-vig-normal');
                    vignette.classList.add('urgence-vig-critical');
                } else if (timeLeft <= 120) {
                    vignette.classList.remove('urgence-vig-critical', 'urgence-vig-normal');
                    vignette.classList.add('urgence-vig-warn');
                } else {
                    vignette.classList.remove('urgence-vig-critical', 'urgence-vig-warn');
                    vignette.classList.add('urgence-vig-normal');
                }
            }

            this._lastTimeLeft = timeLeft;
        };

        update();
        this._timerInterval = setInterval(update, 500);
    }

    // ==================== VITALS DYNAMIC SYNC ====================

    _startVitalsSync() {
        if (this._vitalsInterval) clearInterval(this._vitalsInterval);

        const sync = () => {
            if (!this.active) return;

            // Essayer de récupérer les valeurs du moniteur dynamique
            const vm = window.gameState?.vitalMonitorInstance;
            if (vm && vm.props) {
                const p = vm.props;
                const setVal = (id, val) => {
                    const el = document.getElementById(id);
                    if (el && val !== undefined && val !== null) {
                        el.textContent = val;
                    }
                };
                setVal('urg-vital-fc', p.heartRate || p.pouls);
                setVal('urg-vital-ta', p.systolic && p.diastolic ? `${p.systolic}/${p.diastolic}` : p.tension);
                setVal('urg-vital-spo2', p.spo2 || p.saturationO2);
                setVal('urg-vital-temp', p.temperature);
                setVal('urg-vital-fr', p.respiratoryRate || p.frequenceRespiratoire);
            }
        };

        this._vitalsInterval = setInterval(sync, 1500);
    }

    // ==================== EFFETS VISUELS ====================

    /**
     * Flash coloré plein écran (alerte visuelle dramatique)
     */
    _flashScreen(color, duration = 500) {
        const flash = document.createElement('div');
        flash.className = 'urgence-flash-overlay';
        flash.style.backgroundColor = color;
        document.body.appendChild(flash);

        // Animation d'entrée
        requestAnimationFrame(() => {
            flash.style.opacity = '0.4';
        });

        setTimeout(() => {
            flash.style.opacity = '0';
            setTimeout(() => flash.remove(), 400);
        }, duration);
    }

    /**
     * Affiche l'écran de fin (succès ou échec)
     */
    _showEndState(node) {
        const overlay = this._overlayEl;
        if (!overlay) return;

        // Nettoyer les éléments urgence actifs (timer, actions, etc.)
        this._removeEl('_timerEl');
        this._removeEl('_actionsEl');
        this._removeEl('_bannerEl');

        const isSuccess = node.success;
        const color = isSuccess ? '#2ecc71' : '#ff4757';
        const icon = isSuccess ? 'fa-heart-pulse' : 'fa-skull-crossbones';
        const title = isSuccess ? 'PATIENT SAUVÉ !' : 'ÉCHEC CRITIQUE';

        // Créer l'écran de résultat
        const resultEl = document.createElement('div');
        resultEl.className = 'urgence-result-screen';
        resultEl.style.setProperty('--result-color', color);
        resultEl.innerHTML = `
            <div class="urgence-result-icon" style="color: ${color};">
                <i class="fas ${icon}"></i>
            </div>
            <h2 class="urgence-result-title" style="color: ${color};">${title}</h2>
            <div class="urgence-result-desc">
                <p>${node.descriptionClinique || ''}</p>
            </div>
            ${node.xpReward > 0 ? `
                <div class="urgence-result-xp">
                    <i class="fas fa-star" style="color: #ffb347;"></i>
                    <span>+${node.xpReward} XP GAGNÉS</span>
                </div>
            ` : ''}
        `;
        overlay.appendChild(resultEl);

        // Flash vert ou rouge
        this._flashScreen(color, 1200);

        // Atténuer la vignette
        const vignette = document.getElementById('urgence-vignette');
        if (vignette) {
            vignette.style.transition = 'opacity 2s ease';
            vignette.style.opacity = '0.3';
        }
    }

    // ==================== UTILITAIRES ====================

    _removeEl(propName) {
        const el = this[propName];
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
        }
        this[propName] = null;
    }
}

// ==================== INTÉGRATION AUTOMATIQUE ====================

/**
 * Surveille l'activation du mode urgence et connecte l'agent 3D.
 * Appelé automatiquement quand le ThreeManager est initialisé.
 */
export function initUrgenceAgent3D(threeManager) {
    const agent = new ThreeUrgenceAgent(threeManager);
    window.threeUrgenceAgent = agent;

    // Écouter l'événement d'activation du mode urgence (dispatché par gameState.js)
    document.addEventListener('urgence-mode-activated', (e) => {
        if (!threeManager.enabled) return; // N'activer qu'en mode 3D
        const { node, caseData } = e.detail || {};
        if (node) {
            agent.activate(node, caseData);
        }
    });

    // Écouter les transitions d'état d'urgence
    document.addEventListener('urgence-state-transition', (e) => {
        if (!agent.active) return;
        const { newNode } = e.detail || {};
        if (newNode) {
            agent.transitionTo(newNode);
        }
    });

    // Écouter les re-rendus d'état urgence (pour synchroniser les boutons d'action)
    document.addEventListener('urgence-state-render', (e) => {
        if (!agent.active) return;
        const { node } = e.detail || {};
        if (node) {
            agent._updateActions(node);
            agent._updateVitalTargets(node);
            agent._updateBanner(node);
        }
    });

    // Écouter aussi l'événement d'activation initial (si le mode 3D démarre après le cas urgence)
    document.addEventListener('three-manager-update', (e) => {
        if (e.detail?.enabled && typeof urgenceState !== 'undefined' && urgenceState.isUrgenceMode) {
            // Mode 3D vient d'être activé et on est déjà en urgence — activer l'agent
            agent.activate(urgenceState.currentUrgenceNode, urgenceState.currentCase);
        }
    });

    // Écouter la fin du mode urgence
    document.addEventListener('urgence-mode-deactivated', () => {
        agent.deactivate();
    });

    return agent;
}