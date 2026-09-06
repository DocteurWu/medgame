/**
 * data/auscultation-database.js — Base de données clinique pour le Stéthoscope Virtuel
 *
 * Chaque cas contient :
 * - Informations cliniques (titre, organe, patient, pathologie, sémiologie)
 * - Foyer anatomique d'écoute maximale
 * - Profil acoustique pour le moteur Web Audio API (fréquences, enveloppes, souffles, râles)
 * - Questions d'évaluation avec distracteurs et explications physiopathologiques détaillées
 */

const AUSCULTATION_DATABASE = [
    {
        id: 'auscult_normal_heart',
        type: 'cardiac',
        title: 'Bruits du Cœur Normaux (B1 - B2)',
        difficulty: 'debutant',
        patient: 'Jeune adulte de 22 ans, examen d\'embauche de routine.',
        optimalHotspot: 'apex',
        secondaryHotspots: ['aortique', 'pulmonaire', 'tricuspide'],
        semiology: 'Rythme régulier à 2 temps. B1 (fermeture mitrale/tricuspide) et B2 (fermeture aortique/pulmonaire) nets, purs, sans souffle ni bruit surajouté.',
        audioParams: {
            heartRate: 70,
            b1Volume: 0.9,
            b1Pitch: 65,  // Hz
            b2Volume: 0.8,
            b2Pitch: 95,  // Hz
            systolicMurmur: 0,
            diastolicMurmur: 0,
            b3: 0,
            b4: 0,
            rub: 0,
            lungSounds: null
        },
        question: "Quelle est la caractéristique auscultatoire normale de ce tracé audio ?",
        options: [
            "Bruits B1 et B2 bien audibles et purs, sans souffle systolique ni diastolique",
            "Bruit de galop protodiastolique B3 isolé",
            "Souffle mésosystolique d'éjection rude",
            "Dédoublement large et fixe du deuxième bruit B2"
        ],
        correctIndex: 0,
        explanation: "L'auscultation cardiaque normale est constituée de deux bruits principaux : B1 marquant le début de la systole ventriculaire (fermeture des valves atrio-ventriculaires mitrale et tricuspide) et B2 marquant le début de la diastole (fermeture des valves sigmoïdes aortique et pulmonaire). Le silence systolique (petit silence) et le silence diastolique (grand silence) sont totalement libres."
    },
    {
        id: 'auscult_as',
        title: 'Rétrécissement Aortique (RA) Serré',
        type: 'cardiac',
        difficulty: 'intermediaire',
        patient: 'Homme de 76 ans, dyspnée d\'effort et vertiges lors de la montée des escaliers.',
        optimalHotspot: 'aortique',
        secondaryHotspots: ['apex', 'carotide_droite'],
        semiology: 'Souffle mésosystolique éjectionnel rude, râpeux, en losange (crescendo-decrescendo), maximal au 2e espace intercostal droit (foyer aortique), irradiant aux vaisseaux du cou (carotides), avec diminution/abolition du B2.',
        audioParams: {
            heartRate: 72,
            b1Volume: 0.8,
            b1Pitch: 65,
            b2Volume: 0.25, // B2 très diminué/aboli
            b2Pitch: 90,
            systolicMurmur: 0.85, // Souffle éjectionnel intense
            systolicMurmurType: 'ejection_diamond', // Forme losangique
            systolicFilter: 400, // Rude
            diastolicMurmur: 0,
            b3: 0,
            b4: 0.3,
            rub: 0
        },
        question: "Quelles sont les caractéristiques séméiologiques typiques de ce souffle cardiaque ?",
        options: [
            "Souffle mésosystolique éjectionnel rude, en losange, maximal au foyer aortique et irradiant aux carotides",
            "Souffle holosystolique en jet de vapeur maximal à l'apex et irradiant à l'aisselle",
            "Souffle protodiastolique doux, humé, maximal le long du bord gauche du sternum",
            "Frottement superficiel péricardique mésocardiaque en va-et-vient"
        ],
        correctIndex: 0,
        explanation: "Le souffle de rétrécissement aortique (RA) est un souffle mésosystolique éjectionnel, débutant après B1, d'intensité maximale au milieu de la systole (forme en losange crescendo-decrescendo), de timbre rude et râpeux (« jet de vapeur comprimé »), maximal au 2e espace intercostal droit et irradiant typiquement aux artères carotides. L'abolition de B2 est un critère classique de sévérité du RA."
    },
    {
        id: 'auscult_mr',
        title: 'Insuffisance Mitrale (IM) Organique',
        type: 'cardiac',
        difficulty: 'intermediaire',
        patient: 'Femme de 52 ans, asthénie et essoufflement d\'apparition progressive.',
        optimalHotspot: 'apex',
        secondaryHotspots: ['aisselle_gauche', 'tricuspide'],
        semiology: 'Souffle holosystolique constant (« en plateau »), doux, de timbre en jet de vapeur, débutant dès B1 et couvrant B2, maximal à la pointe (apex), irradiant vers le creux axillaire gauche.',
        audioParams: {
            heartRate: 78,
            b1Volume: 0.5, // B1 atténué
            b1Pitch: 65,
            b2Volume: 0.8,
            b2Pitch: 95,
            systolicMurmur: 0.9,
            systolicMurmurType: 'holosystolic_plateau', // Plateau
            systolicFilter: 650, // Doux jet de vapeur
            diastolicMurmur: 0,
            b3: 0.4,
            b4: 0,
            rub: 0
        },
        question: "Vers quel site anatomique irradie typiquement ce souffle d'Insuffisance Mitrale ?",
        options: [
            "Vers le creux axillaire gauche (aisselle)",
            "Vers les artères carotides et la fourchette sternale",
            "Vers le dos et les fosses lombaires",
            "Vers l'épigastre et l'hypochondre droit"
        ],
        correctIndex: 0,
        explanation: "L'Insuffisance Mitrale (IM) produit un souffle holosystolique (couvrant toute la systole de B1 à B2 avec une intensité constante « en plateau »), de timbre doux en jet de vapeur, maximal à l'apex (5e espace intercostal gauche sur la ligne médio-claviculaire) et irradiant de manière très caractéristique vers l'aisselle gauche."
    },
    {
        id: 'auscult_ar',
        title: 'Insuffisance Aortique (IA) Chronique',
        type: 'cardiac',
        difficulty: 'expert',
        patient: 'Homme de 48 ans, élargissement de la pression différentielle (160/50 mmHg), souffle découvert à l\'examen.',
        optimalHotspot: 'erb', // 3e EIG / foyer aortique accessoire
        secondaryHotspots: ['aortique', 'apex'],
        semiology: 'Souffle protodiastolique d\'emblée maximal après B2 puis decrescendo, doux, lointain, humé ou aspiratif, mieux perçu au bord gauche du sternum (foyer d\'Erb) patient penché en avant et en expiration bloquée.',
        audioParams: {
            heartRate: 75,
            b1Volume: 0.8,
            b1Pitch: 65,
            b2Volume: 0.6,
            b2Pitch: 95,
            systolicMurmur: 0.3, // Petit souffle systolique d'hyperdébit associé
            systolicMurmurType: 'ejection_diamond',
            systolicFilter: 400,
            diastolicMurmur: 0.85,
            diastolicMurmurType: 'decrescendo', // Decrescendo
            diastolicFilter: 800, // Doux humé
            b3: 0,
            b4: 0,
            rub: 0
        },
        question: "Quelle manœuvre clinique permet d'optimiser l'auscultation du souffle d'Insuffisance Aortique ?",
        options: [
            "Patient assis, penché en avant et en expiration forcée bloquée, avec la membrane du stéthoscope",
            "Patient en décubitus latéral gauche avec la cloche du stéthoscope",
            "Manœuvre de Valsalva en inspiration profonde bloquée",
            "Auscultation en position de Trendelenburg (tête en bas)"
        ],
        correctIndex: 0,
        explanation: "Le souffle d'Insuffisance Aortique (IA) est un souffle diastolique haute fréquence, débutant immédiatement après B2 (protodiastolique decrescendo), doux, lointain et aspiratif (« humé »). Il est maximal le long du bord gauche du sternum (3e EIG / foyer d'Erb) et s'écoute au mieux avec la membrane du stéthoscope, patient assis penché en avant et en expiration complète bloquée."
    },
    {
        id: 'auscult_gallop_b3',
        title: 'Bruit de Galop Protodiastolique (B3) — Insuffisance Cardiaque',
        type: 'cardiac',
        difficulty: 'intermediaire',
        patient: 'Homme de 67 ans, insuffisance cardiaque décompensée avec œdèmes des membres inférieurs et dyspnée.',
        optimalHotspot: 'apex',
        secondaryHotspots: ['tricuspide'],
        semiology: 'Rythme à trois temps avec bruit sourd protodiastolique surajouté (B3) survenant peu après B2, réalisant la cadence d\'un cheval au galop (« Ken-tuc-ky »), maximal à l\'apex en décubitus latéral gauche avec la cloche.',
        audioParams: {
            heartRate: 95,
            b1Volume: 0.8,
            b1Pitch: 65,
            b2Volume: 0.8,
            b2Pitch: 95,
            systolicMurmur: 0,
            diastolicMurmur: 0,
            b3: 0.95, // Galop B3 très net
            b3Pitch: 45, // Bruit très sourd basse fréquence
            b4: 0,
            rub: 0
        },
        question: "Que traduit physiopathologiquement le bruit de galop B3 ?",
        options: [
            "Une mise en tension brutale de la paroi ventriculaire dilatée lors du remplissage passif rapide diastolique",
            "La contraction de l'oreillette contre un ventricule rigide et hypertrophié",
            "La fermeture asynchrone des valves mitrale et tricuspide",
            "La vibration d'une végétation bactérienne sur la valve aortique"
        ],
        correctIndex: 0,
        explanation: "Le galop protodiastolique (B3) survient au début de la diastole lors de la phase de remplissage ventriculaire rapide passif. Il résulte de la décélération brutale de la colonne sanguine entrant dans un ventricule gauche surchargé en volume et compliant/dilaté. C'est un signe clinique majeur d'insuffisance cardiaque gauche chez l'adulte."
    },
    {
        id: 'auscult_pericardial_rub',
        title: 'Frottement Péricardique (Péricardite Aiguë)',
        type: 'cardiac',
        difficulty: 'expert',
        patient: 'Femme de 30 ans, douleur thoracique augmentée en décubitus dorsal et à l\'inspiration.',
        optimalHotspot: 'tricuspide', // Bord gauche sternum
        secondaryHotspots: ['erb', 'apex'],
        semiology: 'Bruit superficiel, rapeux, de va-et-vient (« cuir neuf » ou « feuille de papier froissée »), méso-cardiaque, persistant en apnée (différence avec le frottement pleural) et variable d\'une heure à l\'autre.',
        audioParams: {
            heartRate: 86,
            b1Volume: 0.7,
            b1Pitch: 65,
            b2Volume: 0.7,
            b2Pitch: 95,
            systolicMurmur: 0,
            diastolicMurmur: 0,
            b3: 0,
            b4: 0,
            rub: 0.9, // Frottement péricardique va-et-vient
            rubFilter: 500
        },
        question: "Quel test simple au lit du malade permet de différencier avec certitude un frottement péricardique d'un frottement pleural ?",
        options: [
            "Demander au patient de bloquer sa respiration en apnée : le frottement péricardique persiste, le frottement pleural disparaît",
            "Passer de la position assise à la position allongée",
            "Utiliser la cloche au lieu de la membrane du stéthoscope",
            "Faire réaliser un effort de toux vigoureux"
        ],
        correctIndex: 0,
        explanation: "Le frottement péricardique est synchrone des bruits du cœur (systole et diastole). En demandant au patient de se mettre en apnée complète, le frottement pleural disparaît immédiatement car les feuillets pleuraux ne bougent plus, alors que le frottement péricardique persiste car le cœur continue de battre."
    },
    {
        id: 'auscult_normal_lung',
        type: 'pulmonary',
        title: 'Murmure Vésiculaire Normal',
        difficulty: 'debutant',
        patient: 'Adulte sain de 26 ans, respiration calme et régulière.',
        optimalHotspot: 'poumon_apex_droit',
        secondaryHotspots: ['poumon_base_droite', 'poumon_base_gauche', 'poumon_champs_moyen'],
        semiology: 'Murmure vésiculaire doux, continu, symétrique, bien perçu aux deux champs pulmonaires, prédominant à l\'inspiration et au début de l\'expiration, sans râle ni bruit adventice.',
        audioParams: {
            respiratoryRate: 15,
            vesicularVolume: 0.85,
            crackles: 0,
            wheezing: 0,
            pleuralRub: 0,
            stridor: 0
        },
        question: "Sur quel temps du cycle respiratoire le murmure vésiculaire normal est-il le plus audible ?",
        options: [
            "À l'inspiration (3/4 du temps d'écoute) et au tout début de l'expiration",
            "Exclusivement à la fin de l'expiration",
            "De manière égale et prolongée sur toute l'expiration",
            "Uniquement lors de la toux"
        ],
        correctIndex: 0,
        explanation: "Le murmure vésiculaire normal correspond au bruit du flux d'air laminaire dans les alvéoles et bronchioles terminales. Il est doux, feutré, audible pendant toute la phase inspiratoire et s'éteint au premier tiers de la phase expiratoire."
    },
    {
        id: 'auscult_crackles',
        type: 'pulmonary',
        title: 'Râles Crépitants Fins (Pneumonie / OAP)',
        difficulty: 'intermediaire',
        patient: 'Homme de 74 ans, toux productive avec fièvre, essoufflement et saturation à 91%.',
        optimalHotspot: 'poumon_base_droite',
        secondaryHotspots: ['poumon_base_gauche', 'poumon_champs_moyen'],
        semiology: 'Bruits adventices discontinus, brefs, non musicaux, comparables au bruit de pas dans la neige fraîche ou au décollement du Velcro, survenant en fin d\'inspiration (« crépitants télé-inspiratoires »), non modifiés par la toux.',
        audioParams: {
            respiratoryRate: 22,
            vesicularVolume: 0.6,
            crackles: 0.95, // Nombreux crépitants
            cracklesDensity: 24, // Impulsions/cycle
            cracklesPitch: 1200, // Fins
            wheezing: 0,
            pleuralRub: 0,
            stridor: 0
        },
        question: "À quel phénomène acoustique et mécanique correspondent les râles crépitants fins télé-inspiratoires ?",
        options: [
            "À l'ouverture explosive en fin d'inspiration de bronchioles distales et d'alvéoles préalablement collabées par du liquide ou de l'exsudat",
            "À la vibration de sécrétions épaisses et fluides dans les gros troncs bronchiques",
            "Au rétrécissement du calibre des petites voies aériennes par spasme bronchique",
            "Au glissement rugueux de deux feuillets pleuraux enflammés"
        ],
        correctIndex: 0,
        explanation: "Les râles crépitants sont des bruits discontinus de fin d'inspiration causés par la réouverture brutale et explosive des voies aériennes distales et alvéoles collées par de l'œdème (OAP cardiogénique) ou de l'exsudat inflammatoire (pneumonie franche lobaire aiguë). Ils ne sont pas modifiés par la toux (contrairement aux râles bronchiques/ronchus)."
    },
    {
        id: 'auscult_wheezing',
        type: 'pulmonary',
        title: 'Râles Sibilants Polyphoniques (Crise d\'Asthme / BPCO)',
        difficulty: 'intermediaire',
        patient: 'Femme de 28 ans, crise d\'angoisse respiratoire nocturne avec sifflements audibles à distance.',
        optimalHotspot: 'poumon_champs_moyen',
        secondaryHotspots: ['poumon_apex_gauche', 'poumon_base_droite', 'poumon_base_gauche'],
        semiology: 'Râles continus, musicaux, de tonalité aiguë, prédominant très nettement à l\'expiration qui est prolongée (sifflements de tonalités multiples polyphoniques), audibles sur l\'ensemble des deux champs pulmonaires.',
        audioParams: {
            respiratoryRate: 26,
            vesicularVolume: 0.4,
            crackles: 0,
            wheezing: 0.95, // Sibilants intenses
            wheezingPitches: [450, 680, 890, 1150], // Polyphoniques
            pleuralRub: 0,
            stridor: 0
        },
        question: "Quel mécanisme sous-jacent est responsable de la production des râles sibilants dans l'asthme ?",
        options: [
            "La bronchoconstriction et l'œdème réduisant la lumière des bronchioles, faisant vibrer l'air à grande vitesse à l'expiration",
            "L'encombrement alvéolaire par des sécrétions purulentes",
            "Une paralysie de la corde vocale gauche",
            "La présence d'un épanchement liquidien dans la cavité pleurale"
        ],
        correctIndex: 0,
        explanation: "Les sibilants sont des bruits continus musicaux et aigus provoqués par la mise en vibration des parois bronchiques rétrécies (bronchospasme, œdème muqueux et hypersécrétion de mucus). La limitation du flux aérien prédomine lors de l'expiration qui devient freinée et très prolongée."
    },
    {
        id: 'auscult_stridor',
        type: 'pulmonary',
        title: 'Stridor Laryngé / Trachéal (Obstruction Voies Supérieures)',
        difficulty: 'expert',
        patient: 'Enfant de 4 ans ou adulte suspect d\'œdème de Quincke, détresse respiratoire avec tirage sous-maxillaire.',
        optimalHotspot: 'trachee',
        secondaryHotspots: ['poumon_apex_droit', 'poumon_apex_gauche'],
        semiology: 'Bruit musical rude, intense, de tonalité aiguë, exclusivement ou très majoritairement inspiratoire, maximal au niveau du larynx et de la trachée, traduisant une obstruction des voies aériennes supérieures extra-thoraciques.',
        audioParams: {
            respiratoryRate: 28,
            vesicularVolume: 0.3,
            crackles: 0,
            wheezing: 0,
            pleuralRub: 0,
            stridor: 0.95,
            stridorPitch: 850
        },
        question: "Devant un stridor inspiratoire aigu, quelle est la priorité diagnostique et thérapeutique immédiate ?",
        options: [
            "Évaluer d'urgence la perméabilité des voies aériennes supérieures (risque d'asphyxie aiguë / œdème laryngé)",
            "Réaliser une spirométrie pour mesurer le VEMS",
            "Prescrire des antibiotiques par voie orale pour 7 jours",
            "Mettre en place une kinésithérapie respiratoire de désencombrement"
        ],
        correctIndex: 0,
        explanation: "Le stridor est un bruit inspiratoire aigu traduisant un rétrécissement critique du larynx ou de la trachée (corps étranger, épiglottite, laryngite sous-glottique, œdème de Quincke). C'est une extrême urgence vitale menaçant la liberté des voies aériennes qui nécessite une prise en charge immédiate (oxygénothérapie, aérosol d'adrénaline/corticoïdes, prêt à l'intubation ou trachéotomie)."
    }
];

if (typeof window !== 'undefined') {
    window.AUSCULTATION_DATABASE = AUSCULTATION_DATABASE;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AUSCULTATION_DATABASE };
}
