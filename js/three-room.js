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
    const wall = createMaterial(0xe5efef);
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fctx = floorCanvas.getContext('2d');
    fctx.fillStyle = '#bed2c8';
    fctx.fillRect(0, 0, 512, 512);
    fctx.strokeStyle = 'rgba(120, 145, 135, 0.28)';
    fctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) {
        fctx.beginPath(); fctx.moveTo(i, 0); fctx.lineTo(i, 512); fctx.stroke();
        fctx.beginPath(); fctx.moveTo(0, i); fctx.lineTo(512, i); fctx.stroke();
    }
    fctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let y = 0; y < 512; y += 64) {
        for (let x = 0; x < 512; x += 64) {
            if ((x + y) % 128 === 0) fctx.fillRect(x + 3, y + 3, 58, 58);
        }
    }
    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(3, 3);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, color: 0xffffff, roughness: 0.82, metalness: 0.02 });
    box(scene, { x: 10, y: 0.05, z: 8 }, { x: 0, y: 0, z: 0 }, floorMat, 'Sol');
    box(scene, { x: 10, y: 3.5, z: 0.1 }, { x: 0, y: 1.75, z: -4 }, wall, 'Mur du fond');
    box(scene, { x: 0.1, y: 3.5, z: 8 }, { x: -5, y: 1.75, z: 0 }, wall, 'Mur gauche');
    box(scene, { x: 0.1, y: 3.5, z: 8 }, { x: 5, y: 1.75, z: 0 }, wall, 'Mur droit');
    box(scene, { x: 1.7, y: 2.55, z: 0.08 }, { x: 3.0, y: 1.27, z: 3.82 }, createMaterial(0xd8d0c0), 'Porte entree', true);
    
    // Fenêtre encastrée dans le mur gauche
    box(scene, { x: 0.1, y: 1.5, z: 2.4 }, { x: -4.95, y: 1.8, z: -1.0 }, createMaterial(0x9ec6d8, { emissive: 0x224455, emissiveIntensity: 0.15 }), 'Fenetre');
    box(scene, { x: 0.12, y: 1.65, z: 0.05 }, { x: -4.9, y: 1.8, z: -1.0 }, createMaterial(0xf4f6f6, { roughness: 0.45 }), 'Montant fenetre');
    box(scene, { x: 0.12, y: 0.05, z: 2.55 }, { x: -4.9, y: 1.8, z: -1.0 }, createMaterial(0xf4f6f6, { roughness: 0.45 }), 'Traverse fenetre');
    
    // Moniteur mural sur le mur du fond à droite
    box(scene, { x: 0.8, y: 0.5, z: 0.08 }, { x: 4.5, y: 2.0, z: -3.9 }, createMaterial(0x03150a, { emissive: 0x00aa44, emissiveIntensity: 0.25 }), 'Moniteur mural', true);
    
    // Évier encastré/attaché au mur gauche
    box(scene, { x: 0.6, y: 0.88, z: 1.2 }, { x: -4.7, y: 0.44, z: 1.8 }, createMaterial(0xd8e8ee), 'Meuble Evier', true);
    box(scene, { x: 0.4, y: 0.05, z: 0.8 }, { x: -4.7, y: 0.88, z: 1.8 }, createMaterial(0xeeeeee), 'Evier basin', true);
    box(scene, { x: 0.08, y: 0.2, z: 0.08 }, { x: -4.85, y: 1.0, z: 1.8 }, createMaterial(0x888888, { metalness: 0.8, roughness: 0.2 }), 'Robinet');

    // Armoire contre le mur droit
    box(scene, { x: 1.0, y: 2.0, z: 0.8 }, { x: 4.5, y: 1.0, z: 1.0 }, createMaterial(0xd5dde6), 'Armoire', true);

    // === MUR AVANT (avec ouverture de porte) ===
    // La porte est centrée en x=3.0, largeur 1.7, hauteur 2.55 (y de 0 à 2.545)
    // => Gauche de la porte : x de -5 à 2.15
    const doorLeft = 3.0 - 1.7 / 2; // 2.15
    const doorRight = 3.0 + 1.7 / 2; // 3.85
    const doorTop = 1.27 + 2.55 / 2; // 2.545
    // Section gauche du mur avant (porte à gauche = grand panneau)
    box(scene, { x: doorLeft - (-5), y: 3.5, z: 0.1 }, { x: (-5 + doorLeft) / 2, y: 1.75, z: 4 }, wall, 'Mur avant gauche');
    // Section droite du mur avant (petit panneau entre porte et mur droit)
    box(scene, { x: 5 - doorRight, y: 3.5, z: 0.1 }, { x: (doorRight + 5) / 2, y: 1.75, z: 4 }, wall, 'Mur avant droit');
    // Linteau (au-dessus de la porte)
    box(scene, { x: doorRight - doorLeft, y: 3.5 - doorTop, z: 0.1 }, { x: (doorLeft + doorRight) / 2, y: doorTop + (3.5 - doorTop) / 2, z: 4 }, wall, 'Mur avant linteau');

    // Cadre de porte (4 montants : gauche, droite, haut, seuil)
    const doorFrameMat = createMaterial(0xc8baa0, { roughness: 0.5, metalness: 0.1 });
    // Montant gauche
    box(scene, { x: 0.04, y: doorTop, z: 0.12 }, { x: doorLeft, y: doorTop / 2, z: 3.96 }, doorFrameMat, '');
    // Montant droit
    box(scene, { x: 0.04, y: doorTop, z: 0.12 }, { x: doorRight, y: doorTop / 2, z: 3.96 }, doorFrameMat, '');
    // Linteau cadre (horizontal au-dessus)
    box(scene, { x: doorRight - doorLeft + 0.08, y: 0.06, z: 0.12 }, { x: 3.0, y: doorTop + 0.03, z: 3.96 }, doorFrameMat, '');
    // Seuil (bas)
    box(scene, { x: doorRight - doorLeft + 0.08, y: 0.04, z: 0.14 }, { x: 3.0, y: 0.02, z: 3.96 }, doorFrameMat, '');

    // === PLAFOND ===
    // Plafond principal avec texture procédurale (carreaux d'hôpital)
    const ceilingCanvas = document.createElement('canvas');
    ceilingCanvas.width = 512;
    ceilingCanvas.height = 512;
    const cctx = ceilingCanvas.getContext('2d');
    cctx.fillStyle = '#e8eef0';
    cctx.fillRect(0, 0, 512, 512);
    // Grille de carreaux décoratifs
    const tileSize = 64;
    // PRNG simple pour un rendu déterministe (pas de flicker au rechargement)
    let _rngSeed = 42;
    const _rng = () => { _rngSeed = (_rngSeed * 16807 + 0) % 2147483647; return (_rngSeed - 1) / 2147483646; };
    for (let x = 0; x < 512; x += tileSize) {
        for (let y = 0; y < 512; y += tileSize) {
            // Léger dégradé par carreau
            const brightness = 222 + _rng() * 10;
            cctx.fillStyle = `rgb(${brightness}, ${brightness + 4}, ${brightness + 6})`;
            cctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
        }
    }
    // Lignes de joints
    cctx.strokeStyle = 'rgba(180, 190, 200, 0.5)';
    cctx.lineWidth = 2;
    for (let x = 0; x <= 512; x += tileSize) {
        cctx.beginPath(); cctx.moveTo(x, 0); cctx.lineTo(x, 512); cctx.stroke();
    }
    for (let y = 0; y <= 512; y += tileSize) {
        cctx.beginPath(); cctx.moveTo(0, y); cctx.lineTo(512, y); cctx.stroke();
    }
    // Trou de ventilation (grille ronde) au centre
    cctx.strokeStyle = 'rgba(160, 170, 180, 0.6)';
    cctx.lineWidth = 3;
    cctx.beginPath(); cctx.arc(256, 256, 50, 0, Math.PI * 2); cctx.stroke();
    for (let r = 15; r < 50; r += 12) {
        cctx.beginPath(); cctx.arc(256, 256, r, 0, Math.PI * 2); cctx.stroke();
    }
    // Lignes radiales
    for (let a = 0; a < 8; a++) {
        const angle = (a / 8) * Math.PI * 2;
        cctx.beginPath();
        cctx.moveTo(256 + Math.cos(angle) * 12, 256 + Math.sin(angle) * 12);
        cctx.lineTo(256 + Math.cos(angle) * 48, 256 + Math.sin(angle) * 48);
        cctx.stroke();
    }
    const ceilingTex = new THREE.CanvasTexture(ceilingCanvas);
    ceilingTex.wrapS = THREE.RepeatWrapping;
    ceilingTex.wrapT = THREE.RepeatWrapping;
    ceilingTex.repeat.set(2, 2);
    const ceilingMat = new THREE.MeshStandardMaterial({
        map: ceilingTex,
        color: 0xe8eef0,
        roughness: 0.85,
        metalness: 0.02,
        side: THREE.DoubleSide
    });
    const ceilingGeom = new THREE.BoxGeometry(10, 0.08, 8);
    const ceiling = new THREE.Mesh(ceilingGeom, ceilingMat);
    ceiling.position.set(0, 3.5, 0);
    ceiling.receiveShadow = true;
    ceiling.name = 'Plafond';
    scene.add(ceiling);

    // === PLINTHES (bandes décoratives murales d'hôpital) ===
    // Plinthe basse (vert pâle/sable — soubassement hospitalier)
    const baseboardMat = createMaterial(0x8ab098, { roughness: 0.6, metalness: 0.05 });
    // Mur du fond
    box(scene, { x: 10, y: 0.12, z: 0.06 }, { x: 0, y: 0.06, z: -3.96 }, baseboardMat, '');
    // Mur gauche
    box(scene, { x: 0.06, y: 0.12, z: 8 }, { x: -4.96, y: 0.06, z: 0 }, baseboardMat, '');
    // Mur droit
    box(scene, { x: 0.06, y: 0.12, z: 8 }, { x: 4.96, y: 0.06, z: 0 }, baseboardMat, '');

    // Bande murale médiane (handrail / couleur accent — typique des hôpitaux)
    const railMat = createMaterial(0x4a7a6a, { roughness: 0.35, metalness: 0.15 });
    box(scene, { x: 10, y: 0.06, z: 0.04 }, { x: 0, y: 0.92, z: -3.96 }, railMat, '');
    box(scene, { x: 0.04, y: 0.06, z: 8 }, { x: -4.96, y: 0.92, z: 0 }, railMat, '');
    box(scene, { x: 0.04, y: 0.06, z: 8 }, { x: 4.96, y: 0.92, z: 0 }, railMat, '');

    // Bande murale haute (moulure)
    const crownMat = createMaterial(0xd0d8dc, { roughness: 0.7, metalness: 0.05 });

    // === MUR AVANT — plinthes, mains courantes et moulures ===
    // (on réutilise doorLeft/doorRight calculés ci-dessus)
    // Plinthe section gauche
    box(scene, { x: doorLeft - (-5), y: 0.12, z: 0.06 }, { x: (-5 + doorLeft) / 2, y: 0.06, z: 3.96 }, baseboardMat, '');
    // Plinthe section droite
    box(scene, { x: 5 - doorRight, y: 0.12, z: 0.06 }, { x: (doorRight + 5) / 2, y: 0.06, z: 3.96 }, baseboardMat, '');
    // Main courante section gauche
    box(scene, { x: doorLeft - (-5), y: 0.06, z: 0.04 }, { x: (-5 + doorLeft) / 2, y: 0.92, z: 3.96 }, railMat, '');
    // Main courante section droite
    box(scene, { x: 5 - doorRight, y: 0.06, z: 0.04 }, { x: (doorRight + 5) / 2, y: 0.92, z: 3.96 }, railMat, '');
    // Moulure haute section gauche
    box(scene, { x: doorLeft - (-5), y: 0.05, z: 0.04 }, { x: (-5 + doorLeft) / 2, y: 3.2, z: 3.96 }, crownMat, '');
    // Moulure haute section droite
    box(scene, { x: 5 - doorRight, y: 0.05, z: 0.04 }, { x: (doorRight + 5) / 2, y: 3.2, z: 3.96 }, crownMat, '');

    // Moulures autres murs
    box(scene, { x: 10, y: 0.05, z: 0.04 }, { x: 0, y: 3.2, z: -3.96 }, crownMat, '');
    box(scene, { x: 0.04, y: 0.05, z: 8 }, { x: -4.96, y: 3.2, z: 0 }, crownMat, '');
    box(scene, { x: 0.04, y: 0.05, z: 8 }, { x: 4.96, y: 3.2, z: 0 }, crownMat, '');

    // === NÉONS AU PLAFOND (luminaire réaliste) ===
    // Matériaux et géométries partagés (1 matérial = 1 draw call par matériau identique)
    const neonPositions = [
        { x: -2.5, z: -1 },
        { x: 0, z: -1 },
        { x: 2.5, z: -1 },
        { x: -2.5, z: 1.5 },
        { x: 0, z: 1.5 },
        { x: 2.5, z: 1.5 },
    ];
    const troughMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.9, metalness: 0.05 });
    const troughGeom = new THREE.BoxGeometry(0.9, 0.04, 0.42);
    const neonMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 1.2,
        roughness: 0.05,
        metalness: 0.0
    });
    const neonGeom = new THREE.BoxGeometry(0.75, 0.015, 0.12);
    neonPositions.forEach(({ x, z }) => {
        // Caisson encastré (bordure)
        const trough = new THREE.Mesh(troughGeom, troughMat);
        trough.position.set(x, 3.44, z);
        trough.receiveShadow = true;
        scene.add(trough);

        // Tube néon (lumineux)
        const neon = new THREE.Mesh(neonGeom, neonMat);
        neon.position.set(x, 3.47, z);
        neon.name = 'Panneau lumineux';
        scene.add(neon);
    });
}

export function buildFurniture(scene) {
    // Bureau réaliste (Plateau + Pieds)
    box(scene, { x: 2.4, y: 0.05, z: 1.0 }, { x: -0.8, y: 0.8, z: -0.9 }, createMaterial(0xd7c2a0), 'Bureau');
    box(scene, { x: 0.1, y: 0.8, z: 0.9 }, { x: -1.9, y: 0.4, z: -0.9 }, createMaterial(0x555555), 'Pied bureau G');
    box(scene, { x: 0.1, y: 0.8, z: 0.9 }, { x: 0.3, y: 0.4, z: -0.9 }, createMaterial(0x555555), 'Pied bureau D');

    // PC sur le bureau — écran + pied + base + clavier + souris
    const pcScreen = box(scene, { x: 0.6, y: 0.4, z: 0.05 }, { x: -1.5, y: 1.05, z: -1.2 }, createMaterial(0x101820, { emissive: 0x003366, emissiveIntensity: 0.35 }), 'Ordinateur', true);
    pcScreen.userData.label = 'Ordinateur';
    pcScreen.userData.pcAction = 'open';
    box(scene, { x: 0.1, y: 0.2, z: 0.1 }, { x: -1.5, y: 0.9, z: -1.25 }, createMaterial(0x222222), 'Pied ecran');
    box(scene, { x: 0.3, y: 0.02, z: 0.2 }, { x: -1.5, y: 0.835, z: -1.25 }, createMaterial(0x222222), 'Base ecran');
    box(scene, { x: 0.5, y: 0.02, z: 0.15 }, { x: -1.5, y: 0.835, z: -0.8 }, createMaterial(0x222222), 'Clavier');
    box(scene, { x: 0.08, y: 0.03, z: 0.12 }, { x: -1.1, y: 0.84, z: -0.8 }, createMaterial(0x222222), 'Souris');

    // Lit patient réaliste (Sommier + Matelas + Têtes de lit)
    box(scene, { x: 1.0, y: 0.5, z: 2.2 }, { x: -3.5, y: 0.25, z: -2.6 }, createMaterial(0xaab5c8), 'Base Lit');
    box(scene, { x: 0.9, y: 0.15, z: 2.1 }, { x: -3.5, y: 0.575, z: -2.6 }, createMaterial(0xd8e0e8), 'Matelas');
    box(scene, { x: 1.0, y: 0.8, z: 0.1 }, { x: -3.5, y: 0.4, z: -3.65 }, createMaterial(0x7c8c9e), 'Tete Lit');
    box(scene, { x: 1.0, y: 0.6, z: 0.1 }, { x: -3.5, y: 0.3, z: -1.55 }, createMaterial(0x7c8c9e), 'Pied Lit');
    const bedRailMat = createMaterial(0xd6dde7, { metalness: 0.45, roughness: 0.28 });
    box(scene, { x: 0.06, y: 0.18, z: 1.35 }, { x: -3.02, y: 0.86, z: -2.72 }, bedRailMat, 'Barriere lit');
    box(scene, { x: 0.06, y: 0.18, z: 1.35 }, { x: -3.98, y: 0.86, z: -2.72 }, bedRailMat, 'Barriere lit');
    box(scene, { x: 0.22, y: 0.055, z: 0.22 }, { x: -3.5, y: 0.68, z: -3.35 }, createMaterial(0xf5f1e8), 'Oreiller');

    // Fauteuil patient réaliste (Base, assise, dossier, accoudoirs)
    const chairColor = createMaterial(0x7f986c);
    box(scene, { x: 0.7, y: 0.5, z: 0.7 }, { x: 2.15, y: 0.25, z: -1.7 }, createMaterial(0x333333), 'Base fauteuil');
    box(scene, { x: 0.8, y: 0.1, z: 0.8 }, { x: 2.15, y: 0.5, z: -1.7 }, chairColor, 'Assise fauteuil');
    box(scene, { x: 0.8, y: 0.9, z: 0.1 }, { x: 2.15, y: 1.0, z: -2.05 }, chairColor, 'Dossier fauteuil');
    box(scene, { x: 0.1, y: 0.3, z: 0.8 }, { x: 1.7, y: 0.7, z: -1.7 }, chairColor, 'Accoudoir G');
    box(scene, { x: 0.1, y: 0.3, z: 0.8 }, { x: 2.6, y: 0.7, z: -1.7 }, chairColor, 'Accoudoir D');
}

