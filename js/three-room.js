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
    box(scene, { x: 10, y: 0.05, z: 8 }, { x: 0, y: 0, z: 0 }, createMaterial(0xbfd2c7), 'Sol');
    box(scene, { x: 10, y: 3.5, z: 0.1 }, { x: 0, y: 1.75, z: -4 }, wall, 'Mur du fond');
    box(scene, { x: 0.1, y: 3.5, z: 8 }, { x: -5, y: 1.75, z: 0 }, wall, 'Mur gauche');
    box(scene, { x: 0.1, y: 3.5, z: 8 }, { x: 5, y: 1.75, z: 0 }, wall, 'Mur droit');
    box(scene, { x: 1.7, y: 2.55, z: 0.08 }, { x: 3.0, y: 1.27, z: 3.82 }, createMaterial(0xd8d0c0), 'Porte entree', true);
    box(scene, { x: 1.2, y: 0.75, z: 0.08 }, { x: -4.94, y: 1.75, z: -2.0 }, createMaterial(0x9ec6d8, { emissive: 0x224455, emissiveIntensity: 0.15 }), 'Fenetre');
    box(scene, { x: 0.55, y: 0.38, z: 0.08 }, { x: 4.7, y: 2.15, z: -3.88 }, createMaterial(0x03150a, { emissive: 0x00aa44, emissiveIntensity: 0.25 }), 'Moniteur mural', true);
    box(scene, { x: 0.55, y: 0.55, z: 0.08 }, { x: -4.88, y: 1.0, z: 1.8 }, createMaterial(0xd8e8ee), 'Evier', true);
    box(scene, { x: 1.0, y: 1.8, z: 0.6 }, { x: 4.3, y: 0.9, z: 0.9 }, createMaterial(0xd5dde6), 'Armoire', true);

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
    for (let x = 0; x < 512; x += tileSize) {
        for (let y = 0; y < 512; y += tileSize) {
            // Léger dégradé par carreau
            const brightness = 222 + Math.random() * 10;
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
    box(scene, { x: 2.4, y: 0.09, z: 1.05 }, { x: -0.8, y: 0.82, z: -0.9 }, createMaterial(0xd7c2a0), 'Bureau');
    box(scene, { x: 1.9, y: 0.14, z: 0.72 }, { x: -3.0, y: 0.68, z: -2.2 }, createMaterial(0xd8e0e8), 'Lit patient');
    box(scene, { x: 0.72, y: 0.1, z: 0.62 }, { x: 2.15, y: 0.52, z: -1.7 }, createMaterial(0x7f986c), 'Fauteuil patient');

    // PC sur le bureau — écran + pied + clavier
    const pcScreen = box(scene, { x: 0.55, y: 0.38, z: 0.03 }, { x: -1.5, y: 1.2, z: -1.35 }, createMaterial(0x101820, { emissive: 0x003366, emissiveIntensity: 0.35 }), 'Ordinateur', true);
    pcScreen.userData.label = 'Ordinateur';
    pcScreen.userData.pcAction = 'open';
    box(scene, { x: 0.05, y: 0.35, z: 0.05 }, { x: -1.5, y: 0.95, z: -1.32 }, createMaterial(0x222222), 'Pied ecran');
    box(scene, { x: 0.4, y: 0.02, z: 0.15 }, { x: -1.5, y: 0.87, z: -1.2 }, createMaterial(0x222222), 'Clavier');
    box(scene, { x: 0.08, y: 0.03, z: 0.08 }, { x: -0.9, y: 0.87, z: -0.95 }, createMaterial(0x222222), 'Souris');
}

