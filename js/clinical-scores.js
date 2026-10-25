/**
 * js/clinical-scores.js — Calculateur Universel de Scores Cliniques Décisionnels (R2C / EDN)
 *
 * Outil pédagogique interactif pour étudiants en médecine :
 * - Score de Wells (Embolie Pulmonaire)
 * - Score de Genève révisé (Embolie Pulmonaire)
 * - Score de Glasgow (GCS - Coma / Traumatologie)
 * - Score qSOFA (Dépistage du Sepsis en urgence)
 * - Score CHA₂DS₂-VASc (Risque thrombo-embolique dans la FA)
 *
 * S'intègre dans game.html sous forme de tiroir / modale clinique accessible à tout moment.
 */

(function () {
    'use strict';

    const CLINICAL_SCORES = {
        wells_ep: {
            id: 'wells_ep',
            title: 'Score de Wells (Embolie Pulmonaire)',
            category: 'Cardiologie / Pneumologie',
            description: 'Estimation de la probabilité clinique pré-test de l’Embolie Pulmonaire (EP). Guide l’indication des D-Dimères vs Angioscanner.',
            items: [
                { id: 'tvp_signs', label: 'Signes cliniques de TVP (œdème unilatéral et douleur à la palpation)', points: 3.0 },
                { id: 'alt_diag', label: 'Diagnostic alternatif moins probable que l’embolie pulmonaire', points: 3.0 },
                { id: 'tachycardia', label: 'Fréquence cardiaque > 100 battements/minute', points: 1.5 },
                { id: 'immobilization', label: 'Immobilisation ≥ 3 jours consécutifs ou chirurgie dans les 4 semaines', points: 1.5 },
                { id: 'prior_pe_dvt', label: 'Antécédent personnel avéré d’EP ou de TVP', points: 1.5 },
                { id: 'hemoptysis', label: 'Présence d’une hémoptysie', points: 1.0 },
                { id: 'cancer', label: 'Cancer actif ou traité dans les 6 derniers mois (ou palliatif)', points: 1.0 }
            ],
            interpret: (total) => {
                if (total < 2.0) {
                    return {
                        level: 'low',
                        badge: 'Probabilité FAIBLE (< 2 pts)',
                        recommendation: 'Indication aux D-Dimères ultrasensibles en 1ère intention. Si négatifs (< 500 ng/mL ou seuil ajusté à l’âge) : EP formellement éliminée sans imagerie irradiante.',
                        actionClass: 'ok'
                    };
                } else if (total <= 6.0) {
                    return {
                        level: 'intermediate',
                        badge: 'Probabilité INTERMÉDIAIRE (2 à 6 pts)',
                        recommendation: 'D-Dimères en 1ère intention. Si positifs : réaliser un Angioscanner thoracique spiralé avec injection en urgence.',
                        actionClass: 'warn'
                    };
                } else {
                    return {
                        level: 'high',
                        badge: 'Probabilité FORTE (> 6 pts)',
                        recommendation: 'PAS DE D-DIMÈRES (inutiles et retardent la prise en charge). Réaliser directement un Angioscanner thoracique en urgence. Envisager anticoagulation d’emblée si non contre-indiquée.',
                        actionClass: 'alert'
                    };
                }
            }
        },

        qsofa: {
            id: 'qsofa',
            title: 'Score qSOFA (Quick SOFA - Dépistage Sepsis)',
            category: 'Urgences / Réanimation',
            description: 'Dépistage précoce des patients suspects d’infection à haut risque de défaillance d’organe et de mortalité hors réanimation.',
            items: [
                { id: 'resp_rate', label: 'Fréquence respiratoire ≥ 22 cycles/minute (tachypnée)', points: 1 },
                { id: 'altered_mental', label: 'Altération de la conscience ou des fonctions supérieures (Glasgow < 15)', points: 1 },
                { id: 'sys_bp', label: 'Pression artérielle systolique ≤ 100 mmHg (hypotension artérielle)', points: 1 }
            ],
            interpret: (total) => {
                if (total >= 2) {
                    return {
                        level: 'high',
                        badge: 'qSOFA POSITIF (≥ 2 points)',
                        recommendation: 'ALERTE SEPSIS GRAVE : Risque élevé de décompensation et de mortalité. Prélèvements bactériologiques (hémocultures), remplissage vasculaire, antibiothérapie probabiliste dans l’heure ("Golden Hour"), monitorage continu et avis réanimation.',
                        actionClass: 'alert'
                    };
                }
                return {
                    level: 'low',
                    badge: 'qSOFA Négatif (< 2 points)',
                    recommendation: 'Risque immédiat plus faible mais réévaluation rapprochée impérative si tableau infectieux évolutif.',
                    actionClass: 'ok'
                };
            }
        },

        glasgow: {
            id: 'glasgow',
            title: 'Score de Glasgow (GCS - Évaluation du Coma)',
            category: 'Neurologie / Urgences',
            description: 'Évaluation standardisée de l’état de conscience et de la profondeur d’un coma (traumatismes crâniens, AVC, intoxications).',
            isSelectGroups: true,
            groups: [
                {
                    name: 'eyes',
                    label: 'Ouverture des yeux (Y)',
                    options: [
                        { label: 'Spontanée', points: 4 },
                        { label: 'À la demande / à la parole', points: 3 },
                        { label: 'À la stimulation douloureuse', points: 2 },
                        { label: 'Nulle', points: 1 }
                    ]
                },
                {
                    name: 'verbal',
                    label: 'Réponse verbale (V)',
                    options: [
                        { label: 'Orientée, normale', points: 5 },
                        { label: 'Confuse (mots désorientés mais phrases construites)', points: 4 },
                        { label: 'Inappropriée (mots isolés sans cohérence)', points: 3 },
                        { label: 'Incompréhensible (gémissements, sons inarticulés)', points: 2 },
                        { label: 'Nulle', points: 1 }
                    ]
                },
                {
                    name: 'motor',
                    label: 'Réponse motrice (M)',
                    options: [
                        { label: 'Obéit aux ordres simples', points: 6 },
                        { label: 'Orientée / adaptée à la douleur (chasse le stimulus)', points: 5 },
                        { label: 'Évitement / retrait non adapté', points: 4 },
                        { label: 'Flexion stéréotypée anormale (décortication)', points: 3 },
                        { label: 'Extension stéréotypée anormale (décérébration)', points: 2 },
                        { label: 'Nulle (flaccidité complète)', points: 1 }
                    ]
                }
            ],
            interpret: (total) => {
                if (total <= 8) {
                    return {
                        level: 'critical',
                        badge: `GCS ${total}/15 : COMA GRAVE`,
                        recommendation: 'COMA PROFOND (GCS ≤ 8) : Perte des réflexes de protection des voies aériennes. Indication formelle à une Intubation Oro-Trachéale (IOT) avec ventilation assistée d’urgence.',
                        actionClass: 'alert'
                    };
                } else if (total <= 12) {
                    return {
                        level: 'intermediate',
                        badge: `GCS ${total}/15 : Altération modérée`,
                        recommendation: 'Altération modérée de la conscience : surveillance neurologique horaire stricte, scanner cérébral non injecté urgent.',
                        actionClass: 'warn'
                    };
                } else if (total < 15) {
                    return {
                        level: 'mild',
                        badge: `GCS ${total}/15 : Altération légère`,
                        recommendation: 'Traumatisme ou atteinte crânienne légère : surveillance clinique rapprochée.',
                        actionClass: 'ok'
                    };
                }
                return {
                    level: 'normal',
                    badge: 'GCS 15/15 : Conscience normale',
                    recommendation: 'Patient parfaitement vigilant, orienté et réactif aux ordres.',
                    actionClass: 'ok'
                };
            }
        },

        cha2ds2_vasc: {
            id: 'cha2ds2_vasc',
            title: 'Score CHA₂DS₂-VASc (Fibrillation Atriale)',
            category: 'Cardiologie',
            description: 'Évaluation du risque annuel d’Accident Vasculaire Cérébral (AVC) et d’embolie systémique chez le patient en Fibrillation Atriale (FA non valvulaire).',
            items: [
                { id: 'chf', label: 'Insuffisance cardiaque congestive ou dysfonction systolique VG (FEVG ≤ 40 %)', points: 1 },
                { id: 'htn', label: 'Hypertension artérielle (traitée ou TA > 140/90 mmHg au repos)', points: 1 },
                { id: 'age75', label: 'Âge ≥ 75 ans (compte double)', points: 2 },
                { id: 'diabetes', label: 'Diabète sucré (type 1 ou type 2)', points: 1 },
                { id: 'stroke', label: 'Antécédent d’AVC ischémique, d’AIT ou d’embolie systémique (compte double)', points: 2 },
                { id: 'vascular', label: 'Maladie vasculaire documentée (ATCD d’Infarctus, AOMI ou plaque aortique)', points: 1 },
                { id: 'age65', label: 'Âge compris entre 65 et 74 ans', points: 1 },
                { id: 'female', label: 'Sexe féminin', points: 1 }
            ],
            interpret: (total) => {
                if (total === 0) {
                    return {
                        level: 'low',
                        badge: 'CHA₂DS₂-VASc = 0 pt (Risque très faible)',
                        recommendation: 'Pas d’anticoagulation curative requise. Ne pas prescrire d’aspirine seule (inefficace et risque hémorragique).',
                        actionClass: 'ok'
                    };
                } else if (total === 1) {
                    return {
                        level: 'intermediate',
                        badge: 'CHA₂DS₂-VASc = 1 pt (Risque intermédiaire)',
                        recommendation: 'Chez l’homme : Anticoagulation orale efficace (AOD en 1ère intention) recommandée. Chez la femme si l’unique point est le sexe : pas d’anticoagulation nécessaire.',
                        actionClass: 'warn'
                    };
                } else {
                    return {
                        level: 'high',
                        badge: `CHA₂DS₂-VASc = ${total} pts (Risque ÉLEVÉ)`,
                        recommendation: 'Indication formelle à une Anticoagulation Orale Curative au long cours (AOD type Apixaban/Rivaroxaban en 1ère intention, ou AVK si valve mécanique/sténose mitrale). Calculer le score HAS-BLED pour évaluer le risque hémorragique.',
                        actionClass: 'alert'
                    };
                }
            }
        }
    };

    class ClinicalScoresManager {
        constructor() {
            this.modalEl = null;
            this.activeScoreKey = 'wells_ep';
            this.state = {};
            this.initDOM();
        }

        initDOM() {
            if (document.getElementById('clinical-scores-drawer')) {
                this.modalEl = document.getElementById('clinical-scores-drawer');
                return;
            }

            const el = document.createElement('div');
            el.id = 'clinical-scores-drawer';
            el.className = 'scores-drawer-overlay';
            el.setAttribute('aria-hidden', 'true');
            el.innerHTML = `
                <div class="scores-drawer-panel" role="dialog" aria-labelledby="scores-drawer-title">
                    <div class="scores-drawer-header">
                        <div class="scores-drawer-head-info">
                            <span class="scores-dept-pill"><i class="fas fa-stethoscope"></i> Aide Décisionnelle R2C</span>
                            <h3 id="scores-drawer-title" class="scores-drawer-title">Calculateur de Scores Cliniques</h3>
                        </div>
                        <button type="button" class="scores-close-btn" aria-label="Fermer le calculateur">&times;</button>
                    </div>

                    <div class="scores-drawer-tabs" role="tablist">
                        ${Object.values(CLINICAL_SCORES).map((s, idx) => `
                            <button type="button" class="score-tab-btn ${idx === 0 ? 'active' : ''}" data-score-key="${s.id}" role="tab">
                                ${escapeHtml(s.title.split('(')[0].trim())}
                            </button>
                        `).join('')}
                    </div>

                    <div class="scores-drawer-body">
                        <div id="score-calculator-content" class="score-calc-content">
                            <!-- Rendu dynamique du score actif -->
                        </div>
                    </div>

                    <div class="scores-drawer-footer">
                        <button type="button" id="btn-insert-score-chart" class="btn-primary-action">
                            <i class="fas fa-file-medical"></i> Consigner ce score au dossier clinique
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(el);
            this.modalEl = el;

            // Événements
            const closeBtn = el.querySelector('.scores-close-btn');
            if (closeBtn) closeBtn.addEventListener('click', () => this.close());
            el.addEventListener('click', (e) => {
                if (e.target === el) this.close();
            });

            el.querySelectorAll('.score-tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    el.querySelectorAll('.score-tab-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.activeScoreKey = btn.dataset.scoreKey;
                    this.renderActiveScore();
                });
            });

            const insertBtn = el.querySelector('#btn-insert-score-chart');
            if (insertBtn) {
                insertBtn.addEventListener('click', () => {
                    this.insertScoreToChart();
                });
            }

            // Branchement des déclencheurs présents dans l'interface
            const bindTriggers = () => {
                document.querySelectorAll('#btn-open-scores-exam, #btn-open-scores-decision, .btn-scores-trigger').forEach(btn => {
                    if (btn._scoresBound) return;
                    btn._scoresBound = true;
                    btn.addEventListener('click', () => {
                        const target = btn.dataset.targetScore || 'wells_ep';
                        this.open(target);
                    });
                });
            };
            bindTriggers();
            document.addEventListener('DOMContentLoaded', bindTriggers);

            this.renderActiveScore();
        }

        open(scoreKey) {
            if (scoreKey && CLINICAL_SCORES[scoreKey]) {
                this.activeScoreKey = scoreKey;
                const tab = this.modalEl.querySelector(`.score-tab-btn[data-score-key="${scoreKey}"]`);
                if (tab) {
                    this.modalEl.querySelectorAll('.score-tab-btn').forEach(b => b.classList.remove('active'));
                    tab.classList.add('active');
                }
            }
            this.renderActiveScore();
            this.modalEl.classList.add('active');
            this.modalEl.setAttribute('aria-hidden', 'false');
            if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('paper');
        }

        close() {
            if (!this.modalEl) return;
            this.modalEl.classList.remove('active');
            this.modalEl.setAttribute('aria-hidden', 'true');
            if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('click');
        }

        renderActiveScore() {
            const container = this.modalEl.querySelector('#score-calculator-content');
            if (!container) return;

            const score = CLINICAL_SCORES[this.activeScoreKey];
            if (!score) return;

            if (!this.state[score.id]) {
                this.state[score.id] = score.isSelectGroups ? { eyes: 4, verbal: 5, motor: 6 } : {};
            }

            let formHtml = '';

            if (score.isSelectGroups) {
                // Pour Glasgow (groupes déroulants ou radio pills)
                formHtml = score.groups.map(group => `
                    <div class="score-group-card">
                        <label class="score-group-label"><strong>${escapeHtml(group.label)}</strong></label>
                        <div class="score-pills-row" data-group-name="${group.name}">
                            ${group.options.map(opt => {
                                const isChecked = this.state[score.id][group.name] === opt.points;
                                return `
                                    <button type="button" class="score-pill-opt ${isChecked ? 'selected' : ''}" data-group="${group.name}" data-points="${opt.points}">
                                        <span class="pill-pts">+${opt.points}</span>
                                        <span class="pill-text">${escapeHtml(opt.label)}</span>
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `).join('');
            } else {
                // Pour Wells, qSOFA, CHA2DS2-VASc (checkboxes)
                formHtml = `
                    <div class="score-items-list">
                        ${score.items.map(item => {
                            const isChecked = !!this.state[score.id][item.id];
                            return `
                                <label class="score-item-row ${isChecked ? 'checked' : ''}">
                                    <input type="checkbox" class="score-checkbox" data-item-id="${item.id}" data-points="${item.points}" ${isChecked ? 'checked' : ''}>
                                    <span class="score-item-pts">+${item.points}</span>
                                    <span class="score-item-text">${escapeHtml(item.label)}</span>
                                </label>
                            `;
                        }).join('')}
                    </div>
                `;
            }

            const total = this.computeTotal(score);
            const interp = score.interpret(total);

            container.innerHTML = `
                <div class="score-info-banner">
                    <h4>${escapeHtml(score.title)}</h4>
                    <p class="score-desc">${escapeHtml(score.description)}</p>
                </div>

                <div class="score-inputs-wrapper">
                    ${formHtml}
                </div>

                <div class="score-summary-card ${interp.actionClass}">
                    <div class="score-summary-header">
                        <div class="score-total-display">
                            <span class="score-total-num">${total}</span>
                            <span class="score-total-label">point${total > 1 ? 's' : ''}</span>
                        </div>
                        <div class="score-level-badge ${interp.actionClass}">
                            ${escapeHtml(interp.badge)}
                        </div>
                    </div>
                    <div class="score-recommendation">
                        <strong><i class="fas fa-stethoscope"></i> Recommandation Clinique R2C :</strong>
                        <p>${escapeHtml(interp.recommendation)}</p>
                    </div>
                </div>
            `;

            // Brancher les événements sur les nouveaux inputs
            if (score.isSelectGroups) {
                container.querySelectorAll('.score-pill-opt').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const grp = btn.dataset.group;
                        const pts = parseInt(btn.dataset.points, 10);
                        this.state[score.id][grp] = pts;
                        if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('click');
                        this.renderActiveScore();
                    });
                });
            } else {
                container.querySelectorAll('.score-checkbox').forEach(cb => {
                    cb.addEventListener('change', () => {
                        this.state[score.id][cb.dataset.itemId] = cb.checked;
                        if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('click');
                        this.renderActiveScore();
                    });
                });
            }
        }

        computeTotal(score) {
            const sData = this.state[score.id] || {};
            if (score.isSelectGroups) {
                return (sData.eyes || 4) + (sData.verbal || 5) + (sData.motor || 6);
            }
            let total = 0;
            score.items.forEach(item => {
                if (sData[item.id]) total += item.points;
            });
            return total;
        }

        insertScoreToChart() {
            const score = CLINICAL_SCORES[this.activeScoreKey];
            if (!score) return;

            const total = this.computeTotal(score);
            const interp = score.interpret(total);
            const note = `[Score R2C] ${score.title} = ${total} pts — ${interp.badge}. Conduite à tenir : ${interp.recommendation}`;

            if (typeof window.showNotification === 'function') {
                window.showNotification(`Score consigné au dossier : ${score.title.split('(')[0].trim()} = ${total} pts`);
            }
            if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('correct');

            // Enregistrer dans la démarche clinique pour la notation
            if (window.scoringState && window.scoringState.demarche) {
                if (!window.scoringState.demarche.clinicalScores) {
                    window.scoringState.demarche.clinicalScores = [];
                }
                window.scoringState.demarche.clinicalScores.push({
                    scoreId: score.id,
                    scoreTitle: score.title,
                    total,
                    interpretation: interp.badge,
                    timestamp: Date.now()
                });
            }

            this.close();
        }
    }

    // Instanciation au chargement
    let managerInstance = null;
    function getScoresManager() {
        if (!managerInstance && typeof document !== 'undefined') {
            managerInstance = new ClinicalScoresManager();
        }
        return managerInstance;
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => getScoresManager());
        } else {
            getScoresManager();
        }
    }

    window.MedGameScores = {
        SCORES: CLINICAL_SCORES,
        open: (key) => getScoresManager().open(key),
        close: () => getScoresManager().close()
    };

})();
