/**
 * three-room-hospital.js — Équipements qui font d'une pièce une chambre d'hôpital
 *
 * POURQUOI CE MODULE
 *
 * Une salle 3D « propre » mais nue se lit comme un décor. Ce qui fait dire à
 * un étudiant « je suis dans un service », ce sont des objets précis, que
 * l'on voit tous les jours en stage et jamais ailleurs :
 *
 *  - la RAMPE DE GAZ MÉDICAUX à la tête du lit (prises O₂ / air / vide aux
 *    couleurs normalisées, débitmètre à bille, bocal d'aspiration) ;
 *  - le RAIL DE RIDEAU au plafond autour du lit, avec son rideau à filet ;
 *  - le POSTE DE DIAGNOSTIC MURAL (otoscope + ophtalmoscope sur leur socle,
 *    tensiomètre mural à cadran) ;
 *  - les distributeurs de SHA à l'entrée et au lit, les boîtes de gants
 *    murales, le collecteur à aiguilles jaune ;
 *  - le faux plafond « technique » : bouches de soufflage, détecteur de
 *    fumée, sprinklers, bloc de secours (BAES) au-dessus de la porte.
 *
 * Plus deux effets d'image sans coût de rendu : des bandes d'OCCLUSION dans
 * les angles de la pièce et des OMBRES DE CONTACT sous le mobilier roulant.
 *
 * RÈGLES DU DÉPÔT RESPECTÉES ICI
 *
 *  - AUCUNE source de lumière. Tout ce qui « brille » (veilleuse de rampe,
 *    pictogramme BAES) est un `MeshBasicMaterial` à couleur > 1 : un bloc de
 *    calcul de moins dans le shader de chaque matériau de la salle.
 *  - AUCUN matériau `transmission` (verre simulé par `transparent`).
 *  - Matériaux PARTAGÉS par famille (blanc laqué, chrome, plastique sombre) :
 *    le nombre de programmes de shader ne dépend pas du nombre d'objets.
 *  - Rien d'interactif : chaque objet est du décor, déclaré avec un palier de
 *    détail via le rappel `decor(obj, palier)` fourni par l'agent
 *    d'environnement (palier 0 = toujours visible).
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ROOM } from './three-room.js';
import { makeAOGradientTexture, makeCurtainTexture } from './three-room-textures.js';

/* ------------------------------------------------------------------ */
/* Repères de la pièce                                                 */
/* ------------------------------------------------------------------ */

const H = ROOM.height;
/** Faces intérieures des murs. */
const X_RIGHT = ROOM.width / 2 - ROOM.wall / 2;
const X_LEFT = -X_RIGHT;
const Z_BACK = -(ROOM.length / 2 - ROOM.wall / 2);
const Z_FRONT = -Z_BACK;

/* ------------------------------------------------------------------ */
/* Matériaux partagés                                                  */
/* ------------------------------------------------------------------ */

let _mats = null;
function mats() {
    if (_mats) return _mats;
    const std = (color, roughness, metalness = 0, extra = {}) =>
        new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    const glow = (color, k) => {
        const m = new THREE.MeshBasicMaterial({ color });
        m.color.multiplyScalar(k);
        return m;
    };
    _mats = {
        white: std('#f2f3f1', 0.35),
        offWhite: std('#e4e6e3', 0.5),
        alu: std('#c9ced2', 0.32, 0.85),
        chrome: std('#dde1e4', 0.18, 0.95),
        dark: std('#2a2f35', 0.55),
        black: std('#15181b', 0.45),
        green: std('#1f9d55', 0.45),       // oxygène (norme : blanc + repère vert)
        yellow: std('#f2c230', 0.45),      // vide médical
        orange: std('#ef7d22', 0.5),
        red: std('#d23c32', 0.45),
        blue: std('#2f6fb3', 0.5),
        clear: std('#e6f0f4', 0.06, 0, { transparent: true, opacity: 0.35, depthWrite: false }),
        nightLight: glow('#fff4e0', 1.6),
        exitGreen: glow('#22c55e', 1.8)
    };
    return _mats;
}

/* ------------------------------------------------------------------ */
/* Petites fabriques                                                   */
/* ------------------------------------------------------------------ */

function mesh(geo, mat, x, y, z, shadow = false) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    return m;
}

/** Texture d'étiquette (texte sombre sur fond clair), mise en cache. */
const _labels = new Map();
function labelTexture(text, { bg = '#ffffff', fg = '#1f2937', w = 128, h = 48, font = 'bold 26px sans-serif', bar = null } = {}) {
    const key = [text, bg, fg, w, h, font, bar].join('|');
    if (_labels.has(key)) return _labels.get(key);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    if (bar) { ctx.fillStyle = bar; ctx.fillRect(0, 0, 8, h); }
    ctx.fillStyle = fg; ctx.font = font;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = String(text).split('\n');
    lines.forEach((l, i) => ctx.fillText(l, w / 2 + (bar ? 4 : 0), h / 2 + (i - (lines.length - 1) / 2) * (h / (lines.length + 0.6))));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    _labels.set(key, t);
    return t;
}

function label(text, w, h, opts) {
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ map: labelTexture(text, opts), roughness: 0.6 }));
}

/**
 * Quadrilatère orienté librement : le bord V = 0 va de `a` à `b`, le bord
 * V = 1 est décalé de `dir × width`. Sert aux bandes d'occlusion, quel que
 * soit l'angle de la pièce où on les pose.
 */
function strip(a, b, dir, width, mat) {
    const c = b.clone().addScaledVector(dir, width);
    const d = a.clone().addScaledVector(dir, width);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
        a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z
    ], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 1;
    return m;
}

/* ------------------------------------------------------------------ */
/* 1. Occlusion des angles + ombres de contact                         */
/* ------------------------------------------------------------------ */

/**
 * Bandes d'occlusion ambiante dans les angles : sol/mur, mur/mur,
 * mur/plafond. C'est l'assombrissement de contact que calculerait une passe
 * d'AO (GTAO, réservée aux GPU haut de gamme) — ici pour le prix d'un seul
 * matériau `MeshBasicMaterial` transparent, partagé, sans passe de rendu.
 */
export function addCornerOcclusion(scene, decor) {
    const tex = makeAOGradientTexture();
    const mk = (opacity) => new THREE.MeshBasicMaterial({
        map: tex, color: 0x000000, transparent: true, opacity,
        depthWrite: false, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    const floorMat = mk(0.32), wallMat = mk(0.22), ceilMat = mk(0.18);
    const group = new THREE.Group();
    group.name = 'CornerOcclusion';
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const fy = 0.027, eps = 0.016;
    const walls = [
        // [début, fin, normale vers l'intérieur]
        [V(X_LEFT, 0, Z_BACK), V(X_RIGHT, 0, Z_BACK), V(0, 0, 1)],
        [V(X_LEFT, 0, Z_FRONT), V(X_RIGHT, 0, Z_FRONT), V(0, 0, -1)],
        [V(X_LEFT, 0, Z_BACK), V(X_LEFT, 0, Z_FRONT), V(1, 0, 0)],
        [V(X_RIGHT, 0, Z_BACK), V(X_RIGHT, 0, Z_FRONT), V(-1, 0, 0)]
    ];
    for (const [a, b, n] of walls) {
        // Sol, le long du mur (la plinthe fait 1 cm d'épaisseur).
        const a0 = a.clone().setY(fy).addScaledVector(n, 0.012);
        const b0 = b.clone().setY(fy).addScaledVector(n, 0.012);
        group.add(strip(a0, b0, n, 0.38, floorMat));
        // Mur, au-dessus de la plinthe et devant le lambris.
        const a1 = a.clone().setY(0.125).addScaledVector(n, eps);
        const b1 = b.clone().setY(0.125).addScaledVector(n, eps);
        group.add(strip(a1, b1, V(0, 1, 0), 0.32, wallMat));
        // Plafond, le long du mur.
        const a2 = a.clone().setY(H - 0.003).addScaledVector(n, 0.03);
        const b2 = b.clone().setY(H - 0.003).addScaledVector(n, 0.03);
        group.add(strip(a2, b2, n, 0.42, ceilMat));
    }
    // Angles verticaux : deux bandes par coin, une sur chaque mur.
    for (const x of [X_LEFT, X_RIGHT]) {
        for (const z of [Z_BACK, Z_FRONT]) {
            const nx = Math.sign(-x), nz = Math.sign(-z);
            // Sur le mur avant/fond (plan z = cste), vers le centre en x.
            group.add(strip(V(x, 0.03, z + nz * eps), V(x, H, z + nz * eps), V(nx, 0, 0), 0.34, wallMat));
            // Sur le mur gauche/droit (plan x = cste), vers le centre en z.
            group.add(strip(V(x + nx * eps, 0.03, z), V(x + nx * eps, H, z), V(0, 0, nz), 0.34, wallMat));
        }
    }
    scene.add(group);
    decor(group, 0);
}

/** Ombre de contact (dégradé radial partagé) sous un meuble posé au sol. */
let _contactTex = null;
function contactShadow(w, d, opacity) {
    if (!_contactTex) {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
        g.addColorStop(0, 'rgba(10,14,20,1)');
        g.addColorStop(0.5, 'rgba(10,14,20,0.5)');
        g.addColorStop(1, 'rgba(10,14,20,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
        _contactTex = new THREE.CanvasTexture(c);
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({
        map: _contactTex, transparent: true, opacity, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 1;
    return m;
}

/**
 * Ombres de contact sous le mobilier roulant : lit, chariot, pieds à
 * perfusion et à scope, poubelle. Sans elles, ces objets « flottent » dès
 * que l'ombre portée du soleil ne les touche pas.
 */
export function addFloorContactShadows(scene, decor) {
    const group = new THREE.Group();
    group.name = 'ContactShadows';
    const spots = [
        // x, z, largeur, profondeur, opacité
        [4.7, 0.25, 1.25, 2.5, 0.55],   // lit d'examen
        [3.6, -1.1, 0.62, 0.52, 0.45],  // chariot de soins
        [3.8, -0.4, 0.5, 0.5, 0.4],     // scope sur pied
        [5.2, -0.4, 0.5, 0.5, 0.4],     // pied à perfusion
        [3.15, -1.85, 0.45, 0.45, 0.45],// DASRI
        [5.45, 1.25, 0.55, 0.55, 0.35], // lampe d'examen
        [-4.55, 0.55, 0.4, 0.4, 0.4]    // corbeille du bureau
    ];
    for (const [x, z, w, d, o] of spots) {
        const s = contactShadow(w, d, o);
        s.position.set(x, 0.026, z);
        group.add(s);
    }
    scene.add(group);
    decor(group, 0);
}

/* ------------------------------------------------------------------ */
/* 2. Rampe de gaz médicaux (tête de lit)                              */
/* ------------------------------------------------------------------ */

/**
 * Rampe murale horizontale au-dessus du lit, sur le mur droit : profilé alu
 * laqué, prises de gaz aux couleurs normalisées (O₂ blanc/vert, air
 * noir/blanc, vide jaune), débitmètre d'oxygène à bille, régulateur de vide
 * et bocal d'aspiration, prises électriques (dont deux rouges ondulées),
 * appel malade, et la veilleuse de lecture intégrée en haut du profilé.
 */
export function addMedicalHeadwall(scene, decor) {
    const M = mats();
    const g = new THREE.Group();
    g.name = 'RampeGazMedicaux';
    // Repère local : x = profondeur (vers la salle = -x monde), z = le long du mur.
    g.position.set(X_RIGHT, 0, 0);
    g.rotation.y = Math.PI; // la face avant regarde vers -x (l'intérieur)
    const add = (o) => { g.add(o); return o; };
    // Après rotation de π : z local = -z monde. On place en z monde, donc on
    // inverse ici une fois pour toutes.
    const Z = (zw) => -zw;
    const zA = -1.55, zB = -0.05, len = zB - zA, zc = (zA + zB) / 2;
    const yc = 1.52;

    // Profilé : corps, joues d'extrémité, veilleuse de lecture.
    add(mesh(new RoundedBoxGeometry(0.075, 0.24, len, 3, 0.012), M.offWhite, 0.0375, yc, Z(zc), true));
    add(mesh(new THREE.BoxGeometry(0.08, 0.25, 0.02), M.alu, 0.04, yc, Z(zA)));
    add(mesh(new THREE.BoxGeometry(0.08, 0.25, 0.02), M.alu, 0.04, yc, Z(zB)));
    add(mesh(new THREE.BoxGeometry(0.004, 0.025, len - 0.1), M.nightLight, 0.077, yc + 0.1, Z(zc)));

    // Prises de gaz : plaque, bague de couleur, nez de prise, étiquette.
    const outlet = (zw, ring, txt, ringMat2 = null) => {
        add(mesh(new THREE.BoxGeometry(0.01, 0.085, 0.085), M.white, 0.08, yc - 0.03, Z(zw)));
        const r = add(mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 24), ring, 0.087, yc - 0.03, Z(zw)));
        r.rotation.y = Math.PI / 2;
        if (ringMat2) {
            const r2 = add(mesh(new THREE.TorusGeometry(0.013, 0.004, 8, 20), ringMat2, 0.088, yc - 0.03, Z(zw)));
            r2.rotation.y = Math.PI / 2;
        }
        const nose = add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 16), M.chrome, 0.094, yc - 0.03, Z(zw)));
        nose.rotation.z = Math.PI / 2;
        const l = add(label(txt, 0.06, 0.022, { w: 96, h: 36, font: 'bold 24px sans-serif' }));
        l.position.set(0.0855, yc + 0.03, Z(zw));
        l.rotation.y = Math.PI / 2;
    };
    outlet(-1.4, M.green, 'O₂', M.white);
    outlet(-1.27, M.black, 'AIR', M.white);
    outlet(-1.14, M.yellow, 'VIDE');

    // Débitmètre O₂ à bille, branché sur la prise O₂.
    const fm = new THREE.Group();
    fm.position.set(0.12, yc - 0.13, Z(-1.4));
    fm.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 12), M.chrome, 0, 0.085, 0));
    fm.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.13, 16), M.clear, 0, 0, 0));
    fm.add(mesh(new THREE.SphereGeometry(0.008, 10, 8), M.green, 0, -0.02, 0));
    fm.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 16), M.chrome, 0, -0.075, 0));
    fm.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.025, 12), M.green, 0, 0.12, 0));
    // Tubulure verte vers le lit.
    const tube = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.085, 0), new THREE.Vector3(0.05, -0.2, 0.02),
        new THREE.Vector3(0.18, -0.32, -0.08), new THREE.Vector3(0.36, -0.55, -0.18)
    ]);
    fm.add(new THREE.Mesh(new THREE.TubeGeometry(tube, 24, 0.0035, 6, false),
        new THREE.MeshStandardMaterial({ color: '#9ad7b6', roughness: 0.3, transparent: true, opacity: 0.8 })));
    add(fm);

    // Régulateur de vide + bocal d'aspiration 1 L.
    const vac = new THREE.Group();
    vac.position.set(0.11, yc - 0.12, Z(-1.14));
    vac.add(mesh(new RoundedBoxGeometry(0.05, 0.07, 0.05, 2, 0.01), M.white, 0, 0.05, 0));
    vac.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 16), M.yellow, 0.026, 0.055, 0));
    add(vac);
    const jar = new THREE.Group();
    jar.position.set(0.1, yc - 0.42, Z(-0.98));
    jar.add(mesh(new THREE.BoxGeometry(0.03, 0.12, 0.02), M.alu, -0.05, 0.08, 0));
    jar.add(mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.17, 20), M.clear, 0, 0, 0));
    jar.add(mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.03, 20), M.blue, 0, 0.1, 0));
    jar.add(mesh(new THREE.CylinderGeometry(0.052, 0.05, 0.05, 20),
        new THREE.MeshStandardMaterial({ color: '#d8e6ea', roughness: 0.2, transparent: true, opacity: 0.6 }), 0, -0.055, 0));
    add(jar);

    // Prises électriques : 2 blanches, 2 rouges (circuit secouru), appel malade.
    const socket = (zw, mat) => {
        add(mesh(new RoundedBoxGeometry(0.012, 0.075, 0.075, 2, 0.008), mat, 0.081, yc - 0.03, Z(zw)));
        for (const dz of [-0.012, 0.012]) {
            const hole = add(mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.004, 8), M.black, 0.088, yc - 0.03, Z(zw + dz)));
            hole.rotation.z = Math.PI / 2;
        }
    };
    socket(-0.86, M.white);
    socket(-0.77, M.white);
    socket(-0.64, M.red);
    socket(-0.55, M.red);
    const call = add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 20), M.red, 0.085, yc - 0.03, Z(-0.3)));
    call.rotation.z = Math.PI / 2;
    add(mesh(new THREE.BoxGeometry(0.008, 0.06, 0.06), M.white, 0.08, yc - 0.03, Z(-0.3)));
    const callLbl = add(label('APPEL', 0.05, 0.018, { w: 96, h: 32, font: 'bold 22px sans-serif', fg: '#b91c1c' }));
    callLbl.position.set(0.0855, yc + 0.03, Z(-0.3));
    callLbl.rotation.y = Math.PI / 2;

    scene.add(g);
    decor(g, 0);
}

/* ------------------------------------------------------------------ */
/* 3. Rail de rideau et rideau séparatif                               */
/* ------------------------------------------------------------------ */

/**
 * Rideau plissé : une grille verticale dont les plis sont des sinusoïdes
 * d'amplitude décroissante vers le bas (le tissu se détend). La texture a
 * sa bande de filet en haut, comme les rideaux réglementaires.
 */
function curtainPanel(width, height, pleats, amp) {
    const nx = Math.max(24, pleats * 8), ny = 6;
    const geo = new THREE.PlaneGeometry(width, height, nx, ny);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i);
        const u = (x / width + 0.5);
        const t = 0.65 + 0.35 * ((y / height) + 0.5); // plis plus marqués en haut
        p.setZ(i, Math.sin(u * pleats * Math.PI * 2) * amp * t + Math.sin(u * 7.3) * amp * 0.3);
    }
    geo.computeVertexNormals();
    const tex = makeCurtainTexture().clone();
    tex.repeat.set(width / 0.5, 1);
    tex.needsUpdate = true;
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.92, side: THREE.DoubleSide, envMapIntensity: 0.5
    }));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

export function addCurtainTrack(scene, decor) {
    const M = mats();
    const g = new THREE.Group();
    g.name = 'RailRideau';
    const y = H - 0.025;
    const xIn = 3.65;              // côté salle
    const z0 = -1.6, z1 = 1.9;     // tête / pied du lit
    const seg = (ax, az, bx, bz) => {
        const len = Math.hypot(bx - ax, bz - az);
        const m = mesh(new THREE.BoxGeometry(0.03, 0.028, len), M.alu, (ax + bx) / 2, y, (az + bz) / 2);
        m.rotation.y = Math.atan2(bx - ax, bz - az);
        g.add(m);
    };
    seg(X_RIGHT, z0, xIn, z0);
    seg(xIn, z0, xIn, z1);
    seg(xIn, z1, X_RIGHT, z1);
    // Suspentes de plafond.
    for (const [x, z] of [[4.5, z0], [xIn, -0.2], [xIn, 1.0], [4.5, z1]]) {
        g.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.025, 8), M.alu, x, H - 0.012, z));
    }

    const top = y - 0.035, bottom = 0.32;
    const hgt = top - bottom;
    // Rideau tiré, ramassé contre le mur côté tête (fenêtre) ...
    const c1 = curtainPanel(0.75, hgt, 7, 0.05);
    c1.position.set(X_RIGHT - 0.45, bottom + hgt / 2, z0);
    g.add(c1);
    // ... et l'autre pan ramassé contre le mur, côté pied : le lit reste
    // entièrement visible depuis l'entrée du box.
    const c2 = curtainPanel(0.6, hgt, 6, 0.045);
    c2.position.set(X_RIGHT - 0.38, bottom + hgt / 2, z1);
    g.add(c2);
    // Crochets visibles au-dessus des pans.
    for (let i = 0; i < 8; i++) {
        g.add(mesh(new THREE.BoxGeometry(0.012, 0.03, 0.012), M.alu, X_RIGHT - 0.1 - i * 0.095, y - 0.025, z0));
    }
    for (let i = 0; i < 6; i++) {
        g.add(mesh(new THREE.BoxGeometry(0.012, 0.03, 0.012), M.alu, X_RIGHT - 0.1 - i * 0.1, y - 0.025, z1));
    }
    scene.add(g);
    decor(g, 0);
}

/* ------------------------------------------------------------------ */
/* 4. Poste de diagnostic mural + tensiomètre mural                    */
/* ------------------------------------------------------------------ */

export function addWallDiagnosticSet(scene, decor) {
    const M = mats();
    const g = new THREE.Group();
    g.name = 'PosteDiagnosticMural';
    g.position.set(X_RIGHT, 0, 0);
    g.rotation.y = -Math.PI / 2; // face vers -x ; repère local : x = z monde
    const X = (zw) => zw;        // le long du mur
    const y0 = 1.38;

    // Socle à deux poignées (otoscope / ophtalmoscope) + distributeur de spéculums.
    const zc = 2.05;
    g.add(mesh(new RoundedBoxGeometry(0.34, 0.12, 0.045, 3, 0.012), M.offWhite, X(zc), y0, 0.0225, true));
    for (const [dz, headMat] of [[-0.07, M.black], [0.07, M.dark]]) {
        const hx = X(zc + dz);
        g.add(mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.14, 16), M.black, hx, y0 + 0.11, 0.05, true));
        g.add(mesh(new THREE.CylinderGeometry(0.022, 0.016, 0.05, 16), headMat, hx, y0 + 0.2, 0.05, true));
        const cord = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 6, 28), M.black);
        cord.position.set(hx, y0 - 0.12, 0.05);
        cord.scale.set(0.6, 2.2, 1);
        g.add(cord);
    }
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 16), M.clear, X(zc + 0.21), y0 + 0.02, 0.04));
    g.add(mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.015, 16), M.white, X(zc + 0.21), y0 + 0.085, 0.04));

    // Tensiomètre mural à cadran + panier à brassard + tuyau spiralé.
    const zt = 2.6;
    g.add(mesh(new RoundedBoxGeometry(0.16, 0.26, 0.04, 3, 0.015), M.offWhite, X(zt), y0 + 0.08, 0.02, true));
    const dialTex = (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(64, 64, 62, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2;
        for (let i = 0; i <= 30; i++) {
            const a = Math.PI * 0.75 + (i / 30) * Math.PI * 1.5;
            const r0 = i % 5 === 0 ? 46 : 52;
            ctx.beginPath(); ctx.moveTo(64 + Math.cos(a) * r0, 64 + Math.sin(a) * r0);
            ctx.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58); ctx.stroke();
        }
        ctx.fillStyle = '#1f2937'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('mmHg', 64, 92);
        ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(30, 80); ctx.stroke();
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    })();
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.055, 32), new THREE.MeshStandardMaterial({ map: dialTex, roughness: 0.3 }));
    dial.position.set(X(zt), y0 + 0.13, 0.042);
    g.add(dial);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.057, 0.006, 8, 32), M.chrome);
    bezel.position.set(X(zt), y0 + 0.13, 0.042);
    g.add(bezel);
    g.add(mesh(new THREE.BoxGeometry(0.15, 0.07, 0.07), M.offWhite, X(zt), y0 - 0.02, 0.06, true));
    g.add(mesh(new THREE.BoxGeometry(0.13, 0.05, 0.05), M.blue, X(zt), y0 + 0.0, 0.06));
    const coil = [];
    for (let i = 0; i <= 80; i++) {
        const t = i / 80;
        coil.push(new THREE.Vector3(X(zt) + Math.cos(t * 40) * 0.012 + 0.05, y0 - 0.05 - t * 0.28, 0.07 + Math.sin(t * 40) * 0.012));
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 160, 0.0028, 5, false), M.black));

    scene.add(g);
    decor(g, 1);
}

/* ------------------------------------------------------------------ */
/* 5. Hygiène : SHA, gants, collecteur à aiguilles                     */
/* ------------------------------------------------------------------ */

/** Distributeur de solution hydro-alcoolique mural (boîtier + poche + levier). */
function shaDispenser() {
    const M = mats();
    const g = new THREE.Group();
    g.add(mesh(new RoundedBoxGeometry(0.12, 0.26, 0.1, 3, 0.02), M.white, 0, 0, 0.05, true));
    g.add(mesh(new THREE.BoxGeometry(0.05, 0.1, 0.004), new THREE.MeshStandardMaterial({ color: '#7ec3e6', roughness: 0.2, transparent: true, opacity: 0.75 }), 0, 0.03, 0.101));
    g.add(mesh(new RoundedBoxGeometry(0.1, 0.04, 0.05, 2, 0.01), M.dark, 0, -0.14, 0.075));
    const l = label('SHA\nFriction 30 s', 0.08, 0.04, { w: 128, h: 64, font: 'bold 18px sans-serif', fg: '#0e7490' });
    l.position.set(0, 0.09, 0.101);
    g.add(l);
    return g;
}

/** Boîtes de gants murales S / M / L dans leur support inox. */
function gloveDispenser() {
    const M = mats();
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.28, 0.4, 0.1), M.alu, 0, 0, 0.05));
    const colors = ['#7c3aed', '#2563eb', '#0d9488'];
    ['S', 'M', 'L'].forEach((s, i) => {
        const y = 0.13 - i * 0.13;
        g.add(mesh(new THREE.BoxGeometry(0.25, 0.11, 0.09),
            new THREE.MeshStandardMaterial({ color: '#f5f7f8', roughness: 0.7 }), 0, y, 0.055));
        const l = label(`Gants nitrile  ${s}`, 0.2, 0.05, { w: 192, h: 48, font: 'bold 20px sans-serif', fg: '#ffffff', bg: colors[i] });
        l.position.set(0, y, 0.101);
        g.add(l);
    });
    return g;
}

/** Collecteur à aiguilles (jaune, couvercle orange) sur support mural. */
function sharpsContainer() {
    const M = mats();
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.14, 0.03, 0.12), M.alu, 0, -0.13, 0.06));
    g.add(mesh(new RoundedBoxGeometry(0.15, 0.22, 0.13, 3, 0.015), M.yellow, 0, -0.01, 0.07, true));
    g.add(mesh(new RoundedBoxGeometry(0.155, 0.05, 0.135, 2, 0.01), M.orange, 0, 0.115, 0.07));
    const l = label('DASRI\nPiquants', 0.1, 0.06, { w: 128, h: 72, font: 'bold 20px sans-serif', bg: '#fde68a' });
    l.position.set(0, -0.02, 0.136);
    g.add(l);
    return g;
}

export function addHygieneStations(scene, decor) {
    const g = new THREE.Group();
    g.name = 'PostesHygiene';
    // À l'entrée, à droite de la porte (mur du fond, face +z).
    const sha1 = shaDispenser();
    sha1.position.set(1.25, 1.3, Z_BACK);
    g.add(sha1);
    // Au lit : mur droit, au pied du lit (face -x).
    const sha2 = shaDispenser();
    sha2.position.set(X_RIGHT, 1.3, 0.55);
    sha2.rotation.y = -Math.PI / 2;
    g.add(sha2);
    // Gants + collecteur : mur du fond, entre l'armoire et le scope mural.
    const gloves = gloveDispenser();
    gloves.position.set(3.75, 1.45, Z_BACK);
    g.add(gloves);
    const sharps = sharpsContainer();
    sharps.position.set(4.25, 1.3, Z_BACK);
    g.add(sharps);
    scene.add(g);
    decor(g, 0);
}

/* ------------------------------------------------------------------ */
/* 6. Faux plafond technique                                           */
/* ------------------------------------------------------------------ */

let _grilleTex = null;
function grilleTexture() {
    if (_grilleTex) return _grilleTex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#eceeed'; ctx.fillRect(0, 0, 128, 128);
    // Diffuseur à quatre voies : carrés concentriques.
    for (let i = 0; i < 6; i++) {
        const m = 10 + i * 9;
        ctx.strokeStyle = i % 2 ? 'rgba(90,95,100,0.55)' : 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 3;
        ctx.strokeRect(m, m, 128 - 2 * m, 128 - 2 * m);
    }
    ctx.fillStyle = 'rgba(60,65,70,0.6)';
    ctx.fillRect(58, 58, 12, 12);
    _grilleTex = new THREE.CanvasTexture(c);
    _grilleTex.colorSpace = THREE.SRGBColorSpace;
    return _grilleTex;
}

export function addCeilingFixtures(scene, decor) {
    const M = mats();
    const g = new THREE.Group();
    g.name = 'PlafondTechnique';
    const y = H - 0.003;
    // Bouches de soufflage 60 × 60 (dans la trame des dalles).
    const ventMat = new THREE.MeshStandardMaterial({ map: grilleTexture(), roughness: 0.6 });
    for (const [x, z] of [[-1.5, -3.6], [1.5, 3.3], [-3.0, 3.9]]) {
        const v = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.58), ventMat);
        v.rotation.x = Math.PI / 2;
        v.position.set(x, y, z);
        g.add(v);
    }
    // Détecteur de fumée (avec son voyant) et têtes de sprinkler.
    g.add(mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.035, 24), M.white, 0.6, H - 0.018, 0.4));
    g.add(mesh(new THREE.SphereGeometry(0.004, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3b30' }), 0.62, H - 0.036, 0.42));
    for (const [x, z] of [[-3.0, -0.3], [1.5, -1.2], [-1.5, 2.4], [3.0, 0.3]]) {
        g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 16), M.chrome, x, H - 0.004, z));
        g.add(mesh(new THREE.CylinderGeometry(0.006, 0.01, 0.035, 8), M.chrome, x, H - 0.022, z));
        g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.004, 12), M.chrome, x, H - 0.04, z));
    }
    // Bloc autonome d'éclairage de sécurité (BAES) au-dessus de la porte.
    const baes = new THREE.Group();
    baes.position.set(0, 2.55, Z_BACK);
    baes.add(mesh(new RoundedBoxGeometry(0.34, 0.13, 0.06, 2, 0.01), M.white, 0, 0, 0.03));
    const picto = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.08), new THREE.MeshBasicMaterial({
        map: labelTexture('SORTIE  ⟶', { w: 256, h: 72, bg: '#16a34a', fg: '#ffffff', font: 'bold 34px sans-serif' })
    }));
    picto.material.color.setScalar(1.5);
    picto.position.set(0, 0, 0.061);
    baes.add(picto);
    g.add(baes);
    scene.add(g);
    decor(g, 1);
}

/* ------------------------------------------------------------------ */
/* 7. Signalétique, interrupteurs, tableau blanc                       */
/* ------------------------------------------------------------------ */

export function addSignageAndBoard(scene, decor) {
    const M = mats();
    const g = new THREE.Group();
    g.name = 'Signaletique';

    // Plaque de porte (côté couloir… et rappel côté salle).
    const plate = label('BOX 3\nConsultation', 0.3, 0.12, {
        w: 320, h: 128, font: 'bold 34px sans-serif', bar: '#0e7490', fg: '#0f172a'
    });
    plate.position.set(-1.3, 1.6, Z_BACK + 0.004);
    g.add(plate);
    // Interrupteurs (double) et lecteur de badge à côté de la porte.
    const sw = new THREE.Group();
    sw.position.set(-1.25, 1.08, Z_BACK);
    sw.add(mesh(new RoundedBoxGeometry(0.16, 0.085, 0.012, 2, 0.006), M.white, 0, 0, 0.006));
    sw.add(mesh(new THREE.BoxGeometry(0.06, 0.06, 0.008), M.offWhite, -0.037, 0, 0.014));
    sw.add(mesh(new THREE.BoxGeometry(0.06, 0.06, 0.008), M.offWhite, 0.037, 0, 0.014));
    g.add(sw);

    // Tableau blanc du mur avant (face -z) : planning et consignes au feutre.
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fbfcfc'; ctx.fillRect(0, 0, 512, 256);
    const g2 = ctx.createLinearGradient(0, 0, 512, 256);
    g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(0.5, 'rgba(210,220,230,0.25)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, 512, 256);
    ctx.font = 'italic bold 22px "Comic Sans MS", cursive';
    ctx.fillStyle = '#1d4ed8';
    ctx.fillText('Consultations — matin', 20, 36);
    ctx.font = 'italic 17px "Comic Sans MS", cursive';
    ctx.fillStyle = '#111827';
    ['8h30  Dr Martin — box 3', '9h15  ECG + bilan lipidique', '10h00 Staff cardio (salle 2)', '— Penser SHA entre chaque patient !'].forEach((t, i) => ctx.fillText(t, 26, 72 + i * 30));
    ctx.fillStyle = '#b91c1c';
    ctx.font = 'italic bold 18px "Comic Sans MS", cursive';
    ctx.fillText('Chariot d\'urgence vérifié ✓', 280, 220);
    ctx.strokeStyle = 'rgba(29,78,216,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(20, 46); ctx.lineTo(260, 46); ctx.stroke();
    const boardTex = new THREE.CanvasTexture(c);
    boardTex.colorSpace = THREE.SRGBColorSpace;
    boardTex.anisotropy = 4;
    const board = new THREE.Group();
    board.position.set(-2.2, 1.55, Z_FRONT);
    board.rotation.y = Math.PI;
    board.add(mesh(new THREE.BoxGeometry(1.64, 0.84, 0.025), M.alu, 0, 0, 0.0125));
    board.add(mesh(new THREE.PlaneGeometry(1.58, 0.78), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.15, envMapIntensity: 0.9 }), 0, 0, 0.026));
    board.add(mesh(new THREE.BoxGeometry(1.2, 0.03, 0.07), M.alu, 0, -0.43, 0.04));
    for (const [x, col] of [[-0.3, M.blue], [-0.2, M.red], [-0.1, M.black]]) {
        const pen = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.13, 10), col, x, -0.405, 0.05);
        pen.rotation.z = Math.PI / 2;
        board.add(pen);
    }
    g.add(board);

    // Charte de la personne hospitalisée : l'affiche réglementaire présente
    // dans toutes les chambres d'hôpital françaises.
    const ch = document.createElement('canvas');
    ch.width = 256; ch.height = 360;
    const cx = ch.getContext('2d');
    cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, 256, 360);
    cx.fillStyle = '#1e3a8a'; cx.fillRect(0, 0, 256, 70);
    cx.fillStyle = '#ffffff'; cx.font = 'bold 19px sans-serif'; cx.textAlign = 'center';
    cx.fillText('Charte de la personne', 128, 30);
    cx.fillText('hospitalisée', 128, 54);
    cx.textAlign = 'left'; cx.font = '11px sans-serif';
    for (let i = 0; i < 11; i++) {
        cx.fillStyle = '#1e3a8a'; cx.font = 'bold 13px sans-serif';
        cx.fillText(String(i + 1), 14, 94 + i * 24);
        cx.fillStyle = '#94a3b8';
        cx.fillRect(34, 86 + i * 24, 190 - (i * 37) % 70, 4);
        cx.fillRect(34, 94 + i * 24, 150 - (i * 23) % 60, 4);
    }
    cx.fillStyle = '#e11d48'; cx.fillRect(0, 352, 256, 8);
    const charterTex = new THREE.CanvasTexture(ch);
    charterTex.colorSpace = THREE.SRGBColorSpace;
    charterTex.anisotropy = 4;
    const charter = new THREE.Group();
    charter.position.set(0.9, 1.55, Z_FRONT);
    charter.rotation.y = Math.PI;
    charter.add(mesh(new THREE.BoxGeometry(0.44, 0.6, 0.012), M.alu, 0, 0, 0.006));
    charter.add(mesh(new THREE.PlaneGeometry(0.41, 0.57), new THREE.MeshStandardMaterial({ map: charterTex, roughness: 0.4 }), 0, 0, 0.013));
    g.add(charter);

    // Téléviseur sur bras mural, éteint (un écran noir brillant reflète la pièce).
    const tv = new THREE.Group();
    tv.position.set(3.3, 2.05, Z_FRONT);
    tv.rotation.y = Math.PI;
    tv.add(mesh(new THREE.BoxGeometry(0.12, 0.16, 0.02), M.dark, 0, 0, 0.01));
    tv.add(mesh(new THREE.BoxGeometry(0.04, 0.04, 0.3), M.dark, 0, 0, 0.16));
    const screen = new THREE.Group();
    screen.position.set(0, -0.02, 0.33);
    screen.rotation.x = 0.12;
    screen.add(mesh(new RoundedBoxGeometry(0.82, 0.48, 0.04, 2, 0.01), M.black, 0, 0, 0, true));
    screen.add(mesh(new THREE.PlaneGeometry(0.78, 0.44), new THREE.MeshStandardMaterial({ color: '#05070a', roughness: 0.08, envMapIntensity: 1.2 }), 0, 0, 0.021));
    tv.add(screen);
    g.add(tv);

    // Deux chaises visiteurs empilables (piètement chromé, assise bleue).
    const seatMat = new THREE.MeshStandardMaterial({ color: '#2f5d8a', roughness: 0.55 });
    for (const x of [1.75, 2.35]) {
        const chair = new THREE.Group();
        chair.position.set(x, 0, Z_FRONT - 0.32);
        chair.rotation.y = Math.PI;
        for (const sx of [-0.2, 0.2]) {
            for (const sz of [-0.2, 0.2]) {
                chair.add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.45, 8), M.chrome, sx, 0.225, sz, true));
            }
            chair.add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.42, 8), M.chrome, sx, 0.66, -0.21, true));
        }
        chair.add(mesh(new RoundedBoxGeometry(0.46, 0.05, 0.44, 3, 0.015), seatMat, 0, 0.47, 0, true));
        const back = mesh(new RoundedBoxGeometry(0.46, 0.26, 0.04, 3, 0.015), seatMat, 0, 0.76, -0.22, true);
        back.rotation.x = -0.1;
        chair.add(back);
        g.add(chair);
    }
    const chairShadow = contactShadow(1.3, 0.6, 0.35);
    chairShadow.position.set(2.05, 0.026, Z_FRONT - 0.32);
    g.add(chairShadow);

    scene.add(g);
    decor(g, 1);
}

/** Étapes de construction, une par équipement (cf. `TaskScheduler`). */
export function hospitalSteps(scene, decor) {
    return [
        () => addCornerOcclusion(scene, decor),
        () => addFloorContactShadows(scene, decor),
        () => addMedicalHeadwall(scene, decor),
        () => addCurtainTrack(scene, decor),
        () => addWallDiagnosticSet(scene, decor),
        () => addHygieneStations(scene, decor),
        () => addCeilingFixtures(scene, decor),
        () => addSignageAndBoard(scene, decor)
    ];
}

