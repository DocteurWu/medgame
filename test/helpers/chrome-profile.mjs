/**
 * test/helpers/chrome-profile.mjs
 *
 * Gestion des profils Chrome jetables utilisés par les tests UI (CDP).
 *
 * Pourquoi ce module existe
 * -------------------------
 * Chaque test UI lance Chrome avec `--user-data-dir=.tmp-chrome-<prefix>-<ts>`.
 * Ce profil pèse 10 à 15 Mo. Sous Windows, le supprimer est une opération
 * DELICATE, pour trois raisons cumulees :
 *
 *   1. `proc.kill()` ne touche que le PID que node a spawn. Chrome re-parente
 *      ses renderers : ils survivent, et CEUX-LA gardent le profil verrouille.
 *   2. Chrome libere ses fichiers avec un delai de quelques dizaines de
 *      millisecondes apres le kill : une suppression immediate echoue.
 *   3. Le verrou est EBUSY, jamais permanent. Il se resorbe tout seul, mais
 *      pas assez vite pour une suppression « au premier essai ».
 *
 * Consequence mesuree avant ce module : les tests `gds` et `game-loading`
 * laissaient 18 profils (environ 200 Mo) dans l'arborescence a chaque suite
 * interrompue. Cette accumulation ralentissait le demarrage de Chrome au
 * point de faire echouer la connexion au port de debug — le test devenait
 * FLAKY, sans qu'aucune regression du produit soit en cause.
 *
 * La strategie, deja verifiee dans `verify-ui-audio.mjs`, est reprise ici :
 * tuer l'arborescence, attendre, reessayer, et RENOMMER en dernier recours
 * (renommer reste autorise sur un repertoire dont des fichiers sont ouverts ;
 * le balayage de l'execution suivante effacera ce qui a ete mis de cote).
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cree un repertoire de profil Chrome jetable.
 * @param {string} prefix Prefixe discriminant, ex. `.tmp-chrome-gds-`
 */
export function creerProfil(prefix) {
    return path.join(process.cwd(), prefix + Date.now());
}

/**
 * Tue les processus Chrome qui citent NOTRE profil.
 *
 * `taskkill /PID x /T` marche depuis le PID que node a spawn, mais un
 * renderer re-parente n'est plus atteignable depuis l'arborescence : il
 * survit et garde le profil verrouille. Le ciblage se fait sur la ligne de
 * commande, donc il ne touche jamais aux Chrome d'une autre tache.
 */
export function tuerChromeDuProfil(userDataDir) {
    if (process.platform !== 'win32') return;
    // On cible le NOM du profil, unique a cette execution, plutot que le
    // chemin complet : Windows melange dans les lignes de commande la forme
    // longue (`C:\Users\Louaï\...`) et la forme 8.3 (`C:\Users\LOUA~1\...`),
    // et une egalite sur le chemin complet rate alors les processus a tuer.
    const marqueur = path.basename(userDataDir);
    const ps =
        'Get-CimInstance Win32_Process -Filter "Name=\'chrome.exe\'" | ' +
        'Where-Object { $_.CommandLine -and $_.CommandLine.Contains(' +
        JSON.stringify(marqueur) +
        ') } | ' +
        'ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }';
    try {
        spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
            windowsHide: true,
            timeout: 15000,
        });
    } catch {
        /* best effort */
    }
}

/**
 * Arrete Chrome et supprime son profil.
 *
 * A appeler dans un `finally`. Ne leve jamais : un echec de nettoyage ne
 * doit pas faire echouer le test lui-meme.
 *
 * @param {import('node:child_process').ChildProcess|null} proc
 * @param {string} userDataDir
 * @param {string} prefix Prefixe du profil, pour le messages
 */
export async function nettoyerProfil(proc, userDataDir, prefix = '.tmp-chrome-') {
    // 1. Tuer l'arborescence, pas seulement le PID de tête.
    try {
        if (proc && proc.exitCode === null && !proc.killed) {
            if (process.platform === 'win32') {
                spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { windowsHide: true });
            } else {
                proc.kill();
            }
        }
        if (proc && proc.exitCode === null) {
            await new Promise((resolve) => {
                const t = setTimeout(resolve, 4000);
                proc.once('exit', () => {
                    clearTimeout(t);
                    resolve();
                });
            });
        }
    } catch {
        /* deja arrete */
    }

    // 2. Derniere passe : les renderers re-parentes ne sont plus atteignables
    //    depuis le PID initial, et ce sont eux qui gardent le profil verrouille.
    tuerChromeDuProfil(userDataDir);

    // 3. Chrome libere ses fichiers avec un delai : une suppression immediate
    //    echoue. Le verrou est EBUSY, jamais permanent.
    await sleep(400);

    const dir = path.join(process.cwd(), path.basename(userDataDir));
    let derniereErreur = '';
    for (let essai = 0; essai < 5; essai++) {
        try {
            fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
            derniereErreur = '';
            break;
        } catch (err) {
            derniereErreur = err && err.code ? err.code : String(err);
            await sleep(700);
        }
    }

    if (fs.existsSync(dir)) {
        // On ne force pas : un EBUSY tient tant qu'un handle est ouvert.
        // RENOMMER reste autorise sur un repertoire dont des fichiers sont
        // ouverts : on le met de cote, et le balayage de l'execution
        // suivante l'effacera, quand plus personne n'y touche.
        try {
            fs.renameSync(dir, dir + '.quit');
            console.log(`  note        profil Chrome mis de côté (EBUSY) : ${path.basename(dir)}`);
        } catch {
            console.log(
                `  ATTENTION  profil Chrome non supprimé : ${path.basename(dir)}` +
                    (derniereErreur ? ` (${derniereErreur})` : '')
            );
        }
    }
}

/**
 * Balaye les profils Chrome abandonnes par des executions mortes brutalement
 * (Ctrl+C, crash, timeout de CI). Le `finally` qui fait le menage ne
 * s'execute pas quand le processus est tue, et chaque profil pese plusieurs
 * megaoctets : sans ce balayage, une suite interrompue en accumule sans
 * limite — et finit par faire echouer le test suivant.
 *
 * On ignore les profils de moins d'une minute : ce sont ceux d'une execution
 * encore vivante, peut-etre parallele a celle-ci.
 *
 * @param {string[]} prefixes Prefixes a balayer, ex. ['.tmp-chrome-gds-']
 * @returns {number} nombre de profils nettoyes
 */
export function balayerProfilsAbandonnes(prefixes) {
    const limite = Date.now() - 60000;
    let nettoyes = 0;
    let cwd;
    try {
        cwd = fs.readdirSync(process.cwd());
    } catch {
        return 0;
    }
    for (const e of cwd) {
        // Le prefixe tolerate le suffixe `.quit` : c'est un profil qu'un
        // passage de nettoyage precedent n'a pas pu supprimer (EBUSY) et qui
        // n'a ete que mis de cote.
        const m = prefixes.map((p) => new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)`)).find((r) => r.test(e));
        if (!m) continue;
        const ts = Number(m.exec(e)[1]);
        if (!Number.isFinite(ts) || ts > limite) continue;
        try {
            fs.rmSync(path.join(process.cwd(), e), { recursive: true, force: true, maxRetries: 3 });
            nettoyes++;
        } catch {
            /* verrou residuel : on retentera au prochain passage */
        }
    }
    return nettoyes;
}
