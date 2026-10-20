# Gabarit de référence — Cas clinique au format ECOS réel (R2C / EDN)

Ce document décrit le format standardisé des stations ECOS (Examens Cliniques Objectifs et Structurés) dans **MedGame**.
Ce modèle doit être répliqué pour l'ensemble des spécialités médicales (Cardiologie pilote, Neurologie, Pneumologie, etc.).

---

## 1. Principes cardinaux

1. **Organisation par MOTIF, jamais par diagnostic** :
   - Le joueur / étudiant ne doit **jamais** connaître le diagnostic final avant la fin de la station.
   - Le nom de fichier et l'identifiant reflètent le motif de consultation et le nom fictif du patient :
     `specialite_motif_consultation_titre_patient.json` (ex: `cardio_douleur_thoracique_mme_bennet.json`).
   - Le champ racine `"motif"` (court et symptomatique, ex: `"Douleur thoracique à l'effort"`) sert de titre partout dans l'interface (menus, HUD, vignette).
   - `"correctDiagnostic"` reste une donnée strictement interne de scoring, révélée uniquement au débriefing final.

2. **Structure en 4 volets ECOS explicite dans l'objet `"ecos"`** :
   - **Volet 1 — Consignes Étudiant** (`consignesEtudiant`)
   - **Volet 2 — Consignes Patient Standardisé (PS)** (`consignesPatient`)
   - **Volet 3 — Consignes Évaluateur** (`consignesEvaluateur`)
   - **Volet 4 — Grille d'évaluation** (`grilleAptitudesCliniques` & `grilleCommunication`)

3. **Rétrocompatibilité totale** :
   - Les clés historiques (`vignette`, `patientStandardise`) sont maintenues en miroir pour garantir le bon fonctionnement des versions antérieures de l'UI et du moteur.

---

## 2. Structure JSON standardisée d'une station ECOS

```json
{
  "id": "cardio_douleur_thoracique_mme_bennet",
  "motif": "Douleur thoracique à l'effort",
  "redacteur": "Collège de Cardiologie (SFC) / MedGame",
  "difficulty": 2,

  "patient": {
    "nom": "Bennet",
    "prenom": "Kitty",
    "age": 58,
    "sexe": "F",
    "taille": "165 cm",
    "poids": "70 kg",
    "groupeSanguin": "B+",
    "persona": {
      "ton": "polie mais minimisante (« c'est rien, ça passe »)",
      "registre": "courant, précis sur les faits",
      "loquacite": "normal",
      "style_parole": "décrit bien l'effort si demandé, élude la gravité",
      "exemples_phrases": [
        "Oh, c'est quand je monte les escaliers, ça serre... mais dès que je m'arrête ça passe.",
        "J'ai un petit spray dans mon sac, un pschitt sous la langue et ça va mieux."
      ],
      "anxiete": 55,
      "confiance": 65
    }
  },

  "ecos": {
    "titre": "Douleur thoracique à l'effort",
    "itemR2C": "Item 222 (ex-219). Facteurs de risque cardiovasculaire et prévention. Item 232 (ex-228). Douleur thoracique aiguë et chronique.",

    "consignesEtudiant": {
      "role": "Vous êtes médecin cardiologue en consultation hospitalière ou de ville.",
      "contexte": "Vous recevez Mme Kitty Bennet, 58 ans, adressée par son médecin traitant pour des épisodes récurrents d'oppression thoracique à l'effort survenant depuis 6 mois.",
      "dureeMinutes": 8,
      "consignes": [
        "Réaliser un interrogatoire complet centré sur la symptomatologie fonctionnelle",
        "Rechercher et hiérarchiser les facteurs de risque cardiovasculaire",
        "Réaliser un examen clinique ciblé",
        "Proposer et justifier la stratégie diagnostique de première intention",
        "Expliquer la situation à la patiente et lui dispenser l'éducation aux signes d'alerte"
      ],
      "interdits": [
        "Ne pas réaliser d'angioplastie ou de geste invasif en urgence immédiate au cabinet",
        "Ne pas administrer d'adrénaline"
      ],
      "materielDisponible": [
        "Stéthoscope",
        "Tensiomètre",
        "Oxymètre de pouls",
        "ECG 12 dérivations",
        "Trinitrine sublinguale spray"
      ],
      "lieu": "Cabinet de consultation"
    },

    "consignesPatient": {
      "identite": {
        "prenom": "Kitty",
        "nom": "Bennet",
        "age": 58,
        "sexe": "F"
      },
      "personnalite": "Patiente coopérative, polie mais minimise ses symptômes. Inquiète pour son projet de voyage.",
      "phraseOuverture": "Bonjour docteur, je viens vous voir car mon médecin traitant s'inquiète. J'ai une gêne dans la poitrine quand je monte les escaliers depuis plusieurs mois.",
      "infosVolontaires": [
        "Oppression au milieu de la poitrine survenant exclusivement à l'effort",
        "Disparition rapide au repos en moins de 5 minutes"
      ],
      "infosSiDemandees": [
        "Diabète de type 2 traité par metformine",
        "Père décédé d'un infarctus du myocarde à l'âge de 65 ans",
        "Utilisation occasionnelle d'un spray de trinitrine qui soulage en 2 minutes"
      ],
      "infosCachees": [
        "Oublie parfois de prendre ses antidiabétiques quand elle est débordée au travail"
      ],
      "questionsPieges": [
        "Docteur, est-ce que je peux quand même partir en randonnée dans les Alpes la semaine prochaine ?",
        "Ce n'est pas juste un problème d'angoisse ou d'estomac ?"
      ],
      "reactions": {
        "brutal": "Je vous trouve un peu direct docteur, vous voulez dire que mon cœur est abîmé ?",
        "silence": "Docteur, vous avez l'air inquiet... qu'est-ce que vous regardez ?",
        "jargon": "Pardon docteur, qu'est-ce que vous voulez dire par « ischémie » ?"
      }
    },

    "consignesEvaluateur": {
      "pointCle": "Le candidat doit reconnaître une douleur angineuse d'effort typique chez une patiente à haut risque cardiovasculaire (diabète + hérédité) et prescrire un ECG de repos ainsi qu'un test d'ischémie non invasif.",
      "erreursRedhibitoires": [
        "Méconnaître le caractère urgent d'une douleur thoracique de repos (syndrome coronarien aigu)",
        "Affirmer qu'un ECG de repos normal élimine le diagnostic d'ischémie myocardique",
        "Omettre la prescription d'antiagrégant plaquettaire et de statine"
      ],
      "elementsAttendus": [
        "Caractérisation sémiologique complète (siège rétro-sternal, constriction, effort, cédant au repos/trinitrine)",
        "Dépistage des FDRCV : diabète, dyslipidémie, HTA, tabac, hérédité coronaire",
        "Examen cardiovasculaire complet (auscultation, pouls, constantes)",
        "Prescription ECG 12 dérivations et épreuve d'effort / coroscanner",
        "Éducation sur le recours au SAMU 15 si douleur > 15-20 min résistante à la trinitrine"
      ],
      "grille": [
        {
          "id": "item_interrogatoire_caracterisation",
          "label": "Caractérise la douleur thoracique (type constrictif, siège, déclenchement à l'effort, soulagement au repos/trinitrine)",
          "weight": 1,
          "points": { "F": 1.0, "EP": 0.5, "NF": 0.0 }
        },
        {
          "id": "item_interrogatoire_fdrcv",
          "label": "Recherche exhaustivement les facteurs de risque cardiovasculaire",
          "weight": 1,
          "points": { "F": 1.0, "EP": 0.5, "NF": 0.0 }
        },
        {
          "id": "item_examen_physique",
          "label": "Réalise la prise des constantes et l'examen cardiovasculaire complet",
          "weight": 1,
          "points": { "F": 1.0, "EP": 0.5, "NF": 0.0 }
        },
        {
          "id": "item_strategie_diagnostique",
          "label": "Propose une stratégie diagnostique adaptée (ECG repos + test fonctionnel d'ischémie)",
          "weight": 1,
          "points": { "F": 1.0, "EP": 0.5, "NF": 0.0 }
        },
        {
          "id": "item_education_securite",
          "label": "Donne les consignes de sécurité et d'appel au 15 en cas de crise prolongée",
          "weight": 1,
          "points": { "F": 1.0, "EP": 0.5, "NF": 0.0 }
        }
      ]
    },

    "vignette": {
      "role": "Vous êtes médecin cardiologue en consultation hospitalière ou de ville.",
      "contexte": "Vous recevez Mme Kitty Bennet, 58 ans, adressée par son médecin traitant pour des épisodes récurrents d'oppression thoracique à l'effort survenant depuis 6 mois.",
      "consignesAttendues": [
        "Réaliser un interrogatoire complet centré sur la symptomatologie fonctionnelle",
        "Rechercher et hiérarchiser les facteurs de risque cardiovasculaire",
        "Réaliser un examen clinique ciblé",
        "Proposer et justifier la stratégie diagnostique de première intention",
        "Expliquer la situation à la patiente et lui dispenser l'éducation aux signes d'alerte"
      ],
      "consignesInterdites": [
        "Ne pas réaliser d'angioplastie ou de geste invasif en urgence immédiate au cabinet",
        "Ne pas administrer d'adrénaline"
      ],
      "typeStation": "AVEC_PS",
      "domainePrincipal": "Entretien/Interrogatoire",
      "domaineSecondaire": "Stratégie pertinente de PEC",
      "lieu": "Cabinet de consultation",
      "materielDisponible": [
        "Stéthoscope",
        "Tensiomètre",
        "Oxymètre de pouls",
        "ECG 12 dérivations",
        "Trinitrine sublinguale spray"
      ]
    },

    "patientStandardise": {
      "phraseOuverture": "Bonjour docteur, je viens vous voir car mon médecin traitant s'inquiète. J'ai une gêne dans la poitrine quand je monte les escaliers depuis plusieurs mois.",
      "infosVolontaires": [
        "Oppression au milieu de la poitrine survenant exclusivement à l'effort",
        "Disparition rapide au repos en moins de 5 minutes"
      ],
      "infosSiDemandees": [
        "Diabète de type 2 traité par metformine",
        "Père décédé d'un infarctus du myocarde à l'âge de 65 ans",
        "Utilisation occasionnelle d'un spray de trinitrine qui soulage en 2 minutes"
      ],
      "infosCachees": [
        "Oublie parfois de prendre ses antidiabétiques quand elle est débordée au travail"
      ],
      "reactions": {
        "brutal": "Je vous trouve un peu direct docteur, vous voulez dire que mon cœur est abîmé ?",
        "silence": "Docteur, vous avez l'air inquiet... qu'est-ce que vous regardez ?",
        "jargon": "Pardon docteur, qu'est-ce que vous voulez dire par « ischémie » ?"
      },
      "personnalite": "Patiente coopérative, polie mais minimise ses symptômes. Inquiète pour son projet de voyage."
    },

    "grilleAptitudesCliniques": [
      {
        "id": "accueil_presentation",
        "label": "Se présente, installe la patiente et explicite le cadre de la consultation",
        "weight": 1,
        "triggerKeywords": ["bonjour", "docteur", "installez-vous", "consultation"]
      },
      {
        "id": "interrogatoire_douleur",
        "label": "Caractérise la douleur thoracique selon les critères sémiologiques complets",
        "weight": 1,
        "triggerKeywords": ["siège", "rétrosternale", "constriction", "irradiation", "durée", "effort", "trinitrine", "repos"]
      },
      {
        "id": "interrogatoire_fdrcv",
        "label": "Dépiste les facteurs de risque cardiovasculaire (diabète, hérédité, HTA, tabac, lipides)",
        "weight": 1,
        "triggerKeywords": ["diabète", "tabac", "cholestérol", "hypertension", "famille", "père", "infarctus"]
      },
      {
        "id": "examen_cardiovasculaire",
        "label": "Réalise un examen cardiovasculaire et pulmonaire complet",
        "weight": 1,
        "triggerKeywords": ["auscultation", "souffle", "pouls", "tension", "crépitants"]
      },
      {
        "id": "strategie_diagnostique",
        "label": "Propose une stratégie diagnostique conforme (ECG, test d'ischémie, bilan biologique)",
        "weight": 1,
        "triggerKeywords": ["ECG", "électrocardiogramme", "test d'effort", "épreuve d'effort", "troponine", "bilan lipidique"]
      },
      {
        "id": "annonce_education",
        "label": "Explique l'hypothèse au patient et éduque aux signes d'alerte (appel au 15 si crise > 15 min)",
        "weight": 1,
        "triggerKeywords": ["artères du cœur", "alerte", "15", "SAMU", "repos", "trinitrine"]
      }
    ],

    "grilleCommunication": [
      {
        "id": "ecoute_active",
        "label": "Écoute active — laisse le patient exprimer son motif sans l'interrompre",
        "max": 1
      },
      {
        "id": "empathie",
        "label": "Fait preuve d'empathie face à l'inquiétude de la patiente",
        "max": 1
      },
      {
        "id": "structure_entretien",
        "label": "Structure l'entretien de façon fluide et logique",
        "max": 1
      },
      {
        "id": "vocabulaire_adapte",
        "label": "Utilise un langage clair, dénué de jargon médical non explicité",
        "max": 1
      },
      {
        "id": "verification_comprehension",
        "label": "Vérifie la compréhension et invite aux questions de la patiente",
        "max": 1
      }
    ]
  },

  "correctDiagnostic": "Angor stable",
  "possibleDiagnostics": [
    "Angor stable",
    "Angor instable",
    "Infarctus du myocarde",
    "Péricardite aiguë",
    "Embolie pulmonaire",
    "Reflux gastro-œsophagien"
  ],
  "alternativeDiagnostics": [
    "Syndrome coronarien chronique"
  ],

  "possibleTreatments": [
    "Bêta-bloquant",
    "Antiagrégant plaquettaire (Aspirine)",
    "Statine",
    "Trinitrine sublinguale en cas de crise",
    "Inhibiteur de l'enzyme de conversion (IEC)",
    "Dérivés nitrés d'action prolongée"
  ],
  "correctTreatments": [
    "Bêta-bloquant",
    "Antiagrégant plaquettaire (Aspirine)",
    "Statine",
    "Trinitrine sublinguale en cas de crise"
  ],

  "correction": "# Cas ECOS : Douleur thoracique à l'effort\n\n## Diagnostic final : Angor stable (Syndrome coronarien chronique)\n\n### 1. Synthèse clinique\nPatiente de 58 ans, diabétique de type 2 et présentant une hérédité coronarienne au premier degré (père infarctus à 65 ans), consultant pour une douleur rétro-sternale constrictive typique, reproductible à l'effort (montée d'escaliers) et rapidement résolutive au repos ou après trinitrine sublinguale, évoluant de façon stable depuis 6 mois.\n\n### 2. Raisonnement diagnostique\n- La séméiologie réunit les 3 critères de l'angor typique (localisation rétro-sternale constrictive, déclenchement à l'effort, soulagement au repos ou aux dérivés nitrés sous 5 min).\n- Le caractère stable sur 6 mois sans modification du seuil d'effort ni crise de repos élimine en première intention un syndrome coronarien aigu (angor instable / infarctus).\n- L'ECG intercritique normal ne doit en aucun cas récuser le diagnostic (normal dans plus de 50 % des cas au repos).\n\n### 3. Conduite à tenir recommandée (Recommandations SFC / ESC)\n- **Bilan diagnostique** : Évaluation de la probabilité pré-test d'ischémie, ECG de repos 12 dérivations, échocardiographie transthoracique (ETT), et imagerie d'effort ou coroscanner.\n- **Traitement de fond (BASIC)** :\n  - **B**êta-bloquant (ex: Bisoprolol 5 à 10 mg/j)\n  - **A**spirine (75 à 100 mg/j) ou Clopidogrel si intolérance\n  - **S**tatine à forte intensité (ex: Atorvastatine 40-80 mg/j pour cible LDL < 0,55 g/L)\n  - **I**EC si HTA ou diabète associé\n  - **C**orrection des facteurs de risque et éducation (sevrage, réadaptation, règles diététiques)\n- **Traitement de la crise** : Trinitrine sublinguale en spray (1 bouffée assise, renouvelable à 5 min si persistance ; appel du SAMU 15 si douleur > 15-20 min)."
}
```

---

## 3. Checklist de conformité pour toute nouvelle station

- [ ] Nom de fichier : `{specialite}_{motif_symptomatique}_{patient}.json` (en minuscules, sans espaces ni caractères spéciaux).
- [ ] Champ racine `"motif"` : libellé concis, médical mais symptomatique (ex : `"Malaise à l'effort"`, `"Claudication intermittente"`).
- [ ] Champ racine `"id"` identique au nom de fichier sans extension.
- [ ] Aucune mention du diagnostic dans `"motif"`, `"ecos.titre"`, `"ecos.consignesEtudiant"` ni `"ecos.vignette.consignesAttendues"`.
- [ ] Bloc `consignesEtudiant` complet (rôle, contexte, dureeMinutes = 8, consignes, interdits, matériel, lieu).
- [ ] Bloc `consignesPatient` complet (identité, personnalité, phrase d'ouverture, questions pièges, réactions).
- [ ] Bloc `consignesEvaluateur` complet (point clé, erreurs rédhibitoires, éléments attendus, grille critériée F/EP/NF).
- [ ] Grilles `grilleAptitudesCliniques` et `grilleCommunication` renseignées pour l'évaluation automatique.
- [ ] Vérification stricte : `node scripts/validate-cases.mjs` rapporte 0 erreur.
