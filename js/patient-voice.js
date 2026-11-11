/**
 * js/patient-voice.js — La voix de la consultation : micro de l'étudiant et
 * voix du patient.
 *
 * ENTRÉE (micro) : Web Speech API (`SpeechRecognition`, fr-FR, résultats
 * intermédiaires). Disponible sur Chrome et Edge ; ailleurs, le bouton micro
 * se masque et la saisie clavier reste. Les fins de tour sont décidées ici et
 * non par le navigateur : en appui (bouton ou touche maintenus), le tour
 * finit au relâchement ; en mains libres, après un court silence.
 *
 * SORTIE (patient) : deux fournisseurs, choisis à la volée.
 *   1. `server` — voix neuronale via le proxy TTS (`CONFIG.TTS_API_URL`).
 *      L'audio est décodé dans l'UNIQUE AudioContext (js/audio-core.js) et
 *      joué sur le bus `medical` : il suit le mute, les réglages et baisse
 *      l'ambiance et la musique (ducking). Un AnalyserNode donne l'amplitude
 *      réelle de la voix, qui anime la tête du patient 3D.
 *   2. `browser` — `speechSynthesis`, repli sans clé ni réseau. Sa sortie ne
 *      passe pas par Web Audio : le ducking est demandé à la main et
 *      l'amplitude est simulée à partir des frontières de mots.
 * Si le proxy répond qu'il n'est pas configuré, on bascule une fois pour
 * toute la session sur `browser`.
 *
 * Le texte arrive phrase par phrase (le Maître du Jeu stream son JSON) : la
 * première phrase part pendant que le modèle écrit encore la suivante.
 */
(function () {
    'use strict';

    const STORE_KEY = 'medgame.voice.v1';
    const HANDS_FREE_ENDPOINT_MS = 1300;
    const MAX_SENTENCE_CHARS = 400;

    const core = () => window.PatientLiveCore;
    const sound = () => window.MedGameSound;
    const emit = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail }));

    // ==================== RÉGLAGES ====================

    function loadSettings() {
        const out = { live: false, handsFree: true, voiceOut: true };
        try {
            const raw = localStorage.getItem(STORE_KEY);
            if (raw) Object.assign(out, JSON.parse(raw));
        } catch (e) { /* stockage indisponible : réglages par défaut */ }
        return out;
    }
    const settings = loadSettings();
    function saveSettings() {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* idem */ }
    }

    // ==================== SORTIE : VOIX DU PATIENT ====================

    const FEMALE_VOICES = /(denise|julie|hortense|eloise|vivienne|brigitte|amelie|amélie|audrey|aurelie|aurélie|celine|céline|marie|charline|coralie|jacqueline|josephine|joséphine|yvette|sylvie|caroline|virginie|ariane|female|femme)/i;
    const MALE_VOICES = /(henri|paul|claude|jerome|jérôme|alain|remy|rémy|antoine|fabrice|thomas|guillaume|maurice|jean|gerard|gérard|nicolas|mathieu|daniel|thierry|male|homme)/i;

    const speaker = {
        provider: null,          // 'server' | 'browser' | null
        serverOff: false,
        queue: [],
        current: null,           // élément en cours de lecture
        speaking: false,
        startedAt: 0,
        level: 0,                // amplitude lissée 0..1, lue par la 3D
        _target: 0,
        _analyser: null,
        _levelBuf: null,
        _duckTimer: null,
        _raf: 0,
        _voices: [],
        _generation: 0
    };

    function serverUrl() {
        return window.CONFIG?.TTS_API_URL || '';
    }

    function refreshVoices() {
        try {
            speaker._voices = (window.speechSynthesis?.getVoices?.() || []).filter(v => /^fr/i.test(v.lang));
        } catch (e) { speaker._voices = []; }
    }
    if (window.speechSynthesis) {
        refreshVoices();
        try { window.speechSynthesis.addEventListener('voiceschanged', refreshVoices); } catch (e) { /* vieux navigateurs */ }
    }

    function pickBrowserVoice(pros) {
        const voices = speaker._voices;
        if (!voices.length) return null;
        const quality = v => (/natural|neural|online|google|premium|enhanced/i.test(v.name) ? 2 : 0) + (/fr-FR/i.test(v.lang) ? 1 : 0);
        const wantFemale = pros.female || pros.child;
        const bySex = voices.filter(v => (wantFemale ? FEMALE_VOICES : MALE_VOICES).test(v.name));
        const pool = bySex.length ? bySex : voices;
        return pool.slice().sort((a, b) => quality(b) - quality(a))[0];
    }

    /** Voix serveur : nom de timbre selon le patient (OpenAI-compatible). */
    function serverVoice(pros) {
        if (pros.child) return 'shimmer';
        if (pros.female) return pros.elderly ? 'sage' : 'coral';
        return pros.elderly ? 'ash' : 'onyx';
    }

    function startDucking() {
        stopDucking();
        const s = sound();
        if (!s?.duck) return;
        s.duck('medical');
        speaker._duckTimer = setInterval(() => { try { s.duck('medical'); } catch (e) { /* contexte fermé */ } }, 260);
    }
    function stopDucking() {
        if (speaker._duckTimer) clearInterval(speaker._duckTimer);
        speaker._duckTimer = null;
    }

    // Boucle d'amplitude : un seul rAF tant que le patient parle.
    function levelLoop() {
        const now = performance.now();
        if (speaker._analyser && speaker.current?.provider === 'server') {
            const buf = speaker._levelBuf;
            speaker._analyser.getByteTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) {
                const v = (buf[i] - 128) / 128;
                sum += v * v;
            }
            speaker._target = Math.min(1, Math.sqrt(sum / buf.length) * 5.5);
        } else if (speaker.speaking) {
            // Synthèse navigateur : enveloppe syllabique simulée, relancée à chaque mot.
            const t = now / 1000;
            const syll = 0.5 + 0.5 * Math.sin(t * 15.7) * Math.sin(t * 6.1 + 1.3);
            speaker._target = Math.max(speaker._target * 0.9, 0.25 + 0.55 * Math.abs(syll));
        } else {
            speaker._target = 0;
        }
        const k = speaker._target > speaker.level ? 0.55 : 0.18;
        speaker.level += (speaker._target - speaker.level) * k;
        if (speaker.speaking || speaker.level > 0.01) {
            speaker._raf = requestAnimationFrame(levelLoop);
        } else {
            speaker.level = 0;
            speaker._raf = 0;
        }
    }
    function ensureLevelLoop() {
        if (!speaker._raf) speaker._raf = requestAnimationFrame(levelLoop);
    }

    async function fetchServerAudio(item) {
        const url = serverUrl();
        if (!url || speaker.serverOff) return null;
        let res;
        try {
            res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: item.text,
                    voice: serverVoice(item.prosody),
                    instructions: item.prosody.instructions,
                    speed: item.prosody.rate
                }),
                signal: item.abort.signal
            });
        } catch (e) {
            // Proxy injoignable (serveur MCP non lancé) : inutile de réessayer à chaque phrase.
            if (e.name !== 'AbortError') speaker.serverOff = true;
            return null;
        }
        if (res.status === 404 || res.status === 501 || res.status === 503) {
            // Proxy absent ou sans clé : la voix navigateur prend le relais pour la session.
            speaker.serverOff = true;
            return null;
        }
        if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
        return res.arrayBuffer();
    }

    function playServer(item, bytes) {
        return new Promise((resolve, reject) => {
            const s = sound();
            s?.init?.();
            const ctx = s?.getContext?.();
            if (!ctx) { reject(new Error('AudioContext indisponible')); return; }
            ctx.decodeAudioData(bytes.slice(0)).then((buffer) => {
                if (item.cancelled) { resolve(); return; }
                const src = ctx.createBufferSource();
                src.buffer = buffer;
                const gain = ctx.createGain();
                gain.gain.value = 1.15;
                if (!speaker._analyser || speaker._analyser.context !== ctx) {
                    speaker._analyser = ctx.createAnalyser();
                    speaker._analyser.fftSize = 512;
                    speaker._levelBuf = new Uint8Array(speaker._analyser.fftSize);
                }
                src.connect(gain);
                gain.connect(speaker._analyser);
                gain.connect(s.busInput('medical'));
                item.stopFn = () => { try { src.stop(); } catch (e) { /* déjà arrêtée */ } };
                src.onended = () => {
                    try { gain.disconnect(); } catch (e) { /* idem */ }
                    resolve();
                };
                src.start();
                ensureLevelLoop();
            }, reject);
        });
    }

    function playBrowser(item) {
        return new Promise((resolve) => {
            const synth = window.speechSynthesis;
            const Utterance = window.SpeechSynthesisUtterance;
            if (!synth || !Utterance) { resolve(); return; }
            const u = new Utterance(item.text);
            u.lang = 'fr-FR';
            const v = pickBrowserVoice(item.prosody);
            if (v) u.voice = v;
            u.rate = item.prosody.rate;
            u.pitch = item.prosody.pitch;
            u.volume = sound()?.isMuted?.() ? 0 : 1;
            let done = false;
            const finish = () => { if (!done) { done = true; clearTimeout(guard); resolve(); } };
            u.onboundary = () => { speaker._target = 0.9 + Math.random() * 0.1; };
            u.onend = finish;
            u.onerror = finish;
            // Garde-fou : certains moteurs n'émettent jamais `end`.
            const guard = setTimeout(finish, 2500 + item.text.length * 110);
            item.stopFn = () => { try { synth.cancel(); } catch (e) { /* rien */ } finish(); };
            synth.speak(u);
            ensureLevelLoop();
        });
    }

    async function pump() {
        if (speaker.current || !speaker.queue.length) return;
        const item = speaker.queue.shift();
        speaker.current = item;
        const gen = speaker._generation;
        if (!speaker.speaking) {
            speaker.speaking = true;
            speaker.startedAt = performance.now();
            startDucking();
            emit('medgame:voice-speaking', { speaking: true });
        }
        emit('medgame:voice-sentence', { text: item.text, emotion: item.prosody.emotion, turnId: item.turnId });
        try {
            let bytes = null;
            if (item.audio) {
                try { bytes = await item.audio; } catch (e) { bytes = null; }
            }
            if (item.cancelled || gen !== speaker._generation) return;
            if (bytes) {
                item.provider = 'server';
                speaker.provider = 'server';
                await playServer(item, bytes);
            } else {
                item.provider = 'browser';
                speaker.provider = 'browser';
                await playBrowser(item);
            }
        } catch (e) {
            console.warn('[PatientVoice] lecture impossible, repli navigateur :', e.message);
            if (!item.cancelled && gen === speaker._generation) {
                item.provider = 'browser';
                await playBrowser(item);
            }
        } finally {
            if (speaker.current === item) speaker.current = null;
            if (gen === speaker._generation) {
                if (speaker.queue.length) {
                    pump();
                } else {
                    endSpeaking();
                }
            }
        }
    }

    function endSpeaking() {
        if (!speaker.speaking) return;
        speaker.speaking = false;
        stopDucking();
        emit('medgame:voice-speaking', { speaking: false });
    }

    /**
     * Met une ou plusieurs phrases dans la file de lecture.
     * @param {string} text
     * @param {{prosody?:object, turnId?:string}} [opts]
     */
    function speak(text, opts = {}) {
        const C = core();
        const clean = C ? C.speakableText(text) : String(text || '').trim();
        if (!clean) return;
        const prosody = opts.prosody || (C ? C.prosody({}) : { rate: 1, pitch: 1, instructions: '' });
        const parts = C ? C.takeSentences(clean, 0, true).sentences : [clean];
        for (const part of parts) {
            const item = {
                text: part.slice(0, MAX_SENTENCE_CHARS),
                prosody,
                turnId: opts.turnId || null,
                abort: new AbortController(),
                cancelled: false,
                stopFn: null,
                provider: null,
                audio: null
            };
            // Requête lancée dès la mise en file : la phrase suivante se
            // synthétise pendant que la précédente est lue.
            if (serverUrl() && !speaker.serverOff) {
                item.audio = fetchServerAudio(item);
                item.audio.catch(() => { /* géré dans pump */ });
            }
            speaker.queue.push(item);
        }
        pump();
    }

    /**
     * Coupe le patient. Renvoie depuis combien de temps il parlait (ms), pour
     * juger d'une interruption.
     */
    function stopSpeaking() {
        const was = speaker.speaking;
        const elapsed = was ? performance.now() - speaker.startedAt : 0;
        speaker._generation++;
        for (const it of speaker.queue) { it.cancelled = true; it.abort.abort(); }
        speaker.queue = [];
        const cur = speaker.current;
        if (cur) { cur.cancelled = true; cur.abort.abort(); cur.stopFn?.(); }
        speaker.current = null;
        try { window.speechSynthesis?.cancel(); } catch (e) { /* rien */ }
        endSpeaking();
        return { wasSpeaking: was, elapsedMs: elapsed };
    }

    // ==================== ENTRÉE : MICRO ====================

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;

    const listener = {
        supported: !!Recognition,
        active: false,
        mode: null,               // 'hold' | 'handsfree'
        rec: null,
        finalText: '',
        interimText: '',
        _endpointTimer: null,
        _callbacks: null,
        _finished: false,
        _hadSpeech: false
    };

    function clearEndpoint() {
        if (listener._endpointTimer) clearTimeout(listener._endpointTimer);
        listener._endpointTimer = null;
    }

    function finishListening(reason) {
        if (listener._finished) return;
        listener._finished = true;
        clearEndpoint();
        const text = `${listener.finalText} ${listener.interimText}`.replace(/\s+/g, ' ').trim();
        const cb = listener._callbacks;
        listener.active = false;
        try { listener.rec?.stop(); } catch (e) { /* déjà arrêté */ }
        listener.rec = null;
        emit('medgame:voice-listening', { listening: false, reason });
        cb?.onFinal?.(text, reason);
    }

    /**
     * Ouvre le micro.
     * @param {'hold'|'handsfree'} mode
     * @param {{onInterim?:(t:string)=>void, onFinal?:(t:string, reason:string)=>void, onError?:(e:string)=>void}} callbacks
     */
    function listen(mode, callbacks = {}) {
        if (!listener.supported) { callbacks.onError?.('unsupported'); return false; }
        if (listener.active) cancelListening();
        let rec;
        try {
            rec = new Recognition();
        } catch (e) {
            callbacks.onError?.('unsupported');
            return false;
        }
        rec.lang = 'fr-FR';
        rec.interimResults = true;
        rec.continuous = true;
        rec.maxAlternatives = 1;
        listener.rec = rec;
        listener.mode = mode;
        listener.active = true;
        listener.finalText = '';
        listener.interimText = '';
        listener._callbacks = callbacks;
        listener._finished = false;
        listener._hadSpeech = false;

        rec.onresult = (ev) => {
            let interim = '';
            for (let i = ev.resultIndex; i < ev.results.length; i++) {
                const r = ev.results[i];
                if (r.isFinal) listener.finalText += ` ${r[0].transcript}`;
                else interim += r[0].transcript;
            }
            listener.interimText = interim;
            listener._hadSpeech = true;
            const shown = `${listener.finalText} ${interim}`.replace(/\s+/g, ' ').trim();
            callbacks.onInterim?.(shown);
            emit('medgame:voice-interim', { text: shown });
            if (listener.mode === 'handsfree') {
                clearEndpoint();
                listener._endpointTimer = setTimeout(() => finishListening('endpoint'), HANDS_FREE_ENDPOINT_MS);
            }
        };
        rec.onerror = (ev) => {
            const code = ev?.error || 'error';
            if (code === 'no-speech' || code === 'aborted') return;
            callbacks.onError?.(code);
            if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') {
                listener._finished = true;
                listener.active = false;
                emit('medgame:voice-listening', { listening: false, reason: code });
            }
        };
        rec.onend = () => {
            if (listener._finished) return;
            // Chrome coupe seul après un long silence : en mains libres sans
            // parole, on relance ; sinon on clôt le tour avec ce qu'on a.
            if (listener.mode === 'handsfree' && !listener._hadSpeech && listener.active) {
                try { rec.start(); return; } catch (e) { /* retombe sur la clôture */ }
            }
            finishListening('ended');
        };
        try {
            rec.start();
        } catch (e) {
            listener.active = false;
            callbacks.onError?.('start-failed');
            return false;
        }
        emit('medgame:voice-listening', { listening: true, mode });
        return true;
    }

    /** Fin de l'appui : le tour part avec ce qui a été entendu. */
    function release() {
        if (!listener.active) return;
        // Laisser 350 ms au moteur pour livrer le dernier résultat final.
        clearEndpoint();
        listener._endpointTimer = setTimeout(() => finishListening('release'), 350);
        try { listener.rec?.stop(); } catch (e) { /* rien */ }
    }

    /** Abandon sans envoi. */
    function cancelListening() {
        if (!listener.active && !listener.rec) return;
        listener._finished = true;
        clearEndpoint();
        listener.active = false;
        try { listener.rec?.abort(); } catch (e) { /* rien */ }
        listener.rec = null;
        emit('medgame:voice-listening', { listening: false, reason: 'cancel' });
    }

    window.PatientVoice = {
        settings,
        setSetting(key, value) {
            settings[key] = value;
            saveSettings();
            emit('medgame:voice-settings', { ...settings });
        },
        // Sortie
        speak,
        stopSpeaking,
        isSpeaking: () => speaker.speaking,
        getLevel: () => speaker.level,
        getProvider: () => speaker.provider || (serverUrl() && !speaker.serverOff ? 'server' : 'browser'),
        canSpeak: () => !!(serverUrl() && !speaker.serverOff) || !!window.speechSynthesis,
        // Entrée
        canListen: () => listener.supported,
        isListening: () => listener.active,
        listeningMode: () => listener.mode,
        listen,
        release,
        cancelListening
    };
})();
