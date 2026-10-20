/**
 * test/case-index.test.mjs — Cohérence de `data/case-index.json` et
 * `data/case-meta.json`.
 *
 * `case-meta.json` est généré par `npm run generate:index` et alimente la page
 * « thèmes » : s'il est incomplet, un cas disparaît de la liste ou retombe sur
 * un téléchargement de corps. On verrouille donc la couverture exacte.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA = join(ROOT, 'data');

const index = JSON.parse(readFileSync(join(DATA, 'case-index.json'), 'utf8'));
const metaPath = join(DATA, 'case-meta.json');

const indexedFiles = Object.values(index).flat().map(e => (typeof e === 'string' ? e : e.file));

test('case-index.json : chaque fichier indexé existe sur le disque', () => {
    for (const file of indexedFiles) {
        assert.ok(existsSync(join(DATA, file)), `fichier indexé absent : ${file}`);
    }
});

test('case-meta.json : présent et couvre exactement les cas indexés', () => {
    assert.ok(existsSync(metaPath), 'case-meta.json manquant — lancer npm run generate:index');
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    const metaKeys = new Set(Object.keys(meta));
    for (const file of indexedFiles) {
        assert.ok(metaKeys.has(file), `métadonnées absentes pour ${file}`);
    }
    for (const key of metaKeys) {
        assert.ok(indexedFiles.includes(key), `métadonnée orpheline (cas non indexé) : ${key}`);
    }
});

test('case-meta.json : champs requis et types corrects', () => {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    for (const [file, m] of Object.entries(meta)) {
        assert.equal(typeof m.id, 'string', `${file}: id`);
        assert.equal(typeof m.motif, 'string', `${file}: motif`);
        assert.equal(typeof m.patient, 'string', `${file}: patient`);
        assert.equal(typeof m.isEcos, 'boolean', `${file}: isEcos`);
        assert.equal(typeof m.isUrgence, 'boolean', `${file}: isUrgence`);
        assert.equal(typeof m.examCount, 'number', `${file}: examCount`);
        assert.equal(typeof m.lockCount, 'number', `${file}: lockCount`);
        assert.equal(m.id, file.replace(/\.json$/, ''), `${file}: id doit être la base du nom de fichier`);
    }
});
