/**
 * js/jevClient.js : Moteur unique de routage et de notation ECOS via TypeSafe System One (Jev)
 *
 * Principes architecturaux :
 *  1. Routage multi-destinations : questions noul par destination + choice de desambiguisation.
 *  2. Transcript unifie : journal horodate [MM:SS] integrant chat et interface.
 *  3. Notation officielle ECOS sur 20 en 3 sections (Aptitudes, Communication, Performance).
 *  4. Regle absolue "Jev ou rien" : aucun repli heuristique ni LLM generatif pour la notation.
 */

// Ponderation officielle des 3 sections ECOS conformement aux exigences UNESS / CNG
export const ECOS_SECTION_WEIGHTS = {
    aptitudes: 0.50,     // 50% Aptitudes cliniques et techniques
    communication: 0.25, // 25% Communication et attitudes
    performance: 0.25    // 25% Performance et deroulement
};

// Seuils de decision
export const ROUTING_CONFIDENCE_THRESHOLD = 0.8;
export const REDHIBITORY_THRESHOLD = 0.35;
export const PASSING_SCORE_ON_20 = 10.0;

// Roles professionnels associes aux actes
export const ACTION_ROLES = {
    acte_imagerie: 'Radiologue',
    acte_biologie: 'Biologiste',
    acte_ecg: 'Médecin Réanimateur',
    acte_medicament: 'Infirmier / Infirmière',
    acte_examen_clinique: 'Médecin',
    acte_urgence: 'Médecin Réanimateur',
    acte_materiel: 'Infirmier / Infirmière'
};

// Questions standards de routage multi-destinations
export const ROUTING_QUESTIONS = {
    vers_patient: {
        type: 'noul',
        instructions: "Ce message s'adresse au patient ou attend une réaction de sa part : salutation, question, annonce, explication, commentaire pendant un examen. Vrai si le patient doit produire une réponse.",
        criteria: {
            true: "le patient doit répondre ou réagir",
            false: "le patient n'a rien à répondre"
        }
    },
    acte_imagerie: {
        type: 'noul',
        instructions: "L'étudiant demande ou réalise un examen d'imagerie : radiographie, scanner, IRM, échographie.",
        criteria: {
            true: "demande ou realisation d un examen d imagerie",
            false: "aucun examen d imagerie demande"
        }
    },
    acte_biologie: {
        type: 'noul',
        instructions: "L'étudiant demande ou réalise un examen de biologie : bilan sanguin, ionogramme, gaz du sang, hémoculture, bandelette urinaire, ECBU.",
        criteria: {
            true: "demande ou realisation d un bilan biologique ou prelevement",
            false: "aucun examen de biologie demande"
        }
    },
    acte_ecg: {
        type: 'noul',
        instructions: "L'étudiant demande ou réalise un électrocardiogramme, un électroencéphalogramme ou un monitorage.",
        criteria: {
            true: "demande ou pose d un ECG ou monitorage",
            false: "aucun enregistrement electrique demande"
        }
    },
    acte_medicament: {
        type: 'noul',
        instructions: "L'étudiant administre ou prescrit un médicament, un soluté, une perfusion ou de l'oxygène.",
        criteria: {
            true: "prescription ou administration d un traitement, solute ou oxygene",
            false: "aucun medicament ou solute prescrit"
        }
    },
    acte_examen_clinique: {
        type: 'noul',
        instructions: "L'étudiant réalise lui-même un geste d'examen physique sur le patient : auscultation, palpation, percussion, inspection, réflexes.",
        criteria: {
            true: "realisation directe d un geste d examen clinique",
            false: "aucun geste d examen clinique physique effectue"
        }
    },
    acte_urgence: {
        type: 'noul',
        instructions: "L'étudiant réalise un geste de réanimation ou d'urgence vitale : choc électrique, massage cardiaque, intubation, ventilation, défibrillation.",
        criteria: {
            true: "manoeuvre de reanimation ou geste d urgence vitale",
            false: "aucun geste de reanimation"
        }
    },
    acte_materiel: {
        type: 'noul',
        instructions: "L'étudiant demande du matériel, une installation ou de l'aide : couverture, scope, aspiration, appel à l'aide, transport.",
        criteria: {
            true: "demande d installation, materiel ou renfort",
            false: "aucune demande de materiel ou installation"
        }
    },
    discipline_imagerie: {
        type: 'choice',
        instructions: "Si une imagerie est demandée, quelle modalité ? Sinon, réponds aucune.",
        criteria: {
            aucune: "pas d'imagerie demandée",
            radiographie: "radiographie standard",
            scanner: "tomodensitométrie",
            irm: "imagerie par résonance magnétique",
            echographie: "échographie"
        }
    },
    discipline_biologie: {
        type: 'choice',
        instructions: "Si une biologie est demandée, quelle famille ? Sinon, réponds aucune.",
        criteria: {
            aucune: "pas de biologie demandée",
            biochimie: "bilan biochimique, ionogramme, fonction rénale ou hépatique",
            hematologie: "hémogramme, hémostase, groupage",
            microbiologie: "hémoculture, sérologie, culture",
            gaz_du_sang: "gaz du sang artériel ou veineux",
            urine: "bandelette urinaire, ECBU"
        }
    }
};

/**
 * Extraction robuste de probabilite d'une decision de type noul
 */
export function getNoulProbability(decision) {
    if (decision === undefined || decision === null) return 0;
    if (typeof decision === 'number') return decision;
    if (typeof decision.probability === 'number') return decision.probability;
    if (typeof decision.score === 'number') return decision.score;
    if (decision.probabilities) {
        if (typeof decision.probabilities.true === 'number') return decision.probabilities.true;
        if (typeof decision.probabilities['true'] === 'number') return decision.probabilities['true'];
    }
    if (decision.value === true || decision.choice === 'true' || decision.selected === 'true') {
        return typeof decision.confidence === 'number' ? decision.confidence : 1.0;
    }
    if (decision.value === false || decision.choice === 'false' || decision.selected === 'false') {
        return typeof decision.confidence === 'number' ? (1.0 - decision.confidence) : 0.0;
    }
    return 0;
}

/**
 * Extraction robuste de la valeur d'une decision de type choice
 */
export function getChoiceValue(decision) {
    if (!decision) return null;
    if (typeof decision === 'string') return decision;
    if (typeof decision.value === 'string') return decision.value;
    if (typeof decision.choice === 'string') return decision.choice;
    if (typeof decision.selected === 'string') return decision.selected;
    if (decision.probabilities && typeof decision.probabilities === 'object') {
        let maxP = -1;
        let bestChoice = null;
        for (const [k, v] of Object.entries(decision.probabilities)) {
            if (typeof v === 'number' && v > maxP) {
                maxP = v;
                bestChoice = k;
            }
        }
        return bestChoice;
    }
    return null;
}

/**
 * Appel reseau unique au proxy Jev
 */
export async function callJev(payload, options = {}) {
    const apiUrl = options.apiUrl
        || (typeof window !== 'undefined' && (window.__ENV__?.JEV_API_URL || window.CONFIG?.JEV_API_URL))
        || '/.netlify/functions/jev-proxy';

    const fetchFn = options.fetch || (typeof fetch !== 'undefined' ? fetch : null);
    if (!fetchFn) {
        throw new Error("Environnement sans fonction fetch disponible.");
    }

    const response = await fetchFn(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        body: JSON.stringify({
            model: payload.model || 'jev-latest',
            state: payload.state || '',
            questions: payload.questions || {}
        })
    });

    if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`Jev proxy HTTP ${response.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const raw = data.decisions || data.questions || data;
    if (Array.isArray(raw)) {
        const map = {};
        raw.forEach(item => {
            if (item && item.id) map[item.id] = item;
        });
        return map;
    }
    return raw;
}

/**
 * Routage multi-destinations d'un message utilisateur
 */
export async function routeMessage(messageText, context = {}, options = {}) {
    const text = (messageText || '').trim();
    if (!text) {
        return {
            toPatient: true,
            actions: [],
            clinicalActions: [],
            fallback: true,
            fallbackApplied: true,
            disciplines: {},
            rawDecisions: {}
        };
    }

    let decisions = null;
    try {
        decisions = await callJev({
            state: `Message de l etudiant : "${text}"`,
            questions: ROUTING_QUESTIONS
        }, options);
    } catch (err) {
        // Repli transparent vers le patient en cas d'erreur de communication Jev
        console.warn("[JevClient] Erreur d appel au routeur Jev, repli transparent vers le patient :", err.message);
        return {
            toPatient: true,
            actions: [],
            clinicalActions: [],
            fallback: true,
            fallbackApplied: true,
            disciplines: {},
            rawDecisions: {}
        };
    }

    const actions = [];
    const disciplines = {};

    // 1. Detection des actes
    const acteMapping = [
        { key: 'acte_imagerie', dest: 'dest_radiologue', role: 'Radiologue' },
        { key: 'acte_biologie', dest: 'dest_biologiste', role: 'Biologiste' },
        { key: 'acte_ecg', dest: 'dest_reanimateur', role: 'Médecin Réanimateur' },
        { key: 'acte_medicament', dest: 'dest_infirmier', role: 'Infirmier / Infirmière' },
        { key: 'acte_examen_clinique', dest: 'dest_medecin', role: 'Médecin' },
        { key: 'acte_urgence', dest: 'dest_reanimateur', role: 'Médecin Réanimateur' },
        { key: 'acte_materiel', dest: 'dest_infirmier', role: 'Infirmier / Infirmière' }
    ];

    for (const item of acteMapping) {
        const prob = Math.max(
            getNoulProbability(decisions[item.key]),
            getNoulProbability(decisions[item.dest])
        );

        if (prob >= ROUTING_CONFIDENCE_THRESHOLD) {
            let discipline = null;
            if (item.key === 'acte_imagerie') {
                const disc = getChoiceValue(decisions.discipline_imagerie);
                if (disc && disc !== 'aucune') discipline = disc;
            } else if (item.key === 'acte_biologie') {
                const disc = getChoiceValue(decisions.discipline_biologie);
                if (disc && disc !== 'aucune') discipline = disc;
            }

            actions.push({
                type: item.key,
                role: item.role,
                confidence: prob,
                discipline
            });
        }
    }

    // Prise en compte explicite de choice acte_type si present
    const acteTypeChoice = getChoiceValue(decisions.acte_type);
    if (acteTypeChoice && acteTypeChoice !== 'aucun' && !actions.some(a => a.type === acteTypeChoice)) {
        actions.push({
            type: acteTypeChoice,
            role: ACTION_ROLES[acteTypeChoice] || 'Directeur Clinique',
            confidence: 1.0,
            discipline: null
        });
    }

    if (decisions.discipline_imagerie) {
        disciplines.imagerie = getChoiceValue(decisions.discipline_imagerie);
    }
    if (decisions.discipline_biologie) {
        disciplines.biologie = getChoiceValue(decisions.discipline_biologie);
    }

    // 2. Destination patient
    const patientProb = Math.max(
        getNoulProbability(decisions.vers_patient),
        getNoulProbability(decisions.dest_patient)
    );
    let toPatient = patientProb >= ROUTING_CONFIDENCE_THRESHOLD;

    // 3. Repli transparent : si rien n'a depasse le seuil, router vers le patient
    let fallbackApplied = false;
    if (!toPatient && actions.length === 0) {
        toPatient = true;
        fallbackApplied = true;
    }

    return {
        toPatient,
        actions,
        clinicalActions: actions.map(a => a.type),
        fallback: fallbackApplied,
        fallbackApplied,
        disciplines,
        rawDecisions: decisions
    };
}

/**
 * Formatage d'une duree en secondes au format MM:SS
 */
export function formatTimeCode(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `[${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}]`;
}

/**
 * Construction du transcript unifie et horodate
 *
 * Sources acceptees :
 *  - events : tableau d objets { elapsed, speaker, origin, text } ou objets bruts d historique
 */
export function buildUnifiedTranscript(input = []) {
    let events = [];
    if (Array.isArray(input)) {
        events = input;
    } else if (input && typeof input === 'object') {
        const chat = input.chatHistory || input.conversationLog || [];
        const actions = input.interfaceActions || [];
        events = [
            ...chat.map(m => ({
                speaker: (m.sender === 'user' || m.speaker === 'user' || m.sender === 'Vous') ? 'ETUDIANT' : 'PATIENT',
                origin: 'chat',
                text: m.text || m.content || '',
                elapsed: typeof m.elapsed === 'number' ? m.elapsed : (typeof m.timestamp === 'number' ? Math.round(m.timestamp / 1000) : (typeof m.t === 'number' ? Math.round(m.t / 1000) : 0))
            })),
            ...actions.map(a => ({
                speaker: 'ETUDIANT',
                origin: 'interface',
                text: a.type === 'exam' ? `Examen realise - ${a.label || a.name || ''}` : (a.type === 'prescription' ? `Traitement prescrit - ${a.label || a.name || ''}` : (a.text || a.label || '')),
                elapsed: typeof a.elapsed === 'number' ? a.elapsed : (typeof a.timestamp === 'number' ? Math.round(a.timestamp / 1000) : (typeof a.t === 'number' ? Math.round(a.t / 1000) : 0))
            }))
        ];
    }

    if (!Array.isArray(events) || events.length === 0) {
        return "";
    }

    const normalized = events.map(e => {
        const elapsed = typeof e.elapsed === 'number' ? e.elapsed
            : typeof e.t === 'number' ? Math.round(e.t / 1000)
            : 0;

        let author = e.speaker || e.author || 'ETUDIANT';
        let origin = e.origin || (author === 'ETUDIANT' ? 'chat' : '');
        let text = e.text || e.detail || e.content || '';

        // Normalisation de l'auteur et de l'origine
        if (e.type === 'interrogatoire' && !e.speaker) {
            author = 'ETUDIANT';
            origin = 'interface';
            text = text.startsWith('Question posée') ? text : `questionne : ${text}`;
        } else if (e.type === 'examen' && !e.speaker) {
            author = 'ETUDIANT';
            origin = 'interface';
            text = text.startsWith('prescrit') || text.startsWith('réalise') || text.startsWith('Examen') ? text : `prescrit ${text}`;
        } else if (e.type === 'traitement' && !e.speaker) {
            author = 'ETUDIANT';
            origin = 'interface';
            text = text.startsWith('prescrit') || text.startsWith('Traitement') || text.startsWith('Prescription') ? text : `prescrit ${text}`;
        } else if (author === 'Vous' || author === 'user') {
            author = 'ETUDIANT';
            if (!origin) origin = 'chat';
        } else if (author === 'PS' || author === 'patient' || author === 'assistant') {
            author = 'PATIENT';
            origin = '';
        }

        return { elapsed, author, origin, text };
    });

    // Tri chronologique
    normalized.sort((a, b) => a.elapsed - b.elapsed);

    return normalized.map(item => {
        const tc = formatTimeCode(item.elapsed);
        const originTag = item.origin ? ` (${item.origin})` : '';
        return `${tc} ${item.author}${originTag} : ${item.text}`;
    }).join('\n');
}

/**
 * Generation des questions de notation ECOS a partir du cas
 */
export function buildScoringQuestions(caseData = {}, sessionSummary = {}) {
    const list = [];
    const ecos = caseData.ecosStation || caseData.ecos || {};

    // 1. Section 1 : Aptitudes cliniques et techniques
    const aptitudesItems = (ecos.grid && Array.isArray(ecos.grid.sections) && ecos.grid.sections[0]?.items)
        ? ecos.grid.sections[0].items
        : ((ecos.grilleAptitudesCliniques && ecos.grilleAptitudesCliniques.length > 0)
            ? ecos.grilleAptitudesCliniques
            : (ecos.consignesEvaluateur?.grille || []));

    aptitudesItems.forEach(item => {
        const id = item.id?.startsWith('apt_') ? item.id : `apt_${item.id}`;
        list.push({
            id,
            type: 'choice',
            section: 'aptitudes',
            originalId: item.id,
            label: item.label,
            weight: typeof item.weight === 'number' ? item.weight : 1,
            instructions: `Évalue la réalisation de l'aptitude clinique suivante par l'étudiant : "${item.label}".`,
            choices: ['fait', 'en_partie', 'non_fait'],
            criteria: (item.criteria && item.criteria.fait) ? item.criteria : {
                fait: `L'aptitude "${item.label}" a été entièrement et correctement réalisée selon les règles de l'art.`,
                en_partie: `L'aptitude "${item.label}" a été initiée ou réalisée de manière incomplète ou imprécise.`,
                non_fait: `L'aptitude "${item.label}" n'a pas été réalisée du tout.`
            }
        });
    });

    // 2. Section 2 : Communication et attitudes
    const commItems = (ecos.grid && Array.isArray(ecos.grid.sections) && ecos.grid.sections[1]?.items)
        ? ecos.grid.sections[1].items
        : (ecos.grilleCommunication || [
            { id: 'ecoute_active', label: "Écoute active, laisse s'exprimer sans interrompre", max: 1 },
            { id: 'questions_ouvertes', label: "Pose des questions ouvertes avant de cibler", max: 1 },
            { id: 'reformulation', label: "Reformule et valide la compréhension", max: 1 },
            { id: 'vocabulaire_adapte', label: "Vocabulaire adapté, explications claires sans jargon", max: 1 },
            { id: 'empathie', label: "Empathie, écoute bienveillante et posture rassurante", max: 1 }
        ]);

    commItems.forEach(item => {
        const id = item.id?.startsWith('comm_') ? item.id : `comm_${item.id}`;
        list.push({
            id,
            type: 'choice',
            section: 'communication',
            originalId: item.id,
            label: item.label,
            weight: typeof item.max === 'number' ? item.max : (typeof item.weight === 'number' ? item.weight : 1),
            instructions: `Évalue la dimension de communication suivante : "${item.label}".`,
            choices: ['fait', 'en_partie', 'non_fait'],
            criteria: (item.criteria && item.criteria.fait) ? item.criteria : {
                fait: `Comportement exemplaire et naturel.`,
                en_partie: `Comportement partiel ou mécanique.`,
                non_fait: `Comportement absent ou inadapté.`
            }
        });
    });

    // 3. Section 3 : Performance
    const perfItems = (ecos.grid && Array.isArray(ecos.grid.sections) && ecos.grid.sections[2]?.items)
        ? ecos.grid.sections[2].items
        : (ecos.grillePerformance || [
            {
                id: 'temps_station',
                label: "Respect du temps imparti et gestion du rythme",
                instructions: "L'étudiant a-t-il géré le temps de consultation de manière fluide et achevé la station dans le délai imparti ?"
            },
            {
                id: 'ordre_logique',
                label: "Enchaînement logique et hiérarchisé de la démarche",
                instructions: "L'étudiant a-t-il respecté l'ordre logique : interrogatoire -> examen physique -> examens complémentaires -> traitement ?"
            },
            {
                id: 'signes_gravite',
                label: "Identification et réaction devant les signes de gravité",
                instructions: "L'étudiant a-t-il recherché les signes d'alerte, pris les constantes vitales et adapté sa réactivité ?"
            }
        ]);

    perfItems.forEach(item => {
        const id = item.id?.startsWith('perf_') ? item.id : `perf_${item.id}`;
        list.push({
            id,
            type: 'choice',
            section: 'performance',
            originalId: item.id,
            label: item.label,
            weight: typeof item.weight === 'number' ? item.weight : 1,
            instructions: item.instructions || `Évalue l'exigence de performance : "${item.label}".`,
            choices: ['fait', 'en_partie', 'non_fait'],
            criteria: (item.criteria && item.criteria.fait) ? item.criteria : {
                fait: `L'exigence "${item.label}" a été entièrement et rigoureusement respectée.`,
                en_partie: `L'exigence "${item.label}" a été partiellement ou moyennement respectée.`,
                non_fait: `L'exigence "${item.label}" n'a pas été respectée.`
            }
        });
    });

    // 4. Erreurs redhibitoires
    const erreurs = ecos.consignesEvaluateur?.erreursRedhibitoires ||
                    ecos.redhibitoryErrors ||
                    caseData.redhibitoryErrors || [];

    erreurs.forEach((errLabel, idx) => {
        const id = typeof errLabel === 'object' ? (errLabel.id || `redhib_${idx}`) : `redhib_${idx}`;
        const label = typeof errLabel === 'object' ? errLabel.label : errLabel;
        list.push({
            id,
            type: 'noul',
            isRedhibitoire: true,
            label,
            instructions: `L'étudiant a-t-il commis l'erreur rédhibitoire suivante : "${label}" ?`,
            criteria: {
                true: `l etudiant a commis la faute grave : ${label}`,
                false: `l etudiant n a pas commis cette faute`
            }
        });
    });

    return list;
}

/**
 * Calcul des scores officiels ECOS a partir des decisions Jev
 */
export function computeFinalScores(caseData = {}, decisions = {}) {
    const questions = buildScoringQuestions(caseData);

    const decisionsMap = {};
    if (Array.isArray(decisions)) {
        decisions.forEach(d => {
            if (d && d.id) decisionsMap[d.id] = d;
        });
    } else if (typeof decisions === 'object' && decisions !== null) {
        Object.assign(decisionsMap, decisions);
    }

    const sectionResults = {
        aptitudes: { points: 0, maxPoints: 0, items: [] },
        communication: { points: 0, maxPoints: 0, items: [] },
        performance: { points: 0, maxPoints: 0, items: [] }
    };

    const redhibitoryHits = [];

    questions.forEach(qDef => {
        const qId = qDef.id;
        const dec = decisionsMap[qId] !== undefined ? decisionsMap[qId] : decisionsMap[qDef.originalId];

        if (qDef.isRedhibitoire || qId.startsWith('redhib_') || qId.startsWith('redhibitoire_')) {
            const prob = getNoulProbability(dec);
            if (prob >= REDHIBITORY_THRESHOLD) {
                redhibitoryHits.push({
                    id: qId,
                    label: qDef.label,
                    confidence: prob
                });
            }
            return;
        }

        const secKey = qDef.section || 'aptitudes';
        const targetSec = sectionResults[secKey] || sectionResults.aptitudes;

        if (qDef.type === 'choice') {
            const choice = getChoiceValue(dec);
            const weight = qDef.weight || 1;
            let status = 'non_fait';
            let pts = 0;

            if (choice === 'fait') {
                status = 'fait';
                pts = weight * 1.0;
            } else if (choice === 'en_partie') {
                status = 'en_partie';
                pts = weight * 0.5;
            }

            targetSec.points += pts;
            targetSec.maxPoints += weight;
            targetSec.items.push({
                id: qDef.originalId || qId,
                label: qDef.label,
                status,
                points: pts,
                maxPoints: weight
            });
        }
    });

    const computeSectionScore20 = (sec) => {
        if (sec.maxPoints <= 0) return 20.0;
        const ratio = Math.max(0, Math.min(1, sec.points / sec.maxPoints));
        return Math.round(ratio * 20 * 100) / 100;
    };

    const aptitudesScore20 = computeSectionScore20(sectionResults.aptitudes);
    const commScore20 = computeSectionScore20(sectionResults.communication);
    const perfScore20 = computeSectionScore20(sectionResults.performance);

    sectionResults.aptitudes.score20 = aptitudesScore20;
    sectionResults.communication.score20 = commScore20;
    sectionResults.performance.score20 = perfScore20;

    let globalScore20 = Math.round((
        aptitudesScore20 * ECOS_SECTION_WEIGHTS.aptitudes +
        commScore20 * ECOS_SECTION_WEIGHTS.communication +
        perfScore20 * ECOS_SECTION_WEIGHTS.performance
    ) * 100) / 100;

    const redhibitoryTriggered = redhibitoryHits.length > 0;
    if (redhibitoryTriggered) {
        globalScore20 = 0.0;
    }

    const validated = globalScore20 >= PASSING_SCORE_ON_20 && !redhibitoryTriggered;

    return {
        finalScore: globalScore20,
        validated,
        redhibitoryTriggered,
        redhibitoryErrorsFound: redhibitoryHits,
        sections: sectionResults
    };
}

/**
 * Evaluation complete ECOS en fin de station
 *
 * Regle absolue : Jev ou rien. Si l'appel echoue, aucune note n'est generee
 * et la station est marquee unrated: true.
 */
export async function evaluateStation(caseData = {}, transcript = "", sessionSummary = {}, options = {}) {
    const cleanTranscript = (transcript || "").trim();
    if (!cleanTranscript) {
        return {
            success: false,
            unrated: true,
            message: "Station non notée, réessayez plus tard (aucun transcript disponible).",
            transcript: cleanTranscript
        };
    }

    const questionsList = buildScoringQuestions(caseData, sessionSummary);
    const questionsObj = {};
    questionsList.forEach(q => {
        questionsObj[q.id] = q;
    });

    let decisions = null;

    try {
        decisions = await callJev({
            state: cleanTranscript,
            questions: questionsObj
        }, options);
    } catch (err) {
        // Règle d'or : c'est Jev ou rien. Aucun repli DeepSeek, aucun repli heuristique.
        console.error("[JevClient] Échec de la notation Jev de la station :", err.message);
        return {
            success: false,
            unrated: true,
            message: "Station non notée, réessayez plus tard.",
            transcript: cleanTranscript
        };
    }

    const scoring = computeFinalScores(caseData, decisions);

    return {
        success: true,
        unrated: false,
        finalScore: scoring.finalScore,
        globalScore20: scoring.finalScore,
        validated: scoring.validated,
        passed: scoring.validated,
        redhibitoryTriggered: scoring.redhibitoryTriggered,
        hasRedhibitoryError: scoring.redhibitoryTriggered,
        redhibitoryErrorsFound: scoring.redhibitoryErrorsFound,
        redhibitoryHits: scoring.redhibitoryErrorsFound,
        sections: scoring.sections,
        transcript: cleanTranscript,
        weights: ECOS_SECTION_WEIGHTS
    };
}

// Objet principal exporte pour utilisation globale dans le navigateur
const JevClient = {
    ECOS_SECTION_WEIGHTS,
    ROUTING_CONFIDENCE_THRESHOLD,
    REDHIBITORY_THRESHOLD,
    PASSING_SCORE_ON_20,
    ACTION_ROLES,
    ROUTING_QUESTIONS,
    getNoulProbability,
    getChoiceValue,
    callJev,
    routeMessage,
    formatTimeCode,
    buildUnifiedTranscript,
    buildScoringQuestions,
    computeFinalScores,
    evaluateStation
};

// Exposition du client Jev sur l'objet global window pour les scripts du navigateur (js/game.js, etc.)
if (typeof window !== 'undefined') {
    window.JevClient = JevClient;
}

export default JevClient;
