/**
 * js/pse-engine.js — Moteur de calcul pharmacocinétique et de sécurité des Pousse-Seringues Électriques (PSE)
 * 
 * Conforme aux protocoles hospitaliers français et aux items EDN/ECOS de réanimation/urgences :
 * - Calculs de débits en mL/h, doses en µg/kg/min ou mg/h ou UI/h
 * - Contrôle strict des règles de sécurité (ex: règles absolues du KCl)
 * - Simulation hémodynamique et glycérique en temps réel
 * 
 * Aucune dépendance DOM — testable avec node:test.
 */

export const DRUG_DATABASE = {
    noradrenaline: {
        id: 'noradrenaline',
        name: 'Noradrénaline (Norepinephrine)',
        unit: 'mcg_kg_min', // µg/kg/min
        baseUnitLabel: 'µg/kg/min',
        defaultDose: 0.2, // µg/kg/min
        minDose: 0.05,
        maxDose: 2.5,
        dilutions: [
            { id: 'std_8mg_50ml', label: '8 mg dans 50 mL (0.16 mg/mL = 160 µg/mL)', concMgMl: 0.16 },
            { id: 'conc_16mg_50ml', label: '16 mg dans 50 mL (0.32 mg/mL = 320 µg/mL)', concMgMl: 0.32 },
            { id: 'simple_4mg_40ml', label: '4 mg dans 40 mL (0.10 mg/mL = 100 µg/mL)', concMgMl: 0.10 }
        ],
        vehicle: 'G5% ou NaCl 0.9%',
        targetClinical: 'PAM cible ≥ 65 mmHg en choc septique',
        contraindicatedFlash: true
    },
    dobutamine: {
        id: 'dobutamine',
        name: 'Dobutamine (Inotrope)',
        unit: 'mcg_kg_min',
        baseUnitLabel: 'µg/kg/min',
        defaultDose: 5.0,
        minDose: 2.5,
        maxDose: 20.0,
        dilutions: [
            { id: 'std_250mg_50ml', label: '250 mg dans 50 mL (5.0 mg/mL = 5000 µg/mL)', concMgMl: 5.0 }
        ],
        vehicle: 'G5% ou NaCl 0.9%',
        targetClinical: 'Index cardiaque > 2.2 L/min/m² en choc cardiogénique',
        contraindicatedFlash: true
    },
    insuline: {
        id: 'insuline',
        name: 'Insuline Rapide IVSE (Actrapid)',
        unit: 'ui_kg_h', // UI/kg/h
        baseUnitLabel: 'UI/kg/h',
        defaultDose: 0.1, // UI/kg/h
        minDose: 0.02,
        maxDose: 0.3,
        dilutions: [
            { id: 'std_50ui_50ml', label: '50 UI dans 50 mL NaCl 0.9% (1 UI/mL)', concMgMl: 1.0 } // 1 UI = 1 "mg" conceptuel pour le ratio
        ],
        vehicle: 'NaCl 0.9% (rincer la tubulure)',
        targetClinical: 'Baisse glycérique 0.5 à 1 g/L/h (acidocétose)',
        contraindicatedFlash: false
    },
    nicardipine: {
        id: 'nicardipine',
        name: 'Nicardipine (Loxen)',
        unit: 'mg_h', // mg/h
        baseUnitLabel: 'mg/h',
        defaultDose: 2.0, // mg/h
        minDose: 0.5,
        maxDose: 10.0,
        dilutions: [
            { id: 'std_10mg_10ml', label: '10 mg dans 10 mL (1.0 mg/mL)', concMgMl: 1.0 },
            { id: 'std_50mg_50ml', label: '50 mg dans 50 mL (1.0 mg/mL)', concMgMl: 1.0 }
        ],
        vehicle: 'G5% ou NaCl 0.9%',
        targetClinical: 'Contrôle tensionnel progressif (PAS < 140 mmHg)',
        contraindicatedFlash: false
    },
    kcl: {
        id: 'kcl',
        name: 'Chlorure de Potassium (KCl)',
        unit: 'g_h', // g/h
        baseUnitLabel: 'g/h',
        defaultDose: 1.0, // g/h max sur VVP
        minDose: 0.25,
        maxDose: 2.0, // Sur VVC uniquement avec scope
        dilutions: [
            { id: 'periph_4g_1000ml', label: '4 g dans 1000 mL (0.004 g/mL = 4 g/L)', concMgMl: 4.0 },
            { id: 'pse_2g_50ml', label: '2 g dans 50 mL sur VVC (0.04 g/mL = 40 mg/mL)', concMgMl: 40.0 }
        ],
        vehicle: 'NaCl 0.9% ou G5%',
        targetClinical: 'Correction kaliémie (cible 4.0 à 4.5 mmol/L)',
        contraindicatedFlash: true, // BOLUS STRICTEMENT MORTEL
        strictRules: [
            'JAMAIS en injection directe / bolus (risque d\'arrêt cardiaque immédiat par asystolie)',
            'Débit maximum sur voie veineuse périphérique (VVP) : 1 g/h',
            'Concentration maximale sur VVP : 4 g/L (veinotoxicité et nécrose)',
            'Surveillance scope ECG obligatoire si débit > 1 g/h sur VVC'
        ]
    }
};

/**
 * Calcule le débit en mL/h requis pour délivrer la posologie cible
 */
export function calculateFlowRate(drugId, targetDose, weightKg, concMgMl) {
    const drug = DRUG_DATABASE[drugId];
    if (!drug || !concMgMl || concMgMl <= 0) return 0;

    let flowRate = 0;

    if (drug.unit === 'mcg_kg_min') {
        // targetDose en µg/kg/min
        // Dose totale par minute = targetDose * weightKg (µg/min)
        // Dose totale par heure = targetDose * weightKg * 60 (µg/h)
        // conc en µg/mL = concMgMl * 1000
        const dosePerHourMcg = targetDose * weightKg * 60;
        const concMcgMl = concMgMl * 1000;
        flowRate = dosePerHourMcg / concMcgMl;
    } else if (drug.unit === 'ui_kg_h') {
        // targetDose en UI/kg/h
        // concMgMl représente les UI/mL
        const dosePerHourUi = targetDose * weightKg;
        flowRate = dosePerHourUi / concMgMl;
    } else if (drug.unit === 'mg_h') {
        flowRate = targetDose / concMgMl;
    } else if (drug.unit === 'g_h') {
        // targetDose en g/h, concMgMl en mg/mL (1 mg/mL = 0.001 g/mL = 1 g/L)
        const concGMl = concMgMl / 1000;
        flowRate = targetDose / concGMl;
    }

    return Math.round(flowRate * 100) / 100;
}

/**
 * Calcule la posologie réelle délivrée à partir du débit mL/h
 */
export function calculateDeliveredDose(drugId, flowRateMlH, weightKg, concMgMl) {
    const drug = DRUG_DATABASE[drugId];
    if (!drug || !concMgMl || concMgMl <= 0) return 0;

    if (drug.unit === 'mcg_kg_min') {
        if (!weightKg || weightKg <= 0) return 0;
        const concMcgMl = concMgMl * 1000;
        const dosePerHourMcg = flowRateMlH * concMcgMl;
        const dosePerMinPerKg = dosePerHourMcg / (weightKg * 60);
        return Math.round(dosePerMinPerKg * 1000) / 1000;
    } else if (drug.unit === 'ui_kg_h') {
        if (!weightKg || weightKg <= 0) return 0;
        const dosePerHourUi = flowRateMlH * concMgMl;
        return Math.round((dosePerHourUi / weightKg) * 100) / 100;
    } else if (drug.unit === 'mg_h') {
        return Math.round((flowRateMlH * concMgMl) * 100) / 100;
    } else if (drug.unit === 'g_h') {
        // flowRate en mL/h, concMgMl en mg/mL = g/L -> conc en g/mL = concMgMl / 1000
        const concGMl = concMgMl / 1000;
        return Math.round((flowRateMlH * concGMl) * 100) / 100;
    }

    return 0;
}

/**
 * Valide les critères de sécurité d'une prescription PSE
 */
export function validatePseSafety(drugId, flowRateMlH, concMgMl, weightKg, route = 'VVP') {
    const drug = DRUG_DATABASE[drugId];
    const errors = [];
    const warnings = [];

    if (!drug) {
        errors.push('Médicament non reconnu');
        return { valid: false, errors, warnings };
    }

    const dose = calculateDeliveredDose(drugId, flowRateMlH, weightKg, concMgMl);

    // Sécurité KCl absolue
    if (drugId === 'kcl') {
        // dose est en g/h
        if (flowRateMlH > 0 && dose <= 0) {
            errors.push('Calcul de concentration KCl invalide');
        }
        if (route === 'VVP' && dose > 1.05) {
            errors.push('DANGER MORTEL : Débit KCl > 1 g/h sur voie veineuse périphérique (max 1 g/h)');
        }
        if (route === 'VVP' && concMgMl > 4.05) {
            errors.push('DANGER : Concentration de KCl > 4 g/L sur voie veineuse périphérique (risque de nécrose veineuse)');
        }
        if (dose > 2.05) {
            errors.push('Dépassement du débit maximal absolu de KCl (> 2 g/h), arrêt cardiaque imminent');
        }
    }

    // Sécurité Noradrénaline
    if (drugId === 'noradrenaline') {
        if (dose > 3.0) {
            warnings.push('Dose de noradrénaline très élevée (> 3.0 µg/kg/min) : vérifier la volémie et envisager vasopressine');
        }
        if (dose < 0.05 && flowRateMlH > 0) {
            warnings.push('Dose infra-thérapeutique de noradrénaline (< 0.05 µg/kg/min)');
        }
    }

    // Sécurité Insuline
    if (drugId === 'insuline') {
        if (dose > 0.25) {
            warnings.push('Dose d\'insuline élevée (> 0.25 UI/kg/h) : risque majeur d\'hypoglycémie et d\'hypokaliémie');
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        deliveredDose: dose,
        unit: drug.baseUnitLabel
    };
}

/**
 * Scénarios cliniques d'entraînement EDN/ECOS
 */
export const PSE_CLINICAL_CASES = [
    {
        id: 'case_septic_shock',
        title: 'Choc Septique sur Pyélonéphrite (item 330)',
        patient: { name: 'Mme Jeanne R.', age: 68, weight: 60, context: 'Patiente admise aux urgences fébrile à 39.5°C, marbrures aux genoux, PA 75/40 mmHg (PAM 51 mmHg), tachycarde à 120 bpm. Remplissage par 30 mL/kg de cristalloïdes déjà réalisé.' },
        drugId: 'noradrenaline',
        recommendedDilution: 'std_8mg_50ml',
        targetDose: 0.3, // µg/kg/min
        expectedFlowRange: [6.5, 7.0], // 0.3 * 60 * 60 / 160 = 6.75 mL/h
        question: 'Calculez le débit en mL/h pour administrer 0.3 µg/kg/min de Noradrénaline avec une seringue de 8 mg dans 50 mL chez cette patiente de 60 kg.',
        explanation: 'Dose horaire = 0.3 µg/kg/min × 60 kg × 60 min = 1080 µg/h = 1.08 mg/h. Concentration = 8 mg / 50 mL = 0.16 mg/mL (160 µg/mL). Débit = 1080 / 160 = 6.75 mL/h.'
    },
    {
        id: 'case_dka_insulin',
        title: 'Acidocétose Diabétique Inaugurale (item 247)',
        patient: { name: 'Lucas B.', age: 24, weight: 70, context: 'Acidocétose avec glycémie à 4.2 g/L, pH 7.15, cétonémie 5.2 mmol/L. Réhydratation débutée.' },
        drugId: 'insuline',
        recommendedDilution: 'std_50ui_50ml',
        targetDose: 0.1, // UI/kg/h
        expectedFlowRange: [6.9, 7.1], // 0.1 * 70 / 1 = 7 mL/h
        question: 'Quel est le débit horaire de la seringue d\'insuline rapide (50 UI dans 50 mL de NaCl 0.9%) pour une posologie de 0.1 UI/kg/h ?',
        explanation: 'Concentration = 50 UI / 50 mL = 1 UI/mL. Pour 70 kg à 0.1 UI/kg/h, la dose est de 7 UI/h, soit exactement 7.0 mL/h.'
    },
    {
        id: 'case_hypokalemia_kcl',
        title: 'Hypokaliémie Sévère Symptomatique (item 267)',
        patient: { name: 'Alain D.', age: 58, weight: 75, context: 'Kaliémie à 2.4 mmol/L avec ondes U et sous-décalage ST à l\'ECG. Voie veineuse périphérique en place.' },
        drugId: 'kcl',
        recommendedDilution: 'periph_4g_1000ml',
        targetDose: 1.0, // g/h
        expectedFlowRange: [240, 260], // 1 g/h dans poche 4 g/L = 250 mL/h
        question: 'Vous préparez une perfusion de KCl sur voie veineuse périphérique. Quelle est la vitesse maximale d\'administration autorisée ?',
        explanation: 'Règle absolue : sur voie périphérique, le débit de KCl ne doit JAMAIS dépasser 1 g/h (environ 13.4 mmol/h) et la concentration max est de 4 g/L pour éviter le risque d\'arrêt cardiaque et de nécrose veineuse.'
    }
];
