/**
 * js/gds.js — Moteur de calculs purs et contrôleur UI pour le Simulateur Gaz du Sang
 * Conforme aux spécifications MedGame / EDN.
 * Zéro dépendance externe. Compatible navigateur et Node.js.
 */

const GDS_CONSTANTS = {
    SOLUBILITY_CO2: 0.0307, // mmol/L/mmHg à 37°C
    PK: 6.1,
    NORMAL_PH: 7.40,
    NORMAL_PACO2: 40.0,
    NORMAL_HCO3: 24.0,
    NORMAL_TA: 12.0,
    NORMAL_ALBUMIN: 40.0,
    RANGES: {
        pH: { min: 6.80, max: 7.80, normMin: 7.35, normMax: 7.45, step: 0.01, unit: '' },
        paCO2: { min: 10, max: 120, normMin: 35, normMax: 45, step: 1, unit: 'mmHg' },
        hco3: { min: 3, max: 55, normMin: 22, normMax: 26, step: 0.5, unit: 'mmol/L' },
        paO2: { min: 20, max: 200, normMin: 75, normMax: 100, step: 1, unit: 'mmHg' },
        saO2: { min: 50, max: 100, normMin: 95, normMax: 100, step: 1, unit: '%' },
        fiO2: { min: 21, max: 100, normMin: 21, normMax: 21, step: 1, unit: '%' },
        lactates: { min: 0.3, max: 20.0, normMin: 0.5, normMax: 2.0, step: 0.1, unit: 'mmol/L' },
        na: { min: 110, max: 170, normMin: 135, normMax: 145, step: 1, unit: 'mmol/L' },
        cl: { min: 65, max: 135, normMin: 95, normMax: 105, step: 1, unit: 'mmol/L' },
        k: { min: 1.5, max: 8.5, normMin: 3.5, normMax: 5.0, step: 0.1, unit: 'mmol/L' },
        albumin: { min: 10, max: 60, normMin: 35, normMax: 45, step: 1, unit: 'g/L' }
    }
};

/**
 * 1. Henderson-Hasselbalch
 * pH = 6.1 + log10( HCO3 / (0.0307 * PaCO2) )
 */
function computeHendersonHasselbalch({ pH, paCO2, hco3, target = 'hco3' }) {
    const alpha = GDS_CONSTANTS.SOLUBILITY_CO2;
    const pK = GDS_CONSTANTS.PK;

    if (target === 'hco3') {
        if (!pH || !paCO2) return null;
        const val = alpha * paCO2 * Math.pow(10, pH - pK);
        return Math.round(val * 10) / 10;
    } else if (target === 'paCO2') {
        if (!pH || !hco3) return null;
        const val = hco3 / (alpha * Math.pow(10, pH - pK));
        return Math.round(val * 10) / 10;
    } else if (target === 'pH') {
        if (!hco3 || !paCO2) return null;
        const val = pK + Math.log10(hco3 / (alpha * paCO2));
        return Math.round(val * 100) / 100;
    }
    return null;
}

/**
 * 2. Trou Anionique (TA) et TA corrigé de l'albumine
 * TA = Na - (Cl + HCO3)
 * TA_corrige = TA + 0.25 * (40 - albumine_g/L)
 */
function computeAnionGap({ na, cl, hco3, albumin = 40 }) {
    if (na == null || cl == null || hco3 == null) return null;
    const measured = na - (cl + hco3);
    const alb = (albumin != null && !isNaN(albumin)) ? albumin : 40;
    const corrected = measured + 0.25 * (40 - alb);

    return {
        measured: Math.round(measured * 10) / 10,
        corrected: Math.round(corrected * 10) / 10,
        isElevated: (corrected > 12.0),
        isAlbuminCorrected: (Math.abs(alb - 40) >= 1)
    };
}

/**
 * 3. Formule de Winter (Acidose métabolique)
 * PaCO2 attendue = 1.5 * HCO3 + 8 (+/- 2)
 */
function computeWinter({ hco3 }) {
    if (hco3 == null) return null;
    const expected = 1.5 * hco3 + 8;
    return {
        expected: Math.round(expected * 10) / 10,
        min: Math.round((expected - 2) * 10) / 10,
        max: Math.round((expected + 2) * 10) / 10
    };
}

/**
 * 4. Compensation de l'alcalose métabolique
 * PaCO2 attendue = 0.7 * HCO3 + 20 (+/- 5)
 */
function computeMetabolicAlkalosisComp({ hco3 }) {
    if (hco3 == null) return null;
    const expected = 0.7 * hco3 + 20;
    return {
        expected: Math.round(expected * 10) / 10,
        min: Math.round((expected - 5) * 10) / 10,
        max: Math.round((expected + 5) * 10) / 10
    };
}

/**
 * 5. Compensation de l'acidose respiratoire
 * PaCO2 > 40
 * Aiguë : +1 mmol/L de HCO3 par 10 mmHg au-dessus de 40 -> 24 + 0.1 * (PaCO2 - 40)
 * Chronique : +3.5 à 4 mmol/L par 10 mmHg au-dessus de 40 -> 24 + 0.38 * (PaCO2 - 40)
 */
function computeRespiratoryAcidosisComp({ paCO2 }) {
    if (paCO2 == null) return null;
    const delta = Math.max(0, paCO2 - 40);
    const acuteExpected = 24 + 0.1 * delta;
    const chronicExpected = 24 + 0.38 * delta;

    return {
        acute: {
            expected: Math.round(acuteExpected * 10) / 10,
            min: Math.round((acuteExpected - 2) * 10) / 10,
            max: Math.round((acuteExpected + 2) * 10) / 10
        },
        chronic: {
            expected: Math.round(chronicExpected * 10) / 10,
            min: Math.round((chronicExpected - 2) * 10) / 10,
            max: Math.round((chronicExpected + 2) * 10) / 10
        }
    };
}

/**
 * 6. Compensation de l'alcalose respiratoire
 * PaCO2 < 40
 * Aiguë : -2 mmol/L de HCO3 par 10 mmHg sous 40 -> 24 - 0.2 * (40 - PaCO2)
 * Chronique : -4 à 5 mmol/L par 10 mmHg sous 40 -> 24 - 0.45 * (40 - PaCO2)
 */
function computeRespiratoryAlkalosisComp({ paCO2 }) {
    if (paCO2 == null) return null;
    const delta = Math.max(0, 40 - paCO2);
    const acuteExpected = 24 - 0.2 * delta;
    const chronicExpected = 24 - 0.45 * delta;

    return {
        acute: {
            expected: Math.round(acuteExpected * 10) / 10,
            min: Math.round((acuteExpected - 2) * 10) / 10,
            max: Math.round((acuteExpected + 2) * 10) / 10
        },
        chronic: {
            expected: Math.round(chronicExpected * 10) / 10,
            min: Math.round((chronicExpected - 2) * 10) / 10,
            max: Math.round((chronicExpected + 2) * 10) / 10
        }
    };
}

/**
 * 7. Delta-Ratio (Δ/Δ)
 * Δ/Δ = (TA - 12) / (24 - HCO3)
 */
function computeDeltaRatio({ anionGap, hco3 }) {
    if (anionGap == null || hco3 == null) return null;
    const deltaTA = anionGap - 12;
    const deltaHCO3 = 24 - hco3;

    if (deltaHCO3 <= 0 || deltaTA <= 0) {
        return {
            ratio: null,
            status: 'Non calculable (réservé aux acidoses métaboliques à TA > 12 et HCO₃⁻ < 24)',
            category: 'not_applicable'
        };
    }

    const ratio = Math.round((deltaTA / deltaHCO3) * 100) / 100;

    let category = 'pure';
    let status = 'Acidose métabolique à trou anionique élevé pure';

    if (ratio < 0.8) {
        category = 'hyperchloremic';
        status = 'Acidose métabolique mixte (à TA élevé + à TA normal / hyperchlorémique associée)';
    } else if (ratio > 2.0) {
        category = 'alkalosis_associated';
        status = 'Alcalose métabolique préexistante associée ou compensation respiratoire chronique';
    }

    return { ratio, status, category };
}

/**
 * 8. Rapport PaO2/FiO2 (Indice de Horovitz)
 */
function computeHorovitzRatio({ paO2, fiO2 }) {
    if (paO2 == null || fiO2 == null) return null;
    const fraction = fiO2 > 1 ? (fiO2 / 100) : fiO2;
    if (fraction <= 0) return null;

    const ratio = Math.round(paO2 / fraction);
    let severity = 'normal';
    let label = 'Oxygénation physiologique normale (> 400 mmHg)';

    if (ratio <= 100) {
        severity = 'severe';
        label = 'SDRA sévère (PaO₂/FiO₂ ≤ 100 mmHg)';
    } else if (ratio <= 200) {
        severity = 'moderate';
        label = 'SDRA modéré (100 < PaO₂/FiO₂ ≤ 200 mmHg)';
    } else if (ratio <= 300) {
        severity = 'mild';
        label = 'SDRA léger (200 < PaO₂/FiO₂ ≤ 300 mmHg)';
    } else if (ratio <= 400) {
        severity = 'low';
        label = 'Hypoxémie modérée (300 < PaO₂/FiO₂ ≤ 400 mmHg)';
    }

    return { ratio, severity, label };
}

/**
 * 9. Standard Base Excess (SBE)
 * SBE = (HCO3 - 24.8) + 16.2 * (pH - 7.40)
 */
function computeBaseExcess({ pH, hco3 }) {
    if (pH == null || hco3 == null) return null;
    const sbe = (hco3 - 24.8) + 16.2 * (pH - 7.40);
    return Math.round(sbe * 10) / 10;
}

/**
 * 10. Analyse complète structurée pas à pas du gaz du sang
 */
function analyzeBloodGas(params) {
    const { pH, paCO2, hco3, paO2, fiO2, lactates, na, cl, k, albumin } = params;

    // Étape 1 : pH
    let phStatus = 'normal';
    let phText = 'Équilibre du pH dans les limites physiologiques (7,35 - 7,45)';
    if (pH < 7.35) {
        phStatus = 'acidemia';
        phText = `Acidémie (${pH < 7.20 ? 'sévère' : 'modérée'}, pH = ${pH.toFixed(2)} < 7,35)`;
    } else if (pH > 7.45) {
        phStatus = 'alkalemia';
        phText = `Alcalémie (${pH > 7.55 ? 'sévère' : 'modérée'}, pH = ${pH.toFixed(2)} > 7,45)`;
    }

    // Étape 2 : Trouble primaire
    let primaryDisorder = 'normal';
    let primaryText = 'Absence de trouble acido-basique manifeste';

    const paco2High = paCO2 > 45;
    const paco2Low = paCO2 < 35;
    const hco3Low = hco3 < 22;
    const hco3High = hco3 > 26;

    if (phStatus === 'acidemia') {
        if (paco2High && hco3Low) {
            primaryDisorder = 'acidose_mixte';
            primaryText = 'Acidose mixte sévère (composante respiratoire ET métabolique associées)';
        } else if (paco2High && !hco3Low) {
            primaryDisorder = 'acidose_respiratoire';
            primaryText = 'Acidose respiratoire primitive (rétention de CO₂, PaCO₂ > 45 mmHg)';
        } else if (hco3Low && !paco2High) {
            primaryDisorder = 'acidose_metabolique';
            primaryText = 'Acidose métabolique primitive (déficit en bicarbonates, HCO₃⁻ < 22 mmol/L)';
        } else {
            primaryDisorder = 'acidose_indeterminee';
            primaryText = 'Acidémie sans trouble univoque caractérisé';
        }
    } else if (phStatus === 'alkalemia') {
        if (paco2Low && hco3High) {
            primaryDisorder = 'alcalose_mixte';
            primaryText = 'Alcalose mixte sévère (composante respiratoire ET métabolique associées)';
        } else if (paco2Low && !hco3High) {
            primaryDisorder = 'alcalose_respiratoire';
            primaryText = 'Alcalose respiratoire primitive (hyperventilation, PaCO₂ < 35 mmHg)';
        } else if (hco3High && !paco2Low) {
            primaryDisorder = 'alcalose_metabolique';
            primaryText = 'Alcalose métabolique primitive (excès de bicarbonates, HCO₃⁻ > 26 mmol/L)';
        } else {
            primaryDisorder = 'alcalose_indeterminee';
            primaryText = 'Alcalémie sans trouble univoque caractérisé';
        }
    } else {
        // pH normal (7.35 - 7.45) : chercher trouble mixte ou compensation complète
        if (paco2Low && hco3Low) {
            primaryDisorder = 'trouble_mixte_salicyle';
            primaryText = 'Trouble mixte à pH normalisé : Acidose métabolique ET Alcalose respiratoire concomitantes (ex. intoxication aux salicylés)';
        } else if (paco2High && hco3High) {
            primaryDisorder = 'trouble_mixte_respi_meta';
            primaryText = 'Trouble mixte à pH normalisé : Acidose respiratoire chronique surcompensée ou Alcalose métabolique compensée';
        }
    }

    // Étape 3 : Évaluation de la compensation
    let compensationText = 'Non applicable';
    let compensationStatus = 'none';
    let expectedComp = null;

    if (primaryDisorder === 'acidose_metabolique') {
        expectedComp = computeWinter({ hco3 });
        if (expectedComp) {
            if (paCO2 < expectedComp.min) {
                compensationStatus = 'excessive';
                compensationText = `Compensation excessive : PaCO₂ observée (${paCO2} mmHg) < cible de Winter (${expectedComp.min} - ${expectedComp.max} mmHg) → Alcalose respiratoire surajoutée`;
            } else if (paCO2 > expectedComp.max) {
                compensationStatus = 'insufficient';
                compensationText = `Compensation insuffisante : PaCO₂ observée (${paCO2} mmHg) > cible de Winter (${expectedComp.min} - ${expectedComp.max} mmHg) → Acidose respiratoire surajoutée (épuisement musculaire)`;
            } else {
                compensationStatus = 'adapted';
                compensationText = `Compensation respiratoire adaptée : PaCO₂ observée (${paCO2} mmHg) dans l'intervalle de Winter (${expectedComp.min} - ${expectedComp.max} mmHg)`;
            }
        }
    } else if (primaryDisorder === 'alcalose_metabolique') {
        expectedComp = computeMetabolicAlkalosisComp({ hco3 });
        if (expectedComp) {
            if (paCO2 < expectedComp.min) {
                compensationStatus = 'insufficient';
                compensationText = `Hypoventilation insuffisante : PaCO₂ observée (${paCO2} mmHg) < cible attendue (${expectedComp.min} - ${expectedComp.max} mmHg) → Alcalose respiratoire surajoutée`;
            } else if (paCO2 > expectedComp.max) {
                compensationStatus = 'excessive';
                compensationText = `Hypoventilation marquée : PaCO₂ observée (${paCO2} mmHg) > cible attendue (${expectedComp.min} - ${expectedComp.max} mmHg) → Acidose respiratoire surajoutée`;
            } else {
                compensationStatus = 'adapted';
                compensationText = `Compensation respiratoire adaptée : PaCO₂ observée (${paCO2} mmHg) dans la cible attendue (${expectedComp.min} - ${expectedComp.max} mmHg)`;
            }
        }
    } else if (primaryDisorder === 'acidose_respiratoire') {
        expectedComp = computeRespiratoryAcidosisComp({ paCO2 });
        if (expectedComp) {
            const acuteRange = expectedComp.acute;
            const chronicRange = expectedComp.chronic;
            if (hco3 <= acuteRange.max) {
                compensationStatus = 'acute';
                compensationText = `Acidose respiratoire aiguë : HCO₃⁻ (${hco3} mmol/L) proche de la réponse aiguë immédiate (${acuteRange.expected} ± 2 mmol/L), pas de compensation rénale visible`;
            } else if (hco3 >= chronicRange.min && hco3 <= chronicRange.max) {
                compensationStatus = 'chronic';
                compensationText = `Acidose respiratoire chronique : HCO₃⁻ (${hco3} mmol/L) en accord avec la réponse rénale chronique (${chronicRange.expected} ± 2 mmol/L)`;
            } else if (hco3 > acuteRange.max && hco3 < chronicRange.min) {
                compensationStatus = 'subacute';
                compensationText = `Acidose respiratoire subaiguë ou aiguë sur chronique : HCO₃⁻ (${hco3} mmol/L) entre réponse aiguë (${acuteRange.expected}) et chronique (${chronicRange.expected})`;
            } else {
                compensationStatus = 'metabolic_alk_superimposed';
                compensationText = `HCO₃⁻ très élevé (${hco3} mmol/L) dépassant la compensation rénale maximale attendue → Alcalose métabolique surajoutée`;
            }
        }
    } else if (primaryDisorder === 'alcalose_respiratoire') {
        expectedComp = computeRespiratoryAlkalosisComp({ paCO2 });
        if (expectedComp) {
            const acuteRange = expectedComp.acute;
            const chronicRange = expectedComp.chronic;
            if (hco3 >= acuteRange.min) {
                compensationStatus = 'acute';
                compensationText = `Alcalose respiratoire aiguë : HCO₃⁻ (${hco3} mmol/L) conforme aux tampons physico-chimiques immédiats (${acuteRange.expected} ± 2 mmol/L)`;
            } else if (hco3 >= chronicRange.min && hco3 <= chronicRange.max) {
                compensationStatus = 'chronic';
                compensationText = `Alcalose respiratoire chronique : HCO₃⁻ (${hco3} mmol/L) conforme à l'adaptation rénale (${chronicRange.expected} ± 2 mmol/L)`;
            } else {
                compensationStatus = 'metabolic_acid_superimposed';
                compensationText = `HCO₃⁻ très abaissé (${hco3} mmol/L) → Acidose métabolique surajoutée`;
            }
        }
    }

    // Étape 4 : Trou Anionique & Delta Ratio
    const agData = computeAnionGap({ na, cl, hco3, albumin });
    let agText = 'Données ioniques incomplètes';
    let deltaData = null;

    if (agData) {
        const agValue = agData.corrected;
        if (agData.isElevated) {
            deltaData = computeDeltaRatio({ anionGap: agValue, hco3 });
            agText = `Trou anionique élevé (${agValue} mmol/L${agData.isAlbuminCorrected ? ' [corrigé albumine]' : ''} > 12 mmol/L). Étiologies : Cétose, Lactates, Toxiques (salicylés, méthanol, éthylène glycol), Insuffisance rénale sévère.`;
        } else {
            agText = `Trou anionique normal (${agValue} mmol/L${agData.isAlbuminCorrected ? ' [corrigé albumine]' : ''}, réf 8-12). Étiologies si acidose métabolique : pertes digestives de bicarbonates (diarrhée), acidose tubulaire rénale, perfusion abondante de NaCl 0,9%.`;
        }
    }

    // Étape 5 : Oxygénation & Métabolisme
    const pfData = computeHorovitzRatio({ paO2, fiO2 });
    let lactateText = 'Lactates normaux';
    if (lactates > 4.0) {
        lactateText = `Hyperlactatémie majeure (${lactates} mmol/L ≥ 4 mmol/L) : état de choc ou hypoperfusion tissulaire critique`;
    } else if (lactates > 2.0) {
        lactateText = `Hyperlactatémie modérée (${lactates} mmol/L > 2 mmol/L)`;
    }

    let kText = 'Kaliémie normale';
    if (k < 3.5) {
        kText = `Hypokaliémie (${k} mmol/L < 3,5 mmol/L) : risque de troubles du rythme ventriculaire`;
    } else if (k > 5.0) {
        kText = `Hyperkaliémie (${k} mmol/L > 5,0 mmol/L) : surveillance ECG impérative (ondes T pointues, bloc)`;
    }

    // Étape 6 : Diagnostic synthétique & Position Davenport
    let davenportZone = 'Zone physiologique normale (point central 7,40 ; 24)';
    if (pH < 7.35 && paCO2 > 45) {
        davenportZone = (hco3 > 28) ? 'Quadrant supérieur gauche : Acidose respiratoire chronique (au-dessus de la ligne tampon)' : 'Quadrant supérieur gauche : Acidose respiratoire aiguë (le long de la ligne tampon normale)';
    } else if (pH < 7.35 && hco3 < 22) {
        davenportZone = 'Quadrant inférieur gauche : Acidose métabolique (déplacement sous l\'isobare 40 mmHg)';
    } else if (pH > 7.45 && paCO2 < 35) {
        davenportZone = (hco3 < 20) ? 'Quadrant inférieur droit : Alcalose respiratoire chronique (sous la ligne tampon)' : 'Quadrant inférieur droit : Alcalose respiratoire aiguë (le long de la ligne tampon normale)';
    } else if (pH > 7.45 && hco3 > 26) {
        davenportZone = 'Quadrant supérieur droit : Alcalose métabolique (déplacement au-dessus de l\'isobare 40 mmHg)';
    } else if (paco2Low && hco3Low) {
        davenportZone = 'Zone mixte d\'hyperventilation avec acidose métabolique';
    }

    const sbe = computeBaseExcess({ pH, hco3 });

    return {
        step1: { status: phStatus, text: phText, pH },
        step2: { disorder: primaryDisorder, text: primaryText },
        step3: { status: compensationStatus, text: compensationText, expected: expectedComp },
        step4: { anionGap: agData, deltaRatio: deltaData, text: agText },
        step5: { horovitz: pfData, lactateText, kText, lactates, k },
        step6: { zone: davenportZone, sbe },
        summary: `${phText}. ${primaryText}. ${compensationText}`
    };
}

/**
 * 11. Générateur de cas physiologiques cohérents
 */
function generateRandomCase(type = 'random') {
    const types = [
        'dka',
        'septic_shock',
        'copd_decomp',
        'salicylate',
        'pyloric_alkalosis',
        'hyperventilation',
        'diarrhea'
    ];
    const selected = (type === 'random' || !types.includes(type))
        ? types[Math.floor(Math.random() * types.length)]
        : type;

    switch (selected) {
        case 'dka': {
            const hco3 = Math.round((5 + Math.random() * 5) * 10) / 10;
            const winter = 1.5 * hco3 + 8 + (Math.random() * 2 - 1);
            const paCO2 = Math.round(winter);
            const pH = computeHendersonHasselbalch({ paCO2, hco3, target: 'pH' });
            return {
                pH, paCO2, hco3,
                paO2: Math.round(95 + Math.random() * 10),
                saO2: 99,
                fiO2: 21,
                lactates: Math.round((1.0 + Math.random() * 1.0) * 10) / 10,
                na: Math.round(130 + Math.random() * 6),
                cl: Math.round(94 + Math.random() * 6),
                k: Math.round((4.8 + Math.random() * 1.2) * 10) / 10,
                albumin: 40,
                name: 'Acidocétose diabétique (cas généré)'
            };
        }
        case 'septic_shock': {
            const hco3 = Math.round((9 + Math.random() * 4) * 10) / 10;
            const paCO2 = Math.round(1.5 * hco3 + 8 + (Math.random() * 3));
            const pH = computeHendersonHasselbalch({ paCO2, hco3, target: 'pH' });
            return {
                pH, paCO2, hco3,
                paO2: Math.round(58 + Math.random() * 12),
                saO2: 88,
                fiO2: 21,
                lactates: Math.round((4.5 + Math.random() * 4.0) * 10) / 10,
                na: 137,
                cl: 100,
                k: Math.round((4.2 + Math.random() * 1.0) * 10) / 10,
                albumin: Math.round(24 + Math.random() * 6),
                name: 'Acidose lactique sur choc septique (cas généré)'
            };
        }
        case 'copd_decomp': {
            const paCO2 = Math.round(65 + Math.random() * 18);
            const hco3 = Math.round((28 + Math.random() * 6) * 10) / 10;
            const pH = computeHendersonHasselbalch({ paCO2, hco3, target: 'pH' });
            return {
                pH, paCO2, hco3,
                paO2: Math.round(44 + Math.random() * 10),
                saO2: 79,
                fiO2: 21,
                lactates: 1.3,
                na: 140,
                cl: 96,
                k: 4.4,
                albumin: 40,
                name: 'Acidose respiratoire aiguë sur décompensation BPCO (cas généré)'
            };
        }
        case 'salicylate': {
            const paCO2 = Math.round(16 + Math.random() * 6);
            const hco3 = Math.round((10 + Math.random() * 4) * 10) / 10;
            const pH = computeHendersonHasselbalch({ paCO2, hco3, target: 'pH' });
            return {
                pH, paCO2, hco3,
                paO2: 105,
                saO2: 100,
                fiO2: 21,
                lactates: 2.5,
                na: 142,
                cl: 104,
                k: 3.5,
                albumin: 40,
                name: 'Intoxication aux salicylés (trouble mixte, cas généré)'
            };
        }
        case 'pyloric_alkalosis': {
            const hco3 = Math.round((38 + Math.random() * 8) * 10) / 10;
            const paCO2 = Math.round(0.7 * hco3 + 20 + (Math.random() * 4 - 2));
            const pH = computeHendersonHasselbalch({ paCO2, hco3, target: 'pH' });
            return {
                pH, paCO2, hco3,
                paO2: 86,
                saO2: 97,
                fiO2: 21,
                lactates: 1.1,
                na: 138,
                cl: Math.round(76 + Math.random() * 6),
                k: Math.round((2.6 + Math.random() * 0.6) * 10) / 10,
                albumin: 42,
                name: 'Alcalose métabolique sur vomissements (cas généré)'
            };
        }
        case 'hyperventilation': {
            const paCO2 = Math.round(20 + Math.random() * 6);
            const hco3 = Math.round((24 - 0.2 * (40 - paCO2) + (Math.random() * 2 - 1)) * 10) / 10;
            const pH = computeHendersonHasselbalch({ paCO2, hco3, target: 'pH' });
            return {
                pH, paCO2, hco3,
                paO2: 110,
                saO2: 100,
                fiO2: 21,
                lactates: 1.0,
                na: 140,
                cl: 106,
                k: 3.7,
                albumin: 42,
                name: 'Alcalose respiratoire aiguë sur hyperventilation (cas généré)'
            };
        }
        default: {
            const hco3 = Math.round((11 + Math.random() * 4) * 10) / 10;
            const paCO2 = Math.round(1.5 * hco3 + 8);
            const pH = computeHendersonHasselbalch({ paCO2, hco3, target: 'pH' });
            return {
                pH, paCO2, hco3,
                paO2: 96,
                saO2: 98,
                fiO2: 21,
                lactates: 1.2,
                na: 138,
                cl: 115,
                k: 3.2,
                albumin: 40,
                name: 'Acidose métabolique à TA normal sur diarrhée (cas généré)'
            };
        }
    }
}

// Module export for Node.js tests & window attachment for browser
const GDS = {
    CONSTANTS: GDS_CONSTANTS,
    computeHendersonHasselbalch,
    computeAnionGap,
    computeWinter,
    computeMetabolicAlkalosisComp,
    computeRespiratoryAcidosisComp,
    computeRespiratoryAlkalosisComp,
    computeDeltaRatio,
    computeHorovitzRatio,
    computeBaseExcess,
    analyzeBloodGas,
    generateRandomCase
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GDS;
}
if (typeof window !== 'undefined') {
    window.GDS = GDS;
}
