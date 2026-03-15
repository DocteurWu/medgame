/**
 * Three.js Background Module - MedGame
 * Module partagé pour les animations de fond 3D
 * 
 * Usage:
 *   ThreeBackground.init('canvas-container', { type: 'dna' });
 *   ThreeBackground.destroy();
 */

const ThreeBackground = (function() {
    'use strict';
    
    let scene, camera, renderer, animationId;
    let dnaMesh, bgMesh;
    let mouseX = 0, mouseY = 0;
    let clock;
    
    const defaultOptions = {
        type: 'dna',           // 'dna' | 'particles'
        fogColor: 0x050714,
        fogDensity: 0.03,
        particleCount: 800,
        dnaCount: 1500,
        enableMouse: true
    };
    
    let options = {};
    
    /**
     * Initialiser le background 3D
     * @param {string} containerId - ID du container DOM
     * @param {Object} userOptions - Options personnalisées
     */
    function init(containerId, userOptions = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn('ThreeBackground: Container not found:', containerId);
            return;
        }
        
        // Fusionner les options
        options = { ...defaultOptions, ...userOptions };
        
        // Initialiser Three.js
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(options.fogColor, options.fogDensity);
        
        camera = new THREE.PerspectiveCamera(
            60, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
        
        renderer = new THREE.WebGLRenderer({ 
            alpha: true, 
            antialias: true, 
            powerPreference: "high-performance" 
        });
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);
        
        clock = new THREE.Clock();
        
        // Créer les éléments selon le type
        if (options.type === 'dna') {
            createDNAHelix();
        }
        createBackgroundParticles();
        
        // Gestion souris
        if (options.enableMouse) {
            initMouseInteraction();
        }
        
        // Placement caméra
        camera.position.z = 12;
        
        // Démarrer l'animation
        animate();
        
        // Gestion du resize
        window.addEventListener('resize', handleResize);
        
    }
    
    /**
     * Créer les particules de fond
     */
    function createBackgroundParticles() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(options.particleCount * 3);
        const colors = new Float32Array(options.particleCount * 3);
        
        for (let i = 0; i < options.particleCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 40;
            positions[i + 1] = (Math.random() - 0.5) * 40;
            positions[i + 2] = (Math.random() - 0.5) * 30 - 10;
            
            colors[i] = Math.random() * 0.2;
            colors[i + 1] = Math.random() * 0.5 + 0.2;
            colors[i + 2] = Math.random() * 0.8 + 0.2;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const textureLoader = new THREE.TextureLoader();
        const particleTexture = textureLoader.load('https://threejs.org/examples/textures/sprites/disc.png');
        
        const material = new THREE.PointsMaterial({
            size: 0.08,
            map: particleTexture,
            transparent: true,
            opacity: 0.4,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        bgMesh = new THREE.Points(geometry, material);
        scene.add(bgMesh);
    }
    
    /**
     * Créer l'hélice ADN
     */
    function createDNAHelix() {
        const dnaGroup = new THREE.Group();
        const geometry = new THREE.BufferGeometry();
        
        const positions = new Float32Array(options.dnaCount * 3);
        const colors = new Float32Array(options.dnaCount * 3);
        const scales = new Float32Array(options.dnaCount);
        
        const radius = 2.5;
        const verticalSpacing = 0.025;
        const twistSpeed = 0.15;
        
        for (let i = 0; i < options.dnaCount; i++) {
            const i3 = i * 3;
            const progress = i / options.dnaCount;
            const rise = (i * verticalSpacing) - ((options.dnaCount * verticalSpacing) / 2);
            const angle = i * twistSpeed;
            
            const type = i % 3;
            let x, z, r, g, b;
            
            if (type === 0 || type === 1) {
                const offsetAngle = type === 0 ? 0 : Math.PI;
                x = Math.cos(angle + offsetAngle) * radius;
                z = Math.sin(angle + offsetAngle) * radius;
                
                x += (Math.random() - 0.5) * 0.3;
                z += (Math.random() - 0.5) * 0.3;
                
                if (type === 0) {
                    r = 0.0; g = 0.95; b = 1.0; // Cyan
                } else {
                    r = 0.7; g = 0.53; b = 1.0; // Violet
                }
                scales[i] = Math.random() * 0.5 + 0.5;
                
            } else {
                const linkPos = (Math.random() * 2) - 1;
                x = Math.cos(angle) * (radius * linkPos);
                z = Math.sin(angle) * (radius * linkPos);
                x += (Math.random() - 0.5) * 0.1;
                z += (Math.random() - 0.5) * 0.1;
                
                r = 0.6; g = 0.8; b = 1.0;
                scales[i] = Math.random() * 0.2 + 0.1;
            }
            
            positions[i3] = x;
            positions[i3 + 1] = rise;
            positions[i3 + 2] = z;
            
            colors[i3] = r;
            colors[i3 + 1] = g;
            colors[i3 + 2] = b;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
        
        const textureLoader = new THREE.TextureLoader();
        const particleTexture = textureLoader.load('https://threejs.org/examples/textures/sprites/disc.png');
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uTexture: { value: particleTexture }
            },
            vertexShader: `
                uniform float uTime;
                attribute float aScale;
                varying vec3 vColor;
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    float pulse = sin(position.y * 2.0 + uTime * 3.0) * 0.2 + 0.8;
                    gl_PointSize = 15.0 * aScale * pulse * (10.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D uTexture;
                varying vec3 vColor;
                void main() {
                    vec4 texColor = texture2D(uTexture, gl_PointCoord);
                    gl_FragColor = vec4(vColor, 1.0) * texColor;
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexColors: true
        });
        
        dnaMesh = new THREE.Points(geometry, material);
        dnaGroup.add(dnaMesh);
        
        dnaGroup.rotation.z = 0.2;
        dnaGroup.rotation.x = 0.1;
        scene.add(dnaGroup);
        
        // Stocker pour animation
        window._dnaGroup = dnaGroup;
    }
    
    /**
     * Initialiser l'interaction souris
     */
    function initMouseInteraction() {
        const windowHalfX = window.innerWidth / 2;
        const windowHalfY = window.innerHeight / 2;
        
        document.addEventListener('mousemove', (event) => {
            mouseX = (event.clientX - windowHalfX) * 0.001;
            mouseY = (event.clientY - windowHalfY) * 0.001;
        });
    }
    
    /**
     * Boucle d'animation
     */
    function animate() {
        animationId = requestAnimationFrame(animate);
        
        const elapsedTime = clock.getElapsedTime();
        
        // Rotation automatique
        if (window._dnaGroup) {
            window._dnaGroup.rotation.y += 0.002;
            
            // Interaction souris avec inertie
            window._dnaGroup.rotation.x += (mouseY * 0.5 - window._dnaGroup.rotation.x) * 0.05;
            window._dnaGroup.rotation.z = 0.2 + (mouseX * 0.3);
            
            // Update shader
            if (window._dnaGroup.children[0] && window._dnaGroup.children[0].material.uniforms) {
                window._dnaGroup.children[0].material.uniforms.uTime.value = elapsedTime;
            }
        }
        
        // Rotation des particules
        if (bgMesh) {
            bgMesh.rotation.y = elapsedTime * 0.05;
            bgMesh.rotation.x = elapsedTime * 0.02;
        }
        
        // Mouvement caméra flottant
        camera.position.y = Math.sin(elapsedTime * 0.5) * 0.5;
        camera.position.x += (mouseX * 5 - camera.position.x) * 0.02;
        
        renderer.render(scene, camera);
    }
    
    /**
     * Gestion du redimensionnement
     */
    function handleResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    /**
     * Détruire le contexte 3D
     */
    function destroy() {
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        
        window.removeEventListener('resize', handleResize);
        
        if (renderer) {
            renderer.dispose();
            renderer.forceContextLoss();
        }
        
        scene = null;
        camera = null;
        renderer = null;
        dnaMesh = null;
        bgMesh = null;
        
    }
    
    // API publique
    return {
        init: init,
        destroy: destroy
    };
})();

// Auto-initialisation si un container existe
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('canvas-container')) {
        // Détection du type selon la page
        const path = window.location.pathname;
        let type = 'dna';
        
        if (path.includes('profile') || path.includes('login')) {
            type = 'particles';
        }
        
        ThreeBackground.init('canvas-container', { type: type });
    }
});
