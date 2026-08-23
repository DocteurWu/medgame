/**
 * three-loaders.js — Loaders Three.js partagés pour MedGame
 *
 * - Un unique GLTFLoader avec décompression Draco (décodeur hébergé localement)
 * - Un OBJLoader partagé
 * - Un LoadingManager commun qui alimente l'écran de chargement progressif (#3d-loading)
 *
 * Tous les modules 3D doivent importer ces loaders au lieu d'en instancier
 * leurs propres copies : cela centralise le suivi de progression et évite
 * de re-télécharger le décodeur Draco.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/**
 * Manager partagé : compte tous les assets passant par les loaders ci-dessous.
 * Alimente la barre de progression de l'écran de chargement.
 */
export const loadingManager = new THREE.LoadingManager();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('assets/libs/draco/');

export const gltfLoader = new GLTFLoader(loadingManager);
gltfLoader.setDRACOLoader(dracoLoader);

export const objLoader = new OBJLoader(loadingManager);

// ============================================================
// ÉCRAN DE CHARGEMENT PROGRESSIF
// ============================================================

let _overlayReady = false;
let _hidden = false;
const MIN_DISPLAY_MS = 800;
const SAFETY_TIMEOUT_MS = 12000;

function _ensureOverlayDOM() {
    let overlay = document.getElementById('3d-loading');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = '3d-loading';
    overlay.innerHTML = `
        <div class="ld-box">
            <div class="ld-logo"><i class="fas fa-heart-pulse"></i></div>
            <div class="ld-title">Préparation du cabinet…</div>
            <div class="ld-bar"><div class="ld-bar-fill" id="ld-bar-fill"></div></div>
            <div class="ld-pct" id="ld-pct">0%</div>
            <div class="ld-hint">Chargement des modèles 3D et des textures</div>
        </div>
        <style>
            #3d-loading {
                position: fixed; inset: 0; z-index: 9500;
                background: radial-gradient(ellipse at center, rgba(13,20,38,0.96), rgba(5,8,18,0.99));
                display: flex; align-items: center; justify-content: center;
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                transition: opacity 0.45s ease;
            }
            #3d-loading.ld-hidden { opacity: 0; pointer-events: none; }
            #3d-loading .ld-box {
                text-align: center; color: #e0e8f4;
                padding: 28px 44px; border-radius: 18px;
                background: linear-gradient(160deg, rgba(12,22,48,0.85), rgba(8,14,32,0.8));
                border: 1px solid rgba(120,190,255,0.25);
                box-shadow: 0 12px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06);
            }
            #3d-loading .ld-logo { font-size: 34px; color: #00f2fe; margin-bottom: 10px;
                animation: ld-pulse 1.6s ease-in-out infinite; }
            @keyframes ld-pulse { 0%,100% { transform: scale(1); opacity: 0.85; } 50% { transform: scale(1.12); opacity: 1; } }
            #3d-loading .ld-title { font-weight: 700; font-size: 15px; margin-bottom: 14px; letter-spacing: 0.3px; }
            #3d-loading .ld-bar {
                width: 240px; height: 7px; margin: 0 auto 8px auto;
                background: rgba(255,255,255,0.09); border-radius: 99px; overflow: hidden;
            }
            #3d-loading .ld-bar-fill {
                height: 100%; width: 0%;
                background: linear-gradient(90deg, #00c6ff, #0072ff);
                border-radius: 99px; transition: width 0.25s ease;
            }
            #3d-loading .ld-pct { font-size: 12px; color: #88ccff; font-weight: 600; }
            #3d-loading .ld-hint { margin-top: 10px; font-size: 11px; color: rgba(255,255,255,0.42); font-style: italic; }
        </style>
    `;
    document.body.appendChild(overlay);
    return overlay;
}

/**
 * Initialise l'écran de chargement et branche les événements du manager.
 * À appeler UNE fois, avant la création de la scène 3D.
 */
export function initLoadingOverlay() {
    if (_overlayReady) return;
    _overlayReady = true;

    const overlay = _ensureOverlayDOM();
    const barFill = () => document.getElementById('ld-bar-fill');
    const pctEl = () => document.getElementById('ld-pct');
    const shownAt = performance.now();
    _hidden = false;

    loadingManager.onProgress = (_url, loaded, total) => {
        if (_hidden || !total) return;
        const pct = Math.min(100, Math.round((loaded / Math.max(1, total)) * 100));
        const bar = barFill(); const pctNode = pctEl();
        if (bar) bar.style.width = pct + '%';
        if (pctNode) pctNode.textContent = pct + '%';
    };

    const hide = () => {
        if (_hidden) return;
        _hidden = true;
        const elapsed = performance.now() - shownAt;
        const wait = Math.max(0, MIN_DISPLAY_MS - elapsed);
        setTimeout(() => {
            overlay.classList.add('ld-hidden');
            setTimeout(() => overlay.remove(), 600);
        }, wait);
    };

    loadingManager.onLoad = hide;
    loadingManager.onError = (url) => {
        console.warn('[ThreeLoaders] Échec asset (continué):', url);
    };

    // Garde-fou : ne jamais bloquer le jeu si un asset reste coincé
    setTimeout(hide, SAFETY_TIMEOUT_MS);
}
