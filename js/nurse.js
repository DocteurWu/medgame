/**
 * Nurse NPC Module
 * Displays an animated nurse that introduces the patient at the start of each case.
 * Auto-dismisses after a countdown with a gradient progress bar.
 */
const NurseIntro = (() => {
    let overlayEl = null;
    let bubbleTextEl = null;
    let onDismissCallback = null;
    let autoDismissTimer = null;
    const AUTO_DISMISS_DURATION = 6000; // 6 seconds

    const NURSE_PHRASES = [
        `Bonjour Docteur ! Je vous présente {patient}, {age} ans. {pronoun} a été {admission} pour : {motif}.`,
        `Docteur, votre nouveau patient : {patient}, {age} ans, {admission} pour {motif}.`,
        `Bonjour ! {patient}, {age} ans, vient d'arriver. Motif : {motif}.`,
        `Docteur, on a besoin de vous ! {patient}, {age} ans, {admission} pour {motif}.`,
        `Vite Docteur ! {patient}, {age} ans, se présente pour {motif}.`,
        `Ah Docteur, vous tombez bien ! Voici {patient}, {age} ans. {pronoun} consulte pour {motif}.`,
        `Docteur ! J'ai {patient} pour vous, {age} ans, {admission} pour {motif}.`,
        `Nouveau cas : {patient}, {age} ans. Motif d'admission : {motif}.`,
        `{patient}, {age} ans, attend votre diagnostic. Motif : {motif}.`,
        `Docteur, je vous amène {patient}, {age} ans. {pronoun} se plaint de {motif}.`,
        `On vous attendait ! {patient}, {age} ans, est là pour {motif}.`,
        `Bonjour Docteur ! {patient}, {age} ans, a été {admission} ce matin pour {motif}.`
    ]

    /**
     * Injects the nurse overlay HTML into the DOM if not present.
     */
    function init() {
        if (document.getElementById('nurse-overlay')) {
            overlayEl = document.getElementById('nurse-overlay');
            bubbleTextEl = document.getElementById('nurse-bubble-text');
            return;
        }

        const html = `
        <div id="nurse-overlay" class="nurse-overlay" aria-hidden="true">
            <div class="nurse-container">
                <div class="npc-wrapper">
                    <!-- Shadow -->
                    <div style="position:absolute; inset-inline: 20px; bottom: -10px; height: 16px; background: rgba(100,116,139,0.25); border-radius: 50%; filter: blur(6px);"></div>
                    <!-- Nurse SVG -->
                    <svg viewBox="0 0 260 320">
                        <!-- Corps -->
                        <rect x="80" y="120" width="100" height="130" rx="26" fill="#38bdf8" />
                        <rect x="80" y="180" width="100" height="4" fill="#0ea5e9" opacity="0.7" />
                        <!-- Badge -->
                        <rect x="152" y="135" width="34" height="22" rx="4" fill="#e0f2fe" />
                        <line x1="156" y1="145" x2="180" y2="145" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round" />
                        <line x1="156" y1="150" x2="176" y2="150" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" />
                        <!-- Bras gauche -->
                        <path d="M80 140 C 50 160 48 200 70 215 L 84 206" fill="#38bdf8" />
                        <!-- Bras droit -->
                        <path d="M180 140 C 210 160 212 200 190 215 L 176 206" fill="#38bdf8" />
                        <!-- Tête -->
                        <circle cx="130" cy="80" r="46" fill="#fee2e2" />
                        <!-- Cheveux -->
                        <path d="M90 82 C 90 48 112 34 130 34 C 150 34 170 48 170 78 C 160 70 152 68 130 68 C 108 68 98 72 90 82Z" fill="#0f172a" />
                        <!-- Oreilles -->
                        <circle cx="86" cy="82" r="7" fill="#fecaca" />
                        <circle cx="174" cy="82" r="7" fill="#fecaca" />
                        <!-- Yeux -->
                        <g>
                            <circle cx="114" cy="84" r="4" fill="#0f172a" />
                            <circle cx="146" cy="84" r="4" fill="#0f172a" />
                            <rect class="eye-lid" x="108" y="80" width="12" height="8" fill="#fee2e2" opacity="0" />
                            <rect class="eye-lid" x="140" y="80" width="12" height="8" fill="#fee2e2" opacity="0" />
                        </g>
                        <!-- Sourire -->
                        <path d="M114 98 Q 130 110 146 98" fill="none" stroke="#b91c1c" stroke-width="2.5" stroke-linecap="round" />
                        <!-- Blouse col -->
                        <path d="M115 122 L130 140 L145 122" fill="#e0f2fe" />
                        <!-- Croix infirmier sur la poitrine -->
                        <circle cx="105" cy="150" r="12" fill="#e0f2fe" />
                        <rect x="103" y="143" width="4" height="14" fill="#0ea5e9" />
                        <rect x="98" y="148" width="14" height="4" fill="#0ea5e9" />
                        <!-- Stéthoscope -->
                        <path d="M95 128 C 84 138 84 160 100 164" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="round" />
                        <path d="M165 128 C 176 138 176 160 160 164" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="round" />
                        <path d="M100 164 C 115 174 145 174 160 164" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="round" />
                        <circle cx="130" cy="176" r="10" fill="#0f172a" />
                        <circle cx="130" cy="176" r="5" fill="#22c55e" />
                        <circle class="pulse-dot" cx="130" cy="176" r="7" fill="#22c55e" opacity="0.3" />
                        <!-- Jambes -->
                        <rect x="100" y="250" width="26" height="48" rx="10" fill="#0ea5e9" />
                        <rect x="134" y="250" width="26" height="48" rx="10" fill="#0ea5e9" />
                        <!-- Chaussures -->
                        <rect x="92" y="292" width="40" height="12" rx="6" fill="#0f172a" />
                        <rect x="128" y="292" width="40" height="12" rx="6" fill="#0f172a" />
                        <!-- Coiffe d'infirmier -->
                        <path d="M102 40 L158 40 C 162 40 165 44 164 48 L160 66 L100 66 L96 48 C 95 44 98 40 102 40Z" fill="#f8fafc" stroke="#0f172a" stroke-width="1.5" />
                        <rect x="127" y="46" width="6" height="14" fill="#0ea5e9" />
                        <rect x="122" y="51" width="16" height="4" fill="#0ea5e9" />
                    </svg>
                </div>
                <!-- Speech Bubble -->
                <div class="speech-bubble">
                    <p id="nurse-bubble-text" class="bubble-text"></p>
                    <!-- Progress bar for auto-dismiss -->
                    <div class="nurse-progress-container">
                        <div id="nurse-progress-bar" class="nurse-progress-bar"></div>
                    </div>
                </div>
                <p class="nurse-hint">Cliquez n'importe où pour continuer</p>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('afterbegin', html);  // Insert at start of body for faster visibility
        overlayEl = document.getElementById('nurse-overlay');
        bubbleTextEl = document.getElementById('nurse-bubble-text');

        // Clicking anywhere on the overlay dismisses it immediately
        overlayEl.addEventListener('click', hide);
    }

    // Initialize immediately when script loads to create DOM early
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /**
     * Displays the nurse overlay with patient info.
     * Auto-dismisses after AUTO_DISMISS_DURATION.
     * @param {Object} patient - { nom, prenom, age, sexe }
     * @param {string} motif - Reason for hospitalization
     * @param {Function} callback - Called when dismissed
     */
    function show(patient, motif, callback) {
        if (!overlayEl) init();
        onDismissCallback = callback || null;

        // Clear any existing timer
        if (autoDismissTimer) {
            clearTimeout(autoDismissTimer);
            autoDismissTimer = null;
        }

        const pronoun = (patient.sexe && patient.sexe.toLowerCase().startsWith('f')) ? 'Elle' : 'Il';
        const admission = (patient.sexe && patient.sexe.toLowerCase().startsWith('f')) ? 'admise' : 'admis';

        const randomPhrase = NURSE_PHRASES[Math.floor(Math.random() * NURSE_PHRASES.length)];
        const text = randomPhrase
            .replace('{patient}', `<span class="patient-name">${patient.prenom} ${patient.nom}</span>`)
            .replace('{age}', patient.age)
            .replace('{pronoun}', pronoun)
            .replace('{admission}', admission)
            .replace('{motif}', `<span class="motif">${motif}</span>`);

        bubbleTextEl.innerHTML = text;

        // Reset progress bar animation
        const progressBar = document.getElementById('nurse-progress-bar');
        if (progressBar) {
            progressBar.style.animation = 'none';
            // Force reflow
            progressBar.offsetHeight;
            progressBar.style.animation = `progressShrink ${AUTO_DISMISS_DURATION}ms linear forwards`;
        }

        overlayEl.classList.add('visible');
        overlayEl.setAttribute('aria-hidden', 'false');

        // Auto-dismiss after duration
        autoDismissTimer = setTimeout(() => {
            hide();
        }, AUTO_DISMISS_DURATION);
    }

    /**
     * Hides the nurse overlay and calls the callback.
     */
    function hide() {
        // Clear timer if manually dismissed
        if (autoDismissTimer) {
            clearTimeout(autoDismissTimer);
            autoDismissTimer = null;
        }

        if (overlayEl) {
            overlayEl.classList.remove('visible');
            overlayEl.setAttribute('aria-hidden', 'true');
        }
        if (typeof onDismissCallback === 'function') {
            onDismissCallback();
            onDismissCallback = null;
        }
    }

    return { init, show, hide };
})();
