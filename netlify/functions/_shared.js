/**
 * netlify/functions/_shared.js — Utilitaires partages par les fonctions Netlify.
 *
 * Extraits de llm-proxy.js et jev-proxy.js, ou ils etaient dupliques a
 * l'octet : `supaCfg`, `supaRpc` et `hashIp`. Une seule implementation, donc
 * une seule correction a faire quand le schema Supabase ou le salage change.
 *
 * Regles : ce module ne doit contenir AUCUNE valeur secrete en dur. Tout
 * passe par process.env, resolu cote serveur.
 */

/**
 * Configuration Supabase service-role, ou null si l'environnement ne la
 * fournit pas (fail-open : l'appelant decide de degrader).
 */
export function supaCfg() {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return null;
    return { url: url.replace(/\/$/, ''), serviceKey };
}

/**
 * Appel d'une fonction RPC Supabase. Renvoie null si Supabase n'est pas
 * configure, leve en cas d'erreur HTTP.
 */
export async function supaRpc(fn, body) {
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

/**
 * Hachage de l'IP client (SHA-256 + sel d'environnement) : aucune IP en
 * clair n'est jamais stockee. Le sel par defaut n'est qu'un filet de securite
 * pour un deploiement sans QUOTA_SALT : en production il doit etre defini.
 */
export async function hashIp(ip) {
    const salt = process.env.QUOTA_SALT || 'medgame-quota-default-salt';
    const data = new TextEncoder().encode(`${salt}:${ip}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
