/**
 * llm-cache.js — Cache LRU avec TTL pour les requêtes LLM
 * 
 * Permet de réduire la latence et d'économiser des tokens pour les questions répétées ou similaires.
 */

class LLMCache {
    /**
     * @param {number} maxEntries - Nombre maximum d'entrées dans le cache (ex: 50)
     * @param {number} ttlMs - Durée de vie d'une entrée en millisecondes (ex: 5 minutes = 300 000 ms)
     */
    constructor(maxEntries = 50, ttlMs = 300000) {
        this.maxEntries = maxEntries;
        this.ttlMs = ttlMs;
        /** @type {Map<string, {value: string, expiresAt: number}>} */
        this.cache = new Map();
    }

    /**
     * Calcule une clé de cache unique basée sur le system prompt (ou le cas) et la question.
     * @param {string} systemPrompt 
     * @param {string} question 
     * @returns {string} Clé de cache
     */
    _makeKey(systemPrompt, question) {
        const cleanPrompt = String(systemPrompt || '').trim();
        const cleanQ = String(question || '').trim().toLowerCase();
        
        // Un hash simple mais suffisant pour la comparaison de chaînes
        let hash = 0;
        const combined = cleanPrompt + '||' + cleanQ;
        for (let i = 0; i < combined.length; i++) {
            const chr = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convertir en entier 32 bits
        }
        return `llm_cache_${hash}`;
    }

    /**
     * Récupère une entrée du cache si elle existe et n'a pas expiré.
     * @param {string} systemPrompt 
     * @param {string} question 
     * @returns {string|null} Réponse cachée ou null
     */
    get(systemPrompt, question) {
        const key = this._makeKey(systemPrompt, question);
        const entry = this.cache.get(key);
        
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            // Expire
            this.cache.delete(key);
            return null;
        }

        // Actualise la position dans la Map pour l'aspect LRU (les plus récents à la fin)
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.value;
    }

    /**
     * Ajoute ou met à jour une entrée dans le cache.
     * @param {string} systemPrompt 
     * @param {string} question 
     * @param {string} responseText 
     */
    set(systemPrompt, question, responseText) {
        if (!responseText || !responseText.trim()) return;

        const key = this._makeKey(systemPrompt, question);
        
        // Si l'entrée existe déjà, on la retire d'abord
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxEntries) {
            // Supprimer la plus ancienne entrée (le premier élément de l'itérateur Map)
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            value: responseText,
            expiresAt: Date.now() + this.ttlMs
        });
    }

    /**
     * Vide complètement le cache.
     */
    clear() {
        this.cache.clear();
    }
}

// Instance globale prête à l'emploi
window.llmCache = new LLMCache(50, 300000);
window.LLMCache = LLMCache;
