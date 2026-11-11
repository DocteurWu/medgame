/**
 * js/clinical-notebook.js — Carnet d'Observation Clinique Médicale & Démarche Sémiologique (R2C)
 *
 * Outil pédagogique hospitalier de référence pour les externes et étudiants en médecine :
 * 1. Structuration méthodique PQRST de la douleur et des symptômes fonctionnels.
 * 2. Détection en temps réel des dimensions sémiologiques explorées au fil du dialogue.
 * 3. Surveillance active des Drapeaux Rouges (Red Flags d'urgence vitale) par grand motif.
 * 4. Générateur de Transmission Clinique SAED (Situation, Antécédents, Évaluation, Demande - HAS).
 */

(function () {
    'use strict';

    function escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    /**
     * Dictionnaire des Drapeaux Rouges (Red Flags) par grand motif d'urgence R2C.
     */
    const RED_FLAGS_CATALOG = {
        thoracique: {
            title: "Douleur Thoracique — Les 5 Urgences Vitales (PIED)",
            flags: [
                { id: 'rf_sca', label: "Syndrome Coronarien Aigu (SCA)", keywords: ['ecg', 'troponine', 'trinitrine', 'constriction', 'retrosternale', 'machoire', 'bras gauche'], reason: "Douleur constrictive > 20 min, irradiation bras/mâchoire, terrain coronarien." },
                { id: 'rf_dissection', label: "Dissection Aortique", keywords: ['asymetrie', 'dorsale', 'dechirement', 'pouls', 'tension', 'souffle aortique'], reason: "Douleur dorsale migratrice, asymétrie tensionnelle ou abolition de pouls." },
                { id: 'rf_ep', label: "Embolie Pulmonaire", keywords: ['tachycardie', 'dyspnee', 'hemoptysie', 'phlebite', 'd-dimeres', 'angioscanner'], reason: "Dyspnée brutale, tachycardie inexpliquée, douleur pleurale, terrain thromboembolique." },
                { id: 'rf_tamponnade', label: "Péricardite avec Tamponnade", keywords: ['turgescence', 'frottement', 'bruits du coeur', 'pouls paradoxal'], reason: "Turgescence jugulaire, assourdissement des bruits du cœur, hypotension." },
                { id: 'rf_pno', label: "Pneumothorax Sous Tension", keywords: ['tympanisme', 'asymetrie auscultatoire', 'silence', 'detresse'], reason: "Abolition brutale du murmure vésiculaire, tympanisme unilatéral, détresse respiratoire." }
            ]
        },
        cephalee: {
            title: "Céphalée Aiguë — Drapeaux Rouges Neurologiques",
            flags: [
                { id: 'rf_hemorragie', label: "Hémorragie Sous-Arachnoïdienne (HSA)", keywords: ['brutale', 'coup de tonnerre', 'raideur', 'scanner', 'pl'], reason: "Céphalée brutale en coup de tonnerre (< 1 minute), raideur de nuque." },
                { id: 'rf_meningite', label: "Méningite / Méningo-encéphalite", keywords: ['fievre', 'purpura', 'raideur', 'photophobie', 'glasgow'], reason: "Syndrome méningé fébrile, troubles de vigilance, purpura fulminans." },
                { id: 'rf_avc', label: "Accident Vasculaire Cérébral / Thrombophlébite", keywords: ['deficit', 'paralysie', 'aphasie', 'asymetrie'], reason: "Déficit neurologique focalisé d'apparition brutale." },
                { id: 'rf_horton', label: "Maladie de Horton (si > 50 ans)", keywords: ['tempe', 'claudication', 'crp', 'vision'], reason: "Céphalée temporale, claudication de la mâchoire, flou visuel, syndrome inflammatoire." }
            ]
        },
        dyspnee: {
            title: "Dyspnée Aiguë — Urgences Respiratoires & Cardiaques",
            flags: [
                { id: 'rf_oap', label: "Œdème Aigu du Poumon (OAP)", keywords: ['crepitants', 'orthopnee', 'mousse', 'hta', 'bnp'], reason: "Orthopnée, râles crépitants bilatéraux en marée montante, sueurs, HTA." },
                { id: 'rf_aag', label: "Asthme Aigu Grave (AAG)", keywords: ['silence', 'parole', 'paradoxale', 'pep', 'cyanose'], reason: "Difficulté à parler, silence auscultatoire, respiration abdominale paradoxale." },
                { id: 'rf_obstruction', label: "Obstruction des Voies Aériennes Supérieures", keywords: ['tirage', 'cornage', 'stridor', 'hemlich'], reason: "Stridor, cornage, tirage sus-sternal, fausse route récente." }
            ]
        },
        abdo: {
            title: "Douleur Abdominale Aiguë — Urgences Chirurgicales",
            flags: [
                { id: 'rf_peritonite', label: "Péritonite Aiguë (Perforation)", keywords: ['contracture', 'ventre de bois', 'defense', 'fievre'], reason: "Contracture abdominale involontaire (ventre de bois), douleur à la décompression." },
                { id: 'rf_occlusion', label: "Occlusion Intestinale Aiguë", keywords: ['arret des gaz', 'vomissements', 'meteorisme', 'ondulations'], reason: "Arrêt des matières et des gaz, vomissements fécaloïdes, météorisme important." },
                { id: 'rf_ischemie_mes', label: "Ischémie Mésentérique Aiguë", keywords: ['douleur disproportionnee', 'lactates', 'angioscanner'], reason: "Douleur abdominale intolérable disproportionnée par rapport à un examen pauvre." }
            ]
        }
    };

    /**
     * Arbres Diagnostiques Décisionnels R2C par grand syndrome clinique.
     */
    const DIAGNOSTIC_TREES = {
        thoracique: {
            title: "Arbre Décisionnel — Douleur Thoracique Aiguë (Item 339 R2C)",
            urgences: [
                {
                    id: 'sca',
                    name: 'Syndrome Coronarien Aigu (SCA)',
                    gravite: 'Urgence Vitale Immédiate',
                    priority: 'high',
                    forArgs: ['Douleur rétrosternale constrictive > 20 min', 'Irradiation mâchoire / bras gauche', 'Facteurs de risque cardiovasculaires majeurs'],
                    againstArgs: ['Douleur reproductible à la palpation pariétale', 'Douleur strictement respiro-dépendante', 'ECG per-critique normal + Troponine H0/H3 négative'],
                    keyExam: 'ECG 12D (< 10 min) + Troponine hs à H0 et H3'
                },
                {
                    id: 'ep',
                    name: 'Embolie Pulmonaire (EP)',
                    gravite: 'Urgence Vitale Immédiate',
                    priority: 'high',
                    forArgs: ['Dyspnée brutale inexpliquée', 'Douleur pleurale basithoracique', 'Tachycardie > 100 bpm', 'Terrain thrombo-embolique (Score de Wells)'],
                    againstArgs: ['Absence de dyspnée ni de tachycardie', 'D-Dimères < 500 ng/mL (ou ajustés à l\'âge)'],
                    keyExam: 'D-Dimères si probabilité faible/intermédiaire, Angioscanner thoracique si forte'
                },
                {
                    id: 'dissection',
                    name: 'Dissection Aortique Aiguë',
                    gravite: 'Urgence Chirurgicale Absolue',
                    priority: 'high',
                    forArgs: ['Douleur thoracique brutale, déchirante, dorsale interscapulaire', 'Asymétrie tensionnelle > 20 mmHg ou abolition de pouls', 'Souffle d\'insuffisance aortique diastolique'],
                    againstArgs: ['Douleur progressive modérée', 'Pouls périphériques symétriques', 'Pas d\'asymétrie tensionnelle'],
                    keyExam: 'Angioscanner aorte totale / Écho transœsophagienne (ETO)'
                },
                {
                    id: 'pno',
                    name: 'Pneumothorax Spontané Sous Tension',
                    gravite: 'Urgence Pleurale',
                    priority: 'high',
                    forArgs: ['Douleur unilatérale en coup de poignard', 'Tympanisme et abolition du murmure vésiculaire', 'Signes de compression médiastinale si suffocant'],
                    againstArgs: ['Auscultation et percussion pulmonaires strictement symétriques'],
                    keyExam: 'Radiographie thoracique de face en inspiration (exsufflation immédiate si suffocant)'
                },
                {
                    id: 'pericardite',
                    name: 'Péricardite Aiguë / Tamponnade',
                    gravite: 'Urgence Cardiovasculaire',
                    priority: 'medium',
                    forArgs: ['Douleur augmentée en décubitus et à l\'inspiration, calmée par l\'antéflexion', 'Frottement péricardique fugace', 'Sus-décalage ST concave diffus sans miroir'],
                    againstArgs: ['Bruits du cœur purs et bien frappés', 'Pas de turgescence jugulaire ni de pouls paradoxal'],
                    keyExam: 'Échocardiographie transthoracique (ETT) pour éliminer un épanchement'
                }
            ]
        },
        dyspnee: {
            title: "Arbre Décisionnel — Dyspnée Aiguë de l'Adulte (Item 354 R2C)",
            urgences: [
                {
                    id: 'oap',
                    name: 'Œdème Aigu du Poumon (OAP)',
                    gravite: 'Détresse Respiratoire Cardiaque',
                    priority: 'high',
                    forArgs: ['Orthopnée, grésillement laryngé, expectorations saumonées', 'Râles crépitants bilatéraux en marée montante', 'Élévation du BNP / NT-proBNP et cardiomégalie'],
                    againstArgs: ['Auscultation pulmonaire claire', 'BNP strictement normal'],
                    keyExam: 'Radio pulmonaire de face + BNP + Échocardiographie'
                },
                {
                    id: 'aag',
                    name: 'Asthme Aigu Grave (AAG) / Exacerbation BPCO',
                    gravite: 'Détresse Ventilatoire Obstructive',
                    priority: 'high',
                    forArgs: ['Bradypnée expiratoire, râles sibilants diffus ou silence auscultatoire', 'Difficulté à parler (phrases courtes), DEP < 50%'],
                    againstArgs: ['Auscultation sans wheezing ni sibilants', 'DEP normal'],
                    keyExam: 'Mesure du DEP (Peak Flow) + Gaz du sang artériels'
                },
                {
                    id: 'pac',
                    name: 'Pneumopathie Aiguë Infectieuse Sévère',
                    gravite: 'Urgence Infectieuse Respiratoire',
                    priority: 'medium',
                    forArgs: ['Fièvre élevée, frissons, toux purulente', 'Foyer de râles crépitants unilatéral', 'Syndrome inflammatoire biologique franc (CRP, PCT)'],
                    againstArgs: ['Apyrétique', 'Absence de foyer radiologique ou auscultatoire'],
                    keyExam: 'Radiographie thoracique + Hémocultures + Antigénuries légionelle/pneumocoque'
                }
            ]
        },
        cephalee: {
            title: "Arbre Décisionnel — Céphalée Aiguë (Item 338 R2C)",
            urgences: [
                {
                    id: 'hsa',
                    name: 'Hémorragie Sous-Arachnoïdienne (HSA)',
                    gravite: 'Urgence Neurochirurgicale Vitale',
                    priority: 'high',
                    forArgs: ['Céphalée explosive en coup de tonnerre (< 1 min)', 'Raideur de nuque, vomissements, photophobie'],
                    againstArgs: ['Céphalée progressive d\'évolution lente', 'Nuque parfaitement souple'],
                    keyExam: 'Scanner cérébral sans injection en extrême urgence (< 6h) puis PL si normal'
                },
                {
                    id: 'meningite',
                    name: 'Méningite Aiguë Infectieuse',
                    gravite: 'Urgence Infectieuse Vitale',
                    priority: 'high',
                    forArgs: ['Syndrome méningé fébrile franc', 'Troubles de vigilance ou purpura fulminans'],
                    againstArgs: ['Absence totale de fièvre et absence de syndrome méningé'],
                    keyExam: 'Ponction lombaire d\'urgence après élimination d\'une contre-indication'
                },
                {
                    id: 'horton',
                    name: 'Maladie de Horton (si > 50 ans)',
                    gravite: 'Urgence Ophtalmologique',
                    priority: 'medium',
                    forArgs: ['Céphalée temporale unilatérale, claudication de mâchoire', 'Artère temporale indurée, hyperesthésie du cuir chevelu', 'CRP > 50 mg/L'],
                    againstArgs: ['Patient jeune < 50 ans', 'CRP normale'],
                    keyExam: 'CRP/VS + Biopsie de l\'artère temporale (BAT) (Corticothérapie immédiate si suspicion)'
                }
            ]
        },
        abdo: {
            title: "Arbre Décisionnel — Douleur Abdominale Aiguë (Item 352 R2C)",
            urgences: [
                {
                    id: 'peritonite',
                    name: 'Péritonite Aiguë (Perforation)',
                    gravite: 'Urgence Chirurgicale Vitale',
                    priority: 'high',
                    forArgs: ['Contracture abdominale involontaire (ventre de bois)', 'Douleur à la décompression brusque', 'Fièvre et choc septique'],
                    againstArgs: ['Abdomen souple et dépressible sans défense'],
                    keyExam: 'Scanner abdomino-pelvien injecté en urgence'
                },
                {
                    id: 'occlusion',
                    name: 'Occlusion Intestinale Aiguë',
                    gravite: 'Urgence Chirurgicale',
                    priority: 'high',
                    forArgs: ['Arrêt des matières et des gaz', 'Météorisme abdominal et vomissements'],
                    againstArgs: ['Transit conservé, gaz présents'],
                    keyExam: 'Scanner abdomino-pelvien (recherche de volvulus ou hernie étranglée)'
                },
                {
                    id: 'ischemie_mes',
                    name: 'Ischémie Mésentérique Aiguë',
                    gravite: 'Urgence Vasculaire Vitale',
                    priority: 'high',
                    forArgs: ['Douleur intolérable disproportionnée avec examen abdominal pauvre', 'Terrain athéromateux ou FA, hyperlactatémie'],
                    againstArgs: ['Lactates normaux, douleur minime'],
                    keyExam: 'Angioscanner abdomino-pelvien au temps artériel précoce'
                }
            ]
        }
    };

    class ClinicalNotebook {
        constructor() {
            this.containerEl = null;
            this.dockBtn = null;
            this.isOpen = false;
            this.activeTab = 'pqrst';
            this.exploredPQRST = {
                P: false, // Provoking / Palliating
                Q: false, // Quality
                R: false, // Region / Radiation
                S: false, // Severity
                T: false  // Timing
            };
            this.pqrstFindings = {
                P: '',
                Q: '',
                R: '',
                S: '',
                T: ''
            };
            this.verifiedFlags = new Set();
            this.selectedPrimary = '';
            this.selectedDiff1 = '';
            this.selectedDiff2 = '';
            this.reasoningResult = null;
            this.init();
        }

        reset() {
            this.exploredPQRST = { P: false, Q: false, R: false, S: false, T: false };
            this.pqrstFindings = { P: '', Q: '', R: '', S: '', T: '' };
            this.verifiedFlags.clear();
            this.selectedPrimary = '';
            this.selectedDiff1 = '';
            this.selectedDiff2 = '';
            this.reasoningResult = null;
            this.updateBadge();
            if (this.isOpen) this.renderBody();
        }

        init() {
            if (typeof document === 'undefined') return;

            // Créer le bouton flottant d'accès au carnet clinique
            this.createDockButton();
            // Créer le panneau latéral du carnet
            this.createDrawerDOM();
            // Écouter les événements cliniques du jeu
            this.bindGameEvents();
        }

        createDockButton() {
            if (document.getElementById('clinical-notebook-dock-btn')) return;

            const btn = document.createElement('button');
            btn.id = 'clinical-notebook-dock-btn';
            btn.className = 'clinical-notebook-dock';
            btn.setAttribute('aria-label', "Ouvrir le Carnet d'Observation Clinique");
            btn.title = "Carnet d'Observation Clinique & Démarche Sémiologique";
            btn.innerHTML = `
                <i class="fas fa-book-medical" aria-hidden="true"></i>
                <span class="dock-label">Observation R2C</span>
                <span id="notebook-badge-count" class="dock-badge">0/5</span>
            `;

            btn.addEventListener('click', () => this.toggle());
            document.body.appendChild(btn);
            this.dockBtn = btn;
        }

        createDrawerDOM() {
            if (document.getElementById('clinical-notebook-drawer')) {
                this.containerEl = document.getElementById('clinical-notebook-drawer');
                return;
            }

            const drawer = document.createElement('div');
            drawer.id = 'clinical-notebook-drawer';
            drawer.className = 'notebook-drawer-overlay';
            drawer.setAttribute('aria-hidden', 'true');

            drawer.innerHTML = `
                <div class="notebook-drawer-panel" role="dialog" aria-labelledby="notebook-title">
                    <div class="notebook-drawer-header">
                        <div class="notebook-head-info">
                            <span class="notebook-pill"><i class="fas fa-hospital-user"></i> CHU — Service Hospitalier</span>
                            <h3 id="notebook-title" class="notebook-title">Dossier d'Observation Clinique</h3>
                        </div>
                        <button type="button" class="notebook-close-btn" aria-label="Fermer le carnet">&times;</button>
                    </div>

                    <div class="notebook-tabs" role="tablist">
                        <button type="button" class="notebook-tab-btn active" data-tab="pqrst" role="tab">
                            <i class="fas fa-stethoscope"></i> Sémiologie PQRST
                        </button>
                        <button type="button" class="notebook-tab-btn" data-tab="redflags" role="tab">
                            <i class="fas fa-triangle-exclamation"></i> Drapeaux Rouges
                        </button>
                        <button type="button" class="notebook-tab-btn" data-tab="reasoning" role="tab">
                            <i class="fas fa-sitemap"></i> Arbre Diagnostique R2C
                        </button>
                        <button type="button" class="notebook-tab-btn" data-tab="saed" role="tab">
                            <i class="fas fa-file-signature"></i> Transmission SAED
                        </button>
                    </div>

                    <div class="notebook-drawer-body" id="notebook-body-content">
                        <!-- Rendu dynamique -->
                    </div>

                    <div class="notebook-drawer-footer">
                        <button type="button" id="btn-copy-saed" class="btn-notebook-action">
                            <i class="fas fa-copy"></i> Copier la Synthèse d'Observation (SAED)
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(drawer);
            this.containerEl = drawer;

            const closeBtn = drawer.querySelector('.notebook-close-btn');
            if (closeBtn) closeBtn.addEventListener('click', () => this.close());
            drawer.addEventListener('click', (e) => {
                if (e.target === drawer) this.close();
            });

            drawer.querySelectorAll('.notebook-tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    drawer.querySelectorAll('.notebook-tab-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.activeTab = btn.dataset.tab;
                    this.renderBody();
                });
            });

            const copyBtn = drawer.querySelector('#btn-copy-saed');
            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    this.copySAEDTransmission();
                });
            }
        }

        bindGameEvents() {
            // Détection de progression interrogatoire
            document.addEventListener('interrogatoire-asked', (e) => {
                const path = e.detail?.path || '';
                this.analyzeClinicalPath(path);
            });

            // Détection des réponses du patient
            document.addEventListener('medgame:patient-reply', (e) => {
                const text = e.detail?.text || '';
                this.analyzeDialogueText(text);
            });

            // Changement de cas -> réinitialisation du carnet
            document.addEventListener('medgame:case-loaded', () => {
                this.reset();
            });
        }

        reset() {
            this.exploredPQRST = { P: false, Q: false, R: false, S: false, T: false };
            this.pqrstFindings = { P: '', Q: '', R: '', S: '', T: '' };
            this.verifiedFlags.clear();
            this.updateBadge();
            if (this.isOpen) this.renderBody();
        }

        analyzeClinicalPath(path) {
            const p = String(path).toLowerCase();
            const caseData = window.gameState?.currentCase;
            const hdm = caseData?.interrogatoire?.histoireMaladie || {};

            if (p.includes('facteursdeclenchants') || p.includes('facteurscalmants')) {
                this.exploredPQRST.P = true;
                this.pqrstFindings.P = hdm.facteursDeclenchants || hdm.remarques || 'Précisé à l’interrogatoire';
            }
            if (p.includes('descriptiondouleur') || p.includes('symptomesactuels')) {
                this.exploredPQRST.Q = true;
                this.pqrstFindings.Q = hdm.descriptionDouleur || 'Caractérisé par le patient';
            }
            if (p.includes('siege') || p.includes('irradiation') || p.includes('douleur')) {
                this.exploredPQRST.R = true;
                this.pqrstFindings.R = hdm.siege || hdm.descriptionDouleur || 'Localisation précisée';
            }
            if (p.includes('intensite') || p.includes('severite') || p.includes('retentissement')) {
                this.exploredPQRST.S = true;
                this.pqrstFindings.S = 'Évalué (intensité et tolérance)';
            }
            if (p.includes('debutsymptomes') || p.includes('evolution') || p.includes('duree')) {
                this.exploredPQRST.T = true;
                this.pqrstFindings.T = `${hdm.debutSymptomes ? `Début : ${hdm.debutSymptomes}` : ''} ${hdm.evolution ? `(${hdm.evolution})` : ''}`.trim() || 'Chronologie recueillie';
            }

            this.updateBadge();
            if (this.isOpen) this.renderBody();
        }

        analyzeDialogueText(text) {
            if (!text) return;
            const norm = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // Détection P (Facteurs déclenchants / calmants)
            if (/effort|escalier|repos|spray|trinitrine|marche|allonge|mange|repas/i.test(norm)) {
                this.exploredPQRST.P = true;
                if (!this.pqrstFindings.P) this.pqrstFindings.P = text.slice(0, 120);
            }
            // Détection Q (Qualité / type)
            if (/serre|constrict|brule|pesanteur|ecrase|poignard|dechir|coup/i.test(norm)) {
                this.exploredPQRST.Q = true;
                if (!this.pqrstFindings.Q) this.pqrstFindings.Q = text.slice(0, 120);
            }
            // Détection R (Région / irradiations)
            if (/poitrine|milieu|retrosternal|machoire|bras|gorge|dos|epigastre|ventre/i.test(norm)) {
                this.exploredPQRST.R = true;
                if (!this.pqrstFindings.R) this.pqrstFindings.R = text.slice(0, 120);
            }
            // Détection T (Timing / durée)
            if (/depuis|minutes|heures|mois|semaines|brutal|progressif/i.test(norm)) {
                this.exploredPQRST.T = true;
                if (!this.pqrstFindings.T) this.pqrstFindings.T = text.slice(0, 120);
            }

            // Détection des Drapeaux Rouges
            const flagsCategory = this.detectCategory();
            if (flagsCategory && RED_FLAGS_CATALOG[flagsCategory]) {
                RED_FLAGS_CATALOG[flagsCategory].flags.forEach(flag => {
                    const match = flag.keywords.some(k => norm.includes(k));
                    if (match) this.verifiedFlags.add(flag.id);
                });
            }

            this.updateBadge();
            if (this.isOpen) this.renderBody();
        }

        detectCategory() {
            const caseData = window.gameState?.currentCase;
            if (!caseData) return 'thoracique';
            const motif = (caseData.interrogatoire?.motifHospitalisation || caseData.id || '').toLowerCase();

            if (/thorax|thorac|angor|coeur|cardio|infarctus|palpitation/i.test(motif)) return 'thoracique';
            if (/cephal|tete|amnesie|neuro|coma|vertige|convuls/i.test(motif)) return 'cephalee';
            if (/dyspnee|essouffl|poumon|pneumo|toux|respi/i.test(motif)) return 'dyspnee';
            if (/abdo|ventre|digestif|epigastr|vomiss/i.test(motif)) return 'abdo';
            return 'thoracique';
        }

        updateBadge() {
            const count = Object.values(this.exploredPQRST).filter(Boolean).length;
            const badge = document.getElementById('notebook-badge-count');
            if (badge) {
                badge.textContent = `${count}/5`;
                badge.className = `dock-badge ${count >= 4 ? 'complete' : count >= 2 ? 'medium' : ''}`;
            }
        }

        open() {
            this.isOpen = true;
            this.containerEl.classList.add('active');
            this.containerEl.setAttribute('aria-hidden', 'false');
            this.renderBody();
            if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('paper');
        }

        close() {
            this.isOpen = false;
            this.containerEl.classList.remove('active');
            this.containerEl.setAttribute('aria-hidden', 'true');
            if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('click');
        }

        toggle() {
            if (this.isOpen) this.close();
            else this.open();
        }

        renderBody() {
            const container = document.getElementById('notebook-body-content');
            if (!container) return;

            if (this.activeTab === 'pqrst') {
                container.innerHTML = this.renderPQRSTTab();
            } else if (this.activeTab === 'redflags') {
                container.innerHTML = this.renderRedFlagsTab();
            } else if (this.activeTab === 'reasoning') {
                container.innerHTML = this.renderReasoningTab();
                this.bindReasoningEvents(container);
            } else if (this.activeTab === 'saed') {
                container.innerHTML = this.renderSAEDTab();
            }
        }

        renderPQRSTTab() {
            const dims = [
                { key: 'P', label: 'P — Provocation & Palliation', desc: 'Facteurs déclenchants (effort, froid, repas) et soulageants (repos, trinitrine, antalgiques).' },
                { key: 'Q', label: 'Q — Qualité du Symptôme', desc: 'Caractère sémiologique (constriction/étau, brûlure, coup de poignard, pesanteur, déchirement).' },
                { key: 'R', label: 'R — Région & Irradiation', desc: 'Siège anatomique précis, profondeur, et irradiations (bras gauche, deux bras, mâchoire, dos).' },
                { key: 'S', label: 'S — Sévérité & Tolérance', desc: 'Intensité sur échelle numérique (EN 0-10) et retentissement fonctionnel/hémodynamique.' },
                { key: 'T', label: 'T — Timing & Évolution', desc: 'Début brutal vs progressif, durée précise de l’épisode, horaire, récurrence, évolution.' }
            ];

            const count = Object.values(this.exploredPQRST).filter(Boolean).length;

            return `
                <div class="notebook-section-intro">
                    <div class="pqrst-score-banner">
                        <div class="pqrst-progress-ring">
                            <span class="pqrst-ring-val">${count}/5</span>
                        </div>
                        <div>
                            <h4>Grille Sémiologique PQRST</h4>
                            <p>Standard international d'investigation de la douleur et des symptômes fonctionnels.</p>
                        </div>
                    </div>
                </div>

                <div class="pqrst-cards-list">
                    ${dims.map(d => {
                        const isDone = this.exploredPQRST[d.key];
                        const finding = this.pqrstFindings[d.key];
                        return `
                            <div class="pqrst-item-card ${isDone ? 'done' : 'missing'}">
                                <div class="pqrst-item-head">
                                    <span class="pqrst-badge ${isDone ? 'done' : 'missing'}">
                                        <i class="fas ${isDone ? 'fa-check' : 'fa-circle-question'}"></i> ${d.key}
                                    </span>
                                    <strong class="pqrst-item-title">${escapeHtml(d.label)}</strong>
                                    <span class="pqrst-status-label">${isDone ? 'Exploré' : 'À rechercher'}</span>
                                </div>
                                <p class="pqrst-desc">${escapeHtml(d.desc)}</p>
                                ${finding ? `
                                    <div class="pqrst-finding">
                                        <i class="fas fa-quote-left"></i>
                                        <span>${escapeHtml(finding)}</span>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        renderRedFlagsTab() {
            const catKey = this.detectCategory();
            const catalog = RED_FLAGS_CATALOG[catKey] || RED_FLAGS_CATALOG.thoracique;

            return `
                <div class="notebook-section-intro">
                    <h4><i class="fas fa-shield-halved"></i> ${escapeHtml(catalog.title)}</h4>
                    <p>Recherche systématique des urgences vitales à éliminer avant toute autre considération.</p>
                </div>

                <div class="redflags-list">
                    ${catalog.flags.map(f => {
                        const isChecked = this.verifiedFlags.has(f.id);
                        return `
                            <div class="redflag-card ${isChecked ? 'secured' : 'unsecured'}">
                                <div class="redflag-head">
                                    <span class="redflag-pill ${isChecked ? 'secured' : 'alert'}">
                                        <i class="fas ${isChecked ? 'fa-shield' : 'fa-triangle-exclamation'}"></i>
                                        ${isChecked ? 'Évalué / Sécurisé' : 'Angle Mort Critique'}
                                    </span>
                                    <strong>${escapeHtml(f.label)}</strong>
                                </div>
                                <p class="redflag-reason">${escapeHtml(f.reason)}</p>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        renderReasoningTab() {
            const catKey = this.detectCategory();
            const tree = DIAGNOSTIC_TREES[catKey] || DIAGNOSTIC_TREES.thoracique;
            const caseData = window.gameState?.currentCase || {};
            const possibleDiags = Array.isArray(caseData.possibleDiagnostics) && caseData.possibleDiagnostics.length > 0
                ? caseData.possibleDiagnostics
                : ['Diagnostic 1', 'Diagnostic 2', 'Diagnostic 3'];

            return `
                <div class="notebook-section-intro">
                    <div class="reasoning-tree-banner">
                        <span class="reasoning-badge-top"><i class="fas fa-sitemap"></i> Démarche Clinique & EDN R2C</span>
                        <h4>${escapeHtml(tree.title)}</h4>
                        <p>Méthodologie standard : éliminer les urgences vitales absolues, confronter arguments pour/contre, puis formuler les hypothèses hiérarchisées.</p>
                    </div>
                </div>

                <div class="reasoning-urgences-section">
                    <h5 class="reasoning-section-title"><i class="fas fa-triangle-exclamation"></i> 1. Urgences Vitales à Éliminer en Priorité</h5>
                    <div class="reasoning-cards-grid">
                        ${tree.urgences.map(u => `
                            <div class="reasoning-card priority-${u.priority}">
                                <div class="reasoning-card-header">
                                    <span class="reasoning-urgency-badge ${u.priority}">${escapeHtml(u.gravite)}</span>
                                    <strong class="reasoning-diag-name">${escapeHtml(u.name)}</strong>
                                </div>
                                <div class="reasoning-card-body">
                                    <div class="reasoning-args-block for">
                                        <span class="args-title"><i class="fas fa-plus-circle"></i> Arguments pour :</span>
                                        <ul>
                                            ${u.forArgs.map(a => `<li>${escapeHtml(a)}</li>`).join('')}
                                        </ul>
                                    </div>
                                    <div class="reasoning-args-block against">
                                        <span class="args-title"><i class="fas fa-minus-circle"></i> Arguments contre / Éléments d'exclusion :</span>
                                        <ul>
                                            ${u.againstArgs.map(a => `<li>${escapeHtml(a)}</li>`).join('')}
                                        </ul>
                                    </div>
                                    <div class="reasoning-key-exam">
                                        <i class="fas fa-key"></i> <strong>Examen clé :</strong> ${escapeHtml(u.keyExam)}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="reasoning-form-section">
                    <h5 class="reasoning-section-title"><i class="fas fa-brain"></i> 2. Formulation des Hypothèses par l'Étudiant</h5>
                    <div class="reasoning-form-card">
                        <div class="reasoning-form-row">
                            <label for="select-primary-diag"><strong>Diagnostic principal retenu :</strong></label>
                            <select id="select-primary-diag" class="reasoning-select">
                                <option value="">-- Sélectionnez votre hypothèse principale --</option>
                                ${possibleDiags.map(d => `
                                    <option value="${escapeHtml(d)}" ${this.selectedPrimary === d ? 'selected' : ''}>${escapeHtml(d)}</option>
                                `).join('')}
                            </select>
                        </div>

                        <div class="reasoning-form-row diff-row">
                            <div class="diff-col">
                                <label for="select-diff1-diag"><strong>Diagnostic différentiel #1 :</strong></label>
                                <select id="select-diff1-diag" class="reasoning-select">
                                    <option value="">-- Diagnostic différentiel 1 --</option>
                                    ${possibleDiags.map(d => `
                                        <option value="${escapeHtml(d)}" ${this.selectedDiff1 === d ? 'selected' : ''}>${escapeHtml(d)}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="diff-col">
                                <label for="select-diff2-diag"><strong>Diagnostic différentiel #2 :</strong></label>
                                <select id="select-diff2-diag" class="reasoning-select">
                                    <option value="">-- Diagnostic différentiel 2 --</option>
                                    ${possibleDiags.map(d => `
                                        <option value="${escapeHtml(d)}" ${this.selectedDiff2 === d ? 'selected' : ''}>${escapeHtml(d)}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>

                        <button type="button" id="btn-validate-reasoning" class="btn-reasoning-validate">
                            <i class="fas fa-check-double"></i> Valider et Confronter mon Raisonnement
                        </button>

                        ${this.reasoningResult ? `
                            <div class="reasoning-feedback-box ${this.reasoningResult.status}">
                                <div class="feedback-icon">
                                    <i class="fas ${this.reasoningResult.status === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>
                                </div>
                                <div class="feedback-content">
                                    <strong>${escapeHtml(this.reasoningResult.title)}</strong>
                                    <p>${escapeHtml(this.reasoningResult.message)}</p>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        bindReasoningEvents(container) {
            const selectPrimary = container.querySelector('#select-primary-diag');
            if (selectPrimary) {
                selectPrimary.addEventListener('change', (e) => {
                    this.selectedPrimary = e.target.value;
                });
            }

            const selectDiff1 = container.querySelector('#select-diff1-diag');
            if (selectDiff1) {
                selectDiff1.addEventListener('change', (e) => {
                    this.selectedDiff1 = e.target.value;
                });
            }

            const selectDiff2 = container.querySelector('#select-diff2-diag');
            if (selectDiff2) {
                selectDiff2.addEventListener('change', (e) => {
                    this.selectedDiff2 = e.target.value;
                });
            }

            const btnValidate = container.querySelector('#btn-validate-reasoning');
            if (btnValidate) {
                btnValidate.addEventListener('click', () => {
                    this.validateReasoning();
                });
            }
        }

        validateReasoning() {
            if (!this.selectedPrimary) {
                if (typeof window.showNotification === 'function') {
                    window.showNotification('Veuillez sélectionner au moins un diagnostic principal.');
                }
                if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('alert');
                return;
            }

            const caseData = window.gameState?.currentCase || {};
            const correct = caseData.correctDiagnostic || '';

            const isCorrect = this.selectedPrimary.trim().toLowerCase() === correct.trim().toLowerCase();

            if (isCorrect) {
                this.reasoningResult = {
                    status: 'success',
                    title: 'Raisonnement Clinique Validé avec Succès !',
                    message: `Félicitations : le diagnostic « ${correct} » est le diagnostic retenu pour ce patient. Vos arguments séméiologiques et paracliniques sont parfaitement concordants.`
                };
                if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('correct');

                // Enregistrer dans la démarche clinique & ECOS
                if (window.scoringState) {
                    window.scoringState.reasoningValidated = true;
                }
                if (window.ecosState && window.ecosState.grilleAptitudes) {
                    window.ecosState.grilleAptitudes.forEach(g => {
                        if (g.id.includes('diag') || g.id.includes('hypothese')) {
                            window.ecosState.gridChecked.add(g.id);
                        }
                    });
                    if (typeof window.ecosState.updateGrilleUI === 'function') window.ecosState.updateGrilleUI();
                }

                // Synchroniser avec le select diagnostic de la page de jeu
                const mainDiagSelect = document.getElementById('diagnostic-select');
                if (mainDiagSelect) {
                    mainDiagSelect.value = this.selectedPrimary;
                }
            } else {
                this.reasoningResult = {
                    status: 'warning',
                    title: 'Hypothèse Clinique Discordante',
                    message: `L'hypothèse « ${this.selectedPrimary} » ne concorde pas avec le tableau clinique complet. Ré-examinez attentivement l'auscultation, les constantes et les examens complémentaires.`
                };
                if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('alert');
            }

            this.renderBody();
        }

        renderSAEDTab() {
            const caseData = window.gameState?.currentCase;
            if (!caseData) return '<p>Aucun cas chargé.</p>';

            const pat = caseData.patient || {};
            const cst = caseData.examenClinique?.constantes || {};
            const atcd = caseData.interrogatoire?.antecedents || {};
            const medList = Array.isArray(atcd.medicaux) ? atcd.medicaux.map(m => (typeof m === 'string' ? m : m.type || '')).join(', ') : 'Aucun';
            const motif = caseData.interrogatoire?.motifHospitalisation || 'Motif inconnu';

            return `
                <div class="notebook-section-intro">
                    <h4>Transmission Standardisée SAED (HAS)</h4>
                    <p>Format canonique de relève médicale interprofessionnelle pour la sécurité du patient.</p>
                </div>

                <div class="saed-sheet">
                    <div class="saed-block saed-s">
                        <span class="saed-letter">S</span>
                        <div>
                            <strong>Situation :</strong>
                            <p>${escapeHtml(pat.prenom || '')} ${escapeHtml(pat.nom || 'Patient')}, ${pat.age || '--'} ans. Admis(e) pour : <em>${escapeHtml(motif)}</em>. Constantes actuelles : PA ${escapeHtml(cst.tension || '--')}, FC ${escapeHtml(cst.pouls || '--')}, SpO2 ${escapeHtml(cst.saturationO2 || '--')}, T° ${escapeHtml(cst.temperature || '--')}.</p>
                        </div>
                    </div>

                    <div class="saed-block saed-a">
                        <span class="saed-letter">A</span>
                        <div>
                            <strong>Antécédents & Terrain :</strong>
                            <p>Antécédents notables : ${escapeHtml(medList || 'Aucun')}. Allergies : ${escapeHtml(caseData.interrogatoire?.allergies?.presence ? (caseData.interrogatoire.allergies.liste || []).join(', ') : 'Aucune allergie connue')}.</p>
                        </div>
                    </div>

                    <div class="saed-block saed-e">
                        <span class="saed-letter">E</span>
                        <div>
                            <strong>Évaluation Clinique :</strong>
                            <p>Sémiologie recueillie : PQRST investigué (${Object.values(this.exploredPQRST).filter(Boolean).length}/5 critères). Drapeaux rouges évalués : ${this.verifiedFlags.size} urgence(s) formellement abordée(s).</p>
                        </div>
                    </div>

                    <div class="saed-block saed-d">
                        <span class="saed-letter">D</span>
                        <div>
                            <strong>Demande & Proposition Thérapeutique :</strong>
                            <p>Poursuite de la prise en charge diagnostique et surveillance des paramètres vitaux au lit du patient.</p>
                        </div>
                    </div>
                </div>
            `;
        }

        copySAEDTransmission() {
            const caseData = window.gameState?.currentCase;
            if (!caseData) return;

            const pat = caseData.patient || {};
            const cst = caseData.examenClinique?.constantes || {};
            const motif = caseData.interrogatoire?.motifHospitalisation || '';

            const saedText = `[TRANSMISSION CLINIQUE SAED - CHU]\n` +
                `S (Situation) : ${pat.prenom || ''} ${pat.nom || 'Patient'}, ${pat.age || '--'} ans. Motif : ${motif}. Constantes : PA ${cst.tension || '--'}, FC ${cst.pouls || '--'}, SpO2 ${cst.saturationO2 || '--'}.\n` +
                `A (Antécédents) : Terrain investigué au dossier.\n` +
                `E (Évaluation) : Sémiologie PQRST explorée (${Object.values(this.exploredPQRST).filter(Boolean).length}/5). Drapeaux rouges évalués : ${this.verifiedFlags.size}.\n` +
                `D (Demande) : Surveillance clinique et bilan diagnostique adapté.`;

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(saedText).then(() => {
                    if (typeof window.showNotification === 'function') {
                        window.showNotification('📋 Transmission SAED copiée dans le presse-papiers');
                    }
                }).catch(() => {});
            }

            if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('correct');
        }
    }

    let notebookInstance = null;
    function getNotebook() {
        if (!notebookInstance && typeof document !== 'undefined') {
            notebookInstance = new ClinicalNotebook();
        }
        return notebookInstance;
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => getNotebook());
        } else {
            getNotebook();
        }
    }

    window.MedGameNotebook = {
        open: () => getNotebook().open(),
        close: () => getNotebook().close(),
        toggle: () => getNotebook().toggle(),
        reset: () => getNotebook().reset(),
        validateReasoning: (primary) => {
            const inst = getNotebook();
            if (primary) inst.selectedPrimary = primary;
            inst.validateReasoning();
            return inst.reasoningResult;
        },
        DIAGNOSTIC_TREES
    };

})();
