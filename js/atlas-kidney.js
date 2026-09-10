/**
 * atlas-kidney.js — Module Rein Détaillé 3D pour MedGame
 * Source 3D : HuBMAP / CCF 3D Reference Object Library v1.2 (Visible Human Project) — CC BY 4.0
 * 
 * Gestionnaire autonome :
 * - Chargement local asynchrone des modèles GLB (Homme/Femme, Gauche/Droit)
 * - Auto-centrage et normalisation d'échelle
 * - Matériaux anatomiques distincts par groupe (capsule, hile, cortex, colonnes, médullaire, pyramides, papilles)
 * - Plan de section coronale (clipping plane) dynamique avec curseur de profondeur
 * - Interaction, raycasting et fiches pédagogiques en français
 * - Complément schématique du système pyélocaliciel
 */

let _THREE = null;
let _GLTFLoader = null;

async function getThree() {
    if (!_THREE) {
        _THREE = (typeof window !== 'undefined' && window.THREE) ? window.THREE : await import('three');
    }
    return _THREE;
}

async function getGLTFLoader() {
    if (!_GLTFLoader) {
        const mod = await import('three/addons/loaders/GLTFLoader.js');
        _GLTFLoader = mod.GLTFLoader;
    }
    return _GLTFLoader;
}

// Références vers les fichiers GLB locaux
export const KIDNEY_MODELS = {
    male: {
        left: 'assets/models/rein/VH_M_Kidney_L.glb',
        right: 'assets/models/rein/VH_M_Kidney_R.glb'
    },
    female: {
        left: 'assets/models/rein/VH_F_Kidney_L.glb',
        right: 'assets/models/rein/VH_F_Kidney_R.glb'
    }
};

// Dictionnaire des structures anatomiques rénales
export const KIDNEY_STRUCTURES = {
    capsule: {
        id: 'capsule',
        nameFr: 'Capsule fibreuse rénale',
        nameEn: 'Renal fibrous capsule',
        color: '#8e523f',
        roughness: 0.55,
        metalness: 0.05,
        desc: 'Membrane fibreuse lisse, résistante et inextensible qui tapisse intimement la surface externe du parenchyme rénal. Elle constitue une barrière protectrice contre les traumatismes mécaniques et la dissémination des infections péritonéales.',
        role: 'capsule',
        subgroup: 'Enveloppe'
    },
    hilum: {
        id: 'hilum',
        nameFr: 'Hile rénal',
        nameEn: 'Renal hilum',
        color: '#d1b892',
        roughness: 0.6,
        metalness: 0.04,
        desc: 'Échancrure profonde située sur le bord médial concave du rein. Point d\'entrée et de sortie du pédicule rénal : artère rénale, veine rénale, vaisseaux lymphatiques, plexus nerveux autonome et bassinet (pelvis rénal).',
        role: 'hilum',
        subgroup: 'Pédicule'
    },
    outer_cortex: {
        id: 'outer_cortex',
        nameFr: 'Cortex rénal externe',
        nameEn: 'Renal outer cortex',
        color: '#e28880',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Zone superficielle du parenchyme rénal (épaisseur 1 cm). Elle loge la totalité des glomérules (corpuscules de Malpighi) et les tubules contournés proximaux et distaux. C\'est le siège principal de la filtration glomérulaire et de la sécrétion d\'érythropoïétine (EPO).',
        role: 'cortex',
        subgroup: 'Cortex'
    },
    renal_column: {
        id: 'renal_column',
        nameFr: 'Colonnes rénales (de Bertin)',
        nameEn: 'Renal columns (of Bertin)',
        color: '#c95b54',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Prolongements profonds de la substance corticale qui s\'insinuent entre les pyramides de Malpighi jusqu\'au sinus rénal. Elles renferment les artères et veines interlobaires.',
        role: 'column',
        subgroup: 'Cortex'
    },
    renal_medulla: {
        id: 'renal_medulla',
        nameFr: 'Médullaire rénale',
        nameEn: 'Renal medulla',
        color: '#9e3630',
        roughness: 0.52,
        metalness: 0.05,
        desc: 'Zone profonde du parenchyme rénal organisée en pyramides coniques. Elle contient les anses de Henle et les canaux collecteurs, créant le gradient cortico-papillaire hyperosmotique indispensable à la concentration des urines.',
        role: 'medulla',
        subgroup: 'Médullaire'
    },
    renal_pyramid: {
        id: 'renal_pyramid',
        nameFr: 'Pyramide rénale (de Malpighi)',
        nameEn: 'Renal pyramid (of Malpighi)',
        color: '#753765',
        roughness: 0.48,
        metalness: 0.06,
        desc: 'Formation conique striée de la médullaire (8 à 18 par rein). Sa base repose sur le cortex et son sommet (papille) s\'oriente vers le sinus rénal. Elle achemine l\'urine concentrée à travers les canaux collecteurs de Bellini.',
        role: 'pyramid',
        subgroup: 'Médullaire'
    },
    renal_papilla: {
        id: 'renal_papilla',
        nameFr: 'Papille rénale',
        nameEn: 'Renal papilla',
        color: '#f0db8d',
        roughness: 0.42,
        metalness: 0.05,
        desc: 'Sommet perforé (area cribrosa) de chaque pyramide médullaire. Les tubes collecteurs s\'y abouchent pour déverser l\'urine définitive directement dans la lumière d\'un calice mineur.',
        role: 'papilla',
        subgroup: 'Excrétion'
    }
};

/**
 * Identifie une sous-structure à partir du nom de son nœud glTF.
 * @param {string} nodeName
 * @returns {Object|null}
 */
export function identifyKidneyNode(nodeName) {
    if (!nodeName || typeof nodeName !== 'string') return null;
    const n = nodeName.toLowerCase();

    if (n.includes('capsule')) {
        return { ...KIDNEY_STRUCTURES.capsule, key: 'capsule' };
    }
    if (n.includes('hilum')) {
        return { ...KIDNEY_STRUCTURES.hilum, key: 'hilum' };
    }
    if (n.includes('column')) {
        return { ...KIDNEY_STRUCTURES.renal_column, key: 'renal_column' };
    }
    if (n.includes('outer_cortex') || (n.includes('cortex') && !n.includes('column'))) {
        return { ...KIDNEY_STRUCTURES.outer_cortex, key: 'outer_cortex' };
    }
    if (n.includes('papilla')) {
        const letter = n.match(/_([a-z])$/)?.[1] || '';
        return {
            ...KIDNEY_STRUCTURES.renal_papilla,
            key: letter ? `renal_papilla_${letter}` : 'renal_papilla',
            letter,
            nameFr: letter ? `Papille rénale ${letter.toUpperCase()}` : 'Papille rénale',
            nameEn: letter ? `Renal papilla ${letter.toUpperCase()}` : 'Renal papilla'
        };
    }
    if (n.includes('pyramid')) {
        const letter = n.match(/_([a-z])$/)?.[1] || '';
        return {
            ...KIDNEY_STRUCTURES.renal_pyramid,
            key: letter ? `renal_pyramid_${letter}` : 'renal_pyramid',
            letter,
            nameFr: letter ? `Pyramide de Malpighi ${letter.toUpperCase()}` : 'Pyramide de Malpighi',
            nameEn: letter ? `Renal pyramid ${letter.toUpperCase()}` : 'Renal pyramid'
        };
    }
    if (n.includes('medulla')) {
        return { ...KIDNEY_STRUCTURES.renal_medulla, key: 'renal_medulla' };
    }
    return null;
}

export class KidneyModelManager {
    constructor(opts = {}) {
        this.loader = opts.loader || null;
        this.cache = new Map(); // path -> cloned scene
        this.currentMeshList = [];
        this.clippingEnabled = false;
        this.clipInverted = false;
        this.clipPlaneZ = 0.0;
        this.clipDepthRatio = 0.0; // 0 = rein entier (antérieur), 1 = coupe profonde (postérieur)
        this.capsuleAlphaMode = 'opaque'; // 'opaque' | 'translucent' | 'hidden'
        this.bounds = null;
        this.center = null;
        this.size = null;
        this.clipPlane = null;
        this.THREE = null;
    }

    /**
     * Initialise Three.js et GLTFLoader de manière paresseuse.
     */
    async init() {
        if (!this.THREE) {
            this.THREE = await getThree();
            const LoaderClass = await getGLTFLoader();
            if (!this.loader) {
                this.loader = new LoaderClass();
            }
            this.bounds = new this.THREE.Box3();
            this.center = new this.THREE.Vector3();
            this.size = new this.THREE.Vector3();
            this.clipPlane = new this.THREE.Plane(new this.THREE.Vector3(0, 0, -1), 0);
        }
        return this.THREE;
    }

    /**
     * Charge un modèle de rein en local et configure ses matériaux et son échelle.
     * @param {'male'|'female'} sex 
     * @param {'left'|'right'} side 
     * @returns {Promise<{ root: Object, meshes: Array, bounds: Object, center: Object }>}
     */
    async load(sex = 'male', side = 'left') {
        const THREE = await this.init();
        const sexKey = sex === 'female' ? 'female' : 'male';
        const sideKey = side === 'right' ? 'right' : 'left';
        const url = KIDNEY_MODELS[sexKey][sideKey];

        let gltf;
        if (this.cache.has(url)) {
            gltf = this.cache.get(url);
        } else {
            gltf = await this.loader.loadAsync(url);
            this.cache.set(url, gltf);
        }

        // Cloner la hiérarchie pour manipulation propre
        const root = new THREE.Group();
        root.name = `Kidney_${sexKey}_${sideKey}`;

        const clonedScene = gltf.scene.clone(true);
        root.add(clonedScene);

        // Analyse et calcul des dimensions réelles
        const initialBox = new THREE.Box3().setFromObject(root);
        initialBox.getCenter(this.center);
        initialBox.getSize(this.size);

        // Auto-centrage au repère d'observation (Y = 0.85 m comme l'Atlas)
        // et mise à l'échelle standardisée (hauteur d'environ 0.32 m dans le champ visuel)
        const maxDim = Math.max(this.size.x, this.size.y, this.size.z) || 0.1;
        const targetDim = 0.32;
        const scale = targetDim / maxDim;

        root.scale.setScalar(scale);
        root.position.copy(this.center).multiplyScalar(-scale).add(new THREE.Vector3(0, 0.85, 0));
        root.updateMatrixWorld(true);

        // Mise à jour de la boîte finale
        this.bounds.setFromObject(root);
        this.bounds.getCenter(this.center);
        this.bounds.getSize(this.size);

        // Traitement des maillages et assignation des matériaux différenciés
        this.currentMeshList = [];

        clonedScene.traverse((child) => {
            if (child.isMesh) {
                const info = identifyKidneyNode(child.name) || {
                    id: 'unknown',
                    nameFr: 'Structure rénale',
                    nameEn: 'Renal structure',
                    color: '#c27b72',
                    roughness: 0.5,
                    metalness: 0.05,
                    desc: 'Parenchyme rénal subdivisé.',
                    role: 'parenchyma',
                    subgroup: 'Parenchyme'
                };

                const mat = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(info.color),
                    roughness: info.roughness ?? 0.5,
                    metalness: info.metalness ?? 0.05,
                    side: THREE.DoubleSide,
                    clippingPlanes: (this.clippingEnabled && this.clipPlane) ? [this.clipPlane] : [],
                    clipShadows: true
                });

                if (info.role === 'capsule') {
                    mat.transparent = true;
                    mat.opacity = this.capsuleAlphaMode === 'translucent' ? 0.3 : (this.capsuleAlphaMode === 'hidden' ? 0.0 : 1.0);
                    mat.depthWrite = this.capsuleAlphaMode === 'opaque';
                }

                child.material = mat;
                child.castShadow = true;
                child.receiveShadow = true;

                const item = {
                    mesh: child,
                    mat,
                    info,
                    baseColor: new THREE.Color(info.color),
                    isCapsule: info.role === 'capsule'
                };

                child.userData.kidneyItem = item;
                this.currentMeshList.push(item);
            }
        });

        // Appliquer la position initiale du plan de coupe
        this.updateClipPlane();

        return { root, meshes: this.currentMeshList, bounds: this.bounds, center: this.center };
    }

    /**
     * Active ou désactive le plan de coupe coronale.
     * @param {boolean} enabled 
     */
    setClippingEnabled(enabled) {
        this.clippingEnabled = Boolean(enabled);
        const planes = (this.clippingEnabled && this.clipPlane) ? [this.clipPlane] : [];
        this.currentMeshList.forEach(({ mat }) => {
            mat.clippingPlanes = planes;
            mat.needsUpdate = true;
        });
    }

    /**
     * Inverse le sens de la coupe (antérieur ou postérieur).
     * @param {boolean} [inverted] 
     */
    toggleClipInversion(inverted) {
        if (inverted !== undefined) {
            this.clipInverted = Boolean(inverted);
        } else {
            this.clipInverted = !this.clipInverted;
        }
        this.updateClipPlane();
    }

    /**
     * Définit la profondeur de la coupe (0 = rein entier, 1 = postérieur).
     * @param {number} ratio 
     */
    setClipDepthRatio(ratio) {
        const THREE = this.THREE;
        const clamp = THREE?.MathUtils?.clamp || ((v, min, max) => Math.min(Math.max(v, min), max));
        this.clipDepthRatio = clamp(ratio, 0, 1);

        // Activation ou désactivation dynamique du plan de coupe selon le curseur
        if (this.clipDepthRatio > 0 && !this.clippingEnabled) {
            this.setClippingEnabled(true);
        } else if (this.clipDepthRatio <= 0 && this.clippingEnabled && !this.clipInverted) {
            this.setClippingEnabled(false);
        }

        this.updateClipPlane();
    }

    /**
     * Met à jour l'équation du plan de coupe à partir de la boîte englobante.
     */
    updateClipPlane() {
        if (!this.bounds || !this.clipPlane || this.bounds.isEmpty()) return;
        const THREE = this.THREE;
        const lerp = THREE?.MathUtils?.lerp || ((a, b, t) => a + (b - a) * t);

        // Axe Z = antéro-postérieur
        const zMin = this.bounds.min.z;
        const zMax = this.bounds.max.z;

        // Position absolue du plan sur l'axe Z avec légère marge de sécurité
        const currentZ = lerp(zMax + 0.002, zMin - 0.002, this.clipDepthRatio);
        this.clipPlaneZ = currentZ;

        if (this.clipInverted) {
            // Conserve la face antérieure, coupe la face postérieure
            this.clipPlane.normal.set(0, 0, 1);
            this.clipPlane.constant = -currentZ;
        } else {
            // Conserve la face postérieure, coupe la face antérieure pour révéler l'intérieur
            this.clipPlane.normal.set(0, 0, -1);
            this.clipPlane.constant = currentZ;
        }
    }

    /**
     * Modifie l'opacité de la capsule (opaque, translucide, masquée).
     * @param {'opaque'|'translucent'|'hidden'} mode 
     */
    setCapsuleAlpha(mode) {
        this.capsuleAlphaMode = mode;
        this.currentMeshList.forEach(({ isCapsule, mat }) => {
            if (isCapsule) {
                if (mode === 'translucent') {
                    mat.transparent = true;
                    mat.opacity = 0.28;
                    mat.depthWrite = false;
                } else if (mode === 'hidden') {
                    mat.transparent = true;
                    mat.opacity = 0.0;
                    mat.depthWrite = false;
                } else {
                    mat.transparent = false;
                    mat.opacity = 1.0;
                    mat.depthWrite = true;
                }
                mat.needsUpdate = true;
            }
        });
    }

    /**
     * Met en surbrillance une sous-structure sélectionnée.
     * @param {string|null} selectedId 
     */
    select(selectedId) {
        this.currentMeshList.forEach(({ mesh, mat, baseColor, info }) => {
            const isMatch = selectedId && (mesh.name === selectedId || info.key === selectedId);
            if (isMatch) {
                mat.color.set('#00f2fe');
                mat.emissive.set('#004455');
            } else {
                mat.color.copy(baseColor);
                mat.emissive.set('#000000');
            }
        });
    }

    /**
     * Isole une sous-structure (masque les autres).
     * @param {string|null} selectedId 
     * @param {boolean} isolate 
     */
    setIsolate(selectedId, isolate = false) {
        this.currentMeshList.forEach(({ mesh, info }) => {
            if (!isolate || !selectedId) {
                mesh.visible = true;
            } else {
                mesh.visible = (mesh.name === selectedId || info.key === selectedId);
            }
        });
    }

    /**
     * Libère les ressources du gestionnaire.
     */
    dispose() {
        this.currentMeshList.forEach(({ mat }) => mat?.dispose?.());
        this.currentMeshList = [];
        this.cache.clear();
    }
}
