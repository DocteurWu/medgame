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

    // Charge l’index des cas
    fetch('data/case-index.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Erreur lors du chargement de case-index.json');
            }
            return response.json();
        })
        .then(data => {
            casesData = data;
            console.log('Cases data chargé :', casesData);
        })
        .catch(error => {
            console.error('Erreur lors du chargement des cas :', error);
        });

    // Gestion des clics sur les cartes de thème
    themeCards.forEach(card => {
        card.addEventListener('click', async () => {
            const theme = card.dataset.theme;
            if (theme === 'A_venir') return;

            // Afficher le modal des motifs
            showMotifsForTheme(theme);
        });
    });

    // Afficher les motifs pour un thème
    async function showMotifsForTheme(theme) {
        currentThemeInModal = theme;
        selectedCaseFiles = [];
        updateStartSessionButton();

        const themeLower = theme.toLowerCase();
        const caseFiles = casesData[themeLower] || [];

        motifsTitle.textContent = `Thème : ${theme}`;
        motifsList.innerHTML = '<div class="loading">Chargement des motifs...</div>';
        motifsModal.style.display = 'flex';

        const playedCasesStr = getCookie('playedCases') || '';
        const playedCases = playedCasesStr.split(',').filter(id => id !== '');

        try {
            const motifs = await Promise.all(caseFiles.map(async (file) => {
                const response = await fetch(`data/${file}`);
                if (!response.ok) return null;
                const data = await response.json();
                return {
                    id: data.id,
                    file: file,
                    motif: data.interrogatoire.motifHospitalisation,
                    patient: `${data.patient.prenom} ${data.patient.nom}`,
                    redacteur: data.redacteur || '',
                    isPlayed: playedCases.includes(data.id)
                };
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
    });

    window.addEventListener('click', (event) => {
        if (event.target === motifsModal) {
            motifsModal.style.display = 'none';
            selectedCaseFiles = [];
        }
    });
});
