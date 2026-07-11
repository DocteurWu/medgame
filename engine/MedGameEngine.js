import fs from 'fs/promises';
import path from 'path';

function getFriendlySubjectName(path) {
    const mapping = {
        'motifHospitalisation': 'le motif de votre venue / pourquoi vous êtes là',
        'histoireMaladie.debutSymptomes': 'quand vos symptômes ont commencé / depuis combien de temps vous souffrez',
        'histoireMaladie.symptomesActuels': 'la description de vos symptômes ou douleurs actuels',
        'histoireMaladie.descriptionDouleur': 'la description de vos symptômes ou douleurs actuels',
        'histoireMaladie.evolution': 'l\'évolution de vos symptômes ou de vos douleurs',
        'histoireMaladie.facteursDeclenchants': 'ce qui déclenche ou aggrave vos symptômes (ex: effort, repas)',
        'histoireMaladie.facteursCalmants': 'ce qui calme ou soulage vos symptômes (ex: repos, médicaments)',
        'histoireMaladie.symptomesAssocies': 'vos autres symptômes ou signes associés (ex: sueurs, vertiges, essoufflement)',
        'antecedents.medicaux': 'vos antécédents médicaux / vos maladies connues',
        'antecedents.chirurgicaux': 'vos antécédents chirurgicaux / vos opérations passées',
        'antecedents.familiaux': 'vos antécédents familiaux / les maladies dans votre famille (père, mère, fratrie)',
        'traitements': 'vos traitements habituels / vos médicaments de tous les jours',
        'allergies': 'vos allergies ou réactions à des médicaments / aliments',
        'modeDeVie.tabac': 'votre consommation de tabac / si vous fumez',
        'modeDeVie.alcool': 'votre consommation d\'alcool',
        'modeDeVie.activitePhysique': 'votre activité physique / sport',
        'modeDeVie.alimentation': 'votre régime alimentaire / ce que vous mangez',
        'modeDeVie.emploi': 'votre profession / travail ou niveau de stress'
    };
    return mapping[path] || path;
}

function normalizeText(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9]/g, " ")      // replace non-alphanumeric with spaces
        .replace(/\s+/g, " ")            // collapse spaces
        .trim();
}

function getLevenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

export class MedGameEngine {
    constructor(config = {}) {
        this.apiKey = config.apiKey || process.env.LLM_API_KEY || '';
        this.apiUrl = config.apiUrl || process.env.LLM_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
        this.model = config.model || process.env.LLM_MODEL || 'tencent/hy3:free';
        this.resetState();
    }

    resetState() {
        this.caseData = null;
        this.startedAt = null;
        this.timeLimit = 480; // 8 minutes default
        this.timePenalties = 0;
        this.baseVitals = {};
        this.vitals = {};
        this.painLevel = 0;
        this.activeExams = [];
        this.selectedTreatments = [];
        this.selectedDiagnostic = '';
        this.attempts = 0;
        this.chatHistory = [];
        this.isFinished = false;
        
        // Progress tracking (démarche)
        this.demarche = {
            interrogatoireAsked: new Set(),
            examsOrdered: [],
            examSectionsViewed: new Set(),
            locksUnlocked: new Set()
        };

        // Semio lock attempts tracking
        this.lockAttempts = {};
    }

    async listCases() {
        const caseIndexPath = path.join(process.cwd(), 'data', 'case-index.json');
        try {
            const data = await fs.readFile(caseIndexPath, 'utf-8');
            return JSON.parse(data);
        } catch (err) {
            throw new Error(`Failed to load case index from ${caseIndexPath}: ${err.message}`);
        }
    }

    async startCase(caseId) {
        this.resetState();
        
        // Read case data from local JSON
        const safeCaseId = path.basename(caseId); // prevent directory traversal
        const casePath = path.join(process.cwd(), 'data', safeCaseId.endsWith('.json') ? safeCaseId : `${safeCaseId}.json`);
        
        try {
            const data = await fs.readFile(casePath, 'utf-8');
            this.caseData = JSON.parse(data);
        } catch (err) {
            throw new Error(`Failed to load case ${caseId} at path ${casePath}: ${err.message}`);
        }

        this.startedAt = Date.now();
        
        // Parse time limit
        if (this.caseData.gameplayConfig?.timeLimit) {
            this.timeLimit = this.caseData.gameplayConfig.timeLimit;
        } else if (this.caseData.vitalsDynamics?.urgencyMultiplier > 1.8) {
            this.timeLimit = 300; // Urgencies default to 5 min
        } else {
            this.timeLimit = 480; // ECOS standard 8 min
        }

        // Initialize vitals
        const constantes = this.caseData.examenClinique?.constantes || {};
        const bpMatch = (constantes.tension || '').match(/(\d+)\/(\d+)/);
        
        this.baseVitals = {
            systolic: bpMatch ? parseInt(bpMatch[1]) : 120,
            diastolic: bpMatch ? parseInt(bpMatch[2]) : 80,
            heartRate: parseInt(constantes.pouls) || 80,
            spo2: parseInt(constantes.saturationO2) || 98,
            temperature: parseFloat(constantes.temperature) || 37.0,
            respiratoryRate: parseInt(constantes.frequenceRespiratoire) || 16
        };

        this.painLevel = 0;
        this.updateVitals();

        // Introduce the patient standard greeting in chat history
        const patient = this.caseData.patient || {};
        const nom = `${patient.prenom || ''} ${patient.nom || 'le patient'}`.trim();
        const ecosData = this.caseData.ecos?.patientStandardise;
        
        let intro = '';
        if (ecosData?.phraseOuverture) {
            intro = ecosData.phraseOuverture;
        } else {
            const motif = this.caseData.interrogatoire?.motifHospitalisation || '';
            intro = motif
                ? `Bonjour docteur. Je m'appelle ${nom}, je suis ici pour ${motif.toLowerCase()}.`
                : `Bonjour docteur, je suis ${nom}. Qu'est-ce que vous voulez savoir ?`;
        }

        this.chatHistory.push({ role: 'assistant', content: intro });

        return this.getState();
    }

    updateVitals() {
        if (!this.caseData) return;
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - this.startedAt) / 1000) + this.timePenalties;
        
        // Vitals Dynamics trend
        const dyn = this.caseData.vitalsDynamics || {};
        const trendOverMinutes = dyn.trendOverMinutes || 0.08;
        const targets = dyn.aggravationTargets || {};
        
        const minutesElapsed = elapsedSeconds / 60;
        let trendFraction = minutesElapsed * trendOverMinutes;

        // Check if correct treatment has been prescribed to stabilize
        const correctTreatments = this.caseData.correctTreatments || [];
        const isStabilized = this.selectedTreatments.some(t => correctTreatments.includes(t));
        
        if (isStabilized && dyn.stabilizeOnCorrectTreatment !== false) {
            trendFraction = Math.max(0, trendFraction - (minutesElapsed * 0.1)); // slow recovery
        }

        trendFraction = Math.min(1.0, Math.max(0.0, trendFraction));

        const currentVitals = {};
        for (const key of ['heartRate', 'systolic', 'diastolic', 'spo2', 'temperature', 'respiratoryRate']) {
            const base = this.baseVitals[key];
            const target = targets[key] !== undefined ? targets[key] : base;
            
            // Interpolate base -> target
            let val = base + (target - base) * trendFraction;
            
            // Physiological sinus variation
            const cycle = key === 'heartRate' || key === 'respiratoryRate' ? 5 : 8;
            const phase = Math.sin((elapsedSeconds % cycle) / cycle * Math.PI * 2);
            const physioAmplitude = key === 'temperature' ? 0.08 : base * 0.015;
            val += phase * physioAmplitude;
            
            if (key === 'temperature') {
                currentVitals[key] = Math.round(val * 10) / 10;
            } else {
                currentVitals[key] = Math.round(val);
            }
        }
        this.vitals = currentVitals;
    }

    getTimeLeft() {
        if (!this.startedAt) return 0;
        const elapsed = Math.floor((Date.now() - this.startedAt) / 1000) + this.timePenalties;
        return Math.max(0, this.timeLimit - elapsed);
    }

    getState() {
        if (!this.caseData) {
            return { success: false, error: "No case active" };
        }

        if (this.getTimeLeft() === 0 && !this.isFinished && this.startedAt) {
            this.submit();
        }

        this.updateVitals();
        
        // Auto-mark clinical exam viewed since we check the state
        this.demarche.examSectionsViewed.add('section-examen-clinique');

        // Serialized locks
        const locks = (this.caseData.locks || []).map(l => {
            const isUnlocked = this.demarche.locksUnlocked.has(l.id);
            return {
                id: l.id,
                unlocked: isUnlocked,
                targetFields: l.target_fields,
                prerequisites: l.prerequisites || [],
                type: l.type,
                challenge: {
                    question: l.challenge?.question,
                    options: l.challenge?.options
                }
            };
        });

        // Exam results available to user
        const examResults = {};
        for (const exam of this.activeExams) {
            const path = `examResults.${exam}`;
            if (this.isFieldLocked(path)) {
                examResults[exam] = "🔒 [Verrouillé - Résolvez le défi sémiologique correspondant]";
            } else {
                examResults[exam] = this.caseData.examResults?.[exam] || "Résultat normal ou non significatif.";
            }
        }

        let availableDiagnostics = this.caseData.possibleDiagnostics || [];
        if (this.isFieldLocked('possibleDiagnostics')) {
            availableDiagnostics = ["🔒 [Verrouillé - Résolvez le défi sémiologique correspondant (Terrain cardiovasculaire)]"];
        }

        let availableTreatments = this.caseData.possibleTreatments || [];
        if (this.isFieldLocked('possibleTreatments')) {
            availableTreatments = ["🔒 [Verrouillé - Résolvez le défi sémiologique correspondant (Sondage vésical et massage utérin)]"];
        }

        return {
            success: true,
            caseId: this.caseData.id,
            caseTitle: this.caseData.titre || this.caseData.id,
            specialty: this.caseData.specialite,
            difficulty: this.caseData.difficulty || 1,
            patient: {
                nom: this.caseData.patient?.nom,
                prenom: this.caseData.patient?.prenom,
                age: this.caseData.patient?.age,
                sexe: this.caseData.patient?.sexe,
                taille: this.caseData.patient?.taille,
                poids: this.caseData.patient?.poids,
                groupeSanguin: this.caseData.patient?.groupeSanguin
            },
            vitals: this.vitals,
            locks: locks,
            activeExams: this.activeExams,
            examResults: examResults,
            prescriptions: {
                selectedTreatments: this.selectedTreatments
            },
            availableDiagnostics: availableDiagnostics,
            availableTreatments: availableTreatments,
            availableExams: this.caseData.availableExams || [],
            score: this.score || 0,
            attempts: this.attempts,
            chatHistory: this.chatHistory,
            isFinished: this.isFinished,
            scoreBreakdown: this.isFinished ? this.calculateCompositeScore() : null,
            timeLeft: this.getTimeLeft()
        };
    }

    isFieldLocked(path) {
        if (!this.caseData?.locks) return false;
        for (const lock of this.caseData.locks) {
            if (lock.target_fields.includes(path) && !this.demarche.locksUnlocked.has(lock.id)) {
                return true;
            }
        }
        return false;
    }

    getLockStatus(lock) {
        if (this.demarche.locksUnlocked.has(lock.id)) {
            return { canUnlock: true, missingPrereqs: [] };
        }
        const prereqs = lock.prerequisites || [];
        const missingPrereqs = prereqs.filter(pId => !this.demarche.locksUnlocked.has(pId));
        return {
            canUnlock: missingPrereqs.length === 0,
            missingPrereqs
        };
    }

    trackInterrogatoireByKeywords(text) {
        const q = text.toLowerCase();
        
        const keywordMapping = [
            { path: 'interrogatoire.modeDeVie.activitePhysique.description', keywords: ['sport', 'physique', 'activite', 'marche'] },
            { path: 'interrogatoire.modeDeVie.tabac', keywords: ['tabac', 'fume', 'cigarette', 'fumer'] },
            { path: 'interrogatoire.modeDeVie.alcool.quantite', keywords: ['alcool', 'boire', 'boisson', 'verre'] },
            { path: 'interrogatoire.modeDeVie.alimentation', keywords: ['mange', 'repas', 'alimentation', 'regime'] },
            { path: 'interrogatoire.modeDeVie.emploi', keywords: ['travail', 'metier', 'profession', 'stress', 'emploi'] },
            { path: 'interrogatoire.antecedents.medicaux', keywords: ['antecedent', 'maladie', 'hospitalise', 'medicaux'] },
            { path: 'interrogatoire.antecedents.chirurgicaux', keywords: ['operation', 'chirurgie', 'opere', 'chirurgicaux'] },
            { path: 'interrogatoire.antecedents.familiaux', keywords: ['famille', 'parent', 'pere', 'mere', 'familiaux'] },
            { path: 'interrogatoire.traitements', keywords: ['traitement', 'medicament', 'ordonnance', 'prends', 'prenez'] },
            { path: 'interrogatoire.allergies', keywords: ['allergie', 'allergique'] },
            { path: 'interrogatoire.histoireMaladie.debutSymptomes', keywords: ['quand', 'debut', 'depuis', 'symptomes'] },
            { path: 'interrogatoire.histoireMaladie.descriptionDouleur', keywords: ['douleur', 'mal', 'poitrine', 'thoracique', 'type', 'constrictive'] },
            { path: 'interrogatoire.histoireMaladie.evolution', keywords: ['evolution', 'evolue', 'aggrave', 'stable'] },
            { path: 'interrogatoire.histoireMaladie.facteursDeclenchants', keywords: ['declenche', 'provoque', 'aggrave', 'effort'] },
            { path: 'interrogatoire.histoireMaladie.symptomesAssocies', keywords: ['associe', 'autre', 'accompagne', 'dyspnee'] },
            { path: 'interrogatoire.histoireMaladie.remarques', keywords: ['remarque', 'autre chose', 'preciser'] }
        ];

        for (const map of keywordMapping) {
            if (map.keywords.some(k => q.includes(k))) {
                this.demarche.interrogatoireAsked.add(map.path);
            }
        }
    }

    async chat(text) {
        if (!this.caseData) {
            throw new Error("No active case.");
        }
        if (this.isFinished) {
            throw new Error("Game is already finished.");
        }

        // Add user message to history
        this.chatHistory.push({ role: 'user', content: text });
        this.trackInterrogatoireByKeywords(text);

        // Perform LLM request
        if (!this.apiKey) {
            throw new Error("API Key for LLM is not configured. Please set the LLM_API_KEY environment variable.");
        }

        this.updateVitals();

        let ecosPrompt = '';
        if (this.caseData.ecos?.patientStandardise) {
            const ep = this.caseData.ecos.patientStandardise;
            const voluntaries = (ep.infosVolontaires || []).map(path => `- Tu es autorisé(e) à parler librement de : ${getFriendlySubjectName(path)}`).join('\n');
            const requested = (ep.infosSiDemandees || []).map(path => `- Tu ne dois divulguer d'informations sur : "${getFriendlySubjectName(path)}" QUE si le médecin te le demande explicitement (ne devance pas ses questions)`).join('\n');
            const hidden = (ep.infosCachees || []).map(path => `- Tu ne dois divulguer d'informations sur : "${getFriendlySubjectName(path)}" QUE si le médecin insiste lourdement ou pose la question plusieurs fois (reste évasif ou dis que ce n'est rien au premier abord)`).join('\n');

            ecosPrompt = `
TA PERSONNALITÉ ET COMPORTEMENT DE PATIENT STANDARDISÉ (ECOS) :
- Caractère/Personnalité : ${ep.personnalite || 'Coopératif'}
- Phrase d'ouverture : "${ep.phraseOuverture || ''}"
- Directives de divulgation d'informations :
${voluntaries ? `[INFORMATIONS QUE TU PEUX RÉVÉLER VOLONTAIREMENT]\n${voluntaries}\n` : ''}
${requested ? `[INFORMATIONS À NE RÉVÉLER QUE SI LE MÉDECIN LE DEMANDE EXPLICITEMENT]\n${requested}\n` : ''}
${hidden ? `[INFORMATIONS CACHÉES / À NE RÉVÉLER QUE SI LE MÉDECIN INSISTE LOURDEMENT]\n${hidden}\n` : ''}
- Réactions comportementales : ${JSON.stringify(ep.reactions || {})}
`;
        }

        const systemPrompt = `Tu es le "Game Manager" (Maître du Jeu) d'une simulation médicale immersive pour étudiants en médecine.
Ton rôle est de traduire les actions ou questions en langage naturel soumises par l'étudiant en actions concrètes dans le jeu, de simuler la physiologie du patient et de générer une réponse narrative globale et immersive.

IMPORTANT - DIRECTIVES DE DÉROULEMENT ET DE DIALOGUE (ROLEPLAY) :
1. Tu dois incarner le patient de manière extrêmement réaliste et vivante.
2. Ne récite JAMAIS le JSON de manière brute, clinique ou robotique (ex: évite "Mes antécédents médicaux : Diabète de type 2").
3. Exprime les émotions du patient (douleur, inquiétude, anxiété, fatigue, peur, essoufflement) selon ses constantes vitales actuelles et le motif d'hospitalisation.
4. Adapte le registre de langue du dialogue au profil du patient (âge, profession, contexte de vie).
5. Formule les réponses verbales du patient à la première personne du singulier ("Je...", "Moi...").
6. Ne révèle pas toutes les informations médicales d'un coup. Le patient ne doit répondre que précisément et de manière concise à ce qui est demandé. S'il est fatigué ou essoufflé, il doit faire des phrases courtes.

Voici le cas clinique actuel :
- Patient : ${JSON.stringify(this.caseData.patient || {})}
- Motifs et histoire : ${JSON.stringify(this.caseData.interrogatoire || {})}
- Examen physique disponible (référence) : ${JSON.stringify(this.caseData.examenClinique || {})}
- Examens complémentaires (si demandés) : ${JSON.stringify(this.caseData.examResults || {})}
${ecosPrompt}

Voici les constantes vitales courantes du patient :
- FC (Fréquence Cardiaque) : ${this.vitals.heartRate} bpm
- Tension : ${this.vitals.systolic}/${this.vitals.diastolic} mmHg
- SpO2 : ${this.vitals.spo2} %
- FR (Fréquence Respiratoire) : ${this.vitals.respiratoryRate} /min
- Température : ${this.vitals.temperature} °C
- Niveau de Douleur actuel (0 à 10) : ${this.painLevel}

Évalue la saisie de l'étudiant et décompose-la en intentions. Tu dois :
1. Identifier s'il y a du DIALOGUE (des questions verbales posées au patient). Si oui, formule une réponse verbale à la première personne du singulier que le patient dirait en réponse, cohérente avec son histoire, son état et son caractère.
2. Identifier s'il y a des EXAMENS PHYSIQUES (ex: palpation, auscultation). Si oui, extrais les résultats correspondants de la référence clinique ou déduis-les cliniquement s'ils ne sont pas spécifiés.
3. Identifier s'il y a des PRESCRIPTIONS de médicaments ou traitements.
4. Identifier s'il y a d'AUTRES ACTIONS cliniques.
5. Calculer l'impact physiologique immédiat sur les constantes.

Tu devez obligatoirement répondre sous forme d'un objet JSON valide contenant exactement ces clés :
{
  "dialogue": string ou null,
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
  "narrativeResponse": string
}

Ne renvoie rien d'autre que du JSON. Pas de markdown (sans blocs de code ni \`\`\`json), pas d'explication.`;

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...this.chatHistory.slice(0, -1).map(msg => ({
                            role: msg.role === 'user' ? 'user' : 'assistant',
                            content: msg.content
                        })),
                        { role: 'user', content: `ENTRÉE DE L'ÉTUDIANT : "${text}"` }
                    ],
                    temperature: 0.1,
                    max_tokens: 3000,
                    reasoning: {
                        exclude: true
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const textResponse = data.choices?.[0]?.message?.content || '';
            const parsed = this.cleanAndParseJson(textResponse);

            // Apply physiological changes
            if (parsed.vitalChanges) {
                for (const [key, value] of Object.entries(parsed.vitalChanges)) {
                    if (value !== null) {
                        if (key === 'painLevel') {
                            this.painLevel = Math.max(0, Math.min(10, this.painLevel + value));
                        } else if (this.baseVitals[key] !== undefined) {
                            this.baseVitals[key] = Math.max(1, this.baseVitals[key] + value);
                        }
                    }
                }
            }

            // Apply auto-prescriptions from chat if LLM detected them
            if (parsed.prescriptions && Array.isArray(parsed.prescriptions)) {
                for (const rx of parsed.prescriptions) {
                    if (rx.nom && !this.selectedTreatments.includes(rx.nom)) {
                        // Find matching available treatment
                        const match = (this.caseData.possibleTreatments || []).find(t => 
                            normalizeText(t).includes(normalizeText(rx.nom)) || normalizeText(rx.nom).includes(normalizeText(t))
                        );
                        if (match) {
                            this.selectedTreatments.push(match);
                        }
                    }
                }
            }

            // Apply auto-exams from chat if LLM detected them
            if (parsed.exams && Array.isArray(parsed.exams)) {
                const examsToOrder = [];
                for (const ex of parsed.exams) {
                    const examName = ex.nom || ex.description || ex.type;
                    if (examName) {
                        const match = (this.caseData.availableExams || []).find(e =>
                            normalizeText(e).includes(normalizeText(examName)) || normalizeText(examName).includes(normalizeText(e))
                        );
                        if (match && !this.activeExams.includes(match)) {
                            examsToOrder.push(match);
                        }
                    }
                }
                if (examsToOrder.length > 0) {
                    this.orderExams(examsToOrder);
                }
            }

            // Build final narrative
            let finalOutput = '';
            if (parsed.narrativeResponse && parsed.dialogue) {
                finalOutput = `*(${parsed.narrativeResponse})* "${parsed.dialogue}"`;
            } else if (parsed.narrativeResponse) {
                finalOutput = `*(Maître du Jeu)* ${parsed.narrativeResponse}`;
            } else if (parsed.dialogue) {
                finalOutput = `"${parsed.dialogue}"`;
            } else {
                finalOutput = `Le patient ne réagit pas.`;
            }

            this.chatHistory.push({ role: 'assistant', content: finalOutput });
            return { response: finalOutput, parsed };

        } catch (err) {
            console.error("[MedGameEngine] LLM chat failed:", err);
            throw err;
        }
    }

    cleanAndParseJson(text) {
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

    prescribe(treatments) {
        if (!this.caseData) throw new Error("No active case");
        if (!Array.isArray(treatments)) throw new Error("Treatments must be an array");

        // Filter input treatments to only matching possible ones
        const validTreatments = treatments.filter(t => 
            (this.caseData.possibleTreatments || []).includes(t)
        );

        this.selectedTreatments = validTreatments;
        return { success: true, selectedTreatments: this.selectedTreatments };
    }

    orderExams(exams) {
        if (!this.caseData) throw new Error("No active case");
        if (!Array.isArray(exams)) throw new Error("Exams must be an array");

        // Filter valid exams
        const validExams = exams.filter(e => 
            (this.caseData.availableExams || []).includes(e)
        );

        // Subtract 120 seconds in-game time as penalty for exams
        this.timePenalties += 120;

        for (const exam of validExams) {
            if (!this.activeExams.includes(exam)) {
                this.activeExams.push(exam);
            }
            if (!this.demarche.examsOrdered.includes(exam)) {
                this.demarche.examsOrdered.push(exam);
            }
        }

        const results = {};
        for (const exam of this.activeExams) {
            results[exam] = this.caseData.examResults?.[exam] || "Normal.";
        }

        return { 
            success: true, 
            activeExams: this.activeExams,
            examResults: results
        };
    }

    submitLock(lockId, answer) {
        if (!this.caseData) throw new Error("No active case");
        const lock = (this.caseData.locks || []).find(l => l.id === lockId);
        if (!lock) throw new Error(`Lock '${lockId}' not found`);

        if (this.demarche.locksUnlocked.has(lockId)) {
            return { success: true, unlocked: true, message: "Already unlocked" };
        }

        // Verify prerequisites
        const status = this.getLockStatus(lock);
        if (!status.canUnlock) {
            throw new Error(`Gated by missing prerequisites: ${status.missingPrereqs.join(', ')}`);
        }

        this.lockAttempts[lockId] = (this.lockAttempts[lockId] || 0) + 1;
        const attempts = this.lockAttempts[lockId];

        let isCorrect = false;
        if (lock.type === 'SAISIE') {
            const answerNormalized = normalizeText(answer);
            isCorrect = lock.challenge.expected_keywords.some(kw => {
                const normalizedKW = normalizeText(kw);
                if (normalizedKW === answerNormalized || answerNormalized.includes(normalizedKW)) return true;
                const words = answerNormalized.split(/\s+/);
                return words.some(word => getLevenshteinDistance(word, normalizedKW) <= 1);
            });
        } else if (lock.type === 'QCM') {
            let selectedIndices = [];
            if (Array.isArray(answer)) {
                selectedIndices = answer.map(x => parseInt(x));
            } else if (typeof answer === 'string') {
                const trimmed = answer.trim();
                if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    try {
                        const parsed = JSON.parse(trimmed);
                        selectedIndices = Array.isArray(parsed) ? parsed.map(x => parseInt(x)) : [parseInt(parsed)];
                    } catch (e) {
                        selectedIndices = trimmed.replace(/[\[\]]/g, '').split(',').map(x => parseInt(x.trim())).filter(x => !isNaN(x));
                    }
                } else {
                    selectedIndices = trimmed.split(/[\s,;]+/).map(x => parseInt(x.trim())).filter(x => !isNaN(x));
                }
            } else if (typeof answer === 'number') {
                selectedIndices = [answer];
            }
            
            const correctIndices = lock.challenge.correct_indices || (lock.challenge.correct_index !== undefined ? [lock.challenge.correct_index] : []);
            
            selectedIndices.sort((a, b) => a - b);
            const sortedCorrect = [...correctIndices].sort((a, b) => a - b);
            
            isCorrect = selectedIndices.length === sortedCorrect.length &&
                selectedIndices.every((val, index) => val === sortedCorrect[index]);
        }

        if (isCorrect) {
            this.demarche.locksUnlocked.add(lockId);
            return { success: true, unlocked: true };
        } else if (attempts >= 3) {
            this.demarche.locksUnlocked.add(lockId);
            const correctionText = lock.type === 'QCM' 
                ? (lock.challenge.correct_indices || [lock.challenge.correct_index]).map(idx => lock.challenge.options[idx]).join(' + ')
                : lock.challenge.expected_keywords.join(', ');
            return {
                success: false,
                unlocked: true,
                message: "Unlocked after 3 failures (correction provided)",
                correction: correctionText,
                feedbackError: lock.feedback_error
            };
        } else {
            return {
                success: false,
                unlocked: false,
                attemptsLeft: 3 - attempts,
                feedbackError: lock.feedback_error || "Incorrect answer."
            };
        }
    }

    selectDiagnostic(diagnostic) {
        if (!this.caseData) throw new Error("No active case");
        const options = this.caseData.possibleDiagnostics || [];
        if (!options.includes(diagnostic)) {
            throw new Error(`Diagnostic '${diagnostic}' not available. Choose from: ${options.join(', ')}`);
        }
        this.selectedDiagnostic = diagnostic;
        return { success: true, selectedDiagnostic: this.selectedDiagnostic };
    }

    calculateCompositeScore() {
        if (!this.caseData) return {};
        
        const weights = { demarche: 0.40, diagnostic: 0.30, traitement: 0.20, vitesse: 0.10 };

        // 1. Process Score (Demarche)
        let demPoints = 0;
        let demMax = 0;

        // Interrogatoire
        const interro = this.caseData.interrogatoire || {};
        const interroFields = [];
        const mdv = interro.modeDeVie || {};
        if (mdv.activitePhysique) interroFields.push('interrogatoire.modeDeVie.activitePhysique.description');
        if (mdv.tabac) interroFields.push('interrogatoire.modeDeVie.tabac');
        if (mdv.alcool) interroFields.push('interrogatoire.modeDeVie.alcool.quantite');
        if (mdv.alimentation) interroFields.push('interrogatoire.modeDeVie.alimentation');
        if (mdv.emploi) interroFields.push('interrogatoire.modeDeVie.emploi');
        if (interro.antecedents) {
            if (interro.antecedents.medicaux?.length > 0) interroFields.push('interrogatoire.antecedents.medicaux');
            if (interro.antecedents.chirurgicaux?.length > 0) interroFields.push('interrogatoire.antecedents.chirurgicaux');
            if (interro.antecedents.familiaux?.length > 0) interroFields.push('interrogatoire.antecedents.familiaux');
        }
        if (interro.traitements?.length > 0) interroFields.push('interrogatoire.traitements');
        if (interro.allergies?.presence) interroFields.push('interrogatoire.allergies');
        
        const hm = interro.histoireMaladie || {};
        if (hm.debutSymptomes) interroFields.push('interrogatoire.histoireMaladie.debutSymptomes');
        if (hm.descriptionDouleur) interroFields.push('interrogatoire.histoireMaladie.descriptionDouleur');
        if (hm.evolution) interroFields.push('interrogatoire.histoireMaladie.evolution');
        if (hm.facteursDeclenchants) interroFields.push('interrogatoire.histoireMaladie.facteursDeclenchants');
        if (hm.symptomesAssocies) interroFields.push('interrogatoire.histoireMaladie.symptomesAssocies');
        if (hm.remarques) interroFields.push('interrogatoire.histoireMaladie.remarques');

        const totalInterroFields = Math.max(interroFields.length, 1);
        const askedCount = interroFields.filter(f => this.demarche.interrogatoireAsked.has(f)).length;
        demPoints += (askedCount / totalInterroFields) * 40;
        demMax += 40;

        // Clinical Exam (auto-marked viewed on getstate)
        demPoints += this.demarche.examSectionsViewed.has('section-examen-clinique') ? 25 : 0;
        demMax += 25;

        // Complementary Exams
        const availableExams = this.caseData.availableExams || [];
        const relevantExams = this.caseData.relevantExams || [];
        const examsOrdered = this.demarche.examsOrdered;

        if (availableExams.length > 0) {
            const targetExams = relevantExams.length > 0 ? relevantExams : availableExams;
            const orderedRelevant = examsOrdered.filter(e => targetExams.includes(e));
            const orderRatio = orderedRelevant.length / Math.max(targetExams.length, 1);
            
            const uselessExams = examsOrdered.filter(e => !targetExams.includes(e));
            const uselessPenalty = uselessExams.length * 0.05;
            
            demPoints += Math.max(0, orderRatio - uselessPenalty) * 20;
        } else {
            demPoints += 20;
        }
        demMax += 20;

        // Semio Locks
        const locks = this.caseData.locks || [];
        if (locks.length > 0) {
            const unlockedCount = locks.filter(l => this.demarche.locksUnlocked.has(l.id)).length;
            demPoints += (unlockedCount / locks.length) * 15;
        } else {
            demPoints += 15;
        }
        demMax += 15;

        const demarcheScore = demMax > 0 ? Math.round((demPoints / demMax) * 100) : 100;

        // 2. Diagnosis Score
        let diagnosticScore = 0;
        const normSel = normalizeText(this.selectedDiagnostic);
        const normCor = normalizeText(this.caseData.correctDiagnostic);

        if (normSel && normCor) {
            if (normSel === normCor) {
                diagnosticScore = 100;
            } else if ((this.caseData.alternativeDiagnostics || []).map(normalizeText).includes(normSel)) {
                diagnosticScore = 80;
            } else if (normSel.includes(normCor) || normCor.includes(normSel)) {
                diagnosticScore = 60;
            } else {
                const dist = getLevenshteinDistance(normSel, normCor);
                const maxLen = Math.max(normSel.length, normCor.length);
                const similarity = maxLen > 0 ? 1 - (dist / maxLen) : 0;
                if (similarity >= 0.75) diagnosticScore = 60;
                else if (similarity >= 0.50) diagnosticScore = 30;
            }
        }

        // 3. Treatment Score
        let traitementScore = 0;
        let hasFatalError = false;
        const correctTreatments = this.caseData.correctTreatments || [];
        const fatalTreatments = this.caseData.fatalTreatments || [];
        const secondLine = this.caseData.secondLineTreatments || [];

        const selectedFatal = this.selectedTreatments.filter(t => fatalTreatments.includes(t));
        if (selectedFatal.length > 0) {
            hasFatalError = true;
            traitementScore = 0;
        } else if (correctTreatments.length === 0) {
            traitementScore = 100;
        } else {
            const firstLineHit = this.selectedTreatments.filter(t => correctTreatments.includes(t));
            const secondLineHit = this.selectedTreatments.filter(t => secondLine.includes(t));
            const unnecessary = this.selectedTreatments.filter(t => !correctTreatments.includes(t) && !secondLine.includes(t));
            
            const sensitivity = (firstLineHit.length * 1.0 + secondLineHit.length * 0.6) / correctTreatments.length;
            const penalty = (unnecessary.length * 0.10) + (Math.max(0, this.selectedTreatments.length - correctTreatments.length) * 0.05);
            traitementScore = Math.max(0, Math.min(100, Math.round((sensitivity - penalty) * 100)));
        }

        // 4. Speed Score
        const timeLeft = this.getTimeLeft();
        const vitesseScore = Math.round((timeLeft / this.timeLimit) * 100);

        // Weighted Composite Score
        let compositeScore = Math.round(
            demarcheScore * weights.demarche +
            diagnosticScore * weights.diagnostic +
            traitementScore * weights.traitement +
            vitesseScore * weights.vitesse
        );

        compositeScore = Math.max(0, Math.min(100, compositeScore));

        // Star Rating (0-3)
        let stars = 0;
        if (!hasFatalError) {
            if (compositeScore >= 90) stars = 3;
            else if (compositeScore >= 70) stars = 2;
            else if (compositeScore >= 40) stars = 1;
            else if (demarcheScore >= 80) stars = 1; // Process score guarantee
        }

        return {
            demarcheScore,
            diagnosticScore,
            traitementScore,
            vitesseScore,
            compositeScore,
            hasFatalError,
            stars
        };
    }

    submit() {
        if (!this.caseData) throw new Error("No active case");
        this.attempts++;
        this.isFinished = true;

        const results = this.calculateCompositeScore();
        this.score = results.compositeScore;

        return {
            success: true,
            score: this.score,
            attempts: this.attempts,
            results: results,
            correctDiagnostic: this.caseData.correctDiagnostic,
            correctTreatments: this.caseData.correctTreatments || []
        };
    }
}
