/**
 * js/vitalSigns.js — Moniteur de signes vitaux (ECG, SpO2, etc.)
 * Phase 2 du refactoring : extrait de game.js
 */

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
        this.baseValues = { ...props };
        this.calculateVariationRanges();
        this.updateInterval = null;
    }

    calculateVariationRanges() {
        const variationPercent = 0.025;
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
        this.props.systolic = this.generateRandomValue(this.variationRanges.systolic);
        this.props.diastolic = this.generateRandomValue(this.variationRanges.diastolic);
        this.props.heartRate = this.generateRandomValue(this.variationRanges.heartRate);

        const tempVariation = (Math.random() * (this.variationRanges.temperature.max - this.variationRanges.temperature.min)) + this.variationRanges.temperature.min;
        this.props.temperature = Math.round(tempVariation * 10) / 10;

        this.props.spo2 = this.generateRandomValue(this.variationRanges.spo2);
        this.props.respiratoryRate = this.generateRandomValue(this.variationRanges.respiratoryRate);

        this.updateDisplay();
        this.startAnimations();
    }

    startVitalUpdates() {
        const updateInterval = 3000 + Math.random() * 2000;
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

    mount(root) {
        this.root = root;
        this.root.innerHTML = this.template();
        this.initAnimatedWaves();
        this.updateDisplay();
        this.startAnimations();
        this.startVitalUpdates();
    }

    template() {
        return (
            '<div class="vm" style="position:relative; overflow:hidden;">'
            + '<div class="vm-crt-overlay"></div>'
            + '<div class="vm-header"><div style="color:#007bff;font-weight:700;text-shadow:0 0 5px rgba(0,123,255,0.5)">ECG</div><div style="color:#e0e0e0">HR: <span id="hr-value" class="vm-value-pulse" style="color:#fff;text-shadow:0 0 5px rgba(255,255,255,0.5)">' + this.props.heartRate + '</span> BPM</div></div>'
            + '<div style="display:flex; gap:8px; align-items:stretch;">'
            + '<div style="flex:1; min-width:0;">'
            + '<div style="position:relative;height:' + this.layout.ecgH + 'px;background:rgba(0,10,20,0.5);border-radius:8px;overflow:hidden;border:1px solid rgba(0,123,255,0.2);box-shadow:inset 0 0 20px rgba(0,0,0,0.5)">'
            + '<div class="vm-scanline"></div>'
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
            + '<div class="vm-scanline" style="animation-delay: 1s;"></div>'
            + '<svg style="position:absolute;inset:0;width:100%;height:100%;opacity:.1">'
            + '<defs><pattern id="vm-spo2-grid" width="15" height="15" patternUnits="userSpaceOnUse"><path d="M15 0 L0 0 0 15" fill="none" stroke="#17a2b8" stroke-width="0.3"/></pattern></defs>'
            + '<rect width="100%" height="100%" fill="url(#vm-spo2-grid)"/>'
            + '</svg>'
            + '<svg viewBox="0 0 400 64" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%">'
            + '<defs><linearGradient id="vm-spo2Gradient" x1="0%" y1="0%" x2="100%" y2="0%">'
            + '<stop offset="0%" stop-color="#17a2b8" stop-opacity="0"/><stop offset="10%" stop-color="#17a2b8" stop-opacity="0.8"/><stop offset="50%" stop-color="#17a2b8"/><stop offset="90%" stop-color="#17a2b8" stop-opacity="0.8"/><stop offset="100%" stop-color="#17a2b8" stop-opacity="0"/>'
            + '</linearGradient></defs>'
            + '<g id="spo2-group" style="animation:ecg-scroll var(--ecg-speed,4s) linear infinite;will-change:transform">'
            + '<path id="spo2-path-1" class="vm-line-glow" stroke="url(#vm-spo2Gradient)" stroke-width="2" fill="none" d=""/>'
            + '<path id="spo2-path-2" class="vm-line-glow" stroke="url(#vm-spo2Gradient)" stroke-width="2" fill="none" d=""/>'
            + '</g>'
            + '</svg>'
            + '</div>'
            + '</div>'
            + '</div>'
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
            + '</div>'
            + '</div>'
            + '</div>'
        );
    }

    initAnimatedWaves() {
        this.startAnimations();
    }

    updateDisplay() {
        const hrEl = document.getElementById('hr-value'); if (hrEl) hrEl.textContent = this.props.heartRate;
        const bpEl = document.getElementById('bp-value'); if (bpEl) bpEl.textContent = this.props.systolic + '/' + this.props.diastolic;
        const spo2El = document.getElementById('spo2-value'); if (spo2El) spo2El.textContent = this.props.spo2 + '%';
        const tempEl = document.getElementById('temp-value'); if (tempEl) tempEl.textContent = this.props.temperature.toFixed(1) + '°C';

        const compactHr = document.getElementById('compact-hr');
        const compactBp = document.getElementById('compact-bp');
        const compactTemp = document.getElementById('compact-temp');
        if (compactHr) compactHr.textContent = this.props.heartRate;
        if (compactBp) compactBp.textContent = this.props.systolic + '/' + this.props.diastolic;
        if (compactTemp) compactTemp.textContent = this.props.temperature.toFixed(1) + '°C';

        document.documentElement.style.setProperty('--heart-rate', this.props.heartRate);
        const spo2Label = document.getElementById('spo2-label'); const spo2Value = document.getElementById('spo2-value'); const low = this.props.spo2 <= 92;
        if (spo2Label) { spo2Label.style.color = low ? '#dc3545' : '#17a2b8'; }
        if (spo2Value) { spo2Value.style.color = low ? '#dc3545' : '#333'; }
    }

    startAnimations() {
        const pulse = document.getElementById('pulse-indicator'); const hr = this.props.heartRate; const bpm = 60 / hr; if (pulse) pulse.style.animationDuration = bpm + 's';

        const l1 = document.getElementById('heart-line-1'); const l2 = document.getElementById('heart-line-2'); const amp = Math.min(25 + (hr - 60) * 0.3, 40); const path = this.generateECGPath(amp);
        if (l1) l1.setAttribute('d', path); if (l2) { l2.setAttribute('d', path); l2.setAttribute('transform', 'translate(400 0)'); }

        const s1 = document.getElementById('spo2-path-1'); const s2 = document.getElementById('spo2-path-2'); const sPath = this.generateSPO2Path(15);
        if (s1) s1.setAttribute('d', sPath); if (s2) { s2.setAttribute('d', sPath); s2.setAttribute('transform', 'translate(400 0)'); }

        const grp = document.getElementById('heart-group');
        const sGrp = document.getElementById('spo2-group');
        const speed = 6 - ((hr - 60) * 0.04); const dur = Math.max(2.5, Math.min(7, speed));
        document.documentElement.style.setProperty('--ecg-speed', dur + 's');
        if (grp) grp.style.animationDuration = dur + 's';
        if (sGrp) sGrp.style.animationDuration = dur + 's';
    }

    generateSPO2Path(amp) {
        const baseY = 40, beatWidth = 70, beats = 6; let p = 'M0,' + baseY;
        for (let i = 0; i < beats; i++) {
            const x = i * beatWidth;
            p += ` L ${x + 5},${baseY}`;
            p += ` C ${x + 15},${baseY} ${x + 20},${baseY - amp} ${x + 25},${baseY - amp}`;
            p += ` C ${x + 35},${baseY - amp} ${x + 40},${baseY - amp * 0.4} ${x + 45},${baseY - amp * 0.5}`;
            p += ` C ${x + 50},${baseY - amp * 0.6} ${x + 55},${baseY} ${x + 65},${baseY}`;
            p += ` L ${x + beatWidth},${baseY}`;
        }
        return p;
    }

    generateECGPath(amp) {
        const baseY = 64, beatWidth = 70, beats = 6; let p = 'M0,' + baseY;
        for (let i = 0; i < beats; i++) { const x = i * beatWidth; p += ' L' + (x + 5) + ',' + baseY; p += ' Q' + (x + 10) + ',' + (baseY - amp * 0.25) + ' ' + (x + 15) + ',' + baseY; p += ' L' + (x + 22) + ',' + (baseY + amp * 0.25); p += ' L' + (x + 30) + ',' + (baseY - amp); p += ' L' + (x + 38) + ',' + (baseY + amp * 0.5); p += ' L' + (x + 48) + ',' + baseY; p += ' Q' + (x + 55) + ',' + (baseY - amp * 0.35) + ' ' + (x + 62) + ',' + baseY; p += ' L' + (x + beatWidth) + ',' + baseY; }
        return p;
    }

    updateProps(np) { this.props = { ...this.props, ...np }; this.updateDisplay(); this.startAnimations(); }
}
