/**
 * three-view-core.js — géométrie d'écran et règles d'interaction de la vue 3D.
 *
 * Module PUR : aucun import (ni three.js, ni DOM), donc testable sous Node
 * (`test/three-view.test.mjs`). Tout ce qui décide « où est le pointeur »,
 * « que fait Échap », « où poser la bulle » vit ici, parce que ces règles se
 * cassent en silence : une erreur de signe dans la conversion du pointeur a
 * suffi à éteindre tout le survol de la salle sans la moindre erreur console.
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Coordonnées client (pixels) → coordonnées normalisées de l'appareil
 * (x et y dans [-1, 1], y vers le HAUT), telles que les attend un Raycaster.
 * @param {number} clientX
 * @param {number} clientY
 * @param {{left:number, top:number, width:number, height:number}} rect
 * @param {{x:number, y:number}} [out]
 */
export function clientToNDC(clientX, clientY, rect, out = { x: 0, y: 0 }) {
    const w = rect.width || 1;
    const h = rect.height || 1;
    out.x = ((clientX - rect.left) / w) * 2 - 1;
    out.y = -((clientY - rect.top) / h) * 2 + 1;
    return out;
}

/**
 * Panneaux contextuels de la vue 3D, du plus « au-dessus » au plus profond.
 * Échap ferme d'abord le premier ouvert de cette liste.
 */
export const PANEL_PRIORITY = ['armoire', 'pc', 'examMenu', 'dialog'];

/**
 * Ce que fait la touche Échap, par paliers : fermer le panneau du dessus,
 * sinon revenir à la vue d'ensemble, sinon seulement quitter la 3D.
 * (Avant : un seul appui quittait la 3D, même dialogue ouvert.)
 * @param {{openPanels?: string[], cameraMode?: string, modalOpen?: boolean}} state
 * @returns {{action: 'close'|'room'|'exit'|'none', panel?: string}}
 */
export function escapeTarget({ openPanels = [], cameraMode = 'room', modalOpen = false } = {}) {
    for (const panel of PANEL_PRIORITY) {
        if (openPanels.includes(panel)) return { action: 'close', panel };
    }
    // Une modale du jeu (ordonnance, correction, annonce ECOS…) gère son
    // propre Échap : on ne lui vole pas la touche.
    if (modalOpen) return { action: 'none' };
    if (cameraMode !== 'room') return { action: 'room' };
    return { action: 'exit' };
}

/**
 * Cadrage de conversation : plan rapproché à hauteur de visage, pris du côté
 * où se tient le médecin (trois quarts, vers le pied du lit).
 * @param {number[]} head — position monde [x, y, z] de la tête du patient
 * @param {{distance?: number}} [opts]
 * @returns {{pos: number[], target: number[]}}
 */
export function dialogueShot(head, { distance = 1.75 } = {}) {
    const dir = [-0.62, 0.1, 0.78];
    const n = Math.hypot(dir[0], dir[1], dir[2]);
    return {
        pos: [
            head[0] + (dir[0] / n) * distance,
            head[1] + (dir[1] / n) * distance + 0.04,
            head[2] + (dir[2] / n) * distance,
        ],
        target: [head[0], head[1] - 0.04, head[2] + 0.05],
    };
}

/**
 * Décalage horizontal de l'image (fraction de la largeur) pour que le sujet
 * visé par la caméra tombe au centre de la zone LIBRE, à gauche d'un panneau
 * ancré à droite. 0 quand il n'y a pas de panneau ou que l'écran est étroit
 * (le panneau recouvre alors presque tout : décaler ne sert à rien).
 * @param {number} viewportW
 * @param {{left:number, width:number}|null} panel
 */
export function viewShiftFor(viewportW, panel) {
    if (!panel || !(viewportW >= 900)) return 0;
    const free = clamp(panel.left, 0, viewportW);
    return clamp((viewportW / 2 - free / 2) / viewportW, 0, 0.3);
}

/**
 * Position de la bulle de parole au-dessus de la tête du patient.
 * Renvoie `left` (centre horizontal) et `bottom` (distance au bas du HUD),
 * bornés pour rester à l'écran et hors du panneau de dialogue.
 * @param {{x:number, y:number, visible:boolean}} anchor — tête projetée, en px
 * @param {{width:number, height:number}} viewport
 * @param {{halfWidth?:number, margin?:number, gap?:number, topMin?:number, rightLimit?:number|null}} [opts]
 * @returns {{left:number, bottom:number}|null} null si la tête est hors champ
 */
export function placeBubble(anchor, viewport, opts = {}) {
    if (!anchor || !anchor.visible) return null;
    const { halfWidth = 150, margin = 12, gap = 26, topMin = 150, rightLimit = null } = opts;
    const right = (rightLimit ?? viewport.width) - halfWidth - margin;
    const leftMin = halfWidth + margin;
    const left = clamp(anchor.x, leftMin, Math.max(leftMin, right));
    const bottom = clamp(viewport.height - anchor.y + gap, margin, Math.max(margin, viewport.height - topMin));
    return { left: Math.round(left), bottom: Math.round(bottom) };
}

/**
 * Seuils d'alerte des constantes du bandeau, UNE valeur par bord :
 * `*Low` en dessous = alerte, `*High` au-dessus = alerte.
 * (Avant : un seul couple `[bas, haut]` servait aux deux rôles, et pour la
 * température `critical: [0, 35]` rendait « critique » tout ce qui dépassait
 * 35 °C — donc 36,9 °C —, idem pour la FR à 8/min : les deux cases étaient
 * rouges en permanence.)
 */
export const VITAL_RANGES = {
    'hud-hr':   { warnLow: 50,   warnHigh: 120,  critLow: 40, critHigh: 140 },
    'hud-spo2': { warnLow: 92,   warnHigh: Infinity, critLow: 85, critHigh: Infinity },
    'hud-temp': { warnLow: 35.5, warnHigh: 38.5, critLow: 35, critHigh: 40 },
    'hud-fr':   { warnLow: 10,   warnHigh: 25,   critLow: 8,  critHigh: 30 },
};

/**
 * Gravité d'une constante : 'normal' | 'warning' | 'critical'.
 * @param {string} id — id du champ du HUD (`hud-hr`, `hud-temp`…)
 * @param {number} value
 */
export function vitalLevel(id, value) {
    const r = VITAL_RANGES[id];
    if (!r || !Number.isFinite(value)) return 'normal';
    if (value <= r.critLow || value >= r.critHigh) return 'critical';
    if (value < r.warnLow || value > r.warnHigh) return 'warning';
    return 'normal';
}

/**
 * Vrai quand la caméra est « dans » l'avatar du médecin (distance au sol
 * inférieure au rayon) : on le masque au lieu de filmer l'intérieur de sa
 * blouse — c'était le cas de la vue « bureau ».
 */
export function avatarTooClose(cam, avatar, radius = 0.85) {
    return Math.hypot(cam.x - avatar.x, cam.z - avatar.z) < radius;
}
