/**
 * test/verify-ui-game-loading.mjs — Chargement paresseux des cas (CDP)
 *
 * Vérifie l'observable réseau : avec 6 cas sélectionnés, `game.html` ne doit
 * PAS télécharger les 6 corps de cas à l'entrée. Le cas courant est chargé, le
 * suivant éventuellement préchargé — mais pas la sélection entière.
 *
 * On lit les requêtes via le domaine `Network` de Chrome et on ne compte que
 * les fichiers `data/*.json` qui sont de VRAIS cas (on exclut index, méta,
 * médicaments).
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';
import { nettoyerProfil, balayerProfilsAbandonnes } from './helpers/chrome-profile.mjs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9234;
const SERVER_PORT = 8897;

const CASE_FILES = [
    'cardio_douleur_thoracique_mme_bennet.json',
    'cardio_claudication_intermittente_m_lambert.json',
    'cardio_hypertension_arterielle_m_wickham.json',
    'cardio_jambes_lourdes_mme_dubois.json',
    'cardio_malaise_effort_m_bingley.json',
    'cardio_perte_de_connaissance_m_darcy.json'
];

const NON_CASE_JSON = new Set(['case-index.json', 'case-meta.json', 'drugs.json']);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.glb': 'model/gltf-binary',
    '.woff2': 'font/woff2'
};

const staticServer = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/') reqPath = '/game.html';
    const filePath = path.join(process.cwd(), reqPath.replace(/^\//, ''));
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
});

async function getPageDebuggerWsUrl() {
    for (let i = 0; i < 40; i++) {
        try {
            const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
            if (res.ok) {
                const data = await res.json();
                const page = data.find(t => t.type === 'page') || data[0];
                if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
            }
        } catch (e) {}
        await sleep(300);
    }
    throw new Error(`Impossible de se connecter à la cible page Chrome ${PORT}`);
}

async function run() {
    console.log('[Test UI Charge] Démarrage du serveur statique...');
    await new Promise(resolve => staticServer.listen(SERVER_PORT, '127.0.0.1', resolve));

        // Balaye les profils Chrome laissés par une exécution morte (Ctrl+C,
    // crash, timeout) : chacun pèse 12-15 Mo, et leur accumulation ralentit
    // le démarrage de Chrome au point de faire échouer la connexion au port
    // de debug. C'est ce qui rendait ce test FLAKY.
    balayerProfilsAbandonnes(['.tmp-chrome-charge-']);
const userDataDir = path.join(process.cwd(), '.tmp-chrome-charge-' + Date.now());
    console.log('[Test UI Charge] Lancement de Chrome headless...');
    const chromeProc = spawn(CHROME_PATH, [
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${userDataDir}`,
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1280,900',
        'about:blank'
    ], { stdio: 'ignore' });

    let ws = null;
    try {
        const wsUrl = await getPageDebuggerWsUrl();
        ws = new WebSocket(wsUrl);
        await new Promise((resolve, reject) => { ws.on('open', resolve); ws.on('error', reject); });

        let msgId = 1;
        const pending = new Map();
        const caseRequests = [];
        const consoleErrors = [];

        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.method === 'Network.requestWillBeSent') {
                const url = msg.params?.request?.url || '';
                const m = url.match(/\/data\/([^/?]+\.json)$/);
                if (m && !NON_CASE_JSON.has(m[1])) caseRequests.push(m[1]);
            }
            if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
                consoleErrors.push(msg.params.args.map(a => a.value || a.description || '').join(' '));
            }
            if (msg.id && pending.has(msg.id)) {
                const cb = pending.get(msg.id);
                pending.delete(msg.id);
                cb(msg);
            }
        });

        function sendCommand(method, params = {}) {
            return new Promise((resolve, reject) => {
                const id = msgId++;
                pending.set(id, (res) => res.error ? reject(new Error(res.error.message)) : resolve(res.result));
                ws.send(JSON.stringify({ id, method, params }));
            });
        }

        async function evaluate(expression) {
            const res = await sendCommand('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
            if (res && res.exceptionDetails) throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
            return res?.result?.value;
        }

        async function waitFor(expr, timeout = 30000) {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                if (await evaluate(expr)) return true;
                await sleep(250);
            }
            return false;
        }

        await sendCommand('Runtime.enable');
        await sendCommand('Page.enable');
        await sendCommand('Network.enable');

        // Sélection de 6 cas + mode texte (pas de 3D) avant tout script de page.
        await sendCommand('Page.addScriptToEvaluateOnNewDocument', {
            source: `try {
                localStorage.setItem('selectedCaseFiles', ${JSON.stringify(JSON.stringify(CASE_FILES))});
                localStorage.removeItem('selectedCaseFile');
                localStorage.setItem('medgame_text_mode_default', 'true');
                sessionStorage.removeItem('use3D');
            } catch (e) {}`
        });

        console.log('[Test UI Charge] Navigation vers game.html (6 cas sélectionnés)...');
        await sendCommand('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/game.html?render=2d` });

        const ready = await waitFor('!!(window.gameState && window.gameState.cases && window.gameState.cases.length >= 6 && window.gameState.currentCase)', 40000);
        if (!ready) throw new Error('Le jeu n\'a pas chargé ses cas dans le délai imparti');

        // Laisser passer un éventuel préchargement (requestIdleCallback, timeout 4 s).
        await sleep(6000);

        const total = await evaluate('window.gameState.cases.length');
        const loadedNow = await evaluate('window.gameState.cases.filter(c => !!c.patient).length');
        console.log(`[Test UI Charge] Cas en session : ${total}, corps chargés : ${loadedNow}`);
        console.log(`[Test UI Charge] Requêtes de corps de cas au démarrage : ${JSON.stringify(caseRequests)}`);

        if (total < 6) throw new Error(`Attendu 6 cas en session, obtenu ${total}`);
        if (caseRequests.length === 0) throw new Error('Aucun cas chargé au démarrage');
        if (caseRequests.length >= total) {
            throw new Error(`Chargement paresseux rompu : ${caseRequests.length} corps téléchargés pour ${total} cas`);
        }
        // Le préchargement ne doit viser que le cas suivant, pas toute la sélection.
        if (caseRequests.length > 2) {
            throw new Error(`Trop de corps téléchargés au démarrage (${caseRequests.length}) — attendu ≤ 2 (courant + suivant)`);
        }
        if (loadedNow > 2) {
            throw new Error(`Trop de corps résolus au démarrage (${loadedNow}) — attendu ≤ 2`);
        }
        const firstId = await evaluate('window.gameState.currentCase.id');
        console.log(`[Test UI Charge] Cas courant : ${firstId}`);

        // Passer au cas suivant : il doit se charger (déjà préchargé ou fetch à la demande).
        console.log('[Test UI Charge] Passage au cas suivant...');
        await evaluate('window.loadNextCase()');
        const secondReady = await waitFor('window.gameState.currentCaseIndex === 1 && !!window.gameState.currentCase && window.gameState.currentCase.id !== ' + JSON.stringify(firstId), 15000);
        if (!secondReady) throw new Error('Le cas suivant ne s\'est pas chargé');

        const secondId = await evaluate('window.gameState.currentCase.id');
        console.log(`[Test UI Charge] Cas 2 : ${secondId}`);
        console.log(`[Test UI Charge] Requêtes de corps de cas cumulées : ${JSON.stringify(caseRequests)}`);

        if (!caseRequests.includes(`${secondId}.json`)) {
            throw new Error(`Le corps du cas 2 (${secondId}.json) n'a jamais été téléchargé`);
        }
        // Toujours pas toute la sélection.
        if (caseRequests.length >= total + 1) {
            throw new Error(`Trop de corps téléchargés après 2 cas (${caseRequests.length})`);
        }

        if (consoleErrors.length > 0) {
            throw new Error(`Erreurs console détectées : ${JSON.stringify(consoleErrors.slice(0, 5))}`);
        }

        console.log('[Test UI Charge] SUCCÈS — le chargement paresseux des cas est effectif.');
    } finally {
        if (ws) { try { ws.close(); } catch (e) {} }
        staticServer.close();
        // Voir test/helpers/chrome-profile.mjs : `proc.kill()` seul laisse
        // les renderers Chrome vivants, qui verrouillent le profil. Le
        // `rmSync` échouait alors en silence et laissait 15 Mo par exécution.
        await nettoyerProfil(chromeProc, userDataDir, '.tmp-chrome-charge-');
    }
}

run().then(() => process.exit(0)).catch(err => {
    console.error('[Test UI Charge] ÉCHEC :', err);
    process.exit(1);
});
