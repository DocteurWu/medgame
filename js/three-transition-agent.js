import * as THREE from 'three';

/**
 * three-transition-agent.js — Agent de transitions 2D ↔ 3D
 * Gère les animations fluides de passage entre les modes
 */

export class ThreeTransitionAgent {
    constructor(threeManager) {
        this.manager = threeManager;
        this.isTransitioning = false;
    }

    /**
     * Transition de 2D vers 3D
     */
    async transitionTo3D() {
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        const appContainer = document.querySelector('.app-container');
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');
        const threeOverlay = document.getElementById('three-overlay');
        const sceneContainer = document.getElementById('scene-container');

        // 1. Fade out le contenu 2D
        if (mainContent) {
            mainContent.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            mainContent.style.opacity = '0';
            mainContent.style.transform = 'scale(0.95)';
        }

        // 2. Réduire la sidebar
        if (sidebar) {
            sidebar.style.transition = 'width 0.5s ease, opacity 0.5s ease, padding 0.5s ease';
            sidebar.style.width = '0';
            sidebar.style.minWidth = '0';
            sidebar.style.padding = '0';
            sidebar.style.opacity = '0';
            sidebar.style.overflow = 'hidden';
            sidebar.style.borderRight = 'none';
        }

        // 3. Cacher le toggle pour éviter les clics pendant la transition
        const toggle = document.getElementById('sidebar-toggle');
        if (toggle) toggle.style.opacity = '0';

        await new Promise(r => setTimeout(r, 400));

        // 4. Afficher le container 3D avec un fade in
        if (sceneContainer) {
            sceneContainer.style.opacity = '0';
            sceneContainer.style.transition = 'opacity 0.8s ease';
            sceneContainer.style.display = 'block';
            sceneContainer.style.position = 'fixed';
            sceneContainer.style.top = '0';
            sceneContainer.style.left = '0';
            sceneContainer.style.width = '100vw';
            sceneContainer.style.height = '100vh';
            sceneContainer.style.zIndex = '5';

            await new Promise(r => setTimeout(r, 50));
            sceneContainer.style.opacity = '1';
        }

        // 5. Afficher l'overlay HUD
        if (threeOverlay) {
            threeOverlay.style.display = 'block';
            threeOverlay.style.opacity = '0';
            threeOverlay.style.transition = 'opacity 0.5s ease 0.3s';
            requestAnimationFrame(() => {
                threeOverlay.style.opacity = '1';
            });
        }

        // 6. Appliquer les classes CSS
        document.body.classList.add('render-3d-full');
        document.body.classList.remove('render-2d');
        if (appContainer) appContainer.classList.add('mode-3d');

        // 7. Nettoyer les éléments 2D derrière
        if (mainContent) {
            mainContent.style.display = 'none';
            mainContent.style.position = 'absolute';
            mainContent.style.zIndex = '-1';
        }

        // 8. Adjust camera — presets only, no free orbit
        if (this.manager.scene) {
            this.manager.scene.setCamera('room', false);
        }

        // 9. Try fullscreen on mobile
        if (!document.fullscreenElement && window.innerWidth < 768) {
            try { await document.documentElement.requestFullscreen(); } catch (e) {}
        }

        this.isTransitioning = false;
        console.info('[TransitionAgent] Mode 3D activé');
    }

    /**
     * Transition de 3D vers 2D
     */
    async transitionTo2D() {
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        const appContainer = document.querySelector('.app-container');
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');
        const threeOverlay = document.getElementById('three-overlay');
        const sceneContainer = document.getElementById('scene-container');
        const toggle = document.getElementById('sidebar-toggle');

        // 1. Cacher l'overlay HUD
        if (threeOverlay) {
            threeOverlay.style.transition = 'opacity 0.4s ease';
            threeOverlay.style.opacity = '0';
        }

        // 2. Fade out la scène 3D
        if (sceneContainer) {
            sceneContainer.style.transition = 'opacity 0.6s ease';
            sceneContainer.style.opacity = '0';
        }

        await new Promise(r => setTimeout(r, 500));

        // 3. Cacher le container 3D
        if (sceneContainer) {
            sceneContainer.style.display = 'none';
        }

        // 4. Désactiver le plein écran
        if (document.fullscreenElement) {
            try { await document.exitFullscreen(); } catch (e) {}
        }

        // 5. Restaurer la sidebar
        if (sidebar) {
            sidebar.style.transition = 'width 0.5s ease, opacity 0.5s ease, padding 0.5s ease';
            sidebar.style.width = '';
            sidebar.style.minWidth = '';
            sidebar.style.padding = '';
            sidebar.style.opacity = '1';
            sidebar.style.overflow = '';
            sidebar.style.borderRight = '';
        }

        // Restaurer le sidebar collapsed state si besoin
        if (appContainer && appContainer.classList.contains('sidebar-collapsed')) {
            // Garder collapsed si c'était l'état avant
        }

        // 6. Restaurer le contenu 2D
        if (mainContent) {
            mainContent.style.display = '';
            mainContent.style.position = '';
            mainContent.style.zIndex = '';
            mainContent.style.opacity = '0';
            mainContent.style.transform = 'scale(0.95)';

            await new Promise(r => setTimeout(r, 50));
            mainContent.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            mainContent.style.opacity = '1';
            mainContent.style.transform = 'scale(1)';
        }

        // 7. Restaurer les classes CSS
        document.body.classList.add('render-2d');
        document.body.classList.remove('render-3d-full');
        if (appContainer) appContainer.classList.remove('mode-3d');

        // 8. Restaurer le bouton toggle
        if (toggle) {
            toggle.style.opacity = '1';
            toggle.innerHTML = '<i class="fas fa-bars"></i>';
        }

        // 9. Camera controls stay configured (presets only)

        await new Promise(r => setTimeout(r, 700));
        if (threeOverlay) threeOverlay.style.display = 'none';

        this.isTransitioning = false;
        console.info('[TransitionAgent] Mode 2D restauré');
    }

    /**
     * Basculer entre 2D et 3D
     */
    async toggle() {
        const is3D = document.body.classList.contains('render-3d-full');
        if (is3D) {
            await this.transitionTo2D();
        } else {
            await this.transitionTo3D();
        }
    }
}