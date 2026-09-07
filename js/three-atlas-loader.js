/**
 * three-atlas-loader.js — Chargement lazy des données Human Atlas / BodyParts3D.
 * V1 : streaming depuis ATLAS_BASE_URL (défaut jsDelivr GitHub, CORS *), rien dans le repo.
 * - fetch atlas.json (index : parts, concepts, chunks)
 * - fetch // gunzip des body-*.bin(.gz) avec DecompressionStream + fallback .bin
 * - progress %, abort, erreurs propres. Données brutes seules : la DA reste MedGame.
 * Note : les chemins de chunks dans atlas.json sont absolus (/models/...) côté Vercel ;
 * on ne garde que le nom de fichier pour rester compatible avec tout miroir (Vercel, jsDelivr, local).
 */

import { offlineAssetCache } from './offline-asset-cache.js';

export const ATLAS_SOURCES = {
    male: {
        id: 'male',
        name: 'Homme (Standard)',
        shortName: 'Homme',
        icon: 'fa-mars',
        sex: 'male',
        isExperimental: false,
        baseUrl: 'https://cdn.jsdelivr.net/gh/ashemag/human-atlas@main/public/models',
        description: 'Référence anatomique masculine BodyParts3D 4.0 (2 234 structures, 15 systèmes). Modèle complet et stable.',
        approxSize: '~33 Mo',
        repoUrl: 'https://github.com/ashemag/human-atlas'
    },
    female: {
        id: 'female',
        name: 'Femme (Expérimental ⚠️)',
        shortName: 'Femme ⚠️',
        icon: 'fa-venus',
        sex: 'female',
        isExperimental: true,
        baseUrl: 'https://cdn.jsdelivr.net/gh/HiMahendraBeniwal/female-atlas@main/public/models',
        description: 'Modèle anatomique féminin v2.0 (3 004 structures, 16 systèmes incluant organes reproducteurs féminins et gestation). Attention : version expérimentale de recherche, certaines structures peuvent être incomplètes, imprécises ou comporter des artefacts visuels.',
        approxSize: '~54 Mo',
        repoUrl: 'https://github.com/HiMahendraBeniwal/female-atlas'
    }
};

export function getAtlasSource(id = 'male') {
    return ATLAS_SOURCES[id] || ATLAS_SOURCES.male;
}

export function getBaseUrl(modelId = 'male') {
    const cfg = (typeof window !== 'undefined' && window.CONFIG) || {};
    if (cfg.ATLAS_BASE_URL && modelId === 'male') return cfg.ATLAS_BASE_URL.replace(/\/$/, '');
    const source = getAtlasSource(modelId);
    return source.baseUrl.replace(/\/$/, '');
}

function useGzip() {
    const cfg = (typeof window !== 'undefined' && window.CONFIG) || {};
    return cfg.ATLAS_GZIP !== false;
}

/** validation minimale du schéma atlas.json */
export function validateAtlas(atlas) {
    if (!atlas || !Array.isArray(atlas.parts) || !Array.isArray(atlas.chunks)) {
        throw new Error('Atlas invalide : parts/chunks manquants.');
    }
    if (!atlas.parts.length || !atlas.chunks.length) throw new Error('Atlas vide.');
    return atlas;
}

export async function fetchAtlasIndex(modelIdOrSignal, maybeSignal) {
    let modelId = 'male';
    let signal = maybeSignal;
    if (typeof modelIdOrSignal === 'string') {
        modelId = modelIdOrSignal;
    } else if (modelIdOrSignal && typeof modelIdOrSignal === 'object') {
        signal = modelIdOrSignal;
    }
    const url = `${getBaseUrl(modelId)}/atlas.json`;
    try {
        const blob = await offlineAssetCache.getOrFetchBlob(url);
        const text = await blob.text();
        return validateAtlas(JSON.parse(text));
    } catch {
        const res = await fetch(url, { signal });
        if (!res.ok) throw new Error(`atlas.json HTTP ${res.status} (${url}). Vérifiez la source / CORS.`);
        return validateAtlas(await res.json());
    }
}

/** Décode une réponse .bin.gz ou .bin en ArrayBuffer (port de app/model-download.ts). */
export async function decodeModelResponse(response, expectedBytes, compressed) {
    if (!compressed) return response.arrayBuffer();
    if (typeof DecompressionStream === 'undefined') {
        throw new Error('Navigateur sans DecompressionStream : passez ATLAS_GZIP=false ou utilisez un navigateur récent.');
    }
    try {
        const ds = new DecompressionStream('gzip');
        const stream = response.body.pipeThrough(ds);
        const buf = await new Response(stream).arrayBuffer();
        if (expectedBytes && buf.byteLength !== expectedBytes) {
            console.warn(`[Atlas] chunk ${buf.byteLength}o vs attendu ${expectedBytes}o (toléré).`);
        }
        return buf;
    } catch (err) {
        console.warn('[Atlas] Fallback décompression gzip:', err);
        return response.arrayBuffer();
    }
}

function chunkFileName(path) {
    return String(path || '').split('/').pop();
}

async function fetchChunkBuffer(chunk, modelId = 'male', signal) {
    const base = getBaseUrl(modelId);
    const gzip = useGzip() && !!chunk.gzip;
    const file = chunkFileName(gzip ? chunk.gzip : chunk.url);
    const fallbackFile = chunkFileName(chunk.url);
    const url = base + '/' + file;

    let res;
    try {
        res = await fetch(url, { signal });
        if (!res.ok && gzip && fallbackFile !== file) {
            res = await fetch(base + '/' + fallbackFile, { signal });
        }
    } catch (e) {
        if (gzip && fallbackFile !== file) {
            res = await fetch(base + '/' + fallbackFile, { signal });
        } else {
            throw e;
        }
    }
    if (!res || !res.ok) {
        throw new Error(`Chunk HTTP ${res ? res.status : 'ERR'} : ${url}`);
    }
    return decodeModelResponse(res, chunk.bytes, gzip);
}

/**
 * Charge tous les chunks avec concurrence limitée (3) + progression.
 * @param {object} atlas - atlas.json validé
 * @param {(loaded:number,total:number)=>void} onProgress
 * @param {AbortSignal} signal
 * @param {string} [modelId='male']
 * @returns {ArrayBuffer[]} buffers indexés par chunk
 */
export async function fetchAtlasBuffers(atlas, onProgress, signal, modelId = 'male') {
    const total = atlas.chunks.length;
    const out = new Array(total);
    let done = 0;
    let cursor = 0;
    const workers = Array.from({ length: Math.min(3, total) }, async () => {
        while (cursor < total) {
            if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
            const i = cursor++;
            out[i] = await fetchChunkBuffer(atlas.chunks[i], modelId, signal);
            done++;
            try { onProgress?.(done, total); } catch {}
        }
    });
    await Promise.all(workers);
    return out;
}

export function getAtlasBaseUrl(modelId = 'male') {
    return getBaseUrl(modelId);
}
