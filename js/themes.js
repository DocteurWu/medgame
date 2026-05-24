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

    // Gestion des clics sur les cartes de thème
    themeCards.forEach(card => {
        card.addEventListener('click', async () => {
            const theme = card.dataset.theme;

            // Afficher le modal des motifs
            showMotifsForTheme(theme);
        });
    });

    // Afficher les motifs pour un thème
    async function showMotifsForTheme(theme) {
        // Wait for casesData to be fully loaded before proceeding
        await casesReady;

        currentThemeInModal = theme;
        selectedCaseFiles = [];
        updateStartSessionButton();

        const themeLower = theme.toLowerCase();
        const mapKeys = { 'urgences': 'urgence', 'urgence': 'urgence', 'pédiatrie': 'pédiatrie' };
        const searchSpec = mapKeys[themeLower] || themeLower;

        const motifsGraph = document.getElementById('motifs-graph');
        const motifsActions = document.getElementById('motifs-actions');
        const motifsContent = document.querySelector('.motifs-content');

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
                    const data = dbCase.content;
                    return {
                        id: data.id,
                        file: dbCase.id,
                        motif: data.interrogatoire?.motifHospitalisation || "Sans motif",
                        patient: `${data.patient?.prenom || ''} ${data.patient?.nom || ''}`,
                        redacteur: data.redacteur || '',
                        isPlayed: playedCases.includes(data.id),
                        isSupabase: true
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
                            isPlayed: playedCases.includes(data.id)
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

    function renderMotifsList() {
        motifsList.innerHTML = '';
        currentThemeMotifs.forEach(item => {
            const motifItem = document.createElement('div');
            motifItem.className = 'motif-item';
            if (selectedCaseFiles.includes(item.file)) {
                motifItem.classList.add('selected');
            }

            let statusHtml = '';
            if (item.isPlayed) {
                statusHtml = '<span class="played-badge"><i class="fas fa-check-circle"></i> Fait</span>';
            }

            const redacteurHtml = item.redacteur ? `<span class="motif-redacteur">rédigé par ${item.redacteur}</span>` : '';

            motifItem.innerHTML = `
                <i class="fas fa-file-medical"></i>
                <div class="motif-info">
                    <div class="motif-name">${item.motif} ${statusHtml}</div>
                    <div class="motif-patient-row">
                        <span class="motif-patient">Patient : ${item.patient}</span>
                        ${redacteurHtml}
                    </div>
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
    }

    // Sélectionner tout ce qui n'est pas fait
    selectUnplayedBtn.addEventListener('click', () => {
        selectedCaseFiles = currentThemeMotifs
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
            localStorage.setItem('selectedThemes', JSON.stringify([currentThemeInModal]));
            localStorage.setItem('selectedCaseFiles', JSON.stringify(selectedCaseFiles));
            localStorage.removeItem('selectedCaseFile');
            window.location.href = 'game.html';
        }
    });

    // Fermer le modal
    closeMotifsBtn.addEventListener('click', () => {
        motifsModal.style.display = 'none';
        selectedCaseFiles = [];
        document.querySelector('.motifs-content').classList.remove('graph-mode');
        const graph = document.getElementById('motifs-graph');
        if (graph) graph.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === motifsModal) {
            motifsModal.style.display = 'none';
            selectedCaseFiles = [];
            document.querySelector('.motifs-content').classList.remove('graph-mode');
            const graph = document.getElementById('motifs-graph');
            if (graph) graph.style.display = 'none';
        }
    });
});
