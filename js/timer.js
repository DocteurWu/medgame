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
    onTimeUp: null // callback: (correctionText) => void
};

function displayTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const timeStr = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    const timerEl = document.getElementById('timer');
    if (timerEl) timerEl.textContent = timeStr;
    const mobileTimer = document.getElementById('mobile-timer');
    if (mobileTimer) mobileTimer.textContent = timeStr;
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
