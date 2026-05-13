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

    // Panneaux lumineux au plafond (décoratifs — l'éclairage réel est géré par ThreeLightingAgent)
    [[-2.5, -1], [0, -1], [2.5, -1]].forEach(([x, z]) => {
        box(scene, { x: 0.8, y: 0.04, z: 0.32 }, { x, y: 3.42, z }, createMaterial(0xffffff, { emissive: 0xffffff, emissiveIntensity: 1.2 }), 'Panneau lumineux');
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

