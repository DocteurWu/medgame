/**
 * js/footer.js — Injection automatique et non-intrusive du lien de credits
 * 
 * Permet d'assurer la presence d'un lien discret « Credits » sur toutes les pages
 * principales sans briser la disposition responsive existante.
 */

(function () {
    'use strict';

    function initFooter() {
        if (document.getElementById('medgame-footer-injected')) {
            return;
        }

        // Si la page contient deja un lien vers les credits, ne rien injecter
        if (
            document.querySelector('a[href*="credits.html"]') ||
            document.querySelector('.medgame-footer-link')
        ) {
            return;
        }

        // Marqueur d'injection
        const marker = document.createElement('span');
        marker.id = 'medgame-footer-injected';
        marker.style.display = 'none';
        document.body.appendChild(marker);

        // 1. Page de jeu (game.html) -> Integration dans la barre laterale
        const sidebarFooter = document.querySelector('.sidebar-footer');
        if (sidebarFooter) {
            if (sidebarFooter.querySelector('a[href*="credits.html"], .medgame-footer-link')) {
                return;
            }
            const linkDiv = document.createElement('div');
            linkDiv.style.cssText = 'margin-top: 8px; text-align: center; width: 100%;';
            linkDiv.innerHTML = `
                <a href="credits.html" class="medgame-footer-link" target="_blank" rel="noopener" style="font-size: 0.72rem; color: rgba(255,255,255,0.45); text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                    <i class="fas fa-award" aria-hidden="true"></i> Crédits MedGame
                </a>
            `;
            sidebarFooter.appendChild(linkDiv);
            return;
        }

        // 2. Page d'accueil (index.html) -> Integration sous le disclaimer
        const disclaimer = document.querySelector('.glass-card .disclaimer');
        if (disclaimer) {
            if (disclaimer.parentElement && disclaimer.parentElement.querySelector('a[href*="credits.html"], .medgame-footer-link')) {
                return;
            }
            const indexLink = document.createElement('div');
            indexLink.style.cssText = 'margin-top: 6px; text-align: center;';
            indexLink.innerHTML = `
                <a href="credits.html" class="medgame-footer-link" onclick="if(typeof transitionTo==='function'){transitionTo('credits.html');return false;}else{window.location.href='credits.html';}" style="font-size: 0.75rem; color: rgba(255,255,255,0.45); text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                    <i class="fas fa-award" aria-hidden="true"></i> Crédits &amp; Mentions Légales
                </a>
            `;
            disclaimer.insertAdjacentElement('afterend', indexLink);
            return;
        }

        // 3. Page Tutoriel (tutorial.html) -> Integration dans les actions de bas de page
        const tutorialFooter = document.querySelector('.footer-actions');
        if (tutorialFooter) {
            if (document.querySelector('a[href*="credits.html"], .medgame-footer-link')) {
                return;
            }
            const tutorialLink = document.createElement('a');
            tutorialLink.href = 'credits.html';
            tutorialLink.className = 'btn-premium';
            tutorialLink.onclick = function (e) {
                e.preventDefault();
                if (typeof transitionTo === 'function') {
                    transitionTo('credits.html');
                } else {
                    window.location.href = 'credits.html';
                }
            };
            tutorialLink.innerHTML = '<i class="fas fa-award" aria-hidden="true"></i> Crédits';
            const homeLink = tutorialFooter.querySelector('a[href="index.html"]');
            if (homeLink) {
                homeLink.insertAdjacentElement('afterend', tutorialLink);
            } else {
                tutorialFooter.appendChild(tutorialLink);
            }
            return;
        }

        // 4. Page Atlas 3D (atlas.html) -> Integration dans .atlas-footer
        const atlasFooter = document.querySelector('.atlas-footer');
        if (atlasFooter) {
            const atlasLink = document.createElement('div');
            atlasLink.style.cssText = 'margin-top: 6px;';
            atlasLink.innerHTML = `
                <a href="credits.html" style="color: var(--atlas-neon, #00f2fe); text-decoration: none; font-size: 10.5px; display: inline-flex; align-items: center; gap: 4px;">
                    <i class="fas fa-award" aria-hidden="true"></i> Crédits &amp; Équipe MedGame
                </a>
            `;
            atlasFooter.appendChild(atlasLink);
            return;
        }

        // 5. Page Themes (themes.html) -> Integration dans la barre de navigation
        const themesNav = document.querySelector('.themes-nav-bar');
        if (themesNav) {
            const themesLink = document.createElement('a');
            themesLink.href = 'credits.html';
            themesLink.className = 'back-link-bottom';
            themesLink.style.marginLeft = 'auto';
            themesLink.innerHTML = '<i class="fas fa-award" aria-hidden="true"></i> Crédits';
            themesNav.appendChild(themesLink);
            return;
        }

        // 6. Page ECG Academy (ecg-trainer.html) -> Integration dans l'en-tete
        const ecgNav = document.querySelector('.ecg-navbar .nav-left');
        if (ecgNav) {
            const ecgLink = document.createElement('a');
            ecgLink.href = 'credits.html';
            ecgLink.target = '_blank';
            ecgLink.rel = 'noopener';
            ecgLink.style.cssText = 'color: rgba(255,255,255,0.6); font-size: 0.8rem; text-decoration: none; margin-left: 18px; display: inline-flex; align-items: center; gap: 5px;';
            ecgLink.innerHTML = '<i class="fas fa-award" aria-hidden="true"></i> Crédits';
            ecgNav.appendChild(ecgLink);
            return;
        }

        // 7. Page Auscultation (auscultation.html) -> Integration dans l'en-tete
        const auscultNav = document.querySelector('.app-header .header-left');
        if (auscultNav) {
            const auscultLink = document.createElement('a');
            auscultLink.href = 'credits.html';
            auscultLink.target = '_blank';
            auscultLink.rel = 'noopener';
            auscultLink.style.cssText = 'color: rgba(255,255,255,0.6); font-size: 0.8rem; text-decoration: none; margin-left: 18px; display: inline-flex; align-items: center; gap: 5px;';
            auscultLink.innerHTML = '<i class="fas fa-award" aria-hidden="true"></i> Crédits';
            auscultNav.appendChild(auscultLink);
            return;
        }

        // 8. Page Skills Hub (skills.html) -> Pied de page sobre
        const skillsMain = document.querySelector('main.skills-container');
        if (skillsMain) {
            const footer = document.createElement('footer');
            footer.style.cssText = 'text-align: center; padding: 24px 20px; color: rgba(255,255,255,0.4); font-size: 0.8rem;';
            footer.innerHTML = `
                MedGame &bull; <a href="credits.html" style="color: #00f2fe; text-decoration: none;"><i class="fas fa-award" aria-hidden="true"></i> Crédits &amp; Mentions</a> &bull; GPL-3.0
            `;
            document.body.appendChild(footer);
            return;
        }

        // 9. Fallback universel discret flottant pour les autres pages
        const floatingFooter = document.createElement('div');
        floatingFooter.className = 'medgame-floating-footer';
        floatingFooter.style.cssText = 'position: fixed; bottom: 12px; right: 16px; z-index: 900; background: rgba(10,15,30,0.7); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(8px); border-radius: 20px; padding: 4px 12px; font-size: 0.72rem;';
        floatingFooter.innerHTML = `
            <a href="credits.html" style="color: rgba(255,255,255,0.6); text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                <i class="fas fa-award" aria-hidden="true"></i> Crédits
            </a>
        `;
        document.body.appendChild(floatingFooter);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFooter);
    } else {
        initFooter();
    }
})();
