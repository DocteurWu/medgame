/**
 * test/verify-ui-gds.mjs — Test UI autonome en boucle fermée via Chrome DevTools Protocol
 * Valide le bon fonctionnement de skills-gds.html et skills.html sans intervention humaine.
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9225; // port de debug distinct
const SERVER_PORT = 8889;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 1. Serveur statique de test
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg'
};

const staticServer = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/') reqPath = '/skills-gds.html';
    const filePath = path.join(process.cwd(), reqPath.replace(/^\//, ''));
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
});

async function getPageDebuggerWsUrl() {
    for (let i = 0; i < 30; i++) {
        try {
            const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
            if (res.ok) {
                const data = await res.json();
                const page = data.find(t => t.type === 'page') || data[0];
                if (page && page.webSocketDebuggerUrl) {
                    return page.webSocketDebuggerUrl;
                }
            }
        } catch (e) {}
        await sleep(300);
    }
    throw new Error(`Impossible de se connecter à la cible page Chrome ${PORT}`);
}

async function runUITests() {
    console.log('[Test UI GDS] Démarrage du serveur statique...');
    await new Promise(resolve => staticServer.listen(SERVER_PORT, '127.0.0.1', resolve));

    const userDataDir = path.join(process.cwd(), '.tmp-chrome-gds-' + Date.now());
    console.log('[Test UI GDS] Lancement de Chrome headless...');
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

        await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
        });

        let msgId = 1;
        const pendingCallbacks = new Map();
        const consoleErrors = [];

        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.method === 'Runtime.consoleAPICalled') {
                if (msg.params.type === 'error') {
                    const txt = msg.params.args.map(a => a.value || a.description || '').join(' ');
                    consoleErrors.push(txt);
                }
            }
            if (msg.id && pendingCallbacks.has(msg.id)) {
                const cb = pendingCallbacks.get(msg.id);
                pendingCallbacks.delete(msg.id);
                cb(msg);
            }
        });

        function sendCommand(method, params = {}) {
            return new Promise((resolve, reject) => {
                const id = msgId++;
                const payload = JSON.stringify({ id, method, params });
                pendingCallbacks.set(id, (res) => {
                    if (res.error) reject(new Error(res.error.message));
                    else resolve(res.result);
                });
                ws.send(payload);
            });
        }

        async function evaluate(expression) {
            const res = await sendCommand('Runtime.evaluate', {
                expression,
                returnByValue: true,
                awaitPromise: true
            });
            if (res && res.exceptionDetails) {
                throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
            }
            return res ? (res.result ? res.result.value : undefined) : undefined;
        }

        await sendCommand('Runtime.enable');
        await sendCommand('Page.enable');

        // Test 1 : Navigation vers skills-gds.html
        console.log('[Test UI GDS] Navigation vers skills-gds.html...');
        await sendCommand('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/skills-gds.html` });
        await sleep(1500);

        const title = await evaluate('document.title');
        console.log(`[Test UI GDS] Titre de la page : "${title}"`);
        if (!title.includes('Gaz du Sang')) {
            throw new Error(`Titre inattendu : ${title}`);
        }

        // Test 2 : Présence des composants principaux
        const rowCount = await evaluate('document.querySelectorAll(".gds-row").length');
        console.log(`[Test UI GDS] Nombre de lignes de paramètres : ${rowCount}`);
        if (rowCount !== 11) {
            throw new Error(`Attendu 11 lignes de paramètres, obtenu: ${rowCount}`);
        }

        const canvasReady = await evaluate('!!document.getElementById("gds-canvas") && !!window.GDS && !!window.GDSDiagram');
        if (!canvasReady) {
            throw new Error('Canvas ou modules GDS/GDSDiagram non initialisés');
        }
        console.log('[Test UI GDS] Canvas et modules GDS correctement chargés.');

        // Test 3 : Manipulation de curseur et raisonnement dynamique
        console.log('[Test UI GDS] Test de manipulation du curseur pH -> 7.15...');
        await evaluate(`(() => {
            const s = document.getElementById('slider-pH');
            s.value = '7.15';
            s.dispatchEvent(new Event('input', { bubbles: true }));
        })()`);
        await sleep(300);

        const step1Text = await evaluate('document.getElementById("step-1-desc").textContent');
        console.log(`[Test UI GDS] Raisonnement Étape 1 : "${step1Text}"`);
        if (!step1Text.includes('Acidémie')) {
            throw new Error(`Le raisonnement ne s'est pas mis à jour en acidémie : ${step1Text}`);
        }

        // Test 4 : Clic sur un preset (Acidocétose diabétique)
        console.log('[Test UI GDS] Test du preset "Acidocétose diabétique"...');
        await evaluate(`(() => {
            const btn = document.querySelector('[data-preset="dka"]');
            btn.click();
        })()`);
        await sleep(300);

        const dkaPH = await evaluate('document.getElementById("num-pH").value');
        const dkaTA = await evaluate('document.getElementById("index-ta-val").textContent');
        console.log(`[Test UI GDS] Preset DKA -> pH = ${dkaPH}, TA = ${dkaTA}`);
        if (parseFloat(dkaPH) > 7.30) {
            throw new Error(`Le pH de l'acidocétose devrait être acide (< 7.30), obtenu: ${dkaPH}`);
        }

        // Test 5 : Commutation en Mode Cas Cliniques EDN / Quiz
        console.log('[Test UI GDS] Test de commutation en Mode Cas EDN & Quiz...');
        await evaluate(`document.getElementById("tab-mode-quiz").click()`);
        await sleep(500);

        const quizActive = await evaluate('document.getElementById("sec-quiz-mode").classList.contains("active")');
        const questionCount = await evaluate('document.querySelectorAll(".quiz-question-box").length');
        console.log(`[Test UI GDS] Mode Quiz actif: ${quizActive}, Nombre de questions: ${questionCount}`);
        if (!quizActive || questionCount < 3) {
            throw new Error(`Échec du passage en mode quiz ou questions manquantes (trouvé: ${questionCount})`);
        }

        // Test 6 : Validation du quiz et feedback
        console.log('[Test UI GDS] Validation du quiz...');
        await evaluate(`(() => {
            document.querySelectorAll('.quiz-question-box').forEach(q => {
                const radio = q.querySelector('input[type="radio"]');
                if (radio) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
            document.getElementById('btn-validate-quiz').click();
        })()`);
        await sleep(500);

        const diagBoxVisible = await evaluate('document.getElementById("quiz-diagnosis-box").style.display !== "none"');
        console.log(`[Test UI GDS] Synthèse et correction affichées : ${diagBoxVisible}`);
        if (!diagBoxVisible) {
            throw new Error('La boîte de synthèse diagnostique ne s\'est pas affichée après validation.');
        }

        // Test 7 : Vérification de la carte Gaz du Sang dans skills.html
        console.log('[Test UI GDS] Navigation vers skills.html pour vérifier l\'intégration...');
        await sendCommand('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/skills.html` });
        await sleep(1000);

        const gdsCardPresent = await evaluate('!!document.querySelector(".skill-card.gds")');
        const gdsLinkTarget = await evaluate('document.querySelector(".skill-card.gds .btn-launch")?.getAttribute("href")');
        console.log(`[Test UI GDS] Carte GDS présente sur skills.html : ${gdsCardPresent}, Lien: ${gdsLinkTarget}`);
        if (!gdsCardPresent || gdsLinkTarget !== 'skills-gds.html') {
            throw new Error(`Intégration skills.html incorrecte : carte=${gdsCardPresent}, lien=${gdsLinkTarget}`);
        }

        // Vérification finale : Zéro erreur console
        if (consoleErrors.length > 0) {
            throw new Error(`Erreurs console détectées dans le navigateur : ${JSON.stringify(consoleErrors)}`);
        }

        console.log('[Test UI GDS] SUCCÈS TOTAL — Tous les tests UI et navigateurs sont validés !');
    } finally {
        if (ws) {
            try { ws.close(); } catch (e) {}
        }
        chromeProc.kill();
        staticServer.close();
        try {
            fs.rmSync(userDataDir, { recursive: true, force: true });
        } catch (e) {}
    }
}

runUITests().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('[Test UI GDS] ÉCHEC :', err);
    process.exit(1);
});
