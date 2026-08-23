#!/usr/bin/env node
/**
 * scripts/generate-case-index.mjs — Régénère data/case-index.json depuis les fichiers
 *
 * Stratégie conservatrice :
 *   - Conserve la taxonomie existante (spécialités et affectations valides)
 *   - Déduplique (un fichier = une seule spécialité, priorité à la première occurrence)
 *   - Retire les fichiers supprimés du disque
 *   - Ajoute les nouveaux fichiers en inférant la spécialité depuis le préfixe
 *
 * Usage : node scripts/generate-case-index.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, 'data');
const INDEX_PATH = join(DATA_DIR, 'case-index.json');
const DRY_RUN = process.argv.includes('--dry-run');

const NON_CASE_FILES = new Set(['case-index.json', 'drugs.json', 'patient_test_complet.json', 'test_gating.json']);

// Inférence spécialité ← préfixe de nom de fichier (pour les fichiers non encore indexés)
const PREFIX_TO_SPECIALTY = {
    cardio: 'cardiologie',
    digestif: 'appareil-digestif',
    neuro: 'neurologie/psychiatrie',
    NEURO: 'neurologie/psychiatrie',
    nephro: 'uronephro',
    uro: 'uronephro',
    URO: 'uronephro',
    locomoteur: 'locomoteur',
    gyneco: 'gynecologie',
    pneumo: 'pneumologie',
    edn: 'endocrinologie',
    EDN: 'endocrinologie',
    urgence: 'urgence'
};

function inferSpecialty(filename) {
    const prefix = filename.split('_')[0];
    return PREFIX_TO_SPECIALTY[prefix] || null;
}

// ── Charger l'index actuel ──
let index = {};
try {
    index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
} catch {
    console.warn('⚠️  case-index.json absent ou invalide — reconstruction complète');
}

// ── Fichiers réellement présents ──
const diskFiles = readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json') && !NON_CASE_FILES.has(f))
    .sort();
const diskSet = new Set(diskFiles.map(f => f.replace(/\.json$/, '')));

// ── Assainir l'index existant : dédoublonner + retirer les fichiers disparus ──
const assigned = new Set();
const newIndex = {};
for (const [specialty, list] of Object.entries(index)) {
    if (!Array.isArray(list)) continue;
    const clean = [];
    for (const entry of list) {
        const name = typeof entry === 'string' ? entry : entry.file;
        if (!name) continue;
        const base = name.replace(/\.json$/, '');
        if (!diskSet.has(base)) {
            console.log(`🗑️  ${specialty}: "${name}" n'existe plus sur le disque — retiré`);
            continue;
        }
        if (assigned.has(base)) {
            console.log(`♻️  ${specialty}: "${name}" déjà listé ailleurs — doublon retiré`);
            continue;
        }
        assigned.add(base);
        clean.push(typeof entry === 'string' ? name : { ...entry, file: name });
    }
    if (clean.length > 0) newIndex[specialty] = clean;
}

// ── Ajouter les fichiers non indexés ──
for (const file of diskFiles) {
    const base = file.replace(/\.json$/, '');
    if (assigned.has(base)) continue;
    const specialty = inferSpecialty(file);
    if (!specialty) {
        console.warn(`⚠️  "${file}" : spécialité non déductible du préfixe — laissé hors index`);
        continue;
    }
    if (!newIndex[specialty]) newIndex[specialty] = [];
    newIndex[specialty].push(file);
    assigned.add(base);
    console.log(`➕ ${specialty}: "${file}" ajouté`);
}

// ── Écriture ──
const output = JSON.stringify(newIndex, null, 2) + '\n';
if (DRY_RUN) {
    console.log('\n[dry-run] case-index.json non modifié.');
} else {
    writeFileSync(INDEX_PATH, output, 'utf8');
    console.log(`\n✅ case-index.json régénéré (${assigned.size} cas, ${Object.keys(newIndex).length} spécialités)`);
}
