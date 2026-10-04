/**
 * audio-medical.js — Couche audio « patient » de MedGame
 *
 * Tout ce qui vient du corps du patient : cœur, respiration, souffle
 * cardiaque, bip du scope, alarmes. Ces sons ne sont pas décoratifs, ils
 * portent l'information clinique — c'est le seul endroit du jeu où le son
 * EST une donnée.
 *
 * L'ORDONNANCEUR
 * --------------
 * Un seul ordonnanceur à anticipation (« lookahead ») pilote le cœur, la
 * respiration et le bip ECG. L'ancien code faisait un `setTimeout` récursif
 * par battement : la dérive s'accumulait (un onglet en arrière-plan fait
 * expirer les timers en retard), et surtout le bip ECG ne tombait plus sur
 * l'onde R. Ici on programme les événements sur `ctx.currentTime + marge`,
 * avec 25 ms de tick et 180 ms d'anticipation : même si la page est gelée
 * 300 ms, la reprise est sans trou et sans chevauchement.
 *
 * LE CŒUR
 * -------
 * Deux temps, pas un bip. S1 (fermeture des valves auriculo-ventriculaires)
 * est un impact grave avec un peu de corps filtré ; S2 (fermeture
 * semi-lunaire) est plus court, plus aigu et nettement plus faible.
 *
 * L'écart S1-S2 n'est pas fixe : il se comprime quand la fréquence
 * cardiaque monte, comme en physiologie. À 60 bpm il vaut 160 ms, à 120 bpm
 * 118 ms, à 180 bpm 75 ms. Un cœur audible ne peut pas être programmé avec un
 * intervalle fixe — c'est justement ce qui fait « médical ».
 *
 * Le filtre de muffled représente ce qu'on entend à travers la paroi
 * thoracique ou au stéthoscope : une passe-bas dont la fréquence s'ouvre
 * quand on ausculte et se referme quand on écoute à distance.
 *
 * Chargement : script classique, après js/audio-core.js et js/audio-sfx.js.
 */

(function (global) {
    'use strict';

    const A = global.MedGameSound;
    if (!A) {
        console.warn('[audio-medical] js/audio-core.js absent — couche médicale non chargée');
        return;
    }

    // ==================== CONSTANTES ====================

    const TICK_MS = 25;          // période de l'ordonnanceur
    const LOOKAHEAD = 0.18;      // anticipation, en secondes
    const HR_MIN = 25;
    const HR_MAX = 220;
    const BUS = 'medical';

    /** Écarts S1-S2 (s) en fonction de la fréquence cardiaque. */
    const S2_GAP_AT_60 = 0.160;
    const S2_GAP_AT_180 = 0.075;


    const ALARM_PATTERNS = {
        // Motif de l'avertissement : deux bips, le second plus bas.
        warning: { period: 1.4, tones: [[880, 0.11], [660, 0.11]], gain: 0.10 },
        // Motif critique : quatre bips rapides, plus haut et plus serrés.
        critical: { period: 1.1, tones: [[1050, 0.09], [880, 0.09], [1050, 0.09], [880, 0.09]], gain: 0.13 },
        // Défaillance respiratoire : bip unique grave, lent, insistant.
        apnea: { period: 2.0, tones: [[520, 0.34]], gain: 0.11 },
        // « Code bleu » : le long bip d'appel, celui qu'on entend dans tout l'étage.
        codeBlue: { period: 2.6, tones: [[740, 0.55]], gain: 0.14 },
        // Alarme de ventilateur : le bip sec et régulier du Scope.
        lowSpO2: { period: 1.6, tones: [[960, 0.08], [960, 0.08], [700, 0.14]], gain: 0.10 }
    };

    // ==================== ÉTAT ====================

    const state = {
        hr: 72,
        rr: 14,             // fréquence respiratoire (cycles/min)
        spo2: 98,
        systolic: 120,
        temperature: 37,
        murmur: null,       // null | 'systolique' | 'diastolique' | 'continu'
        rhythm: 'sinus',    // 'sinus' | 'fibrillation'
        stethoscope: false, // le joueur ausculte : le son s'ouvre
        seed: 1337
    };

    const running = {
        heartbeat: false,
        ecg: false,
        breathing: false,
        alarm: null
    };

    let timerId = null;
    let nextHeartbeat = 0;
    let nextBreath = 0;
    let nextEcg = 0;
    let nextAlarm = 0;

    let rand = A.rng(state.seed);

    // ==================== SYNTHÈSE DU CŒUR ====================

    /**
     * Un temps du cœur.
     * @param {number} at      instant absolu de départ
     * @param {'S1'|'S2'} which
     * @param {number} level   0..1, intensité (FC élevée = plus intense)
     */
    function playHeartSound(at, which, level) {
        const isS1 = which === 'S1';
        const rand_jitter = (rand() - 0.5) * 0.04;

        if (isS1) {
            // Impact grave : la composante énergétique du premier bruit.
            A.thump({
                freq: 58 * (1 + rand_jitter),
                freqTo: 31,
                dur: 0.13,
                attack: 0.006,
                gain: 0.34 * level,
                bus: BUS,
                at
            });
            // Corps filtré : ce qui donne au B1 son timbre de « boum » et non de « bip ».
            A.noise({
                dur: 0.07,
                gain: 0.1 * level,
                filter: 'bandpass',
                freq: 165,
                freqTo: 95,
                q: 1.3,
                attack: 0.003,
                seed: 101 + Math.floor(state.hr),
                bus: BUS,
                at
            });
        } else {
            // S2 : plus court, plus haut, et bien plus faible — c'est ce rapport
            // de niveaux qui fait « lub-dub » plutôt que « bip bip ».
            A.thump({
                freq: 84 * (1 + rand_jitter),
                freqTo: 52,
                dur: 0.08,
                attack: 0.005,
                gain: 0.19 * level,
                bus: BUS,
                at
            });
            A.noise({
                dur: 0.045,
                gain: 0.055 * level,
                filter: 'bandpass',
                freq: 320,
                freqTo: 190,
                q: 1.6,
                attack: 0.002,
                seed: 211 + Math.floor(state.hr),
                bus: BUS,
                at
            });
        }
    }

    /** Un cycle cardiaque complet : S1 puis S2 à l'écart physiologique. */
    function scheduleBeat(at) {
        const level = 0.55 + 0.45 * heartIntensity();
        playHeartSound(at, 'S1', level);
        playHeartSound(at + s2Gap(), 'S2', level * 0.9);
        scheduleMurmur(at, level);
    }

    /**
     * Écart S1-S2 en secondes. Se comprime avec la FC : c'est le détail qui
     * fait qu'un cœur à 140 bpm ne « sonne » pas comme un cœur à 60.
     */
    function s2Gap() {
        const t = clamp((state.hr - 60) / 120, 0, 1);
        return S2_GAP_AT_60 + (S2_GAP_AT_180 - S2_GAP_AT_60) * t;
    }

    /**
     * Intensité du souffle, selon sa nature :
     *   systolique  — entre S1 et S2 (holosystolique : toute la systole)
     *   diastolique  — après S2
     *   continu      — sans interruption
     */
    function scheduleMurmur(at, level) {
        if (!state.murmur) return;
        const period = 60 / state.hr;
        const cfg = {
            // Souffle systolique : bruit de turbulence médio, monte légèrement.
            systolique: { dur: period * 0.72, at: 0, from: 190, to: 260, q: 3.2, gain: 0.055 },
            // Souffle diastolique : plus grave, plus tard.
            diastolique: { dur: period * 0.45, at: s2Gap(), from: 150, to: 190, q: 4.0, gain: 0.045 },
            // Souffle continu : présent sur tout le cycle.
            continu: { dur: period * 0.9, at: 0, from: 210, to: 240, q: 3.6, gain: 0.05 }
        }[state.murmur];
        if (!cfg) return;

        A.noise({
            dur: cfg.dur,
            gain: cfg.gain * level,
            filter: 'bandpass',
            freq: cfg.from,
            freqTo: cfg.to,
            q: cfg.q,
            attack: Math.min(0.09, cfg.dur * 0.35),
            seed: 307 + Math.floor(state.hr),
            bus: BUS,
            at: at + cfg.at
        });
    }

    /** 0 au repos, 1 en tachycardie franche. */
    function heartIntensity() {
        return clamp((state.hr - 55) / 110, 0, 1);
    }

    // ==================== SYNTHÈSE DE LA RESPIRATION ====================

    /**
     * Un cycle respiratoire. L'expiration est plus longue et plus audible que
     * l'inspiration ; son niveau monte quand la SpO2 chute, parce qu'un
     * patient en détresse respire plus bruyamment.
     */
    function playBreathCycle(at, level) {
        const distress = 1 - clamp((state.spo2 - 82) / 16, 0, 1);
        const cycle = 60 / Math.max(4, state.rr);
        const insp = cycle * 0.42;

        A.breath({
            dur: insp,
            gain: 0.022 + 0.03 * distress,
            intensity: 0.35 + 0.4 * distress,
            freq: 430,
            freqTo: 780,
            seed: 401 + Math.floor(state.rr),
            bus: 'ambience',
            at
        });
        A.breath({
            dur: cycle * 0.5,
            gain: 0.03 + 0.05 * distress,
            intensity: 0.4 + 0.5 * distress,
            freq: 700,
            freqTo: 380,
            attack: 0.14,
            seed: 409 + Math.floor(state.rr),
            bus: 'ambience',
            at: at + insp + cycle * 0.08
        });
    }

    // ==================== BIP ECG ====================

    /**
     * Bip du scope : 880 Hz (La4, la référence des moniteurs), 55 ms, avec un
     * partiel à 1760 Hz à 15 % — c'est ce partiel qui donne au haut-parleur
     * du moniteur son timbre « plastique » caractéristique.
     */
    function playEcgBeep(at) {
        A.tone({ freq: 880, type: 'sine', dur: 0.055, attack: 0.004, gain: 0.055, bus: BUS, at });
        A.tone({ freq: 1760, type: 'sine', dur: 0.035, attack: 0.003, gain: 0.009, bus: BUS, at });
    }

    // ==================== ORDONNANCEUR ====================

    function ensureTimer() {
        if (timerId !== null) return;
        timerId = A.managedInterval(tick, TICK_MS);
    }

    function stopTimerIfIdle() {
        if (running.heartbeat || running.ecg || running.breathing || running.alarm) return;
        A.clearManaged(timerId);
        timerId = null;
    }

    function tick() {
        if (!A.getContext()) { stopTimerIfIdle(); return; }
        const c = A.getContext();
        if (c.state !== 'running') return;   // rien ne s'écoule, on n'insiste pas
        const horizon = c.currentTime + LOOKAHEAD;

        if (running.heartbeat) pumpHeartbeat(horizon);
        if (running.ecg) pumpEcg(horizon);
        if (running.breathing) pumpBreathing(horizon);
        if (running.alarm) pumpAlarm(horizon);
    }

    function pumpHeartbeat(horizon) {
        if (nextHeartbeat === 0) nextHeartbeat = A.now() + 0.05;
        while (nextHeartbeat < horizon) {
            scheduleBeat(nextHeartbeat);
            nextHeartbeat += beatPeriod();
        }
    }

    /**
     * Période entre deux S1. En fibrillation auriculaire l'intervalle n'est
     * pas régulier : on ajoute un jitter déterministe (graine fixe, donc le
     * même cas sonne pareil à chaque partie).
     */
    function beatPeriod() {
        const base = 60 / clamp(state.hr, HR_MIN, HR_MAX);
        if (state.rhythm !== 'fibrillation') return base;
        return base * (0.86 + rand() * 0.28);
    }

    function pumpEcg(horizon) {
        if (nextEcg === 0) nextEcg = A.now() + 0.05;
        while (nextEcg < horizon) {
            playEcgBeep(nextEcg);
            nextEcg += 60 / clamp(state.hr, HR_MIN, HR_MAX);
        }
    }

    function pumpBreathing(horizon) {
        if (nextBreath === 0) nextBreath = A.now() + 0.1;
        while (nextBreath < horizon) {
            playBreathCycle(nextBreath, 1);
            nextBreath += 60 / Math.max(4, state.rr);
        }
    }

    function pumpAlarm(horizon) {
        const pattern = ALARM_PATTERNS[running.alarm];
        if (!pattern) { stopAlarm(); return; }
        if (nextAlarm === 0) nextAlarm = A.now() + 0.02;
        while (nextAlarm < horizon) {
            let t = nextAlarm;
            for (const [freq, dur] of pattern.tones) {
                scheduleAlarmTone(t, freq, dur, pattern.gain);
                t += dur + 0.045;
            }
            nextAlarm += pattern.period;
        }
    }

    function scheduleAlarmTone(at, freq, dur, gain) {
        // En mode calme on coupe l'alarme : c'est la raison d'être du mode.
        if (A.isCalmMode() && A.isStressful('alarm')) return;
        A.tone({ freq, type: 'triangle', dur, attack: 0.006, gain, bus: BUS, at });
        A.duck('medical');
    }

    // ==================== API PUBLIQUE ====================

    function clamp(v, lo, hi) {
        if (!Number.isFinite(v)) return lo;
        return v < lo ? lo : v > hi ? hi : v;
    }

    /**
     * Point d'entrée unique pour l'état clinique. Tout le reste du module
     * observe cet objet — il n’y a pas de deuxième source de vérité.
     * @param {object} vitals {hr, rr, spo2, systolic, temperature, murmur, rhythm}
     */
    function applyVitals(vitals) {
        if (!vitals) return;
        if (Number.isFinite(vitals.hr)) state.hr = clamp(vitals.hr, HR_MIN, HR_MAX);
        if (Number.isFinite(vitals.rr)) state.rr = clamp(vitals.rr, 4, 40);
        if (Number.isFinite(vitals.spo2)) state.spo2 = clamp(vitals.spo2, 40, 100);
        if (Number.isFinite(vitals.systolic)) state.systolic = clamp(vitals.systolic, 50, 260);
        if (Number.isFinite(vitals.temperature)) state.temperature = vitals.temperature;
        if (vitals.murmur !== undefined) state.murmur = vitals.murmur;
        if (vitals.rhythm !== undefined) state.rhythm = vitals.rhythm;
        if (vitals.seed !== undefined) {
            state.seed = vitals.seed >>> 0;
            rand = A.rng(state.seed);
        }
    }

    function getVitals() {
        return Object.assign({}, state);
    }

    function getHeartRate() {
        return state.hr;
    }

    function startHeartbeat(heartRate) {
        if (Number.isFinite(heartRate)) applyVitals({ hr: heartRate });
        if (!A.getContext()) return false;
        running.heartbeat = true;
        nextHeartbeat = 0;
        ensureTimer();
        return true;
    }

    function stopHeartbeat() {
        running.heartbeat = false;
        nextHeartbeat = 0;
        stopTimerIfIdle();
    }

    function isHeartbeatRunning() {
        return running.heartbeat;
    }

    /**
     * Change la fréquence sans couper la boucle : l'ordonnanceur prend la
     * nouvelle période au prochain battement, il n'y a donc pas de saut.
     */
    function updateHeartRate(bpm) {
        if (!Number.isFinite(bpm) || bpm <= 0) return;
        applyVitals({ hr: bpm });
    }

    function startECGBeep(heartRate) {
        if (Number.isFinite(heartRate)) applyVitals({ hr: heartRate });
        if (!A.getContext()) return false;
        running.ecg = true;
        nextEcg = 0;
        ensureTimer();
        return true;
    }

    function stopECGBeep() {
        running.ecg = false;
        nextEcg = 0;
        stopTimerIfIdle();
    }

    function startBreathing(respiratoryRate) {
        if (Number.isFinite(respiratoryRate)) applyVitals({ rr: respiratoryRate });
        if (!A.getContext()) return false;
        running.breathing = true;
        nextBreath = 0;
        ensureTimer();
        return true;
    }

    function stopBreathing() {
        running.breathing = false;
        nextBreath = 0;
        stopTimerIfIdle();
    }

    function startAlarm(level) {
        if (!ALARM_PATTERNS[level]) level = 'warning';
        if (!A.getContext()) return false;
        running.alarm = level;
        nextAlarm = 0;
        ensureTimer();
        return true;
    }

    function stopAlarm() {
        running.alarm = null;
        nextAlarm = 0;
        stopTimerIfIdle();
    }

    function getAlarm() {
        return running.alarm;
    }

    /**
     * Ouvre le son du cœur quand le joueur pose le stéthoscope. Sans ça, le
     * joueur n'entendrait jamais la différence entre ausculter et simplement
     * regarder le scope.
     */
    function setStethoscope(on) {
        state.stethoscope = !!on;
    }

    function isStethoscopeOn() {
        return state.stethoscope;
    }

    /** Un coup de cœur isolé (télétransmission, scope à la pause). */
    function playSingleBeat() {
        const at = A.now() + 0.005;
        const level = 0.55 + 0.45 * heartIntensity();
        playHeartSound(at, 'S1', level);
        playHeartSound(at + s2Gap(), 'S2', level * 0.9);
        A.duck('medical');
    }

    // ==================== API DE COMPATIBILITÉ ====================
    // Conservée parce que js/three-scene.js, js/three-manager.js,
    // js/clinicalAgentAI.js et js/game.js appellent ces méthodes.
    // Elles délèguent au registre SFX : un seul endroit définit le timbre.

    function playMeasureSound() { A.play('ecgBeep'); }
    function playUnlockSound() { A.play('unlock'); }
    function playErrorSound() { A.play('error'); }
    function playSuccessSound() { A.play('success'); }
    // Existait dans les appels de js/three-scene.js:115 mais n'avait jamais
    // été défini sur la classe : l'appel était silencieusement sans effet.
    function playAlert() { A.play('alert'); }

    function init() { return A.init(); }
    function resume() { A.resume(); }
    function setVolume(v) { A.setBusVolume(BUS, v); }
    function mute() { A.setMuted(true); }
    function unmute() { A.setMuted(false); }

    /**
     * Réinitialise complètement la couche patient (changement de cas, sortie
     * de la page 3D). On ne détruit pas le contexte : il est partagé avec le
     * reste du jeu.
     */
    function reset() {
        stopHeartbeat();
        stopECGBeep();
        stopBreathing();
        stopAlarm();
        A.clearManaged(timerId);
        timerId = null;
        state.hr = 72;
        state.rr = 14;
        state.spo2 = 98;
        state.systolic = 120;
        state.temperature = 37;
        state.murmur = null;
        state.rhythm = 'sinus';
        state.stethoscope = false;
        state.seed = 1337;
        rand = A.rng(state.seed);
        nextHeartbeat = nextEcg = nextBreath = nextAlarm = 0;
    }

    /**
     * Réinitialise complètement la couche patient (changement de cas, sortie
     * de la page 3D). On ne détruit pas le contexte : il est partagé avec le
     * reste du jeu.
     *
     * `destroy` est un alias conservé pour js/three-scene.js:880 qui appelle
     * `medicalAudio.destroy()`. Comme `window.medicalAudio` pointe
     * directement sur cette couche (et non plus sur une classe séparée),
     * l’alias doit exister ici, sinon l’appel lèverait une TypeError en
     * sortant du mode 3D.
     */
    function destroy() {
        reset();
    }

    // ==================== EXPOSITION ====================

    const MedGameMedical = {
        // État clinique
        applyVitals,
        getVitals,
        getHeartRate,
        setStethoscope,
        isStethoscopeOn,
        s2Gap,
        heartIntensity,

        // Cœur
        startHeartbeat,
        stopHeartbeat,
        updateHeartRate,
        isHeartbeatRunning,
        playSingleBeat,

        // Respiration
        startBreathing,
        stopBreathing,

        // Scope
        startECGBeep,
        stopECGBeep,

        // Alarmas
        startAlarm,
        stopAlarm,
        getAlarm,

        /**
     * API de compatibilité : ces méthodes étaient appelées par le code 3D
     * et sont conservées telles quelles. Elles délèguent au registre SFX —
     * un seul endroit définit le timbre.
     */
        init,
        resume,
        setVolume,
        mute,
        unmute,
        playMeasureSound,
        playUnlockSound,
        playErrorSound,
        playSuccessSound,
        playAlert,
        reset,
        destroy,

        // Introspection (tests)
        constants: {
            TICK_MS,
            LOOKAHEAD,
            HR_MIN,
            HR_MAX,
            BUS,
            S2_GAP_AT_60,
            S2_GAP_AT_180,
            ALARM_PATTERNS
        }
    };

    global.MedGameMedical = MedGameMedical;

    // Raccourci historique : js/three-scene.js et consorts utilisent
    // window.medicalAudio. On garde l'alias, il pointe désormais sur la
    // couche médicale adossée au socle partagé.
    global.medicalAudio = MedGameMedical;
})(typeof window !== 'undefined' ? window : globalThis);
