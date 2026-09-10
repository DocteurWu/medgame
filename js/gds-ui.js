/**
 * js/gds-ui.js — Contrôleur UI, synchronisation bidirectionnelle des curseurs et Mode Quiz EDN
 * MedGame Skills Lab — Zéro dépendance externe.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Vérification de la présence du moteur et des cas
    if (!window.GDS || !window.GDSDiagram) {
        console.error('[GDS UI] Dépendances GDS ou GDSDiagram manquantes.');
        return;
    }

    // État global du simulateur
    const state = {
        mode: 'learn', // 'learn' ou 'quiz'
        diagramMode: 'davenport', // 'davenport' ou 'siggaard'
        derivationTarget: 'hco3', // 'hco3', 'paCO2', 'pH'
        values: {
            pH: 7.40,
            paCO2: 40.0,
            hco3: 24.0,
            paO2: 95.0,
            saO2: 98.0,
            fiO2: 21.0,
            lactates: 1.0,
            na: 140.0,
            cl: 104.0,
            k: 4.0,
            albumin: 40.0
        },
        activeCaseIndex: 0,
        quizAnswers: {},
        quizValidated: false,
        stats: {
            completed: 0,
            highScore: 0
        }
    };

    // Initialisation du diagramme Canvas
    const diagram = new window.GDSDiagram('gds-canvas', {
        mode: state.diagramMode,
        onPointChange: (coords) => {
            // Mise à jour depuis le glisser-déposer sur le diagramme
            state.values.pH = coords.pH;
            state.values.hco3 = coords.hco3;
            state.values.paCO2 = coords.paCO2;

            syncTableInputs(false); // Sans redessiner le diagramme pour éviter rebouclage
            updateCalculationsAndReasoning();
        }
    });

    // Éléments du DOM
    const elTabLearn = document.getElementById('tab-mode-learn');
    const elTabQuiz = document.getElementById('tab-mode-quiz');
    const elSecLearn = document.getElementById('sec-learn-mode');
    const elSecQuiz = document.getElementById('sec-quiz-mode');

    const elBtnDiagDavenport = document.getElementById('btn-diag-davenport');
    const elBtnDiagSiggaard = document.getElementById('btn-diag-siggaard');

    const elStatCompleted = document.getElementById('stat-gds-completed');
    const elStatHighScore = document.getElementById('stat-gds-highscore');

    // ── 1. Initialisation des curseurs et champs du tableau ──
    const paramKeys = ['pH', 'paCO2', 'hco3', 'paO2', 'saO2', 'fiO2', 'lactates', 'na', 'cl', 'k', 'albumin'];

    paramKeys.forEach(key => {
        const slider = document.getElementById(`slider-${key}`);
        const input = document.getElementById(`num-${key}`);

        if (!slider || !input) return;

        const onValueChange = (val, isSlider) => {
            let num = parseFloat(val);
            if (isNaN(num)) return;

            const cfg = GDS.CONSTANTS.RANGES[key];
            num = Math.max(cfg.min, Math.min(cfg.max, num));

            state.values[key] = num;
            if (isSlider) {
                input.value = (cfg.step < 1) ? num.toFixed(key === 'pH' ? 2 : 1) : num.toString();
            } else {
                slider.value = num.toString();
            }

            // Gestion de l'interdépendance Henderson-Hasselbalch
            handleHendersonHasselbalch(key);

            // Mise à jour du diagramme
            diagram.setPatientValues({
                pH: state.values.pH,
                hco3: state.values.hco3,
                paCO2: state.values.paCO2
            });

            syncTableRowsStatus();
            updateCalculationsAndReasoning();
        };

        slider.addEventListener('input', (e) => onValueChange(e.target.value, true));
        input.addEventListener('change', (e) => onValueChange(e.target.value, false));
    });

    // Radio boutons de dérivation Henderson-Hasselbalch
    const derivationRadios = document.querySelectorAll('input[name="hh-derived"]');
    derivationRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            state.derivationTarget = e.target.value;
            highlightDerivedRow();
            handleHendersonHasselbalch(null);
            diagram.setPatientValues({
                pH: state.values.pH,
                hco3: state.values.hco3,
                paCO2: state.values.paCO2
            });
            syncTableInputs(false);
            updateCalculationsAndReasoning();
        });
    });

    function highlightDerivedRow() {
        ['pH', 'paCO2', 'hco3'].forEach(k => {
            const row = document.getElementById(`row-${k}`);
            if (row) {
                if (k === state.derivationTarget) {
                    row.classList.add('derived');
                } else {
                    row.classList.remove('derived');
                }
            }
        });
    }

    function handleHendersonHasselbalch(changedKey) {
        // Si la variable modifiée est la variable dérivée elle-même,
        // on adapte temporairement la dérivation pour ne pas bloquer l'utilisateur
        let target = state.derivationTarget;
        if (changedKey === target) {
            target = (changedKey === 'hco3') ? 'paCO2' : ((changedKey === 'paCO2') ? 'hco3' : 'hco3');
        }

        if (target === 'hco3') {
            const val = GDS.computeHendersonHasselbalch({
                pH: state.values.pH,
                paCO2: state.values.paCO2,
                target: 'hco3'
            });
            if (val != null) state.values.hco3 = Math.max(2, Math.min(55, val));
        } else if (target === 'paCO2') {
            const val = GDS.computeHendersonHasselbalch({
                pH: state.values.pH,
                hco3: state.values.hco3,
                target: 'paCO2'
            });
            if (val != null) state.values.paCO2 = Math.max(10, Math.min(120, val));
        } else if (target === 'pH') {
            const val = GDS.computeHendersonHasselbalch({
                paCO2: state.values.paCO2,
                hco3: state.values.hco3,
                target: 'pH'
            });
            if (val != null) state.values.pH = Math.max(6.80, Math.min(7.80, val));
        }

        // Rafraîchir les inputs sans déclencher de boucle d'événements
        syncTableInputs(false);
    }

    function syncTableInputs(updateDiagram = true) {
        paramKeys.forEach(key => {
            const slider = document.getElementById(`slider-${key}`);
            const input = document.getElementById(`num-${key}`);
            const val = state.values[key];
            const cfg = GDS.CONSTANTS.RANGES[key];

            if (slider && input && val != null) {
                slider.value = val.toString();
                input.value = (cfg.step < 1) ? val.toFixed(key === 'pH' ? 2 : 1) : Math.round(val).toString();
            }
        });

        syncTableRowsStatus();

        if (updateDiagram) {
            diagram.setPatientValues({
                pH: state.values.pH,
                hco3: state.values.hco3,
                paCO2: state.values.paCO2
            });
        }
    }

    function syncTableRowsStatus() {
        paramKeys.forEach(key => {
            const val = state.values[key];
            const cfg = GDS.CONSTANTS.RANGES[key];
            const deltaEl = document.getElementById(`delta-${key}`);
            const statusEl = document.getElementById(`status-${key}`);

            if (!deltaEl || !statusEl || val == null) return;

            let delta = 0;
            let status = 'normal';
            let label = 'Normal';

            if (val < cfg.normMin) {
                delta = val - cfg.normMin;
                status = (delta < - (cfg.normMax - cfg.normMin)) ? 'danger' : 'warning';
                label = 'Bas';
            } else if (val > cfg.normMax) {
                delta = val - cfg.normMax;
                status = (delta > (cfg.normMax - cfg.normMin)) ? 'danger' : 'warning';
                label = 'Élevé';
            }

            deltaEl.textContent = (delta === 0) ? '—' : `${delta > 0 ? '+' : ''}${cfg.step < 1 ? delta.toFixed(key === 'pH' ? 2 : 1) : Math.round(delta)}`;
            deltaEl.style.color = (status === 'normal') ? 'rgba(255,255,255,0.6)' : (status === 'warning' ? 'var(--gds-amber)' : 'var(--gds-red)');

            statusEl.className = `status-badge ${status}`;
            statusEl.innerHTML = `<i class="fas fa-${status === 'normal' ? 'check' : (status === 'warning' ? 'exclamation' : 'exclamation-triangle')}"></i> ${label}`;
        });
    }

    // ── 2. Mise à jour des calculs et du raisonnement pas à pas ──
    function updateCalculationsAndReasoning() {
        const analysis = GDS.analyzeBloodGas(state.values);

        // A. Cartes d'indices
        // 1. Trou Anionique
        const elTaVal = document.getElementById('index-ta-val');
        const elTaDesc = document.getElementById('index-ta-desc');
        if (elTaVal && elTaDesc) {
            const ag = analysis.step4.anionGap;
            if (ag) {
                elTaVal.textContent = `${ag.corrected} mmol/L`;
                elTaDesc.textContent = `Mesuré : ${ag.measured} mmol/L${ag.isAlbuminCorrected ? ' (corrigé sur albumine)' : ''} — Réf 8-12`;
                elTaVal.style.color = ag.isElevated ? 'var(--gds-red)' : 'var(--gds-green)';
            }
        }

        // 2. Compensation attendue (Winter ou autre)
        const elCompVal = document.getElementById('index-comp-val');
        const elCompDesc = document.getElementById('index-comp-desc');
        if (elCompVal && elCompDesc) {
            if (analysis.step2.disorder === 'acidose_metabolique') {
                const w = GDS.computeWinter({ hco3: state.values.hco3 });
                elCompVal.textContent = `${w.expected} ± 2 mmHg`;
                elCompDesc.textContent = `Formule de Winter : Cible PaCO₂ = [${w.min} - ${w.max}] mmHg (Obs : ${Math.round(state.values.paCO2)})`;
            } else if (analysis.step2.disorder === 'alcalose_metabolique') {
                const alk = GDS.computeMetabolicAlkalosisComp({ hco3: state.values.hco3 });
                elCompVal.textContent = `${alk.expected} ± 5 mmHg`;
                elCompDesc.textContent = `Cible PaCO₂ = [${alk.min} - ${alk.max}] mmHg (Obs : ${Math.round(state.values.paCO2)})`;
            } else if (analysis.step2.disorder === 'acidose_respiratoire') {
                const rc = GDS.computeRespiratoryAcidosisComp({ paCO2: state.values.paCO2 });
                elCompVal.textContent = `Aigu: ${rc.acute.expected} / Chr: ${rc.chronic.expected}`;
                elCompDesc.textContent = `Cibles HCO₃⁻ aigu vs chronique (Obs : ${state.values.hco3.toFixed(1)} mmol/L)`;
            } else if (analysis.step2.disorder === 'alcalose_respiratoire') {
                const rc = GDS.computeRespiratoryAlkalosisComp({ paCO2: state.values.paCO2 });
                elCompVal.textContent = `Aigu: ${rc.acute.expected} / Chr: ${rc.chronic.expected}`;
                elCompDesc.textContent = `Cibles HCO₃⁻ aigu vs chronique (Obs : ${state.values.hco3.toFixed(1)} mmol/L)`;
            } else {
                elCompVal.textContent = 'Non requise';
                elCompDesc.textContent = 'Absence de trouble primaire isolé nécessitant une formule de compensation';
            }
        }

        // 3. Delta Ratio
        const elDeltaVal = document.getElementById('index-delta-val');
        const elDeltaDesc = document.getElementById('index-delta-desc');
        if (elDeltaVal && elDeltaDesc) {
            const dr = analysis.step4.deltaRatio;
            if (dr && dr.ratio != null) {
                elDeltaVal.textContent = dr.ratio.toFixed(2);
                elDeltaDesc.textContent = dr.status;
                elDeltaVal.style.color = (dr.category === 'pure') ? 'var(--gds-cyan)' : 'var(--gds-amber)';
            } else {
                elDeltaVal.textContent = 'N/A';
                elDeltaDesc.textContent = 'Réservé aux acidoses à TA > 12 et HCO₃⁻ < 24';
                elDeltaVal.style.color = 'var(--gds-text-dim)';
            }
        }

        // 4. Horovitz (PaO2/FiO2)
        const elPfVal = document.getElementById('index-pf-val');
        const elPfDesc = document.getElementById('index-pf-desc');
        if (elPfVal && elPfDesc) {
            const pf = analysis.step5.horovitz;
            if (pf) {
                elPfVal.textContent = `${pf.ratio} mmHg`;
                elPfDesc.textContent = pf.label;
                elPfVal.style.color = (pf.severity === 'normal') ? 'var(--gds-green)' : (pf.severity === 'mild' ? 'var(--gds-amber)' : 'var(--gds-red)');
            }
        }

        // 5. Standard Base Excess (SBE)
        const elSbeVal = document.getElementById('index-sbe-val');
        const elSbeDesc = document.getElementById('index-sbe-desc');
        if (elSbeVal && elSbeDesc) {
            const sbe = analysis.step6.sbe;
            elSbeVal.textContent = `${sbe >= 0 ? '+' : ''}${sbe.toFixed(1)} mmol/L`;
            elSbeDesc.textContent = (Math.abs(sbe) <= 2) ? 'Normal (-2 à +2 mmol/L)' : (sbe < -2 ? 'Déficit de bases (composante acide)' : 'Excès de bases (composante alcaline)');
            elSbeVal.style.color = (Math.abs(sbe) <= 2) ? 'var(--gds-green)' : 'var(--gds-cyan)';
        }

        // 6. Diagnostic rapide
        const elDiagVal = document.getElementById('index-diag-val');
        const elDiagDesc = document.getElementById('index-diag-desc');
        if (elDiagVal && elDiagDesc) {
            elDiagVal.textContent = analysis.step2.text;
            elDiagDesc.textContent = analysis.step3.text;
        }

        // B. Panneau Raisonnement Pas à Pas
        setStepContent(1, 'Évaluation du pH', analysis.step1.text, analysis.step1.status === 'normal' ? 'normal' : 'alert');
        setStepContent(2, 'Trouble primaire', analysis.step2.text, analysis.step2.disorder === 'normal' ? 'normal' : 'alert');
        setStepContent(3, 'Évaluation de la compensation', analysis.step3.text, analysis.step3.status === 'adapted' ? 'normal' : 'alert');
        setStepContent(4, 'Trou anionique & Delta-Ratio', analysis.step4.text, analysis.step4.anionGap?.isElevated ? 'alert' : 'normal');
        setStepContent(5, 'Oxygénation & Métabolisme', `${analysis.step5.horovitz?.label || ''}. ${analysis.step5.lactateText}. ${analysis.step5.kText}.`, 'normal');
        setStepContent(6, 'Synthèse & Diagramme de Davenport', `${analysis.step6.zone}. Base Excess (SBE) : ${analysis.step6.sbe >= 0 ? '+' : ''}${analysis.step6.sbe.toFixed(1)} mmol/L.`, 'normal');
    }

    function setStepContent(stepNum, title, desc, tone = 'normal') {
        const titleEl = document.getElementById(`step-${stepNum}-title`);
        const descEl = document.getElementById(`step-${stepNum}-desc`);
        if (titleEl) titleEl.textContent = title;
        if (descEl) descEl.textContent = desc;
    }

    // ── 3. Presets & Cas types ──
    const presetButtons = document.querySelectorAll('.preset-chip');
    presetButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.currentTarget.getAttribute('data-preset');
            loadPresetCase(type);
        });
    });

    function loadPresetCase(type) {
        if (type === 'normal') {
            state.values = {
                pH: 7.40, paCO2: 40.0, hco3: 24.0,
                paO2: 95.0, saO2: 98.0, fiO2: 21.0, lactates: 1.0,
                na: 140.0, cl: 104.0, k: 4.0, albumin: 40.0
            };
        } else {
            const gen = GDS.generateRandomCase(type);
            Object.assign(state.values, gen);
        }

        syncTableInputs(true);
        updateCalculationsAndReasoning();
    }

    // ── 4. Commutateur d'onglets de Diagramme (Davenport vs Siggaard-Andersen) ──
    if (elBtnDiagDavenport && elBtnDiagSiggaard) {
        elBtnDiagDavenport.addEventListener('click', () => {
            elBtnDiagDavenport.classList.add('active');
            elBtnDiagSiggaard.classList.remove('active');
            diagram.setMode('davenport');
        });

        elBtnDiagSiggaard.addEventListener('click', () => {
            elBtnDiagSiggaard.classList.add('active');
            elBtnDiagDavenport.classList.remove('active');
            diagram.setMode('siggaard');
        });
    }

    // ── 5. Commutateur Mode Général (Simulation Libre vs Cas EDN Quiz) ──
    if (elTabLearn && elTabQuiz) {
        elTabLearn.addEventListener('click', () => {
            state.mode = 'learn';
            elTabLearn.classList.add('active');
            elTabQuiz.classList.remove('active');
            if (elSecLearn) elSecLearn.style.display = 'grid';
            if (elSecQuiz) elSecQuiz.classList.remove('active');
        });

        elTabQuiz.addEventListener('click', () => {
            state.mode = 'quiz';
            elTabQuiz.classList.add('active');
            elTabLearn.classList.remove('active');
            if (elSecLearn) elSecLearn.style.display = 'grid'; // Garde le tableau visible pour résoudre le cas !
            if (elSecQuiz) elSecQuiz.classList.add('active');
            renderQuizCase(state.activeCaseIndex);
        });
    }

    // ── 6. Mode Cas Cliniques EDN / Quiz ──
    function initQuizMode() {
        const caseListContainer = document.getElementById('quiz-case-buttons');
        if (!caseListContainer || !window.GDS_CASES) return;

        caseListContainer.innerHTML = '';
        window.GDS_CASES.forEach((c, idx) => {
            const btn = document.createElement('button');
            btn.className = `case-card-btn ${idx === state.activeCaseIndex ? 'active' : ''}`;
            btn.innerHTML = `
                <h4>${c.title}</h4>
                <p><span style="color:var(--gds-cyan);">${c.specialty}</span> &bull; ${c.difficulty}</p>
            `;
            btn.addEventListener('click', () => {
                state.activeCaseIndex = idx;
                document.querySelectorAll('.case-card-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderQuizCase(idx);
            });
            caseListContainer.appendChild(btn);
        });
    }

    function renderQuizCase(index) {
        const c = window.GDS_CASES[index];
        if (!c) return;

        // Charger les valeurs biologiques du cas dans le simulateur
        Object.assign(state.values, c.params);
        syncTableInputs(true);
        updateCalculationsAndReasoning();

        // Afficher l'énoncé du cas
        const elTitle = document.getElementById('quiz-case-title');
        const elContext = document.getElementById('quiz-case-context');
        const elVitals = document.getElementById('quiz-case-vitals');

        if (elTitle) elTitle.textContent = `${c.title} (${c.specialty})`;
        if (elContext) elContext.textContent = c.patient.context;
        if (elVitals && c.patient.vitals) {
            elVitals.innerHTML = `
                <strong>Constantes :</strong> PA ${c.patient.vitals.ta} | FC ${c.patient.vitals.fc} | FR ${c.patient.vitals.fr} | SpO₂ ${c.patient.vitals.spo2} | T° ${c.patient.vitals.temp}
            `;
        }

        // Rendu des questions
        const questionsBox = document.getElementById('quiz-questions-list');
        if (!questionsBox) return;

        questionsBox.innerHTML = '';
        state.quizAnswers = {};
        state.quizValidated = false;

        c.quiz.steps.forEach((step, qIdx) => {
            const qDiv = document.createElement('div');
            qDiv.className = 'quiz-question-box';
            qDiv.id = `qbox-${step.id}`;

            let optionsHtml = '';
            step.options.forEach((opt, oIdx) => {
                optionsHtml += `
                    <label class="quiz-option-label" id="opt-lbl-${step.id}-${oIdx}">
                        <input type="radio" name="quiz-${step.id}" value="${oIdx}">
                        <span>${opt}</span>
                    </label>
                `;
            });

            qDiv.innerHTML = `
                <div class="quiz-question-title">${step.question}</div>
                <div class="quiz-options-list">${optionsHtml}</div>
                <div class="quiz-feedback-box" id="feedback-${step.id}"></div>
            `;

            questionsBox.appendChild(qDiv);

            // Écouteur sur les options radio
            const radios = qDiv.querySelectorAll(`input[name="quiz-${step.id}"]`);
            radios.forEach(r => {
                r.addEventListener('change', (e) => {
                    state.quizAnswers[step.id] = parseInt(e.target.value, 10);
                });
            });
        });

        // Bouton de validation
        const validateBtn = document.getElementById('btn-validate-quiz');
        if (validateBtn) {
            validateBtn.style.display = 'inline-flex';
            validateBtn.textContent = 'Valider mon interprétation';
        }

        // Masquer la conclusion globale
        const diagnosisBox = document.getElementById('quiz-diagnosis-box');
        if (diagnosisBox) diagnosisBox.style.display = 'none';
    }

    const btnValidateQuiz = document.getElementById('btn-validate-quiz');
    if (btnValidateQuiz) {
        btnValidateQuiz.addEventListener('click', () => {
            validateCurrentQuiz();
        });
    }

    function validateCurrentQuiz() {
        const c = window.GDS_CASES[state.activeCaseIndex];
        if (!c) return;

        let totalQuestions = c.quiz.steps.length;
        let correctCount = 0;

        c.quiz.steps.forEach(step => {
            const selected = state.quizAnswers[step.id];
            const feedbackEl = document.getElementById(`feedback-${step.id}`);
            const isCorrect = (selected === step.correctIndex);

            if (isCorrect) correctCount++;

            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.className = `quiz-feedback-box ${isCorrect ? 'correct' : 'incorrect'}`;
                feedbackEl.innerHTML = `
                    <strong>${isCorrect ? '<i class="fas fa-check-circle"></i> Exact !' : '<i class="fas fa-times-circle"></i> Inexact'}</strong><br>
                    ${step.explanation}
                `;
            }

            // Met en surbrillance l'option correcte
            step.options.forEach((opt, oIdx) => {
                const lbl = document.getElementById(`opt-lbl-${step.id}-${oIdx}`);
                if (lbl) {
                    if (oIdx === step.correctIndex) {
                        lbl.style.borderColor = 'var(--gds-green)';
                        lbl.style.background = 'rgba(16, 185, 129, 0.15)';
                    } else if (oIdx === selected && !isCorrect) {
                        lbl.style.borderColor = 'var(--gds-red)';
                        lbl.style.background = 'rgba(239, 68, 68, 0.15)';
                    }
                }
            });
        });

        state.quizValidated = true;

        // Affichage du diagnostic complet et des perles cliniques
        const diagnosisBox = document.getElementById('quiz-diagnosis-box');
        if (diagnosisBox) {
            diagnosisBox.style.display = 'block';
            let pearlsHtml = '';
            if (c.clinicalPearls && c.clinicalPearls.length > 0) {
                pearlsHtml = `
                    <div style="margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.1);">
                        <h4 style="color:var(--gds-cyan); margin:0 0 8px 0; font-family:'Outfit';">Points clés pour l'EDN :</h4>
                        <ul style="margin:0; padding-left:20px; font-size:0.84rem; color:var(--gds-text-dim); line-height:1.5;">
                            ${c.clinicalPearls.map(p => `<li>${p}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }

            const scorePercent = Math.round((correctCount / totalQuestions) * 100);
            diagnosisBox.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h3 style="margin:0; font-family:'Outfit'; color:#fff;"><i class="fas fa-award"></i> Synthèse Clinique EDN</h3>
                    <span style="font-family:'Outfit'; font-weight:800; font-size:1.2rem; color:${scorePercent >= 80 ? 'var(--gds-green)' : (scorePercent >= 50 ? 'var(--gds-amber)' : 'var(--gds-red)')};">Score : ${scorePercent}% (${correctCount}/${totalQuestions})</span>
                </div>
                <p style="font-size:0.9rem; line-height:1.5; color:var(--gds-text); margin:0 0 12px 0;">${c.quiz.diagnosis}</p>
                ${pearlsHtml}
            `;
        }

        // Enregistrement des statistiques & Badges MedGame
        const scorePercent = Math.round((correctCount / totalQuestions) * 100);
        state.stats.completed = (state.stats.completed || 0) + 1;
        state.stats.highScore = Math.max(state.stats.highScore || 0, scorePercent);

        if (elStatCompleted) elStatCompleted.textContent = state.stats.completed.toString();
        if (elStatHighScore) elStatHighScore.textContent = `${state.stats.highScore}%`;

        if (window.BadgeSystem && typeof window.BadgeSystem.recordSkillActivity === 'function') {
            window.BadgeSystem.recordSkillActivity('gds', scorePercent);
        }

        const validateBtn = document.getElementById('btn-validate-quiz');
        if (validateBtn) validateBtn.style.display = 'none';
    }

    // ── 7. Initialisation des badges et stats au chargement ──
    function refreshSkillStats() {
        if (window.BadgeSystem && typeof window.BadgeSystem.getSkillStats === 'function') {
            const stats = window.BadgeSystem.getSkillStats();
            state.stats.completed = stats.gdsCompleted || 0;
            state.stats.highScore = stats.gdsHighScore || 0;
            if (elStatCompleted) elStatCompleted.textContent = state.stats.completed.toString();
            if (elStatHighScore) elStatHighScore.textContent = `${state.stats.highScore}%`;
        }
    }

    // Démarrage initial
    highlightDerivedRow();
    syncTableInputs(true);
    updateCalculationsAndReasoning();
    initQuizMode();
    refreshSkillStats();
});
