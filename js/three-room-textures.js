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
/* Aléa déterministe                                                   */
/* ------------------------------------------------------------------ */

/**
 * PRNG mulberry32. Les textures sont tirées au hasard, mais avec une graine
 * fixe : la salle a le même sol à chaque partie (et deux captures d'écran
 * sont comparables), au lieu d'un motif qui change à chaque reconstruction.
 * @param {number} seed
 */
function prng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/* ------------------------------------------------------------------ */
/* SOL — PVC en lés soudés (« sol coulé » hospitalier)                 */
/* ------------------------------------------------------------------ */

/** Côté, en mètres, de la surface couverte par une répétition du sol. */
export const TUILE_SOL_M = 2;

/**
 * Sol PVC homogène en lés de 2 m, soudés à chaud.
 *
 * Un sol de service n'est PAS carrelé : c'est un revêtement continu
 * (type Tarkett iQ Granit) posé en lés, dont seule la soudure est visible,
 * une ligne tous les deux mètres. Les dalles de 60 cm de l'ancienne version
 * faisaient « hall de gare » ; c'est le premier indice qui trahissait le
 * décor. Le motif est une moucheture de copeaux de couleur, très fine, sur
 * un gris chaud clair.
 *
 * La texture couvre 2 m × 2 m : `repeat` = dimensions de la salle / 2.
 */
export function makeFloorTextureSalle() {
    return cache('salle:floor', () => {
        const S = 1024;
        const rnd = prng(17);
        const [c, ctx] = makeCanvas(S, S);
        ctx.fillStyle = '#b9bbb5';
        ctx.fillRect(0, 0, S, S);

        // Nuages très larges et très doux : le PVC n'est jamais d'une seule
        // teinte, et ces nuances cassent la répétition vue de loin.
        for (let i = 0; i < 40; i++) {
            const x = rnd() * S, y = rnd() * S, r = 120 + rnd() * 260;
            const g = ctx.createRadialGradient(x, y, 4, x, y, r);
            const clair = rnd() > 0.5;
            g.addColorStop(0, clair ? 'rgba(236,236,230,0.10)' : 'rgba(70,72,70,0.07)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
                ctx.save(); ctx.translate(ox, oy);
                ctx.fillRect(x - r, y - r, r * 2, r * 2);
                ctx.restore();
            }
        }

        // Copeaux colorés du granit vinyle : gris, blanc, anthracite, et une
        // pointe de bleu-vert. Petits et nombreux, comme sur un vrai lé.
        const chips = [
            [232, 232, 226, 0.55], [150, 152, 148, 0.55], [96, 98, 96, 0.45],
            [120, 146, 150, 0.35], [205, 200, 188, 0.5]
        ];
        for (let i = 0; i < 60000; i++) {
            const [r, g, b, a] = chips[(rnd() * chips.length) | 0];
            ctx.fillStyle = `rgba(${r},${g},${b},${a * (0.3 + rnd() * 0.7)})`;
            const w = 1 + rnd() * 2.6, h = 1 + rnd() * 2.2;
            ctx.fillRect(rnd() * S, rnd() * S, w, h);
        }

        // Soudure du lé : un seul cordon, sur un bord (la texture se répète,
        // donc une soudure tous les 2 m), légèrement plus sombre.
        ctx.fillStyle = 'rgba(80,84,82,0.35)';
        ctx.fillRect(0, 0, 3, S);
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(3, 0, 1, S);

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = 8;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    });
}

/**
 * Rugosité du sol : un sol de service est ciré, donc assez brillant pour
 * refléter les plafonniers, mais jamais uniformément — les passages de
 * l'autolaveuse laissent des arcs plus mats. La valeur du canal est la
 * rugosité finale (le matériau est réglé à `roughness: 1`).
 */
export function makeFloorRoughnessSalle() {
    return cache('salle:floorRough', () => {
        const S = 512;
        const rnd = prng(29);
        const [c, ctx] = makeCanvas(S, S);
        ctx.fillStyle = 'rgb(84,84,84)'; // ≈ 0.33
        ctx.fillRect(0, 0, S, S);
        // Arcs de l'autolaveuse : larges, lents, à peine plus mats.
        ctx.lineCap = 'round';
        for (let i = 0; i < 26; i++) {
            ctx.strokeStyle = `rgba(130,130,130,${0.03 + rnd() * 0.04})`;
            ctx.lineWidth = 18 + rnd() * 40;
            ctx.beginPath();
            const x = rnd() * S, y = rnd() * S, r = 80 + rnd() * 220;
            ctx.arc(x, y, r, rnd() * 6, rnd() * 6 + 1.2);
            ctx.stroke();
        }
        // Micro-variation : casse le reflet « miroir parfait ».
        const img = ctx.getImageData(0, 0, S, S);
        for (let i = 0; i < img.data.length; i += 4) {
            const n = (rnd() - 0.5) * 22;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, img.data[i] + n));
        }
        ctx.putImageData(img, 0, 0);
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = 4;
        return tex;
    });
}

/* ------------------------------------------------------------------ */
/* MURS — peinture lessivable, occlusion de la corniche baked          */
/* ------------------------------------------------------------------ */

/** Largeur d'une répétition de texture de mur, en mètres. */
export const LARGEUR_TUILE_MUR = 2.5;

/**
 * Peinture murale satinée blanc cassé.
 *
 * Le bas du mur est couvert par la protection murale (lambris vinyle posé
 * par `ThreeEnvironmentAgent._addWallWainscot`), donc la peinture ne porte
 * que la partie haute. Elle intègre l'OCCLUSION de l'angle mur/plafond :
 * un assombrissement doux sur les derniers centimètres, que l'éclairage
 * temps réel ne produit pas sans passe d'AO — et dont l'absence est ce qui
 * donne à une pièce 3D son air de maquette.
 *
 * Axe V : le haut de l'image est le haut du mur (three.js retourne V).
 */
export function makeWallTextureSalle() {
    return cache('salle:wall', () => {
        const W = 256, H = 512;
        const rnd = prng(41);
        const [c, ctx] = makeCanvas(W, H);
        ctx.fillStyle = '#ecebe6';
        ctx.fillRect(0, 0, W, H);

        // Reprises de rouleau : bandes verticales presque invisibles.
        for (let x = 0; x < W; x += 18 + rnd() * 30) {
            ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.022)';
            ctx.fillRect(x, 0, 10 + rnd() * 24, H);
        }
        // Grain de la peinture.
        for (let i = 0; i < 9000; i++) {
            ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)';
            ctx.fillRect(rnd() * W, rnd() * H, 1.5, 1.5);
        }
        // Occlusion de la corniche (haut) et ombre portée du lambris (bas).
        const top = ctx.createLinearGradient(0, 0, 0, H * 0.12);
        top.addColorStop(0, 'rgba(40,44,48,0.30)');
        top.addColorStop(1, 'rgba(40,44,48,0)');
        ctx.fillStyle = top;
        ctx.fillRect(0, 0, W, H * 0.12);

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
 * @param {number} repeatX
 */
export function makeWallTextureSalleRepetee(repeatX) {
    return cache(`salle:wall:${repeatX}`, () => {
        const tex = makeWallTextureSalle().clone();
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.repeat.set(repeatX, 1);
        tex.needsUpdate = true;
        return tex;
    });
}

/**
 * Protection murale vinyle (bas des murs) : vert d'eau pâle, grain fin
 * « toile », la couleur des couloirs de CHU.
 */
export function makeWainscotTexture() {
    return cache('salle:wainscot', () => {
        const S = 256;
        const rnd = prng(53);
        const [c, ctx] = makeCanvas(S, S);
        ctx.fillStyle = '#b7cfc8';
        ctx.fillRect(0, 0, S, S);
        for (let y = 0; y < S; y += 2) {
            ctx.fillStyle = `rgba(0,0,0,${0.012 + rnd() * 0.02})`;
            ctx.fillRect(0, y, S, 1);
        }
        for (let x = 0; x < S; x += 3) {
            ctx.fillStyle = `rgba(255,255,255,${0.01 + rnd() * 0.02})`;
            ctx.fillRect(x, 0, 1, S);
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    });
}

/* ------------------------------------------------------------------ */
/* PLAFOND — dalle minérale 60 × 60 fissurée + ossature en T          */
/* ------------------------------------------------------------------ */

/** Côté d'une dalle de plafond, en mètres (une répétition de texture). */
export const DALLE_PLAFOND_M = 0.6;

/** Une dalle de faux plafond (fibre minérale « fissurée ») et son ossature. */
export function makeCeilingTextureSalle() {
    return cache('salle:ceiling', () => {
        const S = 256;
        const rnd = prng(67);
        const [c, ctx] = makeCanvas(S, S);
        ctx.fillStyle = '#f1f0ec';
        ctx.fillRect(0, 0, S, S);
        // Fissures et piqûres de la fibre minérale.
        for (let i = 0; i < 900; i++) {
            ctx.fillStyle = `rgba(110,112,110,${0.10 + rnd() * 0.22})`;
            const x = rnd() * S, y = rnd() * S;
            if (rnd() > 0.7) {
                ctx.fillRect(x, y, 1 + rnd() * 5, 1);
            } else {
                ctx.beginPath(); ctx.arc(x, y, 0.5 + rnd() * 1.1, 0, Math.PI * 2); ctx.fill();
            }
        }
        // Ossature en T (profil laqué blanc) avec son ombre fine.
        ctx.fillStyle = '#e4e4e0';
        ctx.fillRect(0, 0, S, 6); ctx.fillRect(0, 0, 6, S);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(6, 6, S - 6, 2); ctx.fillRect(6, 6, 2, S - 6);

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = 4;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    });
}

/* ------------------------------------------------------------------ */
/* OCCLUSION AMBIANTE — dégradé posé dans les angles                  */
/* ------------------------------------------------------------------ */

/**
 * Dégradé d'occlusion : noir opaque en bas (V = 0) → transparent en haut.
 * Posé sur de fines bandes le long des angles (sol/mur, mur/mur), il donne
 * l'assombrissement de contact qu'une passe d'AO calculerait — pour le prix
 * d'un seul programme `MeshBasicMaterial` partagé, sans passe de rendu.
 */
export function makeAOGradientTexture() {
    return cache('salle:ao', () => {
        const [c, ctx] = makeCanvas(4, 128);
        const g = ctx.createLinearGradient(0, 128, 0, 0);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(0.25, 'rgba(0,0,0,0.45)');
        g.addColorStop(0.6, 'rgba(0,0,0,0.12)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 4, 128);
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        return tex;
    });
}

/* ------------------------------------------------------------------ */
/* TEXTILES — rideau de box, store, couverture                         */
/* ------------------------------------------------------------------ */

/**
 * Rideau séparatif de box : polyester ignifugé à petits motifs, avec la
 * bande de filet aéré en partie haute (obligatoire pour les sprinklers —
 * c'est le détail que tout soignant reconnaît).
 * Axe V : le haut de l'image est le haut du rideau.
 */
export function makeCurtainTexture() {
    return cache('salle:curtain', () => {
        const W = 256, H = 512;
        const rnd = prng(79);
        const [c, ctx] = makeCanvas(W, H);
        const filet = H * 0.16;
        // Filet aéré.
        ctx.fillStyle = '#e9eef0';
        ctx.fillRect(0, 0, W, filet);
        ctx.strokeStyle = 'rgba(120,130,135,0.55)';
        ctx.lineWidth = 1;
        for (let x = -filet; x < W + filet; x += 7) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + filet, filet); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x + filet, 0); ctx.lineTo(x, filet); ctx.stroke();
        }
        // Tissu : bleu clair hospitalier, petits carrés tissés.
        ctx.fillStyle = '#9fc3d4';
        ctx.fillRect(0, filet, W, H - filet);
        for (let y = filet; y < H; y += 16) {
            for (let x = (y / 16) % 2 ? 8 : 0; x < W; x += 16) {
                ctx.fillStyle = 'rgba(255,255,255,0.16)';
                ctx.fillRect(x + 3, y + 3, 6, 6);
            }
        }
        for (let i = 0; i < 4000; i++) {
            ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
            ctx.fillRect(rnd() * W, filet + rnd() * (H - filet), 2, 1);
        }
        // Ourlet et bande de couture sous le filet.
        ctx.fillStyle = '#7fa9bd';
        ctx.fillRect(0, filet, W, 6);
        ctx.fillRect(0, H - 8, W, 8);
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        return tex;
    });
}

/** Toile de store enrouleur (screen occultant beige clair, trame visible). */
export function makeBlindTexture() {
    return cache('salle:blind', () => {
        const S = 128;
        const [c, ctx] = makeCanvas(S, S);
        ctx.fillStyle = '#e7e2d6';
        ctx.fillRect(0, 0, S, S);
        for (let i = 0; i < S; i += 2) {
            ctx.fillStyle = 'rgba(0,0,0,0.035)';
            ctx.fillRect(0, i, S, 1);
            ctx.fillRect(i, 0, 1, S);
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    });
}

/** Couverture de lit (coton gaufré bleu pâle, liseré). */
export function makeBlanketTexture() {
    return cache('salle:blanket', () => {
        const S = 256;
        const [c, ctx] = makeCanvas(S, S);
        ctx.fillStyle = '#c9dbe6';
        ctx.fillRect(0, 0, S, S);
        for (let y = 0; y < S; y += 8) {
            for (let x = 0; x < S; x += 8) {
                ctx.fillStyle = 'rgba(255,255,255,0.18)';
                ctx.fillRect(x + 1, y + 1, 5, 5);
                ctx.fillStyle = 'rgba(40,70,90,0.06)';
                ctx.fillRect(x, y, 8, 1);
            }
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        return tex;
    });
}

/* ------------------------------------------------------------------ */
/* VUE EXTÉRIEURE — cour d'hôpital, de jour comme de nuit              */
/* ------------------------------------------------------------------ */

/**
 * Ce que l'on voit par la fenêtre : la cour intérieure d'un CHU, un
 * bâtiment de soins en face (façade à bandeaux de fenêtres), des arbres,
 * le ciel. De nuit, la façade s'allume fenêtre par fenêtre — c'est ce qui
 * fait sentir qu'on est de garde.
 * @param {boolean} nuit
 */
export function makeExteriorViewTexture(nuit = false) {
    return cache(`salle:exterior:${nuit ? 'n' : 'j'}`, () => {
        const W = 1024, H = 512;
        const rnd = prng(nuit ? 97 : 89);
        const [c, ctx] = makeCanvas(W, H);

        // Ciel.
        const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7);
        if (nuit) {
            sky.addColorStop(0, '#0b1424'); sky.addColorStop(0.7, '#1b2a44'); sky.addColorStop(1, '#3a3f55');
        } else {
            sky.addColorStop(0, '#6ea7dc'); sky.addColorStop(0.6, '#b5d3ee'); sky.addColorStop(1, '#e9f1f7');
        }
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);

        if (!nuit) {
            // Cumulus doux.
            for (let i = 0; i < 14; i++) {
                const cx = rnd() * W, cy = 30 + rnd() * 150, r = 40 + rnd() * 90;
                for (let k = 0; k < 6; k++) {
                    const x = cx + (rnd() - 0.5) * r * 1.6, y = cy + (rnd() - 0.5) * r * 0.35;
                    const g = ctx.createRadialGradient(x, y, 2, x, y, r * 0.6);
                    g.addColorStop(0, 'rgba(255,255,255,0.75)');
                    g.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.fillStyle = g;
                    ctx.fillRect(x - r, y - r, r * 2, r * 2);
                }
            }
        } else {
            for (let i = 0; i < 90; i++) {
                ctx.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.5})`;
                ctx.fillRect(rnd() * W, rnd() * H * 0.4, 1.2, 1.2);
            }
        }

        // Bâtiment de soins en vis-à-vis : façade claire à bandeaux.
        const drawBuilding = (x0, w, top, base, facade) => {
            ctx.fillStyle = facade;
            ctx.fillRect(x0, top, w, base - top);
            ctx.fillStyle = nuit ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.12)';
            ctx.fillRect(x0, top, w, 6);
            for (let y = top + 18; y < base - 20; y += 34) {
                for (let x = x0 + 10; x < x0 + w - 24; x += 30) {
                    const lit = nuit && rnd() > 0.45;
                    ctx.fillStyle = nuit
                        ? (lit ? (rnd() > 0.3 ? '#f5dca0' : '#cfe3ff') : '#1d2638')
                        : (rnd() > 0.85 ? '#9fb3c4' : '#6f8aa3');
                    ctx.fillRect(x, y, 20, 18);
                    if (!nuit) {
                        ctx.fillStyle = 'rgba(255,255,255,0.25)';
                        ctx.fillRect(x, y, 20, 4);
                    }
                }
            }
        };
        drawBuilding(-20, 520, 150, 390, nuit ? '#2c3444' : '#d9d4c8');
        drawBuilding(560, 300, 205, 390, nuit ? '#262d3b' : '#c8ccd0');
        drawBuilding(880, 200, 175, 390, nuit ? '#2a3140' : '#e1dbcf');

        // Rangée d'arbres de la cour (houppiers superposés).
        for (let i = 0; i < 70; i++) {
            const x = rnd() * W, y = 360 + rnd() * 40, r = 22 + rnd() * 34;
            const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
            if (nuit) { g.addColorStop(0, '#1e2b26'); g.addColorStop(1, '#0f1714'); }
            else { g.addColorStop(0, '#7fa064'); g.addColorStop(1, '#4b6a3e'); }
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        // Pelouse / allée.
        ctx.fillStyle = nuit ? '#141c1a' : '#7d9468';
        ctx.fillRect(0, 410, W, H - 410);
        ctx.fillStyle = nuit ? '#262a2e' : '#c9c4b6';
        ctx.fillRect(0, 450, W, 26);
        if (nuit) {
            for (let x = 60; x < W; x += 220) {
                const g = ctx.createRadialGradient(x, 440, 2, x, 440, 70);
                g.addColorStop(0, 'rgba(255,214,150,0.6)');
                g.addColorStop(1, 'rgba(255,214,150,0)');
                ctx.fillStyle = g;
                ctx.fillRect(x - 70, 370, 140, 140);
            }
        }

        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
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
