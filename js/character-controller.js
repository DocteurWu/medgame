import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { easeInOut } from './three-animations.js';
import { DoctorAnimator } from './three-animations.js';

export class CharacterController {
    constructor(scene) {
        this.scene = scene;
        
        // Main group
        this.group = new THREE.Group();
        this.group.name = 'Doctor';
        this.group.position.set(0, 0, 2.6);
        this.scene.add(this.group);

        // Procedural doctor (instant fallback)
        this.proceduralGroup = this.createDoctor();
        this.group.add(this.proceduralGroup);
        this.group.userData.armR = this.proceduralGroup.userData.armR;

        this.isMoving = false;
        this.animator = new DoctorAnimator(this.group);

        this.mixer = null;
        this.actions = {};
        this.currentAction = null;
        this.activeModel = null;

        // Bind playAction to group for DoctorAnimator access
        this.group.playAction = this.playAction.bind(this);

        // Load doctor GLB model based on user gender
        this.loadUserGenderAndModel();
    }

    async loadUserGenderAndModel() {
        let gender = 'M';

        // 1. Try local storage first for fast initial rendering
        const savedProfile = localStorage.getItem('medgame_profile');
        if (savedProfile) {
            try {
                const parsed = JSON.parse(savedProfile);
                if (parsed && parsed.sexe) {
                    gender = parsed.sexe;
                }
            } catch (e) {
                console.warn('Error parsing local profile:', e);
            }
        }

        // 2. Query Supabase profiles table in background
        if (window.supabase) {
            try {
                const { data: { session } } = await window.supabase.auth.getSession();
                if (session && session.user) {
                    const { data: profile } = await window.supabase
                        .from('profiles')
                        .select('sexe')
                        .eq('id', session.user.id)
                        .single();
                    
                    if (profile && profile.sexe) {
                        gender = profile.sexe;
                        
                        // Sync with local storage
                        try {
                            const updatedProfile = savedProfile ? JSON.parse(savedProfile) : {};
                            updatedProfile.sexe = gender;
                            localStorage.setItem('medgame_profile', JSON.stringify(updatedProfile));
                        } catch (e) {}
                    }
                }
            } catch (e) {
                console.warn('Could not retrieve user gender from Supabase, using local fallback:', e);
            }
        }

        const modelFile = (gender || 'M').toUpperCase() === 'F' ? 'femme.glb' : 'homme.glb';
        console.log(`[CharacterController] Loading doctor model: ${modelFile} for gender: ${gender}`);
        this.loadModel(`assets/models/doctors/${modelFile}`);
    }

    loadModel(modelPath) {
        const loader = new GLTFLoader();
        loader.load(modelPath, (gltf) => {
            // Remove procedural doctor fallback
            if (this.proceduralGroup) {
                this.group.remove(this.proceduralGroup);
                this.proceduralGroup = null;
            }

            // Remove previous model if any
            if (this.activeModel) {
                this.group.remove(this.activeModel);
            }

            this.activeModel = gltf.scene;

            // Enable shadows
            this.activeModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Auto scale model to target doctor height (1.155m - 30% reduction from 1.65m)
            this.activeModel.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(this.activeModel);
            const size = box.getSize(new THREE.Vector3());
            const targetHeight = 2.3;
            let scale = 1.0;
            if (size.y > 0.1 && size.y < 10) {
                scale = targetHeight / size.y;
            }
            this.activeModel.scale.set(scale, scale, scale);
            
            // Align the bottom of the model (feet) with Y = 0
            const minYOffset = -box.min.y * scale;
            this.activeModel.position.set(0, minYOffset, 0);
            this.activeModel.rotation.set(0, 0, 0);

            this.group.add(this.activeModel);

            // Locate right arm bone/mesh for wave/reach gestures
            let armR = null;
            this.activeModel.traverse((child) => {
                const name = (child.name || '').toLowerCase();
                if (name.includes('rightarm') || name.includes('armr') || name.includes('arm_r') || name.includes('bra_r') || name.includes('bras_r')) {
                    armR = child;
                }
            });
            if (armR) {
                this.group.userData.armR = armR;
            }

            // Handle GLTF animations
            if (gltf.animations && gltf.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(this.activeModel);
                this.group.mixer = this.mixer;
                this.actions = {};
                gltf.animations.forEach((clip) => {
                    this.actions[clip.name.toLowerCase()] = this.mixer.clipAction(clip);
                });

                this.playAction('idle');
            }
        }, undefined, (err) => {
            console.error('Error loading doctor GLB model:', err);
        });
    }

    playAction(name) {
        if (!this.actions || Object.keys(this.actions).length === 0) return;
        const actionName = name.toLowerCase();
        let action = this.actions[actionName];
        if (!action) {
            const keys = Object.keys(this.actions);
            const matchingKey = keys.find(k => k.includes(actionName));
            action = matchingKey ? this.actions[matchingKey] : this.actions[keys[0]];
        }

        if (action && this.currentAction !== action) {
            if (this.currentAction) {
                this.currentAction.fadeOut(0.25);
            }
            action.reset().fadeIn(0.25).play();
            this.currentAction = action;
        }
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
        head.position.y = 1.18;
        head.name = 'DoctorHead';
        head.castShadow = true;
        group.add(head);

        // Cheveux Stylisés (polygones multiples sculptés)
        const hairMat = mat(0x242426, { roughness: 0.9 });
        const hairGroup = new THREE.Group();
        hairGroup.position.set(0, 1.18, 0);

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
        legL.name = 'DoctorLegL';
        group.add(legL);

        const legR = legL.clone();
        legR.position.x = 0.065;
        legR.name = 'DoctorLegR';
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
        armL.name = 'DoctorArmL';
        group.add(armL);

        const armR = armL.clone();
        armR.position.x = 0.21;
        armR.name = 'DoctorArmR';
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
        handL.name = 'DoctorHandL';
        group.add(handL);

        const handR = handL.clone();
        handR.position.x = 0.21;
        handR.name = 'DoctorHandR';
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

    _addDoctorFace(group) {
        const faceMat = (col) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 });
        const headY = 1.18;

        // Yeux (petites sphères blanches)
        const eyeMat = faceMat(0xeeeeee);
        const pupilMat = faceMat(0x222222);
        [-0.04, 0.04].forEach(x => {
            const white = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), eyeMat);
            white.position.set(x, headY + 0.01, 0.1);
            group.add(white);
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), pupilMat);
            pupil.position.set(x, headY + 0.01, 0.115);
            group.add(pupil);
        });

        // Nez (petite bosse)
        const noseMat = faceMat(0xd7a87a);
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), noseMat);
        nose.position.set(0, headY - 0.015, 0.11);
        group.add(nose);

        // Bouche (petit tore)
        const mouthMat = faceMat(0xaa7777);
        const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.003, 4, 8), mouthMat);
        mouth.position.set(0, headY - 0.04, 0.1);
        mouth.rotation.x = Math.PI / 3;
        group.add(mouth);

        // Lunettes (cercles fins)
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.15 });
        [-0.05, 0.05].forEach(x => {
            const frame = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.003, 6, 12), glassMat);
            frame.position.set(x, headY + 0.005, 0.105);
            group.add(frame);
        });
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.003, 0.003), glassMat);
        bridge.position.set(0, headY + 0.005, 0.105);
        group.add(bridge);
    }

    _addStethoscope(group) {
        const stethMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.2 });
        const tubeCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 1.0, 0),
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
            ear.position.set(x, 0.99, -0.14);
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
