/**
 * js/three-tablet.js
 * Gestion de la tablette médicale tactile en mode 3D
 * Ouvre la pop-up de clôture et d'annonce clinique (diagnostic + message patient)
 */

export function openTablet() {
    // 1. Libérer le pointeur souris en cas de mode FPS
    if (document.pointerLockElement) {
        try {
            document.exitPointerLock();
        } catch (_) {}
    }

    // 2. Feedback sonore si disponible
    if (window.MedGameAudio && typeof window.MedGameAudio.play === 'function') {
        window.MedGameAudio.play('click');
    }

    // 3. Ouvrir la pop-up d'annonce et de décision ECOS
    if (window.EcosMode && typeof window.EcosMode.openAnnounce === 'function') {
        window.EcosMode.openAnnounce();
    } else if (typeof window.enterAnnouncePhase === 'function') {
        window.enterAnnouncePhase();
    } else {
        // Fallback secours : validation standard
        const validateBtn = document.getElementById('validate-traitement');
        if (validateBtn) validateBtn.click();
    }
}

export function closeTablet() {
    const overlay = document.getElementById('ecos-announce-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Rétrocompatibilité et exposition globale
export function openPrescriptionTablet() {
    openTablet();
}

window.openTablet = openTablet;
window.closeTablet = closeTablet;
window.openPrescriptionTablet = openTablet;
