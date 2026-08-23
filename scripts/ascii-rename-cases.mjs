#!/usr/bin/env node
/**
 * scripts/ascii-rename-cases.mjs — Renomme les fichiers de cas en ASCII pur
 *
 * Les noms accentués (é, è, ō, …) sont fragiles en URL-encoding cross-platform
 * (serveurs statiques, Docker, CDN). Ce script :
 *   1. Translittère les noms de fichiers data/*.json non-ASCII
 *   2. Met à jour data/case-index.json
 *   3. Met à jour les références dans js/, scripts/, test/, sql/ (*.js, *.mjs, *.sql)
 *
 * Usage : node scripts/ascii-rename-cases.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, renameSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, 'data');
const DRY_RUN = process.argv.includes('--dry-run');

const TRANSLIT = {
    'à': 'a', 'á': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a',
    'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
    'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
    'ò': 'o', 'ó': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o', 'ō': 'o',
    'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ū': 'u',
    'ç': 'c', 'ñ': 'n', 'ý': 'y', 'ÿ': 'y',
    'À': 'A', 'Á': 'A', 'Â': 'A', 'Ä': 'A',
    'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E',
    'Î': 'I', 'Ï': 'I', 'Ô': 'O', 'Ö': 'O', 'Ō': 'O',
    'Ù': 'U', 'Û': 'U', 'Ü': 'U', 'Ç': 'C'
};

function toAscii(name) {
    let out = '';
    for (const ch of name) out += TRANSLIT[ch] ?? ch;
    return out;
}

// ── 1. Renommage des fichiers ──
const renames = new Map(); // ancien (avec .json) → nouveau
for (const file of readdirSync(DATA_DIR)) {
    if (!file.endsWith('.json')) continue;
    if (!/[^\x00-\x7F]/.test(file)) continue;
    const newName = toAscii(file);
    if (newName === file) continue;
    renames.set(file, newName);
    if (!DRY_RUN) {
        renameSync(join(DATA_DIR, file), join(DATA_DIR, newName));
    }
    console.log(`📝 ${file}  →  ${newName}`);
}

if (renames.size === 0) {
    console.log('✅ Aucun fichier non-ASCII à renommer.');
    process.exit(0);
}

// ── 2. Mise à jour de case-index.json ──
const INDEX_PATH = join(DATA_DIR, 'case-index.json');
let indexText = readFileSync(INDEX_PATH, 'utf8');
for (const [oldName, newName] of renames) {
    const oldBase = oldName.replace(/\.json$/, '');
    const newBase = newName.replace(/\.json$/, '');
    indexText = indexText.split(oldName).join(newName).split(oldBase).join(newBase);
}
if (!DRY_RUN) writeFileSync(INDEX_PATH, indexText, 'utf8');
console.log('🗂️  case-index.json mis à jour');

// ── 3. Références dans le code ──
import { readdirSync as rd } from 'node:fs';
const scanDirs = ['js', 'scripts', 'test', 'sql'];
let refCount = 0;
for (const dir of scanDirs) {
    let files = [];
    try { files = readdirSync(join(ROOT, dir)); } catch { continue; }
    for (const f of files) {
        if (!/\.(js|mjs|sql)$/.test(f)) continue;
        const p = join(ROOT, dir, f);
        let text = readFileSync(p, 'utf8');
        let changed = false;
        for (const [oldName, newName] of renames) {
            const oldBase = oldName.replace(/\.json$/, '');
            const newBase = newName.replace(/\.json$/, '');
            if (text.includes(oldName)) { text = text.split(oldName).join(newName); changed = true; }
            if (text.includes(oldBase)) { text = text.split(oldBase).join(newBase); changed = true; }
        }
        if (changed) {
            refCount++;
            console.log(`🔗 références mises à jour : ${dir}/${f}`);
            if (!DRY_RUN) writeFileSync(p, text, 'utf8');
        }
    }
}

console.log(`\n${DRY_RUN ? '[dry-run] ' : '✅ '}${renames.size} fichier(s) renommé(s), ${refCount} fichier(s) de code mis à jour`);
