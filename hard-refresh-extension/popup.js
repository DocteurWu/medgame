document.getElementById('refresh-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('status');
    statusEl.textContent = 'Purge du cache...';
    statusEl.className = 'status loading';

    try {
        // Obtenir l'onglet actif
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) {
            statusEl.textContent = 'Aucun onglet actif valide';
            statusEl.className = 'status';
            return;
        }

        const url = new URL(tab.url);
        
        // Gérer uniquement les origines HTTP/HTTPS et localhost
        if (!url.protocol.startsWith('http') && !url.protocol.startsWith('file')) {
            statusEl.textContent = 'Non applicable sur cette page';
            statusEl.className = 'status';
            return;
        }

        const origin = url.origin;

        // Vider le cache de l'origin de l'onglet actif
        // Si c'est un fichier local (file://), remove ne supporte pas les origins, 
        // donc on vide le cache global dans ce cas.
        if (url.protocol.startsWith('file')) {
            await chrome.browsingData.remove({
                since: 0
            }, {
                cache: true,
                cacheStorage: true
            });
        } else {
            await chrome.browsingData.remove({
                origins: [origin]
            }, {
                cache: true,
                cacheStorage: true
            });
        }

        statusEl.textContent = 'Rechargement de la page...';

        // Forcer le rechargement sans cache
        await chrome.tabs.reload(tab.id, { bypassCache: true });

        statusEl.textContent = '🚀 Cache vidé & Rechargé !';
        statusEl.className = 'status success';

        setTimeout(() => {
            statusEl.textContent = 'Prêt';
            statusEl.className = 'status';
        }, 2500);

    } catch (error) {
        console.error("Erreur Hard Refresh:", error);
        statusEl.textContent = 'Erreur : ' + error.message;
        statusEl.className = 'status';
    }
});
