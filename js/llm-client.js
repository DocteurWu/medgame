/**
 * llm-client.js — Client de requêtes LLM unifié et résilient
 * 
 * Centralise tous les appels vers le proxy LLM du jeu (patient virtuel, examens, classifications, etc.).
 * Gère :
 *   - Les timeouts de requêtes
 *   - Les tentatives (retries) avec backoff exponentiel (1s, 2s, 4s...)
 *   - La cascade de modèles (model fallback) en cas d'erreur persistante
 *   - Le support SSE pour le streaming
 */

class LLMClient {
    /**
     * Effectue un appel LLM avec gestion d'erreurs, retries, et cascade de modèles.
     * 
     * @param {Object} params
     * @param {Array<Object>} params.messages - Les messages pour la complétion (system, user, assistant)
     * @param {string} [params.model] - Le modèle principal demandé (optionnel)
     * @param {number} [params.maxTokens=300] - Limite de tokens
     * @param {number} [params.temperature=0.7] - Température de génération
     * @param {boolean} [params.stream=false] - Activer le streaming SSE
     * @param {AbortSignal} [params.signal] - Signal d'annulation externe
     * @param {function(string): void} [params.onToken] - Callback pour chaque token (en mode stream)
     * @param {number} [params.timeoutMs=30000] - Timeout global de la requête en ms
     * @param {number} [params.maxRetries=2] - Nombre max de retries par modèle
     * @param {string} [params.quotaKind='dialogue'] - Classe quota : 'dialogue' (compté)
     *   ou 'correction' (exempté du quota dialogue, budget propre, vrai LLM garanti)
     * @returns {Promise<string>} La réponse textuelle complète du LLM
     */
    static async request({
        messages,
        model,
        maxTokens = 300,
        temperature = 0.7,
        stream = false,
        signal,
        onToken,
        timeoutMs = 30000,
        maxRetries = 2,
        responseFormat = null,
        quotaKind = 'dialogue'
    }) {
        const endpoint = window.CONFIG?.LLM_API_URL || '/.netlify/functions/llm-proxy';
        const apiKey = window.CONFIG?.LLM_API_KEY || '';
        const defaultModel = window.CONFIG?.LLM_MODEL || 'deepseek-chat';

        // Modèle unique — Groq gère le fallback côté serveur
        const requestedModel = model || defaultModel;
        const modelsToTry = [
            requestedModel
        ].filter((m, idx, self) => self.indexOf(m) === idx);

        // Classe quota : 'dialogue' (compté au quota) ou 'correction' (vrai LLM
        // garanti même à quota épuisé, budget propre côté serveur).
        const kind = quotaKind === 'correction' ? 'correction' : 'dialogue';

        let lastError = null;

        // Pré-contrôle local (cookie 14j, zéro coût API) pour le dialogue anonyme.
        // Le serveur reste l'autorité finale ; ceci évite juste un appel condamné.
        if (kind === 'dialogue') {
            const pre = window.QuotaGuard?.preCheckSync?.();
            if (pre && pre.blocked) {
                const err = new Error('Quota de messages épuisé (contrôle local).');
                err.code = 'QUOTA_EXCEEDED';
                err.reason = pre.reason || 'anon_window';
                err.kind = kind;
                err.localOnly = true;
                throw err;
            }
        }

        for (const currentModel of modelsToTry) {
            let attempt = 0;
            while (attempt <= maxRetries) {
                // Si le signal global est déjà annulé, sortir immédiatement
                if (signal?.aborted) {
                    throw new DOMException('Request aborted by user', 'AbortError');
                }

                try {
                    // Sécurité : aucun appel direct. Tout passe par le proxy
                    // (Netlify en prod, MCP local en dev). Si le proxy est down,
                    // l'erreur est affichée explicitement (pas de fausse réponse locale).
                    const targetUrl = endpoint;
                    const targetKey = apiKey;
                    const targetModel = currentModel;

                    console.log(`[LLMClient] Cible : ${targetUrl} | Modèle : ${targetModel} (essai ${attempt + 1}/${maxRetries + 1})`);
                    
                    // Controller combiné pour le timeout
                    const timeoutController = new AbortController();
                    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

                    // Fusionner le signal utilisateur et le timeout
                    const combinedSignal = signal 
                        ? this._combineSignals(signal, timeoutController.signal)
                        : timeoutController.signal;

                    const response = await fetch(targetUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(targetKey ? { 'Authorization': `Bearer ${targetKey}` } : {}),
                            ...(window.QuotaGuard?.getUserTokenSync?.()
                                ? { 'X-User-Token': window.QuotaGuard.getUserTokenSync() }
                                : {})
                            // Pas de headers custom (HTTP-Referer/X-Title) : ils déclenchent
                            // un preflight CORS que le proxy local n'autorisait pas.
                        },
                        body: JSON.stringify({
                            model: targetModel,
                            messages,
                            stream,
                            // Plafond (et non plancher) : respecter la demande de l'appelant, bornée [50, 4000]
                            max_tokens: Math.min(Math.max(maxTokens || 300, 50), 4000),
                            temperature,
                            top_p: 0.95,
                            // Classe quota lue par le proxy (strippée avant forward upstream)
                            meta: { kind },
                            ...(responseFormat ? { response_format: responseFormat } : {})
                        }),
                        signal: combinedSignal
                    });

                    clearTimeout(timeoutId);

                    // Synchro des compteurs locaux depuis les headers du proxy
                    try { window.QuotaGuard?.syncFromHeaders?.(response.headers, kind); } catch (_) {}

                    if (!response.ok) {
                        let bodyText = '';
                        try { bodyText = await response.text(); } catch (_) {}
                        let detail = bodyText.slice(0, 400);
                        let quotaInfo = null;
                        try {
                            const j = JSON.parse(bodyText);
                            if (j.error) {
                                detail = typeof j.error === 'object'
                                    ? (j.error.message || JSON.stringify(j.error))
                                    : String(j.error);
                            }
                            if (j.code === 'QUOTA_EXCEEDED') {
                                quotaInfo = {
                                    reason: j.reason || 'quota',
                                    kind: j.kind || kind,
                                    limit: j.limit ?? null,
                                    remaining_day: j.remaining_day ?? null,
                                    remaining_week: j.remaining_week ?? null,
                                    email: j.email || null
                                };
                            }
                        } catch (_) {}
                        const hint = response.status === 401
                            ? ' → Clé API invalide ou expirée (vérifiez LLM_API_KEY dans votre .env)'
                            : response.status === 500 && /LLM_API_KEY/.test(detail)
                            ? ' → LLM_API_KEY manquante côté serveur (.env / Netlify env vars)'
                            : response.status === 403 ? ' → Origine non autorisée (ouvrez via http://localhost, pas file://)'
                            : response.status === 429 ? ' → Pic de charge (réessayez dans 1 min)'
                            : response.status === 402 && quotaInfo ? ' → Quota de messages épuisé'
                            : response.status === 400 && /whitelist/i.test(detail) ? ` → Modèle non whitelisté (${detail})`
                            : '';
                        const err = new Error(`HTTP ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ''}${hint} [endpoint: ${targetUrl}]`);
                        if (quotaInfo) {
                            // Quota épuisé : erreur typée, JAMAIS retryée (voir catch ci-dessous).
                            err.code = 'QUOTA_EXCEEDED';
                            err.reason = quotaInfo.reason;
                            err.kind = quotaInfo.kind;
                            err.remaining_day = quotaInfo.remaining_day;
                            err.remaining_week = quotaInfo.remaining_week;
                            err.contactEmail = quotaInfo.email;
                        }
                        throw err;
                    }

                    let fullText = '';
                    if (stream) {
                        fullText = await this._readStream(response, onToken, signal);
                    } else {
                        const data = await response.json();
                        fullText = data.choices?.[0]?.message?.content || '';
                    }

                    const trimmedText = fullText.trim();
                    if (!trimmedText) {
                        throw new Error('Réponse vide du modèle');
                    }

                    // Enregistrer le modèle fonctionnel dans la configuration globale
                    if (window.CONFIG) {
                        window.CONFIG.LLM_MODEL = targetModel;
                    }
                    return trimmedText;

                } catch (err) {
                    if (err.name === 'AbortError') {
                        // Si l'avortement vient du signal utilisateur, on s'arrête
                        if (signal?.aborted) {
                            throw err;
                        }
                        // Sinon c'est un timeout, on continue les essais/modèles
                        console.warn(`[LLMClient] Timeout atteint sur ${currentModel}`);
                    } else {
                        console.warn(`[LLMClient] Erreur lors de l'appel : ${err.message}`);
                    }

                    lastError = err;
                    // Échec immédiat sans retry sur erreur d'authentification (401/403)
                    // ou quota épuisé (402/QUOTA_EXCEEDED : réessayer ne servirait à rien
                    // et consommerait du budget ; la modale quota prend le relais).
                    if (err.code === 'QUOTA_EXCEEDED'
                        || (err.message && (err.message.includes('401') || err.message.includes('403')))) {
                        throw err;
                    }
                    attempt++;

                    // Backoff exponentiel avant le retry (1s, 2s, 4s...)
                    if (attempt <= maxRetries && !signal?.aborted) {
                        const delay = Math.pow(2, attempt - 1) * 1000;
                        console.log(`[LLMClient] Attente de ${delay}ms avant nouvel essai...`);
                        await new Promise(r => setTimeout(r, delay));
                    }
                }
            }
        }

        // Si on arrive ici, tous les modèles et retries ont échoué
        throw lastError || new Error('Tous les appels LLM ont échoué');
    }

    /**
     * Lit un stream SSE (Server-Sent Events)
     */
    static async _readStream(response, onToken, userSignal) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullText = '';
        let buffer = '';

        try {
            while (true) {
                if (userSignal?.aborted) {
                    reader.cancel();
                    throw new DOMException('Stream aborted by user', 'AbortError');
                }

                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Conserver la ligne incomplète

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]') continue;
                    if (!trimmed.startsWith('data: ')) continue;

                    try {
                        const json = JSON.parse(trimmed.slice(6));
                        const token = json.choices?.[0]?.delta?.content || '';
                        if (token) {
                            fullText += token;
                            if (onToken) onToken(token);
                        }
                    } catch (e) {
                        // Ignorer les erreurs d'analyse de ligne SSE
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        return fullText;
    }

    /**
     * Utilitaire pour combiner deux AbortSignals en un seul
     */
    static _combineSignals(signal1, signal2) {
        const controller = new AbortController();
        
        const onAbort = () => {
            controller.abort();
            cleanup();
        };

        const cleanup = () => {
            signal1.removeEventListener('abort', onAbort);
            signal2.removeEventListener('abort', onAbort);
        };

        if (signal1.aborted || signal2.aborted) {
            controller.abort();
            return controller.signal;
        }

        signal1.addEventListener('abort', onAbort);
        signal2.addEventListener('abort', onAbort);

        return controller.signal;
    }
}

window.LLMClient = LLMClient;
