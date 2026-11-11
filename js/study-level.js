/**
 * js/study-level.js — L'année d'étude du joueur, de la 2e à la 6e année.
 *
 * Medgame s'adresse aux étudiants en médecine de DFGSM2 à DFASM3. On n'attend
 * pas la même chose d'un étudiant qui découvre la sémiologie et d'un externe
 * à quelques mois des ECOS : ce module est la SOURCE UNIQUE de ce que chaque
 * année change dans le jeu.
 *
 *   - le patient et l'infirmier (bloc de prompt, lu par js/patient-brain.js) ;
 *   - les cas conseillés (difficulté adaptée, lue par js/themes.js) ;
 *   - les attendus du débriefing (seuils et poids par domaine de compétence,
 *     lus par js/clinical-debriefing.js) ;
 *   - la feuille de route affichée en partie (js/study-level-ui.js).
 *
 * Il ne touche PAS à la note : engine/scoring.js reste le seul noteur, et le
 * classement compare tout le monde sur la même échelle. L'année change l'aide,
 * le patient et la lecture du résultat, pas le barème.
 *
 * Pur (ni DOM, ni réseau) : script classique côté navigateur, importé pour
 * effets de bord sous Node (tests, engine). Seuls `currentId` / `set` lisent
 * `localStorage`, et seulement s'il existe.
 */
(function (root) {
    'use strict';

    const STORAGE_KEY = 'medgame.level.v1';
    const DEFAULT_LEVEL = 'DFGSM3';

    const PILLARS = ['anamnese', 'examen', 'paraclinique', 'therapeutique', 'communication'];
    const PILLAR_LABELS = {
        anamnese: 'Interrogatoire',
        examen: 'Examen clinique',
        paraclinique: 'Examens complémentaires',
        therapeutique: 'Décision thérapeutique',
        communication: 'Relation avec le patient'
    };

    /**
     * `weights`  : part de chaque domaine dans le bilan de l'année (somme 100).
     * `expected` : seuil attendu en % ; `null` = découverte, non exigé.
     * `difficulty` : étoiles de cas idéales [min, max] pour cette année.
     */
    const LEVELS = {
        DFGSM2: {
            id: 'DFGSM2', year: 2, cycle: 1,
            short: '2e année', label: '2e année · DFGSM2',
            focus: 'Sémiologie : mener un interrogatoire structuré et un examen clinique complet.',
            objectives: [
                'Se présenter et laisser le patient exposer son motif',
                'Caractériser le symptôme principal (siège, type, intensité, durée, facteurs)',
                'Recueillir antécédents, traitements, allergies et mode de vie',
                'Réaliser l\'examen clinique de l\'appareil concerné'
            ],
            weights: { anamnese: 40, examen: 30, paraclinique: 5, therapeutique: 0, communication: 25 },
            expected: { anamnese: 50, examen: 40, paraclinique: null, therapeutique: null, communication: 50 },
            difficulty: [1, 1],
            patient: 'Tu es patient(e) et indulgent(e) : une question maladroite, scolaire ou mal formulée mais bienveillante obtient quand même une réponse utile. Tu ne te vexes pas d\'une hésitation. Un mot de jargon t\'étonne (« c\'est quoi, ça ? ») sans te braquer : trustDelta jamais inférieur à -4 pour une simple maladresse.',
            nurse: 'L\'infirmier est un tuteur discret : si l\'étudiant semble bloqué ou oublie une étape de base (constantes, antécédents, allergies), il peut le rappeler UNE fois, en une phrase, dans "narrativeResponse". Il ne donne jamais le diagnostic.',
            next: 'En 3e année, on attendra en plus que tu regroupes les signes en syndrome et que tu proposes des hypothèses.'
        },
        DFGSM3: {
            id: 'DFGSM3', year: 3, cycle: 1,
            short: '3e année', label: '3e année · DFGSM3',
            focus: 'Du signe au syndrome : regrouper les signes et formuler des hypothèses diagnostiques.',
            objectives: [
                'Mener un interrogatoire complet et orienté par le motif',
                'Rechercher les signes positifs et négatifs à l\'examen clinique',
                'Regrouper les signes en syndrome et proposer des hypothèses',
                'Demander les examens de première intention'
            ],
            weights: { anamnese: 30, examen: 30, paraclinique: 15, therapeutique: 5, communication: 20 },
            expected: { anamnese: 60, examen: 50, paraclinique: 40, therapeutique: null, communication: 55 },
            difficulty: [1, 2],
            patient: 'Tu es plutôt coopératif(ve) : tu réponds volontiers aux questions claires, mais tu ne devances pas les questions qu\'on ne te pose pas. Une maladresse isolée ne te braque pas.',
            nurse: 'L\'infirmier peut rappeler UNE fois une étape de base oubliée (constantes, allergies) si l\'étudiant est bloqué. Il ne suggère ni examen complémentaire ni diagnostic.',
            next: 'En 4e année, on attendra une stratégie d\'examens hiérarchisée et un traitement de première ligne.'
        },
        DFASM1: {
            id: 'DFASM1', year: 4, cycle: 2,
            short: '4e année', label: '4e année · DFASM1',
            focus: 'Raisonnement clinique : hiérarchiser les hypothèses et justifier chaque examen.',
            objectives: [
                'Hiérarchiser les hypothèses et éliminer les urgences',
                'Prescrire les examens pertinents, sans bilan « parapluie »',
                'Poser le diagnostic et proposer le traitement de première ligne',
                'Expliquer la suite au patient avec des mots simples'
            ],
            weights: { anamnese: 25, examen: 20, paraclinique: 20, therapeutique: 15, communication: 20 },
            expected: { anamnese: 65, examen: 55, paraclinique: 60, therapeutique: 50, communication: 60 },
            difficulty: [2, 2],
            patient: 'Tu te comportes comme un vrai patient d\'hôpital : tu réponds à ce qu\'on te demande, sans plus. Les questions vagues obtiennent des réponses vagues.',
            nurse: 'L\'infirmier exécute les prescriptions et ne signale que les risques réels. Il ne rappelle aucune étape et ne suggère rien.',
            next: 'En 5e année, on attendra une prise en charge complète, contre-indications et surveillance comprises.'
        },
        DFASM2: {
            id: 'DFASM2', year: 5, cycle: 2,
            short: '5e année', label: '5e année · DFASM2',
            focus: 'Prise en charge complète : gravité, traitement, contre-indications, surveillance.',
            objectives: [
                'Repérer les signes de gravité dès les premières minutes',
                'Prescrire un bilan ciblé et l\'interpréter',
                'Traiter sans erreur dangereuse (contre-indications, interactions)',
                'Annoncer, expliquer et vérifier la compréhension du patient'
            ],
            weights: { anamnese: 20, examen: 15, paraclinique: 20, therapeutique: 25, communication: 20 },
            expected: { anamnese: 70, examen: 60, paraclinique: 70, therapeutique: 65, communication: 65 },
            difficulty: [2, 3],
            patient: 'Tu es un patient réaliste : tu peux minimiser, digresser ou poser des questions inquiètes. Le jargon non expliqué t\'agace et la confiance s\'en ressent.',
            nurse: 'L\'infirmier exécute les prescriptions et ne signale que les risques réels. Aucune aide, aucun rappel.',
            next: 'En 6e année, on attendra le même niveau en temps limité, sans aide, comme aux ECOS.'
        },
        DFASM3: {
            id: 'DFASM3', year: 6, cycle: 2,
            short: '6e année', label: '6e année · DFASM3',
            focus: 'Conditions d\'examen : EDN et ECOS, temps limité, aucune aide.',
            objectives: [
                'Conduire toute la station dans le temps imparti',
                'Ne demander que les examens qui changent la décision',
                'Sécuriser la prescription : zéro traitement dangereux',
                'Soigner la communication : écoute, reformulation, annonce'
            ],
            weights: { anamnese: 20, examen: 15, paraclinique: 20, therapeutique: 25, communication: 20 },
            expected: { anamnese: 75, examen: 65, paraclinique: 75, therapeutique: 75, communication: 70 },
            difficulty: [3, 4],
            patient: 'Tu es un patient standardisé d\'ECOS : réaliste, parfois réticent ou anxieux. Tu ne donnes rien spontanément au-delà de ce que prévoient tes consignes, et tu réagis franchement à un manque d\'écoute ou à du jargon.',
            nurse: 'Conditions d\'examen : l\'infirmier exécute, signale uniquement un risque vital, et ne donne aucun indice.',
            next: 'Tu es au niveau des épreuves : varie les spécialités et enchaîne les stations chronométrées.'
        }
    };

    const ORDER = ['DFGSM2', 'DFGSM3', 'DFASM1', 'DFASM2', 'DFASM3'];

    /** Conseil par domaine quand le seuil de l'année n'est pas atteint. */
    const ADVICE = {
        anamnese: {
            1: 'Déroule un plan fixe : motif, histoire de la maladie, antécédents, traitements, allergies, mode de vie.',
            2: 'Oriente l\'interrogatoire par tes hypothèses : cherche les signes négatifs qui éliminent les diagnostics graves.'
        },
        examen: {
            1: 'Examine au moins l\'appareil concerné par le motif, et pense aux constantes.',
            2: 'Examine l\'appareil en cause et ceux qui portent les signes de gravité ou les diagnostics différentiels.'
        },
        paraclinique: {
            1: 'Commence par les examens simples de première intention qui confirment ton hypothèse.',
            2: 'Chaque examen doit répondre à une question : privilégie ceux recommandés en première intention et évite le bilan systématique.'
        },
        therapeutique: {
            1: 'Retiens le traitement de première ligne du diagnostic, et pourquoi il agit.',
            2: 'Vérifie contre-indications et allergies avant de prescrire ; le traitement de première ligne d\'abord.'
        },
        communication: {
            1: 'Présente-toi, utilise des mots simples, laisse le patient finir ses phrases.',
            2: 'Reformule, explique sans jargon et réponds aux inquiétudes : c\'est noté aux ECOS.'
        }
    };

    // ==================== IDENTIFIANT ====================

    /** Accepte « DFASM1 », « dfasm 1 », « D2 », « P2 », 4, « 4e année »… */
    function normalize(value) {
        if (value == null) return null;
        const s = String(value).trim().toUpperCase().replace(/[\s._-]+/g, '');
        if (LEVELS[s]) return s;
        const alias = { P2: 'DFGSM2', D1: 'DFGSM3', D2: 'DFASM1', D3: 'DFASM2', D4: 'DFASM3', L2: 'DFGSM2', L3: 'DFGSM3', M1: 'DFASM1', M2: 'DFASM2' };
        if (alias[s]) return alias[s];
        const m = s.match(/^([2-6])(E|EME|ÈME)?(ANNEE|ANNÉE)?$/);
        if (m) return ORDER[parseInt(m[1], 10) - 2];
        return null;
    }

    function storage() {
        try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
    }

    /** L'année a-t-elle été choisie explicitement sur cet appareil ? */
    function isSet() {
        const st = storage();
        return !!(st && normalize(st.getItem(STORAGE_KEY)));
    }

    /** Année courante : choix local, sinon rang du profil, sinon défaut. */
    function currentId() {
        const st = storage();
        if (st) {
            const own = normalize(st.getItem(STORAGE_KEY));
            if (own) return own;
            try {
                const rank = normalize(JSON.parse(st.getItem('medgame_profile') || '{}').rank);
                if (rank) return rank;
            } catch (e) { /* profil illisible : défaut */ }
        }
        return DEFAULT_LEVEL;
    }

    function set(value) {
        const id = normalize(value);
        if (!id) return null;
        const st = storage();
        if (st) { try { st.setItem(STORAGE_KEY, id); } catch (e) { /* quota : choix non persisté */ } }
        if (typeof document !== 'undefined' && typeof CustomEvent === 'function') {
            document.dispatchEvent(new CustomEvent('medgame:level-changed', { detail: { level: id } }));
        }
        return id;
    }

    function get(value) {
        return LEVELS[normalize(value) || currentId()];
    }

    // ==================== PATIENT ====================

    /** Bloc inséré dans le prompt unique du patient (js/patient-brain.js). */
    function promptBlock(value) {
        const id = normalize(value);
        if (!id) return '';
        const lv = LEVELS[id];
        return [
            `L'étudiant est en ${lv.short} de médecine (${lv.id}). Attendu à ce niveau : ${lv.focus}`,
            `- Patient : ${lv.patient}`,
            `- Infirmier : ${lv.nurse}`,
            '- Ce niveau ne change ni le dossier, ni la physiologie, ni les conséquences d\'une prescription.'
        ].join('\n');
    }

    // ==================== CAS CONSEILLÉS ====================

    /**
     * Adéquation d'un cas à l'année : 'ideal' (dans la cible), 'revision'
     * (plus simple que la cible) ou 'ambitieux' (au-dessus).
     */
    function caseFit(value, meta) {
        const lv = get(value);
        const d = Math.max(1, Math.min(4, parseInt(meta && meta.difficulty, 10) || 2));
        const [lo, hi] = lv.difficulty;
        if (d < lo) return { fit: 'revision', label: 'Révision', difficulty: d };
        if (d > hi) return { fit: 'ambitieux', label: 'Ambitieux', difficulty: d };
        return { fit: 'ideal', label: `Conseillé en ${lv.short}`, difficulty: d };
    }

    /** Tri stable : conseillés non faits, conseillés faits, ambitieux, révision. */
    function sortForLevel(cases, value) {
        const rank = (c) => {
            const f = caseFit(value, c).fit;
            const base = f === 'ideal' ? 0 : f === 'ambitieux' ? 2 : 3;
            return base + (f === 'ideal' && c.isPlayed ? 1 : 0);
        };
        return (cases || [])
            .map((c, i) => ({ c, i, r: rank(c) }))
            .sort((a, b) => a.r - b.r || (a.c.difficulty || 2) - (b.c.difficulty || 2) || a.i - b.i)
            .map(x => x.c);
    }

    // ==================== BILAN DE L'ANNÉE ====================

    /**
     * Lit un profil de compétences (5 domaines en %) avec les attendus de
     * l'année. Les domaines « découverte » ne comptent pas dans le bilan.
     */
    function expectations(value, pillars) {
        const lv = get(value);
        const p = pillars || {};
        let sum = 0;
        let weightSum = 0;
        const rows = PILLARS.map(key => {
            const v = Math.max(0, Math.min(100, Math.round(Number(p[key]) || 0)));
            const expected = lv.expected[key];
            const weight = lv.weights[key] || 0;
            let status;
            if (expected == null) status = 'decouverte';
            else if (v >= expected) status = 'acquis';
            else if (v >= expected - 20) status = 'en_cours';
            else status = 'a_travailler';
            if (expected != null && weight > 0) { sum += v * weight; weightSum += weight; }
            return {
                key, label: PILLAR_LABELS[key], value: v, expected, weight, status,
                advice: status === 'acquis' || status === 'decouverte' ? '' : ADVICE[key][lv.cycle]
            };
        });
        const score = weightSum ? Math.round(sum / weightSum) : 0;
        const due = rows.filter(r => r.expected != null);
        const acquired = due.filter(r => r.status === 'acquis').length;
        const weak = due.filter(r => r.status === 'a_travailler');
        let verdict;
        if (acquired === due.length) verdict = `Tous les attendus de ${lv.short} sont atteints sur ce cas.`;
        else if (!weak.length) verdict = `Tu es proche des attendus de ${lv.short} : ${acquired} domaine(s) sur ${due.length} atteints.`;
        else verdict = `À travailler en priorité : ${weak.map(r => r.label.toLowerCase()).join(', ')}.`;
        return { level: lv, score, rows, acquired, total: due.length, verdict, next: lv.next };
    }

    root.StudyLevel = {
        STORAGE_KEY, DEFAULT_LEVEL, ORDER, LEVELS, PILLARS, PILLAR_LABELS,
        normalize, isSet, currentId, set, get,
        promptBlock, caseFit, sortForLevel, expectations
    };
})(typeof globalThis !== 'undefined' ? globalThis : this);
