/**
 * js/ventilateur-ui.js — Contrôleur UI et rendu temps réel du Respirateur
 */

import {
    calculateVentMechanics,
    sampleVentilatorWaveforms,
    VENT_PRESETS,
    VENT_MODES
} from './ventilateur-engine.js';

document.addEventListener('DOMContentLoaded', () => {
    // État courant
    let currentPatient = { ...VENT_PRESETS.NORMAL };
    let currentSettings = {
        vt: 450,
        fr: 15,
        peep: 5,
        fio2: 40,
        ieRatio: 0.5,
        pauseInsp: 0.2
    };
    let currentMode = VENT_MODES.VAC;
    let currentMechanics = calculateVentMechanics(currentSettings, currentPatient, currentMode);

    // Canvas
    const canvas = document.getElementById('vent-waves-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Adapter résolution écran
    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * (window.devicePixelRatio || 1);
        canvas.height = rect.height * (window.devicePixelRatio || 1);
        ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Éléments DOM des contrôles
    const inputVt = document.getElementById('range-vt');
    const inputFr = document.getElementById('range-fr');
    const inputPeep = document.getElementById('range-peep');
    const inputFio2 = document.getElementById('range-fio2');
    const selectIe = document.getElementById('select-ie');

    const valVt = document.getElementById('val-vt');
    const valFr = document.getElementById('val-fr');
    const valPeep = document.getElementById('val-peep');
    const valFio2 = document.getElementById('val-fio2');

    // Télémétrie
    const elPpeak = document.getElementById('tel-ppeak');
    const elPplat = document.getElementById('tel-pplat');
    const elDriving = document.getElementById('tel-driving');
    const elAutopeep = document.getElementById('tel-autopeep');
    const elVte = document.getElementById('tel-vte');
    const elVe = document.getElementById('tel-ve');
    const elCompl = document.getElementById('tel-compliance');
    const elResist = document.getElementById('tel-resistance');
    const alertsBox = document.getElementById('vent-alerts-box');

    function updateMechanics() {
        currentMechanics = calculateVentMechanics(currentSettings, currentPatient, currentMode);

        // Mettre à jour l'affichage numérique
        if (elPpeak) elPpeak.textContent = currentMechanics.pPeak.toFixed(0);
        if (elPplat) elPplat.textContent = currentMechanics.pPlat.toFixed(0);
        if (elDriving) elDriving.textContent = currentMechanics.drivingPressure.toFixed(0);
        if (elAutopeep) elAutopeep.textContent = currentMechanics.autoPeep.toFixed(1);
        if (elVte) elVte.textContent = currentMechanics.vtMl;
        if (elVe) elVe.textContent = currentMechanics.minuteVolume.toFixed(1);
        if (elCompl) elCompl.textContent = currentMechanics.compliance.toFixed(0);
        if (elResist) elResist.textContent = currentMechanics.resistance.toFixed(0);

        // Mettre en évidence les boîtes d'alerte
        const boxPplat = elPplat?.closest('.vital-box');
        if (boxPplat) {
            boxPplat.className = 'vital-box ' + (currentMechanics.pPlat > 30 ? 'alert-danger' : '');
        }
        const boxPpeak = elPpeak?.closest('.vital-box');
        if (boxPpeak) {
            boxPpeak.className = 'vital-box ' + (currentMechanics.pPeak > 35 ? 'alert-warn' : '');
        }

        // Alertes textuelles
        if (alertsBox) {
            alertsBox.innerHTML = '';
            currentMechanics.alerts.forEach(a => {
                const chip = document.createElement('div');
                chip.className = `vent-alert-chip ${a.type}`;
                chip.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <span>${a.msg}</span>`;
                alertsBox.appendChild(chip);
            });
        }
    }

    // Gestionnaires de curseurs
    if (inputVt) {
        inputVt.addEventListener('input', (e) => {
            currentSettings.vt = parseInt(e.target.value, 10);
            if (valVt) valVt.textContent = `${currentSettings.vt} mL (${(currentSettings.vt / currentPatient.pbw).toFixed(1)} mL/kg)`;
            updateMechanics();
        });
    }

    if (inputFr) {
        inputFr.addEventListener('input', (e) => {
            currentSettings.fr = parseInt(e.target.value, 10);
            if (valFr) valFr.textContent = `${currentSettings.fr} /min`;
            updateMechanics();
        });
    }

    if (inputPeep) {
        inputPeep.addEventListener('input', (e) => {
            currentSettings.peep = parseInt(e.target.value, 10);
            if (valPeep) valPeep.textContent = `${currentSettings.peep} cmH2O`;
            updateMechanics();
        });
    }

    if (inputFio2) {
        inputFio2.addEventListener('input', (e) => {
            currentSettings.fio2 = parseInt(e.target.value, 10);
            if (valFio2) valFio2.textContent = `${currentSettings.fio2} %`;
            updateMechanics();
        });
    }

    if (selectIe) {
        selectIe.addEventListener('change', (e) => {
            currentSettings.ieRatio = parseFloat(e.target.value);
            updateMechanics();
        });
    }

    // Presets
    document.querySelectorAll('.preset-chip[data-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.preset-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const key = btn.dataset.preset.toUpperCase();
            if (VENT_PRESETS[key]) {
                currentPatient = { ...VENT_PRESETS[key] };
                if (key === 'ARDS') {
                    currentSettings.vt = 420;
                    currentSettings.peep = 12;
                    currentSettings.fio2 = 70;
                } else if (key === 'ASTHMA') {
                    currentSettings.vt = 450;
                    currentSettings.fr = 12;
                    currentSettings.ieRatio = 0.25; // 1:4 pour allonger le temps expiatoire
                    currentSettings.peep = 5;
                } else {
                    currentSettings.vt = 450;
                    currentSettings.fr = 15;
                    currentSettings.peep = 5;
                    currentSettings.fio2 = 40;
                    currentSettings.ieRatio = 0.5;
                }

                // MàJ des inputs
                if (inputVt) inputVt.value = currentSettings.vt;
                if (inputFr) inputFr.value = currentSettings.fr;
                if (inputPeep) inputPeep.value = currentSettings.peep;
                if (inputFio2) inputFio2.value = currentSettings.fio2;
                if (selectIe) selectIe.value = currentSettings.ieRatio;

                if (valVt) valVt.textContent = `${currentSettings.vt} mL`;
                if (valFr) valFr.textContent = `${currentSettings.fr} /min`;
                if (valPeep) valPeep.textContent = `${currentSettings.peep} cmH2O`;
                if (valFio2) valFio2.textContent = `${currentSettings.fio2} %`;

                updateMechanics();
            }
        });
    });

    // Boucle de rendu Canvas des 3 courbes (Pression, Débit, Volume)
    let startTime = performance.now();
    const WINDOW_DURATION = 6.0; // secondes visibles sur le scope

    function renderWaves() {
        const now = performance.now();
        const elapsed = (now - startTime) / 1000;

        const rect = canvas.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;

        ctx.clearRect(0, 0, w, h);

        // Grille d'oscilloscope
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.07)';
        ctx.lineWidth = 1;
        const gridX = 40;
        const gridY = 30;
        for (let x = 0; x < w; x += gridX) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += gridY) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // 3 canaux :
        // Canal 1 : Pression (0 à h*0.33) en Jaune/Orange
        // Canal 2 : Débit (h*0.34 à h*0.66) en Vert/Cyan
        // Canal 3 : Volume (h*0.67 à h) en Bleu

        const h1 = h * 0.33;
        const h2 = h * 0.66;
        const h3 = h;

        // Lignes séparatrices
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, h1); ctx.lineTo(w, h1);
        ctx.moveTo(0, h2); ctx.lineTo(w, h2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Labels des canaux
        ctx.font = '600 11px Inter, sans-serif';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText('Paw (cmH2O)', 10, 18);
        ctx.fillStyle = '#2ecc71';
        ctx.fillText('Débit (L/s)', 10, h1 + 18);
        ctx.fillStyle = '#3498db';
        ctx.fillText('Volume (mL)', 10, h2 + 18);

        // Ligne de balayage (sweep bar)
        const sweepProgress = (elapsed % WINDOW_DURATION) / WINDOW_DURATION;
        const sweepX = sweepProgress * w;

        // Tracé des courbes
        const numPoints = Math.floor(w);
        
        // Pression
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < numPoints; x += 2) {
            if (Math.abs(x - sweepX) < 8) continue; // Masquer autour du balayage
            const tPoint = elapsed - (sweepX - x) / w * WINDOW_DURATION;
            const sample = sampleVentilatorWaveforms(tPoint, currentMechanics);
            // Pression 0 à 45 cmH2O -> h1 à 10
            const y = h1 - (sample.pressure / 45) * (h1 - 25);
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Débit (zéro au milieu de h1 et h2)
        const flowZeroY = h1 + (h2 - h1) / 2;
        ctx.strokeStyle = '#2ecc71';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < numPoints; x += 2) {
            if (Math.abs(x - sweepX) < 8) continue;
            const tPoint = elapsed - (sweepX - x) / w * WINDOW_DURATION;
            const sample = sampleVentilatorWaveforms(tPoint, currentMechanics);
            // Débit -1.5 à +1.5 L/s
            const y = flowZeroY - (sample.flow / 1.5) * ((h2 - h1) * 0.4);
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Volume (0 à 800 mL)
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < numPoints; x += 2) {
            if (Math.abs(x - sweepX) < 8) continue;
            const tPoint = elapsed - (sweepX - x) / w * WINDOW_DURATION;
            const sample = sampleVentilatorWaveforms(tPoint, currentMechanics);
            const y = h3 - 10 - (sample.volume / 800) * (h3 - h2 - 25);
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Dessiner le curseur de balayage vert vertical
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sweepX, 0);
        ctx.lineTo(sweepX, h);
        ctx.stroke();

        requestAnimationFrame(renderWaves);
    }

    updateMechanics();
    requestAnimationFrame(renderWaves);

    // Initialisation badges si système présent
    if (window.BadgeSystem) {
        window.BadgeSystem.recordSkillActivity('ventilateur', 100);
    }
});
