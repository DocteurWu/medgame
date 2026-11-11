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
        },

        crb65: {
            id: 'crb65',
            title: 'Score CRB-65 (Pneumonie Aiguë Communautaire)',
            category: 'Pneumologie / Infectiologie',
            description: 'Évaluation de la gravité d’une Pneumonie Aiguë Communautaire (PAC) en pratique ambulatoire ou aux urgences. Guide le lieu de prise en charge.',
            items: [
                { id: 'confusion', label: 'Confusion mentale récente (désorientation temporo-spatiale)', points: 1 },
                { id: 'resp_rate30', label: 'Fréquence respiratoire ≥ 30 cycles/minute (polypnée sévère)', points: 1 },
                { id: 'low_bp', label: 'Pression artérielle basse : PAS < 90 mmHg ou PAD ≤ 60 mmHg', points: 1 },
                { id: 'age65', label: 'Âge ≥ 65 ans', points: 1 }
            ],
            interpret: (total) => {
                if (total === 0) {
                    return {
                        level: 'low',
                        badge: 'CRB-65 = 0 pt (Mortalité très faible < 1 %)',
                        recommendation: 'Prise en charge ambulatoire à domicile possible avec antibiothérapie orale (ex. Amoxicilline en 1ère intention). Réévaluation clinique à 48-72h.',
                        actionClass: 'ok'
                    };
                } else if (total <= 2) {
                    return {
                        level: 'intermediate',
                        badge: `CRB-65 = ${total} pts (Gravité modérée — Mortalité 5 à 10 %)`,
                        recommendation: 'Hospitalisation en secteur conventionnel recommandée. Antibiothérapie probabiliste précoce (ex. Amoxicilline + Acide Clavulanique).',
                        actionClass: 'warn'
                    };
                } else {
                    return {
                        level: 'high',
                        badge: `CRB-65 = ${total} pts (GRAVITÉ MAJEURE — Mortalité > 25 %)`,
                        recommendation: 'URGENCE VITALE : Hospitalisation en soins intensifs ou Réanimation. Antibiothérapie IV d’urgence (C3G + Macrolide), oxygénothérapie à haut débit.',
                        actionClass: 'alert'
                    };
                }
            }
        },

        has_bled: {
            id: 'has_bled',
            title: 'Score HAS-BLED (Risque Hémorragique FA)',
            category: 'Cardiologie / Hématologie',
            description: 'Estimation du risque de saignement majeur chez les patients sous anticoagulation orale pour fibrillation atriale.',
            items: [
                { id: 'hypertension', label: 'Hypertension artérielle non contrôlée (PAS > 160 mmHg)', points: 1 },
                { id: 'renal_hepatic', label: 'Atteinte rénale (créat > 200 µmol/L) ou hépatique (cirrhose / bilirubine > 2x)', points: 1 },
                { id: 'stroke', label: 'Antécédent d’AVC ischémique ou hémorragique', points: 1 },
                { id: 'bleeding', label: 'Antécédent de saignement majeur ou prédisposition hémorragique', points: 1 },
                { id: 'labile_inr', label: 'INR instable (si sous AVK, temps dans la zone thérapeutique < 60 %)', points: 1 },
                { id: 'elderly', label: 'Âge > 65 ans', points: 1 },
                { id: 'drugs_alcohol', label: 'Médicaments favorisant le saignement (AINS, antiagrégants) ou alcool', points: 1 }
            ],
            interpret: (total) => {
                if (total < 3) {
                    return {
                        level: 'low',
                        badge: `HAS-BLED = ${total} pts (Risque hémorragique FAIBLE)`,
                        recommendation: 'Anticoagulation orale bien tolérée. Surveillance biologique standard.',
                        actionClass: 'ok'
                    };
                }
                return {
                    level: 'high',
                    badge: `HAS-BLED = ${total} pts (HAUT RISQUE HÉMORRAGIQUE ≥ 3)`,
                    recommendation: 'Ne contre-indique PAS l’anticoagulation si CHA₂DS₂-VASc ≥ 2, mais impose : correction stricte des FDR modifiables (PA < 140, arrêt AINS/alcool), choix d’un AOD plutôt qu’un AVK, et surveillance clinique rapprochée.',
                    actionClass: 'alert'
                };
            }
        },

        ottawa_ankle: {
            id: 'ottawa_ankle',
            title: 'Règles d’Ottawa (Traumatisme Cheville / Pied)',
            category: 'Urgences / Orthopédie',
            description: 'Critères de décision pour prescrire une radiographie de cheville ou du pied après traumatisme aigu (sensibilité > 98 % pour éliminer une fracture).',
            items: [
                { id: 'weight_bearing', label: 'Impossibilité de faire 4 pas en appui complet (immédiatement et aux urgences)', points: 1 },
                { id: 'lat_malleolus', label: 'Douleur à la palpation du bord postérieur de la malléole latérale (sur 6 cm)', points: 1 },
                { id: 'med_malleolus', label: 'Douleur à la palpation du bord postérieur de la malléole médiale (sur 6 cm)', points: 1 },
                { id: 'navicular_base5', label: 'Douleur à la palpation de la base du 5e métatarsien ou de l’os naviculaire', points: 1 }
            ],
            interpret: (total) => {
                if (total === 0) {
                    return {
                        level: 'low',
                        badge: 'Critères d’Ottawa NÉGATIFS (0 critère)',
                        recommendation: 'PAS DE RADIOGRAPHIE INDIQUÉE. Une fracture malléolaire ou du tarse est éliminée avec une sensibilité > 98 %. Traitement fonctionnel (repos, glace, surélévation, antalgiques, reprise d’appui précoce).',
                        actionClass: 'ok'
                    };
                }
                return {
                    level: 'high',
                    badge: 'Critères d’Ottawa POSITIFS (≥ 1 critère)',
                    recommendation: 'INDICATION À LA RADIOGRAPHIE en urgence : Radiographie de cheville face/profil (ou radiographie du pied si douleur du médio-pied/5e méta) pour éliminer une fracture déplacée.',
                    actionClass: 'alert'
                };
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
            // Mettre à jour l'onglet actif dans la barre
            if (this.modalEl) {
                this.modalEl.querySelectorAll('.score-tab-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.scoreKey === this.activeScoreKey);
                });
            }

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
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                        <div>
                            <h4>${escapeHtml(score.title)}</h4>
                            <p class="score-desc">${escapeHtml(score.description)}</p>
                        </div>
                        ${!score.isSelectGroups ? `
                            <button type="button" id="btn-score-autofill" class="btn-ghost-small" style="background:rgba(59,130,246,0.12); color:#2563eb; border:1px solid rgba(59,130,246,0.3); border-radius:6px; padding:6px 10px; font-weight:600; cursor:pointer; font-size:0.85em;">
                                <i class="fas fa-wand-magic-sparkles"></i> Détecter depuis le dossier
                            </button>
                        ` : ''}
                    </div>
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

            const autoBtn = container.querySelector('#btn-score-autofill');
            if (autoBtn) {
                autoBtn.addEventListener('click', () => {
                    this.autoFillFromCase();
                });
            }
        }

        autoFillFromCase(caseData) {
            if (!caseData) caseData = window.gameState?.currentCase;
            if (!caseData) return;

            const score = CLINICAL_SCORES[this.activeScoreKey];
            if (!score || score.isSelectGroups) return;

            const cst = (caseData.examenClinique && caseData.examenClinique.constantes) || {};
            const pat = caseData.patient || {};
            const atcd = caseData.interrogatoire?.antecedents || {};
            const medList = Array.isArray(atcd.medicaux) ? atcd.medicaux.map(m => (typeof m === 'string' ? m : `${m.type || ''} ${m.traitement || ''}`)).join(' ') : '';
            const age = parseInt(pat.age, 10) || 50;
            const isFemale = /^f/i.test(pat.sexe || '');

            const hr = parseInt(cst.pouls, 10) || (window.vitalSigns?.props?.heartRate) || 75;
            const bpStr = String(cst.tension || '');
            const bpParts = bpStr.split(/[/ ]+/).map(p => parseInt(p, 10));
            const sysBp = bpParts[0] || (window.vitalSigns?.props?.systolic) || 120;
            const diaBp = bpParts[1] || (window.vitalSigns?.props?.diastolic) || 80;
            const rr = parseInt(cst.frequenceRespiratoire, 10) || (window.vitalSigns?.props?.respiratoryRate) || 16;

            const curState = this.state[score.id] || {};

            if (score.id === 'wells_ep') {
                if (hr > 100) curState.tachycardia = true;
                if (/cancer|néoplasie|tumeur/i.test(medList)) curState.cancer = true;
                if (/embolie|thrombose|tvp|phlébite/i.test(medList)) curState.prior_pe_dvt = true;
            } else if (score.id === 'qsofa') {
                if (rr >= 22) curState.resp_rate = true;
                if (sysBp <= 100) curState.sys_bp = true;
            } else if (score.id === 'cha2ds2_vasc') {
                if (age >= 75) curState.age75 = true;
                else if (age >= 65) curState.age65 = true;
                if (isFemale) curState.female = true;
                if (/hypertension|hta/i.test(medList) || sysBp >= 140) curState.htn = true;
                if (/diab/i.test(medList)) curState.diabetes = true;
                if (/avc|ait|ischémie cérébrale/i.test(medList)) curState.stroke = true;
                if (/infarctus|sca|angor|aomi|coronaire/i.test(medList)) curState.vascular = true;
                if (/insuffisance cardiaque|fevg/i.test(medList)) curState.chf = true;
            } else if (score.id === 'crb65') {
                if (age >= 65) curState.age65 = true;
                if (rr >= 30) curState.resp_rate30 = true;
                if (sysBp < 90 || diaBp <= 60) curState.low_bp = true;
            } else if (score.id === 'has_bled') {
                if (sysBp > 160) curState.hypertension = true;
                if (age > 65) curState.elderly = true;
                if (/avc|ait/i.test(medList)) curState.stroke = true;
                if (/rein|rénale|créat/i.test(medList)) curState.renal_hepatic = true;
                if (/foie|hépatique|cirrhose/i.test(medList)) curState.renal_hepatic = true;
            }

            this.state[score.id] = curState;
            this.renderActiveScore();
            if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('correct');
            if (typeof window.showNotification === 'function') {
                window.showNotification('✨ Données du patient détectées et appliquées au score');
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
        close: () => getScoresManager().close(),
        autoFill: (caseData) => getScoresManager().autoFillFromCase(caseData)
    };

})();
