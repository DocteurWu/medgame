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
