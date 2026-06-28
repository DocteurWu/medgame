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
                        return `Tabac : statut ${tabac.statut || ''}, quantité ${tabac.quantite || 'non précisée'}.`;
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

        // Réponses vagues ou esquives si aucune correspondance n'est trouvée
        this.fallbacks = [
            "Je ne comprends pas trop votre question, docteur...",
            "Je me sens fatigué(e), je ne sais pas trop comment vous répondre.",
            "Pouvez-vous reformuler ? J'ai un peu la tête qui tourne.",
            "Je ne sais pas... Je veux juste que ma douleur s'arrête.",
            "Désolé(e), je n'ai pas compris ce que vous me demandez."
        ];
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

        // Vérification des règles de la station ECOS concernant les informations cachées
        const isEcosMode = !!(window.EcosMode?.isActive?.());
        const hiddenInfos = caseData.ecos?.patientStandardise?.infosCachees || [];

        // Parcourir les catégories pour trouver le meilleur match de mots-clés
        let bestCategory = null;
        let maxMatches = 0;

        for (const cat of this.categories) {
            let matches = 0;
            for (const keyword of cat.keywords) {
                const cleanKeyword = this._removeAccents(keyword);
                // Si le mot-clé est très court (<= 3 caractères), on exige des frontières de mot strictes.
                // Sinon, on autorise le mot-clé comme préfixe (ex: douleur -> douleurs, fumer -> fumez).
                let regex;
                if (cleanKeyword.length <= 3) {
                    regex = new RegExp(`\\b${cleanKeyword}\\b`, 'i');
                } else {
                    regex = new RegExp(`\\b${cleanKeyword}`, 'i');
                }
                if (regex.test(cleanQ)) {
                    matches++;
                }
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

        // Si aucun mot-clé ne matche, renvoyer une phrase d'esquive naturelle
        const fallbackIndex = Math.floor(Math.random() * this.fallbacks.length);
        return this.fallbacks[fallbackIndex];
    }
}

window.llmFallback = new LLMFallback();
window.LLMFallback = LLMFallback;
