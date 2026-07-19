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
        this.wallEcgScreenMesh = null;
        this.dustParticles = null;
        // Références d'animation décorative (horloge murale temps réel)
        this._clockHands = null;
    }

    /**
     * Améliore la salle avec des textures procédurales et des détails
     */
    enhanceRoom() {
        this._addWallTextures();
        this._addFloorDetail();
        // this._addWindowEffect(); // Volumetric window light beam removed as requested
        this._addMedicalPosters();
        // this._addCurtain(); // Removed, replaced by 3D Door model in three-room.js
        this._addIVStand();
        this._addECGMonitor();
        this._addWallECGMonitor();
        this._addCharriot();
        this._addDustParticles();
        this._addMedicineCabinet();
        this._addPottedPlant();
        this._addExaminationBedDetails();
        // --- Habillage clinique & ambiance lumineuse (extensions purement décoratives,
        //     non interactives : aucun impact sur le raycasting / la logique de jeu) ---
        this._addCeilingLightPanels();
        this._addWallWainscot();
        this._addVitalSignsMonitor();
        this._addWasteBins();
        this._addSinkAccessories();
        this._addWallClock();
    }

    _addWallTextures() {
        const walls = this.scene.children.filter(
            c => c.name && c.name.includes('Mur')
        );

        walls.forEach(wall => {
            if (wall.material) {
                wall.material.roughness = 0.8;
                wall.material.bumpScale = 0.02;
                wall.material.bumpMap = this._createNoiseTexture(256, 256, 0.3);
                wall.material.needsUpdate = true;
            }
        });
    }

    _addFloorDetail() {
        const floor = this.scene.children.find(c => c.name === 'Sol');
        if (floor && floor.material) {
            // Sol clinique type linoléum/PVC semi-mat :
            // on casse les reflets "miroir" (roughness relevée, vernis retiré, IBL atténué)
            floor.material.roughness = 0.52;
            if ('clearcoat' in floor.material) {
                floor.material.clearcoat = 0.0;
                floor.material.clearcoatRoughness = 0.5;
            }
            if ('envMapIntensity' in floor.material) {
                floor.material.envMapIntensity = 0.28;
            }
            if ('aoMapIntensity' in floor.material) {
                floor.material.aoMapIntensity = 1.0;
            }
            floor.material.needsUpdate = true;
        }
    }

    _addWindowEffect() {
        // --- Faisceau de Lumière Volumétrique (Effet cinématique de soleil) ---
        const shaftGeom = new THREE.CylinderGeometry(0.35, 1.8, 6.8, 32, 1, true);
        // Décaler le pivot vers la base supérieure pour une rotation depuis le plafond
        shaftGeom.translate(0, -3.4, 0);

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
        shaft.position.set(4.8, 4.2, -2.0); // Origin at top right corner

        // Rotation diagonale plongeante depuis le haut droit vers le lit/bureau
        shaft.rotation.z = 1.15; // Plongeant
        shaft.rotation.y = -0.22;

        this.scene.add(shaft);
    }

    _addMedicalPosters() {
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x8a7e6e, roughness: 0.5, metalness: 0.3 });

        // Poster 1: PROTOCOLE ECMO (left wall, wall at x=-5.5)
        const posterGeom = new THREE.PlaneGeometry(0.6, 0.8);
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 682;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f5f5f0';
        ctx.fillRect(0, 0, 512, 682);
        ctx.fillStyle = '#1a1a2e';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText('PROTOCOLE ECMO', 40, 60);
        ctx.fillStyle = '#555';
        ctx.font = '16px sans-serif';
        const lines = [
            '1. Cannulation veineuse...',
            '2. Débit initial: 3L/min...',
            '3. Monitorage SpO2 continu...',
            '4. Sédation protocol...'
        ];
        lines.forEach((line, i) => {
            ctx.fillText(line, 40, 120 + i * 50);
        });
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 4;
        ctx.strokeRect(10, 10, 492, 662);

        const posterTexture = new THREE.CanvasTexture(canvas);
        posterTexture.colorSpace = THREE.SRGBColorSpace;
        posterTexture.generateMipmaps = true;
        posterTexture.minFilter = THREE.LinearMipmapLinearFilter;
        posterTexture.magFilter = THREE.LinearFilter;

        // Anti Z-Fighting (polygonOffset) + Lissage Alpha Blend (transparent + low alphaTest threshold)
        const posterMat = new THREE.MeshStandardMaterial({
            map: posterTexture,
            roughness: 0.8,
            transparent: true,
            opacity: 1.0,
            alphaTest: 0.005,
            depthWrite: true,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
        });

        // Frame is centered at x = -5.46 with depth 0.01 (front face at x = -5.455)
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.82, 0.01), frameMat);
        frame.position.set(-5.46, 1.8, -1.2);
        frame.rotation.y = Math.PI / 2;
        this.scene.add(frame);

        // Poster plane is offset in front at x = -5.445 (10mm clear gap from frame face, 5.5cm from wall)
        const poster = new THREE.Mesh(posterGeom, posterMat);
        poster.position.set(-5.445, 1.8, -1.2);
        poster.rotation.y = Math.PI / 2;
        poster.name = 'MedicalPoster';
        poster.userData.label = 'Affiche médicale';
        poster.userData.interactive = true;
        this.scene.add(poster);

        // Poster 2: ANATOMICAL CHART (using detailed canvas blueprint)
        const poster2Geom = new THREE.PlaneGeometry(0.6, 0.9);
        const anatomyCanvas = document.createElement('canvas');
        anatomyCanvas.width = 1024;
        anatomyCanvas.height = 1536;
        const ctxA = anatomyCanvas.getContext('2d');
        ctxA.fillStyle = '#fefbf3';
        ctxA.fillRect(0, 0, 1024, 1536);
        ctxA.strokeStyle = '#332211';
        ctxA.lineWidth = 24;
        ctxA.strokeRect(12, 12, 1000, 1512);
        ctxA.strokeStyle = '#554433';
        ctxA.lineWidth = 2;
        ctxA.strokeRect(40, 40, 944, 1456);

        ctxA.fillStyle = '#554433';
        ctxA.font = 'bold 48px monospace';
        ctxA.textAlign = 'center';
        ctxA.fillText("ANATOMIE HUMAINE", 512, 110);
        ctxA.font = '20px monospace';
        ctxA.fillText("SYSTÈME CARDIO-RENAL / CLINIQUE 3D", 512, 150);

        ctxA.strokeStyle = '#b23b3b'; // Red circulation
        ctxA.lineWidth = 4;
        ctxA.beginPath();
        ctxA.lineCap = 'round';
        ctxA.arc(512, 340, 64, 0, Math.PI * 2);
        ctxA.moveTo(512, 404);
        ctxA.lineTo(512, 800);
        for (let r = 460; r < 680; r += 40) {
            ctxA.moveTo(500, r); ctxA.quadraticCurveTo(460, r - 10, 430, r + 16);
            ctxA.moveTo(524, r); ctxA.quadraticCurveTo(564, r - 10, 594, r + 16);
        }
        ctxA.rect(472, 800, 80, 50);
        ctxA.moveTo(512, 440); ctxA.lineTo(340, 560);
        ctxA.moveTo(512, 440); ctxA.lineTo(684, 560);
        ctxA.moveTo(476, 850); ctxA.lineTo(420, 1160);
        ctxA.moveTo(548, 850); ctxA.lineTo(604, 1160);
        ctxA.stroke();

        ctxA.strokeStyle = '#2563eb'; // Blue veins
        ctxA.lineWidth = 3;
        ctxA.beginPath();
        ctxA.moveTo(508, 500);
        ctxA.bezierCurveTo(480, 560, 490, 660, 420, 720);
        ctxA.moveTo(508, 600);
        ctxA.lineTo(360, 550);
        ctxA.stroke();

        ctxA.strokeStyle = '#554433';
        ctxA.lineWidth = 3;
        ctxA.strokeRect(80, 1120, 320, 300);
        ctxA.fillStyle = '#5d4037';
        ctxA.font = 'bold 24px sans-serif';
        ctxA.textAlign = 'left';
        ctxA.fillText("FIG 1. CONFIGURATION", 96, 1156);
        ctxA.font = '18px monospace';
        ctxA.fillText("Aorte ascendante", 96, 1200);
        ctxA.fillText("Ventricule gauche", 96, 1230);
        ctxA.fillText("Oreillette droite", 96, 1260);
        ctxA.fillText("Valvule mitrale", 96, 1290);

        ctxA.strokeStyle = '#b91c1c';
        ctxA.beginPath();
        ctxA.arc(300, 1260, 40, 0, Math.PI * 2);
        ctxA.stroke();

        ctxA.strokeRect(624, 1120, 320, 300);
        ctxA.fillStyle = '#5d4037';
        ctxA.font = 'bold 24px sans-serif';
        ctxA.fillText("FIG 2. FLUX CÉRÉBRAL", 640, 1156);
        ctxA.font = '18px monospace';
        ctxA.fillText("Lobe frontal", 640, 1200);
        ctxA.fillText("Cervelet", 640, 1230);
        ctxA.fillText("Moelle épinière", 640, 1260);
        ctxA.fillText("Cortex sensoriel", 640, 1290);

        ctxA.strokeStyle = '#2563eb';
        ctxA.beginPath();
        ctxA.ellipse(840, 1260, 40, 28, 0, 0, Math.PI * 2);
        ctxA.stroke();

        ctxA.fillStyle = '#1e293b';
        ctxA.font = 'bold 18px sans-serif';
        ctxA.fillText("Boîte Crânienne [1]", 660, 300);
        ctxA.fillText("Sternum [2]", 140, 520);
        ctxA.fillText("Aorte & Valves [3]", 240, 620);
        ctxA.fillText("Fémur [4]", 220, 1020);
        ctxA.fillText("Tibias & Fibula [5]", 660, 1020);

        const anatomyTexture = new THREE.CanvasTexture(anatomyCanvas);
        anatomyTexture.colorSpace = THREE.SRGBColorSpace;
        anatomyTexture.generateMipmaps = true;
        anatomyTexture.minFilter = THREE.LinearMipmapLinearFilter;
        anatomyTexture.magFilter = THREE.LinearFilter;

        const poster2Mat = new THREE.MeshStandardMaterial({
            map: anatomyTexture,
            roughness: 0.8,
            transparent: true,
            opacity: 1.0,
            alphaTest: 0.005,
            depthWrite: true,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
        });

        // Frame2 centered at x = -5.46
        const frame2 = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.92, 0.01), frameMat);
        frame2.position.set(-5.46, 1.8, -2.4);
        frame2.rotation.y = Math.PI / 2;
        this.scene.add(frame2);

        // Poster 2 plane offset in front at x = -5.445
        const poster2 = new THREE.Mesh(poster2Geom, poster2Mat);
        poster2.position.set(-5.445, 1.8, -2.4);
        poster2.rotation.y = Math.PI / 2;
        poster2.name = 'AnatomicalPoster';
        poster2.userData.label = 'Affiche médicale';
        poster2.userData.interactive = true;
        this.scene.add(poster2);
    }

    _addCurtain() {
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
        curtain.position.set(0, 1.25, -4.95);
        curtain.name = 'Curtain';
        curtain.userData.label = 'Rideau';
        curtain.userData.interactive = true;
        this.scene.add(curtain);
    }

    // ===== PERFUSION (IV STAND) =====
    _addIVStand() {
        const ivGroup = new THREE.Group();
        ivGroup.position.set(5.2, 0, -0.4); // Placed at head side of right bed (after 180 rotation)
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

        // Étiquette
        const labelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
        const label = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.032), labelMat);
        label.position.set(0, 1.53, 0);
        ivGroup.add(label);

        // Port bas
        const portMat = new THREE.MeshStandardMaterial({ color: 0x88bbdd, roughness: 0.3, metalness: 0.2 });
        const portCone = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.02, 8), portMat);
        portCone.position.set(0, 1.52, 0);
        portCone.rotation.x = Math.PI;
        ivGroup.add(portCone);

        // Tuyau descendant
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

        // Chambre de goutte
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

        // Tuyau bas
        const lowTubePoints = [
            new THREE.Vector3(0, 1.05, 0),
            new THREE.Vector3(-0.05, 0.85, -0.1),
            new THREE.Vector3(-0.15, 0.65, -0.2),
            new THREE.Vector3(-0.3, 0.45, -0.4),
        ];
        const lowCurve = new THREE.CatmullRomCurve3(lowTubePoints);
        const lowTube = new THREE.Mesh(
            new THREE.TubeGeometry(lowCurve, 12, 0.003, 6, false),
            new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2, transparent: true, opacity: 0.85 })
        );
        ivGroup.add(lowTube);

        // Molette
        const rollerMat = new THREE.MeshStandardMaterial({ color: 0x446688, roughness: 0.3, metalness: 0.4 });
        const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.015, 10), rollerMat);
        roller.position.set(0.02, 0.95, 0);
        roller.rotation.x = Math.PI / 2;
        ivGroup.add(roller);

        this.scene.add(ivGroup);
        this.ivGroup = ivGroup;

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
        ecgGroup.position.set(3.8, 0, -0.4); // Head side of right bed (after 180 rotation)
        ecgGroup.name = 'ECGMonitor';
        ecgGroup.userData.label = 'Moniteur ECG';
        ecgGroup.userData.interactive = true;

        const metalMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.7, roughness: 0.25 });

        // Pied
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

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 1.3, 10), metalMat);
        pole.position.y = 0.67;
        pole.castShadow = true;
        ecgGroup.add(pole);

        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.15), metalMat);
        arm.position.set(0, 1.25, 0.06);
        ecgGroup.add(arm);

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

        // Screen
        const ecgCanvas = document.createElement('canvas');
        ecgCanvas.width = 256;
        ecgCanvas.height = 96;
        const ecgCtx = ecgCanvas.getContext('2d');
        ecgCtx.fillStyle = '#001a00';
        ecgCtx.fillRect(0, 0, 256, 96);
        const ecgTexture = new THREE.CanvasTexture(ecgCanvas);
        ecgTexture.minFilter = THREE.LinearFilter;
        ecgTexture.colorSpace = THREE.SRGBColorSpace;

        const ecgShellMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.3 });
        const ecgShell = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.04), ecgShellMat);
        ecgShell.position.set(0, 1.38, 0.22);
        ecgShell.castShadow = true;
        ecgGroup.add(ecgShell);

        // emissiveMap: le tracé ECG animé devient lui-même lumineux (glow projeté)
        const ecgScreenMat = new THREE.MeshStandardMaterial({
            map: ecgTexture,
            emissive: 0xffffff,
            emissiveMap: ecgTexture,
            emissiveIntensity: 0.9,
            roughness: 0.05
        });
        const ecgScreen = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.005), ecgScreenMat);
        ecgScreen.position.set(0, 1.38, 0.245);
        ecgScreen.name = 'ECGScreen';
        ecgGroup.add(ecgScreen);

        // Buttons
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

        // Status LED
        const statusLedMat = new THREE.MeshStandardMaterial({
            color: 0x00ff44,
            emissive: 0x00ff44,
            emissiveIntensity: 1.0,
            roughness: 0.1
        });
        const statusLed = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 4), statusLedMat);
        statusLed.position.set(0.14, 1.45, 0.24);
        ecgGroup.add(statusLed);

        // Patient Cable
        const cableCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 1.22, 0.22),
            new THREE.Vector3(0.2, 1.0, 0.0),
            new THREE.Vector3(0.5, 0.85, -0.2),
            new THREE.Vector3(0.8, 0.82, -0.4),
        ]);
        const cable = new THREE.Mesh(
            new THREE.TubeGeometry(cableCurve, 16, 0.003, 6, false),
            new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.3 })
        );
        ecgGroup.add(cable);

        // Probes
        const probeMat = new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.4, metalness: 0.3 });
        for (let i = 0; i < 3; i++) {
            const probe = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), probeMat);
            probe.position.set(0.75 + i * 0.04, 0.82, -0.4 - i * 0.03);
            ecgGroup.add(probe);
        }

        this._ecgStatusLedMat = statusLedMat;
        this.scene.add(ecgGroup);
        this.ecgScreenMesh = ecgScreen;

        ecgGroup.traverse((child) => {
            if (child.isMesh) {
                child.userData.interactive = true;
                child.userData.label = 'Moniteur ECG';
            }
        });
    }

    // ===== MONITEUR ECG MURAL (on right wall, x = 5.45) =====
    _addWallECGMonitor() {
        const group = new THREE.Group();
        group.position.set(4.0, 2.2, -4.95);
        group.rotation.y = 0; // Lie flush on the back wall
        group.name = 'WallECGMonitor';
        group.userData.label = 'Moniteur ECG mural';
        group.userData.interactive = true;

        const ecgCanvas = document.createElement('canvas');
        ecgCanvas.width = 256;
        ecgCanvas.height = 96;
        const ecgCtx = ecgCanvas.getContext('2d');
        ecgCtx.fillStyle = '#001a00';
        ecgCtx.fillRect(0, 0, 256, 96);
        const ecgTexture = new THREE.CanvasTexture(ecgCanvas);
        ecgTexture.minFilter = THREE.LinearFilter;
        ecgTexture.colorSpace = THREE.SRGBColorSpace;

        const shellMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.3 });
        const shell = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.06), shellMat);
        shell.castShadow = true;
        shell.receiveShadow = true;
        group.add(shell);

        // emissiveMap: le tracé animé rayonne (bloom + lumière d'ambiance)
        const screenMat = new THREE.MeshStandardMaterial({
            map: ecgTexture,
            emissive: 0xffffff,
            emissiveMap: ecgTexture,
            emissiveIntensity: 0.9,
            roughness: 0.05
        });
        const screen = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.29, 0.005), screenMat);
        screen.position.z = 0.035;
        screen.name = 'WallECGScreen';
        group.add(screen);

        const ledMat = new THREE.MeshStandardMaterial({
            color: 0x00ff44,
            emissive: 0x00ff44,
            emissiveIntensity: 1.0,
            roughness: 0.1
        });
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 4), ledMat);
        led.position.set(0.22, 0.16, 0.035);
        group.add(led);

        this.scene.add(group);
        this.wallEcgScreenMesh = screen;
        this._wallEcgLedMat = ledMat;

        group.traverse((child) => {
            if (child.isMesh) {
                child.userData.interactive = true;
                child.userData.label = 'Moniteur ECG mural';
            }
        });
    }

    // ===== CHARRIOT MÉDICAL (placed near foot of right bed) =====
    _addCharriot() {
        const chart = new THREE.Group();
        chart.position.set(3.6, 0, -1.1); // Foot-left side of bed
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

        // Rebord
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xa0b0c0, metalness: 0.5, roughness: 0.3 });
        const rimFront = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.025, 0.008), rimMat);
        rimFront.position.set(0, 0.86, 0.16);
        chart.add(rimFront);
        const rimBack = rimFront.clone();
        rimBack.position.z = -0.16;
        chart.add(rimBack);
        const rimLeft = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.025, 0.32), rimMat);
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

        // Poignée
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
            const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.04, 6), frameMat);
            axle.rotation.x = Math.PI / 2;
            axle.position.set(x, 0.035, z);
            chart.add(axle);
        });

        // Boîte gants
        const gloveBoxMat = new THREE.MeshStandardMaterial({ color: 0x4488cc, roughness: 0.6, metalness: 0.1 });
        const gloveBox = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.06), gloveBoxMat);
        gloveBox.position.set(0.08, 0.87, 0.05);
        gloveBox.castShadow = true;
        chart.add(gloveBox);

        // Désinfectant
        const bottleMat = new THREE.MeshStandardMaterial({ color: 0xff9933, roughness: 0.4, metalness: 0.15, transparent: true, opacity: 0.85 });
        const bottleBody = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.015, 0.07, 8), bottleMat);
        bottleBody.position.set(-0.08, 0.89, 0.06);
        bottleBody.castShadow = true;
        chart.add(bottleBody);
        const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.012, 8), capMat);
        cap.position.set(-0.08, 0.935, 0.06);
        chart.add(cap);

        // Compresses
        const compressMat = new THREE.MeshStandardMaterial({ color: 0xf0f0e8, roughness: 0.9 });
        const compress = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.05), compressMat);
        compress.position.set(-0.02, 0.86, -0.05);
        compress.rotation.y = 0.2;
        chart.add(compress);

        // --- Fournitures supplémentaires (chariot "plus fourni") ---
        // Boîte de seringues
        const syringeBox = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, 0.03, 0.05),
            new THREE.MeshStandardMaterial({ color: 0xe8f0f8, roughness: 0.5 })
        );
        syringeBox.position.set(0.02, 0.865, 0.1);
        syringeBox.rotation.y = 0.1;
        syringeBox.castShadow = true;
        chart.add(syringeBox);

        // Flacon pompe de gel hydroalcoolique
        const gelMat = new THREE.MeshPhysicalMaterial({
            color: 0x7cc4e8,
            transparent: true,
            opacity: 0.7,
            roughness: 0.15,
            clearcoat: 0.6,
            clearcoatRoughness: 0.2
        });
        const gelBottle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.06, 8), gelMat);
        gelBottle.position.set(-0.13, 0.885, -0.03);
        gelBottle.castShadow = true;
        chart.add(gelBottle);
        const gelPump = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.02, 6), capMat);
        gelPump.position.set(-0.13, 0.925, -0.03);
        chart.add(gelPump);

        // Boîte de pansements
        const bandageBox = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.025, 0.06),
            new THREE.MeshStandardMaterial({ color: 0xf3e2c7, roughness: 0.7 })
        );
        bandageBox.position.set(0.11, 0.862, -0.06);
        bandageBox.rotation.y = -0.18;
        bandageBox.castShadow = true;
        chart.add(bandageBox);

        // Ampoules alignées sur le plateau inférieur
        const ampouleMat = new THREE.MeshPhysicalMaterial({
            color: 0xdfe9f2,
            transparent: true,
            opacity: 0.55,
            roughness: 0.05,
            clearcoat: 0.8
        });
        for (let a = 0; a < 3; a++) {
            const amp = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 6), ampouleMat);
            amp.rotation.z = Math.PI / 2;
            amp.position.set(-0.09 + a * 0.035, 0.37, -0.07);
            chart.add(amp);
        }

        // Masque O2
        const maskMat = new THREE.MeshStandardMaterial({ color: 0x44ccff, transparent: true, opacity: 0.6, roughness: 0.2 });
        const mask = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.05, 8), maskMat);
        mask.position.set(0.05, 0.38, 0);
        mask.rotation.x = Math.PI / 2;
        mask.castShadow = true;
        mask.name = 'MasqueO2';
        mask.userData = { label: 'Masque à Oxygène', interactive: true };
        chart.add(mask);

        this.scene.add(chart);

        chart.traverse((child) => {
            if (child.isMesh) {
                child.userData.interactive = true;
                if (child.name !== 'MasqueO2') {
                    child.userData.label = 'Charriot médical';
                }
            }
        });
    }
    // ===== PARTICULES DE POUSSIÈRE (Adapted to 11x5x10 room bounds) =====
    _addDustParticles() {
        const dustCount = 200;
        const dustGeom = new THREE.BufferGeometry();
        const dustPositions = new Float32Array(dustCount * 3);

        for (let i = 0; i < dustCount; i++) {
            if (i < 100) {
                // Window beam particles
                const t = Math.random();
                const rx = 5.48 - 6.0 * t; // Plunge inward from right wall x=5.5
                const ry = 2.5 - 2.0 * t;
                const rz = 0.5 + (Math.random() - 0.5) * 5.0;

                dustPositions[i * 3] = rx + (Math.random() - 0.5) * 0.6;
                dustPositions[i * 3 + 1] = ry + (Math.random() - 0.5) * 0.6;
                dustPositions[i * 3 + 2] = rz + (Math.random() - 0.5) * 0.6;
            } else {
                // General room distribution
                dustPositions[i * 3] = (Math.random() - 0.5) * 11;
                dustPositions[i * 3 + 1] = Math.random() * 4.5 + 0.3;
                dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 10;
            }
        }

        dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));

        const dustMat = new THREE.PointsMaterial({
            color: 0xffedd5,
            size: 0.022,
            transparent: true,
            opacity: 0.25,
            sizeAttenuation: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const dustParticles = new THREE.Points(dustGeom, dustMat);
        dustParticles.name = 'DustParticles';
        this.scene.add(dustParticles);
        this.dustParticles = dustParticles;
    }

    // ===== STATION C: GLASS MEDICINE CABINET ('Armoire') =====
    _addMedicineCabinet() {
        const cabinetGroup = new THREE.Group();
        cabinetGroup.position.set(3.8, 0, -3.8); // Right rear corner
        cabinetGroup.name = 'Armoire';
        cabinetGroup.userData.label = 'Armoire';
        cabinetGroup.userData.interactive = true;

        const woodCasing = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 2.9, 0.62),
            new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.4 })
        );
        woodCasing.position.set(0, 1.45, 0);
        woodCasing.castShadow = true;
        woodCasing.receiveShadow = true;
        woodCasing.name = 'Armoire';
        woodCasing.userData.label = 'Armoire';
        woodCasing.userData.interactive = true;
        cabinetGroup.add(woodCasing);

        const innerBack = new THREE.Mesh(
            new THREE.PlaneGeometry(1.48, 2.78),
            new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.9 })
        );
        innerBack.position.set(0, 1.45, 0.28);
        innerBack.rotation.y = Math.PI;
        cabinetGroup.add(innerBack);

        const glassDoorL = new THREE.Mesh(
            new THREE.BoxGeometry(0.72, 2.72, 0.02),
            new THREE.MeshStandardMaterial({
                color: '#e0f2fe',
                transparent: true,
                opacity: 0.35,
                roughness: 0.1,
                metalness: 0.9,
            })
        );
        glassDoorL.position.set(-0.37, 1.45, 0.3);
        cabinetGroup.add(glassDoorL);

        const glassDoorR = new THREE.Mesh(
            new THREE.BoxGeometry(0.72, 2.72, 0.02),
            new THREE.MeshStandardMaterial({
                color: '#e0f2fe',
                transparent: true,
                opacity: 0.35,
                roughness: 0.1,
                metalness: 0.9,
            })
        );
        glassDoorR.position.set(0.37, 1.45, 0.3);
        cabinetGroup.add(glassDoorR);

        const shelfGeo = new THREE.BoxGeometry(1.48, 0.03, 0.52);
        const shelfMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', transparent: true, opacity: 0.7 });

        const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#ec4899', '#f8fafc'];

        for (let h = 0.55; h < 2.5; h += 0.55) {
            const shelf = new THREE.Mesh(shelfGeo, shelfMat);
            shelf.position.set(0, h, 0);
            cabinetGroup.add(shelf);

            for (let s = -0.6; s <= 0.61; s += 0.25) {
                if (Math.random() > 0.15) {
                    const spawnGeo = Math.random() > 0.4 ?
                        new THREE.CylinderGeometry(0.04, 0.04, 0.12, 10) :
                        new THREE.BoxGeometry(0.09, 0.1, 0.09);

                    const bottleColor = colors[Math.floor(Math.random() * colors.length)];
                    const itemMat = new THREE.MeshStandardMaterial({
                        color: bottleColor,
                        roughness: 0.2,
                        metalness: Math.random() > 0.6 ? 0.8 : 0.1,
                    });

                    const medicineItem = new THREE.Mesh(spawnGeo, itemMat);
                    medicineItem.position.set(s, h + 0.075, 0.04 + (Math.random() * 0.1 - 0.05));
                    medicineItem.rotation.y = Math.random() * Math.PI;
                    medicineItem.castShadow = true;
                    cabinetGroup.add(medicineItem);
                }
            }
        }

        const cabLight = new THREE.PointLight('#93c5fd', 1.5, 3.5);
        cabLight.position.set(0, 2.7, 0.1);
        cabinetGroup.add(cabLight);

        this.scene.add(cabinetGroup);

        cabinetGroup.traverse((child) => {
            if (child.isMesh) {
                child.userData.interactive = true;
                child.userData.label = 'Armoire';
            }
        });
    }

    // ===== CORNER DECORATION: Potted Plant =====
    _addPottedPlant() {
        const plantGroup = new THREE.Group();
        plantGroup.position.set(-3.8, 0, -4.0); // Corner left back
        plantGroup.name = 'PottedPlant';

        const plantPot = new THREE.Mesh(
            new THREE.CylinderGeometry(0.24, 0.18, 0.52, 16),
            new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.7 })
        );
        plantPot.position.set(0, 0.26, 0);
        plantPot.castShadow = true;
        plantGroup.add(plantPot);

        const soil = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.22, 0.04, 12),
            new THREE.MeshStandardMaterial({ color: '#3d2b1f', roughness: 0.9 })
        );
        soil.position.set(0, 0.51, 0);
        plantGroup.add(soil);

        const leafGeo = new THREE.BoxGeometry(0.08, 0.62, 0.22);
        const leafMat = new THREE.MeshStandardMaterial({
            color: '#15803d',
            roughness: 0.6,
        });
        for (let l = 0; l < 9; l++) {
            const leaf = new THREE.Mesh(leafGeo, leafMat);
            leaf.position.set(0, 0.68, 0);
            leaf.rotation.x = Math.sin(l * 1.5) * 0.4 - 0.2;
            leaf.rotation.y = l * (Math.PI / 4.5);
            leaf.rotation.z = Math.cos(l * 1.5) * 0.4 + 0.3;
            leaf.castShadow = true;
            plantGroup.add(leaf);
        }
        this.scene.add(plantGroup);
    }

    // ===== STATION B DETAILS: Examination Bed structure =====
    _addExaminationBedDetails() {
        const bedGroup = new THREE.Group();
        bedGroup.position.set(6.0, 0, 0.2); // Right side, shifted due to rotation
        bedGroup.rotation.y = Math.PI; // Pivoter de 180 degrés
        bedGroup.name = 'ExaminationBedDetails';

        // Base steel structure
        const bedFrame = new THREE.Mesh(
            new THREE.BoxGeometry(1.0, 0.82, 2.3),
            new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.7, roughness: 0.3 })
        );
        bedFrame.position.set(1.3, 0.41, 0);
        bedFrame.castShadow = true;
        bedFrame.receiveShadow = true;
        bedGroup.add(bedFrame);

        // cushions (Mint green/Teal)
        const cushionMaterial = new THREE.MeshPhysicalMaterial({
            color: '#0d9488',
            roughness: 0.55,
            metalness: 0.05,
            sheen: 0.4,                    // similicuir médical : reflet rasant doux
            sheenColor: new THREE.Color('#99f6e4'),
            sheenRoughness: 0.6,
            clearcoat: 0.15,
            clearcoatRoughness: 0.4
        });

        const mainCushion = new THREE.Mesh(
            new THREE.BoxGeometry(0.96, 0.16, 1.62),
            cushionMaterial
        );
        mainCushion.position.set(1.3, 0.9, -0.3);
        mainCushion.castShadow = true;
        mainCushion.receiveShadow = true;
        bedGroup.add(mainCushion);

        const headCushion = new THREE.Mesh(
            new THREE.BoxGeometry(0.96, 0.16, 0.64),
            cushionMaterial
        );
        headCushion.position.set(1.3, 1.05, 0.78);
        headCushion.rotation.x = -0.28;
        headCushion.castShadow = true;
        bedGroup.add(headCushion);

        const pillow = new THREE.Mesh(
            new THREE.BoxGeometry(0.72, 0.08, 0.26),
            new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 })
        );
        pillow.position.set(1.3, 1.18, 0.92);
        pillow.rotation.x = -0.28;
        pillow.castShadow = true;
        bedGroup.add(pillow);

        // Paper roll
        const paperRoll = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 0.78, 16),
            new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.9 })
        );
        paperRoll.position.set(1.3, 0.62, 0.9);
        paperRoll.rotation.z = Math.PI / 2;
        paperRoll.castShadow = true;
        bedGroup.add(paperRoll);

        // Drap d'examen : très légère émissivité pour capter le spot et éviter les zones mortes
        const paperSheet = new THREE.Mesh(
            new THREE.BoxGeometry(0.78, 0.005, 1.5),
            new THREE.MeshStandardMaterial({
                color: '#ffffff',
                transparent: true,
                opacity: 0.86,
                roughness: 1.0,
                emissive: 0xffffff,
                emissiveIntensity: 0.04
            })
        );
        paperSheet.position.set(1.3, 0.985, -0.15);
        bedGroup.add(paperSheet);

        // Clinical Spotlight
        const medicalLamp = new THREE.Group();
        medicalLamp.position.set(0.6, 0, -1.0);

        const lampStandBase = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.18, 0.03, 16),
            new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.5 })
        );
        lampStandBase.castShadow = true;
        medicalLamp.add(lampStandBase);

        const verticalPole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.016, 0.016, 1.95, 8),
            new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.8, roughness: 0.1 })
        );
        verticalPole.position.set(0, 0.955, 0);
        verticalPole.castShadow = true;
        medicalLamp.add(verticalPole);

        const curvedNeck = new THREE.Mesh(
            new THREE.TorusGeometry(0.24, 0.016, 8, 16, Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.8 })
        );
        curvedNeck.position.set(0.24, 1.9, 0);
        curvedNeck.rotation.z = -Math.PI / 2;
        medicalLamp.add(curvedNeck);

        const lampDome = new THREE.Mesh(
            new THREE.SphereGeometry(0.14, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.9, roughness: 0.05 })
        );
        lampDome.position.set(0.44, 1.76, 0);
        lampDome.rotation.z = Math.PI / 5;
        lampDome.castShadow = true;
        medicalLamp.add(lampDome);

        // Spot d'examen puissant et focalisé sur le patient (angle resserré, intensité doublée+)
        const spotlight = new THREE.SpotLight('#f0f9ff', 6.5, 6.0, Math.PI / 6, 0.45, 0.5);
        spotlight.position.set(0.44, 1.76, 0);
        spotlight.target = mainCushion;
        medicalLamp.add(spotlight);

        // Ampoule : toneMapped:false => halo lumineux via le bloom pass
        const spotGlow = new THREE.Mesh(
            new THREE.SphereGeometry(0.055, 8, 8),
            new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })
        );
        spotGlow.position.set(0.44, 1.72, 0);
        medicalLamp.add(spotGlow);

        bedGroup.add(medicalLamp);
        this.scene.add(bedGroup);
    }

    // ===== DALLES LED DE PLAFOND (éclairage hospitalier) =====
    // Alignées sur les point lights existants (x = ±2.5, z = 0)
    _addCeilingLightPanels() {
        const frameMat = new THREE.MeshStandardMaterial({ color: 0xd7dde3, metalness: 0.6, roughness: 0.35 });
        const diffuserMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xf2f6ff,
            emissiveIntensity: 1.35, // Diffuseur lumineux => halo doux via bloom
            roughness: 0.55,
            metalness: 0.0
        });

        [[-2.5, 0], [2.5, 0]].forEach(([px, pz]) => {
            const panel = new THREE.Group();
            panel.position.set(px, 4.96, pz);
            panel.name = 'CeilingLightPanel'; // décoratif, non interactif

            const frame = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.05, 0.64), frameMat);
            frame.receiveShadow = true;
            panel.add(frame);

            const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.02, 0.56), diffuserMat);
            diffuser.position.y = -0.02;
            panel.add(diffuser);

            this.scene.add(panel);
        });
    }

    // ===== SOUS-BASSEMENT MURAL (wainscot bleu clinique + baguette) =====
    _addWallWainscot() {
        // Bleu "lavable" typique des hôpitaux, finition satinée
        const wainscotMat = new THREE.MeshPhysicalMaterial({
            color: '#a9cbdb',
            roughness: 0.38,
            clearcoat: 0.35,
            clearcoatRoughness: 0.3,
            envMapIntensity: 0.5
        });
        const railMat = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.5 });
        const h = 0.9;

        // Mur du fond (face interne z = -4.95) — 2 segments pour dégager la porte (x ∈ [-0.9, 0.9])
        const segW = 4.6;
        const backL = new THREE.Mesh(new THREE.BoxGeometry(segW, h, 0.02), wainscotMat);
        backL.position.set(-3.2, h / 2, -4.94);
        backL.receiveShadow = true;
        backL.name = 'SousBassement';
        this.scene.add(backL);
        const backR = backL.clone();
        backR.position.x = 3.2;
        this.scene.add(backR);

        // Mur droit (face interne x = 5.45)
        const right = new THREE.Mesh(new THREE.BoxGeometry(0.02, h, 10), wainscotMat);
        right.position.set(5.44, h / 2, 0);
        right.receiveShadow = true;
        right.name = 'SousBassement';
        this.scene.add(right);

        // Baguettes de finition blanches en partie haute du sous-bassement
        const railBackL = new THREE.Mesh(new THREE.BoxGeometry(segW, 0.04, 0.03), railMat);
        railBackL.position.set(-3.2, h + 0.02, -4.935);
        this.scene.add(railBackL);
        const railBackR = railBackL.clone();
        railBackR.position.x = 3.2;
        this.scene.add(railBackR);

        const railRight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 10), railMat);
        railRight.position.set(5.435, h + 0.02, 0);
        this.scene.add(railRight);
    }

    // ===== MONITEUR MULTIPARAMÉTRIQUE (FC / SpO2 / TA — écho aux constantes de l'UI) =====
    _addVitalSignsMonitor() {
        const vsCanvas = document.createElement('canvas');
        vsCanvas.width = 256;
        vsCanvas.height = 160;
        const vc = vsCanvas.getContext('2d');

        // Fond clinique sombre
        vc.fillStyle = '#081120';
        vc.fillRect(0, 0, 256, 160);
        // Barre de titre
        vc.fillStyle = '#12263f';
        vc.fillRect(0, 0, 256, 22);
        vc.fillStyle = '#7dd3fc';
        vc.font = 'bold 11px sans-serif';
        vc.textAlign = 'left';
        vc.fillText('◉ PATIENT MONITOR — BOX 3', 8, 15);

        // Ligne FC / SpO2
        vc.fillStyle = '#64748b';
        vc.font = '10px sans-serif';
        vc.fillText('FC', 10, 48);
        vc.fillText('SpO₂', 130, 48);
        vc.fillStyle = '#22c55e';
        vc.font = 'bold 30px monospace';
        vc.fillText('72', 34, 52);
        vc.font = '9px sans-serif';
        vc.fillText('bpm', 80, 52);
        vc.fillStyle = '#38bdf8';
        vc.font = 'bold 30px monospace';
        vc.fillText('98', 166, 52);
        vc.font = '9px sans-serif';
        vc.fillText('%', 212, 52);

        // Ligne TA
        vc.fillStyle = '#64748b';
        vc.font = '10px sans-serif';
        vc.fillText('TA', 10, 86);
        vc.fillStyle = '#f59e0b';
        vc.font = 'bold 22px monospace';
        vc.fillText('128/80', 34, 88);
        vc.font = '8px sans-serif';
        vc.fillText('mmHg', 112, 88);

        // Séparateur
        vc.strokeStyle = 'rgba(125, 211, 252, 0.25)';
        vc.lineWidth = 1;
        vc.beginPath();
        vc.moveTo(8, 100);
        vc.lineTo(248, 100);
        vc.stroke();

        // Mini tracé ECG décoratif
        vc.strokeStyle = '#22c55e';
        vc.lineWidth = 1.5;
        vc.beginPath();
        const base = 132;
        for (let x = 8; x <= 248; x += 4) {
            const p = ((x - 8) % 40) / 40;
            let y = 0;
            if (p < 0.1) y = -2 * Math.sin((p / 0.1) * Math.PI);          // onde P
            else if (p >= 0.15 && p < 0.2) y = 3;                          // Q
            else if (p >= 0.2 && p < 0.25) y = -14;                        // R (pic)
            else if (p >= 0.25 && p < 0.3) y = 4;                          // S
            else if (p >= 0.4 && p < 0.55) y = -3 * Math.sin(((p - 0.4) / 0.15) * Math.PI); // onde T
            if (x === 8) vc.moveTo(x, base + y); else vc.lineTo(x, base + y);
        }
        vc.stroke();

        const vsTexture = new THREE.CanvasTexture(vsCanvas);
        vsTexture.colorSpace = THREE.SRGBColorSpace;
        vsTexture.minFilter = THREE.LinearFilter;

        const group = new THREE.Group();
        group.position.set(5.42, 2.05, -0.9); // Mur droit, côté tête du lit
        group.rotation.y = -Math.PI / 2;      // Écran tourné vers la salle (-x)
        group.name = 'VitalSignsMonitor';     // décoratif, non interactif

        const shell = new THREE.Mesh(
            new THREE.BoxGeometry(0.46, 0.32, 0.05),
            new THREE.MeshStandardMaterial({ color: 0x151a20, roughness: 0.35, metalness: 0.4 })
        );
        group.add(shell);

        const screen = new THREE.Mesh(
            new THREE.BoxGeometry(0.42, 0.27, 0.005),
            new THREE.MeshStandardMaterial({
                map: vsTexture,
                emissive: 0xffffff,
                emissiveMap: vsTexture,
                emissiveIntensity: 0.85, // Écran lumineux => fait écho aux constantes de l'UI
                roughness: 0.08
            })
        );
        screen.position.z = 0.028;
        group.add(screen);

        // Bras de fixation murale
        const armMat = new THREE.MeshStandardMaterial({ color: 0x9aa5b1, metalness: 0.8, roughness: 0.25 });
        const wallArm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.1), armMat);
        wallArm.position.set(0, -0.22, -0.04);
        group.add(wallArm);

        this.scene.add(group);
    }

    // ===== POUBELLES : DASRI (jaune) + corbeille classique =====
    _addWasteBins() {
        // --- Poubelle DASRI jaune (déchets de soins) près du chariot ---
        const dasri = new THREE.Group();
        dasri.position.set(3.15, 0, -1.85);
        dasri.name = 'DASRIBin'; // décoratif, non interactif

        const dasriBodyMat = new THREE.MeshPhysicalMaterial({
            color: '#f5c518',
            roughness: 0.4,
            clearcoat: 0.45,
            clearcoatRoughness: 0.3
        });
        const dasriBody = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.135, 0.42, 18), dasriBodyMat);
        dasriBody.position.y = 0.21;
        dasriBody.castShadow = true;
        dasriBody.receiveShadow = true;
        dasri.add(dasriBody);

        const dasriLid = new THREE.Mesh(
            new THREE.CylinderGeometry(0.165, 0.165, 0.05, 18),
            new THREE.MeshPhysicalMaterial({ color: '#d4a017', roughness: 0.45, clearcoat: 0.4 })
        );
        dasriLid.position.y = 0.445;
        dasriLid.castShadow = true;
        dasri.add(dasriLid);

        // Pédale
        const pedal = new THREE.Mesh(
            new THREE.BoxGeometry(0.07, 0.02, 0.05),
            new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 })
        );
        pedal.position.set(0, 0.02, 0.17);
        dasri.add(pedal);

        // Étiquette DASRI
        const dasriCanvas = document.createElement('canvas');
        dasriCanvas.width = 128;
        dasriCanvas.height = 96;
        const dCtx = dasriCanvas.getContext('2d');
        dCtx.fillStyle = '#fefce8';
        dCtx.fillRect(0, 0, 128, 96);
        dCtx.strokeStyle = '#eab308';
        dCtx.lineWidth = 6;
        dCtx.strokeRect(3, 3, 122, 90);
        dCtx.fillStyle = '#111827';
        dCtx.font = 'bold 26px sans-serif';
        dCtx.textAlign = 'center';
        dCtx.fillText('DASRI', 64, 44);
        dCtx.font = '9px sans-serif';
        dCtx.fillText('DÉCHETS DE SOINS', 64, 66);
        const dasriLabelTex = new THREE.CanvasTexture(dasriCanvas);
        dasriLabelTex.colorSpace = THREE.SRGBColorSpace;
        const dasriLabel = new THREE.Mesh(
            new THREE.PlaneGeometry(0.13, 0.1),
            new THREE.MeshStandardMaterial({ map: dasriLabelTex, roughness: 0.6 })
        );
        dasriLabel.position.set(0, 0.26, 0.152);
        dasri.add(dasriLabel);

        this.scene.add(dasri);

        // --- Corbeille classique grise près du bureau ---
        const bin = new THREE.Group();
        bin.position.set(-4.55, 0, 0.55);
        bin.name = 'WasteBin'; // décoratif, non interactif

        const binBody = new THREE.Mesh(
            new THREE.CylinderGeometry(0.14, 0.11, 0.34, 16),
            new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.4, roughness: 0.5 })
        );
        binBody.position.y = 0.17;
        binBody.castShadow = true;
        binBody.receiveShadow = true;
        bin.add(binBody);

        // Sac blanc débordant légèrement
        const bag = new THREE.Mesh(
            new THREE.CylinderGeometry(0.125, 0.13, 0.04, 16),
            new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.85 })
        );
        bag.position.y = 0.35;
        bin.add(bag);

        this.scene.add(bin);
    }

    // ===== ACCESSOIRES D'HYGIÈNE PRÈS DU LAVABO (mur gauche, x = -5.45) =====
    _addSinkAccessories() {
        const accessories = new THREE.Group();
        accessories.name = 'SinkAccessories'; // décoratif, non interactif

        const whitePlastic = new THREE.MeshPhysicalMaterial({
            color: 0xf8fafc,
            roughness: 0.3,
            clearcoat: 0.5,
            clearcoatRoughness: 0.25
        });
        const chrome = new THREE.MeshStandardMaterial({ color: 0xd4d9df, metalness: 1.0, roughness: 0.22 });

        // --- Distributeur de savon mural ---
        const soap = new THREE.Group();
        soap.position.set(-5.42, 1.5, 2.95);
        soap.rotation.y = Math.PI / 2; // Face tournée vers la salle (+x)
        const soapBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.06), whitePlastic);
        soapBody.castShadow = true;
        soap.add(soapBody);
        const soapWindow = new THREE.Mesh(
            new THREE.BoxGeometry(0.03, 0.08, 0.005),
            new THREE.MeshPhysicalMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.6, roughness: 0.1, clearcoat: 0.8 })
        );
        soapWindow.position.set(0, -0.01, 0.031);
        soap.add(soapWindow);
        const soapNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 8), chrome);
        soapNozzle.position.set(0, -0.09, 0.02);
        soapNozzle.rotation.x = Math.PI / 3;
        soap.add(soapNozzle);
        accessories.add(soap);

        // --- Distributeur d'essuie-mains mural ---
        const towel = new THREE.Group();
        towel.position.set(-5.42, 1.52, 1.9);
        towel.rotation.y = Math.PI / 2;
        const towelBody = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.11), whitePlastic);
        towelBody.castShadow = true;
        towel.add(towelBody);
        // Fente de distribution + feuilles visibles
        const slot = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.015, 0.02),
            new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 })
        );
        slot.position.set(0, -0.15, 0.04);
        towel.add(slot);
        const paper = new THREE.Mesh(
            new THREE.BoxGeometry(0.16, 0.05, 0.015),
            new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 })
        );
        paper.position.set(0, -0.18, 0.04);
        towel.add(paper);
        accessories.add(towel);

        // --- Étagère murale au-dessus du lavabo + consommables ---
        const shelf = new THREE.Group();
        shelf.position.set(-5.4, 2.12, 2.4);
        shelf.rotation.y = Math.PI / 2;
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.16), whitePlastic);
        board.castShadow = true;
        board.receiveShadow = true;
        shelf.add(board);
        // Boîte de gants bleue
        const gloves = new THREE.Mesh(
            new THREE.BoxGeometry(0.11, 0.05, 0.07),
            new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.55 })
        );
        gloves.position.set(-0.15, 0.04, 0);
        gloves.castShadow = true;
        shelf.add(gloves);
        // Flacon ambré
        const amberBottle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, 0.09, 10),
            new THREE.MeshPhysicalMaterial({ color: 0xb45309, transparent: true, opacity: 0.85, roughness: 0.15, clearcoat: 0.6 })
        );
        amberBottle.position.set(0.02, 0.055, 0);
        amberBottle.castShadow = true;
        shelf.add(amberBottle);
        // Boîte blanche
        const whiteBox = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.06, 0.06),
            new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.6 })
        );
        whiteBox.position.set(0.16, 0.042, 0);
        whiteBox.rotation.y = 0.2;
        whiteBox.castShadow = true;
        shelf.add(whiteBox);
        accessories.add(shelf);

        this.scene.add(accessories);
    }

    // ===== HORLOGE MURALE TEMPS RÉEL (mur du fond) =====
    _addWallClock() {
        const clock = new THREE.Group();
        clock.position.set(2.0, 3.15, -4.93);
        clock.name = 'WallClock'; // décoratif, non interactif

        // Cadran (canvas)
        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = 128;
        faceCanvas.height = 128;
        const fc = faceCanvas.getContext('2d');
        fc.fillStyle = '#f8fafc';
        fc.beginPath();
        fc.arc(64, 64, 62, 0, Math.PI * 2);
        fc.fill();
        fc.strokeStyle = '#1e293b';
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const bold = i % 3 === 0;
            fc.lineWidth = bold ? 4 : 2;
            fc.beginPath();
            fc.moveTo(64 + Math.sin(a) * (bold ? 48 : 52), 64 - Math.cos(a) * (bold ? 48 : 52));
            fc.lineTo(64 + Math.sin(a) * 58, 64 - Math.cos(a) * 58);
            fc.stroke();
        }
        fc.fillStyle = '#1e293b';
        fc.font = 'bold 14px sans-serif';
        fc.textAlign = 'center';
        fc.textBaseline = 'middle';
        fc.fillText('12', 64, 16);
        fc.fillText('3', 112, 64);
        fc.fillText('6', 64, 112);
        fc.fillText('9', 16, 64);

        const faceTex = new THREE.CanvasTexture(faceCanvas);
        faceTex.colorSpace = THREE.SRGBColorSpace;

        // Boîtier + cadran
        const rim = new THREE.Mesh(
            new THREE.TorusGeometry(0.16, 0.018, 8, 32),
            new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 })
        );
        clock.add(rim);
        const back = new THREE.Mesh(
            new THREE.CylinderGeometry(0.16, 0.16, 0.025, 32),
            new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 })
        );
        back.rotation.x = Math.PI / 2;
        back.position.z = -0.012;
        clock.add(back);
        const face = new THREE.Mesh(
            new THREE.CircleGeometry(0.15, 32),
            new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.4 })
        );
        face.position.z = 0.002;
        clock.add(face);

        // Aiguilles (pivot à la base => rotation.z animée dans updateEnvironment)
        const handMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4 });
        const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.003), handMat);
        hourHand.geometry.translate(0, 0.03, 0);
        hourHand.position.z = 0.008;
        clock.add(hourHand);

        const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.095, 0.003), handMat);
        minuteHand.geometry.translate(0, 0.0475, 0);
        minuteHand.position.z = 0.011;
        clock.add(minuteHand);

        const secondHand = new THREE.Mesh(
            new THREE.BoxGeometry(0.003, 0.1, 0.002),
            new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 })
        );
        secondHand.geometry.translate(0, 0.05, 0);
        secondHand.position.z = 0.014;
        clock.add(secondHand);

        // Cache central
        const cap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.008, 0.008, 0.004, 10),
            new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 })
        );
        cap.rotation.x = Math.PI / 2;
        cap.position.z = 0.015;
        clock.add(cap);

        this._clockHands = { hour: hourHand, minute: minuteHand, second: secondHand };
        this.scene.add(clock);
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
     * Retourne le mesh de l'écran ECG mural pour l'animateur
     */
    getWallECGScreenMesh() {
        return this.wallEcgScreenMesh;
    }

    /**
     * Met à jour les animations d'environnement (LED ECG, etc.)
     * Appeler dans la boucle de rendu avec le temps elapsed.
     */
    updateEnvironment(elapsed) {
        if (this._ecgStatusLedMat) {
            const t = (elapsed * 1.2) % 1;
            const beat = t < 0.1 ? Math.sin(t / 0.1 * Math.PI) : 0.15;
            this._ecgStatusLedMat.emissiveIntensity = 0.3 + beat * 0.7;
        }
        if (this._wallEcgLedMat) {
            const t = (elapsed * 1.2) % 1;
            const beat2 = t < 0.1 ? Math.sin(t / 0.1 * Math.PI) : 0.15;
            this._wallEcgLedMat.emissiveIntensity = 0.3 + beat2 * 0.7;
        }
        // Horloge murale : aiguilles synchronisées sur l'heure réelle du système
        if (this._clockHands) {
            const now = new Date();
            const s = now.getSeconds() + now.getMilliseconds() / 1000;
            const m = now.getMinutes() + s / 60;
            const h = (now.getHours() % 12) + m / 60;
            this._clockHands.second.rotation.z = -(s / 60) * Math.PI * 2;
            this._clockHands.minute.rotation.z = -(m / 60) * Math.PI * 2;
            this._clockHands.hour.rotation.z = -(h / 12) * Math.PI * 2;
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