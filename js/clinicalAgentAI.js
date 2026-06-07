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

            if (self.isClinicalAction(question)) {
                // Intercepter et traiter l'action avec l'IA Game Master
                await self.processClinicalAction3D(question, hudInstance);
            } else {
                // Déléguer au chat streaming conversationnel du patient classique
                await originalHUDAsk(question);
            }
        };

        // Rendre les placeholders de saisie extrêmement incitatifs et premiums
        const input3d = document.getElementById('dialog-input-3d');
        if (input3d) {
            input3d.placeholder = "Posez une question ou ordonnez une intervention (ex: Injecter de l'Aspirine)...";
        }
        const input2d = document.getElementById('dialogue-input');
        if (input2d) {
            input2d.placeholder = "Posez une question ou ordonnez une intervention libre...";
        }

        console.info('[ClinicalAgentAI] Chat 3D intercepté ! Placeholders enrichis.');
    }

    /**
     * Détermine la profession de santé appropriée réalisant l'action demandée
     */
    getProfessionalRole(actionText) {
        const q = actionText.toLowerCase().trim();
        
        // Radiologue (Examens d'imagerie)
        if (q.includes("radio") || q.includes("rayons x") || q.includes("scanner") || q.includes("ct scan") || q.includes("irm") || q.includes("échographie") || q.includes("echo ") || q.includes("radiographie")) {
            return "Radiologue";
        }
        
        // Biologiste (Prises de sang, analyses de labo, gaz du sang)
        if (q.includes("sang") || q.includes("bilan") || q.includes("prise de sang") || q.includes("gaz du sang") || q.includes("gds") || q.includes("biologie") || q.includes("troponine") || q.includes("d-dimère") || q.includes("ddimere") || q.includes("ionogramme") || q.includes("glycémie") || q.includes("lactate") || q.includes("hémoculture") || q.includes("nfs") || q.includes("analyse")) {
            return "Biologiste";
        }
        
        // Cardiologue / Médecin Réanimateur (Auscultation, ECG, Choc, DSA, Massage, Electrodes, Scope)
        if (q.includes("ecg") || q.includes("électrocardio") || q.includes("auscult") || q.includes("stétho") || q.includes("choquer") || q.includes("défib") || q.includes("cpr") || q.includes("massage") || q.includes("dsa") || q.includes("ventiler") || q.includes("intub") || q.includes("pouls") || q.includes("tension") || q.includes("palper") || q.includes("palpe") || q.includes("examen physique") || q.includes("cardiaque")) {
            return "Médecin Réanimateur";
        }
        
        // Infirmier / Infirmière (Perfusion, Injection, Médicaments couramment administrés par IDE, Masque O2, Couverture)
        if (q.includes("inject") || q.includes("perfuse") || q.includes("perfusion") || q.includes("pos") || q.includes("donne") || q.includes("administre") || q.includes("oxyg") || q.includes("masque") || q.includes("o2") || q.includes("couverture") || q.includes("chaud") || q.includes("isotherm") || q.includes("seringue") || q.includes("morphine") || q.includes("aspirine") || q.includes("trinitrine") || q.includes("adrénaline") || q.includes("insuline") || q.includes("remplissage") || q.includes("nacl") || q.includes("doliprane") || q.includes("potassium")) {
            return "Infirmier / Infirmière";
        }
        
        // Par défaut
        return "Directeur Clinique";
    }

    /**
     * Identifie si un message est une action clinique (prescription, geste, examen physique)
     * Heuristique ultra-large pour intercepter absolument toutes les interventions libres du médecin.
     */
    isClinicalAction(question) {
        const q = question.toLowerCase().trim();

        // 1. Détection structurelle par préfixe direct d'ordre, d'intention médicale ou d'examen
        const actionPrefixes = [
            "prescription", "prescrire", "prescris", "ordonne", "ordonner", 
            "injecter", "injecte", "poser", "pose", "donner", "donne", 
            "faire", "fait", "mettre", "mis", "administrer", "administre", 
            "perfuser", "perfusion", "ausculter", "ausculte", "palper", "palpe",
            "installer", "installe", "brancher", "branche", "appliquer", "applique",
            "choquer", "choc", "massé", "masser", "radio", "scanner", "prise de sang",
            "bilan", "ecg", "gds", "gaz du sang", "échographie", "analyse", "examen"
        ];
        if (actionPrefixes.some(prefix => q.startsWith(prefix))) {
            return true;
        }

        // 2. Détection par présence de verbes ou d'actions cliniques au cœur de la phrase
        const clinicalVerbs = [
            "inject", "perfuse", "prescri", "ordonn", "auscult", "palp", 
            "mass", "choc", "choqu", "ventil", "intub", "examin", "radiographi", "analys"
        ];
        if (clinicalVerbs.some(verb => q.includes(verb))) {
            return true;
        }

        // 3. Détection par présence de racines de médicaments, d'électrolytes, de dispositifs médicaux ou d'examens
        const medicalRoots = [
            // Électrolytes & solutés
            "potassium", "kcl", "calcium", "magnésium", "magnesium", "bicarbonate", 
            "nacl", "glucose", "soluté", "solute", "serum", "sérum", "ringer", "lactate", 
            "macromol", "g30", "g10", "perfusion",
            
            // Médicaments courants (suffixes -ine, -ol, -ide, -one, -ane, -ate)
            "morphine", "adrénaline", "adrenaline", "noradrénaline", "noradrenaline", 
            "atropine", "insuline", "dobutamine", "dopamine", "lasilix", "furosémide", 
            "furosemide", "amiodarone", "cordarone", "héparine", "heparine", "lovenox", 
            "plavix", "clopidogrel", "brilique", "valium", "diazépam", "diazepam", 
            "ventoline", "salbutamol", "aérosol", "aerosol", "trinitrine", 
            "nitroglycérine", "nitroglycerine", "aspirine", "cardégic", "cardegic",
            "paracétamol", "paracetamol", "doliprane", "spasfon", "insuline",
            
            // Matériel clinique
            "défibrillateur", "defibrillateur", "dsa", "moniteur", "scope", "électrodes", 
            "electrodes", "oxymètre", "oxymetre", "tensiomètre", "tensiometre", "thermomètre", 
            "thermometre", "stéthoscope", "stethoscope", "couverture", "masque", "lunettes", 
            "intubation", "intubé", "intube",
            
            // Examens cliniques et complémentaires
            "radio", "radiographie", "radiologique", "scanner", "ct-scan", "irm", "échographie", 
            "echo ", "prise de sang", "bilan biologique", "gaz du sang", "gds", "ecg", "électrocardiogramme"
        ];
        if (medicalRoots.some(root => q.includes(root))) {
            return true;
        }

        return false;
    }

    /**
     * Traite l'action clinique libre au sein de l'environnement 3D
     */
    async processClinicalAction3D(actionText, hudInstance, options = {}) {
        console.info(`[ClinicalAgentAI] Traitement de l'action libre : "${actionText}" (options: ${JSON.stringify(options)})`);
        
        // 1. Ajouter le message du joueur dans le dialogue
        const chat = window.patientChat;
        chat.append('Vous', actionText);
        chat.messages.push({ role: 'user', content: actionText });

        const role = this.getProfessionalRole(actionText);

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

        // 3. Obtenir la réponse (OpenRouter ou Fallback Local en parallèle)
        let responseJson = null;

        try {
            // Créer une promesse de timeout de 8 secondes pour basculer sur le local si lag/erreur
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout OpenRouter')), 8000)
            );

            const fetchPromise = this.callOpenRouterClinicalDirector(actionText, caseData, vitals);
            responseJson = await Promise.race([fetchPromise, timeoutPromise]);
        } catch (err) {
            console.warn('[ClinicalAgentAI] Erreur ou Timeout OpenRouter. Recours au moteur local robuste...', err.message);
            responseJson = this.localFallbackEngine(actionText, caseData, vitals);
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
                
                textSpan.innerHTML = cleanResponse;
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
            setTimeout(() => {
                if (messages3d) {
                    const row = document.createElement('div');
                    row.className = 'from-patient';
                    row.innerHTML = `
                        <div class="dialog-msg-patient">
                            <span class="dialog-msg-avatar">🗣️</span>
                            <div class="dialog-msg-bubble" style="border-left:3px solid #ff9f43;">
                                <span class="dialog-msg-text"><strong>Patient :</strong> « ${responseJson.patientVerbatim} »</span>
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
                    r.innerHTML = `<strong>Patient : </strong><span>« ${responseJson.patientVerbatim} »</span>`;
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
                if (window.feedbackTimeline?.log) {
                    const typeEvent = sc.type === 'fatal' ? 'lock' : 'traitement';
                    window.feedbackTimeline.log(
                        typeEvent,
                        `Prescription libre : ${canonicalName} (${sc.type})`,
                        { scoringType: sc.type, text: actionText }
                    );
                }
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
            card2d.innerHTML = `🩺 <strong>${finalRoleForLog} :</strong> ${cleanResponseForLog}`;
            root2d.appendChild(card2d);
            root2d.scrollTop = root2d.scrollHeight;
        }

        // Ajouter à l'historique assistant
        chat.messages.push({ role: 'assistant', content: `${finalRoleForLog} : ${cleanResponseForLog}` });
    }

    /**
     * Appelle l'API d'OpenRouter avec un prompt de type Directeur Clinique / GM
     */
    async callOpenRouterClinicalDirector(action, caseData, vitals) {
        const endpoint = window.CONFIG?.LLM_API_URL || '/api/llm/chat/completions';
        const model = window.CONFIG?.LLM_MODEL || 'openrouter/owl-alpha';
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
Le joueur est le médecin réanimateur. Il vient de saisir l'action clinique libre suivante : "${action}"

Actuellement, le patient présente le cas clinique suivant :
- Patient : ${patient.nom}, ${patient.age} ans, ${patient.sexe}
- Diagnostic correct attendu : ${correctDiagnostic}
- Traitements de référence attendus : ${correctTreatments.join(', ')}
- Traitements contre-indiqués / fatals : ${fatalTreatments.join(', ')}
- Allergies connues du patient : ${allergiesText}

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
                'HTTP-Referer': window.location.origin || 'http://localhost',
                'X-Title': 'MedGame'
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'system', content: systemPrompt }],
                stream: false,
                temperature: 0.1, // Basse température pour forcer la structure JSON
                max_tokens: 450
            })
        });

        if (!response.ok) {
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

        return JSON.parse(content.trim());
    }

    /**
     * Dictionnaire de secours local (Offline / Fallback) pour traiter instantanément les actions courantes
     */
    localFallbackEngine(action, caseData, vitals) {
        const q = action.toLowerCase().trim();
        const correctTreatments = caseData.correctTreatments || [];
        const fatalTreatments = caseData.fatalTreatments || [];
        const role = this.getProfessionalRole(action);

        // Structure par défaut
        const res = {
            isAction: true,
            clinicalResponse: "Vous effectuez l'intervention libre demandée. Le patient réagit cliniquement.",
            patientVerbatim: "Merci docteur... Je crois que ça m'aide un peu.",
            vitalChanges: { ...vitals },
            expressionChange: "normal",
            respiratoryPattern: "normal",
            scoringChange: { type: "unnecessary", treatmentName: null },
            spawnAsset: null,
            soundToPlay: "correct",
            profession: role
        };

        // --- 0. Détection des allergies (choc anaphylactique mortel) ---
        const allergies = caseData.interrogatoire?.allergies || { presence: false, liste: [] };
        if (allergies.presence && allergies.liste?.length > 0) {
            const allergenes = allergies.liste.map(a => (typeof a === 'string' ? a : a.allergene).toLowerCase().trim());
            const hasAllergicReaction = allergenes.some(allergen => q.includes(allergen));
            
            if (hasAllergicReaction) {
                res.clinicalResponse = "⚠️ CHOC ANAPHYLACTIQUE ULTRA-GRAVE : L'administration de cette substance provoque une réaction allergique systémique foudroyante ! La gorge gonfle instantanément, la saturation s'effondre et la tension s'écroule. Le patient sombre sous l'alarme critique du scope.";
                res.patientVerbatim = "Je... j'arrive plus... à respirer... ma gorge... se serre... tout s'éteint...";
                res.vitalChanges.systolic = 50;
                res.vitalChanges.diastolic = 25;
                res.vitalChanges.heartRate = 145;
                res.vitalChanges.spo2 = 65;
                res.vitalChanges.respiratoryRate = 6;
                res.expressionChange = "cyanose";
                res.respiratoryPattern = "agonal";
                res.scoringChange = { type: "fatal", treatmentName: "Allergène administré" };
                res.soundToPlay = "alarm";
                res.profession = "Infirmier / Infirmière";
                return res;
            }
        }

        // --- 0b. Détection des examens complémentaires (radio, ECG, prise de sang, scanner, gaz du sang) ---
        const examResults = caseData.examResults || {};
        let foundPredefinedResult = null;
        let matchedExamKey = null;

        // Liste des correspondances de mots-clés pour les examens prédéfinis
        const examMappings = {
            "radio": ["radio", "thorax", "poumon", "x-ray", "cliché", "face"],
            "ecg": ["ecg", "cardio", "tracé", "rythme"],
            "sang": ["sang", "bilan", "nfs", "ionogramme", "troponine", "crp", "biolog", "analyse"],
            "gds": ["gds", "gaz", "artériel", "capnie", "acidose"],
            "scanner": ["scanner", "ct", "tass", "angioscan"]
        };

        for (const [examName, examText] of Object.entries(examResults)) {
            const keyLower = examName.toLowerCase();
            // Si la saisie de l'utilisateur contient des mots-clés qui matchent l'examen prédéfini
            if (q.includes(keyLower) || keyLower.includes(q)) {
                foundPredefinedResult = examText;
                matchedExamKey = examName;
                break;
            }

            // Fallback sur le mapping sémantique
            for (const [type, keywords] of Object.entries(examMappings)) {
                if (q.includes(type)) {
                    if (keywords.some(kw => keyLower.includes(kw))) {
                        foundPredefinedResult = examText;
                        matchedExamKey = examName;
                        break;
                    }
                }
            }
            if (foundPredefinedResult) break;
        }

        if (!foundPredefinedResult) {
            const diag = (caseData.correctDiagnostic || "").toLowerCase();
            
            // --- RADIOGRAPHIE / SCANNER ---
            if (q.includes("radio") || q.includes("radiographie") || q.includes("scanner") || q.includes("ct")) {
                const isScanner = q.includes("scanner") || q.includes("ct");
                const examTitle = isScanner ? "Scanner" : "Radiographie";
                
                if (diag.includes("asthme")) {
                    foundPredefinedResult = `${examTitle} thoracique : Distension thoracique bilatérale marquée avec hyperclarté des deux champs pulmonaires, aplatissement des coupoles diaphragmatiques et élargissement des espaces intercostaux. Pas de foyer de pneumopathie infiltrant ni d'épanchement pleural.`;
                } else if (diag.includes("pneumothorax")) {
                    foundPredefinedResult = `${examTitle} thoracique : Hyperclarté avasculaire franche du sommet avec refoulement du médiastin vers le côté opposé et collapsus pulmonaire complet, confirmant un pneumothorax compressif.`;
                } else if (diag.includes("choc") && diag.includes("septique")) {
                    foundPredefinedResult = `${examTitle} : Distension des anses digestives, foyer de pneumopathie basale droite avec infiltrat alvéolaire franc compatible avec un foyer infectieux pulmonaire primitif.`;
                } else if (diag.includes("noyade")) {
                    foundPredefinedResult = `${examTitle} thoracique : Inondation alvéolaire bilatérale diffuse prédominant aux bases, aspect de poumon humide de surcharge typique de noyade.`;
                } else if (diag.includes("embolie")) {
                    foundPredefinedResult = isScanner 
                        ? `Angioscanner thoracique : Défaut d'opacification bilatéral franc des artères pulmonaires lobaires inférieures droites et gauches, signant une embolie pulmonaire bilatérale massive.`
                        : `Radiographie thoracique : Silhouette cardiaque normale, surélévation d'une coupole diaphragmatique mais pas d'anomalie parenchymateuse majeure évidente (cliché faussement rassurant classique).`;
                } else if (diag.includes("insuffisance cardiaque") || diag.includes("oap") || diag.includes("oedème") || diag.includes("oedeme")) {
                    foundPredefinedResult = `${examTitle} thoracique : Cardiomégalie franche (index cardio-thoracique > 0.60), surcharge vasculaire hilaire bilatérale en 'ailes de papillon', lignes B de Kerley aux bases pulmonaires et discret épanchement pleural bilatéral compatible avec un OAP.`;
                } else {
                    foundPredefinedResult = `${examTitle} standard : Pas d'anomalie parenchymateuse pulmonaire évidente, silhouette cardiaque de taille normale, coupoles diaphragmatiques libres. Aspect dans les limites de la normale pour ce geste.`;
                }
            }
            
            // --- ECG (ÉLECTROCARDIOGRAMME) ---
            else if (q.includes("ecg") || q.includes("électrocardio")) {
                if (diag.includes("infarctus") || diag.includes("angor") || diag.includes("coronar")) {
                    foundPredefinedResult = `Électrocardiogramme (12 dérivations) : Tachycardie sinusale à 95 bpm, axe normal. Sus-décalage franc et convexe du segment ST (onde de Pardee) de plus de 2 mm dans les dérivations antérieures (V2, V3, V4) avec image en miroir (sous-décalage ST) en DII, DIII, aVF, confirmant un syndrome coronarien SCA ST+ (IDM antérieur).`;
                } else if (diag.includes("insuffisance cardiaque")) {
                    foundPredefinedResult = `Électrocardiogramme (12 dérivations) : Rythme sinusal régulier à 90 bpm. Signes d'hypertrophie ventriculaire gauche (indice de Sokolow à 42 mm) et ondes T négatives asymétriques en V5-V6.`;
                } else if (diag.includes("arrêt") || diag.includes("acr") || diag.includes("sportive")) {
                    foundPredefinedResult = `Électrocardiogramme / Tracé du scope : Rythme chaotique de fibrillation ventriculaire (FV) à grandes mailles, asymétrique et extrêmement instable, nécessitant un choc électrique immédiat.`;
                } else if (diag.includes("embolie")) {
                    foundPredefinedResult = `Électrocardiogramme (12 dérivations) : Tachycardie sinusale à 115 bpm. Aspect S1Q3T3 caractéristique d'une surcharge ventriculaire droite aiguë (onde S profonde en DI, onde Q pathologique en DIII et onde T négative en DIII) avec bloc de branche droit incomplet.`;
                } else if (diag.includes("choc") || diag.includes("anaphylactique") || diag.includes("asthme")) {
                    foundPredefinedResult = `Électrocardiogramme (12 dérivations) : Tachycardie sinusale régulière et sinusoïdale rapide à 125 bpm. Pas de trouble de la conduction ni de repolarisation active. Surcharge atriale droite possible.`;
                } else {
                    foundPredefinedResult = `Électrocardiogramme (12 dérivations) : Tachycardie sinusale de lutte à 102 bpm. Espace PR et QRS normaux, pas de décalage du segment ST ni d'inversion de l'onde T. Tracé d'effort non contributif pour une ischémie aiguë.`;
                }
            }
            
            // --- GAZ DU SANG (GDS) ---
            else if (q.includes("gds") || q.includes("gaz du sang")) {
                if (diag.includes("asthme")) {
                    foundPredefinedResult = `Gaz du sang artériel (en air ambiant) : pH = 7.35, PaO2 = 56 mmHg (hypoxémie sévère), PaCO2 = 44 mmHg (normocapnie anormalement élevée traduisant un épuisement diaphragmatique critique imminent), HCO3- = 24 mmol/L, SaO2 = 88%.`;
                } else if (diag.includes("choc") && diag.includes("septique")) {
                    foundPredefinedResult = `Gaz du sang artériel : Acidose métabolique sévère avec pH = 7.21, PaO2 = 70 mmHg sous O2, PaCO2 = 32 mmHg (hypocapnie compensatrice), HCO3- = 15 mmol/L, hyperlactatémie majeure à 5.8 mmol/L signant l'hypoperfusion tissulaire périphérique.`;
                } else if (diag.includes("noyade")) {
                    foundPredefinedResult = `Gaz du sang artériel : Acidose mixte sévère (respiratoire et métabolique) avec pH = 7.15, PaO2 = 45 mmHg (hypoxémie réfractaire majeure), PaCO2 = 58 mmHg (hypercapnie par shunt alvéolaire), lactates à 4.2 mmol/L, SaO2 = 72%.`;
                } else if (diag.includes("overdose")) {
                    foundPredefinedResult = `Gaz du sang artériel : Acidose respiratoire aiguë sévère par hypoventilation alvéolaire majeure avec pH = 7.22, PaO2 = 50 mmHg, PaCO2 = 68 mmHg (hypercapnie sévère par hypopnée), HCO3- = 25 mmol/L, SaO2 = 78%.`;
                } else {
                    foundPredefinedResult = `Gaz du sang artériel (sous oxygène) : pH = 7.41, PaO2 = 92 mmHg, PaCO2 = 36 mmHg (discrète hypocapnie d'hyperventilation), HCO3- = 23 mmol/L, Lactates = 1.1 mmol/L (normaux).`;
                }
            }
            
            // --- BILAN SANGUIN / PRISE DE SANG / BIOLOGIE ---
            else if (q.includes("sang") || q.includes("bilan") || q.includes("biolog") || q.includes("prise")) {
                if (diag.includes("infarctus") || diag.includes("SCA")) {
                    foundPredefinedResult = `Bilan biologique d'urgence : Troponine I ultra-sensible élevée à 850 ng/L (N < 14 ng/L) signant une nécrose myocardique aiguë. Créatinine = 88 µmol/L. NFS : Leucocytes = 12 500/mm3. Ionogramme : K+ = 4.1 mmol/L, Na+ = 139 mmol/L.`;
                } else if (diag.includes("choc") && diag.includes("septique")) {
                    foundPredefinedResult = `Bilan biologique d'urgence : Hyperleucocytose majeure à 22 400/mm3 avec polynucléaires neutrophiles à 18 500/mm3. CRP élevée à 180 mg/L. Procalcitonine (PCT) = 12.5 µg/L (fortement positive). Insuffisance rénale fonctionnelle avec Urée = 18 mmol/L et Créatinine = 165 µmol/L. Lactates = 4.8 mmol/L.`;
                } else if (diag.includes("insuffisance rénale") || diag.includes("ira") || diag.includes("néphro")) {
                    foundPredefinedResult = `Bilan biologique d'urgence : Insuffisance rénale aiguë majeure avec Urée = 28 mmol/L, Créatinine = 450 µmol/L. Ionogramme : hyperkaliémie critique avec K+ = 6.2 mmol/L (menace cardiaque), Na+ = 136 mmol/L, Bicarbonates = 16 mmol/L.`;
                } else if (diag.includes("diabète") || diag.includes("acidocétose")) {
                    foundPredefinedResult = `Bilan biologique d'urgence : Hyperglycémie majeure à 28.5 mmol/L (5.1 g/L), acidose métabolique avec Bicarbonates = 12 mmol/L, pH = 7.18, hyperkaliémie de transfert à 5.3 mmol/L. Présence massive de corps cétoniques dans le sang (cétonémie = 4.8 mmol/L).`;
                } else {
                    foundPredefinedResult = `Bilan biologique standard : NFS dans les limites de la normale (Leucocytes = 8 500/mm3, Hémoglobine = 13.8 g/dL, Plaquettes = 240 000/mm3). CRP < 5 mg/L. Fonction rénale normale (Créatinine = 72 µmol/L). Ionogramme équilibré (K+ = 3.9 mmol/L, Na+ = 140 mmol/L).`;
                }
            }
        }

        if (foundPredefinedResult) {
            res.clinicalResponse = foundPredefinedResult;
            res.patientVerbatim = "";
            res.soundToPlay = "correct";
            res.scoringChange = { type: "unnecessary", treatmentName: matchedExamKey || "Examen diagnostique" };
            res.vitalChanges = { ...vitals };
            res.profession = role;
            return res;
        }

        // --- 1. Masque à oxygène / O2 ---
        if (q.includes("oxyg") || q.includes("o2") || q.includes("masque")) {
            const isCorrect = correctTreatments.some(t => t.toLowerCase().includes("oxyg"));
            res.clinicalResponse = "Vous ajustez un masque à haute concentration à 15L/min. L'apport d'oxygène soulage immédiatement l'effort respiratoire.";
            res.patientVerbatim = "Ah... C'est plus facile de respirer...";
            res.vitalChanges.spo2 = 98;
            res.vitalChanges.respiratoryRate = 14;
            res.expressionChange = "normal";
            res.respiratoryPattern = "normal";
            res.spawnAsset = "oxygen_mask";
            res.scoringChange = {
                type: isCorrect ? "firstLine" : "secondLine",
                treatmentName: correctTreatments.find(t => t.toLowerCase().includes("oxyg")) || "Oxygénothérapie"
            };
            res.soundToPlay = "correct";
        }
        // --- 2. Aspirine ---
        else if (q.includes("aspir")) {
            const isCorrect = correctTreatments.some(t => t.toLowerCase().includes("aspir"));
            const isFatal = fatalTreatments.some(t => t.toLowerCase().includes("aspir"));
            res.clinicalResponse = "Vous administrez 250mg d'Aspirine en intraveineuse directe pour inhiber l'agrégation plaquettaire.";
            res.patientVerbatim = "D'accord docteur.";
            res.spawnAsset = "seringue";
            res.scoringChange = {
                type: isFatal ? "fatal" : (isCorrect ? "firstLine" : "unnecessary"),
                treatmentName: isFatal ? fatalTreatments.find(t => t.toLowerCase().includes("aspir")) : (correctTreatments.find(t => t.toLowerCase().includes("aspir")) || "Aspirine")
            };
            res.soundToPlay = isFatal ? "incorrect" : "correct";
        }
        // --- 3. Trinitrine / Nitroglycérine ---
        else if (q.includes("trinit") || q.includes("nitro")) {
            const isCorrect = correctTreatments.some(t => t.toLowerCase().includes("trinit") || t.toLowerCase().includes("nitro"));
            const isFatal = fatalTreatments.some(t => t.toLowerCase().includes("trinit") || t.toLowerCase().includes("nitro"));
            
            // Si le patient est déjà hypotendu, c'est une erreur fatale clinique !
            const bp = parseInt(vitals.systolic || '120');
            if (bp < 95 || isFatal) {
                res.clinicalResponse = "⚠️ ERREUR CRITIQUE : L'administration de dérivés nitrés sur un patient en hypotension provoque un collapsus cardiovasculaire grave ! La tension s'effondre.";
                res.patientVerbatim = "Je... Je me sens partir... Tout devient noir...";
                res.vitalChanges.systolic = 65;
                res.vitalChanges.diastolic = 35;
                res.vitalChanges.heartRate = 135;
                res.expressionChange = "pale";
                res.respiratoryPattern = "agonal";
                res.spawnAsset = "perfusion";
                res.scoringChange = { type: "fatal", treatmentName: fatalTreatments.find(t => t.toLowerCase().includes("trinit")) || "Trinitrine" };
                res.soundToPlay = "alarm";
            } else {
                res.clinicalResponse = "Vous posez une perfusion de Trinitrine. Le produit relaxe le muscle lisse vasculaire et diminue le travail cardiaque.";
                res.patientVerbatim = "La douleur dans ma poitrine commence à diminuer doucement...";
                res.vitalChanges.systolic = Math.max(100, bp - 20);
                res.vitalChanges.heartRate = Math.max(65, (vitals.heartRate || 75) - 10);
                res.expressionChange = "normal";
                res.spawnAsset = "perfusion";
                res.scoringChange = {
                    type: isCorrect ? "firstLine" : "secondLine",
                    treatmentName: correctTreatments.find(t => t.toLowerCase().includes("trinit")) || "Trinitrine"
                };
                res.soundToPlay = "correct";
            }
        }
        // --- 4. Adrénaline ---
        else if (q.includes("adré") || q.includes("adre")) {
            const isCorrect = correctTreatments.some(t => t.toLowerCase().includes("adré") || t.toLowerCase().includes("adre"));
            const isFatal = fatalTreatments.some(t => t.toLowerCase().includes("adré") || t.toLowerCase().includes("adre"));
            
            res.clinicalResponse = "Vous injectez de l'Adrénaline. Le scope s'emballe instantanément sous l'effet de la puissante stimulation alpha et bêta-adrénergique.";
            res.patientVerbatim = "Mon cœur... Il tape super fort dans ma poitrine !";
            res.vitalChanges.heartRate = 138;
            res.vitalChanges.systolic = 155;
            res.vitalChanges.diastolic = 95;
            res.expressionChange = "anxieux";
            res.respiratoryPattern = "tachypnea";
            res.spawnAsset = "seringue";
            res.scoringChange = {
                type: isFatal ? "fatal" : (isCorrect ? "firstLine" : "unnecessary"),
                treatmentName: isFatal ? fatalTreatments.find(t => t.toLowerCase().includes("adré")) : (correctTreatments.find(t => t.toLowerCase().includes("adré")) || "Adrénaline")
            };
            res.soundToPlay = isFatal ? "alarm" : "correct";
        }
        // --- 5. Remplissage / Perfusion ---
        else if (q.includes("rempli") || q.includes("nacl") || q.includes("perf")) {
            const isCorrect = correctTreatments.some(t => t.toLowerCase().includes("rempli") || t.toLowerCase().includes("remplissage") || t.toLowerCase().includes("soluté"));
            res.clinicalResponse = "Vous lancez un remplissage rapide de macromolécules NaCl à 500 mL. Le volume augmente la pression systolique et régule le choc.";
            res.patientVerbatim = "Je me sens un tout petit peu moins faible...";
            res.vitalChanges.systolic = Math.min(130, parseInt(vitals.systolic || '90') + 20);
            res.vitalChanges.diastolic = Math.min(85, parseInt(vitals.diastolic || '55') + 10);
            res.vitalChanges.heartRate = Math.max(70, parseInt(vitals.heartRate || '105') - 15);
            res.spawnAsset = "perfusion";
            res.scoringChange = {
                type: isCorrect ? "firstLine" : "secondLine",
                treatmentName: correctTreatments.find(t => t.toLowerCase().includes("rempli")) || "Remplissage"
            };
            res.soundToPlay = "correct";
        }
        // --- 6. Défibrillateur / Choc / Massage ---
        else if (q.includes("defib") || q.includes("défib") || q.includes("choc") || q.includes("cpr") || q.includes("mass")) {
            res.clinicalResponse = "Vous positionnez les palettes et ordonnez un choc électrique. Le tracé cardiaque se synchronise et se stabilise.";
            res.patientVerbatim = "Ouh... J'ai senti une secousse intense.";
            res.vitalChanges.heartRate = 75;
            res.vitalChanges.systolic = 120;
            res.vitalChanges.diastolic = 80;
            res.vitalChanges.respiratoryRate = 15;
            res.expressionChange = "normal";
            res.respiratoryPattern = "normal";
            res.spawnAsset = "defibrillateur";
            res.scoringChange = {
                type: "firstLine",
                treatmentName: correctTreatments.find(t => t.toLowerCase().includes("choc") || t.toLowerCase().includes("dsa") || t.toLowerCase().includes("massage")) || "Défibrillation"
            };
            res.soundToPlay = "correct";
        }
        // --- 7. Électrodes / Monitoring ---
        else if (q.includes("electro") || q.includes("électro") || q.includes("monitoring")) {
            res.clinicalResponse = "Vous posez les électrodes sur le torse du patient. Le signal cardiaque s'affiche proprement sur l'écran.";
            res.spawnAsset = "electrodes";
            res.scoringChange = { type: "unnecessary", treatmentName: "Electrodes" };
            res.soundToPlay = "correct";
        }
        // --- 8. Couverture / Réchauffement ---
        else if (q.includes("couvert") || q.includes("chaud") || q.includes("isotherm")) {
            res.clinicalResponse = "Vous recouvrez le patient d'une couverture isotherme pour prévenir ou traiter l'hypothermie clinique.";
            res.patientVerbatim = "Ah, merci... J'avais de terribles frissons.";
            res.vitalChanges.temperature = 37.0;
            res.spawnAsset = "couverture";
            res.scoringChange = { type: "secondLine", treatmentName: "Réchauffement" };
            res.soundToPlay = "correct";
        }
        // --- 9. Morphine / Antalgique ---
        else if (q.includes("morphin")) {
            const isCorrect = correctTreatments.some(t => t.toLowerCase().includes("morphin"));
            const isFatal = fatalTreatments.some(t => t.toLowerCase().includes("morphin"));
            
            res.clinicalResponse = "Vous administrez 5mg de Morphine en injection IV lente pour calmer la douleur intense.";
            res.patientVerbatim = "Ah... la douleur s'en va... Ça fait un bien fou docteur, merci.";
            res.vitalChanges.heartRate = Math.max(60, parseInt(vitals.heartRate || '90') - 10);
            res.vitalChanges.respiratoryRate = Math.max(10, parseInt(vitals.respiratoryRate || '18') - 2);
            res.expressionChange = "normal";
            res.spawnAsset = "seringue";
            res.scoringChange = {
                type: isFatal ? "fatal" : (isCorrect ? "firstLine" : "secondLine"),
                treatmentName: isFatal ? fatalTreatments.find(t => t.toLowerCase().includes("morphin")) : (correctTreatments.find(t => t.toLowerCase().includes("morphin")) || "Morphine")
            };
            res.soundToPlay = isFatal ? "incorrect" : "correct";
        }
        // --- 10. Potassium / Re-équilibrage Électrolytique ---
        else if (q.includes("potassium") || q.includes("kcl")) {
            const isCorrect = correctTreatments.some(t => t.toLowerCase().includes("potassium") || t.toLowerCase().includes("kcl"));
            const isFatal = fatalTreatments.some(t => t.toLowerCase().includes("potassium") || t.toLowerCase().includes("kcl"));
            
            res.clinicalResponse = "Vous posez une perfusion de Chlorure de Potassium (KCl) en intraveineux pour corriger le trouble électrolytique.";
            res.patientVerbatim = "D'accord docteur, mettez la perfusion... Si ça peut aider mon cœur à fonctionner correctement.";
            res.spawnAsset = "perfusion";
            res.scoringChange = {
                type: isFatal ? "fatal" : (isCorrect ? "firstLine" : "secondLine"),
                treatmentName: isFatal ? fatalTreatments.find(t => t.toLowerCase().includes("potassium") || t.toLowerCase().includes("kcl")) : (correctTreatments.find(t => t.toLowerCase().includes("potassium") || t.toLowerCase().includes("kcl")) || "Potassium IV")
            };
            res.soundToPlay = isFatal ? "incorrect" : "correct";
        }

        return res;
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
    }

    /**
     * Génère et injecte un modèle 3D modélisé procéduralement dans la scène 3D
     */
    spawn3DAsset(assetType) {
        if (!window.threeManager?.scene?.scene) return;
        
        const scene = window.threeManager.scene.scene;
        const patientGroup = window.threeManager.scene.patient?.group;
        
        // Utiliser le constructeur THREE de la scène
        const THREE = window.THREE || window.threeManager.scene.scene.__proto__.constructor;
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
