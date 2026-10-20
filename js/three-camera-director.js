import * as THREE from 'three';
import { Easing, prefersReducedMotion } from './three-core-utils.js';

export const CLINICAL_CAMERA_PRESETS = {
    room: {
        position: new THREE.Vector3(0.0, 3.35, 4.55),
        target: new THREE.Vector3(-0.2, 1.05, -0.8),
        fov: 50,
        arc: 0.25
    },
    desk: {
        position: new THREE.Vector3(-3.35, 1.38, 0.52),
        target: new THREE.Vector3(-3.45, 0.96, -0.68),
        fov: 40,
        arc: 0.12
    },
    patient: {
        position: new THREE.Vector3(3.15, 1.48, 0.55),
        target: new THREE.Vector3(4.65, 1.05, 0.20),
        fov: 38,
        arc: 0.16
    },
    cabinet: {
        position: new THREE.Vector3(-3.75, 1.62, 2.38),
        target: new THREE.Vector3(-5.25, 1.25, 2.40),
        fov: 42,
        arc: 0.14
    },
    anatomy: {
        position: new THREE.Vector3(3.75, 1.85, 0.22),
        target: new THREE.Vector3(4.70, 0.92, 0.20),
        fov: 34,
        arc: 0.10
    }
};

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
        this.handheld = { enabled: !this.reduced, amp: 0.0042, freq: 0.25 };

        this._v1 = new THREE.Vector3();
        this._v2 = new THREE.Vector3();
        this._box = new THREE.Box3();
        this._sphere = new THREE.Sphere();
    }

    setBounds(min, max) { this.bounds.min.copy(min); this.bounds.max.copy(max); }
    clampToRoom(v) { return v.clamp(this.bounds.min, this.bounds.max); }

    get isAnimating() { return !!this._tween; }

    cancel() { this._tween = null; }

    /**
     * Déplace la caméra vers l'un des 5 angles cliniques prédéfinis ('room'|'desk'|'patient'|'cabinet'|'anatomy')
     */
    transitionToPreset(presetName, opts = {}) {
        const preset = CLINICAL_CAMERA_PRESETS[presetName];
        if (!preset) return;
        this.moveTo(preset.position, preset.target, {
            duration: opts.duration ?? 780,
            arc: preset.arc,
            fov: preset.fov,
            onDone: opts.onDone
        });
    }

    /**
     * Méthode historique appelée par three-scene.js
     */
    focusOn(object3D, opts = {}) {
        return this.focusOnObject(object3D, opts);
    }

    /**
     * Cadre automatiquement n'importe quel objet interactif du cabinet (Stéthoscope, Négatoscope, Balance...)
     */
    focusOnObject(object3D, { duration = 680, distanceMultiplier = 2.4, onDone = null } = {}) {
        if (!object3D) return;
        this._box.setFromObject(object3D);
        if (this._box.isEmpty()) return;

        this._box.getBoundingSphere(this._sphere);
        const target = this._sphere.center.clone();
        const radius = Math.max(0.22, this._sphere.radius);

        // Direction actuelle de la caméra vers l'objet pour éviter un retournement brusque
        this._v1.subVectors(this.camera.position, target).normalize();
        if (this._v1.lengthSq() < 0.001) this._v1.set(0, 0.3, 1).normalize();
        this._v1.y = Math.max(0.18, Math.min(0.65, this._v1.y));
        this._v1.normalize();

        this._v2.copy(target).addScaledVector(this._v1, radius * distanceMultiplier);
        this.moveTo(this._v2, target, { duration, arc: 0.1, fov: 38, onDone });
    }

    moveTo(position, target, { duration = 700, ease = Easing.inOutCubic, arc = 0.18, fov = null, onDone = null } = {}) {
        const endPos = this.clampToRoom(position.clone());
        const endTarget = target.clone();
        const endFov = fov ?? this.camera.fov;

        if (this.reduced || duration <= 0) {
            this.camera.position.copy(endPos);
            this.controls.target.copy(endTarget);
            if (this.camera.fov !== endFov) {
                this.camera.fov = endFov;
                this.camera.updateProjectionMatrix();
            }
            this.controls.update();
            onDone?.();
            return;
        }

        this._tween = {
            t: 0,
            duration: duration / 1000,
            ease,
            arc,
            onDone,
            startPos: this.camera.position.clone().sub(this._appliedOffset),
            startTarget: this.controls.target.clone(),
            startFov: this.camera.fov,
            endPos,
            endTarget,
            endFov
        };
    }

    beginFrame() {
        this.camera.position.sub(this._appliedOffset);
        this._appliedOffset.set(0, 0, 0);
        return !!this._tween;
    }

    endFrame(dt) {
        this._time += dt;
        const tw = this._tween;
        if (tw) {
            tw.t = Math.min(1, tw.t + dt / tw.duration);
            const e = tw.ease(tw.t);
            this.camera.position.lerpVectors(tw.startPos, tw.endPos, e);
            this.camera.position.y += Math.sin(e * Math.PI) * tw.arc;
            this.clampToRoom(this.camera.position);

            this.controls.target.lerpVectors(tw.startTarget, tw.endTarget, e);

            if (Math.abs(tw.endFov - tw.startFov) > 0.05) {
                this.camera.fov = tw.startFov + (tw.endFov - tw.startFov) * e;
                this.camera.updateProjectionMatrix();
            }

            this.controls.update();
            if (tw.t >= 1) {
                this._tween = null;
                tw.onDone?.();
            }
        }

        // Respiration subtile de la caméra (atténuée pendant un déplacement pour éviter le flou cinétique)
        if (this.handheld.enabled) {
            const damping = this._tween ? 0.25 : 1.0;
            const t = this._time * this.handheld.freq;
            const a = this.handheld.amp * damping;
            this._appliedOffset.set(
                Math.sin(t * 2.11) * a,
                Math.sin(t * 1.37 + 1.2) * a * 0.7,
                Math.sin(t * 1.73 + 2.4) * a * 0.5,
            );
            this.camera.position.add(this._appliedOffset);
        }
    }
}
