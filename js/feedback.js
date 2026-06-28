/**
 * js/feedback.js — Feedback post-cas détaillé
 * Mission 3 (Atelier Logique) : chronologie actions, points forts/faibles,
 * explication pédagogique, comparaison anonyme
 *
 * Ce module est indépendant et compatible 2D/3D. Il enrichit le panneau
 * de correction existant sans modifier les cas JSON.
 */

// ==================== TIMELINE D'ACTIONS ====================

const feedbackTimeline = {
    events: [],

    /** Enregistrer un événement dans la timeline. */
    log(type, detail, extra) {
        this.events.push({
            timestamp: Date.now(),
            elapsed: this.events.length > 0
                ? Math.round((Date.now() - (this._startTs || Date.now())) / 1000)
                : 0,
            type,       // 'interrogatoire', 'examen', 'lock', 'diagnostic', 'traitement', 'section'
            detail,     // description courte de l'action
            extra       // données additionnelles optionnelles
        });
    },

    /** Réinitialiser pour un nouveau cas. */
    reset() {
        this.events = [];
        this._startTs = Date.now();
    }
};

window.feedbackTimeline = feedbackTimeline;

// ==================== ANALYSE DES POINTS FORTS/FAIBLESSES ====================

/**
 * Génère une liste de points forts et de points faibles à partir du résultat composite.
 *
 * @param {object} compositeResult — résultat de calculateCompositeScore()
 * @param {object} currentCase — cas clinique courant
 * @returns {{ strengths: string[], weaknesses: string[], tips: string[] }}
 */
function analyzePerformance(compositeResult, currentCase) {
    const strengths = [];
    const weaknesses = [];
    const tips = [];

    const b = compositeResult.breakdown;

    // --- Démarche clinique ---
    if (b.demarche.score >= 80) {
        strengths.push('Démarche clinique exhaustive et rigoureuse');
    } else if (b.demarche.score >= 50) {
        tips.push('Explorez davantage l\'interrogatoire et l\'examen clinique avant de conclure');
    } else {
        weaknesses.push('Démarche clinique incomplète — des éléments importants ont été manqués');
        tips.push('Prenez le temps de poser toutes les questions et de réaliser un examen clinique complet');
    }

    // Détail interrogatoire
    const dem = scoringState.demarche;
    const interroCount = dem.interrogatoireAsked.size;
    const interroFields = getInterrogatoireFieldCount(currentCase);
    if (interroFields > 0) {
        if (interroCount >= interroFields * 0.8) {
            strengths.push(`Interrogatoire complet (${interroCount}/${interroFields} champs explorés)`);
        } else if (interroCount < interroFields * 0.4) {
            weaknesses.push(`Interrogatoire insuffisant (${interroCount}/${interroFields} champs) — des informations clés manquent`);
            tips.push('Cliquez sur les boutons de question pour révéler les informations du patient');
        }
    }

    // Détail examen clinique
    if (dem.examSectionsViewed.has('section-examen-clinique') || dem.examSectionsViewed.has('section-examen')) {
        strengths.push('Examen clinique réalisé');
    } else {
        weaknesses.push('Examen clinique non consulté');
        tips.push('N\'oubliez pas l\'examen clinique — il contient des signes essentiels');
    }

    // Examens complémentaires
    const examsRelevant = currentCase.relevantExams || currentCase.availableExams || [];
    const examsOrdered = dem.examsOrdered;
    if (examsRelevant.length > 0) {
        const relevantOrdered = examsOrdered.filter(e => examsRelevant.includes(e));
        const uselessOrdered = examsOrdered.filter(e => !examsRelevant.includes(e));
        if (relevantOrdered.length === examsRelevant.length && uselessOrdered.length === 0) {
            strengths.push('Examens complémentaires justes et ciblés');
        } else if (uselessOrdered.length > 2) {
            weaknesses.push(`${uselessOrdered.length} examen(s) inutile(s) commandé(s) — sur-prescription`);
            tips.push('En médecine, commander des examens inutiles retarde la prise en charge et augmente les coûts');
        }
        if (relevantOrdered.length < examsRelevant.length * 0.5) {
            weaknesses.push('Examens complémentaires manquants — des examens essentiels n\'ont pas été demandés');
        }
    }

    // Verrous sémiologiques
    const locks = currentCase.locks || [];
    if (locks.length > 0) {
        const unlockedCount = locks.filter(l => dem.locksUnlocked.has(l.id)).length;
        if (unlockedCount === locks.length) {
            strengths.push('Tous les défis sémiologiques ont été relevés');
        } else if (unlockedCount === 0) {
            weaknesses.push('Aucun verrou sémiologique déverrouillé — des données clés sont restées cachées');
            tips.push('Les verrous cachent des informations importantes. Relevez les défis pour les débloquer.');
        }
    }

    // --- Diagnostic --- (amélioré : scoring progressif 15/30/60/80/100)
    if (b.diagnostic.score >= 80) {
        strengths.push('Diagnostic correct — bon raisonnement clinique');
    } else if (b.diagnostic.score >= 60) {
        strengths.push('Diagnostic proche — bon raisonnement mais pas le terme exact');
        tips.push('Votre diagnostic était dans la bonne direction. Revoyez les signes discriminants pour affiner.');
    } else if (b.diagnostic.score >= 30) {
        tips.push('Votre diagnostic était proche de la bonne catégorie, mais le terme précis était différent. Revoyez les signes discriminants.');
    } else if (b.diagnostic.score > 0 && b.diagnostic.score < 30) {
        weaknesses.push('Diagnostic partiel — vous avez identifié la spécialité mais pas le diagnostic précis');
        tips.push('Concentrez-vous sur les éléments clés de l\'anamnèse et de l\'examen qui différencient les diagnostics d\'une même spécialité.');
    } else if (b.diagnostic.score === 0) {
        weaknesses.push('Diagnostic incorrect — revoir la sémiologie et les orientations diagnostiques');
        tips.push('Concentrez-vous sur les éléments clés de l\'anamnèse et de l\'examen qui orientent le diagnostic');
    }

    // --- Traitement --- (amélioré : distinguer 1ère/2ème intention)
    if (compositeResult.hasFatalError) {
        weaknesses.push('ERREUR FATALE : traitement contre-indiqué prescrit');
        tips.push('Vérifiez toujours les contre-indications avant de prescrire. En clinique, une erreur peut être mortelle.');
    } else if (b.traitement.score >= 80) {
        if (compositeResult.treatmentDetails && compositeResult.treatmentDetails.firstLineHit &&
            compositeResult.treatmentDetails.firstLineHit.length > 0) {
            strengths.push('Traitement de 1ère intention prescrit correctement');
        } else {
            strengths.push('Traitement bien ciblé et complet');
        }
    } else if (b.traitement.score >= 40) {
        const td = compositeResult.treatmentDetails;
        if (td && td.secondLineHit && td.secondLineHit.length > 0 && td.firstLineHit && td.firstLineHit.length === 0) {
            tips.push('Vous avez prescrit un traitement de 2ème intention acceptable, mais le protocole de référence (1ère intention) serait préférable.');
        } else {
            tips.push('Le traitement était partiellement correct. Révisez les protocoles de prise en charge.');
        }
    } else {
        weaknesses.push('Traitement inadapté — la prise en charge thérapeutique est à revoir');
    }

    // --- Vitesse ---
    if (b.vitesse.score >= 70) {
        strengths.push('Bonne réactivité — cas résolu rapidement');
    } else if (b.vitesse.score < 30) {
        weaknesses.push('Temps excessif — la lenteur peut être préjudiciable en situation d\'urgence');
        tips.push('En situation clinique réelle, la rapidité peut être cruciale.');
    }

    // --- Conseils contextuels par spécialité ---
    const caseId = (currentCase.id || '').toLowerCase();
    if (caseId.includes('cardio') || caseId.includes('angor') || caseId.includes('idm')) {
        tips.push('En cardiologie, l\'ECG et la troponine sont les piliers du diagnostic aux urgences.');
    } else if (caseId.includes('neuro')) {
        tips.push('En neurologie, l\'interrogatoire minutieux et l\'examen systématique sont déterminants.');
    } else if (caseId.includes('pneumo')) {
        tips.push('En pneumologie, l\'imagerie thoracique et la gazométrie sont souvent indispensables.');
    } else if (caseId.includes('urg') || caseId.includes('choc')) {
        tips.push('En urgence, priorisez l\'ABC (Airway, Breathing, Circulation) avant tout diagnostic étiologique.');
    }

    // Limiter les tips à 4 maximum
    const uniqueTips = [...new Set(tips)].slice(0, 4);

    return { strengths, weaknesses, tips: uniqueTips };
}

window.analyzePerformance = analyzePerformance;

// ==================== EXPLICATION PÉDAGOGIQUE ====================

/**
 * Génère une explication pédagogique contextuelle basée sur le cas et le résultat.
 *
 * @param {object} compositeResult — résultat de calculateCompositeScore()
 * @param {object} currentCase — cas clinique courant
 * @returns {string} HTML pédagogique
 */
function generatePedagogicalExplanation(compositeResult, currentCase) {
    const stars = compositeResult.stars;
    const diag = compositeResult.diagnosticScore;
    const treat = compositeResult.traitementScore;
    const demarche = compositeResult.demarcheScore;

    // En-tête pédagogique selon le niveau de performance
    let headerIcon, headerText, headerColor;
    if (stars >= 3) {
        headerIcon = '🏆';
        headerText = 'Excellente performance !';
        headerColor = '#2ecc71';
    } else if (stars >= 2) {
        headerIcon = '✅';
        headerText = 'Bonne démarche, quelques points à améliorer';
        headerColor = '#f39c12';
    } else if (stars >= 1) {
        headerIcon = '📚';
        headerText = 'Des lacunes à combler — révisez les points ci-dessous';
        headerColor = '#e67e22';
    } else {
        headerIcon = '⚠️';
        headerText = 'Ce cas mérite d\'être revu en profondeur';
        headerColor = '#e74c3c';
    }

    // Construction du message pédagogique
    let paragraphs = [];

    // Paragraphe diagnostic
    if (diag >= 80) {
        paragraphs.push(`<strong>Diagnostic ✅</strong> — Votre diagnostic est correct. ${getDiagnosticExplanation(currentCase)}`);
    } else if (diag > 0) {
        paragraphs.push(`<strong>Diagnostic ⚠️</strong> — Vous étiez sur la bonne piste, mais le diagnostic exact était <em>${escapeHtml(currentCase.correctDiagnostic || 'N/A')}</em>. ${getDiagnosticExplanation(currentCase)}`);
    } else {
        paragraphs.push(`<strong>Diagnostic ❌</strong> — Le diagnostic retenu était <em>${escapeHtml(currentCase.correctDiagnostic || 'N/A')}</em>. ${getDiagnosticExplanation(currentCase)}`);
    }

    // Paragraphe traitement
    const correctTreatments = currentCase.correctTreatments || [];
    const fatalTreatments = currentCase.fatalTreatments || [];
    if (compositeResult.hasFatalError) {
        paragraphs.push(`<strong>Traitement ❌</strong> — Vous avez prescrit un traitement contre-indiqué (${escapeHtml(compositeResult.selectedFatalTreatments.join(', '))}). ${getTreatmentExplanation(currentCase, true)}`);
    } else if (treat >= 80 && correctTreatments.length > 0) {
        paragraphs.push(`<strong>Traitement ✅</strong> — Votre prescription était adaptée. ${getTreatmentExplanation(currentCase, false)}`);
    } else if (treat > 0 && correctTreatments.length > 0) {
        const missed = correctTreatments.filter(t => !scoringState.selectedTreatments.includes(t));
        const missedLabel = missed.length > 0 ? `Il manquait : <em>${escapeHtml(missed.join(', '))}</em>.` : '';
        paragraphs.push(`<strong>Traitement ⚠️</strong> — Votre prescription était partielle. ${missedLabel} ${getTreatmentExplanation(currentCase, false)}`);
    } else if (correctTreatments.length > 0) {
        paragraphs.push(`<strong>Traitement ❌</strong> — Le traitement de référence est : <em>${escapeHtml(correctTreatments.join(' + '))}</em>. ${getTreatmentExplanation(currentCase, false)}`);
    }

    // Paragraphe démarche
    if (demarche < 50) {
        paragraphs.push(`<strong>Démarche clinique</strong> — Une démarche clinique incomplète mène souvent à des diagnostics erronés. Prenez le temps de recueillir tous les éléments avant de conclure.`);
    }

    // Paragraphe points clés du cas
    const keyPoints = extractKeyPoints(currentCase);
    if (keyPoints.length > 0) {
        paragraphs.push(`<strong>Points clés à retenir :</strong><ul>${keyPoints.map(p => `<li>${p}</li>`).join('')}</ul>`);
    }

    return `
        <div style="background: linear-gradient(135deg, rgba(0,0,0,0.3), rgba(0,0,0,0.1)); border-radius: 12px; padding: 16px; margin-top: 12px; border-left: 4px solid ${headerColor};">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                <span style="font-size:1.5rem;">${headerIcon}</span>
                <span style="font-weight:700; font-size:1.1rem; color:${headerColor};">${headerText}</span>
            </div>
            ${paragraphs.map(p => `<p style="margin:8px 0; line-height:1.6; font-size:0.9rem; color:rgba(255,255,255,0.85);">${p}</p>`).join('')}
        </div>
    `;
}

window.generatePedagogicalExplanation = generatePedagogicalExplanation;

// ==================== TIMELINE RENDER ====================

/**
 * Génère le HTML de la chronologie des actions du joueur.
 *
 * @returns {string} HTML formaté
 */
function renderTimeline() {
    const events = feedbackTimeline.events;
    if (events.length === 0) {
        return '<p style="color:rgba(255,255,255,0.5); font-style:italic;">Aucune action enregistrée.</p>';
    }

    const typeIcons = {
        interrogatoire: '💬',
        examen: '🔬',
        lock: '🔓',
        diagnostic: '🎯',
        traitement: '💊',
        section: '📋'
    };

    const typeColors = {
        interrogatoire: '#3498db',
        examen: '#2ecc71',
        lock: '#9b59b6',
        diagnostic: '#e74c3c',
        traitement: '#f39c12',
        section: '#1abc9c'
    };

    const maxTime = Math.max(...events.map(e => e.elapsed), 1);

    const items = events.map(e => {
        const icon = typeIcons[e.type] || '•';
        const color = typeColors[e.type] || '#888';
        const minutes = Math.floor(e.elapsed / 60);
        const seconds = e.elapsed % 60;
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        const barWidth = maxTime > 0 ? Math.max(5, (e.elapsed / maxTime) * 100) : 5;

        return `
            <div style="display:flex; align-items:center; gap:10px; margin:4px 0; font-size:0.85rem;">
                <span style="min-width:35px; text-align:right; color:rgba(255,255,255,0.5); font-family:monospace; font-size:0.8rem;">${timeStr}</span>
                <div style="flex:1; display:flex; align-items:center; gap:8px;">
                    <span style="min-width:20px; text-align:center;">${icon}</span>
                    <div style="flex:1; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden; height:20px; position:relative;">
                        <div style="height:100%; width:${barWidth}%; background:${color}; opacity:0.3; border-radius:4px;"></div>
                        <span style="position:absolute; left:8px; top:2px; color:rgba(255,255,255,0.85); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(e.detail)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div style="margin-top:8px;">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                <span style="font-weight:700; font-size:0.95rem;">⏱️ Chronologie de vos actions</span>
                <span style="font-size:0.75rem; color:rgba(255,255,255,0.4);">(${events.length} actions)</span>
            </div>
            <div style="display:flex; gap:6px; margin-bottom:8px; flex-wrap:wrap;">
                ${Object.entries(typeIcons).filter(([type]) => events.some(e => e.type === type)).map(([type, icon]) =>
                    `<span style="font-size:0.7rem; color:${typeColors[type]}; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:10px;">${icon} ${type}</span>`
                ).join('')}
            </div>
            ${items}
        </div>
    `;
}

window.renderTimeline = renderTimeline;

// ==================== COMPARAISON ANONYME ====================

/**
 * Enregistre les stats d'une session et récupère les stats anonymes
 * pour comparaison avec les sessions précédentes du même cas.
 *
 * @param {object} compositeResult — résultat de calculateCompositeScore()
 * @param {string} caseId — identifiant du cas
 * @returns {{ rank: number, total: number, percentile: number, avgScore: number, avgDemarche: number }}
 */
function getAnonymousComparison(compositeResult, caseId, mode = 'classic') {
    const STORAGE_KEY = 'medgame_case_stats';

    // Charger les stats existantes
    let stats = {};
    try {
        stats = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {
        stats = {};
    }

    const partitionKey = `${caseId}_${mode}`;

    // Enregistrer cette session
    const entry = {
        score: compositeResult.compositeScore,
        demarcheScore: compositeResult.demarcheScore,
        diagnosticScore: compositeResult.diagnosticScore,
        traitementScore: compositeResult.traitementScore,
        stars: compositeResult.stars,
        timestamp: Date.now()
    };

    if (!stats[partitionKey]) stats[partitionKey] = [];
    stats[partitionKey].push(entry);

    // Ne garder que les 50 dernières sessions par cas et par mode
    if (stats[partitionKey].length > 50) {
        stats[partitionKey] = stats[partitionKey].slice(-50);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));

    // Calculer les stats de comparaison
    const sessions = stats[partitionKey];
    const total = sessions.length;
    const sortedScores = sessions.map(s => s.score).sort((a, b) => b - a);

    // Calculer le rang en tenant compte des ex-aequo
    let actualRank = 1;
    for (const s of sortedScores) {
        if (s > compositeResult.compositeScore) actualRank++;
        else break;
    }

    const avgScore = Math.round(sessions.reduce((a, s) => a + s.score, 0) / total);
    const avgDemarche = Math.round(sessions.reduce((a, s) => a + s.demarcheScore, 0) / total);
    const percentile = total > 1 ? Math.round((1 - (actualRank - 1) / total) * 100) : 100;

    return { rank: actualRank, total, percentile, avgScore, avgDemarche };
}

window.getAnonymousComparison = getAnonymousComparison;

// ==================== GRILLE DE NOTATION DÉTAILLÉE ====================

/**
 * Génère une grille de notation détaillée et transparente pour le joueur.
 * Affiche les 4 axes de notation, leur poids, le score obtenu,
 * et la contribution au score final. Explicite la formule de vitesse.
 *
 * @param {object} compositeResult — résultat de calculateCompositeScore()
 * @param {object} currentCase — cas clinique courant
 * @returns {string} HTML de la grille de notation
 */
function renderScoringGrid(compositeResult, currentCase) {
    const b = compositeResult.breakdown;

    const totalTime = (typeof getTimeLimit === 'function') ? getTimeLimit() : 720;
    const timeLeft = (typeof timerState !== 'undefined' && timerState.timeLeft) || 0;
    const timeUsed = totalTime - timeLeft;
    const timeUsedMin = Math.floor(timeUsed / 60);
    const timeUsedSec = timeUsed % 60;

    function barColor(score) {
        if (score >= 80) return '#2ecc71';
        if (score >= 50) return '#f39c12';
        return '#e74c3c';
    }

    function renderAxisRow(icon, label, weight, score, contribution, details) {
        const color = barColor(score);
        return `
            <div style="display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
                <span style="font-size:1.3rem; min-width:32px; text-align:center;">${icon}</span>
                <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:3px;">
                        <span style="font-weight:700; font-size:0.9rem; color:rgba(255,255,255,0.9);">${label} <span style="font-size:0.75rem; color:rgba(255,255,255,0.45); font-weight:400;">(${Math.round(weight * 100)}% du score)</span></span>
                        <span style="font-weight:800; font-size:1.05rem; color:${color};">${score}%</span>
                    </div>
                    <div style="background:rgba(255,255,255,0.08); border-radius:6px; height:8px; overflow:hidden; margin-bottom:3px;">
                        <div style="background:${color}; height:100%; width:${score}%; border-radius:6px; transition:width 0.8s ease;"></div>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:rgba(255,255,255,0.5);">
                        <span>Contribution : <strong style="color:${color};">${contribution.toFixed(1)} pts</strong></span>
                        ${details ? `<span style="color:rgba(255,255,255,0.4);">${details}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // Détails spécifiques par axe
    const dem = scoringState.demarche;
    const interroCount = dem.interrogatoireAsked ? dem.interrogatoireAsked.size : 0;
    const interroFields = (typeof getInterrogatoireFieldCount === 'function') ? getInterrogatoireFieldCount(currentCase) : 0;
    const interroDetails = interroFields > 0 ? `Interrogatoire ${interroCount}/${interroFields}` : '';

    const diagDetails = compositeResult.diagnosticScore === 100 ? 'Diagnostic exact'
        : compositeResult.diagnosticScore === 80 ? 'Alias/variante accepté'
        : compositeResult.diagnosticScore === 60 ? 'Diagnostic proche'
        : compositeResult.diagnosticScore === 30 ? 'Même spécialité'
        : compositeResult.diagnosticScore > 0 ? 'Partiellement correct'
        : 'Non identifié';

    const td = compositeResult.treatmentDetails || {};
    const firstLineCount = (td.firstLineHit || []).length;
    const secondLineCount = (td.secondLineHit || []).length;
    const treatDetails = compositeResult.hasFatalError ? 'Erreur fatale'
        : firstLineCount > 0 ? `${firstLineCount} 1ère intention`
        : secondLineCount > 0 ? `${secondLineCount} 2ème intention`
        : compositeResult.traitementScore >= 80 ? 'Traitement complet'
        : compositeResult.traitementScore > 0 ? 'Partiel'
        : 'Non identifié';

    const vitesseDetails = `${timeUsedMin}min ${timeUsedSec.toString().padStart(2, '0')}s / ${Math.floor(totalTime / 60)}min`;

    const totalContribution = b.demarche.contribution + b.diagnostic.contribution + b.traitement.contribution + b.vitesse.contribution;

    return `
        <div style="background:linear-gradient(135deg, rgba(0,0,0,0.35), rgba(0,0,0,0.15)); border-radius:12px; padding:16px; margin-bottom:16px; border:1px solid rgba(255,255,255,0.08);">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                <span style="font-size:1.2rem;">📋</span>
                <span style="font-weight:700; font-size:1rem; color:rgba(255,255,255,0.9);">Grille de notation</span>
                <span style="font-size:0.7rem; color:rgba(255,255,255,0.4); background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:10px;">Score final = ${totalContribution.toFixed(1)} / 100</span>
            </div>

            ${renderAxisRow('🩺', 'Démarche clinique', SCORING_WEIGHTS.demarche, b.demarche.score, b.demarche.contribution, interroDetails)}
            ${renderAxisRow('🎯', 'Diagnostic', SCORING_WEIGHTS.diagnostic, b.diagnostic.score, b.diagnostic.contribution, diagDetails)}
            ${renderAxisRow('💊', 'Traitement', SCORING_WEIGHTS.traitement, b.traitement.score, b.traitement.contribution, treatDetails)}
            ${renderAxisRow('⏱️', 'Vitesse', SCORING_WEIGHTS.vitesse, b.vitesse.score, b.vitesse.contribution, vitesseDetails)}

            <!-- Formule vitesse -->
            <div style="margin-top:10px; padding:10px 12px; background:rgba(255,255,255,0.04); border-radius:8px; font-size:0.78rem; color:rgba(255,255,255,0.55); line-height:1.5;">
                <strong style="color:rgba(255,255,255,0.75);">⏱️ Comment est calculée la vitesse ?</strong><br>
                <code style="background:rgba(255,255,255,0.08); padding:1px 5px; border-radius:3px; font-size:0.75rem;">
                    score_vitesse = round(temps_restant / temps_total × 100)
                </code><br>
                Pour obtenir le maximum (+10 pts), validez le plus tôt possible.<br>
                <span style="color:rgba(255,255,255,0.4);">
                    ${b.vitesse.score === 100 ? '✅ Temps maximum conservé — score vitesse parfait !'
                        : b.vitesse.score >= 70 ? 'Bon rythme — peu de points perdus.'
                        : b.vitesse.score >= 40 ? 'Temps moyen — validez plus tôt pour gagner des points.'
                        : '⚡ Temps très long — la rapidité compte en clinique.'}
                </span>
            </div>
        </div>
    `;
}

window.renderScoringGrid = renderScoringGrid;

// ==================== RENDER FEEDBACK COMPLET ====================

/**
 * Génère le feedback complet post-cas : grille + timeline + analyse + pédagogie + comparaison.
 * À appeler après calculateCompositeScore() et avant/après renderCompositeScorePanel().
 *
 * @param {object} compositeResult — résultat de calculateCompositeScore()
 * @param {object} currentCase — cas clinique courant
 * @returns {string} HTML complet du feedback détaillé
 */
function renderDetailedFeedback(compositeResult, currentCase) {
    // 1. Grille de notation détaillée
    const scoringGridHtml = renderScoringGrid(compositeResult, currentCase);

    // 2. Analyse points forts/faibles
    const analysis = analyzePerformance(compositeResult, currentCase);

    // 3. Explication pédagogique
    const pedagogical = generatePedagogicalExplanation(compositeResult, currentCase);

    // 4. Comparaison anonyme
    const comparison = getAnonymousComparison(compositeResult, currentCase.id || 'unknown');

    // 5. Timeline
    const timelineHtml = renderTimeline();

    // --- Rendu ---
    const strengthItems = analysis.strengths.length > 0
        ? analysis.strengths.map(s => `<li style="color:#2ecc71; margin:4px 0;">✅ ${escapeHtml(s)}</li>`).join('')
        : '<li style="color:rgba(255,255,255,0.5);">Aucun point fort identifié ce coup-ci</li>';

    const weaknessItems = analysis.weaknesses.length > 0
        ? analysis.weaknesses.map(w => `<li style="color:#e74c3c; margin:4px 0;">❌ ${escapeHtml(w)}</li>`).join('')
        : '';

    const tipItems = analysis.tips.length > 0
        ? analysis.tips.map(t => `<li style="color:#f39c12; margin:4px 0;">💡 ${escapeHtml(t)}</li>`).join('')
        : '';

    // Comparaison percentile bar
    const compColor = comparison.percentile >= 75 ? '#2ecc71'
        : comparison.percentile >= 50 ? '#f39c12'
        : '#e74c3c';

    const comparisonBlock = comparison.total > 1 ? `
        <div style="background:rgba(0,0,0,0.2); border-radius:8px; padding:12px; margin-top:12px;">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                <span style="font-weight:700;">📊 Comparaison anonyme</span>
                <span style="font-size:0.75rem; color:rgba(255,255,255,0.4);">(${comparison.total} sessions sur ce cas)</span>
            </div>
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
                <div style="text-align:center;">
                    <div style="font-size:2rem; font-weight:800; color:${compColor};">${comparison.percentile}<span style="font-size:0.8rem;">%</span></div>
                    <div style="font-size:0.7rem; color:rgba(255,255,255,0.5);">Percentile</div>
                </div>
                <div style="flex:1;">
                    <div style="position:relative; height:24px; background:rgba(255,255,255,0.1); border-radius:12px; overflow:hidden;">
                        <div style="position:absolute; left:0; height:100%; width:${comparison.percentile}%; background:${compColor}; opacity:0.6; border-radius:12px;"></div>
                        <div style="position:absolute; height:100%; width:2px; left:50%; background:rgba(255,255,255,0.3);"></div>
                        <div style="position:absolute; left:${comparison.percentile}%; top:50%; transform:translate(-50%,-50%); font-size:0.7rem; font-weight:700; color:white; text-shadow: 0 0 4px rgba(0,0,0,0.8);">Vous</div>
                    </div>
                </div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:rgba(255,255,255,0.5);">
                <span>Score moyen : <strong style="color:rgba(255,255,255,0.8);">${comparison.avgScore}%</strong></span>
                <span>Démarche moy. : <strong style="color:rgba(255,255,255,0.8);">${comparison.avgDemarche}%</strong></span>
                <span>Rang : <strong style="color:${compColor};">#${comparison.rank}/${comparison.total}</strong></span>
            </div>
        </div>
    ` : `
        <div style="background:rgba(0,0,0,0.2); border-radius:8px; padding:12px; margin-top:12px; text-align:center;">
            <span style="font-size:0.85rem; color:rgba(255,255,255,0.5);">
                🏁 Première session sur ce cas — rejouez pour voir votre progression !
            </span>
        </div>
    `;

    // Assemblage final
    return `
        <!-- FEEDBACK DÉTAILLÉ POST-CAS -->
        <div class="detailed-feedback" style="margin-top:16px;">
            <!-- Grille de notation détaillée -->
            ${scoringGridHtml}

            <!-- Timeline -->
            <div style="background:rgba(0,0,0,0.2); border-radius:8px; padding:12px;">
                ${timelineHtml}
            </div>

            <!-- Points forts / faiblesses -->
            <div style="display:flex; gap:12px; margin-top:12px; flex-wrap:wrap;">
                ${analysis.strengths.length > 0 ? `
                <div style="flex:1; min-width:200px; background:rgba(46,204,113,0.08); border:1px solid rgba(46,204,113,0.2); border-radius:8px; padding:12px;">
                    <h4 style="color:#2ecc71; margin:0 0 8px; font-size:0.9rem;">👍 Points forts</h4>
                    <ul style="list-style:none; padding:0; margin:0; font-size:0.85rem;">${strengthItems}</ul>
                </div>` : ''}
                ${analysis.weaknesses.length > 0 ? `
                <div style="flex:1; min-width:200px; background:rgba(231,76,60,0.08); border:1px solid rgba(231,76,60,0.2); border-radius:8px; padding:12px;">
                    <h4 style="color:#e74c3c; margin:0 0 8px; font-size:0.9rem;">👎 À améliorer</h4>
                    <ul style="list-style:none; padding:0; margin:0; font-size:0.85rem;">${weaknessItems}</ul>
                </div>` : ''}
                ${analysis.tips.length > 0 ? `
                <div style="flex:1; min-width:200px; background:rgba(243,156,18,0.08); border:1px solid rgba(243,156,18,0.2); border-radius:8px; padding:12px;">
                    <h4 style="color:#f39c12; margin:0 0 8px; font-size:0.9rem;">💡 Conseils</h4>
                    <ul style="list-style:none; padding:0; margin:0; font-size:0.85rem;">${tipItems}</ul>
                </div>` : ''}
            </div>

            <!-- Explication pédagogique -->
            ${pedagogical}

            <!-- Comparaison anonyme -->
            ${comparisonBlock}
        </div>
    `;
}

window.renderDetailedFeedback = renderDetailedFeedback;

// ==================== FONCTIONS UTILITAIRES ====================

/** Compter le nombre de champs d'interrogatoire disponibles dans un cas. */
function getInterrogatoireFieldCount(currentCase) {
    if (!currentCase || !currentCase.interrogatoire) return 0;
    const interro = currentCase.interrogatoire;
    const mdv = interro.modeDeVie || {};
    let count = 0;
    if (mdv.activitePhysique) count++;
    if (mdv.tabac) count++;
    if (mdv.alcool) count++;
    if (mdv.alimentation) count++;
    if (mdv.emploi) count++;
    const ant = interro.antecedents || {};
    if (ant.medicaux && ant.medicaux.length > 0) count++;
    if (ant.chirurgicaux && ant.chirurgicaux.length > 0) count++;
    if (ant.familiaux && ant.familiaux.length > 0) count++;
    if (interro.traitements && interro.traitements.length > 0) count++;
    if (interro.allergies && interro.allergies.presence) count++;
    const hm = interro.histoireMaladie || {};
    if (hm.debutSymptomes) count++;
    if (hm.evolution) count++;
    if (hm.facteursDeclenchants) count++;
    if (hm.symptomesAssocies) count++;
    if (hm.remarques) count++;
    return count;
}

/** Générer une explication pédagogique spécifique au diagnostic du cas. */
function getDiagnosticExplanation(currentCase) {
    const diag = (currentCase.correctDiagnostic || '').toLowerCase();
    const id = (currentCase.id || '').toLowerCase();

    // Explications par catégorie de diagnostic
    if (diag.includes('idm') || diag.includes('infarctus') || diag.includes('angor') || diag.includes('scd')) {
        return 'L\'IDM est une urgence thrombotique : la démarche repose sur l\'ECG précoce (STEMI/NSTEMI), la biologie (troponine), et la reperfusion rapide (< 90 min pour l\'angioplastie primaire).';
    }
    if (diag.includes('epileps') || diag.includes('convuls')) {
        return 'L\'épilepsie repose sur l\'anamnèse (critères ILAE) et l\'EEG. Le traitement de fond dépend du type de crisis et du syndrome épileptique.';
    }
    if (diag.includes('pneumo') || diag.includes('pneumopathie')) {
        return 'La pneumopathie infectieuse nécessite une identification du germe et un antibiotique ciblé. Le CRP et la procalcitonine guident l\'antibiothérapie.';
    }
    if (diag.includes('pyelonephrite') || diag.includes('pyélonéphrite')) {
        return 'La pyélonéphrite aiguë est une infection urinaire haute. Le diagnostic repose sur l\'ECBU et l\'imagerie (échographie/scan) pour chercher un obstacle.';
    }
    if (diag.includes('sciatique') || diag.includes('racine') || diag.includes('radicul')) {
        return 'La radiculalgie par hernie discale repose sur l\'examen neurologique (topographie radiculaire) et l\'IRM en seconde intention.';
    }
    if (diag.includes('luxation') || diag.includes('arthrose') || diag.includes('tendinopathie')) {
        return 'En pathologie locomotrice, l\'examen clinique articulaire systématique et l\'imagerie adaptée (radio, échographie, IRM) sont la clé du diagnostic.';
    }
    if (diag.includes('anaphylaxie') || diag.includes('choc anaphylactique')) {
        return 'Le choc anaphylactique est une urgence vitale : injection d\'adrénaline IM en première intention, puis remplissage et corticoïdes.';
    }
    if (diag.includes('choc') || diag.includes('hemorragie') || diag.includes('hémorragie')) {
        return 'Le choc hémorragique impose : arrêter le saignement, remplissage volémique, et transfusion si nécessaire. L\'échographie FAST est l\'examen clé.';
    }

    // Générique par spécialité
    if (id.includes('cardio')) return 'En cardiologie, la démarche repose sur l\'ECG, l\'échocardiographie et les biomarqueurs cardiaques.';
    if (id.includes('neuro')) return 'En neurologie, l\'examen systématique (motricité, sensibilité, réflexes, coordination) guide l\'imagerie cérébrale.';
    if (id.includes('pneumo')) return 'En pneumologie, la radiographie thoracique et la gazométrie artérielle sont des examens de base.';
    if (id.includes('nephro') || id.includes('néphro')) return 'En néphrologie, la biologie (créatinine, BUN, ionogramme) et l\'échographie rénale sont fondamentales.';
    if (id.includes('locomo')) return 'En pathologie locomotrice, l\'examen articulaire comparatif et l\'imagerie adaptée orientent le diagnostic.';

    return 'Chaque cas clinique repose sur une démarche diagnostique structurée : interrogatoire, examen clinique, examens complémentaires, puis hypothèse diagnostique et traitement.';
}

/** Générer une explication pédagogique sur le traitement du cas. */
function getTreatmentExplanation(currentCase, hasFatalError) {
    const correctTreatments = currentCase.correctTreatments || [];
    const fatalTreatments = currentCase.fatalTreatments || [];

    if (hasFatalError && fatalTreatments.length > 0) {
        const fatalNames = fatalTreatments.join(', ');
        return `Les traitements contre-indiqués pour ce cas sont : <em>${escapeHtml(fatalNames)}</em>. Vérifiez toujours les contre-indications dans le RCP avant de prescrire.`;
    }

    if (correctTreatments.length === 0) return '';

    if (correctTreatments.length === 1) {
        return `Le traitement de référence est <em>${escapeHtml(correctTreatments[0])}</em>.`;
    }

    return `Le traitement de référence associe : <em>${escapeHtml(correctTreatments.join(' + '))}</em>.`;
}

/** Extraire les points clés pédagogiques du cas. */
function extractKeyPoints(currentCase) {
    const points = [];
    const diag = (currentCase.correctDiagnostic || '').toLowerCase();
    const treat = currentCase.correctTreatments || [];

    // Points clés diagnostiques
    if (diag) {
        points.push(`Diagnostic retenu : <strong>${escapeHtml(currentCase.correctDiagnostic)}</strong>`);
    }

    // Points clés thérapeutiques
    if (treat.length > 0) {
        points.push(`Traitement de référence : <strong>${escapeHtml(treat.join(' + '))}</strong>`);
    }

    // Points clés issus des verrous
    const locks = currentCase.locks || [];
    locks.forEach(lock => {
        if (lock.feedback_error) {
            points.push(escapeHtml(lock.feedback_error));
        }
    });

    // Points clés de la correction
    const correction = currentCase.correction || '';
    if (correction) {
        // Extraire la première phrase significative de la correction
        const firstSentence = correction.split(/[.\n]/).find(s => s.trim().length > 20);
        if (firstSentence) {
            points.push(escapeHtml(firstSentence.trim()));
        }
    }

    return points.slice(0, 4); // Maximum 4 points clés
}