import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { buildFurniture, buildRoom } from './three-room.js';
import { ThreePatient } from './three-patient.js';
import { ThreeInstruments } from './three-instruments.js';
import { PatientAnimator, DoctorAnimator, DustAnimator, IVFluidAnimator, ECGScreenAnimator } from './three-animations.js';
import { ThreeLightingAgent } from './three-lighting-agent.js';
import { ThreeEnvironmentAgent } from './three-environment-agent.js';
import { medicalAudio } from './three-audio.js';
import { ThreeFPSController } from './three-fps-controller.js';
import { ThreeQualityAgent, QUALITY_PRESETS } from './three-quality-agent.js';

import { Easing, OverlayWatcher, prefersReducedMotion } from './three-core-utils.js';
import { CameraDirector } from './three-camera-director.js';
import { HoverHighlighter } from './three-highlight.js';
import { HudTooltip } from './three-hud.js';
import { EcosSession } from './three-ecos-session.js';
import { TaskScheduler } from './task-scheduler.js';
import { SceneDisposer } from './scene-disposer.js';
// Scope multiparamétrique mural et calques cinématiques (grain, balayage,
// halo d'alarme). Ces modules n'importent que 'three' : pas de second
// moteur, pas de dépendance nouvelle.
import { creerScope } from './three-scope.js';
import { creerOverlays } from './three-overlays.js';

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
    // L'atlas est une vue 3D plein écran : pendant qu'il est ouvert, la salle
    // n'est qu'un fond. Elle passe donc au rythme de 8 fps au lieu de 60.
    'atlas-overlay',
];

const FPS_INTERACTION_DISTANCE = 2.5;
const HOVER_RAYCAST_HZ = 20;
const MAX_DT = 0.05;

/**
 * Budget de travail synchrone par frame pendant la construction de la scène.
 * 8 ms laisse plus de la moitié du budget d'une frame à 60 fps : l'onglet reste
 * fluide et l'écran de chargement continue de s'animer pendant que la salle
 * se monte, au lieu d'un gel de plusieurs centaines de millisecondes.
 */
const BUILD_BUDGET_MS = 8;

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
                if (p === 'warning') medicalAudio.playAlert();
                // Le focus audio suit la phase de station : pendant la phase
                // d'avertissement, la musique s'efface au profit du timer.
                const amb = window.MedGameAmbience;
                if (amb && amb.isRunning()) {
                    amb.setFocus(p === 'warning' ? 'action' : 'idle');
                }
                this.callbacks.onStationPhase?.(p);
            },
        });
    }

    /* ================= INITIALISATION ================= */

    /**
     * Construit la scène clinique.
     *
     * Cette méthode est `async` et étalée sur plusieurs frames : la construction
     * représente ~180 maillages, ~180 géométries et ~125 matériaux, soit plusieurs
     * centaines de millisecondes de travail bloquant. Tout faire d'un bloc figeait
     * l'onglet pendant le lancement (le joueur voyait une page morte, pas une
     * salle qui apparaît). `TaskScheduler` rend la main au navigateur après
     * quelques millisecondes, donc l'interface reste vivante et l'écran de
     * chargement peut s'animer.
     *
     * L'ordre des étapes est inchangé — les dépendance restent satisfaites :
     * qualité (qui décide du LOD de décor) → env. →_PATIENT → animations →
     * hotspots → registre des objets interactifs.
     */
    async init() {
        const { signal } = this._ac;

        // --- Étape 1 : socle. Tout ce qui est nécessaire pour afficher un frame. ---
        this.scene.background = new THREE.Color(0x2d3135);
        this.scene.fog = new THREE.Fog(0x2d3135, 9, 22);
        this._normalFogColor = this.scene.fog.color.clone();

        this.camera = new THREE.PerspectiveCamera(52, this._aspect(), 0.08, 80);
        this.scene._camera = this.camera;

        // Moteur de rendu WebGL avec PBR et ACESFilmic Tone Mapping
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
            stencil: false,
        });
        // Le plafond de 2.0 est repris plus bas par ThreeQualityAgent selon le GPU
        // détecté : sur un écran HiDPI avec un GPU intégré, 2.0 quadruple le
        // coût de fill rate de chaque passe. On démarre prudent.
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
        this.renderer.setSize(...this._size());
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = false;
        this.renderer.shadowMap.needsUpdate = true;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        // ── LE LEVIER LE PLUS COÛTEUX DE TOUTE LA PAGE 3D ──────────────────
        //
        // `renderer.debug.checkShaderErrors` vaut `true` par défaut dans
        // three.js. À ce titre, `WebGLProgram.onFirstUse()` — exécuté la
        // PREMIÈRE fois que chaque programme est utilisé, donc pendant le
        // rendu — appelle `gl.getProgramInfoLog()` pour chacun d'eux.
        //
        // Ce n'est pas une lecture de log anodine : c'est un aller-retour
        // SYNCHRONE au pilote. `gl.linkProgram()` est asynchrone et ne mesure
        // que 3,2 s sur l'ensemble de la session ; la lecture du journal
        // concentrait, elle, 60 s sur une fenêtre de 55 s. Autrement dit : tout
        // le temps de compilation des shaders était payé sur le thread
        // principal, au milieu du rendu, au pire moment.
        //
        // three.js fournit ce drapeau précisément pour ce cas. On le désactive,
        // sauf quand on cherche explicitement à diagnostiquer un matériau noir :
        // `game.html?shaderdebug=1`.
        this.renderer.debug.checkShaderErrors =
            new URLSearchParams(window.location.search).has('shaderdebug');

        this.container.appendChild(this.renderer.domElement);

        this.renderer.domElement.tabIndex = 0;
        this.renderer.domElement.setAttribute('aria-label', 'Salle d\'examen 3D interactive');

        // Garde contre la perte de contexte WebGL (l'environnement IBL est configuré par ThreeLightingAgent)
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

// Horloge + boucle rendues AVANT la construction : le joueur voit la
        // salle se remplir au lieu d'un écran figé. La boucle ne rend que ce
        // qui existe déjà, ce qui est sans danger.
        this._clock = new THREE.Clock();
        this._loop = this._loop.bind(this);
        this._animFrameId = requestAnimationFrame(this._loop);

        // Cadrage initial posé avant la construction pour que les premières
        // frames soient déjà prises du bon angle.
        this.setCamera('room', false);

        // --- Étapes 2+ : construction étalée ---
        this._building = true;
        await TaskScheduler.runBatched(this._buildSteps(), BUILD_BUDGET_MS);

        if (this._cleanedUp) return;
        this._building = false;

        this.collectInteractive();
        this._bindEvents(signal);
        this._setupFPS();

        // Préchauffage des shaders — mais SEULEMENT quand le navigateur expose
        // `KHR_parallel_shader_compile`. Dans ce cas `compileAsync()` compile en
        // arrière-plan, étalé sur plusieurs frames, et les dizaines de
        // programmes de la salle se préparent pendant l'écran de chargement au
        // lieu de se répartir en à-coups de plusieurs centaines de ms pendant la
        // partie (c'est le gel que le joueur décrit).
        //
        // Sans cette extension, `compileAsync()` compile en SYNCHRONE : il
        // figerait l'onglet (mesuré à ~26 s cumulés en rendu logiciel). On ne
        // l'appelle donc jamais dans ce cas et on laisse `ThreeQualityAgent`
        // décider, une fois la cadence prouvée confortable.
        this._warmupShadersWhenIdle();
    }

    /**
     * Compile les shaders de la scène en tâche de fond, si et seulement si le
     * navigateur sait compiler en parallèle (KHR_parallel_shader_compile).
     * Idempotent : positionne `qualityAgent._shadersWarmed` pour que le
     * déclenchement différé de ThreeQualityAgent ne recommence pas le travail.
     */
    _warmupShadersWhenIdle() {
        try {
            const extensions = this.renderer?.extensions;
            if (!extensions || typeof extensions.has !== 'function') return;
            if (!extensions.has('KHR_parallel_shader_compile')) return;

            const start = () => {
                if (this._cleanedUp || this._shadersWarmupStarted) return;
                this._shadersWarmupStarted = true;
                Promise.resolve(this.renderer.compileAsync(this.scene, this.camera))
                    .then(() => {
                        if (this.qualityAgent) this.qualityAgent._shadersWarmed = true;
                    })
                    .catch(() => { /* la compilation paresseuse reste le filet */ });
            };

            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(start, { timeout: 1500 });
            } else {
                setTimeout(start, 250);
            }
        } catch (e) {
            // Un échec de préchauffage ne doit jamais empêcher la scène de vivre.
        }
    }

    /**
     * Étapes de construction, découpées pour `TaskScheduler.runBatched`.
     * L'ordre est significatif : chaque étape ne dépend que des précédentes.
     * @returns {Array<Function>}
     */
_buildSteps() {
        // L'agent d'environnement est instancié tout de suite : c'est gratuit
        // (il ne stocke que des références, il ne touche pas au graphe), et
        // c'est nécessaire pour connaître par avance ses vingt tranches de
        // construction. Le contenu de la salle, lui, reste entièrement différé.
        this.environmentAgent = new ThreeEnvironmentAgent(this.scene);

        // Calques cinématiques (grain, balayage, halo d'alarme).
        //
        // Ce sont des NŒUDS DOM, pas des maillages : ils sont posés par-dessus
        // le canvas par le compositeur du navigateur, et ne coûtent donc rien
        // au moteur 3D. Le halo d'alarme est un signal clinique : il est
        // piloté par les vraies constantes du jeu.
        this.overlaysCinema = creerOverlays();

        return [
            // Géométrie de la pièce (murs, sol, plafond)
            () => buildRoom(this.scene),

            // Mobilier
            () => buildFurniture(this.scene),

            // Éclairage + IBL procédural (PMREM). L'agent de qualité est créé
            // juste après : il doit exister avant l'habillage de la salle pour
            // pouvoir décider du niveau de détail du décor.
            () => {
                this.lightingAgent = new ThreeLightingAgent(this.scene, this.renderer);
                this.lightingAgent.setupLighting();
            },

            () => {
                this.qualityAgent = new ThreeQualityAgent(this);
                // `apply()` est synchrone : le preset est résolu dès ici, ce qui
                // permet à l'étape d'après de connaître le palier de détail.
                this.qualityAgent.init().catch(e => console.warn('[ThreeScene] qualité:', e));
            },

            // --- La salle, en vingt tranches distinctes ---
            ...this.environmentAgent.enhanceRoomSteps(),

            // Applique le palier de décor correspondant au GPU détecté, une fois
            // la salle complète : les objets décoratifs n'existent qu'à partir
            // d'ici, l'agent de qualité n'a donc rien pu masquer plus tôt.
            () => {
                const env = this.environmentAgent;
                env.setDetailLevel(env.detailLevelForPreset(this.qualityAgent?.presetName));
            },

            () => {
                this.patient = new ThreePatient(this.scene);
                this.patientAnimator = new PatientAnimator(this.patient.group);
            },

            () => {
                this.instruments = new ThreeInstruments(this.scene);
            },

            // Animateurs : ils cherchent leurs cibles dans l'environnement et
            // les instruments, donc après les étapes précédentes.
            () => this._setupEnvAnimators(),

            // Hotspots discrets et parfaitement adaptés aux personnages
            () => this._initHotspots(),

            // Surlignage & Tooltip HUD
            () => {
                this.highlighter = new HoverHighlighter(this.scene, { liftAmount: this.reducedMotion ? 0 : 0.014 });
                this.tooltip = new HudTooltip();
            },
        ];
    }

    _aspect() {
        const [w, h] = this._size();
        return w / h;
    }

    _size() {
        return [this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight];
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

        // L'écran MURAL n'est plus une bande d'ECG : c'est un scope
        // multiparamétrique (ECG + pouls + respiration + chiffres), posé plus
        // bas dans `_initScope()`. L'animateur classique REPLAÇANT la texture
        // du maillage (`screenMesh.material.map = this.texture`), il
        // l'écraserait : on ne le crée donc pas.
        //
        // La bande d'ECG de CHEVET, elle, reste : c'est elle qu'on lit en
        // auscultant le patient.
        this._initScope();

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

    /**
     * Pose le scope multiparamétrique sur l'écran mural.
     *
     * C'est l'écran que l'étudiant regarde pendant qu'il garde le patient :
     * ECG, courbe de pouls, courbe de respiration, et les chiffres. Tout
     * est lu dans `window.vitalSigns.props` — la source unique du jeu. Le
     * scope ne calcule RIEN de clinique : il dessine ce que la partie sait
     * déjà.
     */
    _initScope() {
        const ecranMural = this.environmentAgent.getWallECGScreenMesh?.();
        if (!ecranMural) return;
        try {
            this.scope = creerScope(ecranMural, { patientLabel: this._patientLabel() });
        } catch (e) {
            console.warn('[ThreeScene] scope mural indisponible :', e);
        }
    }

    /**
     * Étiquette du patient affichée en en-tête du scope.
     * @returns {string}
     */
    _patientLabel() {
        const cas = this.manager?.currentCase || window.gameState?.currentCase;
        const p = cas?.patient;
        if (!p) return 'PATIENT';
        const nom = [p.prenom, p.nom].filter(Boolean).join(' ').trim();
        const age = p.age !== undefined ? ` • ${p.age} ans` : '';
        return `${nom || 'PATIENT'}${age}`;
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

        // Le redimensionnement est coalescé sur une frame. En l'état, un
        // glisser-redimensionner déclenchait `setSize` des dizaines de fois par
        // seconde — et avec un composer actif, chaque appel réalloue ses render
        // targets (GTAO en a plusieurs), ce qui sature le GPU pendant tout le
        // geste.
        window.addEventListener('resize', () => {
            if (this._resizeRaf != null) return;
            this._resizeRaf = requestAnimationFrame(() => {
                this._resizeRaf = null;
                if (!this._cleanedUp) this.resize();
            });
        }, { signal });

        // Le rectangle cache du canvas est sensible au défilement de la page.
        window.addEventListener('scroll', () => this._invalidateCanvasRect(), { signal, passive: true });
        document.addEventListener('visibilitychange', () => {
            this._clock.getDelta();
            if (document.hidden) {
                if (this._animFrameId != null) cancelAnimationFrame(this._animFrameId);
                this._animFrameId = null;
            } else if (!this._cleanedUp && this._animFrameId == null) {
                this._animFrameId = requestAnimationFrame(this._loop);
            }
        }, { signal });

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

    /**
     * Rectangle du canvas, mis en cache.
     *
     * `getBoundingClientRect()` force un reflow complet du document. L'appelait
     * à chaque raycast (20 Hz) pour convertir les coordonnées du pointeur en NDC
     * coûtait un flush de layout par frame. Le rectangle ne bouge qu'au
     * redimensionnement ou au défilement : on le rafraîchit sur ces deux
     * événements, et au plus une fois par demi-seconde pour rester exact.
     * @returns {DOMRect|Object}
     */
    _canvasRect() {
        const now = performance.now();
        if (!this._rect || now - (this._rectAt || 0) > 500) {
            this._rect = this.renderer.domElement.getBoundingClientRect();
            this._rectAt = now;
        }
        return this._rect;
    }

    /** Invalide le rectangle cache (taille ou position modifiées). */
    _invalidateCanvasRect() {
        this._rect = null;
        this._rectAt = 0;
    }

    pick(arg = null) {
        const isCenter = (arg === true) || (this.fpsController?.enabled && !arg?.clientX);
        if (isCenter) {
            this.pointer.set(0, 0);
        } else if (arg && typeof arg.clientX === 'number') {
            const rect = this._canvasRect();
            this.pointer.x = ((arg.clientX - rect.left) / rect.width) * 2 - 1;
            this.pointer.y = -((arg.clientY - rect.top) / rect.height) * 2 + 1;
} else if (this._pointerInside) {
            const rect = this._canvasRect();
            this.pointer.x = ((this._pointerClient.x - rect.left) / rect.width) * 2 - 1;
            this.pointer.y = -((this._pointerClient.y - rect.top) / rect.height) * 2 - 1;
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
            this._setHoverState(null);
            this.highlighter.set(null);
            this.tooltip.hide();
            return;
        }

        const hit = this.pick(fps);
        const obj = hit?.object ?? null;
        const root = obj ? this._findInteractiveRoot(obj) : null;

        this.highlighter.set(root);
        this._setHoverState(root);

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

    /**
     * Écrit le curseur et l'état du réticule, mais seulement quand ils changent.
     * Le raycast tourne à 20 Hz : réécrire `style.cursor` et re-toggle une classe
     * 20 fois par seconde, alors que la cible n'a pas bougé, invalidait le
     * style du canvas et du HUD en continu.
     * @param {Object3D|null} root — racine interactive survolée, ou null
     */
    _setHoverState(root) {
        const targeting = !!root;
        if (this._hoverTargeting === targeting) return;
        this._hoverTargeting = targeting;

        this.renderer.domElement.style.cursor = targeting ? 'pointer' : 'default';
        if (this._elCrosshair === undefined) {
            this._elCrosshair = document.getElementById('hud-crosshair');
        }
        this._elCrosshair?.classList.toggle('is-targeting', targeting);
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

        // Stéthoscope clinique sur le bureau
        if (root.name === 'Stethoscope' || label.toLowerCase().includes('stethoscope') || label.toLowerCase().includes('stéthoscope')) {
            this._setActiveTool('stethoscope');
            this.setCamera('patient', true);
            this.lightingAgent?.setClinicalMood('auscultation');
            window.showNotification?.('Stéthoscope en main — foyers d\'auscultation activés sur le patient', 'info');
            this.callbacks.onObject?.(root);
            return;
        }

        // Hygiène des mains (Évier / SHA) :
        // NE PAS voler la caméra vers l'évier ! Cela permet au joueur d'observer le médecin
        // marcher de manière fluide et naturelle vers l'évier.
        if (root.name === 'Meuble Evier' || root.name === 'GelHydroalcoolique' || label.includes('Evier') || label.includes('Évier') || label.includes('Hydroalcoolique') || label.includes('Gel')) {
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
        // Négatoscope LED mural (Imagerie)
        if (root.name === 'Negatoscope' || label.includes('Negatoscope') || label.includes('Négatoscope')) {
            this.lightingAgent?.setClinicalMood('negatoscope');
            if (!holdCam && !fps) this.director.focusOn(root, { duration: 550 });
            window.showNotification?.('Négatoscope allumé — examen d\'imagerie médicale', 'info');
            this.callbacks.onObject?.(root);
            return;
        }

        // Lecteur Carte Vitale
        if (root.name === 'LecteurCarteVitale' || label.includes('Carte Vitale')) {
            window.showNotification?.('Carte Vitale validée — droits & ALD synchronisés', 'success');
            this.callbacks.onObject?.(root);
            return;
        }

        // Dossier médical / PC
        if (root.userData?.pcAction || root.name === 'DossierPatient' || label.includes('Ordinateur') || label.includes('Dossier')) {
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
            desk:    { pos: [-3.35, 1.38, 0.52], target: [-3.45, 0.96, -0.68] },
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

    _setupFPS() {
        this.fpsController = new ThreeFPSController(this.camera, this.renderer.domElement, {
            onInteract: () => this.onClick(null),
            onDeactivate: () => {
                this.controls.enabled = true;
                document.body.classList.remove('mode-fps');
                if (this.characterController?.group) this.characterController.group.visible = true;
                // Reset via l'état de survol pour rester cohérent avec le cache :
                // retirer la classe en direct laisserait `_hoverTargeting` à true
                // et le curseur ne reviendrait pas.
                this._setHoverState(null);
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
        const v0 = caseData?.examenClinique?.constantes || {};
        medicalAudio.applyVitals(this._extractAudioVitals(v0, { heartRate: hr }));
        // Le cœur bat dès l'arrivée : c'est le premier indice clinique que le
        // joueur reçoit, avant même de toucher un bouton.
        medicalAudio.startHeartbeat(hr);
        if (hr > 0) medicalAudio.startECGBeep(hr);
        medicalAudio.startBreathing(this._extractAudioVitals(v0).rr);
        if (this._isUrgentCase(caseData)) {
            medicalAudio.startAlarm('critical');
            this.triggerScreenShake(0.12);
        }
        this.setHeartRate(hr);
    }

    /**
     * Traduit les constantes du fichier de cas en nomenclature de la couche
     * audio. Les fichiers de cas écrivent `pouls`, `saturationO2`,
     * `frequenceRespiratoire`… en toute liberté ; l'audio veut `hr`,
     * `spo2`, `rr`. Cette fonction est le seul endroit qui fait le pont.
     */
    _extractAudioVitals(raw = {}, extra = {}) {
        const num = (v, fallback) => {
            const m = String(v ?? '').match(/-?\d+(\.\d+)?/);
            return m ? parseFloat(m[0]) : fallback;
        };
        return {
            hr: extra.heartRate ?? num(raw.pouls ?? raw.heartRate, 72),
            spo2: num(raw.saturationO2 ?? raw.saturation ?? raw.spo2, 98),
            rr: num(raw.frequenceRespiratoire ?? raw.respiratoryRate ?? raw.rr, 14),
            systolic: num(raw.pressionSystolique ?? raw.systolicBP ?? raw.taSystolique, 120),
            temperature: num(raw.temperature ?? raw.t, 37),
            murmur: raw.souffle ?? raw.murmur ?? null
        };
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

    /**
     * État musical déduit des constantes. Les seuils sont volontairement
     * clinically motivés, pas arbitraires :
     *   - SpO2 < 92 % ou FC > 120 : le patient décroche, on passe en « critique » ;
     *   - SpO2 < 97 % ou FC > 100 : tension modérée ;
     *   - SpO2 < 99 % ou FC > 88 : juste une gêne, on reste calme.
     */
    _ambienceStateFor(av) {
        if (av.spo2 < 92 || av.hr > 120) return 'critical';
        if (av.spo2 < 97 || av.hr > 100) return 'tense';
        return 'calm';
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

        // Pendant la construction étalée, la scène est à moitié montée : on ne
        // fait que le minimum (cadrage + rendu) pour animer l'écran de chargement
        // sans invoquer des animateurs qui n'existent pas encore.
        if (this._building) {
            this.director?.beginFrame?.();
            this.controls?.update?.();
            this.director?.endFrame?.(dt);
            this.renderer.render(this.scene, this.camera);
            return;
        }

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

        // Les ombres n'ont pas besoin de suivre les mouvements à 60 Hz.
        // ~80 projecteurs de la salle sont redessinés à chaque rafraîchissement
        // d'ombres : la cadence suit le preset (`shadowInterval`), et se
        // resserre uniquement quand le médecin bouge réellement.
        this._shadowTimer = (this._shadowTimer || 0) + dt;
        const baseInterval = this.qualityAgent
            ? QUALITY_PRESETS[this.qualityAgent.presetName]?.shadowInterval ?? 0.1
            : 0.1;
        const shadowInterval = this.characterController?.isMoving
            ? Math.min(baseInterval, 0.05)
            : baseInterval;
        if (this._shadowTimer >= shadowInterval) {
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
        this._invalidateCanvasRect();
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.lightingAgent?.resize(w, h);
    }

    /* ================= NETTOYAGE & LIBÉRATION MÉMOIRE ================= */

    cleanup() {
        if (this._cleanedUp) return;
        this._cleanedUp = true;

        if (this._animFrameId != null) cancelAnimationFrame(this._animFrameId);
        this._animFrameId = null;
        this._ac.abort();

        medicalAudio.destroy();
        this.overlays.dispose();
        // Les calques cinématiques et le scope sont des objets à durée de vie
        // externe au graphe de scène : ils ne sont pas libérés par le purgeur,
        // il faut les arrêter explicitement (le scope tourne sur un minuteur,
        // les calques restent posés sur la page du jeu).
        this.overlaysCinema?.dispose?.();
        this.overlaysCinema = null;
        this.scope?.dispose?.();
        this.scope = null;
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
