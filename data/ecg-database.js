/**
 * data/ecg-database.js — Base de données clinique pour l'ECG Academy 12 Dérivations
 *
 * Chaque cas contient :
 * - Informations cliniques (titre, patient, contexte, niveau de difficulté)
 * - Métriques physiologiques (FC, rythme, axe, intervalles PR/QRS/QT)
 * - Morphologie vectorielle des 12 dérivations (DI, DII, DIII, aVR, aVL, aVF, V1-V6)
 * - Questions d'évaluation avec distracteurs plausibles et explications détaillées
 */

const ECG_DATABASE = [
    {
        id: 'ecg_normal_sinus',
        title: 'Rythme Sinusal Normal',
        category: 'normal',
        difficulty: 'debutant',
        patient: 'Homme de 28 ans, certificat de non contre-indication au sport.',
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
            // Facteurs de forme spécifiques par dérivation
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
        title: 'Infarctus du Myocarde Antéro-Septal (STEMI)',
        category: 'ischemie',
        difficulty: 'urgence',
        patient: 'Homme de 56 ans, douleur thoracique constrictive rétro-sternale irradiant au bras gauche depuis 1h30.',
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
                DIII: { p: 0.08, q: 0,     r: 0.4,  s: -0.2,  t: -0.15, st: -0.15 }, // Miroir
                aVR:  { p: -0.12, q: 0,    r: -0.8, s: 0.1,   t: -0.3, st: 0 },
                aVL:  { p: 0.10, q: -0.05, r: 0.7,  s: -0.1,  t: 0.30, st: 0.08 },
                aVF:  { p: 0.12, q: 0,     r: 0.5,  s: -0.2,  t: -0.10, st: -0.12 }, // Miroir
                V1:   { p: 0.08, q: 0,     r: 0.4,  s: -0.4,  t: 0.60, st: 0.35 },
                V2:   { p: 0.10, q: 0,     r: 0.6,  s: -0.3,  t: 0.85, st: 0.60 }, // Pardee V2
                V3:   { p: 0.12, q: -0.05, r: 0.8,  s: -0.2,  t: 0.80, st: 0.55 }, // Pardee V3
                V4:   { p: 0.13, q: -0.05, r: 1.1,  s: -0.1,  t: 0.65, st: 0.40 }, // Pardee V4
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
        title: 'Infarctus du Myocarde Inférieur (STEMI)',
        category: 'ischemie',
        difficulty: 'urgence',
        patient: 'Femme de 63 ans, douleur épigastrique intense, sueurs et nausées.',
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
                DI:   { p: 0.08, q: 0,     r: 0.6,  s: -0.3,  t: -0.15, st: -0.20 }, // Miroir
                DII:  { p: 0.16, q: -0.1,  r: 1.1,  s: -0.1,  t: 0.50,  st: 0.30 }, // ST+
                DIII: { p: 0.14, q: -0.15, r: 1.0,  s: -0.1,  t: 0.60,  st: 0.40 }, // ST+ DIII > DII
                aVR:  { p: -0.12, q: 0,    r: -0.7, s: 0.1,   t: -0.25, st: 0 },
                aVL:  { p: 0.05, q: 0,     r: 0.4,  s: -0.4,  t: -0.20, st: -0.25 }, // Miroir
                aVF:  { p: 0.15, q: -0.12, r: 1.1,  s: -0.1,  t: 0.55,  st: 0.35 }, // ST+
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
        metrics: {
            heartRate: 130,
            rhythm: 'Arythmie complète par fibrillation atriale (ACFA)',
            axis: '+30° (Normal)',
            prInterval: 0, // Non mesurable
            qrsDuration: 85,
            qtcInterval: 400,
            stSegment: 'Sous-décalage diffus d\'effort',
            tWave: 'Ondes f rapides et désorganisées (350-600/min)'
        },
        morphology: {
            pAmp: 0, // Pas d'onde P
            pDur: 0,
            prDur: 0,
            qrsDur: 0.085,
            stElev: -0.05,
            tAmp: 0.25,
            tDur: 0.15,
            irregularity: 0.35, // Forte irrégularité R-R
            isAfib: true, // Génération de trémulation de la ligne de base
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
        title: 'Flutter Auriculaire Commun (2:1)',
        category: 'arythmie',
        difficulty: 'intermediaire',
        patient: 'Homme de 68 ans, sensation de cœur qui s\'emballe à 150 bpm régulier.',
        metrics: {
            heartRate: 150,
            rhythm: 'Flutter auriculaire à conduction 2:1',
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
            isFlutter: true, // Ondes en dents de scie 300 bpm
            leads: {
                DI:   { p: 0, q: -0.05, r: 0.7,  s: -0.1,  t: 0.2, st: 0 },
                DII:  { p: 0, q: -0.05, r: 1.0,  s: -0.15, t: -0.2, st: 0 }, // F négatives
                DIII: { p: 0, q: 0,     r: 0.6,  s: -0.1,  t: -0.25, st: 0 },// F négatives
                aVR:  { p: 0, q: 0,     r: -0.8, s: 0.1,   t: 0.2, st: 0 },
                aVL:  { p: 0, q: -0.05, r: 0.4,  s: -0.1,  t: 0.15, st: 0 },
                aVF:  { p: 0, q: -0.05, r: 0.9,  s: -0.1,  t: -0.2, st: 0 }, // F négatives
                V1:   { p: 0, q: 0,     r: 0.3,  s: -0.8,  t: 0.25, st: 0 }, // F positives
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
        explanation: "Le flutter auriculaire commun est une tachycardie par macro-réentrée dans l'oreillette droite. Les ondes F typiques en « dents de scie » (ou toit d'usine) ont une fréquence atriale fixe à 300 bpm, négatives en DII, DIII, aVF. Avec une conduction auriculo-ventriculaire 2:1 classique, la fréquence ventriculaire est strictement de 150 bpm régulière."
    },
    {
        id: 'ecg_bav3',
        title: 'Bloc Auriculo-Ventriculaire Complet (BAV 3)',
        category: 'conduction',
        difficulty: 'urgence',
        patient: 'Femme de 82 ans, syncope à l\'emporte-pièce (syndrome d\'Adams-Stokes). FC = 35 bpm.',
        metrics: {
            heartRate: 34,
            rhythm: 'Dissociation auriculo-ventriculaire complète',
            axis: '+15°',
            prInterval: 0, // Dissociation
            qrsDuration: 130, // Échappement jonctionnel bas / ventriculaire
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
            isBav3: true, // P à 80 bpm, QRS à 34 bpm
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
            qrsDuration: 160, // Très large > 140ms
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
                aVR:  { p: 0, q: 0, r: 1.3,  s: 0, t: -0.5, st: -0.15 }, // R positif en aVR
                aVL:  { p: 0, q: 0, r: -0.8, s: 0, t: 0.3, st: 0.1 },
                aVF:  { p: 0, q: 0, r: -1.3, s: 0, t: 0.45, st: 0.15 },
                V1:   { p: 0, q: 0, r: 1.6,  s: -0.2, t: -0.6, st: -0.2 }, // Concordance positive
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
            prInterval: 220, // PR allongé
            qrsDuration: 125, // Élargissement QRS
            qtcInterval: 400,
            stSegment: 'Aplatissement',
            tWave: 'Ondes T géantes, pointues, symétriques, à base étroite en tente'
        },
        morphology: {
            pAmp: 0.06, // Onde P aplatie
            pDur: 0.10,
            prDur: 0.22,
            qrsDur: 0.125,
            stElev: 0,
            tAmp: 0.95, // T géantes pointues
            tDur: 0.14, // Base étroite
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
                V2:   { p: 0.04, q: 0,     r: 0.5,  s: -1.0,  t: 1.1, st: 0 }, // T géante V2
                V3:   { p: 0.05, q: 0,     r: 0.7,  s: -0.8,  t: 1.2, st: 0 }, // T géante V3
                V4:   { p: 0.05, q: -0.05, r: 0.9,  s: -0.4,  t: 1.0, st: 0 }, // T géante V4
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
            isPericarditis: true, // ST+ concave diffus + PQ-
            leads: {
                DI:   { p: 0.12, q: -0.05, r: 0.8,  s: -0.1,  t: 0.35, st: 0.15, pq: -0.06 },
                DII:  { p: 0.16, q: -0.05, r: 1.1,  s: -0.15, t: 0.45, st: 0.20, pq: -0.08 },
                DIII: { p: 0.10, q: 0,     r: 0.5,  s: -0.1,  t: 0.25, st: 0.10, pq: -0.05 },
                aVR:  { p: -0.14, q: 0,    r: -0.8, s: 0.1,   t: -0.3, st: -0.12, pq: 0.08 }, // PQ+ en aVR
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
        id: 'ecg_lbbb',
        title: 'Bloc de Branche Gauche (BBG) Complet',
        category: 'conduction',
        difficulty: 'intermediaire',
        patient: 'Homme de 73 ans, hypertendu de longue date, bilan pré-opératoire systématique.',
        metrics: {
            heartRate: 70,
            rhythm: 'Sinusal régulier',
            axis: '-20° (Déviation axiale gauche)',
            prInterval: 170,
            qrsDuration: 145, // QRS large >= 120ms
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
                V1:   { p: 0.08, q: 0,     r: 0,    s: -1.6,  t: 0.45,  st: 0.15 }, // QS profond V1
                V2:   { p: 0.10, q: 0,     r: 0.1,  s: -1.8,  t: 0.50,  st: 0.15 },
                V3:   { p: 0.12, q: 0,     r: 0.2,  s: -1.5,  t: 0.40,  st: 0.10 },
                V4:   { p: 0.14, q: 0,     r: 0.8,  s: -0.5,  t: -0.15, st: 0 },
                V5:   { p: 0.13, q: 0,     r: 1.4,  s: 0,     t: -0.40, st: -0.15 }, // R large encoché V5
                V6:   { p: 0.11, q: 0,     r: 1.3,  s: 0,     t: -0.35, st: -0.15 }  // R large encoché V6
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
            qtcInterval: 580, // QT très allongé
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
    }
];

if (typeof window !== 'undefined') {
    window.ECG_DATABASE = ECG_DATABASE;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ECG_DATABASE };
}
