/**
 * js/timer.js — Compte à rebours du jeu
 * Phase 3 du refactoring : extrait de game.js
 *
 * Variables d'état exposées (modifiées par game.js) :
 *   timerState.timeLeft, timerState.timerInterval, timerState.currentCase
 *
 * Callbacks à définir par game.js avant utilisation :
 *   timerState.onTimeUp(correctionText) — appelé quand le temps est écoulé
 */

const timerState = {
    timeLeft: 480,
    timerInterval: null,
    currentCase: null,
    onTimeUp: null
};

window.timerState = timerState;

function displayTime(seconds) {
    const totalTime = getTimeLimit();
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const timeStr = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    const timerEl = document.getElementById('timer');
    if (timerEl) timerEl.textContent = timeStr;
    const mobileTimer = document.getElementById('mobile-timer');
    if (mobileTimer) mobileTimer.textContent = timeStr;
    
    // Update timer visual state (vert/orange/rouge adaptatif)
    const timerEls = [timerEl, mobileTimer].filter(Boolean);
    const ratio = totalTime > 0 ? seconds / totalTime : 0;
    timerEls.forEach(el => {
        el.classList.remove('warning', 'critical', 'safe');
        if (ratio <= 0.10 && seconds > 0) {
            el.classList.add('critical');
        } else if (ratio <= 0.25) {
            el.classList.add('critical');
        } else if (ratio <= 0.50) {
            el.classList.add('warning');
        } else {
            el.classList.add('safe');
        }
    });
}

window.deductTime = function (seconds) {
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
