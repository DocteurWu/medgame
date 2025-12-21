/**
 * Device Check - Injects a warning overlay for small screens.
 * This script runs on load and adds the overlay HTML to the DOM.
 */
(function () {
    'use strict';

    // Create the overlay HTML
    // DISABLED: Mobile optimization - overlay removed
    const overlayHTML = ``;

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
