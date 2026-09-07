/**
 * js/ecg-trainer.js — Contrôleur de l'application ECG Academy
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialisation Canvas & Moteur
    const canvas = document.getElementById('ecg-canvas');
    if (!canvas) return;

    // Définir la résolution interne haute définition
    function resizeCanvas() {
        const container = canvas.parentElement;
        const rect = container.getBoundingClientRect();
        // Rapport standard ECG 12 dérivations avec marge suffisante pour les QRS amples
        const targetWidth = Math.max(800, Math.floor(rect.width || 1000));
        const targetHeight = Math.max(520, Math.floor(targetWidth * 0.52));

        const scale = window.devicePixelRatio > 1 ? 1.5 : 1;
        canvas.width = Math.floor(targetWidth * scale);
        canvas.height = Math.floor(targetHeight * scale);
        canvas.style.width = '100%';
        canvas.style.height = `${targetHeight}px`;

        if (window.ecgRenderer) {
            window.ecgRenderer.render();
        }
    }

    const renderer = new ECGCanvasRenderer(canvas, {
        mmPx: 3.8,
        theme: 'classic',
        showCaliper: false
    });
    window.ecgRenderer = renderer;

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 2. État de l'application
    const state = {
        mode: 'learn', // 'learn' ou 'quiz'
        currentCaseIndex: 0,
        cases: (typeof ECG_DATABASE !== 'undefined') ? ECG_DATABASE : [],
        currentCorrectIndex: 0,
        quizQueue: [],
        quizCurrentIndex: 0,
        quizScore: 0,
        quizTotal: 5,
        checklistStep: 0,
        theme: 'classic'
    };

    // 3. Éléments du DOM
    const elCaseTitle = document.getElementById('case-title');
    const elCasePatient = document.getElementById('case-patient');
    const elCaseCategory = document.getElementById('case-category');
    const elCaseDifficulty = document.getElementById('case-difficulty');
    const elSignalSource = document.getElementById('case-signal-source');
    const elCaseSelect = document.getElementById('ecg-case-select');
    const elPickerGroup = document.getElementById('ecg-picker-group');
    
    // Checklist
    const elChecklistContainer = document.getElementById('ecg-checklist-container');
    const elMetricsList = document.getElementById('ecg-metrics-list');
    
    // Question & Quiz
    const elQuizPanel = document.getElementById('ecg-quiz-panel');
    const elQuestionText = document.getElementById('ecg-question-text');
    const elOptionsContainer = document.getElementById('ecg-options-container');
    const elFeedbackBox = document.getElementById('ecg-feedback-box');
    const elExplanationText = document.getElementById('ecg-explanation-text');
    const elNextCaseBtn = document.getElementById('btn-next-case');

    // Controls
    const btnCaliper = document.getElementById('btn-toggle-caliper');
    const btnTheme = document.getElementById('btn-toggle-theme');
    const btnModeLearn = document.getElementById('tab-mode-learn');
    const btnModeQuiz = document.getElementById('tab-mode-quiz');
    const caliperReadout = document.getElementById('caliper-live-readout');

    // Stats bar
    const elStatCompleted = document.getElementById('stat-ecg-completed');
    const elStatHighScore = document.getElementById('stat-ecg-highscore');

    function updateHeaderStats() {
        if (window.BadgeSystem) {
            const stats = window.BadgeSystem.getSkillStats();
            if (elStatCompleted) elStatCompleted.textContent = stats.ecgCompleted || 0;
            if (elStatHighScore) elStatHighScore.textContent = `${stats.ecgHighScore || 0}%`;
        }
    }

    function updateSignalBadge(signal, currentCase) {
        if (!elSignalSource) return;
        const c = currentCase || state.cases[state.currentCaseIndex];
        if (!c) {
            elSignalSource.style.display = 'none';
            return;
        }

        if (signal || c.signalFile) {
            elSignalSource.style.display = 'inline-flex';
            elSignalSource.className = 'badge-diff real-ecg';
            elSignalSource.innerHTML = '<i class="fas fa-wave-square"></i> PTB-XL (Tracé Réel)';
            elSignalSource.title = c.signalSource || 'PhysioNet PTB-XL (CC-BY 4.0)';
        } else {
            elSignalSource.style.display = 'inline-flex';
            elSignalSource.className = 'badge-diff sim-ecg';
            elSignalSource.innerHTML = '<i class="fas fa-microchip"></i> Simulation';
            elSignalSource.title = 'Modélisation vectorielle haute fidélité';
        }
    }

    renderer.onSignalLoaded = (signal, currentCase) => {
        if (state.mode === 'learn') {
            updateSignalBadge(signal, currentCase);
        }
    };

    // Callback pour mise à jour live de la réglette avec Bazett QTc
    renderer.onCaliperChange = (metrics) => {
        if (!caliperReadout) return;
        if (!metrics) {
            caliperReadout.innerHTML = '<span style="opacity:0.6;"><i class="fas fa-arrows-alt-h"></i> Réglette désactivée</span>';
            return;
        }
        caliperReadout.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                <span><strong>Δt :</strong> ${metrics.durationMs} ms (${metrics.deltaMmT} mm)</span>
                <span><strong>ΔV :</strong> ${metrics.voltageMv} mV (${metrics.deltaMmV} mm)</span>
                ${metrics.estimatedHr ? `<span style="color:#00f2fe;"><strong>FC estimée :</strong> ${metrics.estimatedHr} bpm</span>` : ''}
                ${metrics.qtcBazett ? `<span style="color:#ffd700;"><strong>QTc (Bazett) :</strong> ${metrics.qtcBazett} ms</span>` : ''}
            </div>
        `;
    };

    // 4. Charger un cas en mode Apprentissage
    function loadCase(index) {
        if (!state.cases[index]) return;
        state.currentCaseIndex = index;
        const c = state.cases[index];

        renderer.setCase(c);

        if (elCaseTitle) elCaseTitle.textContent = c.title;
        if (elCasePatient) elCasePatient.textContent = c.patient;
        if (elCaseCategory) elCaseCategory.textContent = c.category.toUpperCase();
        if (elCaseDifficulty) {
            elCaseDifficulty.textContent = c.difficulty.toUpperCase();
            elCaseDifficulty.className = `badge-diff ${c.difficulty}`;
        }

        // Mettre à jour le badge de source (PTB-XL vs Simulation)
        updateSignalBadge(renderer.currentSignal, c);

        // Mettre à jour le sélecteur déroulant
        renderCaseSelector();

        // Mettre à jour la checklist méthodologique
        renderMetricsChecklist(c);

        // Mettre à jour la question
        renderQuestion(c);
    }

    function renderCaseSelector() {
        if (!elCaseSelect) return;
        if (elCaseSelect.children.length === 0) {
            state.cases.forEach((c, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = `${idx + 1}. ${c.title} (${c.difficulty.toUpperCase()})`;
                elCaseSelect.appendChild(opt);
            });
            elCaseSelect.onchange = (e) => {
                const selectedIdx = parseInt(e.target.value, 10);
                if (state.mode === 'quiz') switchMode('learn');
                loadCase(selectedIdx);
            };
        }
        elCaseSelect.value = state.currentCaseIndex;
    }

    function renderMetricsChecklist(c) {
        if (!elMetricsList) return;
        const m = c.metrics;
        elMetricsList.innerHTML = `
            <div class="metric-row">
                <span class="metric-label"><i class="fas fa-heartbeat"></i> Rythme :</span>
                <span class="metric-value highlight">${m.rhythm}</span>
            </div>
            <div class="metric-row">
                <span class="metric-label"><i class="fas fa-tachometer-alt"></i> Fréquence Cardiaque :</span>
                <span class="metric-value">${m.heartRate} bpm</span>
            </div>
            <div class="metric-row">
                <span class="metric-label"><i class="fas fa-compass"></i> Axe du QRS :</span>
                <span class="metric-value">${m.axis}</span>
            </div>
            <div class="metric-row">
                <span class="metric-label"><i class="fas fa-ruler-horizontal"></i> Espace PR / PQ :</span>
                <span class="metric-value ${m.prInterval > 200 ? 'warn' : ''}">${m.prInterval ? m.prInterval + ' ms' : 'Non mesurable'}</span>
            </div>
            <div class="metric-row">
                <span class="metric-label"><i class="fas fa-arrows-alt-h"></i> Durée QRS :</span>
                <span class="metric-value ${m.qrsDuration > 120 ? 'warn' : ''}">${m.qrsDuration} ms</span>
            </div>
            <div class="metric-row">
                <span class="metric-label"><i class="fas fa-clock"></i> Espace QTc (Bazett) :</span>
                <span class="metric-value ${m.qtcInterval > 450 ? 'warn' : ''}">${m.qtcInterval} ms</span>
            </div>
            <div class="metric-row">
                <span class="metric-label"><i class="fas fa-chart-line"></i> Segment ST :</span>
                <span class="metric-value ${m.stSegment.includes('Sus') ? 'danger' : ''}">${m.stSegment}</span>
            </div>
            <div class="metric-row">
                <span class="metric-label"><i class="fas fa-wave-square"></i> Onde T :</span>
                <span class="metric-value">${m.tWave}</span>
            </div>
        `;
    }

    function renderQuestion(c) {
        if (!elQuestionText || !elOptionsContainer) return;

        elQuestionText.textContent = c.question;
        elOptionsContainer.innerHTML = '';
        if (elFeedbackBox) elFeedbackBox.style.display = 'none';

        const correctIdx = (typeof c.correctIndex === 'number') ? c.correctIndex : 0;
        const mapped = c.options.map((optText, i) => ({
            text: optText,
            isCorrect: i === correctIdx
        }));

        // Mélange aléatoire (Fisher-Yates) pour que la réponse ne soit pas toujours en position A
        for (let i = mapped.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [mapped[i], mapped[j]] = [mapped[j], mapped[i]];
        }

        state.currentCorrectIndex = mapped.findIndex(m => m.isCorrect);

        mapped.forEach((item, optIdx) => {
            const btn = document.createElement('button');
            btn.className = 'quiz-option-btn';
            btn.innerHTML = `<span class="opt-letter">${String.fromCharCode(65 + optIdx)}</span> <span class="opt-text">${item.text}</span>`;
            btn.onclick = () => checkAnswer(optIdx, c);
            elOptionsContainer.appendChild(btn);
        });
    }

    function checkAnswer(selectedIndex, currentCase) {
        const isCorrect = selectedIndex === state.currentCorrectIndex;
        const allBtns = elOptionsContainer.querySelectorAll('.quiz-option-btn');

        allBtns.forEach((b, i) => {
            b.disabled = true;
            if (i === state.currentCorrectIndex) {
                b.classList.add('correct');
            } else if (i === selectedIndex) {
                b.classList.add('wrong');
            }
        });

        // Afficher l'explication
        if (elFeedbackBox && elExplanationText) {
            elFeedbackBox.className = `feedback-box ${isCorrect ? 'correct' : 'wrong'}`;
            elFeedbackBox.style.display = 'block';
            elExplanationText.innerHTML = `
                <div style="font-weight:700; margin-bottom:6px; color:${isCorrect ? '#2ecc71' : '#ff4757'};">
                    <i class="fas ${isCorrect ? 'fa-check-circle' : 'fa-times-circle'}"></i> ${isCorrect ? 'Exact ! Excellente analyse.' : 'Incorrect.'}
                </div>
                ${currentCase.explanation}
            `;
        }

        // Son & Badge
        if (typeof MedGameAudio !== 'undefined') {
            MedGameAudio.play(isCorrect ? 'success' : 'card_flip');
        }

        if (state.mode === 'quiz') {
            if (isCorrect) state.quizScore++;
            if (elNextCaseBtn) {
                elNextCaseBtn.style.display = 'inline-flex';
                elNextCaseBtn.onclick = nextQuizQuestion;
            }
        } else {
            // Mode apprentissage : enregistrer comme 1 tracé validé
            if (window.BadgeSystem) {
                window.BadgeSystem.recordSkillActivity('ecg', isCorrect ? 100 : 50);
                updateHeaderStats();
            }
        }
    }

    // 5. Mode Challenge / Quiz
    function startQuizMode() {
        state.mode = 'quiz';
        state.quizScore = 0;
        state.quizCurrentIndex = 0;
        state.quizTotal = Math.min(5, state.cases.length);

        // Mélanger les cas aléatoirement
        const shuffled = [...state.cases].sort(() => 0.5 - Math.random());
        state.quizQueue = shuffled.slice(0, state.quizTotal);

        if (elPickerGroup) elPickerGroup.style.display = 'none';
        document.getElementById('learn-view-sidebar')?.classList.add('hidden');
        document.getElementById('quiz-view-header')?.classList.remove('hidden');

        loadQuizQuestion(0);
    }

    function loadQuizQuestion(idx) {
        state.quizCurrentIndex = idx;
        const c = state.quizQueue[idx];

        // Masquer le titre réel du cas pour le test
        if (elCaseTitle) elCaseTitle.textContent = `Cas Test ${idx + 1} / ${state.quizTotal}`;
        if (elCasePatient) elCasePatient.textContent = c.patient;
        if (elCaseCategory) elCaseCategory.textContent = "ÉVALUATION CLINIQUE";
        if (elCaseDifficulty) {
            elCaseDifficulty.textContent = "ÉVALUATION";
            elCaseDifficulty.className = 'badge-diff urgence';
        }
        if (elSignalSource) {
            elSignalSource.style.display = 'none';
        }

        renderer.setCase(c);
        renderQuestion(c);

        const elQuizProgress = document.getElementById('quiz-progress-text');
        if (elQuizProgress) {
            elQuizProgress.textContent = `Question ${idx + 1} / ${state.quizTotal}`;
        }
    }

    function nextQuizQuestion() {
        if (state.quizCurrentIndex + 1 < state.quizTotal) {
            loadQuizQuestion(state.quizCurrentIndex + 1);
        } else {
            finishQuiz();
        }
    }

    function finishQuiz() {
        const scorePercent = Math.round((state.quizScore / state.quizTotal) * 100);

        if (window.BadgeSystem) {
            window.BadgeSystem.recordSkillActivity('ecg', scorePercent);
            updateHeaderStats();
        }

        // Afficher l'écran de fin de quiz
        if (elQuestionText && elOptionsContainer) {
            elQuestionText.innerHTML = `🎯 Test Terminé ! Score : <span style="color:#00f2fe; font-size:1.3em;">${scorePercent}%</span> (${state.quizScore}/${state.quizTotal})`;
            elOptionsContainer.innerHTML = `
                <div class="quiz-summary-card">
                    <p>${scorePercent >= 80 ? '🎉 Félicitations ! Vous maîtrisez les critères diagnostiques clés de l\'ECG.' : '💪 Continuez à vous entraîner sur les différents tracés pour progresser !'}</p>
                    <button class="btn-3d primary" onclick="location.reload()" style="margin-top:15px;">
                        <span class="btn-content"><i class="fas fa-redo"></i> Recommencer un Test</span>
                        <div class="btn-layer"></div>
                    </button>
                </div>
            `;
            if (elFeedbackBox) elFeedbackBox.style.display = 'none';
        }
    }

    function switchMode(newMode) {
        state.mode = newMode;
        if (btnModeLearn) btnModeLearn.classList.toggle('active', newMode === 'learn');
        if (btnModeQuiz) btnModeQuiz.classList.toggle('active', newMode === 'quiz');

        if (newMode === 'quiz') {
            startQuizMode();
        } else {
            if (elPickerGroup) elPickerGroup.style.display = 'flex';
            document.getElementById('learn-view-sidebar')?.classList.remove('hidden');
            document.getElementById('quiz-view-header')?.classList.add('hidden');
            if (elNextCaseBtn) elNextCaseBtn.style.display = 'none';
            loadCase(state.currentCaseIndex);
        }
    }

    // 6. Boutons et événements
    if (btnCaliper) {
        btnCaliper.onclick = () => {
            const active = renderer.toggleCaliper();
            btnCaliper.classList.toggle('active', active);
            if (!active && caliperReadout) {
                caliperReadout.innerHTML = '<span style="opacity:0.6;"><i class="fas fa-arrows-alt-h"></i> Réglette désactivée</span>';
            }
        };
    }

    if (btnTheme) {
        btnTheme.onclick = () => {
            state.theme = (state.theme === 'classic') ? 'neon' : 'classic';
            renderer.setTheme(state.theme);
            btnTheme.innerHTML = (state.theme === 'classic')
                ? '<i class="fas fa-moon"></i> Thème Sombre'
                : '<i class="fas fa-sun"></i> Papier Millimétré';
        };
    }

    if (btnModeLearn) btnModeLearn.onclick = () => switchMode('learn');
    if (btnModeQuiz) btnModeQuiz.onclick = () => switchMode('quiz');

    // Démarrage initial
    updateHeaderStats();
    loadCase(0);
});
