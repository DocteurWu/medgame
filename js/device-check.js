/**
 * Device Check - Injects a warning overlay for small screens.
 * This script runs on load and adds the overlay HTML to the DOM.
 */
(function () {
    'use strict';

    // Create the overlay HTML
    const overlayHTML = `
        <div id="device-warning-overlay">
            <i class="fas fa-desktop device-warning-icon"></i>
            <h1 class="device-warning-title">Expérience Optimisée sur PC</h1>
            <p class="device-warning-message">
                Ce jeu de simulation médicale est conçu pour être joué sur un écran plus grand.
                Veuillez utiliser un ordinateur ou une tablette en mode paysage pour une expérience optimale.
            </p>
            <div class="device-warning-hint">
                <i class="fas fa-mobile-alt"></i>
                <span>Tournez votre appareil ou passez sur PC</span>
            </div>
        </div>
    `;

    // Inject the overlay into the body when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            document.body.insertAdjacentHTML('beforeend', overlayHTML);
        });
    } else {
        // DOM is already loaded
        document.body.insertAdjacentHTML('beforeend', overlayHTML);
    }
})();
