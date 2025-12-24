document.addEventListener('DOMContentLoaded', () => {
    // Navigation Logic
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.game-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(target).classList.add('active');
        });
    });

    // Load JSON handler
    document.getElementById('load-json').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                populateEditor(data);
            } catch (err) {
                alert('Erreur lors de la lecture du JSON : ' + err.message);
            }
        };
        reader.readAsText(file);
    });

    // Save JSON handler
    document.getElementById('save-json').addEventListener('click', () => {
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

    // Preview Case handler
    document.getElementById('preview-button').addEventListener('click', () => {
        const data = collectData();
        sessionStorage.setItem('previewCase', JSON.stringify(data));
        window.location.href = 'game.html?preview=true';
    });

    // Check for existing preview data on load (to persist edits)
    const existingPreview = sessionStorage.getItem('previewCase');
    if (existingPreview) {
        try {
            const data = JSON.parse(existingPreview);
            // Small delay to ensure DOM is ready for complex lists if needed, 
            // but populateEditor should be fast enough.
            populateEditor(data);
        } catch (e) {
            console.error("Error loading preview data", e);
        }
    }

    // Add Exam Section
    document.getElementById('add-exam-section').addEventListener('click', () => {
        const key = prompt('Nom de la section (ex: examenNeurologique, examenORL...)');
        if (key) {
            renderExamSection(key, { "Champ1": "Valeur1" });
        }
    });

    // Initial Empty State with realistic defaults
    // Constants
    setText('tension', '120/80');
    setText('pouls', '70');
    setText('temperature', '37');
    setText('saturationO2', '98');
    setText('frequenceRespiratoire', '16');
    setText('aspectGeneral', 'Bon état général, patient conscient et orienté.');

    // Physical Exam Sections
    renderExamSection('examenCardiovasculaire', { auscultation: "Bruits du cœur réguliers, pas de souffle.", inspection: "Pas de signe de choc, pas d'OMI.", palpation: "Pouls périphériques perçus." });
    renderExamSection('examenPulmonaire', { auscultation: "Murmure vésiculaire symétrique, pas de bruit surajouté.", inspection: "Pas de signe de lutte.", percussion: "Normal." });
    renderExamSection('examenAbdominal', { palpation: "Souple, indolore, pas de masse.", auscultation: "Bruits hydro-aériques normaux." });

    // Common Complementary Exams
    const defaultExams = ["NFS-Plaquettes", "Iono-Urée-Créat", "CRP", "ECG"];
    const defaultResults = {
        "NFS-Plaquettes": "Hb 14g/dL, Leuco 7000, Plaquettes 250 000",
        "Iono-Urée-Créat": "Na 140, K 4.0, Créat 80 µmol/L",
        "CRP": "< 5 mg/L",
        "ECG": "Rythme sinusal, pas de trouble de repolarisation"
    };
    renderExamResults(defaultExams, defaultResults);

    // Handle Image Upload logic (Moved to global scope)
    const imgInput = document.getElementById('image-upload');
    let currentTargetItem = null;

    window.triggerImageUpload = (btn) => {
        currentTargetItem = btn.parentElement;
        imgInput.click();
    };

    imgInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file || !currentTargetItem) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            updateItemImage(currentTargetItem, base64);
        };
        reader.readAsDataURL(file);
    };

    document.getElementById('add-lock-btn').addEventListener('click', () => {
        addLock({
            id: 'lock_' + Date.now(),
            type: 'SAISIE',
            target_fields: [],
            challenge: { question: 'Votre question ?', expected_keywords: [] },
            feedback_error: 'Erreur...'
        });
    });

    document.getElementById('add-post-game-question-btn').addEventListener('click', () => {
        addPostGameQuestion({
            type: 'SAISIE',
            challenge: { question: 'Question post-jeu ?', expected_keywords: [] },
            feedback_error: 'Revoyez vos bases...'
        });
    });

    // --- SIDEBAR TOGGLE ---
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const appContainer = document.querySelector('.app-container');

    if (sidebarToggle && appContainer) {
        // Restore sidebar state from sessionStorage
        const sidebarCollapsed = sessionStorage.getItem('editorSidebarCollapsed') === 'true';
        if (sidebarCollapsed) {
            appContainer.classList.add('sidebar-collapsed');
        }

        sidebarToggle.addEventListener('click', () => {
            appContainer.classList.toggle('sidebar-collapsed');
            const isCollapsed = appContainer.classList.contains('sidebar-collapsed');
            sessionStorage.setItem('editorSidebarCollapsed', isCollapsed);
        });
    }
});

function populateEditor(data) {
    if (!data) return;

    // ID & Redacteur
    setText('case-id', data.id);
    setText('redacteur', data.redacteur);

    // Patient
    if (data.patient) {
        setText('patient-nom-sidebar', data.patient.nom);
        setText('patient-age-sidebar', data.patient.age);
        setText('patient-sexe-sidebar', data.patient.sexe);
        setText('patient-taille', data.patient.taille);
        setText('patient-poids', data.patient.poids);
        setText('patient-groupeSanguin', data.patient.groupeSanguin);
        updateInitials();
    }

    // Interrogatoire
    if (data.interrogatoire) {
        setText('motif-hospitalisation', data.interrogatoire.motifHospitalisation);
        if (data.interrogatoire.modeDeVie) {
            setText('activite-physique', data.interrogatoire.modeDeVie.activitePhysique?.description);
            setText('tabac-quantite', data.interrogatoire.modeDeVie.tabac?.quantite);
            setText('tabac-duree', data.interrogatoire.modeDeVie.tabac?.duree);
            setText('alcool', data.interrogatoire.modeDeVie.alcool?.quantite);
            setText('alimentation-regime', data.interrogatoire.modeDeVie.alimentation?.regime);
            setText('alimentation-particularites', data.interrogatoire.modeDeVie.alimentation?.particularites);
            setText('emploi-profession', data.interrogatoire.modeDeVie.emploi?.profession);
            setText('emploi-stress', data.interrogatoire.modeDeVie.emploi?.stress);
        }

        // Complex Lists
        renderObjectList('antecedents-medicaux', data.interrogatoire.antecedents?.medicaux, ['type', 'traitement']);
        renderObjectList('traitements-liste', data.interrogatoire.traitements, ['nom', 'dose', 'frequence']);

        if (data.interrogatoire.histoireMaladie) {
            setText('debut-symptomes', data.interrogatoire.histoireMaladie.debutSymptomes);
            setText('evolution', data.interrogatoire.histoireMaladie.evolution);
            setText('facteurs-declenchants', data.interrogatoire.histoireMaladie.facteursDeclenchants);
            setText('description-douleur', data.interrogatoire.histoireMaladie.descriptionDouleur);
            setText('symptomes-associes', data.interrogatoire.histoireMaladie.symptomesAssocies?.join(', '));
            setText('remarques', data.interrogatoire.histoireMaladie.remarques);
        }
    }

    // Examen Clinique
    if (data.examenClinique) {
        if (data.examenClinique.constantes) {
            setText('tension', (data.examenClinique.constantes.tension || "").replace(" mmHg", ""));
            setText('pouls', (data.examenClinique.constantes.pouls || "").replace(" bpm", ""));
            setText('temperature', (data.examenClinique.constantes.temperature || "").replace("°C", "").replace(" °C", ""));
            setText('saturationO2', (data.examenClinique.constantes.saturationO2 || "").replace("%", ""));
            setText('frequenceRespiratoire', (data.examenClinique.constantes.frequenceRespiratoire || "").replace("/min", "").replace(" /min", ""));
        }
        setText('aspectGeneral', data.examenClinique.aspectGeneral);

        const list = document.getElementById('exam-details-list');
        list.innerHTML = '';
        const skip = ['constantes', 'aspectGeneral'];
        Object.keys(data.examenClinique).forEach(key => {
            if (!skip.includes(key)) {
                renderExamSection(key, data.examenClinique[key]);
            }
        });
    }

    // Locks
    renderLocksList(data.locks);

    // Post-Game Questions
    renderPostGameQuestionsList(data.postGameQuestions);

    // Exam Results & Available Exams
    renderExamResults(data.availableExams, data.examResults);

    // Synthesis
    renderTextList('possible-diagnostics', data.possibleDiagnostics);
    setText('correctDiagnostic', data.correctDiagnostic);
    renderTextList('possible-treatments', data.possibleTreatments);
    renderTextList('correct-treatments-list', data.correctTreatments);
    document.getElementById('correction-text').innerHTML = data.correction || '';

    // Correction Image
    const corrImgContainer = document.getElementById('correction-image-container');
    if (corrImgContainer) corrImgContainer.innerHTML = '';
    if (data.correctionImage && corrImgContainer) {
        updateItemImage(corrImgContainer, data.correctionImage);
    }
}

function updateItemImage(item, base64) {
    let preview = item.querySelector('.image-preview');
    if (!preview) {
        preview = document.createElement('div');
        preview.className = 'image-preview';
        const removeBtn = item.querySelector('.btn-remove');
        if (removeBtn) {
            item.insertBefore(preview, removeBtn);
        } else {
            item.appendChild(preview);
        }
    }
    preview.innerHTML = `
        <img src="${base64}" style="max-height: 150px; border-radius: 8px; border: 2px solid var(--glass-border); box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
        <button class="btn-remove-img" onclick="this.parentElement.remove()" style="background: rgba(255,0,0,0.2); border: none; color: white; cursor: pointer; padding: 5px 10px; border-radius: 5px; margin-left:10px;"><i class="fas fa-times"></i> Supprimer l'image</button>
    `;
    preview.dataset.base64 = base64;
}

function collectData() {
    // ...
    const data = {
        id: getText('case-id'),
        redacteur: getText('redacteur'),
        patient: {
            nom: getText('patient-nom-sidebar'),
            prenom: "", // Simplified
            age: parseInt(getText('patient-age-sidebar')),
            sexe: getText('patient-sexe-sidebar'),
            taille: getText('patient-taille'),
            poids: getText('patient-poids'),
            groupeSanguin: getText('patient-groupeSanguin')
        },
        interrogatoire: {
            motifHospitalisation: getText('motif-hospitalisation'),
            modeDeVie: {
                activitePhysique: { description: getText('activite-physique') },
                tabac: { quantite: getText('tabac-quantite'), duree: getText('tabac-duree') },
                alcool: { quantite: getText('alcool') },
                alimentation: { regime: getText('alimentation-regime'), particularites: getText('alimentation-particularites') },
                emploi: { profession: getText('emploi-profession'), stress: getText('emploi-stress') }
            },
            antecedents: {
                medicaux: collectObjectList('antecedents-medicaux', ['type', 'traitement']),
                chirurgicaux: [], // Simplified
                familiaux: [] // Simplified
            },
            traitements: collectObjectList('traitements-liste', ['nom', 'dose', 'frequence']),
            allergies: { presence: false, liste: [] },
            histoireMaladie: {
                debutSymptomes: getText('debut-symptomes'),
                evolution: getText('evolution'),
                facteursDeclenchants: getText('facteurs-declenchants'),
                descriptionDouleur: getText('description-douleur'),
                symptomesAssocies: getText('symptomes-associes').split(',').map(s => s.trim()).filter(s => s),
                remarques: getText('remarques')
            }
        },
        examenClinique: {
            constantes: {
                tension: getText('tension') + " mmHg",
                pouls: getText('pouls') + " bpm",
                temperature: getText('temperature') + "°C",
                saturationO2: getText('saturationO2') + "%",
                frequenceRespiratoire: getText('frequenceRespiratoire') + "/min"
            },
            aspectGeneral: getText('aspectGeneral')
        },
        availableExams: collectAvailableExams(),
        examResults: collectExamResults(),
        possibleDiagnostics: collectTextList('possible-diagnostics'),
        correctDiagnostic: getText('correctDiagnostic'),
        scoringRules: { baseScore: 100, attemptPenalty: 10 },
        possibleTreatments: collectTextList('possible-treatments'),
        correctTreatments: collectTextList('correct-treatments-list'),
        correction: document.getElementById('correction-text').innerHTML,
        correctionImage: document.querySelector('#correction-image-container .image-preview')?.dataset.base64 || null,
        feedback: { default: "Diagnostic incorrect." },
        locks: collectLocks(),
        postGameQuestions: collectPostGameQuestions()
    };

    // Collect dynamic exams
    const dynamicExams = document.querySelectorAll('.exam-item[data-key]');
    dynamicExams.forEach(item => {
        const key = item.getAttribute('data-key');
        const rows = item.querySelectorAll('li');
        const val = {};
        rows.forEach(row => {
            const k = row.querySelector('strong').textContent.replace(':', '').trim();
            const v = row.querySelector('span').textContent.trim();
            val[k.toLowerCase()] = v;
        });
        data.examenClinique[key] = val;
    });

    return data;
}

// Helpers
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || "";
}

function getText(id) {
    const el = document.getElementById(id);
    return el ? el.textContent.trim() : "";
}

function updateInitials() {
    const nom = getText('patient-nom-sidebar');
    if (!nom) return;
    const initials = nom.split(' ').map(n => n.charAt(0)).join('').toUpperCase() || '?';
    document.getElementById('patient-initials').textContent = initials;
}

function addListItem(containerId, template) {
    const container = document.getElementById(containerId);
    const item = document.createElement('div');
    item.className = 'editable-list-item';

    let html = '<div style="flex: 1;">';
    Object.keys(template).forEach(key => {
        html += `<span data-key="${key}" contenteditable="true" placeholder="${key}">${template[key]}</span> `;
    });
    html += '</div>';
    html += '<button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i> Supprimer</button>';

    item.innerHTML = html;
    container.appendChild(item);
}

function renderObjectList(containerId, list, keys) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    if (!list) return;
    list.forEach(itemData => {
        const item = document.createElement('div');
        item.className = 'editable-list-item';
        let html = '<div style="flex: 1;">';
        keys.forEach(k => {
            html += `<span data-key="${k}" contenteditable="true" placeholder="${k}">${itemData[k] || ''}</span> `;
        });
        html += '</div>';
        html += '<button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i> Supprimer</button>';
        item.innerHTML = html;
        container.appendChild(item);
    });
}

function collectObjectList(containerId, keys) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const items = container.querySelectorAll('.editable-list-item');
    return Array.from(items).map(item => {
        const obj = {};
        keys.forEach(k => {
            const el = item.querySelector(`[data-key="${k}"]`);
            obj[k] = el ? el.textContent.trim() : "";
        });
        return obj;
    });
}

function addListItemText(containerId) {
    const container = document.getElementById(containerId);
    const item = document.createElement('div');
    item.className = 'editable-list-item';
    item.innerHTML = `
        <span contenteditable="true" style="flex: 1;" placeholder="Texte...">...</span>
        <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i> Supprimer</button>
    `;
    container.appendChild(item);
}

function renderTextList(containerId, list) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    if (!list) return;
    list.forEach(txt => {
        const item = document.createElement('div');
        item.className = 'editable-list-item';
        item.innerHTML = `
            <span contenteditable="true" style="flex: 1;">${txt}</span>
            <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i> Supprimer</button>
        `;
        container.appendChild(item);
    });
}

function collectTextList(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    return Array.from(container.querySelectorAll('span')).map(s => s.textContent.trim());
}

function formatExamKey(key) {
    if (!key) return "";
    // If it already seems formatted (has spaces or starts with capital), return it
    if (key.includes(' ') || /^[A-Z]/.test(key)) return key;

    // Remove "examen" prefix if it exists
    let formatted = key.replace(/^examen/, '');
    // Add space before capitals
    formatted = formatted.replace(/([A-Z])/g, ' $1').trim();
    // Capitalize first letter
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function createBulletHtml(k, v) {
    return `<li>
        <strong contenteditable="true" placeholder="label">${k}</strong>: 
        <span contenteditable="true" placeholder="résultat">${v || ''}</span>
        <i class="fas fa-times remove-bullet" onclick="this.parentElement.remove()" title="Supprimer ce point"></i>
    </li>`;
}

window.addExamBullet = function (btn) {
    const ul = btn.closest('.exam-item').querySelector('ul');
    const li = document.createElement('li');
    li.innerHTML = `
        <strong contenteditable="true" placeholder="label">Nouveau</strong>: 
        <span contenteditable="true" placeholder="résultat">...</span>
        <i class="fas fa-times remove-bullet" onclick="this.parentElement.remove()" title="Supprimer ce point"></i>
    `;
    ul.appendChild(li);
    // Focus the new label
    li.querySelector('strong').focus();
};

function renderExamSection(key, data) {
    const list = document.getElementById('exam-details-list');
    const div = document.createElement('div');
    div.className = 'exam-item';
    div.setAttribute('data-key', key);

    const displayTitle = formatExamKey(key);

    let html = `<h4 contenteditable="true" placeholder="Nom de la section">${displayTitle}</h4><ul>`;
    if (data && typeof data === 'object') {
        Object.entries(data).forEach(([k, v]) => {
            html += createBulletHtml(k, v);
        });
    }
    html += '</ul>';
    html += `
        <div class="exam-actions" style="margin-top: 10px; display: flex; gap: 10px;">
            <button class="btn-add-bullet" onclick="addExamBullet(this)" style="background: rgba(0, 210, 255, 0.1); border: 1px solid rgba(0, 210, 255, 0.3); color: var(--editor-secondary); padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 0.8em;">
                <i class="fas fa-plus"></i> Ajouter un point
            </button>
        </div>
    `;
    html += '<button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i> Supprimer section</button>';

    div.innerHTML = html;
    list.appendChild(div);
}

function addExamResult() {
    const list = document.getElementById('available-exams-list');
    const div = document.createElement('div');
    div.className = 'editable-list-item';
    div.innerHTML = `
        <strong contenteditable="true" data-type="exam-name" placeholder="Nom Examen">Nouveau Examen</strong>: 
        <span contenteditable="true" data-type="exam-value" style="flex: 1; margin-left: 10px;" placeholder="Résultat...">Résultat...</span>
        <button class="btn-add" style="padding: 6px 10px; font-size: 12px;" onclick="triggerImageUpload(this)"><i class="fas fa-image"></i></button>
        <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i> Supprimer</button>
    `;
    list.appendChild(div);
}

function renderExamResults(available, results) {
    const list = document.getElementById('available-exams-list');
    list.innerHTML = '';
    if (!available) return;
    available.forEach(name => {
        const div = document.createElement('div');
        div.className = 'editable-list-item';

        const examData = results ? results[name] : null;
        const textValue = typeof examData === 'object' ? (examData.value || '') : (examData || '');
        const imageBase64 = typeof examData === 'object' ? (examData.image || null) : null;

        let html = `
            <strong contenteditable="true" data-type="exam-name">${name}</strong>: 
            <span contenteditable="true" data-type="exam-value" style="flex: 1; margin-left: 10px;">${textValue}</span>
        `;

        if (imageBase64) {
            html += `
                <div class="image-preview" data-base64="${imageBase64}">
                    <img src="${imageBase64}" style="height: 40px; border-radius: 4px; border: 1px solid var(--glass-border);">
                    <button class="btn-remove-img" onclick="this.parentElement.remove()" style="background: none; border: none; color: var(--editor-danger); cursor: pointer; padding: 0 5px;"><i class="fas fa-times"></i></button>
                </div>
            `;
        }

        html += `
            <button class="btn-add" style="padding: 6px 10px; font-size: 12px;" onclick="triggerImageUpload(this)"><i class="fas fa-image"></i></button>
            <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i> Supprimer</button>
        `;
        div.innerHTML = html;
        list.appendChild(div);
    });
}

function collectAvailableExams() {
    const items = document.querySelectorAll('#available-exams-list .editable-list-item');
    return Array.from(items).map(item => item.querySelector('[data-type="exam-name"]').textContent.trim());
}

function collectExamResults() {
    const items = document.querySelectorAll('#available-exams-list .editable-list-item');
    const results = {};
    items.forEach(item => {
        const nameEl = item.querySelector('[data-type="exam-name"]');
        const valueEl = item.querySelector('[data-type="exam-value"]');
        const imgEl = item.querySelector('.image-preview');
        if (nameEl && valueEl) {
            const name = nameEl.textContent.trim();
            const value = valueEl.textContent.trim();
            const image = imgEl ? imgEl.dataset.base64 : null;

            if (image) {
                results[name] = { value, image };
            } else {
                results[name] = value;
            }
        }
    });
    return results;
}

function getAvailableFields() {
    const fields = [];

    // Interrogatoire
    fields.push({ path: 'interrogatoire.histoireMaladie.debutSymptomes', label: 'Anamnèse: Début symptômes' });
    fields.push({ path: 'interrogatoire.histoireMaladie.evolution', label: 'Anamnèse: Évolution' });
    fields.push({ path: 'interrogatoire.histoireMaladie.facteursDeclenchants', label: 'Anamnèse: Facteurs déclenchants' });
    fields.push({ path: 'interrogatoire.histoireMaladie.descriptionDouleur', label: 'Anamnèse: Description douleur' });
    fields.push({ path: 'interrogatoire.histoireMaladie.symptomesAssocies', label: 'Anamnèse: Symptômes associés' });
    fields.push({ path: 'interrogatoire.histoireMaladie.remarques', label: 'Anamnèse: Histoire - Remarques' });

    fields.push({ path: 'interrogatoire.modeDeVie.activitePhysique.description', label: 'Mode de vie: Activité physique' });
    fields.push({ path: 'interrogatoire.modeDeVie.tabac', label: 'Mode de vie: Tabac' });
    fields.push({ path: 'interrogatoire.modeDeVie.alcool', label: 'Mode de vie: Alcool' });
    fields.push({ path: 'interrogatoire.modeDeVie.alimentation', label: 'Mode de vie: Alimentation' });
    fields.push({ path: 'interrogatoire.modeDeVie.emploi', label: 'Mode de vie: Emploi/Stress' });

    fields.push({ path: 'interrogatoire.antecedents.medicaux', label: 'Anamnèse: Antécédents' });
    fields.push({ path: 'interrogatoire.traitements', label: 'Anamnèse: Traitements habituels' });

    // Examen Clinique
    fields.push({ path: 'examenClinique.constantes.tension', label: 'Examen: Tension' });
    fields.push({ path: 'examenClinique.constantes.pouls', label: 'Examen: Pouls' });
    fields.push({ path: 'examenClinique.constantes.temperature', label: 'Examen: Température' });
    fields.push({ path: 'examenClinique.constantes.saturationO2', label: 'Examen: SpO2' });
    fields.push({ path: 'examenClinique.constantes.frequenceRespiratoire', label: 'Examen: FR' });
    fields.push({ path: 'examenClinique.aspectGeneral', label: 'Examen: Aspect général' });

    // Dynamic Examen Sections
    const dynamicExams = document.querySelectorAll('.exam-item[data-key]');
    dynamicExams.forEach(item => {
        const key = item.getAttribute('data-key');
        const title = item.querySelector('h4').textContent;
        fields.push({ path: `examenClinique.${key}`, label: `Examen: ${title}` });
    });

    // Exam Results (each exam can be locked)
    const examResults = document.querySelectorAll('#available-exams-list .editable-list-item');
    examResults.forEach(item => {
        const name = item.querySelector('[data-type="exam-name"]').textContent.trim();
        fields.push({ path: `examResults.${name}`, label: `Résultat: ${name}` });
    });

    // Whole sections
    fields.push({ path: 'examensComplementaires', label: 'Section: Examens Complémentaires' });

    return fields;
}

function addLock(lockData) {
    const container = document.getElementById('locks-list');
    const div = document.createElement('div');
    div.className = 'medical-card lock-card';
    div.style.marginBottom = '20px';
    div.style.position = 'relative';
    div.dataset.id = lockData.id;

    const type = lockData.type || 'SAISIE';
    const availableFields = getAvailableFields();

    div.innerHTML = `
        <button class="btn-remove" onclick="this.parentElement.remove()" style="position:absolute; top:10px; right:10px;">
            <i class="fas fa-trash"></i>
        </button>
        <div class="grid-layout" style="grid-template-columns: 1fr 1fr; gap:15px;">
            <div>
                <div class="lock-setting-item" style="display: none;">
                    <span class="lock-label">ID du verrou:</span>
                    <span class="lock-id" contenteditable="true">${lockData.id}</span>
                </div>
                <div class="lock-setting-item">
                    <span class="lock-label">Mode de réponse:</span>
                    <select class="lock-type modern-select">
                        <option value="SAISIE" ${type === 'SAISIE' ? 'selected' : ''}>Saisie de texte</option>
                        <option value="QCM" ${type === 'QCM' ? 'selected' : ''}>QCM (Choix multiple)</option>
                    </select>
                </div>
                
                <div class="lock-setting-item" style="flex-direction: column; align-items: flex-start;">
                    <span class="lock-label">Éléments à masquer:</span>
                    <div class="field-selector-container" style="width: 100%;">
                        <select class="field-picker modern-select" style="width: 100%; margin-bottom: 10px;">
                            <option value="">-- Sélectionner un champ --</option>
                            ${availableFields.map(f => `<option value="${f.path}">${f.label}</option>`).join('')}
                        </select>
                        <div class="selected-fields-tags">
                            <!-- Tags will be inserted here -->
                        </div>
                    </div>
                </div>
            </div>
            <div>
                <h4 class="label">Défi du verrou</h4>
                <p class="lock-label">Question à poser :</p>
                <div class="lock-question" contenteditable="true" placeholder="Ex: Quel examen demandez-vous ?" style="background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; margin-bottom:15px; border: 1px solid var(--glass-border);">
                    ${lockData.challenge.question}
                </div>
                <div class="lock-challenge-details">
                    <!-- Specific to type -->
                </div>
                <p class="lock-label" style="margin-top: 15px;">En cas d'erreur :</p>
                <div class="lock-error" contenteditable="true" placeholder="Message d'erreur..." style="background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; font-size:0.9em; border: 1px solid var(--glass-border);">
                    ${lockData.feedback_error || ''}
                </div>
            </div>
        </div>
    `;

    container.appendChild(div);

    const tagsContainer = div.querySelector('.selected-fields-tags');
    const fieldPicker = div.querySelector('.field-picker');

    const addTag = (path) => {
        if (!path) return;
        const existingTags = Array.from(tagsContainer.querySelectorAll('.field-tag')).map(t => t.dataset.path);
        if (existingTags.includes(path)) return;

        const field = availableFields.find(f => f.path === path) || { label: path, path: path };
        const tag = document.createElement('div');
        tag.className = 'field-tag';
        tag.dataset.path = path;
        tag.innerHTML = `
            <span>${field.label}</span>
            <i class="fas fa-times" onclick="this.parentElement.remove()"></i>
        `;
        tagsContainer.appendChild(tag);
    };

    // Initialize tags
    (lockData.target_fields || []).forEach(path => addTag(path));

    fieldPicker.addEventListener('change', (e) => {
        addTag(e.target.value);
        e.target.value = '';
    });

    const detailsContainer = div.querySelector('.lock-challenge-details');
    const typeSelect = div.querySelector('.lock-type');

    const updateDetails = () => {
        const currentType = typeSelect.value;
        if (currentType === 'SAISIE') {
            detailsContainer.innerHTML = `
                <p class="lock-label">Réponses acceptées (mots-clés séparés par virgule) :</p>
                <div class="lock-keywords" contenteditable="true" placeholder="ex: poumon, pleurésie" style="background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border: 1px solid var(--glass-border);">
                    ${(lockData.challenge.expected_keywords || []).join(', ')}
                </div>
            `;
        } else {
            const options = lockData.challenge.options || ['Option 1', 'Option 2'];
            const correctIndices = lockData.challenge.correct_indices || (lockData.challenge.correct_index !== undefined ? [lockData.challenge.correct_index] : [0]);

            let optionsHtml = options.map((opt, i) => `
                <div class="mcq-editor-option" style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                    <input type="checkbox" class="correct-checkbox" ${correctIndices.includes(i) ? 'checked' : ''}>
                    <span contenteditable="true" style="flex:1; background:rgba(255,255,255,0.05); padding:8px; border-radius:8px; border: 1px solid var(--glass-border);">${opt}</span>
                    <button class="btn-remove" onclick="this.parentElement.remove()" style="padding:5px 8px;"><i class="fas fa-times"></i></button>
                </div>
            `).join('');

            detailsContainer.innerHTML = `
                <p class="lock-label">Options QCM (cochez les bonnes réponses) :</p>
                <div class="mcq-options-list">${optionsHtml}</div>
                <button class="btn-add" onclick="addMcqOption(this)" style="padding:8px 12px; font-size:0.8em; margin-top:10px;"><i class="fas fa-plus"></i> Ajouter une option</button>
            `;
        }
    };

    typeSelect.addEventListener('change', updateDetails);
    updateDetails();
}

window.addMcqOption = (btn) => {
    const list = btn.previousElementSibling;
    const div = document.createElement('div');
    div.className = 'mcq-editor-option';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '10px';
    div.style.marginBottom = '8px';
    div.innerHTML = `
        <input type="checkbox" class="correct-checkbox">
        <span contenteditable="true" style="flex:1; background:rgba(255,255,255,0.05); padding:8px; border-radius:8px; border: 1px solid var(--glass-border);">Nouvelle option</span>
        <button class="btn-remove" onclick="this.parentElement.remove()" style="padding:5px 8px;"><i class="fas fa-times"></i></button>
    `;
    list.appendChild(div);
};

function renderLocksList(locks) {
    const container = document.getElementById('locks-list');
    container.innerHTML = '';
    if (!locks) return;
    locks.forEach(lock => addLock(lock));
}

function collectLocks() {
    const lockCards = document.querySelectorAll('#locks-list > .lock-card');
    return Array.from(lockCards).map(card => collectChallengeData(card));
}

function collectPostGameQuestions() {
    const cards = document.querySelectorAll('#post-game-questions-list > .post-game-card');
    return Array.from(cards).map(card => collectChallengeData(card));
}

function collectChallengeData(card) {
    const type = card.querySelector('.lock-type').value;
    const challenge = {
        question: card.querySelector('.lock-question').textContent.trim()
    };

    const data = {
        type: type,
        challenge: challenge,
        feedback_error: card.querySelector('.lock-error').textContent.trim()
    };

    // Only locks have IDs and target fields
    if (card.querySelector('.lock-id')) {
        data.id = card.querySelector('.lock-id').textContent.trim();
        data.target_fields = Array.from(card.querySelectorAll('.field-tag')).map(t => t.dataset.path);
    }

    if (type === 'SAISIE') {
        challenge.expected_keywords = card.querySelector('.lock-keywords').textContent.split(',').map(s => s.trim()).filter(s => s);
    } else {
        const optionsList = card.querySelectorAll('.mcq-editor-option');
        challenge.options = [];
        challenge.correct_indices = [];
        optionsList.forEach((optDiv, index) => {
            challenge.options.push(optDiv.querySelector('span').textContent.trim());
            if (optDiv.querySelector('.correct-checkbox').checked) {
                challenge.correct_indices.push(index);
            }
        });
    }
    return data;
}

function addPostGameQuestion(questionData) {
    const container = document.getElementById('post-game-questions-list');
    const div = document.createElement('div');
    div.className = 'medical-card post-game-card';
    div.style.marginBottom = '20px';
    div.style.position = 'relative';

    const type = questionData.type || 'SAISIE';

    div.innerHTML = `
        <button class="btn-remove" onclick="this.parentElement.remove()" style="position:absolute; top:10px; right:10px;">
            <i class="fas fa-trash"></i>
        </button>
        <div class="grid-layout" style="grid-template-columns: 1fr 1fr; gap:15px;">
            <div>
                <div class="lock-setting-item">
                    <span class="lock-label">Type de question:</span>
                    <select class="lock-type modern-select">
                        <option value="SAISIE" ${type === 'SAISIE' ? 'selected' : ''}>Saisie de texte (QROC)</option>
                        <option value="QCM" ${type === 'QCM' ? 'selected' : ''}>QCM</option>
                    </select>
                </div>
            </div>
            <div>
                <h4 class="label" style="color: var(--primary-color);">Question Quiz</h4>
                <p class="lock-label">Énoncé :</p>
                <div class="lock-question" contenteditable="true" style="background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; margin-bottom:15px; border: 1px solid var(--glass-border);">
                    ${questionData.challenge.question}
                </div>
                <div class="lock-challenge-details">
                    <!-- Specific to type -->
                </div>
                <p class="lock-label" style="margin-top: 15px;">Correction/Feedback si faux :</p>
                <div class="lock-error" contenteditable="true" style="background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; font-size:0.9em; border: 1px solid var(--glass-border);">
                    ${questionData.feedback_error || ''}
                </div>
            </div>
        </div>
    `;

    container.appendChild(div);

    const detailsContainer = div.querySelector('.lock-challenge-details');
    const typeSelect = div.querySelector('.lock-type');

    const updateDetails = () => {
        const currentType = typeSelect.value;
        if (currentType === 'SAISIE') {
            detailsContainer.innerHTML = `
                <p class="lock-label">Réponses acceptées (mots-clés) :</p>
                <div class="lock-keywords" contenteditable="true" style="background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border: 1px solid var(--glass-border);">
                    ${(questionData.challenge.expected_keywords || []).join(', ')}
                </div>
            `;
        } else {
            const options = questionData.challenge.options || ['Option 1', 'Option 2'];
            const correctIndices = questionData.challenge.correct_indices || [];

            let optionsHtml = options.map((opt, i) => `
                <div class="mcq-editor-option" style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                    <input type="checkbox" class="correct-checkbox" ${correctIndices.includes(i) ? 'checked' : ''}>
                    <span contenteditable="true" style="flex:1; background:rgba(255,255,255,0.05); padding:8px; border-radius:8px; border: 1px solid var(--glass-border);">${opt}</span>
                    <button class="btn-remove" onclick="this.parentElement.remove()" style="padding:5px 8px;"><i class="fas fa-times"></i></button>
                </div>
            `).join('');

            detailsContainer.innerHTML = `
                <p class="lock-label">Options :</p>
                <div class="mcq-options-list">${optionsHtml}</div>
                <button class="btn-add" onclick="addMcqOption(this)" style="padding:8px 12px; font-size:0.8em; margin-top:10px; color: var(--primary-color); border-color: rgba(160, 32, 240, 0.3);"><i class="fas fa-plus"></i> Option</button>
            `;
        }
    };

    typeSelect.addEventListener('change', updateDetails);
    updateDetails();
}

function renderPostGameQuestionsList(questions) {
    const container = document.getElementById('post-game-questions-list');
    container.innerHTML = '';
    if (!questions) return;
    questions.forEach(q => addPostGameQuestion(q));
}
