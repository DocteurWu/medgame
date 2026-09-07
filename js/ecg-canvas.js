/**
 * js/ecg-canvas.js — Moteur de rendu Canvas 2D pour ECG 12 Dérivations
 *
 * Étalonnage médical international standard :
 * - Vitesse de défilement : 25 mm/s (1 petit carreau d'1 mm = 40 ms ; 1 grand carreau de 5 mm = 200 ms)
 * - Étalonnage en amplitude : 10 mm/mV (1 petit carreau d'1 mm = 0.1 mV ; 1 grand carreau de 5 mm = 0.5 mV)
 *
 * Architecture hybride :
 * - Signaux cliniques réels 12 dérivations (PhysioNet PTB-XL, CC-BY 4.0, 100 Hz)
 * - Moteur de synthèse morphologique vectorielle haute fidélité (fallback offline complet)
 *
 * Disposition 12 Dérivations :
 * - 4 colonnes x 3 lignes (DI-DII-DIII, aVR-aVL-aVF, V1-V2-V3, V4-V5-V6) à 2.5s chacune
 * - 1 bande de rythme continue (DII long 10s) en bas sur toute la largeur
 *
 * Outils interactifs :
 * - Réglette / Caliper de mesure temporelle (ms) et d'amplitude (mV)
 * - Calcul automatique de l'intervalle QTc corrigé selon la formule de Bazett (QT / √RR)
 * - Calculateur instantané de Fréquence Cardiaque (FC)
 * - Bascule thème papier millimétré classique (rose) / thème néon sombre
 */

class ECGCanvasRenderer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.options = Object.assign({
            mmPx: 4, // 4 pixels = 1 mm standard
            theme: 'classic', // 'classic' (papier rose) ou 'neon' (sombre MedGame)
            showGrid: true,
            showCaliper: false,
            caliperMode: 'both' // 'time', 'voltage' ou 'both'
        }, options);

        this.currentCase = null;
        this.currentSignal = null;
        this.signalCache = new Map();
        this.timeOffset = 0;
        this.zoom = 1.0;

        // Callbacks
        this.onSignalLoaded = null;
        this.onCaliperChange = null;

        // Caliper (coordonnées en pixels sur le canvas)
        this.caliper = {
            active: false,
            t1: 150,
            t2: 350,
            v1: 200,
            v2: 280,
            dragging: null // 't1', 't2', 'v1', 'v2'
        };

        if (this.canvas) {
            this._setupEvents();
        }
    }

    setCase(ecgCase) {
        this.currentCase = ecgCase;
        this.currentSignal = null;

        if (ecgCase && ecgCase.signalFile) {
            if (this.signalCache.has(ecgCase.signalFile)) {
                this.currentSignal = this.signalCache.get(ecgCase.signalFile);
                this.render();
                if (typeof this.onSignalLoaded === 'function') {
                    this.onSignalLoaded(this.currentSignal, ecgCase);
                }
            } else if (typeof fetch !== 'undefined') {
                fetch(ecgCase.signalFile)
                    .then(res => {
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        return res.json();
                    })
                    .then(signalData => {
                        this.signalCache.set(ecgCase.signalFile, signalData);
                        if (this.currentCase === ecgCase) {
                            this.currentSignal = signalData;
                            this.render();
                            if (typeof this.onSignalLoaded === 'function') {
                                this.onSignalLoaded(this.currentSignal, ecgCase);
                            }
                        }
                    })
                    .catch(err => {
                        console.warn('Real ECG signal fetch failed, fallback to synthesis:', err.message);
                        if (this.currentCase === ecgCase) {
                            this.currentSignal = null;
                            this.render();
                            if (typeof this.onSignalLoaded === 'function') {
                                this.onSignalLoaded(null, ecgCase);
                            }
                        }
                    });
            }
        } else {
            if (typeof this.onSignalLoaded === 'function') {
                this.onSignalLoaded(null, ecgCase);
            }
        }

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
        // FC estimée si intervalle R-R mesuré (150 ms à 3000 ms)
        const estimatedHr = (durationMs >= 150 && durationMs <= 3000) ? Math.round(60000 / durationMs) : null;

        // Calcul automatique QTc selon la formule de Bazett : QTc = QT / sqrt(RR_sec)
        let qtcBazett = null;
        const currentHr = this.currentCase?.metrics?.heartRate || (estimatedHr || 75);
        if (durationMs >= 180 && durationMs <= 750) {
            const rrSec = 60 / currentHr;
            qtcBazett = Math.round(durationMs / Math.sqrt(rrSec));
        }

        return {
            durationMs,
            voltageMv,
            estimatedHr,
            qtcBazett,
            deltaMmT: +deltaMmT.toFixed(1),
            deltaMmV: +deltaMmV.toFixed(1)
        };
    }

    render() {
        if (!this.canvas || !this.ctx) return;
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

        // Layout standard : 4 colonnes x 3 lignes (haut 70%), + 1 bande DII long (bas 30%)
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
                const leadData = (ecg.morphology && ecg.morphology.leads && ecg.morphology.leads[leadName]) || {};

                // Libellé de la dérivation avec fond discret
                ctx.fillStyle = (this.options.theme === 'classic') ? '#c0392b' : '#ff7675';
                ctx.font = `bold ${Math.round(12 * this.zoom)}px 'Outfit', sans-serif`;
                ctx.fillText(leadName, startX + 10 * this.zoom, centerY - leadRowHeight * 0.44);

                // Étalon (pulse 1mV de 0.2s = 5mm x 10mm) au début de chaque colonne
                this._drawCalibrationPulse(ctx, startX + 12 * this.zoom, centerY, mm);

                // Tracé d'onde
                const traceStartX = startX + 28 * this.zoom;
                const traceWidth = colWidth - 32 * this.zoom;
                this._drawLeadTrace(ctx, traceStartX, centerY, traceWidth, mm, leadData, ecg, leadName, false, c);
            }
        }

        // Dessiner la bande de rythme DII Long (sur toute la largeur, 10 secondes continues)
        ctx.fillStyle = (this.options.theme === 'classic') ? '#c0392b' : '#ff7675';
        ctx.font = `bold ${Math.round(13 * this.zoom)}px 'Outfit', sans-serif`;
        ctx.fillText('DII (Rythme Continu 10s)', 12 * this.zoom, rhythmY - rhythmHeight * 0.36);

        this._drawCalibrationPulse(ctx, 12 * this.zoom, rhythmY, mm);
        const longStartX = 32 * this.zoom;
        const longWidth = w - 40 * this.zoom;
        const d2Data = (ecg.morphology && ecg.morphology.leads && ecg.morphology.leads['DII']) || {};
        this._drawLeadTrace(ctx, longStartX, rhythmY, longWidth, mm, d2Data, ecg, 'DII', true, 0);

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

    _drawLeadTrace(ctx, startX, baselineY, width, mm, lead, ecg, leadName, isLong = false, colIndex = 0) {
        // 1. Branche Tracé Réel si disponible
        const realLeads = this.currentSignal && this.currentSignal.leads;
        const realSamples = realLeads && realLeads[leadName];
        if (realSamples && Array.isArray(realSamples) && realSamples.length > 0) {
            const sampleRate = this.currentSignal.sampleRate || 100;
            // 25 mm/s standard : 1 sample à 100 Hz = 0.01 s = 0.25 mm
            const dx = (25 / sampleRate) * mm;

            let startIdx = 0;
            let endIdx = realSamples.length;

            if (!isLong) {
                // 4 colonnes de 2.5 secondes chacune (250 échantillons à 100 Hz)
                const samplesPerCol = Math.round(2.5 * sampleRate);
                startIdx = colIndex * samplesPerCol;
                endIdx = Math.min(realSamples.length, startIdx + samplesPerCol);
            } else {
                startIdx = 0;
                endIdx = Math.min(realSamples.length, Math.round(10.0 * sampleRate));
            }

            ctx.beginPath();
            for (let i = startIdx; i < endIdx; i++) {
                const px = startX + (i - startIdx) * dx;
                if (px > startX + width) break;
                // Étalonnage en amplitude standard : 10 mm / mV
                const py = baselineY - (realSamples[i] * 10 * mm);
                if (i === startIdx) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }
            ctx.stroke();
            return;
        }

        // 2. Branche Synthèse Morphologique Vectorielle (Fallback offline de haute fidélité)
        const hr = (ecg.metrics && ecg.metrics.heartRate) || 75;
        // 25 mm/s : 1 seconde = 25 mm. Cycle cardiaque en mm : (60 / HR) * 25 * mm
        const cycleMm = (60 / hr) * 25;
        const cyclePx = cycleMm * mm;

        ctx.beginPath();
        let first = true;

        const numCycles = Math.ceil(width / cyclePx) + 1;

        for (let i = 0; i < numCycles; i++) {
            let cycleStartX = startX + i * cyclePx;
            const morph = ecg.morphology || {};

            if (morph.irregularity) {
                // Irregularité aléatoire mais déterministe pour FA / BAV
                const jitter = (Math.sin(i * 12.3 + leadName.charCodeAt(0)) * morph.irregularity) * cyclePx;
                cycleStartX += jitter;
            }

            // Générer les points du cycle cardiaque
            this._generateCardiacCycle(ctx, cycleStartX, baselineY, cyclePx, mm, lead, ecg, first, i);
            first = false;
        }

        ctx.stroke();
    }

    _generateCardiacCycle(ctx, startX, baseY, cyclePx, mm, lead, ecg, isFirst, cycleIndex = 0) {
        // Amplitude 1 mV = 10 mm * mm
        const mv = 10 * mm;
        const morph = ecg.morphology || {};

        // Paramètres de morphologie du cas
        const pAmp = (lead.p !== undefined ? lead.p : (morph.pAmp || 0.15)) * mv;
        const qAmp = (lead.q !== undefined ? lead.q : -0.05) * mv;
        const rAmp = (lead.r !== undefined ? lead.r : 1.0) * mv;
        const sAmp = (lead.s !== undefined ? lead.s : -0.2) * mv;
        const stElev = (lead.st !== undefined ? lead.st : (morph.stElev || 0)) * mv;
        const tAmp = (lead.t !== undefined ? lead.t : (morph.tAmp || 0.35)) * mv;
        const pqDep = (lead.pq !== undefined ? lead.pq : 0) * mv;

        const pDur = (morph.pDur || 0.08) * 25 * mm;
        let prDur = (morph.prDur || 0.16) * 25 * mm;

        // BAV 2 Mobitz 1 (Wenckebach) : allongement progressif du PR
        if (morph.isWenckebach) {
            const stepInCycle = cycleIndex % 4;
            if (stepInCycle === 3) {
                // Onde P bloquée sans QRS !
                let x = startX;
                if (isFirst) ctx.moveTo(x, baseY); else ctx.lineTo(x, baseY);
                ctx.quadraticCurveTo(x + pDur / 2, baseY - pAmp, x + pDur, baseY);
                ctx.lineTo(startX + cyclePx, baseY);
                return;
            }
            prDur += stepInCycle * 0.04 * 25 * mm;
        }

        const qrsDur = (morph.qrsDur || 0.085) * 25 * mm;
        const tDur = (morph.tDur || 0.18) * 25 * mm;

        let x = startX;

        if (isFirst) {
            ctx.moveTo(x, baseY);
        } else {
            ctx.lineTo(x, baseY);
        }

        // Cas spécial Flutter (Ondes en dents de scie F à 300 bpm)
        if (morph.isFlutter) {
            const fCyclePx = (60 / 300) * 25 * mm;
            for (let fx = 0; fx < cyclePx; fx += fCyclePx) {
                ctx.lineTo(x + fx + fCyclePx * 0.6, baseY - 0.25 * mv * (lead.t < 0 ? -1 : 1));
                ctx.lineTo(x + fx + fCyclePx, baseY);
            }
        }

        // Cas spécial Fibrillation atriale (trémulation de la ligne de base)
        if (morph.isAfib) {
            for (let step = 0; step < prDur; step += 3 * mm) {
                const noise = (Math.sin(step * 15 + x) * 0.04) * mv;
                ctx.lineTo(x + step, baseY + noise);
            }
        } else if (!morph.isVt && !morph.isTorsades) {
            // 1. Onde P
            const pCenter = x + pDur / 2;
            ctx.quadraticCurveTo(pCenter, baseY - pAmp, x + pDur, baseY);

            // Segment PR / PQ (avec possible sous-décalage en péricardite)
            ctx.lineTo(x + prDur, baseY - pqDep);
        }

        x += prDur;

        // 2. Complexe QRS
        if (morph.isVt) {
            // QRS large et empâté de tachycardie ventriculaire
            ctx.bezierCurveTo(
                x + qrsDur * 0.3, baseY - rAmp * 0.8,
                x + qrsDur * 0.6, baseY - rAmp * 1.2,
                x + qrsDur, baseY + sAmp
            );
        } else if (morph.isTorsades) {
            // Torsade polymorphe hélicoïdale
            const envelope = Math.sin(startX * 0.015) * 1.5;
            ctx.lineTo(x + qrsDur * 0.3, baseY - rAmp * envelope);
            ctx.lineTo(x + qrsDur * 0.7, baseY + rAmp * envelope);
            ctx.lineTo(x + qrsDur, baseY);
        } else if (morph.isLbbb) {
            // BBG : Onde R large encochée en plateau
            ctx.lineTo(x + qrsDur * 0.15, baseY - qAmp);
            ctx.lineTo(x + qrsDur * 0.45, baseY - rAmp * 0.9);
            ctx.lineTo(x + qrsDur * 0.60, baseY - rAmp * 0.75); // Encochure
            ctx.lineTo(x + qrsDur * 0.80, baseY - rAmp);
            ctx.lineTo(x + qrsDur, baseY - sAmp);
        } else if (morph.isRbbb) {
            // BBD : rsR' en V1 (oreilles de lapin) ou onde S traînante
            ctx.lineTo(x + qrsDur * 0.20, baseY - rAmp * 0.4);
            ctx.lineTo(x + qrsDur * 0.40, baseY - sAmp * 0.5);
            ctx.lineTo(x + qrsDur * 0.75, baseY - rAmp);
            ctx.lineTo(x + qrsDur, baseY + sAmp);
        } else if (morph.isWpw) {
            // WPW : onde delta (empâtement initial)
            ctx.lineTo(x + qrsDur * 0.40, baseY - rAmp * 0.35); // Onde delta
            ctx.lineTo(x + qrsDur * 0.70, baseY - rAmp);
            ctx.lineTo(x + qrsDur, baseY + sAmp);
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
            // Onde T en tente très pointue, haute et symétrique
            ctx.lineTo(tCenter, baseY - tAmp);
            ctx.lineTo(tEnd, baseY);
        } else if (morph.isBrugada) {
            // Brugada type 1 : ST en dôme convexe descendant vers T négative
            ctx.bezierCurveTo(
                stEnd + (tCenter - stEnd) * 0.5, baseY - stElev * 1.2,
                tCenter, baseY - stElev * 0.8,
                tEnd, baseY - tAmp
            );
            ctx.lineTo(tEnd + 0.05 * 25 * mm, baseY);
        } else if (morph.isHypoK) {
            // Hypokaliémie : T aplatie suivie d'une onde U proéminente
            ctx.quadraticCurveTo(tCenter, baseY - tAmp, tEnd, baseY);
            const uCenter = tEnd + 0.08 * 25 * mm;
            const uEnd = tEnd + 0.16 * 25 * mm;
            ctx.quadraticCurveTo(uCenter, baseY - 0.25 * mv, uEnd, baseY);
        } else if (morph.isDeWinter) {
            // de Winter : sous-décalage ascendant au point J se terminant par une T géante
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
            const badgeW = metrics.qtcBazett ? 220 : 180;
            const badgeX = Math.min(Math.max((c.t1 + c.t2) / 2, badgeW / 2 + 10), w - badgeW / 2 - 10);
            const badgeY = Math.max(midY - 32, 45);

            ctx.fillStyle = 'rgba(10, 15, 35, 0.92)';
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(badgeX - badgeW / 2, badgeY - 24, badgeW, 48, 8);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 12px "Outfit", sans-serif';
            ctx.textAlign = 'center';
            let line1 = `Δt = ${metrics.durationMs} ms (${metrics.deltaMmT} mm)`;
            if (metrics.qtcBazett) {
                line1 += ` • QTc ≈ ${metrics.qtcBazett} ms`;
            }
            ctx.fillText(line1, badgeX, badgeY - 5);

            ctx.fillStyle = '#00f2fe';
            ctx.font = '11px "Inter", sans-serif';
            let extra = `ΔV = ${metrics.voltageMv} mV (${metrics.deltaMmV} mm)`;
            if (metrics.estimatedHr) {
                extra += ` • FC ≈ ${metrics.estimatedHr} bpm`;
            }
            ctx.fillText(extra, badgeX, badgeY + 13);
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
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ECGCanvasRenderer };
}
