// Y'a qql qui va lire le code ?? si oui veuillez me contacter sur discord : docteur_wu

document.addEventListener('DOMContentLoaded', async () => {
    const motifHospitalisation = document.getElementById('motif-hospitalisation');
    const activitePhysique = document.getElementById('activite-physique');
    const tabac = document.getElementById('tabac');
    const alcool = document.getElementById('alcool');
    const alimentation = document.getElementById('alimentation');
    const emploi = document.getElementById('emploi');
    const antecedentsMedicaux = document.getElementById('antecedents-medicaux');
    const antecedentsChirurgicaux = document.getElementById('antecedents-chirurgicaux');
    const antecedentsFamiliaux = document.getElementById('antecedents-familiaux');
    const traitementsListe = document.getElementById('traitements-liste');
    const allergiesListe = document.getElementById('allergies-liste');
    const debutSymptomes = document.getElementById('debut-symptomes');
    const evolution = document.getElementById('evolution');
    const facteursDeclenchants = document.getElementById('facteurs-declenchants');
    const symptomesAssocies = document.getElementById('symptomes-associes');
    const remarques = document.getElementById('remarques');
    const tension = document.getElementById('tension');
    const pouls = document.getElementById('pouls');
    const temperature = document.getElementById('temperature');
    const saturationO2 = document.getElementById('saturationO2');
    const frequenceRespiratoire = document.getElementById('frequenceRespiratoire');
    const aspectGeneral = document.getElementById('aspectGeneral');
    const examenCardiovasculaire = document.getElementById('examenCardiovasculaire');
    const examenPulmonaire = document.getElementById('examenPulmonaire');
    const examenAbdominal = document.getElementById('examenAbdominal');
    const examenNeurologique = document.getElementById('examenNeurologique');
    const examensResults = document.getElementById('examens-results');
    console.log('examensResults défini au début :', examensResults);
    const validateExamsButton = document.getElementById('validate-exams');
    const validateDiagnosticButton = document.getElementById('validate-diagnostic');
    const scoreDisplay = document.getElementById('score');
    const feedbackDisplay = document.getElementById('feedback');
    const nextCaseButton = document.getElementById('next-case');

    let cases = [];
    let currentCaseIndex = 0;
    let currentCase = null;
    let score = 0;
    let selectedTreatments = [];
    let attempts = 0;
    let timeLeft = getTimeLimit();
    let timerInterval;
    let fireworksInstance = null;
    let backgroundMusicEl = null;
    let vitalMonitorInstance = null;

    function getTimeLimit() {
        const v = sessionStorage.getItem('timeLimitSeconds');
        const n = v ? parseInt(v, 10) : 240;
        return isNaN(n) ? 240 : n;
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function renderCorrectionContent(text) {
        const contentEl = document.getElementById('correction-content');
        if (!text) {
            contentEl.innerHTML = '';
            return;
        }
        if (/<[a-z][\s\S]*>/i.test(text)) {
            contentEl.innerHTML = text;
            return;
        }
        const lines = text.split('\n');
        let html = '';
        let inList = false;
        for (let line of lines) {
            const t = line.trim();
            if (t.startsWith('- ')) {
                if (!inList) {
                    html += '<ul>';
                    inList = true;
                }
                html += '<li>' + escapeHtml(t.slice(2)) + '</li>';
            } else {
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }
                if (t === '') {
                    html += '<br>';
                } else {
                    html += '<p>' + escapeHtml(t) + '</p>';
                }
            }
        }
        if (inList) html += '</ul>';
        contentEl.innerHTML = html;
    }

    function renderCaseSummary(c) {
        if (!c) return '';
        const patient = `<h4>Patient</h4><p>${escapeHtml(c.patient.nom)} ${escapeHtml(c.patient.prenom)} · ${escapeHtml(String(c.patient.age))} ans · ${escapeHtml(c.patient.sexe)}</p>`;
        const motif = `<p><strong>Motif:</strong> ${escapeHtml(c.interrogatoire.motifHospitalisation || '')}</p>`;
        const constantes = `<h4>Constantes</h4><p>Tension: ${escapeHtml(c.examenClinique.constantes.tension || '')} · Pouls: ${escapeHtml(c.examenClinique.constantes.pouls || '')} · Température: ${escapeHtml(c.examenClinique.constantes.temperature || '')} · SpO2: ${escapeHtml(c.examenClinique.constantes.saturationO2 || '')} · FR: ${escapeHtml(c.examenClinique.constantes.frequenceRespiratoire || '')}</p>`;
        const exams = c.examResults ? Object.keys(c.examResults).map(k => `<div><strong>${escapeHtml(k)}:</strong> ${escapeHtml(typeof c.examResults[k] === 'string' ? c.examResults[k] : JSON.stringify(c.examResults[k]))}</div>`).join('') : '';
        const examsBlock = exams ? `<h4>Résultats d'examens</h4>${exams}` : '';
        return patient + motif + constantes + examsBlock;
    }

    function showCorrectionModal(text) {
        renderCorrectionContent(text || '');
        const overlay = document.getElementById('correction-overlay');
        overlay.style.display = 'flex';
    }

    function hideCorrectionModal() {
        const overlay = document.getElementById('correction-overlay');
        overlay.style.display = 'none';
    }

    document.getElementById('correction-back').addEventListener('click', () => {
        hideCorrectionModal();
    });

    document.getElementById('toggle-case-review').addEventListener('click', () => {
        const panel = document.getElementById('case-review');
        if (panel.style.display === 'none' || panel.style.display === '') {
            panel.style.display = 'block';
            panel.innerHTML = renderCaseSummary(currentCase);
        } else {
            panel.style.display = 'none';
        }
    });

    document.getElementById('correction-next').addEventListener('click', () => {
        if (fireworksInstance) fireworksInstance.stop();
        if (backgroundMusicEl) backgroundMusicEl.play();
        hideCorrectionModal();
        loadCase();
    });

    function displayTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        document.getElementById('timer').textContent = `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }

    function updateTimer() {
        if (timeLeft > 0) {
            timeLeft--;
            displayTime(timeLeft);
        } else {
            clearInterval(timerInterval);
            alert('Temps écoulé !');
            const playedCases = getCookie('playedCases');
            let arr = playedCases ? playedCases.split(',') : [];
            if (!arr.includes(currentCase.id)) {
                arr.push(currentCase.id);
                setCookie('playedCases', arr.join(','), 365);
            }
            const defaultText = currentCase && currentCase.correctDiagnostic ? `Diagnostic optimal: ${currentCase.correctDiagnostic}\nTraitements optimaux: ${(currentCase.correctTreatments || []).join(', ')}` : '';
            showCorrectionModal(currentCase && currentCase.correction ? currentCase.correction : defaultText);
        }
    }

    // Cookie management functions
    function setCookie(name, value, days) {
        let expires = "";
        if (days) {
            let date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + expires + "; path=/";
    }

    function getCookie(name) {
        let nameEQ = name + "=";
        let ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    function eraseCookie(name) {
        document.cookie = name + '=; path=/; Max-Age=-99999999;';
    }



    async function loadCasesData() {
        try {
            // Récupérer les thèmes sélectionnés depuis localStorage
            const selectedThemes = JSON.parse(localStorage.getItem('selectedThemes')) || [];
            if (selectedThemes.length === 0) {
                throw new Error('Aucun thème sélectionné');
            }
    
            // Charger l’index des cas
            const response = await fetch('data/case-index.json');
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            const caseIndex = await response.json();
    
            // Filtrer les fichiers pour les thèmes sélectionnés (insensible à la casse)
            let caseFiles = [];
            console.log('Selected themes:', selectedThemes);
            selectedThemes.forEach(theme => {
                const themeLower = theme.toLowerCase(); // Convertir en minuscules
                if (caseIndex[themeLower]) {
                    caseFiles = caseFiles.concat(caseIndex[themeLower]);
                }
            });
            console.log('Case files found:', caseFiles);
    
            if (caseFiles.length === 0) {
                throw new Error('Aucun cas disponible pour les thèmes sélectionnés');
            }
    
            // Charger les données de chaque fichier
            const casesPromises = caseFiles.map(file =>
                fetch(`data/${file}`)
                    .then(res => {
                        if (!res.ok) throw new Error(`Fichier ${file} introuvable`);
                        return res.json();
                    })
            );
            const cases = await Promise.all(casesPromises);
            console.log('Cas chargés :', cases);
            return cases;
        } catch (error) {
            console.error('Erreur lors du chargement des cas :', error);
            alert('Erreur lors du chargement des cas cliniques : ' + error.message);
            return [];
        }
    }

    function displayValue(element, value) {
        if (!element) return;
        element.textContent = value ?? '';
    }

    function parseBP(text) {
        const m = (text || '').match(/(\d{2,3})\/(\d{2,3})/);
        return m ? { systolic: +m[1], diastolic: +m[2] } : { systolic: 120, diastolic: 80 };
    }

    function parseNum(text) {
        const m = (text || '').match(/[\d]+(?:[\.,][\d]+)?/);
        return m ? parseFloat(m[0].replace(',', '.')) : NaN;
    }

    class VitalSignsMonitor {
        constructor(props, layout) { this.props = props; this.layout = layout || { ecgH: 96, spo2H: 48 }; }
        mount(root) { this.root = root; this.root.innerHTML = this.template(); this.initAnimatedWaves(); this.updateDisplay(); this.startAnimations(); }
        template() {
            return (
                '<div class="vm">'
                + '<div class="vm-header"><div style="color:#007bff;font-weight:700">ECG</div><div style="color:#333">HR: <span id="hr-value">' + this.props.heartRate + '</span> BPM</div></div>'
                + '<div style="position:relative;height:' + this.layout.ecgH + 'px;background:rgba(0,0,0,0.03);border-radius:8px;overflow:hidden">'
                +   '<svg style="position:absolute;inset:0;width:100%;height:100%;opacity:.2">'
                +     '<defs><pattern id="vm-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0 L0 0 0 20" fill="none" stroke="#007bff" stroke-width="0.5"/></pattern></defs>'
                +     '<rect width="100%" height="100%" fill="url(#vm-grid)"/>'
                +   '</svg>'
                +   '<svg viewBox="0 0 400 128" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%">'
                +     '<defs><linearGradient id="vm-heartGradient" x1="0%" y1="0%" x2="100%" y2="0%">'
                +       '<stop offset="0%" stop-color="#007bff" stop-opacity="0"/><stop offset="50%" stop-color="#007bff"/><stop offset="100%" stop-color="#007bff" stop-opacity="0"/>'
                +     '</linearGradient></defs>'
                +     '<g id="heart-group" style="animation:ecg-scroll var(--ecg-speed,4s) linear infinite;will-change:transform">'
                +       '<path id="heart-line-1" stroke="url(#vm-heartGradient)" stroke-width="2" fill="none" d=""/>'
                +       '<path id="heart-line-2" stroke="url(#vm-heartGradient)" stroke-width="2" fill="none" d=""/>'
                +     '</g>'
                +   '</svg>'
                +   '<div id="pulse-indicator" style="position:absolute;top:8px;right:8px;width:8px;height:8px;background:#dc3545;border-radius:50%;animation:pulse calc(60s / var(--heart-rate,72)) infinite"></div>'
                + '</div>'
                + '<div style="margin-top:8px">'
                +   '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
                +     '<div id="spo2-label" style="color:#17a2b8;font-weight:700">SpO₂</div>'
                +     '<div id="spo2-value" style="color:#333">' + this.props.spo2 + '%</div>'
                +   '</div>'
                +   '<div style="position:relative;height:' + this.layout.spo2H + 'px;background:rgba(0,0,0,0.03);border-radius:8px;overflow:hidden">'
                +     '<svg style="position:absolute;inset:0;width:100%;height:100%;opacity:.2">'
                +       '<defs><pattern id="vm-spo2-grid" width="15" height="15" patternUnits="userSpaceOnUse"><path d="M15 0 L0 0 0 15" fill="none" stroke="#17a2b8" stroke-width="0.3"/></pattern></defs>'
                +       '<rect width="100%" height="100%" fill="url(#vm-spo2-grid)"/>'
                +     '</svg>'
                +     '<svg class="spo2-wave" style="position:absolute;inset:0;width:100%;height:100%">'
                +       '<defs><linearGradient id="vm-spo2Gradient" x1="0%" y1="0%" x2="100%" y2="0%">'
                +         '<stop offset="0%" stop-color="#17a2b8" stop-opacity="0"/><stop offset="50%" stop-color="#17a2b8"/><stop offset="100%" stop-color="#17a2b8" stop-opacity="0"/>'
                +       '</linearGradient></defs>'
                +       '<path id="spo2-path-1" stroke="url(#vm-spo2Gradient)" stroke-width="2" fill="none" d=""/>'
                +       '<path id="spo2-path-2" stroke="url(#vm-spo2Gradient)" stroke-width="2" fill="none" d=""/>'
                +     '</svg>'
                +   '</div>'
                + '</div>'
                + '<div class="vm-grid" style="margin-top:8px; display:flex; flex-direction:column; width:100%;">'
                +   '<div style="display: flex; gap: 12px; width:100%; margin-bottom: 6px;">'
                +     '<div class="vm-card" style="flex:1 1 0; min-width:0;">'
                +       '<div style="color:#6c757d;font-size:12px;margin-bottom:2px"></div>'
                +       '<div id="bp-value" style="color:#333;font-weight:700;font-size:16px;width:100%">' + this.props.systolic + '/' + this.props.diastolic + '</div>'
                +       '<div style="color:#007bff;font-size:11px">mmHg</div>'
                +     '</div>'
                +     '<div class="vm-card" style="flex:1 1 0; min-width:0;">'
                +       '<div style="color:#6c757d;font-size:12px;margin-bottom:2px"></div>'
                +       '<div id="temp-value" style="color:#333;font-weight:700;font-size:16px;width:100%">' + this.props.temperature.toFixed(1) + '°C</div>'
                +       '<div style="color:#007bff;font-size:11px"></div>'
                +     '</div>'
                +   '</div>'
                + '</div>'
                + '</div>'
            );
        }
        initAnimatedWaves() {
            const spo2Path1 = document.getElementById('spo2-path-1');
            const spo2Path2 = document.getElementById('spo2-path-2');
            const width = 200, baseY = 32, amp = 8; let p = 'M0,' + baseY;
            for (let x = 0; x <= width; x += 5) { const y = baseY + Math.sin((x / width) * Math.PI * 4) * amp; p += ' L' + x + ',' + y; }
            if (spo2Path1) spo2Path1.setAttribute('d', p);
            if (spo2Path2) { spo2Path2.setAttribute('d', p); spo2Path2.setAttribute('transform', 'translate(200 0)'); }

            // Ajouter une animation similaire à l'ECG
            const spo2Wave = document.querySelector('.spo2-wave');
            if (spo2Wave) {
                spo2Wave.style.animation = 'spo2-scroll 6s linear infinite';
            }
        }
        updateDisplay() {
            const hrEl = document.getElementById('hr-value'); if (hrEl) hrEl.textContent = this.props.heartRate;
            const bpEl = document.getElementById('bp-value'); if (bpEl) bpEl.textContent = this.props.systolic + '/' + this.props.diastolic;
            const spo2El = document.getElementById('spo2-value'); if (spo2El) spo2El.textContent = this.props.spo2 + '%';
            const tempEl = document.getElementById('temp-value'); if (tempEl) tempEl.textContent = this.props.temperature.toFixed(1) + '°C';
            document.documentElement.style.setProperty('--heart-rate', this.props.heartRate);
            const spo2Label = document.getElementById('spo2-label'); const spo2Value = document.getElementById('spo2-value'); const low = this.props.spo2 <= 92;
            if (spo2Label) { spo2Label.style.color = low ? '#dc3545' : '#17a2b8'; }
            if (spo2Value) { spo2Value.style.color = low ? '#dc3545' : '#333'; }
        }
        startAnimations() {
            const pulse = document.getElementById('pulse-indicator'); const hr = this.props.heartRate; const bpm = 60 / hr; if (pulse) pulse.style.animationDuration = bpm + 's';
            const l1 = document.getElementById('heart-line-1'); const l2 = document.getElementById('heart-line-2'); const amp = Math.min(25 + (hr - 60) * 0.3, 40); const path = this.generateECGPath(amp);
            if (l1) l1.setAttribute('d', path); if (l2) { l2.setAttribute('d', path); l2.setAttribute('transform', 'translate(400 0)'); }
            const grp = document.getElementById('heart-group'); const speed = 6 - ((hr - 60) * 0.04); const dur = Math.max(2.5, Math.min(7, speed));
            document.documentElement.style.setProperty('--ecg-speed', dur + 's'); if (grp) grp.style.animationDuration = dur + 's';
        }
        generateECGPath(amp) {
            const baseY = 64, beatWidth = 70, beats = 6; let p = 'M0,' + baseY;
            for (let i = 0; i < beats; i++) { const x = i * beatWidth; p += ' L' + (x + 5) + ',' + baseY; p += ' Q' + (x + 10) + ',' + (baseY - amp * 0.25) + ' ' + (x + 15) + ',' + baseY; p += ' L' + (x + 22) + ',' + (baseY + amp * 0.25); p += ' L' + (x + 30) + ',' + (baseY - amp); p += ' L' + (x + 38) + ',' + (baseY + amp * 0.5); p += ' L' + (x + 48) + ',' + baseY; p += ' Q' + (x + 55) + ',' + (baseY - amp * 0.35) + ' ' + (x + 62) + ',' + baseY; p += ' L' + (x + beatWidth) + ',' + baseY; }
            return p;
        }
        updateProps(np) { this.props = { ...this.props, ...np }; this.updateDisplay(); this.startAnimations(); }
    }

    function mountVitalMonitorAtConstants() {
        const container = document.querySelector('#examen-clinique > div');
        if (!container) return;
        const existing = container.querySelector('#vital-monitor');
        const ps = Array.from(container.querySelectorAll('p')).slice(0, 5);
        const h = ps.reduce((sum, p) => sum + p.offsetHeight, 0) || container.offsetHeight;
        const text = {
            bp: tension ? tension.textContent : '',
            hr: pouls ? pouls.textContent : '',
            spo2: saturationO2 ? saturationO2.textContent : '',
            temp: temperature ? temperature.textContent : '',
            resp: frequenceRespiratoire ? frequenceRespiratoire.textContent : ''
        };
        const bp = parseBP(text.bp);
        const monitorProps = {
            systolic: bp.systolic,
            diastolic: bp.diastolic,
            heartRate: parseNum(text.hr) || 72,
            spo2: parseNum(text.spo2) || 98,
            temperature: parseNum(text.temp) || 36.6,
            respiratoryRate: parseNum(text.resp) || 16
        };
        if (existing && vitalMonitorInstance) {
            vitalMonitorInstance.updateProps(monitorProps);
            return;
        }
        ps.forEach(p => p.remove());
        const mount = document.createElement('div');
        mount.id = 'vital-monitor';
        mount.style.minHeight = h + 'px';
        container.prepend(mount);
        const ecgH = Math.max(56, Math.round(h * 0.45));
        const spo2H = Math.max(40, Math.round(h * 0.25));
        vitalMonitorInstance = new VitalSignsMonitor(monitorProps, { ecgH, spo2H });
        vitalMonitorInstance.mount(mount);
    }

   function loadCase() {
        timeLeft = getTimeLimit();
        displayTime(timeLeft);
        clearInterval(timerInterval); // Effacer l'ancien intervalle
        timerInterval = setInterval(updateTimer, 1000); // Démarrer le minuteur

        if (cases.length === 0) {
            alert('Aucun cas clinique trouvé.');
            return;
        }

        let playedCases = getCookie('playedCases');
        playedCases = playedCases ? playedCases.split(',') : [];

        // Sélection aléatoire d’un cas non joué
        let availableCases = cases.filter(caseItem => !playedCases.includes(caseItem.id));

        if (availableCases.length === 0) {
            alert('Tous les cas ont été joués !');
            return;
        }

        currentCase = availableCases[Math.floor(Math.random() * availableCases.length)];
        currentCaseIndex = cases.indexOf(currentCase);

        displayValue(document.getElementById('patient-nom'), currentCase.patient.nom);
        displayValue(document.getElementById('patient-prenom'), currentCase.patient.prenom);
        displayValue(document.getElementById('patient-age'), currentCase.patient.age);
        displayValue(document.getElementById('patient-sexe'), currentCase.patient.sexe);
        displayValue(document.getElementById('patient-taille'), currentCase.patient.taille);
        displayValue(document.getElementById('patient-poids'), currentCase.patient.poids);
        displayValue(document.getElementById('patient-groupeSanguin'), currentCase.patient.groupeSanguin);
        displayValue(motifHospitalisation, currentCase.interrogatoire.motifHospitalisation);
        displayValue(activitePhysique, currentCase.interrogatoire.modeDeVie.activitePhysique.description);
        displayValue(tabac, `${currentCase.interrogatoire.modeDeVie.tabac.quantite} depuis ${currentCase.interrogatoire.modeDeVie.tabac.duree}`);
        displayValue(alcool, currentCase.interrogatoire.modeDeVie.alcool.quantite);
        displayValue(alimentation, `${currentCase.interrogatoire.modeDeVie.alimentation.regime}, ${currentCase.interrogatoire.modeDeVie.alimentation.particularites}`);
        displayValue(emploi, `${currentCase.interrogatoire.modeDeVie.emploi.profession}, stress: ${currentCase.interrogatoire.modeDeVie.emploi.stress}`);
        antecedentsMedicaux.innerHTML = '<ul>' + currentCase.interrogatoire.antecedents.medicaux.map(ant => `<li>${ant.type} (${ant.traitement})</li>`).join('') + '</ul>';
        antecedentsChirurgicaux.innerHTML = '<ul>' + currentCase.interrogatoire.antecedents.chirurgicaux.map(ant => `<li>${ant.intervention} (${ant.date})</li>`).join('') + '</ul>';
        antecedentsFamiliaux.innerHTML = '<ul>' + currentCase.interrogatoire.antecedents.familiaux.map(ant => `<li>${ant.lien}: ${ant.pathologie} (${ant.age} ans)</li>`).join('') + '</ul>';
        traitementsListe.textContent = currentCase.interrogatoire.traitements.map(trait => `${trait.nom} ${trait.dose} (${trait.frequence})`).join(', ');
        allergiesListe.textContent = currentCase.interrogatoire.allergies.presence ? currentCase.interrogatoire.allergies.liste.map(allergie => `${allergie.allergene} (${allergie.reaction})`).join(', ') : 'Aucune';
        displayValue(debutSymptomes, currentCase.interrogatoire.histoireMaladie.debutSymptomes);
        displayValue(evolution, currentCase.interrogatoire.histoireMaladie.evolution);
        displayValue(facteursDeclenchants, currentCase.interrogatoire.histoireMaladie.facteursDeclenchants);
        displayValue(symptomesAssocies, currentCase.interrogatoire.histoireMaladie.symptomesAssocies.join(', '));
        displayValue(remarques, currentCase.interrogatoire.histoireMaladie.remarques);
        displayValue(tension, currentCase.examenClinique.constantes.tension);
        displayValue(pouls, currentCase.examenClinique.constantes.pouls);
        displayValue(temperature, currentCase.examenClinique.constantes.temperature);
        displayValue(saturationO2, currentCase.examenClinique.constantes.saturationO2);
        displayValue(frequenceRespiratoire, currentCase.examenClinique.constantes.frequenceRespiratoire);
        mountVitalMonitorAtConstants();
        displayValue(aspectGeneral, currentCase.examenClinique.aspectGeneral);
        displayValue(examenCardiovasculaire, currentCase.examenClinique.examenCardiovasculaire.auscultation);
        displayValue(examenPulmonaire, currentCase.examenClinique.examenPulmonaire.auscultation);
        displayValue(examenAbdominal, currentCase.examenClinique.examenAbdominal.palpation);
        displayValue(examenNeurologique, currentCase.examenClinique.examenNeurologique.conscience);

        examensResults.innerHTML = '';

        // Vider la liste des diagnostics possibles
        const diagnosticSelect = document.getElementById('diagnostic-select');
        diagnosticSelect.innerHTML = '<option value="">Sélectionnez un diagnostic</option>';

        // Remplir la liste avec les diagnostics possibles du cas courant
        if (currentCase.possibleDiagnostics && Array.isArray(currentCase.possibleDiagnostics)) {
            currentCase.possibleDiagnostics.forEach(diagnostic => {
                const option = document.createElement('option');
                option.value = diagnostic;
                option.textContent = diagnostic;
                diagnosticSelect.appendChild(option);
            });
        }

        // Générer dynamiquement les boutons d'examens pour ce cas
        const examensSection = document.getElementById('examens');
        const examCategoriesDiv = examensSection.querySelector('.exam-categories');

        // Vider les catégories d'examens existantes
        examCategoriesDiv.innerHTML = '';

        // Vérifier si le cas a des examens disponibles
        if (currentCase.availableExams && Array.isArray(currentCase.availableExams) && currentCase.availableExams.length > 0) {
            // Créez une seule catégorie pour tous les examens disponibles
            const examCategoryDiv = document.createElement('div');
            examCategoryDiv.className = 'exam-category';
            examCategoryDiv.innerHTML = '<h3>Examens disponibles</h3>';

            const examButtonsDiv = document.createElement('div');
            examButtonsDiv.className = 'exam-buttons';

            // Générer un bouton pour chaque examen disponible
            currentCase.availableExams.forEach(exam => {
                const button = document.createElement('button');
                button.className = 'exam-btn';
                button.dataset.exam = exam;
                button.textContent = exam;
                button.addEventListener('click', function() {
                    this.classList.toggle('selected');
                });
                examButtonsDiv.appendChild(button);
            });

            examCategoryDiv.appendChild(examButtonsDiv);
            examCategoriesDiv.appendChild(examCategoryDiv);
        } else {
            // Si aucun examen disponible, afficher un message
            examCategoriesDiv.innerHTML = '<p>Aucun examen disponible pour ce cas.</p>';
        }

        // Afficher les traitements disponibles
        const availableTreatments = document.getElementById('availableTreatments');
        availableTreatments.innerHTML = ''; // Vider la liste précédente

        const availableTreatmentsTitle = document.createElement('h3');
        availableTreatments.appendChild(availableTreatmentsTitle);

        if (currentCase.possibleTreatments && Array.isArray(currentCase.possibleTreatments)) {
            currentCase.possibleTreatments.forEach(traitement => {
                const button = document.createElement('button');
                button.textContent = traitement;
                button.dataset.traitement = traitement;
                button.setAttribute('aria-selected', 'false');
                button.setAttribute('role', 'button');
                button.addEventListener('click', handleTraitementClick);
                availableTreatments.appendChild(button);
            });
        }

        gsap.from(".medical-card", {
            duration: 1,
            y: 50,
            opacity: 0,
            stagger: 0.2,
            ease: "power2.out"
        });

        // Réinitialiser les traitements sélectionnés
        selectedTreatments = [];

        // Vider le feedback des traitements
        document.getElementById('treatment-feedback').textContent = '';


        scoreDisplay.textContent = '';
        feedbackDisplay.textContent = '';
        score = 0;
        attempts = 0; // Réinitialiser le nombre d'essais
    }

     function calculateScore() {
        let baseScore = currentCase.scoringRules.baseScore || 100;
        let attemptPenalty = currentCase.scoringRules.attemptPenalty || 10;
        return Math.max(0, baseScore - (attempts * attemptPenalty)); // Le score ne peut pas être négatif
    }

    

function handleTraitementClick(event) {
        const traitement = event.target.dataset.traitement;
        if (selectedTreatments.includes(traitement)) {
            selectedTreatments = selectedTreatments.filter(t => t !== traitement);
            event.target.classList.remove('selected');
            event.target.setAttribute('aria-selected', 'false');
        } else {
            selectedTreatments.push(traitement);
            event.target.classList.add('selected');
            event.target.setAttribute('aria-selected', 'true');
        }
    }

    document.getElementById('validate-traitement').addEventListener('click', () => {
        attempts++;
        const correctTreatments = currentCase.correctTreatments;
        const selectedDiagnostic = document.getElementById('diagnostic-select').value;
        const correctDiagnostic = currentCase.correctDiagnostic;

    const allCorrectSelected = correctTreatments.every(t => selectedTreatments.includes(t));

    if (selectedDiagnostic === correctDiagnostic && allCorrectSelected && selectedTreatments.length === correctTreatments.length) {
        score = calculateScore();
        feedbackDisplay.textContent = 'Diagnostic et traitement corrects !';

        // Ajout des feux d'artifice
        const container = document.querySelector('#fireworks-container');
        const fireworks = new Fireworks(container, {
            duration: 3, // Durée de l'animation en secondes
        });

        // Sauvegarde de l'élément audio pour le réutiliser plus tard
        const backgroundMusic = document.querySelector('audio');
        backgroundMusic.pause();

        // Lecture du son de succès
        const successSound = new Audio('assets/sounds/feux_artifice.mp3');
        successSound.play();

        fireworksInstance = fireworks;
        backgroundMusicEl = backgroundMusic;
        fireworks.start();
        showCorrectionModal(currentCase.correction || `Diagnostic optimal: ${correctDiagnostic}\nTraitements optimaux: ${(correctTreatments || []).join(', ')}`);

        scoreDisplay.textContent = `Score final: ${score}`;
        document.getElementById('treatment-feedback').textContent = '';

        // Mise à jour du cookie
        let playedCases = getCookie('playedCases');
        playedCases = playedCases ? playedCases.split(',') : [];
        playedCases.push(currentCase.id);
        setCookie('playedCases', playedCases.join(','), 365);

    } else {
        let feedback = '';
        if (selectedDiagnostic !== correctDiagnostic) {
            feedback += 'Diagnostic incorrect. ';
            feedbackDisplay.textContent = feedback;
        }

        const allTreatmentsCorrect = correctTreatments.every(t => selectedTreatments.includes(t));

        if (!allTreatmentsCorrect || selectedTreatments.length !== correctTreatments.length) {
            feedback += "Traitement incorrect ou incomplet.";
            document.getElementById('treatment-feedback').textContent = feedback;

            const incorrectSound = new Audio('assets/sounds/wrong buzzer.mp3');
            incorrectSound.play();
        }
    }

    // Gestion des classes CSS pour les boutons de traitement
    const treatmentButtons = document.querySelectorAll('#availableTreatments button');
    treatmentButtons.forEach(button => {
        const traitement = button.dataset.traitement;
        button.classList.remove('correct-treatment', 'incorrect-treatment'); // Retirer les classes précédentes

        if (correctTreatments.includes(traitement)) {
            if (selectedTreatments.includes(traitement)) {
                button.classList.add('correct-treatment'); // Vert si correct et sélectionné
            }
        } else {
            if (selectedTreatments.includes(traitement)) {
                button.classList.add('incorrect-treatment'); // Rouge si incorrect et sélectionné
            }
        }
    });
});

    // La gestion des boutons d'examens est maintenant faite dynamiquement dans loadCase()

    document.getElementById('validate-exams').addEventListener('click', () => {
        const selectedExamButtons = document.querySelectorAll('.exam-btn.selected');
        const selectedExams = Array.from(selectedExamButtons).map(btn => btn.dataset.exam);

        if (selectedExams.length === 0) {
            alert('Veuillez sélectionner au moins un examen.');
            return;
        }

        // Afficher les résultats avec un délai simulé
        examensResults.innerHTML = '<div class="loading">Analyse des examens en cours...</div>';

        setTimeout(() => {
            examensResults.innerHTML = '<h4>Résultats des examens complémentaires :</h4>';

            selectedExams.forEach(exam => {
                const result = currentCase.examResults[exam] || "Résultat non disponible";
                const resultDiv = document.createElement('div');
                resultDiv.className = 'exam-result-item';
                resultDiv.innerHTML = `<strong>${exam}:</strong> ${typeof result === 'object' ? JSON.stringify(result) : result}`;
                examensResults.appendChild(resultDiv);
            });

            // Jouer le son d'examen
            const examSound = new Audio('assets/sounds/bip.m4a');
            examSound.play();

        }, 1500); // Délai de 1.5 secondes pour simuler le temps d'analyse
    });

    function handleShowResultClick(event) {
       const examen = event.target.dataset.examen;
        // Simuler un délai avant d'afficher le résultat
        const examSound = new Audio('assets/sounds/bip.m4a');
        examSound.play();

        setTimeout(() => {
            const result = currentCase.examResults[examen] || "Résultat non disponible";
            const resultDiv = document.createElement('div');
            resultDiv.innerHTML = `<strong>${examen}:</strong> ${typeof result === 'object' ? JSON.stringify(result) : result}`;
            examensResults.appendChild(resultDiv);
        }, 1000); // Délai de 1 seconde
    }

     validateDiagnosticButton.addEventListener('click', () => {
        attempts++;
        const selectedDiagnostic = document.getElementById('diagnostic-select').value;
        const correctDiagnostic = currentCase.correctDiagnostic;

        if (selectedDiagnostic !== correctDiagnostic) {
            feedbackDisplay.textContent = 'Diagnostic incorrect. Essayez encore.';
        }
         else {
            feedbackDisplay.textContent = 'Diagnostic correct !';
         }
    });

    nextCaseButton.addEventListener('click', () => {
        currentCaseIndex = (currentCaseIndex + 1) % cases.length;
        loadCase();
    });

    async function initializeGame() {
        cases = await loadCasesData();
        if (cases.length > 0) {
            loadCase();
        }
        displayTime(timeLeft);
    }
    
    examensResults.innerHTML = '';
    initializeGame();
});
