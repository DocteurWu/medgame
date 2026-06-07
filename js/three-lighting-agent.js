/**
 * three-lighting-agent.js — Agent d'éclairage avancé
 * HDR, ombres dynamiques, post-processing (bloom, SSAO, tone mapping)
 */

import * as THREE from 'three';

export class ThreeLightingAgent {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.composer = null;
        this.bloomPass = null;
        this.theme = 'dark';
        this.ambientLight = null;
        this.keyLight = null;
        this.pointLights = [];
    }

    /**
     * Configure l'éclairage complet de la scène clinique
     */
    setupLighting() {
        // Environnement — Lumière ambiante douce (ciel)
        const ambientLight = new THREE.AmbientLight('#7a8b9e', 0.18);
        this.scene.add(ambientLight);
        this.ambientLight = ambientLight;

        // Lumière principale (Sun Light) venant de la fenêtre cinématique
        const keyLight = new THREE.DirectionalLight('#fed7aa', 1.8);
        keyLight.position.set(12, 8, 2);
        keyLight.castShadow = false; // Désactiver l'ombre portée pour supprimer la bande noire
        this.scene.add(keyLight);
        this.keyLight = keyLight;

        // Lumières ponctuelles (lampes de la salle sous le plafond y=5.0) — plus douces
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

        // Configuration globale du renderer
        this.renderer.shadowMap.enabled = false; // Désactivation globale des ombres dures
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    _addPointLight(x, y, z, color, intensity, distance) {
        const light = new THREE.PointLight(color, intensity, distance);
        light.position.set(x, y, z);
        this.scene.add(light);
        return light;
    }

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme();
        return this.theme;
    }

    applyTheme() {
        const isDark = this.theme !== 'light';
        const bgColor = isDark ? 0x2d3135 : 0xf1f5f9;

        // Background & Fog
        if (this.scene) {
            this.scene.background.set(bgColor);
            if (this.scene.fog) {
                this.scene.fog.color.set(bgColor);
            }
        }

        // Ambient Light
        if (this.ambientLight) {
            this.ambientLight.color.set(isDark ? '#7a8b9e' : '#e0f2fe');
            this.ambientLight.intensity = isDark ? 0.18 : 0.85;
        }

        // Key Light
        if (this.keyLight) {
            this.keyLight.color.set(isDark ? '#fed7aa' : '#fffbeb');
            this.keyLight.intensity = isDark ? 1.8 : 1.0;
        }

        // Ceiling Point Lights
        if (this.pointLights) {
            this.pointLights.forEach(light => {
                light.color.set(isDark ? '#f8fafc' : '#ffffff');
                light.intensity = isDark ? 0.28 : 0.8;
            });
        }

        // Standing floor lamp warm light
        if (this.wallLampLight) {
            this.wallLampLight.intensity = isDark ? 2.8 : 1.2;
        }

        // Blue laser light
        if (this.blueLaserLight) {
            this.blueLaserLight.intensity = isDark ? 2.2 : 0.8;
        }

        // Instruments glow light
        if (this.instLight) {
            this.instLight.intensity = isDark ? 0.35 : 0.15;
        }

        // Volumetric sunlight ray
        const shaft = this.scene.getObjectByName('VolumetricSunlightRay');
        if (shaft && shaft.material) {
            shaft.material.opacity = isDark ? 0.075 : 0.02;
        }
    }

    /**
     * Configure le post-processing (Bloom, FXAA, etc.)
     */
    setupPostProcessing() {
        // N'a besoin de composer que si on veut du bloom
        // Pour les navigateurs moins puissants, on peut le désactiver
        const pixelRatio = this.renderer.getPixelRatio();
        if (pixelRatio > 1.5) {
            this._setupBloomComposer();
        }
    }

    async _setupBloomComposer() {
        try {
            const postprocessing = await import('three/addons/postprocessing/EffectComposer.js');
            const renderPassMod = await import('three/addons/postprocessing/RenderPass.js');
            const bloomPassMod = await import('three/addons/postprocessing/UnrealBloomPass.js');
            const outputPassMod = await import('three/addons/postprocessing/OutputPass.js');

            const { EffectComposer } = postprocessing;
            const { RenderPass } = renderPassMod;
            const { UnrealBloomPass } = bloomPassMod;
            const { OutputPass } = outputPassMod;

            this.composer = new EffectComposer(this.renderer);

            const renderPass = new RenderPass(this.scene, this._getActiveCamera());
            this.composer.addPass(renderPass);

            // Bloom — valeurs douces pour un rendu médical
            this.bloomPass = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.6,  // strength
                0.3,  // radius
                0.85  // threshold
            );
            this.composer.addPass(this.bloomPass);

            const outputPass = new OutputPass();
            this.composer.addPass(outputPass);
        } catch (e) {
            console.warn('[LightingAgent] Post-processing non disponible:', e);
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
            room: 1.0,
            patient: 1.2,
            desk: 0.9
        };
        this.renderer.toneMappingExposure = exposures[mode] || 1.0;

        if (this.bloomPass) {
            const bloomStrengths = {
                room: 0.5,
                patient: 0.8,
                desk: 0.3
            };
            this.bloomPass.strength = bloomStrengths[mode] || 0.5;
        }
    }

    /**
     * Nettoyer les ressources
     */
    dispose() {
        if (this.composer) {
            this.composer.renderTarget1.dispose();
            this.composer.renderTarget2.dispose();
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