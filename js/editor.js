/**
 * ==========================================================================
 * MEDGAME EDITOR 2.0 — Contrôleur Studio & Rétrocompatibilité Totale JSON 2.0
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialisation
    initNavigation();
    initSidebarToggle();
    initPatientSync();
    initDynamicLists();
    initModals();
    initAIInteractions();
    initFileHandlers();
    initAutosave();

    // Charger le cas initial (depuis session preview, ou localstorage, ou défaut)
    loadInitialCase();
});

// ==================== 1. NAVIGATION & LAYOUT ====================

function initNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const sections = document.querySelectorAll('.game-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(s => s.classList.remove('active'));
            const targetSec = document.getElementById(targetId);
            if (targetSec) {
                targetSec.classList.add('active');
            }

            // Close sidebar on mobile
            if (window.innerWidth <= 900) {
                document.querySelector('.app-container')?.classList.add('sidebar-collapsed');
            }
        });
    });
}

function initSidebarToggle() {
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const appContainer = document.querySelector('.app-container');

    if (toggleBtn && appContainer) {
        const isCollapsed = sessionStorage.getItem('editorSidebarCollapsed') === 'true';
        if (isCollapsed) appContainer.classList.add('sidebar-collapsed');

        toggleBtn.addEventListener('click', () => {
            appContainer.classList.toggle('sidebar-collapsed');
            sessionStorage.setItem('editorSidebarCollapsed', appContainer.classList.contains('sidebar-collapsed'));
        });
    }
}

function initPatientSync() {
    const nomInput = document.getElementById('patient-nom');
    const prenomInput = document.getElementById('patient-prenom');
    const ageInput = document.getElementById('patient-age');
    const sexeInput = document.getElementById('patient-sexe');

    const updateSidebarCard = () => {
        const nom = nomInput?.value.trim() || 'Nom';
        const prenom = prenomInput?.value.trim() || 'Prénom';
        const age = ageInput?.value.trim() || '--';
        const sexe = sexeInput?.value || '--';

        const nameEl = document.getElementById('sidebar-patient-name');
        const subEl = document.getElementById('sidebar-patient-sub');
        const avatarEl = document.getElementById('sidebar-avatar');

        if (nameEl) nameEl.textContent = `${prenom} ${nom}`;
        if (subEl) subEl.textContent = `${age} ans · ${sexe}`;
        if (avatarEl) avatarEl.textContent = prenom.charAt(0).toUpperCase() || '?';

        updateCompletionMeter();
    };

    [nomInput, prenomInput, ageInput, sexeInput].forEach(input => {
        input?.addEventListener('input', updateSidebarCard);
        input?.addEventListener('change', updateSidebarCard);
    });

    // Écoute de l'ensemble des inputs pour la jauge de complétude
    document.addEventListener('input', () => updateCompletionMeter());
}

function updateCompletionMeter() {
    const data = collectData();
    let score = 0;
    let total = 10;

    if (data.patient?.nom && data.patient?.prenom) score += 1;
    if (data.interrogatoire?.motifHospitalisation) score += 1;
    if (data.interrogatoire?.histoireMaladie?.descriptionDouleur || data.interrogatoire?.histoireMaladie?.debutSymptomes) score += 1;
    if (data.examenClinique?.constantes?.tension) score += 1;
    if (data.availableExams && data.availableExams.length > 0) score += 1;
    if (data.correctDiagnostic) score += 2;
    if (data.correctTreatments && data.correctTreatments.length > 0) score += 1;
    if (data.correction && data.correction.length > 30) score += 1;
    if (data.ecos && data.ecos.vignette?.role) score += 1;

    const percentage = Math.min(100, Math.round((score / total) * 100));
    const fillEl = document.getElementById('completion-fill');
    const textEl = document.getElementById('completion-text');

    if (fillEl) fillEl.style.width = `${percentage}%`;
    if (textEl) textEl.textContent = `${percentage}%`;
}

// ==================== 2. LISTES DYNAMIQUES & REPEATERS ====================

function initDynamicLists() {
    // Antécédents Médicaux
    document.getElementById('btn-add-ant-med')?.addEventListener('click', () => {
        addAntMedItem({ type: '', traitement: '' });
    });

    // Antécédents Chirurgicaux
    document.getElementById('btn-add-ant-chir')?.addEventListener('click', () => {
        addAntChirItem({ intervention: '', annee: '' });
    });

    // Antécédents Familiaux
    document.getElementById('btn-add-ant-fam')?.addEventListener('click', () => {
        addAntFamItem({ antecedent: '', lien: '' });
    });

    // Traitements
    document.getElementById('btn-add-traitement')?.addEventListener('click', () => {
        addTraitementItem({ nom: '', dose: '', frequence: '' });
    });

    // Appareil Clinique Personnalisé
    document.getElementById('btn-add-custom-exam-sec')?.addEventListener('click', () => {
        const title = prompt("Nom du nouvel appareil (ex: Examen Cutané, Examen ORL...) :", "Examen Spécifique");
        if (title) {
            const key = 'examen' + title.replace(/[^a-zA-Z0-9]/g, '');
            renderDynamicExamSection(key, title, { observation: "Normal." });
        }
    });

    // Examens Paracliniques
    document.getElementById('btn-add-exam-row')?.addEventListener('click', () => {
        addExamParaclinicRow("Nouvel Examen", "Résultat normal.", "utile");
    });

    // Diagnostics Options
    document.getElementById('btn-add-diag-option')?.addEventListener('click', () => {
        addDiagnosticOptionItem("Nouveau diagnostic différentiel");
    });

    // Traitements Options
    document.getElementById('btn-add-traitement-option')?.addEventListener('click', () => {
        addTreatmentOptionItem("Nouveau traitement", "neutre");
    });

    // Verrous & Quiz
    document.getElementById('btn-add-lock')?.addEventListener('click', () => {
        addLockCard({
            id: 'lock_' + Date.now(),
            type: 'QCM',
            label: 'Défi clinique',
            target_fields: ['examResults.ECG'],
            challenge: {
                question: 'Question du défi ?',
                options: ['Option 1 (Bonne réponse)', 'Option 2', 'Option 3', 'Option 4'],
                correct_indices: [0]
            },
            feedback_error: 'Erreur. Explication...'
        });
    });

    document.getElementById('btn-add-postgame-q')?.addEventListener('click', () => {
        addPostGameQuestionCard({
            type: 'QCM',
            challenge: {
                question: 'Question post-jeu ?',
                options: ['Option 1 (Bonne réponse)', 'Option 2'],
                correct_indices: [0]
            },
            feedback_error: 'Revoyez les recommandations...'
        });
    });

    // ECOS
    document.getElementById('ecos-toggle-enable')?.addEventListener('change', (e) => {
        const container = document.getElementById('ecos-fields-container');
        if (container) container.style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('btn-add-ecos-aptitude')?.addEventListener('click', () => {
        addEcosAptitudeRow({
            id: 'item_' + Date.now(),
            label: 'Nouvel item clinique',
            weight: 1,
            triggerKeywords: ['mot1', 'mot2'],
            criteria: {
                fait: 'Parfaitement réalisé',
                en_partie: 'Incomplet',
                non_fait: 'Non réalisé'
            }
        });
    });

    // Markdown Preview Toggle
    document.getElementById('btn-toggle-preview-md')?.addEventListener('click', () => {
        const input = document.getElementById('correction-markdown-input');
        const box = document.getElementById('correction-preview-box');
        if (input && box) {
            if (box.style.display === 'none') {
                box.innerHTML = typeof parseMarkdown === 'function' ? parseMarkdown(input.value) : input.value;
                box.style.display = 'block';
                input.style.display = 'none';
            } else {
                box.style.display = 'none';
                input.style.display = 'block';
            }
        }
    });
}

// --- Helpers pour Repeaters ---

function addAntMedItem(data = { type: '', traitement: '' }) {
    const list = document.getElementById('list-ant-med');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'repeater-row';
    row.innerHTML = `
        <input type="text" class="field-type" placeholder="Type / Pathologie (ex: Diabète T2)" value="${escapeHtml(data.type || '')}">
        <input type="text" class="field-traitement" placeholder="Traitement associé (ex: Metformine)" value="${escapeHtml(data.traitement || '')}">
        <button class="btn-icon-danger" title="Supprimer" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
    `;
    list.appendChild(row);
}

function addAntChirItem(data = { intervention: '', annee: '' }) {
    const list = document.getElementById('list-ant-chir');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'repeater-row';
    row.innerHTML = `
        <input type="text" class="field-intervention" placeholder="Intervention (ex: Appendicectomie)" value="${escapeHtml(data.intervention || '')}">
        <input type="text" class="field-annee" placeholder="Année (ex: 2015)" value="${escapeHtml(data.annee || '')}" style="max-width:120px;">
        <button class="btn-icon-danger" title="Supprimer" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
    `;
    list.appendChild(row);
}

function addAntFamItem(data = { antecedent: '', lien: '' }) {
    const list = document.getElementById('list-ant-fam');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'repeater-row';
    row.innerHTML = `
        <input type="text" class="field-antecedent" placeholder="Pathologie (ex: Infarctus à 50 ans)" value="${escapeHtml(data.antecedent || data.pathologie || '')}">
        <input type="text" class="field-lien" placeholder="Lien (ex: Père)" value="${escapeHtml(data.lien || '')}" style="max-width:150px;">
        <button class="btn-icon-danger" title="Supprimer" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
    `;
    list.appendChild(row);
}

function addTraitementItem(data = { nom: '', dose: '', frequence: '' }) {
    const list = document.getElementById('list-traitements');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'repeater-row';
    row.innerHTML = `
        <input type="text" class="field-nom" placeholder="Médicament (ex: Kardégic)" value="${escapeHtml(data.nom || '')}">
        <input type="text" class="field-dose" placeholder="Dosage (ex: 75 mg)" value="${escapeHtml(data.dose || '')}" style="max-width:140px;">
        <input type="text" class="field-frequence" placeholder="Fréquence (ex: 1/j)" value="${escapeHtml(data.frequence || '')}" style="max-width:120px;">
        <button class="btn-icon-danger" title="Supprimer" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
    `;
    list.appendChild(row);
}

function renderDynamicExamSection(key, title, dataObj = {}) {
    const container = document.getElementById('dynamic-exam-sections-list');
    if (!container) return;

    let secCard = container.querySelector(`[data-exam-key="${key}"]`);
    if (!secCard) {
        secCard = document.createElement('div');
        secCard.className = 'studio-card';
        secCard.style.background = 'rgba(255,255,255,0.015)';
        secCard.style.marginTop = '16px';
        secCard.setAttribute('data-exam-key', key);
        container.appendChild(secCard);
    }

    let rowsHtml = '';
    for (const [subKey, val] of Object.entries(dataObj)) {
        rowsHtml += `
            <div class="form-group">
                <label class="form-label">${escapeHtml(subKey)}</label>
                <input type="text" class="form-control exam-sub-field" data-subkey="${escapeHtml(subKey)}" value="${escapeHtml(typeof val === 'string' ? val : JSON.stringify(val))}">
            </div>
        `;
    }

    secCard.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="margin:0; color:#00f2fe; font-size:0.95rem;"><i class="fas fa-stethoscope"></i> ${escapeHtml(title)}</h4>
            <button class="btn-icon-danger" title="Supprimer l'appareil" onclick="this.closest('.studio-card').remove()"><i class="fas fa-trash"></i></button>
        </div>
        <div class="form-grid-2">
            ${rowsHtml}
        </div>
    `;
}

function addExamParaclinicRow(name = '', result = '', grade = 'utile', imageBase64 = null) {
    const list = document.getElementById('examens-paracliniques-list');
    if (!list) return;

    const row = document.createElement('div');
    row.className = 'exam-item-card';
    row.innerHTML = `
        <div>
            <label class="form-label">Nom de l'Examen</label>
            <input type="text" class="form-control exam-name-input" value="${escapeHtml(name)}" placeholder="ex: ECG 12 dérivations">
        </div>
        <div>
            <label class="form-label">Résultat Détaillé</label>
            <textarea class="form-control exam-result-input" rows="2" placeholder="Résultat ou interprétation...">${escapeHtml(result)}</textarea>
            <div class="exam-img-preview-box" style="margin-top:6px; ${imageBase64 ? '' : 'display:none;'}">
                ${imageBase64 ? `<img src="${imageBase64}" style="max-height:80px; border-radius:6px; border:1px solid rgba(255,255,255,0.2);">` : ''}
            </div>
        </div>
        <div>
            <label class="form-label">Gradation</label>
            <select class="form-control gradation-select" data-val="${grade}">
                <option value="parfait" ${grade === 'parfait' ? 'selected' : ''}>★ Parfait (1ère Ligne)</option>
                <option value="utile" ${grade === 'utile' ? 'selected' : ''}>● Utile (2ème Ligne)</option>
                <option value="inutile" ${grade === 'inutile' ? 'selected' : ''}>○ Inutile</option>
                <option value="dangereux" ${grade === 'dangereux' ? 'selected' : ''}>☠ Dangereux</option>
            </select>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; margin-top:22px;">
            <button class="btn-icon-danger" title="Supprimer l'examen" onclick="this.closest('.exam-item-card').remove()"><i class="fas fa-trash"></i></button>
        </div>
    `;

    const select = row.querySelector('.gradation-select');
    select?.addEventListener('change', () => {
        select.setAttribute('data-val', select.value);
    });

    list.appendChild(row);
}

function addDiagnosticOptionItem(name = '') {
    const list = document.getElementById('list-diagnostics-options');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'repeater-row';
    row.innerHTML = `
        <input type="text" class="field-diag-option" placeholder="Diagnostic différentiel" value="${escapeHtml(name)}">
        <button class="btn-icon-danger" title="Supprimer" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
    `;
    list.appendChild(row);
}

function addTreatmentOptionItem(name = '', role = 'neutre') {
    const list = document.getElementById('list-traitements-options');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'repeater-row';
    row.innerHTML = `
        <input type="text" class="field-treatment-name" placeholder="Nom du traitement" value="${escapeHtml(name)}">
        <select class="field-treatment-role" style="max-width:180px;">
            <option value="correct" ${role === 'correct' ? 'selected' : ''}>✓ 1ère Ligne (Correct)</option>
            <option value="secondLine" ${role === 'secondLine' ? 'selected' : ''}>● 2ème Ligne</option>
            <option value="neutre" ${role === 'neutre' ? 'selected' : ''}>○ Neutre / Faux</option>
            <option value="fatal" ${role === 'fatal' ? 'selected' : ''}>☠ Fatal / Contre-indiqué</option>
        </select>
        <button class="btn-icon-danger" title="Supprimer" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
    `;
    list.appendChild(row);
}

function addLockCard(lockData) {
    const container = document.getElementById('locks-list-container');
    if (!container) return;

    const card = document.createElement('div');
    card.className = 'studio-card';
    card.style.background = 'rgba(255,255,255,0.02)';
    card.style.marginTop = '12px';

    const question = lockData.challenge?.question || '';
    const options = lockData.challenge?.options || ['Option A', 'Option B', 'Option C', 'Option D'];
    const feedback = lockData.feedback_error || '';
    const target = (lockData.target_fields || []).join(', ');

    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="margin:0; color:#f59e0b; font-size:0.95rem;"><i class="fas fa-lock"></i> Défi Verrou</h4>
            <button class="btn-icon-danger" title="Supprimer le verrou" onclick="this.closest('.studio-card').remove()"><i class="fas fa-trash"></i></button>
        </div>
        <div class="form-grid-2">
            <div class="form-group">
                <label class="form-label">Champ(s) Cible Verrouillé(s)</label>
                <input type="text" class="form-control lock-target" value="${escapeHtml(target)}" placeholder="ex: examResults.ECG">
            </div>
            <div class="form-group">
                <label class="form-label">Question Clinique du Défi</label>
                <input type="text" class="form-control lock-question" value="${escapeHtml(question)}" placeholder="ex: Quel signe confirme l'ischémie ?">
            </div>
        </div>
        <div class="form-group">
            <label class="form-label">Options du QCM (la 1ère est la bonne réponse, une par ligne)</label>
            <textarea class="form-control lock-options" rows="3">${escapeHtml(options.join('\n'))}</textarea>
        </div>
        <div class="form-group">
            <label class="form-label">Feedback Explicatif en cas d'erreur</label>
            <input type="text" class="form-control lock-feedback" value="${escapeHtml(feedback)}" placeholder="ex: L'ischémie myocardique se traduit par...">
        </div>
    `;

    container.appendChild(card);
}

function addPostGameQuestionCard(qData) {
    const container = document.getElementById('postgame-questions-container');
    if (!container) return;

    const card = document.createElement('div');
    card.className = 'studio-card';
    card.style.background = 'rgba(255,255,255,0.02)';
    card.style.marginTop = '12px';

    const question = qData.challenge?.question || '';
    const options = qData.challenge?.options || ['Option A', 'Option B'];
    const feedback = qData.feedback_error || '';

    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="margin:0; color:#00f2fe; font-size:0.95rem;"><i class="fas fa-circle-question"></i> Question Quiz</h4>
            <button class="btn-icon-danger" title="Supprimer" onclick="this.closest('.studio-card').remove()"><i class="fas fa-trash"></i></button>
        </div>
        <div class="form-group">
            <label class="form-label">Question</label>
            <input type="text" class="form-control postgame-q-text" value="${escapeHtml(question)}" placeholder="ex: Quelle est la durée minimale recommandée du traitement ?">
        </div>
        <div class="form-group">
            <label class="form-label">Options (la 1ère est la bonne, une par ligne)</label>
            <textarea class="form-control postgame-q-options" rows="3">${escapeHtml(options.join('\n'))}</textarea>
        </div>
        <div class="form-group">
            <label class="form-label">Feedback</label>
            <input type="text" class="form-control postgame-q-feedback" value="${escapeHtml(feedback)}">
        </div>
    `;

    container.appendChild(card);
}

function addEcosAptitudeRow(apt) {
    const container = document.getElementById('ecos-aptitudes-list');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'studio-card';
    row.style.background = 'rgba(255,255,255,0.02)';
    row.style.marginTop = '10px';

    const label = apt.label || '';
    const weight = apt.weight || 1;
    const keywords = (apt.triggerKeywords || []).join(', ');
    const criteria = apt.criteria || {};

    row.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <strong style="color:#00f2fe; font-size:0.9rem;">Critère Clinique (Poids: ${weight})</strong>
            <button class="btn-icon-danger" title="Supprimer" onclick="this.closest('.studio-card').remove()"><i class="fas fa-trash"></i></button>
        </div>
        <div class="form-grid-2">
            <div class="form-group">
                <label class="form-label">Intitulé du critère</label>
                <input type="text" class="form-control ecos-apt-label" value="${escapeHtml(label)}" placeholder="ex: Caractérise la douleur rétrosternale">
            </div>
            <div class="form-group">
                <label class="form-label">Mots-clés déclencheurs</label>
                <input type="text" class="form-control ecos-apt-kw" value="${escapeHtml(keywords)}" placeholder="ex: constrictive, effort, trinitrine">
            </div>
        </div>
        <div class="form-grid-3" style="margin-top:6px;">
            <div class="form-group">
                <label class="form-label" style="color:#34d399;">Critère FAIT (Max points)</label>
                <input type="text" class="form-control ecos-crit-fait" value="${escapeHtml(criteria.fait || '')}" placeholder="Description niveau réussi">
            </div>
            <div class="form-group">
                <label class="form-label" style="color:#f59e0b;">Critère EN PARTIE (50%)</label>
                <input type="text" class="form-control ecos-crit-partie" value="${escapeHtml(criteria.en_partie || '')}" placeholder="Description niveau moyen">
            </div>
            <div class="form-group">
                <label class="form-label" style="color:#fb7185;">Critère NON FAIT (0%)</label>
                <input type="text" class="form-control ecos-crit-non" value="${escapeHtml(criteria.non_fait || '')}" placeholder="Description non fait">
            </div>
        </div>
    `;

    container.appendChild(row);
}

// ==================== 3. MODALS & HANDLERS ====================

function initModals() {
    // Modal IA
    const aiModal = document.getElementById('ai-modal');
    const aiOpenBtn = document.getElementById('btn-open-ai-modal');
    const aiTopBtn = document.getElementById('btn-topbar-ai');
    const aiCloseBtn = document.getElementById('ai-modal-close');

    [aiOpenBtn, aiTopBtn].forEach(btn => {
        btn?.addEventListener('click', () => {
            if (aiModal) aiModal.style.display = 'flex';
        });
    });

    // Modal Dictée Vocale (Win + H)
    const dictModal = document.getElementById('dictation-modal');
    const dictOpenBtn = document.getElementById('btn-open-dictation-modal');
    const dictCloseBtn = document.getElementById('dictation-modal-close');

    dictOpenBtn?.addEventListener('click', () => {
        if (dictModal) {
            dictModal.style.display = 'flex';
            setTimeout(() => document.getElementById('dictation-raw-input')?.focus(), 100);
        }
    });

    dictCloseBtn?.addEventListener('click', () => {
        if (dictModal) dictModal.style.display = 'none';
    });

    // Modal Load Options
    const loadModal = document.getElementById('load-options-modal');
    const loadBtn = document.getElementById('btn-load-options');
    const loadClose = document.getElementById('load-options-close');

    loadBtn?.addEventListener('click', () => {
        if (loadModal) loadModal.style.display = 'flex';
    });

    loadClose?.addEventListener('click', () => {
        if (loadModal) loadModal.style.display = 'none';
    });

    // Modal Unlocked Cases
    const unlockedModal = document.getElementById('unlocked-cases-modal');
    const openUnlockedBtn = document.getElementById('btn-open-unlocked-modal');
    const unlockedClose = document.getElementById('unlocked-cases-close');

    openUnlockedBtn?.addEventListener('click', () => {
        if (loadModal) loadModal.style.display = 'none';
        if (unlockedModal) {
            unlockedModal.style.display = 'flex';
            loadUnlockedCasesList();
        }
    });

    unlockedClose?.addEventListener('click', () => {
        if (unlockedModal) unlockedModal.style.display = 'none';
    });

    // Fermeture par clic arrière-plan
    window.addEventListener('click', (e) => {
        if (e.target === aiModal) aiModal.style.display = 'none';
        if (e.target === dictModal) dictModal.style.display = 'none';
        if (e.target === loadModal) loadModal.style.display = 'none';
        if (e.target === unlockedModal) unlockedModal.style.display = 'none';
    });
}

// ==================== 4. INTERACTIONS AVEC L'ASSISTANT IA ====================

function initAIInteractions() {
    // Traitement de la Dictée Vocale (Win + H)
    document.getElementById('btn-clear-dictation')?.addEventListener('click', () => {
        const input = document.getElementById('dictation-raw-input');
        if (input) input.value = '';
    });

    document.getElementById('btn-process-dictation')?.addEventListener('click', async () => {
        const rawText = document.getElementById('dictation-raw-input')?.value.trim();
        const contentBox = document.getElementById('dictation-modal-content');
        const loadingBox = document.getElementById('dictation-loading-box');

        if (!rawText || rawText.length < 15) {
            alert("Veuillez d'abord dicter ou saisir votre observation clinique (au moins quelques phrases). Utilisez Win + H pour parler au micro !");
            return;
        }

        try {
            if (contentBox) contentBox.style.display = 'none';
            if (loadingBox) loadingBox.style.display = 'flex';

            const currentData = collectData();
            const structuredCase = await EditorAI.structureDictation(rawText, currentData);
            populateEditor(structuredCase);

            document.getElementById('dictation-modal').style.display = 'none';
            alert("🎙️ Dictée vocale structurée avec succès ! Toutes les sections du cas clinique ont été remplies.");
        } catch (err) {
            console.error("Dictation Processing Error:", err);
            alert("Erreur lors de la structuration de la dictée : " + err.message);
        } finally {
            if (contentBox) contentBox.style.display = 'block';
            if (loadingBox) loadingBox.style.display = 'none';
        }
    });

    // Bouton de lancement depuis le modal IA
    document.getElementById('btn-run-ai-generate')?.addEventListener('click', async () => {
        const mode = document.getElementById('ai-action-mode')?.value;
        const topic = document.getElementById('ai-topic-input')?.value.trim();
        const specialty = document.getElementById('ai-specialty-select')?.value;
        const difficulty = parseInt(document.getElementById('ai-difficulty-select')?.value || '3');

        const formBox = document.getElementById('ai-modal-form');
        const loadingBox = document.getElementById('ai-loading-box');

        if (!topic && mode === 'full_case') {
            alert("Veuillez entrer une pathologie ou un sujet clinique (ex: Embolie pulmonaire).");
            return;
        }

        try {
            if (formBox) formBox.style.display = 'none';
            if (loadingBox) loadingBox.style.display = 'flex';

            if (mode === 'full_case') {
                const generatedCase = await EditorAI.generateFullCase({ specialty, topic, difficulty });
                populateEditor(generatedCase);
                alert("✨ Cas clinique complet généré avec succès !");
            } else if (mode === 'autocomplete') {
                const currentData = collectData();
                const enrichedCase = await EditorAI.autocompleteMissingFields(currentData);
                populateEditor(enrichedCase);
                alert("⚡ Champs manquants autocomplétés avec succès !");
            } else if (mode === 'ecos_station') {
                const currentData = collectData();
                const ecosResult = await EditorAI.generateEcosStation(currentData);
                populateEcosFields(ecosResult);
                alert("🎓 Station ECOS et grilles R2C générées !");
            } else if (mode === 'correction_doc') {
                const currentData = collectData();
                const mdCorrection = await EditorAI.generateCorrectionMarkdown(currentData);
                const corrInput = document.getElementById('correction-markdown-input');
                if (corrInput) corrInput.value = mdCorrection;
                alert("📝 Fiche de correction rédigée !");
            }

            document.getElementById('ai-modal').style.display = 'none';
        } catch (err) {
            console.error("AI Generation Error:", err);
            alert("Erreur lors de la génération IA : " + err.message);
        } finally {
            if (formBox) formBox.style.display = 'block';
            if (loadingBox) loadingBox.style.display = 'none';
        }
    });

    // Boutons IA section par section
    document.getElementById('btn-ai-generate-persona')?.addEventListener('click', async () => {
        const motif = document.getElementById('motif-admission-input')?.value.trim() || 'Symptôme';
        const patientInfo = {
            nom: document.getElementById('patient-nom')?.value,
            prenom: document.getElementById('patient-prenom')?.value,
            age: document.getElementById('patient-age')?.value,
            sexe: document.getElementById('patient-sexe')?.value
        };

        try {
            const res = await EditorAI.generatePersona(patientInfo, motif);
            if (res.persona) {
                document.getElementById('persona-ton').value = res.persona.ton || '';
                document.getElementById('persona-registre').value = res.persona.registre || '';
                document.getElementById('persona-loquacite').value = res.persona.loquacite || 'normal';
                document.getElementById('persona-anxiete').value = res.persona.anxiete || 50;
                document.getElementById('persona-confiance').value = res.persona.confiance || 60;
                document.getElementById('persona-style-parole').value = res.persona.style_parole || '';
                document.getElementById('persona-exemples-phrases').value = (res.persona.exemples_phrases || []).join('\n');
            }
            if (res.dialogue) {
                document.getElementById('dialogue-phrase-ouverture').value = res.dialogue.phraseOuverture || '';
            }
            alert("✨ Persona et dialogue générés !");
        } catch (err) {
            alert("Erreur IA : " + err.message);
        }
    });

    document.getElementById('btn-ai-generate-paraclinic')?.addEventListener('click', async () => {
        const diagnostic = document.getElementById('diag-correct')?.value.trim() || 'Pathologie';
        const motif = document.getElementById('motif-admission-input')?.value.trim() || 'Motif';

        try {
            const res = await EditorAI.generateExamGradation(diagnostic, motif);
            if (res.availableExams && res.examResults) {
                const list = document.getElementById('examens-paracliniques-list');
                if (list) list.innerHTML = '';

                const parfaits = res.examGradation?.parfaits || [];
                const utiles = res.examGradation?.utiles || [];
                const dangereux = res.examGradation?.dangereux || [];

                res.availableExams.forEach(name => {
                    let grade = 'inutile';
                    if (parfaits.includes(name)) grade = 'parfait';
                    else if (utiles.includes(name)) grade = 'utile';
                    else if (dangereux.includes(name)) grade = 'dangereux';

                    addExamParaclinicRow(name, res.examResults[name] || 'Résultat...', grade);
                });
            }
            alert("✨ Examens et gradation générés !");
        } catch (err) {
            alert("Erreur IA : " + err.message);
        }
    });

    document.getElementById('btn-ai-generate-therapeutics')?.addEventListener('click', async () => {
        const diagnostic = document.getElementById('diag-correct')?.value.trim() || 'Pathologie';
        const motif = document.getElementById('motif-admission-input')?.value.trim() || 'Motif';

        try {
            const res = await EditorAI.generateTherapeutics(diagnostic, motif);
            if (res.possibleDiagnostics) {
                const diagList = document.getElementById('list-diagnostics-options');
                if (diagList) diagList.innerHTML = '';
                res.possibleDiagnostics.filter(d => d !== res.correctDiagnostic).forEach(d => addDiagnosticOptionItem(d));
            }
            if (res.pieges) {
                document.getElementById('diag-pieges').value = res.pieges.join(', ');
            }
            if (res.possibleTreatments) {
                const treatList = document.getElementById('list-traitements-options');
                if (treatList) treatList.innerHTML = '';

                const corrects = res.correctTreatments || [];
                const secondLine = res.secondLineTreatments || [];
                const fatals = res.fatalTreatments || [];

                res.possibleTreatments.forEach(t => {
                    let role = 'neutre';
                    if (corrects.includes(t)) role = 'correct';
                    else if (secondLine.includes(t)) role = 'secondLine';
                    else if (fatals.includes(t)) role = 'fatal';

                    addTreatmentOptionItem(t, role);
                });
            }
            alert("✨ Diagnostics différentiels et options thérapeutiques générés !");
        } catch (err) {
            alert("Erreur IA : " + err.message);
        }
    });

    document.getElementById('btn-ai-generate-correction')?.addEventListener('click', async () => {
        try {
            const currentData = collectData();
            const md = await EditorAI.generateCorrectionMarkdown(currentData);
            const input = document.getElementById('correction-markdown-input');
            if (input) input.value = md;
            alert("✨ Fiche de correction générée !");
        } catch (err) {
            alert("Erreur IA : " + err.message);
        }
    });

    document.getElementById('btn-ai-generate-ecos')?.addEventListener('click', async () => {
        try {
            const currentData = collectData();
            const ecos = await EditorAI.generateEcosStation(currentData);
            populateEcosFields(ecos);
            alert("✨ Station ECOS et grilles R2C générées !");
        } catch (err) {
            alert("Erreur IA : " + err.message);
        }
    });
}

// ==================== 5. IMPORT, EXPORT, SUPABASE & PREVIEW ====================

function initFileHandlers() {
    // Import JSON Local
    const fileInput = document.getElementById('load-json-input');
    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                populateEditor(data);
                alert("Cas importé avec succès !");
            } catch (err) {
                alert("Erreur lors de la lecture du JSON : " + err.message);
            }
        };
        reader.readAsText(file);
    });

    // Exporter JSON
    document.getElementById('btn-save-json')?.addEventListener('click', () => {
        const data = collectData();
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.id || 'nouveau_cas'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // Tester en direct
    document.getElementById('btn-preview-case')?.addEventListener('click', () => {
        const data = collectData();
        sessionStorage.setItem('previewCase', JSON.stringify(data));
        window.location.href = 'game.html?preview=true';
    });

    // Nouveau cas vierge
    document.getElementById('btn-new-case')?.addEventListener('click', () => {
        if (confirm("Voulez-vous réinitialiser l'éditeur et créer un nouveau cas vierge ?")) {
            localStorage.removeItem('medgame_editor_autosave');
            sessionStorage.removeItem('previewCase');
            location.reload();
        }
    });

    // Synchronisation / Envoi Supabase
    document.getElementById('btn-push-supabase')?.addEventListener('click', async () => {
        const data = collectData();
        const btn = document.getElementById('btn-push-supabase');
        const origText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publication...';
        btn.disabled = true;

        try {
            const user = await window.requireAuth();
            if (!user) return;

            const isUserAdmin = await window.isAdmin();
            const specialty = document.getElementById('case-specialty')?.value || 'Cardiologie';
            const status = isUserAdmin ? 'published' : 'pending';

            const payload = {
                id: data.id || 'case_' + Date.now(),
                content: data,
                specialty: specialty,
                title: data.interrogatoire?.motifHospitalisation || 'Cas Clinique',
                status: status,
                author_name: data.redacteur || user.email
            };

            const { error } = await supabase.from('cases').upsert([payload]);
            if (error) throw error;

            alert(isUserAdmin ? "Cas publié avec succès sur Supabase !" : "Cas soumis pour modération ! Merci pour votre contribution.");
        } catch (err) {
            console.error("Supabase Push Error:", err);
            alert("Erreur lors de la publication : " + err.message);
        } finally {
            btn.innerHTML = origText;
            btn.disabled = false;
        }
    });
}

function initAutosave() {
    setInterval(() => {
        const data = collectData();
        localStorage.setItem('medgame_editor_autosave', JSON.stringify(data));
    }, 5000);
}

function loadInitialCase() {
    const previewStr = sessionStorage.getItem('previewCase');
    const autosaveStr = localStorage.getItem('medgame_editor_autosave');

    if (previewStr) {
        try {
            populateEditor(JSON.parse(previewStr));
            return;
        } catch (e) {
            console.error("Erreur preview:", e);
        }
    }

    if (autosaveStr) {
        try {
            populateEditor(JSON.parse(autosaveStr));
            return;
        } catch (e) {
            console.error("Erreur autosave:", e);
        }
    }

    // Sinon créer une structure initiale par défaut
    populateEditor(getDefaultCaseTemplate());
}

async function loadUnlockedCasesList() {
    const listEl = document.getElementById('unlocked-cases-list');
    if (!listEl) return;
    listEl.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Chargement des cas...</div>';

    try {
        const response = await fetch('data/case-index.json');
        if (!response.ok) throw new Error("Index des cas introuvable");
        const index = await response.json();

        listEl.innerHTML = '';
        for (const spec in index) {
            for (const file of index[spec]) {
                const item = document.createElement('div');
                item.className = 'repeater-row';
                item.style.cursor = 'pointer';
                item.innerHTML = `
                    <div style="flex:1;">
                        <strong style="color:#00f2fe;"><i class="fas fa-file-medical"></i> ${file.replace('.json', '')}</strong>
                        <div style="font-size:0.8rem; color:#94a3b8;">Spécialité : ${spec}</div>
                    </div>
                    <button class="btn-sidebar" style="padding:6px 12px; font-size:0.8rem;">Charger</button>
                `;
                item.addEventListener('click', async () => {
                    const res = await fetch(`data/${file}`);
                    if (res.ok) {
                        const caseData = await res.json();
                        populateEditor(caseData);
                        document.getElementById('unlocked-cases-modal').style.display = 'none';
                        alert(`Cas "${file}" chargé avec succès !`);
                    }
                });
                listEl.appendChild(item);
            }
        }
    } catch (err) {
        listEl.innerHTML = `<div style="color:#fb7185; padding:15px; text-align:center;">Erreur : ${err.message}</div>`;
    }
}

// ==================== 6. POPULATE & COLLECT DATA (SCHEMA 2.0) ====================

function populateEditor(data) {
    if (!data) return;

    // 1. Métadonnées
    setVal('case-id', data.id || 'nouveau_cas');
    setVal('case-redacteur', data.redacteur || 'Dr MedGame');
    setVal('case-specialty', data.specialty || 'Cardiologie');
    setVal('case-difficulty', data.difficulty || 3);
    setVal('case-item-r2c', data.itemR2C || '');
    setVal('case-referentiel', data.referentiel || '');

    // 2. Patient
    const p = data.patient || {};
    setVal('patient-nom', p.nom || '');
    setVal('patient-prenom', p.prenom || '');
    setVal('patient-age', p.age || '');
    setVal('patient-sexe', p.sexe || 'M');
    setVal('patient-taille', p.taille || '');
    setVal('patient-poids', p.poids || '');
    setVal('patient-groupe-sanguin', p.groupeSanguin || 'Inconnu');
    setVal('patient-model3d', p.model3D || '');

    // Persona
    const persona = p.persona || {};
    setVal('persona-ton', persona.ton || '');
    setVal('persona-registre', persona.registre || '');
    setVal('persona-loquacite', persona.loquacite || 'normal');
    setVal('persona-anxiete', persona.anxiete || 50);
    setVal('persona-confiance', persona.confiance || 60);
    setVal('persona-style-parole', persona.style_parole || '');
    setVal('persona-exemples-phrases', (persona.exemples_phrases || []).join('\n'));

    // Dialogue
    const dialogue = data.dialogue || {};
    setVal('dialogue-phrase-ouverture', dialogue.phraseOuverture || '');

    // 3. Anamnèse & Histoire
    const interro = data.interrogatoire || {};
    setVal('motif-admission-input', interro.motifHospitalisation || '');

    const hdm = interro.histoireMaladie || {};
    setVal('hdm-debut', hdm.debutSymptomes || '');
    setVal('hdm-evolution', hdm.evolution || '');
    setVal('hdm-declenchants', hdm.facteursDeclenchants || '');
    setVal('hdm-douleur', hdm.descriptionDouleur || '');
    setVal('hdm-symptomes-associes', (hdm.symptomesAssocies || []).join(', '));
    setVal('hdm-verbatim', interro.verbatim || '');
    setVal('hdm-remarques', hdm.remarques || '');

    // Antécédents
    const antMedList = document.getElementById('list-ant-med');
    if (antMedList) antMedList.innerHTML = '';
    (interro.antecedents?.medicaux || []).forEach(item => addAntMedItem(item));

    const antChirList = document.getElementById('list-ant-chir');
    if (antChirList) antChirList.innerHTML = '';
    (interro.antecedents?.chirurgicaux || []).forEach(item => addAntChirItem(item));

    const antFamList = document.getElementById('list-ant-fam');
    if (antFamList) antFamList.innerHTML = '';
    (interro.antecedents?.familiaux || []).forEach(item => addAntFamItem(item));

    // Traitements & Allergies
    const traitList = document.getElementById('list-traitements');
    if (traitList) traitList.innerHTML = '';
    (interro.traitements || []).forEach(item => addTraitementItem(item));

    const allergies = interro.allergies;
    if (allergies) {
        if (typeof allergies === 'string') setVal('allergies-input', allergies);
        else if (allergies.liste) setVal('allergies-input', allergies.liste.join(', '));
    }

    // Mode de vie
    const mdv = interro.modeDeVie || {};
    setVal('lifestyle-tabac', mdv.tabac?.quantite || '');
    setVal('lifestyle-alcool', mdv.alcool?.quantite || '');
    setVal('lifestyle-activite', mdv.activitePhysique?.description || '');
    setVal('lifestyle-alimentation', mdv.alimentation?.regime || '');
    setVal('lifestyle-profession', mdv.emploi?.profession || '');
    setVal('lifestyle-stress', mdv.emploi?.stress || '');

    // 4. Examen Clinique & Constantes
    const examCli = data.examenClinique || {};
    const c = examCli.constantes || {};
    setVal('vital-ta', (c.tension || '120/80').replace(' mmHg', ''));
    setVal('vital-fc', (c.pouls || '75').replace(' bpm', ''));
    setVal('vital-spo2', (c.saturationO2 || '98').replace('%', ''));
    setVal('vital-fr', (c.frequenceRespiratoire || '16').replace('/min', ''));
    setVal('vital-temp', (c.temperature || '37.0').replace('°C', ''));
    setVal('vital-aspect-general', examCli.aspectGeneral || '');

    // Appareils
    const dynExamContainer = document.getElementById('dynamic-exam-sections-list');
    if (dynExamContainer) dynExamContainer.innerHTML = '';
    const skipExamKeys = ['constantes', 'aspectGeneral'];
    Object.keys(examCli).forEach(key => {
        if (!skipExamKeys.includes(key)) {
            renderDynamicExamSection(key, key.replace('examen', 'Examen '), examCli[key]);
        }
    });

    // 5. Paraclinique & Gradation
    const paraclinicList = document.getElementById('examens-paracliniques-list');
    if (paraclinicList) paraclinicList.innerHTML = '';

    const availExams = data.availableExams || [];
    const results = data.examResults || {};
    const grad = data.examGradation || {};
    const parfaits = grad.parfaits || [];
    const utiles = grad.utiles || [];
    const dangereux = grad.dangereux || [];

    availExams.forEach(examName => {
        let grade = 'inutile';
        if (parfaits.includes(examName)) grade = 'parfait';
        else if (utiles.includes(examName)) grade = 'utile';
        else if (dangereux.includes(examName)) grade = 'dangereux';

        addExamParaclinicRow(examName, results[examName] || '', grade);
    });

    // 6. Diagnostics & Thérapeutique
    setVal('diag-correct', data.correctDiagnostic || '');
    const diagOptionsList = document.getElementById('list-diagnostics-options');
    if (diagOptionsList) diagOptionsList.innerHTML = '';
    (data.possibleDiagnostics || []).filter(d => d !== data.correctDiagnostic).forEach(d => addDiagnosticOptionItem(d));
    setVal('diag-pieges', (data.pieges || []).join(', '));

    // Traitements options
    const treatOptionsList = document.getElementById('list-traitements-options');
    if (treatOptionsList) treatOptionsList.innerHTML = '';
    const possTreats = data.possibleTreatments || [];
    const corrTreats = data.correctTreatments || [];
    const secTreats = data.secondLineTreatments || [];
    const fatalTreats = data.fatalTreatments || [];

    possTreats.forEach(tName => {
        let role = 'neutre';
        if (corrTreats.includes(tName)) role = 'correct';
        else if (secTreats.includes(tName)) role = 'secondLine';
        else if (fatalTreats.includes(tName)) role = 'fatal';

        addTreatmentOptionItem(tName, role);
    });

    // 7. Dynamique
    const vitalsDyn = data.vitalsDynamics || {};
    const enableDyn = document.getElementById('dyn-enable-vitals');
    if (enableDyn) enableDyn.checked = !!data.vitalsDynamics;
    setVal('dyn-trend', vitalsDyn.trendOverMinutes || 0.05);
    setVal('dyn-multiplier', vitalsDyn.urgencyMultiplier || 1.5);
    setVal('dyn-stabilize', String(vitalsDyn.stabilizeOnCorrectTreatment !== false));

    const agg = vitalsDyn.aggravationTargets || {};
    setVal('dyn-target-fc', agg.heartRate || '');
    setVal('dyn-target-tas', agg.systolic || '');
    setVal('dyn-target-spo2', agg.spo2 || '');
    setVal('dyn-target-fr', agg.respiratoryRate || '');
    setVal('dyn-target-temp', agg.temperature || '');

    // 8. Locks & Post-game
    const locksContainer = document.getElementById('locks-list-container');
    if (locksContainer) locksContainer.innerHTML = '';
    (data.locks || []).forEach(lock => addLockCard(lock));

    const postgameContainer = document.getElementById('postgame-questions-container');
    if (postgameContainer) postgameContainer.innerHTML = '';
    (data.postGameQuestions || []).forEach(q => addPostGameQuestionCard(q));

    // 9. ECOS
    populateEcosFields(data.ecos);

    // 10. Correction & Objectifs
    setVal('correction-markdown-input', data.correction || '');
    setVal('case-objectifs-input', (data.objectifs || []).join('\n'));
    setVal('case-hints-input', (data.hints || []).join('\n'));

    // Sync sidebar & meter & 3D model preview
    document.getElementById('patient-nom')?.dispatchEvent(new Event('input'));
    if (typeof window.updatePatientModel3DPreview === 'function') {
        window.updatePatientModel3DPreview();
    }
}

function populateEcosFields(ecos) {
    const toggle = document.getElementById('ecos-toggle-enable');
    const container = document.getElementById('ecos-fields-container');

    if (!ecos) {
        if (toggle) toggle.checked = false;
        if (container) container.style.display = 'none';
        return;
    }

    if (toggle) toggle.checked = true;
    if (container) container.style.display = 'block';

    const vig = ecos.vignette || {};
    setVal('ecos-vignette-role', vig.role || '');
    setVal('ecos-vignette-contexte', vig.contexte || '');
    setVal('ecos-vignette-type', vig.typeStation || 'AVEC_PS');
    setVal('ecos-vignette-domaine-p', vig.domainePrincipal || '');
    setVal('ecos-vignette-domaine-s', vig.domaineSecondaire || '');
    setVal('ecos-consignes-attendues', (vig.consignesAttendues || []).join('\n'));
    setVal('ecos-consignes-interdites', (vig.consignesInterdites || []).join('\n'));

    const ps = ecos.patientStandardise || {};
    setVal('ecos-ps-personnalite', ps.personnalite || ps.personnalité || '');
    setVal('ecos-ps-cachees', (ps.infosCachees || []).join('\n'));

    const aptList = document.getElementById('ecos-aptitudes-list');
    if (aptList) aptList.innerHTML = '';
    (ecos.grilleAptitudesCliniques || []).forEach(apt => addEcosAptitudeRow(apt));
}

function collectData() {
    // Paraclinique
    const availableExams = [];
    const examResults = {};
    const parfaits = [];
    const utiles = [];
    const inutiles = [];
    const dangereux = [];

    document.querySelectorAll('#examens-paracliniques-list .exam-item-card').forEach(row => {
        const name = row.querySelector('.exam-name-input')?.value.trim();
        const result = row.querySelector('.exam-result-input')?.value.trim();
        const grade = row.querySelector('.gradation-select')?.value || 'utile';

        if (name) {
            availableExams.push(name);
            examResults[name] = result || 'Résultat normal.';

            if (grade === 'parfait') parfaits.push(name);
            else if (grade === 'utile') utiles.push(name);
            else if (grade === 'dangereux') dangereux.push(name);
            else inutiles.push(name);
        }
    });

    // Diagnostics
    const correctDiagnostic = document.getElementById('diag-correct')?.value.trim() || 'Diagnostic';
    const possibleDiagnostics = [correctDiagnostic];
    document.querySelectorAll('#list-diagnostics-options .field-diag-option').forEach(inp => {
        const val = inp.value.trim();
        if (val && !possibleDiagnostics.includes(val)) possibleDiagnostics.push(val);
    });

    // Traitements
    const possibleTreatments = [];
    const correctTreatments = [];
    const secondLineTreatments = [];
    const fatalTreatments = [];

    document.querySelectorAll('#list-traitements-options .repeater-row').forEach(row => {
        const name = row.querySelector('.field-treatment-name')?.value.trim();
        const role = row.querySelector('.field-treatment-role')?.value || 'neutre';

        if (name) {
            possibleTreatments.push(name);
            if (role === 'correct') correctTreatments.push(name);
            else if (role === 'secondLine') secondLineTreatments.push(name);
            else if (role === 'fatal') fatalTreatments.push(name);
        }
    });

    // Appareils Cliniques
    const examenClinique = {
        constantes: {
            tension: (getVal('vital-ta') || '120/80') + ' mmHg',
            pouls: (getVal('vital-fc') || '75') + ' bpm',
            saturationO2: (getVal('vital-spo2') || '98') + '%',
            frequenceRespiratoire: (getVal('vital-fr') || '16') + '/min',
            temperature: (getVal('vital-temp') || '37.0') + '°C'
        },
        aspectGeneral: getVal('vital-aspect-general') || 'Bon état général'
    };

    document.querySelectorAll('#dynamic-exam-sections-list .studio-card[data-exam-key]').forEach(card => {
        const key = card.getAttribute('data-exam-key');
        const subData = {};
        card.querySelectorAll('.exam-sub-field').forEach(field => {
            const subkey = field.getAttribute('data-subkey');
            subData[subkey] = field.value.trim();
        });
        examenClinique[key] = subData;
    });

    // Locks
    const locks = [];
    document.querySelectorAll('#locks-list-container .studio-card').forEach((card, idx) => {
        const targetRaw = card.querySelector('.lock-target')?.value || '';
        const question = card.querySelector('.lock-question')?.value || '';
        const optionsRaw = card.querySelector('.lock-options')?.value || '';
        const feedback = card.querySelector('.lock-feedback')?.value || '';

        locks.push({
            id: 'lock_' + (idx + 1),
            type: 'QCM',
            label: 'Défi ' + (idx + 1),
            target_fields: targetRaw.split(',').map(s => s.trim()).filter(s => s),
            challenge: {
                question: question,
                options: optionsRaw.split('\n').map(s => s.trim()).filter(s => s),
                correct_indices: [0]
            },
            feedback_error: feedback
        });
    });

    // Post-game Quiz
    const postGameQuestions = [];
    document.querySelectorAll('#postgame-questions-container .studio-card').forEach(card => {
        const qText = card.querySelector('.postgame-q-text')?.value || '';
        const optionsRaw = card.querySelector('.postgame-q-options')?.value || '';
        const feedback = card.querySelector('.postgame-q-feedback')?.value || '';

        postGameQuestions.push({
            type: 'QCM',
            challenge: {
                question: qText,
                options: optionsRaw.split('\n').map(s => s.trim()).filter(s => s),
                correct_indices: [0]
            },
            feedback_error: feedback
        });
    });

    // ECOS
    let ecosData = null;
    if (document.getElementById('ecos-toggle-enable')?.checked) {
        const aptitudes = [];
        document.querySelectorAll('#ecos-aptitudes-list .studio-card').forEach((card, idx) => {
            const label = card.querySelector('.ecos-apt-label')?.value || '';
            const kwRaw = card.querySelector('.ecos-apt-kw')?.value || '';
            const critFait = card.querySelector('.ecos-crit-fait')?.value || '';
            const critPartie = card.querySelector('.ecos-crit-partie')?.value || '';
            const critNon = card.querySelector('.ecos-crit-non')?.value || '';

            aptitudes.push({
                id: 'apt_' + (idx + 1),
                label: label,
                weight: 1,
                triggerKeywords: kwRaw.split(',').map(s => s.trim()).filter(s => s),
                criteria: {
                    fait: critFait,
                    en_partie: critPartie,
                    non_fait: critNon
                }
            });
        });

        ecosData = {
            vignette: {
                role: getVal('ecos-vignette-role'),
                contexte: getVal('ecos-vignette-contexte'),
                typeStation: getVal('ecos-vignette-type') || 'AVEC_PS',
                domainePrincipal: getVal('ecos-vignette-domaine-p'),
                domaineSecondaire: getVal('ecos-vignette-domaine-s'),
                consignesAttendues: getVal('ecos-consignes-attendues').split('\n').map(s => s.trim()).filter(s => s),
                consignesInterdites: getVal('ecos-consignes-interdites').split('\n').map(s => s.trim()).filter(s => s)
            },
            patientStandardise: {
                personnalite: getVal('ecos-ps-personnalite'),
                phraseOuverture: getVal('dialogue-phrase-ouverture'),
                infosCachees: getVal('ecos-ps-cachees').split('\n').map(s => s.trim()).filter(s => s)
            },
            grilleAptitudesCliniques: aptitudes
        };
    }

    // Objet Final JSON 2.0
    return {
        id: getVal('case-id') || 'nouveau_cas',
        redacteur: getVal('case-redacteur') || 'Dr MedGame',
        specialty: getVal('case-specialty') || 'Cardiologie',
        difficulty: parseInt(getVal('case-difficulty') || '3'),
        itemR2C: getVal('case-item-r2c'),
        referentiel: getVal('case-referentiel'),
        patient: {
            nom: getVal('patient-nom'),
            prenom: getVal('patient-prenom'),
            age: parseInt(getVal('patient-age') || '50'),
            sexe: getVal('patient-sexe') || 'M',
            taille: getVal('patient-taille'),
            poids: getVal('patient-poids'),
            groupeSanguin: getVal('patient-groupe-sanguin'),
            model3D: getVal('patient-model3d') || undefined,
            persona: {
                ton: getVal('persona-ton'),
                registre: getVal('persona-registre'),
                loquacite: getVal('persona-loquacite'),
                anxiete: parseInt(getVal('persona-anxiete') || '50'),
                confiance: parseInt(getVal('persona-confiance') || '60'),
                style_parole: getVal('persona-style-parole'),
                exemples_phrases: getVal('persona-exemples-phrases').split('\n').map(s => s.trim()).filter(s => s)
            }
        },
        dialogue: {
            phraseOuverture: getVal('dialogue-phrase-ouverture')
        },
        interrogatoire: {
            motifHospitalisation: getVal('motif-admission-input'),
            modeDeVie: {
                tabac: { quantite: getVal('lifestyle-tabac') },
                alcool: { quantite: getVal('lifestyle-alcool') },
                activitePhysique: { description: getVal('lifestyle-activite') },
                alimentation: { regime: getVal('lifestyle-alimentation') },
                emploi: { profession: getVal('lifestyle-profession'), stress: getVal('lifestyle-stress') }
            },
            antecedents: {
                medicaux: collectRepeater('list-ant-med', ['.field-type', '.field-traitement'], ['type', 'traitement']),
                chirurgicaux: collectRepeater('list-ant-chir', ['.field-intervention', '.field-annee'], ['intervention', 'annee']),
                familiaux: collectRepeater('list-ant-fam', ['.field-antecedent', '.field-lien'], ['antecedent', 'lien'])
            },
            traitements: collectRepeater('list-traitements', ['.field-nom', '.field-dose', '.field-frequence'], ['nom', 'dose', 'frequence']),
            allergies: {
                presence: !!getVal('allergies-input'),
                liste: getVal('allergies-input') ? getVal('allergies-input').split(',').map(s => s.trim()).filter(s => s) : []
            },
            histoireMaladie: {
                debutSymptomes: getVal('hdm-debut'),
                evolution: getVal('hdm-evolution'),
                facteursDeclenchants: getVal('hdm-declenchants'),
                descriptionDouleur: getVal('hdm-douleur'),
                symptomesAssocies: getVal('hdm-symptomes-associes').split(',').map(s => s.trim()).filter(s => s),
                remarques: getVal('hdm-remarques')
            },
            verbatim: getVal('hdm-verbatim')
        },
        examenClinique: examenClinique,
        availableExams: availableExams,
        examResults: examResults,
        examGradation: {
            parfaits: parfaits,
            utiles: utiles,
            inutiles: inutiles,
            dangereux: dangereux
        },
        relevantExams: parfaits.length > 0 ? parfaits : availableExams.slice(0, 3),
        possibleDiagnostics: possibleDiagnostics,
        correctDiagnostic: correctDiagnostic,
        pieges: getVal('diag-pieges').split(',').map(s => s.trim()).filter(s => s),
        possibleTreatments: possibleTreatments,
        correctTreatments: correctTreatments,
        secondLineTreatments: secondLineTreatments,
        fatalTreatments: fatalTreatments,
        vitalsDynamics: document.getElementById('dyn-enable-vitals')?.checked ? {
            trendOverMinutes: parseFloat(getVal('dyn-trend') || '0.05'),
            urgencyMultiplier: parseFloat(getVal('dyn-multiplier') || '1.5'),
            stabilizeOnCorrectTreatment: getVal('dyn-stabilize') === 'true',
            aggravationTargets: {
                heartRate: parseInt(getVal('dyn-target-fc') || '120'),
                systolic: parseInt(getVal('dyn-target-tas') || '85'),
                spo2: parseInt(getVal('dyn-target-spo2') || '88'),
                respiratoryRate: parseInt(getVal('dyn-target-fr') || '28'),
                temperature: parseFloat(getVal('dyn-target-temp') || '39.0')
            }
        } : undefined,
        locks: locks,
        postGameQuestions: postGameQuestions,
        ecos: ecosData,
        correction: getVal('correction-markdown-input'),
        objectifs: getVal('case-objectifs-input').split('\n').map(s => s.trim()).filter(s => s),
        hints: getVal('case-hints-input').split('\n').map(s => s.trim()).filter(s => s)
    };
}

// ==================== 7. HELPERS GÉNÉRAUX ====================

function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined && val !== null ? val : '';
}

function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
}

function collectRepeater(containerId, fieldSelectors, keys) {
    const container = document.getElementById(containerId);
    if (!container) return [];

    const list = [];
    container.querySelectorAll('.repeater-row').forEach(row => {
        const item = {};
        let hasVal = false;
        keys.forEach((key, idx) => {
            const field = row.querySelector(fieldSelectors[idx]);
            const val = field ? field.value.trim() : '';
            item[key] = val;
            if (val) hasVal = true;
        });
        if (hasVal) list.push(item);
    });
    return list;
}

function getDefaultCaseTemplate() {
    return {
        id: "cardio_angor_stable_m_bennet",
        redacteur: "La TEAM",
        specialty: "Cardiologie",
        difficulty: 3,
        itemR2C: "Item 232. Douleur thoracique",
        referentiel: "SFC / ESC",
        patient: {
            nom: "Bennet",
            prenom: "Kitty",
            age: 58,
            sexe: "F",
            taille: "165 cm",
            poids: "70 kg",
            groupeSanguin: "B+",
            persona: {
                ton: "polie mais minimisante",
                registre: "courant",
                loquacite: "normal",
                style_parole: "décrit bien l'effort si on demande",
                exemples_phrases: ["Oh, c'est quand je monte les escaliers, ça serre..."],
                anxiete: 55,
                confiance: 65
            }
        },
        dialogue: {
            phraseOuverture: "Bonjour docteur, j'ai une gêne qui me serre la poitrine quand je monte les escaliers..."
        },
        interrogatoire: {
            motifHospitalisation: "Douleur thoracique à l'effort",
            histoireMaladie: {
                debutSymptomes: "6 mois",
                evolution: "Stable",
                facteursDeclenchants: "Montée d'escaliers",
                descriptionDouleur: "Rétrosternale constrictive, cède au repos en moins de 5 min",
                symptomesAssocies: ["Dyspnée légère d'effort"],
                remarques: "Soulagée immédiatement par la Trinitrine"
            },
            verbatim: "J'ai l'impression qu'on m'écrase la poitrine quand je force."
        },
        examenClinique: {
            constantes: { tension: "135/85 mmHg", pouls: "78 bpm", temperature: "36.7°C", saturationO2: "97%", frequenceRespiratoire: "18/min" },
            aspectGeneral: "Bon état général, patiente calme et orientée",
            examenCardiovasculaire: { auscultation: "B1 B2 réguliers, pas de souffle", inspection: "Pas d'OMI ni de turgescence jugulaire" },
            examenPulmonaire: { auscultation: "Murmure vésiculaire symétrique sans râle" }
        },
        availableExams: ["ECG", "Test d'effort", "Troponine", "Angiographie coronarienne", "Radio Thorax"],
        examResults: {
            "ECG": "Normal au repos, rythme sinusal",
            "Test d'effort": "Sous-décalage ST en V5-V6 à l'effort",
            "Troponine": "Normale (< 0.01 ng/mL)",
            "Angiographie coronarienne": "Sténose à 70% de la circonflexe",
            "Radio Thorax": "Index cardiothoracique normal, pas d'épanchement"
        },
        examGradation: {
            parfaits: ["ECG", "Test d'effort", "Angiographie coronarienne"],
            utiles: ["Troponine", "Radio Thorax"],
            inutiles: [],
            dangereux: []
        },
        correctDiagnostic: "Angor stable",
        possibleDiagnostics: ["Angor stable", "Syndrome coronarien aigu (SCA)", "Embolie pulmonaire", "Péricardite"],
        pieges: ["Un ECG de repos normal n'élimine jamais un angor stable"],
        correctTreatments: ["Bêta-bloquant", "Trinitrine sublinguale (crise)", "Aspirine"],
        secondLineTreatments: ["Statine", "Inhibiteur calcique"],
        fatalTreatments: ["Adrénaline"],
        correction: "# Angor Stable\n\n## Raisonnement Clinique\nDouleur thoracique typique constrictive d'effort...",
        objectifs: ["Reconnaître l'angor d'effort", "Indiquer le test d'ischémie", "Prescrire le traitement de fond BASIC"]
    };
}
