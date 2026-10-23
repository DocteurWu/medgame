import * as THREE from 'three';
import { ROOM, WINDOW } from './three-room.js';

/**
 * Opérateur de tone mapping de la salle.
 *
 * `NeutralToneMapping` (Khronos PBR Neutral) plutôt qu'ACES : ACES vire les
 * blancs au jaune et sature les couleurs vives — or une salle d'hôpital est
 * faite de blancs (draps, murs, blouses) dont la justesse est précisément ce
 * qui la rend crédible. Neutral garde les couleurs de base intactes jusqu'aux
 * hautes lumières, puis les compresse doucement.
 */
const TONE_MAPPING = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping;

/**
 * Scène-sonde de la salle pour l'IBL : une boîte aux dimensions et aux
 * teintes de la pièce, vue depuis le centre à hauteur de poitrine, avec les
 * six dalles LED et la fenêtre comme seules surfaces lumineuses.
 *
 * Tout est en `MeshBasicMaterial` (couleurs « déjà éclairées ») : la sonde ne
 * contient aucune lumière, elle est rendue une seule fois par PMREM.
 * @param {boolean} night
 */
function buildRoomProbeScene(night) {
    const s = new THREE.Scene();
    const probeY = 1.2; // la sonde est à l'origine : on décale la pièce
    const W = ROOM.width, L = ROOM.length, H = ROOM.height;
    const k = night ? 0.6 : 1;
    const c = (hex, m = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(m * k), side: THREE.BackSide });
    // Ordre des faces d'une BoxGeometry : +x, -x, +y, -y, +z, -z.
    const room = new THREE.Mesh(new THREE.BoxGeometry(W, H, L), [
        c('#c9c8c2', 0.85),   // mur droit (côté fenêtre)
        c('#c9c8c2', 0.7),    // mur gauche
        c('#d8d7d2', 0.75),   // plafond
        c('#9a9890', 0.8),    // sol (gris chaud : c'est lui qui éclaire le plafond)
        c('#c9c8c2', 0.7),    // mur avant
        c('#c9c8c2', 0.72)    // mur du fond
    ]);
    room.position.y = H / 2 - probeY;
    s.add(room);

    // Bandeau vert d'eau des protections murales (bas des murs).
    const band = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, 0.95, L - 0.02),
        new THREE.MeshBasicMaterial({ color: new THREE.Color('#b0bfba').multiplyScalar(0.7 * k), side: THREE.BackSide }));
    band.position.y = 0.475 - probeY + 0.01;
    s.add(band);

    // Dalles LED : les vraies sources de la pièce, très au-dessus de 1.
    const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fbfcff').multiplyScalar(night ? 7 : 9), side: THREE.DoubleSide });
    for (const [x, z] of [[-3, -2.1], [-3, 1.5], [0, -2.1], [0, 1.5], [3, -2.1], [3, 1.5]]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 0.56), ledMat);
        p.rotation.x = Math.PI / 2;
        p.position.set(x, H - 0.01 - probeY, z);
        s.add(p);
    }

    // Fenêtre : ciel lumineux le jour, bleu nuit la nuit.
    const winH = WINDOW.top - WINDOW.sill;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(WINDOW.width, winH),
        new THREE.MeshBasicMaterial({ color: night ? new THREE.Color('#1a2742').multiplyScalar(0.6) : new THREE.Color('#dfeaf5').multiplyScalar(6), side: THREE.DoubleSide }));
    win.rotation.y = -Math.PI / 2;
    win.position.set(W / 2 - 0.02, (WINDOW.top + WINDOW.sill) / 2 - probeY, WINDOW.centerZ);
    s.add(win);
    return s;
}


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
        //
        // Ces valeurs sont celles de la GARDE DE NUIT : ambiance froide et
        // discrète. `applyTimeOfDay()` les re-teinte le jour, sans créer ni
        // retirer de source (aucune recompilation de shader).
        const ambientLight = new THREE.AmbientLight('#7d93b8', 0.13);
        this.scene.add(ambientLight);
        this.ambientLight = ambientLight;

        // 2. Lumière hémisphérique (ciel froid de nuit / rebond sombre du sol)
        const hemiLight = new THREE.HemisphereLight('#8fa8c8', '#2b3340', 0.22);
        hemiLight.position.set(0, ROOM.height, 0);
        this.scene.add(hemiLight);
        this.hemiLight = hemiLight;

        // 3. Soleil (le jour) / lueur de la ville (la nuit), par la fenêtre.
        //
        // Elle est ALIGNÉE sur l'ouverture réelle du mur droit : le mur et le
        // plafond portent ombre, donc seule la lumière qui passe par la
        // fenêtre atteint le sol — et y dessine la fenêtre, store compris.
        // C'est l'indice de réalisme le plus fort de la pièce, et il ne coûte
        // aucune source de plus (c'était déjà la lumière qui projetait l'ombre).
        const keyLight = new THREE.DirectionalLight('#7fa6ff', 0.42);
        const sunTarget = new THREE.Vector3(0.2, 0.6, -1.4);
        const sunDir = new THREE.Vector3(0.815, 0.56, 0.153).normalize();
        keyLight.position.copy(sunTarget).addScaledVector(sunDir, 14);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(this.quality.shadowSize, this.quality.shadowSize);
        keyLight.shadow.camera.near = 4;
        keyLight.shadow.camera.far = 26;
        // Le cadre d'ombre couvre TOUTE la pièce : un coin qui en sortait
        // n'avait plus d'ombre, donc recevait le soleil à travers le mur.
        keyLight.shadow.camera.left = -7.6;
        keyLight.shadow.camera.right = 7.6;
        keyLight.shadow.camera.top = 7.2;
        keyLight.shadow.camera.bottom = -7.2;
        keyLight.shadow.bias = -0.0004;
        keyLight.shadow.normalBias = 0.03;
        keyLight.shadow.radius = 3; // pénombre douce du soleil voilé
        keyLight.target.position.copy(sunTarget);
        this.scene.add(keyLight.target);
        this.scene.add(keyLight);
        this.keyLight = keyLight;
        keyLight.userData.baseIntensity = 0.42;

        // 4. Diffusion de la fenêtre : le ciel qui entre et éclaire le lit.
        const windowFill = new THREE.PointLight('#5f8dff', 0.85, 7, 1.5);
        windowFill.position.set(4.6, 1.75, -2.4);
        this.scene.add(windowFill);
        this.windowFillLight = windowFill;

        // 5. Spot scialytique d'examen médical au-dessus du lit patient (x = 4.7, z = 0.2)
        //    C'est la lampe d'examen du médecin : locale, chaude, et c'est elle
        //    qui éclaire le patient.
        const examSpot = new THREE.SpotLight('#fff4e2', 1.05, 6, Math.PI / 4.5, 0.6, 1.2);
        examSpot.position.set(4.45, ROOM.height - 0.08, 0.15);
        examSpot.target.position.set(4.7, 0.9, 0.15);
        examSpot.castShadow = false; // Évite de doubler le coût de shadow map
        this.scene.add(examSpot.target);
        this.scene.add(examSpot);
        this.examSpotLight = examSpot;
        examSpot.userData.baseIntensity = 1.05;

        // 6. Plafonnier LED — UNE SEULE source ponctuelle, au centre du plafond.
        //
        // CHANGEMENT VOLONTAIRE ET MESURÉ. La version précédente en posait deux,
        // plus deux « rebonds » de radiosité simulée — invisibles à l'œil, mais
        // payés dans la longueur de CHAQUE programme de shader de la scène
        // (23,7 s de `gl.getProgramInfoLog()` mesurées à l'initialisation).
        //
        // Les six dalles LED visibles au plafond (ThreeEnvironmentAgent) ne sont
        // pas des sources : leur lumière est portée par cette source, par
        // l'ambiante et surtout par l'IBL de la salle (voir `_setupEnvironment`),
        // qui contient ces dalles — donc éclaire depuis le plafond, gratuitement.
        this.pointLights = [];
        this.pointLights.push(this._addPointLight(0, 2.7, -0.3, '#eef4ff', 0.95, 11));

        // 7. Halo de l'écran MED-OS sur le bureau et le visage du médecin
        const instLight = new THREE.PointLight(0x38bdf8, 0.55, 2.2);
        instLight.position.set(-3.55, 1.18, -0.55);
        instLight.userData.baseIntensity = 0.55;
        this.scene.add(instLight);
        this.instLight = instLight;
        // Modulé par `setClinicalMood` comme les autres.
        this.pointLights.push(instLight);

        // Les anciens « rebonds » de radiosité simulée ont été supprimés ; le
        // tableau est conservé vide pour ne pas casser les appelants.
        this.bounceLights = [];

        // Configuration colorimétrique globale du renderer
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = TONE_MAPPING;
        // Exposition de garde de nuit : sans ça, le haut des murs reste
        // éclairé comme en plein jour et la pièce ne « prend » pas.
        this.renderer.toneMappingExposure = 0.92;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this._exposureScale = 0.88;
        const mode = ThreeLightingAgent.isNightNow() ? 'night' : 'day';
        this._setupEnvironment(mode);
        // La salle suit l'heure du joueur : consultation de jour, garde de
        // nuit après 21 h. Les valeurs ci-dessus sont celles de la nuit ;
        // le jour RE-TEINTE les mêmes sources (aucune source ajoutée).
        this.applyTimeOfDay(mode);
    }

    /** Vrai entre 21 h et 7 h, heure locale du joueur. */
    static isNightNow(date = new Date()) {
        // Forçage par l'URL (`?heure=jour` / `?heure=nuit`) : pour montrer la
        // salle de jour pendant un cours du soir, ou pour la tester.
        try {
            const forced = new URLSearchParams(globalThis.location?.search || '').get('heure');
            if (forced === 'jour') return false;
            if (forced === 'nuit') return true;
        } catch (e) { /* hors navigateur */ }
        const h = date.getHours();
        return h < 7 || h >= 21;
    }

    /**
     * Applique l'éclairage de jour ou de garde de nuit.
     *
     * Le jour : lumière du ciel par la fenêtre (directionnelle chaude),
     * dalle LED neutre, ambiance claire, IBL et exposition relevés. Rien
     * n'est créé ni retiré : on change couleurs et intensités des MÊMES
     * sources, donc aucun shader n'est recompilé (voir AGENTS.md,
     * « Performance 3D », règle c).
     * @param {'day'|'night'} [mode]
     */
    applyTimeOfDay(mode = ThreeLightingAgent.isNightNow() ? 'night' : 'day') {
        this.timeOfDay = mode;
        if (mode !== 'day') return; // la nuit est la configuration d'origine
        const set = (light, color, intensity) => {
            if (!light) return;
            light.color.set(color);
            light.intensity = intensity;
            light.userData.baseIntensity = intensity;
        };
        // Le jour, l'essentiel de la lumière diffuse vient de l'IBL de la salle
        // (dalles LED + fenêtre) : l'ambiante et l'hémisphérique ne font que
        // déboucher les ombres, sinon tout s'aplatit.
        set(this.ambientLight, '#f1f2ef', 0.12);
        if (this.hemiLight) {
            this.hemiLight.color.set('#f4f6f7');
            this.hemiLight.groundColor.set('#a9a69c');
            this.hemiLight.intensity = 0.35;
        }
        set(this.keyLight, '#fff0d8', 2.6);        // soleil d'après-midi par la fenêtre
        set(this.windowFillLight, '#e4eef8', 0.9); // ciel diffus
        set(this.examSpotLight, '#fff7ec', 1.6);
        if (this.pointLights[0]) set(this.pointLights[0], '#f6f8fa', 1.5); // plafonnier LED
        set(this.instLight, '#d8e6f5', 0.12);      // l'écran du bureau, discret de jour
        if ('environmentIntensity' in this.scene) this.scene.environmentIntensity = 0.95;
        this._exposureScale = 0.92;
        this.renderer.toneMappingExposure = 0.92;
    }

    _setupEnvironment(mode = 'night') {
        try {
            const pmrem = new THREE.PMREMGenerator(this.renderer);
            pmrem.compileEquirectangularShader();
            // IBL construit depuis la SALLE ELLE-MÊME, et non `RoomEnvironment`.
            //
            // `RoomEnvironment` est la pièce générique de three.js (des boîtes
            // grises, des néons au hasard) : les reflets du sol, de l'inox et des
            // vitres montraient une autre pièce que celle où l'on est. Ici, la
            // sonde voit nos murs, nos six dalles LED et notre fenêtre : le sol
            // ciré reflète les dalles au bon endroit, la lumière diffuse vient du
            // plafond, et le côté fenêtre est plus clair. Le coût est identique —
            // un cubemap préfiltré, calculé UNE fois, échantillonné dans le shader.
            const envScene = buildRoomProbeScene(mode === 'night');
            this._envTexture = pmrem.fromScene(envScene, 0.02, 0.05, 30).texture;
            this.scene.environment = this._envTexture;
            if ('environmentIntensity' in this.scene) {
                // En garde de nuit, il est baissé : c'est lui qui décide si la
                // pièce est éclairée comme un plateau technique ou comme une
                // consultation à 2 h du matin.
                this.scene.environmentIntensity = 0.42;
            }
            envScene.traverse?.(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
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
        this.renderer.toneMappingExposure = (exposures[mode] ?? 1.06) * (this._exposureScale ?? 1);

        // Renforce le spot d'examen lorsque la caméra est sur le lit du patient
        if (this.examSpotLight) {
            const base = this.examSpotLight.userData.baseIntensity ?? 1.05;
            this.examSpotLight.intensity = base * ((mode === 'patient' || mode === 'anatomy') ? 1.45 : 1.0);
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
        const keyBase = this.keyLight.userData.baseIntensity ?? this.keyLight.intensity;
        const spotBase = this.examSpotLight?.userData.baseIntensity ?? 1.05;
        if (mood === 'negatoscope') {
            // Tamise la pièce pour examiner une radiographie
            scalePointLights(0.30);
            this.keyLight.intensity = keyBase * 0.35;
        } else if (mood === 'auscultation') {
            scalePointLights(0.68);
            this.keyLight.intensity = keyBase;
            if (this.examSpotLight) this.examSpotLight.intensity = spotBase * 1.6;
        } else if (mood === 'urgence') {
            scalePointLights(1.25);
            this.keyLight.intensity = keyBase;
            if (this.examSpotLight) this.examSpotLight.intensity = spotBase * 1.8;
        } else {
            scalePointLights(1.0);
            this.keyLight.intensity = keyBase;
            if (this.examSpotLight) this.examSpotLight.intensity = spotBase;
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
