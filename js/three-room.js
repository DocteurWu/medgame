import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { objLoader, loadGLBSmart } from './three-loaders.js';
import {
    makeFloorTextureSalle,
    makeFloorRoughnessSalle,
    makeWallTextureSalleRepetee,
    makeCeilingTextureSalle,
    RATIO_BANDEAU_MUR,
    LARGEUR_TUILE_MUR
} from './three-room-textures.js';

// ============================================================
// CACHE DE TEXTURES PROCÉDURALES HAUTE FIDÉLITÉ
// ============================================================
const _texCache = new Map();

/**
 * Génère un couple { map, roughnessMap } pour un bois noyer/acajou
 * avec variations de vernis entre les veines.
 */
function getWoodTextures() {
    if (_texCache.has('wood')) return _texCache.get('wood');

    const cDiff = document.createElement('canvas');
    const cRough = document.createElement('canvas');
    cDiff.width = cRough.width = 1024;
    cDiff.height = cRough.height = 1024;
    const ctxD = cDiff.getContext('2d');
    const ctxR = cRough.getContext('2d');

    // Fond chaud noyer clinique
    const grad = ctxD.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, '#422c20');
    grad.addColorStop(0.3, '#583c2c');
    grad.addColorStop(0.65, '#684936');
    grad.addColorStop(1, '#462f23');
    ctxD.fillStyle = grad;
    ctxD.fillRect(0, 0, 1024, 1024);

    // Base roughness (gris moyen = ~0.35)
    ctxR.fillStyle = '#5a5a5a';
    ctxR.fillRect(0, 0, 1024, 1024);

    // Fibres et pores du bois
    for (let i = 0; i < 260; i++) {
        const dark = Math.random() > 0.45;
        ctxD.strokeStyle = dark ? '#2a1a11' : '#7c5c46';
        ctxD.globalAlpha = 0.03 + Math.random() * 0.09;
        ctxD.lineWidth = 0.6 + Math.random() * 2.2;

        ctxR.strokeStyle = dark ? '#888888' : '#404040'; // Veines sombres plus creuses/mates
        ctxR.globalAlpha = 0.08 + Math.random() * 0.12;
        ctxR.lineWidth = ctxD.lineWidth;

        ctxD.beginPath();
        ctxR.beginPath();
        let y = Math.random() * 1024;
        ctxD.moveTo(0, y);
        ctxR.moveTo(0, y);
        const freq = 0.008 + Math.random() * 0.015;
        for (let x = 0; x <= 1024; x += 16) {
            y += (Math.random() - 0.5) * 3.5;
            const py = y + Math.sin(x * freq + i) * 5;
            ctxD.lineTo(x, py);
            ctxR.lineTo(x, py);
        }
        ctxD.stroke();
        ctxR.stroke();
    }

    const map = new THREE.CanvasTexture(cDiff);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;

    const roughnessMap = new THREE.CanvasTexture(cRough);
    roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.anisotropy = 4;

    const res = { map, roughnessMap };
    _texCache.set('wood', res);
    return res;
}

/**
 * Génère une micro-texture de grain (stucco / cuir / peinture clinique)
 */
function makeNoiseBumpTexture(strength = 20, size = 256) {
    const key = `noise_${strength}_${size}`;
    if (_texCache.has(key)) return _texCache.get(key);

    const c = document.createElement('canvas');
    c.width = c.height = size;
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
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    _texCache.set(key, tex);
    return tex;
}

/**
 * Crée une fausse ombre d'occlusion au sol (Contact Shadow) ultra-performante
 * pour ancrer visuellement le mobilier sans coût GPU de raytracing.
 */
function createContactShadow(width, depth, opacity = 0.42) {
    if (!_texCache.has('contact_shadow')) {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
        g.addColorStop(0, 'rgba(10, 15, 25, 1)');
        g.addColorStop(0.55, 'rgba(10, 15, 25, 0.45)');
        g.addColorStop(1, 'rgba(10, 15, 25, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
        _texCache.set('contact_shadow', new THREE.CanvasTexture(c));
    }
    const mat = new THREE.MeshBasicMaterial({
        map: _texCache.get('contact_shadow'),
        transparent: true,
        opacity,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.028;
    mesh.renderOrder = 1;
    return mesh;
}

/**
 * Génère l'interface haute résolution (1024x640) de MED-OS v4.0
 */
function createMedOSTexture() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 640;
    const ctx = c.getContext('2d');

    // Fond sombre clinique
    const bg = ctx.createLinearGradient(0, 0, 0, 640);
    bg.addColorStop(0, '#09101f');
    bg.addColorStop(1, '#0f172a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1024, 640);

    // Topbar
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 1024, 56);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('✦ MED-OS CLINICAL WORKSTATION v4.2', 24, 36);
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('● RPPS CONNECTÉ — CARTE VITALE PRÊTE', 660, 35);

    // Grille de monitoring ECG
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 24; x < 640; x += 24) {
        ctx.beginPath(); ctx.moveTo(x, 80); ctx.lineTo(x, 340); ctx.stroke();
    }
    for (let y = 80; y < 340; y += 24) {
        ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(640, y); ctx.stroke();
    }

    // Tracé ECG réaliste (onde P-QRS-T)
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    const baseY = 210;
    ctx.moveTo(24, baseY);
    for (let cycle = 0; cycle < 4; cycle++) {
        const ox = 24 + cycle * 150;
        ctx.lineTo(ox + 30, baseY);
        ctx.quadraticCurveTo(ox + 42, baseY - 18, ox + 54, baseY); // Onde P
        ctx.lineTo(ox + 64, baseY);
        ctx.lineTo(ox + 70, baseY + 16); // Q
        ctx.lineTo(ox + 78, baseY - 85); // R
        ctx.lineTo(ox + 86, baseY + 28); // S
        ctx.lineTo(ox + 94, baseY);
        ctx.quadraticCurveTo(ox + 114, baseY - 26, ox + 132, baseY); // Onde T
        ctx.lineTo(ox + 150, baseY);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Panneau Dossier Patient (Bas Gauche)
    ctx.fillStyle = 'rgba(30, 41, 59, 0.75)';
    ctx.fillRect(24, 365, 616, 245);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(24, 365, 616, 245);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('DOSSIER PATIENT EN COURS — INTERROGATOIRE ECOS', 44, 402);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px monospace';
    ctx.fillText('▸ Cliquez sur l\'écran pour ouvrir l\'interface de prescription', 44, 445);
    ctx.fillText('▸ Examens complémentaires & Imagerie PACS disponibles', 44, 480);
    ctx.fillText('▸ Grille sémiologique & Constantes dynamiques actives', 44, 515);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('STATUS : EN ATTENTE DE DÉCISION CLINIQUE...', 44, 570);

    // Panneau Constantes (Droite)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(664, 80, 336, 530);
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 2;
    ctx.strokeRect(664, 80, 336, 530);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 54px monospace';
    ctx.fillText('78', 690, 165);
    ctx.font = '20px sans-serif';
    ctx.fillText('BPM (FC)', 780, 155);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 54px monospace';
    ctx.fillText('98%', 690, 275);
    ctx.font = '20px sans-serif';
    ctx.fillText('SpO2', 825, 265);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 46px monospace';
    ctx.fillText('124/78', 690, 385);
    ctx.font = '18px sans-serif';
    ctx.fillText('mmHg', 880, 378);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 44px monospace';
    ctx.fillText('37.1°C', 690, 495);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
}

function enhanceLoadedMaterials(root) {
    root.traverse((child) => {
        if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            for (const m of mats) {
                if ('envMapIntensity' in m) m.envMapIntensity = 1.1;
                if (m.alphaTest > 0) {
                    m.alphaTest = Math.min(m.alphaTest, 0.02);
                    m.transparent = true;
                }
                if (m.map) {
                    m.map.generateMipmaps = true;
                    m.map.minFilter = THREE.LinearMipmapLinearFilter;
                    m.map.magFilter = THREE.LinearFilter;
                    m.map.anisotropy = 4;
                }
                m.needsUpdate = true;
            }
        }
    });
}

function loadFurnitureModel(path, scale, position, rotation, parent, setupCallback, castShadow = true) {
    // loadGLBSmart : cache persistant + timeout + repli réseau. Sans lui, un
    // mobilier dont la requête reste bloquée ne rend jamais la main (ni erreur,
    // ni repli) : la salle reste incomplète sans le moindre signal.
    loadGLBSmart(path, (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = castShadow;
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
        console.warn(`[Mobilier] Échec du chargement GLB: ${path}`, err);
    });
}

function loadOBJModel(path, targetHeight, position, rotation, parent, setupCallback) {
    objLoader.load(path, (obj) => {
        obj.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.material = new THREE.MeshPhysicalMaterial({
                    color: 0xe9e7e2,
                    roughness: 0.28,
                    metalness: 0.22,
                    clearcoat: 0.7,
                    clearcoatRoughness: 0.18,
                    envMapIntensity: 1.0
                });
            }
        });
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

export function createMaterial(color, opts = {}) {
    // ATTENTION — le choix du type de matériau n'est pas cosmétique.
    //
    // `MeshPhysicalMaterial` et `MeshStandardMaterial` produisent DEUX
    // programmes de shader différents dans three.js (`shaderID: 'physical'` vs
    // `'standard'`), même quand aucune feature physical n'est active. Or le
    // nombre de programmes distincts est le coût dominant du chargement : chaque
    // création de programme déclenche un `gl.getProgramInfoLog()` BLOQUANT, et la
    // scène en compte plus d'une centaine.
    //
    // Or `createMaterial({ physical: true })` sans clearcoat ni sheen ne
    // demandait aucune feature physical : le matériau produit était donc
    // visuellement IDENTIQUE à un `MeshStandardMaterial`, pour un programme de
    // shader en plus. D'où la règle : on ne passe en Physical que lorsqu'une
    // feature physical est réellement demandée.
    //
    // `opts.physical` reste lu ci-dessous pour ne pas casser les appelants, mais
    // ne suffit plus à lui seul. `opts.transmission` n'est délibérément plus
    // accepté : voir `_addShaBottle` dans `buildFurniture` — la transmission force
    // `renderTransmissionPass()`, c'est-à-dire un rendu COMPLET de la scène en
    // plus, à chaque image, pour un flacon de 3 cm.
    const wantsPhysical =
        (opts.clearcoat !== undefined && opts.clearcoat > 0)
        || opts.sheen !== undefined
        || opts.ior !== undefined;

    const params = {
        color,
        roughness: opts.roughness ?? 0.68,
        metalness: opts.metalness ?? 0.05,
        emissive: opts.emissive ?? 0x000000,
        emissiveIntensity: opts.emissiveIntensity ?? 0,
        envMapIntensity: opts.envMapIntensity ?? 1.0
    };
    if (opts.map) params.map = opts.map;
    if (opts.roughnessMap) params.roughnessMap = opts.roughnessMap;
    if (opts.bumpMap) {
        params.bumpMap = opts.bumpMap;
        params.bumpScale = opts.bumpScale ?? 0.06;
    }

    if (wantsPhysical) {
        const mat = new THREE.MeshPhysicalMaterial(params);
        mat.clearcoat = opts.clearcoat ?? 0.0;
        mat.clearcoatRoughness = opts.clearcoatRoughness ?? 0.25;
        if (opts.ior !== undefined) mat.ior = opts.ior;
        if (opts.sheen !== undefined) {
            mat.sheen = opts.sheen;
            mat.sheenRoughness = opts.sheenRoughness ?? 0.5;
            if (opts.sheenColor) mat.sheenColor = new THREE.Color(opts.sheenColor);
        }
        return mat;
    }
    return new THREE.MeshStandardMaterial(params);
}

export function box(scene, size, position, material, name, interactive = false, castShadow = true) {
    const geom = new THREE.BoxGeometry(size.x, size.y, size.z);
    if (geom.attributes.uv && !geom.attributes.uv2) {
        geom.setAttribute('uv2', new THREE.BufferAttribute(geom.attributes.uv.array, 2));
    }
    const mesh = new THREE.Mesh(geom, material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    if (name) {
        mesh.name = name;
        mesh.userData.label = name;
        mesh.userData.interactive = interactive;
    }
    scene.add(mesh);
    return mesh;
}

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

    // A. Sol en PVC de salle : dalles de 60 cm collées à chaud, joints
    // soudés, traces de roulettes. La texture est procédurale
    // (js/three-room-textures.js) : un JPEG de granit de 4 Mo ne passerait
    // pas le budget de chargement de la page 3D, et le PVC est plus
    // réaliste qu'un granit dans une salle de consultation.
    const floorMat = new THREE.MeshPhysicalMaterial({
        map: makeFloorTextureSalle(),
        roughnessMap: makeFloorRoughnessSalle(),
        roughness: 0.48,
        metalness: 0.06,
        clearcoat: 0.34,
        clearcoatRoughness: 0.32,
        ior: 1.48,
        envMapIntensity: 0.85
    });
    box(scene, { x: roomWidth + 0.2, y: 0.05, z: roomLength + 0.2 }, { x: 0, y: 0, z: 0 }, floorMat, 'Sol', false, false);

    // B. Murs cliniques à deux tons : vert d'eau en bas (la couleur de
    // l'hôpital), blanc cassé en haut. La texture porte le dégradé vertical,
    // donc elle ne se répète qu'horizontalement.
    const wallMat = new THREE.MeshStandardMaterial({
        map: makeWallTextureSalleRepetee(
            RATIO_BANDEAU_MUR,
            Math.max(1, Math.round(roomWidth / LARGEUR_TUILE_MUR))
        ),
        roughness: 0.86,
        metalness: 0.0,
        envMapIntensity: 0.4
    });
    box(scene, { x: roomWidth, y: roomHeight, z: 0.12 }, { x: 0, y: roomHeight / 2, z: -roomLength / 2 }, wallMat, 'Mur du fond', false, false);
    box(scene, { x: 0.12, y: roomHeight, z: roomLength }, { x: roomWidth / 2, y: roomHeight / 2, z: 0 }, wallMat, 'Mur droit', false, false);
    box(scene, { x: 0.12, y: roomHeight, z: roomLength }, { x: -roomWidth / 2, y: roomHeight / 2, z: 0 }, wallMat, 'Mur gauche', false, false);

    // C. Bandeau de protection murale hospitalier (Acrovyn gris-bleu à mi-hauteur)
    const railMat = createMaterial('#cbd5e1', { physical: true, roughness: 0.4, clearcoat: 0.3 });
    box(scene, { x: roomWidth - 0.1, y: 0.16, z: 0.03 }, { x: 0, y: 1.05, z: -roomLength / 2 + 0.07 }, railMat, 'Main courante fond', false, false);
    box(scene, { x: 0.03, y: 0.16, z: roomLength - 0.1 }, { x: -roomWidth / 2 + 0.07, y: 1.05, z: 0 }, railMat, 'Main courante gauche', false, false);

    // D. Plafond acoustique à dalles percées, avec ossature en T
    const ceilMat = new THREE.MeshStandardMaterial({
        map: makeCeilingTextureSalle(),
        roughness: 0.95,
        metalness: 0.0,
        envMapIntensity: 0.25
    });
    box(scene, { x: roomWidth, y: 0.1, z: roomLength }, { x: 0, y: roomHeight, z: 0 }, ceilMat, 'Plafond', false, false);

    // E. Corniches & Plinthes hospitalières à gorge
    const moldingMat = createMaterial(0x1e293b, { physical: true, roughness: 0.45, clearcoat: 0.35 });
    box(scene, { x: roomWidth, y: 0.18, z: 0.14 }, { x: 0, y: roomHeight - 0.09, z: -roomLength / 2 + 0.05 }, moldingMat, 'Moulure fond', false, false);
    box(scene, { x: 0.14, y: 0.18, z: roomLength }, { x: roomWidth / 2 - 0.05, y: roomHeight - 0.09, z: 0 }, moldingMat, 'Moulure droite', false, false);
    box(scene, { x: 0.14, y: 0.18, z: roomLength }, { x: -roomWidth / 2 + 0.05, y: roomHeight - 0.09, z: 0 }, moldingMat, 'Moulure gauche', false, false);

    // F. Poste de lavage des mains (Lavabo clinique suspendu + Miroir + Crédence)
    roundedBox(scene, { x: 0.54, y: 0.52, z: 1.15 }, { x: -5.2, y: 0.64, z: 2.4 },
        createMaterial(0x18181b, { physical: true, roughness: 0.28, metalness: 0.15, clearcoat: 0.85, clearcoatRoughness: 0.15 }),
        'Meuble Evier', true, 0.035);
    roundedBox(scene, { x: 0.46, y: 0.06, z: 0.92 }, { x: -5.2, y: 0.92, z: 2.4 },
        createMaterial(0xffffff, { physical: true, roughness: 0.08, clearcoat: 1.0, clearcoatRoughness: 0.04, ior: 1.52 }),
        'Evier basin', true, 0.02);

    // Crédence carrelée / miroir au-dessus du lavabo
    roundedBox(scene, { x: 0.02, y: 0.75, z: 0.88 }, { x: -5.42, y: 1.48, z: 2.4 },
        createMaterial(0xe2e8f0, { physical: true, roughness: 0.03, metalness: 0.92, clearcoat: 1.0 }),
        'Miroir Lavabo', false, 0.01);

    const sinkShadow = createContactShadow(0.75, 1.35, 0.35);
    sinkShadow.position.set(-5.15, 0.028, 2.4);
    scene.add(sinkShadow);

    const robinetGroup = new THREE.Group();
    robinetGroup.position.set(-5.35, 0.95, 2.4);
    loadFurnitureModel('assets/models/furniture/Kitchen Sink Faucet.glb', { x: 0.6, y: 0.6, z: 0.6 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, robinetGroup);
    scene.add(robinetGroup);

    // Plante au sol avec ombre de contact
    const plantGroup = new THREE.Group();
    plantGroup.position.set(-5.1, 0, 3.4);
    loadFurnitureModel('assets/models/furniture/Houseplant.glb', { x: 0.9, y: 0.9, z: 0.9 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, plantGroup);
    const plantShadow = createContactShadow(0.65, 0.65, 0.45);
    plantGroup.add(plantShadow);
    scene.add(plantGroup);

    // Flacon de savon antiseptique
    const lotionGroup = new THREE.Group();
    lotionGroup.position.set(-5.3, 0.96, 2.72);
    loadFurnitureModel('assets/models/furniture/Lotion Bottle Small.glb', { x: 0.008, y: 0.008, z: 0.008 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 5 * Math.PI / 4, z: 0 }, lotionGroup, null, false);
    scene.add(lotionGroup);

    // G. Négatoscope LED mural (Lecture radiographies thoraciques / osseuses)
    const negatoGroup = new THREE.Group();
    negatoGroup.position.set(-5.42, 1.75, -2.2);
    const negatoFrame = new THREE.Mesh(
        new RoundedBoxGeometry(0.05, 0.65, 0.95, 3, 0.01),
        createMaterial('#1e293b', { metalness: 0.6, roughness: 0.35 })
    );
    negatoGroup.add(negatoFrame);
    const negatoScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.88, 0.58),
        new THREE.MeshStandardMaterial({
            color: '#e0f2fe',
            emissive: '#bae6fd',
            emissiveIntensity: 0.65,
            roughness: 0.15
        })
    );
    negatoScreen.rotation.y = Math.PI / 2;
    negatoScreen.position.x = 0.028;
    negatoScreen.name = 'Negatoscope';
    negatoScreen.userData.label = 'Négatoscope LED (Imagerie)';
    negatoScreen.userData.interactive = true;
    negatoGroup.add(negatoScreen);
    scene.add(negatoGroup);

    // H. Porte d'entrée avec poignée
    const doorGroup = new THREE.Group();
    doorGroup.position.set(0, 0, -4.95);
    loadFurnitureModel('assets/models/furniture/door.glb', { x: 0.7, y: 0.7, z: 0.7 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, doorGroup);
    doorGroup.name = 'Porte entree';
    doorGroup.userData.label = 'Porte d\'entrée';
    doorGroup.userData.interactive = true;
    scene.add(doorGroup);
}

export function buildFurniture(scene) {
    // ============================================================
    // STATION A : BUREAU DU MÉDECIN (Hauteur ergonomique 0.76m)
    // ============================================================
    const deskGroup = new THREE.Group();
    deskGroup.position.set(-3.4, 0, -0.6);
    deskGroup.name = 'DeskGroup';

    const DESK_Y = 0.76; // Hauteur anthropométrique réelle (et non 1.40m)
    const woodTex = getWoodTextures();

    // Ombre d'ancrage globale sous le bureau
    const deskShadow = createContactShadow(2.6, 1.45, 0.48);
    deskGroup.add(deskShadow);

    // Plateau bois noble verni
    const tabletop = new THREE.Mesh(
        new RoundedBoxGeometry(2.2, 0.055, 1.1, 4, 0.018),
        new THREE.MeshPhysicalMaterial({
            map: woodTex.map,
            roughnessMap: woodTex.roughnessMap,
            roughness: 0.36,
            metalness: 0.0,
            clearcoat: 0.62,
            clearcoatRoughness: 0.2,
            ior: 1.5,
            envMapIntensity: 0.85
        })
    );
    tabletop.position.set(0, DESK_Y, 0);
    tabletop.castShadow = true;
    tabletop.receiveShadow = true;
    deskGroup.add(tabletop);

    // Sous-main en cuir noir sellier côté médecin
    const leatherNoise = makeNoiseBumpTexture(24);
    leatherNoise.repeat.set(3, 3);
    const deskMatPad = new THREE.Mesh(
        new RoundedBoxGeometry(0.75, 0.008, 0.48, 2, 0.004),
        createMaterial('#0f172a', {
            physical: true,
            roughness: 0.55,
            bumpMap: leatherNoise,
            bumpScale: 0.04,
            clearcoat: 0.15
        })
    );
    deskMatPad.position.set(-0.15, DESK_Y + 0.03, 0.18);
    deskMatPad.receiveShadow = true;
    deskGroup.add(deskMatPad);

    // Piètement métallique + Voile de fond (Modesty Panel)
    const legMat = createMaterial('#1e293b', { roughness: 0.38, metalness: 0.7, envMapIntensity: 0.9 });
    const leftLeg = new THREE.Mesh(new RoundedBoxGeometry(0.06, DESK_Y, 0.98, 2, 0.01), legMat);
    leftLeg.position.set(-1.02, DESK_Y / 2, 0);
    leftLeg.castShadow = true;
    leftLeg.receiveShadow = true;
    deskGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(new RoundedBoxGeometry(0.06, DESK_Y, 0.98, 2, 0.01), legMat);
    rightLeg.position.set(1.02, DESK_Y / 2, 0);
    rightLeg.castShadow = true;
    rightLeg.receiveShadow = true;
    deskGroup.add(rightLeg);

    const modestyPanel = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.42, 0.025), legMat);
    modestyPanel.position.set(0, DESK_Y - 0.26, -0.38);
    modestyPanel.castShadow = true;
    deskGroup.add(modestyPanel);

    // Caisson à tiroirs sous le bureau (côté droit)
    const pedestal = new THREE.Mesh(
        new RoundedBoxGeometry(0.42, 0.62, 0.78, 3, 0.015),
        createMaterial('#334155', { physical: true, roughness: 0.4, metalness: 0.3, clearcoat: 0.3 })
    );
    pedestal.position.set(0.76, 0.34, 0.02);
    pedestal.castShadow = true;
    deskGroup.add(pedestal);

    // ============================================================
    // ORDINATEUR TOUT-EN-UN MED-OS (Positionné sur DESK_Y)
    // ============================================================
    const aluminumMat = createMaterial('#cbd5e1', { metalness: 0.92, roughness: 0.24, envMapIntensity: 1.1 });
    const pcBase = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.016, 0.18, 2, 0.005), aluminumMat);
    pcBase.position.set(-0.2, DESK_Y + 0.035, -0.18);
    pcBase.castShadow = true;
    deskGroup.add(pcBase);

    const pcStem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.22, 16), aluminumMat);
    pcStem.position.set(-0.2, DESK_Y + 0.14, -0.20);
    pcStem.rotation.x = -0.12;
    pcStem.castShadow = true;
    deskGroup.add(pcStem);

    const pcScreenFrame = new THREE.Mesh(
        new RoundedBoxGeometry(0.72, 0.45, 0.028, 3, 0.01),
        createMaterial('#0f172a', { physical: true, roughness: 0.3, metalness: 0.5, clearcoat: 0.6 })
    );
    pcScreenFrame.position.set(-0.2, DESK_Y + 0.42, -0.16);
    pcScreenFrame.rotation.y = 0.18;
    pcScreenFrame.castShadow = true;
    deskGroup.add(pcScreenFrame);

    const pcTexture = createMedOSTexture();
    const pcScreenGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.69, 0.42),
        new THREE.MeshPhysicalMaterial({
            map: pcTexture,
            emissiveMap: pcTexture,
            emissive: '#ffffff',
            emissiveIntensity: 0.42,
            roughness: 0.08,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05
        })
    );
    pcScreenGlow.position.set(-0.2, DESK_Y + 0.42, -0.144);
    pcScreenGlow.rotation.y = 0.18;
    pcScreenGlow.name = 'Ordinateur';
    pcScreenGlow.userData.label = 'Ordinateur (MED-OS)';
    pcScreenGlow.userData.interactive = true;
    pcScreenGlow.userData.pcAction = 'open';
    deskGroup.add(pcScreenGlow);

    // Clavier + Souris sans fil
    const keyMat = createMaterial('#e2e8f0', { physical: true, roughness: 0.28, clearcoat: 0.4 });
    const keyboard = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.012, 0.12, 2, 0.004), keyMat);
    keyboard.position.set(-0.18, DESK_Y + 0.038, 0.14);
    keyboard.rotation.y = 0.12;
    keyboard.castShadow = true;
    deskGroup.add(keyboard);

    const mouse = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.022, 0.10, 3, 0.01), keyMat);
    mouse.position.set(0.08, DESK_Y + 0.04, 0.16);
    mouse.rotation.y = 0.08;
    mouse.castShadow = true;
    deskGroup.add(mouse);

    // ============================================================
    // ACCESSOIRES MÉDICAUX INTERACTIFS SUR LE BUREAU
    // ============================================================

    // 1. Stéthoscope clinique (pavillon inox + tubulure souple)
    const stethoGroup = new THREE.Group();
    stethoGroup.position.set(0.36, DESK_Y + 0.032, 0.12);
    const stethoRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.085, 0.007, 12, 32),
        createMaterial('#0f172a', { roughness: 0.45 })
    );
    stethoRing.rotation.x = Math.PI / 2;
    stethoGroup.add(stethoRing);

    const chestPiece = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.020, 0.016, 20),
        aluminumMat
    );
    chestPiece.position.set(0.085, 0.005, 0);
    stethoGroup.add(chestPiece);
    stethoGroup.name = 'Stethoscope';
    stethoGroup.userData.label = 'Stéthoscope clinique';
    stethoGroup.userData.interactive = true;
    deskGroup.add(stethoGroup);

    // 2. Flacon pompe de Solution Hydro-Alcoolique (SHA — critère hygiène ECOS)
    const shaGroup = new THREE.Group();
    shaGroup.position.set(0.82, DESK_Y + 0.09, 0.24);
    const shaBottle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.038, 0.13, 18),
        // Verre SIMULÉ, pas un matériau à transmission.
        //
        // `transmission` avait été mis ici pour « faire du verre ». Effet
        // mesuré : three.js exécute alors `renderTransmissionPass()` à CHAQUE
        // image, c'est-à-dire un rendu complet de toute la scène dans une cible
        // de transmission — soit 19 s de CPU sur 60 s de profil, et le double du
        // coût de fill-rate en continu, pour un flacon de 3,6 cm de rayon.
        //
        // Un simple `transparent` + `opacity` avec un fort `clearcoat` donne un
        // verre parfaitement convaincant à l'échelle du bureau, sans la passe.
        new THREE.MeshPhysicalMaterial({
            color: '#d8f0fd',
            roughness: 0.06,
            metalness: 0,
            transparent: true,
            opacity: 0.42,
            clearcoat: 1.0,
            clearcoatRoughness: 0.03,
            envMapIntensity: 1.4,
            depthWrite: false
        })
    );
    shaGroup.add(shaBottle);
    const shaPump = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.04, 12), keyMat);
    shaPump.position.y = 0.08;
    shaGroup.add(shaPump);
    shaGroup.name = 'GelHydroalcoolique';
    shaGroup.userData.label = 'Gel Hydroalcoolique (Hygiène des mains)';
    shaGroup.userData.interactive = true;
    deskGroup.add(shaGroup);

    // 2. Lecteur de Carte Vitale (Terminal SESAM-Vitale avec voyant vert)
    const vitaleGroup = new THREE.Group();
    vitaleGroup.position.set(-0.62, DESK_Y + 0.048, 0.12);
    vitaleGroup.rotation.y = 0.35;
    const vitaleBody = new THREE.Mesh(
        new RoundedBoxGeometry(0.11, 0.042, 0.15, 3, 0.008),
        createMaterial('#f8fafc', { physical: true, roughness: 0.25, clearcoat: 0.5 })
    );
    vitaleGroup.add(vitaleBody);
    const vitaleCard = new THREE.Mesh(
        new THREE.BoxGeometry(0.054, 0.045, 0.003),
        createMaterial('#16a34a', { roughness: 0.2, clearcoat: 0.8 })
    );
    vitaleCard.position.set(0, 0.032, -0.02);
    vitaleCard.rotation.x = -0.25;
    vitaleGroup.add(vitaleCard);
    vitaleGroup.name = 'LecteurCarteVitale';
    vitaleGroup.userData.label = 'Lecteur Carte Vitale & Ordonnances';
    vitaleGroup.userData.interactive = true;
    deskGroup.add(vitaleGroup);

    // 3. Dossier Médical Papier & Carnet de santé
    const dossierGroup = new THREE.Group();
    dossierGroup.position.set(0.55, DESK_Y + 0.035, -0.08);
    dossierGroup.rotation.y = -0.18;
    const folderMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.014, 0.32),
        createMaterial('#fef08a', { roughness: 0.75 })
    );
    dossierGroup.add(folderMesh);
    dossierGroup.name = 'DossierPatient';
    dossierGroup.userData.label = 'Dossier médical & Courrier d\'adressage';
    dossierGroup.userData.interactive = true;
    deskGroup.add(dossierGroup);

    // Accessoires GLB sur le plateau corrigé
    loadFurnitureModel('assets/models/furniture/Coffee cup.glb', { x: 0.14, y: 0.14, z: 0.14 }, { x: -0.52, y: DESK_Y + 0.03, z: -0.22 }, { x: 0, y: 0, z: 0 }, deskGroup, null, false);
    loadFurnitureModel('assets/models/furniture/Book Stack.glb', { x: 0.45, y: 0.45, z: 0.45 }, { x: 0.78, y: DESK_Y + 0.09, z: -0.24 }, { x: 0, y: -0.15, z: 0 }, deskGroup, null, false);

    // Lampe d'architecte sur le bureau
    const lampGroup = new THREE.Group();
    lampGroup.position.set(-0.85, DESK_Y + 0.03, -0.32);
    const lampLight = new THREE.PointLight('#ffbb66', 0.85, 2.6);
    lampLight.position.set(0.08, 0.42, 0.08);
    lampGroup.add(lampLight);

    const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.022, 12, 12),
        new THREE.MeshBasicMaterial({ color: '#fff3c4', toneMapped: false })
    );
    bulb.position.set(0.08, 0.42, 0.08);
    lampGroup.add(bulb);

    loadFurnitureModel('assets/models/furniture/Light Desk.glb', { x: 0.62, y: 0.62, z: 0.62 }, { x: 0, y: 0, z: 0 }, { x: 0, y: -Math.PI / 4, z: 0 }, lampGroup);
    deskGroup.add(lampGroup);

    // ============================================================
    // FAUTEUIL ERGONOMIQUE DU MÉDECIN (Hauteur d'assise 0.48m)
    // ============================================================
    const chairGroup = new THREE.Group();
    chairGroup.position.set(-0.15, 0, 0.78);
    chairGroup.rotation.y = -0.25;

    const chairShadow = createContactShadow(0.75, 0.75, 0.45);
    chairGroup.add(chairShadow);

    const chromeMat = createMaterial('#cbd5e1', { metalness: 0.95, roughness: 0.18, envMapIntensity: 1.2 });
    const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.44, 12), chromeMat);
    piston.position.set(0, 0.24, 0);
    piston.castShadow = true;
    chairGroup.add(piston);

    const starBaseMat = createMaterial('#1e293b', { roughness: 0.35, metalness: 0.5 });
    for (let i = 0; i < 5; i++) {
        const angle = (i * Math.PI * 2) / 5;
        const arm = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.025, 0.32, 2, 0.006), starBaseMat);
        arm.position.set(Math.sin(angle) * 0.15, 0.055, Math.cos(angle) * 0.15);
        arm.rotation.y = angle;
        chairGroup.add(arm);

        const caster = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 10), starBaseMat);
        caster.rotation.z = Math.PI / 2;
        caster.position.set(Math.sin(angle) * 0.29, 0.024, Math.cos(angle) * 0.29);
        chairGroup.add(caster);
    }

    const leatherSeatMat = new THREE.MeshPhysicalMaterial({
        color: '#090d16',
        roughness: 0.52,
        metalness: 0.04,
        sheen: 0.6,
        sheenColor: new THREE.Color('#334155'),
        sheenRoughness: 0.45,
        clearcoat: 0.15,
        clearcoatRoughness: 0.38,
        bumpMap: leatherNoise,
        bumpScale: 0.08,
        envMapIntensity: 0.75
    });

    const seat = new THREE.Mesh(new RoundedBoxGeometry(0.54, 0.075, 0.52, 4, 0.025), leatherSeatMat);
    seat.position.set(0, 0.48, 0);
    seat.castShadow = true;
    chairGroup.add(seat);

    const backrest = new THREE.Mesh(new RoundedBoxGeometry(0.50, 0.64, 0.065, 4, 0.025), leatherSeatMat);
    backrest.position.set(0, 0.86, 0.24);
    backrest.rotation.x = 0.08;
    backrest.castShadow = true;
    chairGroup.add(backrest);

    for (const side of [-1, 1]) {
        const armSupport = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.22, 0.04), chromeMat);
        armSupport.position.set(side * 0.27, 0.58, 0.02);
        chairGroup.add(armSupport);
        const armPad = new THREE.Mesh(new RoundedBoxGeometry(0.065, 0.025, 0.24, 2, 0.008), leatherSeatMat);
        armPad.position.set(side * 0.27, 0.69, 0.02);
        chairGroup.add(armPad);
    }

    const backBrace = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.03), chromeMat);
    backBrace.position.set(0, 0.66, 0.23);
    chairGroup.add(backBrace);

    deskGroup.add(chairGroup);
    scene.add(deskGroup);

    // ============================================================
    // FAUTEUILS PATIENTS / ACCOMPAGNANT (Face au médecin)
    // ============================================================
    const patientChairGroup = new THREE.Group();
    patientChairGroup.position.set(-2.6, 0, -2.2);
    loadFurnitureModel('assets/models/furniture/Couch Small.glb', { x: 0.45, y: 0.45, z: 0.45 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, patientChairGroup);
    patientChairGroup.add(createContactShadow(0.95, 0.9, 0.4));
    scene.add(patientChairGroup);

    const patientChairGroup2 = new THREE.Group();
    patientChairGroup2.position.set(-4.1, 0, -2.2);
    loadFurnitureModel('assets/models/furniture/Couch Small.glb', { x: 0.45, y: 0.45, z: 0.45 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, patientChairGroup2);
    patientChairGroup2.add(createContactShadow(0.95, 0.9, 0.4));
    scene.add(patientChairGroup2);

    // ============================================================
    // STATION C : BALANCE À COLONNE & TOISE MÉDICALE
    // ============================================================
    const scaleGroup = new THREE.Group();
    scaleGroup.name = 'BalanceColonne';
    scaleGroup.userData.label = 'Balance à colonne & Toise';
    scaleGroup.userData.interactive = true;
    loadOBJModel('assets/models/furniture/Scale_LP.obj', 2.15, { x: 4.7, y: 0, z: 3 }, { x: 0, y: -Math.PI / 2, z: 0 }, scaleGroup);
    const scaleShadow = createContactShadow(0.65, 0.65, 0.42);
    scaleShadow.position.set(4.7, 0.028, 3);
    scaleGroup.add(scaleShadow);
    scene.add(scaleGroup);
}