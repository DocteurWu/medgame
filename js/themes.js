// themes.js
document.addEventListener('DOMContentLoaded', () => {
    const themeCards = document.querySelectorAll('#themes-grid .theme-card');

    // Éléments du modal des motifs
    const motifsModal = document.getElementById('motifs-modal');
    const motifsList = document.getElementById('motifs-list');
    const motifsTitle = document.getElementById('motifs-title');
    const closeMotifsBtn = document.getElementById('close-motifs');
    const startSessionBtn = document.getElementById('start-session');
    const selectUnplayedBtn = document.getElementById('select-unplayed');

    let casesData = {}; // Objet contenant les thèmes et leurs fichiers
    let selectedCaseFiles = []; // Liste des fichiers sélectionnés pour la session
    let currentThemeInModal = '';
    let currentThemeMotifs = []; // To store loaded motifs for the current theme
    let casesReady = null; // Promise that resolves when casesData is loaded

    // Helper for cookies
    function getCookie(name) {
        let nameEQ = name + "=";
        let ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    // Charge l'index des cas (depuis Supabase si disponible, sinon fallback local)
    async function initCases() {
        // 1. Charge d'abord l'index local par défaut
        try {
            const response = await fetch('data/case-index.json');
            if (response.ok) {
                casesData = await response.json();
            } else {
                console.error('Erreur lors du chargement initial de case-index.json');
                casesData = {};
            }
        } catch (err) {
            console.error('Erreur de chargement local de case-index.json :', err);
            casesData = {};
        }

        // 2. Si Supabase est présent, charge et fusionne les cas distants de façon non destructive
        if (typeof supabase !== 'undefined') {
            try {
                const { data, error } = await supabase
                    .from('cases')
                    .select('id, title, specialty, content, display_order, status');

                if (error) throw error;

                // Filter: only published or no status (legacy cases)
                const published = data
                    .filter(c => !c.status || c.status === 'published')
                    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

                // Fusionner les cas distants dans casesData
                published.forEach(c => {
                    const spec = (c.specialty || 'autre').toLowerCase();
                    if (!casesData[spec]) casesData[spec] = [];

                    const dbId = c.id;
                    // Éviter d'ajouter un doublon si le cas local existe déjà (par ex. "cardio_1" et "cardio_1.json")
                    const hasLocalDuplicate = casesData[spec].some(localFile => {
                        const localId = localFile.replace('.json', '');
                        return localId.toLowerCase() === dbId.toLowerCase();
                    });

                    if (!hasLocalDuplicate && !casesData[spec].includes(dbId)) {
                        casesData[spec].push(dbId);
                    }
                });

                // On garde une map globale id -> content pour éviter les fetchs répétitifs
                window.allSupabaseCases = published;
            } catch (err) {
                console.error('Erreur Supabase lors de la fusion, maintien du local index :', err);
            }
        }
    }

    // Store the promise so showMotifsForTheme can await it
    casesReady = initCases().catch(err => {
        console.error('Erreur lors du chargement des cas :', err);
    });

    // Palette de couleurs pour chaque spécialité médicale (synchronisation avec le fond 3D)
    const THEME_COLORS = {
        'Cardiologie': { a: 0xff4757, b: 0x5f27cd, glow: 'rgba(255, 71, 87, 0.45)' },
        'Uronephro': { a: 0x00d2d3, b: 0x2e86de, glow: 'rgba(0, 210, 211, 0.45)' },
        'Endocrinologie': { a: 0xffa801, b: 0xff5e57, glow: 'rgba(255, 168, 1, 0.45)' },
        'Neurosensorielle': { a: 0x0be881, b: 0x48dbfb, glow: 'rgba(11, 232, 129, 0.45)' },
        'Neurologie/psychiatrie': { a: 0xb388ff, b: 0x5f27cd, glow: 'rgba(179, 136, 255, 0.45)' },
        'Gynecologie': { a: 0xff78ae, b: 0xff6b6b, glow: 'rgba(255, 120, 174, 0.45)' },
        'Agents-infectieux': { a: 0x2ed573, b: 0x10ac84, glow: 'rgba(46, 213, 115, 0.45)' },
        'Appareil-digestif': { a: 0xff7f50, b: 0xee5253, glow: 'rgba(255, 127, 80, 0.45)' },
        'Locomoteur': { a: 0x70a1ff, b: 0x5352ed, glow: 'rgba(112, 161, 255, 0.45)' },
        'Urgence': { a: 0xff3838, b: 0x220000, glow: 'rgba(255, 56, 56, 0.55)' }
    };
    const DEFAULT_THEME_COLORS = { a: 0x00f2fe, b: 0xb388ff };

    // Transition cinématique fluide
    function transitionTo(url) {
        const veil = document.getElementById('page-veil');
        if (veil) veil.classList.add('active');
        if (window.ThreeBackground && window.ThreeBackground.warp) {
            window.ThreeBackground.warp(450);
        }
        setTimeout(() => {
            window.location.href = url;
        }, 380);
    }

    // Intercepter le retour au menu
    const backMenuLink = document.querySelector('.back-link-bottom');
    if (backMenuLink) {
        backMenuLink.addEventListener('click', (e) => {
            e.preventDefault();
            transitionTo('index.html');
        });
    }

    // Gestion des clics et survols sur les cartes de thème
    themeCards.forEach(card => {
        const theme = card.dataset.theme;
        const colors = THEME_COLORS[theme] || DEFAULT_THEME_COLORS;

        // Réactivité dynamique du fond 3D au survol
        card.addEventListener('mouseenter', () => {
            if (window.ThreeBackground && window.ThreeBackground.setTheme) {
                window.ThreeBackground.setTheme(colors.a, colors.b);
            }
        });

        card.addEventListener('mouseleave', () => {
            if (!motifsModal || motifsModal.style.display === 'none') {
                if (window.ThreeBackground && window.ThreeBackground.setTheme) {
                    window.ThreeBackground.setTheme(DEFAULT_THEME_COLORS.a, DEFAULT_THEME_COLORS.b);
                }
            }
        });

        // Onde de choc 3D au clic
        card.addEventListener('click', (e) => {
            if (window.ThreeBackground && window.ThreeBackground.pulse) {
                window.ThreeBackground.pulse(e.clientX, e.clientY);
            }
            showMotifsForTheme(theme);
        });
    });

    // Effet de tilt 3D et reflet interactif sur les cartes (Desktop)
    if (window.matchMedia('(pointer: fine)').matches) {
        themeCards.forEach(card => {
            let tiltX = 0, tiltY = 0;
            let targetX = 0, targetY = 0;
            let isHovered = false;
            let animId = null;

            const updateTilt = () => {
                tiltX += (targetX - tiltX) * 0.15;
                tiltY += (targetY - tiltY) * 0.15;
                if (isHovered) {
                    card.style.transform = `perspective(800px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) translateY(-6px) scale(1.02)`;
                    animId = requestAnimationFrame(updateTilt);
                } else {
                    card.style.transform = '';
                    cancelAnimationFrame(animId);
                }
            };

            card.addEventListener('mouseenter', () => {
                isHovered = true;
                animId = requestAnimationFrame(updateTilt);
            });

            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                card.style.setProperty('--mouse-x', `${((x / rect.width) * 100).toFixed(1)}%`);
                card.style.setProperty('--mouse-y', `${((y / rect.height) * 100).toFixed(1)}%`);
                const cx = rect.width / 2;
                const cy = rect.height / 2;
                targetX = -((y - cy) / cy) * 6;
                targetY = ((x - cx) / cx) * 6;
            });

            card.addEventListener('mouseleave', () => {
                isHovered = false;
                targetX = 0;
                targetY = 0;
            });
        });
    }

    // Afficher les motifs pour un thème
    async function showMotifsForTheme(theme) {
        // Wait for casesData to be fully loaded before proceeding
        await casesReady;

        currentThemeInModal = theme;
        selectedCaseFiles = [];
        updateStartSessionButton();

        // Réinitialiser le filtre ECOS à chaque ouverture de thème
        const filterEcosOnly = document.getElementById('filter-ecos-only');
        if (filterEcosOnly) {
            filterEcosOnly.checked = false;
        }
        const searchReset = document.getElementById('motifs-search');
        if (searchReset) searchReset.value = '';
        const sortReset = document.getElementById('motifs-sort');
        if (sortReset) sortReset.value = 'default';

        const themeLower = theme.toLowerCase();
        const mapKeys = { 'urgences': 'urgence', 'urgence': 'urgence', 'pédiatrie': 'pédiatrie' };
        const searchSpec = mapKeys[themeLower] || themeLower;

        const motifsGraph = document.getElementById('motifs-graph');
        const motifsActions = document.getElementById('motifs-actions');
        const motifsContent = document.querySelector('.motifs-content');

        const col = THEME_COLORS[theme] || DEFAULT_THEME_COLORS;
        if (window.ThreeBackground && window.ThreeBackground.setTheme) {
            window.ThreeBackground.setTheme(col.a, col.b);
        }
        if (motifsContent) {
            motifsContent.style.borderColor = col.glow || 'rgba(0, 242, 254, 0.35)';
            motifsContent.style.boxShadow = `0 25px 60px rgba(0, 0, 0, 0.7), 0 0 35px ${col.glow || 'rgba(0, 242, 254, 0.2)'}`;
        }

        motifsTitle.textContent = `Thème : ${theme}`;
        motifsModal.style.display = 'flex';

        // INTERCEPTION: Si un Graphe existe pour ce thème, on l'affiche plein écran dans la modal
        if (casesData[searchSpec]) {
            const graphIdExists = casesData[searchSpec].some(id => id.startsWith('graph_'));
            if (graphIdExists) {
                motifsList.style.display = 'none';
                motifsActions.style.display = 'none';
                startSessionBtn.style.display = 'none';

                motifsGraph.style.display = 'block';
                motifsContent.classList.add('graph-mode');

                // Initialiser la carte à l'intérieur
                if (window.initPlayerMap) {
                    window.initPlayerMap(theme);
                }
                return; // Ne pas exécuter la suite de l'affichage classique par liste
            }
        }

        // --- AFFICHAGE CLASSIQUE (Liste) ---
        motifsList.style.display = 'block';
        motifsActions.style.display = 'flex';
        motifsGraph.style.display = 'none';
        motifsContent.classList.remove('graph-mode');

        motifsList.innerHTML = '<div class="loading">Chargement des motifs...</div>';

        let playedCases = [];
        const playedCasesStr = getCookie('playedCases') || '';
        if (playedCasesStr) {
            playedCases = playedCasesStr.split(',').filter(id => id !== '');
        }

        // Fetch Supabase played cases if available
        if (typeof supabase !== 'undefined') {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    const { data: plays, error } = await supabase
                        .from('play_sessions')
                        .select('case_id')
                        .eq('user_id', session.user.id);

                    if (!error && plays) {
                        const supabasePlayed = plays.map(p => p.case_id);
                        // Merge cookies and supabase
                        playedCases = [...new Set([...playedCases, ...supabasePlayed])];
                    }
                }
            } catch (err) {
                console.error("Erreur lors de la récupération de l'historique:", err);
            }
        }

        try {
            let motifs = [];
            const caseList = casesData[searchSpec] || [];

            motifs = await Promise.all(caseList.map(async (fileOrId) => {
                // 1. Vérifier si c'est un cas de Supabase préchargé
                const dbCase = window.allSupabaseCases ? window.allSupabaseCases.find(c => c.id === fileOrId) : null;
                if (dbCase) {
                    let data = dbCase.content;
                    if (typeof data === 'string') {
                        try { data = JSON.parse(data); } catch (e) {}
                    }
                    return {
                        id: data.id,
                        file: dbCase.id,
                        motif: data.interrogatoire?.motifHospitalisation || "Sans motif",
                        patient: `${data.patient?.prenom || ''} ${data.patient?.nom || ''}`,
                        redacteur: data.redacteur || '',
                        isPlayed: playedCases.includes(data.id),
                        isSupabase: true,
                        isEcos: !!data.ecos,
                        difficulty: data.difficulty || 2,
                        vignette: (data.correction || '').slice(0, 110),
                        examCount: (data.availableExams || []).length,
                        lockCount: (data.locks || []).length,
                        isUrgence: !!(data.gameplayConfig || (data.id || '').toLowerCase().includes('urgence'))
                    };
                } else {
                    // 2. Sinon, c'est un cas local (nom de fichier avec ou sans .json)
                    const filename = fileOrId.endsWith('.json') ? fileOrId : `${fileOrId}.json`;
                    try {
                        let response = await fetch(`data/${filename}`);
                        if (!response.ok && fileOrId !== filename) {
                            response = await fetch(`data/${fileOrId}`);
                        }
                        if (!response.ok) return null;

                        const data = await response.json();
                        return {
                            id: data.id,
                            file: fileOrId,
                            motif: data.interrogatoire?.motifHospitalisation || "Sans motif",
                            patient: `${data.patient?.prenom || ''} ${data.patient?.nom || ''}`,
                            redacteur: data.redacteur || '',
                            isPlayed: playedCases.includes(data.id),
                            isEcos: !!data.ecos,
                            difficulty: data.difficulty || 2,
                            vignette: (data.correction || '').slice(0, 110),
                            examCount: (data.availableExams || []).length,
                            lockCount: (data.locks || []).length,
                            isUrgence: !!(data.gameplayConfig || (data.id || '').toLowerCase().includes('urgence'))
                        };
                    } catch (err) {
                        console.error(`Erreur de chargement local pour le cas ${fileOrId} :`, err);
                        return null;
                    }
                }
            }));

            // Filtrer les cas qui n'ont pas pu être chargés
            currentThemeMotifs = motifs.filter(m => m !== null);

            renderMotifsList();

            if (currentThemeMotifs.length === 0) {
                motifsList.innerHTML = '<div class="no-motifs">Aucun cas disponible pour ce thème.</div>';
            }
        } catch (error) {
            console.error('Erreur lors du chargement des motifs :', error);
            motifsList.innerHTML = '<div class="error">Erreur lors du chargement des motifs.</div>';
        }
    }

    function difficultyStars(d) {
        const n = Math.max(1, Math.min(3, parseInt(d, 10) || 2));
        return '★'.repeat(n) + '☆'.repeat(3 - n);
    }

    function renderMotifsList() {
        motifsList.innerHTML = '';
        const filterEcosOnly = document.getElementById('filter-ecos-only');
        const ecosOnly = filterEcosOnly ? filterEcosOnly.checked : false;
        const searchEl = document.getElementById('motifs-search');
        const sortEl = document.getElementById('motifs-sort');
        const query = searchEl ? searchEl.value.trim().toLowerCase() : '';
        const sortMode = sortEl ? sortEl.value : 'default';

        let filteredMotifs = ecosOnly
            ? currentThemeMotifs.filter(item => item.isEcos)
            : [...currentThemeMotifs];

        if (query) {
            filteredMotifs = filteredMotifs.filter(item =>
                `${item.motif} ${item.patient} ${item.id}`.toLowerCase().includes(query));
        }
        if (sortMode === 'difficulty') {
            filteredMotifs.sort((a, b) => (a.difficulty || 2) - (b.difficulty || 2));
        } else if (sortMode === 'unplayed') {
            filteredMotifs.sort((a, b) => Number(a.isPlayed || false) - Number(b.isPlayed || false));
        }

        // En-tête progression du thème
        const doneCount = currentThemeMotifs.filter(m => m.isPlayed).length;
        const header = document.createElement('div');
        header.style.cssText = 'text-align:center;color:rgba(255,255,255,0.65);font-size:0.82rem;margin-bottom:10px;';
        header.textContent = currentThemeMotifs.length > 0
            ? `${doneCount}/${currentThemeMotifs.length} cas faits dans ce thème`
            : '';
        motifsList.appendChild(header);

        filteredMotifs.forEach(item => {
            const motifItem = document.createElement('div');
            motifItem.className = 'motif-item';
            if (selectedCaseFiles.includes(item.file)) {
                motifItem.classList.add('selected');
            }

            let statusHtml = '';
            if (item.isPlayed) {
                statusHtml = '<span class="played-badge"><i class="fas fa-check-circle"></i> Fait</span>';
            }

            let ecosBadgeHtml = item.isEcos ? '<span class="played-badge" style="background:rgba(52,152,219,0.15);color:#3498db;">ECOS</span>' : '';
            const urgBadge = item.isUrgence ? '<span class="played-badge" style="background:rgba(255,71,87,0.15);color:#ff6b81;">⏱ Urgence ~5min</span>' : '';
            const diffBadge = `<span class="played-badge" style="background:rgba(255,193,7,0.15);color:#ffc107;" title="Difficulté ${item.difficulty || 2}/3">${difficultyStars(item.difficulty)}</span>`;
            const metaLine = `<span class="motif-patient">🧪 ${item.examCount || 0} ex. · 🔐 ${item.lockCount || 0} défis</span>`;

            const redacteurHtml = item.redacteur ? `<span class="motif-redacteur">rédigé par ${item.redacteur}</span>` : '';

            motifItem.innerHTML = `
                <i class="fas fa-file-medical"></i>
                <div class="motif-info">
                    <div class="motif-name">${item.motif} ${statusHtml} ${ecosBadgeHtml} ${urgBadge} ${diffBadge}</div>
                    <div class="motif-patient-row">
                        <span class="motif-patient">Patient : ${item.patient}</span>
                        ${redacteurHtml}
                    </div>
                    <div class="motif-patient-row">${metaLine}</div>
                </div>
            `;

            motifItem.addEventListener('click', () => {
                motifItem.classList.toggle('selected');
                if (motifItem.classList.contains('selected')) {
                    selectedCaseFiles.push(item.file);
                } else {
                    selectedCaseFiles = selectedCaseFiles.filter(f => f !== item.file);
                }
                updateStartSessionButton();
            });
            motifsList.appendChild(motifItem);
        });

        if (filteredMotifs.length === 0) {
            motifsList.innerHTML += `<div class="no-motifs">${query ? "Aucun cas ne correspond à la recherche." : (ecosOnly ? "Aucun cas compatible ECOS pour ce thème." : "Aucun cas disponible pour ce thème.")}</div>`;
        }
    }

    // Recherche + tri (P0)
    const motifsSearch = document.getElementById('motifs-search');
    if (motifsSearch) motifsSearch.addEventListener('input', () => renderMotifsList());
    const motifsSort = document.getElementById('motifs-sort');
    if (motifsSort) motifsSort.addEventListener('change', () => renderMotifsList());

    // Cas du jour déterministe (P0 rejouabilité)
    try {
        const daySeed = new Date().toISOString().slice(0, 10);
        let hash = 0;
        for (let i = 0; i < daySeed.length; i++) hash = (hash * 31 + daySeed.charCodeAt(i)) >>> 0;
        casesReady.then(async () => {
            const allFiles = Object.entries(casesData).flatMap(([spec, files]) => files.map(f => ({ spec, file: f })));
            if (allFiles.length === 0) return;
            const pick = allFiles[hash % allFiles.length];
            const banner = document.getElementById('daily-case-banner');
            if (!banner || !pick) return;

            // Nettoyage esthétique du titre (sans .json ni underscores bruts)
            const formatCleanTitle = (file) => {
                let name = file || '';
                name = name.replace(/\.json$/i, '');
                name = name.replace(/^[a-zA-Z0-9]+[_-]/i, '');
                name = name.replace(/_/g, ' ');
                name = name.replace(/\s+\d+$/i, '');
                if (name.length > 0) {
                    name = name.charAt(0).toUpperCase() + name.slice(1);
                }
                return name || 'Cas du jour';
            };

            let displayTitle = formatCleanTitle(pick.file);

            // Récupérer un titre plus propre depuis les données si disponible et concis
            try {
                let fullTitle = displayTitle;
                if (window.allSupabaseCases) {
                    const found = window.allSupabaseCases.find(c => c.id === pick.file);
                    if (found) {
                        const content = typeof found.content === 'string' ? JSON.parse(found.content) : found.content;
                        if (found.title) fullTitle = found.title;
                        if (content?.title) fullTitle = content.title;
                    }
                } else {
                    const filename = pick.file.endsWith('.json') ? pick.file : `${pick.file}.json`;
                    const res = await fetch(`data/${filename}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.title) fullTitle = data.title;
                        else if (data.interrogatoire?.motifHospitalisation && data.interrogatoire.motifHospitalisation.length <= 32) {
                            fullTitle = data.interrogatoire.motifHospitalisation;
                        }
                    }
                }
                if (fullTitle && fullTitle.length <= 32) {
                    displayTitle = fullTitle;
                }
            } catch (_) {}

            // Vérification si déjà complété
            let isPlayed = false;
            const playedStr = getCookie('playedCases') || '';
            const playedList = playedStr ? playedStr.split(',').filter(Boolean) : [];
            const cleanId = pick.file.replace('.json', '');
            if (playedList.includes(cleanId) || playedList.includes(pick.file)) {
                isPlayed = true;
            }

            banner.style.display = 'inline-flex';
            banner.setAttribute('title', `Cas du jour : ${displayTitle} (${pick.spec})`);

            const tagHtml = isPlayed
                ? `<span class="daily-case-tag" style="background:rgba(46,213,115,0.18);color:#2ed573;"><i class="fas fa-check-circle" style="color:#2ed573;"></i> Fait</span>`
                : `<span class="daily-case-tag"><i class="fas fa-fire"></i> Cas du jour</span>`;

            const btnHtml = isPlayed
                ? `<span class="daily-case-btn" style="border-color:rgba(46,213,115,0.4);"><i class="fas fa-redo"></i> Rejouer</span>`
                : `<span class="daily-case-btn"><i class="fas fa-play"></i> Jouer</span>`;

            banner.innerHTML = `${tagHtml}<span class="daily-case-name">${displayTitle}</span>${btnHtml}`;

            const launch = () => {
                sessionStorage.setItem('immersionMode', 'immersif');
                localStorage.setItem('selectedThemes', JSON.stringify([pick.spec]));
                localStorage.setItem('selectedCaseFiles', JSON.stringify([pick.file]));
                localStorage.removeItem('selectedCaseFile');
                transitionTo('game.html');
            };

            banner.addEventListener('click', launch);
            banner.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    launch();
                }
            });
        });
    } catch (e) { /* non bloquant */ }

    // Écouteur pour la case à cocher de filtrage ECOS
    const filterEcosOnly = document.getElementById('filter-ecos-only');
    if (filterEcosOnly) {
        filterEcosOnly.addEventListener('change', () => {
            renderMotifsList();
        });
    }

    // Sélectionner tout ce qui n'est pas fait
    selectUnplayedBtn.addEventListener('click', () => {
        const filterEcosOnly = document.getElementById('filter-ecos-only');
        const ecosOnly = filterEcosOnly ? filterEcosOnly.checked : false;

        let targetItems = currentThemeMotifs;
        if (ecosOnly) {
            targetItems = targetItems.filter(m => m.isEcos);
        }

        selectedCaseFiles = targetItems
            .filter(m => !m.isPlayed)
            .map(m => m.file);

        renderMotifsList();
        updateStartSessionButton();
    });

    function updateStartSessionButton() {
        if (selectedCaseFiles.length > 0) {
            startSessionBtn.style.display = 'block';
            startSessionBtn.textContent = `Commencer (${selectedCaseFiles.length} cas)`;
        } else {
            startSessionBtn.style.display = 'none';
        }
    }

    // Lancer la session
    startSessionBtn.addEventListener('click', () => {
        if (selectedCaseFiles.length > 0) {
            sessionStorage.setItem('immersionMode', 'immersif');
            localStorage.setItem('selectedThemes', JSON.stringify([currentThemeInModal]));
            localStorage.setItem('selectedCaseFiles', JSON.stringify(selectedCaseFiles));
            localStorage.removeItem('selectedCaseFile');
            transitionTo('game.html');
        }
    });

    // Fermer le modal
    closeMotifsBtn.addEventListener('click', () => {
        motifsModal.style.display = 'none';
        selectedCaseFiles = [];
        document.querySelector('.motifs-content').classList.remove('graph-mode');
        const graph = document.getElementById('motifs-graph');
        if (graph) graph.style.display = 'none';
        if (window.ThreeBackground && window.ThreeBackground.setTheme) {
            window.ThreeBackground.setTheme(DEFAULT_THEME_COLORS.a, DEFAULT_THEME_COLORS.b);
        }
    });

    window.addEventListener('click', (event) => {
        if (event.target === motifsModal) {
            motifsModal.style.display = 'none';
            selectedCaseFiles = [];
            document.querySelector('.motifs-content').classList.remove('graph-mode');
            const graph = document.getElementById('motifs-graph');
            if (graph) graph.style.display = 'none';
            if (window.ThreeBackground && window.ThreeBackground.setTheme) {
                window.ThreeBackground.setTheme(DEFAULT_THEME_COLORS.a, DEFAULT_THEME_COLORS.b);
            }
        }
    });
});
