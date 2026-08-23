/**
 * MedGame Environment Variables — Copiez ce fichier en env.js
 *
 * ⚠️ SÉCURITÉ : NE JAMAIS mettre de clé API ici — ce fichier est public (servi au navigateur).
 * Les clés vivent côté serveur :
 *  - Netlify : variable d'environnement LLM_API_KEY (Settings → Environment variables)
 *  - Proxy MCP local : variable d'environnement du process Node (port 8081)
 */
window.__ENV__ = {
  // Production Netlify (aucune clé requise côté client)
  LLM_API_URL: '/.netlify/functions/llm-proxy',
  LLM_MODEL: 'llama-3.3-70b-versatile',

  // Développement local : décommenter pour utiliser le proxy MCP local
  // LLM_API_URL: 'http://127.0.0.1:8081/llm-proxy',
};
