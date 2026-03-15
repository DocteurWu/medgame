/**
 * MedGame Configuration
 * Global settings that apply across all pages
 */
const CONFIG = {
    // Music setting: 1 = enabled, 0 = disabled
    // Set to 0 to disable all background music (reduces server load)
    MUSIC_ENABLED: 0,

    // Supabase Configuration
    SUPABASE_URL: 'https://jxhzjetxquimmkpzlfyh.supabase.co',
    SUPABASE_KEY: 'sb_publishable_Nqjp4eF3ytr3VDciqX8dvA_JhdVP0G0'
};

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
