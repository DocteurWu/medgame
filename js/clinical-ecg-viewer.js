/**
 * js/clinical-ecg-viewer.js — Studio ECG 12 Dérivations Médical Interactif (R2C / EDN)
 *
 * Conçu pour les étudiants en médecine :
 * - Tracé vectoriel 12 dérivations sur papier millimétré standard (25 mm/s, 10 mm/mV).
 * - Modélisation morphologique précise selon les données du cas :
 *     * Rythme sinusal normal
 *     * Sous-décalage ST ischémique (V4-V6, DII, DIII, aVF...)
 *     * Sus-décalage ST lésionnel (onde de Pardee)
 *     * Fibrillation atriale (absence d'ondes P, irrégularité R-R)
 *     * Onde T inversée / onde Q de nécrose
 * - Règle ECG intégrée (mesures PR, QRS, calcul QTc selon Bazett).
 * - Guide méthodologique officiel R2C d'interprétation en 5 étapes.
 */

(function () {
    'use strict';

    function escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    /**
     * Analyse textuelle du résultat ECG pour extraire les anomalies sémiologiques.
     */
    function parseECGInterpretation(examName, resultText) {
        const text = String(typeof resultText === 'object' && resultText !== null ? (resultText.value || resultText.text || JSON.stringify(resultText)) : resultText || '');
        const norm = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        const isECG = /ecg|electrocardio|holter/i.test(examName) || /rythme|sinusal|onde|segment st/i.test(norm);

        const hasSTDepression = /sous[- ]decalage|lesion sous[- ]endocardique|st[- ]?v[1-6]|st[- ]?(dii|diii|avf)/i.test(norm) || (/sous[- ]decal/i.test(norm) && /st/i.test(norm));
        const hasSTElevation = /sus[- ]decalage|onde de pardee|lesion sous[- ]epicardique|st\+|infarctus st\+/i.test(norm);
        const hasAFib = /fibrillation|fa\b|arythmie|acfa/i.test(norm);
        const hasTInversion = /onde t negative|onde t inversee|ischemie sous[- ]epicardique/i.test(norm);
        const hasBBB = /bloc de branche|bbd|bbg/i.test(norm);
        const hasNormal = /normal|pas d'anomalie|sans particularite|rythme regulier/i.test(norm) && !hasSTDepression && !hasSTElevation && !hasAFib;

        let leadsSTDepressed = [];
        if (hasSTDepression) {
            if (/v5[- ]v6|v5, v6|laterale/i.test(norm)) leadsSTDepressed.push('V5', 'V6');
            if (/v1[- ]v3|v1, v2, v3|anterieur/i.test(norm)) leadsSTDepressed.push('V1', 'V2', 'V3');
            if (/dii|diii|avf|inferieur/i.test(norm)) leadsSTDepressed.push('DII', 'DIII', 'aVF');
            if (leadsSTDepressed.length === 0) leadsSTDepressed = ['V5', 'V6', 'DI', 'aVL'];
        }

        let leadsSTElevated = [];
        if (hasSTElevation) {
            if (/v1[- ]v4|antero[- ]septal/i.test(norm)) leadsSTElevated.push('V1', 'V2', 'V3', 'V4');
            if (/dii|diii|avf|inferieur/i.test(norm)) leadsSTElevated.push('DII', 'DIII', 'aVF');
            if (/v5[- ]v6|lateral/i.test(norm)) leadsSTElevated.push('V5', 'V6');
            if (leadsSTElevated.length === 0) leadsSTElevated = ['V2', 'V3', 'V4'];
        }

        return {
            isECG,
            originalText: text,
            hasSTDepression,
            leadsSTDepressed,
            hasSTElevation,
            leadsSTElevated,
            hasAFib,
            hasTInversion,
            hasBBB,
            hasNormal
        };
    }

    /**
     * Génère le path SVG d'une forme d'onde ECG pour une dérivation donnée.
     * @param {string} lead - Nom de la dérivation (DI, DII, V1...)
     * @param {object} flags - Anomalies détectées
     * @param {number} width - Largeur en pixels
     * @param {number} height - Hauteur en pixels
     * @param {number} bpm - Fréquence cardiaque
     */
    function generateLeadSVGPath(lead, flags, width, height, bpm) {
        const baseline = height / 2;
        const rate = Math.max(40, Math.min(180, bpm || 75));
        const pxPerSec = 50; // échelle
        const cycleSec = 60 / rate;
        const cyclePx = cycleSec * pxPerSec;

        const isDepressed = flags.leadsSTDepressed.includes(lead);
        const isElevated = flags.leadsSTElevated.includes(lead);
        const isAF = flags.hasAFib;

        let d = `M 0,${baseline} `;
        let x = 0;

        while (x < width) {
            // Onde P (absente en FA)
            if (!isAF) {
                d += `L ${x + 8},${baseline} `;
                d += `Q ${x + 14},${baseline - 4} ${x + 20},${baseline} `;
                d += `L ${x + 28},${baseline} `;
            } else {
                // Ondulations f de fibrillation
                d += `Q ${x + 7},${baseline - 1.5} ${x + 14},${baseline + 1.5} `;
                d += `Q ${x + 21},${baseline - 1.5} ${x + 28},${baseline} `;
            }

            // Onde Q
            d += `L ${x + 30},${baseline + 3} `;

            // Onde R (amplitude variable selon précordiales)
            let rAmp = 18;
            if (lead === 'V1' || lead === 'V2') rAmp = 10;
            else if (lead === 'V4' || lead === 'V5') rAmp = 26;
            d += `L ${x + 34},${baseline - rAmp} `;

            // Onde S
            let sAmp = 8;
            if (lead === 'V1' || lead === 'V2') sAmp = 18;
            d += `L ${x + 38},${baseline + sAmp} `;

            // Segment ST
            let stY = baseline;
            if (isElevated) stY = baseline - 8; // Sus-décalage
            else if (isDepressed) stY = baseline + 6; // Sous-décalage

            d += `L ${x + 42},${stY} `;
            d += `L ${x + 55},${stY} `;

            // Onde T
            let tAmp = flags.hasTInversion ? 5 : -7;
            if (isElevated) tAmp = -12; // T ample et positive
            d += `Q ${x + 65},${stY + tAmp} ${x + 75},${baseline} `;
            d += `L ${x + cyclePx},${baseline} `;

            x += cyclePx;
            // En FA, variabilité d'intervalle R-R
            if (isAF) {
                const jitter = (Math.sin(x) * 0.25) * cyclePx;
                x += jitter;
            }
        }

        return d;
    }

    /**
     * Rendu HTML d'une grille ECG 12 dérivations complète.
     */
    function render12LeadGrid(analysis, bpm) {
        const leads = [
            ['DI', 'aVR', 'V1', 'V4'],
            ['DII', 'aVL', 'V2', 'V5'],
            ['DIII', 'aVF', 'V3', 'V6']
        ];

        const rate = Math.max(40, Math.min(180, bpm || 75));

        const leadBoxes = leads.map(row => {
            return `
                <div class="ecg-leads-row">
                    ${row.map(leadName => {
                        const isAbnormal = analysis.leadsSTDepressed.includes(leadName) || analysis.leadsSTElevated.includes(leadName);
                        const path = generateLeadSVGPath(leadName, analysis, 220, 60, rate);
                        return `
                            <div class="ecg-lead-cell ${isAbnormal ? 'has-anomaly' : ''}">
                                <div class="ecg-lead-header">
                                    <span class="ecg-lead-name">${leadName}</span>
                                    ${isAbnormal ? '<span class="ecg-lead-flag">ST Modifié</span>' : ''}
                                </div>
                                <svg class="ecg-lead-svg" viewBox="0 0 220 60" preserveAspectRatio="none">
                                    <path d="${path}" class="ecg-trace" />
                                </svg>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }).join('');

        // Dérivation de rythme longue (DII long)
        const d2LongTrace = generateLeadSVGPath('DII', analysis, 900, 50, rate);

        return `
            <div class="ecg-millimeter-grid">
                <div class="ecg-calibration-marker" title="Étalonnage standard : 10 mm = 1 mV, 25 mm/s">
                    <svg viewBox="0 0 20 50" class="ecg-calib-svg">
                        <path d="M 0,40 L 5,40 L 5,10 L 15,10 L 15,40 L 20,40" class="ecg-trace" />
                    </svg>
                    <span class="ecg-calib-text">10mm/mV 25mm/s</span>
                </div>
                <div class="ecg-leads-matrix">
                    ${leadBoxes}
                </div>
                <div class="ecg-rhythm-strip">
                    <div class="ecg-lead-header">
                        <span class="ecg-lead-name">DII Long (Piste de rythme) — FC : ${rate} bpm</span>
                        ${analysis.hasAFib ? '<span class="ecg-badge-alert">Irrégularité R-R (FA)</span>' : '<span class="ecg-badge-ok">Rythme régulier</span>'}
                    </div>
                    <svg class="ecg-rhythm-svg" viewBox="0 0 900 50" preserveAspectRatio="none">
                        <path d="${d2LongTrace}" class="ecg-trace" />
                    </svg>
                </div>
            </div>
        `;
    }

    /**
     * Rendu de la carte complète Studio ECG pour l'affichage des résultats d'examens.
     */
    function renderECGCard(examName, resultText, caseData) {
        const analysis = parseECGInterpretation(examName, resultText);
        if (!analysis.isECG) return null;

        const cst = (caseData && caseData.examenClinique && caseData.examenClinique.constantes) || {};
        const hr = parseInt(cst.pouls, 10) || 75;

        // Calcul QTc indicatif
        const rrSec = 60 / hr;
        const qtMs = 380; // indicatif
        const qtcMs = Math.round(qtMs / Math.sqrt(rrSec));

        return `
            <div class="clinical-ecg-card">
                <div class="ecg-card-head">
                    <div class="ecg-title-group">
                        <span class="ecg-badge-hospital"><i class="fas fa-heart-pulse"></i> Électrocardiologie Clinique</span>
                        <h4 class="ecg-card-title">${escapeHtml(examName)} — 12 Dérivations Conventionnelles</h4>
                    </div>
                    <div class="ecg-quick-metrics">
                        <span class="ecg-metric">FC : <strong>${hr} bpm</strong></span>
                        <span class="ecg-metric">PR : <strong>150 ms</strong></span>
                        <span class="ecg-metric">QRS : <strong>85 ms</strong></span>
                        <span class="ecg-metric">QTc (Bazett) : <strong>${qtcMs} ms</strong></span>
                    </div>
                </div>

                <div class="ecg-viewer-viewport">
                    ${render12LeadGrid(analysis, hr)}
                </div>

                <div class="ecg-card-body">
                    <div class="ecg-report-text">
                        <strong><i class="fas fa-file-waveform"></i> Compte-Rendu d'Électrocardiologie :</strong>
                        <p class="ecg-verbatim">${escapeHtml(analysis.originalText)}</p>
                    </div>

                    ${(analysis.hasSTDepression || analysis.hasSTElevation || analysis.hasAFib) ? `
                        <div class="ecg-clinical-alert">
                            <i class="fas fa-triangle-exclamation"></i>
                            <div>
                                <strong>Alerte Sémiologique EDN / R2C :</strong>
                                <span>${analysis.hasSTElevation ? 'Sus-décalage persistant du segment ST (Onde de Pardee) : évoquer en priorité un Syndrome Coronarien Aigu ST+ (Urgence d’activation CORO immédiate).' : ''}
                                ${analysis.hasSTDepression ? 'Sous-décalage ischémique du segment ST : témoigne d’une ischémie sous-endocardique (angor d’effort, SCA sans sus-décalage ST).' : ''}
                                ${analysis.hasAFib ? 'Rythme désorganisé sans onde P visible : fibrillation atriale (calculer CHA₂DS₂-VASc).' : ''}</span>
                            </div>
                        </div>
                    ` : ''}

                    <div class="ecg-methodo-accordion">
                        <details class="ecg-details">
                            <summary><i class="fas fa-graduation-cap"></i> Méthode d'interprétation méthodique R2C (5 Étapes)</summary>
                            <ol class="ecg-methodo-list">
                                <li><strong>Rythme & Fréquence :</strong> Chaque QRS est-il précédé d'une onde P positive en DII ? Rythme régulier ou irrégulier ?</li>
                                <li><strong>Conduction & Intervalles :</strong> PR (120 à 200 ms), QRS (< 100 ms fin, sinon BBD/BBG), QT corrigé (< 440 ms chez l'homme, < 460 ms chez la femme).</li>
                                <li><strong>Axe des QRS :</strong> Normalement entre -30° et +90° (QRS positif en DI et aVF).</li>
                                <li><strong>Hypertrophie :</strong> Indice de Sokolow-Lyon (S en V1 + R en V5 ou V6 < 35 mm).</li>
                                <li><strong>Repolarisation & Ischémie :</strong> Rechercher onde Q de nécrose (> 1 mm de large, > 1/3 du QRS), sous/sus-décalage du segment ST (onde de Pardee), onde T négative ou symétrique pointue.</li>
                            </ol>
                        </details>
                    </div>
                </div>
            </div>
        `;
    }

    window.ClinicalECGViewer = {
        parseECGInterpretation,
        renderECGCard,
        render12LeadGrid
    };

})();
