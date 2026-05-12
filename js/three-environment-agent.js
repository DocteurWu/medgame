/**
 * three-environment-agent.js — Agent d'environnement 3D
 * Gère les textures, décors, et éléments d'ambiance de la salle
 */

import * as THREE from 'three';

export class ThreeEnvironmentAgent {
    constructor(scene) {
        this.scene = scene;
        this.textures = new Map();
    }

    /**
     * Améliore la salle avec des textures procédurales et des détails
     */
    enhanceRoom() {
        this._addWallTextures();
        this._addFloorDetail();
        this._addWindowEffect();
        this._addMedicalPosters();
        this._addCurtain();
    }

    _addWallTextures() {
        // Les murs sont déjà créés par buildRoom
        // On ajoute des détails procéduraux
        const walls = this.scene.children.filter(
            c => c.name && c.name.includes('Mur')
        );

        walls.forEach(wall => {
            if (wall.material) {
                wall.material.roughness = 0.8;
                wall.material.bumpScale = 0.02;

                // Créer un bump map procédural pour les murs
                wall.material.bumpMap = this._createNoiseTexture(256, 256, 0.3);
                wall.material.needsUpdate = true;
            }
        });
    }

    _addFloorDetail() {
        const floor = this.scene.children.find(c => c.name === 'Sol');
        if (floor && floor.material) {
            floor.material.roughness = 0.9;
            floor.material.bumpScale = 0.01;
            floor.material.bumpMap = this._createTilePattern(512, 512);
            floor.material.needsUpdate = true;
        }
    }

    _addWindowEffect() {
        const windowMesh = this.scene.children.find(c => c.name === 'Fenetre');
        if (windowMesh) {
            // Rendre la fenêtre semi-transparente avec un léger glow
            windowMesh.material.transparent = true;
            windowMesh.material.opacity = 0.6;
            windowMesh.material.emissiveIntensity = 0.1;

            // Ajouter un voile lumineux
            const veilGeom = new THREE.PlaneGeometry(0.6, 0.6);
            const veilMat = new THREE.MeshBasicMaterial({
                color: 0x88ccff,
                transparent: true,
                opacity: 0.08,
                side: THREE.DoubleSide
            });
            const veil = new THREE.Mesh(veilGeom, veilMat);
            veil.position.copy(windowMesh.position);
            veil.position.z += 0.01;
            this.scene.add(veil);
        }
    }

    _addMedicalPosters() {
        // Tableau d'affichage médical sur le mur gauche
        const posterGeom = new THREE.PlaneGeometry(0.6, 0.8);

        // Créer un poster avec un dégradé (simule du contenu imprimé)
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 341;
        const ctx = canvas.getContext('2d');

        // Fond
        ctx.fillStyle = '#f5f5f0';
        ctx.fillRect(0, 0, 256, 341);

        // Titre
        ctx.fillStyle = '#1a1a2e';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('PROTOCOLE ECMO', 20, 30);

        // Lignes de texte simulé
        ctx.fillStyle = '#555';
        ctx.font = '8px sans-serif';
        const lines = [
            '1. Cannulation veineuse...',
            '2. Débit initial: 3L/min...',
            '3. Monitorage SpO2 continu...',
            '4. Sédation protocol...'
        ];
        lines.forEach((line, i) => {
            ctx.fillText(line, 20, 60 + i * 25);
        });

        // Bordure
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2;
        ctx.strokeRect(5, 5, 246, 331);

        const posterTexture = new THREE.CanvasTexture(canvas);
        const posterMat = new THREE.MeshStandardMaterial({
            map: posterTexture,
            roughness: 0.8
        });

        const poster = new THREE.Mesh(posterGeom, posterMat);
        poster.position.set(-4.85, 1.5, 0.5);
        poster.rotation.y = Math.PI / 2;
        poster.name = 'MedicalPoster';
        poster.userData.label = 'Affiche médicale';
        poster.userData.interactive = true;
        this.scene.add(poster);

        // Cadre
        const frameGeom = new THREE.BoxGeometry(0.62, 0.82, 0.01);
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x8a7e6e, roughness: 0.5, metalness: 0.3 });
        const frame = new THREE.Mesh(frameGeom, frameMat);
        frame.position.copy(poster.position);
        frame.position.z -= 0.005;
        this.scene.add(frame);

        // Deuxième poster (schéma anatomique)
        const poster2Geom = new THREE.PlaneGeometry(0.5, 0.5);
        const canvas2 = document.createElement('canvas');
        canvas2.width = 256;
        canvas2.height = 256;
        const ctx2 = canvas2.getContext('2d');
        ctx2.fillStyle = '#fff8f0';
        ctx2.fillRect(0, 0, 256, 256);
        ctx2.strokeStyle = '#cc0000';
        ctx2.lineWidth = 2;
        // Cœur simplifié
        ctx2.beginPath();
        ctx2.arc(128, 110, 30, 0, Math.PI * 2);
        ctx2.stroke();
        ctx2.beginPath();
        ctx2.moveTo(128, 140);
        ctx2.lineTo(128, 200);
        ctx2.stroke();
        ctx2.font = '10px sans-serif';
        ctx2.fillStyle = '#333';
        ctx2.fillText('CŒUR', 108, 85);
        const poster2Tex = new THREE.CanvasTexture(canvas2);
        const poster2Mat = new THREE.MeshStandardMaterial({ map: poster2Tex, roughness: 0.8 });
        const poster2 = new THREE.Mesh(poster2Geom, poster2Mat);
        poster2.position.set(-4.85, 1.5, -0.8);
        poster2.rotation.y = Math.PI / 2;
        this.scene.add(poster2);
    }

    _addCurtain() {
        // Rideau de séparation (optionnel, décoratif)
        const curtainGeom = new THREE.PlaneGeometry(1.2, 2.5);
        const curtainCanvas = document.createElement('canvas');
        curtainCanvas.width = 128;
        curtainCanvas.height = 256;
        const cctx = curtainCanvas.getContext('2d');
        const gradient = cctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, '#2a3a5a');
        gradient.addColorStop(1, '#1a2a4a');
        cctx.fillStyle = gradient;
        cctx.fillRect(0, 0, 128, 256);
        // Lignes verticales pour texture tissu
        cctx.strokeStyle = 'rgba(255,255,255,0.05)';
        for (let i = 0; i < 128; i += 4) {
            cctx.beginPath();
            cctx.moveTo(i, 0);
            cctx.lineTo(i, 256);
            cctx.stroke();
        }
        const curtainTex = new THREE.CanvasTexture(curtainCanvas);
        const curtainMat = new THREE.MeshStandardMaterial({
            map: curtainTex,
            roughness: 0.9,
            side: THREE.DoubleSide
        });
        const curtain = new THREE.Mesh(curtainGeom, curtainMat);
        curtain.position.set(0, 1.25, -3.98);
        curtain.name = 'Curtain';
        curtain.userData.label = 'Rideau';
        curtain.userData.interactive = true;
        this.scene.add(curtain);
    }

    _createNoiseTexture(width, height, intensity) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);
        for (let i = 0; i < imageData.data.length; i += 4) {
            const val = Math.random() * 255 * intensity;
            imageData.data[i] = val;
            imageData.data[i + 1] = val;
            imageData.data[i + 2] = val;
            imageData.data[i + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);
        return new THREE.CanvasTexture(canvas);
    }

    _createTilePattern(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#c8c0b0';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        const tileSize = 32;
        for (let x = 0; x < width; x += tileSize) {
            for (let y = 0; y < height; y += tileSize) {
                ctx.strokeRect(x, y, tileSize, tileSize);
            }
        }
        return new THREE.CanvasTexture(canvas);
    }
}