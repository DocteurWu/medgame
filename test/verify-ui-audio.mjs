/**
 * test/verify-ui-audio.mjs — Vérification navigateur du système audio
 *
 * Les tests node --test (test/audio.test.mjs) valident la cohérence statique :
 * un seul contexte déclaré, aucun appel vers un son inexistant, des bornes
 * correctes. Ils ne valident PAS qu'un son est réellement ENTENDU.
 *
 * C'est le travail de ce fichier : piloter Chrome via le DevTools Protocol,
 * ouvrir le jeu, et mesurer le SIGNAL à la sortie avec l'analyseur global du
 * socle. Un son ne vaut que s'il produit des échantillons ; un bus n'existe
 * que s'il change le signal.
 *
 * Cinq pièges ont été payés pour écrire ce test, et ils sont documentés ici
 * parce qu'ils se reproduiront :
 *
 *  1. UN SON COURT EST UN TRANSIENT. `click` dure 22 ms. Un échantillonnage
 *     toutes les 30 ms le manque une fois sur deux, et le throttling à 45 ms
 *     en supprime la moitié. Il faut déclencher en boucle continue et
 *     échantillonner FINEMENT (5 ms) — sinon on mesure du silence et on
 *     conclut à tort que le son est muet.
 *
 *  2. UN BATTEMENT N'EST PAS UN PIC. B1 est composé d'un impact grave de
 *     130 ms ET d'un bruit filtré de 70 ms : deux franchissements de seuil
 *     par battement. Mesurer l'écart entre franchissements donne 10 ms, pas
 *     1000 ms. Il faut une période réfractoire : on ne compte un battement
 *     qu'après au moins 150 ms sous le seuil.
 *
 *  3. ATTENDRE LES BONS SCRIPTS. `defer` exécute dans l'ordre, mais regarder
 *     `MedGameMedical` dès que `MedGameSfx` existe trouve la couche médicale
 *     pas encore exécutée. Il faut attendre les cinq couches avant de les
 *     tester — sinon trois vérifications tombent au hasard selon la machine.
 *
 *  4. ATTENDRE QUE LES GAINS SOIENT APPLIQUÉS. La page pose son préréglage en
 *     différé ; lire `getAppliedBusGain('ui')` en pleine rampe donne 0,867
 *     alors que le réglage dit 0,75, et l'assertion « le gain n'a pas bougé »
 *     échoue sans qu'il y ait le moindre défaut produit. On attend l'égalité
 *     appliqué = réglé pour tous les bus avant de mesurer.
 *
 *  5. DEUX AMPLITUDES ÊTENT L'ÉTAT DU DUCKING. La priorité `auscultation`
 *     abaisse les bus `ui` et `sfx` à 20 % pendant 0,6 s (relâchement 1,2 s) :
 *     comparer deux pics pris à quelques secondes d'intervalle compare aussi
 *     deux états de duck, et le test tombait une fois sur six sans aucun
 *     couplage entre bus. On vérifie le GAIN APPLIQUÉ — le nœud user, que le
 *     duck ne touche pas — et l'on relâche le ducking avant chaque mesure.
 */

import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';

const BROWSERS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];
const PORT = 9231;
const SERVER_PORT = 8894;
const ECHANTILLON_MS = 5;

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

/**
 * Code injecté dans la page : sonde de signal réutilisée par tous les tests.
 * `peakWhile` déclenche en boucle continue et échantillonne finement.
 */
const SONDE = `
window.__sonde = (function () {
    const A = window.MedGameSound;
    const analyser = A.getAnalyser();
    const buf = new Float32Array(analyser.fftSize);
    const attendre = (ms) => new Promise(r => setTimeout(r, ms));

    function picInstant() {
        analyser.getFloatTimeDomainData(buf);
        let m = 0;
        for (const v of buf) { const a = v < 0 ? -v : v; if (a > m) m = a; }
        return m;
    }

    /**
     * Déclenche \`declencheur()\` toutes les \`intervalleMs\` pendant
     * \`dureeMs\`, en échantillonnant tous les \`pasMs\`.
     * Retourne le pic absolu et la séquence temporelle des pics.
     */
    async function peakWhile(declencheur, dureeMs, intervalleMs, pasMs) {
        const pas = pasMs || ${ECHANTILLON_MS};
        const intervalle = intervalleMs || 60;
        let max = 0;
        let prochain = performance.now();
        const t0 = prochain;
        const serie = [];
        while (performance.now() - t0 < dureeMs) {
            const t = performance.now();
            if (t >= prochain) { declencheur(); prochain = t + intervalle; }
            await attendre(pas);
            const p = picInstant();
            max = Math.max(max, p);
            serie.push([t - t0, p]);
        }
        return { max, serie };
    }

    /** Pic simple, sans déclenchement, sur une durée. */
    function peakQuiet(dureeMs) {
        return peakWhile(() => {}, dureeMs, 999999, ${ECHANTILLON_MS});
    }

    /**
     * Détection d'onsets avec période réfractoire : un battement n'est compté
     * qu'après \`refractoireMs\` de silence sous le seuil. Sans cela les deux
     * composantes de B1 (impact + bruit) comptent comme deux battements.
     *
     * Volontairement NON async : ces fonctions sont pures et doivent renvoyer
     * une valeur, pas une promesse qu'on oublierait de déballer.
     */
    function onsets(serie, seuil, refractoireMs) {
        const out = [];
        let dernier = -1e9;
        for (const [t, v] of serie) {
            if (v > seuil && t - dernier > refractoireMs) {
                out.push(t);
                dernier = t;
            }
        }
        return out;
    }

    function intervalles(liste) {
        const d = [];
        for (let i = 1; i < liste.length; i++) d.push(liste[i] - liste[i - 1]);
        d.sort((a, b) => a - b);
        return d;
    }

    /**
     * Mesure la « force » audible d'un son : déclenche en boucle continue et
     * prend le MAX de plusieurs tentatives.
     *
     * Pourquoi trois tentatives : juste après le chargement, le contexte
     * audio peut encore être en train de passer de 'suspended' à 'running', et
     * les premières hundred-millisecondes partent parfois au muted. Une
     * mesure unique donnerait un faux « son muet » — ce qui est le pire
     * défaut possible pour un test audio, puisqu'il fait ignorer un vrai bug.
     */
    async function audible(nom, dureeMs) {
        let meilleur = 0;
        for (let essai = 0; essai < 3; essai++) {
            await attendre(400);
            const { max } = await peakWhile(() => A.play(nom), dureeMs || 900, 260);
            if (max > meilleur) meilleur = max;
            if (meilleur > 0.01) return meilleur;
        }
        return meilleur;
    }

    return { picInstant, peakWhile, peakQuiet, onsets, intervalles, audible, attendre, buf, analyser };
})();
`;

/**
 * Nettoie les profils Chrome laissés par une exécution morte brutalement
 * (Ctrl+C, crash, timeout de CI). Le `finally` qui fait le ménage ne s'exécute
 * pas quand le processus est tué, et chaque profil pèse plusieurs mégaoctets :
 * sans ce balayage, une suite de tests interrompus en accumule sans limite.
 *
 * On ignore les profils de moins d'une minute : ce sont ceux d'une exécution
 * encore vivante, peut-être parallèle à celle-ci.
 */
function balayerProfilsAbandonnes() {
    const limite = Date.now() - 60000;
    let nettoyes = 0;
    for (const e of fs.readdirSync(process.cwd())) {
        // Le préfixe tolère le suffixe `.quit` : c'est un profil que le passage
        // de nettoyage d'une exécution précédente n'a pas pu supprimer (EBUSY)
        // et qui n'a été que mis de côté.
        const m = /^\.tmp-chrome-audio-(\d+)/.exec(e);
        if (!m) continue;
        // Profil récent : une exécution est peut-être en train de s'en servir.
        if (Number(m[1]) > limite) continue;
        try {
            fs.rmSync(path.join(process.cwd(), e), { recursive: true, force: true, maxRetries: 3 });
            nettoyes++;
        } catch { /* verrou résiduel : on retentera au prochain passage */ }
    }
    if (nettoyes) {
        console.log(`[Test UI Audio] ${nettoyes} profil(s) Chrome abandonné(s) nettoyé(s)`);
    }
}

/**
 * Tue les processus Chrome qui citent NOTRE profil.
 *
 * `taskkill /PID x /T` marche depuis le PID que node a spawn, mais Chrome
 * peut re-parenter un renderer : celui-ci n'est alors plus atteignable depuis
 * la racine de l'arborescence, il survit, et il garde le profil verrouillé —
 * d'où un `rmSync` qui échoue à chaque exécution.
 *
 * Le ciblage se fait sur la ligne de commande, donc il ne touche jamais aux
 * Chrome d'une autre tâche (un export MP4 peut tourner en parallèle avec ses
 * propres profils).
 */
function tuerChromeDuProfil(userDataDir) {
    if (process.platform !== 'win32') return;
    // On cible le NOM du profil, unique à cette exécution, plutôt que le chemin
    // complet : Windows mélange dans les lignes de commande la forme longue
    // (`C:\Users\Louaï\…`) et la forme 8.3 (`C:\Users\LOUA~1\…`), et un test
    // d'égalité sur le chemin complet rate alors les processus qu'on cherche à
    // tuer — d'où des profils verrouillés à chaque exécution.
    const marqueur = path.basename(userDataDir);
    const ps = 'Get-CimInstance Win32_Process -Filter "Name=\'chrome.exe\'" | ' +
        'Where-Object { $_.CommandLine -and $_.CommandLine.Contains(' +
        JSON.stringify(marqueur) + ') } | ' +
        'ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }';
    try {
        spawnSync('powershell.exe',
            ['-NoProfile', '-NonInteractive', '-Command', ps],
            { windowsHide: true, timeout: 15000 });
    } catch { /* best effort */ }
}

async function run() {
    const browser = findBrowser();
    if (!browser) {
        console.log('[Test UI Audio] Aucun Chrome/Edge trouvé — test ignoré.');
        return;
    }

    balayerProfilsAbandonnes();

    await new Promise(r => server.listen(SERVER_PORT, '127.0.0.1', r));
    const userDataDir = path.join(process.cwd(), '.tmp-chrome-audio-' + Date.now());
    const proc = spawn(browser, [
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${userDataDir}`,
        '--headless=new',
        // --mute-audio coupe la SORTIE PHYSIQUE mais pas le graphe : l'analyseur
        // voit toujours le signal. Sans lui, le test est inutilisable en CI.
        '--autoplay-policy=no-user-gesture-required',
        '--mute-audio',
        '--no-first-run',
        '--no-default-browser-check',
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
        const sonsInconnus = [];

        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.method === 'Runtime.consoleAPICalled') {
                const txt = msg.params.args.map(a => a.value ?? a.description ?? '').join(' ');
                if (msg.params.type === 'error') consoleErrors.push(txt);
                if (txt.includes('[MedGameSound] son inconnu')) sonsInconnus.push(txt);
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

        const evaluate = async (expr) => {
            const r = await send('Runtime.evaluate', {
                expression: expr, returnByValue: true, awaitPromise: true
            });
            if (r.exceptionDetails) {
                throw new Error('Eval: ' + JSON.stringify(r.exceptionDetails.exception?.description
                    || r.exceptionDetails.text));
            }
            return r.result ? r.result.value : undefined;
        };

        /** Attend qu'une expression devienne vraie (les scripts sont defer). */
        const attendreExpression = async (expr, timeoutMs = 15000) => {
            const t0 = Date.now();
            while (Date.now() - t0 < timeoutMs) {
                if (await evaluate(expr)) return true;
                await sleep(200);
            }
            return false;
        };

        /**
         * Attend que l'audio soit réellement MESURABLE, puisque c'est ce
         * qu'on s'apprête à faire.
         *
         * Deux conditions, toutes deux payées :
         *
         *  1. Le contexte doit tourner. `--autoplay-policy` suffit souvent,
         *     mais sous contrainte de CPU le `resume()` ne prend pas tout de
         *     suite — et un contexte suspendu rend un silence total qu'on
         *     interprète à tort comme « le système est muet ». S'il ne repart
         *     pas seul, on envoie un vrai geste par CDP, que la politique
         *     d'autoplay accepte toujours.
         *
         *  2. Les gains doivent être APPLIQUÉS, c'est-à-dire égaux à leur
         *     réglage. Le page applique son préréglage en différé ; tant que
         *     la rampe est en cours, `getAppliedBusGain('ui')` vaut 0,867
         *     alors que le réglage dit 0,75, et une assertion « le gain n'a
         *     pas bougé » échoue sans que le produit ait le moindre défaut.
         */
        const audioPret = async () => {
            await evaluate('window.MedGameSound.init(), window.MedGameSound.resume(), true')
                .catch(() => false);
            if (!await attendreExpression('window.MedGameSound.isReady()', 2500)) {
                // Un geste utilisateur réel, accepté même sans le flag d'autoplay.
                for (const type of ['mousePressed', 'mouseReleased']) {
                    await send('Input.dispatchMouseEvent', {
                        type, x: 40, y: 40, button: 'left', clickCount: 1
                    });
                }
                await attendreExpression('window.MedGameSound.isReady()', 2500);
            }
            return attendreExpression(`(() => {
                const A = window.MedGameSound;
                if (!A.isReady() || A.getAppliedMasterGain() < 0.01) return false;
                const s = A.getSettings();
                return Object.keys(s.buses || {}).every((k) => {
                    const applique = A.getAppliedBusGain(k);
                    const regle = A.getBusVolume(k);
                    return Number.isFinite(applique) && Math.abs(applique - regle) < 1e-6;
                });
            })()`, 12000);
        };

        await send('Runtime.enable');
        await send('Page.enable');

        // ── 1. Chargement ───────────────────────────────────────────────────
        console.log('[Test UI Audio] Chargement de auscultation.html…');
        await send('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/auscultation.html` });
        // Il faut attendre les CINQ couches, pas seulement les deux premières.
        // `defer` les exécute dans l'ordre, mais un test qui regarde
        // `MedGameMedical` dès que `MedGameSfx` existe trouve la couche
        // médicale pas encore exécutée : trois vérifications tombaient alors
        // au hasard selon la vitesse de la machine. C'est un faux échec, pas
        // un bug produit — d'où l'attente explicite ci-dessous.
        const soclePret = await attendreExpression(
            '!!(window.MedGameSound && window.MedGameSfx && ' +
            'window.MedGameMedical && window.MedGameAmbience && ' +
            'window.MedGameAudio)');
        verifie(soclePret, 'les cinq scripts audio sont chargés (scripts defer)');

        const couches = await evaluate(`({
            core: !!window.MedGameSound,
            sfx: !!window.MedGameSfx,
            medical: !!window.MedGameMedical,
            ambience: !!window.MedGameAmbience,
            facade: !!window.MedGameAudio,
            alias: window.medicalAudio === window.MedGameMedical,
            facadeInactive: !!(window.MedGameAudio && window.MedGameAudio._unavailable),
            boot: typeof (window.MedGameAudio && window.MedGameAudio.boot)
        })`);
        verifie(couches.core, 'le socle MedGameSound est chargé');
        verifie(couches.sfx, 'le registre SFX est chargé');
        verifie(couches.medical, 'la couche médicale est chargée');
        verifie(couches.ambience, 'la couche ambiance est chargée');
        verifie(couches.facade, 'la façade MedGameAudio est chargée');
        verifie(couches.alias,
            'window.medicalAudio pointe sur MedGameMedical (donc contexte unique)');
        // RÉGRESSION CRITIQUE : un script classique bloquant s'exécute AVANT
        // les scripts `defer`. Si `js/audio.js` est chargé sans `defer` alors
        // que les quatre modules du socle en ont un, `window.MedGameSound`
        // est `undefined` au moment où la façade s'exécute : elle part dans
        // sa branche de repli INERTE et plus aucun son n'est produit sur la
        // page. Vérifier seulement `!!window.MedGameAudio` ne voit rien : les
        // deux branches définissent cet objet. Il faut lire `_unavailable`.
        verifie(!couches.facadeInactive,
            'la façade n’est pas la version inerte (le socle était bien chargé avant)',
            'window.MedGameAudio._unavailable = true : MedGameAudio.play() ne fait rien');
        verifie(couches.boot === 'function',
            'MedGameAudio.boot() est disponible', 'type = ' + couches.boot);

        const pret = await audioPret();
        verifie(pret,
            'contexte démarré et gains appliqués avant de mesurer',
            'isReady ou écart appliqué/réglé toujours vrai à 12 s');

        const etat = await evaluate(`(() => {
            const c = window.MedGameSound.getContext();
            return { etat: c.state, sampleRate: c.sampleRate, sons: window.MedGameSound.list().length };
        })()`);
        verifie(etat.etat === 'running', 'le contexte audio tourne', 'état = ' + etat.etat);
        verifie(etat.sons >= 40, 'le registre contient au moins 40 sons', etat.sons + ' sons');

        await evaluate(SONDE);

        // ── 2. Le signal part vraiment ──────────────────────────────────────
        const mesure = await evaluate(`(async () => {
            const S = window.__sonde, A = window.MedGameSound;
            A.setMuted(false);
            A.relacherDucks();
            await S.attendre(600);
            const repos = (await S.peakQuiet(400)).max;
            const avecSfx = (await S.audible('click', 700));
            A.setMuted(true);
            // Le mute est une rampe de 120 ms, PAS une coupure franche : un
            // instantané à 0 produirait un claquement. On laisse donc la rampe
            // se terminer avant de juger — sinon on mesure la queue du fondu
            // et on conclut à tort que le mute fuit.
            await S.attendre(400);
            const coupe = (await S.peakWhile(() => A.play('click'), 500, 55)).max;
            A.setMuted(false);
            await S.attendre(400);

            // ── Indépendance des bus ───────────────────────────────────────
            // PIÈGE PAYÉ : comparer deux amplitudes prises à quelques
            // secondes d'intervalle compare aussi l'état du ducking. Un son
            // d'auscultation déclenche la priorité « auscultation », qui
            // abaisse les bus sfx et ui à 20 % pendant 0,6 s puis les
            // relâche en 1,2 s — et ce test tombait une fois sur six, non
            // parce que les bus sont couplés, mais parce que le deuxième clic
            // était mesuré en plein duck. On relâche donc le ducking, et on
            // vérifie surtout le GAIN APPLIQUÉ, que le duck ne touche pas
            // (c'est le nœud user, pas le nœud duck).
            A.relacherDucks();
            const guAvant = A.getAppliedBusGain('ui');
            const v = A.getBusVolume('music');
            A.setBusVolume('music', 0);
            await S.attendre(250);
            const gmApres = A.getAppliedBusGain('music');
            const guApres = A.getAppliedBusGain('ui');
            const sansMusique = await S.audible('click', 700);
            A.setBusVolume('music', v);
            A.relacherDucks();
            const vUi = A.getBusVolume('ui');
            A.setBusVolume('ui', 0);
            await S.attendre(250);
            const sansUi = await S.audible('click', 700);
            A.setBusVolume('ui', vUi);
            A.relacherDucks();
            return { repos, avecSfx, coupe, sansMusique, sansUi,
                guAvant, guApres, gmApres,
                master: A.getAppliedMasterGain(),
                mute: A.isMuted(),
                settings: JSON.stringify(A.getSettings()) };
        })()`);
        note(`pic au repos ${mesure.repos.toFixed(5)} | avec SFX ${mesure.avecSfx.toFixed(5)} | ` +
            `coupé ${mesure.coupe.toFixed(5)} | musique à 0 ${mesure.sansMusique.toFixed(5)} | ` +
            `UI à 0 ${mesure.sansUi.toFixed(5)} | gain UI ${mesure.guApres.toFixed(5)} | ` +
            `master ${Number(mesure.master).toFixed(5)} | mute ${mesure.mute} | ` +
            `réglages ${mesure.settings}`);

        verifie(mesure.repos < 0.0005, 'la sortie est silencieuse au repos',
            'pic = ' + mesure.repos.toFixed(5));
        verifie(mesure.avecSfx > 0.01, 'un son joué produit un signal franc',
            'pic = ' + mesure.avecSfx.toFixed(5));
        verifie(mesure.coupe < 0.0005,
            'le mute global rend la sortie numérique',
            'pic résiduel = ' + mesure.coupe.toFixed(5));
        verifie(mesure.gmApres < 0.001 &&
            mesure.guApres > 0.01 &&
            Math.abs(mesure.guApres - mesure.guAvant) < 1e-6,
            'bus indépendants : Musique à 0 laisse le gain Interface intact',
            `music ${mesure.gmApres.toFixed(6)}, ui ${mesure.guAvant.toFixed(6)} → ` +
            mesure.guApres.toFixed(6));
        verifie(mesure.sansMusique > 0.01,
            'couper la musique ne coupe pas les effets',
            'pic = ' + mesure.sansMusique.toFixed(5));

        // ── 3. Les trois sons historiques qui étaient muets ────────────────
        const historiques = await evaluate(`(async () => {
            const S = window.__sonde, A = window.MedGameSound;
            const res = {};
            for (const nom of ['success', 'card_flip', 'correct', 'complete', 'ecosGongStart']) {
                A.setMuted(false);
                res[nom] = await S.audible(nom, 900);
            }
            // Son inexistant : silence attendu. On attend 2,5 s avant de
            // mesurer : le gong ECOS a une queue de 2,8 s, et c'est elle —
            // pas un son fantôme — qui remontait dans la mesure précédente.
            await S.attendre(2500);
            const inconnue = (await S.peakWhile(() => A.play('son_qui_nexiste_pas'), 700, 200)).max;
            await S.attendre(300);
            return { ...res, inconnue };
        })()`);
        for (const nom of ['success', 'card_flip', 'correct', 'complete', 'ecosGongStart']) {
            verifie(historiques[nom] > 0.005, `le son "${nom}" est audible`,
                'pic = ' + (historiques[nom] ?? 0).toFixed(5));
        }
        verifie(historiques.inconnue < 0.0005,
            'un son inexistant ne produit aucun signal',
            'pic = ' + (historiques.inconnue ?? 0).toFixed(5));

        // ── 4. Le cœur suit la fréquence cardiaque ──────────────────────────
        const coeur = await evaluate(`(async () => {
            const S = window.__sonde, A = window.MedGameSound, M = window.MedGameMedical;
            A.setMuted(false);
            M.reset();
            await S.attendre(300);
            async function mesurer(hr, dureeMs) {
                M.stopHeartbeat();
                await S.attendre(400);
                M.startHeartbeat(hr);
                // On laisse l'ordonnanceur se stabiliser avant de mesurer.
                await S.attendre(700);
                const { serie } = await S.peakWhile(() => {}, dureeMs, 999999);
                M.stopHeartbeat();
                const brut = serie.filter(p => p[1] > 0.004).map(p => p[1]);
                const t0 = serie.find(p => p[1] > 0.004);
                const fenetre = t0 ? serie.filter(p => p[0] >= t0[0]) : [];
                // Réfractoire de 240 ms, et non 150 : l'écart S1-S2 va
                // jusqu'à 160 ms, donc avec 150 ms on comptait S1 ET S2 comme
                // deux battements — et la médiane donnait 180 ms au lieu de
                // 1000 ms. 240 ms sépare encore les battements à 200 bpm
                // (période 300 ms).
                const o = S.onsets(fenetre, 0.004, 240);
                // Avec une réfractoire de 240 ms, un cycle = 1 onset (S1+S2
                // confondus). On recompte à 60 ms pour voir les deux temps.
                const o2 = S.onsets(fenetre, 0.004, 60);
                const d = S.intervalles(o);
                const d2 = S.intervalles(o2);
                return {
                    hr,
                    battements: o.length,
                    deuxTemps: o2.length,
                    median: d.length ? d[Math.floor(d.length / 2)] : null,
                    medianDeuxTemps: d2.length ? d2[Math.floor(d2.length / 2)] : null,
                    pic: brut.length ? Math.max(...brut) : 0
                };
            }
            const lent = await mesurer(60, 6000);
            const rapide = await mesurer(150, 4000);
            M.reset();
            return { lent, rapide };
        })()`);

        note(`cœur 60 bpm : ${coeur.lent.battements} battements en 6 s, intervalle médian ` +
            `${coeur.lent.median?.toFixed(0)} ms (attendu ~1000), pic ${coeur.lent.pic.toFixed(4)}`);
        note(`cœur 150 bpm : ${coeur.rapide.battements} battements en 4 s, intervalle médian ` +
            `${coeur.rapide.median?.toFixed(0)} ms (attendu ~400), pic ${coeur.rapide.pic.toFixed(4)}`);

        verifie(coeur.lent.pic > 0.004, 'le cœur produit un signal franc',
            'pic = ' + coeur.lent.pic.toFixed(5));
        verifie(coeur.lent.battements >= 4 && coeur.lent.battements <= 8,
            'le cœur bat ~6 fois en 6 s à 60 bpm',
            coeur.lent.battements + ' battements');
        verifie(coeur.rapide.battements >= 8 && coeur.rapide.battements <= 13,
            'le cœur bat ~10 fois en 4 s à 150 bpm',
            coeur.rapide.battements + ' battements');
        verifie(coeur.rapide.median !== null && coeur.lent.median !== null &&
            coeur.rapide.median < coeur.lent.median * 0.75,
            'l\'intervalle mesuré suit la fréquence cardiaque',
            `60 bpm → ${coeur.lent.median?.toFixed(0)} ms, 150 bpm → ${coeur.rapide.median?.toFixed(0)} ms`);
        // Deux fois plus d'onsets que de battements quand la réfractoire
        // descend sous l'écart S1-S2 : c'est la preuve physique que le cœur
        // a bien deux temps, et pas un bip.
        verifie(coeur.lent.deuxTemps >= coeur.lent.battements * 1.6,
            'chaque battement émet deux temps distincts (S1 puis S2)',
            `${coeur.lent.battements} battements, ${coeur.lent.deuxTemps} onsets courts`);

        // ── 5. L'écart S1-S2 se comprime ─────────────────────────────────
        // CE QUE CE TEST NE FAIT PAS, et pourquoi : il ne mesure pas la
        // durée exacte de S1-S2 à la milliseconde. La fenêtre de l'analyseur
        // fait 1024 échantillons, soit ~21 ms à 48 kHz : mesurer un intervalle
        // de 75 ms avec cette résolution donnerait une marge d'erreur de
        // ±30 %, et un passage de 160 à 75 ms à la limite de la mesure.
        //
        // La valeur exacte est donc testée sur la fonction pure
        // `MedGameMedical.s2Gap()` dans test/audio.test.mjs, où elle est
        // déterministe. Ce qu'on vérifie ICI, c'est qu'elle se traduit
        // physiquement : à haute fréquence les deux temps se resserrent.
        const s1s2 = await evaluate(`(async () => {
            const S = window.__sonde, A = window.MedGameSound, M = window.MedGameMedical;
            A.setMuted(false);
            async function compter(hr, dureeMs) {
                M.stopHeartbeat();
                await S.attendre(400);
                M.startHeartbeat(hr);
                await S.attendre(900);
                const { serie } = await S.peakWhile(() => {}, dureeMs, 999999);
                M.stopHeartbeat();
                const t0 = serie.find(p => p[1] > 0.004);
                if (!t0) return null;
                // Réfractoire de 55 ms : sous l'écart S1-S2 minimal (75 ms),
                // donc chaque temps du cœur compte.
                const o = S.onsets(serie.filter(p => p[0] >= t0[0]), 0.003, 55);
                const d = S.intervalles(o);
                return {
                    hr,
                    onsets: o.length,
                    // Le premier intervalle court = S1-S2.
                    s1s2: d.length ? Math.min(...d.slice(0, 3)) : null
                };
            }
            const lent = await compter(60, 5000);
            const rapide = await compter(180, 4000);
            M.reset();
            return { lent, rapide };
        })()`);
        note(`deux temps : ${s1s2.lent?.onsets} onsets à 60 bpm, ` +
            `${s1s2.rapide?.onsets} onsets à 180 bpm ; plus court intervalle ` +
            `${s1s2.lent?.s1s2?.toFixed(0)} ms puis ${s1s2.rapide?.s1s2?.toFixed(0)} ms`);
        verifie(s1s2.lent !== null && s1s2.rapide !== null,
            'les deux temps du cœur sont détectables',
            JSON.stringify(s1s2));
        if (s1s2.lent && s1s2.rapide) {
            verifie(s1s2.lent.onsets >= s1s2.lent.hr / 60 * 5 * 1.5,
                'à 60 bpm, ~2 temps par battement',
                s1s2.lent.onsets + ' onsets en 5 s');
            verifie(s1s2.rapide.onsets > s1s2.lent.onsets * 1.4,
                'à 180 bpm, le nombre de temps émis augmente',
                `${s1s2.lent.onsets} → ${s1s2.rapide.onsets}`);
            verifie(s1s2.rapide.s1s2 !== null && s1s2.rapide.s1s2 <= 120,
                'à 180 bpm, l\'écart entre les deux temps est comprimé',
                s1s2.rapide.s1s2?.toFixed(0) + ' ms');
        }

        // ── 6. La couche musicale existe et réagit ─────────────────────────
        const musique = await evaluate(`(async () => {
            const S = window.__sonde, A = window.MedGameSound, Amb = window.MedGameAmbience;
            A.setMuted(false);
            Amb.start();
            await S.attendre(1200);
            const calme = (await S.peakWhile(() => {}, 900, 999999)).max;
            Amb.setState('critical', true);
            await S.attendre(1600);
            const critique = (await S.peakWhile(() => {}, 900, 999999)).max;
            Amb.setState('off', true);
            await S.attendre(1800);
            const coupe = (await S.peakWhile(() => {}, 900, 999999)).max;
            Amb.setState('calm', true);
            return { calme, critique, coupe, etat: Amb.getState() };
        })()`);
        note(`musique : calme ${musique.calme.toFixed(5)}, critique ${musique.critique.toFixed(5)}, ` +
            `coupée ${musique.coupe.toFixed(5)}`);
        verifie(musique.calme > 0.001, 'la couche musicale produit un signal',
            'pic = ' + musique.calme.toFixed(5));
        verifie(musique.critique > musique.calme * 1.3,
            'l\'état critique est plus intense que l\'état calme',
            `${musique.calme.toFixed(5)} → ${musique.critique.toFixed(5)}`);
        verifie(musique.coupe < musique.calme * 0.6,
            'couper la musique éteint bien la couche musicale',
            `${musique.calme.toFixed(5)} → ${musique.coupe.toFixed(5)}`);
        verifie(musique.etat === 'calm', 'l\'état musical est mémorisé');

        // ── 7. Le mode calme coupe les alarmes ──────────────────────────────
        const calme = await evaluate(`(async () => {
            const S = window.__sonde, A = window.MedGameSound, M = window.MedGameMedical;
            A.setMuted(false);
            M.reset();
            // Isolation : la couche musicale du test précédent tourne encore
            // et produit ~0,06. Sans cette coupure, on mesurerait la musique
            // en croyant mesurer un résidu d'alarme — c'est arrivé une fois.
            const vols = A.constants.BUS_NAMES.map(b => [b, A.getBusVolume(b)]);
            for (const b of ['music', 'ambience']) A.setBusVolume(b, 0);
            await S.attendre(1200);
            async function picAlarme() {
                M.startAlarm('critical');
                await S.attendre(250);
                const { max } = await S.peakWhile(() => {}, 1500, 999999);
                M.stopAlarm();
                await S.attendre(700);
                return max;
            }
            // Mesuré AVANT de restaurer les volumes : sinon on relit la
            // musique qu'on vient d'éteindre et on la prend pour un résidu.
            const repos = (await S.peakQuiet(600)).max;
            window.MedGameModes = { isCalmMode: () => false };
            const normal = await picAlarme();
            window.MedGameModes = { isCalmMode: () => true };
            const calmePic = await picAlarme();
            delete window.MedGameModes;
            M.reset();
            for (const [b, v] of vols) A.setBusVolume(b, v);
            return { normal, calmePic, repos };
        })()`);
        note(`alarme : repos ${calme.repos.toFixed(5)}, normal ${calme.normal.toFixed(5)}, ` +
            `mode calme ${calme.calmePic.toFixed(5)}`);
        verifie(calme.repos < 0.0005, 'hors alarme, la sortie est silencieuse',
            'pic = ' + calme.repos.toFixed(5));
        verifie(calme.normal > 0.005, 'l\'alarme critique est audible en mode normal',
            'pic = ' + calme.normal.toFixed(5));
        verifie(calme.calmePic < 0.0005,
            'le mode calme éteint complètement l\'alarme',
            `normal ${calme.normal.toFixed(5)} vs calme ${calme.calmePic.toFixed(5)}`);

        // ── 8. Aucun appel vers un son inexistant ───────────────────────────
        // On exclut la sonde ci-dessus, qui joue volontairement un nom
        // fantôme pour vérifier que le registre le rejette proprement.
        const reels = sonsInconnus.filter(t => !t.includes('son_qui_nexiste_pas'));
        verifie(reels.length === 0,
            'aucun appel vers un son inexistant pendant la session',
            reels.slice(0, 5).join(' | '));

        // ── 9. Le jeu ───────────────────────────────────────────────────────
        console.log('[Test UI Audio] Chargement de game.html…');
        await send('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/game.html` });
        // Même attente que sur auscultation.html : sans elle, la vérification
        // « la façade n'est pas la version inerte » passait pour la bonne
        // raison qu'elle n'était pas encore chargée.
        const jeuPret = await attendreExpression(
            '!!(window.MedGameSound && window.MedGameMedical && ' +
            'window.MedGameAmbience && window.MedGameAudio)', 20000);
        verifie(jeuPret, 'game.html : les cinq scripts audio sont chargés');
        const jeu = await evaluate(`({
            core: !!window.MedGameSound,
            medical: !!window.MedGameMedical,
            alias: window.medicalAudio === window.MedGameMedical,
            facadeInactive: !!(window.MedGameAudio && window.MedGameAudio._unavailable),
            audioTags: document.querySelectorAll('audio').length,
            presets: window.MedGameSound.listPresets(),
            buses: window.MedGameSound.constants.BUS_NAMES
        })`);
        verifie(jeu.core && jeu.medical, 'game.html charge le socle et la couche médicale');
        verifie(jeu.alias, 'game.html : window.medicalAudio est bien la couche médicale');
        verifie(!jeu.facadeInactive,
            'game.html : la façade n’est pas la version inerte');
        verifie(jeu.audioTags === 0, 'game.html ne contient plus de balise <audio>',
            jeu.audioTags + ' balise(s)');
        verifie(Array.isArray(jeu.presets) && jeu.presets.length === 3,
            'les trois préréglages audio sont exposés', JSON.stringify(jeu.presets));
        verifie(Array.isArray(jeu.buses) && jeu.buses.length === 6,
            'les six bus sont exposés', JSON.stringify(jeu.buses));

        // Persistance : ce que le jeu écrit doit survivre au rechargement.
        await evaluate('window.MedGameSound.setBusVolume("music", 0.11), 0');
        await send('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/game.html` });
        await attendreExpression('!!window.MedGameSound', 20000);
        const persiste = await evaluate('window.MedGameSound.getBusVolume("music")');
        verifie(Math.abs(persiste - 0.11) < 1e-6,
            'un réglage de bus survit au rechargement',
            'valeur relue = ' + persiste);

        const bruit = consoleErrors.filter(e =>
            !/favicon|net::ERR_|Failed to load resource|supabase|WebSocket|Cross-Origin/i.test(e));
        verifie(bruit.length === 0, 'aucune erreur console',
            bruit.slice(0, 4).join(' | '));

    } finally {
        try { if (ws) ws.close(); } catch { /* déjà fermé */ }
        // Chrome garde des fichiers verrouillés quelques dizaines de
        // millisecondes après le kill : sans cette attente, la suppression du
        // profil échoue en silence et on laisse un profil jetable de plusieurs
        // mégaoctets dans l'arborescence à chaque exécution.
        //
        // Sous Windows, `proc.kill()` ne touche que le PID que node a spawn :
        // Chrome a ailleurs des processus enfants qui survivent et gardent le
        // profil verrouillé. Il faut tuer l'ARBORESCENCE (taskkill /T), sinon
        // le rmSync plus bas échoue à chaque exécution.
        try {
            if (proc.exitCode === null && !proc.killed) {
                if (process.platform === 'win32') {
                    spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'],
                        { windowsHide: true });
                } else {
                    proc.kill();
                }
            }
            if (proc.exitCode === null) {
                await new Promise((resolve) => {
                    const t = setTimeout(resolve, 4000);
                    proc.once('exit', () => { clearTimeout(t); resolve(); });
                });
            }
        } catch { /* déjà arrêté */ }
        // Dernière passe : les renderers re-parentés par Chrome ne sont plus
        // atteignables depuis le PID initial, et c'est eux qui gardent le
        // profil verrouillé.
        tuerChromeDuProfil(userDataDir);
        server.close();
        // Le verrou est EBUSY, jamais permanent : il tient le temps que
        // Windows libère les handles de l'arborescence tuée, soit plus longtemps
        // qu'il n'en faut pour constater l'échec. Une attente initiale suivie de
        // tentatives largement espacées couvre ce délai ; sans elles, un profil
        // sur deux restait sur le disque jusqu'au balayage de l'exécution
        // suivante.
        await sleep(400);

        for (const e of fs.readdirSync(process.cwd())) {
            if (!e.startsWith('.tmp-chrome-audio-')) continue;
            const dir = path.join(process.cwd(), e);
            let derniereErreur = '';
            for (let essai = 0; essai < 5; essai++) {
                try {
                    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
                    derniereErreur = '';
                    break;
                } catch (err) {
                    derniereErreur = (err && err.code) ? err.code : String(err);
                    await sleep(700);
                }
            }
            if (fs.existsSync(dir)) {
                // On ne force pas : un EBUSY tient tant qu'un handle est ouvert,
                // et il peut tenir plus longtemps qu'aucune attente raisonnable.
                // RENOMMER, lui, reste autorisé même sur un répertoire dont des
                // fichiers sont ouverts — on le met de côté et le balayage de
                // l'exécution suivante l'effacera, quand plus personne n'y touche.
                try {
                    fs.renameSync(dir, dir + '.quit');
                    console.log(`  note        profil Chrome mis de côté (EBUSY) : ${e}`);
                } catch {
                    console.log(`  ATTENTION  profil Chrome non supprimé : ${e}` +
                        (derniereErreur ? ` (${derniereErreur})` : ''));
                }
            }
        }
    }

    console.log('\n[Test UI Audio] Bilan : ' + succes.length + ' vérification(s) réussie(s)');
    if (echecs.length) {
        console.log('  ' + echecs.length + ' échec(s) :');
        for (const e of echecs) console.log('   - ' + e);
        process.exitCode = 1;
    } else {
        console.log('  Aucun échec.');
    }
}

run().catch((e) => {
    console.error('[Test UI Audio] Erreur fatale :', e.message);
    process.exitCode = 1;
});