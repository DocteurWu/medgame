/**
 * engine/scoring.js — Source unique des conversions d'echelle et de la regle
 * de notation /100 historique.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Le projet avait DEUX moteurs de note qui ne se parlaient pas :
 *
 *   1. Le navigateur (game.js) note sur /20 via `JevClient.evaluateStation()`,
 *      puis convertit en /100 au seul endroit ou c'est necessaire (l'XP).
 *   2. Le serveur MCP (engine/MedGameEngine.js) notait sur /100 avec une
 *      regle COMPLETEMENT DIFFERENTE (35 + 25 + 25 + 15, rapprochement
 *      textuel des libelles), codee en dur dans `submit()`.
 *
 * Deux algorithmes, deux echelles, aucun pont : le meme cas joue dans le
 * navigateur et via le MCP ne donnait pas le meme resultat, et personne
 * pouvait dire lequel fait foi.
 *
 * Ce module ne tranche pas entre les deux, il les SEPARE proprement :
 *
 *   - `computeClassicScore()` : la regle /100 historique, extraite VERBATIM
 *     de l'engine. C'est la seule implementation de cette regle.
 *   - `toScore20()` / `toScore100()` : les conversions, au meme endroit.
 *
 * Le navigateur reste sur la note ECOS /20 (JevClient) : c'est la notation
 * officielle, et c'est le SEUL noteur du navigateur (cf. test/anticheat.test.mjs,
 * qui interdit la resurrection d'un ancien moteur de note cote navigateur).
 * `js/jevClient.js` re-exporte `toScore100` pour que la conversion ait un
 * seul point d'entree de ce cote-la aussi.
 *
 * L'engine continue de renvoyer `score` sur /100 parce que le contrat MCP et
 * `ai-watch.html` en dependent, mais il renvoie DESORMAIS aussi `scoreOn20`,
 * obtenu par la conversion de ce module et non par un calcul parallele.
 *
 * Le module est PUR : ni DOM, ni Node, ni dependance. Il est donc lisible
 * par le navigateur (module ES) ET par Node (l'engine et les tests).
 *
 * ATTENTION au nom : un ancien `js/scoring.js` (moteur de note complet) a
 * ete supprime lors de la bascule JEV, et les tests interdisent qu'il
 * revienne. Ce fichier n'est pas son retour : c'est la regle /100 de
 * l'engine et les conversions d'echelle, sans aucune notation cote
 * navigateur.
 */

/** Seuil de similarite accepte entre le diagnostic saisi et le attendu. */
export const DIAGNOSTIC_TYPO_SIMILARITY = 0.88;

/** Bareme de la regle /100 historique, en points. */
export const CLASSIC_WEIGHTS = {
    diagnostic: 35,
    exam: 25,
    treatment: 25,
    communication: 15
};

/**
 * Normalise un libelle pour comparaison : minuscules, sans accent, sans
 * ponctuation.
 */
export function normalizeText(text) {
    if (!text) return '';
    return String(text)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Distance de Levenshtein entre deux chaines.
 */
export function getLevenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

/**
 * Similarite de Levenshtein normalisee, entre 0 et 1.
 */
export function getSimilarity(a, b) {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return 1 - getLevenshteinDistance(a, b) / maxLen;
}

/**
 * Deux libelles d'examen designent-ils la meme chose ? Approche tolérante :
 * inclusion, similarite, puis chevauchement de jetons significatifs.
 */
export function fuzzyMatchExam(availableName, relevantName) {
    const a = normalizeText(availableName);
    const r = normalizeText(relevantName);
    if (!a || !r) return false;
    if (a === r || a.includes(r) || r.includes(a)) return true;
    if (getSimilarity(a, r) >= 0.6) return true;
    const aTokens = a.split(' ').filter(w => w.length > 3);
    const rTokens = r.split(' ').filter(w => w.length > 3);
    return aTokens.some(t => rTokens.some(rt => rt.includes(t) || t.includes(rt)));
}

/**
 * Note /100 -> note /20 (echelle ECOS officielle).
 */
export function toScore20(score100) {
    const s = Number(score100);
    if (!Number.isFinite(s)) return 0;
    return Math.max(0, Math.min(20, s / 5));
}

/**
 * Note /20 (ECOS) -> note /100, pour l'XP et les affichages historiques.
 */
export function toScore100(score20) {
    const s = Number(score20);
    if (!Number.isFinite(s)) return 0;
    return Math.max(0, Math.min(100, Math.round(s * 5)));
}

/**
 * Regle de notation /100 historique, extraite VERBATIM de
 * `MedGameEngine.submit()`.
 *
 * @param {object} input
 * @param {object} input.caseData        donnees du cas (correctDiagnostic, examGradation, relevantExams...)
 * @param {string} input.selectedDiagnostic diagnostic choisi par le joueur
 * @param {string[]} input.activeExams    examens complementaires demandes
 * @param {string[]} input.selectedTreatments traitements prescrits
 * @param {number} input.anamnesisCount   nombre de questions d'anamnese posees
 * @param {number} input.trust            confiance du patient (0-100)
 * @param {boolean} input.hasGestures     au moins un geste clinique realise
 * @returns {{score: number, diagnosticScore: number, examScore: number, treatmentScore: number, communicationScore: number}}
 */
export function computeClassicScore(input) {
    const {
        caseData = {},
        selectedDiagnostic = '',
        activeExams = [],
        selectedTreatments = [],
        anamnesisCount = 0,
        trust = 0,
        hasGestures = false
    } = input || {};

    // 1. Score Diagnostic (sur 35 points)
    const correctDiags = Array.isArray(caseData.correctDiagnostic)
        ? caseData.correctDiagnostic
        : [caseData.correctDiagnostic].filter(Boolean);
    const altDiags = caseData.alternativeDiagnostics || [];

    const isDiagCorrect = correctDiags.some(cd =>
        getSimilarity(normalizeText(cd), normalizeText(selectedDiagnostic)) >= DIAGNOSTIC_TYPO_SIMILARITY
    );
    const isDiagAlternative = !isDiagCorrect && altDiags.some(ad =>
        getSimilarity(normalizeText(ad), normalizeText(selectedDiagnostic)) >= DIAGNOSTIC_TYPO_SIMILARITY
    );
    const diagnosticScore = isDiagCorrect ? 35 : (isDiagAlternative ? 18 : 0);

    // 2. Score Examens Complementaires via examGradation ou relevantExams (sur 25 points)
    let examScore = 25;
    const grad = caseData.examGradation;
    const relevant = caseData.relevantExams || [];

    if (grad) {
        const parfaits = grad.parfaits || [];
        const inutiles = grad.inutiles || [];
        const dangereux = grad.dangereux || [];

        const hitsParfaits = parfaits.filter(p => activeExams.some(ae => fuzzyMatchExam(ae, p))).length;
        const ratioParfaits = parfaits.length > 0 ? (hitsParfaits / parfaits.length) : 1;
        examScore = Math.round(ratioParfaits * 25);

        for (const ae of activeExams) {
            if (inutiles.some(i => fuzzyMatchExam(ae, i))) examScore -= 4;
            if (dangereux.some(d => fuzzyMatchExam(ae, d))) examScore -= 12;
        }
    } else if (relevant.length > 0) {
        const hits = relevant.filter(r => activeExams.some(ae => fuzzyMatchExam(ae, r))).length;
        const overPrescription = Math.max(0, activeExams.length - relevant.length);
        examScore = Math.round((hits / relevant.length) * 25) - (overPrescription * 3);
    }
    examScore = Math.max(0, Math.min(25, examScore));

    // 3. Score Therapeutique (sur 25 points)
    const correctTx = caseData.correctTreatments || [];
    let treatmentScore = 25;
    if (correctTx.length > 0) {
        const txHits = correctTx.filter(ct => selectedTreatments.includes(ct)).length;
        const wrongTx = selectedTreatments.filter(st => !correctTx.includes(st) && !(caseData.secondLineTreatments || []).includes(st)).length;
        treatmentScore = Math.round((txHits / correctTx.length) * 25) - (wrongTx * 5);
    }
    treatmentScore = Math.max(0, Math.min(25, treatmentScore));

    // 4. Score Anamnese, Examen Clinique & Relationnel ECOS (sur 15 points)
    const anamnesisPoints = Math.min(8, anamnesisCount * 1.5);
    const trustBonus = trust >= 65 ? 4 : (trust >= 45 ? 2 : 0);
    const gestureBonus = hasGestures ? 3 : 0;
    const communicationScore = Math.round(Math.min(15, anamnesisPoints + trustBonus + gestureBonus));

    return {
        score: Math.round(diagnosticScore + examScore + treatmentScore + communicationScore),
        diagnosticScore,
        examScore,
        treatmentScore,
        communicationScore
    };
}

// Pas d'exposition sur `window` : ce module ne doit pas devenir un second
// moteur de note accessible au navigateur. Seuls `toScore20` / `toScore100`
// sont utilises cote client, via `js/jevClient.js`.
