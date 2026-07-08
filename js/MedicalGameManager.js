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

        const vitals = window.vitalSigns?.props || {
            heartRate: 80, systolic: 120, diastolic: 80, spo2: 98, temperature: 37, respiratoryRate: 16
        };

        this.isProcessing = true;

        try {
            console.log(`[MedicalGameManager] Analyse de l'entrée : "${inputText}"`);

            const systemPrompt = `Tu es le "Game Manager" (Maître du Jeu) d'une simulation médicale immersive pour étudiants en médecine.
Ton rôle est de traduire les actions ou questions en langage naturel soumises par l'étudiant en actions concrètes dans le jeu, de simuler la physiologie du patient et de générer une réponse narrative globale et immersive.

Voici le cas clinique actuel :
- Patient : ${JSON.stringify(caseData.patient || {})}
- Motifs et histoire : ${JSON.stringify(caseData.interrogatoire || {})}
- Examen physique disponible (référence) : ${JSON.stringify(caseData.examenClinique || {})}
- Examens complémentaires (si demandés) : ${JSON.stringify(caseData.examResults || {})}

Voici les constantes vitales courantes du patient :
- FC (Fréquence Cardiaque) : ${vitals.heartRate || vitals.HR || 80} bpm
- Tension : ${(vitals.systolic || 120)}/${(vitals.diastolic || 80)} mmHg
- SpO2 : ${vitals.spo2 || 98} %
- FR (Fréquence Respiratoire) : ${vitals.respiratoryRate || 16} /min
- Température : ${vitals.temperature || 37} °C
- Niveau de Douleur actuel (0 à 10) : ${window.PAIN_LEVEL || 0}

Évalue la saisie de l'étudiant et décompose-la en intentions. Tu dois :
1. Identifier s'il y a du DIALOGUE (des questions verbales posées au patient). Si oui, formule une réponse verbale à la première personne du singulier ("Je...", "Moi...") que le patient dirait en réponse, cohérente avec son histoire et son état.
2. Identifier s'il y a des EXAMENS PHYSIQUES (ex: palpation, auscultation). Si oui, extrais les résultats correspondants de la référence clinique ou déduis-les cliniquement s'ils ne sont pas spécifiés.
3. Identifier s'il y a des PRESCRIPTIONS de médicaments ou traitements.
4. Identifier s'il y a d'AUTRES ACTIONS cliniques (ex: brancher le scope, positionner en PLS).
5. Calculer l'impact physiologique immédiat sur les constantes (ex: si palpation douloureuse, FC augmente temporairement de +10 bpm, douleur augmente ; si paracétamol ou trinitrine donné pour douleur, douleur diminue de -2, FC baisse de -5 bpm ; si détresse respiratoire et O2 administré, SpO2 s'améliore de +3%, FR baisse de -4, etc.).

Tu dois obligatoirement répondre sous forme d'un objet JSON valide contenant exactement ces clés :
{
  "dialogue": string ou null (réponse verbale du patient s'il y a une question, sinon null),
  "exams": array de { "type": "palpation_abdo"|"auscultation_pulm"|"auscultation_card"|"reflex_osteo"|"inspection"|"other", "description": "résultat clinique descriptif" } ou null,
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
  "narrativeResponse": string (description narrative à la 2ème personne du pluriel "Vous..." décrivant l'action effectuée par l'étudiant, la réaction physique visible du patient et les changements physiologiques, ex: "Vous palpez l'abdomen inférieur droit. Le patient grimace de douleur et se contracte...")
}

Ne renvoie rien d'autre que du JSON. Pas de markdown (sans blocs de code ni \`\`\`json), pas d'explication.`;

            let responseText = "";
            if (window.LLMClient) {
                responseText = await window.LLMClient.request({
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `ENTRÉE DE L'ÉTUDIANT : "${inputText}"` }
                    ],
                    temperature: 0.1, // Basse température pour plus de régularité dans la structure JSON
                    maxTokens: 600
                });
            } else {
                throw new Error("Client LLM non disponible.");
            }

            const parsed = this._cleanAndParseJson(responseText);
            console.log("[MedicalGameManager] Analyse JSON réussie :", parsed);

            // Appliquer les actions déterministes dans le jeu
            await this._executeGameActions(parsed, caseData);

            return {
                narrative: parsed.narrativeResponse || "Action enregistrée.",
                dialogue: parsed.dialogue || null
            };

        } catch (err) {
            console.warn("[MedicalGameManager] Erreur ou échec LLM, exécution du fallback local :", err);
            return this._fallbackLocal(inputText, caseData, vitals);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Nettoie et analyse la chaîne JSON retournée par le LLM.
     */
    _cleanAndParseJson(text) {
        let cleaned = (text || '').trim();
        if (cleaned.startsWith('```json')) {
            cleaned = cleaned.substring(7);
        } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.substring(3);
        }
        if (cleaned.endsWith('```')) {
            cleaned = cleaned.substring(0, cleaned.length - 3);
        }
        cleaned = cleaned.trim();
        return JSON.parse(cleaned);
    }

    /**
     * Exécute les actions de jeu sur la base de la structure analysée.
     */
    async _executeGameActions(parsed, caseData) {
        // 1. Prescriptions
        if (parsed.prescriptions && Array.isArray(parsed.prescriptions)) {
            for (const rx of parsed.prescriptions) {
                if (!rx.nom) continue;
                console.log(`[MedicalGameManager] Application de la prescription : ${rx.nom}`);

                // Recherche d'un médicament équivalent dans le PrescriptionManager
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
                    window.prescriptionManager.addPrescription(finalRx);
                }

                // Appliquer l'impact du traitement sur les constantes vitales
                if (window.vitalSigns && typeof window.vitalSigns.applyTreatmentImpact === 'function') {
                    window.vitalSigns.applyTreatmentImpact(rx.nom);
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

        // 3. Constantes vitales
        if (parsed.vitalChanges && window.vitalSigns && window.vitalSigns.props) {
            console.log(`[MedicalGameManager] Application des changements de constantes :`, parsed.vitalChanges);
            let updated = false;

            for (const [key, val] of Object.entries(parsed.vitalChanges)) {
                if (val !== null && val !== undefined) {
                    if (key === 'painLevel') {
                        window.PAIN_LEVEL = val;
                        updated = true;
                        
                        // Expression faciale 3D en cas de douleur élevée (> 5)
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
    }

    /**
     * Fallback de secours en local avec règles déterministes (sans LLM).
     */
    _fallbackLocal(inputText, caseData, vitals) {
        console.info("[MedicalGameManager] Fallback local déclenché.");
        const textLower = inputText.toLowerCase();

        let narrative = "Vous examinez le patient.";
        let dialogue = null;

        // Détection sommaire de traitement
        if (textLower.includes("paracétamol") || textLower.includes("paracetamol")) {
            narrative = "Vous administrez 1g de Paracétamol. Le patient semble légèrement soulagé.";
            if (window.prescriptionManager) {
                window.prescriptionManager.addPrescription({
                    nom: "Paracétamol", classe: "Antalgique", dosage: "1g", voie: "PO", frequence: "1 fois", duree: "1 jour", contreIndications: []
                });
            }
            if (window.vitalSigns) {
                window.vitalSigns.applyTreatmentImpact("Paracétamol");
                window.PAIN_LEVEL = Math.max(0, (window.PAIN_LEVEL || 4) - 2);
                window.vitalSigns.updateDisplay();
            }
        }

        // Détection sommaire d'examen
        if (textLower.includes("palpe") || textLower.includes("palpation")) {
            const abdoResult = caseData.examenClinique?.examenAbdominal?.palpation || "Abdomen souple, indolore.";
            narrative = `Vous palpez le patient. Résultat abdominal : ${abdoResult}`;
            
            if (abdoResult.toLowerCase().includes("douleur") || abdoResult.toLowerCase().includes("sensible")) {
                window.PAIN_LEVEL = Math.min(10, (window.PAIN_LEVEL || 0) + 2);
                if (window.threeManager?.hud?._applyFacialExpression) {
                    window.threeManager.hud._applyFacialExpression('douleur', 1.0);
                    setTimeout(() => window.threeManager.hud._resetFacialExpression(), 2500);
                }
                if (window.vitalSigns) window.vitalSigns.updateDisplay();
            }
        }

        // Détection de dialogue simple
        if (window.llmFallback) {
            dialogue = window.llmFallback.answer(inputText, caseData);
        } else {
            dialogue = "Je ne me sens pas très bien, docteur.";
        }

        return { narrative, dialogue };
    }
}

// Instance globale
window.medicalGameManager = new MedicalGameManager();
