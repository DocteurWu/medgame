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
    }

    /**
     * Configure l'éclairage complet de la scène clinique
     */
    setupLighting() {
        // Environnement — Lumière hémisphérique (ciel/sol)
        const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x8899aa, 0.8);
        this.scene.add(hemiLight);

        // Lumière principale (Key Light) — froide, directionnelle — SEULE source d'ombre
        const keyLight = new THREE.DirectionalLight(0xe8f0ff, 1.4);
        keyLight.position.set(3, 6, 4);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        keyLight.shadow.camera.near = 0.5;
        keyLight.shadow.camera.far = 20;
        keyLight.shadow.camera.left = -6;
        keyLight.shadow.camera.right = 6;
        keyLight.shadow.camera.top = 6;
        keyLight.shadow.camera.bottom = -6;
        keyLight.shadow.bias = -0.0005;
        this.scene.add(keyLight);

        // Lumière de remplissage (Fill Light) — chaude, pas d'ombre
        const fillLight = new THREE.DirectionalLight(0xffd4a0, 0.4);
        fillLight.position.set(-2, 3, -2);
        this.scene.add(fillLight);

        // Lumière d'accentuation (Rim Light) — bleue, pas d'ombre
        const rimLight = new THREE.DirectionalLight(0x4488ff, 0.5);
        rimLight.position.set(-3, 2, 5);
        this.scene.add(rimLight);

        // Lumières ponctuelles (lampes de la salle) — pas d'ombre (performances)
        // Positionnées juste sous le plafond (y=3.5) pour éclairer depuis les néons
        this._addPointLight(0, 3.35, 0, 0xffffff, 2.5, 14);
        this._addPointLight(-2.5, 3.35, -1, 0xc8d8ff, 1.0, 8);
        this._addPointLight(2.5, 3.35, -1, 0xc8d8ff, 1.0, 8);
        this._addPointLight(-2.5, 3.35, 1.5, 0xdde8ff, 0.8, 7);
        this._addPointLight(2.5, 3.35, 1.5, 0xdde8ff, 0.8, 7);

        // Lumière d'appoint sous les instruments (glow bleu)
        const instLight = new THREE.PointLight(0x44aaff, 0.6, 4);
        instLight.position.set(-0.5, 1.0, -0.8);
        this.scene.add(instLight);

        // Configuration globale du renderer
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    _addPointLight(x, y, z, color, intensity, distance) {
        const light = new THREE.PointLight(color, intensity, distance);
        light.position.set(x, y, z);
        // Pas de castShadow sur les PointLights — seul le keyLight directionnel projette des ombres
        // Cela réduit les draw calls de shadow map de 7 à 1, gain de perf majeur
        this.scene.add(light);
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