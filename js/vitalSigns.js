/**
 * js/vitalSigns.js — Moniteur de signes vitaux (ECG, SpO2, etc.)
 * Phase 2 du refactoring : extrait de game.js
 * Amélioration : Constantes vitales dynamiques (variation physiologique, aggravation temporelle, impact traitements)
 *
 * Les cas peuvent définir un champ optionnel `vitalsDynamics` :
 *   {
 *     "trendOverMinutes": 0.15,       // fraction d'aggravation par minute (défaut: 0.08)
 *     "urgencyMultiplier": 2.5,       // multiplicateur en mode urgence (défaut: 2.0)
 *     "aggravationTargets": {         // valeurs cibles d'aggravation (défaut: dérivé des constantes)
 *       "heartRate": 130, "systolic": 80, "spo2": 88, "temperature": 38.8, "respiratoryRate": 28
 *     },
 *     "stabilizeOnCorrectTreatment": true   // (défaut: true)
 *   }
 * Si absent, des valeurs par défaut sont dérivées des constantes de base du cas.
 */

function parseBP(text) {
    const m = (text || '').match(/(\d{2,3})\/(\d{2,3})/);
    return m ? { systolic: +m[1], diastolic: +m[2] } : { systolic: 120, diastolic: 80 };
}

function parseNum(text) {
    const m = (text || '').match(/[\d]+(?:[\.,][\d]+)?/);
    return m ? parseFloat(m[0].replace(',', '.')) : NaN;
}

// ==================== SEUILS CLINIQUES (normal / warning / critical) ====================

const VITAL_THRESHOLDS = {
    heartRate:     { normal: [60, 100],  warningLow: 50,  warningHigh: 120, criticalLow: 40,  criticalHigh: 140 },
    systolic:      { normal: [90, 140],  warningLow: 85,  warningHigh: 160, criticalLow: 70,  criticalHigh: 180 },
    diastolic:     { normal: [60, 90],   warningLow: 55,  warningHigh: 100, criticalLow: 45,  criticalHigh: 110 },
    spo2:          { normal: [95, 100],  warningLow: 92,  warningHigh: 999, criticalLow: 85,  criticalHigh: 999 },
    temperature:   { normal: [36.0, 37.5], warningLow: 35.5, warningHigh: 38.5, criticalLow: 35.0, criticalHigh: 40.0 },
    respiratoryRate:{ normal: [12, 20],  warningLow: 10,  warningHigh: 25,  criticalLow: 8,   criticalHigh: 30 }
};

function getVitalLevel(vitalKey, value) {
    const t = VITAL_THRESHOLDS[vitalKey];
    if (!t) return 'normal';
    if (value <= t.criticalLow || value >= t.criticalHigh) return 'critical';
    if (value <= t.warningLow || value >= t.warningHigh) return 'warning';
    return 'normal';
}

class VitalSignsMonitor {
    constructor(props, layout) {
        this.props = props;
        this.layout = layout || { ecgH: 96, spo2H: 48 };
        this.baseValues = { ...props };
        this.calculateVariationRanges();

        // --- Dynamique temporelle ---
        this.elapsedSeconds = 0;           // secondes écoulées depuis début du cas
        this.dynamicsTickInterval = null;  // intervalle 1s pour la progression
        this.updateInterval = null;

        // Configuration de dynamique (sera peuplée dans setCase)
        this.dynamicsConfig = null;        // { trendOverMinutes, urgencyMultiplier, aggravationTargets, stabilizeOnCorrectTreatment }

        // État courant interpolé entre baseValues et aggravationTargets
        this.currentTrendFraction = 0;     // 0.0 = valeurs de base, 1.0 = cibles d'aggravation
        this.treatmentStabilized = false;  // true si un traitement correct a été appliqué
    }

    /**
     * Configure la dynamique en fonction du cas chargé.
     * @param {object} currentCase — le cas clinique courant
     */
    setCase(currentCase) {
        const dyn = (currentCase && currentCase.vitalsDynamics) || {};
        const bv = this.baseValues;

        // Cibles d'aggravation : si non définies, on dérive des constantes de base (±20% vers le pire)
        const defaultTargets = {
            heartRate:       Math.round(bv.heartRate * 1.25),
            systolic:        Math.round(bv.systolic * 0.85),
            diastolic:       Math.round(bv.diastolic * 0.85),
            spo2:            Math.round(bv.spo2 * 0.92),
            temperature:     Math.round((bv.temperature * 1.03) * 10) / 10,
            respiratoryRate: Math.round(bv.respiratoryRate * 1.30)
        };

        this.dynamicsConfig = {
            trendOverMinutes: dyn.trendOverMinutes || 0.08,     // 8% par minute par défaut
            urgencyMultiplier: dyn.urgencyMultiplier || 2.0,
            aggravationTargets: { ...defaultTargets, ...(dyn.aggravationTargets || {}) },
            stabilizeOnCorrectTreatment: dyn.stabilizeOnCorrectTreatment !== false
        };

        // Réinitialiser l'état
        this.currentTrendFraction = 0;
        this.treatmentStabilized = false;
        this.elapsedSeconds = 0;

        // Redémarrer le ticker dynamique si déjà en marche
        this.stopDynamicsTicker();
        this.startDynamicsTicker();

        // Effectuer un premier recalcul immédiat
        this._recalcAllProps();
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

    /**
     * Interpole une valeur entre base et target selon la fraction de tendance.
     */
    _interpolateValue(base, target, fraction) {
        return base + (target - base) * Math.min(1, Math.max(0, fraction));
    }

    /**
     * Calcule la valeur cible de tendance pour une constante à l'instant t.
     * Combine : valeur interpolée de base→aggravation + variation sinusoïdale physiologique.
     */
    _computeCurrentValue(vitalKey, baseVal) {
        const cfg = this.dynamicsConfig;
        if (!cfg) {
            // Fallback: variation aléatoire simple
            const range = this.variationRanges[vitalKey];
            return range ? (Math.random() * (range.max - range.min) + range.min) : baseVal;
        }

        const targets = cfg.aggravationTargets;

        // Si stabilisé par traitement, revenir progressivement vers la base (mais pas en dessous)
        const effectiveFraction = this.treatmentStabilized
            ? Math.max(0, this.currentTrendFraction - 0.004) // récupération lente
            : this.currentTrendFraction;

        // Valeur interpolée entre base et cible d'aggravation
        let targetVal = targets[vitalKey] !== undefined ? targets[vitalKey] : baseVal;
        let trended = this._interpolateValue(baseVal, targetVal, effectiveFraction);

        // Variation sinusoïdale physiologique (respiration, variabilité)
        const physioAmplitude = this._physioAmplitude(vitalKey, baseVal);
        const cycleSeconds = this._physioCycle(vitalKey);
        const phase = Math.sin((this.elapsedSeconds % cycleSeconds) / cycleSeconds * Math.PI * 2);
        trended += phase * physioAmplitude;

        // Bruit aléatoire fin (±1% pour le réalisme)
        const noise = (Math.random() - 0.5) * 0.02 * baseVal;
        trended += noise;

        // Arrondi
        if (vitalKey === 'temperature') {
            trended = Math.round(trended * 10) / 10;
        } else {
            trended = Math.round(trended);
        }

        return trended;
    }

    /** Amplitude de la variation physiologique pour une constante donnée */
    _physioAmplitude(vitalKey, baseVal) {
        switch (vitalKey) {
            case 'heartRate':       return baseVal * 0.03;   // ±3% (arythmie sinusale respi)
            case 'systolic':        return baseVal * 0.015;  // ±1.5%
            case 'diastolic':       return baseVal * 0.015;
            case 'spo2':            return baseVal * 0.005;  // ±0.5% (stable physiologiquement)
            case 'temperature':     return 0.15;             // ±0.15°C (rythme circadien)
            case 'respiratoryRate': return baseVal * 0.04;   // ±4%
            default:                return baseVal * 0.02;
        }
    }

    /** Période du cycle physiologique en secondes */
    _physioCycle(vitalKey) {
        switch (vitalKey) {
            case 'heartRate':       return 5;    // cycle respiratoire ~5s
            case 'respiratoryRate': return 5;
            case 'systolic':        return 8;
            case 'diastolic':       return 8;
            case 'temperature':     return 60;   // variation lente
            case 'spo2':            return 12;
            default:                return 10;
        }
    }

    /**
     * Applique l'impact d'un traitement sur les constantes.
     * Appelé depuis game.js quand un traitement correct est sélectionné.
     * @param {string} treatmentName — nom du traitement appliqué
     */
    applyTreatmentImpact(treatmentName) {
        if (!this.dynamicsConfig || !this.dynamicsConfig.stabilizeOnCorrectTreatment) return;

        // Stabiliser les constantes : figer la tendance et amorcer une récupération
        this.treatmentStabilized = true;

        // Effet immédiat modeste sur certaines constantes selon le type de traitement
        const name = (treatmentName || '').toLowerCase();
        if (name.includes('o2') || name.includes('oxygène') || name.includes('oxygene')) {
            this.props.spo2 = Math.min(100, Math.round(this.props.spo2 + 3));
        }
        if (name.includes('antalgique') || name.includes('morphine') || name.includes('paracétamol') || name.includes('paracetamol')) {
            this.props.heartRate = Math.max(50, Math.round(this.props.heartRate - 8));
            this.props.systolic = Math.max(80, Math.round(this.props.systolic - 5));
        }
        if (name.includes('remplissage') || name.includes('nacl') || name.includes('cristalloïde') || name.includes('cristalloide')) {
            this.props.systolic = Math.min(180, Math.round(this.props.systolic + 10));
            this.props.heartRate = Math.max(55, Math.round(this.props.heartRate - 5));
        }
        if (name.includes('antibiothérapie') || name.includes('antibiotique') || name.includes('antibiotherapie')) {
            this.props.temperature = Math.max(36.0, Math.round((this.props.temperature - 0.4) * 10) / 10);
        }

        this.updateDisplay();
        this.startAnimations();
    }

    // ==================== TICK DE PROGRESSION TEMPORELLE (1s) ====================

    _dynamicsTick() {
        if (this.treatmentStabilized || !this.dynamicsConfig) {
            this.elapsedSeconds++;
            return;
        }

        this.elapsedSeconds++;

        // Calculer la fraction de tendance : trendOverMinutes × minutes écoulées
        const isUrgence = (typeof urgenceState !== 'undefined' && urgenceState.isUrgenceMode);
        const multiplier = isUrgence ? this.dynamicsConfig.urgencyMultiplier : 1.0;
        const minutesElapsed = this.elapsedSeconds / 60;
        this.currentTrendFraction = Math.min(1.0, this.dynamicsConfig.trendOverMinutes * minutesElapsed * multiplier);

        // Mettre à jour les props toutes les 2 secondes (pour ne pas saturer l'affichage)
        if (this.elapsedSeconds % 2 === 0) {
            this._recalcAllProps();
        }
    }

    _recalcAllProps() {
        const bv = this.baseValues;
        this.props.heartRate       = this._computeCurrentValue('heartRate', bv.heartRate);
        this.props.systolic        = this._computeCurrentValue('systolic', bv.systolic);
        this.props.diastolic       = this._computeCurrentValue('diastolic', bv.diastolic);
        this.props.spo2            = this._computeCurrentValue('spo2', bv.spo2);
        this.props.temperature     = this._computeCurrentValue('temperature', bv.temperature);
        this.props.respiratoryRate = this._computeCurrentValue('respiratoryRate', bv.respiratoryRate);
        this.updateDisplay();
        this.startAnimations();
    }

    startDynamicsTicker() {
        if (this.dynamicsTickInterval) return;
        this.elapsedSeconds = 0;
        this.dynamicsTickInterval = setInterval(() => this._dynamicsTick(), 1000);
    }

    stopDynamicsTicker() {
        if (this.dynamicsTickInterval) {
            clearInterval(this.dynamicsTickInterval);
            this.dynamicsTickInterval = null;
        }
    }

    // ==================== MISE À JOUR PÉRIODIQUE (compatibilité legacy) ====================

    generateRandomValue(range) {
        return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    }

    updateVitalsValues() {
        if (this.dynamicsConfig) {
            // Mode dynamique : utiliser _recalcAllProps (appelé par _dynamicsTick)
            // Ne rien faire ici, le tick 1s gère tout
            return;
        }
        // Mode legacy : variation aléatoire simple
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
        if (this.dynamicsConfig) {
            // Mode dynamique : démarrer le ticker 1s au lieu des mises à jour aléatoires
            this.startDynamicsTicker();
        }
        // Garder le legacy interval pour compatibilité (coexiste avec dynamics ticker si les deux actifs)
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
        this.stopDynamicsTicker();
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

        updatePatientAvatar(this.props, window.PAIN_LEVEL || 0);
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

function updatePatientAvatar(vitals, painLevel = 0) {
    const avatar = document.getElementById('patient-avatar');
    if (!avatar) return;
    const HR = vitals.heartRate || vitals.HR || 0;
    const sys = vitals.systolic || vitals.sys || 120;
    const spo2 = vitals.spo2 || vitals.SpO2 || 98;
    const temp = vitals.temperature || vitals.temp || 37;
    let state = 'stable';
    let expression = 'neutral';
    if (HR > 120 || sys < 90) {
        state = HR > 140 || sys < 80 ? 'critical' : 'distressed';
    }
    if (painLevel > 7) {
        expression = 'grimace';
    }
    if (spo2 < 92) {
        expression = 'cyanotic';
    }
    if (temp > 38.5) {
        expression = expression === 'neutral' ? 'feverish' : expression;
    }
    if (state === 'stable' && temp > 37.5) {
        expression = 'sweating';
    }
    if (sys < 100) {
        expression = 'pale';
    }
    avatar.setAttribute('data-state', state);
    avatar.setAttribute('data-expression', expression);
}