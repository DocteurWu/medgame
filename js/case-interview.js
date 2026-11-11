/**
 * js/case-interview.js — Créer un cas en le racontant.
 *
 * Un étudiant raconte un patient vu en stage (au clavier ou à la voix, avec la
 * dictée du système : Windows + H). Une IA mène l'entretien comme un chef de
 * clinique curieux — « il avait quel âge ? », « comment tu as trouvé ça ? » —
 * UNE question à la fois, puis rédige la fiche du patient au format des cas
 * du jeu, que l'étudiant peut tester aussitôt.
 *
 * Ce fichier porte toute la logique, sans DOM ni réseau (testé sous Node) :
 *   - la liste de ce qu'un cas doit contenir, et ce qui manque encore ;
 *   - le prompt de l'entretien et l'analyse de chaque tour ;
 *   - la mise au format final : ce que l'étudiant a dit PRIME sur ce que l'IA
 *     a complété, et le cas sort cohérent avec la base (diagnostic parmi les
 *     propositions, examens pertinents parmi les examens disponibles…).
 *
 * Confidentialité : l'identité du patient n'est jamais recueillie. Le nom est
 * toujours fictif, quoi que l'étudiant ait dicté.
 *
 * Interface : js/editor-interview.js (editor.html).
 */
(function (root) {
    'use strict';

    const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    const text = (v) => (typeof v === 'string' ? v.trim() : '');
    const has = (v) => {
        if (v == null) return false;
        if (typeof v === 'string') return v.trim().length > 0;
        if (typeof v === 'number') return Number.isFinite(v);
        if (Array.isArray(v)) return v.some(has);
        if (isObj(v)) return Object.values(v).some(has);
        return !!v;
    };
    const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

    function normalize(s) {
        return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    }

    function slugify(s, max = 40) {
        return normalize(s).replace(/ /g, '_').slice(0, max).replace(/_+$/, '');
    }

    // ==================== CE QU'UN CAS DOIT CONTENIR ====================

    /**
     * `paths` : il suffit qu'un seul soit renseigné. `essential` : sans lui,
     * la fiche ne peut pas être rédigée. `question` : question de repli si
     * l'IA n'en propose pas (et question d'ouverture).
     */
    const CHECKLIST = [
        { id: 'motif', label: 'Motif de venue', essential: true, paths: ['interrogatoire.motifHospitalisation'], question: 'Raconte-moi : pourquoi ce patient venait-il, et où l\'as-tu vu (urgences, consultation, service) ?' },
        { id: 'patient', label: 'Âge et sexe', essential: true, paths: ['patient.age'], question: 'Il avait quel âge, et c\'était un homme ou une femme ?' },
        { id: 'histoire', label: 'Histoire de la maladie', paths: ['interrogatoire.histoireMaladie'], question: 'Comment ça avait commencé ? Depuis quand, et qu\'est-ce qui déclenchait ou soulageait ?' },
        { id: 'antecedents', label: 'Antécédents', paths: ['interrogatoire.antecedents'], question: 'Est-ce qu\'il avait des antécédents, médicaux, chirurgicaux ou familiaux ?' },
        { id: 'traitements', label: 'Traitements et allergies', paths: ['interrogatoire.traitements', 'interrogatoire.allergies'], question: 'Il prenait quels médicaments ? Des allergies connues ?' },
        { id: 'modeDeVie', label: 'Mode de vie', paths: ['interrogatoire.modeDeVie'], question: 'Côté mode de vie : tabac, alcool, métier, activité physique ?' },
        { id: 'constantes', label: 'Constantes', paths: ['examenClinique.constantes'], question: 'Tu te souviens de ses constantes : tension, pouls, saturation, température ?' },
        { id: 'examen', label: 'Examen clinique', paths: ['examenClinique.aspectGeneral', 'examenClinique.signes'], question: 'Qu\'est-ce que tu as trouvé à l\'examen clinique ? Même ce qui était normal m\'intéresse.' },
        { id: 'examens', label: 'Examens complémentaires', paths: ['examResults'], question: 'Quels examens ont été faits, et qu\'est-ce qu\'ils montraient ?' },
        { id: 'diagnostic', label: 'Diagnostic retenu', essential: true, paths: ['correctDiagnostic'], question: 'Au final, quel diagnostic a été retenu ?' },
        { id: 'differentiels', label: 'Diagnostics écartés', paths: ['alternativeDiagnostics'], question: 'À quoi d\'autre l\'équipe a-t-elle pensé avant de trancher ?' },
        { id: 'traitement', label: 'Prise en charge', paths: ['correctTreatments'], question: 'Comment a-t-il été traité ? Et y avait-il quelque chose à ne surtout pas donner ?' },
        { id: 'lecon', label: 'Ce qu\'il faut retenir', paths: ['lecon'], question: 'Qu\'est-ce qui t\'a marqué dans ce cas : un piège, ou ce que tu voudrais qu\'un camarade retienne ?' }
    ];

    function createState() {
        return { facts: {}, transcript: [], skipped: [], images: [] };
    }

    /** Où en est la fiche : éléments recueillis, écartés, prochain manque. */
    function coverage(state) {
        const facts = (state && state.facts) || {};
        const skipped = new Set((state && state.skipped) || []);
        const items = CHECKLIST.map(item => {
            const done = item.paths.some(p => has(get(facts, p)));
            return { id: item.id, label: item.label, essential: !!item.essential, done, skipped: !done && skipped.has(item.id) };
        });
        const settled = items.filter(i => i.done || i.skipped).length;
        const missing = items.filter(i => !i.done && !i.skipped);
        const missingEssential = items.filter(i => i.essential && !i.done);
        return {
            items,
            percent: Math.round((settled / items.length) * 100),
            missing,
            next: missing[0] || null,
            // Les éléments essentiels ne peuvent pas être « inventés » par l'IA.
            canBuild: missingEssential.length === 0,
            missingEssential
        };
    }

    /** Question déterministe : ouverture, et repli si l'IA n'en donne pas. */
    function fallbackQuestion(state) {
        const cov = coverage(state);
        if (cov.missingEssential.length) return CHECKLIST.find(c => c.id === cov.missingEssential[0].id).question;
        if (cov.next) return CHECKLIST.find(c => c.id === cov.next.id).question;
        return 'J\'ai tout ce qu\'il me faut. Tu veux ajouter un détail, ou je rédige la fiche du patient ?';
    }

    // ==================== ENTRETIEN ====================

    const FACTS_FORMAT = `{
  "specialite": "cardiologie, neurologie, urgence…",
  "contexte": "où et comment le patient a été vu",
  "patient": { "age": 58, "sexe": "M" ou "F", "taille": "172 cm", "poids": "75 kg", "profession": "…" },
  "interrogatoire": {
    "motifHospitalisation": "…",
    "histoireMaladie": { "debutSymptomes": "…", "evolution": "…", "facteursDeclenchants": "…", "facteursCalmants": "…", "descriptionDouleur": "…", "symptomesAssocies": ["…"], "remarques": "…" },
    "antecedents": { "medicaux": [{ "type": "…", "traitement": "…" }], "chirurgicaux": [{ "intervention": "…", "annee": "…" }], "familiaux": [{ "antecedent": "…", "lien": "…" }] },
    "traitements": [{ "nom": "…", "dose": "…", "frequence": "…" }],
    "allergies": { "presence": true ou false, "liste": ["…"] },
    "modeDeVie": { "tabac": { "quantite": "…" }, "alcool": { "quantite": "…" }, "activitePhysique": { "description": "…" }, "emploi": { "profession": "…" } }
  },
  "examenClinique": {
    "constantes": { "tension": "130/80 mmHg", "pouls": "88 bpm", "temperature": "37.2°C", "saturationO2": "97%", "frequenceRespiratoire": "18/min" },
    "aspectGeneral": "…",
    "signes": { "cardiovasculaire": "…", "pulmonaire": "…", "abdominal": "…", "neurologique": "…", "autre": "…" }
  },
  "examResults": { "ECG": "résultat tel que raconté", "Scanner thoracique": "…" },
  "correctDiagnostic": "…",
  "alternativeDiagnostics": ["…"],
  "correctTreatments": ["…"],
  "fatalTreatments": ["ce qu'il ne fallait surtout pas donner"],
  "evolution": "ce qu'est devenu le patient",
  "lecon": "le piège ou le message à retenir"
}`;

    function buildTurnPrompt(state) {
        const cov = coverage(state);
        const missing = cov.missing.map(i => `- ${i.id} : ${i.label}${i.essential ? ' (INDISPENSABLE)' : ''}`).join('\n') || '- rien : la fiche est complète';
        const skipped = cov.items.filter(i => i.skipped).map(i => i.label).join(', ') || 'aucun';
        return `Tu aides un étudiant en médecine à transformer un patient qu'il a vu en stage en cas clinique jouable pour ses camarades. Tu mènes l'entretien comme un chef de clinique curieux et bienveillant qui se fait raconter le cas à la machine à café.

COMMENT TU PARLES
- Tu tutoies. UNE seule question à la fois, courte, à l'oral (« Il avait quel âge ? », « Et à l'auscultation, tu as trouvé quoi ? », « Comment vous avez su que c'était ça ? »).
- Tu rebondis d'abord sur ce qu'il vient de dire (un mot suffit), puis tu vas chercher l'élément manquant le plus utile. L'ordre naturel d'une observation : motif, patient, histoire, antécédents, traitements, examen, examens complémentaires, diagnostic, prise en charge, leçon.
- Tu ne fais pas la leçon, tu ne corriges pas sa médecine, tu ne proposes pas de diagnostic. Si un résultat paraît incohérent, tu demandes simplement de confirmer.
- L'étudiant dicte souvent à la voix : corrige en silence les erreurs de reconnaissance (« tropo » → troponine, « 12 8 » → 120/80 mmHg, « sat » → saturation).

CE QUE TU ENREGISTRES
- "updates" ne contient QUE ce que l'étudiant vient de dire, rangé dans le format ci-dessous, en terminologie médicale propre. Tu n'inventes et ne complètes rien : ce travail viendra après.
- S'il ne sait pas, ne se souvient plus ou te dit d'inventer, mets l'identifiant de l'élément dans "skip" et passe au suivant sans insister.
- Secret médical : n'enregistre JAMAIS de nom, prénom, date précise, nom d'hôpital ou de médecin. S'il en donne, ignore-les sans commentaire (un nom fictif sera attribué).

FORMAT DE "updates" (n'y mets que les clés concernées par ce tour)
${FACTS_FORMAT}

FICHE DÉJÀ RECUEILLIE
${JSON.stringify(state.facts || {})}

IL MANQUE ENCORE
${missing}

L'ÉTUDIANT NE SAIT PAS (ne plus demander) : ${skipped}

RÉPONSE : uniquement un objet JSON
{ "updates": { … } ou {}, "skip": ["identifiant", …] ou [], "question": "ta prochaine question", "done": true si plus rien d'utile à demander }`;
    }

    /** Messages à envoyer au modèle pour le tour en cours. */
    function buildTurnMessages(state, studentText) {
        const history = (state.transcript || []).slice(-12).map(m => ({
            role: m.role === 'student' ? 'user' : 'assistant',
            content: m.text
        }));
        return [
            { role: 'system', content: buildTurnPrompt(state) },
            ...history,
            { role: 'user', content: String(studentText || '') }
        ];
    }

    function parseJson(raw) {
        let s = String(raw || '').trim();
        const block = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (block) s = block[1].trim();
        try { return JSON.parse(s); } catch (e) { /* extraction */ }
        const a = s.indexOf('{');
        const b = s.lastIndexOf('}');
        if (a !== -1 && b > a) return JSON.parse(s.slice(a, b + 1));
        throw new Error('Réponse illisible.');
    }

    const IDENTITY_KEYS = new Set(['nom', 'prenom', 'nomComplet', 'dateNaissance']);
    const CHECK_IDS = new Set(CHECKLIST.map(c => c.id));

    /** Retire toute identité, les valeurs vides et les « … » du gabarit. */
    function cleanFacts(value, parentKey) {
        if (Array.isArray(value)) {
            const out = value.map(v => cleanFacts(v)).filter(has);
            return out.length ? out : undefined;
        }
        if (isObj(value)) {
            const out = {};
            for (const [k, v] of Object.entries(value)) {
                if (parentKey === 'patient' && IDENTITY_KEYS.has(k)) continue;
                const c = cleanFacts(v, k);
                if (c !== undefined) out[k] = c;
            }
            return Object.keys(out).length ? out : undefined;
        }
        if (typeof value === 'string') {
            const t = value.trim();
            return t && t !== '…' && t !== '...' ? t : undefined;
        }
        if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
        if (typeof value === 'boolean') return value;
        return undefined;
    }

    function parseTurn(raw) {
        const r = typeof raw === 'string' ? parseJson(raw) : raw;
        const o = isObj(r) ? r : {};
        return {
            updates: cleanFacts(isObj(o.updates) ? o.updates : {}) || {},
            skip: Array.isArray(o.skip) ? o.skip.filter(id => CHECK_IDS.has(id)) : [],
            question: text(o.question),
            done: o.done === true
        };
    }

    /** Fusion : objets fusionnés, listes complétées sans doublon, scalaires remplacés. */
    function mergeFacts(base, updates) {
        const out = isObj(base) ? { ...base } : {};
        for (const [k, v] of Object.entries(updates || {})) {
            if (Array.isArray(v)) {
                const prev = Array.isArray(out[k]) ? out[k] : [];
                const seen = new Set(prev.map(x => JSON.stringify(x)));
                out[k] = [...prev, ...v.filter(x => !seen.has(JSON.stringify(x)))];
            } else if (isObj(v)) {
                out[k] = mergeFacts(out[k], v);
            } else if (v !== undefined) {
                out[k] = v;
            }
        }
        return out;
    }

    /**
     * Applique un tour : ce que l'étudiant a dit, ce que l'IA en a retenu, et
     * sa question suivante (ou celle de repli). Renvoie un NOUVEL état.
     */
    function applyTurn(state, studentText, parsed) {
        const p = parsed || { updates: {}, skip: [], question: '', done: false };
        const next = {
            facts: mergeFacts(state.facts, p.updates),
            transcript: [...(state.transcript || [])],
            skipped: [...new Set([...(state.skipped || []), ...p.skip])],
            images: [...(state.images || [])]
        };
        if (text(studentText)) next.transcript.push({ role: 'student', text: text(studentText) });
        const cov = coverage(next);
        // L'IA ne peut pas clore l'entretien tant qu'un élément indispensable manque.
        const question = (!p.question || (p.done && !cov.canBuild)) ? fallbackQuestion(next) : p.question;
        next.transcript.push({ role: 'interviewer', text: question });
        return next;
    }

    /** Ouvre l'entretien par la première question. */
    function start(state) {
        const s = state || createState();
        return { ...s, transcript: [...(s.transcript || []), { role: 'interviewer', text: fallbackQuestion(s) }] };
    }

    /** Examen en image (radio, ECG, photo) fourni par l'étudiant. */
    function addImage(state, name, dataUrl) {
        const label = text(name);
        if (!label || !/^data:image\//.test(String(dataUrl || ''))) return state;
        return { ...state, images: [...(state.images || []).filter(i => normalize(i.name) !== normalize(label)), { name: label, dataUrl }] };
    }

    // ==================== RÉDACTION DE LA FICHE ====================

    /** Consigne de rédaction : la fiche complète, à partir du récit. */
    function buildCasePrompt(state, caseFormat) {
        const cov = coverage(state);
        const invent = cov.items.filter(i => !i.done).map(i => i.label).join(', ') || 'rien';
        const story = (state.transcript || []).map(m => `${m.role === 'student' ? 'ÉTUDIANT' : 'QUESTION'} : ${m.text}`).join('\n');
        const sexe = state.facts && state.facts.patient && state.facts.patient.sexe;
        const [prenom, nom] = fictionalName(state.facts, sexe);
        const identity = sexe ? `Le patient s'appelle ${prenom} ${nom} (nom fictif imposé).` : 'Le patient reçoit un nom et un prénom FICTIFS.';
        return {
            system: `Tu es un professeur de médecine qui rédige des cas cliniques pour le jeu de simulation MedGame. Un étudiant t'a raconté un patient réel ; tu en fais un cas complet, jouable et pédagogique.

RÈGLES
1. Tout ce que l'étudiant a rapporté (FICHE RECUEILLIE) est repris fidèlement : mêmes chiffres, mêmes résultats, même diagnostic, même traitement. Tu ne le « corriges » pas.
2. Ce qu'il n'a pas précisé, tu le complètes de façon réaliste et strictement cohérente avec le diagnostic retenu.
3. ${identity} Aucun nom réel de personne, d'hôpital ou de médecin, ni date réelle, même si le récit en contient.
4. Le patient parle en langage profane ; ses informations cachées et sa personnalité rendent l'entretien intéressant.
5. "possibleDiagnostics" contient le bon diagnostic et 3 différentiels plausibles ; "possibleTreatments" contient les bons traitements, des alternatives et au moins un traitement dangereux.
6. "correction" reprend la leçon que l'étudiant veut transmettre.

FORMAT DE SORTIE — exactement cette structure JSON :
${caseFormat}`,
            user: `FICHE RECUEILLIE (à respecter) :
${JSON.stringify(state.facts || {}, null, 2)}

À COMPLÉTER toi-même, de façon cohérente : ${invent}.

RÉCIT DE L'ÉTUDIANT :
${story}`
        };
    }

    const uniq = (arr) => {
        const seen = new Set();
        return (Array.isArray(arr) ? arr : []).filter(x => {
            const k = normalize(x);
            if (!text(x) || seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    };

    /** Retrouve un intitulé dans une liste, à la casse et aux accents près. */
    function findLike(list, name) {
        const n = normalize(name);
        if (!n) return null;
        return (list || []).find(x => normalize(x) === n)
            || (list || []).find(x => normalize(x).includes(n) || n.includes(normalize(x)))
            || null;
    }

    const FICTIONAL = {
        M: [['Lucas', 'Fournier'], ['Hugo', 'Marchal'], ['Karim', 'Benhaddou'], ['Paul', 'Leclerc'], ['Antoine', 'Royer'], ['Youssef', 'Amrani']],
        F: [['Camille', 'Besnard'], ['Léa', 'Maillard'], ['Nadia', 'Cherif'], ['Hélène', 'Poirier'], ['Jeanne', 'Vidal'], ['Sofia', 'Morel']]
    };

    function hashString(s) {
        let h = 2166136261;
        const str = String(s || '');
        for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
        return h;
    }

    /** Nom fictif stable pour un récit donné : [prénom, nom]. */
    function fictionalName(facts, sexe) {
        const pool = FICTIONAL[/^f/i.test(String(sexe || '')) ? 'F' : 'M'];
        return pool[hashString(JSON.stringify(facts || {})) % pool.length];
    }

    /**
     * Met le cas rédigé par l'IA au format de la base, en faisant primer ce
     * que l'étudiant a dit et en garantissant la cohérence interne.
     * @param {object} generated cas rédigé par l'IA
     * @param {object} state état de l'entretien (faits, images)
     * @param {{redacteur?: string}} [opts]
     */
    function finalize(generated, state, opts = {}) {
        const c = isObj(generated) ? JSON.parse(JSON.stringify(generated)) : {};
        const f = (state && state.facts) || {};
        c.patient = isObj(c.patient) ? c.patient : {};
        c.interrogatoire = isObj(c.interrogatoire) ? c.interrogatoire : {};
        c.examenClinique = isObj(c.examenClinique) ? c.examenClinique : {};

        // 1. Ce que l'étudiant a dit prime.
        const fp = isObj(f.patient) ? f.patient : {};
        for (const k of ['age', 'taille', 'poids', 'profession']) if (has(fp[k])) c.patient[k] = fp[k];
        if (has(fp.sexe)) c.patient.sexe = /^f/i.test(String(fp.sexe)) ? 'F' : 'M';
        c.patient.sexe = /^f/i.test(String(c.patient.sexe || '')) ? 'F' : 'M';
        const age = parseInt(c.patient.age, 10);
        c.patient.age = Number.isFinite(age) ? Math.max(0, Math.min(120, age)) : 50;

        const fi = isObj(f.interrogatoire) ? f.interrogatoire : {};
        if (has(fi.motifHospitalisation)) c.interrogatoire.motifHospitalisation = fi.motifHospitalisation;
        for (const k of ['histoireMaladie', 'modeDeVie', 'allergies']) {
            if (isObj(fi[k])) c.interrogatoire[k] = mergeFacts(c.interrogatoire[k], fi[k]);
        }
        if (has(fi.traitements)) c.interrogatoire.traitements = fi.traitements;
        if (isObj(fi.antecedents)) {
            c.interrogatoire.antecedents = isObj(c.interrogatoire.antecedents) ? c.interrogatoire.antecedents : {};
            for (const k of ['medicaux', 'chirurgicaux', 'familiaux']) if (has(fi.antecedents[k])) c.interrogatoire.antecedents[k] = fi.antecedents[k];
        }
        const fe = isObj(f.examenClinique) ? f.examenClinique : {};
        if (isObj(fe.constantes)) c.examenClinique.constantes = { ...(isObj(c.examenClinique.constantes) ? c.examenClinique.constantes : {}), ...fe.constantes };
        if (has(fe.aspectGeneral)) c.examenClinique.aspectGeneral = fe.aspectGeneral;

        // 2. Identité toujours fictive : le nom est tiré ici, jamais repris du
        //    récit ni de l'IA (qui a pu recopier un nom dicté). Les mentions de
        //    l'ancien nom dans les textes du cas sont réécrites.
        const [prenom, nom] = fictionalName(f, c.patient.sexe);
        const oldNames = [[text(c.patient.nom), nom], [text(c.patient.prenom), prenom]];
        c.patient.nom = nom;
        c.patient.prenom = prenom;
        let json = JSON.stringify(c);
        for (const [old, fresh] of oldNames) {
            if (old.length < 3 || old === fresh) continue;
            const safe = old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            json = json.replace(new RegExp(`(^|[^\\p{L}])${safe}(?![\\p{L}])`, 'gu'), (m, pre) => `${pre}${fresh}`);
        }
        Object.assign(c, JSON.parse(json));

        // 3. Examens : résultats racontés par l'étudiant, puis cohérence des listes.
        c.examResults = isObj(c.examResults) ? c.examResults : {};
        c.availableExams = uniq(c.availableExams);
        const toldExams = [];
        for (const [name, result] of Object.entries(isObj(f.examResults) ? f.examResults : {})) {
            if (!has(result)) continue;
            const key = findLike(Object.keys(c.examResults), name) || findLike(c.availableExams, name) || name;
            c.examResults[key] = typeof result === 'string' ? result : JSON.stringify(result);
            toldExams.push(key);
        }
        // Images fournies : rattachées à l'examen du même nom, sinon ajoutées.
        for (const img of (state && state.images) || []) {
            const key = findLike(Object.keys(c.examResults), img.name) || img.name;
            const prev = c.examResults[key];
            const value = isObj(prev) ? (prev.value || prev.text || '') : (text(prev) || 'Voir l\'image.');
            c.examResults[key] = { value, image: img.dataUrl };
            toldExams.push(key);
        }
        c.availableExams = uniq([...c.availableExams, ...Object.keys(c.examResults)]);
        for (const name of c.availableExams) if (!has(c.examResults[name])) c.examResults[name] = 'Résultat normal.';
        // Un examen réellement fait pour ce patient est pertinent par défaut.
        c.relevantExams = uniq([...(c.relevantExams || []), ...toldExams]).map(x => findLike(c.availableExams, x)).filter(Boolean);
        if (isObj(c.examGradation)) {
            for (const k of ['parfaits', 'utiles', 'inutiles', 'dangereux']) {
                c.examGradation[k] = uniq(c.examGradation[k]).map(x => findLike(c.availableExams, x)).filter(Boolean);
            }
        }

        // 4. Diagnostic et traitements : la réponse est toujours parmi les propositions.
        if (has(f.correctDiagnostic)) c.correctDiagnostic = text(f.correctDiagnostic);
        c.correctDiagnostic = text(c.correctDiagnostic);
        c.alternativeDiagnostics = uniq([...(f.alternativeDiagnostics || []), ...(c.alternativeDiagnostics || [])]).filter(d => normalize(d) !== normalize(c.correctDiagnostic));
        c.possibleDiagnostics = uniq([c.correctDiagnostic, ...(c.possibleDiagnostics || []), ...c.alternativeDiagnostics]);

        c.fatalTreatments = uniq([...(f.fatalTreatments || []), ...(c.fatalTreatments || [])]);
        c.correctTreatments = uniq(has(f.correctTreatments) ? f.correctTreatments : c.correctTreatments)
            .filter(t => !c.fatalTreatments.some(x => normalize(x) === normalize(t)));
        c.possibleTreatments = uniq([...c.correctTreatments, ...(c.possibleTreatments || []), ...(c.secondLineTreatments || []), ...c.fatalTreatments]);

        // 5. Métadonnées de la base.
        if (has(f.lecon)) c.pieges = uniq([...(c.pieges || []), f.lecon]);
        c.motif = text(c.motif) || text(c.interrogatoire.motifHospitalisation);
        const diff = parseInt(c.difficulty, 10);
        c.difficulty = Number.isFinite(diff) ? Math.max(1, Math.min(3, diff)) : 2;
        c.redacteur = text(opts.redacteur) || 'Étudiant MedGame';
        const spec = slugify(f.specialite || c.specialite || 'cas', 12) || 'cas';
        c.id = [spec, slugify(c.motif, 36) || 'motif', slugify(`${c.patient.sexe === 'F' ? 'mme' : 'm'} ${c.patient.nom}`, 20)].join('_');
        c.source = 'entretien';
        return c;
    }

    /** Contrôle final : ce qui empêcherait de jouer le cas. */
    function problems(c) {
        const out = [];
        if (!text(c && c.correctDiagnostic)) out.push('Diagnostic retenu manquant.');
        if (!text(c && c.interrogatoire && c.interrogatoire.motifHospitalisation)) out.push('Motif de venue manquant.');
        if (c && !(c.possibleDiagnostics || []).includes(c.correctDiagnostic)) out.push('Le diagnostic retenu n\'est pas dans les propositions.');
        if (c && (c.possibleDiagnostics || []).length < 2) out.push('Il faut au moins un diagnostic différentiel.');
        for (const t of (c && c.correctTreatments) || []) if (!(c.possibleTreatments || []).includes(t)) out.push(`Traitement « ${t} » absent des propositions.`);
        for (const e of (c && c.relevantExams) || []) if (!(c.availableExams || []).includes(e)) out.push(`Examen « ${e} » absent des examens disponibles.`);
        return out;
    }

    root.CaseInterview = {
        CHECKLIST, FACTS_FORMAT,
        createState, start, coverage, fallbackQuestion,
        buildTurnPrompt, buildTurnMessages, parseTurn, mergeFacts, applyTurn, addImage,
        buildCasePrompt, fictionalName, finalize, problems, slugify, normalize
    };
})(typeof globalThis !== 'undefined' ? globalThis : this);
