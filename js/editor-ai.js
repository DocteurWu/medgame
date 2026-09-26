/**
 * editor-ai.js — Assistant Médical IA & Autocomplétion pour l'Éditeur de Cas MedGame
 * 
 * Permet d'autocompléter ou générer des sections entières (Persona, Anamnèse, Examen clinique,
 * Examens paracliniques avec gradation, Traitements, Pièges, Verrous QCM, Station ECOS, Correction Markdown).
 */

class EditorAI {
    /**
     * Vérifie si le LLM est disponible
     */
    static isAvailable() {
        return typeof LLMClient !== 'undefined';
    }

    /**
     * Affiche un toast / notification visuelle
     */
    static showToast(message, type = 'info') {
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            console.log(`[EditorAI] ${type.toUpperCase()}: ${message}`);
        }
    }

    /**
     * Appelle le LLM avec format JSON strict
     */
    static async requestJson(systemPrompt, userPrompt, temperature = 0.6) {
        if (!this.isAvailable()) {
            throw new Error("LLMClient n'est pas chargé. Vérifiez vos scripts.");
        }

        const messages = [
            {
                role: 'system',
                content: `${systemPrompt}\n\nIMPORTANT : Réponds UNIQUEMENT avec un objet JSON valide, sans texte d'introduction ni balises markdown additionnelles, pour être parsable directement avec JSON.parse().`
            },
            {
                role: 'user',
                content: userPrompt
            }
        ];

        const raw = await LLMClient.request({
            messages,
            temperature,
            maxTokens: 3500,
            quotaKind: 'correction' // exempt de quota utilisateur
        });

        // Nettoyer la réponse pour extraire le JSON
        let clean = raw.trim();
        if (clean.startsWith('```json')) clean = clean.substring(7);
        if (clean.startsWith('```')) clean = clean.substring(3);
        if (clean.endsWith('```')) clean = clean.substring(0, clean.length - 3);
        clean = clean.trim();

        try {
            return JSON.parse(clean);
        } catch (err) {
            console.error("[EditorAI] Erreur de parsing JSON:", raw);
            throw new Error("La réponse du LLM n'est pas un JSON valide : " + err.message);
        }
    }

    /**
     * Génère un cas complet de A à Z à partir d'un motif ou d'un diagnostic
     */
    static async generateFullCase({ specialty, topic, difficulty = 3 }) {
        const systemPrompt = `Tu es un professeur de médecine expert pédagogique en simulation clinique (R2C, ECOS). 
Tu dois créer un cas clinique complet, réaliste, cohérent et hautement pédagogique pour le serious game médical MedGame.
Le format de sortie DOIT respecter la structure JSON exacte suivante :
{
  "id": "slug_unique_specialite_pathologie_patient",
  "redacteur": "Dr MedGame AI",
  "referentiel": "Société savante / Collège (ex: SFC, SPLF, CNGOF)",
  "itemR2C": "Item XXX. Titre officiel",
  "difficulty": ${difficulty},
  "patient": {
    "nom": "Nom réaliste",
    "prenom": "Prénom réaliste",
    "age": 55,
    "sexe": "M ou F",
    "taille": "172 cm",
    "poids": "75 kg",
    "groupeSanguin": "A+",
    "model3D": "character-male-c.glb (ou female-a..f / male-a..f selon sexe et âge)",
    "persona": {
      "ton": "calme mais inquiet",
      "registre": "courant",
      "loquacite": "normal",
      "style_parole": "décrit ses symptômes précisément si on interroge",
      "exemples_phrases": ["Exemple 1", "Exemple 2"],
      "anxiete": 50,
      "confiance": 60
    }
  },
  "interrogatoire": {
    "motifHospitalisation": "Motif précis",
    "modeDeVie": {
      "activitePhysique": { "description": "Modérée" },
      "tabac": { "presence": false, "quantite": "0 PA", "duree": "0" },
      "alcool": { "presence": false, "quantite": "Occasionnel" },
      "alimentation": { "regime": "Équilibré", "particularites": "Aucune" },
      "emploi": { "profession": "Profession", "stress": "Modéré" }
    },
    "antecedents": {
      "medicaux": [{ "type": "Pathologie", "traitement": "Traitement" }],
      "chirurgicaux": [{ "intervention": "Chirurgie", "annee": "2018" }],
      "familiaux": [{ "antecedent": "Maladie", "lien": "Père" }]
    },
    "traitements": [{ "nom": "Médicament", "dose": "100mg", "frequence": "1/j" }],
    "allergies": { "presence": false, "liste": [] },
    "histoireMaladie": {
      "debutSymptomes": "Durée",
      "evolution": "Aiguë / Progressive",
      "facteursDeclenchants": "Facteur",
      "descriptionDouleur": "Type, siège, irradiation...",
      "symptomesAssocies": ["Symptôme 1", "Symptôme 2"],
      "remarques": "Précision utile"
    },
    "verbatim": "Phrase spontanée du patient lorsqu'on l'accueille"
  },
  "examenClinique": {
    "constantes": {
      "tension": "125/80 mmHg",
      "pouls": "78 bpm",
      "temperature": "37.0°C",
      "saturationO2": "98%",
      "frequenceRespiratoire": "16/min"
    },
    "aspectGeneral": "Description de l'état général",
    "examenCardiovasculaire": { "auscultation": "...", "inspection": "...", "palpation": "..." },
    "examenPulmonaire": { "auscultation": "...", "inspection": "..." },
    "examenAbdominal": { "palpation": "..." },
    "examenNeurologique": { "conscience": "..." }
  },
  "availableExams": ["ECG", "NFS-Plaquettes", "Iono-Urée-Créat", "Radio Thorax", "Scanner", "..."],
  "examResults": {
    "ECG": "Résultat précis...",
    "NFS-Plaquettes": "Résultat biologique...",
    "Radio Thorax": "Aspect radiologique..."
  },
  "examGradation": {
    "parfaits": ["Examens indispensables de 1ère ligne"],
    "utiles": ["Examens utiles de 2ème ligne"],
    "inutiles": ["Examens non indiqués / redondants"],
    "dangereux": ["Examens contre-indiqués ou invasifs à risque"]
  },
  "relevantExams": ["Liste des examens clés attendus"],
  "possibleDiagnostics": ["Diagnostic principal", "Différentiel 1", "Différentiel 2", "Différentiel 3"],
  "correctDiagnostic": "Diagnostic principal",
  "alternativeDiagnostics": ["Différentiel 1", "Différentiel 2"],
  "pieges": ["Piège sémiologique ou diagnostique"],
  "possibleTreatments": ["Traitement clé 1", "Traitement clé 2", "Traitement alternatif", "Traitement contre-indiqué"],
  "correctTreatments": ["Traitement clé 1", "Traitement clé 2"],
  "secondLineTreatments": ["Traitement alternatif"],
  "fatalTreatments": ["Traitement contre-indiqué"],
  "vitalsDynamics": {
    "trendOverMinutes": 0.05,
    "urgencyMultiplier": 1.5,
    "aggravationTargets": {
      "heartRate": 110,
      "systolic": 90,
      "spo2": 92,
      "temperature": 38.5,
      "respiratoryRate": 26
    },
    "stabilizeOnCorrectTreatment": true
  },
  "locks": [
    {
      "id": "lock_01",
      "type": "QCM",
      "label": "Défi sémiologique",
      "target_fields": ["examResults.ECG"],
      "challenge": {
        "question": "Question de réflexion clinique pour débloquer l'examen ?",
        "options": ["Bonne réponse", "Mauvaise réponse 1", "Mauvaise réponse 2", "Mauvaise réponse 3"],
        "correct_indices": [0]
      },
      "feedback_error": "Explication pédagogique de l'erreur..."
    }
  ],
  "objectifs": [
    "Objectif pédagogique 1",
    "Objectif pédagogique 2",
    "Objectif pédagogique 3"
  ],
  "hints": [
    "Indice 1 pour orienter le joueur",
    "Indice 2"
  ],
  "correction": "# Titre du diagnostic\\n\\n## Diagnostic et Raisonnement\\nExplication détaillée...\\n\\n## Points Clés\\n- Point 1\\n- Point 2\\n\\n## Pièges à éviter\\n- Piège 1\\n\\n## Prise en charge thérapeutique\\nDétail du traitement...",
  "ecos": {
    "vignette": {
      "role": "Vous êtes interne en médecine.",
      "contexte": "Vous recevez ce patient pour...",
      "typeStation": "AVEC_PS",
      "domainePrincipal": "Entretien/Interrogatoire",
      "domaineSecondaire": "Stratégie pertinente de PEC",
      "lieu": "Cabinet de consultation / Urgences",
      "materielDisponible": ["Stéthoscope", "Tensiomètre", "ECG"],
      "consignesAttendues": ["Caractériser la plainte", "Examiner le patient", "Proposer la prise en charge"],
      "consignesInterdites": ["Ne pas donner de traitement toxique"]
    },
    "patientStandardise": {
      "personnalite": "Description du rôle joué par l'acteur",
      "phraseOuverture": "Phrase d'ouverture spontanée",
      "infosVolontaires": ["Info donnée d'emblée"],
      "infosSiDemandees": ["Info donnée seulement sur question"],
      "infosCachees": ["Info secrète / taboue"],
      "reactions": {
        "brutal": "Réaction si l'étudiant est agressif ou direct",
        "silence": "Réaction si l'étudiant reste muet",
        "jargon": "Réaction si l'étudiant emploie des mots incompréhensibles"
      }
    },
    "grilleAptitudesCliniques": [
      {
        "id": "accueil",
        "label": "Se présente et installe le patient avec courtoisie",
        "weight": 1,
        "triggerKeywords": ["bonjour", "présente", "interne"],
        "category": "interrogatoire",
        "criteria": {
          "fait": "Accueil parfait et installation.",
          "en_partie": "Salue mais sans explications.",
          "non_fait": "Aucun accueil."
        }
      },
      {
        "id": "caracterisation_plainte",
        "label": "Caractérise la plainte principale",
        "weight": 2,
        "triggerKeywords": ["siège", "durée", "intensité", "déclencheur"],
        "category": "interrogatoire",
        "criteria": {
          "fait": "Anamnèse complète et structurée.",
          "en_partie": "Anamnèse incomplète.",
          "non_fait": "Omet de caractériser la plainte."
        }
      }
    ],
    "grilleCommunication": [
      {
        "id": "ecoute_active",
        "label": "Écoute active sans couper la parole",
        "max": 1,
        "criteria": {
          "fait": "Laisse le patient s'exprimer.",
          "en_partie": "Interrompt par moments.",
          "non_fait": "Directif et agressif."
        }
      },
      {
        "id": "empathie",
        "label": "Fait preuve d'empathie et adapte son langage",
        "max": 1,
        "criteria": {
          "fait": "Bienveillant et clair.",
          "en_partie": "Neutre mais froid.",
          "non_fait": "Jargon hermétique ou méprisant."
        }
      }
    ]
  }
}`;

        const userPrompt = `Génère un cas médical complet pour la spécialité "${specialty || 'Médecine Générale'}" sur le sujet / pathologie : "${topic}". Difficulté souhaitée : ${difficulty}/5. Remplis TOUS les champs avec rigueur médicale et exactitude sémiologique.`;

        return await this.requestJson(systemPrompt, userPrompt, 0.7);
    }

    /**
     * Autocomplète les champs manquants d'un cas existant
     */
    static async autocompleteMissingFields(currentCaseData) {
        const systemPrompt = `Tu es un assistant IA spécialisé dans la création de dossiers cliniques pour MedGame.
À partir des informations partielles fournies dans le JSON du cas (motif, antécédents, constantes, ou diagnostic déjà saisi), complète TOUS les champs manquants ou vides de manière parfaitement cohérente sur le plan médical.
Préserve scrupuleusement les champs déjà remplis par l'utilisateur. Retourne l'objet JSON complet enrichi.`;

        const userPrompt = `Voici l'état actuel du cas clinique (complète les sections vides ou partielles avec cohérence) :\n\n${JSON.stringify(currentCaseData, null, 2)}`;

        return await this.requestJson(systemPrompt, userPrompt, 0.5);
    }

    /**
     * Suggère un Persona & Dialogue pour le patient
     */
    static async generatePersona(patientInfo, motif) {
        const systemPrompt = `Tu es un expert en communication médicale et conception de patients standardisés (PS).
Génère la structure persona et dialogue pour un patient.`;

        const userPrompt = `Patient: ${JSON.stringify(patientInfo)}, Motif: "${motif}".
Génère un JSON avec :
{
  "persona": {
    "ton": "...",
    "registre": "...",
    "loquacite": "reserve | normal | bavard",
    "style_parole": "...",
    "exemples_phrases": ["...", "..."],
    "anxiete": 50,
    "confiance": 60
  },
  "dialogue": {
    "phraseOuverture": "...",
    "objectifs_cles": ["...", "..."],
    "spontane": ["motifHospitalisation", "..."],
    "si_question": ["histoireMaladie.debutSymptomes", "..."],
    "si_insiste": ["histoireMaladie.remarques"],
    "ne_jamais_reveler": ["le diagnostic final", "..."]
  }
}`;

        return await this.requestJson(systemPrompt, userPrompt, 0.7);
    }

    /**
     * Suggère des examens paracliniques avec gradation
     */
    static async generateExamGradation(diagnostic, motif) {
        const systemPrompt = `Tu es un cardiologue / interniste expert. Propose une batterie d'examens paracliniques avec leurs résultats et leur gradation pour le cas clinique.`;

        const userPrompt = `Diagnostic visé: "${diagnostic}", Motif: "${motif}".
Génère un JSON avec :
{
  "availableExams": ["ECG", "NFS-Plaquettes", "..."],
  "examResults": {
    "ECG": "Résultat détaillé...",
    "NFS-Plaquettes": "Résultats détaillés..."
  },
  "examGradation": {
    "parfaits": ["Examens de 1ère intention clés"],
    "utiles": ["Examens d'appoint utiles"],
    "inutiles": ["Examens non indiqués"],
    "dangereux": ["Examens toxiques ou contre-indiqués"]
  },
  "relevantExams": ["Liste des examens à demander"]
}`;

        return await this.requestJson(systemPrompt, userPrompt, 0.5);
    }

    /**
     * Suggère diagnostics & thérapeutiques (1ère ligne, fatals, pièges)
     */
    static async generateTherapeutics(diagnostic, motif) {
        const systemPrompt = `Tu es un médecin spécialiste hospitalier. Propose les diagnostics différentiels, pièges et options thérapeutiques pour ce cas.`;

        const userPrompt = `Diagnostic principal: "${diagnostic}", Motif: "${motif}".
Génère un JSON avec :
{
  "possibleDiagnostics": ["${diagnostic}", "Différentiel 1", "Différentiel 2", "Différentiel 3"],
  "correctDiagnostic": "${diagnostic}",
  "alternativeDiagnostics": ["Différentiel 1", "Différentiel 2"],
  "pieges": ["Piège diagnostique 1", "Piège 2"],
  "possibleTreatments": ["Traitement 1", "Traitement 2", "Traitement alternatif", "Traitement fatal/dangereux"],
  "correctTreatments": ["Traitement 1", "Traitement 2"],
  "secondLineTreatments": ["Traitement alternatif"],
  "fatalTreatments": ["Traitement fatal/dangereux"]
}`;

        return await this.requestJson(systemPrompt, userPrompt, 0.5);
    }

    /**
     * Génère une fiche de correction Markdown structurée
     */
    static async generateCorrectionMarkdown(caseData) {
        const systemPrompt = `Tu es un professeur de médecine rédacteur d'annales médicales.
Rédige une correction pédagogique complète au format Markdown pour le dossier clinique fourni.
Structure attendue :
# Titre du Diagnostic Principal

## Synthèse Clinique & Argumentation
- Éléments clés de l'interrogatoire
- Éléments clés de l'examen physique
- Justification des examens complémentaires

## Diagnostics Différentiels & Pièges
- Différentiels à écarter
- Pièges à ne pas commettre

## Prise en charge Thérapeutique & Recommandations
- Traitement d'urgence / de fond
- Surveillance et critères d'évolution
- Références aux recommandations (ex: ESC, HAS, Collèges)`;

        const userPrompt = `Voici les données du cas :\n${JSON.stringify({
            motif: caseData.interrogatoire?.motifHospitalisation,
            patient: caseData.patient,
            diagnostic: caseData.correctDiagnostic,
            traitements: caseData.correctTreatments,
            examens: caseData.examResults
        }, null, 2)}`;

        const raw = await LLMClient.request({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.6,
            maxTokens: 2500,
            quotaKind: 'correction'
        });

        return raw.trim();
    }

    /**
     * Génère une station ECOS complète (Vignette + PS + Grille R2C)
     */
    static async generateEcosStation(caseData) {
        const systemPrompt = `Tu es le responsable national de la docimologie ECOS (Épreuves Cliniques d'Objectif Structuré) pour la R2C en France.
Génère une station ECOS standardisée de 8 minutes complète et conforme.`;

        const userPrompt = `Cas médical :
Motif : "${caseData.interrogatoire?.motifHospitalisation || 'Motif'}"
Diagnostic : "${caseData.correctDiagnostic || 'Diagnostic'}"
Patient : ${caseData.patient?.prenom || ''} ${caseData.patient?.nom || ''}, ${caseData.patient?.age || 50} ans, ${caseData.patient?.sexe || 'M'}.

Génère un JSON avec la structure :
{
  "vignette": {
    "role": "...",
    "contexte": "...",
    "typeStation": "AVEC_PS",
    "domainePrincipal": "Entretien/Interrogatoire",
    "domaineSecondaire": "Stratégie pertinente de PEC",
    "lieu": "Cabinet de consultation",
    "materielDisponible": ["Stéthoscope", "Tensiomètre", "..."],
    "consignesAttendues": ["...", "..."],
    "consignesInterdites": ["..."]
  },
  "patientStandardise": {
    "personnalite": "...",
    "phraseOuverture": "...",
    "infosVolontaires": ["...", "..."],
    "infosSiDemandees": ["...", "..."],
    "infosCachees": ["..."],
    "reactions": {
      "brutal": "...",
      "silence": "...",
      "jargon": "..."
    }
  },
  "grilleAptitudesCliniques": [
    {
      "id": "accueil",
      "label": "Se présente et installe le patient",
      "weight": 1,
      "triggerKeywords": ["bonjour", "interne"],
      "category": "interrogatoire",
      "criteria": {
        "fait": "Critère fait...",
        "en_partie": "Critère en partie...",
        "non_fait": "Critère non fait..."
      }
    }
  ],
  "grilleCommunication": [
    {
      "id": "ecoute",
      "label": "Écoute active sans interruption",
      "max": 1,
      "criteria": {
        "fait": "...",
        "en_partie": "...",
        "non_fait": "..."
      }
    }
  ]
}`;

        return await this.requestJson(systemPrompt, userPrompt, 0.6);
    }

    /**
     * Analyse et structure une dictée vocale libre (Win + H) en un cas clinique complet JSON 2.0
     */
    static async structureDictation(rawDictatedText, currentCaseData = null) {
        const systemPrompt = `Tu es un assistant d'analyse médicale en temps réel.
L'utilisateur a dicté son observation clinique à la voix (via le raccourci Windows H / saisie vocale).
La dictée peut contenir des imprécisions phonétiques, des abréviations médicales courantes (ex: TA 12/8, tropo, NFS, ECG, coronaro, SCA ST+, etc.) ou un langage parlé.

Ta mission :
1. Corriger les fautes de dictée vocale et convertir les termes familiers en terminologie médicale rigoureuse.
2. Extraire et structurer toutes les informations médicales (Patient, Constantes, Anamnèse, Antécédents, Traitements, Examen physique, Examens paracliniques avec gradation parfaits/utiles/inutiles/dangereux, Diagnostics, Traitements corrects/fatals, Correction).
3. Si des champs ne sont pas explicitement dictés, déduis-les logiquement et harmonieusement pour que le cas soit complet et jouable.

Retourne UNIQUEMENT l'objet JSON complet au format MedGame 2.0.`;

        const userPrompt = `Voici la dictée vocale brute du clinicien (raccourci Win + H) :
"""
${rawDictatedText}
"""
${currentCaseData ? `\n(État actuel du dossier pour contexte / fusion : ${JSON.stringify(currentCaseData)})` : ''}`;

        return await this.requestJson(systemPrompt, userPrompt, 0.6);
    }

    /**
     * Reformule et corrige un champ spécifique dicté à la voix (Win + H)
     */
    static async formatDictatedField(fieldName, rawFieldText) {
        const systemPrompt = `Tu es un secrétaire médical et professeur de sémiologie.
L'utilisateur a dicté à la voix un texte pour le champ médical : "${fieldName}".
Corrige les erreurs de reconnaissance vocale, formate avec un style médical soigné, précis et fluide. Ne réponds qu'avec le texte corrigé, sans introduction.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: rawFieldText }
        ];

        const res = await LLMClient.request({
            messages,
            temperature: 0.3,
            maxTokens: 1000,
            quotaKind: 'correction'
        });

        return res.trim();
    }
}

window.EditorAI = EditorAI;

