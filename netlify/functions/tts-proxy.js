/**
 * netlify/functions/tts-proxy.js — Voix neuronale du patient (js/patient-voice.js).
 *
 * Relais vers une API de synthèse vocale compatible OpenAI (`/v1/audio/speech`).
 * La clé reste côté serveur. Sans `TTS_API_KEY`, la fonction répond 501 et le
 * client bascule, pour toute la session, sur la synthèse du navigateur : le
 * jeu reste jouable sans fournisseur de voix.
 *
 * Garde-fous : origine vérifiée (même règle que llm-proxy), texte borné à
 * 600 caractères, voix en liste blanche de forme, débit borné, et
 * rate-limit mémoire par IP (une réplique = 1 à 3 phrases = 1 à 3 appels).
 */

const RATE_LIMIT = 90;          // phrases par minute et par IP
const RATE_WINDOW_MS = 60000;
const MAX_TEXT = 600;
const rateLimitMap = new Map();

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

function jsonError(msg, status, corsHeaders) {
    return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
}

export default async (request, context) => {
    const origin = request.headers.get('origin') || '';
    const referer = request.headers.get('referer') || '';
    // Le Referer est réduit à son origine : `includes()` sur l'URL entière
    // laissait passer https://evil.com/?medgame.netlify.app.
    let refererOrigin = '';
    try { refererOrigin = referer ? new URL(referer).origin : ''; } catch { /* Referer invalide */ }
    const isMedgameOrigin = (o) => ALLOWED_ORIGINS.has(o) ||
        /^https:\/\/[a-z0-9-]*medgame[a-z0-9-]*\.netlify\.app$/.test(o);
    const isAllowedOrigin = isMedgameOrigin(origin);
    const isAllowedReferer = isMedgameOrigin(refererOrigin);

    const corsHeaders = {
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'https://medgame.app',
        'Vary': 'Origin'
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return jsonError('Method Not Allowed', 405, corsHeaders);
    if (!isAllowedOrigin && !isAllowedReferer) return jsonError('Forbidden', 403, corsHeaders);

    const apiKey = process.env.TTS_API_KEY;
    if (!apiKey) return jsonError('TTS_API_KEY non configurée côté serveur.', 501, corsHeaders);

    const ip = (request.headers.get('x-forwarded-for') || context?.ip || 'unknown').split(',')[0].trim();
    if (!checkRateLimit(ip)) return jsonError('Too Many Requests', 429, corsHeaders);

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonError('Invalid JSON body', 400, corsHeaders);
    }
    const text = typeof body?.text === 'string' ? body.text.trim().slice(0, MAX_TEXT) : '';
    if (!text) return jsonError('text is required', 400, corsHeaders);

    try {
        const upstream = await fetch(process.env.TTS_API_URL || 'https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: process.env.TTS_MODEL || 'gpt-4o-mini-tts',
                input: text,
                voice: /^[a-z]{2,20}$/.test(body.voice || '') ? body.voice : 'alloy',
                ...(typeof body.instructions === 'string' ? { instructions: body.instructions.slice(0, MAX_TEXT) } : {}),
                ...(Number.isFinite(body.speed) ? { speed: Math.min(1.5, Math.max(0.7, body.speed)) } : {}),
                response_format: 'mp3'
            })
        });
        if (!upstream.ok) {
            const errText = await upstream.text().catch(() => '');
            console.error(`[TTS] Erreur upstream ${upstream.status}: ${errText.slice(0, 300)}`);
            return jsonError(`Erreur fournisseur TTS (${upstream.status})`, upstream.status, corsHeaders);
        }
        return new Response(upstream.body, {
            status: 200,
            headers: {
                'Content-Type': upstream.headers.get('Content-Type') || 'audio/mpeg',
                'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff',
                ...corsHeaders
            }
        });
    } catch (err) {
        console.error('[TTS] Erreur inattendue:', err);
        return jsonError(err.message || 'Internal Server Error', 500, corsHeaders);
    }
};
