/**
 * js/three-loaders-shared.js — Chargement paresseux de three.js, mutualise.
 *
 * Extrait de atlas-kidney.js et atlas-lung.js, ou `getThree()` et
 * `getGLTFLoader()` etaient dupliques a l'octet (avec leurs deux variables
 * de cache). Deux modules, deux instances du meme chargeur : la duplication
 * etait un accident de copier-coller, pas une decision.
 *
 * Pourquoi un import dynamique et non un `import * as THREE from 'three'` :
 * `atlas.html` charge l'atlas du systeme nerveux dans une IFRAME, et les
 * modules d'atlas ne sont importes que si le joueur ouvre cette section. Un
 * import statique chargerait three.js (~600 Ko) pour une page qui ne
 * l'utilise pas. Le `import()` ne paye le cout qu'a l'usage.
 *
 * Le cache est ici, donc partage : les deux modules d'atlas reutilisent la
 * meme instance de THREE et le meme GLTFLoader.
 */

let _THREE = null;
let _GLTFLoader = null;

/**
 * Namespace three.js. Utilise `window.THREE` s'il existe (compatibilite
 * avec les pages qui le poserent elles-memes), sinon charge le module.
 */
export async function getThree() {
    if (!_THREE) {
        _THREE = (typeof window !== 'undefined' && window.THREE) ? window.THREE : await import('three');
    }
    return _THREE;
}

/**
 * Classe GLTFLoader de three.js, chargee a la premiere demande.
 */
export async function getGLTFLoader() {
    if (!_GLTFLoader) {
        const mod = await import('three/addons/loaders/GLTFLoader.js');
        _GLTFLoader = mod.GLTFLoader;
    }
    return _GLTFLoader;
}
