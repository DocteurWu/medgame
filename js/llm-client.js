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
        maxRetries = 2
    }) {
        const endpoint = window.CONFIG?.LLM_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
        const apiKey = window.CONFIG?.LLM_API_KEY || '';
        const defaultModel = window.CONFIG?.LLM_MODEL || 'llama-3.3-70b-versatile';

        // Modèle unique — Groq gère le fallback côté serveur
        const requestedModel = model || defaultModel;
        const modelsToTry = [
            requestedModel
        ].filter((m, idx, self) => self.indexOf(m) === idx);

        let lastError = null;
        let isProxyOffline = false;

        for (const currentModel of modelsToTry) {
            let attempt = 0;
            while (attempt <= maxRetries) {
                // Si le signal global est déjà annulé, sortir immédiatement
                if (signal?.aborted) {
                    throw new DOMException('Request aborted by user', 'AbortError');
                }

                try {
                    // Determine URL, Key, and Model (fallback to backup direct OpenRouter if proxy is offline)
                    let targetUrl = endpoint;
                    let targetKey = apiKey;
                    let targetModel = currentModel;

                    if (isProxyOffline && window.__ENV__?.LLM_API_KEY_BACKUP) {
                        targetUrl = window.__ENV__.LLM_API_URL_BACKUP;
                        targetKey = window.__ENV__.LLM_API_KEY_BACKUP;
                        targetModel = window.__ENV__.LLM_MODEL_BACKUP || 'tencent/hy3:free';
                    }

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
                            'HTTP-Referer': window.location.origin || 'http://localhost',
                            'X-Title': 'MedGame'
                        },
                        body: JSON.stringify({
                            model: targetModel,
                            messages,
                            stream,
                            max_tokens: Math.max(maxTokens || 3000, 3000),
                            temperature,
                            top_p: 0.95,
                            reasoning: {
                                exclude: true
                            }
                        }),
                        signal: combinedSignal
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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

                    // Si le proxy local échoue (erreur réseau ou HTTP status non-OK), basculer sur l'API directe
                    if (!isProxyOffline && window.__ENV__?.LLM_API_KEY_BACKUP) {
                        console.warn(`[LLMClient] Local MCP proxy error (${err.message}). Swapping to direct OpenRouter API backup...`);
                        isProxyOffline = true;
                        attempt = 0; // reset attempts for the fallback
                        continue;
                    }

                    lastError = err;
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
