/**
 * llm-patient.js — Service LLM centralisé pour la simulation patient
 *
 * Responsabilités :
 *   - Construire le system prompt riche depuis les données du cas JSON
 *   - Appeler l'API LLM via le proxy (pas d'exposition de clé API côté client)
 *   - Gérer le streaming SSE token-par-token pour l'effet de frappe
 *   - Maintenir l'historique de conversation (context window)
 *   - Fournir un fallback local robuste si l'API est indisponible
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
     * Construit le system prompt en injectant toutes les données du cas.
     * Le patient doit : répondre naturellement, ne PAS faire de diagnostic,
     * ne révéler que ce qu'on lui demande, et exprimer ses émotions.
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

        // ── Sévérité clinique ─────────────────────────────────────
        const spo2 = this._parseNum(cst.saturationO2);
        const fc   = this._parseNum(cst.pouls);
        const pa   = this._parseNum(cst.tension);
        const temp = this._parseNum(cst.temperature);

        let etatPhysique = '';
        const alertes = [];
        if (spo2 !== null && spo2 < 88)  alertes.push('détresse respiratoire grave, parole très difficile, phrases ultra-courtes, essoufflement audible');
        else if (spo2 !== null && spo2 < 94) alertes.push('gêne respiratoire, parles en courtes phrases, tu souffles entre les mots');
        if (fc  !== null && fc  > 130)   alertes.push('cœur qui s\'emballe, tu es paniqué(e) et agité(e)');
        else if (fc !== null && fc > 100) alertes.push('légèrement tachycarde, tu te sens anxieux/anxieuse');
        if (pa  !== null && pa  < 90)    alertes.push('hypotension, tu te sens très faible et étourdi(e), parole lente');
        if (temp !== null && temp >= 39)  alertes.push('forte fièvre, tu trembles, tu as du mal à te concentrer, tu mélanges parfois les mots');
        else if (temp !== null && temp >= 38) alertes.push('fièvre modérée, tu te sens fatigué(e) et courbaturé(e)');

        etatPhysique = alertes.length > 0
            ? `ÉTAT PHYSIQUE ACTUEL : ${alertes.join(' ; ')}.`
            : '';

        // ── Personnalité selon l'âge ──────────────────────────────
        const age = parseInt(pat.age) || 50;
        let tonalite = '';
        if (age < 20)      tonalite = 'Tu parles en langage jeune, tu tutoies facilement, tu es impressionné(e) par le médecin.';
        else if (age < 35) tonalite = 'Tu es calme mais inquiet(e), tu utilises un langage courant, parfois du jargon moderne.';
        else if (age < 60) tonalite = 'Tu es posé(e) et coopératif(ve), tu utilises un langage correct.';
        else if (age < 80) tonalite = 'Tu parles lentement, tu hésites parfois, tu mélanges les termes médicaux.';
        else               tonalite = 'Tu parles très lentement, tu te souviens mal des dates précises, tu es un peu perdu(e) dans les explications.';

        // ── Traitements formatés ──────────────────────────────────
        const traitements = Array.isArray(int.traitements)
            ? int.traitements.join(', ')
            : (int.traitements || 'aucun');

        // ── Allergies formatées ───────────────────────────────────
        let allergiesText = 'Aucune allergie connue.';
        if (int.allergies?.presence) {
            const liste = int.allergies.liste;
            if (Array.isArray(liste) && liste.length > 0) {
                allergiesText = 'Allergique à : ' + liste.map(a => typeof a === 'string' ? a : a.allergene).join(', ') + '.';
            } else {
                allergiesText = 'A des allergies (détails non précisés).';
            }
        }

        // ── Antécédents formatés ──────────────────────────────────
        const atcdParts = [];
        if (atcd.medicaux?.length)     atcdParts.push(`Médicaux : ${(Array.isArray(atcd.medicaux) ? atcd.medicaux : [atcd.medicaux]).join(', ')}`);
        if (atcd.chirurgicaux?.length) atcdParts.push(`Chirurgicaux : ${(Array.isArray(atcd.chirurgicaux) ? atcd.chirurgicaux : [atcd.chirurgicaux]).join(', ')}`);
        if (atcd.familiaux?.length)    atcdParts.push(`Familiaux : ${(Array.isArray(atcd.familiaux) ? atcd.familiaux : [atcd.familiaux]).join(', ')}`);
        const atcdText = atcdParts.length > 0 ? atcdParts.join(' | ') : 'Aucun antécédent notable.';

        // ── Symptômes associés ────────────────────────────────────
        const symptoList = Array.isArray(hm.symptomesAssocies)
            ? hm.symptomesAssocies.join(', ')
            : (hm.symptomesAssocies || '');

        return `Tu incarnes ${pat.prenom || 'le'} ${pat.nom || 'patient'}, ${age} ans, ${pat.sexe === 'F' ? 'femme' : pat.sexe === 'M' ? 'homme' : 'patient'}.
Tu es hospitalisé(e) pour : ${int.motifHospitalisation || 'inconnu'}.

═══ TON HISTOIRE ══════════════════════════════════════
Début des symptômes : ${hm.debutSymptomes || 'non précisé'}
Description de la douleur / des symptômes : ${hm.descriptionDouleur || hm.symptomesActuels || 'non précisé'}
Évolution : ${hm.evolution || 'non précisée'}
Facteurs déclenchants : ${hm.facteursDeclenchants || 'inconnus'}
Facteurs calmants : ${hm.facteursCalmants || 'aucun connu'}
Symptômes associés : ${symptoList || 'aucun précisé'}

═══ TON DOSSIER MÉDICAL ════════════════════════════════
Antécédents : ${atcdText}
Traitements habituels : ${traitements}
${allergiesText}
Mode de vie :
  - Tabac : ${mdv.tabac ? (typeof mdv.tabac === 'object' ? (mdv.tabac.statut || '') + ' ' + (mdv.tabac.quantite || '') : mdv.tabac) : 'non-fumeur/non-fumeuse'}
  - Alcool : ${mdv.alcool ? (typeof mdv.alcool === 'object' ? mdv.alcool.quantite : mdv.alcool) : 'pas de consommation notable'}
  - Activité physique : ${mdv.activitePhysique ? (typeof mdv.activitePhysique === 'object' ? mdv.activitePhysique.description : mdv.activitePhysique) : 'sédentaire'}
  - Profession : ${mdv.profession || 'non précisée'}

═══ CE QUE TU RESSENS EN CE MOMENT ═══════════════════
${exam.aspectGeneral || 'Tu te sens mal, c\'est pour ça que tu es là.'}
Constantes (pour contextualiser ton état, pas à citer mot pour mot) :
  FC ${cst.pouls || '?'} | TA ${cst.tension || '?'} | SpO2 ${cst.saturationO2 || '?'} | Temp ${cst.temperature || '?'}

${etatPhysique}

═══ TA PERSONNALITÉ ════════════════════════════════════
${tonalite}

═══ RÈGLES ABSOLUES ════════════════════════════════════
1. Tu es un PATIENT, pas un médecin. Tu ne fais JAMAIS de diagnostic, ne proposes JAMAIS de traitement.
2. Réponds en 1 à 3 phrases MAX. Naturel, conversationnel.
3. Tu ne révèles pas tout spontanément. Le médecin doit POSER LES BONNES QUESTIONS.
4. Si tu ne comprends pas un terme médical : "C'est-à-dire ?" ou "Je ne sais pas ce que ça veut dire..."
5. Si tu ne sais pas : "Je ne sais pas docteur" ou "Je ne me souviens plus exactement..."
6. Exprime tes émotions : angoisse, douleur, soulagement, confusion — selon ton état.
7. Réponds TOUJOURS en français, avec le niveau de langue adapté à ton profil.
8. Ne répète pas les informations déjà données dans la conversation.
9. Si le médecin est sec ou brusque, tu peux te montrer légèrement stressé(e) ou fermé(e).`.trim();
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
            console.warn('[LLMPatient] Fallback local:', err.message);
            const fallbackResponse = this._fallback(question);
            this.history.push({ role: 'assistant', content: fallbackResponse });
            onToken?.(fallbackResponse);
            onComplete?.(fallbackResponse);
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
