import fs from 'fs/promises';
import path from 'path';

function getFriendlySubjectName(fieldPath) {
    const cleanPath = (fieldPath || '').replace(/^interrogatoire\./, '');
    const mapping = {
        'motifHospitalisation': 'le motif de votre venue / pourquoi vous consultez',
        'histoireMaladie.debutSymptomes': 'quand vos symptômes ont commencé / depuis combien de temps vous souffrez',
        'histoireMaladie.symptomesActuels': 'la description de vos symptômes actuels',
        'histoireMaladie.descriptionDouleur': 'la description précise de votre douleur (où, comment, intensité)',
        'histoireMaladie.evolution': 'l\'évolution de vos symptômes dans le temps',
        'histoireMaladie.facteursDeclenchants': 'ce qui déclenche ou aggrave vos symptômes (effort, position, repas)',
        'histoireMaladie.facteursCalmants': 'ce qui calme ou soulage vos symptômes (repos, position, médicaments)',
        'histoireMaladie.symptomesAssocies': 'vos signes associés (sueurs, nausées, vertiges, essoufflement, fièvre)',
        'histoireMaladie.remarques': 'vos remarques personnelles ou inquiétudes particulières',
        'antecedents.medicaux': 'vos antécédents médicaux / maladies connues',
        'antecedents.chirurgicaux': 'vos opérations chirurgicales passées',
        'antecedents.familiaux': 'les maladies présentes dans votre famille (père, mère, fratrie)',
        'traitements': 'vos médicaments habituels / ordonnance quotidienne / automédication',
        'allergies': 'vos allergies connues (médicaments, aliments, pollen)',
        'modeDeVie.tabac': 'votre consommation de tabac',
        'modeDeVie.alcool': 'votre consommation d\'alcool',
        'modeDeVie.activitePhysique': 'votre activité physique ou sportive',
        'modeDeVie.alimentation': 'vos habitudes alimentaires',
        'modeDeVie.emploi': 'votre profession, vos conditions de travail et votre niveau de stress'
    };
    return mapping[cleanPath] || cleanPath;
}

const EXAM_TIME_COST_SECONDS = 60;
const CLINICAL_GESTURE_TIME_COST_SECONDS = 15;
const DIAGNOSTIC_TYPO_SIMILARITY = 0.88;

function normalizeText(text) {
    if (!text) return '';
    return String(text)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getLevenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

function getSimilarity(a, b) {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return 1 - getLevenshteinDistance(a, b) / maxLen;
}

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

// Mapping enrichi des gestes cliniques réalisables au cabinet
const GESTURE_TO_SECTION = {
    'auscultation_card': 'examenCardiovasculaire',
    'auscultation_pulm': 'examenPulmonaire',
    'palpation_abdo': 'examenAbdominal',
    'reflex_osteo': 'examenNeurologique',
    'examen_neuro': 'examenNeurologique',
    'examen_orl': 'examenORL',
    'examen_cutane': 'examenCutane',
    'examen_locomoteur': 'examenLocomoteur',
    'examen_uro_gyneco': 'examenUroGyneco',
    'prise_constantes': 'constantes',
    'inspection': 'aspectGeneral'
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

export class MedGameEngine {
    constructor(config = {}) {
        this.apiKey = config.apiKey || process.env.LLM_API_KEY || '';
        this.apiUrl = config.apiUrl || process.env.LLM_API_URL || 'https://api.deepseek.com/chat/completions';
        this.model = config.model || process.env.LLM_MODEL || 'deepseek-chat';
        this.resetState();
    }

    resetState() {
        this.caseData = null;
        this.startedAt = null;
        this.timeLimit = 480;
        this.timePenalties = 0;
        this.baseVitals = {};
        this.vitals = {};
        this.painLevel = 0;
        this.baseAnxiety = 50;

        // Dynamique émotionnelle et relationnelle du patient
        this.patientState = {
            anxiety: 45,       // 0 (serein) à 100 (panique totale)
            trust: 55,         // 0 (hostile/mutique) à 100 (confiance absolue)
            patience: 80,      // Diminue si questions répétitives ou jargon
            emotionalTone: 'inquiet',
            insistenceCount: {} // Compte combien de fois un sujet caché est abordé
        };

        // Métriques de communication médicale (Grille ECOS)
        this.communicationMetrics = {
            empathyCount: 0,
            jargonPenalties: 0,
            openQuestions: 0,
            closedQuestions: 0,
            reassuranceGiven: false
        };

        this.activeExams = [];
        this.selectedTreatments = [];
        this.selectedDiagnostic = '';
        this.diagnosticLocked = false;
        this.attempts = 0;
        this.score = 0;
        this.lastEvaluation = null;
        this.chatHistory = [];
        this.isFinished = false;
        this.fatalErrorTriggered = false;
        this.requestedCaseId = null;

        this.demarche = {
            interrogatoireAsked: new Set(),
            examsOrdered: [],
            clinicalGestures: new Set(),
            interviewQuestionsDisclosed: new Set(),
            clinicalExamsViewed: new Set(),
            orderedExams: new Set(),
            prescribedTreatments: new Set(),
            locksUnlocked: new Set()
        };

        this.lockAttempts = {};
    }

    async listCases() {
        const caseIndexPath = path.join(process.cwd(), 'data', 'case-index.json');
        try {
            const data = await fs.readFile(caseIndexPath, 'utf-8');
            return JSON.parse(data);
        } catch (err) {
            throw new Error(`Failed to load case index from ${caseIndexPath}: ${err.message}`);
        }
    }

    async startCase(caseId) {
        this.resetState();

        const safeCaseId = path.basename(caseId);
        let filename = safeCaseId.endsWith('.json') ? safeCaseId : `${safeCaseId}.json`;
        if (LEGACY_CASE_ALIASES[safeCaseId]) {
            this.requestedCaseId = safeCaseId.replace(/\.json$/i, '');
            filename = LEGACY_CASE_ALIASES[safeCaseId];
        } else if (LEGACY_CASE_ALIASES[filename]) {
            this.requestedCaseId = safeCaseId.replace(/\.json$/i, '');
            filename = LEGACY_CASE_ALIASES[filename];
        }

        let casePath = path.join(process.cwd(), 'data', filename);
        try {
            const data = await fs.readFile(casePath, 'utf-8');
            this.caseData = JSON.parse(data);
        } catch (err) {
            const alias = LEGACY_CASE_ALIASES[safeCaseId] || LEGACY_CASE_ALIASES[filename];
            if (alias && alias !== filename) {
                try {
                    casePath = path.join(process.cwd(), 'data', alias);
                    const data = await fs.readFile(casePath, 'utf-8');
                    this.caseData = JSON.parse(data);
                } catch (fallbackErr) {
                    throw new Error(`Failed to load case ${caseId} at path ${casePath}: ${fallbackErr.message}`);
                }
            } else {
                throw new Error(`Failed to load case ${caseId} at path ${casePath}: ${err.message}`);
            }
        }

        this.startedAt = Date.now();

        if (this.caseData.gameplayConfig?.timeLimit) {
            this.timeLimit = this.caseData.gameplayConfig.timeLimit;
        } else if (this.caseData.vitalsDynamics?.urgencyMultiplier > 1.8) {
            this.timeLimit = 300;
        } else {
            this.timeLimit = 480;
        }

        // Initialisation des constantes
        const constantes = this.caseData.examenClinique?.constantes || {};
        const bpMatch = (constantes.tension || '').match(/(\d+)\/(\d+)/);

        this.baseVitals = {
            systolic: bpMatch ? parseInt(bpMatch[1]) : 120,
            diastolic: bpMatch ? parseInt(bpMatch[2]) : 80,
            heartRate: parseInt(constantes.pouls) || 80,
            spo2: parseInt(constantes.saturationO2) || 98,
            temperature: parseFloat(constantes.temperature) || 37.0,
            respiratoryRate: parseInt(constantes.frequenceRespiratoire) || 16
        };

        // Initialisation de la douleur et du persona émotionnel depuis le JSON
        const persona = this.caseData.patient?.persona || {};
        this.patientState.anxiety = persona.anxiete !== undefined ? persona.anxiete : 50;
        this.baseAnxiety = this.patientState.anxiety;
        this.patientState.trust = persona.confiance !== undefined ? persona.confiance : 55;
        this.patientState.emotionalTone = persona.ton || this.caseData.patient?.comportement || 'inquiet';

        const evaMatch = JSON.stringify(this.caseData.interrogatoire || {}).match(/EVA\s*[:=]?\s*(\d+)/i);
        this.painLevel = evaMatch ? Math.min(10, parseInt(evaMatch[1])) : 3;

        this.updateVitals();

        // Priorité d'ouverture : dialogue.phraseOuverture > ecos.consignesPatient.phraseOuverture > fallback
        const patient = this.caseData.patient || {};
        const nom = `${patient.prenom || ''} ${patient.nom || 'le patient'}`.trim();
        const ecosData = this.caseData.ecos?.consignesPatient || this.caseData.ecos?.patientStandardise;
        const dialogueRoot = this.caseData.dialogue;

        let intro = '';
        if (dialogueRoot?.phraseOuverture) {
            intro = dialogueRoot.phraseOuverture;
        } else if (ecosData?.phraseOuverture) {
            intro = ecosData.phraseOuverture;
        } else {
            const motif = this.caseData.interrogatoire?.motifHospitalisation || this.caseData.motif || '';
            intro = motif
                ? `Bonjour docteur... Je viens vous voir pour ${motif.toLowerCase()}.`
                : `Bonjour docteur, je suis ${nom}.`;
        }

        this.chatHistory.push({ role: 'assistant', content: intro });
        return this.getState();
    }

    updateVitals() {
        if (!this.caseData) return;
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - this.startedAt) / 1000) + this.timePenalties;

        const dyn = this.caseData.vitalsDynamics || {};
        const trendOverMinutes = dyn.trendOverMinutes || 0.08;
        const targets = dyn.aggravationTargets || {};

        const minutesElapsed = elapsedSeconds / 60;
        let trendFraction = minutesElapsed * trendOverMinutes;

        const correctTreatments = this.caseData.correctTreatments || [];
        const isStabilized = this.selectedTreatments.some(t => correctTreatments.includes(t));

        if (isStabilized && dyn.stabilizeOnCorrectTreatment !== false) {
            trendFraction = Math.max(0, trendFraction - (minutesElapsed * 0.12));
        }

        trendFraction = Math.min(1.0, Math.max(0.0, trendFraction));

        // Impact de la variation d'anxiété par rapport à la valeur de base (couplage psycho-physiologique dynamique)
        const anxietyShift = this.patientState.anxiety - (this.baseAnxiety !== undefined ? this.baseAnxiety : 50);
        const anxietyDeltaHR = Math.round((anxietyShift / 50) * 8);
        const anxietyDeltaRR = Math.round((anxietyShift / 50) * 2);

        const currentVitals = {};
        for (const key of ['heartRate', 'systolic', 'diastolic', 'spo2', 'temperature', 'respiratoryRate']) {
            const base = this.baseVitals[key];
            const target = targets[key] !== undefined ? targets[key] : base;

            let val = base + (target - base) * trendFraction;

            if (key === 'heartRate') val += anxietyDeltaHR;
            if (key === 'respiratoryRate') val += anxietyDeltaRR;

            const cycle = key === 'heartRate' || key === 'respiratoryRate' ? 5 : 8;
            const phase = Math.sin((elapsedSeconds % cycle) / cycle * Math.PI * 2);
            const physioAmplitude = key === 'temperature' ? 0.05 : base * 0.012;
            val += phase * physioAmplitude;

            if (key === 'temperature') {
                currentVitals[key] = Math.round(val * 10) / 10;
            } else if (key === 'spo2') {
                currentVitals[key] = Math.min(100, Math.max(40, Math.round(val)));
            } else {
                currentVitals[key] = Math.max(0, Math.round(val));
            }
        }
        this.vitals = currentVitals;
    }

    getTimeLeft() {
        if (!this.startedAt) return 0;
        const elapsed = Math.floor((Date.now() - this.startedAt) / 1000) + this.timePenalties;
        return Math.max(0, this.timeLimit - elapsed);
    }

    getState() {
        if (!this.caseData) {
            return { success: false, error: "No case active" };
        }

        if (this.getTimeLeft() === 0 && !this.isFinished && this.startedAt) {
            this.submit();
        }

        this.updateVitals();

        const locks = (this.caseData.locks || []).map(l => {
            const isUnlocked = this.demarche.locksUnlocked.has(l.id);
            return {
                id: l.id,
                unlocked: isUnlocked,
                targetFields: l.target_fields,
                prerequisites: l.prerequisites || [],
                type: l.type,
                challenge: {
                    question: l.challenge?.question,
                    options: l.challenge?.options
                }
            };
        });

        const examResults = {};
        for (const exam of this.activeExams) {
            const fieldPath = `examResults.${exam}`;
            if (this.isFieldLocked(fieldPath)) {
                examResults[exam] = "🔒 [Verrouillé - Résolvez le défi sémiologique correspondant]";
            } else {
                examResults[exam] = this.caseData.examResults?.[exam] || "Résultat normal ou non significatif.";
            }
        }

        let availableDiagnostics = this.caseData.possibleDiagnostics || [];
        if (this.isFieldLocked('possibleDiagnostics')) {
            availableDiagnostics = ["🔒 [Verrouillé - Résolvez le défi sémiologique correspondant]"];
        }

        let availableTreatments = this.caseData.possibleTreatments || [];
        if (this.isFieldLocked('possibleTreatments')) {
            availableTreatments = ["🔒 [Verrouillé - Résolvez le défi sémiologique correspondant]"];
        }

        return {
            success: true,
            caseId: this.caseData.id,
            caseTitle: this.caseData.motif || this.caseData.ecos?.titre || this.caseData.titre || this.caseData.id,
            motif: this.caseData.motif || this.caseData.ecos?.titre || this.caseData.interrogatoire?.motifHospitalisation || '',
            specialty: this.caseData.specialite,
            difficulty: this.caseData.difficulty || 1,
            patient: {
                nom: this.caseData.patient?.nom,
                prenom: this.caseData.patient?.prenom,
                age: this.caseData.patient?.age,
                sexe: this.caseData.patient?.sexe,
                taille: this.caseData.patient?.taille,
                poids: this.caseData.patient?.poids,
                groupeSanguin: this.caseData.patient?.groupeSanguin,
                emotionalState: { ...this.patientState, painLevel: this.painLevel }
            },
            vitals: this.vitals,
            locks: locks,
            activeExams: this.activeExams,
            examResults: examResults,
            prescriptions: {
                selectedTreatments: this.selectedTreatments
            },
            availableDiagnostics: availableDiagnostics,
            availableTreatments: availableTreatments,
            availableExams: this.caseData.availableExams || [],
            score: this.score || 0,
            attempts: this.attempts,
            diagnosticLocked: this.diagnosticLocked,
            fatalErrorTriggered: this.fatalErrorTriggered,
            chatHistory: this.chatHistory,
            isFinished: this.isFinished,
            scoreBreakdown: this.isFinished ? (this.lastEvaluation || { score: this.score || 0 }) : null,
            timeLeft: this.getTimeLeft()
        };
    }

    isFieldLocked(fieldPath) {
        if (!this.caseData?.locks) return false;
        for (const lock of this.caseData.locks) {
            if (lock.target_fields.includes(fieldPath) && !this.demarche.locksUnlocked.has(lock.id)) {
                return true;
            }
        }
        return false;
    }

    getLockStatus(lock) {
        if (this.demarche.locksUnlocked.has(lock.id)) {
            return { canUnlock: true, missingPrereqs: [] };
        }
        const prereqs = lock.prerequisites || [];
        const missingPrereqs = prereqs.filter(pId => !this.demarche.locksUnlocked.has(pId));
        return {
            canUnlock: missingPrereqs.length === 0,
            missingPrereqs
        };
    }

    /**
     * Parsing multi-intentions par mots-clés d'anamnèse
     */
    trackInterrogatoireByKeywords(text) {
        const q = normalizeText(text);

        const keywordMapping = [
            { path: 'interrogatoire.modeDeVie.activitePhysique.description', keywords: ['sport', 'physique', 'activite', 'marche', 'exercice', 'sedentaire', 'courir'] },
            { path: 'interrogatoire.modeDeVie.tabac', keywords: ['tabac', 'fume', 'cigarette', 'clope', 'fumeur', 'paquet', 'vapot'] },
            { path: 'interrogatoire.modeDeVie.alcool.quantite', keywords: ['alcool', 'boire', 'boisson', 'verre', 'vin', 'biere', 'apero', 'spiritueux'] },
            { path: 'interrogatoire.modeDeVie.alimentation', keywords: ['mange', 'repas', 'alimentation', 'regime', 'appetit', 'poids', 'faim', 'soif', 'hydrat'] },
            { path: 'interrogatoire.modeDeVie.emploi', keywords: ['travail', 'metier', 'profession', 'stress', 'emploi', 'boulot', 'bureau', 'retraite', 'etudiant'] },
            { path: 'interrogatoire.antecedents.medicaux', keywords: ['antecedent', 'maladie', 'hospitalise', 'medicaux', 'sante', 'probleme de sante', 'suivi pour', 'chronique', 'diabete', 'hypertension', 'asthme'] },
            { path: 'interrogatoire.antecedents.chirurgicaux', keywords: ['operation', 'chirurgie', 'opere', 'chirurgicaux', 'anesthesie', 'cicatrice', 'appendicite'] },
            { path: 'interrogatoire.antecedents.familiaux', keywords: ['famille', 'parent', 'pere', 'mere', 'familiaux', 'frere', 'soeur', 'hereditaire', 'dc', 'decede'] },
            { path: 'interrogatoire.traitements', keywords: ['traitement', 'medicament', 'ordonnance', 'prends', 'prenez', 'comprime', 'pilule', 'cachet', 'automedication'] },
            { path: 'interrogatoire.allergies', keywords: ['allergie', 'allergique', 'intolerance', 'penicilline', 'reaction'] },
            { path: 'interrogatoire.histoireMaladie.debutSymptomes', keywords: ['quand', 'debut', 'depuis', 'commence', 'combien de temps', 'apparition', 'heure', 'brutal', 'progressif'] },
            { path: 'interrogatoire.histoireMaladie.descriptionDouleur', keywords: ['douleur', 'mal', 'poitrine', 'thoracique', 'type', 'constrictive', 'ou avez vous', 'montrez', 'irradie', 'lance', 'brule', 'serre', 'intensite', 'echelle', '1 a 10'] },
            { path: 'interrogatoire.histoireMaladie.evolution', keywords: ['evolution', 'evolue', 'aggrave', 'stable', 'pire', 'mieux', 'constant', 'intermittent', 'crise'] },
            { path: 'interrogatoire.histoireMaladie.facteursDeclenchants', keywords: ['declenche', 'provoque', 'effort', 'position', 'allonge', 'debout', 'inspiration', 'toux', 'mouvement'] },
            { path: 'interrogatoire.histoireMaladie.facteursCalmants', keywords: ['calme', 'soulage', 'repos', 'penche', 'antalgique', 'doliprane', 'passe quand'] },
            { path: 'interrogatoire.histoireMaladie.symptomesAssocies', keywords: ['associe', 'autre', 'accompagne', 'dyspnee', 'essouffle', 'fievre', 'frisson', 'sueur', 'nausee', 'vomis', 'vertige', 'malaise', 'palpitation', 'toux'] },
            { path: 'interrogatoire.histoireMaladie.remarques', keywords: ['remarque', 'autre chose', 'preciser', 'inquiete', 'peur', 'ajouter', 'question'] }
        ];

        for (const map of keywordMapping) {
            if (map.keywords.some(k => q.includes(k))) {
                this.demarche.interrogatoireAsked.add(map.path);
                this.patientState.insistenceCount[map.path] = (this.patientState.insistenceCount[map.path] || 0) + 1;
            }
        }
    }

    /**
     * Consignes de prosodie et de style vocal selon la physiologie et l'émotion en temps réel
     */
    buildPhysioVocalDirectives() {
        const directives = [];
        const v = this.vitals;
        const p = this.patientState;

        // 1. Impact respiratoire (Dyspnée / Hypoxie)
        if (v.respiratoryRate >= 26 || v.spo2 <= 91) {
            directives.push(`- DYSPNÉE SÉVÈRE (FR=${v.respiratoryRate}/min, SpO2=${v.spo2}%) : Le patient manque d'air. Il parle par groupes de 2 à 4 mots entrecoupés de pauses ("..."), reprend son souffle bruyamment et ne peut PAS faire de longues phrases.`);
        } else if (v.respiratoryRate >= 21 || v.spo2 <= 94) {
            directives.push(`- ESSOUFFLEMENT MODÉRÉ : Phrases courtes, quelques soupirs ou pauses pour reprendre son souffle.`);
        }

        // 2. Impact algique (Douleur EVA)
        if (this.painLevel >= 8) {
            directives.push(`- DOULEUR ATROCE (${this.painLevel}/10) : Le patient gémit, serre les dents, s'interrompt à cause d'élancements aigus. Il demande activement à être soulagé.`);
        } else if (this.painLevel >= 5) {
            directives.push(`- DOULEUR MARQUÉE (${this.painLevel}/10) : Grimaces audibles dans le ton, phrases parfois interrompues par une gêne physique.`);
        }

        // 3. Impact hémodynamique / neurologique
        if (v.systolic <= 85 || v.spo2 <= 85) {
            directives.push(`- ÉTAT DE CHOC / OBNUBILATION (TA=${v.systolic}/${v.diastolic}) : Voix très faible, ralentie, confusion légère, difficulté à se concentrer sur les questions complexes.`);
        }

        // 4. Impact psychologique (Confiance & Anxiété)
        if (p.trust <= 30) {
            directives.push(`- MÉFIANCE ÉLEVÉE (Confiance=${p.trust}/100) : Le patient se sent brusqué ou incompris. Il répond de façon laconique, sur la défensive, et refuse de livrer les informations intimes ou cachées.`);
        } else if (p.trust >= 75) {
            directives.push(`- ALLIANCE THÉRAPEUTIQUE FORTE (Confiance=${p.trust}/100) : Le patient se sent écouté en sécurité. Il se confie volontiers, même sur des sujets délicats ou tabous.`);
        }

        if (p.anxiety >= 75) {
            directives.push(`- ANXIÉTÉ MAJEURE (${p.anxiety}/100) : Débit rapide, voix tremblante, cherche à être rassuré ("C'est grave docteur ?", "C'est le cœur ?").`);
        }

        return directives.length > 0 ? directives.join('\n') : `- État vocal stable, élocution naturelle correspondant à son âge et sa personnalité.`;
    }

    /**
     * Construit les règles de divulgation en fusionnant `caseData.dialogue` (prioritaire) et `ecos.patientStandardise`
     */
    buildDisclosurePrompt() {
        const d = this.caseData.dialogue;
        const ep = this.caseData.ecos?.patientStandardise || this.caseData.ecos?.consignesPatient;
        const persona = this.caseData.patient?.persona || {};

        let sections = [];

        // Profil linguistique et comportemental
        sections.push(`PROFIL INCARNÉ DU PATIENT :
- Nom : ${this.caseData.patient?.prenom || ''} ${this.caseData.patient?.nom || ''} (${this.caseData.patient?.age} ans, ${this.caseData.patient?.sexe})
- Personnalité & Caractère : ${this.caseData.patient?.personnalite || ep?.personnalite || 'Standard'} | ${this.caseData.patient?.caractere || ''}
- Ton & Registre de langue : ${persona.ton || this.patientState.emotionalTone} | Registre : ${persona.registre || 'courant, langage profane non-médical'}
- Loquacité : ${persona.loquacite || 'normal'} (${persona.loquacite === 'reserve' ? 'phrases très courtes, attend qu\'on le relance' : persona.loquacite === 'bavard' ? 'tendance à digresser sur son quotidien' : 'répond naturellement'})
- Style de parole : ${persona.style_parole || 'Naturel, humain, avec hésitations ("euh...", "comment dire...")'}
${persona.exemples_phrases?.length ? `- Exemples d'expressions typiques du patient : ${JSON.stringify(persona.exemples_phrases)}` : ''}`);

        // Pilotage de la divulgation (Schéma `dialogue` prioritaire sur `ecos.patientStandardise`)
        if (d) {
            if (d.spontane?.length) {
                sections.push(`[DÉVOILEMENT SPONTANÉ - Ce que tu dis facilement dès le début]\n${d.spontane.map(x => `- ${x}`).join('\n')}`);
            }
            if (d.si_question?.length) {
                sections.push(`[UNIQUEMENT SUR QUESTION CIBLÉE - Ne le dis JAMAIS si l'étudiant ne pose pas la question]\n${d.si_question.map(x => `- ${x}`).join('\n')}`);
            }
            if (d.si_insiste?.length) {
                sections.push(`[INFORMATIONS CACHÉES / TABOUES - Reste évasif ou minimise la 1ère fois. Ne révèle QUE si l'étudiant insiste avec bienveillance ou si la Confiance >= 65 (actuelle: ${this.patientState.trust}/100)]\n${d.si_insiste.map(x => `- ${x}`).join('\n')}`);
            }
            if (d.ne_jamais_reveler?.length) {
                sections.push(`[INTERDICTION ABSOLUE DE RÉVÉLER - Même sous insistance]\n${d.ne_jamais_reveler.map(x => `- ${x}`).join('\n')}`);
            }
        } else if (ep) {
            const voluntaries = (ep.infosVolontaires || []).map(p => `- Autorisé librement : ${getFriendlySubjectName(p)}`).join('\n');
            const requested = (ep.infosSiDemandees || []).map(p => `- UNIQUEMENT sur question explicite : ${getFriendlySubjectName(p)}`).join('\n');
            const hidden = (ep.infosCachees || []).map(p => {
                const count = this.patientState.insistenceCount[`interrogatoire.${p}`] || 0;
                return `- CACHÉ/INTIME (${getFriendlySubjectName(p)}) [Abordé ${count} fois] : ${count >= 2 || this.patientState.trust >= 70 ? 'Tu peux maintenant l\'avouer avec gêne/émotion.' : 'Reste évasif, minimise ou change de sujet.'}`;
            }).join('\n');

            if (voluntaries) sections.push(`[INFORMATIONS VOLONTAIRES]\n${voluntaries}`);
            if (requested) sections.push(`[SUR QUESTION EXPLICITE UNIQUEMENT]\n${requested}`);
            if (hidden) sections.push(`[INFORMATIONS CACHÉES]\n${hidden}`);
        }

        return sections.join('\n\n');
    }

    async chat(text) {
        if (!this.caseData) throw new Error("No active case.");
        if (this.isFinished) throw new Error("Game is already finished.");
        if (this.fatalErrorTriggered) throw new Error("Fatal error already triggered. Case is over.");
        if (!this.apiKey) throw new Error("API Key for LLM is not configured. Please set LLM_API_KEY in .env.");

        this.trackInterrogatoireByKeywords(text);
        this.updateVitals();

        const physioDirectives = this.buildPhysioVocalDirectives();
        const disclosureDirectives = this.buildDisclosurePrompt();

        const systemPrompt = `Tu es le moteur de simulation clinique et d'incarnation de patient standardisé (ECOS) pour étudiants en médecine.
Ta mission est double :
1. Analyser finement toutes les intentions de l'étudiant (questions d'anamnèse, empathie/communication, gestes d'examen physique au cabinet, prescriptions, examens complémentaires).
2. Incarner le patient avec un réalisme émotionnel, psychologique et sémiologique total.

=== RÈGLES D'OR DU ROLEPLAY PATIENT (RÉALISME MÉDICAL & ÉMOTIONNEL) ===
1. INTERDICTION DU JARGON MÉDICAL PAR LE PATIENT : Sauf si le patient est lui-même soignant, il traduit TOUJOURS les termes médicaux du JSON en ressenti profane.
   - Exemple : "dyspnée d'effort" -> "je suis vite à bout de souffle dès que je monte les escaliers".
   - Exemple : "douleur épigastrique transfixiante" -> "ça me tord le creux de l'estomac et ça me traverse jusqu'au dos".
   - Exemple : "pollakiurie" -> "je passe mon temps aux toilettes pour trois gouttes".
2. PAS DE RÉCITATION DE FICHE : Si l'étudiant pose une question vague ("Des antécédents ?"), le patient ne déballe pas toute sa liste. Il mentionne le plus évident ou demande : "Vous voulez dire des maladies graves ou des opérations ?".
3. RÉACTION AU JARGON DE L'ÉTUDIANT : Si l'étudiant utilise du jargon obscur (ex: "Avez-vous des prodromes, une orthopnée ou un méléna ?"), le patient fronce les sourcils et demande ce que ça veut dire dans dialogue, et trustDelta baisse.
4. LANGAGE NON-VERBAL DANS narrativeResponse : Décris systématiquement le langage corporel du patient dans narrativeResponse (ex: "Le patient porte la main à sa poitrine en grimaçant", "Elle détourne le regard, visiblement gênée par la question sur l'alcool", "Il cherche son souffle entre chaque phrase").
5. RÈGLE DE PARCIMONIE : Une question fermée = réponse courte. Une question ouverte bienveillante = réponse plus riche mais limitée à 2-3 éléments max par tour.

=== ÉTAT PHYSIOLOGIQUE & VOCAL TEMPS-RÉEL ===
- FC : ${this.vitals.heartRate} bpm | TA : ${this.vitals.systolic}/${this.vitals.diastolic} mmHg | SpO2 : ${this.vitals.spo2}% | FR : ${this.vitals.respiratoryRate}/min | T° : ${this.vitals.temperature}°C
- Douleur (EVA) : ${this.painLevel}/10 | Anxiété : ${this.patientState.anxiety}/100 | Confiance envers l'étudiant : ${this.patientState.trust}/100
${physioDirectives}

=== DIRECTIVES DE PERSONA & DIVULGATION ===
${disclosureDirectives}

=== DONNÉES CLINIQUES DE RÉFÉRENCE (VÉRITÉ TERRAIN) ===
- Interrogatoire complet : ${JSON.stringify(this.caseData.interrogatoire || {})}
- Examen clinique au cabinet : ${JSON.stringify(this.caseData.examenClinique || {})}
- Examens complémentaires disponibles : ${JSON.stringify(this.caseData.availableExams || [])}

=== RÈGLES SUR LES GESTES CLINIQUES, PRESCRIPTIONS ET COHÉRENCE ===
- Gestes cliniques : Si l'étudiant examine physiquement le patient (auscultation, palpation, prise de pouls, inspection, réflexes, manœuvre spécifique), remplis "exams" ET décris la scène + la réaction physique du patient (ex: défense abdominale à la palpation) dans "narrativeResponse".
- Prescriptions : Exécute toujours celle imposée par le médecin. Si la dose ou la molécule est dangereuse, ajoute dans narrativeResponse : "Infirmier : « Docteur, êtes-vous sûr pour cette prescription ? Risque de... »" et applique l'impact réel dans vitalChanges et gameState.
- COHÉRENCE STRICTE : vitalChanges contient des DELTAS numériques (ex: -15 ou +10) par rapport aux constantes actuelles. Si le patient est inconscient ou en ACR, dialogue DOIT être null (ou râles agoniques) et gameState.status DOIT être "deteriorating" ou "dead".

Réponds UNIQUEMENT avec un objet JSON strictement valide respectant ce schéma :
{
  "intentAnalysis": {
    "communicationQuality": "empathique" | "neutre" | "brusque" | "jargonneux",
    "questionType": "ouverte" | "fermee" | "multiple" | "aucune",
    "trustDelta": number (-15 à +15),
    "anxietyDelta": number (-15 à +15),
    "detectedTopics": array de strings
  },
  "dialogue": string ou null,
  "exams": array de { "type": "palpation_abdo"|"auscultation_pulm"|"auscultation_card"|"reflex_osteo"|"examen_neuro"|"examen_orl"|"examen_cutane"|"examen_locomoteur"|"prise_constantes"|"inspection"|"other", "nom": string, "description": "résultat clinique objectif" } ou null,
  "prescriptions": array de { "nom": string, "dosage": string, "voie": string, "frequence": string, "duree": string } ou null,
  "otherActions": array de { "actionId": string, "description": string } ou null,
  "vitalChanges": {
    "heartRate": number (delta) ou null,
    "systolic": number (delta) ou null,
    "diastolic": number (delta) ou null,
    "spo2": number (delta) ou null,
    "temperature": number (delta) ou null,
    "respiratoryRate": number (delta) ou null,
    "painLevel": number (delta) ou null
  } ou null,
  "disclosedInfoFields": array de chemins exacts divulgués par le patient dans CE tour (ex: ["histoireMaladie.descriptionDouleur", "modeDeVie.tabac"]) ou null,
  "narrativeResponse": "Description immersive à la 3e personne : attitude non-verbale du patient, gestes réalisés au cabinet et résultats d'examen physique",
  "gameState": {
    "status": "stable" | "deteriorating" | "dead" | "recovering",
    "deathReason": string ou null,
    "catchWindowSec": number ou null
  }
}`;

        const recentHistory = this.chatHistory.slice(-14);
        const buildMessages = () => [
            { role: 'system', content: systemPrompt },
            ...recentHistory.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            })),
            { role: 'user', content: `ACTION / PAROLE DE L'ÉTUDIANT : "${text}"` }
        ];

        let data = null;
        let lastError = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify({
                        model: this.model,
                        messages: buildMessages(),
                        temperature: 0.35,
                        max_tokens: 2500,
                        response_format: { type: 'json_object' }
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                data = await response.json();
                lastError = null;
                break;
            } catch (err) {
                lastError = err;
                if (attempt < 2) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }

        if (lastError || !data) {
            console.error("[MedGameEngine] LLM chat failed:", lastError);
            throw new Error(`Patient LLM indisponible (${lastError ? lastError.message : 'réponse vide'}).`);
        }

        const textResponse = data.choices?.[0]?.message?.content || '';
        let parsed;
        try {
            parsed = this.cleanAndParseJson(textResponse);
        } catch (err) {
            throw new Error(`Réponse LLM illisible (JSON invalide): ${err.message}`);
        }

        this.chatHistory.push({ role: 'user', content: text });

        // 1. Mise à jour de l'état émotionnel et des métriques de communication ECOS
        if (parsed.intentAnalysis) {
            const ia = parsed.intentAnalysis;
            if (typeof ia.trustDelta === 'number') {
                this.patientState.trust = Math.max(0, Math.min(100, this.patientState.trust + ia.trustDelta));
            }
            if (typeof ia.anxietyDelta === 'number') {
                this.patientState.anxiety = Math.max(0, Math.min(100, this.patientState.anxiety + ia.anxietyDelta));
            }
            if (ia.communicationQuality === 'empathique') {
                this.communicationMetrics.empathyCount++;
                this.communicationMetrics.reassuranceGiven = true;
            } else if (ia.communicationQuality === 'jargonneux' || ia.communicationQuality === 'brusque') {
                this.communicationMetrics.jargonPenalties++;
            }
            if (ia.questionType === 'ouverte') this.communicationMetrics.openQuestions++;
            if (ia.questionType === 'fermee') this.communicationMetrics.closedQuestions++;
        }

        // 2. Suivi des gestes cliniques au cabinet + coût temporel réaliste
        if (Array.isArray(parsed.exams)) {
            for (const ex of parsed.exams) {
                if (ex && ex.type && GESTURE_TO_SECTION[ex.type]) {
                    if (!this.demarche.clinicalGestures.has(ex.type)) {
                        this.demarche.clinicalGestures.add(ex.type);
                        this.timePenalties += CLINICAL_GESTURE_TIME_COST_SECONDS;
                    }
                    this.demarche.clinicalExamsViewed.add(GESTURE_TO_SECTION[ex.type]);
                }
            }
        }

        // 3. Suivi des champs d'anamnèse divulgués
        if (Array.isArray(parsed.disclosedInfoFields)) {
            for (const rawPath of parsed.disclosedInfoFields) {
                if (!rawPath || typeof rawPath !== 'string') continue;
                let p = rawPath.trim();
                if (p === 'motifHospitalisation') continue;
                if (!p.startsWith('interrogatoire.')) p = `interrogatoire.${p}`;
                this.demarche.interrogatoireAsked.add(p);
                this.demarche.interviewQuestionsDisclosed.add(p);
            }
        }

        // 4. Application sécurisée des modifications physiologiques
        if (parsed.vitalChanges) {
            for (const [key, value] of Object.entries(parsed.vitalChanges)) {
                if (value !== null && typeof value === 'number') {
                    if (key === 'painLevel') {
                        this.painLevel = Math.max(0, Math.min(10, this.painLevel + value));
                    } else if (this.baseVitals[key] !== undefined) {
                        const isLikelyAbsolute = (key === 'spo2' && value > 50) || (key === 'temperature' && value > 30) || (key === 'systolic' && value > 60);
                        if (isLikelyAbsolute) {
                            this.baseVitals[key] = value;
                        } else {
                            this.baseVitals[key] = Math.max(1, this.baseVitals[key] + value);
                        }
                    }
                }
            }
            this.updateVitals();
        }

        // 5. Auto-prescription via langage naturel
        if (Array.isArray(parsed.prescriptions)) {
            const matchedTreatments = [];
            for (const rx of parsed.prescriptions) {
                if (rx.nom) {
                    const match = (this.caseData.possibleTreatments || []).find(t =>
                        normalizeText(t).includes(normalizeText(rx.nom)) || normalizeText(rx.nom).includes(normalizeText(t))
                    );
                    if (match) matchedTreatments.push(match);
                }
            }
            if (matchedTreatments.length > 0) {
                this.prescribe(matchedTreatments);
            }
        }

        // 6. Auto-prescription d'examens complémentaires via langage naturel
        if (Array.isArray(parsed.exams)) {
            const examsToOrder = [];
            for (const ex of parsed.exams) {
                const candidates = [ex.nom, ex.description, ex.type].filter(Boolean);
                for (const candidate of candidates) {
                    const match = (this.caseData.availableExams || []).find(avail => fuzzyMatchExam(avail, candidate));
                    if (match && !this.activeExams.includes(match) && !examsToOrder.includes(match)) {
                        examsToOrder.push(match);
                    }
                }
            }
            if (examsToOrder.length > 0) {
                this.orderExams(examsToOrder);
            }
        }

        // 7. Construction de la sortie narrative et verbale
        let finalOutput = '';
        if (parsed.narrativeResponse && parsed.dialogue) {
            finalOutput = `*(${parsed.narrativeResponse})*\n\n« ${parsed.dialogue} »`;
        } else if (parsed.narrativeResponse) {
            finalOutput = `*(${parsed.narrativeResponse})*`;
        } else if (parsed.dialogue) {
            finalOutput = `« ${parsed.dialogue} »`;
        } else {
            finalOutput = `*(Le patient reste silencieux.)*`;
        }

        if (parsed.gameState && (parsed.gameState.status === 'deteriorating' || parsed.gameState.status === 'dead')) {
            if (parsed.gameState.status === 'dead') {
                this.fatalErrorTriggered = true;
                this.isFinished = true;
            }
            const gsLabel = parsed.gameState.status === 'dead'
                ? `💀 Décès du patient : ${parsed.gameState.deathReason || 'arrêt cardio-respiratoire'}`
                : `⚠️ Détérioration critique — fenêtre d'action : ${parsed.gameState.catchWindowSec || 60}s`;
            finalOutput += `\n[${gsLabel}]`;
        }

        this.chatHistory.push({ role: 'assistant', content: finalOutput });
        return {
            response: finalOutput,
            parsed,
            patientState: this.patientState,
            vitals: this.vitals
        };
    }

    /**
     * Extracteur JSON ultra-robuste
     */
    cleanAndParseJson(text) {
        let cleaned = (text || '').trim();
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }

        try {
            return JSON.parse(cleaned);
        } catch (firstErr) {
            const repaired = cleaned.replace(/,\s*([\]}])/g, '$1');
            return JSON.parse(repaired);
        }
    }

    prescribe(treatments) {
        if (!this.caseData) throw new Error("No active case");
        if (!Array.isArray(treatments)) throw new Error("Treatments must be an array");
        if (this.isFinished) throw new Error("Game is already finished.");

        const validTreatments = treatments.filter(t =>
            (this.caseData.possibleTreatments || []).includes(t)
        );

        for (const t of validTreatments) {
            if (!this.selectedTreatments.includes(t)) {
                this.selectedTreatments.push(t);
                this.demarche.prescribedTreatments.add(t);
            }
        }

        const fatalHit = this.selectedTreatments.find(t =>
            (this.caseData.fatalTreatments || []).includes(t)
        );
        if (fatalHit && !this.fatalErrorTriggered) {
            this.fatalErrorTriggered = true;
            this.isFinished = true;
            this.score = 0;
            return {
                success: true,
                selectedTreatments: [...this.selectedTreatments],
                gameOver: true,
                fatalTreatment: fatalHit,
                score: 0,
                evaluation: { hasFatalError: true, stars: 0, compositeScore: 0 }
            };
        }

        return { success: true, selectedTreatments: [...this.selectedTreatments], appended: validTreatments.length };
    }

    orderExams(exams) {
        if (!this.caseData) throw new Error("No active case");
        if (!Array.isArray(exams)) throw new Error("Exams must be an array");
        if (this.isFinished) throw new Error("Game is already finished.");

        const validExams = exams.filter(e =>
            (this.caseData.availableExams || []).includes(e)
        );

        const dangerousExams = this.caseData.examGradation?.dangereux || [];
        const newExams = validExams.filter(e => !this.activeExams.includes(e));
        this.timePenalties += newExams.length * EXAM_TIME_COST_SECONDS;

        for (const exam of validExams) {
            if (!this.activeExams.includes(exam)) {
                this.activeExams.push(exam);
            }
            if (!this.demarche.examsOrdered.includes(exam)) {
                this.demarche.examsOrdered.push(exam);
                this.demarche.orderedExams.add(exam);
            }
            if (dangerousExams.some(d => fuzzyMatchExam(exam, d))) {
                this.patientState.anxiety = Math.min(100, this.patientState.anxiety + 15);
            }
        }

        const results = {};
        for (const exam of this.activeExams) {
            const path = `examResults.${exam}`;
            results[exam] = this.isFieldLocked(path)
                ? "🔒 [Verrouillé - Résolvez le défi sémiologique correspondant]"
                : (this.caseData.examResults?.[exam] || "Normal.");
        }

        return {
            success: true,
            activeExams: this.activeExams,
            examResults: results
        };
    }

    submitLock(lockId, answer) {
        if (!this.caseData) throw new Error("No active case");
        const lock = (this.caseData.locks || []).find(l => l.id === lockId);
        if (!lock) throw new Error(`Lock '${lockId}' not found`);

        if (this.demarche.locksUnlocked.has(lockId)) {
            return { success: true, unlocked: true, message: "Already unlocked" };
        }

        const status = this.getLockStatus(lock);
        if (!status.canUnlock) {
            throw new Error(`Gated by missing prerequisites: ${status.missingPrereqs.join(', ')}`);
        }

        this.lockAttempts[lockId] = (this.lockAttempts[lockId] || 0) + 1;
        const attempts = this.lockAttempts[lockId];

        let isCorrect = false;
        if (lock.type === 'SAISIE') {
            const answerNormalized = normalizeText(answer);
            isCorrect = (lock.challenge?.expected_keywords || []).some(kw => {
                const normalizedKW = normalizeText(kw);
                if (normalizedKW === answerNormalized || answerNormalized.includes(normalizedKW)) return true;
                const words = answerNormalized.split(/\s+/);
                return words.some(word => getLevenshteinDistance(word, normalizedKW) <= 1);
            });
        } else if (lock.type === 'QCM') {
            let selectedIndices = [];
            if (Array.isArray(answer)) {
                selectedIndices = answer.map(x => parseInt(x));
            } else if (typeof answer === 'string') {
                const trimmed = answer.trim();
                if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    try {
                        const parsed = JSON.parse(trimmed);
                        selectedIndices = Array.isArray(parsed) ? parsed.map(x => parseInt(x)) : [parseInt(parsed)];
                    } catch (e) {
                        selectedIndices = trimmed.replace(/[\[\]]/g, '').split(',').map(x => parseInt(x.trim())).filter(x => !isNaN(x));
                    }
                } else {
                    selectedIndices = trimmed.split(/[\s,;]+/).map(x => parseInt(x.trim())).filter(x => !isNaN(x));
                }
            } else if (typeof answer === 'number') {
                selectedIndices = [answer];
            }

            const correctIndices = lock.challenge?.correct_indices || (lock.challenge?.correct_index !== undefined ? [lock.challenge.correct_index] : []);
            selectedIndices.sort((a, b) => a - b);
            const sortedCorrect = [...correctIndices].sort((a, b) => a - b);

            isCorrect = selectedIndices.length === sortedCorrect.length &&
                selectedIndices.every((val, index) => val === sortedCorrect[index]);
        }

        if (isCorrect) {
            this.demarche.locksUnlocked.add(lockId);
            return { success: true, unlocked: true };
        } else if (attempts >= 3) {
            this.demarche.locksUnlocked.add(lockId);
            const correctionText = lock.type === 'QCM'
                ? (lock.challenge?.correct_indices || [lock.challenge?.correct_index]).map(idx => lock.challenge?.options?.[idx]).join(' + ')
                : (lock.challenge?.expected_keywords || []).join(', ');
            return {
                success: false,
                unlocked: true,
                message: "Unlocked after 3 failures (correction provided)",
                correction: correctionText,
                feedbackError: lock.feedback_error
            };
        } else {
            return {
                success: false,
                unlocked: false,
                attemptsLeft: 3 - attempts,
                feedbackError: lock.feedback_error || "Incorrect answer."
            };
        }
    }

    selectDiagnostic(diagnostic) {
        if (!this.caseData) throw new Error("No active case");
        if (this.isFinished) throw new Error("Game is already finished.");

        if (this.diagnosticLocked) {
            throw new Error(`Diagnostic déjà validé ("${this.selectedDiagnostic}"). Un seul essai est autorisé.`);
        }

        const options = this.caseData.possibleDiagnostics || [];
        const exactMatch = options.find(o => o === diagnostic);
        const fuzzyMatch = options.find(o => getSimilarity(normalizeText(o), normalizeText(diagnostic)) >= DIAGNOSTIC_TYPO_SIMILARITY);

        const resolvedDiag = exactMatch || fuzzyMatch;
        if (!resolvedDiag && options.length > 0) {
            throw new Error(`Diagnostic '${diagnostic}' not available. Choose from: ${options.join(', ')}`);
        }

        this.selectedDiagnostic = resolvedDiag || diagnostic;
        this.diagnosticLocked = true;
        return { success: true, selectedDiagnostic: this.selectedDiagnostic, locked: true };
    }

    /**
     * Évaluation multicritère ECOS (Diagnostic, Pertinence des examens via examGradation, Thérapeutique, Anamnèse & Relationnel)
     */
    submit() {
        if (!this.caseData) throw new Error("No active case");
        if (this.isFinished) throw new Error("Case already submitted. Submission is definitive.");
        this.attempts++;
        this.isFinished = true;

        if (this.fatalErrorTriggered) {
            this.score = 0;
            this.lastEvaluation = {
                success: true,
                score: 0,
                attempts: this.attempts,
                results: {
                    diagnosticScore: 0,
                    examScore: 0,
                    treatmentScore: 0,
                    communicationScore: 0,
                    fatalError: true
                },
                correctDiagnostic: this.caseData.correctDiagnostic,
                correctTreatments: this.caseData.correctTreatments || []
            };
            return this.lastEvaluation;
        }

        // 1. Score Diagnostic (sur 35 points)
        const correctDiags = Array.isArray(this.caseData.correctDiagnostic)
            ? this.caseData.correctDiagnostic
            : [this.caseData.correctDiagnostic].filter(Boolean);
        const altDiags = this.caseData.alternativeDiagnostics || [];

        const isDiagCorrect = correctDiags.some(cd =>
            getSimilarity(normalizeText(cd), normalizeText(this.selectedDiagnostic)) >= DIAGNOSTIC_TYPO_SIMILARITY
        );
        const isDiagAlternative = !isDiagCorrect && altDiags.some(ad =>
            getSimilarity(normalizeText(ad), normalizeText(this.selectedDiagnostic)) >= DIAGNOSTIC_TYPO_SIMILARITY
        );
        const diagnosticScore = isDiagCorrect ? 35 : (isDiagAlternative ? 18 : 0);

        // 2. Score Examens Complémentaires via examGradation ou relevantExams (sur 25 points)
        let examScore = 25;
        const grad = this.caseData.examGradation;
        const relevant = this.caseData.relevantExams || [];

        if (grad) {
            const parfaits = grad.parfaits || [];
            const inutiles = grad.inutiles || [];
            const dangereux = grad.dangereux || [];

            const hitsParfaits = parfaits.filter(p => this.activeExams.some(ae => fuzzyMatchExam(ae, p))).length;
            const ratioParfaits = parfaits.length > 0 ? (hitsParfaits / parfaits.length) : 1;
            examScore = Math.round(ratioParfaits * 25);

            for (const ae of this.activeExams) {
                if (inutiles.some(i => fuzzyMatchExam(ae, i))) examScore -= 4;
                if (dangereux.some(d => fuzzyMatchExam(ae, d))) examScore -= 12;
            }
        } else if (relevant.length > 0) {
            const hits = relevant.filter(r => this.activeExams.some(ae => fuzzyMatchExam(ae, r))).length;
            const overPrescription = Math.max(0, this.activeExams.length - relevant.length);
            examScore = Math.round((hits / relevant.length) * 25) - (overPrescription * 3);
        }
        examScore = Math.max(0, Math.min(25, examScore));

        // 3. Score Thérapeutique (sur 25 points)
        const correctTx = this.caseData.correctTreatments || [];
        let treatmentScore = 25;
        if (correctTx.length > 0) {
            const txHits = correctTx.filter(ct => this.selectedTreatments.includes(ct)).length;
            const wrongTx = this.selectedTreatments.filter(st => !correctTx.includes(st) && !(this.caseData.secondLineTreatments || []).includes(st)).length;
            treatmentScore = Math.round((txHits / correctTx.length) * 25) - (wrongTx * 5);
        }
        treatmentScore = Math.max(0, Math.min(25, treatmentScore));

        // 4. Score Anamnèse, Examen Clinique & Relationnel ECOS (sur 15 points)
        const anamnesisCount = this.demarche.interrogatoireAsked.size;
        const anamnesisPoints = Math.min(8, anamnesisCount * 1.5);
        const trustBonus = this.patientState.trust >= 65 ? 4 : (this.patientState.trust >= 45 ? 2 : 0);
        const gestureBonus = this.demarche.clinicalGestures.size > 0 ? 3 : 0;
        const communicationScore = Math.round(Math.min(15, anamnesisPoints + trustBonus + gestureBonus));

        this.score = Math.round(diagnosticScore + examScore + treatmentScore + communicationScore);

        this.lastEvaluation = {
            success: true,
            score: this.score,
            attempts: this.attempts,
            results: {
                diagnosticScore,
                examScore,
                treatmentScore,
                communicationScore,
                finalPatientTrust: this.patientState.trust,
                anamnesisDomainsCovered: Array.from(this.demarche.interrogatoireAsked),
                clinicalGesturesPerformed: Array.from(this.demarche.clinicalGestures)
            },
            correctDiagnostic: this.caseData.correctDiagnostic,
            correctTreatments: this.caseData.correctTreatments || [],
            correction: this.caseData.correction
        };

        return this.lastEvaluation;
    }
}
