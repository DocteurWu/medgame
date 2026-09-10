/**
 * data/credits.js — Donnees structurees des credits et mentions de MedGame
 * 
 * Version condensee, sobre et directe. Modifiable sans toucher au HTML.
 */

export const CREDITS = {
    appName: 'MedGame',
    version: '1.0.0',
    year: '2026',
    
    // Createur
    creator: {
        name: 'Louaï Hamlat',
        role: 'Fondateur & Lead Developer',
        curriculum: 'Étudiant en 4e année de médecine (Paris Cité), en césure élève-ingénieur à Mines Paris - PSL.'
    },

    // Contributeurs (succinct)
    contributors: [
        { name: 'La Team', role: 'Association', note: 'Soutien et émulation' },
        { name: 'Alexandra Sedes', role: 'Mentorat', note: 'Maintien et impulsion du projet' },
        { name: 'Juliette Constant', role: 'Cas cliniques', note: 'Rédaction et relecture médicale' }
    ],

    // Moteurs & Technologies (compact)
    technologies: ['Three.js', 'Web Audio API', 'JavaScript Vanilla', 'Supabase'],

    // Ressources tierces majeures (liste concise)
    thirdParty: [
        { name: 'Kenney', desc: 'Modèles 3D patients (CC0)' },
        { name: 'BodyParts3D & HuBMAP', desc: 'Atlas 3D (CC BY 4.0 / MIT)' },
        { name: 'PhysioNet PTB-XL', desc: 'Tracés ECG réels (CC BY 4.0)' },
        { name: 'HLS-CMDS (McMaster)', desc: 'Sons auscultatoires (MIT)' },
        { name: 'Nervous System Atlas', desc: 'Neuroanatomie 3D (Apache-2.0 / CC BY-SA 4.0)' }
    ],

    // Contact (collaborations, bugs, retours)
    contact: {
        email: 'hamlat.louai@gmail.com',
        label: 'Retours, signalement de bugs ou collaborations'
    },

    // Mention legale et GPL-3.0 (discret, en petit et italique)
    legal: {
        notice: 'MedGame est un projet éducatif sous licence GPL-3.0. Code source disponible sur demande : hamlat.louai@gmail.com. Ne remplace pas un avis médical.'
    }
};

// Compatibilite navigateur
if (typeof window !== 'undefined') {
    window.CREDITS = CREDITS;
}

// Compatibilite Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CREDITS };
}
