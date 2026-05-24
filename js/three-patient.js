import * as THREE from 'three';
import { createMaterial } from './three-room.js';

/**
 * three-patient.js — Modèle patient procédural avec visage détaillé
 * Yeux (groupe avec sclérotique/iris/pupille), sourcils, nez compatibles
 * avec PatientAnimator (expressions dynamiques, clignements, dilatation pupilles).
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
        this.skinMat = createMaterial(0xd7a87a);
        this.clothMat = createMaterial(patient.tenue === 'blouse_blanche' ? 0xf2f4f7 : 0x4f72a8);
        // Position Y ajustée pour que le patient soit posé sur le lit/chaise
        // Assis : fond du torse (y=0.725 local) doit toucher le siège (y=0.55 mondial)
        // Allongé : fond du torse (y=0.81 local) doit toucher le matelas (y=0.65 mondial)
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
     * Gère les changements de position (debout→allongé), d'expression et de couleur peau
     * sans reconstruire la scène entière.
     * @param {Object} visuel — { position, expression, couleurPeau }
     * @param {Object} [animator] — PatientAnimator optionnel pour synchro respiration
     */
    applyUrgenceVisuel(visuel, animator) {
        if (!visuel) return;
        const newPosition = visuel.position || this._currentPosition;

        // Si la position a changé, reconstruire le modèle
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

            // Réinitialiser l'animateur si fourni
            if (animator && animator.reset) {
                animator.reset();
                animator.group = this.group;
            }
        }

        // Appliquer l'expression et la couleur peau
        const expr = visuel.expression || 'normal';
        this.applyExpression(expr);

        // Couleur peau manuelle (override)
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

        // Visibilité du sang
        if (this._bloodGroup) {
            const showBlood = expr === 'hemorragie' || expr === 'brulure' ||
                              visuel.expression === 'hemorragie' || visuel.sang === true;
            this._bloodGroup.visible = showBlood;
        }
    }

    cube(size, pos, mat, name) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), mat);
        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (name) {
            mesh.name = name;
            // Le label encode la zone pour la détection contextuelle
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

    /**
     * Crée un œil détaillé (groupe avec sclérotique blanche, iris, pupille)
     * Compatible avec PatientAnimator : le groupe porte le nom 'Patient oeil'
     * pour le clignement (scaleY), et l'iris enfant pour la dilatation pupillaire.
     * @param {number} x — position X locale au groupe patient
     * @param {number} y — position Y
     * @param {number} z — position Z (profondeur, vers la caméra)
     * @param {boolean} isLeft — œil gauche ou droit (influe le nommage)
     * @returns {THREE.Group} le groupe œil
     */
    _addDetailedEye(x, y, z, isLeft) {
        const eyeGroup = new THREE.Group();
        eyeGroup.position.set(x, y, z);
        eyeGroup.name = 'Patient oeil';
        eyeGroup.userData = { label: 'Patient', interactive: true };

        // Sclérotique (blanc de l'œil)
        const whiteMat = new THREE.MeshStandardMaterial({
            color: 0xf8f8f8, roughness: 0.15, metalness: 0.0
        });
        const white = new THREE.Mesh(
            new THREE.SphereGeometry(0.028, 16, 12),
            whiteMat
        );
        white.scale.set(1.3, 1.0, 0.45);
        eyeGroup.add(white);

        // Iris (couleur foncée réaliste)
        const irisMat = new THREE.MeshStandardMaterial({
            color: 0x3a6b4a, roughness: 0.1, metalness: 0.35
        });
        const iris = new THREE.Mesh(
            new THREE.SphereGeometry(0.014, 14, 10),
            irisMat
        );
        iris.position.z = 0.02;
        iris.name = 'PatientIris';
        eyeGroup.add(iris);

        // Pupille (noire)
        const pupilMat = new THREE.MeshStandardMaterial({
            color: 0x000000, roughness: 0.0, metalness: 0.0
        });
        const pupil = new THREE.Mesh(
            new THREE.SphereGeometry(0.007, 10, 8),
            pupilMat
        );
        pupil.position.z = 0.024;
        pupil.name = 'PatientPupille';
        eyeGroup.add(pupil);

        // Paupière supérieure (mesh discret, couleur peau)
        const lidMat = new THREE.MeshStandardMaterial({
            color: 0xd4a070, roughness: 0.7, metalness: 0.0
        });
        const upperLid = new THREE.Mesh(
            new THREE.SphereGeometry(0.03, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.35),
            lidMat
        );
        upperLid.scale.set(1.3, 1.0, 0.5);
        upperLid.position.y = 0.012;
        upperLid.position.z = -0.002;
        upperLid.name = 'PatientPaupiere';
        eyeGroup.add(upperLid);

        this.group.add(eyeGroup);
        return eyeGroup;
    }

    /**
     * Crée un sourcil procédural
     * @param {number} x — position X
     * @param {number} y — position Y
     * @param {number} z — position Z
     * @param {number} rotZ — rotation initiale en Z (négatif pour froncement)
     * @param {boolean} isLeft — sourcil gauche ou droit
     * @returns {THREE.Mesh}
     */
    _addBrow(x, y, z, rotZ, isLeft) {
        const browGeom = new THREE.BoxGeometry(0.065, 0.008, 0.008);
        const browMat = new THREE.MeshStandardMaterial({
            color: 0x4a3728, roughness: 0.85, metalness: 0.0
        });
        const brow = new THREE.Mesh(browGeom, browMat);
        brow.position.set(x, y, z);
        brow.rotation.z = rotZ;
        brow.castShadow = true;
        brow.name = isLeft ? 'Patient sourcil gauche' : 'Patient sourcil droit';
        brow.userData = { label: 'Patient', interactive: true };
        this.group.add(brow);
        return brow;
    }

    /**
     * Crée le nez procédural
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {THREE.Mesh}
     */
    _addNose(x, y, z) {
        const noseMat = this.skinMat.clone();
        const noseGeom = new THREE.ConeGeometry(0.02, 0.04, 6);
        const nose = new THREE.Mesh(noseGeom, noseMat);
        nose.position.set(x, y, z);
        nose.rotation.x = Math.PI / 2;
        nose.castShadow = true;
        nose.name = 'Patient nez';
        nose.userData = { label: 'Patient', interactive: true };
        this.group.add(nose);
        return nose;
    }

    /**
     * Ajoute les cheveux du patient (hémisphère couvrant le haut du crâne)
     * @param {number} x — position X (centre de la tête)
     * @param {number} y — position Y (centre de la tête)
     * @param {number} z — position Z (centre de la tête)
     * @returns {THREE.Mesh}
     */
    _addHair(x, y, z) {
        // Hémisphère couvrant le haut et les côtés du crâne
        const hairGeom = new THREE.SphereGeometry(0.18, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52);
        const hairMat = new THREE.MeshStandardMaterial({
            color: 0x2a1a0a,
            roughness: 0.95,
            metalness: 0.0
        });
        const hair = new THREE.Mesh(hairGeom, hairMat);
        // Léger décalage vers le haut pour un meilleur recouvrement du crâne
        hair.position.set(x, y + 0.005, z);
        hair.castShadow = true;
        hair.name = 'Patient cheveux';
        hair.userData = { label: 'Patient - Tête', interactive: true };
        this.group.add(hair);
        return hair;
    }

    /**
     * Ajoute les oreilles du patient (ellipsoïdes latérales)
     * @param {number} x — position X du centre de la tête
     * @param {number} y — position Y du centre de la tête
     * @param {number} z — position Z du centre de la tête
     * @returns {{ earL: THREE.Mesh, earR: THREE.Mesh }}
     */
    _addEars(x, y, z) {
        const earMat = this.skinMat.clone();
        const earGeom = new THREE.SphereGeometry(0.025, 10, 8);

        // Oreille gauche
        const earL = new THREE.Mesh(earGeom, earMat);
        earL.position.set(x - 0.17, y - 0.01, z - 0.02);
        earL.scale.set(0.5, 0.65, 0.35);
        earL.castShadow = true;
        earL.name = 'Patient oreille gauche';
        earL.userData = { label: 'Patient - Tête', interactive: true };
        this.group.add(earL);

        // Oreille droite
        const earR = new THREE.Mesh(earGeom, earMat);
        earR.position.set(x + 0.17, y - 0.01, z - 0.02);
        earR.scale.set(0.5, 0.65, 0.35);
        earR.castShadow = true;
        earR.name = 'Patient oreille droite';
        earR.userData = { label: 'Patient - Tête', interactive: true };
        this.group.add(earR);

        return { earL, earR };
    }

    buildSitting(skin, cloth) {
        // Torse
        this.cube({ x: 0.42, y: 0.55, z: 0.24 }, { x: 0, y: 1.0, z: 0 }, cloth, 'Patient torse');

        // Tête
        this.sphere(0.17, { x: 0, y: 1.43, z: 0.05 }, skin, 'Patient tete');

        // Yeux détaillés (groupes avec iris+pupille)
        this.eyeL = this._addDetailedEye(-0.06, 1.47, 0.19, true);
        this.eyeR = this._addDetailedEye(0.06, 1.47, 0.19, false);

        // Sourcils (position X : négatif=gauche, positif=droit; rotation Z orientée)
        this.browL = this._addBrow(-0.06, 1.52, 0.18, 0.08, true);
        this.browR = this._addBrow(0.06, 1.52, 0.18, -0.08, false);

        // Cheveux et oreilles
        this._addHair(0, 1.43, 0.05);
        this._addEars(0, 1.43, 0.05);

        // Nez
        this.nose = this._addNose(0, 1.41, 0.21);

        // Bouche
        this.mouth = this.cube({ x: 0.09, y: 0.014, z: 0.014 }, { x: 0, y: 1.36, z: 0.19 }, createMaterial(0x8b2020), 'Patient bouche');

        // Jambes
        this.cube({ x: 0.11, y: 0.48, z: 0.1 }, { x: -0.15, y: 0.45, z: 0.05 }, createMaterial(0x30364a), 'Patient jambe');
        this.cube({ x: 0.11, y: 0.48, z: 0.1 }, { x: 0.15, y: 0.45, z: 0.05 }, createMaterial(0x30364a), 'Patient jambe');

        // Bras (ajout pour réalisme)
        const armMat = createMaterial(0x30364a);
        this.cube({ x: 0.09, y: 0.36, z: 0.09 }, { x: -0.26, y: 0.85, z: 0.05 }, armMat, 'Patient bras');
        this.cube({ x: 0.09, y: 0.36, z: 0.09 }, { x: 0.26, y: 0.85, z: 0.05 }, armMat, 'Patient bras');

        // Mains (peau)
        const handMat = skin.clone();
        this.sphere(0.04, { x: -0.26, y: 0.64, z: 0.08 }, handMat, '');
        this.sphere(0.04, { x: 0.26, y: 0.64, z: 0.08 }, handMat, '');
    }

    buildLying(skin, cloth) {
        // Torse allongé (axe Z = longueur du corps, +Z = tête)
        this.cube({ x: 0.48, y: 0.28, z: 0.95 }, { x: 0, y: 0.95, z: 0 }, cloth, 'Patient torse');
        this.sphere(0.17, { x: 0, y: 1.0, z: 0.62 }, skin, 'Patient tete');

        // Yeux détaillés (allongé : position ajustée)
        this.eyeL = this._addDetailedEye(-0.06, 1.14, 0.66, true);
        this.eyeR = this._addDetailedEye(0.06, 1.14, 0.66, false);

        // Sourcils
        this.browL = this._addBrow(-0.06, 1.19, 0.65, 0.08, true);
        this.browR = this._addBrow(0.06, 1.19, 0.65, -0.08, false);

        // Cheveux et oreilles
        this._addHair(0, 1.0, 0.62);
        this._addEars(0, 1.0, 0.62);

        // Nez
        this.nose = this._addNose(0, 1.07, 0.70);

        // Bouche
        this.mouth = this.cube({ x: 0.09, y: 0.014, z: 0.014 }, { x: 0, y: 1.04, z: 0.72 }, createMaterial(0x8b2020), 'Patient bouche');

        // Jambes allongées (le long de l'axe Z négatif = vers les pieds)
        const legMat = createMaterial(0x30364a);
        this.cube({ x: 0.14, y: 0.13, z: 0.55 }, { x: -0.12, y: 0.83, z: -0.73 }, legMat, 'Patient jambe');
        this.cube({ x: 0.14, y: 0.13, z: 0.55 }, { x: 0.12, y: 0.83, z: -0.73 }, legMat, 'Patient jambe');

        // Bras allongés le long du corps
        const armMat = createMaterial(0x30364a);
        this.cube({ x: 0.10, y: 0.10, z: 0.40 }, { x: -0.30, y: 0.86, z: -0.10 }, armMat, 'Patient bras');
        this.cube({ x: 0.10, y: 0.10, z: 0.40 }, { x: 0.30, y: 0.86, z: -0.10 }, armMat, 'Patient bras');

        // Mains (peau)
        const handMat = skin.clone();
        this.sphere(0.04, { x: -0.30, y: 0.86, z: -0.32 }, handMat, '');
        this.sphere(0.04, { x: 0.30, y: 0.86, z: -0.32 }, handMat, '');

        // Couverture/drap sur les jambes et bas du torse
        const blanketMat = createMaterial(0xe8e0d0, { roughness: 0.95, metalness: 0.0 });
        this.cube({ x: 0.65, y: 0.03, z: 0.90 }, { x: 0, y: 0.93, z: -0.60 }, blanketMat, '');
    }

    applyExpression(expression) {
        if (!this.mouth) return;

        // Restaurer les valeurs par défaut
        this.mouth.rotation.z = 0;
        this.mouth.scale.y = 1;
        this.mouth.position.y = this.mouth.position.y; // garder la position actuelle

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

        // Couleur de peau par défaut
        if (this.skinMat) {
            this.skinMat.color.set(0xd7a87a);
            if (this.skinMat.emissive) this.skinMat.emissive.set(0x000000);
            this.skinMat.emissiveIntensity = 0;
        }

        // Sang caché par défaut
        if (this._bloodGroup) this._bloodGroup.visible = false;

        // Sueur cachée par défaut (le PatientAnimator la gérera dynamiquement si besoin)
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
            // Peau bleutée / tête bleue
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
            // Afficher immédiatement les gouttes de sueur (max brillance)
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
        // === NOUVELLES EXPRESSIONS URGENCE ===
        if (expression === 'hemorragie' || expression === 'saignement') {
            // Peau pâle/livide avec sang visible
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
            // Yeux fermés, corps inerte
            if (this.skinMat) this.skinMat.color.set(0xc0b0a0);
            this.mouth.rotation.z = 0.05;
            this.mouth.scale.y = 0.6;
            if (this.eyeL) this.eyeL.scale.y = 0.05;  // yeux fermés
            if (this.eyeR) this.eyeR.scale.y = 0.05;
            if (this.browL) this.browL.rotation.z = -0.05;
            if (this.browR) this.browR.rotation.z = 0.05;
        }
        if (expression === 'arret_cardiaque' || expression === 'acr') {
            // Peau grise, yeux fermés, bouche entrouverte
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
            // Choc : peau très pâle, sueur, confusion
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
            // Peau rougeâtre/noirâtre brûlée
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
            // Convulsion : yeux révulsés, mâchoires serrées
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

    /**
     * Génère des taches de sang procédurales sur le bas du corps et les membres.
     * Visible uniquement pour les expressions hémorragie/brûlure.
     */
    _buildBloodSplotches(positionMode) {
        if (this._bloodGroup) {
            this.group.remove(this._bloodGroup);
        }
        this._bloodGroup = new THREE.Group();
        this._bloodGroup.name = 'PatientSang';
        this._bloodGroup.visible = false;

        const bloodMat = new THREE.MeshStandardMaterial({
            color: 0x8b0000,
            roughness: 0.95,
            metalness: 0.0,
            transparent: true,
            opacity: 0.88
        });

        // Taches elliptiques de sang sur les membres/torse
        const splotchData = positionMode === 'allonge' ? [
            // Sur la jambe gauche (cuisse)
            { x: -0.12, y: 0.82, z: -0.55, rx: 0, ry: 0, rz: 0, sx: 0.10, sy: 0.02, sz: 0.15 },
            // Flaque au sol (à côté du lit)
            { x: -0.28, y: 0.66, z: -0.70, rx: Math.PI/2, ry: 0, rz: 0, sx: 0.12, sy: 0.01, sz: 0.10 },
            // Bras
            { x: -0.30, y: 0.86, z: -0.05, rx: 0, ry: 0, rz: 0.2, sx: 0.06, sy: 0.02, sz: 0.09 },
        ] : [
            // Sur la jambe gauche
            { x: -0.15, y: 0.55, z: 0.05, rx: 0.1, ry: 0, rz: 0, sx: 0.08, sy: 0.02, sz: 0.10 },
            // Flaque au sol
            { x: -0.15, y: 0.50, z: 0.10, rx: Math.PI/2, ry: 0, rz: 0, sx: 0.10, sy: 0.01, sz: 0.08 },
            // Torse / bas abdomen
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

    /**
     * Génère procéduralement des gouttelettes de sueur sur le front et les joues du patient.
     * Le matériau commence invisible (opacity = 0) et sera modulé en continu.
     */
    _buildSweatDrops(positionMode) {
        if (this.sweatGroup) {
            this.group.remove(this.sweatGroup);
        }
        
        this.sweatGroup = new THREE.Group();
        this.sweatGroup.name = 'PatientSueur';
        
        // Matériau de sueur brillant, translucide et très lisse
        this.sweatMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.02,
            metalness: 0.1,
            transparent: true,
            opacity: 0.0, // Invisible par défaut, animé par PatientAnimator
            depthWrite: false
        });
        
        const dropGeom = new THREE.SphereGeometry(0.004, 6, 6);
        
        // Coordonnées locales des gouttes selon la posture
        let positions = [];
        if (positionMode === 'allonge') {
            // Allongé : tête à x=0, y=1.0, z=0.62. Visage vers +Y/+Z
            positions = [
                // Front
                { x: -0.04, y: 1.18, z: 0.64 },
                { x: 0.04, y: 1.18, z: 0.64 },
                { x: -0.02, y: 1.19, z: 0.62 },
                { x: 0.02, y: 1.19, z: 0.62 },
                { x: -0.06, y: 1.17, z: 0.65 },
                { x: 0.06, y: 1.17, z: 0.65 },
                // Tempes / Joues
                { x: -0.09, y: 1.13, z: 0.67 },
                { x: 0.09, y: 1.13, z: 0.67 },
                { x: -0.08, y: 1.09, z: 0.70 },
                { x: 0.08, y: 1.09, z: 0.70 },
                { x: -0.05, y: 1.06, z: 0.73 },
                { x: 0.05, y: 1.06, z: 0.73 }
            ];
        } else {
            // Assis : tête à x=0, y=1.43, z=0.05. Visage vers +Z
            positions = [
                // Front
                { x: -0.04, y: 1.54, z: 0.17 },
                { x: 0.04, y: 1.54, z: 0.17 },
                { x: -0.02, y: 1.56, z: 0.15 },
                { x: 0.02, y: 1.56, z: 0.15 },
                { x: -0.06, y: 1.53, z: 0.18 },
                { x: 0.06, y: 1.53, z: 0.18 },
                // Tempes / Joues
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
            // Légère variation de taille
            const scale = 0.8 + Math.random() * 0.5;
            drop.scale.set(scale, scale * 1.6, scale); // Gouttes étirées verticalement
            this.sweatGroup.add(drop);
        });
        
        this.group.add(this.sweatGroup);
    }
}

