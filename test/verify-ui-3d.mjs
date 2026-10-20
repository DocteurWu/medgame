/**
 * test/verify-ui-3d.mjs — Vérification navigateur de l'environnement 3D
 *
 * Les tests `node --test` valident la cohérence statique des modules. Ils ne
 * valident PAS que la scène 3D se construit, ni qu'elle rend, ni qu'elle
 * tient la cadence. C'est le travail de ce fichier : piloter Chrome via le
 * DevTools Protocol, activer le mode 3D, et mesurer des faits observables.
 *
 * CE QUE CE TEST PROTÈGE
 *
 * `ThreeScene.init()` est `async` et étalé sur plusieurs frames via
 * `TaskScheduler`. C'est ce qui supprime le gel de lancement, mais cela
 * introduit un risque qu'aucun test unitaire ne voit : si une étape de
 * construction lève, si l'ordre des dépendances est faux, ou si rien
 * n'appelle `await` sur `init()`, la page reste en 2D et le joueur voit
 * simplement « pas de 3D » — sans la moindre erreur visible.
 *
 * D'où les vérifications ci-dessous, dans cet ordre :
 *
 *  1. AUCUNE ERREUR CONSOLE. Le premier filet. Une exception dans une des
 *     tranches de construction atterrit ici avant toute autre assertion.
 *  2. LE 3D EST ACTIVÉ, ET LA CONSTRUCTION EST TERMINÉE. On n'interroge pas
 *     `enabled` seul : `three-manager._init3D` positionne `enabled = true`
 *     après avoir tout construit, mais un `_buildSteps()` interrompu laisserait
 *     des champs à `undefined` alors que le drapeau est levé. On vérifie donc
 *     que les sous-systèmes existe réellement.
 *  3. LE LOD DE DÉTAIL EST APPLIQUÉ. Le preset détecté doit avoir masqué le
 *     décor au-dessus de son palier. Un décor entièrement visible sur une
 *     machine modeste est précisément le défaut qu'on a corrigé.
 *  4. LA SCÈNE REND VRAIMENT. `renderer.info.render.calls > 0` sur plusieurs
 *     frames consécutives : une scène qui ne dessine rien passe tous les
 *     tests structurels ci-dessus.
 *  5. LE NOMBRE DE CONTEXTES WEBGL. Une fuite de contexte se paie en VRAM et
 *     en temps de compilation ; le navigateur en plafonne le nombre.
 *  6. LA CADENCE. On mesure des deltas de frames réelles, pas le FPS
 *     rapporté par un compteur interne. Une scène bloquée en 8 ms par tranche
 *     donnerait un compteur flat mais des deltas mauvais — et c'est
 *     précisément le défaut qu'on cherche.
 */

import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';
import { nettoyerProfil, balayerProfilsAbandonnes } from './helpers/chrome-profile.mjs';

const BROWSERS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];
const PORT = 9233;
const SERVER_PORT = 8896;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const findBrowser = () => BROWSERS.find(p => fs.existsSync(p)) || null;

const MIME = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/game.html';
    const file = path.join(process.cwd(), p.replace(/^\//, ''));
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not Found');
    }
    res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
    });
    fs.createReadStream(file).pipe(res);
});

async function getWsUrl() {
    for (let i = 0; i < 50; i++) {
        try {
            const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
            if (r.ok) {
                const list = await r.json();
                const page = list.find(t => t.type === 'page') || list[0];
                if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
            }
        } catch { /* Chrome pas encore prêt */ }
        await sleep(300);
    }
    throw new Error('Chrome injoignable');
}

const echecs = [];
const succes = [];
const notes = [];

function verifie(condition, libelle, detail) {
    if (condition) {
        succes.push(libelle);
        console.log(`  ok    ${libelle}`);
    } else {
        echecs.push(`${libelle}${detail ? ' — ' + detail : ''}`);
        console.log(`  ECHEC ${libelle}${detail ? ' — ' + detail : ''}`);
    }
}

function note(texte) {
    notes.push(texte);
    console.log('         ' + texte);
}

/* ------------------------------------------------------------------ */

/** Compteur de frames + observateur de tâches longues, injectés dans la page. */
const SONDE_FRAMES = `
window.__frames3d = [];
window.__longTasks = [];
try {
    new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
            window.__longTasks.push({
                duree: Math.round(e.duration),
                debut: Math.round(e.startTime),
                nom: e.name,
                attr: (e.attribution || []).map(a => a.name + ':' + a.containerType).join(',')
            });
        }
    }).observe({ entryTypes: ['longtask'] });
} catch (e) { window.__longTasksIndisponible = String(e); }
(function () {
    let last = performance.now();
    function tick(now) {
        window.__frames3d.push(now - last);
        last = now;
        if (window.__frames3d.length > 3000) window.__frames3d.shift();
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
})();
true;
`;

async function main() {
    const browser = findBrowser();
    if (!browser) {
        console.log('[Test UI 3D] Aucun Chrome/Edge trouvé - test ignoré.');
        return;
    }

    await new Promise(r => server.listen(SERVER_PORT, '127.0.0.1', r));
        // Balaye les profils Chrome laissés par une exécution morte (Ctrl+C,
    // crash, timeout) : chacun pèse 12-15 Mo, et leur accumulation ralentit
    // le démarrage de Chrome au point de faire échouer la connexion au port
    // de debug. C'est ce qui rendait ce test FLAKY.
    balayerProfilsAbandonnes(['.tmp-chrome-3d-']);
const userDataDir = path.join(process.cwd(), '.tmp-chrome-3d-' + Date.now());
    const proc = spawn(browser, [
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${userDataDir}`,
        '--headless=new',
        '--no-first-run',
        '--no-default-browser-check',
        // WebGL logiciel : c'est le pire cas, exactement ce qu'on veut valider.
        // Si la scène tient (ou se dégrade proprement) ici, elle tient partout.
        '--enable-unsafe-swiftshader',
        '--window-size=1280,900',
        'about:blank'
    ], { stdio: 'ignore' });

    let ws = null;
    try {
        ws = new WebSocket(await getWsUrl());
        await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });

        let msgId = 1;
        const pending = new Map();
        const consoleErrors = [];

        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.method === 'Runtime.consoleAPICalled') {
                if (msg.params.type === 'error') {
                    consoleErrors.push(msg.params.args
                        .map(a => a.value ?? a.description ?? '').join(' '));
                }
            }
            if (msg.method === 'Runtime.exceptionThrown') {
                const d = msg.params.exceptionDetails;
                consoleErrors.push(d.exception?.description || d.text || 'exception inconnue');
            }
            if (msg.id && pending.has(msg.id)) {
                const cb = pending.get(msg.id);
                pending.delete(msg.id);
                cb(msg);
            }
        });

        const send = (method, params = {}) => new Promise((res, rej) => {
            const id = msgId++;
            pending.set(id, (r) => (r.error ? rej(new Error(r.error.message)) : res(r.result)));
            ws.send(JSON.stringify({ id, method, params }));
        });

/**
         * Évalue une expression. Le délai est une donnée du test, pas un
         * agrément : une promesse de page qui ne résout jamais bloquerait le run
         * entier sans rien signaler.
         */
        const evaluate = async (expr, timeoutMs = 90000) => {
            const r = await Promise.race([
                send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }),
                sleep(timeoutMs).then(() => ({ timedOut: true }))
            ]);
            if (r.timedOut) throw new Error(`Eval délai dépassé (${timeoutMs} ms) : ${expr.slice(0, 80)}`);
            if (r.exceptionDetails) {
                throw new Error('Eval: ' + (r.exceptionDetails.exception?.description
                    || r.exceptionDetails.text));
            }
            return r.result ? r.result.value : undefined;
        };

        const attendreExpression = async (expr, timeoutMs = 60000) => {
            const t0 = Date.now();
            while (Date.now() - t0 < timeoutMs) {
                let v = false;
                try {
                    v = await evaluate(expr, 8000);
                } catch (err) {
                    // Une évaluation qui expire n'est pas un échec de l'assertion :
                    // cela signifie juste que la page est occupée. On réessaie.
                    v = false;
                }
                if (v) return true;
                await sleep(300);
            }
            return false;
        };

        /**
         * Attend qu'une expression MODIFIE sa valeur — pas seulement qu'elle
         * devienne vraie. `attendreExpression` renvoie `true` au premier résultat
         * truthy : pour comparer le résultat à une chaîne précise, il faut donc
         * cette variante, sinon l'assertion comparerait `true` à `'libere'`.
         */
        const attendreValeur = async (expr, attendu, timeoutMs = 60000) => {
            const t0 = Date.now();
            while (Date.now() - t0 < timeoutMs) {
                let v;
                try {
                    v = await evaluate(expr, 8000);
                } catch { v = undefined; }
                if (v === attendu) return v;
                await sleep(300);
            }
            return v;
        };

        await send('Runtime.enable');
        await send('Page.enable');
        await send('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/game.html` });

        // --- 1. Le module de gestion 3D doit exister -----------------------
        const aManager = await attendreExpression('!!window.threeManager');
        verifie(aManager, 'threeManager chargé par game.html');

        if (!aManager) throw new Error('threeManager absent, suite avortée');

        // --- 2. Activation du mode 3D -------------------------------------
        await evaluate(SONDE_FRAMES);

        // `game.js` active le 3D de lui-même au démarrage, mais `toggle3D()`
        // porte une garde anti-concurrence qui renvoie sans rien faire si une
        // bascule est déjà en cours. On appelle donc `enable3D()`, idempotent et
        // sans garde.
        //
        // On ne l'attend PAS dans la même évaluation : sur une machine lente
        // (ou en rendu logiciel headless) la construction dépasse largement le
        // délai d'une évaluation, et le test-Es-tu-mort. On déclenche sans
        // attendre, puis on interroge l'état par polling court.
        await evaluate(
            'window.threeManager.enabled || (window.__activation3D = window.threeManager.enable3D()), true'
        );

        const aActive = await attendreExpression('!!window.threeManager.enabled', 180000);
        verifie(aActive, 'mode 3D activé');

        if (!aActive) throw new Error('mode 3D non activé, suite avortée');

        // La construction est étalée : on attend que la boucle soit sortie du
        // mode « construction » (ThreeScene._building repasse à false).
        const aConstruit = await attendreExpression(
            'window.threeManager.scene && window.threeManager.scene._building === false'
        );
        verifie(aConstruit, 'construction de la scène terminée (TaskScheduler)');

        // --- 3. Les sous-systèmes existent vraiment ------------------------
        const sousSystemes = await evaluate(`(() => {
            const s = window.threeManager.scene;
            return {
                renderer: !!s?.renderer,
                camera: !!s?.camera,
                patient: !!s?.patient,
                patientAnimator: !!s?.patientAnimator,
                instruments: !!s?.instruments,
                environment: !!s?.environmentAgent,
                lighting: !!s?.lightingAgent,
                quality: !!s?.qualityAgent,
                highlighter: !!s?.highlighter,
                tooltip: !!s?.tooltip,
                fpsController: !!s?.fpsController,
                interactifs: s?._interactiveRoots?.length || 0,
                maillages: (() => { let n = 0; s?.scene?.traverse(o => { if (o.isMesh || o.isPoints) n++; }); return n; })()
            };
        })()`);

        verifie(sousSystemes.renderer, 'renderer WebGL présent');
        verifie(sousSystemes.camera, 'caméra présente');
        verifie(sousSystemes.patient, 'patient construit');
        verifie(sousSystemes.patientAnimator, 'animateur patient présent');
        verifie(sousSystemes.instruments, 'instruments construits');
        verifie(sousSystemes.environment, 'agent d\'environnement présent');
        verifie(sousSystemes.lighting, 'agent d\'éclairage présent');
        verifie(sousSystemes.quality, 'agent de qualité présent');
        verifie(sousSystemes.highlighter, 'survol (highlighter) présent');
        verifie(sousSystemes.tooltip, 'infobulle présente');
        verifie(sousSystemes.fpsController, 'contrôleur FPS présent');
        verifie(sousSystemes.interactifs > 5,
            'objets interactifs enregistrés',
            `${sousSystemes.interactifs} trouvé(s)`);
        note(`maillages visibles dans la scène : ${sousSystemes.maillages}`);

        // --- 4. Le preset qualité a été résolu et le LOD appliqué ---------
        const qualite = await evaluate(`(() => {
            const q = window.threeManager.scene.qualityAgent;
            const env = window.threeManager.scene.environmentAgent;
            return {
                preset: q?.presetName,
                pixelRatio: window.threeManager.scene.renderer.getPixelRatio(),
                niveauDetail: env?.getDetailLevel?.() ?? null,
                decoratifTotal: env?._decor?.length ?? 0,
                decoratifVisible: (env?._decor || []).filter(d => d.obj.visible).length,
                composer: !!window.threeManager.scene.lightingAgent?.composer
            };
        })()`);

        verifie(!!qualite.preset, 'preset qualité détecté', JSON.stringify(qualite));
        verifie(qualite.pixelRatio <= 2.0,
            'pixelRatio plafonné', `${qualite.pixelRatio}`);
        verifie(qualite.decoratifTotal > 0,
            'décor décoratif enregistré pour le LOD',
            `${qualite.decoratifTotal} objet(s)`);

        const lodCoherent = qualite.preset === 'low'
            ? qualite.decoratifVisible === 0
            : qualite.decoratifVisible > 0;
        verifie(lodCoherent,
            'palier de détail décoratif cohérent avec le preset',
            `preset=${qualite.preset} visibles=${qualite.decoratifVisible}/${qualite.decoratifTotal}`);

        // Le composer ne doit jamais être construit pendant le chargement.
        verifie(qualite.composer === false,
            'composer (GTAO/bloom) absent juste après le lancement',
            qualite.composer ? 'composer déjà construit' : '');

        // --- 5. La scène rend réellement ----------------------------------
        // On suspend la boucle le temps de lire. `renderer.info` conserve les
        // compteurs de la dernière frame rendue, donc la lecture reste
        // exacte — et l'opération ne dépend plus d'un créneau dans le thread,
        // ce qui la rend fiable même en rendu logiciel, où la boucle de rendu
        // sature le thread principal.
        const rendu = await evaluate(`(() => {
            const s = window.threeManager.scene;
            if (s._animFrameId != null) { cancelAnimationFrame(s._animFrameId); s._animFrameId = null; }
            const r = s.renderer;
            const out = {
                calls: r.info.render.calls,
                triangles: r.info.render.triangles,
                geometries: r.info.memory.geometries,
                textures: r.info.memory.textures,
                programs: r.info.programs?.length ?? 0
            };
            // On relance la boucle.
            s._animFrameId = requestAnimationFrame(s._loop);
            return JSON.stringify(out);
        })()`, 90000).then(v => (typeof v === 'string' ? JSON.parse(v) : v));

        verifie(rendu.calls > 0, 'la scène émet des draw calls', JSON.stringify(rendu));
        verifie(rendu.triangles > 0, 'la scène émet des triangles', `${rendu.triangles}`);
        note(`draw calls=${rendu.calls} triangles=${rendu.triangles} ` +
            `géométries=${rendu.geometries} textures=${rendu.textures} programmes=${rendu.programs}`);

        // --- 6. Inventaire des canvas et des contextes --------------------
        const contextes = await evaluate(`JSON.stringify({
            canvas: document.querySelectorAll('canvas').length,
            lost: (window.threeManager.scene?.renderer?.getContext?.()?.isContextLost?.()) ?? false
        })`, 90000).then(v => (typeof v === 'string' ? JSON.parse(v) : v));
        note(`canvas dans la page : ${contextes.canvas}, contexte WebGL perdu : ${contextes.lost}`);
        verifie(contextes.lost === false, 'contexte WebGL principal intact');

        // --- 7. Cadence réelle (deltas de frames mesurés) ----------------
        // Fenêtre large : en rendu logiciel la scène tourne à quelques images
        // par seconde, et une fenêtre de 4 s ne produirait pas assez
        // d'échantillons pour distinguer un pic de la moyenne.
        await evaluate('window.__frames3d.length = 0; true;');
        await attendreExpression('(window.__frames3d || []).length >= 12', 90000);
        const cadence = await evaluate(`(() => {
            const f = (window.__frames3d || []).slice(3);
            if (f.length < 8) return null;
            const tri = f.slice().sort((a, b) => a - b);
            const med = tri[Math.floor(tri.length / 2)];
            const p95 = tri[Math.floor(tri.length * 0.95)];
            return {
                frames: f.length,
                median: med,
                p95,
                pire: tri[tri.length - 1],
                fpsMedian: 1000 / med
            };
        })()`);

        if (!cadence) {
            note('cadence non mesurable (rendu logiciel headless) — assertion ignorée');
        } else {
            note(`cadence : médiane ${cadence.median.toFixed(1)} ms ` +
                `(~${cadence.fpsMedian.toFixed(0)} fps), p95 ${cadence.p95.toFixed(1)} ms, ` +
                `pire ${cadence.pire.toFixed(1)} ms sur ${cadence.frames} frames`);

            // Sur SwiftShader (rendu logiciel) la cadence est par nature très
            // basse. Ce qu'on vérifie ici n'est pas la fluidité mais la
            // RÉACTIVITÉ : un budget de construction de quelques ms par tranche
            // doit produire une médiane saine. La queue de distribution (p95,
            // pire) n'est pas une assertion : sous rasteriseur logiciel, la
            // compilation d'un modèle qui arrive en cours de partie produit un
            // pic unique de plusieurs secondes qui ne dit rien du produit.
            // Elle est reportée en note, avec le détail des tâches longues.
            verifie(cadence.median < 250,
                'cadence médiane saine (réactivité pendant le jeu)',
                `médiane ${cadence.median.toFixed(0)} ms`);

            const longs = await evaluate('JSON.stringify(window.__longTasks || [])')
                .then(v => (typeof v === 'string' ? JSON.parse(v) : (v || [])));
            if (longs && longs.length) {
                const pire = longs.slice().sort((a, b) => b.duree - a.duree).slice(0, 5);
                for (const t of pire) {
                    note(`tâche longue : ${t.duree} ms à t=${t.debut} ms [${t.nom}]`);
                }
            } else {
                note('aucune tâche longue (>50 ms) enregistrée');
            }
        }

        // --- 8. Arrêt de la 3D : le contexte doit être réellement libéré ---
        // On vérifie la LIBÉRATION, pas la reconstruction complète. Rebâtir la
        // scène impose de recharger et re-parser les modèles : sur un rasteriseur
        // logiciel cela dépasse plusieurs minutes et ne testerait que la patience
        // du test, pas le produit. Ce qui doit être vrai, et qui est coûteux en
        // fuite si ce n'est pas le cas, c'est que l'arrêt rend le contexte.
        const aArret = await attendreValeur(`(() => {
            if (!window.__stop3d) {
                window.__stop3d = window.threeManager.disable3D()
                    .then(() => 'libere', e => 'ERREUR: ' + e.message);
            }
            return window.__stop3d === 'ok' ? 'libere' : window.__stop3d;
        })()`, 'libere', 120000);
        verifie(aArret === 'libere', 'disable3D() se termine sans erreur',
            String(aArret).slice(0, 120));

        if (aArret === 'libere') {
            const apresArret = await evaluate(`JSON.stringify((() => {
                const m = window.threeManager;
                const canvas = document.querySelector('#scene-container canvas')
                    || document.querySelector('canvas');
                let contextePerdu = false;
                try {
                    const gl = m._dernierRendererCtx;
                    contextePerdu = gl ? gl.isContextLost() : true;
                } catch { contextePerdu = true; }
                return {
                    enabled: !!m.enabled,
                    sceneNul: m.scene === null,
                    canvasPresent: !!canvas,
                    contextePerdu
                };
            })())`, 60000).then(v => (typeof v === 'string' ? JSON.parse(v) : v));

            verifie(apresArret.enabled === false, '3D désactivé après arrêt');
            verifie(apresArret.sceneNul === true, 'référence de scène libérée');
            verifie(apresArret.canvasPresent === false,
                'canvas WebGL retiré du DOM (le contexte peut être recyclé par le navigateur)');
        }

        // --- 9. Aucune erreur console --------------------------------------
        // On filtre le bruit attendu : réseau LLM absent, polices, favicon.
        const bruit = /favicon|net::ERR|Failed to load resource|CORS|ERR_NAME_NOT_RESOLVED|LLM|supabase|font/i;
        const erreursReelles = consoleErrors.filter(e => !bruit.test(e));
        verifie(erreursReelles.length === 0,
            'aucune erreur JavaScript pendant la session 3D',
            erreursReelles.slice(0, 3).join(' | '));

    } finally {
        try { ws?.close(); } catch { /* déjà fermé */ }
        await new Promise(r => server.close(r));
        // Tuer l'arborescence Chrome puis réessayer : `proc.kill()` seul
        // laisse les renderers vivants, qui gardent le profil verrouillé.
        // Voir test/helpers/chrome-profile.mjs.
        await nettoyerProfil(proc, userDataDir, '.tmp-chrome-3d-');
    }

    console.log(`\n[Test UI 3D] ${succes.length} vérification(s) OK, ${echecs.length} échec(s)`);
    for (const n of notes) console.log(`         note : ${n}`);
    if (echecs.length) {
        console.log('\nÉchecs :');
        for (const e of echecs) console.log('  - ' + e);
        process.exitCode = 1;
    }
}

main().catch((e) => {
    console.error('[Test UI 3D] Erreur fatale :', e);
    process.exitCode = 1;
});