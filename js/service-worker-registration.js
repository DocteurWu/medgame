/**
 * Service Worker Registration - MedGame
 * 
 * À inclure dans toutes les pages HTML
 * Gère l'enregistrement et la mise à jour silencieuse du Service Worker
 */

(function() {
    'use strict';
    
    if (!('serviceWorker' in navigator)) {
        console.log('SW: Service Workers non supportés');
        return;
    }
    
    // Enregistrer le Service Worker
    navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
            console.log('SW: Enregistré avec succès:', registration.scope);
            
            // Vérifier les mises à jour silencieusement
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // Nouvelle version disponible
                        console.log('SW: Nouvelle version disponible');
                    }
                });
            });
        })
        .catch((error) => {
            console.warn('SW: Échec enregistrement:', error);
        });
    
    // Écouter les messages du Service Worker
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
            // Notification optionnelle - décommenter si wanted
            // showUpdateNotification(event.data.message);
        }
    });
})();
