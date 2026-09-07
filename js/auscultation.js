/**
 * js/auscultation.js — Contrôleur d'interface pour le Stéthoscope Virtuel & Auscultation Lab
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialisation Moteur Audio & Phonocardiogramme
    const audio = new AuscultationAudioEngine();
    window.auscultationAudio = audio;

    const phonoCanvas = document.getElementById('phonocardiogram-canvas');
    let phonoCtx = null;
    if (phonoCanvas) {
        phonoCtx = phonoCanvas.getContext('2d');
        resizePhono();
        window.addEventListener('resize', resizePhono);
    }

    function resizePhono() {
        if (!phonoCanvas) return;
        const rect = phonoCanvas.parentElement.getBoundingClientRect();
        const h = Math.max(90, Math.floor(rect.height || 160));
        phonoCanvas.width = Math.floor(rect.width * (window.devicePixelRatio > 1 ? 1.5 : 1));
        phonoCanvas.height = Math.floor(h * (window.devicePixelRatio > 1 ? 1.5 : 1));
        phonoCanvas.style.width = `${rect.width}px`;
        phonoCanvas.style.height = `${h}px`;
    }

    // 2. État
    const state = {
        mode: 'learn', // 'learn' ou 'quiz'
        currentCaseIndex: 0,
        cases: (typeof AUSCULTATION_DATABASE !== 'undefined') ? AUSCULTATION_DATABASE : [],
        activeHotspot: 'apex',
        filterMode: 'diaphragm',
        libraryFilter: 'all', // 'all', 'cardiac', 'pulmonary'
        currentCorrectIndex: 0,
        quizQueue: [],
        quizCurrentIndex: 0,
        quizScore: 0,
        quizTotal: 5
    };

    // 3. Éléments DOM
    const elCaseTitle = document.getElementById('case-title');
    const elCasePatient = document.getElementById('case-patient');
    const elCaseType = document.getElementById('case-type');
    const elCaseDifficulty = document.getElementById('case-difficulty');
    const elAudioSource = document.getElementById('case-audio-source');
    const elCaseList = document.getElementById('auscult-case-list');
    const elSemiologyText = document.getElementById('semiology-description');

    audio.onAudioModeChange = (mode) => {
        if (!elAudioSource || state.mode === 'quiz') return;
        if (mode === 'real') {
            elAudioSource.className = 'badge-diff real-audio';
            elAudioSource.innerHTML = '<i class="fas fa-wave-square"></i> Son réel (mannequin)';
            elAudioSource.title = 'Enregistrement stéthoscopique réel sur mannequin clinique (Dataset HLS-CMDS)';
        } else {
            elAudioSource.className = 'badge-diff synth-audio';
            elAudioSource.innerHTML = '<i class="fas fa-sliders-h"></i> Simulation';
            elAudioSource.title = 'Modélisation physique Web Audio temps réel';
        }
    };

    // Controls
    const btnPlayAudio = document.getElementById('btn-toggle-audio');
    const btnFilterBell = document.getElementById('btn-filter-bell');
    const btnFilterDiaphragm = document.getElementById('btn-filter-diaphragm');
    const elCurrentHotspotLabel = document.getElementById('current-hotspot-label');

    // Quiz elements
    const elQuizPanel = document.getElementById('auscult-quiz-panel');
    const elQuestionText = document.getElementById('auscult-question-text');
    const elOptionsContainer = document.getElementById('auscult-options-container');
    const elFeedbackBox = document.getElementById('auscult-feedback-box');
    const elExplanationText = document.getElementById('auscult-explanation-text');
    const elNextCaseBtn = document.getElementById('btn-next-case');

    // Stats
    const elStatCompleted = document.getElementById('stat-auscult-completed');
    const elStatHighScore = document.getElementById('stat-auscult-highscore');

    function updateHeaderStats() {
        if (window.BadgeSystem) {
            const stats = window.BadgeSystem.getSkillStats();
            if (elStatCompleted) elStatCompleted.textContent = stats.auscultCompleted || 0;
            if (elStatHighScore) elStatHighScore.textContent = `${stats.auscultHighScore || 0}%`;
        }
    }

    // 4. Charger un cas
    function loadCase(index) {
        if (!state.cases[index]) return;
        state.currentCaseIndex = index;
        const c = state.cases[index];

        audio.setCase(c);
        selectHotspot(c.optimalHotspot || 'apex');

        if (elCaseTitle) elCaseTitle.textContent = c.title;
        if (elCasePatient) elCasePatient.textContent = c.patient;
        if (elCaseType) {
            elCaseType.textContent = c.type === 'cardiac' ? 'CARDIOLOGIE' : 'PNEUMOLOGIE';
            elCaseType.className = `badge-diff ${c.type === 'cardiac' ? 'urgence' : 'debutant'}`;
        }
        if (elCaseDifficulty) {
            elCaseDifficulty.textContent = c.difficulty.toUpperCase();
            elCaseDifficulty.className = `badge-diff ${c.difficulty}`;
        }
        if (elAudioSource) {
            elAudioSource.style.display = 'inline-flex';
            const hasReal = audio.hasRealAudio(c);
            if (hasReal) {
                elAudioSource.className = 'badge-diff real-audio';
                elAudioSource.innerHTML = '<i class="fas fa-wave-square"></i> Son réel (mannequin)';
                elAudioSource.title = 'Enregistrement stéthoscopique réel sur mannequin clinique (Dataset HLS-CMDS)';
            } else {
                elAudioSource.className = 'badge-diff synth-audio';
                elAudioSource.innerHTML = '<i class="fas fa-sliders-h"></i> Simulation';
                elAudioSource.title = 'Modélisation physique Web Audio temps réel';
            }
        }
        if (elSemiologyText) {
            elSemiologyText.textContent = c.semiology;
        }

        renderCaseList();
        renderQuestion(c);
    }

    function renderCaseList() {
        if (!elCaseList) return;
        elCaseList.innerHTML = '';

        const cardiacCases = state.cases.filter(c => c.type === 'cardiac');
        const pulmonaryCases = state.cases.filter(c => c.type === 'pulmonary');

        // Mettre à jour les compteurs dans les onglets de la bibliothèque
        const elCountAll = document.getElementById('lib-count-all');
        const elCountCardiac = document.getElementById('lib-count-cardiac');
        const elCountPulmonary = document.getElementById('lib-count-pulmonary');
        if (elCountAll) elCountAll.textContent = state.cases.length;
        if (elCountCardiac) elCountCardiac.textContent = cardiacCases.length;
        if (elCountPulmonary) elCountPulmonary.textContent = pulmonaryCases.length;

        const renderSection = (title, icon, typeClass, organBadge, caseSubset) => {
            if (caseSubset.length === 0) return;

            const sectionContainer = document.createElement('div');
            sectionContainer.className = `case-category-section ${typeClass}`;

            const header = document.createElement('div');
            header.className = `case-category-header ${typeClass}`;
            header.innerHTML = `
                <span><i class="fas ${icon}"></i> ${title}</span>
                <span class="category-count">${caseSubset.length} cas</span>
            `;
            sectionContainer.appendChild(header);

            const group = document.createElement('div');
            group.className = 'case-category-group';

            caseSubset.forEach(c => {
                const origIdx = state.cases.indexOf(c);
                const hasReal = audio.hasRealAudio(c);
                const audioBadge = hasReal
                    ? '<span class="badge-mini" style="background:rgba(0,242,254,0.12); color:#00f2fe; border:1px solid rgba(0,242,254,0.3);" title="Audio réel issu du dataset mannequin"><i class="fas fa-wave-square"></i> Réel</span>'
                    : '<span class="badge-mini" style="background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.6);" title="Synthèse physique temps réel"><i class="fas fa-sliders-h"></i> Synthèse</span>';

                const btn = document.createElement('button');
                btn.className = `case-select-btn ${origIdx === state.currentCaseIndex ? 'active' : ''} ${typeClass}`;
                btn.innerHTML = `
                    <div class="case-item-info">
                        <span class="case-item-title"><i class="fas ${icon}"></i> ${c.title}</span>
                        <div class="case-item-meta" style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                            <span class="badge-mini ${typeClass}">${organBadge}</span>
                            ${audioBadge}
                            <span class="case-item-sub">${c.difficulty}</span>
                        </div>
                    </div>
                    <i class="fas fa-volume-up case-play-icon"></i>
                `;
                btn.onclick = () => {
                    if (state.mode === 'quiz') switchMode('learn');
                    loadCase(origIdx);
                };
                group.appendChild(btn);
            });

            sectionContainer.appendChild(group);
            elCaseList.appendChild(sectionContainer);
        };


        if (state.libraryFilter === 'all' || state.libraryFilter === 'cardiac') {
            renderSection('Auscultation Cardiaque', 'fa-heartbeat', 'cardiac', 'CŒUR', cardiacCases);
        }
        if (state.libraryFilter === 'all' || state.libraryFilter === 'pulmonary') {
            renderSection('Auscultation Pulmonaire', 'fa-lungs', 'pulmonary', 'POUMONS', pulmonaryCases);
        }
    }

    // Gestion des onglets de filtre de la bibliothèque (Tous / Cœur / Poumons)
    document.querySelectorAll('.lib-filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.lib-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.libraryFilter = btn.getAttribute('data-lib-filter') || 'all';
            renderCaseList();
        };
    });

    function selectHotspot(hotspotId) {
        state.activeHotspot = hotspotId;
        audio.setHotspot(hotspotId);

        // Mettre à jour l'affichage des repères du torse
        document.querySelectorAll('.torso-hotspot').forEach(spot => {
            const isTarget = spot.getAttribute('data-hotspot') === hotspotId;
            spot.classList.toggle('active', isTarget);
        });

        // Label du foyer
        const labelMap = {
            'aortique': 'Foyer Aortique (2e EID droit)',
            'pulmonaire': 'Foyer Pulmonaire (2e EIG gauche)',
            'tricuspide': 'Foyer Tricuspide (Bas du sternum)',
            'apex': 'Foyer Mitral / Apex (5e EIG médio-claviculaire)',
            'carotide_droite': 'Irradiation Carotidienne Droite',
            'aisselle_gauche': 'Irradiation Axillaire Gauche',
            'poumon_apex_droit': 'Apex Pulmonaire Droit',
            'poumon_apex_gauche': 'Apex Pulmonaire Gauche',
            'poumon_champs_moyen': 'Champs Pulmonaire Moyen',
            'poumon_base_droite': 'Base Pulmonaire Droite',
            'poumon_base_gauche': 'Base Pulmonaire Gauche',
            'trachee': 'Larynx & Trachée'
        };

        if (elCurrentHotspotLabel) {
            elCurrentHotspotLabel.innerHTML = `<i class="fas fa-dot-circle" style="color:#00f2fe;"></i> ${labelMap[hotspotId] || hotspotId}`;
        }
    }

    // 5. Hotspots interactifs du torse
    document.querySelectorAll('.torso-hotspot').forEach(spot => {
        spot.onclick = () => {
            const hid = spot.getAttribute('data-hotspot');
            selectHotspot(hid);
            if (!audio.isPlaying) {
                audio.play();
                updatePlayButton(true);
            }
        };
    });

    // Filtrage visuel des foyers (Tous / Cœur / Poumons) avec synchronisation de la bibliothèque
    document.querySelectorAll('.foyer-filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.foyer-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.getAttribute('data-filter');

            // Synchroniser le filtre de la bibliothèque
            state.libraryFilter = filter || 'all';
            document.querySelectorAll('.lib-filter-btn').forEach(b => {
                b.classList.toggle('active', (b.getAttribute('data-lib-filter') || 'all') === state.libraryFilter);
            });
            renderCaseList();

            document.querySelectorAll('.torso-hotspot').forEach(spot => {
                if (filter === 'all') {
                    spot.style.display = 'flex';
                } else if (filter === 'cardiac') {
                    spot.style.display = (spot.classList.contains('cardiac') || spot.classList.contains('airway')) ? 'flex' : 'none';
                } else if (filter === 'pulmonary') {
                    spot.style.display = (spot.classList.contains('pulmonary') || spot.classList.contains('airway')) ? 'flex' : 'none';
                }
            });
        };
    });

    // 6. Questions & Quiz avec options mélangées (évite le piège "toujours en A")
    function renderQuestion(c) {
        if (!elQuestionText || !elOptionsContainer) return;
        elQuestionText.textContent = c.question;
        elOptionsContainer.innerHTML = '';
        if (elFeedbackBox) elFeedbackBox.style.display = 'none';

        // Associer chaque option à son index pour retrouver la bonne réponse
        const correctIdx = (typeof c.correctIndex === 'number') ? c.correctIndex : 0;
        const mapped = c.options.map((optText, i) => ({
            text: optText,
            isCorrect: i === correctIdx
        }));

        // Mélange aléatoire (Fisher-Yates)
        for (let i = mapped.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [mapped[i], mapped[j]] = [mapped[j], mapped[i]];
        }

        // Sauvegarder la nouvelle position aléatoire de la bonne réponse
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

        if (elFeedbackBox && elExplanationText) {
            elFeedbackBox.className = `feedback-box ${isCorrect ? 'correct' : 'wrong'}`;
            elFeedbackBox.style.display = 'block';
            elExplanationText.innerHTML = `
                <div style="font-weight:700; margin-bottom:6px; color:${isCorrect ? '#2ecc71' : '#ff4757'};">
                    <i class="fas ${isCorrect ? 'fa-check-circle' : 'fa-times-circle'}"></i> ${isCorrect ? 'Exact ! Oreille clinique affûtée.' : 'Incorrect.'}
                </div>
                ${currentCase.explanation}
            `;
        }

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
            if (window.BadgeSystem) {
                window.BadgeSystem.recordSkillActivity('auscultation', isCorrect ? 100 : 50);
                updateHeaderStats();
            }
        }
    }

    function startQuizMode() {
        state.mode = 'quiz';
        state.quizScore = 0;
        state.quizCurrentIndex = 0;
        state.quizTotal = Math.min(5, state.cases.length);

        const shuffled = [...state.cases].sort(() => 0.5 - Math.random());
        state.quizQueue = shuffled.slice(0, state.quizTotal);

        document.getElementById('learn-view-sidebar')?.classList.add('hidden');
        document.getElementById('auscult-quiz-panel')?.classList.remove('hidden');
        document.getElementById('quiz-view-header')?.classList.remove('hidden');
        document.getElementById('btn-exit-eval')?.classList.add('hidden');

        loadQuizQuestion(0);
    }

    function loadQuizQuestion(idx) {
        state.quizCurrentIndex = idx;
        const c = state.quizQueue[idx];

        if (elCaseTitle) elCaseTitle.textContent = `Cas Test ${idx + 1} / ${state.quizTotal}`;
        if (elCasePatient) elCasePatient.textContent = c.patient;
        if (elCaseType) elCaseType.textContent = "TEST À L'AVEUGLE";
        if (elCaseDifficulty) elCaseDifficulty.textContent = "ÉVALUATION";
        if (elAudioSource) elAudioSource.style.display = 'none';
        if (elSemiologyText) elSemiologyText.textContent = "🎧 Écoutez attentivement le son produit et identifiez la pathologie.";


        audio.setCase(c);
        selectHotspot(c.optimalHotspot || 'apex');

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
            window.BadgeSystem.recordSkillActivity('auscultation', scorePercent);
            updateHeaderStats();
        }

        if (elQuestionText && elOptionsContainer) {
            elQuestionText.innerHTML = `🎯 Test Terminé ! Score : <span style="color:#00f2fe; font-size:1.3em;">${scorePercent}%</span> (${state.quizScore}/${state.quizTotal})`;
            elOptionsContainer.innerHTML = `
                <div class="quiz-summary-card">
                    <p>${scorePercent >= 80 ? '🎉 Félicitations ! Votre oreille clinique est excellente.' : '💪 Continuez à écouter et comparer les foyers pour vous perfectionner !'}</p>
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
        document.getElementById('tab-mode-learn')?.classList.toggle('active', newMode === 'learn');
        document.getElementById('tab-mode-quiz')?.classList.toggle('active', newMode === 'quiz');

        const elLearnSidebar = document.getElementById('learn-view-sidebar');
        const elQuizPanel = document.getElementById('auscult-quiz-panel');
        const elExitEval = document.getElementById('btn-exit-eval');

        if (newMode === 'quiz') {
            elLearnSidebar?.classList.add('hidden');
            elQuizPanel?.classList.remove('hidden');
            elExitEval?.classList.add('hidden');
            startQuizMode();
        } else {
            elLearnSidebar?.classList.remove('hidden');
            elQuizPanel?.classList.add('hidden');
            document.getElementById('quiz-view-header')?.classList.add('hidden');
            loadCase(state.currentCaseIndex);
        }
    }

    // Toggle Auto-évaluation en mode exploration
    const btnEvalToggle = document.getElementById('btn-eval-case-toggle');
    const btnExitEval = document.getElementById('btn-exit-eval');

    if (btnEvalToggle) {
        btnEvalToggle.onclick = () => {
            document.getElementById('learn-view-sidebar')?.classList.add('hidden');
            const qp = document.getElementById('auscult-quiz-panel');
            if (qp) {
                qp.classList.remove('hidden');
                document.getElementById('quiz-view-header')?.classList.remove('hidden');
                const prog = document.getElementById('quiz-progress-text');
                if (prog) prog.textContent = 'Auto-évaluation sur ce cas';
                if (elNextCaseBtn) elNextCaseBtn.style.display = 'none';
                if (btnExitEval) btnExitEval.classList.remove('hidden');
                renderQuestion(state.cases[state.currentCaseIndex]);
            }
        };
    }

    if (btnExitEval) {
        btnExitEval.onclick = () => {
            document.getElementById('auscult-quiz-panel')?.classList.add('hidden');
            document.getElementById('learn-view-sidebar')?.classList.remove('hidden');
        };
    }

    // 7. Boutons Audio & Filtres
    function updatePlayButton(isPlaying) {
        if (!btnPlayAudio) return;
        btnPlayAudio.innerHTML = isPlaying
            ? '<i class="fas fa-pause"></i> Pause Audio'
            : '<i class="fas fa-play"></i> Écouter au Stéthoscope';
        btnPlayAudio.classList.toggle('active', isPlaying);
    }

    if (btnPlayAudio) {
        btnPlayAudio.onclick = () => {
            if (audio.isPlaying) {
                audio.stop();
                updatePlayButton(false);
            } else {
                audio.play();
                updatePlayButton(true);
            }
        };
    }

    if (btnFilterBell) {
        btnFilterBell.onclick = () => {
            state.filterMode = 'bell';
            audio.setFilterMode('bell');
            btnFilterBell.classList.add('active');
            btnFilterDiaphragm?.classList.remove('active');
        };
    }

    if (btnFilterDiaphragm) {
        btnFilterDiaphragm.onclick = () => {
            state.filterMode = 'diaphragm';
            audio.setFilterMode('diaphragm');
            btnFilterDiaphragm.classList.add('active');
            btnFilterBell?.classList.remove('active');
        };
    }

    document.getElementById('tab-mode-learn')?.addEventListener('click', () => switchMode('learn'));
    document.getElementById('tab-mode-quiz')?.addEventListener('click', () => switchMode('quiz'));

    // 8. Animation boucle Phonocardiogramme synchrone
    function drawPhonocardiogram() {
        requestAnimationFrame(drawPhonocardiogram);
        if (!phonoCtx || !phonoCanvas) return;

        const w = phonoCanvas.width;
        const h = phonoCanvas.height;
        const data = audio.getWaveform();

        // Fond sombre dégradé
        phonoCtx.fillStyle = 'rgba(10, 15, 36, 0.3)';
        phonoCtx.fillRect(0, 0, w, h);

        // Ligne médiane
        phonoCtx.strokeStyle = 'rgba(0, 242, 254, 0.15)';
        phonoCtx.lineWidth = 1;
        phonoCtx.beginPath();
        phonoCtx.moveTo(0, h / 2);
        phonoCtx.lineTo(w, h / 2);
        phonoCtx.stroke();

        // Tracé sonore en onde verte/cyan
        phonoCtx.strokeStyle = audio.isPlaying ? '#00f2fe' : 'rgba(0, 242, 254, 0.4)';
        phonoCtx.lineWidth = 2;
        phonoCtx.beginPath();

        const sliceWidth = w / data.length;
        let x = 0;

        for (let i = 0; i < data.length; i++) {
            const v = data[i] / 128.0; // 0 à 2 (1 = repos)
            const y = (v * h) / 2;

            if (i === 0) phonoCtx.moveTo(x, y);
            else phonoCtx.lineTo(x, y);

            x += sliceWidth;
        }

        phonoCtx.lineTo(w, h / 2);
        phonoCtx.stroke();
    }

    drawPhonocardiogram();

    // Démarrage initial
    updateHeaderStats();
    loadCase(0);
});
