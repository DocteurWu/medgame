/**
 * three-clinical-agent.js — Examen Clinique Interactif en 3D
 * 
 * Gère un système complet d'investigation médicale :
 * - Menu d'action contextuel selon la zone cliquée (Torse, Abdomen, Membres)
 * - Cartes de résultats immersives avec données du cas
 * - Suivi des zones examinées et de la démarche médicale
 * - Réactions physiologiques (grimace de douleur, son d'auscultation)
 * - Panel de progression clinique affiché dans le HUD
 */

export class ThreeClinicalAgent {
    constructor(manager) {
        this.manager = manager;
        this.hudElement = document.getElementById('three-hud');
        this.activeMenu = null;

        // Suivi des examens effectués (clé = actionId)
        this.examinedActions = new Set();

        // Panneau de progression clinique
        this._progressPanel = null;
        this._initProgressPanel();
    }

    // ========== PANNEAU DE PROGRESSION CLINIQUE ==========

    _initProgressPanel() {
        // Vestige : en mode LLM tout l'examen passe par la bulle unique → pas de panneau point-and-click
        const isLLM = document.body.classList.contains('llm-mode') || (typeof isLLMMode === 'function' && isLLMMode());
        if (isLLM) return;
        const existing = document.getElementById('clinical-progress-panel');
        if (existing) { this._progressPanel = existing; return; }

        const panel = document.createElement('div');
        panel.id = 'clinical-progress-panel';
        // Apparence : `css/game.css` (section « Vue 3D »), aucun style en ligne.
        panel.className = 'clin3d-progress';

        const ALL_ACTIONS = [
            { id: 'auscultation_cardio', label: 'Auscultation cardiaque' },
            { id: 'auscultation_pneumo', label: 'Auscultation pulmonaire' },
            { id: 'palpation_abdo',     label: 'Palpation abdominale' },
            { id: 'inspection',         label: 'Inspection générale' },
            { id: 'reflex_osteo',       label: 'Réflexes ostéo-tendineux' },
            { id: 'palpation_membre',   label: 'Palpation des membres' },
        ];

        const title = document.createElement('div');
        title.className = 'clin3d-progress-title';
        title.textContent = 'Examen clinique';
        panel.appendChild(title);

        this._progressItems = {};
        ALL_ACTIONS.forEach(a => {
            const row = document.createElement('div');
            row.className = 'clin3d-progress-row';
            row.id = `clinical-prog-${a.id}`;

            const check = document.createElement('span');
            check.className = 'clin3d-progress-check';
            check.textContent = '○';
            check.id = `clinical-check-${a.id}`;

            const lbl = document.createElement('span');
            lbl.textContent = a.label;

            row.appendChild(check);
            row.appendChild(lbl);
            panel.appendChild(row);
            this._progressItems[a.id] = { row, check };
        });

        document.body.appendChild(panel);
        this._progressPanel = panel;
    }

    _markExamDone(actionId) {
        this.examinedActions.add(actionId);
        const item = this._progressItems?.[actionId];
        if (item) {
            item.row.classList.add('is-done');
            item.check.textContent = '✓';
        }
    }

    // ========== MENU D'EXAMEN CONTEXTUEL ==========

    openExaminationMenu(zone) {
        if (this.activeMenu) this.closeExaminationMenu();

        // Menu ancré sur le CÔTÉ de l'écran (feuille du thème clinique, voir
        // `css/game.css`) : centré, il recouvrait le patient qu'on venait
        // précisément de cadrer.
        const menu = document.createElement('div');
        menu.id = 'clinical-exam-menu';
        menu.className = 'clin3d-menu';
        menu.setAttribute('role', 'dialog');

        let title = '';
        let subtitle = '';
        let actions = [];

        if (zone === 'torse') {
            title = 'Examen thoracique';
            subtitle = 'Auscultation cardiaque et pulmonaire';
            actions = [
                { label: 'Auscultation cardiaque', icon: 'fas fa-stethoscope', id: 'auscultation_cardio', done: this.examinedActions.has('auscultation_cardio') },
                { label: 'Auscultation pulmonaire', icon: 'fas fa-lungs', id: 'auscultation_pneumo', done: this.examinedActions.has('auscultation_pneumo') },
                { label: 'Voir le cœur en 3D', icon: 'fas fa-cube', id: 'atlas_coeur', done: false },
                { label: 'Voir les poumons en 3D', icon: 'fas fa-cube', id: 'atlas_poumon', done: false }
            ];
        } else if (zone === 'abdomen') {
            title = 'Examen abdominal';
            subtitle = 'Palpation et percussion';
            actions = [
                { label: 'Palpation abdominale', icon: 'fas fa-hand-paper', id: 'palpation_abdo', done: this.examinedActions.has('palpation_abdo') },
                { label: 'Voir le foie et l\'estomac en 3D', icon: 'fas fa-cube', id: 'atlas_abdomen', done: false }
            ];
        } else if (zone === 'membre') {
            title = 'Examen des membres';
            subtitle = 'Palpation et réflexes';
            actions = [
                { label: 'Palpation des membres', icon: 'fas fa-hand-paper', id: 'palpation_membre', done: this.examinedActions.has('palpation_membre') },
                { label: 'Réflexes ostéo-tendineux', icon: 'fas fa-bolt', id: 'reflex_osteo', done: this.examinedActions.has('reflex_osteo') }
            ];
        } else {
            title = 'Au lit du patient';
            subtitle = 'Que voulez-vous faire ?';
            actions = [
                { label: 'Interroger le patient', icon: 'fas fa-comments', id: 'interroger', done: false },
                { label: 'Inspection générale', icon: 'fas fa-eye', id: 'inspection', done: this.examinedActions.has('inspection') },
                { label: 'Brancher le scope', icon: 'fas fa-heartbeat', id: 'brancher_scope', done: this.examinedActions.has('brancher_scope') }
            ];
        }

        const head = document.createElement('div');
        head.className = 'clin3d-menu-head';
        const h = document.createElement('div');
        h.className = 'clin3d-menu-title';
        h.textContent = title;
        const sub = document.createElement('div');
        sub.className = 'clin3d-menu-sub';
        sub.textContent = subtitle;
        const close = document.createElement('button');
        close.type = 'button';
        close.id = 'close-exam-menu';
        close.className = 'clin3d-menu-close';
        close.setAttribute('aria-label', 'Fermer le menu d\'examen');
        close.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
        close.addEventListener('click', () => this.closeExaminationMenu());
        const headText = document.createElement('div');
        headText.append(h, sub);
        head.append(headText, close);
        menu.appendChild(head);

        const list = document.createElement('div');
        list.className = 'clin3d-menu-list';
        actions.forEach((act, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'clin3d-menu-btn' + (act.done ? ' is-done' : '');
            // `data-exam-action` et non `data-action` : ce dernier est écouté
            // au niveau du document par three-manager (puces du HUD).
            btn.dataset.examAction = act.id;
            const icon = document.createElement('i');
            icon.className = act.icon;
            icon.setAttribute('aria-hidden', 'true');
            const label = document.createElement('span');
            label.className = 'clin3d-menu-label';
            label.textContent = act.label;
            const key = document.createElement('span');
            key.className = 'clin3d-menu-key';
            key.textContent = act.done ? '✓' : String(i + 1);
            btn.append(icon, label, key);
            btn.addEventListener('click', () => {
                this.closeExaminationMenu();
                this.performAction(act.id);
            });
            list.appendChild(btn);
        });
        menu.appendChild(list);

        // Raccourcis 1-9 : choisir une action sans quitter le clavier.
        this._menuKeyHandler = (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            const n = parseInt(e.key, 10);
            if (!n || n > actions.length) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            const act = actions[n - 1];
            this.closeExaminationMenu();
            this.performAction(act.id);
        };
        // Capture : passe avant les raccourcis de caméra (1, 2, 3, 4).
        document.addEventListener('keydown', this._menuKeyHandler, true);

        document.body.appendChild(menu);
        this.activeMenu = menu;
    }

    closeExaminationMenu() {
        if (this._menuKeyHandler) {
            document.removeEventListener('keydown', this._menuKeyHandler, true);
            this._menuKeyHandler = null;
        }
        if (this.activeMenu?.parentNode) {
            this.activeMenu.parentNode.removeChild(this.activeMenu);
        }
        this.activeMenu = null;
    }

    // ========== EXÉCUTION D'UNE ACTION CLINIQUE ==========

    performAction(actionId) {
        if (!this.manager || !this.manager.currentCase) {
            this.manager?.hud?.showNotification('Aucun cas chargé.', 'warning');
            return;
        }

        const caseData = this.manager.currentCase;
        const exam = caseData.examenClinique || {};
        let resultText = 'Examen normal.';
        let title = 'Résultat';
        let icon = 'fas fa-info-circle';
        let severity = 'normal'; // 'normal' | 'warning' | 'critical'

        switch (actionId) {
            case 'atlas_coeur':
            case 'atlas_poumon':
            case 'atlas_abdomen': {
                const presets = {
                    atlas_coeur: { focus: 'heart', systems: ['cardiac', 'arterial', 'skeletal'], label: 'Cœur' },
                    atlas_poumon: { focus: 'lung', systems: ['respiratory', 'skeletal'], label: 'Poumons' },
                    atlas_abdomen: { focus: 'liver', systems: ['digestive', 'urinary', 'skeletal'], label: 'Foie / Abdomen' },
                };
                document.dispatchEvent(new CustomEvent('medgame:open-atlas', { detail: presets[actionId] }));
                return; // pas de carte résultat, pas de scoring : pur visuel de référence
            }
            case 'auscultation_cardio': {
                title = 'Auscultation Cardiaque';
                icon = 'fas fa-heartbeat';
                const raw = exam.examenCardiovasculaire?.auscultation || '';
                resultText = raw || 'Bruits du cœur réguliers, pas de souffle audible.';
                // Analyse clinique
                const rl = resultText.toLowerCase();
                if (rl.includes('souffle') || rl.includes('crépitant') || rl.includes('galop')) severity = 'warning';
                if (rl.includes('râle') || rl.includes('frottement') || rl.includes('galop de galop')) severity = 'critical';
                this._playAuscultationSound(rl);
                break;
            }
            case 'auscultation_pneumo': {
                title = 'Auscultation Pulmonaire';
                icon = 'fas fa-lungs';
                const raw = exam.examenPulmonaire?.auscultation || '';
                resultText = raw || 'Murmure vésiculaire symétrique, pas de râle.';
                const rl = resultText.toLowerCase();
                if (rl.includes('crépitant') || rl.includes('sibilant') || rl.includes('diminué')) severity = 'warning';
                if (rl.includes('abolit') || rl.includes('stridor')) severity = 'critical';
                this._playAuscultationSound(rl);
                break;
            }
            case 'palpation_abdo': {
                title = 'Palpation Abdominale';
                icon = 'fas fa-hand-paper';
                const raw = exam.examenAbdominal?.palpation || '';
                resultText = raw || 'Abdomen souple, indolore, dépressible. Pas de masse. Pas de défense.';
                const rl = resultText.toLowerCase();
                if (rl.includes('sensibilité') || rl.includes('douleur')) severity = 'warning';
                if (rl.includes('défense') || rl.includes('contracture') || rl.includes('ascite')) severity = 'critical';
                this._checkPalpationPain(rl);
                break;
            }
            case 'palpation_membre': {
                title = 'Palpation des Membres';
                icon = 'fas fa-hand-paper';
                const raw = exam.examenNeurologique?.motricite || exam.examenMembre?.palpation || '';
                resultText = raw || 'Membres sans oedème, pouls distaux présents et symétriques.';
                const rl = resultText.toLowerCase();
                if (rl.includes('oedème') || rl.includes('douleur') || rl.includes('phlébite')) severity = 'warning';
                if (rl.includes('abolit') || rl.includes('ischémie') || rl.includes('nécrose')) severity = 'critical';
                break;
            }
            case 'reflex_osteo': {
                title = 'Réflexes Ostéo-Tendineux';
                icon = 'fas fa-bolt';
                const raw = exam.examenNeurologique?.reflexes || '';
                resultText = raw || 'Réflexes rotuliens et achilléens présents et symétriques (2+).';
                const rl = resultText.toLowerCase();
                if (rl.includes('diminué') || rl.includes('asymétrique') || rl.includes('vif')) severity = 'warning';
                if (rl.includes('aboli') || rl.includes('clonus') || rl.includes('signe de babinski')) severity = 'critical';
                // Déclencher un petit mouvement du patient
                this._triggerReflexAnimation();
                break;
            }
            case 'inspection': {
                title = 'Inspection Générale';
                icon = 'fas fa-eye';
                resultText = exam.aspectGeneral || `Patient ${caseData.patient?.sexe === 'F' ? 'consciente' : 'conscient'}, orienté(e) temporo-spatialement. Pas de détresse respiratoire apparente.`;
                const rl = resultText.toLowerCase();
                if (rl.includes('pâle') || rl.includes('dyspnée') || rl.includes('sueur')) severity = 'warning';
                if (rl.includes('cyanose') || rl.includes('détresse') || rl.includes('inconscient')) severity = 'critical';
                break;
            }
            case 'interroger': {
                if (this.manager) {
                    this.manager.openPatientDialog();
                    this.manager.hud?.showPrompt('Posez une question au patient...');
                    window.scoringState && (window.scoringState.hasAskedPatient = true);
                }
                return;
            }
            case 'brancher_scope': {
                title = 'Scope Multiparamétrique';
                icon = 'fas fa-heartbeat';
                resultText = 'Scope multiparamétrique branché avec succès : Électrodes ECG en place, capteur de SpO₂ connecté au doigt et brassard à tension installé.';
                severity = 'normal';
                
                if (this.manager) {
                    this.manager.isScopeConnected = true;
                    if (this.manager.hud) {
                        this.manager.hud.showNotification('Scope connecté : ECG et constantes affichés en continu.', 'success');
                        this.manager.hud._updateVitals();
                    }
                }
                break;
            }
        }

        this._showResultCard(title, resultText, icon, severity);
        this._markExamDone(actionId);

        // Tracking démarche
        if (window.scoringState) {
            if (!window.scoringState.examsPerformed) window.scoringState.examsPerformed = new Set();
            window.scoringState.examsPerformed.add(actionId);
        }

        // Suivi de l'examen clinique (section-viewed)
        document.dispatchEvent(new CustomEvent('section-viewed', {
            detail: { sectionId: 'section-examen-clinique' }
        }));
    }

    // ========== HELPERS PHYSIOLOGIQUES ==========

    _playAuscultationSound(textLower) {
        if (!window.medicalAudio) return;
        // Ausculter, c'est écouter : on efface tout le reste. Le focus
        // « auscultation » du socle (js/audio-ambience.js) baisse la musique et
        // l'ambiance à ~5 % et ~18 %, et le ducking médical fait le reste.
        // Sans cet appel, le mode était déclaré dans FOCUS_DUCK mais jamais
        // atteint, et le joueur entendait la musique pendant qu'il posait le
        // stéthoscope.
        if (window.MedGameAmbience?.isRunning()) {
            window.MedGameAmbience.setFocus('auscultation');
        }
        // Différenciation par contenu clinique
        if (typeof window.medicalAudio.playMeasureSound === 'function') {
            window.medicalAudio.playMeasureSound();
        }
    }

    _checkPalpationPain(textLower) {
        const isPainful = textLower.includes('douleur') || textLower.includes('défense')
            || textLower.includes('defense') || textLower.includes('sensibilité')
            || textLower.includes('contracture');

        if (isPainful && this.manager?.hud) {
            this.manager.hud._applyFacialExpression('douleur', 1.0);
            // Retour à l'expression de base après 2.5s
            setTimeout(() => this.manager.hud._resetFacialExpression(), 2500);
        }
    }

    _triggerReflexAnimation() {
        // Déclenche l'expression 'anxieux' brièvement pour simuler la surprise du réflexe
        if (this.manager?.hud) {
            this.manager.hud._applyFacialExpression('anxieux', 0.3);
            setTimeout(() => this.manager.hud._resetFacialExpression(), 800);
        }
    }

    // ========== CARTE DE RÉSULTAT CLINIQUE ==========

    _showResultCard(title, text, iconClass, severity = 'normal') {
        // Une seule carte à la fois ; son minuteur part avec elle.
        this._dismissResultCard(true);

        const card = document.createElement('div');
        card.id = 'clinical-result-card';
        card.className = `clin3d-card is-${severity}`;
        card.setAttribute('role', 'status');

        const head = document.createElement('div');
        head.className = 'clin3d-card-head';
        const icon = document.createElement('i');
        icon.className = iconClass;
        icon.setAttribute('aria-hidden', 'true');
        const h = document.createElement('span');
        h.className = 'clin3d-card-title';
        h.textContent = title;
        head.append(icon, h);
        if (severity !== 'normal') {
            const tag = document.createElement('span');
            tag.className = 'clin3d-card-tag';
            tag.textContent = severity === 'critical' ? 'Anormal' : 'Notable';
            head.appendChild(tag);
        }

        const body = document.createElement('div');
        body.className = 'clin3d-card-body';
        body.textContent = text;

        const foot = document.createElement('div');
        foot.className = 'clin3d-card-foot';
        foot.textContent = 'Noté dans le dossier · cliquer pour fermer';

        card.append(head, body, foot);
        document.body.appendChild(card);

        // Le temps de lecture suit la longueur du texte (un résultat
        // d'auscultation de trois lignes ne se lit pas en 5 s) et se suspend
        // au survol.
        const delay = Math.min(16000, 5000 + text.length * 45);
        const arm = () => { this._cardTimer = setTimeout(() => this._dismissResultCard(), delay); };
        card.addEventListener('mouseenter', () => clearTimeout(this._cardTimer));
        card.addEventListener('mouseleave', arm);
        card.addEventListener('click', () => this._dismissResultCard());
        arm();
    }

    _dismissResultCard(immediate = false) {
        clearTimeout(this._cardTimer);
        this._cardTimer = null;
        const card = document.getElementById('clinical-result-card');
        if (!card) return;
        if (immediate) { card.remove(); return; }
        card.removeAttribute('id');
        card.classList.add('is-leaving');
        setTimeout(() => card.remove(), 300);
    }
}
