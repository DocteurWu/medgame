/**
 * js/pse-ui.js — Contrôleur UI du Pousse-Seringue Électrique & Perfusion Lab
 */

import {
    DRUG_DATABASE,
    calculateFlowRate,
    calculateDeliveredDose,
    validatePseSafety,
    PSE_CLINICAL_CASES
} from './pse-engine.js';

document.addEventListener('DOMContentLoaded', () => {
    // État courant
    let currentDrugId = 'noradrenaline';
    let currentWeightKg = 70;
    let currentDilutionIndex = 0;
    let currentFlowRate = 6.75; // mL/h
    let isRunning = false;
    let currentRoute = 'VVP';
    let currentVolumeRemaining = 45.0; // mL

    // Éléments DOM
    const selectDrug = document.getElementById('select-drug');
    const selectDilution = document.getElementById('select-dilution');
    const inputWeight = document.getElementById('input-weight');
    const selectRoute = document.getElementById('select-route');
    const rangeTargetDose = document.getElementById('range-target-dose');
    const targetDoseDisplay = document.getElementById('target-dose-display');

    // Écran LCD
    const screenDrugTitle = document.getElementById('screen-drug-title');
    const screenRateVal = document.getElementById('screen-rate-val');
    const screenDoseDelivered = document.getElementById('screen-dose-delivered');
    const screenConcDisplay = document.getElementById('screen-conc-display');
    const screenVolumeRem = document.getElementById('screen-volume-rem');
    const syringeFluid = document.getElementById('syringe-fluid');

    // LEDs
    const ledRunning = document.getElementById('led-running');
    const ledStop = document.getElementById('led-stop');
    const ledAlarm = document.getElementById('led-alarm');
    const safetyBanner = document.getElementById('safety-banner');

    function getCurrentDilution() {
        const drug = DRUG_DATABASE[currentDrugId];
        return drug.dilutions[currentDilutionIndex] || drug.dilutions[0];
    }

    function refreshDrugOptions() {
        const drug = DRUG_DATABASE[currentDrugId];
        if (!drug) return;

        // Mettre à jour la liste des dilutions
        if (selectDilution) {
            selectDilution.innerHTML = '';
            drug.dilutions.forEach((d, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = d.label;
                selectDilution.appendChild(opt);
            });
            currentDilutionIndex = 0;
        }

        // Mettre à jour le curseur de dose cible
        if (rangeTargetDose) {
            rangeTargetDose.min = drug.minDose;
            rangeTargetDose.max = drug.maxDose;
            rangeTargetDose.step = drug.minDose < 0.1 ? '0.05' : '0.1';
            rangeTargetDose.value = drug.defaultDose;
        }

        // Auto-calculer le débit initial
        recalculateFlow();
    }

    function recalculateFlow() {
        const drug = DRUG_DATABASE[currentDrugId];
        const dilution = getCurrentDilution();
        const targetDose = parseFloat(rangeTargetDose ? rangeTargetDose.value : drug.defaultDose);

        currentFlowRate = calculateFlowRate(currentDrugId, targetDose, currentWeightKg, dilution.concMgMl);
        updateDisplay();
    }

    function updateDisplay() {
        const drug = DRUG_DATABASE[currentDrugId];
        const dilution = getCurrentDilution();

        // Écran LCD
        if (screenDrugTitle) screenDrugTitle.textContent = drug.name.toUpperCase();
        if (screenRateVal) screenRateVal.textContent = currentFlowRate.toFixed(2);
        
        const delivered = calculateDeliveredDose(currentDrugId, currentFlowRate, currentWeightKg, dilution.concMgMl);
        if (screenDoseDelivered) screenDoseDelivered.textContent = `${delivered} ${drug.baseUnitLabel}`;
        if (screenConcDisplay) screenConcDisplay.textContent = dilution.concMgMl >= 1 ? `${dilution.concMgMl} mg/mL` : `${(dilution.concMgMl * 1000).toFixed(0)} µg/mL`;
        if (screenVolumeRem) screenVolumeRem.textContent = `${currentVolumeRemaining.toFixed(1)} mL`;

        if (syringeFluid) {
            const pct = Math.max(0, Math.min(100, (currentVolumeRemaining / 50) * 100));
            syringeFluid.style.width = `${pct}%`;
        }

        // Validation de sécurité
        const safety = validatePseSafety(currentDrugId, currentFlowRate, dilution.concMgMl, currentWeightKg, currentRoute);

        if (safetyBanner) {
            if (!safety.valid) {
                safetyBanner.className = 'safety-alert-banner danger';
                safetyBanner.innerHTML = `<i class="fas fa-skull-crossbones"></i> <div><strong>ERREUR DE SÉCURITÉ :</strong> ${safety.errors.join('<br>')}</div>`;
                if (ledAlarm) ledAlarm.className = 'led-indicator alarm';
            } else if (safety.warnings.length > 0) {
                safetyBanner.className = 'safety-alert-banner warning';
                safetyBanner.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <div><strong>ATTENTION :</strong> ${safety.warnings.join('<br>')}</div>`;
                if (ledAlarm) ledAlarm.className = 'led-indicator';
            } else {
                safetyBanner.className = 'safety-alert-banner ok';
                safetyBanner.innerHTML = `<i class="fas fa-check-circle"></i> <div><strong>Paramètres sécurisés :</strong> Débit et concentration conformes aux recommandations.</div>`;
                if (ledAlarm) ledAlarm.className = 'led-indicator';
            }
        }

        // LEDs de statut
        if (ledRunning) ledRunning.className = isRunning ? 'led-indicator running' : 'led-indicator';
        if (ledStop) ledStop.className = !isRunning ? 'led-indicator' : 'led-indicator';
    }

    // Gestionnaires d'événements
    if (selectDrug) {
        selectDrug.addEventListener('change', (e) => {
            currentDrugId = e.target.value;
            refreshDrugOptions();
        });
    }

    if (selectDilution) {
        selectDilution.addEventListener('change', (e) => {
            currentDilutionIndex = parseInt(e.target.value, 10);
            recalculateFlow();
        });
    }

    if (inputWeight) {
        inputWeight.addEventListener('input', (e) => {
            currentWeightKg = Math.max(30, Math.min(180, parseFloat(e.target.value) || 70));
            recalculateFlow();
        });
    }

    if (selectRoute) {
        selectRoute.addEventListener('change', (e) => {
            currentRoute = e.target.value;
            updateDisplay();
        });
    }

    if (rangeTargetDose) {
        rangeTargetDose.addEventListener('input', (e) => {
            const drug = DRUG_DATABASE[currentDrugId];
            if (targetDoseDisplay) targetDoseDisplay.textContent = `${e.target.value} ${drug.baseUnitLabel}`;
            recalculateFlow();
        });
    }

    // Touches du Clavier
    document.querySelectorAll('.keypad-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if (action === 'start') {
                isRunning = true;
            } else if (action === 'stop') {
                isRunning = false;
            } else if (action === 'bolus') {
                currentVolumeRemaining = Math.max(0, currentVolumeRemaining - 1.0);
            } else if (action === 'plus') {
                currentFlowRate = Math.round((currentFlowRate + 0.5) * 100) / 100;
            } else if (action === 'minus') {
                currentFlowRate = Math.max(0, Math.round((currentFlowRate - 0.5) * 100) / 100);
            } else if (action === 'plus-fine') {
                currentFlowRate = Math.round((currentFlowRate + 0.1) * 100) / 100;
            } else if (action === 'minus-fine') {
                currentFlowRate = Math.max(0, Math.round((currentFlowRate - 0.1) * 100) / 100);
            }
            updateDisplay();
        });
    });

    // Cas Cliniques
    const caseSelectRow = document.getElementById('case-buttons-row');
    const caseTitle = document.getElementById('quiz-case-title');
    const caseContext = document.getElementById('quiz-case-context');
    const caseQuestion = document.getElementById('quiz-case-question');
    const inputCaseAnswer = document.getElementById('input-case-answer');
    const btnValidateCase = document.getElementById('btn-validate-case');
    const caseFeedback = document.getElementById('case-feedback');

    let activeCaseIndex = 0;

    function renderCases() {
        if (!caseSelectRow) return;
        caseSelectRow.innerHTML = '';
        PSE_CLINICAL_CASES.forEach((c, idx) => {
            const btn = document.createElement('button');
            btn.className = `preset-chip ${idx === activeCaseIndex ? 'active' : ''}`;
            btn.textContent = `Cas ${idx + 1} : ${c.title.split('(')[0]}`;
            btn.addEventListener('click', () => {
                activeCaseIndex = idx;
                loadCase(PSE_CLINICAL_CASES[idx]);
                renderCases();
            });
            caseSelectRow.appendChild(btn);
        });
    }

    function loadCase(c) {
        if (!c) return;
        if (caseTitle) caseTitle.textContent = c.title;
        if (caseContext) caseContext.innerHTML = `<strong>Patient :</strong> ${c.patient.name}, ${c.patient.age} ans (${c.patient.weight} kg).<br>${c.patient.context}`;
        if (caseQuestion) caseQuestion.textContent = c.question;
        if (inputCaseAnswer) inputCaseAnswer.value = '';
        if (caseFeedback) {
            caseFeedback.style.display = 'none';
            caseFeedback.innerHTML = '';
        }

        // Pré-remplir les données de la machine
        currentDrugId = c.drugId;
        if (selectDrug) selectDrug.value = c.drugId;
        currentWeightKg = c.patient.weight;
        if (inputWeight) inputWeight.value = c.patient.weight;
        refreshDrugOptions();
    }

    if (btnValidateCase) {
        btnValidateCase.addEventListener('click', () => {
            const c = PSE_CLINICAL_CASES[activeCaseIndex];
            const answer = parseFloat(inputCaseAnswer?.value || '0');
            const minExpected = c.expectedFlowRange[0];
            const maxExpected = c.expectedFlowRange[1];

            const isCorrect = answer >= (minExpected - 0.2) && answer <= (maxExpected + 0.2);

            if (caseFeedback) {
                caseFeedback.style.display = 'block';
                if (isCorrect) {
                    caseFeedback.className = 'safety-alert-banner ok';
                    caseFeedback.innerHTML = `<i class="fas fa-check-circle"></i> <div><strong>Excellent calcul !</strong> ${c.explanation}</div>`;
                    if (window.BadgeSystem) {
                        window.BadgeSystem.recordSkillActivity('pse', 100);
                    }
                } else {
                    caseFeedback.className = 'safety-alert-banner danger';
                    caseFeedback.innerHTML = `<i class="fas fa-times-circle"></i> <div><strong>Erreur de posologie !</strong> Valeur attendue environ ${minExpected} à ${maxExpected} mL/h.<br>${c.explanation}</div>`;
                }
            }
        });
    }

    // Initialisation
    refreshDrugOptions();
    renderCases();
    loadCase(PSE_CLINICAL_CASES[0]);

    // Boucle d'infusion si en marche
    setInterval(() => {
        if (isRunning && currentVolumeRemaining > 0) {
            // Débit mL/h -> mL/seconde = currentFlowRate / 3600
            currentVolumeRemaining = Math.max(0, currentVolumeRemaining - (currentFlowRate / 3600));
            updateDisplay();
        }
    }, 1000);
});
