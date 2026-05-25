import * as THREE from 'three';

export class ThreeFPSController {
    constructor(camera, domElement, options = {}) {
        this.camera = camera;
        this.domElement = domElement;
        this.enabled = false;

        this.moveSpeed = options.moveSpeed || 1.8;
        this.sprintSpeed = options.sprintSpeed || 3.1;
        this.crouchSpeed = options.crouchSpeed || 1.05;
        this.mouseSensitivity = options.mouseSensitivity || 0.0022;
        this.interactCallback = options.onInteract || null;

        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            sprint: false,
            crouch: false
        };

        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.eyeHeight = 1.6;
        this.crouchEyeHeight = 1.18;
        this.targetEyeHeight = this.eyeHeight;
        this.stamina = 1;

        this.bobTime = 0;
        this.bobSpeed = 12.0;
        this.bobAmount = 0.035;

        this.bounds = { minX: -4.5, maxX: 4.5, minZ: -3.5, maxZ: 3.5 };
        this.onDeactivateCallback = options.onDeactivate || null;

        this._onMouseMove = this.onMouseMove.bind(this);
        this._onKeyDown = this.onKeyDown.bind(this);
        this._onKeyUp = this.onKeyUp.bind(this);
        this._onPointerLockChange = this.onPointerLockChange.bind(this);
    }

    activate(startPos = null, startLookAt = null) {
        if (this.enabled) return;
        this.enabled = true;

        Object.keys(this.keys).forEach((key) => { this.keys[key] = false; });
        this.targetEyeHeight = this.eyeHeight;
        this.bobTime = 0;

        if (startPos) {
            this.camera.position.copy(startPos);
        } else {
            this.camera.position.set(2.0, this.eyeHeight, 3.2);
        }
        this.camera.position.y = this.eyeHeight;

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

        document.addEventListener('mousemove', this._onMouseMove, false);
        document.addEventListener('keydown', this._onKeyDown, false);
        document.addEventListener('keyup', this._onKeyUp, false);
        document.addEventListener('pointerlockchange', this._onPointerLockChange, false);

        try {
            document.body.requestPointerLock();
        } catch {
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
            this.deactivate();
        }
    }

    onMouseMove(event) {
        if (!this.enabled) return;

        this.euler.y -= (event.movementX || 0) * this.mouseSensitivity;
        this.euler.x -= (event.movementY || 0) * this.mouseSensitivity;
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
        } else if (code === 'ShiftLeft' || code === 'ShiftRight') {
            this.keys.sprint = true;
        } else if (code === 'ControlLeft' || code === 'ControlRight' || key === 'control') {
            this.keys.crouch = true;
        } else if (code === 'KeyE' || key === 'e') {
            event.preventDefault();
            if (this.interactCallback) this.interactCallback();
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
        } else if (code === 'ShiftLeft' || code === 'ShiftRight') {
            this.keys.sprint = false;
        } else if (code === 'ControlLeft' || code === 'ControlRight' || key === 'control') {
            this.keys.crouch = false;
        }
    }

    checkCollision(x, z) {
        if (x < this.bounds.minX) return { collided: true };
        if (x > this.bounds.maxX) return { collided: true };
        if (z < this.bounds.minZ) return { collided: true };
        if (z > this.bounds.maxZ) return { collided: true };

        const obstacles = [
            { minX: -4.3, maxX: -2.7, minZ: -4.0, maxZ: -1.2 },
            { minX: -2.3, maxX: 0.7, minZ: -1.7, maxZ: -0.1 },
            { minX: 3.7, maxX: 5.0, minZ: 0.3, maxZ: 1.7 },
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

        const front = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);

        front.y = 0;
        front.normalize();
        right.y = 0;
        right.normalize();

        const moveDirection = new THREE.Vector3();
        if (this.keys.forward) moveDirection.add(front);
        if (this.keys.backward) moveDirection.sub(front);
        if (this.keys.left) moveDirection.sub(right);
        if (this.keys.right) moveDirection.add(right);

        const isWalking = moveDirection.lengthSq() > 0;
        const wantsSprint = this.keys.sprint && !this.keys.crouch && this.stamina > 0.08;
        this.targetEyeHeight = this.keys.crouch ? this.crouchEyeHeight : this.eyeHeight;

        if (isWalking) {
            moveDirection.normalize();

            let speed = this.moveSpeed;
            if (this.keys.crouch) speed = this.crouchSpeed;
            else if (wantsSprint) speed = this.sprintSpeed;

            const dist = speed * dt;
            const moveX = moveDirection.x * dist;
            const moveZ = moveDirection.z * dist;
            const nextX = this.camera.position.x + moveX;
            const nextZ = this.camera.position.z + moveZ;

            if (!this.checkCollision(nextX, this.camera.position.z).collided) {
                this.camera.position.x = nextX;
            }
            if (!this.checkCollision(this.camera.position.x, nextZ).collided) {
                this.camera.position.z = nextZ;
            }

            this.bobTime += dt * (wantsSprint ? this.bobSpeed * 1.35 : this.bobSpeed);
            const bobOffset = Math.sin(this.bobTime) * (this.keys.crouch ? this.bobAmount * 0.35 : this.bobAmount);
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, this.targetEyeHeight + bobOffset, 0.22);

            if (wantsSprint) this.stamina = Math.max(0, this.stamina - dt * 0.22);
            else this.stamina = Math.min(1, this.stamina + dt * 0.18);
        } else {
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, this.targetEyeHeight, 0.12);
            this.bobTime = 0;
            this.stamina = Math.min(1, this.stamina + dt * 0.24);
        }
    }
}
