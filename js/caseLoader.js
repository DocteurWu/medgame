/**
 * js/caseLoader.js — Chargement des cas cliniques
 * Phase 8 du refactoring : extrait de game.js
 *
 * Charge les cas depuis Supabase, localStorage, ou fichiers JSON locaux.
 * Optimisé avec cache mémoire et localStorage TTL.
 */

const caseLoaderCache = {
    memory: new Map(),
    localStorageKey: 'medgame_case_cache',
    ttl: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 0 : 10 * 60 * 1000,

    get(key) {
        const cached = this.memory.get(key);
        if (cached && Date.now() - cached.timestamp < this.ttl) {
            return cached.data;
        }
        this.memory.delete(key);
        return null;
    },

    set(key, data) {
        this.memory.set(key, { data, timestamp: Date.now() });
        this.saveToLocalStorage(key, data);
    },

    saveToLocalStorage(key, data) {
        try {
            const storage = JSON.parse(localStorage.getItem(this.localStorageKey) || '{}');
            storage[key] = { data, timestamp: Date.now() };
            Object.keys(storage).forEach(k => {
                if (Date.now() - storage[k].timestamp > this.ttl) delete storage[k];
            });
            localStorage.setItem(this.localStorageKey, JSON.stringify(storage));
        } catch (e) { console.warn('Cache localStorage failed', e); }
    },

    getFromLocalStorage(key) {
        try {
            const storage = JSON.parse(localStorage.getItem(this.localStorageKey) || '{}');
            const cached = storage[key];
            if (cached && Date.now() - cached.timestamp < this.ttl) {
                this.memory.set(key, cached);
                return cached.data;
            }
        } catch (e) {}
        return null;
    }
};

const LEGACY_CASE_ALIASES = {
    'CARDIO_angor_stable.json': 'cardio_douleur_thoracique_mme_bennet.json',
    'cardio_angor_stable.json': 'cardio_douleur_thoracique_mme_bennet.json',
    'CARDIO_AOMI.json': 'cardio_claudication_intermittente_m_lambert.json',
    'cardio_AOMI.json': 'cardio_claudication_intermittente_m_lambert.json',
    'CARDIO_hta_secondaire_hyperaldosteronisme.json': 'cardio_hypertension_arterielle_m_wickham.json',
    'cardio_hta_secondaire_hyperaldosteronisme.json': 'cardio_hypertension_arterielle_m_wickham.json',
    'CARDIO_insuffisance_veineuse_chronique.json': 'cardio_jambes_lourdes_mme_dubois.json',
    'cardio_insuffisance_veineuse_chronique.json': 'cardio_jambes_lourdes_mme_dubois.json',
    'CARDIO_retrecissement_aortique.json': 'cardio_malaise_effort_m_bingley.json',
    'cardio_retrecissement_aortique.json': 'cardio_malaise_effort_m_bingley.json',
    'CARDIO_syncope_cardiaque.json': 'cardio_perte_de_connaissance_m_darcy.json',
    'cardio_syncope_cardiaque.json': 'cardio_perte_de_connaissance_m_darcy.json',
    'CARDIO_syncope_vaso_vagale.json': 'cardio_malaise_vagal_mlle_bennet.json',
    'cardio_syncope_vaso_vagale.json': 'cardio_malaise_vagal_mlle_bennet.json',
    'CARDIO_thrombose_veineuse_profonde_droite.json': 'cardio_grosse_jambe_rouge_m_ternes.json',
    'cardio_thrombose_veineuse_profonde_droite.json': 'cardio_grosse_jambe_rouge_m_ternes.json',
    'cardio_1.json': 'cardio_dyspnee_oedemes_m_dupont.json',
    'cardio_insuffisancecardiaque_denny.json': 'cardio_dyspnee_fatigue_m_duquette.json',
    'cardio_insuffisancecardiaque_ellis.json': 'cardio_dyspnee_effort_mme_grey.json',
    'EDN_diabetetype2_1.json': 'endo_fatigue_et_soif_accrue_mme_dupont.json',
    'edn_diabetetype2_1.json': 'endo_fatigue_et_soif_accrue_mme_dupont.json',
    'EDN_diabetetype2_1': 'endo_fatigue_et_soif_accrue_mme_dupont.json',
    'edn_diabetetype2_1': 'endo_fatigue_et_soif_accrue_mme_dupont.json',
    'EDN_Anorexie_1.json': 'endo_baisse_energie_et_troubles_digestifs_m_legrand.json',
    'edn_anorexie_1.json': 'endo_baisse_energie_et_troubles_digestifs_m_legrand.json',
    'EDN_Anorexie_1': 'endo_baisse_energie_et_troubles_digestifs_m_legrand.json',
    'edn_anorexie_1': 'endo_baisse_energie_et_troubles_digestifs_m_legrand.json',
    'EDN_Anorexie_2.json': 'endo_perte_de_poids_adolescente_alice.json',
    'edn_anorexie_2.json': 'endo_perte_de_poids_adolescente_alice.json',
    'EDN_Anorexie_2': 'endo_perte_de_poids_adolescente_alice.json',
    'edn_anorexie_2': 'endo_perte_de_poids_adolescente_alice.json',
    'EDN_boulimie_1.json': 'endo_crises_alimentaires_incontrolables_mlle_martin.json',
    'edn_boulimie_1.json': 'endo_crises_alimentaires_incontrolables_mlle_martin.json',
    'EDN_boulimie_1': 'endo_crises_alimentaires_incontrolables_mlle_martin.json',
    'edn_boulimie_1': 'endo_crises_alimentaires_incontrolables_mlle_martin.json',
    'EDN_ARFID_1.json': 'endo_restriction_alimentaire_severe_emma.json',
    'edn_arfid_1.json': 'endo_restriction_alimentaire_severe_emma.json',
    'EDN_ARFID_1': 'endo_restriction_alimentaire_severe_emma.json',
    'edn_arfid_1': 'endo_restriction_alimentaire_severe_emma.json',
    'EDN_hyperphagie_1.json': 'endo_acces_hyperphagiques_sans_purge_m_lucas.json',
    'edn_hyperphagie_1.json': 'endo_acces_hyperphagiques_sans_purge_m_lucas.json',
    'EDN_hyperphagie_1': 'endo_acces_hyperphagiques_sans_purge_m_lucas.json',
    'edn_hyperphagie_1': 'endo_acces_hyperphagiques_sans_purge_m_lucas.json',
    'EDN_Merycisme_1.json': 'endo_remontees_alimentaires_postprandiales_clara.json',
    'edn_merycisme_1.json': 'endo_remontees_alimentaires_postprandiales_clara.json',
    'EDN_Mérycisme_1': 'endo_remontees_alimentaires_postprandiales_clara.json',
    'edn_mérycisme_1': 'endo_remontees_alimentaires_postprandiales_clara.json',
    'EDN_PICA_1.json': 'endo_ingestion_substances_non_alimentaires_lucas.json',
    'edn_pica_1.json': 'endo_ingestion_substances_non_alimentaires_lucas.json',
    'EDN_PICA_1': 'endo_ingestion_substances_non_alimentaires_lucas.json',
    'edn_pica_1': 'endo_ingestion_substances_non_alimentaires_lucas.json',
    'EDN_diabetetype2_2.json': 'endo_somnolence_postprandiale_et_surpoids_m_moreau.json',
    'edn_diabetetype2_2.json': 'endo_somnolence_postprandiale_et_surpoids_m_moreau.json',
    'EDN_diabetetype2_2': 'endo_somnolence_postprandiale_et_surpoids_m_moreau.json',
    'edn_diabetetype2_2': 'endo_somnolence_postprandiale_et_surpoids_m_moreau.json',
    'EDN_denutrition-hyper_1.json': 'endo_amaigrissement_involontaire_et_fievre_m_girard.json',
    'edn_denutrition-hyper_1.json': 'endo_amaigrissement_involontaire_et_fievre_m_girard.json',
    'EDN_dénutrition-hyper_1': 'endo_amaigrissement_involontaire_et_fievre_m_girard.json',
    'edn_dénutrition-hyper_1': 'endo_amaigrissement_involontaire_et_fievre_m_girard.json',
    'EDN_Denutrition-obesite_1.json': 'endo_faiblesse_musculaire_et_chutes_mme_roux.json',
    'edn_denutrition-obesite_1.json': 'endo_faiblesse_musculaire_et_chutes_mme_roux.json',
    'EDN_Dénutrition-obésité_1': 'endo_faiblesse_musculaire_et_chutes_mme_roux.json',
    'edn_dénutrition-obésité_1': 'endo_faiblesse_musculaire_et_chutes_mme_roux.json',
    'EDN_diabetetype1.json': 'endo_amaigrissement_rapide_et_odeur_acetone_mlle_garcia.json',
    'edn_diabetetype1.json': 'endo_amaigrissement_rapide_et_odeur_acetone_mlle_garcia.json',
    'EDN_diabetetype1': 'endo_amaigrissement_rapide_et_odeur_acetone_mlle_garcia.json',
    'edn_diabetetype1': 'endo_amaigrissement_rapide_et_odeur_acetone_mlle_garcia.json',
    'EDN_diabetetype1monoge.json': 'endo_hyperglycemie_familiale_sujet_jeune_m_bernard.json',
    'edn_diabetetype1monoge.json': 'endo_hyperglycemie_familiale_sujet_jeune_m_bernard.json',
    'EDN_diabetetype1monogé': 'endo_hyperglycemie_familiale_sujet_jeune_m_bernard.json',
    'edn_diabetetype1monogé': 'endo_hyperglycemie_familiale_sujet_jeune_m_bernard.json',
    'EDN_Obesite_1.json': 'endo_prise_de_poids_progressive_mme_michel.json',
    'edn_obesite_1.json': 'endo_prise_de_poids_progressive_mme_michel.json',
    'EDN_Obésité_1': 'endo_prise_de_poids_progressive_mme_michel.json',
    'edn_obésité_1': 'endo_prise_de_poids_progressive_mme_michel.json',
    'EDN_VIH.json': 'infectio_fievre_alteration_etat_general_m_andre.json',
    'edn_vih.json': 'infectio_fievre_alteration_etat_general_m_andre.json',
    'EDN_VIH': 'infectio_fievre_alteration_etat_general_m_andre.json',
    'edn_vih': 'infectio_fievre_alteration_etat_general_m_andre.json',
    'digestif_cancer_oeso_brandon.json': 'digestif_dysphagie_progressive_m_brandon.json',
    'digestif_cancer_oeso_brandon': 'digestif_dysphagie_progressive_m_brandon.json',
    'digestif_dyspepsie_elinor.json': 'digestif_pesanteur_postprandiale_mme_elinor.json',
    'digestif_dyspepsie_elinor': 'digestif_pesanteur_postprandiale_mme_elinor.json',
    'digestif_cancer_gastrique_Jiro.json': 'digestif_douleur_epigastrique_avec_anemie_m_jiro.json',
    'digestif_cancer_gastrique_jiro.json': 'digestif_douleur_epigastrique_avec_anemie_m_jiro.json',
    'digestif_cancer_gastrique_Jirō': 'digestif_douleur_epigastrique_avec_anemie_m_jiro.json',
    'digestif_cancer_gastrique_jirō': 'digestif_douleur_epigastrique_avec_anemie_m_jiro.json',
    'digestif_reflux_gastro_oesophagien_nick.json': 'digestif_pyrosis_et_regurgitations_m_nick.json',
    'digestif_reflux_gastro_oesophagien_nick': 'digestif_pyrosis_et_regurgitations_m_nick.json',
    'nephro_pyelonephrite_obstructive.json': 'nephro_fievre_et_douleur_lombaire_droite_m_ribaucourt.json',
    'nephro_pyélonéphrite_obstructive': 'nephro_fievre_et_douleur_lombaire_droite_m_ribaucourt.json',
    'nephro_varicocele.json': 'nephro_pesanteur_scrotale_gauche_m_julien.json',
    'nephro_varicocèle': 'nephro_pesanteur_scrotale_gauche_m_julien.json',
    'nephro_IRA_obstructive.json': 'nephro_anurie_et_douleur_hypogastrique_m_faure.json',
    'nephro_ira_obstructive.json': 'nephro_anurie_et_douleur_hypogastrique_m_faure.json',
    'nephro_IRA_obstructive': 'nephro_anurie_et_douleur_hypogastrique_m_faure.json',
    'nephro_ira_obstructive': 'nephro_anurie_et_douleur_hypogastrique_m_faure.json',
    'nephro_torsion_du_cordon_spermatique.json': 'nephro_douleur_testiculaire_aigue_jeune_hugo.json',
    'nephro_torsion_du_cordon_spermatique': 'nephro_douleur_testiculaire_aigue_jeune_hugo.json',
    'nephro_orchiepididymite.json': 'nephro_grosse_bourse_inflammatoire_m_antoine.json',
    'nephro_orchiépididymite': 'nephro_grosse_bourse_inflammatoire_m_antoine.json',
    'ANDRO_dysfonction_erectile_militaire.json': 'uro_troubles_erection_sujet_jeune_m_mercier.json',
    'andro_dysfonction_erectile_militaire.json': 'uro_troubles_erection_sujet_jeune_m_mercier.json',
    'andrologie_dysfonction_erectile_militaire': 'uro_troubles_erection_sujet_jeune_m_mercier.json',
    'URO_cystite_IST_chlamydia.json': 'uro_brulures_mictionnelles_et_ecoulement_m_vincent.json',
    'uro_cystite_ist_chlamydia.json': 'uro_brulures_mictionnelles_et_ecoulement_m_vincent.json',
    'urologie_cystite_IST_chlamydia': 'uro_brulures_mictionnelles_et_ecoulement_m_vincent.json',
    'urologie_cystite_ist_chlamydia': 'uro_brulures_mictionnelles_et_ecoulement_m_vincent.json',
    'URO_polyurie_diurese_osmotique_diabete.json': 'uro_polyurie_et_nycturie_profuse_m_bonnet.json',
    'uro_polyurie_diurese_osmotique_diabete.json': 'uro_polyurie_et_nycturie_profuse_m_bonnet.json',
    'urologie_polyurie_diurese_osmotique_diabete': 'uro_polyurie_et_nycturie_profuse_m_bonnet.json',
    'URO_troubles_fonctionnels_femme_jeune.json': 'uro_fuites_urinaires_a_l_effort_mme_claire.json',
    'uro_troubles_fonctionnels_femme_jeune.json': 'uro_fuites_urinaires_a_l_effort_mme_claire.json',
    'urologie_troubles_fonctionnels_femme_jeune': 'uro_fuites_urinaires_a_l_effort_mme_claire.json',
    'ORL_vertiges_hypotension_orthostatique.json': 'orl_vertiges_au_lever_mme_renaud.json',
    'orl_vertiges_hypotension_orthostatique.json': 'orl_vertiges_au_lever_mme_renaud.json',
    'orl_vertiges_hypotension_orthostatique': 'orl_vertiges_au_lever_mme_renaud.json',
    'ORL_cholesteatome.json': 'orl_otorrhee_chronique_et_vertiges_m_guillaume.json',
    'orl_cholesteatome.json': 'orl_otorrhee_chronique_et_vertiges_m_guillaume.json',
    'orl_cholesteatome': 'orl_otorrhee_chronique_et_vertiges_m_guillaume.json',
    'NEURO_vertiges_centrales.json': 'orl_instabilite_a_la_marche_post_chute_m_carpentier.json',
    'neuro_vertiges_centrales.json': 'orl_instabilite_a_la_marche_post_chute_m_carpentier.json',
    'neuro_vertiges_centrales': 'orl_instabilite_a_la_marche_post_chute_m_carpentier.json',
    'ORL_syndrome_labyrinthique.json': 'orl_grand_vertige_rotatoire_et_surdite_mme_lemoine.json',
    'orl_syndrome_labyrinthique.json': 'orl_grand_vertige_rotatoire_et_surdite_mme_lemoine.json',
    'orl_syndrome_labyrinthique': 'orl_grand_vertige_rotatoire_et_surdite_mme_lemoine.json',
    'neuro_epilepsie_generalisee_oscar.json': 'neuro_perte_de_connaissance_avec_mouvements_m_oscar.json',
    'neuro_epilepsie_generalisee_oscar': 'neuro_perte_de_connaissance_avec_mouvements_m_oscar.json',
    'neuro_epilepsie_temporale_elinordammert.json': 'neuro_episodes_amnesiques_et_deja_vu_mme_elinor.json',
    'neuro_epilepsie_temporale_elinordammert': 'neuro_episodes_amnesiques_et_deja_vu_mme_elinor.json',
    'neuro_polyneuropathie_jacques.json': 'neuro_perte_sensibilite_des_pieds_m_jacques.json',
    'neuro_polyneuropathie_jacques': 'neuro_perte_sensibilite_des_pieds_m_jacques.json',
    'neuro_crise_psychogene_JoeW.json': 'neuro_episodes_mouvements_anormaux_m_joe.json',
    'neuro_crise_psychogene_joew.json': 'neuro_episodes_mouvements_anormaux_m_joe.json',
    'neuro_crise_psychogene_JoeW': 'neuro_episodes_mouvements_anormaux_m_joe.json',
    'neuro_crise_psychogene_joew': 'neuro_episodes_mouvements_anormaux_m_joe.json',
    'neuro_epilepsie_averee_mary.json': 'neuro_crises_convulsives_repetees_mme_mary.json',
    'case_id_epilepsie_averee': 'neuro_crises_convulsives_repetees_mme_mary.json',
    'neuro_crise_convulsive_generalisee_Lexie.json': 'neuro_secousses_musculaires_et_amnesie_mlle_lexie.json',
    'neuro_crise_convulsive_generalisee_lexie.json': 'neuro_secousses_musculaires_et_amnesie_mlle_lexie.json',
    'neuro_crise_convulsive_généralisée_Lexie': 'neuro_secousses_musculaires_et_amnesie_mlle_lexie.json',
    'neuro_crise_convulsive_généralisée_lexie': 'neuro_secousses_musculaires_et_amnesie_mlle_lexie.json',
    'neuro_crise_hypoglycemique_adele.json': 'neuro_malaise_avec_confusion_et_crise_mlle_adele.json',
    'case_id_crise_hypoglycemique': 'neuro_malaise_avec_confusion_et_crise_mlle_adele.json',
    'neuro_syndrome_cordon_posterieur_Blaise.json': 'neuro_troubles_sensitifs_et_marche_instable_m_blaise.json',
    'neuro_syndrome_cordon_posterieur_blaise.json': 'neuro_troubles_sensitifs_et_marche_instable_m_blaise.json',
    'neuro_syndrome_cordon_posterieur_Blaise': 'neuro_troubles_sensitifs_et_marche_instable_m_blaise.json',
    'neuro_syndrome_cordon_posterieur_blaise': 'neuro_troubles_sensitifs_et_marche_instable_m_blaise.json',
    'neuro_syndrome_pyramidal_traumatique_aigu_Georges.json': 'neuro_faiblesse_motrice_post_traumatique_m_georges.json',
    'neuro_syndrome_pyramidal_traumatique_aigu_georges.json': 'neuro_faiblesse_motrice_post_traumatique_m_georges.json',
    'syndrome_pyramidal_traumatique_aigu': 'neuro_faiblesse_motrice_post_traumatique_m_georges.json',
    'neuro_syndrome_pyramidal_vasculaire_ThatcherG.json': 'neuro_deficit_moteur_droit_brutal_m_thatcher.json',
    'neuro_syndrome_pyramidal_vasculaire_thatcherg.json': 'neuro_deficit_moteur_droit_brutal_m_thatcher.json',
    'neuro_syndrome_pyramidal_vasculaire_ThatcherG': 'neuro_deficit_moteur_droit_brutal_m_thatcher.json',
    'neuro_syndrome_pyramidal_vasculaire_thatcherg': 'neuro_deficit_moteur_droit_brutal_m_thatcher.json',
    'neuro_syndrome_sensitif_central_cordons_posterieurs_MarieC.json': 'neuro_perte_equilibre_dans_obscurite_mme_marie.json',
    'neuro_syndrome_sensitif_central_cordons_posterieurs_mariec.json': 'neuro_perte_equilibre_dans_obscurite_mme_marie.json',
    'neuro_syndrome_sensitif_central_cordons_postérieurs_MarieC': 'neuro_perte_equilibre_dans_obscurite_mme_marie.json',
    'neuro_syndrome_sensitif_central_cordons_postérieurs_mariec': 'neuro_perte_equilibre_dans_obscurite_mme_marie.json',
    'neuro_syndrome_sensitif_peripherique_diabetique_bobR.json': 'neuro_paresthesies_distales_des_pieds_m_bob.json',
    'neuro_syndrome_sensitif_peripherique_diabetique_bobr.json': 'neuro_paresthesies_distales_des_pieds_m_bob.json',
    'neuro_syndrome_sensitif_peripherique_diabetique_bobR': 'neuro_paresthesies_distales_des_pieds_m_bob.json',
    'neuro_syndrome_sensitif_peripherique_diabetique_bobr': 'neuro_paresthesies_distales_des_pieds_m_bob.json',
    'locomoteur_arthrite_Mirko.json': 'locomoteur_gonflement_articulaire_douloureux_genou_m_mirko.json',
    'locomoteur_arthrite_mirko.json': 'locomoteur_gonflement_articulaire_douloureux_genou_m_mirko.json',
    'locomoteur_arthrite_Mirko': 'locomoteur_gonflement_articulaire_douloureux_genou_m_mirko.json',
    'locomoteur_arthrite_mirko': 'locomoteur_gonflement_articulaire_douloureux_genou_m_mirko.json',
    'locomoteur_lomboradiculalgie_robert.json': 'locomoteur_douleur_lombaire_irradiant_fesse_m_robert.json',
    'locomoteur_lomboradiculalgie_robert': 'locomoteur_douleur_lombaire_irradiant_fesse_m_robert.json',
    'locomoteur_tendinopathie_lisa.json': 'locomoteur_douleur_anterieure_epaule_mlle_lisa.json',
    'locomoteur_tendinopathie_lisa': 'locomoteur_douleur_anterieure_epaule_mlle_lisa.json',
    'locomoteur_sciatiqueL5.json': 'locomoteur_douleur_trajet_l5_externe_m_chevalier.json',
    'locomoteur_sciatiquel5.json': 'locomoteur_douleur_trajet_l5_externe_m_chevalier.json',
    'case_sciatique_01': 'locomoteur_douleur_trajet_l5_externe_m_chevalier.json',
    'locomoteur_scoliose.json': 'locomoteur_deformation_du_rachis_adolescente_emma.json',
    'case_scoliose_01': 'locomoteur_deformation_du_rachis_adolescente_emma.json',
    'locomoteur_canal_lombaire.json': 'locomoteur_claudication_radiculaire_a_la_marche_m_perrot.json',
    'case_canal_lombaire_02': 'locomoteur_claudication_radiculaire_a_la_marche_m_perrot.json',
    'locomoteur_epaule_arthrose_gleno_humerale_complete.json': 'locomoteur_enraidissement_douloureux_epaule_mme_aubry.json',
    'epaule_arthrose_gleno_humerale_complete': 'locomoteur_enraidissement_douloureux_epaule_mme_aubry.json',
    'locomoteur_epaule_capsulite.json': 'locomoteur_blocage_passif_et_actif_epaule_mme_boucher.json',
    'epaule_capsulite': 'locomoteur_blocage_passif_et_actif_epaule_mme_boucher.json',
    'locomoteur_epaule_luxation_anterieure_complete.json': 'locomoteur_traumatisme_epaule_signe_epaulette_m_lefevre.json',
    'epaule_luxation_antérieure_complete': 'locomoteur_traumatisme_epaule_signe_epaulette_m_lefevre.json',
    'locomoteur_epaule_tendinopathie_coiffe.json': 'locomoteur_douleur_epaule_accrochage_m_gerard.json',
    'epaule_tendinopathie_coiffe': 'locomoteur_douleur_epaule_accrochage_m_gerard.json',
    'locomoteur_racHialgie.json': 'locomoteur_rachialgie_post_effort_m_francois.json',
    'locomoteur_rachialgie.json': 'locomoteur_rachialgie_post_effort_m_francois.json',
    'case_rachialgie_inflammatoire_DFGSM3': 'locomoteur_rachialgie_post_effort_m_francois.json',
    'case_rachialgie_inflammatoire_dfgsm3': 'locomoteur_rachialgie_post_effort_m_francois.json',
    'GYNECO_test_etat_de_choc.json': 'gyneco_metrorragies_et_douleur_pelvienne_mme_sophie.json',
    'gyneco_test_etat_de_choc.json': 'gyneco_metrorragies_et_douleur_pelvienne_mme_sophie.json',
    'GYNECO_test_etat_de_choc': 'gyneco_metrorragies_et_douleur_pelvienne_mme_sophie.json',
    'gyneco_test_etat_de_choc': 'gyneco_metrorragies_et_douleur_pelvienne_mme_sophie.json',
    'pneumo_1.json': 'pneumo_dyspnee_d_effort_et_toux_m_lemoine.json',
    'pneumo_1': 'pneumo_dyspnee_d_effort_et_toux_m_lemoine.json',
    'urgence_choc_anaphylactique_01.json': 'urgence_detresse_respiratoire_post_piqure_m_colin.json',
    'urgence_choc_anaphylactique_01': 'urgence_detresse_respiratoire_post_piqure_m_colin.json',
    'urgence_demo_acr.json': 'urgence_inconscience_sans_pouls_adulte_m_duval.json',
    'urgence_demo_acr': 'urgence_inconscience_sans_pouls_adulte_m_duval.json',
    'urgence_demo_hemorragie.json': 'urgence_plaie_hemorragique_pulsatile_cuisse_m_renoir.json',
    'urgence_demo_hemorragie': 'urgence_plaie_hemorragique_pulsatile_cuisse_m_renoir.json',
    'urgence_demo_obstruction.json': 'urgence_etouffement_brutal_au_repas_m_marceau.json',
    'urgence_demo_obstruction': 'urgence_etouffement_brutal_au_repas_m_marceau.json',
    'urgence_demo_inconscient.json': 'urgence_coma_calme_voie_publique_m_gauthier.json',
    'urgence_demo_inconscient': 'urgence_coma_calme_voie_publique_m_gauthier.json',
    'urgence_demo_brulure.json': 'urgence_brulure_chimique_bras_m_brun.json',
    'urgence_demo_brulure': 'urgence_brulure_chimique_bras_m_brun.json',
    'urgence_demo_malaise.json': 'urgence_oppression_thoracique_angoissante_m_masson.json',
    'urgence_demo_malaise': 'urgence_oppression_thoracique_angoissante_m_masson.json',
    'urgence_choc_hemorragique_art_membre.json': 'urgence_plaie_arterielle_membre_inferieur_m_picard.json',
    'urgence_urg_01': 'urgence_plaie_arterielle_membre_inferieur_m_picard.json',
    'urgence_brulure_thermique_etendue.json': 'urgence_brulure_eau_bouillante_tronc_mme_lucas.json',
    'urgence_urg_02': 'urgence_brulure_eau_bouillante_tronc_mme_lucas.json',
    'urgence_arret_cardiaque_sportive.json': 'urgence_effondrement_brutal_terrain_sport_mlle_clara.json',
    'urgence_urg_03': 'urgence_effondrement_brutal_terrain_sport_mlle_clara.json',
    'urgence_obstruction_voa_nourrisson.json': 'urgence_cyanose_et_toux_inefficace_nourrisson_leo.json',
    'urgence_urg_04': 'urgence_cyanose_et_toux_inefficace_nourrisson_leo.json',
    'urgence_noyade_piscine.json': 'urgence_submersion_et_troubles_conscience_jeune_alex.json',
    'urgence_urg_06': 'urgence_submersion_et_troubles_conscience_jeune_alex.json',
    'urgence_malaise_traumatisme_rachidien.json': 'urgence_accident_voie_publique_cervicalgie_m_marchand.json',
    'urgence_urg_07': 'urgence_accident_voie_publique_cervicalgie_m_marchand.json',
    'urgence_trauma_cranien_grave.json': 'urgence_chute_velo_traumatisme_cranien_m_rolland.json',
    'urgence_trauma_cranien_grave': 'urgence_chute_velo_traumatisme_cranien_m_rolland.json',
    'urgence_obstruction_voa_adulte_restaurant.json': 'urgence_asphyxie_aigue_au_restaurant_m_prevost.json',
    'urgence_obstruction_voa_adulte_restaurant': 'urgence_asphyxie_aigue_au_restaurant_m_prevost.json',
    'urgence_inconscient_pls_bar.json': 'urgence_coma_ethylique_inconscient_voie_publique_m_fabre.json',
    'urgence_inconscient_pls_bar': 'urgence_coma_ethylique_inconscient_voie_publique_m_fabre.json',
    'urgence_trauma_membre_amputation.json': 'urgence_amputation_traumatique_doigt_m_blanchard.json',
    'urgence_trauma_membre_amputation': 'urgence_amputation_traumatique_doigt_m_blanchard.json',
    'urgence_choc_septique_pediatrique.json': 'urgence_lethargie_et_purpura_enfant_noah.json',
    'urgence_choc_septique_pediatrique': 'urgence_lethargie_et_purpura_enfant_noah.json',
    'urgence_asthme_aigu_grave.json': 'urgence_detresse_respiratoire_aigue_majeure_mme_besson.json',
    'urgence_asthme_aigu_grave': 'urgence_detresse_respiratoire_aigue_majeure_mme_besson.json',
    'urgence_overdose_opiaces.json': 'urgence_coma_hypoventilation_myosis_m_fleury.json',
    'urgence_overdose_opiaces': 'urgence_coma_hypoventilation_myosis_m_fleury.json',
    'urgence_convulsion_febrile_nourrisson.json': 'urgence_convulsions_febriles_nourrisson_louis.json',
    'urgence_convulsion_febrile_nourrisson': 'urgence_convulsions_febriles_nourrisson_louis.json',
    'urgence_accouchement_inopine.json': 'urgence_contractions_rapprochees_expulsion_mme_barbier.json',
    'urgence_accouchement_inopine': 'urgence_contractions_rapprochees_expulsion_mme_barbier.json'
};

function lazyLoadCase(file) {
    const resolvedFile = LEGACY_CASE_ALIASES[file] || file;
    const cacheKey = `case_${resolvedFile}`;
    const cached = caseLoaderCache.get(cacheKey) || caseLoaderCache.getFromLocalStorage(cacheKey);
    if (cached) return Promise.resolve(cached);

    return fetch(`data/${resolvedFile}`)
        .then(res => {
            if (!res.ok) {
                // If resolved file fails, try original file as fallback
                if (resolvedFile !== file) {
                    return fetch(`data/${file}`);
                }
                throw new Error(`Fichier ${resolvedFile} introuvable`);
            }
            return res;
        })
        .then(res => {
            if (!res.ok) throw new Error(`Fichier ${file} introuvable`);
            return res.json();
        })
        .then(data => {
            caseLoaderCache.set(cacheKey, data);
            return data;
        });
}

async function loadCasesMetadata() {
    const cacheKey = 'case_index';
    const cached = caseLoaderCache.get(cacheKey) || caseLoaderCache.getFromLocalStorage(cacheKey);
    if (cached) return cached;

    const response = await fetch('data/case-index.json');
    if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
    const data = await response.json();
    caseLoaderCache.set(cacheKey, data);
    return data;
}

/**
 * Charge les cas cliniques depuis Supabase, localStorage ou fichiers JSON locaux.
 * Gère le mode preview, la sélection par thèmes, et le fallback local.
 *
 * @async
 * @returns {Promise<Array<Object>>} Liste des cas cliniques chargés
 */
async function loadCasesData() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Auto-start case via case query parameter
        const caseParam = urlParams.get('case');
        if (caseParam) {
            if (typeof supabase !== 'undefined' && !caseParam.endsWith('.json')) {
                try {
                    const { data, error } = await supabase
                        .from('cases')
                        .select('*')
                        .eq('id', caseParam)
                        .single();

                    if (!error && data) {
                        const content = data.content;
                        if (!content.id) content.id = data.id;
                        return [content];
                    }
                } catch (err) {
                    console.warn("Supabase single fetch failed from query param", err);
                }
            }

            // Fallback local
            const caseData = await lazyLoadCase(caseParam.endsWith('.json') ? caseParam : `${caseParam}.json`);
            return [caseData];
        }

        // Preview Mode check
        if (urlParams.get('preview') === 'true') {
            const previewData = sessionStorage.getItem('previewCase');
            if (previewData) {
                const backBtn = document.createElement('button');
                backBtn.innerHTML = '<i class="fas fa-edit"></i> Quitter l\'aperçu / Modifier';
                backBtn.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1000;
                    background: #a020f0;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 30px;
                    font-family: inherit;
                    font-weight: bold;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    transition: all 0.3s;
                `;
                backBtn.onmouseover = () => backBtn.style.transform = 'scale(1.05)';
                backBtn.onmouseout = () => backBtn.style.transform = 'scale(1)';
                backBtn.onclick = () => window.location.href = 'editor.html';
                document.body.appendChild(backBtn);

                return [JSON.parse(previewData)];
            }
        }

        // 1. HYBRID FETCH (Supabase and Local cases)
        const selectedCaseFiles = JSON.parse(localStorage.getItem('selectedCaseFiles'));
        if (selectedCaseFiles && Array.isArray(selectedCaseFiles) && selectedCaseFiles.length > 0) {
            const dbIds = selectedCaseFiles.filter(f => !f.endsWith('.json'));
            const localFiles = selectedCaseFiles.filter(f => f.endsWith('.json'));

            let dbCases = [];
            if (dbIds.length > 0 && typeof supabase !== 'undefined') {
                try {
                    const { data, error } = await supabase
                        .from('cases')
                        .select('*')
                        .in('id', dbIds);

                    if (!error && data) {
                        dbCases = data.map(c => {
                            const content = c.content;
                            if (!content.id) content.id = c.id;
                            return content;
                        });
                    }
                } catch (err) {
                    console.warn("Supabase fetch failed during multi-load", err);
                }
            }

            // Pour tout ID de base non trouvé (ex. s'il s'agit d'un repli ou erreur réseau), on tente de le charger localement
            const loadedDbIds = dbCases.map(c => c.id);
            const missingDbIds = dbIds.filter(id => !loadedDbIds.includes(id));
            const allLocalFilesToLoad = [...localFiles, ...missingDbIds.map(id => id.endsWith('.json') ? id : `${id}.json`)];

            let localCases = [];
            if (allLocalFilesToLoad.length > 0) {
                try {
                    const results = await Promise.allSettled(allLocalFilesToLoad.map(lazyLoadCase));
                    localCases = results
                        .filter(r => r.status === 'fulfilled' && r.value !== null)
                        .map(r => r.value);
                } catch (err) {
                    console.warn("Local files load failed", err);
                }
            }

            // Reconstituer l'array final dans l'ordre d'origine
            const mergedCases = [];
            selectedCaseFiles.forEach(fileOrId => {
                const normalizedId = fileOrId.replace('.json', '');
                // Chercher d'abord dans les cas Supabase
                const dbCase = dbCases.find(c => c.id === normalizedId || c.id === fileOrId);
                if (dbCase) {
                    mergedCases.push(dbCase);
                } else {
                    // Chercher dans les cas locaux
                    const localCase = localCases.find(c => {
                        const cId = c.id || '';
                        return cId.toLowerCase() === normalizedId.toLowerCase() || cId.toLowerCase() === fileOrId.toLowerCase();
                    });
                    if (localCase) {
                        mergedCases.push(localCase);
                    }
                }
            });

            if (mergedCases.length > 0) {
                // NOTE : la sélection n'est PAS purgée ici — elle est conservée
                // pour la reprise de session (SessionSnapshot). Elle est purgée
                // par SessionSnapshot.clearFullSession() en fin de session.
                return mergedCases;
            }
        }

        // 2. Single case (with cache)
        const selectedCaseFile = localStorage.getItem('selectedCaseFile');
        if (selectedCaseFile) {
            // Si Supabase est dispo et que c'est un ID sans extension, tenter Supabase d'abord
            if (typeof supabase !== 'undefined' && !selectedCaseFile.endsWith('.json')) {
                try {
                    const { data, error } = await supabase
                        .from('cases')
                        .select('*')
                        .eq('id', selectedCaseFile)
                        .single();

                    if (!error && data) {
                        const content = data.content;
                        if (!content.id) content.id = data.id;
                        // Sélection conservée pour la reprise de session (voir SessionSnapshot)
                        return [content];
                    }
                } catch (err) {
                    console.warn("Supabase single fetch failed", err);
                }
            }

            // Fallback local
            const caseData = await lazyLoadCase(selectedCaseFile.endsWith('.json') ? selectedCaseFile : `${selectedCaseFile}.json`);
            // Sélection conservée pour la reprise de session (voir SessionSnapshot)
            return [caseData];
        }

        // Themes fallback
        let selectedThemes = [];
        try {
            selectedThemes = JSON.parse(localStorage.getItem('selectedThemes')) || [];
        } catch {}
        if (!Array.isArray(selectedThemes) || selectedThemes.length === 0) {
            selectedThemes = ['cardiologie'];
        }

        const caseIndex = await loadCasesMetadata();

        let caseFiles = [];
        selectedThemes.forEach(theme => {
            const themeLower = theme.toLowerCase();
            if (caseIndex[themeLower]) {
                caseFiles = caseFiles.concat(caseIndex[themeLower]);
            }
        });

        if (caseFiles.length === 0) {
            throw new Error('Aucun cas disponible pour les thèmes sélectionnés');
        }

        const results = await Promise.allSettled(caseFiles.map(lazyLoadCase));
        const cases = results
            .filter(r => r.status === 'fulfilled' && r.value !== null)
            .map(r => r.value);

        if (cases.length < caseFiles.length) {
            console.warn(`${caseFiles.length - cases.length} cas n'ont pas pu être chargés`);
        }

        if (cases.length === 0) {
            throw new Error('Aucun cas disponible');
        }

        return cases;
    } catch (error) {
        console.error('Erreur lors du chargement des cas :', error);
        showNotification('Erreur lors du chargement des cas cliniques : ' + error.message);
        return [];
    }
}
