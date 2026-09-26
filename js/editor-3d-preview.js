/**
 * js/editor-3d-preview.js — Mini-prévisualisateur 3D temps réel pour MedStudio
 * Charge et affiche le modèle Kenney du patient dans une carte compacte
 * située directement à côté du sélecteur "Modèle 3D Patient".
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene = null;
let camera = null;
let renderer = null;
let pivotGroup = null;
let animId = null;
let mixer = null;

let isDragging = false;
let startX = 0;
let currentRotY = 0;
let autoRotate = true;
let autoResumeTimer = null;
let currentLoadedFile = null;
let loadRequestId = 0;

// Cache des objets GLTF bruts (non clonés pour préserver l'armature et les skins)
const modelCache = new Map();
const gltfLoader = new GLTFLoader();

/**
 * Résout le fichier .glb Kenney selon la sélection manuelle ou l'algorithme automatique
 */
export function resolvePatientModel(model3D, sexe, age, prenom) {
    if (model3D && model3D.trim()) {
        return { fileName: model3D.trim(), isAuto: false };
    }
    const gender = (sexe || 'M').toUpperCase();
    const isFemale = gender === 'F' || gender === 'FEMME';
    const ageNum = parseInt(age, 10);
    const validAge = isNaN(ageNum) ? 40 : ageNum;

    let variant = 'a';
    if (validAge < 30) {
        variant = (prenom || 'Jean').length % 2 === 0 ? 'a' : 'b';
    } else if (validAge < 60) {
        variant = (prenom || 'Jean').length % 2 === 0 ? 'c' : 'd';
    } else {
        variant = (prenom || 'Jean').length % 2 === 0 ? 'e' : 'f';
    }
    const fileName = isFemale ?
        `character-female-${variant}.glb` :
        `character-male-${variant}.glb`;

    return { fileName, isAuto: true, variant };
}

/**
 * Initialise la scène Three.js, les lumières et la boucle de rendu pour la vignette
 */
export function initModel3DPreview() {
    const canvas = document.getElementById('model3d-canvas');
    const container = document.getElementById('model3d-preview-card');
    if (!canvas || !container) return;

    const width = container.clientWidth || 130;
    const height = container.clientHeight || 155;

    // Scène
    scene = new THREE.Scene();

    // Caméra avec FOV modéré pour éviter la distorsion perspective
    camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 30);
    camera.position.set(0, 0, 1.7);
    camera.lookAt(0, 0, 0);

    // Moteur de rendu WebGL
    try {
        renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height, false);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
    } catch (e) {
        console.warn('[editor-3d-preview] WebGL non disponible pour la prévisualisation:', e);
        showFallbackIcon();
        return;
    }

    // Groupe pivot centré en (0, 0, 0)
    pivotGroup = new THREE.Group();
    scene.add(pivotGroup);

    // Éclairage studio 3 points équilibré
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334466, 0.8);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(2, 3, 3);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x70b5ff, 1.1);
    fillLight.position.set(-2.5, 1, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffeedd, 0.9);
    rimLight.position.set(0, 2.5, -2.5);
    scene.add(rimLight);

    // Interactions drag / rotation manuelle
    setupInteractions(container);

    // Bouton de réinitialisation
    const resetBtn = document.getElementById('model3d-btn-reset');
    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetRotation();
        });
    }

    container.addEventListener('dblclick', () => resetRotation());

    // Boucle d'animation fluide
    let lastTime = performance.now();
    function animate(now) {
        animId = requestAnimationFrame(animate);
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        // Mise à jour de l'animation osseuse (idle)
        if (mixer) {
            mixer.update(dt);
        }

        // Rotation automatique douce (turntable)
        if (autoRotate && pivotGroup) {
            pivotGroup.rotation.y += 0.7 * dt;
        }

        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    }
    animate(performance.now());

    // Déclencher la première mise à jour
    updatePreview();

    // Écouter les changements des champs associés
    const modelSelect = document.getElementById('patient-model3d');
    const sexeSelect = document.getElementById('patient-sexe');
    const ageInput = document.getElementById('patient-age');
    const prenomInput = document.getElementById('patient-prenom');

    [modelSelect, sexeSelect].forEach(el => {
        el?.addEventListener('change', () => updatePreview());
    });

    [ageInput, prenomInput].forEach(el => {
        el?.addEventListener('input', () => updatePreview());
        el?.addEventListener('change', () => updatePreview());
    });

    // Observer les redimensionnements du conteneur
    if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
            if (!container || !renderer || !camera) return;
            const w = container.clientWidth || 130;
            const h = container.clientHeight || 155;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h, false);
        });
        ro.observe(container);
    }
}

/**
 * Configure les événements pointer pour faire pivoter le modèle
 */
function setupInteractions(container) {
    container.addEventListener('pointerdown', (e) => {
        isDragging = true;
        startX = e.clientX;
        currentRotY = pivotGroup ? pivotGroup.rotation.y : 0;
        autoRotate = false;
        if (autoResumeTimer) clearTimeout(autoResumeTimer);
        container.setPointerCapture?.(e.pointerId);
    });

    container.addEventListener('pointermove', (e) => {
        if (!isDragging || !pivotGroup) return;
        const dx = e.clientX - startX;
        pivotGroup.rotation.y = currentRotY + dx * 0.02;
    });

    const endDrag = (e) => {
        if (!isDragging) return;
        isDragging = false;
        try { container.releasePointerCapture?.(e.pointerId); } catch {}
        if (autoResumeTimer) clearTimeout(autoResumeTimer);
        autoResumeTimer = setTimeout(() => {
            autoRotate = true;
        }, 2200);
    };

    container.addEventListener('pointerup', endDrag);
    container.addEventListener('pointercancel', endDrag);
}

function resetRotation() {
    if (!pivotGroup) return;
    pivotGroup.rotation.y = 0;
    autoRotate = false;
    if (autoResumeTimer) clearTimeout(autoResumeTimer);
    autoResumeTimer = setTimeout(() => {
        autoRotate = true;
    }, 2200);
}

function showFallbackIcon() {
    const card = document.getElementById('model3d-preview-card');
    if (card) {
        card.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#00f2fe; font-size:1.8rem; gap:6px;">
                <i class="fas fa-cube"></i>
                <span style="font-size:0.65rem; color:#94a3b8; font-family:sans-serif;">Aperçu 3D</span>
            </div>
        `;
    }
}

/**
 * Met à jour le modèle affiché en fonction des valeurs actuelles du formulaire
 */
export function updatePreview() {
    const modelSelect = document.getElementById('patient-model3d');
    const sexeSelect = document.getElementById('patient-sexe');
    const ageInput = document.getElementById('patient-age');
    const prenomInput = document.getElementById('patient-prenom');

    const model3D = modelSelect ? modelSelect.value : '';
    const sexe = sexeSelect ? sexeSelect.value : 'M';
    const age = ageInput ? ageInput.value : '40';
    const prenom = prenomInput ? prenomInput.value : '';

    const { fileName, isAuto } = resolvePatientModel(model3D, sexe, age, prenom);

    // Mettre à jour le badge d'information
    const badgeText = document.getElementById('model3d-badge-text');
    if (badgeText) {
        badgeText.textContent = isAuto ? `Auto : ${fileName}` : `Sélection : ${fileName}`;
        badgeText.title = `Fichier chargé : assets/models/patients/${fileName}`;
    }

    // Charger le modèle 3D
    loadModel(fileName);
}

/**
 * Charge un fichier GLB depuis assets/models/patients/ et l'affiche au centre
 */
function loadModel(fileName) {
    if (!pivotGroup) return;
    if (currentLoadedFile === fileName && pivotGroup.children.length > 0) return;

    const loaderEl = document.getElementById('model3d-loader');
    const reqId = ++loadRequestId;

    // Afficher le spinner de chargement si pas déjà en cache
    if (!modelCache.has(fileName) && loaderEl) {
        loaderEl.classList.add('active');
    }

    // Modèle en cache : affichage direct sans clonage pour préserver le rigging
    if (modelCache.has(fileName)) {
        displayModel(modelCache.get(fileName), fileName);
        if (loaderEl) loaderEl.classList.remove('active');
        return;
    }

    // Téléchargement du GLB
    const url = `assets/models/patients/${fileName}`;
    gltfLoader.load(
        url,
        (gltf) => {
            if (reqId !== loadRequestId) return;
            modelCache.set(fileName, gltf);
            displayModel(gltf, fileName);
            if (loaderEl) loaderEl.classList.remove('active');
        },
        undefined,
        (err) => {
            if (reqId !== loadRequestId) return;
            console.error(`[editor-3d-preview] Erreur chargement ${url}:`, err);
            if (loaderEl) loaderEl.classList.remove('active');
        }
    );
}

/**
 * Positionne, centre et anime le modèle dans le pivotGroup
 */
function displayModel(gltf, fileName) {
    if (!pivotGroup) return;

    // Arrêter le mixer précédent
    if (mixer) {
        mixer.stopAllAction();
        mixer = null;
    }

    // Vider l'ancien modèle du pivot
    while (pivotGroup.children.length > 0) {
        const obj = pivotGroup.children[0];
        pivotGroup.remove(obj);
    }

    const model = gltf.scene;

    // Activer matériaux et ombres propres
    model.traverse((child) => {
        if (child.isMesh && child.material) {
            child.material.roughness = Math.min(child.material.roughness ?? 0.8, 0.85);
            child.material.metalness = Math.max(child.material.metalness ?? 0.05, 0.05);
            child.castShadow = false;
            child.receiveShadow = false;
        }
    });

    // Orienter face à la caméra (les modèles Kenney regardent vers -Z, Math.PI les fait regarder vers +Z)
    model.rotation.set(0, Math.PI, 0);

    // Lancer l'animation 'idle' pour abaisser les bras naturellement (adieu la T-pose !)
    if (gltf.animations && gltf.animations.length > 0) {
        const idleClip = gltf.animations.find(a => a.name === 'idle') || gltf.animations[0];
        if (idleClip) {
            mixer = new THREE.AnimationMixer(model);
            const action = mixer.clipAction(idleClip);
            action.play();
            // Ralentir l'animation pour un mouvement de respiration subtil et calme
            mixer.timeScale = 0.35;
            // Faire avancer d'une fraction de seconde pour poser immédiatement l'armature
            mixer.update(0.1);
        }
    }

    // Calculer les dimensions réelles pour un centrage vertical et horizontal parfait
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);

    // Si le modèle a des dimensions valides
    const height = Math.max(box.max.y - box.min.y, 0.7);
    const centerY = (box.min.y + box.max.y) / 2;
    const centerX = (box.min.x + box.max.x) / 2;
    const centerZ = (box.min.z + box.max.z) / 2;

    // Centrer le modèle exactement en (0, 0, 0)
    model.position.set(-centerX, -centerY, -centerZ);

    pivotGroup.add(model);
    currentLoadedFile = fileName;

    // Ajuster précisément la distance caméra pour cadrer le modèle entier avec 15% de marge
    if (camera) {
        const fovRad = (camera.fov * Math.PI) / 180;
        // Hauteur cadrée avec marge généreuse en haut et en bas (la tête et les pieds sont 100% visibles)
        const desiredDistance = (height / 2) / Math.tan(fovRad / 2) * 1.35;
        camera.position.set(0, 0, Math.max(desiredDistance, 1.55));
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
    }
}

// Exposer globalement pour interconnexion avec editor.js
if (typeof window !== 'undefined') {
    window.updatePatientModel3DPreview = updatePreview;
}

// Auto-démarrage dès que le DOM est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initModel3DPreview, 50);
    });
} else {
    setTimeout(initModel3DPreview, 50);
}
