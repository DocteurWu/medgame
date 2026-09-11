import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { buildFurniture, buildRoom, createMaterial } from './three-room.js';
import { ThreePatient } from './three-patient.js';
import { ThreeInstruments } from './three-instruments.js';
import { PatientAnimator, DoctorAnimator, DustAnimator, IVFluidAnimator, ECGScreenAnimator } from './three-animations.js';
import { ThreeAssetAgent } from './three-asset-agent.js';
import { ThreeLightingAgent } from './three-lighting-agent.js';
import { ThreeEnvironmentAgent } from './three-environment-agent.js';
import { medicalAudio } from './three-audio.js';
import { ThreeFPSController } from './three-fps-controller.js';
import { ThreeQualityAgent } from './three-quality-agent.js';

import { Easing, OverlayWatcher, disposeObject3D, prefersReducedMotion } from './three-core-utils.js';
import { CameraDirector } from './three-camera-director.js';
import { HoverHighlighter } from './three-highlight.js';
import { HudTooltip } from './three-hud.js';
import { EcosSession } from './three-ecos-session.js';
import { TaskScheduler } from './task-scheduler.js';
import { SceneDisposer } from './scene-disposer.js';

/**
 * Descriptions riches des objets interactifs de la chambre clinique
 */
const TOOLTIP_DESCRIPTIONS = {
    'Tensiometre': 'Tension artérielle — brassard à placer au bras du patient',
    'Oxymetre': 'SpO₂ — capteur de saturométrie à clipser au doigt',
    'Thermometre': 'Température corporelle — thermomètre électronique',
    'Glucometre': 'Glycémie capillaire — bandelette + prélèvement d\'une goutte de sang',
    'Stethoscope': 'Stéthoscope — révèle les foyers d\'auscultation cardio-pulmonaire',
    'Tablette de décision': 'Tablette clinique — Poser le diagnostic et formuler l\'annonce au patient pour clôturer le cas',
    'Tablette prescription': 'Tablette clinique — Poser le diagnostic et formuler l\'annonce au patient pour clôturer le cas',
    'Tablette': 'Tablette clinique — Poser le diagnostic et formuler l\'annonce au patient',
    'Ordinateur': 'Poste informatique — dossier médical et résultats biologiques',
    'Moniteur ECG': 'Moniteur de surveillance multiparamétrique en temps réel',
    'Moniteur ECG mural': 'Moniteur mural — tracé ECG et constantes vitales',
    'Perfusion': 'Perfusion intraveineuse — soluté et débit en cours',
    'Charriot médical': 'Chariot d\'urgence et matériel de soins',
    'Affiche médicale': 'Protocole et algorithmes d\'urgence affichés au mur',
    'Patient': 'Examinez et interrogez le patient',
    'Patient - Torse': 'Torse du patient — inspection, auscultation, palpation',
    'Patient - Tête': 'Tête du patient — état neurologique et muqueuses',
    'Patient - Abdomen': 'Abdomen du patient — palpation abdominale',
    'Evier': 'Solution hydro-alcoolique — friction obligatoire avant examen',
    'Meuble Evier': 'Solution hydro-alcoolique — friction obligatoire avant examen',
    'Masque à Oxygène': 'Masque à haute concentration — indiqué si SpO₂ < 92 %',
    'Armoire': 'Armoire à pharmacie — médicaments et solutés prescriptibles',
    'Porte entree': 'Sortie de la chambre',
    'Fenetre': 'Fenêtre extérieure',
};

const OVERLAY_IDS = [
    'pc-overlay', 'armoire-overlay', 'clinical-exam-menu', 'prescription-modal',
    'correction-overlay', 'lock-challenge-modal', 'image-overlay', 'mobile-monitor-overlay',
    'ecos-announce-overlay', 'ecos-debrief-overlay',
];

const FPS_INTERACTION_DISTANCE = 2.5;
const HOVER_RAYCAST_HZ = 30;
const MAX_DT = 0.05;

export class ThreeScene {
    constructor(container, callbacks = {}) {
        this.container = container;
        this.callbacks = callbacks;
        this.scene = new THREE.Scene();

        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this._pointerClient = { x: 0, y: 0 };
        this._pointerInside = false;
        this._raycastAccum = 0;
        this._interactiveRoots = [];
        this.interactiveObjects = []; // Compatibilité externe

        this.reducedMotion = prefersReducedMotion();
        this._ac = new AbortController();
        this._cleanedUp = false;

        // Effets visuels & caméras
        this.currentCameraMode = 'room';
        this.stethoscopeMode = false;
        this.screenShakeIntensity = 0;
        this._urgencyFogColor = new THREE.Color(0x4a2233);
        this._normalFogColor = null;

        // Agents & sous-systèmes
        this.assetAgent = new ThreeAssetAgent(this);
        this.lightingAgent = null;
        this.environmentAgent = null;
        this.qualityAgent = null;
        this.fpsController = null;
        this.characterController = null;

        // Animateurs
        this.patientAnimator = null;
        this.doctorAnimator = null;
        this.dustAnimator = null;
        this.ivAnimator = null;
        this.ecgAnimator = null;
        this.wallEcgAnimator = null;

        // Hotspots simples pour le patient (Tête / Torse / Abdomen) et auscultation
        this.hotspotsGroup = null;
        this.auscultationHotspotsGroup = null;

        // Session ECOS et Overlays
        this.overlays = new OverlayWatcher(OVERLAY_IDS);
        this.session = new EcosSession({
            durationSec: callbacks.stationDuration ?? 480,
            onTick: (r, d) => this.callbacks.onTimer?.(r, d),
            onPhase: (p) => {
                if (p === 'warning') medicalAudio.playAlert?.('warning');
                this.callbacks.onStationPhase?.(p);
            },
        });
    }

    /* ================= INITIALISATION ================= */

    init() {
        const { signal } = this._ac;

        // Ambiance de la pièce et brouillard
        this.scene.background = new THREE.Color(0x2d3135);
        this.scene.fog = new THREE.Fog(0x2d3135, 9, 22);
        this._normalFogColor = this.scene.fog.color.clone();

        // Caméra principale
        this.camera = new THREE.PerspectiveCamera(52, this._aspect(), 0.08, 80);
        this.scene._camera = this.camera;

        // Moteur de rendu WebGL avec PBR et ACESFilmic Tone Mapping
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
            stencil: false,
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        this.renderer.setSize(...this._size());
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = false;
        this.renderer.shadowMap.needsUpdate = true;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);

        this.renderer.domElement.tabIndex = 0;
        this.renderer.domElement.setAttribute('aria-label', 'Salle d\'examen 3D interactive');

        // Garde contre la perte de contexte WebGL (l'environnement IBL est configure par ThreeLightingAgent)
        this._setupContextLossGuard(signal);

        // Orbit Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        Object.assign(this.controls, {
            enableDamping: true,
            dampingFactor: 0.075,
            rotateSpeed: 0.5,
            enablePan: false,
            zoomSpeed: 0.7,
            minDistance: 0.85,
            maxDistance: 12,
            minPolarAngle: 0.15,
            maxPolarAngle: Math.PI / 2.05,
        });
        this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
        this.controls.target.set(0, 1.0, 0);

        // Directeur de caméra cinématique
        this.director = new CameraDirector(this.camera, this.controls, {
            reducedMotion: this.reducedMotion,
            roomCenter: new THREE.Vector3(0, 1.1, -0.5),
        });

        // Construction géométrie pièce & mobilier
        buildRoom(this.scene);
        buildFurniture(this.scene);

        // Agents d'environnement et d'éclairage
        this.environmentAgent = new ThreeEnvironmentAgent(this.scene);
        this.environmentAgent.enhanceRoom();

        this.lightingAgent = new ThreeLightingAgent(this.scene, this.renderer);
        this.lightingAgent.setupLighting();

        this.qualityAgent = new ThreeQualityAgent(this);
        this.qualityAgent.init().catch(e => console.warn('[ThreeScene] qualité:', e));

        // Patient et instruments médicaux
        this.patient = new ThreePatient(this.scene);
        this.instruments = new ThreeInstruments(this.scene);
        this.patientAnimator = new PatientAnimator(this.patient.group);

        this._setupEnvAnimators();

        // Hotspots discrets et parfaitement adaptés aux personnages
        this._initHotspots();

        // Surlignage & Tooltip HUD
        this.highlighter = new HoverHighlighter(this.scene, { liftAmount: this.reducedMotion ? 0 : 0.014 });
        this.tooltip = new HudTooltip();

        this.setCamera('room', false);
        this.collectInteractive();
        this._bindEvents(signal);
        this._setupFPS();

        this._clock = new THREE.Clock();
        this._loop = this._loop.bind(this);
        this._animFrameId = requestAnimationFrame(this._loop);

    }

    _aspect() {
        const [w, h] = this._size();
        return w / h;
    }

    _size() {
        return [this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight];
    }

    /**
     * Environment map procédurale (déléguée à ThreeLightingAgent pour éviter une double passe PMREM)
     */
    _setupEnvironmentMap() {
        // Géré de manière centralisée par ThreeLightingAgent.setupLighting()
    }

    _setupContextLossGuard(signal) {
        this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            console.error('[ThreeScene] Contexte WebGL perdu -> repli 2D.');
            try { this.cleanup(); } catch {}
            window.threeManager?.disable3D?.();
            window.showNotification?.('Mode 3D désactivé (contexte graphique perdu).', 'warning');
        }, { signal });
    }

    _setupEnvAnimators() {
        const iv = this.environmentAgent.getIVGroup?.();
        if (iv) this.ivAnimator = new IVFluidAnimator(iv, { dropInterval: 0.8, dropSpeed: 0.3 });

        const ecg = this.environmentAgent.getECGScreenMesh?.();
        if (ecg) this.ecgAnimator = new ECGScreenAnimator(ecg, { width: 256, height: 96, heartRate: 72 });

        const wallEcg = this.environmentAgent.getWallECGScreenMesh?.();
        if (wallEcg) this.wallEcgAnimator = new ECGScreenAnimator(wallEcg, { width: 256, height: 96, heartRate: 72 });

        if (!this.reducedMotion) {
            const dust = this.environmentAgent.getDustParticles?.();
            if (dust) this.dustAnimator = new DustAnimator(dust);
        }
    }

    /* ================= HOTSPOTS D'AUSCULTATION (STÉTHOSCOPE UNIQUEMENT) ================= */

    _initHotspots() {
        // Aucune zone interactive affichée sur le corps du patient (corps 100% dégagé)
        this.hotspotsGroup = null;

        // Hotspots d'auscultation (visibles UNIQUEMENT si stéthoscope équipé en vue patient)
        this.auscultationHotspotsGroup = new THREE.Group();
        this.auscultationHotspotsGroup.name = "AuscultationHotspots";
        this.scene.add(this.auscultationHotspotsGroup);

        const auscultData = [
            { id: 'auscultation_cardio', pos: [1.26, 1.15, -3.4], color: 0x00ffff, label: 'Foyer Cardiaque' },
            { id: 'auscultation_pulmo_gauche', pos: [1.34, 1.14, -3.4], color: 0x00ff00, label: 'Poumon Gauche' },
            { id: 'auscultation_pulmo_droit', pos: [1.08, 1.14, -3.4], color: 0x00ff00, label: 'Poumon Droit' }
        ];

        auscultData.forEach(data => {
            const geom = new THREE.RingGeometry(0.045, 0.06, 32);
            const mat = new THREE.MeshBasicMaterial({
                color: data.color,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.85,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false
            });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(...data.pos);
            mesh.userData = {
                interactive: true,
                isHotspot: true,
                hotspotId: data.id,
                label: data.label
            };
            this.auscultationHotspotsGroup.add(mesh);
            this.interactiveObjects.push(mesh);
        });

        this.auscultationHotspotsGroup.visible = false;
    }

    updateHotspotsPosition() {
        const isLying = (this.patient?._currentPosition === 'allonge');
        const auscultMap = {
            'auscultation_cardio': isLying ? [4.76, 1.21, 0.38] : [1.26, 1.15, -3.4],
            'auscultation_pulmo_gauche': isLying ? [4.86, 1.20, 0.38] : [1.34, 1.14, -3.4],
            'auscultation_pulmo_droit': isLying ? [4.60, 1.20, 0.38] : [1.08, 1.14, -3.4]
        };
        this.auscultationHotspotsGroup?.children.forEach(child => {
            const pos = auscultMap[child.userData.hotspotId];
            if (pos) child.position.set(...pos);
        });
    }

    updateStethoscopeHotspotsVisibility() {
        const isPatientMode = (this.currentCameraMode === 'patient');
        if (this.auscultationHotspotsGroup) {
            this.auscultationHotspotsGroup.visible = (isPatientMode && !!this.stethoscopeMode);
        }
    }

    /* ================= GESTION DES ÉVÉNEMENTS ================= */

    _bindEvents(signal) {
        const el = this.renderer.domElement;

        el.addEventListener('pointerdown', (e) => {
            this._ptrDown = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
        }, { signal });

        el.addEventListener('pointerup', (e) => {
            const d = this._ptrDown;
            this._ptrDown = null;
            if (this._cleanedUp || !d || d.id !== e.pointerId) return;
            const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
            if (moved < 9 && performance.now() - d.t < 450) this.onClick(e);
        }, { signal });

        el.addEventListener('pointermove', (e) => {
            this._pointerClient.x = e.clientX;
            this._pointerClient.y = e.clientY;
            this._pointerInside = true;
        }, { signal, passive: true });

        el.addEventListener('pointerleave', () => {
            this._pointerInside = false;
            this.highlighter.set(null);
            this.tooltip.hide();
        }, { signal });

        window.addEventListener('resize', () => this.resize(), { signal });
        document.addEventListener('visibilitychange', () => this._clock.getDelta(), { signal });

        document.addEventListener('instruments-updated', () => this.collectInteractive(), { signal });
        document.addEventListener('patient-model-changed', () => {
            this.patientAnimator?.reset();
            this.updateHotspotsPosition();
            this.collectInteractive();
        }, { signal });

        window.addEventListener('keydown', (e) => this._onKeyDown(e), { signal });
    }

    _onKeyDown(e) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;

        switch (e.code) {
            case 'KeyF':
                if (e.repeat) return;
                this.fpsController?.enabled ? this.fpsController.deactivate() : this.setCamera('fps');
                break;
            case 'Digit1': this.setCamera('room'); break;
            case 'Digit2': this.setCamera('patient'); break;
            case 'Digit3': this.setCamera('desk'); break;
        }
    }

    /* ================= RAYCASTING & INTERACTION ================= */

    collectInteractive() {
        const all = [];
        this.scene.traverse(o => { if (o.userData?.interactive) all.push(o); });
        const set = new Set(all);
        this._interactiveRoots = all.filter(o => {
            let p = o.parent;
            while (p) { if (set.has(p)) return false; p = p.parent; }
            return true;
        });
        this.interactiveObjects = all;
    }

    pick(arg = null) {
        const isCenter = (arg === true) || (this.fpsController?.enabled && !arg?.clientX);
        if (isCenter) {
            this.pointer.set(0, 0);
        } else if (arg && typeof arg.clientX === 'number') {
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.pointer.x = ((arg.clientX - rect.left) / rect.width) * 2 - 1;
            this.pointer.y = -((arg.clientY - rect.top) / rect.height) * 2 + 1;
        } else if (this._pointerInside) {
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.pointer.x = ((this._pointerClient.x - rect.left) / rect.width) * 2 - 1;
            this.pointer.y = -((this._pointerClient.y - rect.top) / rect.height) * 2 + 1;
        } else {
            return null;
        }

        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hit = this.raycaster.intersectObjects(this._interactiveRoots, true)[0] || null;
        if (isCenter && hit && hit.distance > FPS_INTERACTION_DISTANCE) return null;
        return hit;
    }

    /* ================= SURVOL (HOVER GLOW & TOOLTIP) ================= */

    _updateHover(dt) {
        this._raycastAccum += dt;
        if (this._raycastAccum < 1 / HOVER_RAYCAST_HZ) return;
        this._raycastAccum = 0;

        const fps = !!this.fpsController?.enabled;
        if (this.overlays.visible || this.director?.isAnimating) {
            this.highlighter.set(null);
            this.tooltip.hide();
            return;
        }

        const hit = this.pick(fps);
        const obj = hit?.object ?? null;
        const root = obj ? this._findInteractiveRoot(obj) : null;

        this.highlighter.set(root);
        this.renderer.domElement.style.cursor = root ? 'pointer' : 'default';

        const crosshair = document.getElementById('hud-crosshair');
        crosshair?.classList.toggle('is-targeting', !!root);

        if (!root) {
            this.tooltip.hide();
            return;
        }

        const ud = root.userData;
        const label = this._findObjectLabel(root);

        this.tooltip.show({
            icon: ud.instrument ? '🩺' : '🔬',
            label,
            desc: ud.hint || TOOLTIP_DESCRIPTIONS[label] || '',
            hint: this._hintFor(root, label),
            done: !!ud.completed,
        }, fps ? window.innerWidth / 2 : this._pointerClient.x, fps ? window.innerHeight / 2 : this._pointerClient.y);

        this.callbacks.onHover?.(obj, { clientX: this._pointerClient?.x ?? (window.innerWidth / 2), clientY: this._pointerClient?.y ?? (window.innerHeight / 2) });
    }

    _hintFor(root, label) {
        const ud = root.userData;
        if (ud.isHotspot) return '🖱️ Cliquer pour examiner';
        if (ud.instrument) return '🖱️ Cliquer pour utiliser';
        if (label === 'Meuble Evier' || label.includes('Evier')) return this.session.handsClean ? '✔ Mains désinfectées' : '⚠️ Désinfectez-vous les mains';
        if (label === 'Armoire') return '🖱️ Ouvrir l\'armoire à pharmacie';
        if (label.toLowerCase().includes('patient')) return '🖱️ Interroger / Examiner';
        return '';
    }

    _findInteractiveRoot(obj) {
        let c = obj, best = null;
        while (c) {
            if (c.userData?.interactive) best = c;
            c = c.parent;
        }
        return best;
    }

    _findObjectLabel(obj) {
        let c = obj;
        while (c) {
            if (c.userData?.label) return c.userData.label;
            if (c.userData?.instrument?.label) return c.userData.instrument.label;
            c = c.parent;
        }
        return obj.name || 'Objet';
    }

    /* ================= CLIC & INTERACTIONS MÉDICALES ================= */

    onClick(event) {
        if (this._cleanedUp) return;
        this.tooltip.hide();

        const fps = !!this.fpsController?.enabled;
        if (event && typeof event.clientX === 'number') {
            this._pointerClient.x = event.clientX;
            this._pointerClient.y = event.clientY;
            this._pointerInside = true;
        }

        const hit = this.pick(fps ? true : event);
        if (!hit) return;

        const root = this._findInteractiveRoot(hit.object) ?? hit.object;
        const label = this._findObjectLabel(root);
        const holdCam = this.currentCameraMode === 'room' && !fps;

        // Hotspots d'examen patient (Tête / Torse / Abdomen ou auscultation)
        if (root.userData?.isHotspot || hit.object.userData?.isHotspot) {
            const targetNode = root.userData?.isHotspot ? root : hit.object;
            return this._activateHotspot(targetNode);
        }

        // Instruments médicaux
        const instrument = this.instruments.getByObject(hit.object) || this.instruments.getByObject(root);
        if (instrument) {
            this.instruments.triggerBounce(instrument.id);
            medicalAudio.playMeasureSound();
            this.session.record('instrument', { id: instrument.id });
            this._setActiveTool(instrument.id);
            if (!holdCam && !fps) this.director.focusOn(root, { duration: 600 });
            this.callbacks.onInstrument?.(instrument, hit.object);
            return;
        }

        // Hygiène des mains (Évier / SHA) :
        // NE PAS voler la caméra vers l'évier ! Cela permet au joueur d'observer le médecin
        // marcher de manière fluide et naturelle vers l'évier.
        if (root.name === 'Meuble Evier' || label.includes('Evier') || label.includes('Évier')) {
            this.session.washHands();
            window.showNotification?.('Hygiène : friction hydro-alcoolique effectuée ✔', 'success');
            this.callbacks.onEvier?.(root);
            return;
        }

        // Porte de sortie
        if (root.name === 'Porte entree' || label.toLowerCase().includes('porte')) {
            this.callbacks.onExit?.(this.session.summary()) ?? (window.location.href = 'index.html');
            return;
        }

        // Dossier médical / PC
        if (root.userData?.pcAction || label.includes('Ordinateur')) {
            if (!holdCam && !fps) this.director.focusOn(root, { duration: 550 });
            this.callbacks.onPC?.(root);
            return;
        }

        // Examen patient direct (clic sur le corps)
        if (label.toLowerCase().includes('patient')) {
            if (!holdCam && !fps) this.director.focusOn(root, { duration: 650 });
            this.callbacks.onPatient?.(root);
            return;
        }

        // Armoire à pharmacie & Masque O2
        if (label === 'Armoire') {
            if (!holdCam && !fps) this.director.focusOn(root, { duration: 600 });
            this.callbacks.onArmoire?.(root);
            return;
        }
        if (label === 'Masque à Oxygène') {
            this.callbacks.onMasqueO2?.(root);
            return;
        }

        if (!holdCam && !fps) this.director.focusOn(root, { duration: 650 });
        this.callbacks.onObject?.(root);
    }

    _activateHotspot(node) {
        const ud = node.userData;
        const id = ud.hotspotId;

        medicalAudio.playMeasureSound();

        if (id && id.startsWith('auscultation_')) {
            const action = (id === 'auscultation_cardio') ? 'auscultation_cardio' : 'auscultation_pneumo';
            this.manager?.clinicalAgent?.performAction(action);
            return;
        }

        if (this.manager?.clinicalAgent) {
            this.manager.clinicalAgent.openExaminationMenu(id);
            if (id === 'tête') {
                this.manager.openPatientDialog?.();
            }
        } else {
            this.callbacks.onPatient?.(node);
        }
    }

    _setActiveTool(toolId) {
        const map = { stethoscope: 'stethoscope', marteau: 'marteau' };
        const tool = map[toolId] ?? null;
        this.stethoscopeMode = (tool === 'stethoscope');
        this.updateStethoscopeHotspotsVisibility();
    }

    /* ================= CONTRÔLE DE CAMÉRA ================= */

    setCamera(mode, animate = true) {
        if (mode === 'fps') return this._enterFPS();
        if (this.fpsController?.enabled) this.fpsController.deactivate();

        this.controls.enabled = true;
        document.body.classList.remove('mode-fps');
        if (this.characterController?.group) this.characterController.group.visible = true;

        this.currentCameraMode = mode;
        this.updateStethoscopeHotspotsVisibility();

        const lying = this.patient?._currentPosition === 'allonge';
        const presets = {
            room:    { pos: [-4.4, 3.9, 7.8], target: [0.5, 0.8, -1.0] },
            patient: lying ? { pos: [3.1, 2.2, 2.3], target: [4.7, 1.05, 0.1] }
                           : { pos: [1.8, 2.05, -1.05], target: [1.2, 1.15, -3.45] },
            desk:    { pos: [-1.8, 2.0, 1.4], target: [-3.6, 1.3, -0.7] },
            cabinet: { pos: [1.5, 2.2, -1.6], target: [3.8, 1.5, -3.8] },
            anatomy: { pos: [-3.4, 1.9, -1.8], target: [-5.4, 1.8, -1.8] },
        };
        const p = presets[mode] ?? presets.room;

        this.director.setBounds(
            new THREE.Vector3(...(mode === 'room' ? [-6, 0.4, -4.7] : [-5.2, 0.45, -4.7])),
            new THREE.Vector3(...(mode === 'room' ? [6, 4.8, 8.2] : [5.2, 4.6, 4.7])),
        );
        this.director.moveTo(new THREE.Vector3(...p.pos), new THREE.Vector3(...p.target), {
            duration: animate ? 680 : 0,
            ease: Easing.inOutCubic,
        });

        this.lightingAgent?.setCameraExposure(mode);
        document.querySelectorAll('#hud-3d [data-camera]').forEach(b =>
            b.classList.toggle('active', b.dataset.camera === mode));
    }

    flyCameraTo(targetPosition, lookAtTarget, duration = 700) {
        if (!this.director || !targetPosition) return;
        const target = lookAtTarget || targetPosition;
        this.director.moveTo(targetPosition, target, { duration, ease: Easing.inOutCubic });
    }

    _setupFPS() {
        this.fpsController = new ThreeFPSController(this.camera, this.renderer.domElement, {
            onInteract: () => this.onClick(null),
            onDeactivate: () => {
                this.controls.enabled = true;
                document.body.classList.remove('mode-fps');
                if (this.characterController?.group) this.characterController.group.visible = true;
                document.getElementById('hud-crosshair')?.classList.remove('is-targeting');
                this.setCamera(this._cameraBeforeFPS || 'room', true);
                this._cameraBeforeFPS = null;
            },
        });
    }

    _enterFPS() {
        if (!this.fpsController || this.fpsController.enabled) return;
        if (this.currentCameraMode && this.currentCameraMode !== 'fps') {
            this._cameraBeforeFPS = this.currentCameraMode;
        }
        this.currentCameraMode = 'fps';
        this.director.cancel();
        if (this.hotspotsGroup) this.hotspotsGroup.visible = false;
        if (this.auscultationHotspotsGroup) this.auscultationHotspotsGroup.visible = false;
        if (this.characterController?.group) this.characterController.group.visible = false;
        this.controls.enabled = false;
        document.body.classList.add('mode-fps');
        document.querySelectorAll('#hud-3d [data-camera]').forEach(b =>
            b.classList.toggle('active', b.dataset.camera === 'fps'));

        const lying = this.patient?._currentPosition === 'allonge';
        this.fpsController.activate(
            lying ? new THREE.Vector3(3.6, 1.6, 0.2) : new THREE.Vector3(1.0, 1.6, -2.3),
            lying ? new THREE.Vector3(4.7, 1.1, 0.2) : new THREE.Vector3(1.2, 1.15, -3.45),
        );
        window.showNotification?.('Mode immersif : ZQSD pour marcher, clic pour interagir, Échap pour quitter.', 'info');
    }

    triggerScreenShake(intensity = 0.08) {
        this.screenShakeIntensity = Math.min(0.25, Math.max(this.screenShakeIntensity, intensity));
    }

    /* ================= GESTION DU CAS CLINIQUE & CONSTANTES ================= */

    loadCase(caseData) {
        this.patient.loadCase(caseData);
        this.updateHotspotsPosition();
        this.updateStethoscopeHotspotsVisibility();

        this.session = new EcosSession({
            durationSec: caseData?.durationSec ?? 480,
            onTick: (r, d) => this.callbacks.onTimer?.(r, d),
            onPhase: p => this.callbacks.onStationPhase?.(p),
        });
        this.session.start();

        this.patientAnimator = new PatientAnimator(this.patient.group, {
            breathRate: caseData?.patient?.breathRate ?? 1.2,
            expression: caseData?.patient?.expression ?? 'normal',
        });
        this.collectInteractive();

        medicalAudio.init();
        medicalAudio.resume();
        const hr = this._parseHeartRate(caseData);
        if (hr > 0) medicalAudio.startECGBeep(hr);
        if (this._isUrgentCase(caseData)) {
            medicalAudio.startAlarm('critical');
            this.triggerScreenShake(0.12);
        }
        this.setHeartRate(hr);
    }

    _parseHeartRate(c) {
        const v = c?.examenClinique?.constantes;
        const m = String(v?.pouls ?? v?.heartRate ?? 72).match(/\d+/);
        return m ? +m[0] : 72;
    }

    _isUrgentCase(c) {
        const v = c?.examenClinique?.constantes;
        if (!v) return false;
        const spo2 = +(String(v.saturationO2 ?? '100').match(/\d+/)?.[0] ?? 100);
        return this._parseHeartRate(c) > 120 || spo2 < 90 || (c.difficulty ?? 1) >= 3;
    }

    setPatientExpression(expr, d = 0.8) {
        this.patientAnimator?.setExpression(expr, d);
        this.patient?.applyExpression(expr);
    }

    setRespirationPattern(p) {
        this.patientAnimator?.setRespirationPattern(p);
    }

    setHeartRate(bpm) {
        if (this.ecgAnimator) this.ecgAnimator.heartRate = bpm;
        if (this.wallEcgAnimator) this.wallEcgAnimator.heartRate = bpm;
    }

    setIVDropInterval(i) {
        if (this.ivAnimator) this.ivAnimator.dropInterval = i;
    }

    setPatientVitals(v = {}) {
        if (v.heartRate !== undefined) {
            this.setHeartRate(v.heartRate);
            medicalAudio.updateHeartRate(v.heartRate);
            this.instruments?.animatedParts?.forEach(p => {
                if (p.type === 'pulsingLED') p.freq = v.heartRate / 60;
            });
        }
        if (v.dyspnea) {
            this.setRespirationPattern('dyspnea');
        } else if (v.respiratoryRate !== undefined) {
            const rr = v.respiratoryRate;
            this.setRespirationPattern(rr > 25 ? 'tachypnea' : rr < 6 ? 'agonal' : rr < 10 ? 'bradypnea' : 'normal');
        }
        if (v.expression) this.setPatientExpression(v.expression);
        if (v.spO2 !== undefined && this.ivAnimator) {
            this.ivAnimator.dropInterval = v.spO2 < 90 ? 0.4 : v.spO2 < 95 ? 0.6 : 0.8;
        }
    }

    moveDoctorTo(target, onArrive) {
        if (this.characterController) return this.characterController.moveTo(target, onArrive);
        if (!this.doctorAnimator) {
            const d = this.scene.getObjectByName('Doctor');
            if (d) this.doctorAnimator = new DoctorAnimator(d);
        }
        this.doctorAnimator?.startWalking();
    }

    /* ================= BOUCLE DE RENDU PRINCIPALE ================= */

    _loop() {
        this._animFrameId = requestAnimationFrame(this._loop);
        if (this._cleanedUp) return;

        if (document.hidden) {
            this._clock.getDelta();
            return;
        }

        const dt = Math.min(this._clock.getDelta(), MAX_DT);
        const t = this._clock.elapsedTime;

        const overlayed = this.overlays.visible;
        if (overlayed) {
            this._overlayAccum = (this._overlayAccum ?? 0) + dt;
            if (this._overlayAccum < 0.125) return;
            this._overlayAccum = 0;
        }

        this.session.update(dt);

        this.patientAnimator?.update(t, dt);
        this.patient?.update?.(t, dt);
        this.instruments?.update?.(t);
        this.dustAnimator?.update(t);
        this.ivAnimator?.update(t, dt);
        this.ecgAnimator?.update(t);
        this.wallEcgAnimator?.update(t);
        this.environmentAgent?.updateEnvironment?.(t);

        if (this.characterController?.animator) {
            this.characterController.animator.update(t, dt);
        } else {
            this.doctorAnimator?.update(t, dt);
        }

        if (this.fpsController?.enabled) this.fpsController.update(dt);

        if (!overlayed) this._updateHover(dt);
        this.highlighter.update(dt, this.camera);
        this.qualityAgent?.sample(dt);

        if (this.auscultationHotspotsGroup?.visible) {
            const s = 1.0 + Math.sin(t * 4.0) * 0.1;
            this.auscultationHotspotsGroup.children.forEach(c => c.scale.set(s, s, 1));
        }

        // Screen Shake amorti
        if (this.screenShakeIntensity > 0.001) {
            this.camera.position.x += (Math.random() - 0.5) * this.screenShakeIntensity;
            this.camera.position.y += (Math.random() - 0.5) * this.screenShakeIntensity;
            this.screenShakeIntensity *= 0.92;
        }

        // Cadrage et cinématique caméra
        this.director.beginFrame();
        if (!this.fpsController?.enabled) this.controls.update();
        this.director.endFrame(dt);

        // Throttling du calcul d'ombres pour soulager le GPU (inutile de recalculer chaque micro-frame)
        this._shadowTimer = (this._shadowTimer || 0) + dt;
        if (this._shadowTimer >= 0.04 || this.characterController?.isMoving) {
            this.renderer.shadowMap.needsUpdate = true;
            this._shadowTimer = 0;
        }

        // Rendu final
        if (!this.lightingAgent?.render?.()) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    resize() {
        const [w, h] = this._size();
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.lightingAgent?.resize(w, h);
    }

    /* ================= NETTOYAGE & LIBÉRATION MÉMOIRE ================= */

    cleanup() {
        if (this._cleanedUp) return;
        this._cleanedUp = true;

        cancelAnimationFrame(this._animFrameId);
        this._ac.abort();

        medicalAudio.destroy();
        this.overlays.dispose();
        this.tooltip.dispose();
        this.highlighter.dispose();
        this.director.cancel();
        this.controls.dispose();
        this.qualityAgent?.dispose();
        this.lightingAgent?.dispose();
        this.fpsController?.dispose?.();
        this.patient?.dispose?.();

        this._envRT?.dispose();
        SceneDisposer.purge(this.scene);
        this.scene.clear();

        this.renderer.dispose();
        this.renderer.forceContextLoss();
        this.renderer.domElement.remove();
    }
}