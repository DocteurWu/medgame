import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createCase(id, title, patient, nodesData) {
    const nodes = {};
    const editorNodes = [];
    const editorConnections = [];

    // Automatically build nodes and miniGraph
    let connCounter = 1;

    nodesData.forEach((n, index) => {
        nodes[n.id] = {
            id: n.id,
            descriptionClinique: n.desc,
            constantesCibles: n.constantes || {
                tension: "120/80",
                pouls: "70",
                saturationO2: "98",
                temperature: "37",
                frequenceRespiratoire: "16"
            },
            actionsDisponibles: (n.actions || []).map(a => ({
                label: a.label,
                tempsExecutionSec: a.time || 30,
                feedback: a.feedback,
                nextNode: a.next
            })),
            isEndState: !!n.isEnd,
            success: n.success !== false
        };

        editorNodes.push({
            id: n.id,
            x: 100 + (index % 3) * 300,
            y: 100 + Math.floor(index / 3) * 200,
            name: n.name || n.id,
            descriptionClinique: n.desc,
            constantesCibles: nodes[n.id].constantesCibles,
            isEndState: !!n.isEnd,
            success: n.success !== false
        });

        if (n.actions) {
            n.actions.forEach(a => {
                editorConnections.push({
                    id: `conn_${connCounter++}_${Date.now()}`,
                    fromId: n.id,
                    toId: a.next,
                    label: a.label,
                    tempsExecutionSec: a.time || 30,
                    feedback: a.feedback
                });
            });
        }
    });

    return {
        id,
        title,
        specialty: "urgence",
        difficulty: 1,
        redacteur: "Dr. Demo",
        patient: {
            nom: patient.nom || "Doe",
            prenom: patient.prenom || "John",
            age: patient.age || 45,
            sexe: patient.sexe || "M",
            taille: patient.taille || "180 cm",
            poids: patient.poids || "80 kg",
            groupeSanguin: patient.groupe || "A+"
        },
        interrogatoire: {
            motifHospitalisation: title,
            modeDeVie: { activitePhysique: { description: "ND" }, tabac: { quantite: "ND", duree: "ND" }, alcool: { quantite: "ND" }, alimentation: { regime: "ND", particularites: "ND" }, emploi: { profession: "ND", stress: "ND" } },
            antecedents: { medicaux: [], chirurgicaux: [], familiaux: [] },
            traitements: [],
            allergies: { presence: false, liste: [] },
            histoireMaladie: { debutSymptomes: "Brutal", evolution: "Aiguë", facteursDeclenchants: "Aucun", descriptionDouleur: "Variable", asymptomesAssocies: [], remarques: "Cas de démonstration secouriste" },
            verbatim: "..."
        },
        examenClinique: {
            constantes: { tension: "120/80 mmHg", pouls: "70 bpm", temperature: "37°C", saturationO2: "98%", frequenceRespiratoire: "16/min" },
            aspectGeneral: "Variable selon le cas",
            examenCardiovasculaire: { auscultation: "ND", inspection: "ND", palpation: "ND" },
            examenPulmonaire: { auscultation: "ND", inspection: "ND", percussion: "ND" },
            examenAbdominal: { palpation: "ND", auscultation: "ND" }
        },
        availableExams: [],
        examResults: {},
        possibleDiagnostics: [],
        correctDiagnostic: "",
        scoringRules: { baseScore: 100, attemptPenalty: 10 },
        possibleTreatments: [],
        correctTreatments: [],
        fatalTreatments: [],
        correction: `# Correction : ${title}\nCe cas illustre la prise en charge d'urgence au niveau secouriste.`,
        correctionImage: null,
        feedback: { default: "Terminé." },
        locks: [],
        postGameQuestions: [],
        gameplayConfig: {
            startNode: Object.keys(nodes)[0]
        },
        nodes: nodes,
        editorData: {
            miniGraph: {
                nodes: editorNodes,
                connections: editorConnections
            }
        }
    };
}

const cases = [
    // CAS 1: Arrêt Cardio-Respiratoire (ACR) - Complexifié
    createCase("urgence_demo_acr", "Arrêt Cardio-Respiratoire (ACR)", { nom: "Martin", age: 58 }, [
        {
            id: "s1", name: "Sécurité & Conscience", desc: "Un homme s'effondre au sol dans un centre commercial. La zone semble sûre.", actions: [
                { label: "Vérifier la conscience (Appeler, secouer, stimuler)", next: "s2", feedback: "Aucune réponse, aucun mouvement." },
                { label: "Pratiquer un massage cardiaque immédiat", next: "s_err_direct", feedback: "Vous n'avez pas encore vérifié s'il respire !" }
            ]
        },
        {
            id: "s2", name: "Appel à l'aide", desc: "La victime est inconsciente. Vous êtes entouré de quelques passants.", actions: [
                { label: "Crier 'A l'aide !', demander un DAE", next: "s3", feedback: "Un témoin s'arrête. Vous lui demandez de chercher un DAE." },
                { label: "Sortir votre téléphone pour appeler le 15 seul", next: "s_err_solo", feedback: "Vous perdez des secondes précieuses sans libérer les voies aériennes." }
            ]
        },
        {
            id: "s3", name: "LVA & Respiration", desc: "Le témoin cherche le DAE. Vous êtes au sol avec la victime.", actions: [
                { label: "LVA et vérifier la respiration (10s)", next: "s4", feedback: "Ventre et poitrine ne bougent pas. Aucun souffle." },
                { label: "Mettre en PLS par précaution", next: "s_err_pls", feedback: "ERRARE : On ne met jamais en PLS une victime qui ne respire pas !" }
            ]
        },
        {
            id: "s4", name: "Alerte & Massage", desc: "La victime est en arrêt. Le DAE n'est pas encore là.", actions: [
                { label: "Alerter le 15, donner l'adresse précise et débuter RCP", next: "s5", feedback: "Le 15 est en ligne. Vous commencez les compressions (30:2)." },
                { label: "Chercher le DAE vous-même en laissant la victime", next: "s_err_abandon", feedback: "La victime reste sans massage trop longtemps." }
            ]
        },
        {
            id: "s5", name: "Arrivée du DAE", desc: "Après 2 cycles de RCP, le témoin revient avec un DAE.", actions: [
                { label: "Allumer le DAE et suivre les instructions vocales", next: "s6", feedback: "Le DAE analyse... 'Choc recommandé, ne touchez pas la victime'." },
                { label: "Continuer le massage sans s'occuper du DAE", next: "s_err_nodae", feedback: "Le DAE est la priorité absolue pour choquer un rythme fibrillant." }
            ]
        },
        {
            id: "s6", name: "Choc & Reprise", desc: "Le choc est délivré. La victime a un sursaut mais ne bouge pas plus.", actions: [
                { label: "Reprendre immédiatement la RCP (compressions)", next: "s7_good", feedback: "Vous reprenez le massage comme demandé par l'appareil." },
                { label: "Attendre que le DAE analyse à nouveau", next: "s_err_pause", feedback: "Il faut masser entre les analyses (2 minutes) !" }
            ]
        },
        // ENDINGS
        { id: "s7_good", name: "Succès : RCP efficace", desc: "Les pompiers arrivent. Grâce à votre massage précoce et au choc, le cœur repart au premier Scope. Bravo !", isEnd: true, success: true },
        { id: "s_err_direct", name: "Échec : Procédure inversée", desc: "Masser une personne qui dort ou qui a juste fait un malaise sans vérifier est une faute grave.", isEnd: true, success: false },
        { id: "s_err_solo", name: "Échec : Management témoin", desc: "En situation d'urgence, déléguer la recherche du DAE est vital pour rester auprès de la victime.", isEnd: true, success: false },
        { id: "s_err_pls", name: "Échec : Erreur fatale PLS", desc: "Mettre un ACR en PLS garantit le décès par hypoxie cérébrale.", isEnd: true, success: false },
        { id: "s_err_abandon", name: "Échec : Abandon de poste", desc: "Le cerveau meurt en 4 minutes. Votre absence a été fatale.", isEnd: true, success: false },
        { id: "s_err_nodae", name: "Échec : Perte de chance", desc: "Ne pas utiliser le DAE disponible réduit les chances de survie de 90% à 5%.", isEnd: true, success: false },
        { id: "s_err_pause", name: "Échec : Pauses trop longues", desc: "Le sang s'arrête de circuler dès que vous arrêtez de masser. Les organes sont lésés.", isEnd: true, success: false }
    ]),

    // CAS 2: Hémorragie Externe Grave - Complexifié
    createCase("urgence_demo_hemorragie", "Hémorragie Massive (Section Artérielle)", { nom: "Julien", age: 24 }, [
        {
            id: "s1", name: "La Scie Circulaire", desc: "Julien s'est coupé la cuisse. Un sang rouge vif gicle en jets pulsatiles (hémorragie artérielle).", actions: [
                { label: "Comprimer immédiatement la plaie avec la main", next: "s2", feedback: "Vous saturez la plaie de pression. Le saignement diminue." },
                { label: "Chercher une trousse de secours", next: "s_err_lost", feedback: "Chaque seconde compte, la flaque de sang s'agrandit de façon critique." }
            ]
        },
        {
            id: "s2", name: "Compression Insuffisante", desc: "Le sang continue de couler malgré votre main. Julien pâlit et devient confus.", actions: [
                { label: "Apposer un pansement compressif (Chut)", next: "s3_failed_comp", feedback: "Le pansement est traversé instantanément par le flux." },
                { label: "Poser un garrot tactique (ou improvisé) au-dessus", next: "s4", feedback: "Vous serrez le garrot sur le haut de la cuisse." }
            ]
        },
        {
            id: "s3_failed_comp", name: "Aggravation", desc: "La compression simple échoue. Julien a soif et son pouls est filant.", actions: [
                { label: "Maintenir la compression et poser un 2ème pansement", next: "s_err_shock", feedback: "Trop tard, il entre en choc hémorragique sévère." },
                { label: "Passer au garrot immédiatement", next: "s4", feedback: "Dernière chance saisie." }
            ]
        },
        {
            id: "s4", name: "Garrot Posé", desc: "Le saignement s'arrête enfin totalement. Julien est livide.", actions: [
                { label: "Noter l'heure de pose du garrot", next: "s5", feedback: "Heure notée : 23:45. Vital pour les chirurgiens." },
                { label: "Desserrer le garrot pour voir si ça saigne encore", next: "s_err_loose", feedback: "ERRARE : On ne desserre JAMAIS un garrot !" }
            ]
        },
        {
            id: "s5", name: "Bilan Complémentaire", desc: "Le garrot est en place. Julien respire vite (25/min).", actions: [
                { label: "Allonger la victime, jambes surélevées et couvrir", next: "s6", feedback: "Lutte contre l'état de choc et l'hypothermie." },
                { label: "Lui donner à boire (grande soif)", next: "s_err_drink", feedback: "Interdit. Risque d'inhalation lors de l'anesthésie imminente." }
            ]
        },
        {
            id: "s6", name: "Alerte SAMU", desc: "Vous faites l'alerte précise au 15.", actions: [
                { label: "Passer le bilan complet : Garrot + Signes de choc", next: "s7_good", feedback: "Le régulateur envoie un SMUR et prépare le déchoquage." }
            ]
        },
        // ENDINGS
        { id: "s7_good", name: "Succès : Vie sauvée", desc: "Grâce au garrot précoce, Julien arrive vivant au bloc opératoire. Votre sang-froid a fait la différence.", isEnd: true, success: true },
        { id: "s_err_lost", name: "Échec : Perte de temps", desc: "Une section fémorale peut tuer en 2 minutes. Chercher du matériel sans comprimer est fatal.", isEnd: true, success: false },
        { id: "s_err_shock", name: "Échec : Choc irréversible", desc: "Le sang perdu ne se remplace pas sur place. Le retard du garrot a causé l'arrêt cardiaque.", isEnd: true, success: false },
        { id: "s_err_loose", name: "Échec : Faute technique", desc: "Le desserrage provoque un relargage de toxines et une reprise de l'hémorragie massive.", isEnd: true, success: false },
        { id: "s_err_drink", name: "Échec : Complication pré-op", desc: "L'aspiration gastrique a compliqué son sauvetage au bloc.", isEnd: true, success: false }
    ]),

    // CAS 3: Étouffement (Obstruction Voies Aériennes)
    createCase("urgence_demo_obstruction", "Obstruction Totale (Étouffement)", { nom: "Sophie", age: 35 }, [
        {
            id: "s1", name: "Scène au Repas", desc: "Sophie se lève brusquement, ne peut plus parler, porte les mains à sa gorge et devient bleue (cyanose).", actions: [
                { label: "Lui demander : 'Est-ce que vous vous étouffez ?'", next: "s2", feedback: "Elle acquiesce de la tête, incapable de produire un son." },
                { label: "Lui taper dans le dos immédiatement", next: "s3_claques", feedback: "Vous commencez les claques sans bilan, mais c'est efficace." }
            ]
        },
        {
            id: "s2", name: "Diagnostic Différentiel", desc: "C'est une obstruction TOTALE (pas de toux, pas de bruit).", actions: [
                { label: "Pratiquer 5 claques vigoureuses dans le dos", next: "s3_claques", feedback: "Vous penchez Sophie en avant et frappez entre les omoplates." },
                { label: "L'aider à boire un verre d'eau", next: "s_err_water", feedback: "L'eau aggrave l'obstruction par dessus le corps étranger." }
            ]
        },
        {
            id: "s3_claques", name: "Échec des Claques", desc: "Après 5 claques, le corps étranger n'est toujours pas sorti. Sophie s'épuise.", actions: [
                { label: "Passer à la manoeuvre de Heimlich (compressions abd)", next: "s4", feedback: "Vous vous placez derrière elle, poing au dessus du nombril." },
                { label: "Continuer les claques à l'infini", next: "s_err_time", feedback: "L'inefficacité des claques impose le changement de technique." }
            ]
        },
        {
            id: "s4", name: "Manœuvre de Heimlich", desc: "Vous exercez des pressions sèches vers l'arrière et le haut.", actions: [
                { label: "Le corps étranger est expulsé violemment", next: "s5_victory", feedback: "Le morceau de viande ressort. Sophie inspire à pleins poumons." },
                { label: "Sophie perd connaissance et s'effondre", next: "s_unconscious", feedback: "L'obstruction a causé une hypoxie trop longue." }
            ]
        },
        {
            id: "s_unconscious", name: "Passage en ACR", desc: "Elle ne réagit plus et ne respire plus.", actions: [
                { label: "Débuter immédiatement une RCP (massages)", next: "s6_resus", feedback: "Le massage peut aider à mobiliser le corps étranger." }
            ]
        },
        {
            id: "s5_victory", name: "Post-Expulsion", desc: "Elle respire mais est très choquée. Elle a mal au ventre.", actions: [
                { label: "Appeler le 15 pour avis médical obligatoire", next: "s7_good", feedback: "Essentiel car Heimlich peut causer des lésions internes." },
                { label: "La laisser repartir car elle respire", next: "s_err_injury", feedback: "Risque de rupture d'organe non détectée." }
            ]
        },
        // ENDINGS
        { id: "s7_good", name: "Succès : Sauvetage parfait", desc: "Le corps étranger est sorti. Le médecin confirme l'absence de lésion. Bravo.", isEnd: true, success: true },
        { id: "s6_resus", name: "Succès Partiel : Réanimation", desc: "Grâce à votre prise en charge de l'inconscience, le corps étranger a bougé et elle a été réanimée par le SAMU.", isEnd: true, success: true },
        { id: "s_err_water", name: "Échec : Noyade à sec", desc: "Verser de l'eau sur un bouchon alimentaire a provoqué un arrêt immédiat.", isEnd: true, success: false },
        { id: "s_err_time", name: "Échec : Perte de conscience", desc: "L'absence de Heimlich a conduit à une issue fatale faute d'oxygène.", isEnd: true, success: false },
        { id: "s_err_injury", name: "Échec : Complication interne", desc: "Sophie a fait une hémorragie interne 2 heures plus tard. Ne jamais négliger le suivi après Heimlich.", isEnd: true, success: false }
    ]),

    // CAS 4: Inconscient qui respire (PLS) - Enrichi
    createCase("urgence_demo_inconscient", "Inconscience et PLS", { nom: "Marc", age: 42 }, [
        {
            id: "s1", name: "Découverte Joggeur", desc: "Marc est au sol, inerte. Vous êtes le seul témoin sur ce chemin.", actions: [
                { label: "Vérifier la conscience et l'absence de trauma", next: "s2", feedback: "Inconscient. Pas de signe de chute évidente sur la tête." },
                { label: "Chercher ses papiers d'abord", next: "s_err_id", feedback: "La priorité est vitale, pas administrative !" }
            ]
        },
        {
            id: "s2", name: "Bilan Respiratoire", desc: "Vous ouvrez la bouche, rien n'obstrue. Vous écoutez le souffle.", actions: [
                { label: "Vérifier respiration pendant 10 secondes", next: "s3_respire", feedback: "Il respire. Fréquence : 14/min (Normal)." },
                { label: "Le secouer pour qu'il se réveille", next: "s_err_shake", feedback: "Inutile et dangereux s'il y a un trauma caché." }
            ]
        },
        {
            id: "s3_respire", name: "Décision PLS", desc: "Victime inconsciente qui respire sur le dos.", actions: [
                { label: "Mettre Marc en Position Latérale de Sécurité (PLS)", next: "s4", feedback: "Bras en équerre, jambe fléchie, basculement doucement." },
                { label: "Le laisser sur le dos en surveillant", next: "s_err_vomit", feedback: "Risque majeur d'étouffement par sa propre langue ou vomissement." }
            ]
        },
        {
            id: "s4", name: "Alerte & Surveillance", desc: "Il est sur le côté, stable. Sa bouche est ouverte vers le bas.", actions: [
                { label: "Alerter le 15 et rester à côté", next: "s5", feedback: "Le 15 demande de rester en ligne. 'Est-ce qu'il continue de respirer ?'" },
                { label: "S'éloigner pour aller chercher de l'aide", next: "s_err_away", feedback: "Il pourrait s'arrêter de respirer à tout moment sans que vous le sachiez." }
            ]
        },
        {
            id: "s5", name: "Incident en PLS", desc: "Marc a un mouvement de haut-le-cœur et vomit un peu de liquide.", actions: [
                { label: "Vérifier que le liquide s'écoule bien hors de la bouche", next: "s6_good", feedback: "Le liquide sort grâce à la gravité. Marc ne s'étouffe pas." },
                { label: "Le remettre sur le dos pour mieux nettoyer", next: "s_err_rebound", feedback: "Inhalation immédiate du vomi. Complication pulmonaire grave." }
            ]
        },
        // ENDINGS
        { id: "s6_good", name: "Succès : Protection assurée", desc: "Le SAMU arrive. La PLS a protégé ses poumons lors du vomissement. Diagnostic : Malaise vagal sévère.", isEnd: true, success: true },
        { id: "s_err_id", name: "Échec : Priorité", desc: "Pendant que vous cherchiez son nom, il s'est étouffé en silence sur le dos.", isEnd: true, success: false },
        { id: "s_err_shake", name: "Échec : Lésion aggravée", desc: "Il avait une fêlure cervicale. Votre mouvement l'a rendu tétraplégique.", isEnd: true, success: false },
        { id: "s_err_vomit", name: "Échec : Asphyxie mécanique", desc: "Sa langue est tombée au fond de la gorge, bloquant l'air. Arrêt cardiaque faute de PLS.", isEnd: true, success: false },
        { id: "s_err_rebound", name: "Échec : Pneumopathie d'inhalation", desc: "Le vomi a fini dans ses poumons. Il est en réanimation pour infection massive.", isEnd: true, success: false },
        { id: "s_err_away", name: "Échec : Surveillance", desc: "Le SAMU est arrivé, il était en arrêt depuis 5 minutes. Personne n'a vu quand il a cessé de respirer.", isEnd: true, success: false }
    ]),

    // CAS 5: Brûlure Grave (Chimique vs Thermique)
    createCase("urgence_demo_brulure", "Brûlure Chimique Intensive", { nom: "Lucas", age: 19 }, [
        {
            id: "s1", name: "Incident Laboratoire", desc: "Lucas vient de renverser un bidon d'acide chlorhydrique sur ses mains et ses jambes.", actions: [
                { label: "Rincer abondamment à l'eau courante (tempérée)", next: "s2", feedback: "Rallongement du rinçage immédiat." },
                { label: "Essuyer le produit avec du papier absorbant", next: "s_err_paper", feedback: "L'acide pénètre encore plus sous la pression de l'essuyage." },
                { label: "Chercher un produit pour neutraliser l'acide", next: "s_err_neutral", feedback: "La réaction chimique de neutralisation produit de la chaleur et brûle encore plus." }
            ]
        },
        {
            id: "s2", name: "Rinçage Prolongé", desc: "L'eau doit couler mais Lucas a froid au reste du corps.", actions: [
                { label: "Retirer les vêtements imbibés tout en rinçant", next: "s3", feedback: "Indispensable pour stopper l'action du produit chimique." },
                { label: "Appliquer de la pommade Biafine", next: "s_err_cream", feedback: "La pommade emprisonne le produit chimique dans la chair !" }
            ]
        },
        {
            id: "s3", name: "Durée du Soin", desc: "Le rinçage dure depuis 10 minutes. Lucas demande d'arrêter.", actions: [
                { label: "Maintenir le rinçage jusqu'à l'arrivée des secours", next: "s4", feedback: "En chimique, le rinçage doit être très long (parfois 30 min+)." },
                { label: "Arrêter dès que la douleur diminue un peu", next: "s_err_deep", feedback: "Le produit continue de ronger les couches profondes sans douleur immédiate." }
            ]
        },
        {
            id: "s4", name: "Alerte 15 détaillée", desc: "Vous transmettez le nom du produit (Acide HCl).", actions: [
                { label: "Protéger la zone rincée avec un champ propre (sans serrer)", next: "s5_good", feedback: "Empêche l'infection et l'hypothermie." }
            ]
        },
        // ENDINGS
        { id: "s5_good", name: "Succès : Lésion limitée", desc: "Le rinçage précoce et prolongé a évité la greffe de peau. Excellent réflexe.", isEnd: true, success: true },
        { id: "s_err_paper", name: "Échec : Brûlure mécanique", desc: "Vous avez décapé la peau déjà fragilisée par l'acide.", isEnd: true, success: false },
        { id: "s_err_neutral", name: "Échec : Choc thermique", desc: "Le mélange Acide/Base a littéralement 'cuit' les mains de Lucas.", isEnd: true, success: false },
        { id: "s_err_cream", name: "Échec : Aggravation chimique", desc: "L'acide a continué à agir sous la couche de crème grasse.", isEnd: true, success: false },
        { id: "s_err_deep", name: "Échec : Séquelles graves", desc: "Les tendons ont été atteints car l'acide n'avait pas été totalement éliminé.", isEnd: true, success: false }
    ]),

    // CAS 6: Malaise Cardiaque (IDM) - Enrichi
    createCase("urgence_demo_malaise", "Douleur Thoracique Suspecte", { nom: "Jean", age: 65 }, [
        {
            id: "s1", name: "Douleur Poitrine", desc: "Jean est assis, très pâle, transpire abondamment. Il dit avoir 'un poids énorme' sur le cœur.", actions: [
                { label: "Mettre Jean au repos strict (assis ou allongé)", next: "s2", feedback: "Position de confort adoptée. Diminution du travail cardiaque." },
                { label: "Lui donner de l'aspirine tout de suite", next: "s_err_drug", feedback: "Jamais de médicament sans l'avis formel du médecin régulateur du 15." }
            ]
        },
        {
            id: "s2", name: "Interrogatoire PQRST", desc: "La douleur est apparue au repos il y a 20 min. Elle va dans la mâchoire.", actions: [
                { label: "Appeler le 15 immédiatement (Alerte précoce)", next: "s3_appel", feedback: "Vous donnez les constantes : Pâleur, sueurs, douleur thoracique." },
                { label: "Attendre 10 min pour voir si ça passe", next: "s_err_wait", feedback: "Le muscle cardiaque meurt chaque minute. Le temps, c'est du muscle." }
            ]
        },
        {
            id: "s3_appel", name: "Consigne du Régulateur", desc: "Le médecin du 15 vous demande s'il a déjà fait un infarctus.", actions: [
                { label: "Interroger Jean sur ses antécédents", next: "s4", feedback: "Il a déjà eu un stent il y a 5 ans. Information cruciale." },
                { label: "Dire au médecin : 'Dépêchez-vous au lieu de poser des questions !'", next: "s_err_aggro", feedback: "Vous empêchez le tri médical, l'ambulance n'est pas envoyée avec le bon niveau d'urgence." }
            ]
        },
        {
            id: "s4", name: "Aggravation subite", desc: "Jean devient brusquement très essoufflé et commence à tousser (OAP suspecté).", actions: [
                { label: "Le maintenir assis verticalement", next: "s5_good", feedback: "Aide à libérer les poumons de la congestion." },
                { label: "L'allonger pour qu'il se repose mieux", next: "s_err_suffocation", feedback: "Il s'étouffe car le sang reflue dans ses poumons." }
            ]
        },
        {
            id: "s5_good", name: "Arrivée SMUR", desc: "Le SMUR arrive en 8 minutes. Vous donnez votre bilan.", actions: [
                { label: "Transmettre les antécédents et l'heure de début de douleur", next: "s6_victory", feedback: "Transmission parfaite." }
            ]
        },
        // ENDINGS
        { id: "s6_victory", name: "Succès : Prise en charge rapide", desc: "Jean est dirigé vers la coronarographie en urgence. Il s'en sort sans séquelles !", isEnd: true, success: true },
        { id: "s_err_drug", name: "Échec : Erreur médicamenteuse", desc: "Il était allergique ou ce n'était pas un IDM. Complication inutile.", isEnd: true, success: false },
        { id: "s_err_wait", name: "Échec : Nécrose étendue", desc: "L'infarctus a foudroyé son cœur avant l'appel tardif.", isEnd: true, success: false },
        { id: "s_err_aggro", name: "Échec : Retard de secours", desc: "Sans bilan clair, les secours sont arrivés sans matériel de réanimation.", isEnd: true, success: false },
        { id: "s_err_suffocation", name: "Échec : Étouffement positionnel", desc: "L'allongement a provoqué un arrêt respiratoire immédiat par défaillance cardiaque.", isEnd: true, success: false }
    ])
];


const dataPath = path.join(__dirname, 'data');
if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath);
}

cases.forEach(c => {
    fs.writeFileSync(path.join(dataPath, `${c.id}.json`), JSON.stringify(c, null, 2));
    console.log(`Généré : ${c.id}.json`);
});

// Update case-index.json
const indexPath = path.join(dataPath, 'case-index.json');
let indexData;
if (fs.existsSync(indexPath)) {
    indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
} else {
    indexData = { urgence: [] };
}

if (!indexData.urgence) {
    indexData.urgence = [];
}

cases.forEach(c => {
    if (!indexData.urgence.includes(`${c.id}.json`)) {
        indexData.urgence.push(`${c.id}.json`);
    }
});

fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
console.log('Mise à jour case-index.json avec les nouveaux cas.');
