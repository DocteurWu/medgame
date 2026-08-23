/**
 * llm-fallback.js — Moteur de réponse local rule-based de secours
 * 
 * Utilisé si tous les appels API LLM échouent (problème réseau, panne d'API, quota dépassé).
 * Analyse les mots-clés de la question posée et cherche la réponse correspondante dans le dossier clinique.
 */

class LLMFallback {
    constructor() {
        // Dictionnaires de mots-clés et leurs catégories associées
        this.categories = [
            {
                name: 'age',
                keywords: ['âge', 'ans', 'vieilli', 'jeune'],
                extractor: (c) => c.patient?.age ? `J'ai ${c.patient.age} ans.` : null
            },
            {
                name: 'nom',
                keywords: ['nom', 'appelle', 'prénom'],
                extractor: (c) => {
                    const p = c.patient || {};
                    const full = `${p.prenom || ''} ${p.nom || ''}`.trim();
                    return full ? `Je m'appelle ${full}.` : null;
                }
            },
            {
                name: 'motif',
                keywords: ['motif', 'hospitalisation', 'venir', 'amener', 'ici', 'problème', 'urgence', 'quoi', 'passe', 'sert', 'arrive'],
                extractor: (c) => c.interrogatoire?.motifHospitalisation
            },
            {
                name: 'debutSymptomes',
                keywords: ['quand', 'depuis', 'commencer', 'début', 'temps', 'heure', 'jour', 'date', 'durée'],
                extractor: (c) => c.interrogatoire?.histoireMaladie?.debutSymptomes
            },
            {
                name: 'douleur',
                keywords: ['douleur', 'mal', 'où', 'siège', 'type', 'irradiation', 'caractère', 'ressentez', 'ressent', 'poitrine', 'thorax'],
                extractor: (c) => c.interrogatoire?.histoireMaladie?.descriptionDouleur || c.interrogatoire?.histoireMaladie?.symptomesActuels
            },
            {
                name: 'facteursDeclenchants',
                keywords: ['déclenche', 'provoque', 'quand', 'effort', 'marche', 'courir', 'escalier', 'survient', 'déclencheur'],
                extractor: (c) => c.interrogatoire?.histoireMaladie?.facteursDeclenchants
            },
            {
                name: 'facteursCalmants',
                keywords: ['calme', 'soulage', 'mieux', 'trinitrine', 'repos', 'passe', 'diminue'],
                extractor: (c) => c.interrogatoire?.histoireMaladie?.facteursCalmants
            },
            {
                name: 'symptomesAssocies',
                keywords: ['autre', 'symptôme', 'signe', 'nausée', 'vomissement', 'fièvre', 'essoufflé', 'palpitation', 'toux', 'crachat', 'vertige', 'tête', 'fatigue'],
                extractor: (c) => {
                    const list = c.interrogatoire?.histoireMaladie?.symptomesAssocies;
                    if (Array.isArray(list)) return list.join(', ');
                    return list;
                }
            },
            {
                name: 'antecedents',
                keywords: ['antécédent', 'atcd', 'opéré', 'opération', 'chirurgie', 'maladie', 'hospitalisé', 'déjà', 'cardiaque', 'tension', 'diabète', 'famille', 'père', 'mère', 'parents'],
                extractor: (c) => {
                    const parts = [];
                    const atcd = c.interrogatoire?.antecedents;
                    if (!atcd) return null;
                    if (atcd.medicaux?.length) {
                        parts.push("En maladies : " + atcd.medicaux.map(m => typeof m === 'string' ? m : m.type).join(', '));
                    }
                    if (atcd.chirurgicaux?.length) {
                        parts.push("En chirurgies : " + atcd.chirurgicaux.map(ch => typeof ch === 'string' ? ch : ch.type).join(', '));
                    }
                    if (atcd.familiaux?.length) {
                        parts.push("Dans ma famille : " + atcd.familiaux.map(f => `${f.lien} a eu ${f.pathologie || f.pathology}`).join(', '));
                    }
                    return parts.length > 0 ? parts.join('. ') : 'Aucun antécédent particulier.';
                }
            },
            {
                name: 'traitements',
                keywords: ['traitement', 'médicament', 'ordonnance', 'prendre', 'prends', 'cachet', 'pilule', 'drogue'],
                extractor: (c) => {
                    const tr = c.interrogatoire?.traitements;
                    if (!tr) return 'Aucun traitement.';
                    if (Array.isArray(tr)) {
                        return "Je prends : " + tr.map(t => typeof t === 'string' ? t : `${t.nom} (${t.dose || ''} ${t.frequence || ''})`).join(', ');
                    }
                    return String(tr);
                }
            },
            {
                name: 'allergies',
                keywords: ['allergie', 'allergique', 'réaction', 'intolérance'],
                extractor: (c) => {
                    const al = c.interrogatoire?.allergies;
                    if (!al || !al.presence) return 'Pas d\'allergies connues.';
                    if (Array.isArray(al.liste)) {
                        return "Je suis allergique à : " + al.liste.map(item => typeof item === 'string' ? item : item.allergene).join(', ');
                    }
                    return 'Oui, j\'ai des allergies.';
                }
            },
            {
                name: 'tabac',
                keywords: ['tabac', 'fumer', 'cigarette', 'fumez', 'clope', 'paquet'],
                extractor: (c) => {
                    const tabac = c.interrogatoire?.modeDeVie?.tabac;
                    if (!tabac) return 'Je ne fume pas.';
                    if (typeof tabac === 'object') {
                        const statut = String(tabac.statut || '').toLowerCase();
                        const quantite = parseFloat(String(tabac.quantite || '').replace(',', '.')) || 0;
                        if (quantite === 0 || /non|aucun|jamais|ancien|ex[- ]?/.test(statut)) {
                            return quantite === 0 ? 'Je ne fume pas.' : `J'ai arrêté de fumer.`;
                        }
                        return `Oui, je fume environ ${tabac.quantite || 'quelques cigarettes'} par jour.`;
                    }
                    return String(tabac);
                }
            },
            {
                name: 'alcool',
                keywords: ['alcool', 'boire', 'boisson', 'verre', 'apéro', 'vin', 'bière'],
                extractor: (c) => c.interrogatoire?.modeDeVie?.alcool?.quantite || c.interrogatoire?.modeDeVie?.alcool
            },
            {
                name: 'activitePhysique',
                keywords: ['sport', 'activité', 'physique', 'marche', 'bouger', 'sportif'],
                extractor: (c) => c.interrogatoire?.modeDeVie?.activitePhysique?.description || c.interrogatoire?.modeDeVie?.activitePhysique
            },
            {
                name: 'constantes',
                keywords: ['tension', 'pouls', 'saturation', 'o2,', 'battement', 'cœur', 'température', 'fièvre', 'respiration'],
                extractor: (c) => {
                    const cst = c.examenClinique?.constantes;
                    if (!cst) return null;
                    return `Tension : ${cst.tension || '?'}, Pouls : ${cst.pouls || '?'}, Saturation : ${cst.saturationO2 || '?'}, Température : ${cst.temperature || '?'}.`;
                }
            }
        ];

        // Formulations d'introduction naturelles et aléatoires pour humaniser la réponse locale
        this.templates = [
            (text) => `Et bien, ${text.toLowerCase()}`,
            (text) => `Je peux vous dire que ${text.toLowerCase()}`,
            (text) => `${text}`,
            (text) => `Alors... ${text.toLowerCase()}`
        ];

        // SUPPRIMÉ : les phrases d'esquive masquaient les vraies erreurs LLM.
        // Si le LLM échoue, on affiche désormais une erreur technique explicite (voir answer()).
        this.fallbacks = [];
    }

    /**
     * Supprime les accents d'une chaîne de caractères.
     */
    _removeAccents(str) {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    /**
     * Analyse la question et formule une réponse à partir du cas clinique.
     * @param {string} question - Question posée par l'étudiant
     * @param {Object} caseData - Les données complètes du cas
     * @returns {string} Réponse formulée
     */
    answer(question, caseData) {
        if (!caseData) return "[Erreur : Aucune donnée de cas disponible pour le fallback local.]";
        if (!question?.trim()) return "Bonjour docteur.";

        const cleanQ = this._removeAccents(question.toLowerCase().trim());

        // ── 1. Intentions explicites (nom, politesse pure) ─────────────────
        if (/\b(nom|prénom)\b/.test(cleanQ) || /\bappel/i.test(cleanQ)) {
            const p = caseData.patient || {};
            const full = `${p.prenom || ''} ${p.nom || ''}`.trim();
            if (full) return `Je m'appelle ${full}.`;
        }
        const isGreeting = /\b(bonjour|salut|coucou|hello|bonsoir|hey)\b/.test(cleanQ);
        const wordCount = cleanQ.split(/\s+/).filter(w => w.length > 1).length;
        const hasMedicalContent = /(douleur|mal\b|symptome|hopital|souffr|malade|fievre|nausee)/.test(cleanQ) || wordCount > 6;
        if (isGreeting && !hasMedicalContent) {
            const g = ["Bonjour docteur...", "Ah, bonjour docteur. Oui ?", "Bonjour... Je suis un peu inquiet(e) de cette consultation."];
            return g[Math.floor(Math.random() * g.length)];
        }
        if (/\bmerci\b/.test(cleanQ)) return "De rien, docteur...";
        if (/\bau revoir\b/.test(cleanQ)) return "Au revoir docteur... et merci pour tout.";

        // Vérification des règles de la station ECOS concernant les informations cachées
        const isEcosMode = !!(window.EcosMode?.isActive?.());
        const hiddenInfos = caseData.ecos?.patientStandardise?.infosCachees || [];

        // ── 2. Matching par racines de mots (tolère amène/amener, symptôme/symptômes…) ──
        const qStems = cleanQ.split(/[^a-z0-9]+/)
            .filter(w => w.length >= 4)
            .map(w => w.slice(0, 5));

        let bestCategory = null;
        let maxMatches = 0;

        for (const cat of this.categories) {
            let matches = 0;
            for (const keyword of cat.keywords) {
                const kw = this._removeAccents(keyword.toLowerCase());
                let hit = false;
                if (kw.length <= 4) {
                    // Mot-clé court : correspondance exacte sur le mot entier
                    hit = new RegExp(`\\b${kw}\\b`, 'i').test(cleanQ);
                } else {
                    // Racine de 5 lettres : tolère les variations de suffixe
                    const kwStem = kw.slice(0, 5);
                    hit = qStems.some(st => st === kwStem || st.startsWith(kwStem) || kwStem.startsWith(st));
                }
                if (hit) matches++;
            }
            if (matches > maxMatches) {
                maxMatches = matches;
                bestCategory = cat;
            }
        }

        // Si une catégorie correspond
        if (bestCategory && maxMatches > 0) {
            // Si cette catégorie ou ce chemin d'information fait partie des infos cachées ECOS
            if (isEcosMode && hiddenInfos.some(hiddenPath => hiddenPath.toLowerCase().includes(bestCategory.name.toLowerCase()))) {
                const reactions = caseData.ecos?.patientStandardise?.reactions;
                return reactions?.silence || "Je ne préfère pas en parler... ce n'est pas important.";
            }

            const rawContent = bestCategory.extractor(caseData);
            if (rawContent) {
                // Formater le texte brut s'il s'agit d'un objet ou tableau complexe
                let formatted = typeof rawContent === 'object' ? JSON.stringify(rawContent) : String(rawContent);
                
                // Choisir un template d'habillage aléatoire
                const templateIndex = Math.floor(Math.random() * this.templates.length);
                return this.templates[templateIndex](formatted);
            }
        }

        // Plus d'esquive silencieuse : on expose l'échec du moteur local
        // (ce code n'est atteint que si le LLM est HS et qu'aucun mot-clé n'a matché)
        return `⚠️ [ERREUR LLM — Fallback local] Aucune réponse du LLM et aucun mot-clé trouvé pour « ${question} ».`
            + ` Vérifiez : 1) Le proxy LLM est-il démarré (/.netlify/functions/llm-proxy ou mcp-server / env LLM_API_KEY) ?`
            + ` 2) La console (F12) pour le détail HTTP.`
            + ` 3) Si vous êtes en file:// ouvrez via http://localhost (npx serve .).`;
    }
}

window.llmFallback = new LLMFallback();
window.LLMFallback = LLMFallback;
