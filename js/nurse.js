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

    // Phrases neutres : SANS le motif d'hospitalisation (mode ECOS — l'étudiant
    // doit obtenir le motif lui-même auprès du patient, sinon premier item offert).
    const NURSE_PHRASES_NEUTRAL = [
        `Bonjour Docteur ! Je vous présente {patient}, {age} ans. {pronoun} vient d'être {admission}.`,
        `Docteur, votre nouveau patient : {patient}, {age} ans, tout juste {admission}.`,
        `Bonjour ! {patient}, {age} ans, vient d'arriver dans le service.`,
        `Docteur, on a besoin de vous ! {patient}, {age} ans vient d'être {admission}.`,
        `Vite Docteur ! {patient}, {age} ans, vous attend dans le box.`,
        `Ah Docteur, vous tombez bien ! Voici {patient}, {age} ans.`,
        `Docteur ! J'ai {patient} pour vous, {age} ans.`,
        `Nouveau cas : {patient}, {age} ans. Il/Elle n'a pas encore été interrogé(e).`,
        `{patient}, {age} ans, attend votre évaluation. Bonne chance !`,
        `Docteur, je vous amène {patient}, {age} ans.`,
        `On vous attendait ! {patient}, {age} ans, est installé(e).`,
        `Bonjour Docteur ! {patient}, {age} ans a été {admission} ce matin.`
    ];

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
                    <svg viewBox="0 0 400 500" class="nurse-character-svg" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <!-- Gradients Peau & Volumes -->
                            <linearGradient id="nurseSkin" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="#FFE8DF"/>
                                <stop offset="55%" stop-color="#F7D3C4"/>
                                <stop offset="100%" stop-color="#EAAFA0"/>
                            </linearGradient>
                            <linearGradient id="nurseSkinShade" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="#E4A897"/>
                                <stop offset="100%" stop-color="#CE8C7A"/>
                            </linearGradient>
                            
                            <!-- Cheveux modernes et soyeux -->
                            <linearGradient id="nurseHair" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#334155"/>
                                <stop offset="45%" stop-color="#1E293B"/>
                                <stop offset="100%" stop-color="#0F172A"/>
                            </linearGradient>
                            <linearGradient id="nurseHairSheen" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="#64748B"/>
                                <stop offset="100%" stop-color="#334155"/>
                            </linearGradient>

                            <!-- Blouse Médicale Cyan/Teal Haute Définition -->
                            <linearGradient id="scrubsBody" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#00F2FE"/>
                                <stop offset="35%" stop-color="#0891B2"/>
                                <stop offset="100%" stop-color="#0E7490"/>
                            </linearGradient>
                            <linearGradient id="scrubsSleeves" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="#06B6D4"/>
                                <stop offset="100%" stop-color="#0F6980"/>
                            </linearGradient>
                            <linearGradient id="scrubsPants" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="#0E7490"/>
                                <stop offset="100%" stop-color="#164E63"/>
                            </linearGradient>

                            <!-- Métal Stéthoscope & Chrome -->
                            <linearGradient id="metalChrome" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#FFFFFF"/>
                                <stop offset="25%" stop-color="#E2E8F0"/>
                                <stop offset="60%" stop-color="#94A3B8"/>
                                <stop offset="100%" stop-color="#475569"/>
                            </linearGradient>

                            <!-- Lanyard Tour de cou -->
                            <linearGradient id="lanyardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="#A855F7"/>
                                <stop offset="100%" stop-color="#6366F1"/>
                            </linearGradient>

                            <!-- Tablette Holographique -->
                            <linearGradient id="tabletGlass" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#0A1628"/>
                                <stop offset="100%" stop-color="#050C16"/>
                            </linearGradient>
                            <linearGradient id="hologramCyan" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stop-color="#00F2FE"/>
                                <stop offset="100%" stop-color="#4FACFE"/>
                            </linearGradient>

                            <!-- Filtres d'ombre et de lueur -->
                            <filter id="nurseGlow" x="-30%" y="-30%" width="160%" height="160%">
                                <feGaussianBlur stdDeviation="4" result="blur"/>
                                <feMerge>
                                    <feMergeNode in="blur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.45"/>
                            </filter>
                        </defs>

                        <g filter="url(#softShadow)">
                            <!-- Halo d'ambiance clinique -->
                            <circle cx="200" cy="225" r="145" fill="#00F2FE" opacity="0.06"/>

                            <!-- === 1. MEMBRES INFÉRIEURS === -->
                            <!-- Pantalon de bloc / Scrubs -->
                            <path d="M165 375 L160 472 L194 472 L196 422 L204 422 L206 472 L240 472 L235 375 Z" fill="url(#scrubsPants)"/>
                            <!-- Pli central entrejambe -->
                            <path d="M200 375 L200 422" stroke="#083344" stroke-width="2" stroke-linecap="round"/>

                            <!-- Sabots hospitaliers modernes -->
                            <path d="M152 472 Q150 458 168 458 L194 458 L194 480 L160 480 Q152 480 152 472 Z" fill="#0F172A"/>
                            <path d="M152 478 L194 478" stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round"/> <!-- Semelle sport cyan -->

                            <path d="M248 472 Q250 458 232 458 L206 458 L206 480 L240 480 Q248 480 248 472 Z" fill="#0F172A"/>
                            <path d="M206 478 L248 478" stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round"/>

                            <!-- === 2. BUSTE ET BLOUSE MÉDICALE === -->
                            <!-- Blouse (corps principal) -->
                            <path d="M135 224 Q116 230 108 245 L88 312 Q84 326 98 330 L118 316 L124 382 L276 382 L282 316 L302 330 Q316 326 312 312 L292 245 Q284 230 265 224 Z" fill="url(#scrubsBody)"/>
                            <!-- Ombrage latéral blouse -->
                            <path d="M124 382 L118 316 L108 245 Q120 238 135 228 L142 382 Z" fill="#000000" opacity="0.12"/>
                            <path d="M276 382 L282 316 L292 245 Q280 238 265 228 L258 382 Z" fill="#000000" opacity="0.12"/>

                            <!-- Sous-pull médical blanc / col propreté -->
                            <path d="M184 218 L200 238 L216 218 Z" fill="#F8FAFC"/>
                            <!-- Col V ergonomique avec liseré -->
                            <path d="M174 218 L200 258 L226 218 L214 218 L200 244 L186 218 Z" fill="#0E7490"/>

                            <!-- Poche poitrine droite avec stylo médical -->
                            <path d="M236 278 L268 278 L268 310 Q252 318 236 310 Z" fill="#0891B2" opacity="0.6"/>
                            <!-- Stylo clinique dans la poche -->
                            <rect x="242" y="265" width="4" height="20" rx="2" fill="#E2E8F0"/>
                            <rect x="242" y="265" width="4" height="6" rx="1" fill="#00F2FE"/>

                            <!-- Tour de cou & Badge IAO -->
                            <!-- Ruban Lanyard -->
                            <path d="M170 218 Q162 268 184 290 L188 290 Q170 268 176 218 Z" fill="url(#lanyardGrad)"/>
                            <path d="M230 218 Q238 268 216 290 L212 290 Q230 268 224 218 Z" fill="url(#lanyardGrad)"/>
                            <!-- Anneau métal du badge -->
                            <circle cx="200" cy="294" r="4" fill="url(#metalChrome)"/>
                            <!-- Badge hospitalier carte rigide -->
                            <g transform="translate(182, 298)">
                                <rect x="0" y="0" width="36" height="26" rx="4" fill="#FFFFFF" filter="url(#softShadow)"/>
                                <rect x="0" y="0" width="36" height="7" rx="3" fill="#0891B2"/>
                                <text x="18" y="5.5" font-size="4.2" font-family="Arial, sans-serif" font-weight="bold" fill="#FFFFFF" text-anchor="middle">IAO • URGENCES</text>
                                <!-- Photo d'identité miniature -->
                                <rect x="3" y="10" width="10" height="12" rx="2" fill="#E2E8F0"/>
                                <circle cx="8" cy="14" r="2.5" fill="#0891B2"/>
                                <path d="M4 21 Q8 17 12 21" fill="#0891B2"/>
                                <!-- Lignes de texte badge -->
                                <rect x="16" y="11" width="16" height="2.5" rx="1" fill="#1E293B"/>
                                <rect x="16" y="15" width="12" height="2" rx="1" fill="#64748B"/>
                                <rect x="16" y="19" width="14" height="1.5" rx="0.7" fill="#00F2FE"/>
                            </g>

                            <!-- === 3. COU, VISAGE ET CHEVELURE === -->
                            <!-- Cou -->
                            <path d="M182 188 L218 188 L220 228 L180 228 Z" fill="url(#nurseSkin)"/>
                            <!-- Ombre sous menton -->
                            <path d="M180 206 Q200 226 220 206 L218 214 Q200 230 182 214 Z" fill="url(#nurseSkinShade)" opacity="0.7"/>

                            <!-- Oreilles -->
                            <path d="M144 156 Q140 148 144 140 Q148 134 154 138 L154 164 Q146 166 144 156 Z" fill="url(#nurseSkin)"/>
                            <path d="M148 144 Q144 148 147 154" stroke="url(#nurseSkinShade)" stroke-width="2" fill="none"/>
                            
                            <path d="M256 156 Q260 148 256 140 Q252 134 246 138 L246 164 Q254 166 256 156 Z" fill="url(#nurseSkin)"/>
                            <path d="M252 144 Q256 148 253 154" stroke="url(#nurseSkinShade)" stroke-width="2" fill="none"/>

                            <!-- Visage (Tête bien proportionnée et amicale) -->
                            <path d="M152 136 Q150 82 200 82 Q250 82 248 136 Q248 194 200 206 Q152 194 152 136 Z" fill="url(#nurseSkin)"/>

                            <!-- Pommettes & Blush chaleureux -->
                            <ellipse cx="166" cy="162" rx="10" ry="6" fill="#F43F5E" opacity="0.18"/>
                            <ellipse cx="234" cy="162" rx="10" ry="6" fill="#F43F5E" opacity="0.18"/>

                            <!-- Cheveux modernes (Coupe stylée avec reflets) -->
                            <path d="M146 130 Q144 68 200 64 Q256 68 254 130 Q252 94 200 92 Q148 94 146 130 Z" fill="url(#nurseHair)"/>
                            <!-- Mèche latérale dynamique -->
                            <path d="M148 118 Q162 82 200 86 Q170 94 154 134 Q148 132 148 118 Z" fill="url(#nurseHairSheen)"/>
                            <!-- Frange élégante douce -->
                            <path d="M160 88 Q195 86 230 102 Q205 92 175 92 Z" fill="#475569" opacity="0.6"/>

                            <!-- Sourcils expressifs et bienveillants -->
                            <path d="M168 132 Q180 126 190 131" stroke="#1E293B" stroke-width="3" stroke-linecap="round" fill="none"/>
                            <path d="M210 131 Q220 126 232 132" stroke="#1E293B" stroke-width="3" stroke-linecap="round" fill="none"/>

                            <!-- Yeux travaillés avec éclat et iris cyan/bleu profond -->
                            <!-- Oeil Gauche -->
                            <g id="nurse-left-eye">
                                <ellipse cx="178" cy="146" rx="8" ry="9" fill="#FFFFFF"/>
                                <circle cx="178" cy="146" r="6" fill="#0891B2"/>
                                <circle cx="178" cy="146" r="3.8" fill="#0F172A"/>
                                <circle cx="176" cy="143" r="2" fill="#FFFFFF"/>
                                <circle cx="180.5" cy="148" r="1" fill="#FFFFFF"/>
                                <path d="M168 143 Q178 137 188 143" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round" fill="none"/>
                                <!-- Paupière pour animation clignement -->
                                <rect class="eye-lid" x="168" y="136" width="20" height="22" fill="url(#nurseSkin)" opacity="0"/>
                            </g>

                            <!-- Oeil Droit -->
                            <g id="nurse-right-eye">
                                <ellipse cx="222" cy="146" rx="8" ry="9" fill="#FFFFFF"/>
                                <circle cx="222" cy="146" r="6" fill="#0891B2"/>
                                <circle cx="222" cy="146" r="3.8" fill="#0F172A"/>
                                <circle cx="220" cy="143" r="2" fill="#FFFFFF"/>
                                <circle cx="224.5" cy="148" r="1" fill="#FFFFFF"/>
                                <path d="M212 143 Q222 137 232 143" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round" fill="none"/>
                                <!-- Paupière pour animation clignement -->
                                <rect class="eye-lid" x="212" y="136" width="20" height="22" fill="url(#nurseSkin)" opacity="0"/>
                            </g>

                            <!-- Nez discret -->
                            <path d="M200 148 L197 160 Q200 163 203 160" stroke="#D09581" stroke-width="2" stroke-linecap="round" fill="none"/>

                            <!-- Bouche : Sourire accueillant et rassurant -->
                            <path d="M186 174 Q200 188 214 174" stroke="#BE123C" stroke-width="2.8" stroke-linecap="round" fill="none"/>
                            <path d="M190 176 Q200 184 210 176" fill="#FFFFFF" opacity="0.8"/> <!-- Éclat dents léger -->

                            <!-- === 4. STÉTHOSCOPE PROFESSIONNEL LITTMANN === -->
                            <!-- Tubes auriculaires -->
                            <path d="M156 168 Q158 205 180 236" stroke="#1E293B" stroke-width="6" stroke-linecap="round" fill="none"/>
                            <path d="M244 168 Q242 205 220 236" stroke="#1E293B" stroke-width="6" stroke-linecap="round" fill="none"/>
                            <!-- Tubulure principale en Y -->
                            <path d="M162 230 Q152 285 200 310 Q248 285 238 230" stroke="#0F172A" stroke-width="7" stroke-linecap="round" fill="none"/>
                            <path d="M200 310 L200 345" stroke="#0F172A" stroke-width="7" stroke-linecap="round"/>
                            
                            <!-- Pavillon / Cloche métallique -->
                            <circle cx="200" cy="350" r="14" fill="url(#metalChrome)" stroke="#1E293B" stroke-width="2.5"/>
                            <circle cx="200" cy="350" r="8" fill="#0F172A"/>
                            <circle cx="200" cy="350" r="4.5" fill="#00F2FE" filter="url(#nurseGlow)"/>
                            <!-- Point pulsation stéthoscope -->
                            <circle class="pulse-dot" cx="200" cy="350" r="8" fill="#00F2FE" opacity="0.4"/>

                            <!-- === 5. BRAS ET TABLETTE CLINIQUE IAO === -->
                            <!-- Bras Gauche (Au repos le long du corps) -->
                            <path d="M112 242 Q90 292 94 348" stroke="url(#scrubsSleeves)" stroke-width="24" stroke-linecap="round" fill="none"/>
                            <circle cx="94" cy="356" r="11" fill="url(#nurseSkin)"/> <!-- Main gauche -->

                            <!-- Bras Droit (Tenant fièrement la tablette médicale) -->
                            <path d="M288 242 Q314 274 278 322" stroke="url(#scrubsSleeves)" stroke-width="24" stroke-linecap="round" fill="none"/>
                            
                            <!-- TABLETTE HOLOGRAPHIQUE MÉDICALE -->
                            <g transform="translate(244, 285) rotate(-14)">
                                <!-- Châssis métallique fin -->
                                <rect x="0" y="0" width="76" height="96" rx="8" fill="url(#tabletGlass)" stroke="url(#metalChrome)" stroke-width="2" filter="url(#softShadow)"/>
                                <!-- Contour lumineux cyan de la tablette -->
                                <rect x="2" y="2" width="72" height="92" rx="6" fill="none" stroke="#00F2FE" stroke-width="1.2" opacity="0.6"/>
                                <!-- Écran d'affichage clinique -->
                                <rect x="5" y="6" width="66" height="84" rx="4" fill="#040914"/>

                                <!-- Barre d'état haute -->
                                <rect x="9" y="11" width="22" height="4" rx="2" fill="#00F2FE" opacity="0.8"/>
                                <circle cx="63" cy="13" r="2.5" fill="#10B981"/> <!-- Voyant vert connecté -->

                                <!-- Tracé ECG dynamique miniature en vert/cyan -->
                                <path d="M9 30 L22 30 L25 22 L28 38 L32 18 L36 34 L39 30 L67 30" stroke="#00F2FE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" filter="url(#nurseGlow)"/>

                                <!-- Cartouches Constantes Vitaux -->
                                <g transform="translate(9, 44)">
                                    <rect x="0" y="0" width="26" height="15" rx="3" fill="rgba(0, 242, 254, 0.12)" stroke="rgba(0, 242, 254, 0.3)" stroke-width="1"/>
                                    <text x="13" y="7" font-size="4.5" font-family="monospace" fill="#00F2FE" text-anchor="middle">FC 74</text>
                                    <text x="13" y="12.5" font-size="3.5" font-family="sans-serif" fill="#94A3B8" text-anchor="middle">BPM</text>
                                </g>

                                <g transform="translate(39, 44)">
                                    <rect x="0" y="0" width="28" height="15" rx="3" fill="rgba(168, 85, 247, 0.12)" stroke="rgba(168, 85, 247, 0.3)" stroke-width="1"/>
                                    <text x="14" y="7" font-size="4.5" font-family="monospace" fill="#C084FC" text-anchor="middle">SpO2 99%</text>
                                    <text x="14" y="12.5" font-size="3.5" font-family="sans-serif" fill="#94A3B8" text-anchor="middle">AIR</text>
                                </g>

                                <!-- Ligne statut dossier -->
                                <rect x="9" y="65" width="58" height="6" rx="3" fill="rgba(16, 185, 129, 0.15)" stroke="rgba(16, 185, 129, 0.4)" stroke-width="1"/>
                                <text x="38" y="69.5" font-size="3.8" font-family="sans-serif" font-weight="bold" fill="#34D399" text-anchor="middle">✔ DOSSIER IAO PRÊT</text>

                                <!-- Lignes d'anamnèse stylisées -->
                                <line x1="9" y1="77" x2="48" y2="77" stroke="#64748B" stroke-width="1.8" stroke-linecap="round"/>
                                <line x1="9" y1="82" x2="38" y2="82" stroke="#475569" stroke-width="1.8" stroke-linecap="round"/>
                            </g>

                            <!-- Main droite tenant la tablette (par-dessus le bord) -->
                            <g transform="translate(264, 320)">
                                <!-- Doigts repliés sur le bord du terminal -->
                                <rect x="0" y="0" width="16" height="7" rx="3.5" fill="url(#nurseSkin)"/>
                                <rect x="-2" y="8" width="17" height="7" rx="3.5" fill="url(#nurseSkin)"/>
                                <rect x="-4" y="16" width="17" height="7" rx="3.5" fill="url(#nurseSkin)"/>
                                <!-- Pouce maintenant la tablette -->
                                <path d="M12 -4 Q6 4 14 12" stroke="url(#nurseSkin)" stroke-width="7" stroke-linecap="round" fill="none"/>
                            </g>
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

        // Sans motif (mode ECOS) → phrases neutres : le motif doit venir du patient
        const useNeutral = !motif;
        const phrasePool = useNeutral ? NURSE_PHRASES_NEUTRAL : NURSE_PHRASES;
        const esc = (typeof escapeHtml === 'function') ? escapeHtml : (s) => s;

        const randomPhrase = phrasePool[Math.floor(Math.random() * phrasePool.length)];
        const text = randomPhrase
            .replace('{patient}', `<span class="patient-name">${esc(patient.prenom)} ${esc(patient.nom)}</span>`)
            .replace('{age}', esc(patient.age))
            .replace('{pronoun}', pronoun)
            .replace('{admission}', admission)
            .replace('{motif}', `<span class="motif">${esc(motif)}</span>`);

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
