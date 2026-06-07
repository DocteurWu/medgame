/**
 * MedGame Configuration
 * Global settings that apply across all pages
 */
// Détection environnement local
const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1' || 
     window.location.protocol === 'file:');

const localKey = window.__ENV__?.LLM_API_KEY;
const isLocalKeyValid = localKey && localKey !== 'sk-or-v1-...' && !localKey.includes('...');

const CONFIG = {
    // Music setting: 1 = enabled, 0 = disabled
    // Set to 0 to disable all background music (reduces server load)
    MUSIC_ENABLED: 0,

    // Supabase Configuration
    SUPABASE_URL: 'https://jxhzjetxquimmkpzlfyh.supabase.co',
    SUPABASE_KEY: 'sb_publishable_Nqjp4eF3ytr3VDciqX8dvA_JhdVP0G0',

    // LLM Chat API — OpenRouter via Netlify Proxy ou direct en local
    LLM_API_URL: (isLocalhost && isLocalKeyValid)
        ? 'https://openrouter.ai/api/v1/chat/completions'
        : '/api/llm/chat/completions',
    LLM_API_KEY: (isLocalhost && isLocalKeyValid)
        ? localKey
        : '',
    LLM_MODEL: window.__ENV__?.LLM_MODEL || 'openrouter/owl-alpha'
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
        console.error("Supabase SDK not found. Make sure to include the script tag.");
    }
})();
