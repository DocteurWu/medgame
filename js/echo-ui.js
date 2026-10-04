/**
 * js/echo-ui.js — Rendu procédural ultrasonore et contrôleur POCUS / FAST-Echo
 */

import {
    ECHO_WINDOWS,
    ECHO_WINDOW_INFO,
    ECHO_CASES,
    evaluateEchoSignal
} from './echo-engine.js';

document.addEventListener('DOMContentLoaded', () => {
    // État actif
    let activeWindow = ECHO_WINDOWS.MORRISON;
    let isFrozen = false;
    let displayMode = 'B'; // 'B' ou 'M'
    let currentGain = 50;
    let currentDepth = 12;
    let activeCaseIndex = 0;

    // Canvas
    const canvas = document.getElementById('echo-screen-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * (window.devicePixelRatio || 1);
        canvas.height = rect.height * (window.devicePixelRatio || 1);
        ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Éléments DOM
    const elWindowName = document.getElementById('echo-window-name');
    const elProbeName = document.getElementById('echo-probe-name');
    const elGainVal = document.getElementById('echo-gain-val');
    const elDepthVal = document.getElementById('echo-depth-val');
    const rangeGain = document.getElementById('range-echo-gain');
    const rangeDepth = document.getElementById('range-echo-depth');
    const btnFreeze = document.getElementById('btn-echo-freeze');
    const btnModeB = document.getElementById('btn-mode-b');
    const btnModeM = document.getElementById('btn-mode-m');
    const findingBox = document.getElementById('echo-finding-desc');

    // Cas Clinique
    const caseSelectRow = document.getElementById('echo-cases-row');
    const caseTitle = document.getElementById('case-title');
    const caseHistory = document.getElementById('case-history');
    const caseQuestion = document.getElementById('case-question');
    const caseOptionsList = document.getElementById('case-options-list');
    const caseFeedback = document.getElementById('case-feedback');

    function getActiveCase() {
        return ECHO_CASES[activeCaseIndex] || ECHO_CASES[0];
    }

    function updateWindowDetails() {
        const info = ECHO_WINDOW_INFO[activeWindow];
        const c = getActiveCase();
        const finding = c.findings[activeWindow];

        if (elWindowName) elWindowName.textContent = info.name.toUpperCase();
        if (elProbeName) elProbeName.textContent = `Sonde : ${info.probe}`;

        // Mettre en surbrillance le spot sur le torse
        document.querySelectorAll('.pocus-target-spot').forEach(spot => {
            spot.classList.toggle('active', spot.dataset.window === activeWindow);
        });

        // Afficher l'interprétation
        if (findingBox) {
            if (finding?.effusion || (finding?.sliding === false)) {
                findingBox.className = 'finding-banner positive';
                findingBox.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <div><strong>ANOMALIE DÉTECTÉE :</strong> ${finding.desc}</div>`;
            } else {
                findingBox.className = 'finding-banner normal';
                findingBox.innerHTML = `<i class="fas fa-check-circle"></i> <div><strong>Aspect Normal :</strong> ${finding?.desc || info.normalFinding}</div>`;
            }
        }
    }

    // Gestion des spots sur le torse
    document.querySelectorAll('.pocus-target-spot').forEach(spot => {
        spot.addEventListener('click', () => {
            activeWindow = spot.dataset.window;
            updateWindowDetails();
        });
    });

    // Réglages Gain / Profondeur
    if (rangeGain) {
        rangeGain.addEventListener('input', (e) => {
            currentGain = parseInt(e.target.value, 10);
            if (elGainVal) elGainVal.textContent = `${currentGain} %`;
        });
    }

    if (rangeDepth) {
        rangeDepth.addEventListener('input', (e) => {
            currentDepth = parseInt(e.target.value, 10);
            if (elDepthVal) elDepthVal.textContent = `${currentDepth} cm`;
        });
    }

    if (btnFreeze) {
        btnFreeze.addEventListener('click', () => {
            isFrozen = !isFrozen;
            btnFreeze.classList.toggle('active', isFrozen);
            btnFreeze.innerHTML = isFrozen ? '<i class="fas fa-play"></i> DÉGELER' : '<i class="fas fa-snowflake"></i> FREEZE';
        });
    }

    if (btnModeB) {
        btnModeB.addEventListener('click', () => {
            displayMode = 'B';
            btnModeB.classList.add('active');
            if (btnModeM) btnModeM.classList.remove('active');
        });
    }

    if (btnModeM) {
        btnModeM.addEventListener('click', () => {
            displayMode = 'M';
            btnModeM.classList.add('active');
            if (btnModeB) btnModeB.classList.remove('active');
        });
    }

    // Rendu Ultrasonore en Canvas (procédural réaliste)
    let animFrameId = null;
    let t = 0;

    function renderUltrasound() {
        if (!isFrozen) t += 0.04;

        const rect = canvas.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;

        ctx.fillStyle = '#000206';
        ctx.fillRect(0, 0, w, h);

        const c = getActiveCase();
        const finding = c.findings[activeWindow];
        const gainFactor = currentGain / 50;

        if (displayMode === 'M' && activeWindow === 'lung') {
            // Rendu Mode M (Temps-Mouvement) pour le poumon
            renderLungModeM(w, h, finding?.sliding !== false);
        } else {
            // Rendu Mode B (Secteur ultrasonore avec grain et structures anatomiques)
            renderBModeSector(w, h, activeWindow, finding, gainFactor);
        }

        // Grille et échelle de profondeur latérale (cm)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '600 10px monospace';
        for (let d = 2; d <= currentDepth; d += 2) {
            const y = (d / currentDepth) * (h - 40) + 20;
            ctx.fillRect(w - 15, y, 8, 1.5);
            ctx.fillText(`${d}`, w - 28, y + 3);
        }

        // Indicateurs techniques à l'écran
        ctx.fillStyle = '#00f2fe';
        ctx.font = '600 11px Outfit, sans-serif';
        ctx.fillText(`POCUS • ${activeWindow.toUpperCase()}`, 15, 20);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(`GAIN: ${currentGain}% | PROF: ${currentDepth}cm | MI: 1.1`, 15, 36);

        if (isFrozen) {
            ctx.fillStyle = '#ffd700';
            ctx.font = '800 14px Outfit, sans-serif';
            ctx.fillText('[IMAGE GELÉE - FREEZE]', w / 2 - 80, 25);
        }

        animFrameId = requestAnimationFrame(renderUltrasound);
    }

    // Dessin du cône sectoriel et des structures anatomiques
    function renderBModeSector(w, h, windowType, finding, gain) {
        const cx = w / 2;
        const cy = 20;
        const maxRadius = Math.min(w * 0.7, h - 30);

        ctx.save();
        // Créer un masque de faisceau conique
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxRadius, Math.PI * 0.25, Math.PI * 0.75);
        ctx.closePath();
        ctx.clip();

        // 1. Fond acoustique avec grain ultrasonore (Speckle Noise)
        const grainCount = 350;
        ctx.fillStyle = `rgba(180, 200, 220, ${0.12 * gain})`;
        for (let i = 0; i < grainCount; i++) {
            const rx = cx + (Math.random() - 0.5) * maxRadius * 1.3;
            const ry = cy + Math.random() * maxRadius;
            ctx.fillRect(rx, ry, 2, 2);
        }

        // 2. Rendu spécifique par fenêtre
        if (windowType === 'morrison') {
            // Foie (lobe supérieur) + Rein droit (ovale avec cortex et hile)
            // Foie hyperéchogène
            ctx.fillStyle = `rgba(140, 160, 180, ${0.4 * gain})`;
            ctx.beginPath();
            ctx.ellipse(cx - 30, cy + 120, 110, 70, 0.2, 0, Math.PI * 2);
            ctx.fill();

            // Rein droit (ovale inférieur)
            ctx.strokeStyle = `rgba(220, 230, 240, ${0.7 * gain})`;
            ctx.lineWidth = 3;
            ctx.fillStyle = `rgba(40, 50, 70, ${0.5 * gain})`;
            ctx.beginPath();
            ctx.ellipse(cx + 40, cy + 220, 75, 45, -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Hile rénal central
            ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * gain})`;
            ctx.beginPath();
            ctx.ellipse(cx + 40, cy + 220, 30, 15, -0.3, 0, Math.PI * 2);
            ctx.fill();

            // Épanchement anéchogène dans le récessus de Morrison (si présent)
            if (finding?.effusion) {
                ctx.fillStyle = '#000000'; // Noir anéchogène
                ctx.beginPath();
                ctx.moveTo(cx - 30, cy + 160);
                ctx.quadraticCurveTo(cx + 10, cy + 180 + Math.sin(t) * 2, cx + 80, cy + 185);
                ctx.lineTo(cx + 70, cy + 205);
                ctx.quadraticCurveTo(cx + 10, cy + 195, cx - 25, cy + 180);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(0, 242, 254, 0.6)';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Annotation
                ctx.fillStyle = '#00f2fe';
                ctx.font = '700 11px Inter';
                ctx.fillText('← Épanchement (Hémopéritoine)', cx + 40, cy + 175);
            }
        } else if (windowType === 'subxiphoid') {
            // Cœur 4 cavités battant
            const beat = (Math.sin(t * 4) + 1) * 0.5; // Contraction systole/diastole
            const cardiacScale = 1.0 - (beat * 0.12);

            // Foie gauche au premier plan
            ctx.fillStyle = `rgba(130, 150, 170, ${0.35 * gain})`;
            ctx.beginPath();
            ctx.arc(cx, cy + 40, 90, 0, Math.PI);
            ctx.fill();

            // Péricarde et myocarde ventriculaire
            ctx.save();
            ctx.translate(cx, cy + 200);
            ctx.scale(cardiacScale, cardiacScale);

            // Ventricule gauche
            ctx.fillStyle = '#050a15';
            ctx.strokeStyle = `rgba(200, 220, 240, ${0.8 * gain})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(30, 0, 50, 65, 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Ventricule droit
            ctx.beginPath();
            ctx.ellipse(-35, -10, 45, 50, -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.restore();

            // Épanchement péricardique (halo noir anéchogène circonférentiel)
            if (finding?.effusion) {
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 22; // Épanchement abondant
                ctx.beginPath();
                ctx.ellipse(cx, cy + 200, 95, 80, 0, 0, Math.PI * 2);
                ctx.stroke();

                ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = '#ff7675';
                ctx.font = '700 11px Inter';
                ctx.fillText('Épanchement péricardique (Tamponnade)', cx - 100, cy + 105);
            }
        } else if (windowType === 'lung') {
            // Poumon : côtes (ombres) + ligne pleurale
            const ribY = cy + 120;
            // Côte 1 gauche
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(cx - 100, ribY, 22, 0, Math.PI);
            ctx.fill();
            // Ombre acoustique
            ctx.fillStyle = '#000000';
            ctx.fillRect(cx - 122, ribY, 44, h);

            // Côte 2 droite
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(cx + 100, ribY, 22, 0, Math.PI);
            ctx.fill();
            ctx.fillRect(cx + 78, ribY, 44, h);

            // Ligne pleurale entre les deux côtes
            const pleuraY = ribY + 12;
            const slidingShimmer = finding?.sliding !== false ? Math.sin(t * 8) * 3 : 0;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(cx - 75, pleuraY);
            ctx.lineTo(cx + 75, pleuraY);
            ctx.stroke();

            // Lignes A de répétition
            for (let a = 1; a <= 2; a++) {
                const ay = pleuraY + (a * 70);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(cx - 75, ay);
                ctx.lineTo(cx + 75, ay);
                ctx.stroke();
            }

            ctx.fillStyle = '#00f2fe';
            ctx.font = '700 11px Inter';
            ctx.fillText('Ligne pleurale', cx - 40, pleuraY - 8);
        } else {
            // Vue générique (Rate ou Pelvis)
            ctx.fillStyle = `rgba(100, 130, 160, ${0.4 * gain})`;
            ctx.beginPath();
            ctx.arc(cx, cy + 180, 100, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    // Dessin Mode M pulmonaire (Rivage vs Code-barres)
    function renderLungModeM(w, h, isNormalSliding) {
        // Demi supérieur : repère anatomique
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(0, 0, w, 120);
        ctx.fillStyle = '#00f2fe';
        ctx.font = '600 11px Inter';
        ctx.fillText('MODE M : Analyse du glissement pleural sous la ligne d\'exploration', 20, 25);

        // Demi inférieur : tracé M-mode défilant
        const splitY = 120;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, splitY);
        ctx.lineTo(w, splitY);
        ctx.stroke();

        if (isNormalSliding) {
            // Signe du rivage (Seashore sign) : lignes droites au-dessus de la plèvre + grain sablonneux dessous
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.font = '700 13px Outfit';
            ctx.fillText('SIGNE DU RIVAGE (SEASHORE SIGN) — Normal', 20, splitY + 25);

            // Grain de sable en dessous
            ctx.fillStyle = 'rgba(200, 220, 255, 0.2)';
            for (let i = 0; i < 400; i++) {
                const sx = Math.random() * w;
                const sy = splitY + 40 + Math.random() * (h - splitY - 40);
                ctx.fillRect(sx, sy, 2, 2);
            }
        } else {
            // Signe du code-barres / stratosphère (Barcode sign) : lignes horizontales parallèles continues
            ctx.fillStyle = '#ff7675';
            ctx.font = '700 13px Outfit';
            ctx.fillText('SIGNE DU CODE-BARRES / STRATOSPHÈRE — PNEUMOTHORAX', 20, splitY + 25);

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.lineWidth = 1.5;
            for (let ly = splitY + 40; ly < h; ly += 10) {
                ctx.beginPath();
                ctx.moveTo(0, ly);
                ctx.lineTo(w, ly);
                ctx.stroke();
            }
        }
    }

    // Gestion des Cas Cliniques
    function renderCases() {
        if (!caseSelectRow) return;
        caseSelectRow.innerHTML = '';
        ECHO_CASES.forEach((c, idx) => {
            const btn = document.createElement('button');
            btn.className = `preset-chip ${idx === activeCaseIndex ? 'active' : ''}`;
            btn.textContent = `Cas ${idx + 1} : ${c.title.split(' ')[0]}`;
            btn.addEventListener('click', () => {
                activeCaseIndex = idx;
                loadCase(ECHO_CASES[idx]);
                renderCases();
            });
            caseSelectRow.appendChild(btn);
        });
    }

    function loadCase(c) {
        if (!c) return;
        activeWindow = c.correctWindow;
        updateWindowDetails();

        if (caseTitle) caseTitle.textContent = c.title;
        if (caseHistory) caseHistory.textContent = c.history;
        if (caseQuestion) caseQuestion.textContent = c.actionQuestion;
        if (caseFeedback) {
            caseFeedback.style.display = 'none';
            caseFeedback.innerHTML = '';
        }

        // Options de réponse
        if (caseOptionsList) {
            caseOptionsList.innerHTML = '';
            const allOptions = [
                { text: c.correctAction, isCorrect: true },
                ...c.distractors.map(d => ({ text: d, isCorrect: false }))
            ].sort(() => Math.random() - 0.5);

            allOptions.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'quiz-option-btn';
                btn.textContent = opt.text;
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.quiz-option-btn').forEach(b => b.disabled = true);
                    if (opt.isCorrect) {
                        btn.classList.add('correct');
                        if (caseFeedback) {
                            caseFeedback.style.display = 'block';
                            caseFeedback.className = 'finding-banner normal';
                            caseFeedback.innerHTML = `<i class="fas fa-check-circle"></i> <strong>Parfait !</strong> Prise en charge exacte et rapide.`;
                        }
                        if (window.BadgeSystem) {
                            window.BadgeSystem.recordSkillActivity('echo', 100);
                        }
                    } else {
                        btn.classList.add('wrong');
                        if (caseFeedback) {
                            caseFeedback.style.display = 'block';
                            caseFeedback.className = 'finding-banner positive';
                            caseFeedback.innerHTML = `<i class="fas fa-times-circle"></i> <strong>Erreur :</strong> ${c.correctAction}`;
                        }
                    }
                });
                caseOptionsList.appendChild(btn);
            });
        }
    }

    // Initialisation
    renderCases();
    loadCase(ECHO_CASES[0]);
    updateWindowDetails();
    animFrameId = requestAnimationFrame(renderUltrasound);
});
