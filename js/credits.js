import { CREDITS } from '../data/credits.js';

(function () {
    'use strict';

    const creditsData = CREDITS || window.CREDITS || null;

    if (!creditsData) {
        console.error('[Credits] Impossible de charger CREDITS depuis data/credits.js');
        return;
    }

    // Elements DOM
    const creatorContainer = document.getElementById('creator-container');
    const contributorsContainer = document.getElementById('contributors-container');
    const techContainer = document.getElementById('technologies-container');
    const resourcesContainer = document.getElementById('resources-container');
    const contactContainer = document.getElementById('contact-container');
    const legalNotice = document.getElementById('legal-notice');
    const rollTrack = document.getElementById('credits-roll-track');
    const rollOverlay = document.getElementById('credits-roll-overlay');
    const btnLaunchRoll = document.getElementById('btn-launch-roll');
    const btnCloseRoll = document.getElementById('btn-close-roll');
    const btnPauseRoll = document.getElementById('btn-pause-roll');
    const btnSpeedRoll = document.getElementById('btn-speed-roll');
    const attributionsModal = document.getElementById('attributions-modal');
    const btnOpenAttributions = document.getElementById('btn-open-attributions');
    const btnCloseAttributions = document.getElementById('btn-close-attributions');

    let isRolling = false;
    let isPaused = false;
    let isFastSpeed = false;
    const baseDurationSeconds = 48;

    /**
     * Rendu de la vue structuree (condensee et succincte)
     */
    function renderStructuredView() {
        // 1. Createur
        if (creatorContainer && creditsData.creator) {
            const c = creditsData.creator;
            creatorContainer.innerHTML = `
                <div class="creator-content">
                    <div class="creator-avatar-wrap" aria-hidden="true">
                        <i class="fas fa-user-md"></i>
                    </div>
                    <div class="creator-details">
                        <div class="creator-header-row">
                            <h3 class="creator-name">${escapeHtml(c.name)}</h3>
                            <span class="creator-role-tag">${escapeHtml(c.role)}</span>
                        </div>
                        <p class="creator-curriculum">${escapeHtml(c.curriculum)}</p>
                    </div>
                </div>
            `;
        }

        // 2. Contributeurs
        if (contributorsContainer && Array.isArray(creditsData.contributors)) {
            contributorsContainer.innerHTML = creditsData.contributors.map(item => `
                <div class="contrib-item">
                    <div>
                        <div class="contrib-name">${escapeHtml(item.name)}</div>
                        <div class="contrib-note">${escapeHtml(item.note)}</div>
                    </div>
                    <span class="contrib-role">${escapeHtml(item.role)}</span>
                </div>
            `).join('');
        }

        // 3. Technologies
        if (techContainer && Array.isArray(creditsData.technologies)) {
            techContainer.innerHTML = `
                <div class="chips-wrap">
                    ${creditsData.technologies.map(t => `<span class="chip-tech">${escapeHtml(t)}</span>`).join('')}
                </div>
            `;
        }

        // 4. Ressources tierces
        if (resourcesContainer && Array.isArray(creditsData.thirdParty)) {
            resourcesContainer.innerHTML = `
                <div class="resources-list-compact">
                    ${creditsData.thirdParty.map(r => `
                        <div class="res-item-compact">
                            <span class="res-name">${escapeHtml(r.name)}</span>
                            <span class="res-desc">${escapeHtml(r.desc)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // 5. Contact (retours, bugs, collab)
        if (contactContainer && creditsData.contact) {
            contactContainer.innerHTML = `
                <span class="contact-text">${escapeHtml(creditsData.contact.label)}</span>
                <a href="mailto:${escapeHtml(creditsData.contact.email)}" class="contact-email-badge">
                    <i class="fas fa-paper-plane"></i> ${escapeHtml(creditsData.contact.email)}
                </a>
            `;
        }

        // 6. Mention legale discrete en italique
        if (legalNotice && creditsData.legal) {
            legalNotice.textContent = creditsData.legal.notice;
        }
    }

    /**
     * Rendu du generique defilant
     */
    function renderRollingCreditsView() {
        if (!rollTrack) return;

        const c = creditsData.creator;
        const contribs = creditsData.contributors || [];
        const techs = creditsData.technologies || [];
        const thirdParties = creditsData.thirdParty || [];

        rollTrack.innerHTML = `
            <div class="roll-logo">
                <h1>${escapeHtml(creditsData.appName)}</h1>
                <p>Simulation Clinique Interactive</p>
            </div>

            <div class="roll-section">
                <div class="roll-section-title">Conception &amp; Développement</div>
                <div class="roll-entry">
                    <div class="roll-name">${escapeHtml(c.name)}</div>
                    <div class="roll-sub">${escapeHtml(c.role)}</div>
                    <div class="roll-note">${escapeHtml(c.curriculum)}</div>
                </div>
            </div>

            <div class="roll-section">
                <div class="roll-section-title">Remerciements &amp; Soutiens</div>
                ${contribs.map(item => `
                    <div class="roll-entry">
                        <div class="roll-name">${escapeHtml(item.name)}</div>
                        <div class="roll-sub">${escapeHtml(item.role)}</div>
                        <div class="roll-note">${escapeHtml(item.note)}</div>
                    </div>
                `).join('')}
            </div>

            <div class="roll-section">
                <div class="roll-section-title">Technologies</div>
                <div class="roll-entry">
                    <div class="roll-name" style="font-size: 1.25rem;">${techs.map(t => escapeHtml(t)).join(' &bull; ')}</div>
                </div>
            </div>

            <div class="roll-section">
                <div class="roll-section-title">Ressources &amp; Données Scientifiques</div>
                ${thirdParties.map(res => `
                    <div class="roll-entry">
                        <div class="roll-name" style="font-size: 1.15rem;">${escapeHtml(res.name)}</div>
                        <div class="roll-sub">${escapeHtml(res.desc)}</div>
                    </div>
                `).join('')}
            </div>

            <div class="roll-section">
                <div class="roll-section-title">Licence &amp; Distribution</div>
                <div class="roll-entry">
                    <div class="roll-name" style="font-size: 1.2rem;">Logiciel Libre sous licence GPL-3.0</div>
                    <div class="roll-sub">Code source disponible sur demande : ${escapeHtml(creditsData.contact.email)}</div>
                </div>
            </div>

            <div class="roll-final-card">
                <p><strong>${escapeHtml(creditsData.appName)}</strong> &bull; Version ${escapeHtml(creditsData.version)} (${escapeHtml(creditsData.year)})</p>
                <p>Simulation clinique à vocation pédagogique &bull; Ne remplace pas un avis médical.</p>
                <p style="margin-top: 10px; color: var(--primary);">Contact &amp; Collaborations : ${escapeHtml(creditsData.contact.email)}</p>
            </div>
        `;
    }

    /**
     * Controleur du generique
     */
    function startCreditsRoll() {
        if (!rollOverlay) return;
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        isRolling = true;
        isPaused = false;
        isFastSpeed = false;

        rollOverlay.classList.remove('paused');
        rollOverlay.classList.add('active');

        if (btnPauseRoll) btnPauseRoll.innerHTML = '<i class="fas fa-pause"></i> Pause';
        if (btnSpeedRoll) btnSpeedRoll.innerHTML = '<i class="fas fa-forward"></i> Vitesse 1x';

        if (prefersReducedMotion) {
            return;
        }

        const trackHeight = rollTrack.offsetHeight || 2000;
        const computedDuration = Math.max(28, Math.round(trackHeight / 50));

        rollOverlay.style.setProperty('--roll-duration', `${computedDuration}s`);
        rollOverlay.classList.add('animating');

        rollTrack.onanimationend = () => {
            setTimeout(closeCreditsRoll, 800);
        };
    }

    function closeCreditsRoll() {
        if (!rollOverlay) return;
        isRolling = false;
        isPaused = false;
        rollOverlay.classList.remove('active', 'animating', 'paused');
        if (rollTrack) rollTrack.onanimationend = null;
    }

    function togglePauseRoll() {
        if (!isRolling || !rollOverlay) return;
        isPaused = !isPaused;

        if (isPaused) {
            rollOverlay.classList.add('paused');
            if (btnPauseRoll) btnPauseRoll.innerHTML = '<i class="fas fa-play"></i> Reprendre';
        } else {
            rollOverlay.classList.remove('paused');
            if (btnPauseRoll) btnPauseRoll.innerHTML = '<i class="fas fa-pause"></i> Pause';
        }
    }

    function toggleSpeedRoll() {
        if (!isRolling || !rollOverlay) return;
        isFastSpeed = !isFastSpeed;

        const currentDuration = parseFloat(getComputedStyle(rollOverlay).getPropertyValue('--roll-duration')) || baseDurationSeconds;
        const newDuration = isFastSpeed ? Math.max(14, currentDuration / 2) : currentDuration * 2;

        rollOverlay.style.setProperty('--roll-duration', `${newDuration}s`);

        if (btnSpeedRoll) {
            btnSpeedRoll.innerHTML = isFastSpeed 
                ? '<i class="fas fa-forward"></i> Vitesse 2x' 
                : '<i class="fas fa-forward"></i> Vitesse 1x';
        }
    }

    function openAttributionsModal() {
        if (attributionsModal) attributionsModal.classList.add('active');
    }

    function closeAttributionsModal() {
        if (attributionsModal) attributionsModal.classList.remove('active');
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    window.transitionTo = function (url) {
        document.body.style.opacity = '0';
        setTimeout(() => {
            window.location.href = url;
        }, 350);
    };

    document.addEventListener('DOMContentLoaded', () => {
        renderStructuredView();
        renderRollingCreditsView();

        // Lancement direct par défaut du générique à l'ouverture (quitter affiche la page plate)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') !== 'flat') {
            startCreditsRoll();
        }

        if (btnLaunchRoll) btnLaunchRoll.addEventListener('click', startCreditsRoll);
        if (btnCloseRoll) btnCloseRoll.addEventListener('click', closeCreditsRoll);
        if (btnPauseRoll) btnPauseRoll.addEventListener('click', togglePauseRoll);
        if (btnSpeedRoll) btnSpeedRoll.addEventListener('click', toggleSpeedRoll);

        if (rollOverlay) {
            rollOverlay.addEventListener('click', (e) => {
                if (!e.target.closest('.roll-hud')) {
                    closeCreditsRoll();
                }
            });
        }

        if (btnOpenAttributions) {
            btnOpenAttributions.addEventListener('click', (e) => {
                e.preventDefault();
                openAttributionsModal();
            });
        }

        if (btnCloseAttributions) btnCloseAttributions.addEventListener('click', closeAttributionsModal);

        if (attributionsModal) {
            attributionsModal.addEventListener('click', (e) => {
                if (e.target === attributionsModal) closeAttributionsModal();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (isRolling) closeCreditsRoll();
                else if (attributionsModal && attributionsModal.classList.contains('active')) closeAttributionsModal();
            } else if (e.key === ' ' && isRolling) {
                e.preventDefault();
                togglePauseRoll();
            }
        });
    });

})();
