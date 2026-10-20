/**
 * js/clinicalAgentAI.js — Agent de Réanimation et Directeur Clinique (Game Master)
 * 
 * Ce script permet au joueur de prescrire et d'agir librement en texte au sein du mode 3D.
 * Il intercepte les actions, consulte l'IA d'OpenRouter, adapte la physiologie,
 * contrôle les expressions faciales et respiratoires 3D, joue des sons,
 * met à jour le score et instancie des modèles 3D procéduraux (Assets Spawner) à la volée !
 */

class ClinicalAgentAI {
    constructor() {
        this.isActive = true;
        this.history = [];   // Mémoire conversationnelle complète (user/assistant)
        this.caseId = null;  // Détection de changement de cas → reset mémoire
        this.injectStyles();
        this.initHooks();
        console.info('[ClinicalAgentAI] Initialisé avec succès !');
    }

    /**
     * Injecte des styles CSS premium pour les cartes d'intervention et le loading
     */
    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Bulles d'actions cliniques du Directeur Clinique (Game Master) */
            .dialog-msg-bubble.clinical-action-card {
                background: linear-gradient(135deg, rgba(20, 35, 75, 0.75), rgba(10, 18, 40, 0.85)) !important;
                border: 1px solid rgba(0, 242, 254, 0.4) !important;
                box-shadow: 0 4px 15px rgba(0, 242, 254, 0.15), 0 0 10px rgba(0, 242, 254, 0.05) !important;
                border-radius: 12px !important;
                padding: 10px 14px !important;
                color: #e0f7fc !important;
                backdrop-filter: blur(8px);
                position: relative;
            }
            .dialog-msg-bubble.clinical-action-card strong {
                color: #00f2fe !important;
                font-family: 'Outfit', sans-serif;
            }
            /* Animation pulse pour le loading */
            .clinical-action-loading .dialog-msg-bubble {
                animation: actionCardPulse 1.5s infinite ease-in-out;
            }
            @keyframes actionCardPulse {
                0% { opacity: 0.7; transform: scale(0.99); }
                50% { opacity: 1.0; transform: scale(1.0); }
                100% { opacity: 0.7; transform: scale(0.99); }
            }
            /* Carte action pour le dialogue 2D */
            .dialogue-message.clinical-action-card-2d {
                background: rgba(0, 242, 254, 0.08) !important;
                border-left: 4px solid #00f2fe !important;
                border-radius: 6px;
                padding: 8px 12px;
                margin: 6px 0;
                color: #e0f7fc;
                font-size: 0.88rem;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Initialise les hooks de démarrage du mode 3D
     */
    initHooks() {
        const self = this;

        // Si le ThreeManager est déjà initialisé
        if (window.threeManager) {
            this.hookThreeManager(window.threeManager);
        } else {
            // Surveiller l'assignation de window.threeManager
            let originalThreeManager = null;
            Object.defineProperty(window, 'threeManager', {
                get() { return originalThreeManager; },
                set(val) {
                    originalThreeManager = val;
                    if (val) self.hookThreeManager(val);
                },
                configurable: true
            });
        }
    }

    /**
     * Applique les patches sur les méthodes d'initialisation du mode 3D
     */
    hookThreeManager(manager) {
        const self = this;
        console.info('[ClinicalAgentAI] Hooking sur threeManager...');

        // Si le HUD est déjà disponible
        if (manager.hud) {
            this.hookHUDChat(manager.hud);
        }

        // Intercepter l'activation/initialisation de la 3D
        const originalEnable3D = manager.enable3D.bind(manager);
        manager.enable3D = async function(container) {
            const res = await originalEnable3D(container);
            if (manager.hud) {
                self.hookHUDChat(manager.hud);
            }
            return res;
        };
    }

    /**
     * Intercepte la console de chat de l'interface immersive 3D
     */
    hookHUDChat(hudInstance) {
        const chat = window.patientChat;
        if (!chat) return;

        const self = this;

        // Éviter de re-hooker
        if (hudInstance._clinicalHooked) return;
        hudInstance._clinicalHooked = true;

        // Conserver la fonction ask surchargée par le HUD 3D
        const originalHUDAsk = chat.ask.bind(chat);

        chat.ask = async function(question) {
            if (!question?.trim()) return;
            if (chat.isAsking) {
                console.warn("[ClinicalAgentAI] Already waiting for patient response, ignoring input.");
                return;
            }

            // Routage via TypeSafe System One (Jev)
            const router = window.JevClient;
            let routing = null;
            if (router && typeof router.routeMessage === 'function') {
                routing = await router.routeMessage(question);
            } else {
                // Repli transparent vers le patient
                routing = { toPatient: true, actions: [] };
            }

            // 1. Executer toutes les actions cliniques identifiees par Jev dans l'ordre
            if (routing.actions && routing.actions.length > 0) {
                for (const action of routing.actions) {
                    await self.processClinicalAction3D(question, hudInstance, {
                        role: action.role,
                        actionType: action.type,
                        discipline: action.discipline,
                        skipUserAppend: routing.toPatient
                    });
                }
            }

            // 2. Si le message concerne le patient (ou repli par defaut), generer la reponse du patient
            if (routing.toPatient) {
                await originalHUDAsk(question);
            }
        };

        // Rendre les placeholders de saisie extremement incitatifs et premiums
        const input3d = document.getElementById('dialog-input-3d');
        if (input3d) {
            input3d.placeholder = "Posez une question ou ordonnez une intervention (ex: Injecter de l'Aspirine)...";
        }
        const input2d = document.getElementById('dialogue-input');
        if (input2d) {
            input2d.placeholder = "Posez une question ou ordonnez une intervention libre...";
        }

        console.info('[ClinicalAgentAI] Chat 3D intercepte avec le routeur Jev !');
    }

    /**
     * Traite l'action clinique libre au sein de l'environnement 3D
     */
    async processClinicalAction3D(actionText, hudInstance, options = {}) {
        console.info(`[ClinicalAgentAI] Traitement de l'action libre : "${actionText}" (options: ${JSON.stringify(options)})`);
        
        // 1. Ajouter le message du joueur dans le dialogue si non deja ajoute
        const chat = window.patientChat;
        if (!options.skipUserAppend) {
            chat.append('Vous', actionText);
            chat.messages.push({ role: 'user', content: actionText });
        }

        const role = options.role || 'Directeur Clinique';

        // 2. Afficher la carte d'action glassmorphism en attente
        const messages3d = document.getElementById('dialog-messages-3d');
        let loadingCard = null;
        if (messages3d) {
            loadingCard = document.createElement('div');
            loadingCard.className = 'from-assistant clinical-action-loading';
            loadingCard.innerHTML = `
                <div class="dialog-msg-assistant">
                    <span class="dialog-msg-avatar">🩺</span>
                    <div class="dialog-msg-bubble clinical-action-card">
                        <strong class="clinical-role-title">${role} :</strong><br>
                        <span class="dialog-msg-text"><em>Analyse et préparation de l'intervention en cours...</em></span>
                    </div>
                </div>
            `;
            messages3d.appendChild(loadingCard);
            messages3d.scrollTop = messages3d.scrollHeight;
        }

        // Préparer les données cliniques du cas
        const caseData = window.gameState?.currentCase || {};
        const patient = caseData.patient || {};
        const vitals = window.vitalSigns?.props || {};

        // Reset mémoire si nouveau cas
        if (this.caseId !== caseData.id) {
            this.history = [];
            this.caseId = caseData.id;
            console.log(`[ClinicalAgentAI] Nouveau cas (${caseData.id || '?'}), mémoire réinitialisée`);
        }

        // 3. Obtenir la réponse (Groq API avec Fallback local)
        let responseJson = null;
        let lastError = null;

        const modelsToTry = [
            window.CONFIG?.LLM_MODEL || 'llama-3.3-70b-versatile'
        ].filter((m, i, self) => self.indexOf(m) === i);

        for (const modelToTry of modelsToTry) {
            try {
                // Créer une promesse de timeout de 8 secondes par modèle
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`Timeout OpenRouter (${modelToTry})`)), 8000)
                );

                console.log(`[ClinicalAgentAI] Tentative d'action avec le modèle : ${modelToTry}`);
                const fetchPromise = this.callOpenRouterClinicalDirector(actionText, caseData, vitals, modelToTry);
                responseJson = await Promise.race([fetchPromise, timeoutPromise]);
                
                // Sauvegarder le modèle fonctionnel pour toute la session
                if (window.CONFIG) {
                    window.CONFIG.LLM_MODEL = modelToTry;
                }
                break; // Réussite !
            } catch (err) {
                console.warn(`[ClinicalAgentAI] Échec de l'action avec ${modelToTry} :`, err.message);
                // Quota épuisé : ne pas essayer d'autres modèles, propager l'erreur typée
                if (err?.code === 'QUOTA_EXCEEDED' || window.QuotaGuard?.isQuotaError?.(err)) throw err;
                lastError = err;
            }
        }

        if (!responseJson) {
            // Quota épuisé : propager l'erreur pour afficher la modale login/mailto
            if (lastError && (lastError.code === 'QUOTA_EXCEEDED' || window.QuotaGuard?.isQuotaError?.(lastError))) {
                throw lastError;
            }
            console.error('[ClinicalAgentAI] Tous les modèles d\'analyse clinique ont échoué.');
            responseJson = {
                isAction: true,
                profession: role,
                clinicalResponse: `⚠️ [Erreur : Impossible d'analyser l'action via l'IA (Tous les modèles ont échoué : ${lastError?.message || 'Erreur inconnue'}). Veuillez vérifier votre connexion et votre clé API.]`,
                patientVerbatim: "",
                vitalChanges: { ...vitals },
                expressionChange: "normal",
                respiratoryPattern: "normal",
                scoringChange: { type: "unnecessary", treatmentName: null },
                spawnAsset: null,
                soundToPlay: "incorrect"
            };
        }

        // 4. Supprimer le loading et formater la bulle finale
        if (loadingCard) {
            loadingCard.classList.remove('clinical-action-loading');
            const textSpan = loadingCard.querySelector('.dialog-msg-text');
            const titleStrong = loadingCard.querySelector('.clinical-role-title');
            
            const finalRole = responseJson?.profession || role;
            if (titleStrong) {
                titleStrong.textContent = `${finalRole} :`;
            }
            if (textSpan && responseJson) {
                let cleanResponse = responseJson.clinicalResponse;
                const prefixRegex = new RegExp(`^(${finalRole}|Directeur Clinique|Radiologue|Infirmier|Infirmière|Biologiste|Médecin Réanimateur|Cardiologue|Intervention)\\s*:\\s*`, 'i');
                cleanResponse = cleanResponse.replace(prefixRegex, '').trim();

                // Sortie LLM : injection textuelle (jamais innerHTML — anti-XSS)
                textSpan.textContent = cleanResponse;
            }
        }

        if (!responseJson) return;

        // 5. Exécuter toutes les conséquences environnementales et physiologiques

        // A. Spawner d'Asset 3D
        if (responseJson.spawnAsset) {
            this.spawn3DAsset(responseJson.spawnAsset);
        }

        // B. Constantes Physiologiques
        if (responseJson.vitalChanges) {
            this.applyPhysiologicalChanges(responseJson.vitalChanges);
        }

        // C. Expressions faciales et respiratoires 3D du Patient
        if (responseJson.expressionChange && hudInstance?._applyFacialExpression) {
            hudInstance._applyFacialExpression(responseJson.expressionChange, 0.8);
        }
        if (responseJson.respiratoryPattern && window.threeManager?.scene?.patientAnimator?.setRespirationPattern) {
            window.threeManager.scene.patientAnimator.setRespirationPattern(responseJson.respiratoryPattern);
        }

        // D. Verbatim du patient (parole réactive) — désactivé si l'on souhaite que le LLM réponde lui-même à la place
        if (!options.skipVerbatim && responseJson.patientVerbatim?.trim()) {
            // Sortie LLM : échappement systématique (anti-XSS)
            const verbatim = escapeHtml(responseJson.patientVerbatim.trim());
            setTimeout(() => {
                if (messages3d) {
                    const row = document.createElement('div');
                    row.className = 'from-patient';
                    row.innerHTML = `
                        <div class="dialog-msg-patient">
                            <span class="dialog-msg-avatar">🗣️</span>
                            <div class="dialog-msg-bubble" style="border-left:3px solid #ff9f43;">
                                <span class="dialog-msg-text"><strong>Patient :</strong> « ${verbatim} »</span>
                            </div>
                        </div>
                    `;
                    messages3d.appendChild(row);
                    messages3d.scrollTop = messages3d.scrollHeight;
                }
                // Sync vers 2D
                const root2d = document.getElementById('dialogue-messages');
                if (root2d) {
                    const r = document.createElement('div');
                    r.className = 'dialogue-message from-patient';
                    r.innerHTML = `<strong>Patient : </strong><span>« ${verbatim} »</span>`;
                    root2d.appendChild(r);
                    root2d.scrollTop = root2d.scrollHeight;
                }
                chat.messages.push({ role: 'assistant', content: `Patient : ${responseJson.patientVerbatim}` });
            }, 1000);
        }

        // E. Audio & Bip ECG
        if (responseJson.soundToPlay && window.medicalAudio) {
            if (responseJson.soundToPlay === 'correct') {
                window.medicalAudio.playSuccessSound();
            } else if (responseJson.soundToPlay === 'incorrect') {
                window.medicalAudio.playErrorSound();
            } else if (responseJson.soundToPlay === 'alarm') {
                window.medicalAudio.startAlarm('critical');
            }
        }

        // F. Intégration du Score Clinique et de la Timeline de Feedback
        if (responseJson.scoringChange && window.scoringState) {
            const sc = responseJson.scoringChange;
            if (sc.treatmentName) {
                // Résoudre intelligemment le nom libre vers le nom canonique du cas pour le scoring exact
                let canonicalName = sc.treatmentName;
                const allCaseTreatments = [
                    ...(caseData.correctTreatments || []),
                    ...(caseData.secondLineTreatments || []),
                    ...(caseData.fatalTreatments || []),
                    ...(caseData.possibleTreatments || [])
                ];
                const match = allCaseTreatments.find(t => 
                    t.toLowerCase().trim() === sc.treatmentName.toLowerCase().trim() ||
                    t.toLowerCase().trim().includes(sc.treatmentName.toLowerCase().trim()) ||
                    sc.treatmentName.toLowerCase().trim().includes(t.toLowerCase().trim())
                );
                if (match) {
                    canonicalName = match;
                }

                // Ajouter à la liste des prescriptions pour calcul final
                if (!window.scoringState.selectedTreatments.includes(canonicalName)) {
                    window.scoringState.selectedTreatments.push(canonicalName);
                }

                // Enregistrer dans la chronologie de correction
            }
        }

        // G. Synchronisation complète vers le log de dialogue 2D
        const root2d = document.getElementById('dialogue-messages');
        const finalRoleForLog = responseJson?.profession || role;
        let cleanResponseForLog = responseJson?.clinicalResponse || '';
        const prefixRegexForLog = new RegExp(`^(${finalRoleForLog}|Directeur Clinique|Radiologue|Infirmier|Infirmière|Biologiste|Médecin Réanimateur|Cardiologue|Intervention)\\s*:\\s*`, 'i');
        cleanResponseForLog = cleanResponseForLog.replace(prefixRegexForLog, '').trim();

        if (root2d) {
            const card2d = document.createElement('div');
            card2d.className = 'dialogue-message clinical-action-card-2d';
            // Sortie LLM : injection textuelle (jamais innerHTML — anti-XSS)
            const roleStrong = document.createElement('strong');
            roleStrong.textContent = `🩺 ${finalRoleForLog} : `;
            const bodySpan = document.createElement('span');
            bodySpan.textContent = cleanResponseForLog;
            card2d.append(roleStrong, bodySpan);
            root2d.appendChild(card2d);
            root2d.scrollTop = root2d.scrollHeight;
        }

        // Ajouter à l'historique assistant
        chat.messages.push({ role: 'assistant', content: `${finalRoleForLog} : ${cleanResponseForLog}` });
    }

    /**
     * Appelle l'API d'OpenRouter avec un prompt de type Directeur Clinique / GM
     */
    async callOpenRouterClinicalDirector(action, caseData, vitals, modelOverride) {
        const endpoint = window.CONFIG?.LLM_API_URL || '/.netlify/functions/llm-proxy';
        const model = modelOverride || window.CONFIG?.LLM_MODEL || 'llama-3.3-70b-versatile';
        const apiKey = window.CONFIG?.LLM_API_KEY || '';

        const correctTreatments = caseData.correctTreatments || [];
        const fatalTreatments = caseData.fatalTreatments || [];
        const correctDiagnostic = caseData.correctDiagnostic || '';
        const patient = caseData.patient || { nom: 'Inconnu', age: '50', sexe: 'M' };

        const allergies = caseData.interrogatoire?.allergies || { presence: false, liste: [] };
        let allergiesText = 'Aucune allergie connue.';
        if (allergies.presence && allergies.liste?.length > 0) {
            allergiesText = 'Allergies du patient (DANGER DE MORT / CHOC ANAPHYLACTIQUE ULTRA-GRAVE SI APPLIQUÉ DANS L\'ACTION) : ' + 
                allergies.liste.map(a => typeof a === 'string' ? a : a.allergene).join(', ');
        }

        const systemPrompt = `Tu es le "Directeur Clinique / Game Master" (Maître du Jeu) d'une simulation médicale d'urgences réelles en 3D.
Le joueur est le médecin réanimateur. Chaque message utilisateur contient l'action clinique libre qu'il vient de saisir.

Actuellement, le patient présente le cas clinique suivant :
- Patient : ${patient.nom}, ${patient.age} ans, ${patient.sexe}
- Diagnostic correct attendu : ${correctDiagnostic}
- Traitements de référence attendus : ${correctTreatments.join(', ')}
- Traitements contre-indiqués / fatals : ${fatalTreatments.join(', ')}
- Allergies connues du patient : ${allergiesText}

═══ RÈGLE DE SÉCURITÉ CRITIQUE : INTERDICTION DE SPOILER LE DIAGNOSTIC ════════
1. Tu ne dois JAMAIS mentionner explicitement le diagnostic attendu ("${correctDiagnostic}") dans la réponse narrative ('clinicalResponse') ou les paroles du patient ('patientVerbatim'), SAUF si le joueur l'a lui-même explicitement nommé dans son action.
2. Décris uniquement les constatations cliniques objectives, les effets des traitements, ou les résultats d'examens techniques. Ne dis pas "Dans le contexte de [diagnostic]" ou "Ce n'est pas le traitement de [diagnostic]". Sois neutre et factuel.

═══ DIRECTIVE ABSOLUE SUR LES ALLERGIES ════════════════
Si l'action du joueur consiste à administrer, perfuser ou injecter un allergène connu du patient (ex: Poisson, Pénicilline, etc. selon la liste ci-dessus), le patient doit IMMÉDIATEMENT faire un CHOC ANAPHYLACTIQUE FOUDROYANT.
Dans ce cas précis, tu dois obligatoirement renvoyer :
- vitalChanges: heartRate > 140 bpm, systolic < 60 mmHg, diastolic < 35 mmHg, spo2 < 75%
- expressionChange: "cyanose"
- respiratoryPattern: "agonal"
- soundToPlay: "alarm"
- scoringChange: { "type": "fatal", "treatmentName": "Allergène administré" }
- clinicalResponse: "Description narrative dramatique en français du choc anaphylactique fulgurant provoqué par l'allergène injecté !"
- profession: "Infirmier / Infirmière"

═══ DIRECTIVE SUR LES EXAMENS DIAGNOSTIQUES (REQUIS) ════════════════
Si le joueur demande un examen diagnostique (par exemple : une radiographie/radio, un ECG/électrocardiogramme, une prise de sang/bilan biologique/analyses, un scanner/CT-scan, des gaz du sang/GDS, une échographie, etc.) :
1. Tu dois OBLIGATOIREMENT générer de toutes pièces un résultat clinique d'examen ultra-réaliste, complet, technique et adapté au diagnostic du patient (${correctDiagnostic}) et à son état actuel. Ne donne pas de réponse générique comme "Vous effectuez l'examen...".
2. Si le cas clinique définit déjà ce résultat dans ses données d'examens (ex: ${JSON.stringify(caseData.examResults || {})}), tu dois t'en inspirer très fortement ou le reprendre pour rester parfaitement cohérent avec le scénario.
3. Rentre dans les détails techniques et médicaux réels (ex: sibilants expiratoires, foyer d'infiltrat alvéolaire, aplatissement des coupoles, sus-décalage convexe du segment ST en V2-V4, onde S1Q3T3, pH, PaO2, PaCO2, hyperkaliémie, etc.).
4. La clé 'profession' doit être définie sur le spécialiste qui réalise/interprète l'examen (ex: 'Radiologue' pour une radio/scanner/échographie, 'Biologiste' pour un bilan biologique/sang/GDS, 'Médecin Réanimateur' ou 'Cardiologue' pour un ECG ou une auscultation).

Les constantes vitales courantes du patient mesurées au scope sont :
- Fréquence Cardiaque (FC) : ${vitals.heartRate || vitals.pouls || '75'} bpm
- Tension Artérielle (TA) : ${vitals.systolic || '120'}/${vitals.diastolic || '80'} mmHg
- Saturation en Oxygène (SpO2) : ${vitals.spo2 || vitals.saturationO2 || '97'} %
- Fréquence Respiratoire (FR) : ${vitals.respiratoryRate || '16'} /min
- Température (T°) : ${vitals.temperature || '37'} °C

HISTORIQUE DES ACTIONS PRÉCÉDENTES (pour la continuité — ne contredis JAMAIS ce qui a déjà été administré ou constaté) :
${this.history.length ? this.history.slice(-20).map(m => `- ${m.role === 'user' ? 'Médecin' : 'Maître'}: ${m.content}`).join('\n') : '(début de la prise en charge — aucune action précédente)'}

Analyse l'action du joueur médicalement de façon réaliste et décide de ses conséquences immédiates sur la physiologie et l'environnement 3D.
Retourne UNIQUEMENT et STRICTEMENT un objet JSON (sans texte explicatif avant ou après, pas de balises markdown) contenant EXACTEMENT les clés suivantes :
{
  "isAction": true,
  "profession": "Infirmier / Infirmière", // Rôle du soignant effectuant l'action ou interprétant l'examen. Choix parmi : 'Infirmier / Infirmière' (médicaments, perfusion, masque O2, blanket), 'Radiologue' (radio, scanner, écho), 'Biologiste' (bilan sanguin, GDS), 'Médecin Réanimateur' (auscultation, ECG, massage, DSA, intubation), 'Directeur Clinique' (défaut).
  "clinicalResponse": "Description narrative élégante en français (1 à 3 sentences) des conséquences cliniques ou du résultat d'examen détaillé.",
  "patientVerbatim": "Paroles en français du patient s'il est conscient, ou chaine vide s'il est inconscient, trop essoufflé, ou s'il s'agit d'un rapport technique écrit d'examen.",
  "vitalChanges": {
    "heartRate": 85,
    "systolic": 120,
    "diastolic": 80,
    "spo2": 98,
    "temperature": 37.0,
    "respiratoryRate": 16
  },
  "expressionChange": "normal", // Parmi : 'normal', 'douleur', 'anxieux', 'pale', 'cyanose', 'fievre', 'sueur', 'etonne', 'talking'
  "respiratoryPattern": "normal", // Parmi : 'normal', 'tachypnea', 'bradypnea', 'dyspnea', 'agonal', 'cheyneStokes'
  "scoringChange": {
    "type": "firstLine", // Parmi : 'firstLine' (de référence), 'secondLine' (acceptable), 'unnecessary' (inutile), 'fatal' (erreur médicale dangereuse)
    "treatmentName": "Trinitrine IV" // Nom canonique du traitement (strictement un élément parmi les traitements de référence ou fatals s'il correspond, ou nom simple de l'action/examen)
  },
  "spawnAsset": "perfusion", // Clé de l'asset 3D à spawner si applicable. Parmi : 'defibrillateur', 'electrodes', 'oxygen_mask', 'perfusion', 'seringue', 'couverture', null
  "soundToPlay": "correct" // Parmi : 'correct', 'incorrect', 'alarm', null
}`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
                ...(window.QuotaGuard?.getUserTokenSync?.()
                    ? { 'X-User-Token': window.QuotaGuard.getUserTokenSync() }
                    : {})
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    // Mémoire conversationnelle : fenêtre glissante (20 derniers messages)
                    ...this.history.slice(-20),
                    { role: 'user', content: action }
                ],
                stream: false,
                temperature: 0.1, // Basse température pour forcer la structure JSON
                max_tokens: 450,
                // Classe quota : action de jeu = dialogue (compté). Strippé par le proxy.
                meta: { kind: 'dialogue' }
            })
        });

        if (!response.ok) {
            let quotaInfo = null;
            try {
                const j = await response.clone().json();
                if (j && j.code === 'QUOTA_EXCEEDED') quotaInfo = j;
            } catch (_) {}
            if (quotaInfo) {
                const err = new Error('Quota de messages épuisé.');
                err.code = 'QUOTA_EXCEEDED';
                err.reason = quotaInfo.reason || 'quota';
                err.remaining_day = quotaInfo.remaining_day ?? null;
                err.remaining_week = quotaInfo.remaining_week ?? null;
                err.contactEmail = quotaInfo.email || null;
                throw err;
            }
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        let content = data.choices?.[0]?.message?.content || '';
        content = content.trim();

        // Nettoyer les balises Markdown éventuelles du JSON
        if (content.startsWith('```json')) {
            content = content.substring(7, content.length - 3);
        } else if (content.startsWith('```')) {
            content = content.substring(3, content.length - 3);
        }

        // Commit mémoire — uniquement après un tour réussi (rollback-safe)
        let parsedResult = null;
        try {
            parsedResult = JSON.parse(content.trim());
        } catch (e) {
            throw e;
        }
        this.history.push({ role: 'user', content: action });
        this.history.push({ role: 'assistant', content: `${parsedResult.clinicalResponse || ''}${parsedResult.patientVerbatim ? ` Patient: « ${parsedResult.patientVerbatim} »` : ''}`.trim() });
        return parsedResult;
    }

    /**
     * Applique les modifications physiologiques au scope et HUD
     */
    applyPhysiologicalChanges(changes) {
        if (window.vitalSigns) {
            // Mettre à jour les propriétés du moniteur
            for (const key in changes) {
                // Adapter la dénomination interne du moniteur
                if (key === 'heartRate') {
                    window.vitalSigns.props.heartRate = changes[key];
                    window.vitalSigns.props.pouls = `${changes[key]} bpm`;
                    // Adapter également le bip sonore ECG cardiaque en temps réel !
                    // `startECGBeep` reprogramme la cadence du bip ET celle du
                    // cœur : les deux restent sur le même métronome.
                    if (window.medicalAudio) {
                        window.medicalAudio.startECGBeep(changes[key]);
                    }
                } else if (key === 'systolic') {
                    window.vitalSigns.props.systolic = changes[key];
                    window.vitalSigns.props.tension = `${changes[key]}/${window.vitalSigns.props.diastolic || 80} mmHg`;
                } else if (key === 'diastolic') {
                    window.vitalSigns.props.diastolic = changes[key];
                    window.vitalSigns.props.tension = `${window.vitalSigns.props.systolic || 120}/${changes[key]} mmHg`;
                } else if (key === 'spo2') {
                    window.vitalSigns.props.spo2 = changes[key];
                    window.vitalSigns.props.saturationO2 = `${changes[key]}%`;
                } else if (key === 'temperature') {
                    window.vitalSigns.props.temperature = changes[key];
                } else if (key === 'respiratoryRate') {
                    window.vitalSigns.props.respiratoryRate = changes[key];
                } else {
                    window.vitalSigns.props[key] = changes[key];
                }
            }

            // Rafraîchir l'affichage du scope 2D
            if (typeof window.vitalSigns.updateDisplay === 'function') {
                window.vitalSigns.updateDisplay();
            }
        }

        // Rafraîchir l'affichage de la télémétrie 3D HUD
        if (window.threeManager?.hud?._updateVitals) {
            window.threeManager.hud._updateVitals();
        }

        // Un seul envoi de toutes les constantes à la couche audio et à la
        // partition adaptative. Avant, seule la fréquence cardiaque était
        // transmise : une désaturation du LLM ne changeait rien au son.
        if (window.MedGameMedical) {
            const v = window.vitalSigns?.props || {};
            const num = (val, fb) => {
                const m = String(val ?? '').match(/-?\d+(\.\d+)?/);
                return m ? parseFloat(m[0]) : fb;
            };
            MedGameMedical.applyVitals({
                hr: num(v.heartRate ?? v.pouls, 72),
                spo2: num(v.spo2 ?? v.saturationO2, 98),
                rr: num(v.respiratoryRate, 14),
                systolic: num(v.systolic, 120),
                temperature: num(v.temperature, 37)
            });
        }
        if (window.MedGameAmbience && window.MedGameAmbience.isRunning()) {
            const v = window.vitalSigns?.props || {};
            const num = (val, fb) => {
                const m = String(val ?? '').match(/-?\d+(\.\d+)?/);
                return m ? parseFloat(m[0]) : fb;
            };
            const spo2 = num(v.spo2 ?? v.saturationO2, 98);
            const hr = num(v.heartRate ?? v.pouls, 72);
            MedGameAmbience.setVitals({ spo2, hr, systolic: num(v.systolic, 120) });
            MedGameAmbience.setState(
                (spo2 < 92 || hr > 120) ? 'critical' : (spo2 < 97 || hr > 100) ? 'tense' : 'calm'
            );
        }
    }

    /**
     * Génère et injecte un modèle 3D modélisé procéduralement dans la scène 3D
     */
    spawn3DAsset(assetType) {
        if (!window.threeManager?.scene?.scene) return;
        
        const scene = window.threeManager.scene.scene;
        const patientGroup = window.threeManager.scene.patient?.group;
        
        // Namespace three.js. `clinicalAgentAI.js` est un script CLASSIQUE :
        // il ne peut pas faire `import * as THREE from 'three'`.
        // L'ancien code faisait `window.THREE || scene.__proto__.constructor` :
        // `window.THREE` n'existe nulle part dans ce dépôt (le global THREE est
        // interdit par convention), et le repli résolvait la classe `Scene` —
        // donc `new THREE.Group()` levait un TypeError.
        // Le Proxy est fourni par three-manager.js, qui n'a chargé three.js
        // que si la scène existe (condition vérifiée ci-dessus).
        const THREE = window.threeManager?.THREE;
        if (!THREE) return;

        // Éviter de spawner deux fois le même objet
        const existing = scene.getObjectByName(`spawned_${assetType}`) || patientGroup?.getObjectByName(`spawned_${assetType}`);
        if (existing) return;

        console.info(`[ClinicalAgentAI] Spawner d'Asset 3D : Génération de "${assetType}"...`);

        // --- A. DÉFIBRILLATEUR ---
        if (assetType === 'defibrillateur') {
            const defibrillateur = new THREE.Group();
            defibrillateur.name = 'spawned_defibrillateur';
            defibrillateur.position.set(-2.0, 0.855, -0.85); // Posé sur le chariot

            // Coque principale rouge
            const shellGeom = new THREE.BoxGeometry(0.2, 0.22, 0.16);
            const shellMat = new THREE.MeshStandardMaterial({ color: 0xff3333, metalness: 0.3, roughness: 0.4 });
            const shell = new THREE.Mesh(shellGeom, shellMat);
            shell.castShadow = true;
            defibrillateur.add(shell);

            // Écran émissif vert brillant
            const screenGeom = new THREE.PlaneGeometry(0.14, 0.1);
            const screenMat = new THREE.MeshStandardMaterial({
                color: 0x00ff66,
                emissive: 0x00ff66,
                emissiveIntensity: 0.7,
                roughness: 0.1
            });
            const screen = new THREE.Mesh(screenGeom, screenMat);
            screen.position.set(0, 0.03, 0.081);
            defibrillateur.add(screen);

            // Palettes de choc noires
            const paddleGeom = new THREE.BoxGeometry(0.03, 0.05, 0.03);
            const paddleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
            const paddleL = new THREE.Mesh(paddleGeom, paddleMat);
            paddleL.position.set(-0.05, -0.05, 0.082);
            const paddleR = paddleL.clone();
            paddleR.position.x = 0.05;
            defibrillateur.add(paddleL, paddleR);

            scene.add(defibrillateur);

            // Animation d'entrée fluide avec GSAP
            if (window.gsap) {
                defibrillateur.scale.set(0, 0, 0);
                window.gsap.to(defibrillateur.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'back.out(1.7)' });
            }
            if (window.showNotification) window.showNotification('🔌 Défibrillateur posé sur le chariot.', 'info');
        }
        // --- B. ÉLECTRODES ECG ---
        else if (assetType === 'electrodes' && patientGroup) {
            const electrodesGroup = new THREE.Group();
            electrodesGroup.name = 'spawned_electrodes';

            // Trois points de monitoring (Rouge, Jaune, Vert)
            const positions = [
                new THREE.Vector3(0.06, 0.12, 0.1),
                new THREE.Vector3(-0.06, 0.12, 0.1),
                new THREE.Vector3(0.0, 0.08, 0.15)
            ];
            const colors = [0xff3333, 0xfff000, 0x00ff33];

            positions.forEach((pos, idx) => {
                const elecGeom = new THREE.CylinderGeometry(0.014, 0.014, 0.004, 8);
                const elecMat = new THREE.MeshStandardMaterial({
                    color: colors[idx],
                    roughness: 0.2,
                    emissive: colors[idx],
                    emissiveIntensity: 0.4
                });
                const elec = new THREE.Mesh(elecGeom, elecMat);
                elec.position.copy(pos);
                elec.rotation.x = Math.PI / 2;
                electrodesGroup.add(elec);
            });

            patientGroup.add(electrodesGroup);
            if (window.showNotification) window.showNotification('🔌 Électrodes ECG appliquées sur le torse.', 'success');
        }
        // --- C. MASQUE À OXYGÈNE ---
        else if (assetType === 'oxygen_mask' && patientGroup) {
            // Cône de masque plastique translucide bleu
            const maskGeom = new THREE.ConeGeometry(0.03, 0.055, 12);
            const maskMat = new THREE.MeshStandardMaterial({
                color: 0x44ccff,
                transparent: true,
                opacity: 0.65,
                roughness: 0.15,
                metalness: 0.1
            });
            const mask = new THREE.Mesh(maskGeom, maskMat);
            mask.name = 'spawned_oxygen_mask';
            // Nez du patient
            mask.position.set(0.0, 0.28, 0.08);
            mask.rotation.x = Math.PI / 3.2;

            // Tuyau vert translucide qui descend
            const tubePoints = [
                new THREE.Vector3(0.0, 0.25, 0.06),
                new THREE.Vector3(-0.15, 0.1, 0.0),
                new THREE.Vector3(-0.8, -0.1, -0.6),
                new THREE.Vector3(-2.0, -0.4, -1.0)
            ];
            const tubeCurve = new THREE.CatmullRomCurve3(tubePoints);
            const tube = new THREE.Mesh(
                new THREE.TubeGeometry(tubeCurve, 16, 0.003, 6, false),
                new THREE.MeshStandardMaterial({ color: 0x88ffcc, transparent: true, opacity: 0.5 })
            );
            mask.add(tube);

            patientGroup.add(mask);

            if (window.gsap) {
                mask.scale.set(0, 0, 0);
                window.gsap.to(mask.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'power2.out' });
            }
            if (window.showNotification) window.showNotification('🫁 Masque à oxygène appliqué.', 'success');
        }
        // --- D. PERFUSION DE TRAITEMENT ---
        else if (assetType === 'perfusion') {
            const ivStand = scene.getObjectByName('IVStand');
            if (ivStand) {
                const bagGroup = new THREE.Group();
                bagGroup.name = 'spawned_perfusion';

                // Seconde poche de soluté teintée de rose
                const bagMat = new THREE.MeshStandardMaterial({
                    color: 0xffbbbb,
                    transparent: true,
                    opacity: 0.8,
                    emissive: 0xff6666,
                    emissiveIntensity: 0.2,
                    roughness: 0.1
                });
                const bag = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.11, 0.024), bagMat);
                bag.position.set(0.08, 1.58, 0.02); // De l'autre côté de la potence
                bagGroup.add(bag);

                // Étiquette de posologie blanche
                const label = new THREE.Mesh(
                    new THREE.BoxGeometry(0.045, 0.03, 0.026),
                    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })
                );
                label.position.set(0.08, 1.53, 0.02);
                bagGroup.add(label);

                ivStand.add(bagGroup);

                if (window.gsap) {
                    bagGroup.scale.set(0, 0, 0);
                    window.gsap.to(bagGroup.scale, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(1.5)' });
                }
                if (window.showNotification) window.showNotification('💧 Perfusion thérapeutique connectée.', 'success');
            }
        }
        // --- E. SERINGUE ---
        else if (assetType === 'seringue') {
            const syringeGroup = new THREE.Group();
            syringeGroup.name = 'spawned_seringue';
            syringeGroup.position.set(-2.1, 0.87, -0.95); // Posée sur le chariot médical

            // Corps plastique de la seringue
            const barrel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.005, 0.005, 0.045, 8),
                new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, roughness: 0.1 })
            );
            barrel.rotation.x = Math.PI / 2;

            // Piston gris en métal
            const plunger = new THREE.Mesh(
                new THREE.CylinderGeometry(0.002, 0.002, 0.025, 6),
                new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7 })
            );
            plunger.position.y = 0.03;
            plunger.rotation.x = Math.PI / 2;

            syringeGroup.add(barrel, plunger);
            scene.add(syringeGroup);

            if (window.gsap) {
                syringeGroup.scale.set(0, 0, 0);
                window.gsap.to(syringeGroup.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(1.2)' });
            }
            if (window.showNotification) window.showNotification('💉 Seringue de traitement préparée.', 'info');
        }
        // --- F. COUVERTURE ISOTHERME ---
        else if (assetType === 'couverture' && patientGroup) {
            // Boîte métallique dorée scintillante
            const blanketGeom = new THREE.BoxGeometry(0.355, 0.012, 0.83);
            const blanketMat = new THREE.MeshStandardMaterial({
                color: 0xffd700,
                metalness: 0.95,
                roughness: 0.05,
                emissive: 0xffa500,
                emissiveIntensity: 0.2
            });
            const blanket = new THREE.Mesh(blanketGeom, blanketMat);
            blanket.name = 'spawned_couverture';
            blanket.position.set(0.0, 0.062, -0.32);

            patientGroup.add(blanket);

            if (window.gsap) {
                blanket.position.y = 0.4;
                blanket.scale.set(0.85, 0.1, 0.85);
                window.gsap.to(blanket.position, { y: 0.062, duration: 1.0, ease: 'bounce.out' });
                window.gsap.to(blanket.scale, { x: 1, y: 1, z: 1, duration: 0.8 });
            }
            if (window.showNotification) window.showNotification('✨ Couverture isotherme dorée posée.', 'success');
        }
    }
}

// Instanciation globale immédiate
window.clinicalAgentAI = new ClinicalAgentAI();
