// Y'a qql qui va lire le code ?? si oui veuillez me contacter sur discord : docteur_wu
function showNotification(message) {
    const notification = document.createElement('div');
    notification.classList.add('notification');
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 3000); // Remove after 3 seconds
}
const NOTIFICATION_DURATION = 3000;
const DEFAULT_TIME_LIMIT = 240;
const DEFAULT_ECG_HEIGHT = 96;
const DEFAULT_SPO2_HEIGHT = 48;
const VITAL_SIGN_VARIATION = 0.025;
const DEFAULT_HEART_RATE = 72;
const DEFAULT_SPO2 = 98;
const DEFAULT_TEMPERATURE = 36.6;
const DEFAULT_RESPIRATORY_RATE = 16;
const GSAP_DURATION = 1;
const GSAP_Y = 50;
const GSAP_STAGGER = 0.2;
const FIREWORKS_DURATION = 3;
const COOKIE_EXPIRY_DAYS = 365;
const EXAM_ANALYSIS_DELAY = 1.5;
const SHOW_RESULT_DELAY = 1;
const BASE_SCORE = 100;
const ATTEMPT_PENALTY = 10;

// Configuration for clinical exam sections (label, icon)
const EXAM_CONFIG = {
    examenCardiovasculaire: { label: 'Cardiovasculaire', icon: 'fa-heartbeat' },
    examenPulmonaire: { label: 'Pulmonaire', icon: 'fa-lungs' },
    examenAbdominal: { label: 'Abdominal', icon: 'fa-procedures' },
    examenNeurologique: { label: 'Neurologique', icon: 'fa-brain' },
    examenORL: { label: 'ORL', icon: 'fa-ear-listen' },
    examenVestibulaire: { label: 'Vestibulaire', icon: 'fa-compass' },
    examenDermatologique: { label: 'Dermatologique', icon: 'fa-hand-dots' },
    examenMusculosquelettique: { label: 'Musculosquelettique', icon: 'fa-bone' },
    examenOphtalmologique: { label: 'Ophtalmologique', icon: 'fa-eye' },
    examenUrologique: { label: 'Urologique', icon: 'fa-droplet' },
    default: { label: 'Autre Examen', icon: 'fa-stethoscope' }
};

// Helper function to render an exam section dynamically
function renderExamSection(key, data) {
    const config = EXAM_CONFIG[key] || EXAM_CONFIG.default;
    // Use a readable label: either from config or derive from key
    const label = config.label !== 'Autre Examen' ? config.label : key.replace(/^examen/, '').replace(/([A-Z])/g, ' $1').trim();
    const icon = config.icon;

    let contentHtml = '';
    if (typeof data === 'string') {
        contentHtml = `<p>${data}</p>`;
    } else if (typeof data === 'object' && data !== null) {
        const items = Object.entries(data).map(([subKey, value]) => {
            // Capitalize first letter of subKey for display
            const displayKey = subKey.charAt(0).toUpperCase() + subKey.slice(1);
            return `<li><strong>${displayKey}:</strong> ${value}</li>`;
        }).join('');
        contentHtml = `<ul>${items}</ul>`;
    }

    return `
        <div class="exam-item">
            <h4><i class="fas ${icon}"></i> ${label}</h4>
            ${contentHtml}
        </div>
    `;
}

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
    const examensResults = document.getElementById('examens-results');
    console.log('examensResults défini au début :', examensResults);
    const validateExamsButton = document.getElementById('validate-exams');
    // const validateDiagnosticButton = document.getElementById('validate-diagnostic'); // REMOVED
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
    let activeExams = []; // Track currently displayed exam results
    let fireworksInstance = null;
    let backgroundMusicEl = null;
    let vitalMonitorInstance = null;

    // --- GATING SYSTEM (VERROUS) ---
    let unlockedLocks = new Set();
    try {
        const savedLocks = sessionStorage.getItem('unlockedLocks');
        if (savedLocks) unlockedLocks = new Set(JSON.parse(savedLocks));
    } catch (e) { console.error("Error loading locks", e); }

    function saveLocks() {
        sessionStorage.setItem('unlockedLocks', JSON.stringify([...unlockedLocks]));
    }

    function isFieldLocked(path) {
        if (!currentCase || !currentCase.locks) return false;
        return currentCase.locks.some(lock =>
            !unlockedLocks.has(lock.id) && lock.target_fields.includes(path)
        );
    }

    function getLockForField(path) {
        if (!currentCase || !currentCase.locks) return null;
        return currentCase.locks.find(lock =>
            !unlockedLocks.has(lock.id) && lock.target_fields.includes(path)
        );
    }

    function normalizeText(text) {
        return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    }

    function showLockChallenge(lockId) {
        console.log("showLockChallenge called with lockId:", lockId);
        console.log("currentCase:", currentCase);

        if (!currentCase) {
            console.error("currentCase is not defined");
            showNotification("Erreur: cas non chargé");
            return;
        }

        if (!currentCase.locks || !Array.isArray(currentCase.locks)) {
            console.error("currentCase.locks is not defined or not an array");
            showNotification("Erreur: pas de verrous définis");
            return;
        }

        const lock = currentCase.locks.find(l => l.id === lockId);
        if (!lock) {
            console.error("Lock not found:", lockId);
            showNotification("Erreur: verrou introuvable");
            return;
        }

        console.log("Lock found:", lock);

        // Hide nurse intro if it's still showing to avoid timer conflicts
        if (typeof NurseIntro !== 'undefined') {
            NurseIntro.hide();
        }

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'correction-overlay';
        modalOverlay.style.display = 'flex';
        modalOverlay.id = 'lock-challenge-modal';
        modalOverlay.style.zIndex = '2000'; // Ensure it's above everything

        let challengeHtml = '';
        if (lock.type === 'SAISIE') {
            challengeHtml = `
                <div class="lock-modal">
                    <h3><i class="fas fa-unlock-alt"></i> DÉFI SÉMIOLOGIQUE</h3>
                    <p class="challenge-question">${lock.challenge.question}</p>
                    <input type="text" id="lock-answer" placeholder="Votre réponse..." autocomplete="off">
                    <p id="lock-error" class="error-feedback"></p>
                    <div class="correction-actions">
                        <button class="secondary-btn" id="lock-cancel">Annuler</button>
                        <button class="primary-btn" id="lock-submit">Valider</button>
                    </div>
                </div>
            `;
        } else if (lock.type === 'QCM') {
            const optionsHtml = lock.challenge.options.map((opt, i) =>
                `<div class="mcq-option" data-index="${i}">${opt}</div>`
            ).join('');

            challengeHtml = `
                <div class="lock-modal">
                    <h3><i class="fas fa-unlock-alt"></i> DÉFI SÉMIOLOGIQUE</h3>
                    <p class="challenge-question">${lock.challenge.question}</p>
                    <div class="mcq-options">${optionsHtml}</div>
                    <p id="lock-error" class="error-feedback"></p>
                    <div class="correction-actions">
                        <button class="secondary-btn" id="lock-cancel">Annuler</button>
                        <button class="primary-btn" id="lock-submit">Valider</button>
                    </div>
                </div>
            `;
        }

        modalOverlay.innerHTML = challengeHtml;
        document.body.appendChild(modalOverlay);

        if (lock.type === 'SAISIE') {
            const input = document.getElementById('lock-answer');
            input.focus();
            input.addEventListener('keypress', (e) => { if (e.key === 'Enter') validateSaisie(); });
            document.getElementById('lock-submit').addEventListener('click', validateSaisie);
        } else {
            document.querySelectorAll('.mcq-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    opt.classList.toggle('selected');
                });
            });
            document.getElementById('lock-submit').addEventListener('click', validateQCM);
        }

        document.getElementById('lock-cancel').addEventListener('click', () => {
            modalOverlay.remove();
        });

        function validateSaisie() {
            const val = document.getElementById('lock-answer').value;
            const answer = normalizeText(val);
            const isCorrect = lock.challenge.expected_keywords.some(kw => normalizeText(kw) === answer || answer.includes(normalizeText(kw)));

            if (isCorrect) {
                unlock(lockId);
                modalOverlay.remove();
            } else {
                document.getElementById('lock-error').textContent = lock.feedback_error || "Réponse incorrecte.";
                gsap.to(".lock-modal", { x: 10, repeat: 3, yoyo: true, duration: 0.1 });
            }
        }

        function validateQCM() {
            const selectedOptions = document.querySelectorAll('.mcq-option.selected');
            const selectedIndices = Array.from(selectedOptions).map(opt => parseInt(opt.dataset.index));

            const correctIndices = lock.challenge.correct_indices || (lock.challenge.correct_index !== undefined ? [lock.challenge.correct_index] : []);

            // Sort results to compare
            selectedIndices.sort((a, b) => a - b);
            const sortedCorrect = [...correctIndices].sort((a, b) => a - b);

            const isCorrect = selectedIndices.length === sortedCorrect.length &&
                selectedIndices.every((val, index) => val === sortedCorrect[index]);

            if (isCorrect) {
                unlock(lockId);
                modalOverlay.remove();
            } else {
                document.getElementById('lock-error').textContent = lock.feedback_error || "Réponse incorrecte.";
                gsap.to(".lock-modal", { x: 10, repeat: 3, yoyo: true, duration: 0.1 });
            }
        }
    }

    function unlock(lockId) {
        unlockedLocks.add(lockId);
        saveLocks();

        // Refresh the UI to show the unlocked data
        loadCase(true);
    }

    // Export globally for onclick handlers
    window.showLockChallenge = showLockChallenge;
    window.showImageModal = showImageModal;

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
        if (currentCase && currentCase.redacteur) {
            text += `<div style="font-size: 0.8em; color: #888; text-align: right; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; font-style: italic;">Merci à ${escapeHtml(currentCase.redacteur)} pour avoir rédigé ce cas !</div>`;
        }
        if (currentCase && currentCase.correctionImage) {
            text = `<div style="text-align: center; margin-bottom: 20px;">
                        <img src="${currentCase.correctionImage}" style="max-width: 100%; max-height: 400px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.3); border: 2px solid var(--glass-border); cursor: pointer;" onclick="window.showImageModal('${currentCase.correctionImage}', 'Illustration Correction')">
                    </div>` + text;
        }
        renderCorrectionContent(text || '');
        const overlay = document.getElementById('correction-overlay');
        overlay.style.display = 'flex';
    }

    function hideCorrectionModal() {
        const overlay = document.getElementById('correction-overlay');
        overlay.style.display = 'none';
    }

    function showImageModal(src, caption) {
        const overlay = document.getElementById('image-overlay');
        const img = document.getElementById('image-modal-img');
        const cap = document.getElementById('image-modal-caption');
        if (img) img.src = src || '';
        if (img) img.alt = caption || '';
        if (cap) cap.textContent = caption || '';
        if (overlay) overlay.style.display = 'flex';
    }

    function hideImageModal() {
        const overlay = document.getElementById('image-overlay');
        const img = document.getElementById('image-modal-img');
        if (img) img.src = '';
        if (overlay) overlay.style.display = 'none';
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

        currentCaseIndex++;
        if (currentCaseIndex >= cases.length) {
            window.location.href = 'index.html';
            return;
        }
        loadCase();
    });

    const imageCloseBtn = document.getElementById('image-modal-close');
    if (imageCloseBtn) imageCloseBtn.addEventListener('click', hideImageModal);
    const imageOverlay = document.getElementById('image-overlay');
    if (imageOverlay) imageOverlay.addEventListener('click', (e) => { if (e.target && e.target.id === 'image-overlay') hideImageModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideImageModal(); });

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
            showNotification('Temps écoulé !');
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
            // Preview Mode check
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('preview') === 'true') {
                const previewData = sessionStorage.getItem('previewCase');
                if (previewData) {
                    console.log('Loading Preview Case from sessionStorage');
                    // Add "Return to Editor" button
                    const backBtn = document.createElement('button');
                    backBtn.innerHTML = '<i class="fas fa-edit"></i> Quitter l\'aperçu / Modifier';
                    backBtn.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        z-index: 1000;
                        background: #a020f0;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 30px;
                        font-family: inherit;
                        font-weight: bold;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        transition: all 0.3s;
                    `;
                    backBtn.onmouseover = () => backBtn.style.transform = 'scale(1.05)';
                    backBtn.onmouseout = () => backBtn.style.transform = 'scale(1)';
                    backBtn.onclick = () => window.location.href = 'editor.html';
                    document.body.appendChild(backBtn);

                    return [JSON.parse(previewData)];
                }
            }

            // Vérifier d'abord si une session de MULTIPLES CAS a été sélectionnée
            const selectedCaseFiles = JSON.parse(localStorage.getItem('selectedCaseFiles'));
            if (selectedCaseFiles && Array.isArray(selectedCaseFiles) && selectedCaseFiles.length > 0) {
                console.log('Loading selected session cases:', selectedCaseFiles);
                const casesPromises = selectedCaseFiles.map(file =>
                    fetch(`data/${file}`)
                        .then(res => {
                            if (!res.ok) throw new Error(`Fichier ${file} introuvable`);
                            return res.json();
                        })
                );
                const results = await Promise.all(casesPromises);
                // On peut vider ou garder selectedCaseFiles. On va le vider pour repartir de zéro au prochain coup
                localStorage.removeItem('selectedCaseFiles');
                return results;
            }

            // Vérifier d'abord si un cas spécifique UNIQUE a été sélectionné
            const selectedCaseFile = localStorage.getItem('selectedCaseFile');
            if (selectedCaseFile) {
                console.log('Loading specific case:', selectedCaseFile);
                const response = await fetch(`data/${selectedCaseFile}`);
                if (!response.ok) throw new Error(`Fichier ${selectedCaseFile} introuvable`);
                const caseData = await response.json();

                // On nettoie le localStorage pour que les rechargements futurs ne restent pas bloqués sur ce cas
                // (ou on le garde si on veut que le bouton "Rejouer" fonctionne, mais ici on va le vider car game.js
                // utilise cases[] pour choisir. On va mettre ce cas unique dans la liste.)
                localStorage.removeItem('selectedCaseFile');
                return [caseData];
            }

            // Sinon, récupérer les thèmes sélectionnés depuis localStorage (Comportement original)
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
            showNotification('Erreur lors du chargement des cas cliniques : ' + error.message);
            return [];
        }
    }

    function displayValue(element, value, path) {
        if (!element) return;

        if (path && isFieldLocked(path)) {
            const lock = getLockForField(path);
            element.setAttribute('data-locked', 'true');
            element.innerHTML = `
                <div class="lock-placeholder" onclick="window.showLockChallenge('${lock.id}')">
                    <i class="fas fa-lock"></i>
                    <span class="challenge-text">DÉFI À RELEVER</span>
                </div>
            `;
            return;
        }

        const isNew = element.getAttribute('data-locked') === 'true';
        element.textContent = value ?? '';

        if (isNew) {
            element.removeAttribute('data-locked');
            element.classList.add('unlocked-data');
        }
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
        constructor(props, layout) {
            this.props = props;
            this.layout = layout || { ecgH: 96, spo2H: 48 };
            // Stocker les valeurs de base pour les calculs de variation
            this.baseValues = { ...props };
            // Calculer les intervalles de variation (±2.5%)
            this.calculateVariationRanges();
            this.updateInterval = null;
        }
        calculateVariationRanges() {
            // Créer des intervalles de variation de ±2.5% autour des valeurs de base
            const variationPercent = 0.025; // 2.5%
            this.variationRanges = {
                systolic: {
                    min: Math.round(this.baseValues.systolic * (1 - variationPercent)),
                    max: Math.round(this.baseValues.systolic * (1 + variationPercent))
                },
                diastolic: {
                    min: Math.round(this.baseValues.diastolic * (1 - variationPercent)),
                    max: Math.round(this.baseValues.diastolic * (1 + variationPercent))
                },
                heartRate: {
                    min: Math.round(this.baseValues.heartRate * (1 - variationPercent)),
                    max: Math.round(this.baseValues.heartRate * (1 + variationPercent))
                },
                temperature: {
                    // Pour la température, garder 1 décimale mais faire varier autour de ±2.5%
                    min: Math.round((this.baseValues.temperature * (1 - variationPercent)) * 10) / 10,
                    max: Math.round((this.baseValues.temperature * (1 + variationPercent)) * 10) / 10
                },
                spo2: {
                    min: Math.round(this.baseValues.spo2 * (1 - variationPercent)),
                    max: Math.round(this.baseValues.spo2 * (1 + variationPercent))
                },
                respiratoryRate: {
                    min: Math.round(this.baseValues.respiratoryRate * (1 - variationPercent)),
                    max: Math.round(this.baseValues.respiratoryRate * (1 + variationPercent))
                }
            };
        }
        generateRandomValue(range) {
            return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
        }
        updateVitalsValues() {
            // Mettre à jour les valeurs avec variation aléatoire dans les intervalles
            this.props.systolic = this.generateRandomValue(this.variationRanges.systolic);
            this.props.diastolic = this.generateRandomValue(this.variationRanges.diastolic);
            this.props.heartRate = this.generateRandomValue(this.variationRanges.heartRate);

            // Température spéciale (avec 1 décimale)
            const tempVariation = (Math.random() * (this.variationRanges.temperature.max - this.variationRanges.temperature.min)) + this.variationRanges.temperature.min;
            this.props.temperature = Math.round(tempVariation * 10) / 10;

            this.props.spo2 = this.generateRandomValue(this.variationRanges.spo2);
            this.props.respiratoryRate = this.generateRandomValue(this.variationRanges.respiratoryRate);

            // Mettre à jour l'affichage et les animations
            this.updateDisplay();
            this.startAnimations();
        }
        startVitalUpdates() {
            // Démarrer les mises à jour périodiques (toutes les 3-5 secondes)
            const updateInterval = 3000 + Math.random() * 2000; // 3-5 secondes aléatoirement
            this.updateInterval = setInterval(() => {
                this.updateVitalsValues();
            }, updateInterval);
        }
        stopVitalUpdates() {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
        }
        mount(root) { this.root = root; this.root.innerHTML = this.template(); this.initAnimatedWaves(); this.updateDisplay(); this.startAnimations(); this.startVitalUpdates(); }
        template() {
            return (
                '<div class="vm" style="position:relative; overflow:hidden;">'
                + '<div class="vm-crt-overlay"></div>' // CRT Overlay
                + '<div class="vm-header"><div style="color:#007bff;font-weight:700;text-shadow:0 0 5px rgba(0,123,255,0.5)">ECG</div><div style="color:#e0e0e0">HR: <span id="hr-value" class="vm-value-pulse" style="color:#fff;text-shadow:0 0 5px rgba(255,255,255,0.5)">' + this.props.heartRate + '</span> BPM</div></div>'
                // Main flex container for scope and vitals cards
                + '<div style="display:flex; gap:8px; align-items:stretch;">'
                // Left side: ECG and SpO2 scopes
                + '<div style="flex:1; min-width:0;">'
                + '<div style="position:relative;height:' + this.layout.ecgH + 'px;background:rgba(0,10,20,0.5);border-radius:8px;overflow:hidden;border:1px solid rgba(0,123,255,0.2);box-shadow:inset 0 0 20px rgba(0,0,0,0.5)">'
                + '<div class="vm-scanline"></div>' // Scanline
                + '<svg style="position:absolute;inset:0;width:100%;height:100%;opacity:.1">'
                + '<defs><pattern id="vm-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0 L0 0 0 20" fill="none" stroke="#007bff" stroke-width="0.5"/></pattern></defs>'
                + '<rect width="100%" height="100%" fill="url(#vm-grid)"/>'
                + '</svg>'
                + '<svg viewBox="0 0 400 128" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%">'
                + '<defs><linearGradient id="vm-heartGradient" x1="0%" y1="0%" x2="100%" y2="0%">'
                + '<stop offset="0%" stop-color="#007bff" stop-opacity="0"/><stop offset="10%" stop-color="#007bff" stop-opacity="0.8"/><stop offset="50%" stop-color="#007bff"/><stop offset="90%" stop-color="#007bff" stop-opacity="0.8"/><stop offset="100%" stop-color="#007bff" stop-opacity="0"/>'
                + '</linearGradient></defs>'
                + '<g id="heart-group" style="animation:ecg-scroll var(--ecg-speed,4s) linear infinite;will-change:transform">'
                + '<path id="heart-line-1" class="vm-line-glow" stroke="url(#vm-heartGradient)" stroke-width="2" fill="none" d=""/>'
                + '<path id="heart-line-2" class="vm-line-glow" stroke="url(#vm-heartGradient)" stroke-width="2" fill="none" d=""/>'
                + '</g>'
                + '</svg>'
                + '<div id="pulse-indicator" style="position:absolute;top:8px;right:8px;width:10px;height:10px;background:#dc3545;border-radius:50%;box-shadow:0 0 10px #dc3545;animation:pulse-dot calc(60s / var(--heart-rate,72)) infinite"></div>'
                + '</div>'
                + '<div style="margin-top:8px">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
                + '<div id="spo2-label" style="color:#17a2b8;font-weight:700;text-shadow:0 0 5px rgba(23,162,184,0.5)">SpO₂</div>'
                + '<div id="spo2-value" class="vm-value-pulse" style="color:#fff;text-shadow:0 0 5px rgba(255,255,255,0.5)">' + this.props.spo2 + '%</div>'
                + '</div>'
                + '<div style="position:relative;height:' + this.layout.spo2H + 'px;background:rgba(0,10,20,0.5);border-radius:8px;overflow:hidden;border:1px solid rgba(23,162,184,0.2);box-shadow:inset 0 0 20px rgba(0,0,0,0.5)">'
                + '<div class="vm-scanline" style="animation-delay: 1s;"></div>' // Scanline delayed
                + '<svg style="position:absolute;inset:0;width:100%;height:100%;opacity:.1">'
                + '<defs><pattern id="vm-spo2-grid" width="15" height="15" patternUnits="userSpaceOnUse"><path d="M15 0 L0 0 0 15" fill="none" stroke="#17a2b8" stroke-width="0.3"/></pattern></defs>'
                + '<rect width="100%" height="100%" fill="url(#vm-spo2-grid)"/>'
                + '</svg>'
                + '<svg class="spo2-wave" style="position:absolute;inset:0;width:100%;height:100%">'
                + '<defs><linearGradient id="vm-spo2Gradient" x1="0%" y1="0%" x2="100%" y2="0%">'
                + '<stop offset="0%" stop-color="#17a2b8" stop-opacity="0"/><stop offset="10%" stop-color="#17a2b8" stop-opacity="0.8"/><stop offset="50%" stop-color="#17a2b8"/><stop offset="90%" stop-color="#17a2b8" stop-opacity="0.8"/><stop offset="100%" stop-color="#17a2b8" stop-opacity="0"/>'
                + '</linearGradient></defs>'
                + '<path id="spo2-path-1" class="vm-line-glow" stroke="url(#vm-spo2Gradient)" stroke-width="2" fill="none" d=""/>'
                + '<path id="spo2-path-2" class="vm-line-glow" stroke="url(#vm-spo2Gradient)" stroke-width="2" fill="none" d=""/>'
                + '</svg>'
                + '</div>'
                + '</div>'
                + '</div>' // End left side
                // Right side: Tension and Temperature cards
                + '<div style="display:flex; flex-direction:column; gap:8px; width:80px; flex-shrink:0;">'
                + '<div class="vm-card" style="flex:1; border:1px solid rgba(255,255,255,0.1); box-shadow:0 0 10px rgba(0,0,0,0.2); display:flex; flex-direction:column; justify-content:center; padding:6px;">'
                + '<div style="color:#6c757d;font-size:10px;margin-bottom:2px;text-align:center;">TENSION</div>'
                + '<div id="bp-value" style="color:#fff;font-weight:700;font-size:13px;text-align:center;text-shadow:0 0 5px rgba(255,255,255,0.3)">' + this.props.systolic + '/' + this.props.diastolic + '</div>'
                + '<div style="color:#007bff;font-size:9px;text-align:center;">mmHg</div>'
                + '</div>'
                + '<div class="vm-card" style="flex:1; border:1px solid rgba(255,255,255,0.1); box-shadow:0 0 10px rgba(0,0,0,0.2); display:flex; flex-direction:column; justify-content:center; padding:6px;">'
                + '<div style="color:#6c757d;font-size:10px;margin-bottom:2px;text-align:center;">TEMP</div>'
                + '<div id="temp-value" style="color:#fff;font-weight:700;font-size:13px;text-align:center;text-shadow:0 0 5px rgba(255,255,255,0.3)">' + this.props.temperature.toFixed(1) + '°C</div>'
                + '<div style="color:#007bff;font-size:9px;text-align:center;"></div>'
                + '</div>'
                + '</div>' // End right side
                + '</div>' // End main flex container
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
        const sidebarScope = document.getElementById('sidebar-scope');
        if (!sidebarScope) return;

        // Create or get the specific mount point for the monitor
        let mountPoint = document.getElementById('vital-monitor-mount');
        if (!mountPoint) {
            mountPoint = document.createElement('div');
            mountPoint.id = 'vital-monitor-mount';
            mountPoint.style.width = '100%';
            mountPoint.style.height = '100%';
            sidebarScope.appendChild(mountPoint);
        }

        // Get values from the hidden spans
        const tension = document.getElementById('tension');
        const pouls = document.getElementById('pouls');
        const saturationO2 = document.getElementById('saturationO2');
        const temperature = document.getElementById('temperature');
        const frequenceRespiratoire = document.getElementById('frequenceRespiratoire');

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

        if (vitalMonitorInstance) {
            vitalMonitorInstance.stopVitalUpdates();
            mountPoint.innerHTML = '';
        }

        const ecgH = 70;
        const spo2H = 35;

        vitalMonitorInstance = new VitalSignsMonitor(monitorProps, { ecgH, spo2H });
        vitalMonitorInstance.mount(mountPoint);
    }

    function loadCase(isPartialRefresh = false) {
        console.log("loadCase called, isPartialRefresh:", isPartialRefresh);
        if (isPartialRefresh) console.trace("Trace for partial refresh");

        // Prepare time but don't start timer yet
        if (!isPartialRefresh) {
            timeLeft = getTimeLimit();
            displayTime(timeLeft);
            if (timerInterval) clearInterval(timerInterval);
        } else {
            // If partial refresh, we must be careful with NurseIntro
            if (typeof NurseIntro !== 'undefined') {
                // If we don't want the nurse to finish her previous talk and trigger callbacks
                // we could potentially clear her callback here, but NurseIntro doesn't expose a way to clear it 
                // easily without hiding her.
            }
        }

        if (cases.length === 0) {
            showNotification('Aucun cas clinique trouvé.');
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const isPreview = urlParams.get('preview') === 'true';

        if (!isPartialRefresh) {
            currentCase = cases[currentCaseIndex];
        }

        displayValue(document.getElementById('patient-nom'), currentCase.patient.nom, 'patient.nom');
        displayValue(document.getElementById('patient-prenom'), currentCase.patient.prenom, 'patient.prenom');
        displayValue(document.getElementById('patient-age'), currentCase.patient.age, 'patient.age');
        displayValue(document.getElementById('patient-sexe'), currentCase.patient.sexe, 'patient.sexe');
        displayValue(document.getElementById('patient-taille'), currentCase.patient.taille, 'patient.taille');
        displayValue(document.getElementById('patient-poids'), currentCase.patient.poids, 'patient.poids');
        displayValue(document.getElementById('patient-groupeSanguin'), currentCase.patient.groupeSanguin, 'patient.groupeSanguin');

        // Update sidebar patient mini-card
        const patientNomSidebar = document.getElementById('patient-nom-sidebar');
        const patientAgeSidebar = document.getElementById('patient-age-sidebar');
        const patientSexeSidebar = document.getElementById('patient-sexe-sidebar');
        const patientInitials = document.getElementById('patient-initials');

        if (patientNomSidebar) patientNomSidebar.textContent = `${currentCase.patient.prenom} ${currentCase.patient.nom}`;
        if (patientAgeSidebar) patientAgeSidebar.textContent = currentCase.patient.age;
        if (patientSexeSidebar) patientSexeSidebar.textContent = currentCase.patient.sexe;
        if (patientInitials) {
            const initials = (currentCase.patient.prenom.charAt(0) + currentCase.patient.nom.charAt(0)).toUpperCase();
            patientInitials.textContent = initials;
        }

        displayValue(motifHospitalisation, currentCase.interrogatoire.motifHospitalisation, 'interrogatoire.motifHospitalisation');
        displayValue(activitePhysique, currentCase.interrogatoire.modeDeVie.activitePhysique.description, 'interrogatoire.modeDeVie.activitePhysique.description');
        displayValue(tabac, `${currentCase.interrogatoire.modeDeVie.tabac.quantite} depuis ${currentCase.interrogatoire.modeDeVie.tabac.duree}`, 'interrogatoire.modeDeVie.tabac');
        displayValue(alcool, currentCase.interrogatoire.modeDeVie.alcool.quantite, 'interrogatoire.modeDeVie.alcool.quantite');
        displayValue(alimentation, `${currentCase.interrogatoire.modeDeVie.alimentation.regime}, ${currentCase.interrogatoire.modeDeVie.alimentation.particularites}`, 'interrogatoire.modeDeVie.alimentation');
        displayValue(emploi, `${currentCase.interrogatoire.modeDeVie.emploi.profession}, stress: ${currentCase.interrogatoire.modeDeVie.emploi.stress}`, 'interrogatoire.modeDeVie.emploi');

        if (isFieldLocked('interrogatoire.antecedents')) {
            const lock = getLockForField('interrogatoire.antecedents');
            const placeholder = `<div class="lock-placeholder" onclick="window.showLockChallenge('${lock.id}')"><i class="fas fa-lock"></i><span class="challenge-text">DÉFI À RELEVER</span></div>`;
            antecedentsMedicaux.innerHTML = placeholder;
            antecedentsChirurgicaux.innerHTML = '';
            antecedentsFamiliaux.innerHTML = '';
        } else {
            antecedentsMedicaux.innerHTML = '<ul>' + currentCase.interrogatoire.antecedents.medicaux.map(ant => `<li>${ant.type} (${ant.traitement})</li>`).join('') + '</ul>';
            antecedentsChirurgicaux.innerHTML = '<ul>' + currentCase.interrogatoire.antecedents.chirurgicaux.map(ant => `<li>${ant.intervention} (${ant.date})</li>`).join('') + '</ul>';
            antecedentsFamiliaux.innerHTML = '<ul>' + currentCase.interrogatoire.antecedents.familiaux.map(ant => `<li>${ant.lien}: ${ant.pathologie} (${ant.age} ans)</li>`).join('') + '</ul>';
        }

        if (isFieldLocked('interrogatoire.traitements')) {
            const lock = getLockForField('interrogatoire.traitements');
            traitementsListe.innerHTML = `<div class="lock-placeholder" onclick="window.showLockChallenge('${lock.id}')"><i class="fas fa-lock"></i><span class="challenge-text">DÉFI À RELEVER</span></div>`;
        } else {
            traitementsListe.textContent = currentCase.interrogatoire.traitements.map(trait => `${trait.nom} ${trait.dose} (${trait.frequence})`).join(', ');
        }

        allergiesListe.textContent = currentCase.interrogatoire.allergies.presence ? currentCase.interrogatoire.allergies.liste.map(allergie => `${allergie.allergene} (${allergie.reaction})`).join(', ') : 'Aucune';

        displayValue(debutSymptomes, currentCase.interrogatoire.histoireMaladie.debutSymptomes, 'interrogatoire.histoireMaladie.debutSymptomes');
        displayValue(evolution, currentCase.interrogatoire.histoireMaladie.evolution, 'interrogatoire.histoireMaladie.evolution');
        displayValue(facteursDeclenchants, currentCase.interrogatoire.histoireMaladie.facteursDeclenchants, 'interrogatoire.histoireMaladie.facteursDeclenchants');
        displayValue(symptomesAssocies, currentCase.interrogatoire.histoireMaladie.symptomesAssocies.join(', '), 'interrogatoire.histoireMaladie.symptomesAssocies');
        displayValue(remarques, currentCase.interrogatoire.histoireMaladie.remarques, 'interrogatoire.histoireMaladie.remarques');

        displayValue(tension, currentCase.examenClinique.constantes.tension, 'examenClinique.constantes.tension');
        displayValue(pouls, currentCase.examenClinique.constantes.pouls, 'examenClinique.constantes.pouls');
        displayValue(temperature, currentCase.examenClinique.constantes.temperature, 'examenClinique.constantes.temperature');
        displayValue(saturationO2, currentCase.examenClinique.constantes.saturationO2, 'examenClinique.constantes.saturationO2');
        displayValue(frequenceRespiratoire, currentCase.examenClinique.constantes.frequenceRespiratoire, 'examenClinique.constantes.frequenceRespiratoire');

        mountVitalMonitorAtConstants();
        displayValue(aspectGeneral, currentCase.examenClinique.aspectGeneral, 'examenClinique.aspectGeneral');

        // Dynamic rendering of clinical exam sections
        const examDetailsGrid = document.querySelector('.exam-details-grid');
        if (examDetailsGrid) {
            examDetailsGrid.innerHTML = ''; // Clear previous content
            const examenClinique = currentCase.examenClinique || {};
            const skipKeys = ['constantes', 'aspectGeneral']; // These are handled elsewhere

            for (const key of Object.keys(examenClinique)) {
                if (skipKeys.includes(key)) continue;
                const examData = examenClinique[key];
                const path = `examenClinique.${key}`;
                if (examData) {
                    if (isFieldLocked(path)) {
                        const lock = getLockForField(path);
                        examDetailsGrid.innerHTML += `
                            <div class="exam-item">
                                <h4><i class="fas fa-lock lock-icon"></i> ${key}</h4>
                                <div class="lock-placeholder" onclick="window.showLockChallenge('${lock.id}')">
                                    <i class="fas fa-puzzle-piece"></i>
                                    <span class="challenge-text">DÉFI À RELEVER</span>
                                </div>
                            </div>
                        `;
                    } else {
                        examDetailsGrid.innerHTML += renderExamSection(key, examData);
                    }
                }
            }
        }

        if (!isPartialRefresh) {
            examensResults.innerHTML = '';
            activeExams = [];
        } else {
            renderExamResults();
        }

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
        const validateExamsBtn = document.getElementById('validate-exams');

        // Vider les catégories d'examens existantes
        examCategoriesDiv.innerHTML = '';

        if (isFieldLocked('examensComplementaires')) {
            const lock = getLockForField('examensComplementaires');
            examCategoriesDiv.innerHTML = `
                <div class="lock-placeholder section-lock" onclick="window.showLockChallenge('${lock.id}')" style="margin: 20px 0; padding: 40px; border-radius: 15px; background: rgba(0,0,0,0.3); border: 2px dashed var(--glass-border); flex-direction: column; cursor: pointer;">
                    <i class="fas fa-lock" style="font-size: 3rem; margin-bottom: 15px; color: var(--secondary-color);"></i>
                    <h3 style="margin-bottom: 10px;">SECTION VERROUILLÉE</h3>
                    <p>Relevez le défi sémiologique pour débloquer les prescriptions</p>
                    <button class="primary-btn" style="margin-top: 20px;">RELEVER LE DÉFI</button>
                </div>
            `;
            if (validateExamsBtn) validateExamsBtn.style.display = 'none';
        } else {
            if (validateExamsBtn) validateExamsBtn.style.display = 'block';
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
                    button.addEventListener('click', function () {
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

        if (!isPartialRefresh) {
            gsap.from(".medical-card", {
                duration: 1,
                y: 50,
                opacity: 0,
                stagger: 0.2,
                ease: "power2.out"
            });
        }

        if (!isPartialRefresh) {
            // Réinitialiser les traitements sélectionnés
            selectedTreatments = [];

            // Vider le feedback des traitements
            document.getElementById('treatment-feedback').textContent = '';

            scoreDisplay.textContent = '';
            feedbackDisplay.textContent = '';
            score = 0;
            attempts = 0; // Réinitialiser le nombre d'essais
        }

        if (!isPartialRefresh) {
            // Show nurse intro, then start the timer when dismissed
            NurseIntro.show(
                currentCase.patient,
                currentCase.interrogatoire.motifHospitalisation,
                () => {
                    // Start the timer only after nurse is dismissed
                    if (timerInterval) clearInterval(timerInterval);
                    timerInterval = setInterval(updateTimer, 1000);
                }
            );
        }
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
        const isCorrect = selectedDiagnostic === correctDiagnostic && allCorrectSelected && selectedTreatments.length === correctTreatments.length;

        if (isCorrect) {
            score = calculateScore();
            feedbackDisplay.textContent = 'Diagnostic et traitement corrects !';

            // Ajout des feux d'artifice
            const container = document.querySelector('#fireworks-container');
            const fireworks = new Fireworks(container, {
                duration: 3, // Durée de l'animation en secondes
            });

            // Sauvegarde de l'élément audio pour le réutiliser plus tard
            const backgroundMusic = document.querySelector('audio');
            if (backgroundMusic) backgroundMusic.pause();

            // Lecture du son de succès
            const successSound = new Audio('assets/sounds/feux_artifice.mp3');
            successSound.play();

            fireworksInstance = fireworks;
            backgroundMusicEl = backgroundMusic;
            fireworks.start();

            scoreDisplay.textContent = `Score final: ${score}`;
            document.getElementById('treatment-feedback').textContent = '';
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
                // REMOVED: Failure sound
            }

            // Score remains 0 if incorrect
            scoreDisplay.textContent = `Score final: ${score}`;
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

        // Calculate percentage score
        let percentageScore = 0;
        const diagnosticWeight = 50; // 50% for diagnostic
        const treatmentWeight = 50; // 50% for treatments

        // Diagnostic score
        if (selectedDiagnostic === correctDiagnostic) {
            percentageScore += diagnosticWeight;
        }

        // Treatment score
        if (correctTreatments.length > 0) {
            const correctSelectedCount = selectedTreatments.filter(t => correctTreatments.includes(t)).length;
            const incorrectSelectedCount = selectedTreatments.filter(t => !correctTreatments.includes(t)).length;

            // Award points for correct treatments, penalize for incorrect ones
            const treatmentPointsPerCorrect = treatmentWeight / correctTreatments.length;
            percentageScore += correctSelectedCount * treatmentPointsPerCorrect;

            // Optionally penalize for wrong treatments (commented out for now)
            // percentageScore -= incorrectSelectedCount * (treatmentPointsPerCorrect / 2);
        }

        percentageScore = Math.max(0, Math.min(100, Math.round(percentageScore)));

        // Build color-coded comparison HTML
        const diagnosticCorrect = selectedDiagnostic === correctDiagnostic;
        const diagnosticUserStyle = diagnosticCorrect
            ? 'background: rgba(46, 204, 113, 0.3); padding: 5px; border-radius: 4px;'
            : 'background: rgba(231, 76, 60, 0.3); padding: 5px; border-radius: 4px;';

        // Build treatments list with color coding
        let userTreatmentsHtml = '';
        if (selectedTreatments.length === 0) {
            userTreatmentsHtml = '<span style="background: rgba(231, 76, 60, 0.3); padding: 5px; border-radius: 4px;">Aucun</span>';
        } else {
            userTreatmentsHtml = selectedTreatments.map(t => {
                const isCorrect = correctTreatments.includes(t);
                const style = isCorrect
                    ? 'background: rgba(46, 204, 113, 0.3); padding: 3px 8px; border-radius: 4px; margin: 2px; display: inline-block;'
                    : 'background: rgba(231, 76, 60, 0.3); padding: 3px 8px; border-radius: 4px; margin: 2px; display: inline-block;';
                return `<span style="${style}">${t}</span>`;
            }).join(' ');
        }

        // Build expected treatments with highlighting for what was selected
        let expectedTreatmentsHtml = correctTreatments.map(t => {
            const wasSelected = selectedTreatments.includes(t);
            const style = wasSelected
                ? 'background: rgba(46, 204, 113, 0.3); padding: 3px 8px; border-radius: 4px; margin: 2px; display: inline-block;'
                : 'background: rgba(255, 193, 7, 0.3); padding: 3px 8px; border-radius: 4px; margin: 2px; display: inline-block;';
            return `<span style="${style}">${t}</span>`;
        }).join(' ');

        const comparisonHtml = `
            <div class="correction-comparison" style="margin-bottom: 20px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                <div style="text-align: center; margin-bottom: 15px;">
                    <h3 style="color: ${percentageScore >= 50 ? '#2ecc71' : '#e74c3c'}; font-size: 2em; margin: 0;">
                        Score: ${percentageScore}%
                    </h3>
                </div>
                <div style="margin-bottom: 10px;">
                    <h4 style="color: #e74c3c; margin-bottom: 5px;">Votre Réponse</h4>
                    <p><strong>Diagnostic:</strong> <span style="${diagnosticUserStyle}">${selectedDiagnostic || 'Aucun'}</span></p>
                    <p><strong>Traitements:</strong> ${userTreatmentsHtml}</p>
                </div>
                <div>
                    <h4 style="color: #2ecc71; margin-bottom: 5px;">Réponse Attendue</h4>
                    <p><strong>Diagnostic:</strong> ${correctDiagnostic}</p>
                    <p><strong>Traitements:</strong> ${expectedTreatmentsHtml}</p>
                    <p style="font-size: 0.9em; color: #aaa; margin-top: 5px;">
                        <span style="background: rgba(46, 204, 113, 0.3); padding: 2px 6px; border-radius: 3px;">Vert</span> = Correct | 
                        <span style="background: rgba(255, 193, 7, 0.3); padding: 2px 6px; border-radius: 3px;">Jaune</span> = Manquant | 
                        <span style="background: rgba(231, 76, 60, 0.3); padding: 2px 6px; border-radius: 3px;">Rouge</span> = Incorrect
                    </p>
                </div>
            </div>
            <hr style="border-color: rgba(255,255,255,0.1); margin: 20px 0;">
        `;

        // ALWAYS show correction and update cookie
        startPostGameQuiz(comparisonHtml);

        // Mise à jour du cookie
        let playedCases = getCookie('playedCases');
        playedCases = playedCases ? playedCases.split(',') : [];
        if (!playedCases.includes(currentCase.id)) {
            playedCases.push(currentCase.id);
            setCookie('playedCases', playedCases.join(','), 365);
        }
    });

    // La gestion des boutons d'examens est maintenant faite dynamiquement dans loadCase()

    function renderExamResults() {
        if (activeExams.length === 0) return;

        if (isFieldLocked('examensComplementaires')) {
            examensResults.innerHTML = '<div class="lock-placeholder">Section verrouillée.</div>';
            return;
        }

        examensResults.innerHTML = '<h4>Résultats des examens complémentaires :</h4>';

        activeExams.forEach(exam => {
            const path = `examResults.${exam}`;
            const result = currentCase.examResults[exam] || "Résultat non disponible";
            const resultDiv = document.createElement('div');
            resultDiv.className = 'exam-result-item';

            if (isFieldLocked(path)) {
                const lock = getLockForField(path);
                resultDiv.innerHTML = `
                        <strong>${exam}:</strong>
                        <div class="lock-placeholder" onclick="window.showLockChallenge('${lock.id}')" style="display:inline-flex; padding:5px 15px; margin-left:10px;">
                            <i class="fas fa-lock" style="font-size:1rem;"></i>
                            <span class="challenge-text" style="font-size:0.8rem;">DÉFI À RELEVER</span>
                        </div>
                    `;
            } else {
                const isObj = typeof result === 'object' && result !== null;
                const text = isObj ? (result.value || result.text || JSON.stringify(result)) : result;
                resultDiv.innerHTML = `<strong>${exam}:</strong> ${text}`;
                if (isObj && result.image) {
                    const btn = document.createElement('button');
                    btn.innerHTML = '<i class="fas fa-image"></i> Voir l’imagerie';
                    btn.className = 'btn-add';
                    btn.style.marginLeft = '12px';
                    btn.style.padding = '4px 10px';
                    btn.style.fontSize = '0.8em';
                    btn.addEventListener('click', () => {
                        showImageModal(result.image, 'Résultat: ' + exam);
                    });
                    resultDiv.appendChild(btn);
                }
            }
            examensResults.appendChild(resultDiv);
        });
    }

    document.getElementById('validate-exams').addEventListener('click', () => {
        const selectedExamButtons = document.querySelectorAll('.exam-btn.selected');
        const selectedExams = Array.from(selectedExamButtons).map(btn => btn.dataset.exam);

        if (selectedExams.length === 0) {
            showNotification('Veuillez sélectionner au moins un examen.');
            return;
        }

        // Afficher les résultats avec un délai simulé
        examensResults.innerHTML = '<div class="loading">Analyse des examens en cours...</div>';

        setTimeout(() => {
            activeExams = selectedExams;
            renderExamResults();

            // Jouer le son d'examen (if possible)
            try {
                // Not playing bip.m4a as it doesn't exist
            } catch (e) { }

        }, 1500); // Délai de 1.5 secondes pour simuler le temps d'analyse
    });

    function handleShowResultClick(event) {
        const examen = event.target.dataset.examen;
        // Simuler un délai avant d'afficher le résultat

        setTimeout(() => {
            const result = currentCase.examResults[examen] || "Résultat non disponible";
            const resultDiv = document.createElement('div');
            resultDiv.innerHTML = `<strong>${examen}:</strong> ${typeof result === 'object' ? JSON.stringify(result) : result}`;
            examensResults.appendChild(resultDiv);
        }, 1000); // Délai de 1 seconde
    }

    // Sidebar Navigation Logic
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.game-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active class from all items
            navItems.forEach(nav => nav.classList.remove('active'));
            // Add active class to clicked item
            item.classList.add('active');

            // Hide all sections
            sections.forEach(section => section.classList.remove('active'));
            // Show target section
            const targetId = item.dataset.target;
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
            }
        });
    });

    // validateDiagnosticButton listener REMOVED as it is no longer used.
    // Validation is now handled solely by validate-traitement.

    nextCaseButton.addEventListener('click', () => {
        currentCaseIndex++;
        if (currentCaseIndex >= cases.length) {
            window.location.href = 'index.html';
            return;
        }
        loadCase();
    });

    async function initializeGame() {
        cases = await loadCasesData();
        if (cases.length > 0) {
            showNotification(`Session démarrée : ${cases.length} cas chargé(s)`);
            loadCase();
        }
        displayTime(timeLeft);
    }

    examensResults.innerHTML = '';
    initializeGame();

    // --- SIDEBAR TOGGLE ---
    const sidebarToggle = document.getElementById('sidebar-toggle');
    // --- Post-Game Quiz System ---
    let currentQuizIndex = 0;
    let quizComparisonHtml = '';

    function startPostGameQuiz(comparisonHtml) {
        if (!currentCase.postGameQuestions || currentCase.postGameQuestions.length === 0) {
            showCorrectionModal(comparisonHtml + (currentCase.correction || ''));
            return;
        }
        currentQuizIndex = 0;
        quizComparisonHtml = comparisonHtml;
        showPostGameQuestion(0);
    }

    function showPostGameQuestion(index) {
        const question = currentCase.postGameQuestions[index];
        const modal = document.createElement('div');
        modal.className = 'correction-overlay lock-challenge-overlay';
        modal.id = 'quiz-modal';
        modal.style.display = 'flex';

        const isLast = index === currentCase.postGameQuestions.length - 1;

        modal.innerHTML = `
            <div class="lock-modal" style="border-color: var(--primary-color); box-shadow: 0 0 30px rgba(160, 32, 240, 0.2);">
                <div style="font-size: 0.8rem; color: var(--primary-color); text-transform: uppercase; margin-bottom: 10px;">
                    Question post-jeu ${index + 1}/${currentCase.postGameQuestions.length}
                </div>
                <h3>DÉFI FINAL</h3>
                <div class="challenge-question">${question.challenge.question}</div>
                <div id="quiz-details-container"></div>
                <div class="error-feedback" id="quiz-error"></div>
                <button class="action-btn" id="quiz-submit-btn" style="background: var(--primary-color); color: white;">
                    ${isLast ? 'VOIR LA CORRECTION' : 'QUESTION SUIVANTE'}
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        const detailsContainer = modal.querySelector('#quiz-details-container');
        if (question.type === 'SAISIE') {
            detailsContainer.innerHTML = `<input type="text" id="quiz-input" placeholder="Votre réponse..." autocomplete="off">`;
            const input = detailsContainer.querySelector('#quiz-input');
            input.focus();
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') validateQuizAnswer();
            });
        } else {
            detailsContainer.innerHTML = `<div class="mcq-options">
                ${question.challenge.options.map((opt, i) => `
                    <div class="mcq-option" data-index="${i}">${opt}</div>
                `).join('')}
            </div>`;
            const options = detailsContainer.querySelectorAll('.mcq-option');
            options.forEach(opt => {
                opt.addEventListener('click', () => {
                    opt.classList.toggle('selected');
                    opt.style.borderColor = opt.classList.contains('selected') ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)';
                    opt.style.background = opt.classList.contains('selected') ? 'rgba(160, 32, 240, 0.1)' : 'rgba(255,255,255,0.05)';
                });
            });
        }

        modal.querySelector('#quiz-submit-btn').addEventListener('click', validateQuizAnswer);

        function validateQuizAnswer() {
            let isCorrect = false;
            if (question.type === 'SAISIE') {
                const val = document.getElementById('quiz-input').value.toLowerCase().trim();
                isCorrect = question.challenge.expected_keywords.some(k => val.includes(k.toLowerCase().trim()));
            } else {
                const selected = Array.from(detailsContainer.querySelectorAll('.mcq-option.selected')).map(opt => parseInt(opt.dataset.index));
                const correct = question.challenge.correct_indices || [];
                isCorrect = selected.length === correct.length && selected.every(idx => correct.includes(idx));
            }

            if (isCorrect) {
                modal.remove();
                if (isLast) {
                    showCorrectionModal(quizComparisonHtml + (currentCase.correction || ''));
                } else {
                    showPostGameQuestion(index + 1);
                }
            } else {
                document.getElementById('quiz-error').innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${question.feedback_error || 'Réponse incorrecte'}`;
                const btn = modal.querySelector('#quiz-submit-btn');
                btn.style.background = '#e74c3c';
                btn.textContent = 'RÉESSAYER';
                setTimeout(() => {
                    btn.style.background = 'var(--primary-color)';
                    btn.textContent = isLast ? 'VOIR LA CORRECTION' : 'QUESTION SUIVANTE';
                }, 1000);
            }
        }
    }

    const appContainer = document.querySelector('.app-container');

    if (sidebarToggle && appContainer) {
        // Restore sidebar state from sessionStorage
        const sidebarCollapsed = sessionStorage.getItem('sidebarCollapsed') === 'true';
        if (sidebarCollapsed) {
            appContainer.classList.add('sidebar-collapsed');
        }

        sidebarToggle.addEventListener('click', () => {
            appContainer.classList.toggle('sidebar-collapsed');
            const isCollapsed = appContainer.classList.contains('sidebar-collapsed');
            sessionStorage.setItem('sidebarCollapsed', isCollapsed);
        });
    }
});
