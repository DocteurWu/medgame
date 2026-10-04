/**
 * audio.js — Façade de compatibilité MedGame
 *
 * Ce fichier était le système audio du jeu. Il ne l'est plus : il ne fait
 * plus que redistribuer vers le socle (js/audio-core.js) et ses trois couches.
 *
 * Pourquoi garder une façade plutôt que de modifier les 37 appels
 * `MedGameAudio.play(...)` répartis dans js/game.js, js/ui.js, js/timer.js,
 * js/ecosMode.js, js/badges.js, js/hints.js, js/progress-tracker.js,
 * js/index-game-ui.js, js/three-tablet.js, js/auscultation.js,
 * js/auscultation-pcg.js et js/ecg-trainer.js : parce que le nom «
 * MedGameAudio.play('correct') » est lisible et que la forme de l'appel est
 * bonne. Le problème n'était jamais l'API, c'était qu'il n'y avait qu'un seul
 * oscillateur sine pour tout le jeu et six AudioContext en concurrence.
 *
 * L'API est STRICTEMENT rétrocompatible :
 *   init() play(name, param) setVolume(v) getVolume() mute() unmute()
 *   isMuted() isReady()
 * setVolume() est désormais un volume SFX (c'était le sens historique) et
 * plus un volume global — les deux modules qui se disputaient la clé
 * `medgame.audio.volume` avec des défauts contradictoires (0.30 ici, 0.60
 * dans three-audio.js) n'existent plus.
 *
 * Chargement : script classique, APRÈS audio-core / audio-sfx /
 * audio-medical / audio-ambience.
 */

(function (global) {
    'use strict';

    const A = global.MedGameSound;

    // ==================== CAS SANS SOCLE ====================
    // Si audio-core.js n'a pas été chargé, on ne casse pas la page : on
    // expose une façade inerte qui absorbe silencieusement les appels.

    if (!A) {
        const noop = () => false;
        global.MedGameAudio = {
            init: noop,
            play: noop,
            playOn: noop,
            setVolume: noop,
            getVolume: () => 0.3,
            mute: noop,
            unmute: noop,
            isMuted: () => true,
            isReady: () => false,
            register: noop,
            list: () => [],
            // Présent pour que l'appelant n'ait pas à tester l'existence :
            // js/game.js appelle boot() sans vérifier, et un TypeError au
            // chargement d'un cas serait bien pire qu'un jeu silencieux.
            boot: noop,
            // Marqueur lu par test/verify-ui-audio.mjs. Testé seulement
            // `!!MedGameAudio` ne sert à rien : les deux branches le définissent.
            _unavailable: true
        };
        console.warn('[MedGameAudio] js/audio-core.js absent — audio désactivé');
        return;
    }

    // ==================== FAÇADE ====================

    const MedGameAudio = {

        /**
         * Crée le contexte. Idempotent. À appeler après un geste utilisateur
         * (le jeu le fait de toute façon via `unlock()`).
         */
        init() {
            return A.init();
        },

        /**
         * Joue un effet enregistré. Renvoie false si le son est inconnu, si
         * le throttling l'a bloqué ou si l'utilisateur a coupé le son — ce qui
         * permet d'écrire `if (MedGameAudio.play('click')) { ... }`.
         * @param {string} name
         * @param {object|number} [param] `{at, bus, …}` ou paramètre simple
         */
        play(name, param) {
            return A.play(name, param);
        },

        /** Force le bus de destination (contourne le bus par défaut du son). */
        playOn(name, bus, param) {
            return A.playOn(name, bus, param);
        },

        /**
         * Volume historique de MedGameAudio = volume des effets sonores.
         * Pour le volume global, utiliser MedGameSound.setMasterVolume().
         */
        setVolume(v) {
            A.setBusVolume('sfx', v);
        },

        getVolume() {
            return A.getBusVolume('sfx');
        },

        /** Coupe TOUT le jeu, y compris la musique et l'ambiance. */
        mute() {
            A.mute();
        },

        unmute() {
            A.unmute();
        },

        isMuted() {
            return A.isMuted();
        },

        isReady() {
            return A.isReady();
        },

        /** Ajoute un son à la volée (extensions, cas spécifiques). */
        register(name, fn) {
            A.register(name, fn);
        },

        /** Liste triée des sons enregistrés — utile pour le test d'intégrité. */
        list() {
            return A.list();
        }
    };

    global.MedGameAudio = MedGameAudio;

    // ==================== DÉMARRAGE AUTOMATIQUE ====================
    // L'amorçage réel est fait par audio-core.js, qui écoute
    // pointerdown/keydown/touchstart. On ne double pas ces écouteurs ici :
    // deux `once` sur le même type d'événement créaient deux contextes dans
    // l'ancienne version.

    /**
     * Point d'entrée unique pour le reste du jeu : contexte, ambiance,
     * état musical de départ.
     *
     * Les pages qui n'ont pas de patient (accueil, atlas, ECG trainer)
     * n'ont qu'à ne pas appeler.
     * @param {{ambience?: boolean, state?: string}} [options]
     *   `ambience: false` démarre le contexte sans la couche de lieu ni la
     *   partition ; `state` force un état musical (utilisé au chargement d'un
     *   cas pour qu'on n'entende pas une transition).
     */
    global.MedGameAudio.boot = function boot(options) {
        const opts = options || {};
        A.init();
        if (opts.ambience !== false && global.MedGameAmbience) {
            global.MedGameAmbience.start();
        }
        if (global.MedGameAmbience && opts.state) {
            global.MedGameAmbience.setState(opts.state, true);
        }
        return MedGameAudio;
    };
})(typeof window !== 'undefined' ? window : globalThis);
