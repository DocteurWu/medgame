/**
 * atlas-lung.js - Module Poumon Détaillé 3D pour MedGame
 * Source 3D : HuBMAP / CCF 3D Reference Object Library v1.2 (Visible Human Project) - CC BY 4.0
 * 
 * Gestionnaire autonome :
 * - Chargement local asynchrone des modèles GLB (Homme / Femme)
 * - Auto-centrage et normalisation d'échelle
 * - Matériaux anatomiques distincts par groupe fonctionnel et lobe
 * - Plan de section coronale (clipping plane) dynamique avec curseur de profondeur
 * - Interaction, raycasting, regroupement par lobes et fiches pédagogiques en français
 * - Conforme aux référentiels du Collège des Enseignants de Pneumologie (SPLF / R2C / EDN)
 */

let _THREE = null;
let _GLTFLoader = null;

async function getThree() {
    if (!_THREE) {
        _THREE = (typeof window !== 'undefined' && window.THREE) ? window.THREE : await import('three');
    }
    return _THREE;
}

async function getGLTFLoader() {
    if (!_GLTFLoader) {
        const mod = await import('three/addons/loaders/GLTFLoader.js');
        _GLTFLoader = mod.GLTFLoader;
    }
    return _GLTFLoader;
}

// Références vers les fichiers GLB locaux
export const LUNG_MODELS = {
    male: 'assets/models/poumon/VH_M_Lung.glb',
    female: 'assets/models/poumon/VH_F_Lung.glb'
};

// Dictionnaire exhaustif des 67 structures anatomiques du système respiratoire
export const LUNG_STRUCTURES = {
    // 1. Cartilages laryngés (7)
    arytenoid_cartilage_L: {
        id: 'arytenoid_cartilage_L',
        nameFr: 'Cartilage aryténoïde gauche',
        nameEn: 'Left arytenoid cartilage',
        color: '#94a3b8',
        roughness: 0.55,
        metalness: 0.05,
        desc: 'Petit cartilage hyalin pyramidal articulé sur le bord supérieur du cricoïde. Il donne insertion au ligament vocal et aux muscles laryngés intrinsèques régissant l\'ouverture de la fente glottique et la phonation.',
        role: 'laryngeal_cartilage',
        subgroup: 'Cartilages laryngés'
    },
    arytenoid_cartilage_R: {
        id: 'arytenoid_cartilage_R',
        nameFr: 'Cartilage aryténoïde droit',
        nameEn: 'Right arytenoid cartilage',
        color: '#94a3b8',
        roughness: 0.55,
        metalness: 0.05,
        desc: 'Cartilage laryngé pyramidal droit. Pivot fondamental de la mécanique vocale, son déplacement en abduction/adduction module la tension du pli vocal droit.',
        role: 'laryngeal_cartilage',
        subgroup: 'Cartilages laryngés'
    },
    corniculate_cartilage_L: {
        id: 'corniculate_cartilage_L',
        nameFr: 'Cartilage corniculé gauche (de Santorini)',
        nameEn: 'Left corniculate cartilage',
        color: '#a1a1aa',
        roughness: 0.6,
        metalness: 0.04,
        desc: 'Petit nodule fibro-cartilagineux conique situé au sommet du cartilage aryténoïde gauche, enchâssé dans le pli ary-épiglottique.',
        role: 'laryngeal_cartilage',
        subgroup: 'Cartilages laryngés'
    },
    corniculate_cartilage_R: {
        id: 'corniculate_cartilage_R',
        nameFr: 'Cartilage corniculé droit (de Santorini)',
        nameEn: 'Right corniculate cartilage',
        color: '#a1a1aa',
        roughness: 0.6,
        metalness: 0.04,
        desc: 'Petit nodule conique surmontant l\'aryténoïde droit. Il participe au soutien mécanique de l\'orifice supérieur du larynx lors de la déglutition.',
        role: 'laryngeal_cartilage',
        subgroup: 'Cartilages laryngés'
    },
    cricoid_cartilage: {
        id: 'cricoid_cartilage',
        nameFr: 'Cartilage cricoïde',
        nameEn: 'Cricoid cartilage',
        color: '#cbd5e1',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Seul anneau cartilagineux complet du conduit aérien (en forme de bague à chaton postérieur). Situé au niveau de C6, il forme le socle rigide du larynx et le plancher de l\'étage sous-glottique.',
        role: 'laryngeal_cartilage',
        subgroup: 'Cartilages laryngés'
    },
    epiglottic_cartilage: {
        id: 'epiglottic_cartilage',
        nameFr: 'Cartilage épiglottique',
        nameEn: 'Epiglottic cartilage',
        color: '#e2e8f0',
        roughness: 0.58,
        metalness: 0.04,
        desc: 'Lame fibro-cartilagineuse souple en forme de pétale. Lors du temps pharyngien de la déglutition, son abaissement ferme l\'aditus laryngé pour protéger la filière respiratoire contre les fausses routes alimentaires.',
        role: 'laryngeal_cartilage',
        subgroup: 'Cartilages laryngés'
    },
    thyroid_cartilage: {
        id: 'thyroid_cartilage',
        nameFr: 'Cartilage thyroïde',
        nameEn: 'Thyroid cartilage',
        color: '#94a3b8',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Le plus volumineux cartilage du larynx, formé par l\'union antérieure de deux lames quadrilatères constituant la saillie laryngée (pomme d\'Adam). Bouclier protecteur des cordes vocales.',
        role: 'laryngeal_cartilage',
        subgroup: 'Cartilages laryngés'
    },

    // 2. Trachée et carène (3)
    carina: {
        id: 'carina',
        nameFr: 'Carène trachéale (éperon trachéal)',
        nameEn: 'Tracheal carina',
        color: '#38bdf8',
        roughness: 0.45,
        metalness: 0.06,
        desc: 'Crête cartilagineuse interne marquant la bifurcation de la trachée en bronches principales droite et gauche au niveau de Th4-Th5 (angle de Louis). Zone réflexogène majeure du réflexe tussigène.',
        role: 'tracheobronchial_tree',
        subgroup: 'Trachée et Carène'
    },
    trachea: {
        id: 'trachea',
        nameFr: 'Trachée (lumière et muqueuse)',
        nameEn: 'Trachea',
        color: '#0ea5e9',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Conduit fibro-cartilagineux tubulaire de 11 à 13 cm reliant le larynx aux bronches principales. Tapissée d\'un épithélium respiratoire pseudostratifié cilié assurant l\'escalator mucociliaire.',
        role: 'tracheobronchial_tree',
        subgroup: 'Trachée et Carène'
    },
    tracheal_cartilage: {
        id: 'tracheal_cartilage',
        nameFr: 'Cartilages trachéaux (anneaux trachéaux)',
        nameEn: 'Tracheal cartilages',
        color: '#7dd3fc',
        roughness: 0.52,
        metalness: 0.05,
        desc: 'Série de 16 à 20 anneaux hyalins incomplets en fer à cheval ouverts vers l\'arrière. La paroi postérieure membraneuse accueille le muscle trachéal au contact direct de l\'œsophage.',
        role: 'tracheobronchial_tree',
        subgroup: 'Trachée et Carène'
    },

    // 3. Bronches principales et leurs cartilages (4)
    bronchial_cartilage: {
        id: 'bronchial_cartilage',
        nameFr: 'Cartilages bronchiques',
        nameEn: 'Bronchial cartilages',
        color: '#60a5fa',
        roughness: 0.52,
        metalness: 0.05,
        desc: 'Armature fibro-cartilagineuse semi-rigide maintenant la perméabilité de l\'arbre bronchique proximal face aux pressions intrathoraciques négatives et positives.',
        role: 'bronchial_tree',
        subgroup: 'Bronches principales'
    },
    left_main_bronchus: {
        id: 'left_main_bronchus',
        nameFr: 'Bronche principale gauche',
        nameEn: 'Left main bronchus',
        color: '#2563eb',
        roughness: 0.48,
        metalness: 0.06,
        desc: 'Conduit aérien plus long (environ 5 cm), plus étroit et plus horizontal que le droit, enjambé par la crosse aortique. Moins exposé à l\'inhalation directe de corps étrangers.',
        role: 'bronchial_tree',
        subgroup: 'Bronches principales'
    },
    right_main_bronchus: {
        id: 'right_main_bronchus',
        nameFr: 'Bronche principale droite',
        nameEn: 'Right main bronchus',
        color: '#2563eb',
        roughness: 0.48,
        metalness: 0.06,
        desc: 'Conduit aérien plus court (2 à 2,5 cm), plus large et plus vertical que le gauche, dans le prolongement direct de la trachée. C\'est la voie préférentielle d\'inhalation des corps étrangers.',
        role: 'bronchial_tree',
        subgroup: 'Bronches principales'
    },
    right_intermediate_bronchus: {
        id: 'right_intermediate_bronchus',
        nameFr: 'Bronche intermédiaire droite',
        nameEn: 'Right bronchus intermedius',
        color: '#1d4ed8',
        roughness: 0.48,
        metalness: 0.06,
        desc: 'Segment bronchique droit intermédiaire situé entre l\'émergence de la bronche lobaire supérieure droite et la bifurcation pour les lobes moyen et inférieur. Particularité anatomique absente à gauche.',
        role: 'bronchial_tree',
        subgroup: 'Bronches principales'
    },

    // 4. Bronches lobaires (6)
    left_inferior_lobar_bronchus: {
        id: 'left_inferior_lobar_bronchus',
        nameFr: 'Bronche lobaire inférieure gauche',
        nameEn: 'Left inferior lobar bronchus',
        color: '#3b82f6',
        roughness: 0.48,
        metalness: 0.06,
        desc: 'Branche distale de la bronche principale gauche ventilant le lobe inférieur gauche (segments S6 à S10).',
        role: 'lobar_bronchus',
        subgroup: 'Bronches lobaires'
    },
    left_lingular_bronchus: {
        id: 'left_lingular_bronchus',
        nameFr: 'Bronche lingulaire',
        nameEn: 'Lingular bronchus',
        color: '#6366f1',
        roughness: 0.48,
        metalness: 0.06,
        desc: 'Division inférieure de la bronche lobaire supérieure gauche. Elle ventile la lingula (segments lingulaires supérieur S4 et inférieur S5), équivalent morphologique du lobe moyen droit.',
        role: 'lobar_bronchus',
        subgroup: 'Bronches lobaires'
    },
    left_superior_lobar_bronchus: {
        id: 'left_superior_lobar_bronchus',
        nameFr: 'Bronche lobaire supérieure gauche',
        nameEn: 'Left superior lobar bronchus',
        color: '#4f46e5',
        roughness: 0.48,
        metalness: 0.06,
        desc: 'Branche ascendante de la bronche principale gauche se divisant en tronc culminal (S1, S2, S3) et tronc lingulaire (S4, S5).',
        role: 'lobar_bronchus',
        subgroup: 'Bronches lobaires'
    },
    right_lower_lobar_bronchus: {
        id: 'right_lower_lobar_bronchus',
        nameFr: 'Bronche lobaire inférieure droite',
        nameEn: 'Right inferior lobar bronchus',
        color: '#3b82f6',
        roughness: 0.48,
        metalness: 0.06,
        desc: 'Prolongement de la bronche intermédiaire ventilant la pyramide basale et le segment de Fowler (S6 à S10) du poumon droit.',
        role: 'lobar_bronchus',
        subgroup: 'Bronches lobaires'
    },
    right_middle_lobar_bronchus: {
        id: 'right_middle_lobar_bronchus',
        nameFr: 'Bronche lobaire moyenne droite',
        nameEn: 'Right middle lobar bronchus',
        color: '#6366f1',
        roughness: 0.48,
        metalness: 0.06,
        desc: 'Branche antérieure issue de la bronche intermédiaire ventilant le lobe moyen droit (segments latéral S4 et médial S5). Calibre modéré propice au syndrome du lobe moyen.',
        role: 'lobar_bronchus',
        subgroup: 'Bronches lobaires'
    },
    right_superior_lobar_bronchus: {
        id: 'right_superior_lobar_bronchus',
        nameFr: 'Bronche lobaire supérieure droite',
        nameEn: 'Right superior lobar bronchus',
        color: '#4f46e5',
        roughness: 0.48,
        metalness: 0.06,
        desc: 'Première collatérale droite naissant au-dessus de l\'artère pulmonaire (bronche épartérielle). Elle alimente le lobe supérieur droit (segments S1, S2, S3).',
        role: 'lobar_bronchus',
        subgroup: 'Bronches lobaires'
    },

    // 5. Bronches segmentaires (18 + 1 bronchus = 19)
    left_anterior_basal_bronchus: {
        id: 'left_anterior_basal_bronchus',
        nameFr: 'Bronche segmentaire basale antérieure gauche (B8)',
        nameEn: 'Left anterior basal bronchus',
        color: '#0d9488',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Bronche segmentaire basale ventilant le segment S8 du lobe inférieur gauche.',
        role: 'segmental_bronchus',
        subgroup: 'Bronches segmentaires'
    },
    left_anterior_bronchus: {
        id: 'left_anterior_bronchus',
        nameFr: 'Bronche segmentaire antérieure gauche (B3)',
        nameEn: 'Left anterior bronchus',
        color: '#0d9488',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Bronche segmentaire du culmen ventilant le segment antérieur S3 du lobe supérieur gauche.',
        role: 'segmental_bronchus',
        subgroup: 'Bronches segmentaires'
    },
    left_apical_bronchus: {
        id: 'left_apical_bronchus',
        nameFr: 'Bronche segmentaire apicale gauche (B1)',
        nameEn: 'Left apical bronchus',
        color: '#0d9488',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Bronche alimentant le sommet du poumon gauche, fréquemment unie à la bronche postérieure en tronc apico-postérieur (B1+2).',
        role: 'segmental_bronchus',
        subgroup: 'Bronches segmentaires'
    },
    left_lateral_basal_bronchus: {
        id: 'left_lateral_basal_bronchus',
        nameFr: 'Bronche segmentaire basale latérale gauche (B9)',
        nameEn: 'Left lateral basal bronchus',
        color: '#0d9488',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Bronche ventilant le segment basal latéral S9 du lobe inférieur gauche.',
        role: 'segmental_bronchus',
        subgroup: 'Bronches segmentaires'
    },
    left_lingula_inferior_bronchus: {
        id: 'left_lingula_inferior_bronchus',
        nameFr: 'Bronche segmentaire lingulaire inférieure (B5)',
        nameEn: 'Left lingular inferior bronchus',
        color: '#0d9488',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Branche terminale inférieure de la lingula ventilant le segment S5 gauche.',
        role: 'segmental_bronchus',
        subgroup: 'Bronches segmentaires'
    },
    left_lingula_superior_bronchus: {
        id: 'left_lingula_superior_bronchus',
        nameFr: 'Bronche segmentaire lingulaire supérieure (B4)',
        nameEn: 'Left lingular superior bronchus',
        color: '#0d9488',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Branche terminale supérieure de la lingula ventilant le segment S4 gauche.',
        role: 'segmental_bronchus',
        subgroup: 'Bronches segmentaires'
    },
    left_medial_basal_bronchus: {
        id: 'left_medial_basal_bronchus',
        nameFr: 'Bronche segmentaire basale médiale gauche (B7)',
        nameEn: 'Left medial basal bronchus',
        color: '#0d9488',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Bronche ventilant le segment basal médial S7 (segment cardiaque) du lobe inférieur gauche.',
        role: 'segmental_bronchus',
        subgroup: 'Bronches segmentaires'
    },
    left_posterior_basal_bronchus: {
        id: 'left_posterior_basal_bronchus',
        nameFr: 'Bronche segmentaire basale postérieure gauche (B10)',
        nameEn: 'Left posterior basal bronchus',
        color: '#0d9488',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Bronche la plus postérieure et déclive de la pyramide basale gauche, ventilant le segment S10.',
        role: 'segmental_bronchus',
        subgroup: 'Bronches segmentaires'
    },
    left_superior_bronchus: {
        id: 'left_superior_bronchus',
        nameFr: 'Bronche segmentaire supérieure du lobe inférieur gauche (B6)',
        nameEn: 'Left superior bronchus of lower lobe',
        color: '#0d9488',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Bronche du segment de Fowler gauche (S6), première branche née de la face postérieure de la bronche lobaire inférieure.',
        role: 'segmental_bronchus',
        subgroup: 'Bronches segmentaires'
    },
    right_anterior_basal_bronchus: {
        id: 'right_anterior_basal_bronchus',
        nameFr: 'Bronche segmentaire basale antérieure droite (B8)',
        nameEn: 'Right anterior basal bronchus',
        color: '#0d9488',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Bronche basale ventrale de la pyramide basale droite ventilant le segment S8.',
        role: 'segmental_bronchus',
        subgroup: 'Bronches segmentaires'
    },
    right_anterior_bronchus: {
        id: 'right_anterior_bronchus',
        nameFr: 'Bronche segmentaire antérieure droite (B3)',
        nameEn: 'Right anterior bronchus',
        color: '#0d9488',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Branche ventrale de la lobaire supérieure droite alimentant le segment antérieur S3.',
        role: 'segmental_bronchus',
        subgroup: 'Bronches segmentaires'
    },
    right_apical_bronchus: {
        id: 'right_apical_bronchus',
        nameFr: 'Bronche segmentaire apicale droite (B1)',
        nameEn: 'Right apical bronchus',
        color: '#0d9488',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Branche ascendante de la lobaire supérieure droite ventilant le dôme et le segment apical S1.',
        role: 'segmental_bronchus',
        subgroup: 'Bronches segmentaires'
    },
    right_lateral_basal_bronchus: {
        id: 'right_lateral_basal_bronchus',
        nameFr: 'Bronche segmentaire basale latérale droite (B9)',
        nameEn: 'Right lateral basal bronchus',
        color: '#0d9488',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Bronche de la pyramide basale droite ventilant le segment axillaire basal S9.',
        role: 'segmental_bronchus',
        subgroup: 'Bronches segmentaires'
    },
    right_lateral_bronchus: {
        id: 'right_lateral_bronchus',
        nameFr: 'Bronche segmentaire latérale droite (B4)',
        nameEn: 'Right lateral bronchus',
        color: '#0d9488',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Branche du lobe moyen droit ventilant le segment latéral S4.',
        role: 'segmental_bronchus',
        subgroup: 'Bronches segmentaires'
    },
    right_medial_basal_bronchus: {
        id: 'right_medial_basal_bronchus',
        nameFr: 'Bronche segmentaire basale médiale droite (B7)',
        nameEn: 'Right medial basal bronchus',
        color: '#0d9488',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Bronche paracardiaque droite ventilant le segment médial basal S7.',
        role: 'segmental_bronchus',
        subgroup: 'Bronches segmentaires'
    },
    right_medial_bronchus: {
        id: 'right_medial_bronchus',
        nameFr: 'Bronche segmentaire médiale droite (B5)',
        nameEn: 'Right medial bronchus',
        color: '#0d9488',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Branche du lobe moyen droit ventilant le segment médial S5 juxta-cardiaque.',
        role: 'segmental_bronchus',
        subgroup: 'Bronches segmentaires'
    },
    right_posterior_bronchus: {
        id: 'right_posterior_bronchus',
        nameFr: 'Bronche segmentaire postérieure droite (B2)',
        nameEn: 'Right posterior bronchus',
        color: '#0d9488',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Branche dorsale de la lobaire supérieure droite ventilant le segment postérieur S2.',
        role: 'segmental_bronchus',
        subgroup: 'Bronches segmentaires'
    },
    right_superior_bronchus: {
        id: 'right_superior_bronchus',
        nameFr: 'Bronche segmentaire supérieure du lobe inférieur droit (B6)',
        nameEn: 'Right superior bronchus of lower lobe',
        color: '#0d9488',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Bronche du segment de Fowler droit (S6), première branche postérieure issue de la lobaire inférieure droite.',
        role: 'segmental_bronchus',
        subgroup: 'Bronches segmentaires'
    },
    bronchus: {
        id: 'bronchus',
        nameFr: 'Ramification bronchique sous-segmentaire',
        nameEn: 'Bronchial subsegmental branching',
        color: '#14b8a6',
        roughness: 0.5,
        metalness: 0.05,
        desc: 'Éléments de division distale de l\'arbre trachéobronchique assurant la transition vers les bronchioles terminales et les lobules secondaires.',
        role: 'segmental_bronchus',
        subgroup: 'Bronches segmentaires'
    },

    // 6 & 7. Segments bronchopulmonaires parenchymateux (21 maillages)
    // Poumon droit (10 segments + 1 maillage sans suffixe)
    right_apical_bronchopulmonary_segment: {
        id: 'right_apical_bronchopulmonary_segment',
        nameFr: 'Segment apical droit (S1)',
        nameEn: 'Right apical segment (S1)',
        color: '#f87171',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Sommet du lobe supérieur droit logé dans le dôme pleural. Territoire d\'élection de la tuberculose apicale de réactivation et des apexopathies expansives (tumeur de Pancoast-Tobias).',
        role: 'parenchyma_segment',
        subgroup: 'Lobe supérieur droit',
        segmentNumber: 'S1',
        lobe: 'Lobe supérieur droit'
    },
    right_posterior_bronchopulmonary_segment: {
        id: 'right_posterior_bronchopulmonary_segment',
        nameFr: 'Segment postérieur droit (S2)',
        nameEn: 'Right posterior segment (S2)',
        color: '#f87171',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Segment dorsal du lobe supérieur droit adjacent à la grande scissure. Zone de déclivité préférentielle pour les pneumopathies d\'inhalation en décubitus dorsal.',
        role: 'parenchyma_segment',
        subgroup: 'Lobe supérieur droit',
        segmentNumber: 'S2',
        lobe: 'Lobe supérieur droit'
    },
    right_anterior_bronchopulmonary_segment: {
        id: 'right_anterior_bronchopulmonary_segment',
        nameFr: 'Segment antérieur droit (S3)',
        nameEn: 'Right anterior segment (S3)',
        color: '#f87171',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Segment ventral du lobe supérieur droit reposant sur la petite scissure horizontale. Facilement auscultable sur la face antérieure du thorax.',
        role: 'parenchyma_segment',
        subgroup: 'Lobe supérieur droit',
        segmentNumber: 'S3',
        lobe: 'Lobe supérieur droit'
    },
    right_lateral_bronchopulmonary_segment: {
        id: 'right_lateral_bronchopulmonary_segment',
        nameFr: 'Segment latéral du lobe moyen (S4)',
        nameEn: 'Right lateral segment of middle lobe (S4)',
        color: '#fb923c',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Portion externe et costale du lobe moyen droit, délimitée en haut par la scissure horizontale et en bas par la grande scissure oblique.',
        role: 'parenchyma_segment',
        subgroup: 'Lobe moyen droit',
        segmentNumber: 'S4',
        lobe: 'Lobe moyen droit'
    },
    right_medial_bronchopulmonary_segment: {
        id: 'right_medial_bronchopulmonary_segment',
        nameFr: 'Segment médial du lobe moyen (S5)',
        nameEn: 'Right medial segment of middle lobe (S5)',
        color: '#fb923c',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Portion antéro-médiale du lobe moyen droit moulée sur l\'atrium droit. Son comblement radiologique efface le bord droit du cœur (signe de la silhouette de Felson positif).',
        role: 'parenchyma_segment',
        subgroup: 'Lobe moyen droit',
        segmentNumber: 'S5',
        lobe: 'Lobe moyen droit'
    },
    right_superior_bronchopulmonary_segment: {
        id: 'right_superior_bronchopulmonary_segment',
        nameFr: 'Segment supérieur du lobe inférieur droit (S6, de Fowler)',
        nameEn: 'Right superior segment of lower lobe (S6, Fowler)',
        color: '#e11d48',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Apex du lobe inférieur droit coiffant la pyramide basale. Point le plus dorsal du poumon, cible majeure des foyers infectieux par inhalation lors du sommeil.',
        role: 'parenchyma_segment',
        subgroup: 'Lobe inférieur droit',
        segmentNumber: 'S6',
        lobe: 'Lobe inférieur droit'
    },
    right_medial_basal_bronchopulmonary_segment: {
        id: 'right_medial_basal_bronchopulmonary_segment',
        nameFr: 'Segment basal médial droit (S7, paracardiaque)',
        nameEn: 'Right medial basal segment (S7, cardiac)',
        color: '#e11d48',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Segment juxta-péricardique et diaphragmatique situé en dedans de la pyramide basale droite.',
        role: 'parenchyma_segment',
        subgroup: 'Lobe inférieur droit',
        segmentNumber: 'S7',
        lobe: 'Lobe inférieur droit'
    },
    right_anterior_basal_bronchopulmonary_segment: {
        id: 'right_anterior_basal_bronchopulmonary_segment',
        nameFr: 'Segment basal antérieur droit (S8)',
        nameEn: 'Right anterior basal segment (S8)',
        color: '#e11d48',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Face antéro-inférieure de la pyramide basale droite reposant sur la coupole diaphragmatique droite.',
        role: 'parenchyma_segment',
        subgroup: 'Lobe inférieur droit',
        segmentNumber: 'S8',
        lobe: 'Lobe inférieur droit'
    },
    right_lateral_basal_bronchopulmonary_segment: {
        id: 'right_lateral_basal_bronchopulmonary_segment',
        nameFr: 'Segment basal latéral droit (S9)',
        nameEn: 'Right lateral basal segment (S9)',
        color: '#e11d48',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Versant axillaire et déclive de la base pulmonaire droite occupant le récessus costo-diaphragmatique.',
        role: 'parenchyma_segment',
        subgroup: 'Lobe inférieur droit',
        segmentNumber: 'S9',
        lobe: 'Lobe inférieur droit'
    },
    right_posterior_basal_bronchopulmonary_segment: {
        id: 'right_posterior_basal_bronchopulmonary_segment',
        nameFr: 'Segment basal postérieur droit (S10)',
        nameEn: 'Right posterior basal segment (S10)',
        color: '#e11d48',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Territoire le plus volumineux et le plus dorsal de la base pulmonaire droite, plongeant dans le sinus costo-diaphragmatique postérieur.',
        role: 'parenchyma_segment',
        subgroup: 'Lobe inférieur droit',
        segmentNumber: 'S10',
        lobe: 'Lobe inférieur droit'
    },
    right_posterior_basal: {
        id: 'right_posterior_basal',
        nameFr: 'Segment basal postérieur droit (S10, composante basale)',
        nameEn: 'Right posterior basal component (S10)',
        color: '#e11d48',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Sous-composante dorsale du segment basal postérieur droit S10 dans le maillage HuBMAP.',
        role: 'parenchyma_segment',
        subgroup: 'Lobe inférieur droit',
        segmentNumber: 'S10',
        lobe: 'Lobe inférieur droit'
    },

    // Poumon gauche (10 segments)
    left_apical_bronchopulmonary_segment: {
        id: 'left_apical_bronchopulmonary_segment',
        nameFr: 'Segment apical gauche (S1)',
        nameEn: 'Left apical segment (S1)',
        color: '#f472b6',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Sommet du lobe supérieur gauche (culmen). Souvent regroupé en clinique avec le segment S2 en segment apico-postérieur (S1+S2).',
        role: 'parenchyma_segment',
        subgroup: 'Lobe supérieur gauche',
        segmentNumber: 'S1',
        lobe: 'Lobe supérieur gauche'
    },
    left_posterior_bronchopulmonary_segment: {
        id: 'left_posterior_bronchopulmonary_segment',
        nameFr: 'Segment postérieur gauche (S2)',
        nameEn: 'Left posterior segment (S2)',
        color: '#f472b6',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Portion postérieure supérieure du culmen gauche bordant la scissure oblique.',
        role: 'parenchyma_segment',
        subgroup: 'Lobe supérieur gauche',
        segmentNumber: 'S2',
        lobe: 'Lobe supérieur gauche'
    },
    left_anterior_bronchopulmonary_segment: {
        id: 'left_anterior_bronchopulmonary_segment',
        nameFr: 'Segment antérieur gauche (S3)',
        nameEn: 'Left anterior segment (S3)',
        color: '#f472b6',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Segment antérieur du culmen gauche, reposant au-dessus de la lingula.',
        role: 'parenchyma_segment',
        subgroup: 'Lobe supérieur gauche',
        segmentNumber: 'S3',
        lobe: 'Lobe supérieur gauche'
    },
    left_lingula_superior_bronchopulmonary_segment: {
        id: 'left_lingula_superior_bronchopulmonary_segment',
        nameFr: 'Segment lingulaire supérieur (S4)',
        nameEn: 'Left lingular superior segment (S4)',
        color: '#fbbf24',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Segment supérieur de la lingula (langue pulmonaire gauche). Bordant le ventricule gauche, son infiltrat efface le bord gauche du cœur à la radiographie.',
        role: 'parenchyma_segment',
        subgroup: 'Lobe supérieur gauche (Lingula)',
        segmentNumber: 'S4',
        lobe: 'Lobe supérieur gauche'
    },
    left_lingula_inferior_bronchopulmonary_segment: {
        id: 'left_lingula_inferior_bronchopulmonary_segment',
        nameFr: 'Segment lingulaire inférieur (S5)',
        nameEn: 'Left lingular inferior segment (S5)',
        color: '#fbbf24',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Extrémité inférieure de la lingula se projetant vers l\'apex cardiaque.',
        role: 'parenchyma_segment',
        subgroup: 'Lobe supérieur gauche (Lingula)',
        segmentNumber: 'S5',
        lobe: 'Lobe supérieur gauche'
    },
    left_superior_bronchopulmonary_segment: {
        id: 'left_superior_bronchopulmonary_segment',
        nameFr: 'Segment supérieur du lobe inférieur gauche (S6, de Fowler)',
        nameEn: 'Left superior segment of lower lobe (S6, Fowler)',
        color: '#db2777',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Sommet dorsal du lobe inférieur gauche sous la scissure oblique.',
        role: 'parenchyma_segment',
        subgroup: 'Lobe inférieur gauche',
        segmentNumber: 'S6',
        lobe: 'Lobe inférieur gauche'
    },
    left_medial_basal_bronchopulmonary_segment: {
        id: 'left_medial_basal_bronchopulmonary_segment',
        nameFr: 'Segment basal médial gauche (S7, cardiaque)',
        nameEn: 'Left medial basal segment (S7, cardiac)',
        color: '#db2777',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Territoire juxta-cardiaque médial de la base gauche, souvent associé au segment antérieur (S7+S8).',
        role: 'parenchyma_segment',
        subgroup: 'Lobe inférieur gauche',
        segmentNumber: 'S7',
        lobe: 'Lobe inférieur gauche'
    },
    left_anterior_basal_bronchopulmonary_segment: {
        id: 'left_anterior_basal_bronchopulmonary_segment',
        nameFr: 'Segment basal antérieur gauche (S8)',
        nameEn: 'Left anterior basal segment (S8)',
        color: '#db2777',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Face antéro-médiale de la pyramide basale gauche en regard de la coupole diaphragmatique gauche.',
        role: 'parenchyma_segment',
        subgroup: 'Lobe inférieur gauche',
        segmentNumber: 'S8',
        lobe: 'Lobe inférieur gauche'
    },
    left_lateral_basal_bronchopulmonary_segment: {
        id: 'left_lateral_basal_bronchopulmonary_segment',
        nameFr: 'Segment basal latéral gauche (S9)',
        nameEn: 'Left lateral basal segment (S9)',
        color: '#db2777',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Versant axillaire déclive du lobe inférieur gauche occupant le cul-de-sac pleural gauche.',
        role: 'parenchyma_segment',
        subgroup: 'Lobe inférieur gauche',
        segmentNumber: 'S9',
        lobe: 'Lobe inférieur gauche'
    },
    left_posetrior_basal_bronchopulmonary_segment: {
        id: 'left_posetrior_basal_bronchopulmonary_segment',
        nameFr: 'Segment basal postérieur gauche (S10)',
        nameEn: 'Left posterior basal segment (S10)',
        color: '#db2777',
        roughness: 0.45,
        metalness: 0.04,
        desc: 'Territoire le plus dorsal de la pyramide basale gauche, moulé sur le rachis thoracique et l\'aorte descendante.',
        role: 'parenchyma_segment',
        subgroup: 'Lobe inférieur gauche',
        segmentNumber: 'S10',
        lobe: 'Lobe inférieur gauche'
    },

    // 8. Hiles et insertions médiastinales (7)
    hilum_L: {
        id: 'hilum_L',
        nameFr: 'Hile pulmonaire gauche',
        nameEn: 'Left pulmonary hilum',
        color: '#d1b892',
        roughness: 0.6,
        metalness: 0.04,
        desc: 'Zone de réflexion pleurale et d\'émergence du pédicule pulmonaire gauche : artère pulmonaire gauche (au sommet), bronche principale gauche (au centre), veines pulmonaires supérieure et inférieure.',
        role: 'hilum',
        subgroup: 'Hiles et pédicules'
    },
    hilum_R: {
        id: 'hilum_R',
        nameFr: 'Hile pulmonaire droit',
        nameEn: 'Right pulmonary hilum',
        color: '#d1b892',
        roughness: 0.6,
        metalness: 0.04,
        desc: 'Porte d\'entrée du pédicule pulmonaire droit : bronche principale droite (au sommet et en arrière), artère pulmonaire droite en avant, veines pulmonaires en bas et en avant.',
        role: 'hilum',
        subgroup: 'Hiles et pédicules'
    },
    hilum_lower_L: {
        id: 'hilum_lower_L',
        nameFr: 'Hile gauche (partie inférieure)',
        nameEn: 'Left lower hilum',
        color: '#d1b892',
        roughness: 0.6,
        metalness: 0.04,
        desc: 'Pôle inférieur du hile gauche accueillant la veine pulmonaire inférieure gauche et le ligament triangulaire du poumon.',
        role: 'hilum',
        subgroup: 'Hiles et pédicules'
    },
    hilum_lower_R: {
        id: 'hilum_lower_R',
        nameFr: 'Hile droit (partie inférieure)',
        nameEn: 'Right lower hilum',
        color: '#d1b892',
        roughness: 0.6,
        metalness: 0.04,
        desc: 'Pôle inférieur du hile droit en relation avec la veine pulmonaire inférieure droite et le ligament pulmonaire.',
        role: 'hilum',
        subgroup: 'Hiles et pédicules'
    },
    hilum_middle_R: {
        id: 'hilum_middle_R',
        nameFr: 'Hile droit (partie moyenne)',
        nameEn: 'Right middle hilum',
        color: '#d1b892',
        roughness: 0.6,
        metalness: 0.04,
        desc: 'Zone intermédiaire du hile droit traversée par les branches vasculaires et bronchiques destinées au lobe moyen.',
        role: 'hilum',
        subgroup: 'Hiles et pédicules'
    },
    hilum_upper_L: {
        id: 'hilum_upper_L',
        nameFr: 'Hile gauche (partie supérieure)',
        nameEn: 'Left upper hilum',
        color: '#d1b892',
        roughness: 0.6,
        metalness: 0.04,
        desc: 'Pôle supérieur du hile gauche surplombé par la branche gauche de l\'artère pulmonaire et la crosse de l\'aorte.',
        role: 'hilum',
        subgroup: 'Hiles et pédicules'
    },
    hilum_upper_R: {
        id: 'hilum_upper_R',
        nameFr: 'Hile droit (partie supérieure)',
        nameEn: 'Right upper hilum',
        color: '#d1b892',
        roughness: 0.6,
        metalness: 0.04,
        desc: 'Pôle supérieur du hile droit en rapport avec la crosse de la veine azygos enjambant la bronche principale droite.',
        role: 'hilum',
        subgroup: 'Hiles et pédicules'
    }
};

/**
 * Table de correspondance pour les variantes orthographiques et de nomenclature du GLB source
 */
const GLB_NAME_VARIANTS = {
    // Anomalies et fautes de frappe de la source
    'left_posetrior_basal_bronchopulmonary_segment': 'left_posetrior_basal_bronchopulmonary_segment',
    'left_posterior_basal_bronchopulmonary_segment': 'left_posetrior_basal_bronchopulmonary_segment',
    'right_posterior_basal': 'right_posterior_basal',

    // Variantes du modèle féminin
    'lingula_superior_bronchopulmonary_segment': 'left_lingula_superior_bronchopulmonary_segment',
    'lingula_inferior_bronchopulmonary_segment': 'left_lingula_inferior_bronchopulmonary_segment',
    'right_lateral_bronchopulmonary_segmennt': 'right_lateral_bronchopulmonary_segment',
    'right_anterior_bronchopulmonary_segm': 'right_anterior_bronchopulmonary_segment',
    'epiglotic_cartilage': 'epiglottic_cartilage',
    'lungs_left_main_bronchus': 'left_main_bronchus',
    'right_main_lobar_bronchus': 'right_main_bronchus',
    'right_inferior_lobar_bronchus': 'right_lower_lobar_bronchus',
    'left_lingula_inferior_bronchi': 'left_lingula_inferior_bronchus',
    'left_posterior_bronchus': 'left_posterior_basal_bronchus',
    'right_posterior_basal_bronchus': 'right_posterior_bronchus'
};

/**
 * Identifie une sous-structure à partir du nom d'un nœud glTF.
 * Supprime le préfixe VH_M_ ou VH_F_ de manière insensible à la casse.
 * @param {string} nodeName
 * @returns {Object|null}
 */
export function identifyLungNode(nodeName) {
    if (!nodeName || typeof nodeName !== 'string') return null;

    // Retirer les préfixes VH_M_ ou VH_F_
    let clean = nodeName.replace(/^VH_[MF]_/i, '').trim();

    // 1. Recherche directe dans la table canonique
    if (LUNG_STRUCTURES[clean]) {
        return { ...LUNG_STRUCTURES[clean], key: clean, rawName: nodeName };
    }

    // 2. Recherche via les variantes et fautes d'orthographe
    const mapped = GLB_NAME_VARIANTS[clean] || GLB_NAME_VARIANTS[clean.toLowerCase()];
    if (mapped && LUNG_STRUCTURES[mapped]) {
        return { ...LUNG_STRUCTURES[mapped], key: mapped, rawName: nodeName };
    }

    // 3. Correspondance insensible à la casse dans LUNG_STRUCTURES
    const lowerClean = clean.toLowerCase();
    for (const key of Object.keys(LUNG_STRUCTURES)) {
        if (key.toLowerCase() === lowerClean) {
            return { ...LUNG_STRUCTURES[key], key, rawName: nodeName };
        }
    }

    return null;
}

export class LungModelManager {
    constructor(opts = {}) {
        this.loader = opts.loader || null;
        this.cache = new Map(); // path -> cloned scene
        this.currentMeshList = [];
        this.clippingEnabled = false;
        this.clipInverted = false;
        this.clipPlaneZ = 0.0;
        this.clipDepthRatio = 0.0; // 0 = poumons entiers (antérieur), 1 = coupe profonde (postérieur)
        this.activeLobe = null; // filtre / surbrillance par lobe
        this.bounds = null;
        this.center = null;
        this.size = null;
        this.clipPlane = null;
        this.THREE = null;
    }

    /**
     * Initialise Three.js et GLTFLoader de manière paresseuse.
     */
    async init() {
        if (!this.THREE) {
            this.THREE = await getThree();
            const LoaderClass = await getGLTFLoader();
            if (!this.loader) {
                this.loader = new LoaderClass();
            }
            this.bounds = new this.THREE.Box3();
            this.center = new this.THREE.Vector3();
            this.size = new this.THREE.Vector3();
            this.clipPlane = new this.THREE.Plane(new this.THREE.Vector3(0, 0, -1), 0);
        }
        return this.THREE;
    }

    /**
     * Charge le modèle pulmonaire du sexe demandé et configure matériaux et centrage.
     * Ne charge qu'un seul fichier à la fois (pas de préchargement simultané).
     * @param {'male'|'female'} sex
     * @param {Function} [onProgress]
     * @returns {Promise<{ root: Object, meshes: Array, bounds: Object, center: Object }>}
     */
    async load(sex = 'female', onProgress = null) {
        const THREE = await this.init();
        const sexKey = sex === 'male' ? 'male' : 'female';
        const url = LUNG_MODELS[sexKey];

        let gltf;
        if (this.cache.has(url)) {
            gltf = this.cache.get(url);
        } else {
            gltf = await new Promise((resolve, reject) => {
                this.loader.load(url, resolve, (xhr) => {
                    if (onProgress && xhr.total > 0) {
                        onProgress(xhr.loaded / xhr.total);
                    }
                }, reject);
            });
            this.cache.set(url, gltf);
        }

        // Cloner la hiérarchie pour manipulation propre
        const root = new THREE.Group();
        root.name = `Lung_${sexKey}`;

        const clonedScene = gltf.scene.clone(true);
        root.add(clonedScene);

        // Analyse et calcul des dimensions réelles
        const initialBox = new THREE.Box3().setFromObject(root);
        initialBox.getCenter(this.center);
        initialBox.getSize(this.size);

        // Auto-centrage au repère d'observation (Y = 0.85 m comme le rein et l'Atlas)
        // et mise à l'échelle standardisée (hauteur d'environ 0.36 m dans le champ visuel)
        const maxDim = Math.max(this.size.x, this.size.y, this.size.z) || 0.3;
        const targetDim = 0.36;
        const scale = targetDim / maxDim;

        root.scale.setScalar(scale);
        root.position.copy(this.center).multiplyScalar(-scale).add(new THREE.Vector3(0, 0.85, 0));
        root.updateMatrixWorld(true);

        // Boîte finale
        this.bounds.setFromObject(root);
        this.bounds.getCenter(this.center);
        this.bounds.getSize(this.size);

        // Réattribution des matériaux par structure
        this.currentMeshList = [];

        clonedScene.traverse((child) => {
            if (child.isMesh) {
                const info = identifyLungNode(child.name) || {
                    id: 'unknown_lung',
                    nameFr: 'Structure respiratoire',
                    nameEn: 'Respiratory structure',
                    color: '#e28880',
                    roughness: 0.5,
                    metalness: 0.05,
                    desc: 'Élément anatomique du système respiratoire.',
                    role: 'parenchyma_segment',
                    subgroup: 'Parenchyme pulmonaire'
                };

                const mat = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(info.color),
                    roughness: info.roughness ?? 0.5,
                    metalness: info.metalness ?? 0.05,
                    side: THREE.DoubleSide,
                    clippingPlanes: (this.clippingEnabled && this.clipPlane) ? [this.clipPlane] : [],
                    clipShadows: true
                });

                child.material = mat;
                child.castShadow = true;
                child.receiveShadow = true;

                const item = {
                    mesh: child,
                    mat,
                    info,
                    baseColor: new THREE.Color(info.color)
                };

                child.userData.lungItem = item;
                this.currentMeshList.push(item);
            }
        });

        // Appliquer le plan de coupe initial
        this.updateClipPlane();

        return { root, meshes: this.currentMeshList, bounds: this.bounds, center: this.center };
    }

    /**
     * Active ou désactive le plan de coupe coronale.
     * @param {boolean} enabled
     */
    setClippingEnabled(enabled) {
        this.clippingEnabled = Boolean(enabled);
        const planes = (this.clippingEnabled && this.clipPlane) ? [this.clipPlane] : [];
        this.currentMeshList.forEach(({ mat }) => {
            mat.clippingPlanes = planes;
            mat.needsUpdate = true;
        });
    }

    /**
     * Inverse le sens de la coupe (antérieur ou postérieur).
     * @param {boolean} [inverted]
     */
    toggleClipInversion(inverted) {
        if (inverted !== undefined) {
            this.clipInverted = Boolean(inverted);
        } else {
            this.clipInverted = !this.clipInverted;
        }
        this.updateClipPlane();
    }

    /**
     * Définit la profondeur de la coupe (0 = poumons entiers, 1 = postérieur).
     * @param {number} ratio
     */
    setClipDepthRatio(ratio) {
        const THREE = this.THREE;
        const clamp = THREE?.MathUtils?.clamp || ((v, min, max) => Math.min(Math.max(v, min), max));
        this.clipDepthRatio = clamp(ratio, 0, 1);

        if (this.clipDepthRatio > 0 && !this.clippingEnabled) {
            this.setClippingEnabled(true);
        } else if (this.clipDepthRatio <= 0 && this.clippingEnabled && !this.clipInverted) {
            this.setClippingEnabled(false);
        }

        this.updateClipPlane();
    }

    /**
     * Met à jour la position et l'orientation du plan de coupe.
     */
    updateClipPlane() {
        if (!this.bounds || !this.clipPlane || this.bounds.isEmpty()) return;
        const THREE = this.THREE;
        const lerp = THREE?.MathUtils?.lerp || ((a, b, t) => a + (b - a) * t);

        const zMin = this.bounds.min.z;
        const zMax = this.bounds.max.z;

        const currentZ = lerp(zMax + 0.002, zMin - 0.002, this.clipDepthRatio);
        this.clipPlaneZ = currentZ;

        if (this.clipInverted) {
            this.clipPlane.normal.set(0, 0, 1);
            this.clipPlane.constant = -currentZ;
        } else {
            this.clipPlane.normal.set(0, 0, -1);
            this.clipPlane.constant = currentZ;
        }
    }

    /**
     * Met en surbrillance une sous-structure spécifique.
     * @param {string|null} selectedId
     */
    select(selectedId) {
        this.currentMeshList.forEach(({ mesh, mat, baseColor, info }) => {
            const isMatch = selectedId && (mesh.name === selectedId || info.key === selectedId || info.id === selectedId);
            if (isMatch) {
                mat.color.set('#00f2fe');
                mat.emissive.set('#004455');
            } else {
                mat.color.copy(baseColor);
                mat.emissive.set('#000000');
            }
        });
    }

    /**
     * Surligne de manière synchrone tous les segments d'un lobe spécifique.
     * @param {string|null} lobeKey 'right_upper' | 'right_middle' | 'right_lower' | 'left_upper' | 'left_lower' | null
     */
    selectLobe(lobeKey) {
        this.activeLobe = lobeKey;
        if (!lobeKey) {
            this.select(null);
            return;
        }

        const lobeMatch = (info) => {
            if (!info.lobe) return false;
            const l = info.lobe.toLowerCase();
            if (lobeKey === 'right_upper') return l.includes('supérieur droit');
            if (lobeKey === 'right_middle') return l.includes('moyen droit');
            if (lobeKey === 'right_lower') return l.includes('inférieur droit');
            if (lobeKey === 'left_upper') return l.includes('supérieur gauche');
            if (lobeKey === 'left_lower') return l.includes('inférieur gauche');
            return false;
        };

        this.currentMeshList.forEach(({ mat, baseColor, info }) => {
            if (lobeMatch(info)) {
                mat.color.set('#38bdf8');
                mat.emissive.set('#0369a1');
            } else {
                mat.color.copy(baseColor);
                mat.emissive.set('#000000');
            }
        });
    }

    /**
     * Isole une sous-structure (masque les autres maillages).
     * @param {string|null} selectedId
     * @param {boolean} isolate
     */
    setIsolate(selectedId, isolate = false) {
        this.currentMeshList.forEach(({ mesh, info }) => {
            if (!isolate || !selectedId) {
                mesh.visible = true;
            } else {
                mesh.visible = (mesh.name === selectedId || info.key === selectedId || info.id === selectedId);
            }
        });
    }

    /**
     * Libère les ressources du gestionnaire.
     */
    dispose() {
        this.currentMeshList.forEach(({ mat }) => mat?.dispose?.());
        this.currentMeshList = [];
        this.cache.clear();
    }
}
