/**
 * js/game-modes.js — Modes de jeu partagés (Entraînement vs Examen, Mode calme)
 * P0 Quick wins UX/fun : centralise les réglages déjà présents dans index.html
 * (ecos_practice_mode, medgame.audio.muted) + nouveau mode calme + coûts adaptatifs.
 */

(function () {
    'use strict';

    /** true = Entraînement (pédagogique, timer souple), false = Examen (strict) */
    function isPracticeMode() {
        try {
            return localStorage.getItem('ecos_practice_mode') !== 'false';
        } catch (e) { return true; }
    }

    /** true = désactive pulsations, overlay rouge, sons d'alerte timer */
    function isCalmMode() {
        try {
            return localStorage.getItem('medgame_calm_mode') === 'true';
        } catch (e) { return false; }
    }

    function setCalmMode(enabled) {
        try { localStorage.setItem('medgame_calm_mode', enabled ? 'true' : 'false'); } catch (e) {}
        applyCalmBodyClass();
    }

    function applyCalmBodyClass() {
        if (typeof document === 'undefined') return;
        document.body.classList.toggle('calm-mode', isCalmMode());
    }

    /**
     * Coût temps réel d'une action, en secondes.
     * @param {'question'|'revealAllPerQuestion'|'examLot'|'hint'} kind
     * @param {number} baseCost — coût nominal historique (5, 120, 30…)
     */
    function getActionTimeCost(kind, baseCost) {
        const practice = isPracticeMode();
        // En entraînement on veut encourager l'exhaustivité : coûts réduits.
        if (practice) {
            if (kind === 'question') return 0;
            if (kind === 'revealAllPerQuestion') return 2; // ~2s/question au lieu de 4s
            if (kind === 'examLot') return 30;             // 30s au lieu de 120s
            if (kind === 'hint') return 15;
            return Math.round((baseCost || 0) / 4);
        }
        return baseCost || 0;
    }

    /** Libellé court du mode pour affichage HUD */
    function getModeLabel() {
        return isPracticeMode() ? 'Entraînement' : 'Examen';
    }

    // Appliquer la classe calme dès le chargement
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyCalmBodyClass);
        } else {
            applyCalmBodyClass();
        }
    }

    window.MedGameModes = {
        isPracticeMode,
        isCalmMode,
        setCalmMode,
        applyCalmBodyClass,
        getActionTimeCost,
        getModeLabel
    };
})();
