/**
 * audio-core.js — Socle audio MedGame
 *
 * UN SEUL AudioContext pour toute l'application, un graphe de bus mixable,
 * des primitives de synthèse réutilisables, un limiteur de sortie et des
 * réglages persistés versionnés.
 *
 * Pourquoi un socle : jusqu'ici le jeu avait six AudioContext indépendants,
 * deux d'entre eux se partageant les mêmes clés localStorage avec des valeurs
 * par défaut contradictoires (0.30 dans js/audio.js, 0.60 dans js/three-audio.js).
 * Conséquence : couper le son ne coupait pas le bip de l'infirmière (js/nurse.js
 * se connectait directement sur ctx.destination) et deux « volumes » se
 * marchaient dessus. Ici il n'y a qu'une source de vérité.
 *
 * Routage :
 *
 *   source ─┬─ bus.ui        ─┐
 *           ├─ bus.sfx       ─┤
 *           ├─ bus.medical   ─┼─ masterGain ─ limiter ─ destination
 *           ├─ bus.auscult.  ─┤
 *           ├─ bus.ambience  ─┤
 *           └─ bus.music     ─┘
 *
 * Chaque bus est une chaîne de deux gains en série :
 *   userGain  → volume choisi par le joueur (persisté)
 *   duckGain  → abaissement automatique quand un son prioritaire parle
 *
 * Chargement : script CLASSIQUE (pas de module) parce que les sites
 * d'appel (js/game.js, js/ui.js, js/timer.js, js/ecosMode.js…) utilisent
 * `<script defer src="js/audio.js">` et doivent rester synchrones.
 * Le code 3D en ES module (js/three-audio.js) lit simplement window.MedGameSound.
 *
 * Aucune dépendance externe, aucun fichier audio, aucun accès réseau.
 */

(function (global) {
    'use strict';

    // ==================== CONSTANTES ====================

    const STORAGE_KEY = 'medgame.audio.v2';
    const LEGACY_VOLUME_KEY = 'medgame.audio.volume';
    const LEGACY_MUTED_KEY = 'medgame.audio.muted';

    const BUS_NAMES = ['ui', 'sfx', 'medical', 'auscultation', 'ambience', 'music'];

    /** Bus par défaut si l'utilisateur n'a rien réglé. */
    const BUS_DEFAULTS = {
        ui: 0.75,
        sfx: 0.9,
        medical: 0.85,
        auscultation: 1.0,
        ambience: 0.6,
        music: 0.45
    };

    const MASTER_DEFAULT = 0.85;

    /**
     * Plafond des gains de bus. 1.5 et non 1.0 parce que le slider de volume
     * de l'auscultation (`#pcg-volume-slider`, auscultation.html) va déjà
     * jusqu'à 1.5 depuis toujours : on ne peut pas rendre le tiers haut de ce
     * curseur décoratif. Le limiteur + le soft-clip en sortie absorbent le
     * risque de saturation.
     */
    const BUS_GAIN_MAX = 1.5;

    /**
     * Bus automatiquement abaissés quand de l_prioritaire parle, pour qu'un
     * bip ECG ou une alarme reste audibles au-dessus de la musique.
     */
    const DUCK_PRIORITY = {
        medical: { targets: ['music', 'ambience'], amount: 0.55, hold: 0.35, release: 0.9 },
        ui: { targets: ['music'], amount: 0.35, hold: 0.12, release: 0.7 },
        sfx: { targets: ['music'], amount: 0.3, hold: 0.1, release: 0.6 },
        auscultation: { targets: ['music', 'ambience', 'sfx', 'ui'], amount: 0.8, hold: 0.6, release: 1.2 }
    };

    /** Voix one-shot simultanées au-delà desquelles on refuse les nouvelles. */
    const MAX_VOICES = 48;

    const NOISE_MAX_SECONDS = 16;
    const RAMP = 0.008; // palier de rampe pour éviter les clics sur gain.setValueAtTime

    // ==================== ÉTAT ====================

    let ctx = null;
    let masterGain = null;
    let limiter = null;
    let safetyShaper = null;
    let analyser = null;

    /** @type {Object<string, {input: GainNode, user: GainNode, duck: GainNode}>} */
    const buses = Object.create(null);
    const ducks = Object.create(null);

    let activeVoices = 0;
    const runningNodes = new Set();

    const registry = Object.create(null);
    const throttles = Object.create(null);
    const lastPlayed = Object.create(null);
    const loops = new Set();
    const timers = new Set();

    const noiseCache = new Map();
    let settings = null;
    let unlockBound = false;
    let destroyed = false;

    // ==================== REGLAGES PERSISTÉS ====================

    function readSettings() {
        let stored = null;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) stored = JSON.parse(raw);
        } catch (e) {
            stored = null;
        }

        const out = {
            master: MASTER_DEFAULT,
            muted: false,
            preset: 'normal',
            buses: Object.assign({}, BUS_DEFAULTS)
        };

        if (stored && typeof stored === 'object') {
            if (Number.isFinite(stored.master)) out.master = clamp(stored.master, 0, BUS_GAIN_MAX);
            if (typeof stored.muted === 'boolean') out.muted = stored.muted;
            if (typeof stored.preset === 'string') out.preset = stored.preset;
            if (stored.buses && typeof stored.buses === 'object') {
                for (const name of BUS_NAMES) {
                    const v = stored.buses[name];
                    if (Number.isFinite(v)) out.buses[name] = clamp(v, 0, BUS_GAIN_MAX);
                }
            }
        } else {
            // Migration des clés plates historiques.
            try {
                const legacyVolume = parseFloat(localStorage.getItem(LEGACY_VOLUME_KEY) ?? '');
                if (Number.isFinite(legacyVolume)) {
                    // L'ancien défaut 0.30 concernait les SFX seuls ; on le reporte
                    // sur le bus sfx et on laisse le master à une valeur confortable.
                    out.buses.sfx = clamp(legacyVolume / 0.3, 0, 1);
                }
                if (localStorage.getItem(LEGACY_MUTED_KEY) === 'true') out.muted = true;
            } catch (e) { /* stockage indisponible :defaults */ }
        }

        return out;
    }

    function saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (e) { /* quota / mode privé : réglage non persisté */ }
    }

    function clamp(v, lo, hi) {
        if (!Number.isFinite(v)) return lo;
        return v < lo ? lo : v > hi ? hi : v;
    }

    function getSettings() {
        if (!settings) settings = readSettings();
        return settings;
    }

    function getBusVolume(name) {
        return getSettings().buses[name] ?? BUS_DEFAULTS[name] ?? 1;
    }

    function setBusVolume(name, v) {
        if (!BUS_NAMES.includes(name)) return;
        const value = clamp(Number(v), 0, BUS_GAIN_MAX);
        getSettings().buses[name] = value;
        saveSettings();
        applyBusVolume(name);
    }

    function getMasterVolume() {
        return getSettings().master;
    }

    function setMasterVolume(v) {
        const value = clamp(Number(v), 0, BUS_GAIN_MAX);
        getSettings().master = value;
        saveSettings();
        applyMasterVolume();
    }

    function isMuted() {
        return getSettings().muted;
    }

    function setMuted(muted) {
        getSettings().muted = !!muted;
        saveSettings();
        // On réapplique TOUT, pas seulement le master. Au chargement, si les
        // réglages sont en mode mué, applyBusVolume() met chaque bus à zéro —
        // si le déverrouillage ne faisait que rétablir le master, les bus
        // resteraient à zéro et le jeu resterait muet pour toujours.
        applyAll();
    }

    function mute() { setMuted(true); }
    function unmute() { setMuted(false); }

    // ==================== CYCLE DE VIE DU CONTEXTE ====================

    /**
     * Crée le graphe. Idempotent. Le contexte démarre normalement 'suspended'
     * tant qu'aucun geste utilisateur n'a eu lieu (politique autoplay) : les
     * sons programmés sont mis en file et partent dès le resume.
     */
    function init() {
        if (destroyed) return false;
        if (ctx) {
            resume();
            return true;
        }

        const Ctor = global.AudioContext || global.webkitAudioContext;
        if (!Ctor) {
            console.warn('[MedGameSound] Web Audio API indisponible');
            return false;
        }

        try {
            ctx = new Ctor({ latencyHint: 'interactive' });
        } catch (e) {
            console.warn('[MedGameSound] création du contexte impossible', e);
            return false;
        }

        masterGain = ctx.createGain();
        masterGain.gain.value = 0;

        // Collage dynamics : évite que 4 bips simultanés ne saturent.
        limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -12;
        limiter.knee.value = 18;
        limiter.ratio.value = 4;
        limiter.attack.value = 0.006;
        limiter.release.value = 0.18;

        // Filet de sécurité final : soft-clip tanh. Garantit qu'aucun gain
        // mal réglé ne peut faire sortir du [-1, 1].
        safetyShaper = ctx.createWaveShaper();
        safetyShaper.curve = makeTanhCurve();
        safetyShaper.oversample = '2x';

        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.75;

        // `__sortie` : chainage explicite, pour que internals().outputChain
        // puisse remonter le graphe dans les tests. Sans cela, aucun test ne
        // pourrait vérifier que le signal sort bien par le limiteur.
        masterGain.connect(limiter);
        masterGain.__sortie = limiter;
        limiter.connect(safetyShaper);
        limiter.__sortie = safetyShaper;
        safetyShaper.connect(analyser);
        safetyShaper.__sortie = analyser;
        analyser.connect(ctx.destination);

        for (const name of BUS_NAMES) {
            const input = ctx.createGain();
            const user = ctx.createGain();
            const duck = ctx.createGain();
            input.connect(user);
            user.connect(duck);
            duck.connect(masterGain);
            buses[name] = { input, user, duck };
            ducks[name] = { amount: 1, until: 0 };
        }

        applyMasterVolume();
        for (const name of BUS_NAMES) applyBusVolume(name);

        bindUnlock();
        resume();
        return true;
    }

    function getContext() {
        if (!ctx) init();
        return ctx;
    }

    function isReady() {
        return !!ctx && ctx.state === 'running';
    }

    function resume() {
        if (ctx && ctx.state === 'suspended') {
            const p = ctx.resume();
            if (p && typeof p.catch === 'function') {
                p.catch(e => console.warn('[MedGameSound] resume', e));
            }
        }
    }

    function suspend() {
        if (ctx && ctx.state === 'running') {
            const p = ctx.suspend();
            if (p && typeof p.catch === 'function') p.catch(() => {});
        }
    }

    /**
     * Relance le contexte au premier geste. Les navigateurs refusent de le
     * démarrer seuls ; on écoute donc pointerdown/keydown/touchstart une fois.
     */
    function bindUnlock() {
        if (unlockBound || typeof document === 'undefined') return;
        unlockBound = true;
        const events = ['pointerdown', 'keydown', 'touchstart'];
        const handler = () => {
            init();
            resume();
            for (const name of events) document.removeEventListener(name, handler, true);
        };
        for (const name of events) document.addEventListener(name, handler, true);
    }

    function now() {
        return ctx ? ctx.currentTime : 0;
    }

    function getAnalyser() {
        init();
        return analyser;
    }

    // ==================== APPLICATION DES GAINS ====================

    function applyMasterVolume() {
        if (!masterGain) return;
        const s = getSettings();
        const target = s.muted ? 0 : s.master;
        setGainSmooth(masterGain.gain, target, 0.12);
    }

    function applyBusVolume(name) {
        const b = buses[name];
        if (!b) return;
        const value = getSettings().muted ? 0 : getBusVolume(name);
        setGainSmooth(b.user.gain, value, 0.08);
    }

    function applyAll() {
        applyMasterVolume();
        for (const name of BUS_NAMES) applyBusVolume(name);
    }

    /**
     * Gain RÉELLEMENT appliqué à un bus, et non la valeur stockée dans les
     * réglages. La différence compte : après un cycle mute/unmute, les gains
     * appliqués et les réglages mémorisés peuvent diverger, et c'est
     * exactement ce divergence-là qui rendrait le jeu muet. Sans cet
     * accessor, un test ne peut pas voir la différence.
     */
    function getAppliedBusGain(name) {
        const b = buses[name];
        return b ? b.user.gain.value : null;
    }

    function getAppliedMasterGain() {
        return masterGain ? masterGain.gain.value : null;
    }

    function setGainSmooth(param, target, duration) {
        const t = now();
        if (!ctx || duration <= 0) {
            param.value = target;
            return;
        }
        try {
            param.cancelScheduledValues(t);
            param.setValueAtTime(param.value, t);
            param.linearRampToValueAtTime(target, t + duration);
        } catch (e) {
            param.value = target;
        }
    }

    // ==================== DUCKING ====================

    /**
     * Abaisse temporairement des bus. Walduck-style : une voix prioritaire
     * déclenche l'abaissement, on le maintient pendant `hold` s puis on
     * remonte progressivement sur `release` s.
     * @param {string} priority - clé de DUCK_PRIORITY ('medical', 'ui', 'sfx', 'auscultation')
     */
    function duck(priority) {
        const rule = DUCK_PRIORITY[priority];
        if (!rule || !ctx) return;
        const t = now();
        for (const name of rule.targets) {
            const entry = ducks[name];
            const bus = buses[name];
            if (!entry || !bus) continue;
            // On garde l'abaissement le plus profond et on prolonge la tenue :
            // deux sons proches ne se font pas remonter le bus entre eux.
            entry.amount = Math.min(entry.amount, rule.amount);
            entry.until = Math.max(entry.until, t + rule.hold);
            setGain(bus.duck.gain, entry.amount, 0.02);
        }
        scheduleDuckRelease(rule.release);
    }

    function setGain(param, target, ramp) {
        const t = now();
        try {
            param.cancelScheduledValues(t);
            param.setValueAtTime(param.value, t);
            param.linearRampToValueAtTime(target, t + ramp);
        } catch (e) {
            param.value = target;
        }
    }

    function scheduleDuckRelease(release) {
        if (ducks._releaseTimer) clearTimeout(ducks._releaseTimer);
        ducks._releaseTimer = setTimeout(() => {
            const t = now();
            for (const name of BUS_NAMES) {
                const entry = ducks[name];
                const bus = buses[name];
                if (!entry || !bus) continue;
                if (t >= entry.until) {
                    entry.amount = 1;
                    setGain(bus.duck.gain, 1, release);
                }
            }
        }, release * 1000 + 40);
    }

    // ==================== PRIMITIVES DE SYNTHÈSE ====================

    /**
     * PRNG déterministe (mulberry32). Utilisé pour tout bruit pseudo-aléatoire
     * afin qu'un même son soit reproductible d'une session à l'autre.
     */
    function rng(seed) {
        let a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /**
     * Tampon de bruit blanc réutilisable, mis en cache par (durée, graine).
     * Un souffle qui dure 4 s ne doit pas allouer 176 000 échantillons à chaque
     * inspiration.
     */
    function noiseBuffer(duration, seed) {
        const len = Math.max(1, Math.min(NOISE_MAX_SECONDS, duration || 2));
        const key = len.toFixed(3) + ':' + (seed >>> 0);
        const cached = noiseCache.get(key);
        if (cached) return cached;

        const c = getContext();
        if (!c) return null;
        const frames = Math.floor(c.sampleRate * len);
        const buffer = c.createBuffer(1, frames, c.sampleRate);
        const data = buffer.getChannelData(0);
        const rand = rng(seed || 1);
        for (let i = 0; i < frames; i++) data[i] = rand() * 2 - 1;

        if (noiseCache.size > 24) noiseCache.delete(noiseCache.keys().next().value);
        noiseCache.set(key, buffer);
        return buffer;
    }

    /** Courbe de soft-clip : tanh(x * drive) / tanh(drive). */
    function makeTanhCurve(drive) {
        const k = drive || 1.6;
        const n = 2048;
        const curve = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const x = (i / (n - 1)) * 2 - 1;
            curve[i] = Math.tanh(k * x) / Math.tanh(k);
        }
        return curve;
    }

    /** Résout un nom de bus ; retombe sur 'sfx' si inconnu. */
    function busInput(name) {
        const bus = buses[name] || buses.sfx;
        return bus ? bus.input : masterGain;
    }

    /**
     * Destination d'une voix : soit un nœud passé explicitement, soit un bus.
     *
     * `dest` sert aux couches qui ont besoin de leur PROPRE nœud de gain au
     * sein d'un bus — c'est ainsi que la pulsation et les cloches de la
     * partition adaptative ont un fondu audible. Sans lui, il faudrait câbler
     * chaque voix directement sur le bus, et tout fondu de sous-couche serait
     * sans effet.
     */
    function destination(o) {
        if (o && o.dest && typeof o.dest.connect === 'function') return o.dest;
        return busInput(o ? o.bus : undefined);
    }

    function trackNode(node, endTime) {
        if (!node) return;
        activeVoices++;
        runningNodes.add(node);
        node.onended = () => {
            activeVoices = Math.max(0, activeVoices - 1);
            runningNodes.delete(node);
            try { node.disconnect(); } catch (e) {}
        };
        if (endTime !== undefined) {
            setTimeout(() => {
                if (runningNodes.has(node)) {
                    runningNodes.delete(node);
                    activeVoices = Math.max(0, activeVoices - 1);
                }
            }, Math.max(0, (endTime - now()) * 1000) + 400);
        }
    }

    function canPlayVoice() {
        if (!ctx) init();
        if (!ctx) return false;
        return activeVoices < MAX_VOICES;
    }

    /**
     * Enveloppe d'attaque / decay exponentielle. Le decay part de `gain` et
     * descend vers -80 dB : `exponentialRampToValueAtTime` refuse 0.
     */
    function applyEnv(param, at, attack, peak, decay) {
        const a = attack === undefined ? 0.005 : attack;
        param.setValueAtTime(0.0001, at);
        param.linearRampToValueAtTime(peak, at + Math.max(RAMP, a));
        param.exponentialRampToValueAtTime(0.0001, at + Math.max(a + RAMP, decay));
    }

    /**
     * Oscillateur à glissement de fréquence optionnel.
     * @param {object} o
     * @param {number} o.freq      fréquence de départ (Hz)
     * @param {string} [o.type]    'sine' | 'triangle' | 'square' | 'sawtooth'
     * @param {number} [o.dur]     durée totale (s)
     * @param {number} [o.attack]  attaque (s)
     * @param {number} [o.gain]    crête de gain
     * @param {number} [o.glideTo] fréquence d'arrivée (Hz)
     * @param {number} [o.detune]  désaccord en cents
     * @param {string} [o.bus]
     * @param {number} [o.at]      instant de départ absolu (ctx.currentTime par défaut)
     */
    function tone(o) {
        const c = getContext();
        if (!c) return null;
        const at = o.at !== undefined ? o.at : c.currentTime + 0.001;
        const dur = o.dur === undefined ? 0.2 : o.dur;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = o.type || 'sine';
        osc.frequency.setValueAtTime(o.freq, at);
        if (o.detune) osc.detune.setValueAtTime(o.detune, at);
        if (o.glideTo) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.glideTo), at + dur * 0.9);
        }
        applyEnv(g.gain, at, o.attack, o.gain === undefined ? 0.2 : o.gain, dur);
        osc.connect(g);
        g.connect(destination(o));
        osc.start(at);
        osc.stop(at + dur + 0.02);
        trackNode(osc, at + dur);
        return osc;
    }

    /**
     * Bruit filtré, avec balayage de fréquence optionnel. C'est la primitive
     * derrière les souffles, les craquements, les froissements et les
     * montées de tension.
     */
    function noise(o) {
        const c = getContext();
        if (!c) return null;
        const at = o.at !== undefined ? o.at : c.currentTime + 0.001;
        const dur = o.dur === undefined ? 0.3 : o.dur;
        const attack = o.attack === undefined ? 0.01 : o.attack;
        const buffer = noiseBuffer(Math.min(NOISE_MAX_SECONDS, attack + dur + 0.2), o.seed || 7);
        if (!buffer) return null;

        const src = c.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        // Démarrage décalé dans le tampon pour que deux bruits ne soient
        // jamais identiques, tout en restant déterministes.
        const rand = rng((o.seed || 7) + Math.floor(at * 1000));
        src.loopStart = 0;
        src.loopEnd = buffer.duration;

        const filter = c.createBiquadFilter();
        filter.type = o.filter || 'bandpass';
        filter.frequency.setValueAtTime(o.freq || 1200, at);
        if (o.freqTo) {
            filter.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqTo), at + dur);
        }
        filter.Q.value = o.q === undefined ? 1 : o.q;

        const g = c.createGain();
        const peak = o.gain === undefined ? 0.1 : o.gain;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(peak, at + Math.max(RAMP, attack));
        if (o.hold) g.gain.setValueAtTime(peak, at + Math.max(RAMP, attack) + o.hold);
        g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(attack, dur) + (o.hold || 0));

        src.connect(filter);
        filter.connect(g);
        g.connect(destination(o));
        const startAt = at + rand() * 0.1;
        src.start(startAt);
        src.stop(startAt + dur + 0.25);
        trackNode(src, startAt + dur);
        return src;
    }

    /**
     * Cloche additive inharmonique : N partiels à `freq * mult`, gains en 1/(i+1.2)
     * et decays décroissants. C'est ce qui donne le timbre métallique — une
     * simple sinus ne « sonne » pas cloche.
     */
    function bell(o) {
        const c = getContext();
        if (!c) return null;
        const at = o.at !== undefined ? o.at : c.currentTime + 0.001;
        const dur = o.dur === undefined ? 1.2 : o.dur;
        const partials = o.partials || [1, 2.01, 2.98, 4.07, 5.43, 6.79];
        const peak = o.gain === undefined ? 0.15 : o.gain;

        for (let i = 0; i < partials.length; i++) {
            const osc = c.createOscillator();
            const g = c.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(o.freq * partials[i], at);
            const pGain = peak / (i + 1.2);
            const pDur = dur / (1 + i * 0.55);
            g.gain.setValueAtTime(0.0001, at);
            g.gain.linearRampToValueAtTime(pGain, at + 0.004);
            g.gain.exponentialRampToValueAtTime(0.0001, at + pDur);
            osc.connect(g);
            g.connect(destination(o));
            osc.start(at);
            osc.stop(at + pDur + 0.02);
            trackNode(osc, at + pDur);
        }
        return null;
    }

    /**
     * Nappe : pile d'oscillateurs désaccordés, filtre passe-bas lent.
     * Sert de couche grave à l'ambiance et à la musique adaptative.
     */
    function pad(o) {
        const c = getContext();
        if (!c) return null;
        const at = o.at !== undefined ? o.at : c.currentTime + 0.001;
        const dur = o.dur === undefined ? 4 : o.dur;
        const root = o.root || 110;
        const ratios = o.ratios || [1, 1.5, 2, 3];
        const peak = o.gain === undefined ? 0.05 : o.gain;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(peak, at + Math.min(1.5, dur * 0.35));
        g.gain.setValueAtTime(peak, at + dur * 0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);

        const filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 0.7;
        const f0 = o.filterFrom || 400;
        const f1 = o.filterTo || 1200;
        filter.frequency.setValueAtTime(f0, at);
        filter.frequency.linearRampToValueAtTime(f1, at + dur * 0.5);
        filter.frequency.linearRampToValueAtTime(f0 * 1.2, at + dur);

        const nodes = [];
        for (let i = 0; i < ratios.length; i++) {
            const osc = c.createOscillator();
            osc.type = o.type || 'sawtooth';
            osc.frequency.setValueAtTime(root * ratios[i], at);
            osc.detune.setValueAtTime((i % 2 === 0 ? 1 : -1) * (4 + i * 3), at);
            const vg = c.createGain();
            vg.gain.value = 1 / (i + 1.3);
            osc.connect(vg);
            vg.connect(filter);
            osc.start(at);
            osc.stop(at + dur + 0.05);
            nodes.push(osc);
            trackNode(osc, at + dur);
        }
        filter.connect(g);
        g.connect(destination(o));
        return g;
    }

    /**
     * Impact grave : sinus qui descend vite, avec un clic d'attaque filtré.
     * Remplace l'ancien « bip bip » du battement par quelque chose de physique.
     */
    function thump(o) {
        const c = getContext();
        if (!c) return null;
        const at = o.at !== undefined ? o.at : c.currentTime + 0.001;
        const dur = o.dur === undefined ? 0.18 : o.dur;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(o.freq || 70, at);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqTo || 38), at + dur * 0.7);
        applyEnv(g.gain, at, o.attack === undefined ? 0.004 : o.attack,
            o.gain === undefined ? 0.3 : o.gain, dur);
        osc.connect(g);
        g.connect(destination(o));
        osc.start(at);
        osc.stop(at + dur + 0.02);
        trackNode(osc, at + dur);
        return osc;
    }

    /**
     * Souffle : bruit passe-bande balayé vers le haut puis retour, c'est
     * l'expiration. `intensity` 0..1 monte le niveau et resserre le filtre.
     */
    function breath(o) {
        const intensity = o.intensity === undefined ? 0.5 : clamp(o.intensity, 0, 1);
        return noise({
            dur: o.dur === undefined ? 0.9 : o.dur,
            gain: (o.gain === undefined ? 0.05 : o.gain) * (0.5 + intensity),
            filter: 'bandpass',
            freq: (o.freq || 480) * (1.2 - intensity * 0.4),
            freqTo: (o.freqTo || 900) * (1.2 - intensity * 0.4),
            q: 0.7 + intensity * 1.6,
            attack: o.attack === undefined ? 0.12 : o.attack,
            hold: o.hold,
            seed: o.seed || 21,
            bus: o.bus,
            at: o.at
        });
    }

    /**
     * Balayage large (swept tone) : la primitive des montées de tension.
     */
    function sweep(o) {
        return tone({
            freq: o.freqFrom || 200,
            glideTo: o.freqTo || 1800,
            type: o.type || 'triangle',
            dur: o.dur === undefined ? 1.2 : o.dur,
            attack: o.attack === undefined ? 0.15 : o.attack,
            gain: o.gain === undefined ? 0.08 : o.gain,
            bus: o.bus,
            at: o.at
        });
    }

    // ==================== SONS EN BOUCLE ====================

    /**
     * Démarre une boucle et renvoie une poignée. Toute boucle doit être
     * arrêtée explicitement : c'est ce qui remplace les <audio loop> dispersés.
     * @param {string} name - chemin d'asset ou identifiant de tampon
     * @param {object} [o]
     * @returns {{stop: Function, setGain: Function, source: object}|null}
     */
    async function loop(name, o) {
        const options = o || {};
        const c = init() ? ctx : null;
        if (!c) return null;
        let buffer = null;
        try {
            buffer = await loadBuffer(name, options);
        } catch (e) {
            console.warn('[MedGameSound] boucle impossible :', name, e);
            return null;
        }
        if (!buffer) return null;

        const at = c.currentTime + 0.02;
        const src = c.createBufferSource();
        src.buffer = buffer;
        src.loop = !!options.loop;
        if (options.rate) src.playbackRate.value = options.rate;

        const g = c.createGain();
        const target = options.gain === undefined ? 0.5 : options.gain;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(target, at + (options.fadeIn || 1.2));

        src.connect(g);
        g.connect(destination(options));

        let stopped = false;
        const handle = {
            name,
            source: src,
            gainNode: g,
            getGain() { return g.gain.value; },
            setGain(v) { setGainSmooth(g.gain, clamp(Number(v), 0, 4), 0.1); },
            stop(fade) {
                if (stopped) return;
                stopped = true;
                loops.delete(handle);
                const t = c.currentTime;
                const f = fade === undefined ? 0.8 : fade;
                try {
                    g.gain.cancelScheduledValues(t);
                    g.gain.setValueAtTime(g.gain.value, t);
                    g.gain.linearRampToValueAtTime(0.0001, t + f);
                    src.stop(t + f + 0.05);
                } catch (e) {}
            }
        };
        src.start(at);
        loops.add(handle);
        return handle;
    }

    const bufferCache = new Map();

    /** Charge et décode un fichier audio (mis en cache par URL). */
    async function loadBuffer(url) {
        if (bufferCache.has(url)) return bufferCache.get(url);
        const c = getContext();
        if (!c) return null;
        const res = await fetch(url, { cache: 'force-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
        const raw = await res.arrayBuffer();
        const buffer = await c.decodeAudioData(raw);
        bufferCache.set(url, buffer);
        return buffer;
    }

    function stopAllLoops(fade) {
        for (const handle of Array.from(loops)) handle.stop(fade);
    }

    // ==================== MINUTERIE GÉRÉE ====================

    /**
     * setTimeout dont le handle est suivi, pour que destroy() ne laisse
     * aucun timer orphelin déclencher du son sur un contexte fermé.
     */
    function managedTimeout(fn, ms) {
        const id = setTimeout(() => {
            timers.delete(id);
            fn();
        }, ms);
        timers.add(id);
        return id;
    }

    function managedInterval(fn, ms) {
        const id = setInterval(fn, ms);
        timers.add(id);
        return id;
    }

    function clearManaged(id) {
        if (id === undefined || id === null) return;
        clearTimeout(id);
        clearInterval(id);
        timers.delete(id);
    }

    // ==================== REGISTRE ====================

    function register(name, fn) {
        if (typeof fn !== 'function') return;
        registry[name] = fn;
    }

    function registerAll(map) {
        for (const name of Object.keys(map)) register(name, map[name]);
    }

    function has(name) {
        return typeof registry[name] === 'function';
    }

    function list() {
        return Object.keys(registry).sort();
    }

    /**
     * Joue un son enregistré. Silencieux si le bus est à zéro, si le son est
     * inconnu (avec un avertissement en dev — c'est exactement le piège des
     * appels 'success'/'card_flip' qui n'existaient pas) ou si le throttling
     * l'a neutralisé.
     */
    function play(name, param) {
        const s = getSettings();
        if (s.muted) return false;

        const fn = registry[name];
        if (!fn) {
            if (typeof console !== 'undefined') {
                console.warn(`[MedGameSound] son inconnu : "${name}"`);
            }
            return false;
        }

        const delay = throttles[name] || 0;
        if (delay) {
            const stamp = Date.now();
            if (lastPlayed[name] && stamp - lastPlayed[name] < delay) return false;
            lastPlayed[name] = stamp;
        }

        if (!canPlayVoice()) return false;
        try {
            fn(param);
        } catch (e) {
            console.warn(`[MedGameSound] échec du son "${name}"`, e);
            return false;
        }
        return true;
    }

    /** Joue un son sur un bus précis (sans passer par le registre). */
    function playOn(name, busName, param) {
        const fn = registry[name];
        if (!fn || !canPlayVoice()) return false;
        try {
            fn(Object.assign({ bus: busName }, param));
        } catch (e) {
            return false;
        }
        return true;
    }

    function setThrottle(name, ms) {
        throttles[name] = ms;
    }

    function setThrottles(map) {
        for (const name of Object.keys(map)) throttles[name] = map[name];
    }

    // ==================== PRÉSETS ====================

    const PRESETS = {
        quiet: { label: 'Discret', master: 0.6, ui: 0.5, sfx: 0.6, medical: 0.6, auscultation: 0.9, ambience: 0.35, music: 0.2 },
        normal: { label: 'Normal', master: 0.85, ui: 0.75, sfx: 0.9, medical: 0.85, auscultation: 1.0, ambience: 0.6, music: 0.45 },
        immersive: { label: 'Immersif', master: 1.0, ui: 0.85, sfx: 1.0, medical: 1.0, auscultation: 1.0, ambience: 0.8, music: 0.7 }
    };

    function applyPreset(name) {
        const preset = PRESETS[name];
        if (!preset) return false;
        const s = getSettings();
        s.preset = name;
        s.master = preset.master;
        for (const bus of BUS_NAMES) s.buses[bus] = preset[bus];
        saveSettings();
        applyAll();
        return true;
    }

    function getPreset() {
        return getSettings().preset;
    }

    function listPresets() {
        return Object.keys(PRESETS);
    }

    // ==================== MODE CALME ====================

    function isCalmMode() {
        if (global.MedGameModes && typeof global.MedGameModes.isCalmMode === 'function') {
            return global.MedGameModes.isCalmMode();
        }
        try {
            return localStorage.getItem('medgame_calm_mode') === 'true';
        } catch (e) {
            return false;
        }
    }

    /**
     * En mode calme on coupe ce qui est stressant (alarmes, tick de timer,
     * musique) sans toucher au feedback pédagogique (réponses justes/fausses).
     * C'est le pendant audio de ce que js/timer.js fait déjà pour le CSS.
     */
    function isStressful(name) {
        return STRESSFUL_SOUNDS.has(name);
    }

    /**
     * Sons que le mode calme doit couper.
     *
     * Tous ces noms EXISTENT dans le registre (vérifié par test/audio.test.mjs),
     * à une exceptionNear进门 : `'alarm'` est un sentinelle, pas un son du
     * registre. C'est `audio-medical.js` qui l'utilise pour désigner
     * « n'importe quelle alarme » ; les alarmes elles-mêmes sont des motifs
     * (warning, critical, apnea, codeBlue, lowSpO2) et non des sons, donc
     * elles ne passent pas par le registre.
     */
    const STRESSFUL_SOUNDS = new Set([
        'tick', 'timerWarning', 'alert', 'alarm',
        'vitalDrop', 'ecosUrgent', 'badOutcome'
    ]);

    // ==================== NETTOYAGE ====================

    function destroy() {
        stopAllLoops(0.05);
        for (const id of timers) {
            clearTimeout(id);
            clearInterval(id);
        }
        timers.clear();
        for (const node of runningNodes) {
            try { node.stop(); } catch (e) {}
            try { node.disconnect(); } catch (e) {}
        }
        runningNodes.clear();
        activeVoices = 0;
        noiseCache.clear();
        bufferCache.clear();
        if (ctx) {
            const c = ctx;
            ctx = null;
            try { c.close(); } catch (e) {}
        }
        masterGain = limiter = safetyShaper = analyser = null;
        for (const name of BUS_NAMES) delete buses[name];
        destroyed = true;
    }

    /** Rouvre un contexte détruit (tests, changement de cas sur la page 3D). */
    function revive() {
        destroyed = false;
        unlockBound = false;
        return init();
    }

    /**
     * État interne du graphe, exposé pour les tests.
     *
     * Un AudioNode n'est pas introspectable dans un navigateur : impossible de
     * savoir si `bus.sfx` alimente bien le master, ou si une chaîne est
     * cassée quelque part. Ici on donne accès aux objets eux-mêmes, ce qui
     * permet à test/audio.test.mjs de vérifier la TOPOLOGIE réelle avec un
     * faux contexte — et donc de détecter un bus débranché, ce qu'aucun test
     * navigateur ne pourrait faire.
     */
    function internals() {
        const chaine = [];
        let courant = masterGain;
        let garde = 0;
        while (courant && garde++ < 12) {
            chaine.push(courant);
            const suivant = courant.__sortie || null;
            if (!suivant) break;
            courant = suivant;
        }
        return {
            buses,
            ducks,
            masterGain,
            limiter,
            safetyShaper,
            analyser,
            context: ctx,
            /** Nœuds depuis le master jusqu'à l'analyseur. */
            outputChain: chaine,
            /** Gain de ducking d'un bus. */
            duckGain(name) {
                return buses[name] ? buses[name].duck.gain : null;
            },
            /** Gain utilisateur d'un bus. */
            busUserGain(name) {
                return buses[name] ? buses[name].user.gain : null;
            }
        };
    }

    /** Force le relâchement des duckings en cours (tests). */
    function relacherDucks() {
        for (const name of BUS_NAMES) {
            ducks[name].amount = 1;
            ducks[name].until = 0;
            if (buses[name]) buses[name].duck.gain.value = 1;
        }
        if (ducks._releaseTimer) {
            clearTimeout(ducks._releaseTimer);
            ducks._releaseTimer = null;
        }
    }

    // ==================== API PUBLIQUE ====================

    const MedGameSound = {
        // Contexte
        init,
        getContext,
        isReady,
        resume,
        suspend,
        now,
        getAnalyser,

        // Réglages
        getSettings,
        setBusVolume,
        getBusVolume,
        getAppliedBusGain,
        getAppliedMasterGain,
        setMasterVolume,
        getMasterVolume,
        internals,
        relacherDucks,
        setMuted,
        isMuted,
        mute,
        unmute,
        applyPreset,
        getPreset,
        listPresets,
        isCalmMode,
        isStressful,

        // Buses
        busInput,
        duck,

        // Registre
        register,
        registerAll,
        play,
        playOn,
        has,
        list,
        setThrottle,
        setThrottles,

        // Boucles
        loop,
        stopAllLoops,
        loadBuffer,

        // Minuterie
        managedTimeout,
        managedInterval,
        clearManaged,

        // Primitives
        tone,
        noise,
        bell,
        pad,
        thump,
        breath,
        sweep,
        rng,
        noiseBuffer,
        makeTanhCurve,

        // Introspection (tests)
        constants: {
            STORAGE_KEY,
            LEGACY_VOLUME_KEY,
            LEGACY_MUTED_KEY,
            BUS_NAMES,
            BUS_DEFAULTS,
            MASTER_DEFAULT,
            BUS_GAIN_MAX,
            DUCK_PRIORITY,
            MAX_VOICES,
            PRESETS,
            STRESSFUL_SOUNDS
        },

        destroy,
        revive
    };

    global.MedGameSound = MedGameSound;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = MedGameSound;
    }
})(typeof window !== 'undefined' ? window : globalThis);
