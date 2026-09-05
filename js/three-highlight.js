import * as THREE from 'three';
import { damp } from './three-core-utils.js';

/**
 * Surbrillance de survol SANS corruption des matériaux partagés.
 * Stratégie : swap vers un clone mis en cache (Map<Material, Material>),
 * + crochets de ciblage type "viseur" autour de la bounding box.
 */
export class HoverHighlighter {
    constructor(scene, {
        color = 0x8ad4ff, emissiveBoost = 0.42, liftAmount = 0.014, brackets = true,
    } = {}) {
        this.scene = scene;
        this.color = new THREE.Color(color);
        this.emissiveBoost = emissiveBoost;
        this.liftAmount = liftAmount;

        this._cache = new Map();     // material original -> material surligné
        this._swapped = [];          // { mesh, original }
        this._current = null;
        this._lift = 0;
        this._baseY = 0;
        this._prev = null;
        this._prevBaseY = 0;
        this._pulse = 0;

        this._brackets = brackets ? this._createBrackets() : null;
        if (this._brackets) scene.add(this._brackets);
        this._box = new THREE.Box3();
        this._size = new THREE.Vector3();
        this._center = new THREE.Vector3();
    }

    /* ---------- API ---------- */

    set(root) {
        if (root === this._current) return;

        this._restore();
        if (this._current) { this._prev = this._current; this._prevBaseY = this._baseY; }

        this._current = root;
        if (root) {
            this._baseY = root.position.y;
            this._apply(root);
            this._fitBrackets(root);
        } else if (this._brackets) {
            this._brackets.visible = false;
        }
    }

    update(dt, camera) {
        this._pulse += dt;

        // Redescente de l'objet précédent
        if (this._prev) {
            const lift = this._prev.position.y - this._prevBaseY;
            if (lift > 0.0004) this._prev.position.y = this._prevBaseY + damp(lift, 0, 9, dt);
            else { this._prev.position.y = this._prevBaseY; this._prev = null; }
        }

        // Montée de l'objet courant
        if (this._current) {
            this._lift = damp(this._lift, this.liftAmount, 13, dt);
            this._current.position.y = this._baseY + this._lift;
        } else {
            this._lift = damp(this._lift, 0, 9, dt);
        }

        if (this._brackets?.visible && this._current) {
            const s = 1 + Math.sin(this._pulse * 4.2) * 0.02;
            this._brackets.scale.setScalar(this._bracketScale * s);
            this._brackets.material.opacity = 0.55 + Math.sin(this._pulse * 4.2) * 0.2;
            this._brackets.position.copy(this._center);
            this._brackets.position.y = this._center.y + this._lift;
            if (camera) this._brackets.quaternion.copy(camera.quaternion);
        }
    }

    dispose() {
        this._restore();
        for (const m of this._cache.values()) m.dispose();
        this._cache.clear();
        if (this._brackets) {
            this._brackets.geometry.dispose();
            this._brackets.material.dispose();
            this.scene.remove(this._brackets);
        }
    }

    /* ---------- Interne ---------- */

    _highlightVariant(src) {
        let clone = this._cache.get(src);
        if (clone) return clone;
        clone = src.clone();
        if (clone.emissive) {
            clone.emissive = this.color.clone();
            clone.emissiveIntensity = (src.emissiveIntensity ?? 0) + this.emissiveBoost;
        } else {
            clone.color = clone.color?.clone().lerp(this.color, 0.25) ?? clone.color;
        }
        clone.userData.__isHighlight = true;
        this._cache.set(src, clone);
        return clone;
    }

    _apply(root) {
        root.traverse((mesh) => {
            if (!mesh.isMesh || !mesh.material) return;
            if (mesh.userData.noHighlight) return;
            const original = mesh.material;
            if (Array.isArray(original)) {
                mesh.material = original.map(m => this._highlightVariant(m));
            } else {
                mesh.material = this._highlightVariant(original);
            }
            this._swapped.push({ mesh, original });
        });
    }

    _restore() {
        for (const { mesh, original } of this._swapped) mesh.material = original;
        this._swapped.length = 0;
        if (this._current) this._current.position.y = this._baseY;
    }

    _createBrackets() {
        // 8 coins en L, dans un carré unité centré (billboardé sur la caméra)
        const L = 0.28, H = 0.5;
        const pts = [];
        const corner = (sx, sy) => {
            pts.push(sx * H, sy * H, 0, sx * (H - L), sy * H, 0);
            pts.push(sx * H, sy * H, 0, sx * H, sy * (H - L), 0);
        };
        corner(1, 1); corner(-1, 1); corner(1, -1); corner(-1, -1);

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        const mat = new THREE.LineBasicMaterial({
            color: 0x8ad4ff, transparent: true, opacity: 0.7,
            depthTest: false, toneMapped: false,
        });
        const lines = new THREE.LineSegments(geo, mat);
        lines.renderOrder = 999;
        lines.visible = false;
        lines.frustumCulled = false;
        return lines;
    }

    _fitBrackets(root) {
        if (!this._brackets) return;
        this._box.setFromObject(root);
        if (this._box.isEmpty()) { this._brackets.visible = false; return; }
        this._box.getSize(this._size);
        this._box.getCenter(this._center);
        this._bracketScale = Math.max(this._size.x, this._size.y, this._size.z) * 1.45;
        this._brackets.visible = true;
    }
}
