/**
 * atlas.js — UI page Atlas 3D MedGame (vanilla).
 * Recherche FR/EN (alias), filtres systèmes, presets, explode, isolate, fiche, deep-link.
 */
import { fetchAtlasIndex, fetchAtlasBuffers, ATLAS_SOURCES, getAtlasSource } from './three-atlas-loader.js?v=11';
import { ThreeAtlasViewer } from './three-atlas-scene.js?v=12';
import { SYSTEMS, DEFAULT_VISIBLE, explanationFr, expandQuery, normalizeFr, frenchLabel } from './three-atlas-data.js?v=11';
import { HEART_PRESETS } from './atlas-heartbeat.js?v=1';

const $ = (id) => document.getElementById(id);
const viewport = $('atlas-viewport');
const params = new URLSearchParams(location.search);

const viewer = new ThreeAtlasViewer(viewport, {
    onSelect: (id, part) => showDetail(id),
    onError: (msg) => showError(typeof msg === 'string' ? msg : msg?.message || msg),
});

let ATLAS = null;
let partById = new Map();
let conceptById = new Map();
let currentModel = 'male';
let currentAbort = null;

function showError(msg) {
    $('atlas-error').innerHTML = `<div class="atlas-error">⚠️ ${msg}<br><button class="atlas-btn" onclick="location.reload()">Réessayer</button></div>`;
    $('atlas-loading')?.classList.add('hidden');
}

function setProgress(done, total) {
    const pct = Math.round((done / Math.max(1, total)) * 100);
    const bar = $('atlas-bar');
    const tx = $('atlas-pct');
    if (bar) bar.style.width = pct + '%';
    if (tx) tx.textContent = pct + '%';
}

// ---------- systèmes ----------
function renderSystems() {
    const box = $('atlas-systems');
    box.innerHTML = '';
    SYSTEMS.forEach((s) => {
        const count = ATLAS ? ATLAS.parts.filter((p) => p.system === s.id).length : 0;
        const row = document.createElement('div');
        row.className = 'sys-row' + (viewer.state.visible.includes(s.id) ? '' : ' off');
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');
        row.innerHTML = `<span class="sys-dot" style="background:${s.color}"></span><span>${s.name}</span><span class="count">${count}</span>`;
        const toggle = () => {
            const v = new Set(viewer.state.visible);
            if (v.has(s.id)) v.delete(s.id);
            else v.add(s.id);
            viewer.setState({ visible: [...v], isolate: false });
            row.classList.toggle('off');
        };
        row.onclick = toggle;
        row.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } };
        box.appendChild(row);
    });
}

$('preset-all').onclick = () => { closeHeartMode(); viewer.setState({ visible: SYSTEMS.map((s) => s.id), isolate: false }); renderSystems(); };
$('preset-skeleton').onclick = () => { closeHeartMode(); viewer.setState({ visible: ['skeletal', 'connective'], isolate: false }); renderSystems(); };
$('preset-organs').onclick = () => { closeHeartMode(); viewer.setState({ visible: ['cardiac', 'respiratory', 'digestive', 'urinary', 'lymphatic', 'endocrine'], isolate: false }); renderSystems(); };
$('preset-vessels').onclick = () => { closeHeartMode(); viewer.setState({ visible: ['arterial', 'venous', 'cardiac'], isolate: false }); renderSystems(); };
$('sys-all').onclick = () => { viewer.setState({ visible: SYSTEMS.map((s) => s.id), isolate: false }); renderSystems(); };
$('sys-none').onclick = () => { viewer.setState({ visible: [], isolate: false }); renderSystems(); };
$('atlas-explode').oninput = (e) => viewer.setState({ explode: e.target.value / 100 });
$('btn-rotate').onclick = (e) => {
    const on = !viewer.state.rotate;
    viewer.setState({ rotate: on });
    e.target.classList.toggle('active', on);
};
$('btn-reset').onclick = () => {
    closeHeartMode();
    viewer.setState({ visible: [...DEFAULT_VISIBLE], selected: [], isolate: false, explode: 0, view: 'three-quarter' });
    $('atlas-explode').value = 0;
    renderSystems();
    showDetail(null);
};
$('btn-isolate').onclick = () => { if (viewer.state.selected.length) viewer.setState({ isolate: true }); };
$('btn-show').onclick = () => {
    closeHeartMode();
    viewer.setState({ isolate: false });
};

// ---------- Mode Cœur Isolé & ECG Synchronisé ----------
let ecgRafId = null;

function updateHeartbeatUI() {
    const on = viewer.heartbeatEnabled;
    const btnMain = $('btn-heartbeat');
    if (btnMain) {
        btnMain.classList.toggle('active', on);
        btnMain.innerHTML = on ? '<i class="fas fa-heart-pulse"></i> Battement : Actif' : '<i class="far fa-heart"></i> Battement : Coupé';
    }
    const btnPanel = $('btn-heartbeat-panel');
    if (btnPanel) {
        btnPanel.innerHTML = on ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
        btnPanel.title = on ? 'Suspendre le battement' : 'Relancer le battement';
    }
    const badge = $('heart-live-badge');
    if (badge) {
        badge.textContent = on ? '● SYNCHRO QRS' : '○ EN PAUSE';
        badge.style.color = on ? '#00f2fe' : '#ff8577';
    }
}

function selectHeartPreset(presetId) {
    viewer.setHeartPreset(presetId);
    const preset = HEART_PRESETS[presetId] || HEART_PRESETS.sinus;

    document.querySelectorAll('.heart-preset-card').forEach((card) => {
        card.classList.toggle('active', card.dataset.preset === presetId);
    });

    const titleEl = $('heart-edu-title');
    if (titleEl) titleEl.textContent = preset.title;
    const descEl = $('heart-edu-desc');
    if (descEl) descEl.textContent = preset.description;
    const hrEl = $('heart-hr-value');
    if (hrEl) hrEl.textContent = `${preset.bpm} BPM`;
}

function startEcgLoop() {
    if (ecgRafId) return;
    const canvas = $('heart-ecg-canvas');
    const step = () => {
        if (!viewer.isHeartIsolated) {
            ecgRafId = null;
            return;
        }
        if (canvas && viewer._heartSync) {
            viewer._heartSync.renderScope(canvas);
        }
        ecgRafId = requestAnimationFrame(step);
    };
    ecgRafId = requestAnimationFrame(step);
}

let currentModule = 'body'; // 'body' | 'heart' | 'neuro'

function setModuleUI(module) {
    currentModule = module;
    $('btn-module-body')?.classList.toggle('active', module === 'body');
    $('btn-module-heart')?.classList.toggle('active', module === 'heart');
    $('btn-module-neuro')?.classList.toggle('active', module === 'neuro');
    $('btn-neuro-nav-body')?.classList.toggle('active', module === 'body');
    $('btn-neuro-nav-heart')?.classList.toggle('active', module === 'heart');
    $('btn-neuro-nav-neuro')?.classList.toggle('active', module === 'neuro');
}

function openHeartMode(presetId = 'sinus') {
    if (currentModule === 'neuro') closeNeuroMode(false);
    viewer.isolateHeart(true, presetId);
    selectHeartPreset(presetId);
    $('heart-mode-panel')?.classList.remove('hidden');
    startEcgLoop();
    updateHeartbeatUI();
    setModuleUI('heart');
}

function closeHeartMode(restoreModule = true) {
    viewer.isolateHeart(false);
    $('heart-mode-panel')?.classList.add('hidden');
    if (ecgRafId) {
        cancelAnimationFrame(ecgRafId);
        ecgRafId = null;
    }
    renderSystems();
    if (restoreModule && currentModule === 'heart') {
        setModuleUI('body');
    }
}

function openNeuroMode(subHash = '') {
    if (currentModule === 'heart') closeHeartMode(false);
    const container = $('neuro-atlas-container');
    const iframe = $('neuro-atlas-frame');
    const layout = document.querySelector('.atlas-layout');
    if (container && iframe) {
        container.classList.remove('hidden');
        // Forcer le reflow pour que la transition CSS opère avec fluidité
        void container.offsetWidth;
        container.classList.add('active');
        if (layout) layout.classList.add('neuro-mode-active');
        let targetSrc = 'neuro-atlas/index.html';
        if (subHash) {
            targetSrc += subHash.startsWith('#') ? subHash : `#${subHash}`;
        }
        const currentSrc = iframe.getAttribute('src');
        if (!currentSrc || currentSrc === 'about:blank') {
            iframe.src = targetSrc;
        } else if (subHash && iframe.contentWindow) {
            try {
                iframe.contentWindow.location.hash = subHash.startsWith('#') ? subHash : `#${subHash}`;
            } catch {
                iframe.src = targetSrc;
            }
        }
    }
    setModuleUI('neuro');
}

function closeNeuroMode(restoreModule = true) {
    const container = $('neuro-atlas-container');
    const layout = document.querySelector('.atlas-layout');
    if (container) {
        container.classList.remove('active');
        setTimeout(() => {
            if (!container.classList.contains('active')) {
                container.classList.add('hidden');
            }
        }, 350);
    }
    if (layout) {
        layout.classList.remove('neuro-mode-active');
    }
    if (restoreModule) {
        setModuleUI('body');
    }
}

$('btn-heartbeat')?.addEventListener('click', () => {
    viewer.setHeartbeat(!viewer.heartbeatEnabled);
    updateHeartbeatUI();
});

$('btn-heartbeat-panel')?.addEventListener('click', () => {
    viewer.setHeartbeat(!viewer.heartbeatEnabled);
    updateHeartbeatUI();
});

$('btn-module-body')?.addEventListener('click', () => {
    if (currentModule === 'heart') closeHeartMode(false);
    if (currentModule === 'neuro') closeNeuroMode(false);
    setModuleUI('body');
});
$('btn-module-heart')?.addEventListener('click', () => openHeartMode('sinus'));
$('btn-module-neuro')?.addEventListener('click', () => openNeuroMode());
$('preset-neuro')?.addEventListener('click', () => openNeuroMode());
$('btn-neuro-exit')?.addEventListener('click', () => closeNeuroMode(true));

$('btn-neuro-nav-body')?.addEventListener('click', () => {
    closeNeuroMode(true);
});
$('btn-neuro-nav-heart')?.addEventListener('click', () => {
    closeNeuroMode(false);
    openHeartMode('sinus');
});
$('btn-neuro-nav-neuro')?.addEventListener('click', () => {
    // Déjà dans le module neuro
});

$('btn-heart-mode')?.addEventListener('click', () => openHeartMode('sinus'));
$('preset-heart')?.addEventListener('click', () => openHeartMode('sinus'));
$('btn-heart-exit')?.addEventListener('click', () => closeHeartMode(true));

document.querySelectorAll('.heart-preset-card').forEach((card) => {
    card.addEventListener('click', () => {
        selectHeartPreset(card.dataset.preset);
    });
});

// ---------- recherche FR ----------
function findMatches(query, limit = 30) {
    const tokens = expandQuery(query);
    if (!tokens.length || !ATLAS) return [];
    const scored = [];
    for (const p of ATLAS.parts) {
        const hay = (p.name + ' ' + (conceptById.get(p.conceptId)?.name || '') + ' ' + p.id).toLowerCase();
        let score = -1;
        tokens.forEach((t, ti) => {
            if (t && hay.includes(t)) score = Math.max(score, 100 - ti * 5 - hay.indexOf(t) * 0.01);
        });
        if (score >= 0) scored.push({ part: p, score });
    }
    scored.sort((a, b) => b.score - a.score);
    const seen = new Set();
    const out = [];
    for (const s of scored) {
        if (seen.has(s.part.conceptId)) continue;
        seen.add(s.part.conceptId);
        out.push(s.part);
        if (out.length >= limit) break;
    }
    return out;
}

$('atlas-search').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    const box = $('atlas-results');
    if (q.length < 2) { box.innerHTML = ''; return; }
    const hits = findMatches(q, 12);
    box.innerHTML = '';
    if (!hits.length) { box.innerHTML = '<div style="font-size:12px;opacity:0.6;">Aucun résultat. Essaie : coeur, foie, poumon, rein.</div>'; return; }
    hits.forEach((p) => {
        const c = conceptById.get(p.conceptId);
        const en = c?.name || p.name;
        const fr = frenchLabel(en);
        const d = document.createElement('div');
        d.className = 'sys-row';
        d.innerHTML = `<span>🔎</span><span>${fr || en}${fr ? ` <span style="opacity:0.5;font-size:11px;">(${en})</span>` : ''}</span>`;
        d.onclick = () => {
            viewer.setState({ visible: [...new Set([...viewer.state.visible, p.system])], isolate: false });
            showDetail(p.id);
            renderSystems();
        };
        box.appendChild(d);
    });
});

// ---------- fiche ----------
function showDetail(partId) {
    const box = $('atlas-detail');
    const meta = $('atlas-meta');
    if (!partId || !ATLAS) {
        box.innerHTML = '<h2>Aucune sélection</h2><p>Clique sur une structure du corps, ou cherche <em>cœur</em>, <em>foie</em>, <em>poumon</em>…</p>';
        meta.textContent = '';
        return;
    }
    const part = partById.get(partId) || ATLAS.parts.find((p) => p.conceptId === partId) || ATLAS.parts.find((p) => p.id === partId);
    if (!part) return;
    viewer.select(part.id);
    const concept = conceptById.get(part.conceptId);
    const sys = SYSTEMS.find((s) => s.id === part.system);
    const en = concept?.name || part.name;
    const fr = frenchLabel(en);
    const title = fr || en;
    const subtitle = fr
        ? `${en} · ${part.id}`
        : `${part.id} · <span style="opacity:0.7;">nom anatomique international</span>`;
    const desc = explanationFr(en);
    const isCardiacPart = (part.system === 'cardiac') || (viewer._heartPartIndices && viewer._heartPartIndices.has(partById.get(part.id)?.index));
    const heartActionBtn = isCardiacPart
        ? `<div style="margin-top:10px;"><button class="atlas-btn" id="btn-cardiac-mode" style="width:100%;border-color:rgba(224,96,85,0.7);color:#ff8577;font-weight:700;"><i class="fas fa-heart-pulse"></i> Mode Cœur & ECG synchro</button></div>`
        : '';
    box.innerHTML = `<div class="sys">${sys?.name || part.system}</div><h2>${title}</h2><div style="font-size:11px;opacity:0.55;margin-bottom:6px;">${subtitle}</div>${desc ? `<p>${desc}</p>` : ''}${heartActionBtn}`;
    meta.textContent = `${concept ? concept.elements.length + ' fragment(s) · ' : ''}${part.vertexCount} sommets`;
    $('btn-cardiac-mode')?.addEventListener('click', () => openHeartMode('sinus'));
}

// ---------- pavé tactile + clavier ----------
// Flèches = orbite (souris difficile), + / - = zoom, R = recentre, Espace = rotation auto.
const NAV_STEP = 0.18;
document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
        const nav = btn.dataset.nav;
        if (nav === 'up') viewer.panY(0.15);
        else if (nav === 'down') viewer.panY(-0.15);
        else if (nav === 'left') viewer.orbitBy(-NAV_STEP, 0);
        else if (nav === 'right') viewer.orbitBy(NAV_STEP, 0);
        else if (nav === 'zin') viewer.zoomBy(1.25);
        else if (nav === 'zout') viewer.zoomBy(0.8);
        else if (nav === 'front') viewer.viewTo('front');
        else if (nav === 'reset') viewer.resetView();
    });
});
document.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    if (e.key === 'ArrowLeft') { viewer.orbitBy(-NAV_STEP, 0); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { viewer.orbitBy(NAV_STEP, 0); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { viewer.panY(0.15); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { viewer.panY(-0.15); e.preventDefault(); }
    else if (e.key === '+' || e.key === '=') viewer.zoomBy(1.25);
    else if (e.key === '-' || e.key === '_') viewer.zoomBy(0.8);
    else if (e.key === 'r' || e.key === 'R') viewer.resetView();
    else if (e.key === ' ') {
        const on = !viewer.state.rotate;
        viewer.setState({ rotate: on });
        $('btn-rotate')?.classList.toggle('active', on);
        e.preventDefault();
    }
});

// ---------- changement de modèle anatomique (Homme / Femme) ----------
async function loadModel(modelId, initialDeepLink = false) {
    if (currentAbort) {
        try { currentAbort.abort(); } catch {}
    }
    currentAbort = new AbortController();
    const signal = currentAbort.signal;
    currentModel = modelId === 'female' ? 'female' : 'male';
    const isFemale = currentModel === 'female';
    const src = getAtlasSource(currentModel);

    // Mettre à jour l'état actif des boutons et la mention discrète
    $('btn-model-male')?.classList.toggle('active', !isFemale);
    $('btn-model-female')?.classList.toggle('active', isFemale);
    const disclaimerEl = $('atlas-disclaimer-note');
    if (disclaimerEl) {
        disclaimerEl.textContent = isFemale 
            ? "Comporte des inexactitudes" 
            : "Peut comporter des inexactitudes";
    }

    // Mettre à jour l'écran de chargement
    const loading = $('atlas-loading');
    if (loading) {
        loading.classList.remove('hidden');
        const titleEl = loading.querySelector('div[style*="font-weight:700"]');
        const noteEl = loading.querySelector('div[style*="opacity:0.6"]');
        if (titleEl) {
            titleEl.textContent = isFemale 
                ? "Chargement de l'anatomie (♀)…" 
                : "Chargement de l'anatomie (♂)…";
        }
        if (noteEl) {
            noteEl.innerHTML = isFemale
                ? `${src.approxSize}. Mis en cache ensuite. Comporte des inexactitudes.`
                : `${src.approxSize}. Mis en cache ensuite. Peut comporter des inexactitudes.`;
        }
    }
    setProgress(0, 1);

    // Mettre à jour le footer avec les crédits et la mention discrète
    const footerText = $('atlas-footer-text');
    if (footerText) {
        if (isFemale) {
            footerText.innerHTML = `Données <a href="https://hubmapconsortium.org/" target="_blank" rel="noopener">HuBMAP</a> & <a href="https://lifesciencedb.jp/bp3d/" target="_blank" rel="noopener">BodyParts3D</a> © DBCLS — <a href="https://creativecommons.org/licenses/by/4.0/deed.fr" target="_blank" rel="noopener">CC BY 4.0</a>, via <a href="${src.repoUrl}" target="_blank" rel="noopener">Female Atlas</a>.<br>Explorateur éducatif · Comporte des inexactitudes.`;
        } else {
            footerText.innerHTML = `Données <a href="https://lifesciencedb.jp/bp3d/" target="_blank" rel="noopener">BodyParts3D 4.0</a> © DBCLS — <a href="https://creativecommons.org/licenses/by/4.0/deed.fr" target="_blank" rel="noopener">CC BY 4.0</a>, via <a href="${src.repoUrl}" target="_blank" rel="noopener">Human Atlas</a>.<br>Explorateur éducatif · Peut comporter des inexactitudes.`;
        }
    }

    // Réinitialiser la recherche et la fiche
    showDetail(null);
    const resultsBox = $('atlas-results');
    if (resultsBox) resultsBox.innerHTML = '';
    const searchInput = $('atlas-search');
    if (searchInput) searchInput.value = '';
    const errorBox = $('atlas-error');
    if (errorBox) errorBox.innerHTML = '';

    try {
        const atlas = await fetchAtlasIndex(currentModel, signal);
        if (signal.aborted) return;
        ATLAS = atlas;
        partById.clear();
        conceptById.clear();
        atlas.parts.forEach((p) => partById.set(p.id, p));
        (atlas.concepts || []).forEach((c) => conceptById.set(c.id, c));
        $('atlas-meta').textContent = `${atlas.parts.length} structures · ${atlas.concepts?.length || '?'} concepts · ${atlas.triangles?.toLocaleString('fr-FR') || ''} triangles`;
        renderSystems();

        const buffers = await fetchAtlasBuffers(atlas, setProgress, signal, currentModel);
        if (signal.aborted) return;
        await viewer.loadAtlas(atlas, buffers);
        setProgress(1, 1);
        loading?.classList.add('hidden');
        renderSystems();

        if (initialDeepLink) {
            const sys = params.get('system');
            const focus = params.get('focus');
            const explode = parseFloat(params.get('explode') || '0');
            if (sys) viewer.setState({ visible: sys.split(',').map((s) => s.trim()).filter(Boolean) });
            if (!Number.isNaN(explode) && explode > 0) {
                viewer.setState({ explode: Math.min(1, explode) });
                $('atlas-explode').value = Math.min(100, explode * 100);
            }
            if (focus) {
                const hits = findMatches(focus, 5);
                if (hits[0]) {
                    viewer.setState({ visible: [...new Set([...viewer.state.visible, hits[0].system])] });
                    renderSystems();
                    showDetail(hits[0].id);
                }
            }

            const moduleParam = params.get('module') || params.get('mode');
            if (moduleParam === 'neuro' || params.get('neuro') === '1' || params.get('neuro') === 'true') {
                const rawHash = location.hash || '';
                const neuroHash = rawHash.startsWith('#/') ? rawHash : (params.get('target') ? `#/${params.get('target')}` : '');
                openNeuroMode(neuroHash);
            } else {
                const heartParam = params.get('heart') || params.get('cardio');
                const presetParam = params.get('preset');
                if (heartParam === '1' || heartParam === 'true' || params.get('mode') === 'heart' || presetParam) {
                    const targetPreset = presetParam && HEART_PRESETS[presetParam] ? presetParam : 'sinus';
                    openHeartMode(targetPreset);
                }
            }
        }
    } catch (e) {
        if (e.name === 'AbortError' || signal.aborted) return;
        console.error(e);
        showError(e.message || `Échec du chargement de l'atlas (${currentModel}). Vérifie ta connexion.`);
    }
}

$('btn-model-male')?.addEventListener('click', () => {
    if (currentModel !== 'male') loadModel('male');
});
$('btn-model-female')?.addEventListener('click', () => {
    if (currentModel !== 'female') loadModel('female');
});

// ---------- boot ----------
(function boot() {
    window.addEventListener('beforeunload', () => { try { viewer.dispose(); } catch {} });
    const initModel = (params.get('model') || params.get('sex') || 'male').toLowerCase() === 'female' ? 'female' : 'male';
    loadModel(initModel, true);
})();
