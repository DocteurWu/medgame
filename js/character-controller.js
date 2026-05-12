import * as THREE from 'three';
import { easeInOut } from './three-animations.js';

export class CharacterController {
    constructor(scene) {
        this.scene = scene;
        this.group = this.createDoctor();
        this.scene.add(this.group);
        this.group.position.set(0, 0, 2.6);
        this.isMoving = false;
    }

    createDoctor() {
        const group = new THREE.Group();
        const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.75 });

        // Corps (torse)
        const bodyGeom = new THREE.CapsuleGeometry(0.18, 0.4, 8, 16);
        const body = new THREE.Mesh(bodyGeom, mat(0xe8f0ff));
        body.position.y = 0.85;
        body.castShadow = true;
        group.add(body);

        // Tête
        const headGeom = new THREE.SphereGeometry(0.13, 16, 12);
        const head = new THREE.Mesh(headGeom, mat(0xd7a87a));
        head.position.y = 1.36;
        head.castShadow = true;
        group.add(head);

        // Cheveux
        const hairGeom = new THREE.SphereGeometry(0.14, 16, 12, 0, Math.PI * 2, 0, 0.6);
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9, metalness: 0.0 });
        const hair = new THREE.Mesh(hairGeom, hairMat);
        hair.position.y = 1.42;
        hair.scale.y = 0.8;
        group.add(hair);

        // Visage
        this._addDoctorFace(group);

        // Jambes
        const legGeom = new THREE.CylinderGeometry(0.05, 0.04, 0.5, 8);
        const legMat = mat(0x242a35);

        const legL = new THREE.Mesh(legGeom, legMat);
        legL.position.set(-0.07, 0.3, 0);
        legL.castShadow = true;
        group.add(legL);

        const legR = legL.clone();
        legR.position.x = 0.07;
        group.add(legR);

        // Chaussures
        const shoeGeom = new THREE.BoxGeometry(0.09, 0.04, 0.14);
        const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.8, metalness: 0.0 });

        const shoeL = new THREE.Mesh(shoeGeom, shoeMat);
        shoeL.position.set(-0.07, 0.03, 0);
        shoeL.castShadow = true;
        group.add(shoeL);

        const shoeR = shoeL.clone();
        shoeR.position.x = 0.07;
        group.add(shoeR);

        // Bras
        const armGeom = new THREE.CapsuleGeometry(0.035, 0.35, 8, 8);
        const armMat = mat(0xe8f0ff);

        const armL = new THREE.Mesh(armGeom, armMat);
        armL.position.set(-0.22, 0.92, 0);
        armL.castShadow = true;
        group.add(armL);

        const armR = armL.clone();
        armR.position.x = 0.22;
        group.add(armR);

        // Mains
        const handGeom = new THREE.SphereGeometry(0.035, 8, 6);
        const handMat = mat(0xd7a87a);

        const handL = new THREE.Mesh(handGeom, handMat);
        handL.position.set(-0.22, 0.74, 0);
        group.add(handL);

        const handR = handL.clone();
        handR.position.x = 0.22;
        group.add(handR);

        // Stéthoscope
        this._addStethoscope(group);

        group.userData.armR = armR;
        return group;
    }

    _addDoctorFace(group) {
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xd7a87a, roughness: 0.5, metalness: 0.3 });

        // Yeux
        const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });
        const irisMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.05, metalness: 0.5 });
        const pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000 });

        [-1, 1].forEach(side => {
            const eyeGroup = new THREE.Group();
            const white = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), eyeWhiteMat.clone());
            white.scale.set(1.4, 0.8, 0.4);
            const iris = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), irisMat);
            iris.position.z = 0.012;
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 6), pupilMat);
            pupil.position.z = 0.016;
            eyeGroup.add(white, iris, pupil);
            eyeGroup.position.set(side * 0.042, 0.04, 0.115);
            group.add(eyeGroup);
        });

        // Lunettes
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x88aacc, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.4 });
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.5 });

        [-1, 1].forEach(side => {
            const lens = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.005), glassMat);
            lens.position.set(side * 0.038, 0.035, 0.1);
            group.add(lens);

            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.008, 0.06), frameMat);
            arm.position.set(side * 0.055, 0.025, 0.05);
            arm.rotation.z = side * 0.15;
            group.add(arm);
        });

        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.015), frameMat);
        bridge.position.set(0, 0.04, 0.1);
        group.add(bridge);

        // Nez
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.04, 4), skinMat);
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, -0.01, 0.13);
        group.add(nose);

        // Bouche
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.006, 0.006), new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 }));
        mouth.position.set(0, -0.035, 0.13);
        group.add(mouth);
    }

    _addStethoscope(group) {
        const stethMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.2 });

        const tubeCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.18, 1.05, -0.1),
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

        const step = (now) => {
            const t = Math.min(1, (now - startTime) / duration);
            const e = easeInOut(t);
            this.group.position.lerpVectors(start, end, e);
            this.group.position.y = Math.sin(t * Math.PI * 8) * 0.035;
            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                this.group.position.copy(end);
                this.isMoving = false;
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