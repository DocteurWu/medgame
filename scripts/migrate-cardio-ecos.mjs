#!/usr/bin/env node
/**
 * scripts/migrate-cardio-ecos.mjs
 * Migre les cas de cardiologie au format ECOS réel à 4 volets et renomme par motif.
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, 'data');
const ARCHIVE_DIR = join(DATA_DIR, 'archive');
const INDEX_PATH = join(DATA_DIR, 'case-index.json');

if (!existsSync(ARCHIVE_DIR)) {
    mkdirSync(ARCHIVE_DIR, { recursive: true });
}

// 1. Définition des métadonnées de migration pour chaque cas
const CARDIO_MIGRATIONS = [
    {
        oldFile: 'CARDIO_angor_stable.json',
        newFile: 'cardio_douleur_thoracique_mme_bennet.json',
        newId: 'cardio_douleur_thoracique_mme_bennet',
        motif: "Douleur thoracique à l'effort",
        itemR2C: "Item 222. Facteurs de risque cardiovasculaire et prévention. Item 232. Douleur thoracique aiguë et chronique.",
        consignesEtudiant: {
            role: "Vous êtes cardiologue en consultation hospitalière ou de ville.",
            contexte: "Vous recevez Mme Kitty Bennet, 58 ans, adressée par son médecin traitant pour des épisodes récurrents d'oppression thoracique à l'effort survenant depuis 6 mois.",
            dureeMinutes: 8,
            consignes: [
                "Réaliser un interrogatoire complet centré sur la douleur thoracique",
                "Rechercher et hiérarchiser les facteurs de risque cardiovasculaire",
                "Réaliser un examen clinique ciblé",
                "Proposer et justifier la stratégie diagnostique de première intention",
                "Expliquer la situation clinique à la patiente et lui dispenser l'éducation aux signes d'alerte"
            ],
            interdits: [
                "Ne pas prescrire d'adrénaline",
                "Ne pas réaliser de geste invasif en urgence immédiate au cabinet"
            ],
            materielDisponible: [
                "Stéthoscope",
                "Tensiomètre",
                "Oxymètre de pouls",
                "ECG 12 dérivations",
                "Trinitrine sublinguale spray"
            ],
            lieu: "Cabinet de consultation"
        },
        consignesPatient: {
            identite: { prenom: "Kitty", nom: "Bennet", age: 58, sexe: "F" },
            personnalite: "Patiente coopérative, polie mais minimise ses symptômes. Inquiète pour ses projets d'activité.",
            phraseOuverture: "Bonjour docteur, je viens vous voir car mon médecin traitant s'inquiète. J'ai une gêne qui me serre la poitrine quand je monte les escaliers depuis plusieurs mois.",
            infosVolontaires: [
                "Oppression au milieu de la poitrine survenant exclusivement à l'effort",
                "Disparition rapide au repos en moins de 5 minutes"
            ],
            infosSiDemandees: [
                "Diabète de type 2 traité par metformine",
                "Père décédé d'un infarctus du myocarde à l'âge de 65 ans",
                "Utilisation occasionnelle d'un spray de trinitrine qui soulage en 2 minutes"
            ],
            infosCachees: [
                "Oublie parfois de prendre ses antidiabétiques quand elle est débordée au travail"
            ],
            questionsPieges: [
                "Docteur, je peux quand même partir faire de la randonnée en montagne le week-end prochain ?",
                "Ce n'est pas simplement du stress ou des reflux gastriques ?"
            ],
            reactions: {
                brutal: "Je vous trouve un peu direct docteur, vous voulez dire que mes artères sont bouchées ?",
                silence: "Docteur, vous avez l'air préoccupé... qu'est-ce que vous regardez ?",
                jargon: "Pardon docteur, qu'est-ce que vous voulez dire par « ischémie myocardique » ?"
            }
        },
        consignesEvaluateur: {
            pointCle: "Le candidat doit reconnaître une douleur angineuse d'effort typique chez une patiente à haut risque cardiovasculaire et proposer un ECG de repos ainsi qu'un test d'ischémie fonctionnel.",
            erreursRedhibitoires: [
                "Méconnaître le caractère urgent d'une douleur thoracique de repos (syndrome coronarien aigu)",
                "Affirmer qu'un ECG de repos normal élimine le diagnostic d'ischémie myocardique",
                "Omettre les mesures de prévention cardiovasculaire secondaire (règles BASIC)"
            ],
            elementsAttendus: [
                "Caractérisation sémiologique complète (siège rétrosternal, constriction, effort, cédant au repos/trinitrine)",
                "Recherche exhaustive des FDRCV (diabète, hérédité, lipides, HTA)",
                "Examen cardiovasculaire complet",
                "Prescription ECG 12 dérivations et test d'effort ou coroscanner",
                "Éducation sur l'appel au 15 si douleur > 15 min résistante à la trinitrine"
            ],
            grille: [
                { id: "eval_caracterisation", label: "Caractérise la douleur thoracique (siège, type constrictif, effort, repos/trinitrine)", weight: 1 },
                { id: "eval_fdrcv", label: "Recherche les facteurs de risque cardiovasculaire majeurs", weight: 1 },
                { id: "eval_examen", label: "Réalise la prise des constantes et l'examen cardiovasculaire", weight: 1 },
                { id: "eval_paraclinique", label: "Propose une stratégie diagnostique conforme (ECG + test d'ischémie)", weight: 1 },
                { id: "eval_education", label: "Donne les consignes de sécurité et d'appel au 15 en cas de crise prolongée", weight: 1 }
            ]
        }
    },
    {
        oldFile: 'CARDIO_AOMI.json',
        newFile: 'cardio_claudication_intermittente_m_lambert.json',
        newId: 'cardio_claudication_intermittente_m_lambert',
        motif: "Douleur au mollet à la marche",
        itemR2C: "Item 225. Artériopathie oblitérante de l'aorte et des membres inférieurs.",
        consignesEtudiant: {
            role: "Vous êtes interne en consultation de médecine vasculaire / cardiologie.",
            contexte: "Vous recevez M. Martin Lambert, 72 ans, qui consulte pour une crampe douloureuse du mollet droit survenant à la marche et cédant à l'arrêt.",
            dureeMinutes: 8,
            consignes: [
                "Préciser les caractéristiques sémiologiques de la douleur et mesurer le périmètre de marche",
                "Rechercher les facteurs de risque d'athérosclérose et les autres localisations de la maladie athéromateuse",
                "Réaliser un examen vasculaire des membres inférieurs",
                "Proposer les examens complémentaires de première intention (mesure d'IPS, écho-Doppler)",
                "Expliquer la démarche diagnostique et la prise en charge médicale"
            ],
            interdits: [
                "Ne pas prescrire de vasodilatateurs périphériques inefficaces",
                "Ne pas proposer de revascularisation chirurgicale d'emblée sans bilan"
            ],
            materielDisponible: [
                "Stéthoscope",
                "Tensiomètre",
                "Sonde Doppler de poche pour mesure de pression de cheville",
                "Écho-Doppler artériel"
            ],
            lieu: "Cabinet de consultation"
        },
        consignesPatient: {
            identite: { prenom: "Martin", nom: "Lambert", age: 72, sexe: "M" },
            personnalite: "Patient calme, fumeur de longue date, banalisant sa gêne à la marche qu'il attribuait à l'âge.",
            phraseOuverture: "Bonjour docteur, depuis quelques mois, quand je marche plus de 200 mètres, j'ai comme une crampe intense dans le mollet droit qui m'oblige à m'arrêter.",
            infosVolontaires: [
                "Crampe au mollet droit à la marche pour un périmètre d'environ 200-300 mètres",
                "Soulagement complet en 2 à 3 minutes après arrêt de la marche"
            ],
            infosSiDemandees: [
                "Tabagisme important évalué à 40 paquets-années",
                "Hypertension artérielle et dyslipidémie traitées",
                "Absence de douleur de décubitus nocturne pour le moment"
            ],
            infosCachees: [
                "A parfois du mal à lacer ses chaussures le matin à cause de raideurs"
            ],
            questionsPieges: [
                "Docteur, est-ce que c'est une sciatique ou de l'arthrose du genou ?",
                "Est-ce que je risque d'être amputé si je continue à marcher ?"
            ],
            reactions: {
                brutal: "Vous me parlez d'artères bouchées, c'est si grave que ça ?",
                silence: "Docteur, vous palpez mes pieds, vous sentez quelque chose ?",
                jargon: "Pardon docteur, qu'est-ce que vous appelez « IPS » ?"
            }
        },
        consignesEvaluateur: {
            pointCle: "Le candidat doit reconnaître une claudication intermittente artérielle typique (stade 2 de Leriche et Fontaine), palper tous les pouls et prescrire l'IPS et l'écho-Doppler artériel.",
            erreursRedhibitoires: [
                "Ne pas palper l'ensemble des pouls des membres inférieurs (fémoraux, poplités, tibiaux postérieurs, pédieux)",
                "Oublier l'arrêt impératif et définitif du tabac",
                "Méconnaître la recherche des autres territoires athéromateux (coronaires, carotides, aorte)"
            ],
            elementsAttendus: [
                "Caractérisation du périmètre de marche et de la topographie de la claudication",
                "Recherche des FDRCV majeurs (tabagisme 40 PA)",
                "Palpation des pouls distaux et auscultation des trajets artériels",
                "Prescription de l'IPS et écho-Doppler artériel des membres inférieurs",
                "Mesures de prévention cardiovasculaire globale (arrêt tabac, statine, antiagrégant, marche quotidienne)"
            ],
            grille: [
                { id: "eval_claudication", label: "Caractérise la claudication intermittente et évalue le périmètre de marche", weight: 1 },
                { id: "eval_pouls", label: "Palpe les pouls périphériques et recherche des souffles vasculaires", weight: 1 },
                { id: "eval_ips_doppler", label: "Prescrit la mesure de l'IPS et un écho-Doppler artériel", weight: 1 },
                { id: "eval_autres_territoires", label: "Recherche les atteintes cardiovasculaires associées (carotides, cœur)", weight: 1 },
                { id: "eval_traitement_medical", label: "Pose l'indication de l'arrêt du tabac, statine, antiagrégant et marche régulière", weight: 1 }
            ]
        }
    },
    {
        oldFile: 'CARDIO_hta_secondaire_hyperaldosteronisme.json',
        newFile: 'cardio_hypertension_arterielle_m_wickham.json',
        newId: 'cardio_hypertension_arterielle_m_wickham',
        motif: "Élévation tensionnelle sévère chez l'adulte jeune",
        itemR2C: "Item 224. Hypertension artérielle de l'adulte.",
        consignesEtudiant: {
            role: "Vous êtes interne en médecine interne / cardiologie.",
            contexte: "Vous recevez M. George Wickham, 42 ans, adressé pour bilan d'une hypertension artérielle sévère (175/105 mmHg) découverte fortuitement lors d'un bilan pré-opératoire.",
            dureeMinutes: 8,
            consignes: [
                "Confirmer les chiffres tensionnels et rechercher les signes de retentissement",
                "Rechercher les arguments en faveur d'une HTA secondaire chez un adulte jeune",
                "Réaliser un examen physique orienté (auscultation des artères rénales, pouls fémoraux)",
                "Proposer le bilan biologique initial et d'orientation étiologique",
                "Expliquer la démarche diagnostique au patient"
            ],
            interdits: [
                "Ne pas initier de diurétique hypokaliémiant sans dosage préalable du potassium",
                "Ne pas banaliser une HTA grade 3 chez un patient de 42 ans"
            ],
            materielDisponible: [
                "Stéthoscope",
                "Tensiomètre manuel avec brassard adapté",
                "Bandelette urinaire"
            ],
            lieu: "Cabinet de consultation"
        },
        consignesPatient: {
            identite: { prenom: "George", nom: "Wickham", age: 42, sexe: "M" },
            personnalite: "Patient surpris par cette découverte, asymptomatique, ressent parfois de légères céphalées matinales.",
            phraseOuverture: "Bonjour docteur, l'anesthésiste a refusé de m'opérer de mon genou parce que ma tension était à plus de 17. Je n'avais jamais eu de problème avant.",
            infosVolontaires: [
                "Tension mesurée à 175/105 mmHg lors de la consultation d'anesthésie",
                "Absence de douleur thoracique ou de dyspnée"
            ],
            infosSiDemandees: [
                "Céphalées occipitales matinales occasionnelles",
                "Faiblesse musculaire ou crampes occasionnelles sans cause évidente",
                "Absence de prise de réglisse, toxiques, vasoconstricteurs ou AINS"
            ],
            infosCachees: [
                "A tendance à saler abondamment ses plats mais a restreint le sel depuis 15 jours"
            ],
            questionsPieges: [
                "Docteur, est-ce que c'est juste le stress de l'opération qui a fait monter ma tension ?",
                "Est-ce que je vais devoir prendre un traitement à vie ?"
            ],
            reactions: {
                brutal: "Vous voulez dire que mes reins ou mes glandes fonctionnent mal ?",
                silence: "Docteur, pourquoi vous écoutez mon ventre avec le stéthoscope ?",
                jargon: "Pardon, qu'est-ce que vous entendez par « aldostérone » ?"
            }
        },
        consignesEvaluateur: {
            pointCle: "Le candidat doit identifier une HTA sévère du sujet jeune justifiant la recherche d'une cause secondaire (hyperaldostéronisme primaire, sténose de l'artère rénale) avec dosage du potassium et ratio aldostérone/rénine.",
            erreursRedhibitoires: [
                "Omettre le dosage de l'ionogramme sanguin (recherche d'hypokaliémie)",
                "Ne pas rechercher de souffle abdominal ou de coarctation aortique (asymétrie tensionnelle)",
                "Négliger le retentissement de l'HTA (ECG, créatinine, protéinurie)"
            ],
            elementsAttendus: [
                "Confirmation de l'HTA aux deux bras avec brassard adapté",
                "Recherche des signes fonctionnels d'HTA et de retentissement",
                "Prescription du bilan minimal OMS/ESH (iono, créat, DFG, glycémie, lipides, BU, ECG)",
                "Orientation vers le bilan d'HTA secondaire (aldostérone/rénine, écho-Doppler des artères rénales)",
                "Règles hygiéno-diététiques et surveillance"
            ],
            grille: [
                { id: "eval_mesure_hta", label: "Mesure rigoureusement la PA aux deux bras et évalue le grade d'HTA", weight: 1 },
                { id: "eval_recherche_secondaire", label: "Interroge sur les prises médicamenteuses, toxiques et signes de cause secondaire", weight: 1 },
                { id: "eval_examen_clinique", label: "Recherche un souffle lombaire/abdominal et palpe les pouls fémoraux", weight: 1 },
                { id: "eval_bilan_retentissement", label: "Prescrit le bilan initial recommandé (iono avec kaliémie, créatinine, ECG)", weight: 1 },
                { id: "eval_bilan_etiologique", label: "Propose le dosage du ratio aldostéronémie/rénine en conditions standardisées", weight: 1 }
            ]
        }
    },
    {
        oldFile: 'CARDIO_insuffisance_veineuse_chronique.json',
        newFile: 'cardio_jambes_lourdes_mme_dubois.json',
        newId: 'cardio_jambes_lourdes_mme_dubois',
        motif: "Lourdeur des membres inférieurs et varices",
        itemR2C: "Item 226. Maladie veineuse thromboembolique et insuffisance veineuse chronique.",
        consignesEtudiant: {
            role: "Vous êtes médecin généraliste ou angiologue en consultation.",
            contexte: "Vous recevez Mme Monique Dubois, 55 ans, pharmacienne, qui consulte pour une sensation de jambes lourdes et l'apparition de varices visibles des membres inférieurs s'aggravant en fin de journée.",
            dureeMinutes: 8,
            consignes: [
                "Caractériser les symptômes fonctionnels d'insuffisance veineuse et le retentissement socioprofessionnel",
                "Rechercher les facteurs favorisants (station debout prolongée, antécédents familiaux, surpoids)",
                "Réaliser un examen clinique complet debout et couché avec inspection des trajets veineux et trophicité cutanée",
                "Prescrire l'examen de référence (écho-Doppler veineux superficiel et profond)",
                "Proposer les mesures préventives et thérapeutiques adaptées (compression médicale)"
            ],
            interdits: [
                "Ne pas prescrire de veinotoniques oraux en faisant croire à une efficacité sur les varices",
                "Ne pas omettre la recherche d'antécédent de phlébite profonde"
            ],
            materielDisponible: [
                "Mètre ruban pour mesure des périmètres",
                "Stéthoscope",
                "Tensiomètre"
            ],
            lieu: "Cabinet de consultation"
        },
        consignesPatient: {
            identite: { prenom: "Monique", nom: "Dubois", age: 55, sexe: "F" },
            personnalite: "Pharmacienne debout toute la journée, gênée esthétiquement et physiquement par ses jambes gonflées le soir.",
            phraseOuverture: "Bonjour docteur, avec mon travail au comptoir de la pharmacie, j'ai les jambes très lourdes et gonflées en fin de journée, et mes varices deviennent douloureuses.",
            infosVolontaires: [
                "Sensation de pesanteur et d'engourdissement bilatéral des membres inférieurs le soir",
                "Soulagement net en surélevant les jambes ou sous la douche fraîche"
            ],
            infosSiDemandees: [
                "Station debout piétinante quotidienne de plus de 8 heures",
                "Mère opérée de varices bilatérales",
                "Absence de douleur aiguë brutale unilatérale"
            ],
            infosCachees: [
                "Ne porte jamais ses chaussettes de contention car elle les trouve difficiles à enfiler"
            ],
            questionsPieges: [
                "Docteur, est-ce que les crèmes ou gélules de vigne rouge que je vends à la pharmacie sont suffisantes ?",
                "Est-ce que je risque de faire une embolie pulmonaire avec ces varices ?"
            ],
            reactions: {
                brutal: "Vous voulez dire que je vais devoir porter des bas de contention toute ma vie ?",
                silence: "Docteur, pourquoi vous me demandez de me lever pour regarder mes jambes ?",
                jargon: "Pardon, qu'est-ce que vous entendez par « reflux saphénien » ?"
            }
        },
        consignesEvaluateur: {
            pointCle: "Le candidat doit reconnaître une insuffisance veineuse chronique superficielle (classification CEAP), éliminer une TVP, prescrire un écho-Doppler veineux et poser l'indication d'une compression médicale de classe 2.",
            erreursRedhibitoires: [
                "Ne pas examiner le patient debout pour évaluer le réseau variqueux",
                "Oublier de vérifier l'intégrité cutanée (dermite ocre, atrophie blanche, ulcère)",
                "Négliger la prescription de bas ou chaussettes de compression veineuse élastique"
            ],
            elementsAttendus: [
                "Recherche des signes d'insuffisance veineuse et élimination d'un tableau aigu (TVP)",
                "Examen debout : varices, œdème malléolaire, troubles trophiques",
                "Recherche des pouls périphériques avant compression",
                "Prescription d'un écho-Doppler veineux des membres inférieurs",
                "Mesures posturales (surélévation, marche) et compression veineuse classe 2"
            ],
            grille: [
                { id: "eval_interro_veineux", label: "Caractérise la symptomatologie veineuse et recherche les facteurs favorisants", weight: 1 },
                { id: "eval_examen_debout", label: "Examine la patiente debout puis couchée, inspecte les varices et la peau", weight: 1 },
                { id: "eval_pouls_ips", label: "Vérifie les pouls distaux pour éliminer une artériopathie associée avant compression", weight: 1 },
                { id: "eval_echo_doppler", label: "Prescrit un écho-Doppler veineux superficiel et profond des membres inférieurs", weight: 1 },
                { id: "eval_compression", label: "Prescrit une compression médicale de classe 2 et explique les règles hygiéno-diététiques", weight: 1 }
            ]
        }
    },
    {
        oldFile: 'CARDIO_retrecissement_aortique.json',
        newFile: 'cardio_malaise_effort_m_bingley.json',
        newId: 'cardio_malaise_effort_m_bingley',
        motif: "Malaise d'effort et dyspnée d'effort",
        itemR2C: "Item 233. Rétrécissement aortique. Valvulopathies.",
        consignesEtudiant: {
            role: "Vous êtes interne aux urgences ou en cardiologie.",
            contexte: "Vous recevez M. Charles Bingley, 72 ans, accompagné de son épouse, pour un malaise survenu alors qu'il marchait d'un pas vif dans une côte.",
            dureeMinutes: 8,
            consignes: [
                "Caractériser les circonstances du malaise et rechercher les signes cardiovasculaires d'effort associés",
                "Rechercher les antécédents cardiovasculaires et les facteurs de risque",
                "Réaliser une auscultation cardiaque minutieuse aux différents foyers",
                "Poser l'hypothèse diagnostique principale et proposer l'examen clé de confirmation",
                "Expliquer la conduite à tenir immédiate et les précautions à respecter"
            ],
            interdits: [
                "Ne pas prescrire de test d'effort devant une suspicion de rétrécissement aortique serré symptomatique (contre-indication absolue)",
                "Ne pas prescrire de dérivés nitrés ou de vasodilatateurs puissants à l'aveugle"
            ],
            materielDisponible: [
                "Stéthoscope",
                "Tensiomètre",
                "ECG 12 dérivations",
                "Échocardiographe"
            ],
            lieu: "Cabinet de consultation"
        },
        consignesPatient: {
            identite: { prenom: "Charles", nom: "Bingley", age: 72, sexe: "M" },
            personnalite: "Patient coopératif, surpris par ce malaise qu'il n'avait jamais connu auparavant.",
            phraseOuverture: "Bonjour docteur, tout à l'heure en marchant rapidement pour monter une petite côte, j'ai eu la tête qui tournait, mes jambes se sont dérobées et je me suis effondré quelques secondes.",
            infosVolontaires: [
                "Malaise survenu en plein effort de marche en côte",
                "Reprise immédiate de conscience sans confusion après quelques secondes allongé"
            ],
            infosSiDemandees: [
                "Essoufflement anormal à la marche depuis 6 mois qu'il mettait sur le compte de l'âge",
                "Sensation occasionnelle de serrement dans la poitrine lors d'efforts intenses",
                "Absence de perte de connaissance au repos"
            ],
            infosCachees: [
                "Son médecin lui avait parlé d'un petit souffle au cœur il y a 5 ans mais sans suivi"
            ],
            questionsPieges: [
                "Docteur, est-ce que je peux refaire une épreuve d'effort sur tapis comme à la télé ?",
                "Est-ce qu'on peut juste me prescrire un médicament pour que ça ne recommence pas ?"
            ],
            reactions: {
                brutal: "Vous voulez dire que ma valve cardiaque est complètement bouchée ?",
                silence: "Docteur, pourquoi vous écoutez aussi mon cou avec le stéthoscope ?",
                jargon: "Pardon docteur, qu'est-ce qu'une « sténose aortique » ?"
            }
        },
        consignesEvaluateur: {
            pointCle: "Le candidat doit reconnaître le maître symptôme de l'effort (syncope d'effort, dyspnée, angor) orientant vers un rétrécissement aortique serré, identifier le souffle éjectionnel au foyer aortique irradiant aux carotides, et prescrire l'échocardiographie transthoracique (ETT) en contre-indiquant formellement l'épreuve d'effort.",
            erreursRedhibitoires: [
                "Prescrire ou envisager une épreuve d'effort (danger de mort subite)",
                "Ne pas ausculter le foyer aortique et les trajets carotidiens",
                "Méconnaître le caractère chirurgical/interventionnel urgent d'un RA serré symptomatique (TAVI ou remplacement valvulaire)"
            ],
            elementsAttendus: [
                "Identification du trépied fonctionnel du RA serré (dyspnée, angor, syncope d'effort)",
                "Auscultation : souffle méso-systolique éjectionnel râpeux, max foyer aortique, irradiant aux carotides, abolition du B2",
                "Réalisation ECG : recherche HVG électrique et troubles de conduction",
                "Prescription urgente d'une échocardiographie transthoracique (ETT)",
                "Contre-indication formelle à tout effort violent, arrêt des vasodilatateurs"
            ],
            grille: [
                { id: "eval_circonstances", label: "Caractérise la syncope d'effort et recherche le trépied fonctionnel", weight: 1 },
                { id: "eval_auscultation", label: "Ausculte le foyer aortique et recherche l'irradiation aux carotides et l'atténuation du B2", weight: 1 },
                { id: "eval_ecg", label: "Réalise un ECG 12 dérivations (recherche HVG, PR allongé)", weight: 1 },
                { id: "eval_ett", label: "Pose l'indication formelle de l'ETT confirmatoire en urgence", weight: 1 },
                { id: "eval_contre_indication", label: "Contre-indique l'épreuve d'effort et informe sur les options de prise en charge", weight: 1 }
            ]
        }
    },
    {
        oldFile: 'CARDIO_syncope_cardiaque.json',
        newFile: 'cardio_perte_de_connaissance_m_darcy.json',
        newId: 'cardio_perte_de_connaissance_m_darcy',
        motif: "Perte de connaissance brève à l'emporte-pièce",
        itemR2C: "Item 236. Perte de connaissance de l'adulte. Syncope.",
        consignesEtudiant: {
            role: "Vous êtes interne d'accueil aux urgences ou en unité de soins intensifs cardiologiques.",
            contexte: "Vous recevez M. Fitzwilliam Darcy, 70 ans, adressé par les secours après une chute brutale avec perte de connaissance totale au domicile, sans prodrome.",
            dureeMinutes: 8,
            consignes: [
                "Rechercher les arguments sémiologiques distinguant une syncope vraie d'une crise comitiale ou d'une chute",
                "Caractériser le profil de la syncope (à l'emporte-pièce, de repos ou changement de position, traumatisante)",
                "Rechercher le terrain sous-jacent (cardiopathie ischémique, HTA, traitements bradycardisants)",
                "Réaliser un examen clinique cardiovasculaire et neurologique ciblé",
                "Interpréter l'ECG immédiat et organiser la prise en charge diagnostique et de surveillance"
            ],
            interdits: [
                "Ne pas laisser repartir le patient sans surveillance scopée",
                "Ne pas prescrire de scanner cérébral sans avoir réalisé un ECG 12 dérivations"
            ],
            materielDisponible: [
                "Scope multiparamétrique",
                "ECG 12 dérivations",
                "Stéthoscope",
                "Tensiomètre"
            ],
            lieu: "Box des urgences"
        },
        consignesPatient: {
            identite: { prenom: "Fitzwilliam", nom: "Darcy", age: 70, sexe: "M" },
            personnalite: "Patient digne mais secoué, présentant une ecchymose au front due à la chute brutale.",
            phraseOuverture: "Bonjour docteur, je préparais mon café ce matin quand je me suis retrouvé par terre, le front en sang. Je n'ai rien vu venir, aucun vertige, le trou noir complet pendant 30 secondes.",
            infosVolontaires: [
                "Perte de connaissance subite sans aucun avertissement ni prodrome",
                "Chute traumatique sur le front, reprise de conscience immédiate et lucide"
            ],
            infosSiDemandees: [
                "Antécédent d'infarctus du myocarde il y a 8 ans",
                "Traitements : Bêta-bloquant (Bisoprolol), Aspirine, Statine, ARA2",
                "Pas de morsure de langue, pas de perte d'urines ni de confusion post-critique"
            ],
            infosCachees: [
                "A ressenti quelques palpitations rapides bizarres il y a 3 jours"
            ],
            questionsPieges: [
                "Docteur, est-ce que c'est un AVC ou une crise d'épilepsie ?",
                "Est-ce que je peux rentrer chez moi ce soir si mon front est recousu ?"
            ],
            reactions: {
                brutal: "Vous voulez dire que mon cœur s'est arrêté de battre ?",
                silence: "Docteur, pourquoi ce moniteur sonne à côté de mon lit ?",
                jargon: "Pardon docteur, qu'est-ce que vous entendez par « bloc auriculo-ventriculaire » ?"
            }
        },
        consignesEvaluateur: {
            pointCle: "Le candidat doit identifier les critères de gravité d'une syncope d'origine cardiaque chez un patient coronarien (syncope à l'emporte-pièce sans prodrome, traumatisme), prescrire l'ECG immédiat (recherche de BAV complet ou TV), placer sous scope et hospitaliser en USIC.",
            erreursRedhibitoires: [
                "Autoriser la sortie du patient sans bilan cardiologique ni monitorage ECG",
                "Omettre la réalisation immédiate de l'ECG 12 dérivations",
                "Confondre avec une crise d'épilepsie sans vérifier l'absence de confusion post-critique"
            ],
            elementsAttendus: [
                "Différenciation syncope / crise convulsive (début soudain, brièveté, absence de confusion)",
                "Critères de syncope cardiaque : pas de prodrome, traumatisante, terrain coronarien",
                "ECG immédiat : analyse du rythme, conduction (PR, QRS, QT), séquelles d'infarctus",
                "Mise sous scope télémétrique et pose de voie veineuse",
                "Programmation bilan : ETT, Holter ECG, avis rythmologique pour stimulateur cardiaque (pacemaker)"
            ],
            grille: [
                { id: "eval_semiologie_syncope", label: "Caractérise la syncope à l'emporte-pièce et élimine une cause comitiale", weight: 1 },
                { id: "eval_terrain_risque", label: "Identifie le terrain à haut risque cardiovasculaire (coronarien) et les traitements", weight: 1 },
                { id: "eval_ecg_scope", label: "Réalise l'ECG 12 dérivations et place le patient sous monitorage scopé", weight: 1 },
                { id: "eval_securisation", label: "Recherche un traumatisme secondaire et pose les voies de sécurité", weight: 1 },
                { id: "eval_strategie_cardiaque", label: "Pose l'indication d'hospitalisation en cardiologie et bilan rythmologique/ETT", weight: 1 }
            ]
        }
    },
    {
        oldFile: 'CARDIO_syncope_vaso_vagale.json',
        newFile: 'cardio_malaise_vagal_mlle_bennet.json',
        newId: 'cardio_malaise_vagal_mlle_bennet',
        motif: "Malaise avec prodromes en station debout prolongée",
        itemR2C: "Item 236. Perte de connaissance de l'adulte. Syncope réflexe vaso-vagale.",
        consignesEtudiant: {
            role: "Vous êtes médecin généraliste ou médecin d'accueil aux urgences.",
            contexte: "Vous recevez Mlle Elizabeth Bennet, 20 ans, étudiante, amenée par des amis après un malaise survenu dans une rame de métro bondée et surchauffée.",
            dureeMinutes: 8,
            consignes: [
                "Rechercher les facteurs déclenchants et la séquence chronologique du malaise",
                "Détailler les prodromes neurovégétatifs (sueurs, nausées, flou visuel, bâillements)",
                "Vérifier l'absence de signe de gravité et d'antécédent cardiovasculaire personnel ou familial",
                "Réaliser un examen clinique complet avec recherche d'hypotension orthostatique",
                "Rassurer la patiente et lui expliquer les manœuvres physiques de contre-pression"
            ],
            interdits: [
                "Ne pas multiplier les examens complémentaires invasifs ou inutiles (scanner, coronarographie)",
                "Ne pas prescrire de traitement médicamenteux inadapté"
            ],
            materielDisponible: [
                "Stéthoscope",
                "Tensiomètre",
                "ECG 12 dérivations",
                "Glycémie capillaire"
            ],
            lieu: "Cabinet de consultation"
        },
        consignesPatient: {
            identite: { prenom: "Elizabeth", nom: "Bennet", age: 20, sexe: "F" },
            personnalite: "Jeune femme vive, un peu agacée d'avoir été amenée aux urgences pour ce qu'elle pense être un simple coup de chaud.",
            phraseOuverture: "Bonjour docteur, mes amis ont insisté pour m'emmener mais je vais très bien. J'ai juste eu un coup de chaud dans le métro bondé, j'ai vu tout noir et je me suis évanouie quelques secondes.",
            infosVolontaires: [
                "Malaise après 45 minutes debout dans un métro bondé et très chaud",
                "Prodromes nets : bouffée de chaleur, nausées, sueurs, vision trouble, jambes en coton",
                "Perte de connaissance très brève (moins de 30 secondes), s'est réveillée dès qu'elle a été allongée"
            ],
            infosSiDemandees: [
                "Absence d'antécédent cardiaque ou de mort subite dans la famille",
                "N'avait pas pris de petit déjeuner ce matin",
                "A déjà fait un malaise similaire au lycée lors d'une prise de sang"
            ],
            infosCachees: [
                "A un examen universitaire important cet après-midi et est stressée"
            ],
            questionsPieges: [
                "Docteur, est-ce que j'ai une malformation cardiaque ou une tumeur au cerveau ?",
                "Est-ce que je peux aller passer mes partiels cet après-midi ?"
            ],
            reactions: {
                brutal: "Vous dites que c'est juste le nerf vague ? C'est dangereux pour mon cœur ?",
                silence: "Docteur, vous voulez que je me remette debout pour reprendre ma tension ?",
                jargon: "Pardon, qu'est-ce que vous voulez dire par « réflexe vagal » ?"
            }
        },
        consignesEvaluateur: {
            pointCle: "Le candidat doit reconnaître le tableau typique de la syncope réflexe vaso-vagale (prodromes neurovégétatifs, facteur déclenchant évident, sujet jeune, réversibilité en décubitus), éliminer les diagnostics différentiels, réaliser l'ECG (normal) et éduquer aux manœuvres de contre-pression.",
            erreursRedhibitoires: [
                "Prescrire une batterie d'examens d'imagerie cérébrale (TDM/IRM) devant une syncope réflexe typique",
                "Omettre de vérifier l'absence d'antécédents de mort subite familiale",
                "Oublier de vérifier l'ECG de repos"
            ],
            elementsAttendus: [
                "Identification des prodromes caractéristiques (sueurs, nausées, voile noir)",
                "Contexte déclenchant typique (chaleur, station debout, confinement)",
                "Recherche d'hypotension orthostatique (couché/debout)",
                "Réalisation d'un ECG 12 dérivations pour éliminer un QT long ou syndrome de Brugada",
                "Éducation thérapeutique : manœuvres de contre-pression (squat, croisement des jambes, contraction des fessiers), hydratation"
            ],
            grille: [
                { id: "eval_anamnese_vagale", label: "Identifie les circonstances déclenchantes et les prodromes neurovégétatifs typiques", weight: 1 },
                { id: "eval_elimination_gravite", label: "Recherche les antécédents familiaux de mort subite et l'absence de traumatisme", weight: 1 },
                { id: "eval_examen_ho", label: "Réalise la recherche d'hypotension orthostatique et l'examen clinique", weight: 1 },
                { id: "eval_ecg_normal", label: "Réalise l'ECG 12 dérivations de sécurité (vérifie QT, PR, repolarisation)", weight: 1 },
                { id: "eval_education_manoeuvres", label: "Rassure et enseigne les manœuvres physiques de contre-pression et mesures hygiéno-diététiques", weight: 1 }
            ]
        }
    },
    {
        oldFile: 'CARDIO_thrombose_veineuse_profonde_droite.json',
        newFile: 'cardio_grosse_jambe_rouge_m_ternes.json',
        newId: 'cardio_grosse_jambe_rouge_m_ternes',
        motif: "Douleur et œdème unilatéral du mollet",
        itemR2C: "Item 226. Thrombose veineuse profonde et embolie pulmonaire. Maladie veineuse thromboembolique.",
        consignesEtudiant: {
            role: "Vous êtes interne d'accueil aux urgences ou en médecine générale.",
            contexte: "Vous recevez M. Alex Ternes, 22 ans, externe en médecine, qui consulte pour une douleur progressive du mollet droit associée à un gonflement apparu depuis 48h.",
            dureeMinutes: 8,
            consignes: [
                "Caractériser la douleur du mollet et rechercher les facteurs de risque thromboembolique récents",
                "Rechercher les signes fonctionnels d'embolie pulmonaire associée (douleur thoracique, dyspnée, hémoptysie)",
                "Réaliser un examen clinique comparatif des membres inférieurs (signe de Homans, circonférence, chaleur)",
                "Évaluer la probabilité clinique (score de Wells) et poser la stratégie diagnostique adaptée",
                "Instaurer le traitement anticoagulant initial sans délai si suspicion forte"
            ],
            interdits: [
                "Ne pas masser le mollet (risque de migration embolique)",
                "Ne pas attendre le lendemain pour confirmer le diagnostic devant un tableau franc"
            ],
            materielDisponible: [
                "Mètre ruban",
                "Stéthoscope",
                "Tensiomètre",
                "Oxymètre de pouls",
                "Écho-Doppler veineux"
            ],
            lieu: "Box des urgences"
        },
        consignesPatient: {
            identite: { prenom: "Alex", nom: "Ternes", age: 22, sexe: "M" },
            personnalite: "Étudiant fatigué, inquiet de rater ses révisions de partiels, ayant un mollet droit douloureux et tendu.",
            phraseOuverture: "Bonjour docteur, je suis externe et j'ai une douleur sourde dans le mollet droit depuis deux jours qui empire quand je pose le pied. J'ai l'impression que ma jambe droite est plus grosse.",
            infosVolontaires: [
                "Douleur unilatérale du mollet droit augmentée à la marche",
                "Sensation de jambe lourde et chaude depuis 48 heures"
            ],
            infosSiDemandees: [
                "Voyage récent en autocar de 12 heures il y a une semaine sans s'être levé",
                "Immobilisation prolongée assis à réviser 12h par jour depuis 15 jours",
                "Absence de point de côté thoracique ni d'essoufflement"
            ],
            infosCachees: [
                "Prend des compléments protéinés et boit très peu d'eau en période de révision"
            ],
            questionsPieges: [
                "Docteur, est-ce que ça peut être juste une élongation musculaire suite à ma séance de sport ?",
                "Est-ce que je peux continuer à réviser assis toute la journée ?"
            ],
            reactions: {
                brutal: "Une phlébite à 22 ans ? Vous pensez que le caillot peut monter dans mes poumons ?",
                silence: "Docteur, pourquoi vous mesurez mes deux mollets avec un mètre ?",
                jargon: "Pardon docteur, qu'est-ce que vous entendez par « anticoagulation à dose curative » ?"
            }
        },
        consignesEvaluateur: {
            pointCle: "Le candidat doit reconnaître une thrombose veineuse profonde (TVP) proximale/distale du membre inférieur, évaluer la probabilité clinique par le score de Wells, rechercher les signes d'embolie pulmonaire, prescrire l'écho-Doppler veineux de compression et débuter un anticoagulant à dose curative (AOD ou HBPM).",
            erreursRedhibitoires: [
                "Masser le mollet douloureux (risque de mobiliser le thrombus)",
                "Omettre la recherche de signes d'embolie pulmonaire (dyspnée, tachycardie, désaturation)",
                "Différer l'anticoagulation en cas de probabilité forte et délai d'écho-Doppler"
            ],
            elementsAttendus: [
                "Anamnèse : facteurs déclenchants (voyage prolongé, immobilisation, déshydratation)",
                "Examen comparatif : perte du ballottement du mollet, augmentation du périmètre > 3 cm, chaleur locale",
                "Évaluation de la probabilité clinique selon le score de Wells",
                "Prescription de l'écho-Doppler veineux des membres inférieurs",
                "Mise en route du traitement anticoagulant curatif (AOD : Rivaroxaban ou Apixaban) et compression veineuse classe 3"
            ],
            grille: [
                { id: "eval_interro_tvp", label: "Recherche les facteurs de risque de MTEV (voyage, alitement) et signes d'EP", weight: 1 },
                { id: "eval_examen_comparatif", label: "Réalise un examen clinique bilatéral et comparatif rigoureux avec mesure au mètre", weight: 1 },
                { id: "eval_score_wells", label: "Évalue la probabilité clinique pré-test (score de Wells)", weight: 1 },
                { id: "eval_echo_doppler_tvp", label: "Prescrit l'écho-Doppler veineux de compression en urgence", weight: 1 },
                { id: "eval_anticoagulation", label: "Prescrit le traitement anticoagulant curatif sans délai et la compression veineuse", weight: 1 }
            ]
        }
    },
    {
        oldFile: 'cardio_1.json',
        newFile: 'cardio_dyspnee_oedemes_m_dupont.json',
        newId: 'cardio_dyspnee_oedemes_m_dupont',
        motif: "Essoufflement progressif et gonflement des jambes",
        itemR2C: "Item 234. Insuffisance cardiaque de l'adulte.",
        consignesEtudiant: {
            role: "Vous êtes interne en stage de cardiologie ou aux urgences.",
            contexte: "Vous recevez M. Jean Dupont, 65 ans, retraité, adressé pour une dyspnée d'aggravation progressive associée à une prise de poids de 4 kg et des œdèmes des membres inférieurs depuis 2 semaines.",
            dureeMinutes: 8,
            consignes: [
                "Caractériser la dyspnée (stade NYHA, orthopnée, dyspnée paroxystique nocturne) et l'évolution pondérale",
                "Rechercher un facteur déclenchant de décompensation (écart de régime sans sel, arrêt de traitement, infection, FA)",
                "Réaliser un examen clinique complet à la recherche des signes de congestion veineuse pulmonaire et périphérique",
                "Proposer le bilan paraclinique de confirmation (peptides natriurétiques, radio de thorax, ECG, ETT)",
                "Prescrire le traitement déplétif d'urgence et expliquer les mesures hygiéno-diététiques"
            ],
            interdits: [
                "Ne pas perfuser de soluté salé isotonique (aggravation de la surcharge)",
                "Ne pas majorer les bêta-bloquants en phase aiguë congestive"
            ],
            materielDisponible: [
                "Stéthoscope",
                "Tensiomètre",
                "Oxymètre de pouls",
                "Balance pèse-personne",
                "ECG 12 dérivations"
            ],
            lieu: "Box des urgences"
        },
        consignesPatient: {
            identite: { prenom: "Jean", nom: "Dupont", age: 65, sexe: "M" },
            personnalite: "Patient anxieux et essoufflé, obligé de dormir avec 3 oreillers depuis plusieurs nuits.",
            phraseOuverture: "Bonjour docteur, je n'arrive plus à respirer dès que je fais quelques pas, et depuis dix jours mes chevilles ont triplé de volume. Je n'arrive plus à dormir à plat.",
            infosVolontaires: [
                "Dyspnée d'effort devenue de repos, orthopnée à 3 oreillers",
                "Prise de poids rapide de 4 kilos en deux semaines avec œdèmes prenant le godet"
            ],
            infosSiDemandees: [
                "Hypertension artérielle ancienne traitée par IEC",
                "A mangé de la choucroute et des charcuteries très salées lors d'un repas de famille récent",
                "Absence de fièvre ou de douleur thoracique aiguë"
            ],
            infosCachees: [
                "A oublié de reprendre son diurétique il y a une semaine"
            ],
            questionsPieges: [
                "Docteur, est-ce que mon cœur est en train de lâcher définitivement ?",
                "Pourquoi vous voulez que je me pèse tous les matins ?"
            ],
            reactions: {
                brutal: "Vous dites que j'ai de l'eau dans les poumons ? C'est grave docteur ?",
                silence: "Docteur, je suis très essoufflé, pouvez-vous me relever le dossier du lit ?",
                jargon: "Pardon docteur, qu'est-ce que vous entendez par « fraction d'éjection » ?"
            }
        },
        consignesEvaluateur: {
            pointCle: "Le candidat doit reconnaître une poussée d'insuffisance cardiaque globale à prédominance gauche congestive décompensée (OAP subaigu), identifier le facteur déclenchant (écart de sel/écart de traitement), ausculter les crépitants et prescrire diurétiques de l'anse et ETT.",
            erreursRedhibitoires: [
                "Perfuser du sérum physiologique chez un insuffisant cardiaque congestif",
                "Négliger la recherche du facteur déclenchant de décompensation",
                "Omettre la surveillance de la fonction rénale et de la kaliémie sous diurétiques"
            ],
            elementsAttendus: [
                "Caractérisation des signes congestifs gauches (orthopnée, crépitants) et droits (oedèmes godet, TJ, RHJ)",
                "Mise en évidence du facteur déclenchant (écart sodé, mauvaise observance)",
                "Examens paracliniques : ECG, radiographie thoracique, BNP ou NT-proBNP, ETT",
                "Prescription de Furosémide IV ou per os, restriction hydrosodée (< 4-6 g sel/j)",
                "Éducation thérapeutique : autosurveillance quotidienne du poids, signes d'alerte EPOF"
            ],
            grille: [
                { id: "eval_congestif", label: "Recherche les signes congestifs gauches (orthopnée) et droits (œdèmes, RHJ)", weight: 1 },
                { id: "eval_facteur_declenchant", label: "Identifie le facteur déclenchant (écart de régime sans sel, observance)", weight: 1 },
                { id: "eval_auscultation_ic", label: "Ausculte les crépitants pulmonaires bilatéraux et recherche un galop B3", weight: 1 },
                { id: "eval_bilan_ic", label: "Prescrit les examens complémentaires clés (BNP, radio thorax, ETT, ionogramme)", weight: 1 },
                { id: "eval_traitement_depletif", label: "Instaure le traitement diurétique et explique les règles d'autosurveillance pondérale", weight: 1 }
            ]
        }
    },
    {
        oldFile: 'cardio_insuffisancecardiaque_denny.json',
        newFile: 'cardio_dyspnee_fatigue_m_duquette.json',
        newId: 'cardio_dyspnee_fatigue_m_duquette',
        motif: "Dyspnée sévère et fatigue chez l'adulte jeune",
        itemR2C: "Item 234. Insuffisance cardiaque de l'adulte. Item 235. Cardiomyopathies.",
        consignesEtudiant: {
            role: "Vous êtes interne en réanimation cardiologique ou en cardiologie spécialisée.",
            contexte: "Vous recevez M. Denny Duquette, 39 ans, suivi pour cardiomyopathie dilatée sévère, qui consulte pour une aggravation majeure de sa dyspnée d'effort devenue de repos, avec asthénie intense.",
            dureeMinutes: 8,
            consignes: [
                "Évaluer la sévérité de l'atteinte myocardique avancée et rechercher les signes de bas débit cardiaque",
                "Rechercher les antécédents, l'étiologie de la cardiomyopathie et le traitement optimisé en cours",
                "Réaliser un examen hémodynamique complet (constantes, auscultation, marbrures, temps de recoloration)",
                "Proposer le bilan biologique et hémodynamique adapté",
                "Discuter l'orientation vers une structure spécialisée (assistance circulatoire, transplantation)"
            ],
            interdits: [
                "Ne pas introduire de traitement inotrope négatif en phase d'hypoperfusion",
                "Ne pas sous-estimer le risque de choc cardiogénique"
            ],
            materielDisponible: [
                "Stéthoscope",
                "Tensiomètre",
                "Oxymètre de pouls",
                "Scope multiparamétrique",
                "ECG 12 dérivations"
            ],
            lieu: "Box de déchocage / USIC"
        },
        consignesPatient: {
            identite: { prenom: "Denny", nom: "Duquette", age: 39, sexe: "M" },
            personnalite: "Patient jeune, épuisé par sa maladie chronique, souffle court, phrases brèves.",
            phraseOuverture: "Bonjour docteur... je n'en peux plus... je m'essouffle rien qu'en parlant, et mes jambes sont glacées.",
            infosVolontaires: [
                "Dyspnée permanente de repos (stade IV NYHA)",
                "Épuisement musculaire complet, incapable de monter un étage"
            ],
            infosSiDemandees: [
                "Cardiomyopathie dilatée idiopathique connue avec FE altérée à 20%",
                "Traitement médical maximal quadrithérapie toléré à faibles doses",
                "Absence de douleur thoracique aiguë"
            ],
            infosCachees: [
                "A très peur de mourir et cache son angoisse derrière un détachement apparent"
            ],
            questionsPieges: [
                "Docteur, est-ce que mon cœur arrive au bout du rouleau ?",
                "Est-ce qu'une greffe cardiaque est ma seule issue ?"
            ],
            reactions: {
                brutal: "Docteur, ne me cachez rien, combien de temps il me reste avec ce cœur ?",
                silence: "Laissez-moi reprendre mon souffle un instant, s'il vous plaît...",
                jargon: "Pardon docteur, qu'est-ce qu'un « cœur artificiel » ou une assistance ?"
            }
        },
        consignesEvaluateur: {
            pointCle: "Le candidat doit reconnaître une insuffisance cardiaque terminale avec fraction d'éjection sévèrement altérée chez un sujet jeune, rechercher les signes de bas débit (hypoperfusion), optimiser la surveillance et évoquer les thérapeutiques de recours (assistance VG, transplantation).",
            erreursRedhibitoires: [
                "Méconnaître les signes de choc cardiogénique (hypotension, marbrures, oligurie)",
                "Arrêter brutalement tous les traitements sans avis cardiologique spécialisé",
                "Négliger l'orientation urgente vers un centre de transplantation cardiaque"
            ],
            elementsAttendus: [
                "Évaluation hémodynamique complète (PA, FC, SpO2, perfusion périphérique)",
                "Recherche des signes congestifs et de bas débit",
                "Bilan paraclinique : lactate, ionogramme, créatinine, troponine, NT-proBNP, ETT urgente",
                "Prise en charge en USIC avec monitorage continu",
                "Discussion pluridisciplinaire des options thérapeutiques avancées"
            ],
            grille: [
                { id: "eval_severite_hemo", label: "Évalue la sévérité hémodynamique et recherche les signes d'hypoperfusion", weight: 1 },
                { id: "eval_examen_ic_avancee", label: "Réalise un examen cardiovasculaire complet (auscultation, signes droits)", weight: 1 },
                { id: "eval_bilan_biologique", label: "Prescrit les bilans d'organe et marqueurs de défaillance (lactates, créat, iono, peptides)", weight: 1 },
                { id: "eval_ett_urgente", label: "Pose l'indication d'une ETT urgente avec évaluation de la FE et des pressions", weight: 1 },
                { id: "eval_orientation_recours", label: "Organise l'admission en soins intensifs et la filière transplantation / assistance", weight: 1 }
            ]
        }
    },
    {
        oldFile: 'cardio_insuffisancecardiaque_ellis.json',
        newFile: 'cardio_dyspnee_effort_mme_grey.json',
        newId: 'cardio_dyspnee_effort_mme_grey',
        motif: "Dyspnée d'effort d'aggravation progressive",
        itemR2C: "Item 234. Insuffisance cardiaque de l'adulte (FE préservée).",
        consignesEtudiant: {
            role: "Vous êtes médecin généraliste ou cardiologue en consultation.",
            contexte: "Vous recevez Mme Ellis Grey, 62 ans, hypertendue et en surpoids, qui consulte pour une limitation progressive de ses activités quotidiennes en raison d'un essoufflement d'effort.",
            dureeMinutes: 8,
            consignes: [
                "Caractériser la dyspnée d'effort et évaluer l'impact sur l'autonomie",
                "Rechercher les facteurs favorisants et comorbidités cardiovasculaires (HTA, surpoids, diabète, FA)",
                "Réaliser un examen clinique complet (recherche de signes de surcharge veineuse)",
                "Proposer les examens complémentaires (BNP/NT-proBNP, ETT avec doppler tissulaire)",
                "Présenter la stratégie thérapeutique et les mesures de contrôle tensionnel et pondéral"
            ],
            interdits: [
                "Ne pas affirmer qu'une fraction d'éjection normale élimine une insuffisance cardiaque",
                "Ne pas méconnaître l'indication des inhibiteurs du SGLT2 (gliflozines)"
            ],
            materielDisponible: [
                "Stéthoscope",
                "Tensiomètre",
                "ECG 12 dérivations",
                "Balance"
            ],
            lieu: "Cabinet de consultation"
        },
        consignesPatient: {
            identite: { prenom: "Ellis", nom: "Grey", age: 62, sexe: "F" },
            personnalite: "Femme active, exigeante, frustrée de ne plus pouvoir accomplir ses tâches habituelles sans s'essouffler.",
            phraseOuverture: "Bonjour docteur, j'ai toujours été très active, mais depuis plusieurs mois, monter un étage est devenu un calvaire. Je suis essoufflée comme jamais.",
            infosVolontaires: [
                "Dyspnée d'effort d'installation insidieuse depuis 6 mois",
                "Prise de poids modérée mais persistante"
            ],
            infosSiDemandees: [
                "Hypertension artérielle ancienne traitée irrégulièrement",
                "Surpoids (IMC 29 kg/m²)",
                "Épisodes occasionnels de palpitations rapides"
            ],
            infosCachees: [
                "A arrêté son traitement antihypertenseur il y a 3 mois car elle se sentait bien"
            ],
            questionsPieges: [
                "Docteur, mon échographie cardiaque de l'an dernier disait que mon cœur pompait à 60%, comment puis-je être en insuffisance cardiaque ?",
                "Est-ce que c'est juste mon surpoids et mon manque d'entraînement ?"
            ],
            reactions: {
                brutal: "Vous dites que mon cœur est rigide ? C'est irréversible ?",
                silence: "Docteur, vous avez l'air très concentré sur mon souffle au cœur...",
                jargon: "Pardon docteur, qu'est-ce qu'une « dysfonction diastolique » ?"
            }
        },
        consignesEvaluateur: {
            pointCle: "Le candidat doit reconnaître le profil typique d'une insuffisance cardiaque à fraction d'éjection préservée (HFpEF) chez une patiente hypertendue en surpoids, comprendre qu'une FE normale n'élimine pas l'IC, prescrire le dosage des peptides natriurétiques et l'ETT avec étude du flux mitral et doppler tissulaire, et poser l'indication des gliflozines (iSGLT2) et du contrôle de l'HTA.",
            erreursRedhibitoires: [
                "Éliminer une insuffisance cardiaque au seul motif d'une fraction d'éjection ventriculaire gauche normale",
                "Omettre de doser le BNP/NT-proBNP",
                "Négliger le contrôle strict des chiffres tensionnels"
            ],
            elementsAttendus: [
                "Reconnaissance des symptômes d'insuffisance cardiaque (dyspnée d'effort)",
                "Identification des comorbidités clés (HTA mal contrôlée, surpoids, âge)",
                "Examen clinique : recherche de signes congestifs discrets, mesure PA aux deux bras",
                "Prescription : NT-proBNP, ECG (recherche FA, HVG), ETT avec critères diastoliques (E/e', volume OG)",
                "Traitement : diurétique si congestion, iSGLT2 (Empagliflozine/Dapagliflozine), réintroduction antihypertenseur"
            ],
            grille: [
                { id: "eval_semiologie_hfpef", label: "Caractérise la dyspnée et identifie le profil évocateur d'IC à FE préservée", weight: 1 },
                { id: "eval_comorbidites", label: "Recherche et évalue les facteurs favorisants (HTA, surpoids, observance)", weight: 1 },
                { id: "eval_examen_clinique", label: "Réalise la prise de pression artérielle et l'auscultation cardiopulmonaire", weight: 1 },
                { id: "eval_paraclinique_diastole", label: "Prescrit le bilan biologique (NT-proBNP) et l'ETT centrée sur la fonction diastolique", weight: 1 },
                { id: "eval_strategie_therapeutique", label: "Instaure la prise en charge adaptée (iSGLT2, diurétique, contrôle tensionnel strict)", weight: 1 }
            ]
        }
    }
];

// Doublons à archiver
const DUPLICATES_TO_ARCHIVE = [
    'cardio_insuffisancecardiaque_burke.json',
    'cardio_insuffisancecardiaque_webber.json'
];

console.log(`\n🚀 Début de la migration de ${CARDIO_MIGRATIONS.length} cas de cardiologie...\n`);

for (const mig of CARDIO_MIGRATIONS) {
    const oldPath = join(DATA_DIR, mig.oldFile);
    const newPath = join(DATA_DIR, mig.newFile);
    const srcPath = existsSync(oldPath) ? oldPath : (existsSync(newPath) ? newPath : null);

    if (!srcPath) {
        console.warn(`  ⚠️ Fichier source introuvable : ${mig.oldFile} ou ${mig.newFile}, passage au suivant.`);
        continue;
    }

    const data = JSON.parse(readFileSync(srcPath, 'utf8'));

    // 1. Mise à jour des champs d'identification
    data.id = mig.newId;
    data.motif = mig.motif;

    // 2. Nettoyage identité patient
    if (mig.consignesPatient.identite) {
        data.patient.nom = mig.consignesPatient.identite.nom;
        data.patient.prenom = mig.consignesPatient.identite.prenom;
        data.patient.age = mig.consignesPatient.identite.age;
        data.patient.sexe = mig.consignesPatient.identite.sexe;
    }

    // 3. Bloc ECOS 4 volets officiel
    data.ecos = data.ecos || {};
    data.ecos.titre = mig.motif;
    data.ecos.itemR2C = mig.itemR2C;
    data.ecos.consignesEtudiant = mig.consignesEtudiant;
    data.ecos.consignesPatient = mig.consignesPatient;
    data.ecos.consignesEvaluateur = mig.consignesEvaluateur;

    // Rétrocompatibilité : synchronisation de vignette et patientStandardise sans fuite de diagnostic
    data.ecos.vignette = {
        role: mig.consignesEtudiant.role,
        contexte: mig.consignesEtudiant.contexte,
        consignesAttendues: [...mig.consignesEtudiant.consignes],
        consignesInterdites: [...mig.consignesEtudiant.interdits],
        typeStation: "AVEC_PS",
        domainePrincipal: "Entretien/Interrogatoire",
        domaineSecondaire: "Stratégie pertinente de PEC",
        lieu: mig.consignesEtudiant.lieu,
        materielDisponible: [...mig.consignesEtudiant.materielDisponible]
    };

    data.ecos.patientStandardise = {
        phraseOuverture: mig.consignesPatient.phraseOuverture,
        infosVolontaires: [...mig.consignesPatient.infosVolontaires],
        infosSiDemandees: [...mig.consignesPatient.infosSiDemandees],
        infosCachees: [...mig.consignesPatient.infosCachees],
        reactions: { ...mig.consignesPatient.reactions },
        personnalite: mig.consignesPatient.personnalite
    };

    // Assurer la présence des grilles
    data.ecos.grilleAptitudesCliniques = data.ecos.grilleAptitudesCliniques || data.ecos.consignesEvaluateur.grille.map(g => ({
        id: g.id,
        label: g.label,
        weight: g.weight || 1
    }));
    data.ecos.grilleCommunication = data.ecos.grilleCommunication || [
        { id: "ecoute_active", label: "Écoute active — laisse le patient s'exprimer sans l'interrompre", max: 1 },
        { id: "empathie", label: "Fait preuve d'empathie et d'attitude bienveillante", max: 1 },
        { id: "clarte", label: "Utilise un vocabulaire clair et adapté, sans jargon inexpliqué", max: 1 },
        { id: "structure", label: "Structure la consultation de façon ordonnée et logique", max: 1 },
        { id: "verification", label: "Vérifie la bonne compréhension et invite aux questions", max: 1 }
    ];

    // Correction minimale si trop courte
    if (!data.correction || data.correction.length < 100) {
        data.correction = `# Cas ECOS : ${mig.motif}\n\n## Diagnostic retenu : ${data.correctDiagnostic}\n\n### Conduite à tenir\nPrise en charge conforme aux recommandations de la Société Française de Cardiologie (SFC) et de l'ESC. Évaluation clinique, réalisation des examens de première intention et surveillance adaptée.`;
    }

    // Cohérence availableExams / relevantExams
    if (Array.isArray(data.relevantExams)) {
        data.availableExams = data.availableExams || [];
        for (const exam of data.relevantExams) {
            if (!data.availableExams.includes(exam)) {
                data.availableExams.push(exam);
            }
        }
    }

    // Écriture du nouveau fichier
    writeFileSync(newPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`  ✅ Créé : ${mig.newFile} (motif: "${mig.motif}")`);

    // Suppression de l'ancien fichier s'il a un nom différent
    if (mig.oldFile !== mig.newFile && existsSync(oldPath)) {
        unlinkSync(oldPath);
        console.log(`     🗑️  Ancien fichier supprimé : ${mig.oldFile}`);
    }
}

// 2. Archivage des doublons IC
console.log('\n📦 Archivage des doublons d\'insuffisance cardiaque...');
for (const dup of DUPLICATES_TO_ARCHIVE) {
    const dupPath = join(DATA_DIR, dup);
    if (existsSync(dupPath)) {
        const destPath = join(ARCHIVE_DIR, dup);
        writeFileSync(destPath, readFileSync(dupPath, 'utf8'), 'utf8');
        unlinkSync(dupPath);
        console.log(`  📁 Archivé dans data/archive/ : ${dup}`);
    }
}

// 3. Mise à jour de data/case-index.json
console.log('\n🗂️  Mise à jour de data/case-index.json...');
if (existsSync(INDEX_PATH)) {
    const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
    index.cardiologie = CARDIO_MIGRATIONS.map(m => m.newFile);
    writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf8');
    console.log(`  ✅ Section cardiologie mise à jour avec ${index.cardiologie.length} cas.`);
}

console.log('\n✨ Migration terminée avec succès !\n');
