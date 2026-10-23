/**
 * three-room-textures.js — Textures procédurales de la salle de consultation
 *
 * D'OÙ VIENNENT CES TEXTURES
 *
 * Elles sont dessinées au canvas 2D, pas importées : le dépôt n'embarque
 * que des assets lourds (GLB de patients et de meubles), et un sol de 4 Mo
 * en JPEG ne survivrait pas au budget de chargement de la page 3D. Un
 * canvas 512×512 coûte 1 Mo de VRAM, se génère en quelques millisecondes, et
 * se règle à la main.
 *
 * L'inspiration vient de l'application « MedGame ICU » (React + Vite), dont
 * la direction artistique a servi de référence : sol PVC de salle, murs à
 * deux tons, plafond à dalles acoustiques. Elles ont été réadaptées à une
 * SALLE DE CONSULTATION (pas une réanimation) : les teintes sont plus
 * claires, et rien n'évoque un chariot d'urgence.
 *
 * RÈGLES DU DÉPÔT (à respecter ici)
 *
 *  1. AUCUN matériau `transmission`. `renderTransmissionPass()` re-rend
 *     toute la scène à chaque image : 19 s de CPU mesurés sur la page 3D.
 *     Le verre est simulé par `transparent` + `opacity` + `clearcoat`.
 *  2. Chaque texture est MISE EN CACHE. La salle est reconstruite à chaque
 *     changement de cas : sans cache, on recrée (et réupload en VRAM) les
 *     mêmes canvas à chaque fois.
 *  3. `colorSpace = SRGBColorSpace` sur les cartes de couleur, pas sur les
 *     cartes de rugosité ni de normale.
 */

import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */

const _cache = new Map();

/**
 * Fabrique mémoïsée : la même clé renvoie la même texture.
 * @param {string} cle
 * @param {() => THREE.Texture} fabrique
 */
function cache(cle, fabrique) {
    let t = _cache.get(cle);
    if (!t) {
        t = fabrique();
        _cache.set(cle, t);
    }
    return t;
}

/** Vide le cache (changement de cas, libération de la scène). */
export function viderCacheTexturesSalle() {
    for (const t of _cache.values()) t.dispose?.();
    _cache.clear();
}

/* ------------------------------------------------------------------ */
/* Fabrique de canvas                                                  */
/* ------------------------------------------------------------------ */

/**
 * @param {number} w
 * @param {number} h
 * @returns {[HTMLCanvasElement, CanvasRenderingContext2D]}
 */
export function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return [c, c.getContext('2d')];
}

/* ------------------------------------------------------------------ */
/* SOL — PVC de salle, dalles soudées, traces de roulettes             */
/* ------------------------------------------------------------------ */

/**
 * Sol en PVC de salle de consultation.
 *
 * Un hôpital n'a pas du marbre : c'est du PVC collé à chaud, gris clair,
 * dont les dalles sont soudées entre elles (le trait de soudure est
 * visible et légèrement plus sombre). Les traces de roulettes — brancard,
 * fauteuil — sont le détail qui fait « vrai hôpital ».
 */
export function makeFloorTextureSalle() {
    return cache('salle:floor', () => {
        const [c, ctx] = makeCanvas(512, 512);
        const g = ctx.createLinearGradient(0, 0, 512, 512);
        // Gris clair légèrement chaud : le PVC des services (type Tarkett
        // « iQ Granit »), pas un carrelage sombre de hall.
        g.addColorStop(0, '#a9aca4');
        g.addColorStop(0.5, '#a2a59d');
        g.addColorStop(1, '#9a9d95');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 512, 512);

        // Marbrures larges : le PVC n'est jamais d'une seule teinte. Ces
        // grandes taches cassent la répétition de la texture, qui sinon se
        // lit comme un damier depuis le fond de la salle.
        for (let i = 0; i < 26; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const r = 40 + Math.random() * 120;
            const tache = ctx.createRadialGradient(x, y, 2, x, y, r);
            const clair = Math.random() > 0.5;
            tache.addColorStop(0, clair ? 'rgba(226,232,240,0.055)' : 'rgba(40,44,50,0.07)');
            tache.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = tache;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }

        // Moucheture du PVC : les agrégats de résine sont visibles de près.
        for (let i = 0; i < 11000; i++) {
            const r = Math.random();
            ctx.fillStyle = r > 0.86 ? 'rgba(226,232,240,0.10)'
                : r > 0.62 ? 'rgba(148,163,184,0.08)'
                    : 'rgba(0,0,0,0.05)';
            ctx.fillRect(Math.random() * 512, Math.random() * 512, 2.4, 2.4);
        }

        // Soudures des dalles (entrelaces tous les 256 px = 4 dalles de 64).
        ctx.strokeStyle = 'rgba(0,0,0,0.20)';
        ctx.lineWidth = 2.2;
        for (let i = 0; i <= 512; i += 256) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.035)';
        ctx.lineWidth = 1;
        for (let i = 3; i <= 512; i += 256) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
        }

        // Traces de roulettes.
        //
        // ATTENTION : la texture se RÉPÈTE sur le sol. Des traces marquées
        // à chaque dalle se clonent, et le motif devient un damier visible
        // de loin — c'est le défaut le plus évident d'un sol texturé. On les
        // garde donc très basses, et on casse la régularité en les décalant
        // aléatoirement dans la texture.
        for (let i = 0; i < 10; i++) {
            ctx.strokeStyle = 'rgba(15,23,42,0.035)';
            ctx.lineWidth = 3 + Math.random() * 6;
            ctx.beginPath();
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            ctx.arc(x, y, 30 + Math.random() * 110, Math.random() * 6, Math.random() * 3 + 1);
            ctx.stroke();
        }

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        // Des dalles de ~60 cm sur une salle de 11 x 10 m : c'est la taille
        // réelle d'un PVC de salle, et ça évite l'effet « grandes dalles ».
        tex.repeat.set(7, 6.5);
        tex.anisotropy = 8;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    });
}

/**
 * Rugosité du sol : un sol fraîchement nettoyé n'est pas uniforme, et c'est
 * ce qui fait accrocher le reflet des plafonniers.
 */
export function makeFloorRoughnessSalle() {
    return cache('salle:floorRough', () => {
        const [c, ctx] = makeCanvas(256, 256);
        ctx.fillStyle = '#6e6e6e';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 170; i++) {
            const g = ctx.createRadialGradient(
                Math.random() * 256, Math.random() * 256, 2,
                Math.random() * 256, Math.random() * 256, 30 + Math.random() * 70
            );
            g.addColorStop(0, 'rgba(45,45,45,0.55)');
            g.addColorStop(1, 'rgba(120,120,120,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 256, 256);
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(4, 3.6);
        return tex;
    });
}

/* ------------------------------------------------------------------ */
/* MURS — deux tons : vert d'eau en bas, blanc cassé en haut           */
/* ------------------------------------------------------------------ */

/**
 * Hauteur du bandeau vert d'eau, en fraction de la hauteur du mur.
 */
export const RATIO_BANDEAU_MUR = 0.23;

/** Largeur d'une répétition de texture de mur, en mètres. */
export const LARGEUR_TUILE_MUR = 3.6;

/**
 * Mur peint à deux tons, comme dans un hôpital français : le bas en vert
 * d'eau (la « couleur de l'hôpital »), le haut en blanc cassé, avec une
 * main-courante qui protège le mur des brancards.
 *
 * Le dégradé est VERTICAL et baked dans la texture : le bas de l'image
 * canvas correspond au bas du mur (three.js retourne l'axe V par défaut).
 *
 * @param {number} bandeRatio hauteur du bandeau en bas, en fraction de la
 *                             hauteur totale du mur
 */
export function makeWallTextureSalle(bandeRatio = RATIO_BANDEAU_MUR) {
    return cache(`salle:wall:${bandeRatio}`, () => {
        const W = 256;
        const H = 512;
        const [c, ctx] = makeCanvas(W, H);
        const bandeY = H * (1 - bandeRatio);

        // Partie haute : blanc cassé, légèrement grisé vers le bas.
        const haut = ctx.createLinearGradient(0, 0, 0, bandeY);
        haut.addColorStop(0, '#eef2f5');
        haut.addColorStop(1, '#dbe2e8');
        ctx.fillStyle = haut;
        ctx.fillRect(0, 0, W, bandeY);

        // Bandeau vert d'eau (vert hospitalier).
        const bas = ctx.createLinearGradient(0, bandeY, 0, H);
        bas.addColorStop(0, '#6f9a94');
        bas.addColorStop(0.35, '#5d8a85');
        bas.addColorStop(1, '#4d7a76');
        ctx.fillStyle = bas;
        ctx.fillRect(0, bandeY, W, H - bandeY);

        // Ligne de séparation (peinture plus brillante sur le chant).
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(0, bandeY - 2, W, 2);

        // Grain de la peinture.
        for (let i = 0; i < 5200; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';
            ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
        }

        // Coups de brancard et frottements, concentrés en bas.
        for (let i = 0; i < 14; i++) {
            ctx.strokeStyle = 'rgba(0,0,0,0.05)';
            ctx.lineWidth = 1 + Math.random() * 3;
            ctx.beginPath();
            const y = bandeY + Math.random() * (H - bandeY);
            ctx.moveTo(Math.random() * W, y);
            ctx.lineTo(Math.random() * W, y + Math.random() * 8 - 4);
            ctx.stroke();
        }

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.anisotropy = 4;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    });
}

/**
 * Clone de la texture de mur avec une répétition horizontale propre.
 * Le clone partage l'image (donc pas de second canvas) mais a son propre
 * `repeat`, ce qui évite d'avoir un matériau par mur.
 *
 * @param {number} bandeRatio
 * @param {number} repeatX
 */
export function makeWallTextureSalleRepetee(bandeRatio, repeatX) {
    return cache(`salle:wall:${bandeRatio}:${repeatX}`, () => {
        const tex = makeWallTextureSalle(bandeRatio).clone();
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.repeat.set(repeatX, 1);
        tex.needsUpdate = true;
        return tex;
    });
}

/* ------------------------------------------------------------------ */
/* PLAFOND — dalles acoustiques percées + ossature en T               */
/* ------------------------------------------------------------------ */

export function makeCeilingTextureSalle() {
    return cache('salle:ceiling', () => {
        const [c, ctx] = makeCanvas(256, 256);
        ctx.fillStyle = '#e3e8ee';
        ctx.fillRect(0, 0, 256, 256);

        // Perforations des dalles.
        for (let y = 8; y < 256; y += 10) {
            for (let x = 8; x < 256; x += 10) {
                ctx.fillStyle = 'rgba(100,116,139,0.32)';
                ctx.beginPath();
                ctx.arc(x, y, 1.35, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Ossature en T : grille métallique visible entre les dalles.
        ctx.strokeStyle = '#aab4c0';
        ctx.lineWidth = 7;
        ctx.strokeRect(0, 0, 256, 256);
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(4, 4, 248, 248);

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(7, 6);
        tex.anisotropy = 4;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    });
}

/* ------------------------------------------------------------------ */
/* AFFICHES ET PLAQUES                                                 */
/* ------------------------------------------------------------------ */

/**
 * Affiche de prévention (hygiène des mains, etc.).
 * @param {string} titre
 * @param {string[]} lignes
 * @param {string} accent couleur du bandeau de titre
 * @param {string} fond
 */
export function makePosterTextureSalle(titre, lignes, accent = '#0e7490', fond = '#f8fafc') {
    return cache(`salle:poster:${titre}:${accent}:${lignes.join('|')}`, () => {
        const [c, ctx] = makeCanvas(512, 680);
        ctx.fillStyle = fond;
        ctx.fillRect(0, 0, 512, 680);

        ctx.fillStyle = accent;
        ctx.fillRect(0, 0, 512, 92);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(titre, 256, 58);

        ctx.textAlign = 'left';
        lignes.forEach((l, i) => {
            const y = 150 + i * 46;
            if (l.startsWith('#')) {
                ctx.fillStyle = accent;
                ctx.font = 'bold 24px sans-serif';
                ctx.fillText(l.slice(1), 32, y);
            } else {
                ctx.fillStyle = '#1e293b';
                ctx.font = '21px sans-serif';
                ctx.fillText('• ' + l, 32, y);
            }
        });

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 508, 676);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    });
}
