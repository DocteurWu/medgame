import * as THREE from 'three';
import { easeInOut } from './three-animations.js';
import { DoctorAnimator } from './three-animations.js';

export class CharacterController {
    constructor(scene) {
        this.scene = scene;
        this.group = this.createDoctor();
        this.scene.add(this.group);
        this.group.position.set(0, 0, 2.6);
        this.group.name = 'Doctor';
        this.isMoving = false;
        this.animator = new DoctorAnimator(this.group);
    }

    createDoctor() {
        const group = new THREE.Group();
        const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({
            color,
            roughness: opts.roughness ?? 0.85,
            metalness: opts.metalness ?? 0.05,
            flatShading: true,
            emissive: opts.emissive ?? 0x000000,
            emissiveIntensity: opts.emissiveIntensity ?? 0
        });

        // Corps (torse 6 faces, flat-shaded)
        const bodyGeom = new THREE.CylinderGeometry(0.18, 0.12, 0.45, 6);
        const body = new THREE.Mesh(bodyGeom, mat(0xe8f0ff));
        body.position.y = 0.85;
        body.rotation.y = Math.PI / 6; // Rotation pour orienter une face plate vers l'avant
        body.castShadow = true;
        group.add(body);

        // Blouse Médicale - Devant (effet 3D veston ouvert)
        const coatFront = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.35, 0.04), mat(0xf8fbff, { roughness: 0.6 }));
        coatFront.position.set(0, 0.84, 0.075);
        coatFront.castShadow = true;
        group.add(coatFront);

        // Revers de col (gauche/droit) pour donner du volume au col de la blouse
        const lapelL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.02), mat(0xf0f4fa));
        lapelL.position.set(-0.07, 0.88, 0.095);
        lapelL.rotation.y = 0.15;
        lapelL.rotation.z = -0.15;
        group.add(lapelL);

        const lapelR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.02), mat(0xf0f4fa));
        lapelR.position.set(0.07, 0.88, 0.095);
        lapelR.rotation.y = -0.15;
        lapelR.rotation.z = 0.15;
        group.add(lapelR);

        // Badge médical
        const badge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.01), mat(0x2c8bbf, { emissive: 0x0a2f44, emissiveIntensity: 0.1, roughness: 0.3 }));
        badge.position.set(0.075, 0.95, 0.10);
        badge.name = 'Badge medecin';
        group.add(badge);

        // Poche poitrine
        const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.01), mat(0xdde8f6));
        pocket.position.set(-0.06, 0.76, 0.10);
        group.add(pocket);

        // Tête (Sphere low-poly 8 segments pour effet facetté)
        const headGeom = new THREE.SphereGeometry(0.125, 8, 6);
        const head = new THREE.Mesh(headGeom, mat(0xd7a87a));
        head.position.y = 1.34;
        head.castShadow = true;
        group.add(head);

        // Cheveux Stylisés (polygones multiples sculptés)
        const hairMat = mat(0x242426, { roughness: 0.9 });
        const hairGroup = new THREE.Group();
        hairGroup.position.set(0, 1.34, 0);

        // Calotte principale
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.65), hairMat);
        cap.position.y = 0.02;
        hairGroup.add(cap);

        // Touffes de cheveux facettées
        const tuftGeom = new THREE.SphereGeometry(0.045, 6, 5);

        // Touffe avant (houppette)
        const tuft1 = new THREE.Mesh(tuftGeom, hairMat);
        tuft1.position.set(0, 0.09, 0.08);
        tuft1.scale.set(1.4, 0.8, 1);
        hairGroup.add(tuft1);

        // Touffes latérales
        const tuft2 = new THREE.Mesh(tuftGeom, hairMat);
        tuft2.position.set(-0.08, 0.04, 0.04);
        hairGroup.add(tuft2);

        const tuft3 = tuft2.clone();
        tuft3.position.x = 0.08;
        hairGroup.add(tuft3);

        // Touffe arrière
        const tuft4 = new THREE.Mesh(tuftGeom, hairMat);
        tuft4.position.set(0, -0.02, -0.09);
        tuft4.scale.set(1.2, 1, 1);
        hairGroup.add(tuft4);

        group.add(hairGroup);

        // Visage (Face & Lunettes de designer)
        this._addDoctorFace(group);

        // Jambes (cylindres 6 faces, flat-shaded)
        const legGeom = new THREE.CylinderGeometry(0.045, 0.035, 0.5, 6);
        const legMat = mat(0x20242e);

        const legL = new THREE.Mesh(legGeom, legMat);
        legL.position.set(-0.065, 0.3, 0);
        legL.rotation.y = Math.PI / 6;
        legL.castShadow = true;
        group.add(legL);

        const legR = legL.clone();
        legR.position.x = 0.065;
        group.add(legR);

        // Chaussures (low-poly wedges)
        const shoeMat = mat(0x111116, { roughness: 0.8 });
        const shoeGeom = new THREE.BoxGeometry(0.07, 0.04, 0.13);

        const shoeL = new THREE.Mesh(shoeGeom, shoeMat);
        shoeL.position.set(-0.065, 0.03, 0.03);
        shoeL.castShadow = true;
        group.add(shoeL);

        const shoeR = shoeL.clone();
        shoeR.position.x = 0.065;
        group.add(shoeR);

        // Bras (manches 6 faces, flat-shaded)
        const armGeom = new THREE.CylinderGeometry(0.038, 0.032, 0.35, 6);
        const armMat = mat(0xf2f5fa);

        const armL = new THREE.Mesh(armGeom, armMat);
        armL.position.set(-0.21, 0.92, 0);
        armL.rotation.y = Math.PI / 6;
        armL.castShadow = true;
        group.add(armL);

        const armR = armL.clone();
        armR.position.x = 0.21;
        group.add(armR);

        // Dossier patient en main gauche
        const clipboard = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.21, 0.015), mat(0x31445d, { roughness: 0.5 }));
        clipboard.position.set(-0.28, 0.76, 0.11);
        clipboard.rotation.z = -0.18;
        clipboard.name = 'Dossier patient medecin';
        clipboard.userData = { label: 'Dossier patient', interactive: true };
        group.add(clipboard);

        const page = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.17, 0.005), mat(0xfaf6ea, { roughness: 0.8 }));
        page.position.set(-0.28, 0.76, 0.12);
        page.rotation.z = -0.18;
        group.add(page);

        // Mains (Sphere low-poly 6 faces pour maintenir le resolve de l'animateur)
        const handGeom = new THREE.SphereGeometry(0.032, 6, 4);
        const handMat = mat(0xd7a87a);

        const handL = new THREE.Mesh(handGeom, handMat);
        handL.position.set(-0.21, 0.73, 0.01);
        group.add(handL);

        const handR = handL.clone();
        handR.position.x = 0.21;
        group.add(handR);

        // Stéthoscope
        this._addStethoscope(group);

        group.userData.armR = armR;
        group.traverse((obj) => {
            if (obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
            }
        });
        return group;
    }
            new THREE.Vector3(0.15, 0.95, -0.05),
            new THREE.Vector3(0.1, 0.85, 0),
            new THREE.Vector3(0.08, 0.8, -0.02),
        ]);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(tubeCurve, 16, 0.006, 8, false), stethMat);
        tube.castShadow = true;
        group.add(tube);

        const pear = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), stethMat);
        pear.position.set(0.08, 0.78, -0.02);
        group.add(pear);

        [-0.06, 0.06].forEach(x => {
            const ear = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), stethMat);
            ear.position.set(x, 1.15, -0.14);
            group.add(ear);
        });
    }

    moveTo(target, onArrive) {
        if (!target || !this.scene) return;
        const start = this.group.position.clone();
        const end = new THREE.Vector3(target.x, target.y || 0, target.z);
        const duration = 900 + start.distanceTo(end) * 130;
        const startTime = performance.now();
        this.isMoving = true;
        this.group.lookAt(end.x, this.group.position.y, end.z);
        this.animator.startWalking();

        const step = (now) => {
            const t = Math.min(1, (now - startTime) / duration);
            const e = easeInOut(t);
            this.group.position.lerpVectors(start, end, e);
            // Léger rebond vertical pendant la marche (additif, ne perturbe pas l'arrivée)
            const bounce = Math.sin(t * Math.PI * 8) * 0.035 * (1 - t);
            this.group.position.y += bounce;
            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                this.group.position.copy(end);
                this.isMoving = false;
                this.animator.stopWalking();
                if (onArrive) onArrive();
            }
        };
        requestAnimationFrame(step);
    }

    reach() {
        const arm = this.group.userData.armR;
        if (!arm) return;
        arm.rotation.x = -0.9;
        setTimeout(() => { arm.rotation.x = 0; }, 650);
    }

    /**
     * Fait marcher le médecin vers une position
     */
    walkTo(target, onArrive) {
        this.moveTo(target, onArrive);
    }

    /**
     * Fait tourner le médecin pour regarder un point
     */
    lookAt(point) {
        this.group.lookAt(point.x, point.y, point.z);
    }

    /**
     * Animation de salutation
     */
    wave() {
        const armR = this.group.userData.armR;
        if (!armR) return;
        const origRot = armR.rotation.clone();
        armR.rotation.x = -0.5;
        armR.rotation.z = 0.3;
        setTimeout(() => {
            armR.rotation.copy(origRot);
        }, 800);
    }
}
