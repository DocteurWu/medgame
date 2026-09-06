/**
 * MedGame Configuration
 * Global settings that apply across all pages
 */
const CONFIG = {
    MUSIC_ENABLED: 0,

    // Supabase Configuration
    SUPABASE_URL: 'https://jxhzjetxquimmkpzlfyh.supabase.co',
    SUPABASE_KEY: 'sb_publishable_Nqjp4eF3ytr3VDciqX8dvA_JhdVP0G0',

    // LLM — obligatoirement via un proxy serveur (aucune clé côté client).
    // Production : fonction Netlify. Dev local : proxy MCP (voir js/env.example.js).
    LLM_API_URL: window.__ENV__?.LLM_API_URL || '/.netlify/functions/llm-proxy',
    LLM_MODEL: window.__ENV__?.LLM_MODEL || 'deepseek-chat',
    LLM_MAX_TOKENS: 3000,
    LLM_TEMPERATURE: 0.85,
    LLM_TOP_P: 0.92,

    // Atlas 3D (Human Atlas / BodyParts3D) — streaming lazy-load, rien dans le repo en V1.
    ATLAS_ENABLED: 1,
    ATLAS_BASE_URL: window.__ENV__?.ATLAS_BASE_URL || 'https://cdn.jsdelivr.net/gh/ashemag/human-atlas@main/public/models',
    ATLAS_GZIP: true
};
window.CONFIG = CONFIG;


// Global Supabase Client Initialization
// We use a self-executing function to avoid polluting global scope while setting up the client
(function () {
    const { createClient } = window.supabase || {};

    if (typeof createClient === 'function') {
        window.supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    } else if (typeof window.createClient === 'function') {
        window.supabase = window.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    } else {
        // Supabase optionnel sur les pages autonomes (atlas, auscultation, etc.)
        // Proxy résilient pour éviter les erreurs console inutiles
        window.supabase = new Proxy({}, {
            get(target, prop) {
                if (prop === 'then' || prop === Symbol.toPrimitive || prop === 'toJSON') return undefined;
                return () => {
                    console.warn(`[Config] Supabase SDK non inclus sur cette page. L'appel à supabase.${String(prop)}() est ignoré.`);
                    return Promise.resolve({ data: null, error: new Error('Supabase SDK non chargé') });
                };
            }
        });
    }
})();
