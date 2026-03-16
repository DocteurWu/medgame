// Y'a qql qui va lire le code ?? si oui veuillez me contacter sur discord : docteur_wu
// Utilities (showNotification, escapeHtml, parseMarkdown, cookies, etc.) moved to js/utils.js

// ==================== IMMERSIVE HELPERS ====================

/**
 * Animer une transition de section avec fade/slide
 */
function animateSectionTransition(fromSection, toSection) {
    if (!fromSection || !toSection) return;
    
    // Add leaving animation
    fromSection.classList.add('leaving');
    
    setTimeout(() => {
        fromSection.classList.remove('active', 'mobile-active', 'leaving');
        toSection.classList.add('active', 'entering');
        
        setTimeout(() => {
            toSection.classList.remove('entering');
        }, 600);
    }, 300);
}

/**
 * Animer les cartes médicales avec stagger
 */
function animateCards(container) {
    if (!container) return;
    const cards = container.querySelectorAll('.medical-card');
    cards.forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        setTimeout(() => {
            card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 80 + i * 100);
    });
}

/**
 * Afficher un popup de score flottant
 */
function showScorePopup(element, value, isPositive) {
    if (!element) return;
    const popup = document.createElement('div');
    popup.className = `score-popup ${isPositive ? 'positive' : 'negative'}`;
    popup.textContent = isPositive ? `+${value}` : `${value}`;
    
    const rect = element.getBoundingClientRect();
    popup.style.position = 'fixed';
    popup.style.left = `${rect.left + rect.width / 2}px`;
    popup.style.top = `${rect.top}px`;
    popup.style.transform = 'translateX(-50%)';
    
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 1200);
}

/**
 * Ajouter feedback visuel sur un élément
 */
function addVisualFeedback(element, type) {
    if (!element) return;
    const className = type === 'correct' ? 'feedback-correct' : 'feedback-incorrect';
    element.classList.add(className);
    setTimeout(() => element.classList.remove(className), 800);
}

/**
 * Mettre à jour l'état visuel du timer
 */
function updateTimerVisualState() {
    const timerEls = document.querySelectorAll('.timer-display');
    timerEls.forEach(el => {
        el.classList.remove('warning', 'critical');
        if (timerState.timeLeft <= 30) {
            el.classList.add('critical');
        } else if (timerState.timeLeft <= 120) {
            el.classList.add('warning');
        }
    });
}

/**
 * Wrapper pour jouer un son de façon sûre
 */
function playSound(name) {
    if (typeof MedGameAudio !== 'undefined') {
        MedGameAudio.play(name);
    }
}

// Safe DOMContentLoaded wrapper — works even if script loads after DOM is ready
function onDomReady(fn) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(fn, 0);
    } else {
        document.addEventListener('DOMContentLoaded', fn);
    }
}

onDomReady(async () => {
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
    const remarques = document.getElementById('remarques');
    const tension = document.getElementById('tension');
    const pouls = document.getElementById('pouls');
    const temperature = document.getElementById('temperature');
    const saturationO2 = document.getElementById('saturationO2');
    const frequenceRespiratoire = document.getElementById('frequenceRespiratoire');
    const aspectGeneral = document.getElementById('aspectGeneral');
    const examensResults = document.getElementById('examens-results');
    const validateExamsButton = document.getElementById('validate-exams');
    const scoreDisplay = document.getElementById('score');
    const feedbackDisplay = document.getElementById('feedback');
    const nextCaseButton = document.getElementById('next-case');

    // Use gameState for centralized state management
    // Variables moved to gameState: cases, currentCaseIndex, currentCase, score, activeExams, vitalMonitorInstance
    
    // selectedTreatments & attempts now in scoringState (scoring.js)
    // timeLeft & timerInterval now in timerState (timer.js)
    timerState.onTimeUp = () => {
        const t = timerState.currentCase;
        const defaultText = t && t.correctDiagnostic ? `Diagnostic optimal: ${t.correctDiagnostic}\nTraitements optimaux: ${(t.correctTreatments || []).join(', ')}` : '';
        showCorrectionModal(t && t.correction ? t.correction : defaultText);
    };

    // Urgence mode moved to js/urgenceMode.js

    // Lock system moved to js/lockSystem.js
    initLockSystem();
    lockSystem.onLoadCase = (isPartial) => loadCase(isPartial);

    // UI functions moved to js/ui.js
    initUI();
    uiState.onCorrectionNext = () => {
        if (uiState.fireworksInstance) uiState.fireworksInstance.stop();
        if (uiState.backgroundMusicEl) uiState.backgroundMusicEl.play();
            window.location.href = 'index.html';
            return;
        }
        loadCase();
    };

    // loadCasesData moved to js/caseLoader.js (global)

    // displayValue, displayQuestionBtn, revealAllInterrogatoire moved to js/ui.js

    // parseBP, parseNum, VitalSignsMonitor class moved to js/vitalSigns.js

    function mountVitalMonitorAtConstants() {
        const sidebarScope = document.getElementById('sidebar-scope');
        if (!sidebarScope) return;

        // Create or get the specific mount point for the monitor
        let mountPoint = document.getElementById('vital-monitor-mount');
        if (!mountPoint) {
            mountPoint = document.createElement('div');
            mountPoint.id = 'vital-monitor-mount';
            mountPoint.style.width = '100%';
            mountPoint.style.height = '100%';
            sidebarScope.appendChild(mountPoint);
        }

        // On mobile, we also have an overlay mount point
        const mobileMount = document.getElementById('mobile-monitor-mount');
        if (mobileMount) {
            // If the overlay is active, we might want to prioritize it or clone?
            // Realistically, the monitor should be where it's visible.
        }

        // Get values from the hidden spans
        const tension = document.getElementById('tension');
        const pouls = document.getElementById('pouls');
        const saturationO2 = document.getElementById('saturationO2');
        const temperature = document.getElementById('temperature');
        const frequenceRespiratoire = document.getElementById('frequenceRespiratoire');

        const text = {
            bp: tension ? tension.textContent : '',
            hr: pouls ? pouls.textContent : '',
            spo2: saturationO2 ? saturationO2.textContent : '',
            temp: temperature ? temperature.textContent : '',
            resp: frequenceRespiratoire ? frequenceRespiratoire.textContent : ''
        };

        const bp = parseBP(text.bp);
        const monitorProps = {
            systolic: bp.systolic,
            diastolic: bp.diastolic,
            heartRate: parseNum(text.hr) || 72,
            spo2: parseNum(text.spo2) || 98,
            temperature: parseNum(text.temp) || 36.6,
            respiratoryRate: parseNum(text.resp) || 16
        };

        if (gameState.vitalMonitorInstance) {
            gameState.vitalMonitorInstance.stopVitalUpdates();
            mountPoint.innerHTML = '';
        }

        const ecgH = 70;
        const spo2H = 35;

        gameState.vitalMonitorInstance = new VitalSignsMonitor(monitorProps, { ecgH, spo2H });
        urgenceState.vitalMonitorInstance = gameState.vitalMonitorInstance;
        gameState.vitalMonitorInstance.mount(mountPoint);
    }

    function loadCase(isPartialRefresh = false) {
        // Prepare time but don't start timer yet
        if (!isPartialRefresh) {
            timerState.timeLeft = getTimeLimit();
            displayTime(timerState.timeLeft);
            if (timerState.timerInterval) clearInterval(timerState.timerInterval);
            // Reset the "Tout afficher" button for the new case
            const revealBtn = document.getElementById('btn-reveal-all');
            if (revealBtn) revealBtn.style.display = '';
            
        } else {
            // If partial refresh, we must be careful with NurseIntro
            if (typeof NurseIntro !== 'undefined') {
                // If we don't want the nurse to finish her previous talk and trigger callbacks
                // we could potentially clear her callback here, but NurseIntro doesn't expose a way to clear it 
                // easily without hiding her.
            }
        }

        if (gameState.cases.length === 0) {
            showNotification('Aucun cas clinique trouvé.');
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const isPreview = urlParams.get('preview') === 'true';

        if (!isPartialRefresh) {
            // Reset urgence state for the new case
            if (typeof resetUrgenceState === 'function') resetUrgenceState();

            // Reset skill cards for new case
            if (typeof skillCards !== 'undefined') skillCards.resetForNewCase();

            gameState.setCase(gameState.currentCaseIndex);
        }

        const currentCase = gameState.currentCase;

        // === MOTEUR DE JEU DYNAMIQUE : Initialiser le mode urgence si gameplayConfig.startNode existe ===
        initUrgenceMode(currentCase);

        displayValue(document.getElementById('patient-nom'), currentCase.patient.nom, 'patient.nom');
        displayValue(document.getElementById('patient-prenom'), currentCase.patient.prenom, 'patient.prenom');
        displayValue(document.getElementById('patient-age'), currentCase.patient.age, 'patient.age');
        displayValue(document.getElementById('patient-sexe'), currentCase.patient.sexe, 'patient.sexe');
        displayValue(document.getElementById('patient-taille'), currentCase.patient.taille, 'patient.taille');
        displayValue(document.getElementById('patient-poids'), currentCase.patient.poids, 'patient.poids');
        displayValue(document.getElementById('patient-groupeSanguin'), currentCase.patient.groupeSanguin, 'patient.groupeSanguin');

        // Update sidebar patient mini-card
        const patientNomSidebar = document.getElementById('patient-nom-sidebar');
        const patientAgeSidebar = document.getElementById('patient-age-sidebar');
        const patientSexeSidebar = document.getElementById('patient-sexe-sidebar');
        const patientInitials = document.getElementById('patient-initials');

        if (patientNomSidebar) patientNomSidebar.textContent = `${currentCase.patient.prenom} ${currentCase.patient.nom}`;
        if (patientAgeSidebar) patientAgeSidebar.textContent = currentCase.patient.age;
        if (patientSexeSidebar) patientSexeSidebar.textContent = currentCase.patient.sexe;
        if (patientInitials) {
            const initials = (currentCase.patient.prenom.charAt(0) + currentCase.patient.nom.charAt(0)).toUpperCase();
            patientInitials.textContent = initials;
        }

        displayValue(motifHospitalisation, currentCase.interrogatoire.motifHospitalisation, 'interrogatoire.motifHospitalisation');

        const immersionMode = sessionStorage.getItem('immersionMode') || 'classique';
        const revealAllBtn = document.getElementById('btn-reveal-all');

        if (immersionMode === 'classique') {
            // ===== MODE CLASSIQUE: tout affiché d'office =====
            if (revealAllBtn) revealAllBtn.style.display = 'none';

            displayValue(activitePhysique, currentCase.interrogatoire.modeDeVie.activitePhysique.description, 'interrogatoire.modeDeVie.activitePhysique.description');
            displayValue(tabac, `${currentCase.interrogatoire.modeDeVie.tabac.quantite} depuis ${currentCase.interrogatoire.modeDeVie.tabac.duree}`, 'interrogatoire.modeDeVie.tabac');
            displayValue(alcool, currentCase.interrogatoire.modeDeVie.alcool.quantite, 'interrogatoire.modeDeVie.alcool.quantite');
            displayValue(alimentation, `${currentCase.interrogatoire.modeDeVie.alimentation.regime}, ${currentCase.interrogatoire.modeDeVie.alimentation.particularites}`, 'interrogatoire.modeDeVie.alimentation');
            displayValue(emploi, `${currentCase.interrogatoire.modeDeVie.emploi.profession}, stress: ${currentCase.interrogatoire.modeDeVie.emploi.stress}`, 'interrogatoire.modeDeVie.emploi');

            if (isFieldLocked('interrogatoire.antecedents')) {
                const lock = getLockForField('interrogatoire.antecedents');
                const placeholder = `<div class="lock-placeholder" onclick="window.showLockChallenge('${lock.id}')"><i class="fas fa-lock"></i><span class="challenge-text">DÉFI À RELEVER</span></div>`;
                antecedentsMedicaux.innerHTML = placeholder;
                antecedentsChirurgicaux.innerHTML = '';
                antecedentsFamiliaux.innerHTML = '';
            } else {
                antecedentsMedicaux.innerHTML = '<ul>' + currentCase.interrogatoire.antecedents.medicaux.map(ant => `<li>${escapeHtml(ant.type)} (${escapeHtml(ant.traitement)})</li>`).join('') + '</ul>';
                antecedentsChirurgicaux.innerHTML = '<ul>' + currentCase.interrogatoire.antecedents.chirurgicaux.map(ant => `<li>${escapeHtml(ant.intervention)} (${escapeHtml(ant.date)})</li>`).join('') + '</ul>';
                antecedentsFamiliaux.innerHTML = '<ul>' + currentCase.interrogatoire.antecedents.familiaux.map(ant => `<li>${escapeHtml(ant.lien)}: ${escapeHtml(ant.pathologie)} (${escapeHtml(ant.age)} ans)</li>`).join('') + '</ul>';
            }

            const traitementsContainer = traitementsListe ? traitementsListe.closest('p') : null;
            if (isFieldLocked('interrogatoire.traitements')) {
                const lock = getLockForField('interrogatoire.traitements');
                traitementsListe.innerHTML = `<div class="lock-placeholder" onclick="window.showLockChallenge('${lock.id}')"><i class="fas fa-lock"></i><span class="challenge-text">DÉFI À RELEVER</span></div>`;
                if (traitementsContainer) traitementsContainer.style.display = '';
            } else {
                const hasTraitements = currentCase.interrogatoire.traitements && currentCase.interrogatoire.traitements.length > 0;
                if (hasTraitements) {
                    traitementsListe.textContent = currentCase.interrogatoire.traitements.map(trait => `${trait.nom} ${trait.dose} (${trait.frequence})`).join(', ');
                    if (traitementsContainer) traitementsContainer.style.display = '';
                } else {
                    if (traitementsContainer) traitementsContainer.style.display = 'none';
                }
            }

            const allergiesContainer = allergiesListe ? allergiesListe.closest('p') : null;
            const hasAllergies = currentCase.interrogatoire.allergies && currentCase.interrogatoire.allergies.presence && currentCase.interrogatoire.allergies.liste && currentCase.interrogatoire.allergies.liste.length > 0;
            if (hasAllergies) {
                allergiesListe.textContent = currentCase.interrogatoire.allergies.liste.map(allergie => `${allergie.allergene} (${allergie.reaction})`).join(', ');
                if (allergiesContainer) allergiesContainer.style.display = '';
            } else {
                if (allergiesContainer) allergiesContainer.style.display = 'none';
            }

            const hasTraitements = currentCase.interrogatoire.traitements && currentCase.interrogatoire.traitements.length > 0;
            const allergiesSubSection = allergiesListe ? allergiesListe.closest('.sub-section') : null;
            if (allergiesSubSection) {
                if (!hasAllergies && !hasTraitements && !isFieldLocked('interrogatoire.traitements')) {
                    allergiesSubSection.style.display = 'none';
                } else {
                    allergiesSubSection.style.display = '';
                }
            }

            displayValue(debutSymptomes, currentCase.interrogatoire.histoireMaladie.debutSymptomes, 'interrogatoire.histoireMaladie.debutSymptomes');
            displayValue(evolution, currentCase.interrogatoire.histoireMaladie.evolution, 'interrogatoire.histoireMaladie.evolution');
            displayValue(facteursDeclenchants, currentCase.interrogatoire.histoireMaladie.facteursDeclenchants, 'interrogatoire.histoireMaladie.facteursDeclenchants');

            const descriptionDouleur = document.getElementById('description-douleur');
            if (descriptionDouleur) {
                displayValue(descriptionDouleur, currentCase.interrogatoire.histoireMaladie.descriptionDouleur || '', 'interrogatoire.histoireMaladie.descriptionDouleur');
            }

            displayValue(symptomesAssocies, (currentCase.interrogatoire.histoireMaladie.symptomesAssocies || []).join(', '), 'interrogatoire.histoireMaladie.symptomesAssocies');
            displayValue(remarques, currentCase.interrogatoire.histoireMaladie.remarques, 'interrogatoire.histoireMaladie.remarques');

        } else {
            // ===== MODE IMMERSIF: questions interactives =====
            if (revealAllBtn) revealAllBtn.style.display = '';

            const activitePhysiqueData = currentCase.interrogatoire.modeDeVie && currentCase.interrogatoire.modeDeVie.activitePhysique ? currentCase.interrogatoire.modeDeVie.activitePhysique.description : '';
            displayQuestionBtn(activitePhysique, 'Faites-vous du sport ?', activitePhysiqueData, 'interrogatoire.modeDeVie.activitePhysique.description');

            const tabacQ = currentCase.interrogatoire.modeDeVie && currentCase.interrogatoire.modeDeVie.tabac ? `${currentCase.interrogatoire.modeDeVie.tabac.quantite} depuis ${currentCase.interrogatoire.modeDeVie.tabac.duree}` : '';
            displayQuestionBtn(tabac, 'Fumez-vous ?', tabacQ, 'interrogatoire.modeDeVie.tabac');

            const alcoolQ = currentCase.interrogatoire.modeDeVie && currentCase.interrogatoire.modeDeVie.alcool ? currentCase.interrogatoire.modeDeVie.alcool.quantite : '';
            displayQuestionBtn(alcool, 'Consommez-vous de l\'alcool ?', alcoolQ, 'interrogatoire.modeDeVie.alcool.quantite');

            const alimQ = currentCase.interrogatoire.modeDeVie && currentCase.interrogatoire.modeDeVie.alimentation ? `${currentCase.interrogatoire.modeDeVie.alimentation.regime}, ${currentCase.interrogatoire.modeDeVie.alimentation.particularites}` : '';
            displayQuestionBtn(alimentation, 'Avez-vous un régime alimentaire particulier ?', alimQ, 'interrogatoire.modeDeVie.alimentation');

            const emploiQ = currentCase.interrogatoire.modeDeVie && currentCase.interrogatoire.modeDeVie.emploi ? `${currentCase.interrogatoire.modeDeVie.emploi.profession}, stress: ${currentCase.interrogatoire.modeDeVie.emploi.stress}` : '';
            displayQuestionBtn(emploi, 'Quelle est votre profession ?', emploiQ, 'interrogatoire.modeDeVie.emploi');

            if (isFieldLocked('interrogatoire.antecedents')) {
                const lock = getLockForField('interrogatoire.antecedents');
                const placeholder = `<div class="lock-placeholder" onclick="window.showLockChallenge('${lock.id}')"><i class="fas fa-lock"></i><span class="challenge-text">DÉFI À RELEVER</span></div>`;
                antecedentsMedicaux.innerHTML = placeholder;
                antecedentsChirurgicaux.innerHTML = '';
                antecedentsFamiliaux.innerHTML = '';
            } else {
                let valMed = (currentCase.interrogatoire.antecedents && currentCase.interrogatoire.antecedents.medicaux && currentCase.interrogatoire.antecedents.medicaux.length) ? '<ul>' + currentCase.interrogatoire.antecedents.medicaux.map(ant => `<li>${escapeHtml(ant.type)} (${escapeHtml(ant.traitement)})</li>`).join('') + '</ul>' : '';
                displayQuestionBtn(antecedentsMedicaux, 'Avez-vous des maladies chroniques ou antécédents médicaux ?', valMed, 'interrogatoire.antecedents.medicaux', true);

                let valChir = (currentCase.interrogatoire.antecedents && currentCase.interrogatoire.antecedents.chirurgicaux && currentCase.interrogatoire.antecedents.chirurgicaux.length) ? '<ul>' + currentCase.interrogatoire.antecedents.chirurgicaux.map(ant => `<li>${escapeHtml(ant.intervention)} (${escapeHtml(ant.date)})</li>`).join('') + '</ul>' : '';
                displayQuestionBtn(antecedentsChirurgicaux, 'Avez-vous déjà été opéré(e) ?', valChir, 'interrogatoire.antecedents.chirurgicaux', true);

                let valFam = (currentCase.interrogatoire.antecedents && currentCase.interrogatoire.antecedents.familiaux && currentCase.interrogatoire.antecedents.familiaux.length) ? '<ul>' + currentCase.interrogatoire.antecedents.familiaux.map(ant => `<li>${escapeHtml(ant.lien)}: ${escapeHtml(ant.pathologie)} (${escapeHtml(ant.age)} ans)</li>`).join('') + '</ul>' : '';
                displayQuestionBtn(antecedentsFamiliaux, 'Y a-t-il des maladies particulières dans votre famille ?', valFam, 'interrogatoire.antecedents.familiaux', true);
            }

            const traitementsContainer = traitementsListe ? traitementsListe.closest('p') : null;
            if (traitementsContainer) traitementsContainer.style.display = '';

            if (isFieldLocked('interrogatoire.traitements')) {
                const lock = getLockForField('interrogatoire.traitements');
                traitementsListe.innerHTML = `<div class="lock-placeholder" onclick="window.showLockChallenge('${lock.id}')"><i class="fas fa-lock"></i><span class="challenge-text">DÉFI À RELEVER</span></div>`;
            } else {
                const hasTraitements = currentCase.interrogatoire.traitements && currentCase.interrogatoire.traitements.length > 0;
                let valTrait = hasTraitements ? currentCase.interrogatoire.traitements.map(trait => `${trait.nom} ${trait.dose} (${trait.frequence})`).join(', ') : '';
                displayQuestionBtn(traitementsListe, 'Prenez-vous un traitement médical actuellement ?', valTrait, 'interrogatoire.traitements');
            }

            const allergiesContainer = allergiesListe ? allergiesListe.closest('p') : null;
            if (allergiesContainer) allergiesContainer.style.display = '';

            const hasAllergies = currentCase.interrogatoire.allergies && currentCase.interrogatoire.allergies.presence && currentCase.interrogatoire.allergies.liste && currentCase.interrogatoire.allergies.liste.length > 0;
            let valAllergies = hasAllergies ? currentCase.interrogatoire.allergies.liste.map(allergie => `${allergie.allergene} (${allergie.reaction})`).join(', ') : '';
            displayQuestionBtn(allergiesListe, 'Avez-vous des allergies connues ?', valAllergies, 'interrogatoire.allergies');

            const allergiesSubSection = allergiesListe ? allergiesListe.closest('.sub-section') : null;
            if (allergiesSubSection) allergiesSubSection.style.display = '';

            const hm = currentCase.interrogatoire.histoireMaladie || {};
            displayQuestionBtn(debutSymptomes, 'Quand vos symptômes ont-ils commencé ?', hm.debutSymptomes, 'interrogatoire.histoireMaladie.debutSymptomes');
            displayQuestionBtn(evolution, 'Comment les symptômes évoluent-ils ?', hm.evolution, 'interrogatoire.histoireMaladie.evolution');
            displayQuestionBtn(facteursDeclenchants, 'Y a-t-il des facteurs qui déclenchent vos maux ?', hm.facteursDeclenchants, 'interrogatoire.histoireMaladie.facteursDeclenchants');

            const descriptionDouleur = document.getElementById('description-douleur');
            if (descriptionDouleur) {
                displayQuestionBtn(descriptionDouleur, 'Pouvez-vous décrire la douleur ?', hm.descriptionDouleur, 'interrogatoire.histoireMaladie.descriptionDouleur');
            }

            const valAssoc = (hm.symptomesAssocies && hm.symptomesAssocies.length) ? hm.symptomesAssocies.join(', ') : '';
            displayQuestionBtn(symptomesAssocies, 'Avez-vous d\'autres symptômes associés ?', valAssoc, 'interrogatoire.histoireMaladie.symptomesAssocies');
            displayQuestionBtn(remarques, 'Avez-vous d\'autres remarques ?', hm.remarques, 'interrogatoire.histoireMaladie.remarques');
        }

        // Display patient details (taille/poids/groupeSanguin) in visible section
        const patientTailleDisplay = document.getElementById('patient-taille-display');
        const patientPoidsDisplay = document.getElementById('patient-poids-display');
        const patientGroupeDisplay = document.getElementById('patient-groupe-display');
        if (patientTailleDisplay) patientTailleDisplay.textContent = currentCase.patient.taille || '--';
        if (patientPoidsDisplay) patientPoidsDisplay.textContent = currentCase.patient.poids || '--';
        if (patientGroupeDisplay) patientGroupeDisplay.textContent = currentCase.patient.groupeSanguin || '--';


        const verbatimContainer = document.getElementById('patient-verbatim-container');
        if (verbatimContainer) {
            if (currentCase.interrogatoire.verbatim) {
                verbatimContainer.style.display = 'flex';
                const path = 'interrogatoire.verbatim';
                if (isFieldLocked(path)) {
                    const lock = getLockForField(path);
                    verbatimContainer.innerHTML = `
                        <div class="lock-placeholder" onclick="window.showLockChallenge('${lock.id}')">
                            <i class="fas fa-lock"></i>
                            <span class="challenge-text">PAROLE BLOQUÉE : DÉFI À RELEVER</span>
                        </div>
                    `;
                } else {
                    verbatimContainer.innerHTML = `<div class="verbatim-text">"${escapeHtml(currentCase.interrogatoire.verbatim)}"</div>`;
                }
            } else {
                verbatimContainer.style.display = 'none';
            }
        }

        displayValue(tension, currentCase.examenClinique.constantes.tension, 'examenClinique.constantes.tension');
        displayValue(pouls, currentCase.examenClinique.constantes.pouls, 'examenClinique.constantes.pouls');
        displayValue(temperature, currentCase.examenClinique.constantes.temperature, 'examenClinique.constantes.temperature');
        displayValue(saturationO2, currentCase.examenClinique.constantes.saturationO2, 'examenClinique.constantes.saturationO2');
        displayValue(frequenceRespiratoire, currentCase.examenClinique.constantes.frequenceRespiratoire, 'examenClinique.constantes.frequenceRespiratoire');

        mountVitalMonitorAtConstants();
        displayValue(aspectGeneral, currentCase.examenClinique.aspectGeneral, 'examenClinique.aspectGeneral');

        // Dynamic rendering of clinical exam sections
        const examDetailsGrid = document.querySelector('.exam-details-grid');
        if (examDetailsGrid) {
            examDetailsGrid.innerHTML = ''; // Clear previous content
            const examenClinique = currentCase.examenClinique || {};
            const skipKeys = ['constantes', 'aspectGeneral']; // These are handled elsewhere

            for (const key of Object.keys(examenClinique)) {
                if (skipKeys.includes(key)) continue;
                const examData = examenClinique[key];
                const path = `examenClinique.${key}`;
                if (examData) {
                    if (isFieldLocked(path)) {
                        const lock = getLockForField(path);
                        examDetailsGrid.innerHTML += `
                            <div class="exam-item">
                                <h4><i class="fas fa-lock lock-icon"></i> ${key}</h4>
                                <div class="lock-placeholder" onclick="window.showLockChallenge('${lock.id}')">
                                    <i class="fas fa-puzzle-piece"></i>
                                    <span class="challenge-text">DÉFI À RELEVER</span>
                                </div>
                            </div>
                        `;
                    } else {
                        examDetailsGrid.innerHTML += renderExamSection(key, examData);
                    }
                }
            }
        }

        if (!isPartialRefresh) {
            examensResults.innerHTML = '';
            gameState.clearActiveExams();
        } else {
            renderExamResults();
        }

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
        const validateExamsBtn = document.getElementById('validate-exams');

        // Vider les catégories d'examens existantes
        examCategoriesDiv.innerHTML = '';

        if (isFieldLocked('examensComplementaires')) {
            const lock = getLockForField('examensComplementaires');
            examCategoriesDiv.innerHTML = `
                <div class="lock-placeholder section-lock" onclick="window.showLockChallenge('${lock.id}')" style="margin: 20px 0; padding: 40px; border-radius: 15px; background: rgba(0,0,0,0.3); border: 2px dashed var(--glass-border); flex-direction: column; cursor: pointer;">
                    <i class="fas fa-lock" style="font-size: 3rem; margin-bottom: 15px; color: var(--secondary-color);"></i>
                    <h3 style="margin-bottom: 10px;">SECTION VERROUILLÉE</h3>
                    <p>Relevez le défi sémiologique pour débloquer les prescriptions</p>
                    <button class="primary-btn" style="margin-top: 20px;">RELEVER LE DÉFI</button>
                </div>
            `;
            if (validateExamsBtn) validateExamsBtn.style.display = 'none';
        } else {
            if (validateExamsBtn) validateExamsBtn.style.display = 'block';
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
                    button.addEventListener('click', function () {
                        this.classList.toggle('selected');
                        playSound('select');
                    });
                    examButtonsDiv.appendChild(button);
                });

                examCategoryDiv.appendChild(examButtonsDiv);
                examCategoriesDiv.appendChild(examCategoryDiv);
            } else {
                // Si aucun examen disponible, afficher un message
                examCategoriesDiv.innerHTML = '<p>Aucun examen disponible pour ce cas.</p>';
            }
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
                button.setAttribute('aria-selected', 'false');
                button.setAttribute('role', 'button');
                button.addEventListener('click', (e) => {
                    handleTraitementClick(e);
                    playSound('click');
                });
                availableTreatments.appendChild(button);
            });
        }

        if (!isPartialRefresh) {
            gsap.from(".medical-card", {
                duration: 1,
                y: 50,
                opacity: 0,
                stagger: 0.2,
                ease: "power2.out"
            });
        }

        if (!isPartialRefresh) {
            // Réinitialiser les traitements sélectionnés
            scoringState.selectedTreatments = [];

            // Vider le feedback des traitements
            document.getElementById('treatment-feedback').textContent = '';

            scoreDisplay.textContent = '';
            feedbackDisplay.textContent = '';
            gameState.setScore(0);
            scoringState.attempts = 0; // Réinitialiser le nombre d'essais
        }

        // Masquer/afficher l'onglet Examens Complémentaires selon la disponibilité des examens
        updateExamsTabVisibility();

        if (!isPartialRefresh) {
            // Show nurse intro, then start the timer when dismissed
            NurseIntro.show(
                currentCase.patient,
                currentCase.interrogatoire.motifHospitalisation,
                () => {
                    // Start the timer only after nurse is dismissed
                    if (timerState.timerInterval) clearInterval(timerState.timerInterval);
                    timerState.timerInterval = setInterval(updateTimer, 1000);

                    if (urgenceState.isUrgenceMode && urgenceState.currentUrgenceNode) renderUrgenceState();
                }
            );
        } else if (urgenceState.isUrgenceMode && urgenceState.currentUrgenceNode) {
            renderUrgenceState();
        }
    }

    function updateExamsTabVisibility() {
        const currentCase = gameState.currentCase;
        const hasExams = currentCase && currentCase.availableExams && Array.isArray(currentCase.availableExams) && currentCase.availableExams.length > 0;

        // Urgence tab visibility (toujours basé sur urgenceState.isUrgenceMode, initialisé par initUrgenceMode)
        const navIntervention = document.getElementById('nav-intervention-rapide');
        const mobileIntervention = document.getElementById('mobile-tab-intervention');
        const showUrgence = urgenceState.isUrgenceMode;
        if (navIntervention) navIntervention.style.display = showUrgence ? '' : 'none';
        if (mobileIntervention) mobileIntervention.style.display = showUrgence ? '' : 'none';

        // Sidebar navigation - onglet Examens Compl.
        const sidebarExamTab = document.querySelector('.nav-item[data-target="section-examens"]');
        if (sidebarExamTab) {
            sidebarExamTab.style.display = hasExams ? '' : 'none';
        }

        // Mobile tabs navigation - onglet Exams
        const mobileExamTab = document.querySelector('.mobile-tab-item[data-tab="exams"]');
        if (mobileExamTab) {
            mobileExamTab.style.display = hasExams ? '' : 'none';
        }

        // La section elle-même
        const examSection = document.getElementById('section-examens');
        if (examSection) {
            examSection.style.display = hasExams ? '' : 'none';
        }
    }

    // calculateScore, handleTraitementClick, calculateDetailedScore, calculateXpEarned moved to js/scoring.js

    document.getElementById('validate-traitement').addEventListener('click', () => {
        const currentCase = gameState.currentCase;
        scoringState.attempts++;
        const attempts = scoringState.attempts;
        const selectedTreatments = scoringState.selectedTreatments;
        const correctTreatments = currentCase.correctTreatments;
        const selectedDiagnostic = document.getElementById('diagnostic-select').value;
        const correctDiagnostic = currentCase.correctDiagnostic;

        const allCorrectSelected = correctTreatments.every(t => selectedTreatments.includes(t));
        const isCorrect = selectedDiagnostic === correctDiagnostic && allCorrectSelected && selectedTreatments.length === correctTreatments.length;

        if (isCorrect) {
            gameState.setScore(calculateScore());
            feedbackDisplay.textContent = 'Diagnostic et traitement corrects !';
            scoreDisplay.textContent = `Score final: ${gameState.score}`;
            document.getElementById('treatment-feedback').textContent = '';
            
            // Immersive feedback
            playSound('correct');
            scoreDisplay.classList.add('score-up');
            addVisualFeedback(feedbackDisplay, 'correct');
            showScorePopup(scoreDisplay, gameState.score, true);

            // Arrêter les fireworks s'ils sont actifs (remplacé par étoiles dans le modal)
            if (uiState.fireworksInstance) {
                try { uiState.fireworksInstance.stop(); } catch(e) {}
            }

            // Arrêter la musique
            const backgroundMusic = document.querySelector('audio');
            if (backgroundMusic) backgroundMusic.pause();
        } else {
            let feedback = '';
            if (selectedDiagnostic !== correctDiagnostic) {
                feedback += 'Diagnostic incorrect. ';
                feedbackDisplay.textContent = feedback;
                addVisualFeedback(feedbackDisplay, 'incorrect');
            }

            const allTreatmentsCorrect = correctTreatments.every(t => selectedTreatments.includes(t));

            if (!allTreatmentsCorrect || selectedTreatments.length !== correctTreatments.length) {
                feedback += "Traitement incorrect ou incomplet.";
                document.getElementById('treatment-feedback').textContent = feedback;
            }

            // Immersive feedback for incorrect
            playSound('incorrect');
            scoreDisplay.classList.add('score-down');
            showScorePopup(scoreDisplay, 0, false);

            // Score remains 0 if incorrect
            scoreDisplay.textContent = `Score final: ${gameState.score}`;
        }

        // Gestion des classes CSS pour les boutons de traitement avec stagger
        const treatmentButtons = document.querySelectorAll('#availableTreatments button');
        treatmentButtons.forEach((button, idx) => {
            const traitement = button.dataset.traitement;
            button.classList.remove('correct-treatment', 'incorrect-treatment');

            if (correctTreatments.includes(traitement)) {
                if (selectedTreatments.includes(traitement)) {
                    setTimeout(() => {
                        button.classList.add('correct-treatment');
                        playSound('correct');
                    }, idx * 80);
                }
            } else {
                if (selectedTreatments.includes(traitement)) {
                    setTimeout(() => {
                        button.classList.add('incorrect-treatment');
                        playSound('incorrect');
                    }, idx * 80);
                }
            }
        });

        // Calculate percentage score
        let percentageScore = 0;
        const diagnosticWeight = 50; // 50% for diagnostic
        const treatmentWeight = 50; // 50% for treatments

        // Diagnostic score
        if (selectedDiagnostic === correctDiagnostic) {
            percentageScore += diagnosticWeight;
        }

        // --- FATAL ERROR CHECK ---
        const fatalTreatments = currentCase.fatalTreatments || [];
        const selectedFatalTreatments = selectedTreatments.filter(t => fatalTreatments.includes(t));
        const hasFatalError = selectedFatalTreatments.length > 0;

        // Treatment score
        if (correctTreatments.length > 0 && !hasFatalError) {
            const correctSelectedCount = selectedTreatments.filter(t => correctTreatments.includes(t)).length;
            const incorrectSelectedCount = selectedTreatments.filter(t => !correctTreatments.includes(t)).length;

            // Award points for correct treatments, penalize for incorrect ones
            // Max: if selected number exceeds correct 
            const treatmentPointsPerCorrect = treatmentWeight / Math.max(correctTreatments.length, selectedTreatments.length);
            percentageScore += correctSelectedCount * treatmentPointsPerCorrect;
        }
        // If fatal error: treatment portion stays at 0

        percentageScore = Math.max(0, Math.min(100, Math.round(percentageScore)));

        // --- TIME BONUS (up to +10%) ---
        const totalTime = getTimeLimit();
        const timeBonus = (timerState.timeLeft > 0)
            ? Math.round(10 * (timerState.timeLeft / totalTime))
            : 0;

        // --- ANTI-FARM: Calculate XP based on attempt number ---
        // Get attempt count for this case
        const caseAttemptsKey = `case_attempts_${currentCase.id}`;
        let caseAttempts = parseInt(localStorage.getItem(caseAttemptsKey)) || 0;
        caseAttempts++;
        localStorage.setItem(caseAttemptsKey, caseAttempts);

        // Calculate XP based on attempt number
        let xpEarned = 0;
        let xpMessage = '';

        if (caseAttempts === 1) {
            // First attempt: normal XP
            xpEarned = percentageScore + timeBonus;
            xpMessage = 'Première tentative - XP complet';
        } else if (caseAttempts === 2) {
            // Second attempt: average of both scores
            const previousScoreKey = `case_score_${currentCase.id}`;
            const previousScore = parseInt(localStorage.getItem(previousScoreKey)) || percentageScore;
            const averageScore = Math.round((previousScore + percentageScore) / 2);
            xpEarned = averageScore + timeBonus;
            xpMessage = `Deuxième tentative - Moyenne: ${averageScore}%`;
        } else {
            // Third+ attempt: no XP (anti-farm)
            xpEarned = 0;
            xpMessage = `Tentative #${caseAttempts} - Pas d'XP`;
        }

        // Save current score for future average calculation
        localStorage.setItem(`case_score_${currentCase.id}`, percentageScore);

        // Build color-coded comparison HTML
        const diagnosticCorrect = selectedDiagnostic === correctDiagnostic;
        const diagnosticUserStyle = diagnosticCorrect
            ? 'background: rgba(46, 204, 113, 0.3); padding: 5px; border-radius: 4px;'
            : 'background: rgba(231, 76, 60, 0.3); padding: 5px; border-radius: 4px;';

        // Build treatments list with color coding (escape treatment names to prevent XSS)
        let userTreatmentsHtml = '';
        if (selectedTreatments.length === 0) {
            userTreatmentsHtml = '<span style="background: rgba(231, 76, 60, 0.3); padding: 5px; border-radius: 4px;">Aucun</span>';
        } else {
            userTreatmentsHtml = selectedTreatments.map(t => {
                const isCorrect = correctTreatments.includes(t);
                const style = isCorrect
                    ? 'background: rgba(46, 204, 113, 0.3); padding: 3px 8px; border-radius: 4px; margin: 2px; display: inline-block;'
                    : 'background: rgba(231, 76, 60, 0.3); padding: 3px 8px; border-radius: 4px; margin: 2px; display: inline-block;';
                return `<span style="${style}">${escapeHtml(t)}</span>`;
            }).join(' ');
        }

        // Build expected treatments with highlighting for what was selected
        let expectedTreatmentsHtml = correctTreatments.map(t => {
            const wasSelected = selectedTreatments.includes(t);
            const style = wasSelected
                ? 'background: rgba(46, 204, 113, 0.3); padding: 3px 8px; border-radius: 4px; margin: 2px; display: inline-block;'
                : 'background: rgba(255, 193, 7, 0.3); padding: 3px 8px; border-radius: 4px; margin: 2px; display: inline-block;';
            return `<span style="${style}">${escapeHtml(t)}</span>`;
        }).join(' ');

        // Build fatal error banner if applicable
        const fatalBanner = hasFatalError ? `
            <div style="background: rgba(231,76,60,0.15); border: 2px solid #e74c3c; border-radius: 10px; padding: 15px; margin-bottom: 15px; text-align: center;">
                <div style="color: #e74c3c; font-size: 1.4em; font-weight: bold; margin-bottom: 6px;"><i class="fas fa-skull-crossbones"></i> ERREUR FATALE COMMISE</div>
                <p style="color: rgba(255,255,255,0.85); margin: 0;">Les traitements suivants sont contre-indiqués ou dangereux : <strong style="color:#e74c3c;">${escapeHtml(selectedFatalTreatments.join(', '))}</strong></p>
                <p style="color: rgba(255,255,255,0.6); font-size: 0.85em; margin-top: 6px;">Score de traitement annulé. En médecine, prescrire un soin contre-indiqué peut mettre la vie du patient en danger.</p>
            </div>
        ` : '';

        // Build time bonus display
        const timeBonusHtml = timeBonus > 0 ? `
            <div style="display:inline-block; background: rgba(79,172,254,0.15); border:1px solid rgba(79,172,254,0.4); border-radius:8px; padding: 4px 12px; margin-left: 10px; font-size:0.75em; color: #4facfe; vertical-align:middle;">
                <i class="fas fa-clock"></i> +${timeBonus} XP Bonus Temps
            </div>
        ` : '';

        // Calculate stars (0-3 based on performance)
        function calculateStars(score, hasFatalError, timeBonus) {
            if (hasFatalError) return 0;
            
            let stars = 0;
            
            // Score criterion (60% weight)
            if (score >= 80) stars += 2;
            else if (score >= 50) stars += 1;
            
            // Time bonus criterion (40% weight)
            if (timeBonus > 0) stars += 1;
            
            return Math.min(stars, 3);
        }
        
        const stars = calculateStars(percentageScore, hasFatalError, timeBonus);
        
        function renderStars(stars) {
            let html = '<div class="stars-display" style="display: flex; justify-content: center; gap: 10px; margin: 15px 0;">';
            for (let i = 1; i <= 3; i++) {
                if (i <= stars) {
                    html += '<i class="fas fa-star star-filled" style="font-size: 2rem; color: #ffc107; text-shadow: 0 0 15px rgba(255, 193, 7, 0.6);"></i>';
                } else {
                    html += '<i class="far fa-star star-empty" style="font-size: 2rem; color: rgba(255, 255, 255, 0.2);"></i>';
                }
            }
            html += '</div>';
            return html;
        }

        const comparisonHtml = `
            ${fatalBanner}
            <div class="correction-comparison" style="margin-bottom: 20px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                <div style="text-align: center; margin-bottom: 15px;">
                    ${renderStars(stars)}
                    <h3 style="color: ${percentageScore >= 50 ? '#2ecc71' : '#e74c3c'}; font-size: 2em; margin: 0;">
                        Score: ${percentageScore}% ${timeBonusHtml}
                    </h3>
                    <p style="color: rgba(255,255,255,0.6); font-size:0.85em; margin: 4px 0 0;">XP gagné : <strong style="color:#4facfe;">${xpEarned} XP</strong></p>
                    <p style="color: ${caseAttempts > 2 ? '#e74c3c' : 'rgba(255,255,255,0.5)'}; font-size:0.75em; margin-top: 5px;">
                        <i class="fas fa-info-circle"></i> ${escapeHtml(xpMessage)}
                    </p>
                </div>
                <div style="margin-bottom: 10px;">
                    <h4 style="color: #e74c3c; margin-bottom: 5px;">Votre Réponse</h4>
                    <p><strong>Diagnostic:</strong> <span style="${diagnosticUserStyle}">${escapeHtml(selectedDiagnostic || 'Aucun')}</span></p>
                    <p><strong>Traitements:</strong> ${userTreatmentsHtml}</p>
                </div>
                <div>
                    <h4 style="color: #2ecc71; margin-bottom: 5px;">Réponse Attendue</h4>
                    <p><strong>Diagnostic:</strong> ${escapeHtml(correctDiagnostic)}</p>
                    <p><strong>Traitements:</strong> ${expectedTreatmentsHtml}</p>
                    <p style="font-size: 0.9em; color: #aaa; margin-top: 5px;">
                        <span style="background: rgba(46, 204, 113, 0.3); padding: 2px 6px; border-radius: 3px;">Vert</span> = Correct | 
                        <span style="background: rgba(255, 193, 7, 0.3); padding: 2px 6px; border-radius: 3px;">Jaune</span> = Manquant | 
                        <span style="background: rgba(231, 76, 60, 0.3); padding: 2px 6px; border-radius: 3px;">Rouge</span> = Incorrect
                    </p>
                </div>
            </div>
            <hr style="border-color: rgba(255,255,255,0.1); margin: 20px 0;">
        `;

        // ALWAYS show correction and update cookie
        playSound('complete');
        startPostGameQuiz(comparisonHtml);

        // Mise à jour du cookie local
        let playedCases = getCookie('playedCases');
        playedCases = playedCases ? playedCases.split(',') : [];
        if (!playedCases.includes(currentCase.id)) {
            playedCases.push(currentCase.id);
            setCookie('playedCases', playedCases.join(','), 365);
        }

        // SUPABASE: Sauvegarde de la session de jeu et XP
        if (typeof supabase !== 'undefined') {
            supabase.auth.getUser().then(async ({ data: { user } }) => {
                if (user) {
                    try {
                        const stats = {
                            attempts: attempts,
                            caseAttempts: caseAttempts,  // Track how many times this case was attempted
                            diagnosticCorrect: diagnosticCorrect,
                            selectedTreatments: selectedTreatments,
                            hasFatalError: hasFatalError,
                            timeBonus: timeBonus,
                            xpEarned: xpEarned
                        };

                        // 1. Enregistrer la session
                        const { error: sessionError } = await supabase
                            .from('play_sessions')
                            .insert([
                                {
                                    user_id: user.id,
                                    case_id: currentCase.id,
                                    score: percentageScore,
                                    stats: stats
                                }
                            ]);
                        if (sessionError) throw sessionError;

                        // 2. Mettre à jour l'XP global (score + bonus de temps)
                        const { data: profile, error: profileErr } = await supabase
                            .from('profiles')
                            .select('total_xp')
                            .eq('id', user.id)
                            .single();

                        if (!profileErr && profile) {
                            const newXp = profile.total_xp + xpEarned;
                            await supabase
                                .from('profiles')
                                .update({ total_xp: newXp })
                                .eq('id', user.id);
                        }

                    } catch (err) {
                        console.error("Erreur lors de la sauvegarde Supabase :", err);
                    }
                }
            });
        }

        // === STREAK SYSTEM: Record win or loss ===
        if (typeof streakSystem !== 'undefined') {
            if (isCorrect && !hasFatalError) {
                const streakResult = streakSystem.recordWin(currentCase.id);
                // Apply streak multiplier to XP
                
                if (streakResult.milestone) {
                    showNotification(`${streakResult.milestone.icon} ${streakResult.milestone.label} — Streak de ${streakResult.newStreak} !`);
                }

                // === SKILL CARDS: Reward on streak milestones ===
                if (typeof skillCards !== 'undefined') {
                    skillCards.rewardStreak(streakResult.newStreak);
                }
            } else {
                streakSystem.recordLoss();
            }
        }

        // === EXAM MODE: Record result ===
            const timeSpent = getTimeLimit() - timerState.timeLeft;
        }
    });


    // La gestion des boutons d'examens est maintenant faite dynamiquement dans loadCase()

    function renderExamResults() {
        const currentCase = gameState.currentCase;
        if (gameState.activeExams.length === 0) return;

        if (isFieldLocked('examensComplementaires')) {
            examensResults.innerHTML = '<div class="lock-placeholder">Section verrouillée.</div>';
            return;
        }

        examensResults.innerHTML = '<h4>Résultats des examens complémentaires :</h4>';

        gameState.activeExams.forEach(exam => {
            const path = `examResults.${exam}`;
            const result = currentCase.examResults[exam] || "Résultat non disponible";
            const resultDiv = document.createElement('div');
            resultDiv.className = 'exam-result-item';

            if (isFieldLocked(path)) {
                const lock = getLockForField(path);
                resultDiv.innerHTML = `
                        <strong>${exam}:</strong>
                        <div class="lock-placeholder" onclick="window.showLockChallenge('${lock.id}')" style="display:inline-flex; padding:5px 15px; margin-left:10px;">
                            <i class="fas fa-lock" style="font-size:1rem;"></i>
                            <span class="challenge-text" style="font-size:0.8rem;">DÉFI À RELEVER</span>
                        </div>
                    `;
            } else {
                const isObj = typeof result === 'object' && result !== null;
                const text = isObj ? (result.value || result.text || JSON.stringify(result)) : result;
                resultDiv.innerHTML = `<strong>${escapeHtml(exam)}:</strong> ${escapeHtml(String(text))}`;
                if (isObj && result.image) {
                    const btn = document.createElement('button');
                    btn.innerHTML = '<i class="fas fa-image"></i> Voir l’imagerie';
                    btn.className = 'btn-add';
                    btn.style.marginLeft = '12px';
                    btn.style.padding = '4px 10px';
                    btn.style.fontSize = '0.8em';
                    btn.addEventListener('click', () => {
                        showImageModal(result.image, 'Résultat: ' + exam);
                    });
                    resultDiv.appendChild(btn);
                }
            }
            examensResults.appendChild(resultDiv);
        });
    }

    document.getElementById('validate-exams').addEventListener('click', () => {
        const selectedExamButtons = document.querySelectorAll('.exam-btn.selected');
        const selectedExams = Array.from(selectedExamButtons).map(btn => btn.dataset.exam);

        if (selectedExams.length === 0) {
            showNotification('Veuillez sélectionner au moins un examen.');
            playSound('alert');
            return;
        }
        
        playSound('click');

        // 120s in-game time deduction for any exams requested
        if (typeof window.deductTime === 'function') {
            const hasTime = window.deductTime(120);
            if (!hasTime) {
                showNotification('Temps in-game insuffisant (2 min requises).');
                return;
            }
        }

        // Afficher les résultats avec un délai simulé
        examensResults.innerHTML = '<div class="loading">Analyse des examens en cours... (Patientez environ 5 secondes)</div>';
        const validateBtn = document.getElementById('validate-exams');
        if (validateBtn) validateBtn.disabled = true;

        setTimeout(() => {
            gameState.activeExams = selectedExams;
            renderExamResults();
            if (validateBtn) validateBtn.disabled = false;

            // Jouer le son d'examen (if possible)
            try {
                // Not playing bip.m4a as it doesn't exist
            } catch (e) { }

        }, 5000); // Délai de 5 secondes pour simuler le vrai délai (coût de 2 min in-game)
    });

    // Sidebar Navigation Logic
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.game-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            playSound('click');
            
            // Remove active class from all items
            navItems.forEach(nav => nav.classList.remove('active'));
            // Add active class to clicked item
            item.classList.add('active');

            // Get current active section
            const currentSection = document.querySelector('.game-section.active');
            
            // Show target section
            const targetId = item.dataset.target;
            const targetSection = document.getElementById(targetId);
            
            if (targetSection && currentSection !== targetSection) {
                // Use animated transition
                animateSectionTransition(currentSection, targetSection);
                // Animate cards in new section
                setTimeout(() => animateCards(targetSection), 350);
            }
        });
    });

    // Validation is now handled solely by validate-traitement.

    nextCaseButton.addEventListener('click', () => {
        // === EXAM MODE: Check if exam is active ===
            }
        }

        if (!gameState.nextCase()) {
            window.location.href = 'index.html';
            return;
        }
        loadCase();
    });

    // --- MOBILE TABS LOGIC ---
    const mobileTabs = document.querySelectorAll('.mobile-tab-item');

    function switchMobileTab(tabId) {
        playSound('click');
        
        // Update tab buttons
        mobileTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });

        const sectionMap = {
            'anamnese': 'section-anamnese',
            'examen': 'section-examen-clinique',
            'exams': 'section-examens',
            'decision': 'section-synthese',
            'intervention-rapide': 'section-intervention-rapide'
        };

        // Get current active section
        const currentSection = document.querySelector('.game-section.mobile-active');
        const targetId = sectionMap[tabId];
        const targetSection = document.getElementById(targetId);
        
        // Hide all sections first
        sections.forEach(section => {
            section.classList.remove('active', 'mobile-active', 'entering', 'leaving');
        });

        if (targetSection) {
            targetSection.classList.add('mobile-active', 'entering');
            updateSidebarActive(targetId);
            animateCards(targetSection);
            
            setTimeout(() => {
                targetSection.classList.remove('entering');
            }, 500);
        }

        // Scroll to top
        document.querySelector('.content-scroll-area').scrollTop = 0;
    }

    function updateSidebarActive(targetId) {
        navItems.forEach(nav => {
            nav.classList.toggle('active', nav.dataset.target === targetId);
        });
    }

    mobileTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchMobileTab(tab.dataset.tab);
        });
        // Keyboard accessibility for mobile tabs
        tab.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                switchMobileTab(tab.dataset.tab);
            }
        });
    });

    // Keyboard accessibility for compact vitals (acts as button)
    const compactVitalsBtn = document.getElementById('compact-vitals');
    if (compactVitalsBtn) {
        compactVitalsBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                window.toggleMobileMonitor();
            }
        });
    }

    window.toggleMobileMonitor = () => {
        const overlay = document.getElementById('mobile-monitor-overlay');
        const isOpening = !overlay.classList.contains('active');
        overlay.classList.toggle('active');
        overlay.setAttribute('aria-hidden', !isOpening);

        // Update aria-expanded on the trigger button
        const compactVitals = document.getElementById('compact-vitals');
        if (compactVitals) compactVitals.setAttribute('aria-expanded', isOpening);

        if (isOpening) {
            // When opening overlay, move the monitor mount to the overlay
            const monitorMount = document.getElementById('vital-monitor-mount');
            const overlayMount = document.getElementById('mobile-monitor-mount');
            if (monitorMount && overlayMount) {
                overlayMount.appendChild(monitorMount);
                // Adjust size for overlay
                monitorMount.style.height = '300px';
            }
        } else {
            // When closing, move it back to the sidebar
            const monitorMount = document.getElementById('vital-monitor-mount');
            const sidebarScope = document.getElementById('sidebar-scope');
            if (monitorMount && sidebarScope) {
                sidebarScope.appendChild(monitorMount);
                monitorMount.style.height = '100%';
            }
        }
    };

    // Initial mobile view setup
    if (window.innerWidth <= 900) {
        switchMobileTab('anamnese');
    }

    async function initializeGame() {
        const loadingEl = document.createElement('div');
        loadingEl.id = 'game-loading';
        loadingEl.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:3rem;color:var(--primary-color);margin-bottom:15px;"></i><p>Chargement des cas cliniques...</p>';
        loadingEl.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;text-align:center;background:rgba(0,0,0,0.8);padding:30px 50px;border-radius:15px;backdrop-filter:blur(10px);border:1px solid rgba(0,242,254,0.2);';
        document.body.appendChild(loadingEl);
        
        const cases = await loadCasesData();
        gameState.setCases(cases);
        loadingEl.remove();
        
        // === STREAK SYSTEM: Initialize ===
        if (typeof streakSystem !== 'undefined') {
            streakSystem.init();
        }

        // === SKILL CARDS: Initialize ===
        if (typeof skillCards !== 'undefined') {
            skillCards.init();
        }

        // === EXAM MODE: Check if requested ===
            }
        }

        if (gameState.cases.length > 0) {
            showNotification(`Session démarrée : ${gameState.cases.length} cas chargé(s)`);
            playSound('reveal');
            loadCase();
        }
        displayTime(timerState.timeLeft);
    }

    examensResults.innerHTML = '';
    initializeGame();

    // --- SIDEBAR TOGGLE ---
    const sidebarToggle = document.getElementById('sidebar-toggle');
    // --- Post-Game Quiz System ---
    let currentQuizIndex = 0;
    let quizComparisonHtml = '';

    function startPostGameQuiz(comparisonHtml) {
        const currentCase = gameState.currentCase;
        if (!currentCase.postGameQuestions || currentCase.postGameQuestions.length === 0) {
            showCorrectionModal(comparisonHtml + (currentCase.correction || ''));
            return;
        }
        currentQuizIndex = 0;
        quizComparisonHtml = comparisonHtml;
        showPostGameQuestion(0);
    }

    function showPostGameQuestion(index) {
        const currentCase = gameState.currentCase;
        const question = currentCase.postGameQuestions[index];
        const modal = document.createElement('div');
        modal.className = 'correction-overlay lock-challenge-overlay';
        modal.id = 'quiz-modal';
        modal.style.display = 'flex';

        const isLast = index === currentCase.postGameQuestions.length - 1;
        let quizAttempts = 0;

        modal.innerHTML = `
            <div class="lock-modal" style="border-color: var(--primary-color); box-shadow: 0 0 30px rgba(160, 32, 240, 0.2);">
                <div style="font-size: 0.8rem; color: var(--primary-color); text-transform: uppercase; margin-bottom: 10px;">
                    Question post-jeu ${index + 1}/${currentCase.postGameQuestions.length}
                </div>
                <h3>DÉFI FINAL</h3>
                <div class="challenge-question">${question.challenge.question}</div>
                <div id="quiz-details-container"></div>
                <div class="error-feedback" id="quiz-error"></div>
                <button class="action-btn" id="quiz-submit-btn" style="background: var(--primary-color); color: white;">
                    ${isLast ? 'VOIR LA CORRECTION' : 'QUESTION SUIVANTE'}
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        const detailsContainer = modal.querySelector('#quiz-details-container');
        if (question.type === 'SAISIE') {
            detailsContainer.innerHTML = `<input type="text" id="quiz-input" placeholder="Votre réponse..." autocomplete="off">`;
            const input = detailsContainer.querySelector('#quiz-input');
            input.focus();
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') validateQuizAnswer();
            });
        } else {
            detailsContainer.innerHTML = `<div class="mcq-options">
                ${question.challenge.options.map((opt, i) => `
                    <div class="mcq-option" data-index="${i}">${opt}</div>
                `).join('')}
            </div>`;
            const options = detailsContainer.querySelectorAll('.mcq-option');
            options.forEach(opt => {
                opt.addEventListener('click', () => {
                    opt.classList.toggle('selected');
                    opt.style.borderColor = opt.classList.contains('selected') ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)';
                    opt.style.background = opt.classList.contains('selected') ? 'rgba(160, 32, 240, 0.1)' : 'rgba(255,255,255,0.05)';
                });
            });
        }

        modal.querySelector('#quiz-submit-btn').addEventListener('click', validateQuizAnswer);

        function validateQuizAnswer() {
            quizAttempts++;
            let isCorrect = false;
            if (question.type === 'SAISIE') {
                const val = document.getElementById('quiz-input').value;
                const answer = normalizeText(val);
                
                isCorrect = question.challenge.expected_keywords.some(kw => {
                    const normalizedKW = normalizeText(kw);
                    if (normalizedKW === answer || answer.includes(normalizedKW)) return true;
                    
                    const words = answer.split(/\s+/);
                    return words.some(word => isFuzzyMatch(word, normalizedKW));
                });
            } else {
                const selected = Array.from(detailsContainer.querySelectorAll('.mcq-option.selected')).map(opt => parseInt(opt.dataset.index));
                const correct = question.challenge.correct_indices || [];
                isCorrect = selected.length === correct.length && selected.every(idx => correct.includes(idx));
            }

            if (isCorrect) {
                modal.remove();
                if (isLast) {
                    showCorrectionModal(quizComparisonHtml + (currentCase.correction || ''));
                } else {
                    showPostGameQuestion(index + 1);
                }
            } else if (quizAttempts >= 3) {
                let correction = '';
                const corrIndices = question.type === 'QCM' ? (question.challenge.correct_indices || []) : [];

                if (question.type === 'SAISIE') {
                    correction = question.challenge.expected_keywords.join(', ');
                    const input = document.getElementById('quiz-input');
                    if (input) {
                        input.disabled = true;
                        input.style.opacity = '0.7';
                    }
                } else {
                    correction = corrIndices.map(idx => question.challenge.options[idx]).join(' + ');
                    // Highlight correct options and disable others
                    detailsContainer.querySelectorAll('.mcq-option').forEach(opt => {
                        const idx = parseInt(opt.dataset.index);
                        opt.style.pointerEvents = 'none';
                        if (corrIndices.includes(idx)) {
                            opt.style.borderColor = "#2ecc71";
                            opt.style.background = "rgba(46, 204, 113, 0.2)";
                        } else {
                            opt.style.opacity = '0.5';
                        }
                    });
                }

                const errorEl = document.getElementById('quiz-error');
                errorEl.innerHTML = `
                    <div class="correction-box" style="margin-top: 15px; padding: 15px; background: rgba(231, 76, 60, 0.1); border: 1px solid #e74c3c; border-radius: 8px; text-align: left;">
                        <div style="color: #e74c3c; font-weight: bold; margin-bottom: 5px;"><i class="fas fa-times-circle"></i> CORRECTION</div>
                        <div style="color: white; margin-bottom: 10px;">${escapeHtml(correction)}</div>
                        ${question.feedback_error ? `<div style="color: var(--text-muted); font-size: 0.9rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;"><strong>Indice :</strong> ${escapeHtml(question.feedback_error)}</div>` : ''}
                    </div>
                `;

                const btn = modal.querySelector('#quiz-submit-btn');
                btn.textContent = isLast ? 'VOIR LA CORRECTION' : 'QUESTION SUIVANTE';
                btn.style.background = '#2ecc71';

                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                newBtn.addEventListener('click', () => {
                    modal.remove();
                    if (isLast) {
                        showCorrectionModal(quizComparisonHtml + (currentCase.correction || ''));
                    } else {
                        showPostGameQuestion(index + 1);
                    }
                });
            } else {
                document.getElementById('quiz-error').innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${escapeHtml(question.feedback_error || 'Réponse incorrecte')}`;
                const btn = modal.querySelector('#quiz-submit-btn');
                btn.style.background = '#e74c3c';
                btn.textContent = 'RÉESSAYER';
                setTimeout(() => {
                    if (quizAttempts < 3) {
                        btn.style.background = 'var(--primary-color)';
                        btn.textContent = isLast ? 'VOIR LA CORRECTION' : 'QUESTION SUIVANTE';
                    }
                }, 1000);
            }
        }
    }

    // Urgence mode logic moved to js/urgenceMode.js
    // Sync urgence state with currentCase (done in loadCase)

    const appContainer = document.querySelector('.app-container');

    if (sidebarToggle && appContainer) {
        // Restore sidebar state from sessionStorage
        const sidebarCollapsed = sessionStorage.getItem('sidebarCollapsed') === 'true';
        if (sidebarCollapsed) {
            appContainer.classList.add('sidebar-collapsed');
        }

        sidebarToggle.addEventListener('click', () => {
            appContainer.classList.toggle('sidebar-collapsed');
            const isCollapsed = appContainer.classList.contains('sidebar-collapsed');
            sessionStorage.setItem('sidebarCollapsed', isCollapsed);
        });
    }

    // --- FULLSCREEN PROMPT LOGIC ---
    function showFullscreenPrompt() {
        if (document.getElementById('fullscreen-prompt') || document.fullscreenElement) return;

        const prompt = document.createElement('div');
        prompt.id = 'fullscreen-prompt';
        prompt.style.cssText = `
            position: fixed;
            bottom: 85px; /* Above mobile tabs */
            right: 15px;
            background: rgba(0, 242, 254, 0.8);
            color: #000;
            padding: 8px 12px;
            border-radius: 20px;
            cursor: pointer;
            z-index: 1000;
            font-family: 'Rajdhani', sans-serif;
            font-size: 0.75rem;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            gap: 8px;
            backdrop-filter: blur(5px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;
        prompt.innerHTML = '<i class="fas fa-expand"></i> PLEIN ÉCRAN';

        prompt.addEventListener('click', () => {
            document.documentElement.requestFullscreen().catch(() => {});
            prompt.remove();
        });

        document.body.appendChild(prompt);

        // Hide after 5 seconds
        setTimeout(() => {
            if (prompt.parentElement) {
                prompt.style.opacity = '0';
                prompt.style.transition = 'opacity 1s ease';
                setTimeout(() => prompt.remove(), 1000);
            }
        }, 5000);
    }

    document.addEventListener('fullscreenchange', () => {
        const existing = document.getElementById('fullscreen-prompt');
        if (document.fullscreenElement && existing) {
            existing.remove();
        } else if (!document.fullscreenElement) {
            showFullscreenPrompt();
        }
    });

    // Check on load
    showFullscreenPrompt();

    // --- KEYBOARD SHORTCUTS ---
    document.addEventListener('keydown', (e) => {
        // Ignore if user is typing in an input/select/textarea
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        // Ignore if correction modal is open
        const correctionOverlay = document.getElementById('correction-overlay');
        if (correctionOverlay && correctionOverlay.style.display === 'flex') return;
        // Ignore if image modal is open
        const imageOverlay = document.getElementById('image-overlay');
        if (imageOverlay && imageOverlay.style.display === 'flex') return;

        const navItems = Array.from(document.querySelectorAll('.nav-item:not([style*="display: none"])'));
        const activeIdx = navItems.findIndex(item => item.classList.contains('active'));

        if (e.key === 'ArrowRight') {
            e.preventDefault();
            const nextIdx = (activeIdx + 1) % navItems.length;
            if (navItems[nextIdx]) navItems[nextIdx].click();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const prevIdx = (activeIdx - 1 + navItems.length) % navItems.length;
            if (navItems[prevIdx]) navItems[prevIdx].click();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const btn = document.getElementById('validate-traitement');
            if (btn) btn.click();
        } else if (e.key === 'Escape') {
            // Close any open overlay/modal
            const imageOverlay = document.getElementById('image-overlay');
            if (imageOverlay && imageOverlay.style.display === 'flex') {
                if (typeof closeImageModal === 'function') closeImageModal();
                return;
            }
            const mobileMonitor = document.getElementById('mobile-monitor-overlay');
            if (mobileMonitor && mobileMonitor.classList.contains('active')) {
                if (window.toggleMobileMonitor) window.toggleMobileMonitor();
                return;
            }
            hideCorrectionModal();
        }
    });

    // --- QUIT CONFIRMATION ---
    const quitBtns = document.querySelectorAll('.quit-btn, a[href="index.html"]');
    quitBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const confirmMsg = 'Quitter la partie ? Votre progression non sauvegardée sera perdue.';
            if (confirm(confirmMsg)) {
                window.location.href = 'index.html';
            }
        });
    });
});
