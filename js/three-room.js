import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();

function loadFurnitureModel(path, scale, position, rotation, parent, setupCallback) {
    gltfLoader.load(path, (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        model.scale.set(scale.x, scale.y, scale.z);
        model.position.set(position.x, position.y, position.z);
        model.rotation.set(rotation.x, rotation.y, rotation.z);
        parent.add(model);
        if (setupCallback) setupCallback(model);
    }, undefined, (err) => {
        console.error(`Erreur de chargement du modèle 3D: ${path}`, err);
    });
}

export function createMaterial(color, opts = {}) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: opts.roughness ?? 0.72,
        metalness: opts.metalness ?? 0.05,
        emissive: opts.emissive ?? 0x000000,
        emissiveIntensity: opts.emissiveIntensity ?? 0
    });
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

export function buildRoom(scene) {
    const roomWidth = 11;
    const roomLength = 10;
    const roomHeight = 5;

    // A. Dark Slate Ceramic/Tile Floor (Dynamically drawn on Canvas)
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const ctxF = floorCanvas.getContext('2d');
    
    // Background (dark slate)
    ctxF.fillStyle = '#1e2022';
    ctxF.fillRect(0, 0, 512, 512);
    
    // Draw tiles with slight inner shading for a beveled/premium ceramic look
    const tileSize = 64;
    for (let x = 0; x < 512; x += tileSize) {
        for (let y = 0; y < 512; y += tileSize) {
            // Draw tile body with subtle variation
            ctxF.fillStyle = Math.random() > 0.5 ? '#1a1c1e' : '#1c1e20';
            ctxF.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
            
            // Highlight top-left edge of each tile for realism
            ctxF.fillStyle = 'rgba(255, 255, 255, 0.015)';
            ctxF.fillRect(x + 2, y + 2, tileSize - 4, 2);
            ctxF.fillRect(x + 2, y + 2, 2, tileSize - 4);
            
            // Shadow bottom-right edge of each tile
            ctxF.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctxF.fillRect(x + tileSize - 4, y + 2, 2, tileSize - 4);
            ctxF.fillRect(x + 2, y + tileSize - 4, tileSize - 4, 2);
        }
    }
    
    // Draw Grout Lines (dark/almost black)
    ctxF.strokeStyle = '#0a0c0e';
    ctxF.lineWidth = 3;
    for (let i = 0; i <= 512; i += tileSize) {
        ctxF.beginPath();
        ctxF.moveTo(i, 0);
        ctxF.lineTo(i, 512);
        ctxF.stroke();
        
        ctxF.beginPath();
        ctxF.moveTo(0, i);
        ctxF.lineTo(512, i);
        ctxF.stroke();
    }

    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(3, 3);

    const floorMat = new THREE.MeshStandardMaterial({
        map: floorTexture,
        roughness: 0.18,
        metalness: 0.1,
    });
    box(scene, { x: roomWidth + 0.2, y: 0.05, z: roomLength + 0.2 }, { x: 0, y: 0, z: 0 }, floorMat, 'Sol');

    // B. BACK WALL (z = -5)
    const wallMat = new THREE.MeshStandardMaterial({
        color: '#f8fafc', // Soft warm white clinical paint
        roughness: 0.85,
    });
    box(scene, { x: roomWidth, y: roomHeight, z: 0.1 }, { x: 0, y: roomHeight / 2, z: -roomLength / 2 }, wallMat, 'Mur du fond');

    // D. RIGHT WALL (x = 5.5) — Completely Solid plaster to match the screenshot
    box(scene, { x: 0.1, y: roomHeight, z: roomLength }, { x: roomWidth / 2, y: roomHeight / 2, z: 0 }, wallMat, 'Mur droit');

    // Molding/Trim along top of the walls (from the screenshot)
    const moldingMat = new THREE.MeshStandardMaterial({ color: 0x242424, roughness: 0.6 });
    box(scene, { x: roomWidth, y: 0.22, z: 0.12 }, { x: 0, y: roomHeight - 0.11, z: -roomLength / 2 + 0.05 }, moldingMat, 'Moulure fond');
    box(scene, { x: 0.12, y: 0.22, z: roomLength }, { x: roomWidth / 2 - 0.05, y: roomHeight - 0.11, z: 0 }, moldingMat, 'Moulure droite');

    // H. Sleek dark floating sink cabinet (Meuble Evier)
    box(scene, { x: 0.52, y: 0.52, z: 1.1 }, { x: -5.2, y: 0.64, z: 2.4 }, createMaterial(0x18181b, { roughness: 0.45, metalness: 0.1 }), 'Meuble Evier', true);
    box(scene, { x: 0.42, y: 0.05, z: 0.82 }, { x: -5.2, y: 0.9, z: 2.4 }, createMaterial(0xf8fafc, { roughness: 0.2 }), 'Evier basin', true);
    
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

    // Main walnut wood tabletop
    const tabletop = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.08, 1.2),
        new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.3, metalness: 0.05 }) // rich mahogany
    );
    tabletop.position.set(0, 1.4, 0);
    tabletop.castShadow = true;
    tabletop.receiveShadow = true;
    deskGroup.add(tabletop);

    // Heavy slate desk side supports
    const leftLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 1.4, 1.1),
        new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.6 })
    );
    leftLeg.position.set(-1.1, 0.7, 0);
    leftLeg.castShadow = true;
    leftLeg.receiveShadow = true;
    deskGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 1.4, 1.1),
        new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.6 })
    );
    rightLeg.position.set(1.1, 0.7, 0);
    rightLeg.castShadow = true;
    rightLeg.receiveShadow = true;
    deskGroup.add(rightLeg);

    // Slim Computer Monitor (All-in-one style)
    const pcBase = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.03, 0.2),
        new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.95, roughness: 0.1 })
    );
    pcBase.position.set(-0.2, 1.44, -0.1);
    pcBase.castShadow = true;
    deskGroup.add(pcBase);

    const pcStem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.28, 8),
        new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.95, roughness: 0.1 })
    );
    pcStem.position.set(-0.2, 1.58, -0.1);
    pcStem.castShadow = true;
    deskGroup.add(pcStem);

    const pcScreenFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.82, 0.52, 0.04),
        new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4 })
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

    // Thin keyboard
    const keyboard = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.015, 0.14),
        new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.2 })
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

    // Chair metallic legs
    const legsBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.62, 8),
        new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.9, roughness: 0.1 })
    );
    legsBase.position.set(0, 0.31, 0);
    legsBase.castShadow = true;
    chairGroup.add(legsBase);

    // Five-pointed base (flat cylinder)
    const baseJoints = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.28, 0.03, 5),
        new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 })
    );
    baseJoints.position.set(0, 0.05, 0);
    chairGroup.add(baseJoints);

    // Seat cushion
    const seat = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.09, 0.58),
        new THREE.MeshStandardMaterial({ color: '#020617', roughness: 0.7, metalness: 0.1 })
    );
    seat.position.set(0, 0.66, 0);
    seat.castShadow = true;
    chairGroup.add(seat);

    // Backrest
    const backrest = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.72, 0.08),
        new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 })
    );
    backrest.position.set(0, 1.2, 0.26);
    backrest.castShadow = true;
    chairGroup.add(backrest);

    // Metal backrest brace
    const backBrace = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.72, 0.04),
        new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.9 })
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
    const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.024, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#ffeeaa' })
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
}
