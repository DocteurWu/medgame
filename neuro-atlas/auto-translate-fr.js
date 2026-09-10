/**
 * auto-translate-fr.js — Traduction automatique FR des fiches longues du neuro-atlas,
 * 100 % côté navigateur, sans clé API, gratuite.
 *
 * Principe : les noms/titres sont déjà en français via content.fr.json + dictionnaire
 * curé (neuro-atlas/data/i18n/fr/). Seuls les longs paragraphes restés en anglais
 * (summary, anatomy, function, imaging, clinique) sont traduits à la volée via
 * l'endpoint public Google Translate (client=gtx, CORS ouvert), puis mis en cache
 * (localStorage) pour une traduction instantanée aux visites suivantes.
 * En cas d'échec réseau, le texte anglais d'origine reste affiché : jamais de casse.
 *
 * Portée : fiche détaillée (#right) + barre syndromique (#syndrome-bar) uniquement.
 * Les noms courts, sigles (ASA, PICA, CN VII), latin et libellés déjà FR sont ignorés.
 * Licence : vit dans neuro-atlas/ (périmètre Apache/CC BY-SA), aucune donnée
 * traduite n'est copiée dans le moteur MedGame GPL.
 */
(function () {
  'use strict';

  var PREF_KEY = 'neuro-auto-fr';
  var CACHE_KEY = 'neuro-fr-cache-v1';
  var CACHE_MAX = 2000;
  var MIN_LEN = 40; // en dessous : probablement un nom/libellé déjà FR → on ignore
  var BATCH_URL_BUDGET = 6000; // longueur d'URL max par requête (limite GET)
  var BATCH_DELAY_MS = 350;
  var EN_WORDS = /\b(the|and|with|from|that|which|through|between|within|during|into|their|lesion|artery|nerve|tract|nucleus)\b/i;
  var HAS_ACCENT = /[éèêàâùûôîçœæ]/;
  // Sigles / codes à ne jamais traduire
  var SKIP_RE = /^(CN\s*[IVX]+|C\d+(-T\d+|-C\d+)?|T\d+(-L\d+)?|L\d+(-S\d+)?|ASA|PICA|AICA|SCA|MCA|ACA|ACP|ACM|FLAIR|DWI|T1w?|T2w?|MNI|EDN|R2C|IN[OS]|V\d+)$/i;

  function prefEnabled() {
    try {
      var v = localStorage.getItem(PREF_KEY);
      if (v !== null) return v === '1';
    } catch (e) { /* stockage indisponible */ }
    // Défaut : actif si le navigateur est en français ou ?lang=fr
    try {
      if (/[?&]lang=fr\b/.test(location.search)) return true;
    } catch (e) { /* ignore */ }
    return (navigator.language || '').toLowerCase().indexOf('fr') === 0;
  }

  var enabled = prefEnabled();
  var offline = false; // coupe les appels après un échec réseau (session)

  var cache = {};
  try {
    cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {};
  } catch (e) { cache = {}; }

  function saveCache() {
    try {
      var keys = Object.keys(cache);
      if (keys.length > CACHE_MAX) {
        // éviction simple des plus anciennes (ordre d'insertion)
        var drop = keys.slice(0, keys.length - CACHE_MAX);
        for (var i = 0; i < drop.length; i++) delete cache[drop[i]];
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) { /* quota plein → on garde le cache mémoire */ }
  }

  function looksEnglish(s) {
    if (!s || s.length < MIN_LEN) return false;
    if (HAS_ACCENT.test(s)) return false; // déjà français (ou latin accentué)
    if (SKIP_RE.test(s.trim())) return false;
    return EN_WORDS.test(s);
  }

  // File d'attente : texte EN -> liste de nœuds à mettre à jour
  var pending = new Map();
  var timer = null;
  var translating = false;

  function queueNode(node, text) {
    var t = text.trim().replace(/\s+/g, ' ');
    if (!t || cache[t]) {
      if (cache[t]) applyTranslation(node, cache[t]);
      return;
    }
    if (!pending.has(t)) pending.set(t, []);
    var list = pending.get(t);
    if (list.indexOf(node) < 0) list.push(node);
    if (!timer) timer = setTimeout(flush, 400);
  }

  function applyTranslation(node, fr) {
    if (!node.isConnected) return;
    if (node.nodeType === 3) {
      if (!node.__frDone) {
        node.__frSrc = node.nodeValue;
        node.__frDone = true;
      }
      node.nodeValue = fr;
    } else if (node.nodeType === 1) {
      if (!node.hasAttribute('data-fr-auto')) {
        node.setAttribute('data-fr-src', node.textContent.slice(0, 200));
        node.setAttribute('data-fr-auto', '1');
      }
      node.textContent = fr;
    }
  }

  function flush() {
    timer = null;
    if (translating || pending.size === 0 || offline || !enabled) return;
    translating = true;
    // Découpe en lots compatibles GET
    var batches = [];
    var cur = [];
    var curLen = 0;
    pending.forEach(function (nodes, text) {
      var cost = encodeURIComponent(text).length + 3;
      if (cur.length && curLen + cost > BATCH_URL_BUDGET) {
        batches.push(cur);
        cur = [];
        curLen = 0;
      }
      cur.push([text, nodes]);
      curLen += cost;
    });
    if (cur.length) batches.push(cur);
    pending.clear();
    runBatches(batches, 0);
  }

  function runBatches(batches, i) {
    if (i >= batches.length) {
      translating = false;
      saveCache();
      if (pending.size) timer = setTimeout(flush, 400);
      return;
    }
    translateBatch(batches[i]).then(function () {
      setTimeout(function () { runBatches(batches, i + 1); }, BATCH_DELAY_MS);
    });
  }

  function translateBatch(items) {
    var params = 'client=gtx&sl=en&tl=fr&dt=t';
    for (var i = 0; i < items.length; i++) params += '&q=' + encodeURIComponent(items[i][0]);
    return fetch('https://translate.googleapis.com/translate_a/single?' + params)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        // data = [ [ [trad, src, ...], ... ], ... ] pour q multiples, ou flat pour q unique
        var out = Array.isArray(data[0]) && typeof data[0][0] === 'string'
          ? [flattenSentences(data[0])]
          : data.map(function (block) { return flattenSentences(block); });
        for (var k = 0; k < items.length; k++) {
          var fr = out[k] || items[k][0];
          cache[items[k][0]] = fr;
          var nodes = items[k][1];
          for (var n = 0; n < nodes.length; n++) applyTranslation(nodes[n], fr);
        }
      })
      .catch(function () {
        // Hors ligne / quota : on ré-enfile pour plus tard et on coupe les appels (session)
        offline = true;
        setBadge('hors ligne');
      });
  }

  function flattenSentences(block) {
    if (!Array.isArray(block)) return '';
    var s = '';
    for (var i = 0; i < block.length; i++) {
      if (Array.isArray(block[i]) && typeof block[i][0] === 'string') s += block[i][0];
    }
    return s;
  }

  function collect(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'PRE') return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest('[data-no-auto-fr]')) return NodeFilter.FILTER_REJECT;
        if (node.__frDone) return NodeFilter.FILTER_REJECT;
        var t = node.nodeValue;
        if (!t || !t.trim()) return NodeFilter.FILTER_REJECT;
        if (!looksEnglish(t)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) nodes.push(n);
    for (var i = 0; i < nodes.length; i++) queueNode(nodes[i], nodes[i].nodeValue);
  }

  var observer = null;
  function start() {
    var scopes = [];
    ['right', 'syndrome-bar'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) scopes.push(el);
    });
    if (!scopes.length) {
      setTimeout(start, 800); // bundle pas encore rendu → réessai
      return;
    }
    scopes.forEach(collect);
    observer = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'childList') {
          for (var a = 0; a < m.addedNodes.length; a++) {
            var nd = m.addedNodes[a];
            if (nd.nodeType === 3) {
              if (looksEnglish(nd.nodeValue)) queueNode(nd, nd.nodeValue);
            } else if (nd.nodeType === 1 && nd.isConnected) {
              collect(nd);
            }
          }
        } else if (m.type === 'characterData') {
          var t = m.target;
          if (t && !t.__frDone && looksEnglish(t.nodeValue)) queueNode(t, t.nodeValue);
        }
      }
    });
    scopes.forEach(function (el) {
      observer.observe(el, { childList: true, subtree: true, characterData: true });
    });
  }

  function stop() {
    if (observer) { observer.disconnect(); observer = null; }
    if (timer) { clearTimeout(timer); timer = null; }
    pending.clear();
  }

  // Pastille ON/OFF discrète
  var badge = null;
  function setBadge(state) {
    if (!badge) return;
    badge.textContent = state === 'off' ? 'FR auto : OFF' : state === 'hors ligne' ? 'FR auto : hors ligne' : 'FR auto : ON';
    badge.style.opacity = state === 'on' ? '0.85' : '1';
  }
  function mountBadge() {
    badge = document.createElement('button');
    badge.type = 'button';
    badge.title = 'Traduction automatique français des fiches (Google Trad, cache local). Cliquer pour activer/désactiver (recharge la page).';
    badge.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:9999;font-size:11px;padding:4px 10px;border-radius:999px;border:1px solid rgba(216,181,101,.6);background:rgba(20,20,30,.85);color:#e8d9a0;cursor:pointer;';
    badge.addEventListener('click', function () {
      try { localStorage.setItem(PREF_KEY, enabled ? '0' : '1'); } catch (e) { /* ignore */ }
      location.reload();
    });
    document.body.appendChild(badge);
    setBadge(enabled ? 'on' : 'off');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      mountBadge();
      if (enabled) start();
    });
  } else {
    mountBadge();
    if (enabled) start();
  }
})();
