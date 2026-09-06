/**
 * scene-disposer.js — Nettoyage chirurgical de la mémoire VRAM et des ressources WebGL
 * Libère explicitement les GPU Buffers, textures, render targets et listeners
 * pour éviter les fuites de mémoire (VRAM bloquée) au changement de patient ou de scène.
 */

export class SceneDisposer {
    /**
     * Liste exhaustive des textures potentielles sur un matériau Three.js
     */
    static TEXTURE_PROPERTIES = [
        'map', 'roughnessMap', 'metalnessMap', 'normalMap', 'bumpMap',
        'aoMap', 'displacementMap', 'alphaMap', 'emissiveMap', 'lightMap',
        'envMap', 'specularMap', 'gradientMap', 'transmissionMap',
        'thicknessMap', 'sheenColorMap', 'sheenRoughnessMap', 'clearcoatMap',
        'clearcoatRoughnessMap', 'clearcoatNormalMap'
    ];

    /**
     * Libère un matériau et toutes ses textures associées
     * @param {THREE.Material} mat 
     */
    static disposeMaterial(mat) {
        if (!mat) return;

        // 1. Textures standards
        for (const prop of this.TEXTURE_PROPERTIES) {
            const tex = mat[prop];
            if (tex && tex.isTexture) {
                tex.dispose();
                mat[prop] = null;
            }
        }

        // 2. Uniforms éventuels (ShaderMaterial / onBeforeCompile)
        if (mat.uniforms) {
            for (const key of Object.keys(mat.uniforms)) {
                const val = mat.uniforms[key]?.value;
                if (val && val.isTexture) {
                    val.dispose();
                }
            }
        }

        // 3. Libération du programme GPU du matériau
        mat.dispose();
    }

    /**
     * Libère un nœud Three.js individuel
     * @param {THREE.Object3D} node 
     */
    static disposeNode(node) {
        if (!node) return;

        // Nettoyage des listeners personnalisés s'ils existent
        if (node.eventListeners) node.eventListeners.length = 0;
        if (node.userData?.listeners) node.userData.listeners = null;

        // 1. Géométrie
        if (node.geometry) {
            node.geometry.dispose();
            node.geometry = null;
        }

        // 2. Matériaux (unique ou tableau multi-matériaux)
        if (node.material) {
            if (Array.isArray(node.material)) {
                for (const m of node.material) {
                    this.disposeMaterial(m);
                }
            } else {
                this.disposeMaterial(node.material);
            }
            node.material = null;
        }

        // 3. Squelettes et os (pour modèles articulés de personnages)
        if (node.skeleton) {
            node.skeleton.dispose();
            node.skeleton = null;
        }
    }

    /**
     * Purge récursivement un graphe de scène ou un groupe d'objets,
     * puis détache tous ses enfants.
     * @param {THREE.Object3D} root 
     */
    static purge(root) {
        if (!root) return;

        root.traverse((child) => {
            this.disposeNode(child);
        });

        while (root.children && root.children.length > 0) {
            const child = root.children[0];
            root.remove(child);
        }
    }
}
