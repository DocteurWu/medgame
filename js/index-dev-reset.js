/* js/index-dev-reset.js - purge du cache en developpement local (extrait de index.html) */

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') {
            try {
                localStorage.removeItem('medgame_case_cache');
                if ('caches' in window) {
                    caches.keys().then(names => {
                        names.forEach(name => caches.delete(name));
                    });
                }
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(regs => {
                        regs.forEach(reg => reg.unregister());
                    });
                }
                console.info('[Dev Cache Buster] Case cache, service workers and Cache Storage cleared.');
            } catch (e) {
                console.warn('[Dev Cache Buster] Failed to clear dev caches:', e);
            }
        }
