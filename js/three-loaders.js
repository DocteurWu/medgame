/**
 * three-loaders.js — Loaders Three.js partagés pour MedGame
 *
 * - Un unique GLTFLoader avec décompression Draco (décodeur hébergé localement)
 * - Un OBJLoader partagé
 * - Un LoadingManager commun qui suit les assets GLTF/OBJ et alimente le
 *   journal d'erreurs de l'écran de chargement (#three-loading)
 *
 * Tous les modules 3D doivent importer ces loaders au lieu d'en instancier
 * leurs propres copies : cela centralise le suivi de progression et évite
 * de re-télécharger le décodeur Draco.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/**
 * Manager partagé : compte tous les assets passant par les loaders ci-dessous.
 * Alimente la barre de progression de l'écran de chargement.
 */
export const loadingManager = new THREE.LoadingManager();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('assets/libs/draco/');

export const gltfLoader = new GLTFLoader(loadingManager);
gltfLoader.setDRACOLoader(dracoLoader);

export const objLoader = new OBJLoader(loadingManager);

import { offlineAssetCache } from './offline-asset-cache.js';

// ============================================================
// CHARGEMENT GLB ROBUSTE (cache persistant + timeout + erreur propre)
// ============================================================

const _glbPromises = new Map();

/**
 * Charge un GLB avec cache persistant OfflineAssetCache, timeout et callbacks compatibles GLTFLoader.
 * @param {string} path — chemin du .glb
 * @param {Function} onLoad — callback(gltf)
 * @param {Function} [onProgress] — callback(xhr)
 * @param {Function} [onError] — callback(err)
 * @param {Object} [opts] — { timeoutMs }
 */
// Le blob: URL du CacheStorage échoue sur certains navigateurs quand la réponse
// mise en cache n'a pas d'en-têtes CORS (cas réel : GLB avec textures Draco).
// On charge donc le ArrayBuffer et on passe par gltfLoader.parse — le chemin le
// plus fiable. Le timeout est reset à chaque étape : il ne doit plus mesurer que
// le travail réellement en cours, sinon le repli arrive après coup et le GLB
// n'est jamais affiché.
export function loadGLBSmart(path, onLoad, onProgress, onError, opts = {}) {
    // 40 s et non 25 : sur une première visite, un cache froid et une machine
    // lente, le simple téléchargement peut dépasser 25 s. Le timeout doit
    // sanctionner un asset BLOQUÉ, pas un asset lent mais vivant.
    const timeoutMs = opts.timeoutMs ?? 40000;
    // glTF résout ses URI relatives par rapport au FICHIER, donc `parse()` attend
    // le RÉPERTOIRE comme `path`, pas le nom du fichier. Passer le fichier
    // produisait « assets/3D/stethoscope.glbTextures/colormap.png » et faisait
    // échouer toute texture externe du modèle.
    const resourceBase = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : path;
    let timer = null;
    const arm = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            _glbPromises.delete(path); // retry possible après timeout
            try { onError?.(new Error(`[loadGLBSmart] timeout ${timeoutMs}ms : ${path}`)); } catch {}
        }, timeoutMs);
    };

    if (!_glbPromises.has(path)) {
        _glbPromises.set(path, new Promise((resolve, reject) => {
            arm();

            const done = (gltf) => { clearTimeout(timer); resolve(gltf); };
            const fail = (err) => { clearTimeout(timer); _glbPromises.delete(path); reject(err); };

            const parseBuffer = (buffer, fromCache) => {
                arm();
                gltfLoader.parse(
                    buffer,
                    resourceBase,
                    (gltf) => done(gltf),
                    (err) => {
                        if (fromCache) {
                            // Le blob du cache est douteux → dernier recours : réseau.
                            console.warn('[loadGLBSmart] parse du buffer cache échoué, repli réseau:', err);
                            loadDirect();
                        } else {
                            fail(err);
                        }
                    }
                );
            };

            const loadDirect = () => {
                arm();
                gltfLoader.load(
                    path,
                    (gltf) => done(gltf),
                    onProgress,
                    (err) => fail(err)
                );
            };

            const startAt = performance.now();
            // Chaque progression réarme le minuteur : un téléchargement lent
            // mais qui avance ne doit pas être pris pour un téléchargement
            // bloqué. Sans cela, un gros modèle sur connexion lente est
            // signalé en erreur alors que la requête aboutira quelques secondes
            // plus tard.
            offlineAssetCache.getOrFetchBuffer(path, (ratio) => {
                arm();
                onProgress?.({ lengthComputable: true, loaded: ratio * 100, total: 100 });
            }, timeoutMs).then((buffer) => {
                console.info('[loadGLBSmart] buffer', Math.round(performance.now() - startAt) + 'ms',
                    (buffer.byteLength / 1024).toFixed(0) + ' Ko');
                parseBuffer(buffer, false);
            }).catch(() => loadDirect());
        }));
    }

    _glbPromises.get(path).then(
        (gltf) => { try { onLoad?.(gltf); } catch (e) { console.warn('[loadGLBSmart] onLoad:', e); } },
        (err) => {
            console.warn('[loadGLBSmart] Échec:', path, err);
            try { onError?.(err); } catch {}
        }
    );
}

// ============================================================
// ÉCRAN DE CHARGEMENT 3D
// ============================================================

/**
 * Le total d'assets à charger N'EST PAS connu quand l'écran s'affiche : les
 * modèles sont découverts au fur et à mesure de la construction de la salle.
 * Une barre à « 0 % » qui se remplit donc afficherait un pourcentage inventé.
 * On affiche une phase — qui elle est exacte, parce que le code la déclare — et
 * une barre indéterminée.
 */
let _overlayCtrl = null;
let _styleInjected = false;

function _injectStylesheet() {
    if (_styleInjected || typeof document === 'undefined') return;
    _styleInjected = true;
    if (document.getElementById('three-loading-css')) return;
    const link = document.createElement('link');
    link.id = 'three-loading-css';
    link.rel = 'stylesheet';
    link.href = 'css/three-loading.css';
    document.head.appendChild(link);
}

function _ensureOverlayDOM() {
    _injectStylesheet();
    let overlay = document.getElementById('three-loading');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'three-loading';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');

    const box = document.createElement('div');
    box.className = 'ld-box';

    const logo = document.createElement('div');
    logo.className = 'ld-logo';
    logo.setAttribute('aria-hidden', 'true');
    // U+2665 (coeur PLEIN) et non l'emoji U+2764 : un emoji est colorisé par
    // la police du système — rouge vif ici — et jure avec le cyan de l'interface.
    // Un caractère texte prend la couleur de la règle CSS.
    logo.textContent = '\u2665';

    const title = document.createElement('div');
    title.className = 'ld-title';
    title.textContent = 'Préparation du cabinet…';

    const phase = document.createElement('div');
    phase.className = 'ld-phase';

    const bar = document.createElement('div');
    bar.className = 'ld-bar';

    const note = document.createElement('div');
    note.className = 'ld-note';
    note.textContent = 'Première ouverture : le rendu 3D se construit.';

    box.append(logo, title, phase, bar, note);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    return overlay;
}

/**
 * Branche l'écran de chargement et renvoie son contrôleur.
 * À appeler UNE fois, avant la création de la scène 3D.
 *
 * @returns {{setPhase: (t: string) => void, finish: () => void}}
 */
export function initLoadingOverlay() {
    const overlay = _ensureOverlayDOM();
    const phaseEl = overlay.querySelector('.ld-phase');

    const ctrl = {
        /** Phase affichée — le texte est exact, c'est le code qui le déclare. */
        setPhase(text) {
            if (phaseEl && text) phaseEl.textContent = text;
        },
        /**
         * Fin réelle du chargement. À appeler quand la scène est CONSTRUITE —
         * pas sur une minuterie : l'ancienne version masquait l'écran au bout
         * de 12 s alors que la construction pouvait durer bien plus longtemps
         * (70 s en rendu logiciel), laissant le joueur devant une page figée
         * SANS AUCUN EXPLICATION, ce qui est exactement le défaut signalé.
         */
        finish() {
            if (_overlayCtrl !== ctrl) return;
            _overlayCtrl = null;
            overlay.classList.add('ld-hidden');
            setTimeout(() => overlay.remove(), 600);
        }
    };
    _overlayCtrl = ctrl;

    // three.js ne signale rien de lui-même sur un asset manquant : sans ce
    // branchement, un modèle 404 disparaît sans laisser de trace.
    loadingManager.onError = (url) => {
        console.warn('[ThreeLoaders] Échec asset (continué):', url);
    };

    return ctrl;
}
