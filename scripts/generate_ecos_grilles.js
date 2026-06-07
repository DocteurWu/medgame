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

const MAX_PARALLEL = 2;

if (!ENV_LLM_KEY && !IS_DRY_RUN) {
    console.error('⚠️  LLM_API_KEY manquante. Le script va s\'arrêter.');
    console.error('    Pour tester sans LLM, utilisez --dry-run (génère un squelette vide).');
    process.exit(1);
}

if (IS_DRY_RUN) {
    console.log('🧪 Mode --dry-run : aucun fichier ne sera modifié.\n');
}

function listCaseFiles() {
    return fs.readdirSync(DATA_DIR)
        .filter(f => f.endsWith('.json') && f !== 'case-index.json')
        .map(f => path.join(DATA_DIR, f))
        .filter(f => !ONLY || path.basename(f) === ONLY);
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
        fatalTreatments: caseData.fatalTreatments || []
    };
}

function buildPrompt(caseSummary) {
    return `Tu es un expert du programme R2C/EDN français (Réforme du 2e cycle). Tu dois produire la "vignette" et la "grille d'évaluation ECOS" pour le cas clinique suivant.

RAPPELS ECOS NATIONAUX (CNG 2024) :
- 11 domaines de compétence évalués : Entretien/Interrogatoire, Annonce, Communication interpro, Éducation/prévention, Examen clinique, Iconographie, Procédure, Stratégie diagnostique, Stratégie pertinente de PEC, Synthèse de résultats, Urgence vitale.
- Grille d'observation dichotomique (0/1) sur 10-15 items "aptitudes cliniques"
- Échelle 0/0,25/0,5/0,75/1 sur 2-5 items "communication et attitudes"

CAS CLINIQUE :
${JSON.stringify(caseSummary, null, 2)}

CONTRAINTES DE SORTIE :
- Renvoie UNIQUEMENT un objet JSON valide (pas de markdown, pas de commentaires).
- Structure attendue :

{
  "vignette": {
    "role": "Vous êtes interne en stage de <service>.",
    "contexte": "<nom>, <âge> ans, <sexe>, se présente pour <motif>.",
    "consignesAttendues": ["...", "..."],
    "consignesInterdites": ["..."],
    "typeStation": "AVEC_PS" | "AVEC_PSS" | "SANS_PS_PSS",
    "domainePrincipal": "Entretien/Interrogatoire" | ...,
    "domaineSecondaire": "...",
    "lieu": "Service d'urgence" | "Cabinet de consultation" | "...",
    "materielDisponible": ["..."]
  },
  "grilleAptitudesCliniques": [
    { "id": "accueil_presentation", "label": "Se présente et explique son rôle d'interne", "weight": 1, "triggerKeywords": ["bonjour", "je suis interne", "je m'appelle"] },
    ... (10-15 items pertinents pour ce cas, ordonnés chronologiquement)
  ],
  "grilleCommunication": [
    { "id": "ecoute_active", "label": "Écoute active — laisse le patient terminer sans l'interrompre", "max": 1 },
    { "id": "questions_ouvertes", "label": "Pose des questions ouvertes avant les questions fermées", "max": 1 },
    { "id": "reformulation", "label": "Reformule ou vérifie la compréhension du patient", "max": 1 },
    { "id": "vocabulaire_adapte", "label": "Utilise un vocabulaire adapté (pas de jargon non expliqué)", "max": 1 },
    { "id": "empathie", "label": "Fait preuve d'empathie et de bienveillance", "max": 1 }
  ],
  "patientStandardise": {
    "personnalite": "...",
    "phraseOuverture": "...",
    "infosVolontaires": ["motifHospitalisation", "histoireMaladie.symptomesActuels"],
    "infosSiDemandees": ["antecedents.medicaux", "antecedents.familiaux", "modeDeVie.tabac"],
    "infosCachees": [],
    "reactions": {
      "brutal": "...",
      "silence": "...",
      "jargon": "..."
    }
  }
}

Produis UNIQUEMENT le JSON.`;
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
                        max_tokens: 2500
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
        const ecos = extractJson(content);
        caseData.ecos = ecos;

        if (!IS_DRY_RUN) {
            fs.writeFileSync(filePath, JSON.stringify(caseData, null, 2) + '\n', 'utf-8');
        }
        const count = (ecos.grilleAptitudesCliniques || []).length;
        console.log(`  ✅ ${path.basename(filePath)} : ${count} items générés`);
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
