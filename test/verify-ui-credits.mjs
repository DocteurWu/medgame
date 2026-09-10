/**
 * test/verify-ui-credits.mjs — Test UI autonome en boucle fermee via Chrome DevTools Protocol
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;
const SERVER_PORT = 8888;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 1. Mini serveur statique autonome pour le test
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.webp': 'image/webp'
};

const staticServer = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/') reqPath = '/index.html';
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

async function getDebuggerWsUrl() {
    for (let i = 0; i < 30; i++) {
        try {
            const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
            if (res.ok) {
                const data = await res.json();
                return data.webSocketDebuggerUrl;
            }
        } catch (e) {}
        await sleep(300);
    }
    throw new Error("Impossible de se connecter au port de debug Chrome 9222");
}

class CDPClient {
    constructor(wsUrl) {
        this.ws = new WebSocket(wsUrl);
        this.id = 1;
        this.callbacks = new Map();
        this.ws.on('message', (msg) => {
            const data = JSON.parse(msg.toString());
            if (data.id && this.callbacks.has(data.id)) {
                const { resolve, reject } = this.callbacks.get(data.id);
                this.callbacks.delete(data.id);
                if (data.error) reject(data.error);
                else resolve(data.result);
            }
        });
    }

    async ready() {
        if (this.ws.readyState === WebSocket.OPEN) return;
        return new Promise((resolve) => this.ws.on('open', resolve));
    }

    send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = this.id++;
            this.callbacks.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    async eval(expression) {
        const res = await this.send('Runtime.evaluate', {
            expression,
            returnByValue: true
        });
        if (res.exceptionDetails) {
            throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
        }
        return res.result ? res.result.value : undefined;
    }

    close() {
        this.ws.close();
    }
}

async function run() {
    console.log('[UI Test] Demarrage du serveur HTTP sur port 8888...');
    await new Promise((resolve) => staticServer.listen(SERVER_PORT, '127.0.0.1', resolve));

    console.log('[UI Test] Demarrage de Chrome headless...');
    const chrome = spawn(CHROME_PATH, [
        '--headless=new',
        `--remote-debugging-port=${PORT}`,
        '--disable-gpu',
        '--no-sandbox',
        '--window-size=1280,900',
        'about:blank'
    ]);

    try {
        await sleep(1000);
        const browserWsUrl = await getDebuggerWsUrl();
        console.log('[UI Test] Chrome pret. Connexion WebSocket...');
        
        const targetsRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
        const targets = await targetsRes.json();
        const pageTarget = targets.find(t => t.type === 'page') || targets[0];
        
        const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
        await client.ready();
        await client.send('Page.enable');
        await client.send('Runtime.enable');

        // 1. Navigation credits.html
        console.log('[UI Test] Navigation vers http://localhost:8888/credits.html...');
        await client.send('Page.navigate', { url: `http://localhost:${SERVER_PORT}/credits.html` });
        await sleep(1000);

        // Verifier le titre
        const title = await client.eval('document.title');
        console.log(`[UI Test] Titre de la page: "${title}"`);
        if (!title.includes('Crédits')) throw new Error('Titre incorrect pour credits.html');

        // Verifier les donnees createur
        const creatorName = await client.eval('document.querySelector(".creator-name")?.textContent');
        const creatorRole = await client.eval('document.querySelector(".creator-role-tag")?.textContent');
        const creatorCurriculum = await client.eval('document.querySelector(".creator-curriculum")?.textContent');
        console.log(`[UI Test] Createur detecte: ${creatorName} (${creatorRole})`);
        console.log(`[UI Test] Curriculum: ${creatorCurriculum}`);

        if (creatorName !== 'Louaï Hamlat') throw new Error(`Nom createur incorrect: ${creatorName}`);
        if (!creatorCurriculum.includes('médecine') && !creatorCurriculum.includes('medecine')) throw new Error('Mention médecine manquante');
        if (!creatorCurriculum.includes('Mines Paris')) throw new Error('Mention Mines Paris manquante');

        // Verifier contributeurs
        const contribNames = await client.eval('Array.from(document.querySelectorAll(".contrib-name")).map(el => el.textContent)');
        console.log(`[UI Test] Contributeurs detectes: ${contribNames.join(', ')}`);
        if (!contribNames.includes('La Team') || !contribNames.includes('Alexandra Sedes') || !contribNames.includes('Juliette Constant')) {
            throw new Error('Contributeurs obligatoires manquants');
        }

        // Verifier section contact
        const contactEmail = await client.eval('document.querySelector("#contact-container .contact-email-badge")?.textContent?.trim()');
        console.log(`[UI Test] Contact email: ${contactEmail}`);
        if (!contactEmail || !contactEmail.includes('hamlat.louai@gmail.com')) {
            throw new Error('Email de contact absent ou invalide');
        }

        // Verifier mention legale (petit, gris, italique)
        const legalText = await client.eval('document.querySelector(".legal-tiny-italic")?.textContent?.trim()');
        console.log(`[UI Test] Mention legale: ${legalText}`);
        if (!legalText.includes('GPL-3.0') || !legalText.includes('hamlat.louai@gmail.com')) {
            throw new Error('Mention legale GPL ou email manquante');
        }

        // 2. Test du generique defilant
        console.log('[UI Test] Test de declenchement du generique defilant...');
        await client.eval('document.getElementById("btn-launch-roll").click()');
        await sleep(400);

        const overlayActive = await client.eval('document.getElementById("credits-roll-overlay").classList.contains("active")');
        const overlayAnimating = await client.eval('document.getElementById("credits-roll-overlay").classList.contains("animating")');
        console.log(`[UI Test] Generique actif: ${overlayActive}, animation: ${overlayAnimating}`);
        if (!overlayActive) throw new Error('Le generique ne s est pas active');

        // Test Pause
        console.log('[UI Test] Test du bouton Pause...');
        await client.eval('document.getElementById("btn-pause-roll").click()');
        await sleep(200);
        const overlayPaused = await client.eval('document.getElementById("credits-roll-overlay").classList.contains("paused")');
        if (!overlayPaused) throw new Error('La pause du generique n a pas fonctionne');

        // Reprise
        await client.eval('document.getElementById("btn-pause-roll").click()');
        await sleep(150);

        // Test Fermeture par Echap
        console.log('[UI Test] Test de fermeture par touche Echap...');
        await client.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await sleep(300);

        const overlayClosed = await client.eval('!document.getElementById("credits-roll-overlay").classList.contains("active")');
        console.log(`[UI Test] Generique ferme apres Echap: ${overlayClosed}`);
        if (!overlayClosed) throw new Error('La fermeture par Echap a echoue');

        // 3. Test responsive mobile (375x667)
        console.log('[UI Test] Test responsive mobile 375x667...');
        await client.send('Emulation.setDeviceMetricsOverride', {
            width: 375,
            height: 667,
            deviceScaleFactor: 2,
            mobile: true
        });
        await sleep(300);
        const hasOverflow = await client.eval('document.documentElement.scrollWidth > window.innerWidth');
        console.log(`[UI Test] Debordement horizontal mobile: ${hasOverflow ? 'OUI (ERREUR)' : 'NON (PARFAIT)'}`);
        if (hasOverflow) throw new Error('Debordement horizontal detecte en vue mobile');

        await client.send('Emulation.clearDeviceMetricsOverride');

        // 4. Test presence bouton Credits sur index.html
        console.log('[UI Test] Navigation vers index.html pour verifier le menu d accueil...');
        await client.send('Page.navigate', { url: `http://localhost:${SERVER_PORT}/index.html` });
        await sleep(1000);

        const indexFooterLink = await client.eval('!!document.querySelector("a[href=\'credits.html\']")');
        console.log(`[UI Test] Lien footer discret sur index.html: ${indexFooterLink}`);
        if (!indexFooterLink) throw new Error('Lien footer discret absent sur index.html');

        // 5. Test presence lien footer sur game.html
        console.log('[UI Test] Navigation vers game.html pour verifier le footer sidebar...');
        await client.send('Page.navigate', { url: `http://localhost:${SERVER_PORT}/game.html` });
        await sleep(1000);
        const gameFooterLink = await client.eval('!!document.querySelector(".sidebar-footer a[href=\'credits.html\']")');
        console.log(`[UI Test] Lien footer dans sidebar game.html: ${gameFooterLink}`);
        if (!gameFooterLink) throw new Error('Lien footer absent dans .sidebar-footer de game.html');

        // 6. Test presence lien footer sur tutorial.html
        console.log('[UI Test] Navigation vers tutorial.html pour verifier footer-actions...');
        await client.send('Page.navigate', { url: `http://localhost:${SERVER_PORT}/tutorial.html` });
        await sleep(800);
        const tutorialLink = await client.eval('!!document.querySelector(".footer-actions a[href=\'credits.html\']")');
        console.log(`[UI Test] Lien footer sur tutorial.html: ${tutorialLink}`);
        if (!tutorialLink) throw new Error('Lien footer absent sur tutorial.html');

        client.close();
        console.log('\n========================================');
        console.log('SUCCESS: TOUS LES TESTS UI SONT VALIDES !');
        console.log('========================================\n');
    } finally {
        try { chrome.kill(); } catch (e) {}
        try { staticServer.close(); } catch (e) {}
        process.exit(0);
    }
}

run().catch(err => {
    console.error('\nERREUR TEST UI:', err);
    try { staticServer.close(); } catch (e) {}
    process.exit(1);
});
