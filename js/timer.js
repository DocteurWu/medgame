/**
 * js/timer.js — Compte à rebours adaptatif du jeu
 * Phase 3 du refactoring : extrait de game.js
 * Amélioration : Timer adaptatif (5 min urgence / 12 min classique),
 *   couleurs vert/orange/rouge dynamiques, barre de progression, pulse urgence
 *
 * Variables d'état exposées (modifiées par game.js) :
 *   timerState.timeLeft, timerState.timerInterval, timerState.currentCase
 *
 * Callbacks à définir par game.js avant utilisation :
 *   timerState.onTimeUp(correctionText) — appelé quand le temps est écoulé
 */

const TIMER_CONFIG = {
    // Durées par défaut en secondes
    CLASSIC_DURATION: 720,   // 12 min pour mode classique
    URGENCE_DURATION: 300,  // 5 min pour mode urgence
    ECOS_DURATION: 480,     // 8 min pour mode ECOS (durée officielle CNG)

    // Seuils de couleur (ratio temps restant / temps total)
    SAFE_THRESHOLD: 0.60,      // > 60% → vert
    WARNING_THRESHOLD: 0.30,   // 30-60% → orange
    // < 30% → rouge, < 15% → rouge critique

    // Couleurs interpolées (hex)
    COLORS: {
        safe:     { r: 46,  g: 204, b: 113 },  // #2ecc71
        warning:  { r: 243, g: 156, b: 18  },   // #f39c12
        critical: { r: 231, g: 76,  b: 60  },   // #e74c3c
        danger:   { r: 220, g: 38,  b: 38  }    // #dc2626 — rouge profond urgence
    },

    // Barre de progression
    PROGRESS_BAR_ID: 'timer-progress-bar',

    // Intervalle de vérification des alertes sonores (secondes)
    AUDIO_WARNING_AT: [60, 30, 10],  // Alerte sonore à 1 min, 30 s, 10 s

    // Mode courant
    CURRENT_MODE: 'classique'        // 'classique' | 'urgence' | 'ecos'
};

const timerState = {
    timeLeft: 720,
    timerInterval: null,
    currentCase: null,
    onTimeUp: null,

    // --- État adaptatif enrichi ---
    totalTime: 720,               // Durée totale du cas (copie pour accès rapide)
    urgencyLevel: 'safe',         // 'safe' | 'warning' | 'critical' | 'danger'
    ratio: 1.0,                   // Temps restant / temps total
    lastAudioWarningAt: -1,       // Dernier seuil sonore déclenché (-1 = aucun)
    isPaused: false
};

window.timerState = timerState;

// ==================== UTILITAIRES COULEUR ====================

/**
 * Interpole linéairement entre deux couleurs RGB.
 * @param {object} c1 — {r, g, b}
 * @param {object} c2 — {r, g, b}
 * @param {number} t — facteur 0-1
 * @returns {string} couleur CSS "rgb(r, g, b)"
 */
function lerpColor(c1, c2, t) {
    t = Math.max(0, Math.min(1, t));
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Calcule la couleur dynamique du timer en fonction du ratio.
 * Gradient continu : vert → orange → rouge → rouge foncé
 * @param {number} ratio — 0.0 à 1.0
 * @returns {{ color: string, glow: string, level: string }}
 */
function getTimerVisualState(ratio) {
    const C = TIMER_CONFIG.COLORS;

    if (ratio > TIMER_CONFIG.SAFE_THRESHOLD) {
        // Zone verte : interpolation vert pur → vert pâle
        const t = (ratio - TIMER_CONFIG.SAFE_THRESHOLD) / (1 - TIMER_CONFIG.SAFE_THRESHOLD);
        const color = lerpColor(C.safe, { r: 100, g: 230, b: 140 }, t);
        return { color, glow: `rgba(46, 204, 113, ${0.2 + t * 0.1})`, level: 'safe' };
    } else if (ratio > TIMER_CONFIG.WARNING_THRESHOLD) {
        // Zone orange : interpolation vert → orange
        const t = (ratio - TIMER_CONFIG.WARNING_THRESHOLD) / (TIMER_CONFIG.SAFE_THRESHOLD - TIMER_CONFIG.WARNING_THRESHOLD);
        const color = lerpColor(C.critical, C.warning, t);
        return { color, glow: `rgba(243, 156, 18, ${0.3 + (1 - t) * 0.2})`, level: 'warning' };
    } else if (ratio > 0.15) {
        // Zone rouge : interpolation orange → rouge
        const t = (ratio - 0.15) / (TIMER_CONFIG.WARNING_THRESHOLD - 0.15);
        const color = lerpColor(C.danger, C.critical, t);
        return { color, glow: `rgba(231, 76, 60, ${0.4 + (1 - t) * 0.3})`, level: 'critical' };
    } else {
        // Zone critique extrême : rouge profond pulsant
        return { color: `rgb(${C.danger.r}, ${C.danger.g}, ${C.danger.b})`, glow: 'rgba(220, 38, 38, 0.8)', level: 'danger' };
    }
}

// ==================== BARRE DE PROGRESSION ====================

/**
 * Crée ou met à jour la barre de progression sous le timer.
 * @param {number} ratio — 0.0 à 1.0
 * @param {string} color — couleur CSS
 */
function updateTimerProgressBar(ratio, color) {
    // Désactivé : suppression complète de la barre de progression verte sous le timer
}

// ==================== AFFICHAGE PRINCIPAL ====================

function displayTime(seconds) {
    const totalTime = timerState.totalTime || getTimeLimit();
    const minutes = Math.floor(Math.max(0, seconds) / 60);
    const remainingSeconds = Math.max(0, seconds) % 60;
    const timeStr = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;

    // Mise à jour du texte du timer
    const timerEl = document.getElementById('timer');
    if (timerEl) timerEl.textContent = timeStr;
    const mobileTimer = document.getElementById('mobile-timer');
    if (mobileTimer) mobileTimer.textContent = timeStr;

    // Calcul du ratio et du niveau d'urgence
    const ratio = totalTime > 0 ? Math.max(0, seconds) / totalTime : 1;
    timerState.ratio = ratio;
    timerState.totalTime = totalTime;

    // Déterminer le niveau d'urgence
    const visual = getTimerVisualState(ratio);
    timerState.urgencyLevel = visual.level;

    // Appliquer le style dynamique aux éléments timer
    const timerEls = [timerEl, mobileTimer].filter(Boolean);
    timerEls.forEach(el => {
        // Retirer les anciennes classes
        el.classList.remove('warning', 'critical', 'safe');

        // Appliquer la classe d'urgence
        if (visual.level === 'danger') {
            el.classList.add('critical');
        } else if (visual.level === 'critical') {
            el.classList.add('critical');
        } else if (visual.level === 'warning') {
            el.classList.add('warning');
        } else {
            el.classList.add('safe');
        }

        // Appliquer la couleur dynamique interpolée
        el.style.color = visual.color;
        el.style.textShadow = `0 0 12px ${visual.glow}`;

        // Animation de pulsation selon l'urgence
        el.style.animation = '';
        if (visual.level === 'danger') {
            // Pulsation rapide et intense
            el.style.animation = 'timerDanger 0.4s ease infinite';
        } else if (visual.level === 'critical') {
            // Pulsation modérée
            el.style.animation = 'timerCritical 0.6s ease infinite';
        } else if (visual.level === 'warning') {
            // Pulsation lente
            el.style.animation = 'timerWarning 1.2s ease infinite';
        }
    });

    // Barre de progression
    updateTimerProgressBar(ratio, visual.color);

    // Alerte sonore aux seuils critiques
    triggerTimerAudioWarnings(seconds);

    // Déclencher l'événement timer-tick pour les autres composants (3D, urgenceMode, etc.)
    document.dispatchEvent(new CustomEvent('timer-tick', {
        detail: {
            timeLeft: seconds,
            totalTime: totalTime,
            ratio: ratio,
            urgencyLevel: visual.level,
            color: visual.color,
            isUrgence: (typeof urgenceState !== 'undefined' && urgenceState.isUrgenceMode)
        }
    }));
}

// ==================== ALERTES SONORES ====================

/**
 * Déclenche des alertes sonores aux seuils configurés.
 * @param {number} seconds — temps restant en secondes
 */
function triggerTimerAudioWarnings(seconds) {
    // Ne jouer un son qu'une seule fois par seuil
    for (const threshold of TIMER_CONFIG.AUDIO_WARNING_AT) {
        if (seconds <= threshold && timerState.lastAudioWarningAt < threshold) {
            timerState.lastAudioWarningAt = threshold;
            playTimerWarningSound(threshold);
            break;
        }
    }
}

/**
 * Joue un bip d'avertissement sonore.
 * Seuil de 10s → bip rapide et aigu
 * Seuil de 30s → bip moyen
 * Seuil de 60s → bip doux
 */
function playTimerWarningSound(secondsLeft) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        // Plus le temps est court, plus le son est aigu et fort
        const frequency = secondsLeft <= 10 ? 880 : secondsLeft <= 30 ? 660 : 440;
        const volume = secondsLeft <= 10 ? 0.3 : secondsLeft <= 30 ? 0.2 : 0.1;
        const duration = secondsLeft <= 10 ? 0.15 : 0.3;

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        gainNode.gain.value = volume;
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + duration + 0.05);

        // Double bip pour les 10 dernières secondes
        if (secondsLeft <= 10) {
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.frequency.value = frequency;
            osc2.type = 'sine';
            gain2.gain.value = volume;
            gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3 + duration);
            osc2.start(audioCtx.currentTime + 0.2);
            osc2.stop(audioCtx.currentTime + 0.3 + duration + 0.05);
        }

        // Fermer le contexte proprement
        setTimeout(() => audioCtx.close(), 1000);
    } catch (e) {
        // AudioContext pas disponible (mobile, CORS, etc.) — silencieux
    }
}

window.playTimerWarningSound = playTimerWarningSound;

// ==================== DÉDUCTION DE TEMPS ====================

window.deductTime = function (seconds) {
    // En mode ECOS, le temps n'est jamais déduit (il faut le gérer comme un
    // vrai ECOS, le candidat doit gérer son temps tout seul).
    if (TIMER_CONFIG.CURRENT_MODE === 'ecos' || sessionStorage.getItem('immersionMode') === 'immersif') {
        return true;
    }
    if (timerState.timeLeft <= 0) return false;
    timerState.timeLeft -= seconds;
    if (timerState.timeLeft <= 0) {
        timerState.timeLeft = 0;
        displayTime(0);
        return false;
    }
    displayTime(timerState.timeLeft);
    return true;
};

// ==================== TICK PRINCIPAL ====================

function updateTimer() {
    if (timerState.timeLeft > 0) {
        timerState.timeLeft--;
        displayTime(timerState.timeLeft);
    } else if (timerState.timeLeft === 0) {
        timerState.timeLeft = -1;
        clearInterval(timerState.timerInterval);
        showNotification('Temps écoulé !');

        // Mark case as played
        if (timerState.currentCase) {
            const playedCases = getCookie('playedCases');
            let arr = playedCases ? playedCases.split(',') : [];
            if (!arr.includes(timerState.currentCase.id)) {
                arr.push(timerState.currentCase.id);
                setCookie('playedCases', arr.join(','), 365);
            }
        }

        // Callback to game.js for showing correction
        if (timerState.onTimeUp) {
            timerState.onTimeUp();
        }
    }
}

// ==================== ANIMATIONS CSS INJECTÉES ====================

/**
 * Injecte les keyframes CSS pour les animations du timer si nécessaires.
 */
(function injectTimerAnimations() {
    const styleId = 'timer-adaptive-animations';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* Timer adaptatif — animations */
        @keyframes timerWarning {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        @keyframes timerCritical {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.04); opacity: 0.85; }
        }
        @keyframes timerDanger {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.08); opacity: 0.75; }
        }

        /* Barre de progression du timer */
        .timer-display {
            transition: color 0.5s ease, text-shadow 0.5s ease;
        }

        /* Teinte d'urgence sur le fond quand le temps est critique */
        .timer-urgency-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            pointer-events: none;
            z-index: 9999;
            transition: background-color 1s ease;
        }
    `;
    document.head.appendChild(style);
})();

/**
 * Met à jour l'overlay d'urgence (teinte rouge sur l'écran).
 * Appelé par displayTime() indirectement.
 */
function updateUrgencyOverlay(urgencyLevel) {
    let overlay = document.getElementById('timer-urgency-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'timer-urgency-overlay';
        overlay.className = 'timer-urgency-overlay';
        document.body.appendChild(overlay);
    }

    switch (urgencyLevel) {
        case 'danger':
            overlay.style.backgroundColor = 'rgba(220, 38, 38, 0.08)';
            break;
        case 'critical':
            overlay.style.backgroundColor = 'rgba(231, 76, 60, 0.05)';
            break;
        case 'warning':
            overlay.style.backgroundColor = 'rgba(243, 156, 18, 0.02)';
            break;
        default:
            overlay.style.backgroundColor = 'transparent';
    }
}

// Patch displayTime pour inclure l'overlay d'urgence
const _originalDisplayTime = displayTime;
displayTime = function(seconds) {
    _originalDisplayTime(seconds);
    updateUrgencyOverlay(timerState.urgencyLevel);
};

// ==================== PAUSE / RESUME ====================

/**
 * Met le timer en pause.
 */
function pauseTimer() {
    if (timerState.timerInterval && !timerState.isPaused) {
        clearInterval(timerState.timerInterval);
        timerState.isPaused = true;
    }
}
window.pauseTimer = pauseTimer;

/**
 * Reprend le timer après une pause.
 */
function resumeTimer() {
    if (timerState.isPaused && timerState.timeLeft > 0) {
        timerState.isPaused = false;
        timerState.timerInterval = setInterval(updateTimer, 1000);
    }
}
window.resumeTimer = resumeTimer;

// ==================== INITIALISATION ====================

/**
 * Réinitialise le timer pour un nouveau cas.
 * À appeler depuis game.js quand un cas est chargé.
 * @param {number} [customDuration] — durée en secondes (sinon utilise getTimeLimit())
 * @param {boolean} [startInterval=true] — si false, prépare le timer sans démarrer l'intervalle
 */
function initTimer(customDuration, startInterval = true) {
    const duration = customDuration || getTimeLimit();
    timerState.timeLeft = duration;
    timerState.totalTime = duration;
    timerState.lastAudioWarningAt = -1;
    timerState.isPaused = false;

    // Détection automatique du mode ECOS
    if (sessionStorage.getItem('immersionMode') === 'immersif') {
        TIMER_CONFIG.CURRENT_MODE = 'ecos';
    }

    if (timerState.timerInterval) {
        clearInterval(timerState.timerInterval);
        timerState.timerInterval = null;
    }

    if (startInterval) {
        timerState.timerInterval = setInterval(updateTimer, 1000);
    }
    displayTime(duration);

    // Supprimer l'ancien overlay s'il existe
    const oldOverlay = document.getElementById('timer-urgency-overlay');
    if (oldOverlay) oldOverlay.style.backgroundColor = 'transparent';
}
window.initTimer = initTimer;