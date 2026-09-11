/**
 * ========================================================================
 * MEDGAME - NURSE NPC MODULE (IAO & EMERGENCY REGULATION)
 * Vector SVG Avatar, Emotion Morphing, Speech Engine & Glassmorphism HUD
 * ========================================================================
 */
const NurseIntro = (() => {
    let overlayEl = null;
    let containerEl = null;
    let npcWrapperEl = null;
    let bubbleTextEl = null;
    let progressBarEl = null;
    let statusLedEl = null;
    let channelTitleEl = null;
    let hudChannelTextEl = null;
    let _keyListenerAttached = false;

    let onDismissCallback = null;
    let autoDismissTimer = null;
    let speechAnimationTimer = null;
    const AUTO_DISMISS_DURATION = 6500; // 6.5 secondes par défaut

    // Configuration par défaut de l'avatar
    let currentConfig = {
        gender: 'female',      // 'female' | 'male'
        skinTone: 'fair',      // 'fair' | 'medium' | 'dark' | 'deep'
        hairStyle: 'bun',      // 'bun' | 'short' | 'ponytail'
        hairColor: 'brunette', // 'brunette' | 'black' | 'blonde' | 'auburn'
        name: 'Sarah - IAO',
        mood: 'reassuring'     // 'neutral' | 'urgent' | 'reassuring' | 'thinking'
    };

    // Palettes de couleurs médicales harmonieuses
    const PALETTES = {
        skin: {
            fair:   { base: '#FFE7DD', shade: '#E2A999', cheek: '#F43F5E' },
            medium: { base: '#E0A37E', shade: '#BD7B55', cheek: '#E11D48' },
            dark:   { base: '#A26543', shade: '#7A4325', cheek: '#9F1239' },
            deep:   { base: '#5C3826', shade: '#3D2012', cheek: '#881337' }
        },
        hair: {
            brunette: { main: '#2D1F17', light: '#4A3427', shadow: '#18100B' },
            black:    { main: '#1E293B', light: '#334155', shadow: '#0F172A' },
            blonde:   { main: '#D4A359', light: '#F0C987', shadow: '#966E2E' },
            auburn:   { main: '#7C2D12', light: '#9A3412', shadow: '#431407' }
        }
    };

    const NURSE_PHRASES = [
        `Bonjour Docteur ! Je vous présente {patient}, {age} ans. {pronoun} a été {admission} pour : {motif}.`,
        `Docteur, votre nouveau patient : {patient}, {age} ans, {admission} pour {motif}.`,
        `Bonjour ! {patient}, {age} ans, vient d'arriver au déchoc'. Motif : {motif}.`,
        `Docteur, on a besoin de vous ! {patient}, {age} ans, {admission} pour {motif}.`,
        `Vite Docteur ! {patient}, {age} ans, se présente pour {motif}. Constantes sur la tablette.`,
        `Ah Docteur, vous tombez bien ! Voici {patient}, {age} ans. {pronoun} consulte pour {motif}.`,
        `Nouveau cas aux urgences : {patient}, {age} ans. Motif d'admission : {motif}.`,
        `Docteur, je vous confie {patient}, {age} ans. {pronoun} se plaint de {motif}.`
    ];

    const NURSE_PHRASES_NEUTRAL = [
        `Bonjour Docteur ! Je vous présente {patient}, {age} ans. {pronoun} vient d'être {admission}.`,
        `Docteur, votre nouveau patient : {patient}, {age} ans, tout juste {admission}.`,
        `Bonjour ! {patient}, {age} ans, vient d'arriver dans le service. Dossier ouvert.`,
        `Docteur, on a besoin de vous ! {patient}, {age} ans, vous attend dans le box.`,
        `Ah Docteur, bon timing ! Voici {patient}, {age} ans. À vous d'évaluer la situation.`,
        `Dossier ECOS prêt : {patient}, {age} ans. Bon courage Docteur !`
    ];

    /**
     * Synthétiseur de bip radio/intercom d'urgence (Web Audio API - zéro fichier externe)
     */
    function _playHospitalBeep(isUrgent = false) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();

            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            if (isUrgent) {
                // Tonalité double d'urgence médicale
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.setValueAtTime(1174, now + 0.08);
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
                osc.start(now);
                osc.stop(now + 0.3);
            } else {
                // Chime subtil d'interphone d'accueil
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, now); // D5
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
                gain.gain.setValueAtTime(0.04, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                osc.start(now);
                osc.stop(now + 0.36);
            }

            // Haptique mobile si disponible
            if (navigator.vibrate) {
                navigator.vibrate(isUrgent ? [40, 60, 40] : 25);
            }
        } catch (e) {
            // Audio context bloqué ou non supporté : ignorer silencieusement
        }
    }

    /**
     * Générateur Vectoriel SVG de Haute Qualité
     * Paramétrable, expressif et optimisé
     */
    function _getNurseSVG(config) {
        const skin = PALETTES.skin[config.skinTone] || PALETTES.skin.fair;
        const hair = PALETTES.hair[config.hairColor] || PALETTES.hair.brunette;
        const isMale = config.gender === 'male';

        return `
        <svg viewBox="0 0 400 480" class="nurse-character-svg" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <!-- Gradients de peau -->
                <linearGradient id="skinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="${skin.base}"/>
                    <stop offset="60%" stop-color="${skin.base}"/>
                    <stop offset="100%" stop-color="${skin.shade}"/>
                </linearGradient>
                <linearGradient id="skinShadow" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="${skin.shade}"/>
                    <stop offset="100%" stop-color="#1e1b18" stop-opacity="0.25"/>
                </linearGradient>

                <!-- Scrubs Haute Définition Tech-Teal -->
                <linearGradient id="scrubBody" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#06B6D4"/>
                    <stop offset="40%" stop-color="#0891B2"/>
                    <stop offset="100%" stop-color="#0E7490"/>
                </linearGradient>
                <linearGradient id="scrubCollar" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#0E7490"/>
                    <stop offset="100%" stop-color="#155E75"/>
                </linearGradient>

                <!-- Chevelure -->
                <linearGradient id="hairGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="${hair.light}"/>
                    <stop offset="50%" stop-color="${hair.main}"/>
                    <stop offset="100%" stop-color="${hair.shadow}"/>
                </linearGradient>

                <!-- Chrome / Métal Stéthoscope -->
                <linearGradient id="metalStetho" x1="0%" y1="0%" x2="100%" y2="50%">
                    <stop offset="0%" stop-color="#F8FAFC"/>
                    <stop offset="35%" stop-color="#CBD5E1"/>
                    <stop offset="70%" stop-color="#64748B"/>
                    <stop offset="100%" stop-color="#334155"/>
                </linearGradient>

                <!-- Filtre d'éclat néon -->
                <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur"/>
                    <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>

            <!-- ==================== 1. TORSE ET TENUE ==================== -->
            <g class="nurse-torso">
                <!-- Blouse Médicale Ergonomique -->
                <path d="M130 220 C110 225 96 242 88 280 L76 345 C73 358 84 366 96 360 L118 348 L122 460 C122 470 278 470 278 460 L282 348 L304 360 C316 366 327 358 324 345 L312 280 C304 242 290 225 270 220 Z" 
                      fill="url(#scrubBody)" />

                <!-- Ombre sous-mammaire et plis latéraux de tissu -->
                <path d="M122 460 L118 348 L100 270 C118 250 134 380 138 460 Z" fill="#000" opacity="0.12"/>
                <path d="M278 460 L282 348 L300 270 C282 250 266 380 262 460 Z" fill="#000" opacity="0.12"/>

                <!-- Sous-col technique respirant -->
                <path d="M178 214 L200 236 L222 214 Z" fill="#F8FAFC" opacity="0.95"/>
                <!-- Encolure en V renforcée -->
                <path d="M168 214 L200 258 L232 214 L218 214 L200 242 L182 214 Z" fill="url(#scrubCollar)"/>

                <!-- Poche de poitrine avec badge et stylo pupillaire -->
                <rect x="238" y="278" width="34" height="42" rx="4" fill="#0E7490" opacity="0.6"/>
                <!-- Lampe stylo de diagnostic -->
                <rect x="244" y="260" width="4.5" height="24" rx="2" fill="url(#metalStetho)"/>
                <circle cx="246.2" cy="260" r="2.5" fill="#38BDF8"/>
                <!-- Stylo 4 couleurs -->
                <rect x="252" y="264" width="4" height="20" rx="1.5" fill="#FFFFFF"/>
                <rect x="252" y="264" width="4" height="4" fill="#EF4444"/>

                <!-- Badge IAO avec clip rétractable -->
                <g id="nurse-badge" transform="translate(178, 276)">
                    <!-- Fil dérouleur -->
                    <line x1="22" y1="-20" x2="22" y2="0" stroke="#0F172A" stroke-width="2"/>
                    <circle cx="22" cy="-1" r="5" fill="#0284C7"/>
                    <!-- Carte badge -->
                    <rect x="0" y="4" width="44" height="32" rx="4" fill="#FFFFFF" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>
                    <rect x="0" y="4" width="44" height="8" rx="2" fill="#0284C7"/>
                    <text x="22" y="10" font-size="4.8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" fill="#FFFFFF" text-anchor="middle">IAO URGENCES</text>
                    <!-- Avatar miniature sur badge -->
                    <rect x="4" y="15" width="10" height="15" rx="1.5" fill="#E2E8F0"/>
                    <circle cx="9" cy="19.5" r="3" fill="#0284C7"/>
                    <path d="M5 29 C5 25 13 25 13 29 Z" fill="#0284C7"/>
                    <!-- Nom et puce RFID -->
                    <text x="17" y="20" font-size="4.2" font-family="sans-serif" font-weight="bold" fill="#0F172A">${config.name.split(' ')[0]}</text>
                    <rect x="17" y="23" width="16" height="2" rx="1" fill="#94A3B8"/>
                    <rect x="17" y="27" width="22" height="4" rx="1.5" fill="#DCFCE7"/>
                    <text x="28" y="30" font-size="3" font-family="sans-serif" font-weight="bold" fill="#15803D" text-anchor="middle">TRIAGE ACTIF</text>
                </g>

                <!-- Micro-cravate / Radio d'urgence sur épaule gauche -->
                <g id="radio-mic" transform="translate(122, 230)">
                    <rect x="0" y="0" width="12" height="18" rx="3" fill="#0F172A"/>
                    <circle cx="6" cy="6" r="2.5" fill="#334155"/>
                    <circle cx="6" cy="13" r="1.5" class="radio-led" fill="#00F2FE"/>
                    <!-- Câble torsadé radio -->
                    <path d="M6 18 Q 4 28 8 36 Q 4 44 8 52" stroke="#0F172A" stroke-width="2.5" fill="none" stroke-linecap="round"/>
                </g>

                <!-- ==================== 2. STÉTHOSCOPE PROFESSIONNEL ==================== -->
                <g id="stethoscope">
                    <!-- Branches auriculaires -->
                    <path d="M166 182 C168 214 178 244 190 262" stroke="#1E293B" stroke-width="5" stroke-linecap="round" fill="none"/>
                    <path d="M234 182 C232 214 222 244 210 262" stroke="#1E293B" stroke-width="5" stroke-linecap="round" fill="none"/>
                    <!-- Tubulure souple double -->
                    <path d="M190 260 C170 310 162 350 196 354" stroke="#0B1329" stroke-width="6.5" stroke-linecap="round" fill="none"/>
                    <path d="M210 260 C230 310 226 350 204 354" stroke="#0B1329" stroke-width="6.5" stroke-linecap="round" fill="none"/>
                    <!-- Pavillon lourd en acier brossé -->
                    <circle cx="200" cy="354" r="14" fill="url(#metalStetho)"/>
                    <circle cx="200" cy="354" r="10" fill="#0F172A"/>
                    <circle cx="200" cy="354" r="5" fill="#00F2FE" filter="url(#neonGlow)"/>
                    <circle cx="200" cy="354" r="9" class="stetho-pulse" fill="none" stroke="#00F2FE" stroke-width="2"/>
                </g>

                <!-- ==================== 3. BRAS & TABLETTE CLINIQUE IAO ==================== -->
                <!-- Bras gauche relâché -->
                <path d="M110 236 Q 90 286 94 360" stroke="#0891B2" stroke-width="22" stroke-linecap="round" fill="none"/>
                <circle cx="95" cy="365" r="10" fill="url(#skinGrad)"/>

                <!-- Bras droit tenant la tablette -->
                <path d="M290 236 Q 312 280 274 340" stroke="#0891B2" stroke-width="22" stroke-linecap="round" fill="none"/>
                
                <!-- Tablette Tactile IAO / Dossier Patient -->
                <g transform="translate(242, 290) rotate(-10)">
                    <rect x="0" y="0" width="84" height="106" rx="8" fill="#050B14" stroke="url(#metalStetho)" stroke-width="2.5" filter="drop-shadow(0 10px 20px rgba(0,0,0,0.6))"/>
                    <!-- Cadre d'écran glowing -->
                    <rect x="3" y="3" width="78" height="100" rx="6" fill="#060F1E"/>
                    <!-- Header tablette -->
                    <rect x="7" y="8" width="30" height="4" rx="2" fill="#00F2FE"/>
                    <circle cx="72" cy="10" r="2.5" fill="#10B981"/>
                    
                    <!-- Ligne ECG Dynamique -->
                    <path class="tablet-ecg-path" d="M7 32 L22 32 L25 24 L28 42 L32 18 L35 36 L39 32 L75 32" stroke="#00F2FE" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                    
                    <!-- Widgets Données Vitales -->
                    <rect x="7" y="46" width="32" height="18" rx="3" fill="rgba(0,242,254,0.12)" stroke="rgba(0,242,254,0.3)" stroke-width="0.8"/>
                    <text x="23" y="55" font-size="5" font-family="monospace" font-weight="bold" fill="#00F2FE" text-anchor="middle">FC 78</text>
                    <text x="23" y="61" font-size="3.5" font-family="sans-serif" fill="#94A3B8" text-anchor="middle">BPM</text>

                    <rect x="43" y="46" width="32" height="18" rx="3" fill="rgba(168,85,247,0.12)" stroke="rgba(168,85,247,0.3)" stroke-width="0.8"/>
                    <text x="59" y="55" font-size="5" font-family="monospace" font-weight="bold" fill="#C084FC" text-anchor="middle">SpO2 99</text>
                    <text x="59" y="61" font-size="3.5" font-family="sans-serif" fill="#94A3B8" text-anchor="middle">% AA</text>

                    <!-- Statut du triage -->
                    <rect x="7" y="70" width="68" height="9" rx="3" fill="rgba(16,185,129,0.15)" stroke="rgba(16,185,129,0.4)" stroke-width="1"/>
                    <text x="41" y="76.5" font-size="4.2" font-family="sans-serif" font-weight="bold" fill="#34D399" text-anchor="middle">TRIAGE NIVEAU 2</text>
                </g>

                <!-- Doigts de la main droite rabattus sur l'écran -->
                <g transform="translate(258, 335)">
                    <rect x="0" y="0" width="16" height="7.5" rx="3.7" fill="url(#skinGrad)" stroke="url(#skinShadow)" stroke-width="0.5"/>
                    <rect x="-3" y="8" width="18" height="7.5" rx="3.7" fill="url(#skinGrad)" stroke="url(#skinShadow)" stroke-width="0.5"/>
                    <rect x="-6" y="16" width="18" height="7.5" rx="3.7" fill="url(#skinGrad)" stroke="url(#skinShadow)" stroke-width="0.5"/>
                    <path d="M14 -6 Q6 2 12 10" stroke="url(#skinGrad)" stroke-width="7" stroke-linecap="round" fill="none"/>
                </g>
            </g>

            <!-- ==================== 4. TÊTE & MICRO-EXPRESSIONS ==================== -->
            <g class="nurse-head-group">
                <!-- Cou -->
                <path d="M182 178 L218 178 L222 222 L178 222 Z" fill="url(#skinGrad)"/>
                <path d="M178 196 C194 216 206 216 222 196 L220 208 C204 224 196 224 180 208 Z" fill="url(#skinShadow)"/>

                <!-- Oreilles -->
                <path d="M145 146 C140 138 144 128 152 132 L152 156 C144 158 142 152 145 146 Z" fill="url(#skinGrad)"/>
                <path d="M255 146 C260 138 256 128 248 132 L248 156 C256 158 258 152 255 146 Z" fill="url(#skinGrad)"/>

                <!-- Ovale du Visage -->
                ${isMale 
                    ? `<path d="M150 126 C148 74 252 74 250 126 C250 178 234 198 200 204 C166 198 150 178 150 126 Z" fill="url(#skinGrad)"/>`
                    : `<path d="M152 128 C150 78 250 78 248 128 C248 184 230 202 200 205 C170 202 152 184 152 128 Z" fill="url(#skinGrad)"/>`
                }

                <!-- Pommettes & Joues (Blush de bienveillance) -->
                <ellipse cx="166" cy="158" rx="9" ry="5.5" fill="${skin.cheek}" opacity="0.22"/>
                <ellipse cx="234" cy="158" rx="9" ry="5.5" fill="${skin.cheek}" opacity="0.22"/>

                <!-- Nez Médical Élégant -->
                <path d="M200 144 L197 157 C198 160 202 160 204 157" stroke="${skin.shade}" stroke-width="2.2" stroke-linecap="round" fill="none"/>

                <!-- YEUX & CLIGNEMENT NATUREL -->
                <g id="eyes-layer">
                    <!-- Oeil Gauche -->
                    <g id="eye-left" transform="translate(176, 142)">
                        <!-- Globe oculaire -->
                        <ellipse cx="0" cy="0" rx="9" ry="8.5" fill="#FFFFFF"/>
                        <!-- Iris Cyan / Bleu Regard Médical -->
                        <circle cx="0.5" cy="0" r="5.2" fill="#0284C7"/>
                        <circle cx="0.5" cy="0" r="3.2" fill="#0B1329"/>
                        <!-- Reflets lumineux -->
                        <circle cx="-1" cy="-2" r="1.6" fill="#FFFFFF"/>
                        <circle cx="2" cy="1.5" r="0.8" fill="#FFFFFF"/>
                        <!-- Contour supérieur cils -->
                        <path d="M-9 -2 Q 0 -9 9 -2" stroke="#0B1329" stroke-width="2.2" stroke-linecap="round" fill="none"/>
                        <!-- Paupière animée (clignement) -->
                        <path class="eye-eyelid" d="M-9.5 -3 Q 0 -9 9.5 -3 L9.5 8.5 L-9.5 8.5 Z" fill="${skin.base}"/>
                    </g>

                    <!-- Oeil Droit -->
                    <g id="eye-right" transform="translate(224, 142)">
                        <ellipse cx="0" cy="0" rx="9" ry="8.5" fill="#FFFFFF"/>
                        <circle cx="-0.5" cy="0" r="5.2" fill="#0284C7"/>
                        <circle cx="-0.5" cy="0" r="3.2" fill="#0B1329"/>
                        <circle cx="-2" cy="-2" r="1.6" fill="#FFFFFF"/>
                        <circle cx="1" cy="1.5" r="0.8" fill="#FFFFFF"/>
                        <path d="M-9 -2 Q 0 -9 9 -2" stroke="#0B1329" stroke-width="2.2" stroke-linecap="round" fill="none"/>
                        <path class="eye-eyelid" d="M-9.5 -3 Q 0 -9 9.5 -3 L9.5 8.5 L-9.5 8.5 Z" fill="${skin.base}"/>
                    </g>
                </g>

                <!-- SOURCILS ÉMOTIONNELS (Morphing via classes CSS) -->
                <g id="eyebrows-layer">
                    <path class="brow-left" d="M166 128 Q 177 121 187 127" stroke="${hair.main}" stroke-width="3" stroke-linecap="round" fill="none"/>
                    <path class="brow-right" d="M213 127 Q 223 121 234 128" stroke="${hair.main}" stroke-width="3" stroke-linecap="round" fill="none"/>
                </g>

                <!-- BOUCHE ARTICULÉE ET PARLANTE -->
                <g id="mouth-layer">
                    <!-- Bouche au repos : Sourire rassurant -->
                    <g class="mouth-rest">
                        <path d="M187 175 Q 200 188 213 175" stroke="#9F1239" stroke-width="2.6" stroke-linecap="round" fill="none"/>
                        <path d="M191 176 Q 200 183 209 176" fill="#FFFFFF" opacity="0.9"/>
                    </g>
                    <!-- Bouche animée en élocution fluide -->
                    <g class="mouth-talking">
                        <path d="M188 173 Q 200 166 212 173 Q 215 186 200 186 Q 185 186 188 173 Z" fill="#7F1D1D"/>
                        <!-- Rangée de dents -->
                        <path d="M190 174 Q 200 178 210 174" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round"/>
                        <!-- Langue -->
                        <path d="M194 184 Q 200 180 206 184" fill="#F43F5E"/>
                    </g>
                </g>

                <!-- CHEVELURE MODERNE & PROFESSIONNELLE -->
                ${isMale ? `
                    <!-- Coupe Courte Homme Soignée avec Dégradé -->
                    <path d="M148 124 C146 64 254 64 252 124 C245 92 232 80 200 78 C168 80 155 92 148 124 Z" fill="url(#hairGrad)"/>
                    <path d="M148 116 C155 90 185 82 200 82 C220 82 245 88 252 110 C242 90 220 84 200 84 C175 84 156 94 148 116 Z" fill="${hair.light}"/>
                ` : `
                    <!-- Coiffure Chignon Soignant Ergonomique -->
                    <circle cx="200" cy="58" r="28" fill="url(#hairGrad)"/>
                    <ellipse cx="200" cy="56" rx="16" ry="6" fill="#0891B2"/> <!-- Élastique Scrub Teal -->
                    <!-- Masse capillaire avec mèches -->
                    <path d="M146 128 C144 64 256 64 254 128 C250 86 230 78 200 76 C170 78 150 86 146 128 Z" fill="url(#hairGrad)"/>
                    <!-- Mèche latérale dynamique -->
                    <path d="M148 114 Q 166 78 206 82 Q 170 90 156 126 Z" fill="${hair.light}" opacity="0.8"/>
                `}
            </g>
        </svg>
        `;
    }

    /**
     * Liaison et cache des éléments DOM
     */
    function _bindElements() {
        overlayEl = document.getElementById('nurse-overlay');
        containerEl = overlayEl ? overlayEl.querySelector('.nurse-container') : null;
        npcWrapperEl = overlayEl ? overlayEl.querySelector('.npc-wrapper') : null;
        bubbleTextEl = document.getElementById('nurse-bubble-text');
        progressBarEl = document.getElementById('nurse-progress-bar');
        hudChannelTextEl = overlayEl ? overlayEl.querySelector('.hud-channel-text') : null;
    }

    /**
     * Animation synchronisée de prise de parole (visèmes et ondes HUD)
     */
    function _startSpeakingAnimation(durationMs = 4000) {
        if (!npcWrapperEl) return;
        
        if (speechAnimationTimer) {
            clearTimeout(speechAnimationTimer);
        }

        npcWrapperEl.classList.add('is-speaking');

        speechAnimationTimer = setTimeout(() => {
            if (npcWrapperEl) {
                npcWrapperEl.classList.remove('is-speaking');
            }
            speechAnimationTimer = null;
        }, durationMs);
    }

    /**
     * Met à jour le mood et le statut clinique de l'infirmier(e)
     */
    function setMood(mood = 'reassuring') {
        currentConfig.mood = mood;
        if (!containerEl || !overlayEl) return;

        containerEl.classList.remove('mood-neutral', 'mood-urgent', 'mood-reassuring', 'mood-thinking');
        containerEl.classList.add(`mood-${mood}`);

        if (mood === 'urgent') {
            overlayEl.classList.add('is-urgent');
            if (hudChannelTextEl) hudChannelTextEl.textContent = 'IAO • ALERTE DÉCHOCAGE';
        } else {
            overlayEl.classList.remove('is-urgent');
            if (hudChannelTextEl) hudChannelTextEl.textContent = 'CANAL URGENCES INTERNE';
        }
    }

    /**
     * Configure et re-rend l'avatar
     */
    function configure(newConfig = {}) {
        currentConfig = { ...currentConfig, ...newConfig };
        if (npcWrapperEl) {
            npcWrapperEl.innerHTML = _getNurseSVG(currentConfig);
        }
        if (currentConfig.mood) {
            setMood(currentConfig.mood);
        }
    }

    /**
     * Verifie si l'overlay est actuellement visible
     */
    function isVisible() {
        return Boolean(overlayEl && overlayEl.classList.contains('visible'));
    }

    /**
     * Gestionnaire clavier securise (intercepte Echap, Espace, Entree au niveau capture)
     */
    function _handleKeyDown(e) {
        if (!isVisible()) return;

        const isEscape = e.key === 'Escape' || e.key === 'Esc' || e.code === 'Escape';
        const isSpace = e.key === ' ' || e.key === 'Spacebar' || e.code === 'Space';
        const isEnter = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter';

        if (isEscape || isSpace || isEnter) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            hide();
        }
    }

    function _attachKeyHandler() {
        if (!_keyListenerAttached && typeof window !== 'undefined') {
            window.addEventListener('keydown', _handleKeyDown, true);
            _keyListenerAttached = true;
        }
    }

    /**
     * Injection du template HTML dans le DOM
     */
    function init() {
        _attachKeyHandler();

        if (document.getElementById('nurse-overlay')) {
            _bindElements();
            return;
        }

        const html = `
        <div id="nurse-overlay" class="nurse-overlay" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Transmission IAO">
            <div class="nurse-container mood-${currentConfig.mood}">
                <!-- Personnage Vectoriel SVG 60 FPS -->
                <div class="npc-wrapper" id="nurse-npc-wrapper">
                    ${_getNurseSVG(currentConfig)}
                    <div class="nurse-ground-shadow"></div>
                </div>

                <!-- Bulle Communicateur HUD & Transmission -->
                <div class="speech-bubble">
                    <div class="bubble-hud-header">
                        <div class="hud-channel">
                            <span class="hud-status-dot"></span>
                            <span class="hud-channel-text">CANAL URGENCES INTERNE</span>
                        </div>
                        <div class="hud-audio-bars" aria-hidden="true">
                            <span></span><span></span><span></span><span></span>
                        </div>
                    </div>

                    <p id="nurse-bubble-text" class="bubble-text"></p>

                    <!-- Barre de progression dégressive -->
                    <div class="nurse-progress-container">
                        <div id="nurse-progress-bar" class="nurse-progress-bar"></div>
                    </div>
                </div>

                <!-- Pied de page & Raccourcis -->
                <div class="nurse-footer-actions">
                    <span class="nurse-hint">
                        <span class="nurse-skip-key">Échap</span> ou <span class="nurse-skip-key">Espace</span> pour fermer
                    </span>
                    <span class="nurse-hint">
                        Cliquez n'importe où pour continuer
                    </span>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('afterbegin', html);
        _bindElements();

        // Clic sur l'overlay pour fermer
        if (overlayEl) {
            overlayEl.addEventListener('click', () => {
                hide();
            });
        }
    }

    // Initialisation immédiate ou sur DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /**
     * Dictée d'un texte personnalisé avec animation et son
     */
    function speak(text, options = {}) {
        if (!overlayEl) init();

        const duration = options.duration || AUTO_DISMISS_DURATION;
        const mood = options.mood || 'reassuring';
        const isUrgent = options.isUrgent || (mood === 'urgent');

        setMood(mood);
        if (bubbleTextEl) {
            bubbleTextEl.innerHTML = text;
        }

        _playHospitalBeep(isUrgent);
        _startSpeakingAnimation(Math.min(duration - 500, 5000));

        // Animation de la barre de progression
        if (progressBarEl) {
            progressBarEl.style.animation = 'none';
            progressBarEl.offsetHeight; // Force reflow
            progressBarEl.style.animation = `progressShrink ${duration}ms linear forwards`;
        }

        overlayEl.classList.add('visible');
        overlayEl.setAttribute('aria-hidden', 'false');

        if (autoDismissTimer) {
            clearTimeout(autoDismissTimer);
        }

        autoDismissTimer = setTimeout(() => {
            hide();
        }, duration);
    }

    /**
     * Affiche l'overlay de l'infirmière avec les infos du patient (compatibilité existante)
     * @param {Object} patient - { nom, prenom, age, sexe }
     * @param {string} motif - Motif de consultation ou d'admission
     * @param {Function} callback - Appelé à la fermeture
     */
    function show(patient, motif, callback) {
        if (!overlayEl) init();
        onDismissCallback = callback || null;

        if (autoDismissTimer) {
            clearTimeout(autoDismissTimer);
            autoDismissTimer = null;
        }

        const pronoun = (patient && patient.sexe && patient.sexe.toLowerCase().startsWith('f')) ? 'Elle' : 'Il';
        const admission = (patient && patient.sexe && patient.sexe.toLowerCase().startsWith('f')) ? 'admise' : 'admis';

        const useNeutral = !motif;
        const phrasePool = useNeutral ? NURSE_PHRASES_NEUTRAL : NURSE_PHRASES;
        const esc = (typeof escapeHtml === 'function') ? escapeHtml : (s) => (s ? String(s) : '');

        const randomPhrase = phrasePool[Math.floor(Math.random() * phrasePool.length)];
        const text = randomPhrase
            .replace('{patient}', `<span class="patient-name">${esc(patient ? patient.prenom : '')} ${esc(patient ? patient.nom : '')}</span>`)
            .replace('{age}', esc(patient ? patient.age : ''))
            .replace('{pronoun}', pronoun)
            .replace('{admission}', admission)
            .replace('{motif}', `<span class="motif">${esc(motif)}</span>`);

        const isUrgent = motif && /détresse|choc|arrêt|infarctus|coma|urgence|avc|saignement/i.test(motif);
        const mood = isUrgent ? 'urgent' : 'reassuring';
        setMood(mood);

        if (bubbleTextEl) {
            bubbleTextEl.innerHTML = text;
        }

        // Bip sonore d'accueil ou d'urgence
        _playHospitalBeep(isUrgent);

        // Animation labiale phonétique synchronisée
        _startSpeakingAnimation(4200);

        // Réinitialisation de la barre de progression
        if (progressBarEl) {
            progressBarEl.style.animation = 'none';
            progressBarEl.offsetHeight; // Force reflow
            progressBarEl.style.animation = `progressShrink ${AUTO_DISMISS_DURATION}ms linear forwards`;
        }

        // Masquer éléments parasites d'UI pendant l'intro
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) sidebarToggle.style.visibility = 'hidden';

        const mobileTabs = document.querySelector('.mobile-tabs');
        if (mobileTabs) mobileTabs.style.visibility = 'hidden';

        overlayEl.classList.add('visible');
        overlayEl.setAttribute('aria-hidden', 'false');
        overlayEl.setAttribute('tabindex', '-1');
        try { overlayEl.focus(); } catch (e) {}

        // Fermeture automatique
        autoDismissTimer = setTimeout(() => {
            hide();
        }, AUTO_DISMISS_DURATION);
    }

    /**
     * Ferme l'overlay de transmission IAO
     */
    function hide() {
        if (autoDismissTimer) {
            clearTimeout(autoDismissTimer);
            autoDismissTimer = null;
        }

        if (speechAnimationTimer) {
            clearTimeout(speechAnimationTimer);
            speechAnimationTimer = null;
        }

        if (npcWrapperEl) {
            npcWrapperEl.classList.remove('is-speaking');
        }

        if (overlayEl) {
            overlayEl.classList.remove('visible');
            overlayEl.setAttribute('aria-hidden', 'true');
        }

        // Restaurer les éléments d'interface
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) sidebarToggle.style.visibility = 'visible';

        const mobileTabs = document.querySelector('.mobile-tabs');
        if (mobileTabs) mobileTabs.style.visibility = 'visible';

        if (typeof onDismissCallback === 'function') {
            const cb = onDismissCallback;
            onDismissCallback = null;
            cb();
        }
    }

    return {
        init,
        show,
        hide,
        speak,
        setMood,
        configure,
        isVisible
    };
})();
