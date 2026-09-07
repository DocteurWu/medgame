// scripts/corpus-definitions.mjs
// Généré automatiquement pour la refonte ECOS globale de l'ensemble du corpus MedGame

export const CASES_CONFIG = {
  "EDN_diabetetype2_1.json": {
    "spec": "endocrinologie",
    "newFile": "endo_fatigue_et_soif_accrue_mme_dupont.json",
    "motif": "Fatigue persistante et soif accrue",
    "prenom": "Marie",
    "nom": "Dupont",
    "age": 52,
    "sexe": "F",
    "itemR2C": "Item 247. Diabète sucré de types 1 et 2 de l'adulte et de l'enfant.",
    "role": "Vous êtes interne en médecine générale.",
    "contexte": "Vous recevez Mme Marie Dupont, 52 ans, adressée pour une fatigue inhabituelle depuis plusieurs mois accompagnée d'une polydipsie.",
    "consignes": [
      "Mener un interrogatoire méthodique sur les signes cardinaux et les facteurs de risque",
      "Rechercher les antécédents familiaux et les habitudes de vie",
      "Réaliser un examen clinique complet avec mesure des constantes et de l'IMC",
      "Proposer les examens complémentaires de première intention pour confirmer le diagnostic",
      "Donner les premiers conseils d'hygiène de vie et planifier le suivi"
    ],
    "interdits": [
      "Ne pas débuter immédiatement une insulinothérapie sans évaluation",
      "Ne pas négliger la recherche de complications"
    ],
    "materiel": [
      "Stéthoscope",
      "Tensiomètre",
      "Bandelette urinaire",
      "Lecteur glycémie",
      "Balance / Toise"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Inquiète mais coopérative, a peur d'avoir la même maladie que sa mère.",
    "phraseOuverture": "Bonjour docteur, je viens parce que je suis épuisée depuis plusieurs mois et j'ai tout le temps soif. Mon médecin m'a dit de faire un bilan complet.",
    "pointCle": "Reconnaître le syndrome polyuropolydipsique, prescrire une glycémie veineuse de confirmation et initier les mesures hygiéno-diététiques.",
    "erreurs": [
      "Confirmer le diagnostic uniquement sur bandelette",
      "Omettre le dépistage des complications chroniques"
    ],
    "elements": [
      "Interrogatoire sur la polyurie/polydipsie",
      "Calcul IMC et tour de taille",
      "Prescription glycémie veineuse à jeun et HbA1c",
      "Conseils nutritionnels et activité physique"
    ]
  },
  "EDN_Anorexie_1.json": {
    "spec": "endocrinologie",
    "newFile": "endo_baisse_energie_et_troubles_digestifs_m_legrand.json",
    "motif": "Baisse d'énergie et troubles digestifs",
    "prenom": "Théo",
    "nom": "Legrand",
    "age": 26,
    "sexe": "M",
    "itemR2C": "Item 70. Troubles du comportement alimentaire de l'enfant et de l'adulte.",
    "role": "Vous êtes interne en médecine générale.",
    "contexte": "Vous recevez Théo Legrand, 26 ans, venu consulter sur l'insistance de ses proches pour une asthénie majeure et des ballonnements persistants.",
    "consignes": [
      "Conduire un interrogatoire complet sur les habitudes alimentaires et les variations pondérales",
      "Évaluer le retentissement somatique et psychologique",
      "Réaliser un examen clinique complet avec recherche de signes de dénutrition",
      "Prescrire le bilan biologique de retentissement",
      "Établir une relation d'alliance thérapeutique sans confrontation brutale"
    ],
    "interdits": [
      "Ne pas banaliser un IMC effondré",
      "Ne pas prescrire de laxatifs ou de stimulants"
    ],
    "materiel": [
      "Tensiomètre",
      "Stéthoscope",
      "Balance",
      "Toise",
      "ECG"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Réservé, sur la défensive, rationalise sa minceur par une recherche de performance sportive.",
    "phraseOuverture": "Bonjour docteur, je viens parce que mes proches s'inquiètent pour rien. Je me sens juste un peu fatigué et ballonné après les repas.",
    "pointCle": "Identifier les critères cliniques de restriction alimentaire sévère, évaluer la sévérité somatique et nouer une alliance de soins.",
    "erreurs": [
      "Rassurer à tort sans peser le patient",
      "Ne pas rechercher les signes de gravité imposant l'hospitalisation"
    ],
    "elements": [
      "Calcul de l'IMC et cinétique de perte pondérale",
      "Recherche d'hypotension orthostatique et bradycardie",
      "Prescription ionogramme, glycémie, ECG",
      "Contrat de soin progressif"
    ]
  },
  "EDN_Anorexie_2.json": {
    "spec": "endocrinologie",
    "newFile": "endo_perte_de_poids_adolescente_alice.json",
    "motif": "Perte de poids et aménorrhée chez une adolescente",
    "prenom": "Alice",
    "nom": "Hanouna",
    "age": 14,
    "sexe": "F",
    "itemR2C": "Item 70. Troubles du comportement alimentaire de l'enfant et de l'adulte.",
    "role": "Vous êtes pédiatre en consultation hospitalière.",
    "contexte": "Vous recevez Alice, 14 ans, accompagnée de sa mère qui s'alarme d'un amaigrissement important et de l'arrêt des règles depuis 4 mois.",
    "consignes": [
      "Réaliser un interrogatoire bienveillant en recevant l'adolescente avec et sans sa mère",
      "Retracer la courbe de croissance staturo-pondérale dans le carnet de santé",
      "Évaluer les signes cliniques de dénutrition aiguë et les critères d'hospitalisation",
      "Proposer un bilan biologique et paraclinique de première intention",
      "Expliquer les modalités d'une prise en charge pluridisciplinaire"
    ],
    "interdits": [
      "Ne pas forcer un gavage immédiat sans surveillance",
      "Ne pas culpabiliser l'adolescente ou les parents"
    ],
    "materiel": [
      "Balance médicale",
      "Toise murale",
      "Tensiomètre pédiatrique",
      "Stéthoscope",
      "Thermomètre"
    ],
    "lieu": "Box de consultation pédiatrique",
    "personnalite": "Anxieuse, perfectionniste, minimise l'amaigrissement et affirme se trouver encore 'trop grosse'.",
    "phraseOuverture": "Bonjour docteur, ma mère m'a obligée à venir. Moi je me sens très bien, j'ai juste adapté mon alimentation pour être en forme.",
    "pointCle": "Repérer les signes de restriction cognitive chez l'adolescente, tracer la rupture de corpulence et identifier les critères d'admission hospitalière.",
    "erreurs": [
      "Omettre le tracé de la courbe IMC sur le carnet de santé",
      "Négliger le risque de syndrome de renutrition"
    ],
    "elements": [
      "Tracé des courbes de croissance et calcul du z-score IMC",
      "Examen clinique complet avec recherche de lanugo et bradycardie",
      "Recherche de critères d'hospitalisation",
      "Prise en charge conjointe somatique et pédopsychiatrique"
    ]
  },
  "EDN_boulimie_1.json": {
    "spec": "endocrinologie",
    "newFile": "endo_crises_alimentaires_incontrolables_mlle_martin.json",
    "motif": "Crises alimentaires impulsives et culpabilité",
    "prenom": "Chloé",
    "nom": "Martin",
    "age": 19,
    "sexe": "F",
    "itemR2C": "Item 70. Troubles du comportement alimentaire de l'enfant et de l'adulte.",
    "role": "Vous êtes interne en médecine générale.",
    "contexte": "Vous recevez Chloé Martin, étudiante de 19 ans, qui consulte spontanément en détresse pour des épisodes de frénésie alimentaire incontrôlables.",
    "consignes": [
      "Conduire un entretien empathique et déculpabilisant sur le déroulement des crises",
      "Rechercher les comportements compensatoires inappropriés",
      "Rechercher les complications somatiques (dentaires, métaboliques, œsophagiennes)",
      "Évaluer le risque suicidaire et les comorbidités anxio-dépressives",
      "Présenter les perspectives thérapeutiques adaptées (psychothérapie TCC, suivi somatique)"
    ],
    "interdits": [
      "Ne pas banaliser la souffrance",
      "Ne pas prescrire de coupe-faim"
    ],
    "materiel": [
      "Tensiomètre",
      "Stéthoscope",
      "Abaisse-langue",
      "Ordonnancier"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Honteuse, émotive, pleure en évoquant les crises, exprime une grande culpabilité.",
    "phraseOuverture": "Bonjour docteur... j'ai vraiment honte d'être là, mais je n'en peux plus. J'ai des crises où j'engloutis tout ce qu'il y a dans le frigo sans pouvoir m'arrêter.",
    "pointCle": "Caractériser les accès boulimiques avec comportements compensatoires, dépister l'hypokaliémie secondaire aux vomissements et orienter vers une prise en charge globale.",
    "erreurs": [
      "Omettre le dosage des électrolytes sanguins",
      "Porter un jugement moral"
    ],
    "elements": [
      "Caractérisation des crises",
      "Prescription ionogramme sanguin en urgence",
      "Examen buccodentaire et des parotides",
      "Information sur la TCC et le réseau spécialisé"
    ]
  },
  "EDN_ARFID_1.json": {
    "spec": "endocrinologie",
    "newFile": "endo_restriction_alimentaire_severe_emma.json",
    "motif": "Restriction alimentaire sévère sans distorsion corporelle",
    "prenom": "Emma",
    "nom": "Leroy",
    "age": 14,
    "sexe": "F",
    "itemR2C": "Item 70. Troubles du comportement alimentaire de l'enfant et de l'adulte.",
    "role": "Vous êtes pédiatre hospitalier.",
    "contexte": "Vous recevez Emma, 14 ans, adressée par son médecin pour une limitation drastique du panel alimentaire entraînant un fléchissement staturo-pondéral.",
    "consignes": [
      "Distinguer l'évitement alimentaire sensoriel/phobique d'une préoccupation de minceur",
      "Explorer les caractéristiques sensorielles des aliments rejetés (textures, odeurs, couleurs)",
      "Rechercher un événement déclenchant traumatique (fausse route, étouffement)",
      "Évaluer l'état nutritionnel et les carences en micronutriments",
      "Proposer un plan de désensibilisation alimentaire progressive"
    ],
    "interdits": [
      "Ne pas forcer l'ingestion d'aliments anxiogènes sous la contrainte",
      "Ne pas poser de diagnostic erroné sans vérifier l'absence de dysmorphophobie"
    ],
    "materiel": [
      "Toise",
      "Balance",
      "Carnet de santé",
      "Tensiomètre"
    ],
    "lieu": "Cabinet de consultation pédiatrique",
    "personnalite": "Timide, anxieuse face à la nouveauté alimentaire, ne cherche pas à maigrir mais a peur de s'étouffer.",
    "phraseOuverture": "Bonjour... je viens parce que mes parents s'inquiètent. Je ne mange que certaines pâtes et du pain, le reste me dégoûte ou me fait peur.",
    "pointCle": "Poser le diagnostic d'ARFID, éliminer une préoccupation de minceur et réhabiliter la sensorialité.",
    "erreurs": [
      "Confondre avec une anorexie mentale classique",
      "Méconnaître des carences vitaminiques profondes"
    ],
    "elements": [
      "Absence de préoccupation corporelle",
      "Bilan biologique nutritionnel (fer, folates, B12, zinc)",
      "Prise en charge orthophonique sensorielle",
      "Suivi régulier du poids"
    ]
  },
  "EDN_hyperphagie_1.json": {
    "spec": "endocrinologie",
    "newFile": "endo_acces_hyperphagiques_sans_purge_m_lucas.json",
    "motif": "Prise de poids rapide et épisodes compulsifs",
    "prenom": "Lucas",
    "nom": "Dupont",
    "age": 22,
    "sexe": "M",
    "itemR2C": "Item 70. Troubles du comportement alimentaire de l'enfant et de l'adulte.",
    "role": "Vous êtes interne en médecine générale.",
    "contexte": "Vous recevez Lucas Dupont, 22 ans, qui consulte pour une prise de 15 kg en un an et des fringales incontrôlables sans vomissements.",
    "consignes": [
      "Caractériser les accès hyperphagiques récurrents (quantité, rapidité, solitude)",
      "Vérifier l'absence de comportements compensatoires récurrents",
      "Dépister les comorbidités métaboliques et respiratoires de l'obésité",
      "Évaluer la détresse psychologique et l'estime de soi",
      "Construire un projet d'accompagnement comportemental sans régime restrictif sévère"
    ],
    "interdits": [
      "Ne pas prescrire de régime hypocalorique drastique",
      "Ne pas culpabiliser le patient sur son poids"
    ],
    "materiel": [
      "Balance",
      "Toise",
      "Mètre ruban",
      "Tensiomètre"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Désemparé, honteux de son corps, se réfugie dans la nourriture lors des périodes d'isolement.",
    "phraseOuverture": "Bonjour docteur, je suis venu parce que j'ai pris beaucoup de poids ces derniers temps et je n'arrive pas à contrôler ce que je mange le soir...",
    "pointCle": "Identifier l'hyperphagie boulimique sans purge, évaluer les complications métaboliques et orienter vers une psychothérapie adaptée.",
    "erreurs": [
      "Prescrire un régime restrictif aggravant le craving",
      "Omettre le dépistage du syndrome métabolique"
    ],
    "elements": [
      "Critères diagnostiques de l'hyperphagie boulimique",
      "Bilan lipidique et glycémie à jeun",
      "Explication du cercle vicieux restriction-compulsion",
      "Orientation vers un psychologue spécialisé"
    ]
  },
  "EDN_Merycisme_1.json": {
    "spec": "endocrinologie",
    "newFile": "endo_remontees_alimentaires_postprandiales_clara.json",
    "motif": "Régurgitations alimentaires répétées après les repas",
    "prenom": "Clara",
    "nom": "Martin",
    "age": 19,
    "sexe": "F",
    "itemR2C": "Item 70. Troubles du comportement alimentaire de l'enfant et de l'adulte.",
    "role": "Vous êtes interne en hépato-gastroentérologie.",
    "contexte": "Vous recevez Clara Martin, 19 ans, adressée pour des régurgitations postprandiales indolores quotidiennes évoluant depuis 6 mois.",
    "consignes": [
      "Préciser la sémiologie des régurgitations (remontée sans effort de vomissement, remastication)",
      "Différencier le trouble du reflux gastro-œsophagien et du mégaœsophage",
      "Rechercher un retentissement sur le poids et l'état bucco-dentaire",
      "Éliminer une cause organique par les examens appropriés si nécessaire",
      "Expliquer le mécanisme du trouble et initier la rééducation par respiration diaphragmatique"
    ],
    "interdits": [
      "Ne pas conclure d'emblée à un simple RGO résistant",
      "Ne pas banaliser l'impact dentaire"
    ],
    "materiel": [
      "Stéthoscope",
      "Abaisse-langue",
      "Tensiomètre"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Gênée par le sujet, craint d'être jugée dégoûtante.",
    "phraseOuverture": "Bonjour docteur, c'est un peu embarrassant... après chaque repas, la nourriture remonte toute seule dans ma bouche, sans que j'aie la nausée, et je la remâche souvent.",
    "pointCle": "Reconnaître le mérycisme, éliminer les causes œsophagiennes organiques et enseigner la respiration abdominale postprandiale.",
    "erreurs": [
      "Escalade inutile des doses d'IPP sans réévaluation",
      "Négliger l'examen dentaire"
    ],
    "elements": [
      "Caractérisation de la régurgitation sans nausée",
      "Examen des dents et de la muqueuse buccale",
      "Respiration diaphragmatique postprandiale",
      "Rassurance de la patiente"
    ]
  },
  "EDN_PICA_1.json": {
    "spec": "endocrinologie",
    "newFile": "endo_ingestion_substances_non_alimentaires_lucas.json",
    "motif": "Ingestion répétée de substances non nutritives",
    "prenom": "Lucas",
    "nom": "Lemarchand",
    "age": 8,
    "sexe": "M",
    "itemR2C": "Item 70. Troubles du comportement alimentaire. Item 274. Anémie.",
    "role": "Vous êtes interne en pédiatrie.",
    "contexte": "Vous recevez Lucas, 8 ans, amené par ses parents qui découvrent qu'il ingère de la craie, de la terre et des morceaux de plâtre depuis plusieurs semaines.",
    "consignes": [
      "Caractériser les substances ingérées et la fréquence des épisodes",
      "Dépister une carence martiale profonde ou un saturnisme associé",
      "Rechercher des complications digestives (occlusion, bézoard, parasitose)",
      "Évaluer le développement neuro-développemental de l'enfant",
      "Prescrire le bilan biologique approprié et rassurer les parents"
    ],
    "interdits": [
      "Ne pas punir l'enfant sans bilan étiologique",
      "Ne pas omettre le dosage du fer et du plomb"
    ],
    "materiel": [
      "Stéthoscope",
      "Tensiomètre pédiatrique",
      "Toise",
      "Balance"
    ],
    "lieu": "Box de consultation pédiatrique",
    "personnalite": "Enfant calme mais pâle, parents très inquiets et culpabilisés.",
    "phraseOuverture": "Bonjour docteur, nous venons parce que nous avons surpris Lucas en train de gratter et manger le plâtre du mur et la terre des pots de fleurs...",
    "pointCle": "Identifier un comportement de pica révélateur d'une anémie ferriprive sévère, dépister une intoxication saturnine et prévenir le bézoard occlusif.",
    "erreurs": [
      "Omettre le dosage de la plombémie dans un habitat ancien",
      "Négliger la recherche d'occlusion digestive"
    ],
    "elements": [
      "NFS, ferritinémie, plombémie en urgence",
      "Examen abdominal recherchant une masse",
      "Recherche de pâleur conjonctivale",
      "Supplémentation martiale"
    ]
  },
  "EDN_diabetetype2_2.json": {
    "spec": "endocrinologie",
    "newFile": "endo_somnolence_postprandiale_et_surpoids_m_moreau.json",
    "motif": "Somnolence postprandiale et découverte d'anomalies biologiques",
    "prenom": "Alain",
    "nom": "Moreau",
    "age": 56,
    "sexe": "M",
    "itemR2C": "Item 247. Diabète sucré de types 1 et 2. Item 222. Risque cardiovasculaire.",
    "role": "Vous êtes interne en médecine générale.",
    "contexte": "Vous recevez M. Alain Moreau, 56 ans, chauffeur routier, adressé suite à une visite médicale ayant révélé une anomalie glycémique.",
    "consignes": [
      "Mener un interrogatoire sur les signes de dysmétabolisme et l'hygiène de vie professionnelle",
      "Dépister un syndrome d'apnées du sommeil associé (somnolence diurne)",
      "Évaluer le risque cardiovasculaire global et les complications micro/macrovasculaires",
      "Prescrire le bilan biologique standardisé de confirmation et de retentissement",
      "Aborder l'aptitude à la conduite professionnelle avec tact et rigueur"
    ],
    "interdits": [
      "Ne pas délivrer une inaptitude brutale sans bilan",
      "Ne pas prescrire de sulfamide hypoglycémiant sans consignes"
    ],
    "materiel": [
      "Tensiomètre",
      "Stéthoscope",
      "Lecteur glycémie",
      "Monofilament",
      "Mètre ruban"
    ],
    "lieu": "Cabinet médical",
    "personnalite": "Bon vivant, craint pour son permis de conduire et minimise ses symptômes.",
    "phraseOuverture": "Bonjour docteur, le médecin du travail m'envoie vous voir parce qu'il a trouvé du sucre dans mes urines. Moi je me sens bien, juste un peu somnolent après le déjeuner.",
    "pointCle": "Poser le diagnostic de diabète de type 2 dans le cadre d'un syndrome métabolique, évaluer le SAOS associé et sécuriser l'activité professionnelle.",
    "erreurs": [
      "Méconnaître le syndrome d'apnées du sommeil chez le chauffeur routier",
      "Omettre l'examen des pieds au monofilament"
    ],
    "elements": [
      "Prescription glycémie à jeun et HbA1c",
      "Échelle d'Epworth et polygraphie",
      "Examen neurologique des pieds",
      "Règles hygiéno-diététiques adaptées"
    ]
  },
  "EDN_denutrition-hyper_1.json": {
    "spec": "endocrinologie",
    "newFile": "endo_amaigrissement_involontaire_et_fievre_m_girard.json",
    "motif": "Amaigrissement involontaire rapide et sueurs",
    "prenom": "Paul",
    "nom": "Girard",
    "age": 67,
    "sexe": "M",
    "itemR2C": "Item 252. Dénutrition chez l'adulte et l'enfant.",
    "role": "Vous êtes interne en médecine interne.",
    "contexte": "Vous recevez M. Paul Girard, 67 ans, adressé pour une perte de 9 kg en 2 mois dans un contexte d'asthénie et de fébricule vespérale.",
    "consignes": [
      "Quantifier précisément la perte de poids et sa cinétique",
      "Rechercher les signes d'orientation étiologique (néoplasique, infectieux, inflammatoire)",
      "Évaluer la sévérité de la dénutrition selon les critères HAS",
      "Prescrire les examens complémentaires de première ligne",
      "Initier une prise en charge nutritionnelle orale précoce"
    ],
    "interdits": [
      "Ne pas attendre le bilan étiologique pour débuter le support nutritionnel",
      "Ne pas prescrire de compléments sans évaluation des apports"
    ],
    "materiel": [
      "Balance",
      "Toise",
      "Tensiomètre",
      "Stéthoscope",
      "Thermomètre"
    ],
    "lieu": "Box de consultation hospitalière",
    "personnalite": "Fatigué, abattu, inquiet de la fonte musculaire rapide.",
    "phraseOuverture": "Bonjour docteur, je flotte dans tous mes pantalons. J'ai perdu près de 10 kilos sans faire aucun régime et je n'ai plus d'appétit.",
    "pointCle": "Poser le diagnostic de dénutrition sévère, organiser le bilan étiologique urgent d'une altération de l'état général et débuter la renutrition.",
    "erreurs": [
      "Omettre le calcul du pourcentage de perte pondérale",
      "Négliger la prescription d'une imagerie thoracique"
    ],
    "elements": [
      "Calcul du pourcentage de perte de poids",
      "Palpation des aires ganglionnaires",
      "Prescription scanner thoraco-abdomino-pelvien",
      "Compléments nutritionnels oraux"
    ]
  },
  "EDN_Denutrition-obesite_1.json": {
    "spec": "endocrinologie",
    "newFile": "endo_faiblesse_musculaire_et_chutes_mme_roux.json",
    "motif": "Faiblesse musculaire et perte d'autonomie chez une patiente âgée",
    "prenom": "Monique",
    "nom": "Roux",
    "age": 78,
    "sexe": "F",
    "itemR2C": "Item 252. Dénutrition chez l'adulte et l'enfant. Item 131. Chute chez le sujet âgé.",
    "role": "Vous êtes gériatre en consultation.",
    "contexte": "Vous recevez Mme Monique Roux, 78 ans, présentant une faiblesse musculaire avec chutes répétées et perte d'autonomie récente.",
    "consignes": [
      "Dépister la dénutrition protéique masquée par l'obésité (obésité sarcopénique)",
      "Évaluer la force musculaire et le risque de chute (vitesse de marche, appui monopodal)",
      "Analyser l'enquête alimentaire et les facteurs d'anorexie du sujet âgé (solitude, état bucco-dentaire)",
      "Doser l'albuminémie et la CRP pour évaluer le statut nutritionnel",
      "Prescrire une réhabilitation physique et un enrichissement nutritionnel adapté"
    ],
    "interdits": [
      "Ne pas prescrire de régime amaigrissant restrictif",
      "Ne pas écarter la dénutrition sous prétexte d'un IMC élevé"
    ],
    "materiel": [
      "Dynamomètre de préhension",
      "Tensiomètre",
      "Stéthoscope",
      "Chronomètre"
    ],
    "lieu": "Cabinet de consultation gériatrique",
    "personnalite": "Ralentie, vit seule depuis le décès de son époux, ne cuisine plus.",
    "phraseOuverture": "Bonjour docteur, mes jambes ne me portent plus bien. Je suis tombée deux fois cette semaine en voulant me lever de mon fauteuil.",
    "pointCle": "Reconnaître une dénutrition sévère sur obésité sarcopénique chez la personne âgée et proscrire tout régime restrictif.",
    "erreurs": [
      "Valider la perte de poids chez une personne âgée fragile",
      "Négliger l'évaluation de la force musculaire"
    ],
    "elements": [
      "Diagnostic d'obésité sarcopénique",
      "Dosage albuminémie et transthyrétinémie",
      "Examen bucco-dentaire",
      "Prescription d'enrichissement alimentaire et kinésithérapie"
    ]
  },
  "EDN_diabetetype1.json": {
    "spec": "endocrinologie",
    "newFile": "endo_amaigrissement_rapide_et_odeur_acetone_mlle_garcia.json",
    "motif": "Amaigrissement rapide, soif intense et douleurs abdominales",
    "prenom": "Léa",
    "nom": "Garcia",
    "age": 21,
    "sexe": "F",
    "itemR2C": "Item 247. Diabète sucré de types 1 et 2. Item 344. Acidocétose.",
    "role": "Vous êtes interne aux urgences médicales.",
    "contexte": "Vous recevez Léa Garcia, 21 ans, étudiante, amenée pour altération aiguë de l'état général avec amaigrissement de 7 kg en 3 semaines, soif intense et nausées.",
    "consignes": [
      "Rechercher en urgence les signes de décompensation acidocétosique (Kussmaul, haleine cétonique, déshydratation)",
      "Réaliser immédiatement une glycémie capillaire et une recherche de cétonémie / cétonurie",
      "Évaluer les constantes vitales et les signes de gravité hémodynamique",
      "Prescrire le bilan d'urgence (gaz du sang, ionogramme, réserve alcaline, ECG)",
      "Mettre en route sans délai le protocole d'urgence (réhydratation saline et insulinothérapie IVSE)"
    ],
    "interdits": [
      "Ne pas administrer d'insuline en bolus sans apport potassique adéquat",
      "Ne pas renvoyer la patiente à domicile"
    ],
    "materiel": [
      "Lecteur glycémie / cétonémie capillaire",
      "Bandelettes urinaires",
      "Scope multiparamétrique",
      "ECG 12D",
      "Abord veineux"
    ],
    "lieu": "Salle d'accueil des urgences vitales (SAUV)",
    "personnalite": "Fatiguée, polypnéique, répond lentement mais reste orientée, très soif.",
    "phraseOuverture": "Bonjour docteur... je me sens très mal. J'ai tout le temps soif, j'ai perdu 7 kilos en 3 semaines et j'ai mal au ventre depuis ce matin.",
    "pointCle": "Diagnostiquer l'inauguration d'un diabète en acidocétose inaugurale, urgence thérapeutique vitale nécessitant réhydratation hydroélectrolytique et insulinothérapie IV.",
    "erreurs": [
      "Prendre les douleurs abdominales pour une urgence chirurgicale sans glycémie",
      "Omettre la surveillance continue de la kaliémie"
    ],
    "elements": [
      "Glycémie capillaire immédiate (> 3 g/L) et cétonémie (> 3 mmol/L)",
      "Gaz du sang montrant une acidose métabolique",
      "Pose voie veineuse et perfusion de NaCl 0.9%",
      "Insulinothérapie intraveineuse et soins continus"
    ]
  },
  "EDN_diabetetype1monoge.json": {
    "spec": "endocrinologie",
    "newFile": "endo_hyperglycemie_familiale_sujet_jeune_m_bernard.json",
    "motif": "Découverte fortuite d'une hyperglycémie modérée chez un adulte jeune",
    "prenom": "Julien",
    "nom": "Bernard",
    "age": 24,
    "sexe": "M",
    "itemR2C": "Item 247. Diabète sucré de types 1 et 2.",
    "role": "Vous êtes interne en endocrinologie.",
    "contexte": "Vous recevez Julien Bernard, 24 ans, sportif, sans surpoids, adressé pour une anomalie glycémique modérée découverte lors d'une visite d'embauche.",
    "consignes": [
      "Conduire un interrogatoire généalogique minutieux sur 3 générations (arbre généalogique)",
      "Rechercher l'absence de syndrome cardinal franc et l'absence de surpoids",
      "Évoquer un diabète monogénique et justifier les examens immunologiques et génétiques",
      "Prescrire le dosage des auto-anticorps et le peptide C",
      "Expliquer l'intérêt pronostique et thérapeutique de l'enquête génétique"
    ],
    "interdits": [
      "Ne pas étiqueter automatiquement le patient sans dosage des auto-anticorps",
      "Ne pas prescrire d'emblée une multi-insulinothérapie lourde"
    ],
    "materiel": [
      "Tensiomètre",
      "Stéthoscope",
      "Toise",
      "Balance",
      "Arbre généalogique papier"
    ],
    "lieu": "Cabinet de consultation spécialisée",
    "personnalite": "Rassuré par sa bonne forme physique mais intrigué par les antécédents familiaux.",
    "phraseOuverture": "Bonjour docteur, je viens pour ma prise de sang d'embauche. Mon taux de sucre est un peu haut à 1,35 g/L, pourtant je cours des marathons et je ne mange pas de sucre.",
    "pointCle": "Évoquer un diabète monogénique MODY devant une anomalie glycémique chez un sujet jeune sans surpoids avec transmission autosomique dominante.",
    "erreurs": [
      "Poser à tort le diagnostic de DT1 et démarrer de l'insuline sans explorer les anticorps",
      "Négliger la transmission autosomique dominante"
    ],
    "elements": [
      "Construction de l'arbre généalogique sur 3 générations",
      "Dosage anticorps anti-GAD/anti-IA2 et peptide C",
      "Consultation de génétique médicale",
      "Information sur la sensibilité aux sulfamides"
    ]
  },
  "EDN_Obesite_1.json": {
    "spec": "endocrinologie",
    "newFile": "endo_prise_de_poids_progressive_mme_michel.json",
    "motif": "Prise de poids progressive et essoufflement à l'effort",
    "prenom": "Nathalie",
    "nom": "Michel",
    "age": 44,
    "sexe": "F",
    "itemR2C": "Item 253. Obésité de l'adulte et de l'enfant.",
    "role": "Vous êtes interne en médecine générale.",
    "contexte": "Vous recevez Mme Nathalie Michel, 44 ans, qui consulte pour une prise de poids continue depuis 5 ans avec dyspnée d'effort croissante.",
    "consignes": [
      "Conduire une anamnèse pondérale chronologique (poids maximal, minimal, déclencheurs)",
      "Calculer l'IMC et mesurer le tour de taille",
      "Dépister les complications métaboliques, articulaires, respiratoires et hépatiques",
      "Évaluer les troubles du comportement alimentaire et les facteurs psychologiques",
      "Construire avec la patiente des objectifs personnalisés et gradués d'activité physique et d'alimentation"
    ],
    "interdits": [
      "Ne pas culpabiliser la patiente ou tenir des propos stigmatisants",
      "Ne pas proposer de chirurgie bariatrique sans démarche médicale préalable"
    ],
    "materiel": [
      "Pèse-personne adapté",
      "Toise",
      "Mètre ruban",
      "Tensiomètre avec brassard large"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Dévalorisée, a enchaîné de multiples régimes yo-yo par le passé, en attente d'aide bienveillante.",
    "phraseOuverture": "Bonjour docteur, je viens vous voir car je n'arrive plus à monter mes deux étages sans être essoufflée. J'ai pris 25 kg depuis mon dernier accouchement.",
    "pointCle": "Poser le diagnostic d'obésité de classe 2, identifier le cercle vicieux des régimes restrictifs, évaluer le retentissement somatique et proposer un suivi pluridisciplinaire.",
    "erreurs": [
      "Prescrire un nouveau régime hypocalorique déséquilibré",
      "Omettre de mesurer le tour de taille"
    ],
    "elements": [
      "Calcul IMC et tour de taille",
      "Recherche de complications (HTA, apnées, gonarthrose)",
      "Bilan biologique complet",
      "Orientation diététique bienveillante"
    ]
  },
  "EDN_VIH.json": {
    "spec": "endocrinologie",
    "newFile": "infectio_fievre_alteration_etat_general_m_andre.json",
    "motif": "Fièvre prolongée, sueurs nocturnes et adénopathies",
    "prenom": "Julien",
    "nom": "André",
    "age": 34,
    "sexe": "M",
    "itemR2C": "Item 168. Infections à VIH.",
    "role": "Vous êtes interne en maladies infectieuses.",
    "contexte": "Vous recevez M. Julien André, 34 ans, adressé pour une fébricule évoluant depuis 6 semaines avec sueurs nocturnes, perte de 5 kg et polyadénopathies.",
    "consignes": [
      "Conduire un interrogatoire rigoureux sur les facteurs d'exposition aux IST avec tact et confidentialité",
      "Réaliser un examen clinique complet avec palpation des aires ganglionnaires et examen cutanéo-muqueux",
      "Évoquer une infection virale et proposer le dépistage sérologique approprié",
      "Expliquer avec pédagogie les modalités du test de dépistage combiné",
      "Délivrer une information claire et rassurante sur l'efficacité des traitements antirétroviraux actuels"
    ],
    "interdits": [
      "Ne pas réaliser de test sérologique sans le consentement éclairé du patient",
      "Ne pas porter de jugement moral sur la vie privée"
    ],
    "materiel": [
      "Stéthoscope",
      "Tensiomètre",
      "Thermomètre",
      "Abaisse-langue"
    ],
    "lieu": "Box de consultation hospitalière",
    "personnalite": "Anxieux, craint une maladie grave, gêné d'aborder sa vie intime.",
    "phraseOuverture": "Bonjour docteur, je suis inquiet. J'ai de la fièvre presque tous les soirs depuis un mois et demi, des sueurs, et j'ai des ganglions dans le cou qui ne partent pas.",
    "pointCle": "Identifier le tableau clinique fébrile avec adénopathies, obtenir le consentement pour le test ELISA combiné et dédramatiser grâce aux thérapies actuelles.",
    "erreurs": [
      "Omettre de proposer la sérologie adaptée devant des adénopathies fébriles",
      "Omettre le dépistage des autres IST associées"
    ],
    "elements": [
      "Consentement éclairé pour le test ELISA 4G",
      "Prescription sérologies associées (hépatites, syphilis)",
      "Examen oropharyngé complet",
      "Information sur l'efficacité des trithérapies"
    ]
  },
  "digestif_cancer_oeso_brandon.json": {
    "spec": "appareil-digestif",
    "newFile": "digestif_dysphagie_progressive_m_brandon.json",
    "motif": "Difficulté progressive à avaler les aliments solides",
    "prenom": "Marc",
    "nom": "Brandon",
    "age": 62,
    "sexe": "M",
    "itemR2C": "Item 308. Tumeurs de l'œsophage. Item 273. Dysphagie.",
    "role": "Vous êtes interne en hépato-gastroentérologie.",
    "contexte": "Vous recevez M. Marc Brandon, 62 ans, adressé pour une sensation d'accrochage alimentaire survenant lors de l'ingestion des solides depuis 2 mois.",
    "consignes": [
      "Caractériser la dysphagie (siège, sélectivité, caractère continu et progressif)",
      "Rechercher les facteurs d'intoxication alcoolo-tabagique et signes de dénutrition",
      "Réaliser un examen clinique complet avec palpation des aires ganglionnaires (Troisier)",
      "Indiquer et justifier l'endoscopie œso-gastro-duodénale avec biopsies comme examen clé",
      "Donner les premiers conseils d'adaptation texturale de l'alimentation"
    ],
    "interdits": [
      "Ne pas prescrire de scanner thoracique sans endoscopie première",
      "Ne pas minimiser l'accrochage alimentaire"
    ],
    "materiel": [
      "Stéthoscope",
      "Tensiomètre",
      "Abaisse-langue"
    ],
    "lieu": "Cabinet de consultation hospitalière",
    "personnalite": "Minimise ses symptômes, attribue la gêne à un manque de mastication.",
    "phraseOuverture": "Bonjour docteur, depuis deux mois, la viande et le pain restent bloqués quand j'avale, je dois boire beaucoup d'eau pour que ça passe.",
    "pointCle": "Identifier une dysphagie organique progressive chez un fumeur/buveur, prescrire une EOGD avec biopsies en première intention et bilan nutritionnel.",
    "erreurs": [
      "Traiter comme un simple RGO par IPP",
      "Omettre la recherche du ganglion de Troisier"
    ],
    "elements": [
      "Caractérisation de la dysphagie organique aux solides",
      "Recherche ganglion sus-claviculaire gauche",
      "Prescription EOGD avec biopsies multiples",
      "Évaluation nutritionnelle"
    ]
  },
  "digestif_dyspepsie_elinor.json": {
    "spec": "appareil-digestif",
    "newFile": "digestif_pesanteur_postprandiale_mme_elinor.json",
    "motif": "Pesanteur et brûlure de l'estomac après les repas",
    "prenom": "Elinor",
    "nom": "Dammert",
    "age": 34,
    "sexe": "F",
    "itemR2C": "Item 271. Douleur abdominale chez l'adulte. Item 272. Dyspepsie.",
    "role": "Vous êtes interne en médecine générale.",
    "contexte": "Vous recevez Mme Elinor Dammert, 34 ans, consultant pour une gêne épigastrique postprandiale récurrente depuis 3 mois.",
    "consignes": [
      "Analyser la chronologie des douleurs et leur relation avec l'alimentation",
      "Rechercher les signaux d'alarme (amaigrissement, anémie, dysphagie, âge > 50 ans)",
      "Rechercher la prise d'AINS ou d'aspirine et le tabagisme",
      "Proposer la stratégie diagnostique non invasive appropriée",
      "Prescrire le traitement symptomatique de première intention et les conseils hygiéno-diététiques"
    ],
    "interdits": [
      "Ne pas prescrire d'emblée une endoscopie systématique sans signe d'alarme",
      "Ne pas méconnaître l'automédication"
    ],
    "materiel": [
      "Stéthoscope",
      "Tensiomètre"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Anxieuse, très investie dans son travail, boit beaucoup de café.",
    "phraseOuverture": "Bonjour docteur, j'ai tout le temps l'estomac lourd et des brûlures après avoir déjeuné. Ça me réveille parfois en début de nuit.",
    "pointCle": "Poser le diagnostic de dyspepsie non compliquée sans signe d'alarme, arrêter les AINS, tester/traiter Helicobacter pylori ou IPP.",
    "erreurs": [
      "Maintenir l'ibuprofène",
      "Prescrire une endoscopie inutile chez une jeune femme sans alarme"
    ],
    "elements": [
      "Caractérisation du syndrome dyspeptique",
      "Absence de signes d'alarme justifiant l'abstention d'EOGD",
      "Arrêt immédiat des AINS",
      "Recherche non invasive d'H. pylori ou IPP 4 semaines"
    ]
  },
  "digestif_cancer_gastrique_Jiro.json": {
    "spec": "appareil-digestif",
    "newFile": "digestif_douleur_epigastrique_avec_anemie_m_jiro.json",
    "motif": "Douleur épigastrique tenace et fatigue avec pâleur",
    "prenom": "Jiro",
    "nom": "Tanaka",
    "age": 68,
    "sexe": "M",
    "itemR2C": "Item 309. Tumeurs de l'estomac. Item 274. Anémie.",
    "role": "Vous êtes interne en médecine interne.",
    "contexte": "Vous recevez M. Jiro Tanaka, 68 ans, adressé pour une anémie microcytaire découverte lors d'un bilan d'asthénie et de douleurs gastriques.",
    "consignes": [
      "Conduire un interrogatoire complet sur les antécédents et les signes digestifs hauts",
      "Dépister un syndrome anémique clinique (pâleur, tachycardie, asthénie d'effort)",
      "Réaliser un examen abdominal et ganglionnaire complet (masse épigastrique, Troisier)",
      "Prescrire l'endoscopie œso-gastro-duodénale avec biopsies gastriques multiples",
      "Évaluer l'urgence d'une transfusion selon la tolérance hémodynamique"
    ],
    "interdits": [
      "Ne pas traiter une anémie ferriprive chez l'homme âgé par du fer seul sans exploration",
      "Ne pas retarder l'endoscopie"
    ],
    "materiel": [
      "Stéthoscope",
      "Tensiomètre",
      "Thermomètre"
    ],
    "lieu": "Box de consultation",
    "personnalite": "Poli, réservé, discret sur sa douleur, habitué à tolérer l'inconfort.",
    "phraseOuverture": "Bonjour docteur, je viens parce que je suis essoufflé au moindre pas depuis un mois, et j'ai une pesanteur dans le ventre qui ne passe plus.",
    "pointCle": "Évoquer une lésion gastrique maligne compliquée d'anémie ferriprive chez un homme âgé, prescrire l'EOGD avec biopsies et le bilan de stadification.",
    "erreurs": [
      "Négliger le toucher rectal recherchant un méléna",
      "Se contenter d'un traitement antisécrétoire d'épreuve"
    ],
    "elements": [
      "Recherche des signes de gravité de l'anémie",
      "Examen clinique complet avec recherche de Troisier",
      "Prescription EOGD avec au moins 8 biopsies",
      "Bilan d'extension scanner TAP"
    ]
  },
  "digestif_reflux_gastro_oesophagien_nick.json": {
    "spec": "appareil-digestif",
    "newFile": "digestif_pyrosis_et_regurgitations_m_nick.json",
    "motif": "Brûlures rétrosternales ascendantes et toux nocturne",
    "prenom": "Nick",
    "nom": "Miller",
    "age": 41,
    "sexe": "M",
    "itemR2C": "Item 270. Reflux gastro-œsophagien chez l'adulte.",
    "role": "Vous êtes interne en médecine générale.",
    "contexte": "Vous recevez M. Nick Miller, 41 ans, consultant pour des brûlures thoraciques survenant au coucher associées à une toux sèche nocturne.",
    "consignes": [
      "Identifier les symptômes typiques du pyrosis ascendant et des régurgitations acides",
      "Rechercher les manifestations extra-digestives (toux sèche nocturne, laryngite, érosions dentaires)",
      "Vérifier l'absence de signes d'alarme (pas d'amaigrissement, pas de dysphagie)",
      "Prescrire le traitement médical de première intention par IPP",
      "Éduquer le patient sur les mesures posturales et diététiques anti-reflux"
    ],
    "interdits": [
      "Ne pas prescrire d'endoscopie d'emblée chez un adulte jeune sans signe d'alarme",
      "Ne pas méconnaître une douleur coronarienne atypique"
    ],
    "materiel": [
      "Stéthoscope",
      "Tensiomètre"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Décontracté mais gêné la nuit par des quintes de toux et un goût acide dans la bouche.",
    "phraseOuverture": "Bonjour docteur, j'ai le feu qui me monte dans la gorge quand je me couche, et je tousse toute la nuit dès que je m'allonge.",
    "pointCle": "Reconnaître un RGO typique non compliqué chez un patient jeune, instaurer un traitement par IPP pleine dose pendant 4 semaines et mesures hygiéno-diététiques.",
    "erreurs": [
      "Prescrire une EOGD non indiquée",
      "Omettre les conseils de surélévation de la tête de lit"
    ],
    "elements": [
      "Sémiologie typique (pyrosis + régurgitations + syndrome postural)",
      "Absence de signes d'alarme",
      "Prescription IPP pleine dose 4 semaines",
      "Règles d'hygiène et posturales"
    ]
  },
  "nephro_pyelonephrite_obstructive.json": {
    "spec": "uronephro",
    "newFile": "nephro_fievre_et_douleur_lombaire_droite_m_ribaucourt.json",
    "motif": "Fièvre élevée et douleur lombaire unilatérale aiguë",
    "prenom": "Lucas",
    "nom": "Ribaucourt",
    "age": 32,
    "sexe": "M",
    "itemR2C": "Item 161. Infections urinaires de l'adulte. Item 348. Sepsis.",
    "role": "Vous êtes interne aux urgences médico-chirurgicales.",
    "contexte": "Vous recevez Lucas Ribaucourt, 32 ans, se présentant pour une fièvre à 39.5°C avec frissons et douleur lombaire droite hyperalgique.",
    "consignes": [
      "Identifier les signes de gravité et de défaillance hémodynamique (sepsis)",
      "Préciser les caractéristiques de la douleur lombaire et les antécédents lithiasiques",
      "Réaliser un examen clinique complet avec palpation de l'angle costo-vertébral",
      "Prescrire le bilan infectieux et l'imagerie en urgence",
      "Organiser la prise en charge médico-chirurgicale urgente"
    ],
    "interdits": [
      "Ne pas prescrire d'AINS devant une infection urinaire fébrile",
      "Ne pas retarder le drainage chirurgical en cas d'obstacle sur rein infecté"
    ],
    "materiel": [
      "Thermomètre",
      "Tensiomètre",
      "Stéthoscope",
      "Bandelette urinaire",
      "Abord veineux"
    ],
    "lieu": "Box d'accueil des urgences",
    "personnalite": "Anxieux, très algique, frissonne, coopératif malgré la souffrance.",
    "phraseOuverture": "Bonjour docteur, j'ai d'horribles douleurs dans le dos à droite et je tremble de froid avec presque 40 de fièvre...",
    "pointCle": "Diagnostiquer une pyélonéphrite aiguë obstructive, urgence médico-chirurgicale absolue imposant un drainage en urgence et antibiothérapie IV.",
    "erreurs": [
      "Donner des AINS",
      "Retarder le drainage des urines purulentes sous pression"
    ],
    "elements": [
      "Recherche de signes de choc septique",
      "Bandelette urinaire et ECBU immédiat",
      "Scanner abdomino-pelvien basse dose sans injection",
      "Appel de l'urologue de garde pour levée d'obstacle"
    ]
  },
  "nephro_varicocele.json": {
    "spec": "uronephro",
    "newFile": "nephro_pesanteur_scrotale_gauche_m_julien.json",
    "motif": "Pesanteur scrotale gauche augmentant en fin de journée",
    "prenom": "Julien",
    "nom": "Mercier",
    "age": 28,
    "sexe": "M",
    "itemR2C": "Item 42. Infertilité du couple. Item 349. Pathologies scrotales.",
    "role": "Vous êtes interne en urologie ou médecine générale.",
    "contexte": "Vous recevez Julien Mercier, 28 ans, consultant pour une gêne testiculaire gauche d'aggravation progressive lors de la station debout prolongée.",
    "consignes": [
      "Préciser les circonstances de survenue et l'absence de caractère aigu brutal",
      "Réaliser un examen scrotal comparatif debout et couché avec manœuvre de Valsalva",
      "Vérifier le retentissement potentiel sur la fertilité masculine",
      "Proposer l'écho-doppler scrotal de confirmation",
      "Expliquer les options thérapeutiques (abstention vs embolisation / chirurgie)"
    ],
    "interdits": [
      "Ne pas prescrire d'antibiotiques sans signe infectieux",
      "Ne pas méconnaître une varicocèle droite isolée"
    ],
    "materiel": [
      "Gants d'examen",
      "Stéthoscope",
      "Tensiomètre"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Rassuré par l'absence de douleur aiguë mais inquiet pour sa fertilité future.",
    "phraseOuverture": "Bonjour docteur, depuis quelques mois j'ai comme une sensation de sac de vers ou de lourdeur dans la bourse à gauche, surtout le soir après mon travail.",
    "pointCle": "Identifier une varicocèle gauche clinique (grade 3), confirmer par écho-doppler et évaluer la fertilité par spermogramme si désir de paternité.",
    "erreurs": [
      "Confondre avec une orchi-épididymite et donner des antibiotiques",
      "Omettre la palpation abdominale"
    ],
    "elements": [
      "Palpation bilatérale debout et couché avec Valsalva",
      "Prescription d'un écho-doppler scrotal",
      "Spermogramme si projet parental",
      "Discussion des indications de traitement"
    ]
  },
  "nephro_IRA_obstructive.json": {
    "spec": "uronephro",
    "newFile": "nephro_anurie_et_douleur_hypogastrique_m_faure.json",
    "motif": "Absence d'émission d'urine depuis 24 heures et pesanteur pelvienne",
    "prenom": "Gérard",
    "nom": "Faure",
    "age": 72,
    "sexe": "M",
    "itemR2C": "Item 258. Élévation de la créatininémie. Item 347. Rétention aiguë d'urine.",
    "role": "Vous êtes interne aux urgences médicales.",
    "contexte": "Vous recevez M. Gérard Faure, 72 ans, adressé pour anurie depuis 24 heures, agitation et découverte d'une créatinine à 450 µmol/L.",
    "consignes": [
      "Rechercher immédiatement un globe vésical par la palpation et percussion hypogastrique",
      "Vérifier l'absence d'hyperkaliémie menaçante sur l'ECG immédiat",
      "Poser l'indication urgente d'un drainage vésical par sondage urinaire ou cathéter sus-pubien",
      "Surveiller le syndrome de levée d'obstacle (polyurie osmotique, hypotension, dyskaliémie)",
      "Organiser l'échographie rénale et des voies urinaires"
    ],
    "interdits": [
      "Ne pas poser de cathéter sus-pubien si suspicion de tumeur de vessie",
      "Ne pas négliger la compensation volumique de la levée d'obstacle"
    ],
    "materiel": [
      "Sonde vésicale et poche collectrice",
      "Bladder-scan",
      "ECG",
      "Tensiomètre"
    ],
    "lieu": "Box des urgences",
    "personnalite": "Agité, douloureux, confus par l'urémie et la rétention urinaire aiguë.",
    "phraseOuverture": "Bonjour docteur... j'ai un poids énorme dans le bas du ventre, je n'arrive plus du tout à faire pipi depuis hier matin et j'ai des nausées.",
    "pointCle": "Diagnostiquer une insuffisance rénale aiguë obstructive sur rétention aiguë d'urines, drainer en urgence et monitorer le syndrome de levée d'obstacle.",
    "erreurs": [
      "Hydrater massivement avant de drainer les urines",
      "Omettre l'ECG devant une insuffisance rénale aiguë sévère"
    ],
    "elements": [
      "Recherche clinique du globe vésical",
      "ECG immédiat",
      "Sondage vésical aseptique",
      "Surveillance horaire de la diurèse et compensation hydrique"
    ]
  },
  "nephro_torsion_du_cordon_spermatique.json": {
    "spec": "uronephro",
    "newFile": "nephro_douleur_testiculaire_aigue_jeune_hugo.json",
    "motif": "Douleur testiculaire brutale et intense chez un adolescent",
    "prenom": "Hugo",
    "nom": "Dubois",
    "age": 16,
    "sexe": "M",
    "itemR2C": "Item 349. Torsion du cordon spermatique.",
    "role": "Vous êtes interne aux urgences chirurgicales.",
    "contexte": "Vous recevez Hugo, 16 ans, amené pour une douleur brutale atroce de la bourse droite apparue il y a 2 heures au réveil.",
    "consignes": [
      "Reconnaître le caractère d'extrême urgence chirurgicale (délai de 6 heures pour sauver le testicule)",
      "Rechercher les signes physiques clés (testicule ascensionné, horizontalisé, réflexe crémastérien aboli)",
      "Vérifier l'absence de signe de Prehn positif et l'absence de fièvre",
      "Mettre le patient à jeun immédiatement et appeler l'urologue de garde",
      "Ne pas perdre de temps avec une échographie si elle retarde l'exploration chirurgicale"
    ],
    "interdits": [
      "Ne jamais retarder l'exploration chirurgicale pour attendre une échographie",
      "Ne pas prescrire d'antalgiques oraux qui retarderaient l'anesthésie"
    ],
    "materiel": [
      "Gants d'examen",
      "Voie veineuse",
      "Antalgiques IV"
    ],
    "lieu": "Box des urgences",
    "personnalite": "Prostré par la douleur, nauséeux, pâle, marche avec les jambes écartées.",
    "phraseOuverture": "Docteur, j'ai une douleur insupportable dans les testicules depuis 6 heures du matin, je ne peux même plus marcher...",
    "pointCle": "Toute douleur testiculaire aiguë de l'enfant et de l'adulte jeune est une torsion du cordon spermatique jusqu'à preuve chirurgicale du contraire : bloc opératoire en urgence avant H6.",
    "erreurs": [
      "Attendre une échographie doppler en retardant la détorsion au-delà de 6 heures",
      "Rassurer faussement sur une orchi-épididymite sans fièvre"
    ],
    "elements": [
      "Palpation douce du testicule ascensionné et horizontalisé",
      "Abolition du réflexe crémastérien",
      "Patient mis à jeun immédiat",
      "Appel immédiat de l'urologue pour orchidopexie bilatérale"
    ]
  },
  "nephro_orchiepididymite.json": {
    "spec": "uronephro",
    "newFile": "nephro_grosse_bourse_inflammatoire_m_antoine.json",
    "motif": "Douleur scrotale progressive avec fièvre et brûlures urinaires",
    "prenom": "Antoine",
    "nom": "Roussel",
    "age": 31,
    "sexe": "M",
    "itemR2C": "Item 161. Infections urinaires de l'adulte. Item 349. Pathologies scrotales.",
    "role": "Vous êtes interne en médecine d'urgence.",
    "contexte": "Vous recevez M. Antoine Roussel, 31 ans, présentant depuis 48h une tuméfaction scrotale droite douloureuse progressive avec fièvre à 38.6°C.",
    "consignes": [
      "Distinguer la douleur progressive avec fièvre d'une torsion aiguë du cordon spermatique",
      "Rechercher le signe de Prehn (soulagement lors du soulèvement de la bourse)",
      "Explorer les facteurs de risque d'IST (chlamydia, gonocoque) et faire l'interrogatoire sexuel",
      "Prescrire l'ECBU, le prélèvement urétral / PCR sur premier jet d'urine et l'échographie scrotale",
      "Prescrire l'antibiothérapie probabiliste adaptée et le traitement de la partenaire"
    ],
    "interdits": [
      "Ne pas éliminer formellement une torsion sans certitude",
      "Ne pas omettre le traitement du ou des partenaires"
    ],
    "materiel": [
      "Bandelette urinaire",
      "Thermomètre",
      "Stéthoscope",
      "Gants"
    ],
    "lieu": "Box des urgences",
    "personnalite": "Inconfortable, marche précautionneusement, gêné d'aborder sa vie intime.",
    "phraseOuverture": "Bonjour docteur, ma bourse droite a doublé de volume depuis deux jours, c'est tout rouge, chaud, et ça me brûle quand je fais pipi.",
    "pointCle": "Identifier une orchi-épididymite aiguë chez un adulte jeune, éliminer la torsion, prescrire une antibiothérapie ciblée sur les IST et traiter les partenaires.",
    "erreurs": [
      "Omettre le prélèvement PCR premier jet pour Chlamydia/Gonocoque",
      "Omettre le repos avec suspensoir et glaçage"
    ],
    "elements": [
      "Signe de Prehn positif et conservation du réflexe crémastérien",
      "Bandelette urinaire et PCR urinaire premier jet",
      "Antibiothérapie probabiliste active sur les germes d'IST",
      "Port de suspensoir et éviction des rapports non protégés"
    ]
  },
  "ANDRO_dysfonction_erectile_militaire.json": {
    "spec": "uronephro",
    "newFile": "uro_troubles_erection_sujet_jeune_m_mercier.json",
    "motif": "Difficultés érectiles récentes chez un militaire de retour de mission",
    "prenom": "Alexandre",
    "nom": "Mercier",
    "age": 33,
    "sexe": "M",
    "itemR2C": "Item 124. Troubles de l'érection.",
    "role": "Vous êtes interne en médecine générale ou consultation d'andrologie.",
    "contexte": "Vous recevez Alexandre Mercier, 33 ans, militaire, consultant avec pudeur pour des pannes sexuelles apparues au retour d'un déploiement opérationnel.",
    "consignes": [
      "Mener un entretien bienveillant et déculpabilisant sur les caractéristiques du trouble érectile",
      "Distinguer une cause psychologique/réactionnelle d'une cause organique (présence d'érections matinales)",
      "Dépister un état de stress post-traumatique (ESPT), des troubles anxio-dépressifs ou un abus de toxiques",
      "Évaluer le risque cardiovasculaire et métabolique sous-jacent",
      "Proposer une prise en charge combinée psychothérapeutique et symptomatique temporaire"
    ],
    "interdits": [
      "Ne pas banaliser la souffrance masculine",
      "Ne pas prescrire d'inhibiteurs de la PDE-5 en association avec des dérivés nitrés"
    ],
    "materiel": [
      "Tensiomètre",
      "Stéthoscope",
      "Ordonnancier"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Fermé au départ, pudique, craint pour sa virilité et son couple, hypervigilant.",
    "phraseOuverture": "Bonjour docteur... c'est très difficile pour moi de venir. Depuis mon retour de mission il y a 4 mois, je n'arrive plus à avoir de rapports avec ma femme.",
    "pointCle": "Reconnaître une dysfonction érectile psychogène/réactionnelle sur syndrome de stress post-traumatique, éliminer une cause organique et proposer un accompagnement adapté.",
    "erreurs": [
      "Réduire la consultation à une simple délivrance d'ordonnance sans écoute",
      "Négliger le dépistage de l'ESPT chez le militaire"
    ],
    "elements": [
      "Présence d'érections nocturnes et matinales conservées",
      "Dépistage des cauchemars et reviviscences traumatiques",
      "Examen clinique cardiovasculaire et urogénital normal",
      "Soutien psychologique spécialisé"
    ]
  },
  "URO_cystite_IST_chlamydia.json": {
    "spec": "uronephro",
    "newFile": "uro_brulures_mictionnelles_et_ecoulement_m_vincent.json",
    "motif": "Brûlures mictionnelles et écoulement urétral clair",
    "prenom": "Vincent",
    "nom": "Lemoine",
    "age": 25,
    "sexe": "M",
    "itemR2C": "Item 162. Infections sexuellement transmissibles.",
    "role": "Vous êtes interne au centre de dépistage (CeGIDD).",
    "contexte": "Vous recevez Vincent Lemoine, 25 ans, qui consulte pour un prurit urétral avec brûlures en urinant et petit écoulement matinal depuis 4 jours.",
    "consignes": [
      "Conduire l'interrogatoire sur les expositions sexuelles récentes avec bienveillance et confidentialité",
      "Réaliser un examen des organes génitaux externes à la recherche d'un écoulement méatique et d'ulcérations",
      "Indiquer le test de diagnostic direct par PCR sur premier jet d'urine",
      "Proposer le dépistage combiné de l'ensemble des IST (VIH, VHB, syphilis)",
      "Prescrire le traitement antibiotique de première intention et organiser la prise en charge des partenaires"
    ],
    "interdits": [
      "Ne pas réaliser de prélèvement juste après une miction",
      "Ne pas oublier le traitement des partenaires"
    ],
    "materiel": [
      "Bandelette urinaire",
      "Kit de recueil urinaire pour PCR",
      "Gants"
    ],
    "lieu": "Box de consultation CeGIDD",
    "personnalite": "Gêné, inquiet d'avoir transmis une infection à sa compagne.",
    "phraseOuverture": "Bonjour docteur, ça me brûle horriblement quand je fais pipi depuis quelques jours, et ce matin j'ai remarqué une goutte de liquide clair au bout de la verge.",
    "pointCle": "Diagnostiquer une urétrite subaiguë à Chlamydia trachomatis, prescrire la PCR sur 1er jet urinaire, traiter par doxycycline et traiter les partenaires.",
    "erreurs": [
      "Traiter par une simple fosfomycine",
      "Omettre le dépistage des autres IST"
    ],
    "elements": [
      "Interrogatoire sur les partenaires",
      "PCR Chlamydia trachomatis et Gonocoque sur premier jet",
      "Traitement par Doxycycline 100 mg x 2/j pendant 7 jours",
      "Préservatif obligatoire jusqu'à guérison des partenaires"
    ]
  },
  "URO_polyurie_diurese_osmotique_diabete.json": {
    "spec": "uronephro",
    "newFile": "uro_polyurie_et_nycturie_profuse_m_bonnet.json",
    "motif": "Émission d'urines très abondante jour et nuit avec soif",
    "prenom": "Alain",
    "nom": "Bonnet",
    "age": 58,
    "sexe": "M",
    "itemR2C": "Item 269. Polyurie-polydipsie de l'adulte.",
    "role": "Vous êtes interne en néphrologie.",
    "contexte": "Vous recevez M. Alain Bonnet, 58 ans, adressé pour une polyurie mesurée à plus de 4 litres par jour associée à une soif permanente.",
    "consignes": [
      "Quantifier la diurèse des 24 heures et distinguer polyurie vraie et pollakiurie",
      "Rechercher une diurèse osmotique versus diabète insipide",
      "Réaliser une bandelette urinaire et mesurer la glycémie capillaire immédiate",
      "Prescrire le bilan hydro-électrolytique (osmolarité plasmatique et urinaire, ionogramme)",
      "Mettre en place la prise en charge étiologique et surveiller l'état d'hydratation"
    ],
    "interdits": [
      "Ne pas réaliser d'épreuve de restriction hydrique en présence d'une diurèse osmotique",
      "Ne pas confondre avec un simple adénome de prostate"
    ],
    "materiel": [
      "Bandelette urinaire",
      "Lecteur glycémie",
      "Tensiomètre",
      "Balance"
    ],
    "lieu": "Cabinet de consultation hospitalière",
    "personnalite": "Fatigué par les réveils nocturnes incessants, boit des bouteilles d'eau en continu.",
    "phraseOuverture": "Bonjour docteur, je passe ma journée et ma nuit aux toilettes. Je remplis des litres d'urine et j'ai la bouche sèche en permanence.",
    "pointCle": "Identifier une polyurie osmotique secondaire à une glycosurie massive sur diabète méconnu, évaluer la déshydratation intracellulaire et rééquilibrer la glycémie.",
    "erreurs": [
      "Entreprendre un test de restriction hydrique chez un patient hyperglycémique",
      "Négliger le risque de coma hyperosmolaire"
    ],
    "elements": [
      "Bandelette urinaire révélant glycosurie ++++",
      "Glycémie capillaire élevée (> 3 g/L)",
      "Calcul de l'osmolarité plasmatique efficace",
      "Réhydratation adaptée et traitement hypoglycémiant"
    ]
  },
  "URO_troubles_fonctionnels_femme_jeune.json": {
    "spec": "uronephro",
    "newFile": "uro_fuites_urinaires_a_l_effort_mme_claire.json",
    "motif": "Fuites urinaires lors de la toux et du sport chez une jeune femme",
    "prenom": "Claire",
    "nom": "Dumont",
    "age": 34,
    "sexe": "F",
    "itemR2C": "Item 123. Incontinence urinaire de l'adulte.",
    "role": "Vous êtes interne en gynécologie ou urologie.",
    "contexte": "Vous recevez Mme Claire Dumont, 34 ans, mère de deux enfants, gênée au quotidien par des fuites involontaires lors de la course à pied et des éternuements.",
    "consignes": [
      "Préciser le type d'incontinence (incontinence d'effort versus impériosités/urgence)",
      "Rechercher les facteurs favorisants obstétricaux (accouchements par voie basse, gros bébé)",
      "Faire tenir un calendrier mictionnel sur 3 jours",
      "Éliminer une infection urinaire par une bandelette urinaire",
      "Prescrire en première intention la rééducation périnéo-sphinctérienne par kinésithérapie ou sage-femme"
    ],
    "interdits": [
      "Ne pas proposer de chirurgie en première intention chez la femme jeune sans rééducation",
      "Ne pas prescrire d'anticholinergiques pour une incontinence d'effort pure"
    ],
    "materiel": [
      "Bandelette urinaire",
      "Spéculum",
      "Tensiomètre"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Active, sportive, très complexée par ce problème qu'elle n'osait pas aborder.",
    "phraseOuverture": "Bonjour docteur... c'est embarrassant à mon âge, mais depuis la naissance de mon deuxième enfant, je perds de l'urine dès que je cours ou que j'éternue.",
    "pointCle": "Diagnostiquer une incontinence urinaire d'effort pure du post-partum, éliminer une infection urinaire et prescrire la rééducation périnéale en première ligne.",
    "erreurs": [
      "Proposer une chirurgie d'emblée sans rééducation",
      "Prescrire des médicaments inefficaces dans l'effort"
    ],
    "elements": [
      "Calendrier mictionnel",
      "Recherche de prolapsus génital associé",
      "Bandelette urinaire négative",
      "Prescription de rééducation périnéale"
    ]
  },
  "ORL_vertiges_hypotension_orthostatique.json": {
    "spec": "neurosensorielle",
    "newFile": "orl_vertiges_au_lever_mme_renaud.json",
    "motif": "Sensations vertigineuses brèves lors du passage à la position debout",
    "prenom": "Françoise",
    "nom": "Renaud",
    "age": 74,
    "sexe": "F",
    "itemR2C": "Item 221. Hypertension artérielle. Item 340. Malaise / perte de connaissance.",
    "role": "Vous êtes interne en médecine générale.",
    "contexte": "Vous recevez Mme Françoise Renaud, 74 ans, hypertendue, se plaignant d'étourdissements et de voile noir chaque fois qu'elle se lève de son lit ou de son fauteuil.",
    "consignes": [
      "Différencier un faux vertige (lipothymie, instabilité) d'un vertige rotatoire vrai",
      "Réaliser la manœuvre d'orthostatisme avec mesure de la PA et FC couché puis debout à 1 et 3 minutes",
      "Passer en revue les ordonnances et identifier les médicaments hypotenseurs ou iatrogènes",
      "Évaluer le risque de chute traumatique",
      "Adapter le traitement antihypertenseur et donner les conseils posturaux de lever progressif"
    ],
    "interdits": [
      "Ne pas prescrire d'antivertigineux vestibulaires (Tanganil) pour une hypotension orthostatique",
      "Ne pas négliger la déshydratation"
    ],
    "materiel": [
      "Tensiomètre manuel ou électronique",
      "Stéthoscope"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Patiente prudente, a peur de tomber et de se casser le col du fémur.",
    "phraseOuverture": "Bonjour docteur, dès que je me lève du lit ou de ma chaise, ma tête tourne et j'ai un voile noir devant les yeux. Je dois vite me rasseoir pour ne pas tomber.",
    "pointCle": "Diagnostiquer une hypotension orthostatique iatrogène chez un sujet âgé polymédiqué, ajuster les traitements antihypertenseurs et éduquer sur les transferts lents.",
    "erreurs": [
      "Prescrire un antivertigineux sédatif augmentant le risque de chute",
      "Omettre la mesure de la pression artérielle debout"
    ],
    "elements": [
      "Recherche du critère d'hypotension orthostatique (baisse PAS ≥ 20 mmHg ou PAD ≥ 10 mmHg)",
      "Revue des thérapeutiques (diurétiques, bêtabloquants, IEC)",
      "Conseils de lever en deux temps avec pause assis",
      "Port éventuel de bas de contention veineuse"
    ]
  },
  "ORL_cholesteatome.json": {
    "spec": "neurosensorielle",
    "newFile": "orl_otorrhee_chronique_et_vertiges_m_guillaume.json",
    "motif": "Écoulement d'oreille fétide et baisse d'audition avec vertiges",
    "prenom": "Guillaume",
    "nom": "Mercier",
    "age": 46,
    "sexe": "M",
    "itemR2C": "Item 88. Otalgie et otorrhée. Item 104. Vertige.",
    "role": "Vous êtes interne en ORL.",
    "contexte": "Vous recevez M. Guillaume Mercier, 46 ans, adressé pour une otorrhée purulente droite récidivante malodorante associée à des vertiges lors du mouchage.",
    "consignes": [
      "Préciser l'ancienneté de l'otorrhée et son caractère fétide indolore",
      "Réaliser un examen otoscopique bilatéral minutieux sous microscope ou optique",
      "Rechercher le signe de la fistule (vertige provoqué par la pression du tragus)",
      "Évaluer les complications endocrâniennes et périphériques (paralysie faciale)",
      "Prescrire un scanner des rochers sans injection et programmer l'intervention chirurgicale d'éradication"
    ],
    "interdits": [
      "Ne pas prescrire de gouttes auriculaires aminoglycosides en cas de suspicion de tympan ouvert",
      "Ne pas temporiser devant des vertiges avec fistule labyrinthique"
    ],
    "materiel": [
      "Otoscope",
      "Spéculums auriculaires",
      "Diapason",
      "Poire de Siegle"
    ],
    "lieu": "Box de consultation ORL",
    "personnalite": "Habitué aux otites depuis l'enfance mais inquiet de l'apparition des vertiges récents.",
    "phraseOuverture": "Bonjour docteur, j'ai l'oreille droite qui coule jaune et qui sent mauvais depuis des mois. Mais depuis une semaine, dès que j'appuie sur mon oreille, tout tourne autour de moi.",
    "pointCle": "Diagnostiquer un cholestéatome de l'oreille moyenne compliqué d'une fistule labyrinthique (signe de la fistule positif), prescrire un scanner des rochers et référer pour tympanoplastie chirurgicale.",
    "erreurs": [
      "Se contenter d'un simple traitement antibiotique local prolongé",
      "Omettre de tester la motricité faciale"
    ],
    "elements": [
      "Otoscopie montrant des squames épidermiques dans la pars flaccida",
      "Signe de la fistule positif",
      "Test au diapason (surdité de transmission ou mixte)",
      "Scanner des rochers haute résolution en urgence"
    ]
  },
  "NEURO_vertiges_centrales.json": {
    "spec": "neurosensorielle",
    "newFile": "orl_instabilite_a_la_marche_post_chute_m_carpentier.json",
    "motif": "Instabilité majeure à la marche et maladresse de la main suite à un traumatisme",
    "prenom": "Laurent",
    "nom": "Carpentier",
    "age": 53,
    "sexe": "M",
    "itemR2C": "Item 104. Vertige. Item 93. Déficit moteur et/ou sensitif.",
    "role": "Vous êtes interne aux urgences neurologiques.",
    "contexte": "Vous recevez M. Laurent Carpentier, 53 ans, présentant des vertiges intenses, une démarche ébrieuse et une maladresse du bras droit survenus après une chute avec choc occipital.",
    "consignes": [
      "Distinguer un vertige périphérique d'un syndrome cérébelleux central",
      "Réaliser un examen neurologique complet (épreuve doigt-nez, dysmétrie, adiadococinésie, nystagmus multidirectionnel)",
      "Rechercher un nystagmus vertical ou changeant de sens qui signe une origine centrale",
      "Prescrire en extrême urgence une IRM cérébrale avec séquences de diffusion et angio-IRM",
      "Organiser l'hospitalisation en unité neuro-vasculaire ou réanimation"
    ],
    "interdits": [
      "Ne pas porter le diagnostic hâtif de vertige positionnel bénin sans examen neurologique",
      "Ne pas renvoyer le patient à domicile"
    ],
    "materiel": [
      "Marteau réflexe",
      "Ophtalmoscope",
      "Stéthoscope",
      "Tensiomètre"
    ],
    "lieu": "Box des urgences",
    "personnalite": "Inquiet, titubant, incapable de tenir debout pieds joints sans écarter les jambes.",
    "phraseOuverture": "Bonjour docteur, depuis que je suis tombé et que je me suis cogné la tête il y a trois jours, je marche comme si j'étais ivre et ma main droite tremble quand je veux attraper un verre.",
    "pointCle": "Identifier un syndrome cérébelleux aigu unilatéral d'origine centrale (ischémie ou hématome de la fosse postérieure / dissection vertébrale post-traumatique), urgence diagnostique imposant l'IRM cérébrale immédiate.",
    "erreurs": [
      "Conclure à un VPPB devant un nystagmus central",
      "Négliger le risque d'engagement amygdalien"
    ],
    "elements": [
      "Examen cérébelleux cinétique et statique (ataxie cérébelleuse)",
      "Nystagmus non épuisable et multidirectionnel",
      "IRM cérébrale en urgence avec angioscanner ou angio-IRM des troncs supra-aortiques",
      "Surveillance scopique neurologique continue"
    ]
  },
  "ORL_syndrome_labyrinthique.json": {
    "spec": "neurosensorielle",
    "newFile": "orl_grand_vertige_rotatoire_et_surdite_mme_lemoine.json",
    "motif": "Grand vertige rotatoire aigu avec vomissements et acouphènes",
    "prenom": "Élise",
    "nom": "Lemoine",
    "age": 48,
    "sexe": "F",
    "itemR2C": "Item 104. Vertige. Item 89. Déficit auditif.",
    "role": "Vous êtes interne en médecine d'urgence / ORL.",
    "contexte": "Vous recevez Mme Élise Lemoine, 48 ans, amenée pour un grand vertige rotatoire continu invalidant depuis 24h avec vomissements incoercibles et sensation d'oreille bouchée avec bourdonnements.",
    "consignes": [
      "Caractériser le grand vertige rotatoire (durée > 12h, illusions de mouvement)",
      "Rechercher un nystagmus horizontalo-rotatoire battant vers l'oreille saine (syndrome vestibulaire harmonieux)",
      "Réaliser l'épreuve de Romberg et la déviation des index",
      "Rechercher les signes vestibulaires périphériques par le test d'impulsion céphalique (Halmagyi)",
      "Prescrire un traitement symptomatique antiémétique et antivertigineux et organiser le bilan audiométrique"
    ],
    "interdits": [
      "Ne pas négliger un test d'Halmagyi normal dans un vertige aigu qui doit faire craindre un AVC de fosse postérieure",
      "Ne pas laisser la patiente se déshydrater"
    ],
    "materiel": [
      "Lunettes de Frenzel",
      "Otoscope",
      "Perfusion pour réhydratation",
      "Tensiomètre"
    ],
    "lieu": "Box des urgences",
    "personnalite": "Prostrée dans le noir, yeux fermés, nauséeuse au moindre mouvement de la tête.",
    "phraseOuverture": "Docteur, ne bougez pas le brancard s'il vous plaît... Toute la pièce tourne à toute vitesse autour de moi, j'ai vomi toute la nuit et mon oreille gauche bourdonne.",
    "pointCle": "Identifier un syndrome vestibulaire périphérique harmonieux aigu (névrite vestibulaire ou labyrinthite aiguë), pratiquer le HINTS test pour éliminer un accident vasculaire central et réhydrater en urgence.",
    "erreurs": [
      "Méconnaître un nystagmus vertical central",
      "Négliger le risque de fausse route lors des vomissements"
    ],
    "elements": [
      "Syndrome vestibulaire harmonieux (déviations du côté de la lésion, nystagmus opposé)",
      "Test d'Halmagyi positif orientant vers une cause périphérique",
      "Réhydratation hydroélectrolytique et antiémétiques IV",
      "Audiogramme tonal et vocal"
    ]
  },
  "neuro_epilepsie_generalisee_oscar.json": {
    "spec": "neurologie/psychiatrie",
    "newFile": "neuro_perte_de_connaissance_avec_mouvements_m_oscar.json",
    "motif": "Perte de connaissance brutale avec secousses des quatre membres",
    "prenom": "Oscar",
    "nom": "Lefebvre",
    "age": 19,
    "sexe": "M",
    "itemR2C": "Item 105. Épilepsie de l'enfant et de l'adulte.",
    "role": "Vous êtes interne aux urgences médicales.",
    "contexte": "Vous recevez Oscar, étudiant de 19 ans, amené par les pompiers après une perte de connaissance survenue lors d'une soirée étudiante avec mouvements saccadés involontaires.",
    "consignes": [
      "Interroger les témoins pour reconstituer les phases de la crise (tonique, clonique, stertoreuse)",
      "Rechercher les éléments diagnostiques clés (morsure latérale de langue, perte d'urine, confusion post-critique)",
      "Identifier les facteurs déclenchants (dette de sommeil, alcool, stroboscopes)",
      "Éliminer une cause aiguë symptomatique (glycémie, ionogramme, toxiques)",
      "Délivrer les consignes de sécurité immédiates (conduite automobile, baignade) et organiser l'EEG"
    ],
    "interdits": [
      "Ne pas débuter un traitement antiépileptique au long cours après une première crise non provoquée sans bilan complet",
      "Ne pas autoriser la reprise de la conduite automobile"
    ],
    "materiel": [
      "Lecteur glycémie",
      "Stéthoscope",
      "Tensiomètre",
      "Marteau réflexes",
      "Abaisse-langue"
    ],
    "lieu": "Box d'accueil des urgences",
    "personnalite": "Somnolent, courbaturé, confus sur les événements récents, craint de perdre son permis.",
    "phraseOuverture": "Bonjour docteur... je me réveille ici sans savoir pourquoi. J'ai mal à la langue sur le côté et mes muscles me font mal partout comme si j'avais couru un marathon.",
    "pointCle": "Caractériser une crise épileptique généralisée tonico-clonique inaugurale, éliminer une crise symptomatique aiguë, informer sur l'interdiction de conduite et programmer l'EEG avec IRM cérébrale.",
    "erreurs": [
      "Confondre avec une syncope vaso-vagale en présence d'une morsure latérale de langue",
      "Omettre l'interdiction temporaire de conduite automobile"
    ],
    "elements": [
      "Morsure du bord latéral de la langue",
      "Phase de confusion post-critique amnésique",
      "Bilan métabolique d'urgence (glycémie, natrémie, calcémie)",
      "Prescription d'un EEG de veille et sommeil et IRM cérébrale"
    ]
  },
  "neuro_epilepsie_temporale_elinordammert.json": {
    "spec": "neurologie/psychiatrie",
    "newFile": "neuro_episodes_amnesiques_et_deja_vu_mme_elinor.json",
    "motif": "Sensations d'angoisse épigastrique ascendante avec impression de déjà-vu et amnésie",
    "prenom": "Elinor",
    "nom": "Dammert",
    "age": 38,
    "sexe": "F",
    "itemR2C": "Item 105. Épilepsie de l'enfant et de l'adulte.",
    "role": "Vous êtes interne en neurologie.",
    "contexte": "Vous recevez Mme Elinor Dammert, 38 ans, adressée pour des épisodes brefs récurrents caractérisés par une sensation d'angoisse gastrique qui monte, suivie d'une brève absence.",
    "consignes": [
      "Préciser la sémiologie stéréotypée de l'aura épigastrique ascendante et du vécu de déjà-vu / déjà-vécu",
      "Interroger l'entourage sur d'éventuels automatismes gestuels ou masticatoires pendant l'épisode",
      "Rechercher une amnésie lacunaire ou des troubles du langage post-critiques",
      "Prescrire une IRM cérébrale avec coupes coronales fines hippocampiques (sclérose mésio-temporale)",
      "Organiser un électroencéphalogramme (EEG) prolongé avec épreuves de sensibilisation"
    ],
    "interdits": [
      "Ne pas étiqueter ces épisodes comme de simples crises d'angoisse ou attaques de panique sans bilan neurologique",
      "Ne pas prescrire de scanner à la place de l'IRM pour l'exploration des hippocampes"
    ],
    "materiel": [
      "Marteau réflexe",
      "Stéthoscope",
      "Ordonnancier"
    ],
    "lieu": "Cabinet de consultation de neurologie",
    "personnalite": "Déconcertée par ces sensations étranges, a peur de devenir folle ou d'avoir une tumeur.",
    "phraseOuverture": "Bonjour docteur, j'ai des moments bizarres depuis 6 mois. J'ai une boule dans le ventre qui monte dans ma gorge, une sensation très forte d'avoir déjà vécu l'instant présent, et après mes collègues me disent que je mâchonne dans le vide sans leur répondre.",
    "pointCle": "Reconnaître les crises focales avec altération de la conscience d'origine temporale interne (aura épigastrique ascendante, état de rêve, automatismes oro-alimentaires), prescrire IRM cérébrale et EEG.",
    "erreurs": [
      "Confondre avec un trouble panique en ignorant les automatismes masticatoires",
      "Omettre l'IRM hippocampique"
    ],
    "elements": [
      "Sémiologie de la crise temporale interne (aura, rupture de contact, automatismes)",
      "Prescription IRM cérébrale protocole épilepsie",
      "Prescription EEG de veille et sommeil",
      "Mise en place d'un antiépileptique de première intention (ex. lamotrigine ou lévétiracétam)"
    ]
  },
  "neuro_polyneuropathie_jacques.json": {
    "spec": "neurologie/psychiatrie",
    "newFile": "neuro_perte_sensibilite_des_pieds_m_jacques.json",
    "motif": "Perte de sensibilité progressive et engourdissement des deux pieds",
    "prenom": "Jacques",
    "nom": "Lemoine",
    "age": 64,
    "sexe": "M",
    "itemR2C": "Item 96. Neuropathies périphériques.",
    "role": "Vous êtes interne en médecine interne / neurologie.",
    "contexte": "Vous recevez M. Jacques Lemoine, 64 ans, consultant pour des sensations de marcher sur des braises ou du coton avec engourdissement ascendant des deux membres inférieurs depuis un an.",
    "consignes": [
      "Caractériser le tableau de polyneuropathie distale, symétrique, synchrone et à prédominance sensitivo-motrice",
      "Rechercher les antécédents étiologiques majeurs (diabète méconnu, consommation alcoolique, gammapathie, chimiothérapie)",
      "Réaliser un examen clinique neurologique complet (abolition des ROT achilléens, hypoesthésie en chaussette, ataxie proprioceptive)",
      "Prescrire l'électromyogramme (EMG) pour préciser le mécanisme (axonal vs démyélinisant)",
      "Prescrire le bilan biologique étiologique standardisé (glycémie, HbA1c, EPP, TSH, B12, folates)"
    ],
    "interdits": [
      "Ne pas négliger la recherche de troubles de la déglutition ou du système végétatif",
      "Ne pas prescrire d'antalgiques opioïdes purs pour des douleurs neuropathiques"
    ],
    "materiel": [
      "Diapason gradué 128 Hz",
      "Monofilament de Semmes-Weinstein",
      "Marteau réflexe",
      "Pique-touche"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Gêné pour la marche, craint de perdre son autonomie, décrit des douleurs pénibles la nuit.",
    "phraseOuverture": "Bonjour docteur, je viens parce que je ne sens plus mes pieds. J'ai l'impression de marcher sur des épines ou du coton, et mes jambes sont très faibles.",
    "pointCle": "Diagnostiquer une polyneuropathie sensitivomotrice longueur-dépendante distale et symétrique (arflexie achilléenne), confirmer par EMG et rechercher en premier lieu un diabète ou une intoxication alcoolique.",
    "erreurs": [
      "Méconnaître le caractère longueur-dépendant",
      "Traiter les douleurs neuropathiques par des AINS inefficaces"
    ],
    "elements": [
      "Abolition bilatérale et symétrique des réflexes achilléens",
      "Déficit thermo-algique et pallanesthésie distale",
      "Prescription EMG des 4 membres",
      "Prescription d'un traitement spécifique de la douleur neuropathique (gabapentinoïde ou duloxétine)"
    ]
  },
  "neuro_crise_psychogene_JoeW.json": {
    "spec": "neurologie/psychiatrie",
    "newFile": "neuro_episodes_mouvements_anormaux_m_joe.json",
    "motif": "Épisodes récurrents de mouvements anormaux sans perte de connaissance vraie",
    "prenom": "Joe",
    "nom": "Williams",
    "age": 27,
    "sexe": "M",
    "itemR2C": "Item 105. Épilepsie. Item 70. Troubles somatoformes et fonctionnels.",
    "role": "Vous êtes interne en neurologie.",
    "contexte": "Vous recevez Joe Williams, 27 ans, adressé après plusieurs passages aux urgences pour des crises spectaculaires de secousses prolongées résistantes aux anticonvulsivants.",
    "consignes": [
      "Rechercher les éléments sémiologiques différentiels clés (yeux clos avec résistance à l'ouverture, mouvements de balancement du bassin, absence de morsure latérale de langue)",
      "Noter la durée prolongée des crises (> 15-30 minutes) sans état de mal électrique",
      "Vérifier la normalité de l'examen neurologique intercritique et des bilans biologiques",
      "Annoncer le diagnostic de crise non épileptique psychogène (CNEP) avec bienveillance, sans rejet ni stigmatisation",
      "Déprogrammer l'escalade médicamenteuse antiépileptique inutile et orienter vers une prise en charge psychothérapeutique"
    ],
    "interdits": [
      "Ne pas dire au patient qu'il 'fait semblant' ou 'simule'",
      "Ne pas injecter de benzodiazépines en continu risquant une dépression respiratoire iatrogène"
    ],
    "materiel": [
      "Marteau réflexe",
      "Stéthoscope",
      "Tensiomètre"
    ],
    "lieu": "Box de consultation de neurologie",
    "personnalite": "Détresse psychologique importante, stressé par des conflits personnels récents, se sent incompris des soignants.",
    "phraseOuverture": "Bonjour docteur... les médecins des urgences n'arrêtent pas de m'augmenter mes doses de médicaments contre l'épilepsie, mais mes crises continuent de plus belle et durent parfois 40 minutes.",
    "pointCle": "Identifier des crises non épileptiques psychogènes (CNEP / trouble neurologique fonctionnel), confirmer par vidéo-EEG, annoncer le diagnostic positivement et sevrer les antiépileptiques.",
    "erreurs": [
      "Traiter les CNEP comme un état de mal épileptique avec intubation en réanimation",
      "Rejeter le patient en affirmant qu'il n'a rien"
    ],
    "elements": [
      "Absence de stertor, yeux fermés avec résistance active",
      "Mouvements asynchrones avec préservation de la réactivité",
      "Normalité de l'EEG simultané pendant la crise",
      "Alliance thérapeutique et orientation vers psychothérapie TCC/EMDR"
    ]
  },
  "neuro_epilepsie_averee_mary.json": {
    "spec": "neurologie/psychiatrie",
    "newFile": "neuro_crises_convulsives_repetees_mme_mary.json",
    "motif": "Épisodes répétés de malaises avec perte de connaissance",
    "prenom": "Mary",
    "nom": "Bennett",
    "age": 29,
    "sexe": "F",
    "itemR2C": "Item 105. Épilepsie de l'enfant et de l'adulte.",
    "role": "Vous êtes interne en neurologie.",
    "contexte": "Vous recevez Mary Bennett, 29 ans, qui présente un troisième épisode de perte de connaissance brutale avec amnésie et myalgies diffuses.",
    "consignes": [
      "Confirmer le diagnostic d'épilepsie maladie (au moins deux crises non provoquées espacées de plus de 24h)",
      "Analyser l'électroencéphalogramme (pointes-ondes généralisées synchrones)",
      "Discuter de l'instauration d'un traitement antiépileptique de fond en tenant compte du potentiel tératogène (contre-indication du valproate de sodium)",
      "Informer sur la contraception adaptée (interactions avec les inducteurs enzymatiques)",
      "Rappeler les règles d'hygiène de vie et la réglementation sur le permis de conduire"
    ],
    "interdits": [
      "Ne jamais prescrire de valproate de sodium chez une femme en âge de procréer",
      "Ne pas omettre les consignes de sécurité légale concernant la conduite"
    ],
    "materiel": [
      "Marteau réflexe",
      "Tracé EEG papier",
      "Ordonnancier"
    ],
    "lieu": "Cabinet de consultation spécialisée",
    "personnalite": "Inquiète de l'impact de la maladie sur son projet de grossesse et son travail.",
    "phraseOuverture": "Bonjour docteur, c'est la troisième fois en six mois que je m'effondre sans m'en rendre compte. Mon mari m'a vue trembler de tout mon corps la nuit dernière.",
    "pointCle": "Poser le diagnostic d'épilepsie généralisée de l'adulte jeune, choisir un traitement compatible avec la grossesse (ex. lamotrigine ou lévétiracétam) et bannir formellement la dépakine.",
    "erreurs": [
      "Prescrire du valproate de sodium à une femme jeune en âge de procréer",
      "Omettre les consignes d'éviction des bains sans surveillance"
    ],
    "elements": [
      "Diagnostic d'épilepsie répondant à la définition ILAE",
      "Contre-indication absolue du valproate chez la femme jeune",
      "Prescription de lamotrigine ou lévétiracétam avec titration lente",
      "Conseils d'hygiène (sommeil régulier, éviction des toxiques)"
    ]
  },
  "neuro_crise_convulsive_generalisee_Lexie.json": {
    "spec": "neurologie/psychiatrie",
    "newFile": "neuro_secousses_musculaires_et_amnesie_mlle_lexie.json",
    "motif": "Secousses musculaires nocturnes et morsure de langue",
    "prenom": "Lexie",
    "nom": "Grey",
    "age": 23,
    "sexe": "F",
    "itemR2C": "Item 105. Épilepsie de l'enfant et de l'adulte.",
    "role": "Vous êtes interne aux urgences médicales.",
    "contexte": "Vous recevez Lexie Grey, 23 ans, interne de garde retrouvée par sa co-interne inconsciente au sol de la chambre de garde avec respiration stertoreuse.",
    "consignes": [
      "Recueillir les éléments de la crise auprès du témoin",
      "Rechercher les signes d'épuisement ou de dette de sommeil aiguë",
      "Effectuer un examen neurologique complet en post-critique immédiat",
      "Prescrire le bilan biologique d'urgence (glycémie, ionogramme, toxiques)",
      "Organiser la surveillance et planifier un EEG de sommeil"
    ],
    "interdits": [
      "Ne pas renvoyer l'interne continuer sa garde immédiatement",
      "Ne pas omettre la recherche d'une cause métabolique ou toxique"
    ],
    "materiel": [
      "Lecteur glycémie",
      "Tensiomètre",
      "Stéthoscope",
      "Marteau réflexe"
    ],
    "lieu": "Service d'accueil des urgences",
    "personnalite": "Courbaturée, désorientée temporo-spatialement, très fatiguée par une succession de gardes.",
    "phraseOuverture": "Docteur... qu'est-ce qui s'est passé ? J'étais en train de rédiger une observation en garde et je me retrouve sur ce brancard avec un goût de sang dans la bouche.",
    "pointCle": "Diagnostiquer une crise convulsive généralisée survenant dans un contexte de privation sévère de sommeil, éliminer une urgence métabolique et mettre au repos.",
    "erreurs": [
      "Laisser le soignant reprendre son travail de garde",
      "Négliger la morsure de langue"
    ],
    "elements": [
      "Morsure du bord latéral de la langue",
      "Contexte de surmenage et dette de sommeil majeure",
      "Glycémie capillaire normale",
      "Arrêt de travail et rendez-vous d'EEG"
    ]
  },
  "neuro_crise_hypoglycemique_adele.json": {
    "spec": "neurologie/psychiatrie",
    "newFile": "neuro_malaise_avec_confusion_et_crise_mlle_adele.json",
    "motif": "Malaise matinal avec confusion, sueurs et mouvements anormaux",
    "prenom": "Adèle",
    "nom": "Webber",
    "age": 62,
    "sexe": "F",
    "itemR2C": "Item 247. Diabète. Item 344. Hypoglycémie chez l'adulte.",
    "role": "Vous êtes interne aux urgences médicales.",
    "contexte": "Vous recevez Mme Adèle Webber, 62 ans, diabétique traitée par sulfamides, amenée par le SAMU pour un malaise avec agitation, sueurs froides profuses et brève crise clonique.",
    "consignes": [
      "Faire immédiatement une glycémie capillaire devant tout malaise ou crise convulsive",
      "Identifier les signes neurovégétatifs (sueurs, tachycardie) et neuroglucopéniques (confusion, crise)",
      "Administrer sans délai du resucrage adapté (G30% IV ou glucagon si accès difficile)",
      "Identifier le médicament en cause (sulfamide hypoglycémiant à demi-vie longue)",
      "Garder en observation au moins 24 à 48 heures en raison du risque de récidive de l'hypoglycémie sous sulfamides"
    ],
    "interdits": [
      "Ne pas libérer la patiente dès la normalisation de la glycémie sous sulfamides hypoglycémiants (risque de rechute mortelle)",
      "Ne pas injecter d'anticonvulsivants avant d'avoir vérifié la glycémie"
    ],
    "materiel": [
      "Lecteur de glycémie capillaire",
      "Ampoules de Glucosé à 30%",
      "Voie veineuse"
    ],
    "lieu": "Box d'accueil des urgences",
    "personnalite": "Initialement obnubilée et transpirante, puis retrouve ses esprits quelques minutes après l'injection de sucre.",
    "phraseOuverture": "Où suis-je ? J'ai chaud... j'ai sauté mon petit-déjeuner ce matin avant de prendre mes pilules pour le diabète...",
    "pointCle": "Reconnaître une crise neuroglucopénique sur hypoglycémie sévère sous sulfamide, resucrer d'urgence par G30% IV et imposer une hospitalisation de 48h de surveillance.",
    "erreurs": [
      "Autoriser la sortie précoce après resucrage sous sulfamides",
      "Considérer la patiente comme épileptique"
    ],
    "elements": [
      "Glycémie capillaire effondrée (< 2 mmol/L)",
      "Resucrage immédiat par 2 à 3 ampoules de G30% IV",
      "Arrêt définitif du sulfamide en cause",
      "Hospitalisation obligatoire pour surveillance de 24-48h"
    ]
  },
  "neuro_syndrome_cordon_posterieur_Blaise.json": {
    "spec": "neurologie/psychiatrie",
    "newFile": "neuro_troubles_sensitifs_et_marche_instable_m_blaise.json",
    "motif": "Troubles sensitifs des membres et marche instable dans le noir",
    "prenom": "Blaise",
    "nom": "Pascal",
    "age": 55,
    "sexe": "M",
    "itemR2C": "Item 93. Déficit moteur et/ou sensitif des membres. Item 274. Carence en vitamine B12.",
    "role": "Vous êtes interne en neurologie.",
    "contexte": "Vous recevez M. Blaise Pascal, 55 ans, consultant pour une instabilité croissante à la marche avec aggravation majeure dès qu'il ferme les yeux ou dans l'obscurité.",
    "consignes": [
      "Mettre en évidence une ataxie proprioceptive avec signe de Romberg positif non latéralisé (aggravation les yeux fermés)",
      "Tester la sensibilité profonde (pallanesthésie au diapason, sens de position des orteils)",
      "Rechercher un signe de Lhermitte (décharge électrique à la flexion de la nuque)",
      "Évoquer une sclérose combinée de la moelle et doser la vitamine B12 / folates",
      "Prescrire une IRM médullaire cervicale et débuter la supplémentation vitaminique précoce"
    ],
    "interdits": [
      "Ne pas administrer de folates seuls sans vitamine B12 (risque d'aggravation neurologique)",
      "Ne pas confondre avec un syndrome vestibulaire ou cérébelleux"
    ],
    "materiel": [
      "Diapason 128 Hz",
      "Marteau réflexe",
      "Pique-touche"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Précis dans sa description, angoissé à l'idée de ne plus pouvoir marcher.",
    "phraseOuverture": "Bonjour docteur, je n'arrive plus à me laver le visage sous la douche les yeux fermés sans perdre l'équilibre. J'ai l'impression d'avoir les pieds pris dans du coton.",
    "pointCle": "Identifier un syndrome cordonnal postérieur, rechercher une carence en vitamine B12 (maladie de Biermer), prescrire l'IRM médullaire et supplémenter d'urgence en B12 intramusculaire.",
    "erreurs": [
      "Donner des folates avant la vitamine B12",
      "Négliger la recherche d'une anémie macrocytaire associée"
    ],
    "elements": [
      "Signe de Romberg proprioceptif",
      "Abolition de la pallesthésie et du sens de position du gros orteil",
      "Dosage de la vitamine B12 et recherche d'anticorps anti-facteur intrinsèque",
      "Traitement par vitamine B12 injectable (hydroxocobalamine)"
    ]
  },
  "neuro_syndrome_pyramidal_traumatique_aigu_Georges.json": {
    "spec": "neurologie/psychiatrie",
    "newFile": "neuro_faiblesse_motrice_post_traumatique_m_georges.json",
    "motif": "Difficulté progressive à mobiliser le bras et la jambe droits suite à un traumatisme",
    "prenom": "Georges",
    "nom": "O'Malley",
    "age": 28,
    "sexe": "M",
    "itemR2C": "Item 93. Déficit moteur. Item 339. Traumatisme crânien.",
    "role": "Vous êtes interne aux urgences médico-chirurgicales.",
    "contexte": "Vous recevez Georges O'Malley, 28 ans, qui a subi un choc à la tête lors d'un accident de vélo il y a 4 jours et développe une lourdeur croissante de l'hémicorps droit.",
    "consignes": [
      "Mener un interrogatoire chronologique sur l'intervalle libre post-traumatique",
      "Rechercher les signes d'un syndrome pyramidal droit (déficit moteur, hyperréflexie, signe de Babinski)",
      "Dépister les signes d'hypertension intracrânienne (céphalées, vomissements en jet, bradycardie)",
      "Prescrire en urgence absolue un scanner cérébral sans injection à la recherche d'un hématome sous-dural ou extradural",
      "Alerter immédiatement l'équipe de neurochirurgie de garde"
    ],
    "interdits": [
      "Ne jamais réaliser de ponction lombaire en présence d'un déficit focal post-traumatique",
      "Ne pas banaliser un déficit moteur d'apparition secondaire"
    ],
    "materiel": [
      "Marteau réflexe",
      "Ophtalmoscope",
      "Tensiomètre",
      "Stéthoscope"
    ],
    "lieu": "Box des urgences",
    "personnalite": "Ralenti, céphalalgique, somnolent par moments, inquiet de la dégradation de sa force.",
    "phraseOuverture": "Bonjour docteur, je suis tombé de vélo il y a quatre jours. Tout allait bien au début, mais depuis hier mon bras droit et ma jambe droite sont devenus très faibles et j'ai un mal de tête terrible.",
    "pointCle": "Reconnaître un syndrome pyramidal déficitaire unilatéral post-traumatique avec intervalle libre (hématome sous-dural subaigu ou extradural tardif), scanner cérébral immédiat et avis neurochirurgical.",
    "erreurs": [
      "Négliger l'aggravation secondaire après un traumatisme crânien",
      "Retarder le scanner cérébral"
    ],
    "elements": [
      "Déficit moteur proportionnel brachio-facial et crural droit",
      "Signe de Babinski droit franc",
      "Scanner cérébral en urgence montrant une collection péricérébrale",
      "Transfert d'urgence en neurochirurgie pour évacuation"
    ]
  },
  "neuro_syndrome_pyramidal_vasculaire_ThatcherG.json": {
    "spec": "neurologie/psychiatrie",
    "newFile": "neuro_deficit_moteur_droit_brutal_m_thatcher.json",
    "motif": "Lâchage brutal d'un objet et asymétrie faciale droite chez un sujet hypertendu",
    "prenom": "Thatcher",
    "nom": "Grey",
    "age": 67,
    "sexe": "M",
    "itemR2C": "Item 341. Accidents vasculaires cérébraux.",
    "role": "Vous êtes interne en unité neuro-vasculaire (UNV).",
    "contexte": "Vous recevez M. Thatcher Grey, 67 ans, adressé par le SAMU pour un déficit moteur de l'hémicorps droit d'apparition brutale survenu il y a 90 minutes au petit-déjeuner.",
    "consignes": [
      "Préciser l'heure exacte de début des symptômes (dernière fois vu indemne)",
      "Calculer le score NIHSS et rechercher les contre-indications à la thrombolyse",
      "Vérifier la glycémie capillaire et la pression artérielle en urgence",
      "Prescrire l'IRM cérébrale en filière AVC immédiate (diffusion, FLAIR, T2*, TOF)",
      "Organiser la thrombolyse intraveineuse et/ou thrombectomie mécanique si les délais sont respectés"
    ],
    "interdits": [
      "Ne pas faire baisser brutalement la pression artérielle si elle est < 220/120 mmHg (ou < 185/110 avant thrombolyse)",
      "Ne pas retarder l'imagerie cérébrale"
    ],
    "materiel": [
      "Score NIHSS papier",
      "Lecteur glycémie",
      "Scope multiparamétrique",
      "Tensiomètre"
    ],
    "lieu": "Salle d'accueil des urgences neuro-vasculaires",
    "personnalite": "Angoissé, aphasie motrice discrète, bouche déviée, hémiplégique droit.",
    "phraseOuverture": "Docteur... mon bras... ma tasse de café est tombée tout à coup ce matin à 8 heures... et mes mots ont du mal à sortir...",
    "pointCle": "Identifier un AVC ischémique en phase hyperaiguë dans la fenêtre thérapeutique (< 4h30), acheminer vers l'IRM en urgence vitale et enclencher la revascularisation.",
    "erreurs": [
      "Banaliser le déficit brutal comme un malaise vagal",
      "Faire baisser la pression artérielle de façon intempestive"
    ],
    "elements": [
      "Calcul du score NIHSS",
      "Glycémie capillaire normale éliminant une hypoglycémie",
      "IRM cérébrale confirmant l'ischémie capsulaire ou sylvienne",
      "Thrombolyse IV par rt-PA dans les 4h30"
    ]
  },
  "neuro_syndrome_sensitif_central_cordons_posterieurs_MarieC.json": {
    "spec": "neurologie/psychiatrie",
    "newFile": "neuro_perte_equilibre_dans_obscurite_mme_marie.json",
    "motif": "Troubles de l'équilibre dans l'obscurité et maladresse des mains",
    "prenom": "Marie",
    "nom": "Curie",
    "age": 58,
    "sexe": "F",
    "itemR2C": "Item 93. Déficit moteur et/ou sensitif. Item 274. Anémie et carence B12.",
    "role": "Vous êtes interne en neurologie.",
    "contexte": "Vous recevez Mme Marie Curie, 58 ans, consultant pour des troubles sensitifs profonds des quatre membres évoluant depuis 6 mois avec chutes nocturnes.",
    "consignes": [
      "Identifier les signes d'ataxie proprioceptive centrale et le signe de Romberg franc",
      "Rechercher une glossite atrophique de Hunter et un syndrome anémique associé",
      "Dépister les antécédents d'affection auto-immune (gastrite de Biermer, vitiligo)",
      "Prescrire le dosage sérique de la vitamine B12, l'homocystéine et l'acide méthylmalonique",
      "Mettre en route la supplémentation parentérale précoce pour stopper l'évolution médullaire"
    ],
    "interdits": [
      "Ne pas attendre la survenue de paraparésie motrice irréversible pour traiter",
      "Ne pas prescrire de folates isolés sans vitamine B12"
    ],
    "materiel": [
      "Diapason",
      "Marteau réflexe",
      "Abaisse-langue"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Patiente rigoureuse, note chaque difficulté, gênée pour boutonner ses chemisiers.",
    "phraseOuverture": "Bonjour docteur, je perds l'équilibre dès qu'il fait nuit dans mon couloir. Mes doigts ne sentent plus bien les objets fins, je ne peux plus enfiler d'aiguille.",
    "pointCle": "Diagnostiquer une sclérose combinée de la moelle par carence en vitamine B12 (maladie de Biermer), confirmer par biologie et traiter sans délai par B12 IM.",
    "erreurs": [
      "Traiter comme un vieillissement normal",
      "Omettre la gastroscopie de dépistage du cancer gastrique sur Biermer"
    ],
    "elements": [
      "Perte du sens kinesthésique et de la pallesthésie",
      "Signe de Romberg proprioceptif franc",
      "Dosage B12 effondré et anticorps anti-FI positifs",
      "Injections intramusculaires de vitamine B12"
    ]
  },
  "neuro_syndrome_sensitif_peripherique_diabetique_bobR.json": {
    "spec": "neurologie/psychiatrie",
    "newFile": "neuro_paresthesies_distales_des_pieds_m_bob.json",
    "motif": "Brûlures nocturnes et picotements des deux pieds en chaussette",
    "prenom": "Bob",
    "nom": "Ross",
    "age": 61,
    "sexe": "M",
    "itemR2C": "Item 96. Neuropathies périphériques. Item 247. Diabète.",
    "role": "Vous êtes interne en médecine générale.",
    "contexte": "Vous recevez M. Bob Ross, 61 ans, diabétique de type 2 depuis 12 ans, se plaignant de douleurs de type brûlures et décharges électriques dans les deux pieds, particulièrement au coucher.",
    "consignes": [
      "Caractériser les douleurs neuropathiques à l'aide du questionnaire DN4",
      "Réaliser l'examen systématique des pieds au monofilament de Semmes-Weinstein (perte de sensibilité protectrice)",
      "Rechercher des lésions trophiques, durillons ou mal perforant plantaire débutant",
      "Prescrire un traitement spécifique de la douleur neuropathique (prégabaline, gabapentine ou duloxétine)",
      "Dispenser les règles d'or de podologie préventive chez le patient diabétique"
    ],
    "interdits": [
      "Ne pas prescrire de paracétamol ou d'AINS pour des douleurs neuropathiques pures",
      "Ne pas laisser le patient marcher pieds nus"
    ],
    "materiel": [
      "Monofilament 10g",
      "Diapason",
      "Marteau réflexe",
      "Miroir d'inspection"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Patient chaleureux, ne dort plus à cause des brûlures de pieds, le simple contact du drap lui est insupportable (allodynie).",
    "phraseOuverture": "Bonjour docteur, mes nuits sont un enfer. Mes deux pieds me brûlent comme s'ils étaient sur une plaque chauffante, et même le contact de mon drap me fait mal.",
    "pointCle": "Poser le diagnostic de neuropathie diabétique périphérique distale symétrique avec allodynie mécanique, initier un traitement neuropathique et prévenir le mal perforant plantaire.",
    "erreurs": [
      "Prescrire des antalgiques de palier 1 inefficaces",
      "Négliger l'inspection des semelles et des espaces interdigitaux"
    ],
    "elements": [
      "Score DN4 ≥ 4 confirmant la douleur neuropathique",
      "Test au monofilament montrant la perte de sensibilité",
      "Prescription d'un gabapentinoïde ou antidépresseur IRSNa",
      "Ordonnance de soins de pédicurie-podologie remboursés"
    ]
  },
  "locomoteur_arthrite_Mirko.json": {
    "spec": "locomoteur",
    "newFile": "locomoteur_gonflement_articulaire_douloureux_genou_m_mirko.json",
    "motif": "Genou droit chaud, très gonflé et douloureux jour et nuit avec fébricule",
    "prenom": "Mirko",
    "nom": "Jankovic",
    "age": 47,
    "sexe": "M",
    "itemR2C": "Item 196. Douleur et épanchement articulaire. Arthrite septique.",
    "role": "Vous êtes interne aux urgences orthopédiques / rhumatologie.",
    "contexte": "Vous recevez M. Mirko Jankovic, 47 ans, consultant pour une impotence totale du genou droit d'apparition rapide avec épanchement volumineux et température à 38.3°C.",
    "consignes": [
      "Reconnaître l'urgence diagnostique d'une monoarthrite aiguë jusqu'à preuve du contraire septique",
      "Réaliser un examen clinique complet de l'articulation (choc rotulien, chaleur, rougeur, porte d'entrée cutanée)",
      "Poser l'indication formelle et immédiate d'une ponction articulaire évacuatrice et diagnostique",
      "Prescrire l'analyse cytologique, microcristalline et bactériologique du liquide synovial",
      "Mettre en route l'antibiothérapie probabiliste adaptée uniquement APRÈS réalisation de la ponction"
    ],
    "interdits": [
      "Ne jamais débuter d'antibiothérapie avant la réalisation des prélèvements bactériologiques articulaires",
      "Ne pas infiltrer de corticoïdes en présence d'une suspicion d'arthrite septique"
    ],
    "materiel": [
      "Kit de ponction articulaire stérile",
      "Flacons pour liquide articulaire",
      "Thermomètre",
      "Stéthoscope"
    ],
    "lieu": "Box d'accueil des urgences",
    "personnalite": "Très douloureux, ne peut pas poser le pied par terre, genou fléchi à 30° antalgique.",
    "phraseOuverture": "Bonjour docteur... mon genou a gonflé d'un coup depuis hier soir. Il est brûlant, énorme, et la douleur me réveille la nuit, je ne peux plus marcher.",
    "pointCle": "Toute monoarthrite aiguë est une arthrite septique jusqu'à preuve du contraire : ponction articulaire immédiate avant tout antibiotique et avis chirurgical.",
    "erreurs": [
      "Injecter des antibiotiques avant la ponction articulaire",
      "Banaliser comme une simple poussée d'arthrose"
    ],
    "elements": [
      "Recherche du choc rotulien et de la porte d'entrée",
      "Ponction articulaire aseptique avec analyse liquide (> 50 000 leucocytes/mm³)",
      "NFS, CRP, hémocultures",
      "Antibiothérapie IV antistaphylococcique après ponction"
    ]
  },
  "locomoteur_lomboradiculalgie_robert.json": {
    "spec": "locomoteur",
    "newFile": "locomoteur_douleur_lombaire_irradiant_fesse_m_robert.json",
    "motif": "Lombalgie aiguë irradiant dans la fesse droite après un effort de soulèvement",
    "prenom": "Robert",
    "nom": "Lefèvre",
    "age": 42,
    "sexe": "M",
    "itemR2C": "Item 95. Radiculalgie et syndrome rachidien.",
    "role": "Vous êtes interne en médecine générale.",
    "contexte": "Vous recevez M. Robert Lefèvre, 42 ans, artisan, qui s'est bloqué le dos ce matin en portant un sac de ciment, avec douleur irradiant dans la fesse droite.",
    "consignes": [
      "Rechercher immédiatement les signaux d'alerte (red flags) : syndrome de la queue de cheval, déficit moteur < 3/5, fièvre, altération de l'état général",
      "Préciser le trajet de l'irradiation radiculaire (L5 ou S1)",
      "Réaliser l'examen neurologique moteur (marche sur les pointes S1 et talons L5) et sensitif",
      "Poser le principe du maintien de la mobilité sans alitement prolongé",
      "Prescrire un traitement antalgique gradué de crise (paracétamol, AINS courts)"
    ],
    "interdits": [
      "Ne pas prescrire d'imagerie (IRM ou scanner) dans les 6 premières semaines en l'absence de signe de gravité (red flags)",
      "Ne pas recommander le repos au lit strict"
    ],
    "materiel": [
      "Marteau réflexe",
      "Mètre ruban",
      "Tensiomètre"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Inquiet pour son travail d'artisan, très courbé, marche avec précaution.",
    "phraseOuverture": "Bonjour docteur, en soulevant un sac ce matin sur mon chantier, j'ai entendu un 'crac' dans le bas du dos et la douleur m'est descendue dans la fesse droite. Je suis complètement coincé.",
    "pointCle": "Identifier une lombosciatique aiguë commune sans signe de gravité (absence de déficit moteur, miction normale), rassurer, encourager la mobilisation active et éviter les examens d'imagerie inutiles.",
    "erreurs": [
      "Prescrire une IRM en urgence sans signe d'alerte",
      "Prescrire un repos strict au lit"
    ],
    "elements": [
      "Vérification des mictions (absence de syndrome de la queue de cheval)",
      "Testing moteur L5/S1 normal",
      "Absence d'indication d'imagerie en première intention",
      "Prescription d'AINS courte durée et incitation au mouvement"
    ]
  },
  "locomoteur_tendinopathie_lisa.json": {
    "spec": "locomoteur",
    "newFile": "locomoteur_douleur_anterieure_epaule_mlle_lisa.json",
    "motif": "Douleur antéro-latérale de l'épaule droite lors des mouvements en élévation",
    "prenom": "Lisa",
    "nom": "Cuddy",
    "age": 39,
    "sexe": "F",
    "itemR2C": "Item 94. Douleur d'épaule.",
    "role": "Vous êtes interne en rhumatologie / médecine physique et réadaptation.",
    "contexte": "Vous recevez Mlle Lisa Cuddy, 39 ans, pratiquante de volley-ball, se plaignant d'une douleur de l'épaule droite lors du smash et des mouvements au-dessus de la tête.",
    "consignes": [
      "Distinguer une épaule douloureuse simple (tendinopathie) d'une épaule gelée ou d'une rupture de coiffe",
      "Vérifier la conservation totale des mobilités passives de l'épaule",
      "Réaliser les manœuvres de conflit sous-acromial (Neer, Hawkins, Yocum)",
      "Tester les différents tendons de la coiffe des rotateurs (Jobe pour le supra-épineux, Patte pour les rotateurs externes)",
      "Prescrire une rééducation masso-kinésithérapique centrée sur le recentrage dynamique de la tête humérale"
    ],
    "interdits": [
      "Ne pas prescrire d'infiltration de corticoïdes en première intention chez la jeune sportive sans rééducation préalable",
      "Ne pas prescrire d'emblée une IRM sans radiographies standard préalables"
    ],
    "materiel": [
      "Goniomètre",
      "Stéthoscope"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Sportive, frustrée de ne plus pouvoir jouer au volley-ball à son niveau habituel.",
    "phraseOuverture": "Bonjour docteur, dès que je lève le bras pour smasher au volley ou pour attraper un objet en haut d'un placard, j'ai une pointe aiguë dans le haut de l'épaule droite.",
    "pointCle": "Diagnostiquer un conflit sous-acromial avec tendinopathie du supra-épineux sur épaule mobile, prescrire une radiographie standard et une rééducation kinésithérapique ciblée.",
    "erreurs": [
      "Conclure à une capsulite rétractile sans tester les mobilités passives",
      "Infiltrer d'emblée"
    ],
    "elements": [
      "Mobilités passives strictement conservées",
      "Manœuvres de conflit positives (Neer, Hawkins)",
      "Manœuvre de Jobe douloureuse mais sans déficit de force (tendinopathie non rompue)",
      "Prescription de rééducation de recentrage huméral"
    ]
  },
  "locomoteur_sciatiqueL5.json": {
    "spec": "locomoteur",
    "newFile": "locomoteur_douleur_trajet_l5_externe_m_chevalier.json",
    "motif": "Douleur irradiant de la fesse à la face latérale de la cuisse et au gros orteil",
    "prenom": "Marc",
    "nom": "Chevalier",
    "age": 45,
    "sexe": "M",
    "itemR2C": "Item 95. Radiculalgie et syndrome rachidien.",
    "role": "Vous êtes interne en rhumatologie.",
    "contexte": "Vous recevez M. Marc Chevalier, 45 ans, consultant pour une douleur lombaire basse irradiant à la face postéro-latérale de la cuisse, face latérale du genou, jambe externe et dos du pied jusqu'au gros orteil.",
    "consignes": [
      "Confirmer le trajet radiculaire L5 typique",
      "Rechercher le signe de Lasègue et mesurer l'angle d'apparition de la douleur",
      "Tester la force du muscle long extenseur de l'hallux (releveur du gros orteil) et releveurs du pied",
      "Vérifier l'absence de déficit sensitif périnéal ou de trouble sphinctérien",
      "Proposer une prise en charge médicale initiale associant repos relatif et antalgiques"
    ],
    "interdits": [
      "Ne pas négliger un déficit moteur < 3/5 imposant un avis chirurgical en urgence (sciatique paralysante)",
      "Ne pas prescrire d'emblée d'infiltration péridurale en phase très aiguë"
    ],
    "materiel": [
      "Marteau réflexe",
      "Mètre ruban",
      "Pique-touche"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Douleur intense, marche en boitant, soulagé par la position allongée jambes fléchies.",
    "phraseOuverture": "Bonjour docteur, la douleur part de mon dos, passe sur le côté de ma cuisse et descend jusqu'au-dessus de mon gros orteil. C'est comme une décharge électrique continue.",
    "pointCle": "Caractériser une lombosciatique L5 tronquée ou complète sans caractère paralysant, éliminer une sciatique hyperalgique rebelle ou syndrome de la queue de cheval, prise en charge médicale.",
    "erreurs": [
      "Méconnaître un déficit moteur du releveur du gros orteil",
      "Omettre le test de Lasègue"
    ],
    "elements": [
      "Trajet L5 typique passant par la malléole externe et le dos du pied",
      "Signe de Lasègue positif à 40°",
      "Testing moteur des releveurs normal (force 5/5)",
      "Traitement médical associant paracétamol, AINS et décontracturant musculaire"
    ]
  },
  "locomoteur_scoliose.json": {
    "spec": "locomoteur",
    "newFile": "locomoteur_deformation_du_rachis_adolescente_emma.json",
    "motif": "Asymétrie de la taille et bosse dans le dos découverte chez une adolescente",
    "prenom": "Emma",
    "nom": "Boulanger",
    "age": 13,
    "sexe": "F",
    "itemR2C": "Item 125. Boiterie et déformations rachidiennes de l'enfant.",
    "role": "Vous êtes pédiatre ou médecin généraliste.",
    "contexte": "Vous recevez Emma, 13 ans, accompagnée de son père qui a remarqué une asymétrie des plis de taille et une gibbosité lors d'un essayage de maillot de bain.",
    "consignes": [
      "Différencier une attitude scoliotique (réductible, pas de gibbosité) d'une scoliose vraie structurée avec torsion",
      "Rechercher une gibbosité lors de l'épreuve de flexion antérieure du tronc (test d'Adams)",
      "Mesurer l'équilibre du rachis au fil à plomb et la hauteur de gibbosité au scoliomètre",
      "Évaluer le potentiel de croissance résiduel (stade de Risser sur la radiographie du bassin)",
      "Prescrire une radiographie EOS du rachis complet face et profil en charge"
    ],
    "interdits": [
      "Ne pas rassurer à tort sans faire le test d'Adams en flexion",
      "Ne pas prescrire de scanner ou d'IRM sans anomalie neurologique ou scoliose atypique"
    ],
    "materiel": [
      "Fil à plomb",
      "Scoliomètre de Bunnel",
      "Toise",
      "Mètre ruban"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Adolescente réservée, complexée par son dos, père inquiet du port d'un corset.",
    "phraseOuverture": "Bonjour docteur, mon père a vu que mon dos n'était pas droit quand je me penche en avant, et un de mes côtés de taille est plus creusé que l'autre.",
    "pointCle": "Diagnostiquer une scoliose idiopathique de l'adolescente (gibbosité au test d'Adams), mesurer l'angle de Cobb sur cliché EOS, évaluer la maturation osseuse (Risser) et orienter vers un orthopédiste infantile.",
    "erreurs": [
      "Confondre scoliose vraie et attitude scoliotique par inégalité de longueur des membres inférieurs",
      "Négliger la surveillance en période de pic pubertaire"
    ],
    "elements": [
      "Test d'Adams objectivant une gibbosité thoracique droite",
      "Examen neurologique complet estrictement normal",
      "Prescription d'une radiographie du rachis total debout (système EOS)",
      "Évaluation du stade pubertaire de Tanner"
    ]
  },
  "locomoteur_canal_lombaire.json": {
    "spec": "locomoteur",
    "newFile": "locomoteur_claudication_radiculaire_a_la_marche_m_perrot.json",
    "motif": "Engourdissement et lourdeur des deux jambes survenant après 200 mètres de marche",
    "prenom": "Alain",
    "nom": "Perrot",
    "age": 69,
    "sexe": "M",
    "itemR2C": "Item 95. Radiculalgie et syndrome rachidien.",
    "role": "Vous êtes interne en rhumatologie / chirurgie du rachis.",
    "contexte": "Vous recevez M. Alain Perrot, 69 ans, se plaignant d'une faiblesse et d'engourdissements bilatéraux des membres inférieurs apparaissant à l'effort de marche et soulagés en se penchant en avant.",
    "consignes": [
      "Différencier la claudication neurogène d'une claudication artérielle (pouls périphériques présents, soulagement par la position penchée en 'caddie de supermarché')",
      "Préciser le périmètre de marche et le retentissement fonctionnel quotidien",
      "Réaliser un examen vasculaire (palpation de tous les pouls des membres inférieurs) et neurologique",
      "Prescrire l'IRM lombaire pour quantifier la sténose canalaire",
      "Proposer la stratégie thérapeutique graduée (médicale, infiltrations épidurales, chirurgie de décompression)"
    ],
    "interdits": [
      "Ne pas conclure à une AOMI sans avoir palpé les pouls périphériques",
      "Ne pas opérer d'emblée sans échec d'un traitement médical bien conduit"
    ],
    "materiel": [
      "Stéthoscope",
      "Marteau réflexe",
      "Tensiomètre"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Actif, aime promener son chien mais doit s'asseoir ou s'appuyer en avant après quelques minutes.",
    "phraseOuverture": "Bonjour docteur, dès que je marche 200 mètres, mes deux jambes deviennent lourdes et gourdes comme du bois. Mais si je m'appuie sur mon caddie penché en avant, la douleur s'en va.",
    "pointCle": "Poser le diagnostic de canal lombaire étroit (sténose canalaire lombaire) avec claudication neurogène caractéristique (signe du caddie), éliminer l'AOMI par les pouls et prescrire l'IRM lombaire.",
    "erreurs": [
      "Confondre claudication neurogène et vasculaire",
      "Omettre la palpation des pouls fémoraux, poplités et tibiaux"
    ],
    "elements": [
      "Signe du caddie présent",
      "Pouls distaux bien perçus et symétriques éliminant une AOMI",
      "Prescription IRM lombaire",
      "Infiltration épidurale de corticoïdes sous guidage radiologique"
    ]
  },
  "locomoteur_epaule_arthrose_gleno_humerale_complete.json": {
    "spec": "locomoteur",
    "newFile": "locomoteur_enraidissement_douloureux_epaule_mme_aubry.json",
    "motif": "Enraidissement douloureux mécanique et craquements de l'épaule droite depuis plusieurs années",
    "prenom": "Éliane",
    "nom": "Aubry",
    "age": 71,
    "sexe": "F",
    "itemR2C": "Item 94. Douleur d'épaule. Item 195. Arthrose.",
    "role": "Vous êtes interne en rhumatologie.",
    "contexte": "Vous recevez Mme Éliane Aubry, 71 ans, consultant pour une limitation progressive douloureuse de tous les mouvements de l'épaule droite avec craquements auditifs.",
    "consignes": [
      "Constater la limitation globale des mobilités articulaires actives ET passives",
      "Percevoir des craquements et crépitations lors de la mobilisation gléno-humérale",
      "Distinguer l'omarthrose de la capsulite rétractile par la radiographie standard",
      "Prescrire le bilan radiographique de l'épaule (face en 3 rotations et profil de Lamy)",
      "Proposer une prise en charge médicale (antalgiques, rééducation douce, viscosupplémentation ou avis chirurgical prothétique)"
    ],
    "interdits": [
      "Ne pas forcer la mobilisation passive lors des manœuvres",
      "Ne pas prescrire d'AINS au long cours sans protection gastrique chez la femme de 71 ans"
    ],
    "materiel": [
      "Goniomètre",
      "Stéthoscope",
      "Tensiomètre"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Patiente courageuse, gênée pour se coiffer et fermer son soutien-gorge.",
    "phraseOuverture": "Bonjour docteur, mon épaule droite est complètement rouillée depuis des années. Ça craque dès que je la bouge et je ne peux plus lever le bras pour me coiffer.",
    "pointCle": "Diagnostiquer une omarthrose (primitive ou secondaire), confirmer par radiographies standard montrant le pincement gléno-huméral et les ostéophytes, et adapter la prise en charge médico-chirurgicale.",
    "erreurs": [
      "Ignorer la limitation passive",
      "Négliger les radiographies standard simples au profit d'examens sophistiqués inutiles"
    ],
    "elements": [
      "Limitation passive de la rotation externe et de l'abduction",
      "Présence de bruits articulaires / craquements",
      "Radiographies de l'épaule montrant pincement, ostéophytes, condensation",
      "Kinésithérapie d'entretien des amplitudes et antalgiques adaptés"
    ]
  },
  "locomoteur_epaule_capsulite.json": {
    "spec": "locomoteur",
    "newFile": "locomoteur_blocage_passif_et_actif_epaule_mme_boucher.json",
    "motif": "Perte majeure et progressive des mobilités passive et active de l'épaule après une phase douloureuse",
    "prenom": "Sylvie",
    "nom": "Boucher",
    "age": 54,
    "sexe": "F",
    "itemR2C": "Item 94. Douleur d'épaule.",
    "role": "Vous êtes interne en médecine physique / rhumatologie.",
    "contexte": "Vous recevez Mme Sylvie Boucher, 54 ans, diabétique, qui présente depuis 4 mois un enraidissement très serré de l'épaule gauche ayant succédé à une phase très algique nocturne.",
    "consignes": [
      "Reconnaître le tableau caractéristique de capsulite rétractile (épaule gelée) avec évolution en 3 phases",
      "Objectiver la limitation symétrique des amplitudes actives ET passives, notamment de la rotation externe coude au corps (RE1 < 10°)",
      "Rechercher les terrains favorisants (diabète sucré, dysthyroïdie, stress, traumatisme minime)",
      "Rassurer sur l'évolution spontanément résolutive au bout de 12 à 24 mois",
      "Prescrire une rééducation douce infra-douloureuse et discuter une arthro-distension si besoin"
    ],
    "interdits": [
      "Ne jamais forcer en kinésithérapie sous peine d'aggraver la rétraction capsulaire",
      "Ne pas proposer de chirurgie de la coiffe sur une épaule bloquée"
    ],
    "materiel": [
      "Goniomètre",
      "Tensiomètre"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Déprimée par la durée des symptômes et le handicap pour s'habiller.",
    "phraseOuverture": "Bonjour docteur, mon épaule a d'abord été affreusement douloureuse pendant deux mois jour et nuit. Maintenant la douleur a diminué, mais mon bras est totalement bloqué, je ne peux plus écarter le coude.",
    "pointCle": "Poser le diagnostic clinique de capsulite rétractile sur la perte de rotation externe passive coude au corps, éliminer une omarthrose sur des radiographies normales, et prescrire une kinésithérapie douce sans douleur.",
    "erreurs": [
      "Prescrire une rééducation forcée douloureuse",
      "Ignorer le diabète comme facteur favorisant majeur"
    ],
    "elements": [
      "Perte quasi-totale de la rotation externe passive (RE1)",
      "Radiographies standard strictement normales",
      "Rassurance sur la bénignité et la guérison lente",
      "Balnéothérapie et rééducation douce infra-douloureuse"
    ]
  },
  "locomoteur_epaule_luxation_anterieure_complete.json": {
    "spec": "locomoteur",
    "newFile": "locomoteur_traumatisme_epaule_signe_epaulette_m_lefevre.json",
    "motif": "Impotence fonctionnelle totale et déformation de l'épaule en coup de hache externe suite à une chute",
    "prenom": "Maxime",
    "nom": "Lefèvre",
    "age": 24,
    "sexe": "M",
    "itemR2C": "Item 358. Traumatismes des membres.",
    "role": "Vous êtes interne aux urgences traumatologiques.",
    "contexte": "Vous recevez Maxime Lefèvre, 24 ans, amené après un plaquage au rugby, se tenant le bras droit en rotation externe avec déformation visible de l'épaule.",
    "consignes": [
      "Reconnaître l'attitude des traumatisés du membre supérieur (bras soutenu par la main saine)",
      "Rechercher les signes physiques pathognomoniques : signe de l'épaulette, coup de hache externe, comblement du sillon delto-pectoral",
      "Tester impérativement la sensibilité du moignon de l'épaule (nerf axillaire) et palper le pouls radial",
      "Prescrire des radiographies de l'épaule face et profil avant toute tentative de réduction",
      "Réaliser la réduction orthopédique précoce sous antalgiques suivie d'une immobilisation coude au corps"
    ],
    "interdits": [
      "Ne jamais tenter de réduction sans avoir vérifié l'intégrité du nerf axillaire et sans contrôle radiologique préalable",
      "Ne pas utiliser de manœuvre violente avec appui dans le creux axillaire"
    ],
    "materiel": [
      "Attelle coude au corps (Dujarrier)",
      "Écharpe",
      "Glace",
      "Voie veineuse antalgique"
    ],
    "lieu": "Box d'accueil des urgences",
    "personnalite": "Jeune sportif très algique, soutient précautionneusement son bras droit avec sa main gauche.",
    "phraseOuverture": "Docteur, ne me touchez pas le bras, j'ai l'épaule qui s'est déboîtée au rugby ! C'est tout déformé et je ne peux plus bouger d'un millimètre.",
    "pointCle": "Diagnostiquer une luxation gléno-humérale antéro-interne, éliminer une lésion du nerf axillaire, vérifier l'absence de fracture associée à la radiographie et réduire doucement.",
    "erreurs": [
      "Réduire sans radiographie préalable éliminant une fracture du col huméral",
      "Omettre le testing du nerf axillaire avant et après réduction"
    ],
    "elements": [
      "Signe de l'épaulette et vacuité de la glène",
      "Testing de la sensibilité du galbe deltoïdien (nerf circonflexe)",
      "Radiographie face + profil de Lamy",
      "Manœuvre de réduction douce et immobilisation 3 semaines"
    ]
  },
  "locomoteur_epaule_tendinopathie_coiffe.json": {
    "spec": "locomoteur",
    "newFile": "locomoteur_douleur_epaule_accrochage_m_gerard.json",
    "motif": "Douleur de l'épaule avec accrochage douloureux entre 60° et 120° d'abduction",
    "prenom": "Gérard",
    "nom": "Klein",
    "age": 52,
    "sexe": "M",
    "itemR2C": "Item 94. Douleur d'épaule.",
    "role": "Vous êtes interne en médecine générale.",
    "contexte": "Vous recevez M. Gérard Klein, 52 ans, peintre en bâtiment, consultant pour des douleurs de l'épaule droite le gênant lors du travail bras en l'air.",
    "consignes": [
      "Rechercher un arc douloureux d'abduction entre 60 et 120°",
      "Vérifier la liberté des mobilités passives et tester le supra-épineux par la manœuvre de Jobe",
      "Tester les rotateurs externes (infra-épineux) par la manœuvre de Patte et le sous-scapulaire par le Lift-Off",
      "Prescrire des radiographies comparatives de l'épaule",
      "Proposer une adaptation des gestes professionnels et une rééducation adaptée"
    ],
    "interdits": [
      "Ne pas négliger la déclaration en maladie professionnelle (tableau 57)",
      "Ne pas infiltrer de manière répétée sans surveillance"
    ],
    "materiel": [
      "Goniomètre",
      "Stéthoscope",
      "Tensiomètre"
    ],
    "lieu": "Cabinet médical",
    "personnalite": "Artisan courageux mais inquiet de ne plus pouvoir honorer ses chantiers de peinture.",
    "phraseOuverture": "Bonjour docteur, peindre des plafonds devient un calvaire. Dès que je monte le bras au-dessus de l'horizontale, ça coince et ça me lance violemment dans l'épaule.",
    "pointCle": "Identifier une tendinopathie de la coiffe des rotateurs liée au travail répétitif, bilan radiographique, rééducation et démarche de déclaration en maladie professionnelle.",
    "erreurs": [
      "Omettre d'évoquer la maladie professionnelle chez le peintre en bâtiment",
      "Négliger le test de force musculaire"
    ],
    "elements": [
      "Arc douloureux caractéristique",
      "Manœuvres de conflit sous-acromial positives",
      "Prescription de radiographies et échographie de l'épaule",
      "Certificat médical initial de maladie professionnelle"
    ]
  },
  "locomoteur_racHialgie.json": {
    "spec": "locomoteur",
    "newFile": "locomoteur_rachialgie_post_effort_m_francois.json",
    "motif": "Douleur aiguë médio-dorsale survenue brutalement lors du port d'une charge lourde",
    "prenom": "François",
    "nom": "Perrin",
    "age": 37,
    "sexe": "M",
    "itemR2C": "Item 95. Rachialgies.",
    "role": "Vous êtes interne en médecine générale.",
    "contexte": "Vous recevez M. François Perrin, 37 ans, déménageur, se plaignant d'un point douloureux aigu entre les deux omoplates survenu en portant un meuble lourd.",
    "consignes": [
      "Éliminer une urgence cardiovasculaire ou pleuro-pulmonaire (dissection aortique, embolie, pneumothorax)",
      "Palper les épineuses dorsales et les muscles paravertébraux (recherche de contracture en corde)",
      "Vérifier l'absence de signe neurologique médullaire (ROT vifs, clonus, signe de Babinski)",
      "Rassurer sur l'origine musculo-ligamentaire bénigne",
      "Prescrire des antalgiques, décontracturants et séances de kinésithérapie"
    ],
    "interdits": [
      "Ne pas négliger l'élimination des urgences vitales thoraciques devant une dorsalgie aiguë",
      "Ne pas prescrire de scanner systématique"
    ],
    "materiel": [
      "Stéthoscope",
      "Tensiomètre",
      "Marteau réflexe"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Très contracturé, respire superficiellement par peur de déclencher la douleur dorsale.",
    "phraseOuverture": "Bonjour docteur, je portais une armoire ce matin quand j'ai ressenti un coup de poignard entre les omoplates. Ça me bloque le dos dès que je respire fort.",
    "pointCle": "Distinguer une dorsalgie commune mécanique des urgences thoraciques viscérales graves, rassurer et traiter la contracture paravertébrale.",
    "erreurs": [
      "Ne pas prendre les constantes vitales",
      "Omettre l'auscultation cardio-pulmonaire"
    ],
    "elements": [
      "Constantes vitales normales et auscultation normale",
      "Palpation reproduisant la douleur sur le trapèze et muscles rhomboïdes",
      "Absence de signes de gravité neurologique",
      "Antalgiques de palier 1 et décontracturant musculaire"
    ]
  },
  "GYNECO_test_etat_de_choc.json": {
    "spec": "gynecologie",
    "newFile": "gyneco_metrorragies_et_douleur_pelvienne_mme_sophie.json",
    "motif": "Douleur pelvienne aiguë avec saignements noircâtres et retard de règles chez une femme jeune",
    "prenom": "Sophie",
    "nom": "Mercier",
    "age": 26,
    "sexe": "F",
    "itemR2C": "Item 343. Hémorragies génitales chez la femme. Item 345. Grossesse extra-utérine.",
    "role": "Vous êtes interne aux urgences gynécologiques.",
    "contexte": "Vous recevez Sophie Mercier, 26 ans, amenée pour une douleur brutale en fosse iliaque droite avec pâleur, vertiges et saignements génitaux peu abondants.",
    "consignes": [
      "Rechercher immédiatement les signes de choc hémorragique (tachycardie, hypotension, marbrures, soif)",
      "Faire réaliser en extrême urgence un test immunologique de grossesse ou dosage des béta-hCG",
      "Poser deux voies veineuses de gros calibre et débuter le remplissage vasculaire",
      "Appeler l'obstétricien/gynécologue de garde et l'anesthésiste pour cœlioscopie en urgence",
      "Organiser le bilan pré-opératoire complet et la commande de culots globulaires O négatif"
    ],
    "interdits": [
      "Ne jamais éliminer une grossesse extra-utérine chez une femme en âge de procréer sans dosage de béta-hCG",
      "Ne pas retarder la prise en charge chirurgicale d'une GEU rompue hémodynamiquement instable"
    ],
    "materiel": [
      "Test de grossesse urinaire rapide",
      "Moniteur multiparamétrique",
      "Cathéters 16G",
      "Solutés cristalloïdes"
    ],
    "lieu": "Salle d'accueil des urgences vitales / Urgences gynéco",
    "personnalite": "Très pâle, tachycarde à 120 bpm, TA à 85/50 mmHg, sueurs froides, repliée sur son ventre.",
    "phraseOuverture": "Docteur... j'ai une douleur atroce dans le bas-ventre à droite depuis deux heures, j'ai la tête qui tourne, je vais m'évanouir...",
    "pointCle": "Diagnostiquer une rupture de grossesse extra-utérine avec hémopéritoine massif et choc hémorragique, réanimation liquidienne immédiate et transfert au bloc pour hémostase chirurgicale.",
    "erreurs": [
      "Attendre les résultats d'une échographie différée chez une patiente en état de choc décompensé",
      "Omettre le groupe sanguin et RAI"
    ],
    "elements": [
      "Constantes vitales montrant le choc hémorragique",
      "Test de grossesse positif immédiat",
      "Remplissage vasculaire par cristalloïdes sur 2 VVP",
      "Transfert immédiat au bloc opératoire pour salpingectomie d'hémostase"
    ]
  },
  "pneumo_1.json": {
    "spec": "pneumologie",
    "newFile": "pneumo_dyspnee_d_effort_et_toux_m_lemoine.json",
    "motif": "Essoufflement d'effort progressif avec toux nocturne et gonflement des chevilles",
    "prenom": "Robert",
    "nom": "Lemoine",
    "age": 72,
    "sexe": "M",
    "itemR2C": "Item 234. Dyspnée aiguë et chronique. Item 232. Insuffisance cardiaque de l'adulte.",
    "role": "Vous êtes interne en pneumologie / médecine générale.",
    "contexte": "Vous recevez M. Robert Lemoine, 72 ans, adressé pour une dyspnée d'effort devenue invalidante au moindre pas avec toux nocturne productive.",
    "consignes": [
      "Préciser la sémiologie de la dyspnée (stade NYHA, orthopnée, dyspnée paroxystique nocturne)",
      "Distinguer l'origine respiratoire de l'origine cardiaque par l'examen clinique",
      "Rechercher les signes d'insuffisance cardiaque droite (turgescence jugulaire, reflux hépato-jugulaire, œdèmes des membres inférieurs) et gauche (râles crépitants)",
      "Prescrire la radiographie thoracique de face, l'ECG et le dosage des peptides natriurétiques (BNP / NT-proBNP)",
      "Initier le traitement déplétif par diurétiques de l'anse et programmer une échographie cardiaque transthoracique"
    ],
    "interdits": [
      "Ne pas prescrire de corticoïdes oraux ou de bronchodilatateurs seuls sans avoir éliminé une cardiopathie sous-jacente",
      "Ne pas perfuser de solutés salés"
    ],
    "materiel": [
      "Stéthoscope",
      "Tensiomètre",
      "Oxymètre de pouls"
    ],
    "lieu": "Cabinet de consultation",
    "personnalite": "Essoufflé en parlant, dort avec trois oreillers depuis deux semaines, inquiet.",
    "phraseOuverture": "Bonjour docteur, je n'arrive plus à monter le moindre escalier sans être essoufflé comme un bœuf, et la nuit je dois dormir assis sinon j'étouffe et je tousse.",
    "pointCle": "Identifier une décompensation cardiaque globale avec congestion pulmonaire et périphérique, prescrire BNP et radio thoracique, et instaurer un traitement diurétique d'urgence.",
    "erreurs": [
      "Confondre avec une simple bronchite ou exacerbation de BPCO sans examiner les jambes",
      "Omettre la recherche d'orthopnée"
    ],
    "elements": [
      "Orthopnée à 3 oreillers",
      "Râles crépitants bilatéraux ascendants et œdèmes prenant le godet",
      "Radiographie thoracique montrant cardiomégalie et surcharge alvéolo-interstitielle",
      "Prescription furosémide et échocardiographie"
    ]
  },
  "urgence_choc_anaphylactique_01.json": {
    "spec": "urgence",
    "newFile": "urgence_detresse_respiratoire_post_piqure_m_colin.json",
    "motif": "Détresse respiratoire brutale avec œdème du visage après piqûre d'hyménoptère",
    "prenom": "Thomas",
    "nom": "Colin",
    "age": 35,
    "sexe": "M",
    "itemR2C": "Item 337. Choc anaphylactique.",
    "role": "Vous êtes médecin urgentiste au SMUR / SAUV.",
    "contexte": "Vous prenez en charge Thomas Colin, 35 ans, piqué par une guêpe il y a 15 minutes, présentant un œdème de Quincke, une dyspnée laryngée et une hypotension à 70/40 mmHg.",
    "consignes": [
      "Reconnaître immédiatement un choc anaphylactique de grade 3 (atteinte respiratoire et hémodynamique)",
      "Injecter sans aucun délai l'adrénaline par voie intramusculaire (face antéro-latérale de la cuisse)",
      "Assurer la liberté des voies aériennes et administrer de l'oxygène à haut débit",
      "Mettre en place un remplissage vasculaire rapide par cristalloïdes sur VVP de gros calibre",
      "Assurer une surveillance scopique continue en soins intensifs"
    ],
    "interdits": [
      "Ne jamais différer l'injection d'adrénaline intramusculaire au profit des corticoïdes ou antihistaminiques",
      "Ne pas injecter l'adrénaline en IV directe sans dilution préalable"
    ],
    "materiel": [
      "Stylo auto-injecteur / Ampoule d'Adrénaline 1 mg",
      "Masque haute concentration",
      "Scope",
      "Voies veineuses"
    ],
    "lieu": "Salle d'accueil des urgences vitales",
    "personnalite": "Angoissé, cyanose des lèvres, voix nasonnée avec stridor inspiratoire, polypnéique.",
    "phraseOuverture": "Docteur... piqué par une guêpe... ma gorge se ferme... je ne peux plus respirer...",
    "pointCle": "Le traitement de première ligne salvateur absolu du choc anaphylactique est l'adrénaline intramusculaire immédiate (0.5 mg chez l'adulte) dans la cuisse.",
    "erreurs": [
      "Donner des corticoïdes avant l'adrénaline",
      "Ne pas surveiller le risque de réaction biphasique"
    ],
    "elements": [
      "Diagnostic d'anaphylaxie de grade 3",
      "Injection immédiate d'adrénaline IM (0.5 mg)",
      "Oxygénothérapie au masque à haute concentration",
      "Remplissage par NaCl 0.9% 1000 mL"
    ]
  },
  "urgence_demo_acr.json": {
    "spec": "urgence",
    "newFile": "urgence_inconscience_sans_pouls_adulte_m_duval.json",
    "motif": "Effondrement brutal au sol sans réaction ni respiration",
    "prenom": "Jean",
    "nom": "Duval",
    "age": 58,
    "sexe": "M",
    "itemR2C": "Item 336. Arrêt cardio-respiratoire.",
    "role": "Vous êtes médecin urgentiste intervenant en réanimation.",
    "contexte": "Vous arrivez auprès de Jean Duval, 58 ans, effondré brutalement dans le hall de l'hôpital, inerte sur le sol.",
    "consignes": [
      "Constater l'absence de conscience, l'absence de pouls carotidien et l'absence de respiration efficace (gasps)",
      "Alerter immédiatement l'équipe de réanimation et demander un défibrillateur (DAE / défibrillateur manuel)",
      "Débuter sans délai le massage cardiaque externe de haute qualité (100-120/min, 5-6 cm de profondeur)",
      "Analyser le rythme cardiaque au scope (FV / TV sans pouls vs asystolie / AESP)",
      "Délivrer un choc électrique externe immédiat si rythme défibrillable et poursuivre la RCP"
    ],
    "interdits": [
      "Ne pas interrompre les compressions thoraciques plus de 5 secondes",
      "Ne pas choquer une asystolie"
    ],
    "materiel": [
      "Défibrillateur semi-automatique ou manuel",
      "Chariot d'urgence",
      "Ambu et canule de Guedel",
      "Planche à masser"
    ],
    "lieu": "Hall des urgences",
    "typeStation": "SANS_PS_PSS",
    "personnalite": "Patient totalement aréactif, aréflexique, inconscient (mannequin de simulation).",
    "phraseOuverture": "",
    "pointCle": "Reconnaître immédiatement l'arrêt cardio-respiratoire, masser sans interruption, défibriller au plus vite si rythme choquable et injecter adrénaline/amiodarone selon les algorithmes ERC.",
    "erreurs": [
      "Retarder le massage cardiaque pour prendre la tension",
      "Interrompre les compressions de façon prolongée"
    ],
    "elements": [
      "Diagnostic d'ACR en moins de 10 secondes",
      "Alerte réanimation immédiate",
      "Compressions 30:2 à bon rythme et bonne profondeur",
      "Défibrillation précoce si FV/TV"
    ]
  },
  "urgence_demo_hemorragie.json": {
    "spec": "urgence",
    "newFile": "urgence_plaie_hemorragique_pulsatile_cuisse_m_renoir.json",
    "motif": "Saignement en jet très abondant de la cuisse après accident de tronçonneuse",
    "prenom": "Pierre",
    "nom": "Renoir",
    "age": 43,
    "sexe": "M",
    "itemR2C": "Item 338. Hémorragie aiguë et choc hémorragique.",
    "role": "Vous êtes médecin au SMUR.",
    "contexte": "Vous prenez en charge Pierre Renoir, 43 ans, bûcheron, présentant une plaie profonde de la cuisse avec saignement rouge vif pulsatile massif sur section fémorale.",
    "consignes": [
      "Réaliser immédiatement l'hémostase d'urgence par compression directe ou pose d'un garrot hémostatique tourniquet en amont",
      "Noter l'heure exacte de pose du garrot sur le front du patient",
      "Évaluer les signes de détresse hémodynamique (pâleur, polypnée, pouls filant)",
      "Mettre en place deux voies veineuses de gros calibre et réchauffer le patient (prévention de la triade létale)",
      "Alerter le déchocage pour transmission de sang total ou concentrés globulaires"
    ],
    "interdits": [
      "Ne jamais desserrer un garrot hémostatique posé sur une hémorragie artérielle sans contrôle chirurgical",
      "Ne pas laisser le patient en hypothermie"
    ],
    "materiel": [
      "Garrot tourniquet militaire",
      "Pansements compressifs hémostatiques",
      "Couverture de survie",
      "Cathéters 14G-16G"
    ],
    "lieu": "Intervention préhospitalière SMUR",
    "personnalite": "Pâle, angoissé, agité par l'hypovolémie, craint de perdre sa jambe.",
    "phraseOuverture": "Aidez-moi docteur, ça gicle de partout, je me vide de mon sang !",
    "pointCle": "Poser immédiatement un garrot hémostatique en amont sur une hémorragie artérielle de membre, prévenir la triade létale (hypothermie, coagulopathie, acidose) et transférer d'urgence au bloc.",
    "erreurs": [
      "Desserrer le garrot",
      "Perdre du temps en nettoyant la plaie avant de stopper l'hémorragie"
    ],
    "elements": [
      "Pose immédiate du garrot tourniquet efficace",
      "Heure de pose notée",
      "Remplissage modéré restrictif pour éviter la dilution",
      "Alerte Trauma Center"
    ]
  },
  "urgence_demo_obstruction.json": {
    "spec": "urgence",
    "newFile": "urgence_etouffement_brutal_au_repas_m_marceau.json",
    "motif": "Étouffement brutal au cours d'un repas avec toux inefficace",
    "prenom": "Gérard",
    "nom": "Marceau",
    "age": 60,
    "sexe": "M",
    "itemR2C": "Item 342. Corps étranger des voies aériennes supérieures.",
    "role": "Vous êtes médecin témoin dans un restaurant / service d'urgence.",
    "contexte": "Vous êtes témoin de l'étouffement aigu de M. Gérard Marceau, 60 ans, qui s'est levé en portant ses mains à son cou, incapable de parler ou de tousser.",
    "consignes": [
      "Reconnaître immédiatement l'obstruction totale des voies aériennes (pas de son, pas de toux, cyanose)",
      "Réaliser sans délai 5 claques vigoureuses dans le dos entre les deux omoplates",
      "En cas d'échec, alterner avec 5 compressions abdominales (manœuvre de Heimlich)",
      "Poursuivre les manœuvres jusqu'à expulsion du corps étranger ou perte de connaissance",
      "Si la victime devient inconsciente, débuter immédiatement la réanimation cardio-pulmonaire"
    ],
    "interdits": [
      "Ne jamais pratiquer la manœuvre de Heimlich chez le nourrisson",
      "Ne pas tenter d'extraire un corps étranger au doigt à l'aveugle"
    ],
    "materiel": [
      "Mains nues / Ambu / Pince de Magill et laryngoscope si médicalisé"
    ],
    "lieu": "Restaurant / Urgences",
    "personnalite": "Affolé, cyanosé, ne peut émettre aucun son.",
    "phraseOuverture": "",
    "pointCle": "Identifier l'asphyxie aiguë sur obstruction totale, pratiquer immédiatement 5 claques dorsales puis compressions abdominales de Heimlich jusqu'à désobstruction.",
    "erreurs": [
      "Tenter d'aller chercher le corps étranger avec les doigts à l'aveugle",
      "Donner un verre d'eau à boire"
    ],
    "elements": [
      "Diagnostic d'obstruction totale",
      "5 claques dorsales entre les omoplates",
      "Manœuvre de Heimlich bien positionnée au creux épigastrique",
      "Contrôle médical post-expulsion"
    ]
  },
  "urgence_demo_inconscient.json": {
    "spec": "urgence",
    "newFile": "urgence_coma_calme_voie_publique_m_gauthier.json",
    "motif": "Personne retrouvée allongée inerte sur le trottoir",
    "prenom": "Marc",
    "nom": "Gauthier",
    "age": 48,
    "sexe": "M",
    "itemR2C": "Item 335. Coma et troubles de la conscience.",
    "role": "Vous êtes interne au SMUR.",
    "contexte": "Vous intervenez sur la voie publique pour un homme d'environ 45-50 ans, retrouvé inconscient au sol, sans témoin.",
    "consignes": [
      "Évaluer la conscience (score de Glasgow) et vérifier la présence d'une respiration efficace",
      "Libérer les voies aériennes et placer le patient en position latérale de sécurité (PLS)",
      "Mesurer immédiatement la glycémie capillaire pour éliminer une hypoglycémie",
      "Rechercher des traumatismes associés (plaie du cuir chevelu, pupilles, rachis)",
      "Poser l'indication d'une intubation orotrachéale si Glasgow ≤ 8"
    ],
    "interdits": [
      "Ne pas mobiliser le rachis sans précaution si traumatisme suspecté",
      "Ne pas laisser un patient comateux sur le dos (risque d'inhalation bronchique)"
    ],
    "materiel": [
      "Lecteur glycémie",
      "Collier cervical",
      "Canule de Guedel",
      "Scope"
    ],
    "lieu": "Voie publique",
    "personnalite": "Inconscient, respiration régulière mais stertoreuse, ne répond pas aux ordres simples.",
    "phraseOuverture": "",
    "pointCle": "Protéger les voies aériennes d'un patient comateux qui respire (PLS), éliminer une cause métabolique réversible immédiate (dextro) et évaluer le Glasgow.",
    "erreurs": [
      "Laisser le patient sur le dos au risque d'inhalation de vomissures",
      "Omettre la glycémie capillaire"
    ],
    "elements": [
      "Calcul du score de Glasgow",
      "Mise en PLS",
      "Glycémie capillaire immédiate",
      "Surveillance neurologique et transport médicalisé"
    ]
  },
  "urgence_demo_brulure.json": {
    "spec": "urgence",
    "newFile": "urgence_brulure_chimique_bras_m_brun.json",
    "motif": "Projection accidentelle d'acide concentré sur les avant-bras",
    "prenom": "Éric",
    "nom": "Brun",
    "age": 39,
    "sexe": "M",
    "itemR2C": "Item 333. Brûlures.",
    "role": "Vous êtes médecin du travail / urgentiste.",
    "contexte": "Vous recevez Éric Brun, 39 ans, technicien de laboratoire, victime d'une projection accidentelle d'acide chlorhydrique concentré sur les deux membres supérieurs il y a 10 minutes.",
    "consignes": [
      "Retirer immédiatement les vêtements souillés avec gants de protection sans frotter",
      "Lavage abondant et prolongé à l'eau courante tiède (règle des 15 : eau à 15°C, pendant 15 minutes, à 15 cm)",
      "Évaluer la surface corporelle brûlée et la profondeur de l'atteinte cutanée",
      "Administrer un traitement antalgique adapté",
      "Vérifier le statut vaccinal antitétanique et orienter vers un centre de brûlés si nécessaire"
    ],
    "interdits": [
      "Ne jamais tenter de neutraliser un acide par une base (dégagement de chaleur destructeur)",
      "Ne pas appliquer de corps gras ou de pommade sur une brûlure chimique fraîche"
    ],
    "materiel": [
      "Douche de sécurité / eau stérile",
      "Pansements gras",
      "Gants étanches",
      "Antalgiques"
    ],
    "lieu": "Poste de secours / Urgences",
    "personnalite": "Paniqué par la douleur cuisante, craint des séquelles esthétiques et fonctionnelles.",
    "phraseOuverture": "Docteur, ça me brûle atrocement les bras, le bidon d'acide s'est renversé sur moi au travail !",
    "pointCle": "Le lavage immédiat et prolongé à grande eau est l'urgence thérapeutique absolue devant toute brûlure chimique pour diluer et stopper la pénétration de l'agent agressif.",
    "erreurs": [
      "Tenter une neutralisation chimique",
      "Arrêter le lavage à l'eau trop tôt (< 15 minutes)"
    ],
    "elements": [
      "Déshabillage avec protection du soignant",
      "Rinçage continu à l'eau courante au moins 15-20 minutes",
      "Évaluation de la surface et de la profondeur",
      "Mise à jour du vaccin antitétanique"
    ]
  },
  "urgence_demo_malaise.json": {
    "spec": "urgence",
    "newFile": "urgence_oppression_thoracique_angoissante_m_masson.json",
    "motif": "Sensation de barre constrictive dans la poitrine avec sueurs froides",
    "prenom": "Henri",
    "nom": "Masson",
    "age": 55,
    "sexe": "M",
    "itemR2C": "Item 232. Douleur thoracique aiguë. Item 339. Syndrome coronarien aigu.",
    "role": "Vous êtes urgentiste au SMUR.",
    "contexte": "Vous prenez en charge Henri Masson, 55 ans, présentant une douleur rétrosternale constrictive irradiant dans la mâchoire et le bras gauche depuis 45 minutes avec sueurs profuses.",
    "consignes": [
      "Réaliser un ECG 12 dérivations dans les 10 minutes suivant le premier contact médical",
      "Rechercher un sus-décalage du segment ST persistant (SCA ST+ / IDM)",
      "Mettre en place un monitorage scopique et poser une voie veineuse périphérique",
      "Administrer la double antiagrégation plaquettaire (Aspirine + inhibiteur P2Y12) et héparine si SCA ST+",
      "Organiser la coronarographie d'urgence (angioplastie primaire) sans délai"
    ],
    "interdits": [
      "Ne pas administrer d'AINS ou de dérivés nitrés en cas d'infarctus du ventricule droit ou hypotension",
      "Ne pas attendre le résultat des troponines si l'ECG montre un sus-décalage ST"
    ],
    "materiel": [
      "Électrocardiographe 12D",
      "Défibrillateur et scope",
      "Aspirine IV",
      "Anticoagulants"
    ],
    "lieu": "Domicile du patient (SMUR)",
    "personnalite": "Pâle, anxieux, angoisse de mort imminente, main crispée sur la poitrine (signe de Levin).",
    "phraseOuverture": "Docteur, j'ai l'impression d'avoir un étau d'une tonne qui me broie la poitrine et ça monte dans mes dents... je ne vais pas tenir...",
    "pointCle": "Diagnostiquer un syndrome coronarien aigu avec sus-décalage du segment ST (SCA ST+), enclencher la filière d'angioplastie primaire immédiate en salle de coronarographie.",
    "erreurs": [
      "Attendre le dosage des troponines devant un sus-décalage ST évident",
      "Retarder le transfert vers la salle de cathétérisme"
    ],
    "elements": [
      "ECG 12 dérivations réalisé en moins de 10 min",
      "Identification de l'onde de Pardee (sus-décalage ST)",
      "Prise en charge hémodynamique et antalgique",
      "Transport médicalisé direct en salle de coronarographie"
    ]
  },
  "urgence_choc_hemorragique_art_membre.json": {
    "spec": "urgence",
    "newFile": "urgence_plaie_arterielle_membre_inferieur_m_picard.json",
    "motif": "Plaie profonde de la cuisse avec saignement rouge vif pulsatile",
    "prenom": "David",
    "nom": "Picard",
    "age": 37,
    "sexe": "M",
    "itemR2C": "Item 338. Hémorragie aiguë et choc hémorragique.",
    "role": "Vous êtes médecin au déchocage / SMUR.",
    "contexte": "Vous recevez David Picard, 37 ans, victime d'un accident de disqueuse ayant sectionné l'artère fémorale superficielle, avec choc hémorragique compensé.",
    "consignes": [
      "Vérifier et maintenir l'hémostase mécanique (garrot ou pansement compressif)",
      "Monitorer les constantes vitales et la pression artérielle pulsée",
      "Mettre en place deux abords veineux de fort calibre et réchauffer",
      "Déclencher le protocole de transfusion massive (CGR, PFC, plaquettes en ratio 1:1:1)",
      "Acheminer en urgence au bloc opératoire pour hémostase et revascularisation vasculaire"
    ],
    "interdits": [
      "Ne pas pratiquer un remplissage excessif qui désamorcerait le caillot (hypotension permissive visée : PAS 80-90 mmHg)",
      "Ne pas retarder le geste chirurgical"
    ],
    "materiel": [
      "Garrot tourniquet",
      "Chauffe-solutés",
      "Transfuseur rapide",
      "Scope"
    ],
    "lieu": "Salle de déchocage",
    "personnalite": "Pâle, soif intense, sueurs, tachycardie à 125 bpm.",
    "phraseOuverture": "Docteur, j'ai froid... j'ai tellement soif... la disqueuse m'a dérapé dans la cuisse...",
    "pointCle": "Prise en charge du choc hémorragique traumatique par contrôle mécanique du saignement, hypotension permissive, réchauffement et transfusion équilibrée.",
    "erreurs": [
      "Normaliser brutalement la PA avant hémostase chirurgicale (rupture du caillot)",
      "Négliger l'hypothermie"
    ],
    "elements": [
      "Contrôle du garrot fémoral",
      "Stratégie de réanimation hémostatique",
      "Hypotension permissive",
      "Avis chirurgical vasculaire immédiat"
    ]
  },
  "urgence_brulure_thermique_etendue.json": {
    "spec": "urgence",
    "newFile": "urgence_brulure_eau_bouillante_tronc_mme_lucas.json",
    "motif": "Brûlure thermique étendue du thorax et des membres inférieurs",
    "prenom": "Élodie",
    "nom": "Lucas",
    "age": 29,
    "sexe": "F",
    "itemR2C": "Item 333. Brûlures.",
    "role": "Vous êtes interne en réanimation des brûlés.",
    "contexte": "Vous recevez Mme Élodie Lucas, 29 ans, brûlée sur 25% de surface corporelle suite au renversement d'une marmite d'eau bouillante.",
    "consignes": [
      "Calculer la surface corporelle brûlée selon la règle des 9 de Wallace",
      "Calculer le remplissage liquidien des premières 24 heures selon la formule de Parkland ou de Baxter (ex. 2 à 4 mL x kg x %SCB)",
      "Perfuser la moitié du volume calculé dans les 8 premières heures suivant la brûlure",
      "Prévenir l'hypothermie par emballage stérile sec et couverture thermique",
      "Assurer une analgésie multimodale intraveineuse puissante avec titrage morphinique"
    ],
    "interdits": [
      "Ne pas appliquer de glace ou d'eau froide prolongée sur une brûlure > 10% (risque d'hypothermie grave)",
      "Ne pas sous-estimer les pertes liquidiennes"
    ],
    "materiel": [
      "Champs stériles pour brûlés",
      "Ringer Lactate",
      "Pousse-seringue morphinique",
      "Sonde urinaire"
    ],
    "lieu": "Box de déchocage",
    "personnalite": "Hurle de douleur, frissonnante, couverte de phlyctènes rompues.",
    "phraseOuverture": "Aidez-moi ! J'ai tellement mal, ça me brûle partout sur le ventre et les jambes !",
    "pointCle": "Calculer la surface cutanée brûlée (Wallace), appliquer le remplissage de Parkland au Ringer Lactate et prévenir l'hypothermie chez le grand brûlé.",
    "erreurs": [
      "Refroidir à l'eau glacée une grande surface corporelle",
      "Sous-doser l'analgésie"
    ],
    "elements": [
      "Calcul précis de la surface brûlée (25%)",
      "Formule de Parkland au Ringer Lactate",
      "Sondage vésical pour surveillance de la diurèse horaire (cible 0.5 mL/kg/h)",
      "Titrage morphinique IV"
    ]
  },
  "urgence_arret_cardiaque_sportive.json": {
    "spec": "urgence",
    "newFile": "urgence_effondrement_brutal_terrain_sport_mlle_clara.json",
    "motif": "Effondrement inopiné d'une sportive de 22 ans sur un terrain de sport",
    "prenom": "Clara",
    "nom": "Dumont",
    "age": 22,
    "sexe": "F",
    "itemR2C": "Item 336. Arrêt cardio-respiratoire. Item 233. Mort subite.",
    "role": "Vous êtes médecin du sport / urgentiste présent sur le complexe sportif.",
    "contexte": "Clara, 22 ans, s'effondre sans contact lors d'un match de handball, inerte sur le parquet.",
    "consignes": [
      "Reconnaître immédiatement la mort subite de l'adulte jeune",
      "Demander immédiatement le DAE du gymnase et faire appeler le 15",
      "Démarrer les compressions thoraciques sans délai",
      "Poser les électrodes du DAE et délivrer le choc électrique si fibrillation ventriculaire",
      "Reprendre immédiatement le massage pendant 2 minutes après le choc avant toute réévaluation"
    ],
    "interdits": [
      "Ne pas perdre de temps à chercher un pouls si la victime ne respire pas",
      "Ne pas retirer les électrodes du DAE"
    ],
    "materiel": [
      "Défibrillateur automatisé externe (DAE)",
      "Chronomètre",
      "Téléphone 15"
    ],
    "lieu": "Terrain de sport",
    "typeStation": "SANS_PS_PSS",
    "personnalite": "Inconsciente, aucun mouvement, mannequin de réanimation.",
    "phraseOuverture": "",
    "pointCle": "La survie d'une mort subite du sportif repose sur la défibrillation ultra-précoce dans les 3 minutes et le massage cardiaque ininterrompu.",
    "erreurs": [
      "Attendre les secours pour masser",
      "Interrompre les compressions après la délivrance du choc sans masser"
    ],
    "elements": [
      "Alerte et demande du DAE",
      "Massage cardiaque continu immédiat",
      "Délivrance rapide du premier choc",
      "Enquête étiologique ultérieure (cardiomyopathie, canalopathie)"
    ]
  },
  "urgence_obstruction_voa_nourrisson.json": {
    "spec": "urgence",
    "newFile": "urgence_cyanose_et_toux_inefficace_nourrisson_leo.json",
    "motif": "Suffocation brutale avec cyanose péribuccale chez un nourrisson de 10 mois",
    "prenom": "Léo",
    "nom": "Fabre",
    "age": 0.8,
    "sexe": "M",
    "itemR2C": "Item 342. Corps étranger des voies aériennes supérieures de l'enfant.",
    "role": "Vous êtes pédiatre / urgentiste.",
    "contexte": "Léo, 10 mois, s'étouffe brutalement sur sa chaise haute en avalant un morceau de carotte crue, il ne pleure plus et devient bleu.",
    "consignes": [
      "Reconnaître l'obstruction complète chez le nourrisson (apnée, aphonie, cyanose)",
      "Installer le nourrisson à califourchon sur l'avant-bras tête vers le bas, maintenant la mâchoire",
      "Délivrer 5 tapes dans le dos entre les omoplates avec le plat de la main (manœuvre de Mofenson)",
      "Retourner le nourrisson et pratiquer 5 compressions thoraciques avec deux doigts sur le sternum",
      "Répéter le cycle jusqu'à expulsion ou perte de connaissance"
    ],
    "interdits": [
      "Ne jamais réaliser de manœuvre de Heimlich abdominale chez le nourrisson (risque de rupture hépatique)",
      "Ne pas faire de balayage digital aveugle dans la bouche"
    ],
    "materiel": [
      "Mannequin nourrisson",
      "Aspiration pédiatrique",
      "Laryngoscope pédiatrique"
    ],
    "lieu": "Urgences pédiatriques",
    "typeStation": "SANS_PS_PSS",
    "personnalite": "Nourrisson cyanosé, aphone, ne pleure plus.",
    "phraseOuverture": "",
    "pointCle": "La manœuvre de Mofenson (5 claques dorsales tête en bas puis 5 compressions thoraciques) est la seule méthode d'urgence recommandée chez le nourrisson < 1 an.",
    "erreurs": [
      "Faire des compressions abdominales de Heimlich chez un bébé",
      "Secouer le nourrisson"
    ],
    "elements": [
      "Installation sécurisée tête déclive",
      "5 claques dorsales bien dosées",
      "5 compressions thoraciques sternales",
      "Vérification visuelle de la bouche sans geste aveugle"
    ]
  },
  "urgence_noyade_piscine.json": {
    "spec": "urgence",
    "newFile": "urgence_submersion_et_troubles_conscience_jeune_alex.json",
    "motif": "Enfant repêché inanimé au fond d'une piscine après submersion",
    "prenom": "Alex",
    "nom": "Morel",
    "age": 7,
    "sexe": "M",
    "itemR2C": "Item 334. Noyade.",
    "role": "Vous êtes médecin au SMUR.",
    "contexte": "Alex, 7 ans, a été retrouvé au fond de la piscine familiale après un temps d'immersion estimé à 3 minutes, hypotherme et comateux.",
    "consignes": [
      "Reconnaître un stade 3 ou 4 de noyade (détresse respiratoire, troubles de la conscience, hypoxie)",
      "Débuter par 5 insufflations de sauvetage avant le massage cardiaque si arrêt (spécificité de l'arrêt hypoxique)",
      "Sécuriser l'axe tête-cou-tronc si plongeon ou traumatisme suspecté",
      "Lutter activement contre l'hypothermie par réchauffement externe passif et actif",
      "Poser l'indication de l'intubation trachéale avec ventilation en PEP"
    ],
    "interdits": [
      "Ne pas tenter de vider l'eau des poumons par des compressions abdominales",
      "Ne jamais déclarer un noyé hypotherme décédé avant réchauffement normotherme"
    ],
    "materiel": [
      "Respirateur de transport",
      "Scope",
      "Thermomètre œsophagien ou tympanique basse température",
      "Couverture chauffante"
    ],
    "lieu": "Bord de piscine / SMUR",
    "typeStation": "SANS_PS_PSS",
    "personnalite": "Enfant inconscient, cyanosé, encombré de mousse blanchâtre trachéale.",
    "phraseOuverture": "",
    "pointCle": "Dans l'arrêt sur noyade, l'hypoxie est première : priorité aux insufflations de sauvetage initiales et à la lutte contre l'hypothermie majeure.",
    "erreurs": [
      "Retarder la ventilation",
      "Arrêter la réanimation chez un enfant en hypothermie profonde sans réchauffement"
    ],
    "elements": [
      "5 insufflations premières au ballon",
      "Aspiration de l'écume buccale",
      "Réchauffement progressif",
      "Hospitalisation obligatoire en réanimation pédiatrique"
    ]
  },
  "urgence_malaise_traumatisme_rachidien.json": {
    "spec": "urgence",
    "newFile": "urgence_accident_voie_publique_cervicalgie_m_marchand.json",
    "motif": "Conducteur incarcéré après choc frontal avec violentes douleurs cervicales",
    "prenom": "Stéphane",
    "nom": "Marchand",
    "age": 41,
    "sexe": "M",
    "itemR2C": "Item 339. Traumatismes du rachis. Item 330. Prise en charge du polytraumatisé.",
    "role": "Vous êtes médecin du SMUR intervenant en désincarcération.",
    "contexte": "Vous prenez en charge M. Stéphane Marchand, 41 ans, conducteur ceinturé ayant percuté un platane à 80 km/h, conscient mais se plaignant d'une cervicalgie intense et de fourmillements dans les mains.",
    "consignes": [
      "Maintenir l'axe tête-cou-tronc en position neutre dès le premier contact",
      "Poser un collier cervical rigide adapté à la morphologie",
      "Évaluer le niveau sensitivo-moteur neurologique (tétraparésie débutante)",
      "Organiser l'extraction sur plan dur avec matelas coquille à dépression",
      "Transférer en Trauma Center pour scanner corps entier (pan-scanner)"
    ],
    "interdits": [
      "Ne jamais mobiliser le cou en flexion ou rotation",
      "Ne pas retirer le collier cervical sans imagerie complète"
    ],
    "materiel": [
      "Collier cervical rigide",
      "Plan dur",
      "Matelas coquille à dépression (MID)",
      "Scope"
    ],
    "lieu": "Lieu de l'accident",
    "personnalite": "Anxieux, conscient, a peur d'être paralysé, n'ose pas bouger la tête.",
    "phraseOuverture": "Docteur, mon cou me fait horriblement mal et j'ai des fourmis dans le bout des doigts, ne me bougez pas la tête s'il vous plaît...",
    "pointCle": "Immobilisation stricte de l'axe rachidien par collier rigide et matelas coquille, détection des signes de choc neurogénique et pan-scanner en Trauma Center.",
    "erreurs": [
      "Mobiliser la tête sans maintien dans l'axe",
      "Omettre l'examen de la motricité des extrémités"
    ],
    "elements": [
      "Maintien de l'axe neutre",
      "Collier cervical rigide bien ajusté",
      "Évacuation sur matelas coquille",
      "Bilan lésionnel au pan-scanner"
    ]
  },
  "urgence_trauma_cranien_grave.json": {
    "spec": "urgence",
    "newFile": "urgence_chute_velo_traumatisme_cranien_m_rolland.json",
    "motif": "Cycliste renversé sans casque présentant un coma avec asymétrie pupillaire",
    "prenom": "Christophe",
    "nom": "Rolland",
    "age": 31,
    "sexe": "M",
    "itemR2C": "Item 339. Traumatisme crânien grave.",
    "role": "Vous êtes médecin urgentiste en réanimation / SMUR.",
    "contexte": "Vous prenez en charge Christophe Rolland, 31 ans, percuté à vélo par un véhicule, inconscient au sol avec Glasgow à 7 et mydriase droite aréactive.",
    "consignes": [
      "Reconnaître un traumatisme crânien grave (Glasgow ≤ 8) avec engagement temporal imminent (mydriase unilatérale)",
      "Procéder immédiatement à l'intubation orotrachéale en séquence rapide (ISR) avec maintien du rachis",
      "Lutter contre les agressions cérébrales secondaires d'origine systémique (ACSOS) : normoxie, normocapnie, PAM ≥ 80 mmHg",
      "Administrer un agent osmotique (Mannitol ou NaCl hypertonique) en cas d'engagement",
      "Alerter le déchocage neurochirurgical et réaliser le scanner cérébral en urgence absolue"
    ],
    "interdits": [
      "Ne pas hyperventiler de manière excessive (risque d'ischémie cérébrale par vasoconstriction)",
      "Ne pas laisser chuter la pression artérielle"
    ],
    "materiel": [
      "Matériel d'intubation difficile",
      "Médicaments d'ISR (kétamine, étomidate, célocurine)",
      "Mannitol 20%",
      "Scope"
    ],
    "lieu": "Filière déchocage / SMUR",
    "typeStation": "SANS_PS_PSS",
    "personnalite": "Comateux, GCS 7 (Y1 V2 M4), anisocorie avec mydriase droite.",
    "phraseOuverture": "",
    "pointCle": "Intubation trachéale d'urgence en ISR pour tout traumatisé crânien avec Glasgow ≤ 8, contrôle strict des ACSOS et évacuation neurochirurgicale immédiate.",
    "erreurs": [
      "Laisser s'installer une hypotension artérielle ou une hypoxie",
      "Retarder la prise en charge neurochirurgicale de l'engagement"
    ],
    "elements": [
      "Intubation en séquence rapide avec protection axiale",
      "Contrôle des ACSOS (SpO2 > 95%, EtCO2 35-40)",
      "Osmothérapie par Mannitol pour la mydriase",
      "Scanner cérébral en urgence vitale"
    ]
  },
  "urgence_obstruction_voa_adulte_restaurant.json": {
    "spec": "urgence",
    "newFile": "urgence_asphyxie_aigue_au_restaurant_m_prevost.json",
    "motif": "Adulte portant brutalement les mains à son cou en mangeant de la viande",
    "prenom": "Bernard",
    "nom": "Prévost",
    "age": 52,
    "sexe": "M",
    "itemR2C": "Item 342. Obstruction aiguë des voies aériennes de l'adulte.",
    "role": "Vous êtes médecin urgentiste présent sur les lieux.",
    "contexte": "M. Bernard Prévost, 52 ans, s'asphyxie brutalement en mangeant un morceau de viande, il est debout, aphone, les yeux exorbités.",
    "consignes": [
      "Poser la question : 'Est-ce que vous vous étouffez ?' et constater l'incapacité totale à parler ou tousser",
      "Délivrer sans attendre 5 claques vigoureuses entre les omoplates avec le talon de la main",
      "En cas d'échec, se placer derrière la victime et effectuer 5 compressions abdominales vigoureuses vers le haut et l'arrière (Heimlich)",
      "Répéter les cycles 5 claques / 5 compressions jusqu'à désobstruction",
      "Surveiller les suites et examiner l'abdomen après la manœuvre"
    ],
    "interdits": [
      "Ne pas tenter de donner à boire",
      "Ne pas mettre les doigts dans la bouche à l'aveugle"
    ],
    "materiel": [
      "Mains nues / Tensiomètre et stéthoscope de contrôle"
    ],
    "lieu": "Salle de restaurant / Urgences",
    "personnalite": "En détresse vitale aiguë, regarde avec terreur, porte ses mains au cou.",
    "phraseOuverture": "",
    "pointCle": "Reconnaître l'asphyxie complète chez l'adulte, agir immédiatement par claques dorsales puis compressions de Heimlich avant l'arrêt cardiaque hypoxique.",
    "erreurs": [
      "Taper mollement dans le dos sans pencher la victime en avant",
      "Retarder l'action"
    ],
    "elements": [
      "Reconnaissance de l'obstruction complète",
      "5 claques dorsales penché en avant",
      "5 compressions de Heimlich efficaces",
      "Contrôle médical post-réanimation"
    ]
  },
  "urgence_inconscient_pls_bar.json": {
    "spec": "urgence",
    "newFile": "urgence_coma_ethylique_inconscient_voie_publique_m_fabre.json",
    "motif": "Jeune homme retrouvé comateux à la sortie d'un bar avec encombrement respiratoire",
    "prenom": "Guillaume",
    "nom": "Fabre",
    "age": 23,
    "sexe": "M",
    "itemR2C": "Item 335. Coma. Item 324. Intoxication alcoolique aiguë.",
    "role": "Vous êtes interne au SMUR.",
    "contexte": "Vous recevez Guillaume Fabre, 23 ans, étudiant, retrouvé inconscient sur le trottoir à 3h du matin devant un bar, souillé de vomissements.",
    "consignes": [
      "Évaluer les fonctions vitales et le score de Glasgow",
      "Assurer la perméabilité des voies aériennes par aspiration et mise en Position Latérale de Sécurité (PLS)",
      "Doser immédiatement la glycémie capillaire pour exclure une hypoglycémie éthylique",
      "Rechercher un traumatisme crânien passé inaperçu (palpation du scalp, pupilles)",
      "Prévenir l'hypothermie et surveiller la détoxication sous monitorage continu"
    ],
    "interdits": [
      "Ne pas laisser le patient sur le dos en cuvaison sans surveillance (risque de syndrome de Mendelson mortel)",
      "Ne pas banaliser un coma sans avoir éliminé une cause traumatique"
    ],
    "materiel": [
      "Aspirateur de mucosités",
      "Lecteur glycémie",
      "Scope",
      "Couverture"
    ],
    "lieu": "Voie publique / Box de déchocage",
    "personnalite": "Comateux, odeur d'alcool, encombré de sécrétions, réagit faiblement aux stimulations vigoureuses.",
    "phraseOuverture": "",
    "pointCle": "Protéger les voies aériennes par la PLS chez tout patient comateux qui respire, éliminer une hypoglycémie ou un hématome intracrânien post-chute.",
    "erreurs": [
      "Laisser le patient en décubitus dorsal risquant l'inhalation bronchique",
      "Omettre la glycémie capillaire"
    ],
    "elements": [
      "Mise en PLS immédiate",
      "Aspiration oropharyngée",
      "Glycémie capillaire (dépistage de l'hypoglycémie éthylique)",
      "Examen du scalp recherchant un hématome"
    ]
  },
  "urgence_trauma_membre_amputation.json": {
    "spec": "urgence",
    "newFile": "urgence_amputation_traumatique_doigt_m_blanchard.json",
    "motif": "Section complète de l'index droit par lame de scie circulaire",
    "prenom": "Romain",
    "nom": "Blanchard",
    "age": 34,
    "sexe": "M",
    "itemR2C": "Item 358. Traumatismes des membres.",
    "role": "Vous êtes interne aux urgences de la main (centre SOS Main).",
    "contexte": "Vous recevez Romain Blanchard, 34 ans, menuisier, victime d'une amputation nette de l'index droit au travail il y a 45 minutes.",
    "consignes": [
      "Prendre en charge le moignon : pansement compressif hémostatique, pas de garrot serré prolongé, surélévation",
      "Conditionner le fragment amputé : emballé dans des compresses stériles sèches, placé dans un sac plastique étanche, lui-même déposé sur un lit de glace (pas de contact direct avec l'eau ou la glace)",
      "Mettre le patient à jeun en vue d'une réimplantation sous anesthésie générale",
      "Vérifier la vaccination antitétanique et débuter une antibioprophylaxie",
      "Transférer en extrême urgence vers le centre SOS Main le plus proche"
    ],
    "interdits": [
      "Ne jamais plonger le segment amputé directement dans l'eau ou sur la glace vive (brûlure thermique et macération destructrice)",
      "Ne pas mettre de garrot artériel serré si un pansement compressif suffit"
    ],
    "materiel": [
      "Compresses stériles sèches",
      "Sacs plastiques étanches",
      "Glace et eau",
      "Attelle"
    ],
    "lieu": "Box d'accueil des urgences",
    "personnalite": "Pâle, choqué, tient son poignet serré, terrifié de perdre son doigt et son métier.",
    "phraseOuverture": "Docteur, ma scie a dérapé, mon doigt s'est coupé net ! J'ai apporté le morceau, dites-moi que vous pouvez le recoudre !",
    "pointCle": "Conditionnement parfait du segment amputé (au sec, sac étanche posé sur glace) pour permettre une réimplantation microchirurgicale dans les 6 heures.",
    "erreurs": [
      "Plonger le doigt amputé directement dans la glace ou l'eau",
      "Laisser le patient boire ou manger retardant le bloc"
    ],
    "elements": [
      "Conditionnement du fragment au sec sur lit de glace",
      "Pansement hémostatique du moignon",
      "Patient mis à jeun",
      "Contact immédiat avec le chirurgien de garde SOS Main"
    ]
  },
  "urgence_choc_septique_pediatrique.json": {
    "spec": "urgence",
    "newFile": "urgence_lethargie_et_purpura_enfant_noah.json",
    "motif": "Enfant de 3 ans fébrile à 40°C, prostré avec taches ecchymotiques",
    "prenom": "Noah",
    "nom": "Lambert",
    "age": 3,
    "sexe": "M",
    "itemR2C": "Item 148. Méningites et purpura fulminans. Item 348. Sepsis de l'enfant.",
    "role": "Vous êtes pédiatre / urgentiste au SMUR pédiatrique.",
    "contexte": "Vous recevez Noah, 3 ans, fébrile à 40.2°C depuis 12h, présentant un temps de recoloration cutanée à 4 secondes, somnolent, avec apparition de deux éléments purpuriques ecchymotiques sur les cuisses ne s'effaçant pas à la vitropression.",
    "consignes": [
      "Reconnaître l'urgence vitale absolue de Purpura Fulminans / choc septique à méningocoque",
      "Injecter immédiatement sans attendre l'hospitalisation ni aucun examen une dose de Ceftriaxone ou Céfotaxime IV ou IM",
      "Remplissage vasculaire rapide par cristalloïdes (20 mL/kg en 15-20 min)",
      "Mettre en place une oxygénothérapie et monitorage scopique",
      "Organiser l'alerte sanitaire (signalement ARS) et la prophylaxie des sujets contacts (rifampicine)"
    ],
    "interdits": [
      "Ne jamais retarder l'injection d'antibiotique pour réaliser une ponction lombaire ou un bilan biologique",
      "Ne jamais réaliser de ponction lombaire en présence d'un purpura fulminans ou choc septique"
    ],
    "materiel": [
      "Ceftriaxone injectable",
      "Cathéter de gros calibre ou aiguille intra-osseuse",
      "Sérum physiologique",
      "Verre de montre pour vitropression"
    ],
    "lieu": "Box de réanimation pédiatrique",
    "personnalite": "Enfant prostré, geignard, yeux cernés, marbré, parents en larmes de panique.",
    "phraseOuverture": "Docteur, notre petit garçon ne réagit presque plus depuis ce matin, et regardez ces taches bleues qui sont sorties sur ses jambes !",
    "pointCle": "Tout purpura nécrotique ou ecchymotique fébrile chez l'enfant est un purpura fulminans imposant une antibiothérapie parentérale immédiate (C3G) avant toute chose.",
    "erreurs": [
      "Tenter une ponction lombaire retardant l'antibiothérapie ou risquant un arrêt",
      "Attendre les résultats de laboratoire pour injecter la ceftriaxone"
    ],
    "elements": [
      "Test de la vitropression confirmant le purpura",
      "Injection immédiate de Ceftriaxone 100 mg/kg",
      "Remplissage vasculaire 20 mL/kg",
      "Signalement sans délai à l'ARS pour antibioprophylaxie des contacts"
    ]
  },
  "urgence_asthme_aigu_grave.json": {
    "spec": "urgence",
    "newFile": "urgence_detresse_respiratoire_aigue_majeure_mme_besson.json",
    "motif": "Crise d'étouffement avec silence auscultatoire et impossibilité de parler",
    "prenom": "Valérie",
    "nom": "Besson",
    "age": 32,
    "sexe": "F",
    "itemR2C": "Item 234. Dyspnée aiguë. Item 354. Détresse respiratoire aiguë / Asthme aigu grave.",
    "role": "Vous êtes médecin urgentiste en SAUV.",
    "contexte": "Vous recevez Valérie Besson, 32 ans, asthmatique connue, amenée par le SAMU en détresse respiratoire critique avec tirage intercostal et silence auscultatoire aux deux bases.",
    "consignes": [
      "Reconnaître les signes de gravité extrême de l'asthme aigu grave (silence auscultatoire, cyanose, tachycardie > 120 bpm, impossibilité de prononcer 3 mots)",
      "Débuter immédiatement l'oxygénothérapie à fort débit pour viser une SpO2 > 94%",
      "Administrer des aérosols de bronchodilatateurs à haute dose en continu : Salbutamol (5 mg) + Ipratropium (0.5 mg) sous 6-8 L/min d'O2",
      "Injecter une corticothérapie par voie générale (méthylprednisolone 1 mg/kg)",
      "Prévoir du sulfate de magnésium IV et préparer le matériel d'intubation si signes d'épuisement"
    ],
    "interdits": [
      "Ne jamais administrer de sédatifs à une patiente en crise d'asthme aigu",
      "Ne pas retarder les aérosols pour faire une radiographie"
    ],
    "materiel": [
      "Nébuliseur d'aérosol avec raccord O2",
      "Salbutamol et Ipratropium",
      "Corticoïdes injectables",
      "Scope multiparamétrique"
    ],
    "lieu": "Salle d'accueil des urgences vitales",
    "personnalite": "Épuisée, sueurs, assise penchée en avant, répond par signes de tête, ne peut pas finir une phrase.",
    "phraseOuverture": "J'étouffe... ma ventoline... ne marche plus...",
    "pointCle": "Identifier l'asthme aigu grave menaçant le pronostic vital, aérosols combinés bêta-2 mimétiques forts + anticholinergiques en continu sous oxygène et corticoïdes IV.",
    "erreurs": [
      "Interpréter à tort le silence auscultatoire comme une amélioration (c'est le signe d'un collapsus alvéolaire critique)",
      "Donner un anxiolytique"
    ],
    "elements": [
      "Diagnostic d'asthme aigu grave avec signes de lutte",
      "Aérosol de Salbutamol 5 mg + Ipratropium 0.5 mg",
      "Corticothérapie systémique précoce",
      "Surveillance rapprochée en soins intensifs"
    ]
  },
  "urgence_overdose_opiaces.json": {
    "spec": "urgence",
    "newFile": "urgence_coma_hypoventilation_myosis_m_fleury.json",
    "motif": "Coma profond avec fréquence respiratoire à 6 par minute et myosis punctiforme",
    "prenom": "Damien",
    "nom": "Fleury",
    "age": 28,
    "sexe": "M",
    "itemR2C": "Item 335. Coma. Item 324. Surdosage aux opioïdes.",
    "role": "Vous êtes médecin du SMUR.",
    "contexte": "Vous intervenez dans un squat pour Damien Fleury, 28 ans, retrouvé comateux avec des seringues à proximité, présentant une bradypnée sévère à 6/min et des pupilles en myosis serré.",
    "consignes": [
      "Reconnaître la triade du toxidrome opioïde : coma calme, bradypnée/hypoventilation sévère, myosis punctiforme",
      "Ventiler immédiatement au masque et ballon avec oxygène pour corriger l'hypoxie",
      "Administrer l'antidote spécifique : Naloxone (Narcan) par titrage intraveineux ou intranasal progressif",
      "Viser la reprise d'une fréquence respiratoire efficace sans provoquer de syndrome de sevrage brutal aigu",
      "Surveiller en milieu hospitalier pendant au moins 4 à 6 heures en raison de la demi-vie courte de la naloxone"
    ],
    "interdits": [
      "Ne pas injecter une dose massive de naloxone d'un coup chez un patient dépendant (risque de syndrome de sevrage hyperalgique avec agitation et œdème pulmonaire)",
      "Ne pas autoriser le départ immédiat après le réveil"
    ],
    "materiel": [
      "Ampoules de Naloxone (0.4 mg)",
      "Ballon auto-remplisseur (BAVU) avec masque",
      "Oxygène",
      "Scope"
    ],
    "lieu": "Préhospitalier / SMUR",
    "typeStation": "SANS_PS_PSS",
    "personnalite": "Comateux, cyanosé, pupilles en tête d'épingle, respiration agonique.",
    "phraseOuverture": "",
    "pointCle": "Le toxidrome opioïde avec hypoventilation critique requiert une ventilation immédiate et l'administration titrée de Naloxone pour rétablir une respiration autonome sans déclencher un sevrage brutal.",
    "erreurs": [
      "Intuber d'emblée sans essayer la naloxone",
      "Laisser le patient repartir aussitôt réveillé (rebond de l'overdose quand la naloxone s'élimine)"
    ],
    "elements": [
      "Identification du syndrome opioïde",
      "Ventilation assistée au masque",
      "Titration de Naloxone (0.1 mg en 0.1 mg toutes les 2 min)",
      "Surveillance prolongée hospitalière"
    ]
  },
  "urgence_convulsion_febrile_nourrisson.json": {
    "spec": "urgence",
    "newFile": "urgence_convulsions_febriles_nourrisson_louis.json",
    "motif": "Secousses cloniques des quatre membres chez un nourrisson fébrile à 39.8°C",
    "prenom": "Louis",
    "nom": "Mercier",
    "age": 1.5,
    "sexe": "M",
    "itemR2C": "Item 105. Épilepsie et convulsions de l'enfant.",
    "role": "Vous êtes interne aux urgences pédiatriques.",
    "contexte": "Vous recevez en salle d'urgence Louis, 18 mois, amené en pleine crise convulsive tonico-clonique généralisée fébrile évoluant depuis 6 minutes.",
    "consignes": [
      "Protéger le nourrisson des traumatismes et libérer les voies aériennes en position latérale",
      "Administrer du Diazépam par voie intra-rectale (0.5 mg/kg) ou Midazolam buccal (0.3 mg/kg) si la crise dépasse 5 minutes",
      "Prendre la glycémie capillaire pour éliminer une hypoglycémie",
      "Rechercher le foyer infectieux causal (otite moyenne aiguë, infection virale) après arrêt de la crise",
      "Rassurer les parents terrorisés sur le caractère généralement bénin des convulsions fébriles simples"
    ],
    "interdits": [
      "Ne jamais mettre d'objet ou les doigts dans la bouche de l'enfant",
      "Ne pas donner de bain froid (risque de choc thermique et convulsions)"
    ],
    "materiel": [
      "Canule intra-rectale de Diazépam",
      "Lecteur glycémie",
      "Thermomètre",
      "Otoscope"
    ],
    "lieu": "Box d'accueil des urgences pédiatriques",
    "typeStation": "SANS_PS_PSS",
    "personnalite": "Nourrisson en crise convulsive fébrile, parents en panique totale.",
    "phraseOuverture": "",
    "pointCle": "Arrêter toute crise convulsive pédiatrique de plus de 5 minutes par une benzodiazépine (Diazépam IR ou Midazolam buccal), rechercher l'origine de la fièvre et rassurer les parents.",
    "erreurs": [
      "Vouloir refroidir brutalement dans un bain froid",
      "Omettre la glycémie capillaire"
    ],
    "elements": [
      "Mise en sécurité et oxygène",
      "Administration de Diazépam rectal 0.5 mg/kg",
      "Glycémie capillaire immédiate",
      "Examen otoscopique et pharyngé à la recherche du foyer"
    ]
  },
  "urgence_accouchement_inopine.json": {
    "spec": "urgence",
    "newFile": "urgence_contractions_rapprochees_expulsion_mme_barbier.json",
    "motif": "Femme enceinte à terme avec contractions toutes les 2 minutes et envie de pousser",
    "prenom": "Camille",
    "nom": "Barbier",
    "age": 29,
    "sexe": "F",
    "itemR2C": "Item 24. Grossesse normale et accouchement.",
    "role": "Vous êtes médecin du SMUR intervenant à domicile.",
    "contexte": "Vous arrivez au domicile de Mme Camille Barbier, 29 ans, 3ème geste, à terme (39 SA), présentant une dilatation complète avec la tête fœtale visible à la vulve.",
    "consignes": [
      "Installer la parturiente confortablement en position demi-assise sur un champ propre",
      "Guider les poussées expulsives synchrones avec les contractions utérines",
      "Contrôler la sortie de la tête fœtale en soutenant le périnée pour éviter la déchirure",
      "Rechercher et dégager une circulaire du cordon ombilical si présente",
      "Poser le nouveau-né sur le ventre de sa mère en peau à peau, le sécher, le couvrir et clamper le cordon"
    ],
    "interdits": [
      "Ne pas tirer brutalement sur le fœtus ou sur le cordon ombilical",
      "Ne pas oublier de surveiller la délivrance placentaire et le globe de sécurité utérin"
    ],
    "materiel": [
      "Kit d'accouchement d'urgence stérile",
      "Pinces de Barr / Kocher",
      "Ciseaux stériles",
      "Bonnets et couvertures thermiques"
    ],
    "lieu": "Domicile de la patiente",
    "personnalite": "Respiration haletante, contractions très douloureuses, poussées réflexes.",
    "phraseOuverture": "Docteur vite ! Le bébé arrive, ça pousse tout seul, je ne peux plus me retenir !",
    "pointCle": "Assister l'expulsion sans traction brutale, protéger le périnée, prodiguer les premiers soins au nouveau-né (peau à peau, séchage, désobstruction) et surveiller la délivrance utérine.",
    "erreurs": [
      "Tirer sur le cordon ombilical risquant une inversion utérine",
      "Laisser le nouveau-né se refroidir"
    ],
    "elements": [
      "Accompagnement de l'expulsion avec soutien du périnée",
      "Dégagement doux des épaules",
      "Séchage immédiat du bébé et mise en peau à peau",
      "Injection d'ocytocine lors du dégagement de l'épaule pour prévenir l'hémorragie de la délivrance"
    ]
  }
};
