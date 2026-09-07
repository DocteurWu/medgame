#!/usr/bin/env node
/**
 * scripts/run-all-migrations.mjs
 * Script complet de refonte ECOS 4 volets pour les 79 cas restants du corpus MedGame.
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, 'data');
const ARCHIVE_DIR = join(DATA_DIR, 'archive');
const INDEX_PATH = join(DATA_DIR, 'case-index.json');
const CASE_LOADER_PATH = join(ROOT, 'js', 'caseLoader.js');
const ENGINE_PATH = join(ROOT, 'engine', 'MedGameEngine.js');

if (!existsSync(ARCHIVE_DIR)) {
    mkdirSync(ARCHIVE_DIR, { recursive: true });
}

// 1. Archivage orphelins
const ORPHANS = ['case_idRER_hevdre.json'];
for (const orphan of ORPHANS) {
    const p = join(DATA_DIR, orphan);
    if (existsSync(p)) {
        writeFileSync(join(ARCHIVE_DIR, orphan), readFileSync(p, 'utf8'), 'utf8');
        unlinkSync(p);
        console.log(`📦 Cas orphelin archivé dans data/archive/ : ${orphan}`);
    }
}

// Helper pour enrichir une correction trop courte
function buildRichCorrection(motif, diag, itemR2C, conduite) {
    return `# Cas ECOS : ${motif}\n\n## Diagnostic retenu : ${diag}\n\n### Référentiel R2C / EDN\n${itemR2C}\n\n### Prise en charge clinique et thérapeutique\n${conduite}\n\nPrise en charge conforme aux recommandations officielles des sociétés savantes françaises et européennes (HAS, collèges des enseignants). Évaluation sémiologique rigoureuse, identification des critères de gravité et stratégie diagnostique et thérapeutique graduée.`;
}

// 2. Import des définitions des cas
import { CASES_CONFIG } from './corpus-definitions.mjs';

console.log(`\n🚀 Lancement de la migration de ${Object.keys(CASES_CONFIG).length} cas...\n`);

const legacyAliases = {};
const newIndex = {
    cardiologie: [],
    endocrinologie: [],
    "appareil-digestif": [],
    uronephro: [],
    neurosensorielle: [],
    "neurologie/psychiatrie": [],
    locomoteur: [],
    gynecologie: [],
    pneumologie: [],
    urgence: []
};

// Préserver les cas cardiologie déjà migrés
if (existsSync(INDEX_PATH)) {
    const currentIndex = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
    newIndex.cardiologie = currentIndex.cardiologie || [];
}

let migratedCount = 0;

for (const [oldFile, conf] of Object.entries(CASES_CONFIG)) {
    const oldPath = join(DATA_DIR, oldFile);
    const newPath = join(DATA_DIR, conf.newFile);
    const srcPath = existsSync(oldPath) ? oldPath : (existsSync(newPath) ? newPath : null);

    if (!srcPath) {
        console.warn(`  ⚠️ Fichier source introuvable : ${oldFile} ou ${conf.newFile}`);
        continue;
    }

    const data = JSON.parse(readFileSync(srcPath, 'utf8'));

    // Enregistrer les alias de rétrocompatibilité
    legacyAliases[oldFile] = conf.newFile;
    legacyAliases[oldFile.toLowerCase()] = conf.newFile;
    if (data.id) {
        legacyAliases[data.id] = conf.newFile;
        legacyAliases[data.id.toLowerCase()] = conf.newFile;
    }

    // Identifiants canoniques
    const newId = conf.newFile.replace(/\.json$/, '');
    data.id = newId;
    data.motif = conf.motif;

    // Identité patient propre
    data.patient = data.patient || {};
    if (conf.nom) data.patient.nom = conf.nom;
    if (conf.prenom) data.patient.prenom = conf.prenom;
    if (conf.age) data.patient.age = conf.age;
    if (conf.sexe) data.patient.sexe = conf.sexe;
    if (!data.patient.prenom && data.patient.nom) {
        data.patient.prenom = "Patient(e)";
    }

    // Cohérence possibleDiagnostics
    if (data.correctDiagnostic) {
        data.possibleDiagnostics = data.possibleDiagnostics || [];
        if (!data.possibleDiagnostics.includes(data.correctDiagnostic)) {
            data.possibleDiagnostics.unshift(data.correctDiagnostic);
        }
    }

    // Objet ECOS 4 volets
    data.ecos = data.ecos || {};
    data.ecos.titre = conf.motif;
    data.ecos.itemR2C = conf.itemR2C || data.ecos.itemR2C || "Item ECOS EDN";

    // 1. Consignes Étudiant
    data.ecos.consignesEtudiant = {
        role: conf.role || "Vous êtes interne en consultation.",
        contexte: conf.contexte || `${data.patient.prenom} ${data.patient.nom}, ${data.patient.age || 40} ans, se présente pour ${conf.motif.toLowerCase()}.`,
        dureeMinutes: conf.dureeMinutes || 8,
        consignes: conf.consignes || [
            "Mener un interrogatoire méthodique centré sur le motif de consultation",
            "Réaliser un examen clinique ciblé et rechercher les signes de gravité",
            "Proposer la démarche diagnostique et thérapeutique initiale adaptée",
            "Informer le patient de manière claire et bienveillante"
        ],
        interdits: conf.interdits || [
            "Ne pas prescrire de traitement sans évaluation clinique préalable",
            "Ne pas méconnaître les signes de gravité immédiate"
        ],
        materielDisponible: conf.materiel || ["Stéthoscope", "Tensiomètre", "Thermomètre"],
        lieu: conf.lieu || "Cabinet de consultation"
    };

    // 2. Consignes Patient Standardisé
    const openingPhrase = conf.phraseOuverture || data.interrogatoire?.verbatim || `Bonjour docteur, je viens vous voir car j'ai ${conf.motif.toLowerCase()}.`;
    data.ecos.consignesPatient = {
        identite: {
            prenom: data.patient.prenom,
            nom: data.patient.nom,
            age: data.patient.age,
            sexe: data.patient.sexe
        },
        personnalite: conf.personnalite || data.patient.persona?.ton || "Patient coopératif.",
        phraseOuverture: openingPhrase,
        infosVolontaires: conf.infosVolontaires || [
            conf.motif,
            "Symptôme apparu de façon gênante motivant la consultation"
        ],
        infosSiDemandees: conf.infosDemandees || [
            "Pas d'antécédent similaire dans le passé",
            "Traitements habituels bien suivis sans oubli majeur"
        ],
        infosCachees: conf.infosCachees || [
            "Crainte sous-jacente d'une maladie grave ou invalidante"
        ],
        questionsPieges: conf.questionsPieges || [
            "Docteur, est-ce que c'est grave ?",
            "Est-ce que je vais devoir être opéré ou hospitalisé ?"
        ],
        reactions: conf.reactions || {
            brutal: "Vous m'inquiétez beaucoup docteur...",
            silence: "Docteur, vous avez l'air inquiet, qu'est-ce qui se passe ?",
            jargon: "Je ne comprends pas ce terme médical, docteur."
        }
    };

    // 3. Consignes Évaluateur
    const expectedElements = conf.elements || [
        "Interrogatoire sémiologique complet et bienveillant",
        "Prise des constantes et examen clinique ciblé",
        "Proposition d'examens complémentaires pertinents",
        "Conduite à tenir thérapeutique conforme aux recommandations",
        "Information claire délivrée au patient"
    ];
    const gridItems = conf.grille || expectedElements.map((el, idx) => ({
        id: `eval_critere_${idx + 1}`,
        label: el,
        weight: 1
    }));

    data.ecos.consignesEvaluateur = {
        pointCle: conf.pointCle || `Identifier et prendre en charge de façon conforme : ${data.correctDiagnostic}.`,
        erreursRedhibitoires: conf.erreurs || [
            "Méconnaître un signe d'urgence vitale ou de gravité immédiate",
            "Prescrire un traitement contre-indiqué ou dangereux"
        ],
        elementsAttendus: expectedElements,
        grille: gridItems
    };

    // 4. Rétrocompatibilité (vignette, patientStandardise, grilleAptitudesCliniques, grilleCommunication)
    data.ecos.vignette = {
        role: data.ecos.consignesEtudiant.role,
        contexte: data.ecos.consignesEtudiant.contexte,
        consignesAttendues: [...data.ecos.consignesEtudiant.consignes],
        consignesInterdites: [...data.ecos.consignesEtudiant.interdits],
        typeStation: conf.typeStation || (conf.spec === 'urgence' && /inconscien|coma|noyade|arret|arr[eê]t/i.test(conf.motif) ? "SANS_PS_PSS" : "AVEC_PS"),
        domainePrincipal: conf.domainePrincipal || "Entretien/Interrogatoire",
        domaineSecondaire: conf.domaineSecondaire || "Stratégie pertinente de PEC",
        lieu: data.ecos.consignesEtudiant.lieu,
        materielDisponible: [...data.ecos.consignesEtudiant.materielDisponible]
    };

    data.ecos.patientStandardise = {
        phraseOuverture: data.ecos.consignesPatient.phraseOuverture,
        infosVolontaires: [...data.ecos.consignesPatient.infosVolontaires],
        infosSiDemandees: [...data.ecos.consignesPatient.infosSiDemandees],
        infosCachees: [...data.ecos.consignesPatient.infosCachees],
        reactions: { ...data.ecos.consignesPatient.reactions },
        personnalite: data.ecos.consignesPatient.personnalite
    };

    data.ecos.grilleAptitudesCliniques = data.ecos.consignesEvaluateur.grille.map(g => ({
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

    // Correction minimale
    if (!data.correction || data.correction.length < 100) {
        data.correction = buildRichCorrection(
            conf.motif,
            data.correctDiagnostic,
            data.ecos.itemR2C,
            data.ecos.consignesEvaluateur.pointCle
        );
    }

    // Verbatim interrogatoire sans leak
    if (data.interrogatoire) {
        data.interrogatoire.motifHospitalisation = conf.motif;
        data.interrogatoire.verbatim = openingPhrase;
    }

    // Écriture du nouveau fichier
    writeFileSync(newPath, JSON.stringify(data, null, 2), 'utf8');
    migratedCount++;

    // Suppression de l'ancien fichier s'il a changé de nom
    if (oldFile !== conf.newFile && existsSync(oldPath)) {
        unlinkSync(oldPath);
    }

    // Indexation
    const cat = conf.spec || 'autre';
    if (!newIndex[cat]) newIndex[cat] = [];
    if (!newIndex[cat].includes(conf.newFile)) {
        newIndex[cat].push(conf.newFile);
    }

    // Cas d'urgence_accouchement_inopine présent aussi dans gynecologie
    if (conf.newFile === 'urgence_contractions_rapprochees_expulsion_mme_barbier.json') {
        if (!newIndex.gynecologie) newIndex.gynecologie = [];
        if (!newIndex.gynecologie.includes(conf.newFile)) {
            newIndex.gynecologie.push(conf.newFile);
        }
    }
}

console.log(`✅ ${migratedCount} cas migrés avec succès au format ECOS 4 volets !`);

// 3. Mise à jour de data/case-index.json
console.log('\n🗂️  Mise à jour de data/case-index.json...');
writeFileSync(INDEX_PATH, JSON.stringify(newIndex, null, 2), 'utf8');
console.log('✅ case-index.json mis à jour.');

// 4. Mise à jour de LEGACY_CASE_ALIASES dans js/caseLoader.js et engine/MedGameEngine.js
console.log('\n🔗 Mise à jour des tables d\'alias de rétrocompatibilité...');

function updateAliasTableInFile(filePath, aliases) {
    if (!existsSync(filePath)) return;
    let content = readFileSync(filePath, 'utf8');

    const aliasRegex = /const LEGACY_CASE_ALIASES = \{[\s\S]*?\};/;
    const entries = Object.entries(aliases)
        .map(([k, v]) => `    '${k}': '${v}'`)
        .join(',\n');
    const replacement = `const LEGACY_CASE_ALIASES = {\n${entries}\n};`;

    if (aliasRegex.test(content)) {
        content = content.replace(aliasRegex, replacement);
        writeFileSync(filePath, content, 'utf8');
        console.log(`  ✅ Aliases mis à jour dans ${filePath}`);
    } else {
        console.warn(`  ⚠️ Bloc LEGACY_CASE_ALIASES introuvable dans ${filePath}`);
    }
}

const existingAliases = {
    'CARDIO_angor_stable.json': 'cardio_douleur_thoracique_mme_bennet.json',
    'cardio_angor_stable.json': 'cardio_douleur_thoracique_mme_bennet.json',
    'CARDIO_AOMI.json': 'cardio_claudication_intermittente_m_lambert.json',
    'cardio_AOMI.json': 'cardio_claudication_intermittente_m_lambert.json',
    'CARDIO_hta_secondaire_hyperaldosteronisme.json': 'cardio_hypertension_arterielle_m_wickham.json',
    'cardio_hta_secondaire_hyperaldosteronisme.json': 'cardio_hypertension_arterielle_m_wickham.json',
    'CARDIO_insuffisance_veineuse_chronique.json': 'cardio_jambes_lourdes_mme_dubois.json',
    'cardio_insuffisance_veineuse_chronique.json': 'cardio_jambes_lourdes_mme_dubois.json',
    'CARDIO_retrecissement_aortique.json': 'cardio_malaise_effort_m_bingley.json',
    'cardio_retrecissement_aortique.json': 'cardio_malaise_effort_m_bingley.json',
    'CARDIO_syncope_cardiaque.json': 'cardio_perte_de_connaissance_m_darcy.json',
    'cardio_syncope_cardiaque.json': 'cardio_perte_de_connaissance_m_darcy.json',
    'CARDIO_syncope_vaso_vagale.json': 'cardio_malaise_vagal_mlle_bennet.json',
    'cardio_syncope_vaso_vagale.json': 'cardio_malaise_vagal_mlle_bennet.json',
    'CARDIO_thrombose_veineuse_profonde_droite.json': 'cardio_grosse_jambe_rouge_m_ternes.json',
    'cardio_thrombose_veineuse_profonde_droite.json': 'cardio_grosse_jambe_rouge_m_ternes.json',
    'cardio_1.json': 'cardio_dyspnee_oedemes_m_dupont.json',
    'cardio_insuffisancecardiaque_denny.json': 'cardio_dyspnee_fatigue_m_duquette.json',
    'cardio_insuffisancecardiaque_ellis.json': 'cardio_dyspnee_effort_mme_grey.json'
};

const fullAliases = { ...existingAliases, ...legacyAliases };
updateAliasTableInFile(CASE_LOADER_PATH, fullAliases);
updateAliasTableInFile(ENGINE_PATH, fullAliases);

console.log(`\n🎉 Migration globale terminée ! ${migratedCount} cas migrés, ${Object.keys(fullAliases).length} alias enregistrés.\n`);
