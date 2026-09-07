/**
 * three-atlas-data.js — Données FR + recherche pour l'Atlas MedGame.
 * Port de app/anatomy.ts (Human Atlas, MIT) : 15 systèmes, visibles par défaut, explications.
 * Les noms sources restent EN (BodyParts3D/FMA) ; SEARCH_ALIASES_FR rend la recherche FR naturelle.
 * DA : couleurs adoucies compatibles thème sombre MedGame.
 */

import { DESCRIPTIONS_FR } from './atlas-desc-fr.js?v=1';

export const SYSTEMS = [
    { id: 'skeletal', name: 'Squelette', color: '#e2d9ba', description: "Les os forment la charpente du corps, protègent les organes et servent d'insertion aux muscles." },
    { id: 'muscular', name: 'Muscles', color: '#a85b50', description: 'Les muscles squelettiques produisent le mouvement, stabilisent la posture et produisent de la chaleur.' },
    { id: 'cardiac', name: 'Cœur', color: '#e06055', description: 'Pompe musculaire à 4 cavités : côté droit vers les poumons, côté gauche vers la circulation systémique.' },
    { id: 'sensory', name: 'Organes des sens', color: '#b0c8ce', description: 'Vue, audition, équilibre : tissus spécialisés qui détectent les stimuli avec le système nerveux.' },
    { id: 'arterial', name: 'Artères', color: '#d05245', description: "Les artères portent le sang du cœur vers les tissus (et vers les poumons pour le circuit pulmonaire)." },
    { id: 'venous', name: 'Veines', color: '#5b8fc4', description: 'Les veines ramènent le sang vers le cœur ; les veines pulmonaires ramènent le sang oxygéné.' },
    { id: 'nervous', name: 'Système nerveux', color: '#d8b565', description: 'Encéphale, moelle et nerfs : sensation, mouvement, coordination, régulation automatique.' },
    { id: 'respiratory', name: 'Appareil respiratoire', color: '#c48a94', description: "Les voies aériennes conduisent l'air aux poumons où s'échangent O2 et CO2." },
    { id: 'digestive', name: 'Appareil digestif', color: '#c49a6b', description: 'Dégrade les aliments, absorbe nutriments et eau ; bile et enzymes des glandes annexes.' },
    { id: 'urinary', name: 'Appareil urinaire', color: '#c08060', description: 'Reins (filtration, équilibre hydrique), uretères, vessie, urètre.' },
    { id: 'lymphatic', name: 'Lymphatique', color: '#879f7c', description: 'Drainage lymphatique et surveillance immunitaire (ganglions, organes lymphoïdes).' },
    { id: 'endocrine', name: 'Endocrine', color: '#c5a09a', description: 'Hormones dans le sang : métabolisme, croissance, stress, reproduction.' },
    { id: 'reproductive', name: 'Reproducteur', color: '#bda098', description: 'Organes génitaux internes et externes, glandes mammaires, gamétogenèse et régulation hormonale.' },
    { id: 'pregnancy', name: 'Gestation / Grossesse', color: '#f39c12', description: 'Structures fœto-maternelles : placenta, cordon ombilical, membrane amniotique.' },
    { id: 'integumentary', name: 'Surface corporelle', color: '#ba9b7d', description: 'Repère externe semi-transparent : barrière protectrice, sensation, thermorégulation.' },
    { id: 'connective', name: 'Tissu conjonctif', color: '#aec3bb', description: 'Cartilages, ligaments : soutien, liaison, stabilisation articulaire.' },
];

export const SYSTEM_IDS = SYSTEMS.map((s) => s.id);

export const DEFAULT_VISIBLE = ['cardiac', 'sensory', 'skeletal', 'muscular', 'arterial', 'venous', 'nervous', 'respiratory', 'digestive', 'urinary', 'lymphatic', 'endocrine', 'reproductive', 'pregnancy', 'connective'];

export const EXPLANATIONS_FR = {
    heart: 'Pompe musculaire du thorax : côté droit vers les poumons, côté gauche vers tout le corps.',
    liver: 'Gros organe sous le diaphragme à droite : nutriments, bile, protéines sanguines.',
    brain: 'Organe central du système nerveux : perception, mouvement, mémoire, langage.',
    stomach: 'Poche musculaire entre œsophage et intestin : stockage, acidité, enzymes.',
    spleen: 'Organe lymphoïde en haut à gauche de l’abdomen : filtre le sang, immunité.',
    pancreas: 'Glande digestive + endocrine : enzymes intestinales, insuline et glucagon.',
    'urinary bladder': 'Réservoir musculaire pelvien : stocke l’urine venue des reins.',
    trachea: 'Conduit larynx→bronches, maintenu ouvert par ses cartilages.',
    diaphragm: 'Large muscle thorax/abdomen : en se contractant, il fait entrer l’air.',
};

export function systemById(id) {
    return SYSTEMS.find((s) => s.id === id);
}

export function explanationFr(name) {
    if (!name) return null;
    const hit = DESCRIPTIONS_FR[name.toLowerCase()];
    return hit || null; // pas de fallback générique : la fiche masque le paragraphe
}

/** Dictionnaire EN → FR des structures courantes (noms BodyParts3D/FMA). */
export const NAME_FR = {
    heart: 'Cœur', lung: 'Poumon', liver: 'Foie', kidney: 'Rein', stomach: 'Estomac',
    spleen: 'Rate', pancreas: 'Pancréas', brain: 'Encéphale', trachea: 'Trachée',
    diaphragm: 'Diaphragme', 'urinary bladder': 'Vessie', 'gallbladder': 'Vésicule biliaire',
    thyroid: 'Thyroïde', aorta: 'Aorte', artery: 'Artère', vein: 'Veine', nerve: 'Nerf',
    bone: 'Os', muscle: 'Muscle', rib: 'Côte', vertebra: 'Vertèbre', skull: 'Crâne',
    sternum: 'Sternum', femur: 'Fémur', humerus: 'Humérus', intestine: 'Intestin',
    colon: 'Côlon', bladder: 'Vessie', ureter: 'Uretère', bronchus: 'Bronche',
    atrium: 'Oreillette', ventricle: 'Ventricule', valve: 'Valve', skin: 'Peau',
    eye: 'Œil', ear: 'Oreille', spine: 'Colonne vertébrale', 'spinal cord': 'Moelle épinière',
};

// Moteur de traduction (dictionnaire + grammaire) : voir js/atlas-i18n.js (couverture ~55 %).
export { translateAnatomy as frenchLabel } from './atlas-i18n.js?v=2';

/** Alias FR → requêtes EN pour étudiants (insensible accents/casse). */
export const SEARCH_ALIASES_FR = {
    coeur: ['heart', 'cardiac', 'ventricle', 'atrium', 'aorta', 'valve'],
    foie: ['liver', 'hepatic', 'gallbladder'],
    poumon: ['lung', 'bronch', 'pulmonary', 'trachea', 'pleura'],
    rein: ['kidney', 'renal', 'ureter'],
    vessie: ['bladder', 'urethra'],
    cerveau: ['brain', 'cerebr', 'cortex', 'cerebellum'],
    crane: ['skull', 'cranium', 'mandible', 'maxilla'],
    estomac: ['stomach', 'gastric'],
    rate: ['spleen'],
    pancreas: ['pancreas', 'pancreatic'],
    intestin: ['intestine', 'colon', 'cecum', 'ileum', 'jejunum', 'duodenum', 'rectum', 'appendix'],
    vesicule: ['gallbladder', 'biliary'],
    thyroide: ['thyroid'],
    os: ['bone', 'femur', 'humerus', 'rib', 'vertebra', 'skull', 'tibia', 'fibula', 'pelvis', 'sacrum', 'sternum', 'clavicle', 'scapula'],
    colonne: ['vertebra', 'spine', 'spinal'],
    cote: ['rib', 'costal'],
    muscle: ['muscle', 'musculus'],
    diaphragme: ['diaphragm'],
    vaisseau: ['artery', 'vein', 'vessel'],
    artere: ['artery', 'arterial', 'aorta'],
    veine: ['vein', 'venous', 'vena'],
    nerf: ['nerve', 'nervous'],
    moelle: ['spinal cord', 'medulla'],
    oeil: ['eye', 'optic', 'retina'],
    oreille: ['ear', 'cochlea', 'ossicle'],
    peau: ['skin', 'integument'],
    coeur_valve: ['valve', 'mitral', 'aortic', 'tricuspid'],
    uterus: ['uterus', 'uterine', 'endometrium', 'myometrium', 'cervix'],
    ovaire: ['ovary', 'ovarian', 'follicle'],
    trompe: ['fallopian', 'uterine tube', 'salpinx'],
    vagin: ['vagina', 'vaginal', 'vulva', 'clitoris', 'labia'],
    sein: ['breast', 'mammary', 'nipple', 'areola'],
    mamelon: ['nipple', 'areola', 'tubercle'],
    grossesse: ['pregnancy', 'placenta', 'umbilical', 'amnion', 'chorion'],
    placenta: ['placenta', 'chorionic', 'basal plate'],
};

export function normalizeFr(s) {
    return (s || '')
        .toLowerCase()
        .replace(/œ/g, 'oe')
        .replace(/æ/g, 'ae')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim();
}

/** Étend une requête FR en tokens EN cherchables. */
export function expandQuery(raw) {
    const q = normalizeFr(raw);
    if (!q) return [];
    const out = new Set([q, raw.toLowerCase()]);
    for (const [fr, ens] of Object.entries(SEARCH_ALIASES_FR)) {
        if (q === fr || q.startsWith(fr + ' ') || q.endsWith(' ' + fr) || q.includes(fr)) {
            ens.forEach((e) => out.add(e.toLowerCase()));
            out.add(fr);
        }
    }
    // pluriels simples : poumons→poumon
    if (q.endsWith('s')) out.add(q.slice(0, -1));
    return [...out];
}
