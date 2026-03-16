/**
 * MedGame - Audio Effects Module (Web Audio API Hook)
 * Prépare le système audio pour les effets sonores futurs.
 * Utilise Web Audio API pour des sons synthétiques (pas de fichiers requis).
 *
 * Usage:
 *   MedGameAudio.init();
 *   MedGameAudio.play('correct');
 *   MedGameAudio.play('incorrect');
 *   MedGameAudio.play('click');
 *   MedGameAudio.play('reveal');
 *   MedGameAudio.play('complete');
 *   MedGameAudio.setVolume(0.3);
 *   MedGameAudio.mute();
 *   MedGameAudio.unmute();
 */

const MedGameAudio = (function () {
    'use strict';

    let audioCtx = null;
    let masterGain = null;
    let isInitialized = false;
    let isMuted = false;
    let volume = 0.3;

    /**
     * Initialiser le contexte audio
     * (Doit être appelé après une interaction utilisateur pour Chrome/Edge)
     */
    function init() {
        if (isInitialized) return;

        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = volume;
            masterGain.connect(audioCtx.destination);
            isInitialized = true;
        } catch (e) {
            console.warn('MedGameAudio: Web Audio API not available', e);
        }
    }

    /**
     * Reprendre le contexte si suspendu (autoplay policy)
     */
    function resume() {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    /**
     * Créer un oscillateur simple
     */
    function createOscillator(freq, type, startTime, duration, gainValue = 0.3) {
        if (!audioCtx) return null;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(gainValue, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(startTime);
        osc.stop(startTime + duration);

        return osc;
    }

    // ==================== SOUND PRESETS ====================

    const sounds = {
        /**
         * Son de bonne réponse - montée ascendante
         */
        correct() {
            if (!audioCtx) return;
            resume();
            const now = audioCtx.currentTime;
            // C-E-G chord arpeggio
            createOscillator(523.25, 'sine', now, 0.15, 0.25);       // C5
            createOscillator(659.25, 'sine', now + 0.08, 0.15, 0.25); // E5
            createOscillator(783.99, 'sine', now + 0.16, 0.2, 0.3);   // G5
            // Bright sparkle
            createOscillator(1046.50, 'sine', now + 0.2, 0.3, 0.15);  // C6
        },

        /**
         * Son de mauvaise réponse - ton descendant
         */
        incorrect() {
            if (!audioCtx) return;
            resume();
            const now = audioCtx.currentTime;
            createOscillator(300, 'square', now, 0.15, 0.1);
            createOscillator(250, 'square', now + 0.1, 0.2, 0.1);
            createOscillator(200, 'square', now + 0.2, 0.3, 0.08);
        },

        /**
         * Son de clic - subtil
         */
        click() {
            if (!audioCtx) return;
            resume();
            const now = audioCtx.currentTime;
            createOscillator(800, 'sine', now, 0.05, 0.15);
        },

        /**
         * Son de révélation - ding doux
         */
        reveal() {
            if (!audioCtx) return;
            resume();
            const now = audioCtx.currentTime;
            createOscillator(880, 'sine', now, 0.2, 0.2);
            createOscillator(1108.73, 'sine', now + 0.1, 0.25, 0.15);
        },

        /**
         * Son de complétion - fanfare courte
         */
        complete() {
            if (!audioCtx) return;
            resume();
            const now = audioCtx.currentTime;
            // Ascending major scale fragment
            const notes = [523.25, 587.33, 659.25, 783.99, 1046.50];
            notes.forEach((freq, i) => {
                createOscillator(freq, 'sine', now + i * 0.1, 0.2, 0.2);
            });
        },

        /**
         * Son de tick - pour le timer
         */
        tick() {
            if (!audioCtx) return;
            resume();
            const now = audioCtx.currentTime;
            createOscillator(1200, 'sine', now, 0.03, 0.05);
        },

        /**
         * Son d'alerte urgence
         */
        alert() {
            if (!audioCtx) return;
            resume();
            const now = audioCtx.currentTime;
            for (let i = 0; i < 3; i++) {
                createOscillator(880, 'square', now + i * 0.15, 0.1, 0.1);
                createOscillator(660, 'square', now + i * 0.15 + 0.075, 0.1, 0.1);
            }
        },

        /**
         * Son de sélection examen
         */
        select() {
            if (!audioCtx) return;
            resume();
            const now = audioCtx.currentTime;
            createOscillator(600, 'sine', now, 0.06, 0.12);
            createOscillator(800, 'sine', now + 0.04, 0.06, 0.1);
        },

        /**
         * Bip de moniteur cardiaque réaliste (ECG R-wave)
         * Un bip court à fréquence pure, comme un vrai monitor
         */
        monitorBeep() {
            if (!audioCtx) return;
            resume();
            const now = audioCtx.currentTime;
            // Main beep: 1000Hz, 80ms, très court et sec
            createOscillator(1000, 'sine', now, 0.08, 0.15);
            // Harmonique légère pour le réalisme
            createOscillator(2000, 'sine', now, 0.04, 0.05);
        },

        /**
         * Alarme critique — double ton descendant (comme un vrai monitor)
         * Pattern: HIGH-low-HIGH-low (répété)
         */
        criticalAlarm() {
            if (!audioCtx) return;
            resume();
            const now = audioCtx.currentTime;
            // Premier ton haut
            createOscillator(880, 'square', now, 0.12, 0.12);
            createOscillator(1320, 'sine', now, 0.08, 0.06);
            // Ton bas
            createOscillator(680, 'square', now + 0.15, 0.12, 0.12);
            createOscillator(1020, 'sine', now + 0.15, 0.08, 0.06);
            // Répétition
            createOscillator(880, 'square', now + 0.35, 0.12, 0.12);
            createOscillator(680, 'square', now + 0.5, 0.12, 0.12);
        },

        /**
         * Flatline — ton continu sinusoïdal 1000Hz
         */
        flatline() {
            if (!audioCtx) return;
            resume();
            const now = audioCtx.currentTime;
            // Ton continu de 2 secondes
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1000, now);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
            gain.gain.setValueAtTime(0.12, now + 1.8);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(now);
            osc.stop(now + 2.2);
        },

        /**
         * Défibrillation — son de charge puis décharge
         */
        defibrillator() {
            if (!audioCtx) return;
            resume();
            const now = audioCtx.currentTime;
            // Son de charge (montée en fréquence)
            const chargeOsc = audioCtx.createOscillator();
            const chargeGain = audioCtx.createGain();
            chargeOsc.type = 'sawtooth';
            chargeOsc.frequency.setValueAtTime(100, now);
            chargeOsc.frequency.exponentialRampToValueAtTime(800, now + 1.2);
            chargeGain.gain.setValueAtTime(0, now);
            chargeGain.gain.linearRampToValueAtTime(0.06, now + 0.1);
            chargeGain.gain.setValueAtTime(0.06, now + 1.0);
            chargeGain.gain.linearRampToValueAtTime(0, now + 1.3);
            chargeOsc.connect(chargeGain);
            chargeGain.connect(masterGain);
            chargeOsc.start(now);
            chargeOsc.stop(now + 1.3);
            // Décharge (bruit blanc simulé par oscillateur rapide)
            createOscillator(150, 'sawtooth', now + 1.4, 0.3, 0.2);
            createOscillator(80, 'square', now + 1.4, 0.2, 0.15);
        },

        /**
         * Son de ventilation manuelle (BVM) — souffle rythmé
         */
        ventilation() {
            if (!audioCtx) return;
            resume();
            const now = audioCtx.currentTime;
            // Créer un bruit de souffle via oscillateur basse fréquence
            const bufferSize = audioCtx.sampleRate * 0.6;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / bufferSize);
            }
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 400;
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.15);
            gain.gain.linearRampToValueAtTime(0.08, now + 0.35);
            gain.gain.linearRampToValueAtTime(0, now + 0.55);
            source.connect(filter);
            filter.connect(gain);
            gain.connect(masterGain);
            source.start(now);
            source.stop(now + 0.6);
        },

        /**
         * Son de notification de galerie — petit ding joyeux
         */
        galleryOpen() {
            if (!audioCtx) return;
            resume();
            const now = audioCtx.currentTime;
            createOscillator(523.25, 'sine', now, 0.15, 0.15);  // C5
            createOscillator(659.25, 'sine', now + 0.08, 0.15, 0.12);  // E5
            createOscillator(783.99, 'sine', now + 0.15, 0.2, 0.1);   // G5
        }
    };

    // ==================== PUBLIC API ====================

    return {
        /**
         * Initialiser le système audio
         */
        init,

        /**
         * Jouer un effet sonore
         * @param {string} name - Nom du son: 'correct', 'incorrect', 'click', 'reveal', 'complete', 'tick', 'alert', 'select'
         */
        play(name) {
            if (isMuted || !isInitialized) return;
            if (sounds[name]) {
                sounds[name]();
            }
        },

        /**
         * Définir le volume (0.0 - 1.0)
         */
        setVolume(v) {
            volume = Math.max(0, Math.min(1, v));
            if (masterGain) {
                masterGain.gain.value = volume;
            }
        },

        /**
         * Récupérer le volume actuel
         */
        getVolume() {
            return volume;
        },

        /**
         * Couper le son
         */
        mute() {
            isMuted = true;
        },

        /**
         * Rétablir le son
         */
        unmute() {
            isMuted = false;
        },

        /**
         * Vérifier si muted
         */
        isMuted() {
            return isMuted;
        },

        /**
         * Vérifier si initialisé
         */
        isReady() {
            return isInitialized;
        }
    };
})();

// Auto-init sur première interaction utilisateur (requis par Chrome/Edge)
document.addEventListener('click', function initAudioOnce() {
    MedGameAudio.init();
    document.removeEventListener('click', initAudioOnce);
}, { once: true });

document.addEventListener('keydown', function initAudioOnceKey() {
    MedGameAudio.init();
    document.removeEventListener('keydown', initAudioOnceKey);
}, { once: true });
