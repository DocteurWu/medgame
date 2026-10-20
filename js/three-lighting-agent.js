import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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
        this.examSpotLight = null;
        this.windowFillLight = null;
        this.pointLights = [];
        this.hemiLight = null;
        this.bounceLights = [];
        this._envTexture = null;

        this.quality = {
            msaa: 0,
            gtao: false,
            bloom: false,
            shadowSize: 2048, // Haute définition pour netteté des instruments sur le bureau
            gtaoRadius: 0.5,
            gtaoSamples: 8
        };
    }

    setupLighting() {
        // 1. Lumière ambiante de base (légèrement bleutée dans les ombres profondes)
        const ambientLight = new THREE.AmbientLight('#cbd5e1', 0.30);
        this.scene.add(ambientLight);
        this.ambientLight = ambientLight;

        // 2. Lumière hémisphérique (plafond blanc clinique 4500K / rebond sol granit chaud)
        const hemiLight = new THREE.HemisphereLight('#f1f5f9', '#78716c', 0.52);
        hemiLight.position.set(0, 5, 0);
        this.scene.add(hemiLight);
        this.hemiLight = hemiLight;

        // 3. Soleil matinal (DirectionalLight 4800K) entrant par la fenêtre droite (x = +5.5)
        const keyLight = new THREE.DirectionalLight('#fff3e0', 1.55);
        keyLight.position.set(11.5, 7.2, -2.8);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(this.quality.shadowSize, this.quality.shadowSize);
        keyLight.shadow.camera.near = 3;
        keyLight.shadow.camera.far = 24;
        keyLight.shadow.camera.left = -6.2;
        keyLight.shadow.camera.right = 6.2;
        keyLight.shadow.camera.top = 5.5;
        keyLight.shadow.camera.bottom = -5.5;
        keyLight.shadow.bias = -0.00015;
        keyLight.shadow.normalBias = 0.022;
        keyLight.shadow.radius = 2.2; // Adoucit les pénombres PCFSoft
        keyLight.target.position.set(-0.5, 0.8, -0.2);
        this.scene.add(keyLight.target);
        this.scene.add(keyLight);
        this.keyLight = keyLight;

        // 4. Diffusion zénithale de la fenêtre (Sky portal fill)
        const windowFill = new THREE.PointLight('#e0f2fe', 0.55, 10, 1.5);
        windowFill.position.set(4.8, 2.6, -0.5);
        this.scene.add(windowFill);
        this.windowFillLight = windowFill;

        // 5. Spot scialytique d'examen médical au-dessus du lit patient (x = 4.7, z = 0.2)
        const examSpot = new THREE.SpotLight('#f8fafc', 1.15, 7.5, Math.PI / 5.5, 0.55, 1.2);
        examSpot.position.set(4.4, 4.6, 0.2);
        examSpot.target.position.set(4.7, 0.85, 0.2);
        examSpot.castShadow = false; // Évite de doubler le coût de shadow map
        this.scene.add(examSpot.target);
        this.scene.add(examSpot);
        this.examSpotLight = examSpot;

        // 6. Dalle LED plafonnière — UNE SEULE, au centre du plafond.
        //
        // CHANGEMENT VOLONTAIRE ET MESURÉ. La version précédente en posait deux
        // (-2.6 et +2.4), plus deux « rebonds » de radiosité simulée à 0.16-0.18
        // d'intensité — invisibles à l'œil, mais payées à CHAQUE pixel de CHAQUE
        // matériau de la scène, et surtout dans la longueur de chaque shader :
        // six `PointLight` significaient six blocs de calcul d'éclairage en plus
        // dans chacun des dizaines de programmes de la scène. Effet mesuré sur le
        // profil CPU d'initialisation : 23,7 s passées dans
        // `gl.getProgramInfoLog()`, c'est-à-dire dans la compilation des shaders.
        //
        // Trois sources ponctuelles au lieu de six suffisent à éclairer la pièce,
        // à condition de rééquilibrer l'ambiante et l'IBL (voir plus bas) — tous
        // deux gratuits, puisqu'ils ne sont pas dans la boucle par pixel.
        this.pointLights = [];
        this.pointLights.push(this._addPointLight(0, 4.4, -0.4, '#f8fafc', 0.72, 11));

        // 7. Halo de l'écran MED-OS sur le bureau et le visage du médecin
        const instLight = new THREE.PointLight(0x38bdf8, 0.30, 2.2);
        instLight.position.set(-3.55, 1.18, -0.55);
        instLight.userData.baseIntensity = 0.30;
        this.scene.add(instLight);
        this.instLight = instLight;
        // Modulé par `setClinicalMood` comme les autres.
        this.pointLights.push(instLight);

        // Les anciens « rebonds » de radiosité simulée ont été supprimés : leur
        // intensité (0.16-0.18) était sous le seuil de visibilité, et l'IBL
        // ci-dessous remplit le même rôle pour une fraction du coût. Le tableau
        // est conservé vide pour ne pas casser les appelants qui le parcourent.
        this.bounceLights = [];

        // Configuration colorimétrique globale du renderer
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.06;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this._setupEnvironment();
    }

    _setupEnvironment() {
        try {
            const pmrem = new THREE.PMREMGenerator(this.renderer);
            pmrem.compileEquirectangularShader();
            const envScene = new RoomEnvironment();
            this._envTexture = pmrem.fromScene(envScene, 0.035).texture;
            this.scene.environment = this._envTexture;
            if ('environmentIntensity' in this.scene) {
                // Relevé après la suppression des rebonds de radiosité simulée :
                // l'IBL est un simple échantillonnage de cubemap dans le shader,
                // pas une source dans la boucle d'éclairage par pixel. C'est donc
                // le moyen le moins cher de rendre la restitution que donnaient
                // les `PointLight` supprimées.
                this.scene.environmentIntensity = 0.9;
            }
            envScene.traverse?.(o => o.geometry?.dispose?.());
            pmrem.dispose();
        } catch (e) {
            console.warn('[LightingAgent] Environnement IBL non disponible:', e);
        }
    }

    _addPointLight(x, y, z, color, intensity, distance) {
        const light = new THREE.PointLight(color, intensity, distance, 1.6);
        light.position.set(x, y, z);
        light.userData.baseIntensity = intensity;
        this.scene.add(light);
        return light;
    }

    /**
     * Adapte l'exposition et la focalisation lumineuse selon l'angle caméra actif
     */
    setCameraExposure(mode) {
        if (!this.renderer) return;
        const exposures = {
            room: 1.06,
            patient: 1.12,
            desk: 1.04,
            cabinet: 1.08,
            anatomy: 1.10,
            fps: 1.06,
        };
        this.renderer.toneMappingExposure = exposures[mode] ?? 1.06;

        // Renforce le spot d'examen lorsque la caméra est sur le lit du patient
        if (this.examSpotLight) {
            this.examSpotLight.intensity = (mode === 'patient' || mode === 'anatomy') ? 1.55 : 1.10;
        }

        if (this.bloomPass) {
            const bloomStrengths = {
                room: 0.25,
                patient: 0.32,
                desk: 0.25
            };
            this.bloomPass.strength = bloomStrengths[mode] || 0.25;
        }
    }

    /**
     * Permet à MedGameEngine de changer l'ambiance lumineuse selon l'action clinique
     * @param {'normal'|'auscultation'|'negatoscope'|'urgence'} mood
     */
    setClinicalMood(mood = 'normal') {
        if (!this.keyLight) return;
        // Les intensités sont appliquées comme un RATIO de l'intensité de base de
        // chaque lumière (`userData.baseIntensity`). Écrire des valeurs fixes
        // rendait la fonction silencieusement fausse dès que le nombre de
        // `PointLight` changeait — ce qui est arrivé en passant de six à trois.
        const scalePointLights = (k) => {
            for (const l of this.pointLights) l.intensity = (l.userData.baseIntensity ?? 0) * k;
        };
        if (mood === 'negatoscope') {
            // Tamise la pièce pour examiner une radiographie
            scalePointLights(0.30);
            this.keyLight.intensity = 0.55;
        } else if (mood === 'auscultation') {
            scalePointLights(0.68);
            if (this.examSpotLight) this.examSpotLight.intensity = 1.75;
        } else if (mood === 'urgence') {
            scalePointLights(1.25);
            if (this.examSpotLight) this.examSpotLight.intensity = 1.9;
        } else {
            scalePointLights(1.0);
            this.keyLight.intensity = 1.55;
            if (this.examSpotLight) this.examSpotLight.intensity = 1.15;
        }
    }

    /**
     * Applique les réglages qualité (appelé par ThreeQualityAgent).
     * @param {Object} q — { msaa, gtao, bloom, shadowSize, gtaoRadius, gtaoSamples }
     */
    setQualitySettings(q = {}) {
        Object.assign(this.quality, q);

        if (this.keyLight) {
            const size = this.quality.shadowSize || 2048;
            if (this.keyLight.shadow.mapSize.x !== size) {
                this.keyLight.shadow.mapSize.set(size, size);
                if (this.keyLight.shadow.map) {
                    this.keyLight.shadow.map.dispose();
                    this.keyLight.shadow.map = null;
                }
            }
        }

        if (typeof this.quality.softShadows === 'boolean') {
            const wanted = this.quality.softShadows ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
            if (this.renderer.shadowMap.type !== wanted) {
                this.renderer.shadowMap.type = wanted;
                this.renderer.shadowMap.needsUpdate = true;
            }
        }

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

        if (!this.quality.gtao && !this.quality.bloom && this.composer) {
            this.teardownComposer();
        }
    }

    /**
     * Configure le post-processing complet :
     * RenderPass (MSAA HalfFloat) → GTAO (occlusion ambiante) → Bloom → OutputPass.
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
                    this.composer.addPass(this.gtaoPass);
                } catch (e) {
                    console.warn('[LightingAgent] GTAO indisponible:', e);
                    this.gtaoPass = null;
                }
            }

            if (this.quality.bloom) {
                const bloomPassMod = await import('three/addons/postprocessing/UnrealBloomPass.js');
                const { UnrealBloomPass } = bloomPassMod;
                this.bloomPass = new UnrealBloomPass(
                    new THREE.Vector2(width, height),
                    0.3,
                    0.35,
                    0.92
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
        if (this.scene._camera) return this.scene._camera;
        if (this.scene.userData?.camera) return this.scene.userData.camera;
        return null;
    }

    needsRebuild(msaa) {
        return !!this.composer && (this._builtMsaa || 0) !== (msaa || 0);
    }

    teardownComposer() {
        if (this.composer) {
            try { this.gtaoPass?.dispose?.(); } catch (e) {}
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

    resize(width, height) {
        if (!this.composer) return;
        this.composer.setPixelRatio(this.renderer.getPixelRatio());
        this.composer.setSize(width, height);
    }

    render() {
        if (this.composer) {
            this.composer.render();
            return true;
        }
        return false;
    }

    dispose() {
        this.teardownComposer();
        if (this._envTexture) {
            this._envTexture.dispose();
            this._envTexture = null;
        }
    }
}
