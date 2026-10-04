/**
 * js/echo-engine.js — Moteur de simulation d'échographie d'urgence (POCUS / FAST-Echo)
 * 
 * Modélise les 5 fenêtres ultrasonores standard de l'urgence (ATLS / FAST / BLUE Protocol) :
 * 1. Sous-xyphoïdienne (péricarde, 4 cavités, tamponnade)
 * 2. Espace de Morrison (hépato-rénal, hémopéritoine)
 * 3. Espace spléno-rénal (périsplénique)
 * 4. Fenêtre sus-pubienne (cul-de-sac de Douglas, pelvis)
 * 5. Échographie pleuropulmonaire (glissement pleural, lignes A/B, mode M rivage vs code-barres)
 * 
 * Aucune dépendance DOM — testable avec node:test.
 */

export const ECHO_WINDOWS = {
    SUBXIPHOID: 'subxiphoid',
    MORRISON: 'morrison',
    SPLENORENAL: 'splenorenal',
    PELVIS: 'pelvis',
    LUNG: 'lung'
};

export const ECHO_WINDOW_INFO = {
    subxiphoid: {
        id: 'subxiphoid',
        name: 'Fenêtre Sous-Xyphoïdienne',
        probe: 'Phased Array (Cardiaque)',
        targetOrgans: 'Foie gauche, péricarde, ventricule droit, ventricule gauche',
        searchItem: 'Décollement péricardique anéchogène, cinétique VD',
        normalFinding: 'Péricarde accolé au myocarde (pas de liquide noir), cinétique biventriculaire vigoureuse',
        pathologyFinding: 'Épanchement péricardique anéchogène circonférentiel ± collapsus diastolique du VD'
    },
    morrison: {
        id: 'morrison',
        name: 'Espace de Morrison (Hépato-rénal)',
        probe: 'Convexe (Abdominale)',
        targetOrgans: 'Lobe hépatique droit, rein droit, diaphragme',
        searchItem: 'Hémopéritoine dans le récessus de Morrison (zone la plus déclive de l\'étage sus-mésocolique)',
        normalFinding: 'Continuité tissulaire étroite entre capsule rénale et foie',
        pathologyFinding: 'Liseré ou bande noire anéchogène séparant le foie et le rein droit'
    },
    splenorenal: {
        id: 'splenorenal',
        name: 'Espace Spléno-Rénal',
        probe: 'Convexe (Abdominale)',
        targetOrgans: 'Rate, rein gauche, coupole gauche',
        searchItem: 'Épanchement intrapéritonéal périsplénique ou sous-diaphragmatique',
        normalFinding: 'Interface fine rate-rein gauche sans zone hypoéchogène',
        pathologyFinding: 'Croissant noir anéchogène entre la rate et le rein ou sous la coupole'
    },
    pelvis: {
        id: 'pelvis',
        name: 'Fenêtre Sus-Pubienne (Douglas)',
        probe: 'Convexe (Abdominale)',
        targetOrgans: 'Vessie, cul-de-sac de Douglas, rétro-vésical',
        searchItem: 'Épanchement déclive du petit bassin',
        normalFinding: 'Vessie anéchogène bien délimitée, absence de liquide libre rétro-vésical',
        pathologyFinding: 'Collection anéchogène triangulaire ou étalée en arrière de la vessie'
    },
    lung: {
        id: 'lung',
        name: 'Échographie Pleuropulmonaire (BLUE)',
        probe: 'Linéaire ou Convexe',
        targetOrgans: 'Côtes (ombres acoustiques), ligne pleurale, parenchyme',
        searchItem: 'Glissement pleural (sliding), Lignes A, Lignes B, Mode M (rivage vs code-barres)',
        normalFinding: 'Glissement pleural présent ("fourmis qui marchent"), lignes A horizontales, signe du rivage en mode M',
        pathologyFinding: 'Abolition du glissement pleural + signe du code-barres en mode M (pneumothorax), ou lignes B multiples en fusée (OAP)'
    }
};

/**
 * Cas cliniques FAST-Echo pour le Skill Lab
 */
export const ECHO_CASES = [
    {
        id: 'case_trauma_morrison',
        title: 'Polytraumatisé de la route avec choc hémorragique',
        history: 'Homme de 32 ans, accident moto à haute énergie, TA 80/45 mmHg, FC 125 bpm, abdomen tendu et douloureux à la palpation.',
        correctWindow: ECHO_WINDOWS.MORRISON,
        isPathological: true,
        findings: {
            subxiphoid: { effusion: false, desc: 'Pas d\'épanchement péricardique, bon remplissage ventriculaire.' },
            morrison: { effusion: true, thicknessMm: 18, desc: 'Bande anéchogène de 18 mm dans le récessus de Morrison (hémopéritoine abondant).' },
            splenorenal: { effusion: false, desc: 'Pas de liquide franc visible à gauche.' },
            pelvis: { effusion: true, thicknessMm: 12, desc: 'Lame d\'épanchement rétro-vésicale.' },
            lung: { effusion: false, sliding: true, desc: 'Glissement pleural conservé bilatéralement.' }
        },
        actionQuestion: 'Quelle est la conduite à tenir immédiate face à ce FAST positif chez un patient instable ?',
        correctAction: 'Laparotomie hémostatique écourtée (Damage Control Surgery) en urgence sans passer par le scanner.',
        distractors: [
            'Scanner corps entier avec injection de produit de contraste',
            'Surveillance simple en unité de soins continus',
            'Ponction pleurale en urgence'
        ]
    },
    {
        id: 'case_tamponnade',
        title: 'Malaise et collapsus chez une patiente avec péricardite',
        history: 'Femme de 45 ans suivie pour péricardite aiguë virale, admise pour dyspnée aiguë, turgescence jugulaire et PA pincée 85/70 mmHg.',
        correctWindow: ECHO_WINDOWS.SUBXIPHOID,
        isPathological: true,
        findings: {
            subxiphoid: { effusion: true, thicknessMm: 22, desc: 'Épanchement péricardique circonférentiel de 22 mm avec collapsus diastolique du ventricule droit (tamponnade).' },
            morrison: { effusion: false, desc: 'Espace hépato-rénal sec.' },
            splenorenal: { effusion: false, desc: 'Pas d\'épanchement.' },
            pelvis: { effusion: false, desc: 'Pelvis sec.' },
            lung: { effusion: false, sliding: true, desc: 'Glissement pleural normal.' }
        },
        actionQuestion: 'Quel geste thérapeutique d\'urgence s\'impose immédiatement ?',
        correctAction: 'Péricardiocentèse évacuatrice d\'urgence sous contrôle échographique ou drainage chirurgical.',
        distractors: [
            'Injection de 120 mg de furosémide (Lasilix) IV',
            'Intubation orotrachéale immédiate à fortes pressions',
            'Anticoagulation curative par héparine'
        ]
    },
    {
        id: 'case_pneumothorax_post_kt',
        title: 'Détresse respiratoire brutale après pose de voie veineuse centrale',
        history: 'Patient de 60 ans, pose de voie centrale sous-clavière droite il y a 20 minutes. Apparition d\'une dyspnée brutale avec SpO2 à 86% sous O2.',
        correctWindow: ECHO_WINDOWS.LUNG,
        isPathological: true,
        findings: {
            subxiphoid: { effusion: false, desc: 'Cavités cardiaques sans épanchement.' },
            morrison: { effusion: false, desc: 'Pas d\'hémopéritoine.' },
            splenorenal: { effusion: false, desc: 'Normal.' },
            pelvis: { effusion: false, desc: 'Normal.' },
            lung: { effusion: false, sliding: false, modeM: 'barcode', desc: 'Abolition complète du glissement pleural à droite, signe du code-barres (stratosphère) en mode M.' }
        },
        actionQuestion: 'Quel est le diagnostic échographique formel ?',
        correctAction: 'Pneumothorax sous tension droit d\'origine iatrogène.',
        distractors: [
            'Embolie pulmonaire massive',
            'Syndrome de détresse respiratoire aiguë bilatéral',
            'Hémothorax sous-jacent'
        ]
    }
];

/**
 * Évalue la netteté et la qualité du signal ultrasonore en fonction de la profondeur et du gain
 */
export function evaluateEchoSignal(gainPercent = 50, depthCm = 12, windowId = 'morrison') {
    const gain = Math.max(0, Math.min(100, gainPercent));
    const depth = Math.max(4, Math.min(25, depthCm));

    // Qualité de contraste (optimale entre 40% et 65% de gain)
    let contrastScore = 1.0;
    if (gain < 30) contrastScore = gain / 30; // Image trop sombre
    else if (gain > 75) contrastScore = 1.0 - ((gain - 75) / 50); // Image saturée (bruit)

    // Adaptation de profondeur
    let depthScore = 1.0;
    if (windowId === 'lung' && depth > 8) depthScore = 0.6; // Pour le poumon, haute fréquence / faible profondeur requise
    if (windowId === 'morrison' && depth < 10) depthScore = 0.5; // Pas assez profond pour voir le rein

    return {
        gain,
        depth,
        contrastScore: Math.max(0.1, Math.min(1.0, contrastScore)),
        depthScore: Math.max(0.1, Math.min(1.0, depthScore)),
        isOptimal: contrastScore >= 0.8 && depthScore >= 0.8
    };
}
