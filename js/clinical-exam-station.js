/**
 * js/clinical-exam-station.js — Table d'Examen Clinique Interactive & Stéthoscope Multizone
 *
 * Conçu pour les étudiants en médecine et externes hospitaliers :
 * 1. Examen physique méthodique par appareil (Cardio, Pulmonaire, Abdomen, Neuro, Cutané/Vasculaire, ORL, Locomoteur).
 * 2. Visualisation claire des manœuvres sémiologiques réelles (signe du godet, Murphy, Babinski, auscultation 4 foyers).
 * 3. Stéthoscope interactif haute fidélité connecté au moteur audio physiologique (MedGameMedical).
 * 4. Synchronisation transparente avec le chat LLM, la grille ECOS et le Carnet d'Observation.
 */

(function () {
    'use strict';

    function escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    const APPAREILS = [
        {
            id: 'examenCardiovasculaire',
            name: 'Cardiovasculaire',
            icon: 'fa-heart-pulse',
            color: '#e11d48',
            manoeuvres: ['Auscultation des 4 foyers (Aortique, Pulmonaire, Tricuspide, Mitral)', 'Palpation des pouls périphériques', 'Recherche de reflux hépato-jugulaire et turgescence', 'Recherche d’œdèmes des membres inférieurs (signe du godet)'],
            hasAudio: true,
            audioType: 'cardio'
        },
        {
            id: 'examenPulmonaire',
            name: 'Pulmonaire & Respiratoire',
            icon: 'fa-lungs',
            color: '#0284c7',
            manoeuvres: ['Auscultation comparative des sommets et bases pulmonaires', 'Palpation des vibrations vocales', 'Percussion thoracique (matité / tympanisme)', 'Recherche de signes de détresse (tirage, battement des ailes du nez)'],
            hasAudio: true,
            audioType: 'pulmo'
        },
        {
            id: 'examenAbdominal',
            name: 'Abdominal & Digestif',
            icon: 'fa-hand-dots',
            color: '#d97706',
            manoeuvres: ['Inspection (cicatrices, météorisme, hernies)', 'Auscultation des bruits hydro-aériques (BHA)', 'Palpation douce puis profonde des 4 quadrants', 'Recherche de défense, contracture, signe de Murphy (vésicule) et McBurney (appendicite)']
        },
        {
            id: 'examenNeurologique',
            name: 'Neurologique & Vigilance',
            icon: 'fa-brain',
            color: '#7c3aed',
            manoeuvres: ['Évaluation du score de Glasgow (GCS)', 'Examen pupillaire (taille, symétrie, réflexe photomoteur)', 'Motricité et sensibilité des 4 membres', 'Réflexes ostéotendineux (ROT) et signe de Babinski', 'Signes méningés (raideur de nuque, Kernig, Brudzinski)']
        },
        {
            id: 'aspectGeneral',
            name: 'État Général & Constantes',
            icon: 'fa-user-doctor',
            color: '#059669',
            manoeuvres: ['Appréciation de l’état général (asthénie, sueurs, pâleur)', 'Temps de recoloration cutanée (TRC < 2s)', 'Recherche de marbrures aux membres inférieurs', 'Examen cutané complet (éruption, purpura, plaies)']
        },
        {
            id: 'examenOrl',
            name: 'ORL & Stomatologie',
            icon: 'fa-head-side-cough',
            color: '#ea580c',
            manoeuvres: ['Examen de l’oropharynx et des amygdales', 'Palpation des aires ganglionnaires cervicales', 'Otoscopie bilatérale', 'Examen de la muqueuse buccale et de la langue']
        },
        {
            id: 'examenMusculosquelettique',
            name: 'Locomoteur & Ostéo-articulaire',
            icon: 'fa-bone',
            color: '#475569',
            manoeuvres: ['Palpation articulaire et recherche d’épanchement', 'Mobilités articulaires actives et passives', 'Recherche de points douloureux osseux ciblés', 'Testing musculaire et marche']
        }
    ];

    const HOTSPOTS = {
        cardio: [
            { id: 'aortique', name: 'Foyer Aortique', anatomical: '2e EIC Droit', desc: 'Rétrécissement / Insuffisance Aortique' },
            { id: 'pulmonaire', name: 'Foyer Pulmonaire', anatomical: '2e EIC Gauche', desc: 'Valve Pulmonaire & Dédoublement B2' },
            { id: 'tricuspide', name: 'Foyer Tricuspide', anatomical: '4e EIC Gauche', desc: 'Insuffisance Tricuspidienne' },
            { id: 'apex', name: 'Foyer Mitral (Apex)', anatomical: '5e EICG LMC', desc: 'B1, B3, B4, Insuffisance / Rétrécissement Mitral' }
        ],
        pulmo: [
            { id: 'bases', name: 'Bases Postérieures', anatomical: 'Bases Bilatérales', desc: 'Crépitants (OAP, Pneumonie) & Abolition MV' },
            { id: 'sommet', name: 'Champs Supérieurs', anatomical: 'Antéro-supérieurs', desc: 'Sibilants (Asthme, BPCO) & MV Normal' }
        ]
    };

    class ClinicalExamStation {
        constructor() {
            this.containerEl = null;
            this.activeAppareilId = 'examenCardiovasculaire';
            this.examinedSet = new Set();
            this.isStethoscopePlaying = false;
            this.currentAudioType = null;
            this.currentHotspot = 'apex';
            this.realAudioHandle = null;
            this.audioMode = 'synth';
            this.init();
        }

        init() {
            if (typeof document === 'undefined') return;

            // Écouter les événements de jeu
            document.addEventListener('medgame:turn-applied', (e) => {
                const input = e.detail?.input || '';
                const parsed = e.detail?.parsed || {};
                this.syncFromTurn(input, parsed);
            });

            document.addEventListener('medgame:case-loaded', () => {
                this.reset();
            });
        }

        reset() {
            this.examinedSet.clear();
            this.stopStethoscope();
            this.currentHotspot = 'apex';
            this.render();
        }

        /**
         * Monte ou met à jour la station d'examen dans #section-examen-clinique
         */
        mount() {
            const section = document.getElementById('section-examen-clinique');
            if (!section) return;

            // Assurer que la section et sa carte sont bien visibles
            section.style.display = '';
            const card = section.querySelector('#examen-clinique');
            if (card) card.style.display = 'block';

            let mountPoint = document.getElementById('clinical-exam-station-mount');
            if (!mountPoint) {
                mountPoint = document.createElement('div');
                mountPoint.id = 'clinical-exam-station-mount';
                mountPoint.className = 'clinical-exam-station';

                const targetGrid = section.querySelector('.exam-details-grid') || section.querySelector('.grid-layout') || card;
                if (targetGrid) {
                    targetGrid.innerHTML = '';
                    targetGrid.appendChild(mountPoint);
                } else {
                    section.appendChild(mountPoint);
                }
            }

            this.containerEl = mountPoint;
            this.render();
        }

        render() {
            if (!this.containerEl) return;
            const caseData = window.gameState?.currentCase;
            if (!caseData) {
                this.containerEl.innerHTML = '<p class="exam-station-empty">Chargement du dossier patient...</p>';
                return;
            }

            const activeApp = APPAREILS.find(a => a.id === this.activeAppareilId) || APPAREILS[0];
            const examData = caseData.examenClinique || {};
            const findingRaw = examData[activeApp.id] || (activeApp.id === 'aspectGeneral' ? examData.aspectGeneral : null);
            const isExamined = this.examinedSet.has(activeApp.id);

            let findingText = '';
            if (typeof findingRaw === 'object' && findingRaw !== null) {
                findingText = Object.entries(findingRaw)
                    .map(([k, v]) => `<strong>${k} :</strong> ${v}`)
                    .join('<br>');
            } else if (typeof findingRaw === 'string') {
                findingText = findingRaw;
            } else {
                findingText = "Aucune anomalie décelée. Examen normal pour cet appareil.";
            }

            this.containerEl.innerHTML = `
                <div class="exam-station-container">
                    <div class="exam-station-header">
                        <div class="station-head-info">
                            <span class="station-dept-tag"><i class="fas fa-stethoscope"></i> Table d'Examen Clinique Hospitalière</span>
                            <h3 class="station-title">Examen Physique Méthodique par Appareil</h3>
                        </div>
                        <div class="station-progress-pill">
                            <i class="fas fa-clipboard-check"></i>
                            <span>${this.examinedSet.size}/${APPAREILS.length} appareils explorés</span>
                        </div>
                    </div>

                    <div class="exam-station-grid">
                        <!-- Sélecteur d'appareils -->
                        <div class="exam-appareils-sidebar">
                            ${APPAREILS.map(app => {
                                const isSelected = app.id === activeApp.id;
                                const isDone = this.examinedSet.has(app.id);
                                return `
                                    <button type="button" class="exam-appareil-btn ${isSelected ? 'active' : ''} ${isDone ? 'examined' : ''}" data-appareil-id="${app.id}">
                                        <div class="appareil-btn-icon" style="background:${app.color}18; color:${app.color};">
                                            <i class="fas ${app.icon}"></i>
                                        </div>
                                        <div class="appareil-btn-info">
                                            <span class="appareil-btn-name">${app.name}</span>
                                            <span class="appareil-btn-status">${isDone ? '✓ Exploré' : 'À examiner'}</span>
                                        </div>
                                    </button>
                                `;
                            }).join('')}
                        </div>

                        <!-- Panneau de détail et manœuvres -->
                        <div class="exam-workbench-panel">
                            <div class="workbench-header" style="border-left: 4px solid ${activeApp.color};">
                                <div class="workbench-title-group">
                                    <span class="workbench-badge" style="color:${activeApp.color};">${activeApp.name}</span>
                                    <h4>Manœuvres Sémiologiques Recommandées (R2C)</h4>
                                </div>
                                <div class="workbench-actions">
                                    ${activeApp.hasAudio ? `
                                        <button type="button" id="btn-toggle-stethoscope" class="btn-stethoscope ${this.isStethoscopePlaying ? 'playing' : ''}">
                                            <i class="fas ${this.isStethoscopePlaying ? 'fa-stop-circle' : 'fa-headset'}"></i>
                                            <span>${this.isStethoscopePlaying ? 'Arrêter le Stéthoscope' : 'Auscultation Audio Directe'}</span>
                                        </button>
                                    ` : ''}
                                    <button type="button" id="btn-perform-exam" class="btn-perform-exam ${isExamined ? 're-examine' : ''}">
                                        <i class="fas fa-hand-holding-medical"></i>
                                        <span>${isExamined ? 'Ré-examiner cet appareil' : 'Réaliser cet examen clinique'}</span>
                                    </button>
                                </div>
                            </div>

                            ${activeApp.hasAudio ? (() => {
                                const hotspotsList = activeApp.audioType === 'cardio' ? HOTSPOTS.cardio : HOTSPOTS.pulmo;
                                const activeHotspotObj = hotspotsList.find(h => h.id === this.currentHotspot) || hotspotsList[0];
                                return `
                                    <div class="stetho-foyers-container">
                                        <div class="foyers-bar-header">
                                            <span class="foyers-title"><i class="fas fa-bullseye"></i> Foyer Anatomique d'Auscultation :</span>
                                            ${this.isStethoscopePlaying ? `
                                                <span class="stetho-audio-badge ${this.audioMode}">
                                                    <i class="fas ${this.audioMode === 'real' ? 'fa-wave-square' : 'fa-sliders-h'}"></i>
                                                    ${this.audioMode === 'real' ? 'Audio Clinique Réel' : 'Synthèse Physiologique'}
                                                </span>
                                            ` : ''}
                                        </div>
                                        <div class="stetho-foyers-bar">
                                            ${hotspotsList.map(h => {
                                                const isFoyerActive = h.id === activeHotspotObj.id;
                                                return `
                                                    <button type="button" class="stetho-foyer-btn ${isFoyerActive ? 'active' : ''}" data-foyer-id="${h.id}" title="${escapeHtml(h.desc)}">
                                                        <span class="foyer-name">${escapeHtml(h.name)}</span>
                                                        <span class="foyer-anat">${escapeHtml(h.anatomical)}</span>
                                                    </button>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                `;
                            })() : ''}

                            <div class="workbench-manoeuvres-box">
                                <span class="manoeuvres-label">Gestes sémiologiques systématiques :</span>
                                <ul class="manoeuvres-checklist">
                                    ${activeApp.manoeuvres.map(m => `
                                        <li><i class="fas fa-circle-check" style="color:${activeApp.color};"></i> ${escapeHtml(m)}</li>
                                    `).join('')}
                                </ul>
                            </div>

                            <div class="workbench-findings-card ${isExamined ? 'revealed' : 'pending'}">
                                <div class="findings-header">
                                    <strong><i class="fas fa-file-waveform"></i> Résultats de l'examen physique :</strong>
                                    ${isExamined ? '<span class="findings-tag done">Constaté au dossier</span>' : '<span class="findings-tag pending">En attente de réalisation</span>'}
                                </div>
                                <div class="findings-body">
                                    ${isExamined ? `
                                        <div class="findings-text-content">
                                            ${findingText}
                                        </div>
                                    ` : `
                                        <div class="findings-placeholder" id="findings-trigger-placeholder">
                                            <i class="fas fa-stethoscope" style="font-size:2rem; color:${activeApp.color}; opacity:0.6; margin-bottom:8px;"></i>
                                            <p>Cliquez sur <strong>« Réaliser cet examen clinique »</strong> pour ausculter/palper le patient et recueillir les signes sémiologiques objectifs.</p>
                                        </div>
                                    `}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this.bindEvents();
        }

        bindEvents() {
            if (!this.containerEl) return;

            // Clic sur un appareil
            this.containerEl.querySelectorAll('.exam-appareil-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.activeAppareilId = btn.dataset.appareilId;
                    this.stopStethoscope();
                    this.render();
                    if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('click');
                });
            });

            // Clic sur un foyer de stéthoscope
            this.containerEl.querySelectorAll('.stetho-foyer-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const foyerId = btn.dataset.foyerId;
                    this.currentHotspot = foyerId;
                    const activeApp = APPAREILS.find(a => a.id === this.activeAppareilId);
                    if (this.isStethoscopePlaying && activeApp && activeApp.hasAudio) {
                        this.startStethoscope(activeApp.audioType, foyerId);
                    } else {
                        this.render();
                    }
                    if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('click');
                });
            });

            // Bouton Réaliser l'examen
            const performBtn = this.containerEl.querySelector('#btn-perform-exam');
            if (performBtn) {
                performBtn.addEventListener('click', () => {
                    this.performExam(this.activeAppareilId);
                });
            }

            const placeholder = this.containerEl.querySelector('#findings-trigger-placeholder');
            if (placeholder) {
                placeholder.addEventListener('click', () => {
                    this.performExam(this.activeAppareilId);
                });
            }

            // Bouton Stéthoscope
            const stethoBtn = this.containerEl.querySelector('#btn-toggle-stethoscope');
            if (stethoBtn) {
                stethoBtn.addEventListener('click', () => {
                    this.toggleStethoscope();
                });
            }
        }

        performExam(appareilId) {
            this.examinedSet.add(appareilId);
            const activeApp = APPAREILS.find(a => a.id === appareilId);

            // Audio & Stéthoscope automatique si applicable
            if (activeApp && activeApp.hasAudio && !this.isStethoscopePlaying) {
                this.startStethoscope(activeApp.audioType);
            }

            if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('correct');

            // Enregistrer dans la démarche clinique
            if (window.scoringState) {
                if (!window.scoringState.examsPerformed) {
                    window.scoringState.examsPerformed = new Set();
                }
                window.scoringState.examsPerformed.add(appareilId);
            }

            // Mettre à jour la grille ECOS
            if (window.ecosState && window.ecosState.grilleAptitudes) {
                const appName = activeApp?.name?.toLowerCase() || '';
                window.ecosState.grilleAptitudes.forEach(g => {
                    if (g.id.includes('examen') && (g.id.includes(appareilId) || (g.label && g.label.toLowerCase().includes(appName)))) {
                        window.ecosState.gridChecked.add(g.id);
                    }
                });
                if (typeof window.ecosState.updateGrilleUI === 'function') window.ecosState.updateGrilleUI();
            }

            if (typeof window.showNotification === 'function') {
                window.showNotification(`🩺 Examen réalisé : ${activeApp?.name || 'Appareil'}`);
            }

            this.render();
        }

        async startStethoscope(type, foyerId = null) {
            if (foyerId) this.currentHotspot = foyerId;
            const currentFoyer = this.currentHotspot || (type === 'cardio' ? 'apex' : 'bases');
            const caseData = window.gameState?.currentCase || {};
            const cardio = caseData.examenClinique?.examenCardiovasculaire || {};
            const pulmo = caseData.examenClinique?.examenPulmonaire || {};
            const auscCardio = String(cardio.auscultation || '').toLowerCase();
            const auscPulmo = String(pulmo.auscultation || '').toLowerCase();
            const diag = String(caseData.correctDiagnostic || '').toLowerCase();

            // Arrêter tout flux en cours sans notification UI prématurée
            if (this.realAudioHandle) {
                try { this.realAudioHandle.stop(0.1); } catch (e) {}
                this.realAudioHandle = null;
            }
            if (window.MedGameMedical) {
                window.MedGameMedical.setStethoscope(false);
                window.MedGameMedical.stopHeartbeat();
                window.MedGameMedical.stopBreathing();
            }

            // 1. Recherche d'un audio réel correspondant
            let audioUrl = null;
            if (caseData.audioFiles && caseData.audioFiles[currentFoyer]) {
                audioUrl = caseData.audioFiles[currentFoyer];
            } else if (caseData.audioFile) {
                audioUrl = caseData.audioFile;
            } else if (type === 'cardio') {
                if (/r[ée]tr[ée]cissement|st[ée]nose|aorti/i.test(auscCardio + ' ' + diag)) {
                    audioUrl = currentFoyer === 'aortique' ? 'assets/audio/auscultation/heart/M_ESM_RUSB.wav' : 'assets/audio/auscultation/heart/M_ESM_A.wav';
                } else if (/insuffisance mitrale|jet de vapeur|foyer mitral|im\b/i.test(auscCardio + ' ' + diag)) {
                    audioUrl = currentFoyer === 'apex' ? 'assets/audio/auscultation/heart/F_MSM_A.wav' : 'assets/audio/auscultation/heart/F_MSM_LLSB.wav';
                } else if (/fibrillation|acfa|arythm/i.test(auscCardio + ' ' + diag)) {
                    audioUrl = 'assets/audio/auscultation/heart/M_AF_RUSB.wav';
                } else if (/galop|b3|insuffisance cardiaque/i.test(auscCardio + ' ' + diag)) {
                    audioUrl = 'assets/audio/auscultation/heart/F_S3_A.wav';
                } else {
                    audioUrl = currentFoyer === 'aortique' ? 'assets/audio/auscultation/heart/M_N_RUSB.wav' : 'assets/audio/auscultation/heart/F_N_A.wav';
                }
            } else if (type === 'pulmo') {
                if (/cr[ée]pitant|oap|pneumonie|r[âa]les/i.test(auscPulmo + ' ' + diag)) {
                    audioUrl = 'assets/audio/auscultation/lung/M_C_LLA.wav';
                } else if (/sibilant|asthme|bpco|wheez/i.test(auscPulmo + ' ' + diag)) {
                    audioUrl = 'assets/audio/auscultation/lung/M_W_LLA.wav';
                } else {
                    audioUrl = 'assets/audio/auscultation/lung/M_N_LMA.wav';
                }
            }

            // 2. Tentative de lecture du son réel via MedGameSound.loop sur le bus auscultation
            if (audioUrl && window.MedGameSound && typeof window.MedGameSound.loop === 'function') {
                try {
                    const handle = await window.MedGameSound.loop(audioUrl, {
                        bus: 'auscultation',
                        loop: true,
                        gain: 1.0,
                        fadeIn: 0.2
                    });
                    if (handle) {
                        this.realAudioHandle = handle;
                        this.audioMode = 'real';
                        this.isStethoscopePlaying = true;
                        this.currentAudioType = type;
                        this.render();
                        return;
                    }
                } catch (e) {
                    // Fallback vers synthèse
                }
            }

            // 3. Repli : synthèse physique physiologique
            if (window.MedGameMedical) {
                let murmur = null;
                if (/systol/i.test(auscCardio)) murmur = 'systolique';
                else if (/diastol/i.test(auscCardio)) murmur = 'diastolique';
                else if (/continu/i.test(auscCardio)) murmur = 'continu';

                if (type === 'cardio') {
                    window.MedGameMedical.applyVitals({ murmur });
                    window.MedGameMedical.setStethoscope(true);
                    window.MedGameMedical.startHeartbeat();
                } else {
                    window.MedGameMedical.startBreathing();
                }
                this.audioMode = 'synth';
                this.isStethoscopePlaying = true;
                this.currentAudioType = type;
                this.render();
            }
        }

        stopStethoscope() {
            if (this.realAudioHandle) {
                try {
                    this.realAudioHandle.stop(0.2);
                } catch (e) {}
                this.realAudioHandle = null;
            }
            if (window.MedGameMedical) {
                window.MedGameMedical.setStethoscope(false);
                window.MedGameMedical.stopHeartbeat();
                window.MedGameMedical.stopBreathing();
            }
            this.isStethoscopePlaying = false;
            this.currentAudioType = null;
            this.render();
        }

        toggleStethoscope() {
            const activeApp = APPAREILS.find(a => a.id === this.activeAppareilId);
            if (this.isStethoscopePlaying) {
                this.stopStethoscope();
            } else if (activeApp && activeApp.hasAudio) {
                this.startStethoscope(activeApp.audioType, this.currentHotspot);
            }
            this.render();
        }

        syncFromTurn(inputText, parsed) {
            const text = `${inputText} ${parsed.narrativeResponse || ''}`.toLowerCase();

            if (/coeur|cardiaque|auscultation cardiaque|pouls|souffle/i.test(text)) {
                this.examinedSet.add('examenCardiovasculaire');
            }
            if (/poumon|pulmonaire|auscultation pulmonaire|crepitants|sibilants/i.test(text)) {
                this.examinedSet.add('examenPulmonaire');
            }
            if (/ventre|abdomen|palpation abdominale|murphy|defense|contracture/i.test(text)) {
                this.examinedSet.add('examenAbdominal');
            }
            if (/neuro|reflexe|babinski|pupille|glasgow/i.test(text)) {
                this.examinedSet.add('examenNeurologique');
            }
            if (/trc|marbrure|peau|cutane|general/i.test(text)) {
                this.examinedSet.add('aspectGeneral');
            }

            if (this.containerEl) this.render();
        }
    }

    let stationInstance = null;
    function getExamStation() {
        if (!stationInstance && typeof document !== 'undefined') {
            stationInstance = new ClinicalExamStation();
        }
        return stationInstance;
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => getExamStation().mount());
        } else {
            getExamStation().mount();
        }
    }

    window.ClinicalExamStation = {
        mount: () => getExamStation().mount(),
        reset: () => getExamStation().reset(),
        performExam: (id) => getExamStation().performExam(id),
        startStethoscope: (type, foyerId) => getExamStation().startStethoscope(type, foyerId),
        stopStethoscope: () => getExamStation().stopStethoscope(),
        APPAREILS,
        HOTSPOTS
    };

})();
