/**
 * offline-asset-cache.js — Gestionnaire de cache persistant hors-ligne haute performance
 * Stocke et sert les assets 3D lourds (.glb, .bin, textures, scans) via CacheStorage API.
 * Réduit à zéro les temps de re-téléchargement et élimine la latence réseau inter-sessions.
 */

/**
 * Normalise une clé de cache en URL absolue.
 *
 * Piège : CacheStorage stocke la clé résolue (« http://host/chemin.glb »)
 * alors que le code la demande souvent relative (« assets/… »). `cache.match`
 * ne fait PAS la résolution : la comparaison échoue et le cache est ignoré
 * silencieusement, ce qui conduit à re-télécharger puis, pour un GLB avec
 * textures, à rester bloqué jusqu'au timeout de loadGLBSmart.
 * On interroge donc toujours la forme absolue, et on tente aussi la forme
 * d'origine par sécurité (entrées posées manuellement).
 */
function toAbsoluteURL(url) {
    try {
        return new URL(url, typeof location !== 'undefined' ? location.href : undefined).href;
    } catch {
        return url;
    }
}

async function _matchCache(cache, url) {
    const abs = toAbsoluteURL(url);
    const direct = await cache.match(url);
    if (direct) return direct;
    if (abs !== url) {
        const viaAbs = await cache.match(abs);
        if (viaAbs) return viaAbs;
    }
    // Entrées historiquesOnt pu être stockées avec/sans query.
    try {
        const tolerant = await cache.match(abs, { ignoreSearch: true, ignoreVary: true });
        if (tolerant) return tolerant;
    } catch { /* options non supportées : sans conséquence */ }
    return null;
}

class OfflineAssetCache {
    constructor(cacheName = 'medgame-v1-assets') {
        this.cacheName = cacheName;
        this._isSupported = typeof caches !== 'undefined';
        this._cachePromise = this._isSupported ? caches.open(this.cacheName).catch(err => {
            console.warn('[OfflineAssetCache] Erreur ouverture CacheStorage:', err);
            return null;
        }) : Promise.resolve(null);
        this._inFlight = new Map();
        this._objectUrls = new Map();
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
            const match = await _matchCache(cache, url);
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
    async getOrFetchBlob(url, onProgress = null, timeoutMs = 40000) {
        if (this._inFlight.has(url)) {
            return this._inFlight.get(url);
        }

        const promise = this._executeFetchBlob(url, onProgress, timeoutMs);
        this._inFlight.set(url, promise);

        try {
            return await promise;
        } finally {
            this._inFlight.delete(url);
        }
    }

    async _executeFetchBlob(url, onProgress, timeoutMs = 40000) {
        if (this._isSupported) {
            try {
                const cache = await this._cachePromise;
                if (cache) {
                    const cachedResponse = await _matchCache(cache, url);
                    if (cachedResponse) {
                        const blob = await cachedResponse.blob();
                        if (onProgress) { try { onProgress(1); } catch {} }
                        return blob;
                    }
                }
            } catch (err) {
                console.warn('[OfflineAssetCache] Lecture cache échouée, bascule réseau:', err);
            }
        }

        // Borne le réseau : un serveur qui accepte la connexion mais ne répond
        // jamais bloquait le chargement pendant 90 s (cas réel observé sur un
        // GLB de 157 Ko). `fetch` n'a pas de timeout natif — on en pose un.
        const controller = new AbortController();
        const fetchTimer = setTimeout(() => controller.abort(), timeoutMs);
        let response;
        try {
            response = await fetch(url, { signal: controller.signal });
        } finally {
            clearTimeout(fetchTimer);
        }
        if (!response.ok) {
            throw new Error(`[OfflineAssetCache] HTTP ${response.status} pour ${url}`);
        }

        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        let blob;

        if (onProgress && total > 0 && response.body && typeof ReadableStream !== 'undefined') {
            const reader = response.body.getReader();
            const chunks = [];
            let loaded = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                loaded += value.length;
                try { onProgress(loaded / total); } catch {}
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
                // Clé normalisée en URL absolue : c'est ce que le navigateur
                // ré-resout à chaque fetch, et la forme que _matchCache interroge.
                cache.put(toAbsoluteURL(url), new Response(blob.slice(), { headers })).catch(err => {
                    console.warn('[OfflineAssetCache] Erreur écriture cache pour', url, err);
                });
            });
        }

        return blob;
    }

    async getOrFetchUrl(url, onProgress = null, timeoutMs = 40000) {
        if (this._objectUrls.has(url)) {
            return this._objectUrls.get(url);
        }
        const blob = await this.getOrFetchBlob(url, onProgress, timeoutMs);
        const objUrl = URL.createObjectURL(blob);
        this._objectUrls.set(url, objUrl);
        return objUrl;
    }

    async getOrFetchBuffer(url, onProgress = null, timeoutMs = 40000) {
        const blob = await this.getOrFetchBlob(url, onProgress, timeoutMs);
        return blob.arrayBuffer();
    }

    async clear() {
        // Libérer les Object URLs allouées en mémoire
        for (const objUrl of this._objectUrls.values()) {
            try { URL.revokeObjectURL(objUrl); } catch (_) {}
        }
        this._objectUrls.clear();

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
