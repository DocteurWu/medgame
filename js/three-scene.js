import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildFurniture, buildRoom, createMaterial } from './three-room.js';
import { ThreePatient } from './three-patient.js';
import { ThreeInstruments } from './three-instruments.js';
import { PatientAnimator, DoctorAnimator, DustAnimator, IVFluidAnimator, ECGScreenAnimator } from './three-animations.js';
import { ThreeAssetAgent } from './three-asset-agent.js';
import { ThreeLightingAgent } from './three-lighting-agent.js';
import { ThreeEnvironmentAgent } from './three-environment-agent.js';

/**
 * Dictionnaire de descriptions riches pour les objets interactifs
 */
const TOOLTIP_DESCRIPTIONS = {
    'Tensiometre': 'Mesure de la tension artérielle — Placez le brassard sur le bras du patient',
    'Oxymetre': 'Saturation en oxygène SpO2 — Clipsez sur le doigt du patient',
    'Thermometre': 'Mesure de la température corporelle — Thermomètre électronique',
    'Glucometre': 'Glycémie capillaire — Insérez une bandelette et prélevez une goutte de sang',
    'Tablette prescription': 'Prescription et ordonnance — Consultez les résultats et prescribez',
    'Ordinateur': 'Poste informatique — Dossier médical et résultats',
    'Moniteur ECG': 'Moniteur de surveillance — Tracé ECG et constantes vitales en temps réel',
    'Perfusion': 'Perfusion intraveineuse — Soluté en cours d\'administration',
    'Charriot médical': 'Charriot de soins — Matériel et instruments médicaux',
    'Affiche médicale': 'Affiche — Protocole ECMO affiché au mur',
    'Rideau': 'Rideau de séparation',
    'Patient': 'Patient — Examinez le patient',
    'Patient - Torse': 'Torse du patient — Palpation et inspection',
    'Patient - Tête': 'Tête du patient — Examen neurologique',
    'Evier': 'Évier — Lavage des mains',
    'Armoire': 'Armoire — Matériel de soin',
    'Porte entree': 'Porte d\'entrée',
    'Fenetre': 'Fenêtre',
};

export class ThreeScene {
    constructor(container, callbacks = {}) {
        this.container = container;
        this.callbacks = callbacks;
        this.scene = new THREE.Scene();
        this.interactiveObjects = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.assetAgent = new ThreeAssetAgent(this);
        this.lightingAgent = null;
        this.environmentAgent = null;
        this.patientAnimator = null;
        this.doctorAnimator = null;
        this.dustAnimator = null;
        this.ivAnimator = null;
        this.ecgAnimator = null;

        // === Système hover glow ===
        this._hoveredObject = null;
        this._hoveredOriginalEmissives = new Map();
        this._hoverGlowIntensity = 0.35;
        this._hoverGlowColor = new THREE.Color(0x66aaff);
        this._tooltipEl = null;
        this._tooltipVisible = false;

        // === Caméra fly-to ===
        this._cameraAnimId = null;
    }

    init() {
        // Initialisation terminée
        this.scene.background = new THREE.Color(0x8c9bab);
        this.scene.fog = new THREE.Fog(0x8c9bab, 8, 30);

        this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
        this.scene._camera = this.camera;
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            stencil: false
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.maxPolarAngle = Math.PI / 2 + 0.08;
        this.controls.minPolarAngle = 0.1;
        this.controls.minDistance = 1.5;
        this.controls.maxDistance = 12;
        this.controls.enableRotate = true;
        this.controls.enablePan = false;
        this.controls.enableZoom = false;
        this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
        this.controls.target.set(0, 1.0, 0);

        this.setCamera('room');

        buildRoom(this.scene);
        buildFurniture(this.scene);

        this.environmentAgent = new ThreeEnvironmentAgent(this.scene);
        this.environmentAgent.enhanceRoom();

        this.lightingAgent = new ThreeLightingAgent(this.scene, this.renderer);
        this.lightingAgent.setupLighting();
        this.lightingAgent.setupPostProcessing();

        this.patient = new ThreePatient(this.scene);
        this.instruments = new ThreeInstruments(this.scene);

        // Initialiser les animateurs
        this.patientAnimator = new PatientAnimator(this.patient.group);

        // Animateurs d'environnement (perfusion, ECG, poussière)
        const ivGroup = this.environmentAgent.getIVGroup();
        if (ivGroup) {
            this.ivAnimator = new IVFluidAnimator(ivGroup, { dropInterval: 0.8, dropSpeed: 0.3 });
        }

        const ecgScreen = this.environmentAgent.getECGScreenMesh();
        if (ecgScreen) {
            this.ecgAnimator = new ECGScreenAnimator(ecgScreen, { width: 256, height: 96, heartRate: 72 });
        }

        const dustParticles = this.environmentAgent.getDustParticles();
        if (dustParticles) {
            this.dustAnimator = new DustAnimator(dustParticles);
        }

        this.collectInteractive();

        // Custom click detection to avoid OrbitControls interference
        this._ptrDown = null;
        this.renderer.domElement.addEventListener('pointerdown', (e) => {
            this._ptrDown = { x: e.clientX, y: e.clientY, time: performance.now() };
        });
        this.renderer.domElement.addEventListener('pointerup', (e) => {
            if (!this._ptrDown) return;
            const dx = Math.abs(e.clientX - this._ptrDown.x);
            const dy = Math.abs(e.clientY - this._ptrDown.y);
            const dt = performance.now() - this._ptrDown.time;
            if (dx < 8 && dy < 8 && dt < 400) {
                this.onClick(e);
            }
            this._ptrDown = null;
        });
        this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('resize', () => this.resize());

        // === Créer le tooltip HTML ===
        this._createTooltip();

        this.animate();
    }

    /**
     * Crée l'élément HTML du tooltip riche
     */
    _createTooltip() {
        const tooltip = document.createElement('div');
        tooltip.id = 'medgame-3d-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            pointer-events: none;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.2s ease;
            background: rgba(10, 18, 40, 0.92);
            color: #e0e8f4;
            border: 1px solid rgba(100, 170, 255, 0.45);
            border-radius: 8px;
            padding: 8px 14px;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            font-size: 13px;
            line-height: 1.4;
            max-width: 260px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 12px rgba(100,170,255,0.15);
            backdrop-filter: blur(6px);
        `;
        const titleEl = document.createElement('div');
        titleEl.style.cssText = `
            font-weight: 700;
            font-size: 14px;
            color: #88ccff;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 6px;
        `;
        titleEl.innerHTML = '<span style="font-size:16px">🔬</span> <span id="medgame-tooltip-title"></span>';
        const descEl = document.createElement('div');
        descEl.id = 'medgame-tooltip-desc';
        descEl.style.cssText = `
            color: #b0c4de;
            font-size: 12px;
        `;
        const hintEl = document.createElement('div');
        hintEl.id = 'medgame-tooltip-hint';
        hintEl.style.cssText = `
            margin-top: 6px;
            color: #66aaff;
            font-size: 11px;
            font-style: italic;
        `;
        tooltip.appendChild(titleEl);
        tooltip.appendChild(descEl);
        tooltip.appendChild(hintEl);
        document.body.appendChild(tooltip);
        this._tooltipEl = tooltip;
    }

    /**
     * Supprime le tooltip HTML
     */
    _destroyTooltip() {
        if (this._tooltipEl && this._tooltipEl.parentNode) {
            this._tooltipEl.parentNode.removeChild(this._tooltipEl);
        }
        this._tooltipEl = null;
    }

    collectInteractive() {
        this.interactiveObjects = [];
        this.scene.traverse((obj) => {
            if (obj.userData?.interactive) this.interactiveObjects.push(obj);
        });
    }

    loadCase(caseData) {
        this.patient.loadCase(caseData);
        // Recréer l'animateur car le groupe patient est reconstruit
        this.patientAnimator = new PatientAnimator(this.patient.group, {
            breathRate: caseData?.patient?.breathRate || 1.2,
            expression: caseData?.patient?.expression || 'normal'
        });
        this.collectInteractive();
    }

    setCamera(mode, animate = true) {
        const presets = {
            room: { pos: [0, 4.8, 7.3], target: [0, 1.2, -0.8] },
            patient: { pos: [2.7, 2.1, 0.7], target: [2.1, 1.15, -1.65] },
            desk: { pos: [-0.9, 2.25, 1.05], target: [-0.65, 0.9, -0.85] }
        };
        const p = presets[mode] || presets.room;
        const targetPos = new THREE.Vector3(...p.pos);
        const targetLook = new THREE.Vector3(...p.target);

        if (animate && this._cameraAnimId) {
            cancelAnimationFrame(this._cameraAnimId);
        }

        if (!animate) {
            this.camera.position.copy(targetPos);
            this.controls.target.copy(targetLook);
            this.controls.update();
        } else {
            const startPos = this.camera.position.clone();
            const startTarget = this.controls.target.clone();
            const duration = 600;
            const startTime = performance.now();

            const step = (now) => {
                const t = Math.min(1, (now - startTime) / duration);
                const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                this.camera.position.lerpVectors(startPos, targetPos, ease);
                this.controls.target.lerpVectors(startTarget, targetLook, ease);
                this.controls.update();
                if (t < 1) {
                    this._cameraAnimId = requestAnimationFrame(step);
                } else {
                    this._cameraAnimId = null;
                }
            };
            this._cameraAnimId = requestAnimationFrame(step);
        }

        if (this.lightingAgent) {
            this.lightingAgent.setCameraExposure(mode);
        }
    }

    onClick(event) {
        const hit = this.pick(event);
        if (!hit) {
            // Clic sur le vide — masquer le tooltip
            if (this._tooltipEl) this._tooltipEl.style.opacity = '0';
            return;
        }

        // Obtenir le point 3D de l'intersection pour le fly-to
        const hitPoint = hit.point ? hit.point.clone() : null;
        const hitObj = hit.object;

        const instrument = this.instruments.getByObject(hitObj);
        if (instrument) {
            // Fly-to vers l'instrument cliqué
            if (hitPoint) {
                this.flyCameraTo(hitPoint, hitPoint, 700);
            }
            this.callbacks.onInstrument?.(instrument, hitObj);
            return;
        }

        if ((hitObj.userData?.label || '').toLowerCase().includes('patient')) {
            // Fly-to vers le patient
            if (hitPoint) {
                this.flyCameraTo(hitPoint, hitPoint, 700);
            }
            this.callbacks.onPatient?.(hitObj);
            return;
        }

        if (hitObj.userData?.pcAction) {
            if (hitPoint) {
                this.flyCameraTo(hitPoint, hitPoint, 600);
            }
            this.callbacks.onPC?.(hitObj);
            return;
        }

        // Environnement interactif — fly-to + notification
        let current = hitObj;
        while (current) {
            const name = current.name || '';
            const label = current.userData?.label || '';
            if (name === 'MedicalPoster' || label === 'Affiche médicale') {
                if (hitPoint) this.flyCameraTo(hitPoint, hitPoint, 600);
                if (window.showNotification) window.showNotification('Affiche médicale : Protocole ECMO');
                break;
            }
            if (name === 'ECGMonitor' || label === 'Moniteur ECG') {
                if (hitPoint) this.flyCameraTo(hitPoint, hitPoint, 700);
                if (window.showNotification) window.showNotification('Moniteur ECG — Surveillez les constantes vitales');
                break;
            }
            if (name === 'IVStand' || label === 'Perfusion') {
                if (hitPoint) this.flyCameraTo(hitPoint, hitPoint, 700);
                if (window.showNotification) window.showNotification('Perfusion — Soluté en cours d\'administration');
                break;
            }
            if (name === 'CharriotMedical' || label === 'Charriot médical') {
                if (hitPoint) this.flyCameraTo(hitPoint, hitPoint, 700);
                if (window.showNotification) window.showNotification('Charriot médical — Matériel de soin');
                break;
            }
            // Tout objet interactif avec un label — fly-to générique
            if (current.userData?.interactive && hitPoint) {
                this.flyCameraTo(hitPoint, hitPoint, 700);
                break;
            }
            current = current.parent;
        }

        this.callbacks.onObject?.(hitObj);
    }

    onMouseMove(event) {
        const hit = this.pick(event);
        const hoveredObj = hit?.object || null;

        // Gestion du hover glow
        this._updateHoverGlow(hoveredObj);

        // Mise à jour du tooltip
        this._updateTooltip(hoveredObj, event);

        // Changement du curseur
        this.renderer.domElement.style.cursor = hoveredObj ? 'pointer' : 'default';

        this.callbacks.onHover?.(hoveredObj, event);
    }

    // ===== SYSTÈME HOVER GLOW =====

    /**
     * Met à jour l'effet de surbrillance sur l'objet survolé
     * - Sauvegarde les emissive d'origine
     * - Applique un glow bleu progressif sur tous les meshes du groupe
     */
    _updateHoverGlow(hoveredObj) {
        // Déterminer le groupe racine interactif de l'objet survolé
        let newHoverRoot = null;
        if (hoveredObj) {
            newHoverRoot = this._findInteractiveRoot(hoveredObj);
        }

        // Si c'est le même objet, ne rien faire
        if (newHoverRoot === this._hoveredObject) return;

        // Restaurer les matériaux de l'ancien objet
        this._clearHoverGlow();

        // Appliquer le glow sur le nouvel objet
        if (newHoverRoot) {
            this._applyHoverGlow(newHoverRoot);
        }

        this._hoveredObject = newHoverRoot;
    }

    /**
     * Trouve le groupe racine interactif d'un objet (remonte la hiérarchie)
     */
    _findInteractiveRoot(obj) {
        let current = obj;
        while (current) {
            if (current.userData?.interactive && (current.isGroup || current.children?.length > 0)) {
                return current;
            }
            // Vérifier si un parent a un instrument ou un label interactif
            if (current.userData?.instrument) return current;
            current = current.parent;
        }
        // Fallback: l'objet lui-même s'il est interactif
        if (obj.userData?.interactive) return obj;
        return null;
    }

    /**
     * Applique le glow bleu sur tous les meshes du groupe
     */
    _applyHoverGlow(root) {
        const targets = root.isMesh ? [root] : [];
        root.traverse((child) => {
            if (child.isMesh) targets.push(child);
        });

        for (const mesh of targets) {
            if (!mesh.material) continue;
            // Sauvegarder l'état d'origine
            const origEmissive = mesh.material.emissive ? mesh.material.emissive.clone() : new THREE.Color(0x000000);
            const origIntensity = mesh.material.emissiveIntensity || 0;
            this._hoveredOriginalEmissives.set(mesh.uuid, {
                emissive: origEmissive,
                intensity: origIntensity,
            });
            // Appliquer le glow
            mesh.material.emissive = this._hoverGlowColor.clone();
            mesh.material.emissiveIntensity = origIntensity + this._hoverGlowIntensity;
            mesh.material.needsUpdate = true;
        }
    }

    /**
     * Retire le glow et restaure les matériaux d'origine
     */
    _clearHoverGlow() {
        if (!this._hoveredObject) return;

        const root = this._hoveredObject;
        const targets = root.isMesh ? [root] : [];
        root.traverse((child) => {
            if (child.isMesh) targets.push(child);
        });

        for (const mesh of targets) {
            if (!mesh.material) continue;
            const saved = this._hoveredOriginalEmissives.get(mesh.uuid);
            if (saved) {
                mesh.material.emissive.copy(saved.emissive);
                mesh.material.emissiveIntensity = saved.intensity;
            } else {
                mesh.material.emissiveIntensity = Math.max(0, (mesh.material.emissiveIntensity || 0) - this._hoverGlowIntensity);
            }
            mesh.material.needsUpdate = true;
        }

        this._hoveredOriginalEmissives.clear();
    }

    // ===== TOOLTIP RICHE =====

    /**
     * Met à jour la position et le contenu du tooltip
     */
    _updateTooltip(hoveredObj, event) {
        if (!this._tooltipEl) return;

        if (!hoveredObj) {
            this._tooltipEl.style.opacity = '0';
            this._tooltipVisible = false;
            return;
        }

        // Trouver le label de l'objet
        const label = this._findObjectLabel(hoveredObj);
        if (!label) {
            this._tooltipEl.style.opacity = '0';
            this._tooltipVisible = false;
            return;
        }

        const description = TOOLTIP_DESCRIPTIONS[label] || '';

        // Mettre à jour le contenu
        const titleSpan = this._tooltipEl.querySelector('#medgame-tooltip-title');
        if (titleSpan) titleSpan.textContent = label;
        const descSpan = this._tooltipEl.querySelector('#medgame-tooltip-desc');
        if (descSpan) descSpan.textContent = description;
        const hintSpan = this._tooltipEl.querySelector('#medgame-tooltip-hint');

        // Indice contextuel selon le type d'objet
        if (hoveredObj.userData?.instrument) {
            hintSpan.textContent = '🖱️ Cliquez pour utiliser';
        } else if (label.toLowerCase().includes('patient')) {
            hintSpan.textContent = '🖱️ Cliquez pour examiner';
        } else if (label.toLowerCase().includes('ecg') || label.toLowerCase().includes('perfusion') || label.toLowerCase().includes('charriot')) {
            hintSpan.textContent = '👁️ Objet d\'ambiance — Cliquez pour info';
        } else {
            hintSpan.textContent = '';
        }

        // Positionner le tooltip près du curseur
        const rect = this.renderer.domElement.getBoundingClientRect();
        let tx = event.clientX + 16;
        let ty = event.clientY - 10;
        // Empêcher le tooltip de sortir de la fenêtre
        const ttWidth = 260;
        const ttHeight = 80;
        if (tx + ttWidth > window.innerWidth) tx = event.clientX - ttWidth - 10;
        if (ty + ttHeight > window.innerHeight) ty = window.innerHeight - ttHeight - 10;
        if (ty < 0) ty = 10;

        this._tooltipEl.style.left = tx + 'px';
        this._tooltipEl.style.top = ty + 'px';
        this._tooltipEl.style.opacity = '1';
        this._tooltipVisible = true;
    }

    /**
     * Trouve le label d'un objet en remontant la hiérarchie
     */
    _findObjectLabel(obj) {
        let current = obj;
        while (current) {
            if (current.userData?.label) return current.userData.label;
            if (current.userData?.instrument?.label) return current.userData.instrument.label;
            if (current.name) return current.name;
            current = current.parent;
        }
        return null;
    }

    // ===== CAMÉRA FLY-TO =====

    /**
     * Anime la caméra en volant doucement vers une position proche d'un objet 3D
     * @param {THREE.Vector3} targetPosition — position de l'objet visé
     * @param {THREE.Vector3} [lookAtTarget] — point de regard (défaut: l'objet lui-même)
     * @param {number} [duration] — durée en ms (défaut 800)
     */
    flyCameraTo(targetPosition, lookAtTarget, duration = 800) {
        if (!this.camera || !this.controls) return;
        if (!lookAtTarget) lookAtTarget = targetPosition.clone();

        // Calculer une position de caméra décalée (offset pour observer l'objet)
        const cameraOffset = new THREE.Vector3(1.2, 0.8, 1.5);
        const endPos = targetPosition.clone().add(cameraOffset);
        const endTarget = lookAtTarget.clone();

        // S'assurer que la caméra reste à une distance raisonnable
        const dist = endPos.distanceTo(endTarget);
        if (dist < 1.0) {
            endPos.add(endTarget.clone().sub(endPos).normalize().multiplyScalar(1.0 - dist));
        }

        const startPos = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        const startTime = performance.now();

        // Annuler toute animation en cours
        if (this._cameraAnimId) {
            cancelAnimationFrame(this._cameraAnimId);
            this._cameraAnimId = null;
        }

        const step = (now) => {
            const t = Math.min(1, (now - startTime) / duration);
            // Easing in-out cubique
            const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

            this.camera.position.lerpVectors(startPos, endPos, e);
            this.controls.target.lerpVectors(startTarget, endTarget, e);
            this.controls.update();

            if (t < 1) {
                this._cameraAnimId = requestAnimationFrame(step);
            } else {
                this._cameraAnimId = null;
            }
        };
        this._cameraAnimId = requestAnimationFrame(step);
    }

    pick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        return this.raycaster.intersectObjects(this.interactiveObjects, true)[0] || null;
    }

    resize() {
        const w = this.container.clientWidth || window.innerWidth;
        const h = this.container.clientHeight || window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    cleanup() {
        cancelAnimationFrame(this._animFrameId);
        if (this._cameraAnimId) {
            cancelAnimationFrame(this._cameraAnimId);
            this._cameraAnimId = null;
        }
        this._clearHoverGlow();
        this._destroyTooltip();
        this.renderer.dispose();
        this.renderer.forceContextLoss();
        this.controls.dispose();
        if (this.lightingAgent) this.lightingAgent.dispose();
    }

    /**
     * Change l'expression du patient avec une transition douce
     * @param {string} expression — 'normal' | 'douleur' | 'grimace' | 'sourire' | 'pale' | 'anxieux' | 'etonne' | 'cyanose' | 'fievre' | 'sueur'
     * @param {number} duration — durée de transition en secondes (défaut 0.8)
     */
    setPatientExpression(expression, duration = 0.8) {
        if (this.patientAnimator) {
            this.patientAnimator.setExpression(expression, duration);
        }
        // Appliquer aussi les changements de couleur peau via ThreePatient
        if (this.patient) {
            this.patient.applyExpression(expression);
        }
    }

    /**
     * Change le motif de respiration du patient
     * @param {string} pattern — 'normal' | 'tachypnea' | 'bradypnea' | 'dyspnea' | 'cheyneStokes' | 'agonal'
     */
    setRespirationPattern(pattern) {
        if (this.patientAnimator) {
            this.patientAnimator.setRespirationPattern(pattern);
        }
    }

    /**
     * Configure les constantes vitales du patient de façon cohérente
     * Ajuste automatiquement la respiration, l'expression, le rythme ECG et la perfusion
     * @param {Object} vitals — { respiratoryRate, heartRate, expression, spO2, dyspnea }
     */
    setPatientVitals(vitals = {}) {
        // Fréquence cardiaque → ECG
        if (vitals.heartRate !== undefined) {
            this.setHeartRate(vitals.heartRate);
            // LED oxymètre : pulsation plus rapide si tachycardie
            if (this.instruments?.animatedParts) {
                for (const part of this.instruments.animatedParts) {
                    if (part.type === 'pulsingLED') {
                        part.freq = vitals.heartRate / 60;
                    }
                }
            }
        }

        // Motif respiratoire basé sur FR et signes
        if (vitals.dyspnea) {
            this.setRespirationPattern('dyspnea');
        } else if (vitals.respiratoryRate !== undefined) {
            if (vitals.respiratoryRate > 25) {
                this.setRespirationPattern('tachypnea');
            } else if (vitals.respiratoryRate < 10) {
                this.setRespirationPattern(vitals.respiratoryRate < 6 ? 'agonal' : 'bradypnea');
            } else {
                this.setRespirationPattern('normal');
            }
        }

        // Expression faciale
        if (vitals.expression) {
            this.setPatientExpression(vitals.expression);
        }

        // SpO2 bas → accélérer la perfusion (effet visuel d'urgence)
        if (vitals.spO2 !== undefined && this.ivAnimator) {
            const interval = vitals.spO2 < 90 ? 0.4 : vitals.spO2 < 95 ? 0.6 : 0.8;
            this.ivAnimator.dropInterval = interval;
        }
    }

    /**
     * Change la fréquence cardiaque du moniteur ECG
     * @param {number} bpm — battements par minute
     */
    setHeartRate(bpm) {
        if (this.ecgAnimator) {
            this.ecgAnimator.heartRate = bpm;
        }
    }

    /**
     * Change le débit de la perfusion (intervalle entre les gouttes)
     * @param {number} interval — secondes entre gouttes (défaut 0.8)
     */
    setIVDropInterval(interval) {
        if (this.ivAnimator) {
            this.ivAnimator.dropInterval = interval;
        }
    }

    /**
     * Active l'animation de marche du médecin vers une position cible
     * @param {Object} target — { x, y, z }
     * @param {Function} onArrive — callback à l'arrivée
     */
    moveDoctorTo(target, onArrive) {
        // Utiliser le CharacterController si disponible (gère la marche intégralement)
        if (this.characterController) {
            this.characterController.moveTo(target, () => {
                if (onArrive) onArrive();
            });
            return;
        }
        // Fallback : DoctorAnimator autonome (sans CharacterController)
        if (!this.doctorAnimator) {
            const doctor = this.scene.getObjectByName('Doctor') || this.scene.children.find(
                c => c.userData?.armR
            );
            if (doctor) {
                this.doctorAnimator = new DoctorAnimator(doctor);
            }
        }
        if (this.doctorAnimator) {
            this.doctorAnimator.startWalking();
        }
    }

    animate() {
        this._animFrameId = requestAnimationFrame(() => this.animate());
        const now = performance.now();
        const elapsed = now / 1000;
        const dt = this._lastAnimTime ? (now - this._lastAnimTime) / 1000 : 0.016;
        this._lastAnimTime = now;

        // Animation du patient (respiration, clignements, expression)
        if (this.patientAnimator) {
            this.patientAnimator.update(elapsed, dt);
        }

        // Animation des instruments (LED pulsante, etc.)
        if (this.instruments?.update) {
            this.instruments.update(elapsed);
        }

        // Animation des particules de poussière
        if (this.dustAnimator) {
            this.dustAnimator.update(elapsed);
        }

        // Animation de la perfusion (gouttes)
        if (this.ivAnimator) {
            this.ivAnimator.update(elapsed, dt);
        }

        // Animation de l'écran ECG (ligne cardiaque)
        if (this.ecgAnimator) {
            this.ecgAnimator.update(elapsed);
        }

        // Animation environnementale (LED ECG, etc.)
        if (this.environmentAgent?.updateEnvironment) {
            this.environmentAgent.updateEnvironment(elapsed);
        }

        // Animation du médecin (si DoctorAnimator actif)
        if (this.doctorAnimator) {
            this.doctorAnimator.update(elapsed, dt);
        }

        if (this.lightingAgent && this.lightingAgent.render()) {
            // Composer handled rendering (bloom, etc.)
        } else {
            this.renderer.render(this.scene, this.camera);
        }

        this.controls.update();
    }
}