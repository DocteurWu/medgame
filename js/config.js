/**
 * MedGame Configuration
 * Global settings that apply across all pages
 */
const CONFIG = {
    MUSIC_ENABLED: 0,

    // Supabase Configuration
    SUPABASE_URL: 'https://jxhzjetxquimmkpzlfyh.supabase.co',
    SUPABASE_KEY: 'sb_publishable_Nqjp4eF3ytr3VDciqX8dvA_JhdVP0G0',

    // LLM — Groq API (Llama 3.3, gratuit, rapide, stable)
    // Appel direct depuis le client — Groq supporte le CORS
    LLM_API_URL: window.__ENV__?.LLM_API_URL || 'https://api.groq.com/openai/v1/chat/completions',
    LLM_API_KEY: window.__ENV__?.LLM_API_KEY || '',
    LLM_MODEL: window.__ENV__?.LLM_MODEL || 'llama-3.3-70b-versatile',
    LLM_MAX_TOKENS: 220,
    LLM_TEMPERATURE: 0.85,
    LLM_TOP_P: 0.92
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
