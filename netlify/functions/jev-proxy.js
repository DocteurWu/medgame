/**
 * netlify/functions/jev-proxy.js : Proxy TypeSafe System One (Jev) securise
 *
 * Protections implementees :
 *  - CORS restrictif (origine + Referer verifies)
 *  - Rate-limit par IP en memoire (60 req/min, anti-burst)
 *  - Verification de quota Supabase (fail-open si non configure ou dev)
 *  - Plafonds stricts : taille de state (<= 60000 chars), nombre de questions (<= 80)
 *  - Cle TYPESAFE_API_KEY serveur uniquement, jamais exposee cote client
 */

const rateLimitMap = new Map();
const RATE_LIMIT = 60;        // requetes par fenetre et par IP (memoire)
const RATE_WINDOW_MS = 60000; // 1 minute

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

const MAX_STATE_LENGTH = 60000;
const MAX_QUESTIONS_COUNT = 80;
const DEFAULT_MODEL = 'jev-latest';

// Rate-limiting par IP (memoire, anti-burst)
function checkRateLimit(ip) {
    const now = Date.now();
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

function jsonError(msg, status, corsHeaders, extra = {}) {
    return new Response(JSON.stringify({ error: msg, ...extra }), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
}

function supaCfg() {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return null;
    return { url: url.replace(/\/$/, ''), serviceKey };
}

async function supaRpc(fn, body) {
    const cfg = supaCfg();
    if (!cfg) return null;
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
        throw new Error(`RPC ${fn} -> HTTP ${res.status}: ${t.slice(0, 200)}`);
    }
    return res.json();
}

async function hashIp(ip) {
    const salt = process.env.QUOTA_SALT || 'medgame-quota-default-salt';
    const data = new TextEncoder().encode(`${salt}:${ip}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function resolveUserId(userToken) {
    if (!userToken) return null;
    try {
        const cfg = supaCfg();
        const base = cfg?.url || process.env.SUPABASE_URL || 'https://jxhzjetxquimmkpzlfyh.supabase.co';
        const anonKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_Nqjp4eF3ytr3VDciqX8dvA_JhdVP0G0';
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

export default async (request, context) => {
    const origin = request.headers.get('origin') || '';
    const referer = request.headers.get('referer') || '';

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

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
        return jsonError('Method Not Allowed', 405, corsHeaders);
    }

    if (!isAllowedOrigin && !isAllowedReferer) {
        console.warn(`[Jev-Proxy] Requete bloquee : origine non autorisee: "${origin}" referer: "${referer}"`);
        return jsonError('Forbidden', 403, corsHeaders);
    }

    const ip = (request.headers.get('x-forwarded-for') || context?.ip || 'unknown').split(',')[0].trim();
    if (!checkRateLimit(ip)) {
        console.warn(`[Jev-Proxy] Rate-limit atteint pour IP: ${ip}`);
        return jsonError('Too Many Requests', 429, corsHeaders, { code: 'IP_RATE_LIMIT' });
    }

    try {
        let body;
        try {
            body = await request.json();
        } catch {
            return jsonError('Invalid JSON body', 400, corsHeaders);
        }

        // Verification de quota Supabase (fail-open en local)
        let gate = { allowed: true, code: 'OK' };
        if (supaCfg()) {
            try {
                const ipHash = await hashIp(ip);
                const userId = await resolveUserId(request.headers.get('x-user-token'));
                gate = await supaRpc('llm_gate', {
                    p_ip_hash: ipHash, p_user_id: userId, p_kind: 'correction'
                });
            } catch (e) {
                console.error('[Jev-Proxy] Gate quota indisponible, fail-open:', e.message);
                gate = { allowed: true, code: 'GATE_BYPASSED' };
            }
        }

        if (!gate.allowed && gate.code === 'GLOBAL_429') {
            return jsonError('Too Many Requests - pic de charge, reessayez dans une minute.',
                429, corsHeaders, { code: 'GLOBAL_429' });
        }
        if (!gate.allowed) {
            return jsonError('Quota epuise.', 402, corsHeaders, {
                code: 'QUOTA_EXCEEDED',
                reason: gate.reason || 'quota'
            });
        }

        // Validation des donnees Jev
        if (typeof body !== 'object' || body === null) {
            return jsonError('Corps de requete invalide.', 400, corsHeaders);
        }

        const state = typeof body.state === 'string' ? body.state : '';
        if (state.length > MAX_STATE_LENGTH) {
            return jsonError(`Longueur de state depasse le plafond de ${MAX_STATE_LENGTH} caracteres (${state.length}).`, 400, corsHeaders);
        }

        const questions = body.questions;
        if (!questions || typeof questions !== 'object' || Array.isArray(questions)) {
            return jsonError('questions doit etre un objet de questions typées.', 400, corsHeaders);
        }

        const questionKeys = Object.keys(questions);
        if (questionKeys.length === 0) {
            return jsonError('L objet questions ne peut pas etre vide.', 400, corsHeaders);
        }
        if (questionKeys.length > MAX_QUESTIONS_COUNT) {
            return jsonError(`Nombre de questions depasse le plafond de ${MAX_QUESTIONS_COUNT} (${questionKeys.length}).`, 400, corsHeaders);
        }

        const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : DEFAULT_MODEL;

        const safePayload = {
            model,
            state,
            questions
        };

        const apiKey = process.env.TYPESAFE_API_KEY;
        if (!apiKey) {
            console.error('[Jev-Proxy] TYPESAFE_API_KEY manquante sur le serveur.');
            return jsonError('TYPESAFE_API_KEY non configuree cote serveur.', 500, corsHeaders);
        }

        const jevUrl = process.env.JEV_API_URL || 'https://api.typesafe.ai/v1/systemone';

        console.info(`[Jev-Proxy] Appel amont Jev : model=${model} questions=${questionKeys.length} stateLen=${state.length}`);

        const upstream = await fetch(jevUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'X-Title': 'MedGame'
            },
            body: JSON.stringify(safePayload)
        });

        if (!upstream.ok) {
            const errText = await upstream.text().catch(() => '');
            console.error(`[Jev-Proxy] Erreur upstream ${upstream.status}: ${errText.slice(0, 300)}`);
            return jsonError(errText || `Erreur fournisseur TypeSafe (${upstream.status})`, upstream.status, corsHeaders);
        }

        const responseData = await upstream.json();

        return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store',
                'X-Content-Type-Options': 'nosniff',
                ...corsHeaders
            }
        });

    } catch (err) {
        console.error('[Jev-Proxy] Erreur inattendue:', err);
        return jsonError(err.message || 'Internal Server Error', 500, corsHeaders);
    }
};
