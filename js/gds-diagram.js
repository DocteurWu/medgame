/**
 * js/gds-diagram.js — Rendu Canvas interactif du Diagramme de Davenport et Nomogramme Siggaard-Andersen
 * Conforme aux spécifications MedGame : aucun framework, zéro dépendance, 60 FPS à la demande.
 */

class GDSDiagram {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`[GDSDiagram] Canvas introuvable : #${canvasId}`);
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        this.options = Object.assign({
            mode: 'davenport', // 'davenport' ou 'siggaard'
            onPointChange: null // callback({ pH, hco3, paCO2 })
        }, options);

        // État patient actuel
        this.patient = {
            pH: 7.40,
            hco3: 24.0,
            paCO2: 40.0
        };

        // Bornes axes Davenport
        this.boundsDavenport = {
            minPH: 6.85,
            maxPH: 7.75,
            minHCO3: 0,
            maxHCO3: 52
        };

        // Bornes axes Siggaard-Andersen (log PaCO2 vs pH)
        this.boundsSiggaard = {
            minPH: 6.90,
            maxPH: 7.70,
            minLogPaCO2: Math.log10(10), // ~1.0 (10 mmHg)
            maxLogPaCO2: Math.log10(120) // ~2.08 (120 mmHg)
        };

        // Marges d'affichage (pixels)
        this.margins = {
            top: 36,
            right: 32,
            bottom: 46,
            left: 56
        };

        // Interaction glisser-déposer
        this.isDragging = false;
        this.pulsePhase = 0;
        this.needsRender = true;
        this.animFrameId = null;

        this.initCanvasSize();
        this.bindEvents();
        this.requestRender();
    }

    initCanvasSize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const displayWidth = rect.width || 640;
        const displayHeight = rect.height || 420;

        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;
        this.ctx.resetTransform();
        this.ctx.scale(dpr, dpr);

        this.cssWidth = displayWidth;
        this.cssHeight = displayHeight;

        this.plotWidth = Math.max(10, this.cssWidth - this.margins.left - this.margins.right);
        this.plotHeight = Math.max(10, this.cssHeight - this.margins.top - this.margins.bottom);
    }

    setMode(newMode) {
        if (newMode !== 'davenport' && newMode !== 'siggaard') return;
        this.options.mode = newMode;
        this.requestRender();
    }

    setPatientValues({ pH, hco3, paCO2 }, silent = false) {
        if (pH != null) this.patient.pH = Math.max(6.80, Math.min(7.80, pH));
        if (hco3 != null) this.patient.hco3 = Math.max(2, Math.min(55, hco3));
        if (paCO2 != null) this.patient.paCO2 = Math.max(10, Math.min(120, paCO2));

        this.requestRender();
    }

    requestRender() {
        if (this.animFrameId) return;
        this.animFrameId = requestAnimationFrame(() => {
            this.animFrameId = null;
            this.render();
        });
    }

    /* ── Coordonnées Davenport ── */
    phToX(pH) {
        const b = this.boundsDavenport;
        const ratio = (pH - b.minPH) / (b.maxPH - b.minPH);
        return this.margins.left + ratio * this.plotWidth;
    }

    hco3ToY(hco3) {
        const b = this.boundsDavenport;
        const ratio = (hco3 - b.minHCO3) / (b.maxHCO3 - b.minHCO3);
        return this.margins.top + this.plotHeight - (ratio * this.plotHeight);
    }

    xToPH(x) {
        const b = this.boundsDavenport;
        const ratio = (x - this.margins.left) / this.plotWidth;
        return b.minPH + ratio * (b.maxPH - b.minPH);
    }

    yToHCO3(y) {
        const b = this.boundsDavenport;
        const ratio = (this.margins.top + this.plotHeight - y) / this.plotHeight;
        return b.minHCO3 + ratio * (b.maxHCO3 - b.minHCO3);
    }

    /* ── Coordonnées Siggaard-Andersen ── */
    siggaardPhToX(pH) {
        const b = this.boundsSiggaard;
        const ratio = (pH - b.minPH) / (b.maxPH - b.minPH);
        return this.margins.left + ratio * this.plotWidth;
    }

    siggaardPaCO2ToY(paCO2) {
        const b = this.boundsSiggaard;
        const logVal = Math.log10(Math.max(10, Math.min(120, paCO2)));
        const ratio = (logVal - b.minLogPaCO2) / (b.maxLogPaCO2 - b.minLogPaCO2);
        return this.margins.top + this.plotHeight - (ratio * this.plotHeight);
    }

    siggaardXToPH(x) {
        const b = this.boundsSiggaard;
        const ratio = (x - this.margins.left) / this.plotWidth;
        return b.minPH + ratio * (b.maxPH - b.minPH);
    }

    siggaardYToPaCO2(y) {
        const b = this.boundsSiggaard;
        const ratio = (this.margins.top + this.plotHeight - y) / this.plotHeight;
        const logVal = b.minLogPaCO2 + ratio * (b.maxLogPaCO2 - b.minLogPaCO2);
        return Math.pow(10, logVal);
    }

    /* ── Rendu global ── */
    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);

        // Fond du canevas
        ctx.fillStyle = '#0a0f28';
        ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

        if (this.options.mode === 'davenport') {
            this.renderDavenport(ctx);
        } else {
            this.renderSiggaardAndersen(ctx);
        }
    }

    /* ── Rendu Diagramme de Davenport ── */
    renderDavenport(ctx) {
        const b = this.boundsDavenport;

        // 1. Zones pathologiques de fond
        this.renderDavenportZones(ctx);

        // 2. Grille d'arrière-plan
        this.renderDavenportGrid(ctx);

        // 3. Isobariques de PaCO2
        this.renderIsobars(ctx);

        // 4. Ligne tampon normale (Blood buffer line)
        this.renderBufferLine(ctx);

        // 5. Point normal physiologique de référence
        this.renderNormalReferencePoint(ctx);

        // 6. Point patient interactif
        this.renderPatientPointDavenport(ctx);

        // 7. Axes et légendes
        this.renderDavenportAxes(ctx);
    }

    renderDavenportZones(ctx) {
        const left = this.margins.left;
        const top = this.margins.top;
        const width = this.plotWidth;
        const height = this.plotHeight;

        // Quadrant Acidose métabolique (pH < 7.35, HCO3 < 22)
        const xNormLow = this.phToX(7.35);
        const yNormLow = this.hco3ToY(22);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.07)';
        ctx.fillRect(left, yNormLow, Math.max(0, xNormLow - left), top + height - yNormLow);

        // Quadrant Alcalose métabolique (pH > 7.45, HCO3 > 26)
        const xNormHigh = this.phToX(7.45);
        const yNormHigh = this.hco3ToY(26);
        ctx.fillStyle = 'rgba(168, 85, 247, 0.07)';
        ctx.fillRect(xNormHigh, top, left + width - xNormHigh, Math.max(0, yNormHigh - top));

        // Zone Physiologique Normale (7.35 - 7.45 ; 22 - 26 mmol/L)
        ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
        ctx.fillRect(xNormLow, yNormHigh, xNormHigh - xNormLow, yNormLow - yNormHigh);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(xNormLow, yNormHigh, xNormHigh - xNormLow, yNormLow - yNormHigh);
        ctx.setLineDash([]);

        // Libellé de zone normale
        ctx.fillStyle = '#10b981';
        ctx.font = '600 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Zone normale', (xNormLow + xNormHigh) / 2, (yNormHigh + yNormLow) / 2 + 4);

        // Libellés doux des quadrants pathologiques
        ctx.font = '600 11px Outfit, sans-serif';
        ctx.fillStyle = 'rgba(239, 68, 68, 0.55)';
        ctx.textAlign = 'left';
        ctx.fillText('Acidose métabolique', left + 14, top + height - 16);

        ctx.fillStyle = 'rgba(168, 85, 247, 0.65)';
        ctx.textAlign = 'right';
        ctx.fillText('Alcalose métabolique', left + width - 14, top + 22);

        ctx.fillStyle = 'rgba(249, 115, 22, 0.55)';
        ctx.textAlign = 'left';
        ctx.fillText('Acidose respiratoire', left + 14, top + 22);

        ctx.fillStyle = 'rgba(59, 130, 246, 0.55)';
        ctx.textAlign = 'right';
        ctx.fillText('Alcalose respiratoire', left + width - 14, top + height - 16);
    }

    renderDavenportGrid(ctx) {
        const b = this.boundsDavenport;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.lineWidth = 1;

        // Lignes verticales pH (tous les 0.10)
        for (let ph = 6.90; ph <= 7.70; ph += 0.10) {
            const x = this.phToX(ph);
            ctx.beginPath();
            ctx.moveTo(x, this.margins.top);
            ctx.lineTo(x, this.margins.top + this.plotHeight);
            ctx.stroke();
        }

        // Lignes horizontales HCO3 (tous les 10 mmol/L)
        for (let h = 10; h <= 50; h += 10) {
            const y = this.hco3ToY(h);
            ctx.beginPath();
            ctx.moveTo(this.margins.left, y);
            ctx.lineTo(this.margins.left + this.plotWidth, y);
            ctx.stroke();
        }
    }

    renderIsobars(ctx) {
        // Isobariques classiques selon Henderson-Hasselbalch
        // HCO3 = 0.0307 * PaCO2 * 10^(pH - 6.1)
        const isobars = [15, 20, 30, 40, 50, 60, 80, 100];
        const alpha = 0.0307;
        const pK = 6.10;
        const b = this.boundsDavenport;

        isobars.forEach(paco2 => {
            const isNormal = (paco2 === 40);
            ctx.beginPath();
            let first = true;

            for (let ph = b.minPH; ph <= b.maxPH; ph += 0.01) {
                const hco3 = alpha * paco2 * Math.pow(10, ph - pK);
                if (hco3 >= b.minHCO3 && hco3 <= b.maxHCO3) {
                    const x = this.phToX(ph);
                    const y = this.hco3ToY(hco3);
                    if (first) {
                        ctx.moveTo(x, y);
                        first = false;
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
            }

            if (isNormal) {
                ctx.strokeStyle = '#00f2fe';
                ctx.lineWidth = 2.4;
                ctx.shadowColor = 'rgba(0, 242, 254, 0.45)';
                ctx.shadowBlur = 8;
            } else {
                ctx.strokeStyle = 'rgba(0, 242, 254, 0.28)';
                ctx.lineWidth = 1.2;
                ctx.shadowBlur = 0;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Étiquette numérique sur la courbe
            // On cherche le point à pH = 7.15 ou au bord
            const labelPH = (paco2 >= 60) ? 7.12 : ((paco2 <= 20) ? 7.62 : 7.28);
            const labelHCO3 = alpha * paco2 * Math.pow(10, labelPH - pK);
            if (labelHCO3 >= b.minHCO3 + 2 && labelHCO3 <= b.maxHCO3 - 2) {
                const lx = this.phToX(labelPH);
                const ly = this.hco3ToY(labelHCO3);
                ctx.fillStyle = isNormal ? '#00f2fe' : 'rgba(255, 255, 255, 0.55)';
                ctx.font = isNormal ? '700 11px Inter, sans-serif' : '500 10px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`${paco2}${isNormal ? ' (Normale)' : ''}`, lx, ly - 5);
            }
        });
    }

    renderBufferLine(ctx) {
        // Pente tampon normale : HCO3 - 24 = -28 * (pH - 7.40)
        const slope = -28;
        const b = this.boundsDavenport;

        ctx.beginPath();
        let first = true;
        for (let ph = b.minPH; ph <= b.maxPH; ph += 0.02) {
            const hco3 = 24 + slope * (ph - 7.40);
            if (hco3 >= b.minHCO3 && hco3 <= b.maxHCO3) {
                const x = this.phToX(ph);
                const y = this.hco3ToY(hco3);
                if (first) {
                    ctx.moveTo(x, y);
                    first = false;
                } else {
                    ctx.lineTo(x, y);
                }
            }
        }
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Libellé de la ligne tampon
        const lblPH = 7.20;
        const lblHCO3 = 24 + slope * (lblPH - 7.40);
        ctx.fillStyle = '#f59e0b';
        ctx.font = '600 10px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Ligne tampon normale (tampons non-HCO₃⁻)', this.phToX(lblPH) + 6, this.hco3ToY(lblHCO3) - 6);
    }

    renderNormalReferencePoint(ctx) {
        const nx = this.phToX(7.40);
        const ny = this.hco3ToY(24.0);

        // Croix centrale discrète
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nx - 6, ny);
        ctx.lineTo(nx + 6, ny);
        ctx.moveTo(nx, ny - 6);
        ctx.lineTo(nx, ny + 6);
        ctx.stroke();

        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
        ctx.fill();
    }

    renderPatientPointDavenport(ctx) {
        const px = this.phToX(this.patient.pH);
        const py = this.hco3ToY(this.patient.hco3);

        // Halo pulsant si survolé ou déplacé
        const pulse = 4 + Math.sin(Date.now() / 250) * 2;
        const grad = ctx.createRadialGradient(px, py, 2, px, py, 14 + pulse);
        grad.addColorStop(0, 'rgba(0, 242, 254, 0.9)');
        grad.addColorStop(0.5, 'rgba(0, 242, 254, 0.35)');
        grad.addColorStop(1, 'rgba(0, 242, 254, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, 16 + pulse, 0, Math.PI * 2);
        ctx.fill();

        // Point central patient
        ctx.fillStyle = '#00f2fe';
        ctx.beginPath();
        ctx.arc(px, py, 6.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Badge / étiquette dynamique des coordonnées
        const labelText = `pH ${this.patient.pH.toFixed(2)} | HCO₃⁻ ${this.patient.hco3.toFixed(1)} | PaCO₂ ${Math.round(this.patient.paCO2)}`;
        ctx.font = '700 11px Outfit, sans-serif';
        const textWidth = ctx.measureText(labelText).width;
        const badgeWidth = textWidth + 16;
        const badgeHeight = 24;

        // Position adaptative de l'étiquette pour ne pas déborder
        let bx = px + 14;
        let by = py - 30;
        if (bx + badgeWidth > this.cssWidth - 10) {
            bx = px - badgeWidth - 14;
        }
        if (by < 10) {
            by = py + 16;
        }

        ctx.fillStyle = 'rgba(10, 15, 40, 0.9)';
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.6)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, bx, by, badgeWidth, badgeHeight, 6, true, true);

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(labelText, bx + 8, by + 16);
    }

    renderDavenportAxes(ctx) {
        const left = this.margins.left;
        const top = this.margins.top;
        const width = this.plotWidth;
        const height = this.plotHeight;
        const b = this.boundsDavenport;

        // Cadre extérieur
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(left, top, width, height);

        // Graduations Axe X (pH)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.font = '500 11px Inter, sans-serif';
        ctx.textAlign = 'center';

        const ticksPH = [6.90, 7.00, 7.10, 7.20, 7.30, 7.35, 7.40, 7.45, 7.50, 7.60, 7.70];
        ticksPH.forEach(ph => {
            const x = this.phToX(ph);
            ctx.beginPath();
            ctx.moveTo(x, top + height);
            ctx.lineTo(x, top + height + 5);
            ctx.strokeStyle = (ph === 7.40) ? '#10b981' : 'rgba(255, 255, 255, 0.3)';
            ctx.stroke();

            ctx.fillStyle = (ph === 7.40) ? '#10b981' : ((ph === 7.35 || ph === 7.45) ? 'rgba(0, 242, 254, 0.9)' : 'rgba(255, 255, 255, 0.7)');
            ctx.fillText(ph.toFixed(2), x, top + height + 18);
        });

        // Titre Axe X
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 12px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('pH artériel', left + width / 2, top + height + 36);

        // Graduations Axe Y (HCO3-)
        ctx.textAlign = 'right';
        const ticksHCO3 = [0, 10, 20, 24, 30, 40, 50];
        ticksHCO3.forEach(h => {
            const y = this.hco3ToY(h);
            ctx.beginPath();
            ctx.moveTo(left - 5, y);
            ctx.lineTo(left, y);
            ctx.strokeStyle = (h === 24) ? '#10b981' : 'rgba(255, 255, 255, 0.3)';
            ctx.stroke();

            ctx.fillStyle = (h === 24) ? '#10b981' : 'rgba(255, 255, 255, 0.7)';
            ctx.fillText(h.toString(), left - 8, y + 4);
        });

        // Titre Axe Y (vertical)
        ctx.save();
        ctx.translate(16, top + height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 12px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('HCO₃⁻ plasmatique (mmol/L)', 0, 0);
        ctx.restore();
    }

    /* ── Rendu Nomogramme de Siggaard-Andersen ── */
    renderSiggaardAndersen(ctx) {
        const left = this.margins.left;
        const top = this.margins.top;
        const width = this.plotWidth;
        const height = this.plotHeight;
        const b = this.boundsSiggaard;

        // Grille logarithmique PaCO2
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;

        const paco2Lines = [10, 15, 20, 30, 40, 50, 60, 80, 100, 120];
        paco2Lines.forEach(p => {
            const y = this.siggaardPaCO2ToY(p);
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(left + width, y);
            ctx.stroke();

            ctx.fillStyle = (p === 40) ? '#00f2fe' : 'rgba(255, 255, 255, 0.55)';
            ctx.font = (p === 40) ? '700 10px Inter' : '500 10px Inter';
            ctx.textAlign = 'right';
            ctx.fillText(`${p}`, left - 8, y + 4);
        });

        // Grille verticale pH
        for (let ph = 7.00; ph <= 7.60; ph += 0.10) {
            const x = this.siggaardPhToX(ph);
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, top + height);
            ctx.stroke();

            ctx.fillStyle = (ph === 7.40) ? '#10b981' : 'rgba(255, 255, 255, 0.6)';
            ctx.font = '500 10px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(ph.toFixed(2), x, top + height + 18);
        }

        // Isoplèthes de Base Excess (BE = -15 à +15 mmol/L)
        // Relation log(PaCO2) ≈ cste - pente * pH selon BE
        const beValues = [-15, -10, -5, 0, 5, 10, 15];
        beValues.forEach(be => {
            ctx.beginPath();
            const ph1 = 7.00;
            const hco3_1 = 24.8 + be - 16.2 * (ph1 - 7.40);
            const paco2_1 = hco3_1 / (0.0307 * Math.pow(10, ph1 - 6.1));

            const ph2 = 7.60;
            const hco3_2 = 24.8 + be - 16.2 * (ph2 - 7.40);
            const paco2_2 = hco3_2 / (0.0307 * Math.pow(10, ph2 - 6.1));

            if (paco2_1 > 0 && paco2_2 > 0) {
                const x1 = this.siggaardPhToX(ph1);
                const y1 = this.siggaardPaCO2ToY(paco2_1);
                const x2 = this.siggaardPhToX(ph2);
                const y2 = this.siggaardPaCO2ToY(paco2_2);

                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = (be === 0) ? '#10b981' : 'rgba(255, 215, 0, 0.35)';
                ctx.lineWidth = (be === 0) ? 1.8 : 1.1;
                ctx.setLineDash([4, 3]);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = (be === 0) ? '#10b981' : 'rgba(255, 215, 0, 0.7)';
                ctx.font = '600 10px Inter';
                ctx.textAlign = 'left';
                ctx.fillText(`BE ${be > 0 ? '+' : ''}${be}`, x2 + 4, y2 + 3);
            }
        });

        // Cadre
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(left, top, width, height);

        // Titre axes
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 12px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('pH artériel', left + width / 2, top + height + 36);

        ctx.save();
        ctx.translate(16, top + height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('PaCO₂ (échelle log, mmHg)', 0, 0);
        ctx.restore();

        // Point Patient dans Siggaard-Andersen
        const px = this.siggaardPhToX(this.patient.pH);
        const py = this.siggaardPaCO2ToY(this.patient.paCO2);

        ctx.fillStyle = '#00f2fe';
        ctx.beginPath();
        ctx.arc(px, py, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        const sbe = (this.patient.hco3 - 24.8) + 16.2 * (this.patient.pH - 7.40);
        const labelText = `pH ${this.patient.pH.toFixed(2)} | PaCO₂ ${Math.round(this.patient.paCO2)} mmHg | SBE ${(sbe >= 0 ? '+' : '') + sbe.toFixed(1)}`;
        ctx.fillStyle = 'rgba(10, 15, 40, 0.9)';
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.6)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, px + 12, py - 26, 210, 24, 6, true, true);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 11px Outfit';
        ctx.textAlign = 'left';
        ctx.fillText(labelText, px + 18, py - 10);
    }

    roundRect(ctx, x, y, width, height, radius, fill, stroke) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (fill) ctx.fill();
        if (stroke) ctx.stroke();
    }

    /* ── Gestion des événements utilisateur (Glisser-Déposer / Drag & Drop) ── */
    bindEvents() {
        const getCanvasCoords = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        const handleStart = (e) => {
            const coords = getCanvasCoords(e);
            let targetX, targetY;
            if (this.options.mode === 'davenport') {
                targetX = this.phToX(this.patient.pH);
                targetY = this.hco3ToY(this.patient.hco3);
            } else {
                targetX = this.siggaardPhToX(this.patient.pH);
                targetY = this.siggaardPaCO2ToY(this.patient.paCO2);
            }

            const dist = Math.hypot(coords.x - targetX, coords.y - targetY);
            // Si clic près du point (ou dans la zone de dessin)
            if (dist <= 30 || (coords.x >= this.margins.left && coords.x <= this.margins.left + this.plotWidth && coords.y >= this.margins.top && coords.y <= this.margins.top + this.plotHeight)) {
                this.isDragging = true;
                this.canvas.style.cursor = 'grabbing';
                handleMove(e);
                if (e.cancelable) e.preventDefault();
            }
        };

        const handleMove = (e) => {
            if (!this.isDragging) return;
            const coords = getCanvasCoords(e);
            const clampedX = Math.max(this.margins.left, Math.min(this.margins.left + this.plotWidth, coords.x));
            const clampedY = Math.max(this.margins.top, Math.min(this.margins.top + this.plotHeight, coords.y));

            if (this.options.mode === 'davenport') {
                const newPH = Math.round(this.xToPH(clampedX) * 100) / 100;
                const newHCO3 = Math.round(this.yToHCO3(clampedY) * 10) / 10;
                // Calcul de la PaCO2 dépendante via Henderson-Hasselbalch
                // PaCO2 = HCO3 / (0.0307 * 10^(pH - 6.1))
                const alpha = 0.0307;
                const newPaCO2 = Math.round((newHCO3 / (alpha * Math.pow(10, newPH - 6.1))) * 10) / 10;

                this.patient.pH = newPH;
                this.patient.hco3 = newHCO3;
                this.patient.paCO2 = Math.max(10, Math.min(120, newPaCO2));

                if (typeof this.options.onPointChange === 'function') {
                    this.options.onPointChange({
                        pH: newPH,
                        hco3: newHCO3,
                        paCO2: this.patient.paCO2,
                        source: 'diagram'
                    });
                }
            } else {
                const newPH = Math.round(this.siggaardXToPH(clampedX) * 100) / 100;
                const newPaCO2 = Math.round(this.siggaardYToPaCO2(clampedY));
                const alpha = 0.0307;
                const newHCO3 = Math.round((alpha * newPaCO2 * Math.pow(10, newPH - 6.1)) * 10) / 10;

                this.patient.pH = newPH;
                this.patient.paCO2 = newPaCO2;
                this.patient.hco3 = Math.max(2, Math.min(55, newHCO3));

                if (typeof this.options.onPointChange === 'function') {
                    this.options.onPointChange({
                        pH: newPH,
                        hco3: this.patient.hco3,
                        paCO2: newPaCO2,
                        source: 'diagram'
                    });
                }
            }

            this.requestRender();
            if (e.cancelable) e.preventDefault();
        };

        const handleEnd = () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.canvas.style.cursor = 'grab';
                this.requestRender();
            }
        };

        this.canvas.addEventListener('mousedown', handleStart);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);

        this.canvas.addEventListener('touchstart', handleStart, { passive: false });
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleEnd);

        this.canvas.style.cursor = 'grab';

        // Redimensionnement fluide de fenêtre
        window.addEventListener('resize', () => {
            this.initCanvasSize();
            this.requestRender();
        });
    }
}

if (typeof window !== 'undefined') {
    window.GDSDiagram = GDSDiagram;
}
