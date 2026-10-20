/**
 * test/helpers/glb.mjs — Inspection structurelle des conteneurs GLB (glTF binaire)
 *
 * Pourquoi un inspecteur plutôt qu'une assertion sur le poids en octets ?
 * Un modèle 3D est optimisé (Draco, quantification des positions, suppression des
 * doublons) : le poids n'est pas une mesure de complétude. Un rein-detail.glb
 * compressé peut peser 250 Ko tout en contenant 40 maillages, alors qu'un stub
 * de 260 Ko ne contient qu'un cube. Ce qui distingue réellement un modèle
 * complet d'un placeholder, c'est sa STRUCTURE : le nombre de maillages et le
 * nombre de sommets.
 *
 * Format GLB (spécification glTF 2.0) :
 *   octets 0-3   magic 0x46546C67 ("glTF")
 *   octets 4-7   version (2)
 *   octets 8-11  longueur totale
 *   octets 12-15 longueur du chunk JSON
 *   octets 16-19 type du chunk JSON (0x4E4F534A)
 *   octets 20..  contenu JSON
 */

import fs from 'node:fs';

const GLB_MAGIC = 0x46546C67; // "glTF"
const CHUNK_TYPE_JSON = 0x4E4F534A;

/**
 * Lit un GLB et retourne sa structure : nombre de maillages, de nœuds,
 * d'accesseurs, et nombre total de sommets (somme des accesseurs POSITION).
 *
 * @param {string} filePath chemin absolu du .glb
 * @returns {{meshes: number, nodes: number, accessors: number, vertices: number, triangles: number, json: object}}
 */
export function inspectGLB(filePath) {
    const buf = fs.readFileSync(filePath);

    if (buf.length < 20) {
        throw new Error(`${filePath} : trop court pour être un GLB (${buf.length} octets)`);
    }
    if (buf.readUInt32LE(0) !== GLB_MAGIC) {
        throw new Error(`${filePath} : magic invalide, ce n'est pas un conteneur GLB`);
    }

    const version = buf.readUInt32LE(4);
    if (version !== 2) {
        throw new Error(`${filePath} : version glTF ${version} non supportée (attendu 2)`);
    }

    const chunkLength = buf.readUInt32LE(12);
    const chunkType = buf.readUInt32LE(16);
    if (chunkType !== CHUNK_TYPE_JSON) {
        throw new Error(`${filePath} : le premier chunk n'est pas du JSON`);
    }

    const json = JSON.parse(buf.toString('utf8', 20, 20 + chunkLength));

    // Sommets : somme des accesseurs de type POSITION référencés par les primitives.
    const accessors = json.accessors || [];
    let vertices = 0;
    let triangles = 0;
    for (const mesh of json.meshes || []) {
        for (const prim of mesh.primitives || []) {
            const posIndex = prim.attributes?.POSITION;
            if (typeof posIndex === 'number' && accessors[posIndex]) {
                vertices += accessors[posIndex].count || 0;
            }
            const idxIndex = prim.indices;
            if (typeof idxIndex === 'number' && accessors[idxIndex]) {
                triangles += Math.floor((accessors[idxIndex].count || 0) / 3);
            }
        }
    }

    return {
        meshes: (json.meshes || []).length,
        nodes: (json.nodes || []).length,
        accessors: accessors.length,
        vertices,
        triangles,
        json
    };
}
