/**
 * js/MedicalGameManager.js — Maître du Jeu / Game Manager
 *
 * LE SEUL routeur LLM du jeu, en 2D comme en 3D : chaque réplique ou action
 * de l'étudiant fait UN appel. Le prompt et l'analyse de la réponse viennent
 * de js/patient-brain.js (partagé avec le moteur des agents IA) ; ici on
 * applique le résultat au jeu (constantes, prescriptions, grille, décès) et
 * on diffuse les événements que la voix, la jauge et la 3D écoutent :
 *   medgame:patient-dialogue-progress / patient-sentence  (flux)
 *   medgame:patient-reply / turn-applied                   (fin de tour)
 */

class MedicalGameManager {
    constructor() {
        this.isProcessing = false;
        this.history = [];   // Mémoire conversationnelle complète (user/assistant)
        this.caseId = null;  // Détection de changement de cas → reset mémoire
        this.insistence = {}; // champ du dossier → nb de questions qui l'ont visé
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
            this.insistence = {};
            this.caseId = caseData.id;
            console.log(`[MedicalGameManager] Nouveau cas (${caseData.id}) — mémoire réinitialisée`);
        }

        const vitals = window.vitalSigns?.props || {
            heartRate: 80, systolic: 120, diastolic: 80, spo2: 98, temperature: 37, respiratoryRate: 16
        };

        this.isProcessing = true;

        try {
            console.log(`[MedicalGameManager] Analyse de l'entrée : "${inputText}"`);

            // Le prompt vient du cerveau unique (js/patient-brain.js), partagé
            // avec le moteur des agents IA (engine/MedGameEngine.js).
            const brain = window.PatientBrain;
            if (!brain) throw new Error('js/patient-brain.js non chargé.');
            const snap = window.PatientLive?.snapshot?.() || null;
            const systemPrompt = brain.buildSystemPrompt({
                caseData,
                vitals,
                pain: Number(window.PAIN_LEVEL) || 0,
                dead: !!(window.gameState && window.gameState.isPatientDead),
                administered: this._getAdministeredList(),
                alliance: snap ? { trust: snap.trust, anxiety: snap.anxiety } : undefined,
                allianceSnapshot: snap,
                insistence: this.insistence,
                studyLevel: window.StudyLevel ? window.StudyLevel.currentId() : null
            });
            this._trackInsistence(inputText, caseData);

            // Flux : la réplique du patient est extraite du JSON en cours
            // d'écriture et part phrase par phrase vers la voix et l'écran.
            const turnId = `gm-${Date.now().toString(36)}`;
            const live = window.PatientLiveCore;
            const stream = { buf: '', spoken: 0, emotion: null, lastShown: '' };
            const onToken = (token) => {
                if (!live) return;
                // Nouvel essai après une coupure : on repart d'un JSON neuf sans
                // redire ce qui a déjà été dit.
                if (/^\s*\{/.test(token) && /"dialogue"/.test(stream.buf)) stream.buf = '';
                stream.buf += token;
                if (!stream.emotion) {
                    const em = live.extractStreamingField(stream.buf, 'emotion');
                    if (em.done) stream.emotion = em.text;
                }
                const d = live.extractStreamingField(stream.buf, 'dialogue');
                if (!d.found || d.isNull || !d.text) return;
                if (d.text !== stream.lastShown) {
                    stream.lastShown = d.text;
                    document.dispatchEvent(new CustomEvent('medgame:patient-dialogue-progress', { detail: { text: d.text } }));
                }
                if (d.text.length <= stream.spoken) return;
                const { sentences, next } = live.takeSentences(d.text, stream.spoken, d.done);
                stream.spoken = next;
                for (const s of sentences) {
                    document.dispatchEvent(new CustomEvent('medgame:patient-sentence', { detail: { text: s, emotion: stream.emotion, turnId } }));
                }
            };

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
                    // Le tour peut porter le compte rendu de plusieurs collègues.
                    maxTokens: 1100,
                    // Latence perçue : 20 s × 1 retry (~40 s pire cas au lieu de ~90 s)
                    timeoutMs: 20000,
                    maxRetries: 1,
                    stream: !!live,
                    onToken,
                    responseFormat: { type: 'json_object' }
                });
            } else {
                throw new Error("Client LLM non disponible.");
            }

            let parsed = null;
            try {
                parsed = brain.parseReply(responseText);
            } catch (jsonErr) {
                // AUCUN FALLBACK : on propage l'erreur explicite
                throw new Error(`⚠️ [ERREUR LLM — GameManager] JSON invalide : ${jsonErr.message} | Brut: ${responseText.slice(0,300)} | Endpoint: ${window.CONFIG?.LLM_API_URL || '/.netlify/functions/llm-proxy'}`);
            }
            console.log("[MedicalGameManager] Analyse JSON réussie :", parsed);

            // Appliquer les actions déterministes dans le jeu (routeur)
            await this._executeGameActions(parsed, caseData);

            // Commit mémoire — uniquement après un tour réussi (rollback-safe)
            const rxSummary = (parsed.prescriptions && Array.isArray(parsed.prescriptions))
                ? ` Prescriptions exécutées : ${parsed.prescriptions.map(rx => `${rx.nom} ${rx.dosage || ''} ${rx.voie || ''}`.trim()).join('; ')}.`
                : '';
            this.history.push({ role: 'user', content: inputText });
            const team = (parsed.team || []).map(m => ({ ...m, speaker: brain.teamSpeakerLabel(m, caseData) }));
            const teamSummary = team.map(m => ` ${m.speaker} : « ${m.says} »`).join('');
            this.history.push({ role: 'assistant', content: `${parsed.dialogue ? `Patient : « ${parsed.dialogue} » ` : ''}${parsed.narrativeResponse || (team.length ? '' : 'Action enregistrée.')}${teamSummary}${rxSummary}` });

            // Consultation en direct (js/patient-live.js) : alliance, émotion,
            // et la fin de la réplique si le flux ne l'a pas déjà dite.
            document.dispatchEvent(new CustomEvent('medgame:patient-reply', {
                detail: {
                    text: parsed.dialogue || '',
                    emotion: parsed.emotion || null,
                    alliance: parsed.alliance || null,
                    turnId,
                    source: 'gm'
                }
            }));
            // Effets de scène (3D) et suivi : js/clinicalAgentAI.js, js/three-hud-agent.js.
            document.dispatchEvent(new CustomEvent('medgame:turn-applied', { detail: { input: inputText, parsed, turnId } }));

            if (team.length) {
                document.dispatchEvent(new CustomEvent('medgame:team-reply', { detail: { team, turnId } }));
            }

            return {
                // Quand un collègue répond, sa parole suffit : pas de récit par défaut.
                narrative: parsed.narrativeResponse || (team.length ? '' : "Action enregistrée."),
                dialogue: parsed.dialogue || null,
                team,
                emotion: parsed.emotion,
                gameState: parsed.gameState || null,
                vitalChanges: parsed.vitalChanges || null
            };

        } catch (err) {
            // Ne propager que les vraies erreurs réseau/timeout ; le salvage ci-dessus a déjà évité le fallback silencieux
            console.error("[MedicalGameManager] Échec LLM — propagation de l'erreur au chat :", err);
            // Quota épuisé : propager l'erreur typée telle quelle (modale login/mailto, pas de diagnostic technique).
            if (err?.code === 'QUOTA_EXCEEDED' || window.QuotaGuard?.isQuotaError?.(err)) throw err;
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
    _getAdministeredList() {
        const rxs = window.prescriptionManager?.prescriptions;
        if (!Array.isArray(rxs)) return [];
        return rxs.map(p => `${p.nom} ${p.dosage || ''} ${p.voie || ''}`.trim());
    }

    /**
     * Compte les questions qui visent chaque champ caché : à la deuxième
     * insistance, le patient peut avouer (règle du cerveau, js/patient-brain.js).
     */
    _trackInsistence(text, caseData) {
        const hidden = caseData.dialogue?.si_insiste || caseData.ecos?.patientStandardise?.infosCachees || [];
        const q = (window.PatientLiveCore?.normalize?.(text) || String(text).toLowerCase());
        for (const path of hidden) {
            if (!/^[a-zA-Z.]+$/.test(String(path))) continue;
            const last = String(path).split('.').pop().replace(/([A-Z])/g, ' $1').toLowerCase();
            const words = last.split(/\s+/).filter(w => w.length > 3);
            if (words.some(w => q.includes(w.slice(0, 5)))) {
                const key = `interrogatoire.${String(path).replace(/^interrogatoire\./, '')}`;
                this.insistence[key] = (this.insistence[key] || 0) + 1;
            }
        }
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

        // 1 bis. Ce que le patient a révélé compte pour l'interrogatoire.
        if (Array.isArray(parsed.disclosedInfoFields)) {
            for (const raw of parsed.disclosedInfoFields) {
                const path = raw.startsWith('interrogatoire.') ? raw : `interrogatoire.${raw}`;
                if (typeof trackInterrogatoire === 'function') trackInterrogatoire(path);
                document.dispatchEvent(new CustomEvent('interrogatoire-asked', { detail: { path } }));
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

                // Enregistrer l'examen complémentaire dans activeExams pour affichage dans l'onglet des résultats
                const examName = ex.nom || ex.description || ex.type;
                if (caseData && caseData.examResults && examName) {
                    const normReq = String(examName).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const matchedKey = Object.keys(caseData.examResults).find(k => {
                        const normK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        return normK.includes(normReq) || normReq.includes(normK);
                    });
                    if (matchedKey && window.gameState) {
                        if (!window.gameState.activeExams) window.gameState.activeExams = [];
                        if (!window.gameState.activeExams.includes(matchedKey)) {
                            window.gameState.activeExams.push(matchedKey);
                            // Un examen demandé à l'oral compte comme un examen prescrit.
                            if (typeof window.trackExamsOrdered === 'function') {
                                window.trackExamsOrdered([...window.gameState.activeExams]);
                            }
                            if (typeof window.renderExamResults === 'function') {
                                window.renderExamResults();
                            }
                        }
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
                        window.PAIN_LEVEL = Math.max(0, Math.min(10, val));
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
