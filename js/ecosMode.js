/**
 * js/ecosMode.js
 * Orchestrateur du mode ECOS (Examens Cliniques Objectifs Structurés, R2C 2024+).
 *
 * Responsabilités :
 *  1. Afficher la vignette ECOS plein écran avant le cas (style A4 paysage)
 *  2. Démarrer un timer strict de 8 min (1 min de lecture vignette hors chrono)
 *  3. Signaux sonores (gong début, cloche à 1 min, gong fin)
 *  4. Chat libre patient (moteur unifié LLMPatient) pour l'interrogatoire
 *  5. Classificateur sémantique LLM léger pour cocher les items de la grille
 *  6. Phase d'annonce de diagnostic
 *  7. Écran de debrief avec grille + feedback narratif LLM
 *  8. Score ECOS recalculé (70% clinique / 30% communication)
 *
 * Compatibilité : le mode ECOS est activé quand `sessionStorage.immersionMode === 'immersif'`
 *                 ET que le cas est chargé. L'ancien mode immersif "bouton question"
 *                 est court-circuité pour donner la place au chat libre.
 *
 * Dépendances : js/llm-patient.js (ES module), js/audio.js, js/timer.js, js/scoring.js,
 *               js/caseLoader.js, js/gameState.js, js/feedback.js
 */

(function () {
    'use strict';

    const ECOS_CONFIG = {
        // Durées en secondes
        VIGNETTE_READ_DURATION: 60,    // 1 min pour lire la vignette (hors chrono)
        STATION_DURATION: 480,         // 8 min pour la station
        WARNING_AT: 60,                // 1 min restante → cloche d'avertissement
        // Impatience patient : après N secondes sans question, le PS relance
        PATIENT_IMPATIENCE_AFTER: 60,  // 60 s sans question → relance du patient
        // Bornes du classificateur sémantique
        CLASSIFY_TIMEOUT_MS: 8000,
        // Indicateurs d'attente affichés
        LOADING_FRAMES: ['⏳', '⌛', '⏳', '⌛']
    };

    const ecosState = {
        active: false,
        caseData: null,
        vignette: null,                // objet vignette du cas
        grilleAptitudes: [],           // [{ id, label, weight, triggerKeywords? }]
        grilleComm: [],                // [{ id, label, max }]
        patientStandardise: null,      // objet PS du cas
        phase: 'idle',                 // 'idle' | 'vignette' | 'reading' | 'station' | 'announce' | 'debrief' | 'done'
        startedAt: 0,
        stationEndAt: 0,
        gridChecked: new Set(),        // ids des items cochés (aptitudes)
        commScores: {},                // { id: 0|0.25|0.5|0.75|1 }
        questionsAsked: 0,             // compteur d'échanges
        conversationLog: [],           // [{ speaker, text, t }]
        lastUserActivityAt: 0,
        intervalId: null,
        impatienceTriggered: false,
        diagSubmitted: null,           // texte du diagnostic soumis
        announceSubmitted: null,       // texte de l'annonce
        feedbackNarrative: ''          // généré par LLM en fin de station
    };

    // ==================== VIGNETTE ====================

    function buildVignetteFromCase(caseData) {
        const fallback = {
            role: 'Vous êtes interne de garde.',
            contexte: `${caseData.patient?.prenom || ''} ${caseData.patient?.nom || ''}, ${caseData.patient?.age || '?'} ans, ${caseData.patient?.sexe || '?'}, se présente pour ${caseData.interrogatoire?.motifHospitalisation || 'un motif médical'}.`,
            consignesAttendues: [
                'Mener un interrogatoire ciblé',
                'Réaliser un examen clinique pertinent',
                'Proposer une stratégie diagnostique et thérapeutique'
            ],
            consignesInterdites: [],
            typeStation: 'AVEC_PS',
            domainePrincipal: 'Entretien/Interrogatoire',
            domaineSecondaire: 'Stratégie diagnostique',
            lieu: 'Service d\'accueil des urgences',
            materielDisponible: ['Stéthoscope', 'Tensiomètre', 'Ordinateur']
        };
        return caseData.ecos?.vignette || fallback;
    }

    function showVignette(caseData) {
        const vignette = buildVignetteFromCase(caseData);
        ecosState.vignette = vignette;
        ecosState.phase = 'vignette';

        const overlay = document.createElement('div');
        overlay.id = 'ecos-vignette';
        overlay.className = 'ecos-vignette-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Vignette ECOS');

        const stations = {
            'AVEC_PS':     { label: 'Avec Patient Standardisé',   icon: '🧑‍⚕️' },
            'AVEC_PSS':    { label: 'Avec Personnel de Santé',     icon: '👨‍⚕️' },
            'SANS_PS_PSS': { label: 'Sans PS ni PSS (tête-à-tête)', icon: '🤔' }
        };
        const stationInfo = stations[vignette.typeStation] || stations['AVEC_PS'];

        overlay.innerHTML = `
            <div class="ecos-vignette-paper">
                <div class="ecos-vignette-header">
                    <div class="ecos-vignette-station-badge">
                        <span class="ecos-badge-icon">${stationInfo.icon}</span>
                        <span class="ecos-badge-label">STATION ${stationInfo.label}</span>
                    </div>
                    <div class="ecos-vignette-competences">
                        <div class="ecos-competence-pill primary">${escapeHtml(vignette.domainePrincipal || '—')}</div>
                        ${vignette.domaineSecondaire ? `<div class="ecos-competence-pill secondary">${escapeHtml(vignette.domaineSecondaire)}</div>` : ''}
                    </div>
                </div>

                <div class="ecos-vignette-body">
                    <div class="ecos-vignette-section">
                        <div class="ecos-vignette-label">📋 Votre rôle</div>
                        <p>${escapeHtml(vignette.role || 'Vous êtes interne en stage.')}</p>
                    </div>

                    <div class="ecos-vignette-section">
                        <div class="ecos-vignette-label">🏥 Contexte</div>
                        <p>${escapeHtml(vignette.contexte || '')}</p>
                    </div>

                    <div class="ecos-vignette-section ecos-vignette-attendues">
                        <div class="ecos-vignette-label">✅ Vous devez</div>
                        <ul>
                            ${(vignette.consignesAttendues || []).map(c => `<li>${escapeHtml(c)}</li>`).join('')}
                        </ul>
                    </div>

                    ${(vignette.consignesInterdites && vignette.consignesInterdites.length > 0) ? `
                    <div class="ecos-vignette-section ecos-vignette-interdites">
                        <div class="ecos-vignette-label">⛔ Vous ne devez pas</div>
                        <ul>
                            ${vignette.consignesInterdites.map(c => `<li>${escapeHtml(c)}</li>`).join('')}
                        </ul>
                    </div>` : ''}

                    ${vignette.lieu ? `<div class="ecos-vignette-meta">📍 Lieu : ${escapeHtml(vignette.lieu)}</div>` : ''}
                    ${(vignette.materielDisponible && vignette.materielDisponible.length > 0) ?
                        `<div class="ecos-vignette-meta">🧰 Matériel : ${vignette.materielDisponible.map(escapeHtml).join(', ')}</div>` : ''}
                </div>

                <div class="ecos-vignette-footer">
                    <div class="ecos-vignette-readtime">
                        <i class="fas fa-book-open"></i>
                        Temps de lecture suggéré : 1 minute
                    </div>
                    <button id="ecos-start-btn" class="ecos-start-btn">
                        <i class="fas fa-play"></i> Démarrer la station
                        <span class="ecos-start-timer">8:00</span>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Jouer un gong d'introduction (au clic pour respecter l'autoplay policy)
        document.getElementById('ecos-start-btn').addEventListener('click', () => {
            if (window.MedGameAudio) window.MedGameAudio.play('ecosGongStart');
            hideVignette();
            enterStation();
        });

        // Empêcher le scroll arrière-plan
        document.body.classList.add('ecos-locked');
    }

    function hideVignette() {
        const overlay = document.getElementById('ecos-vignette');
        if (overlay) overlay.remove();
        document.body.classList.remove('ecos-locked');
    }

    // ==================== STATION 8 MIN ====================

    function enterStation() {
        const caseData = ecosState.caseData;
        if (!caseData) return;

        ecosState.phase = 'station';
        ecosState.grilleAptitudes = caseData.ecos?.grilleAptitudesCliniques || buildFallbackGrilleAptitudes(caseData);
        ecosState.grilleComm = caseData.ecos?.grilleCommunication || buildFallbackGrilleComm();
        ecosState.patientStandardise = caseData.ecos?.patientStandardise || {
            personnalite: '',
            phraseOuverture: caseData.interrogatoire?.verbatim || `Bonjour docteur, je viens pour ${(caseData.interrogatoire?.motifHospitalisation || '').toLowerCase()}.`,
            infosVolontaires: ['interrogatoire.motifHospitalisation'],
            infosSiDemandees: [],
            infosCachees: [],
            reactions: {}
        };
        ecosState.startedAt = Date.now();
        ecosState.stationEndAt = Date.now() + ECOS_CONFIG.STATION_DURATION * 1000;
        ecosState.lastUserActivityAt = Date.now();

        // Configurer le timer avec 8 min strictes
        if (typeof window.initTimer === 'function') {
            window.initTimer(ECOS_CONFIG.STATION_DURATION, true);
        }

        // Construire le layout ECOS si pas déjà fait
        ensureStationLayout();

        // Ticker interne (1s) pour la cloche d'avertissement + impatience
        if (ecosState.intervalId) clearInterval(ecosState.intervalId);
        ecosState.intervalId = setInterval(() => {
            const left = getTimeLeft();
            if (left <= 0) {
                onStationEnd();
            } else if (left === ECOS_CONFIG.WARNING_AT) {
                if (window.MedGameAudio) window.MedGameAudio.play('ecosBell');
                showInStationToast(`⏰ 1 minute restante`, 'warning');
            }
            // Impatience patient
            const idleFor = (Date.now() - ecosState.lastUserActivityAt) / 1000;
            if (!ecosState.impatienceTriggered && idleFor >= ECOS_CONFIG.PATIENT_IMPATIENCE_AFTER) {
                ecosState.impatienceTriggered = true;
                triggerPatientImpatience();
            }
        }, 1000);

        // Connecter le moteur LLM patient (peut être chargé en différé via ES module)
        ensureLLMPatientLoaded(caseData);

        // Phase d'accueil : le patient parle en premier (LLM évalue si l'étudiant se présente)
        appendConversation('PS', ecosState.patientStandardise.phraseOuverture || 'Bonjour docteur.', 'opening');
    }

    /**
     * Patiente jusqu'à ce que window.LLMPatient soit disponible (max 5s),
     * puis instancie le moteur. Si non disponible au bout du délai, on
     * fonctionne sans LLM (le patient reste silencieux).
     */
    function ensureLLMPatientLoaded(caseData) {
        if (window.LLMPatient) {
            window.llmPatientInstance = new window.LLMPatient(caseData);
            return;
        }
        const start = Date.now();
        const handle = setInterval(() => {
            if (window.LLMPatient) {
                clearInterval(handle);
                window.llmPatientInstance = new window.LLMPatient(caseData);
            } else if (Date.now() - start > 5000) {
                clearInterval(handle);
                console.warn('[ECOS] LLMPatient non chargé après 5s — mode dégradé');
                appendConversation('Système', '⚠️ Moteur LLM patient indisponible. Vérifiez votre connexion réseau.', 'error');
            }
        }, 100);
    }

    function ensureStationLayout() {
        // Réutiliser la structure existante : on cache les sections classiques,
        // on montre la zone ECOS (chat + scène) et un overlay de timer dédié.
        if (document.getElementById('ecos-station-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'ecos-station-overlay';
        overlay.className = 'ecos-station-overlay';
        overlay.innerHTML = `
            <div class="ecos-station-grid">
                <header class="ecos-station-topbar">
                    <div class="ecos-station-chrono" id="ecos-chrono">08:00</div>
                    <div class="ecos-station-actions">
                        <button id="ecos-vignette-btn" class="ecos-icon-btn" title="Voir la vignette"><i class="fas fa-file-alt"></i></button>
                        <button id="ecos-end-btn" class="ecos-icon-btn ecos-end-btn" title="Terminer la station"><i class="fas fa-stop"></i></button>
                    </div>
                </header>

                <section class="ecos-station-patient" id="ecos-patient-zone">
                    <div class="ecos-patient-avatar">
                        <svg viewBox="0 0 100 100" class="avatar-face">
                            <circle cx="50" cy="50" r="45" class="avatar-head"/>
                            <ellipse cx="35" cy="40" rx="8" ry="10" class="avatar-eye"/>
                            <ellipse cx="65" cy="40" rx="8" ry="10" class="avatar-eye"/>
                            <path class="avatar-mouth" d="M 30 65 Q 50 75 70 65"/>
                            <circle cx="50" cy="50" r="45" class="avatar-glow"/>
                        </svg>
                    </div>
                    <div class="ecos-patient-name" id="ecos-patient-name">Patient</div>
                    <div class="ecos-patient-meta" id="ecos-patient-meta">—</div>
                </section>

                <section class="ecos-station-chat" id="ecos-chat-zone">
                    <div class="ecos-chat-log" id="ecos-chat-log" aria-live="polite"></div>
                    <form class="ecos-chat-form" id="ecos-chat-form">
                        <input id="ecos-chat-input" type="text" autocomplete="off" placeholder="Posez votre question au patient…" aria-label="Question au patient" />
                        <button type="submit" aria-label="Envoyer"><i class="fas fa-paper-plane"></i></button>
                    </form>
                    <div class="ecos-exam-input-row" id="ecos-exam-row">
                        <button type="button" id="ecos-exam-toggle" class="ecos-exam-toggle" title="Demander un examen physique">
                            <i class="fas fa-stethoscope"></i> Examen physique
                        </button>
                        <div class="ecos-exam-form" id="ecos-exam-form" style="display:none;">
                            <input id="ecos-exam-input" type="text" autocomplete="off" placeholder="Ex: auscultation cardiaque, palpation abdomen…" aria-label="Demander un examen physique" />
                            <button type="submit" id="ecos-exam-submit" aria-label="Demander"><i class="fas fa-search"></i></button>
                        </div>
                    </div>
                </section>

                <aside class="ecos-station-grille" id="ecos-grille-zone" aria-label="Suivi de votre démarche">
                    <div class="ecos-grille-header">📋 Grille ECOS</div>
                    <div class="ecos-grille-section">
                        <div class="ecos-grille-section-title">Démarche clinique</div>
                        <ul class="ecos-grille-list" id="ecos-grille-apt"></ul>
                    </div>
                    <div class="ecos-grille-section">
                        <div class="ecos-grille-section-title">Communication</div>
                        <ul class="ecos-grille-list" id="ecos-grille-comm"></ul>
                    </div>
                </aside>
            </div>
            <div id="ecos-toast" class="ecos-toast" aria-live="polite"></div>
        `;
        document.body.appendChild(overlay);

        // Cacher le contenu classique
        const app = document.querySelector('.app-container');
        if (app) app.style.display = 'none';

        // Hook du formulaire chat
        document.getElementById('ecos-chat-form').addEventListener('submit', onChatSubmit);

        // Hook du formulaire examen physique
        document.getElementById('ecos-exam-toggle').addEventListener('click', () => {
            const form = document.getElementById('ecos-exam-form');
            const isVisible = form.style.display !== 'none';
            form.style.display = isVisible ? 'none' : 'flex';
            if (!isVisible) document.getElementById('ecos-exam-input').focus();
        });
        document.getElementById('ecos-exam-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('ecos-exam-input');
            const text = (input?.value || '').trim();
            if (!text) return;
            input.value = '';
            onExamRequest(text);
        });

        // Bouton vignette
        document.getElementById('ecos-vignette-btn').addEventListener('click', () => {
            showVignette(ecosState.caseData);
        });

        // Bouton fin
        document.getElementById('ecos-end-btn').addEventListener('click', () => {
            if (confirm('Terminer la station maintenant ?')) onStationEnd();
        });

        // Injecter la grille
        renderGrille();

        // Header patient
        const p = ecosState.caseData.patient || {};
        document.getElementById('ecos-patient-name').textContent = `${p.prenom || ''} ${p.nom || ''}`.trim() || 'Patient';
        document.getElementById('ecos-patient-meta').textContent = `${p.age || '?'} ans · ${p.sexe || '?'}`;
    }

    function destroyStationLayout() {
        const overlay = document.getElementById('ecos-station-overlay');
        if (overlay) overlay.remove();
        const app = document.querySelector('.app-container');
        if (app) app.style.display = '';
    }

    // ==================== CHAT PATIENT ====================

    function appendConversation(speaker, text, kind = 'normal') {
        const log = document.getElementById('ecos-chat-log');
        if (!log) return;
        const row = document.createElement('div');
        row.className = `ecos-msg ${speaker === 'Vous' ? 'from-student' : 'from-patient'} ${kind === 'opening' ? 'opening' : ''}`;
        row.innerHTML = `<div class="ecos-msg-speaker">${escapeHtml(speaker)}</div><div class="ecos-msg-text">${escapeHtml(text)}</div>`;
        log.appendChild(row);
        log.scrollTop = log.scrollHeight;

        ecosState.conversationLog.push({ speaker, text, t: Date.now() - ecosState.startedAt, kind });

        // Logger dans la timeline pour feedback.js
        if (speaker === 'Vous' && window.feedbackTimeline) {
            window.feedbackTimeline.log('interrogatoire', text);
        } else if (speaker === 'PS' && window.feedbackTimeline) {
            window.feedbackTimeline.log('examen', `Patient: ${text.substring(0, 60)}...`);
        }
    }

    async function onChatSubmit(e) {
        e.preventDefault();
        const input = document.getElementById('ecos-chat-input');
        const text = (input?.value || '').trim();
        if (!text) return;
        input.value = '';
        ecosState.lastUserActivityAt = Date.now();
        ecosState.impatienceTriggered = false;
        ecosState.questionsAsked++;

        appendConversation('Vous', text);
        await handleUserQuestion(text);
    }

    // ==================== EXAMEN PHYSIQUE DEMANDÉ ====================

    /**
     * Gère une demande d'examen physique en texte libre.
     * Le LLM évalue la demande et renvoie le résultat correspondant
     * dans les données du cas. Les items de grille sont cochés automatiquement.
     */
    async function onExamRequest(request) {
        ecosState.lastUserActivityAt = Date.now();
        ecosState.impatienceTriggered = false;

        appendConversation('Vous', `[Examen] ${request}`);

        const caseData = ecosState.caseData;
        if (!caseData?.examenClinique) {
            appendConversation('Système', 'Aucun examen disponible pour ce cas.', 'error');
            return;
        }

        // Construire un résumé des examens disponibles
        const exam = caseData.examenClinique;
        const examSummary = [];
        if (exam.constantes) examSummary.push(`Constantes : FC=${exam.constantes.pouls}, TA=${exam.constantes.tension}, SpO2=${exam.constantes.saturationO2}, T°=${exam.constantes.temperature}`);
        if (exam.aspectGeneral) examSummary.push(`Aspect général : ${exam.aspectGeneral}`);
        for (const [key, val] of Object.entries(exam)) {
            if (['constantes', 'aspectGeneral'].includes(key)) continue;
            const label = key.replace(/^examen/, '').replace(/([A-Z])/g, ' $1').trim();
            if (typeof val === 'string') {
                examSummary.push(`${label} : ${val}`);
            } else if (typeof val === 'object' && val !== null) {
                const sub = Object.entries(val).map(([k, v]) => `${k}=${v}`).join(', ');
                examSummary.push(`${label} : ${sub}`);
            }
        }

        if (!window.CONFIG?.LLM_API_URL) {
            // Fallback sans LLM : afficher tous les examens
            const allFindings = examSummary.join('\n');
            appendConversation('Examen', allFindings);
            markExamItemsChecked(request, exam);
            return;
        }

        // Appel LLM pour évaluer la demande et renvoyer le bon résultat
        const prompt = `Tu es un patient dans un lit d'hôpital. L'étudiant te demande de réaliser un examen physique ou veut voir les résultats d'un examen.

DEMANDE DE L'ÉTUDIANT : "${request}"

RÉSULTATS D'EXAMEN DISPONIBLES :
${examSummary.join('\n')}

Évalue la demande. Si elle correspond à un examen disponible, renvoie UNIQUEMENT le résultat correspondant en langage naturel (comme un médecin qui lit le dossier). Si l'examen n'est pas pertinent ou pas disponible, réponds "Cet examen n'est pas disponible ou n'est pas pertinent pour votre évaluation."

Règles :
- Sois concis (1-2 phrases max)
- Utilise le jargon médical approprié
- Ne donne PAS de diagnostic,只 décrit les constatations objectives`;

        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 10000);
            const resp = await fetch(window.CONFIG.LLM_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: window.CONFIG.LLM_MODEL,
                    messages: [
                        { role: 'system', content: 'Tu es un dossier médical. Tu renvoies les constatations d\'examen demandées.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.2,
                    max_tokens: 300
                }),
                signal: ctrl.signal
            });
            clearTimeout(timer);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const text = data.choices?.[0]?.message?.content || 'Résultat non disponible.';
            appendConversation('Examen', text);
            markExamItemsChecked(request, exam);
        } catch (e) {
            // Fallback : afficher toutes les données d'examen
            const allFindings = examSummary.join('\n') || 'Aucun examen disponible.';
            appendConversation('Examen', allFindings);
            markExamItemsChecked(request, exam);
        }

        // Activer le bouton examen pour pouvoir en demander un autre
        document.getElementById('ecos-exam-toggle').style.display = '';
    }

    /**
     * Coche automatiquement les items de la grille d'aptitudes
     * correspondant à la demande d'examen.
     */
    function markExamItemsChecked(request, exam) {
        const grille = ecosState.grilleAptitudes;
        const reqLower = request.toLowerCase();
        let checkedAny = false;

        // Mapping des mots-clés vers les IDs d'items de grille
        const examKeywordMap = {
            cardiovasculaire: ['examen_cardiovasculaire', 'examen_cardio'],
            cardiaque: ['examen_cardiovasculaire'],
            auscultation: ['examen_cardiovasculaire', 'examen_pulmonaire'],
            coeur: ['examen_cardiovasculaire'],
            pouls: ['examen_cardiovasculaire'],
            pulmonaire: ['examen_pulmonaire'],
            poumon: ['examen_pulmonaire'],
            respiratoire: ['examen_pulmonaire'],
            abdominal: ['examen_abdominal'],
            abdomen: ['examen_abdominal'],
            ventre: ['examen_abdominal'],
            neurologique: ['examen_neurologique'],
            neurologie: ['examen_neurologique'],
            reflexes: ['examen_neurologique'],
            force: ['examen_neurologique'],
            oedemes: ['examen_oedemes'],
            œdèmes: ['examen_oedemes'],
            jambes: ['examen_oedemes'],
            godet: ['examen_oedemes'],
            ORL: ['examen_orl'],
            dermato: ['examen_dermatologique'],
            peau: ['examen_dermatologique'],
            musculo: ['examen_musculosquelettique'],
            articulation: ['examen_musculosquelettique'],
            ophtalmo: ['examen_ophtalmologique'],
            yeux: ['examen_ophtalmologique']
        };

        for (const [keyword, itemIds] of Object.entries(examKeywordMap)) {
            if (reqLower.includes(keyword.toLowerCase())) {
                for (const itemId of itemIds) {
                    if (grille.some(g => g.id === itemId) && !ecosState.gridChecked.has(itemId)) {
                        ecosState.gridChecked.add(itemId);
                        checkedAny = true;
                        if (window.feedbackTimeline) {
                            const item = grille.find(g => g.id === itemId);
                            window.feedbackTimeline.log('examen', `Examen réalisé: ${item?.label || itemId}`);
                        }
                    }
                }
            }
        }

        // Si aucun mot-clé spécifique, on coche les items d'examen les plus généraux
        if (!checkedAny) {
            const genericExamItems = ['examen_cardiovasculaire', 'examen_pulmonaire', 'examen_abdominal', 'examen_neurologique'];
            for (const itemId of genericExamItems) {
                if (grille.some(g => g.id === itemId) && !ecosState.gridChecked.has(itemId) && reqLower.length > 3) {
                    ecosState.gridChecked.add(itemId);
                    checkedAny = true;
                    break; // Un seul item générique par demande
                }
            }
        }

        if (checkedAny) {
            updateGrilleUI();
            if (window.MedGameAudio) window.MedGameAudio.play('correct');
            showInStationToast('✓ Examen enregistré dans la grille', 'success');
        }
    }

    async function handleUserQuestion(question) {
        if (!window.llmPatientInstance) {
            appendConversation('PS', '⚠️ Moteur patient indisponible (LLM hors ligne).', 'error');
            return;
        }

        // Afficher un placeholder
        const placeholder = appendConversation('PS', '…', 'thinking');

        try {
            let fullAnswer = '';
            await new Promise((resolve, reject) => {
                window.llmPatientInstance.ask(
                    question,
                    (token) => {
                        fullAnswer += token;
                        placeholder.querySelector('.ecos-msg-text').textContent = fullAnswer;
                        const log = document.getElementById('ecos-chat-log');
                        if (log) log.scrollTop = log.scrollHeight;
                    },
                    (final) => {
                        placeholder.querySelector('.ecos-msg-text').textContent = final || fullAnswer;
                        resolve();
                    },
                    (err) => reject(new Error(err))
                );
            });
            placeholder.classList.remove('thinking');

            // Classifier la question pour la grille
            await classifyAndCheck(question, fullAnswer || placeholder.querySelector('.ecos-msg-text').textContent);
        } catch (err) {
            placeholder.querySelector('.ecos-msg-text').textContent = '⚠️ Erreur LLM. Réessayez.';
            placeholder.classList.add('error');
            console.warn('[ECOS] LLM ask failed:', err);
        }
    }

    async function triggerPatientImpatience() {
        if (!ecosState.patientStandardise?.reactions?.silence) return;
        const msg = ecosState.patientStandardise.reactions.silence;
        if (window.llmPatientInstance) {
            try {
                // On injecte la réaction comme si le patient parlait spontanément
                appendConversation('PS', msg, 'impulse');
                // On classe la réaction (peut cocher des items comm)
                await classifyAndCheck('(patient parle spontanément)', msg);
            } catch (e) { /* silencieux */ }
        }
    }

    // ==================== CLASSIFICATEUR SÉMANTIQUE ====================

    async function classifyAndCheck(question, answer) {
        if (!window.CONFIG?.LLM_API_URL) return;
        const grille = ecosState.grilleAptitudes;
        if (!grille.length) return;

        const prompt = `Tu es un évaluateur ECOS. On te donne une question posée par l'étudiant-médecin et la réponse du patient. Tu dois déterminer quels items de la grille d'aptitudes cliniques ont été validés par cet échange.

GRILLE D'APTITUDES (chaque item a un id et un label ; coche = l'étudiant a abordé le sujet ou fait le geste) :
${grille.map(g => `- ${g.id} : ${g.label}${g.triggerKeywords ? ' [keywords: ' + g.triggerKeywords.join(', ') + ']' : ''}`).join('\n')}

QUESTION DE L'ÉTUDIANT : ${question}
RÉPONSE DU PATIENT : ${answer}

RENVOIE UNIQUEMENT un JSON strict : { "checked": ["id1", "id2"] } avec UNIQUEMENT les ids qui sont nouvellement validés. Si rien n'est validé, renvoie {"checked": []}.`;

        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), ECOS_CONFIG.CLASSIFY_TIMEOUT_MS);
            const resp = await fetch(window.CONFIG.LLM_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: window.CONFIG.LLM_MODEL,
                    messages: [
                        { role: 'system', content: 'Tu es un évaluateur ECOS. Tu renvoies UNIQUEMENT un JSON strict {checked: [ids]}.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.1,
                    max_tokens: 300
                }),
                signal: ctrl.signal
            });
            clearTimeout(timer);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const text = data.choices?.[0]?.message?.content || '{}';
            const json = extractJsonSafe(text);
            const newly = (json.checked || []).filter(id => !ecosState.gridChecked.has(id));
            newly.forEach(id => {
                if (grille.some(g => g.id === id)) {
                    ecosState.gridChecked.add(id);
                    // Logger l'action dans la timeline
                    if (window.feedbackTimeline) {
                        const item = grille.find(g => g.id === id);
                        window.feedbackTimeline.log('section', `Item validé: ${item?.label || id}`);
                    }
                }
            });
            if (newly.length > 0) {
                updateGrilleUI();
                if (window.MedGameAudio) window.MedGameAudio.play('correct');
            }
        } catch (e) {
            // silencieux — le classificateur est best-effort
        }
    }

    function extractJsonSafe(content) {
        try {
            const first = content.indexOf('{');
            const last = content.lastIndexOf('}');
            if (first === -1 || last === -1) return {};
            return JSON.parse(content.substring(first, last + 1));
        } catch {
            return {};
        }
    }

    // ==================== GRILLE ====================

    function buildFallbackGrilleAptitudes(caseData) {
        // Grille générique d'anamnèse/interrogatoire si la case n'a pas de grille
        const int = caseData.interrogatoire || {};
        const items = [
            { id: 'presentation', label: 'Se présente et explique son rôle', weight: 1, triggerKeywords: ['bonjour', 'présente', 'interne', 'appelle'] },
            { id: 'motif', label: 'Demande le motif de consultation', weight: 1, triggerKeywords: ['motif', 'raison', 'amène', 'pousse'] },
            { id: 'histoire_debut', label: 'Caractérise le début des symptômes', weight: 1, triggerKeywords: ['depuis', 'quand', 'début', 'commencé'] },
            { id: 'histoire_caractere', label: 'Décrit les caractéristiques (type, intensité, siège)', weight: 1, triggerKeywords: ['douleur', 'siège', 'type', 'intensité'] },
            { id: 'facteurs', label: 'Recherche facteurs déclenchants et calmants', weight: 1, triggerKeywords: ['déclenche', 'favorise', 'soulage', 'aggrave'] },
            { id: 'symptomes_associes', label: 'Recherche les signes associés', weight: 1, triggerKeywords: ['autre', 'associé', 'accompagne'] },
            { id: 'antecedents_medicaux', label: 'Interroge sur les antécédents médicaux', weight: 1, triggerKeywords: ['antécédent', 'maladie', 'diabète', 'hta'] },
            { id: 'antecedents_chirurgicaux', label: 'Interroge sur les antécédents chirurgicaux', weight: 1, triggerKeywords: ['opéré', 'chirurgie', 'intervention'] },
            { id: 'antecedents_familiaux', label: 'Recherche les antécédents familiaux', weight: 1, triggerKeywords: ['famille', 'parent', 'père', 'mère'] },
            { id: 'allergies', label: 'Recherche les allergies', weight: 1, triggerKeywords: ['allerg'] },
            { id: 'traitements', label: 'Liste les traitements en cours', weight: 1, triggerKeywords: ['médicament', 'traitement', 'pilule', 'prend'] },
            { id: 'mode_de_vie_tabac', label: 'Questionne le tabagisme', weight: 1, triggerKeywords: ['tabac', 'fume', 'cigarette'] },
            { id: 'mode_de_vie_alcool', label: "Questionne la consommation d'alcool", weight: 1, triggerKeywords: ['alcool', 'boit', 'vin'] },
            { id: 'synthese', label: 'Fait une synthèse structurée de l\'anamnèse', weight: 1, triggerKeywords: ['donc', 'synthèse', 'résume', 'en résumé'] }
        ];
        return items.filter(item => isItemApplicable(item, int, caseData));
    }

    function isItemApplicable(item, int, caseData) {
        // On garde la grille courte : 8-10 items max
        if (int.antecedents?.chirurgicaux?.length === 0 && item.id === 'antecedents_chirurgicaux') return true; // toujours pertinent à demander
        if (int.antecedents?.familiaux?.length === 0 && item.id === 'antecedents_familiaux') return true;
        if (!int.allergies && item.id === 'allergies') return true;
        if (!int.traitements && item.id === 'traitements') return true;
        return true; // par défaut on garde
    }

    function buildFallbackGrilleComm() {
        return [
            { id: 'ecoute_active', label: 'Écoute active (laisse le patient finir)', max: 1 },
            { id: 'questions_ouvertes', label: 'Pose des questions ouvertes', max: 1 },
            { id: 'reformulation', label: 'Reformule/vérifie la compréhension', max: 1 },
            { id: 'vocabulaire_adapte', label: 'Vocabulaire adapté (pas de jargon)', max: 1 },
            { id: 'empathie', label: 'Fait preuve d\'empathie', max: 1 }
        ];
    }

    function renderGrille() {
        const aptList = document.getElementById('ecos-grille-apt');
        const commList = document.getElementById('ecos-grille-comm');
        if (!aptList || !commList) return;
        aptList.innerHTML = ecosState.grilleAptitudes.map(g => `
            <li class="ecos-grille-item ${ecosState.gridChecked.has(g.id) ? 'checked' : ''}" data-id="${g.id}">
                <span class="ecos-check">${ecosState.gridChecked.has(g.id) ? '✓' : '○'}</span>
                <span class="ecos-label">${escapeHtml(g.label)}</span>
            </li>
        `).join('');
        commList.innerHTML = ecosState.grilleComm.map(g => `
            <li class="ecos-grille-item" data-id="${g.id}">
                <span class="ecos-check">○</span>
                <span class="ecos-label">${escapeHtml(g.label)}</span>
            </li>
        `).join('');
    }

    function updateGrilleUI() {
        document.querySelectorAll('#ecos-grille-apt .ecos-grille-item').forEach(li => {
            const id = li.dataset.id;
            if (ecosState.gridChecked.has(id)) {
                li.classList.add('checked');
                li.querySelector('.ecos-check').textContent = '✓';
            }
        });
    }

    // ==================== FIN DE STATION ====================

    function getTimeLeft() {
        if (!ecosState.stationEndAt) return 0;
        return Math.max(0, Math.round((ecosState.stationEndAt - Date.now()) / 1000));
    }

    function onStationEnd() {
        if (ecosState.phase === 'debrief' || ecosState.phase === 'done') return;
        if (ecosState.intervalId) clearInterval(ecosState.intervalId);
        ecosState.phase = 'debrief';

        if (window.MedGameAudio) {
            window.MedGameAudio.play('ecosGongEnd');
        }

        // Stopper le timer
        if (typeof window.pauseTimer === 'function') window.pauseTimer();

        enterAnnouncePhase();
    }

    // ==================== PHASE D'ANNONCE ====================

    function enterAnnouncePhase() {
        const overlay = document.getElementById('ecos-announce-overlay') || (() => {
            const el = document.createElement('div');
            el.id = 'ecos-announce-overlay';
            el.className = 'ecos-announce-overlay';
            el.innerHTML = `
                <div class="ecos-announce-card">
                    <h2>📢 Annonce et Décision</h2>
                    <p>Vous avez terminé votre interrogatoire. Il vous reste 2 minutes pour :</p>
                    <ol>
                        <li>Proposer <strong>librement</strong> votre diagnostic</li>
                        <li>Annoncer votre hypothèse au patient (explication, empathie)</li>
                    </ol>
                    <label>Diagnostic :</label>
                    <input type="text" id="ecos-diag-input" placeholder="Tapez votre diagnostic..." />
                    <label>Annonce au patient (parlez-lui comme à un vrai patient) :</label>
                    <textarea id="ecos-announce-input" rows="5" placeholder="« Monsieur/Madame, d'après ce que vous m'avez dit et mon examen, je pense que... »"></textarea>
                    <div class="ecos-announce-actions">
                        <button id="ecos-announce-cancel" class="ecos-btn-secondary">Retour station</button>
                        <button id="ecos-announce-submit" class="ecos-btn-primary">Valider et voir le debrief</button>
                    </div>
                </div>
            `;
            document.body.appendChild(el);
            el.querySelector('#ecos-announce-submit').addEventListener('click', submitAnnounce);
            el.querySelector('#ecos-announce-cancel').addEventListener('click', () => {
                el.style.display = 'none';
                ecosState.phase = 'station';
            });
            return el;
        })();
        overlay.style.display = 'flex';

        // Logger l'annonce dans la timeline
        if (window.feedbackTimeline) {
            window.feedbackTimeline.log('diagnostic', 'Phase d\'annonce démarrée');
        }
    }

    async function submitAnnounce() {
        ecosState.diagSubmitted = document.getElementById('ecos-diag-input').value.trim();
        ecosState.announceSubmitted = document.getElementById('ecos-announce-input').value.trim();
        document.getElementById('ecos-announce-overlay').style.display = 'none';

        // Lancer l'évaluation LLM de l'annonce
        showInStationToast('Évaluation LLM en cours…', 'info');
        await evaluateAnnounce();

        showDebrief();
    }

    async function evaluateAnnounce() {
        const grilleComm = ecosState.grilleComm;
        if (!window.CONFIG?.LLM_API_URL || !ecosState.announceSubmitted || grilleComm.length === 0) return;

        const prompt = `Tu es un évaluateur ECOS. Un étudiant doit annoncer son diagnostic à un patient. Évalue la QUALITÉ de l'annonce sur 5 dimensions (0, 0.25, 0.5, 0.75 ou 1 pour chacune).

ANNONCE DE L'ÉTUDIANT : ${ecosState.announceSubmitted}

GRILLE DE COMMUNICATION :
${grilleComm.map(g => `- ${g.id} : ${g.label} (max 1)`).join('\n')}

Réponds UNIQUEMENT par un JSON : { "scores": { "id1": 0.5, "id2": 1 } }`;

        try {
            const resp = await fetch(window.CONFIG.LLM_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: window.CONFIG.LLM_MODEL,
                    messages: [
                        { role: 'system', content: 'Tu es un évaluateur ECOS. Tu renvoies UNIQUEMENT du JSON.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.1,
                    max_tokens: 200
                })
            });
            const data = await resp.json();
            const text = data.choices?.[0]?.message?.content || '{}';
            const json = extractJsonSafe(text);
            ecosState.commScores = json.scores || {};
        } catch (e) {
            console.warn('[ECOS] Évaluation annonce échouée', e);
        }
    }

    // ==================== DEBRIEF ====================

    function showDebrief() {
        ecosState.phase = 'debrief';
        destroyStationLayout();

        // Calculs de score
        const totalApt = ecosState.grilleAptitudes.length;
        const checkedApt = ecosState.gridChecked.size;
        const aptitudePct = totalApt > 0 ? Math.round((checkedApt / totalApt) * 100) : 0;
        const commTotal = ecosState.grilleComm.reduce((s, g) => s + (g.max || 1), 0);
        const commPct = commTotal > 0 ? Math.round((Object.values(ecosState.commScores).reduce((a, b) => a + b, 0) / commTotal) * 100) : 0;

        // Score ECOS final : 70% aptitudes + 30% communication (formule R2C)
        const finalScore = Math.round(aptitudePct * 0.7 + commPct * 0.3);

        // Étoiles
        const stars = finalScore >= 90 ? 3 : finalScore >= 70 ? 2 : finalScore >= 50 ? 1 : 0;

        const overlay = document.createElement('div');
        overlay.id = 'ecos-debrief-overlay';
        overlay.className = 'ecos-debrief-overlay';
        overlay.innerHTML = `
            <div class="ecos-debrief-card">
                <header class="ecos-debrief-header">
                    <h1>🏁 Fin de la station</h1>
                    <div class="ecos-debrief-stars">
                        ${[1, 2, 3].map(i => `<span class="ecos-star ${i <= stars ? 'lit' : ''}">★</span>`).join('')}
                    </div>
                    <div class="ecos-debrief-score">${finalScore}<span>/100</span></div>
                </header>

                <section class="ecos-debrief-section">
                    <h3>🩺 Aptitudes cliniques (70%)</h3>
                    <div class="ecos-debrief-bar"><div class="ecos-debrief-bar-fill" style="width:${aptitudePct}%;background:${aptitudePct >= 80 ? '#2ecc71' : aptitudePct >= 50 ? '#f39c12' : '#e74c3c'};"></div></div>
                    <div class="ecos-debrief-bar-label">${checkedApt} / ${totalApt} items validés (${aptitudePct}%)</div>
                    <ul class="ecos-debrief-grille">
                        ${ecosState.grilleAptitudes.map(g => `
                            <li class="${ecosState.gridChecked.has(g.id) ? 'checked' : 'missed'}">
                                <span class="ecos-check">${ecosState.gridChecked.has(g.id) ? '✓' : '✗'}</span>
                                ${escapeHtml(g.label)}
                            </li>
                        `).join('')}
                    </ul>
                </section>

                <section class="ecos-debrief-section">
                    <h3>💬 Communication (30%)</h3>
                    <div class="ecos-debrief-bar"><div class="ecos-debrief-bar-fill" style="width:${commPct}%;background:${commPct >= 80 ? '#2ecc71' : commPct >= 50 ? '#f39c12' : '#e74c3c'};"></div></div>
                    <div class="ecos-debrief-bar-label">${commPct}%</div>
                    <ul class="ecos-debrief-grille">
                        ${ecosState.grilleComm.map(g => {
                            const score = ecosState.commScores[g.id];
                            return `<li class="${score !== undefined && score >= 0.5 ? 'checked' : score !== undefined ? 'partial' : 'missed'}">
                                <span class="ecos-check">${score !== undefined ? score.toFixed(2) : '—'}</span>
                                ${escapeHtml(g.label)}
                            </li>`;
                        }).join('')}
                    </ul>
                </section>

                ${ecosState.diagSubmitted ? `
                <section class="ecos-debrief-section">
                    <h3>🎯 Diagnostic proposé</h3>
                    <p>Vous : <strong>${escapeHtml(ecosState.diagSubmitted)}</strong></p>
                    <p>Attendu : <strong>${escapeHtml(ecosState.caseData.correctDiagnostic || '—')}</strong></p>
                </section>` : ''}

                <section class="ecos-debrief-section">
                    <h3>📊 Résumé</h3>
                    <ul>
                        <li>Questions posées : <strong>${ecosState.questionsAsked}</strong></li>
                        <li>Durée effective : <strong>${formatDuration((Date.now() - ecosState.startedAt) / 1000)}</strong></li>
                        <li>Items validés : <strong>${checkedApt}/${totalApt}</strong></li>
                    </ul>
                </section>

                <!-- Timeline des actions -->
                <section class="ecos-debrief-section">
                    <div id="ecos-debrief-timeline"></div>
                </section>

                <!-- Comparaison anonyme -->
                <section class="ecos-debrief-section">
                    <div id="ecos-debrief-comparison"></div>
                </section>

                <div id="ecos-debrief-feedback" class="ecos-debrief-feedback">
                    <em>⏳ Génération du feedback narratif par le LLM…</em>
                </div>

                <footer class="ecos-debrief-footer">
                    <button id="ecos-debrief-close" class="ecos-btn-primary">Terminer</button>
                </footer>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('ecos-debrief-close').addEventListener('click', () => {
            overlay.remove();
            ecosState.phase = 'done';
            // Restaurer le contenu normal
            const app = document.querySelector('.app-container');
            if (app) app.style.display = '';
        });

        // Lancer la génération du feedback narratif en arrière-plan
        generateFeedbackNarrative().then(narrative => {
            const fbEl = document.getElementById('ecos-debrief-feedback');
            if (fbEl) fbEl.innerHTML = `<h3>📝 Feedback</h3>${narrative}`;
        });

        // Rendre la timeline des actions (si feedback.js chargé)
        if (window.renderTimeline) {
            const timelineEl = document.getElementById('ecos-debrief-timeline');
            if (timelineEl) timelineEl.innerHTML = window.renderTimeline();
        }

        // Comparaison anonyme (si feedback.js chargé)
        if (window.getAnonymousComparison && window.feedbackTimeline?.events?.length > 0) {
            const compEl = document.getElementById('ecos-debrief-comparison');
            if (compEl) {
                const fakeComposite = {
                    compositeScore: finalScore,
                    demarcheScore: aptitudePct,
                    diagnosticScore: ecosState.diagSubmitted ? 70 : 0,
                    traitementScore: 0,
                    stars,
                    breakdown: { demarche: { score: aptitudePct }, diagnostic: { score: 70 }, traitement: { score: 0 }, vitesse: { score: 100 } }
                };
                const comp = window.getAnonymousComparison(fakeComposite, ecosState.caseData?.id || 'unknown');
                if (comp.total > 1) {
                    compEl.innerHTML = `
                        <div style="background:rgba(0,0,0,0.2); border-radius:8px; padding:12px;">
                            <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                                <span style="font-weight:700;">📊 Comparaison anonyme</span>
                                <span style="font-size:0.75rem; color:rgba(255,255,255,0.4);">(${comp.total} sessions sur ce cas)</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:12px;">
                                <div style="text-align:center;">
                                    <div style="font-size:2rem; font-weight:800; color:${comp.percentile >= 75 ? '#2ecc71' : comp.percentile >= 50 ? '#f39c12' : '#e74c3c'};">${comp.percentile}<span style="font-size:0.8rem;">%</span></div>
                                    <div style="font-size:0.7rem; color:rgba(255,255,255,0.5);">Percentile</div>
                                </div>
                                <div style="flex:1;">
                                    <div style="position:relative; height:24px; background:rgba(255,255,255,0.1); border-radius:12px; overflow:hidden;">
                                        <div style="position:absolute; left:0; height:100%; width:${comp.percentile}%; background:${comp.percentile >= 75 ? '#2ecc71' : comp.percentile >= 50 ? '#f39c12' : '#e74c3c'}; opacity:0.6; border-radius:12px;"></div>
                                        <div style="position:absolute; height:100%; width:2px; left:50%; background:rgba(255,255,255,0.3);"></div>
                                        <div style="position:absolute; left:${comp.percentile}%; top:50%; transform:translate(-50%,-50%); font-size:0.7rem; font-weight:700; color:white; text-shadow: 0 0 4px rgba(0,0,0,0.8);">Vous</div>
                                    </div>
                                </div>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:rgba(255,255,255,0.5); margin-top:8px;">
                                <span>Score moyen : <strong style="color:rgba(255,255,255,0.8);">${comp.avgScore}%</strong></span>
                                <span>Rang : <strong style="color:${comp.percentile >= 75 ? '#2ecc71' : comp.percentile >= 50 ? '#f39c12' : '#e74c3c'};">#${comp.rank}/${comp.total}</strong></span>
                            </div>
                        </div>`;
                } else {
                    compEl.innerHTML = `<div style="background:rgba(0,0,0,0.2); border-radius:8px; padding:12px; text-align:center;"><span style="font-size:0.85rem; color:rgba(255,255,255,0.5);">🏁 Première session sur ce cas — rejouez pour voir votre progression !</span></div>`;
                }
            }
        }
    }

    async function generateFeedbackNarrative() {
        if (!window.CONFIG?.LLM_API_URL) {
            return '<p>Feedback automatique indisponible (LLM non configuré).</p>';
        }
        const missed = ecosState.grilleAptitudes.filter(g => !ecosState.gridChecked.has(g.id));
        const checked = ecosState.grilleAptitudes.filter(g => ecosState.gridChecked.has(g.id));
        const prompt = `Tu es un enseignant de médecine. Un étudiant vient de terminer une station ECOS. Donne un feedback PÉDAGOGIQUE court et bienveillant.

CAS : ${ecosState.caseData.id} — ${ecosState.caseData.interrogatoire?.motifHospitalisation || ''}
DIAGNOSTIC ATTENDU : ${ecosState.caseData.correctDiagnostic}
DIAGNOSTIC PROPOSÉ : ${ecosState.diagSubmitted || '(aucun)'}

CE QUE L'ÉTUDIANT A ABORDÉ : ${checked.map(g => g.label).join(', ') || '(rien)'}
CE QU'IL A OUBLIÉ : ${missed.map(g => g.label).join(', ') || '(tout couvert)'}

FORMAT : 2-3 phrases courtes en français, ton bienveillant mais exigeant, qui pointent 1-2 axes d'amélioration concrets. Pas de markdown, pas de titres.`;
        try {
            const resp = await fetch(window.CONFIG.LLM_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: window.CONFIG.LLM_MODEL,
                    messages: [
                        { role: 'system', content: 'Tu es un enseignant de médecine bienveillant et exigeant.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 400
                })
            });
            const data = await resp.json();
            return escapeHtml(data.choices?.[0]?.message?.content || '').replace(/\n/g, '<br>');
        } catch (e) {
            return '<p>⚠️ Génération du feedback indisponible.</p>';
        }
    }

    // ==================== UTILITAIRES ====================

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDuration(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${String(sec).padStart(2, '0')}`;
    }

    function showInStationToast(text, level = 'info') {
        const toast = document.getElementById('ecos-toast');
        if (!toast) return;
        toast.textContent = text;
        toast.className = `ecos-toast show ${level}`;
        clearTimeout(showInStationToast._t);
        showInStationToast._t = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // ==================== API PUBLIQUE ====================

    /**
     * Démarre le mode ECOS pour un cas donné.
     * @param {Object} caseData - Cas clinique complet (avec ou sans `ecos`)
     */
    function start(caseData) {
        if (!caseData) return;
        ecosState.active = true;
        ecosState.caseData = caseData;
        ecosState.gridChecked.clear();
        ecosState.commScores = {};
        ecosState.conversationLog = [];
        ecosState.questionsAsked = 0;
        ecosState.impatienceTriggered = false;
        ecosState.diagSubmitted = null;
        ecosState.announceSubmitted = null;
        ecosState.feedbackNarrative = '';

        // Réinitialiser la timeline pour cette session
        if (window.feedbackTimeline) {
            window.feedbackTimeline.reset();
            window.feedbackTimeline.log('section', `Station ECOS démarrée — ${caseData.id}`);
        }

        showVignette(caseData);
    }

    function stop() {
        if (ecosState.intervalId) clearInterval(ecosState.intervalId);
        ecosState.intervalId = null;
        hideVignette();
        destroyStationLayout();
        const announce = document.getElementById('ecos-announce-overlay');
        if (announce) announce.remove();
        const debrief = document.getElementById('ecos-debrief-overlay');
        if (debrief) debrief.remove();
        ecosState.phase = 'idle';
        ecosState.active = false;
    }

    /**
     * Met à jour le chronomètre ECOS dans la topbar (1×/s depuis displayTime).
     */
    function tick() {
        const chrono = document.getElementById('ecos-chrono');
        if (!chrono) return;
        const left = getTimeLeft();
        const m = Math.floor(left / 60);
        const s = left % 60;
        chrono.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        chrono.classList.toggle('critical', left <= 60);
        chrono.classList.toggle('warning', left <= 120 && left > 60);
    }

    // Tick 1Hz pendant la station
    setInterval(() => {
        if (ecosState.phase === 'station') tick();
    }, 250);

    // ==================== EXPORT ====================

    window.EcosMode = {
        start,
        stop,
        isActive: () => ecosState.active,
        getPhase: () => ecosState.phase,
        getGrille: () => ({
            aptitudes: Array.from(ecosState.gridChecked),
            comm: { ...ecosState.commScores }
        }),
        CONFIG: ECOS_CONFIG
    };
})();
