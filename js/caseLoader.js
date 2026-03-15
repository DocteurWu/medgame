/**
 * js/caseLoader.js — Chargement des cas cliniques
 * Phase 8 du refactoring : extrait de game.js
 *
 * Charge les cas depuis Supabase, localStorage, ou fichiers JSON locaux.
 * Optimisé avec cache mémoire et localStorage TTL.
 */

const caseLoaderCache = {
    memory: new Map(),
    localStorageKey: 'medgame_case_cache',
    ttl: 10 * 60 * 1000,

    get(key) {
        const cached = this.memory.get(key);
        if (cached && Date.now() - cached.timestamp < this.ttl) {
            return cached.data;
        }
        this.memory.delete(key);
        return null;
    },

    set(key, data) {
        this.memory.set(key, { data, timestamp: Date.now() });
        this.saveToLocalStorage(key, data);
    },

    saveToLocalStorage(key, data) {
        try {
            const storage = JSON.parse(localStorage.getItem(this.localStorageKey) || '{}');
            storage[key] = { data, timestamp: Date.now() };
            Object.keys(storage).forEach(k => {
                if (Date.now() - storage[k].timestamp > this.ttl) delete storage[k];
            });
            localStorage.setItem(this.localStorageKey, JSON.stringify(storage));
        } catch (e) { console.warn('Cache localStorage failed', e); }
    },

    getFromLocalStorage(key) {
        try {
            const storage = JSON.parse(localStorage.getItem(this.localStorageKey) || '{}');
            const cached = storage[key];
            if (cached && Date.now() - cached.timestamp < this.ttl) {
                this.memory.set(key, cached);
                return cached.data;
            }
        } catch (e) {}
        return null;
    }
};

function lazyLoadCase(file) {
    const cacheKey = `case_${file}`;
    const cached = caseLoaderCache.get(cacheKey) || caseLoaderCache.getFromLocalStorage(cacheKey);
    if (cached) return Promise.resolve(cached);

    return fetch(`data/${file}`)
        .then(res => {
            if (!res.ok) throw new Error(`Fichier ${file} introuvable`);
            return res.json();
        })
        .then(data => {
            caseLoaderCache.set(cacheKey, data);
            return data;
        });
}

async function loadCasesMetadata() {
    const cacheKey = 'case_index';
    const cached = caseLoaderCache.get(cacheKey) || caseLoaderCache.getFromLocalStorage(cacheKey);
    if (cached) return cached;

    const response = await fetch('data/case-index.json');
    if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
    const data = await response.json();
    caseLoaderCache.set(cacheKey, data);
    return data;
}

/**
 * Charge les cas cliniques depuis Supabase, localStorage ou fichiers JSON locaux.
 * Gère le mode preview, la sélection par thèmes, et le fallback local.
 *
 * @async
 * @returns {Promise<Array<Object>>} Liste des cas cliniques chargés
 */
async function loadCasesData() {
    try {
        // Preview Mode check
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('preview') === 'true') {
            const previewData = sessionStorage.getItem('previewCase');
            if (previewData) {
                const backBtn = document.createElement('button');
                backBtn.innerHTML = '<i class="fas fa-edit"></i> Quitter l\'aperçu / Modifier';
                backBtn.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1000;
                    background: #a020f0;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 30px;
                    font-family: inherit;
                    font-weight: bold;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    transition: all 0.3s;
                `;
                backBtn.onmouseover = () => backBtn.style.transform = 'scale(1.05)';
                backBtn.onmouseout = () => backBtn.style.transform = 'scale(1)';
                backBtn.onclick = () => window.location.href = 'editor.html';
                document.body.appendChild(backBtn);

                return [JSON.parse(previewData)];
            }
        }

        // 1. SUPABASE FETCH (If applicable)
        if (typeof supabase !== 'undefined') {
            const selectedCaseFiles = JSON.parse(localStorage.getItem('selectedCaseFiles'));
            if (selectedCaseFiles && Array.isArray(selectedCaseFiles) && selectedCaseFiles.length > 0) {
                try {
                    const { data, error } = await supabase
                        .from('cases')
                        .select('*')
                        .in('id', selectedCaseFiles);

                    if (!error && data && data.length > 0) {
                        const processed = data.map(c => {
                            const content = c.content;
                            if (!content.id) content.id = c.id;
                            return content;
                        });
                        localStorage.removeItem('selectedCaseFiles');
                        return processed;
                    }
                } catch (err) {
                    console.warn("Supabase fetch failed, falling back to local files", err);
                }
            }
        }

        // Fallback local: multiple cases (with cache)
        const selectedCaseFilesLocal = JSON.parse(localStorage.getItem('selectedCaseFiles'));
        if (selectedCaseFilesLocal && Array.isArray(selectedCaseFilesLocal) && selectedCaseFilesLocal.length > 0) {
            const results = await Promise.all(selectedCaseFilesLocal.map(lazyLoadCase));
            localStorage.removeItem('selectedCaseFiles');
            return results;
        }

        // Single case (with cache)
        const selectedCaseFile = localStorage.getItem('selectedCaseFile');
        if (selectedCaseFile) {
            const caseData = await lazyLoadCase(selectedCaseFile);
            localStorage.removeItem('selectedCaseFile');
            return [caseData];
        }

        // Themes fallback
        const selectedThemes = JSON.parse(localStorage.getItem('selectedThemes')) || [];
        if (selectedThemes.length === 0) {
            throw new Error('Aucun thème sélectionné');
        }

        const caseIndex = await loadCasesMetadata();

        let caseFiles = [];
        selectedThemes.forEach(theme => {
            const themeLower = theme.toLowerCase();
            if (caseIndex[themeLower]) {
                caseFiles = caseFiles.concat(caseIndex[themeLower]);
            }
        });

        if (caseFiles.length === 0) {
            throw new Error('Aucun cas disponible pour les thèmes sélectionnés');
        }

        const results = await Promise.allSettled(caseFiles.map(lazyLoadCase));
        const cases = results
            .filter(r => r.status === 'fulfilled' && r.value !== null)
            .map(r => r.value);

        if (cases.length < caseFiles.length) {
            console.warn(`${caseFiles.length - cases.length} cas n'ont pas pu être chargés`);
        }

        if (cases.length === 0) {
            throw new Error('Aucun cas disponible');
        }

        return cases;
    } catch (error) {
        console.error('Erreur lors du chargement des cas :', error);
        showNotification('Erreur lors du chargement des cas cliniques : ' + error.message);
        return [];
    }
}
