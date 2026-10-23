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

class VitalSignsMonitor {
    constructor(props, layout) {
        this.props = props;
        this.layout = layout || { ecgH: 96, spo2H: 48 };
        this.baseValues = { ...props };
        this.calculateVariationRanges();

        // Fix de synchronisation globale
        window.vitalSigns = this;

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

        // Fraction effective = currentTrendFraction (décroît réellement quand
        // treatmentStabilized — voir _dynamicsTick : récupération visible).
        const effectiveFraction = this.currentTrendFraction;

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
     * Applique l'impact d'un traitement sur les constantes — PENDANT le cas.
     * Garde pédagogique : seul un traitement correct (1re ou 2e ligne) améliore
     * réellement l'état ; un traitement contre-indiqué AGGRAVE le patient ;
     * un traitement hors cible est neutre (pas d'amélioration cosmétique).
     * @param {string} treatmentName — nom du traitement appliqué
     */
    applyTreatmentImpact(treatmentName) {
        if (!this.dynamicsConfig || !this.dynamicsConfig.stabilizeOnCorrectTreatment) return;

        const name = (treatmentName || '').toLowerCase().trim();
        if (!name) return;

        const _matches = (list) => (list || []).some(ref => {
            const r = String(ref || '').toLowerCase().trim();
            return r && (r === name || name.includes(r) || r.includes(name));
        });

        const currentCase = (window.scoringState && window.scoringState.currentCase) || null;
        const isCorrect = _matches(currentCase?.correctTreatments);
        const isSecondLine = _matches(currentCase?.secondLineTreatments);
        const isFatal = _matches([
            ...(currentCase?.fatalTreatments || []),
            ...((window.scoringState && window.scoringState._fatalOverrideTreatments) || [])
        ]);

        if (!isCorrect && !isSecondLine) {
            if (isFatal) {
                this._applyAggravation(treatmentName);
            }
            // Traitement hors cible : aucune amélioration des constantes
            return;
        }

        // Stabiliser les constantes : la récupération progressive est gérée
        // par _dynamicsTick (currentTrendFraction décroît désormais réellement).
        this.treatmentStabilized = true;

        // Effet immédiat modeste sur certaines constantes selon le type de traitement
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

        document.dispatchEvent(new CustomEvent('vital-treatment-impact', {
            detail: { treatment: treatmentName, effect: 'amelioration' }
        }));

        this.updateDisplay();
        this.startAnimations();
    }

    /**
     * Aggravation visible après un traitement contre-indiqué / dangereux.
     */
    _applyAggravation(treatmentName) {
        this.props.heartRate = Math.min(185, Math.round(this.props.heartRate + 8));
        this.props.systolic = Math.max(60, Math.round(this.props.systolic - 8));
        this.props.spo2 = Math.max(70, Math.round(this.props.spo2 - 2));

        document.dispatchEvent(new CustomEvent('vital-treatment-impact', {
            detail: { treatment: treatmentName, effect: 'aggravation' }
        }));

        this.updateDisplay();
        this.startAnimations();
    }

    // ==================== TICK DE PROGRESSION TEMPORELLE (1s) ====================

    _dynamicsTick() {
        if (!this.dynamicsConfig) {
            this.elapsedSeconds++;
            return;
        }

        this.elapsedSeconds++;

        if (this.treatmentStabilized) {
            // Récupération lente et VISIBLE : la fraction de tendance décroît
            // (~0.004/s → récupération complète en ~4 min depuis 1.0).
            this.currentTrendFraction = Math.max(0, this.currentTrendFraction - 0.004);
            if (this.elapsedSeconds % 2 === 0) {
                this._recalcAllProps();
            }
            return;
        }

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
            // Mode dynamique : le ticker 1s pilote les constantes.
            this.startDynamicsTicker();
            return;
        }
        // Mode statique : variations aleatoires legacy.
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
        // Moniteur de chevet : fond noir, code couleur des moniteurs réels
        // (ECG vert, pléthysmographie cyan, PNI blanc, FR jaune). Le tracé est
        // fixe et une barre d'effacement le balaie, comme sur un vrai scope.
        // Les identifiants historiques (hr-value, bp-value, spo2-value,
        // temp-value, heart-line-1, spo2-path-1, pulse-indicator…) sont
        // conservés : d'autres modules les lisent.
        return (
            '<div class="vm" role="img" aria-label="Moniteur de surveillance">'
            + '<div class="vm-row vm-row--ecg">'
            +   '<div class="vm-wave">'
            +     '<span class="vm-lead">II</span>'
            +     '<svg viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true">'
            +       '<g id="heart-group"><path id="heart-line-1" class="vm-trace vm-trace--ecg" d=""/><path id="heart-line-2" d="" style="display:none"/></g>'
            +     '</svg>'
            +     '<span class="vm-eraser"></span>'
            +   '</div>'
            +   '<div class="vm-num vm-num--ecg">'
            +     '<span class="vm-num-label">FC <span id="pulse-indicator" class="vm-heart" aria-hidden="true">&#9829;</span></span>'
            +     '<span id="hr-value" class="vm-num-value">' + this.props.heartRate + '</span>'
            +     '<span class="vm-num-unit">bpm</span>'
            +   '</div>'
            + '</div>'
            + '<div class="vm-row vm-row--spo2">'
            +   '<div class="vm-wave">'
            +     '<span class="vm-lead">Pleth</span>'
            +     '<svg viewBox="0 0 400 64" preserveAspectRatio="none" aria-hidden="true">'
            +       '<g id="spo2-group"><path id="spo2-path-1" class="vm-trace vm-trace--spo2" d=""/><path id="spo2-path-2" d="" style="display:none"/></g>'
            +     '</svg>'
            +     '<span class="vm-eraser"></span>'
            +   '</div>'
            +   '<div class="vm-num vm-num--spo2">'
            +     '<span id="spo2-label" class="vm-num-label">SpO&#8322;</span>'
            +     '<span id="spo2-value" class="vm-num-value">' + this.props.spo2 + '%</span>'
            +   '</div>'
            + '</div>'
            + '<div class="vm-row vm-row--params">'
            +   '<div class="vm-param vm-param--nibp"><span class="vm-num-label">PNI <small>mmHg</small></span><span id="bp-value" class="vm-param-value">' + this.props.systolic + '/' + this.props.diastolic + '</span><span id="map-value" class="vm-param-sub">(' + Math.round((this.props.systolic + 2 * this.props.diastolic) / 3) + ')</span></div>'
            +   '<div class="vm-param vm-param--rr"><span class="vm-num-label">FR</span><span id="rr-value" class="vm-param-value">' + Math.round(this.props.respiratoryRate || 16) + '</span></div>'
            +   '<div class="vm-param vm-param--temp"><span class="vm-num-label">T° <small>°C</small></span><span id="temp-value" class="vm-param-value">' + this.props.temperature.toFixed(1) + '</span></div>'
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
        const tempEl = document.getElementById('temp-value'); if (tempEl) tempEl.textContent = this.props.temperature.toFixed(1);
        const rrEl = document.getElementById('rr-value'); if (rrEl && this.props.respiratoryRate) rrEl.textContent = Math.round(this.props.respiratoryRate);
        const mapEl = document.getElementById('map-value'); if (mapEl) mapEl.textContent = '(' + Math.round((this.props.systolic + 2 * this.props.diastolic) / 3) + ')';

        const compactHr = document.getElementById('compact-hr');
        const compactBp = document.getElementById('compact-bp');
        const compactTemp = document.getElementById('compact-temp');
        if (compactHr) compactHr.textContent = this.props.heartRate;
        if (compactBp) compactBp.textContent = this.props.systolic + '/' + this.props.diastolic;
        if (compactTemp) compactTemp.textContent = this.props.temperature.toFixed(1) + '°C';

        document.documentElement.style.setProperty('--heart-rate', this.props.heartRate);
        const spo2Label = document.getElementById('spo2-label'); const spo2Value = document.getElementById('spo2-value'); const low = this.props.spo2 <= 92;
        if (this.root) {
            const vm = this.root.querySelector('.vm');
            if (vm) {
                // Alarmes visuelles du moniteur : la valeur clignote sur fond rouge,
                // comme une alarme de priorité haute.
                vm.classList.toggle('alarm-spo2', low);
                vm.classList.toggle('alarm-hr', this.props.heartRate > 130 || this.props.heartRate < 45);
                vm.classList.toggle('alarm-bp', this.props.systolic < 90 || this.props.systolic > 180);
            }
        }
        if (spo2Label) spo2Label.removeAttribute('style');
        if (spo2Value) spo2Value.removeAttribute('style');

        updatePatientAvatar(this.props, window.PAIN_LEVEL || 0);
    }

    startAnimations() {
        const hr = Math.max(20, Math.min(220, Number(this.props.heartRate) || 72));
        // Vitesse de balayage fixe (comme un scope à 25 mm/s) : c'est
        // l'ESPACEMENT des complexes qui traduit la fréquence, pas la vitesse.
        const SWEEP_S = 5;
        const beats = Math.max(1, (hr * SWEEP_S) / 60);
        const l1 = document.getElementById('heart-line-1');
        if (l1) l1.setAttribute('d', this.generateECGPath(30, beats));
        const s1 = document.getElementById('spo2-path-1');
        if (s1) s1.setAttribute('d', this.generateSPO2Path(18, beats));
        const pulse = document.getElementById('pulse-indicator');
        if (pulse) pulse.style.animationDuration = (60 / hr) + 's';
        document.documentElement.style.setProperty('--vm-sweep', SWEEP_S + 's');
        document.documentElement.style.setProperty('--ecg-speed', SWEEP_S + 's');
    }

    /** Courbe de pléthysmographie : montée raide, onde dicrote, sur 400 unités. */
    generateSPO2Path(amp, beats = 6) {
        const W = 400, baseY = 52, bw = W / beats;
        let p = 'M0,' + baseY;
        for (let i = 0; i < Math.ceil(beats) + 1; i++) {
            const x = i * bw;
            if (x > W) break;
            const k = bw / 70;
            p += ` L ${(x + 4 * k).toFixed(1)},${baseY}`;
            p += ` C ${(x + 10 * k).toFixed(1)},${baseY} ${(x + 14 * k).toFixed(1)},${baseY - amp} ${(x + 20 * k).toFixed(1)},${baseY - amp}`;
            p += ` C ${(x + 28 * k).toFixed(1)},${baseY - amp} ${(x + 32 * k).toFixed(1)},${(baseY - amp * 0.45).toFixed(1)} ${(x + 37 * k).toFixed(1)},${(baseY - amp * 0.5).toFixed(1)}`;
            p += ` C ${(x + 42 * k).toFixed(1)},${(baseY - amp * 0.55).toFixed(1)} ${(x + 50 * k).toFixed(1)},${baseY} ${(x + 62 * k).toFixed(1)},${baseY}`;
        }
        return p;
    }

    /** Dérivation II : onde P, QRS fin, onde T, ligne isoélectrique. */
    generateECGPath(amp, beats = 6) {
        const W = 400, baseY = 62, bw = W / beats;
        // Les complexes gardent une largeur physiologique fixe ; seul
        // l'intervalle R-R change avec la fréquence.
        const c = Math.min(1, bw / 70);
        let p = 'M0,' + baseY;
        for (let i = 0; i < Math.ceil(beats) + 1; i++) {
            const x = i * bw + 6;
            if (x > W) break;
            const f = (v) => (x + v * c).toFixed(1);
            p += ` L${f(0)},${baseY}`;
            p += ` Q${f(5)},${(baseY - amp * 0.18).toFixed(1)} ${f(10)},${baseY}`;   // P
            p += ` L${f(16)},${baseY}`;
            p += ` L${f(18)},${(baseY + amp * 0.12).toFixed(1)}`;                   // Q
            p += ` L${f(21)},${(baseY - amp).toFixed(1)}`;                          // R
            p += ` L${f(24)},${(baseY + amp * 0.3).toFixed(1)}`;                    // S
            p += ` L${f(27)},${baseY}`;
            p += ` L${f(33)},${baseY}`;
            p += ` Q${f(41)},${(baseY - amp * 0.32).toFixed(1)} ${f(49)},${baseY}`;  // T
        }
        p += ` L${W},${baseY}`;
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