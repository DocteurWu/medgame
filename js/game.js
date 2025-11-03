// Y'a qql qui va lire le code ?? si oui veuillez me contacter sur discord : docteur_wu

document.addEventListener('DOMContentLoaded', async () => {
    const motifHospitalisation = document.getElementById('motif-hospitalisation');
    const activitePhysique = document.getElementById('activite-physique');
    const tabac = document.getElementById('tabac');
    const alcool = document.getElementById('alcool');
    const alimentation = document.getElementById('alimentation');
    const emploi = document.getElementById('emploi');
    const antecedentsMedicaux = document.getElementById('antecedents-medicaux');
    const antecedentsChirurgicaux = document.getElementById('antecedents-chirurgicaux');
    const antecedentsFamiliaux = document.getElementById('antecedents-familiaux');
    const traitementsListe = document.getElementById('traitements-liste');
    const allergiesListe = document.getElementById('allergies-liste');
    const debutSymptomes = document.getElementById('debut-symptomes');
    const evolution = document.getElementById('evolution');
    const facteursDeclenchants = document.getElementById('facteurs-declenchants');
    const symptomesAssocies = document.getElementById('symptomes-associes');
    const  remarques = document.getElementById(' remarques');
    const tension = document.getElementById('tension');
    const pouls = document.getElementById('pouls');
    const temperature = document.getElementById('temperature');
    const saturationO2 = document.getElementById('saturationO2');
    const frequenceRespiratoire = document.getElementById('frequenceRespiratoire');
    const aspectGeneral = document.getElementById('aspectGeneral');
    const examenCardiovasculaire = document.getElementById('examenCardiovasculaire');
    const examenPulmonaire = document.getElementById('examenPulmonaire');
    const examenAbdominal = document.getElementById('examenAbdominal');
    const examenNeurologique = document.getElementById('examenNeurologique');
    const examensResults = document.getElementById('examens-results');
    console.log('examensResults défini au début :', examensResults);
    const validateExamsButton = document.getElementById('validate-exams');
    const diagnosticInput = document.getElementById('diagnostic-input');
    const validateDiagnosticButton = document.getElementById('validate-diagnostic');
    const scoreDisplay = document.getElementById('score');
    const feedbackDisplay = document.getElementById('feedback');
    const nextCaseButton = document.getElementById('next-case');

    let cases = [];
    let currentCaseIndex = 0;
    let currentCase = null;
    let score = 0;
    let selectedTreatments = [];
    let attempts = 0;
    let timeLeft = 180; // 3 minutes
    let timerInterval;

    function displayTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        document.getElementById('timer').textContent = `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }

    function updateTimer() {
        if (timeLeft > 0) {
            timeLeft--;
            displayTime(timeLeft);
        } else {
            clearInterval(timerInterval);
            alert('Temps écoulé !');
            // Ici, vous pouvez ajouter une logique pour empêcher le joueur de continuer
        }
    }

    // Cookie management functions
    function setCookie(name, value, days) {
        let expires = "";
        if (days) {
            let date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + expires + "; path=/";
    }

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

    function eraseCookie(name) {
        document.cookie = name + '=; path=/; Max-Age=-99999999;';
    }



    async function loadCasesData() {
        try {
            // Récupérer les thèmes sélectionnés depuis localStorage
            const selectedThemes = JSON.parse(localStorage.getItem('selectedThemes')) || [];
            if (selectedThemes.length === 0) {
                throw new Error('Aucun thème sélectionné');
            }
    
            // Charger l’index des cas
            const response = await fetch('data/case-index.json');
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            const caseIndex = await response.json();
    
            // Filtrer les fichiers pour les thèmes sélectionnés (insensible à la casse)
            let caseFiles = [];
            console.log('Selected themes:', selectedThemes);
            selectedThemes.forEach(theme => {
                const themeLower = theme.toLowerCase(); // Convertir en minuscules
                if (caseIndex[themeLower]) {
                    caseFiles = caseFiles.concat(caseIndex[themeLower]);
                }
            });
            console.log('Case files found:', caseFiles);
    
            if (caseFiles.length === 0) {
                throw new Error('Aucun cas disponible pour les thèmes sélectionnés');
            }
    
            // Charger les données de chaque fichier
            const casesPromises = caseFiles.map(file =>
                fetch(`data/${file}`)
                    .then(res => {
                        if (!res.ok) throw new Error(`Fichier ${file} introuvable`);
                        return res.json();
                    })
            );
            const cases = await Promise.all(casesPromises);
            console.log('Cas chargés :', cases);
            return cases;
        } catch (error) {
            console.error('Erreur lors du chargement des cas :', error);
            alert('Erreur lors du chargement des cas cliniques : ' + error.message);
            return [];
        }
    }

    function displayValue(element, value) {
        console.log("Checking element availability:", element);
        element.textContent = value;
    }

   function loadCase() {
        timeLeft = 150; // Réinitialiser le temps à 2 minutes 30
        displayTime(timeLeft);
        clearInterval(timerInterval); // Effacer l'ancien intervalle
        timerInterval = setInterval(updateTimer, 1000); // Démarrer le minuteur

        if (cases.length === 0) {
            alert('Aucun cas clinique trouvé.');
            return;
        }

        let playedCases = getCookie('playedCases');
        playedCases = playedCases ? playedCases.split(',') : [];

        // Sélection aléatoire d’un cas non joué
        let availableCases = cases.filter(caseItem => !playedCases.includes(caseItem.id));

        if (availableCases.length === 0) {
            alert('Tous les cas ont été joués !');
            return;
        }

        currentCase = availableCases[Math.floor(Math.random() * availableCases.length)];
        currentCaseIndex = cases.indexOf(currentCase);

        displayValue(document.getElementById('patient-nom'), currentCase.patient.nom);
        displayValue(document.getElementById('patient-prenom'), currentCase.patient.prenom);
        displayValue(document.getElementById('patient-age'), currentCase.patient.age);
        displayValue(document.getElementById('patient-sexe'), currentCase.patient.sexe);
        displayValue(document.getElementById('patient-taille'), currentCase.patient.taille);
        displayValue(document.getElementById('patient-poids'), currentCase.patient.poids);
        displayValue(document.getElementById('patient-groupeSanguin'), currentCase.patient.groupeSanguin);
        displayValue(motifHospitalisation, currentCase.interrogatoire.motifHospitalisation);
        displayValue(activitePhysique, currentCase.interrogatoire.modeDeVie.activitePhysique.description);
        displayValue(tabac, `${currentCase.interrogatoire.modeDeVie.tabac.quantite} depuis ${currentCase.interrogatoire.modeDeVie.tabac.duree}`);
        displayValue(alcool, currentCase.interrogatoire.modeDeVie.alcool.quantite);
        displayValue(alimentation, `${currentCase.interrogatoire.modeDeVie.alimentation.regime}, ${currentCase.interrogatoire.modeDeVie.alimentation.particularites}`);
        displayValue(emploi, `${currentCase.interrogatoire.modeDeVie.emploi.profession}, stress: ${currentCase.interrogatoire.modeDeVie.emploi.stress}`);
        antecedentsMedicaux.innerHTML = '<ul>' + currentCase.interrogatoire.antecedents.medicaux.map(ant => `<li>${ant.type} (${ant.traitement})</li>`).join('') + '</ul>';
        antecedentsChirurgicaux.innerHTML = '<ul>' + currentCase.interrogatoire.antecedents.chirurgicaux.map(ant => `<li>${ant.intervention} (${ant.date})</li>`).join('') + '</ul>';
        antecedentsFamiliaux.innerHTML = '<ul>' + currentCase.interrogatoire.antecedents.familiaux.map(ant => `<li>${ant.lien}: ${ant.pathologie} (${ant.age} ans)</li>`).join('') + '</ul>';
        traitementsListe.textContent = currentCase.interrogatoire.traitements.map(trait => `${trait.nom} ${trait.dose} (${trait.frequence})`).join(', ');
        allergiesListe.textContent = currentCase.interrogatoire.allergies.presence ? currentCase.interrogatoire.allergies.liste.map(allergie => `${allergie.allergene} (${allergie.reaction})`).join(', ') : 'Aucune';
        displayValue(debutSymptomes, currentCase.interrogatoire.histoireMaladie.debutSymptomes);
        displayValue(evolution, currentCase.interrogatoire.histoireMaladie.evolution);
        displayValue(facteursDeclenchants, currentCase.interrogatoire.histoireMaladie.facteursDeclenchants);
        displayValue(symptomesAssocies, currentCase.interrogatoire.histoireMaladie.symptomesAssocies.join(', '));
        displayValue( remarques, currentCase.interrogatoire.histoireMaladie. remarques);
        displayValue(tension, currentCase.examenClinique.constantes.tension);
        displayValue(pouls, currentCase.examenClinique.constantes.pouls);
        displayValue(temperature, currentCase.examenClinique.constantes.temperature);
        displayValue(saturationO2, currentCase.examenClinique.constantes.saturationO2);
        displayValue(frequenceRespiratoire, currentCase.examenClinique.constantes.frequenceRespiratoire);
        displayValue(aspectGeneral, currentCase.examenClinique.aspectGeneral);
        displayValue(examenCardiovasculaire, currentCase.examenClinique.examenCardiovasculaire.auscultation);
        displayValue(examenPulmonaire, currentCase.examenClinique.examenPulmonaire.auscultation);
        displayValue(examenAbdominal, currentCase.examenClinique.examenAbdominal.palpation);
        displayValue(examenNeurologique, currentCase.examenClinique.examenNeurologique.conscience);

        examensResults.innerHTML = '';

        // Vider la liste des diagnostics possibles
        const diagnosticSelect = document.getElementById('diagnostic-select');
        diagnosticSelect.innerHTML = '<option value="">Sélectionnez un diagnostic</option>';

        // Remplir la liste avec les diagnostics possibles du cas courant
        if (currentCase.possibleDiagnostics && Array.isArray(currentCase.possibleDiagnostics)) {
            currentCase.possibleDiagnostics.forEach(diagnostic => {
                const option = document.createElement('option');
                option.value = diagnostic;
                option.textContent = diagnostic;
                diagnosticSelect.appendChild(option);
            });
        }

        // Générer dynamiquement les boutons d'examens pour ce cas
        const examensSection = document.getElementById('examens');
        const examCategoriesDiv = examensSection.querySelector('.exam-categories');

        // Vider les catégories d'examens existantes
        examCategoriesDiv.innerHTML = '';

        // Vérifier si le cas a des examens disponibles
        if (currentCase.availableExams && Array.isArray(currentCase.availableExams) && currentCase.availableExams.length > 0) {
            // Créez une seule catégorie pour tous les examens disponibles
            const examCategoryDiv = document.createElement('div');
            examCategoryDiv.className = 'exam-category';
            examCategoryDiv.innerHTML = '<h3>Examens disponibles</h3>';

            const examButtonsDiv = document.createElement('div');
            examButtonsDiv.className = 'exam-buttons';

            // Générer un bouton pour chaque examen disponible
            currentCase.availableExams.forEach(exam => {
                const button = document.createElement('button');
                button.className = 'exam-btn';
                button.dataset.exam = exam;
                button.textContent = exam;
                button.addEventListener('click', function() {
                    this.classList.toggle('selected');
                });
                examButtonsDiv.appendChild(button);
            });

            examCategoryDiv.appendChild(examButtonsDiv);
            examCategoriesDiv.appendChild(examCategoryDiv);
        } else {
            // Si aucun examen disponible, afficher un message
            examCategoriesDiv.innerHTML = '<p>Aucun examen disponible pour ce cas.</p>';
        }

        // Afficher les traitements disponibles
        const availableTreatments = document.getElementById('availableTreatments');
        availableTreatments.innerHTML = ''; // Vider la liste précédente

        const availableTreatmentsTitle = document.createElement('h3');
        availableTreatments.appendChild(availableTreatmentsTitle);

        if (currentCase.possibleTreatments && Array.isArray(currentCase.possibleTreatments)) {
            currentCase.possibleTreatments.forEach(traitement => {
                const button = document.createElement('button');
                button.textContent = traitement;
                button.dataset.traitement = traitement;
                button.addEventListener('click', handleTraitementClick);
                availableTreatments.appendChild(button);
            });
        }

        gsap.from(".medical-card", {
            duration: 1,
            y: 50,
            opacity: 0,
            stagger: 0.2,
            ease: "power2.out"
        });

        // Réinitialiser les traitements sélectionnés
        selectedTreatments = [];

        // Vider le feedback des traitements
        document.getElementById('treatment-feedback').textContent = '';


        scoreDisplay.textContent = '';
        feedbackDisplay.textContent = '';
        score = 0;
        attempts = 0; // Réinitialiser le nombre d'essais
    }

     function calculateScore() {
        let baseScore = currentCase.scoringRules.baseScore || 100;
        let attemptPenalty = currentCase.scoringRules.attemptPenalty || 10;
        return Math.max(0, baseScore - (attempts * attemptPenalty)); // Le score ne peut pas être négatif
    }

    function handleExamenClick(event) {
        const examen = event.target.dataset.examen;
        const result = currentCase.examResults[examen] || "Résultat non disponible";
        alert(`${examen}: ${typeof result === 'object' ? JSON.stringify(result) : result}`);
    }

function handleTraitementClick(event) {
        const traitement = event.target.dataset.traitement;
        if (selectedTreatments.includes(traitement)) {
            selectedTreatments = selectedTreatments.filter(t => t !== traitement);
            event.target.classList.remove('selected');
        } else {
            selectedTreatments.push(traitement);
            event.target.classList.add('selected');
        }
    }

document.getElementById('validate-traitement').addEventListener('click', () => {
    attempts++;
    const correctTreatments = currentCase.correctTreatments;
    const selectedDiagnostic = document.getElementById('diagnostic-select').value;
    const correctDiagnostic = currentCase.correctDiagnostic;

    const allCorrectSelected = correctTreatments.every(t => selectedTreatments.includes(t));

    if (selectedDiagnostic === correctDiagnostic && allCorrectSelected && selectedTreatments.length === correctTreatments.length) {
        score = calculateScore();
        feedbackDisplay.textContent = 'Diagnostic et traitement corrects !';

        // Ajout des feux d'artifice
        const container = document.querySelector('#fireworks-container');
        const fireworks = new Fireworks(container, {
            duration: 3, // Durée de l'animation en secondes
        });

        // Sauvegarde de l'élément audio pour le réutiliser plus tard
        const backgroundMusic = document.querySelector('audio');
        backgroundMusic.pause();

        // Lecture du son de succès
        const successSound = new Audio('assets/sounds/feux_artifice.mp3');
        successSound.play();

        fireworks.start();
        // Fin de l'ajout des feux d'artifice

        // Arrêt des feux d'artifice et chargement d'un nouveau cas après 3 secondes
        setTimeout(() => {
            fireworks.stop();
            loadCase();
            // Reprise de la musique de fond après le chargement du nouveau cas
            backgroundMusic.play();
        }, 3000);

        scoreDisplay.textContent = `Score final: ${score}`;
        document.getElementById('treatment-feedback').textContent = '';

        // Mise à jour du cookie
        let playedCases = getCookie('playedCases');
        playedCases = playedCases ? playedCases.split(',') : [];
        playedCases.push(currentCase.id);
        setCookie('playedCases', playedCases.join(','), 365);

    } else {
        let feedback = '';
        if (selectedDiagnostic !== correctDiagnostic) {
            feedback += 'Diagnostic incorrect. ';
            feedbackDisplay.textContent = feedback;
        }

        const allTreatmentsCorrect = correctTreatments.every(t => selectedTreatments.includes(t));

        if (!allTreatmentsCorrect || selectedTreatments.length !== correctTreatments.length) {
            feedback += "Traitement incorrect ou incomplet.";
            document.getElementById('treatment-feedback').textContent = feedback;

            const incorrectSound = new Audio('assets/sounds/wrong buzzer.mp3');
            incorrectSound.play();
        }
    }

    // Gestion des classes CSS pour les boutons de traitement
    const treatmentButtons = document.querySelectorAll('#availableTreatments button');
    treatmentButtons.forEach(button => {
        const traitement = button.dataset.traitement;
        button.classList.remove('correct-treatment', 'incorrect-treatment'); // Retirer les classes précédentes

        if (correctTreatments.includes(traitement)) {
            if (selectedTreatments.includes(traitement)) {
                button.classList.add('correct-treatment'); // Vert si correct et sélectionné
            }
        } else {
            if (selectedTreatments.includes(traitement)) {
                button.classList.add('incorrect-treatment'); // Rouge si incorrect et sélectionné
            }
        }
    });
});

    // La gestion des boutons d'examens est maintenant faite dynamiquement dans loadCase()

    document.getElementById('validate-exams').addEventListener('click', () => {
        const selectedExamButtons = document.querySelectorAll('.exam-btn.selected');
        const selectedExams = Array.from(selectedExamButtons).map(btn => btn.dataset.exam);

        if (selectedExams.length === 0) {
            alert('Veuillez sélectionner au moins un examen.');
            return;
        }

        // Afficher les résultats avec un délai simulé
        examensResults.innerHTML = '<div class="loading">Analyse des examens en cours...</div>';

        setTimeout(() => {
            examensResults.innerHTML = '<h4>Résultats des examens complémentaires :</h4>';

            selectedExams.forEach(exam => {
                const result = currentCase.examResults[exam] || "Résultat non disponible";
                const resultDiv = document.createElement('div');
                resultDiv.className = 'exam-result-item';
                resultDiv.innerHTML = `<strong>${exam}:</strong> ${typeof result === 'object' ? JSON.stringify(result) : result}`;
                examensResults.appendChild(resultDiv);
            });

            // Jouer le son d'examen
            const examSound = new Audio('assets/sounds/bip.m4a');
            examSound.play();

        }, 1500); // Délai de 1.5 secondes pour simuler le temps d'analyse
    });

    function handleShowResultClick(event) {
       const examen = event.target.dataset.examen;
        // Simuler un délai avant d'afficher le résultat
        const examSound = new Audio('assets/sounds/bip.m4a');
        examSound.play();

        setTimeout(() => {
            const result = currentCase.examResults[examen] || "Résultat non disponible";
            const resultDiv = document.createElement('div');
            resultDiv.innerHTML = `<strong>${examen}:</strong> ${typeof result === 'object' ? JSON.stringify(result) : result}`;
            examensResults.appendChild(resultDiv);
        }, 1000); // Délai de 1 seconde
    }

     validateDiagnosticButton.addEventListener('click', () => {
        attempts++;
        const selectedDiagnostic = document.getElementById('diagnostic-select').value;
        const correctDiagnostic = currentCase.correctDiagnostic;

        if (selectedDiagnostic !== correctDiagnostic) {
            feedbackDisplay.textContent = 'Diagnostic incorrect. Essayez encore.';
        }
         else {
            feedbackDisplay.textContent = 'Diagnostic correct !';
         }
    });

    nextCaseButton.addEventListener('click', () => {
        currentCaseIndex = (currentCaseIndex + 1) % cases.length;
        loadCase();
    });

    async function initializeGame() {
        cases = await loadCasesData();
        if (cases.length > 0) {
            loadCase();
        }
        displayTime(timeLeft);
        clearInterval(timerInterval); // Effacer l'ancien intervalle
        timerInterval = setInterval(updateTimer, 1000); // Démarrer le minuteur
    }
    
    examensResults.innerHTML = '';
    initializeGame();
});
