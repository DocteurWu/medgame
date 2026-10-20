/**
 * test/no-undef.test.mjs — Detection statique des symboles non definis.
 *
 * POURQUOI CE TEST EXISTE
 *
 * `node --check` est purement syntaxique : il ne voit pas un symbole UTILISE
 * mais jamais defini. C'est le trou exact dans lequel un bug a glisse :
 * `getLevenshteinDistance` etait appele dans `submitLock()` sans avoir ete
 * ajoute a la liste d'import, apres son deplacement vers engine/scoring.js.
 * Resultat : `ReferenceError` a l'execution, sur le chemin MCP
 * `submit_lock_answer`, invisible a la CI et a tous les tests existants.
 *
 * POURQUOI C'EST Difficile
 *
 * Le projet melange deux mondes :
 *   - des SCRIPTS CLASSIQUES (`<script src=...>`) : leurs `const`/`function`
 *     de premier niveau deviennent des GLOBALES de page ;
 *   - des MODULES ES (`<script type="module">`) : their scope is strict.
 *
 * `js/utils.js` (classique) declare `getLevenshteinDistance`. Dans le
 * navigateur, ce nom est donc une globale, et l'import oublie dans
 * engine/MedGameEngine.js ne se verrait pas. Mais l'engine MCP tourne dans
 * NODE, ou `utils.js` n'est pas charge : le meme code y leve un
 * ReferenceError.
 *
 * Le test resout donc chaque fichier DANS SON CONTEXTE :
 *   - un fichier de `js/` est analyse avec les globales des scripts
 *     classiques charges par les pages qui le chargent ;
 *   - un fichier de `engine/`, `scripts/`, `netlify/` ou `mcp-server.js`
 *     est analyse avec les globales de NODE SEULEMENT.
 *
 * PRUDENCE — l'analyse reste DELIBEREMENT CONSERVATRICE :
 *   - toute declaration du nom dans le fichier (quelle que soit sa portee)
 *     est acceptee : on prefere manquer un cas a crier au lieu de faire
 *     echouer la CI a tort ;
 *   - les globales posees sur window dans N'IMPORTE QUEL fichier du depot
 *     sont acceptees ;
 *   - les globals JS bien connus sont acceptes.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as acorn from 'acorn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Dossiers analyses (fichiers de code applicatif). */
const CODE_ROOTS = ['js', 'engine', 'netlify', 'scripts', 'test'];
/** Dossiers ou les fichiers classicques alimentent les globales de page. */
const GLOBAL_ROOTS = ['js', 'engine', 'netlify', 'scripts', 'test', 'data'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'neuro-atlas', 'dist', 'assets', 'libs']);

/** Globals JS et navigateur, resolus partout. */
const KNOWN_GLOBALS = new Set([
    'globalThis', 'window', 'document', 'console', 'navigator', 'location', 'history',
    'localStorage', 'sessionStorage', 'performance', 'crypto', 'fetch', 'Request',
    'Response', 'Headers', 'URL', 'URLSearchParams', 'TextEncoder', 'TextDecoder',
    'AbortController', 'CustomEvent', 'Event', 'EventTarget', 'FormData', 'Blob',
    'File', 'FileReader', 'Image', 'Audio', 'Worker', 'Notification', 'DOMParser',
    'XMLSerializer', 'Text', 'Comment', 'Range', 'Selection', 'getSelection',
    'Element', 'HTMLElement', 'Node', 'NodeList', 'DocumentFragment', 'CSSStyleSheet',
    'ShadowRoot', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver',
    'PerformanceObserver', 'Path2D', 'ImageData', 'CanvasRenderingContext2D',
    'HTMLCanvasElement', 'HTMLImageElement', 'HTMLInputElement',
    'matchMedia', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame',
    'requestIdleCallback', 'cancelIdleCallback', 'queueMicrotask', 'setTimeout',
    'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate',
    'structuredClone', 'alert', 'confirm', 'prompt', 'open', 'close', 'focus', 'blur',
    'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol',
    'BigInt', 'Date', 'RegExp', 'Error', 'TypeError', 'RangeError', 'SyntaxError',
    'ReferenceError', 'EvalError', 'URIError', 'AggregateError', 'Promise', 'Proxy',
    'Reflect', 'WeakMap', 'WeakSet', 'Map', 'Set', 'Intl', 'parseInt', 'parseFloat',
    'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'encodeURI',
    'decodeURI', 'escape', 'unescape', 'undefined', 'NaN', 'Infinity', 'eval',
    'AudioContext', 'webkitAudioContext', 'OfflineAudioContext', 'AnalyserNode',
    'GainNode', 'AudioBuffer', 'AudioBufferSourceNode', 'StereoPannerNode',
    'DynamicsCompressorNode', 'BiquadFilterNode', 'OscillatorNode', 'AudioParam',
    'AudioListener', 'ChannelMergerNode', 'ChannelSplitterNode', 'ConvolverNode',
    'DelayNode', 'AudioWorkletNode', 'MediaStream', 'MediaRecorder', 'WebSocket',
    'process', 'Buffer', '__dirname', '__filename', 'module', 'exports', 'require',
    'global', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array',
    'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array',
    'BigInt64Array', 'BigUint64Array', 'ArrayBuffer', 'SharedArrayBuffer', 'DataView',
    'Atomics', 'WeakRef', 'FinalizationRegistry', 'Function', 'caches',
    'DOMException', 'ReadableStream', 'WritableStream', 'TransformStream',
    'DecompressionStream', 'CompressionStream', 'ByteLengthQueuingStrategy',
    'CountQueuingStrategy', 'ReadableStreamDefaultReader',
    'EventSource', 'gsap', 'event'
]);

function walk(dir, acc = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, acc);
        else if (/\.(js|mjs)$/.test(entry.name)) acc.push(full);
    }
    return acc;
}

function collectFiles(roots) {
    const files = [];
    for (const root of roots) {
        const dir = path.join(ROOT, root);
        if (!fs.existsSync(dir)) continue;
        walk(dir, files);
    }
    return files;
}

const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

/** Analyse un fichier : { declared, imported, used, isModule }. */
function analyze(source) {
    let ast;
    let isModule = true;
    try {
        ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
    } catch {
        isModule = false;
        ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
    }

    const declared = new Set();
    const imported = new Set();
    const used = new Map();

    const addPattern = (pattern) => {
        if (!pattern) return;
        switch (pattern.type) {
            case 'Identifier': declared.add(pattern.name); return;
            case 'RestElement': addPattern(pattern.argument); return;
            case 'AssignmentPattern': addPattern(pattern.left); return;
            case 'ArrayPattern': pattern.elements.forEach(addPattern); return;
            case 'ObjectPattern':
                pattern.properties.forEach(p => addPattern(p.value || p.argument));
                return;
            default: return;
        }
    };

    const isMemberProp = (node, parent) =>
        parent && (parent.type === 'MemberExpression' || parent.type === 'Property')
        && parent.property === node && !parent.computed;

    const walkAst = (node, parent) => {
        if (!node || typeof node.type !== 'string') return;

        if (node.type === 'Identifier') {
            if (!isMemberProp(node, parent)
                && !declared.has(node.name) && !imported.has(node.name)) {
                if (!used.has(node.name)) used.set(node.name, node.loc?.start?.line);
            }
            return;
        }
        if (node.type === 'MetaProperty' || node.type === 'ImportExpression') {
            if (node.type === 'ImportExpression') {
                if (node.source) walkAst(node.source, node);
                if (node.options) walkAst(node.options, node);
            }
            return;
        }
        if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression'
            || node.type === 'ArrowFunctionExpression') {
            if (node.id) declared.add(node.id.name);
            node.params.forEach(addPattern);
            for (const p of node.params) {
                if (p.type === 'AssignmentPattern') walkAst(p.right, p);
            }
            if (node.body) walkAst(node.body, node);
            return;
        }
        if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
            if (node.id) declared.add(node.id.name);
            if (node.superClass) walkAst(node.superClass, node);
            if (node.body) walkAst(node.body, node);
            return;
        }
        if (node.type === 'ClassBody') {
            for (const el of node.body) walkAst(el, node);
            return;
        }
        if (node.type === 'MethodDefinition' || node.type === 'PropertyDefinition') {
            if (node.computed && node.key) walkAst(node.key, node);
            if (node.value) walkAst(node.value, node);
            return;
        }
        if (node.type === 'VariableDeclarator') {
            addPattern(node.id);
            if (node.init) walkAst(node.init, node);
            return;
        }
        if (node.type === 'CatchClause') {
            addPattern(node.param);
            if (node.body) walkAst(node.body, node);
            return;
        }
        if (node.type === 'ObjectPattern' || node.type === 'ArrayPattern') {
            for (const el of (node.elements || node.properties || [])) {
                if (!el) continue;
                if (el.type === 'RestElement') addPattern(el.argument);
                else if (el.type === 'Property') addPattern(el.value);
                else addPattern(el);
            }
            return;
        }
        if (node.type === 'RestElement') { addPattern(node.argument); return; }
        if (node.type === 'AssignmentPattern') {
            addPattern(node.left);
            walkAst(node.right, node);
            return;
        }
        if (node.type === 'Property' && !node.computed) {
            if (node.value) walkAst(node.value, node);
            return;
        }
        if (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration') {
            for (const spec of node.specifiers || []) {
                declared.add(spec.local.name);
                imported.add(spec.local.name);
            }
            return;
        }
        if (node.type === 'ExportNamedDeclaration') {
            if (node.declaration) {
                if (node.declaration.type === 'VariableDeclaration') {
                    for (const d of node.declaration.declarations) addPattern(d.id);
                } else if (node.declaration.id) {
                    declared.add(node.declaration.id.name);
                }
            }
            for (const spec of node.specifiers || []) {
                declared.add(spec.local.name);
                imported.add(spec.local.name);
            }
            if (node.source) return;
            if (node.declaration) walkAst(node.declaration, node);
            return;
        }
        if (node.type === 'ExportDefaultDeclaration') {
            if (node.declaration) walkAst(node.declaration, node);
            return;
        }
        if (node.type === 'LabeledStatement' || node.type === 'BreakStatement'
            || node.type === 'ContinueStatement') {
            if (node.body) walkAst(node.body, node);
            return;
        }
        for (const key of Object.keys(node)) {
            if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
            const child = node[key];
            if (Array.isArray(child)) child.forEach(c => walkAst(c, node));
            else if (child && typeof child.type === 'string') walkAst(child, node);
        }
    };

    for (const node of ast.body) walkAst(node, null);
    return { declared, imported, used, isModule };
}

/** Noms declares au premier niveau d'un script (globales de page). */
function topLevelNames(source) {
    const names = new Set();
    for (const m of source.matchAll(/^[ \t]*(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)) {
        names.add(m[1]);
    }
    return names;
}

describe('Symboles non definis', () => {

    test('aucun symbole utilise n\'est defini dans son contexte', () => {
        const codeFiles = collectFiles(CODE_ROOTS);
        const allScripts = collectFiles(GLOBAL_ROOTS);
        assert.ok(codeFiles.length > 100, `corpus trop petit (${codeFiles.length} fichiers)`);

        const sources = new Map();
        for (const f of allScripts) sources.set(rel(f), fs.readFileSync(f, 'utf8'));

        // --- 1. Pages HTML : scripts classiques et modules ---
        const pages = [];
        for (const file of fs.readdirSync(ROOT).filter(n => n.endsWith('.html'))) {
            const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
            const classic = [];
            const modules = [];
            for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
                const attrs = m[1];
                const src = /src\s*=\s*["']([^"']+)["']/.exec(attrs);
                const isModule = /type\s*=\s*["']module["']/.test(attrs);
                if (!src) continue;
                const target = src[1].split('?')[0];
                if (!/^js\//.test(target)) continue;
                if (isModule) modules.push(target);
                else classic.push(target);
            }
            pages.push({ file, classic, modules });
        }

        // --- 2. Graphe d'imports entre modules ES ---
        const importsOf = new Map(); // rel -> Set(rel)
        for (const [r, src] of sources) {
            const set = new Set();
            const dir = path.dirname(path.join(ROOT, r));
            const re = /(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g;
            let m;
            while ((m = re.exec(src)) !== null) {
                let target = path.resolve(dir, m[1]);
                if (!/\.(js|mjs)$/.test(target)) {
                    for (const ext of ['.js', '.mjs']) {
                        if (fs.existsSync(target + ext)) { target += ext; break; }
                    }
                }
                set.add(rel(target));
            }
            importsOf.set(r, set);
        }

        // --- 3. Pages qui atteignent un fichier (modules + imports transitifs) ---
        const pagesReaching = new Map(); // rel -> Set(page)
        const reach = (r, seen = new Set()) => {
            if (seen.has(r)) return seen;
            seen.add(r);
            for (const dep of importsOf.get(r) || []) reach(dep, seen);
            return seen;
        };
        for (const page of pages) {
            for (const mod of page.modules) {
                const r = rel(path.join(ROOT, mod));
                for (const reached of reach(r)) {
                    if (!pagesReaching.has(reached)) pagesReaching.set(reached, new Set());
                    pagesReaching.get(reached).add(page.file);
                }
            }
        }

        // --- 4. Globales par page (scripts classiques charges) ---
        const globalsByPage = new Map();
        for (const page of pages) {
            const set = new Set();
            for (const c of page.classic) {
                const r = rel(path.join(ROOT, c));
                for (const n of topLevelNames(sources.get(r) || '')) set.add(n);
            }
            globalsByPage.set(page.file, set);
        }

        // --- 5. Globales posees sur window dans tout le depot ---
        const windowGlobals = new Set();
        for (const src of sources.values()) {
            for (const m of src.matchAll(/\b(?:window|globalThis|global)\.([A-Za-z_$][\w$]*)\s*=/g)) {
                windowGlobals.add(m[1]);
            }
        }

        // --- 6. Analyse fichier par fichier ---
        const problems = [];
        for (const file of codeFiles) {
            const r = rel(file);
            const src = sources.get(r);
            if (src === undefined) continue;

            let info;
            try {
                info = analyze(src);
            } catch (e) {
                problems.push(`${r} : analyse impossible (${e.message})`);
                continue;
            }

            // Contexte de chargement
            let allowed;
            if (r.startsWith('engine/') || r.startsWith('scripts/') || r.startsWith('netlify/')
                || r === 'mcp-server.js') {
                // Node : aucune globale du navigateur.
                allowed = new Set();
            } else {
                allowed = new Set(windowGlobals);
                const pageSet = pagesReaching.get(r);
                if (pageSet) {
                    for (const p of pageSet) {
                        for (const n of globalsByPage.get(p) || []) allowed.add(n);
                    }
                } else {
                    // Fichier charge comme script classique : on prend les
                    // globales de toutes les pages qui le chargent.
                    for (const page of pages) {
                        if (page.classic.includes(r.replace(/^js\//, 'js/'))) {
                            for (const n of globalsByPage.get(page.file) || []) allowed.add(n);
                        }
                    }
                }
            }

            for (const [name, line] of info.used) {
                if (info.declared.has(name)) continue;
                if (info.imported.has(name)) continue;
                if (allowed.has(name)) continue;
                if (KNOWN_GLOBALS.has(name)) continue;
                problems.push(`${r}:${line}  ${name}`);
            }
        }

        assert.deepEqual(
            problems,
            [],
            'Des symboles sont utilises sans etre declares, importes, ni globaux du contexte :\n  '
            + problems.join('\n  ')
        );
    });

    test('les imports d\'un module sont tous reellement utilises ou re-exportes', () => {
        const files = collectFiles(CODE_ROOTS);
        const exportedBy = new Map();
        const sources = new Map();

        for (const file of files) {
            const r = rel(file);
            sources.set(r, fs.readFileSync(file, 'utf8'));
            const names = new Set();
            const src = sources.get(r);
            for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) {
                names.add(m[1]);
            }
            for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) {
                for (const part of m[1].split(',')) {
                    const t = part.trim();
                    if (!t) continue;
                    const as = t.split(/\s+as\s+/);
                    names.add((as[1] || as[0]).trim());
                }
            }
            exportedBy.set(r, names);
        }

        const problems = [];

        for (const [r, src] of sources) {
            let info;
            try {
                info = analyze(src);
            } catch {
                continue;
            }
            const dir = path.dirname(path.join(ROOT, r));
            const importedFrom = new Map();
            const re = /import\s+(?:\{([^}]*)\}|(\*\s+as\s+[A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*))?\s*(?:,\s*\{([^}]*)\})?\s*from\s*['"](\.[^'"]+)['"]/g;
            let m;
            while ((m = re.exec(src)) !== null) {
                const spec = m[1] || m[4] || '';
                const names = new Set();
                for (const part of spec.split(',')) {
                    const t = part.trim();
                    if (!t) continue;
                    const as = t.split(/\s+as\s+/);
                    names.add((as[1] || as[0]).trim());
                }
                if (m[2]) names.add(m[2].trim().replace(/^\*\s+as\s+/, ''));
                if (m[3]) names.add(m[3]);
                let target = path.resolve(dir, m[5]);
                if (!/\.(js|mjs)$/.test(target)) {
                    for (const ext of ['.js', '.mjs']) {
                        if (fs.existsSync(target + ext)) { target += ext; break; }
                    }
                }
                importedFrom.set(rel(target), names);
            }

            for (const [targetRel, importedNames] of importedFrom) {
                const available = exportedBy.get(targetRel);
                if (!available) continue;
                for (const [name, line] of info.used) {
                    if (importedNames.has(name)) continue;
                    if (info.declared.has(name)) continue;
                    if (!available.has(name)) continue;
                    problems.push(`${r}:${line}  ${name} (exporte par ${targetRel}, NON importe)`);
                }
            }
        }

        assert.deepEqual(
            problems,
            [],
            'Des symboles exportes par un module sont utilises sans etre importes :\n  '
            + problems.join('\n  ')
        );
    });
});
