/**
 * test/security-headers.test.mjs
 *
 * Coherence des en-tetes de securite entre les trois points de livraison :
 *   - netlify.toml        (Netlify)
 *   - _headers            (Netlify, format « fichier »)
 *   - nginx-security.conf (Docker / nginx)
 *
 * Pourquoi ce test existe
 * -----------------------
 * Les trois fichiers portaient la MEME CSP, recopiee a la main. Aucune
 * verification ne comparait effectivement les chaines entre elles : le test
 * qui existait (dans test/neuro-atlas.test.mjs, supprime au nettoyage du
 * corpus) ne verifiait que 3 en-tetes sur 5 et ne comparait jamais la CSP
 * d'une source a l'autre. Une divergence de 10 caracteres dans la CSP aurait
 * donc passe le CI sans qu'on s'en apercoive.
 *
 * Ce test compare les CSP octet pour octet, verifie les 5 en-tetes dans les
 * 3 sources, compare les regles de Cache-Control entre netlify.toml et
 * _headers, et verifie le piege nginx : dans nginx, un `add_header` declare
 * dans un `location` ANNULE tous les `add_header` herites du `server`. Chaque
 * `location` qui pose son propre Cache-Control doit donc reinclure le
 * fichier de securite.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

const SECURITY_HEADERS = [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'Content-Security-Policy',
];

/** Extrait la valeur d'un en-tete entre guillemets, dans un fichier de style nginx. */
function extractQuoted(content, header) {
    const re = new RegExp(`${header}\\s+"([^"]*)"`);
    const m = content.match(re);
    return m ? m[1] : null;
}

/** Extrait la valeur d'un en-tete, dans un format « cle = "valeur" ». */
function extractTomlQuoted(content, header) {
    const re = new RegExp(`${header}\\s*=\\s*"([^"]*)"`);
    const m = content.match(re);
    return m ? m[1] : null;
}

/** Extrait la valeur d'un en-tete, dans un format « cle: valeur ». */
function extractPlain(content, header) {
    const re = new RegExp(`^\\s*${header}\\s*:\\s*(.+?)\\s*$`, 'm');
    const m = content.match(re);
    return m ? m[1] : null;
}

/**
 * Parse les blocs `[[headers]]` de netlify.toml -> Map<chemin, Cache-Control>.
 */
function parseTomlCacheRules(content) {
    const rules = new Map();
    const blocks = content.split('[[headers]]').slice(1);
    for (const block of blocks) {
        const forMatch = block.match(/for\s*=\s*"([^"]+)"/);
        const ccMatch = block.match(/Cache-Control\s*=\s*"([^"]+)"/);
        if (forMatch && ccMatch) rules.set(forMatch[1], ccMatch[1]);
    }
    return rules;
}

/**
 * Parse les blocs de _headers -> Map<chemin, Cache-Control>.
 * Format : une ligne de chemin, puis des lignes « cle: valeur » indentées.
 */
function parseHeadersFileCacheRules(content) {
    const rules = new Map();
    const lines = content.split('\n');
    let current = null;
    for (const line of lines) {
        if (!line.trim() || line.trim().startsWith('#')) continue;
        if (!/^\s/.test(line)) {
            current = line.trim();
            continue;
        }
        const m = line.match(/^\s*Cache-Control\s*:\s*(.+?)\s*$/);
        if (m && current) rules.set(current, m[1]);
    }
    return rules;
}

test('Les 5 en-tetes de securite sont presents dans les 3 sources', () => {
    const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
    const headers = fs.readFileSync(path.join(ROOT, '_headers'), 'utf8');
    const nginx = fs.readFileSync(path.join(ROOT, 'nginx-security.conf'), 'utf8');

    for (const header of SECURITY_HEADERS) {
        assert.ok(
            extractTomlQuoted(toml, header),
            `netlify.toml : en-tete ${header} manquant`
        );
        assert.ok(
            extractPlain(headers, header),
            `_headers : en-tete ${header} manquant`
        );
        assert.ok(
            extractQuoted(nginx, header),
            `nginx-security.conf : en-tete ${header} manquant`
        );
    }
});

test('La CSP est identique, octet pour octet, dans les 3 sources', () => {
    const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
    const headers = fs.readFileSync(path.join(ROOT, '_headers'), 'utf8');
    const nginx = fs.readFileSync(path.join(ROOT, 'nginx-security.conf'), 'utf8');

    const fromToml = extractTomlQuoted(toml, 'Content-Security-Policy');
    const fromHeaders = extractPlain(headers, 'Content-Security-Policy');
    const fromNginx = extractQuoted(nginx, 'Content-Security-Policy');

    assert.ok(fromToml && fromHeaders && fromNginx, 'CSP introuvable dans une des sources');

    assert.equal(
        fromHeaders,
        fromToml,
        'La CSP de _headers diverge de celle de netlify.toml'
    );
    assert.equal(
        fromNginx,
        fromToml,
        'La CSP de nginx-security.conf diverge de celle de netlify.toml'
    );

    // La CSP doit rester une source unique : c'est elle qui autorise les
    // iframes internes (frame-src 'self') du module neuro-atlas.
    // `X-Frame-Options` est un en-tête distinct, vérifié par le test précédent.
    assert.match(fromToml, /frame-ancestors 'self'/);
    assert.match(fromToml, /frame-src 'self' blob:/);
    assert.match(fromToml, /object-src 'none'/);
    assert.match(fromToml, /base-uri 'self'/);
});

test('Les regles de Cache-Control de netlify.toml et _headers coincident', () => {
    const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
    const headers = fs.readFileSync(path.join(ROOT, '_headers'), 'utf8');

    const tomlRules = parseTomlCacheRules(toml);
    const headerRules = parseHeadersFileCacheRules(headers);

    const paths = new Set([...tomlRules.keys(), ...headerRules.keys()]);
    for (const p of paths) {
        assert.equal(
            headerRules.get(p),
            tomlRules.get(p),
            `Regle de cache divergente pour "${p}" (netlify.toml vs _headers)`
        );
    }

    // Contrepartie de la suppression des jetons `?v=` : le code applicatif
    // doit se revalider, sinon le navigateur sert une version perimee.
    assert.equal(
        tomlRules.get('/js/*'),
        'public, max-age=0, must-revalidate',
        '/js/* doit se revalider'
    );
    assert.equal(
        tomlRules.get('/css/*'),
        'public, max-age=0, must-revalidate',
        '/css/* doit se revalider'
    );
});

test('nginx : chaque location qui pose un Cache-Control reinclut les en-tetes', () => {
    const nginx = fs.readFileSync(path.join(ROOT, 'nginx.conf'), 'utf8');

    // Piege nginx : un `add_header` dans un `location` annule ceux herites du
    // `server`. Sans `include` du fichier de securite, les en-tetes
    // disparaissent sur les assets qui portent un Cache-Control.
    const includeCount = (nginx.match(/include\s+[^;]*medgame-security\.conf/g) || []).length;
    const cacheHeaderCount = (nginx.match(/add_header\s+Cache-Control/g) || []).length;

    assert.ok(
        includeCount >= cacheHeaderCount,
        `nginx.conf : ${cacheHeaderCount} ` +
        `add_header Cache-Control pour ${includeCount} include(s) — ` +
        `des en-tetes de securite seraient perdus`
    );
    assert.ok(includeCount > 0, 'nginx.conf n\'inclut jamais le fichier de securite');
});

test('Aucun jeton de cache-busting ?v= ne subsiste sur le code applicatif', () => {
    // L'identite d'un module ES est son URL resolue : deux URLs differentes
    // pour le meme fichier = deux instances du module. Le projet a longtemps
    // pose un `?v=` different sur chaque fichier, ce qui dupliquait toute la
    // pile 3D sur les pages qui la chargeaient statiquement ET dynamiquement.
    // Le cache est desormais gere par Cache-Control (voir netlify.toml).
    const roots = ['js', 'test', 'engine', 'scripts', 'netlify/functions'];
    const offenders = [];

    for (const root of roots) {
        const dir = path.join(ROOT, root);
        if (!fs.existsSync(dir)) continue;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isFile() || !/\.(js|mjs)$/.test(entry.name)) continue;
            const file = path.join(dir, entry.name);
            const content = fs.readFileSync(file, 'utf8');
            for (const m of content.matchAll(/["'`](\.{0,2}\/)?[\w\-/]+\.(?:js|mjs)\?v=/g)) {
                offenders.push(`${root}/${entry.name}`);
            }
        }
    }

    assert.deepEqual(
        [...new Set(offenders)],
        [],
        'Des references de modules portent encore un jeton ?v= (modules dupliques)'
    );
});
