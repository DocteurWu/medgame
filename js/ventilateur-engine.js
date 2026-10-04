/**
 * js/ventilateur-engine.js — Moteur de simulation physique de la ventilation mécanique
 * 
 * Basé sur l'équation du mouvement du système respiratoire :
 *   Paw(t) = Pelast(t) + Pres(t) + PEEP
 *   Paw(t) = V(t) / C + R * V'(t) + PEEP
 * 
 * Aucune dépendance DOM — testable avec node:test.
 */

export const VENT_MODES = {
    VAC: 'VAC',   // Volume Assisté Contrôlé
    VSAI: 'VSAI'  // Ventilation Spontanée avec Aide Inspiratoire
};

/**
 * Profils physiopathologiques types
 */
export const VENT_PRESETS = {
    NORMAL: {
        id: 'normal',
        name: 'Poumon normal (Post-opératoire)',
        compliance: 60, // mL / cmH2O
        resistance: 6,  // cmH2O / (L/s)
        pbw: 70,        // Poids idéal théorique (kg)
        effort: 0,      // Effort inspiratoire spontané (cmH2O)
        description: 'Poumon sain sans atteinte parenchymateuse ni bronchique.'
    },
    ARDS: {
        id: 'ards',
        name: 'SDRA sévère (Poumon rigide)',
        compliance: 20, // Faible compliance
        resistance: 8,
        pbw: 70,
        effort: 0,
        description: 'Syndrome de détresse respiratoire aiguë : compliance effondrée, risque de volotraumatisme et barotraumatisme.'
    },
    ASTHMA: {
        id: 'asthma',
        name: 'Asthme aigu grave (Bronchospasme)',
        compliance: 65,
        resistance: 26, // Très haute résistance
        pbw: 65,
        effort: 0,
        description: 'Résistance bronchique majeure, expiration très prolongée, risque important d\'auto-PEP (PEP intrinsèque).'
    },
    OBSTRUCTION: {
        id: 'obstruction',
        name: 'Obstruction de sonde (Bouchon muqueux)',
        compliance: 55,
        resistance: 32, // Résistance isolée très élevée
        pbw: 70,
        effort: 0,
        description: 'Pression de crête très élevée avec pression de plateau normale (problème purement résistif).'
    },
    PNEUMOTHORAX: {
        id: 'pneumothorax',
        name: 'Pneumothorax sous ventilation',
        compliance: 18,
        resistance: 16,
        pbw: 70,
        effort: 0,
        description: 'Urgence vitale : élévation simultanée de Pcrête et Pplateau par perte brutale de compliance.'
    },
    WEANING: {
        id: 'weaning',
        name: 'Sevrage ventilatoire (VS-AI)',
        compliance: 50,
        resistance: 7,
        pbw: 68,
        effort: 4, // Patient faisant des efforts spontanés
        description: 'Patient conscient déclenchant ses cycles sous aide inspiratoire.'
    }
};

/**
 * Calcule les paramètres et la mécanique respiratoire d'un cycle
 * @param {Object} settings - Réglages ventilateur (vt, fr, peep, fio2, ieRatio, pauseInsp, ai, trigger)
 * @param {Object} patient - Propriétés patient (compliance, resistance, pbw, effort)
 * @param {string} mode - VENT_MODES.VAC ou VENT_MODES.VSAI
 */
export function calculateVentMechanics(settings, patient, mode = VENT_MODES.VAC) {
    const vtL = (settings.vt || 450) / 1000; // L
    const complianceL = Math.max(5, patient.compliance || 50) / 1000; // L / cmH2O
    const resistance = Math.max(1, patient.resistance || 6); // cmH2O / (L/s)
    const peep = Math.max(0, settings.peep || 5);
    const fr = Math.max(6, Math.min(45, settings.fr || 15));
    const cycleDuration = 60 / fr; // secondes par cycle

    // Rapport I:E (ex: 1:2 -> ratio = 0.5)
    const ieRatio = settings.ieRatio || 0.5; // Tinsp / Texp
    const tInspTotal = cycleDuration * (ieRatio / (1 + ieRatio));
    const tExpTotal = cycleDuration - tInspTotal;

    // Pause inspiratoire (fraction du temps insp, ex: 0.1s à 0.5s)
    const pauseDuration = Math.min(0.8, Math.max(0, settings.pauseInsp || 0.2));
    const tInspFlow = Math.max(0.2, tInspTotal - pauseDuration);

    // Débit inspiratoire en L/s (débit carré en VAC)
    const flowInsp = vtL / tInspFlow; // L/s

    // Constante de temps expiratoire : tau = R * C (secondes)
    const tau = resistance * complianceL;

    // Calcul de l'auto-PEP (PEP intrinsèque) si temps expiratoire insuffisant (< 3 tau)
    // Fraction du volume restant emprisonné à la fin de l'expiration : exp(-Texp / tau)
    const trappedFraction = Math.exp(-tExpTotal / tau);
    const autoPeep = trappedFraction > 0.01 ? (vtL * trappedFraction / complianceL) : 0;
    const totalPeep = peep + autoPeep;

    // Pressions caractéristiques
    // Pplateau = Vt / C + PEEP_totale
    const pPlat = (vtL / complianceL) + totalPeep;

    // Pcrête = Pplateau + R * Débit_insp
    const pPeak = pPlat + (resistance * flowInsp);

    // Driving Pressure (Pression motrice) = Pplateau - PEEP
    const drivingPressure = pPlat - peep;

    // Poids Idéal Théorique (PBW) et Vt en mL/kg
    const pbw = patient.pbw || 70;
    const vtPerKg = (settings.vt || 450) / pbw;

    // Minute ventilation (Ve en L/min)
    const minuteVolume = (vtL * fr);

    // Alertes cliniques de sécurité
    const alerts = [];
    if (pPeak > 35) {
        alerts.push({ type: 'warning', msg: 'Pression de crête critique (> 35 cmH2O) : risque de barotraumatisme' });
    }
    if (pPlat > 30) {
        alerts.push({ type: 'danger', msg: 'Pression de plateau toxique (> 30 cmH2O) : risque majeur de volotraumatisme alvéolaire' });
    }
    if (drivingPressure > 14) {
        alerts.push({ type: 'warning', msg: 'Driving pressure excessive (> 14 cmH2O) : ventilation protectrice non respectée' });
    }
    if (autoPeep >= 3) {
        alerts.push({ type: 'warning', msg: `Auto-PEP détectée (+${autoPeep.toFixed(1)} cmH2O) : allonger le temps expiratoire ou baisser la FR` });
    }
    if (vtPerKg > 8) {
        alerts.push({ type: 'info', msg: `Vt élevé (${vtPerKg.toFixed(1)} mL/kg PBW) : cible recommandée 6 mL/kg en ventilation protectrice` });
    }

    return {
        mode,
        cycleDuration,
        tInspTotal,
        tInspFlow,
        pauseDuration,
        tExpTotal,
        flowInsp,
        tau,
        peep,
        autoPeep,
        totalPeep,
        pPeak,
        pPlat,
        drivingPressure,
        compliance: patient.compliance,
        resistance,
        vtMl: settings.vt || 450,
        fr,
        vtPerKg,
        minuteVolume,
        fio2: settings.fio2 || 40,
        alerts
    };
}

/**
 * Échantillonne la pression, le débit et le volume à un instant t relatif dans le cycle (0 <= t < cycleDuration)
 * Permet un tracé continu parfaitement déterministe.
 */
export function sampleVentilatorWaveforms(t, mechanics) {
    const { cycleDuration, tInspFlow, pauseDuration, tInspTotal, flowInsp, vtMl, peep, autoPeep, totalPeep, pPeak, pPlat, tau } = mechanics;
    const tInCycle = ((t % cycleDuration) + cycleDuration) % cycleDuration;
    const vtL = vtMl / 1000;

    let pressure = peep;
    let flow = 0; // L/s
    let volume = 0; // mL

    if (tInCycle < tInspFlow) {
        // Phase inspiratoire active (débit constant)
        const progress = tInCycle / tInspFlow;
        flow = flowInsp;
        volume = vtMl * progress;
        // Pression = PEEP + (V/C) + R*Flow
        // La composante résistive s'établit dès le début du flux
        pressure = totalPeep + (pPeak - totalPeep) * (0.3 + 0.7 * progress);
    } else if (tInCycle < tInspTotal) {
        // Pause inspiratoire (débit nul, équilibre de plateau)
        flow = 0;
        volume = vtMl;
        pressure = pPlat;
    } else {
        // Expiration passive (décroissance exponentielle)
        const tExp = tInCycle - tInspTotal;
        const decay = Math.exp(-tExp / Math.max(0.05, tau));
        flow = - (flowInsp * 1.3) * decay; // Débit expiratoire négatif
        volume = vtMl * decay;
        pressure = peep + autoPeep * decay;
    }

    return {
        time: tInCycle,
        pressure: Math.max(0, pressure),
        flow, // L/s (+ insp, - exp)
        volume // mL
    };
}
