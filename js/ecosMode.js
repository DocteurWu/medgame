/**
 * js/ecosMode.js
 * Orchestrateur du mode ECOS (Examens Cliniques Objectifs Structurés, R2C 2024+).
 *
 * Responsabilités :
 *  1. Afficher la vignette ECOS plein écran avant le cas (style A4 paysage)
 *  2. Démarrer un timer strict de 8 min (1 min de lecture vignette hors chrono)
 *  3. Signaux sonores (gong début, cloche à 1 min/30s/10s, gong fin)
 *  4. Chat libre patient (moteur unifié LLMPatient) pour l'interrogatoire
 *  5. Classificateur sémantique LLM léger pour cocher les items de la grille
 *  6. Phase d'annonce de diagnostic
 *  7. Écran de debrief avec grille + feedback narratif LLM + transcript + impression
 *  8. Score ECOS recalculé (50% clinique / 20% communication / 30% diagnostic)
 *
 * Compatibilité : le mode ECOS est activé quand `sessionStorage.immersionMode === 'immersif'`
 *                 ET que le cas est chargé.
 *
 * Dépendances : js/llm-patient.js, js/audio.js, js/timer.js, js/scoring.js,
 *               js/caseLoader.js, js/gameState.js, js/feedback.js
 */

(function () {
    'use strict';

    const ECOS_CONFIG = {
        // Durées en secondes
        VIGNETTE_READ_DURATION: 60,    // 1 min pour lire la vignette (hors chrono)
        STATION_DURATION: 480,         // 8 min pour la station
        WARNING_AT: 60,                // 1 min restante → cloche d'avertissement
        WARNING_AT_30: 30,             // 30 s restantes
        WARNING_AT_10: 10,             // 10 s restantes
        
        // Impatience patient : après N secondes sans question, le PS relance
        PATIENT_IMPATIENCE_AFTER: 60,  // 60 s sans question → relance du patient
        
        // Configuration LLM centralisée
        LLM_TEMP: {
            classify: 0.1,
            exam: 0.2,
            feedback: 0.7,
            eval: 0.1
        },
        LLM_MAX_TOKENS: {
            classify: 300,
            exam: 300,
            feedback: 400,
            eval: 200
        },
        LLM_TIMEOUT_MS: {
            classify: 8000,
            exam: 10000,
            feedback: 20000,
            eval: 15000
        },
        LOG_TRUNCATE: 60,
        
        // Bornes de scoring étoiles R2C
        STARS_THRESHOLDS: [90, 70, 50]
    };
    Object.freeze(ECOS_CONFIG);

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
        conversationLog: [],           // [{ speaker, text, t, kind }]
        lastUserActivityAt: 0,
        lastImpatienceTriggeredAt: 0,  // timestamp du dernier trigger d'impatience
        intervalId: null,
        tickIntervalId: null,
        impatienceTriggered: false,
        chatBusy: false,
        examBusy: false,               // empêche le double envoi des examens
        isPaused: false,               // état de pause
        pausedTimeLeft: 0,             // temps restant conservé à la pause
        warning60Fired: false,         // flags pour éviter de doubler les alertes
        warning30Fired: false,
        warning10Fired: false,
        toastTimeoutId: null,          // identifiant du timeout de toast actif
        diagSubmitted: null,           // texte du diagnostic soumis
        announceSubmitted: null,       // texte de l'annonce
        feedbackNarrative: ''          // généré par LLM en fin de station
    };

    let lastFocusedElement = null;

    // ==================== ACCESSIBILITÉ / FOCUS ====================

    function trapFocus(element) {
        lastFocusedElement = document.activeElement;
        const focusableElements = element.querySelectorAll('button, [href], input, select, textarea, [tabindex="0"]');
        if (focusableElements.length === 0) return;
        
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        
        firstFocusable.focus();
        
        element.addEventListener('keydown', function(e) {
            if (e.key !== 'Tab') return;
            
            if (e.shiftKey) { // Shift + Tab
                if (document.activeElement === firstFocusable) {
                    lastFocusable.focus();
                    e.preventDefault();
                }
            } else { // Tab
                if (document.activeElement === lastFocusable) {
                    firstFocusable.focus();
                    e.preventDefault();
                }
            }
        });
    }

    function restoreFocus() {
        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus();
        }
    }

    // ==================== NORMALISATION / TEXTES ====================

    function normalizeString(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // supprime les accents
            .replace(/œ/g, 'oe');           // remplace la ligature œ
    }

    // ==================== DIALOGUE DE CONFIRMATION CUSTOM ====================

    function ecosConfirm({ title, message, confirmLabel, danger }) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'ecos-confirm-overlay';
            overlay.setAttribute('role', 'alertdialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.innerHTML = `
                <div class="ecos-confirm-dialog">
                    <div class="ecos-confirm-header">
                        <h3>${escapeHtml(title)}</h3>
                    </div>
                    <div class="ecos-confirm-body">
                        <p>${escapeHtml(message)}</p>
                    </div>
                    <div class="ecos-confirm-actions">
                        <button id="ecos-confirm-cancel" class="ecos-confirm-btn ecos-confirm-btn-cancel">Annuler</button>
                        <button id="ecos-confirm-ok" class="ecos-confirm-btn ecos-confirm-btn-confirm ${danger ? 'danger' : ''}">${escapeHtml(confirmLabel || 'Valider')}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            trapFocus(overlay);
            
            const cancelBtn = overlay.querySelector('#ecos-confirm-cancel');
            const okBtn = overlay.querySelector('#ecos-confirm-ok');
            
            cancelBtn.focus();
            
            const cleanup = () => {
                overlay.remove();
                restoreFocus();
            };
            
            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });
            
            okBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });
            
            overlay.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(false);
                }
            });
        });
    }

    // ==================== CLIENT LLM CENTRALISÉ ====================

    /**
     * Appel LLM non-streaming pour les évaluateurs ECOS (classification, examen, annonce, feedback).
     * Délègue à window.LLMClient pour bénéficier du retry backoff et de la cascade de modèles.
     */
    async function llmChat(messages, { temperature = 0.1, maxTokens = 300, timeoutMs = 8000, retries = 2 } = {}) {
        if (!window.LLMClient) {
            // Fallback minimal si LLMClient n'est pas encore chargé
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), timeoutMs);
            try {
                const resp = await fetch(window.CONFIG?.LLM_API_URL || '/api/llm/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: window.CONFIG?.LLM_MODEL,
                        messages,
                        temperature,
                        max_tokens: maxTokens
                    }),
                    signal: ctrl.signal
                });
                clearTimeout(timer);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const data = await resp.json();
                return data.choices?.[0]?.message?.content || '';
            } catch (e) {
                clearTimeout(timer);
                throw e;
            }
        }
        return window.LLMClient.request({
            messages,
            temperature,
            maxTokens,
            timeoutMs,
            maxRetries: retries,
            stream: false
        });
    }

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

        const customDurationSetting = parseInt(localStorage.getItem('ecos_duration'));
        const stationDuration = (!isNaN(customDurationSetting) && customDurationSetting > 0) 
            ? customDurationSetting 
            : ECOS_CONFIG.STATION_DURATION;

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
                        Temps de lecture suggéré : ${formatDuration(ECOS_CONFIG.VIGNETTE_READ_DURATION)}
                    </div>
                    <button id="ecos-start-btn" class="ecos-start-btn">
                        <i class="fas fa-play"></i> Démarrer la station
                        <span class="ecos-start-timer">${formatDuration(stationDuration)}</span>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        trapFocus(overlay);

        // Jouer un gong d'introduction (si la station n'a pas déjà démarré)
        document.getElementById('ecos-start-btn').addEventListener('click', () => {
            if (ecosState.phase !== 'station') {
                if (window.MedGameAudio) window.MedGameAudio.play('ecosGongStart');
            }
            hideVignette();
            enterStation();
        });

        document.body.classList.add('ecos-locked');
    }

    function hideVignette() {
        const overlay = document.getElementById('ecos-vignette');
        if (overlay) overlay.remove();
        restoreFocus();
        document.body.classList.remove('ecos-locked');
    }

    // ==================== STATION 8 MIN ====================

    function enterStation() {
        const caseData = ecosState.caseData;
        if (!caseData) return;

        // Si la station a déjà démarré, on restaure simplement le layout sans réinitialiser le chrono/patient
        if (ecosState.phase === 'station') {
            ensureStationLayout();
            return;
        }

        ecosState.phase = 'station';
        ecosState.grilleAptitudes = caseData.ecos?.grilleAptitudesCliniques || buildFallbackGrilleAptitudes(caseData);
        ecosState.grilleComm = caseData.ecos?.grilleCommunication || buildFallbackGrilleComm();
        
        const fallbackMotif = caseData.interrogatoire?.motifHospitalisation || 'un motif médical';
        ecosState.patientStandardise = caseData.ecos?.patientStandardise || {
            personnalite: 'Patient calme et coopératif.',
            phraseOuverture: caseData.interrogatoire?.verbatim || `Bonjour docteur, je viens pour ${fallbackMotif.toLowerCase()}.`,
            infosVolontaires: [fallbackMotif],
            infosSiDemandees: [],
            infosCachees: [],
            reactions: {
                silence: "Euh... Docteur ? Vous ne me dites rien ? Y a-t-il un problème ?"
            }
        };

        const customDurationSetting = parseInt(localStorage.getItem('ecos_duration'));
        const stationDuration = (!isNaN(customDurationSetting) && customDurationSetting > 0) 
            ? customDurationSetting 
            : ECOS_CONFIG.STATION_DURATION;
        
        ecosState.startedAt = Date.now();
        ecosState.stationEndAt = Date.now() + stationDuration * 1000;
        ecosState.lastUserActivityAt = Date.now();
        ecosState.lastImpatienceTriggeredAt = Date.now();
        ecosState.isPaused = false;
        ecosState.pausedTimeLeft = 0;

        // 3.4 Réinitialiser la timeline des actions pour ce cas ECOS
        if (window.feedbackTimeline) window.feedbackTimeline.reset();
        ecosState.warning60Fired = false;
        ecosState.warning30Fired = false;
        ecosState.warning10Fired = false;

        // Pause heartbeat audio if playing
        const heartbeat = document.getElementById('heartbeat-audio');
        if (heartbeat) {
            try { heartbeat.pause(); } catch(e) {}
        }
        
        addBeforeUnloadGuard();

        // Configurer le timer
        if (typeof window.initTimer === 'function') {
            window.initTimer(stationDuration, true);
            if (typeof timerState !== 'undefined') {
                timerState.onTimeUp = onStationEnd;
            }
        } else {
            console.warn('[ECOS] initTimer indisponible, utilisation du chrono interne uniquement');
        }

        // Construire le layout ECOS
        ensureStationLayout();

        // Basculer en mode 3D automatiquement au début de la station (le patient est là en 3D !)
        setTimeout(async () => {
            if (window.threeManager && !window.threeManager.enabled) {
                await window.threeManager.toggle3D();
            }
        }, 100);

        // Ticker interne (1s) pour les alertes d'avertissement + impatience
        if (ecosState.intervalId) clearInterval(ecosState.intervalId);
        ecosState.intervalId = setInterval(() => {
            if (ecosState.isPaused) return;

            const left = getTimeLeft();
            if (left <= 0) {
                onStationEnd();
                return;
            }

            // Alertes sonores à 60s, 30s et 10s
            if (left <= 60 && !ecosState.warning60Fired) {
                ecosState.warning60Fired = true;
                if (window.MedGameAudio) window.MedGameAudio.play('ecosBell');
                showInStationToast(`⏰ 1 minute restante`, 'warning');
            } else if (left <= 30 && !ecosState.warning30Fired) {
                ecosState.warning30Fired = true;
                if (window.MedGameAudio) window.MedGameAudio.play('ecosBell');
                showInStationToast(`⏰ 30 secondes restantes`, 'warning');
            } else if (left <= 10 && !ecosState.warning10Fired) {
                ecosState.warning10Fired = true;
                if (window.MedGameAudio) window.MedGameAudio.play('alert');
                showInStationToast(`⏰ 10 secondes restantes !`, 'error');
            }

            // Impatience patient : se déclenche après 60 secondes d'inactivité
            const idleFor = (Date.now() - ecosState.lastUserActivityAt) / 1000;
            const timeSinceLastImpatience = (Date.now() - ecosState.lastImpatienceTriggeredAt) / 1000;
            if (idleFor >= ECOS_CONFIG.PATIENT_IMPATIENCE_AFTER && timeSinceLastImpatience >= ECOS_CONFIG.PATIENT_IMPATIENCE_AFTER) {
                ecosState.lastImpatienceTriggeredAt = Date.now();
                triggerPatientImpatience();
            }
        }, 1000);

        if (ecosState.tickIntervalId) clearInterval(ecosState.tickIntervalId);
        ecosState.tickIntervalId = setInterval(tick, 1000);
        tick();

        // Connecter le moteur LLM patient
        ensureLLMPatientLoaded(caseData);

        // Phase d'accueil — différent selon le type de station
        const typeStation = caseData.ecos?.vignette?.typeStation || 'AVEC_PS';
        if (typeStation === 'SANS_PS_PSS') {
            // Patient non-communicant : afficher une description clinique à la place du verbatim
            const contexte = caseData.ecos?.vignette?.contexte || 'Patient en état critique, non-communicant.';
            appendConversation('SYSTEME', `📋 ${contexte} Le patient ne peut pas communiquer verbalement.`, 'system');
        } else {
            appendConversation('PS', ecosState.patientStandardise.phraseOuverture || 'Bonjour docteur.', 'opening');
        }
    }

    function ensureLLMPatientLoaded(caseData) {
        if (window.llmPatientInstance && window.llmPatientInstance.caseData?.id === caseData.id) {
            // Déjà instancié pour ce cas
            return;
        }
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
        // En mode fusionné, nous n'injectons pas d'overlay plein écran.
        // Nous configurons simplement les éléments de game.html.

        // Configurer le bouton vignette
        const btnVignette = document.getElementById('btn-view-vignette');
        if (btnVignette) {
            // Cloner pour purger d'anciens event listeners
            const newBtn = btnVignette.cloneNode(true);
            btnVignette.parentNode.replaceChild(newBtn, btnVignette);
            newBtn.addEventListener('click', () => {
                showVignette(ecosState.caseData);
            });
        }

        // Configurer le bouton pause
        const btnPause = document.getElementById('btn-pause-timer');
        if (btnPause) {
            const isPractice = localStorage.getItem('ecos_practice_mode') !== 'false';
            if (isPractice) {
                btnPause.style.display = 'flex';
                const newPause = btnPause.cloneNode(true);
                btnPause.parentNode.replaceChild(newPause, btnPause);
                newPause.addEventListener('click', () => {
                    togglePause();
                    const icon = newPause.querySelector('i');
                    if (icon) {
                        if (ecosState.isPaused) {
                            icon.className = 'fas fa-play';
                            newPause.title = 'Reprendre la station';
                        } else {
                            icon.className = 'fas fa-pause';
                            newPause.title = 'Mettre en pause';
                        }
                    }
                });
            } else {
                btnPause.style.display = 'none';
            }
        }

        // Configurer le bouton de validation du traitement dans Synthese
        const validateBtn = document.getElementById('validate-traitement');
        if (validateBtn) {
            const newValidate = validateBtn.cloneNode(true);
            validateBtn.parentNode.replaceChild(newValidate, validateBtn);
            newValidate.addEventListener('click', async (e) => {
                e.preventDefault();
                if (await ecosConfirm({ title: 'Terminer la station', message: 'Voulez-vous valider le cas et terminer la station ?', confirmLabel: 'Terminer', danger: true })) {
                    onStationEnd();
                }
            });
        }

        // Masquer l'onglet grille si on est en mode évaluation
        const isPractice = localStorage.getItem('ecos_practice_mode') !== 'false';
        const navGrille = document.getElementById('nav-ecos-grille');
        if (navGrille) {
            navGrille.style.display = isPractice ? 'block' : 'none';
        }

        // Lier les inputs d'examens de game.html
        bindExamInputs();

        // Rendre la grille
        renderGrille();
    }

    function destroyStationLayout() {
        // En mode fusionné, rien à détruire
    }

    function bindExamInputs() {
        const inputPhys = document.getElementById('ecos-exam-input-physique-2d');
        const submitPhys = document.getElementById('ecos-exam-submit-physique-2d');
        if (inputPhys && submitPhys) {
            const newInput = inputPhys.cloneNode(true);
            inputPhys.parentNode.replaceChild(newInput, inputPhys);
            const newSubmit = submitPhys.cloneNode(true);
            submitPhys.parentNode.replaceChild(newSubmit, submitPhys);

            newSubmit.addEventListener('click', async (e) => {
                e.preventDefault();
                const text = newInput.value.trim();
                if (!text) return;
                newInput.value = '';
                await onExamRequest(text);
            });
            newInput.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const text = newInput.value.trim();
                    if (!text) return;
                    newInput.value = '';
                    await onExamRequest(text);
                }
            });
        }

        const inputComp = document.getElementById('ecos-exam-input-comp-2d');
        const submitComp = document.getElementById('ecos-exam-submit-comp-2d');
        if (inputComp && submitComp) {
            const newInput = inputComp.cloneNode(true);
            inputComp.parentNode.replaceChild(newInput, inputComp);
            const newSubmit = submitComp.cloneNode(true);
            submitComp.parentNode.replaceChild(newSubmit, submitComp);

            newSubmit.addEventListener('click', async (e) => {
                e.preventDefault();
                const text = newInput.value.trim();
                if (!text) return;
                newInput.value = '';
                await onExamRequest(text);
            });
            newInput.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const text = newInput.value.trim();
                    if (!text) return;
                    newInput.value = '';
                    await onExamRequest(text);
                }
            });
        }
    }

    // ==================== PAUSE / REPRISE ====================

    function pauseStation() {
        if (localStorage.getItem('ecos_practice_mode') === 'false') return; // Strict mode block
        if (ecosState.isPaused || ecosState.phase !== 'station') return;
        ecosState.isPaused = true;
        ecosState.pausedTimeLeft = getTimeLeft();
        
        if (typeof window.timerState !== 'undefined' && !window.timerState.isPaused) {
            if (typeof window.pauseTimer === 'function') window.pauseTimer();
        }
        
        showInStationToast('⏸ Station en pause', 'info');
        const chrono = document.getElementById('ecos-chrono');
        if (chrono) chrono.classList.add('paused');
    }

    function resumeStation() {
        if (!ecosState.isPaused || ecosState.phase !== 'station') return;
        ecosState.isPaused = false;
        ecosState.stationEndAt = Date.now() + ecosState.pausedTimeLeft * 1000;
        ecosState.lastUserActivityAt = Date.now();
        ecosState.lastImpatienceTriggeredAt = Date.now();
        
        if (typeof window.timerState !== 'undefined' && window.timerState.isPaused) {
            if (typeof window.resumeTimer === 'function') window.resumeTimer();
        }
        
        showInStationToast('▶ Station reprise', 'success');
        const chrono = document.getElementById('ecos-chrono');
        if (chrono) chrono.classList.remove('paused');
    }

    function togglePause() {
        if (localStorage.getItem('ecos_practice_mode') === 'false') {
            showInStationToast('⏸ Mode Strict : La pause est désactivée aux ECOS réels !', 'warning');
            return;
        }
        if (ecosState.isPaused) {
            resumeStation();
        } else {
            pauseStation();
        }
    }

    // ==================== CHAT PATIENT ====================

    function appendConversation(speaker, text, kind = 'normal') {
        const log = document.getElementById('ecos-chat-log');
        if (!log) return null;
        
        const row = document.createElement('div');
        row.className = `ecos-msg ${speaker === 'Vous' ? 'from-student' : 'from-patient'} ${kind === 'opening' ? 'opening' : ''} ${kind === 'thinking' ? 'thinking' : ''}`;
        const innerText = (kind === 'thinking') ? text : escapeHtml(text);
        row.innerHTML = `<div class="ecos-msg-speaker">${escapeHtml(speaker)}</div><div class="ecos-msg-text">${innerText}</div>`;
        log.appendChild(row);
        log.scrollTop = log.scrollHeight;

        ecosState.conversationLog.push({ speaker, text, t: Date.now() - ecosState.startedAt, kind });

        if (kind === 'thinking' && window.MedGameAudio) {
            window.MedGameAudio.play('typing');
        }

        // Logger dans la timeline pour feedback.js
        if (speaker === 'Vous' && window.feedbackTimeline) {
            window.feedbackTimeline.log('interrogatoire', text);
        } else if (speaker === 'PS' && window.feedbackTimeline) {
            window.feedbackTimeline.log('examen', `Patient: ${text.substring(0, ECOS_CONFIG.LOG_TRUNCATE)}...`);
        }
        return row;
    }

    async function onChatSubmit(e) {
        e.preventDefault();
        const input = document.getElementById('ecos-chat-input');
        const submitBtn = document.querySelector('#ecos-chat-form button[type="submit"]');
        const text = (input?.value || '').trim();
        if (!text) return;
        
        if (ecosState.chatBusy || Date.now() - ecosState.lastUserActivityAt < 500) {
            showInStationToast('Veuillez attendre la réponse du patient avant de renvoyer une question.', 'warning');
            return;
        }

        if (text.length > 500) {
            showInStationToast('Votre question est trop longue (max 500 caractères).', 'warning');
            return;
        }

        ecosState.lastUserActivityAt = Date.now();
        ecosState.lastImpatienceTriggeredAt = Date.now();
        ecosState.impatienceTriggered = false;
        ecosState.questionsAsked++;

        appendConversation('Vous', text);
        ecosState.chatBusy = true;
        if (input) input.disabled = true;
        if (submitBtn) submitBtn.disabled = true;
        try {
            await handleUserQuestion(text);
        } finally {
            ecosState.chatBusy = false;
            if (input) {
                input.disabled = false;
                input.focus();
            }
            if (submitBtn) submitBtn.disabled = false;
        }
    }

    async function handleUserQuestion(question) {
        if (window.medicalGameManager) {
            const placeholder = appendConversation('PS', '<div class="ecos-typing-indicator"><span></span><span></span><span></span></div>', 'thinking');
            try {
                const result = await window.medicalGameManager.processAction(question);
                placeholder.classList.remove('thinking');
                
                let displayHTML = "";
                let rawTextForCheck = "";
                
                if (result.narrative && result.dialogue) {
                    displayHTML = `<em>(${result.narrative})</em><br>« ${result.dialogue} »`;
                    rawTextForCheck = `*(${result.narrative})* "${result.dialogue}"`;
                } else if (result.narrative) {
                    displayHTML = `<em>${result.narrative}</em>`;
                    rawTextForCheck = `*${result.narrative}*`;
                    
                    const speakerEl = placeholder.querySelector('.ecos-msg-speaker');
                    if (speakerEl) speakerEl.textContent = "MJ";
                } else if (result.dialogue) {
                    displayHTML = `« ${result.dialogue} »`;
                    rawTextForCheck = `"${result.dialogue}"`;
                } else {
                    displayHTML = `<em>Le patient ne réagit pas.</em>`;
                    rawTextForCheck = `Le patient ne réagit pas.`;
                    const speakerEl = placeholder.querySelector('.ecos-msg-speaker');
                    if (speakerEl) speakerEl.textContent = "MJ";
                }
                
                const textEl = placeholder.querySelector('.ecos-msg-text');
                if (textEl) textEl.innerHTML = displayHTML;
                
                window.ECOS_BYPASS_HISTORY_SYNC = true;
                await classifyAndCheck(question, rawTextForCheck);
                return;
            } catch (err) {
                console.warn('[ECOS] MedicalGameManager error, using fallback:', err);
                placeholder.remove();
            }
        }

        if (!window.llmPatientInstance) {
            // Pas d'instance : utiliser llmFallback si disponible
            const fallbackAnswer = window.llmFallback
                ? window.llmFallback.answer(question, ecosState.caseData)
                : '⚠️ Moteur patient indisponible (LLM hors ligne).';
            appendConversation('PS', fallbackAnswer, window.llmFallback ? 'normal' : 'error');
            await classifyAndCheck(question, fallbackAnswer);
            return;
        }

        // Afficher un placeholder
        const placeholder = appendConversation('PS', '<div class="ecos-typing-indicator"><span></span><span></span><span></span></div>', 'thinking');

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
                        if (window.MedGameAudio) window.MedGameAudio.play('typing');
                    },
                    (final) => {
                        placeholder.querySelector('.ecos-msg-text').textContent = final || fullAnswer;
                        resolve();
                    },
                    (err) => reject(new Error(err))
                );
            });
            placeholder.classList.remove('thinking');

            // ── 2.6 Double-sync history ──────────────────────────────────
            // llmPatientInstance.ask() maintient déjà son historique interne ;
            // on synchronise aussi ecosState.conversationLog → pas de doublon.
            // En mode ECOS, on pose le flag pour que syncHistoryFromGlobal() saute.
            window.ECOS_BYPASS_HISTORY_SYNC = true;

            // Classifier la question pour la grille d'aptitudes
            const finalAnswer = fullAnswer || placeholder.querySelector('.ecos-msg-text').textContent;
            await classifyAndCheck(question, finalAnswer);
        } catch (err) {
            const textEl = placeholder.querySelector('.ecos-msg-text');
            // Utiliser le fallback rule-based si LLM est KO
            const fallbackAnswer = window.llmFallback
                ? window.llmFallback.answer(question, ecosState.caseData)
                : '⚠️ Erreur LLM. Réessayez.';
            if (textEl) textEl.textContent = fallbackAnswer;
            if (!window.llmFallback) {
                placeholder.classList.add('error');
            }
            placeholder.classList.remove('thinking');
            console.warn('[ECOS] LLM ask failed, fallback used:', err);
            await classifyAndCheck(question, fallbackAnswer).catch(() => {});
        }
    }

    async function triggerPatientImpatience() {
        // Les patients non-communicants (ACR, inconscients) ne parlent pas
        if ((ecosState.caseData?.ecos?.vignette?.typeStation || 'AVEC_PS') === 'SANS_PS_PSS') return;
        const msg = ecosState.patientStandardise?.reactions?.silence || "Docteur ? Vous ne me dites rien ? Y a-t-il un problème ?";
        if (window.llmPatientInstance) {
            try {
                appendConversation('PS', msg, 'impulse');
                await classifyAndCheck('(patient parle spontanément)', msg);
            } catch (e) {
                console.warn('[ECOS] Impatience classification failed:', e);
            }
        }
    }

    // ==================== EXAMEN PHYSIQUE / COMPLÉMENTAIRE ====================

    async function onExamRequest(request) {
        ecosState.lastUserActivityAt = Date.now();
        ecosState.lastImpatienceTriggeredAt = Date.now();
        ecosState.impatienceTriggered = false;

        const cleanRequest = (request || '').trim();
        if (!cleanRequest) return;

        appendConversation('Vous', `[Examen] ${cleanRequest}`);

        const caseData = ecosState.caseData;

        // 1. Détecter si la demande correspond à un examen complémentaire existant dans le cas
        let compExamResult = null;
        let matchedExamKey = null;
        if (caseData.examResults) {
            const reqLower = normalizeString(cleanRequest);
            for (const [examName, examRes] of Object.entries(caseData.examResults)) {
                const normExamName = normalizeString(examName);
                if (reqLower.includes(normExamName) || normExamName.includes(reqLower)) {
                    compExamResult = `${examName} : ${examRes}`;
                    matchedExamKey = examName;
                    break;
                }
            }
        }

        if (compExamResult) {
            appendConversation('Examen', compExamResult);
            // Mettre à jour la liste des examens complémentaires commandés pour scoring.js
            if (window.trackExamsOrdered) {
                const currentExams = window.scoringState?.demarche?.examsOrdered || [];
                if (!currentExams.includes(matchedExamKey)) {
                    window.trackExamsOrdered([...currentExams, matchedExamKey]);
                }
            }
            // Cocher dynamiquement l'item dans la grille d'aptitudes s'il correspond
            const grille = ecosState.grilleAptitudes;
            const reqLower = normalizeString(cleanRequest);
            let checkedAny = false;
            grille.forEach(g => {
                const normLabel = normalizeString(g.label);
                const normId = normalizeString(g.id);
                const matchKeyword = g.triggerKeywords && g.triggerKeywords.some(k => reqLower.includes(normalizeString(k)));
                if (normId.includes(normalizeString(matchedExamKey)) || normLabel.includes(normalizeString(matchedExamKey)) || matchKeyword) {
                    if (!ecosState.gridChecked.has(g.id)) {
                        ecosState.gridChecked.add(g.id);
                        checkedAny = true;
                        if (window.feedbackTimeline) {
                            window.feedbackTimeline.log('examen', `Examen complémentaire réalisé: ${g.label || g.id}`);
                        }
                    }
                }
            });
            if (checkedAny) {
                updateGrilleUI();
                if (window.MedGameAudio) window.MedGameAudio.play('correct');
                showInStationToast('✓ Examen complémentaire enregistré', 'success');
            }
            return;
        }

        // 2. Examen physique classique (LLM)
        if (!caseData?.examenClinique) {
            appendConversation('Système', 'Aucun examen physique disponible pour ce cas.', 'error');
            return;
        }

        const exam = caseData.examenClinique;
        const examSummary = [];
        if (exam.constantes) {
            const c = exam.constantes || {};
            examSummary.push(`Constantes : FC=${c.pouls ?? 'NR'}, TA=${c.tension ?? 'NR'}, SpO2=${c.saturationO2 ?? 'NR'}, T°=${c.temperature ?? 'NR'}`);
        }
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

        const prompt = `Tu es un patient dans un lit d'hôpital. L'étudiant te demande de réaliser un examen physique ou veut voir les résultats d'un examen.

DEMANDE DE L'ÉTUDIANT : "${cleanRequest}"

RÉSULTATS D'EXAMEN DISPONIBLES :
${examSummary.join('\n')}

Évalue la demande. Si elle correspond à un examen disponible, renvoie UNIQUEMENT le résultat correspondant en langage naturel (comme un médecin qui lit le dossier). Si l'examen n'est pas pertinent ou pas disponible, réponds "Cet examen n'est pas disponible ou n'est pas pertinent pour votre évaluation."

Règles :
- Sois concis (1-2 phrases max)
- Utilise le jargon médical approprié
- Ne donne PAS de diagnostic, décris seulement les constatations objectives`;

        try {
            const text = await llmChat([
                { role: 'system', content: 'Tu es un dossier médical. Tu renvoies les constatations d\'examen demandées.' },
                { role: 'user', content: prompt }
            ], {
                temperature: ECOS_CONFIG.LLM_TEMP.exam,
                maxTokens: ECOS_CONFIG.LLM_MAX_TOKENS.exam,
                timeoutMs: ECOS_CONFIG.LLM_TIMEOUT_MS.exam
            });
            appendConversation('Examen', text);
            markExamItemsChecked(cleanRequest, exam);
        } catch (e) {
            console.warn('[ECOS] Examen LLM call failed:', e);
            const allFindings = examSummary.join('\n') || 'Aucun examen disponible.';
            appendConversation('Examen', allFindings);
            markExamItemsChecked(cleanRequest, exam);
        }
    }

    function markExamItemsChecked(request, exam) {
        const grille = ecosState.grilleAptitudes;
        const reqLower = normalizeString(request);
        let checkedAny = false;

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
            oedemes: ['examen_oedemes'],
            jambes: ['examen_oedemes'],
            godet: ['examen_oedemes'],
            orl: ['examen_orl'],
            dermato: ['examen_dermatologique'],
            peau: ['examen_dermatologique'],
            musculo: ['examen_musculosquelettique'],
            articulation: ['examen_musculosquelettique'],
            ophtalmo: ['examen_ophtalmologique'],
            yeux: ['examen_ophtalmologique']
        };

        for (const [keyword, itemIds] of Object.entries(examKeywordMap)) {
            const normKeyword = normalizeString(keyword);
            if (reqLower.includes(normKeyword)) {
                for (const itemId of itemIds) {
                    // Limiter la validation d'examen physique aux items commançant par examen_ ou examen-
                    if ((itemId.startsWith('examen_') || itemId.startsWith('examen-')) && grille.some(g => g.id === itemId) && !ecosState.gridChecked.has(itemId)) {
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
                    if (window.feedbackTimeline) {
                        const item = grille.find(g => g.id === itemId);
                        window.feedbackTimeline.log('examen', `Examen réalisé: ${item?.label || itemId}`);
                    }
                    break;
                }
            }
        }

        if (checkedAny) {
            updateGrilleUI();
            if (window.MedGameAudio) window.MedGameAudio.play('correct');
            showInStationToast('✓ Examen enregistré dans la grille', 'success');
        }
    }

    // ==================== CLASSIFICATEUR SÉMANTIQUE ====================

    async function classifyAndCheck(question, answer) {
        if (!window.CONFIG?.LLM_API_URL) return;
        const grille = ecosState.grilleAptitudes;
        if (!grille.length) return;

        // Évite d'envoyer les messages d'erreurs du patient au classificateur
        if (!answer || answer.includes('⚠️ Erreur') || answer.includes('Moteur patient indisponible')) return;

        const prompt = `Tu es un évaluateur ECOS. On te donne une question posée par l'étudiant-médecin et la réponse du patient. Tu dois déterminer quels items de la grille d'aptitudes cliniques ont été validés par cet échange.

GRILLE D'APTITUDES (chaque item a un id et un label ; coche = l'étudiant a abordé le sujet ou fait le geste) :
${grille.map(g => `- ${g.id} : ${g.label}${g.triggerKeywords ? ' [keywords: ' + g.triggerKeywords.join(', ') + ']' : ''}`).join('\n')}

QUESTION DE L'ÉTUDIANT : ${question}
RÉPONSE DU PATIENT : ${answer}

RENVOIE UNIQUEMENT un JSON strict : { "checked": ["id1", "id2"] } avec UNIQUEMENT les ids qui sont nouvellement validés. Si rien n'est validé, renvoie {"checked": []}.
IMPORTANT : N'évaluez et ne cochez QUE les items d'interrogatoire (anamnèse, antécédents, mode de vie, histoire de la maladie). NE COCHEZ PAS les items d'examen physique (ceux commençant par 'examen_') car ceux-ci ne peuvent être validés que par une demande d'examen physique explicite.`;

        try {
            const text = await llmChat([
                { role: 'system', content: 'Tu es un évaluateur ECOS. Tu renvoies UNIQUEMENT un JSON strict {checked: [ids]}.' },
                { role: 'user', content: prompt }
            ], {
                temperature: ECOS_CONFIG.LLM_TEMP.classify,
                maxTokens: ECOS_CONFIG.LLM_MAX_TOKENS.classify,
                timeoutMs: ECOS_CONFIG.LLM_TIMEOUT_MS.classify,
                retries: 1
            });
            const json = extractJsonSafe(text);
            
            // Garantir que le classificateur chat ne coche pas d'items examen_ cliniques
            const newly = (json.checked || [])
                .filter(id => !ecosState.gridChecked.has(id))
                .filter(id => !id.startsWith('examen_') && !id.startsWith('examen-'));

            newly.forEach(id => {
                if (grille.some(g => g.id === id)) {
                    ecosState.gridChecked.add(id);
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
            console.warn('[ECOS] classifyAndCheck failed:', e);
        }
    }

    function extractJsonSafe(content) {
        try {
            const first = content.indexOf('{');
            const last = content.lastIndexOf('}');
            if (first === -1 || last === -1) return {};
            let jsonText = content.substring(first, last + 1);
            
            // Nettoyage basique des trailing commas
            jsonText = jsonText
                .replace(/,\s*}/g, '}')
                .replace(/,\s*]/g, ']');
                
            return JSON.parse(jsonText);
        } catch (e) {
            console.warn('[ECOS] JSON extract failed:', e, content);
            return {};
        }
    }

    // ==================== GRILLE & FALLBACKS ====================

    function buildFallbackGrilleAptitudes(caseData) {
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

        // Ajouter dynamiquement des items d'examens physiques selon le cas
        if (caseData.examenClinique) {
            const exam = caseData.examenClinique;
            const examMapping = {
                examenCardiovasculaire: { id: 'examen_cardiovasculaire', label: 'Examen cardiovasculaire', triggerKeywords: ['cardio', 'coeur', 'pouls', 'cardiaque', 'auscultation'] },
                examenPulmonaire: { id: 'examen_pulmonaire', label: 'Examen pulmonaire', triggerKeywords: ['pulmonaire', 'poumon', 'respiratoire', 'auscultation'] },
                examenAbdominal: { id: 'examen_abdominal', label: 'Examen abdominal', triggerKeywords: ['abdominal', 'abdomen', 'ventre', 'palpation'] },
                examenNeurologique: { id: 'examen_neurologique', label: 'Examen neurologique', triggerKeywords: ['neurologique', 'neurologie', 'réflexes', 'sensibilité', 'force'] },
                examenOedemes: { id: 'examen_oedemes', label: 'Recherche d\'œdèmes des membres inférieurs', triggerKeywords: ['oedeme', 'œdème', 'jambes', 'godet'] },
                examenOrl: { id: 'examen_orl', label: 'Examen ORL', triggerKeywords: ['orl', 'gorge', 'oreilles'] },
                examenDermatologique: { id: 'examen_dermatologique', label: 'Examen dermatologique', triggerKeywords: ['peau', 'dermatologique', 'cutané'] },
                examenMusculosquelettique: { id: 'examen_musculosquelettique', label: 'Examen musculosquelettique', triggerKeywords: ['musculo', 'articulation', 'mouvement'] },
                examenOphtalmologique: { id: 'examen_ophtalmologique', label: 'Examen ophtalmologique', triggerKeywords: ['ophtalmo', 'yeux', 'vision'] }
            };
            for (const [key, config] of Object.entries(examMapping)) {
                if (exam[key]) {
                    items.push({
                        id: config.id,
                        label: config.label,
                        weight: 1,
                        triggerKeywords: config.triggerKeywords
                    });
                }
            }
        }

        return items.filter(item => isItemApplicable(item, int, caseData));
    }

    function isItemApplicable(item, int, caseData) {
        if (int.antecedents?.chirurgicaux?.length === 0 && item.id === 'antecedents_chirurgicaux') return true;
        if (int.antecedents?.familiaux?.length === 0 && item.id === 'antecedents_familiaux') return true;
        if (!int.allergies && item.id === 'allergies') return true;
        if (!int.traitements && item.id === 'traitements') return true;
        return true;
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

    function getPathsForEcosId(id) {
        const map = {
            'interrogatoire_caracteristiques_douleur': [
                'interrogatoire.histoireMaladie.descriptionDouleur',
                'interrogatoire.histoireMaladie.debutSymptomes',
                'interrogatoire.histoireMaladie.evolution',
                'interrogatoire.histoireMaladie.facteursDeclenchants'
            ],
            'interrogatoire_facteurs_risque': [
                'interrogatoire.modeDeVie.tabac',
                'interrogatoire.antecedents.medicaux',
                'interrogatoire.antecedents.familiaux'
            ],
            'interrogatoire_symptomes_associes': [
                'interrogatoire.histoireMaladie.symptomesAssocies',
                'interrogatoire.histoireMaladie.remarques'
            ],
            'interrogatoire_traitements': [
                'interrogatoire.traitements',
                'interrogatoire.allergies'
            ]
        };
        return map[id] || [];
    }

    function renderGrille() {
        const aptList = document.getElementById('ecos-grille-apt-2d') || document.getElementById('ecos-grille-apt');
        const commList = document.getElementById('ecos-grille-comm-2d') || document.getElementById('ecos-grille-comm');
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
        document.querySelectorAll('#ecos-grille-apt-2d .ecos-grille-item, #ecos-grille-apt .ecos-grille-item').forEach(li => {
            const id = li.dataset.id;
            if (ecosState.gridChecked.has(id)) {
                li.classList.add('checked');
                const checkSpan = li.querySelector('.ecos-check');
                if (checkSpan) checkSpan.textContent = '✓';
            }
        });

        // Mettre à jour interrogatoireAsked pour déverrouiller automatiquement les fiches cliniques 2D
        ecosState.gridChecked.forEach(id => {
            const paths = getPathsForEcosId(id);
            paths.forEach(p => {
                if (window.trackInterrogatoire) {
                    window.trackInterrogatoire(p);
                }
            });
        });

        // Déclencher le rafraîchissement des cartes cliniques 2D
        if (window.refreshCaseUI) {
            window.refreshCaseUI();
        }
    }

    // ==================== FIN DE STATION ====================

    function getTimeLeft() {
        if (typeof window.timerState !== 'undefined' && window.timerState.timeLeft !== undefined) {
            return Math.max(0, window.timerState.timeLeft);
        }
        if (!ecosState.stationEndAt) return 0;
        return Math.max(0, Math.round((ecosState.stationEndAt - Date.now()) / 1000));
    }

    function onStationEnd() {
        if (ecosState.phase === 'debrief' || ecosState.phase === 'done') return;
        if (ecosState.intervalId) clearInterval(ecosState.intervalId);
        if (ecosState.tickIntervalId) clearInterval(ecosState.tickIntervalId);
        ecosState.intervalId = null;
        ecosState.tickIntervalId = null;
        ecosState.phase = 'debrief';

        if (window.MedGameAudio) {
            window.MedGameAudio.play('ecosGongEnd');
        }

        // Stopper le timer global
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
                    <p id="ecos-announce-time-msg"></p>
                    <ol>
                        <li>Proposer <strong>librement</strong> votre diagnostic</li>
                        <li>Annoncer votre hypothèse au patient (explication, empathie)</li>
                    </ol>
                    <form id="ecos-announce-form">
                        <label for="ecos-diag-input">Diagnostic :</label>
                        <input type="text" id="ecos-diag-input" placeholder="Tapez votre diagnostic..." required autocomplete="off" />
                        <label for="ecos-announce-input">Annonce au patient (parlez-lui comme à un vrai patient) :</label>
                        <textarea id="ecos-announce-input" rows="5" placeholder="« Monsieur/Madame, d'après ce que vous m'avez dit et mon examen, je think que... »" required></textarea>
                        <div class="ecos-announce-actions">
                            <button type="button" id="ecos-announce-cancel" class="ecos-btn-secondary">Retour station</button>
                            <button type="submit" id="ecos-announce-submit" class="ecos-btn-primary">Valider et voir le debrief</button>
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(el);
            el.querySelector('#ecos-announce-form').addEventListener('submit', submitAnnounce);
            el.querySelector('#ecos-announce-cancel').addEventListener('click', () => {
                el.style.display = 'none';
                restoreFocus();
                ecosState.phase = 'station';
            });
            return el;
        })();
        
        overlay.style.display = 'flex';
        trapFocus(overlay);

        const timeLeft = getTimeLeft();
        const timeMsgEl = overlay.querySelector('#ecos-announce-time-msg');
        if (timeMsgEl) {
            if (timeLeft > 0) {
                timeMsgEl.innerHTML = `Vous avez terminé votre interrogatoire. Il vous reste <strong>${formatDuration(timeLeft)}</strong> pour :`;
            } else {
                timeMsgEl.innerHTML = `Le temps réglementaire est écoulé. Saisissez vos conclusions :`;
            }
        }

        if (window.feedbackTimeline) {
            window.feedbackTimeline.log('diagnostic', 'Phase d\'annonce démarrée');
        }
    }

    async function submitAnnounce(e) {
        if (e) e.preventDefault();
        const submitBtn = document.getElementById('ecos-announce-submit');
        if (submitBtn) submitBtn.disabled = true;
        const cancelBtn = document.getElementById('ecos-announce-cancel');
        if (cancelBtn) cancelBtn.disabled = true;

        ecosState.diagSubmitted = document.getElementById('ecos-diag-input').value.trim();
        ecosState.announceSubmitted = document.getElementById('ecos-announce-input').value.trim();

        // Lancer l'évaluation LLM de l'annonce
        showInStationToast('Évaluation LLM en cours…', 'info');
        await evaluateAnnounce();

        document.getElementById('ecos-announce-overlay').style.display = 'none';
        
        saveSessionToLocalStorage(ecosState.diagSubmitted, ecosState.announceSubmitted);
        restoreFocus();
        showDebrief();
    }

    async function evaluateAnnounce() {
        const grilleComm = ecosState.grilleComm;
        if (!window.CONFIG?.LLM_API_URL || !ecosState.announceSubmitted || grilleComm.length === 0) {
            // Fallback heuristique local si le LLM n'est pas disponible
            ecosState.commScores = {};
            const textLower = normalizeString(ecosState.announceSubmitted);
            if (textLower.includes('bonjour') || textLower.includes('monsieur') || textLower.includes('madame')) {
                ecosState.commScores['vocabulaire_adapte'] = 1;
            }
            if (textLower.includes('desole') || textLower.includes('comprends') || textLower.includes('soutenir') || textLower.includes('accompagner')) {
                ecosState.commScores['empathie'] = 1;
            }
            return;
        }

        const prompt = `Tu es un évaluateur ECOS. Un étudiant doit annoncer son diagnostic à un patient. Évalue la QUALITÉ de l'annonce sur 5 dimensions (0, 0.25, 0.5, 0.75 ou 1 pour chacune).

ANNONCE DE L'ÉTUDIANT : ${ecosState.announceSubmitted}

GRILLE DE COMMUNICATION :
${grilleComm.map(g => `- ${g.id} : ${g.label} (max 1)`).join('\n')}

Réponds UNIQUEMENT par un JSON : { "scores": { "id1": 0.5, "id2": 1 } }`;

        try {
            const text = await llmChat([
                { role: 'system', content: 'Tu es un évaluateur ECOS. Tu renvoies UNIQUEMENT du JSON.' },
                { role: 'user', content: prompt }
            ], {
                temperature: ECOS_CONFIG.LLM_TEMP.eval,
                maxTokens: ECOS_CONFIG.LLM_MAX_TOKENS.eval,
                timeoutMs: ECOS_CONFIG.LLM_TIMEOUT_MS.eval
            });
            const json = extractJsonSafe(text);
            ecosState.commScores = json.scores || {};
        } catch (e) {
            console.warn('[ECOS] Évaluation annonce échouée', e);
            ecosState.commScores = {};
            const textLower = normalizeString(ecosState.announceSubmitted);
            if (textLower.includes('bonjour') || textLower.includes('monsieur') || textLower.includes('madame')) {
                ecosState.commScores['vocabulaire_adapte'] = 0.75;
            }
            if (textLower.includes('desole') || textLower.includes('comprends') || textLower.includes('soutenir') || textLower.includes('accompagner')) {
                ecosState.commScores['empathie'] = 0.75;
            }
        }
    }

    // ==================== LOCAL STORAGE STATS ====================

    function saveSessionToLocalStorage(diag, announce) {
        const STORAGE_KEY = 'medgame_ecos_sessions';
        try {
            let sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            const caseId = ecosState.caseData?.id || 'unknown';
            if (!sessions[caseId]) sessions[caseId] = [];
            
            const totalApt = ecosState.grilleAptitudes.length;
            const checkedApt = ecosState.gridChecked.size;
            const aptitudePct = totalApt > 0 ? Math.round((checkedApt / totalApt) * 100) : 0;
            const commTotal = ecosState.grilleComm.reduce((s, g) => s + (g.max || 1), 0);
            
            let commSum = 0;
            ecosState.grilleComm.forEach(g => {
                const val = ecosState.commScores[g.id];
                if (typeof val === 'number') {
                    commSum += Math.max(0, Math.min(g.max || 1, val));
                }
            });
            const commPct = commTotal > 0 ? Math.round((commSum / commTotal) * 100) : 0;
            
            const diagScore = window.calculateDiagnosticScore 
                ? window.calculateDiagnosticScore(diag, ecosState.caseData.correctDiagnostic)
                : (diag ? 50 : 0);
            
            const finalScore = Math.round(aptitudePct * 0.5 + commPct * 0.2 + diagScore * 0.3);
            
            sessions[caseId].push({
                date: new Date().toISOString(),
                finalScore,
                aptitudePct,
                commPct,
                diagScore,
                diagSubmitted: diag,
                announceSubmitted: announce,
                gridChecked: Array.from(ecosState.gridChecked),
                questionsAsked: ecosState.questionsAsked,
                duration: (Date.now() - ecosState.startedAt) / 1000
            });
            
            if (sessions[caseId].length > 10) {
                sessions[caseId] = sessions[caseId].slice(-10);
            }
            
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
        } catch (e) {
            console.warn('[ECOS] Failed to save session to localStorage:', e);
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
        let commSum = 0;
        ecosState.grilleComm.forEach(g => {
            const val = ecosState.commScores[g.id];
            if (typeof val === 'number') {
                commSum += Math.max(0, Math.min(g.max || 1, val));
            }
        });
        const commPct = commTotal > 0 ? Math.round((commSum / commTotal) * 100) : 0;

        const diagScore = window.calculateDiagnosticScore 
            ? window.calculateDiagnosticScore(ecosState.diagSubmitted, ecosState.caseData.correctDiagnostic)
            : (ecosState.diagSubmitted ? 50 : 0);

        // 3.3 Bonus vitesse : jusqu'à +5 pts si l'étudiant a utilisé ≤ 80% du temps
        const totalDurationMs = ECOS_CONFIG.STATION_DURATION * 1000;
        const usedMs = Date.now() - (ecosState.startedAt || Date.now());
        const timeRatio = Math.max(0, Math.min(1, usedMs / totalDurationMs));
        // Bonus max 5 pts si ≤ 40% du temps utilisé, dégressif jusqu'à 80%
        const vitesseBonus = timeRatio <= 0.4 ? 5
            : timeRatio <= 0.6 ? 3
            : timeRatio <= 0.8 ? 1
            : 0;

        // Score ECOS final : 45% clinique / 20% communication / 30% diagnostic / 5% vitesse
        const baseScore = Math.round(aptitudePct * 0.45 + commPct * 0.2 + diagScore * 0.3);
        const finalScore = Math.min(100, baseScore + vitesseBonus);

        // Étoiles basées sur les seuils configurés
        const stars = finalScore >= ECOS_CONFIG.STARS_THRESHOLDS[0] ? 3 
            : finalScore >= ECOS_CONFIG.STARS_THRESHOLDS[1] ? 2 
            : finalScore >= ECOS_CONFIG.STARS_THRESHOLDS[2] ? 1 
            : 0;

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
                    <h3>🩺 Aptitudes cliniques (50%)</h3>
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
                    <h3>💬 Communication (20%)</h3>
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

                <section class="ecos-debrief-section">
                    <h3>🎯 Diagnostic (30%)</h3>
                    <div class="ecos-debrief-bar"><div class="ecos-debrief-bar-fill" style="width:${diagScore}%;background:${diagScore >= 80 ? '#2ecc71' : diagScore >= 50 ? '#f39c12' : '#e74c3c'};"></div></div>
                    <div class="ecos-debrief-bar-label">Score Diagnostic : ${diagScore}%</div>
                    <div style="margin-top: 10px; font-size: 0.9rem;">
                        <p>Vous : <strong>${escapeHtml(ecosState.diagSubmitted || '(aucun)')}</strong></p>
                        <p>Attendu : <strong>${escapeHtml(ecosState.caseData.correctDiagnostic || '—')}</strong></p>
                    </div>
                </section>

                <section class="ecos-debrief-section">
                    <h3>📊 Résumé</h3>
                    <ul>
                        <li>Questions posées : <strong>${ecosState.questionsAsked}</strong></li>
                        <li>Durée effective : <strong>${formatDuration((Date.now() - ecosState.startedAt) / 1000)}</strong></li>
                        <li>Items validés : <strong>${checkedApt}/${totalApt}</strong></li>
                        ${vitesseBonus > 0 ? `<li>⚡ Bonus vitesse : <strong style="color:#2ecc71">+${vitesseBonus} pts</strong></li>` : ''}
                    </ul>
                    <div style="font-size:0.75rem;color:rgba(255,255,255,0.4);margin-top:8px;">
                        Pondération : Aptitudes 45% · Communication 20% · Diagnostic 30% · Vitesse 5%
                    </div>
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
                    <div class="ecos-loading-spinner"><i class="fas fa-spinner fa-spin"></i> Génération du feedback narratif par le LLM…</div>
                </div>

                <footer class="ecos-debrief-footer">
                    <button id="ecos-debrief-replay" class="ecos-btn-secondary"><i class="fas fa-redo"></i> Rejouer</button>
                    <button id="ecos-debrief-print" class="ecos-btn-secondary"><i class="fas fa-print"></i> Imprimer</button>
                    <button id="ecos-debrief-export" class="ecos-btn-secondary"><i class="fas fa-download"></i> Transcript</button>
                    <button id="ecos-debrief-next" class="ecos-btn-secondary"><i class="fas fa-arrow-right"></i> Cas suivant</button>
                    <button id="ecos-debrief-close" class="ecos-btn-primary">Terminer</button>
                </footer>
            </div>
        `;
        document.body.appendChild(overlay);
        trapFocus(overlay);

        document.getElementById('ecos-debrief-close').addEventListener('click', () => {
            overlay.remove();
            restoreFocus();
            stop();
            window.location.href = 'themes.html';
        });

        const nextBtn = document.getElementById('ecos-debrief-next');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                overlay.remove();
                restoreFocus();
                stop();
                if (typeof window.loadNextCase === 'function') {
                    window.loadNextCase();
                } else {
                    window.location.href = 'themes.html';
                }
            });
        }

        document.getElementById('ecos-debrief-replay').addEventListener('click', () => {
            overlay.remove();
            restoreFocus();
            start(ecosState.caseData);
        });

        document.getElementById('ecos-debrief-print').addEventListener('click', () => {
            window.print();
        });

        document.getElementById('ecos-debrief-export').addEventListener('click', () => {
            const transcript = ecosState.conversationLog.map(log => {
                const time = formatDuration(log.t / 1000);
                return `[${time}] ${log.speaker}: ${log.text}`;
            }).join('\n');
            const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ecos_transcript_${ecosState.caseData?.id || 'case'}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });

        // Lancer la génération du feedback narratif en arrière-plan
        generateFeedbackNarrative().then(narrative => {
            const fbEl = document.getElementById('ecos-debrief-feedback');
            if (fbEl) fbEl.innerHTML = `<h3>📝 Feedback</h3>${narrative}`;
        }).catch(err => {
            const fbEl = document.getElementById('ecos-debrief-feedback');
            if (fbEl) fbEl.innerHTML = '<h3>📝 Feedback</h3><p>⚠️ Feedback indisponible.</p>';
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
                    diagnosticScore: diagScore,
                    traitementScore: 0,
                    stars,
                    breakdown: { demarche: { score: aptitudePct }, diagnostic: { score: diagScore }, traitement: { score: 0 }, vitesse: { score: 100 } }
                };
                const comp = window.getAnonymousComparison(fakeComposite, ecosState.caseData?.id || 'unknown', 'ecos');
                if (comp.total > 1) {
                    compEl.innerHTML = `
                        <div style="background:rgba(0,0,0,0.2); border-radius:8px; padding:12px; margin-top:10px;">
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
                    compEl.innerHTML = `<div style="background:rgba(0,0,0,0.2); border-radius:8px; padding:12px; text-align:center; margin-top:10px;"><span style="font-size:0.85rem; color:rgba(255,255,255,0.5);">🏁 Première session sur ce cas — rejouez pour voir votre progression !</span></div>`;
                }
            }
        }

        // ── Persistance de la session ECOS ──────────────────────────────
        const ecosSessionStats = {
            mode: 'ecos',
            case_id: ecosState.caseData?.id || 'unknown',
            score: finalScore,
            stars,
            aptitudePct,
            commPct,
            diagScore,
            questionsAsked: ecosState.questionsAsked,
            itemsChecked: checkedApt,
            itemsTotal: totalApt,
            diagSubmitted: ecosState.diagSubmitted || '',
            durationSeconds: Math.round((Date.now() - (ecosState.startedAt || Date.now())) / 1000)
        };

        // LocalStorage pour stats offline et comparaison anonyme
        try {
            const stored = JSON.parse(localStorage.getItem('ecos_sessions') || '[]');
            stored.push({ ...ecosSessionStats, ts: Date.now() });
            // Garder max 200 sessions
            if (stored.length > 200) stored.splice(0, stored.length - 200);
            localStorage.setItem('ecos_sessions', JSON.stringify(stored));
        } catch (e) { console.warn('[ECOS] localStorage write failed:', e); }

        // Supabase si utilisateur connecté
        if (typeof supabase !== 'undefined') {
            supabase.auth.getUser().then(async ({ data: { user } }) => {
                if (!user) return;
                try {
                    // 1. Enregistrer la session
                    await supabase.from('play_sessions').insert([{
                        user_id: user.id,
                        case_id: ecosSessionStats.case_id,
                        score: finalScore,
                        stats: ecosSessionStats,
                        duration_seconds: ecosSessionStats.durationSeconds,
                        mode: 'ecos'
                    }]);

                    // 2. Mettre à jour l'XP global
                    const { data: profile, error: profileErr } = await supabase
                        .from('profiles')
                        .select('total_xp')
                        .eq('id', user.id)
                        .single();

                    if (!profileErr && profile) {
                        const newXp = (profile.total_xp || 0) + finalScore;
                        await supabase
                            .from('profiles')
                            .update({ total_xp: newXp })
                            .eq('id', user.id);
                    }
                } catch (e) { console.warn('[ECOS] Supabase session save / XP update failed:', e); }
            }).catch(() => {});
        }
    }

    async function generateFeedbackNarrative() {
        if (!window.CONFIG?.LLM_API_URL) {
            const missed = ecosState.grilleAptitudes.filter(g => !ecosState.gridChecked.has(g.id));
            if (missed.length === 0) {
                return '<p>Félicitations, vous avez validé l\'ensemble de la démarche clinique ! Votre prise en charge a été rigoureuse.</p>';
            } else {
                return `<p>Démarche clinique correcte, mais vous avez manqué certains points importants comme : ${missed.slice(0, 3).map(g => g.label).join(', ')}. Veillez à couvrir tous les aspects de l'anamnèse.</p>`;
            }
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
            const text = await llmChat([
                { role: 'system', content: 'Tu es un enseignant de médecine bienveillant et exigeant.' },
                { role: 'user', content: prompt }
            ], {
                temperature: ECOS_CONFIG.LLM_TEMP.feedback,
                maxTokens: ECOS_CONFIG.LLM_MAX_TOKENS.feedback,
                timeoutMs: ECOS_CONFIG.LLM_TIMEOUT_MS.feedback
            });
            return escapeHtml(text || '').replace(/\n/g, '<br>');
        } catch (e) {
            console.warn('[ECOS] generateFeedbackNarrative failed:', e);
            if (missed.length === 0) {
                return '<p>Félicitations, vous avez validé l\'ensemble de la démarche clinique ! Votre prise en charge a été rigoureuse.</p>';
            } else {
                return `<p>Démarche clinique correcte, mais vous avez manqué certains points importants comme : ${missed.slice(0, 3).map(g => g.label).join(', ')}. Veillez à couvrir tous les aspects de l'anamnèse.</p>`;
            }
        }
    }

    // ==================== UTILITAIRES ====================

    function formatDuration(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${String(sec).padStart(2, '0')}`;
    }

    function showInStationToast(text, level = 'info') {
        if (typeof window.showNotification === 'function') {
            window.showNotification(text, level);
        } else {
            const toast = document.getElementById('ecos-toast');
            if (!toast) return;
            toast.textContent = text;
            toast.className = `ecos-toast show ${level}`;
            clearTimeout(showInStationToast._t);
            showInStationToast._t = setTimeout(() => toast.classList.remove('show'), 3000);
        }
    }

    function addBeforeUnloadGuard() {
        window.addEventListener('beforeunload', beforeUnloadListener);
    }

    function removeBeforeUnloadGuard() {
        window.removeEventListener('beforeunload', beforeUnloadListener);
    }

    function beforeUnloadListener(e) {
        if (ecosState.active && ecosState.phase === 'station') {
            e.preventDefault();
            e.returnValue = '';
        }
    }

    // ==================== RACCOURCIS CLAVIER GLOBAUX ====================

    document.addEventListener('keydown', (e) => {
        if (!ecosState.active) return;
        
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' || activeTag === 'textarea') {
            if (e.key === 'Escape') {
                document.activeElement.blur();
                e.preventDefault();
            }
            return;
        }

        switch (e.key.toLowerCase()) {
            case 'v':
                e.preventDefault();
                const vignetteEl = document.getElementById('ecos-vignette');
                if (vignetteEl) {
                    hideVignette();
                } else if (ecosState.phase === 'station') {
                    showVignette(ecosState.caseData);
                }
                break;
            case 'p':
                e.preventDefault();
                if (ecosState.phase === 'station') {
                    togglePause();
                }
                break;
            case 'escape':
                e.preventDefault();
                if (document.getElementById('ecos-vignette')) {
                    hideVignette();
                } else if (document.getElementById('ecos-announce-overlay')) {
                    document.getElementById('ecos-announce-overlay').style.display = 'none';
                    restoreFocus();
                    ecosState.phase = 'station';
                }
                break;
            case 's':
                e.preventDefault();
                if (ecosState.phase === 'station') {
                    const endBtn = document.getElementById('ecos-end-btn');
                    if (endBtn) endBtn.click();
                }
                break;
        }
    });

    // ==================== API PUBLIQUE ====================

    function start(caseData) {
        if (!caseData) {
            console.error('[ECOS] caseData est invalide');
            showInStationToast('Impossible de démarrer la station (données de cas absentes).', 'error');
            return;
        }
        ecosState.active = true;
        ecosState.caseData = JSON.parse(JSON.stringify(caseData)); // Copie profonde
        ecosState.phase = 'idle';
        ecosState.gridChecked.clear();
        ecosState.commScores = {};
        ecosState.conversationLog = [];
        ecosState.questionsAsked = 0;
        ecosState.impatienceTriggered = false;
        ecosState.diagSubmitted = null;
        ecosState.announceSubmitted = null;
        ecosState.feedbackNarrative = '';

        if (window.feedbackTimeline) {
            window.feedbackTimeline.reset();
            window.feedbackTimeline.log('section', `Station ECOS démarrée — ${caseData.id}`);
        }

        showVignette(caseData);
    }

    function stop() {
        ecosState.active = false;
        ecosState.phase = 'idle';
        if (ecosState.intervalId) clearInterval(ecosState.intervalId);
        ecosState.intervalId = null;
        removeBeforeUnloadGuard();
        hideVignette();
        destroyStationLayout();
        const announce = document.getElementById('ecos-announce-overlay');
        if (announce) announce.remove();
        const debrief = document.getElementById('ecos-debrief-overlay');
        if (debrief) debrief.remove();
    }

    function pauseEcosTimers() {
        if (ecosState.intervalId) clearInterval(ecosState.intervalId);
        ecosState.intervalId = null;
    }

    function resumeEcosTimers() {
        if (ecosState.phase !== 'station') return;
        if (!ecosState.intervalId) {
            ecosState.intervalId = setInterval(() => {
                const left = getTimeLeft();
                if (left <= 0) {
                    onStationEnd();
                } else if (left === ECOS_CONFIG.WARNING_AT) {
                    if (window.MedGameAudio) window.MedGameAudio.play('ecosBell');
                    showInStationToast(`⏰ 1 minute restante`, 'warning');
                }
                const idleFor = (Date.now() - ecosState.lastUserActivityAt) / 1000;
                if (!ecosState.impatienceTriggered && idleFor >= ECOS_CONFIG.PATIENT_IMPATIENCE_AFTER) {
                    ecosState.impatienceTriggered = true;
                    triggerPatientImpatience();
                }
            }, 1000);
        }
    }

    function tick() {
        const left = getTimeLeft();
        const m = Math.floor(left / 60);
        const s = left % 60;
        const formatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

        // Mettre à jour tous les compteurs de l'application
        const chrono = document.getElementById('ecos-chrono');
        if (chrono) {
            chrono.textContent = formatted;
            chrono.classList.toggle('critical', left <= 60);
            chrono.classList.toggle('warning', left <= 120 && left > 60);
        }

        const timer2d = document.getElementById('timer');
        if (timer2d) {
            timer2d.textContent = formatted;
            timer2d.classList.toggle('critical', left <= 60);
            timer2d.classList.toggle('warning', left <= 120 && left > 60);
        }

        const timerMobile = document.getElementById('mobile-timer');
        if (timerMobile) {
            timerMobile.textContent = formatted;
        }

        const timerHud = document.getElementById('hud-timer');
        if (timerHud) {
            timerHud.textContent = formatted;
            timerHud.classList.toggle('critical', left <= 60);
            timerHud.classList.toggle('warning', left <= 120 && left > 60);
        }
    }

    function checkItemByFieldPath(fieldPath) {
        if (!fieldPath) return;
        const grille = ecosState.grilleAptitudes;
        const reqLower = normalizeString(fieldPath);
        let checkedAny = false;
        grille.forEach(g => {
            const paths = getPathsForEcosId(g.id);
            if (paths.includes(fieldPath)) {
                if (!ecosState.gridChecked.has(g.id)) {
                    ecosState.gridChecked.add(g.id);
                    checkedAny = true;
                    if (window.feedbackTimeline) {
                        window.feedbackTimeline.log('section', `Item validé (action/clic) : ${g.label}`);
                    }
                }
            }
        });
        if (checkedAny) {
            updateGrilleUI();
            if (window.MedGameAudio) window.MedGameAudio.play('correct');
        }
    }

    function checkItemByExamName(examName) {
        if (!examName) return;
        const grille = ecosState.grilleAptitudes;
        const reqLower = normalizeString(examName);
        let checkedAny = false;
        grille.forEach(g => {
            const normId = normalizeString(g.id);
            const normLabel = normalizeString(g.label);
            const isExamItem = g.id.startsWith('examen_') || g.id.startsWith('examen-') || g.id.includes('ecg') || g.id.includes('biologie') || g.id.includes('imagerie') || g.id.includes('strategie_diagnostique');
            if (isExamItem && (normId.includes(reqLower) || normLabel.includes(reqLower) || (g.triggerKeywords && g.triggerKeywords.some(k => reqLower.includes(normalizeString(k)))))) {
                if (!ecosState.gridChecked.has(g.id)) {
                    ecosState.gridChecked.add(g.id);
                    checkedAny = true;
                    if (window.feedbackTimeline) {
                        window.feedbackTimeline.log('section', `Item d'examen validé : ${g.label}`);
                    }
                }
            }
        });
        if (checkedAny) {
            updateGrilleUI();
            if (window.MedGameAudio) window.MedGameAudio.play('correct');
        }
    }

    // ==================== EXPORT ====================

    window.EcosMode = {
        start,
        stop,
        pause: pauseStation,
        resume: resumeStation,
        isActive: () => ecosState.active,
        getPhase: () => ecosState.phase,
        getGrille: () => ({
            aptitudes: Array.from(ecosState.gridChecked),
            comm: { ...ecosState.commScores }
        }),
        classifyAndCheck,
        checkItemByFieldPath,
        checkItemByExamName,
        CONFIG: ECOS_CONFIG
    };
})();
