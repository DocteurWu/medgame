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
            // Réinitialiser les overrides de contre-indications du cas précédent
            if (window.scoringState) {
                delete window.scoringState._fatalOverrideTreatments;
            }
            this.syncScoring();
            this.renderList();
            this.renderResults('');
        }

        open() {
            const modal = document.getElementById('prescription-modal');
            if (!modal) return;
            // Nettoyer toute modale de contre-indication orpheline
            const ciModal = document.getElementById('contre-indication-modal');
            if (ciModal) ciModal.remove();
            modal.classList.add('active');
            modal.style.display = 'flex';
            modal.setAttribute('aria-hidden', 'false');
            const input = document.getElementById('drug-search');
            if (input) input.focus();
            this.renderResults(input?.value || '');
        }

        close() {
            const modal = document.getElementById('prescription-modal');
            if (!modal) return;
            modal.classList.remove('active');
            modal.style.display = 'none';
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
                // Pass a callback to clear the form only after successful prescription
                this.addPrescription({
                    nom: drug.nom,
                    classe: drug.classe,
                    dosage: dosage.value,
                    voie: voie.value,
                    frequence: root.querySelector('#rx-frequency').value,
                    duree: root.querySelector('#rx-duration').value,
                    contreIndications: drug.contreIndications || []
                }, () => { root.innerHTML = ''; });
            });
        }

        /**
         * Vérifie les contre-indications d'un médicament contre le profil patient.
         * Retourne un tableau de contre-indications actives (vides si tout va bien).
         * @param {string[]} contreIndications - Liste des contre-indications du médicament
         * @returns {{ matched: string[], patientContext: string[] }}
         */
        checkContreIndications(contreIndications) {
            if (!contreIndications || contreIndications.length === 0) {
                return { matched: [], patientContext: [] };
            }

            const currentCase = window.scoringState?.currentCase || this.caseData;
            if (!currentCase) return { matched: [], patientContext: [] };

            const matched = [];
            const patientContext = [];

            // Normaliser les valeurs du patient pour la comparaison
            const patientAntecedents = currentCase.interrogatoire?.antecedents || {};
            const patientAllergies = currentCase.interrogatoire?.allergies || {};
            const patientTraitements = currentCase.interrogatoire?.traitements || [];
            const constantes = currentCase.examenClinique?.constantes || {};
            const remarques = (currentCase.interrogatoire?.histoireMaladie?.remarques || '').toLowerCase();

            // --- 1. Vérifier les allergies ---
            if (patientAllergies.presence && patientAllergies.liste) {
                for (const allergie of patientAllergies.liste) {
                    const allergene = (allergie.allergene || '').toLowerCase();
                    if (!allergene) continue;
                    for (const ci of contreIndications) {
                        const ciNorm = ci.toLowerCase();
                        if (matched.includes(ci)) continue;
                        // Correspondance : la CI mentionne l'allergène du patient
                        if (allergene.length > 1 && ciNorm.includes(allergene)) {
                            matched.push(ci);
                            patientContext.push(`Allergie : ${allergie.allergene} (${allergie.reaction || 'inconnue'})`);
                        }
                    }
                }
            }

            // --- 2. Vérifier les antécédents médicaux ---
            const medicaux = patientAntecedents.medicaux || [];
            for (const ant of medicaux) {
                const typeStr = (ant.type || '').toLowerCase();
                if (!typeStr) continue;
                for (const ci of contreIndications) {
                    if (matched.includes(ci)) continue;
                    const ciNorm = ci.toLowerCase();
                    // L'antécédent contient un mot-clé correspondant à la CI (ou l'inverse)
                    if (ciNorm.includes(typeStr) || typeStr.includes(ciNorm)) {
                        matched.push(ci);
                        patientContext.push(`Antécédent : ${ant.type} (${ant.traitement || 'non traité'})`);
                    }
                    // Vérification du traitement en cours de l'antécédent
                    if (!matched.includes(ci) && ant.traitement && ciNorm.includes(typeStr.split(' ')[0])) {
                        const traitLow = ant.traitement.toLowerCase();
                        if (ciNorm.includes(traitLow)) {
                            matched.push(ci);
                            patientContext.push(`Antécédent traité : ${ant.type} avec ${ant.traitement}`);
                        }
                    }
                }
            }

            // --- 3. Vérifier les traitements en cours (interactions médicamenteuses) ---
            for (const trait of patientTraitements) {
                const nomTrait = (trait.nom || '').toLowerCase();
                if (!nomTrait) continue;
                for (const ci of contreIndications) {
                    if (matched.includes(ci)) continue;
                    const ciNorm = ci.toLowerCase();
                    // Si la CI mentionne une interaction avec le traitement en cours
                    if (ciNorm.includes(nomTrait)) {
                        matched.push(ci);
                        patientContext.push(`Interaction avec traitement en cours : ${trait.nom} ${trait.dose || ''}`);
                    }
                }
            }

            // --- 4. Vérifier les constantes vitales pathologiques ---
            const frResp = parseInt(constantes.frequenceRespiratoire) || 0;
            if (frResp > 0 && (frResp < 10 || frResp > 25)) {
                for (const ci of contreIndications) {
                    if (matched.includes(ci)) continue;
                    const ciNorm = ci.toLowerCase();
                    if (ciNorm.includes('respiratoire') || ciNorm.includes('respiratoir')) {
                        matched.push(ci);
                        patientContext.push(`FR pathologique : ${frResp}/min`);
                    }
                }
            }

            // --- 5. Mots-clés dans les remarques de l'histoire de la maladie ---
            // Mots vides français à ignorer pour éviter les faux positifs
            const STOP_WORDS = new Set(['avec', 'pour', 'dans', 'plus', 'aussi', 'très', 'bien', 'elle', 'aussi', 'encore', 'autre', 'avant', 'après', 'entre', 'sous', 'sans', 'comme', 'mais', 'dont']);
            for (const ci of contreIndications) {
                if (matched.includes(ci)) continue;
                const ciNorm = ci.toLowerCase();
                for (const mot of ciNorm.split(/[\s,]+/)) {
                    if (mot.length > 4 && !STOP_WORDS.has(mot) && remarques.includes(mot)) {
                        matched.push(ci);
                        patientContext.push(`Remarque clinique : "${ci}"`);
                        break; // Un seul match suffit par CI
                    }
                }
            }

            return { matched, patientContext };
        }

        /**
         * Affiche une modale d'avertissement pour les contre-indications.
         * @param {string} drugName - Nom du médicament
         * @param {string[]} matched - Contre-indications détectées
         * @param {string[]} patientContext - Contexte patient correspondant
         * @param {function} onConfirm - Callback si le joueur passe outre
         */
        showContreIndicationAlert(drugName, matched, patientContext, onConfirm) {
            const modalOverlay = document.createElement('div');
            modalOverlay.className = 'correction-overlay';
            modalOverlay.style.display = 'flex';
            modalOverlay.id = 'contre-indication-modal';
            modalOverlay.style.zIndex = '2100';

            modalOverlay.innerHTML = `
                <div style="background: linear-gradient(145deg, rgba(231,76,60,0.12), rgba(231,76,60,0.04)); border: 2px solid #e74c3c; border-radius: 14px; padding: 24px; max-width: 520px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
                    <div style="text-align: center; margin-bottom: 16px;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 2.5rem; color: #e74c3c; text-shadow: 0 0 20px rgba(231,76,60,0.4);"></i>
                    </div>
                    <h3 style="color: #e74c3c; margin: 0 0 8px; text-align: center; font-size: 1.2rem;">
                        ⚠️ CONTRE-INDICATION DÉTECTÉE
                    </h3>
                    <p style="color: rgba(255,255,255,0.8); text-align: center; margin: 0 0 16px; font-size: 0.95rem;">
                        <strong>${escapeHtml(drugName)}</strong> présente des contre-indications pour ce patient :
                    </p>
                    <div style="background: rgba(231,76,60,0.08); border-radius: 10px; padding: 14px; margin-bottom: 16px;">
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            ${matched.map(ci => `
                                <li style="padding: 6px 0; border-bottom: 1px solid rgba(231,76,60,0.15); display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-times-circle" style="color: #e74c3c; font-size: 0.8rem;"></i>
                                    <span style="color: rgba(255,255,255,0.9); font-size: 0.9rem;">${escapeHtml(ci)}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                    ${patientContext.length > 0 ? `
                    <div style="background: rgba(0,0,0,0.15); border-radius: 8px; padding: 10px; margin-bottom: 16px;">
                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5); margin-bottom: 4px;">CONTEXTE PATIENT</div>
                        ${patientContext.map(ctx => `
                            <div style="font-size: 0.8rem; color: rgba(255,255,255,0.7); padding: 2px 0;">
                                <i class="fas fa-user" style="color: #3498db; font-size: 0.7rem; margin-right: 6px;"></i>
                                ${escapeHtml(ctx)}
                            </div>
                        `).join('')}
                    </div>` : ''}
                    <p style="color: rgba(255,255,255,0.6); font-size: 0.8rem; text-align: center; margin-bottom: 16px;">
                        Prescrire un traitement contre-indiqué annulera votre score de traitement.<br>
                        <span style="color: #e74c3c;">En cas de doute, consultez le RCP du médicament.</span>
                    </p>
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button id="ci-cancel" style="flex:1; padding: 10px 16px; background: rgba(255,255,255,0.08); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.9rem;">
                            <i class="fas fa-undo"></i> Annuler
                        </button>
                        <button id="ci-override" style="flex:1; padding: 10px 16px; background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 0.9rem;">
                            <i class="fas fa-skull-crossbones"></i> Prescrire malgré tout
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modalOverlay);

            // Annuler
            document.getElementById('ci-cancel').addEventListener('click', () => {
                modalOverlay.remove();
            });

            // Prescrire malgré tout
            document.getElementById('ci-override').addEventListener('click', () => {
                modalOverlay.remove();
                if (typeof onConfirm === 'function') onConfirm();

                // Marquer cette prescription comme dangereuse dans le scoring
                if (window.scoringState && drugName) {
                    if (!window.scoringState._fatalOverrideTreatments) {
                        window.scoringState._fatalOverrideTreatments = [];
                    }
                    // Éviter les doublons si le même médicament est prescrit à nouveau
                    if (!window.scoringState._fatalOverrideTreatments.includes(drugName)) {
                        window.scoringState._fatalOverrideTreatments.push(drugName);
                    }
                }

                // Feedback timeline
                if (typeof feedbackTimeline !== 'undefined') {
                    feedbackTimeline.log('traitement', `⚠️ CONTRE-INDICATION OUTREPASSÉE : ${drugName} — ${matched.join(', ')}`);
                }

                // Notification au joueur
                if (typeof showNotification === 'function') {
                    showNotification(`⚠️ ${drugName} prescrit malgré les contre-indications !`);
                }
            });
        }

        addPrescription(prescription, onSuccess) {
            // --- Vérification des contre-indications avant d'ajouter ---
            const { matched, patientContext } = this.checkContreIndications(prescription.contreIndications || []);

            const doAdd = () => {
                this.prescriptions.push({ ...prescription, id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()) });
                this.syncScoring();
                this.renderList();

                // Feedback timeline
                if (typeof feedbackTimeline !== 'undefined') {
                    feedbackTimeline.log('traitement', `Prescription : ${prescription.nom} ${prescription.dosage} ${prescription.voie}`);
                }

                // Callback : nettoyer le formulaire uniquement après ajout effectif
                if (typeof onSuccess === 'function') onSuccess();
            };

            if (matched.length > 0) {
                // Afficher l'alerte avec confirmation
                this.showContreIndicationAlert(prescription.nom, matched, patientContext, doAdd);
            } else {
                doAdd();
            }
        }

        addInfusion() {
            this.addPrescription({
                nom: 'Perfusion NaCl 0,9%',
                classe: 'Soluté',
                dosage: '500 mL',
                voie: 'IV',
                frequence: 'débit 100 mL/h',
                duree: '5 h',
                contreIndications: []
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
