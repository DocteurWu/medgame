/**
 * netlify/functions/llm-proxy.js — Proxy LLM sécurisé
 *
 * Protections implémentées :
 *  - CORS restrictif (origine + Referer vérifiés)
 *  - Rate-limit par IP en mémoire (60 req/min, anti-burst)
 *  - GARDE-FOU ABSOLU : 50 req/min tous utilisateurs (Supabase, atomique)
 *  - QUOTAS : anonymes 5/14j par IP hashée · connectés 20/j + 50/sem
 *             corrections (kind='correction') exemptées du quota dialogue
 *             mais soumises au global + à un budget propre (3/j anon, 10/j compte)
 *  - Whitelist de modèles
 *  - Cap max_tokens (4000) et messages (30), longueur contenu (16000 chars)
 *  - Forwarding body épuré : seuls les champs autorisés passent (meta strippé)
 *  - Pas d'API key exposée côté client, IP jamais stockée en clair (hash + sel)
 *
 * Codes d'erreur quota :
 *  - 429 GLOBAL_429      → burst global, retryable (backoff client OK)
 *  - 402 QUOTA_EXCEEDED  → quota épuisé, NON retryable (modale + mailto)
 */

const rateLimitMap = new Map();
const RATE_LIMIT = 60;        // requêtes par fenêtre et par IP (mémoire)
const RATE_WINDOW_MS = 60000; // 1 minute
// NOTE : ce rate-limit est en mémoire par instance (serverless = instances multiples).
// Le garde-fou ABSOLU (50/min global) est lui atomique via Supabase (llm_gate).

const GLOBAL_LIMIT = 50; // req/min tous utilisateurs — appliqué dans llm_gate (Supabase)

const ALLOWED_ORIGINS = new Set([
    'https://medgame.app',
    'https://medgame.netlify.app',
    'http://localhost',
    'http://localhost:8888',
    'http://localhost:8080',
    'http://127.0.0.1',
    'http://127.0.0.1:8888',
    'http://127.0.0.1:8080'
]);

// Modèles autorisés — IDs alignés sur les upstreams possibles (DeepSeek par défaut,
// Groq/OpenRouter si LLM_API_URL pointe vers eux). Un ID non supporté par
// l'upstream courant renverra l'erreur 400 de celui-ci.
const WHITELISTED_MODELS = new Set([
    // DeepSeek
    'deepseek-chat',
    'deepseek-reasoner',
    // Groq
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3-32b',
    // OpenRouter (si LLM_API_URL = https://openrouter.ai/api/v1/chat/completions)
    'qwen/qwen3-27b',
    'qwen/qwen3-235b-a22b:free',
    'qwen/qwen3-30b-a3b:free',
    'qwen/qwen-2.5-72b-instruct:free',
    'google/gemini-2.5-flash',
    'deepseek/deepseek-r1-distill-llama-70b:free',
    'deepseek/deepseek-chat-v3-0324:free',
]);

const MAX_TOKENS_CAP = 4000;
const MAX_MESSAGES = 30;
const MAX_CONTENT_LENGTH = 16000;

// Quotas (miroir de sql/003_llm_quotas.sql — la source de vérité est la RPC llm_gate)
const QUOTA_CONTACT_EMAIL = process.env.QUOTA_CONTACT_EMAIL || 'hamlat.louai@gmail.com';
// Clé anon publique (fallback) pour valider le JWT utilisateur ; la clé service_role
// (SUPABASE_SERVICE_ROLE_KEY) sert aux appels RPC llm_gate / log_llm_usage.
const SUPABASE_ANON_FALLBACK = 'sb_publishable_Nqjp4eF3ytr3VDciqX8dvA_JhdVP0G0';

// ── Rate-limiting par IP (mémoire, anti-burst) ────────────────────────────────
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
function jsonError(msg, status, corsHeaders, extra = {}) {
    return new Response(JSON.stringify({ error: msg, ...extra }), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
}

// ── Hash IP (SHA-256 ip + sel) — aucune IP en clair stockée ──────────────────
async function hashIp(ip) {
    const salt = process.env.QUOTA_SALT || 'medgame-quota-default-salt';
    const data = new TextEncoder().encode(`${salt}:${ip}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Supabase REST helpers (service_role, jamais exposé au client) ────────────
function supaCfg() {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return null;
    return { url: url.replace(/\/$/, ''), serviceKey };
}

async function supaRpc(fn, body) {
    const cfg = supaCfg();
    if (!cfg) return null; // fail-open (voir appelant)
    const res = await fetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': cfg.serviceKey,
            'Authorization': `Bearer ${cfg.serviceKey}`
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`RPC ${fn} → HTTP ${res.status}: ${t.slice(0, 200)}`);
    }
    return res.json();
}

// ── Vérifie le JWT Supabase du client → user_id ou null (anonyme) ────────────
async function resolveUserId(userToken) {
    if (!userToken) return null;
    try {
        const cfg = supaCfg();
        const base = cfg?.url || process.env.SUPABASE_URL || 'https://jxhzjetxquimmkpzlfyh.supabase.co';
        const anonKey = process.env.SUPABASE_ANON_KEY || SUPABASE_ANON_FALLBACK;
        const res = await fetch(`${base.replace(/\/$/, '')}/auth/v1/user`, {
            headers: { 'apikey': anonKey, 'Authorization': `Bearer ${userToken}` }
        });
        if (!res.ok) return null;
        const user = await res.json();
        return user?.id || null;
    } catch {
        return null;
    }
}

// ── Entrée principale ───────────────────────────────────────────────────────
export default async (request, context) => {
    const origin = request.headers.get('origin') || '';
    const referer = request.headers.get('referer') || '';

    // CORS : origine exacte (pas de startsWith — évite http://localhost.evil.com)
    // ou Referer du domaine autorisé. Les Deploy Previews Netlify sont tolérées.
    const isAllowedOrigin = ALLOWED_ORIGINS.has(origin) ||
        (origin.endsWith('.netlify.app') && origin.includes('medgame'));
    const isAllowedReferer = ALLOWED_ORIGINS.has(referer) ||
        [...ALLOWED_ORIGINS].some(o => referer.startsWith(o + '/')) ||
        (referer.includes('.netlify.app') && referer.includes('medgame'));

    const corsHeaders = {
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Token',
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

    // Rate-limiting mémoire (anti-burst par IP)
    const ip = (request.headers.get('x-forwarded-for') || context?.ip || 'unknown').split(',')[0].trim();
    if (!checkRateLimit(ip)) {
        console.warn(`[Proxy] Rate-limit atteint — IP: ${ip}`);
        return jsonError('Too Many Requests', 429, corsHeaders, { code: 'IP_RATE_LIMIT' });
    }

    try {
        let body;
        try {
            body = await request.json();
        } catch {
            return jsonError('Invalid JSON body', 400, corsHeaders);
        }

        // ── Classe d'appel : dialogue (quota) vs correction (budget propre) ──
        // Forgé côté client ? Possible — mais les corrections ont leur propre
        // budget journalier (3 anon / 10 connecté), donc pas de contournement.
        const kind = body.meta?.kind === 'correction' ? 'correction' : 'dialogue';
        if (body.meta?.kind !== undefined && body.meta.kind !== 'dialogue' && body.meta.kind !== 'correction') {
            return jsonError(`meta.kind invalide (dialogue|correction).`, 400, corsHeaders);
        }

        // ── Gate atomique : global 50/min + quotas (Supabase) ────────────────
        let gate = { allowed: true, code: 'OK', kind };
        if (supaCfg()) {
            try {
                const ipHash = await hashIp(ip);
                const userId = await resolveUserId(request.headers.get('x-user-token'));
                gate = await supaRpc('llm_gate', {
                    p_ip_hash: ipHash, p_user_id: userId, p_kind: kind
                });
                gate._ipHash = ipHash;
                gate._userId = userId;
            } catch (e) {
                // Panne Supabase : fail-open tracé (disponibilité > blocage strict).
                // Le garde 60/min en mémoire reste actif.
                console.error('[Proxy] Gate quota indisponible, fail-open:', e.message);
                gate = { allowed: true, code: 'GATE_BYPASSED', kind };
            }
        } else {
            console.warn('[Proxy] SUPABASE_URL/SERVICE_ROLE_KEY absents — gate quota désactivé (dev).');
        }

        if (!gate.allowed && gate.code === 'GLOBAL_429') {
            console.warn(`[Proxy] Garde-fou global 50/min atteint (count=${gate.global_count})`);
            return jsonError('Too Many Requests — pic de charge, réessayez dans une minute.',
                429, corsHeaders, { code: 'GLOBAL_429' });
        }
        if (!gate.allowed) {
            // Quota épuisé : 402 NON retryable → le client affiche la modale + mailto.
            console.warn(`[Proxy] Quota épuisé — kind=${kind} reason=${gate.reason}`);
            return jsonError(
                'Quota de messages épuisé.',
                402, corsHeaders,
                {
                    code: 'QUOTA_EXCEEDED',
                    reason: gate.reason || 'quota',
                    kind,
                    limit: gate.limit ?? null,
                    remaining_day: gate.remaining_day ?? gate.remaining ?? null,
                    remaining_week: gate.remaining_week ?? null,
                    email: QUOTA_CONTACT_EMAIL
                }
            );
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

        // ── Construire un corps épuré (whitelist de champs, meta strippé) ───
        const model = body.model || process.env.LLM_MODEL || 'deepseek-chat';
        const safeBody = {
            model,
            messages: body.messages.map(m => ({ role: m.role, content: m.content })),
            temperature: typeof body.temperature === 'number' ? Math.min(2, Math.max(0, body.temperature)) : 0.7,
            max_tokens: body.max_tokens || 800,
            stream: body.stream === true
        };
        if (body.top_p !== undefined) safeBody.top_p = Math.min(1, Math.max(0, body.top_p));
        if (body.response_format !== undefined) safeBody.response_format = body.response_format;

        // ── Appel upstream ─────────────────────────────────────────────────
        const llmUrl = process.env.LLM_API_URL || 'https://api.deepseek.com/chat/completions';
        const apiKey = process.env.LLM_API_KEY;
        if (!apiKey) {
            console.error('[Proxy] LLM_API_KEY manquante');
            return jsonError('LLM_API_KEY non configurée côté serveur.', 500, corsHeaders);
        }

        console.info(`[Proxy] kind=${kind} model=${model} msgs=${safeBody.messages.length} tokens=${safeBody.max_tokens}`);

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
            console.error(`[Proxy] Erreur upstream ${upstream.status}: ${errText.slice(0, 300)}`);
            return jsonError(errText || `Erreur fournisseur LLM (${upstream.status})`, upstream.status, corsHeaders);
        }

        // ── Log de conso APRÈS succès (les échecs ne consomment rien) ───────
        // Non-bloquant : waitUntil si dispo, sinon fire-and-forget tracé.
        if (gate._ipHash && gate.code !== 'GATE_BYPASSED') {
            const logP = supaRpc('log_llm_usage', {
                p_ip_hash: gate._ipHash,
                p_user_id: gate._userId ?? null,
                p_kind: kind,
                p_model: model
            }).catch(e => console.error('[Proxy] log_llm_usage échoué:', e.message));
            if (context?.waitUntil) context.waitUntil(logP);
            else logP.catch(() => {});
        }

        const quotaHeaders = {};
        const remSingle = gate.remaining_day ?? gate.remaining ?? gate.remaining_correction ?? null;
        if (remSingle !== null && remSingle !== undefined) {
            quotaHeaders['X-Quota-Remaining'] = String(remSingle);
        }
        if (gate.remaining_week !== undefined && gate.remaining_week !== null) {
            quotaHeaders['X-Quota-Remaining-Week'] = String(gate.remaining_week);
        }
        quotaHeaders['X-Quota-Kind'] = kind;

        return new Response(upstream.body, {
            status: upstream.status,
            headers: {
                'Content-Type': upstream.headers.get('Content-Type') || 'text/event-stream',
                'Cache-Control': 'no-cache, no-store',
                'X-Content-Type-Options': 'nosniff',
                ...quotaHeaders,
                ...corsHeaders
            }
        });

    } catch (err) {
        console.error('[Proxy] Erreur inattendue:', err);
        return jsonError(err.message || 'Internal Server Error', 500, corsHeaders);
    }
};
