/**
 * three-atlas-scene.js — Visionneuse 3D Atlas (port vanilla de Human Atlas app/scene.tsx, MIT).
 * DA MedGame : fond sombre, néon #00f2fe, rendu on-demand (dirty flag), dispose() complet.
 * Technique d'origine : batches mergés par système + DataTexture visibilité/sélection/translation + pick-meshes.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SYSTEMS } from './three-atlas-data.js?v=10';
import { TaskScheduler } from './task-scheduler.js?v=10';
import { groupCardiacParts, heartPhase, heartMotion, ECGSynchronizer, HEART_PRESETS } from './atlas-heartbeat.js?v=1';

/** Layout "explosé" : grille compacte des pièces visibles (port simplifié de explosion-layout.ts). */
function createExplosionLayout(visibleParts, aspect) {
    const cells = new Map();
    const n = Math.max(1, visibleParts.length);
    const cols = Math.max(1, Math.round(Math.sqrt(n * Math.max(0.5, aspect || 1))));
    const rows = Math.ceil(n / cols);
    const gap = 0.16;
    const W = cols * gap;
    const H = rows * gap;
    visibleParts.forEach((p, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        cells.set(p.id, { x: (c - (cols - 1) / 2) * gap * 2.2, y: ((rows - 1) / 2 - r) * gap * 1.4 });
    });
    return { cells, width: W, height: H };
}

export class ThreeAtlasViewer {
    constructor(container, opts = {}) {
        this.container = container;
        this.onSelect = opts.onSelect || (() => {});
        this.onError = opts.onError || ((e) => console.error(e));
        this._disposed = false;
        this._dirty = true;
        this._frame = 0;
        this._amount = 0;
        this._geometries = [];
        this._materials = [];
        this._pickers = [];
        this._offsets = [];
        this._layoutKey = '';
        this._packingW = 1;
        this._packingH = 1;
        this._explosionOffsets = [];

        // Battement cardiaque & synchronisation ECG
        this.heartbeatEnabled = opts.heartbeat !== undefined ? Boolean(opts.heartbeat) : true;
        this.isHeartIsolated = false;
        this.currentHeartPreset = opts.heartPreset || 'sinus';
        this._heartMeshes = [];
        this._heartPartIndices = new Set();
        this._heartBounds = new THREE.Box3();
        this._heartCenter = new THREE.Vector3();
        this._heartSync = new ECGSynchronizer({ presetId: this.currentHeartPreset });
        this._heartTime = 0;
        this._heartThrottle = 0;

        // Module Rein Détaillé
        this.isKidneyMode = false;
        this.onSelectKidney = opts.onSelectKidney || null;
        this._kidneyBounds = new THREE.Box3();
        this._kidneyCenter = new THREE.Vector3(0, 0.85, 0);

        this.state = {
            visible: [...(opts.visible || ['cardiac', 'sensory', 'skeletal', 'muscular', 'arterial', 'venous', 'nervous', 'respiratory', 'digestive', 'urinary', 'lymphatic', 'endocrine', 'reproductive', 'connective'])],
            selected: [],
            isolate: false,
            explode: 0,
            view: 'three-quarter',
            rotate: false,
        };

        this._initRenderer();
    }

    _initRenderer() {
        const el = this.container;
        try {
            this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        } catch {
            this.onError('WebGL indisponible dans ce navigateur.');
            return;
        }
        const mobile = el.clientWidth < 768;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.localClippingEnabled = true;
        // DA MedGame : fond sombre au lieu du gris #f2f3f3 d'origine
        this.renderer.setClearColor('#070c18');
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.renderer.domElement.setAttribute('aria-label', 'Atlas anatomique 3D MedGame. Glisser pour orbiter, molette pour zoomer, clic pour inspecter.');
        el.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x070c18, 0.045);
        this.camera = new THREE.PerspectiveCamera(34, 1, 0.005, 100);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.085;
        this.controls.minDistance = 0.07;
        this.controls.maxDistance = 40;
        this.controls.maxPolarAngle = Math.PI * 0.96;
        this.controls.autoRotateSpeed = 0.65;
        this.controls.addEventListener('change', () => { this._dirty = true; });

        const pmrem = new THREE.PMREMGenerator(this.renderer);
        const room = new RoomEnvironment();
        this._envRT = pmrem.fromScene(room, 0.04);
        this.scene.environment = this._envRT.texture;
        room.dispose?.();
        pmrem.dispose();
        this.scene.add(new THREE.HemisphereLight(0xbfefff, 0x1a2438, 0.9));
        const key = new THREE.DirectionalLight(0xfffaf4, 2.0);
        key.position.set(-2, 4, 3);
        this.scene.add(key);
        const rim = new THREE.DirectionalLight(0x00f2fe, 1.1);
        rim.position.set(2, 2, -3);
        this.scene.add(rim);
        // Néon MedGame : anneau + grille au sol
        const grid = new THREE.GridHelper(8, 24, 0x00f2fe, 0x123043);
        grid.material.transparent = true;
        grid.material.opacity = 0.25;
        grid.position.y = -0.02;
        this.scene.add(grid);
        this._stage = new THREE.Group();
        this.scene.add(grid);
        this.ground = grid;

        this._heartGroup = new THREE.Group();
        this._heartGroup.name = 'heartGroup';
        this.scene.add(this._heartGroup);

        this._kidneyGroup = new THREE.Group();
        this._kidneyGroup.name = 'kidneyGroup';
        this._kidneyGroup.visible = false;
        this.scene.add(this._kidneyGroup);

        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this._downPos = null;
        this.renderer.domElement.addEventListener('pointerdown', (e) => {
            this._downPos = { x: e.clientX, y: e.clientY, t: performance.now() };
            this._hideHover();
        });
        this.renderer.domElement.addEventListener('pointermove', (e) => this._onHover(e));
        this.renderer.domElement.addEventListener('pointerup', (e) => this._onTap(e));

        this._hover = document.createElement('div');
        this._hover.className = 'part-hover';
        this._hover.hidden = true;
        el.appendChild(this._hover);

        this._resizeObserver = new ResizeObserver(() => this._resize());
        this._resizeObserver.observe(el);
        this._resize();
        this._fit('three-quarter', 0);

        const clock = new THREE.Clock();
        const animate = () => {
            if (this._disposed) return;
            this._frame = requestAnimationFrame(animate);
            const dt = Math.min(clock.getDelta(), 0.05);
            this._tick(dt);
        };
        animate();
    }

    /** Nettoie et libère un atlas précédemment chargé sans détruire la scène/renderer. */
    clearAtlas() {
        this._ready = false;
        if (this._heartMeshes) {
            this._heartMeshes.forEach((hm) => {
                if (hm.mesh) this._heartGroup?.remove(hm.mesh);
                hm.mesh?.geometry?.dispose?.();
                hm.mat?.dispose?.();
            });
            this._heartMeshes = [];
        }
        this._heartPartIndices?.clear?.();
        this._explosionOffsets = [];

        if (this._batches) {
            this._batches.forEach((mesh) => {
                this.scene.remove(mesh);
                mesh.geometry?.dispose?.();
            });
            this._batches = [];
        }
        if (this._geometries) {
            this._geometries.forEach((g) => g.dispose?.());
            this._geometries = [];
        }
        this._pickers = [];
        if (this._materials) {
            this._materials.forEach((m) => m.dispose?.());
            this._materials = [];
        }
        this._mats?.clear?.();
        this._partTexture?.dispose();
        this._selTexture?.dispose();
        this._partTexture = null;
        this._selTexture = null;
        if (this._kidneyGroup) {
            while (this._kidneyGroup.children.length > 0) {
                const child = this._kidneyGroup.children[0];
                this._kidneyGroup.remove(child);
            }
            this._kidneyGroup.visible = false;
        }
        this.atlas = null;
        this._layoutKey = '';
        this._offsets = [];
        this._dirty = true;
    }

    /** Charge atlas.json déjà fetché + buffers binaires. */
    async loadAtlas(atlas, buffers, onProgress) {
        this.clearAtlas();
        this._geometries = [];
        this._materials = [];
        this._pickers = [];
        this._batches = [];
        this.atlas = atlas;
        const width = THREE.MathUtils.ceilPowerOfTwo(atlas.parts.length);
        this._texW = width;
        this._data = new Float32Array(width * 4);
        this._partTexture = new THREE.DataTexture(this._data, width, 1, THREE.RGBAFormat, THREE.FloatType);
        this._partTexture.needsUpdate = true;
        this._selData = new Uint8Array(width * 4);
        this._selTexture = new THREE.DataTexture(this._selData, width, 1);
        this._selTexture.needsUpdate = true;
        this._centers = atlas.parts.map((p) =>
            new THREE.Vector3().fromArray(p.bounds[0]).add(new THREE.Vector3().fromArray(p.bounds[1])).multiplyScalar(0.5));
        this._bounds = atlas.parts.map((p) => new THREE.Box3(new THREE.Vector3().fromArray(p.bounds[0]), new THREE.Vector3().fromArray(p.bounds[1])));

        const materialFor = (system) => {
            const base = SYSTEMS.find((s) => s.id === system);
            const m = new THREE.MeshStandardMaterial({
                color: base?.color ?? '#aebbb8',
                metalness: 0.08, roughness: 0.53, side: THREE.DoubleSide,
                transparent: system === 'integumentary', opacity: system === 'integumentary' ? 0.12 : 1,
                depthWrite: system !== 'integumentary',
            });
            m.onBeforeCompile = (shader) => {
                shader.uniforms.partState = { value: this._partTexture };
                shader.uniforms.selectionState = { value: this._selTexture };
                shader.uniforms.stateWidth = { value: this._texW };
                shader.vertexShader = 'attribute float partIndex; uniform sampler2D partState; uniform sampler2D selectionState; uniform float stateWidth; varying float partVisible; varying float partSelected;\n' + shader.vertexShader;
                shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5); vec4 state = texture2D(partState, stateUv); transformed += state.xyz; partVisible = state.w; partSelected = texture2D(selectionState, stateUv).r;');
                shader.fragmentShader = 'varying float partVisible; varying float partSelected;\n' + shader.fragmentShader;
                shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (partVisible < 0.5) discard;');
                shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.0, 0.95, 0.99), partSelected * 0.75);');
            };
            this._materials.push(m);
            return m;
        };
        this._mats = new Map(SYSTEMS.map((s) => [s.id, materialFor(s.id)]));

        const cardiacGrouping = groupCardiacParts(atlas.parts);
        this._heartPartIndices = cardiacGrouping.partIndices;
        this._heartMeshes = [];

        // Reconstruction des maillages
        atlas.chunks.forEach((chunk, ci) => {
            const buffer = buffers[ci];
            if (!buffer) return;
            const groups = new Map();
            atlas.parts.forEach((p, i) => {
                if (p.chunk !== ci) return;
                const g = new THREE.BufferGeometry();
                g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buffer, p.positions, p.vertexCount * 3), 3));
                g.setAttribute('normal', new THREE.BufferAttribute(new Int16Array(buffer, p.normals, p.vertexCount * 3), 3, true));
                g.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer, p.indices, p.indexCount), 1));
                g.boundingBox = this._bounds[i].clone();
                g.computeBoundingSphere();
                const pick = new THREE.Mesh(g);
                pick.matrixAutoUpdate = false;
                this._pickers[i] = pick;
                this._geometries.push(g);
                g.setAttribute('partIndex', new THREE.BufferAttribute(new Float32Array(p.vertexCount).fill(i), 1));

                const isCardiacPure = this._heartPartIndices.has(i);
                if (isCardiacPure) {
                    // Création du maillage cardiaque individuel pour animation locale et scale centré
                    const meta = cardiacGrouping.partMeta.get(i);
                    const hg = g.clone();
                    hg.center();
                    this._geometries.push(hg);

                    let matColor = '#e06055';
                    let roughness = 0.46;
                    let metalness = 0.08;

                    if (meta?.role?.includes('Valve')) {
                        matColor = '#f0dcd8';
                        roughness = 0.35;
                    } else if (meta?.role === 'ventricleCavities' || meta?.role === 'atriumCavities') {
                        matColor = '#c43d32';
                    } else if (meta?.role === 'ventricleWall' || meta?.role === 'atriumWalls') {
                        matColor = '#d95246';
                    }

                    const hMat = new THREE.MeshStandardMaterial({
                        color: matColor,
                        roughness,
                        metalness,
                        side: THREE.DoubleSide
                    });
                    this._materials.push(hMat);

                    const hMesh = new THREE.Mesh(hg, hMat);
                    hMesh.position.copy(this._centers[i]);
                    hMesh.frustumCulled = false;
                    this._heartGroup.add(hMesh);

                    this._heartMeshes.push({
                        mesh: hMesh,
                        mat: hMat,
                        baseColor: new THREE.Color(matColor),
                        index: i,
                        part: p,
                        role: meta ? meta.role : 'other',
                        key: meta ? meta.key : '',
                        center: this._centers[i].clone()
                    });
                    // Ne PAS pousser g dans list pour éviter qu'il soit fusionné dans le batch statique
                } else {
                    const list = groups.get(p.system) ?? [];
                    list.push(g);
                    groups.set(p.system, list);
                }
            });
            groups.forEach((gs, system) => {
                const merged = mergeGeometries(gs, false);
                if (!merged) return;
                this._geometries.push(merged);
                let mat = this._mats.get(system);
                if (!mat) {
                    mat = materialFor(system);
                    this._mats.set(system, mat);
                }
                const mesh = new THREE.Mesh(merged, mat);
                mesh.frustumCulled = false;
                this.scene.add(mesh);
                this._batches.push(mesh);
            });
            try { onProgress?.(ci + 1, atlas.chunks.length); } catch {}
        });

        // Calcul des limites et centre du cœur pour le cadrage
        this._heartBounds.makeEmpty();
        this._heartMeshes.forEach((hm) => {
            const b = this._bounds[hm.index];
            if (b) this._heartBounds.union(b);
        });
        if (!this._heartBounds.isEmpty()) {
            this._heartBounds.getCenter(this._heartCenter);
        }

        // Calcul des directions d'ouverture centrifuge pour chaque groupe de valves
        ['aorticValve', 'pulmonaryValve', 'mitralValve', 'tricuspidValve'].forEach((vRole) => {
            const vMeshes = this._heartMeshes.filter((m) => m.role === vRole);
            if (vMeshes.length > 0) {
                const vCenter = new THREE.Vector3();
                vMeshes.forEach((m) => vCenter.add(m.center));
                vCenter.multiplyScalar(1 / vMeshes.length);
                vMeshes.forEach((m) => {
                    m.outwardDir = m.center.clone().sub(vCenter).normalize();
                    if (m.outwardDir.lengthSq() < 0.001) m.outwardDir.set(0, 0, 1);
                });
            }
        });

        this._ready = true;
        this._dirty = true;
    }

    setState(patch) {
        Object.assign(this.state, patch);
        this._dirty = true;
    }

    select(id) {
        this.state.selected = id ? [id] : [];
        this._dirty = true;
    }

    /** Orbite la caméra (radians) : utilisé par pavé tactile + clavier. */
    orbitBy(dAzimuth = 0, dPolar = 0) {
        if (!this.controls || this._disposed) return;
        const off = this.camera.position.clone().sub(this.controls.target);
        const sph = new THREE.Spherical().setFromVector3(off);
        sph.theta -= dAzimuth;
        sph.phi = THREE.MathUtils.clamp(sph.phi - dPolar, 0.05, Math.PI * 0.96);
        off.setFromSpherical(sph);
        this.camera.position.copy(this.controls.target).add(off);
        this.controls.update();
        this._dirty = true;
    }

    /** Zoom avant/arrière (factor > 1 = rapproche). */
    zoomBy(factor = 1.2) {
        if (!this.controls || this._disposed) return;
        const off = this.camera.position.clone().sub(this.controls.target);
        const len = THREE.MathUtils.clamp(off.length() / factor, this.controls.minDistance, this.controls.maxDistance);
        off.setLength(len);
        this.camera.position.copy(this.controls.target).add(off);
        this.controls.update();
        this._dirty = true;
    }

    /** Monte/descend la caméra sur l'axe Y uniquement (cible + caméra translatées). */
    panY(d = 0.15) {
        if (!this.controls || this._disposed) return;
        const t = this.controls.target;
        t.y = THREE.MathUtils.clamp(t.y + d, -0.5, 2.4);
        this.camera.position.y += d;
        this.controls.update();
        this._dirty = true;
    }

    resetView() {
        this.setState({ view: 'three-quarter', explode: this.state.explode });
        this._fit('three-quarter', this._amount);
    }

    /** Vue nommée publique (évite d'appeler _fit privé depuis l'UI). */
    viewTo(view) {
        this.setState({ view });
        this._fit(view, this._amount);
    }

    // ---------- interaction ----------
    _hideHover() { if (this._hover) this._hover.hidden = true; }

    _onHover(e) {
        if (!this._ready || e.buttons) return;
        // hover simple : ne s'active qu'en vue explosée légère pour limiter le coût
        this._hideHover();
    }

    _onTap(e) {
        if (this._disposed) return;
        if (this._downPos && Math.hypot(e.clientX - this._downPos.x, e.clientY - this._downPos.y) > 8) return;
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        this.raycaster.setFromCamera(this.pointer, this.camera);

        if (this.isKidneyMode) {
            const hits = this.raycaster.intersectObjects(this._kidneyGroup.children, true);
            const hit = hits.find((h) => h.object.isMesh && h.object.visible);
            if (hit) {
                const item = hit.object.userData?.kidneyItem;
                if (item && typeof this.onSelectKidney === 'function') {
                    this.onSelectKidney(item);
                }
            }
            return;
        }

        if (!this._ready) return;
        const box = new THREE.Box3();
        const hit = new THREE.Vector3();
        let nearest = Infinity;
        let found = -1;
        const hasSolid = this.atlas.parts.some((p, i) => p.system !== 'integumentary' && this._data[i * 4 + 3] > 0.5);
        this._pickers.forEach((mesh, i) => {
            if (!mesh || this._data[i * 4 + 3] < 0.5) return;
            if (hasSolid && this.atlas.parts[i].system === 'integumentary') return;
            box.copy(this._bounds[i]).translate(mesh.position);
            if (!this.raycaster.ray.intersectBox(box, hit)) return;
            const hits = this.raycaster.intersectObject(mesh, false);
            if (hits[0] && hits[0].distance < nearest) { nearest = hits[0].distance; found = i; }
        });
        if (found >= 0) {
            const id = this.atlas.parts[found].id;
            this.select(id);
            this.onSelect(id, this.atlas.parts[found]);
        }
    }

    _fit(view = 'three-quarter', extent = 0) {
        const c = this.camera;
        const dist = THREE.MathUtils.lerp(3.2, 5.2, extent);
        const dir = view === 'front' ? new THREE.Vector3(0, 0.02, 1)
            : view === 'back' ? new THREE.Vector3(0, 0.02, -1)
            : view === 'side' ? new THREE.Vector3(1, 0.02, 0)
            : new THREE.Vector3(0.35, 0.12, 1).normalize();
        this.controls.target.set(0, extent > 0.1 ? 0.85 : 0.68, 0);
        c.position.copy(this.controls.target).addScaledVector(dir, dist);
        this.controls.update();
        this._dirty = true;
    }

    _resize() {
        if (!this.renderer || this._disposed) return;
        const el = this.container;
        const w = Math.max(1, el.clientWidth);
        const h = Math.max(1, el.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 768 ? 1.5 : 2));
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this._layoutKey = '';
        this._dirty = true;
    }

    _tick(dt) {
        const s = this.state;
        const moving = Math.abs(this._amount - s.explode) > 0.0001;
        if (moving) {
            this._amount = THREE.MathUtils.damp(this._amount, s.explode, 8, dt);
            this._dirty = true;
        }
        if (!this.isKidneyMode && this._ready && (this._dirty || moving)) {
            const visible = new Set(s.visible);
            const selection = new Set(s.selected);
            const visibleParts = this.atlas.parts.filter((p) => (s.isolate ? selection.has(p.id) : visible.has(p.system) || selection.has(p.id)));
            const key = visibleParts.map((p) => p.id).join(',') + ':' + this.camera.aspect.toFixed(3);
            if (key !== this._layoutKey) {
                const layout = createExplosionLayout(visibleParts, this.camera.aspect);
                this._packingW = layout.width;
                this._packingH = layout.height;
                this.atlas.parts.forEach((p, i) => {
                    const cell = layout.cells.get(p.id);
                    this._offsets[i] = cell ? new THREE.Vector3(cell.x, cell.y + 0.85, 0) : this._centers[i].clone();
                });
                this._layoutKey = key;
            }
            const amount = this._amount;
            this.atlas.parts.forEach((p, i) => {
                const c = this._centers[i];
                const dest = this._offsets[i] || c;
                let dx = 0, dy = 0, dz = 0;
                if (amount <= 0.45) {
                    const t = amount / 0.45;
                    const gi = SYSTEMS.findIndex((sys) => sys.id === p.system);
                    const angle = (gi / SYSTEMS.length) * Math.PI * 2;
                    dx = Math.sin(angle) * t * 0.48;
                    dy = (c.y - 0.85) * t * 0.28;
                    dz = Math.cos(angle) * t * 0.48;
                } else {
                    const t = (amount - 0.45) / 0.55;
                    const gi = SYSTEMS.findIndex((sys) => sys.id === p.system);
                    const angle = (gi / SYSTEMS.length) * Math.PI * 2;
                    dx = THREE.MathUtils.lerp(Math.sin(angle) * 0.48, dest.x - c.x, t);
                    dy = THREE.MathUtils.lerp((c.y - 0.85) * 0.28, dest.y - c.y, t);
                    dz = THREE.MathUtils.lerp(Math.cos(angle) * 0.48, -c.z, t);
                }
                this._explosionOffsets[i] = new THREE.Vector3(dx, dy, dz);
                const selected = selection.has(p.id);
                const vis = (s.isolate ? selected : visible.has(p.system) || selected) ? 1 : 0;
                this._data.set([dx, dy, dz, vis], i * 4);
                this._selData[i * 4] = selected ? 255 : 0;
                const mesh = this._pickers[i];
                if (mesh) { mesh.position.set(dx, dy, dz); mesh.updateMatrix(); mesh.updateMatrixWorld(true); }
            });
            this._partTexture.needsUpdate = true;
            this._selTexture.needsUpdate = true;
        }

        // Animation continue du battement cardiaque
        if (!this.isKidneyMode && this._ready && this._heartMeshes.length > 0) {
            const selection = new Set(s.selected);
            const isCardiacSysVis = s.visible.includes('cardiac');

            if (this.heartbeatEnabled) {
                this._heartTime += dt;
                this._heartSync.update(dt);
                const phase = this.isHeartIsolated
                    ? this._heartSync.getCurrentPhase()
                    : heartPhase(this._heartTime, 72);
                const motion = heartMotion(phase, this.currentHeartPreset, this.isHeartIsolated, this._heartTime);

                this._heartMeshes.forEach((hm) => {
                    const isSel = selection.has(hm.part.id);
                    const isVis = s.isolate
                        ? (this.isHeartIsolated || isSel)
                        : (isCardiacSysVis || isSel);
                    hm.mesh.visible = isVis;
                    if (!isVis) return;

                    // Facteur d'échelle physiologique
                    const sc = motion.scales[hm.role] || { x: 1, y: 1, z: 1 };
                    hm.mesh.scale.set(sc.x, sc.y, sc.z);

                    // Déplacement d'ouverture des valves
                    const beatDisp = new THREE.Vector3();
                    if (hm.role === 'aorticValve' && hm.outwardDir) {
                        beatDisp.copy(hm.outwardDir).multiplyScalar(motion.valveOffsets.aortic);
                    } else if (hm.role === 'pulmonaryValve' && hm.outwardDir) {
                        beatDisp.copy(hm.outwardDir).multiplyScalar(motion.valveOffsets.pulmonary);
                    } else if (hm.role === 'mitralValve' && hm.outwardDir) {
                        beatDisp.copy(hm.outwardDir).multiplyScalar(motion.valveOffsets.mitral);
                    } else if (hm.role === 'tricuspidValve' && hm.outwardDir) {
                        beatDisp.copy(hm.outwardDir).multiplyScalar(motion.valveOffsets.tricuspid);
                    }

                    // Déplacement combiné : centre + explosion + battement
                    const expOff = this._explosionOffsets[hm.index] || new THREE.Vector3();
                    hm.mesh.position.copy(hm.center).add(expOff).add(beatDisp);

                    // Surbrillance sélection
                    if (isSel) {
                        hm.mat.color.set('#00f2fe');
                        hm.mat.emissive.set('#004455');
                    } else {
                        hm.mat.color.copy(hm.baseColor);
                        hm.mat.emissive.set('#000000');
                    }

                    // Mise à jour de la position de détection
                    const pick = this._pickers[hm.index];
                    if (pick) {
                        pick.position.copy(expOff).add(beatDisp);
                        pick.updateMatrix();
                        pick.updateMatrixWorld(true);
                    }
                });

                this._dirty = true;
            } else {
                // État neutre (battement désactivé)
                this._heartMeshes.forEach((hm) => {
                    const isSel = selection.has(hm.part.id);
                    const isVis = s.isolate
                        ? (this.isHeartIsolated || isSel)
                        : (isCardiacSysVis || isSel);
                    hm.mesh.visible = isVis;
                    hm.mesh.scale.set(1, 1, 1);
                    const expOff = this._explosionOffsets[hm.index] || new THREE.Vector3();
                    hm.mesh.position.copy(hm.center).add(expOff);

                    if (isSel) {
                        hm.mat.color.set('#00f2fe');
                        hm.mat.emissive.set('#004455');
                    } else {
                        hm.mat.color.copy(hm.baseColor);
                        hm.mat.emissive.set('#000000');
                    }

                    const pick = this._pickers[hm.index];
                    if (pick) {
                        pick.position.copy(expOff);
                        pick.updateMatrix();
                        pick.updateMatrixWorld(true);
                    }
                });
            }
        }

        this.controls.autoRotate = !this.isKidneyMode && s.rotate && !s.isolate && this._amount < 0.4;
        if (this.controls.autoRotate) this._dirty = true;
        else this.controls.update();
        if (this.ground) this.ground.visible = !this.isKidneyMode && this._amount < 0.5 && !s.isolate;
        // Rendu on-demand : on ne rend que si dirty (caméra, explosion, sélection, battement)
        if (this._dirty && !this._disposed) {
            this.renderer.render(this.scene, this.camera);
            this._dirty = false;
        }
    }

    /** Active ou coupe le battement cardiaque en temps réel. */
    setHeartbeat(enabled) {
        this.heartbeatEnabled = Boolean(enabled);
        if (this._heartSync) {
            this._heartSync.paused = !this.heartbeatEnabled;
        }
        this._dirty = true;
    }

    /** Change le preset de pathologie cardiaque (sinus, ra, im, acfa). */
    setHeartPreset(presetId) {
        this.currentHeartPreset = presetId;
        if (this._heartSync) {
            this._heartSync.loadPreset(presetId);
        }
        this._dirty = true;
    }

    /** Bascule le mode cœur isolé avec cadrage et synchronisation ECG. */
    isolateHeart(isolate = true, presetId = 'sinus') {
        this.isHeartIsolated = isolate;
        this.setState({ isolate });
        if (isolate) {
            this.setHeartPreset(presetId);
            this.focusHeart();
        } else {
            this.resetView();
        }
        this._dirty = true;
    }

    /** Cadre automatiquement la caméra sur le cœur en vue rapprochée optimale. */
    focusHeart() {
        if (!this.controls || this._disposed) return;
        const box = this._heartBounds;
        const center = this._heartCenter;
        if (!box || box.isEmpty()) return;

        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.12);
        const dist = maxDim * 2.5;

        // Angle trois-quarts avant-gauche
        const dir = new THREE.Vector3(0.35, 0.15, 0.92).normalize();
        this.controls.target.copy(center);
        this.camera.position.copy(center).addScaledVector(dir, dist);
        this.controls.update();
        this._dirty = true;
    }

    // ==========================================
    // MÉTHODES DU REIN DÉTAILLÉ (HuBMAP v1.2)
    // ==========================================

    /**
     * Attache la hiérarchie 3D du rein à la scène.
     * @param {THREE.Group} group
     * @param {THREE.Box3} bounds
     * @param {THREE.Vector3} center
     */
    attachKidneyScene(group, bounds, center) {
        if (!this._kidneyGroup) return;
        while (this._kidneyGroup.children.length > 0) {
            this._kidneyGroup.remove(this._kidneyGroup.children[0]);
        }
        this._kidneyGroup.add(group);
        this._kidneyBounds = bounds;
        this._kidneyCenter = center;
        this._kidneyGroup.visible = this.isKidneyMode;
        if (this.isKidneyMode) {
            this.focusKidney();
        }
        this._dirty = true;
    }

    /**
     * Bascule le mode Rein isolé.
     * @param {boolean} active
     */
    setKidneyMode(active = true) {
        this.isKidneyMode = Boolean(active);
        if (this._kidneyGroup) {
            this._kidneyGroup.visible = this.isKidneyMode;
        }
        if (this.isKidneyMode) {
            if (this._batches) {
                this._batches.forEach((b) => { b.visible = false; });
            }
            if (this._heartMeshes) {
                this._heartMeshes.forEach((hm) => { hm.mesh.visible = false; });
            }
            if (this.ground) {
                this.ground.visible = false;
            }
            this.focusKidney();
        } else {
            if (this._batches) {
                this._batches.forEach((b) => { b.visible = true; });
            }
            if (this.ground) {
                this.ground.visible = this._amount < 0.5 && !this.state.isolate;
            }
            this.resetView();
        }
        this._dirty = true;
    }

    /**
     * Cadre la caméra sur le rein en vue rapprochée optimale.
     */
    focusKidney() {
        if (!this.controls || this._disposed) return;
        const target = this._kidneyCenter || new THREE.Vector3(0, 0.85, 0);
        const dist = 0.52;
        const dir = new THREE.Vector3(0.18, 0.12, 0.95).normalize();
        this.controls.target.copy(target);
        this.camera.position.copy(target).addScaledVector(dir, dist);
        this.controls.update();
        this._dirty = true;
    }

    /** Libération complète : cancel RAF, controls, géométries, matériaux, textures, renderer. */
    dispose() {
        this._disposed = true;
        try { cancelAnimationFrame(this._frame); } catch {}
        try { this._resizeObserver?.disconnect(); } catch {}
        try { this.controls?.dispose(); } catch {}
        try { this._geometries?.forEach((g) => g.dispose()); } catch {}
        try { this._materials?.forEach((m) => m.dispose()); } catch {}
        if (this._heartMeshes) {
            this._heartMeshes.forEach((hm) => {
                hm.mesh?.geometry?.dispose?.();
                hm.mat?.dispose?.();
            });
            this._heartMeshes = [];
        }
        if (this._kidneyGroup) {
            this.scene?.remove(this._kidneyGroup);
            while (this._kidneyGroup.children.length > 0) {
                const child = this._kidneyGroup.children[0];
                this._kidneyGroup.remove(child);
            }
        }
        try {
            this.scene?.traverse((o) => {
                if (o.isMesh && o.geometry && !this._geometries?.includes(o.geometry)) o.geometry.dispose?.();
            });
        } catch {}
        try { this._partTexture?.dispose(); } catch {}
        try { this._selTexture?.dispose(); } catch {}
        try { this._envRT?.dispose(); } catch {}
        try { this._hover?.remove(); } catch {}
        try { this.renderer?.dispose(); } catch {}
        try { this.renderer?.domElement?.remove(); } catch {}
        this._geometries = []; this._materials = []; this._pickers = [];
    }
}
