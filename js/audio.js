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
    let isMuted = localStorage.getItem('medgame.audio.muted') === 'true';
    let volume = parseFloat(localStorage.getItem('medgame.audio.volume') ?? '0.3');

    /**
     * Initialiser le contexte audio
     * (Doit être appelé après une interaction utilisateur pour Chrome/Edge)
     */
    function init() {
        if (isInitialized) {
            resume();
            return;
        }

        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = volume;
            masterGain.connect(audioCtx.destination);
            isInitialized = true;
            resume();
        } catch (e) {
            console.warn('MedGameAudio: Web Audio API not available', e);
        }
    }

    /**
     * Reprendre le contexte si suspendu (autoplay policy)
     */
    function resume() {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(e => console.warn('MedGameAudio: resume failed', e));
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
         * ECOS — Gong de début de station (style medgame ECOS officiel).
         * Fréquence A3 (220 Hz) grave qui résonne ~1.2s, suivi d'un accord
         * majeur pour donner un signal "top départ" solennel.
         */
        ecosGongStart() {
            if (!audioCtx) return;
            resume();
            const now = audioCtx.currentTime;
            // Fréquences graves qui s'atténuent
            createOscillator(110, 'sine', now, 1.2, 0.30);          // A2
            createOscillator(220, 'sine', now, 0.9, 0.20);          // A3
            createOscillator(165, 'sine', now + 0.05, 0.9, 0.18);   // E3
            // Accord de résolution
            createOscillator(440, 'sine', now + 0.4, 0.5, 0.20);    // A4
            createOscillator(554.37, 'sine', now + 0.5, 0.4, 0.18); // C#5
            createOscillator(659.25, 'sine', now + 0.6, 0.4, 0.16); // E5
        },

        /**
         * ECOS — Cloche d'avertissement à 1 minute restante.
         * Deux notes claires (cloches) séparées de 250ms.
         */
        ecosBell() {
            if (!audioCtx) return;
            resume();
            const now = audioCtx.currentTime;
            // Première cloche
            createOscillator(880, 'sine', now, 0.18, 0.25);
            createOscillator(1760, 'sine', now, 0.12, 0.10);
            // Deuxième cloche
            createOscillator(880, 'sine', now + 0.25, 0.18, 0.25);
            createOscillator(1760, 'sine', now + 0.25, 0.12, 0.10);
        },

        /**
         * ECOS — Gong de fin de station.
         * Triple cloche descendante pour signaler la fin.
         */
        ecosGongEnd() {
            if (!audioCtx) return;
            resume();
            const now = audioCtx.currentTime;
            createOscillator(523.25, 'sine', now, 0.25, 0.22);
            createOscillator(523.25, 'sine', now + 0.4, 0.25, 0.22);
            createOscillator(392, 'sine', now + 0.8, 0.6, 0.28);    // G4 (résolution)
            createOscillator(329.63, 'sine', now + 0.9, 0.7, 0.20); // E4
        },

        timerWarning(secondsLeft) {
            if (!audioCtx) return;
            resume();
            const now = audioCtx.currentTime;
            const frequency = secondsLeft <= 10 ? 880 : secondsLeft <= 30 ? 660 : 440;
            const vol = secondsLeft <= 10 ? 0.3 : secondsLeft <= 30 ? 0.2 : 0.1;
            const duration = secondsLeft <= 10 ? 0.15 : 0.3;

            createOscillator(frequency, 'sine', now, duration, vol);

            // Double bip pour les 10 dernières secondes
            if (secondsLeft <= 10) {
                createOscillator(frequency, 'sine', now + 0.2, duration, vol);
            }
        },

        typing() {
            if (!audioCtx) return;
            resume();
            const now = audioCtx.currentTime;
            createOscillator(900, 'sine', now, 0.05, 0.05);
        }
    };

    const lastPlayed = {};
    const THROTTLE_DELAYS = {
        correct: 500,
        incorrect: 500,
        click: 50,
        reveal: 300,
        tick: 100,
        select: 200,
        ecosBell: 1000,
        ecosGongStart: 2000,
        ecosGongEnd: 2000,
        timerWarning: 200
    };

    // ==================== PUBLIC API ====================

    return {
        /**
         * Initialiser le système audio
         */
        init,

        /**
         * Jouer un effet sonore
         * @param {string} name - Nom du son
         * @param {*} param - Paramètre optionnel (ex: secondes restantes)
         */
        play(name, param) {
            if (isMuted) return;
            if (!isInitialized) {
                init();
            }
            if (!isInitialized) return;

            const now = Date.now();
            const delay = THROTTLE_DELAYS[name] || 0;
            if (delay && lastPlayed[name] && (now - lastPlayed[name] < delay)) {
                return;
            }
            lastPlayed[name] = now;

            if (sounds[name]) {
                sounds[name](param);
            }
        },

        /**
         * Définir le volume (0.0 - 1.0)
         */
        setVolume(v) {
            volume = Math.max(0, Math.min(1, v));
            localStorage.setItem('medgame.audio.volume', volume);
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
            localStorage.setItem('medgame.audio.muted', 'true');
        },

        /**
         * Rétablir le son
         */
        unmute() {
            isMuted = false;
            localStorage.setItem('medgame.audio.muted', 'false');
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
