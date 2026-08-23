#!/usr/bin/env node
/**
 * scripts/validate-cases.mjs — Validateur du corpus de cas cliniques
 *
 * Vérifie :
 *   1. Validité JSON + conformité au schéma (schemas/case.schema.json via ajv)
 *   2. Cohérences métier (diagnostic présent dans les choix, nœuds de graphe liés, …)
 *   3. Couverture des mécaniques avancées (rapport)
 *   4. Synchronisation data/case-index.json ↔ fichiers
 *
 * Usage : node scripts/validate-cases.mjs [--strict]
 *   --strict : les warnings deviennent des erreurs (pour CI)
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, 'data');
const SCHEMA_PATH = join(ROOT, 'schemas', 'case.schema.json');
const INDEX_PATH = join(DATA_DIR, 'case-index.json');

// Fichiers non-cas exclus du corpus
const NON_CASE_FILES = new Set(['case-index.json', 'drugs.json', 'patient_test_complet.json', 'test_gating.json']);
const TEST_CASE_IDS = new Set(['test_gating', 'patient_test_complet']);

const args = process.argv.slice(2);
const STRICT = args.includes('--strict');

let errors = 0;
let warnings = 0;
const warn = (file, msg) => { warnings++; console.warn(`  ⚠️  [${file}] ${msg}`); };
const fail = (file, msg) => { errors++; console.error(`  ❌ [${file}] ${msg}`); };

// ── 1. Schéma ────────────────────────────────────────────────────────────────
let validateSchema = null;
try {
    const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
    validateSchema = ajv.compile(JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')));
} catch (e) {
    console.error(`❌ Impossible de charger le schéma : ${e.message}`);
    process.exit(1);
}

const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && !NON_CASE_FILES.has(f));
console.log(`\n🔍 Validation de ${files.length} cas dans data/\n`);

const stats = {
    total: files.length,
    locks: 0, fatalTreatments: 0, alternativeDiagnostics: 0,
    secondLineTreatments: 0, relevantExams: 0, richFeedback: 0,
    linear: 0, graph: 0
};

for (const file of files) {
    const path = join(DATA_DIR, file);
    let json;
    try {
        json = JSON.parse(readFileSync(path, 'utf8'));
    } catch (e) {
        fail(file, `JSON invalide : ${e.message}`);
        continue;
    }

    // Schéma
    if (!validateSchema(json)) {
        for (const err of validateSchema.errors.slice(0, 5)) {
            fail(file, `schéma : ${err.instancePath || '/'} ${err.message}`);
        }
        continue;
    }

    // Qualité : prénom vide (jouable mais affichage dégradé)
    if (!json.patient.prenom) {
        warn(file, `patient.prenom vide — l'affichage montrera uniquement le nom`);
    }

    const isGraph = !!(json.gameplayConfig && json.nodes);
    if (isGraph) stats.graph++; else stats.linear++;

    // ── 2. Cohérences métier ──
    if (!isGraph) {
        if (json.possibleDiagnostics && json.correctDiagnostic
            && !json.possibleDiagnostics.includes(json.correctDiagnostic)) {
            warn(file, `correctDiagnostic absent de possibleDiagnostics ("${json.correctDiagnostic}")`);
        }
        if (Array.isArray(json.relevantExams) && Array.isArray(json.availableExams)) {
            const unknown = json.relevantExams.filter(e => !json.availableExams.includes(e));
            if (unknown.length > 0) warn(file, `relevantExams hors availableExams : ${unknown.join(', ')}`);
        }
        if (Array.isArray(json.locks)) {
            for (const lock of json.locks) {
                if (lock.type === 'QCM' && lock.challenge?.options) {
                    const idx = lock.challenge.correct_indices ?? (lock.challenge.correct_index !== undefined ? [lock.challenge.correct_index] : []);
                    const bad = idx.filter(i => i >= lock.challenge.options.length);
                    if (bad.length > 0) fail(file, `lock "${lock.id}" : index correct hors limites (${bad.join(',')})`);
                }
                if (lock.type === 'SAISIE' && !(lock.challenge?.expected_keywords?.length)) {
                    fail(file, `lock "${lock.id}" (SAISIE) sans expected_keywords`);
                }
            }
        }
    } else {
        const nodes = json.nodes;
        const start = json.gameplayConfig?.startNode;
        if (!nodes[start]) fail(file, `gameplayConfig.startNode introuvable : "${start}"`);
        let hasEnd = false;
        for (const [nodeId, node] of Object.entries(nodes)) {
            for (const action of node.actionsDisponibles || []) {
                if (!nodes[action.nextNode]) fail(file, `nœud "${nodeId}" → action "${action.label}" pointe vers nœud inconnu "${action.nextNode}"`);
            }
            const evo = node.evolutionAuto;
            if (evo && !nodes[evo.nextNode]) fail(file, `nœud "${nodeId}" → evolutionAuto pointe vers nœud inconnu "${evo.nextNode}"`);
            if (node.isEndState) hasEnd = true;
        }
        if (!hasEnd) warn(file, 'aucun nœud isEndState — scénario sans fin');
    }

    // Correction trop courte = feedback pédagogique insuffisant
    if ((json.correction || '').length < 100) {
        warn(file, `correction courte (${(json.correction || '').length} caractères < 100)`);
    }

    // ── 3. Couverture mécaniques avancées ──
    const fb = json.feedback || {};
    const isRichFeedback = Object.keys(fb).some(k => k !== 'correct' && k !== 'default');
    if (Array.isArray(json.locks) && json.locks.length > 0) stats.locks++;
    if (Array.isArray(json.fatalTreatments) && json.fatalTreatments.length) stats.fatalTreatments++;
    if (Array.isArray(json.alternativeDiagnostics) && json.alternativeDiagnostics.length) stats.alternativeDiagnostics++;
    if (Array.isArray(json.secondLineTreatments) && json.secondLineTreatments.length) stats.secondLineTreatments++;
    if (Array.isArray(json.relevantExams) && json.relevantExams.length) stats.relevantExams++;
    if (isRichFeedback) stats.richFeedback++;

    if (STRICT) {
        if (!(Array.isArray(json.fatalTreatments) && json.fatalTreatments.length)) warn(file, 'fatalTreatments manquant (--strict)');
        if (!(Array.isArray(json.alternativeDiagnostics) && json.alternativeDiagnostics.length)) warn(file, 'alternativeDiagnostics manquant (--strict)');
    }
}

// ── 4. Index ↔ fichiers ──────────────────────────────────────────────────────
console.log('\n🗂️  Vérification de case-index.json');
if (existsSync(INDEX_PATH)) {
    let index;
    try {
        index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
    } catch (e) {
        fail('case-index.json', `JSON invalide : ${e.message}`);
        index = null;
    }
    if (index) {
        const indexed = new Map();
        for (const [specialty, list] of Object.entries(index)) {
            for (const entry of list) {
                const name = typeof entry === 'string' ? entry : entry.file;
                if (!name) continue;
                if (indexed.has(name)) warn('case-index.json', `"${name}" listé deux fois (${indexed.get(name)} + ${specialty})`);
                indexed.set(name, specialty);
            }
        }
        for (const file of files) {
            const base = basename(file, '.json');
            if (TEST_CASE_IDS.has(base)) continue;
            if (!indexed.has(base) && !indexed.has(file)) {
                warn(file, 'absent de case-index.json (jamais proposé aux joueurs)');
            }
        }
        for (const [name] of indexed) {
            const f = name.endsWith('.json') ? name : `${name}.json`;
            if (!files.includes(name.endsWith('.json') ? name : `${name}.json`)) {
                fail('case-index.json', `référence introuvable sur le disque : ${f}`);
            }
        }
    }
} else {
    warn('case-index.json', 'fichier absent');
}

// ── Rapport ──────────────────────────────────────────────────────────────────
const pct = (n) => `${Math.round((n / stats.total) * 100)} %`;
console.log('\n📊 Couverture des mécaniques avancées');
console.log(`   Formats          : ${stats.linear} linéaires · ${stats.graph} graphes`);
console.log(`   locks            : ${stats.locks}/${stats.total} (${pct(stats.locks)})`);
console.log(`   fatalTreatments  : ${stats.fatalTreatments}/${stats.total} (${pct(stats.fatalTreatments)})`);
console.log(`   alternativeDiag  : ${stats.alternativeDiagnostics}/${stats.total} (${pct(stats.alternativeDiagnostics)})`);
console.log(`   secondLine       : ${stats.secondLineTreatments}/${stats.total} (${pct(stats.secondLineTreatments)})`);
console.log(`   relevantExams    : ${stats.relevantExams}/${stats.total} (${pct(stats.relevantExams)})`);
console.log(`   feedback riche   : ${stats.richFeedback}/${stats.total} (${pct(stats.richFeedback)})`);

console.log(`\n${errors === 0 ? '✅' : '❌'} Terminé : ${errors} erreur(s), ${warnings} warning(s)\n`);
process.exit(errors > 0 || (STRICT && warnings > 0) ? 1 : 0);
