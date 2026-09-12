/**
 * js/quota-guard.js — Garde quota API côté client (2ᵉ couche, le serveur tranche)
 *
 * Règles (miroir serveur, voir sql/003_llm_quotas.sql + netlify/functions/llm-proxy.js) :
 *  - Anonyme  : 5 messages dialogue / 14 jours glissants par IP (serveur)
 *  - Connecté : 20 / jour + 50 / semaine par compte (serveur)
 *  - Correction (kind='correction') : toujours un vrai LLM (budget propre serveur)
 *
 * Rôle de ce module :
 *  1. Pré-contrôle local anonyme (cookie 14j + miroir sessionStorage, zéro coût API).
 *     Ne bloque QUE si l'état auth est connu-anonyme ; le serveur reste l'autorité.
 *  2. Fournit le JWT (X-User-Token) à LLMClient pour identifier les connectés.
 *  3. Verrouille la "tablette" (input + bouton désactivés + bannière) à quota épuisé.
 *  4. Modale : anonymes → login ; connectés → mailto hamlat.louai@gmail.com ;
 *     tous → "Ranger la tablette et rédiger le diagnostic" (la correction reste réelle).
 *
 * Aucune réponse de substitution : quand le LLM est indisponible, on affiche
 * l'erreur explicitement, jamais de faux dialogue.
 */
(function () {
    'use strict';

    var G = (typeof window !== 'undefined') ? window : globalThis;

    var CONTACT_EMAIL = 'hamlat.louai@gmail.com';
    var ANON_LIMIT = 5;
    var WINDOW_MS = 14 * 24 * 3600 * 1000; // 14 jours
    var COOKIE_NAME = 'medgame_quota_anon';
    var SESSION_KEY = 'medgame_quota_anon';
    var LOCK_KEY = 'medgame_tablet_locked'; // sessionStorage : verrou tablette actif
    var BANNER_ID = 'quota-lock-banner';
    var MODAL_ID = 'quota-modal';

    // État auth en cache (rafraîchi à l'init + onAuthStateChange)
    var authState = { known: false, authenticated: false, token: null };

    // ── Cookie + sessionStorage ──────────────────────────────────────────
    function readCookie() {
        try {
            if (typeof document === 'undefined' || !document.cookie) return null;
            var parts = document.cookie.split('; ');
            for (var i = 0; i < parts.length; i++) {
                if (parts[i].indexOf(COOKIE_NAME + '=') === 0) {
                    return decodeURIComponent(parts[i].slice(COOKIE_NAME.length + 1));
                }
            }
        } catch (_) {}
        return null;
    }

    function writeCookie(value) {
        try {
            if (typeof document === 'undefined') return;
            var expires = new Date(Date.now() + WINDOW_MS).toUTCString();
            document.cookie = COOKIE_NAME + '=' + encodeURIComponent(value)
                + '; expires=' + expires + '; path=/; SameSite=Lax';
        } catch (_) {}
    }

    function readSession() {
        try {
            if (typeof sessionStorage === 'undefined') return null;
            return sessionStorage.getItem(SESSION_KEY);
        } catch (_) { return null; }
    }

    function writeSession(value) {
        try {
            if (typeof sessionStorage === 'undefined') return;
            sessionStorage.setItem(SESSION_KEY, value);
        } catch (_) {}
    }

    function parseState(raw, now) {
        var fresh = { count: 0, windowStart: now };
        if (!raw) return fresh;
        try {
            var s = JSON.parse(raw);
            if (typeof s.count !== 'number' || typeof s.windowStart !== 'number') return fresh;
            if (now - s.windowStart > WINDOW_MS) return fresh; // fenêtre 14j expirée
            return { count: Math.max(0, Math.min(ANON_LIMIT, s.count)), windowStart: s.windowStart };
        } catch (_) { return fresh; }
    }

    function readLocal(now) {
        now = now || Date.now();
        var raw = readCookie();
        if (raw === null) raw = readSession(); // secours si cookies refusés
        return parseState(raw, now);
    }

    function writeLocal(state) {
        var raw = JSON.stringify(state);
        writeCookie(raw);
        writeSession(raw); // miroir
    }

    // ── Auth (Supabase) ──────────────────────────────────────────────────
    function getSupabase() {
        try {
            var sb = G.supabase;
            if (sb && typeof sb.auth?.getSession === 'function') return sb;
        } catch (_) {}
        return null;
    }

    async function refreshAuth() {
        var sb = getSupabase();
        if (!sb) { authState = { known: false, authenticated: false, token: null }; return authState; }
        try {
            var res = await sb.auth.getSession();
            var session = res?.data?.session || null;
            authState = {
                known: true,
                authenticated: !!session,
                token: session?.access_token || null
            };
            if (authState.authenticated) {
                // Un compte connecté a son propre quota : lever le verrou anonyme local.
                // (Le serveur tranche de toute façon à chaque appel.)
                try {
                    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(LOCK_KEY);
                } catch (_) {}
                enableTabletInputs();
                closeModal();
            } else {
                reapplyLock();
            }
        } catch (_) {
            authState = { known: false, authenticated: false, token: null };
        }
        return authState;
    }

    function subscribeAuth() {
        try {
            var sb = getSupabase();
            if (sb && sb.auth && typeof sb.auth.onAuthStateChange === 'function') {
                sb.auth.onAuthStateChange(function () { refreshAuth(); });
            }
        } catch (_) {}
    }

    // ── API publique ─────────────────────────────────────────────────────
    function getUserTokenSync() {
        return authState.token;
    }

    /**
     * Pré-contrôle synchrone avant un appel dialogue.
     * Ne bloque que si : auth connue-anonyme ET compteur local épuisé.
     * Sinon laisse passer (serveur = autorité finale).
     */
    function preCheckSync() {
        if (authState.known && authState.authenticated) return { blocked: false };
        if (!authState.known) return { blocked: false }; // inconnu → le serveur décide
        var st = readLocal();
        if (st.count >= ANON_LIMIT) return { blocked: true, reason: 'anon_window', localOnly: true };
        return { blocked: false };
    }

    /**
     * Resynchronise le compteur local depuis les headers du proxy (succès).
     * Uniquement en contexte connu-anonyme (le cookie ne concerne que les anonymes).
     */
    function syncFromHeaders(headers, kind) {
        try {
            if (kind !== 'dialogue') return;
            if (!authState.known || authState.authenticated) return;
            var raw = headers && typeof headers.get === 'function'
                ? headers.get('X-Quota-Remaining') : null;
            if (raw === null || raw === undefined) {
                // Pas de headers (gate bypassé) : incrément miroir pragmatique.
                var st = readLocal();
                writeLocal({ count: Math.min(ANON_LIMIT, st.count + 1), windowStart: st.windowStart });
                return;
            }
            var r = parseInt(raw, 10);
            if (isNaN(r)) return;
            // remaining r = reste AVANT consommation de cet appel → usé = LIMIT - r + 1... après log.
            // Formule exacte : count_local = LIMIT - r (état pré-appel) puis +1 post-appel.
            var st2 = readLocal();
            var used = Math.max(0, Math.min(ANON_LIMIT, (ANON_LIMIT - r) + 1));
            writeLocal({ count: Math.max(st2.count, used), windowStart: st2.windowStart });
        } catch (_) {}
    }

    function isQuotaError(err) {
        if (!err) return false;
        if (err.code === 'QUOTA_EXCEEDED') return true;
        var msg = String((err && err.message) || err);
        return msg.indexOf('QUOTA_EXCEEDED') !== -1 || msg.indexOf('HTTP 402') !== -1;
    }

    // ── Verrou tablette ──────────────────────────────────────────────────
    function tabletInputs() {
        if (typeof document === 'undefined') return { input: null, btn: null };
        return {
            input: document.getElementById('dialogue-input'),
            btn: document.querySelector('#dialogue-form button[type="submit"]')
        };
    }

    function enableTabletInputs() {
        var els = tabletInputs();
        if (els.input) els.input.disabled = false;
        if (els.btn) els.btn.disabled = false;
    }

    function isLocked() {
        try {
            if (typeof sessionStorage === 'undefined') return false;
            return sessionStorage.getItem(LOCK_KEY) === '1';
        } catch (_) { return false; }
    }

    function lockTablet(info) {
        info = info || {};
        try {
            if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(LOCK_KEY, '1');
        } catch (_) {}
        // Figer le compteur local (évite un appel condamné à la prochaine frappe)
        if (!authState.authenticated) {
            var st = readLocal();
            writeLocal({ count: ANON_LIMIT, windowStart: st.windowStart });
        }
        var els = tabletInputs();
        if (els.input) {
            els.input.disabled = true;
            els.input.placeholder = info.authenticated === false || !authState.authenticated
                ? 'Connectez-vous pour continuer l’interrogatoire…'
                : 'Quota de messages épuisé — rédigez le diagnostic…';
        }
        if (els.btn) els.btn.disabled = true;
        injectBanner(info);
        showModal(info);
    }

    function unlockTablet() {
        try {
            if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(LOCK_KEY);
        } catch (_) {}
        enableTabletInputs();
        removeBanner();
        closeModal();
    }

    /** Ré-applique le verrou après un setCase (qui réactive les inputs). */
    function reapplyLock() {
        if (isLocked()) {
            var els = tabletInputs();
            if (els.input) els.input.disabled = true;
            if (els.btn) els.btn.disabled = true;
        }
    }

    function injectBanner(info) {
        try {
            if (typeof document === 'undefined') return;
            var root = document.getElementById('dialogue-messages');
            if (!root || document.getElementById(BANNER_ID)) return;
            var div = document.createElement('div');
            div.id = BANNER_ID;
            div.className = 'dialogue-message from-system quota-banner';
            var anon = !authState.authenticated;
            div.innerHTML =
                '<div class="quota-banner-box">' +
                '<strong>🔒 Interrogatoire terminé.</strong><br>' +
                (anon
                    ? 'Vous avez utilisé vos 5 messages gratuits (14 jours). <strong>Connectez-vous</strong> pour continuer et sauvegarder votre progression — ou rangez la tablette et rédigez le diagnostic : la correction reste faite par le vrai LLM.'
                    : 'Quota atteint (20/jour, 50/semaine). Rédigez le diagnostic : la correction reste faite par le vrai LLM. Pour plus de crédits, écrivez à <strong>' + CONTACT_EMAIL + '</strong>.') +
                '</div>';
            root.appendChild(div);
            root.scrollTop = root.scrollHeight;
        } catch (_) {}
    }

    function removeBanner() {
        try {
            if (typeof document === 'undefined') return;
            var b = document.getElementById(BANNER_ID);
            if (b && b.parentNode) b.parentNode.removeChild(b);
        } catch (_) {}
    }

    // ── Modale ───────────────────────────────────────────────────────────
    function closeModal() {
        try {
            if (typeof document === 'undefined') return;
            var m = document.getElementById(MODAL_ID);
            if (m && m.parentNode) m.parentNode.removeChild(m);
        } catch (_) {}
    }

    function mailtoHref(reason) {
        var subject = encodeURIComponent('[MedGame] Demande de crédits LLM supplémentaires');
        var body = encodeURIComponent(
            'Bonjour,\n\nJ’ai atteint mon quota de messages (' + (reason || 'quota') + ').\n'
            + 'Merci de m’accorder des crédits supplémentaires.\n\n— Pseudo / email du compte : \n');
        return 'mailto:' + CONTACT_EMAIL + '?subject=' + subject + '&body=' + body;
    }

    function showModal(info) {
        info = info || {};
        try {
            if (typeof document === 'undefined') return;
            closeModal();
            var anon = !authState.authenticated;
            var overlay = document.createElement('div');
            overlay.id = MODAL_ID;
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.style.cssText = 'position:fixed;inset:0;z-index:12000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.65);padding:20px;';
            var remaining = (info.remaining_day !== null && info.remaining_day !== undefined)
                ? '<p style="opacity:.8">Reste du jour : <strong>' + info.remaining_day + '</strong>'
                + ((info.remaining_week !== null && info.remaining_week !== undefined) ? ' · semaine : <strong>' + info.remaining_week + '</strong>' : '')
                + '</p>' : '';
            overlay.innerHTML =
                '<div style="max-width:520px;width:100%;background:#0e1626;color:#eaf2ff;border:1px solid rgba(0,242,254,.35);border-radius:16px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.6)">' +
                '<h2 style="margin:0 0 8px">🔒 Quota de messages épuisé</h2>' +
                (anon
                    ? '<p>Vous avez utilisé vos <strong>5 messages gratuits</strong> (14 jours). <strong>Connectez-vous pour débloquer 20 messages/jour</strong> et sauvegarder votre progression.</p>'
                    : '<p>Quota atteint (<strong>20/jour · 50/semaine</strong>).</p>' + remaining +
                      '<p>Pour obtenir plus de crédits, écrivez à <strong>' + CONTACT_EMAIL + '</strong>.</p>') +
                '<p style="opacity:.85">Bonne nouvelle : vous pouvez <strong>finir le cas</strong> — rangez la tablette, rédigez le diagnostic, la correction reste faite par le vrai LLM.</p>' +
                '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">' +
                (anon
                    ? '<button data-act="login" style="flex:1;padding:12px;border:none;border-radius:10px;background:linear-gradient(135deg,#00f2fe,#3b82f6);color:#00121a;font-weight:800;cursor:pointer">Se connecter (x4 + sauvegarde)</button>'
                    : '<a data-act="mail" href="' + mailtoHref(info.reason) + '" style="flex:1;padding:12px;border-radius:10px;background:linear-gradient(135deg,#00f2fe,#3b82f6);color:#00121a;font-weight:800;text-align:center;text-decoration:none">Demander plus de crédits</a>') +
                '<button data-act="close-tablet" style="flex:1;padding:12px;border-radius:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.25);color:#fff;font-weight:700;cursor:pointer">Ranger la tablette et rédiger</button>' +
                '</div></div>';
            overlay.addEventListener('click', function (e) {
                var act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
                if (act === 'login') { G.location.href = 'login.html'; }
                else if (act === 'close-tablet') { closeTabletAndFocusDiagnosis(); }
                else if (e.target === overlay) { closeModal(); }
            });
            document.body.appendChild(overlay);
        } catch (_) {}
    }

    /** Ferme le panneau de chat et amène l'étudiant au formulaire de diagnostic. */
    function closeTabletAndFocusDiagnosis() {
        closeModal();
        try {
            if (G.patientChat && typeof G.patientChat.close === 'function') G.patientChat.close();
            else if (typeof document !== 'undefined') {
                var p = document.getElementById('dialogue-panel');
                if (p) { p.classList.remove('active'); p.style.display = 'none'; }
            }
        } catch (_) {}
        try {
            if (typeof document === 'undefined') return;
            var selectors = ['#possible-diagnostics', '#diagnostic-form', '#diagnosis-form',
                '#diag-input', '#announce-input', '#submit-diagnostic', '#btn-submit-diagnostic'];
            for (var i = 0; i < selectors.length; i++) {
                var el = document.querySelector(selectors[i]);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    if (typeof el.focus === 'function') { try { el.focus(); } catch (_) {} }
                    return;
                }
            }
        } catch (_) {}
    }

    // ── Init ─────────────────────────────────────────────────────────────
    function init() {
        refreshAuth();
        subscribeAuth();
        // Si le verrou était actif (rechargement), le ré-appliquer quand le DOM est prêt.
        try {
            var apply = function () { reapplyLock(); };
            if (typeof document !== 'undefined') {
                if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
                else apply();
            }
        } catch (_) {}
    }

    var QuotaGuard = {
        CONTACT_EMAIL: CONTACT_EMAIL,
        ANON_LIMIT: ANON_LIMIT,
        WINDOW_MS: WINDOW_MS,
        init: init,
        refreshAuth: refreshAuth,
        getUserTokenSync: getUserTokenSync,
        preCheckSync: preCheckSync,
        syncFromHeaders: syncFromHeaders,
        isQuotaError: isQuotaError,
        isLocked: isLocked,
        lockTablet: lockTablet,
        unlockTablet: unlockTablet,
        reapplyLock: reapplyLock,
        showModal: showModal,
        closeModal: closeModal,
        closeTabletAndFocusDiagnosis: closeTabletAndFocusDiagnosis,
        // Internes exposés pour tests (ne pas utiliser dans le jeu)
        _parseState: parseState,
        _mailtoHref: mailtoHref
    };

    G.QuotaGuard = QuotaGuard;
    // Démarrage différé : supabase/config se chargent avant ce script dans game.html.
    try {
        if (typeof document !== 'undefined' && document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else { init(); }
    } catch (_) {}

    return QuotaGuard;
})();
