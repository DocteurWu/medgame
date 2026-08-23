/**
 * three-lighting-agent.js — Agent d'éclairage avancé
 * HDR (HDRI Poly Haven + fallback procédural), ombres dynamiques douces,
 * IBL (RoomEnvironment), post-processing complet (GTAO, bloom, MSAA, tone mapping).
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Sources HDRI neutres (réflexions PBR crédibles) — tentées dans l'ordre, fallback procédural si offline
const HDRI_SOURCES = [
    'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/photo_studio_01_1k.hdr',
    'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/brown_photostudio_02_1k.hdr'
];
const HDRI_TIMEOUT_MS = 8000;

export class ThreeLightingAgent {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.composer = null;
        this.bloomPass = null;
        this.gtaoPass = null;
        this.renderPass = null;
        this.theme = 'dark';
        this.ambientLight = null;
        this.keyLight = null;
        this.pointLights = [];
        // Nouvelles sources de remplissage (fill / rebond) — référencées pour le thème
        this.hemiLight = null;
        this.bounceLights = [];
        this._envTexture = null;
        this._hdriLoaded = false;

        // Réglages qualité pilotés par ThreeQualityAgent
        this.quality = {
            msaa: 4,
            gtao: true,
            bloom: true,
            shadowSize: 2048,
            gtaoRadius: 0.6,
            gtaoSamples: 12
        };
    }

    /**
     * Configure l'éclairage complet de la scène clinique
     */
    setupLighting() {
        // Environnement — Lumière ambiante douce (ciel)
        // Intensité réduite : le gros du "fill" est désormais porté par l'IBL + l'hémisphérique
        const ambientLight = new THREE.AmbientLight('#7a8b9e', 0.14);
        this.scene.add(ambientLight);
        this.ambientLight = ambientLight;

        // Lumière hémisphérique — simule le rebond naturel ciel ↔ sol.
        // Soulève les zones d'ombre sans aplatir les volumes.
        const hemiLight = new THREE.HemisphereLight('#bfd8f2', '#54503f', 0.25);
        this.scene.add(hemiLight);
        this.hemiLight = hemiLight;

        // Lumière principale (Sun Light) entrant par la fenêtre du mur droit (x = 5.5, z ≈ -2.2)
        const keyLight = new THREE.DirectionalLight('#fed7aa', 1.9);
        keyLight.position.set(11, 7.5, -3.5);
        // Ombres portées en version douce (PCF).
        // NOTE HISTORIQUE : l'ancienne "bande noire" ne venait pas des ombres elles-mêmes,
        // mais de la shadow-camera par défaut (frustum ±5 trop étroit pour une salle de 11×10)
        // combinée à un bias nul (shadow acne). Frustum resserré sur la salle + normalBias
        // => ombres propres, douces, sans bande ni acne.
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(this.quality.shadowSize, this.quality.shadowSize);
        keyLight.shadow.camera.near = 2;
        keyLight.shadow.camera.far = 30;
        keyLight.shadow.camera.left = -9;
        keyLight.shadow.camera.right = 9;
        keyLight.shadow.camera.top = 9;
        keyLight.shadow.camera.bottom = -9;
        keyLight.shadow.bias = -0.0002;
        keyLight.shadow.normalBias = 0.03;
        keyLight.target.position.set(0, 1, 0);
        this.scene.add(keyLight.target);
        this.scene.add(keyLight);
        this.keyLight = keyLight;

        // Lumières ponctuelles (dalles LED du plafond sous y=5.0) — plus douces
        this.pointLights = [];
        this.pointLights.push(this._addPointLight(-2.5, 4.3, 0, '#f8fafc', 0.28, 9));
        this.pointLights.push(this._addPointLight(2.5, 4.3, 0, '#f8fafc', 0.28, 9));

        // Standing floor lamp warm yellow light on the left wall (floor lamp at z = 3.2)
        const wallLampLight = new THREE.PointLight('#ff9944', 2.8, 6.5);
        wallLampLight.position.set(-4.95, 1.7, 3.2);
        this.scene.add(wallLampLight);
        this.wallLampLight = wallLampLight;

        // Blue laser stand light (foreground)
        const blueLaserLight = new THREE.PointLight('#00aaff', 2.2, 5.0);
        blueLaserLight.position.set(-2.0, 1.12, 2.0);
        this.scene.add(blueLaserLight);
        this.blueLaserLight = blueLaserLight;

        // Lumière d'appoint sous les instruments (glow bleu sur le bureau)
        const instLight = new THREE.PointLight(0x44aaff, 0.35, 4);
        instLight.position.set(-2.8, 1.45, -0.4);
        this.scene.add(instLight);
        this.instLight = instLight;

        // --- Lumières de rebond (bounce lights) : éclairent subtilement les zones d'ombre ---
        this.bounceLights = [];
        // Rebond chaud : la key light frappe le sol côté fenêtre et rediffuse vers le plafond
        this.bounceLights.push(this._addPointLight(3.6, 0.5, 1.6, '#ffd9b0', 0.22, 7));
        // Contre-jour froid côté opposé : détache les volumes du mur du fond
        this.bounceLights.push(this._addPointLight(-4.4, 2.6, -2.6, '#9db8d6', 0.14, 8));

        // Configuration globale du renderer
        this.renderer.shadowMap.enabled = true; // Ombres douces PCF (voir note historique plus haut)
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        // Environnement IBL : c'est lui qui donne du "réel" aux métaux, vernis et céramiques
        this._setupEnvironment();
        // Puis tentative de chargement d'une vraie HDRI (meilleures réflexions)
        this._loadHDRI();
    }

    /**
     * Génère un environnement IBL procédural (RoomEnvironment + PMREM).
     * Fournit des réflexions PBR crédibles sur tous les matériaux standard/physical.
     * Sert de fallback immédiat si la HDRI distante n'est pas (encore) disponible.
     */
    _setupEnvironment() {
        try {
            const pmrem = new THREE.PMREMGenerator(this.renderer);
            const envScene = new RoomEnvironment();
            this._envTexture = pmrem.fromScene(envScene, 0.04).texture;
            this.scene.environment = this._envTexture;
            // Intensité globale (three >= r163) — ignorée silencieusement sur versions antérieures
            if ('environmentIntensity' in this.scene) {
                this.scene.environmentIntensity = this.theme === 'light' ? 0.55 : 0.35;
            }
            pmrem.dispose();
        } catch (e) {
            console.warn('[LightingAgent] Environnement IBL non disponible:', e);
        }
    }

    /**
     * Charge une HDRI equirectangulaire depuis un CDN (Poly Haven).
     * Améliore nettement la qualité des réflexions PBR par rapport au RoomEnvironment procédural.
     * En cas d'échec réseau ou de timeout, conserve le fallback procédural existant.
     */
    _loadHDRI() {
        if (this._hdriLoaded || !navigator.onLine) return;

        const tryLoad = async () => {
            const { RGBELoader } = await import('three/addons/loaders/RGBELoader.js');
            const loader = new RGBELoader();

            for (const url of HDRI_SOURCES) {
                try {
                    const texture = await new Promise((resolve, reject) => {
                        const timer = setTimeout(() => reject(new Error('timeout')), HDRI_TIMEOUT_MS);
                        loader.load(url, (tex) => { clearTimeout(timer); resolve(tex); }, undefined, (err) => {
                            clearTimeout(timer); reject(err);
                        });
                    });
                    texture.mapping = THREE.EquirectangularReflectionMapping;
                    this.scene.environment = texture;
                    if ('environmentIntensity' in this.scene) {
                        this.scene.environmentIntensity = this.theme === 'light' ? 0.55 : 0.35;
                    }
                    // Libérer l'environnement procédural devenu inutile
                    if (this._envTexture && this._envTexture !== texture) {
                        this._envTexture.dispose();
                        this._envTexture = texture;
                    }
                    this._hdriLoaded = true;
                    console.info('[LightingAgent] HDRI chargée ✅ réflexions PBR améliorées');
                    return;
                } catch (e) {
                    console.warn(`[LightingAgent] HDRI indisponible (${url}), essai suivant…`);
                }
            }
            console.info('[LightingAgent] HDRI non chargée — fallback procédural conservé');
        };

        tryLoad().catch(() => {});
    }

    _addPointLight(x, y, z, color, intensity, distance) {
        const light = new THREE.PointLight(color, intensity, distance);
        light.position.set(x, y, z);
        this.scene.add(light);
        return light;
    }

    /**
     * Applique les réglages qualité (appelé par ThreeQualityAgent).
     * @param {Object} q — { msaa, gtao, bloom, shadowSize, gtaoRadius, gtaoSamples }
     */
    setQualitySettings(q = {}) {
        Object.assign(this.quality, q);

        // Taille de la shadow map (dispose obligatoire pour appliquer le changement)
        if (this.keyLight) {
            const size = this.quality.shadowSize;
            if (this.keyLight.shadow.mapSize.x !== size) {
                this.keyLight.shadow.mapSize.set(size, size);
                if (this.keyLight.shadow.map) {
                    this.keyLight.shadow.map.dispose();
                    this.keyLight.shadow.map = null;
                }
            }
        }

        // Passes post-processing (si le composer existe déjà)
        if (this.gtaoPass) {
            this.gtaoPass.enabled = !!this.quality.gtao;
            if (this.quality.gtao && typeof this.gtaoPass.updateGtaoMaterial === 'function') {
                this.gtaoPass.updateGtaoMaterial({
                    radius: this.quality.gtaoRadius,
                    samples: this.quality.gtaoSamples
                });
            }
        }
        if (this.bloomPass) {
            this.bloomPass.enabled = !!this.quality.bloom;
        }

        // Plus aucun effet requis → rendu direct (MSAA du canvas, chemin le plus rapide)
        if (!this.quality.gtao && !this.quality.bloom && this.composer) {
            this.teardownComposer();
        }
    }

    toggleTheme() {
        // Mode jour supprimé : le rendu sombre clinique est le seul thème.
        return this.theme;
    }

    /**
     * Configure le post-processing complet :
     * RenderPass (MSAA HalfFloat) → GTAO (occlusion ambiante) → Bloom → OutputPass.
     * Le composer n'est créé que si la qualité l'exige (bloom ou gtao actifs).
     */
    async setupPostProcessing() {
        const wantsComposer = this.quality.bloom || this.quality.gtao;
        if (!wantsComposer || this.composer) return;

        try {
            const postprocessing = await import('three/addons/postprocessing/EffectComposer.js');
            const renderPassMod = await import('three/addons/postprocessing/RenderPass.js');
            const outputPassMod = await import('three/addons/postprocessing/OutputPass.js');

            const { EffectComposer } = postprocessing;
            const { RenderPass } = renderPassMod;
            const { OutputPass } = outputPassMod;

            const width = window.innerWidth;
            const height = window.innerHeight;

            // Render target MSAA HalfFloat : conserve l'anti-aliasing matériel
            // même quand la scène passe par le composer (WebGL2 uniquement).
            const rtParams = {
                type: THREE.HalfFloatType,
                colorSpace: THREE.LinearSRGBColorSpace
            };
            if (this.renderer.capabilities.isWebGL2 && this.quality.msaa > 0) {
                rtParams.samples = this.quality.msaa;
            }
            const renderTarget = new THREE.WebGLRenderTarget(width, height, rtParams);
            this._builtMsaa = rtParams.samples || 0;

            this.composer = new EffectComposer(this.renderer, renderTarget);
            this.composer.setPixelRatio(this.renderer.getPixelRatio());
            this.composer.setSize(width, height);

            this.renderPass = new RenderPass(this.scene, this._getActiveCamera());
            this.composer.addPass(this.renderPass);

            // GTAO — occlusion ambiante temps réel (contact shading réaliste)
            if (this.quality.gtao) {
                try {
                    const gtaoMod = await import('three/addons/postprocessing/GTAOPass.js');
                    const { GTAOPass } = gtaoMod;
                    this.gtaoPass = new GTAOPass(this.scene, this._getActiveCamera(), width, height);
                    if (typeof this.gtaoPass.updateGtaoMaterial === 'function') {
                        this.gtaoPass.updateGtaoMaterial({
                            radius: this.quality.gtaoRadius,
                            distanceExponent: 1.0,
                            thickness: 1.0,
                            scale: 1.0,
                            samples: this.quality.gtaoSamples
                        });
                    }
                    if (typeof this.gtaoPass.updatePdMaterial === 'function') {
                        this.gtaoPass.updatePdMaterial({
                            lumaPhi: 10.0,
                            depthPhi: 2.0,
                            normalPhi: 3.0,
                            radius: 4.0,
                            radiusExponent: 16.0,
                            rings: 2.0,
                            samples: 16.0
                        });
                    }
                    this.composer.addPass(this.gtaoPass);
                } catch (e) {
                    console.warn('[LightingAgent] GTAO indisponible:', e);
                    this.gtaoPass = null;
                }
            }

            // Bloom — valeurs douces pour un rendu médical (halos ampoules/écrans uniquement)
            if (this.quality.bloom) {
                const bloomPassMod = await import('three/addons/postprocessing/UnrealBloomPass.js');
                const { UnrealBloomPass } = bloomPassMod;
                this.bloomPass = new UnrealBloomPass(
                    new THREE.Vector2(width, height),
                    0.38, // strength
                    0.35, // radius
                    0.88  // threshold
                );
                this.composer.addPass(this.bloomPass);
            }

            const outputPass = new OutputPass();
            this.composer.addPass(outputPass);
        } catch (e) {
            console.warn('[LightingAgent] Post-processing non disponible:', e);
            this.composer = null;
        }
    }

    _getActiveCamera() {
        // Retrieve the camera from the ThreeScene wrapper (this.scene is the THREE.Scene)
        // The camera is stored on the parent ThreeScene instance
        if (this.scene._camera) return this.scene._camera;
        if (this.scene.userData?.camera) return this.scene.userData.camera;
        return null;
    }

    /**
     * Reconstruit le composer si le niveau de MSAA demandé a changé.
     * @returns {boolean} true si une reconstruction est nécessaire/nécessaire faite
     */
    needsRebuild(msaa) {
        return !!this.composer && (this._builtMsaa || 0) !== (msaa || 0);
    }

    teardownComposer() {
        if (this.composer) {
            // Disposer les passes (GTAO/Bloom allouent leurs propres render targets —
            // sans cela : fuite VRAM à chaque changement de palier qualité)
            try { this.gtaoPass?.dispose?.(); } catch (e) { /* pass sans dispose */ }
            try { this.bloomPass?.dispose?.(); } catch (e) {}
            try { this.renderPass?.dispose?.(); } catch (e) {}
            this.composer.renderTarget1?.dispose();
            this.composer.renderTarget2?.dispose();
            this.composer = null;
            this.renderPass = null;
            this.gtaoPass = null;
            this.bloomPass = null;
        }
    }

    /**
     * Redimensionne le composer (appelé sur resize fenêtre)
     */
    resize(width, height) {
        if (!this.composer) return;
        // Synchroniser le pixel ratio du composer avec celui du renderer
        // (modifié dynamiquement par l'agent qualité)
        this.composer.setPixelRatio(this.renderer.getPixelRatio());
        this.composer.setSize(width, height);
    }

    /**
     * Mettre à jour si le composer est actif
     */
    render() {
        if (this.composer) {
            this.composer.render();
            return true;
        }
        return false;
    }

    /**
     * Ajuster l'exposition pour les différentes caméras
     * @param {string} mode - 'room' | 'patient' | 'desk'
     */
    setCameraExposure(mode) {
        const exposures = {
            room: 1.05,
            patient: 1.2,
            desk: 0.95
        };
        this.renderer.toneMappingExposure = exposures[mode] || 1.05;

        if (this.bloomPass) {
            const bloomStrengths = {
                room: 0.38,
                patient: 0.6,
                desk: 0.28
            };
            this.bloomPass.strength = bloomStrengths[mode] || 0.38;
        }
    }

    /**
     * Nettoyer les ressources
     */
    dispose() {
        if (this.composer) {
            try { this.gtaoPass?.dispose?.(); } catch (e) {}
            try { this.bloomPass?.dispose?.(); } catch (e) {}
            try { this.renderPass?.dispose?.(); } catch (e) {}
            this.composer.renderTarget1?.dispose();
            this.composer.renderTarget2?.dispose();
            this.composer = null;
        }
        if (this._envTexture) {
            this._envTexture.dispose();
            this._envTexture = null;
        }
    }
}

export function createRoomEnvironment(scene) {
    /**
     * Crée un environnement de salle d'hôpital avec détails atmosphériques
     */

    // Fog doux pour la profondeur
    scene.fog = new THREE.FogExp2(0x94a9b8, 0.025);

    // Plafond avec léger gradient
    // (déjà géré par three-room.js buildRoom)

    // Particules de poussière dans les rayons de lumière
    const dustCount = 200;
    const dustGeom = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    const dustSizes = new Float32Array(dustCount);

    for (let i = 0; i < dustCount; i++) {
        dustPositions[i * 3] = (Math.random() - 0.5) * 8;
        dustPositions[i * 3 + 1] = Math.random() * 3 + 0.5;
        dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 6;
        dustSizes[i] = Math.random() * 0.03 + 0.01;
    }

    dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    dustGeom.setAttribute('size', new THREE.BufferAttribute(dustSizes, 1));

    const dustMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.02,
        transparent: true,
        opacity: 0.15,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const dustParticles = new THREE.Points(dustGeom, dustMat);
    dustParticles.name = 'DustParticles';
    scene.add(dustParticles);
}
