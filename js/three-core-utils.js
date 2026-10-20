import * as THREE from 'three';

/* ---------- Easings ---------- */
export const Easing = {
    linear:      t => t,
    outCubic:    t => 1 - Math.pow(1 - t, 3),
    inOutCubic:  t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inOutSine:   t => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack:     t => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
};

/* ---------- Préférences système ---------- */
let _rmQuery = null;
export function prefersReducedMotion() {
    if (typeof matchMedia !== 'function') return false;
    if (!_rmQuery) _rmQuery = matchMedia('(prefers-reduced-motion: reduce)');
    return _rmQuery.matches;
}

/* ---------- Interpolation framerate-independent ---------- */
export const damp = (a, b, lambda, dt) => THREE.MathUtils.damp(a, b, lambda, dt);

import { SceneDisposer } from './scene-disposer.js';

/* ---------- Libération mémoire profonde ---------- */
export function disposeMaterial(mat) {
    SceneDisposer.disposeMaterial(mat);
}

/**
 * Surveille l'affichage des overlays 2D sans polling DOM.
 * Recalcule uniquement quand le DOM change (MutationObserver).
 */
export class OverlayWatcher {
    constructor(ids = []) {
        this.ids = ids;
        this._dirty = true;
        this._value = false;
        if (typeof document !== 'undefined' && document.body) {
            this._obs = new MutationObserver(() => { this._dirty = true; });
            this._obs.observe(document.body, {
                childList: true, subtree: true, attributes: true,
                attributeFilter: ['style', 'class', 'aria-hidden', 'hidden', 'open'],
            });
        } else {
            this._obs = null;
        }
    }

    get visible() {
        if (this._dirty) { this._value = this._compute(); this._dirty = false; }
        return this._value;
    }

    invalidate() { this._dirty = true; }

    _compute() {
        if (typeof document === 'undefined') return false;
        for (const id of this.ids) {
            const el = document.getElementById(id);
            if (!el || el.hidden) continue;
            if (el.getAttribute('aria-hidden') === 'true') continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            if (parseFloat(cs.opacity) < 0.02) continue;
            return true;
        }
        return false;
    }

    dispose() {
        if (this._obs) this._obs.disconnect();
    }
}
