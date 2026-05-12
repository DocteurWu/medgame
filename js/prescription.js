(function () {
    class PrescriptionManager {
        constructor() {
            this.caseData = null;
            this.drugs = [];
            this.prescriptions = [];
        }

        async init() {
            try {
                const response = await fetch('data/drugs.json');
                this.drugs = await response.json();
            } catch {
                this.drugs = [];
            }
            this.bind();
        }

        bind() {
            const search = document.getElementById('drug-search');
            if (search) search.addEventListener('input', () => this.renderResults(search.value));
            const infusion = document.getElementById('add-infusion');
            if (infusion) infusion.addEventListener('click', () => this.addInfusion());
            document.querySelectorAll('[data-close-panel="prescription-modal"]').forEach((button) => {
                button.addEventListener('click', () => this.close());
            });
        }

        setCase(caseData) {
            this.caseData = caseData;
            this.prescriptions = [];
            this.syncScoring();
            this.renderList();
            this.renderResults('');
        }

        open() {
            const modal = document.getElementById('prescription-modal');
            if (!modal) return;
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
            const input = document.getElementById('drug-search');
            if (input) input.focus();
            this.renderResults(input?.value || '');
        }

        close() {
            const modal = document.getElementById('prescription-modal');
            if (!modal) return;
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
        }

    renderResults(query) {
        const root = document.getElementById('drug-results');
        if (!root) return;
        const q = normalizeText(query || '');
        const terms = q.split(/\s+/).filter(Boolean);
        const results = this.drugs
            .filter((drug) => {
                if (!q) return true;
                const haystack = normalizeText(`${drug.nom} ${drug.classe || ''} ${(drug.alias || []).join(' ')}`);
                return terms.every(term => haystack.includes(term));
            })
            .slice(0, 8);
        root.innerHTML = results.map((drug, idx) => `
            <button type="button" class="drug-result" data-drug-index="${idx}">
                <strong>${escapeHtml(drug.nom)}</strong>
                <span>${escapeHtml(drug.classe || '')}</span>
            </button>
        `).join('');
        root.querySelectorAll('[data-drug-index]').forEach((button) => {
            button.addEventListener('click', () => this.configureDrug(results[Number(button.dataset.drugIndex)]));
        });
    }

        configureDrug(drug) {
            const root = document.getElementById('prescription-config');
            if (!root || !drug) return;
            const forms = drug.formes || [];
            const first = forms[0] || { dosage: '', voies: ['PO'] };
            root.innerHTML = `
                <div class="prescription-form">
                    <strong>${escapeHtml(drug.nom)}</strong>
                    <label>Dosage
                        <select id="rx-dosage">${forms.map((f) => `<option>${escapeHtml(f.dosage)}</option>`).join('')}</select>
                    </label>
                    <label>Voie
                        <select id="rx-voie">${(first.voies || ['PO']).map((v) => `<option>${escapeHtml(v)}</option>`).join('')}</select>
                    </label>
                    <label>Fréquence <input id="rx-frequency" value="1 fois" type="text"></label>
                    <label>Durée <input id="rx-duration" value="1 jour" type="text"></label>
                    <button type="button" id="rx-add"><i class="fas fa-plus"></i> Ajouter</button>
                </div>
            `;
            const dosage = root.querySelector('#rx-dosage');
            const voie = root.querySelector('#rx-voie');
            dosage.addEventListener('change', () => {
                const form = forms.find((f) => f.dosage === dosage.value) || first;
                voie.innerHTML = (form.voies || ['PO']).map((v) => `<option>${escapeHtml(v)}</option>`).join('');
            });
            root.querySelector('#rx-add').addEventListener('click', () => {
                this.addPrescription({
                    nom: drug.nom,
                    classe: drug.classe,
                    dosage: dosage.value,
                    voie: voie.value,
                    frequence: root.querySelector('#rx-frequency').value,
                    duree: root.querySelector('#rx-duration').value
                });
                root.innerHTML = '';
            });
        }

        addPrescription(prescription) {
            this.prescriptions.push({ ...prescription, id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()) });
            this.syncScoring();
            this.renderList();
        }

        addInfusion() {
            this.addPrescription({
                nom: 'Perfusion NaCl 0,9%',
                classe: 'Soluté',
                dosage: '500 mL',
                voie: 'IV',
                frequence: 'débit 100 mL/h',
                duree: '5 h'
            });
        }

        remove(id) {
            this.prescriptions = this.prescriptions.filter((p) => p.id !== id);
            this.syncScoring();
            this.renderList();
        }

        renderList() {
            const root = document.getElementById('prescription-list');
            if (!root) return;
            if (this.prescriptions.length === 0) {
                root.innerHTML = '<p class="muted">Aucune prescription.</p>';
                return;
            }
            root.innerHTML = this.prescriptions.map((p) => `
                <div class="prescription-item">
                    <span><strong>${escapeHtml(p.nom)}</strong> ${escapeHtml(p.dosage)} ${escapeHtml(p.voie)} · ${escapeHtml(p.frequence)} · ${escapeHtml(p.duree)}</span>
                    <button type="button" data-remove-rx="${escapeHtml(p.id)}" aria-label="Supprimer"><i class="fas fa-trash"></i></button>
                </div>
            `).join('');
            root.querySelectorAll('[data-remove-rx]').forEach((button) => {
                button.addEventListener('click', () => this.remove(button.dataset.removeRx));
            });
        }

        syncScoring() {
            if (!window.scoringState) return;
            window.scoringState.prescriptions = [...this.prescriptions];
            window.scoringState.selectedTreatments = this.prescriptions.map((p) => p.nom);
        }
    }

    window.prescriptionManager = new PrescriptionManager();
    document.addEventListener('DOMContentLoaded', () => window.prescriptionManager.init());
})();

