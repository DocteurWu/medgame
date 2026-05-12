/**
 * three-asset-agent.js — Agent de gestion des assets 3D
 * Améliore les modèles procéduraux (patient, médecin, mobilier)
 * avec des géométries plus réalistes et des matériaux PBR.
 */

import * as THREE from 'three';

export class ThreeAssetAgent {
    constructor(scene) {
        this.scene = scene;
        this.cache = new Map();
    }

    // ===== PATIENT RÉALISTE =====

    /**
     * Crée un patient avec des proportions médicales réalistes
     * @param {Object} options - { position, rotation, expression, isLying, skinTone, clothing }
     */
    createRealisticPatient(options = {}) {
        const group = new THREE.Group();
        const pos = options.position || { x: 2.15, y: 0, z: -1.7 };
        const lying = options.isLying !== undefined ? options.isLying : false;
        const skinTone = options.skinTone || 0xd4a574;
        const clothColor = options.clothing || 0x4a6fa5;

        group.position.set(pos.x, pos.y, pos.z);
        if (lying) group.rotation.y = -Math.PI / 2;

        // --- Corps humain avec formes anatomiques ---
        // Torse (forme plus réaliste avec cylinder + box)
        const torsoGeom = new THREE.BoxGeometry(0.45, 0.65, 0.2, 3, 3, 3);
        this._addEdgeCurvature(torsoGeom, 0.02);
        const torsoMat = this.createSkinMaterial(skinTone, 0.4, 0.6);
        const torso = new THREE.Mesh(torsoGeom, torsoMat);
        torso.position.y = lying ? 0.95 : 1.05;
        torso.castShadow = true;
        torso.receiveShadow = true;
        torso.name = 'PatientTorso';
        torso.userData.interactive = true;
        torso.userData.label = 'Patient - Torse';
        group.add(torso);

        // Tête (sphere avec subdivision pour plus de réalisme)
        const headGeom = new THREE.SphereGeometry(0.16, 24, 18);
        const headMat = this.createSkinMaterial(skinTone, 0.6, 0.3);
        const head = new THREE.Mesh(headGeom, headMat);
        head.position.y = lying ? 1.1 : 1.45;
        head.castShadow = true;
        head.receiveShadow = true;
        head.name = 'PatientTete';
        head.userData.interactive = true;
        head.userData.label = 'Patient - Tête';
        group.add(head);

        // Visage détaillé
        this._addFaceFeatures(group, head, skinTone, options.expression || 'neutral');

        // Cou
        const neckGeom = new THREE.CylinderGeometry(0.08, 0.1, 0.12, 8);
        const neckMat = this.createSkinMaterial(skinTone, 0.3, 0.7);
        const neck = new THREE.Mesh(neckGeom, neckMat);
        neck.position.y = lying ? 0.95 : 1.32;
        neck.castShadow = true;
        group.add(neck);

        // Bras (avec mains)
        this._addArm(group, skinTone, lying, 1);  // Gauche
        this._addArm(group, skinTone, lying, -1); // Droit

        // Jambes
        if (!lying) {
            this._addLeg(group, skinTone, 1);
            this._addLeg(group, skinTone, -1);
        } else {
            this._addLegsLying(group, skinTone);
        }

        // Vêtements
        this._addClothing(group, clothColor, lying);

        // Lit (si allongé)
        if (lying) {
            this._addHospitalBed(group);
        }

        // Ombre au sol
        const shadowGeom = new THREE.CircleGeometry(0.5, 16);
        const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.15
        });
        const shadow = new THREE.Mesh(shadowGeom, shadowMat);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.01;
        shadow.receiveShadow = false;
        shadow.castShadow = false;
        group.add(shadow);

        return group;
    }

    _addFaceFeatures(group, head, skinTone, expression) {
        // Yeux (forme d'amande améliorée)
        const eyeGeom = new THREE.SphereGeometry(0.022, 8, 6);
        const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.0 });
        const irisMat = new THREE.MeshStandardMaterial({ color: 0x3a6b4a, roughness: 0.1, metalness: 0.3 });
        const pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.0, metalness: 0.0 });

        // Oeil gauche
        const eyeLGroup = new THREE.Group();
        const eyeLWhite = new THREE.Mesh(eyeGeom, eyeWhiteMat);
        eyeLWhite.scale.set(1.3, 1, 0.3);
        const eyeLIris = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), irisMat);
        eyeLIris.position.z = 0.018;
        const eyeLPupil = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), pupilMat);
        eyeLPupil.position.z = 0.024;
        eyeLGroup.add(eyeLWhite, eyeLIris, eyeLPupil);
        eyeLGroup.position.set(-0.055, 0.05, 0.145);

        // Oeil droit
        const eyeRGroup = eyeLGroup.clone();
        eyeRGroup.position.set(0.055, 0.05, 0.145);

        group.add(eyeLGroup, eyeRGroup);

        // Sourcils
        this._addBrow(group, -0.055, 0.11, 0.13, -0.08);
        this._addBrow(group, 0.055, 0.11, 0.13, 0.08);

        // Nez
        const noseGeom = new THREE.ConeGeometry(0.025, 0.05, 4);
        const noseMat = this.createSkinMaterial(skinTone, 0.5, 0.5);
        const nose = new THREE.Mesh(noseGeom, noseMat);
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, 0, 0.15);
        nose.castShadow = true;
        group.add(nose);

        // Bouche
        const mouthGeom = new THREE.BoxGeometry(0.06, 0.008, 0.01);
        const mouthMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 });
        const mouth = new THREE.Mesh(mouthGeom, mouthMat);
        mouth.position.set(0, 0.02, 0.15);
        group.add(mouth);

        // Expression
        this._applyExpression(group, expression);
    }

    _addBrow(group, x, y, z, rotationZ) {
        const browGeom = new THREE.BoxGeometry(0.045, 0.006, 0.008);
        const browMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.8 });
        const brow = new THREE.Mesh(browGeom, browMat);
        brow.position.set(x, y, z);
        brow.rotation.z = rotationZ;
        group.add(brow);
    }

    _applyExpression(group, expression) {
        const mouth = group.children.find(c => c.geometry?.parameters?.width === 0.06);
        if (!mouth) return;

        switch (expression) {
            case 'douleur':
            case 'grimace':
                mouth.scale.y = 0.5;
                mouth.position.y -= 0.005;
                break;
            case 'sourire':
                mouth.scale.set(1, 1.5, 1);
                mouth.position.y += 0.003;
                break;
            case 'pale':
                // Pâleur — traité via material
                break;
        }
    }

    _addArm(group, skinTone, lying, side) {
        const dir = side; // 1=gauche, -1=droit

        // Épaule
        const shoulderGeom = new THREE.SphereGeometry(0.06, 8, 6);
        const shoulderMat = this.createSkinMaterial(skinTone, 0.3, 0.7);
        const shoulder = new THREE.Mesh(shoulderGeom, shoulderMat);
        shoulder.position.set(dir * 0.22, 1.25, 0);
        shoulder.castShadow = true;
        group.add(shoulder);

        // Bras
        const armGeom = new THREE.CylinderGeometry(0.04, 0.035, 0.35, 8);
        const armMat = this.createSkinMaterial(skinTone, 0.4, 0.6);
        const arm = new THREE.Mesh(armGeom, armMat);
        arm.position.set(dir * 0.24, 1.05, 0);
        arm.castShadow = true;
        group.add(arm);

        // Main
        const handGeom = new THREE.SphereGeometry(0.04, 8, 6);
        const handMat = this.createSkinMaterial(skinTone, 0.5, 0.4);
        const hand = new THREE.Mesh(handGeom, handMat);
        hand.position.set(dir * 0.24, 0.86, 0);
        hand.castShadow = true;
        group.add(hand);
    }

    _addLeg(group, skinTone, side) {
        const dir = side;

        // Cuisse
        const thighGeom = new THREE.CylinderGeometry(0.07, 0.06, 0.4, 8);
        const thighMat = this.createSkinMaterial(skinTone, 0.4, 0.6);
        const thigh = new THREE.Mesh(thighGeom, thighMat);
        thigh.position.set(dir * 0.12, 0.55, 0);
        thigh.castShadow = true;
        group.add(thigh);

        // Mollet
        const calfGeom = new THREE.CylinderGeometry(0.055, 0.045, 0.38, 8);
        const calfMat = this.createSkinMaterial(skinTone, 0.4, 0.6);
        const calf = new THREE.Mesh(calfGeom, calfMat);
        calf.position.set(dir * 0.12, 0.18, 0);
        calf.castShadow = true;
        group.add(calf);

        // Pied
        const footGeom = new THREE.BoxGeometry(0.08, 0.04, 0.16);
        const footMat = this.createSkinMaterial(skinTone, 0.5, 0.3);
        const foot = new THREE.Mesh(footGeom, footMat);
        foot.position.set(dir * 0.12, 0.02, 0.04);
        foot.castShadow = true;
        group.add(foot);
    }

    _addLegsLying(group, skinTone) {
        // Jambes allongées (plus courtes visuellement car perspective)
        const legGeom = new THREE.BoxGeometry(0.08, 0.18, 0.35);
        const legMat = this.createSkinMaterial(skinTone, 0.4, 0.6);

        // Jambe gauche
        const legL = new THREE.Mesh(legGeom, legMat.clone());
        legL.position.set(0.12, 0.35, -0.1);
        legL.castShadow = true;
        group.add(legL);

        // Jambe droite
        const legR = new THREE.Mesh(legGeom, legMat.clone());
        legR.position.set(-0.12, 0.35, -0.1);
        legR.castShadow = true;
        group.add(legR);

        // Draps
        const sheetGeom = new THREE.PlaneGeometry(0.7, 0.5);
        const sheetMat = new THREE.MeshStandardMaterial({
            color: 0xf0f0f0,
            roughness: 0.8,
            metalness: 0.0,
            side: THREE.DoubleSide
        });
        const sheet = new THREE.Mesh(sheetGeom, sheetMat);
        sheet.rotation.x = -Math.PI / 2;
        sheet.position.set(0, 0.05, -0.05);
        sheet.receiveShadow = true;
        group.add(sheet);
    }

    _addClothing(group, color, lying) {
        // Chemise / blouse
        const shirtGeom = new THREE.BoxGeometry(0.5, 0.6, 0.22);
        this._addEdgeCurvature(shirtGeom, 0.03);
        const shirtMat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.5,
            metalness: 0.1
        });
        const shirt = new THREE.Mesh(shirtGeom, shirtMat);
        shirt.position.y = lying ? 0.9 : 1.0;
        shirt.castShadow = true;
        shirt.receiveShadow = true;
        shirt.name = 'PatientVetement';
        group.add(shirt);

        // Poche poitrine (détail médical)
        const pocketGeom = new THREE.BoxGeometry(0.12, 0.12, 0.01);
        const pocketMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
        const pocket = new THREE.Mesh(pocketGeom, pocketMat);
        pocket.position.set(0.1, lying ? 0.95 : 1.05, 0.09);
        group.add(pocket);
    }

    _addHospitalBed(group) {
        // Matelas
        const mattressGeom = new THREE.BoxGeometry(0.7, 0.12, 1.8);
        const mattressMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.9,
            metalness: 0.0
        });
        const mattress = new THREE.Mesh(mattressGeom, mattressMat);
        mattress.position.set(0, 0.08, 0);
        mattress.receiveShadow = true;
        group.add(mattress);

        // Cadre de lit
        const frameMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 });

        // Barres latérales
        const railGeom = new THREE.BoxGeometry(0.03, 0.5, 1.85);
        const railL = new THREE.Mesh(railGeom, frameMat);
        railL.position.set(-0.36, 0.35, 0);
        railL.castShadow = true;
        group.add(railL);

        const railR = railL.clone();
        railR.position.x = 0.36;
        group.add(railR);

        // Barre de pied
        const footRailGeom = new THREE.BoxGeometry(0.75, 0.03, 0.03);
        const footRail = new THREE.Mesh(footRailGeom, frameMat);
        footRail.position.set(0, 0.1, 0.88);
        group.add(footRail);

        // Roulettes
        const wheelGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.04, 12);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.2 });
        [[-0.3, -0.85], [0.3, -0.85], [-0.3, 0.85], [0.3, 0.85]].forEach(([x, z]) => {
            const wheel = new THREE.Mesh(wheelGeom, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(x, 0.04, z);
            group.add(wheel);
        });
    }

    createSkinMaterial(color, roughness, metalness) {
        return new THREE.MeshStandardMaterial({
            color,
            roughness,
            metalness,
            skin: true
        });
    }

    _addEdgeCurvature(geom, amount) {
        // Ajoute un léger arrondi aux bords via subdivision
        const posAttr = geom.attributes.position;
        const positions = posAttr.array;
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i], y = positions[i + 1], z = positions[i + 2];
            const maxDim = Math.max(
                Math.abs(x) / (geom.parameters.width || 1),
                Math.abs(y) / (geom.parameters.height || 1),
                Math.abs(z) / (geom.parameters.depth || 1)
            );
            if (maxDim > 0.45) {
                const factor = 1 - amount * (1 - maxDim) / 0.5;
                positions[i] *= factor;
                positions[i + 1] *= factor;
                positions[i + 2] *= factor;
            }
        }
        posAttr.needsUpdate = true;
        geom.computeVertexNormals();
    }

    // ===== MÉDECIN RÉALISTE =====

    createRealisticDoctor(scene) {
        const group = new THREE.Group();
        scene.add(group);
        group.position.set(0, 0, 2.6);

        // Corps
        const bodyGeom = new THREE.CapsuleGeometry(0.18, 0.45, 8, 16);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0xe8f0ff,
            roughness: 0.4,
            metalness: 0.05
        });
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.position.y = 0.85;
        body.castShadow = true;
        group.add(body);

        // Tête
        const headGeom = new THREE.SphereGeometry(0.13, 16, 12);
        const headMat = this.createSkinMaterial(0xd7a87a, 0.5, 0.3);
        const head = new THREE.Mesh(headGeom, headMat);
        head.position.y = 1.38;
        head.castShadow = true;
        group.add(head);

        // Cheveux
        const hairGeom = new THREE.SphereGeometry(0.14, 16, 12, 0, Math.PI * 2, 0, 0.6);
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8, metalness: 0.0 });
        const hair = new THREE.Mesh(hairGeom, hairMat);
        hair.position.y = 1.42;
        hair.scale.y = 0.8;
        group.add(hair);

        // Visage du médecin
        this._addDoctorFace(group, 0xd7a87a);

        // Col (stethoscope)
        const collarGeom = new THREE.TorusGeometry(0.16, 0.015, 8, 16);
        const collarMat = new THREE.MeshStandardMaterial({ color: 0x3366cc, roughness: 0.3, metalness: 0.2 });
        const collar = new THREE.Mesh(collarGeom, collarMat);
        collar.position.set(0, 1.12, -0.15);
        collar.rotation.x = Math.PI / 2;
        group.add(collar);

        // Jambes
        const legGeom = new THREE.CylinderGeometry(0.05, 0.04, 0.5, 8);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x242a35, roughness: 0.6 });

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
        const armMat = new THREE.MeshStandardMaterial({ color: 0xe8f0ff, roughness: 0.4 });

        const armL = new THREE.Mesh(armGeom, armMat);
        armL.position.set(-0.22, 0.92, 0);
        armL.castShadow = true;
        group.add(armL);

        const armR = armL.clone();
        armR.position.x = 0.22;
        group.add(armR);

        // Mains
        const handGeom = new THREE.SphereGeometry(0.03, 8, 6);
        const handMat = this.createSkinMaterial(0xd7a87a, 0.5, 0.3);
        const handL = new THREE.Mesh(handGeom, handMat);
        handL.position.set(-0.22, 0.74, 0);
        group.add(handL);

        const handR = handL.clone();
        handR.position.x = 0.22;
        group.add(handR);

        // Stéthoscope (fil + poire)
        const stethMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.2 });

        // Tube
        const tubeCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.18, 1.05, -0.1),
            new THREE.Vector3(0.15, 0.95, -0.05),
            new THREE.Vector3(0.1, 0.85, 0),
            new THREE.Vector3(0.08, 0.8, -0.02),
        ]);
        const tubeGeom = new THREE.TubeGeometry(tubeCurve, 16, 0.006, 8, false);
        const tube = new THREE.Mesh(tubeGeom, stethMat);
        tube.castShadow = true;
        group.add(tube);

        // Poire
        const pearGeom = new THREE.SphereGeometry(0.035, 8, 6);
        const pear = new THREE.Mesh(pearGeom, stethMat);
        pear.position.set(0.08, 0.78, -0.02);
        group.add(pear);

        // Embouts auriculaires
        const earGeom = new THREE.SphereGeometry(0.012, 6, 4);
        [-0.06, 0.06].forEach(x => {
            const ear = new THREE.Mesh(earGeom, stethMat);
            ear.position.set(x, 1.15, -0.14);
            group.add(ear);
        });

        group.userData.armR = armR;
        return group;
    }

    _addDoctorFace(group, skinTone) {
        // Yeux
        const eyeGeom = new THREE.SphereGeometry(0.015, 8, 6);
        const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });
        const irisMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.05, metalness: 0.4 });

        [-1, 1].forEach(side => {
            const eyeGroup = new THREE.Group();
            const white = new THREE.Mesh(eyeGeom, eyeWhiteMat);
            white.scale.set(1.4, 0.8, 0.4);
            const iris = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), irisMat);
            iris.position.z = 0.012;
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 6),
                new THREE.MeshStandardMaterial({ color: 0x000000 }));
            pupil.position.z = 0.016;
            eyeGroup.add(white, iris, pupil);
            eyeGroup.position.set(side * 0.042, 0.04, 0.115);
            group.add(eyeGroup);
        });

        // Lunettes
        this._addGlasses(group);

        // Nez
        const noseGeom = new THREE.ConeGeometry(0.018, 0.04, 4);
        const noseMat = this.createSkinMaterial(skinTone, 0.5, 0.4);
        const nose = new THREE.Mesh(noseGeom, noseMat);
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, -0.01, 0.13);
        group.add(nose);

        // Bouche
        const mouthGeom = new THREE.BoxGeometry(0.035, 0.006, 0.006);
        const mouthMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 });
        const mouth = new THREE.Mesh(mouthGeom, mouthMat);
        mouth.position.set(0, -0.035, 0.13);
        group.add(mouth);
    }

    _addGlasses(group) {
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0x88aacc,
            roughness: 0.1,
            metalness: 0.3,
            transparent: true,
            opacity: 0.4
        });
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.5 });

        // Verres
        [-1, 1].forEach(side => {
            const lensGeom = new THREE.BoxGeometry(0.035, 0.025, 0.005);
            const lens = new THREE.Mesh(lensGeom, glassMat);
            lens.position.set(side * 0.038, 0.035, 0.1);
            group.add(lens);

            // Branches
            const armGeom = new THREE.BoxGeometry(0.015, 0.008, 0.06);
            const arm = new THREE.Mesh(armGeom, frameMat);
            arm.position.set(side * 0.055, 0.025, 0.05);
            arm.rotation.z = side * 0.15;
            group.add(arm);
        });

        // Pont
        const bridgeGeom = new THREE.BoxGeometry(0.008, 0.008, 0.015);
        const bridge = new THREE.Mesh(bridgeGeom, frameMat);
        bridge.position.set(0, 0.04, 0.1);
        group.add(bridge);
    }
}