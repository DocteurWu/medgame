import * as THREE from 'three';
import { box, createMaterial } from './three-room.js';
import { pulseEmissive } from './three-animations.js';
import { gltfLoader as _sharedGLTFLoader } from './three-loaders.js';

const INSTRUMENTS = [
    { id: 'tensiometer', label: 'Tensiometre', x: -3.3, z: -0.4, key: 'tension', title: 'TA' },
    { id: 'stethoscope', label: 'Stethoscope', x: -3.1, z: -0.4, key: 'stethoscope', title: 'Auscultation' },
    { id: 'oximeter', label: 'Oxymetre', x: -2.9, z: -0.4, key: 'saturationO2', title: 'SpO2' },
    { id: 'thermometer', label: 'Thermometre', x: -2.7, z: -0.4, key: 'temperature', title: 'T' },
    { id: 'glucometer', label: 'Glucometre', x: -2.5, z: -0.4, key: 'glycemie', title: 'Glycemie' },
    { id: 'tablet', label: 'Tablette de décision', x: -2.55, z: -0.15, key: 'tablet', title: 'Fin' }
];

/**
 * Crée une texture procédurale de type écran LCD (chiffres / texte)
 * @param {string} text — texte à afficher
 * @param {string} bgColor — couleur fond CSS
 * @param {string} fgColor — couleur texte CSS
 * @param {number} w — largeur canvas
 * @param {number} h — hauteur canvas
 * @param {object} opts — options supplémentaires (fontSize, icon, etc.)
 * @returns {THREE.CanvasTexture}
 */
function createScreenTexture(text, bgColor, fgColor, w = 128, h = 64, opts = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Fond
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    // Lignes de grille (effet LCD)
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 3) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }

    // Texte principal
    const fontSize = opts.fontSize || 28;
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillStyle = fgColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);

    // Icône optionnelle
    if (opts.icon === 'heart') {
        ctx.font = `${fontSize * 0.6}px sans-serif`;
        ctx.fillStyle = 'rgba(255,50,50,0.6)';
        ctx.fillText('♥', 14, h / 2);
    }
    if (opts.icon === 'drop') {
        ctx.font = `${fontSize * 0.5}px sans-serif`;
        ctx.fillStyle = 'rgba(255,100,100,0.6)';
        ctx.fillText('●', 14, h / 2);
    }
    if (opts.icon === 'thermo') {
        ctx.font = `${fontSize * 0.5}px sans-serif`;
        ctx.fillStyle = 'rgba(255,200,50,0.7)';
        ctx.fillText('▲', 14, h / 2);
    }

    // Label petit en haut
    if (opts.label) {
        ctx.font = `bold ${Math.round(fontSize * 0.35)}px sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.textAlign = 'left';
        ctx.fillText(opts.label, 4, 8);
    }

    return new THREE.CanvasTexture(canvas);
}

/**
 * Crée une texture d'écran de tablette avec icônes médicales
 */
function createTabletScreenTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');

    // Fond écran tablette (dégradé moderne médical)
    const bgGrad = ctx.createLinearGradient(0, 0, 256, 192);
    bgGrad.addColorStop(0, '#0a1526');
    bgGrad.addColorStop(1, '#112240');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 256, 192);

    // Barre de statut
    ctx.fillStyle = '#060d18';
    ctx.fillRect(0, 0, 256, 22);
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = '#00f2fe';
    ctx.textAlign = 'left';
    ctx.fillText('MEDGAME CLINIC OS', 10, 15);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#8fa8c8';
    ctx.fillText('14:32  ⚡ 100%', 246, 15);

    // Header carte
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CLÔTURE DU CAS', 128, 48);

    ctx.fillStyle = '#00f2fe';
    ctx.font = '10px sans-serif';
    ctx.fillText('Diagnostic & Annonce Patient', 128, 64);

    // Carte centrale
    ctx.fillStyle = 'rgba(0, 242, 254, 0.07)';
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(16, 75, 224, 60, 8);
    ctx.fill();
    ctx.stroke();

    // Étapes dans la carte
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '10px sans-serif';
    ctx.fillText('1. Formuler votre diagnostic', 30, 96);
    ctx.fillText('2. Annoncer au patient', 30, 114);

    ctx.fillStyle = '#00f2fe';
    ctx.fillText('✓', 215, 96);
    ctx.fillText('✓', 215, 114);

    // Bouton de clôture au bas de l'écran
    const btnGrad = ctx.createLinearGradient(20, 145, 236, 178);
    btnGrad.addColorStop(0, '#00c6ff');
    btnGrad.addColorStop(1, '#0072ff');
    ctx.fillStyle = btnGrad;
    ctx.beginPath();
    ctx.roundRect(20, 145, 216, 34, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('OUVRIR LA TABLETTE (CLIC)', 128, 166);

    // Bordure d'écran globale
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(2, 24, 252, 166);

    return new THREE.CanvasTexture(canvas);
}

export class ThreeInstruments {
    constructor(scene) {
        this.scene = scene;
        this.meshes = new Map();
        this.animatedParts = []; // Pièces animées (LED, écrans, etc.)
        this._clickAnimations = []; // Animations de rebond au clic { group, startTime, duration, baseScale }
        this.build();
    }

    /**
     * Tag tous les meshes d'un groupe comme interactifs et rattache l'instrument
     * pour que le raycasting fonctionne sur les sous-parties
     */
    _tagGroup(group, item) {
        group.userData = { instrument: item, interactive: true, label: item.label };
        group.traverse((child) => {
            if (child.isMesh) {
                child.userData.instrument = item;
                child.userData.interactive = true;
                child.userData.label = item.label;
            }
        });
    }

    build() {
        INSTRUMENTS.forEach((item) => {
            const group = this._buildInstrument(item);
            this.meshes.set(item.id, group);
        });
    }

    /**
     * Construit l'instrument 3D détaillé correspondant à l'ID
     */
    _buildInstrument(item) {
        switch (item.id) {
            case 'tensiometer': return this._buildTensiometer(item);
            case 'stethoscope': return this._buildStethoscope(item);
            case 'oximeter': return this._buildOximeter(item);
            case 'thermometer': return this._buildThermometer(item);
            case 'glucometer': return this._buildGlucometer(item);
            case 'tablet': return this._buildTablet(item);
            default: return this._buildGenericBox(item);
        }
    }

    // ===== STÉTHOSCOPE (modèle GLB Sketchfab) =====
    _buildStethoscope(item) {
        const group = new THREE.Group();
        group.position.set(item.x, 1.445, item.z);
        this._tagGroup(group, item);

        const loader = _sharedGLTFLoader;
        loader.load('assets/3D/stethoscope.glb', (gltf) => {
            const model = gltf.scene;

            // Centrer le modèle sur sa propre bounding box
            const b = new THREE.Box3().setFromObject(model);
            const center = b.getCenter(new THREE.Vector3());
            const size = b.getSize(new THREE.Vector3());

            model.position.sub(center);

            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 0.15;
            const s = targetSize / maxDim;
            model.scale.set(s, s, s);
            model.rotation.x = -Math.PI / 2;

            // Plaquer la base du modèle sur le plateau (borne min.y → +0.005)
            model.updateMatrixWorld(true);
            const bb = new THREE.Box3().setFromObject(model);
            model.position.y += (0.005 - bb.min.y);

            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.userData = { instrument: item, interactive: true, label: item.label };
                }
            });

            group.add(model);

            // Re-taguer le groupe car les enfants ont changé
            this._tagGroup(group, item);

            // Re-collecter les objets interactifs
            document.dispatchEvent(new CustomEvent('instruments-updated'));
        }, undefined, (err) => {
            console.warn('[Instruments] Échec chargement stéthoscope GLB:', err);
        });

        this.scene.add(group);
        return group;
    }

    _buildTensiometer(item) {
        const group = new THREE.Group();
        group.position.set(item.x, 1.445, item.z);

        // Boîtier principal
        const caseMat = createMaterial(0xf0f0f0, { roughness: 0.3, metalness: 0.2 });
        const caseMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.24, 0.1, 0.14),
            caseMat
        );
        caseMesh.position.y = 0.04;
        caseMesh.castShadow = true;
        caseMesh.receiveShadow = true;
        caseMesh.name = item.label;
        caseMesh.userData = { instrument: item, interactive: true, label: item.label };
        group.add(caseMesh);

        // Écran LCD
        const screenTex = createScreenTexture('120/80', '#0a1a0a', '#00ff44', 128, 64, {
            fontSize: 26, icon: 'heart', label: 'mmHg'
        });
        screenTex.minFilter = THREE.LinearFilter;
        const screenMat = new THREE.MeshStandardMaterial({
            map: screenTex,
            emissive: 0x003311,
            emissiveIntensity: 0.8,
            roughness: 0.1
        });
        const screen = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, 0.06, 0.002),
            screenMat
        );
        screen.position.set(0, 0.06, 0.072);
        group.add(screen);

        // Boutons
        const btnMat = createMaterial(0xcccccc, { roughness: 0.4, metalness: 0.5 });
        for (let i = 0; i < 3; i++) {
            const btn = new THREE.Mesh(
                new THREE.CylinderGeometry(0.008, 0.008, 0.006, 8),
                btnMat
            );
            btn.rotation.x = Math.PI / 2;
            btn.position.set(-0.06 + i * 0.06, 0.01, 0.072);
            group.add(btn);
        }

        // Brassard (enroulé à côté)
        const cuffMat = createMaterial(0x3a5c8a, { roughness: 0.85, metalness: 0.0 });
        const cuff = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.06, 0.06),
            cuffMat
        );
        cuff.position.set(0, -0.01, 0.10);
        cuff.castShadow = true;
        group.add(cuff);

        // Tube connecteur entre brassard et boîtier
        const tubeCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, -0.01, 0.07),
            new THREE.Vector3(0.02, 0.01, 0.05),
            new THREE.Vector3(0, 0.02, 0.03),
        ]);
        const tubeMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.3, metalness: 0.6 });
        const tube = new THREE.Mesh(
            new THREE.TubeGeometry(tubeCurve, 8, 0.004, 6, false),
            tubeMat
        );
        group.add(tube);

        // Bulbe de gonflage
        const bulbMat = createMaterial(0xdd3333, { roughness: 0.5, metalness: 0.1 });
        const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.02, 8, 6),
            bulbMat
        );
        bulb.position.set(0.12, -0.01, 0.10);
        bulb.castShadow = true;
        group.add(bulb);

        this._tagGroup(group, item);
        this.scene.add(group);
        return group;
    }

    // ===== OXymÈTRE =====
    _buildOximeter(item) {
        const group = new THREE.Group();
        group.position.set(item.x, 1.445, item.z);

        // Boîtier clip (forme en pince)
        const shellMat = createMaterial(0x2a2a2a, { roughness: 0.3, metalness: 0.4 });
        const upperShell = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.025, 0.04),
            shellMat
        );
        upperShell.position.y = 0.045;
        upperShell.castShadow = true;
        group.add(upperShell);

        const lowerShell = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.025, 0.04),
            shellMat
        );
        lowerShell.position.y = 0.015;
        lowerShell.castShadow = true;
        group.add(lowerShell);

        // Charnière
        const hingeMat = createMaterial(0x888888, { roughness: 0.2, metalness: 0.8 });
        const hinge = new THREE.Mesh(
            new THREE.CylinderGeometry(0.008, 0.008, 0.045, 8),
            hingeMat
        );
        hinge.rotation.z = Math.PI / 2;
        hinge.position.set(-0.035, 0.03, 0);
        group.add(hinge);

        // LED pulsante rouge (émetteur)
        const ledRedMat = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 1.5,
            roughness: 0.1
        });
        const ledRed = new THREE.Mesh(
            new THREE.SphereGeometry(0.005, 8, 6),
            ledRedMat
        );
        ledRed.position.set(0, 0.03, 0.022);
        ledRed.name = 'OxymetreLEDRed';
        group.add(ledRed);

        // LED IR (infrarouge, visible comme sombre)
        const ledIrMat = new THREE.MeshStandardMaterial({
            color: 0x660000,
            emissive: 0x330000,
            emissiveIntensity: 0.3,
            roughness: 0.1
        });
        const ledIr = new THREE.Mesh(
            new THREE.SphereGeometry(0.005, 8, 6),
            ledIrMat
        );
        ledIr.position.set(0.01, 0.015, 0.022);
        group.add(ledIr);

        // Détecteur en dessous
        const detectorMat = createMaterial(0x111111, { roughness: 0.1, metalness: 0.5 });
        const detector = new THREE.Mesh(
            new THREE.BoxGeometry(0.03, 0.003, 0.02),
            detectorMat
        );
        detector.position.set(0, -0.002, 0.022);
        group.add(detector);

        // Écran miniature affichant SpO2
        const screenTex = createScreenTexture('98%', '#001a00', '#00ff33', 64, 32, {
            fontSize: 16, icon: 'heart', label: 'SpO2'
        });
        screenTex.minFilter = THREE.LinearFilter;
        const screenMat = new THREE.MeshStandardMaterial({
            map: screenTex,
            emissive: 0x001a00,
            emissiveIntensity: 0.9,
            roughness: 0.1
        });
        const screen = new THREE.Mesh(
            new THREE.BoxGeometry(0.035, 0.018, 0.002),
            screenMat
        );
        screen.position.set(0.01, 0.045, -0.022);
        group.add(screen);

        // Enregister LED pour animation pulsante
        this.animatedParts.push({ type: 'pulsingLED', material: ledRedMat, baseIntensity: 1.5, freq: 1.2 });

        this._tagGroup(group, item);
        this.scene.add(group);
        return group;
    }

    // ===== THERMOMÈTRE =====
    _buildThermometer(item) {
        const group = new THREE.Group();
        group.position.set(item.x, 1.445, item.z);

        // Bâtonnet principal (corps du thermomètre)
        const stickMat = createMaterial(0xf8f8f8, { roughness: 0.2, metalness: 0.3 });
        const stick = new THREE.Mesh(
            new THREE.BoxGeometry(0.025, 0.008, 0.16),
            stickMat
        );
        stick.castShadow = true;
        stick.userData = { instrument: item, interactive: true, label: item.label };
        group.add(stick);

        // Embout bout (capteur)
        const tipMat = createMaterial(0xddddcc, { roughness: 0.15, metalness: 0.5 });
        const tip = new THREE.Mesh(
            new THREE.SphereGeometry(0.006, 8, 6),
            tipMat
        );
        tip.position.set(0, 0, 0.082);
        group.add(tip);

        // Écran mini LCD
        const screenTex = createScreenTexture('36.8°', '#0a0a1a', '#44ddff', 80, 32, {
            fontSize: 16, icon: 'thermo', label: '°C'
        });
        screenTex.minFilter = THREE.LinearFilter;
        const screenMat = new THREE.MeshStandardMaterial({
            map: screenTex,
            emissive: 0x001122,
            emissiveIntensity: 0.7,
            roughness: 0.1
        });
        const screen = new THREE.Mesh(
            new THREE.BoxGeometry(0.02, 0.006, 0.06),
            screenMat
        );
        screen.position.set(0, 0.006, -0.02);
        group.add(screen);

        // Bouton marche
        const btnMat = createMaterial(0x44aa44, { roughness: 0.4, metalness: 0.2 });
        const btn = new THREE.Mesh(
            new THREE.CylinderGeometry(0.004, 0.004, 0.003, 8),
            btnMat
        );
        btn.rotation.x = Math.PI / 2;
        btn.position.set(0, 0.006, -0.05);
        group.add(btn);

        this._tagGroup(group, item);
        this.scene.add(group);
        return group;
    }

    // ===== GLUCOMÈTRE =====
    _buildGlucometer(item) {
        const group = new THREE.Group();
        group.position.set(item.x, 1.445, item.z);

        // Boîtier principal
        const caseMat = createMaterial(0x1a1a3a, { roughness: 0.25, metalness: 0.15 });
        const caseMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.07, 0.12, 0.04),
            caseMat
        );
        caseMesh.position.y = 0.06;
        caseMesh.castShadow = true;
        caseMesh.receiveShadow = true;
        caseMesh.userData = { instrument: item, interactive: true, label: item.label };
        group.add(caseMesh);

        // Écran LCD affichant glycémie
        const screenTex = createScreenTexture('1.2', '#0a0a10', '#ff6633', 64, 48, {
            fontSize: 22, icon: 'drop', label: 'g/L'
        });
        screenTex.minFilter = THREE.LinearFilter;
        const screenMat = new THREE.MeshStandardMaterial({
            map: screenTex,
            emissive: 0x1a0800,
            emissiveIntensity: 0.9,
            roughness: 0.1
        });
        const screen = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 0.04, 0.002),
            screenMat
        );
        screen.position.set(0, 0.09, 0.022);
        group.add(screen);

        // Fente pour bandelette
        const slotMat = createMaterial(0x333333, { roughness: 0.3, metalness: 0.6 });
        const slot = new THREE.Mesh(
            new THREE.BoxGeometry(0.025, 0.003, 0.008),
            slotMat
        );
        slot.position.set(0, 0.02, 0.018);
        group.add(slot);

        // Bandelette insérée (extrémité visible)
        const stripMat = createMaterial(0xf0f0f0, { roughness: 0.8, metalness: 0.0 });
        const strip = new THREE.Mesh(
            new THREE.BoxGeometry(0.008, 0.002, 0.05),
            stripMat
        );
        strip.position.set(0, 0.02, 0.045);
        strip.rotation.x = 0.1;
        group.add(strip);

        // Zone colorée sur la bandelette (réactif)
        const reactMat = createMaterial(0xdd4444, { roughness: 0.8, metalness: 0.0 });
        const reactZone = new THREE.Mesh(
            new THREE.BoxGeometry(0.006, 0.001, 0.01),
            reactMat
        );
        reactZone.position.set(0, 0.022, 0.025);
        group.add(reactZone);

        this._tagGroup(group, item);
        this.scene.add(group);
        return group;
    }

    // ===== TABLETTE (posée à plat sur le bureau, écran vers le haut) =====
    _buildTablet(item) {
        const group = new THREE.Group();
        group.position.set(item.x, 1.452, item.z);
        // À plat : l'écran (plan XY) bascule vers le haut
        group.rotation.x = -Math.PI / 2;

        // Cadre (bordure noire)
        const frameMat = createMaterial(0x111111, { roughness: 0.2, metalness: 0.5 });
        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.16, 0.008),
            frameMat
        );
        frame.castShadow = true;
        frame.receiveShadow = true;
        frame.name = item.label;
        frame.userData = { instrument: item, interactive: true, label: item.label };
        group.add(frame);

        // Écran avec contenu
        const screenTex = createTabletScreenTexture();
        screenTex.minFilter = THREE.LinearFilter;
        const screenMat = new THREE.MeshStandardMaterial({
            map: screenTex,
            emissive: 0x0a1528,
            emissiveIntensity: 0.6,
            roughness: 0.05
        });
        const screen = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.145, 0.002),
            screenMat
        );
        screen.position.z = 0.005;
        group.add(screen);

        // Bouton Home (cercle)
        const homeBtnMat = createMaterial(0x222222, { roughness: 0.15, metalness: 0.5 });
        const homeBtn = new THREE.Mesh(
            new THREE.CylinderGeometry(0.008, 0.008, 0.003, 16),
            homeBtnMat
        );
        homeBtn.rotation.x = Math.PI / 2;
        homeBtn.position.set(0, -0.075, 0.005);
        group.add(homeBtn);

        // Caméra frontale (petit point)
        const camMat = createMaterial(0x050505, { roughness: 0.05, metalness: 0.9 });
        const cam = new THREE.Mesh(
            new THREE.CylinderGeometry(0.003, 0.003, 0.002, 8),
            camMat
        );
        cam.rotation.x = Math.PI / 2;
        cam.position.set(0, 0.072, 0.005);
        group.add(cam);

        this._tagGroup(group, item);
        this.scene.add(group);
        return group;
    }

    // ===== GÉNÉRIQUE (fallback) =====
    _buildGenericBox(item) {
        const mat = createMaterial(item.id === 'tablet' ? 0x101820 : 0x1e3555, {
            emissive: item.id === 'tablet' ? 0x003366 : 0x000000,
            emissiveIntensity: item.id === 'tablet' ? 0.25 : 0
        });
        const mesh = box(this.scene, { x: 0.26, y: 0.08, z: 0.18 }, { x: item.x, y: 1.48, z: item.z }, mat, item.label, true);
        mesh.userData.instrument = item;
        return mesh;
    }

    /**
     * Déclenche une animation de rebond (bounce) sur l'instrument cliqué.
     * L'instrument grossit brièvement puis revient à sa taille d'origine.
     * @param {string} instrumentId — identifiant de l'instrument (ex: 'tensiometer')
     */
    triggerBounce(instrumentId) {
        const group = this.meshes.get(instrumentId);
        if (!group) return;
        // Sauvegarder l'échelle de base (1,1,1 par défaut)
        const baseScale = group.scale.clone();
        this._clickAnimations.push({
            group,
            startTime: performance.now(),
            duration: 400, // ms
            baseX: baseScale.x,
            baseY: baseScale.y,
            baseZ: baseScale.z,
        });
    }

    /**
     * Met à jour les animations (LED pulsante, rebonds au clic, etc.)
     * Appeler dans la boucle d'animation avec le temps elapsed.
     */
    update(elapsed) {
        for (const part of this.animatedParts) {
            if (part.type === 'pulsingLED') {
                // Pulsation cardiaque réaliste : pic rapide puis plateau
                const t = (elapsed * part.freq) % 1;
                const beat = t < 0.1 ? Math.sin(t / 0.1 * Math.PI) : 0.15;
                part.material.emissiveIntensity = part.baseIntensity * (0.2 + beat * 0.8);
            }
        }

        // Mise à jour des animations de rebond au clic
        const now = performance.now();
        for (let i = this._clickAnimations.length - 1; i >= 0; i--) {
            const anim = this._clickAnimations[i];
            const progress = (now - anim.startTime) / anim.duration;
            if (progress >= 1) {
                // Terminé : restaurer l'échelle d'origine
                anim.group.scale.set(anim.baseX, anim.baseY, anim.baseZ);
                this._clickAnimations.splice(i, 1);
            } else {
                // Courbe de rebond : scale↑ puis retour avec léger overshoot
                // Phase 0→0.3 : grossir (up to 1.15), Phase 0.3→1.0 : revenir avec bounce
                let s;
                if (progress < 0.3) {
                    const t = progress / 0.3;
                    s = 1 + 0.15 * Math.sin(t * Math.PI / 2); // ease-out grow
                } else {
                    const t = (progress - 0.3) / 0.7;
                    // Bounce de retour avec léger overshoot (élastique)
                    s = 1.15 * (1 - t) + 1.0 * t + 0.04 * Math.sin(t * Math.PI * 2);
                }
                anim.group.scale.set(
                    anim.baseX * s,
                    anim.baseY * s,
                    anim.baseZ * s
                );
            }
        }
    }

    /**
     * Trouve l'instrument associé à un objet cliqué
     * Remonte la hiérarchie parentale jusqu'à trouver un instrument
     */
    getByObject(object) {
        // Vérifier l'objet lui-même
        if (object?.userData?.instrument) return object.userData.instrument;
        // Remonter les parents pour trouver le groupe d'instrument
        let current = object?.parent;
        while (current) {
            if (current.userData?.instrument) return current.userData.instrument;
            // Vérifier si ce parent est dans notre Map de groupes
            for (const [id, group] of this.meshes) {
                if (group === current) {
                    return INSTRUMENTS.find(i => i.id === id) || null;
                }
            }
            current = current.parent;
        }
        return null;
    }

    /**
     * Affiche la valeur mesurée avec effet visuel
     * Met à jour l'écran LCD de l'instrument avec la valeur mesurée
     */
    showMeasurement(instrument, caseData) {
        if (!instrument || instrument.key === 'tablet') return null;
        const constants = caseData?.examenClinique?.constantes || {};

        // Le stéthoscope ne mesure pas une constante mais fournit l'auscultation
        if (instrument.key === 'stethoscope') {
            const examinations = caseData?.examenClinique || {};
            // Chercher des données d'auscultation dans les examens
            let auscultResult = '--';
            for (const key of Object.keys(examinations)) {
                const section = examinations[key];
                if (section && typeof section === 'object' && section.auscultation) {
                    auscultResult = section.auscultation;
                    break;
                }
            }
            // Si pas trouvé dans les examens, donner le pouls
            if (auscultResult === '--' && constants.pouls) {
                auscultResult = `Pouls: ${constants.pouls}`;
            }
            // Pousser le son de mesure et l'animation
            const group = this.meshes.get(instrument.id);
            if (group) {
                const mainMesh = group.children?.find(c => c.userData?.instrument) || group.children?.[0];
                if (mainMesh?.material) {
                    pulseEmissive(mainMesh, 1.5);
                }
            }
            return { label: 'Auscultation', value: auscultResult };
        }

        const aliases = {
            glycemie: constants.glycemie || constants.glycemieCaps || constants.glycemieCapillaire,
            saturationO2: constants.saturationO2 || constants.spo2 || constants.SpO2
        };
        const value = aliases[instrument.key] || constants[instrument.key] || '--';

        // Pulse l'écran de l'instrument
        const group = this.meshes.get(instrument.id);
        if (group) {
            // Trouver le mesh principal pour le pulse
            const mainMesh = group.children?.find(c => c.userData?.instrument) || group.children?.[0];
            if (mainMesh?.material) {
                pulseEmissive(mainMesh, 1.5);
            }

            // Mettre à jour l'écran LCD avec la valeur mesurée
            this._updateInstrumentScreen(instrument, value);
        }

        return { label: instrument.title, value };
    }

    /**
     * Met à jour la texture de l'écran LCD d'un instrument avec la valeur mesurée
     * @param {Object} instrument — l'objet instrument { id, label, key, title }
     * @param {string|number} value — la valeur mesurée à afficher
     */
    _updateInstrumentScreen(instrument, value) {
        const group = this.meshes.get(instrument.id);
        if (!group) return;

        // Configuration par type d'instrument
        const screenConfigs = {
            tensiometer: { text: String(value), bgColor: '#0a1a0a', fgColor: '#00ff44', w: 128, h: 64, fontSize: 26, icon: 'heart', label: 'mmHg' },
            oximeter: { text: String(value), bgColor: '#001a00', fgColor: '#00ff33', w: 64, h: 32, fontSize: 16, icon: 'heart', label: 'SpO2' },
            thermometer: { text: String(value), bgColor: '#0a0a1a', fgColor: '#44ddff', w: 80, h: 32, fontSize: 16, icon: 'thermo', label: '°C' },
            glucometer: { text: String(value), bgColor: '#0a0a10', fgColor: '#ff6633', w: 64, h: 48, fontSize: 22, icon: 'drop', label: 'g/L' },
        };

        const config = screenConfigs[instrument.id];
        if (!config) return;

        // Parcourir le groupe pour trouver l'écran (mesh avec texture CanvasTexture)
        group.traverse((child) => {
            if (!child.isMesh || !child.material || !child.material.map) return;
            // Vérifier que c'est bien une texture d'écran (CanvasTexture avec les bonnes dimensions)
            if (!(child.material.map instanceof THREE.CanvasTexture)) return;
            const tex = child.material.map;
            // Vérifier que les dimensions correspondent à celles de l'écran de cet instrument
            const canvas = tex.image;
            if (!canvas || canvas.width !== config.w || canvas.height !== config.h) return;

            // Redessiner le canvas avec la nouvelle valeur
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Fond
            ctx.fillStyle = config.bgColor;
            ctx.fillRect(0, 0, config.w, config.h);

            // Lignes de grille (effet LCD)
            ctx.strokeStyle = 'rgba(255,255,255,0.03)';
            ctx.lineWidth = 1;
            for (let y = 0; y < config.h; y += 3) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(config.w, y);
                ctx.stroke();
            }

            // Texte principal (valeur mesurée)
            ctx.font = `bold ${config.fontSize}px monospace`;
            ctx.fillStyle = config.fgColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(config.text, config.w / 2, config.h / 2);

            // Icône optionnelle
            if (config.icon === 'heart') {
                ctx.font = `${config.fontSize * 0.6}px sans-serif`;
                ctx.fillStyle = 'rgba(255,50,50,0.6)';
                ctx.fillText('♥', 14, config.h / 2);
            }
            if (config.icon === 'drop') {
                ctx.font = `${config.fontSize * 0.5}px sans-serif`;
                ctx.fillStyle = 'rgba(255,100,100,0.6)';
                ctx.fillText('●', 14, config.h / 2);
            }
            if (config.icon === 'thermo') {
                ctx.font = `${config.fontSize * 0.5}px sans-serif`;
                ctx.fillStyle = 'rgba(255,200,50,0.7)';
                ctx.fillText('▲', 14, config.h / 2);
            }

            // Label en haut
            if (config.label) {
                ctx.font = `bold ${Math.round(config.fontSize * 0.35)}px sans-serif`;
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.textAlign = 'left';
                ctx.fillText(config.label, 4, 8);
            }

            // Forcer la mise à jour de la texture
            tex.needsUpdate = true;
            child.material.emissiveIntensity = 1.5; // Flash lumineux pour attirer l'attention
            // Retour progressif à l'intensité normale
            setTimeout(() => {
                // On ne descend pas en dessous de la valeur initiale
                if (child.material.emissiveIntensity > 0.9) {
                    child.material.emissiveIntensity = 0.9;
                }
            }, 800);
        });
    }
}