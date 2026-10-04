/**
 * audio-ambience.js — Ambiance hospitalière et musique adaptative
 *
 * Deux couches distinctes, sur deux bus distincts :
 *
 *   bus.ambience  — LE LIEU. Bruit de ventilation, couloir, portes,
 *                   chariots, scope d'une autre chambre. On est dans un
 *                   hôpital réel, pas dans une pièce blanche.
 *   bus.music     — LA TENSION. Une partition qui suit l'état du patient.
 *
 * POURQUOI DES VOIX PERMANENTES
 * -----------------------------
 * Chaque état de la musique est un ensemble de voix (nappe, pulsation,
 * sous-basse, cloches) qui existent en permanence et dont on ne bouge que le
 * GAIN. Un crossfade entre deux états est donc une rampe de gain — pas un
 * fondu croisé entre deux sources distinctes, qui dopplerait et claquait
 * quand les deux accords sont à des hauteurs différentes. Conséquence :
 * passer de « tendu » à « critique » est instantané et sans trou, et on peut
 * moduler le filtre de la nappe en continu pendant la transition.
 *
 * LA MODULATION CONTINUE
 * ----------------------
 * En plus des cinq états discrets, on calcule une tension continue dans
 * [0, 1] à partir des constantes. Elle n'est pas un interrupteur : la nappe
 * se ferme progressivement quand la SpO2 descend, la pulsation double quand
 * la FC monte, et la musique « suit » le rythme du cœur. C'est ce qui évite
 * le basculement binaire « tout va bien / tout va mal ».
 *
 * Chargement : script classique, après js/audio-core.js.
 */

(function (global) {
    'use strict';

    const A = global.MedGameSound;
    if (!A) {
        console.warn('[audio-ambience] js/audio-core.js absent — ambiance non chargée');
        return;
    }

    // ==================== CONSTANTES ====================

    const AMBIENCE_BUS = 'ambience';
    const MUSIC_BUS = 'music';

    const CROSSFADE = 2.6;        // durée d'un changement d'état musical (s)
    const VOICE_FADE = 1.2;       // fondu d'entrée / sortie d'une couche
    const PULSE_TICK_MS = 40;     // ordonnanceur de la pulsation
    const PULSE_LOOKAHEAD = 0.2;

    /** Espacement des évènements de couloir (s), borné par la tension. */
    const CORRIDOR_MIN = 9;
    const CORRIDOR_MAX = 26;

    /**
     * Les quatre états. Les accords sont en Ré : la dominante de la gamme
     * mineure, ce qui donne une couleur « tendue sans être agressif ».
     */
    const STATES = {
        off: {
            label: 'Silencieux',
            root: 146.83,           // Ré3
            padRatios: [1, 1.5, 2], padGain: 0, padFilter: 380, padSpread: 0,
            pulseRate: 0, pulseGain: 0, pulsePattern: [],
            subGain: 0, subFreq: 36.7,
            bellDensity: 0, bellFreq: 587.33, bellGain: 0
        },
        calm: {
            label: 'Calme',
            // rém add9 : rond, ouvert, pas de tension
            root: 146.83,
            padRatios: [1, 1.5, 2, 2.99], padGain: 0.05, padFilter: 520, padSpread: 5,
            pulseRate: 0, pulseGain: 0, pulsePattern: [],
            subGain: 0.012, subFreq: 73.42,
            bellDensity: 0, bellFreq: 880, bellGain: 0
        },
        tense: {
            label: 'Tendu',
            // ré + mi bémol : la seconde mineure fait la tension
            root: 146.83,
            padRatios: [1, 1.5, 1.4983, 2], padGain: 0.052, padFilter: 700, padSpread: 9,
            pulseRate: 1.6, pulseGain: 0.035, pulsePattern: [1, 0, 2, 0],
            subGain: 0.022, subFreq: 73.42,
            bellDensity: 0, bellFreq: 698.46, bellGain: 0
        },
        critical: {
            label: 'Critique',
            // ré + la bémol : le triton, l'instabilité maximale
            root: 146.83,
            padRatios: [1, 1.414, 2, 2.83], padGain: 0.06, padFilter: 1150, padSpread: 22,
            pulseRate: 3.4, pulseGain: 0.05, pulsePattern: [1, 0, 2, 1, 0, 2, 1, 0],
            subGain: 0.045, subFreq: 36.71,
            bellDensity: 0, bellFreq: 466.16, bellGain: 0
        },
        resolution: {
            label: 'Rassurante',
            // fa majeur : plus clair et plus chaud que les états de tension
            root: 174.61,           // Fa3
            padRatios: [1, 1.5, 2, 2.5], padGain: 0.048, padFilter: 900, padSpread: 4,
            pulseRate: 0, pulseGain: 0, pulsePattern: [],
            subGain: 0.012, subFreq: 87.31,
            bellDensity: 0.22, bellFreq: 1046.5, bellGain: 0.05
        }
    };

    const FOCUS_DUCK = {
        idle: { music: 1, ambience: 1 },
        action: { music: 0.7, ambience: 0.85 },
        interrogation: { music: 0.28, ambience: 0.5 },
        auscultation: { music: 0.05, ambience: 0.18 }
    };

    // ==================== ÉTAT ====================

    const ctxRefs = { c: null };

    const voices = {
        room: null,        // lit de bruit de ventilation
        corridorTimer: null,
        pad: null,
        padFilter: null,
        padGain: null,
        sub: null,
        subGain: null,
        pulseGain: null,
        bellGain: null
    };

    const state = {
        mode: 'off',           // clé de STATES
        focus: 'idle',         // clé de FOCUS_DUCK
        tension: 0,            // 0..1 continu
        started: false,
        pulseIndex: 0,
        nextPulse: 0,
        nextBell: 0,
        pulseTimer: null,
        corridorTimer: null,
        corridorNext: 0,
        seed: 20240501
    };

    let rand = A.rng(state.seed);
    const vitals = { hr: 72, spo2: 98, rr: 14, systolic: 120, temperature: 37 };

    // ==================== LIEU : BRUIT DE VENTILATION ====================

    /**
     * Lit de bruit permanent. Un hôpital n'est jamais silencieux : il y a la
     * ventilation, les moniteurs, les tuyauteries. Sans ce lit, chaque
     * bip ECG semble sortir du néant.
     */
    function buildRoomTone() {
        const c = A.getContext();
        if (!c || voices.room) return;
        const buffer = A.noiseBuffer(4, 9001);
        if (!buffer) return;

        const src = c.createBufferSource();
        src.buffer = buffer;
        src.loop = true;

        // Deux bandes : la soufflerie basse et le bourdonnement des tubes.
        const low = c.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.value = 420;
        low.Q.value = 0.5;

        const air = c.createBiquadFilter();
        air.type = 'bandpass';
        air.frequency.value = 2600;
        air.Q.value = 0.8;

        const lowGain = c.createGain();
        lowGain.gain.value = 0.05;
        const airGain = c.createGain();
        airGain.gain.value = 0.012;

        const out = c.createGain();
        out.gain.value = 0.0001;

        src.connect(low);
        low.connect(lowGain);
        lowGain.connect(out);
        src.connect(air);
        air.connect(airGain);
        airGain.connect(out);
        out.connect(A.busInput(AMBIENCE_BUS));

        src.start();
        // Pas de fondu ici : le lit de bruit est construit UNE seule fois pour
        // toute la session. Mettre le fondu dans buildRoomTone() le ferait
        // disparaitre au premier stop(), et comme ce build sort ensuite immédiatement
        // (les nœuds existent déjà) SANS le rallumer, la ventilation
        // ne revenait jamais.
        voices.room = { src, out, low, air, lowGain, airGain };
    }

    /** Fait remonter le lit de bruit. Appelé par start(), pas par le build. */
    function fadeRoomIn() {
        if (voices.room) fadeTo(voices.room.out.gain, 1, VOICE_FADE * 2.5);
    }

    // ==================== LIEU : ÉVÈNEMENTS DE COULOIR ====================

    /**
     * Ce qui se passe *ailleurs* dans le service. C'est ce qui donne
     * l'impression que le patient est dans un lit et pas dans un menu.
     * Tout passe par un passe-bas : on n'entend rien nettement.
     */
    const CORRIDOR_EVENTS = [
        // Un scope d'une autre chambre : bip étouffé.
        function distantMonitor(t) {
            A.tone({ freq: 880, type: 'sine', dur: 0.07, gain: 0.03, bus: AMBIENCE_BUS, at: t });
        },
        // Une porte.
        function distantDoor(t) {
            A.thump({ freq: 95, freqTo: 48, dur: 0.18, gain: 0.045, bus: AMBIENCE_BUS, at: t });
            A.noise({ dur: 0.22, gain: 0.016, filter: 'lowpass', freq: 600, freqTo: 200, q: 0.7, seed: 1201, bus: AMBIENCE_BUS, at: t + 0.24 });
        },
        // Un chariot qu'on pousse.
        function distantCart(t) {
            A.noise({ dur: 1.1, gain: 0.014, filter: 'bandpass', freq: 320, q: 1.2, seed: 1213, bus: AMBIENCE_BUS, at: t });
        },
        // Des pas dans le couloir.
        function distantSteps(t) {
            for (let i = 0; i < 4; i++) {
                A.noise({ dur: 0.07, gain: 0.018, filter: 'lowpass', freq: 800, freqTo: 300, q: 0.7, seed: 1217 + i, bus: AMBIENCE_BUS, at: t + i * 0.47 });
            }
        },
        // Une voix qui parle sans qu'on comprenne.
        function distantVoice(t) {
            A.noise({
                dur: 1.6, gain: 0.02, filter: 'bandpass', freq: 700, freqTo: 420, q: 2.4,
                attack: 0.25, seed: 1223, bus: AMBIENCE_BUS, at: t
            });
        },
        // Un poste de garde : un bip court, deux fois.
        function distantPager(t) {
            A.tone({ freq: 1318.5, type: 'sine', dur: 0.05, gain: 0.02, bus: AMBIENCE_BUS, at: t });
            A.tone({ freq: 1318.5, type: 'sine', dur: 0.05, gain: 0.02, bus: AMBIENCE_BUS, at: t + 0.11 });
        }
    ];

    function fireCorridorEvent() {
        const c = A.getContext();
        if (!c) return;
        const idx = Math.floor(rand() * CORRIDOR_EVENTS.length);
        // On évite deux fois le même événement de suite : ça sonne scripté.
        if (idx === state.corridorLast) {
            CORRIDOR_EVENTS[(idx + 1) % CORRIDOR_EVENTS.length](c.currentTime + 0.01);
        } else {
            CORRIDOR_EVENTS[idx](c.currentTime + 0.01);
        }
        state.corridorLast = idx;
        scheduleNextCorridor();
    }

    /**
     * Plus le patient va mal, plus le couloir est « vivant » : on raccourcit
     * l'espacement. Rien de subtil dans le code, mais à l'oreille la
     * pression augmente toute seule.
     */
    function scheduleNextCorridor() {
        const span = CORRIDOR_MAX - CORRIDOR_MIN;
        const wait = CORRIDOR_MAX - span * state.tension - span * rand() * 0.6;
        state.corridorNext = A.now() + Math.max(3, wait);
    }

    function pumpCorridor() {
        if (!state.started) return;
        // Les cloches de résolution passent par le même tic que le couloir :
        // l'ordonnanceur de pulsation est arrêté dans l'état « rassurante »
        // (pulseRate = 0), on ne pouvait donc pas y accrocher les cloches.
        // À 500 ms avec une probabilité de 0.22, on tire environ une cloche
        // toutes les 2,3 s : assez espacée pour qu'on ne sature pas.
        pumpBell();
        const now = A.now();
        if (state.corridorNext === 0) scheduleNextCorridor();
        while (state.corridorNext < now + 0.5) {
            const idx = Math.floor(rand() * CORRIDOR_EVENTS.length);
            if (idx !== state.corridorLast) {
                state.corridorLast = idx;
                CORRIDOR_EVENTS[idx](state.corridorNext);
            }
            scheduleNextCorridor();
        }
    }

    // ==================== MUSIQUE : VOIX PERMANENTES ====================

    function buildMusicVoices() {
        const c = A.getContext();
        if (!c || voices.pad) return;

        // --- nappe ---
        const padGain = c.createGain();
        padGain.gain.value = 0.0001;
        const padFilter = c.createBiquadFilter();
        padFilter.type = 'lowpass';
        padFilter.Q.value = 0.8;
        padFilter.frequency.value = 400;
        padGain.connect(padFilter);
        padFilter.connect(A.busInput(MUSIC_BUS));

        const oscs = [];
        const count = 4;
        for (let i = 0; i < count; i++) {
            const osc = c.createOscillator();
            osc.type = 'sawtooth';
            const vg = c.createGain();
            vg.gain.value = 1 / (i + 1.4);
            osc.connect(vg);
            vg.connect(padGain);
            osc.start();
            oscs.push(osc);
        }
        voices.pad = oscs;
        voices.padGain = padGain;
        voices.padFilter = padFilter;

        // --- sous-basse ---
        const subGain = c.createGain();
        subGain.gain.value = 0.0001;
        const sub = c.createOscillator();
        sub.type = 'sine';
        sub.frequency.value = 73.42;
        sub.connect(subGain);
        subGain.connect(A.busInput(MUSIC_BUS));
        sub.start();
        voices.sub = sub;
        voices.subGain = subGain;

// La musique est câblée sur un nœud de sortie commun : la pulsation et les
    // cloches passent par lui, ce qui rend leurs fades RÉELLEMENT audibles.
    // (Câblées directement sur le bus, leurs GainNode n'avaient aucune source
    // et tous les fades étaient inaudibles.)
    const musicOut = c.createGain();
    musicOut.gain.value = 1;
    musicOut.connect(A.busInput(MUSIC_BUS));

    // --- pulsation (l'ostinato) ---
    const pulseGain = c.createGain();
    pulseGain.gain.value = 0.0001;
    pulseGain.connect(musicOut);
    voices.pulseGain = pulseGain;
    voices.pulseOut = pulseGain;

    // --- cloches de résolution ---
    const bellGain = c.createGain();
    bellGain.gain.value = 0.0001;
    bellGain.connect(musicOut);
    voices.bellGain = bellGain;

    voices.musicOut = musicOut;
    }

    function fadeTo(param, target, seconds) {
        const c = A.getContext();
        if (!c || !param) { if (param) param.value = target; return; }
        const t = c.currentTime;
        try {
            param.cancelScheduledValues(t);
            param.setValueAtTime(Math.max(0.0001, param.value), t);
            param.linearRampToValueAtTime(Math.max(0.0001, target), t + seconds);
        } catch (e) {
            param.value = target;
        }
    }

    /**
     * Applique un état : c'est ici que se joue le crossfade. On rampe les
     * gains, on glisse le filtre, on réaccorde les oscillateurs. Aucun nœud
     * n'est créé ni détruit — c'est ce qui rend la transition inaudible en
     * tant que transition.
     */
    function applyState(key, seconds) {
        const cfg = STATES[key] || STATES.off;
        const dur = seconds === undefined ? CROSSFADE : seconds;
        // On mémorise l'état AVANT de toucher au graphe : sans contexte audio
        // (avant le premier geste utilisateur, ou contexte indisponible), la
        // demande ne doit pas être perdue — elle sera appliquée au démarrage.
        state.mode = key;
        const c = A.getContext();
        if (!c) return;

        if (voices.pad) {
            const t = c.currentTime;
            const ratios = cfg.padRatios;
            for (let i = 0; i < voices.pad.length; i++) {
                const osc = voices.pad[i];
                const ratio = ratios[i % ratios.length];
                const f = Math.max(20, cfg.root * ratio);
                osc.frequency.setTargetAtTime(f, t, Math.max(0.05, dur * 0.35));
                osc.detune.setTargetAtTime(
                    (i % 2 === 0 ? 1 : -1) * cfg.padSpread, t, Math.max(0.05, dur * 0.4));
            }
            voices.padFilter.frequency.setTargetAtTime(cfg.padFilter, t, Math.max(0.05, dur * 0.4));
            fadeTo(voices.padGain.gain, cfg.padGain, dur);
        }

        if (voices.sub) {
            voices.sub.frequency.setTargetAtTime(cfg.subFreq, c.currentTime, Math.max(0.05, dur * 0.4));
            fadeTo(voices.subGain.gain, cfg.subGain, dur);
        }

        if (voices.pulseGain) {
            fadeTo(voices.pulseGain.gain, cfg.pulseGain, dur);
            state.pulsePattern = cfg.pulsePattern;
        }

        if (voices.bellGain) {
            fadeTo(voices.bellGain.gain, cfg.bellGain, dur);
            state.bellFreq = cfg.bellFreq;
        }

        if (cfg.pulseRate > 0 && state.pulseTimer === null) startPulseScheduler();
        if (cfg.pulseRate === 0 && state.pulseTimer !== null) stopPulseScheduler();
    }

    // ==================== MUSIQUE : PULSATION ====================

    function startPulseScheduler() {
        if (state.pulseTimer !== null) return;
        state.nextPulse = A.now() + 0.1;
        state.pulseTimer = A.managedInterval(pumpPulse, PULSE_TICK_MS);
    }

    function stopPulseScheduler() {
        A.clearManaged(state.pulseTimer);
        state.pulseTimer = null;
    }

    function pumpPulse() {
        const cfg = STATES[state.mode];
        if (!cfg || cfg.pulseRate <= 0) { stopPulseScheduler(); return; }
        const c = A.getContext();
        if (!c || c.state !== 'running') return;
        const horizon = c.currentTime + PULSE_LOOKAHEAD;

        // Le tempo de la musique suit la tension : 1x à 2,1x en état critique.
        const rate = cfg.pulseRate * (1 + state.tension * 0.6);
        const step = 1 / Math.max(0.2, rate);
        const pattern = state.pulsePattern || cfg.pulsePattern;

        while (state.nextPulse < horizon) {
            const degree = pattern[state.pulseIndex % Math.max(1, pattern.length)];
            if (degree) {
                // Le degré 2 fait monter la pulsation d'octave : la tension
                // s'entend sans que l'accord change.
                const freq = cfg.root * (degree === 2 ? 4 : 2);
                A.tone({
                    freq,
                    type: 'triangle',
                    dur: 0.16,
                    attack: 0.004,
                    gain: 1,
                    // `dest` et non `bus` : la note passe par voices.pulseGain,
                    // dont le gain vient de l'etat musical. C'est ce qui rend
                    // le fondu entre etats audible — et ce qui rend le champ
                    // `pulseGain` de STATES enfin utile au lieu d'etre un
                    // GainNode sans source.
                    dest: voices.pulseOut,
                    at: state.nextPulse
                });
            }
            state.pulseIndex++;
            state.nextPulse += step;
        }
    }

    // ==================== MUSIQUE : CLOCHES DE RÉSOLUTION ====================

    /**
     * Cloches clairsemées, reserves à l'état « rassurante ».
     *
     * `bellDensity` est une PROBABILITÉ PAR TICK, pas une fréquence : à 0.22
     * on tire environ une cloche toutes les cinq tentatives, ce qui donne un
     * irradiation dans le désordre — exactement ce qu'on veut sur une
     * résolution : pas un carillon régulier, mais la lumière qui revient par
     * touches.
     */
    function pumpBell() {
        const cfg = STATES[state.mode];
        if (!cfg || !cfg.bellDensity || cfg.bellDensity <= 0) return;
        const c = A.getContext();
        if (!c || c.state !== 'running') return;
        if (rand() > cfg.bellDensity) return;

        // Petite cloche de table : quatre partiels inharmoniques.
        A.bell({
            freq: cfg.bellFreq,
            dur: 2.2,
            gain: 1,
            partials: [1, 2.01, 2.98, 4.21],
            dest: voices.bellGain,
            at: c.currentTime + 0.01
        });
        // Une seconde cloche, une tierce plus haut et plus faible, 190 ms
        // après : de la profondeur sans transposition sèche, qui sonnerait
        // factice.
        A.bell({
            freq: cfg.bellFreq * 1.26,
            dur: 1.8,
            gain: 0.55,
            partials: [1, 2.76, 5.4],
            dest: voices.bellGain,
            at: c.currentTime + 0.19
        });
    }

    // ==================== TENSION CONTINUE ====================

    /**
     * Traduit les constantes en une tension continue dans [0, 1].
     * Chaque contribution est bornée pour qu'aucun paramètre ne domine seul :
     * une SpO2 à 74 seule ne doit pas faire saturer l'échelle.
     */
    function computeTension() {
        const desat = clamp01((98 - vitals.spo2) / 16);            // 0 à 1 entre 98 % et 82 %
        const tachy = clamp01((vitals.hr - 85) / 70);               // 0 à 1 entre 85 et 155 bpm
        const brady = clamp01((55 - vitals.hr) / 30);
        const hyper = clamp01((vitals.systolic - 150) / 80);
        const fever = clamp01((vitals.temperature - 38.5) / 2.5);

        // Moyenne pondérée, pas somme : le patient peut n'être franchement
        // pathologique que sur un seul paramètre.
        return clamp01(
            desat * 0.34 +
            tachy * 0.3 +
            brady * 0.14 +
            hyper * 0.1 +
            fever * 0.12
        );
    }

    function clamp01(v) {
        if (!Number.isFinite(v)) return 0;
        return v < 0 ? 0 : v > 1 ? 1 : v;
    }

    /**
     * Modulation continue appliquée à chaque mise à jour : la nappe se ferme
     * quand la tension monte, la ventilation se resserre aussi, et le couloir
     * s'anime. C'est le layer entre les états discrets.
     */
    function applyContinuousModulation() {
        const c = A.getContext();
        if (!c) return;
        const t = state.tension;
        const t0 = c.currentTime;

        if (voices.padFilter && STATES[state.mode]) {
            const base = STATES[state.mode].padFilter;
            // Entre +25 % et -35 % de la cutoff de l'état : la tension ferme
            // le filtre (plus sourd, plus oppressant) sans jamais le fermer.
            const target = base * (1.25 - 0.6 * t);
            voices.padFilter.frequency.setTargetAtTime(target, t0, 0.6);
        }
        if (voices.pad) {
            const spread = STATES[state.mode] ? STATES[state.mode].padSpread : 0;
            for (let i = 0; i < voices.pad.length; i++) {
                voices.pad[i].detune.setTargetAtTime(
                    (i % 2 === 0 ? 1 : -1) * (spread * (1 + t * 1.4)), t0, 0.8);
            }
        }
        if (voices.room && voices.room.low) {
            // La ventilation descend en fréquence quand le patient va mal :
            // l'air devient plus lourd.
            voices.room.low.frequency.setTargetAtTime(420 - 180 * t, t0, 1.2);
            voices.room.lowGain.gain.setTargetAtTime(0.05 + 0.035 * t, t0, 1.2);
        }
    }

    // ==================== FOCUS ====================

    /**
     * Ce que le joueur est en train d'écouter. Ausculter → on n'entend plus
     * que le stéthoscope ; interroger → la musique s'efface pour laisser
     * place à la parole.
     */
    function setFocus(focus) {
        if (!FOCUS_DUCK[focus]) return false;
        state.focus = focus;
        const cfg = FOCUS_DUCK[focus];
        const c = A.getContext();
        if (!c) return true;
        if (voices.padGain) fadeTo(voices.padGain.gain, (STATES[state.mode] || STATES.off).padGain * cfg.music, CROSSFADE * 0.6);
        if (voices.pulseGain) fadeTo(voices.pulseGain.gain, (STATES[state.mode] || STATES.off).pulseGain * cfg.music, CROSSFADE * 0.6);
        if (voices.bellGain) fadeTo(voices.bellGain.gain, (STATES[state.mode] || STATES.off).bellGain * cfg.music, CROSSFADE * 0.6);
        if (voices.room) {
            fadeTo(voices.room.out.gain, cfg.ambience, 0.8);
        }
        return true;
    }

    function getFocus() {
        return state.focus;
    }

    // ==================== API PUBLIQUE ====================

    function start() {
        if (state.started) return true;
        if (!A.getContext()) return false;
        buildRoomTone();
        buildMusicVoices();
        state.started = true;
        if (state.corridorTimer === null) {
            state.corridorTimer = A.managedInterval(pumpCorridor, 500);
        }
        fadeRoomIn();
        applyState(musicAllowed() ? 'calm' : 'off', VOICE_FADE);
        setFocus('idle');
        return true;
    }

    /** CONFIG.MUSIC_ENABLED — ne coupe que la partition, pas le lieu. */
    function musicAllowed() {
        const cfg = global.CONFIG;
        return !(cfg && Number.isFinite(cfg.MUSIC_ENABLED) && cfg.MUSIC_ENABLED === 0);
    }

    function stop(fade) {
        const seconds = fade === undefined ? CROSSFADE : fade;
        state.started = false;
        A.clearManaged(state.corridorTimer);
        A.clearManaged(state.pulseTimer);
        state.corridorTimer = null;
        state.pulseTimer = null;
        if (voices.room) fadeTo(voices.room.out.gain, 0.0001, seconds);
        if (voices.padGain) fadeTo(voices.padGain.gain, 0.0001, seconds);
        if (voices.subGain) fadeTo(voices.subGain.gain, 0.0001, seconds);
        if (voices.pulseGain) fadeTo(voices.pulseGain.gain, 0.0001, seconds);
        if (voices.bellGain) fadeTo(voices.bellGain.gain, 0.0001, seconds);
    }

    /**
     * Change d'état musical. `immediate` coupe le fondu (utile au chargement
     * d'un cas, pour ne pas faire connaître une transition).
     */
    function setState(key, immediate) {
        if (!STATES[key]) return false;
        if (!musicAllowed() && STATES[key].padGain > 0) return false;
        if (immediate) {
            applyState(key, 0.01);
        } else {
            applyState(key, CROSSFADE);
        }
        if (state.started && state.focus !== 'idle') setFocus(state.focus);
        return true;
    }

    function getState() {
        return state.mode;
    }

    function getTension() {
        return state.tension;
    }

    /**
     * Met à jour les constantes et recalcule la modulation continue.
     * N'ajuste pas l'état discret : c'est volontaire, pour que le joueur ne
     * sente pas la musique « sauter ».
     */
    function setVitals(next) {
        if (!next) return;
        for (const key of ['hr', 'spo2', 'rr', 'systolic', 'temperature']) {
            if (Number.isFinite(next[key])) vitals[key] = next[key];
        }
        state.tension = computeTension();
        applyContinuousModulation();
        if (state.started && state.corridorNext) scheduleNextCorridor();
    }

    function getVitals() {
        return Object.assign({}, vitals);
    }

    function isRunning() {
        return state.started;
    }

    function reset() {
        stop(0.2);
        state.mode = 'off';
        state.focus = 'idle';
        state.tension = 0;
        state.pulseIndex = 0;
        state.nextPulse = 0;
        state.corridorLast = undefined;
        state.seed = 20240501;
        rand = A.rng(state.seed);
        vitals.hr = 72; vitals.spo2 = 98; vitals.rr = 14; vitals.systolic = 120; vitals.temperature = 37;
    }

    global.MedGameAmbience = {
        start,
        stop,
        isRunning,
        setState,
        getState,
        setVitals,
        getVitals,
        getTension,
        setFocus,
        getFocus,
        musicAllowed,
        reset,

        // Introspection (tests)
        constants: {
            STATES,
            FOCUS_DUCK,
            CROSSFADE,
            CORRIDOR_MIN,
            CORRIDOR_MAX,
            AMBIENCE_BUS,
            MUSIC_BUS
        },
        computeTension,
        corridorEvents: CORRIDOR_EVENTS
    };
})(typeof window !== 'undefined' ? window : globalThis);
