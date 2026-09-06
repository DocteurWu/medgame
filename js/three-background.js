import * as THREE from 'three';

/**
 * Three.js Background Module - MedGame (v4 "Harmonic Heartbeat & Shockwave")
 * ────────────────────────────────────────────────────────────────────────
 *  • Rendu 100% transparent (alpha: true) : FondAccueil.webp parfaitement net
 *  • Globules rouges biconcaves 3D (courbe Evans-Fung) rouge rubis
 *  • Hélice ADN fine, aérée et décalée avec élégance
 *  • Battement cardiaque global (62 BPM) synchronisé : lumière, ADN, érythrocytes
 *  • Onde de choc fluide au clic (pulseAt) déformant particules et globules
 *  • Thème dynamique fluide (setTheme) pour préparer la sélection des UE
 *  • 60 FPS garanti, zéro lag, aucun encombrement visuel
 */
const ThreeBackground = (function () {
    'use strict';

    let scene, camera, renderer, clock, animationId;
    let dnaGroup, dnaMesh, starsMesh, cellsMesh, glowMesh;
    let mouseLight, rimLight, sunLight;
    let raycaster, mousePlane;
    let container;
    let options = {};

    // Souris
    const ndcTarget = new THREE.Vector2(0, 0);
    const ndc = new THREE.Vector2(0, 0);
    const mouseWorld = new THREE.Vector3(0, 0, 0);
    const mouseWorldTarget = new THREE.Vector3(0, 0, 0);
    let mouseStrength = 0;
    let lastMouseMove = 0;

    // Warp (transition)
    let warp = 0, warpTarget = 0;

    // Onde de choc au clic
    const shock = new THREE.Vector3(0, 0, 99); // x, y, temps écoulé
    let shockFlash = 0;

    // Battement cardiaque (62 BPM)
    const BPM = 62;
    let beatIndex = -1, heartbeat = 0;

    // Couleurs du thème dynamique
    const colA = new THREE.Color(), colB = new THREE.Color();
    const colATarget = new THREE.Color(), colBTarget = new THREE.Color();

    // Globules rouges instanciés
    const cellData = [];
    const _m4 = new THREE.Matrix4();
    const _pos = new THREE.Vector3();
    const _quat = new THREE.Quaternion();
    const _scale = new THREE.Vector3();
    const _euler = new THREE.Euler();
    const _v3 = new THREE.Vector3();

    let isMobile = false;
    let reducedMotion = false;
    let paused = false;

    const defaultOptions = {
        type: 'dna',
        particleCount: 750,
        dnaCount: 750,
        cellCount: 14,        // Juste milieu idéal
        enableMouse: true,
        enableGlow: true,
        colorA: 0x00f2fe,     // Cyan médical
        colorB: 0xa277ff      // Violet doux
    };

    function init(containerId, userOptions = {}) {
        container = document.getElementById(containerId);
        if (!container) {
            console.warn('[ThreeBackground] Container introuvable :', containerId);
            return;
        }

        if (renderer) {
            destroy();
            container = document.getElementById(containerId);
        }

        options = { ...defaultOptions, ...userOptions };

        isMobile = window.innerWidth < 820 || window.matchMedia('(pointer: coarse)').matches;
        reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (isMobile) {
            options.particleCount = Math.floor(options.particleCount * 0.5);
            options.dnaCount = Math.floor(options.dnaCount * 0.6);
            options.cellCount = Math.floor(options.cellCount * 0.4);
        }

        colA.set(options.colorA);
        colB.set(options.colorB);
        colATarget.copy(colA);
        colBTarget.copy(colB);

        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.set(0, 0, 12);

        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true, // Transparent pour laisser respirer FondAccueil.webp
            powerPreference: 'high-performance'
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000, 0);
        container.appendChild(renderer.domElement);

        clock = new THREE.Clock();
        raycaster = new THREE.Raycaster();
        mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

        createLights();
        createStars();
        createCells();
        if (options.type === 'dna') createDNAHelix();
        if (options.enableGlow) createAmbientGlow();

        if (options.enableMouse && !reducedMotion) initInteraction();

        window.addEventListener('resize', handleResize);
        document.addEventListener('visibilitychange', handleVisibility);

        renderer.domElement.style.opacity = '0';
        renderer.domElement.style.transition = 'opacity 1s ease';
        requestAnimationFrame(() => {
            if (renderer && renderer.domElement) {
                renderer.domElement.style.opacity = '1';
            }
        });

        animate();
    }

    function createLights() {
        scene.add(new THREE.AmbientLight(0x2a3560, 0.55));

        mouseLight = new THREE.PointLight(colA.getHex(), 18, 25, 2);
        mouseLight.position.set(0, 0, 4);
        scene.add(mouseLight);

        rimLight = new THREE.PointLight(colB.getHex(), 15, 30, 2);
        rimLight.position.set(-6, 5, -3);
        scene.add(rimLight);

        // Lumière chaude directionnelle pour faire briller les globules rouges biconcaves
        sunLight = new THREE.DirectionalLight(0xffeded, 1.25);
        sunLight.position.set(5, 7, 6);
        scene.add(sunLight);
    }

    // ── Particules / Poussières fines avec scintillement et onde de choc ─
    function createStars() {
        const n = options.particleCount;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(n * 3);
        const col = new Float32Array(n * 3);
        const size = new Float32Array(n);
        const phase = new Float32Array(n);
        const depth = new Float32Array(n);

        const cW = new THREE.Color(0xffffff);
        const tmp = new THREE.Color();

        for (let i = 0; i < n; i++) {
            const i3 = i * 3;
            pos[i3] = (Math.random() - 0.5) * 50;
            pos[i3 + 1] = (Math.random() - 0.5) * 34;
            pos[i3 + 2] = -Math.random() * 32 - 1;
            depth[i] = 1 - (-pos[i3 + 2] / 35);

            const r = Math.random();
            tmp.copy(r < 0.5 ? colA : r < 0.85 ? colB : cW).lerp(cW, 0.25);
            col[i3] = tmp.r;
            col[i3 + 1] = tmp.g;
            col[i3 + 2] = tmp.b;

            size[i] = 0.4 + Math.random() * 1.0 + depth[i] * 0.6;
            phase[i] = Math.random() * Math.PI * 2;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
        geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
        geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));

        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uMouse: { value: new THREE.Vector2() },
                uPixelRatio: { value: renderer.getPixelRatio() },
                uBoost: { value: 0 },
                uShock: { value: shock },
                uBeat: { value: 0 }
            },
            vertexShader: /* glsl */`
                uniform float uTime;
                uniform vec2 uMouse;
                uniform float uPixelRatio;
                uniform float uBoost;
                uniform vec3 uShock;
                uniform float uBeat;
                attribute float aSize;
                attribute float aPhase;
                attribute float aDepth;
                varying vec3 vColor;
                varying float vTwinkle;

                void main() {
                    vColor = color;
                    vec3 p = position;
                    p.x += sin(uTime * 0.12 + aPhase) * 0.3;
                    p.y += cos(uTime * 0.09 + aPhase * 1.2) * 0.3;
                    p.xy += uMouse * aDepth * 1.4;

                    // Onde de choc au clic
                    if (uShock.z < 2.5) {
                        float d = length(p.xy - uShock.xy);
                        float r = uShock.z * 11.0;
                        float ring = exp(-pow((d - r) * 0.85, 2.0)) * max(0.0, 1.0 - uShock.z / 2.5);
                        p.xy += normalize(p.xy - uShock.xy + 0.001) * ring * 1.8;
                    }

                    p.z += uBoost * aDepth * 12.0;
                    vec4 mv = modelViewMatrix * vec4(p, 1.0);
                    vTwinkle = 0.5 + 0.5 * sin(uTime * (0.8 + aDepth * 2.0) + aPhase * 5.0);
                    gl_PointSize = aSize * uPixelRatio * (12.0 / -mv.z) * (1.0 + uBoost * 0.6 + uBeat * 0.15 * aDepth);
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */`
                varying vec3 vColor;
                varying float vTwinkle;

                void main() {
                    float d = length(gl_PointCoord - 0.5);
                    if (d > 0.5) discard;
                    float a = smoothstep(0.5, 0.05, d);
                    a = pow(a, 2.2) * (0.3 + 0.7 * vTwinkle);
                    gl_FragColor = vec4(vColor, a * 0.75);
                }`,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexColors: true
        });

        starsMesh = new THREE.Points(geo, mat);
        scene.add(starsMesh);
    }

    // ── Vrais Globules Rouges (Érythrocytes biconcaves 3D) ──────────────
    function createCells() {
        const n = options.cellCount;

        const points = [];
        const N = 20;
        const R = 0.42;

        // Moitié inférieure
        for (let i = 0; i <= N; i++) {
            const x = i / N;
            const r = x * R;
            const h = 0.14 * Math.sqrt(Math.max(0, 1.001 - x * x)) * (0.28 + 1.8 * x * x - 1.08 * x * x * x * x);
            points.push(new THREE.Vector2(Math.max(0, r), -h));
        }
        // Moitié supérieure
        for (let i = N; i >= 0; i--) {
            const x = i / N;
            const r = x * R;
            const h = 0.14 * Math.sqrt(Math.max(0, 1.001 - x * x)) * (0.28 + 1.8 * x * x - 1.08 * x * x * x * x);
            points.push(new THREE.Vector2(Math.max(0, r), h));
        }

        const geo = new THREE.LatheGeometry(points, 28);
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            color: 0xd63031,             // Rouge sang rubis riche
            roughness: 0.32,
            metalness: 0.05,
            emissive: 0x600707,          // Lueur sanguine chaleureuse
            emissiveIntensity: 0.38,
            transparent: true,
            opacity: 0.78                // Bel équilibre présence / translucidité
        });

        cellsMesh = new THREE.InstancedMesh(geo, mat, n);
        cellsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        const redShades = [
            new THREE.Color(0xd63031),
            new THREE.Color(0xeb3b5a),
            new THREE.Color(0xfa5252),
            new THREE.Color(0xc0392b),
            new THREE.Color(0xe74c3c)
        ];

        for (let i = 0; i < n; i++) {
            cellData.push({
                base: new THREE.Vector3(
                    1.0 + (Math.random() - 0.5) * 20,
                    (Math.random() - 0.5) * 15,
                    -Math.random() * 8 - 3.5             // Profondeur moyenne équilibrée
                ),
                phase: Math.random() * Math.PI * 2,
                speed: 0.18 + Math.random() * 0.32,
                scale: 0.44 + Math.random() * 0.3,       // Taille juste milieu
                rot: new THREE.Vector3(
                    0.4 + Math.random() * 0.7,
                    0.4 + Math.random() * 0.7,
                    0.2 + Math.random() * 0.5
                )
            });

            const shade = redShades[i % redShades.length];
            cellsMesh.setColorAt(i, shade);
        }

        cellsMesh.instanceColor.needsUpdate = true;
        scene.add(cellsMesh);
    }

    // ── Hélice ADN fine, aérée et réactive au battement + onde de choc ─
    function createDNAHelix() {
        dnaGroup = new THREE.Group();
        const n = options.dnaCount;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(n * 3);
        const col = new Float32Array(n * 3);
        const scl = new Float32Array(n);
        const phs = new Float32Array(n);
        const radius = 2.6, spacing = 0.038, twist = 0.11;

        for (let i = 0; i < n; i++) {
            const i3 = i * 3;
            const y = i * spacing - (n * spacing) / 2;
            const angle = i * twist;
            const type = i % 3;
            let x, z, r, g, b;

            if (type < 2) {
                const off = type === 0 ? 0 : Math.PI;
                x = Math.cos(angle + off) * radius + (Math.random() - 0.5) * 0.18;
                z = Math.sin(angle + off) * radius + (Math.random() - 0.5) * 0.18;
                if (type === 0) { r = 0.0; g = 0.85; b = 1.0; } else { r = 0.65; g = 0.45; b = 1.0; }
                scl[i] = 0.5 + Math.random() * 0.5;
            } else {
                const t = Math.random() * 2 - 1;
                x = Math.cos(angle) * radius * t + (Math.random() - 0.5) * 0.06;
                z = Math.sin(angle) * radius * t + (Math.random() - 0.5) * 0.06;
                r = 0.7; g = 0.85; b = 1.0;
                scl[i] = 0.15 + Math.random() * 0.2;
            }

            pos[i3] = x;
            pos[i3 + 1] = y;
            pos[i3 + 2] = z;
            col[i3] = r;
            col[i3 + 1] = g;
            col[i3 + 2] = b;
            phs[i] = Math.random() * Math.PI * 2;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.setAttribute('aScale', new THREE.BufferAttribute(scl, 1));
        geo.setAttribute('aPhase', new THREE.BufferAttribute(phs, 1));

        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uMouse: { value: new THREE.Vector3(0, 0, 0) },
                uMouseStrength: { value: 0 },
                uPixelRatio: { value: renderer.getPixelRatio() },
                uWarp: { value: 0 },
                uShock: { value: shock },
                uBeat: { value: 0 },
                uColorA: { value: colA },
                uColorB: { value: colB }
            },
            vertexShader: /* glsl */`
                uniform float uTime;
                uniform vec3 uMouse;
                uniform float uMouseStrength;
                uniform float uPixelRatio;
                uniform float uWarp;
                uniform vec3 uShock;
                uniform float uBeat;
                uniform vec3 uColorA;
                uniform vec3 uColorB;
                attribute float aScale;
                attribute float aPhase;
                varying vec3 vColor;
                varying float vGlow;

                void main() {
                    // Teinte dynamique selon thème
                    float isCyan = step(0.6, color.g) * step(color.r, 0.3);
                    float isViolet = step(0.6, color.r);
                    vColor = mix(color, uColorA, isCyan);
                    vColor = mix(vColor, uColorB, isViolet);

                    vec3 p = position;
                    // Respiration douce + pulsation cardiaque 62 BPM
                    p.xz *= 1.0 + sin(uTime * 0.7 + position.y * 0.4) * 0.035 + uBeat * 0.04;
                    vec4 world = modelMatrix * vec4(p, 1.0);

                    // Interaction curseur
                    vec3 toMouse = world.xyz - uMouse;
                    float d = length(toMouse.xy);
                    float force = smoothstep(3.5, 0.0, d) * uMouseStrength;
                    world.xyz += normalize(toMouse + vec3(0.0, 0.0, 0.001)) * force * 1.2;

                    // Onde de choc au clic
                    float sw = 0.0;
                    if (uShock.z < 2.5) {
                        float sd = length(world.xy - uShock.xy);
                        float sr = uShock.z * 11.0;
                        sw = exp(-pow((sd - sr) * 0.85, 2.0)) * max(0.0, 1.0 - uShock.z / 2.5);
                        world.xyz += normalize(world.xyz - vec3(uShock.xy, 0.0) + 0.001) * sw * 1.6;
                    }

                    world.xyz += normalize(world.xyz) * uWarp * 2.0;
                    vGlow = force + sw;

                    vec4 mv = viewMatrix * world;
                    float pulse = 0.85 + 0.15 * sin(uTime * 2.4 + aPhase);
                    gl_PointSize = (7.0 * aScale * pulse + force * 6.0 + sw * 8.0 + uBeat * 2.0 * aScale) * uPixelRatio * (11.0 / -mv.z);
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */`
                varying vec3 vColor;
                varying float vGlow;

                void main() {
                    float d = length(gl_PointCoord - 0.5);
                    if (d > 0.5) discard;
                    float core = smoothstep(0.5, 0.0, d);
                    float a = pow(core, 2.0) * 0.72;
                    vec3 col = mix(vColor, vec3(1.0), vGlow * 0.6 + core * 0.2);
                    gl_FragColor = vec4(col, a);
                }`,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexColors: true
        });

        dnaMesh = new THREE.Points(geo, mat);
        dnaGroup.add(dnaMesh);
        dnaGroup.position.set(3.4, 0, -3.0);
        dnaGroup.rotation.set(0.2, 0.1, 0.35);
        scene.add(dnaGroup);
        window._dnaGroup = dnaGroup;
    }

    function createAmbientGlow() {
        const geo = new THREE.SphereGeometry(8.5, 32, 32);
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uMouse: { value: new THREE.Vector2() },
                uColor1: { value: colA },
                uColor2: { value: colB },
                uBeat: { value: 0 }
            },
            vertexShader: /* glsl */`
                varying vec3 vPosition;
                varying vec3 vNormal;
                void main() {
                    vPosition = position;
                    vNormal = normal;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
            fragmentShader: /* glsl */`
                uniform float uTime;
                uniform vec2 uMouse;
                uniform vec3 uColor1;
                uniform vec3 uColor2;
                uniform float uBeat;
                varying vec3 vPosition;
                varying vec3 vNormal;

                void main() {
                    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.5);
                    float wave = sin(vPosition.y * 0.4 + uTime * 0.6) * 0.5 + 0.5;
                    float mi = length(uMouse) * 0.2;
                    vec3 color = mix(uColor1, uColor2, wave + mi);
                    gl_FragColor = vec4(color, fresnel * (0.045 + uBeat * 0.02) * (0.6 + mi));
                }`,
            transparent: true,
            side: THREE.BackSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        glowMesh = new THREE.Mesh(geo, mat);
        glowMesh.position.z = -5;
        scene.add(glowMesh);
    }

    // ── Interaction curseur & clic ──────────────────────────────────────
    let handleMouseMove, handleMouseLeave, handleTouchMove, handlePointerDown;

    function initInteraction() {
        const setFromClient = (x, y) => {
            ndcTarget.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
            lastMouseMove = performance.now();
        };

        handleMouseMove = (e) => setFromClient(e.clientX, e.clientY);
        handleMouseLeave = () => { lastMouseMove = 0; };
        handleTouchMove = (e) => {
            if (e.touches && e.touches.length) {
                setFromClient(e.touches[0].clientX, e.touches[0].clientY);
            }
        };

        // Onde de choc au clic
        handlePointerDown = (e) => {
            const p = e.touches ? e.touches[0] : e;
            pulseAt(p.clientX, p.clientY);
        };

        document.addEventListener('mousemove', handleMouseMove, { passive: true });
        document.addEventListener('mouseleave', handleMouseLeave);
        document.addEventListener('touchmove', handleTouchMove, { passive: true });
        document.addEventListener('pointerdown', handlePointerDown, { passive: true });
    }

    /** Déclenche une onde de choc à une position d'écran */
    function pulseAt(clientX, clientY) {
        if (!camera) return;
        _v3.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1, 0);
        raycaster.setFromCamera(_v3, camera);
        raycaster.ray.intersectPlane(mousePlane, mouseWorldTarget);
        shock.set(mouseWorldTarget.x, mouseWorldTarget.y, 0);
        shockFlash = 1.0;
    }

    // ── Battement cardiaque 62 BPM ──────────────────────────────────────
    function heartbeatCurve(t) {
        const ph = (t * BPM / 60) % 1;
        const g = (c, w) => Math.exp(-Math.pow((ph - c) / w, 2));
        const idx = Math.floor(t * BPM / 60);

        if (idx !== beatIndex) {
            beatIndex = idx;
            // Émet un événement global écouté par l'UI
            window.dispatchEvent(new CustomEvent('medgame:heartbeat', { detail: { bpm: BPM } }));
        }

        // Double battement systolique + diastolique
        return Math.min(1.0, g(0.0, 0.04) + 0.45 * g(0.18, 0.05));
    }

    // ── Boucle d'animation ──────────────────────────────────────────────
    function animate() {
        animationId = requestAnimationFrame(animate);
        if (paused) return;

        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.getElapsedTime();
        const motion = reducedMotion ? 0.25 : 1;

        // Interaction curseur
        const active = lastMouseMove && (performance.now() - lastMouseMove < 1600);
        ndc.lerp(ndcTarget, active ? 0.07 : 0.025);
        mouseStrength += ((active ? 1 : 0) - mouseStrength) * 0.05;

        raycaster.setFromCamera(ndc, camera);
        raycaster.ray.intersectPlane(mousePlane, mouseWorldTarget);
        mouseWorld.lerp(mouseWorldTarget, 0.1);

        // Interpolations temporelles
        warp += (warpTarget - warp) * 0.07;
        shock.z += dt;
        shockFlash *= 0.92;

        heartbeat = reducedMotion ? 0 : heartbeatCurve(t);

        // Interpolation douce du thème de couleur
        colA.lerp(colATarget, 0.04);
        colB.lerp(colBTarget, 0.04);

        // Hélice ADN
        if (dnaGroup && dnaMesh) {
            dnaGroup.rotation.y += (0.002 + warp * 0.04) * motion;
            dnaGroup.rotation.x += (ndc.y * -0.25 + 0.2 - dnaGroup.rotation.x) * 0.04;
            dnaGroup.rotation.z += (0.35 + ndc.x * 0.2 - dnaGroup.rotation.z) * 0.04;

            const u = dnaMesh.material.uniforms;
            u.uTime.value = t * motion;
            u.uMouse.value.copy(mouseWorld);
            u.uMouseStrength.value = mouseStrength;
            u.uWarp.value = warp;
            u.uBeat.value = heartbeat;
            u.uShock.value.copy(shock);
            u.uColorA.value.copy(colA);
            u.uColorB.value.copy(colB);
        }

        // Poussières / Particules
        if (starsMesh) {
            const u = starsMesh.material.uniforms;
            u.uTime.value = t * motion;
            u.uMouse.value.copy(ndc);
            u.uBoost.value = warp;
            u.uShock.value.copy(shock);
            u.uBeat.value = heartbeat;
            starsMesh.rotation.z = Math.sin(t * 0.025) * 0.025;
        }

        // Globules rouges biconcaves (réaction à l'onde de choc et au battement)
        if (cellsMesh) {
            for (let i = 0; i < cellData.length; i++) {
                const c = cellData[i];
                _pos.set(
                    c.base.x + Math.sin(t * c.speed + c.phase) * 0.6 + ndc.x * 0.8,
                    c.base.y + Math.cos(t * c.speed * 0.8 + c.phase) * 0.45 + ndc.y * 0.6,
                    c.base.z + Math.sin(t * c.speed * 0.5 + c.phase) * 0.35 + warp * 8
                );

                const dx = mouseWorld.x - _pos.x;
                const dy = mouseWorld.y - _pos.y;
                const dist = Math.hypot(dx, dy);
                const pull = Math.max(0, 1 - dist / 6) * mouseStrength * 0.4;
                _pos.x += dx * pull * 0.07;
                _pos.y += dy * pull * 0.07;

                // Onde de choc repoussant les globules rouges
                if (shock.z < 2.5) {
                    const ds = Math.hypot(_pos.x - shock.x, _pos.y - shock.y);
                    const ring = Math.exp(-Math.pow((ds - shock.z * 11.0) * 0.85, 2)) * (1.0 - shock.z / 2.5);
                    _pos.x += (_pos.x - shock.x) / (ds + 0.01) * ring * 1.5;
                    _pos.y += (_pos.y - shock.y) / (ds + 0.01) * ring * 1.5;
                }

                _euler.set(t * c.rot.x * 0.3, t * c.rot.y * 0.3, t * c.rot.z * 0.2);
                _quat.setFromEuler(_euler);
                // Pulsation élastique du globule rouge en cadence avec le battement
                const s = c.scale * (1 + pull * 0.25 + heartbeat * 0.08);
                _scale.set(s, s, s);
                _m4.compose(_pos, _quat, _scale);
                cellsMesh.setMatrixAt(i, _m4);
            }
            cellsMesh.instanceMatrix.needsUpdate = true;
        }

        // Lumières réactives (pulsent en rythme)
        if (mouseLight) {
            mouseLight.color.copy(colA);
            mouseLight.position.lerp(_v3.set(mouseWorld.x, mouseWorld.y, 3.5), 0.08);
            mouseLight.intensity = 16 + mouseStrength * 20 + heartbeat * 12 + shockFlash * 25;
        }
        if (rimLight) {
            rimLight.color.copy(colB);
        }

        if (glowMesh) {
            glowMesh.material.uniforms.uTime.value = t;
            glowMesh.material.uniforms.uMouse.value.copy(ndc);
            glowMesh.material.uniforms.uBeat.value = heartbeat;
            glowMesh.material.uniforms.uColor1.value.copy(colA);
            glowMesh.material.uniforms.uColor2.value.copy(colB);
            glowMesh.rotation.y = ndc.x * 0.2;
            glowMesh.rotation.x = -ndc.y * 0.15;
        }

        // Caméra : mouvement organique + parallaxe + dolly warp
        const fy = Math.sin(t * 0.4) * 0.2 * motion;
        const fx = Math.cos(t * 0.25) * 0.15 * motion;
        camera.position.x += (fx + ndc.x * 1.2 - camera.position.x) * 0.03;
        camera.position.y += (fy + ndc.y * 0.7 - camera.position.y) * 0.03;
        camera.position.z += (12 - warp * 6.0 - heartbeat * 0.15 - camera.position.z) * 0.08;
        camera.lookAt(0, 0, 0);

        // Rendu direct 100% transparent fluide
        renderer.render(scene, camera);
    }

    function handleResize() {
        if (!renderer || !camera) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);

        const pr = renderer.getPixelRatio();
        if (dnaMesh) dnaMesh.material.uniforms.uPixelRatio.value = pr;
        if (starsMesh) starsMesh.material.uniforms.uPixelRatio.value = pr;
    }

    function handleVisibility() {
        paused = document.hidden;
        if (!paused && clock) clock.getElapsedTime();
    }

    function warpOut() {
        warpTarget = 1;
    }

    /** Permet de changer la palette dynamique (ex: pour les spécialités UE) */
    function setTheme(hexA, hexB) {
        if (hexA != null) colATarget.set(hexA);
        if (hexB != null) colBTarget.set(hexB);
    }

    function destroy() {
        if (animationId) cancelAnimationFrame(animationId);
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('visibilitychange', handleVisibility);

        if (handleMouseMove) document.removeEventListener('mousemove', handleMouseMove);
        if (handleMouseLeave) document.removeEventListener('mouseleave', handleMouseLeave);
        if (handleTouchMove) document.removeEventListener('touchmove', handleTouchMove);
        if (handlePointerDown) document.removeEventListener('pointerdown', handlePointerDown);

        if (scene) {
            scene.traverse((o) => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) {
                    if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
                    else o.material.dispose();
                }
            });
        }

        if (renderer) {
            renderer.dispose();
            renderer.forceContextLoss();
            if (renderer.domElement && renderer.domElement.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
        }

        scene = camera = renderer = dnaGroup = dnaMesh = starsMesh = cellsMesh = glowMesh = null;
        handleMouseMove = handleMouseLeave = handleTouchMove = handlePointerDown = null;
        cellData.length = 0;
        window._dnaGroup = null;
    }

    return {
        init,
        destroy,
        warp: warpOut,
        pulse: pulseAt,
        setTheme,
        get heartbeat() { return heartbeat; }
    };
})();

window.ThreeBackground = ThreeBackground;

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('canvas-container')) return;
    const path = window.location.pathname;
    const type = (path.includes('profile') || path.includes('login')) ? 'particles' : 'dna';
    ThreeBackground.init('canvas-container', { type });
});

export default ThreeBackground;
