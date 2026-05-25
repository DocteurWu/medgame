/**
 * three-environment-agent.js — Agent d'environnement 3D
 * Gère les textures, décors, et éléments d'ambiance de la salle
 */

import * as THREE from 'three';

export class ThreeEnvironmentAgent {
    constructor(scene) {
        this.scene = scene;
        this.textures = new Map();
        this.ivGroup = null;
        this.ecgScreenMesh = null;
        this.dustParticles = null;
    }

    /**
     * Améliore la salle avec des textures procédurales et des détails
     */
    enhanceRoom() {
        this._addWallTextures();
        this._addFloorDetail();
        this._addWindowEffect();
        this._addMedicalPosters();
        this._addCurtain();
        this._addIVStand();
        this._addECGMonitor();
        this._addCharriot();
        this._addDustParticles();
    }

    _addWallTextures() {
        // Les murs sont déjà créés par buildRoom
        // On ajoute des détails procéduraux
        const walls = this.scene.children.filter(
            c => c.name && c.name.includes('Mur')
        );

        walls.forEach(wall => {
            if (wall.material) {
                wall.material.roughness = 0.8;
                wall.material.bumpScale = 0.02;

                // Créer un bump map procédural pour les murs
                wall.material.bumpMap = this._createNoiseTexture(256, 256, 0.3);
                wall.material.needsUpdate = true;
            }
        });
    }

    _addFloorDetail() {
        const floor = this.scene.children.find(c => c.name === 'Sol');
        if (floor && floor.material) {
            floor.material.roughness = 0.9;
            floor.material.bumpScale = 0.01;
            floor.material.bumpMap = this._createTilePattern(512, 512);
            floor.material.needsUpdate = true;
        }
    }

    _addWindowEffect() {
        const windowMesh = this.scene.children.find(c => c.name === 'Fenetre');
        if (windowMesh) {
            // Rendre la fenêtre semi-transparente avec un léger glow
            windowMesh.material.transparent = true;
            windowMesh.material.opacity = 0.6;
            windowMesh.material.emissiveIntensity = 0.15;

            // Ajouter un voile lumineux
            const veilGeom = new THREE.PlaneGeometry(0.6, 0.6);
            const veilMat = new THREE.MeshBasicMaterial({
                color: 0x88ccff,
                transparent: true,
                opacity: 0.08,
                side: THREE.DoubleSide
            });
            const veil = new THREE.Mesh(veilGeom, veilMat);
            veil.position.copy(windowMesh.position);
            veil.position.z += 0.01;
            this.scene.add(veil);

            // --- Faisceau de Lumière Volumétrique (Effet cinématique de soleil) ---
            const shaftGeom = new THREE.CylinderGeometry(0.35, 1.6, 6.2, 32, 1, true);
            // Décaler le pivot vers la base supérieure pour une rotation depuis la fenêtre
            shaftGeom.translate(0, -3.1, 0);
            
            const shaftMat = new THREE.MeshBasicMaterial({
                color: 0xffedd5, // Doré chaud cinématique
                transparent: true,
                opacity: 0.075,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            
            const shaft = new THREE.Mesh(shaftGeom, shaftMat);
            shaft.name = 'VolumetricSunlightRay';
            shaft.position.copy(windowMesh.position);
            shaft.position.x += 0.05;
            
            // Rotation diagonale plongeante vers le lit du patient
            shaft.rotation.z = -1.15; // Plongeant
            shaft.rotation.y = 0.22;  // Tourné vers le centre
            
            this.scene.add(shaft);
        }
    }

    _addMedicalPosters() {
        // Tableau d'affichage médical sur le mur gauche
        const posterGeom = new THREE.PlaneGeometry(0.6, 0.8);

        // Créer un poster avec un dégradé (simule du contenu imprimé)
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 341;
        const ctx = canvas.getContext('2d');

        // Fond
        ctx.fillStyle = '#f5f5f0';
        ctx.fillRect(0, 0, 256, 341);

        // Titre
        ctx.fillStyle = '#1a1a2e';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('PROTOCOLE ECMO', 20, 30);

        // Lignes de texte simulé
        ctx.fillStyle = '#555';
        ctx.font = '8px sans-serif';
        const lines = [
            '1. Cannulation veineuse...',
            '2. Débit initial: 3L/min...',
            '3. Monitorage SpO2 continu...',
            '4. Sédation protocol...'
        ];
        lines.forEach((line, i) => {
            ctx.fillText(line, 20, 60 + i * 25);
        });

        // Bordure
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2;
        ctx.strokeRect(5, 5, 246, 331);

        const posterTexture = new THREE.CanvasTexture(canvas);
        const posterMat = new THREE.MeshStandardMaterial({
            map: posterTexture,
            roughness: 0.8
        });

        const poster = new THREE.Mesh(posterGeom, posterMat);
        poster.position.set(-4.85, 1.5, 1.2);
        poster.rotation.y = Math.PI / 2;
        poster.name = 'MedicalPoster';
        poster.userData.label = 'Affiche médicale';
        poster.userData.interactive = true;
        this.scene.add(poster);

        // Cadre (ajusté pour le poster tourné de π/2 : le Z local devient X monde)
        const frameGeom = new THREE.BoxGeometry(0.62, 0.82, 0.01);
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x8a7e6e, roughness: 0.5, metalness: 0.3 });
        const frame = new THREE.Mesh(frameGeom, frameMat);
        frame.position.copy(poster.position);
        // Poster est rotaté π/2 sur Y : le cadre doit être décalé en X (direction du mur)
        // Le poster normal est en Z+, donc après rotation le décalage arrière est en X-
        frame.position.x -= 0.005;
        frame.rotation.y = Math.PI / 2;
        this.scene.add(frame);

        // Deuxième poster (schéma anatomique)
        const poster2Geom = new THREE.PlaneGeometry(0.5, 0.5);
        const canvas2 = document.createElement('canvas');
        canvas2.width = 256;
        canvas2.height = 256;
        const ctx2 = canvas2.getContext('2d');
        ctx2.fillStyle = '#fff8f0';
        ctx2.fillRect(0, 0, 256, 256);
        ctx2.strokeStyle = '#cc0000';
        ctx2.lineWidth = 2;
        // Cœur simplifié
        ctx2.beginPath();
        ctx2.arc(128, 110, 30, 0, Math.PI * 2);
        ctx2.stroke();
        ctx2.beginPath();
        ctx2.moveTo(128, 140);
        ctx2.lineTo(128, 200);
        ctx2.stroke();
        ctx2.font = '10px sans-serif';
        ctx2.fillStyle = '#333';
        ctx2.fillText('CŒUR', 108, 85);
        const poster2Tex = new THREE.CanvasTexture(canvas2);
        const poster2Mat = new THREE.MeshStandardMaterial({ map: poster2Tex, roughness: 0.8 });
        const poster2 = new THREE.Mesh(poster2Geom, poster2Mat);
        poster2.position.set(-4.85, 1.5, 2.2);
        poster2.rotation.y = Math.PI / 2;
        poster2.name = 'AnatomicalPoster';
        poster2.userData.label = 'Affiche médicale';
        poster2.userData.interactive = true;
        this.scene.add(poster2);

        // Cadre du deuxième poster
        const frame2Geom = new THREE.BoxGeometry(0.52, 0.52, 0.01);
        const frame2 = new THREE.Mesh(frame2Geom, frameMat);
        frame2.position.copy(poster2.position);
        frame2.position.x -= 0.005;
        frame2.rotation.y = Math.PI / 2;
        this.scene.add(frame2);
    }

    _addCurtain() {
        // Rideau de séparation (optionnel, décoratif)
        const curtainGeom = new THREE.PlaneGeometry(1.2, 2.5);
        const curtainCanvas = document.createElement('canvas');
        curtainCanvas.width = 128;
        curtainCanvas.height = 256;
        const cctx = curtainCanvas.getContext('2d');
        const gradient = cctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, '#2a3a5a');
        gradient.addColorStop(1, '#1a2a4a');
        cctx.fillStyle = gradient;
        cctx.fillRect(0, 0, 128, 256);
        // Lignes verticales pour texture tissu
        cctx.strokeStyle = 'rgba(255,255,255,0.05)';
        for (let i = 0; i < 128; i += 4) {
            cctx.beginPath();
            cctx.moveTo(i, 0);
            cctx.lineTo(i, 256);
            cctx.stroke();
        }
        const curtainTex = new THREE.CanvasTexture(curtainCanvas);
        const curtainMat = new THREE.MeshStandardMaterial({
            map: curtainTex,
            roughness: 0.9,
            side: THREE.DoubleSide
        });
        const curtain = new THREE.Mesh(curtainGeom, curtainMat);
        curtain.position.set(0, 1.25, -3.98);
        curtain.name = 'Curtain';
        curtain.userData.label = 'Rideau';
        curtain.userData.interactive = true;
        this.scene.add(curtain);
    }

    // ===== PERFUSION (IV STAND) =====

    _addIVStand() {
        const ivGroup = new THREE.Group();
        ivGroup.position.set(-2.5, 0, -3.0); // Placé à droite de la tête de lit
        ivGroup.name = 'IVStand';
        ivGroup.userData.label = 'Perfusion';
        ivGroup.userData.interactive = true;

        const metalMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.7, roughness: 0.25 });

        // Pied à 5 branches
        const footRadius = 0.22;
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, footRadius * 0.8), poleMat);
            arm.position.set(Math.cos(angle) * footRadius * 0.4, 0.02, Math.sin(angle) * footRadius * 0.4);
            arm.rotation.y = -angle;
            arm.castShadow = true;
            ivGroup.add(arm);
            // Roulette
            const wheel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.02, 0.02, 0.012, 10),
                new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.15 })
            );
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(Math.cos(angle) * footRadius * 0.75, 0.01, Math.sin(angle) * footRadius * 0.75);
            ivGroup.add(wheel);
        }

        // Tube vertical principal
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 1.7, 10), poleMat);
        pole.position.y = 0.87;
        pole.castShadow = true;
        ivGroup.add(pole);

        // Porte-sérum supérieur (crochet)
        const hookTop = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.005, 6, 12), metalMat);
        hookTop.position.y = 1.72;
        hookTop.rotation.x = Math.PI / 4;
        ivGroup.add(hookTop);

        // Poche de perfusion (sérum)
        const bagMat = new THREE.MeshStandardMaterial({
            color: 0xddeeff,
            transparent: true,
            opacity: 0.75,
            roughness: 0.1,
            metalness: 0.0,
            emissive: 0x4488cc,
            emissiveIntensity: 0.05,
            side: THREE.DoubleSide
        });
        const bag = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.03), bagMat);
        bag.position.set(0, 1.58, 0);
        bag.name = 'IVBag';
        ivGroup.add(bag);

        // Étiquette de la poche (zone blanche)
        const labelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
        const label = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.032), labelMat);
        label.position.set(0, 1.53, 0);
        ivGroup.add(label);

        // Port de connexion bas (embout cone)
        const portMat = new THREE.MeshStandardMaterial({ color: 0x88bbdd, roughness: 0.3, metalness: 0.2 });
        const portCone = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.02, 8), portMat);
        portCone.position.set(0, 1.52, 0);
        portCone.rotation.x = Math.PI;
        ivGroup.add(portCone);

        // Tuyau descendant (tube CatmullRom)
        const tubePoints = [
            new THREE.Vector3(0, 1.52, 0),
            new THREE.Vector3(0.01, 1.42, 0),
            new THREE.Vector3(-0.005, 1.30, 0.01),
            new THREE.Vector3(0.005, 1.18, -0.005),
            new THREE.Vector3(0, 1.05, 0),
        ];
        const tubeCurve = new THREE.CatmullRomCurve3(tubePoints);
        const tube = new THREE.Mesh(
            new THREE.TubeGeometry(tubeCurve, 16, 0.003, 6, false),
            new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2, metalness: 0.0, transparent: true, opacity: 0.85 })
        );
        ivGroup.add(tube);

        // Chambre de goutte (cylindre transparent)
        const chamberMat = new THREE.MeshStandardMaterial({
            color: 0xddeeff,
            transparent: true,
            opacity: 0.5,
            roughness: 0.05,
            metalness: 0.1,
            side: THREE.DoubleSide
        });
        const chamber = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 8), chamberMat);
        chamber.position.set(0, 1.28, 0);
        chamber.name = 'IVChamber';
        ivGroup.add(chamber);

        // Tuyau bas (vers le patient)
        const lowTubePoints = [
            new THREE.Vector3(0, 1.05, 0),
            new THREE.Vector3(0.02, 0.85, -0.02),
            new THREE.Vector3(0.05, 0.65, -0.04),
            new THREE.Vector3(0.15, 0.45, 0.0),
        ];
        const lowCurve = new THREE.CatmullRomCurve3(lowTubePoints);
        const lowTube = new THREE.Mesh(
            new THREE.TubeGeometry(lowCurve, 12, 0.003, 6, false),
            new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2, transparent: true, opacity: 0.85 })
        );
        ivGroup.add(lowTube);

        // Molette de régulation
        const rollerMat = new THREE.MeshStandardMaterial({ color: 0x446688, roughness: 0.3, metalness: 0.4 });
        const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.015, 10), rollerMat);
        roller.position.set(0.02, 0.95, 0);
        roller.rotation.x = Math.PI / 2;
        ivGroup.add(roller);

        this.scene.add(ivGroup);
        this.ivGroup = ivGroup;

        // Rendre tous les sous-meshes interactifs pour le raycasting
        ivGroup.traverse((child) => {
            if (child.isMesh) {
                child.userData.interactive = true;
                child.userData.label = 'Perfusion';
            }
        });
    }

    // ===== MONITEUR ECG SUR PIED =====

    _addECGMonitor() {
        const ecgGroup = new THREE.Group();
        ecgGroup.position.set(-2.8, 0, -3.2); // Reste à côté de la tête de lit
        ecgGroup.name = 'ECGMonitor';
        ecgGroup.userData.label = 'Moniteur ECG';
        ecgGroup.userData.interactive = true;

        const metalMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.7, roughness: 0.25 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.3 });

        // Pied à 5 branches (chariot) avec roulettes
        const footRadius = 0.2;
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, footRadius * 0.7), metalMat);
            arm.position.set(Math.cos(angle) * footRadius * 0.35, 0.02, Math.sin(angle) * footRadius * 0.35);
            arm.rotation.y = -angle;
            arm.castShadow = true;
            ecgGroup.add(arm);
            const wheel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.018, 0.018, 0.014, 10),
                new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.1 })
            );
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(Math.cos(angle) * footRadius * 0.7, 0.01, Math.sin(angle) * footRadius * 0.7);
            ecgGroup.add(wheel);
        }

        // Tube vertical
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 1.3, 10), metalMat);
        pole.position.y = 0.67;
        pole.castShadow = true;
        ecgGroup.add(pole);

        // Bras horizontal (supports l'écran)
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.15), metalMat);
        arm.position.set(0, 1.25, 0.06);
        ecgGroup.add(arm);

        // Bras articulé (col de cygne)
        const neckCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 1.25, 0.13),
            new THREE.Vector3(0, 1.28, 0.17),
            new THREE.Vector3(0, 1.30, 0.22),
        ]);
        const neckTube = new THREE.Mesh(
            new THREE.TubeGeometry(neckCurve, 8, 0.012, 6, false),
            metalMat
        );
        ecgGroup.add(neckTube);

        // Écran ECG (texture canvas animée ajoutée via ECGScreenAnimator)
        const ecgCanvas = document.createElement('canvas');
        ecgCanvas.width = 256;
        ecgCanvas.height = 96;
        const ecgCtx = ecgCanvas.getContext('2d');
        ecgCtx.fillStyle = '#001a00';
        ecgCtx.fillRect(0, 0, 256, 96);
        const ecgTexture = new THREE.CanvasTexture(ecgCanvas);
        ecgTexture.minFilter = THREE.LinearFilter;

        // Coque de l'écran
        const ecgShellMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.3 });
        const ecgShell = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.04), ecgShellMat);
        ecgShell.position.set(0, 1.38, 0.22);
        ecgShell.castShadow = true;
        ecgGroup.add(ecgShell);

        // Surface de l'écran (écran LCD vert)
        const ecgScreenMat = new THREE.MeshStandardMaterial({
            map: ecgTexture,
            emissive: 0x003311,
            emissiveIntensity: 0.8,
            roughness: 0.05
        });
        const ecgScreen = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.005), ecgScreenMat);
        ecgScreen.position.set(0, 1.38, 0.245);
        ecgScreen.name = 'ECGScreen';
        ecgGroup.add(ecgScreen);

        // Boutons sous l'écran
        const btnColors = [0xcc3333, 0x33cc33, 0xffff44, 0x3366ff];
        btnColors.forEach((col, i) => {
            const btn = new THREE.Mesh(
                new THREE.CylinderGeometry(0.006, 0.006, 0.004, 8),
                new THREE.MeshStandardMaterial({ color: col, roughness: 0.3, metalness: 0.4, emissive: col, emissiveIntensity: 0.2 })
            );
            btn.rotation.x = Math.PI / 2;
            btn.position.set(-0.1 + i * 0.065, 1.25, 0.235);
            ecgGroup.add(btn);
        });

        // LED d'état (pulsante verte)
        const statusLedMat = new THREE.MeshStandardMaterial({
            color: 0x00ff44,
            emissive: 0x00ff44,
            emissiveIntensity: 1.0,
            roughness: 0.1
        });
        const statusLed = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 4), statusLedMat);
        statusLed.position.set(0.14, 1.45, 0.24);
        ecgGroup.add(statusLed);

        // Câble ECG (tuyau du patient vers le moniteur)
        const cableCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 1.22, 0.22),
            new THREE.Vector3(-0.3, 1.0, 0.1),
            new THREE.Vector3(-0.6, 0.85, -0.3),
            new THREE.Vector3(-0.8, 0.82, -0.5),
        ]);
        const cable = new THREE.Mesh(
            new THREE.TubeGeometry(cableCurve, 16, 0.003, 6, false),
            new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.3 })
        );
        ecgGroup.add(cable);

        // Sondes (3 pastilles au bout du câble)
        const probeMat = new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.4, metalness: 0.3 });
        for (let i = 0; i < 3; i++) {
            const probe = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), probeMat);
            probe.position.set(-0.75 - i * 0.04, 0.82, -0.45 - i * 0.03);
            ecgGroup.add(probe);
        }

        // Stocker la LED d'état pour animation pulsante
        this._ecgStatusLedMat = statusLedMat;

        this.scene.add(ecgGroup);
        this.ecgScreenMesh = ecgScreen;

        // Rendre tous les sous-meshes interactifs pour le raycasting
        ecgGroup.traverse((child) => {
            if (child.isMesh) {
                child.userData.interactive = true;
                child.userData.label = 'Moniteur ECG';
            }
        });
    }

    // ===== CHARRIOT MÉDICAL =====

    _addCharriot() {
        const chart = new THREE.Group();
        chart.position.set(-2.35, 0, -0.9); // Placé près du pied du lit dans l'espace vide
        chart.name = 'CharriotMedical';
        chart.userData.label = 'Charriot médical';
        chart.userData.interactive = true;

        const frameMat = new THREE.MeshStandardMaterial({ color: 0xc0c8d0, metalness: 0.6, roughness: 0.25 });
        const trayMat = new THREE.MeshStandardMaterial({ color: 0xe8eef0, roughness: 0.4, metalness: 0.15, side: THREE.DoubleSide });
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.15 });

        // 4 colonnes
        const colGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.85, 8);
        const colPositions = [[-0.18, 0.44, -0.14], [0.18, 0.44, -0.14], [-0.18, 0.44, 0.14], [0.18, 0.44, 0.14]];
        colPositions.forEach(([x, y, z]) => {
            const col = new THREE.Mesh(colGeom, frameMat);
            col.position.set(x, y, z);
            col.castShadow = true;
            chart.add(col);
        });

        // Plateau supérieur
        const topTray = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.015, 0.32), trayMat);
        topTray.position.set(0, 0.84, 0);
        topTray.castShadow = true;
        topTray.receiveShadow = true;
        chart.add(topTray);

        // Rebord du plateau supérieur (bordure de sécurité)
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xa0b0c0, metalness: 0.5, roughness: 0.3 });
        // Rebord avant
        const rimFront = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.025, 0.008), rimMat);
        rimFront.position.set(0, 0.86, 0.16);
        chart.add(rimFront);
        // Rebord arrière
        const rimBack = rimFront.clone();
        rimBack.position.z = -0.16;
        chart.add(rimBack);
        // Rebords latéraux
        const rimSideGeom = new THREE.BoxGeometry(0.008, 0.025, 0.32);
        const rimLeft = new THREE.Mesh(rimSideGeom, rimMat);
        rimLeft.position.set(-0.21, 0.86, 0);
        chart.add(rimLeft);
        const rimRight = rimLeft.clone();
        rimRight.position.x = 0.21;
        chart.add(rimRight);

        // Plateau inférieur
        const bottomTray = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.015, 0.28), trayMat);
        bottomTray.position.set(0, 0.35, 0);
        bottomTray.castShadow = true;
        bottomTray.receiveShadow = true;
        chart.add(bottomTray);

        // Barre pousser (poignée)
        const handleCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.18, 0.84, -0.18),
            new THREE.Vector3(-0.18, 0.94, -0.18),
            new THREE.Vector3(0.18, 0.94, -0.18),
            new THREE.Vector3(0.18, 0.84, -0.18),
        ]);
        const handle = new THREE.Mesh(
            new THREE.TubeGeometry(handleCurve, 12, 0.008, 6, false),
            frameMat
        );
        handle.castShadow = true;
        chart.add(handle);

        // 4 roulettes
        const wheelGeom = new THREE.CylinderGeometry(0.025, 0.025, 0.016, 12);
        colPositions.forEach(([x, , z]) => {
            const wheel = new THREE.Mesh(wheelGeom, wheelMat);
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(x, 0.02, z);
            chart.add(wheel);
            // Axe de roulette
            const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.04, 6), frameMat);
            axle.rotation.x = Math.PI / 2;
            axle.position.set(x, 0.035, z);
            chart.add(axle);
        });

        // Objets sur le plateau supérieur : gants jetables (boîte)
        const gloveBoxMat = new THREE.MeshStandardMaterial({ color: 0x4488cc, roughness: 0.6, metalness: 0.1 });
        const gloveBox = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.06), gloveBoxMat);
        gloveBox.position.set(0.08, 0.87, 0.05);
        gloveBox.castShadow = true;
        chart.add(gloveBox);

        // Désinfectant (flacon)
        const bottleMat = new THREE.MeshStandardMaterial({ color: 0xff9933, roughness: 0.4, metalness: 0.15, transparent: true, opacity: 0.85 });
        const bottleBody = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.015, 0.07, 8), bottleMat);
        bottleBody.position.set(-0.08, 0.89, 0.06);
        bottleBody.castShadow = true;
        chart.add(bottleBody);
        // Bouchon du flacon
        const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.012, 8), capMat);
        cap.position.set(-0.08, 0.935, 0.06);
        chart.add(cap);

        // Compresses (petit paquet)
        const compressMat = new THREE.MeshStandardMaterial({ color: 0xf0f0e8, roughness: 0.9 });
        const compress = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.05), compressMat);
        compress.position.set(-0.02, 0.86, -0.05);
        compress.rotation.y = 0.2;
        chart.add(compress);

        // Masque O2 (sur le plateau inférieur)
        const maskMat = new THREE.MeshStandardMaterial({ color: 0x44ccff, transparent: true, opacity: 0.6, roughness: 0.2 });
        const maskGeom = new THREE.CylinderGeometry(0.03, 0.04, 0.05, 8);
        const mask = new THREE.Mesh(maskGeom, maskMat);
        mask.position.set(0.05, 0.38, 0);
        mask.rotation.x = Math.PI / 2;
        mask.castShadow = true;
        mask.name = 'MasqueO2';
        mask.userData = { label: 'Masque à Oxygène', interactive: true };
        chart.add(mask);

        this.scene.add(chart);

        // Rendre tous les sous-meshes interactifs pour le raycasting
        chart.traverse((child) => {
            if (child.isMesh) {
                child.userData.interactive = true;
                // Ne pas écraser le nom/label du masque O2
                if (child.name !== 'MasqueO2') {
                    child.userData.label = 'Charriot médical';
                }
            }
        });
    }

    // ===== PARTICULES DE POUSSIÈRE =====

    _addDustParticles() {
        const dustCount = 200;
        const dustGeom = new THREE.BufferGeometry();
        const dustPositions = new Float32Array(dustCount * 3);

        for (let i = 0; i < dustCount; i++) {
            if (i < 100) {
                // Moitié des poussières concentrées et illuminées le long du faisceau de la fenêtre
                const t = Math.random(); // Paramètre le long du rayon
                const rx = -4.9 + 5.5 * t;
                const ry = 1.8 - 1.8 * t;
                const rz = -1.0 + (Math.random() - 0.5) * 1.8;
                
                // Jitter radial
                dustPositions[i * 3] = rx + (Math.random() - 0.5) * 0.6;
                dustPositions[i * 3 + 1] = ry + (Math.random() - 0.5) * 0.6;
                dustPositions[i * 3 + 2] = rz + (Math.random() - 0.5) * 0.6;
            } else {
                // L'autre moitié dispersée dans toute la salle
                dustPositions[i * 3] = (Math.random() - 0.5) * 8;
                dustPositions[i * 3 + 1] = Math.random() * 3 + 0.5;
                dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 6;
            }
        }

        dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));

        const dustMat = new THREE.PointsMaterial({
            color: 0xffedd5, // Assorti au soleil doré chaud !
            size: 0.022,
            transparent: true,
            opacity: 0.25, // Un peu plus visible pour sublimer l'effet volumétrique
            sizeAttenuation: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const dustParticles = new THREE.Points(dustGeom, dustMat);
        dustParticles.name = 'DustParticles';
        this.scene.add(dustParticles);
        this.dustParticles = dustParticles;
    }

    /**
     * Retourne le groupe de la perfusion pour l'animateur
     */
    getIVGroup() {
        return this.ivGroup;
    }

    /**
     * Retourne le mesh de l'écran ECG pour l'animateur
     */
    getECGScreenMesh() {
        return this.ecgScreenMesh;
    }

    /**
     * Retourne le système de particules de poussière pour l'animateur
     */
    getDustParticles() {
        return this.dustParticles;
    }

    /**
     * Met à jour les animations d'environnement (LED ECG, etc.)
     * Appeler dans la boucle de rendu avec le temps elapsed.
     */
    updateEnvironment(elapsed) {
        // LED d'état ECG : pulsation cardiaque réaliste
        if (this._ecgStatusLedMat) {
            const t = (elapsed * 1.2) % 1;
            const beat = t < 0.1 ? Math.sin(t / 0.1 * Math.PI) : 0.15;
            this._ecgStatusLedMat.emissiveIntensity = 0.3 + beat * 0.7;
        }
    }

    _createNoiseTexture(width, height, intensity) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);
        for (let i = 0; i < imageData.data.length; i += 4) {
            const val = Math.random() * 255 * intensity;
            imageData.data[i] = val;
            imageData.data[i + 1] = val;
            imageData.data[i + 2] = val;
            imageData.data[i + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);
        return new THREE.CanvasTexture(canvas);
    }

    _createTilePattern(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#c8c0b0';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        const tileSize = 32;
        for (let x = 0; x < width; x += tileSize) {
            for (let y = 0; y < height; y += tileSize) {
                ctx.strokeRect(x, y, tileSize, tileSize);
            }
        }
        return new THREE.CanvasTexture(canvas);
    }
}