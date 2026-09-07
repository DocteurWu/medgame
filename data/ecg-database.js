/**
 * data/ecg-database.js — Base de données clinique pour l'ECG Academy 12 Dérivations
 *
 * Étalonnage médical international standard : 25 mm/s, 10 mm/mV.
 * Intégration hybride :
 * - Signaux réels 12 dérivations issus de PhysioNet PTB-XL (CC-BY 4.0, 100 Hz, 10s)
 * - Modélisation morphologique vectorielle haute fidélité en fallback offline
 *
 * Chaque cas contient :
 * - Métadonnées cliniques (titre, patient, contexte, difficulté)
 * - Métriques physiologiques (FC, rythme, axe, PR, QRS, QTc Bazett)
 * - Fichier de signal réel (signalFile) le cas échéant
 * - Morphologie vectorielle des 12 dérivations
 * - Question QCM avec 4 distracteurs et explications conformes aux référentiels EDN / DFASM
 */

const ECG_DATABASE = [
    {
        id: 'ecg_normal_sinus',
        title: 'Rythme Sinusal Normal',
        category: 'normal',
        difficulty: 'debutant',
        patient: 'Homme de 28 ans, certificat de non contre-indication au sport. Asymptomatique.',
        signalFile: 'assets/data/ecg/ecg_normal_sinus.json',
        signalSource: 'PhysioNet PTB-XL (00001_lr, CC-BY 4.0)',
        metrics: {
            heartRate: 72,
            rhythm: 'Sinusal régulier',
            axis: '+60° (Normal)',
            prInterval: 160, // ms
            qrsDuration: 85,  // ms
            qtcInterval: 410, // ms
            stSegment: 'Isoélectrique',
            tWave: 'Positive et asymétrique'
        },
        morphology: {
            pAmp: 0.15,
            pDur: 0.08,
            prDur: 0.16,
            qrsDur: 0.085,
            stElev: 0,
            tAmp: 0.35,
            tDur: 0.18,
            irregularity: 0,
            leads: {
                DI:   { p: 0.12, q: -0.05, r: 0.8,  s: -0.1,  t: 0.30, st: 0 },
                DII:  { p: 0.18, q: -0.05, r: 1.2,  s: -0.15, t: 0.40, st: 0 },
                DIII: { p: 0.10, q: 0,     r: 0.6,  s: -0.1,  t: 0.20, st: 0 },
                aVR:  { p: -0.15, q: 0,    r: -1.0, s: 0.1,   t: -0.35, st: 0 },
                aVL:  { p: 0.08, q: -0.05, r: 0.5,  s: -0.1,  t: 0.20, st: 0 },
                aVF:  { p: 0.15, q: -0.05, r: 0.9,  s: -0.1,  t: 0.30, st: 0 },
                V1:   { p: 0.08, q: 0,     r: 0.3,  s: -0.9,  t: -0.10, st: 0 },
                V2:   { p: 0.10, q: 0,     r: 0.6,  s: -1.2,  t: 0.35, st: 0 },
                V3:   { p: 0.12, q: -0.05, r: 0.9,  s: -0.8,  t: 0.45, st: 0 },
                V4:   { p: 0.14, q: -0.05, r: 1.3,  s: -0.4,  t: 0.40, st: 0 },
                V5:   { p: 0.13, q: -0.05, r: 1.2,  s: -0.2,  t: 0.35, st: 0 },
                V6:   { p: 0.11, q: -0.05, r: 1.0,  s: -0.1,  t: 0.30, st: 0 }
            }
        },
        question: "Quel est le diagnostic rythmique principal de cet ECG ?",
        options: [
            "Rythme sinusal normal à 72 bpm",
            "Fibrillation atriale normo-carde",
            "Bloc de branche droit incomplet",
            "Repolarisation précoce bénigne"
        ],
        correctIndex: 0,
        explanation: "Le tracé montre un rythme sinusal régulier à 72 bpm : chaque complexe QRS est précédé d'une onde P positive en DII, DIII, aVF et négative en aVR. L'espace PR est normal (160 ms), les QRS sont fins (< 100 ms) et la repolarisation est sans anomalie."
    },
    {
        id: 'ecg_stemi_ant',
        title: 'Infarctus Antéro-Septal Aigu (STEMI)',
        category: 'ischemie',
        difficulty: 'urgence',
        patient: 'Homme de 56 ans, douleur thoracique constrictive rétro-sternale irradiant au bras gauche depuis 1h30.',
        signalFile: 'assets/data/ecg/ecg_stemi_ant.json',
        signalSource: 'PhysioNet PTB-XL (00184_lr, CC-BY 4.0)',
        metrics: {
            heartRate: 88,
            rhythm: 'Sinusal régulier',
            axis: '+45° (Normal)',
            prInterval: 150,
            qrsDuration: 90,
            qtcInterval: 430,
            stSegment: 'Sus-décalage majeur en V1-V4 (onde de Pardee)',
            tWave: 'Positive géante de fusion ST-T'
        },
        morphology: {
            pAmp: 0.15,
            pDur: 0.08,
            prDur: 0.15,
            qrsDur: 0.09,
            stElev: 0.4,
            tAmp: 0.6,
            tDur: 0.22,
            irregularity: 0,
            leads: {
                DI:   { p: 0.12, q: -0.05, r: 0.9,  s: -0.1,  t: 0.35, st: 0.05 },
                DII:  { p: 0.15, q: -0.05, r: 0.8,  s: -0.1,  t: 0.25, st: 0 },
                DIII: { p: 0.08, q: 0,     r: 0.4,  s: -0.2,  t: -0.15, st: -0.15 },
                aVR:  { p: -0.12, q: 0,    r: -0.8, s: 0.1,   t: -0.3, st: 0 },
                aVL:  { p: 0.10, q: -0.05, r: 0.7,  s: -0.1,  t: 0.30, st: 0.08 },
                aVF:  { p: 0.12, q: 0,     r: 0.5,  s: -0.2,  t: -0.10, st: -0.12 },
                V1:   { p: 0.08, q: 0,     r: 0.4,  s: -0.4,  t: 0.60, st: 0.35 },
                V2:   { p: 0.10, q: 0,     r: 0.6,  s: -0.3,  t: 0.85, st: 0.60 },
                V3:   { p: 0.12, q: -0.05, r: 0.8,  s: -0.2,  t: 0.80, st: 0.55 },
                V4:   { p: 0.13, q: -0.05, r: 1.1,  s: -0.1,  t: 0.65, st: 0.40 },
                V5:   { p: 0.12, q: -0.05, r: 1.1,  s: -0.1,  t: 0.40, st: 0.15 },
                V6:   { p: 0.10, q: -0.05, r: 0.9,  s: -0.1,  t: 0.30, st: 0.05 }
            }
        },
        question: "Quelle est l'anomalie électrocardiographique critique visible ici ?",
        options: [
            "Sus-décalage ST convexe vers le haut en V1-V4 (STEMI Antéro-septal)",
            "Péricardite aiguë stade 1 avec sus-décalage concave diffus",
            "Bloc de branche gauche complet aigu",
            "Syndrome de Brugada type 1"
        ],
        correctIndex: 0,
        explanation: "On observe un sus-décalage du segment ST majeur convexe vers le haut (> 2 mm) englobant l'onde T (onde de Pardee) dans le territoire antéro-septal (V1 à V4), avec image en miroir (sous-décalage ST) en DIII et aVF. Il s'agit d'une occlusion aiguë de l'artère interventriculaire antérieure (IVA) nécessitant une coronarographie immédiate (revascularisation en urgence)."
    },
    {
        id: 'ecg_stemi_inf',
        title: 'Infarctus Inférieur Aigu (STEMI)',
        category: 'ischemie',
        difficulty: 'urgence',
        patient: 'Femme de 63 ans, douleur épigastrique intense, sueurs et nausées.',
        signalFile: 'assets/data/ecg/ecg_stemi_inf.json',
        signalSource: 'PhysioNet PTB-XL (00257_lr, CC-BY 4.0)',
        metrics: {
            heartRate: 64,
            rhythm: 'Sinusal régulier',
            axis: '+90° (Vertical)',
            prInterval: 170,
            qrsDuration: 88,
            qtcInterval: 420,
            stSegment: 'Sus-décalage en DII, DIII, aVF',
            tWave: 'Miroir ST- en DI, aVL'
        },
        morphology: {
            pAmp: 0.15,
            pDur: 0.08,
            prDur: 0.17,
            qrsDur: 0.088,
            stElev: 0.3,
            tAmp: 0.45,
            tDur: 0.20,
            irregularity: 0,
            leads: {
                DI:   { p: 0.08, q: 0,     r: 0.6,  s: -0.3,  t: -0.15, st: -0.20 },
                DII:  { p: 0.16, q: -0.1,  r: 1.1,  s: -0.1,  t: 0.50,  st: 0.30 },
                DIII: { p: 0.14, q: -0.15, r: 1.0,  s: -0.1,  t: 0.60,  st: 0.40 },
                aVR:  { p: -0.12, q: 0,    r: -0.7, s: 0.1,   t: -0.25, st: 0 },
                aVL:  { p: 0.05, q: 0,     r: 0.4,  s: -0.4,  t: -0.20, st: -0.25 },
                aVF:  { p: 0.15, q: -0.12, r: 1.1,  s: -0.1,  t: 0.55,  st: 0.35 },
                V1:   { p: 0.08, q: 0,     r: 0.3,  s: -0.8,  t: 0.10,  st: 0 },
                V2:   { p: 0.10, q: 0,     r: 0.6,  s: -1.0,  t: 0.20,  st: -0.10 },
                V3:   { p: 0.12, q: -0.05, r: 0.9,  s: -0.7,  t: 0.25,  st: -0.10 },
                V4:   { p: 0.14, q: -0.05, r: 1.2,  s: -0.3,  t: 0.30,  st: 0 },
                V5:   { p: 0.13, q: -0.05, r: 1.1,  s: -0.1,  t: 0.30,  st: 0 },
                V6:   { p: 0.11, q: -0.05, r: 0.9,  s: -0.1,  t: 0.25,  st: 0 }
            }
        },
        question: "Quel territoire coronaire est principalement touché par cet infarctus ?",
        options: [
            "Territoire Inférieur (Artère Coronaire Droite ou Circonflexe)",
            "Territoire Antéro-septal (Interventriculaire Antérieure)",
            "Territoire Latéral Haut isolé (Diagonale)",
            "Territoire Circonférentiel sous-endocardique"
        ],
        correctIndex: 0,
        explanation: "Le sus-décalage du segment ST dans les dérivations DII, DIII, aVF signe un STEMI du territoire inférieur (généralement occlusion de l'artère coronaire droite). L'image en miroir avec sous-décalage ST en DI et aVL confirme le diagnostic. Penser à enregistrer les dérivations droites (V3R, V4R) pour éliminer une extension au ventricule droit !"
    },
    {
        id: 'ecg_afib',
        title: 'Fibrillation Atriale (FA) Rapide',
        category: 'arythmie',
        difficulty: 'intermediaire',
        patient: 'Homme de 71 ans, palpitations brutales, essoufflement d\'effort.',
        signalFile: 'assets/data/ecg/ecg_afib.json',
        signalSource: 'PhysioNet PTB-XL (04117_lr, CC-BY 4.0)',
        metrics: {
            heartRate: 130,
            rhythm: 'Arythmie complète par fibrillation atriale (ACFA)',
            axis: '+30° (Normal)',
            prInterval: 0,
            qrsDuration: 85,
            qtcInterval: 400,
            stSegment: 'Sous-décalage diffus d\'effort',
            tWave: 'Ondes f rapides et désorganisées (350-600/min)'
        },
        morphology: {
            pAmp: 0,
            pDur: 0,
            prDur: 0,
            qrsDur: 0.085,
            stElev: -0.05,
            tAmp: 0.25,
            tDur: 0.15,
            irregularity: 0.35,
            isAfib: true,
            leads: {
                DI:   { p: 0, q: -0.05, r: 0.8,  s: -0.1,  t: 0.25, st: -0.05 },
                DII:  { p: 0, q: -0.05, r: 1.0,  s: -0.15, t: 0.30, st: -0.08 },
                DIII: { p: 0, q: 0,     r: 0.5,  s: -0.1,  t: 0.15, st: -0.05 },
                aVR:  { p: 0, q: 0,     r: -0.8, s: 0.1,   t: -0.25, st: 0.05 },
                aVL:  { p: 0, q: -0.05, r: 0.5,  s: -0.1,  t: 0.15, st: 0 },
                aVF:  { p: 0, q: -0.05, r: 0.8,  s: -0.1,  t: 0.25, st: -0.05 },
                V1:   { p: 0, q: 0,     r: 0.3,  s: -0.9,  t: 0.15, st: 0 },
                V2:   { p: 0, q: 0,     r: 0.6,  s: -1.1,  t: 0.30, st: -0.05 },
                V3:   { p: 0, q: -0.05, r: 0.9,  s: -0.7,  t: 0.35, st: -0.08 },
                V4:   { p: 0, q: -0.05, r: 1.2,  s: -0.3,  t: 0.30, st: -0.08 },
                V5:   { p: 0, q: -0.05, r: 1.1,  s: -0.15, t: 0.25, st: -0.05 },
                V6:   { p: 0, q: -0.05, r: 0.9,  s: -0.1,  t: 0.20, st: 0 }
            }
        },
        question: "Quels sont les deux critères diagnostiques cardinaux de la Fibrillation Atriale sur cet ECG ?",
        options: [
            "Absence d'ondes P organisées et irrégularité totale des intervalles R-R",
            "Ondes P rétrogrades et dissociation auriculo-ventriculaire",
            "Ondes F régulières en dents de scie et tachycardie à 150 bpm",
            "Élargissement des QRS > 120 ms et axe hyper-droit"
        ],
        correctIndex: 0,
        explanation: "La Fibrillation Atriale (FA) se caractérise par : 1) La disparition totale des ondes P sinusales, remplacées par une trémulation anarchique et rapide de la ligne de base (ondes f à 350-600/min) particulièrement visible en V1 ; 2) Une irrégularité complète des espaces R-R (arythmie complète). Les QRS restent fins en l'absence de bloc de branche associé."
    },
    {
        id: 'ecg_flutter',
        title: 'Flutter Atrial Typique (2:1)',
        category: 'arythmie',
        difficulty: 'intermediaire',
        patient: 'Homme de 68 ans, sensation de cœur qui s\'emballe à 150 bpm régulier.',
        signalFile: 'assets/data/ecg/ecg_flutter.json',
        signalSource: 'PhysioNet PTB-XL (00018_lr, CC-BY 4.0)',
        metrics: {
            heartRate: 150,
            rhythm: 'Flutter atrial à conduction 2:1',
            axis: '+60°',
            prInterval: 0,
            qrsDuration: 85,
            qtcInterval: 390,
            stSegment: 'Masqué par les ondes F',
            tWave: 'Ondes F en "dents de scie" (300/min)'
        },
        morphology: {
            pAmp: 0,
            pDur: 0,
            prDur: 0,
            qrsDur: 0.085,
            stElev: 0,
            tAmp: 0.2,
            tDur: 0.12,
            irregularity: 0,
            isFlutter: true,
            leads: {
                DI:   { p: 0, q: -0.05, r: 0.7,  s: -0.1,  t: 0.2, st: 0 },
                DII:  { p: 0, q: -0.05, r: 1.0,  s: -0.15, t: -0.2, st: 0 },
                DIII: { p: 0, q: 0,     r: 0.6,  s: -0.1,  t: -0.25, st: 0 },
                aVR:  { p: 0, q: 0,     r: -0.8, s: 0.1,   t: 0.2, st: 0 },
                aVL:  { p: 0, q: -0.05, r: 0.4,  s: -0.1,  t: 0.15, st: 0 },
                aVF:  { p: 0, q: -0.05, r: 0.9,  s: -0.1,  t: -0.2, st: 0 },
                V1:   { p: 0, q: 0,     r: 0.3,  s: -0.8,  t: 0.25, st: 0 },
                V2:   { p: 0, q: 0,     r: 0.6,  s: -1.0,  t: 0.3, st: 0 },
                V3:   { p: 0, q: -0.05, r: 0.8,  s: -0.6,  t: 0.3, st: 0 },
                V4:   { p: 0, q: -0.05, r: 1.1,  s: -0.3,  t: 0.25, st: 0 },
                V5:   { p: 0, q: -0.05, r: 1.0,  s: -0.15, t: 0.2, st: 0 },
                V6:   { p: 0, q: -0.05, r: 0.8,  s: -0.1,  t: 0.2, st: 0 }
            }
        },
        question: "Quelle est la fréquence atriale et le rapport de conduction ventriculaire ?",
        options: [
            "Fréquence atriale 300/min avec conduction 2:1 (Fréquence ventriculaire 150/min)",
            "Fréquence atriale 150/min avec conduction 1:1",
            "Fréquence atriale 450/min avec conduction variable 3:1",
            "Tachycardie sinusale à 150/min avec ondes P superposées"
        ],
        correctIndex: 0,
        explanation: "Le flutter atrial commun est une tachycardie par macro-réentrée dans l'oreillette droite. Les ondes F typiques en « dents de scie » (ou toit d'usine) ont une fréquence atriale fixe à 300 bpm, négatives en DII, DIII, aVF. Avec une conduction auriculo-ventriculaire 2:1 classique, la fréquence ventriculaire est strictement de 150 bpm régulière."
    },
    {
        id: 'ecg_bav3',
        title: 'Bloc Auriculo-Ventriculaire Complet (BAV 3)',
        category: 'conduction',
        difficulty: 'urgence',
        patient: 'Femme de 82 ans, syncope à l\'emporte-pièce (syndrome d\'Adams-Stokes). FC = 35 bpm.',
        signalFile: 'assets/data/ecg/ecg_bav3.json',
        signalSource: 'PhysioNet PTB-XL (00959_lr, CC-BY 4.0)',
        metrics: {
            heartRate: 34,
            rhythm: 'Dissociation auriculo-ventriculaire complète',
            axis: '+15°',
            prInterval: 0,
            qrsDuration: 130,
            qtcInterval: 460,
            stSegment: 'Troubles secondaires de repolarisation',
            tWave: 'Ondes P indépendantes à 80 bpm'
        },
        morphology: {
            pAmp: 0.16,
            pDur: 0.09,
            prDur: 0,
            qrsDur: 0.13,
            stElev: 0,
            tAmp: 0.35,
            tDur: 0.22,
            irregularity: 0,
            isBav3: true,
            leads: {
                DI:   { p: 0.12, q: 0,     r: 0.7,  s: -0.2,  t: -0.25, st: 0 },
                DII:  { p: 0.18, q: -0.1,  r: 0.9,  s: -0.3,  t: 0.30,  st: 0 },
                DIII: { p: 0.10, q: 0,     r: 0.5,  s: -0.3,  t: 0.25,  st: 0 },
                aVR:  { p: -0.15, q: 0,    r: -0.8, s: 0.2,   t: -0.25, st: 0 },
                aVL:  { p: 0.08, q: 0,     r: 0.5,  s: -0.1,  t: -0.15, st: 0 },
                aVF:  { p: 0.15, q: -0.05, r: 0.7,  s: -0.3,  t: 0.25,  st: 0 },
                V1:   { p: 0.08, q: 0,     r: 0.2,  s: -1.2,  t: 0.40,  st: 0.1 },
                V2:   { p: 0.10, q: 0,     r: 0.4,  s: -1.4,  t: 0.50,  st: 0.1 },
                V3:   { p: 0.12, q: 0,     r: 0.7,  s: -1.0,  t: 0.45,  st: 0.05 },
                V4:   { p: 0.14, q: -0.1,  r: 1.0,  s: -0.4,  t: -0.30, st: -0.1 },
                V5:   { p: 0.13, q: -0.1,  r: 1.1,  s: -0.2,  t: -0.35, st: -0.1 },
                V6:   { p: 0.11, q: -0.1,  r: 0.9,  s: -0.1,  t: -0.30, st: -0.05 }
            }
        },
        question: "Quel mécanisme électrophysiologique définit le BAV 3 sur ce tracé ?",
        options: [
            "Dissociation complète entre ondes P sinusales régulières et rythme d'échappement ventriculaire lent",
            "Allongement progressif du PR jusqu'à blocage d'une onde P (Luciani-Wenckebach)",
            "Blocage intermittent d'une onde P sur deux sans allongement préalable du PR",
            "Dysfonction sinusale avec pauses prolongées > 3 secondes"
        ],
        correctIndex: 0,
        explanation: "Le BAV 3 (bloc auriculo-ventriculaire complet) est caractérisé par une dissociation AV totale : les oreillettes battent à leur rythme sinusal régulier (ici 80 bpm, ondes P bien visibles qui « marchent » à travers les QRS), tandis que les ventricules battent sous le contrôle d'un stimulateur d'échappement autonome très lent (ici 34 bpm). Indication formelle à la pose d'un stimulateur cardiaque (pacemaker) en urgence !"
    },
    {
        id: 'ecg_rbbb',
        title: 'Bloc de Branche Droit (BBD) Complet',
        category: 'conduction',
        difficulty: 'intermediaire',
        patient: 'Homme de 62 ans, essoufflement modéré d\'effort, antécédent d\'embolie pulmonaire ancienne.',
        signalFile: 'assets/data/ecg/ecg_rbbb.json',
        signalSource: 'PhysioNet PTB-XL (00195_lr, CC-BY 4.0)',
        metrics: {
            heartRate: 75,
            rhythm: 'Sinusal régulier',
            axis: '+110° (Déviation axiale droite)',
            prInterval: 160,
            qrsDuration: 135,
            qtcInterval: 425,
            stSegment: 'Sous-décalage en V1-V2 (discordance)',
            tWave: 'Négative asymétrique en V1-V2'
        },
        morphology: {
            pAmp: 0.14,
            pDur: 0.08,
            prDur: 0.16,
            qrsDur: 0.135,
            stElev: 0,
            tAmp: 0.30,
            tDur: 0.18,
            irregularity: 0,
            isRbbb: true,
            leads: {
                DI:   { p: 0.10, q: -0.05, r: 0.6,  s: -0.7,  t: 0.25, st: 0 },
                DII:  { p: 0.16, q: -0.05, r: 0.9,  s: -0.4,  t: 0.35, st: 0 },
                DIII: { p: 0.12, q: 0,     r: 1.1,  s: -0.2,  t: 0.30, st: 0 },
                aVR:  { p: -0.14, q: 0,    r: -0.6, s: 0.5,   t: -0.25, st: 0 },
                aVL:  { p: 0.06, q: -0.05, r: 0.4,  s: -0.6,  t: 0.15, st: 0 },
                aVF:  { p: 0.15, q: -0.05, r: 1.0,  s: -0.3,  t: 0.35, st: 0 },
                V1:   { p: 0.08, q: 0,     r: 0.5,  s: -0.3,  t: -0.35, st: -0.15 },
                V2:   { p: 0.10, q: 0,     r: 0.6,  s: -0.4,  t: -0.30, st: -0.10 },
                V3:   { p: 0.12, q: -0.05, r: 0.8,  s: -0.5,  t: 0.20, st: 0 },
                V4:   { p: 0.13, q: -0.05, r: 1.0,  s: -0.6,  t: 0.30, st: 0 },
                V5:   { p: 0.12, q: -0.05, r: 1.1,  s: -0.6,  t: 0.35, st: 0 },
                V6:   { p: 0.11, q: -0.05, r: 1.0,  s: -0.65, t: 0.30, st: 0 }
            }
        },
        question: "Quels sont les deux critères cardinaux d'un Bloc de Branche Droit (BBD) complet ?",
        options: [
            "QRS >= 120 ms avec aspect rsR' (« oreilles de lapin ») en V1 et onde S large/traînante en DI et V6",
            "QRS >= 120 ms avec aspect QS en V1 et onde R exclusive large encochée en V6",
            "PR > 200 ms avec disparition complète des ondes P en précordial",
            "Sus-décalage ST en dôme > 2 mm de V1 à V3 sans onde S"
        ],
        correctIndex: 0,
        explanation: "Le BBD complet se définit par : 1) Une durée du complexe QRS >= 120 ms (ici 135 ms) ; 2) Un aspect triphasique rsR' (« oreilles de lapin » ou M-shaped) en V1-V2 avec repolarisation inversée (ST sous-décalé, T négative) ; 3) Une onde S large et traînante en DI, aVL et V5-V6 reflétant le retard d'activation du ventricule droit."
    },
    {
        id: 'ecg_lbbb',
        title: 'Bloc de Branche Gauche (BBG) Complet',
        category: 'conduction',
        difficulty: 'intermediaire',
        patient: 'Homme de 73 ans, hypertendu de longue date, bilan pré-opératoire systématique.',
        signalFile: 'assets/data/ecg/ecg_lbbb.json',
        signalSource: 'PhysioNet PTB-XL (00180_lr, CC-BY 4.0)',
        metrics: {
            heartRate: 70,
            rhythm: 'Sinusal régulier',
            axis: '-20° (Déviation axiale gauche)',
            prInterval: 170,
            qrsDuration: 145,
            qtcInterval: 450,
            stSegment: 'Discordance appropriée (ST- et T- en V5-V6)',
            tWave: 'Aspect QS large en V1, R exclusif large et encoché en V6'
        },
        morphology: {
            pAmp: 0.15,
            pDur: 0.08,
            prDur: 0.17,
            qrsDur: 0.145,
            stElev: 0,
            tAmp: 0.3,
            tDur: 0.20,
            irregularity: 0,
            isLbbb: true,
            leads: {
                DI:   { p: 0.12, q: 0,     r: 1.3,  s: 0,     t: -0.35, st: -0.15 },
                DII:  { p: 0.15, q: 0,     r: 0.8,  s: -0.2,  t: 0.20,  st: 0 },
                DIII: { p: 0.08, q: 0,     r: 0.3,  s: -0.6,  t: 0.25,  st: 0.05 },
                aVR:  { p: -0.12, q: 0,    r: -0.7, s: 0.1,   t: 0.20,  st: 0.05 },
                aVL:  { p: 0.10, q: 0,     r: 1.1,  s: 0,     t: -0.30, st: -0.12 },
                aVF:  { p: 0.12, q: 0,     r: 0.6,  s: -0.4,  t: 0.20,  st: 0 },
                V1:   { p: 0.08, q: 0,     r: 0,    s: -1.6,  t: 0.45,  st: 0.15 },
                V2:   { p: 0.10, q: 0,     r: 0.1,  s: -1.8,  t: 0.50,  st: 0.15 },
                V3:   { p: 0.12, q: 0,     r: 0.2,  s: -1.5,  t: 0.40,  st: 0.10 },
                V4:   { p: 0.14, q: 0,     r: 0.8,  s: -0.5,  t: -0.15, st: 0 },
                V5:   { p: 0.13, q: 0,     r: 1.4,  s: 0,     t: -0.40, st: -0.15 },
                V6:   { p: 0.11, q: 0,     r: 1.3,  s: 0,     t: -0.35, st: -0.15 }
            }
        },
        question: "Quels sont les critères diagnostiques indispensables d'un Bloc de Branche Gauche complet ?",
        options: [
            "Durée QRS >= 120 ms, aspect QS ou rS en V1 et onde R large souvent encochée en V5-V6/DI sans onde Q",
            "Durée QRS < 100 ms avec aspect rsR' en V1 et onde S traînante en V6",
            "Allongement du temps de conduction auriculo-ventriculaire PR > 200 ms",
            "Sus-décalage ST convexe > 2 mm dans toutes les dérivations précordiales"
        ],
        correctIndex: 0,
        explanation: "Le Bloc de Branche Gauche (BBG) complet requiert : 1) Une durée de QRS >= 120 ms (ici 145 ms) ; 2) Un aspect QS ou rS en V1-V2 avec onde T positive ; 3) Une onde R large, empatée ou encochée en plateau (« tour de château ») en V5, V6, DI, aVL avec disparition des ondes q physiologiques et inversion de l'onde T (discordance appropriée)."
    },
    {
        id: 'ecg_bav1',
        title: 'Bloc Auriculo-Ventriculaire du 1er Degré (BAV 1)',
        category: 'conduction',
        difficulty: 'debutant',
        patient: 'Homme de 52 ans, coronarien stable sous bêtabloquant, consultation de suivi cardiologique.',
        signalFile: 'assets/data/ecg/ecg_bav1.json',
        signalSource: 'PhysioNet PTB-XL (00102_lr, CC-BY 4.0)',
        metrics: {
            heartRate: 60,
            rhythm: 'Sinusal régulier avec PR allongé',
            axis: '+45° (Normal)',
            prInterval: 260,
            qrsDuration: 85,
            qtcInterval: 415,
            stSegment: 'Isoélectrique',
            tWave: 'Positive'
        },
        morphology: {
            pAmp: 0.15,
            pDur: 0.08,
            prDur: 0.26,
            qrsDur: 0.085,
            stElev: 0,
            tAmp: 0.35,
            tDur: 0.18,
            irregularity: 0,
            leads: {
                DI:   { p: 0.12, q: -0.05, r: 0.8,  s: -0.1,  t: 0.30, st: 0 },
                DII:  { p: 0.18, q: -0.05, r: 1.1,  s: -0.15, t: 0.40, st: 0 },
                DIII: { p: 0.10, q: 0,     r: 0.6,  s: -0.1,  t: 0.20, st: 0 },
                aVR:  { p: -0.15, q: 0,    r: -0.9, s: 0.1,   t: -0.30, st: 0 },
                aVL:  { p: 0.08, q: -0.05, r: 0.5,  s: -0.1,  t: 0.20, st: 0 },
                aVF:  { p: 0.15, q: -0.05, r: 0.9,  s: -0.1,  t: 0.30, st: 0 },
                V1:   { p: 0.08, q: 0,     r: 0.3,  s: -0.9,  t: 0.10, st: 0 },
                V2:   { p: 0.10, q: 0,     r: 0.6,  s: -1.2,  t: 0.35, st: 0 },
                V3:   { p: 0.12, q: -0.05, r: 0.9,  s: -0.8,  t: 0.45, st: 0 },
                V4:   { p: 0.14, q: -0.05, r: 1.3,  s: -0.4,  t: 0.40, st: 0 },
                V5:   { p: 0.13, q: -0.05, r: 1.2,  s: -0.2,  t: 0.35, st: 0 },
                V6:   { p: 0.11, q: -0.05, r: 1.0,  s: -0.1,  t: 0.30, st: 0 }
            }
        },
        question: "Quel critère électrocardiographique affirme le diagnostic de BAV du 1er degré ?",
        options: [
            "Allongement constant et régulier de l'espace PR > 200 ms avec chaque onde P suivie d'un QRS",
            "Allongement progressif du PR aboutissant au blocage d'une onde P",
            "Ondes P régulières totalement déconnectées des complexes QRS",
            "Blocage intermittent sans signe précurseur d'un QRS sur deux"
        ],
        correctIndex: 0,
        explanation: "Le BAV 1 se définit strictement par un intervalle PR > 200 ms (5 petits carreaux à 25 mm/s), constant et fixe de battement en battement, sans aucune onde P bloquée (chaque onde P conduit aux ventricules avec un rapport 1:1). Il traduit un ralentissement de la conduction le plus souvent au niveau du nœud atrio-ventriculaire, favorisé ici par le traitement bêtabloquant."
    },
    {
        id: 'ecg_wpw',
        title: 'Syndrome de Wolff-Parkinson-White (WPW)',
        category: 'conduction',
        difficulty: 'expert',
        patient: 'Jeune homme de 22 ans, épisodes récurrents de tachycardie paroxystique à début et fin brusques (maladie de Bouveret).',
        signalFile: 'assets/data/ecg/ecg_wpw.json',
        signalSource: 'PhysioNet PTB-XL (02145_lr, CC-BY 4.0)',
        metrics: {
            heartRate: 78,
            rhythm: 'Sinusal avec pré-excitation ventriculaire',
            axis: '+30°',
            prInterval: 95,
            qrsDuration: 130,
            qtcInterval: 430,
            stSegment: 'Troubles secondaires de la repolarisation',
            tWave: 'Inversion de repolarisation en regard de l\'onde delta'
        },
        morphology: {
            pAmp: 0.14,
            pDur: 0.08,
            prDur: 0.095,
            qrsDur: 0.13,
            stElev: 0,
            tAmp: 0.30,
            tDur: 0.18,
            irregularity: 0,
            isWpw: true,
            leads: {
                DI:   { p: 0.12, q: 0,     r: 1.2,  s: -0.1,  t: 0.30, st: 0 },
                DII:  { p: 0.16, q: 0,     r: 1.4,  s: -0.15, t: 0.35, st: 0 },
                DIII: { p: 0.10, q: 0,     r: 0.7,  s: -0.1,  t: 0.20, st: 0 },
                aVR:  { p: -0.14, q: 0,    r: -0.9, s: 0.1,   t: -0.30, st: 0 },
                aVL:  { p: 0.08, q: 0,     r: 0.8,  s: -0.1,  t: 0.20, st: 0 },
                aVF:  { p: 0.15, q: 0,     r: 1.1,  s: -0.1,  t: 0.30, st: 0 },
                V1:   { p: 0.08, q: 0,     r: 1.1,  s: -0.4,  t: -0.30, st: -0.1 },
                V2:   { p: 0.10, q: 0,     r: 1.5,  s: -0.3,  t: -0.25, st: -0.1 },
                V3:   { p: 0.12, q: 0,     r: 1.6,  s: -0.2,  t: 0.25, st: 0 },
                V4:   { p: 0.14, q: 0,     r: 1.5,  s: -0.2,  t: 0.35, st: 0 },
                V5:   { p: 0.13, q: 0,     r: 1.4,  s: -0.1,  t: 0.35, st: 0 },
                V6:   { p: 0.11, q: 0,     r: 1.2,  s: -0.1,  t: 0.30, st: 0 }
            }
        },
        question: "Quelle triade électrocardiographique signe la pré-excitation ventriculaire du syndrome de WPW ?",
        options: [
            "Espace PR court (< 120 ms), onde delta empâtant le pied du QRS et élargissement du QRS",
            "Espace PR allongé (> 200 ms), onde Q de nécrose et sus-décalage ST",
            "Ondes F en toit d'usine, conduction 2:1 et rythme régulier à 150 bpm",
            "Microvoltage des complexes QRS, alternance électrique et tachycardie sinusale"
        ],
        correctIndex: 0,
        explanation: "Le syndrome de Wolff-Parkinson-White (WPW) repose sur la triade de pré-excitation ventriculaire par faisceau accessoire (faisceau de Kent) : 1) Espace PR court < 120 ms ; 2) Onde delta (empâtement caractéristique de la branche ascendante du QRS au début de la dépolarisation) ; 3) Élargissement secondaire du QRS (> 110-120 ms). Risque majeur : fibrillation atriale pré-excitée à conduction antérograde rapide pouvant dégénérer en FV."
    },
    {
        id: 'ecg_lvh',
        title: 'Hypertrophie Ventriculaire Gauche (HVG)',
        category: 'hypertrophie',
        difficulty: 'intermediaire',
        patient: 'Homme de 65 ans avec hypertension artérielle sévère mal contrôlée depuis 15 ans.',
        signalFile: 'assets/data/ecg/ecg_lvh.json',
        signalSource: 'PhysioNet PTB-XL (00138_lr, CC-BY 4.0)',
        metrics: {
            heartRate: 68,
            rhythm: 'Sinusal régulier',
            axis: '-15° (Axe gauche)',
            prInterval: 175,
            qrsDuration: 95,
            qtcInterval: 435,
            stSegment: 'Sous-décalage de surcharge en DI, aVL, V5, V6',
            tWave: 'Négative asymétrique en dérivations latérales'
        },
        morphology: {
            pAmp: 0.16,
            pDur: 0.10,
            prDur: 0.175,
            qrsDur: 0.095,
            stElev: 0,
            tAmp: 0.30,
            tDur: 0.18,
            irregularity: 0,
            isLvh: true,
            leads: {
                DI:   { p: 0.12, q: -0.05, r: 1.4,  s: -0.1,  t: -0.30, st: -0.10 },
                DII:  { p: 0.16, q: -0.05, r: 1.0,  s: -0.2,  t: 0.20,  st: 0 },
                DIII: { p: 0.08, q: 0,     r: 0.3,  s: -0.7,  t: 0.15,  st: 0 },
                aVR:  { p: -0.12, q: 0,    r: -0.6, s: 0.3,   t: 0.20,  st: 0.05 },
                aVL:  { p: 0.10, q: -0.05, r: 1.3,  s: -0.1,  t: -0.25, st: -0.08 },
                aVF:  { p: 0.14, q: -0.05, r: 0.7,  s: -0.3,  t: 0.15,  st: 0 },
                V1:   { p: 0.08, q: 0,     r: 0.2,  s: -2.3,  t: 0.35,  st: 0.10 },
                V2:   { p: 0.10, q: 0,     r: 0.4,  s: -2.6,  t: 0.45,  st: 0.12 },
                V3:   { p: 0.12, q: -0.05, r: 0.7,  s: -1.8,  t: 0.35,  st: 0.05 },
                V4:   { p: 0.14, q: -0.05, r: 1.5,  s: -0.8,  t: 0.15,  st: 0 },
                V5:   { p: 0.13, q: -0.05, r: 2.5,  s: -0.2,  t: -0.40, st: -0.15 },
                V6:   { p: 0.11, q: -0.05, r: 2.2,  s: -0.1,  t: -0.35, st: -0.12 }
            }
        },
        question: "Quel indice de voltage valide formellement l'HVG sur ce tracé ?",
        options: [
            "Indice de Sokolow-Lyon : S en V1 + R en V5 > 35 mm (ici 48 mm)",
            "Indice de Cornell : R en aVR + S en V3 > 28 mm",
            "Critère de Cabrerra : onde R exclusive en V1 > 7 mm",
            "Critères de Sgarbossa positifs avec sus-décalage concordant"
        ],
        correctIndex: 0,
        explanation: "L'indice de Sokolow-Lyon mesure l'amplitude de l'onde S en V1 (ou V2) additionnée à l'onde R en V5 (ou V6). Un total > 35 mm (3.5 mV) signe formellement une Hypertrophie Ventriculaire Gauche (ici S(V1)=23 mm + R(V5)=25 mm = 48 mm). On note également des anomalies secondaires de repolarisation dites de surcharge (sous-décalage ST et inversion de T asymétrique en V5, V6, DI, aVL)."
    },
    {
        id: 'ecg_wellens',
        title: 'Syndrome de Wellens (Sténose Critique de l\'IVA)',
        category: 'ischemie',
        difficulty: 'urgence',
        patient: 'Femme de 54 ans, hospitalisée pour angor instable spontanément résolutif depuis 30 minutes, actuellement indolore.',
        signalFile: 'assets/data/ecg/ecg_wellens.json',
        signalSource: 'PhysioNet PTB-XL (00260_lr, CC-BY 4.0)',
        metrics: {
            heartRate: 74,
            rhythm: 'Sinusal régulier',
            axis: '+60° (Normal)',
            prInterval: 155,
            qrsDuration: 85,
            qtcInterval: 440,
            stSegment: 'Isoélectrique (absence de sus-décalage significatif)',
            tWave: 'Inversion profonde et symétrique des ondes T en V2-V4 (Type B)'
        },
        morphology: {
            pAmp: 0.14,
            pDur: 0.08,
            prDur: 0.155,
            qrsDur: 0.085,
            stElev: 0,
            tAmp: -0.65,
            tDur: 0.22,
            irregularity: 0,
            isWellens: true,
            leads: {
                DI:   { p: 0.12, q: -0.05, r: 0.9,  s: -0.1,  t: 0.25, st: 0 },
                DII:  { p: 0.16, q: -0.05, r: 1.1,  s: -0.15, t: 0.30, st: 0 },
                DIII: { p: 0.10, q: 0,     r: 0.5,  s: -0.1,  t: 0.15, st: 0 },
                aVR:  { p: -0.14, q: 0,    r: -0.8, s: 0.1,   t: -0.25, st: 0 },
                aVL:  { p: 0.08, q: -0.05, r: 0.6,  s: -0.1,  t: 0.20, st: 0 },
                aVF:  { p: 0.15, q: -0.05, r: 0.8,  s: -0.1,  t: 0.25, st: 0 },
                V1:   { p: 0.08, q: 0,     r: 0.3,  s: -0.8,  t: 0.10, st: 0 },
                V2:   { p: 0.10, q: 0,     r: 0.6,  s: -1.0,  t: -0.75, st: 0.02 },
                V3:   { p: 0.12, q: -0.05, r: 0.9,  s: -0.7,  t: -0.85, st: 0.02 },
                V4:   { p: 0.14, q: -0.05, r: 1.2,  s: -0.3,  t: -0.65, st: 0.01 },
                V5:   { p: 0.13, q: -0.05, r: 1.1,  s: -0.15, t: -0.30, st: 0 },
                V6:   { p: 0.11, q: -0.05, r: 0.9,  s: -0.1,  t: 0.15, st: 0 }
            }
        },
        question: "Quelle est la conduite à tenir immédiate devant cet aspect de syndrome de Wellens chez une patiente indolore ?",
        options: [
            "Coronarographie urgente sans épreuve d'effort préalable (sténose critique menaçante de l'IVA proximale)",
            "Réalisation d'une épreuve d'effort maximale sur tapis roulant pour dépister l'ischémie",
            "Retour à domicile sous aspirine et contrôle ECG en consultation dans 1 mois",
            "Injection de thrombolytiques IV en urgence"
        ],
        correctIndex: 0,
        explanation: "Le syndrome de Wellens (Type B ici avec ondes T profondément inversées et symétriques en V2-V4, en période d'indolence) annonce un infarctus antérieur massif imminent par sténose subtotale (> 90%) de l'artère interventriculaire antérieure (IVA) proximale. L'épreuve d'effort est FORMELLEMENT CONTRE-INDIQUÉE (risque d'infarctus ou mort subite). Une coronarographie d'urgence avec angioplastie est requise !"
    },
    {
        id: 'ecg_vt',
        title: 'Tachycardie Ventriculaire (TV) Monomorphe',
        category: 'arythmie',
        difficulty: 'urgence',
        patient: 'Homme de 64 ans avec antécédent d\'infarctus, malaise lipothymique et oppression thoracique.',
        metrics: {
            heartRate: 165,
            rhythm: 'Tachycardie à QRS larges régulière',
            axis: '-120° (Axe nord-ouest extrême)',
            prInterval: 0,
            qrsDuration: 160,
            qtcInterval: 480,
            stSegment: 'Discordance appropriée ST-T',
            tWave: 'Onde T opposée au QRS'
        },
        morphology: {
            pAmp: 0,
            pDur: 0,
            prDur: 0,
            qrsDur: 0.16,
            stElev: 0,
            tAmp: -0.5,
            tDur: 0.16,
            irregularity: 0,
            isVt: true,
            leads: {
                DI:   { p: 0, q: 0, r: -1.2, s: 0, t: 0.4, st: 0.1 },
                DII:  { p: 0, q: 0, r: -1.4, s: 0, t: 0.5, st: 0.15 },
                DIII: { p: 0, q: 0, r: -1.0, s: 0, t: 0.4, st: 0.1 },
                aVR:  { p: 0, q: 0, r: 1.3,  s: 0, t: -0.5, st: -0.15 },
                aVL:  { p: 0, q: 0, r: -0.8, s: 0, t: 0.3, st: 0.1 },
                aVF:  { p: 0, q: 0, r: -1.3, s: 0, t: 0.45, st: 0.15 },
                V1:   { p: 0, q: 0, r: 1.6,  s: -0.2, t: -0.6, st: -0.2 },
                V2:   { p: 0, q: 0, r: 1.8,  s: -0.2, t: -0.7, st: -0.2 },
                V3:   { p: 0, q: 0, r: 1.7,  s: -0.1, t: -0.6, st: -0.15 },
                V4:   { p: 0, q: 0, r: 1.5,  s: 0,    t: -0.5, st: -0.1 },
                V5:   { p: 0, q: 0, r: 1.3,  s: 0,    t: -0.4, st: -0.1 },
                V6:   { p: 0, q: 0, r: 1.1,  s: 0,    t: -0.35, st: -0.05 }
            }
        },
        question: "Devant cette tachycardie régulière à QRS larges chez un patient coronarien, quelle est la règle de sécurité clinique ?",
        options: [
            "Toute tachycardie régulière à QRS larges doit être considérée comme une TV jusqu'à preuve du contraire",
            "Il s'agit d'une tachycardie jonctionnelle bénigne nécessitant de la striadyne",
            "C'est une fibrillation atriale avec bloc de branche droit",
            "C'est un artefact de tremblement musculaire du patient"
        ],
        correctIndex: 0,
        explanation: "Règle d'or : Chez l'adulte (surtout coronarien/cardiomyopathe), toute tachycardie régulière à QRS larges (> 120 ms) est une Tachycardie Ventriculaire (TV) dans > 80% des cas et doit être traitée comme telle (risque de dégénérescence en fibrillation ventriculaire et arrêt cardiaque). Les critères de Brugada (concordance précordiale, onde R en aVR, dissociation AV) confirment l'origine ventriculaire."
    },
    {
        id: 'ecg_hyperkalemia',
        title: 'Hyperkaliémie Sévère (K+ = 7.4 mmol/L)',
        category: 'metabolique',
        difficulty: 'expert',
        patient: 'Homme de 58 ans, insuffisant rénal chronique anurique, faiblesse musculaire proximale intense.',
        metrics: {
            heartRate: 58,
            rhythm: 'Rythme sinusal ralenti',
            axis: '-10°',
            prInterval: 220,
            qrsDuration: 125,
            qtcInterval: 400,
            stSegment: 'Aplatissement',
            tWave: 'Ondes T géantes, pointues, symétriques, à base étroite en tente'
        },
        morphology: {
            pAmp: 0.06,
            pDur: 0.10,
            prDur: 0.22,
            qrsDur: 0.125,
            stElev: 0,
            tAmp: 0.95,
            tDur: 0.14,
            irregularity: 0,
            isHyperK: true,
            leads: {
                DI:   { p: 0.05, q: 0,     r: 0.6,  s: -0.2,  t: 0.6, st: 0 },
                DII:  { p: 0.06, q: -0.05, r: 0.8,  s: -0.3,  t: 0.8, st: 0 },
                DIII: { p: 0.04, q: 0,     r: 0.4,  s: -0.2,  t: 0.5, st: 0 },
                aVR:  { p: -0.05, q: 0,    r: -0.6, s: 0.2,   t: -0.7, st: 0 },
                aVL:  { p: 0.04, q: 0,     r: 0.4,  s: -0.1,  t: 0.4, st: 0 },
                aVF:  { p: 0.05, q: -0.05, r: 0.6,  s: -0.2,  t: 0.7, st: 0 },
                V1:   { p: 0.03, q: 0,     r: 0.3,  s: -0.8,  t: 0.6, st: 0 },
                V2:   { p: 0.04, q: 0,     r: 0.5,  s: -1.0,  t: 1.1, st: 0 },
                V3:   { p: 0.05, q: 0,     r: 0.7,  s: -0.8,  t: 1.2, st: 0 },
                V4:   { p: 0.05, q: -0.05, r: 0.9,  s: -0.4,  t: 1.0, st: 0 },
                V5:   { p: 0.05, q: -0.05, r: 0.8,  s: -0.2,  t: 0.8, st: 0 },
                V6:   { p: 0.04, q: -0.05, r: 0.7,  s: -0.1,  t: 0.6, st: 0 }
            }
        },
        question: "Quel signe électrocardiographique typique révèle l'hyperkaliémie menaçante sur ce tracé ?",
        options: [
            "Ondes T amples, pointues et symétriques « en tente » avec élargissement des QRS",
            "Ondes U proéminentes et allongement de l'espace QT",
            "Microvoltage diffus < 5 mm dans les dérivations périphériques",
            "Onde delta de pré-excitation ventriculaire"
        ],
        correctIndex: 0,
        explanation: "L'hyperkaliémie est une urgence vitale absolue ! Ses signes ECG successifs sont : 1) Ondes T géantes, pointues, symétriques, à base étroite « en tente d'Eskimo » (précoces) ; 2) Allongement du PR et aplatissement/disparition de l'onde P ; 3) Élargissement diffus du QRS qui prend un aspect sinusoïdal pré-agonique. Traitement immédiat : Gluconate de Calcium IVD (cardioprotecteur membranaire) + insuline-glucose + épuration extrarénale."
    },
    {
        id: 'ecg_pericarditis',
        title: 'Péricardite Aiguë (Stade 1)',
        category: 'inflammatoire',
        difficulty: 'intermediaire',
        patient: 'Femme de 24 ans, douleur thoracique augmentée à l\'inspiration profonde et soulagée par l\'antéflexion du buste.',
        metrics: {
            heartRate: 85,
            rhythm: 'Sinusal régulier',
            axis: '+50°',
            prInterval: 140,
            qrsDuration: 80,
            qtcInterval: 390,
            stSegment: 'Sus-décalage diffus concave vers le haut',
            tWave: 'Sous-décalage du segment PQ'
        },
        morphology: {
            pAmp: 0.14,
            pDur: 0.08,
            prDur: 0.14,
            qrsDur: 0.08,
            stElev: 0.18,
            tAmp: 0.40,
            tDur: 0.18,
            irregularity: 0,
            isPericarditis: true,
            leads: {
                DI:   { p: 0.12, q: -0.05, r: 0.8,  s: -0.1,  t: 0.35, st: 0.15, pq: -0.06 },
                DII:  { p: 0.16, q: -0.05, r: 1.1,  s: -0.15, t: 0.45, st: 0.20, pq: -0.08 },
                DIII: { p: 0.10, q: 0,     r: 0.5,  s: -0.1,  t: 0.25, st: 0.10, pq: -0.05 },
                aVR:  { p: -0.14, q: 0,    r: -0.8, s: 0.1,   t: -0.3, st: -0.12, pq: 0.08 },
                aVL:  { p: 0.08, q: -0.05, r: 0.5,  s: -0.1,  t: 0.20, st: 0.12, pq: -0.05 },
                aVF:  { p: 0.14, q: -0.05, r: 0.9,  s: -0.1,  t: 0.35, st: 0.18, pq: -0.07 },
                V1:   { p: 0.08, q: 0,     r: 0.3,  s: -0.9,  t: 0.15, st: 0.05, pq: 0 },
                V2:   { p: 0.10, q: 0,     r: 0.6,  s: -1.1,  t: 0.40, st: 0.20, pq: -0.06 },
                V3:   { p: 0.12, q: -0.05, r: 0.9,  s: -0.7,  t: 0.45, st: 0.22, pq: -0.07 },
                V4:   { p: 0.14, q: -0.05, r: 1.2,  s: -0.3,  t: 0.40, st: 0.20, pq: -0.06 },
                V5:   { p: 0.13, q: -0.05, r: 1.1,  s: -0.15, t: 0.35, st: 0.18, pq: -0.05 },
                V6:   { p: 0.11, q: -0.05, r: 0.9,  s: -0.1,  t: 0.30, st: 0.15, pq: -0.05 }
            }
        },
        question: "Qu'est-ce qui différencie formellement ce tracé de péricardite d'un infarctus du myocarde (STEMI) ?",
        options: [
            "Sus-décalage ST diffus, concave vers le haut, sans onde Q de nécrose ni miroir, associé à un sous-décalage de PQ",
            "Présence d'ondes Q de nécrose précoces en DII, DIII, aVF",
            "Sous-décalage ST en V1-V3 avec sus-décalage en miroir",
            "Élargissement des QRS supérieur à 140 ms"
        ],
        correctIndex: 0,
        explanation: "Les critères de péricardite aiguë (stade 1 de Holtzmann) sont : 1) Sus-décalage ST ubiquitaire/diffus (non systématisé à un territoire coronaire) ; 2) Concavité supérieure du ST (« en selle ») ; 3) Absence d'image en miroir (sauf en aVR) ; 4) Sous-décalage du segment PQ (très spécifique) avec sus-décalage de PQ en aVR ; 5) Absence d'onde Q de nécrose."
    },
    {
        id: 'ecg_torsades',
        title: 'Torsades de Pointes (Syndrome du QT Long)',
        category: 'arythmie',
        difficulty: 'expert',
        patient: 'Femme de 42 ans sous macrolide et hypokaliémie, syncope brutale récidivante.',
        metrics: {
            heartRate: 200,
            rhythm: 'Tachycardie ventriculaire polymorphe hélicoïdale',
            axis: 'Axe ondulant continuellement autour de la ligne isoélectrique',
            prInterval: 0,
            qrsDuration: 180,
            qtcInterval: 580,
            stSegment: 'Non individualisable',
            tWave: 'Torsade hélicoïdale des pointes des QRS'
        },
        morphology: {
            pAmp: 0,
            pDur: 0,
            prDur: 0,
            qrsDur: 0.18,
            stElev: 0,
            tAmp: 0,
            tDur: 0,
            irregularity: 0.2,
            isTorsades: true,
            leads: {
                DI:   { p: 0, q: 0, r: 1.0,  s: -1.0, t: 0, st: 0 },
                DII:  { p: 0, q: 0, r: 1.2,  s: -1.2, t: 0, st: 0 },
                DIII: { p: 0, q: 0, r: 0.9,  s: -0.9, t: 0, st: 0 },
                aVR:  { p: 0, q: 0, r: -1.0, s: 1.0,  t: 0, st: 0 },
                aVL:  { p: 0, q: 0, r: 0.8,  s: -0.8, t: 0, st: 0 },
                aVF:  { p: 0, q: 0, r: 1.1,  s: -1.1, t: 0, st: 0 },
                V1:   { p: 0, q: 0, r: 1.2,  s: -1.2, t: 0, st: 0 },
                V2:   { p: 0, q: 0, r: 1.5,  s: -1.5, t: 0, st: 0 },
                V3:   { p: 0, q: 0, r: 1.6,  s: -1.6, t: 0, st: 0 },
                V4:   { p: 0, q: 0, r: 1.4,  s: -1.4, t: 0, st: 0 },
                V5:   { p: 0, q: 0, r: 1.2,  s: -1.2, t: 0, st: 0 },
                V6:   { p: 0, q: 0, r: 1.0,  s: -1.0, t: 0, st: 0 }
            }
        },
        question: "Quel est le traitement pharmacologique intraveineux de première intention en urgence devant une torsade de pointes ?",
        options: [
            "Sulfate de Magnésium IV (2g en bolus)",
            "Amiodarone (Cordarone) IV",
            "Flécaïnide IV",
            "Adrénaline 1 mg IV directe"
        ],
        correctIndex: 0,
        explanation: "La torsade de pointes est une tachycardie ventriculaire polymorphe favorisée par l'allongement du QT (bradycardie, hypokaliémie, hypomagnésémie, médicaments torsadogènes). Le traitement d'urgence repose sur le Sulfate de Magnésium IV (2g en 2-3 min) qui stabilise la membrane, l'accélération de la fréquence cardiaque (isoprénaline ou sonde d'entraînement) et la correction des anomalies électrolytiques. ATTENTION : l'Amiodarone est formellement contre-indiquée car elle allonge le QT !"
    },
    {
        id: 'ecg_bav2_mobitz1',
        title: 'Bloc AV du 2e Degré Mobitz 1 (Wenckebach)',
        category: 'conduction',
        difficulty: 'intermediaire',
        patient: 'Homme de 48 ans, coureur de semi-marathon, bradycardie asymptomatique au repos découverte lors d\'un bilan systématique.',
        metrics: {
            heartRate: 52,
            rhythm: 'BAV 2 Mobitz 1 avec pauses récurrentes',
            axis: '+55° (Normal)',
            prInterval: 240,
            qrsDuration: 85,
            qtcInterval: 405,
            stSegment: 'Isoélectrique',
            tWave: 'Positive'
        },
        morphology: {
            pAmp: 0.15,
            pDur: 0.08,
            prDur: 0.24,
            qrsDur: 0.085,
            stElev: 0,
            tAmp: 0.35,
            tDur: 0.18,
            irregularity: 0.25,
            isWenckebach: true,
            leads: {
                DI:   { p: 0.12, q: -0.05, r: 0.8,  s: -0.1,  t: 0.30, st: 0 },
                DII:  { p: 0.18, q: -0.05, r: 1.1,  s: -0.15, t: 0.40, st: 0 },
                DIII: { p: 0.10, q: 0,     r: 0.6,  s: -0.1,  t: 0.20, st: 0 },
                aVR:  { p: -0.15, q: 0,    r: -0.9, s: 0.1,   t: -0.30, st: 0 },
                aVL:  { p: 0.08, q: -0.05, r: 0.5,  s: -0.1,  t: 0.20, st: 0 },
                aVF:  { p: 0.15, q: -0.05, r: 0.9,  s: -0.1,  t: 0.30, st: 0 },
                V1:   { p: 0.08, q: 0,     r: 0.3,  s: -0.9,  t: 0.10, st: 0 },
                V2:   { p: 0.10, q: 0,     r: 0.6,  s: -1.2,  t: 0.35, st: 0 },
                V3:   { p: 0.12, q: -0.05, r: 0.9,  s: -0.8,  t: 0.45, st: 0 },
                V4:   { p: 0.14, q: -0.05, r: 1.3,  s: -0.4,  t: 0.40, st: 0 },
                V5:   { p: 0.13, q: -0.05, r: 1.2,  s: -0.2,  t: 0.35, st: 0 },
                V6:   { p: 0.11, q: -0.05, r: 1.0,  s: -0.1,  t: 0.30, st: 0 }
            }
        },
        question: "Quelle séquence temporelle caractérise les périodes de Luciani-Wenckebach (BAV 2 Mobitz 1) ?",
        options: [
            "Allongement progressif de l'espace PR sur plusieurs cycles jusqu'au blocage d'une onde P non suivie de QRS",
            "Blocage imprévisible d'un complexe QRS sans variation préalable de l'intervalle PR (Mobitz 2)",
            "Conduction fixe 2:1 systématique avec onde P bloquée sur deux",
            "Raccourcissement progressif de l'intervalle PR aboutissant à une salve de TV"
        ],
        correctIndex: 0,
        explanation: "Le BAV du deuxième degré type Mobitz 1 (phénomène de Wenckebach) est défini par un allongement progressif de l'intervalle PR de battement en battement jusqu'à ce qu'une onde P soit bloquée (non suivie de QRS). Le cycle reprend ensuite avec un PR court. Ce bloc est quasi-toujours nodal, d'évolution bénigne et souvent réversible (notamment chez le sujet jeune ou sportif à fort tonus vagal)."
    },
    {
        id: 'ecg_brugada',
        title: 'Syndrome de Brugada (Type 1)',
        category: 'canalopathie',
        difficulty: 'expert',
        patient: 'Homme de 36 ans, antécédent familial de mort subite inexpliquée chez son frère à 32 ans, bilan cardiologique.',
        metrics: {
            heartRate: 65,
            rhythm: 'Sinusal régulier',
            axis: '+30°',
            prInterval: 165,
            qrsDuration: 110,
            qtcInterval: 410,
            stSegment: 'Sus-décalage en dôme >= 2 mm en V1-V2 (aspect en cova)',
            tWave: 'Onde T négative et symétrique succédant au sus-décalage'
        },
        morphology: {
            pAmp: 0.14,
            pDur: 0.08,
            prDur: 0.165,
            qrsDur: 0.11,
            stElev: 0.30,
            tAmp: -0.35,
            tDur: 0.18,
            irregularity: 0,
            isBrugada: true,
            leads: {
                DI:   { p: 0.10, q: -0.05, r: 0.8,  s: -0.1,  t: 0.30, st: 0 },
                DII:  { p: 0.16, q: -0.05, r: 1.1,  s: -0.15, t: 0.35, st: 0 },
                DIII: { p: 0.10, q: 0,     r: 0.5,  s: -0.1,  t: 0.20, st: 0 },
                aVR:  { p: -0.14, q: 0,    r: -0.8, s: 0.1,   t: -0.25, st: 0 },
                aVL:  { p: 0.08, q: -0.05, r: 0.6,  s: -0.1,  t: 0.20, st: 0 },
                aVF:  { p: 0.15, q: -0.05, r: 0.9,  s: -0.1,  t: 0.30, st: 0 },
                V1:   { p: 0.08, q: 0,     r: 0.6,  s: -0.1,  t: -0.40, st: 0.35 },
                V2:   { p: 0.10, q: 0,     r: 0.8,  s: -0.1,  t: -0.45, st: 0.40 },
                V3:   { p: 0.12, q: -0.05, r: 0.9,  s: -0.6,  t: 0.20,  st: 0.08 },
                V4:   { p: 0.14, q: -0.05, r: 1.2,  s: -0.3,  t: 0.35,  st: 0 },
                V5:   { p: 0.13, q: -0.05, r: 1.1,  s: -0.15, t: 0.30,  st: 0 },
                V6:   { p: 0.11, q: -0.05, r: 0.9,  s: -0.1,  t: 0.25,  st: 0 }
            }
        },
        question: "Quel aspect électrocardiographique en dérivations précordiales droites définit formellement le Brugada de type 1 ?",
        options: [
            "Sus-décalage ST convexe en dôme >= 2 mm descendant vers une onde T négative en V1-V2 (aspect en cova)",
            "Sus-décalage ST en selle de cheval avec onde T positive ou biphasique",
            "Aspect rsR' avec onde S fine et PR strictement inférieur à 100 ms",
            "Sous-décalage ST horizontal > 1 mm avec ondes T amples pointues et symétriques"
        ],
        correctIndex: 0,
        explanation: "Le pattern de Brugada type 1 est le seul diagnostique per se : il associe un sus-décalage du segment ST >= 2 mm convexe vers le haut « en dôme » (aspect en cova) débutant au sommet de l'onde r' et suivi d'une onde T négative dans au moins une dérivation précordiale droite (V1, V2 positionnées au 4e, 3e ou 2e espace intercostal). Canalopathie sodique (gène SCN5A) à haut risque de fibrillation ventriculaire et mort subite nocturne."
    },
    {
        id: 'ecg_hypokalemia',
        title: 'Hypokaliémie Sévère (K+ = 2.1 mmol/L)',
        category: 'metabolique',
        difficulty: 'expert',
        patient: 'Femme de 35 ans, diarrhée profuse et vomissements depuis 4 jours, crampes musculaires intenses et parésies.',
        metrics: {
            heartRate: 80,
            rhythm: 'Sinusal régulier',
            axis: '+40°',
            prInterval: 180,
            qrsDuration: 90,
            qtcInterval: 540,
            stSegment: 'Sous-décalage diffus en cupule',
            tWave: 'Aplatissement de l\'onde T et onde U proéminente géante'
        },
        morphology: {
            pAmp: 0.16,
            pDur: 0.08,
            prDur: 0.18,
            qrsDur: 0.09,
            stElev: -0.12,
            tAmp: 0.10,
            tDur: 0.16,
            irregularity: 0,
            isHypoK: true,
            leads: {
                DI:   { p: 0.14, q: -0.05, r: 0.8,  s: -0.1,  t: 0.10, st: -0.10 },
                DII:  { p: 0.20, q: -0.05, r: 1.1,  s: -0.15, t: 0.12, st: -0.12 },
                DIII: { p: 0.12, q: 0,     r: 0.5,  s: -0.1,  t: 0.08, st: -0.08 },
                aVR:  { p: -0.15, q: 0,    r: -0.8, s: 0.1,   t: -0.10, st: 0.10 },
                aVL:  { p: 0.10, q: -0.05, r: 0.5,  s: -0.1,  t: 0.08, st: -0.06 },
                aVF:  { p: 0.16, q: -0.05, r: 0.9,  s: -0.1,  t: 0.12, st: -0.10 },
                V1:   { p: 0.10, q: 0,     r: 0.3,  s: -0.8,  t: 0.05, st: -0.05 },
                V2:   { p: 0.12, q: 0,     r: 0.6,  s: -1.0,  t: 0.08, st: -0.10 },
                V3:   { p: 0.14, q: -0.05, r: 0.9,  s: -0.7,  t: 0.10, st: -0.15 },
                V4:   { p: 0.15, q: -0.05, r: 1.2,  s: -0.3,  t: 0.12, st: -0.15 },
                V5:   { p: 0.14, q: -0.05, r: 1.1,  s: -0.15, t: 0.10, st: -0.12 },
                V6:   { p: 0.12, q: -0.05, r: 0.9,  s: -0.1,  t: 0.08, st: -0.10 }
            }
        },
        question: "Quelle modification électrocardiographique majeure expose directement au risque de Torsades de Pointes dans l'hypokaliémie ?",
        options: [
            "Allongement apparent de l'intervalle QT (espace QU) par onde U géante et aplatissement de l'onde T",
            "Élargissement sinusoïdal des QRS avec ondes T pointues et symétriques",
            "Sous-décalage de l'espace PR avec sus-décalage ST ubiquitaire",
            "Microvoltage électrique avec disparition des ondes P"
        ],
        correctIndex: 0,
        explanation: "L'hypokaliémie sévère induit : 1) Un aplatissement voire négativation des ondes T ; 2) L'apparition d'ondes U géantes (> 1 mm et souvent > onde T) en précordial moyen (V2-V4) fusionnant avec l'onde T ; 3) Un allongement apparent majeur de l'espace QT (en réalité intervalle Q-U > 500 ms) ; 4) Un sous-décalage du segment ST en cupule. Ce retard de repolarisation ventriculaire fait le lit des extrasystoles ventriculaires et des Torsades de Pointes !"
    },
    {
        id: 'ecg_dewinter',
        title: 'Équivalent STEMI : Syndrome de de Winter',
        category: 'ischemie',
        difficulty: 'urgence',
        patient: 'Homme de 51 ans, douleur rétro-sternale constrictive insoutenable depuis 45 min sans sus-décalage ST franc.',
        metrics: {
            heartRate: 85,
            rhythm: 'Sinusal régulier',
            axis: '+50° (Normal)',
            prInterval: 150,
            qrsDuration: 90,
            qtcInterval: 430,
            stSegment: 'Sous-décalage ST ascendant > 1-3 mm au point J de V1 à V4',
            tWave: 'Ondes T géantes, pointues et symétriques en précordial antérieur'
        },
        morphology: {
            pAmp: 0.14,
            pDur: 0.08,
            prDur: 0.15,
            qrsDur: 0.09,
            stElev: -0.20,
            tAmp: 0.85,
            tDur: 0.20,
            irregularity: 0,
            isDeWinter: true,
            leads: {
                DI:   { p: 0.12, q: -0.05, r: 0.9,  s: -0.1,  t: 0.35, st: 0 },
                DII:  { p: 0.15, q: -0.05, r: 1.0,  s: -0.15, t: 0.30, st: 0 },
                DIII: { p: 0.08, q: 0,     r: 0.5,  s: -0.1,  t: 0.15, st: 0 },
                aVR:  { p: -0.12, q: 0,    r: -0.8, s: 0.1,   t: -0.25, st: 0.15 },
                aVL:  { p: 0.10, q: -0.05, r: 0.7,  s: -0.1,  t: 0.25, st: 0.05 },
                aVF:  { p: 0.12, q: 0,     r: 0.7,  s: -0.2,  t: 0.20, st: 0 },
                V1:   { p: 0.08, q: 0,     r: 0.4,  s: -0.8,  t: 0.70, st: -0.15 },
                V2:   { p: 0.10, q: 0,     r: 0.6,  s: -1.0,  t: 1.10, st: -0.25 },
                V3:   { p: 0.12, q: -0.05, r: 0.8,  s: -0.8,  t: 1.15, st: -0.25 },
                V4:   { p: 0.14, q: -0.05, r: 1.1,  s: -0.4,  t: 0.90, st: -0.18 },
                V5:   { p: 0.13, q: -0.05, r: 1.2,  s: -0.15, t: 0.50, st: -0.08 },
                V6:   { p: 0.11, q: -0.05, r: 1.0,  s: -0.1,  t: 0.30, st: 0 }
            }
        },
        question: "Pourquoi le syndrome de de Winter est-il considéré comme une urgence coronarienne absolue équivalente à un STEMI ?",
        options: [
            "Il traduit une occlusion aiguë de l'IVA proximale dans 2% des cas sans sus-décalage classique (équivalent STEMI nécessitant une coronarographie immédiate)",
            "Il correspond à une péricardite aiguë constrictive avec tamponnade imminente",
            "C'est un infarctus sous-endocardique stable qui peut attendre 72h avant coronarographie",
            "C'est une variante physiologique du jeune sportif sans danger"
        ],
        correctIndex: 0,
        explanation: "Le syndrome de de Winter (décrit en 2008) associe : 1) Un sous-décalage du segment ST ascendant de 1 à 3 mm au point J de V1 à V4 ; 2) Se poursuivant par des ondes T géantes, pointues et symétriques ; 3) Un discret sus-décalage ST en aVR (0.5 à 1 mm). Il correspond à une occlusion aiguë totale de l'artère IVA proximale sans sus-décalage ST classique. C'est un équivalent STEMI à revasculariser en urgence absolue (coronarographie H24) !"
    }
];

if (typeof window !== 'undefined') {
    window.ECG_DATABASE = ECG_DATABASE;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ECG_DATABASE };
}
