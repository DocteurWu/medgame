/**
 * three-quality-agent.js — Agent de qualité graphique adaptative
 * Détection GPU heuristique, presets Low/Medium/High/Ultra/GpuHigh,
 * résolution dynamique (downscale si FPS bas), persistance localStorage,
 * bouton HUD pour cycler les presets.
 *
 * PRINCIPES (performance) :
 * - Le post-processing est un coût différentiel de 2 à 4× le coût de la scène.
 *   Il n'est construit qu'après un premier frame stable, jamais pendant le
 *   chargement, et par défaut les presets ne l'utilisent pas.
 * - Un preset choisi manuellement est persisté ; un preset auto-détecté ne
 *   l'est PAS, pour que le matériel suivant soit re-détecté correctement.
 * - La détection est conservatrice à l'aller (doute → on descend d'un cran) et
 *   automatique à la remontée : si le nom du GPU est illisible, on démarre bas
 *   et `sample()` monte d'un cran dès que la cadence le prouve justifié.
 */

import { TaskScheduler } from './task-scheduler.js';

const STORAGE_KEY = 'medgame_3d_quality';

/**
 * Délai avant construction du composer. Pendant ce temps la scène rend
 * directement (chemin le plus rapide) : le joueur voit la salle immédiatement
 * au lieu d'un écran figé pendant la compilation des shaders GTAO.
 */
const COMPOSER_DELAY_MS = 2500;

export const QUALITY_ORDER = ['low', 'medium', 'high', 'ultra', 'gpu-high'];

/**
 * Échelle de rendu. `gtao` est réservé à `gpu-high` : GTAOPass rend la scène
 * une seconde fois (override normal + profondeur) avant l'AO, ce qui double
 * le coût géométrique de chaque frame.
 */
export const QUALITY_PRESETS = {
    low: {
        label: 'Basse',
        pixelRatio: 1.0,
        msaa: 0,
        gtao: false,
        bloom: false,
        shadowSize: 512,
        // BasicShadowMap = 1 échantillon par pixel. PCFSoft en fait plusieurs
        // dizaines : sur un preset bas, c'est le poste le plus lourd de la passe
        // d'ombres pour un gain quasi invisible à cette définition.
        softShadows: false,
        shadowInterval: 0.25,
        dust: false,
        gtaoRadius: 0.5,
        gtaoSamples: 8
    },
    medium: {
        label: 'Moyenne',
        pixelRatio: 1.0,
        msaa: 0,
        gtao: false,
        bloom: false,
        shadowSize: 1024,
        softShadows: true,
        shadowInterval: 0.15,
        dust: false,
        gtaoRadius: 0.5,
        gtaoSamples: 8
    },
    high: {
        label: 'Haute',
        pixelRatio: 1.25,
        msaa: 2,
        gtao: false,
        bloom: false,
        shadowSize: 1024,
        softShadows: true,
        shadowInterval: 0.1,
        dust: true,
        gtaoRadius: 0.6,
        gtaoSamples: 10
    },
    ultra: {
        label: 'Ultra',
        pixelRatio: 1.5,
        msaa: 4,
        gtao: false,
        bloom: true,
        shadowSize: 2048,
        softShadows: true,
        shadowInterval: 0.1,
        dust: true,
        gtaoRadius: 0.8,
        gtaoSamples: 14
    },
    'gpu-high': {
        label: 'GPU Extreme',
        pixelRatio: 2.0,
        msaa: 4,
        gtao: true,
        bloom: true,
        shadowSize: 2048,
        softShadows: true,
        shadowInterval: 0.05,
        dust: true,
        gtaoRadius: 0.8,
        gtaoSamples: 24
    }
};

/** Motifs de GPU intégrés / logiciels qui doivent rester sur un preset bas. */
const INTEGRATED_GPU = /intel|uhd graphics|hd graphics|iris|iris plus|arc graphics|vega ?[0-9]|radeon hd|radeon(tm)? graphics|apple m[1-9]|apple gpu|mali|adreno|powervr|llvmpipe|softwarerasterizer|microsoft basic|swiftshader|mesa offscreen|virgl|panfrost/i;

/** GPU discrets haut de gamme : autorisent GTAO + bloom. */
const HIGH_END_GPU = /rtx (30[7-9]0|40[7-9]0|50[7-9]0|6[0-9]0)|titan|a100|h100|radeon rx (6|7|9)\d{3}|arc (a|b)7[05-9]0/i;

/** GPU discrets corrects : `high` (sans GTAO). */
const DEDICATED_GPU = /rtx|gtx|geforce|radeon rx|quadro|tesla|arc a/i;

export class ThreeQualityAgent {
    /**
     * @param {Object} scene3d — instance ThreeScene (renderer, lightingAgent, environmentAgent…)
     */
    constructor(scene3d) {
        this.scene3d = scene3d;
        this.presetName = 'low';
        this.resScale = 1;              // multiplicateur dynamique 0.65 à 1
        this.basePixelRatio = 1;
        this._fpsEma = 60;
        this._lastAdjust = 0;
        this._goodSince = 0;
        this._startTime = performance.now();
        this._boundClick = null;
        // Paliers de dégradation couplés (au-delà de la simple résolution) :
        // 0 = plein preset, 1 = GTAO allégé, 2 = ombres 512 + bloom off,
        // 3 = post-processing désactivé (composer détruit)
        this._degradeLevel = 0;
        // Le composer ne doit pas être construit pendant le chargement :
        // `apply()` respecte ce verrou, `cycle()` (action utilisateur) le lève.
        this._composerAllowed = false;
        this._composerTimer = null;
        this._disposed = false;
        // Palier plafond au-delà duquel on ne monte pas tout seul. Voir
        // `detectTier()` : sans nom de GPU lisible, on ne justifie ni GTAO ni
        // le pixelRatio 2.
        this._ceiling = QUALITY_ORDER[QUALITY_ORDER.length - 1];
        // Vrai tant que le preset vient de la détection, et non d'un clic :
        // en auto, on ajuste en montée comme en descente.
        this._autoMode = true;
        this._emaSamples = 0;
    }

    /**
     * Heuristique de capacité GPU/CPU pour choisir le preset initial.
     * Inspecte le GPU réel via WebGL (UNMASKED_RENDERER_WEBGL, maxTextureSize,
     * maxSamples) et ne crash jamais (catch → 'low').
     *
     * Conservatrice par conception : le coût d'un mauvais choix est le pire
     * ici (60 fps → 15 fps), alors que celui d'un preset trop bas est indolore.
     */
    detectTier() {
        try {
            const renderer = this.scene3d?.renderer;
            const gl = renderer?.getContext?.();
            const isWebGL2 = Boolean(renderer?.capabilities?.isWebGL2);
            const cores = navigator.hardwareConcurrency || 4;
            const mem = navigator.deviceMemory || 4; // Go
            if (!gl || !isWebGL2) return 'low';

            let unmaskedRenderer = '';
            const dbg = gl.getExtension('WEBGL_debug_renderer_info');
            if (dbg) {
                unmaskedRenderer = (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
            }
            const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
            const maxSamples = gl.getParameter(gl.MAX_SAMPLES) || 0;

            // Rendu logiciel (VM, driver générique, navigateur sans GPU) : `low`
            // quoi qu'il arrive. On plafonne aussi la montée automatique : même
            // sur une machine potentielle en ressources, un rasteriseur logiciel
            // ne ratavera jamais le palier supérieur.
            if (/swiftshader|llvmpipe|software|basic render|microsoft basic/.test(unmaskedRenderer)) {
                this._ceiling = 'low';
                return 'low';
            }

            // GPU intégré : le shared memory et la bande passante mémoire limitent
            // le fill rate bien plus que le nombre de cœurs. jamais `high`.
            if (INTEGRATED_GPU.test(unmaskedRenderer)) {
                this._ceiling = 'high';
                return 'medium';
            }

            if (HIGH_END_GPU.test(unmaskedRenderer) && maxTextureSize >= 16384 && maxSamples >= 4) {
                this._ceiling = 'gpu-high';
                return 'gpu-high';
            }

            if (DEDICATED_GPU.test(unmaskedRenderer) && maxTextureSize >= 8192 && cores >= 6 && mem >= 6) {
                this._ceiling = 'high';
                return 'high';
            }

            // Nom de GPU illisible — cas réel et de plus en plus fréquent :
            // Chrome masque `WEBGL_debug_renderer_info` par défaut sur les
            // navigateurs Luckygate, et le contexte peut être fourni par une
            // couche de virtualisation. Deviner « performant » sur la seule foi
            // du nombre de cœurs est l'erreur qui fait tomber à 15 fps un
            // portable. On démarre au plus bas et `sample()` fait monter si la
            // machine le mérite vraiment.
            this._ceiling = 'high';
            return 'low';

            // GPU nommé mais non reconnu par nos motifs : on se rabat sur les
            // ressources machine, en restant prudent.
            if (cores <= 4 || mem < 4 || maxTextureSize < 4096) return 'low';
            if (cores >= 12 && mem >= 8) return 'high';
            if (cores >= 8 && mem >= 8) return 'medium';

            return 'low';
        } catch (e) {
            return 'low';
        }
    }

    /**
     * Initialise l'agent : preset sauvegardé (choix explicite de l'utilisateur)
     * sinon preset auto-détecté. Le post-processing est différé.
     */
    async init() {
        let saved = null;
        try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { /* stockage indisponible */ }
        const isUserChoice = !!saved && !!QUALITY_PRESETS[saved];

        // En auto, `detectTier()` renseigne le plafond de montée. Un choix
        // explicite de l'utilisateur fige la qualité : plus d'ajustement
        // automatique, ni en montée ni en descente.
        this._autoMode = !isUserChoice;
        this.apply(isUserChoice ? saved : this.detectTier(), { persist: isUserChoice });
        this._bindHUD();

        if (!this._composerAllowed && this.wantsComposer()) {
            this._composerTimer = setTimeout(() => {
                this._composerTimer = null;
                if (this._disposed) return;
                const la = this.scene3d?.lightingAgent;
                if (la && !la.composer) la.setupPostProcessing().catch(() => {});
            }, COMPOSER_DELAY_MS);
        }
    }

    /** Le preset courant exige-t-il le composer (GTAO ou bloom) ? */
    wantsComposer() {
        const preset = QUALITY_PRESETS[this.presetName];
        return !!(preset && (preset.gtao || preset.bloom));
    }

    /**
     * Applique un preset qualité (passes, ombres, poussières, pixel ratio).
     * @param {string} name — nom du preset
     * @param {{persist?: boolean}} [opts] — `persist: false` pour un preset
     *        auto-détecté, qui ne doit pas figer le choix dans localStorage.
     */
    apply(name, opts = {}) {
        const preset = QUALITY_PRESETS[name];
        if (!preset) return;
        this.presetName = name;
        if (opts.persist !== false) {
            try { localStorage.setItem(STORAGE_KEY, name); } catch (e) { /* stockage indisponible */ }
        }

        const la = this.scene3d.lightingAgent;
        const rebuild = la.needsRebuild(preset.msaa);
        if (rebuild) la.teardownComposer();

        la.setQualitySettings({
            msaa: preset.msaa,
            gtao: preset.gtao,
            bloom: preset.bloom,
            shadowSize: preset.shadowSize,
            softShadows: preset.softShadows,
            shadowInterval: preset.shadowInterval,
            gtaoRadius: preset.gtaoRadius,
            gtaoSamples: preset.gtaoSamples
        });

        // Particules de poussière (détail décoratif coûteux)
        const env = this.scene3d.environmentAgent;
        const dust = env?.getDustParticles?.();
        if (dust) dust.visible = !!preset.dust;
        // Le reste du décor d'ambiance suit le même palier que les poussières.
        env?.setDetailLevel?.(env.detailLevelForPreset(name));

        this.basePixelRatio = Math.min(window.devicePixelRatio || 1, preset.pixelRatio);
        this.resScale = 1;
        this._degradeLevel = 0;
        this.applyResolution();

        if (rebuild && this._composerAllowed) {
            la.setupPostProcessing().catch(() => {});
        }
        this._updateButtonTitle();
    }

    /**
     * Applique pixel ratio (preset × résolution dynamique) au renderer et au composer.
     */
    applyResolution() {
        const renderer = this.scene3d.renderer;
        if (!renderer) return;
        const pr = Math.max(0.5, this.basePixelRatio * this.resScale);
        renderer.setPixelRatio(pr);
        const w = this.scene3d.container?.clientWidth || window.innerWidth;
        const h = this.scene3d.container?.clientHeight || window.innerHeight;
        renderer.setSize(w, h);
        this.scene3d.lightingAgent?.resize(w, h);
    }

    /**
     * Passe au preset suivant (bouton HUD). Action utilisateur explicite :
     * le verrou de construction du composer est levé immédiatement pour que
     * le changement de qualité se sente à l'instant.
     */
    cycle() {
        this._composerAllowed = true;
        if (this._composerTimer) { clearTimeout(this._composerTimer); this._composerTimer = null; }
        const idx = QUALITY_ORDER.indexOf(this.presetName);
        const next = QUALITY_ORDER[(idx + 1) % QUALITY_ORDER.length];
        this.apply(next);
        return next;
    }

    /**
     * Résolution dynamique + paliers couplés : appelée chaque frame par _loop().
     * Palier 0 : downscale progressif (resScale → 0.65).
     * Palier 1 : GTAO allégé (samples 8, radius 0.5).
     * Palier 2 : ombres 512 + bloom off.
     * Palier 3 : composer détruit (rendu direct : le plus gros gain possible).
     * Remontée inverse après 8 s > 58 fps.
     * @param {number} dt — delta time en secondes
     */
    sample(dt) {
        if (this._disposed) return;
        if (!dt || dt <= 0) return;
        const now = performance.now();
        if (now - this._startTime < 2500) return; // ignorer le pic de chargement initial

        const fps = 1 / dt;
        this._emaSamples++;
        // Moyenne mobile très pondérée au départ (alpha 0,25) puis stabilisée
        // (alpha 0,05). Avec un alpha fixe à 0,05, une machine à 5 fps met
        // huit secondes à converger vers la bonne valeur — huit secondes
        // durant lesquelles on croit encore que tout va bien.
        const alpha = this._emaSamples < 120 ? 0.25 : 0.05;
        this._fpsEma += (fps - this._fpsEma) * alpha;

        if (now - this._lastAdjust < 1500) return;

        const la = this.scene3d.lightingAgent;
        const preset = QUALITY_PRESETS[this.presetName];

        // Catastrophique : on saute directement aux réglages minimaux plutôt que de
        // descendre un palier toutes les 1,5 s pendant six secondes.
        if (this._fpsEma < 20 && (this.resScale > 0.65 || this._degradeLevel > 0)) {
            this.resScale = 0.65;
            this._degradeLevel = 3;
            this.applyResolution();
            la?.setQualitySettings({ shadowSize: 512, bloom: false });
            la?.teardownComposer?.();
            this._lastAdjust = now;
            this._goodSince = 0;
            return;
        }

        if (this._fpsEma < 45) {
            if (this.resScale > 0.65) {
                this.resScale = Math.max(0.65, this.resScale - 0.1);
                this.applyResolution();
                this._lastAdjust = now;
                this._goodSince = 0;
            } else if (this._degradeLevel < 1 && preset.gtao) {
                this._degradeLevel = 1;
                la?.setQualitySettings({ gtaoRadius: 0.5, gtaoSamples: 8 });
                this._lastAdjust = now;
                this._goodSince = 0;
            } else if (this._degradeLevel < 2 && (preset.bloom || preset.shadowSize > 512)) {
                this._degradeLevel = 2;
                la?.setQualitySettings({ shadowSize: 512, bloom: false });
                this._lastAdjust = now;
                this._goodSince = 0;
            } else if (this._degradeLevel < 3 && la?.composer) {
                // Dernier recours : plus de post-processing du tout.
                this._degradeLevel = 3;
                la.teardownComposer();
                this._lastAdjust = now;
                this._goodSince = 0;
            }
        } else if (this._fpsEma > 58) {
            if (!this._goodSince) this._goodSince = now;
            if (now - this._goodSince > 8000) {
                if (this._degradeLevel >= 3) {
                    this._degradeLevel = 2;
                    la?.setQualitySettings({ shadowSize: 512, bloom: false });
                    this._lastAdjust = now;
                } else if (this._degradeLevel >= 2) {
                    this._degradeLevel = 1;
                    la?.setQualitySettings({ shadowSize: preset.shadowSize, bloom: preset.bloom });
                    this._lastAdjust = now;
                } else if (this._degradeLevel >= 1) {
                    this._degradeLevel = 0;
                    la?.setQualitySettings({ gtaoRadius: preset.gtaoRadius, gtaoSamples: preset.gtaoSamples });
                    this._lastAdjust = now;
                } else if (this.resScale < 1) {
                    this.resScale = Math.min(1, this.resScale + 0.05);
                    this.applyResolution();
                    this._lastAdjust = now;
                } else if (this._autoMode && this._canPromote()) {
                    // Aucun palier dégradé, résolution nominale, et pourtant la
                    // machine ne demandait rien de plus : on peut monter d'un cran.
                    // C'est ce qui rattrape le cas où le nom du GPU est illisible
                    // et où la détection a dû démarrer prudent.
                    this._promote();
                    this._lastAdjust = now;
                } else if (!this._shadersWarmed) {
                    // cadence est confortable et stable depuis 8 s : la machine
                    // est rapide, on peut enfin payer la compilation des shaders
                    // d'un coup. Elle retire l'a-coup de compilation du premier
                    // frame des objets qui apparaîtront ensuite (verres, HUD,
                    // panneaux de plafond). Déclenchée ici plutôt qu'à l'init,
                    // elle ne peut plus tomber sur une machine qui ne suivrait pas.
                    this._shadersWarmed = true;
                    TaskScheduler.warmupShaders(
                        this.scene3d?.renderer,
                        this.scene3d?.scene,
                        this.scene3d?.camera
                    );
                }
            }
        } else {
            this._goodSince = 0;
        }
    }

    /** Le preset courant est-il en dessous du plafond, en auto ? */
    _canPromote() {
        const i = QUALITY_ORDER.indexOf(this.presetName);
        const j = QUALITY_ORDER.indexOf(this._ceiling);
        return i >= 0 && j >= 0 && i < j;
    }

    /** Monte d'un cran, sans persister : c'est un ajustement, pas un choix. */
    _promote() {
        const i = QUALITY_ORDER.indexOf(this.presetName);
        const next = QUALITY_ORDER[i + 1];
        if (!next) return;
        this.apply(next, { persist: false });
    }

    /**
     * Lie le bouton HUD de qualité (#hud-btn-quality).
     */
    _bindHUD() {
        const btn = document.getElementById('hud-btn-quality');
        if (!btn) return;
        this._boundClick = () => {
            const next = this.cycle();
            const label = QUALITY_PRESETS[next].label;
            const msg = `🎨 Qualité graphique : ${label}`;
            const hud = this.scene3d.manager?.hud;
            if (hud?.showNotification) hud.showNotification(msg, 'info');
            else if (window.showNotification) window.showNotification(msg);
        };
        btn.addEventListener('click', this._boundClick);
        this._updateButtonTitle();
    }

    _updateButtonTitle() {
        const btn = document.getElementById('hud-btn-quality');
        if (btn) btn.title = `Qualité graphique : ${QUALITY_PRESETS[this.presetName].label} (cliquer pour changer)`;
    }

    dispose() {
        this._disposed = true;
        if (this._composerTimer) { clearTimeout(this._composerTimer); this._composerTimer = null; }
        const btn = document.getElementById('hud-btn-quality');
        if (btn && this._boundClick) btn.removeEventListener('click', this._boundClick);
        this._boundClick = null;
    }
}