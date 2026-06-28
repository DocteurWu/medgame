/**
 * scripts/generate_ecos_grilles.js
 * Génère automatiquement les grilles d'évaluation ECOS pour chaque cas
 * clinique en interrogeant l'API LLM. À exécuter une seule fois pour
 * pré-remplir tous les cas `data/*.json` avec un objet `ecos`.
 *
 * Usage (depuis le dossier racine du projet) :
 *   node scripts/generate_ecos_grilles.js [--dry-run] [--only=file.json]
 *
 * Variables d'environnement requises :
 *   LLM_API_URL   : endpoint OpenRouter ou proxy (défaut: env.LLM_API_URL ou https://openrouter.ai/api/v1/chat/completions)
 *   LLM_API_KEY   : clé API OpenRouter
 *   LLM_MODEL     : nom du modèle (défaut: openrouter/owl-alpha)
 *
 * Sortie : ajoute ou met à jour l'objet `ecos` dans chaque fichier JSON.
 * L'objet `ecos` est idempotent : on n'écrase pas un cas déjà traité sauf
 * si l'option --force est passée.
 */

'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charge .env à la racine du projet s'il existe (sans dépendance dotenv)
function loadDotenv() {
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return;
    const text = fs.readFileSync(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
    }
}
loadDotenv();

const DATA_DIR = path.join(__dirname, '..', 'data');
const ENV_LLM_URL = process.env.LLM_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
const ENV_LLM_KEY = process.env.LLM_API_KEY || '';
const ENV_LLM_MODEL = process.env.LLM_MODEL || 'openrouter/owl-alpha';

const ARGS = new Set(process.argv.slice(2));
const IS_DRY_RUN = ARGS.has('--dry-run') || ARGS.has('-n');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1] || null;
const LIMIT = parseInt((process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1] || '0', 10);
const FORCE = ARGS.has('--force');

const MAX_PARALLEL = 3;

if (!ENV_LLM_KEY && !IS_DRY_RUN) {
    console.error('⚠️  LLM_API_KEY manquante. Le script va s\'arrêter.');
    console.error('    Pour tester sans LLM, utilisez --dry-run (génère un squelette vide).');
    process.exit(1);
}

if (IS_DRY_RUN) {
    console.log('🧪 Mode --dry-run : aucun fichier ne sera modifié.\n');
}

function listCaseFiles() {
    let files = fs.readdirSync(DATA_DIR)
        .filter(f => f.endsWith('.json') && f !== 'case-index.json' && f !== 'drugs.json')
        .map(f => path.join(DATA_DIR, f))
        .filter(f => !ONLY || path.basename(f) === ONLY);
    if (LIMIT > 0) files = files.slice(0, LIMIT);
    return files;
}

function extractCaseSummary(caseData) {
    const patient = caseData.patient || {};
    const interro = caseData.interrogatoire || {};
    const exam = caseData.examenClinique || {};
    return {
        id: caseData.id,
        title: caseData.title,
        patient: `${patient.prenom || ''} ${patient.nom || ''}`.trim(),
        age: patient.age,
        sexe: patient.sexe,
        motif: interro.motifHospitalisation,
        histoireMaladie: interro.histoireMaladie || {},
        antecedents: interro.antecedents || {},
        modeDeVie: interro.modeDeVie || {},
        allergies: interro.allergies || {},
        traitements: interro.traitements || [],
        examenClinique: exam,
        constantes: exam.constantes || {},
        possibleDiagnostics: caseData.possibleDiagnostics || [],
        correctDiagnostic: caseData.correctDiagnostic || '',
        correctTreatments: caseData.correctTreatments || [],
        fatalTreatments: caseData.fatalTreatments || [],
        // Pedagogical context to enable targeted, case-specific grille generation
        verbatim: interro.verbatim || null,
        locks: (caseData.locks || []).map(l => ({
            id: l.id,
            question: l.question,
            type: l.type
        })),
        correctionSummary: (caseData.correction || '').substring(0, 400) || null,
        postGameQuestions: (caseData.postGameQuestions || []).slice(0, 3).map(q => q.question || q)
    };
}

function buildPrompt(caseSummary) {
    // Detect if patient is unconscious/comatose to guide typeStation
    const isUnconscious = /inconscient|comateux|arrêt cardio|aréactif/i.test(
        JSON.stringify(caseSummary).substring(0, 500)
    );
    const unconsciousInstructions = isUnconscious
        ? `   - Le patient est inconscient/comateux/ACR : typeStation = "SANS_PS_PSS", phraseOuverture = "" (vide), laisser personnalite descriptif pour l'évaluateur.\n`
        : '';

    return `Tu es un expert en simulation médicale et en pédagogie ECOS pour le programme R2C/EDN français.
Tu dois générer la vignette pédagogique et la grille d'évaluation ECOS pour le cas clinique fourni.

═══ RÈGLES ECOS NATIONALES (CNG 2024) ═══
1. GRILLE APTITUDES CLINIQUES : 10-15 items observables, ordonnés chronologiquement.
   - Chaque item a une "category" parmi : "Interrogatoire", "Examen clinique", "Stratégie diagnostique", "PEC/Thérapeutique", "Annonce/Education", "Urgence".
   - Chaque item a un "weight" (priorité) :
     * 1 = item standard (présentation, antécédents généraux)
     * 2 = item important (symptôme clé, examen pertinent, diagnostic)
     * 3 = item CRITIQUE ou vital (signe de gravité, urgence vitale, traitement indispensable)
   - Pas de doublons de critères entre items. Chaque item évalue une action distincte.
   - Les "triggerKeywords" doivent être spécifiques : éviter les mots génériques seuls ("donc", "bilan", "famille", "résumé").
     Utilise des expressions précises comme "Cheyne-Stokes", "insuffisance cardiaque", "ECG", "je suis interne en", etc.
   - Les labels des items doivent être ACTIONNABLES (observable par un évaluateur) : verbe à l'infinitif ou indicatif, critère clair.
   - Evite les items non-actionnables ("fait preuve de rigueur", "transmission SBAR", prescription d'ordonnance sans UI).

2. GRILLE COMMUNICATION : 3-5 items SPÉCIFIQUES AU CAS (pas les mêmes 5 items génériques pour tous les cas).
   - Pour les cas d'annonce de diagnostic grave : inclure un item "Annonce progressive et empathique du diagnostic de <pathologie>"
   - Pour les cas pédiatriques : inclure "Adapte sa communication aux parents et rassure le parent inquiet"
   - Pour les cas d'urgence : inclure "Explique clairement ses gestes en les réalisant"
   - Chaque item a un "max" = 1 (échelle 0/0.25/0.5/0.75/1) — la notation fine est à la discrétion de l'évaluateur.
   - Les labels doivent décrire un comportement OBSERVABLE, avec un critère opérationnel.
     BON : "Nomme l'émotion du patient (\"Je vois que vous êtes inquiet...\") ou utilise une phrase de validation"
     MAUVAIS : "Fait preuve d'empathie et de bienveillance"

3. PATIENT STANDARDISÉ :
   - "personnalite" (sans accent) : profil psychologique riche et SPÉCIFIQUE (ex: anxieux, revendicatif, stoïque, dépressif, confus, méfiant). Inclure contexte social, émotions liées à la pathologie.
   - "phraseOuverture" : première réplique naturelle du patient, centrée sur ses symptômes TELS QU'IL LES RESSENT (pas de diagnostic livré).
   - "infosVolontaires" : chemins valides vers les données du JSON du cas. Utilise UNIQUEMENT ces chemins valides :
     * "motifHospitalisation"
     * "histoireMaladie.debutSymptomes"
     * "histoireMaladie.evolution"
     * "histoireMaladie.descriptionDouleur"
     * "histoireMaladie.symptomesAssocies"
     * "histoireMaladie.facteursDeclenchants"
     * "histoireMaladie.facteursCalmants"
   - "infosSiDemandees" : mêmes chemins valides, plus :
     * "antecedents.medicaux"
     * "antecedents.chirurgicaux"
     * "antecedents.familiaux"
     * "modeDeVie.tabac"
     * "modeDeVie.alcool"
     * "modeDeVie.activitePhysique"
     * "traitements"
     * "allergies"
   - "infosCachees" : 1-3 éléments pertinents que le patient ne révèle pas spontanément (test la capacité à creuser). Ne pas laisser vide.
   - "reactions" :
     * "brutal" : réplique jouable si le médecin est brusque (ex: "Vous pouvez m'expliquer plus doucement ?")
     * "silence" : réplique jouable si le médecin reste silencieux trop longtemps — le patient exprime un malaise, pas une relance proactive (ex: "... Euh, je ne sais pas quoi dire de plus.")
     * "jargon" : réplique jouable si le médecin utilise du jargon médical non expliqué
${unconsciousInstructions}CAS CLINIQUE :
${JSON.stringify(caseSummary, null, 2)}

FORMAT DE SORTIE OBLIGATOIRE — JSON VALIDE UNIQUEMENT, AUCUN MARKDOWN :

{
  "vignette": {
    "role": "Vous êtes interne en stage de <service>.",
    "contexte": "<Prénom Nom>, <âge> ans, <sexe>, <motif en termes de patient>.",
    "consignesAttendues": ["Réaliser un interrogatoire ciblé", "Proposer une stratégie diagnostique"],
    "consignesInterdites": ["Ne pas prescrire sans avoir examiné"],
    "typeStation": ${isUnconscious ? '"SANS_PS_PSS"' : '"AVEC_PS"'},
    "domainePrincipal": "Entretien/Interrogatoire",
    "domaineSecondaire": "Stratégie diagnostique",
    "lieu": "Cabinet de consultation",
    "materielDisponible": ["Stéthoscope", "Tensiomètre", "Marteau à réflexes"]
  },
  "grilleAptitudesCliniques": [
    { "id": "accueil_presentation", "category": "Interrogatoire", "label": "Se présente en donnant son nom et son rôle d'interne", "weight": 1, "triggerKeywords": ["bonjour", "je suis interne", "je m'appelle", "je suis le médecin"] },
    { "id": "interrogatoire_motif", "category": "Interrogatoire", "label": "Explore le motif de consultation par une question ouverte", "weight": 2, "triggerKeywords": ["qu'est-ce qui vous amène", "dites-moi", "qu'est-ce que vous ressentez", "comment ça a commencé"] }
  ],
  "grilleCommunication": [
    { "id": "questions_ouvertes", "label": "Débute par des questions ouvertes avant de fermer l'interrogatoire", "max": 1 },
    { "id": "empathie_nommee", "label": "Nomme ou valide une émotion du patient (\"Je vois que c'est difficile pour vous\")", "max": 1 },
    { "id": "vocabulaire_adapte", "label": "Explique tout terme médical utilisé en langage courant", "max": 1 }
  ],
  "patientStandardise": {
    "personnalite": "<profil psychologique riche et spécifique au cas>",
    "phraseOuverture": "<première réplique naturelle centrée sur les symptômes ressentis>",
    "infosVolontaires": ["motifHospitalisation", "histoireMaladie.debutSymptomes"],
    "infosSiDemandees": ["antecedents.medicaux", "modeDeVie.tabac", "histoireMaladie.symptomesAssocies"],
    "infosCachees": ["<information pertinente que le patient tait>"],
    "reactions": {
      "brutal": "Attendez, vous allez trop vite, je ne comprends rien.",
      "silence": "... (silence) ... Euh... je ne sais pas trop quoi ajouter.",
      "jargon": "C'est quoi ce mot ? Vous pouvez m'expliquer autrement ?"
    }
  }
}

Produis UNIQUEMENT le JSON. Aucun texte avant ou après.`;
}

/**
 * Validates the parsed ECOS object and throws with a descriptive error if invalid.
 */
function validateEcos(ecos, filePath) {
    const name = path.basename(filePath);
    if (!ecos || typeof ecos !== 'object') throw new Error(`[${name}] ecos non-objet`);

    // vignette
    if (!ecos.vignette) throw new Error(`[${name}] vignette manquante`);
    const validTypes = ['AVEC_PS', 'AVEC_PSS', 'SANS_PS_PSS'];
    if (!validTypes.includes(ecos.vignette.typeStation)) {
        console.warn(`  ⚠ [${name}] typeStation invalide: "${ecos.vignette.typeStation}" — forcé à AVEC_PS`);
        ecos.vignette.typeStation = 'AVEC_PS';
    }

    // grilleAptitudesCliniques
    const grille = ecos.grilleAptitudesCliniques;
    if (!Array.isArray(grille) || grille.length < 5) {
        throw new Error(`[${name}] grilleAptitudesCliniques trop courte (${grille?.length ?? 0} items, min 5)`);
    }
    const ids = new Set();
    for (const item of grille) {
        if (!item.id || !item.label) throw new Error(`[${name}] item sans id ou label`);
        if (ids.has(item.id)) throw new Error(`[${name}] ID dupliqué: "${item.id}"`);
        ids.add(item.id);
        if (typeof item.weight !== 'number') item.weight = 1;
        item.weight = Math.max(1, Math.min(3, Math.round(item.weight)));
        if (!item.category) item.category = 'Interrogatoire';
        if (!Array.isArray(item.triggerKeywords) || item.triggerKeywords.length === 0) {
            console.warn(`  ⚠ [${name}] item "${item.id}" sans triggerKeywords — tableau vide conservé`);
            item.triggerKeywords = [];
        }
    }

    // grilleCommunication
    const comm = ecos.grilleCommunication;
    if (!Array.isArray(comm) || comm.length < 2) {
        throw new Error(`[${name}] grilleCommunication trop courte (${comm?.length ?? 0} items, min 2)`);
    }
    for (const item of comm) {
        if (typeof item.max !== 'number') item.max = 1;
        item.max = Math.min(1, Math.max(0, item.max));
    }

    // patientStandardise
    const ps = ecos.patientStandardise;
    if (!ps) throw new Error(`[${name}] patientStandardise manquant`);
    // Tolerate both spellings, normalize to no-accent
    if ('personnalité' in ps) {
        ps.personnalite = ps['personnalité'];
        delete ps['personnalité'];
    }
    if (!ps.personnalite && ecos.vignette.typeStation === 'AVEC_PS') {
        console.warn(`  ⚠ [${name}] personnalite vide pour une station AVEC_PS`);
    }
    if (!Array.isArray(ps.infosVolontaires)) ps.infosVolontaires = [];
    if (!Array.isArray(ps.infosSiDemandees)) ps.infosSiDemandees = [];
    if (!Array.isArray(ps.infosCachees)) ps.infosCachees = [];
    if (!ps.reactions || typeof ps.reactions !== 'object') ps.reactions = {};

    return ecos;
}

// Modèles fallback si le principal est rate-limited
const FALLBACK_MODELS = [
    ENV_LLM_MODEL,
    'openrouter/owl-alpha',
    'openai/gpt-oss-20b:free',
    'z-ai/glm-4.5-air:free'
];

async function callLLM(prompt, filePath) {
    if (IS_DRY_RUN) {
        return JSON.stringify({
            vignette: { role: 'Interne en stage', contexte: '[DRY-RUN]', consignesAttendues: [], consignesInterdites: [], typeStation: 'AVEC_PS', domainePrincipal: 'Entretien/Interrogatoire', domaineSecondaire: '', lieu: '', materielDisponible: [] },
            grilleAptitudesCliniques: [],
            grilleCommunication: [],
            patientStandardise: { personnalite: '', phraseOuverture: '', infosVolontaires: [], infosSiDemandees: [], infosCachees: [], reactions: {} }
        });
    }
    let lastError = null;
    for (let attempt = 0; attempt < FALLBACK_MODELS.length; attempt++) {
        const modelToTry = FALLBACK_MODELS[attempt];
        const maxRetries = 3;
        for (let retry = 0; retry < maxRetries; retry++) {
            try {
                const resp = await fetch(ENV_LLM_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${ENV_LLM_KEY}`,
                        'HTTP-Referer': 'https://medgame.netlify.app',
                        'X-Title': 'MedGame-ECOS-Generator'
                    },
                    body: JSON.stringify({
                        model: modelToTry,
                        messages: [
                            { role: 'system', content: 'Tu es un expert ECOS R2C. Tu renvoies UNIQUEMENT du JSON valide, sans markdown.' },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0.3,
                        max_tokens: 4000
                    })
                });
                if (resp.status === 429 || resp.status === 404) {
                    // Rate-limited or model unavailable — try next model
                    const text = await resp.text();
                    lastError = new Error(`HTTP ${resp.status} (${modelToTry}): ${text.substring(0, 100)}`);
                    console.warn(`  ⚠ ${path.basename(filePath)} : ${modelToTry} → ${resp.status} (tentative ${retry + 1}/${maxRetries})`);
                    break;
                }
                if (!resp.ok) {
                    const text = await resp.text();
                    throw new Error(`HTTP ${resp.status}: ${text.substring(0, 200)}`);
                }
                const data = await resp.json();
                const content = data.choices?.[0]?.message?.content || '';
                if (modelToTry !== ENV_LLM_MODEL) {
                    console.log(`  ↻ ${path.basename(filePath)} : basculé sur ${modelToTry}`);
                }
                return content.trim();
            } catch (e) {
                if (retry === maxRetries - 1) {
                    lastError = e;
                } else {
                    // Backoff exponentiel : 1s, 2s, 4s
                    const wait = Math.pow(2, retry) * 1000;
                    console.warn(`  ⏳ ${path.basename(filePath)} : erreur réseau, retry dans ${wait}ms (${retry + 1}/${maxRetries})`);
                    await new Promise(r => setTimeout(r, wait));
                }
            }
        }
    }
    throw lastError || new Error('Tous les modèles ont échoué');
}

function extractJson(content) {
    const fenced = content.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
    const raw = fenced ? fenced[1] : content;
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) throw new Error('Pas de JSON détecté');
    return JSON.parse(raw.substring(firstBrace, lastBrace + 1));
}

async function processCase(filePath) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    let caseData;
    try {
        caseData = JSON.parse(raw);
    } catch (e) {
        console.error(`  ❌ ${path.basename(filePath)} : JSON invalide`);
        return { ok: false, reason: 'invalid-json' };
    }
    if (caseData.ecos && !FORCE) {
        console.log(`  ⏭  ${path.basename(filePath)} : déjà traité (utilisez --force pour écraser)`);
        return { ok: true, skipped: true };
    }

    const summary = extractCaseSummary(caseData);
    const prompt = buildPrompt(summary);

    try {
        const content = await callLLM(prompt, filePath);
        let ecos = extractJson(content);
        ecos = validateEcos(ecos, filePath);
        caseData.ecos = ecos;

        if (!IS_DRY_RUN) {
            fs.writeFileSync(filePath, JSON.stringify(caseData, null, 2) + '\n', 'utf-8');
        }
        const count = (ecos.grilleAptitudesCliniques || []).length;
        const hasWeightVariety = new Set((ecos.grilleAptitudesCliniques || []).map(i => i.weight)).size > 1;
        console.log(`  ✅ ${path.basename(filePath)} : ${count} items générés${hasWeightVariety ? '' : ' ⚠ (tous weight=1)'}`);
        return { ok: true };
    } catch (e) {
        console.error(`  ❌ ${path.basename(filePath)} : ${e.message}`);
        return { ok: false, reason: e.message };
    }
}

async function runWithConcurrency(items, limit, worker) {
    const results = [];
    const queue = [...items];
    const inFlight = new Set();
    const launchNext = () => {
        if (queue.length === 0) return null;
        const next = queue.shift();
        const task = (async () => {
            const r = await worker(next);
            results.push(r);
        })();
        inFlight.add(task);
        task.finally(() => inFlight.delete(task));
        return task;
    };
    // Lance jusqu'à `limit` workers simultanés
    const initial = [];
    for (let i = 0; i < Math.min(limit, items.length); i++) {
        const t = launchNext();
        if (t) initial.push(t);
    }
    // Tant qu'il reste des items ou des workers actifs, on remplace les workers terminés
    while (queue.length > 0 || inFlight.size > 0) {
        if (queue.length > 0 && inFlight.size < limit) {
            launchNext();
        }
        // Attend qu'un worker se termine
        if (inFlight.size > 0) {
            await Promise.race(inFlight);
        }
    }
    await Promise.all(initial);
    return results;
}

(async function main() {
    const files = listCaseFiles();
    console.log(`📂 ${files.length} cas trouvés dans ${DATA_DIR}\n`);
    if (files.length === 0) return;

    const results = await runWithConcurrency(files, MAX_PARALLEL, processCase);

    const ok = results.filter(r => r.ok && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;
    const failed = results.filter(r => !r.ok).length;

    console.log('\n📊 Bilan :');
    console.log(`   ✅ ${ok} générés`);
    console.log(`   ⏭  ${skipped} déjà traités`);
    console.log(`   ❌ ${failed} échoués`);
})();
