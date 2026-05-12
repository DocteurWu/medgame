/**
 * three-lock-agent.js — Agent de verrous visuels 3D (Cadenas animés, progression)
 * Atelier 2: Jouabilité & Fun par Cas
 * 
 * Synchronise le lockSystem 2D avec la scène 3D :
 * - Cadenas lumineux flottants sur les sections verrouillées
 * - Animation de déverrouillage (éclat lumineux + disparition)
 * - Notification HUD quand on s'approche d'un objet verrouillé
 * - Illumination progressive des sections déverrouillées
 */

import * as THREE from 'three';
import { pulseEmissive } from './three-animations.js';

/** Positions 3D associées aux champs verrouillés */
const LOCK_POSITIONS = {
    'interrogatoire.antecedents': { x: 2.1, y: 1.7, z: -1.5, label: 'Antécédents' },
    'interrogatoire.traitements': { x: 2.3, y: 1.5, z: -1.3, label: 'Traitements' },
    'interrogatoire.verbatim': { x: 1.9, y: 1.6, z: -1.6, label: 'Verbatim' },
    'interrogatoire.modeDeVie': { x: 2.4, y: 1.4, z: -1.2, label: 'Mode de vie' },
    'interrogatoire.allergies': { x: 2.5, y: 1.3, z: -1.1, label: 'Allergies' },
    'interrogatoire.histoireMaladie': { x: 2.0, y: 1.55, z: -1.4, label: 'Histoire' },
    'interrogatoire.histoireMaladie.remarques': { x: 2.0, y: 1.65, z: -1.45, label: 'Remarques' },
    'examenClinique.constantes': { x: -1.55, y: 1.4, z: -0.7, label: 'Constantes' },
    'examenClinique.cardiovasculaire': { x: -1.3, y: 1.3, z: -0.8, label: 'Cardio' },
    'examenClinique.pulmonaire': { x: -1.0, y: 1.3, z: -0.8, label: 'Pulmonaire' },
    'examenClinique.abdominal': { x: -0.5, y: 1.3, z: -0.8, label: 'Abdominal' },
    'examenClinique.neurologique': { x: 0.0, y: 1.3, z: -0.8, label: 'Neuro' },
    'examResults': { x: -0.8, y: 1.5, z: -0.6, label: 'Examens' },
};

/** Trouve la position 3D la plus pertinente pour un chemin de champ */
function getLockPosition(fieldPath) {
    // Recherche exacte d'abord
    if (LOCK_POSITIONS[fieldPath]) return LOCK_POSITIONS[fieldPath];
    // Recherche par préfixe (ex: "examResults.ECG" → "examResults")
    const parts = fieldPath.split('.');
    for (let i = parts.length - 1; i >= 1; i--) {
        const prefix = parts.slice(0, i).join('.');
        if (LOCK_POSITIONS[prefix]) return LOCK_POSITIONS[prefix];
    }
    // Position par défaut proche du patient
    return { x: 2.0, y: 1.7, z: -1.4, label: fieldPath.split('.').pop() };
}

export class ThreeLockAgent {
    /**
     * @param {import('./three-scene.js').ThreeScene} threeScene
     * @param {import('./three-hud-agent.js').ThreeHUD} hud
     */
    constructor(threeScene, hud) {
        this.scene = threeScene;
        this.hud = hud;
        this.locks = new Map(); // lockId -> { mesh, light, glowMesh, field }
        this.group = new THREE.Group();
        this.group.name = 'LockGroup';
        this.scene.scene.add(this.group);
        this._animateId = null;
        this._currentCase = null;
    }

    /**
     * Charge les verrous du cas courant et crée les cadenas 3D
     * @param {Object} caseData - Données du cas clinique
     */
    loadCase(caseData) {
        // Retirer les anciens cadenas
        this.clearAll();
        this._currentCase = caseData;

        if (!caseData || !caseData.locks || !Array.isArray(caseData.locks)) return;

        caseData.locks.forEach(lock => {
            if (this._isUnlocked(lock.id)) {
                // Déjà déverrouillé — on illumine la section
                this._illuminateSection(lock);
                return;
            }
            this._createLock(lock);
        });

        // Démarrer l'animation continue
        this._startAnimation();
    }

    /**
     * Vérifie si un verrou est déverrouillé
     */
    _isUnlocked(lockId) {
        if (typeof lockSystem !== 'undefined' && lockSystem.unlockedLocks instanceof Set) {
            return lockSystem.unlockedLocks.has(lockId);
        }
        // Fallback : vérifier sessionStorage
        try {
            const saved = JSON.parse(sessionStorage.getItem('unlockedLocks') || '[]');
            return saved.includes(lockId);
        } catch {
            return false;
        }
    }

    /**
     * Crée un cadenas 3D flottant au-dessus de la zone verrouillée
     * @param {Object} lock - Objet verrou du cas
     */
    _createLock(lock) {
        // Trouver la position 3D associée au champ verrouillé
        const targetField = lock.target_fields?.[0] || '';
        const pos = getLockPosition(targetField);
        const label = pos.label || lock.id;

        const lockGroup = new THREE.Group();
        lockGroup.position.set(pos.x, pos.y, pos.z);
        lockGroup.name = `Lock3D_${lock.id}`;

        // --- Corps du cadenas (anneau + boîtier) ---
        // Boîtier principal
        const bodyGeo = new THREE.BoxGeometry(0.14, 0.10, 0.06);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0xff4757,
            metalness: 0.6,
            roughness: 0.3,
            emissive: 0xff2040,
            emissiveIntensity: 0.3,
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        lockGroup.add(body);

        // Anneau du cadenas (torus)
        const shackleGeo = new THREE.TorusGeometry(0.04, 0.012, 8, 16, Math.PI);
        const shackleMat = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.8,
            roughness: 0.2,
            emissive: 0x444444,
            emissiveIntensity: 0.1,
        });
        const shackle = new THREE.Mesh(shackleGeo, shackleMat);
        shackle.position.y = 0.07;
        shackle.rotation.x = Math.PI / 2;
        lockGroup.add(shackle);

        // Icône "?" sur le boîtier (plane avec texture canvas)
        const iconCanvas = document.createElement('canvas');
        iconCanvas.width = 64;
        iconCanvas.height = 48;
        const ctx = iconCanvas.getContext('2d');
        // Fond rouge foncé
        ctx.fillStyle = '#cc2030';
        ctx.fillRect(0, 0, 64, 48);
        // Point d'interrogation blanc
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 32, 24);
        // Bordure
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, 62, 46);

        const iconTexture = new THREE.CanvasTexture(iconCanvas);
        const iconPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(0.12, 0.09),
            new THREE.MeshBasicMaterial({ map: iconTexture, transparent: true })
        );
        iconPlane.position.z = 0.032;
        // S'assurer que l'icône fait face à la caméra — face au joueur
        lockGroup.add(iconPlane);

        // --- Lueur (glow) autour du cadenas ---
        const glowGeo = new THREE.SphereGeometry(0.18, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xff4757,
            transparent: true,
            opacity: 0.12,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const glowMesh = new THREE.Mesh(glowGeo, glowMat);
        glowMesh.name = `LockGlow_${lock.id}`;
        lockGroup.add(glowMesh);

        // --- Lumière ponctuelle rouge subtile ---
        const lockLight = new THREE.PointLight(0xff4757, 0.4, 2.5);
        lockLight.position.set(0, 0.05, 0);
        lockGroup.add(lockLight);

        // --- Label flottant au-dessus ---
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 256;
        labelCanvas.height = 64;
        const lctx = labelCanvas.getContext('2d');
        lctx.fillStyle = 'rgba(255, 71, 87, 0.85)';
        const tw = lctx.measureText(label).width;
        const rx = 10;
        const ry = 10;
        const bw = Math.min(236, tw + 40);
        const bh = 44;
        const bx = (256 - bw) / 2;
        const by = 10;
        lctx.beginPath();
        lctx.roundRect(bx, by, bw, bh, rx);
        lctx.fill();
        lctx.fillStyle = '#ffffff';
        lctx.font = 'bold 22px Inter, sans-serif';
        lctx.textAlign = 'center';
        lctx.textBaseline = 'middle';
        lctx.fillText(`🔒 ${label}`, 128, by + bh / 2);

        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(0.5, 0.12),
            new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true, depthWrite: false })
        );
        labelPlane.position.y = 0.16;
        labelPlane.name = `LockLabel_${lock.id}`;
        lockGroup.add(labelPlane);

        this.group.add(lockGroup);

        // Stocker la référence
        this.locks.set(lock.id, {
            group: lockGroup,
            body,
            shackle,
            glowMesh,
            light: lockLight,
            iconPlane,
            labelPlane,
            field: targetField,
            label,
            unlockAnimating: false,
        });

        // Rendre le cadenas interactif (clic pour déclencher le défi)
        body.userData = {
            interactive: true,
            label: `Défi : ${label}`,
            lockId: lock.id,
        };
        this.scene.collectInteractive();
    }

    /**
     * Anime tous les cadenas (flottement, pulsation lumineuse)
     */
    _startAnimation() {
        if (this._animateId) return;
        const clock = new THREE.Clock();

        const animate = () => {
            if (!this.locks.size) {
                this._animateId = null;
                return;
            }
            const elapsed = clock.getElapsedTime();
            this.locks.forEach((lockData, lockId) => {
                if (lockData.unlockAnimating) return;
                // Flottement vertical
                const float = Math.sin(elapsed * 2 + lockId.length) * 0.03;
                lockData.group.position.y += float * 0.05;

                // Pulsation du glow
                const pulse = 0.08 + Math.sin(elapsed * 3 + lockId.length * 0.7) * 0.06;
                lockData.glowMesh.material.opacity = pulse;

                // Pulsation de la lumière
                lockData.light.intensity = 0.3 + Math.sin(elapsed * 3 + lockId.length * 0.7) * 0.15;

                // L'étiquette fait face à la caméra
                if (this.scene._camera) {
                    lockData.labelPlane.lookAt(this.scene._camera.position);
                    lockData.iconPlane.lookAt(this.scene._camera.position);
                }

                // Respiration de l'anneau
                lockData.shackle.scale.setScalar(1 + Math.sin(elapsed * 4 + lockId.length) * 0.05);
            });

            this._animateId = requestAnimationFrame(animate);
        };
        this._animateId = requestAnimationFrame(animate);
    }

    /**
     * Anime le déverrouillage d'un cadenas : éclat lumineux + dissolution
     * @param {string} lockId - ID du verrou
     */
    animateUnlock(lockId) {
        const lockData = this.locks.get(lockId);
        if (!lockData || lockData.unlockAnimating) return;

        lockData.unlockAnimating = true;
        const group = lockData.group;
        const startTime = performance.now();
        const duration = 1200;

        // Trouver le lock dans currentCase pour illuminer la section
        const caseLocks = this._currentCase?.locks || [];
        const lock = caseLocks.find(l => l.id === lockId);

        // 1) Flash lumineux blanc
        const flashLight = new THREE.PointLight(0x2ecc71, 2, 5);
        flashLight.position.copy(group.position);
        this.scene.scene.add(flashLight);

        // 2) Flash vert sur le glow
        lockData.glowMesh.material.color.set(0x2ecc71);
        lockData.glowMesh.material.opacity = 0.5;
        lockData.glowMesh.scale.setScalar(2);

        // 3) Changer la couleur du boîtier en vert
        lockData.body.material.color.set(0x2ecc71);
        lockData.body.material.emissive.set(0x20cc51);

        // 4) Notification HUD
        if (this.hud) {
            this.hud.showNotification(`✅ Déverrouillé : ${lockData.label}`, 'success');
        }

        const animateFrame = () => {
            const now = performance.now();
            const t = Math.min(1, (now - startTime) / duration);
            const easeOut = 1 - Math.pow(1 - t, 3);

            // Réduction de l'échelle du groupe (disparition)
            group.scale.setScalar(1 - easeOut);

            // Rotation rapide du cadenas
            group.rotation.y += 0.15;
            group.rotation.z = easeOut * Math.PI * 0.5;

            // Le glow grossit puis s'estompe
            const glowScale = 2 + easeOut * 3;
            lockData.glowMesh.scale.setScalar(glowScale);
            lockData.glowMesh.material.opacity = 0.5 * (1 - easeOut);

            // La lumière flash s'estompe
            flashLight.intensity = 2 * (1 - easeOut);

            // Le groupe monte légèrement
            group.position.y += 0.003;

            if (t < 1) {
                requestAnimationFrame(animateFrame);
            } else {
                // Fin de l'animation : retirer le cadenas
                this.scene.scene.remove(flashLight);
                flashLight.dispose();
                this._removeLock(lockId);

                // Illuminer la section déverrouillée
                if (lock) {
                    this._illuminateSection(lock);
                }
            }
        };
        requestAnimationFrame(animateFrame);
    }

    /**
     * Crée un effet de lumière/illumination sur la zone du cadenas déverrouillé
     * @param {Object} lock - Objet verrou déverrouillé
     */
    _illuminateSection(lock) {
        const targetField = lock.target_fields?.[0] || '';
        const pos = getLockPosition(targetField);

        // Lumière verte permanente (marqueur de section déverrouillée)
        const sectionLight = new THREE.PointLight(0x2ecc71, 0.25, 3);
        sectionLight.position.set(pos.x, pos.y, pos.z);
        sectionLight.name = `SectionLight_${lock.id}`;
        this.scene.scene.add(sectionLight);

        // Petite particule/point de lumière indicateur
        const indicatorGeo = new THREE.SphereGeometry(0.03, 8, 8);
        const indicatorMat = new THREE.MeshBasicMaterial({
            color: 0x2ecc71,
            transparent: true,
            opacity: 0.7,
            depthWrite: false,
        });
        const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
        indicator.position.set(pos.x, pos.y + 0.15, pos.z);
        indicator.name = `SectionIndicator_${lock.id}`;
        this.scene.scene.add(indicator);
    }

    /**
     * Supprime un cadenas de la scène et des références
     */
    _removeLock(lockId) {
        const lockData = this.locks.get(lockId);
        if (!lockData) return;

        // Retirer le group de la scène
        this.group.remove(lockData.group);

        // Disposer les géométries et matériaux
        lockData.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });

        this.locks.delete(lockId);

        // Mettre à jour les objets interactifs
        this.scene.collectInteractive();
    }

    /**
     * Supprime tous les cadenas et les lumières de section
     */
    clearAll() {
        if (this._animateId) {
            cancelAnimationFrame(this._animateId);
            this._animateId = null;
        }

        // Supprimer tous les cadenas
        this.locks.forEach((lockData, lockId) => {
            this._removeLock(lockId);
        });

        // Supprimer les lumières de section
        const toRemove = [];
        this.scene.scene.traverse(child => {
            if (child.name && (child.name.startsWith('SectionLight_') || child.name.startsWith('SectionIndicator_'))) {
                toRemove.push(child);
            }
        });
        toRemove.forEach(child => {
            this.scene.scene.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });

        this._currentCase = null;
    }

    /**
     * Gère le clic sur un cadenas 3D — ouvre le défi
     * @param {THREE.Object3D} object - Objet cliqué
     */
    handleLockClick(object) {
        const lockId = object?.userData?.lockId;
        if (!lockId) return false;

        // Déclencher le défi sémiologique 2D
        if (typeof showLockChallenge === 'function') {
            showLockChallenge(lockId);
            return true;
        }
        return false;
    }

    /**
     * Met à jour l'état des cadenas après un déverrouillage
     * À appeler quand lockSystem signale un déverrouillage
     */
    refreshState() {
        if (!this._currentCase || !this._currentCase.locks) return;

        this._currentCase.locks.forEach(lock => {
            const isUnlocked = this._isUnlocked(lock.id);
            const existsInScene = this.locks.has(lock.id);

            if (isUnlocked && existsInScene) {
                // Déverrouillé récemment — animer la suppression
                this.animateUnlock(lock.id);
            } else if (!isUnlocked && !existsInScene) {
                // Pas encore déverrouillé et pas dans la scène — créer
                this._createLock(lock);
            }
        });

        // Redémarrer l'animation continue si nécessaire
        if (this.locks.size > 0 && !this._animateId) {
            this._startAnimation();
        }
    }
}

// Écouter les événements de déverrouillage du lockSystem
document.addEventListener('locksystem-unlock', (e) => {
    if (window.threeLockAgent) {
        // Petit délai pour laisser le temps au DOM de se mettre à jour
        setTimeout(() => window.threeLockAgent.refreshState(), 300);
    }
});

// Intégration avec ThreeManager — hook dans le click 3D
const _origOnClick = null; // sera branché par three-manager

/**
 * Fonction d'initialisation pour connecter le ThreeLockAgent au ThreeManager
 * Appelée depuis three-manager.js après l'initialisation de la scène
 */
export function initLockAgent3D(threeManager) {
    const lockAgent = new ThreeLockAgent(threeManager.scene, threeManager.hud);
    window.threeLockAgent = lockAgent;

    // Hook le click 3D pour intercepter les clics sur les cadenas
    const origOnClick = threeManager.scene.onClick.bind(threeManager.scene);
    threeManager.scene.onClick = function(event) {
        const hit = threeManager.scene.pick(event);
        if (hit && hit.object?.userData?.lockId) {
            return lockAgent.handleLockClick(hit.object);
        }
        return origOnClick(event);
    };

    // Charger les verrous quand un cas est chargé
    const origLoadCase = threeManager.loadCase.bind(threeManager);
    threeManager.loadCase = function(caseData) {
        origLoadCase(caseData);
        lockAgent.loadCase(caseData);
    };

    return lockAgent;
}