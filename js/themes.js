// themes.js
document.addEventListener('DOMContentLoaded', () => {
    const themeCards = document.querySelectorAll('#themes-grid .theme-card');
    const startButton = document.getElementById('start-button');
    const resetButton = document.getElementById('reset-button');
    const selectedCountSpan = document.getElementById('selected-count');
    const availableCasesSpan = document.getElementById('available-cases');
    let selectedThemes = [];
    let casesData = {}; // Objet contenant les thèmes et leurs fichiers

    // Compte le nombre de cas pour un thème donné
    function getCasesCountByTheme(theme, cases) {
        return cases[theme.toLowerCase()] ? cases[theme.toLowerCase()].length : 0; // Retourne le nombre de fichiers pour ce thème
    }

    // Met à jour les compteurs
    function updateThemeInfo() {
        let totalCases = 0;
        selectedThemes.forEach(theme => {
            totalCases += getCasesCountByTheme(theme, casesData);
        });
        selectedCountSpan.textContent = `${selectedThemes.length}`;
        availableCasesSpan.textContent = `${totalCases}`;
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
            updateThemeInfo(); // Met à jour après le chargement
        })
        .catch(error => {
            console.error('Erreur lors du chargement des cas :', error);
            availableCasesSpan.textContent = 'Erreur';
        });

    // Gestion des clics sur les cartes de thème
    themeCards.forEach(card => {
        card.addEventListener('click', () => {
            const theme = card.dataset.theme;
            if (selectedThemes.includes(theme)) {
                selectedThemes = selectedThemes.filter(t => t !== theme);
                card.style.backgroundColor = ''; // Réinitialise la couleur
            } else {
                selectedThemes.push(theme);
                // Applique une couleur selon le thème
                if (theme === "Cardiologie") card.style.backgroundColor = "#ffcccc";
                if (theme === "Pneumologie") card.style.backgroundColor = "#ccddff";
                if (theme === "Endocrinologie") card.style.backgroundColor = "#e0ccff";
                if (theme === "Hématologie") card.style.backgroundColor = "#d9d9ff";
                if (theme === "Gastro-entérologie") card.style.backgroundColor = "#ccffcc";
                if (theme === "Immunologie") card.style.backgroundColor = "#ffffe0";
            }
            startButton.disabled = selectedThemes.length === 0;
            updateThemeInfo();
        });
    });

    // Réinitialisation
    resetButton.addEventListener('click', () => {
        selectedThemes = [];
        themeCards.forEach(card => {
            card.style.backgroundColor = '';
        });
        startButton.disabled = true;
        updateThemeInfo();
    });

    // Lancer le jeu
    startButton.addEventListener('click', () => {
        if (selectedThemes.length > 0) {
            localStorage.setItem('selectedThemes', JSON.stringify(selectedThemes));
            window.location.href = 'game.html';
        }
    });
});
