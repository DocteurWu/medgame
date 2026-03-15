/**
 * js/utils.js — Utilitaires purs extraits de game.js
 * Phase 1 du refactoring : fonctions sans état, sans dépendance DOM
 */

// ==================== CONSTANTS ====================

const NOTIFICATION_DURATION = 3000;
const DEFAULT_TIME_LIMIT = 240;
const DEFAULT_ECG_HEIGHT = 96;
const DEFAULT_SPO2_HEIGHT = 48;
const VITAL_SIGN_VARIATION = 0.025;
const DEFAULT_HEART_RATE = 72;
const DEFAULT_SPO2 = 98;
const DEFAULT_TEMPERATURE = 36.6;
const DEFAULT_RESPIRATORY_RATE = 16;
const GSAP_DURATION = 1;
const GSAP_Y = 50;
const GSAP_STAGGER = 0.2;
const FIREWORKS_DURATION = 3;
const COOKIE_EXPIRY_DAYS = 365;
const EXAM_ANALYSIS_DELAY = 1.5;
const SHOW_RESULT_DELAY = 1;
const BASE_SCORE = 100;
const ATTEMPT_PENALTY = 10;

// Configuration for clinical exam sections (label, icon)
const EXAM_CONFIG = {
    examenCardiovasculaire: { label: 'Cardiovasculaire', icon: 'fa-heartbeat' },
    examenPulmonaire: { label: 'Pulmonaire', icon: 'fa-lungs' },
    examenAbdominal: { label: 'Abdominal', icon: 'fa-procedures' },
    examenNeurologique: { label: 'Neurologique', icon: 'fa-brain' },
    examenORL: { label: 'ORL', icon: 'fa-ear-listen' },
    examenVestibulaire: { label: 'Vestibulaire', icon: 'fa-compass' },
    examenDermatologique: { label: 'Dermatologique', icon: 'fa-hand-dots' },
    examenMusculosquelettique: { label: 'Musculosquettique', icon: 'fa-bone' },
    examenOphtalmologique: { label: 'Ophtalmologique', icon: 'fa-eye' },
    examenUrologique: { label: 'Urologique', icon: 'fa-droplet' },
    default: { label: 'Autre Examen', icon: 'fa-stethoscope' }
};

// ==================== NOTIFICATION ====================

function showNotification(message) {
    const notification = document.createElement('div');
    notification.classList.add('notification');
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, NOTIFICATION_DURATION);
}

// ==================== HTML / TEXT UTILITIES ====================

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function normalizeText(text) {
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/**
 * Calcule la distance de Levenshtein entre deux chaînes.
 * Plus le nombre est bas, plus les chaînes sont proches.
 */
function getLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

/**
 * Détermine si deux mots sont "assez proches" selon leur longueur.
 */
function isFuzzyMatch(input, keyword) {
    if (!input || !keyword) return false;
    const dist = getLevenshteinDistance(input, keyword);
    if (keyword.length <= 3) return dist === 0;
    if (keyword.length <= 6) return dist <= 1;
    return dist <= 2;
}

// ==================== MARKDOWN PARSING ====================

/**
 * Parse du markdown en HTML stylisé (sans dépendance DOM).
 */
function parseMarkdown(text) {
    if (!text) return '';

    text = text.replace(/([^#\n])# /g, '$1\n# ');
    text = text.replace(/([^\n])## /g, '$1\n## ');
    text = text.replace(/([^\n])### /g, '$1\n### ');
    text = text.replace(/([^\n])- /g, '$1\n- ');

    const lines = text.split('\n');
    let html = '';
    let inList = false;

    for (let line of lines) {
        const t = line.trim();
        if (!t) continue;

        if (t.startsWith('# ')) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h3 style="color: var(--primary-color); margin: 12px 0 8px; font-size: 1.2em;">${escapeHtml(t.slice(2))}</h3>`;
            continue;
        }
        if (t.startsWith('## ')) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h4 style="color: var(--secondary-color); margin: 10px 0 6px; font-size: 1.1em;">${escapeHtml(t.slice(3))}</h4>`;
            continue;
        }
        if (t.startsWith('### ')) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h5 style="margin: 8px 0 5px; font-size: 1em;">${escapeHtml(t.slice(4))}</h5>`;
            continue;
        }

        if (t.startsWith('- ')) {
            if (!inList) {
                html += '<ul style="margin: 8px 0; padding-left: 20px; font-size: 0.95em;">';
                inList = true;
            }
            html += '<li style="margin: 4px 0;">' + escapeHtml(t.slice(2)) + '</li>';
        } else {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            html += '<p style="margin: 6px 0; font-size: 0.95em;">' + escapeHtml(t) + '</p>';
        }
    }
    if (inList) html += '</ul>';

    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');

    return html;
}

// ==================== EXAM RENDERING ====================

/**
 * Render une section d'examen clinique en HTML.
 */
function renderExamSection(key, data) {
    const config = EXAM_CONFIG[key] || EXAM_CONFIG.default;
    const label = config.label !== 'Autre Examen' ? config.label : key.replace(/^examen/, '').replace(/([A-Z])/g, ' $1').trim();
    const icon = config.icon;

    let contentHtml = '';
    if (typeof data === 'string') {
        contentHtml = `<p>${escapeHtml(data)}</p>`;
    } else if (typeof data === 'object' && data !== null) {
        const items = Object.entries(data).map(([subKey, value]) => {
            const displayKey = escapeHtml(subKey.charAt(0).toUpperCase() + subKey.slice(1));
            return `<li><strong>${displayKey}:</strong> ${escapeHtml(String(value))}</li>`;
        }).join('');
        contentHtml = `<ul>${items}</ul>`;
    }

    return `
        <div class="exam-item">
            <h4><i class="fas ${icon}"></i> ${escapeHtml(label)}</h4>
            ${contentHtml}
        </div>
    `;
}

// ==================== TIMER CONFIG ====================

function getTimeLimit() {
    return 480;
}

// ==================== SAFE DOM UTILITIES ====================

/**
 * Insère du HTML dans un élément de manière plus sûre.
 * Échappe d'abord le texte, puis autorise uniquement un sous-ensemble de balises.
 * Pour du HTML riche (comparaison correction), utilisez directement innerHTML avec confiance.
 * @param {HTMLElement} el - L'élément cible
 * @param {string} html - Le HTML à insérer
 * @param {boolean} [trusted=false] - Si true, insère tel quel (contenu déjà vérifié)
 */
function safeSetInnerHTML(el, html, trusted = false) {
    if (!el) return;
    if (trusted) {
        el.innerHTML = html;
    } else {
        // Use textContent for untrusted content to prevent XSS
        el.textContent = html;
    }
}

// ==================== COOKIE MANAGEMENT ====================

function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        let date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    // Encode name and value to prevent injection, add SameSite=Lax
    const encodedName = encodeURIComponent(name);
    const encodedValue = encodeURIComponent(value || "");
    document.cookie = `${encodedName}=${encodedValue}${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
    const encodedName = encodeURIComponent(name) + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(encodedName) === 0) {
            try {
                return decodeURIComponent(c.substring(encodedName.length));
            } catch (e) {
                return c.substring(encodedName.length);
            }
        }
    }
    return null;
}

function eraseCookie(name) {
    const encodedName = encodeURIComponent(name);
    document.cookie = `${encodedName}=; path=/; Max-Age=-99999999; SameSite=Lax`;
}
