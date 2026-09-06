/**
 * MedGame Environment Variables
 *
 * ⚠️ SÉCURITÉ : NE JAMAIS mettre de clé API dans ce fichier.
 * Ce fichier est servi tel quel au navigateur : tout ce qui y est écrit est public.
 *
 * Les appels LLM passent obligatoirement par un proxy serveur :
 *  - Production (Netlify) : /.netlify/functions/llm-proxy  (clé = variable d'environnement LLM_API_KEY)
 *  - Développement local  : proxy MCP local (http://127.0.0.1:8081/llm-proxy, clé = .env LLM_API_KEY)
 */
(function () {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '';

    window.__ENV__ = {
        // Proxy serveur selon l'environnement (auto-détecté)
        LLM_API_URL: isLocal
            ? 'http://127.0.0.1:8081/llm-proxy'
            : '/.netlify/functions/llm-proxy',

        // DeepSeek (le proxy sert de relais avec la clé côté serveur)
        LLM_MODEL: 'deepseek-chat',
    };
})();
