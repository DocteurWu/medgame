/**
 * three-quality-agent.js — Agent de qualité graphique adaptative
 * Détection GPU heuristique, presets Low/Medium/High/Ultra,
 * résolution dynamique (downscale si FPS bas), persistance localStorage,
 * bouton HUD pour cycler les presets.
 */

const STORAGE_KEY = 'medgame_3d_quality';

export const QUALITY_ORDER = ['low', 'medium', 'high', 'ultra'];

export const QUALITY_PRESETS = {
    low: {
        label: 'Basse',
        pixelRatio: 1.25,
        msaa: 0,
        gtao: false,
        bloom: false,
        shadowSize: 1024,
        dust: false,
        gtaoRadius: 0.5,
        gtaoSamples: 8
    },
    medium: {
        label: 'Moyenne',
        pixelRatio: 1.5,
        msaa: 4,
        gtao: true,
        bloom: true,
        shadowSize: 2048,
        dust: true,
        gtaoRadius: 0.6,
        gtaoSamples: 10
    },
    high: {
        label: 'Haute',
        pixelRatio: 1.5,
        msaa: 4,
        gtao: true,
        bloom: true,
        shadowSize: 2048,
        dust: true,
        gtaoRadius: 0.8,
        gtaoSamples: 14
    },
    ultra: {
        label: 'Ultra',
        pixelRatio: 1.75,
        msaa: 4,
        gtao: true,
        bloom: true,
        shadowSize: 2048,
        dust: true,
        gtaoRadius: 1.0,
        gtaoSamples: 20
    }
};

export class ThreeQualityAgent {
    /**
     * @param {Object} scene3d — instance ThreeScene (renderer, lightingAgent, environmentAgent…)
     */
    constructor(scene3d) {
        this.scene3d = scene3d;
        this.presetName = 'medium';
        this.resScale = 1;              // multiplicateur dynamique 0.65 → 1
        this.basePixelRatio = 1.5;
        this._fpsEma = 60;
        this._lastAdjust = 0;
        this._goodSince = 0;
        this._startTime = performance.now();
        this._boundClick = null;
        // Paliers de dégradation couplés (au-delà de la simple résolution) :
        // 0 = plein preset, 1 = GTAO allégé, 2 = ombres 1024 + bloom off
        this._degradeLevel = 0;
    }

    /**
     * Heuristique de capacité GPU/CPU pour choisir le preset initial.
     * Ultra exige un vrai GPU + écran haute densité (jamais auto sur iGPU/batterie).
     */
    detectTier() {
        try {
            const isWebGL2 = this.scene3d.renderer.capabilities.isWebGL2;
            const cores = navigator.hardwareConcurrency || 4;
            const mem = navigator.deviceMemory || 4; // Go (Chrome/Edge, plafonné à 8)
            const dpr = window.devicePixelRatio || 1;

            if (!isWebGL2 || cores <= 4) return 'medium';
            if (cores >= 8 && mem >= 8 && dpr >= 2) return 'ultra';
            if (cores >= 6) return 'high';
            return 'medium';
        } catch (e) {
            return 'medium';
        }
    }

    /**
     * Initialise l'agent : preset sauvegardé sinon auto-détecté,
     * puis construit le pipeline post-processing correspondant.
     */
    async init() {
        const saved = localStorage.getItem(STORAGE_KEY);
        this.apply(saved && QUALITY_PRESETS[saved] ? saved : this.detectTier());
        await this.scene3d.lightingAgent.setupPostProcessing();
        this._bindHUD();
    }

    /**
     * Applique un preset qualité (passes, ombres, poussières, pixel ratio).
     */
    apply(name) {
        const preset = QUALITY_PRESETS[name];
        if (!preset) return;
        this.presetName = name;
        try { localStorage.setItem(STORAGE_KEY, name); } catch (e) { /* stockage indisponible */ }

        const la = this.scene3d.lightingAgent;
        const rebuild = la.needsRebuild(preset.msaa);
        if (rebuild) la.teardownComposer();

        la.setQualitySettings({
            msaa: preset.msaa,
            gtao: preset.gtao,
            bloom: preset.bloom,
            shadowSize: preset.shadowSize,
            gtaoRadius: preset.gtaoRadius,
            gtaoSamples: preset.gtaoSamples
        });

        // Particules de poussière (détail décoratif coûteux)
        const dust = this.scene3d.environmentAgent?.getDustParticles?.();
        if (dust) dust.visible = !!preset.dust;

        this.basePixelRatio = Math.min(window.devicePixelRatio || 1, preset.pixelRatio);
        this.resScale = 1;
        this._degradeLevel = 0;
        this.applyResolution();

        if (rebuild) {
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
     * Passe au preset suivant (bouton HUD).
     * @returns {string} nom du nouveau preset
     */
    cycle() {
        const idx = QUALITY_ORDER.indexOf(this.presetName);
        const next = QUALITY_ORDER[(idx + 1) % QUALITY_ORDER.length];
        this.apply(next);
        return next;
    }

    /**
     * Résolution dynamique + paliers couplés : appelée chaque frame par animate().
     * Palier 0 : downscale progressif (resScale → 0.65).
     * Palier 1 : GTAO allégé (samples 8, radius 0.5).
     * Palier 2 : ombres 1024 + bloom off (gros gain, visuel conservé).
     * Remontée inverse après 8s > 58fps.
     * @param {number} dt — delta time en secondes
     */
    sample(dt) {
        if (!dt || dt <= 0) return;
        const now = performance.now();
        if (now - this._startTime < 2500) return; // ignorer le pic de chargement initial

        const fps = 1 / dt;
        this._fpsEma += (fps - this._fpsEma) * 0.05;

        if (now - this._lastAdjust < 1500) return;

        const la = this.scene3d.lightingAgent;
        if (this._fpsEma < 45) {
            if (this.resScale > 0.65) {
                this.resScale = Math.max(0.65, this.resScale - 0.1);
                this.applyResolution();
                this._lastAdjust = now;
                this._goodSince = 0;
            } else if (this._degradeLevel < 1) {
                this._degradeLevel = 1;
                la?.setQualitySettings({ gtaoRadius: 0.5, gtaoSamples: 8 });
                this._lastAdjust = now;
                this._goodSince = 0;
            } else if (this._degradeLevel < 2) {
                this._degradeLevel = 2;
                la?.setQualitySettings({ shadowSize: 1024, bloom: false });
                this._lastAdjust = now;
                this._goodSince = 0;
            }
        } else if (this._fpsEma > 58) {
            if (!this._goodSince) this._goodSince = now;
            if (now - this._goodSince > 8000) {
                const preset = QUALITY_PRESETS[this.presetName];
                if (this._degradeLevel >= 2) {
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
                }
            }
        } else {
            this._goodSince = 0;
        }
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
        const btn = document.getElementById('hud-btn-quality');
        if (btn && this._boundClick) btn.removeEventListener('click', this._boundClick);
        this._boundClick = null;
    }
}
