/**
 * three-atlas-overlay.js — Overlay "Voir en 3D" dans game.html (Phase 2).
 * Écoute `medgame:open-atlas` { focus, systems } → monte un ThreeAtlasViewer compact isolé,
 * sans quitter la partie (timer/score préservés). dispose() complet à la fermeture.
 * Usage depuis three-clinical-agent.js : document.dispatchEvent(new CustomEvent('medgame:open-atlas', { detail: {...} }))
 */
import { fetchAtlasIndex, fetchAtlasBuffers } from './three-atlas-loader.js?v=4';
import { ThreeAtlasViewer } from './three-atlas-scene.js?v=6';
import { expandQuery, frenchLabel } from './three-atlas-data.js?v=6';

let viewer = null;
let ATLAS = null;
let buffers = null;
let overlayEl = null;
let loading = null;

function ensureOverlayDOM() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement('div');
    overlayEl.id = 'atlas-overlay';
    overlayEl.style.cssText = `position:fixed;inset:0;z-index:12000;display:none;align-items:center;justify-content:center;background:rgba(3,6,14,0.82);backdrop-filter:blur(6px);`;
    overlayEl.innerHTML = `
        <div style="width:min(920px,94vw);height:min(640px,88vh);background:rgba(8,14,32,0.97);border:1px solid rgba(0,242,254,0.35);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 80px rgba(0,0,0,0.6);">
            <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid rgba(0,242,254,0.2);">
                <span style="color:#00f2fe;font-weight:800;letter-spacing:1px;font-size:13px;">🧠 ATLAS 3D — RÉFÉRENCE</span>
                <span id="atlas-overlay-label" style="font-size:12px;opacity:0.7;"></span>
                <button id="atlas-overlay-close" style="margin-left:auto;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;">✕ Fermer</button>
            </div>
            <div style="display:flex;flex:1;min-height:0;">
                <div id="atlas-overlay-view" style="flex:1;position:relative;min-width:0;"></div>
                <div style="width:240px;padding:14px;border-left:1px solid rgba(0,242,254,0.2);font-size:12px;line-height:1.6;overflow-y:auto;">
                    <div style="color:#00f2fe;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Fiche</div>
                    <div id="atlas-overlay-detail" style="margin-top:6px;">Chargement…</div>
                    <a href="atlas.html" target="_blank" style="color:#00f2fe;font-size:12px;">Ouvrir l'atlas complet →</a>
                    <div style="margin-top:10px;opacity:0.55;font-size:11px;">BodyParts3D 4.0 © DBCLS — CC BY 4.0. Référence homme adulte, éducatif.</div>
                </div>
            </div>
            <div id="atlas-overlay-load" style="position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(5,8,15,0.85);color:#88ccff;font-size:13px;">Chargement de l'anatomie… (~33 Mo 1ère fois)</div>
        </div>`;
    document.body.appendChild(overlayEl);
    overlayEl.querySelector('#atlas-overlay-close').onclick = closeAtlasOverlay;
    overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) closeAtlasOverlay(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlayEl.style.display !== 'none') closeAtlasOverlay(); });
    return overlayEl;
}

function findBestPart(focus) {
    if (!ATLAS || !focus) return null;
    const tokens = expandQuery(focus);
    let best = null;
    let bestScore = -1;
    for (const p of ATLAS.parts) {
        const hay = (p.name + ' ' + p.id).toLowerCase();
        tokens.forEach((t, ti) => {
            if (t && hay.includes(t)) {
                const s = 100 - ti * 5;
                if (s > bestScore) { bestScore = s; best = p; }
            }
        });
    }
    return best;
}

export async function openAtlasOverlay({ focus = 'heart', systems = null, label = '' } = {}) {
    ensureOverlayDOM();
    overlayEl.style.display = 'flex';
    overlayEl.querySelector('#atlas-overlay-label').textContent = label || focus;
    const loadEl = overlayEl.querySelector('#atlas-overlay-load');
    const view = overlayEl.querySelector('#atlas-overlay-view');
    try {
        loadEl.style.display = 'flex';
        if (!ATLAS) ATLAS = await fetchAtlasIndex();
        if (!buffers) buffers = await fetchAtlasBuffers(ATLAS, () => {}, null);
        if (!viewer) {
            viewer = new ThreeAtlasViewer(view, {
                onSelect: (id, part) => {
                    const fr = frenchLabel(part.name);
                    overlayEl.querySelector('#atlas-overlay-detail').innerHTML = `<b>${fr || part.name}</b><br><span style="opacity:0.6">${fr ? part.name + ' · ' : ''}${part.system}</span>`;
                },
            });
            await viewer.loadAtlas(ATLAS, buffers);
        }
        const part = findBestPart(focus);
        const vis = systems || (part ? [...new Set([part.system, 'skeletal'])] : undefined);
        if (vis) viewer.setState({ visible: vis, isolate: false });
        if (part) {
            viewer.setState({ selected: [part.id], isolate: true });
            viewer.select(part.id);
            const fr = frenchLabel(part.name);
            overlayEl.querySelector('#atlas-overlay-detail').innerHTML = `<b>${fr || part.name}</b><br><span style="opacity:0.6">${fr ? part.name + ' · ' : ''}${part.system}</span>`;
        }
    } catch (e) {
        console.error(e);
        overlayEl.querySelector('#atlas-overlay-detail').textContent = 'Échec : ' + (e.message || e);
    } finally {
        loadEl.style.display = 'none';
    }
}

export function closeAtlasOverlay() {
    if (!overlayEl) return;
    overlayEl.style.display = 'none';
    try { viewer?.setState({ isolate: false, rotate: false }); } catch {}
    // On garde viewer + buffers en cache (pas de dispose ici pour réouverture instantanée).
    // Dispose complet si besoin : window.__atlasDispose()
    window.__atlasOverlayOpen = false;
}

window.__atlasDispose = () => { try { viewer?.dispose(); } catch {} viewer = null; buffers = null; ATLAS = null; };

document.addEventListener('medgame:open-atlas', (e) => openAtlasOverlay(e.detail || {}));
