import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ── Proxy (import ESM direct, Node 22+ : Request/Response + subtle dispos) ──
const proxyModule = await import('../netlify/functions/llm-proxy.js');
const llmProxy = proxyModule.default;

function postRequest(body, origin = 'http://localhost:8888') {
    return new Request('http://localhost/.netlify/functions/llm-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': origin },
        body: JSON.stringify(body)
    });
}
const DIALOGUE_BODY = {
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: 'Bonjour docteur' }],
    max_tokens: 100
};

// Neutralise le gate Supabase (fail-open documenté) pour tester la validation pure
const savedSupaUrl = process.env.SUPABASE_URL;
const savedSupaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

test('Proxy quota — preflight et méthodes', async (t) => {
    await t.test('OPTIONS → 204', async () => {
        const res = await llmProxy(new Request('http://localhost/x', {
            method: 'OPTIONS',
            headers: { 'Origin': 'http://localhost:8888' }
        }), {});
        assert.equal(res.status, 204);
    });

    await t.test('GET → 405', async () => {
        const res = await llmProxy(new Request('http://localhost/x', {
            headers: { 'Origin': 'http://localhost:8888' }
        }), {});
        assert.equal(res.status, 405);
    });
});

test('Proxy quota — origines et validation', async (t) => {
    await t.test('origine inconnue → 403', async () => {
        const res = await llmProxy(postRequest(DIALOGUE_BODY, 'https://evil.example.com'), {});
        assert.equal(res.status, 403);
    });

    await t.test('meta.kind invalide → 400', async () => {
        const res = await llmProxy(
            postRequest({ ...DIALOGUE_BODY, meta: { kind: 'admin' } }), {});
        assert.equal(res.status, 400);
        const j = await res.json();
        assert.match(j.error, /meta\.kind/);
    });

    await t.test('modèle non whitelisté → 400', async () => {
        const res = await llmProxy(
            postRequest({ ...DIALOGUE_BODY, model: 'gpt-999-evil' }), {});
        assert.equal(res.status, 400);
    });

    await t.test('messages vide → 400', async () => {
        const res = await llmProxy(postRequest({ model: 'deepseek-chat', messages: [] }), {});
        assert.equal(res.status, 400);
    });
});

test('Proxy quota — sans clé LLM (fail-open gate, erreur 500 explicite)', async () => {
    const savedKey = process.env.LLM_API_KEY;
    delete process.env.LLM_API_KEY;
    try {
        const res = await llmProxy(postRequest(DIALOGUE_BODY), {});
        assert.equal(res.status, 500);
        const j = await res.json();
        assert.match(j.error, /LLM_API_KEY/);
    } finally {
        if (savedKey !== undefined) process.env.LLM_API_KEY = savedKey;
    }
});

// Restaure l'env Supabase éventuel
if (savedSupaUrl !== undefined) process.env.SUPABASE_URL = savedSupaUrl;
if (savedSupaKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedSupaKey;

// ── SQL : seuils et verrouillage ─────────────────────────────────────────────
test('SQL 003 — seuils quota et verrouillage', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'sql', '003_llm_quotas.sql'), 'utf8');
    assert.match(sql, /CREATE TABLE IF NOT EXISTS llm_usage_log/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS llm_global_window/);
    assert.match(sql, /CREATE OR REPLACE FUNCTION llm_gate/);
    assert.match(sql, /CREATE OR REPLACE FUNCTION log_llm_usage/);
    // Seuils : 50/min global, 5/14j anon, 20/j, 50/sem, corrections 3 et 10
    assert.match(sql, /v_gcount > 50/);
    assert.match(sql, /interval '14 days'/);
    assert.match(sql, /v_anon >= 5/);
    assert.match(sql, /v_day >= 20/);
    assert.match(sql, /v_week >= 50/);
    assert.match(sql, /v_corr >= 3/);
    assert.match(sql, /v_corr >= 10/);
    // Sécurité : aucun EXECUTE public, RLS activée, pas d'IP en clair
    assert.match(sql, /REVOKE ALL ON FUNCTION llm_gate/);
    assert.match(sql, /REVOKE ALL ON TABLE llm_usage_log/);
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    assert.ok(!/ip\s+inet|ip_address/.test(sql), 'aucune colonne IP en clair');
    // Compteur vie = stats (vue, pas de blocage vie dans llm_gate)
    assert.match(sql, /v_llm_top_consumers/);
});

// ── QuotaGuard (chargé par eval avec DOM absent = guards) ────────────────────
function loadQuotaGuard() {
    const src = fs.readFileSync(path.join(ROOT, 'js', 'quota-guard.js'), 'utf8');
    assert.ok(!/llm-fallback/i.test(src), 'aucune référence au fallback supprimé');
    (0, eval)(src);
    return globalThis.QuotaGuard;
}

test('QuotaGuard — logique locale pure', async (t) => {
    const QG = loadQuotaGuard();
    assert.ok(QG, 'QuotaGuard exposé globalement');

    await t.test('_parseState : frais, expiré, borné', () => {
        const now = Date.now();
        assert.deepEqual(QG._parseState(null, now), { count: 0, windowStart: now });
        assert.deepEqual(
            QG._parseState(JSON.stringify({ count: 3, windowStart: now - 1000 }), now),
            { count: 3, windowStart: now - 1000 });
        // Fenêtre 14j expirée → reset
        assert.deepEqual(
            QG._parseState(JSON.stringify({ count: 5, windowStart: now - 15 * 24 * 3600 * 1000 }), now),
            { count: 0, windowStart: now });
        // Borné à 5
        assert.equal(QG._parseState(JSON.stringify({ count: 99, windowStart: now }), now).count, 5);
    });

    await t.test('preCheckSync : inconnu → laisse passer (serveur tranche)', () => {
        assert.deepEqual(QG.preCheckSync(), { blocked: false });
    });

    await t.test('isQuotaError : code, HTTP 402, négatifs', () => {
        assert.equal(QG.isQuotaError({ code: 'QUOTA_EXCEEDED' }), true);
        assert.equal(QG.isQuotaError(new Error('HTTP 402 Payment Required — Quota')), true);
        assert.equal(QG.isQuotaError(new Error('HTTP 429 Too Many Requests')), false);
        assert.equal(QG.isQuotaError(null), false);
    });

    await t.test('mailto contient le contact', () => {
        assert.match(QG._mailtoHref('daily'), /hamlat\.louai@gmail\.com/);
    });

    await t.test('lockTablet sans DOM ne jette pas', () => {
        assert.doesNotThrow(() => QG.lockTablet({ reason: 'daily' }));
        assert.doesNotThrow(() => QG.reapplyLock());
        assert.doesNotThrow(() => QG.closeModal());
        assert.doesNotThrow(() => QG.closeTabletAndFocusDiagnosis());
    });
});

// ── LLMClient : quotaKind, 402 non-retryé, meta transmis ─────────────────────
function loadLLMClient(quotaStubs = {}) {
    const src = fs.readFileSync(path.join(ROOT, 'js', 'llm-client.js'), 'utf8');
    assert.match(src, /quotaKind/, 'LLMClient connaît quotaKind');
    assert.match(src, /meta: \{ kind \}/, 'meta.kind transmis au proxy');
    assert.match(src, /QUOTA_EXCEEDED/, '402 typée');
    globalThis.window = {
        CONFIG: { LLM_API_URL: 'http://localhost:9999/llm-proxy', LLM_MODEL: 'deepseek-chat' },
        QuotaGuard: {
            preCheckSync: () => ({ blocked: false }),
            syncFromHeaders: () => {},
            getUserTokenSync: () => null,
            ...quotaStubs
        }
    };
    (0, eval)(src);
    return globalThis.window.LLMClient;
}

const originalFetch = globalThis.fetch;

test('LLMClient quota — 402 non retryé, 429 retryé, meta transmis', async (t) => {
    const LLMClient = loadLLMClient();

    await t.test('402 QUOTA_EXCEEDED → 1 seul appel, erreur typée', async () => {
        let calls = 0;
        globalThis.fetch = async () => {
            calls++;
            return {
                ok: false, status: 402, statusText: 'Payment Required',
                headers: { get: () => null },
                text: async () => JSON.stringify({
                    error: 'Quota de messages épuisé.', code: 'QUOTA_EXCEEDED',
                    reason: 'daily', remaining_day: 0, email: 'hamlat.louai@gmail.com'
                })
            };
        };
        try {
            await assert.rejects(
                LLMClient.request({ messages: [{ role: 'user', content: 'x' }], maxRetries: 2 }),
                (err) => {
                    assert.equal(err.code, 'QUOTA_EXCEEDED');
                    assert.equal(err.reason, 'daily');
                    assert.equal(err.contactEmail, 'hamlat.louai@gmail.com');
                    return true;
                });
            assert.equal(calls, 1, 'aucun retry sur quota');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    await t.test('meta.kind=correction transmis au proxy', async () => {
        let sentBody = null;
        globalThis.fetch = async (_url, opts) => {
            sentBody = JSON.parse(opts.body);
            return {
                ok: true, status: 200,
                headers: { get: () => null },
                json: async () => ({ choices: [{ message: { content: 'Corrigé.' } }] })
            };
        };
        try {
            const txt = await LLMClient.request({
                messages: [{ role: 'user', content: 'corrige' }],
                quotaKind: 'correction', maxRetries: 0
            });
            assert.equal(txt, 'Corrigé.');
            assert.deepEqual(sentBody.meta, { kind: 'correction' });
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    await t.test('X-User-Token transmis quand QuotaGuard a un token', async () => {
        const LLMClient2 = loadLLMClient({ getUserTokenSync: () => 'jwt-test' });
        let sentHeaders = null;
        globalThis.fetch = async (_url, opts) => {
            sentHeaders = opts.headers;
            return {
                ok: true, status: 200,
                headers: { get: () => null },
                json: async () => ({ choices: [{ message: { content: 'ok' } }] })
            };
        };
        try {
            await LLMClient2.request({ messages: [{ role: 'user', content: 'x' }], maxRetries: 0 });
            assert.equal(sentHeaders['X-User-Token'], 'jwt-test');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    await t.test('pré-contrôle local : appel bloqué sans réseau', async () => {
        const LLMClient3 = loadLLMClient({
            preCheckSync: () => ({ blocked: true, reason: 'anon_window', localOnly: true })
        });
        let calls = 0;
        globalThis.fetch = async () => { calls++; throw new Error('should not be called'); };
        try {
            await assert.rejects(
                LLMClient3.request({ messages: [{ role: 'user', content: 'x' }] }),
                (err) => {
                    assert.equal(err.code, 'QUOTA_EXCEEDED');
                    assert.equal(err.localOnly, true);
                    return true;
                });
            assert.equal(calls, 0, 'zéro appel réseau');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});

// ── Cohérence : plus aucune référence au fallback supprimé ───────────────────
test('Suppression llm-fallback.js — aucune référence restante', () => {
    assert.ok(!fs.existsSync(path.join(ROOT, 'js', 'llm-fallback.js')), 'fichier supprimé');
    for (const f of ['game.html', 'js/llm-client.js', 'js/patientChat.js']) {
        const content = fs.readFileSync(path.join(ROOT, f), 'utf8');
        assert.ok(!content.includes('llm-fallback.js'),
            `${f} ne charge plus llm-fallback.js`);
    }
});
