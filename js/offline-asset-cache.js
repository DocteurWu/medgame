/**
 * offline-asset-cache.js — Gestionnaire de cache persistant hors-ligne haute performance
 * Stocke et sert les assets 3D lourds (.glb, .bin, textures, scans) via CacheStorage API.
 * Réduit à zéro les temps de re-téléchargement et élimine la latence réseau inter-sessions.
 */

export class OfflineAssetCache {
    constructor(cacheName = 'medgame-v1-assets') {
        this.cacheName = cacheName;
        this._isSupported = typeof caches !== 'undefined';
        this._cachePromise = this._isSupported ? caches.open(this.cacheName).catch(err => {
            console.warn('[OfflineAssetCache] Erreur ouverture CacheStorage:', err);
            return null;
        }) : Promise.resolve(null);
        this._inFlight = new Map();
    }

    /**
     * Vérifie si un asset est déjà disponible localement dans le cache.
     * @param {string} url 
     * @returns {Promise<boolean>}
     */
    async has(url) {
        if (!this._isSupported) return false;
        try {
            const cache = await this._cachePromise;
            if (!cache) return false;
            const match = await cache.match(url);
            return Boolean(match);
        } catch {
            return false;
        }
    }

    /**
     * Récupère un asset sous forme de Blob, depuis le cache si présent,
     * ou via le réseau en l'enregistrant silencieusement en tâche de fond.
     * @param {string} url 
     * @param {Function} [onProgress] - callback(pct: 0..1)
     * @returns {Promise<Blob>}
     */
    async getOrFetchBlob(url, onProgress = null) {
        if (this._inFlight.has(url)) {
            return this._inFlight.get(url);
        }

        const promise = this._executeFetchBlob(url, onProgress);
        this._inFlight.set(url, promise);

        try {
            return await promise;
        } finally {
            this._inFlight.delete(url);
        }
    }

    async _executeFetchBlob(url, onProgress) {
        if (this._isSupported) {
            try {
                const cache = await this._cachePromise;
                if (cache) {
                    const cachedResponse = await cache.match(url);
                    if (cachedResponse) {
                        return await cachedResponse.blob();
                    }
                }
            } catch (err) {
                console.warn('[OfflineAssetCache] Lecture cache échouée, bascule réseau:', err);
            }
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`[OfflineAssetCache] HTTP ${response.status} pour ${url}`);
        }

        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        let blob;

        if (total > 0 && response.body && typeof ReadableStream !== 'undefined') {
            const reader = response.body.getReader();
            const chunks = [];
            let loaded = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                loaded += value.length;
                if (onProgress) {
                    try { onProgress(loaded / total); } catch {}
                }
            }
            blob = new Blob(chunks);
        } else {
            blob = await response.blob();
            if (onProgress) {
                try { onProgress(1); } catch {}
            }
        }

        if (this._isSupported) {
            this._cachePromise.then(cache => {
                if (!cache) return;
                const headers = new Headers(response.headers);
                cache.put(url, new Response(blob.slice(), { headers })).catch(err => {
                    console.warn('[OfflineAssetCache] Erreur écriture cache pour', url, err);
                });
            });
        }

        return blob;
    }

    async getOrFetchUrl(url, onProgress = null) {
        const blob = await this.getOrFetchBlob(url, onProgress);
        return URL.createObjectURL(blob);
    }

    async getOrFetchBuffer(url, onProgress = null) {
        const blob = await this.getOrFetchBlob(url, onProgress);
        return blob.arrayBuffer();
    }

    async clear() {
        if (!this._isSupported) return;
        try {
            await caches.delete(this.cacheName);
            this._cachePromise = caches.open(this.cacheName);
        } catch (err) {
            console.warn('[OfflineAssetCache] Erreur clear cache:', err);
        }
    }
}

export const offlineAssetCache = new OfflineAssetCache();
