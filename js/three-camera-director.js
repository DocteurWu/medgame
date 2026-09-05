import * as THREE from 'three';
import { Easing, prefersReducedMotion } from './three-core-utils.js';

/**
 * Pilote unique de la caméra guidée.
 * - un seul tween actif, mis à jour depuis la boucle de rendu (pas de rAF imbriqué)
 * - cadrage automatique sur bounding box (plus de "fly-to" qui traverse les murs)
 * - micro-mouvement "caméra à l'épaule" NON cumulatif
 */
export class CameraDirector {
    constructor(camera, controls, opts = {}) {
        this.camera = camera;
        this.controls = controls;
        this.reduced = opts.reducedMotion ?? prefersReducedMotion();

        this.bounds = {
            min: opts.min ?? new THREE.Vector3(-5.2, 0.45, -4.7),
            max: opts.max ?? new THREE.Vector3(5.2, 4.6, 4.7),
        };
        this.roomCenter = opts.roomCenter ?? new THREE.Vector3(0, 1.1, 0);

        this._tween = null;
        this._time = 0;
        this._appliedOffset = new THREE.Vector3();
        this.handheld = { enabled: !this.reduced, amp: 0.0055, freq: 0.27 };

        this._v1 = new THREE.Vector3();
        this._box = new THREE.Box3();
        this._sphere = new THREE.Sphere();
    }

    setBounds(min, max) { this.bounds.min.copy(min); this.bounds.max.copy(max); }

    clampToRoom(v) { return v.clamp(this.bounds.min, this.bounds.max); }

    get isAnimating() { return !!this._tween; }

    cancel() { this._tween = null; }

    /** Déplacement explicite position → cible. */
    moveTo(position, target, {
        duration = 700, ease = Easing.inOutCubic, arc = 0.22, onDone = null,
    } = {}) {
        const endPos = this.clampToRoom(position.clone());
        const endTarget = target.clone();

        if (this.reduced || duration <= 0) {
            this.camera.position.copy(endPos);
            this.controls.target.copy(endTarget);
            this.controls.update();
            onDone?.();
            return;
        }

        this._tween = {
            t: 0, duration: duration / 1000, ease, arc, onDone,
            startPos: this.camera.position.clone().sub(this._appliedOffset),
            startTarget: this.controls.target.clone(),
            endPos, endTarget,
        };
    }

    /**
     * Cadre un objet en tenant compte de sa taille réelle et du FOV.
     * Recule vers le centre de la pièce → jamais dans un mur.
     */
    focusOn(object3D, { padding = 1.75, elevation = 0.55, duration = 700, minDistance = 0.85 } = {}) {
        this._box.setFromObject(object3D);
        if (this._box.isEmpty()) return;
        this._box.getBoundingSphere(this._sphere);

        const fov = THREE.MathUtils.degToRad(this.camera.fov);
        const dist = Math.max(minDistance, (this._sphere.radius * padding) / Math.tan(fov / 2));

        // Direction : de l'objet vers l'intérieur de la pièce
        const dir = this._v1.copy(this.roomCenter).sub(this._sphere.center).setY(0);
        if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
        dir.normalize();

        const pos = this._sphere.center.clone()
            .addScaledVector(dir, dist)
            .add(new THREE.Vector3(0, dist * elevation, 0));

        this.moveTo(pos, this._sphere.center.clone(), { duration });
    }

    /** À appeler AVANT controls.update() : retire l'offset handheld. */
    beginFrame() {
        this.camera.position.sub(this._appliedOffset);
        this._appliedOffset.set(0, 0, 0);

        const tw = this._tween;
        if (!tw) return false;
        return true;
    }

    /** À appeler APRÈS controls.update() : avance le tween + réapplique l'offset. */
    endFrame(dt) {
        this._time += dt;

        const tw = this._tween;
        if (tw) {
            tw.t = Math.min(1, tw.t + dt / tw.duration);
            const e = tw.ease(tw.t);

            this.camera.position.lerpVectors(tw.startPos, tw.endPos, e);
            this.camera.position.y += Math.sin(e * Math.PI) * tw.arc;   // arc de grue
            this.clampToRoom(this.camera.position);

            this.controls.target.lerpVectors(tw.startTarget, tw.endTarget, e);
            this.controls.update();

            if (tw.t >= 1) { this._tween = null; tw.onDone?.(); }
        }

        if (this.handheld.enabled) {
            const t = this._time * this.handheld.freq;
            const a = this.handheld.amp;
            this._appliedOffset.set(
                Math.sin(t * 2.11) * a,
                Math.sin(t * 1.37 + 1.2) * a * 0.7,
                Math.sin(t * 1.73 + 2.4) * a * 0.5,
            );
            this.camera.position.add(this._appliedOffset);
        }
    }
}
