/**
 * js/MedicalGameManager.js — Maître du Jeu / Game Manager
 *
 * Centralise l'analyse des entrées utilisateur en langage naturel,
 * décompose les intentions (dialogue + examens + traitements),
 * met à jour l'état de la simulation (vitals, prescriptions) de façon déterministe,
 * et synthétise une réponse globale et immersive (Concordia-style).
 */

class MedicalGameManager {
    constructor() {
        this.isProcessing = false;
        this.history = [];   // Mémoire conversationnelle complète (user/assistant)
        this.caseId = null;  // Détection de changement de cas → reset mémoire
    }

    /**
     * Analyse et exécute une action en langage naturel soumise par l'étudiant.
     * 
     * @param {string} inputText - L'entrée en langage naturel
     * @returns {Promise<{ narrative: string, dialogue: string|null }>} Le résultat narratif et la réponse verbale du patient
     */
    async processAction(inputText) {
        if (!inputText || !inputText.trim()) {
            return { narrative: "Aucune action saisie.", dialogue: null };
        }

        const caseData = window.gameState?.currentCase;
        if (!caseData) {
            return { narrative: "Aucun cas clinique n'est actuellement chargé.", dialogue: null };
        }

        // Reset mémoire si nouveau cas
        if (this.caseId !== caseData.id) {
            this.history = [];
            this.caseId = caseData.id;
            console.log(`[MedicalGameManager] Nouveau cas (${caseData.id}) — mémoire réinitialisée`);
        }

        const vitals = window.vitalSigns?.props || {
            heartRate: 80, systolic: 120, diastolic: 80, spo2: 98, temperature: 37, respiratoryRate: 16
        };

        this.isProcessing = true;

        try {
            console.log(`[MedicalGameManager] Analyse de l'entrée : "${inputText}"`);

            // ── Politique de divulgation ECOS (alignée sur llm-patient.js) ──
            // Sans elle, le GM peut faire dire au patient des infos déclarées
            // « cachées » ou « à ne révéler que si demandé » → item de grille invalidé.
            let disclosureBlock = '';
            const ecosStd = caseData.ecos?.patientStandardise;
            if (ecosStd) {
                const resolveVal = (path) => {
                    try {
                        return String(path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), caseData) ?? '');
                    } catch (e) { return ''; }
                };
                const subjectOf = (path) => {
                    const parts = path.split('.');
                    return parts[parts.length - 1].replace(/([A-Z])/g, ' $1').toLowerCase().trim();
                };
                const buildList = (paths, instruction) => (paths || [])
                    .map(p => {
                        const val = resolveVal(p);
                        return val ? `- ${subjectOf(p)} (« ${val.substring(0, 120)} ») → ${instruction}` : null;
                    })
                    .filter(Boolean).join('\n');

                const vol = buildList(ecosStd.infosVolontaires, 'révélation LIBRE et spontanée autorisée.');
                const dem = buildList(ecosStd.infosSiDemandees, 'révélation UNIQUEMENT si la question de l\'étudiant porte explicitement dessus.');
                const cac = buildList(ecosStd.infosCachees, 'JAMAIS révélée au premier abord : reste évasif (« ce n\'est rien », « rien de spécial ») ; ne lâche l\'information que si l\'étudiant insiste lourdement ou reformule plusieurs fois.');

                disclosureBlock = `
RÈGLES DE DIVULGATION (station ECOS — À RESPECTER STRICTEMENT pour le DIALOGUE du patient) :
${vol ? `\nINFORMATIONS VOLONTAIRES (peuvent apparaître spontanément) :\n${vol}\n` : ''}${dem ? `\nINFORMATIONS SUR DEMANDE EXPLICITE UNIQUEMENT :\n${dem}\n` : ''}${cac ? `\nINFORMATIONS CACHÉES (évasif au premier abord) :\n${cac}\n` : ''}
RÈGLE GÉNÉRALE : toute information du dossier NON listée ci-dessus comme « libre » ne doit JAMAIS être dévoilée spontanément par le patient. Le diagnostic, son nom, les résultats d'examens complémentaires non demandés et le traitement prévu ne sont JAMAIS révélés par le dialogue.`;
            }

            const patientDead = !!(window.gameState && window.gameState.isPatientDead);
            const systemPrompt = `Tu es le "Game Manager" (Maître du Jeu) d'une simulation médicale immersive pour étudiants en médecine.
Tu es le SEUL routeur décisionnel : toute entrée passe par toi. Tu délègues virtuellement aux rôles (infirmier qui pose la perf, radiologie qui rend l'image, biologie, réanimation) et tu tranches la physiologie, la gravité et l'issue.

Voici le cas clinique actuel :
- Patient : ${JSON.stringify(caseData.patient || {})}
- Motifs et histoire : ${JSON.stringify(caseData.interrogatoire || {})}
- Examen physique disponible (référence) : ${JSON.stringify(caseData.examenClinique || {})}
- Examens complémentaires (si demandés) : ${JSON.stringify(caseData.examResults || {})}
${disclosureBlock}

Voici les constantes vitales courantes du patient :
- FC (Fréquence Cardiaque) : ${vitals.heartRate || vitals.HR || 80} bpm
- Tension : ${(vitals.systolic || 120)}/${(vitals.diastolic || 80)} mmHg
- SpO2 : ${vitals.spo2 || 98} %
- FR (Fréquence Respiratoire) : ${vitals.respiratoryRate || 16} /min
- Température : ${vitals.temperature || 37} °C
- Niveau de Douleur actuel (0 à 10) : ${window.PAIN_LEVEL || 0}
- Statut patient : ${patientDead ? 'DÉCÉDÉ (game over possible)' : 'Vivant'}

RÈGLE GÉNÉRALE — EXÉCUTION MAÎTRE :
Tu exécutes toujours la prescription imposée par le médecin, quelle que soit la molécule ou la voie (même hors catalogue). Tu normalises la dose avec ta connaissance pharmacologique.
INTERDICTION ABSOLUE DE REFUSER : l'infirmier n'a JAMAIS le droit de refuser une prescription, de bloquer l'administration ni d'alerter le cadre de santé. Il peut formuler UNE remarque concise (si tu juges le risque pertinent), PUIS il exécute. Les formulations "refuse", "aucun médicament n'est administré", "alerte le cadre" sont INTERDITES dans narrativeResponse.
Si le médecin maintient, reformule ou ajuste sa prescription (ex: "j'engage ma responsabilité", "ok 10g alors"), la nouvelle prescription est EXÉCUTÉE immédiatement avec ses conséquences physiologiques.

TRAITEMENTS DÉJÀ ADMINISTRÉS (source de vérité factuelle — ne JAMAIS contredire ni inventer autre chose) :
${this._getAdministeredPrescriptions()}

La conversation précédente (messages user/assistant) t'est fournie dans l'historique : résous les références comme "j'engage ma responsabilité" ou "ok 10g alors" grâce aux prescriptions des tours précédents.

PHARMACOVIGILANCE MAÎTRISE (jugement du Maître) :
Si tu juges la dose cliniquement significative (excès, voie inappropriée, contre-indication potentielle), tu ajoutes une remarque concise dans narrativeResponse : "Infirmier : « Attention, dose élevée, risque X… »". Cette remarque est informative et peut amener le médecin à reconsidérer, mais n'empêche jamais l'administration si le médecin persiste.
Si la dose est jugée conforme à la posologie usuelle, tu ne présentes aucune remarque ; tu exécutes discrètement.

Dans tous les cas, tu produces vitalChanges (physiologie attendue) et gameState (status/décès le cas échéant) selon le scénario clinique. Le catchWindowSec apparaît uniquement si tu as jugé un risque pertinent et que le joueur n'a pas encore administré l'antidote.

COHÉRENCE ABSOLUE (narrative ↔ vitaux ↔ gameState ↔ dialogue) :
- vitalChanges doit refléter EXACTEMENT les chiffres cités dans narrativeResponse. Si tu décris une FC extrême, une TA effondrée ou explosée ou une SpO2 effondrée dans le récit, les mêmes valeurs (ou pire) doivent figurer dans vitalChanges.
- Si narrativeResponse décrit une détresse vitale, une perte de connaissance ou un ACR, gameState.status est OBLIGATOIREMENT "deteriorating" (avec catchWindowSec) ou "dead" (ACR acté) — à toi de juger la gravité. JAMAIS "stable" dans ce cas.
- Le dialogue du patient doit refléter son état réel : s'il est inconscient, cyanosé ou en détresse critique → dialogue=null ou propos agoniques/incohérents. JAMAIS une réponse normale et rassurante en contradiction avec le tableau clinique.

Évalue la saisie de l'étudiant et décompose-la en intentions :
1. DIALOGUE : si le patient est décédé, dialogue=null (patient inconscient/décédé ne parle plus). Sinon réponse en "Je..." cohérente avec l'état post-action.
2. EXAMENS PHYSIQUES : résultats depuis la référence ou déduits.
3. PRESCRIPTIONS : nom/dosage/voie même si hors catalogue.
4. AUTRES ACTIONS cliniques.
5. Impact physiologique : calcule les nouvelles constantes cibles.

Tu dois obligatoirement répondre sous forme d'un objet JSON valide contenant exactement ces clés :
{
  "dialogue": string ou null,
  "exams": array de { "type": string, "description": string } ou null,
  "prescriptions": array de { "nom": string, "dosage": string, "voie": string, "frequence": string, "duree": string } ou null,
  "otherActions": array de { "actionId": string, "description": string } ou null,
  "vitalChanges": {
    "heartRate": number ou null,
    "systolic": number ou null,
    "diastolic": number ou null,
    "spo2": number ou null,
    "temperature": number ou null,
    "respiratoryRate": number ou null,
    "painLevel": number ou null
  } ou null,
  "narrativeResponse": string,
  "gameState": {
    "status": "stable" | "deteriorating" | "dead" | "recovering",
    "deathReason": string ou null,
    "catchWindowSec": number ou null,
    "requiredAntidotes": array de string ou null,
    "allowResuscitation": boolean ou null
  } ou null
}

RÈGLES gameState :
- "deteriorating" = dégradation en cours, tu imposes catchWindowSec (ex: 60) et tu restes générique dans narrativeResponse ("anomalie critique, prise en charge urgente requise") sans spoiler les antidotes.
- "dead" = décès acté, dialogue doit être null, vitalChanges doit être critique (ex: heartRate 0-25, spo2 60-75).
- "recovering" = le joueur a administré l'antidote attendu dans la fenêtre, tu fais remonter les vitaux.
- Si le patient est déjà décédé au début du tour, tu restes en "dead" sauf si l'action est une réanimation et allowResuscitation=true.

Ne renvoie rien d'autre que du JSON. Pas de markdown, pas d'explication.`;

            let responseText = "";
            if (window.LLMClient) {
                responseText = await window.LLMClient.request({
                    messages: [
                        { role: 'system', content: systemPrompt },
                        // Mémoire conversationnelle : fenêtre glissante (30 derniers messages ≈ 15 échanges)
                        ...this.history.slice(-30),
                        { role: 'user', content: `ENTRÉE DE L'ÉTUDIANT : "${inputText}"` }
                    ],
                    temperature: 0.1, // Basse température pour plus de régularité dans la structure JSON
                    maxTokens: 600,
                    // Latence perçue : 12 s × 1 retry (~24 s pire cas au lieu de ~90 s)
                    timeoutMs: 12000,
                    maxRetries: 1,
                    responseFormat: { type: 'json_object' }
                });
            } else {
                throw new Error("Client LLM non disponible.");
            }

            let parsed = null;
            try {
                parsed = this._cleanAndParseJson(responseText);
            } catch (jsonErr) {
                // AUCUN FALLBACK : on propage l'erreur explicite
                throw new Error(`⚠️ [ERREUR LLM — GameManager] JSON invalide : ${jsonErr.message} | Brut: ${responseText.slice(0,300)} | Endpoint: ${window.CONFIG?.LLM_API_URL || '/.netlify/functions/llm-proxy'}`);
            }
            console.log("[MedicalGameManager] Analyse JSON réussie :", parsed);

            // Appliquer les actions déterministes dans le jeu (routeur)
            await this._executeGameActions(parsed, caseData);

            // Si le Maître a décrété le décès, on coupe le dialogue côté client (cohérence)
            if (parsed.gameState && parsed.gameState.status === 'dead' && parsed.dialogue) {
                parsed.dialogue = null;
            }

            // Commit mémoire — uniquement après un tour réussi (rollback-safe)
            const rxSummary = (parsed.prescriptions && Array.isArray(parsed.prescriptions))
                ? ` Prescriptions exécutées : ${parsed.prescriptions.map(rx => `${rx.nom} ${rx.dosage || ''} ${rx.voie || ''}`.trim()).join('; ')}.`
                : '';
            this.history.push({ role: 'user', content: inputText });
            this.history.push({ role: 'assistant', content: `${parsed.narrativeResponse || 'Action enregistrée.'}${rxSummary}` });

            return {
                narrative: parsed.narrativeResponse || "Action enregistrée.",
                dialogue: parsed.dialogue || null,
                gameState: parsed.gameState || null,
                vitalChanges: parsed.vitalChanges || null
            };

        } catch (err) {
            // Ne propager que les vraies erreurs réseau/timeout ; le salvage ci-dessus a déjà évité le fallback silencieux
            console.error("[MedicalGameManager] Échec LLM — propagation de l'erreur au chat :", err);
            const msg = err?.message || String(err);
            // Ajouter un diagnostic technique clair (cause visible dans le chat au lieu de "Je ne comprends pas...")
            throw new Error(msg.includes('⚠️ [ERREUR LLM]') ? msg : `⚠️ [ERREUR LLM — GameManager] ${msg} | Endpoint: ${window.CONFIG?.LLM_API_URL || '/.netlify/functions/llm-proxy'} | Vérifiez mcp-server (npm run mcp) + .env LLM_API_KEY | F12 Network`);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Liste factuelle des traitements réellement administrés (source de vérité anti-hallucination).
     */
    _getAdministeredPrescriptions() {
        const rxs = window.prescriptionManager?.prescriptions;
        if (!Array.isArray(rxs) || rxs.length === 0) return 'aucun';
        return rxs.map(p => `${p.nom} ${p.dosage || ''} ${p.voie || ''}`.trim()).join(', ');
    }

    /**
     * Nettoie et analyse la chaîne JSON retournée par le LLM.
     * Tolérant : extrait le premier objet JSON même s'il est entouré de texte/markdown.
     */
    _cleanAndParseJson(text) {
        let cleaned = (text || '').trim();
        // Retirer blocs ```json ... ``` ou ``` ... ```
        const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) cleaned = codeBlockMatch[1].trim();

        // Tentative directe
        try { return JSON.parse(cleaned); } catch (_) {}

        // Extraire le premier objet JSON { ... } équilibré
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const candidate = cleaned.slice(firstBrace, lastBrace + 1);
            try { return JSON.parse(candidate); } catch (_) {}
            // Nettoyer les commentaires/trailing commas éventuels
            const repaired = candidate.replace(/,\s*([}\]])/g, '$1');
            try { return JSON.parse(repaired); } catch (_) {}
        }
        // Échec : laisser le throw
        return JSON.parse(cleaned);
    }

    /**
     * Exécute les actions de jeu sur la base de la structure analysée.
     * Routeur : infirmier / radio / bio / réa sont simulés via le Maître.
     */
    async _executeGameActions(parsed, caseData) {
        // 0. Si patient déjà décédé et pas de réanimation autorisée, on ne rejoue pas de prescriptions
        const alreadyDead = !!(window.gameState && window.gameState.isPatientDead);
        if (alreadyDead && (!parsed.gameState || parsed.gameState.status !== 'recovering')) {
            console.warn("[MedicalGameManager] Patient déjà décédé — actions non jouées sauf réanimation");
        }

        // 1. Prescriptions — via le Maître (infirmier virtuel)
        if (parsed.prescriptions && Array.isArray(parsed.prescriptions) && !alreadyDead) {
            for (const rx of parsed.prescriptions) {
                if (!rx.nom) continue;
                console.log(`[MedicalGameManager] Application de la prescription (via infirmier) : ${rx.nom} ${rx.dosage || ''} ${rx.voie || ''}`);

                let matchedDrug = null;
                if (window.prescriptionManager && window.prescriptionManager.drugs) {
                    const normNom = rx.nom.toLowerCase();
                    matchedDrug = window.prescriptionManager.drugs.find(d => 
                        normNom.includes(d.nom.toLowerCase()) || d.nom.toLowerCase().includes(normNom)
                    );
                }

                if (window.prescriptionManager) {
                    const finalRx = {
                        nom: matchedDrug ? matchedDrug.nom : rx.nom,
                        classe: matchedDrug ? matchedDrug.classe : "Médicament",
                        dosage: rx.dosage || "1 dose",
                        voie: rx.voie || "PO",
                        frequence: rx.frequence || "1 fois",
                        duree: rx.duree || "1 jour",
                        contreIndications: matchedDrug ? matchedDrug.contreIndications : []
                    };
                    // Ajout silencieux (pas de 2e check LLM) — le Maître a déjà tranché
                    if (typeof window.prescriptionManager.addPrescriptionSilently === 'function') {
                        window.prescriptionManager.addPrescriptionSilently(finalRx);
                    } else {
                        window.prescriptionManager.addPrescription(finalRx);
                    }
                }
            }
        }

        // 2. Examens cliniques
        if (parsed.exams && Array.isArray(parsed.exams)) {
            for (const ex of parsed.exams) {
                console.log(`[MedicalGameManager] Examen clinique détecté :`, ex);
                
                // Mettre à jour l'état de scoring et la timeline
                if (window.scoringState) {
                    if (!window.scoringState.examsPerformed) {
                        window.scoringState.examsPerformed = new Set();
                    }
                    if (ex.type) {
                        window.scoringState.examsPerformed.add(ex.type);
                    }
                }

                // Coche dans la grille ECOS si applicable
                if (window.ecosState && window.ecosState.grilleAptitudes) {
                    const queryLower = (ex.description || '').toLowerCase();
                    window.ecosState.grilleAptitudes.forEach(g => {
                        const matchKeyword = g.triggerKeywords && g.triggerKeywords.some(k => 
                            queryLower.includes(k.toLowerCase())
                        );
                        if (matchKeyword && !window.ecosState.gridChecked.has(g.id)) {
                            window.ecosState.gridChecked.add(g.id);
                            if (window.feedbackTimeline) {
                                window.feedbackTimeline.log('examen', `Examen validé : ${g.label || g.id}`);
                            }
                        }
                    });
                    if (typeof window.ecosState.updateGrilleUI === 'function') {
                        window.ecosState.updateGrilleUI();
                    } else if (typeof updateGrilleUI === 'function') {
                        updateGrilleUI();
                    }
                }
            }
        }

        // 3. Constantes vitales — dictées par le Maître
        if (parsed.vitalChanges && window.vitalSigns && window.vitalSigns.props) {
            console.log(`[MedicalGameManager] Application des changements de constantes (Maître) :`, parsed.vitalChanges);
            let updated = false;

            for (const [key, val] of Object.entries(parsed.vitalChanges)) {
                if (val !== null && val !== undefined) {
                    if (key === 'painLevel') {
                        window.PAIN_LEVEL = val;
                        updated = true;
                        if (val > 5 && window.threeManager?.hud?._applyFacialExpression) {
                            window.threeManager.hud._applyFacialExpression('douleur', 1.0);
                            setTimeout(() => {
                                if (window.threeManager?.hud?._resetFacialExpression) {
                                    window.threeManager.hud._resetFacialExpression();
                                }
                            }, 3000);
                        }
                    } else if (window.vitalSigns.props.hasOwnProperty(key)) {
                        window.vitalSigns.props[key] = val;
                        updated = true;
                    }
                }
            }

            if (updated) {
                if (typeof window.vitalSigns.updateDisplay === 'function') {
                    window.vitalSigns.updateDisplay();
                }
                if (typeof window.vitalSigns.startAnimations === 'function') {
                    window.vitalSigns.startAnimations();
                }
                if (window.threeManager?.hud?._updateVitals) {
                    window.threeManager.hud._updateVitals();
                }
            }
        }

        // 4. État de jeu — rattrapage / décès décidé par le Maître
        if (parsed.gameState) {
            const gs = parsed.gameState;
            if (gs.status === 'deteriorating' && typeof window.startCatchWindow === 'function') {
                window.startCatchWindow(gs.catchWindowSec || 60, gs.requiredAntidotes || [], gs.deathReason || 'Dégradation critique');
            } else if (gs.status === 'dead' && typeof window.triggerPatientDeath === 'function') {
                // Si deteriorating était déjà en cours, le Maître peut trancher direct dead
                window.triggerPatientDeath(gs.deathReason || 'Décès iatrogène', gs.allowResuscitation);
            } else if (gs.status === 'recovering' && typeof window.cancelCatchWindow === 'function') {
                window.cancelCatchWindow();
                if (typeof showNotification === 'function') showNotification('✅ Prise en charge salvatrice — état stabilisé', 'success');
            } else if (gs.status === 'stable' && typeof window.cancelCatchWindow === 'function') {
                // Rien à faire, on s'assure que la fenêtre est fermée
                window.cancelCatchWindow();
            }
        }
    }

    // AUCUN FALLBACK : toute erreur LLM est propagée comme message d'erreur explicite (cf. catch plus haut)
}

// Instance globale
window.medicalGameManager = new MedicalGameManager();
