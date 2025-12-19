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

    // Add Exam Section
    document.getElementById('add-exam-section').addEventListener('click', () => {
        const key = prompt('Nom de la section (ex: examenNeurologique, examenORL...)');
        if (key) {
            renderExamSection(key, { "Champ1": "Valeur1" });
        }
    });

    // Initial Empty State
    renderExamSection('examenCardiovasculaire', { auscultation: "", inspection: "", palpation: "" });
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

function collectData() {
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
    const initials = nom.split(' ').map(n => n.charAt(0)).join('').toUpperCase() || '?';
    document.getElementById('patient-initials').textContent = initials;
}

function addListItem(containerId, template) {
    const container = document.getElementById(containerId);
    const item = document.createElement('div');
    item.className = 'editable-list-item';

    let html = '<div style="flex: 1;">';
    Object.keys(template).forEach(key => {
        html += `<span data-key="${key}" contenteditable="true">${template[key]}</span> `;
    });
    html += '</div>';
    html += '<button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>';

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
            html += `<span data-key="${k}" contenteditable="true">${itemData[k] || ''}</span> `;
        });
        html += '</div>';
        html += '<button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>';
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
            obj[k] = item.querySelector(`[data-key="${k}"]`).textContent.trim();
        });
        return obj;
    });
}

function addListItemText(containerId) {
    const container = document.getElementById(containerId);
    const item = document.createElement('div');
    item.className = 'editable-list-item';
    item.innerHTML = `
        <span contenteditable="true" style="flex: 1;">Nouveau...</span>
        <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
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
            <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
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

    let html = `<h4 contenteditable="true">${key}</h4><ul>`;
    Object.entries(data).forEach(([k, v]) => {
        html += `<li><strong>${k}</strong>: <span contenteditable="true">${v}</span></li>`;
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
        <strong contenteditable="true" data-type="exam-name">Nom Examen</strong>: 
        <span contenteditable="true" data-type="exam-value" style="flex: 1; margin-left: 10px;">Résultat...</span>
        <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
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
        div.innerHTML = `
            <strong contenteditable="true" data-type="exam-name">${name}</strong>: 
            <span contenteditable="true" data-type="exam-value" style="flex: 1; margin-left: 10px;">${results ? (results[name] || '') : ''}</span>
            <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
        `;
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
        const name = item.querySelector('[data-type="exam-name"]').textContent.trim();
        const value = item.querySelector('[data-type="exam-value"]').textContent.trim();
        results[name] = value;
    });
    return results;
}
