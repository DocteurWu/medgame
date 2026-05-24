import * as THREE from 'three';

/**
 * ThreeFPSController - Contrôleur de déplacement à la première personne (FPS)
 * Gère le PointerLock (mouvements de la souris) et les déplacements au clavier ZQSD/WASD,
 * avec un système de glissement physique (collisions) contre les murs et les meubles.
 */
export class ThreeFPSController {
    constructor(camera, domElement, options = {}) {
        this.camera = camera;
        this.domElement = domElement;
        this.enabled = false;
        
        this.moveSpeed = options.moveSpeed || 1.8; // Vitesse de marche (m/s)
        this.mouseSensitivity = options.mouseSensitivity || 0.0022;
        
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };
        
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.eyeHeight = 1.6; // Hauteur des yeux réaliste (1.6m)
        
        // Paramètres pour l'oscillation naturelle de la tête (bobbing)
        this.bobTime = 0;
        this.bobSpeed = 12.0;
        this.bobAmount = 0.035;
        
        // Limites de la salle
        this.bounds = { minX: -4.5, maxX: 4.5, minZ: -3.5, maxZ: 3.5 };
        
        this.onDeactivateCallback = options.onDeactivate || null;
        
        // Binds
        this._onMouseMove = this.onMouseMove.bind(this);
        this._onKeyDown = this.onKeyDown.bind(this);
        this._onKeyUp = this.onKeyUp.bind(this);
        this._onPointerLockChange = this.onPointerLockChange.bind(this);
    }
    
    activate(startPos = null, startLookAt = null) {
        if (this.enabled) return;
        this.enabled = true;
        
        // Reset mouvements
        this.keys.forward = false;
        this.keys.backward = false;
        this.keys.left = false;
        this.keys.right = false;
        this.bobTime = 0;
        
        // Positionner la caméra à la hauteur des yeux
        if (startPos) {
            this.camera.position.copy(startPos);
        } else {
            // Par défaut devant la porte
            this.camera.position.set(2.0, this.eyeHeight, 3.2);
        }
        this.camera.position.y = this.eyeHeight;
        
        // Recalculer l'orientation initiale
        if (startLookAt) {
            const dir = new THREE.Vector3().copy(startLookAt).sub(this.camera.position).normalize();
            this.euler.y = Math.atan2(-dir.x, -dir.z);
            this.euler.x = Math.asin(dir.y);
            this.camera.quaternion.setFromEuler(this.euler);
        } else {
            const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
            this.euler.y = Math.atan2(-dir.x, -dir.z);
            this.euler.x = Math.asin(Math.max(-1, Math.min(1, dir.y)));
            this.camera.quaternion.setFromEuler(this.euler);
        }
        
        // Listeners
        document.addEventListener('mousemove', this._onMouseMove, false);
        document.addEventListener('keydown', this._onKeyDown, false);
        document.addEventListener('keyup', this._onKeyUp, false);
        document.addEventListener('pointerlockchange', this._onPointerLockChange, false);
        
        // Verrouiller la souris (sur le body pour un support maximal sans rejet navigateur)
        try {
            document.body.requestPointerLock();
        } catch (e) {
            this.domElement.requestPointerLock();
        }
    }
    
    deactivate() {
        if (!this.enabled) return;
        this.enabled = false;
        
        document.removeEventListener('mousemove', this._onMouseMove, false);
        document.removeEventListener('keydown', this._onKeyDown, false);
        document.removeEventListener('keyup', this._onKeyUp, false);
        document.removeEventListener('pointerlockchange', this._onPointerLockChange, false);
        
        if (document.pointerLockElement === this.domElement || document.pointerLockElement === document.body) {
            document.exitPointerLock();
        }
        
        if (this.onDeactivateCallback) {
            this.onDeactivateCallback();
        }
    }
    
    onPointerLockChange() {
        if (document.pointerLockElement !== this.domElement && document.pointerLockElement !== document.body) {
            // Si la souris est déverrouillée (ex: appui sur Echap), sortir du mode FPS
            this.deactivate();
        }
    }
    
    onMouseMove(event) {
        if (!this.enabled) return;
        
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;
        
        this.euler.y -= movementX * this.mouseSensitivity;
        this.euler.x -= movementY * this.mouseSensitivity;
        
        // Limiter la rotation verticale (regard haut/bas) à environ 85 degrés
        this.euler.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.euler.x));
        
        this.camera.quaternion.setFromEuler(this.euler);
    }
    
    onKeyDown(event) {
        if (!this.enabled) return;
        
        const code = event.code;
        const key = event.key ? event.key.toLowerCase() : '';
        
        if (code === 'KeyW' || code === 'KeyZ' || key === 'w' || key === 'z' || code === 'ArrowUp' || key === 'arrowup') {
            this.keys.forward = true;
        } else if (code === 'KeyS' || key === 's' || code === 'ArrowDown' || key === 'arrowdown') {
            this.keys.backward = true;
        } else if (code === 'KeyA' || code === 'KeyQ' || key === 'a' || key === 'q' || code === 'ArrowLeft' || key === 'arrowleft') {
            this.keys.left = true;
        } else if (code === 'KeyD' || key === 'd' || code === 'ArrowRight' || key === 'arrowright') {
            this.keys.right = true;
        }
    }
    
    onKeyUp(event) {
        if (!this.enabled) return;
        
        const code = event.code;
        const key = event.key ? event.key.toLowerCase() : '';
        
        if (code === 'KeyW' || code === 'KeyZ' || key === 'w' || key === 'z' || code === 'ArrowUp' || key === 'arrowup') {
            this.keys.forward = false;
        } else if (code === 'KeyS' || key === 's' || code === 'ArrowDown' || key === 'arrowdown') {
            this.keys.backward = false;
        } else if (code === 'KeyA' || code === 'KeyQ' || key === 'a' || key === 'q' || code === 'ArrowLeft' || key === 'arrowleft') {
            this.keys.left = false;
        } else if (code === 'KeyD' || key === 'd' || code === 'ArrowRight' || key === 'arrowright') {
            this.keys.right = false;
        }
    }
    
    checkCollision(x, z) {
        // 1. Murs extérieurs de la pièce
        if (x < this.bounds.minX) return { collided: true };
        if (x > this.bounds.maxX) return { collided: true };
        if (z < this.bounds.minZ) return { collided: true };
        if (z > this.bounds.maxZ) return { collided: true };
        
        // 2. Boîtes de collision des meubles principaux (+rayon de la caméra)
        const obstacles = [
            // Lit patient : x dans [-4.3, -2.7], z dans [-4.0, -1.2]
            { minX: -4.3, maxX: -2.7, minZ: -4.0, maxZ: -1.2 },
            // Bureau : x dans [-2.3, 0.7], z dans [-1.7, -0.1]
            { minX: -2.3, maxX: 0.7, minZ: -1.7, maxZ: -0.1 },
            // Armoire : x dans [3.7, 5.0], z dans [0.3, 1.7]
            { minX: 3.7, maxX: 5.0, minZ: 0.3, maxZ: 1.7 },
            // Fauteuil : x dans [1.5, 2.8], z dans [-2.35, -1.05]
            { minX: 1.5, maxX: 2.8, minZ: -2.35, maxZ: -1.05 }
        ];
        
        for (const box of obstacles) {
            if (x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ) {
                return { collided: true };
            }
        }
        
        return { collided: false };
    }
    
    update(dt) {
        if (!this.enabled) return;
        
        // Obtenir les directions locales de la caméra projetées sur le plan horizontal XZ
        const front = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        
        front.y = 0;
        front.normalize();
        right.y = 0;
        right.normalize();
        
        const moveDirection = new THREE.Vector3(0, 0, 0);
        if (this.keys.forward) moveDirection.add(front);
        if (this.keys.backward) moveDirection.sub(front);
        if (this.keys.left) moveDirection.sub(right);
        if (this.keys.right) moveDirection.add(right);
        
        const isWalking = moveDirection.lengthSq() > 0;
        
        if (isWalking) {
            moveDirection.normalize();
            
            const dist = this.moveSpeed * dt;
            const moveX = moveDirection.x * dist;
            const moveZ = moveDirection.z * dist;
            
            const currentX = this.camera.position.x;
            const currentZ = this.camera.position.z;
            
            const nextX = currentX + moveX;
            const nextZ = currentZ + moveZ;
            
            // Résolution de collision par axe pour un glissement fluide
            if (!this.checkCollision(nextX, currentZ).collided) {
                this.camera.position.x = nextX;
            }
            if (!this.checkCollision(this.camera.position.x, nextZ).collided) {
                this.camera.position.z = nextZ;
            }
            
            // Oscillation de tête naturelle (Bobbing)
            this.bobTime += dt * this.bobSpeed;
            const bobOffset = Math.sin(this.bobTime) * this.bobAmount;
            this.camera.position.y = this.eyeHeight + bobOffset;
        } else {
            // Retour doux à la hauteur des yeux au repos
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, this.eyeHeight, 0.1);
            this.bobTime = 0;
        }
    }
}
