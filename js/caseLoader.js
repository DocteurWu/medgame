/**
 * js/caseLoader.js — Chargement des cas cliniques
 * Phase 8 du refactoring : extrait de game.js
 *
 * Charge les cas depuis Supabase, localStorage, ou fichiers JSON locaux.
 * Optimisé avec cache mémoire et localStorage TTL.
 */

/**
 * Ce qui a le droit d'être MIRRORÉ dans `localStorage`.
 *
 * On ne persiste plus le CORPS des cas. Les 95 fichiers de `data/` pèsent
 * 3,3 Mo au total : le miroir revenait donc à exécuter un `JSON.stringify`
 * de 3,3 Mo sur le thread principal à chaque session, puis à écrire dans le
 * `localStorage` — dont le quota est de l'ordre de 5 Mo, partagé avec le reste
 * du site. Un `setItem` qui dépasse le quota lève `QuotaExceededError`, ce qui
 * était intercepté et silencieusement perdu : on payait la chaîne complète pour
 * rien.
 *
 * Le cache HTTP du navigateur fait déjà ce travail pour les fichiers JSON, et
 * sans le payer sur le thread principal. Le miroir ne sert donc plus qu'à
 * l'index des cas : il est petit, et il change quand `npm run generate:index`
 * est relancé.
 */
const MIRROR_MAX_BYTES = 64 * 1024;

const caseLoaderCache = {
    memory: new Map(),
    localStorageKey: 'medgame_case_cache',
    ttl: 5 * 60 * 1000, // 5 minutes (enables fast memory caching during gameplay)
    _pendingSave: false,

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
        this._scheduleSaveToLocalStorage();
    },

    _scheduleSaveToLocalStorage() {
        if (this._pendingSave) return;
        this._pendingSave = true;
        // Écriture différée ET bornée : seules les petites entrées (l'index)
        // sont conservées. Le `JSON.stringify` reste donc proportionnel à
        // quelques kilo-octets, jamais à la taille des cas.
        const doSave = () => {
            this._pendingSave = false;
            try {
                const storage = {};
                let bytes = 0;
                const now = Date.now();
                for (const [k, v] of this.memory) {
                    if (now - v.timestamp >= this.ttl) continue;
                    const encoded = JSON.stringify(v.data);
                    bytes += encoded.length;
                    if (bytes > MIRROR_MAX_BYTES) break;
                    storage[k] = v;
                }
                localStorage.setItem(this.localStorageKey, JSON.stringify(storage));
            } catch (e) { console.warn('Cache localStorage failed', e); }
        };
        if ('requestIdleCallback' in window) {
            requestIdleCallback(doSave, { timeout: 3000 });
        } else {
            setTimeout(doSave, 200);
        }
    },

    getFromLocalStorage(key) {
        try {
            const raw = localStorage.getItem(this.localStorageKey);
            // Miroir écrit par une version antérieure : il peut contenir des
            // mégaoctets de corps de cas. On le purge plutôt que de le reparcourir
            // à chaque lecture.
            if (raw && raw.length > MIRROR_MAX_BYTES * 4) {
                localStorage.removeItem(this.localStorageKey);
                return null;
            }
            const storage = JSON.parse(raw || '{}');
            const cached = storage[key];
            if (cached && Date.now() - cached.timestamp < this.ttl) {
                this.memory.set(key, cached);
                return cached.data;
            }
        } catch (e) {
            // Cache corrompu ou stockage indisponible : on ignore et on recharge.
            console.warn('CaseLoader: cache localStorage illisible, rechargement réseau', e);
        }
        return null;
    }
};

// Table de correspondance des anciens noms de cas.
// Source unique : js/case-aliases.js (charge en amont par game.html).
// Le repli `{}` degrade proprement si le script n'a pas ete charge.
const LEGACY_CASE_ALIASES = globalThis.LEGACY_CASE_ALIASES || {};

function lazyLoadCase(file) {
    const resolvedFile = LEGACY_CASE_ALIASES[file] || file;
    const cacheKey = `case_${resolvedFile}`;
    const cached = caseLoaderCache.get(cacheKey) || caseLoaderCache.getFromLocalStorage(cacheKey);
    if (cached) return Promise.resolve(cached);

    return fetch(`data/${resolvedFile}`)
        .then(res => {
            if (!res.ok) {
                // If resolved file fails, try original file as fallback
                if (resolvedFile !== file) {
                    return fetch(`data/${file}`);
                }
                throw new Error(`Fichier ${resolvedFile} introuvable`);
            }
            return res;
        })
        .then(res => {
            if (!res.ok) throw new Error(`Fichier ${file} introuvable`);
            return res.json();
        })
        .then(data => {
            caseLoaderCache.set(cacheKey, data);
            return data;
        });
}

/**
 * Construit des DESCRIPTEURS légers (`{ id, file|dbId }`) sans télécharger les
 * corps. `gameState.ensureCaseLoaded()` charge ensuite le corps du SEUL cas
 * courant. C'est le « chargement paresseux du cas suivant » : à l'entrée en
 * partie on ne paie plus les 22 cas / ~930 Ko d'un thème, seulement le premier.
 *
 * L'`id` est la base du nom de fichier : c'est la convention de `data/`
 * (vérifié sur tous les cas indexés), donc `SessionSnapshot` — qui compare des
 * listes d'id — reste cohérent sans télécharger les corps.
 */
function buildCaseDescriptors(files) {
    return (files || [])
        .filter(f => typeof f === 'string' && f.trim())
        .map(f => {
            const isDbId = !f.endsWith('.json');
            const resolved = LEGACY_CASE_ALIASES[f] || f;
            const base = resolved.replace(/\.json$/, '');
            return {
                id: base,
                file: isDbId ? null : `${base}.json`,
                dbId: isDbId ? f : null,
                __descriptor: true
            };
        });
}

/**
 * Résout le CORPS d'un descripteur (ou renvoie tel quel un corps déjà complet).
 * Utilise le cache mémoire/TTL de `lazyLoadCase` pour les fichiers locaux.
 */
async function loadCaseBody(descriptor) {
    if (!descriptor) return null;
    // Corps déjà complet (chemin `?case=`, `preview`, single-case) : rien à faire.
    if (descriptor.__descriptor !== true) return descriptor;

    if (descriptor.dbId) {
        if (typeof supabase !== 'undefined') {
            try {
                const { data, error } = await supabase
                    .from('cases')
                    .select('*')
                    .eq('id', descriptor.dbId)
                    .single();
                if (!error && data) {
                    const content = data.content;
                    if (!content.id) content.id = data.id;
                    return content;
                }
            } catch (err) {
                console.warn('Supabase lazy fetch failed', err);
            }
        }
        // Repli local si la base n'a pas le cas (ou Supabase absent)
        return lazyLoadCase(`${descriptor.dbId}.json`);
    }

    return lazyLoadCase(descriptor.file);
}

window.loadCaseBody = loadCaseBody;

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
        const urlParams = new URLSearchParams(window.location.search);
        
        // Auto-start case via case query parameter
        const caseParam = urlParams.get('case');
        if (caseParam) {
            if (typeof supabase !== 'undefined' && !caseParam.endsWith('.json')) {
                try {
                    const { data, error } = await supabase
                        .from('cases')
                        .select('*')
                        .eq('id', caseParam)
                        .single();

                    if (!error && data) {
                        const content = data.content;
                        if (!content.id) content.id = data.id;
                        return [content];
                    }
                } catch (err) {
                    console.warn("Supabase single fetch failed from query param", err);
                }
            }

            // Fallback local
            const caseData = await lazyLoadCase(caseParam.endsWith('.json') ? caseParam : `${caseParam}.json`);
            return [caseData];
        }

        // Preview Mode check
        if (urlParams.get('preview') === 'true') {
            const previewData = sessionStorage.getItem('previewCase');
            if (previewData) {
                let parsedPreview;
                try {
                    parsedPreview = JSON.parse(previewData);
                } catch (error) {
                    console.warn('Aperçu de cas invalide, chargement des cas sélectionnés :', error);
                }

                if (!parsedPreview?.patient || typeof parsedPreview.patient !== 'object' || Array.isArray(parsedPreview.patient)) {
                    sessionStorage.removeItem('previewCase');
                    return loadCasesData();
                }
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

                return [parsedPreview];
            }
        }

        // 1. HYBRID FETCH (Supabase and Local cases)
        let selectedCaseFiles = [];
        try {
            const storedSelection = JSON.parse(localStorage.getItem('selectedCaseFiles') || 'null');
            if (Array.isArray(storedSelection)) {
                selectedCaseFiles = storedSelection.filter(file => typeof file === 'string' && file.trim());
            }
        } catch (error) {
            console.warn('Sélection de cas locale invalide, reprise des thèmes :', error);
        }

        if (selectedCaseFiles.length > 0) {
            // Descripteurs légers : ordre d'origine préservé, aucun corps
            // téléchargé. Chaque cas est chargé à la demande par loadCaseBody()
            // quand le joueur y arrive (voir gameState.ensureCaseLoaded).
            // NOTE : la sélection n'est PAS purgée ici — elle est conservée
            // pour la reprise de session (SessionSnapshot). Elle est purgée
            // par SessionSnapshot.clearFullSession() en fin de session.
            const descriptors = buildCaseDescriptors(selectedCaseFiles);
            if (descriptors.length > 0) {
                return descriptors;
            }
        }

        // 2. Single case (with cache)
        const selectedCaseFile = localStorage.getItem('selectedCaseFile');
        if (selectedCaseFile) {
            // Si Supabase est dispo et que c'est un ID sans extension, tenter Supabase d'abord
            if (typeof supabase !== 'undefined' && !selectedCaseFile.endsWith('.json')) {
                try {
                    const { data, error } = await supabase
                        .from('cases')
                        .select('*')
                        .eq('id', selectedCaseFile)
                        .single();

                    if (!error && data) {
                        const content = data.content;
                        if (!content.id) content.id = data.id;
                        // Sélection conservée pour la reprise de session (voir SessionSnapshot)
                        return [content];
                    }
                } catch (err) {
                    console.warn("Supabase single fetch failed", err);
                }
            }

            // Fallback local
            const caseData = await lazyLoadCase(selectedCaseFile.endsWith('.json') ? selectedCaseFile : `${selectedCaseFile}.json`);
            // Sélection conservée pour la reprise de session (voir SessionSnapshot)
            return [caseData];
        }

        // Themes fallback
        let selectedThemes = [];
        try {
            selectedThemes = JSON.parse(localStorage.getItem('selectedThemes')) || [];
        } catch (e) {
            console.warn('CaseLoader: préférences de thèmes illisibles, repli sur cardiologie', e);
        }
        if (!Array.isArray(selectedThemes) || selectedThemes.length === 0) {
            selectedThemes = ['cardiologie'];
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

        // Changement paresseux : on ne télécharge plus tout le thème. Les corps
        // sont chargés un par un au fil de la partie (loadCaseBody).
        return buildCaseDescriptors(caseFiles);
    } catch (error) {
        console.error('Erreur lors du chargement des cas :', error);
        showNotification('Erreur lors du chargement des cas cliniques : ' + error.message);
        return [];
    }
}
