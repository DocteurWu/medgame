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

export function dampVec3(out, target, lambda, dt) {
    out.x = damp(out.x, target.x, lambda, dt);
    out.y = damp(out.y, target.y, lambda, dt);
    out.z = damp(out.z, target.z, lambda, dt);
    return out;
}

/* ---------- Libération mémoire profonde ---------- */
function disposeMaterial(mat) {
    if (!mat) return;
    for (const key of Object.keys(mat)) {
        const val = mat[key];
        if (val && val.isTexture) val.dispose();
    }
    mat.dispose();
}

export function disposeObject3D(root) {
    if (!root) return;
    root.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        const m = obj.material;
        if (Array.isArray(m)) m.forEach(disposeMaterial);
        else if (m) disposeMaterial(m);
    });
    root.parent?.remove(root);
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

/* ---------- Layer dédié au bloom sélectif (écrans, LEDs) ---------- */
export const BLOOM_LAYER = 1;
export function markAsBloom(obj) {
    obj.traverse?.(o => o.layers.enable(BLOOM_LAYER)) ?? obj.layers.enable(BLOOM_LAYER);
}
