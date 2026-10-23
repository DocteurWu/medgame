/**
 * three-environment-agent.js — Agent d'environnement 3D
 * Gère les textures, décors, et éléments d'ambiance de la salle
 */

import * as THREE from 'three';
import { loadGLBSmart } from './three-loaders.js';
import {
    makePosterTextureSalle,
    makeWainscotTexture,
    makeBlindTexture,
    makeExteriorViewTexture
} from './three-room-textures.js';
import { ROOM, WINDOW } from './three-room.js';
import { ThreeLightingAgent } from './three-lighting-agent.js';
import { hospitalSteps } from './three-room-hospital.js';

/**
 * Paliers de détail décoratif.
 *
 * La salle contient ~110 maillages, dont beaucoup ne servent qu'à l'ambiance.
 * Aucun n'est interactif (les objets cliquables sont marqués
 * `userData.interactive`, jamais dans cette liste), on peut donc les retirer du
 * rendu sans toucher au jeu.
 *
 * Niveau 0 (`low`) : aucun décor superflu — la salle reste meublée et éclairée.
 * Niveau 1 (`medium`) : + poussières, plante, lambris, plinthes, bacs,
 *   accessoires d'évier, moniteur décoratif, cadre et ciel de la fenêtre,
 *   points lumineux du plafond.
 * Niveau 2 (`high` et au-delà) : + panneaux de plafond, faisceau volumétrique
 *   solaire et son fill, horloge murale.
 *
 * Les points lumineux sont le poste le plus cher : chaque `PointLight` ajoute
 * un terme par fragment sur TOUS les matériaux éclairés de la salle. Le faisceau
 * solaire est une grosse boîte additive translucide, donc du fill rate pur.
 */
const DETAIL_TIERS = {
    low: 0,
    medium: 1,
};

export const DETAIL_FULL = 2;

export class ThreeEnvironmentAgent {
    constructor(scene) {
        this.scene = scene;
        this.textures = new Map();
        this.ivGroup = null;
        this.ecgScreenMesh = null;
        this.wallEcgScreenMesh = null;
        this.dustParticles = null;
        // Références d'animation décorative (horloge murale temps réel)
        this._clockHands = null;
        // Objets décoratifs et palier de détail minimum requis pour les afficher.
        this._decor = [];
        this._detailLevel = DETAIL_FULL;
    }

    /**
     * Déclare un objet comme purement décoratif.
     *
     * ⚠ NE JAMAIS DÉCLARER UNE LUMIÈRE ICI.
     *
     * Dans three.js, une lumière `visible = false` disparaît de la liste des
     * lumières de la scène, et le nombre de lumières entre dans la CLÉ DE CACHE
     * du programme de chaque matériau. Masquer une lumière via le palier de
     * détail ne fait donc pas que l'éteindre : three.js RECOMPILE tous les
     * programmes de la salle. Or le palier change à la détection du GPU, puis à
     * chaque palier de qualité adaptatif — c'est-à-dire au pire moment, quand la
     * machine est déjà à la limite.
     *
     * Le garde-fou ci-dessous met les intensités à zéro au lieu de masquer, ce
     * qui est gratuit (une uniformes) et ne touche pas à la clé de cache.
     *
     * @param {THREE.Object3D} obj
     * @param {number} minDetail — 0, 1 ou DETAIL_FULL
     */
    _registerDecor(obj, minDetail) {
        if (!obj) return;
        if (obj.isLight) {
            obj.userData.baseIntensity = obj.userData.baseIntensity ?? obj.intensity ?? 0;
            console.warn('[EnvironmentAgent] lumière déclarée en décor :', obj.name || obj.type,
                '— son intensité sera pilotée, jamais masquée (sinon recompilation).');
        }
        this._decor.push({ obj, minDetail });
    }

    /**
     * Applique un palier de détail : masque tout le décor au-dessus du palier.
     * Un objet `visible = false` n'est ni dessiné, ni inclus dans la passe
     * d'ombres, ni testé au raycast — le gain est total, pas seulement visuel.
     *
     * Les lumières font exception : on leur met l'intensité à zéro au lieu de
     * les masquer, pour ne pas provoquer de recompilation (voir `_registerDecor`).
     * @param {number} level
     */
    setDetailLevel(level) {
        this._detailLevel = level;
        for (const { obj, minDetail } of this._decor) {
            if (obj.isLight) {
                obj.intensity = level >= minDetail ? (obj.userData.baseIntensity ?? 0) : 0;
                continue;
            }
            obj.visible = level >= minDetail;
        }
    }

    getDetailLevel() {
        return this._detailLevel;
    }

    /**
     * Traduit un nom de preset qualité en palier de détail.
     * @param {string} presetName
     */
    detailLevelForPreset(presetName) {
        return DETAIL_TIERS[presetName] ?? DETAIL_FULL;
    }

/**
 * Étapes de construction de la salle, une par élément.
 *
 * `enhanceRoom()` appelait ses vingt accesseurs d'affilée dans une seule tâche
 * synchrone : ~110 maillages, ~110 géométries, ~90 matériaux et 9 textures
 * procédurales d'un bloc. C'est le plus long gel du lancement, et il échappait
 * au budget de frame de `TaskScheduler` — un budget ne peut pas couper une tâche
 * qui ne rend pas la main.
 *
 * En exposant chaque accesseur comme une tranche distincte, on laisse le
 * ordonnanceur rendre la main entre deux éléments de la salle. L'ordre est
 * inchangé (les dépendances restent satisfaites).
 *
 * @returns {Array<Function>}
 */
enhanceRoomSteps() {
    return [
        () => this._addWallTextures(),
        () => this._addFloorDetail(),
        () => this._addMedicalPosters(),
        () => this._addIVStand(),
        () => this._addECGMonitor(),
        () => this._addWallECGMonitor(),
        () => this._addCharriot(),
        () => this._addDustParticles(),
        () => this._addMedicineCabinet(),
        () => this._addPottedPlant(),
        () => this._addExaminationBedDetails(),
        () => this._addDaylightWindow(),
        () => this._addCeilingLightPanels(),
        () => this._addWallWainscot(),
        () => this._addBaseboards(),
        () => this._addVitalSignsMonitor(),
        () => this._addWasteBins(),
        () => this._addSinkAccessories(),
        () => this._addWallClock(),
        // Équipements hospitaliers (rampe de gaz, rideau, poste de diagnostic,
        // hygiène, faux plafond technique, occlusion des angles) : une tranche
        // par équipement, pour que l'ordonnanceur puisse rendre la main.
        ...hospitalSteps(this.scene, (obj, tier) => this._registerDecor(obj, tier)),
    ];
}

/**
 * Améliore la salle avec des textures procédurales et des détails
 */
enhanceRoom() {
    for (const step of this.enhanceRoomSteps()) step();
}

    _addWallTextures() {
        // Grain de la peinture en relief. UNE seule texture partagée : le mur
        // droit est maintenant fait de quatre pans (il est percé pour la
        // fenêtre), et générer un canvas de bruit par pan coûtait sept canvas
        // pour un relief identique.
        const bump = this._createNoiseTexture(256, 256, 0.3);
        bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
        bump.repeat.set(6, 3);
        const walls = this.scene.children.filter(c => c.name && c.name.includes('Mur'));
        walls.forEach(wall => {
            if (wall.material) {
                wall.material.bumpMap = bump;
                wall.material.bumpScale = 0.015;
                wall.material.needsUpdate = true;
            }
        });
    }

    _addFloorDetail() {
        // Le sol porte désormais sa brillance dans sa carte de rugosité
        // (matériau à `roughness: 1`, c'est la carte qui décide). L'ancien
        // réglage `roughness = 0.52` multipliait cette carte et rendait le
        // sol miroir. Seule l'intensité du reflet d'environnement est ajustée.
        const floor = this.scene.children.find(c => c.name === 'Sol');
        if (floor && floor.material && 'envMapIntensity' in floor.material) {
            floor.material.envMapIntensity = 0.85;
        }
    }

    _addMedicalPosters() {
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x8a7e6e, roughness: 0.5, metalness: 0.3 });

        // Poster 1: HYGIÈNE DES MAINS (mur gauche, x = -5.5)
        //
        // L'affiche précédente portait un protocole d'ECMO : c'est un document
        // de réanimation, pas de consultation. Celle-ci est le rappel qu'un
        // médecin de ville voit tous les jours — et elle donne une couleur
        // franche à un mur qui est autrement neutre.
        const posterGeom = new THREE.PlaneGeometry(0.6, 0.8);

        const posterTexture = makePosterTextureSalle(
            'HYGIÈNE DES MAINS',
            [
                '#LES 5 INDICATIONS',
                'Avant de toucher le patient',
                'Avant un geste aseptique',
                'Après un risque d\'exposition',
                'Après avoir touché le patient',
                'Après avoir touché son environnement'
            ],
            '#0e7490'
        );
        posterTexture.minFilter = THREE.LinearMipmapLinearFilter;
        posterTexture.magFilter = THREE.LinearFilter;

        // Opaque (pas de cutout : évite le tri transparent coûteux) + polygonOffset anti z-fighting
        const posterMat = new THREE.MeshStandardMaterial({
            map: posterTexture,
            roughness: 0.8,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
        });

        // Frame is centered at x = -5.46 with depth 0.01 (front face at x = -5.455)
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.82, 0.01), frameMat);
        frame.position.set(-5.46, 1.8, -1.2);
        frame.rotation.y = Math.PI / 2;
        this.scene.add(frame);

        // Poster plane is offset in front at x = -5.445 (10mm clear gap from frame face, 5.5cm from wall)
        const poster = new THREE.Mesh(posterGeom, posterMat);
        poster.position.set(-5.445, 1.8, -1.2);
        poster.rotation.y = Math.PI / 2;
        poster.name = 'MedicalPoster';
        poster.userData.label = 'Affiche médicale';
        poster.userData.interactive = true;
        this.scene.add(poster);

        // Poster 2: ANATOMICAL CHART (canvas 512x768 : affiche de 0.6x0.9m vue
        // à plusieurs mètres — 1024x1536 était 4x trop lourde en VRAM/upload)
        const poster2Geom = new THREE.PlaneGeometry(0.6, 0.9);
        const anatomyCanvas = document.createElement('canvas');
        anatomyCanvas.width = 512;
        anatomyCanvas.height = 768;
        const ctxA = anatomyCanvas.getContext('2d');
        ctxA.scale(0.5, 0.5); // dessin codé en 1024x1536, rendu en 512x768
        ctxA.fillStyle = '#fefbf3';
        ctxA.fillRect(0, 0, 1024, 1536);
        ctxA.strokeStyle = '#332211';
        ctxA.lineWidth = 24;
        ctxA.strokeRect(12, 12, 1000, 1512);
        ctxA.strokeStyle = '#554433';
        ctxA.lineWidth = 2;
        ctxA.strokeRect(40, 40, 944, 1456);

        ctxA.fillStyle = '#554433';
        ctxA.font = 'bold 48px monospace';
        ctxA.textAlign = 'center';
        ctxA.fillText("ANATOMIE HUMAINE", 512, 110);
        ctxA.font = '20px monospace';
        ctxA.fillText("SYSTÈME CARDIO-RENAL / CLINIQUE 3D", 512, 150);

        ctxA.strokeStyle = '#b23b3b'; // Red circulation
        ctxA.lineWidth = 4;
        ctxA.beginPath();
        ctxA.lineCap = 'round';
        ctxA.arc(512, 340, 64, 0, Math.PI * 2);
        ctxA.moveTo(512, 404);
        ctxA.lineTo(512, 800);
        for (let r = 460; r < 680; r += 40) {
            ctxA.moveTo(500, r); ctxA.quadraticCurveTo(460, r - 10, 430, r + 16);
            ctxA.moveTo(524, r); ctxA.quadraticCurveTo(564, r - 10, 594, r + 16);
        }
        ctxA.rect(472, 800, 80, 50);
        ctxA.moveTo(512, 440); ctxA.lineTo(340, 560);
        ctxA.moveTo(512, 440); ctxA.lineTo(684, 560);
        ctxA.moveTo(476, 850); ctxA.lineTo(420, 1160);
        ctxA.moveTo(548, 850); ctxA.lineTo(604, 1160);
        ctxA.stroke();

        ctxA.strokeStyle = '#2563eb'; // Blue veins
        ctxA.lineWidth = 3;
        ctxA.beginPath();
        ctxA.moveTo(508, 500);
        ctxA.bezierCurveTo(480, 560, 490, 660, 420, 720);
        ctxA.moveTo(508, 600);
        ctxA.lineTo(360, 550);
        ctxA.stroke();

        ctxA.strokeStyle = '#554433';
        ctxA.lineWidth = 3;
        ctxA.strokeRect(80, 1120, 320, 300);
        ctxA.fillStyle = '#5d4037';
        ctxA.font = 'bold 24px sans-serif';
        ctxA.textAlign = 'left';
        ctxA.fillText("FIG 1. CONFIGURATION", 96, 1156);
        ctxA.font = '18px monospace';
        ctxA.fillText("Aorte ascendante", 96, 1200);
        ctxA.fillText("Ventricule gauche", 96, 1230);
        ctxA.fillText("Oreillette droite", 96, 1260);
        ctxA.fillText("Valvule mitrale", 96, 1290);

        ctxA.strokeStyle = '#b91c1c';
        ctxA.beginPath();
        ctxA.arc(300, 1260, 40, 0, Math.PI * 2);
        ctxA.stroke();

        ctxA.strokeRect(624, 1120, 320, 300);
        ctxA.fillStyle = '#5d4037';
        ctxA.font = 'bold 24px sans-serif';
        ctxA.fillText("FIG 2. FLUX CÉRÉBRAL", 640, 1156);
        ctxA.font = '18px monospace';
        ctxA.fillText("Lobe frontal", 640, 1200);
        ctxA.fillText("Cervelet", 640, 1230);
        ctxA.fillText("Moelle épinière", 640, 1260);
        ctxA.fillText("Cortex sensoriel", 640, 1290);

        ctxA.strokeStyle = '#2563eb';
        ctxA.beginPath();
        ctxA.ellipse(840, 1260, 40, 28, 0, 0, Math.PI * 2);
        ctxA.stroke();

        ctxA.fillStyle = '#1e293b';
        ctxA.font = 'bold 18px sans-serif';
        ctxA.fillText("Boîte Crânienne [1]", 660, 300);
        ctxA.fillText("Sternum [2]", 140, 520);
        ctxA.fillText("Aorte & Valves [3]", 240, 620);
        ctxA.fillText("Fémur [4]", 220, 1020);
        ctxA.fillText("Tibias & Fibula [5]", 660, 1020);

        const anatomyTexture = new THREE.CanvasTexture(anatomyCanvas);
        anatomyTexture.colorSpace = THREE.SRGBColorSpace;
        anatomyTexture.generateMipmaps = true;
        anatomyTexture.minFilter = THREE.LinearMipmapLinearFilter;
        anatomyTexture.magFilter = THREE.LinearFilter;

        const poster2Mat = new THREE.MeshStandardMaterial({
            map: anatomyTexture,
            roughness: 0.8,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
        });

        // Frame2 centered at x = -5.46
        const frame2 = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.92, 0.01), frameMat);
        frame2.position.set(-5.46, 1.8, -2.4);
        frame2.rotation.y = Math.PI / 2;
        this.scene.add(frame2);

        // Poster 2 plane offset in front at x = -5.445
        const poster2 = new THREE.Mesh(poster2Geom, poster2Mat);
        poster2.position.set(-5.445, 1.8, -2.4);
        poster2.rotation.y = Math.PI / 2;
        poster2.name = 'AnatomicalPoster';
        poster2.userData.label = 'Affiche médicale';
        poster2.userData.interactive = true;
        this.scene.add(poster2);
    }

    // ===== PERFUSION (IV STAND) =====
    _addIVStand() {
        const ivGroup = new THREE.Group();
        ivGroup.position.set(5.2, 0, -0.4); // Placed at head side of right bed (after 180 rotation)
        ivGroup.name = 'IVStand';
        ivGroup.userData.label = 'Perfusion';
        ivGroup.userData.interactive = true;

        const metalMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.7, roughness: 0.25 });

        // Pied à 5 branches
        const footRadius = 0.22;
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, footRadius * 0.8), poleMat);
            arm.position.set(Math.cos(angle) * footRadius * 0.4, 0.02, Math.sin(angle) * footRadius * 0.4);
            arm.rotation.y = -angle;
            arm.castShadow = true;
            ivGroup.add(arm);
            // Roulette
            const wheel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.02, 0.02, 0.012, 10),
                new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.15 })
            );
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(Math.cos(angle) * footRadius * 0.75, 0.01, Math.sin(angle) * footRadius * 0.75);
            ivGroup.add(wheel);
        }

        // Tube vertical principal
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 1.7, 10), poleMat);
        pole.position.y = 0.87;
        pole.castShadow = true;
        ivGroup.add(pole);

        // Porte-sérum supérieur (crochet)
        const hookTop = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.005, 6, 12), metalMat);
        hookTop.position.y = 1.72;
        hookTop.rotation.x = Math.PI / 4;
        ivGroup.add(hookTop);

        // Poche de perfusion (sérum)
        const bagMat = new THREE.MeshStandardMaterial({
            color: 0xddeeff,
            transparent: true,
            opacity: 0.75,
            roughness: 0.1,
            metalness: 0.0,
            emissive: 0x4488cc,
            emissiveIntensity: 0.05,
            side: THREE.DoubleSide
        });
        const bag = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.03), bagMat);
        bag.position.set(0, 1.58, 0);
        bag.name = 'IVBag';
        ivGroup.add(bag);

        // Étiquette
        const labelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
        const label = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.032), labelMat);
        label.position.set(0, 1.53, 0);
        ivGroup.add(label);

        // Port bas
        const portMat = new THREE.MeshStandardMaterial({ color: 0x88bbdd, roughness: 0.3, metalness: 0.2 });
        const portCone = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.02, 8), portMat);
        portCone.position.set(0, 1.52, 0);
        portCone.rotation.x = Math.PI;
        ivGroup.add(portCone);

        // Tuyau descendant
        const tubePoints = [
            new THREE.Vector3(0, 1.52, 0),
            new THREE.Vector3(0.01, 1.42, 0),
            new THREE.Vector3(-0.005, 1.30, 0.01),
            new THREE.Vector3(0.005, 1.18, -0.005),
            new THREE.Vector3(0, 1.05, 0),
        ];
        const tubeCurve = new THREE.CatmullRomCurve3(tubePoints);
        const tube = new THREE.Mesh(
            new THREE.TubeGeometry(tubeCurve, 16, 0.003, 6, false),
            new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2, metalness: 0.0, transparent: true, opacity: 0.85 })
        );
        ivGroup.add(tube);

        // Chambre de goutte
        const chamberMat = new THREE.MeshStandardMaterial({
            color: 0xddeeff,
            transparent: true,
            opacity: 0.5,
            roughness: 0.05,
            metalness: 0.1,
            side: THREE.DoubleSide
        });
        const chamber = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 8), chamberMat);
        chamber.position.set(0, 1.28, 0);
        chamber.name = 'IVChamber';
        ivGroup.add(chamber);

        // Tuyau bas
        const lowTubePoints = [
            new THREE.Vector3(0, 1.05, 0),
            new THREE.Vector3(-0.05, 0.85, -0.1),
            new THREE.Vector3(-0.15, 0.65, -0.2),
            new THREE.Vector3(-0.3, 0.45, -0.4),
        ];
        const lowCurve = new THREE.CatmullRomCurve3(lowTubePoints);
        const lowTube = new THREE.Mesh(
            new THREE.TubeGeometry(lowCurve, 12, 0.003, 6, false),
            new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2, transparent: true, opacity: 0.85 })
        );
        ivGroup.add(lowTube);

        // Molette
        const rollerMat = new THREE.MeshStandardMaterial({ color: 0x446688, roughness: 0.3, metalness: 0.4 });
        const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.015, 10), rollerMat);
        roller.position.set(0.02, 0.95, 0);
        roller.rotation.x = Math.PI / 2;
        ivGroup.add(roller);

        this.scene.add(ivGroup);
        this.ivGroup = ivGroup;

        ivGroup.traverse((child) => {
            if (child.isMesh) {
                child.userData.interactive = true;
                child.userData.label = 'Perfusion';
            }
        });
    }

    // ===== MONITEUR ECG SUR PIED =====
    _addECGMonitor() {
        const ecgGroup = new THREE.Group();
        ecgGroup.position.set(3.8, 0, -0.4); // Head side of right bed (after 180 rotation)
        ecgGroup.name = 'ECGMonitor';
        ecgGroup.userData.label = 'Moniteur ECG';
        ecgGroup.userData.interactive = true;

        const metalMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.7, roughness: 0.25 });

        // Pied
        const footRadius = 0.2;
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, footRadius * 0.7), metalMat);
            arm.position.set(Math.cos(angle) * footRadius * 0.35, 0.02, Math.sin(angle) * footRadius * 0.35);
            arm.rotation.y = -angle;
            arm.castShadow = true;
            ecgGroup.add(arm);
            const wheel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.018, 0.018, 0.014, 10),
                new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.1 })
            );
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(Math.cos(angle) * footRadius * 0.7, 0.01, Math.sin(angle) * footRadius * 0.7);
            ecgGroup.add(wheel);
        }

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 1.3, 10), metalMat);
        pole.position.y = 0.67;
        pole.castShadow = true;
        ecgGroup.add(pole);

        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.15), metalMat);
        arm.position.set(0, 1.25, 0.06);
        ecgGroup.add(arm);

        const neckCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 1.25, 0.13),
            new THREE.Vector3(0, 1.28, 0.17),
            new THREE.Vector3(0, 1.30, 0.22),
        ]);
        const neckTube = new THREE.Mesh(
            new THREE.TubeGeometry(neckCurve, 8, 0.012, 6, false),
            metalMat
        );
        ecgGroup.add(neckTube);

        // Screen
        const ecgCanvas = document.createElement('canvas');
        ecgCanvas.width = 256;
        ecgCanvas.height = 96;
        const ecgCtx = ecgCanvas.getContext('2d');
        ecgCtx.fillStyle = '#001a00';
        ecgCtx.fillRect(0, 0, 256, 96);
        const ecgTexture = new THREE.CanvasTexture(ecgCanvas);
        ecgTexture.minFilter = THREE.LinearFilter;
        ecgTexture.colorSpace = THREE.SRGBColorSpace;

        const ecgShellMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.3 });
        const ecgShell = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.04), ecgShellMat);
        ecgShell.position.set(0, 1.38, 0.22);
        ecgShell.castShadow = true;
        ecgGroup.add(ecgShell);

        // emissiveMap: le tracé ECG animé reste lisible sans éblouir (0.55 < seuil bloom)
        const ecgScreenMat = new THREE.MeshStandardMaterial({
            map: ecgTexture,
            emissive: 0xffffff,
            emissiveMap: ecgTexture,
            emissiveIntensity: 0.55,
            roughness: 0.05
        });
        const ecgScreen = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.005), ecgScreenMat);
        ecgScreen.position.set(0, 1.38, 0.245);
        ecgScreen.name = 'ECGScreen';
        ecgGroup.add(ecgScreen);

        // Buttons
        const btnColors = [0xcc3333, 0x33cc33, 0xffff44, 0x3366ff];
        btnColors.forEach((col, i) => {
            const btn = new THREE.Mesh(
                new THREE.CylinderGeometry(0.006, 0.006, 0.004, 8),
                new THREE.MeshStandardMaterial({ color: col, roughness: 0.3, metalness: 0.4, emissive: col, emissiveIntensity: 0.2 })
            );
            btn.rotation.x = Math.PI / 2;
            btn.position.set(-0.1 + i * 0.065, 1.25, 0.235);
            ecgGroup.add(btn);
        });

        // Status LED
        const statusLedMat = new THREE.MeshStandardMaterial({
            color: 0x00ff44,
            emissive: 0x00ff44,
            emissiveIntensity: 1.0,
            roughness: 0.1
        });
        const statusLed = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 4), statusLedMat);
        statusLed.position.set(0.14, 1.45, 0.24);
        ecgGroup.add(statusLed);

        // Patient Cable
        const cableCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 1.22, 0.22),
            new THREE.Vector3(0.2, 1.0, 0.0),
            new THREE.Vector3(0.5, 0.85, -0.2),
            new THREE.Vector3(0.8, 0.82, -0.4),
        ]);
        const cable = new THREE.Mesh(
            new THREE.TubeGeometry(cableCurve, 16, 0.003, 6, false),
            new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.3 })
        );
        ecgGroup.add(cable);

        // Probes
        const probeMat = new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.4, metalness: 0.3 });
        for (let i = 0; i < 3; i++) {
            const probe = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), probeMat);
            probe.position.set(0.75 + i * 0.04, 0.82, -0.4 - i * 0.03);
            ecgGroup.add(probe);
        }

        this._ecgStatusLedMat = statusLedMat;
        this.scene.add(ecgGroup);
        this.ecgScreenMesh = ecgScreen;

        ecgGroup.traverse((child) => {
            if (child.isMesh) {
                child.userData.interactive = true;
                child.userData.label = 'Moniteur ECG';
            }
        });
    }

    // ===== MONITEUR ECG MURAL (on right wall, x = 5.45) =====
    _addWallECGMonitor() {
        const group = new THREE.Group();
        group.position.set(4.0, 2.2, -4.95);
        group.rotation.y = 0; // Lie flush on the back wall
        group.name = 'WallECGMonitor';
        group.userData.label = 'Moniteur ECG mural';
        group.userData.interactive = true;

        const ecgCanvas = document.createElement('canvas');
        ecgCanvas.width = 256;
        ecgCanvas.height = 96;
        const ecgCtx = ecgCanvas.getContext('2d');
        ecgCtx.fillStyle = '#001a00';
        ecgCtx.fillRect(0, 0, 256, 96);
        const ecgTexture = new THREE.CanvasTexture(ecgCanvas);
        ecgTexture.minFilter = THREE.LinearFilter;
        ecgTexture.colorSpace = THREE.SRGBColorSpace;

        const shellMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.3 });
        const shell = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.06), shellMat);
        shell.castShadow = true;
        shell.receiveShadow = true;
        group.add(shell);

        // emissiveMap: tracé mural lisible sans halo (0.55 < seuil bloom)
        const screenMat = new THREE.MeshStandardMaterial({
            map: ecgTexture,
            emissive: 0xffffff,
            emissiveMap: ecgTexture,
            emissiveIntensity: 0.55,
            roughness: 0.05
        });
        const screen = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.29, 0.005), screenMat);
        screen.position.z = 0.035;
        screen.name = 'WallECGScreen';
        group.add(screen);

        const ledMat = new THREE.MeshStandardMaterial({
            color: 0x00ff44,
            emissive: 0x00ff44,
            emissiveIntensity: 1.0,
            roughness: 0.1
        });
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 4), ledMat);
        led.position.set(0.22, 0.16, 0.035);
        group.add(led);

        this.scene.add(group);
        this.wallEcgScreenMesh = screen;
        this._wallEcgLedMat = ledMat;

        group.traverse((child) => {
            if (child.isMesh) {
                child.userData.interactive = true;
                child.userData.label = 'Moniteur ECG mural';
            }
        });
    }

    // ===== CHARRIOT MÉDICAL (placed near foot of right bed) =====
    _addCharriot() {
        const chart = new THREE.Group();
        chart.position.set(3.6, 0, -1.1); // Foot-left side of bed
        chart.name = 'CharriotMedical';
        chart.userData.label = 'Charriot médical';
        chart.userData.interactive = true;

        const frameMat = new THREE.MeshStandardMaterial({ color: 0xc0c8d0, metalness: 0.6, roughness: 0.25 });
        const trayMat = new THREE.MeshStandardMaterial({ color: 0xe8eef0, roughness: 0.4, metalness: 0.15, side: THREE.DoubleSide });
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.15 });

        // 4 colonnes
        const colGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.85, 8);
        const colPositions = [[-0.18, 0.44, -0.14], [0.18, 0.44, -0.14], [-0.18, 0.44, 0.14], [0.18, 0.44, 0.14]];
        colPositions.forEach(([x, y, z]) => {
            const col = new THREE.Mesh(colGeom, frameMat);
            col.position.set(x, y, z);
            col.castShadow = true;
            chart.add(col);
        });

        // Plateau supérieur
        const topTray = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.015, 0.32), trayMat);
        topTray.position.set(0, 0.84, 0);
        topTray.castShadow = true;
        topTray.receiveShadow = true;
        chart.add(topTray);

        // Rebord
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xa0b0c0, metalness: 0.5, roughness: 0.3 });
        const rimFront = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.025, 0.008), rimMat);
        rimFront.position.set(0, 0.86, 0.16);
        chart.add(rimFront);
        const rimBack = rimFront.clone();
        rimBack.position.z = -0.16;
        chart.add(rimBack);
        const rimLeft = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.025, 0.32), rimMat);
        rimLeft.position.set(-0.21, 0.86, 0);
        chart.add(rimLeft);
        const rimRight = rimLeft.clone();
        rimRight.position.x = 0.21;
        chart.add(rimRight);

        // Plateau inférieur
        const bottomTray = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.015, 0.28), trayMat);
        bottomTray.position.set(0, 0.35, 0);
        bottomTray.castShadow = true;
        bottomTray.receiveShadow = true;
        chart.add(bottomTray);

        // Poignée
        const handleCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.18, 0.84, -0.18),
            new THREE.Vector3(-0.18, 0.94, -0.18),
            new THREE.Vector3(0.18, 0.94, -0.18),
            new THREE.Vector3(0.18, 0.84, -0.18),
        ]);
        const handle = new THREE.Mesh(
            new THREE.TubeGeometry(handleCurve, 12, 0.008, 6, false),
            frameMat
        );
        handle.castShadow = true;
        chart.add(handle);

        // 4 roulettes
        const wheelGeom = new THREE.CylinderGeometry(0.025, 0.025, 0.016, 12);
        colPositions.forEach(([x, , z]) => {
            const wheel = new THREE.Mesh(wheelGeom, wheelMat);
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(x, 0.02, z);
            chart.add(wheel);
            const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.04, 6), frameMat);
            axle.rotation.x = Math.PI / 2;
            axle.position.set(x, 0.035, z);
            chart.add(axle);
        });

        // Boîte gants
        const gloveBoxMat = new THREE.MeshStandardMaterial({ color: 0x4488cc, roughness: 0.6, metalness: 0.1 });
        const gloveBox = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.06), gloveBoxMat);
        gloveBox.position.set(0.08, 0.87, 0.05);
        gloveBox.castShadow = true;
        chart.add(gloveBox);

        // Désinfectant
        const bottleMat = new THREE.MeshStandardMaterial({ color: 0xff9933, roughness: 0.4, metalness: 0.15, transparent: true, opacity: 0.85 });
        const bottleBody = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.015, 0.07, 8), bottleMat);
        bottleBody.position.set(-0.08, 0.89, 0.06);
        bottleBody.castShadow = true;
        chart.add(bottleBody);
        const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.012, 8), capMat);
        cap.position.set(-0.08, 0.935, 0.06);
        chart.add(cap);

        // Compresses
        const compressMat = new THREE.MeshStandardMaterial({ color: 0xf0f0e8, roughness: 0.9 });
        const compress = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.05), compressMat);
        compress.position.set(-0.02, 0.86, -0.05);
        compress.rotation.y = 0.2;
        chart.add(compress);

        // --- Fournitures supplémentaires (chariot "plus fourni") ---
        // Boîte de seringues
        const syringeBox = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, 0.03, 0.05),
            new THREE.MeshStandardMaterial({ color: 0xe8f0f8, roughness: 0.5 })
        );
        syringeBox.position.set(0.02, 0.865, 0.1);
        syringeBox.rotation.y = 0.1;
        syringeBox.castShadow = true;
        chart.add(syringeBox);

        // Flacon pompe de gel hydroalcoolique
        const gelMat = new THREE.MeshPhysicalMaterial({
            color: 0x7cc4e8,
            transparent: true,
            opacity: 0.7,
            roughness: 0.15,
            clearcoat: 0.6,
            clearcoatRoughness: 0.2
        });
        const gelBottle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.06, 8), gelMat);
        gelBottle.position.set(-0.13, 0.885, -0.03);
        gelBottle.castShadow = true;
        chart.add(gelBottle);
        const gelPump = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.02, 6), capMat);
        gelPump.position.set(-0.13, 0.925, -0.03);
        chart.add(gelPump);

        // Boîte de pansements
        const bandageBox = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.025, 0.06),
            new THREE.MeshStandardMaterial({ color: 0xf3e2c7, roughness: 0.7 })
        );
        bandageBox.position.set(0.11, 0.862, -0.06);
        bandageBox.rotation.y = -0.18;
        bandageBox.castShadow = true;
        chart.add(bandageBox);

        // Ampoules alignées sur le plateau inférieur
        const ampouleMat = new THREE.MeshPhysicalMaterial({
            color: 0xdfe9f2,
            transparent: true,
            opacity: 0.55,
            roughness: 0.05,
            clearcoat: 0.8
        });
        for (let a = 0; a < 3; a++) {
            const amp = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 6), ampouleMat);
            amp.rotation.z = Math.PI / 2;
            amp.position.set(-0.09 + a * 0.035, 0.37, -0.07);
            chart.add(amp);
        }

        // Masque O2
        const maskMat = new THREE.MeshStandardMaterial({ color: 0x44ccff, transparent: true, opacity: 0.6, roughness: 0.2 });
        const mask = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.05, 8), maskMat);
        mask.position.set(0.05, 0.38, 0);
        mask.rotation.x = Math.PI / 2;
        mask.castShadow = true;
        mask.name = 'MasqueO2';
        mask.userData = { label: 'Masque à Oxygène', interactive: true };
        chart.add(mask);

        this.scene.add(chart);

        chart.traverse((child) => {
            if (child.isMesh) {
                child.userData.interactive = true;
                if (child.name !== 'MasqueO2') {
                    child.userData.label = 'Charriot médical';
                }
            }
        });
    }
    // ===== PARTICULES DE POUSSIÈRE (120 : 200 était trop dense à dessiner) =====
    _addDustParticles() {
        // Poussière en suspension : UNIQUEMENT dans le rai de soleil, là où
        // l'œil la voit vraiment. Les 120 points répartis dans toute la pièce
        // de l'ancienne version se lisaient comme de la neige.
        const dustCount = 45;
        const dustGeom = new THREE.BufferGeometry();
        const dustPositions = new Float32Array(dustCount * 3);
        const wallX = ROOM.width / 2;
        for (let i = 0; i < dustCount; i++) {
            const t = Math.random();
            dustPositions[i * 3] = wallX - 0.2 - 3.0 * t;
            dustPositions[i * 3 + 1] = 1.9 - 1.5 * t + (Math.random() - 0.5) * 0.7;
            dustPositions[i * 3 + 2] = WINDOW.centerZ + (Math.random() - 0.5) * WINDOW.width * 0.9;
        }
        dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
        const dustMat = new THREE.PointsMaterial({
            color: 0xfff3dc,
            size: 0.008,
            transparent: true,
            opacity: 0.45,
            sizeAttenuation: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const dustParticles = new THREE.Points(dustGeom, dustMat);
        dustParticles.name = 'DustParticles';
        dustParticles.visible = !ThreeEnvironmentAgent._isNight();
        this.scene.add(dustParticles);
        this.dustParticles = dustParticles;
        if (dustParticles.visible) this._registerDecor(dustParticles, 2);
    }

    // ===== STATION C: GLASS MEDICINE CABINET ('Armoire') =====
    _addMedicineCabinet() {
        // Armoire à pharmacie de service : caisson laqué blanc de 2,05 m
        // (l'ancienne faisait 2,90 m, plus haute qu'une porte), partie haute
        // vitrée sur étagères, partie basse pleine à portes. Les boîtes de
        // médicaments sont des boîtes blanches à bandeau de couleur, comme
        // les conditionnements hospitaliers — pas des cylindres métallisés.
        const cabinetGroup = new THREE.Group();
        cabinetGroup.position.set(2.45, 0, -4.6);
        cabinetGroup.name = 'Armoire';
        cabinetGroup.userData.label = 'Armoire';
        cabinetGroup.userData.interactive = true;

        const W = 1.2, H = 2.05, D = 0.5;
        const lacquer = new THREE.MeshStandardMaterial({ color: '#f3f4f2', roughness: 0.32, envMapIntensity: 0.8 });
        const inner = new THREE.MeshStandardMaterial({ color: '#e8ebea', roughness: 0.7 });
        const chrome = new THREE.MeshStandardMaterial({ color: '#cfd4d8', metalness: 0.9, roughness: 0.2 });

        // Caisson : fond, flancs, dessus, socle — ouvert devant pour qu'on voie
        // l'intérieur à travers les vitres.
        const part = (w, h, d, x, y, z, mat = lacquer) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            m.position.set(x, y, z);
            m.castShadow = true;
            m.receiveShadow = true;
            cabinetGroup.add(m);
            return m;
        };
        part(W, H, 0.02, 0, H / 2, -D / 2 + 0.01, inner);
        part(0.025, H, D, -W / 2 + 0.0125, H / 2, 0);
        part(0.025, H, D, W / 2 - 0.0125, H / 2, 0);
        part(W, 0.03, D, 0, H - 0.015, 0);
        part(W - 0.05, 0.08, D - 0.04, 0, 0.04, -0.01, new THREE.MeshStandardMaterial({ color: '#9aa09c', roughness: 0.6 }));

        // Partie basse : deux portes pleines + poignées barre.
        const lowH = 0.85;
        for (const s of [-1, 1]) {
            part(W / 2 - 0.03, lowH - 0.1, 0.022, s * (W / 4), 0.08 + (lowH - 0.1) / 2 + 0.01, D / 2 - 0.011);
            const hdl = part(0.012, 0.16, 0.02, s * 0.04, lowH - 0.12, D / 2 + 0.012, chrome);
            hdl.castShadow = false;
        }
        // Tablette de séparation.
        part(W - 0.05, 0.025, D - 0.03, 0, lowH, 0);

        // Étagères vitrées et conditionnements (aléa à graine fixe : l'armoire
        // est la même à chaque partie).
        let seed = 12345;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        const stripes = ['#2f7fbf', '#d0553f', '#3f9a5d', '#e2a03a', '#7b5aa6', '#2aa3a3'];
        const boxWhite = new THREE.MeshStandardMaterial({ color: '#f7f7f5', roughness: 0.6 });
        const stripeMats = stripes.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }));
        const shelfMat = new THREE.MeshStandardMaterial({ color: '#dfe9ec', roughness: 0.15, transparent: true, opacity: 0.55 });
        for (const h of [lowH, 1.2, 1.5, 1.8]) {
            if (h !== lowH) {
                const shelf = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, 0.008, D - 0.06), shelfMat);
                shelf.position.set(0, h, -0.01);
                cabinetGroup.add(shelf);
            }
            if (h >= 1.8) continue;
            let x = -W / 2 + 0.06;
            while (x < W / 2 - 0.1) {
                const bw = 0.05 + rnd() * 0.07, bh = 0.08 + rnd() * 0.12, bd = 0.12 + rnd() * 0.1;
                if (rnd() > 0.12) {
                    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), boxWhite);
                    b.position.set(x + bw / 2, h + bh / 2 + 0.012, -D / 2 + 0.04 + bd / 2);
                    b.castShadow = true;
                    cabinetGroup.add(b);
                    const st = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.001, bh * 0.22, bd + 0.001), stripeMats[(rnd() * stripeMats.length) | 0]);
                    st.position.copy(b.position);
                    st.position.y += bh * 0.25;
                    cabinetGroup.add(st);
                }
                x += bw + 0.008;
            }
        }

        // Portes vitrées hautes : cadre alu + verre très clair.
        const glassMat = new THREE.MeshStandardMaterial({
            color: '#eef6f8', transparent: true, opacity: 0.16, roughness: 0.04,
            metalness: 0.0, envMapIntensity: 1.3, depthWrite: false
        });
        const upH = H - lowH - 0.06;
        for (const s of [-1, 1]) {
            const cx = s * (W / 4);
            const cy = lowH + 0.02 + upH / 2;
            const glass = new THREE.Mesh(new THREE.PlaneGeometry(W / 2 - 0.06, upH - 0.04), glassMat);
            glass.position.set(cx, cy, D / 2 - 0.004);
            cabinetGroup.add(glass);
            part(W / 2 - 0.02, 0.025, 0.02, cx, cy + upH / 2 - 0.0125, D / 2 - 0.004);
            part(W / 2 - 0.02, 0.025, 0.02, cx, cy - upH / 2 + 0.0125, D / 2 - 0.004);
            part(0.025, upH, 0.02, cx - (W / 4 - 0.022), cy, D / 2 - 0.004);
            part(0.025, upH, 0.02, cx + (W / 4 - 0.022), cy, D / 2 - 0.004);
            const hdl = part(0.012, 0.16, 0.02, s * 0.04, lowH + 0.2, D / 2 + 0.012, chrome);
            hdl.castShadow = false;
        }

        // Étiquette « PHARMACIE — Armoire fermée à clé » en façade.
        const lc = document.createElement('canvas');
        lc.width = 256; lc.height = 64;
        const lctx = lc.getContext('2d');
        lctx.fillStyle = '#ffffff'; lctx.fillRect(0, 0, 256, 64);
        lctx.fillStyle = '#0f766e'; lctx.fillRect(0, 0, 10, 64);
        lctx.fillStyle = '#1f2937'; lctx.font = 'bold 26px sans-serif';
        lctx.fillText('PHARMACIE', 22, 30);
        lctx.font = '15px sans-serif'; lctx.fillStyle = '#475569';
        lctx.fillText('Armoire fermée à clé', 22, 52);
        const ltex = new THREE.CanvasTexture(lc);
        ltex.colorSpace = THREE.SRGBColorSpace;
        const label = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.06), new THREE.MeshStandardMaterial({ map: ltex, roughness: 0.6 }));
        label.position.set(-W / 4, lowH - 0.12, D / 2 + 0.002);
        cabinetGroup.add(label);

        cabinetGroup.add(this._contactShadow(W + 0.3, D + 0.35, 0.5));
        this.scene.add(cabinetGroup);

        cabinetGroup.traverse((child) => {
            if (child.isMesh) {
                child.userData.interactive = true;
                child.userData.label = 'Armoire';
            }
        });
    }

    /** Ombre de contact au sol (dégradé radial partagé), pour ancrer un meuble. */
    _contactShadow(w, d, opacity = 0.4) {
        if (!this._contactTex) {
            const c = document.createElement('canvas');
            c.width = c.height = 128;
            const ctx = c.getContext('2d');
            const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
            g.addColorStop(0, 'rgba(10,14,20,1)');
            g.addColorStop(0.55, 'rgba(10,14,20,0.45)');
            g.addColorStop(1, 'rgba(10,14,20,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 128, 128);
            this._contactTex = new THREE.CanvasTexture(c);
        }
        const m = new THREE.Mesh(
            new THREE.PlaneGeometry(w, d),
            new THREE.MeshBasicMaterial({ map: this._contactTex, transparent: true, opacity, depthWrite: false })
        );
        m.rotation.x = -Math.PI / 2;
        m.position.y = 0.027;
        m.renderOrder = 1;
        return m;
    }

    // ===== CORNER DECORATION: Potted Plant =====
    _addPottedPlant() {
        // Plante d'angle : le modèle GLB (feuillage réel) remplace les neuf
        // pavés verts procéduraux, qui se lisaient comme des cartons.
        const plantGroup = new THREE.Group();
        plantGroup.position.set(-4.95, 0, -4.45);
        plantGroup.name = 'PottedPlant';
        loadGLBSmart('assets/models/furniture/Houseplant.glb', (gltf) => {
            const m = gltf.scene;
            m.scale.setScalar(1.15);
            m.rotation.y = 1.3;
            m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
            plantGroup.add(m);
        }, undefined, () => { /* décor : une plante manquante ne casse rien */ });
        this.scene.add(plantGroup);
        this._registerDecor(plantGroup, 1);
    }

    // ===== STATION B DETAILS: Examination Bed structure =====
    // Lit : modèle GLB généré par IA (assets/models/props/lit_examen.glb,
    // 15k tris, textures 512px, Draco) chargé en remplacement du cadre
    // procédural. Les coussins/drap procéduraux sont masqués (le GLB inclut
    // son matelas, calé pour un dessus à ~0.98m comme avant). Repli : si le
    // GLB échoue, l'ancien lit procédural est réaffiché (scène jamais cassée).
    _addExaminationBedDetails() {
        const bedGroup = new THREE.Group();
        bedGroup.position.set(6.0, 0, 0.2); // Right side, shifted due to rotation
        bedGroup.rotation.y = Math.PI; // Pivoter de 180 degrés
        bedGroup.name = 'ExaminationBedDetails';

        // Base steel structure
        const bedFrame = new THREE.Mesh(
            new THREE.BoxGeometry(1.0, 0.82, 2.3),
            new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.7, roughness: 0.3 })
        );
        bedFrame.position.set(1.3, 0.41, 0);
        bedFrame.castShadow = true;
        bedFrame.receiveShadow = true;
        bedGroup.add(bedFrame);

        // cushions (Mint green/Teal)
        const cushionMaterial = new THREE.MeshPhysicalMaterial({
            color: '#0d9488',
            roughness: 0.55,
            metalness: 0.05,
            sheen: 0.4,                    // similicuir médical : reflet rasant doux
            sheenColor: new THREE.Color('#99f6e4'),
            sheenRoughness: 0.6,
            clearcoat: 0.15,
            clearcoatRoughness: 0.4
        });

        const mainCushion = new THREE.Mesh(
            new THREE.BoxGeometry(0.96, 0.16, 1.62),
            cushionMaterial
        );
        mainCushion.position.set(1.3, 0.9, -0.3);
        mainCushion.castShadow = true;
        mainCushion.receiveShadow = true;
        bedGroup.add(mainCushion);

        const headCushion = new THREE.Mesh(
            new THREE.BoxGeometry(0.96, 0.16, 0.64),
            cushionMaterial
        );
        headCushion.position.set(1.3, 1.05, 0.78);
        headCushion.rotation.x = -0.28;
        headCushion.castShadow = true;
        bedGroup.add(headCushion);

        const pillow = new THREE.Mesh(
            new THREE.BoxGeometry(0.72, 0.08, 0.26),
            new THREE.MeshStandardMaterial({ color: '#e9edf1', roughness: 0.9 })
        );
        pillow.position.set(1.3, 1.18, 0.92);
        pillow.rotation.x = -0.28;
        pillow.castShadow = true;
        bedGroup.add(pillow);

        // Paper roll
        const paperRoll = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 0.78, 16),
            new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.9 })
        );
        paperRoll.position.set(1.3, 0.62, 0.9);
        paperRoll.rotation.z = Math.PI / 2;
        paperRoll.castShadow = true;
        bedGroup.add(paperRoll);

        // Drap d'examen mat : zéro émissivité (l'ancien emissiveIntensity
        // + spot 6.5 + bloom = nappe blanche éblouissante de la capture).
        const paperSheet = new THREE.Mesh(
            new THREE.BoxGeometry(0.78, 0.005, 1.5),
            new THREE.MeshStandardMaterial({
                color: '#eef2f5',
                transparent: true,
                opacity: 0.95,
                roughness: 1.0,
                emissive: 0x000000,
                emissiveIntensity: 0
            })
        );
        paperSheet.position.set(1.3, 0.985, -0.15);
        bedGroup.add(paperSheet);

        // Lampe d'examen LED sur pied roulant (type Welch Allyn / Waldmann) :
        // piètement cinq branches, fût, bras articulé, tête plate à LED.
        //
        // AUCUNE SpotLight ici. L'ancienne lampe en posait une, en doublon du
        // spot d'examen de ThreeLightingAgent qui éclaire déjà le lit : une
        // source de plus dans le shader de chaque matériau de la salle, pour
        // un éclairage déjà assuré. La tête porte seulement une couronne
        // émissive, c'est ce que l'œil cherche.
        const medicalLamp = new THREE.Group();
        medicalLamp.position.set(0.55, 0, -1.05);
        const lampWhite = new THREE.MeshStandardMaterial({ color: '#f1f2f1', roughness: 0.35 });
        const lampChrome = new THREE.MeshStandardMaterial({ color: '#d4d8db', metalness: 0.9, roughness: 0.22 });
        const lampDark = new THREE.MeshStandardMaterial({ color: '#2b3036', roughness: 0.6 });
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.26), lampWhite);
            leg.position.set(Math.sin(a) * 0.13, 0.05, Math.cos(a) * 0.13);
            leg.rotation.y = a;
            leg.castShadow = true;
            medicalLamp.add(leg);
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.018, 10), lampDark);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(Math.sin(a) * 0.25, 0.022, Math.cos(a) * 0.25);
            medicalLamp.add(wheel);
        }
        const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 1.3, 12), lampChrome);
        lampPole.position.y = 0.7;
        lampPole.castShadow = true;
        medicalLamp.add(lampPole);
        // Bras articulé (col de cygne gainé noir) vers le lit.
        const neckCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 1.34, 0),
            new THREE.Vector3(0.05, 1.52, 0),
            new THREE.Vector3(0.25, 1.6, 0),
            new THREE.Vector3(0.48, 1.52, 0)
        ]);
        const neck = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 20, 0.011, 8, false), lampDark);
        neck.castShadow = true;
        medicalLamp.add(neck);
        const head = new THREE.Group();
        head.position.set(0.5, 1.48, 0);
        head.rotation.z = -0.5;
        const headShell = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.04, 24), lampWhite);
        headShell.castShadow = true;
        head.add(headShell);
        const ledRing = new THREE.Mesh(
            new THREE.CircleGeometry(0.06, 24),
            new THREE.MeshBasicMaterial({ color: '#fffaf0' })
        );
        ledRing.material.color.setScalar(2.2);
        ledRing.rotation.x = Math.PI / 2;
        ledRing.position.y = -0.021;
        head.add(ledRing);
        medicalLamp.add(head);

        bedGroup.add(medicalLamp);
        this.scene.add(bedGroup);

        // Remplacement du lit procédural par le GLB généré (même transform).
        // Séquence : le lit procédural reste visible TANT QUE le GLB n'est pas
        // là (pas de trou dans la scène), puis on masque cadre + matelas et on
        // ajoute le GLB. En cas d'échec réel, le procédural reste en place.
        // Timeout large : pendant l'init 3D le thread principal est saturé, un
        // seuil de 25 s tombait à faux et déclenchait le repli alors que le
        // GLB arrivait bel et bien ensuite (les deux lits se superposaient).
        const proceduralBed = [bedFrame, mainCushion, headCushion, pillow, paperRoll, paperSheet];
        // URL VERSIONNÉE : le OfflineAssetCache indexe par URL et ne sait pas
// invalider. Sans suffixe, remplacer lit_examen.glb ne change rien pour qui a
// déjà joué — le navigateur ressert l'ancien fichier (avec la dalle de sol)
// depuis le CacheStorage. Le suffixe rend l'URL nouvelle donc le cache inutile.
const LIT_URL = 'assets/models/props/lit_examen.glb?v=20261011-nofloor';
loadGLBSmart(LIT_URL, (gltf) => {
            try {
                const model = gltf.scene;
                // ── Normalisation ────────────────────────────────────────────
                // Le GLB fait 1,874 m de long (X), 0,832 m de large (Z),
                // 1,040 m de haut. Après rotation de 90°, la longueur passe
                // sur l'axe Z local : c'est CET axe qu'il faut caler sur 2,05 m.
                // (Caler X donnait un facteur 2,4× et un lit démesuré.)
                model.rotation.y = Math.PI / 2;
                model.updateMatrixWorld(true);
                const size0 = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
                if (!(size0.z > 0.1 && size0.y > 0.1)) throw new Error('bbox GLB lit invalide');

                const TARGET_LENGTH = 2.05;   // longueur du lit d'examen
                const TARGET_DECK = 0.98;     // dessus du matelas — valeur EXACTE de
                                              // l'ancien lit procédural (mainCushion à
                                              // y=0.90, épaisseur 0.16 → 0.98) : le
                                              // patient garde ainsi son assise d'origine.
                const BASE_Y = 0.02;          // pieds du lit posés au sol

                const sXZ = TARGET_LENGTH / size0.z;
                // Le matelas (Y local ≈ 0,218, base ≈ -0,517) doit tomber à TARGET_DECK.
                const deckLocal = 0.218;
                const baseLocal = -0.517;
                const sY = (TARGET_DECK - BASE_Y) / Math.max(0.01, deckLocal - baseLocal);

                model.scale.set(sXZ, sY, sXZ);
                model.updateMatrixWorld(true);

                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                model.position.x += 1.3 - center.x;   // centré sur l'ancien lit procédural
                model.position.z += -0.05 - center.z;
                model.position.y += BASE_Y - box.min.y; // pieds au sol

                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                model.name = 'LitGenere';
                bedGroup.add(model);
                proceduralBed.forEach((m) => { m.visible = false; }); // le GLB est en place : on masque

                console.info(`[Lit] GLB en place — long ${(size0.z * sXZ).toFixed(2)}m, haut ${(size0.y * sY).toFixed(2)}m`);
            } catch (e) {
                console.warn('[Lit] Normalisation GLB échouée, lit procédural conservé :', e);
            }
        }, undefined, (err) => {
            console.warn('[Lit] Échec GLB, lit procédural conservé :', err);
        }, { timeoutMs: 20000 });
    }

    // ===== DALLES LED DE PLAFOND (éclairage hospitalier) =====
    // Alignées sur les point lights existants (x = ±2.5, z = 0)
    _addCeilingLightPanels() {
        // Dalles LED encastrées 120 × 60 dans le faux plafond. Ce sont elles
        // qu'on voit briller (et se refléter dans le sol ciré) : l'éclairage
        // physique, lui, reste porté par les sources de ThreeLightingAgent.
        //
        // Pas de cône « faisceau » additif sous les dalles : dans une pièce
        // propre et sans fumée, la lumière ne se voit pas dans l'air. Les
        // cônes de l'ancienne version faisaient « boîte de nuit ».
        //
        // Les dalles ne sont PAS du décor : sans elles, la lumière de la salle
        // n'aurait plus d'origine visible. Toutes partagent deux matériaux.
        const y = ROOM.height - 0.004;
        const frameMat = new THREE.MeshStandardMaterial({ color: 0xe9ebec, metalness: 0.5, roughness: 0.35 });
        // `MeshBasicMaterial` avec une couleur > 1 : un blanc qui sature après
        // tone mapping, comme une vraie dalle allumée, sans passer par
        // l'émissif (et sans dépendre de l'éclairage reçu).
        const diffuserMat = new THREE.MeshBasicMaterial({ map: this._ledPanelTexture() });
        diffuserMat.color.setScalar(1.9);
        this._ledDiffuserMat = diffuserMat;

        const positions = [[-3.0, -2.1], [-3.0, 1.5], [0, -2.1], [0, 1.5], [3.0, -2.1], [3.0, 1.5]];
        positions.forEach(([px, pz]) => {
            const panel = new THREE.Group();
            panel.position.set(px, y, pz);
            panel.name = 'CeilingLightPanel'; // non interactif

            const frame = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.012, 0.62), frameMat);
            panel.add(frame);
            const diffuser = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 0.56), diffuserMat);
            diffuser.rotation.x = Math.PI / 2;
            diffuser.position.y = -0.007;
            panel.add(diffuser);
            this.scene.add(panel);
        });
    }

    /** Diffuseur de dalle LED : blanc, bords légèrement plus sombres. */
    _ledPanelTexture() {
        const c = document.createElement('canvas');
        c.width = 128; c.height = 64;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 128, 64);
        const edge = (x0, y0, x1, y1) => {
            const g = ctx.createLinearGradient(x0, y0, x1, y1);
            g.addColorStop(0, 'rgba(150,160,170,0.55)');
            g.addColorStop(1, 'rgba(150,160,170,0)');
            return g;
        };
        ctx.fillStyle = edge(0, 0, 0, 10); ctx.fillRect(0, 0, 128, 10);
        ctx.fillStyle = edge(0, 64, 0, 54); ctx.fillRect(0, 54, 128, 10);
        ctx.fillStyle = edge(0, 0, 10, 0); ctx.fillRect(0, 0, 10, 64);
        ctx.fillStyle = edge(128, 0, 118, 0); ctx.fillRect(118, 0, 10, 64);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }

    // ===== SOUS-BASSEMENT MURAL (wainscot bleu clinique + baguette) =====
    _addWallWainscot() {
        // Protection murale vinyle (vert d'eau pâle) + lisse de protection
        // anti-chocs, sur les QUATRE murs : c'est l'équipement standard d'un
        // service, posé à hauteur de brancard. Interrompue à la porte, à la
        // fenêtre (lisse seulement) et derrière le lavabo (crédence).
        const halfW = ROOM.width / 2 - ROOM.wall / 2;
        const halfL = ROOM.length / 2 - ROOM.wall / 2;
        const H = 0.9;
        const tex = makeWainscotTexture();
        const panelMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, envMapIntensity: 0.6 });
        const railMat = new THREE.MeshStandardMaterial({ color: '#dfe3e2', roughness: 0.38, envMapIntensity: 0.8 });
        const capMat = new THREE.MeshStandardMaterial({ color: '#8fa9a2', roughness: 0.5 });

        // Un pan le long d'un mur. `axis` = axe de la longueur, `n` = normale
        // vers l'intérieur de la pièce (+1/-1), `c` = coordonnée du mur.
        const pieces = [];
        const run = (axis, c, n, from, to, withPanel = true, withRail = true) => {
            const len = to - from;
            if (len <= 0.02) return;
            const mid = (from + to) / 2;
            const place = (mesh, depth, y) => {
                if (axis === 'x') mesh.position.set(mid, y, c + n * depth);
                else mesh.position.set(c + n * depth, y, mid);
                mesh.receiveShadow = true;
                this.scene.add(mesh);
                pieces.push(mesh);
            };
            const geo = (l, h, d) => axis === 'x' ? new THREE.BoxGeometry(l, h, d) : new THREE.BoxGeometry(d, h, l);
            if (withPanel) {
                const t = tex.clone();
                t.repeat.set(len / 1.2, H / 1.2);
                t.needsUpdate = true;
                const m = panelMat.clone();
                m.map = t;
                place(new THREE.Mesh(geo(len, H, 0.006), m), 0.003, H / 2);
                // Profil de finition en tête de panneau.
                place(new THREE.Mesh(geo(len, 0.012, 0.012), capMat), 0.006, H + 0.006);
            }
            if (withRail) {
                // Lisse anti-chocs : profil arrondi en applique.
                const rail = new THREE.Mesh(geo(len, 0.11, 0.035), railMat);
                rail.castShadow = true;
                place(rail, 0.03, H + 0.08);
                const shadowLine = new THREE.Mesh(geo(len, 0.02, 0.012), capMat);
                place(shadowLine, 0.012, H + 0.02);
            }
        };

        const wz0 = WINDOW.centerZ - WINDOW.width / 2 - 0.08;
        const wz1 = WINDOW.centerZ + WINDOW.width / 2 + 0.08;
        // Mur du fond (z = -halfL) : dégage la porte.
        run('x', -halfL, 1, -halfW, -0.95);
        run('x', -halfL, 1, 0.95, halfW);
        // Mur avant (z = +halfL).
        run('x', halfL, -1, -halfW, halfW);
        // Mur droit (x = +halfW) : panneau continu, lisse interrompue à la fenêtre.
        run('z', halfW, -1, -halfL, halfL, true, false);
        run('z', halfW, -1, -halfL, wz0, false, true);
        run('z', halfW, -1, wz1, halfL, false, true);
        // Mur gauche (x = -halfW) : interrompu derrière le lavabo.
        run('z', -halfW, 1, -halfL, 1.78);
        run('z', -halfW, 1, 3.02, halfL);
        run('z', -halfW, 1, 1.78, 3.02, true, false);

        this._wainscot = pieces;
    }

    // ===== FENÊTRE DE JOUR (mur droit) + VUE EXTÉRIEURE + FAISCEAU VOLUMÉTRIQUE =====
    // Ouverture : z ∈ [-3.4, -1.6], y ∈ [1.3, 3.1] — zone libre entre le moniteur vital (z=-0.9)
    // et l'armoire du fond. La key light directionnelle est alignée sur cette fenêtre.
    _addDaylightWindow() {
        const winCenterZ = WINDOW.centerZ;
        const winW = WINDOW.width;
        const winH = WINDOW.top - WINDOW.sill;
        const winCenterY = (WINDOW.top + WINDOW.sill) / 2;
        const wallX = ROOM.width / 2;
        const night = ThreeEnvironmentAgent._isNight();

        // --- Dormant et ouvrant en PVC blanc (les menuiseries d'un hôpital) ---
        const frameMat = new THREE.MeshStandardMaterial({ color: 0xf2f3f2, roughness: 0.35, envMapIntensity: 0.8 });
        const frameT = 0.06;
        const frameD = 0.07;
        const frameParts = [];
        const mkFrame = (w, hgt, pz, py, d = frameD, px = wallX) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(d, hgt, w), frameMat);
            mesh.position.set(px, py, pz);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            frameParts.push(mesh);
            return mesh;
        };
        mkFrame(winW, frameT, winCenterZ, WINDOW.top - frameT / 2);
        mkFrame(winW, frameT, winCenterZ, WINDOW.sill + frameT / 2);
        mkFrame(frameT, winH, winCenterZ - winW / 2 + frameT / 2, winCenterY);
        mkFrame(frameT, winH, winCenterZ + winW / 2 - frameT / 2, winCenterY);
        // Montant central (fenêtre à deux vantaux).
        mkFrame(0.07, winH - frameT * 2, winCenterZ, winCenterY, 0.06);
        // Poignée de crémone.
        const handle = new THREE.Mesh(
            new THREE.BoxGeometry(0.03, 0.12, 0.022),
            new THREE.MeshStandardMaterial({ color: 0xf8f8f8, roughness: 0.3 })
        );
        handle.position.set(wallX - 0.05, winCenterY, winCenterZ + 0.06);
        this.scene.add(handle);
        frameParts.push(handle);

        // --- Vitrage : presque invisible, il ne fait que refléter ---
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0xe8f2f8,
            transparent: true,
            opacity: 0.08,
            roughness: 0.02,
            metalness: 0.0,
            envMapIntensity: 1.2,
            depthWrite: false
        });
        for (const s of [-1, 1]) {
            const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW / 2 - frameT, winH - frameT * 2), glassMat);
            glass.rotation.y = -Math.PI / 2;
            glass.position.set(wallX, winCenterY, winCenterZ + s * winW / 4);
            this.scene.add(glass);
            frameParts.push(glass);
        }

        // --- Tablette intérieure ---
        const sill = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.03, winW + 0.16),
            new THREE.MeshStandardMaterial({ color: 0xf1f1ee, roughness: 0.3, envMapIntensity: 0.6 })
        );
        sill.position.set(wallX - ROOM.wall / 2 - 0.05, WINDOW.sill - 0.015, winCenterZ);
        sill.castShadow = true;
        sill.receiveShadow = true;
        this.scene.add(sill);

        // --- Store enrouleur à mi-hauteur : coffre + toile + barre de charge ---
        const blindDrop = winH * 0.32;
        const cassette = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, 0.09, winW + 0.06),
            new THREE.MeshStandardMaterial({ color: 0xeeeeec, roughness: 0.45 })
        );
        cassette.position.set(wallX - ROOM.wall / 2 - 0.05, WINDOW.top + 0.05, winCenterZ);
        cassette.castShadow = true;
        this.scene.add(cassette);
        const blindTex = makeBlindTexture();
        const bt = blindTex.clone();
        bt.repeat.set(winW / 0.3, blindDrop / 0.3);
        bt.needsUpdate = true;
        const blind = new THREE.Mesh(
            new THREE.PlaneGeometry(winW, blindDrop),
            new THREE.MeshStandardMaterial({ map: bt, roughness: 0.9, side: THREE.DoubleSide })
        );
        blind.rotation.y = -Math.PI / 2;
        blind.position.set(wallX - ROOM.wall / 2 - 0.055, WINDOW.top - blindDrop / 2, winCenterZ);
        blind.castShadow = true;
        this.scene.add(blind);
        const bar = new THREE.Mesh(
            new THREE.BoxGeometry(0.02, 0.025, winW),
            new THREE.MeshStandardMaterial({ color: 0xd8d8d6, metalness: 0.5, roughness: 0.35 })
        );
        bar.position.set(wallX - ROOM.wall / 2 - 0.055, WINDOW.top - blindDrop, winCenterZ);
        this.scene.add(bar);

        // --- Vue extérieure : cour d'hôpital, jour ou garde de nuit ---
        const backdrop = new THREE.Mesh(
            new THREE.PlaneGeometry(16, 8),
            new THREE.MeshBasicMaterial({
                map: makeExteriorViewTexture(night),
                fog: false // le brouillard intérieur ne doit pas délaver le ciel
            })
        );
        // Lumineux mais pas brûlé : le ciel est plus clair que la pièce.
        backdrop.material.color.setScalar(night ? 1.0 : 1.25);
        backdrop.rotation.y = -Math.PI / 2;
        backdrop.position.set(wallX + 4.5, 1.6, winCenterZ - 0.5);
        backdrop.name = 'ExteriorView';
        this.scene.add(backdrop);

        // --- Rai de soleil dans l'air : très discret, de jour seulement ---
        const shaftGeom = new THREE.BoxGeometry(3.4, (winH - blindDrop) * 0.95, winW * 0.9);
        shaftGeom.translate(-1.7, 0, 0);
        const shaft = new THREE.Mesh(shaftGeom, new THREE.MeshBasicMaterial({
            color: 0xfff1d6,
            transparent: true,
            opacity: 0.022,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false
        }));
        shaft.name = 'VolumetricSunlightRay';
        shaft.position.set(wallX, WINDOW.sill + (winH - blindDrop) / 2, winCenterZ);
        shaft.rotation.z = 0.48;
        shaft.visible = !night;
        this.scene.add(shaft);

        for (const o of [...frameParts, sill, backdrop, cassette, blind, bar]) {
            this._registerDecor(o, 0);
        }
        if (!night) this._registerDecor(shaft, 2);
    }

    /** Vrai en garde de nuit (règle unique : ThreeLightingAgent.isNightNow). */
    static _isNight(date = new Date()) {
        return ThreeLightingAgent.isNightNow(date);
    }

    // ===== PLINTHES (finition architecturale au sol) =====
    _addBaseboards() {
        // Remontée en plinthe du sol PVC (« plinthe à gorge ») : le sol se
        // relève sur 10 cm le long des murs, sans joint, pour le nettoyage.
        // Même teinte que le sol, un peu plus sombre.
        const mat = new THREE.MeshStandardMaterial({ color: '#9fa29c', roughness: 0.42, envMapIntensity: 0.6 });
        const halfW = ROOM.width / 2 - ROOM.wall / 2;
        const halfL = ROOM.length / 2 - ROOM.wall / 2;
        const h = 0.1;
        const d = 0.012;
        const parts = [];
        const add = (geo, x, z) => {
            const m = new THREE.Mesh(geo, mat);
            m.position.set(x, h / 2 + 0.025, z);
            m.receiveShadow = true;
            this.scene.add(m);
            parts.push(m);
        };
        const doorL = -0.95, doorR = 0.95;
        add(new THREE.BoxGeometry(doorL + halfW, h, d), (-halfW + doorL) / 2, -halfL + d / 2);
        add(new THREE.BoxGeometry(halfW - doorR, h, d), (halfW + doorR) / 2, -halfL + d / 2);
        add(new THREE.BoxGeometry(halfW * 2, h, d), 0, halfL - d / 2);
        add(new THREE.BoxGeometry(d, h, halfL * 2), halfW - d / 2, 0);
        add(new THREE.BoxGeometry(d, h, halfL * 2), -halfW + d / 2, 0);
    }

    // ===== RECT AREA LIGHT — SUPPRIMÉE =====
    //
    // Il y avait ici une `RectAreaLight` alignée sur les dalles LED, pour un
    // éclairage que la `PointLight` de plafond et l'IBL produisent déjà. Elle
    // était surtout deux fois pénalisante :
    //
    //  1. une `RectAreaLight` ajoute le code LTC (approximation de surface)
    //     dans le fragment shader de TOUS les matériaux Standard/Physical de la
    //     salle — donc dans chacun des dizaines de programmes à compiler ;
    //  2. elle était déclarée en décor de palier 1, donc masquée
    //     (`visible = false`) sur les machines modestes. Or le nombre de
    //     lumières entre dans la clé de cache des programmes : ce changement de
    //     palier déclenchait une RECOMPILATION COMPLETE de la salle, au moment
    //     exact où la machine est déjà saturée. Le gain hoped (alléger le palier
    //     bas) se transformait en gel.
    //
    // La `_addCeilingLightPanels()` ci-dessus garde l'aspect visuel des dalles ;
    // seul l'éclairage physique est porté par les sources de ThreeLightingAgent.

    // ===== MONITEUR MULTIPARAMÉTRIQUE (FC / SpO2 / TA — écho aux constantes de l'UI) =====
    _addVitalSignsMonitor() {
        const vsCanvas = document.createElement('canvas');
        vsCanvas.width = 256;
        vsCanvas.height = 160;
        const vc = vsCanvas.getContext('2d');

        // Fond clinique sombre
        vc.fillStyle = '#081120';
        vc.fillRect(0, 0, 256, 160);
        // Barre de titre
        vc.fillStyle = '#12263f';
        vc.fillRect(0, 0, 256, 22);
        vc.fillStyle = '#7dd3fc';
        vc.font = 'bold 11px sans-serif';
        vc.textAlign = 'left';
        vc.fillText('◉ PATIENT MONITOR — BOX 3', 8, 15);

        // Ligne FC / SpO2
        vc.fillStyle = '#64748b';
        vc.font = '10px sans-serif';
        vc.fillText('FC', 10, 48);
        vc.fillText('SpO₂', 130, 48);
        vc.fillStyle = '#22c55e';
        vc.font = 'bold 30px monospace';
        vc.fillText('72', 34, 52);
        vc.font = '9px sans-serif';
        vc.fillText('bpm', 80, 52);
        vc.fillStyle = '#38bdf8';
        vc.font = 'bold 30px monospace';
        vc.fillText('98', 166, 52);
        vc.font = '9px sans-serif';
        vc.fillText('%', 212, 52);

        // Ligne TA
        vc.fillStyle = '#64748b';
        vc.font = '10px sans-serif';
        vc.fillText('TA', 10, 86);
        vc.fillStyle = '#f59e0b';
        vc.font = 'bold 22px monospace';
        vc.fillText('128/80', 34, 88);
        vc.font = '8px sans-serif';
        vc.fillText('mmHg', 112, 88);

        // Séparateur
        vc.strokeStyle = 'rgba(125, 211, 252, 0.25)';
        vc.lineWidth = 1;
        vc.beginPath();
        vc.moveTo(8, 100);
        vc.lineTo(248, 100);
        vc.stroke();

        // Mini tracé ECG décoratif
        vc.strokeStyle = '#22c55e';
        vc.lineWidth = 1.5;
        vc.beginPath();
        const base = 132;
        for (let x = 8; x <= 248; x += 4) {
            const p = ((x - 8) % 40) / 40;
            let y = 0;
            if (p < 0.1) y = -2 * Math.sin((p / 0.1) * Math.PI);          // onde P
            else if (p >= 0.15 && p < 0.2) y = 3;                          // Q
            else if (p >= 0.2 && p < 0.25) y = -14;                        // R (pic)
            else if (p >= 0.25 && p < 0.3) y = 4;                          // S
            else if (p >= 0.4 && p < 0.55) y = -3 * Math.sin(((p - 0.4) / 0.15) * Math.PI); // onde T
            if (x === 8) vc.moveTo(x, base + y); else vc.lineTo(x, base + y);
        }
        vc.stroke();

        const vsTexture = new THREE.CanvasTexture(vsCanvas);
        vsTexture.colorSpace = THREE.SRGBColorSpace;
        vsTexture.minFilter = THREE.LinearFilter;

        const group = new THREE.Group();
        group.position.set(5.42, 2.05, -0.9); // Mur droit, côté tête du lit
        group.rotation.y = -Math.PI / 2;      // Écran tourné vers la salle (-x)
        group.name = 'VitalSignsMonitor';     // décoratif, non interactif

        const shell = new THREE.Mesh(
            new THREE.BoxGeometry(0.46, 0.32, 0.05),
            new THREE.MeshStandardMaterial({ color: 0x151a20, roughness: 0.35, metalness: 0.4 })
        );
        group.add(shell);

        const screen = new THREE.Mesh(
            new THREE.BoxGeometry(0.42, 0.27, 0.005),
            new THREE.MeshStandardMaterial({
                map: vsTexture,
                emissive: 0xffffff,
                emissiveMap: vsTexture,
                emissiveIntensity: 0.85, // Écran lumineux => fait écho aux constantes de l'UI
                roughness: 0.08
            })
        );
        screen.position.z = 0.028;
        group.add(screen);

        // Bras de fixation murale
        const armMat = new THREE.MeshStandardMaterial({ color: 0x9aa5b1, metalness: 0.8, roughness: 0.25 });
        const wallArm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.1), armMat);
        wallArm.position.set(0, -0.22, -0.04);
        group.add(wallArm);

        this.scene.add(group);
        this._registerDecor(group, 1);
    }

    // ===== POUBELLES : DASRI (jaune) + corbeille classique =====
    _addWasteBins() {
        // --- Poubelle DASRI jaune (déchets de soins) près du chariot ---
        const dasri = new THREE.Group();
        dasri.position.set(3.15, 0, -1.85);
        dasri.name = 'DASRIBin'; // décoratif, non interactif

        const dasriBodyMat = new THREE.MeshPhysicalMaterial({
            color: '#f5c518',
            roughness: 0.4,
            clearcoat: 0.45,
            clearcoatRoughness: 0.3
        });
        const dasriBody = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.135, 0.42, 18), dasriBodyMat);
        dasriBody.position.y = 0.21;
        dasriBody.castShadow = true;
        dasriBody.receiveShadow = true;
        dasri.add(dasriBody);

        const dasriLid = new THREE.Mesh(
            new THREE.CylinderGeometry(0.165, 0.165, 0.05, 18),
            new THREE.MeshPhysicalMaterial({ color: '#d4a017', roughness: 0.45, clearcoat: 0.4 })
        );
        dasriLid.position.y = 0.445;
        dasriLid.castShadow = true;
        dasri.add(dasriLid);

        // Pédale
        const pedal = new THREE.Mesh(
            new THREE.BoxGeometry(0.07, 0.02, 0.05),
            new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 })
        );
        pedal.position.set(0, 0.02, 0.17);
        dasri.add(pedal);

        // Étiquette DASRI
        const dasriCanvas = document.createElement('canvas');
        dasriCanvas.width = 128;
        dasriCanvas.height = 96;
        const dCtx = dasriCanvas.getContext('2d');
        dCtx.fillStyle = '#fefce8';
        dCtx.fillRect(0, 0, 128, 96);
        dCtx.strokeStyle = '#eab308';
        dCtx.lineWidth = 6;
        dCtx.strokeRect(3, 3, 122, 90);
        dCtx.fillStyle = '#111827';
        dCtx.font = 'bold 26px sans-serif';
        dCtx.textAlign = 'center';
        dCtx.fillText('DASRI', 64, 44);
        dCtx.font = '9px sans-serif';
        dCtx.fillText('DÉCHETS DE SOINS', 64, 66);
        const dasriLabelTex = new THREE.CanvasTexture(dasriCanvas);
        dasriLabelTex.colorSpace = THREE.SRGBColorSpace;
        const dasriLabel = new THREE.Mesh(
            new THREE.PlaneGeometry(0.13, 0.1),
            new THREE.MeshStandardMaterial({ map: dasriLabelTex, roughness: 0.6 })
        );
        dasriLabel.position.set(0, 0.26, 0.152);
        dasri.add(dasriLabel);

        this.scene.add(dasri);

        // --- Corbeille classique grise près du bureau ---
        const bin = new THREE.Group();
        bin.position.set(-4.55, 0, 0.55);
        bin.name = 'WasteBin'; // décoratif, non interactif

        const binBody = new THREE.Mesh(
            new THREE.CylinderGeometry(0.14, 0.11, 0.34, 16),
            new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.4, roughness: 0.5 })
        );
        binBody.position.y = 0.17;
        binBody.castShadow = true;
        binBody.receiveShadow = true;
        bin.add(binBody);

        // Sac blanc débordant légèrement
        const bag = new THREE.Mesh(
            new THREE.CylinderGeometry(0.125, 0.13, 0.04, 16),
            new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.85 })
        );
        bag.position.y = 0.35;
        bin.add(bag);

        this.scene.add(bin);
        this._registerDecor(dasri, 1);
        this._registerDecor(bin, 1);
    }

    // ===== ACCESSOIRES D'HYGIÈNE PRÈS DU LAVABO (mur gauche, x = -5.45) =====
    _addSinkAccessories() {
        const accessories = new THREE.Group();
        accessories.name = 'SinkAccessories'; // décoratif, non interactif

        const whitePlastic = new THREE.MeshPhysicalMaterial({
            color: 0xf8fafc,
            roughness: 0.3,
            clearcoat: 0.5,
            clearcoatRoughness: 0.25
        });
        const chrome = new THREE.MeshStandardMaterial({ color: 0xd4d9df, metalness: 1.0, roughness: 0.22 });

        // --- Distributeur de savon mural ---
        const soap = new THREE.Group();
        soap.position.set(-5.42, 1.5, 2.95);
        soap.rotation.y = Math.PI / 2; // Face tournée vers la salle (+x)
        const soapBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.06), whitePlastic);
        soapBody.castShadow = true;
        soap.add(soapBody);
        const soapWindow = new THREE.Mesh(
            new THREE.BoxGeometry(0.03, 0.08, 0.005),
            new THREE.MeshPhysicalMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.6, roughness: 0.1, clearcoat: 0.8 })
        );
        soapWindow.position.set(0, -0.01, 0.031);
        soap.add(soapWindow);
        const soapNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 8), chrome);
        soapNozzle.position.set(0, -0.09, 0.02);
        soapNozzle.rotation.x = Math.PI / 3;
        soap.add(soapNozzle);
        accessories.add(soap);

        // --- Distributeur d'essuie-mains mural ---
        const towel = new THREE.Group();
        towel.position.set(-5.42, 1.52, 1.9);
        towel.rotation.y = Math.PI / 2;
        const towelBody = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.11), whitePlastic);
        towelBody.castShadow = true;
        towel.add(towelBody);
        // Fente de distribution + feuilles visibles
        const slot = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.015, 0.02),
            new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 })
        );
        slot.position.set(0, -0.15, 0.04);
        towel.add(slot);
        const paper = new THREE.Mesh(
            new THREE.BoxGeometry(0.16, 0.05, 0.015),
            new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 })
        );
        paper.position.set(0, -0.18, 0.04);
        towel.add(paper);
        accessories.add(towel);

        // --- Étagère murale au-dessus du lavabo + consommables ---
        const shelf = new THREE.Group();
        shelf.position.set(-5.4, 2.12, 2.4);
        shelf.rotation.y = Math.PI / 2;
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.16), whitePlastic);
        board.castShadow = true;
        board.receiveShadow = true;
        shelf.add(board);
        // Boîte de gants bleue
        const gloves = new THREE.Mesh(
            new THREE.BoxGeometry(0.11, 0.05, 0.07),
            new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.55 })
        );
        gloves.position.set(-0.15, 0.04, 0);
        gloves.castShadow = true;
        shelf.add(gloves);
        // Flacon ambré
        const amberBottle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, 0.09, 10),
            new THREE.MeshPhysicalMaterial({ color: 0xb45309, transparent: true, opacity: 0.85, roughness: 0.15, clearcoat: 0.6 })
        );
        amberBottle.position.set(0.02, 0.055, 0);
        amberBottle.castShadow = true;
        shelf.add(amberBottle);
        // Boîte blanche
        const whiteBox = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.06, 0.06),
            new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.6 })
        );
        whiteBox.position.set(0.16, 0.042, 0);
        whiteBox.rotation.y = 0.2;
        whiteBox.castShadow = true;
        shelf.add(whiteBox);
        accessories.add(shelf);

        this.scene.add(accessories);
        this._registerDecor(accessories, 1);
    }

    // ===== HORLOGE MURALE TEMPS RÉEL (mur du fond) =====
    _addWallClock() {
        const clock = new THREE.Group();
        clock.position.set(2.0, 2.35, -4.93);
        clock.name = 'WallClock'; // décoratif, non interactif

        // Cadran (canvas)
        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = 128;
        faceCanvas.height = 128;
        const fc = faceCanvas.getContext('2d');
        fc.fillStyle = '#f8fafc';
        fc.beginPath();
        fc.arc(64, 64, 62, 0, Math.PI * 2);
        fc.fill();
        fc.strokeStyle = '#1e293b';
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const bold = i % 3 === 0;
            fc.lineWidth = bold ? 4 : 2;
            fc.beginPath();
            fc.moveTo(64 + Math.sin(a) * (bold ? 48 : 52), 64 - Math.cos(a) * (bold ? 48 : 52));
            fc.lineTo(64 + Math.sin(a) * 58, 64 - Math.cos(a) * 58);
            fc.stroke();
        }
        fc.fillStyle = '#1e293b';
        fc.font = 'bold 14px sans-serif';
        fc.textAlign = 'center';
        fc.textBaseline = 'middle';
        fc.fillText('12', 64, 16);
        fc.fillText('3', 112, 64);
        fc.fillText('6', 64, 112);
        fc.fillText('9', 16, 64);

        const faceTex = new THREE.CanvasTexture(faceCanvas);
        faceTex.colorSpace = THREE.SRGBColorSpace;

        // Boîtier + cadran
        const rim = new THREE.Mesh(
            new THREE.TorusGeometry(0.16, 0.018, 8, 32),
            new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 })
        );
        clock.add(rim);
        const back = new THREE.Mesh(
            new THREE.CylinderGeometry(0.16, 0.16, 0.025, 32),
            new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 })
        );
        back.rotation.x = Math.PI / 2;
        back.position.z = -0.012;
        clock.add(back);
        const face = new THREE.Mesh(
            new THREE.CircleGeometry(0.15, 32),
            new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.4 })
        );
        face.position.z = 0.002;
        clock.add(face);

        // Aiguilles (pivot à la base => rotation.z animée dans updateEnvironment)
        const handMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4 });
        const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.003), handMat);
        hourHand.geometry.translate(0, 0.03, 0);
        hourHand.position.z = 0.008;
        clock.add(hourHand);

        const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.095, 0.003), handMat);
        minuteHand.geometry.translate(0, 0.0475, 0);
        minuteHand.position.z = 0.011;
        clock.add(minuteHand);

        const secondHand = new THREE.Mesh(
            new THREE.BoxGeometry(0.003, 0.1, 0.002),
            new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 })
        );
        secondHand.geometry.translate(0, 0.05, 0);
        secondHand.position.z = 0.014;
        clock.add(secondHand);

        // Cache central
        const cap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.008, 0.008, 0.004, 10),
            new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 })
        );
        cap.rotation.x = Math.PI / 2;
        cap.position.z = 0.015;
        clock.add(cap);

        this._clockHands = { hour: hourHand, minute: minuteHand, second: secondHand };
        this.scene.add(clock);
        this._registerDecor(clock, 2);
    }

    /**
     * Retourne le groupe de la perfusion pour l'animateur
     */
    getIVGroup() {
        return this.ivGroup;
    }

    /**
     * Retourne le mesh de l'écran ECG pour l'animateur
     */
    getECGScreenMesh() {
        return this.ecgScreenMesh;
    }

    /**
     * Retourne le système de particules de poussière pour l'animateur
     */
    getDustParticles() {
        return this.dustParticles;
    }

    /**
     * Retourne le mesh de l'écran ECG mural pour l'animateur
     */
    getWallECGScreenMesh() {
        return this.wallEcgScreenMesh;
    }

    /**
     * Met à jour les animations d'environnement (LED ECG, etc.)
     * Appeler dans la boucle de rendu avec le temps elapsed.
     */
    updateEnvironment(elapsed) {
        if (this._ecgStatusLedMat) {
            const t = (elapsed * 1.2) % 1;
            const beat = t < 0.1 ? Math.sin(t / 0.1 * Math.PI) : 0.15;
            this._ecgStatusLedMat.emissiveIntensity = 0.3 + beat * 0.7;
        }
        if (this._wallEcgLedMat) {
            const t = (elapsed * 1.2) % 1;
            const beat2 = t < 0.1 ? Math.sin(t / 0.1 * Math.PI) : 0.15;
            this._wallEcgLedMat.emissiveIntensity = 0.3 + beat2 * 0.7;
        }
        // Horloge murale : aiguilles synchronisées sur l'heure réelle du système.
        // Une horloge n'a que 3 aiguilles : inutile de les recalculer à 60 Hz
        // alors que la trotteuse ne fait un tour qu'en 60 s. Et si elle est
        // masquée par le LOD de détail, on saute complètement le travail.
        if (this._clockHands && this._detailLevel >= 2) {
            const now = new Date();
            const s = now.getSeconds() + now.getMilliseconds() / 1000;
            const m = now.getMinutes() + s / 60;
            const h = (now.getHours() % 12) + m / 60;
            this._clockHands.second.rotation.z = -(s / 60) * Math.PI * 2;
            this._clockHands.minute.rotation.z = -(m / 60) * Math.PI * 2;
            this._clockHands.hour.rotation.z = -(h / 12) * Math.PI * 2;
        }
    }

    _createNoiseTexture(width, height, intensity) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);
        for (let i = 0; i < imageData.data.length; i += 4) {
            const val = Math.random() * 255 * intensity;
            imageData.data[i] = val;
            imageData.data[i + 1] = val;
            imageData.data[i + 2] = val;
            imageData.data[i + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);
        return new THREE.CanvasTexture(canvas);
    }
}