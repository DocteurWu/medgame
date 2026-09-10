/**
 * js/auscultation-pcg.js — Contrôleur du module d'entraînement PCG (PhysioNet CinC 2016)
 *
 * Entraînement à la discrimination binaire :
 * - Normal (bruits physiologiques purs, pas d'indication à référer)
 * - Anormal (souffles / bruits surajoutés, référer en cardiologie pour ETT)
 *
 * Exploite les 120 phonocardiogrammes réels de data/pcg-trainer-database.js.
 * Licence données : Open Data Commons Attribution License v1.0 (ODC-BY).
 */

const PCGTrainer = (() => {
    const state = {
        cases: [],
        queue: [],
        queueIndex: 0,
        currentCase: null,
        isPlaying: false,
        showMarkers: true,
        userAnswered: false,
        filterMode: 'diaphragm',
        volume: 0.85,
        audioEngine: null,
        phonoAnimId: null,
        stats: {
            total: 0,
            correct: 0,
            normalTotal: 0,
            normalCorrect: 0,
            abnormalTotal: 0,
            abnormalCorrect: 0
        }
    };

    // Éléments DOM du module
    let dom = {};

    function init(audioEngineInstance) {
        state.audioEngine = audioEngineInstance || window.auscultationAudio || (typeof AuscultationAudioEngine !== 'undefined' ? new AuscultationAudioEngine() : null);
        if (state.audioEngine && !window.auscultationAudio) {
            window.auscultationAudio = state.audioEngine;
        }

        cacheDom();
        bindEvents();

        if (typeof PCG_TRAINER_DATABASE !== 'undefined' && Array.isArray(PCG_TRAINER_DATABASE)) {
            state.cases = [...PCG_TRAINER_DATABASE];
            startNewSession();
        } else {
            console.warn('[PCGTrainer] PCG_TRAINER_DATABASE non disponible.');
        }
    }

    function cacheDom() {
        dom = {
            container: document.getElementById('pcg-trainer-container'),
            caseRecordBadge: document.getElementById('pcg-case-record'),
            caseSetBadge: document.getElementById('pcg-case-set'),
            casePatientText: document.getElementById('pcg-case-patient'),
            caseSiteText: document.getElementById('pcg-case-site'),
            btnPlay: document.getElementById('btn-pcg-play'),
            btnNormal: document.getElementById('btn-pcg-normal'),
            btnAbnormal: document.getElementById('btn-pcg-abnormal'),
            btnNext: document.getElementById('btn-pcg-next'),
            btnToggleMarkers: document.getElementById('btn-pcg-toggle-markers'),
            btnFilterDiaphragm: document.getElementById('btn-pcg-filter-diaphragm'),
            btnFilterBell: document.getElementById('btn-pcg-filter-bell'),
            sliderVolume: document.getElementById('pcg-volume-slider'),
            volumeValueText: document.getElementById('pcg-volume-value'),
            feedbackBox: document.getElementById('pcg-feedback-box'),
            feedbackTitle: document.getElementById('pcg-feedback-title'),
            feedbackDiag: document.getElementById('pcg-feedback-diag'),
            feedbackExplanation: document.getElementById('pcg-feedback-explanation'),
            feedbackDecision: document.getElementById('pcg-feedback-decision'),
            statAccuracy: document.getElementById('pcg-stat-accuracy'),
            statCount: document.getElementById('pcg-stat-count'),
            statSensitivity: document.getElementById('pcg-stat-sensitivity'),
            statSpecificity: document.getElementById('pcg-stat-specificity'),
            canvas: document.getElementById('pcg-phonocardiogram-canvas'),
            markersBar: document.getElementById('pcg-markers-bar')
        };
    }

    function bindEvents() {
        if (dom.btnPlay) {
            dom.btnPlay.addEventListener('click', toggleAudio);
        }

        if (dom.btnNormal) {
            dom.btnNormal.addEventListener('click', () => submitAnswer('normal'));
        }

        if (dom.btnAbnormal) {
            dom.btnAbnormal.addEventListener('click', () => submitAnswer('abnormal'));
        }

        if (dom.btnNext) {
            dom.btnNext.addEventListener('click', nextCase);
        }

        if (dom.btnToggleMarkers) {
            dom.btnToggleMarkers.addEventListener('click', () => {
                state.showMarkers = !state.showMarkers;
                dom.btnToggleMarkers.classList.toggle('active', state.showMarkers);
                if (dom.markersBar) {
                    dom.markersBar.style.display = state.showMarkers ? 'flex' : 'none';
                }
            });
        }

        if (dom.sliderVolume) {
            dom.sliderVolume.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                state.volume = val;
                if (state.audioEngine && typeof state.audioEngine.setVolume === 'function') {
                    state.audioEngine.setVolume(val);
                }
                if (dom.volumeValueText) {
                    dom.volumeValueText.textContent = `${Math.round(val * 100)}%`;
                }
            });
        }

        if (dom.btnFilterDiaphragm) {
            dom.btnFilterDiaphragm.addEventListener('click', () => {
                state.filterMode = 'diaphragm';
                dom.btnFilterDiaphragm.classList.add('active');
                if (dom.btnFilterBell) dom.btnFilterBell.classList.remove('active');
                if (state.audioEngine && typeof state.audioEngine.setFilterMode === 'function') {
                    state.audioEngine.setFilterMode('diaphragm');
                }
            });
        }

        if (dom.btnFilterBell) {
            dom.btnFilterBell.addEventListener('click', () => {
                state.filterMode = 'bell';
                dom.btnFilterBell.classList.add('active');
                if (dom.btnFilterDiaphragm) dom.btnFilterDiaphragm.classList.remove('active');
                if (state.audioEngine && typeof state.audioEngine.setFilterMode === 'function') {
                    state.audioEngine.setFilterMode('bell');
                }
            });
        }

        window.addEventListener('resize', resizeCanvas);
    }

    function startNewSession() {
        // Mélange aléatoire (Fisher-Yates) du catalogue complet
        const shuffled = [...state.cases];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        state.queue = shuffled;
        state.queueIndex = 0;
        loadCase(0);
    }

    function loadCase(index) {
        if (!state.queue[index]) return;
        state.queueIndex = index;
        state.currentCase = state.queue[index];
        state.userAnswered = false;

        // Arrêter la lecture en cours
        stopAudio();

        // Réinitialiser l'UI des boutons
        if (dom.btnNormal) {
            dom.btnNormal.disabled = false;
            dom.btnNormal.className = 'btn-pcg-action normal';
        }
        if (dom.btnAbnormal) {
            dom.btnAbnormal.disabled = false;
            dom.btnAbnormal.className = 'btn-pcg-action abnormal';
        }
        if (dom.btnNext) {
            dom.btnNext.style.display = 'none';
        }
        if (dom.feedbackBox) {
            dom.feedbackBox.style.display = 'none';
            dom.feedbackBox.className = 'pcg-feedback-box';
        }

        // Mettre à jour les métadonnées
        const c = state.currentCase;
        if (dom.caseRecordBadge) dom.caseRecordBadge.textContent = `Clip ${c.record.toUpperCase()}`;
        if (dom.caseSetBadge) dom.caseSetBadge.textContent = c.set;
        if (dom.casePatientText) dom.casePatientText.textContent = c.patient || 'Patient adulte';
        if (dom.caseSiteText) dom.caseSiteText.textContent = c.transducerSite || 'Précorde standard';

        // Mettre à jour le canvas des marqueurs S1 / S2
        renderMarkersBar(c.annotations);

        resizeCanvas();
        startPhonoAnimation();
    }

    function toggleAudio() {
        if (state.isPlaying) {
            stopAudio();
        } else {
            playAudio();
        }
    }

    function playAudio() {
        if (!state.currentCase || !state.audioEngine) return;
        state.isPlaying = true;

        if (state.audioEngine && typeof state.audioEngine.setVolume === 'function') {
            state.audioEngine.setVolume(state.volume);
        }
        if (state.audioEngine && typeof state.audioEngine.setFilterMode === 'function') {
            state.audioEngine.setFilterMode(state.filterMode);
        }

        if (typeof state.audioEngine.playFile === 'function') {
            state.audioEngine.playFile(state.currentCase.file);
        } else if (typeof state.audioEngine.play === 'function') {
            state.audioEngine.setCase({
                id: state.currentCase.id,
                audioFile: state.currentCase.file,
                audioParams: { heartRate: 72, volume: 0.8 }
            });
            state.audioEngine.play();
        }

        updatePlayButton(true);
    }

    function stopAudio() {
        state.isPlaying = false;
        if (state.audioEngine && typeof state.audioEngine.stop === 'function') {
            state.audioEngine.stop();
        }
        updatePlayButton(false);
    }

    function updatePlayButton(isPlaying) {
        if (!dom.btnPlay) return;
        if (isPlaying) {
            dom.btnPlay.innerHTML = '<i class="fas fa-pause"></i> Mettre en pause';
            dom.btnPlay.classList.add('playing');
        } else {
            dom.btnPlay.innerHTML = '<i class="fas fa-play"></i> Écouter au stéthoscope';
            dom.btnPlay.classList.remove('playing');
        }
    }

    function submitAnswer(userChoice) {
        if (state.userAnswered || !state.currentCase) return;
        state.userAnswered = true;

        const isCorrect = userChoice === state.currentCase.label;
        const c = state.currentCase;

        // Mise à jour des statistiques
        state.stats.total++;
        if (isCorrect) state.stats.correct++;
        if (c.label === 'normal') {
            state.stats.normalTotal++;
            if (isCorrect) state.stats.normalCorrect++;
        } else {
            state.stats.abnormalTotal++;
            if (isCorrect) state.stats.abnormalCorrect++;
        }
        updateStatsDisplay();

        // Style des boutons de choix
        if (dom.btnNormal) {
            dom.btnNormal.disabled = true;
            if (c.label === 'normal') {
                dom.btnNormal.classList.add('is-correct');
            } else if (userChoice === 'normal') {
                dom.btnNormal.classList.add('is-wrong');
            }
        }
        if (dom.btnAbnormal) {
            dom.btnAbnormal.disabled = true;
            if (c.label === 'abnormal') {
                dom.btnAbnormal.classList.add('is-correct');
            } else if (userChoice === 'abnormal') {
                dom.btnAbnormal.classList.add('is-wrong');
            }
        }

        // Affichage du feedback clinique détaillé
        if (dom.feedbackBox) {
            dom.feedbackBox.style.display = 'block';
            dom.feedbackBox.className = `pcg-feedback-box ${isCorrect ? 'correct' : 'wrong'}`;

            if (dom.feedbackTitle) {
                dom.feedbackTitle.innerHTML = isCorrect
                    ? '<i class="fas fa-check-circle"></i> Décision clinique exacte'
                    : '<i class="fas fa-times-circle"></i> Erreur de dépistage';
            }
            if (dom.feedbackDiag) {
                dom.feedbackDiag.innerHTML = `<strong>Diagnostic réel :</strong> ${c.diagnosis}`;
            }
            if (dom.feedbackExplanation) {
                dom.feedbackExplanation.textContent = c.explanation;
            }
            if (dom.feedbackDecision) {
                dom.feedbackDecision.innerHTML = `<strong>Orientation recommandée :</strong> ${c.clinicalDecision}`;
            }
        }

        // Rendre visible le bouton cas suivant
        if (dom.btnNext) {
            dom.btnNext.style.display = 'inline-flex';
        }

        // Déclencher le son de feedback MedGame
        if (typeof MedGameAudio !== 'undefined') {
            MedGameAudio.play(isCorrect ? 'success' : 'card_flip');
        }

        // Enregistrer la progression dans le système de badges MedGame
        if (window.BadgeSystem) {
            const currentAccuracy = Math.round((state.stats.correct / state.stats.total) * 100);
            window.BadgeSystem.recordSkillActivity('auscultation', currentAccuracy);
        }
    }

    function nextCase() {
        if (state.queueIndex + 1 < state.queue.length) {
            loadCase(state.queueIndex + 1);
        } else {
            // Recommencer une nouvelle session mélangée
            startNewSession();
        }
    }

    function updateStatsDisplay() {
        const accuracy = state.stats.total > 0 ? Math.round((state.stats.correct / state.stats.total) * 100) : 0;
        const sens = state.stats.abnormalTotal > 0 ? Math.round((state.stats.abnormalCorrect / state.stats.abnormalTotal) * 100) : 0;
        const spec = state.stats.normalTotal > 0 ? Math.round((state.stats.normalCorrect / state.stats.normalTotal) * 100) : 0;

        if (dom.statAccuracy) dom.statAccuracy.textContent = `${accuracy}%`;
        if (dom.statCount) dom.statCount.textContent = `${state.stats.correct} / ${state.stats.total}`;
        if (dom.statSensitivity) dom.statSensitivity.textContent = `${sens}%`;
        if (dom.statSpecificity) dom.statSpecificity.textContent = `${spec}%`;
    }

    function renderMarkersBar(annotations) {
        if (!dom.markersBar) return;
        dom.markersBar.innerHTML = '';

        if (!annotations || (!annotations.s1?.length && !annotations.s2?.length)) {
            dom.markersBar.innerHTML = '<span class="pcg-marker-legend">Repères B1/B2 en attente</span>';
            return;
        }

        // Calculer la durée totale couverte par les annotations
        let maxTime = 10.0;
        if (annotations.s1 && annotations.s1.length > 0) {
            maxTime = Math.max(maxTime, annotations.s1[annotations.s1.length - 1][1]);
        }
        if (annotations.s2 && annotations.s2.length > 0) {
            maxTime = Math.max(maxTime, annotations.s2[annotations.s2.length - 1][1]);
        }

        // Afficher un repère visuel d'explication
        const legend = document.createElement('div');
        legend.className = 'pcg-marker-legend';
        legend.innerHTML = '<span class="pill-b1">B1 (S1)</span> <span class="pill-b2">B2 (S2)</span>';
        dom.markersBar.appendChild(legend);

        // Conteneur de timeline relative
        const track = document.createElement('div');
        track.className = 'pcg-markers-track';

        // Placer les segments S1 (bleu) et S2 (vert)
        const s1List = annotations.s1 || [];
        s1List.forEach(seg => {
            const leftPct = (seg[0] / maxTime) * 100;
            const widthPct = Math.max(0.6, ((seg[1] - seg[0]) / maxTime) * 100);
            const el = document.createElement('div');
            el.className = 'pcg-marker s1';
            el.style.left = `${leftPct}%`;
            el.style.width = `${widthPct}%`;
            el.title = `B1: ${seg[0]}s - ${seg[1]}s`;
            track.appendChild(el);
        });

        const s2List = annotations.s2 || [];
        s2List.forEach(seg => {
            const leftPct = (seg[0] / maxTime) * 100;
            const widthPct = Math.max(0.6, ((seg[1] - seg[0]) / maxTime) * 100);
            const el = document.createElement('div');
            el.className = 'pcg-marker s2';
            el.style.left = `${leftPct}%`;
            el.style.width = `${widthPct}%`;
            el.title = `B2: ${seg[0]}s - ${seg[1]}s`;
            track.appendChild(el);
        });

        dom.markersBar.appendChild(track);
    }

    function resizeCanvas() {
        if (!dom.canvas) return;
        const rect = dom.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        dom.canvas.width = Math.floor(rect.width * dpr);
        dom.canvas.height = Math.floor((rect.height || 140) * dpr);
        dom.canvas.style.width = `${rect.width}px`;
        dom.canvas.style.height = `${rect.height || 140}px`;
    }

    function startPhonoAnimation() {
        if (state.phonoAnimId) {
            cancelAnimationFrame(state.phonoAnimId);
        }

        const canvas = dom.canvas;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        function draw() {
            state.phonoAnimId = requestAnimationFrame(draw);
            const w = canvas.width;
            const h = canvas.height;

            // Effacer l'écran avec fondu
            ctx.fillStyle = '#060913';
            ctx.fillRect(0, 0, w, h);

            // Grille phonocardiographique subtile (type papier millimétré sombre)
            ctx.strokeStyle = 'rgba(0, 242, 254, 0.08)';
            ctx.lineWidth = 1;
            const step = Math.floor(h / 6);
            for (let y = step; y < h; y += step) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }

            // Ligne isoélectrique centrale
            const midY = h / 2;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.beginPath();
            ctx.moveTo(0, midY);
            ctx.lineTo(w, midY);
            ctx.stroke();

            // Forme d'onde dynamique
            const analyser = state.audioEngine?.analyserNode;
            if (analyser && state.isPlaying) {
                const bufferLength = analyser.fftSize;
                const dataArray = new Uint8Array(bufferLength);
                analyser.getByteTimeDomainData(dataArray);

                ctx.lineWidth = 2;
                ctx.strokeStyle = '#00f2fe';
                ctx.shadowColor = 'rgba(0, 242, 254, 0.6)';
                ctx.shadowBlur = 8;
                ctx.beginPath();

                const sliceWidth = w / bufferLength;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = v * (h / 2);
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                    x += sliceWidth;
                }
                ctx.stroke();
                ctx.shadowBlur = 0;
            } else {
                // Signal calme au repos
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
                ctx.beginPath();
                ctx.moveTo(0, midY);
                ctx.lineTo(w, midY);
                ctx.stroke();
            }
        }

        draw();
    }

    return {
        init,
        loadCase,
        playAudio,
        stopAudio,
        submitAnswer,
        nextCase,
        getState: () => state
    };
})();

if (typeof window !== 'undefined') {
    window.PCGTrainer = PCGTrainer;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PCGTrainer };
}
