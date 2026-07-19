import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const gltfLoader = new GLTFLoader();
const objLoader = new OBJLoader();

// ============================================================
// TEXTURES PROCÉDURALES (Canvas) — grain bois & micro-bruit
// ============================================================

/**
 * Génère une texture de bois veiné (acajou/noyer) dessinée sur canvas.
 * Évite l'aspect "plastique uni" du plateau de bureau.
 */
function makeWoodTexture() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');

    // Fond : dégradé chaud acajou
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, '#4a3226');
    grad.addColorStop(0.35, '#5c4033');
    grad.addColorStop(0.6, '#6d4f3c');
    grad.addColorStop(1, '#4a3226');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Veines longitudinales du bois
    for (let i = 0; i < 110; i++) {
        const dark = Math.random() > 0.5;
        ctx.strokeStyle = dark ? '#2e1f16' : '#7d5f49';
        ctx.globalAlpha = 0.04 + Math.random() * 0.1;
        ctx.lineWidth = 0.5 + Math.random() * 1.8;
        ctx.beginPath();
        let y = Math.random() * 512;
        ctx.moveTo(0, y);
        for (let x = 0; x <= 512; x += 16) {
            y += (Math.random() - 0.5) * 5;
            ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 3.5);
        }
        ctx.stroke();
    }

    // Quelques nœuds discrets
    ctx.globalAlpha = 1;
    for (let i = 0; i < 5; i++) {
        const nx = Math.random() * 512;
        const ny = Math.random() * 512;
        const r = 6 + Math.random() * 10;
        const rg = ctx.createRadialGradient(nx, ny, 1, nx, ny, r);
        rg.addColorStop(0, 'rgba(46, 31, 22, 0.5)');
        rg.addColorStop(1, 'rgba(46, 31, 22, 0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
        ctx.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}

/**
 * Génère une micro-texture de bruit (bump map) pour simuler le grain
 * des surfaces : peinture satinée, cuir, plastiques texturés.
 */
function makeNoiseBumpTexture(strength = 22, size = 256) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
        const v = 128 + (Math.random() - 0.5) * strength;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

/**
 * Améliore les matériaux d'un modèle GLB/OBJ chargé :
 * réactive l'intensité des réflexions IBL (scene.environment).
 */
function enhanceLoadedMaterials(root) {
    root.traverse((child) => {
        if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            for (const m of mats) {
                if ('envMapIntensity' in m) m.envMapIntensity = 1.0;
                // Si le matériau a un alphaTest agressif (Alpha Clip/Cutout), lisser les bordures via Alpha Blend
                if (m.alphaTest > 0) {
                    m.alphaTest = Math.min(m.alphaTest, 0.02);
                    m.transparent = true;
                }
                if (m.map) {
                    m.map.generateMipmaps = true;
                    m.map.minFilter = THREE.LinearMipmapLinearFilter;
                    m.map.magFilter = THREE.LinearFilter;
                }
                m.needsUpdate = true;
            }
        }
    });
}

function loadFurnitureModel(path, scale, position, rotation, parent, setupCallback) {
    gltfLoader.load(path, (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        enhanceLoadedMaterials(model);
        model.scale.set(scale.x, scale.y, scale.z);
        model.position.set(position.x, position.y, position.z);
        model.rotation.set(rotation.x, rotation.y, rotation.z);
        parent.add(model);
        if (setupCallback) setupCallback(model);
    }, undefined, (err) => {
        console.error(`Erreur de chargement du modèle 3D: ${path}`, err);
    });
}

function loadOBJModel(path, targetHeight, position, rotation, parent, setupCallback) {
    objLoader.load(path, (obj) => {
        obj.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                // Émail blanc médical (finition céramique/poudre) au lieu du gris "plastique"
                child.material = new THREE.MeshPhysicalMaterial({
                    color: 0xe9e7e2,
                    roughness: 0.32,
                    metalness: 0.18,
                    clearcoat: 0.65,
                    clearcoatRoughness: 0.22,
                    envMapIntensity: 0.9
                });
            }
        });
        // Auto-scale based on bounding box
        const box = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        box.getSize(size);
        const currentHeight = size.y || 1;
        const scaleFactor = targetHeight / currentHeight;
        obj.scale.set(scaleFactor, scaleFactor, scaleFactor);

        obj.position.set(position.x, position.y, position.z);
        obj.rotation.set(rotation.x, rotation.y, rotation.z);
        parent.add(obj);
        if (setupCallback) setupCallback(obj);
    }, undefined, (err) => {
        console.error(`Erreur de chargement du modèle OBJ: ${path}`, err);
    });
}

/**
 * Fabrique de matériaux — rétrocompatible avec l'ancienne signature.
 * Options supplémentaires prises en charge :
 *  - physical : force un MeshPhysicalMaterial (clearcoat, sheen...)
 *  - clearcoat / clearcoatRoughness : vernis (meubles laqués, céramique, métal poli)
 *  - sheen / sheenColor / sheenRoughness : tissus & cuirs (réflexion rasante douce)
 *  - map / bumpMap / bumpScale / envMapIntensity
 */
export function createMaterial(color, opts = {}) {
    const wantsPhysical = opts.physical === true
        || opts.clearcoat !== undefined
        || opts.sheen !== undefined;

    const params = {
        color,
        roughness: opts.roughness ?? 0.72,
        metalness: opts.metalness ?? 0.05,
        emissive: opts.emissive ?? 0x000000,
        emissiveIntensity: opts.emissiveIntensity ?? 0,
        envMapIntensity: opts.envMapIntensity ?? 1.0
    };
    if (opts.map) params.map = opts.map;
    if (opts.bumpMap) {
        params.bumpMap = opts.bumpMap;
        params.bumpScale = opts.bumpScale ?? 0.1;
    }

    if (wantsPhysical) {
        const mat = new THREE.MeshPhysicalMaterial(params);
        mat.clearcoat = opts.clearcoat ?? 0.0;
        mat.clearcoatRoughness = opts.clearcoatRoughness ?? 0.25;
        if (opts.sheen !== undefined) {
            mat.sheen = opts.sheen;
            mat.sheenRoughness = opts.sheenRoughness ?? 0.55;
            if (opts.sheenColor) mat.sheenColor = new THREE.Color(opts.sheenColor);
        }
        return mat;
    }
    return new THREE.MeshStandardMaterial(params);
}

export function box(scene, size, position, material, name, interactive = false) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (name) {
        mesh.name = name;
        mesh.userData.label = name;
        mesh.userData.interactive = interactive;
    }
    scene.add(mesh);
    return mesh;
}

/**
 * Variante de `box()` avec arêtes adoucies (biseaux discrets).
 * Les chanfreins captent la lumière et donnent une finition "meuble réel".
 * Les métadonnées userData sont posées à l'identique de `box()`.
 */
function roundedBox(scene, size, position, material, name, interactive = false, radius = 0.02) {
    const r = Math.max(0.001, Math.min(radius, size.x / 2 - 0.001, size.y / 2 - 0.001, size.z / 2 - 0.001));
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(size.x, size.y, size.z, 4, r), material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (name) {
        mesh.name = name;
        mesh.userData.label = name;
        mesh.userData.interactive = interactive;
    }
    scene.add(mesh);
    return mesh;
}

export function buildRoom(scene) {
    const roomWidth = 11;
    const roomLength = 10;
    const roomHeight = 5;

    // A. Granite Tile Floor Texture
    const textureLoader = new THREE.TextureLoader();
    const floorMap = textureLoader.load('assets/textures/granite_tile_1k/textures/granite_tile_diff_1k.jpg');
    floorMap.wrapS = THREE.RepeatWrapping;
    floorMap.wrapT = THREE.RepeatWrapping;
    floorMap.repeat.set(5, 5);
    floorMap.colorSpace = THREE.SRGBColorSpace; // Interprétation correcte des couleurs (évite le rendu délavé)
    floorMap.anisotropy = 8; // Netteté des carreaux en angle rasant

    const floorAo = textureLoader.load('assets/textures/granite_tile_1k/textures/granite_tile_ao_1k.jpg');
    floorAo.wrapS = THREE.RepeatWrapping;
    floorAo.wrapT = THREE.RepeatWrapping;
    floorAo.repeat.set(5, 5);

    // Granit poli : clearcoat léger pour simuler la vitrification de la pierre
    const floorMat = new THREE.MeshPhysicalMaterial({
        map: floorMap,
        aoMap: floorAo,
        aoMapIntensity: 0.9,
        roughness: 0.22,
        metalness: 0.1,
        clearcoat: 0.35,
        clearcoatRoughness: 0.22,
        envMapIntensity: 0.55 // Reflets mesurés, adaptés à un sol clinique
    });
    box(scene, { x: roomWidth + 0.2, y: 0.05, z: roomLength + 0.2 }, { x: 0, y: 0, z: 0 }, floorMat, 'Sol');

    // B. BACK WALL (z = -5)
    // Peinture clinique satinée : micro-grain en bump + très léger clearcoat
    const wallNoise = makeNoiseBumpTexture(18);
    wallNoise.repeat.set(4, 2);
    const wallMat = new THREE.MeshPhysicalMaterial({
        color: '#f8fafc', // Soft warm white clinical paint
        roughness: 0.85,
        bumpMap: wallNoise,
        bumpScale: 0.08,
        clearcoat: 0.06,
        clearcoatRoughness: 0.7,
        envMapIntensity: 0.25
    });
    box(scene, { x: roomWidth, y: roomHeight, z: 0.1 }, { x: 0, y: roomHeight / 2, z: -roomLength / 2 }, wallMat, 'Mur du fond');

    // D. RIGHT WALL (x = 5.5) — Completely Solid plaster to match the screenshot
    box(scene, { x: 0.1, y: roomHeight, z: roomLength }, { x: roomWidth / 2, y: roomHeight / 2, z: 0 }, wallMat, 'Mur droit');

    // Molding/Trim along top of the walls (from the screenshot)
    // Finition laquée satinée pour capter un léger reflet sous le plafond
    const moldingMat = new THREE.MeshPhysicalMaterial({
        color: 0x242424,
        roughness: 0.5,
        clearcoat: 0.35,
        clearcoatRoughness: 0.35,
        envMapIntensity: 0.5
    });
    box(scene, { x: roomWidth, y: 0.22, z: 0.12 }, { x: 0, y: roomHeight - 0.11, z: -roomLength / 2 + 0.05 }, moldingMat, 'Moulure fond');
    box(scene, { x: 0.12, y: 0.22, z: roomLength }, { x: roomWidth / 2 - 0.05, y: roomHeight - 0.11, z: 0 }, moldingMat, 'Moulure droite');

    // H. Sleek dark floating sink cabinet (Meuble Evier)
    // Laque noire biseautée — les arêtes adoucies accrochent la lumière
    roundedBox(scene, { x: 0.52, y: 0.52, z: 1.1 }, { x: -5.2, y: 0.64, z: 2.4 },
        createMaterial(0x18181b, { physical: true, roughness: 0.3, metalness: 0.15, clearcoat: 0.9, clearcoatRoughness: 0.16, envMapIntensity: 0.85 }),
        'Meuble Evier', true, 0.035);
    // Vasque en céramique blanche brillante
    roundedBox(scene, { x: 0.42, y: 0.05, z: 0.82 }, { x: -5.2, y: 0.9, z: 2.4 },
        createMaterial(0xf8fafc, { physical: true, roughness: 0.12, clearcoat: 1.0, clearcoatRoughness: 0.08, envMapIntensity: 1.0 }),
        'Evier basin', true, 0.02);

    // Robinet 3D Model
    const robinetGroup = new THREE.Group();
    robinetGroup.position.set(-5.35, 0.93, 2.4);
    loadFurnitureModel(
        'assets/models/furniture/Kitchen Sink Faucet.glb',
        { x: 0.6, y: 0.6, z: 0.6 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 }, // Tourné de 90° sens indirect (Math.PI/2 - Math.PI/2 = 0)
        robinetGroup
    );
    scene.add(robinetGroup);

    // Plante au sol à côté de l'évier
    const plantGroup = new THREE.Group();
    plantGroup.position.set(-5.2, 0, 3.2);
    loadFurnitureModel(
        'assets/models/furniture/Houseplant.glb',
        { x: 0.9, y: 0.9, z: 0.9 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        plantGroup
    );
    scene.add(plantGroup);

    // Lotion Bottle 3D Model (Très Petit et déplacé à l'arrière !)
    const lotionGroup = new THREE.Group();
    lotionGroup.position.set(-5.3, 1.1, 2.65); // Placé à l'arrière du lavabo
    loadFurnitureModel(
        'assets/models/furniture/Lotion Bottle Small.glb',
        { x: 0.008, y: 0.008, z: 0.008 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 5 * Math.PI / 4, z: 0 }, // Tourné de 180° (Math.PI/4 + Math.PI = 5*Math.PI/4)
        lotionGroup
    );
    scene.add(lotionGroup);

    // Porte d'entrée 3D (remplace le rideau)
    const doorGroup = new THREE.Group();
    doorGroup.position.set(0, 0, -4.95);
    loadFurnitureModel(
        'assets/models/furniture/Door.glb',
        { x: 0.7, y: 0.7, z: 0.7 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        doorGroup
    );
    doorGroup.name = 'Porte entree';
    doorGroup.userData.label = 'Porte d\'entrée';
    doorGroup.userData.interactive = true;
    scene.add(doorGroup);
}

export function buildFurniture(scene) {
    // ==========================================
    // STATION A: BUREAU DU MÉDECIN (Doctor's Desk)
    // ==========================================
    const deskGroup = new THREE.Group();
    deskGroup.position.set(-3.4, 0, -0.6); // Located left rear side
    deskGroup.name = 'DeskGroup';

    // Fallback desk creation code
    const createProceduralDesk = () => {
        // Main walnut wood tabletop — grain procédural + vernis satiné + biseaux
        const tabletop = new THREE.Mesh(
            new RoundedBoxGeometry(2.4, 0.08, 1.2, 4, 0.02),
            new THREE.MeshPhysicalMaterial({
                map: makeWoodTexture(), // rich mahogany procedural grain
                roughness: 0.34,
                metalness: 0.0,
                clearcoat: 0.55,            // vernis satiné
                clearcoatRoughness: 0.25,
                envMapIntensity: 0.75
            })
        );
        tabletop.position.set(0, 1.4, 0);
        tabletop.castShadow = true;
        tabletop.receiveShadow = true;
        deskGroup.add(tabletop);

        // Heavy slate desk side supports — métal poudré anthracite
        const legMat = new THREE.MeshStandardMaterial({
            color: '#1e293b',
            roughness: 0.42,
            metalness: 0.6,
            envMapIntensity: 0.8
        });
        const leftLeg = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 1.4, 1.1),
            legMat
        );
        leftLeg.position.set(-1.1, 0.7, 0);
        leftLeg.castShadow = true;
        leftLeg.receiveShadow = true;
        deskGroup.add(leftLeg);

        const rightLeg = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 1.4, 1.1),
            legMat
        );
        rightLeg.position.set(1.1, 0.7, 0);
        rightLeg.castShadow = true;
        rightLeg.receiveShadow = true;
        deskGroup.add(rightLeg);
    };

    // Load Doctor Desk model with fallback
    const deskUrl = 'https://cdn.jsdelivr.net/gh/pmndrs/market-assets@master/models/desk/model.gltf';
    let deskCompleted = false;
    const deskTimeoutId = setTimeout(() => {
        if (!deskCompleted) {
            deskCompleted = true;
            console.warn("Timeout loading desk GLTF, using procedural desk.");
            createProceduralDesk();
        }
    }, 5000);

    gltfLoader.load(deskUrl, (gltf) => {
        if (deskCompleted) return;
        deskCompleted = true;
        clearTimeout(deskTimeoutId);

        const model = gltf.scene;
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        enhanceLoadedMaterials(model);

        // Bounding box auto-scale
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const currentHeight = size.y || 1;
        const targetHeight = 1.4;
        const scaleFactor = targetHeight / currentHeight;
        model.scale.set(scaleFactor, scaleFactor, scaleFactor);

        // Center model in X and Z, bottom at y = 0
        const center = new THREE.Vector3();
        box.getCenter(center);
        model.position.x = -center.x * scaleFactor;
        model.position.z = -center.z * scaleFactor;
        model.position.y = -box.min.y * scaleFactor;

        deskGroup.add(model);
        document.dispatchEvent(new CustomEvent('instruments-updated'));
    }, undefined, (err) => {
        if (deskCompleted) return;
        deskCompleted = true;
        clearTimeout(deskTimeoutId);
        console.warn("Failed to load desk GLTF, using procedural desk:", err);
        createProceduralDesk();
    });

    // Slim Computer Monitor (All-in-one style)
    // Aluminium brossé (metalness 1 + roughness modérée => reflets anisotropes crédibles)
    const aluminumMat = new THREE.MeshStandardMaterial({
        color: '#cbd5e1',
        metalness: 1.0,
        roughness: 0.28,
        envMapIntensity: 1.0
    });
    const pcBase = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.03, 0.2),
        aluminumMat
    );
    pcBase.position.set(-0.2, 1.44, -0.1);
    pcBase.castShadow = true;
    deskGroup.add(pcBase);

    const pcStem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.28, 8),
        aluminumMat
    );
    pcStem.position.set(-0.2, 1.58, -0.1);
    pcStem.castShadow = true;
    deskGroup.add(pcStem);

    const pcScreenFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.82, 0.52, 0.04),
        new THREE.MeshPhysicalMaterial({
            color: '#1e293b',
            roughness: 0.35,
            metalness: 0.4,
            clearcoat: 0.5,
            clearcoatRoughness: 0.3
        })
    );
    pcScreenFrame.position.set(-0.2, 1.84, -0.1);
    pcScreenFrame.rotation.y = 0.22; // Slightly angled to doctor
    pcScreenFrame.castShadow = true;
    deskGroup.add(pcScreenFrame);

    // Doctor's Laptop Display Canvas
    const pcCanvas = document.createElement('canvas');
    pcCanvas.width = 256;
    pcCanvas.height = 180;
    const ctxP = pcCanvas.getContext('2d');
    ctxP.fillStyle = '#0f172a'; // Deep clinical dark blue
    ctxP.fillRect(0, 0, 256, 180);
    // Header
    ctxP.fillStyle = '#1e293b';
    ctxP.fillRect(0, 0, 256, 30);
    ctxP.fillStyle = '#06b6d4';
    ctxP.font = 'bold 10px sans-serif';
    ctxP.fillText("✦ MED-OS v3.8 - CONNECTED", 10, 20);
    // Draw graph
    ctxP.strokeStyle = '#38bdf8';
    ctxP.lineWidth = 1.5;
    ctxP.beginPath();
    ctxP.moveTo(10, 90);
    for (let x = 10; x < 150; x += 15) {
        ctxP.lineTo(x, 70 + Math.random() * 40);
    }
    ctxP.stroke();
    // Static fields
    ctxP.fillStyle = '#94a3b8';
    ctxP.font = '9px monospace';
    ctxP.fillText("Patient : HAMDI M.", 10, 130);
    ctxP.fillText("Âge/Sexe : 42 ans / M", 10, 145);
    ctxP.fillText("Tension : 12.8 - OK", 10, 160);
    // Status box
    ctxP.fillStyle = 'rgba(6, 182, 212, 0.1)';
    ctxP.fillRect(160, 45, 86, 115);
    ctxP.strokeStyle = '#06b6d4';
    ctxP.strokeRect(160, 45, 86, 115);
    ctxP.fillStyle = '#38bdf8';
    ctxP.fillText("Vitals Engine", 168, 60);
    ctxP.fillStyle = '#22c55e';
    ctxP.fillText("● SYSTEM REST", 168, 85);
    ctxP.fillText("● CLOUD BACKUP", 168, 105);
    ctxP.fillStyle = '#f1f5f9';
    ctxP.fillText("SYS TEMP: 37°C", 168, 130);
    ctxP.fillText("OXY: 99%", 168, 145);

    const pcTexture = new THREE.CanvasTexture(pcCanvas);

    const pcScreenGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.78, 0.48),
        new THREE.MeshStandardMaterial({
            map: pcTexture,
            emissive: '#38bdf8',
            emissiveIntensity: 0.32,
            roughness: 0.1,
        })
    );
    pcScreenGlow.position.set(-0.2, 1.84, -0.078);
    pcScreenGlow.rotation.y = 0.22;
    pcScreenGlow.name = 'Ordinateur'; // Keep original PC name for interactivity!
    pcScreenGlow.userData.label = 'Ordinateur';
    pcScreenGlow.userData.interactive = true;
    pcScreenGlow.userData.pcAction = 'open';
    deskGroup.add(pcScreenGlow);

    // Thin keyboard — plastique soft-touch avec léger vernis
    const keyboard = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.015, 0.14),
        new THREE.MeshPhysicalMaterial({
            color: '#e2e8f0',
            roughness: 0.3,
            clearcoat: 0.4,
            clearcoatRoughness: 0.35,
            envMapIntensity: 0.7
        })
    );
    keyboard.position.set(-0.15, 1.45, 0.18);
    keyboard.rotation.y = 0.15;
    keyboard.castShadow = true;
    deskGroup.add(keyboard);

    // Tasse de café décorative
    loadFurnitureModel(
        'assets/models/furniture/Coffee cup.glb',
        { x: 0.15, y: 0.15, z: 0.15 },
        { x: 0.2, y: 1.44, z: 0.2 },
        { x: 0, y: 0, z: 0 },
        deskGroup
    );

    // Livres décoratifs 3D
    loadFurnitureModel(
        'assets/models/furniture/Book Stack.glb',
        { x: 0.5, y: 0.5, z: 0.5 },
        { x: 0.68, y: 1.52, z: -0.18 }, // Modifié y de 1.48 à 1.52
        { x: 0, y: -0.12, z: 0 },
        deskGroup
    );

    // Modern Luxury Doctor Chair
    const chairGroup = new THREE.Group();
    chairGroup.position.set(-0.2, 0, 0.65);
    chairGroup.rotation.y = -0.3;

    // Chair metallic legs — chrome poli
    const chromeMat = new THREE.MeshStandardMaterial({
        color: '#cbd5e1',
        metalness: 1.0,
        roughness: 0.22,
        envMapIntensity: 1.1
    });
    const legsBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.62, 8),
        chromeMat
    );
    legsBase.position.set(0, 0.31, 0);
    legsBase.castShadow = true;
    chairGroup.add(legsBase);

    // Five-pointed base (flat cylinder)
    const baseJoints = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.28, 0.03, 5),
        new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4, metalness: 0.35, envMapIntensity: 0.7 })
    );
    baseJoints.position.set(0, 0.05, 0);
    chairGroup.add(baseJoints);

    // Cuir premium : sheen (reflet rasant doux) + micro-grain en bump
    const leatherNoise = makeNoiseBumpTexture(26);
    leatherNoise.repeat.set(3, 3);
    const leatherSeatMat = new THREE.MeshPhysicalMaterial({
        color: '#020617',
        roughness: 0.58,
        metalness: 0.05,
        sheen: 0.55,
        sheenColor: new THREE.Color('#3d4c6d'),
        sheenRoughness: 0.5,
        clearcoat: 0.12,
        clearcoatRoughness: 0.4,
        bumpMap: leatherNoise,
        bumpScale: 0.15,
        envMapIntensity: 0.7
    });

    // Seat cushion
    const seat = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.09, 0.58),
        leatherSeatMat
    );
    seat.position.set(0, 0.66, 0);
    seat.castShadow = true;
    chairGroup.add(seat);

    // Backrest
    const backrest = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.72, 0.08),
        new THREE.MeshPhysicalMaterial({
            color: '#0f172a',
            roughness: 0.62,
            sheen: 0.5,
            sheenColor: new THREE.Color('#3d4c6d'),
            sheenRoughness: 0.55,
            bumpMap: leatherNoise,
            bumpScale: 0.15,
            envMapIntensity: 0.6
        })
    );
    backrest.position.set(0, 1.2, 0.26);
    backrest.castShadow = true;
    chairGroup.add(backrest);

    // Metal backrest brace
    const backBrace = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.72, 0.04),
        chromeMat
    );
    backBrace.position.set(0, 0.85, 0.22);
    chairGroup.add(backBrace);

    deskGroup.add(chairGroup);

    // Add cozy glowing Desk Lamp
    const lampGroup = new THREE.Group();
    lampGroup.position.set(-0.85, 1.44, -0.36);

    // Cozy lamp local yellow light
    const lampLight = new THREE.PointLight('#ffaa44', 1.8, 4.5);
    lampLight.position.set(0, 0.45, 0);
    lampGroup.add(lampLight);

    // Tiny glowing sphere at lamp bulb
    // toneMapped:false => l'ampoule dépasse le seuil du bloom et produit un halo chaud
    const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.024, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#ffeeaa', toneMapped: false })
    );
    bulb.position.set(0, 0.45, 0);
    lampGroup.add(bulb);

    // Modèle 3D de la lampe de bureau
    loadFurnitureModel(
        'assets/models/furniture/Light Desk.glb',
        { x: 0.65, y: 0.65, z: 0.65 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: -Math.PI / 4, z: 0 },
        lampGroup
    );

    deskGroup.add(lampGroup);
    scene.add(deskGroup);

    // ==========================================
    // SITTING AREA: SITTING PATIENT CHAIRS (Fauteuils patients premium)
    // ==========================================
    const patientChairGroup = new THREE.Group();
    patientChairGroup.position.set(-2.6, 0, -2.5);
    loadFurnitureModel(
        'assets/models/furniture/Couch Small.glb',
        { x: 0.45, y: 0.45, z: 0.45 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 }, // Orienté vers le bureau/médecin (+Z)
        patientChairGroup
    );
    scene.add(patientChairGroup);

    const patientChairGroup2 = new THREE.Group();
    patientChairGroup2.position.set(-4.2, 0, -2.5);
    loadFurnitureModel(
        'assets/models/furniture/Couch Small.glb',
        { x: 0.45, y: 0.45, z: 0.45 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 }, // Orienté vers le bureau/médecin (+Z)
        patientChairGroup2
    );
    scene.add(patientChairGroup2);

    // Houseplants removed for cleaner look

    // Removed procedural floor lamp and laser stand for a cleaner look

    // ==========================================
    // STATION C: BALANCE À COLONNE (Column Scale)
    // ==========================================
    const scaleGroup = new THREE.Group();
    scaleGroup.name = 'BalanceColonne';
    scaleGroup.userData.label = 'Balance à colonne';
    scaleGroup.userData.interactive = true;

    // Position: En face du lit du patient (au pied du lit).
    // Lit : x = 4.7, z = 0.2. Pied du lit : z = 1.35.
    // Placement à x = 4.7, y = 0, z = 2.4 (rotation de -pi/2 sur Y).
    loadOBJModel(
        'assets/models/furniture/Scale_LP.obj',
        2.3, // Hauteur cible de 1.6m
        { x: 4.7, y: 0, z: 3 },
        { x: 0, y: -Math.PI / 2, z: 0 },
        scaleGroup
    );
    scene.add(scaleGroup);
}