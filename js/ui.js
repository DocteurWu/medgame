/**
 * js/ui.js — Interface utilisateur : modales, affichage valeurs, navigation
 * Phase 6 du refactoring : extrait de game.js
 */

const uiState = {
    currentCase: null,
    currentZoom: 1,
    fireworksInstance: null,
    backgroundMusicEl: null,
    onCorrectionNext: null // callback from game.js
};

// ==================== CORRECTION MODAL ====================

function renderCorrectionContent(text) {
    const contentEl = document.getElementById('correction-content') || document.getElementById('correction-preview-area');
    if (!contentEl) return;

    if (!text) {
        contentEl.innerHTML = '';
        return;
    }

    if (/<[a-z][\s\S]*>/i.test(text)) {
        contentEl.innerHTML = text;
        return;
    }

    const lines = text.split('\n');
    let html = '';
    let inList = false;

    for (let line of lines) {
        const t = line.trim();
        if (t.startsWith('# ')) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h1>${escapeHtml(t.slice(2))}</h1>`;
            continue;
        }
        if (t.startsWith('## ')) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h2>${escapeHtml(t.slice(3))}</h2>`;
            continue;
        }
        if (t.startsWith('### ')) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h3>${escapeHtml(t.slice(4))}</h3>`;
            continue;
        }
        if (t.startsWith('- ')) {
            if (!inList) { html += '<ul>'; inList = true; }
            html += '<li>' + escapeHtml(t.slice(2)) + '</li>';
        } else {
            if (inList) { html += '</ul>'; inList = false; }
            if (t === '') { html += '<br>'; }
            else { html += '<p>' + escapeHtml(t) + '</p>'; }
        }
    }
    if (inList) html += '</ul>';

    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');

    contentEl.innerHTML = html;
}

window.renderCorrectionMd = renderCorrectionContent;

function renderCaseSummary(c) {
    if (!c) return '';
    const patient = `<h4>Patient</h4><p>${escapeHtml(c.patient.nom)} ${escapeHtml(c.patient.prenom || '')} · ${escapeHtml(String(c.patient.age))} ans · ${escapeHtml(c.patient.sexe)}</p>
    <p>Taille: ${escapeHtml(c.patient.taille || '--')} · Poids: ${escapeHtml(c.patient.poids || '--')} · Groupe: ${escapeHtml(c.patient.groupeSanguin || '--')}</p>`;
    const motif = `<p><strong>Motif:</strong> ${escapeHtml(c.interrogatoire.motifHospitalisation || '')}</p>`;
    const constantes = `<h4>Constantes</h4><p>Tension: ${escapeHtml(c.examenClinique.constantes.tension || '')} · Pouls: ${escapeHtml(c.examenClinique.constantes.pouls || '')} · Température: ${escapeHtml(c.examenClinique.constantes.temperature || '')} · SpO2: ${escapeHtml(c.examenClinique.constantes.saturationO2 || '')} · FR: ${escapeHtml(c.examenClinique.constantes.frequenceRespiratoire || '')}</p>`;
    const exams = c.examResults ? Object.keys(c.examResults).map(k => `<div><strong>${escapeHtml(k)}:</strong> ${escapeHtml(typeof c.examResults[k] === 'string' ? c.examResults[k] : (c.examResults[k].value || ''))}</div>`).join('') : '';
    const examsBlock = exams ? `<h4>Résultats d'examens</h4>${exams}` : '';
    return patient + motif + constantes + examsBlock;
}

function showCorrectionModal(text) {
    const contentEl = document.getElementById('correction-content');
    if (!contentEl) return;

    let finalHtml = '';

    if (text) {
        const htmlMatch = text.match(/^([\s\S]*?<hr[^>]*>)([\s\S]*)$/);
        if (htmlMatch) {
            finalHtml += htmlMatch[1];
            finalHtml += parseMarkdown(htmlMatch[2]);
        } else {
            if (/<[a-z][\s\S]*>/i.test(text)) {
                finalHtml += text;
            } else {
                finalHtml += parseMarkdown(text);
            }
        }
    }

    const c = uiState.currentCase;
    if (c && c.correctionImage) {
        finalHtml += `<div style="text-align: center; margin-top: 20px;">
                    <img src="${c.correctionImage}" style="max-width: 100%; max-height: 400px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.3); border: 2px solid var(--glass-border); cursor: pointer;" onclick="window.showImageModal('${c.correctionImage}', 'Illustration Correction')">
                </div>`;
    }

    if (c && c.redacteur) {
        finalHtml += `<div style="font-size: 0.8em; color: #888; text-align: right; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; font-style: italic;">Merci à ${escapeHtml(c.redacteur)} pour avoir rédigé ce cas !</div>`;
    }

    if (c && c.id) {
        finalHtml += `<div style="font-size: 0.7em; color: rgba(58, 52, 52, 0.2); text-align: right; margin-top: 5px;">ID: ${escapeHtml(c.id)}</div>`;
    }

    contentEl.innerHTML = finalHtml;
    const overlay = document.getElementById('correction-overlay');
    if (overlay) overlay.style.display = 'flex';
}

function hideCorrectionModal() {
    const overlay = document.getElementById('correction-overlay');
    if (overlay) overlay.style.display = 'none';
}

// ==================== IMAGE MODAL ====================

function showImageModal(src, caption) {
    const overlay = document.getElementById('image-overlay');
    const img = document.getElementById('image-modal-img');
    const cap = document.getElementById('image-modal-caption');
    if (img) img.src = src || '';
    if (img) img.alt = caption || '';
    if (cap) cap.textContent = caption || '';
    if (overlay) overlay.style.display = 'flex';
    currentZoom = 1;
    updateImageZoom();
}

function hideImageModal() {
    const overlay = document.getElementById('image-overlay');
    const img = document.getElementById('image-modal-img');
    if (img) img.src = '';
    if (overlay) overlay.style.display = 'none';
}

function updateImageZoom() {
    const img = document.getElementById('image-modal-img');
    if (img) img.style.transform = `scale(${currentZoom})`;
}

window.showImageModal = showImageModal;
let currentZoom = 1;
window.zoomImage = (delta) => {
    currentZoom = Math.min(Math.max(currentZoom + delta, 0.5), 3);
    updateImageZoom();
};

// ==================== DISPLAY HELPERS ====================

/**
 * Affiche une valeur dans un élément DOM, avec support du masquage (lock).
 * @param {HTMLElement} element - Élément cible
 * @param {*} value - Valeur à afficher
 * @param {string} path - Chemin du champ (pour vérifier les locks)
 */
function displayValue(element, value, path) {
    if (!element) return;

    if (path && isFieldLocked(path)) {
        const lock = getLockForField(path);
        element.setAttribute('data-locked', 'true');
        element.innerHTML = `
            <div class="lock-placeholder" onclick="window.showLockChallenge('${lock.id}')">
                <i class="fas fa-lock"></i>
                <span class="challenge-text">DÉFI À RELEVER</span>
            </div>
        `;
        return;
    }

    const isNew = element.getAttribute('data-locked') === 'true';
    element.textContent = value ?? '';

    if (isNew) {
        element.removeAttribute('data-locked');
        element.classList.add('unlocked-data');
    }
}

function displayQuestionBtn(element, questionText, value, path, isHtml = false) {
    if (!element) return;

    if (path && isFieldLocked(path)) {
        const lock = getLockForField(path);
        element.setAttribute('data-locked', 'true');
        element.innerHTML = `
            <div class="lock-placeholder" onclick="window.showLockChallenge('${lock.id}')">
                <i class="fas fa-lock"></i>
                <span class="challenge-text">DÉFI À RELEVER</span>
            </div>
        `;
        return;
    }

    element.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'btn-question primary-btn';
    btn.innerHTML = `<i class="fas fa-question-circle"></i> ${questionText} <span style="font-size:0.8em; opacity:0.8; margin-left:5px;">(-5s)</span>`;
    btn.style.margin = '5px 0';
    btn.style.width = '100%';
    btn.style.textAlign = 'left';

    btn.onclick = () => {
        if (typeof window.deductTime === 'function') {
            const hasTime = window.deductTime(5);
            if (!hasTime) {
                showNotification("Temps in-game insuffisant pour poser cette question.");
                if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('alert');
                return;
            }
        }

        if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('click');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Le patient réfléchit...';
        btn.disabled = true;

        setTimeout(() => {
            if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('reveal');
            if (isHtml) {
                const safeValue = value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                element.innerHTML = `<div class="answer-fade-in unlocked-data" style="text-align: left; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px; margin: 5px 0;">${safeValue}</div>`;
            } else {
                element.innerHTML = `<div class="answer-fade-in unlocked-data" style="text-align: left; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px; margin: 5px 0;">${escapeHtml(value ?? '')}</div>`;
            }
        }, 500);
    };

    element.appendChild(btn);
}

window.revealAllInterrogatoire = function() {
    const section = document.getElementById('section-anamnese');
    if (!section) return;

    // Seulement les boutons pas encore répondu
    const btns = Array.from(section.querySelectorAll('.btn-question:not([disabled])'));
    if (btns.length === 0) {
        showNotification('Tout est déjà affiché !');
        return;
    }

    // 20% de réduction : N questions × 5s × 0.8
    const cost = Math.round(btns.length * 5 * 0.8);
    if (typeof window.deductTime === 'function') {
        const hasTime = window.deductTime(cost);
        if (!hasTime) {
            showNotification('Temps in-game insuffisant.');
            if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('alert');
            return;
        }
    }

    if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('select');

    // Cacher le bouton "tout afficher"
    const revealBtn = document.getElementById('btn-reveal-all');
    if (revealBtn) revealBtn.style.display = 'none';

    // Cliquer chaque bouton avec un léger décalage
    btns.forEach((btn, i) => {
        setTimeout(() => btn.click(), i * 120);
    });
};

// ==================== INIT ====================

function initUI() {
    // Correction modal controls
    const correctionBack = document.getElementById('correction-back');
    if (correctionBack) correctionBack.addEventListener('click', hideCorrectionModal);

    const toggleReview = document.getElementById('toggle-case-review');
    if (toggleReview) toggleReview.addEventListener('click', () => {
        const panel = document.getElementById('case-review');
        if (panel.style.display === 'none' || panel.style.display === '') {
            panel.style.display = 'block';
            panel.innerHTML = renderCaseSummary(uiState.currentCase);
        } else {
            panel.style.display = 'none';
        }
    });

    const correctionNext = document.getElementById('correction-next');
    if (correctionNext) correctionNext.addEventListener('click', () => {
        if (uiState.fireworksInstance) uiState.fireworksInstance.stop();
        if (uiState.backgroundMusicEl) uiState.backgroundMusicEl.play();
        hideCorrectionModal();
        if (uiState.onCorrectionNext) uiState.onCorrectionNext();
    });

    // Image modal controls
    const imageCloseBtn = document.getElementById('image-modal-close');
    if (imageCloseBtn) imageCloseBtn.addEventListener('click', hideImageModal);
    const imageOverlay = document.getElementById('image-overlay');
    if (imageOverlay) imageOverlay.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'image-overlay') hideImageModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideImageModal();
    });
}
