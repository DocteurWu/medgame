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
    examenMusculosquelettique: { label: 'Musculosquelettique', icon: 'fa-bone' },
    examenOphtalmologique: { label: 'Ophtalmologique', icon: 'fa-eye' },
    examenUrologique: { label: 'Urologique', icon: 'fa-droplet' },
    default: { label: 'Autre Examen', icon: 'fa-stethoscope' }
};

// ==================== NOTIFICATION ====================

function showNotification(message, level = 'info') {
    let container = document.getElementById('medgame-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'medgame-toast-container';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '999999';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        container.style.pointerEvents = 'none';
        container.style.maxWidth = '350px';
        container.style.width = 'calc(100% - 40px)';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.pointerEvents = 'auto';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '12px';
    toast.style.fontFamily = 'Inter, system-ui, sans-serif';
    toast.style.fontSize = '0.9rem';
    toast.style.fontWeight = '500';
    toast.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
    toast.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    toast.style.transform = 'translateY(-20px) scale(0.9)';
    toast.style.opacity = '0';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '10px';

    const levels = {
        success: {
            bg: 'rgba(240, 253, 244, 0.95)',
            border: '1px solid rgba(74, 222, 128, 0.4)',
            color: '#166534',
            icon: '✅'
        },
        warning: {
            bg: 'rgba(254, 252, 232, 0.95)',
            border: '1px solid rgba(250, 204, 21, 0.4)',
            color: '#854d0e',
            icon: '⚠️'
        },
        error: {
            bg: 'rgba(254, 242, 242, 0.95)',
            border: '1px solid rgba(248, 113, 113, 0.4)',
            color: '#991b1b',
            icon: '❌'
        },
        info: {
            bg: 'rgba(240, 249, 255, 0.95)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            color: '#075985',
            icon: 'ℹ️'
        }
    };

    const style = levels[level] || levels.info;
    toast.style.backgroundColor = style.bg;
    toast.style.border = style.border;
    toast.style.color = style.color;
    toast.style.backdropFilter = 'blur(8px)';
    
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    toast.innerHTML = `<span style="font-size: 1.1rem; flex-shrink: 0;">${style.icon}</span><span style="flex-grow: 1; word-break: break-word;">${message}</span>`;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.transform = 'translateY(0) scale(1)';
        toast.style.opacity = '1';
    });

    setTimeout(() => {
        toast.style.transform = prefersReducedMotion ? 'none' : 'translateY(-10px) scale(0.95)';
        toast.style.opacity = '0';
        toast.addEventListener('transitionend', () => {
            toast.remove();
            if (container.childNodes.length === 0) {
                container.remove();
            }
        });
    }, NOTIFICATION_DURATION);
}

// ==================== HTML / TEXT UTILITIES ====================

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
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
/**
 * Convertit un texte markdown basique en HTML (bold, italic, listes).
 * @param {string} text - Texte markdown
 * @returns {string} HTML généré
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
            html += `<h3 class="ecos-md-h3">${escapeHtml(t.slice(2))}</h3>`;
            continue;
        }
        if (t.startsWith('## ')) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h4 class="ecos-md-h4">${escapeHtml(t.slice(3))}</h4>`;
            continue;
        }
        if (t.startsWith('### ')) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h5 class="ecos-md-h5">${escapeHtml(t.slice(4))}</h5>`;
            continue;
        }

        if (t.startsWith('- ')) {
            if (!inList) {
                html += '<ul class="ecos-md-ul">';
                inList = true;
            }
            html += '<li class="ecos-md-li">' + escapeHtml(t.slice(2)) + '</li>';
        } else {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            html += '<p class="ecos-md-p">' + escapeHtml(t) + '</p>';
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
    // Timer adaptatif : urgence = 5min (300s), classique = 12min (720s), ECOS = 8min (480s)
    // Peut être surchargé par le cas (gameplayConfig.timeLimit) ou par sessionStorage (mode ECOS strict)
    if (sessionStorage.getItem('immersionMode') === 'immersif' || (typeof TIMER_CONFIG !== 'undefined' && TIMER_CONFIG.CURRENT_MODE === 'ecos')) {
        if (typeof gameState !== 'undefined' && gameState.currentCase && gameState.currentCase.gameplayConfig && gameState.currentCase.gameplayConfig.timeLimit) {
            return gameState.currentCase.gameplayConfig.timeLimit;
        }
        return 480; // 8 min pour le mode ECOS (format officiel CNG)
    }
    if (typeof urgenceState !== 'undefined' && urgenceState.isUrgenceMode) {
        return 300; // 5 minutes pour les cas d'urgence
    }
    if (typeof gameState !== 'undefined' && gameState.currentCase && gameState.currentCase.gameplayConfig && gameState.currentCase.gameplayConfig.timeLimit) {
        return gameState.currentCase.gameplayConfig.timeLimit;
    }
    return 720; // 12 minutes par défaut (mode classique)
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
    if (name === 'playedCases') {
        localStorage.setItem('playedCases_storage', value || "");
        if (value) {
            const parts = value.split(',').filter(Boolean);
            if (parts.length > 30) {
                value = parts.slice(parts.length - 30).join(',');
            }
        }
    }

    let expires = "";
    if (days) {
        let date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    const encodedName = encodeURIComponent(name);
    const encodedValue = encodeURIComponent(value || "");
    document.cookie = `${encodedName}=${encodedValue}${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
    if (name === 'playedCases') {
        const stored = localStorage.getItem('playedCases_storage');
        if (stored !== null) return stored;
    }

    const encodedName = encodeURIComponent(name) + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(encodedName) === 0) {
            try {
                const val = decodeURIComponent(c.substring(encodedName.length));
                if (name === 'playedCases') {
                    localStorage.setItem('playedCases_storage', val);
                }
                return val;
            } catch (e) {
                const val = c.substring(encodedName.length);
                if (name === 'playedCases') {
                    localStorage.setItem('playedCases_storage', val);
                }
                return val;
            }
        }
    }
    return null;
}

function eraseCookie(name) {
    if (name === 'playedCases') {
        localStorage.removeItem('playedCases_storage');
    }
    const encodedName = encodeURIComponent(name);
    document.cookie = `${encodedName}=; path=/; Max-Age=-99999999; SameSite=Lax`;
}
