import * as THREE from 'three';
import { createMaterial } from './three-room.js';

export class ThreePatient {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.skinMat = null;
        this.clothMat = null;
        this.mouth = null;
        this.eyeL = null;
        this.eyeR = null;
        this.loadCase({ patient: { position3D: 'assis', tenue: 'bleu', expression: 'normal' } });
    }

    loadCase(caseData) {
        this.group.clear();
        const patient = caseData?.patient || {};
        const position = patient.position3D || (Number(patient.age) > 80 ? 'allonge' : 'assis');
        this.skinMat = createMaterial(0xd7a87a);
        this.clothMat = createMaterial(patient.tenue === 'blouse_blanche' ? 0xf2f4f7 : 0x4f72a8);
        this.group.position.set(position === 'allonge' ? -3.0 : 2.15, 0, position === 'allonge' ? -2.2 : -1.7);
        if (position === 'allonge') this.buildLying(this.skinMat, this.clothMat);
        else this.buildSitting(this.skinMat, this.clothMat);
        this.applyExpression(patient.expression || 'normal');
    }

    cube(size, pos, mat, name) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), mat);
        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (name) {
            mesh.name = name;
            mesh.userData.label = 'Patient';
            mesh.userData.interactive = true;
        }
        this.group.add(mesh);
        return mesh;
    }

    sphere(radius, pos, mat, name) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 18), mat);
        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (name) {
            mesh.name = name;
            mesh.userData.label = 'Patient';
            mesh.userData.interactive = true;
        }
        this.group.add(mesh);
        return mesh;
    }

    buildSitting(skin, cloth) {
        this.cube({ x: 0.42, y: 0.55, z: 0.24 }, { x: 0, y: 1.0, z: 0 }, cloth, 'Patient torse');
        this.sphere(0.17, { x: 0, y: 1.43, z: 0.05 }, skin, 'Patient tete');
        this.eyeL = this.cube({ x: 0.035, y: 0.035, z: 0.018 }, { x: -0.06, y: 1.47, z: 0.19 }, createMaterial(0x111111), 'Patient oeil');
        this.eyeR = this.cube({ x: 0.035, y: 0.035, z: 0.018 }, { x: 0.06, y: 1.47, z: 0.19 }, createMaterial(0x111111), 'Patient oeil');
        this.mouth = this.cube({ x: 0.14, y: 0.018, z: 0.018 }, { x: 0, y: 1.36, z: 0.19 }, createMaterial(0x6b2020), 'Patient bouche');
        this.cube({ x: 0.11, y: 0.48, z: 0.1 }, { x: -0.15, y: 0.45, z: 0.05 }, createMaterial(0x30364a), 'Patient jambe');
        this.cube({ x: 0.11, y: 0.48, z: 0.1 }, { x: 0.15, y: 0.45, z: 0.05 }, createMaterial(0x30364a), 'Patient jambe');
    }

    buildLying(skin, cloth) {
        this.group.rotation.y = -Math.PI / 2;
        this.cube({ x: 0.48, y: 0.28, z: 0.95 }, { x: 0, y: 0.95, z: 0 }, cloth, 'Patient torse');
        this.sphere(0.17, { x: 0, y: 1.0, z: 0.62 }, skin, 'Patient tete');
        this.eyeL = this.cube({ x: 0.035, y: 0.02, z: 0.035 }, { x: -0.06, y: 1.14, z: 0.66 }, createMaterial(0x111111), 'Patient oeil');
        this.eyeR = this.cube({ x: 0.035, y: 0.02, z: 0.035 }, { x: 0.06, y: 1.14, z: 0.66 }, createMaterial(0x111111), 'Patient oeil');
        this.mouth = this.cube({ x: 0.14, y: 0.018, z: 0.018 }, { x: 0, y: 1.1, z: 0.72 }, createMaterial(0x6b2020), 'Patient bouche');
    }

    applyExpression(expression) {
        if (!this.mouth || !this.eyeL || !this.eyeR) return;
        this.mouth.rotation.z = 0;
        this.eyeL.scale.y = 1;
        this.eyeR.scale.y = 1;
        this.skinMat.color.set(0xd7a87a);
        this.skinMat.emissive?.set(0x000000);
        this.skinMat.emissiveIntensity = 0;

        if (expression === 'douleur' || expression === 'grimace') {
            this.mouth.rotation.z = 0.18;
            this.eyeL.scale.y = 0.45;
            this.eyeR.scale.y = 0.45;
        }
        if (expression === 'pale') {
            this.skinMat.color.set(0xd4c4b0);
        }
        if (expression === 'cyanotic' || expression === 'cyanose') {
            this.skinMat.color.set(0xb8c4d4);
            this.mouth.rotation.z = 0.12;
            this.eyeL.scale.y = 0.85;
            this.eyeR.scale.y = 0.85;
        }
        if (expression === 'feverish' || expression === 'fievre') {
            this.skinMat.color.set(0xe8b0a0);
            this.skinMat.emissive?.set(0x331108);
            this.skinMat.emissiveIntensity = 0.15;
            this.eyeL.scale.y = 0.9;
            this.eyeR.scale.y = 0.9;
        }
        if (expression === 'sweating' || expression === 'sueur') {
            this.skinMat.color.set(0xe0d5c4);
            this.skinMat.emissive?.set(0x111508);
            this.skinMat.emissiveIntensity = 0.08;
        }
        if (expression === 'anxieux') {
            this.eyeL.scale.y = 1.3;
            this.eyeR.scale.y = 1.3;
        }
        if (expression === 'etonne' || expression === 'surpris') {
            this.mouth.rotation.z = 0;
            this.eyeL.scale.y = 1.4;
            this.eyeR.scale.y = 1.4;
        }
        if (expression === 'sourire') {
            this.mouth.rotation.z = 0;
            this.mouth.scale.y = 1.8;
        }
    }
}

