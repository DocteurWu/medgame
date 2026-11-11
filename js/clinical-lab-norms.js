/**
 * js/clinical-lab-norms.js — Normes Biologiques et Moteur de Compte-Rendu CHU
 *
 * Conçu pour les étudiants en médecine (DFASM / ECOS / EDN R2C).
 * Références : HAS, Collèges des Enseignants de Biochimie, Hématologie et Réanimation.
 *
 * Rôle :
 * 1. Dictionnaire des intervalles de référence physiologiques adultes.
 * 2. Détection et extraction des valeurs biologiques dans les résultats d'examens.
 * 3. Formatage en feuille de biologie médicale hospitalière avec alertes sémiologiques.
 */

(function () {
    'use strict';

    function escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    /**
     * Intervalles de référence physiologiques standards adultes.
     * min, max, unit, criticalLow, criticalHigh, clinicalAdvice
     */
    const LAB_NORMS = {
        // --- IONOGRAMME ET FONCTION RÉNALE ---
        potassium: {
            aliases: ['potassium', 'k+', 'kaliémie', 'kaliemie', 'k'],
            label: 'Potassium (K⁺)',
            min: 3.5,
            max: 5.0,
            unit: 'mmol/L',
            criticalLow: 2.8,
            criticalHigh: 6.0,
            criticalMsg: 'Urgence métabolique : risque majeur de troubles du rythme ventriculaire (réaliser un ECG immédiat).'
        },
        sodium: {
            aliases: ['sodium', 'na+', 'natrémie', 'natremie', 'na'],
            label: 'Sodium (Na⁺)',
            min: 135,
            max: 145,
            unit: 'mmol/L',
            criticalLow: 125,
            criticalHigh: 155,
            criticalMsg: 'Dysnatrémie sévère : risque de complications neurologiques (œdème cérébral ou myélinolyse centro-pontine).'
        },
        chlore: {
            aliases: ['chlore', 'cl-', 'chlorémie', 'chloremie', 'cl'],
            label: 'Chlore (Cl⁻)',
            min: 96,
            max: 106,
            unit: 'mmol/L'
        },
        bicarbonates: {
            aliases: ['bicarbonates', 'reserve alcaline', 'réserve alcaline', 'hco3-', 'hco3'],
            label: 'Bicarbonates (HCO₃⁻)',
            min: 22,
            max: 28,
            unit: 'mmol/L',
            criticalLow: 14,
            criticalMsg: 'Acidose métabolique sévère : calculer le trou anionique plasmatique.'
        },
        creatinine: {
            aliases: ['créatinine', 'creatinine', 'créatininémie', 'creatininemie', 'créat', 'creat'],
            label: 'Créatininémie',
            min: 50,
            max: 110,
            unit: 'µmol/L',
            criticalHigh: 250,
            criticalMsg: 'Insuffisance rénale aiguë potentielle : vérifier la diurèse et adapter les posologies médicamenteuses.'
        },
        uree: {
            aliases: ['urée', 'uree', 'urémie', 'uremie'],
            label: 'Urée sanguine',
            min: 2.5,
            max: 7.5,
            unit: 'mmol/L',
            criticalHigh: 20
        },

        // --- INFLAMMATION & MARQUEURS SÉVÉRITÉ ---
        crp: {
            aliases: ['crp', 'c-reactive protein', 'protéine c-réactive', 'proteine c-reactive'],
            label: 'Protéine C-Réactive (CRP)',
            min: 0,
            max: 5.0,
            unit: 'mg/L',
            criticalHigh: 100,
            criticalMsg: 'Syndrome inflammatoire majeur : évoquer une infection bactérienne sévère, abcès ou sepsis.'
        },
        pct: {
            aliases: ['procalcitonine', 'pct'],
            label: 'Procalcitonine (PCT)',
            min: 0,
            max: 0.25,
            unit: 'µg/L',
            criticalHigh: 0.5,
            criticalMsg: 'Élévation de la PCT en faveur d’une infection bactérienne invasive systémique.'
        },

        // --- MARQUEURS CARDIOVASCULAIRES ---
        troponine: {
            aliases: ['troponine', 'troponine i', 'troponine t', 'tnt', 'tni', 'c-tni', 'c-tnt', 'hs-ctn'],
            label: 'Troponine ultra-sensible (hs-cTn)',
            min: 0,
            max: 14,
            unit: 'ng/L',
            criticalHigh: 50,
            criticalMsg: 'Nécrose myocardique aiguë : évoquer en priorité un Syndrome Coronarien Aigu (SCA), une myocardite ou une EP grave.'
        },
        ddimeres: {
            aliases: ['d-dimères', 'd-dimeres', 'ddimeres', 'd dimères', 'd dimeres'],
            label: 'D-Dimères',
            min: 0,
            max: 500,
            unit: 'ng/mL',
            criticalHigh: 1000,
            criticalMsg: 'D-Dimères positifs : suspicion de Maladie Thrombo-Embolique Veineuse (TVP/EP) ou CIVD. (Attention au seuil ajusté à l’âge > 50 ans : Âge × 10 ng/mL).'
        },
        bnp: {
            aliases: ['bnp', 'nt-probnp', 'nt probnp', 'brain natriuretic peptide'],
            label: 'Peptide Natriurétique (BNP / NT-proBNP)',
            min: 0,
            max: 100,
            unit: 'pg/mL',
            criticalHigh: 400,
            criticalMsg: 'Élévation des peptides natriurétiques en faveur d’une décompensation cardiaque congestive.'
        },

        // --- HÉMOGRAMME (NFS) ---
        hemoglobine: {
            aliases: ['hémoglobine', 'hemoglobine', 'hb'],
            label: 'Hémoglobine (Hb)',
            min: 12.0,
            max: 17.0,
            unit: 'g/dL',
            criticalLow: 7.0,
            criticalMsg: 'Anémie sévère : évaluer la tolérance hémodynamique et l’indication transfusionnelle urgente.'
        },
        leucocytes: {
            aliases: ['leucocytes', 'globules blancs', 'gb', 'leuco'],
            label: 'Leucocytes',
            min: 4.0,
            max: 10.0,
            unit: 'G/L',
            criticalLow: 1.0,
            criticalHigh: 20.0,
            criticalMsg: 'Hyperleucocytose majeure ou neutropénie sévère.'
        },
        plaquettes: {
            aliases: ['plaquettes', 'plaq', 'thrombocytes'],
            label: 'Plaquettes',
            min: 150,
            max: 400,
            unit: 'G/L',
            criticalLow: 30,
            criticalMsg: 'Thrombopénie sévère : risque hémorragique spontané élevé, contre-indication absolue aux anticoagulants.'
        },

        // --- HÉPATIQUE & PANCRÉATIQUE ---
        alat: {
            aliases: ['alat', 'tgp', 'alanine aminotransferase'],
            label: 'ALAT (TGP)',
            min: 0,
            max: 45,
            unit: 'UI/L',
            criticalHigh: 200,
            criticalMsg: 'Cytolyse hépatique aiguë : rechercher une cause ischémique, toxique (paracétamol) ou virale.'
        },
        asat: {
            aliases: ['asat', 'tgo', 'aspartate aminotransferase'],
            label: 'ASAT (TGO)',
            min: 0,
            max: 35,
            unit: 'UI/L'
        },
        bilirubine: {
            aliases: ['bilirubine', 'bilirubine totale', 'bili'],
            label: 'Bilirubine totale',
            min: 0,
            max: 20,
            unit: 'µmol/L',
            criticalHigh: 50,
            criticalMsg: 'Ictère clinique franc : différencier rétention biliaire (cholestase) et hémolyse.'
        },
        lipase: {
            aliases: ['lipase', 'lipasémie', 'lipasemie'],
            label: 'Lipasémie',
            min: 0,
            max: 60,
            unit: 'UI/L',
            criticalHigh: 180,
            criticalMsg: 'Pancréatite aiguë confirmée si Lipasémie > 3 × la limite supérieure normale (> 180 UI/L).'
        },

        // --- GAZ DU SANG & MÉTABOLISME ---
        lactates: {
            aliases: ['lactates', 'acide lactique', 'lactate'],
            label: 'Lactates artériels',
            min: 0.5,
            max: 2.0,
            unit: 'mmol/L',
            criticalHigh: 4.0,
            criticalMsg: 'Hyperlactatémie sévère : marqueur d’hypoperfusion tissulaire ou d’état de choc (Golden Hour).'
        },
        ph: {
            aliases: ['ph', 'ph sanguin'],
            label: 'pH artériel',
            min: 7.35,
            max: 7.45,
            unit: '',
            criticalLow: 7.20,
            criticalHigh: 7.55,
            criticalMsg: 'Trouble acido-basique sévère : risque d’incompétence myocardique et d’arythmies.'
        },
        pao2: {
            aliases: ['pao2', 'po2'],
            label: 'PaO₂ (air ambiant)',
            min: 80,
            max: 100,
            unit: 'mmHg',
            criticalLow: 60,
            criticalMsg: 'Hypoxémie sévère / Insuffisance respiratoire aiguë : oxygénothérapie immédiate requise.'
        },
        paco2: {
            aliases: ['paco2', 'pco2'],
            label: 'PaCO₂',
            min: 35,
            max: 45,
            unit: 'mmHg',
            criticalHigh: 60,
            criticalMsg: 'Hypercapnie sévère : risque d’encéphalopathie respiratoire.'
        },
        glycemie: {
            aliases: ['glycémie', 'glycemie', 'glycémie veineuse', 'glycémie à jeun'],
            label: 'Glycémie veineuse',
            min: 3.9,
            max: 5.8,
            unit: 'mmol/L',
            criticalLow: 2.8,
            criticalHigh: 15.0,
            criticalMsg: 'Hypoglycémie sévère (resucrage IV d’urgence) ou hyperglycémie majeure (rechercher acidocétose/SHH).'
        },
        calcemie: {
            aliases: ['calcémie', 'calcemie', 'calcium', 'ca2+'],
            label: 'Calcémie',
            min: 2.15,
            max: 2.55,
            unit: 'mmol/L',
            criticalLow: 1.80,
            criticalHigh: 3.00,
            criticalMsg: 'Dyskaliémie ou dyscalcémie aiguë : risque majeur de troubles du rythme (onde T, espace QT court/long).'
        },
        tp: {
            aliases: ['tp', 'taux de prothrombine'],
            label: 'Taux de Prothrombine (TP)',
            min: 70,
            max: 100,
            unit: '%',
            criticalLow: 50,
            criticalMsg: 'Insuffisance hépatocellulaire sévère ou surdosage en AVK.'
        },
        inr: {
            aliases: ['inr'],
            label: 'INR',
            min: 0.8,
            max: 1.2,
            unit: '',
            criticalHigh: 4.5,
            criticalMsg: 'Surdosage majeur en AVK : risque hémorragique menaçant le pronostic vital.'
        },
        tca: {
            aliases: ['tca', 'temps de céphaline', 'temps de cephaline', 'ratio tca'],
            label: 'TCA (Ratio malade/témoin)',
            min: 0.8,
            max: 1.2,
            unit: 'ratio',
            criticalHigh: 2.0,
            criticalMsg: 'Allongement pathologique du TCA : rechercher un surdosage en héparine, CIVD ou déficit en facteur.'
        },
        dfg: {
            aliases: ['dfg', 'clairance', 'filtration glomérulaire', 'ckd-epi'],
            label: 'Débit de Filtration Glomérulaire (DFG)',
            min: 90,
            max: 120,
            unit: 'mL/min/1.73m²',
            criticalLow: 30,
            criticalMsg: 'Insuffisance rénale sévère : adapter posologies (antibiotiques, anticoagulants) et proscrire les AINS/PDC iodés.'
        }
    };

    /**
     * Analyse un résultat d'examen et extrait les analytes reconnus avec leurs valeurs.
     */
    function parseLabResults(examName, rawData) {
        const text = typeof rawData === 'string'
            ? rawData
            : (typeof rawData === 'object' && rawData !== null ? (rawData.value || rawData.text || JSON.stringify(rawData)) : String(rawData || ''));

        const lowerText = text.toLowerCase();
        const foundAnalytes = [];
        const alerts = [];

        // Recherche d'analytes dans le texte
        for (const [key, norm] of Object.entries(LAB_NORMS)) {
            let matchedAlias = null;

            // 1. Détection numérique directe (avec gestion optionnelle d'opérateurs <, >, <=, >=, :, = et qualificatifs)
            for (const alias of norm.aliases) {
                const escaped = alias.replace('+', '\\+').replace('.', '\\.');
                const numRegex = new RegExp(`(?:^|[\\s,;:(])(?:${escaped})(?:\\s+[^0-9\\n\\r:;,]{1,30})?\\s*[:=]?\\s*([<>]?=?)\\s*([0-9]+(?:[.,][0-9]+)?)\\s*([a-zA-Zµ/%]+)?`, 'i');
                const m = text.match(numRegex);
                if (m) {
                    matchedAlias = {
                        match: m[0],
                        operator: m[1] || '',
                        value: parseFloat(m[2].replace(',', '.')),
                        rawUnit: m[3] || norm.unit
                    };
                    break;
                }
            }

            // 2. Détection qualitative si non trouvé par valeur numérique
            if (!matchedAlias) {
                for (const alias of norm.aliases) {
                    const escaped = alias.replace('+', '\\+').replace('.', '\\.');
                    // Alias suivi de normal / négatif / négative
                    const qualNormRegex = new RegExp(`(?:^|[\\s,;:(])(?:${escaped})(?:\\s+[^\\n\\r:;,]{0,20})?\\s+(?:normale?s?|n[ée]gative?s?|dans\\s+les\\s+normes|strictement\\s+normal)`, 'i');
                    if (qualNormRegex.test(text)) {
                        matchedAlias = {
                            match: 'qualitative_normal',
                            operator: '',
                            value: norm.min > 0 ? (norm.min + norm.max) / 2 : (norm.max / 2),
                            displayVal: `Normal (${norm.min > 0 ? `${norm.min}–${norm.max}` : `< ${norm.max}`} ${norm.unit})`,
                            isQualitative: true,
                            forcedStatus: 'normal'
                        };
                        break;
                    }
                    // Alias suivi de élevé / augmenté / positif / positive / pathologique
                    const qualHighRegex = new RegExp(`(?:^|[\\s,;:(])(?:${escaped})(?:\\s+[^\\n\\r:;,]{0,20})?\\s+(?:[ée]lev[ée]e?s?|augment[ée]e?s?|positive?s?|pathologique?s?|sup[ée]rieure?)`, 'i');
                    if (qualHighRegex.test(text)) {
                        matchedAlias = {
                            match: 'qualitative_high',
                            operator: '>',
                            value: norm.criticalHigh || norm.max * 1.5,
                            displayVal: `Élevé / Positif (> ${norm.max} ${norm.unit})`,
                            isQualitative: true,
                            forcedStatus: norm.criticalHigh ? 'critical' : 'high'
                        };
                        break;
                    }
                }
            }

            // 3. Détection syndromique directe
            if (!matchedAlias) {
                if (key === 'potassium' && /hyperkali[ée]mie/i.test(text)) {
                    matchedAlias = { match: 'syndromic', operator: '>', value: 5.8, displayVal: 'Hyperkaliémie (> 5.0 mmol/L)', forcedStatus: 'critical' };
                } else if (key === 'potassium' && /hypokali[ée]mie/i.test(text)) {
                    matchedAlias = { match: 'syndromic', operator: '<', value: 3.0, displayVal: 'Hypokaliémie (< 3.5 mmol/L)', forcedStatus: 'critical' };
                } else if (key === 'hemoglobine' && /an[ée]mie/i.test(text)) {
                    matchedAlias = { match: 'syndromic', operator: '<', value: 9.0, displayVal: 'Anémie (< 12 g/dL)', forcedStatus: 'low' };
                } else if (key === 'plaquettes' && /thrombop[ée]nie/i.test(text)) {
                    matchedAlias = { match: 'syndromic', operator: '<', value: 80, displayVal: 'Thrombopénie (< 150 G/L)', forcedStatus: 'low' };
                } else if (key === 'leucocytes' && /hyperleucocytose/i.test(text)) {
                    matchedAlias = { match: 'syndromic', operator: '>', value: 16.0, displayVal: 'Hyperleucocytose (> 10 G/L)', forcedStatus: 'high' };
                }
            }

            if (matchedAlias && Number.isFinite(matchedAlias.value)) {
                const val = matchedAlias.value;
                let status = matchedAlias.forcedStatus || 'normal';
                let statusLabel = 'Normal';

                if (!matchedAlias.forcedStatus) {
                    const isCritHigh = norm.criticalHigh !== undefined && val >= norm.criticalHigh;
                    const isCritLow = norm.criticalLow !== undefined && val <= norm.criticalLow;

                    if (isCritHigh || isCritLow) {
                        status = 'critical';
                        statusLabel = isCritHigh ? 'CRITIQUE ▲' : 'CRITIQUE ▼';
                    } else if (val > norm.max) {
                        status = 'high';
                        statusLabel = 'Élevé ▲';
                    } else if (val < norm.min) {
                        status = 'low';
                        statusLabel = 'Bas ▼';
                    }
                } else {
                    if (status === 'critical') statusLabel = 'CRITIQUE ▲';
                    else if (status === 'high') statusLabel = 'Élevé ▲';
                    else if (status === 'low') statusLabel = 'Bas ▼';
                    else statusLabel = 'Normal ✓';
                }

                if (status === 'critical' && norm.criticalMsg) {
                    alerts.push({ label: norm.label, msg: norm.criticalMsg, severity: 'critical' });
                }

                foundAnalytes.push({
                    key,
                    label: norm.label,
                    value: val,
                    displayVal: matchedAlias.displayVal || `${matchedAlias.operator || ''}${val} ${norm.unit}`,
                    unit: norm.unit,
                    min: norm.min,
                    max: norm.max,
                    status,
                    statusLabel
                });
            }
        }

        return {
            hasStructuredAnalytes: foundAnalytes.length > 0,
            analytes: foundAnalytes,
            alerts,
            rawText: text
        };
    }

    /**
     * Génère le HTML d'une feuille de résultats d'examen CHU.
     */
    function renderHospitalLabReport(examName, rawData, isLocked, lockPlaceholder) {
        if (isLocked) {
            return `
                <div class="clinical-lab-card locked">
                    <div class="lab-card-header">
                        <span class="lab-card-title"><i class="fas fa-lock"></i> ${escapeHtml(examName)}</span>
                    </div>
                    <div class="lab-card-body">
                        ${lockPlaceholder || '<div class="lock-placeholder">Section verrouillée.</div>'}
                    </div>
                </div>
            `;
        }

        const isObj = typeof rawData === 'object' && rawData !== null;
        const parsed = parseLabResults(examName, rawData);
        const hasImage = isObj && rawData.image;

        // Détection de catégorie d'examen
        const isBiological = /biolog|sang|ionogramme|nfs|troponine|crp|d-dimère|urée|créatinine|gaz du sang|gds|bilan|hépatique|hémoculture|ecbu/i.test(examName)
            || parsed.hasStructuredAnalytes;

        let html = '';

        if (isBiological && parsed.hasStructuredAnalytes) {
            // Feuille de biologie médicale structurée
            const rowsHtml = parsed.analytes.map(item => `
                <tr class="lab-row lab-row-${item.status}">
                    <td class="col-analyte"><strong>${escapeHtml(item.label)}</strong></td>
                    <td class="col-value"><span class="lab-val-badge ${item.status}">${escapeHtml(item.displayVal || `${item.value} ${item.unit}`)}</span></td>
                    <td class="col-norm">${item.min} – ${item.max} ${escapeHtml(item.unit)}</td>
                    <td class="col-flag"><span class="lab-flag-pill ${item.status}">${item.statusLabel}</span></td>
                </tr>
            `).join('');

            const alertsHtml = parsed.alerts.map(a => `
                <div class="lab-alert-banner ${a.severity}">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>
                        <strong>Alerte Sémiologique [${escapeHtml(a.label)}] :</strong>
                        <span>${escapeHtml(a.msg)}</span>
                    </div>
                </div>
            `).join('');

            html = `
                <div class="clinical-lab-card biology-card">
                    <div class="lab-card-header">
                        <div class="lab-dept-badge">CHU • Service de Biologie Médicale</div>
                        <h4 class="lab-card-title"><i class="fas fa-vial"></i> ${escapeHtml(examName)}</h4>
                    </div>
                    <div class="lab-card-body">
                        <table class="lab-report-table" role="table">
                            <thead>
                                <tr>
                                    <th>Paramètre analysé</th>
                                    <th>Résultat</th>
                                    <th>Normes physiologiques</th>
                                    <th>Interprétation</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                            </tbody>
                        </table>
                        ${alertsHtml}
                        <div class="lab-raw-note">
                            <span class="lab-note-label">Rendu brut du laboratoire :</span> ${escapeHtml(parsed.rawText)}
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Compte-rendu d'imagerie ou d'exploration fonctionnelle
            const iconClass = /ecg|électrocardio/i.test(examName) ? 'fa-heartbeat'
                : (/radio|scanner|irm|échographie|echo|scanner/i.test(examName) ? 'fa-x-ray' : 'fa-notes-medical');

            html = `
                <div class="clinical-lab-card report-card">
                    <div class="lab-card-header">
                        <div class="lab-dept-badge">COMPTE-RENDU D'EXPLORATION & D'IMAGERIE</div>
                        <h4 class="lab-card-title"><i class="fas ${iconClass}"></i> ${escapeHtml(examName)}</h4>
                    </div>
                    <div class="lab-card-body">
                        <div class="clinical-report-content">
                            <p>${escapeHtml(parsed.rawText)}</p>
                        </div>
                    </div>
                </div>
            `;
        }

        return html;
    }

    // Exportation globale isomorphique (navigateur & Node.js)
    const root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this);
    root.MedGameLabNorms = {
        NORMS: LAB_NORMS,
        parseLabResults,
        renderHospitalLabReport
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = root.MedGameLabNorms;
    }
})();
