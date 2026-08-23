/**
 * js/lockSystem.js — Système de verrous et challenges sémiologiques
 * Phase 4 du refactoring : extrait de game.js
 * Amélioration v2 : Gating sémiologique progressif avec prérequis entre verrous
 *
 * Nouveau : les verrous peuvent définir un champ optionnel `prerequisites` (tableau d'IDs).
 * Un verrou avec prérequis ne peut être déverrouillé qu'après avoir déverrouillé tous ses prérequis.
 * Par exemple : il faut déverrouiller l'interrogatoire avant de pouvoir prescrire.
 *
 * Le système expose également getFieldLockInfo() pour un affichage différencié dans l'UI :
 * - "Verrou simple" : cadenas avec défi cliquable
 * - "Verrou bloqué par prérequis" : cadenas grisé avec message "Déverrouillez d'abord X"
 */

const lockSystem = {
    unlockedLocks: new Set(),   // clés composées "caseId:lockId" (étanchéité inter-cas)
    currentCase: null,
    onLoadCase: null // callback: (isPartialRefresh) => void
};

/** Portée du cas courant pour l'isolation des verrous entre cas */
function _caseScope() {
    return (lockSystem.currentCase && lockSystem.currentCase.id) || 'global';
}
function _lockKey(lockId) {
    return `${_caseScope()}:${lockId}`;
}
function _hasLock(lockId) {
    return lockSystem.unlockedLocks.has(_lockKey(lockId));
}

/**
 * Réinitialise les verrous déverrouillés (appelé au changement de cas).
 */
function resetLocksForNewCase() {
    lockSystem.unlockedLocks.clear();
    try { sessionStorage.removeItem('unlockedLocks'); } catch (e) {}
}

function initLockSystem() {
    try {
        const savedLocks = sessionStorage.getItem('unlockedLocks');
        if (savedLocks) lockSystem.unlockedLocks = new Set(JSON.parse(savedLocks));
    } catch (e) { console.error("Error loading locks", e); }
}

function saveLocks() {
    sessionStorage.setItem('unlockedLocks', JSON.stringify([...lockSystem.unlockedLocks]));
}

/**
 * Un verrou est-il déverrouillé dans le cas courant ?
 * @param {string} lockId
 * @returns {boolean}
 */
function isLockUnlocked(lockId) {
    return _hasLock(lockId);
}

/**
 * Vérifie si un verrou est déverrouillable (tous ses prérequis sont satisfaits).
 * @param {object} lock — l'objet verrou
 * @returns {{ canUnlock: boolean, missingPrereqs: string[] }}
 */
function getLockStatus(lock) {
    if (!lock || !lock.id) return { canUnlock: false, missingPrereqs: [] };
    if (_hasLock(lock.id)) {
        return { canUnlock: true, missingPrereqs: [] };
    }
    const prereqs = lock.prerequisites || [];
    const missingPrereqs = prereqs.filter(pId => !_hasLock(pId));
    return {
        canUnlock: missingPrereqs.length === 0,
        missingPrereqs
    };
}
window.getLockStatus = getLockStatus;

/**
 * Récupère les noms des verrous prérequis pour un affichage user-friendly.
 */
function getPrereqNames(prereqIds, locks) {
    return prereqIds.map(id => {
        const l = (locks || []).find(lk => lk.id === id);
        return l ? (l.label || (l.challenge && l.challenge.question) || id) : id;
    });
}
window.getPrereqNames = getPrereqNames;

/**
 * Vérifie si un champ est verrouillé avec infos détaillées (prérequis, etc.).
 * @param {string} path — chemin du champ
 * @returns {{ locked: boolean, lock: object|null, blockedByPrereqs: boolean, missingPrereqs: string[] }}
 */
function getFieldLockInfo(path) {
    const result = { locked: false, lock: null, blockedByPrereqs: false, missingPrereqs: [] };
    const currentCase = lockSystem.currentCase;
    if (!currentCase || !currentCase.locks) return result;

    for (const lock of currentCase.locks) {
        if (!lock.target_fields.includes(path)) continue;
        if (_hasLock(lock.id)) continue;

        result.lock = lock;
        const status = getLockStatus(lock);
        if (!status.canUnlock) {
            result.blockedByPrereqs = true;
            result.missingPrereqs = status.missingPrereqs;
            result.locked = true;
        } else {
            result.locked = true;
        }
        break;
    }

    return result;
}
window.getFieldLockInfo = getFieldLockInfo;

function isFieldLocked(path) {
    return getFieldLockInfo(path).locked;
}

function getLockForField(path) {
    const info = getFieldLockInfo(path);
    return info.blockedByPrereqs ? null : info.lock;
}

/**
 * Affiche la modale de défi sémiologique pour déverrouiller un champ.
 * Vérifie les prérequis avant d'ouvrir le défi.
 * @param {string} lockId - Identifiant du verrou
 */
function showLockChallenge(lockId) {
    const currentCase = lockSystem.currentCase;

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

    // --- Vérification des prérequis avant d'ouvrir le défi ---
    const status = getLockStatus(lock);
    if (!status.canUnlock) {
        const prereqNames = getPrereqNames(status.missingPrereqs, currentCase.locks);
        const message = `Ce verrou est verrouillé. Déverrouillez d'abord : ${prereqNames.join(', ')}`;
        showNotification(`🔒 ${message}`);
        return;
    }

    let lockAttempts = 0;

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
                <p class="challenge-question">${escapeHtml(lock.challenge.question)}</p>
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
                <p class="challenge-question">${escapeHtml(lock.challenge.question)}</p>
                <div class="mcq-options">
                    ${lock.challenge.options.map((opt, i) =>
                        `<div class="mcq-option" data-index="${i}">${escapeHtml(opt)}</div>`
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
            // 3 échecs : information révélée mais PAS de points de démarche
            newCancelBtn.onclick = () => {
                unlock(lockId, { revealed: true });
                modalOverlay.remove();
            };
            if (typeof gsap !== 'undefined') {
                gsap.to(".lock-modal", { y: -10, repeat: 1, yoyo: true, duration: 0.2 });
            }
        } else {
            document.getElementById('lock-error').textContent = lock.feedback_error || "Réponse incorrecte.";
            if (typeof gsap !== 'undefined') {
                gsap.to(".lock-modal", { x: 10, repeat: 3, yoyo: true, duration: 0.1 });
            }
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
            // 3 échecs : information révélée mais PAS de points de démarche
            newCancelBtn.onclick = () => {
                unlock(lockId, { revealed: true });
                modalOverlay.remove();
            };
            if (typeof gsap !== 'undefined') {
                gsap.to(".lock-modal", { y: -10, repeat: 1, yoyo: true, duration: 0.2 });
            }
        } else {
            document.getElementById('lock-error').textContent = lock.feedback_error || "Réponse incorrecte.";
            if (typeof gsap !== 'undefined') {
                gsap.to(".lock-modal", { x: 10, repeat: 3, yoyo: true, duration: 0.1 });
            }
        }
    }
}

/**
 * Déverrouille (ou révèle) un verrou.
 * @param {string} lockId
 * @param {{ revealed?: boolean }} [opts] — revealed=true : information obtenue
 *        après 3 échecs → le champ devient visible mais SANS points de démarche.
 */
function unlock(lockId, opts = {}) {
    const revealed = !!opts.revealed;
    lockSystem.unlockedLocks.add(_lockKey(lockId));
    saveLocks();

    // Suivi démarche pour le scoring composite — uniquement si le défi est RÉSOLU
    if (!revealed && typeof trackLockUnlocked === 'function') {
        trackLockUnlocked(lockId);
    }

    // Dispatcher un événement pour que le 3D Lock Agent soit notifié
    document.dispatchEvent(new CustomEvent('locksystem-unlock', {
        detail: { lockId, revealed }
    }));

    if (lockSystem.onLoadCase) {
        lockSystem.onLoadCase(true);
    }
}

window.lockSystem = lockSystem;
window.showLockChallenge = showLockChallenge;
window.isLockUnlocked = isLockUnlocked;
window.resetLocksForNewCase = resetLocksForNewCase;
