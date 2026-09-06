/**
 * atlas-mapping.js — Zones d'examen clinique MedGame → concepts Human Atlas.
 * Utilisé par l'overlay game.html ("Voir en 3D") et les deep-links atlas.html?focus=.
 * Les `match` sont des sous-chaînes EN insensibles à la casse testées sur
 * part.name + concept.name (BodyParts3D/FMA). Résolution fuzzy côté atlas.js.
 */

export const CLINICAL_ZONE_MAP = {
    torse_cardiaque: {
        label: 'Cœur',
        zone: 'Torse',
        match: ['heart', 'mitral valve', 'aortic valve', 'tricuspid', 'coronary'],
        systems: ['cardiac', 'arterial'],
    },
    torse_pulmonaire: {
        label: 'Poumons',
        zone: 'Torse',
        match: ['lung', 'bronch', 'trachea', 'pleura'],
        systems: ['respiratory'],
    },
    torse_cage: {
        label: 'Cage thoracique',
        zone: 'Torse',
        match: ['rib', 'sternum'],
        systems: ['skeletal'],
    },
    abdomen_foie: {
        label: 'Foie / Vésicule',
        zone: 'Abdomen',
        match: ['liver', 'gallbladder'],
        systems: ['digestive'],
    },
    abdomen_estomac: {
        label: 'Estomac / Rate / Pancréas',
        zone: 'Abdomen',
        match: ['stomach', 'spleen', 'pancreas'],
        systems: ['digestive', 'lymphatic', 'endocrine'],
    },
    abdomen_intestin: {
        label: 'Intestins',
        zone: 'Abdomen',
        match: ['intestine', 'colon', 'ileum', 'jejunum', 'duodenum', 'appendix'],
        systems: ['digestive'],
    },
    abdomen_rein: {
        label: 'Reins',
        zone: 'Abdomen',
        match: ['kidney', 'ureter'],
        systems: ['urinary'],
    },
    tete_cerveau: {
        label: 'Encéphale',
        zone: 'Tête',
        match: ['brain', 'cerebellum', 'cerebr'],
        systems: ['nervous'],
    },
    Rachis: {
        label: 'Rachis',
        zone: 'Dos',
        match: ['vertebra', 'spinal cord'],
        systems: ['skeletal', 'nervous'],
    },
};

/** Cas d'exemple : angor stable → focus cœur + artères. Extensible par cas JSON plus tard. */
export const CASE_ATLAS_PRESETS = {
    cardio_angor_stable: { systems: ['cardiac', 'arterial', 'skeletal'], focusMatch: ['heart', 'coronary'] },
};
