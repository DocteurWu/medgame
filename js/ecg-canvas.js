/**
 * js/ecg-canvas.js — Moteur de rendu Canvas 2D pour ECG 12 Dérivations
 *
 * Étalonnage médical international standard :
 * - Vitesse de défilement : 25 mm/s (1 petit carreau d'1 mm = 40 ms ; 1 grand carreau de 5 mm = 200 ms)
 * - Étalonnage en amplitude : 10 mm/mV (1 petit carreau d'1 mm = 0.1 mV ; 1 grand carreau de 5 mm = 0.5 mV)
 *
 * Disposition 12 Dérivations :
 * - 4 colonnes x 3 lignes (DI-DII-DIII, aVR-aVL-aVF, V1-V2-V3, V4-V5-V6)
 * - 1 bande de rythme longue (DII long) en bas sur toute la largeur
 *
 * Outils interactifs :
 * - Réglette / Caliper de mesure temporelle (ms) et d'amplitude (mV)
 * - Calculateur instantané de Fréquence Cardiaque (FC)
 * - Loupe de zoom haute précision
 */

class ECGCanvasRenderer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.options = Object.assign({
            mmPx: 4, // 4 pixels = 1 mm standard (rétine/haute résolution possible)
            theme: 'classic', // 'classic' (papier rose) ou 'neon' (sombre MedGame)
            showGrid: true,
            showCaliper: false,
            caliperMode: 'time' // 'time', 'voltage' ou 'both'
        }, options);

        this.currentCase = null;
        this.timeOffset = 0;
        this.zoom = 1.0;

        // Caliper (coordonnées en pixels sur le canvas)
        this.caliper = {
            active: false,
            t1: 150,
            t2: 350,
            v1: 200,
            v2: 280,
            dragging: null // 't1', 't2', 'v1', 'v2'
        };

        this._setupEvents();
    }

    setCase(ecgCase) {
        this.currentCase = ecgCase;
        this.render();
    }

    setTheme(theme) {
        this.options.theme = theme;
        this.render();
    }

    toggleCaliper(enable) {
        this.caliper.active = (enable !== undefined) ? enable : !this.caliper.active;
        this.render();
        return this.caliper.active;
    }

    getCaliperMetrics() {
        if (!this.caliper.active) return null;
        const mmPx = this.options.mmPx * this.zoom;
        const deltaPxT = Math.abs(this.caliper.t2 - this.caliper.t1);
        const deltaPxV = Math.abs(this.caliper.v2 - this.caliper.v1);

        const deltaMmT = deltaPxT / mmPx;
        const deltaMmV = deltaPxV / mmPx;

        // 1 mm = 40 ms (à 25 mm/s)
        const durationMs = Math.round(deltaMmT * 40);
        // 1 mm = 0.1 mV (à 10 mm/mV)
        const voltageMv = +(deltaMmV * 0.1).toFixed(2);
        // FC estimée si intervalle R-R mesuré
        const estimatedHr = (durationMs > 100 && durationMs < 3000) ? Math.round(60000 / durationMs) : null;

        return {
            durationMs,
            voltageMv,
            estimatedHr,
            deltaMmT: +deltaMmT.toFixed(1),
            deltaMmV: +deltaMmV.toFixed(1)
        };
    }

    render() {
        if (!this.canvas) return;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        // 1. Fond et grille millimétrée
        this._drawGrid(ctx, w, h);

        // 2. Tracés ECG 12 dérivations
        if (this.currentCase) {
            this._drawECG(ctx, w, h);
        }

        // 3. Outil Caliper (Réglette de mesure)
        if (this.caliper.active) {
            this._drawCaliper(ctx, w, h);
        }
    }

    _drawGrid(ctx, w, h) {
        const mm = this.options.mmPx * this.zoom;
        const big = mm * 5; // 5 mm = grand carreau (0.2s / 0.5mV)

        const isClassic = this.options.theme === 'classic';
        const bg = isClassic ? '#fffdfb' : '#0d1117';
        const smallColor = isClassic ? 'rgba(255, 175, 160, 0.45)' : 'rgba(0, 242, 254, 0.12)';
        const bigColor = isClassic ? 'rgba(255, 110, 90, 0.85)' : 'rgba(0, 242, 254, 0.35)';

        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // Petits carreaux (1 mm)
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = smallColor;
        ctx.beginPath();
        for (let x = 0; x < w; x += mm) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
        }
        for (let y = 0; y < h; y += mm) {
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
        }
        ctx.stroke();

        // Grands carreaux (5 mm)
        ctx.lineWidth = 1.0;
        ctx.strokeStyle = bigColor;
        ctx.beginPath();
        for (let x = 0; x < w; x += big) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
        }
        for (let y = 0; y < h; y += big) {
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
        }
        ctx.stroke();
    }

    _drawECG(ctx, w, h) {
        const ecg = this.currentCase;
        const mm = this.options.mmPx * this.zoom;
        const traceColor = (this.options.theme === 'classic') ? '#0c1b33' : '#00f2fe';

        ctx.strokeStyle = traceColor;
        ctx.lineWidth = 1.5 * this.zoom;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Layout : 4 colonnes x 3 lignes pour le haut, + 1 bande DII long en bas
        const colWidth = w / 4;
        const topMargin = 32 * this.zoom;
        const topSectionHeight = h * 0.70 - topMargin;
        const leadRowHeight = topSectionHeight / 3;
        const rhythmHeight = h * 0.30;
        const rhythmY = h * 0.70 + rhythmHeight * 0.55;

        const leadMatrix = [
            ['DI', 'aVR', 'V1', 'V4'],
            ['DII', 'aVL', 'V2', 'V5'],
            ['DIII', 'aVF', 'V3', 'V6']
        ];

        // Dessiner chaque lead court (2.5 secondes = ~62.5 mm de tracé)
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 4; c++) {
                const leadName = leadMatrix[r][c];
                const startX = c * colWidth;
                const centerY = topMargin + r * leadRowHeight + leadRowHeight * 0.58;
                const leadData = ecg.morphology.leads[leadName] || {};

                // Libellé de la dérivation avec fond discret
                ctx.fillStyle = (this.options.theme === 'classic') ? '#c0392b' : '#ff7675';
                ctx.font = `bold ${Math.round(12 * this.zoom)}px 'Outfit', sans-serif`;
                ctx.fillText(leadName, startX + 10 * this.zoom, centerY - leadRowHeight * 0.44);

                // Étalon (pulse 1mV de 0.2s = 5mm x 10mm) au début de chaque colonne
                this._drawCalibrationPulse(ctx, startX + 12 * this.zoom, centerY, mm);

                // Tracé d'onde
                const traceStartX = startX + 28 * this.zoom;
                const traceWidth = colWidth - 32 * this.zoom;
                this._drawLeadTrace(ctx, traceStartX, centerY, traceWidth, mm, leadData, ecg, leadName);
            }
        }

        // Dessiner la bande de rythme DII Long (sur toute la largeur)
        ctx.fillStyle = (this.options.theme === 'classic') ? '#c0392b' : '#ff7675';
        ctx.font = `bold ${Math.round(13 * this.zoom)}px 'Outfit', sans-serif`;
        ctx.fillText('DII (Rythme Continu)', 12 * this.zoom, rhythmY - rhythmHeight * 0.36);

        this._drawCalibrationPulse(ctx, 12 * this.zoom, rhythmY, mm);
        const longStartX = 32 * this.zoom;
        const longWidth = w - 40 * this.zoom;
        const d2Data = ecg.morphology.leads['DII'] || {};
        this._drawLeadTrace(ctx, longStartX, rhythmY, longWidth, mm, d2Data, ecg, 'DII', true);

        // Séparateurs de colonnes
        ctx.strokeStyle = (this.options.theme === 'classic') ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        for (let c = 1; c < 4; c++) {
            ctx.beginPath();
            ctx.moveTo(c * colWidth, 0);
            ctx.lineTo(c * colWidth, h * 0.72);
            ctx.stroke();
        }
        // Séparateur bande de rythme
        ctx.beginPath();
        ctx.moveTo(0, h * 0.72);
        ctx.lineTo(w, h * 0.72);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    _drawCalibrationPulse(ctx, x, y, mm) {
        // Pulse 1 mV = 10 mm vers le haut, durée 0.2s = 5 mm
        const h1mV = 10 * mm;
        const wPulse = 5 * mm;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 1 * mm, y);
        ctx.lineTo(x + 1 * mm, y - h1mV);
        ctx.lineTo(x + 1 * mm + wPulse, y - h1mV);
        ctx.lineTo(x + 1 * mm + wPulse, y);
        ctx.lineTo(x + 2 * mm + wPulse, y);
        ctx.stroke();
    }

    _drawLeadTrace(ctx, startX, baselineY, width, mm, lead, ecg, leadName, isLong = false) {
        const hr = ecg.metrics.heartRate || 75;
        // 25 mm/s : 1 seconde = 25 mm. Cycle cardiaque en mm : (60 / HR) * 25 * mm
        const cycleMm = (60 / hr) * 25;
        const cyclePx = cycleMm * mm;

        ctx.beginPath();
        let first = true;

        const numCycles = Math.ceil(width / cyclePx) + 1;

        for (let i = 0; i < numCycles; i++) {
            let cycleStartX = startX + i * cyclePx;
            if (ecg.morphology.irregularity) {
                // Irregularité aléatoire mais déterministe pour FA
                const jitter = (Math.sin(i * 12.3 + leadName.charCodeAt(0)) * 0.35) * cyclePx;
                cycleStartX += jitter;
            }

            // Générer les points du cycle cardiaque P - Q - R - S - ST - T
            this._generateCardiacCycle(ctx, cycleStartX, baselineY, cyclePx, mm, lead, ecg, first);
            first = false;
        }

        ctx.stroke();
    }

    _generateCardiacCycle(ctx, startX, baseY, cyclePx, mm, lead, ecg, isFirst) {
        // Amplitude 1 mV = 10 mm * mm
        const mv = 10 * mm;
        const morph = ecg.morphology;

        // Paramètres de morphologie du cas
        const pAmp = (lead.p !== undefined ? lead.p : morph.pAmp) * mv;
        const qAmp = (lead.q !== undefined ? lead.q : -0.05) * mv;
        const rAmp = (lead.r !== undefined ? lead.r : 1.0) * mv;
        const sAmp = (lead.s !== undefined ? lead.s : -0.2) * mv;
        const stElev = (lead.st !== undefined ? lead.st : morph.stElev) * mv;
        const tAmp = (lead.t !== undefined ? lead.t : morph.tAmp) * mv;
        const pqDep = (lead.pq !== undefined ? lead.pq : 0) * mv;

        const pDur = (morph.pDur || 0.08) * 25 * mm;
        const prDur = (morph.prDur || 0.16) * 25 * mm;
        const qrsDur = (morph.qrsDur || 0.085) * 25 * mm;
        const tDur = (morph.tDur || 0.18) * 25 * mm;

        let x = startX;

        if (isFirst) {
            ctx.moveTo(x, baseY);
        } else {
            ctx.lineTo(x, baseY);
        }

        // Cas spécial Flutter (Ondes en dents de scie F)
        if (morph.isFlutter) {
            const fCyclePx = (60 / 300) * 25 * mm; // 300 bpm
            for (let fx = 0; fx < cyclePx; fx += fCyclePx) {
                ctx.lineTo(x + fx + fCyclePx * 0.6, baseY - 0.25 * mv * (lead.t < 0 ? -1 : 1));
                ctx.lineTo(x + fx + fCyclePx, baseY);
            }
        }

        // Cas spécial Fibrillation atriale (trémulation de base)
        if (morph.isAfib) {
            for (let step = 0; step < prDur; step += 3 * mm) {
                const noise = (Math.sin(step * 15 + x) * 0.04) * mv;
                ctx.lineTo(x + step, baseY + noise);
            }
        } else if (!morph.isVt && !morph.isTorsades) {
            // 1. Onde P normale
            const pCenter = x + pDur / 2;
            ctx.quadraticCurveTo(pCenter, baseY - pAmp, x + pDur, baseY);

            // Segment PR / PQ (avec possible sous-décalage en péricardite)
            ctx.lineTo(x + prDur, baseY - pqDep);
        }

        x += prDur;

        // 2. Complexe QRS
        if (morph.isVt) {
            // QRS large bizarre de tachycardie ventriculaire
            ctx.bezierCurveTo(
                x + qrsDur * 0.3, baseY - rAmp * 0.8,
                x + qrsDur * 0.6, baseY - rAmp * 1.2,
                x + qrsDur, baseY + sAmp
            );
        } else if (morph.isTorsades) {
            // Torsade polymorphe
            const envelope = Math.sin(startX * 0.015) * 1.5;
            ctx.lineTo(x + qrsDur * 0.3, baseY - rAmp * envelope);
            ctx.lineTo(x + qrsDur * 0.7, baseY + rAmp * envelope);
            ctx.lineTo(x + qrsDur, baseY);
        } else if (morph.isLbbb) {
            // BBG : Onde R large encochée
            ctx.lineTo(x + qrsDur * 0.15, baseY - qAmp);
            ctx.lineTo(x + qrsDur * 0.45, baseY - rAmp * 0.9);
            ctx.lineTo(x + qrsDur * 0.60, baseY - rAmp * 0.75); // Encochure
            ctx.lineTo(x + qrsDur * 0.80, baseY - rAmp);
            ctx.lineTo(x + qrsDur, baseY - sAmp);
        } else {
            // QRS standard
            ctx.lineTo(x + qrsDur * 0.15, baseY - qAmp);
            ctx.lineTo(x + qrsDur * 0.45, baseY - rAmp);
            ctx.lineTo(x + qrsDur * 0.80, baseY - sAmp);
            ctx.lineTo(x + qrsDur, baseY + stElev);
        }

        x += qrsDur;

        // 3. Segment ST et Onde T
        const stEnd = x + 0.10 * 25 * mm;
        ctx.lineTo(stEnd, baseY + stElev);

        const tCenter = stEnd + tDur / 2;
        const tEnd = stEnd + tDur;

        if (morph.isHyperK) {
            // Onde T en tente très pointue et symétrique
            ctx.lineTo(tCenter, baseY - tAmp);
            ctx.lineTo(tEnd, baseY);
        } else {
            ctx.quadraticCurveTo(tCenter, baseY - tAmp + stElev * 0.5, tEnd, baseY);
        }

        ctx.lineTo(startX + cyclePx, baseY);
    }

    _drawCaliper(ctx, w, h) {
        const c = this.caliper;
        const color = '#ffd700'; // Or lumineux pour la réglette
        const metrics = this.getCaliperMetrics();

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.5;

        // Lignes verticales (Temps T1 et T2)
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(c.t1, 0);
        ctx.lineTo(c.t1, h);
        ctx.moveTo(c.t2, 0);
        ctx.lineTo(c.t2, h);
        ctx.stroke();

        // Ligne horizontale entre T1 et T2
        ctx.setLineDash([]);
        const midY = (c.v1 + c.v2) / 2;
        ctx.beginPath();
        ctx.moveTo(c.t1, midY);
        ctx.lineTo(c.t2, midY);
        // Flèches aux extrémités
        ctx.moveTo(c.t1 + 6, midY - 4);
        ctx.lineTo(c.t1, midY);
        ctx.lineTo(c.t1 + 6, midY + 4);
        ctx.moveTo(c.t2 - 6, midY - 4);
        ctx.lineTo(c.t2, midY);
        ctx.lineTo(c.t2 - 6, midY + 4);
        ctx.stroke();

        // Lignes horizontales (Voltage V1 et V2)
        ctx.strokeStyle = '#00f2fe';
        ctx.fillStyle = '#00f2fe';
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(0, c.v1);
        ctx.lineTo(w, c.v1);
        ctx.moveTo(0, c.v2);
        ctx.lineTo(w, c.v2);
        ctx.stroke();

        // Poignées interactives de saisie
        this._drawHandle(ctx, c.t1, midY, color);
        this._drawHandle(ctx, c.t2, midY, color);
        this._drawHandle(ctx, (c.t1 + c.t2) / 2, c.v1, '#00f2fe');
        this._drawHandle(ctx, (c.t1 + c.t2) / 2, c.v2, '#00f2fe');

        // Badge d'affichage des mesures en direct
        if (metrics) {
            const badgeX = Math.min(Math.max((c.t1 + c.t2) / 2, 90), w - 90);
            const badgeY = Math.max(midY - 30, 45);

            ctx.fillStyle = 'rgba(10, 15, 35, 0.92)';
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(badgeX - 85, badgeY - 22, 170, 44, 8);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 12px "Outfit", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`Δt = ${metrics.durationMs} ms (${metrics.deltaMmT} mm)`, badgeX, badgeY - 5);

            ctx.fillStyle = '#00f2fe';
            ctx.font = '11px "Inter", sans-serif';
            let extra = `ΔV = ${metrics.voltageMv} mV`;
            if (metrics.estimatedHr) {
                extra += ` • FC ≈ ${metrics.estimatedHr} bpm`;
            }
            ctx.fillText(extra, badgeX, badgeY + 12);
        }

        ctx.restore();
    }

    _drawHandle(ctx, x, y, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    _setupEvents() {
        const canvas = this.canvas;

        const getPos = (e) => {
            const r = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (clientX - r.left) * (canvas.width / r.width),
                y: (clientY - r.top) * (canvas.height / r.height)
            };
        };

        const onDown = (e) => {
            if (!this.caliper.active) return;
            const { x, y } = getPos(e);
            const threshold = 18;

            if (Math.abs(x - this.caliper.t1) < threshold) {
                this.caliper.dragging = 't1';
            } else if (Math.abs(x - this.caliper.t2) < threshold) {
                this.caliper.dragging = 't2';
            } else if (Math.abs(y - this.caliper.v1) < threshold) {
                this.caliper.dragging = 'v1';
            } else if (Math.abs(y - this.caliper.v2) < threshold) {
                this.caliper.dragging = 'v2';
            } else {
                // Placer le centre du caliper au clic
                const dt = Math.abs(this.caliper.t2 - this.caliper.t1) / 2;
                this.caliper.t1 = Math.max(10, x - dt);
                this.caliper.t2 = Math.min(canvas.width - 10, x + dt);
                this.caliper.dragging = 't2';
            }
            this.render();
            if (typeof this.onCaliperChange === 'function') this.onCaliperChange(this.getCaliperMetrics());
        };

        const onMove = (e) => {
            if (!this.caliper.active || !this.caliper.dragging) return;
            const { x, y } = getPos(e);

            if (this.caliper.dragging === 't1') this.caliper.t1 = Math.max(0, Math.min(x, this.caliper.t2 - 10));
            if (this.caliper.dragging === 't2') this.caliper.t2 = Math.min(canvas.width, Math.max(x, this.caliper.t1 + 10));
            if (this.caliper.dragging === 'v1') this.caliper.v1 = Math.max(0, Math.min(y, this.caliper.v2 - 10));
            if (this.caliper.dragging === 'v2') this.caliper.v2 = Math.min(canvas.height, Math.max(y, this.caliper.v1 + 10));

            this.render();
            if (typeof this.onCaliperChange === 'function') this.onCaliperChange(this.getCaliperMetrics());
        };

        const onUp = () => {
            this.caliper.dragging = null;
        };

        canvas.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);

        canvas.addEventListener('touchstart', onDown, { passive: true });
        window.addEventListener('touchmove', onMove, { passive: true });
        window.addEventListener('touchend', onUp);
    }
}

if (typeof window !== 'undefined') {
    window.ECGCanvasRenderer = ECGCanvasRenderer;
}
