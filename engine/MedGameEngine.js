import fs from 'fs/promises';
import path from 'path';
import '../js/case-aliases.js';
// Moteur patient UNIQUE, partagé avec le navigateur (2D, 3D, ECOS) :
// même prompt, même schéma de réponse, même jauge d'alliance.
import '../js/patient-live-core.js';
import '../js/patient-brain.js';
import { computeClassicScore, toScore20, fuzzyMatchExam, normalizeText, getSimilarity, getLevenshteinDistance, DIAGNOSTIC_TYPO_SIMILARITY } from './scoring.js';

const Brain = globalThis.PatientBrain;
const Live = globalThis.PatientLiveCore;

const EXAM_TIME_COST_SECONDS = 60;
const CLINICAL_GESTURE_TIME_COST_SECONDS = 15;


// Mapping enrichi des gestes cliniques réalisables au cabinet
const GESTURE_TO_SECTION = {
    'auscultation_card': 'examenCardiovasculaire',
    'auscultation_pulm': 'examenPulmonaire',
    'palpation_abdo': 'examenAbdominal',
    'reflex_osteo': 'examenNeurologique',
    'examen_neuro': 'examenNeurologique',
    'examen_orl': 'examenORL',
    'examen_cutane': 'examenCutane',
    'examen_locomoteur': 'examenLocomoteur',
    'examen_uro_gyneco': 'examenUroGyneco',
    'prise_constantes': 'constantes',
    'inspection': 'aspectGeneral'
};

// Table de correspondance des anciens noms de cas.
// Source unique : js/case-aliases.js (importe ci-dessus, cote Node).
const LEGACY_CASE_ALIASES = globalThis.LEGACY_CASE_ALIASES || {};

export class MedGameEngine {
    constructor(config = {}) {
        this.apiKey = config.apiKey || process.env.LLM_API_KEY || '';
        this.apiUrl = config.apiUrl || process.env.LLM_API_URL || 'https://api.deepseek.com/chat/completions';
        this.model = config.model || process.env.LLM_MODEL || 'deepseek-chat';
        this.resetState();
    }

    resetState() {
        this.caseData = null;
        this.startedAt = null;
        this.timeLimit = 480;
        this.timePenalties = 0;
        this.baseVitals = {};
        this.vitals = {};
        this.painLevel = 0;
        this.baseAnxiety = 50;

        // Dynamique émotionnelle et relationnelle du patient
        this.patientState = {
            anxiety: 45,       // 0 (serein) à 100 (panique totale)
            trust: 55,         // 0 (hostile/mutique) à 100 (confiance absolue)
            patience: 80,      // Diminue si questions répétitives ou jargon
            emotionalTone: 'inquiet',
            insistenceCount: {} // Compte combien de fois un sujet caché est abordé
        };

        // Métriques de communication médicale (Grille ECOS)
        this.communicationMetrics = {
            empathyCount: 0,
            jargonPenalties: 0,
            openQuestions: 0,
            closedQuestions: 0,
            reassuranceGiven: false
        };

        this.activeExams = [];
        this.selectedTreatments = [];
        this.selectedDiagnostic = '';
        this.diagnosticLocked = false;
        this.attempts = 0;
        this.score = 0;
        this.lastEvaluation = null;
        this.chatHistory = [];
        this.isFinished = false;
        this.fatalErrorTriggered = false;
        this.requestedCaseId = null;

        this.demarche = {
            interrogatoireAsked: new Set(),
            examsOrdered: [],
            clinicalGestures: new Set(),
            interviewQuestionsDisclosed: new Set(),
            clinicalExamsViewed: new Set(),
            orderedExams: new Set(),
            prescribedTreatments: new Set(),
            locksUnlocked: new Set()
        };

        this.lockAttempts = {};
        this.alliance = null;     // PatientLiveCore.createAlliance (jauge, ultimatum, départ)
        this.lastTurn = null;     // dernier tour joué, pour les agents testeurs
        this.turnLog = [];        // journal complet des tours (rapport de test)
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

        const safeCaseId = path.basename(caseId);
        let filename = safeCaseId.endsWith('.json') ? safeCaseId : `${safeCaseId}.json`;
        if (LEGACY_CASE_ALIASES[safeCaseId]) {
            this.requestedCaseId = safeCaseId.replace(/\.json$/i, '');
            filename = LEGACY_CASE_ALIASES[safeCaseId];
        } else if (LEGACY_CASE_ALIASES[filename]) {
            this.requestedCaseId = safeCaseId.replace(/\.json$/i, '');
            filename = LEGACY_CASE_ALIASES[filename];
        }

        let casePath = path.join(process.cwd(), 'data', filename);
        try {
            const data = await fs.readFile(casePath, 'utf-8');
            this.caseData = JSON.parse(data);
        } catch (err) {
            const alias = LEGACY_CASE_ALIASES[safeCaseId] || LEGACY_CASE_ALIASES[filename];
            if (alias && alias !== filename) {
                try {
                    casePath = path.join(process.cwd(), 'data', alias);
                    const data = await fs.readFile(casePath, 'utf-8');
                    this.caseData = JSON.parse(data);
                } catch (fallbackErr) {
                    throw new Error(`Failed to load case ${caseId} at path ${casePath}: ${fallbackErr.message}`);
                }
            } else {
                throw new Error(`Failed to load case ${caseId} at path ${casePath}: ${err.message}`);
            }
        }

        this.startedAt = Date.now();

        if (this.caseData.gameplayConfig?.timeLimit) {
            this.timeLimit = this.caseData.gameplayConfig.timeLimit;
        } else if (this.caseData.vitalsDynamics?.urgencyMultiplier > 1.8) {
            this.timeLimit = 300;
        } else {
            this.timeLimit = 480;
        }

        // Initialisation des constantes
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

        // Initialisation de la douleur et du persona émotionnel depuis le JSON
        const persona = this.caseData.patient?.persona || {};
        this.patientState.anxiety = persona.anxiete !== undefined ? persona.anxiete : 50;
        this.baseAnxiety = this.patientState.anxiety;
        this.patientState.trust = persona.confiance !== undefined ? persona.confiance : 55;
        this.patientState.emotionalTone = persona.ton || this.caseData.patient?.comportement || 'inquiet';
        this.alliance = Live.createAlliance({ trust: this.patientState.trust, anxiety: this.patientState.anxiety });

        const evaMatch = JSON.stringify(this.caseData.interrogatoire || {}).match(/EVA\s*[:=]?\s*(\d+)/i);
        this.painLevel = evaMatch ? Math.min(10, parseInt(evaMatch[1])) : 3;

        this.updateVitals();

        // Priorité d'ouverture : dialogue.phraseOuverture > ecos.consignesPatient.phraseOuverture > fallback
        const patient = this.caseData.patient || {};
        const nom = `${patient.prenom || ''} ${patient.nom || 'le patient'}`.trim();
        const ecosData = this.caseData.ecos?.consignesPatient || this.caseData.ecos?.patientStandardise;
        const dialogueRoot = this.caseData.dialogue;

        let intro = '';
        if (dialogueRoot?.phraseOuverture) {
            intro = dialogueRoot.phraseOuverture;
        } else if (ecosData?.phraseOuverture) {
            intro = ecosData.phraseOuverture;
        } else {
            const motif = this.caseData.interrogatoire?.motifHospitalisation || this.caseData.motif || '';
            intro = motif
                ? `Bonjour docteur... Je viens vous voir pour ${motif.toLowerCase()}.`
                : `Bonjour docteur, je suis ${nom}.`;
        }

        this.chatHistory.push({ role: 'assistant', content: intro });
        return this.getState();
    }

    updateVitals() {
        if (!this.caseData) return;
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - this.startedAt) / 1000) + this.timePenalties;

        const dyn = this.caseData.vitalsDynamics || {};
        const trendOverMinutes = dyn.trendOverMinutes || 0.08;
        const targets = dyn.aggravationTargets || {};

        const minutesElapsed = elapsedSeconds / 60;
        let trendFraction = minutesElapsed * trendOverMinutes;

        const correctTreatments = this.caseData.correctTreatments || [];
        const isStabilized = this.selectedTreatments.some(t => correctTreatments.includes(t));

        if (isStabilized && dyn.stabilizeOnCorrectTreatment !== false) {
            trendFraction = Math.max(0, trendFraction - (minutesElapsed * 0.12));
        }

        trendFraction = Math.min(1.0, Math.max(0.0, trendFraction));

        // Impact de la variation d'anxiété par rapport à la valeur de base (couplage psycho-physiologique dynamique)
        const anxietyShift = this.patientState.anxiety - (this.baseAnxiety !== undefined ? this.baseAnxiety : 50);
        const anxietyDeltaHR = Math.round((anxietyShift / 50) * 8);
        const anxietyDeltaRR = Math.round((anxietyShift / 50) * 2);

        const currentVitals = {};
        for (const key of ['heartRate', 'systolic', 'diastolic', 'spo2', 'temperature', 'respiratoryRate']) {
            const base = this.baseVitals[key];
            const target = targets[key] !== undefined ? targets[key] : base;

            let val = base + (target - base) * trendFraction;

            if (key === 'heartRate') val += anxietyDeltaHR;
            if (key === 'respiratoryRate') val += anxietyDeltaRR;

            const cycle = key === 'heartRate' || key === 'respiratoryRate' ? 5 : 8;
            const phase = Math.sin((elapsedSeconds % cycle) / cycle * Math.PI * 2);
            const physioAmplitude = key === 'temperature' ? 0.05 : base * 0.012;
            val += phase * physioAmplitude;

            if (key === 'temperature') {
                currentVitals[key] = Math.round(val * 10) / 10;
            } else if (key === 'spo2') {
                currentVitals[key] = Math.min(100, Math.max(40, Math.round(val)));
            } else {
                currentVitals[key] = Math.max(0, Math.round(val));
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

        const examResults = {};
        for (const exam of this.activeExams) {
            const fieldPath = `examResults.${exam}`;
            if (this.isFieldLocked(fieldPath)) {
                examResults[exam] = "🔒 [Verrouillé - Résolvez le défi sémiologique correspondant]";
            } else {
                examResults[exam] = this.caseData.examResults?.[exam] || "Résultat normal ou non significatif.";
            }
        }

        let availableDiagnostics = this.caseData.possibleDiagnostics || [];
        if (this.isFieldLocked('possibleDiagnostics')) {
            availableDiagnostics = ["🔒 [Verrouillé - Résolvez le défi sémiologique correspondant]"];
        }

        let availableTreatments = this.caseData.possibleTreatments || [];
        if (this.isFieldLocked('possibleTreatments')) {
            availableTreatments = ["🔒 [Verrouillé - Résolvez le défi sémiologique correspondant]"];
        }

        return {
            success: true,
            caseId: this.caseData.id,
            caseTitle: this.caseData.motif || this.caseData.ecos?.titre || this.caseData.titre || this.caseData.id,
            motif: this.caseData.motif || this.caseData.ecos?.titre || this.caseData.interrogatoire?.motifHospitalisation || '',
            specialty: this.caseData.specialite,
            difficulty: this.caseData.difficulty || 1,
            patient: {
                nom: this.caseData.patient?.nom,
                prenom: this.caseData.patient?.prenom,
                age: this.caseData.patient?.age,
                sexe: this.caseData.patient?.sexe,
                taille: this.caseData.patient?.taille,
                poids: this.caseData.patient?.poids,
                groupeSanguin: this.caseData.patient?.groupeSanguin,
                emotionalState: { ...this.patientState, painLevel: this.painLevel }
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
            diagnosticLocked: this.diagnosticLocked,
            fatalErrorTriggered: this.fatalErrorTriggered,
            chatHistory: this.chatHistory,
            alliance: this.alliance ? {
                ...this.alliance.snapshot(),
                stage: this.alliance.snapshot().stage.id,
                timeline: this.alliance.state.timeline
            } : null,
            lastTurn: this.lastTurn,
            isFinished: this.isFinished,
            scoreBreakdown: this.isFinished ? (this.lastEvaluation || { score: this.score || 0 }) : null,
            timeLeft: this.getTimeLeft()
        };
    }

    isFieldLocked(fieldPath) {
        if (!this.caseData?.locks) return false;
        for (const lock of this.caseData.locks) {
            if (lock.target_fields.includes(fieldPath) && !this.demarche.locksUnlocked.has(lock.id)) {
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

    /**
     * Parsing multi-intentions par mots-clés d'anamnèse
     */
    trackInterrogatoireByKeywords(text) {
        const q = normalizeText(text);

        const keywordMapping = [
            { path: 'interrogatoire.modeDeVie.activitePhysique.description', keywords: ['sport', 'physique', 'activite', 'marche', 'exercice', 'sedentaire', 'courir'] },
            { path: 'interrogatoire.modeDeVie.tabac', keywords: ['tabac', 'fume', 'cigarette', 'clope', 'fumeur', 'paquet', 'vapot'] },
            { path: 'interrogatoire.modeDeVie.alcool.quantite', keywords: ['alcool', 'boire', 'boisson', 'verre', 'vin', 'biere', 'apero', 'spiritueux'] },
            { path: 'interrogatoire.modeDeVie.alimentation', keywords: ['mange', 'repas', 'alimentation', 'regime', 'appetit', 'poids', 'faim', 'soif', 'hydrat'] },
            { path: 'interrogatoire.modeDeVie.emploi', keywords: ['travail', 'metier', 'profession', 'stress', 'emploi', 'boulot', 'bureau', 'retraite', 'etudiant'] },
            { path: 'interrogatoire.antecedents.medicaux', keywords: ['antecedent', 'maladie', 'hospitalise', 'medicaux', 'sante', 'probleme de sante', 'suivi pour', 'chronique', 'diabete', 'hypertension', 'asthme'] },
            { path: 'interrogatoire.antecedents.chirurgicaux', keywords: ['operation', 'chirurgie', 'opere', 'chirurgicaux', 'anesthesie', 'cicatrice', 'appendicite'] },
            { path: 'interrogatoire.antecedents.familiaux', keywords: ['famille', 'parent', 'pere', 'mere', 'familiaux', 'frere', 'soeur', 'hereditaire', 'dc', 'decede'] },
            { path: 'interrogatoire.traitements', keywords: ['traitement', 'medicament', 'ordonnance', 'prends', 'prenez', 'comprime', 'pilule', 'cachet', 'automedication'] },
            { path: 'interrogatoire.allergies', keywords: ['allergie', 'allergique', 'intolerance', 'penicilline', 'reaction'] },
            { path: 'interrogatoire.histoireMaladie.debutSymptomes', keywords: ['quand', 'debut', 'depuis', 'commence', 'combien de temps', 'apparition', 'heure', 'brutal', 'progressif'] },
            { path: 'interrogatoire.histoireMaladie.descriptionDouleur', keywords: ['douleur', 'mal', 'poitrine', 'thoracique', 'type', 'constrictive', 'ou avez vous', 'montrez', 'irradie', 'lance', 'brule', 'serre', 'intensite', 'echelle', '1 a 10'] },
            { path: 'interrogatoire.histoireMaladie.evolution', keywords: ['evolution', 'evolue', 'aggrave', 'stable', 'pire', 'mieux', 'constant', 'intermittent', 'crise'] },
            { path: 'interrogatoire.histoireMaladie.facteursDeclenchants', keywords: ['declenche', 'provoque', 'effort', 'position', 'allonge', 'debout', 'inspiration', 'toux', 'mouvement'] },
            { path: 'interrogatoire.histoireMaladie.facteursCalmants', keywords: ['calme', 'soulage', 'repos', 'penche', 'antalgique', 'doliprane', 'passe quand'] },
            { path: 'interrogatoire.histoireMaladie.symptomesAssocies', keywords: ['associe', 'autre', 'accompagne', 'dyspnee', 'essouffle', 'fievre', 'frisson', 'sueur', 'nausee', 'vomis', 'vertige', 'malaise', 'palpitation', 'toux'] },
            { path: 'interrogatoire.histoireMaladie.remarques', keywords: ['remarque', 'autre chose', 'preciser', 'inquiete', 'peur', 'ajouter', 'question'] }
        ];

        for (const map of keywordMapping) {
            if (map.keywords.some(k => q.includes(k))) {
                this.demarche.interrogatoireAsked.add(map.path);
                this.patientState.insistenceCount[map.path] = (this.patientState.insistenceCount[map.path] || 0) + 1;
            }
        }
    }

    /** Consignes de voix selon la physiologie (cerveau partagé). */
    buildPhysioVocalDirectives() {
        return Brain.physioBlock({ vitals: this.vitals, pain: this.painLevel, anxiety: this.patientState.anxiety });
    }

    /** Règles de divulgation (cerveau partagé). */
    buildDisclosurePrompt() {
        return Brain.disclosureBlock(this.caseData, { trust: this.patientState.trust, insistence: this.patientState.insistenceCount });
    }

    /** Le prompt système exact que le navigateur enverrait dans le même état. */
    buildSystemPrompt() {
        return Brain.buildSystemPrompt({
            caseData: this.caseData,
            vitals: this.vitals,
            pain: this.painLevel,
            dead: this.fatalErrorTriggered,
            administered: this.selectedTreatments,
            alliance: { trust: this.patientState.trust, anxiety: this.patientState.anxiety },
            allianceSnapshot: this.alliance?.snapshot(),
            insistence: this.patientState.insistenceCount
        });
    }

    async chat(text) {
        if (!this.caseData) throw new Error("No active case.");
        if (this.isFinished) throw new Error("Game is already finished.");
        if (this.fatalErrorTriggered) throw new Error("Fatal error already triggered. Case is over.");
        if (this.alliance?.state.walkedOut) throw new Error("Le patient a quitté le box (alliance rompue) : il ne répond plus. Posez le diagnostic et prescrivez.");
        if (!this.apiKey) throw new Error("API Key for LLM is not configured. Please set LLM_API_KEY in .env.");

        this.trackInterrogatoireByKeywords(text);
        this.updateVitals();

        const systemPrompt = this.buildSystemPrompt();
        const recentHistory = this.chatHistory.slice(-14);
        const buildMessages = () => [
            { role: 'system', content: systemPrompt },
            ...recentHistory.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            })),
            { role: 'user', content: `ENTRÉE DE L'ÉTUDIANT : "${text}"` }
        ];

        let data = null;
        let lastError = null;
        const t0 = Date.now();
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify({
                        model: this.model,
                        messages: buildMessages(),
                        temperature: 0.1,
                        max_tokens: 900,
                        response_format: { type: 'json_object' }
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                data = await response.json();
                lastError = null;
                break;
            } catch (err) {
                lastError = err;
                if (attempt < 2) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }

        if (lastError || !data) {
            console.error("[MedGameEngine] LLM chat failed:", lastError);
            throw new Error(`Patient LLM indisponible (${lastError ? lastError.message : 'réponse vide'}).`);
        }

        const textResponse = data.choices?.[0]?.message?.content || '';
        let parsed;
        try {
            parsed = Brain.parseReply(textResponse);
        } catch (err) {
            throw new Error(`Réponse LLM illisible (JSON invalide): ${err.message}`);
        }

        this.chatHistory.push({ role: 'user', content: text });

        // 1. Alliance thérapeutique — mêmes règles que la jauge du navigateur
        // (jargon détecté localement, ultimatum, départ du patient).
        const analysis = Live.analyzeUtterance(text);
        const al = parsed.alliance || {};
        const allianceTurn = this.alliance.applyTurn({
            kind: 'reply',
            text,
            trustDelta: parsed.alliance ? al.trustDelta : undefined,
            anxietyDelta: parsed.alliance ? al.anxietyDelta : undefined,
            reason: al.reason,
            communication: al.communication
        });
        this.patientState.trust = this.alliance.state.trust;
        this.patientState.anxiety = this.alliance.state.anxiety;
        if (al.communication === 'empathique' || analysis.empathy || analysis.reformulation) {
            this.communicationMetrics.empathyCount++;
            this.communicationMetrics.reassuranceGiven = true;
        }
        if (al.communication === 'jargonneux' || al.communication === 'brusque' || analysis.jargon.length || analysis.brusque) {
            this.communicationMetrics.jargonPenalties++;
        }
        if (analysis.openQuestion) this.communicationMetrics.openQuestions++;
        else if (analysis.questionCount > 0) this.communicationMetrics.closedQuestions++;

        // 2. Suivi des gestes cliniques au cabinet + coût temporel réaliste
        if (Array.isArray(parsed.exams)) {
            for (const ex of parsed.exams) {
                if (ex && ex.type && GESTURE_TO_SECTION[ex.type]) {
                    if (!this.demarche.clinicalGestures.has(ex.type)) {
                        this.demarche.clinicalGestures.add(ex.type);
                        this.timePenalties += CLINICAL_GESTURE_TIME_COST_SECONDS;
                    }
                    this.demarche.clinicalExamsViewed.add(GESTURE_TO_SECTION[ex.type]);
                }
            }
        }

        // 3. Suivi des champs d'anamnèse divulgués
        if (Array.isArray(parsed.disclosedInfoFields)) {
            for (const rawPath of parsed.disclosedInfoFields) {
                if (!rawPath || typeof rawPath !== 'string') continue;
                let p = rawPath.trim();
                if (p === 'motifHospitalisation') continue;
                if (!p.startsWith('interrogatoire.')) p = `interrogatoire.${p}`;
                this.demarche.interrogatoireAsked.add(p);
                this.demarche.interviewQuestionsDisclosed.add(p);
            }
        }

        // 4. Application sécurisée des modifications physiologiques
        if (parsed.vitalChanges) {
            for (const [key, value] of Object.entries(parsed.vitalChanges)) {
                if (value !== null && typeof value === 'number') {
                    if (key === 'painLevel') {
                        this.painLevel = Math.max(0, Math.min(10, value));
                    } else if (this.baseVitals[key] !== undefined) {
                        // Valeur cible absolue ; l'anxiété est ré-appliquée par updateVitals().
                        this.baseVitals[key] = value;
                    }
                }
            }
            this.updateVitals();
        }

        // 5. Auto-prescription via langage naturel
        if (Array.isArray(parsed.prescriptions)) {
            const matchedTreatments = [];
            for (const rx of parsed.prescriptions) {
                if (rx.nom) {
                    const match = (this.caseData.possibleTreatments || []).find(t =>
                        normalizeText(t).includes(normalizeText(rx.nom)) || normalizeText(rx.nom).includes(normalizeText(t))
                    );
                    if (match) matchedTreatments.push(match);
                }
            }
            if (matchedTreatments.length > 0) {
                this.prescribe(matchedTreatments);
            }
        }

        // 6. Auto-prescription d'examens complémentaires via langage naturel
        if (Array.isArray(parsed.exams)) {
            const examsToOrder = [];
            for (const ex of parsed.exams) {
                const candidates = [ex.nom, ex.description, ex.type].filter(Boolean);
                for (const candidate of candidates) {
                    const match = (this.caseData.availableExams || []).find(avail => fuzzyMatchExam(avail, candidate));
                    if (match && !this.activeExams.includes(match) && !examsToOrder.includes(match)) {
                        examsToOrder.push(match);
                    }
                }
            }
            if (examsToOrder.length > 0) {
                this.orderExams(examsToOrder);
            }
        }

        // 7. Construction de la sortie narrative et verbale
        let finalOutput = '';
        if (parsed.narrativeResponse && parsed.dialogue) {
            finalOutput = `*(${parsed.narrativeResponse})*\n\n« ${parsed.dialogue} »`;
        } else if (parsed.narrativeResponse) {
            finalOutput = `*(${parsed.narrativeResponse})*`;
        } else if (parsed.dialogue) {
            finalOutput = `« ${parsed.dialogue} »`;
        } else {
            finalOutput = `*(Le patient reste silencieux.)*`;
        }

        // Les collègues sollicités répondent en leur nom (js/patient-brain.js).
        const team = (parsed.team || []).map(m => ({ ...m, speaker: Brain.teamSpeakerLabel(m, this.caseData) }));
        if (team.length) {
            const lines = team.map(m => `${m.speaker} : « ${m.says} »${m.delayMin ? ` [+${m.delayMin} min]` : ''}`).join('\n');
            finalOutput = finalOutput === '*(Le patient reste silencieux.)*' ? lines : `${finalOutput}\n${lines}`;
        }

        if (parsed.gameState && (parsed.gameState.status === 'deteriorating' || parsed.gameState.status === 'dead')) {
            if (parsed.gameState.status === 'dead') {
                this.fatalErrorTriggered = true;
                this.isFinished = true;
            }
            const gsLabel = parsed.gameState.status === 'dead'
                ? `💀 Décès du patient : ${parsed.gameState.deathReason || 'arrêt cardio-respiratoire'}`
                : `⚠️ Détérioration critique — fenêtre d'action : ${parsed.gameState.catchWindowSec || 60}s`;
            finalOutput += `\n[${gsLabel}]`;
        }

        if (allianceTurn.ultimatumStarted) finalOutput += `\n[⚠️ Le patient veut partir : une seule réplique pour le retenir (excuse, reformulation, empathie).]`;
        if (allianceTurn.recovered) finalOutput += `\n[Le patient accepte de rester.]`;
        if (allianceTurn.walkedOut) finalOutput += `\n[🚪 Le patient quitte le box : il ne répondra plus.]`;

        this.lastTurn = {
            input: text,
            latencyMs: Date.now() - t0,
            emotion: parsed.emotion,
            dialogue: parsed.dialogue,
            narrative: parsed.narrativeResponse,
            team,
            alliance: {
                trust: this.alliance.state.trust,
                anxiety: this.alliance.state.anxiety,
                delta: allianceTurn.delta,
                feedback: allianceTurn.label,
                stage: allianceTurn.stage.id,
                ultimatum: this.alliance.state.ultimatum,
                walkedOut: this.alliance.state.walkedOut,
                jargon: allianceTurn.jargon.map(j => j.term)
            },
            disclosedInfoFields: parsed.disclosedInfoFields || [],
            exams: parsed.exams || [],
            prescriptions: parsed.prescriptions || [],
            scene: parsed.scene,
            gameState: parsed.gameState
        };
        this.turnLog.push(this.lastTurn);

        this.chatHistory.push({ role: 'assistant', content: finalOutput });
        return {
            response: finalOutput,
            parsed,
            patientState: this.patientState,
            vitals: this.vitals
        };
    }

    /** Extracteur JSON tolérant (cerveau partagé). */
    cleanAndParseJson(text) {
        return Brain.parseJson(text);
    }

    prescribe(treatments) {
        if (!this.caseData) throw new Error("No active case");
        if (!Array.isArray(treatments)) throw new Error("Treatments must be an array");
        if (this.isFinished) throw new Error("Game is already finished.");

        const validTreatments = treatments.filter(t =>
            (this.caseData.possibleTreatments || []).includes(t)
        );

        for (const t of validTreatments) {
            if (!this.selectedTreatments.includes(t)) {
                this.selectedTreatments.push(t);
                this.demarche.prescribedTreatments.add(t);
            }
        }

        const fatalHit = this.selectedTreatments.find(t =>
            (this.caseData.fatalTreatments || []).includes(t)
        );
        if (fatalHit && !this.fatalErrorTriggered) {
            this.fatalErrorTriggered = true;
            this.isFinished = true;
            this.score = 0;
            return {
                success: true,
                selectedTreatments: [...this.selectedTreatments],
                gameOver: true,
                fatalTreatment: fatalHit,
                score: 0,
                evaluation: { hasFatalError: true, stars: 0, compositeScore: 0 }
            };
        }

        return { success: true, selectedTreatments: [...this.selectedTreatments], appended: validTreatments.length };
    }

    orderExams(exams) {
        if (!this.caseData) throw new Error("No active case");
        if (!Array.isArray(exams)) throw new Error("Exams must be an array");
        if (this.isFinished) throw new Error("Game is already finished.");

        const validExams = exams.filter(e =>
            (this.caseData.availableExams || []).includes(e)
        );

        const dangerousExams = this.caseData.examGradation?.dangereux || [];
        const newExams = validExams.filter(e => !this.activeExams.includes(e));
        this.timePenalties += newExams.length * EXAM_TIME_COST_SECONDS;

        for (const exam of validExams) {
            if (!this.activeExams.includes(exam)) {
                this.activeExams.push(exam);
            }
            if (!this.demarche.examsOrdered.includes(exam)) {
                this.demarche.examsOrdered.push(exam);
                this.demarche.orderedExams.add(exam);
            }
            if (dangerousExams.some(d => fuzzyMatchExam(exam, d))) {
                this.patientState.anxiety = Math.min(100, this.patientState.anxiety + 15);
            }
        }

        const results = {};
        for (const exam of this.activeExams) {
            const path = `examResults.${exam}`;
            results[exam] = this.isFieldLocked(path)
                ? "🔒 [Verrouillé - Résolvez le défi sémiologique correspondant]"
                : (this.caseData.examResults?.[exam] || "Normal.");
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

        const status = this.getLockStatus(lock);
        if (!status.canUnlock) {
            throw new Error(`Gated by missing prerequisites: ${status.missingPrereqs.join(', ')}`);
        }

        this.lockAttempts[lockId] = (this.lockAttempts[lockId] || 0) + 1;
        const attempts = this.lockAttempts[lockId];

        let isCorrect = false;
        if (lock.type === 'SAISIE') {
            const answerNormalized = normalizeText(answer);
            isCorrect = (lock.challenge?.expected_keywords || []).some(kw => {
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

            const correctIndices = lock.challenge?.correct_indices || (lock.challenge?.correct_index !== undefined ? [lock.challenge.correct_index] : []);
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
                ? (lock.challenge?.correct_indices || [lock.challenge?.correct_index]).map(idx => lock.challenge?.options?.[idx]).join(' + ')
                : (lock.challenge?.expected_keywords || []).join(', ');
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
        if (this.isFinished) throw new Error("Game is already finished.");

        if (this.diagnosticLocked) {
            throw new Error(`Diagnostic déjà validé ("${this.selectedDiagnostic}"). Un seul essai est autorisé.`);
        }

        const options = this.caseData.possibleDiagnostics || [];
        const exactMatch = options.find(o => o === diagnostic);
        const fuzzyMatch = options.find(o => getSimilarity(normalizeText(o), normalizeText(diagnostic)) >= DIAGNOSTIC_TYPO_SIMILARITY);

        const resolvedDiag = exactMatch || fuzzyMatch;
        if (!resolvedDiag && options.length > 0) {
            throw new Error(`Diagnostic '${diagnostic}' not available. Choose from: ${options.join(', ')}`);
        }

        this.selectedDiagnostic = resolvedDiag || diagnostic;
        this.diagnosticLocked = true;
        return { success: true, selectedDiagnostic: this.selectedDiagnostic, locked: true };
    }

    /**
     * Évaluation multicritère ECOS (Diagnostic, Pertinence des examens via examGradation, Thérapeutique, Anamnèse & Relationnel)
     */
    submit() {
        if (!this.caseData) throw new Error("No active case");
        if (this.isFinished) throw new Error("Case already submitted. Submission is definitive.");
        this.attempts++;
        this.isFinished = true;

        if (this.fatalErrorTriggered) {
            this.score = 0;
            this.lastEvaluation = {
                success: true,
                score: 0,
                scoreOn20: 0,
                attempts: this.attempts,
                results: {
                    diagnosticScore: 0,
                    examScore: 0,
                    treatmentScore: 0,
                    communicationScore: 0,
                    fatalError: true
                },
                correctDiagnostic: this.caseData.correctDiagnostic,
                correctTreatments: this.caseData.correctTreatments || []
            };
            return this.lastEvaluation;
        }

        // Notation : la regle /100 historique vit dans engine/scoring.js (source
        // unique, partagee avec le navigateur). L'engine ne fait plus que
        // fournir les donnees de la session.
        const scoring = computeClassicScore({
            caseData: this.caseData,
            selectedDiagnostic: this.selectedDiagnostic,
            activeExams: this.activeExams,
            selectedTreatments: this.selectedTreatments,
            anamnesisCount: this.demarche.interrogatoireAsked.size,
            trust: this.patientState.trust,
            hasGestures: this.demarche.clinicalGestures.size > 0
        });
        const { diagnosticScore, examScore, treatmentScore, communicationScore } = scoring;

        this.score = scoring.score;

        this.lastEvaluation = {
            success: true,
            score: this.score,
            scoreOn20: toScore20(this.score),
            attempts: this.attempts,
            results: {
                diagnosticScore,
                examScore,
                treatmentScore,
                communicationScore,
                finalPatientTrust: this.patientState.trust,
                alliance: this.alliance ? this.alliance.summary() : null,
                anamnesisDomainsCovered: Array.from(this.demarche.interrogatoireAsked),
                clinicalGesturesPerformed: Array.from(this.demarche.clinicalGestures)
            },
            correctDiagnostic: this.caseData.correctDiagnostic,
            correctTreatments: this.caseData.correctTreatments || [],
            correction: this.caseData.correction
        };

        return this.lastEvaluation;
    }
}
