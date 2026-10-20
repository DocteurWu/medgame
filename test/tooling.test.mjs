/**
 * test/tooling.test.mjs
 *
 * Coherence de l'outillage : la liste de tests declaree dans package.json, les
 * scripts npm, et les dependances reellement importees.
 *
 * Pourquoi ce test existe
 * -----------------------
 * 1. La liste `npm test` etait ecrite a la main, et RIEN ne verifiait qu'elle
 *    couvrait tous les fichiers `test/*.test.mjs`. Un test nouveau etait donc
 *    ignore silencieusement par le CI — c'est ce qui est arrivé aux 13 tests
 *    supprimes puis restaures lors du nettoyage du corpus.
 * 2. `scripts/validate-cases.mjs` importait `ajv` sans le declarer : le
 *    paquet n'etait present que par hoist transitif via
 *    `@modelcontextprotocol/sdk`. Le CI executait `npm run validate:cases`
 *    par hasard, pas par contrat.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';

const ROOT = path.resolve('.');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function listFiles(dir, filter) {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) return [];
    return fs.readdirSync(full)
        .filter((f) => filter.test(f))
        .sort();
}

test('La liste `npm test` couvre exactement les fichiers test/*.test.mjs', () => {
    const declared = (pkg.scripts.test.match(/test\/[\w\-.]+\.test\.mjs/g) || []).map(
        (p) => path.basename(p)
    );
    const onDisk = listFiles('test', /\.test\.mjs$/);

    const missing = onDisk.filter((f) => !declared.includes(f));
    const ghost = declared.filter((f) => !onDisk.includes(f));

    assert.deepEqual(
        missing,
        [],
        `Fichiers de test presents sur le disque mais absents de \`npm test\` : ` +
        `${missing.join(', ')}`
    );
    assert.deepEqual(
        ghost,
        [],
        `Fichiers de test listes dans \`npm test\` mais absents du disque : ` +
        `${ghost.join(', ')}`
    );
});

test('La liste `npm run test:ui` couvre exactement les fichiers test/verify-ui-*.mjs', () => {
    const declared = (pkg.scripts['test:ui'].match(/test\/[\w\-.]+\.mjs/g) || []).map((p) =>
        path.basename(p)
    );
    const onDisk = listFiles('test', /^verify-ui-[\w\-.]+\.mjs$/);

    const missing = onDisk.filter((f) => !declared.includes(f));
    const ghost = declared.filter((f) => !onDisk.includes(f));

    assert.deepEqual(missing, [], `Tests UI non executes par \`npm run test:ui\` : ${missing.join(', ')}`);
    assert.deepEqual(ghost, [], `Tests UI listes mais absents du disque : ${ghost.join(', ')}`);
});

test('Chaque script npm pointe vers un fichier existant', () => {
    const ghosts = [];
    for (const [name, command] of Object.entries(pkg.scripts)) {
        const m = command.match(/(?:node|bash)\s+([\w\-\.\/]+\.(?:mjs|js))/);
        if (!m) continue;
        if (!fs.existsSync(path.join(ROOT, m[1]))) ghosts.push(`${name} -> ${m[1]}`);
    }
    assert.deepEqual(ghosts, [], `Scripts npm pointant vers un fichier absent : ${ghosts.join(', ')}`);
});

test('Toute dependance npm importee directement est declaree', () => {
    const declared = new Set([
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.devDependencies || {}),
    ]);
    const builtins = new Set(builtinModules);
    // Sous-chemin possible : 'node:fs' -> 'fs', '@scope/pkg' -> '@scope/pkg'
    const isBuiltin = (spec) =>
        builtins.has(spec) ||
        builtins.has(spec.replace(/^node:/, '')) ||
        spec.startsWith('node:');

    const roots = [
        'scripts',
        'test',
        'netlify/functions',
        'engine',
    ];
    const files = [];
    for (const dir of roots) {
        const full = path.join(ROOT, dir);
        if (!fs.existsSync(full)) continue;
        for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
            if (entry.isFile() && /\.(mjs|js)$/.test(entry.name)) {
                files.push(path.join(dir, entry.name));
            }
        }
    }
    files.push('mcp-server.js');

    const undeclared = new Map();
    for (const file of files) {
        const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
        const specs = new Set();
        for (const m of content.matchAll(/(?:^|[\s;{}(=])(?:import|export)\s[^'"]*from\s*['"]([^'"]+)['"]/g)) {
            specs.add(m[1]);
        }
        for (const m of content.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
            specs.add(m[1]);
        }
        for (const m of content.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
            specs.add(m[1]);
        }

        for (const spec of specs) {
            if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('http')) continue;
            if (isBuiltin(spec)) continue;
            // Les specifiers d'assets virtuels (three, three/addons/...) sont
            // resolus par l'importmap du navigateur, pas par npm.
            if (spec === 'three' || spec.startsWith('three/')) continue;
            const pkgName = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
            if (!declared.has(pkgName)) {
                if (!undeclared.has(pkgName)) undeclared.set(pkgName, []);
                undeclared.get(pkgName).push(file);
            }
        }
    }

    const details = [...undeclared.entries()]
        .map(([name, files]) => `${name} (${files.join(', ')})`)
        .join(' ; ');
    assert.deepEqual([...undeclared.keys()], [], `Dependances importees mais non declarees : ${details}`);
});

test('Les scripts npm `test` et `test:ui` ne contiennent aucune reference morte', () => {
    for (const key of ['test', 'test:ui']) {
        const refs = pkg.scripts[key].match(/test\/[\w\-.]+\.mjs/g) || [];
        for (const ref of refs) {
            assert.ok(
                fs.existsSync(path.join(ROOT, ref)),
                `${key} reference un fichier absent : ${ref}`
            );
        }
    }
});

test('Chaque variable d\'environnement lue par le code est documentee dans .env.example', () => {
    // Drift constate lors du nettoyage : le code lisait SUPABASE_ANON_KEY
    // alors que .env.example declarait SUPABASE_KEY, et les cinq variables
    // reellement utilisees etaient toutes commentees — copier le fichier
    // produisait donc une configuration qui ne demarre pas.
    const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');

    const files = [];
    for (const dir of ['netlify/functions', 'scripts']) {
        const full = path.join(ROOT, dir);
        if (!fs.existsSync(full)) continue;
        for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
            if (entry.isFile() && /\.(mjs|js)$/.test(entry.name)) {
                files.push(path.join(dir, entry.name));
            }
        }
    }
    files.push('mcp-server.js');

    const used = new Set();
    for (const file of files) {
        const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
        for (const m of content.matchAll(/process\.env\.([A-Z_][A-Z_0-9]*)/g)) {
            used.add(m[1]);
        }
    }

    const undocumented = [...used].filter((v) => !new RegExp(`\\b${v}\\b`).test(example));
    assert.deepEqual(
        undocumented,
        [],
        `Variables lues par le code mais absentes de .env.example : ${undocumented.join(', ')}`
    );
});

test('Chaque reference locale de script/style/link existe sur le disque', () => {
    // Une balise qui pointe un fichier supprimé ne casse pas la page de
    // visible : le navigateur journalise 404 et continue. Le symptome
    // apparait plus tard, et ailleurs (« le bouton ne fait rien »).
    const htmlFiles = fs
        .readdirSync(ROOT)
        .filter((f) => f.endsWith('.html'))
        .sort();

    const broken = [];
    for (const file of htmlFiles) {
        const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
        const re = /(?:src|href)\s*=\s*["']([^"']+)["']/g;
        for (const m of content.matchAll(re)) {
            const ref = m[1];
            if (!ref || ref.startsWith('#')) continue;
            if (/^(https?:|data:|mailto:|tel:|javascript:|about:|\/\/)/.test(ref)) continue;
            const clean = ref.split('?')[0].split('#')[0];
            if (!clean) continue;
            if (!fs.existsSync(path.join(ROOT, clean))) broken.push(`${file} -> ${ref}`);
        }
    }

    assert.deepEqual(broken, [], `References locales introuvables : ${broken.join(', ')}`);
});
