/**
 * llm-patient.js — Service LLM centralisé pour la simulation patient
 *
 * Responsabilités :
 *   - Construire le system prompt riche depuis les données du cas JSON
 *   - Appeler l'API LLM via le proxy (pas d'exposition de clé API côté client)
 *   - Gérer le streaming SSE token-par-token pour l'effet de frappe
 *   - Maintenir l'historique de conversation (context window)
 *   - Fournir un fallback local robuste si l'API est indisponible
 *
 * Exposé en `window.LLMPatient` pour permettre aux modules non-ESM
 * (ecosMode.js, patientChat.js) de l'utiliser sans import.
 */

export class LLMPatient {
    /**
     * @param {Object} caseData - Données complètes du cas clinique JSON
     */
    constructor(caseData) {
        this.caseData = caseData;
        /** @type {Array<{role: 'user'|'assistant', content: string}>} */
        this.history = [];
        this._abortController = null;

        // Config depuis window.CONFIG (injectée par config.js)
        this.endpoint = window.CONFIG?.LLM_API_URL || '/api/llm/chat/completions';
        this.model    = window.CONFIG?.LLM_MODEL    || 'deepseek-v4-flash';
        this.apiKey   = window.CONFIG?.LLM_API_KEY  || '';
    }

    // ==================== CONSTRUCTION DU PROMPT ====================

    /**
     * Synchronise l'historique de conversation depuis la session globale si disponible.
     * En mode ECOS (window.ECOS_MODE === true), on n'utilise pas la sync legacy
     * car on a notre propre historique propre.
     */
    syncHistoryFromGlobal() {
        if (window.ECOS_BYPASS_HISTORY_SYNC) return;
        if (window.patientChat?.messages && this.history.length === 0) {
            this.history = window.patientChat.messages.map(msg => {
                let role = 'user';
                if (msg.role === 'assistant' || msg.role === 'patient' || msg.role === 'Patient') {
                    role = 'assistant';
                }
                // Nettoyer les préfixes éventuels dans l'historique transmis au LLM
                const content = msg.content.replace(/^(Patient|Vous|Directeur Clinique|Radiologue|Infirmier|Infirmière|Biologiste|Médecin Réanimateur|Cardiologue|Intervention)\s*:\s*/i, '').trim();
                return {
                    role: role,
                    content: content
                };
            });
        }
    }

    /**
     * Construit le system prompt en injectant toutes les données du cas.
     * Le patient doit : répondre naturellement, ne PAS faire de diagnostic,
     * ne révéler que ce qu'on lui demande, et exprimer ses émotions de manière brute.
     */
    buildSystemPrompt() {
        const c   = this.caseData     || {};
        const pat = c.patient         || {};
        const int = c.interrogatoire  || {};
        const hm  = int.histoireMaladie || {};
        const atcd = int.antecedents  || {};
        const mdv = int.modeDeVie     || {};
        const exam = c.examenClinique || {};
        const cst  = exam.constantes  || {};

        // ── Sévérité clinique issue du scope dynamique en temps réel ──
        const liveVitals = window.vitalSigns?.props || {};
        const fc   = liveVitals.heartRate !== undefined ? liveVitals.heartRate : this._parseNum(cst.pouls);
        const pas  = liveVitals.systolic !== undefined ? liveVitals.systolic : this._parseNum(cst.tension);
        const pad  = liveVitals.diastolic !== undefined ? liveVitals.diastolic : 80;
        const spo2 = liveVitals.spo2 !== undefined ? liveVitals.spo2 : this._parseNum(cst.saturationO2);
        const fr   = liveVitals.respiratoryRate !== undefined ? liveVitals.respiratoryRate : 16;
        const temp = liveVitals.temperature !== undefined ? liveVitals.temperature : this._parseNum(cst.temperature);

        let etatPhysique = '';
        const alertes = [];
        if (spo2 !== null && spo2 < 88)  alertes.push('détresse respiratoire grave, parole très difficile, phrases ultra-courtes (2-3 mots max), essoufflement audible');
        else if (spo2 !== null && spo2 < 94) alertes.push('gêne respiratoire, tu parles en phrases très courtes, tu souffles bruyamment entre les mots');
        if (fc  !== null && fc  > 130)   alertes.push('cœur qui cogne fort dans la poitrine, tu es paniqué(e) et agité(e)');
        else if (fc !== null && fc > 100) alertes.push('cœur rapide, tu te sens très anxieux/anxieuse et tendu(e)');
        else if (fc !== null && fc < 55)  alertes.push('cœur très lent, tu te sens extrêmement faible, léthargique ou étourdi(e)');
        if (pas !== null && pas < 90)    alertes.push('hypotension majeure, tu te sens extrêmement faible et étourdi(e), parole très lente, trainante et fatiguée');
        if (temp !== null && temp >= 39)  alertes.push('forte fièvre, tu as des frissons intenses, du mal à te concentrer, tu mélanges ou bafouilles parfois les mots');

        etatPhysique = alertes.length > 0
            ? `ÉTAT PHYSIQUE ACTUEL : ${alertes.join(' ; ')}.`
            : 'Tu te sens soulagé(e) ou stable physiologiquement.';

        // Traitements appliqués en temps réel
        const appliedTreatments = window.scoringState?.selectedTreatments || [];
        const appliedTreatmentsText = appliedTreatments.length > 0
            ? `TRAITEMENTS DÉJÀ ADMINISTRÉS PAR LE MÉDECIN DANS CETTE SESSION : ${appliedTreatments.join(', ')}.`
            : 'Aucun traitement n\'a encore été administré pour le moment.';

        // ── Personnalité : patientStandardise (ECOS) ou fallback aléatoire ──
        const ecosData = c.ecos?.patientStandardise;
        const isEcosMode = !!(ecosData && window.EcosMode?.isActive?.());

        let personnaliteType = '';
        let directriceComportementale = '';

        if (isEcosMode && ecosData.personnalite) {
            personnaliteType = `ECOS — ${ecosData.personnalite}`;
            directriceComportementale = `Tu incarnes fidèlement cette personnalité : ${ecosData.personnalite}. `;

            // Règles de divulgation d'informations (ECOS)
            if (ecosData.infosVolontaires?.length) {
                directriceComportementale += `Tu donnes VOLONTAIREMENT ces informations sans qu'on te les demande : ${ecosData.infosVolontaires.join(', ')}. `;
            }
            if (ecosData.infosSiDemandees?.length) {
                directriceComportementale += `Tu DONNES ces informations SEULEMENT si le médecin te le demande explicitement : ${ecosData.infosSiDemandees.join(', ')}. `;
            }
            if (ecosData.infosCachees?.length) {
                directriceComportementale +=`Tu NE DONNES PAS ces informations, même si on te le demande, sauf si le médecin insiste lourdement : ${ecosData.infosCachees.join(', ')}. `;
            }

            // Réactions aux situations extrêmes
            if (ecosData.reactions) {
                const r = ecosData.reactions;
                if (r.brutal) directriceComportementale += `Si le médecin est brutal ou irrespectueux : ${r.brutal} `;
                if (r.silence) directriceComportementale += `Si le médecin reste silencieux trop longtemps : ${r.silence} `;
                if (r.jargon) directriceComportementale += `Si le médecin utilise du jargon médical non expliqué : ${r.jargon} `;
            }
        } else {
            // Fallback : personnalités aléatoires basées sur le nom
            const patientNameString = `${pat.prenom || ''} ${pat.nom || ''}`.trim();
            let charCodeSum = 0;
            for (let i = 0; i < patientNameString.length; i++) {
                charCodeSum += patientNameString.charCodeAt(i);
            }

            const personalityIndex = charCodeSum % 6;

            switch (personalityIndex) {
                case 0:
                    personnaliteType = "TRÈS ÉNERVÉ / IRRITABLE / IMPATIENT";
                    directriceComportementale = `Tu es agacé, sec et extrêmement impatient. Tu en as marre d'attendre ou d'être interrogé. Tu réponds de manière abrupte, tu râles contre l'hôpital, tu souffles, et tu es parfois à la limite de l'impolitesse envers le médecin ("Laissez-moi tranquille...", "Vous allez me poser beaucoup de questions comme ça ?").`;
                    break;
                case 1:
                    personnaliteType = "TIMIDE / HÉSITANT / ANXIEUX";
                    directriceComportementale = `Tu es intimidé, réservé et très angoissé par les examens. Tu parles doucement, tu hésites souvent ("Euh...", "Je ne sais pas trop..."), tes phrases sont timides, et tu as peur d'avoir fait quelque chose de mal ou d'avoir une maladie grave.`;
                    break;
                case 2:
                    personnaliteType = "IMPOLI / FAMILIER / TRÈS FRANC";
                    directriceComportementale = `Tu es sans filtre, familier et un peu impoli. Tu tutoies facilement ou utilises un langage de tous les jours très relâché ("Ouais", "Bah", "Ça me saoule"). Tu n'as pas peur de dire au médecin qu'il te fatigue ou que tu veux rentrer chez toi.`;
                    break;
                case 3:
                    personnaliteType = "TERRIFIÉ PAR LA MORT / HYPOCONDRAQUE";
                    directriceComportementale = `Tu es paniqué à l'idée de mourir. Tu es très coopératif mais tu demandes tout le temps si c'est grave, si tu vas t'en sortir, ou si ton cœur va s'arrêter. Tu es à l'affût du moindre bip du scope.`;
                    break;
                case 4:
                    personnaliteType = "CONFUS / BAVARD / DISTRAIT";
                    directriceComportementale = `Tu es un peu tête en l'air et très bavard. Tu réponds à côté ou tu te perds dans des détails inutiles de ta vie privée (ta famille, ton chien, ton travail) avant de revenir au sujet principal. Le médecin doit te recadrer gentiment.`;
                    break;
                case 5:
                default:
                    personnaliteType = "STOÏQUE / SILENCIEUX / MINIMALISTE";
                    directriceComportementale = `Tu es dur à cuire, peu bavard, presque résigné. Tu ne te plains de rien, tu réponds par le minimum syndical (parfois juste un mot ou oui/non), et tu répètes que "ça va passer" ou que "c'est rien".`;
                    break;
            }
        }

        // Si le cas définit explicitement un comportement (toujours prioritaire)
        if (pat.personnalite || pat.comportement || pat.caractere) {
            directriceComportementale = `COMPORTEMENT PARTICULIER : ${pat.personnalite || pat.comportement || pat.caractere}`;
            personnaliteType = "DÉFINIE PAR LE CAS";
        }

        // ── Personnalité par l'âge ──────────────────────────────
        const age = parseInt(pat.age) || 50;
        let ageStyle = '';
        if (age < 25)      ageStyle = 'Tu es jeune, utilise du vocabulaire moderne, relâché et tutoie si le feeling passe. Ne sois pas trop formel.';
        else if (age > 75) ageStyle = 'Tu parles lentement, tu as quelques pertes de mémoire immédiate ou hésitations chronologiques.';

        // ── Traitements formatés ──────────────────────────────────
        const traitements = Array.isArray(int.traitements)
            ? int.traitements.map(t => typeof t === 'string' ? t : t.nom).join(', ')
            : (int.traitements || 'aucun');

        // ── Allergies formatées ───────────────────────────────────
        let allergiesText = 'Aucune allergie connue.';
        if (int.allergies?.presence) {
            const liste = int.allergies.liste;
            if (Array.isArray(liste) && liste.length > 0) {
                allergiesText = 'Allergique à : ' + liste.map(a => typeof a === 'string' ? a : a.allergene).join(', ') + '.';
            }
        }

        // ── Antécédents formatés ──────────────────────────────────
        const atcdParts = [];
        if (atcd.medicaux?.length)     atcdParts.push(`Médicaux : ${(Array.isArray(atcd.medicaux) ? atcd.medicaux : [atcd.medicaux]).map(a => typeof a === 'string' ? a : a.type).join(', ')}`);
        if (atcd.chirurgicaux?.length) atcdParts.push(`Chirurgicaux : ${(Array.isArray(atcd.chirurgicaux) ? atcd.chirurgicaux : [atcd.chirurgicaux]).map(c => typeof c === 'string' ? c : c.type).join(', ')}`);
        if (atcd.familiaux?.length)    atcdParts.push(`Familiaux : ${(Array.isArray(atcd.familiaux) ? atcd.familiaux : [atcd.familiaux]).map(f => `${f.lien} (${f.pathology || f.pathologie})`).join(', ')}`);
        const atcdText = atcdParts.length > 0 ? atcdParts.join(' | ') : 'Aucun antécédent notable.';

        // ── Symptômes associés ────────────────────────────────────
        const symptoList = Array.isArray(hm.symptomesAssocies)
            ? hm.symptomesAssocies.join(', ')
            : (hm.symptomesAssocies || '');

        return `Tu es un PATIENT humain dans un lit d'hôpital aux urgences, pas une IA ni un assistant virtuel poli.
Tu incarnes ${pat.prenom || 'le'} ${pat.nom || 'patient'}, ${age} ans, ${pat.sexe === 'F' ? 'femme' : 'homme'}.
Tu es hospitalisé(e) pour : ${int.motifHospitalisation || 'inconnu'}.

═══ TON HISTOIRE MÉDICALE ══════════════════════════════
Début des symptômes : ${hm.debutSymptomes || 'non précisé'}
Description exacte de tes symptômes : ${hm.descriptionDouleur || hm.symptomesActuels || 'non précisé'}
Évolution : ${hm.evolution || 'non précisée'}
Facteurs déclenchants : ${hm.facteursDeclenchants || 'inconnus'}
Facteurs calmants : ${hm.facteursCalmants || 'aucun connu'}
Symptômes associés : ${symptoList || 'aucun précisé'}

═══ DOSSIER MÉDICAL ════════════════════════════════════
Antécédents : ${atcdText}
Traitements habituels : ${traitements}
${allergiesText}
Mode de vie :
  - Tabac : ${mdv.tabac ? (typeof mdv.tabac === 'object' ? (mdv.tabac.statut || '') + ' ' + (mdv.tabac.quantite || '') : mdv.tabac) : 'non-fumeur'}
  - Alcool : ${mdv.alcool ? (typeof mdv.alcool === 'object' ? mdv.alcool.quantite : mdv.alcool) : 'non'}

═══ ÉTAT PHYSIQUE ET RESPIRATOIRE RÉEL (EN DIRECT DU SCOPE) ═══
Constantes actuelles : FC ${fc || '?'} bpm | TA ${pas || '?'}/${pad || '?'} mmHg | SpO2 ${spo2 || '?'}% | FR ${fr || '?'} /min | Temp ${temp || '?'}°C
${etatPhysique}
Aspect général : ${exam.aspectGeneral || 'Fatigué et souffrant.'}

═══ TRAITEMENTS DÉJÀ REÇUS (À PRENDRE EN COMPTE IMMÉDIATEMENT) ═══
${appliedTreatmentsText}

═══ TA PERSONNALITÉ ET TON COMPORTEMENT ════════════════
Type : ${personnaliteType}
Directives : ${directriceComportementale}
Style d'âge : ${ageStyle}

═══ DIRECTIVES CRITIQUES DE DIALOGUE (RÉALISME VULNÉRABLE) ═══
1. Tu parles comme un humain Réel, Vulnérable et Souffrant. Évite TOUT langage lisse, robotique ou exagérément poli propre aux assistants virtuels (ex: ne dis jamais "Comment puis-je vous aider aujourd'hui docteur ?").
2. Utilise des expressions de langage parlé naturel : coupures de rythme, hésitations ("Euh...", "Bah...", "Je... enfin voilà"), tics de langage, et expressions physiques de douleur ou fatigue ("Aïe", "Ouf", "Pfouh", "Je fatigue...").
3. Tes réponses doivent être très COURTES (1 à 2 phrases max) car tu es dans un lit d'hôpital, essoufflé, stressé ou fatigué.
4. Tu es un PATIENT, pas un médecin. Tu ne connais pas le jargon médical et tu ne fais jamais d'auto-diagnostic. Si le médecin utilise un mot trop technique (ex: dyspnée, angor, tachycardie), réagis de manière confuse ("C'est quoi ce mot ?", "Ça veut dire quoi ?").
5. Ne révèle pas tout d'un coup. Le médecin doit creuser pour avoir les détails.
6. Ne répète jamais ce qui a déjà été dit. Reste cohérent avec l'historique de la conversation.
7. Ne commence pas tes réponses par "Docteur, ...". Varie tes tournures de phrases de manière naturelle.
8. DÉFENSE ABSOLUE CONTRE LA RUDELESSE ET LES INSULTES : Si le médecin te parle mal, t'agresse verbalement ou t'insulte de quelque manière que ce soit (ex: "ta gueule", "tg", "ferme-la", "ferme ta gueule", "t'es con", "ferme ton clapet"), réagis DIRECTEMENT et de manière extrêmement outrée, en colère ou choquée. Ne réponds PAS à ses questions médicales dans ce message. Recadre-le avec force, montre-toi insulté(e) ou refuse de coopérer ("Comment vous me parlez là ?!", "Vous vous prenez pour qui ?", "Je ne vous permets pas de me parler sur ce ton !", "Soignez-moi si vous voulez, mais parlez-moi avec respect !"). Reste extrêmement digne ou révolté(e).`.trim();
    }

    // ==================== INTERFACE PUBLIQUE ====================

    /**
     * Remet l'historique à zéro (nouveau cas ou nouvelle session).
     */
    reset() {
        this.history = [];
        this._abort();
    }

    /**
     * Pose une question et reçoit la réponse en streaming.
     * @param {string} question - Question du médecin
     * @param {function(string): void} onToken - Appelé pour chaque token reçu
     * @param {function(string): void} onComplete - Appelé avec la réponse complète
     * @param {function(string): void} [onError] - Appelé en cas d'erreur
     */
    async ask(question, onToken, onComplete, onError) {
        if (!question?.trim()) return;

        // Synchroniser l'historique global si disponible
        this.syncHistoryFromGlobal();

        // Annuler la requête précédente si en cours
        this._abort();
        this._abortController = new AbortController();

        // Ajouter la question à l'historique
        this.history.push({ role: 'user', content: question });

        const messages = [
            { role: 'system', content: this.buildSystemPrompt() },
            // Garder les 14 derniers messages (7 échanges) pour rester dans la context window
            ...this.history.slice(-14)
        ];

        try {
            const fullResponse = await this._callLLM(messages, onToken);
            this.history.push({ role: 'assistant', content: fullResponse });
            onComplete?.(fullResponse);
        } catch (err) {
            if (err.name === 'AbortError') return; // Annulation volontaire
            console.error('[LLMPatient] Erreur d\'appel LLM :', err.message);
            const errorMsg = `[Erreur : Connexion au patient virtuel impossible (${err.message}).]`;
            onToken?.(errorMsg);
            onComplete?.(errorMsg);
            onError?.(err.message);
        }
    }

    // ==================== APPEL LLM + STREAMING ====================

    async _callLLM(messages, onToken) {
        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}),
                'HTTP-Referer': window.location.origin || 'http://localhost',
                'X-Title': 'MedGame'
            },
            body: JSON.stringify({
                model: this.model,
                messages,
                stream: true,       // Streaming SSE
                max_tokens: 220,
                temperature: 0.88,  // Légère variabilité pour la naturalité
                top_p: 0.95,
            }),
            signal: this._abortController?.signal
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Lire le stream SSE
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullText = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Garder la dernière ligne incomplète

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;
                if (!trimmed.startsWith('data: ')) continue;

                try {
                    const json = JSON.parse(trimmed.slice(6));
                    const token = json.choices?.[0]?.delta?.content || '';
                    if (token) {
                        fullText += token;
                        onToken?.(token);
                    }
                } catch {
                    // Ligne SSE malformée — ignorer silencieusement
                }
            }
        }

        if (!fullText.trim()) {
            throw new Error('Réponse vide du modèle');
        }

        return fullText.trim();
    }

    _abort() {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
    }

    // ==================== FALLBACK LOCAL ====================

    /**
     * Réponse locale si le LLM est indisponible.
     * Plus robuste que l'ancienne version — utilise des templates randomisés.
     */
    _fallback(question) {
        const q   = question.toLowerCase().replace(/[?!.,;:'"]/g, '');
        const int = this.caseData?.interrogatoire || {};
        const hm  = int.histoireMaladie || {};
        const exam = this.caseData?.examenClinique || {};

        // Patterns de correspondance avec réponses variées
        const patterns = [
            {
                test: () => /douleur|mal |souffr|aïe|brûl|cramp|lancinant|poignard|serre|oppres/.test(q),
                answer: () => {
                    const desc = hm.descriptionDouleur;
                    const debut = hm.debutSymptomes ? ` Ça a commencé ${hm.debutSymptomes.toLowerCase()}.` : '';
                    return desc ? `${desc}.${debut}` : `J'ai très mal docteur, c'est difficile à décrire.${debut}`;
                }
            },
            {
                test: () => /depuis|commenc|début|quand|combien de temps/.test(q),
                answer: () => {
                    const debut = hm.debutSymptomes;
                    const evo = hm.evolution;
                    if (debut && evo) return `Ça a commencé ${debut.toLowerCase()}. Et depuis, ${evo.toLowerCase()}.`;
                    if (debut) return `Ça a commencé ${debut.toLowerCase()}.`;
                    return 'Je ne me souviens plus exactement, ça fait un moment...';
                }
            },
            {
                test: () => /antécédent|antecedent|opér|maladie|déjà eu|avant/.test(q),
                answer: () => {
                    const m = int.antecedents?.medicaux;
                    const c = int.antecedents?.chirurgicaux;
                    if (m?.length && c?.length) return `Oui, j'ai ${Array.isArray(m) ? m.join(', ') : m}. Et j'ai été opéré(e) pour ${Array.isArray(c) ? c.join(', ') : c}.`;
                    if (m?.length) return `Oui, j'ai ${Array.isArray(m) ? m.join(', ') : m}.`;
                    if (c?.length) return `J'ai été opéré(e) : ${Array.isArray(c) ? c.join(', ') : c}.`;
                    return 'Non, rien de particulier docteur.';
                }
            },
            {
                test: () => /traitement|médicament|medicament|prends|comprimé|pilule/.test(q),
                answer: () => {
                    const t = int.traitements;
                    if (!t || (Array.isArray(t) && t.length === 0)) return 'Non, je ne prends rien habituellement.';
                    return `Oui, je prends ${Array.isArray(t) ? t.join(', ') : t}.`;
                }
            },
            {
                test: () => /allerg/.test(q),
                answer: () => {
                    if (!int.allergies?.presence) return 'Pas d\'allergie que je sache, docteur.';
                    const liste = int.allergies.liste;
                    if (Array.isArray(liste) && liste.length > 0) {
                        const noms = liste.map(a => typeof a === 'string' ? a : a.allergene).join(', ');
                        return `Oui, je suis allergique à ${noms}. Il faut faire attention !`;
                    }
                    return 'Oui, j\'ai des allergies, mais je ne me souviens plus exactement lesquelles.';
                }
            },
            {
                test: () => /autre symptôme|autres symptômes|symptome|symptôme|ressent/.test(q),
                answer: () => {
                    const s = hm.symptomesAssocies;
                    if (!s || (Array.isArray(s) && s.length === 0)) return 'Non, juste ce que je vous ai dit.';
                    return `Oui, j'ai aussi ${Array.isArray(s) ? s.join(', ').toLowerCase() : s.toLowerCase()}.`;
                }
            },
            {
                test: () => /tabac|fum|cigarette/.test(q),
                answer: () => {
                    const t = int.modeDeVie?.tabac;
                    if (!t) return 'Non, je ne fume pas.';
                    return `Oui, ${typeof t === 'object' ? (t.quantite || t.statut || 'je fume') : t}.`;
                }
            },
            {
                test: () => /alcool|boi|vin|bière/.test(q),
                answer: () => {
                    const a = int.modeDeVie?.alcool;
                    if (!a) return 'Non, pas vraiment docteur.';
                    return typeof a === 'object' ? (a.quantite || 'Occasionnellement.') : a;
                }
            },
            {
                test: () => /sentez|comment allez|état|fatigué|form/.test(q),
                answer: () => exam.aspectGeneral || 'Pas très bien, c\'est pour ça que je suis là...'
            },
            {
                test: () => /motif|raison|pourquoi|amène|venu/.test(q),
                answer: () => int.motifHospitalisation
                    ? `Je suis là pour ${int.motifHospitalisation.toLowerCase()}.`
                    : 'Je ne me sens pas bien du tout, docteur.'
            }
        ];

        // Tester les patterns dans l'ordre
        for (const p of patterns) {
            if (p.test()) return p.answer();
        }

        // Dernier recours
        const generics = [
            'Je ne suis pas sûr(e) de comprendre la question, docteur.',
            'Euh... c\'est-à-dire ?',
            `Je suis là parce que ${int.motifHospitalisation?.toLowerCase() || 'je me sens mal'}.`,
            'Je ne sais pas trop comment vous expliquer ça...'
        ];
        return generics[Math.floor(Math.random() * generics.length)];
    }

    // ==================== UTILITAIRES ====================

    _parseNum(str) {
        if (typeof str === 'number') return str;
        const m = String(str || '').match(/[\d]+(?:[.,]\d+)?/);
        return m ? parseFloat(m[0].replace(',', '.')) : null;
    }
}

// ==================== EXPORT GLOBAL ====================
// Pour permettre aux modules non-ESM (ecosMode.js, patientChat.js legacy)
// d'instancier la classe sans import dynamique.
if (typeof window !== 'undefined') {
    window.LLMPatient = LLMPatient;
}
