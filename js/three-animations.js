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

        // === Motifs de respiration variables ===
        // 'normal', 'tachypnea', 'bradypnea', 'dyspnea', 'cheyneStokes', 'agonal'
        this.respirationPattern = options.respirationPattern || 'normal';
        this._patternTime = 0;

        // Cache des références (résolution paresiveuse)
        this._torso = null;
        this._head = null;
        this._eyeL = null;
        this._eyeR = null;
        this._eyeLElement = null;  // Maille de l'œil entier (groupe ou mesh)
        this._eyeRElement = null;
        this._mouth = null;
        this._browL = null;
        this._browR = null;
        this._nose = null;
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
        this._arms = [];
        this._sweatMat = null;
        
        this.group.traverse((child) => {
            if (!child.isMesh && !child.isGroup) return;
            const name = (child.name || '').toLowerCase();
            const label = (child.userData?.label || '').toLowerCase();

            if (name.includes('torse') || label.includes('torse')) {
                this._torso = child;
            } else if (name.includes('tete') || name.includes('tête') || label.includes('tete') || label.includes('tête')) {
                this._head = child;
            } else if (name.includes('bras') || label.includes('bras')) {
                this._arms.push(child);
            } else if (name === 'patientsueur') {
                if (child.children && child.children.length > 0 && child.children[0].material) {
                    this._sweatMat = child.children[0].material;
                }
            } else if (name.includes('oeil') || label.includes('oeil') || name.includes('oei')) {
                eyes.push(child);
            } else if (name.includes('bouche') || label.includes('bouche')) {
                this._mouth = child;
            } else if (name.includes('sourcil') || label.includes('sourcil') || name.includes('brow') || label.includes('brow')) {
                // Sourcils : position x négatif = gauche, positif = droit
                if (child.position.x < 0) this._browL = child;
                else this._browR = child;
            } else if (name.includes('nez') || label.includes('nez') || name.includes('nose') || label.includes('nose')) {
                this._nose = child;
            }
        });

        // Assigner les yeux par position (le plus petit x = gauche)
        if (eyes.length >= 2) {
            eyes.sort((a, b) => a.position.x - b.position.x);
            this._eyeL = eyes[0];
            this._eyeR = eyes[1];
        } else if (eyes.length === 1) {
            this._eyeL = eyes[0];
            this._eyeR = eyes[0];
        }

        // Stocker les valeurs initiales pour les restaurations
        if (this._mouth && this._mouthBaseY === undefined) {
            this._mouthBaseY = this._mouth.position.y;
            this._mouthBaseScaleY = this._mouth.scale.y;
            this._mouthBaseRotZ = this._mouth.rotation.z;
        }
        if (this._browL && this._browLBaseRotZ === undefined) {
            this._browLBaseRotZ = this._browL.rotation.z;
            this._browLBasePosY = this._browL.position.y;
        }
        if (this._browR && this._browRBaseRotZ === undefined) {
            this._browRBaseRotZ = this._browR.rotation.z;
            this._browRBasePosY = this._browR.position.y;
        }

        if (this._torso && this._torsoBaseY === undefined) {
            this._torsoBaseY = this._torso.position.y;
            this._torsoBaseRotX = this._torso.rotation.x;
            this._torsoBaseRotY = this._torso.rotation.y;
        }
        if (this._arms && this._armsBaseY === undefined) {
            this._armsBaseY = this._arms.map(arm => ({ arm, y: arm.position.y }));
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

        let breathY, breathPhase, torsoExpand;

        switch (this.respirationPattern) {
            case 'tachypnea': {
                // Respiration rapide et superficielle (FR > 25/min)
                const freq = 3.5;
                breathPhase = Math.sin(t * freq * Math.PI * 2);
                breathY = breathPhase * 0.007;
                torsoExpand = 1 + Math.abs(breathPhase) * 0.004;
                break;
            }
            case 'bradypnea': {
                // Respiration lente et profonde (FR < 10/min)
                const freq = 0.5;
                breathPhase = Math.sin(t * freq * Math.PI * 2);
                breathY = breathPhase * 0.022;
                torsoExpand = 1 + breathPhase * 0.016;
                break;
            }
            case 'dyspnea': {
                // Respiration difficile avec hoquets (polypnée + pauses)
                const base = Math.sin(t * 2.5 * Math.PI * 2);
                const gasp = Math.sin(t * 8) * 0.3;
                breathY = (base + gasp) * 0.016;
                torsoExpand = 1 + base * 0.012;
                break;
            }
            case 'cheyneStokes': {
                // Respiration périodique : crescendo puis decrescendo puis pause
                const cycle = 20; // secondes par cycle
                const phase = (t % cycle) / cycle;
                let amplitude;
                if (phase < 0.05) {
                    // Pause (apnée)
                    amplitude = 0;
                } else {
                    // Crescendo-decrescendo
                    const breathPhase = (phase - 0.05) / 0.95;
                    amplitude = Math.sin(breathPhase * Math.PI) * 0.6 + 0.4;
                }
                const freq = 1.8;
                breathPhase = Math.sin(t * freq * Math.PI * 2) * amplitude;
                breathY = breathPhase * this.breathAmplitude * 1.5;
                torsoExpand = 1 + breathPhase * this.breathTorsoScale * 1.5;
                break;
            }
            case 'agonal': {
                // Gasps agonaux : rares, irréguliers, amplitude décroissante
                const cycle = 6; // secondes entre gasps
                const phase = (t % cycle) / cycle;
                let amplitude;
                if (phase < 0.15) {
                    // Gasp rapide
                    amplitude = Math.sin(phase / 0.15 * Math.PI) * 1.0;
                } else {
                    // Pause longue
                    amplitude = 0;
                }
                breathY = amplitude * 0.025;
                torsoExpand = 1 + Math.abs(amplitude) * 0.012;
                break;
            }
            default: {
                // Normal : respiration calme et régulière
                breathPhase = Math.sin(t * this.breathRate * Math.PI * 2);
                breathY = breathPhase * this.breathAmplitude;
                torsoExpand = 1 + breathPhase * this.breathTorsoScale;
                break;
            }
        }

        this.group.position.y = this._baseY + breathY;

        // Dilatation du torse (scale X/Z qui augmente à l'inspi, diminue à l'expir)
        if (this._torso) {
            this._torso.scale.x = torsoExpand || 1;
            this._torso.scale.z = torsoExpand || 1;
        }

        // Tirage respiratoire / élévation des épaules (torse + bras) en cas de détresse
        let torsoLift = 0;
        let armLift = 0;
        let shoulderTilt = 0;
        
        if (this.respirationPattern === 'dyspnea') {
            const base = Math.sin(t * 2.5 * Math.PI * 2);
            const gasp = Math.sin(t * 8) * 0.3;
            const liftFactor = Math.max(0, base + gasp);
            torsoLift = liftFactor * 0.016;
            armLift = liftFactor * 0.024;
            shoulderTilt = liftFactor * 0.025;
        } else if (this.respirationPattern === 'agonal') {
            const cycle = 6;
            const phase = (t % cycle) / cycle;
            let liftFactor = 0;
            if (phase < 0.15) {
                liftFactor = Math.sin(phase / 0.15 * Math.PI) * 1.0;
            }
            torsoLift = liftFactor * 0.022;
            armLift = liftFactor * 0.034;
            shoulderTilt = liftFactor * 0.035;
        }
        
        if (this._torso && this._torsoBaseY !== undefined) {
            this._torso.position.y = this._torsoBaseY + torsoLift;
            
            const isLying = (Math.abs(this.group.rotation.y) > 0.1);
            if (!isLying) {
                this._torso.rotation.x = (this._torsoBaseRotX || 0) + shoulderTilt;
            } else {
                this._torso.rotation.y = (this._torsoBaseRotY || 0) - shoulderTilt * 0.5;
            }
        } else if (this._torso) {
            this._torso.position.y = this._torsoBaseY || this._torso.position.y;
            this._torso.rotation.x = this._torsoBaseRotX || this._torso.rotation.x;
            this._torso.rotation.y = this._torsoBaseRotY || this._torso.rotation.y;
        }
        
        if (this._arms && this._armsBaseY !== undefined) {
            this._armsBaseY.forEach(armData => {
                armData.arm.position.y = armData.y + armLift;
            });
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

    /** Léger balancement de tête (micro-mouvement naturel, plus marqué en dyspnée) */
    _animateHeadSway(t) {
        if (!this._head) return;
        // Intensité du balancement selon le motif respiratoire
        let swayY, swayX;
        switch (this.respirationPattern) {
            case 'dyspnea':
                swayY = 0.06; swayX = 0.04; break;
            case 'agonal':
                swayY = 0.08; swayX = 0.05; break;
            case 'tachypnea':
                swayY = 0.04; swayX = 0.025; break;
            default:
                swayY = 0.03; swayX = 0.015; break;
        }
        this._head.rotation.y = Math.sin(t * 0.3 + this._headSwayPhase) * swayY;
        this._head.rotation.x = Math.sin(t * 0.2 + this._headSwayPhase * 1.3) * swayX;
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
        this._eyeLElement = null;
        this._eyeRElement = null;
        this._mouth = null;
        this._browL = null;
        this._browR = null;
        this._nose = null;
        this._baseY = undefined;
        this._mouthBaseY = undefined;
        this._mouthBaseScaleY = undefined;
        this._mouthBaseRotZ = undefined;
        this._browLBaseRotZ = undefined;
        this._browLBasePosY = undefined;
        this._browRBaseRotZ = undefined;
        this._browRBasePosY = undefined;
        this._arms = null;
        this._sweatMat = null;
        this._torsoBaseY = undefined;
        this._torsoBaseRotX = undefined;
        this._torsoBaseRotY = undefined;
        this._armsBaseY = undefined;
    }

    /**
     * Change le motif de respiration du patient
     * @param {string} pattern — 'normal' | 'tachypnea' | 'bradypnea' | 'dyspnea' | 'cheyneStokes' | 'agonal'
     */
    setRespirationPattern(pattern) {
        this.respirationPattern = pattern;
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
            normal:    { mouthScaleY: 1,   mouthRotZ: 0,    mouthPosY: 0,     browRotZ: 0,   browPosY: 0,  eyeScaleY: 1,  pupilScale: 1, sweatOpacity: 0 },
            douleur:   { mouthScaleY: 1.5, mouthRotZ: 0.2,  mouthPosY: -0.005, browRotZ: -0.15, browPosY: 0.01, eyeScaleY: 0.45, pupilScale: 1.3, sweatOpacity: 0.4 },
            grimace:   { mouthScaleY: 0.5, mouthRotZ: 0.18,  mouthPosY: -0.008, browRotZ: -0.2, browPosY: 0.015, eyeScaleY: 0.45, pupilScale: 1, sweatOpacity: 0.4 },
            sourire:   { mouthScaleY: 1.8, mouthRotZ: 0,    mouthPosY: 0.003,  browRotZ: 0.05, browPosY: -0.005, eyeScaleY: 1, pupilScale: 1, sweatOpacity: 0 },
            pale:      { mouthScaleY: 0.8, mouthRotZ: 0,    mouthPosY: 0,     browRotZ: 0.08, browPosY: 0.008, eyeScaleY: 0.9, pupilScale: 0.85, sweatOpacity: 0.2 },
            anxieux:   { mouthScaleY: 0.6, mouthRotZ: 0.1,  mouthPosY: -0.003, browRotZ: -0.12, browPosY: 0.012, eyeScaleY: 1.3, pupilScale: 1.4, sweatOpacity: 0.3 },
            etonne:    { mouthScaleY: 2.0, mouthRotZ: 0,    mouthPosY: 0.005,  browRotZ: 0.15, browPosY: 0.02,  eyeScaleY: 1.4, pupilScale: 1.6, sweatOpacity: 0 },
            cyanose:   { mouthScaleY: 0.7, mouthRotZ: 0.12, mouthPosY: -0.002, browRotZ: -0.08, browPosY: 0.008, eyeScaleY: 0.85, pupilScale: 0.9, sweatOpacity: 0.2 },
            fievre:    { mouthScaleY: 0.65, mouthRotZ: 0.08, mouthPosY: -0.004, browRotZ: -0.1, browPosY: 0.01, eyeScaleY: 0.9, pupilScale: 1.2, sweatOpacity: 0.7 },
            sueur:     { mouthScaleY: 0.75, mouthRotZ: 0.05, mouthPosY: -0.002, browRotZ: -0.06, browPosY: 0.006, eyeScaleY: 0.95, pupilScale: 1.1, sweatOpacity: 0.8 },
        };

        const fromCfg = configs[from] || configs.normal;
        const toCfg = configs[to] || configs.normal;

        // Lerp entre les deux configurations
        // Bouche
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

        // Sourcils (fronce = rotationZ négatif, surprise = positif + montée)
        if (this._browL) {
            const browRotZ = fromCfg.browRotZ + (toCfg.browRotZ - fromCfg.browRotZ) * blend;
            const browPosY = fromCfg.browPosY + (toCfg.browPosY - fromCfg.browPosY) * blend;
            this._browL.rotation.z = (this._browLBaseRotZ || 0) + browRotZ;
            this._browL.position.y = (this._browLBasePosY || this._browL.position.y) + browPosY;
        }
        if (this._browR) {
            const browRotZ = fromCfg.browRotZ + (toCfg.browRotZ - fromCfg.browRotZ) * blend;
            const browPosY = fromCfg.browPosY + (toCfg.browPosY - fromCfg.browPosY) * blend;
            // Sourcil droit : rotation inverse
            this._browR.rotation.z = (this._browRBaseRotZ || 0) - browRotZ;
            this._browR.position.y = (this._browRBasePosY || this._browR.position.y) + browPosY;
        }

        // Yeux (ouverture/paupières — scaleY sur l'œil ou le groupe)
        const eyeScaleY = fromCfg.eyeScaleY + (toCfg.eyeScaleY - fromCfg.eyeScaleY) * blend;
        if (this._eyeL && !this._isBlinking) {
            this._eyeL.scale.y = eyeScaleY;
        }
        if (this._eyeR && !this._isBlinking) {
            this._eyeR.scale.y = eyeScaleY;
        }

        // Pupilles (dilatation via scale uniforme sur les iris si disponibles)
        const pupilScale = fromCfg.pupilScale + (toCfg.pupilScale - fromCfg.pupilScale) * blend;
        this._applyPupilScale(pupilScale);

        // Sueur (opacité progressive + scintillement)
        const sweatOpacity = (fromCfg.sweatOpacity ?? 0) + ((toCfg.sweatOpacity ?? 0) - (fromCfg.sweatOpacity ?? 0)) * blend;
        if (this._sweatMat) {
            // Effet brillant glistening avec une oscillation
            const glisten = Math.sin((performance.now() / 1000) * 3.5) * 0.05 + 0.95;
            this._sweatMat.opacity = sweatOpacity * glisten;
        }
    }

    /**
     * Applique l'échelle des pupilles (iris) — recherche dans les groupes enfants
     */
    _applyPupilScale(scale) {
        // Chercher les iris dans les groupes d'yeux (s'ils sont des groupes)
        [this._eyeL, this._eyeR].forEach(eyeRef => {
            if (!eyeRef) return;
            if (eyeRef.isGroup) {
                eyeRef.children.forEach(child => {
                    // Les iris sont typiquement les petites sphères avec couleur iris
                    if (child.geometry?.type === 'SphereGeometry' &&
                        child.geometry?.parameters?.radius < 0.015) {
                        child.scale.setScalar(scale);
                    }
                });
            }
        });
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
        this._scene = null; // Résolu au premier update
        this._bagMat = null;
        // Pooling : géométrie et matériau partagés pour les gouttes (évite GC churn)
        this._dropGeom = new THREE.SphereGeometry(this.dropSize, 6, 4);
        this._dropMat = new THREE.MeshStandardMaterial({
            color: 0xaaddff,
            transparent: true,
            opacity: 0.9,
            roughness: 0.1,
            metalness: 0.0,
            emissive: 0x4488aa,
            emissiveIntensity: 0.2
        });
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

        // Résoudre la référence scène au premier update (quand le groupe est dans la scène)
        if (!this._scene && this.group) {
            this._scene = this.group.parent;
        }

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
                if (this._scene) this._scene.remove(drop);
                // Ne pas disposer this._dropGeom (partagé), seulement le matériau cloné
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
        // Utiliser la géométrie partagée ; cloner le matériau pour l'opacité individuelle
        const dropMat = this._dropMat.clone();
        const drop = new THREE.Mesh(this._dropGeom, dropMat);

        // Position de spawn : juste sous la chambre de goutte (chambre à y=1.28 local)
        const worldPos = new THREE.Vector3();
        this.group.getWorldPosition(worldPos);
        drop.position.set(
            worldPos.x + (Math.random() - 0.5) * 0.005,
            worldPos.y + 1.22, // Sous la chambre de goutte
            worldPos.z + (Math.random() - 0.5) * 0.005
        );
        drop.userData.floorY = worldPos.y + 0.4; // Niveau du tuyau bas
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

