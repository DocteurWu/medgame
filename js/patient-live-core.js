/**
 * js/patient-live-core.js — Logique pure de la consultation « en direct ».
 *
 * Ce fichier ne touche ni au DOM, ni à l'audio, ni au réseau : il est chargé
 * comme script CLASSIQUE par game.html et importé pour effets de bord par les
 * tests Node (même schéma que js/case-aliases.js). Tout est publié sur
 * `globalThis.PatientLiveCore`.
 *
 * Il porte quatre choses :
 *   1. L'ALLIANCE thérapeutique : confiance / anxiété, paliers, ultimatum
 *      (le patient veut partir, une réplique pour le retenir), départ.
 *   2. L'ANALYSE LOCALE d'une réplique de l'étudiant : jargon (avec la
 *      traduction profane à proposer), empathie, reformulation, rafale de
 *      questions. Elle donne un retour immédiat et sert de repli quand le LLM
 *      ne motive pas sa variation de confiance.
 *   3. Le DÉCODAGE EN FLUX d'un champ texte JSON (`"dialogue": "..."`) et le
 *      découpage en phrases : la voix commence à parler avant la fin de la
 *      réponse du modèle.
 *   4. La PROSODIE et les répliques locales (relances de silence, ultimatum,
 *      départ), sans aucun appel LLM.
 */
(function (root) {
    'use strict';

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

    // ==================== PALIERS ====================

    const STAGES = [
        { id: 'confiant', min: 70, label: 'Confiant', hint: 'Il se confie, même sur l\'intime.' },
        { id: 'reserve', min: 40, label: 'Réservé', hint: 'Il répond, sans plus.' },
        { id: 'ferme', min: 20, label: 'Fermé', hint: 'Réponses brèves, il cache des choses.' },
        { id: 'rupture', min: 0, label: 'Rupture', hint: 'Il veut partir.' }
    ];
    /** Seuil sous lequel le patient pose un ultimatum. */
    const RUPTURE_AT = 15;
    /** Confiance rendue quand l'étudiant rattrape la situation. */
    const RECOVER_TO = 28;
    /** Seuil de divulgation des informations cachées (aligné sur l'engine). */
    const DISCLOSE_AT = 65;
    const MAX_STEP = 20;

    function stageOf(trust) {
        const t = clamp(Number(trust) || 0, 0, 100);
        return STAGES.find(s => t >= s.min) || STAGES[STAGES.length - 1];
    }

    // ==================== ANALYSE LOCALE ====================

    // Jargon que le patient ne comprend pas, avec la formulation profane à
    // proposer dans le retour. Formes sans accents : la comparaison se fait
    // sur un texte normalisé.
    const JARGON = [
        ['orthopnee', 'essoufflé quand vous êtes allongé'],
        ['dyspnee', 'essoufflé'],
        ['melena', 'selles noires'],
        ['hematemese', 'vomi du sang'],
        ['hemoptysie', 'craché du sang'],
        ['rectorragie', 'du sang rouge dans les selles'],
        ['prodrome', 'des signes avant-coureurs'],
        ['syncope', 'perdu connaissance'],
        ['lipothymie', 'senti partir'],
        ['palpitation', 'le cœur qui s\'emballe'],
        ['dysurie', 'mal en urinant'],
        ['pollakiurie', 'uriner souvent'],
        ['hematurie', 'du sang dans les urines'],
        ['asthenie', 'fatigue'],
        ['anorexie', 'perte d\'appétit'],
        ['aeg', 'fatigue, perte de poids et d\'appétit'],
        ['atcd', 'antécédents'],
        ['antecedents medico', 'maladies passées'],
        ['cephalee', 'mal de tête'],
        ['vertige rotatoire', 'la pièce qui tourne'],
        ['paresthesie', 'fourmillements'],
        ['diplopie', 'voir double'],
        ['photophobie', 'gêné par la lumière'],
        ['epigastr', 'le creux de l\'estomac'],
        ['retrosternal', 'derrière le sternum, au milieu de la poitrine'],
        ['irradi', 'la douleur part ailleurs'],
        ['constrictive', 'qui serre'],
        ['hypochondre', 'sous les côtes'],
        ['fosse iliaque', 'le bas du ventre'],
        ['transit', 'aller à la selle'],
        ['oedeme', 'gonflement'],
        ['claudication', 'mal aux jambes en marchant'],
        ['tabagisme', 'fumer'],
        ['paquet-annee', 'combien de cigarettes et depuis quand'],
        ['paquets-annee', 'combien de cigarettes et depuis quand'],
        ['observance', 'prendre vos médicaments'],
        ['posologie', 'la dose'],
        ['hta', 'tension'],
        ['diabete de type', 'diabète'],
        ['avc', 'attaque cérébrale'],
        ['idm', 'infarctus, crise cardiaque'],
        ['sca', 'problème au cœur'],
        ['bpco', 'maladie des bronches'],
        ['ecbu', 'analyse d\'urine'],
        ['nfs', 'prise de sang'],
        ['iono', 'prise de sang']
    ];

    const GREETING = /\b(bonjour|bonsoir|enchante|je suis (le|la|l')? ?(docteur|dr|interne|externe|etudiant|medecin))/;
    const EMPATHY = /(je comprends|ca doit (etre|vous)|c'est (normal|comprehensible) (de|que)|je vois que vous|vous avez l'air|je suis (la|desole)|ne vous inquietez pas|on va (s'occuper|trouver|vous aider|regarder ensemble)|prenez votre temps|ca a l'air (dur|difficile|douloureux)|vous avez bien fait)/;
    const REFORMULATION = /(si je (comprends|resume) bien|si j'ai bien compris|vous me dites (que|donc)|autrement dit|donc, ?(depuis|vous))/;
    const OPEN_QUESTION = /^(comment|qu'est-ce|que (se passe|ressentez)|racontez|parlez-moi|expliquez|decrivez|pouvez-vous (me )?(decrire|raconter|expliquer)|dites-moi)/;
    const BRUSQUE = /(\bvite\b|depechez|abregez|\bbon\b,? (alors|bref)|repondez|j'ai pas le temps|on n'a pas le temps|arretez de|c'est pas grave|ce n'est rien du tout|calmez-vous)/;
    const PERMISSION = /(je vais (vous )?(examiner|ausculter|palper|regarder|prendre)|est-ce que je peux|vous permettez|je peux (vous )?(examiner|ausculter|regarder))/;

    function normalize(text) {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[’`]/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Analyse une réplique de l'étudiant. Résultat déterministe, sans LLM.
     * @returns {{ jargon: {term:string, lay:string}[], greeting:boolean, empathy:boolean,
     *   reformulation:boolean, openQuestion:boolean, questionCount:number,
     *   brusque:boolean, permission:boolean, hint:number, reasons:string[] }}
     */
    function analyzeUtterance(text) {
        const n = normalize(text);
        const jargon = [];
        for (const [term, lay] of JARGON) {
            const re = new RegExp(`(^|[^a-z])${term.replace(/[-]/g, '\\-')}`);
            if (re.test(n) && !jargon.some(j => j.lay === lay)) jargon.push({ term, lay });
        }
        const questionCount = (String(text || '').match(/\?/g) || []).length;
        const out = {
            jargon,
            greeting: GREETING.test(n),
            empathy: EMPATHY.test(n),
            reformulation: REFORMULATION.test(n),
            openQuestion: OPEN_QUESTION.test(n),
            questionCount,
            brusque: BRUSQUE.test(n),
            permission: PERMISSION.test(n),
            hint: 0,
            reasons: []
        };
        // Barème indicatif, utilisé seulement quand le LLM ne donne rien.
        if (out.greeting) { out.hint += 4; out.reasons.push('Présentation'); }
        if (out.empathy) { out.hint += 7; out.reasons.push('Empathie'); }
        if (out.reformulation) { out.hint += 6; out.reasons.push('Reformulation'); }
        if (out.permission) { out.hint += 3; out.reasons.push('Geste annoncé'); }
        if (out.openQuestion) { out.hint += 2; out.reasons.push('Question ouverte'); }
        if (jargon.length) { out.hint -= 5 * Math.min(jargon.length, 2); out.reasons.push(`Jargon : « ${jargon[0].term} »`); }
        if (questionCount >= 3) { out.hint -= 4; out.reasons.push('Rafale de questions'); }
        if (out.brusque) { out.hint -= 8; out.reasons.push('Ton brusque'); }
        out.hint = clamp(out.hint, -15, 12);
        return out;
    }

    // ==================== ALLIANCE ====================

    /**
     * Crée l'état d'alliance d'une consultation.
     * @param {{trust?:number, anxiety?:number, now?:()=>number}} [opts]
     */
    function createAlliance(opts = {}) {
        const now = typeof opts.now === 'function' ? opts.now : () => Date.now();
        const t0 = now();
        const state = {
            trust: clamp(num(opts.trust) ?? 55, 0, 100),
            anxiety: clamp(num(opts.anxiety) ?? 45, 0, 100),
            ultimatum: false,
            walkedOut: false,
            recovered: 0,
            interruptions: 0,
            silences: 0,
            jargonCount: 0,
            empathyCount: 0,
            turns: 0,
            timeline: []
        };
        const mark = (label, delta) => {
            state.timeline.push({
                t: Math.round((now() - t0) / 1000),
                trust: state.trust,
                anxiety: state.anxiety,
                delta,
                label
            });
        };
        mark('Début de consultation', 0);

        /**
         * Applique un tour. Accepte soit des deltas (`trustDelta`), soit des
         * valeurs absolues (`trust`) — utiles aux outils (agents, tests) qui
         * imposent un état ; le Maître du Jeu donne des deltas.
         * @param {object} turn
         * @param {'reply'|'silence'|'interrupt'} [turn.kind='reply']
         * @param {string} [turn.text] — réplique de l'étudiant (analyse locale)
         * @param {string} [turn.reason] — motif court donné par le LLM
         * @param {string} [turn.communication] — empathique|neutre|brusque|jargonneux
         */
        function applyTurn(turn = {}) {
            if (state.walkedOut) {
                return { delta: 0, anxietyDelta: 0, label: 'Le patient est parti', tone: 'neg', stage: stageOf(state.trust), stageChanged: false, walkedOut: true, ignored: true };
            }
            const kind = turn.kind || 'reply';
            const analysis = turn.text ? analyzeUtterance(turn.text) : null;
            const prevStage = stageOf(state.trust);
            const prevTrust = state.trust;
            const prevAnx = state.anxiety;

            let delta = num(turn.trustDelta);
            if (delta === null && num(turn.trust) !== null) delta = num(turn.trust) - state.trust;
            if (delta === null && analysis) delta = analysis.hint;
            if (delta === null) delta = 0;
            let anxDelta = num(turn.anxietyDelta);
            if (anxDelta === null && num(turn.anxiety) !== null) anxDelta = num(turn.anxiety) - state.anxiety;
            if (anxDelta === null) anxDelta = -Math.round(delta / 2);

            // Le jargon détecté localement pèse même si le LLM l'a laissé passer.
            if (analysis && analysis.jargon.length && kind === 'reply' && delta > -3) delta -= 3;
            delta = clamp(Math.round(delta), -MAX_STEP, MAX_STEP);
            anxDelta = clamp(Math.round(anxDelta), -MAX_STEP, MAX_STEP);

            state.trust = clamp(state.trust + delta, 0, 100);
            state.anxiety = clamp(state.anxiety + anxDelta, 0, 100);
            if (kind === 'reply') state.turns++;
            if (kind === 'interrupt') state.interruptions++;
            if (kind === 'silence') state.silences++;
            if (analysis && analysis.jargon.length) state.jargonCount++;
            const empathic = turn.communication === 'empathique' || (analysis && (analysis.empathy || analysis.reformulation));
            if (empathic && kind === 'reply') state.empathyCount++;

            const label = feedbackLabel({ kind, delta, reason: turn.reason, communication: turn.communication, analysis });

            // Ultimatum : une seule réplique pour retenir le patient.
            const result = { ultimatumStarted: false, recovered: false, walkedOut: false };
            if (state.ultimatum && kind === 'reply') {
                if (delta > 0 && empathic) {
                    state.ultimatum = false;
                    state.recovered++;
                    state.trust = Math.max(state.trust, RECOVER_TO);
                    result.recovered = true;
                } else {
                    state.walkedOut = true;
                    result.walkedOut = true;
                }
            } else if (!state.ultimatum && state.trust < RUPTURE_AT) {
                // Une seule seconde chance par consultation.
                if (state.recovered >= 1) {
                    state.walkedOut = true;
                    result.walkedOut = true;
                } else {
                    state.ultimatum = true;
                    result.ultimatumStarted = true;
                }
            }

            const stage = stageOf(state.trust);
            const realDelta = state.trust - prevTrust;
            mark(result.walkedOut ? 'Départ du patient' : result.recovered ? 'Rattrapage' : label, realDelta);
            return {
                delta: realDelta,
                anxietyDelta: state.anxiety - prevAnx,
                label,
                tone: realDelta > 0 ? 'pos' : realDelta < 0 ? 'neg' : 'neutral',
                stage,
                prevStage,
                stageChanged: stage.id !== prevStage.id,
                jargon: analysis ? analysis.jargon : [],
                ...result
            };
        }

        /** Fin de l'ultimatum sans réplique (temps écoulé). */
        function expireUltimatum() {
            if (!state.ultimatum || state.walkedOut) return false;
            state.ultimatum = false;
            state.walkedOut = true;
            mark('Départ du patient (silence)', 0);
            return true;
        }

        function snapshot() {
            const stage = stageOf(state.trust);
            return {
                trust: state.trust,
                anxiety: state.anxiety,
                stage,
                ultimatum: state.ultimatum,
                walkedOut: state.walkedOut,
                canDisclose: state.trust >= DISCLOSE_AT
            };
        }

        /** Bilan pour le débriefing : moments clés et compteurs. */
        function summary() {
            const moves = state.timeline.filter(p => p.delta);
            const best = moves.reduce((a, p) => (!a || p.delta > a.delta ? p : a), null);
            const worst = moves.reduce((a, p) => (!a || p.delta < a.delta ? p : a), null);
            const values = state.timeline.map(p => p.trust);
            return {
                final: state.trust,
                peak: values.length ? Math.max(...values) : state.trust,
                low: values.length ? Math.min(...values) : state.trust,
                best: best && best.delta > 0 ? best : null,
                worst: worst && worst.delta < 0 ? worst : null,
                turns: state.turns,
                jargonCount: state.jargonCount,
                empathyCount: state.empathyCount,
                interruptions: state.interruptions,
                silences: state.silences,
                recovered: state.recovered,
                walkedOut: state.walkedOut,
                timeline: state.timeline.slice()
            };
        }

        return { state, applyTurn, expireUltimatum, snapshot, summary };
    }

    const COMMUNICATION_LABELS = {
        empathique: 'Écoute empathique',
        brusque: 'Ton brusque',
        jargonneux: 'Jargon médical'
    };

    /** Le libellé court affiché à côté du +/- de la jauge. */
    function feedbackLabel({ kind, delta, reason, communication, analysis }) {
        if (kind === 'interrupt') return 'Vous lui coupez la parole';
        if (kind === 'silence') return 'Silence prolongé';
        if (analysis && analysis.jargon.length && delta <= 0) {
            const j = analysis.jargon[0];
            return `Jargon « ${j.term} » → dites « ${j.lay} »`;
        }
        const r = typeof reason === 'string' ? reason.trim().replace(/\s+/g, ' ') : '';
        if (r && r.length <= 48) return r.charAt(0).toUpperCase() + r.slice(1);
        if (communication && COMMUNICATION_LABELS[communication]) return COMMUNICATION_LABELS[communication];
        if (analysis && analysis.reasons.length) {
            // Le motif dont le signe correspond à la variation.
            const pos = ['Présentation', 'Empathie', 'Reformulation', 'Geste annoncé', 'Question ouverte'];
            const pick = analysis.reasons.find(x => (delta >= 0) === pos.includes(x));
            if (pick) return pick;
        }
        if (delta > 0) return 'Il se sent écouté';
        if (delta < 0) return 'Il se sent bousculé';
        return 'Échange neutre';
    }

    // ==================== FLUX ====================

    /**
     * Décode le champ texte `key` d'un JSON reçu en morceaux, même incomplet.
     * Gère les échappements (\" \n \uXXXX). `done` passe à vrai au guillemet
     * fermant. Un champ `null` renvoie `{ text: '', done: true, isNull: true }`.
     * @param {string} buffer
     * @param {string} key
     */
    function extractStreamingField(buffer, key) {
        const src = String(buffer || '');
        const re = new RegExp(`"${key}"\\s*:\\s*`);
        const m = re.exec(src);
        if (!m) return { text: '', done: false, found: false };
        let i = m.index + m[0].length;
        if (src.startsWith('null', i)) return { text: '', done: true, found: true, isNull: true };
        if (src[i] !== '"') return { text: '', done: false, found: true };
        i++;
        let out = '';
        while (i < src.length) {
            const c = src[i];
            if (c === '\\') {
                if (i + 1 >= src.length) break; // échappement coupé : attendre la suite
                const e = src[i + 1];
                if (e === 'u') {
                    if (i + 6 > src.length) break;
                    const code = parseInt(src.slice(i + 2, i + 6), 16);
                    if (Number.isFinite(code)) out += String.fromCharCode(code);
                    i += 6;
                    continue;
                }
                out += e === 'n' ? '\n' : e === 't' ? '\t' : e === 'r' ? '' : e;
                i += 2;
                continue;
            }
            if (c === '"') return { text: out, done: true, found: true };
            out += c;
            i++;
        }
        return { text: out, done: false, found: true };
    }

    /**
     * Extrait les phrases complètes de `text` à partir de `from`.
     * Une phrase finit sur . ! ? … suivi d'une espace (ou en fin si `final`).
     * Les fragments trop courts sont regroupés avec la phrase suivante pour
     * éviter une voix hachée.
     * @returns {{ sentences: string[], next: number }}
     */
    function takeSentences(text, from = 0, final = false) {
        const s = String(text || '');
        const sentences = [];
        let start = from;
        const re = /[.!?…]+["»”)]*\s+/g;
        re.lastIndex = from;
        let m;
        while ((m = re.exec(s))) {
            const end = m.index + m[0].length;
            const chunk = s.slice(start, end).trim();
            if (chunk.length >= 18 || /[!?]/.test(chunk)) {
                sentences.push(chunk);
                start = end;
            }
        }
        if (final) {
            const rest = s.slice(start).trim();
            if (rest) sentences.push(rest);
            start = s.length;
        }
        return { sentences, next: start };
    }

    /** Retire les didascalies (*...*, (...)) et le balisage d'un texte à dire. */
    function speakableText(text) {
        return String(text || '')
            .replace(/\*[^*]*\*/g, ' ')
            .replace(/\([^)]*\)/g, ' ')
            .replace(/\[[^\]]*\]/g, ' ')
            .replace(/[«»"“”]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // ==================== ÉMOTIONS & PROSODIE ====================

    const EMOTIONS = ['neutre', 'douleur', 'peur', 'soulagement', 'colere', 'tristesse', 'gene', 'confusion'];
    const EXPRESSION_OF = {
        neutre: 'normal', douleur: 'douleur', peur: 'anxieux', soulagement: 'sourire',
        colere: 'grimace', tristesse: 'pale', gene: 'pale', confusion: 'etonne'
    };

    function normalizeEmotion(e) {
        const n = normalize(e).replace(/[^a-z]/g, '');
        if (EMOTIONS.includes(n)) return n;
        if (/peur|anxi|inqui|angoiss/.test(n)) return 'peur';
        if (/colere|irrit|agac|enerv|hostil/.test(n)) return 'colere';
        if (/soulag|rassur|content|joie/.test(n)) return 'soulagement';
        if (/triste|abattu|desespo/.test(n)) return 'tristesse';
        if (/gene|honte|embarr/.test(n)) return 'gene';
        if (/confus|perdu|surpris|etonn/.test(n)) return 'confusion';
        if (/doul|mal|souffr/.test(n)) return 'douleur';
        return 'neutre';
    }

    function expressionFor(emotion) {
        return EXPRESSION_OF[normalizeEmotion(emotion)] || 'normal';
    }

    /**
     * Paramètres de voix : débit, hauteur, consigne de jeu pour une voix
     * neuronale pilotable (« instructions »).
     * @param {{anxiety?:number, trust?:number, pain?:number, age?:number, sex?:string, emotion?:string}} p
     */
    function prosody(p = {}) {
        const anx = clamp(num(p.anxiety) ?? 45, 0, 100);
        const trust = clamp(num(p.trust) ?? 55, 0, 100);
        const pain = clamp(num(p.pain) ?? 0, 0, 10);
        const age = clamp(num(p.age) ?? 45, 0, 110);
        const female = /^f/i.test(String(p.sex || ''));
        const emotion = normalizeEmotion(p.emotion);

        let rate = 1 + (anx - 45) / 300 - Math.max(0, age - 60) / 220 - pain / 60;
        if (emotion === 'colere') rate += 0.06;
        if (emotion === 'tristesse') rate -= 0.08;
        let pitch = (female ? 1.1 : 0.92) + (anx - 45) / 400 - Math.max(0, age - 65) / 300;
        if (age < 12) pitch += 0.35;

        const traits = [];
        if (age < 12) traits.push('un enfant');
        else if (age >= 75) traits.push('une personne âgée, voix un peu cassée');
        if (anx >= 75) traits.push('très anxieux, voix tremblante, débit pressé');
        else if (anx >= 55) traits.push('inquiet');
        if (pain >= 6) traits.push('souffre, parle entre deux grimaces, souffle court');
        if (trust < 30) traits.push('méfiant, réponses sèches');
        else if (trust >= 75) traits.push('détendu, chaleureux avec le médecin');
        const mood = {
            douleur: 'douloureux', peur: 'apeuré', soulagement: 'soulagé', colere: 'agacé',
            tristesse: 'abattu', gene: 'gêné, hésitant', confusion: 'perplexe', neutre: 'naturel'
        }[emotion];
        const instructions = `Tu joues un patient français à l'hôpital, ton ${mood}. ${traits.length ? traits.join(', ') + '.' : ''} Parle comme une vraie personne, pas comme un présentateur : hésitations naturelles, pas d'emphase théâtrale.`;

        return {
            rate: clamp(Number(rate.toFixed(2)), 0.7, 1.35),
            pitch: clamp(Number(pitch.toFixed(2)), 0.6, 1.6),
            female,
            child: age < 12,
            elderly: age >= 70,
            emotion,
            instructions
        };
    }

    // ==================== RÉPLIQUES LOCALES ====================

    const RELANCES = {
        anxieux: [
            'Docteur ? C\'est grave, c\'est ça ?',
            'Pourquoi vous ne dites rien ? Vous me faites peur…',
            'Excusez-moi… vous êtes toujours là ?'
        ],
        mefiant: [
            'Bon… on fait quoi, là ?',
            'Vous allez me poser d\'autres questions ou pas ?',
            'J\'attends depuis tout à l\'heure, moi.'
        ],
        calme: [
            'Hum… vous voulez savoir autre chose ?',
            'Je ne sais pas trop quoi vous dire d\'autre, docteur.',
            'Vous réfléchissez ?'
        ]
    };

    function relanceLine({ anxiety = 45, trust = 55, count = 0 } = {}) {
        const bank = anxiety >= 65 ? RELANCES.anxieux : trust < 40 ? RELANCES.mefiant : RELANCES.calme;
        return bank[Math.abs(count) % bank.length];
    }

    const ULTIMATUM_LINES = [
        'Écoutez, je crois que je vais rentrer chez moi. Vous ne m\'écoutez pas.',
        'Je préfère voir un autre médecin. Je m\'en vais.',
        'Ça suffit. Je signe ce qu\'il faut et je pars.'
    ];
    const RECOVER_LINES = [
        'Bon… d\'accord. Je reste. Mais expliquez-moi les choses, s\'il vous plaît.',
        'Merci de dire ça. Allez-y, je vous écoute.',
        '… D\'accord. Je vous laisse une chance.'
    ];
    const WALKOUT_LINES = [
        'Non. Je m\'en vais. Je signe la décharge.',
        'C\'est bon, j\'ai compris. Au revoir, docteur.'
    ];
    const pick = (arr, seed) => arr[Math.abs(seed | 0) % arr.length];
    const ultimatumLine = (seed = 0) => pick(ULTIMATUM_LINES, seed);
    const recoverLine = (seed = 0) => pick(RECOVER_LINES, seed);
    const walkoutLine = (seed = 0) => pick(WALKOUT_LINES, seed);

    // ==================== PROMPT ====================

    /**
     * Bloc injecté dans le prompt du Maître du Jeu : l'état de l'alliance
     * pilote le jeu du patient, et le modèle doit renvoyer sa propre lecture
     * de la réplique (champ `alliance`).
     */
    function promptBlock(snap) {
        const s = snap || { trust: 55, anxiety: 45, stage: stageOf(55), ultimatum: false };
        const stage = s.stage || stageOf(s.trust);
        const behaviour = {
            confiant: 'Il se confie volontiers, y compris sur les sujets intimes ou tabous.',
            reserve: 'Il répond correctement mais sans rien ajouter, et garde pour lui ce qui est intime.',
            ferme: 'Il répond par phrases courtes, sur la défensive, et CACHE les informations intimes ou cachées.',
            rupture: 'Il est sur le point de partir : sec, blessé, il ne livre plus rien.'
        }[stage.id];
        return `
ALLIANCE THÉRAPEUTIQUE (jeu en direct — pilote le comportement du patient) :
- Confiance : ${s.trust}/100 (palier « ${stage.label} ») | Anxiété : ${s.anxiety}/100
- Comportement attendu : ${behaviour}
- Les informations cachées ne sont livrées que si la confiance atteint ${DISCLOSE_AT} ou si l'étudiant insiste avec tact.${s.ultimatum ? '\n- ULTIMATUM EN COURS : le patient vient d\'annoncer qu\'il part. Seule une excuse sincère, une reformulation de ses craintes ou de l\'empathie réelle le retient.' : ''}
- Le patient parle comme à l'oral : 1 à 3 phrases, sans didascalies dans "dialogue" (elles vont dans narrativeResponse).
- Note la réplique de l'étudiant dans "alliance" : trustDelta de -15 à +15 (bonjour/présentation, écoute, reformulation, empathie, explications claires = positif ; jargon incompris, ton brusque, rafale de questions, ignorer une inquiétude = négatif), anxietyDelta de -15 à +15, et "reason" = motif en 2 à 5 mots (ex : "Reformulation rassurante", "Jargon non expliqué").`;
    }

    root.PatientLiveCore = {
        STAGES,
        RUPTURE_AT,
        RECOVER_TO,
        DISCLOSE_AT,
        EMOTIONS,
        stageOf,
        normalize,
        analyzeUtterance,
        createAlliance,
        feedbackLabel,
        extractStreamingField,
        takeSentences,
        speakableText,
        normalizeEmotion,
        expressionFor,
        prosody,
        relanceLine,
        ultimatumLine,
        recoverLine,
        walkoutLine,
        promptBlock
    };
})(typeof globalThis !== 'undefined' ? globalThis : this);
