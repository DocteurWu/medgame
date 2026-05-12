export function openPrescriptionTablet() {
    if (window.prescriptionManager) window.prescriptionManager.open();
}

// Make available globally for three-manager.js
window.openPrescriptionTablet = openPrescriptionTablet;

