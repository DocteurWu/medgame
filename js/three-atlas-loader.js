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

const DEFAULT_ATLAS_URL = 'https://cdn.jsdelivr.net/gh/ashemag/human-atlas@main/public/models';

function getBaseUrl() {
    const cfg = (typeof window !== 'undefined' && window.CONFIG) || {};
    return (cfg.ATLAS_BASE_URL || DEFAULT_ATLAS_URL).replace(/\/$/, '');
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

export async function fetchAtlasIndex(signal) {
    const url = `${getBaseUrl()}/atlas.json`;
    try {
        const blob = await offlineAssetCache.getOrFetchBlob(url);
        const text = await blob.text();
        return validateAtlas(JSON.parse(text));
    } catch {
        const res = await fetch(url, { signal });
        if (!res.ok) throw new Error(`atlas.json HTTP ${res.status} (${url}). Vérifiez ATLAS_BASE_URL / CORS.`);
        return validateAtlas(await res.json());
    }
}

/** Décode une réponse .bin.gz ou .bin en ArrayBuffer (port de app/model-download.ts). */
export async function decodeModelResponse(response, expectedBytes, compressed) {
    if (!compressed) return response.arrayBuffer();
    if (typeof DecompressionStream === 'undefined') {
        throw new Error('Navigateur sans DecompressionStream : passez ATLAS_GZIP=false ou utilisez un navigateur récent.');
    }
    const ds = new DecompressionStream('gzip');
    const stream = response.body.pipeThrough(ds);
    const buf = await new Response(stream).arrayBuffer();
    if (expectedBytes && buf.byteLength !== expectedBytes) {
        console.warn(`[Atlas] chunk ${buf.byteLength}o vs attendu ${expectedBytes}o (toléré).`);
    }
    return buf;
}

function chunkFileName(path) {
    return String(path || '').split('/').pop();
}

async function fetchChunkBuffer(chunk, signal) {
    const base = getBaseUrl();
    const gzip = useGzip() && !!chunk.gzip;
    const file = chunkFileName(gzip ? chunk.gzip : chunk.url);
    const fallbackFile = chunkFileName(chunk.url);
    const url = base + '/' + file;

    try {
        const blob = await offlineAssetCache.getOrFetchBlob(url);
        const res = new Response(blob);
        return decodeModelResponse(res, chunk.bytes, gzip);
    } catch {
        const res = await fetch(url, { signal });
        if (!res.ok) {
            // fallback .bin si le .gz manque
            if (gzip && fallbackFile !== file) {
                const fb = await fetch(base + '/' + fallbackFile, { signal });
                if (!fb.ok) throw new Error(`Chunk HTTP ${res.status} : ${url}`);
                return fb.arrayBuffer();
            }
            throw new Error(`Chunk HTTP ${res.status} : ${url}`);
        }
        return decodeModelResponse(res, chunk.bytes, gzip);
    }
}

/**
 * Charge tous les chunks avec concurrence limitée (3) + progression.
 * @param {object} atlas - atlas.json validé
 * @param {(loaded:number,total:number)=>void} onProgress
 * @param {AbortSignal} signal
 * @returns {ArrayBuffer[]} buffers indexés par chunk
 */
export async function fetchAtlasBuffers(atlas, onProgress, signal) {
    const total = atlas.chunks.length;
    const out = new Array(total);
    let done = 0;
    let cursor = 0;
    const workers = Array.from({ length: Math.min(3, total) }, async () => {
        while (cursor < total) {
            if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
            const i = cursor++;
            out[i] = await fetchChunkBuffer(atlas.chunks[i], signal);
            done++;
            try { onProgress?.(done, total); } catch {}
        }
    });
    await Promise.all(workers);
    return out;
}

export function getAtlasBaseUrl() {
    return getBaseUrl();
}
