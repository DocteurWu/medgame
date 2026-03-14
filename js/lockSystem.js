/**
 * js/lockSystem.js — Système de verrous et challenges sémiologiques
 * Phase 4 du refactoring : extrait de game.js
 */

const lockSystem = {
    unlockedLocks: new Set(),
    onLoadCase: null // callback: (isPartialRefresh) => void
};

function initLockSystem() {
    try {
        const savedLocks = sessionStorage.getItem('unlockedLocks');
        if (savedLocks) lockSystem.unlockedLocks = new Set(JSON.parse(savedLocks));
    } catch (e) { console.error("Error loading locks", e); }
}

function saveLocks() {
    sessionStorage.setItem('unlockedLocks', JSON.stringify([...lockSystem.unlockedLocks]));
}

function isFieldLocked(path) {
    const currentCase = lockSystem.currentCase;
    if (!currentCase || !currentCase.locks) return false;
    return currentCase.locks.some(lock =>
        !lockSystem.unlockedLocks.has(lock.id) && lock.target_fields.includes(path)
    );
}

function getLockForField(path) {
    const currentCase = lockSystem.currentCase;
    if (!currentCase || !currentCase.locks) return null;
    return currentCase.locks.find(lock =>
        !lockSystem.unlockedLocks.has(lock.id) && lock.target_fields.includes(path)
    );
}

function showLockChallenge(lockId) {
    console.log("showLockChallenge called with lockId:", lockId);
    const currentCase = lockSystem.currentCase;
    console.log("currentCase:", currentCase);

    if (!currentCase) {
        console.error("currentCase is not defined");
        showNotification("Erreur: cas non chargé");
        return;
    }

    if (!currentCase.locks || !Array.isArray(currentCase.locks)) {
        console.error("currentCase.locks is not defined or not an array");
        showNotification("Erreur: pas de verrous définis");
        return;
    }

    const lock = currentCase.locks.find(l => l.id === lockId);
    if (!lock) {
        console.error("Lock not found:", lockId);
        showNotification("Erreur: verrou introuvable");
        return;
    }

    let lockAttempts = 0;

    console.log("Lock found:", lock);

    // Hide nurse intro if it's still showing
    if (typeof NurseIntro !== 'undefined') {
        NurseIntro.hide();
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'correction-overlay';
    modalOverlay.style.display = 'flex';
    modalOverlay.id = 'lock-challenge-modal';
    modalOverlay.style.zIndex = '2000';

    let challengeHtml = '';
    if (lock.type === 'SAISIE') {
        challengeHtml = `
            <div class="lock-modal">
                <h3><i class="fas fa-unlock-alt"></i> DÉFI SÉMIOLOGIQUE</h3>
                <p class="challenge-question">${lock.challenge.question}</p>
                <input type="text" id="lock-answer" placeholder="Votre réponse..." autocomplete="off">
                <p id="lock-error" class="error-feedback"></p>
                <div class="correction-actions">
                    <button class="secondary-btn" id="lock-cancel">Annuler</button>
                    <button class="primary-btn" id="lock-submit">Valider</button>
                </div>
            </div>
        `;
    } else if (lock.type === 'QCM') {
        challengeHtml = `
            <div class="lock-modal">
                <h3><i class="fas fa-unlock-alt"></i> DÉFI SÉMIOLOGIQUE</h3>
                <p class="challenge-question">${lock.challenge.question}</p>
                <div class="mcq-options">
                    ${lock.challenge.options.map((opt, i) =>
                        `<div class="mcq-option" data-index="${i}">${opt}</div>`
                    ).join('')}
                </div>
                <p id="lock-error" class="error-feedback"></p>
                <div class="correction-actions">
                    <button class="secondary-btn" id="lock-cancel">Annuler</button>
                    <button class="primary-btn" id="lock-submit">Valider</button>
                </div>
            </div>
        `;
    }

    modalOverlay.innerHTML = challengeHtml;
    document.body.appendChild(modalOverlay);

    if (lock.type === 'SAISIE') {
        const input = document.getElementById('lock-answer');
        input.focus();
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') validateSaisie(); });
        document.getElementById('lock-submit').addEventListener('click', validateSaisie);
    } else {
        document.querySelectorAll('.mcq-option').forEach(opt => {
            opt.addEventListener('click', () => {
                opt.classList.toggle('selected');
            });
        });
        document.getElementById('lock-submit').addEventListener('click', validateQCM);
    }

    document.getElementById('lock-cancel').addEventListener('click', () => {
        modalOverlay.remove();
    });

    function validateSaisie() {
        lockAttempts++;
        const val = document.getElementById('lock-answer').value;
        const answer = normalizeText(val);

        const isCorrect = lock.challenge.expected_keywords.some(kw => {
            const normalizedKW = normalizeText(kw);
            if (normalizedKW === answer || answer.includes(normalizedKW)) return true;
            const words = answer.split(/\s+/);
            return words.some(word => isFuzzyMatch(word, normalizedKW));
        });

        if (isCorrect) {
            unlock(lockId);
            modalOverlay.remove();
        } else if (lockAttempts >= 3) {
            const correction = lock.challenge.expected_keywords.join(', ');
            const errorEl = document.getElementById('lock-error');
            errorEl.innerHTML = `
                <div class="correction-box" style="margin-top: 15px; padding: 15px; background: rgba(231, 76, 60, 0.1); border: 1px solid #e74c3c; border-radius: 8px; text-align: left;">
                    <div style="color: #e74c3c; font-weight: bold; margin-bottom: 5px;"><i class="fas fa-times-circle"></i> CORRECTION</div>
                    <div style="color: white; margin-bottom: 10px;">${correction}</div>
                    ${lock.feedback_error ? `<div style="color: var(--text-muted); font-size: 0.9rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;"><strong>Indice :</strong> ${lock.feedback_error}</div>` : ''}
                </div>
            `;
            document.getElementById('lock-submit').style.display = 'none';
            const input = document.getElementById('lock-answer');
            if (input) {
                input.disabled = true;
                input.style.opacity = '0.7';
            }
            const cancelBtn = document.getElementById('lock-cancel');
            cancelBtn.textContent = 'Continuer';
            cancelBtn.classList.remove('secondary-btn');
            cancelBtn.classList.add('primary-btn');
            cancelBtn.style.width = '100%';
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            newCancelBtn.onclick = () => {
                unlock(lockId);
                modalOverlay.remove();
            };
            gsap.to(".lock-modal", { y: -10, repeat: 1, yoyo: true, duration: 0.2 });
        } else {
            document.getElementById('lock-error').textContent = lock.feedback_error || "Réponse incorrecte.";
            gsap.to(".lock-modal", { x: 10, repeat: 3, yoyo: true, duration: 0.1 });
        }
    }

    function validateQCM() {
        lockAttempts++;
        const selectedOptions = document.querySelectorAll('.mcq-option.selected');
        const selectedIndices = Array.from(selectedOptions).map(opt => parseInt(opt.dataset.index));

        const correctIndices = lock.challenge.correct_indices || (lock.challenge.correct_index !== undefined ? [lock.challenge.correct_index] : []);

        selectedIndices.sort((a, b) => a - b);
        const sortedCorrect = [...correctIndices].sort((a, b) => a - b);

        const isCorrect = selectedIndices.length === sortedCorrect.length &&
            selectedIndices.every((val, index) => val === sortedCorrect[index]);

        if (isCorrect) {
            unlock(lockId);
            modalOverlay.remove();
        } else if (lockAttempts >= 3) {
            const correctionText = sortedCorrect.map(idx => lock.challenge.options[idx]).join(' + ');
            const errorEl = document.getElementById('lock-error');
            errorEl.innerHTML = `
                <div class="correction-box" style="margin-top: 15px; padding: 15px; background: rgba(231, 76, 60, 0.1); border: 1px solid #e74c3c; border-radius: 8px; text-align: left;">
                    <div style="color: #e74c3c; font-weight: bold; margin-bottom: 5px;"><i class="fas fa-times-circle"></i> CORRECTION</div>
                    <div style="color: white; margin-bottom: 10px;">${correctionText}</div>
                    ${lock.feedback_error ? `<div style="color: var(--text-muted); font-size: 0.9rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;"><strong>Indice :</strong> ${lock.feedback_error}</div>` : ''}
                </div>
            `;
            document.getElementById('lock-submit').style.display = 'none';

            document.querySelectorAll('.mcq-option').forEach(opt => {
                const idx = parseInt(opt.dataset.index);
                opt.style.pointerEvents = 'none';
                if (sortedCorrect.includes(idx)) {
                    opt.classList.add('correct');
                    opt.style.borderColor = "#2ecc71";
                    opt.style.background = "rgba(46, 204, 113, 0.2)";
                } else {
                    opt.style.opacity = '0.5';
                }
            });

            const cancelBtn = document.getElementById('lock-cancel');
            cancelBtn.textContent = 'Continuer';
            cancelBtn.classList.remove('secondary-btn');
            cancelBtn.classList.add('primary-btn');
            cancelBtn.style.width = '100%';

            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            newCancelBtn.onclick = () => {
                unlock(lockId);
                modalOverlay.remove();
            };
            gsap.to(".lock-modal", { y: -10, repeat: 1, yoyo: true, duration: 0.2 });
        } else {
            document.getElementById('lock-error').textContent = lock.feedback_error || "Réponse incorrecte.";
            gsap.to(".lock-modal", { x: 10, repeat: 3, yoyo: true, duration: 0.1 });
        }
    }
}

function unlock(lockId) {
    lockSystem.unlockedLocks.add(lockId);
    saveLocks();
    if (lockSystem.onLoadCase) {
        lockSystem.onLoadCase(true);
    }
}

window.showLockChallenge = showLockChallenge;
