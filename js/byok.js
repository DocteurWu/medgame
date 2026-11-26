/**
 * byok.js — Bring Your Own Key.
 *
 * Permet à l'utilisateur de brancher sa propre clé API (DeepSeek, OpenAI,
 * Groq, Mistral, tout endpoint compatible OpenAI) au lieu du proxy MedGame.
 *
 * La clé est stockée uniquement dans le localStorage de son navigateur.
 * Elle n'est jamais envoyée à un serveur MedGame : seuls les appels au
 * fournisseur choisi la transportent.
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'medgame_byok_v1';

    var DEFAULTS = {
        baseUrl: 'https://api.deepseek.com/v1/chat/completions',
        model: 'deepseek-chat'
    };

    var PROVIDERS = [
        { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
        { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
        { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
        { id: 'mistral', label: 'Mistral', baseUrl: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-small-latest' },
        { id: 'custom', label: 'Autre (compatible OpenAI)', baseUrl: '', model: '' }
    ];

    function read() {
        try {
            var raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            return {
                enabled: parsed.enabled !== false,
                key: typeof parsed.key === 'string' ? parsed.key : '',
                baseUrl: typeof parsed.baseUrl === 'string' && parsed.baseUrl ? parsed.baseUrl : DEFAULTS.baseUrl,
                model: typeof parsed.model === 'string' && parsed.model ? parsed.model : DEFAULTS.model
            };
        } catch (e) {
            return null;
        }
    }

    function write(cfg) {
        try {
            if (!cfg) {
                window.localStorage.removeItem(STORAGE_KEY);
                return true;
            }
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
            return true;
        } catch (e) {
            return false;
        }
    }

    function trimUrl(url) {
        return String(url || '').trim().replace(/\s+/g, '');
    }

    window.BYOK = {
        PROVIDERS: PROVIDERS,
        DEFAULTS: DEFAULTS,

        /** Configuration enregistrée, ou null. */
        get: read,

        /** Configuration utilisable pour un appel (clé non vide). */
        getActive: function () {
            var cfg = read();
            if (!cfg || !cfg.enabled || !cfg.key) return null;
            return cfg;
        },

        isActive: function () {
            return this.getActive() !== null;
        },

        /**
         * Enregistre la configuration.
         * @param {{key:string, baseUrl?:string, model?:string, enabled?:boolean}} cfg
         * @returns {{ok:boolean, error?:string}}
         */
        save: function (cfg) {
            var key = String((cfg && cfg.key) || '').trim();
            if (!key) return { ok: false, error: 'Clé vide.' };
            var baseUrl = trimUrl(cfg.baseUrl) || DEFAULTS.baseUrl;
            if (!/^https?:\/\//i.test(baseUrl)) {
                return { ok: false, error: 'L\'adresse doit commencer par http:// ou https://' };
            }
            var model = String(cfg.model || '').trim() || DEFAULTS.model;
            var stored = write({ enabled: cfg.enabled !== false, key: key, baseUrl: baseUrl, model: model });
            return stored ? { ok: true } : { ok: false, error: 'Stockage du navigateur indisponible.' };
        },

        clear: function () {
            return write(null);
        },

        /** Valeur masquée pour l'affichage : sk-…abcd */
        mask: function (key) {
            var k = String(key || '');
            if (k.length <= 8) return k ? '••••' : '';
            return k.slice(0, 4) + '…' + k.slice(-4);
        },

        /**
         * Teste la clé avec un appel minimal.
         * @returns {Promise<{ok:boolean, message:string}>}
         */
        test: function (cfg) {
            var conf = cfg || read();
            if (!conf || !conf.key) {
                return Promise.resolve({ ok: false, message: 'Aucune clé enregistrée.' });
            }
            var controller = new AbortController();
            var timer = setTimeout(function () { controller.abort(); }, 20000);
            return fetch(conf.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + conf.key
                },
                body: JSON.stringify({
                    model: conf.model,
                    messages: [{ role: 'user', content: 'Réponds uniquement par OK.' }],
                    max_tokens: 5,
                    temperature: 0
                }),
                signal: controller.signal
            }).then(function (res) {
                clearTimeout(timer);
                if (res.ok) {
                    return res.json().then(function (data) {
                        var txt = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
                        return { ok: true, message: 'Clé valide. Réponse du modèle : ' + (txt.trim() || '(vide)') };
                    });
                }
                return res.text().then(function (body) {
                    var detail = body.slice(0, 200);
                    if (res.status === 401) return { ok: false, message: 'Clé refusée (401). Vérifiez la clé.' };
                    if (res.status === 404) return { ok: false, message: 'Modèle ou adresse introuvable (404). Vérifiez le modèle et l\'URL.' };
                    if (res.status === 429) return { ok: false, message: 'Quota ou débit dépassé (429).' };
                    return { ok: false, message: 'Erreur ' + res.status + ' : ' + detail };
                });
            }).catch(function (err) {
                clearTimeout(timer);
                if (err && err.name === 'AbortError') {
                    return { ok: false, message: 'Délai dépassé (20 s).' };
                }
                return { ok: false, message: 'Appel impossible : ' + ((err && err.message) || 'réseau bloqué ou CORS refusé par le fournisseur') };
            });
        }
    };

    /** Changement notifié pour que les interfaces se rafraîchissent. */
    window.dispatchEvent(new CustomEvent('byok:ready'));
})();
