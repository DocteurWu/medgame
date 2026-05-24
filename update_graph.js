// update_graph.js — Met à jour le graphe de progression d'urgence dans Supabase
// Usage: node update_graph.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes dans .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// GRAPHE DE PROGRESSION — UE URGENCES (22 cas, 6 chapitres)
// Progression pédagogique selon référentiel AFGSU / Paris Cité
// ============================================================
const graphContent = {
    savedAt: new Date().toISOString(),
    nextNodeId: 23,
    nextConnectionId: 27,
    transform: { x: 900, y: 100, scale: 0.45 },

    nodes: [
        // ── CHAPITRE 1 : Gestes de base ──────────────────────────────
        {
            id: 1, x: -800, y: 0,
            title: "Victime Inconsciente — PLS & Sécurisation",
            desc: "Gestes de secours de base : victime inconsciente qui respire.",
            caseId: "urgence_demo_inconscient",
            theme: "urgence", chapter: "Gestes de base"
        },
        {
            id: 2, x: -800, y: 220,
            title: "Obstruction des Voies Aériennes — Adulte (Démo)",
            desc: "Victime consciente qui s'étouffe brutalement. Manœuvre de Heimlich.",
            caseId: "urgence_demo_obstruction",
            theme: "urgence", chapter: "Gestes de base"
        },
        {
            id: 3, x: -400, y: 0,
            title: "Inconscient & PLS — Bar (Cas Avancé)",
            desc: "Inconscience totale dans un lieu public — maîtrise de la PLS.",
            caseId: "urgence_inconscient_pls_bar",
            theme: "urgence", chapter: "Gestes de base"
        },
        {
            id: 4, x: -400, y: 220,
            title: "Étouffement au Restaurant — Obstruction Totale Adulte",
            desc: "Obstruction totale des voies aériennes chez l'adulte dans un restaurant.",
            caseId: "urgence_obstruction_voa_adulte_restaurant",
            theme: "urgence", chapter: "Gestes de base"
        },
        {
            id: 5, x: -400, y: 440,
            title: "Obstruction des Voies Aériennes — Nourrisson",
            desc: "Obstruction chez un nourrisson — technique du dos / poitrine.",
            caseId: "urgence_obstruction_voa_nourrisson",
            theme: "urgence", chapter: "Gestes de base"
        },
        {
            id: 22, x: -800, y: 440,
            title: "Malaise — Démonstration Générale",
            desc: "Démonstration malaise général — bilan ABCDE et conduite à tenir.",
            caseId: "urgence_demo_malaise",
            theme: "urgence", chapter: "Gestes de base"
        },

        // ── CHAPITRE 2 : ACR & Réanimation ───────────────────────────
        {
            id: 6, x: 0, y: 0,
            title: "Arrêt Cardiaque — Démonstration RCP",
            desc: "Arrêt cardio-respiratoire : algorithme de réanimation basique.",
            caseId: "urgence_demo_acr",
            theme: "urgence", chapter: "ACR & Réanimation"
        },
        {
            id: 7, x: 400, y: 0,
            title: "Arrêt Cardiaque chez le Sportif",
            desc: "ACR sur sportif en bonne santé — défibrillation et RCP avancée.",
            caseId: "urgence_arret_cardiaque_sportive",
            theme: "urgence", chapter: "ACR & Réanimation"
        },

        // ── CHAPITRE 3 : Traumatismes ─────────────────────────────────
        {
            id: 8, x: 0, y: 220,
            title: "Malaise avec Traumatisme Rachidien",
            desc: "Malaise avec perte de conscience et traumatisme du rachis cervical.",
            caseId: "urgence_malaise_traumatisme_rachidien",
            theme: "urgence", chapter: "Traumatismes"
        },
        {
            id: 9, x: 0, y: 440,
            title: "Hémorragie Externe — Démonstration",
            desc: "Démonstration hémorragie externe : compression et garrot.",
            caseId: "urgence_demo_hemorragie",
            theme: "urgence", chapter: "Traumatismes"
        },
        {
            id: 10, x: 400, y: 220,
            title: "Traumatisme : Amputation de Membre",
            desc: "Amputation traumatique d'un membre — garrot et conditionnement.",
            caseId: "urgence_trauma_membre_amputation",
            theme: "urgence", chapter: "Traumatismes"
        },
        {
            id: 11, x: 400, y: 440,
            title: "Choc Hémorragique — Plaie Artérielle",
            desc: "Hémorragie artérielle sur plaie de membre — choc hémorragique.",
            caseId: "urgence_choc_hemorragique_art_membre",
            theme: "urgence", chapter: "Traumatismes"
        },
        {
            id: 12, x: 800, y: 0,
            title: "Traumatisme Crânien Grave",
            desc: "Traumatisme crânien grave avec troubles de la conscience.",
            caseId: "urgence_trauma_cranien_grave",
            theme: "urgence", chapter: "Traumatismes"
        },

        // ── CHAPITRE 4 : Brûlures ─────────────────────────────────────
        {
            id: 13, x: 0, y: 660,
            title: "Brûlure Thermique Étendue — Démonstration",
            desc: "Brûlure thermique étendue : évaluation SCB et premiers soins.",
            caseId: "urgence_demo_brulure",
            theme: "urgence", chapter: "Brûlures"
        },
        {
            id: 14, x: 400, y: 660,
            title: "Brûlure Thermique Grave",
            desc: "Brûlure grave avec calcul de la surface corporelle brûlée et remplissage vasculaire.",
            caseId: "urgence_brulure_thermique_etendue",
            theme: "urgence", chapter: "Brûlures"
        },

        // ── CHAPITRE 5 : Chocs & Détresses ───────────────────────────
        {
            id: 15, x: 800, y: 440,
            title: "Choc Anaphylactique",
            desc: "Réaction anaphylactique sévère — adrénaline et voies aériennes.",
            caseId: "urgence_choc_anaphylactique_01",
            theme: "urgence", chapter: "Chocs & Détresses"
        },
        {
            id: 16, x: 800, y: 220,
            title: "Asthme Aigu Grave — Détresse Respiratoire",
            desc: "Détresse respiratoire aiguë avec signes d'épuisement critique.",
            caseId: "urgence_asthme_aigu_grave",
            theme: "urgence", chapter: "Chocs & Détresses"
        },
        {
            id: 17, x: 1200, y: 0,
            title: "Overdose aux Opiacés — Syndrome Toxique",
            desc: "Coma profond avec myosis serré et dépression respiratoire — surdosage opioïde.",
            caseId: "urgence_overdose_opiaces",
            theme: "urgence", chapter: "Chocs & Détresses"
        },

        // ── CHAPITRE 6 : Pédiatrie ────────────────────────────────────
        {
            id: 18, x: 1200, y: 220,
            title: "Choc Septique Pédiatrique & Purpura Fulminans",
            desc: "Enfant 3 ans apathique, fébrile, purpura fulminans — choc septique froid.",
            caseId: "urgence_choc_septique_pediatrique",
            theme: "urgence", chapter: "Pédiatrie"
        },
        {
            id: 19, x: 1200, y: 440,
            title: "Convulsions Fébriles chez le Nourrisson",
            desc: "Crise tonico-clonique généralisée fébrile chez un nourrisson de 18 mois.",
            caseId: "urgence_convulsion_febrile_nourrisson",
            theme: "urgence", chapter: "Pédiatrie"
        },

        // ── CHAPITRE 7 : Situations Spéciales ────────────────────────
        {
            id: 20, x: 800, y: 660,
            title: "Noyade en Piscine",
            desc: "Noyade avec apnée et hypothermie — prise en charge pré-hospitalière.",
            caseId: "urgence_noyade_piscine",
            theme: "urgence", chapter: "Situations Spéciales"
        },
        {
            id: 21, x: 1200, y: 660,
            title: "Accouchement Inopiné à Domicile",
            desc: "Accouchement inopiné à domicile — expulsion, soins néonataux et délivrance.",
            caseId: "urgence_accouchement_inopine",
            theme: "urgence", chapter: "Situations Spéciales"
        },
    ],

    connections: [
        // Gestes de base → Avancé
        { id: 1,  fromNode: 1,  toNode: 3,  fromSocket: "output", toSocket: "input" },
        { id: 2,  fromNode: 2,  toNode: 4,  fromSocket: "output", toSocket: "input" },
        { id: 3,  fromNode: 2,  toNode: 5,  fromSocket: "output", toSocket: "input" },
        { id: 25, fromNode: 22, toNode: 5,  fromSocket: "output", toSocket: "input" },
        // Gestes de base → ACR
        { id: 4,  fromNode: 3,  toNode: 6,  fromSocket: "output", toSocket: "input" },
        { id: 5,  fromNode: 4,  toNode: 6,  fromSocket: "output", toSocket: "input" },
        // ACR progressif
        { id: 6,  fromNode: 6,  toNode: 7,  fromSocket: "output", toSocket: "input" },
        // Gestes → Traumatismes
        { id: 7,  fromNode: 3,  toNode: 8,  fromSocket: "output", toSocket: "input" },
        { id: 8,  fromNode: 8,  toNode: 9,  fromSocket: "output", toSocket: "input" },
        // Hémorragie → Traumatismes avancés
        { id: 9,  fromNode: 9,  toNode: 10, fromSocket: "output", toSocket: "input" },
        { id: 10, fromNode: 9,  toNode: 11, fromSocket: "output", toSocket: "input" },
        // Traumatismes → Crânien (boss)
        { id: 11, fromNode: 10, toNode: 12, fromSocket: "output", toSocket: "input" },
        { id: 12, fromNode: 11, toNode: 12, fromSocket: "output", toSocket: "input" },
        { id: 13, fromNode: 7,  toNode: 12, fromSocket: "output", toSocket: "input" },
        // Hémorragie → Brûlures
        { id: 14, fromNode: 9,  toNode: 13, fromSocket: "output", toSocket: "input" },
        { id: 15, fromNode: 13, toNode: 14, fromSocket: "output", toSocket: "input" },
        // Traumatisme crânien → Chocs
        { id: 16, fromNode: 12, toNode: 15, fromSocket: "output", toSocket: "input" },
        { id: 17, fromNode: 12, toNode: 16, fromSocket: "output", toSocket: "input" },
        { id: 18, fromNode: 7,  toNode: 16, fromSocket: "output", toSocket: "input" },
        // Détresses → Overdose
        { id: 19, fromNode: 16, toNode: 17, fromSocket: "output", toSocket: "input" },
        // Choc anaph. → Choc septique pédiatrique
        { id: 20, fromNode: 15, toNode: 18, fromSocket: "output", toSocket: "input" },
        // Choc septique → Convulsions nourrisson
        { id: 21, fromNode: 18, toNode: 19, fromSocket: "output", toSocket: "input" },
        // Brûlures → Noyade
        { id: 22, fromNode: 14, toNode: 20, fromSocket: "output", toSocket: "input" },
        // Pédiatrie + Noyade → Accouchement (boss final)
        { id: 23, fromNode: 19, toNode: 21, fromSocket: "output", toSocket: "input" },
        { id: 24, fromNode: 20, toNode: 21, fromSocket: "output", toSocket: "input" },
        { id: 26, fromNode: 17, toNode: 21, fromSocket: "output", toSocket: "input" },
    ]
};

async function updateGraph() {
    console.log('🔄 Mise à jour du graphe de progression urgence...');
    console.log(`   → ${graphContent.nodes.length} nœuds`);
    console.log(`   → ${graphContent.connections.length} connexions`);

    const { error } = await supabase
        .from('cases')
        .update({ content: graphContent })
        .eq('id', 'graph_urgences');

    if (error) {
        console.error('❌ Erreur Supabase :', error.message);
        process.exit(1);
    }

    console.log('✅ Graphe mis à jour avec succès !');
    console.log('');
    console.log('📋 Chapitres et nœuds :');

    const chapters = {};
    graphContent.nodes.forEach(n => {
        if (!chapters[n.chapter]) chapters[n.chapter] = [];
        chapters[n.chapter].push(n.title);
    });

    Object.entries(chapters).forEach(([ch, titles]) => {
        console.log(`\n  📁 ${ch} (${titles.length} cas) :`);
        titles.forEach(t => console.log(`     - ${t}`));
    });
}

updateGraph();
