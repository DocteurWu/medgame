/**
 * netlify/functions/llm-proxy.js — Proxy LLM sécurisé
 *
 * Protections implémentées :
 *  - CORS restrictif (origine + Referer vérifiés)
 *  - Rate-limit par IP (60 req/min)
 *  - Whitelist de modèles
 *  - Cap max_tokens (4000) et messages (30), longueur contenu (8000 chars)
 *  - Forwarding body épuré : seuls les champs autorisés passent
 *  - Pas d'API key exposée côté client
 */

const rateLimitMap = new Map();
const RATE_LIMIT = 60;        // requêtes par fenêtre
const RATE_WINDOW_MS = 60000; // 1 minute

const ALLOWED_ORIGINS = [
    'https://medgame.app',
    'https://medgame.netlify.app',
    'http://localhost',
    'http://127.0.0.1'
];

const WHITELISTED_MODELS = new Set([
    'qwen/qwen3-27b',
    'qwen/qwen3-235b-a22b:free',
    'qwen/qwen3-30b-a3b:free',
    'qwen/qwen-2.5-72b-instruct:free',
    'openai/gpt-4o-mini',
    'google/gemini-2.5-flash',
    'deepseek/deepseek-r1-distill-llama-70b:free',
    'deepseek/deepseek-chat-v3-0324:free',
]);

const MAX_TOKENS_CAP = 4000;
const MAX_MESSAGES = 30;
const MAX_CONTENT_LENGTH = 8000;

// ── Rate-limiting par IP ────────────────────────────────────────────────────
function checkRateLimit(ip) {
    const now = Date.now();
    // Nettoyage lazy des entrées expirées
    if (rateLimitMap.size > 5000) {
        for (const [key, val] of rateLimitMap.entries()) {
            if (now > val.resetTime) rateLimitMap.delete(key);
        }
    }
    let entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetTime) {
        entry = { count: 1, resetTime: now + RATE_WINDOW_MS };
        rateLimitMap.set(ip, entry);
        return true;
    }
    entry.count++;
    return entry.count <= RATE_LIMIT;
}

// ── Helper réponse JSON ─────────────────────────────────────────────────────
function jsonError(msg, status, corsHeaders) {
    return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
}

// ── Entrée principale ───────────────────────────────────────────────────────
export default async (request, context) => {
    const origin = request.headers.get('origin') || '';
    const referer = request.headers.get('referer') || '';

    // CORS : vérifier origine et referer parmi les domaines autorisés
    const isAllowedOrigin = ALLOWED_ORIGINS.some(o =>
        origin === o || origin.startsWith(o) ||
        // Netlify Deploy Previews : *.netlify.app
        (origin.endsWith('.netlify.app') && origin.includes('medgame'))
    );
    const isAllowedReferer = !referer || ALLOWED_ORIGINS.some(o => referer.startsWith(o)) ||
        (referer.includes('netlify.app') && referer.includes('medgame')) ||
        referer.startsWith('http://localhost') || referer.startsWith('http://127.0.0.1');

    const corsHeaders = {
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'https://medgame.app',
        'Vary': 'Origin'
    };

    // OPTIONS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Seul POST accepté
    if (request.method !== 'POST') {
        return jsonError('Method Not Allowed', 405, corsHeaders);
    }

    // Refuser les requêtes d'origines inconnues (hors navigateur = curl, scripts)
    if (!isAllowedOrigin && !isAllowedReferer) {
        console.warn(`[Proxy] Requête bloquée — origine non autorisée: "${origin}" referer: "${referer}"`);
        return jsonError('Forbidden', 403, corsHeaders);
    }

    // Rate-limiting
    const ip = (request.headers.get('x-forwarded-for') || context?.ip || 'unknown').split(',')[0].trim();
    if (!checkRateLimit(ip)) {
        console.warn(`[Proxy] Rate-limit atteint — IP: ${ip}`);
        return jsonError('Too Many Requests', 429, corsHeaders);
    }

    try {
        let body;
        try {
            body = await request.json();
        } catch {
            return jsonError('Invalid JSON body', 400, corsHeaders);
        }

        // ── Validation des champs ──────────────────────────────────────────

        // Modèle
        if (body.model && !WHITELISTED_MODELS.has(body.model)) {
            return jsonError(`Model '${body.model}' is not whitelisted.`, 400, corsHeaders);
        }

        // max_tokens
        if (body.max_tokens && (typeof body.max_tokens !== 'number' || body.max_tokens > MAX_TOKENS_CAP)) {
            return jsonError(`max_tokens doit être un nombre ≤ ${MAX_TOKENS_CAP}.`, 400, corsHeaders);
        }

        // messages
        if (!Array.isArray(body.messages) || body.messages.length === 0) {
            return jsonError('messages doit être un tableau non vide.', 400, corsHeaders);
        }
        if (body.messages.length > MAX_MESSAGES) {
            return jsonError(`messages length > ${MAX_MESSAGES}.`, 400, corsHeaders);
        }
        for (const msg of body.messages) {
            if (!msg || typeof msg !== 'object') return jsonError('Message invalide.', 400, corsHeaders);
            if (!['system', 'user', 'assistant'].includes(msg.role)) {
                return jsonError(`Rôle de message non autorisé : ${msg.role}`, 400, corsHeaders);
            }
            const content = typeof msg.content === 'string' ? msg.content
                : Array.isArray(msg.content) ? msg.content.map(c => c.text || '').join('') : '';
            if (content.length > MAX_CONTENT_LENGTH) {
                return jsonError(`Contenu d'un message > ${MAX_CONTENT_LENGTH} chars.`, 400, corsHeaders);
            }
        }

        // ── Construire un corps épuré (whitelist de champs) ────────────────
        const safeBody = {
            model: body.model,
            messages: body.messages.map(m => ({ role: m.role, content: m.content })),
            temperature: typeof body.temperature === 'number' ? Math.min(2, Math.max(0, body.temperature)) : 0.7,
            max_tokens: body.max_tokens || 800,
            stream: body.stream === true
        };
        if (body.top_p !== undefined) safeBody.top_p = Math.min(1, Math.max(0, body.top_p));

        // ── Appel upstream ─────────────────────────────────────────────────
        const llmUrl = process.env.LLM_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
        const apiKey = process.env.LLM_API_KEY;
        if (!apiKey) {
            console.error('[Proxy] LLM_API_KEY manquante');
            return jsonError('LLM_API_KEY non configurée côté serveur.', 500, corsHeaders);
        }

        console.info(`[Proxy] ip=${ip} model=${safeBody.model} msgs=${safeBody.messages.length} tokens=${safeBody.max_tokens}`);

        const upstream = await fetch(llmUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://medgame.netlify.app',
                'X-Title': 'MedGame'
            },
            body: JSON.stringify(safeBody)
        });

        if (!upstream.ok) {
            const errText = await upstream.text().catch(() => '');
            console.error(`[Proxy] Erreur upstream ${upstream.status}: ${errText.slice(0, 200)}`);
        }

        return new Response(upstream.body, {
            status: upstream.status,
            headers: {
                'Content-Type': upstream.headers.get('Content-Type') || 'text/event-stream',
                'Cache-Control': 'no-cache, no-store',
                'X-Content-Type-Options': 'nosniff',
                ...corsHeaders
            }
        });

    } catch (err) {
        console.error('[Proxy] Erreur inattendue:', err);
        return jsonError(err.message || 'Internal Server Error', 500, corsHeaders);
    }
};
