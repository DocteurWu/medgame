/**
 * js/ecos-dialog.js
 * Dialogue de confirmation stylisé pour Medgame ECOS
 */

function ecosConfirm({ title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', danger = false }) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'ecos-confirm-overlay';
        
        overlay.innerHTML = `
            <div class="ecos-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="ecos-confirm-title">
                <div class="ecos-confirm-header">
                    <h3 id="ecos-confirm-title">${title}</h3>
                </div>
                <div class="ecos-confirm-body">
                    <p>${message}</p>
                </div>
                <div class="ecos-confirm-actions">
                    <button class="ecos-confirm-btn ecos-confirm-btn-cancel">${cancelLabel}</button>
                    <button class="ecos-confirm-btn ecos-confirm-btn-confirm ${danger ? 'danger' : ''}">${confirmLabel}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Trap focus inside confirm dialog
        const buttons = overlay.querySelectorAll('button');
        const cancelButton = buttons[0];
        const confirmButton = buttons[1];
        
        cancelButton.focus();
        
        const cleanup = (value) => {
            overlay.remove();
            resolve(value);
        };
        
        cancelButton.addEventListener('click', () => cleanup(false));
        confirmButton.addEventListener('click', () => cleanup(true));
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                cleanup(false);
            }
        });
        
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                cleanup(false);
            } else if (e.key === 'Tab') {
                e.preventDefault();
                if (document.activeElement === cancelButton) {
                    confirmButton.focus();
                } else {
                    cancelButton.focus();
                }
            }
        };
        
        overlay.addEventListener('keydown', handleKeyDown);
    });
}

window.ecosConfirm = ecosConfirm;
