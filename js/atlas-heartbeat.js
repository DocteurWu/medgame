/**
 * js/atlas-heartbeat.js — Moteur d'animation cardiaque et synchronisation ECG pour l'Atlas 3D MedGame.
 *
 * Fonctionnalités :
 * 1. Identification précise des 18 structures anatomiques cardiaques pures (exclut les ventricules cérébraux).
 * 2. Calcul de phase physiologique continue (systole auriculaire, systole ventriculaire, diastole).
 * 3. Dérivation cinématique (scale local + déplacement) pour valves, cavités et parois.
 * 4. 4 Presets pédagogiques : Rythme sinusal normal, Rétrécissement aortique (RA),
 *    Insuffisance mitrale (IM), Fibrillation atriale (ACFA).
 * 5. Synchroniseur ECG sur signaux réels PTB-XL (détection QRS → pic R) avec rendu scope sur canvas 2D.
 */

export const CARDIAC_TARGET_NAMES = {
    // Valves aortiques (3 sigmoïdes)
    aorticCuspAnt: 'anterior cusp of aortic valve',
    aorticCuspLeftPost: 'left posterior cusp of aortic valve',
    aorticCuspRightPost: 'right posterior cusp of aortic valve',

    // Valves mitrales (2 feuillets)
    mitralLeafletAnt: 'anterior leaflet of mitral valve',
    mitralLeafletPost: 'posterior leaflet of mitral valve',

    // Valves tricuspides (3 feuillets)
    tricuspidLeafletAnt: 'anterior leaflet of tricuspid valve',
    tricuspidLeafletPost: 'posterior leaflet of tricuspid valve',
    tricuspidLeafletSeptal: 'septal leaflet of tricuspid valve',

    // Valves pulmonaires (3 sigmoïdes)
    pulmonaryCuspLeftAnt: 'left anterior cusp of pulmonary valve',
    pulmonaryCuspRightAnt: 'right anterior cusp of pulmonary valve',
    pulmonaryCuspPost: 'posterior cusp of pulmonary valve',

    // Cavités (4)
    cavityLV: 'cavity of left ventricle',
    cavityRV: 'cavity of right ventricle',
    cavityLA: 'cavity of left atrium',
    cavityRA: 'cavity of right atrium',

    // Parois (3)
    wallVentricle: 'wall of ventricle',
    wallLA: 'wall of left atrium',
    wallRA: 'wall of right atrium'
};

export const CARDIAC_EXCLUDED_NAMES = [
    'third ventricle',
    'fourth ventricle',
    'interventricular foramen',
    'left lateral ventricle',
    'right lateral ventricle',
    'septum of telencephalon'
];

export const HEART_PRESETS = {
    sinus: {
        id: 'sinus',
        name: 'Rythme sinusal',
        shortName: 'Sinusal',
        bpm: 72,
        ecgFile: 'assets/data/ecg/ecg_normal_sinus.json',
        badge: 'Physiologique · 72 bpm',
        title: 'Rythme Sinusal Physiologique',
        description: "Dépolarisation initiée par le nœud sinusal, conduction auriculo-ventriculaire synchrone. Contraction auriculaire suivie de la systole ventriculaire et de l'ouverture physiologique des valves.",
        icon: 'fa-heart-pulse'
    },
    ra: {
        id: 'ra',
        name: 'Rétrécissement aortique (RA)',
        shortName: 'Sténose aortique',
        bpm: 70,
        ecgFile: 'assets/data/ecg/ecg_lvh.json',
        badge: 'Valvulopathie · RA',
        title: 'Rétrécissement Aortique Serré (RA)',
        description: "La valve aortique sténosée s'ouvre mal : le ventricule gauche doit générer une pression plus élevée, d'où une hypertrophie concentrique. Souffle systolique éjectionnel au foyer aortique.",
        icon: 'fa-compress'
    },
    im: {
        id: 'im',
        name: 'Insuffisance mitrale (IM)',
        shortName: 'Fuite mitrale',
        bpm: 75,
        ecgFile: 'assets/data/ecg/ecg_normal_sinus.json',
        badge: 'Valvulopathie · IM',
        title: 'Insuffisance Mitrale (IM)',
        description: "Les feuillets mitraux ne coaptent pas : pendant la systole, le sang reflue vers l'oreillette gauche à travers l'orifice régurgitant. Souffle holosystolique à l'apex.",
        icon: 'fa-arrow-right-arrow-left'
    },
    acfa: {
        id: 'acfa',
        name: 'Fibrillation atriale (ACFA)',
        shortName: 'ACFA',
        bpm: 105,
        ecgFile: 'assets/data/ecg/ecg_afib.json',
        badge: 'Arythmie · ACFA',
        title: 'Fibrillation Atriale (ACFA)',
        description: "Les oreillettes fibrillent (pas de contraction efficace, pas d'onde P) : la réponse ventriculaire est irrégulière. Risque thromboembolique.",
        icon: 'fa-bolt'
    }
};

/**
 * Normalise une chaîne pour une comparaison insensible à la casse et aux espaces.
 */
function cleanName(str) {
    return (str || '').toLowerCase().replace(/[\s_-]+/g, ' ').trim();
}

/**
 * Identifie et classe les 18 pièces cardiaques à partir de atlas.parts.
 * Exclut formellement les ventricules cérébraux.
 */
export function groupCardiacParts(parts = []) {
    const byRole = {
        aorticValve: [],
        mitralValve: [],
        tricuspidValve: [],
        pulmonaryValve: [],
        ventricleCavities: [],
        atriumCavities: [],
        ventricleWall: [],
        atriumWalls: []
    };

    const partIndices = new Set();
    const partMeta = new Map();

    const targetEntries = Object.entries(CARDIAC_TARGET_NAMES).map(([key, name]) => [key, cleanName(name)]);
    const excludedClean = CARDIAC_EXCLUDED_NAMES.map(cleanName);

    parts.forEach((p, idx) => {
        const cName = cleanName(p.name);

        // Exclusion stricte des pièges cérébraux
        if (excludedClean.some((ex) => cName.includes(ex))) {
            return;
        }

        // Recherche de correspondance avec l'une des 18 structures cibles
        for (const [key, target] of targetEntries) {
            if (cName === target || cName.includes(target) || target.includes(cName)) {
                let role = 'other';
                if (key.startsWith('aortic')) role = 'aorticValve';
                else if (key.startsWith('mitral')) role = 'mitralValve';
                else if (key.startsWith('tricuspid')) role = 'tricuspidValve';
                else if (key.startsWith('pulmonary')) role = 'pulmonaryValve';
                else if (key === 'cavityLV' || key === 'cavityRV') role = 'ventricleCavities';
                else if (key === 'cavityLA' || key === 'cavityRA') role = 'atriumCavities';
                else if (key === 'wallVentricle') role = 'ventricleWall';
                else if (key.startsWith('wall')) role = 'atriumWalls';

                const item = { index: idx, part: p, key, role };
                byRole[role]?.push(item);
                partIndices.add(idx);
                partMeta.set(idx, item);
                break;
            }
        }
    });

    return {
        groups: byRole,
        partIndices,
        partMeta,
        count: partIndices.size
    };
}

/**
 * Calcule la phase instantanée normalisée [0, 1) pour un rythme cardiaque régulier donné.
 */
export function heartPhase(timeSec, bpm = 72) {
    const cyclePeriod = 60 / Math.max(30, Math.min(220, bpm));
    const mod = (timeSec % cyclePeriod + cyclePeriod) % cyclePeriod;
    return mod / cyclePeriod;
}

/**
 * Calcule la cinématique cardiaque (échelles et déplacements relatifs)
 * en fonction de la phase du cycle [0, 1) et du preset de pathologie.
 *
 * Chronologie physiologique du cycle :
 * - 0.00 à 0.12 : Contraction isovolumétrique ventriculaire (fermeture mitrale/tricuspide).
 * - 0.12 à 0.38 : Éjection systolique (ouverture aortique/pulmonaire, contraction ventriculaire max).
 * - 0.38 à 0.50 : Relaxation isovolumétrique (fermeture sigmoïdes, début remplissage).
 * - 0.50 à 0.85 : Remplissage diastolique passif (ouverture mitrale/tricuspide).
 * - 0.85 à 1.00 : Systole auriculaire (onde P, contraction des oreillettes).
 */
export function heartMotion(phase, presetId = 'sinus', isIsolated = true, subTimeSec = 0) {
    const preset = HEART_PRESETS[presetId] || HEART_PRESETS.sinus;
    const amp = isIsolated ? 1.0 : 0.35; // Amplitude atténuée en vue corps entier pour discrétion

    // 1. Onde de contraction ventriculaire (systole ventriculaire centrée autour de phase 0.22)
    let ventContraction = 0;
    if (phase >= 0.0 && phase < 0.42) {
        // Courbe de contraction rapide puis relaxation progressive
        const t = phase / 0.42;
        ventContraction = Math.sin(t * Math.PI);
        // Profil asymétrique physiologique (montée plus abrupte)
        ventContraction = Math.pow(ventContraction, 1.25);
    }

    // 2. Onde de contraction auriculaire (systole auriculaire phase 0.85 à 1.00)
    let atriaContraction = 0;
    if (preset.id === 'acfa') {
        // En ACFA : aucune contraction coordonnée, micro-trémulation rapide (fibrillation)
        atriaContraction = Math.sin(subTimeSec * 38) * 0.04;
    } else if (phase >= 0.84 && phase < 1.0) {
        const t = (phase - 0.84) / 0.16;
        atriaContraction = Math.sin(t * Math.PI);
    }

    // 3. Cinématique des valves
    // Valve aortique : s'ouvre pendant l'éjection ventriculaire (phase 0.12 à 0.38)
    let aorticOpening = 0;
    if (phase >= 0.12 && phase < 0.40) {
        const t = (phase - 0.12) / 0.28;
        aorticOpening = Math.sin(t * Math.PI);
    }
    if (preset.id === 'ra') {
        // En RA : sténose serrée, ouverture réduite de 55 %
        aorticOpening *= 0.42;
    }

    // Valve pulmonaire : s'ouvre avec l'éjection
    let pulmonaryOpening = 0;
    if (phase >= 0.12 && phase < 0.40) {
        const t = (phase - 0.12) / 0.28;
        pulmonaryOpening = Math.sin(t * Math.PI);
    }

    // Valve mitrale : fermée pendant la systole ventriculaire, s'ouvre en diastole (phase 0.48 à 0.96)
    let mitralOpening = 0;
    if (phase >= 0.48 && phase < 0.96) {
        const t = (phase - 0.48) / 0.48;
        mitralOpening = Math.sin(t * Math.PI);
    }
    // En IM : les feuillets ne coaptent pas en systole, présence d'un gap résiduel (fuite)
    const mitralGap = (preset.id === 'im' && phase < 0.45) ? 0.35 : 0.0;

    // Valve tricuspide : synchronisée avec la mitrale
    let tricuspidOpening = 0;
    if (phase >= 0.48 && phase < 0.96) {
        const t = (phase - 0.48) / 0.48;
        tricuspidOpening = Math.sin(t * Math.PI);
    }

    // Échelles locales (facteurs multiplicateurs autour du centre de chaque pièce)
    // Contraction ventriculaire : raccourcissement longitudinal et rétrécissement radial
    const raBoost = preset.id === 'ra' ? 1.25 : 1.0; // Hypertrophie concentrique en RA
    const ventScaleFactor = 1.0 - (ventContraction * (0.095 * raBoost) * amp);
    const ventLongitudinalScale = 1.0 - (ventContraction * (0.075 * raBoost) * amp);

    const atriaScaleFactor = 1.0 - (atriaContraction * 0.08 * amp);

    // Amplitudes de translation d'ouverture des valves (en mètres dans l'espace atlas)
    const valveDisplacementMax = 0.0032 * amp;

    return {
        ventContraction,
        atriaContraction,
        scales: {
            ventricleCavities: { x: ventScaleFactor, y: ventLongitudinalScale, z: ventScaleFactor },
            ventricleWall: { x: ventScaleFactor, y: ventLongitudinalScale, z: ventScaleFactor },
            atriumCavities: { x: atriaScaleFactor, y: atriaScaleFactor, z: atriaScaleFactor },
            atriumWalls: { x: atriaScaleFactor, y: atriaScaleFactor, z: atriaScaleFactor },
            aorticValve: { x: 1.0, y: 1.0, z: 1.0 },
            mitralValve: { x: 1.0, y: 1.0, z: 1.0 },
            tricuspidValve: { x: 1.0, y: 1.0, z: 1.0 },
            pulmonaryValve: { x: 1.0, y: 1.0, z: 1.0 }
        },
        valveOffsets: {
            aortic: aorticOpening * valveDisplacementMax,
            pulmonary: pulmonaryOpening * valveDisplacementMax,
            mitral: Math.max(mitralOpening, mitralGap) * valveDisplacementMax,
            tricuspid: tricuspidOpening * valveDisplacementMax
        },
        preset,
        phase
    };
}

/**
 * Détecte les pics R (complexe QRS) dans un signal 1D (échantillonné typiquement à 100 Hz).
 */
export function detectRPeaks(signal = [], sampleRate = 100, minDistanceSec = 0.40) {
    if (!signal || signal.length < 5) return [];

    const minSamples = Math.round(minDistanceSec * sampleRate);
    const peaks = [];

    // Recherche de l'amplitude max pour établir un seuil adaptatif
    let maxVal = -Infinity;
    let minVal = Infinity;
    for (let i = 0; i < signal.length; i++) {
        if (signal[i] > maxVal) maxVal = signal[i];
        if (signal[i] < minVal) minVal = signal[i];
    }
    const range = maxVal - minVal;
    const threshold = minVal + range * 0.58;

    let lastPeakIdx = -minSamples;

    for (let i = 2; i < signal.length - 2; i++) {
        const val = signal[i];
        if (val > threshold && val > signal[i - 1] && val > signal[i - 2] && val >= signal[i + 1] && val > signal[i + 2]) {
            if (i - lastPeakIdx >= minSamples) {
                peaks.push({
                    index: i,
                    timeSec: i / sampleRate,
                    voltage: val
                });
                lastPeakIdx = i;
            }
        }
    }

    return peaks;
}

/**
 * Gestionnaire de synchronisation ECG et rendu de scope hospitalier en temps réel.
 */
export class ECGSynchronizer {
    constructor(options = {}) {
        this.presetId = options.presetId || 'sinus';
        this.signalData = null;
        this.rPeaks = [];
        this.currentTimeSec = 0;
        this.paused = false;
        this.cache = new Map();
        this.lead = options.lead || 'DII';
        this.onBeat = options.onBeat || null;
        this.lastBeatIdx = -1;

        this.loadPreset(this.presetId);
    }

    async loadPreset(presetId) {
        this.presetId = presetId;
        const preset = HEART_PRESETS[presetId] || HEART_PRESETS.sinus;

        if (this.cache.has(preset.ecgFile)) {
            this._applySignal(this.cache.get(preset.ecgFile));
            return;
        }

        try {
            if (typeof fetch !== 'undefined') {
                const res = await fetch(preset.ecgFile);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                this.cache.set(preset.ecgFile, data);
                if (this.presetId === presetId) {
                    this._applySignal(data);
                }
            } else {
                this._applySyntheticSignal(preset);
            }
        } catch (err) {
            console.warn(`[ECGSynchronizer] Échec chargement ${preset.ecgFile}, recours au signal synthétique:`, err.message);
            this._applySyntheticSignal(preset);
        }
    }

    _applySignal(data) {
        this.signalData = data;
        const leadSignal = data.leads?.[this.lead] || data.leads?.DII || data.leads?.DI || Object.values(data.leads || {})[0] || [];
        this.rPeaks = detectRPeaks(leadSignal, data.sampleRate || 100);
        this.lastBeatIdx = -1;
    }

    _applySyntheticSignal(preset) {
        const sr = 100;
        const dur = 10;
        const total = sr * dur;
        const bpm = preset.bpm || 72;
        const period = 60 / bpm;
        const leadSignal = new Float32Array(total);

        // Motif P-QRS-T simple
        for (let i = 0; i < total; i++) {
            const t = (i / sr) % period;
            let v = 0;
            // Onde P
            if (preset.id !== 'acfa' && t > 0.05 && t < 0.15) {
                v += 0.12 * Math.sin(((t - 0.05) / 0.10) * Math.PI);
            }
            // QRS
            if (t >= 0.18 && t < 0.26) {
                const qrsT = (t - 0.18) / 0.08;
                if (qrsT < 0.25) v -= 0.15;
                else if (qrsT < 0.65) v += 1.2;
                else v -= 0.3;
            }
            // Onde T
            if (t > 0.35 && t < 0.55) {
                v += 0.25 * Math.sin(((t - 0.35) / 0.20) * Math.PI);
            }
            leadSignal[i] = v;
        }

        const data = {
            id: preset.id,
            title: preset.title,
            sampleRate: sr,
            durationSec: dur,
            leads: { DII: Array.from(leadSignal) }
        };
        this._applySignal(data);
    }

    update(dt) {
        if (this.paused) return;
        this.currentTimeSec += dt;
        const maxDur = this.signalData?.durationSec || 10;
        if (this.currentTimeSec >= maxDur) {
            this.currentTimeSec %= maxDur;
            this.lastBeatIdx = -1;
        }

        // Détection du passage de pic R pour callback battement
        if (this.rPeaks.length > 0) {
            for (let i = 0; i < this.rPeaks.length; i++) {
                const peak = this.rPeaks[i];
                if (peak.timeSec <= this.currentTimeSec && i > this.lastBeatIdx) {
                    this.lastBeatIdx = i;
                    if (typeof this.onBeat === 'function') {
                        this.onBeat(peak, this.presetId);
                    }
                    break;
                }
            }
        }
    }

    /**
     * Calcule la phase cardiaque synchronisée avec le tracé ECG à l'instant t.
     */
    getCurrentPhase() {
        const preset = HEART_PRESETS[this.presetId] || HEART_PRESETS.sinus;
        if (!this.rPeaks || this.rPeaks.length < 2) {
            return heartPhase(this.currentTimeSec, preset.bpm);
        }

        const t = this.currentTimeSec;
        let prevPeak = null;
        let nextPeak = null;

        for (let i = 0; i < this.rPeaks.length; i++) {
            if (this.rPeaks[i].timeSec <= t) {
                prevPeak = this.rPeaks[i];
                nextPeak = this.rPeaks[i + 1] || null;
            } else {
                if (!nextPeak) nextPeak = this.rPeaks[i];
                break;
            }
        }

        if (!prevPeak) {
            // Avant le tout premier pic : bouclage sur le dernier
            const lastPeak = this.rPeaks[this.rPeaks.length - 1];
            const firstPeak = this.rPeaks[0];
            const maxDur = this.signalData?.durationSec || 10;
            const cycle = (firstPeak.timeSec + maxDur) - lastPeak.timeSec;
            const elapsed = (t + maxDur) - lastPeak.timeSec;
            return (elapsed / Math.max(0.2, cycle)) % 1.0;
        }

        if (!nextPeak) {
            // Après le dernier pic : bouclage vers le premier
            const firstPeak = this.rPeaks[0];
            const maxDur = this.signalData?.durationSec || 10;
            const cycle = (firstPeak.timeSec + maxDur) - prevPeak.timeSec;
            const elapsed = t - prevPeak.timeSec;
            return Math.min(0.999, elapsed / Math.max(0.2, cycle));
        }

        const rr = nextPeak.timeSec - prevPeak.timeSec;
        const progress = (t - prevPeak.timeSec) / Math.max(0.15, rr);
        return Math.min(0.999, Math.max(0.0, progress));
    }

    /**
     * Rendu haute performance du scope ECG sur un élément canvas.
     */
    renderScope(canvas) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        const preset = HEART_PRESETS[this.presetId] || HEART_PRESETS.sinus;

        // 1. Fond sombre de moniteur de réanimation
        ctx.fillStyle = '#060a14';
        ctx.fillRect(0, 0, w, h);

        // 2. Grille médicale (carreaux 5 mm / 1 mm proportionnels)
        const gridStep = 18;
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.08)';
        ctx.beginPath();
        for (let x = 0; x < w; x += gridStep) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
        }
        for (let y = 0; y < h; y += gridStep) {
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
        }
        ctx.stroke();

        // 3. Ligne de base
        const baselineY = h * 0.58;

        // Si battement en pause : ligne isoélectrique plate figée
        if (this.paused) {
            ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, baselineY);
            ctx.lineTo(w, baselineY);
            ctx.stroke();

            // Mention pause
            ctx.fillStyle = '#ff8577';
            ctx.font = '600 11px Inter, sans-serif';
            ctx.fillText('⏸ BATTEMENT SUSPENDU', 10, 20);
            return;
        }

        const signal = this.signalData?.leads?.[this.lead] || this.signalData?.leads?.DII || [];
        if (!signal.length) return;

        const sr = this.signalData?.sampleRate || 100;
        const dur = this.signalData?.durationSec || 10;
        const totalSamples = signal.length;

        // Fenêtre d'affichage déroulante : montre les 2.8 dernières secondes (style scope)
        const windowSec = 3.0;
        const windowSamples = Math.round(windowSec * sr);
        const currentSampleIdx = Math.round((this.currentTimeSec / dur) * totalSamples);

        const startSampleIdx = Math.max(0, currentSampleIdx - windowSamples);
        const yGain = h * 0.28; // gain en amplitude

        // Tracé néon vert/cyan avec lueur
        ctx.strokeStyle = '#00f2fe';
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = 6;
        ctx.lineWidth = 1.8;
        ctx.beginPath();

        let firstPoint = true;
        for (let i = startSampleIdx; i <= currentSampleIdx; i++) {
            const val = signal[i % totalSamples] || 0;
            const relX = ((i - startSampleIdx) / windowSamples) * w;
            const relY = baselineY - (val * yGain);

            if (firstPoint) {
                ctx.moveTo(relX, relY);
                firstPoint = false;
            } else {
                ctx.lineTo(relX, relY);
            }
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // reset

        // Curseur de balayage à l'extrémité droite
        const sweepX = Math.min(w - 2, ((currentSampleIdx - startSampleIdx) / windowSamples) * w);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sweepX, baselineY - ((signal[currentSampleIdx % totalSamples] || 0) * yGain), 3.0, 0, Math.PI * 2);
        ctx.fill();

        // Affichage des informations cliniques en incrustation
        ctx.fillStyle = '#00f2fe';
        ctx.font = '700 11px Outfit, Inter, sans-serif';
        ctx.fillText(`DII · ${preset.badge}`, 10, 18);

        ctx.fillStyle = 'rgba(224, 232, 244, 0.7)';
        ctx.font = '500 10px Inter, sans-serif';
        ctx.fillText('25 mm/s · 10 mm/mV', 10, 32);
    }
}
