import * as THREE from 'three';
import { createMaterial } from './three-room.js';

/**
 * three-patient.js — Modèle patient procédural avec visage détaillé
 * Yeux (groupe avec sclérotique/iris/pupille), sourcils, nez compatibles
 * avec PatientAnimator (expressions dynamiques, clignements, dilatation pupilles).
 * 
 * Version améliorée : géométries organiques, matériaux PBR, anatomie réaliste.
 */
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
        this.browL = null;
        this.browR = null;
        this.nose = null;
        this.sweatGroup = null;
        this.sweatMat = null;
        this._bloodGroup = null;
        this._currentPosition = 'allonge';
        this.loadCase({ patient: { position3D: 'allonge', tenue: 'bleu', expression: 'normal' } });
    }

    loadCase(caseData) {
        this.group.clear();
        const patient = caseData?.patient || {};
        const position = patient.position3D || 'allonge';
        this._currentPosition = position;

        // Matériaux PBR améliorés pour la peau (Flat-Shading)
        this.skinMat = new THREE.MeshStandardMaterial({
            color: 0xd7a87a,
            roughness: 0.65,
            metalness: 0.02,
            flatShading: true,
            emissive: 0x1a0800,
            emissiveIntensity: 0.04,
        });

        // Matériau tissu amélioré (Flat-Shading)
        const clothColor = patient.tenue === 'blouse_blanche' ? 0xf2f4f7 : 0x4f72a8;
        this.clothMat = new THREE.MeshStandardMaterial({
            color: clothColor,
            roughness: 0.85,
            metalness: 0.0,
            flatShading: true
        });

        // Position Y ajustée pour que le patient soit posé sur le lit/chaise
        const seatY = position === 'allonge' ? -0.16 : -0.175;
        this.group.position.set(position === 'allonge' ? -3.5 : 2.15, seatY, position === 'allonge' ? -2.6 : -1.7);
        this.group.rotation.y = position === 'allonge' ? Math.PI : 0;
        this.mouth = null;
        this.eyeL = null;
        this.eyeR = null;
        this.browL = null;
        this.browR = null;
        this.nose = null;
        this.sweatGroup = null;
        this.sweatMat = null;
        this._bloodGroup = null;
        if (position === 'allonge') this.buildLying(this.skinMat, this.clothMat);
        else this.buildSitting(this.skinMat, this.clothMat);
        this._buildSweatDrops(position);
        this._buildBloodSplotches(position);
        this.applyExpression(patient.expression || 'normal');
    }

    /**
     * Met à jour l'apparence du patient pour un nœud d'urgence donné.
     */
    applyUrgenceVisuel(visuel, animator) {
        if (!visuel) return;
        const newPosition = visuel.position || this._currentPosition;

        if (newPosition !== this._currentPosition) {
            this._currentPosition = newPosition;
            this.group.clear();
            this.mouth = null;
            this.eyeL = null;
            this.eyeR = null;
            this.browL = null;
            this.browR = null;
            this.nose = null;
            this.sweatGroup = null;
            this.sweatMat = null;
            this._bloodGroup = null;

            const seatY = newPosition === 'allonge' ? -0.16 : -0.175;
            this.group.position.set(
                newPosition === 'allonge' ? -3.5 : 2.15,
                seatY,
                newPosition === 'allonge' ? -2.6 : -1.7
            );
            this.group.rotation.y = newPosition === 'allonge' ? Math.PI : 0;

            if (newPosition === 'allonge') this.buildLying(this.skinMat, this.clothMat);
            else this.buildSitting(this.skinMat, this.clothMat);
            this._buildSweatDrops(newPosition);
            this._buildBloodSplotches(newPosition);

            if (animator && animator.reset) {
                animator.reset();
                animator.group = this.group;
            }
        }

        const expr = visuel.expression || 'normal';
        this.applyExpression(expr);

        if (visuel.couleurPeau && this.skinMat) {
            const colors = {
                rouge:      0xc44040,
                bleu:       0x6b8bad,
                cyanose:    0xa0b4c8,
                pale:       0xd4c4b0,
                gris:       0x888888,
                normal:     0xd7a87a,
            };
            const c = colors[visuel.couleurPeau];
            if (c !== undefined) this.skinMat.color.set(c);
        }

        if (this._bloodGroup) {
            const showBlood = expr === 'hemorragie' || expr === 'brulure' ||
                              visuel.expression === 'hemorragie' || visuel.sang === true;
            this._bloodGroup.visible = showBlood;
        }
    }

    // =========================================================================
    //  PRIMITIVES AMÉLIORÉES
    // =========================================================================

    cube(size, pos, mat, name) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), mat);
        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (name) {
            mesh.name = name;
            const nameLower = name.toLowerCase();
            if (nameLower.includes('torse') || nameLower.includes('poitrine')) mesh.userData.label = 'Patient - Torse';
            else if (nameLower.includes('abdomen') || nameLower.includes('ventre')) mesh.userData.label = 'Patient - Abdomen';
            else if (nameLower.includes('tete') || nameLower.includes('tête')) mesh.userData.label = 'Patient - Tête';
            else mesh.userData.label = 'Patient';
            mesh.userData.interactive = true;
        }
        this.group.add(mesh);
        return mesh;
    }

    sphere(radius, pos, mat, name) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), mat); // Sphère facettée low-poly
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

    /**
     * Capsule (cylindre avec bouts arrondis) — parfait pour bras/jambes/cou
     */
    _capsule(radius, length, pos, mat, name, rot) {
        // CapsuleGeometry(radius, length, capSegments, radialSegments)
        const geom = new THREE.CapsuleGeometry(radius, length, 3, 6); // 6 segments radiaux pour effet facetté
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(pos.x, pos.y, pos.z);
        if (rot) mesh.rotation.set(rot.x || 0, rot.y || 0, rot.z || 0);
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

    /**
     * Cylindre lisse — pour des sections de membres
     */
    _cylinder(rTop, rBot, height, pos, mat, name, rot) {
        const geom = new THREE.CylinderGeometry(rTop, rBot, height, 6); // 6 segments radiaux pour effet facetté
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(pos.x, pos.y, pos.z);
        if (rot) mesh.rotation.set(rot.x || 0, rot.y || 0, rot.z || 0);
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

    // =========================================================================
    //  VISAGE DÉTAILLÉ (STYLE LOW-POLY PREMIUM ET ANIMABLE)
    // =========================================================================

    /**
     * Crée un œil stylisé low-poly, entièrement compatible avec PatientAnimator (blinks, expressions)
     */
    _addDetailedEye(x, y, z, isLeft) {
        const eyeGroup = new THREE.Group();
        eyeGroup.position.set(x, y, z);
        eyeGroup.name = 'Patient oeil';
        eyeGroup.userData = { label: 'Patient', interactive: true };

        const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({
            color,
            roughness: opts.roughness ?? 0.8,
            metalness: opts.metalness ?? 0.0,
            flatShading: true
        });

        // Sclérotique facettée
        const white = new THREE.Mesh(
            new THREE.SphereGeometry(0.024, 6, 4),
            mat(0xf8f5f0)
        );
        white.scale.set(1.4, 1.0, 0.4);
        eyeGroup.add(white);

        // Iris & Pupille (Hexagones low-poly)
        const irisMat = mat(0x3a6b4a, { metalness: 0.2 });
        const iris = new THREE.Mesh(
            new THREE.CylinderGeometry(0.012, 0.012, 0.004, 6),
            irisMat
        );
        iris.rotation.x = Math.PI / 2;
        iris.position.z = 0.008;
        iris.name = 'PatientIris';
        eyeGroup.add(iris);

        const pupilMat = mat(0x0a0a0f);
        const pupil = new THREE.Mesh(
            new THREE.CylinderGeometry(0.006, 0.006, 0.005, 6),
            pupilMat
        );
        pupil.rotation.x = Math.PI / 2;
        pupil.position.z = 0.01;
        pupil.name = 'PatientPupille';
        eyeGroup.add(pupil);

        // Paupière supérieure facettée
        const lidMat = mat(0xc9956a);
        const upperLid = new THREE.Mesh(
            new THREE.BoxGeometry(0.038, 0.008, 0.012),
            lidMat
        );
        upperLid.position.set(0, 0.014, 0.004);
        upperLid.name = 'PatientPaupiere';
        eyeGroup.add(upperLid);

        // Paupière inférieure
        const lowerLid = new THREE.Mesh(
            new THREE.BoxGeometry(0.038, 0.006, 0.012),
            lidMat
        );
        lowerLid.position.set(0, -0.014, 0.004);
        eyeGroup.add(lowerLid);

        this.group.add(eyeGroup);
        return eyeGroup;
    }

    /**
     * Sourcil low-poly fuselé en un seul bloc élégant
     */
    _addBrow(x, y, z, rotZ, isLeft) {
        const browGroup = new THREE.Group();
        browGroup.position.set(x, y, z);
        browGroup.rotation.z = rotZ;
        browGroup.name = isLeft ? 'Patient sourcil gauche' : 'Patient sourcil droit';
        browGroup.userData = { label: 'Patient', interactive: true };

        const browMat = new THREE.MeshStandardMaterial({
            color: 0x3a2718, roughness: 0.9, flatShading: true
        });

        const main = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 0.008, 0.008),
            browMat
        );
        main.castShadow = true;
        browGroup.add(main);

        const tail = new THREE.Mesh(
            new THREE.BoxGeometry(0.02, 0.006, 0.008),
            browMat
        );
        tail.position.set(isLeft ? 0.028 : -0.028, 0.002, 0.001);
        tail.rotation.z = isLeft ? -0.2 : 0.2;
        browGroup.add(tail);

        this.group.add(browGroup);
        return browGroup;
    }

    /**
     * Nez stylisé low-poly pyramidal
     */
    _addNose(x, y, z) {
        const noseGroup = new THREE.Group();
        noseGroup.position.set(x, y, z);
        noseGroup.name = 'Patient nez';
        noseGroup.userData = { label: 'Patient', interactive: true };

        const noseMat = this.skinMat.clone();

        const nose = new THREE.Mesh(
            new THREE.ConeGeometry(0.016, 0.045, 4),
            noseMat
        );
        nose.rotation.x = Math.PI / 2;
        nose.castShadow = true;
        noseGroup.add(nose);

        this.group.add(noseGroup);
        return noseGroup;
    }

    /**
     * Bouche stylisée low-poly
     */
    _addMouth(x, y, z) {
        const mouthGroup = new THREE.Group();
        mouthGroup.position.set(x, y, z);
        mouthGroup.name = 'Patient bouche';
        mouthGroup.userData = { label: 'Patient', interactive: true };

        const lipMat = new THREE.MeshStandardMaterial({
            color: 0xa04040, roughness: 0.8, flatShading: true
        });

        const upperLip = new THREE.Mesh(
            new THREE.BoxGeometry(0.038, 0.005, 0.005),
            lipMat
        );
        upperLip.position.y = 0.003;
        mouthGroup.add(upperLip);

        const lowerLip = new THREE.Mesh(
            new THREE.BoxGeometry(0.036, 0.005, 0.005),
            lipMat
        );
        lowerLip.position.y = -0.003;
        mouthGroup.add(lowerLip);

        this.group.add(mouthGroup);
        return mouthGroup;
    }

    /**
     * Cheveux volumétriques low-poly sculptés
     */
    _addHair(x, y, z) {
        const hairGroup = new THREE.Group();
        hairGroup.position.set(x, y, z);
        hairGroup.name = 'Patient cheveux';
        hairGroup.userData = { label: 'Patient - Tête', interactive: true };

        const hairMat = new THREE.MeshStandardMaterial({
            color: 0x2a1a0a,
            roughness: 0.9,
            metalness: 0.05,
            flatShading: true
        });

        const cap = new THREE.Mesh(
            new THREE.SphereGeometry(0.175, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
            hairMat
        );
        cap.position.y = 0.01;
        cap.castShadow = true;
        hairGroup.add(cap);

        const tuftGeom = new THREE.SphereGeometry(0.07, 6, 4);

        const back = new THREE.Mesh(tuftGeom, hairMat);
        back.position.set(0, -0.04, -0.05);
        back.scale.set(1.1, 1.2, 1.1);
        hairGroup.add(back);

        const sideL = new THREE.Mesh(tuftGeom, hairMat);
        sideL.position.set(-0.1, -0.01, -0.02);
        sideL.scale.set(0.6, 1.0, 0.8);
        hairGroup.add(sideL);

        const sideR = sideL.clone();
        sideR.position.x = 0.1;
        hairGroup.add(sideR);

        this.group.add(hairGroup);
        return hairGroup;
    }

    /**
     * Oreilles stylisées low-poly wedges
     */
    _addEars(x, y, z) {
        const earMat = this.skinMat.clone();

        const earGroupL = new THREE.Group();
        earGroupL.position.set(x - 0.16, y - 0.01, z - 0.02);
        earGroupL.name = 'Patient oreille gauche';
        earGroupL.userData = { label: 'Patient - Tête', interactive: true };

        const pavL = new THREE.Mesh(
            new THREE.BoxGeometry(0.012, 0.04, 0.024),
            earMat
        );
        pavL.rotation.y = 0.15;
        pavL.castShadow = true;
        earGroupL.add(pavL);
        this.group.add(earGroupL);

        const earGroupR = new THREE.Group();
        earGroupR.position.set(x + 0.16, y - 0.01, z - 0.02);
        earGroupR.name = 'Patient oreille droite';
        earGroupR.userData = { label: 'Patient - Tête', interactive: true };

        const pavR = new THREE.Mesh(
            new THREE.BoxGeometry(0.012, 0.04, 0.024),
            earMat
        );
        pavR.rotation.y = -0.15;
        pavR.castShadow = true;
        earGroupR.add(pavR);
        this.group.add(earGroupR);

        return { earL: earGroupL, earR: earGroupR };
    }

    // =========================================================================
    //  CONSTRUCTION : ASSIS
    // =========================================================================

    buildSitting(skin, cloth) {
        // === COU ===
        this._cylinder(0.055, 0.06, 0.10, { x: 0, y: 1.30, z: 0.03 }, skin, 'Patient cou');

        // === TORSE (forme trapézoïdale avec épaules plus larges) ===
        // Partie haute (poitrine/épaules) — plus large
        this.cube({ x: 0.46, y: 0.30, z: 0.24 }, { x: 0, y: 1.10, z: 0 }, cloth, 'Patient torse');
        // Partie basse (abdomen) — légèrement plus étroite
        this.cube({ x: 0.40, y: 0.28, z: 0.22 }, { x: 0, y: 0.82, z: 0 }, cloth, 'Patient abdomen');

        // Épaules arrondies
        this.sphere(0.08, { x: -0.22, y: 1.20, z: 0.01 }, cloth, '');
        this.sphere(0.08, { x: 0.22, y: 1.20, z: 0.01 }, cloth, '');

        // Col du vêtement
        const collarMat = cloth.clone();
        collarMat.color.offsetHSL(0, 0, -0.05);
        this._cylinder(0.08, 0.09, 0.04, { x: 0, y: 1.26, z: 0.03 }, collarMat, '');

        // === TÊTE (ovoïde, pas sphère parfaite) ===
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.43, 0.05);
        headGroup.name = 'Patient tete';
        headGroup.userData = { label: 'Patient - Tête', interactive: true };

        const headMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.165, 8, 6),
            skin
        );
        // Ovale : plus haut que large, légèrement aplati en profondeur
        headMesh.scale.set(0.92, 1.05, 0.95);
        headMesh.castShadow = true;
        headMesh.receiveShadow = true;
        headGroup.add(headMesh);

        // Mâchoire (donne une forme au bas du visage)
        const jaw = new THREE.Mesh(
            new THREE.SphereGeometry(0.115, 6, 4, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.35),
            skin
        );
        jaw.position.y = -0.06;
        jaw.scale.set(1.0, 0.9, 0.9);
        jaw.castShadow = true;
        headGroup.add(jaw);

        // Menton
        const chin = new THREE.Mesh(
            new THREE.SphereGeometry(0.038, 5, 4),
            skin
        );
        chin.position.set(0, -0.14, 0.06);
        chin.scale.set(1, 0.7, 0.8);
        headGroup.add(chin);

        this.group.add(headGroup);

        // === VISAGE ===
        this.eyeL = this._addDetailedEye(-0.06, 1.47, 0.19, true);
        this.eyeR = this._addDetailedEye(0.06, 1.47, 0.19, false);
        this.browL = this._addBrow(-0.06, 1.52, 0.18, 0.08, true);
        this.browR = this._addBrow(0.06, 1.52, 0.18, -0.08, false);
        this._addHair(0, 1.43, 0.05);
        this._addEars(0, 1.43, 0.05);
        this.nose = this._addNose(0, 1.41, 0.21);
        this.mouth = this._addMouth(0, 1.36, 0.19);

        // === JAMBES (capsules organiques) ===
        const pantMat = createMaterial(0x2a2e40);
        pantMat.roughness = 0.82;

        // Cuisses
        this._capsule(0.075, 0.22, { x: -0.11, y: 0.56, z: 0.05 }, pantMat, 'Patient jambe');
        this._capsule(0.075, 0.22, { x: 0.11, y: 0.56, z: 0.05 }, pantMat, 'Patient jambe');

        // Mollets
        this._capsule(0.058, 0.24, { x: -0.11, y: 0.24, z: 0.08 }, pantMat, '');
        this._capsule(0.058, 0.24, { x: 0.11, y: 0.24, z: 0.08 }, pantMat, '');

        // Genoux (sphères de jonction)
        this.sphere(0.062, { x: -0.11, y: 0.40, z: 0.06 }, pantMat, '');
        this.sphere(0.062, { x: 0.11, y: 0.40, z: 0.06 }, pantMat, '');

        // === PIEDS / CHAUSSURES ===
        const shoeMat = createMaterial(0x1a1a1a);
        shoeMat.roughness = 0.7;
        this.cube({ x: 0.07, y: 0.04, z: 0.13 }, { x: -0.11, y: 0.07, z: 0.12 }, shoeMat, '');
        this.cube({ x: 0.07, y: 0.04, z: 0.13 }, { x: 0.11, y: 0.07, z: 0.12 }, shoeMat, '');

        // === BRAS (capsules) ===
        // Haut des bras (manches)
        this._capsule(0.055, 0.16, { x: -0.27, y: 1.02, z: 0.04 }, cloth, 'Patient bras');
        this._capsule(0.055, 0.16, { x: 0.27, y: 1.02, z: 0.04 }, cloth, 'Patient bras');

        // Avant-bras (manches courtes → peau visible)
        this._capsule(0.042, 0.16, { x: -0.27, y: 0.78, z: 0.06 }, skin, '');
        this._capsule(0.042, 0.16, { x: 0.27, y: 0.78, z: 0.06 }, skin, '');

        // Coudes
        this.sphere(0.048, { x: -0.27, y: 0.89, z: 0.05 }, cloth, '');
        this.sphere(0.048, { x: 0.27, y: 0.89, z: 0.05 }, cloth, '');

        // Poignets
        this.sphere(0.035, { x: -0.27, y: 0.67, z: 0.07 }, skin, '');
        this.sphere(0.035, { x: 0.27, y: 0.67, z: 0.07 }, skin, '');

        // === MAINS (forme simplifiée mais anatomique) ===
        this._buildHand(-0.27, 0.63, 0.08, skin, false);
        this._buildHand(0.27, 0.63, 0.08, skin, true);
    }

    // =========================================================================
    //  CONSTRUCTION : ALLONGÉ
    // =========================================================================

    buildLying(skin, cloth) {
        // === COU ===
        this._capsule(0.05, 0.06, { x: 0, y: 0.96, z: 0.48 }, skin, 'Patient cou', { x: Math.PI / 2, y: 0, z: 0 });

        // === TORSE allongé ===
        // Poitrine
        this.cube({ x: 0.48, y: 0.26, z: 0.45 }, { x: 0, y: 0.95, z: 0.18 }, cloth, 'Patient torse');
        // Abdomen
        this.cube({ x: 0.44, y: 0.24, z: 0.38 }, { x: 0, y: 0.94, z: -0.22 }, cloth, 'Patient abdomen');

        // Épaules arrondies
        this.sphere(0.08, { x: -0.22, y: 0.97, z: 0.36 }, cloth, '');
        this.sphere(0.08, { x: 0.22, y: 0.97, z: 0.36 }, cloth, '');

        // === TÊTE ===
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.0, 0.62);
        headGroup.name = 'Patient tete';
        headGroup.userData = { label: 'Patient - Tête', interactive: true };

        const headMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.165, 8, 6),
            skin
        );
        headMesh.scale.set(0.92, 1.05, 0.95);
        headMesh.castShadow = true;
        headMesh.receiveShadow = true;
        headGroup.add(headMesh);

        // Mâchoire
        const jaw = new THREE.Mesh(
            new THREE.SphereGeometry(0.115, 6, 4, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.35),
            skin
        );
        jaw.position.y = -0.06;
        jaw.scale.set(1.0, 0.9, 0.9);
        jaw.castShadow = true;
        headGroup.add(jaw);

        // Menton
        const chin = new THREE.Mesh(
            new THREE.SphereGeometry(0.038, 5, 4),
            skin
        );
        chin.position.set(0, -0.14, 0.06);
        chin.scale.set(1, 0.7, 0.8);
        headGroup.add(chin);

        this.group.add(headGroup);

        // === VISAGE ===
        this.eyeL = this._addDetailedEye(-0.06, 1.14, 0.66, true);
        this.eyeR = this._addDetailedEye(0.06, 1.14, 0.66, false);
        this.browL = this._addBrow(-0.06, 1.19, 0.65, 0.08, true);
        this.browR = this._addBrow(0.06, 1.19, 0.65, -0.08, false);
        this._addHair(0, 1.0, 0.62);
        this._addEars(0, 1.0, 0.62);
        this.nose = this._addNose(0, 1.07, 0.70);
        this.mouth = this._addMouth(0, 1.04, 0.72);

        // === JAMBES allongées (capsules horizontales le long de Z) ===
        const pantMat = createMaterial(0x2a2e40);
        pantMat.roughness = 0.82;

        // Cuisses
        this._capsule(0.075, 0.28, { x: -0.12, y: 0.83, z: -0.48 }, pantMat, 'Patient jambe', { x: Math.PI / 2, y: 0, z: 0 });
        this._capsule(0.075, 0.28, { x: 0.12, y: 0.83, z: -0.48 }, pantMat, 'Patient jambe', { x: Math.PI / 2, y: 0, z: 0 });

        // Mollets
        this._capsule(0.058, 0.28, { x: -0.12, y: 0.83, z: -0.88 }, pantMat, '', { x: Math.PI / 2, y: 0, z: 0 });
        this._capsule(0.058, 0.28, { x: 0.12, y: 0.83, z: -0.88 }, pantMat, '', { x: Math.PI / 2, y: 0, z: 0 });

        // Genoux
        this.sphere(0.062, { x: -0.12, y: 0.83, z: -0.68 }, pantMat, '');
        this.sphere(0.062, { x: 0.12, y: 0.83, z: -0.68 }, pantMat, '');

        // Pieds
        const shoeMat = createMaterial(0x1a1a1a);
        shoeMat.roughness = 0.7;
        this.cube({ x: 0.07, y: 0.07, z: 0.10 }, { x: -0.12, y: 0.83, z: -1.08 }, shoeMat, '');
        this.cube({ x: 0.07, y: 0.07, z: 0.10 }, { x: 0.12, y: 0.83, z: -1.08 }, shoeMat, '');

        // === BRAS le long du corps ===
        // Haut des bras
        this._capsule(0.052, 0.20, { x: -0.30, y: 0.87, z: 0.05 }, cloth, 'Patient bras', { x: Math.PI / 2, y: 0, z: 0 });
        this._capsule(0.052, 0.20, { x: 0.30, y: 0.87, z: 0.05 }, cloth, 'Patient bras', { x: Math.PI / 2, y: 0, z: 0 });

        // Avant-bras
        this._capsule(0.040, 0.20, { x: -0.30, y: 0.87, z: -0.22 }, skin, '', { x: Math.PI / 2, y: 0, z: 0 });
        this._capsule(0.040, 0.20, { x: 0.30, y: 0.87, z: -0.22 }, skin, '', { x: Math.PI / 2, y: 0, z: 0 });

        // Coudes
        this.sphere(0.046, { x: -0.30, y: 0.87, z: -0.08 }, cloth, '');
        this.sphere(0.046, { x: 0.30, y: 0.87, z: -0.08 }, cloth, '');

        // Poignets
        this.sphere(0.033, { x: -0.30, y: 0.87, z: -0.34 }, skin, '');
        this.sphere(0.033, { x: 0.30, y: 0.87, z: -0.34 }, skin, '');

        // === MAINS ===
        this._buildHand(-0.30, 0.87, -0.38, skin, false, true);
        this._buildHand(0.30, 0.87, -0.38, skin, true, true);

        // === COUVERTURE / DRAP ===
        const blanketMat = new THREE.MeshStandardMaterial({
            color: 0xe8e0d0,
            roughness: 0.92,
            metalness: 0.0,
        });
        // Drap principal
        const blanket = new THREE.Mesh(
            new THREE.BoxGeometry(0.65, 0.04, 0.90),
            blanketMat
        );
        blanket.position.set(0, 0.92, -0.60);
        blanket.receiveShadow = true;
        blanket.castShadow = false;
        this.group.add(blanket);

        // Pli du drap (repli sur le dessus)
        const fold = new THREE.Mesh(
            new THREE.BoxGeometry(0.63, 0.05, 0.08),
            blanketMat
        );
        fold.position.set(0, 0.94, -0.14);
        fold.castShadow = true;
        this.group.add(fold);
    }

    /**
     * Main anatomique simplifiée (paume + doigts)
     */
    _buildHand(x, y, z, skin, isRight, isLying) {
        const handGroup = new THREE.Group();
        handGroup.position.set(x, y, z);

        // Paume
        const palm = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.02, 0.05),
            skin
        );
        palm.castShadow = true;
        handGroup.add(palm);

        // Doigts (4 petits cylindres)
        const fingerMat = skin;
        for (let i = 0; i < 4; i++) {
            const finger = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.006, 0.025, 3, 6),
                fingerMat
            );
            const xOff = -0.014 + i * 0.009;
            if (isLying) {
                finger.position.set(xOff, 0, 0.035);
                finger.rotation.x = Math.PI / 2;
            } else {
                finger.position.set(xOff, -0.025, 0.01);
            }
            finger.castShadow = true;
            handGroup.add(finger);
        }

        // Pouce
        const thumb = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.007, 0.02, 3, 6),
            skin
        );
        if (isLying) {
            thumb.position.set(isRight ? 0.025 : -0.025, 0, 0.015);
            thumb.rotation.x = Math.PI / 2;
            thumb.rotation.z = isRight ? 0.4 : -0.4;
        } else {
            thumb.position.set(isRight ? 0.025 : -0.025, -0.01, 0.01);
            thumb.rotation.z = isRight ? 0.6 : -0.6;
        }
        thumb.castShadow = true;
        handGroup.add(thumb);

        this.group.add(handGroup);
        return handGroup;
    }

    // =========================================================================
    //  EXPRESSIONS (LOGIQUE INTACTE)
    // =========================================================================

    applyExpression(expression) {
        if (!this.mouth) return;

        this.mouth.rotation.z = 0;
        this.mouth.scale.y = 1;
        this.mouth.position.y = this.mouth.position.y;

        this.group.rotation.z = 0;

        if (this.eyeL) this.eyeL.scale.y = 1;
        if (this.eyeR) this.eyeR.scale.y = 1;
        if (this.browL) {
            this.browL.rotation.z = 0.08;
            this.browL.position.y = this.browL.position.y;
        }
        if (this.browR) {
            this.browR.rotation.z = -0.08;
            this.browR.position.y = this.browR.position.y;
        }

        if (this.skinMat) {
            this.skinMat.color.set(0xd7a87a);
            if (this.skinMat.emissive) this.skinMat.emissive.set(0x1a0800);
            this.skinMat.emissiveIntensity = 0.04;
        }

        if (this._bloodGroup) this._bloodGroup.visible = false;
        if (this.sweatMat) this.sweatMat.opacity = 0;

        if (expression === 'douleur' || expression === 'grimace') {
            this.mouth.rotation.z = 0.18;
            this.mouth.scale.y = 0.5;
            if (this.eyeL) this.eyeL.scale.y = 0.45;
            if (this.eyeR) this.eyeR.scale.y = 0.45;
            if (this.browL) this.browL.rotation.z = -0.15;
            if (this.browR) this.browR.rotation.z = 0.15;
        }
        if (expression === 'pale') {
            if (this.skinMat) this.skinMat.color.set(0xd4c4b0);
        }
        if (expression === 'cyanotic' || expression === 'cyanose') {
            if (this.skinMat) this.skinMat.color.set(0x8fa8be);
            this.mouth.rotation.z = 0.12;
            if (this.eyeL) this.eyeL.scale.y = 0.85;
            if (this.eyeR) this.eyeR.scale.y = 0.85;
            if (this.browL) this.browL.rotation.z = -0.08;
            if (this.browR) this.browR.rotation.z = 0.08;
        }
        if (expression === 'feverish' || expression === 'fievre') {
            if (this.skinMat) {
                this.skinMat.color.set(0xe8b0a0);
                this.skinMat.emissive.set(0x331108);
                this.skinMat.emissiveIntensity = 0.15;
            }
            if (this.eyeL) this.eyeL.scale.y = 0.9;
            if (this.eyeR) this.eyeR.scale.y = 0.9;
            if (this.browL) this.browL.rotation.z = -0.1;
            if (this.browR) this.browR.rotation.z = 0.1;
        }
        if (expression === 'sweating' || expression === 'sueur') {
            if (this.skinMat) {
                this.skinMat.color.set(0xe0d5c4);
                this.skinMat.emissive.set(0x111508);
                this.skinMat.emissiveIntensity = 0.08;
            }
            if (this.sweatMat) this.sweatMat.opacity = 0.75;
        }
        if (expression === 'anxieux') {
            if (this.eyeL) this.eyeL.scale.y = 1.3;
            if (this.eyeR) this.eyeR.scale.y = 1.3;
            if (this.browL) this.browL.rotation.z = -0.12;
            if (this.browR) this.browR.rotation.z = 0.12;
        }
        if (expression === 'etonne' || expression === 'surpris') {
            this.mouth.rotation.z = 0;
            this.mouth.scale.y = 2.0;
            if (this.eyeL) this.eyeL.scale.y = 1.4;
            if (this.eyeR) this.eyeR.scale.y = 1.4;
            if (this.browL) this.browL.rotation.z = 0.15;
            if (this.browR) this.browR.rotation.z = -0.15;
        }
        if (expression === 'sourire') {
            this.mouth.rotation.z = 0;
            this.mouth.scale.y = 1.8;
            if (this.browL) this.browL.rotation.z = 0.05;
            if (this.browR) this.browR.rotation.z = -0.05;
        }
        if (expression === 'hemorragie' || expression === 'saignement') {
            if (this.skinMat) this.skinMat.color.set(0xc8b8a8);
            this.mouth.rotation.z = 0.22;
            this.mouth.scale.y = 0.4;
            if (this.eyeL) this.eyeL.scale.y = 0.35;
            if (this.eyeR) this.eyeR.scale.y = 0.35;
            if (this.browL) this.browL.rotation.z = -0.18;
            if (this.browR) this.browR.rotation.z = 0.18;
            if (this._bloodGroup) this._bloodGroup.visible = true;
        }
        if (expression === 'inconscient' || expression === 'pls') {
            if (this.skinMat) this.skinMat.color.set(0xc0b0a0);
            this.mouth.rotation.z = 0.05;
            this.mouth.scale.y = 0.6;
            if (this.eyeL) this.eyeL.scale.y = 0.05;
            if (this.eyeR) this.eyeR.scale.y = 0.05;
            if (this.browL) this.browL.rotation.z = -0.05;
            if (this.browR) this.browR.rotation.z = 0.05;
            
            if (expression === 'pls' && this._currentPosition === 'allonge') {
                this.group.rotation.z = Math.PI / 4;
            }
        }
        if (expression === 'arret_cardiaque' || expression === 'acr') {
            if (this.skinMat) {
                this.skinMat.color.set(0x909090);
                this.skinMat.emissive.set(0x000000);
            }
            this.mouth.scale.y = 1.5;
            this.mouth.rotation.z = 0;
            if (this.eyeL) this.eyeL.scale.y = 0.02;
            if (this.eyeR) this.eyeR.scale.y = 0.02;
            if (this.browL) this.browL.rotation.z = 0.0;
            if (this.browR) this.browR.rotation.z = 0.0;
        }
        if (expression === 'choc' || expression === 'choc_hemorragique') {
            if (this.skinMat) {
                this.skinMat.color.set(0xd8cec0);
                this.skinMat.emissive.set(0x080808);
                this.skinMat.emissiveIntensity = 0.05;
            }
            this.mouth.rotation.z = 0.1;
            this.mouth.scale.y = 0.7;
            if (this.eyeL) this.eyeL.scale.y = 0.7;
            if (this.eyeR) this.eyeR.scale.y = 0.7;
            if (this.browL) this.browL.rotation.z = -0.1;
            if (this.browR) this.browR.rotation.z = 0.1;
        }
        if (expression === 'brulure') {
            if (this.skinMat) {
                this.skinMat.color.set(0x8b4030);
                this.skinMat.emissive.set(0x3a1005);
                this.skinMat.emissiveIntensity = 0.3;
            }
            this.mouth.rotation.z = 0.25;
            this.mouth.scale.y = 0.3;
            if (this.eyeL) this.eyeL.scale.y = 0.5;
            if (this.eyeR) this.eyeR.scale.y = 0.5;
            if (this.browL) this.browL.rotation.z = -0.2;
            if (this.browR) this.browR.rotation.z = 0.2;
            if (this._bloodGroup) this._bloodGroup.visible = true;
        }
        if (expression === 'convulsion') {
            if (this.skinMat) {
                this.skinMat.color.set(0xd0c8b8);
            }
            this.mouth.rotation.z = 0.3;
            this.mouth.scale.y = 0.2;
            if (this.eyeL) this.eyeL.scale.y = 0.8;
            if (this.eyeR) this.eyeR.scale.y = 0.8;
            if (this.browL) this.browL.rotation.z = -0.25;
            if (this.browR) this.browR.rotation.z = 0.25;
        }
    }

    // =========================================================================
    //  EFFETS SPÉCIAUX (LOGIQUE INTACTE)
    // =========================================================================

    _buildBloodSplotches(positionMode) {
        if (this._bloodGroup) {
            this.group.remove(this._bloodGroup);
        }
        this._bloodGroup = new THREE.Group();
        this._bloodGroup.name = 'PatientSang';
        this._bloodGroup.visible = false;

        const bloodMat = new THREE.MeshStandardMaterial({
            color: 0x8b0000,
            roughness: 0.6,
            metalness: 0.15,
            transparent: true,
            opacity: 0.88,
            emissive: 0x200000,
            emissiveIntensity: 0.1
        });

        const splotchData = positionMode === 'allonge' ? [
            { x: -0.12, y: 0.82, z: -0.55, rx: 0, ry: 0, rz: 0, sx: 0.10, sy: 0.02, sz: 0.15 },
            { x: -0.28, y: 0.66, z: -0.70, rx: Math.PI/2, ry: 0, rz: 0, sx: 0.12, sy: 0.01, sz: 0.10 },
            { x: -0.30, y: 0.86, z: -0.05, rx: 0, ry: 0, rz: 0.2, sx: 0.06, sy: 0.02, sz: 0.09 },
        ] : [
            { x: -0.15, y: 0.55, z: 0.05, rx: 0.1, ry: 0, rz: 0, sx: 0.08, sy: 0.02, sz: 0.10 },
            { x: -0.15, y: 0.50, z: 0.10, rx: Math.PI/2, ry: 0, rz: 0, sx: 0.10, sy: 0.01, sz: 0.08 },
            { x: 0.0, y: 0.85, z: 0.10, rx: 0, ry: 0, rz: 0.1, sx: 0.07, sy: 0.02, sz: 0.06 },
        ];

        splotchData.forEach(d => {
            const geom = new THREE.SphereGeometry(1, 10, 8);
            const mesh = new THREE.Mesh(geom, bloodMat);
            mesh.position.set(d.x, d.y, d.z);
            mesh.rotation.set(d.rx, d.ry, d.rz);
            mesh.scale.set(d.sx, d.sy, d.sz);
            mesh.castShadow = false;
            mesh.receiveShadow = true;
            this._bloodGroup.add(mesh);
        });

        this.group.add(this._bloodGroup);
    }

    _buildSweatDrops(positionMode) {
        if (this.sweatGroup) {
            this.group.remove(this.sweatGroup);
        }
        
        this.sweatGroup = new THREE.Group();
        this.sweatGroup.name = 'PatientSueur';
        
        this.sweatMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.02,
            metalness: 0.1,
            transparent: true,
            opacity: 0.0,
            depthWrite: false
        });
        
        const dropGeom = new THREE.SphereGeometry(0.004, 6, 6);
        
        let positions = [];
        if (positionMode === 'allonge') {
            positions = [
                { x: -0.04, y: 1.18, z: 0.64 },
                { x: 0.04, y: 1.18, z: 0.64 },
                { x: -0.02, y: 1.19, z: 0.62 },
                { x: 0.02, y: 1.19, z: 0.62 },
                { x: -0.06, y: 1.17, z: 0.65 },
                { x: 0.06, y: 1.17, z: 0.65 },
                { x: -0.09, y: 1.13, z: 0.67 },
                { x: 0.09, y: 1.13, z: 0.67 },
                { x: -0.08, y: 1.09, z: 0.70 },
                { x: 0.08, y: 1.09, z: 0.70 },
                { x: -0.05, y: 1.06, z: 0.73 },
                { x: 0.05, y: 1.06, z: 0.73 }
            ];
        } else {
            positions = [
                { x: -0.04, y: 1.54, z: 0.17 },
                { x: 0.04, y: 1.54, z: 0.17 },
                { x: -0.02, y: 1.56, z: 0.15 },
                { x: 0.02, y: 1.56, z: 0.15 },
                { x: -0.06, y: 1.53, z: 0.18 },
                { x: 0.06, y: 1.53, z: 0.18 },
                { x: -0.09, y: 1.48, z: 0.20 },
                { x: 0.09, y: 1.48, z: 0.20 },
                { x: -0.08, y: 1.43, z: 0.22 },
                { x: 0.08, y: 1.43, z: 0.22 },
                { x: -0.05, y: 1.39, z: 0.23 },
                { x: 0.05, y: 1.39, z: 0.23 }
            ];
        }
        
        positions.forEach(pos => {
            const drop = new THREE.Mesh(dropGeom, this.sweatMat);
            drop.position.set(pos.x, pos.y, pos.z);
            const scale = 0.8 + Math.random() * 0.5;
            drop.scale.set(scale, scale * 1.6, scale);
            this.sweatGroup.add(drop);
        });
        
        this.group.add(this.sweatGroup);
    }
}