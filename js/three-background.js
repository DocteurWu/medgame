import * as THREE from 'three';

/**
 * Three.js Background Module - MedGame (v3.1 "Refined Medical")
 * ─────────────────────────────────────────────────────────────
 *  • Rendu 100% transparent (alpha: true) : préserve FondAccueil.webp net
 *  • Hélice ADN fine, aérée et élégante (taille des points divisée par 2)
 *  • Décalée en arrière-plan à droite pour ne pas étouffer la carte
 *  • Particules douces avec scintillement organique vTwinkle
 *  • Zéro surcharge GPU (rendu natif direct 60 fps garanti)
 *  • Warp cinématique préservé pour les transitions de page
 */
const ThreeBackground = (function () {
    'use strict';

    let scene, camera, renderer, clock, animationId;
    let dnaGroup, dnaMesh, starsMesh, cellsMesh, glowMesh;
    let mouseLight, rimLight;
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

    // Cellules
    const cellData = [];
    const _m4 = new THREE.Matrix4();
    const _pos = new THREE.Vector3();
    const _quat = new THREE.Quaternion();
    const _scale = new THREE.Vector3();
    const _euler = new THREE.Euler();

    let isMobile = false;
    let reducedMotion = false;
    let paused = false;

    const defaultOptions = {
        type: 'dna',
        particleCount: 700,
        dnaCount: 750,        // Plus aéré et délicat
        cellCount: 16,
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

        scene = new THREE.Scene();
        // Pas de fog opaque pour ne pas noircir l'image de fond de l'hôpital

        camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.set(0, 0, 12);

        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true, // Transparent pour voir FondAccueil.webp
            powerPreference: 'high-performance'
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000, 0); // Fond 100% transparent
        container.appendChild(renderer.domElement);

        clock = new THREE.Clock();
        raycaster = new THREE.Raycaster();
        mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

        createLights();
        createStars();
        createCells();
        if (options.type === 'dna') createDNAHelix();
        if (options.enableGlow) createAmbientGlow();

        if (options.enableMouse && !reducedMotion) initMouseInteraction();

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
        scene.add(new THREE.AmbientLight(0x2a3560, 0.5));

        mouseLight = new THREE.PointLight(options.colorA, 18, 25, 2);
        mouseLight.position.set(0, 0, 4);
        scene.add(mouseLight);

        rimLight = new THREE.PointLight(options.colorB, 15, 30, 2);
        rimLight.position.set(-6, 5, -3);
        scene.add(rimLight);

        // Lumière directionnelle chaude pour révéler les reflets biconcaves des globules rouges
        const sunLight = new THREE.DirectionalLight(0xffeded, 1.2);
        sunLight.position.set(5, 7, 6);
        scene.add(sunLight);
    }

    // ── Particules / Poussières fines ───────────────────────────────────
    function createStars() {
        const n = options.particleCount;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(n * 3);
        const col = new Float32Array(n * 3);
        const size = new Float32Array(n);
        const phase = new Float32Array(n);
        const depth = new Float32Array(n);

        const cA = new THREE.Color(options.colorA);
        const cB = new THREE.Color(options.colorB);
        const cW = new THREE.Color(0xffffff);
        const tmp = new THREE.Color();

        for (let i = 0; i < n; i++) {
            const i3 = i * 3;
            pos[i3] = (Math.random() - 0.5) * 50;
            pos[i3 + 1] = (Math.random() - 0.5) * 34;
            pos[i3 + 2] = -Math.random() * 32 - 1;
            depth[i] = 1 - (-pos[i3 + 2] / 35);

            const r = Math.random();
            tmp.copy(r < 0.5 ? cA : r < 0.85 ? cB : cW).lerp(cW, 0.25);
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
                uBoost: { value: 0 }
            },
            vertexShader: /* glsl */`
                uniform float uTime;
                uniform vec2 uMouse;
                uniform float uPixelRatio;
                uniform float uBoost;
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
                    p.z += uBoost * aDepth * 12.0;
                    vec4 mv = modelViewMatrix * vec4(p, 1.0);
                    vTwinkle = 0.5 + 0.5 * sin(uTime * (0.8 + aDepth * 2.0) + aPhase * 5.0);
                    gl_PointSize = aSize * uPixelRatio * (12.0 / -mv.z) * (1.0 + uBoost * 0.6);
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

        // Profil en coupe biconcave exact d'un globule rouge (courbe d'Evans-Fung)
        const points = [];
        const N = 20;
        const R = 0.42; // Rayon

        // Moitié inférieure (du centre vers le bord)
        for (let i = 0; i <= N; i++) {
            const x = i / N;
            const r = x * R;
            const h = 0.14 * Math.sqrt(Math.max(0, 1.001 - x * x)) * (0.28 + 1.8 * x * x - 1.08 * x * x * x * x);
            points.push(new THREE.Vector2(Math.max(0, r), -h));
        }
        // Moitié supérieure (du bord vers le centre)
        for (let i = N; i >= 0; i--) {
            const x = i / N;
            const r = x * R;
            const h = 0.14 * Math.sqrt(Math.max(0, 1.001 - x * x)) * (0.28 + 1.8 * x * x - 1.08 * x * x * x * x);
            points.push(new THREE.Vector2(Math.max(0, r), h));
        }

        const geo = new THREE.LatheGeometry(points, 28);
        geo.computeVertexNormals();

        // Matériau rouge rubis biologique avec lueur interne sanguine
        const mat = new THREE.MeshStandardMaterial({
            color: 0xd63031,             // Rouge sang éclatant
            roughness: 0.28,             // Surface lisse et organique
            metalness: 0.05,
            emissive: 0x6e0808,          // Lueur rouge pour ne jamais paraître noir
            emissiveIntensity: 0.45,
            transparent: true,
            opacity: 0.92
        });

        cellsMesh = new THREE.InstancedMesh(geo, mat, n);
        cellsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        // Palette de rouges sanguins riches
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
                    (Math.random() - 0.5) * 24,
                    (Math.random() - 0.5) * 16,
                    -Math.random() * 10 - 2
                ),
                phase: Math.random() * Math.PI * 2,
                speed: 0.2 + Math.random() * 0.35,
                scale: 0.55 + Math.random() * 0.5, // Taille bien visible
                rot: new THREE.Vector3(
                    0.5 + Math.random() * 0.8,
                    0.5 + Math.random() * 0.8,
                    0.3 + Math.random() * 0.6
                )
            });

            // Couleur rouge sang avec légère nuance naturelle
            const shade = redShades[i % redShades.length];
            cellsMesh.setColorAt(i, shade);
        }

        cellsMesh.instanceColor.needsUpdate = true;
        scene.add(cellsMesh);
    }

    // ── Hélice ADN fine, aérée et délicate ──────────────────────────────
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
                uWarp: { value: 0 }
            },
            vertexShader: /* glsl */`
                uniform float uTime;
                uniform vec3 uMouse;
                uniform float uMouseStrength;
                uniform float uPixelRatio;
                uniform float uWarp;
                attribute float aScale;
                attribute float aPhase;
                varying vec3 vColor;
                varying float vGlow;

                void main() {
                    vColor = color;
                    vec3 p = position;
                    p.xz *= 1.0 + sin(uTime * 0.7 + position.y * 0.4) * 0.035;
                    vec4 world = modelMatrix * vec4(p, 1.0);
                    vec3 toMouse = world.xyz - uMouse;
                    float d = length(toMouse.xy);
                    float force = smoothstep(3.5, 0.0, d) * uMouseStrength;
                    world.xyz += normalize(toMouse + vec3(0.0, 0.0, 0.001)) * force * 1.2;
                    world.xyz += normalize(world.xyz) * uWarp * 2.0;
                    vGlow = force;
                    vec4 mv = viewMatrix * world;
                    float pulse = 0.85 + 0.15 * sin(uTime * 2.4 + aPhase);
                    // Taille de point subtile et aérée (environ moitié moins grosse)
                    gl_PointSize = (7.0 * aScale * pulse + force * 6.0) * uPixelRatio * (11.0 / -mv.z);
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */`
                varying vec3 vColor;
                varying float vGlow;

                void main() {
                    float d = length(gl_PointCoord - 0.5);
                    if (d > 0.5) discard;
                    float core = smoothstep(0.5, 0.0, d);
                    float a = pow(core, 2.0) * 0.72; // Moins aveuglant, plus vaporeux
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
        // Positionnée avec élégance sur la droite, légèrement en retrait
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
                uColor1: { value: new THREE.Color(options.colorA) },
                uColor2: { value: new THREE.Color(options.colorB) }
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
                varying vec3 vPosition;
                varying vec3 vNormal;

                void main() {
                    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.5);
                    float wave = sin(vPosition.y * 0.4 + uTime * 0.6) * 0.5 + 0.5;
                    float mi = length(uMouse) * 0.2;
                    vec3 color = mix(uColor1, uColor2, wave + mi);
                    gl_FragColor = vec4(color, fresnel * 0.045 * (0.6 + mi));
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

    let handleMouseMove, handleMouseLeave, handleTouchMove;
    function initMouseInteraction() {
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

        document.addEventListener('mousemove', handleMouseMove, { passive: true });
        document.addEventListener('mouseleave', handleMouseLeave);
        document.addEventListener('touchmove', handleTouchMove, { passive: true });
    }

    function animate() {
        animationId = requestAnimationFrame(animate);
        if (paused) return;

        const t = clock.getElapsedTime();
        const motion = reducedMotion ? 0.25 : 1;

        const active = lastMouseMove && (performance.now() - lastMouseMove < 1600);
        ndc.lerp(ndcTarget, active ? 0.07 : 0.025);
        mouseStrength += ((active ? 1 : 0) - mouseStrength) * 0.05;

        raycaster.setFromCamera(ndc, camera);
        raycaster.ray.intersectPlane(mousePlane, mouseWorldTarget);
        mouseWorld.lerp(mouseWorldTarget, 0.1);

        warp += (warpTarget - warp) * 0.07;

        if (dnaGroup && dnaMesh) {
            dnaGroup.rotation.y += (0.002 + warp * 0.04) * motion;
            dnaGroup.rotation.x += (ndc.y * -0.25 + 0.2 - dnaGroup.rotation.x) * 0.04;
            dnaGroup.rotation.z += (0.35 + ndc.x * 0.2 - dnaGroup.rotation.z) * 0.04;

            const u = dnaMesh.material.uniforms;
            u.uTime.value = t * motion;
            u.uMouse.value.copy(mouseWorld);
            u.uMouseStrength.value = mouseStrength;
            u.uWarp.value = warp;
        }

        if (starsMesh) {
            const u = starsMesh.material.uniforms;
            u.uTime.value = t * motion;
            u.uMouse.value.copy(ndc);
            u.uBoost.value = warp;
            starsMesh.rotation.z = Math.sin(t * 0.025) * 0.025;
        }

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

                _euler.set(t * c.rot.x * 0.3, t * c.rot.y * 0.3, t * c.rot.z * 0.2);
                _quat.setFromEuler(_euler);
                const s = c.scale * (1 + pull * 0.25);
                _scale.set(s, s, s);
                _m4.compose(_pos, _quat, _scale);
                cellsMesh.setMatrixAt(i, _m4);
            }
            cellsMesh.instanceMatrix.needsUpdate = true;
        }

        if (mouseLight) {
            mouseLight.position.lerp(new THREE.Vector3(mouseWorld.x, mouseWorld.y, 3.5), 0.08);
            mouseLight.intensity = 16 + mouseStrength * 20 + Math.sin(t * 2) * 2;
        }

        if (glowMesh) {
            glowMesh.material.uniforms.uTime.value = t;
            glowMesh.material.uniforms.uMouse.value.copy(ndc);
            glowMesh.rotation.y = ndc.x * 0.2;
            glowMesh.rotation.x = -ndc.y * 0.15;
        }

        const fy = Math.sin(t * 0.4) * 0.2 * motion;
        const fx = Math.cos(t * 0.25) * 0.15 * motion;
        camera.position.x += (fx + ndc.x * 1.2 - camera.position.x) * 0.03;
        camera.position.y += (fy + ndc.y * 0.7 - camera.position.y) * 0.03;
        camera.position.z += (12 - warp * 6.0 - camera.position.z) * 0.08;
        camera.lookAt(0, 0, 0);

        // Rendu direct fluide, 100% transparent
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

    function destroy() {
        if (animationId) cancelAnimationFrame(animationId);
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('visibilitychange', handleVisibility);

        if (handleMouseMove) document.removeEventListener('mousemove', handleMouseMove);
        if (handleMouseLeave) document.removeEventListener('mouseleave', handleMouseLeave);
        if (handleTouchMove) document.removeEventListener('touchmove', handleTouchMove);

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
        handleMouseMove = handleMouseLeave = handleTouchMove = null;
        cellData.length = 0;
        window._dnaGroup = null;
    }

    return { init, destroy, warp: warpOut };
})();

window.ThreeBackground = ThreeBackground;

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('canvas-container')) return;
    const path = window.location.pathname;
    const type = (path.includes('profile') || path.includes('login')) ? 'particles' : 'dna';
    ThreeBackground.init('canvas-container', { type });
});

export default ThreeBackground;
