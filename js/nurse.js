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
                    <svg viewBox="0 0 400 500">
                        <defs>
                            <!-- Gradients pour donner du volume -->
                            <linearGradient id="skinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="#FFE0D2"/>
                                <stop offset="100%" stop-color="#E5C1B3"/>
                            </linearGradient>
                            
                            <linearGradient id="scrubsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#00D4FF"/>
                                <stop offset="100%" stop-color="#0088CC"/>
                            </linearGradient>

                            <linearGradient id="scrubsDarkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="#0088CC"/>
                                <stop offset="100%" stop-color="#005588"/>
                            </linearGradient>

                            <!-- Ombre portée pour détacher le personnage du fond -->
                            <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="10" stdDeviation="15" flood-color="#000000" flood-opacity="0.4"/>
                            </filter>

                            <!-- Effet de lueur (Glow) pour la tablette -->
                            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
                                <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>

                        <g filter="url(#dropShadow)">
                            <!-- Lueur d'arrière-plan (optionnelle, aide à l'intégration sur fond sombre) -->
                            <circle cx="200" cy="220" r="150" fill="#00D4FF" opacity="0.05" />

                            <!-- === CORPS & TENUE === -->
                            <!-- Pantalon -->
                            <path d="M160 380 L160 480 L195 480 L195 420 L205 420 L205 480 L240 480 L240 380 Z" fill="url(#scrubsDarkGrad)"/>
                            
                            <!-- Chaussures -->
                            <path d="M150 480 Q150 460 170 460 L195 460 L195 490 L160 490 Q150 490 150 480 Z" fill="#1A202C"/>
                            <path d="M250 480 Q250 460 230 460 L205 460 L205 490 L240 490 Q250 490 250 480 Z" fill="#1A202C"/>

                            <!-- Tunique (Scrubs) -->
                            <path d="M130 220 Q120 220 110 240 L90 310 Q85 325 100 330 L115 315 L125 390 L275 390 L285 315 L300 330 Q315 325 310 310 L290 240 Q280 220 270 220 Z" fill="url(#scrubsGrad)"/>
                            
                            <!-- Col en V -->
                            <path d="M180 220 L200 260 L220 220 Z" fill="#E5C1B3"/>
                            <path d="M175 220 L200 265 L225 220 L210 220 L200 250 L190 220 Z" fill="#005588"/>

                            <!-- Poche et Badge -->
                            <path d="M245 280 L275 280 L275 310 Q260 320 245 310 Z" fill="#005588" opacity="0.5"/>
                            <rect x="135" y="270" width="30" height="15" rx="2" fill="#FFFFFF"/>
                            <rect x="138" y="273" width="8" height="8" rx="1" fill="#FF3366"/> <!-- Photo de profil générique -->
                            <line x1="150" y1="275" x2="160" y2="275" stroke="#1A202C" stroke-width="2" stroke-linecap="round"/>
                            <line x1="150" y1="280" x2="158" y2="280" stroke="#A0AEC0" stroke-width="1.5" stroke-linecap="round"/>

                            <!-- === TÊTE & VISAGE === -->
                            <!-- Cou -->
                            <rect x="185" y="190" width="30" height="40" fill="url(#skinGrad)"/>
                            <path d="M185 210 Q200 225 215 210 Z" fill="#000000" opacity="0.1"/> <!-- Ombre sous le menton -->

                            <!-- Oreilles -->
                            <circle cx="150" cy="160" r="12" fill="url(#skinGrad)"/>
                            <circle cx="250" cy="160" r="12" fill="url(#skinGrad)"/>

                            <!-- Visage (Forme de tête) -->
                            <path d="M150 140 Q150 80 200 80 Q250 80 250 140 Q250 200 200 210 Q150 200 150 140 Z" fill="url(#skinGrad)"/>

                            <!-- Cheveux / Coiffe -->
                            <path d="M145 130 Q145 70 200 65 Q255 70 255 130 Q250 100 200 100 Q150 100 145 130 Z" fill="#2D3748"/>
                            <path d="M135 120 Q160 90 200 105 L200 65 Q145 75 135 120 Z" fill="#4A5568"/> <!-- Reflet cheveux -->

                            <!-- Yeux -->
                            <g>
                                <ellipse cx="180" cy="150" rx="6" ry="8" fill="#1A202C"/>
                                <ellipse cx="220" cy="150" rx="6" ry="8" fill="#1A202C"/>
                                <!-- Éclat des yeux -->
                                <circle cx="182" cy="147" r="2" fill="#FFFFFF"/>
                                <circle cx="222" cy="147" r="2" fill="#FFFFFF"/>
                                <!-- Eyelids for blinking animation -->
                                <rect class="eye-lid" x="172" y="140" width="16" height="20" fill="url(#skinGrad)" opacity="0" />
                                <rect class="eye-lid" x="212" y="140" width="16" height="20" fill="url(#skinGrad)" opacity="0" />
                            </g>

                            <!-- Sourcils -->
                            <path d="M170 135 Q180 130 188 135" stroke="#1A202C" stroke-width="3" stroke-linecap="round" fill="none"/>
                            <path d="M212 135 Q220 130 230 135" stroke="#1A202C" stroke-width="3" stroke-linecap="round" fill="none"/>

                            <!-- Joues (Blush subtil) -->
                            <ellipse cx="165" cy="165" rx="8" ry="5" fill="#FF6B6B" opacity="0.3"/>
                            <ellipse cx="235" cy="165" rx="8" ry="5" fill="#FF6B6B" opacity="0.3"/>

                            <!-- Sourire (Confiant) -->
                            <path d="M185 175 Q200 190 215 175" stroke="#1A202C" stroke-width="3" stroke-linecap="round" fill="none"/>

                            <!-- === ACCESSOIRES === -->
                            <!-- Stéthoscope -->
                            <!-- Tube autour du cou -->
                            <path d="M160 230 Q150 280 200 300 Q250 280 240 230" stroke="#2D3748" stroke-width="8" stroke-linecap="round" fill="none"/>
                            <!-- Raccords en Y -->
                            <path d="M200 300 L200 340" stroke="#2D3748" stroke-width="8" stroke-linecap="round" />
                            <circle cx="200" cy="345" r="12" fill="#E2E8F0" stroke="#2D3748" stroke-width="4"/>
                            <circle cx="200" cy="345" r="4" fill="#00D4FF"/> <!-- Rappel cyan -->
                            <circle class="pulse-dot" cx="200" cy="345" r="7" fill="#00D4FF" opacity="0.3" />

                            <!-- === BRAS ET TABLETTE HOLOGRAPHIQUE === -->
                            <!-- Bras Gauche (Repos) -->
                            <path d="M115 240 Q90 290 95 350" stroke="url(#scrubsGrad)" stroke-width="25" stroke-linecap="round" fill="none"/>
                            <circle cx="95" cy="360" r="12" fill="url(#skinGrad)"/> <!-- Main gauche -->

                            <!-- Bras Droit (Tenant la tablette) -->
                            <path d="M285 240 Q310 270 280 320" stroke="url(#scrubsGrad)" stroke-width="25" stroke-linecap="round" fill="none"/>
                            
                            <!-- Tablette / Dossier Médical Holographique -->
                            <g transform="translate(250, 300) rotate(-15)">
                                <!-- Corps de la tablette -->
                                <rect x="0" y="0" width="60" height="80" rx="5" fill="#1A202C" stroke="#4A5568" stroke-width="3"/>
                                <!-- Écran (Avec effet glow cyan) -->
                                <rect x="5" y="5" width="50" height="70" rx="2" fill="#000000"/>
                                <!-- Contenu de l'écran -->
                                <line x1="10" y1="15" x2="40" y2="15" stroke="#00D4FF" stroke-width="3" stroke-linecap="round" filter="url(#glow)"/>
                                <line x1="10" y1="25" x2="50" y2="25" stroke="#00D4FF" stroke-width="2" stroke-linecap="round" filter="url(#glow)"/>
                                <line x1="10" y1="35" x2="45" y2="35" stroke="#00D4FF" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
                                <!-- Croix médicale sur l'écran -->
                                <path d="M25 50 L35 50 L35 60 L45 60 L45 70 L35 70 L35 80 L25 80 L25 70 L15 70 L15 60 L25 60 Z" fill="#00D4FF" transform="scale(0.3) translate(50, 100)" filter="url(#glow)"/>
                            </g>
                            
                            <!-- Main Droite (Par-dessus la tablette) -->
                            <path d="M275 325 Q270 315 260 320 Q265 330 280 335 Z" fill="url(#skinGrad)"/>
                        </g>
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

        // Hide persistent UI elements during intro
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) sidebarToggle.style.visibility = 'hidden';

        const mobileTabs = document.querySelector('.mobile-tabs');
        if (mobileTabs) mobileTabs.style.visibility = 'hidden';

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

        // Restore persistent UI elements after intro
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) sidebarToggle.style.visibility = 'visible';

        const mobileTabs = document.querySelector('.mobile-tabs');
        if (mobileTabs) mobileTabs.style.visibility = 'visible';

        if (typeof onDismissCallback === 'function') {
            onDismissCallback();
            onDismissCallback = null;
        }
    }

    return { init, show, hide };
})();
