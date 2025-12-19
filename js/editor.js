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

    // Exam Results & Available Exams
    renderExamResults(data.availableExams, data.examResults);

    // Synthesis
    renderTextList('possible-diagnostics', data.possibleDiagnostics);
    setText('correctDiagnostic', data.correctDiagnostic);
    renderTextList('possible-treatments', data.possibleTreatments);
    renderTextList('correct-treatments-list', data.correctTreatments);
    document.getElementById('correction-text').innerHTML = data.correction || '';
}

function updateItemImage(item, base64) {
    let preview = item.querySelector('.image-preview');
    if (!preview) {
        preview = document.createElement('div');
        preview.className = 'image-preview';
        item.insertBefore(preview, item.querySelector('.btn-remove'));
    }
    preview.innerHTML = `
        <img src="${base64}" style="height: 40px; border-radius: 4px; border: 1px solid var(--glass-border);">
        <button class="btn-remove-img" onclick="this.parentElement.remove()" style="background: none; border: none; color: var(--editor-danger); cursor: pointer; padding: 0 5px;"><i class="fas fa-times"></i></button>
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
        feedback: { default: "Diagnostic incorrect." }
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

function renderExamSection(key, data) {
    const list = document.getElementById('exam-details-list');
    const div = document.createElement('div');
    div.className = 'exam-item';
    div.setAttribute('data-key', key);

    let html = `<h4 contenteditable="true" placeholder="Nom de la section (ex: examenNeurologique)">${key}</h4><ul>`;
    Object.entries(data).forEach(([k, v]) => {
        html += `<li><strong contenteditable="true" placeholder="label">${k}</strong>: <span contenteditable="true" placeholder="résultat">${v}</span></li>`;
    });
    html += '</ul>';
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
