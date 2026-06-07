import * as THREE from 'three';

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
    box(scene, { x: 0.04, y: 0.22, z: 0.04 }, { x: -5.38, y: 1.01, z: 2.4 }, createMaterial(0xd1d5db, { metalness: 0.95, roughness: 0.05 }), 'Robinet');
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

    // Notebooks & clinic papers
    const books = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.06, 0.32),
        new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.4 })
    );
    books.position.set(0.68, 1.47, -0.18);
    books.rotation.y = -0.12;
    books.castShadow = true;
    deskGroup.add(books);

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

    const lampBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.015, 16),
        new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.8, roughness: 0.2 })
    );
    lampBase.castShadow = true;
    lampGroup.add(lampBase);

    const lampC_arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.44, 8),
        new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.8 })
    );
    lampC_arm.position.set(0, 0.22, 0);
    lampC_arm.rotation.z = -0.22;
    lampC_arm.castShadow = true;
    lampGroup.add(lampC_arm);

    const lampHead = new THREE.Mesh(
        new THREE.ConeGeometry(0.09, 0.14, 16),
        new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4 })
    );
    lampHead.position.set(0.08, 0.42, 0);
    lampHead.rotation.z = -1.22;
    lampHead.castShadow = true;
    lampGroup.add(lampHead);

    // Cozy lamp local yellow light
    const lampLight = new THREE.PointLight('#ffaa44', 1.8, 4.5);
    lampLight.position.set(0.12, 0.38, 0);
    lampGroup.add(lampLight);
    
    // Tiny glowing sphere at lamp bulb
    const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.024, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#ffeeaa' })
    );
    bulb.position.set(0.12, 0.38, 0);
    lampGroup.add(bulb);

    deskGroup.add(lampGroup);
    scene.add(deskGroup);

    // ==========================================
    // SITTING AREA: SITTING PATIENT CHAIR (Fauteuil patient premium)
    // ==========================================
    const chairColor = new THREE.MeshStandardMaterial({ color: '#0d9488', roughness: 0.65 });
    const chairBaseMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 });
    box(scene, { x: 0.7, y: 0.5, z: 0.7 }, { x: 1.2, y: 0.25, z: -3.5 }, chairBaseMat, 'Base fauteuil');
    box(scene, { x: 0.8, y: 0.1, z: 0.8 }, { x: 1.2, y: 0.5, z: -3.5 }, chairColor, 'Assise fauteuil');
    box(scene, { x: 0.8, y: 0.9, z: 0.1 }, { x: 1.2, y: 1.0, z: -3.85 }, chairColor, 'Dossier fauteuil');
    box(scene, { x: 0.1, y: 0.3, z: 0.8 }, { x: 0.75, y: 0.7, z: -3.5 }, chairColor, 'Accoudoir G');
    box(scene, { x: 0.1, y: 0.3, z: 0.8 }, { x: 1.65, y: 0.7, z: -3.5 }, chairColor, 'Accoudoir D');

    // ==========================================
    // EXTRA STUFF FOR REALISM: Waiting Stool
    // ==========================================
    const stool = new THREE.Group();
    stool.position.set(2.0, 0, -3.5);
    stool.name = 'PatientStool';
    const stoolMetal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 0.03, 16),
        new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.9 })
    );
    stoolMetal.position.set(0, 0.015, 0);
    stool.add(stoolMetal);
    
    const stoolPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.52, 8),
        new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.8 })
    );
    stoolPole.position.set(0, 0.26, 0);
    stoolPole.castShadow = true;
    stool.add(stoolPole);

    const stoolSeat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.7 })
    );
    stoolSeat.position.set(0, 0.54, 0);
    stoolSeat.castShadow = true;
    stool.add(stoolSeat);
    scene.add(stool);

    // ==========================================
    // STANDING FLOOR LAMP (Left wall warm light)
    // ==========================================
    const floorLamp = new THREE.Group();
    floorLamp.position.set(-5.0, 0, 3.2);
    floorLamp.name = 'FloorLamp';
    
    const lampMetalMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.8, roughness: 0.2 });
    
    const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 16), lampMetalMat);
    baseMesh.position.y = 0.01;
    baseMesh.castShadow = true;
    floorLamp.add(baseMesh);
    
    const poleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.6, 8), lampMetalMat);
    poleMesh.position.y = 0.8;
    poleMesh.castShadow = true;
    floorLamp.add(poleMesh);
    
    const shadeMesh = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.15, 16), lampMetalMat);
    shadeMesh.position.set(-0.06, 1.65, 0);
    shadeMesh.rotation.z = Math.PI / 4;
    shadeMesh.castShadow = true;
    floorLamp.add(shadeMesh);
    
    scene.add(floorLamp);

    // ==========================================
    // BED PRIVACY DIVIDER SCREEN
    // ==========================================
    const dividerMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7, metalness: 0.05 });
    box(scene, { x: 0.05, y: 1.6, z: 1.0 }, { x: 3.9, y: 0.8, z: -0.6 }, dividerMat, 'Separateur Lit');

    // ==========================================
    // BLUE LIGHT / LASER STAND (Foreground flare)
    // ==========================================
    const laserStand = new THREE.Group();
    laserStand.position.set(-2.0, 0, 2.0);
    laserStand.name = 'LaserStand';
    
    const lBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12), lampMetalMat);
    lBase.position.y = 0.01;
    laserStand.add(lBase);
    
    const lPole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.1, 8), lampMetalMat);
    lPole.position.y = 0.55;
    lPole.castShadow = true;
    laserStand.add(lPole);
    
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const lensMesh = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), lensMat);
    lensMesh.position.y = 1.12;
    laserStand.add(lensMesh);
    
    scene.add(laserStand);
}
