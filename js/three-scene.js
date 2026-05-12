import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildFurniture, buildRoom, createMaterial } from './three-room.js';
import { ThreePatient } from './three-patient.js';
import { ThreeInstruments } from './three-instruments.js';
import { idleBreathing } from './three-animations.js';
import { ThreeAssetAgent } from './three-asset-agent.js';
import { ThreeLightingAgent } from './three-lighting-agent.js';
import { ThreeEnvironmentAgent } from './three-environment-agent.js';

export class ThreeScene {
    constructor(container, callbacks = {}) {
        this.container = container;
        this.callbacks = callbacks;
        this.scene = new THREE.Scene();
        this.interactiveObjects = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.assetAgent = new ThreeAssetAgent(this);
        this.lightingAgent = null;
        this.environmentAgent = null;
    }

    init() {
        console.log('[ThreeScene] init called, container=', !!this.container, 'clientWidth=', this.container.clientWidth, 'clientHeight=', this.container.clientHeight);
        this.scene.background = new THREE.Color(0x8c9bab);
        this.scene.fog = new THREE.Fog(0x8c9bab, 8, 30);

        this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
        this.scene._camera = this.camera;
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            stencil: false
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.maxPolarAngle = Math.PI / 2 + 0.08;
        this.controls.minPolarAngle = 0.1;
        this.controls.minDistance = 1.5;
        this.controls.maxDistance = 12;
        this.controls.enableRotate = true;
        this.controls.enablePan = false;
        this.controls.enableZoom = false;
        this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
        this.controls.target.set(0, 1.0, 0);

        this.setCamera('room');

        buildRoom(this.scene);
        buildFurniture(this.scene);

        this.environmentAgent = new ThreeEnvironmentAgent(this.scene);
        this.environmentAgent.enhanceRoom();

        this.lightingAgent = new ThreeLightingAgent(this.scene, this.renderer);
        this.lightingAgent.setupLighting();
        this.lightingAgent.setupPostProcessing();

        this.patient = new ThreePatient(this.scene);
        this.instruments = new ThreeInstruments(this.scene);

        this.collectInteractive();

        // Custom click detection to avoid OrbitControls interference
        this._ptrDown = null;
        this.renderer.domElement.addEventListener('pointerdown', (e) => {
            this._ptrDown = { x: e.clientX, y: e.clientY, time: performance.now() };
        });
        this.renderer.domElement.addEventListener('pointerup', (e) => {
            if (!this._ptrDown) return;
            const dx = Math.abs(e.clientX - this._ptrDown.x);
            const dy = Math.abs(e.clientY - this._ptrDown.y);
            const dt = performance.now() - this._ptrDown.time;
            if (dx < 8 && dy < 8 && dt < 400) {
                this.onClick(e);
            }
            this._ptrDown = null;
        });
        this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('resize', () => this.resize());

        this.animate();
    }

    collectInteractive() {
        this.interactiveObjects = [];
        this.scene.traverse((obj) => {
            if (obj.userData?.interactive) this.interactiveObjects.push(obj);
        });
    }

    loadCase(caseData) {
        this.patient.loadCase(caseData);
        this.collectInteractive();
    }

    setCamera(mode, animate = true) {
        const presets = {
            room: { pos: [0, 4.8, 7.3], target: [0, 1.2, -0.8] },
            patient: { pos: [2.7, 2.1, 0.7], target: [2.1, 1.15, -1.65] },
            desk: { pos: [-0.9, 2.25, 1.05], target: [-0.65, 0.9, -0.85] }
        };
        const p = presets[mode] || presets.room;
        const targetPos = new THREE.Vector3(...p.pos);
        const targetLook = new THREE.Vector3(...p.target);

        if (animate && this._cameraAnimId) {
            cancelAnimationFrame(this._cameraAnimId);
        }

        if (!animate) {
            this.camera.position.copy(targetPos);
            this.controls.target.copy(targetLook);
            this.controls.update();
        } else {
            const startPos = this.camera.position.clone();
            const startTarget = this.controls.target.clone();
            const duration = 600;
            const startTime = performance.now();

            const step = (now) => {
                const t = Math.min(1, (now - startTime) / duration);
                const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                this.camera.position.lerpVectors(startPos, targetPos, ease);
                this.controls.target.lerpVectors(startTarget, targetLook, ease);
                this.controls.update();
                if (t < 1) {
                    this._cameraAnimId = requestAnimationFrame(step);
                } else {
                    this._cameraAnimId = null;
                }
            };
            this._cameraAnimId = requestAnimationFrame(step);
        }

        if (this.lightingAgent) {
            this.lightingAgent.setCameraExposure(mode);
        }
    }

    onClick(event) {
        const hit = this.pick(event);
        if (!hit) return;

        const instrument = this.instruments.getByObject(hit.object);
        if (instrument) {
            this.callbacks.onInstrument?.(instrument, hit.object);
            return;
        }

        if ((hit.object.userData?.label || '').toLowerCase().includes('patient')) {
            this.callbacks.onPatient?.(hit.object);
            return;
        }

        if (hit.object.userData?.pcAction) {
            this.callbacks.onPC?.(hit.object);
            return;
        }

        if (hit.object.name === 'MedicalPoster') {
            if (window.showNotification) window.showNotification('Affiche médicale : Protocole ECMO');
        }

        this.callbacks.onObject?.(hit.object);
    }

    onMouseMove(event) {
        const hit = this.pick(event);
        this.callbacks.onHover?.(hit?.object || null, event);
    }

    pick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        return this.raycaster.intersectObjects(this.interactiveObjects, false)[0] || null;
    }

    resize() {
        const w = this.container.clientWidth || window.innerWidth;
        const h = this.container.clientHeight || window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    cleanup() {
        cancelAnimationFrame(this._animFrameId);
        this.renderer.dispose();
        this.renderer.forceContextLoss();
        this.controls.dispose();
        if (this.lightingAgent) this.lightingAgent.dispose();
    }

    animate() {
        this._animFrameId = requestAnimationFrame(() => this.animate());
        const elapsed = performance.now() / 1000;
        idleBreathing(this.patient?.group, elapsed);

        const dust = this.scene.getObjectByName('DustParticles');
        if (dust) {
            dust.rotation.y += 0.0002;
            dust.rotation.x += 0.0001;
        }

        if (this.lightingAgent && this.lightingAgent.render()) {
            // Composer handled rendering (bloom, etc.)
        } else {
            this.renderer.render(this.scene, this.camera);
        }

        this.controls.update();
    }
}