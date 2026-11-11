/**
 * js/clinicalAgentAI.js — Effets 3D des actions cliniques.
 *
 * Joue en 3D ce que le Maître du Jeu a décidé (bloc `scene` de sa réponse) :
 * objets procéduraux (perfusion, masque, défibrillateur…), rythme
 * respiratoire du patient, sons de retour. Aucun appel LLM ici.
 */

class ClinicalAgentAI {
    constructor() {
        this.isActive = true;
        this.injectStyles();
        this.initHooks();
        console.info('[ClinicalAgentAI] Initialisé avec succès !');
    }

    /**
     * Injecte des styles CSS premium pour les cartes d'intervention et le loading
     */
    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Bulles d'actions cliniques du Directeur Clinique (Game Master) */
            .dialog-msg-bubble.clinical-action-card {
                background: linear-gradient(135deg, rgba(20, 35, 75, 0.75), rgba(10, 18, 40, 0.85)) !important;
                border: 1px solid rgba(0, 242, 254, 0.4) !important;
                box-shadow: 0 4px 15px rgba(0, 242, 254, 0.15), 0 0 10px rgba(0, 242, 254, 0.05) !important;
                border-radius: 12px !important;
                padding: 10px 14px !important;
                color: #e0f7fc !important;
                backdrop-filter: blur(8px);
                position: relative;
            }
            .dialog-msg-bubble.clinical-action-card strong {
                color: #00f2fe !important;
                font-family: 'Outfit', sans-serif;
            }
            /* Animation pulse pour le loading */
            .clinical-action-loading .dialog-msg-bubble {
                animation: actionCardPulse 1.5s infinite ease-in-out;
            }
            @keyframes actionCardPulse {
                0% { opacity: 0.7; transform: scale(0.99); }
                50% { opacity: 1.0; transform: scale(1.0); }
                100% { opacity: 0.7; transform: scale(0.99); }
            }
            /* Carte action pour le dialogue 2D */
            .dialogue-message.clinical-action-card-2d {
                background: rgba(0, 242, 254, 0.08) !important;
                border-left: 4px solid #00f2fe !important;
                border-radius: 6px;
                padding: 8px 12px;
                margin: 6px 0;
                color: #e0f7fc;
                font-size: 0.88rem;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Les conséquences VISIBLES d'un tour du Maître du Jeu, en 3D.
     *
     * Ce module avait son propre routeur LLM (« Directeur Clinique ») qui
     * réanalysait chaque message en 3D : deux appels pour une réplique, et
     * deux écritures concurrentes des constantes. Le Maître du Jeu
     * (js/MedicalGameManager.js) est désormais le seul ; sa réponse porte un
     * bloc `scene` (objet à faire apparaître, rythme respiratoire, son) que
     * l'on joue ici, sans aucun appel réseau.
     */
    initHooks() {
        document.addEventListener('medgame:turn-applied', (e) => this.applySceneEffects(e.detail?.parsed));
    }

    applySceneEffects(parsed) {
        const scene = parsed?.scene;
        if (!scene || !this.isActive) return;
        if (scene.spawnAsset) this.spawn3DAsset(scene.spawnAsset);
        const animator = window.threeManager?.scene?.patientAnimator;
        if (scene.respiratoryPattern && animator?.setRespirationPattern) {
            animator.setRespirationPattern(scene.respiratoryPattern);
        }
        const audio = window.medicalAudio;
        if (scene.sound && audio) {
            if (scene.sound === 'correct') audio.playSuccessSound?.();
            else if (scene.sound === 'incorrect') audio.playErrorSound?.();
            else if (scene.sound === 'alarm') audio.startAlarm?.('critical');
        }
    }

    /**
     * Génère et injecte un modèle 3D modélisé procéduralement dans la scène 3D
     */
    spawn3DAsset(assetType) {
        if (!window.threeManager?.scene?.scene) return;
        
        const scene = window.threeManager.scene.scene;
        const patientGroup = window.threeManager.scene.patient?.group;
        
        // Namespace three.js. `clinicalAgentAI.js` est un script CLASSIQUE :
        // il ne peut pas faire `import * as THREE from 'three'`.
        // L'ancien code faisait `window.THREE || scene.__proto__.constructor` :
        // `window.THREE` n'existe nulle part dans ce dépôt (le global THREE est
        // interdit par convention), et le repli résolvait la classe `Scene` —
        // donc `new THREE.Group()` levait un TypeError.
        // Le Proxy est fourni par three-manager.js, qui n'a chargé three.js
        // que si la scène existe (condition vérifiée ci-dessus).
        const THREE = window.threeManager?.THREE;
        if (!THREE) return;

        // Éviter de spawner deux fois le même objet
        const existing = scene.getObjectByName(`spawned_${assetType}`) || patientGroup?.getObjectByName(`spawned_${assetType}`);
        if (existing) return;

        console.info(`[ClinicalAgentAI] Spawner d'Asset 3D : Génération de "${assetType}"...`);

        // --- A. DÉFIBRILLATEUR ---
        if (assetType === 'defibrillateur') {
            const defibrillateur = new THREE.Group();
            defibrillateur.name = 'spawned_defibrillateur';
            defibrillateur.position.set(-2.0, 0.855, -0.85); // Posé sur le chariot

            // Coque principale rouge
            const shellGeom = new THREE.BoxGeometry(0.2, 0.22, 0.16);
            const shellMat = new THREE.MeshStandardMaterial({ color: 0xff3333, metalness: 0.3, roughness: 0.4 });
            const shell = new THREE.Mesh(shellGeom, shellMat);
            shell.castShadow = true;
            defibrillateur.add(shell);

            // Écran émissif vert brillant
            const screenGeom = new THREE.PlaneGeometry(0.14, 0.1);
            const screenMat = new THREE.MeshStandardMaterial({
                color: 0x00ff66,
                emissive: 0x00ff66,
                emissiveIntensity: 0.7,
                roughness: 0.1
            });
            const screen = new THREE.Mesh(screenGeom, screenMat);
            screen.position.set(0, 0.03, 0.081);
            defibrillateur.add(screen);

            // Palettes de choc noires
            const paddleGeom = new THREE.BoxGeometry(0.03, 0.05, 0.03);
            const paddleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
            const paddleL = new THREE.Mesh(paddleGeom, paddleMat);
            paddleL.position.set(-0.05, -0.05, 0.082);
            const paddleR = paddleL.clone();
            paddleR.position.x = 0.05;
            defibrillateur.add(paddleL, paddleR);

            scene.add(defibrillateur);

            // Animation d'entrée fluide avec GSAP
            if (window.gsap) {
                defibrillateur.scale.set(0, 0, 0);
                window.gsap.to(defibrillateur.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'back.out(1.7)' });
            }
            if (window.showNotification) window.showNotification('🔌 Défibrillateur posé sur le chariot.', 'info');
        }
        // --- B. ÉLECTRODES ECG ---
        else if (assetType === 'electrodes' && patientGroup) {
            const electrodesGroup = new THREE.Group();
            electrodesGroup.name = 'spawned_electrodes';

            // Trois points de monitoring (Rouge, Jaune, Vert)
            const positions = [
                new THREE.Vector3(0.06, 0.12, 0.1),
                new THREE.Vector3(-0.06, 0.12, 0.1),
                new THREE.Vector3(0.0, 0.08, 0.15)
            ];
            const colors = [0xff3333, 0xfff000, 0x00ff33];

            positions.forEach((pos, idx) => {
                const elecGeom = new THREE.CylinderGeometry(0.014, 0.014, 0.004, 8);
                const elecMat = new THREE.MeshStandardMaterial({
                    color: colors[idx],
                    roughness: 0.2,
                    emissive: colors[idx],
                    emissiveIntensity: 0.4
                });
                const elec = new THREE.Mesh(elecGeom, elecMat);
                elec.position.copy(pos);
                elec.rotation.x = Math.PI / 2;
                electrodesGroup.add(elec);
            });

            patientGroup.add(electrodesGroup);
            if (window.showNotification) window.showNotification('🔌 Électrodes ECG appliquées sur le torse.', 'success');
        }
        // --- C. MASQUE À OXYGÈNE ---
        else if (assetType === 'oxygen_mask' && patientGroup) {
            // Cône de masque plastique translucide bleu
            const maskGeom = new THREE.ConeGeometry(0.03, 0.055, 12);
            const maskMat = new THREE.MeshStandardMaterial({
                color: 0x44ccff,
                transparent: true,
                opacity: 0.65,
                roughness: 0.15,
                metalness: 0.1
            });
            const mask = new THREE.Mesh(maskGeom, maskMat);
            mask.name = 'spawned_oxygen_mask';
            // Nez du patient
            mask.position.set(0.0, 0.28, 0.08);
            mask.rotation.x = Math.PI / 3.2;

            // Tuyau vert translucide qui descend
            const tubePoints = [
                new THREE.Vector3(0.0, 0.25, 0.06),
                new THREE.Vector3(-0.15, 0.1, 0.0),
                new THREE.Vector3(-0.8, -0.1, -0.6),
                new THREE.Vector3(-2.0, -0.4, -1.0)
            ];
            const tubeCurve = new THREE.CatmullRomCurve3(tubePoints);
            const tube = new THREE.Mesh(
                new THREE.TubeGeometry(tubeCurve, 16, 0.003, 6, false),
                new THREE.MeshStandardMaterial({ color: 0x88ffcc, transparent: true, opacity: 0.5 })
            );
            mask.add(tube);

            patientGroup.add(mask);

            if (window.gsap) {
                mask.scale.set(0, 0, 0);
                window.gsap.to(mask.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'power2.out' });
            }
            if (window.showNotification) window.showNotification('🫁 Masque à oxygène appliqué.', 'success');
        }
        // --- D. PERFUSION DE TRAITEMENT ---
        else if (assetType === 'perfusion') {
            const ivStand = scene.getObjectByName('IVStand');
            if (ivStand) {
                const bagGroup = new THREE.Group();
                bagGroup.name = 'spawned_perfusion';

                // Seconde poche de soluté teintée de rose
                const bagMat = new THREE.MeshStandardMaterial({
                    color: 0xffbbbb,
                    transparent: true,
                    opacity: 0.8,
                    emissive: 0xff6666,
                    emissiveIntensity: 0.2,
                    roughness: 0.1
                });
                const bag = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.11, 0.024), bagMat);
                bag.position.set(0.08, 1.58, 0.02); // De l'autre côté de la potence
                bagGroup.add(bag);

                // Étiquette de posologie blanche
                const label = new THREE.Mesh(
                    new THREE.BoxGeometry(0.045, 0.03, 0.026),
                    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })
                );
                label.position.set(0.08, 1.53, 0.02);
                bagGroup.add(label);

                ivStand.add(bagGroup);

                if (window.gsap) {
                    bagGroup.scale.set(0, 0, 0);
                    window.gsap.to(bagGroup.scale, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(1.5)' });
                }
                if (window.showNotification) window.showNotification('💧 Perfusion thérapeutique connectée.', 'success');
            }
        }
        // --- E. SERINGUE ---
        else if (assetType === 'seringue') {
            const syringeGroup = new THREE.Group();
            syringeGroup.name = 'spawned_seringue';
            syringeGroup.position.set(-2.1, 0.87, -0.95); // Posée sur le chariot médical

            // Corps plastique de la seringue
            const barrel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.005, 0.005, 0.045, 8),
                new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, roughness: 0.1 })
            );
            barrel.rotation.x = Math.PI / 2;

            // Piston gris en métal
            const plunger = new THREE.Mesh(
                new THREE.CylinderGeometry(0.002, 0.002, 0.025, 6),
                new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7 })
            );
            plunger.position.y = 0.03;
            plunger.rotation.x = Math.PI / 2;

            syringeGroup.add(barrel, plunger);
            scene.add(syringeGroup);

            if (window.gsap) {
                syringeGroup.scale.set(0, 0, 0);
                window.gsap.to(syringeGroup.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(1.2)' });
            }
            if (window.showNotification) window.showNotification('💉 Seringue de traitement préparée.', 'info');
        }
        // --- F. COUVERTURE ISOTHERME ---
        else if (assetType === 'couverture' && patientGroup) {
            // Boîte métallique dorée scintillante
            const blanketGeom = new THREE.BoxGeometry(0.355, 0.012, 0.83);
            const blanketMat = new THREE.MeshStandardMaterial({
                color: 0xffd700,
                metalness: 0.95,
                roughness: 0.05,
                emissive: 0xffa500,
                emissiveIntensity: 0.2
            });
            const blanket = new THREE.Mesh(blanketGeom, blanketMat);
            blanket.name = 'spawned_couverture';
            blanket.position.set(0.0, 0.062, -0.32);

            patientGroup.add(blanket);

            if (window.gsap) {
                blanket.position.y = 0.4;
                blanket.scale.set(0.85, 0.1, 0.85);
                window.gsap.to(blanket.position, { y: 0.062, duration: 1.0, ease: 'bounce.out' });
                window.gsap.to(blanket.scale, { x: 1, y: 1, z: 1, duration: 0.8 });
            }
            if (window.showNotification) window.showNotification('✨ Couverture isotherme dorée posée.', 'success');
        }
    }
}

// Instanciation globale immédiate
window.clinicalAgentAI = new ClinicalAgentAI();
