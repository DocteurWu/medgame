import * as THREE from 'three';

/**
 * three-animations.js — Moteur d'animations pour MedGame 3D
 * Gère : respiration patient, clignements yeux, expressions dynamiques,
 *         cycle de marche médecin, mouvements idle, animations d'objets
 */

// ===== FONCTIONS UTILITAIRES =====

/**
 * Easing in-out quadratique
 */
export function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Pulse émissif sur un mesh (flash lumineux ponctuel)
 */
export function pulseEmissive(mesh, intensity = 1.2, duration = 900) {
    if (!mesh || !mesh.material || !('emissiveIntensity' in mesh.material)) return;
    const start = performance.now();
    const base = mesh.material.emissiveIntensity || 0;
    function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        mesh.material.emissiveIntensity = base + Math.sin(t * Math.PI) * intensity;
        if (t < 1) requestAnimationFrame(frame);
        else mesh.material.emissiveIntensity = base;
    }
    requestAnimationFrame(frame);
}

// ===== ANIMATEUR DE PATIENT =====

/**
 * Classe qui anime le patient : respiration, clignements, micro-mouvements
 * Usage :
 *   const animator = new PatientAnimator(patientGroup);
 *   // dans la boucle de rendu :
 *   animator.update(elapsed, deltaTime);
 */
export class PatientAnimator {
    /**
     * @param {THREE.Group} patientGroup — groupe retourné par ThreePatient
     * @param {Object} options — { breathRate, blinkInterval, expression }
     */
    constructor(patientGroup, options = {}) {
        this.group = patientGroup;
        this.breathRate = options.breathRate || 1.2;     // cycles/seconde (respiration normale)
        this.breathAmplitude = options.breathAmplitude || 0.012; // amplitude Y
        this.breathTorsoScale = options.breathTorsoScale || 0.008; // dilatation torse
        this.blinkInterval = options.blinkInterval || 4.0; // secondes entre clignements
        this.currentExpression = options.expression || 'normal';
        this.targetExpression = null;
        this.expressionBlend = 0;  // 0 = current, 1 = target
        this._blinkTimer = Math.random() * this.blinkInterval;
        this._isBlinking = false;
        this._blinkPhase = 0;
        this._headSwayPhase = Math.random() * Math.PI * 2;
        this._lastTime = 0;

        // Cache des références (résolution paresiveuse)
        this._torso = null;
        this._head = null;
        this._eyeL = null;
        this._eyeR = null;
        this._mouth = null;
        this._browL = null;
        this._browR = null;
        this._cacheResolved = false;
    }

    /** Résout les références aux mesh enfants */
    _resolveReferences() {
        if (this._cacheResolved) return;
        // Stocker le Y initial du groupe avant toute animation
        if (this._baseY === undefined) {
            this._baseY = this.group.position.y;
        }

        const eyes = [];
        this.group.traverse((child) => {
            if (!child.isMesh && !child.isGroup) return;
            const name = (child.name || '').toLowerCase();
            const label = (child.userData?.label || '').toLowerCase();

            if (name.includes('torse') || label.includes('torse')) {
                this._torso = child;
            } else if (name.includes('tete') || name.includes('tête') || label.includes('tete') || label.includes('tête')) {
                this._head = child;
            } else if (name.includes('oeil') || label.includes('oeil') || name.includes('oei')) {
                eyes.push(child);
            } else if (name.includes('bouche') || label.includes('bouche')) {
                this._mouth = child;
            }
        });

        // Assigner les yeux par position (le plus petit x = gauche)
        if (eyes.length >= 2) {
            eyes.sort((a, b) => a.position.x - b.position.x);
            this._eyeL = eyes[0];
            this._eyeR = eyes[1];
        } else if (eyes.length === 1) {
            // Un seul œil trouvé — probablement l'œil gauche, cloner la réf
            this._eyeL = eyes[0];
            this._eyeR = eyes[0];
        }

        this._cacheResolved = true;
    }

    /**
     * Mise à jour de toutes les animations du patient
     * @param {number} elapsed — temps absolu en secondes
     * @param {number} dt — deltaTime en secondes
     */
    update(elapsed, dt) {
        this._resolveReferences();
        const safeDt = Math.min(dt || 0.016, 0.05);

        this._animateBreathing(elapsed);
        this._animateBlink(elapsed, safeDt);
        this._animateHeadSway(elapsed);
        this._animateExpressionBlend(safeDt);
    }

    /** Respiration : léger mouvement de haut en bas + dilatation torse */
    _animateBreathing(t) {
        // Stocker le Y initial du groupe avant toute animation (patient assis/couché)
        if (this._baseY === undefined) {
            this._baseY = this.group.position.y;
        }
        // Oscillation douce du corps entier
        const breathY = Math.sin(t * this.breathRate * Math.PI * 2) * this.breathAmplitude;
        this.group.position.y = this._baseY + breathY;

        // Dilatation du torse (scale X/Z qui augmente à l'inspi, diminue à l'expir)
        if (this._torso) {
            const phase = Math.sin(t * this.breathRate * Math.PI * 2);
            const expand = 1 + phase * this.breathTorsoScale;
            this._torso.scale.x = expand;
            this._torso.scale.z = expand;
        }
    }

    /** Clignement des yeux : fermeture rapide puis ouverture */
    _animateBlink(t, dt) {
        this._blinkTimer -= dt;

        if (this._blinkTimer <= 0 && !this._isBlinking) {
            this._isBlinking = true;
            this._blinkPhase = 0;
        }

        if (this._isBlinking) {
            this._blinkPhase += dt * 8; // durée ~0.25s
            // Fermé à 0.3, réouvert à 0.7
            let scale;
            if (this._blinkPhase < 0.3) {
                // Fermeture
                scale = 1 - (this._blinkPhase / 0.3) * 0.85;
            } else if (this._blinkPhase < 0.7) {
                // Reste fermé brièvement
                scale = 0.15;
            } else if (this._blinkPhase < 1.0) {
                // Réouverture
                scale = 0.15 + ((this._blinkPhase - 0.7) / 0.3) * 0.85;
            } else {
                scale = 1;
                this._isBlinking = false;
                // Prochain clignement dans 3-6 secondes (aléatoire)
                this._blinkTimer = this.blinkInterval + (Math.random() - 0.5) * 2;
            }

            if (this._eyeL) this._eyeL.scale.y = scale;
            if (this._eyeR) this._eyeR.scale.y = scale;
        }
    }

    /** Léger balancement de tête (micro-mouvement naturel) */
    _animateHeadSway(t) {
        if (!this._head) return;
        // Micro-rotation douce
        this._head.rotation.y = Math.sin(t * 0.3 + this._headSwayPhase) * 0.03;
        this._head.rotation.x = Math.sin(t * 0.2 + this._headSwayPhase * 1.3) * 0.015;
    }

    /**
     * Change l'expression du patient avec une transition douce
     * @param {string} expressionName — nom de l'expression cible
     * @param {number} duration — durée de transition en secondes
     */
    setExpression(expressionName, duration = 0.8) {
        this.targetExpression = expressionName;
        this.expressionBlend = 0;
        this._expressionDuration = duration;
    }

    /**
     * Remet à zéro les références et la position de base
     * À appeler après un loadCase() qui reconstruit le groupe
     */
    reset() {
        this._cacheResolved = false;
        this._torso = null;
        this._head = null;
        this._eyeL = null;
        this._eyeR = null;
        this._mouth = null;
        this._browL = null;
        this._browR = null;
        this._baseY = undefined;
        this._mouthBaseY = undefined;
    }

    _animateExpressionBlend(dt) {
        if (!this.targetExpression || !this._mouth) return;

        this.expressionBlend += dt / (this._expressionDuration || 0.8);
        if (this.expressionBlend >= 1) {
            this.currentExpression = this.targetExpression;
            this.targetExpression = null;
            this.expressionBlend = 1;
        }

        const t = this.expressionBlend;
        this._applyExpression(this.currentExpression, this.targetExpression || this.currentExpression, t);
    }

    _applyExpression(from, to, blend) {
        if (!this._mouth) return;

        const configs = {
            normal:    { mouthScaleY: 1,   mouthRotZ: 0,    mouthPosY: 0 },
            douleur:   { mouthScaleY: 1.5, mouthRotZ: 0.2,  mouthPosY: -0.005 },
            grimace:   { mouthScaleY: 0.5, mouthRotZ: 0.18,  mouthPosY: -0.008 },
            sourire:   { mouthScaleY: 1.8, mouthRotZ: 0,    mouthPosY: 0.003 },
            pale:      { mouthScaleY: 0.8, mouthRotZ: 0,    mouthPosY: 0 },
            anxieux:   { mouthScaleY: 0.6, mouthRotZ: 0.1,  mouthPosY: -0.003 },
            etonne:    { mouthScaleY: 2.0, mouthRotZ: 0,    mouthPosY: 0.005 },
        };

        const fromCfg = configs[from] || configs.normal;
        const toCfg = configs[to] || configs.normal;

        // Lerp entre les deux configurations
        const mouthScaleY = fromCfg.mouthScaleY + (toCfg.mouthScaleY - fromCfg.mouthScaleY) * blend;
        const mouthRotZ = fromCfg.mouthRotZ + (toCfg.mouthRotZ - fromCfg.mouthRotZ) * blend;
        const mouthPosY = fromCfg.mouthPosY + (toCfg.mouthPosY - fromCfg.mouthPosY) * blend;

        this._mouth.scale.y = mouthScaleY;
        this._mouth.rotation.z = mouthRotZ;
        // mouthPosY est relatif — on ajuste si le mouth a une position de réf
        // On stocke le Y de base au premier appel
        if (this._mouthBaseY === undefined) {
            this._mouthBaseY = this._mouth.position.y;
        }
        this._mouth.position.y = this._mouthBaseY + mouthPosY;
    }
}

// ===== ANIMATEUR DE MÉDECIN =====

/**
 * Anime le médecin : cycle de marche, idle, gestes
 */
export class DoctorAnimator {
    /**
     * @param {THREE.Group} doctorGroup — groupe du médecin
     * @param {Object} options — { walkSpeed }
     */
    constructor(doctorGroup, options = {}) {
        this.group = doctorGroup;
        this.walkSpeed = options.walkSpeed || 1.0;
        this._isWalking = false;
        this._walkPhase = 0;
        this._idlePhase = 0;
        this._legL = null;
        this._legR = null;
        this._armL = null;
        this._armR = null;
        this._handL = null;
        this._handR = null;
        this._head = null;
        this._resolved = false;
    }

    _resolve() {
        if (this._resolved) return;
        // Les enfants du groupe médecin sont des meshes directs
        // Rechercher par position approximative ou type de géométrie
        const children = this.group.children;
        for (const child of children) {
            if (!child.isMesh) continue;
            const pos = child.position;
            const geom = child.geometry;

            // Jambes (cylindres bas)
            if (geom.type === 'CylinderGeometry' || geom.type === 'CapsuleGeometry') {
                if (pos.y < 0.5 && pos.y > 0.1) {
                    if (pos.x < 0) this._legL = child;
                    else this._legR = child;
                } else if (pos.y > 0.7 && pos.y < 1.2) {
                    // Bras
                    if (pos.x < 0) this._armL = child;
                    else this._armR = child;
                }
            }
            // Tête
            if (geom.type === 'SphereGeometry' && pos.y > 1.2) {
                this._head = child;
            }
            // Mains
            if (geom.type === 'SphereGeometry' && pos.y < 0.8 && pos.y > 0.6) {
                if (pos.x < 0) this._handL = child;
                else this._handR = child;
            }
        }
        this._resolved = true;
    }

    /**
     * Marque le début de la marche
     */
    startWalking() {
        this._isWalking = true;
        this._walkPhase = 0;
    }

    /**
     * Marque la fin de la marche
     */
    stopWalking() {
        this._isWalking = false;
        // Remettre les membres en position neutre
        this._resolve();
        if (this._legL) this._legL.rotation.x = 0;
        if (this._legR) this._legR.rotation.x = 0;
        if (this._armL) this._armL.rotation.x = 0;
        if (this._armR) this._armR.rotation.x = 0;
    }

    /**
     * Mise à jour animation marche/idle
     * @param {number} elapsed — temps absolu en secondes
     * @param {number} dt — deltaTime
     */
    update(elapsed, dt) {
        this._resolve();
        const safeDt = Math.min(dt || 0.016, 0.05);

        if (this._isWalking) {
            this._walkPhase += safeDt * this.walkSpeed * 8;
            this._animateWalkCycle(this._walkPhase);
        } else {
            this._idlePhase += safeDt;
            this._animateIdle(this._idlePhase);
        }
    }

    /** Cycle de marche avec balancement des jambes et bras */
    _animateWalkCycle(phase) {
        const swing = 0.4; // amplitude angulaire des bras/jambes

        if (this._legL) {
            this._legL.rotation.x = Math.sin(phase) * swing;
        }
        if (this._legR) {
            this._legR.rotation.x = Math.sin(phase + Math.PI) * swing;
        }
        if (this._armL) {
            this._armL.rotation.x = Math.sin(phase + Math.PI) * swing * 0.7;
        }
        if (this._armR) {
            this._armR.rotation.x = Math.sin(phase) * swing * 0.7;
        }
    }

    /** Idle : léger balancement, respiration */
    _animateIdle(t) {
        // Respiration subtile
        const breathY = Math.sin(t * 1.6) * 0.008;
        // On ne modifie pas group.position.y directement car c'est géré par moveTo
        // À la place on anime les bras très légèrement
        if (this._armL) {
            this._armL.rotation.x = Math.sin(t * 1.2) * 0.03;
        }
        if (this._armR) {
            this._armR.rotation.x = Math.sin(t * 1.2 + 0.5) * 0.03;
        }
        // Légère oscillation de la tête
        if (this._head) {
            this._head.rotation.y = Math.sin(t * 0.4) * 0.02;
        }
    }
}

// ===== ORIGINAL idleBreathing (compatibilité) =====

/**
 * Respiration idle simple (compatibilité rétro)
 * @deprecated Utiliser PatientAnimator à la place
 */
export function idleBreathing(group, elapsed) {
    if (!group) return;
    group.position.y = Math.sin(elapsed * 1.6) * 0.015;
}

// ===== ANIMATEUR DE PARTICULES =====

/**
 * Anime un système de particules de type poussière en suspension
 */
export class DustAnimator {
    constructor(dustParticles) {
        this.dust = dustParticles;
        this._initialPositions = null;
    }

    update(elapsed) {
        if (!this.dust) return;
        const positions = this.dust.geometry.attributes.position;
        if (!positions) return;

        // Sauvegarder les positions initiales au premier appel
        if (!this._initialPositions) {
            this._initialPositions = new Float32Array(positions.array);
        }

        const arr = positions.array;
        for (let i = 0; i < arr.length / 3; i++) {
            const ix = i * 3;
            const iy = i * 3 + 1;
            const iz = i * 3 + 2;

            // Mouvement brownien doux
            arr[ix] = this._initialPositions[ix] + Math.sin(elapsed * 0.3 + i * 0.7) * 0.05;
            arr[iy] = this._initialPositions[iy] + Math.sin(elapsed * 0.2 + i * 1.1) * 0.03;
            arr[iz] = this._initialPositions[iz] + Math.cos(elapsed * 0.25 + i * 0.5) * 0.04;
        }
        positions.needsUpdate = true;
    }
}

// ===== ANIMATEUR DE PERFUSION (gouttes) =====

/**
 * Anime une perfusion avec gouttes qui tombent
 * Utilisé par ThreeEnvironmentAgent
 */
export class IVFluidAnimator {
    /**
     * @param {THREE.Group} ivGroup — groupe de la perfusion (créé par buildIVStand)
     * @param {Object} options — { dropInterval, dropSpeed, dropSize }
     */
    constructor(ivGroup, options = {}) {
        this.group = ivGroup;
        this.dropInterval = options.dropInterval || 0.8;  // secondes entre gouttes
        this.dropSpeed = options.dropSpeed || 0.3;          // vitesse de chute
        this.dropSize = options.dropSize || 0.006;
        this._timer = 0;
        this._drops = [];
        this._scene = ivGroup.parent;
        this._bagMat = null;
        this._resolveParts();
    }

    _resolveParts() {
        if (!this.group) return;
        this.group.traverse((child) => {
            if (child.name === 'IVBag') this._bagMat = child.material;
        });
    }

    update(elapsed, dt) {
        const safeDt = Math.min(dt || 0.016, 0.05);

        // Créer une nouvelle goutte à intervalle régulier
        this._timer += safeDt;
        if (this._timer >= this.dropInterval) {
            this._timer -= this.dropInterval;
            this._spawnDrop();
        }

        // Mettre à jour les gouttes existantes
        for (let i = this._drops.length - 1; i >= 0; i--) {
            const drop = this._drops[i];
            drop.position.y -= this.dropSpeed * safeDt;
            drop.material.opacity -= safeDt * 1.5;

            if (drop.position.y < drop.userData.floorY || drop.material.opacity <= 0) {
                this._scene.remove(drop);
                drop.geometry.dispose();
                drop.material.dispose();
                this._drops.splice(i, 1);
            }
        }

        // Léger balancement de la poche
        if (this._bagMat) {
            const wave = Math.sin(elapsed * 3) * 0.01;
            this._bagMat.opacity = 0.75 + wave;
        }
    }

    _spawnDrop() {
        if (!this.group || !this._scene) return;
        const dropGeom = new THREE.SphereGeometry(this.dropSize, 6, 4);
        const dropMat = new THREE.MeshStandardMaterial({
            color: 0xaaddff,
            transparent: true,
            opacity: 0.9,
            roughness: 0.1,
            metalness: 0.0,
            emissive: 0x4488aa,
            emissiveIntensity: 0.2
        });
        const drop = new THREE.Mesh(dropGeom, dropMat);

        // Position de spawn : au niveau du tuyau sous la poche
        // On récupère la position mondiale du groupe
        const worldPos = new THREE.Vector3();
        this.group.getWorldPosition(worldPos);
        drop.position.set(
            worldPos.x + (Math.random() - 0.5) * 0.005,
            worldPos.y + 0.5, // juste sous la chambre de goutte
            worldPos.z + (Math.random() - 0.5) * 0.005
        );
        drop.userData.floorY = worldPos.y - 0.4; // niveau du bras du patient
        drop.name = 'IVFluidDrop';
        this._scene.add(drop);
        this._drops.push(drop);
    }
}

// ===== ANIMATEUR D'ÉCRAN ECG =====

/**
 * Anime une ligne ECG sur une texture canvas
 */
export class ECGScreenAnimator {
    /**
     * @param {THREE.Mesh} screenMesh — mesh de l'écran
     * @param {Object} options — { width, height, heartRate }
     */
    constructor(screenMesh, options = {}) {
        this.screen = screenMesh;
        this.canvas = document.createElement('canvas');
        this.canvasWidth = options.width || 256;
        this.canvasHeight = options.height || 96;
        this.canvas.width = this.canvasWidth;
        this.canvas.height = this.canvasHeight;
        this.ctx = this.canvas.getContext('2d');
        this.heartRate = options.heartRate || 72; // bpm
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.minFilter = THREE.LinearFilter;

        // Remplacer la texture de l'écran
        if (screenMesh?.material?.map) {
            screenMesh.material.map = this.texture;
            screenMesh.material.needsUpdate = true;
        }

        this._scanX = 0;
        this._ecgHistory = new Float32Array(this.canvasWidth).fill(0);
    }

    update(elapsed) {
        const ctx = this.ctx;
        const w = this.canvasWidth;
        const h = this.canvasHeight;

        // Fond noir-vert
        ctx.fillStyle = '#001a00';
        ctx.fillRect(0, 0, w, h);

        // Grille
        ctx.strokeStyle = 'rgba(0,80,0,0.3)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x < w; x += 16) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += 16) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Calcul de la position du scan basée sur le rythme cardiaque
        const bps = this.heartRate / 60;
        const pixelsPerFrame = bps * w / 60;
        this._scanX = (this._scanX + pixelsPerFrame) % w;

        // Générer le signal ECG
        const phase = (elapsed * bps) % 1;
        let ecgValue = 0;
        const p = phase;
        if (p < 0.1) ecgValue = Math.sin(p / 0.1 * Math.PI) * 0.15;       // Onde P
        else if (p < 0.15) ecgValue = 0;
        else if (p < 0.17) ecgValue = -0.1;                                  // Q
        else if (p < 0.22) ecgValue = Math.sin((p - 0.17) / 0.05 * Math.PI) * 0.8; // R
        else if (p < 0.26) ecgValue = -0.15;                                 // S
        else if (p < 0.35) ecgValue = 0;
        else if (p < 0.50) ecgValue = Math.sin((p - 0.35) / 0.15 * Math.PI) * 0.2; // T
        else ecgValue = 0;

        // Mettre à jour l'historique
        const scanIdx = Math.floor(this._scanX);
        this._ecgHistory[scanIdx] = ecgValue;
        // Effacer progressivement derrière le scan
        for (let i = 1; i < 30; i++) {
            const idx = (scanIdx - i + w) % w;
            this._ecgHistory[idx] *= 0.85;
        }

        // Dessiner la courbe ECG
        ctx.strokeStyle = '#00ff44';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00ff44';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        for (let x = 0; x < w; x++) {
            const y = h / 2 - this._ecgHistory[x] * h * 0.4;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Ligne de scan lumineuse
        ctx.strokeStyle = 'rgba(0,255,68,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(scanIdx, 0);
        ctx.lineTo(scanIdx, h);
        ctx.stroke();

        // Texte FC
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#00ff44';
        ctx.textAlign = 'left';
        ctx.fillText(`♥ ${this.heartRate} bpm`, 8, 16);

        this.texture.needsUpdate = true;
    }
}

