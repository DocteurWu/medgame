#!/usr/bin/env node
/**
 * scripts/generate-ecos-feedback.mjs — Génération LLM du feedback pédagogique
 *
 * Pour chaque cas linéaire dont le champ `feedback` ne couvre pas tous les
 * diagnostics possibles/alternatifs, génère un feedback dédié par mauvais
 * diagnostic (pourquoi c'est faux, piège sémiologique, argument clé) à partir
 * de la correction riche déjà présente dans le cas.
 *
 * Configuration (variables d'environnement ou .env) :
 *   LLM_API_URL   — défaut https://api.groq.com/openai/v1/chat/completions
 *   LLM_API_KEY   — OBLIGATOIRE (jamais commitée)
 *   LLM_MODEL     — défaut llama-3.3-70b-versatile
 *
 * Usage :
 *   node scripts/generate-ecos-feedback.mjs --dry-run   (défaut : n'écrit rien)
 *   node scripts/generate-ecos-feedback.mjs --write     (applique les modifications)
 *   node scripts/generate-ecos-feedback.mjs --file CARDIO_angor_stable.json
 *
 * ⚠️  Relire les sorties avant mise en production (revue humaine obligatoire).
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, 'data');

const WRITE = process.argv.includes('--write');
const fileArgIdx = process.argv.indexOf('--file');
const ONLY_FILE = fileArgIdx !== -1 ? process.argv[fileArgIdx + 1] : null;

const API_URL = process.env.LLM_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const API_KEY = process.env.LLM_API_KEY;
const MODEL = process.env.LLM_MODEL || 'llama-3.3-70b-versatile';

if (!API_KEY) {
    console.error('❌ LLM_API_KEY manquante. Créez un fichier .env (voir .env.example) ou exportez la variable.');
    process.exit(1);
}

const NON_CASE_FILES = new Set(['case-index.json', 'drugs.json', 'patient_test_complet.json', 'test_gating.json']);

async function callLLM(messages, { maxTokens = 900, temperature = 0.4 } = {}) {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
}

function buildPrompt(cas, diag) {
    return `Tu es professeur de médecine (DFGSM/ECNi). Un étudiant a posé le diagnostic « ${diag} » alors que le diagnostic attendu est « ${cas.correctDiagnostic} ».

CAS : patient ${cas.patient?.prenom || ''} ${cas.patient?.nom || ''}, ${cas.patient?.age || '?'} ans (${cas.patient?.sexe || '?'})
MOTIF : ${cas.interrogatoire?.motifHospitalisation || 'non précisé'}
CORRECTION DE RÉFÉRENCE :
${(cas.correction || '').slice(0, 1500)}

Rédige le feedback PÉDAGOGIQUE expliquant pourquoi « ${diag} » est incorrect ici :
- 3 à 5 phrases courtes en français
- cite 1-2 éléments sémiologiques DU CAS qui éliminent ce diagnostic
- mentionne le piège classique que représente ce diagnostic
- ton bienveillant mais exigeant, pas de markdown, pas de liste à puces, un seul paragraphe`;
}

async function main() {
    const files = readdirSync(DATA_DIR)
        .filter(f => f.endsWith('.json') && !NON_CASE_FILES.has(f))
        .filter(f => !ONLY_FILE || f === ONLY_FILE);

    let touched = 0;
    let skipped = 0;

    for (const file of files) {
        const path = join(DATA_DIR, file);
        let cas;
        try {
            cas = JSON.parse(readFileSync(path, 'utf8'));
        } catch { continue; }

        // Format graphe (urgence) : pas de scoring par diagnostic → skip
        if (cas.gameplayConfig || !cas.correctDiagnostic) continue;

        const feedback = cas.feedback && typeof cas.feedback === 'object' ? cas.feedback : {};
        const targets = [...(cas.possibleDiagnostics || []), ...(cas.alternativeDiagnostics || [])]
            .filter(d => d && d !== cas.correctDiagnostic && !feedback[d]);

        if (targets.length === 0) { skipped++; continue; }

        console.log(`\n📄 ${file} — ${targets.length} feedback(s) à générer`);
        if (!WRITE) {
            console.log('   (dry-run — relancer avec --write pour appliquer)');
            touched++;
            continue;
        }

        for (const diag of targets) {
            try {
                const text = await callLLM([
                    { role: 'system', content: 'Tu es un enseignant de médecine français, précis et concis.' },
                    { role: 'user', content: buildPrompt(cas, diag) }
                ]);
                feedback[diag] = text.trim();
                console.log(`   ✓ ${diag.slice(0, 60)}`);
            } catch (e) {
                console.error(`   ✗ ${diag.slice(0, 50)} : ${e.message}`);
            }
        }

        cas.feedback = feedback;
        writeFileSync(path, JSON.stringify(cas, null, 2) + '\n', 'utf8');
        touched++;
    }

    console.log(`\n${WRITE ? '✅ Appliqué' : '🔍 Dry-run'} : ${touched} fichier(s) modifiable(s), ${skipped} déjà complet(s)`);
    if (!WRITE) console.log('   Relancez avec --write pour écrire (revue humaine recommandée ensuite).');
}

main().catch(e => { console.error(e); process.exit(1); });
