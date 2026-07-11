import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildFurniture, buildRoom, createMaterial } from './three-room.js';
import { ThreePatient } from './three-patient.js';
import { ThreeInstruments } from './three-instruments.js';
import { PatientAnimator, DoctorAnimator, DustAnimator, IVFluidAnimator, ECGScreenAnimator } from './three-animations.js';
import { ThreeAssetAgent } from './three-asset-agent.js';
import { ThreeLightingAgent } from './three-lighting-agent.js';
import { ThreeEnvironmentAgent } from './three-environment-agent.js';
import { medicalAudio } from './three-audio.js';
import { ThreeFPSController } from './three-fps-controller.js';

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
    'Moniteur ECG mural': 'Moniteur mural — Tracé ECG et constantes vitales en temps réel',
    'Perfusion': 'Perfusion intraveineuse — Soluté en cours d\'administration',
    'Charriot médical': 'Charriot de soins — Matériel et instruments médicaux',
    'Affiche médicale': 'Affiche — Protocole ECMO affiché au mur',
    'Rideau': 'Rideau de séparation',
    'Patient': 'Patient — Examinez le patient',
    'Patient - Torse': 'Torse du patient — Palpation et inspection',
    'Patient - Tête': 'Tête du patient — Examen neurologique',
    'Evier': 'Évier — Lavage des mains',
    'Meuble Evier': 'Évier — Lavez vos mains avant d\'examiner le patient',
    'Masque à Oxygène': 'Masque O₂ — Appliquez si SpO₂ < 92%',
    'Patient - Abdomen': 'Abdomen du patient — Palpation et percussion',
    'Armoire': 'Armoire à pharmacie — Cliquez pour ouvrir les traitements prescriptibles',
    'Porte entree': 'Porte d\'entrée',
    'Fenetre': 'Fenêtre',
};

const FPS_INTERACTION_DISTANCE = 2.4;

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
        this.fpsController = null;

        // === Système hover glow ===
        this._hoveredObject = null;
        this._hoveredOriginalEmissives = new Map();
        this._hoverGlowIntensity = 0.12;
        this._hoverGlowColor = new THREE.Color(0x1a3a6c);
        this._tooltipEl = null;
        this._tooltipVisible = false;

        // === Système hover lift (soulèvement au survol) ===
        this._hoverLiftTarget = null;      // Groupe actuellement soulevé
        this._hoverLiftPrevTarget = null;   // Précédent groupe soulevé (pour anim de descente)
        this._hoverLiftBaseY = 0;          // Position Y d'origine du groupe
        this._hoverLiftPrevBaseY = 0;      // Position Y d'origine du groupe précédent
        this._hoverLiftAmount = 0.012;     // Hauteur de soulèvement (en unités 3D)
        this._hoverLiftCurrent = 0;         // Valeur interpolée actuelle

        // === Caméra fly-to ===
        this._cameraAnimId = null;
    }

    init() {
        // Initialisation terminée
        this.scene.background = new THREE.Color(0x2d3135);
        this.scene.fog = new THREE.Fog(0x2d3135, 8, 18);

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
        this.renderer.shadowMap.enabled = false;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = false;
        this.controls.enableRotate = false;
        this.controls.enablePan = false;
        this.controls.enableZoom = false;
        this.controls.touches = {};
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

        const wallEcgScreen = this.environmentAgent.getWallECGScreenMesh();
        if (wallEcgScreen) {
            this.wallEcgAnimator = new ECGScreenAnimator(wallEcgScreen, { width: 256, height: 96, heartRate: 72 });
        }

        const dustParticles = this.environmentAgent.getDustParticles();
        if (dustParticles) {
            this.dustAnimator = new DustAnimator(dustParticles);
        }

        this.collectInteractive();

        // Re-collecter les interactifs quand un GLB async charge (stéthoscope)
        document.addEventListener('instruments-updated', () => this.collectInteractive());
        document.addEventListener('patient-model-changed', () => {
            if (this.patientAnimator) {
                this.patientAnimator.reset();
            }
            this.collectInteractive();
        });

        // Initialisation des Hotspots Cliniques Holographiques
        this._initHotspots();

        // Custom click detection to avoid OrbitControls interference
        this._ptrDown = null;
        this._cleanedUp = false;
        this.renderer.domElement.addEventListener('pointerdown', (e) => {
            this._ptrDown = { x: e.clientX, y: e.clientY, time: performance.now() };
        });
        this.renderer.domElement.addEventListener('pointerup', (e) => {
            if (this._cleanedUp) return;
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

        // === Initialiser le contrôleur FPS ===
        this.fpsController = new ThreeFPSController(this.camera, this.renderer.domElement, {
            onInteract: () => this.interactFromFPS(),
            onDeactivate: () => {
                this.controls.enabled = true;
                document.body.classList.remove('mode-fps'); // Nettoyage de l'UI
                
                // Réafficher le modèle 3D du médecin en sortant du mode FPS
                if (this.characterController && this.characterController.group) {
                    this.characterController.group.visible = true;
                }

                const crosshairEl = document.getElementById('hud-crosshair');
                if (crosshairEl) {
                    crosshairEl.classList.remove('is-targeting');
                }
                const activeBtn = document.querySelector(`#hud-3d [data-camera="${this.currentCameraMode || 'room'}"]`);
                if (activeBtn) {
                    document.querySelectorAll('#hud-3d [data-camera]').forEach(b => b.classList.remove('active'));
                    activeBtn.classList.add('active');
                }
                
                if (this._skipDeactivateCameraReset) {
                    this._skipDeactivateCameraReset = false;
                    // Mettre à jour OrbitControls target pour regarder vers l'avant à partir de la position actuelle
                    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
                    this.controls.target.copy(this.camera.position).add(dir.multiplyScalar(2.0));
                    this.controls.update();
                } else {
                    this.setCamera('room', true);
                }
            }
        });

        // Raccourci touche F pour le mode FPS
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyF' && !e.repeat) {
                if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
                if (this.fpsController && this.fpsController.enabled) {
                    this.fpsController.deactivate();
                } else {
                    this.setCamera('fps');
                }
            }
        });

        // === Créer le tooltip HTML ===
        this._createTooltip();

        this.animate();
    }

    /**
     * Crée et positionne les anneaux holographiques 3D sur le patient (Tête, Torse, Abdomen, Membres)
     */
    _initHotspots() {
        this.hotspotsGroup = new THREE.Group();
        this.hotspotsGroup.name = "ClinicalHotspots";
        this.scene.add(this.hotspotsGroup);

        const hotspotsData = [
            { id: 'tête', pos: [1.2, 1.18, -3.62], color: 0xa020f0, label: 'Patient - Tête' }
        ];

        hotspotsData.forEach(data => {
            // Ring geometry pour un effet holographique haut de gamme
            const geom = new THREE.RingGeometry(0.065, 0.08, 32);
            const mat = new THREE.MeshBasicMaterial({
                color: data.color,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(geom, mat);
            // Coucher l'anneau à plat sur le lit
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(...data.pos);
            mesh.userData = {
                interactive: true,
                isHotspot: true,
                hotspotId: data.id,
                label: data.label
            };
            this.hotspotsGroup.add(mesh);
            this.interactiveObjects.push(mesh);
        });

        // Visibles uniquement en vue "patient" (épuré !)
        this.hotspotsGroup.visible = false;
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
        this.updateHotspotsPosition();
        // Recréer l'animateur car le groupe patient est reconstruit
        this.patientAnimator = new PatientAnimator(this.patient.group, {
            breathRate: caseData?.patient?.breathRate || 1.2,
            expression: caseData?.patient?.expression || 'normal'
        });
        this.collectInteractive();

        // Démarrer le bip ECG synchronisé à la FC du cas
        medicalAudio.init();
        medicalAudio.resume();
        const hr = this._parseHeartRate(caseData);
        if (hr > 0) {
            medicalAudio.startECGBeep(hr);
        }

        // Démarrer l'alarme si cas critique
        const isUrgent = this._isUrgentCase(caseData);
        if (isUrgent) {
            medicalAudio.startAlarm('critical');
        }
    }

    /** Parse la FC depuis les données du cas */
    _parseHeartRate(caseData) {
        const vitals = caseData?.examenClinique?.constantes;
        if (!vitals) return 72;
        const str = vitals.pouls || vitals.heartRate || '72';
        const m = String(str).match(/[\d]+/);
        return m ? parseInt(m[0]) : 72;
    }

    /** Détermine si le cas est critique */
    _isUrgentCase(caseData) {
        const vitals = caseData?.examenClinique?.constantes;
        if (!vitals) return false;
        const hr = this._parseHeartRate(caseData);
        const spo2 = parseInt(String(vitals.saturationO2 || '100').match(/[\d]+/)?.[0] || '100');
        return hr > 120 || spo2 < 90 || (caseData.difficulty || 1) >= 3;
    }

    updateHotspotsPosition() {
        if (this.hotspotsGroup) {
            const isLying = (this.patient && this.patient._currentPosition === 'allonge');
            this.hotspotsGroup.children.forEach(mesh => {
                const id = mesh.userData.hotspotId;
                if (id === 'tête') {
                    mesh.position.set(isLying ? 4.7 : 1.2, isLying ? 1.26 : 1.18, isLying ? 0.82 : -3.62);
                } else if (id === 'torse') {
                    mesh.position.set(isLying ? 4.7 : 1.2, isLying ? 1.22 : 1.14, isLying ? 0.38 : -3.35);
                } else if (id === 'abdomen') {
                    mesh.position.set(isLying ? 4.7 : 1.2, isLying ? 1.18 : 1.10, isLying ? -0.02 : -3.10);
                } else if (id === 'membre') {
                    mesh.position.set(isLying ? 4.7 : 1.2, isLying ? 0.98 : 1.05, isLying ? -0.48 : -2.70);
                }
            });
        }
    }

    setCamera(mode, animate = true) {
        if (mode === 'fps') {
            if (this.fpsController) {
                if (this.fpsController.enabled) return;

                this.currentCameraMode = 'fps';
                if (this.hotspotsGroup) {
                    this.hotspotsGroup.visible = false;
                }
                
                // Masquer le modèle 3D du médecin en mode FPS pour l'immersion
                if (this.characterController && this.characterController.group) {
                    this.characterController.group.visible = false;
                }
                
                this.controls.enabled = false;
                document.body.classList.add('mode-fps'); // Masquer le HUD superflus pour une immersion 100% propre
                
                // Mettre à jour l'état actif des boutons
                document.querySelectorAll('#hud-3d [data-camera]').forEach(b => b.classList.remove('active'));
                const fpsBtn = document.querySelector('#hud-3d [data-camera="fps"]');
                if (fpsBtn) fpsBtn.classList.add('active');

                const isLying = (this.patient && this.patient._currentPosition === 'allonge');
                const startPos = isLying 
                    ? new THREE.Vector3(3.6, 1.6, 0.2) 
                    : new THREE.Vector3(1.0, 1.6, -2.3);
                const startLook = isLying 
                    ? new THREE.Vector3(4.7, 1.1, 0.2) 
                    : new THREE.Vector3(1.2, 1.15, -3.45);
                    
                this.fpsController.activate(startPos, startLook);
                
                if (window.showNotification) {
                    window.showNotification('Mode FPS activé. ZQSD pour marcher, souris pour regarder, clic gauche pour interagir, Échap pour quitter.', 'info');
                }
            }
            return;
        } else {
            if (this.fpsController && this.fpsController.enabled) {
                this.fpsController.deactivate();
            }
            this.controls.enabled = true;
            document.body.classList.remove('mode-fps'); // Restaurer le HUD normal
            
            // Réafficher le modèle 3D du médecin
            if (this.characterController && this.characterController.group) {
                this.characterController.group.visible = true;
            }
        }

        this.currentCameraMode = mode;
        if (this.hotspotsGroup) {
            this.hotspotsGroup.visible = (mode === 'patient');
        }

        const isLying = (this.patient && this.patient._currentPosition === 'allonge');
        const presets = {
            room: { pos: [-3.7, 4.8, 7.5], target: [0.3, 1.3, -0.4] },
            patient: isLying 
                ? { pos: [4, 3.6, 3], target: [5.2, 1.8, 0.4] }
                : { pos: [1.8, 2.1, -1.1], target: [1.2, 1.15, -3.45] },
            desk: { pos: [-4.8, 2.2, 1.2], target: [-3.3, 1.4, -0.3] },
            cabinet: { pos: [1.5, 3.2, -1.8], target: [3.5, 3.2, -4] },
            anatomy: { pos: [-3, 3.8, -1.2], target: [-5.1, 3.8, -1.6] }
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
            const duration = 650;
            const startTime = performance.now();

            const step = (now) => {
                const t = Math.min(1, (now - startTime) / duration);
                // Cubic Bezier Ease In-Out
                const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
                
                this.camera.position.lerpVectors(startPos, targetPos, ease);
                
                // Effet cinématique de grue : courbe parabolique verticale
                const heightArc = Math.sin(ease * Math.PI) * 0.28;
                this.camera.position.y += heightArc;

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
        if (this._cleanedUp) return;
        // Masquer le tooltip dès qu'on clique sur un objet pour interagir
        if (this._tooltipEl) this._tooltipEl.style.opacity = '0';

        const isFPS = !!(this.fpsController && this.fpsController.enabled);

        const hit = this.pick(event);
        if (!hit) {
            return;
        }

        // Obtenir le point 3D de l'intersection pour le fly-to
        const hitPoint = hit.point ? hit.point.clone() : null;
        const hitObj = hit.object;

        if (isFPS) {
            this._skipDeactivateCameraReset = true;
            
            // Adapter le mode caméra cible pour l'UI
            const label = (this._findObjectLabel(hitObj) || '').toLowerCase();
            if (hitObj.userData?.isHotspot || label.includes('patient')) {
                this.currentCameraMode = 'patient';
            } else if (hitObj.userData?.pcAction || label.includes('ordinateur') || label.includes('poste informatique') || label.includes('desk')) {
                this.currentCameraMode = 'desk';
            } else {
                this.currentCameraMode = 'room';
            }
            
            this.fpsController.deactivate();
        }

        // --- Clic sur un Hotspot Clinique 3D d'examen ---
        if (hitObj.userData?.isHotspot) {
            const id = hitObj.userData.hotspotId;
            medicalAudio.playMeasureSound();
            if (this.manager && this.manager.clinicalAgent) {
                this.manager.clinicalAgent.openExaminationMenu(id);
                if (id === 'tête') {
                    this.manager.openPatientDialog();
                }
            } else {
                // Fallback via callback existant
                this.callbacks.onPatient?.(hitObj);
            }
            return;
        }

        const instrument = this.instruments.getByObject(hitObj);
        if (instrument) {
            // Animation de rebond sur l'instrument cliqué
            this.instruments.triggerBounce(instrument.id);
            // Son de mesure
            medicalAudio.playMeasureSound();

            // Fly-to vers l'instrument cliqué
            if (hitPoint && !isFPS) {
                this.flyCameraTo(hitPoint, hitPoint, 700);
            }
            this.callbacks.onInstrument?.(instrument, hitObj);
            return;
        }

        if ((hitObj.userData?.label || '').toLowerCase().includes('patient')) {
            // Fly-to vers le patient
            if (hitPoint && !isFPS) {
                this.flyCameraTo(hitPoint, hitPoint, 700);
            }
            this.callbacks.onPatient?.(hitObj);
            return;
        }

        if (hitObj.userData?.pcAction) {
            if (hitPoint && !isFPS) {
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
                if (hitPoint && !isFPS) this.flyCameraTo(hitPoint, hitPoint, 600);
                if (window.showNotification) window.showNotification('Affiche médicale : Protocole ECMO');
                break;
            }
            if (name === 'ECGMonitor' || name === 'WallECGMonitor' || label === 'Moniteur ECG' || label === 'Moniteur ECG mural') {
                if (hitPoint && !isFPS) this.flyCameraTo(hitPoint, hitPoint, 700);
                if (window.showNotification) window.showNotification('Moniteur ECG — Surveillez les constantes vitales');
                break;
            }
            if (name === 'Meuble Evier' || name === 'Evier basin' || label === 'Évier — Lavage des mains') {
                if (hitPoint && !isFPS) this.flyCameraTo(hitPoint, hitPoint, 700);
                this.callbacks.onEvier?.(hitObj);
                break;
            }
            if (name === 'IVStand' || label === 'Perfusion') {
                if (hitPoint && !isFPS) this.flyCameraTo(hitPoint, hitPoint, 700);
                if (window.showNotification) window.showNotification('Perfusion — Soluté en cours d\'administration');
                break;
            }
            if (name === 'MasqueO2' || label === 'Masque à Oxygène') {
                if (hitPoint && !isFPS) this.flyCameraTo(hitPoint, hitPoint, 700);
                this.callbacks.onMasqueO2?.(hitObj);
                break;
            }
            if (name === 'CharriotMedical' || label === 'Charriot médical') {
                if (hitPoint && !isFPS) this.flyCameraTo(hitPoint, hitPoint, 700);
                if (window.showNotification) window.showNotification('Charriot médical — Matériel de soin');
                break;
            }
            if (name === 'Armoire' || label === 'Armoire') {
                if (hitPoint && !isFPS) this.flyCameraTo(hitPoint, hitPoint, 700);
                this.callbacks.onArmoire?.(hitObj);
                break;
            }
            if (name === 'Porte entree' || label.toLowerCase().includes('porte')) {
                window.location.href = 'index.html';
                break;
            }
            // Tout objet interactif avec un label — fly-to générique
            if (current.userData?.interactive && hitPoint) {
                if (!isFPS) {
                    this.flyCameraTo(hitPoint, hitPoint, 700);
                }
                break;
            }
            current = current.parent;
        }

        this.callbacks.onObject?.(hitObj);
    }

    interactFromFPS() {
        if (!this.fpsController || !this.fpsController.enabled) return;
        this.onClick(null);
    }

    onMouseMove(event) {
        if (this._cleanedUp) return;
        if (this.fpsController && this.fpsController.enabled) return;

        const hit = this.pick(event);
        const hoveredObj = hit?.object || null;

        // Détection si un overlay/modal 2D ou 3D est visible à l'écran
        const isOverlayVisible = this._isOverlayVisible();

        // Gestion du hover glow (désactivé si overlay visible pour éviter des glitchs visuels)
        this._updateHoverGlow(isOverlayVisible ? null : hoveredObj);

        // Mise à jour du tooltip
        this._updateTooltip(hoveredObj, event);

        // Changement du curseur
        this.renderer.domElement.style.cursor = (hoveredObj && !isOverlayVisible) ? 'pointer' : 'default';

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

        // === Gestion du hover lift (soulèvement) ===
        // Si on change de cible, on conserve la précédente pour la descente douce
        if (this._hoverLiftTarget && this._hoverLiftTarget !== newHoverRoot) {
            this._hoverLiftPrevTarget = this._hoverLiftTarget;
            this._hoverLiftPrevBaseY = this._hoverLiftBaseY;
        }
        // Démarrer le lift sur le nouvel objet
        if (newHoverRoot) {
            this._hoverLiftTarget = newHoverRoot;
            this._hoverLiftBaseY = newHoverRoot.position.y;
        } else {
            this._hoverLiftTarget = null;
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

    // ===== HOVER LIFT (soulèvement au survol) =====

    /**
     * Interpolation douce du soulèvement vertical au survol
     * Montée rapide, descente douce. Gère aussi la redescente de l'ancien objet.
     */
    _updateHoverLift(dt) {
        // Descente douce de l'ancien objet (s'il y en a un)
        if (this._hoverLiftPrevTarget) {
            this._hoverLiftPrevBaseY += dt * 0; // baseY ne change pas
            const prevLift = this._hoverLiftPrevTarget.position.y - this._hoverLiftPrevBaseY;
            if (prevLift > 0.0005) {
                // Redescendre progressivement
                const newLift = prevLift * Math.max(0, 1 - dt * 8);
                this._hoverLiftPrevTarget.position.y = this._hoverLiftPrevBaseY + newLift;
            } else {
                // Fini, remettre à la position exacte
                this._hoverLiftPrevTarget.position.y = this._hoverLiftPrevBaseY;
                this._hoverLiftPrevTarget = null;
            }
        }

        // Cas où plus rien n'est survolé — ne rien faire de plus
        if (!this._hoverLiftTarget) {
            this._hoverLiftCurrent = Math.max(0, this._hoverLiftCurrent - dt * 0.5);
            return;
        }

        // Interpolation vers la hauteur cible
        const target = this._hoverLiftAmount;
        const speed = this._hoverLiftCurrent < target ? 12 : 6;
        this._hoverLiftCurrent += (target - this._hoverLiftCurrent) * Math.min(1, dt * speed);

        // Appliquer le déplacement vertical
        this._hoverLiftTarget.position.y = this._hoverLiftBaseY + this._hoverLiftCurrent;
    }

    // ===== TOOLTIP RICHE =====

    /**
     * Met à jour la position et le contenu du tooltip
     */
    _updateTooltip(hoveredObj, event) {
        if (!this._tooltipEl) return;

        // Détecter si un overlay/modal est ouvert à l'écran (Dossier médical, armoire, QCM, etc.)
        const isOverlayVisible = this._isOverlayVisible();

        const isFPS = !!(this.fpsController && this.fpsController.enabled);

        if (!hoveredObj || isOverlayVisible) {
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
            hintSpan.textContent = '🖱️ Cliquer pour utiliser';
        } else if (label.toLowerCase().includes('patient')) {
            hintSpan.textContent = '🖱️ Cliquer pour examiner';
        } else if (label === 'Armoire') {
            hintSpan.textContent = '🖱️ Cliquer pour ouvrir l\'armoire à pharmacie';
        } else if (label.toLowerCase().includes('ecg') || label.toLowerCase().includes('perfusion') || label.toLowerCase().includes('charriot')) {
            hintSpan.textContent = '👁️ Objet d\'ambiance — Cliquer pour info';
        } else {
            hintSpan.textContent = '';
        }

        // Positionner le tooltip près du curseur ou au centre en mode FPS
        let tx, ty;
        if (isFPS) {
            tx = window.innerWidth / 2 + 20;
            ty = window.innerHeight / 2 - 20;
        } else {
            if (!event) {
                this._tooltipEl.style.opacity = '0';
                this._tooltipVisible = false;
                return;
            }
            const rect = this.renderer.domElement.getBoundingClientRect();
            tx = event.clientX + 16;
            ty = event.clientY - 10;
        }

        // Empêcher le tooltip de sortir de la fenêtre
        const ttWidth = 260;
        const ttHeight = 80;
        if (tx + ttWidth > window.innerWidth) tx = window.innerWidth - ttWidth - 10;
        if (ty + ttHeight > window.innerHeight) ty = window.innerHeight - ttHeight - 10;
        if (ty < 0) ty = 10;

        this._tooltipEl.style.left = tx + 'px';
        this._tooltipEl.style.top = ty + 'px';
        this._tooltipEl.style.opacity = '1';
        this._tooltipVisible = true;
    }

    /**
     * Vérifie si un overlay ou une modale (2D/3D/jeu/QCM) est actuellement visible
     * @returns {boolean}
     */
    _isOverlayVisible() {
        const pcOverlay = document.getElementById('pc-overlay');
        const armoireOverlay = document.getElementById('armoire-overlay');
        const examMenu = document.getElementById('clinical-exam-menu');
        const prescriptionModal = document.getElementById('prescription-modal');
        const correctionOverlay = document.getElementById('correction-overlay');
        const lockChallengeModal = document.getElementById('lock-challenge-modal');
        const imageOverlay = document.getElementById('image-overlay');
        const mobileMonitorOverlay = document.getElementById('mobile-monitor-overlay');

        return !!(
            (pcOverlay && pcOverlay.style.display !== 'none') ||
            armoireOverlay ||
            examMenu ||
            (prescriptionModal && prescriptionModal.style.display !== 'none' && prescriptionModal.getAttribute('aria-hidden') !== 'true') ||
            (correctionOverlay && correctionOverlay.style.display !== 'none' && correctionOverlay.getAttribute('aria-hidden') !== 'true') ||
            lockChallengeModal ||
            (imageOverlay && imageOverlay.style.display !== 'none') ||
            (mobileMonitorOverlay && mobileMonitorOverlay.style.display !== 'none')
        );
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
        if (this.fpsController && this.fpsController.enabled) {
            this.mouse.set(0, 0);
        } else {
            if (!event) return null;
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        }
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hit = this.raycaster.intersectObjects(this.interactiveObjects, true)[0] || null;
        if (this.fpsController && this.fpsController.enabled && hit && hit.distance > FPS_INTERACTION_DISTANCE) {
            return null;
        }
        return hit;
    }

    resize() {
        const w = this.container.clientWidth || window.innerWidth;
        const h = this.container.clientHeight || window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    cleanup() {
        this._cleanedUp = true;
        cancelAnimationFrame(this._animFrameId);
        if (this._cameraAnimId) {
            cancelAnimationFrame(this._cameraAnimId);
            this._cameraAnimId = null;
        }
        // Arrêter tous les sons
        medicalAudio.destroy();
        this._clearHoverGlow();
        this._hoverLiftTarget = null;
        this._hoverLiftPrevTarget = null;
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
        // Fréquence cardiaque → ECG + son
        if (vitals.heartRate !== undefined) {
            this.setHeartRate(vitals.heartRate);
            // Mettre à jour le bip ECG audio
            medicalAudio.updateHeartRate(vitals.heartRate);
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
        if (this.wallEcgAnimator) {
            this.wallEcgAnimator.heartRate = bpm;
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
        if (this.patient && this.patient.update) {
            this.patient.update(elapsed, dt);
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
        if (this.wallEcgAnimator) {
            this.wallEcgAnimator.update(elapsed);
        }

        // Animation environnementale (LED ECG, etc.)
        if (this.environmentAgent?.updateEnvironment) {
            this.environmentAgent.updateEnvironment(elapsed);
        }

        // Animation du médecin (si CharacterController ou DoctorAnimator actif)
        if (this.characterController && this.characterController.animator) {
            this.characterController.animator.update(elapsed, dt);
        } else if (this.doctorAnimator) {
            this.doctorAnimator.update(elapsed, dt);
        }

        // Mettre à jour le contrôleur FPS s'il est actif et gérer le raycasting/gaze interactif
        if (this.fpsController && this.fpsController.enabled) {
            this.fpsController.update(dt);

            // Raycast gaze interactif au centre de l'écran (0,0)
            const hit = this.pick(null);
            const hoveredObj = hit?.object || null;

            // Détection si un overlay/modal 2D ou 3D est visible à l'écran
            const isOverlayVisible = this._isOverlayVisible();

            // Mettre à jour l'effet de hover glow
            this._updateHoverGlow(isOverlayVisible ? null : hoveredObj);

            // Mettre à jour le tooltip
            this._updateTooltip(hoveredObj, null);

            // Mettre à jour la classe du crosshair
            const crosshairEl = document.getElementById('hud-crosshair');
            if (crosshairEl) {
                if (hoveredObj && !isOverlayVisible) {
                    crosshairEl.classList.add('is-targeting');
                } else {
                    crosshairEl.classList.remove('is-targeting');
                }
            }
        }

        // --- Animation des Hotspots 3D d'examen ---
        if (this.hotspotsGroup && this.hotspotsGroup.visible) {
            this.hotspotsGroup.children.forEach(mesh => {
                const pulse = Math.sin(elapsed * 4.5);
                const scale = 1.0 + pulse * 0.15;
                mesh.scale.set(scale, scale, 1.0);
                mesh.material.opacity = 0.55 + pulse * 0.25;
            });
        }

        // === Animation hover lift (interpolation douce) ===
        this._updateHoverLift(dt);

        // --- Respiration de caméra stable et organique (Camera Bobbing - désactivée en mode FPS) ---
        if (this.camera && this.controls && !this._cameraAnimId && !this._ptrDown && (!this.fpsController || !this.fpsController.enabled)) {
            const bobX = Math.sin(elapsed * 0.8) * 0.0025;
            const bobY = Math.cos(elapsed * 0.6) * 0.0018;
            this.camera.position.x += bobX;
            this.camera.position.y += bobY;
        }

        if (this.lightingAgent && this.lightingAgent.render()) {
            // Composer handled rendering (bloom, etc.)
        } else {
            this.renderer.render(this.scene, this.camera);
        }

        // update controls uniquement si on n'est pas en mode FPS
        if (!this.fpsController || !this.fpsController.enabled) {
            this.controls.update();
        }
    }
}
