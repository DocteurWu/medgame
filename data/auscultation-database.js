/**
 * data/auscultation-database.js — Base de données clinique pour le Stéthoscope Virtuel
 *
 * Chaque cas contient :
 * - Informations cliniques (titre, organe, patient, pathologie, sémiologie)
 * - Foyer anatomique d'écoute maximale et foyers secondaires
 * - Audio réel (fichiers WAV issus du dataset mannequin HLS-CMDS, IEEE 2025, licence MIT)
 * - Profil acoustique de fallback pour le moteur Web Audio API (synthèse physique temps réel)
 * - Questions d'évaluation avec distracteurs et explications physiopathologiques détaillées (DFASM/EDN)
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
        audioFiles: {
            'apex': 'assets/audio/auscultation/heart/F_N_A.wav',
            'aortique': 'assets/audio/auscultation/heart/M_N_RUSB.wav',
            'pulmonaire': 'assets/audio/auscultation/heart/F_N_LUSB.wav',
            'tricuspide': 'assets/audio/auscultation/heart/M_N_LLSB.wav'
        },
        semiology: 'Rythme régulier à 2 temps. B1 (fermeture mitrale/tricuspide) et B2 (fermeture aortique/pulmonaire) nets, purs, sans souffle ni bruit surajouté.',
        audioParams: {
            heartRate: 70,
            b1Volume: 0.9,
            b1Pitch: 65,
            b2Volume: 0.8,
            b2Pitch: 95,
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
        // Conservé en synthèse : la séméiologie stricte enseignée exige l'abolition du B2
        // et l'irradiation carotidienne, que les fichiers génériques MSM du mannequin ne reproduisent pas fidèlement.
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
        audioFiles: {
            'apex': 'assets/audio/auscultation/heart/F_LSM_A.wav'
        },
        semiology: 'Souffle holosystolique constant (« en plateau »), doux, de timbre en jet de vapeur, débutant dès B1 et couvrant B2, maximal à la pointe (apex), irradiant vers le creux axillaire gauche.',
        audioParams: {
            heartRate: 78,
            b1Volume: 0.5,
            b1Pitch: 65,
            b2Volume: 0.8,
            b2Pitch: 95,
            systolicMurmur: 0.9,
            systolicMurmurType: 'holosystolic_plateau',
            systolicFilter: 650,
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
        optimalHotspot: 'erb',
        secondaryHotspots: ['aortique', 'apex'],
        audioFiles: {
            'erb': 'assets/audio/auscultation/heart/F_LDM_LLSB.wav',
            'tricuspide': 'assets/audio/auscultation/heart/F_LDM_LLSB.wav',
            'aortique': 'assets/audio/auscultation/heart/F_LDM_LUSB.wav',
            'apex': 'assets/audio/auscultation/heart/F_LDM_A.wav'
        },
        semiology: 'Souffle protodiastolique d\'emblée maximal après B2 puis decrescendo, doux, lointain, humé ou aspiratif, mieux perçu au bord gauche du sternum (foyer d\'Erb) patient penché en avant et en expiration bloquée.',
        audioParams: {
            heartRate: 75,
            b1Volume: 0.8,
            b1Pitch: 65,
            b2Volume: 0.6,
            b2Pitch: 95,
            systolicMurmur: 0.3,
            systolicMurmurType: 'ejection_diamond',
            systolicFilter: 400,
            diastolicMurmur: 0.85,
            diastolicMurmurType: 'decrescendo',
            diastolicFilter: 800,
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
        audioFiles: {
            'apex': 'assets/audio/auscultation/heart/F_S3_A.wav',
            'tricuspide': 'assets/audio/auscultation/heart/M_S3_LLSB.wav'
        },
        semiology: 'Rythme à trois temps avec bruit sourd protodiastolique surajouté (B3) survenant peu après B2, réalisant la cadence d\'un cheval au galop (« Ken-tuc-ky »), maximal à l\'apex en décubitus latéral gauche avec la cloche.',
        audioParams: {
            heartRate: 95,
            b1Volume: 0.8,
            b1Pitch: 65,
            b2Volume: 0.8,
            b2Pitch: 95,
            systolicMurmur: 0,
            diastolicMurmur: 0,
            b3: 0.95,
            b3Pitch: 45,
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
        optimalHotspot: 'tricuspide',
        secondaryHotspots: ['erb', 'apex'],
        // Absent du dataset HLS-CMDS -> synthèse physique temps réel conservée
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
            rub: 0.9,
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
        audioFiles: {
            'poumon_apex_droit': 'assets/audio/auscultation/lung/M_N_RUA.wav',
            'poumon_apex_gauche': 'assets/audio/auscultation/lung/F_N_LUA.wav',
            'poumon_champs_moyen': 'assets/audio/auscultation/lung/M_N_RMA.wav',
            'poumon_base_droite': 'assets/audio/auscultation/lung/M_N_RLA.wav',
            'poumon_base_gauche': 'assets/audio/auscultation/lung/M_N_LLA.wav'
        },
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
        audioFiles: {
            'poumon_base_droite': 'assets/audio/auscultation/lung/F_FC_RLA.wav',
            'poumon_base_gauche': 'assets/audio/auscultation/lung/M_FC_RLA.wav',
            'poumon_champs_moyen': 'assets/audio/auscultation/lung/M_FC_LUA.wav'
        },
        semiology: 'Bruits adventices discontinus, brefs, non musicaux, comparables au bruit de pas dans la neige fraîche ou au décollement du Velcro, survenant en fin d\'inspiration (« crépitants télé-inspiratoires »), non modifiés par la toux.',
        audioParams: {
            respiratoryRate: 22,
            vesicularVolume: 0.6,
            crackles: 0.95,
            cracklesDensity: 24,
            cracklesPitch: 1200,
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
        audioFiles: {
            'poumon_champs_moyen': 'assets/audio/auscultation/lung/M_W_RMA.wav',
            'poumon_apex_gauche': 'assets/audio/auscultation/lung/M_W_LUA.wav',
            'poumon_base_droite': 'assets/audio/auscultation/lung/M_W_RLA.wav',
            'poumon_base_gauche': 'assets/audio/auscultation/lung/M_W_LLA.wav'
        },
        semiology: 'Râles continus, musicaux, de tonalité aiguë, prédominant très nettement à l\'expiration qui est prolongée (sifflements de tonalités multiples polyphoniques), audibles sur l\'ensemble des deux champs pulmonaires.',
        audioParams: {
            respiratoryRate: 26,
            vesicularVolume: 0.4,
            crackles: 0,
            wheezing: 0.95,
            wheezingPitches: [450, 680, 890, 1150],
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
        // Absent du dataset HLS-CMDS -> synthèse physique temps réel conservée
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
    },

    // =========================================================================
    // NOUVEAUX CAS CARDIOLOGIQUES ISSUS DU DATASET HLS-CMDS
    // =========================================================================
    {
        id: 'auscult_af',
        type: 'cardiac',
        title: 'Fibrillation Atriale (ACFA)',
        difficulty: 'intermediaire',
        patient: 'Femme de 71 ans, palpitations d\'apparition brutale, sensation de battements anarchiques dans la poitrine et essoufflement modéré.',
        optimalHotspot: 'apex',
        secondaryHotspots: ['aortique', 'pulmonaire', 'tricuspide'],
        audioFiles: {
            'apex': 'assets/audio/auscultation/heart/F_AF_A.wav',
            'aortique': 'assets/audio/auscultation/heart/M_AF_RUSB.wav',
            'pulmonaire': 'assets/audio/auscultation/heart/F_AF_LUSB.wav',
            'tricuspide': 'assets/audio/auscultation/heart/M_AF_LC.wav'
        },
        semiology: 'Rythme cardiaque irrégulièrement irrégulier (absence de cadence répétitive), cadence rapide ~110-120 bpm, variations d\'intensité imprévisibles du premier bruit B1, absence totale de B4 (absence de systole atriale organisée).',
        audioParams: {
            heartRate: 115,
            irregular: true,
            b1Volume: 0.8,
            b1Pitch: 65,
            b2Volume: 0.8,
            b2Pitch: 95,
            systolicMurmur: 0,
            diastolicMurmur: 0,
            b3: 0,
            b4: 0,
            rub: 0
        },
        question: "Quelle anomalie auscultatoire caractérise formellement ce tracé d'arythmie cardiaque ?",
        options: [
            "Une arythmie complète avec bruits du cœur irrégulièrement irréguliers et B1 d'intensité variable",
            "Un rythme régulier à 3 temps avec galop protodiastolique B3 isolé",
            "Un dédoublement large et fixe de B2 sans variation respiratoire",
            "Une bradycardie sinusale régulière à 40 bpm avec pauses post-extrasystoliques"
        ],
        correctIndex: 0,
        explanation: "La fibrillation atriale (ACFA) se traduit à l'auscultation par une « arythmie complète » : les intervalles entre battements sont totalement irréguliers et sans cadence répétitive, le premier bruit B1 varie d'intensité d'un battement à l'autre selon le degré de remplissage ventriculaire, et il existe un déficit ausculto-radial (fréquence cardiaque centrale supérieure au pouls radial)."
    },
    {
        id: 'auscult_gallop_b4',
        type: 'cardiac',
        title: 'Bruit de Galop Présystolique (B4 / S4) — Cardiopathie Hypertensive',
        difficulty: 'intermediaire',
        patient: 'Homme de 62 ans, hypertendu ancien mal contrôlé (PA 175/100 mmHg), venu pour bilan cardiologique.',
        optimalHotspot: 'apex',
        secondaryHotspots: ['tricuspide', 'aortique'],
        audioFiles: {
            'apex': 'assets/audio/auscultation/heart/M_S4_LUSB.wav',
            'tricuspide': 'assets/audio/auscultation/heart/F_S4_RC.wav'
        },
        semiology: 'Rythme à 3 temps avec bruit sourd télédiastolique ou présystolique (B4) survenant juste avant B1 (« Ten-nes-see »), de basse fréquence, traduisant la contraction de l\'oreillette contre un ventricule gauche rigide et hypertrophié.',
        audioParams: {
            heartRate: 74,
            b1Volume: 0.85,
            b1Pitch: 65,
            b2Volume: 0.8,
            b2Pitch: 95,
            systolicMurmur: 0,
            diastolicMurmur: 0,
            b3: 0,
            b4: 0.9,
            b4Pitch: 50,
            rub: 0
        },
        question: "Quelle condition hémodynamique et myocardique est directement responsable de la genèse du galop présystolique B4 ?",
        options: [
            "Une perte de compliance ventriculaire imposant une contraction atriale vigoureuse en fin de diastole",
            "Une surcharge volumétrique brutale lors de la phase de remplissage ventriculaire passif rapide",
            "Une régurgitation mitrale volumineuse en début de systole",
            "Un décollement péricardique avec épanchement circonférentiel"
        ],
        correctIndex: 0,
        explanation: "Le galop présystolique (B4 ou S4) survient en télédiastole, immédiatement avant B1. Il correspond à la mise en tension brutale des structures ventriculaires sous l'effet de la systole atriale propulsant le sang contre un ventricule gauche peu compliant et rigide (hypertrophie ventriculaire gauche de l'HTA, cardiopathie ischémique, rétrécissement aortique). Il est toujours pathologique chez l'adulte et disparaît obligatoirement en cas de fibrillation atriale."
    },
    {
        id: 'auscult_avb',
        type: 'cardiac',
        title: 'Bloc Atrio-Ventriculaire Complet (BAV 3)',
        difficulty: 'expert',
        patient: 'Femme de 82 ans, malaises à répétition et lipothymies sans prodromes (syncopes d\'Adams-Stokes).',
        optimalHotspot: 'apex',
        secondaryHotspots: ['tricuspide', 'aortique'],
        audioFiles: {
            'apex': 'assets/audio/auscultation/heart/M_AVB_A.wav',
            'tricuspide': 'assets/audio/auscultation/heart/M_AVB_LLSB.wav'
        },
        semiology: 'Bradycardie extrême, lente et régulière (~36-40 bpm), insensible à l\'effort ou à l\'atropine, avec éclat intermittent très intense du premier bruit B1 (« bruit de canon » de Bouillaud) traduisant la dissociation auriculo-ventriculaire.',
        audioParams: {
            heartRate: 38,
            b1Volume: 0.9,
            b1Pitch: 65,
            b2Volume: 0.75,
            b2Pitch: 95,
            systolicMurmur: 0.2,
            systolicMurmurType: 'ejection_diamond',
            systolicFilter: 400,
            diastolicMurmur: 0,
            b3: 0,
            b4: 0,
            rub: 0
        },
        question: "À quel phénomène correspond le « bruit de canon » ausculté de façon intermittente dans le BAV du 3e degré ?",
        options: [
            "À la coïncidence fortuite d'une systole atriale survenant immédiatement avant la fermeture ventriculaire (valves mitrales très ouvertes)",
            "À la rupture brutale d'un cordage tendineux mitral",
            "Au claquement d'ouverture d'une valve mitrale calcifiée",
            "À une régurgitation aortique massive d'apparition soudaine"
        ],
        correctIndex: 0,
        explanation: "Dans le BAV complet (BAV 3), oreillettes et ventricules battent de façon complètement dissociée. Lorsque par hasard la contraction auriculaire précède de très peu la contraction ventriculaire, les valves atrio-ventriculaires sont grandes ouvertes et projetées brutalement l'une contre l'autre lors de la montée tensionnelle ventriculaire, créant un claquement sonore B1 d'intensité démesurée appelé « bruit de canon »."
    },
    {
        id: 'auscult_tachycardia',
        type: 'cardiac',
        title: 'Tachycardie Régulière (TSV / Maladie de Bouveret)',
        difficulty: 'debutant',
        patient: 'Jeune femme de 24 ans, crise de palpitations rapides à début et fin brusques (« déclic »), angoisse sans douleur thoracique.',
        optimalHotspot: 'apex',
        secondaryHotspots: ['pulmonaire', 'aortique'],
        audioFiles: {
            'apex': 'assets/audio/auscultation/heart/F_T_A.wav',
            'pulmonaire': 'assets/audio/auscultation/heart/M_T_LUSB.wav'
        },
        semiology: 'Rythme cardiaque régulier extrêmement rapide (~150-160 bpm), à 2 temps équidistants par raccourcissement du grand silence diastolique (« rythme fœtal » ou « embryocardie »), sans souffle surajouté.',
        audioParams: {
            heartRate: 155,
            b1Volume: 0.85,
            b1Pitch: 65,
            b2Volume: 0.85,
            b2Pitch: 95,
            systolicMurmur: 0,
            diastolicMurmur: 0,
            b3: 0,
            b4: 0,
            rub: 0
        },
        question: "Quelle modification des silences cardiaques caractérise l'auscultation d'une tachycardie régulière à cadence élevée ?",
        options: [
            "Un raccourcissement préférentiel du grand silence diastolique qui devient égal au petit silence (embryocardie)",
            "Un allongement exclusif de la diastole ventriculaire",
            "L'apparition systématique d'un souffle diastolique d'hyperdébit",
            "L'inversion chronologique complète entre B1 et B2"
        ],
        correctIndex: 0,
        explanation: "À fréquence cardiaque élevée (ici tachycardie supraventriculaire ~155 bpm), c'est principalement la phase diastolique (grand silence) qui se raccourcit drastiquement. La systole et la diastole en viennent à avoir une durée quasi identique, réalisant une cadence régulière monotone à deux temps équidistants, rappelant les bruits du cœur fœtal (embryocardie)."
    },
    {
        id: 'auscult_esm',
        type: 'cardiac',
        title: 'Souffle Éjectionnel Systolique Bénin / Innocent (ESM)',
        difficulty: 'debutant',
        patient: 'Adolescent sportif de 17 ans, examen médical de non contre-indication à la pratique du football.',
        optimalHotspot: 'aortique',
        secondaryHotspots: ['pulmonaire', 'apex'],
        audioFiles: {
            'aortique': 'assets/audio/auscultation/heart/M_ESM_RUSB.wav',
            'pulmonaire': 'assets/audio/auscultation/heart/M_ESM_LUSB.wav',
            'apex': 'assets/audio/auscultation/heart/M_ESM_A.wav',
            'tricuspide': 'assets/audio/auscultation/heart/F_ESM_LLSB.wav'
        },
        semiology: 'Souffle proto-mésosystolique éjectionnel doux (intensité 1 à 2/6), maximal au foyer aortique ou pulmonaire, sans aucun éclat de clic, B2 strictement conservé et net, sans aucune irradiation aux artères carotides, variant avec la position.',
        audioParams: {
            heartRate: 68,
            b1Volume: 0.85,
            b1Pitch: 65,
            b2Volume: 0.85,
            b2Pitch: 95,
            systolicMurmur: 0.45,
            systolicMurmurType: 'ejection_diamond',
            systolicFilter: 420,
            diastolicMurmur: 0,
            b3: 0,
            b4: 0,
            rub: 0
        },
        question: "Quel argument clinique permet de rattacher avec certitude ce souffle systolique à un souffle fonctionnel bénin plutôt qu'à un rétrécissement aortique serré ?",
        options: [
            "Le deuxième bruit B2 est parfaitement conservé et normal, sans aucune irradiation aux carotides",
            "Le souffle irradie largement vers l'aisselle gauche et dans le dos",
            "Le deuxième bruit B2 est totalement aboli au foyer aortique",
            "L'intensité du souffle dépasse le grade 4/6 avec frémissement palpatoire"
        ],
        correctIndex: 0,
        explanation: "Un souffle cardiaque bénin/innocent (fréquent chez l'enfant et l'adulte jeune sportif) est un souffle éjectionnel proto ou mésosystolique doux (≤ 2/6), strictement asymptomatique, avec conservation intégrale du deuxième bruit B2 (dont l'abolition signerait au contraire un RA serré) et ABSENCE FORMELLE d'irradiation aux vaisseaux du cou (artères carotides)."
    },

    // =========================================================================
    // NOUVEAUX CAS PNEUMOLOGIQUES ISSUS DU DATASET HLS-CMDS
    // =========================================================================
    {
        id: 'auscult_rhonchi',
        type: 'pulmonary',
        title: 'Râles Bronchiques / Ronchus (Rhonchi) — Bronchite Aiguë',
        difficulty: 'debutant',
        patient: 'Homme de 45 ans, tabagique, toux grasse productive avec expectorations jaunâtres et sensation d\'encombrement.',
        optimalHotspot: 'poumon_champs_moyen',
        secondaryHotspots: ['poumon_apex_gauche', 'poumon_apex_droit', 'poumon_base_droite', 'poumon_base_gauche'],
        audioFiles: {
            'poumon_champs_moyen': 'assets/audio/auscultation/lung/F_R_LMA.wav',
            'poumon_apex_gauche': 'assets/audio/auscultation/lung/F_R_LUA.wav',
            'poumon_apex_droit': 'assets/audio/auscultation/lung/M_R_RUA.wav',
            'poumon_base_droite': 'assets/audio/auscultation/lung/F_R_RLA.wav',
            'poumon_base_gauche': 'assets/audio/auscultation/lung/M_R_LLA.wav'
        },
        semiology: 'Râles continus, de basse fréquence, ronflants ou râpeux (« bruit de corne de brume ou ronflement »), audibles aux deux temps de la respiration (inspiration et expiration), modifiés ou déplacés par une toux vigoureuse.',
        audioParams: {
            respiratoryRate: 18,
            vesicularVolume: 0.5,
            crackles: 0,
            wheezing: 0,
            rhonchi: 0.85,
            pleuralRub: 0,
            stridor: 0
        },
        question: "Quelle est la principale caractéristique sémiologique distinguant les râles bronchiques (ronchus) des râles crépitants alvéolaires ?",
        options: [
            "Les râles bronchiques sont continus, graves (ronflements) et sont typiquement modifiés ou atténués après la toux",
            "Les râles bronchiques sont exclusivement inspiratoires et de tonalité très aiguë",
            "Les râles bronchiques ne s'écoutent que chez le jeune enfant",
            "Les râles bronchiques disparaissent lorsque le patient passe en position debout"
        ],
        correctIndex: 0,
        explanation: "Les ronchus (râles bronchiques) sont des bruits continus, graves et ronflants provoqués par le passage de l'air à travers des sécrétions mucopurulentes encombrant la lumière des gros troncs bronchiques. Ils s'entendent aux deux temps (inspi et expi) et sont typiquement modifiés, diminués ou mobilisés par l'effort de toux, contrairement aux crépitants qui restent fixes."
    },
    {
        id: 'auscult_coarse_crackles',
        type: 'pulmonary',
        title: 'Crépitants Grossiers / Sous-crépitants — Bronchectasies',
        difficulty: 'intermediaire',
        patient: 'Femme de 68 ans, antécédent de tuberculose pulmonaire guérie, bronchorrhée chronique quotidienne et essoufflement.',
        optimalHotspot: 'poumon_base_droite',
        secondaryHotspots: ['poumon_base_gauche', 'poumon_champs_moyen'],
        audioFiles: {
            'poumon_base_droite': 'assets/audio/auscultation/lung/F_CC_RLA.wav',
            'poumon_base_gauche': 'assets/audio/auscultation/lung/M_CC_LLA.wav',
            'poumon_champs_moyen': 'assets/audio/auscultation/lung/F_CC_LMA.wav'
        },
        semiology: 'Bruits adventices discontinus, plus graves, amples et humides que les crépitants fins (« bruits de bulles qui éclatent »), débutant dès le début de l\'inspiration et pouvant persister au début de l\'expiration, témoins d\'un encombrement des voies aériennes moyennes.',
        audioParams: {
            respiratoryRate: 19,
            vesicularVolume: 0.55,
            crackles: 0.9,
            cracklesDensity: 14,
            cracklesPitch: 400,
            wheezing: 0,
            rhonchi: 0,
            pleuralRub: 0,
            stridor: 0
        },
        question: "Comment différencier à l'oreille les crépitants grossiers (sous-crépitants) des crépitants fins de fibrose ou d'OAP ?",
        options: [
            "Les crépitants grossiers sont de plus basse fréquence, de timbre bulleux et débutent plus tôt dans le cycle respiratoire",
            "Les crépitants grossiers sont des sifflements musicaux aigus de fin d'expiration",
            "Les crépitants grossiers ne s'entendent qu'au niveau du cou",
            "Les crépitants grossiers sont toujours synchrones du pouls artériel"
        ],
        correctIndex: 0,
        explanation: "Les crépitants grossiers (anciennement appelés sous-crépitants ou râles bulleux) proviennent des bronches moyennes et petites dilatées encombrées de sécrétions (dilatation des bronches / DDB). Ils sont plus graves, plus lents, ont une sonorité de gargouillement bulleux et surviennent dès la première moitié de l'inspiration (voire en début d'expiration), contrairement aux crépitants fins de fin d'inspiration (télé-inspiratoires « en velcro ») typiques de l'alvéole dans l'OAP ou la fibrose."
    },
    {
        id: 'auscult_pleural_rub',
        type: 'pulmonary',
        title: 'Frottement Pleural — Pleurésie Sèche / Épanchement Débutant',
        difficulty: 'intermediaire',
        patient: 'Homme de 39 ans, point douloureux thoracique basi-thoracique droit exacerbé par l\'inspiration profonde et la toux.',
        optimalHotspot: 'poumon_base_droite',
        secondaryHotspots: ['poumon_champs_moyen', 'poumon_base_gauche'],
        audioFiles: {
            'poumon_base_droite': 'assets/audio/auscultation/lung/M_PR_RLA.wav',
            'poumon_champs_moyen': 'assets/audio/auscultation/lung/M_PR_RMA.wav',
            'poumon_base_gauche': 'assets/audio/auscultation/lung/F_PR_LLA.wav'
        },
        semiology: 'Bruit superficiel, râpeux ou craquant (« pas dans la neige gelée » ou « cuir froissé »), en va-et-vient synchrone de l\'inspiration et de l\'expiration, non modifié par la toux, disparaissant totalement lors de l\'apnée.',
        audioParams: {
            respiratoryRate: 20,
            vesicularVolume: 0.5,
            crackles: 0,
            wheezing: 0,
            rhonchi: 0,
            pleuralRub: 0.9,
            stridor: 0
        },
        question: "Quel comportement clinique caractéristique permet d'affirmer l'origine pleurale d'un frottement thoracique ?",
        options: [
            "L'abolition immédiate et complète du bruit dès la mise en apnée bloquée",
            "La disparition du bruit lorsque le patient serre les poings",
            "L'amplification du bruit sous traitement par diurétiques",
            "L'apparition d'un dédoublement fixe au passage en position assise"
        ],
        correctIndex: 0,
        explanation: "Le frottement pleural naît de l'attrition et du frottement réciproque des feuillets pariétal et viscéral de la plèvre rendus rugueux par un dépôt de fibrine (pleurésie sèche ou phase initiale d'un épanchement). Il s'entend aux deux temps (inspiration et expiration). Dès que le patient bloque sa respiration en apnée complète, la ventilation cesse, les feuillets s'immobilisent et le bruit disparaît instantanément (alors qu'un frottement péricardique persiste)."
    },

    // =========================================================================
    // NOUVEAUX CAS PEDIATRIQUES REELS ISSUS DU DATASET SPRSound (SJTU / SCMC)
    // =========================================================================
    {
        id: 'auscult_ped_bronchiolite',
        type: 'pulmonary',
        title: 'Bronchiolite Aiguë du Nourrisson (VRS)',
        difficulty: 'intermediaire',
        patient: 'Nourrisson de 8 mois, rhinorrhée depuis 3 jours puis toux et sifflements, difficultés alimentaires, tirage sous-costal, fréquence respiratoire à 58/min.',
        optimalHotspot: 'poumon_base_droite',
        secondaryHotspots: ['poumon_base_gauche', 'poumon_apex_droit', 'poumon_apex_gauche', 'poumon_champs_moyen'],
        audioFiles: {
            'poumon_base_droite': 'assets/audio/auscultation/lung/SPRS_65118898_0.7_0_p3_4159.wav',
            'poumon_base_gauche': 'assets/audio/auscultation/lung/SPRS_65118898_0.7_0_p1_4162.wav',
            'poumon_apex_droit': 'assets/audio/auscultation/lung/SPRS_65118898_0.7_0_p4_4160.wav',
            'poumon_apex_gauche': 'assets/audio/auscultation/lung/SPRS_65118898_0.7_0_p2_4161.wav',
            'poumon_champs_moyen': 'assets/audio/auscultation/lung/SPRS_65118898_0.7_0_p2_4161.wav'
        },
        semiology: 'Râles sibilants diffus prédominant à l\'expiration avec allongement du temps expiratoire et freinage expiratoire, râles sous-crépitants d\'encombrement associés. Enregistrement pédiatrique réel (nourrisson de 8 mois, VRS).',
        audioParams: {
            respiratoryRate: 50,
            vesicularVolume: 0.45,
            crackles: 0.4,
            cracklesDensity: 12,
            cracklesPitch: 900,
            wheezing: 0.85,
            wheezingPitches: [520, 780, 1100],
            rhonchi: 0.3,
            pleuralRub: 0,
            stridor: 0
        },
        question: "Quelle est l'anomalie auscultatoire majeure chez ce nourrisson et quel signe clinique impose l'hospitalisation ?",
        options: [
            "Des râles sibilants expiratoires diffus avec freinage expiratoire ; une prise alimentaire inférieure à 50% des rations habituelles",
            "Un stridor inspiratoire isolé avec toux quinteuse ; une fièvre modérée isolée à 38,2 °C",
            "Des râles crépitants unilatéraux télé-inspiratoires purs ; un encombrement nasal antérieur isolé",
            "Un silence auscultatoire bilatéral d'emblée ; un âge civil strictement supérieur à 6 mois"
        ],
        correctIndex: 0,
        explanation: "La bronchiolite aiguë du nourrisson (due au VRS dans la majorité des cas) associe à l'auscultation des râles sibilants expiratoires diffus, une expiration prolongée et freinée, ainsi que des râles sous-crépitants d'encombrement. Le diagnostic est purement clinique. Selon les recommandations de la HAS, les critères d'hospitalisation comprennent l'altération de l'état général, les difficultés alimentaires avec prise inférieure à 50% des biberons sur 3 repas consécutifs, une fréquence respiratoire supérieure à 60/min, un tirage important, des apnées, une SpO2 inférieure à 92% ou un âge inférieur à 2 mois."
    },
    {
        id: 'auscult_ped_asthme',
        type: 'pulmonary',
        title: 'Crise d\'Asthme Aiguë de l\'Enfant',
        difficulty: 'intermediaire',
        patient: 'Fillette de 9 ans et demi, asthmatique connue, dyspnée sifflante brutale déclenchée par la course, toux sèche, FR à 32/min, DEP diminué à 60% de la théorique.',
        optimalHotspot: 'poumon_champs_moyen',
        secondaryHotspots: ['poumon_apex_gauche', 'poumon_apex_droit', 'poumon_base_droite', 'poumon_base_gauche'],
        audioFiles: {
            'poumon_champs_moyen': 'assets/audio/auscultation/lung/SPRS_66239166_9.6_1_p2_4331.wav',
            'poumon_apex_gauche': 'assets/audio/auscultation/lung/SPRS_66239166_9.6_1_p2_4331.wav',
            'poumon_apex_droit': 'assets/audio/auscultation/lung/SPRS_66239166_9.6_1_p4_4326.wav',
            'poumon_base_droite': 'assets/audio/auscultation/lung/SPRS_66239166_9.6_1_p3_4332.wav',
            'poumon_base_gauche': 'assets/audio/auscultation/lung/SPRS_66239166_9.6_1_p1_4330.wav'
        },
        semiology: 'Râles sibilants polyphoniques diffus bilatéraux, aigus et musicaux, audibles lors d\'une expiration prolongée et active, contrastant avec une diminution globale du murmure vésiculaire.',
        audioParams: {
            respiratoryRate: 30,
            vesicularVolume: 0.35,
            crackles: 0,
            wheezing: 0.95,
            wheezingPitches: [480, 680, 920, 1200],
            rhonchi: 0,
            pleuralRub: 0,
            stridor: 0
        },
        question: "Quel mécanisme acoustique explique ces sibilants polyphoniques et quel est le traitement de première ligne ?",
        options: [
            "Le bronchospasme et l'œdème rétrécissant les bronches distales lors de l'expiration ; bronchodilatateurs bêta-2 mimétiques inhalés",
            "L'obstruction laryngo-trachéale par faux croup ; nébulisation systématique d'adrénaline pure",
            "L'inondation alvéolaire d'origine hémodynamique ; diurétiques de l'anse intraveineux à forte dose",
            "La présence d'un épanchement liquidien pleural libre ; ponction pleurale évacuatrice en urgence"
        ],
        correctIndex: 0,
        explanation: "La crise d'asthme chez l'enfant se caractérise par une inflammation bronchique, un bronchospasme et une hypersécrétion de mucus réduisant la lumière bronchiolaire. Lors de l'expiration, l'augmentation de pression pleurale accentue le collapsus des voies aériennes, produisant des râles sibilants continus polyphoniques de timbre aigu. Le traitement immédiat repose sur les bronchodilatateurs de courte durée d'action (salbutamol) inhalés à la chambre d'inhalation, associés si nécessaire à une corticothérapie orale en cas de crise modérée à sévère."
    },
    {
        id: 'auscult_ped_stridor',
        type: 'pulmonary',
        title: 'Stridor Laryngé du Nourrisson (Obstruction Haute)',
        difficulty: 'expert',
        patient: 'Nourrisson de 6 mois, bruit respiratoire aigu permanent prédominant à l\'inspiration, majoré aux pleurs et atténué en décubitus ventral, sans fièvre.',
        optimalHotspot: 'trachee',
        secondaryHotspots: ['poumon_apex_gauche', 'poumon_apex_droit', 'poumon_base_droite', 'poumon_champs_moyen'],
        audioFiles: {
            'trachee': 'assets/audio/auscultation/lung/SPRS_41273150_0.5_0_p2_4092.wav',
            'poumon_apex_gauche': 'assets/audio/auscultation/lung/SPRS_41273150_0.5_0_p2_4092.wav',
            'poumon_apex_droit': 'assets/audio/auscultation/lung/SPRS_41273150_0.5_0_p4_4082.wav',
            'poumon_base_droite': 'assets/audio/auscultation/lung/SPRS_41273150_0.5_0_p3_4093.wav',
            'poumon_champs_moyen': 'assets/audio/auscultation/lung/SPRS_41273150_0.5_0_p2_4092.wav'
        },
        semiology: 'Bruit adventice aigu, musical ou rude, prédominant de manière stricte sur le temps inspiratoire, d\'origine laryngée ou trachéale extra-thoracique. Choix pédagogique : écoute optimale sur le foyer trachéal/laryngé (enregistrement latéral p2 assigné au hotspot trachee).',
        audioParams: {
            respiratoryRate: 36,
            vesicularVolume: 0.4,
            crackles: 0,
            wheezing: 0,
            rhonchi: 0,
            pleuralRub: 0,
            stridor: 0.95,
            stridorPitch: 850
        },
        question: "Quelle distinction sémiologique fondamentale oppose le stridor laryngé aux sibilants bronchiques ?",
        options: [
            "Le stridor est un bruit inspiratoire lié à une obstruction des voies aériennes supérieures, alors que les sibilants sont expiratoires et d'origine bronchiolaire",
            "Le stridor est un bruit expiratoire d'origine alvéolaire, alors que les sibilants sont exclusivement perçus à l'inspiration",
            "Le stridor s'accompagne systématiquement de râles crépitants fins aux deux bases pulmonaires",
            "Le stridor est un bruit intermittent modifié par l'effort de toux, contrairement aux sibilants qui sont fixes"
        ],
        correctIndex: 0,
        explanation: "Le stridor est un bruit respiratoire anormal, aigu et musical, survenant typiquement au cours de l'inspiration en raison d'une sténose ou d'une anomalie dynamique des voies aériennes supérieures extra-thoraciques (laryngomalacie chez le nourrisson, laryngite sous-glottique, épiglottite ou inhalation de corps étranger). Il s'oppose radicalement aux râles sibilants de l'asthme et de la bronchiolite qui sont des bruits expiratoires issus des voies aériennes inférieures intra-thoraciques. L'apparition d'un tirage sus-sternal ou sous-mandibulaire signale une détresse respiratoire obstructive haute."
    },
    {
        id: 'auscult_ped_encombrement',
        type: 'pulmonary',
        title: 'Encombrement Bronchique et Rhonchi (Jeune Enfant)',
        difficulty: 'debutant',
        patient: 'Enfant de 2 ans, épisode de rhinopharyngite avec toux grasse productive, bruits de ronflements audibles à distance modifiés lorsque l\'enfant tousse.',
        optimalHotspot: 'poumon_champs_moyen',
        secondaryHotspots: ['poumon_apex_gauche', 'poumon_apex_droit', 'poumon_base_droite', 'poumon_base_gauche'],
        audioFiles: {
            'poumon_champs_moyen': 'assets/audio/auscultation/lung/SPRS_66236931_2.0_1_p2_5262.wav',
            'poumon_apex_gauche': 'assets/audio/auscultation/lung/SPRS_66236931_2.0_1_p2_5262.wav',
            'poumon_apex_droit': 'assets/audio/auscultation/lung/SPRS_66236931_2.0_1_p4_5264.wav',
            'poumon_base_droite': 'assets/audio/auscultation/lung/SPRS_66236931_2.0_1_p3_5263.wav',
            'poumon_base_gauche': 'assets/audio/auscultation/lung/SPRS_66236931_2.0_1_p1_5261.wav'
        },
        semiology: 'Râles bronchiques (ronchus ou rhonchi), bruits continus graves, ronflants ou râpeux, perçus aux deux temps de la respiration avec prédominance expiratoire, typiquement déplacés ou atténués par la toux.',
        audioParams: {
            respiratoryRate: 24,
            vesicularVolume: 0.5,
            crackles: 0,
            wheezing: 0,
            rhonchi: 0.85,
            pleuralRub: 0,
            stridor: 0
        },
        question: "Quelle caractéristique sémiologique permet d'affirmer qu'un bruit anormal correspond à des râles bronchiques (rhonchi) ?",
        options: [
            "Leur timbre grave ronflant aux deux temps respiratoires et leur modification ou déplacement net après la toux",
            "Leur tonalité aiguë purement inspiratoire persistant sans aucun changement après la toux",
            "Leur sonorité sèche en velcro apparaissant uniquement à la toute fin de l'inspiration",
            "Leur disparition immédiate lorsque l'enfant se met en décubitus dorsal strict"
        ],
        correctIndex: 0,
        explanation: "Les rhonchi (ou ronchus / râles bronchiques) sont générés par les vibrations de sécrétions muqueuses ou mucopurulentes dans la lumière des bronches de gros et moyen calibre au passage du flux aérien. Bruits continus et graves (son de corne de brume ou de ronflement), ils s'entendent à l'inspiration et à l'expiration. Leur caractère mobile, modulable ou réductible par la toux permet de les différencier avec certitude des râles crépitants parenchymateux (qui restent strictement fixes après la toux)."
    },
    {
        id: 'auscult_ped_crackles_fins',
        type: 'pulmonary',
        title: 'Crépitants Fins Télé-Inspiratoires Pédiatriques',
        difficulty: 'intermediaire',
        patient: 'Enfant de 23 mois (1,9 an), fièvre à 39 °C, toux sèche puis productive, polypnée à 42/min avec abattement et foyer auscultatoire basi-thoracique droit.',
        optimalHotspot: 'poumon_base_droite',
        secondaryHotspots: ['poumon_base_gauche', 'poumon_apex_droit', 'poumon_apex_gauche', 'poumon_champs_moyen'],
        audioFiles: {
            'poumon_base_droite': 'assets/audio/auscultation/lung/SPRS_41130419_1.9_0_p3_4585.wav',
            'poumon_base_gauche': 'assets/audio/auscultation/lung/SPRS_41130419_1.9_0_p1_4604.wav',
            'poumon_apex_droit': 'assets/audio/auscultation/lung/SPRS_41130419_1.9_0_p4_4576.wav',
            'poumon_apex_gauche': 'assets/audio/auscultation/lung/SPRS_41130419_1.9_0_p2_4584.wav',
            'poumon_champs_moyen': 'assets/audio/auscultation/lung/SPRS_41130419_1.9_0_p2_4584.wav'
        },
        semiology: 'Râles crépitants fins (sonorité en bruit de velcro ou froissement de mèche de cheveux), discontinus, brefs, survenant en fin d\'inspiration (télé-inspiratoires), non modifiés par la toux, prédominant à la base droite.',
        audioParams: {
            respiratoryRate: 40,
            vesicularVolume: 0.5,
            crackles: 0.9,
            cracklesDensity: 22,
            cracklesPitch: 1150,
            wheezing: 0,
            rhonchi: 0,
            pleuralRub: 0,
            stridor: 0
        },
        question: "Quel mécanisme physique sous-tend la production des râles crépitants fins et comment réagissent-ils à la toux ?",
        options: [
            "L'ouverture explosive alvéolaire en fin d'inspiration de territoires atélectasiés ou exsudatifs, restant insensibles à la toux",
            "La mobilisation de sécrétions épaisses intra-trachéales, disparaissant immédiatement après la toux",
            "Le rétrécissement dynamique du calibre sous-glottique provoqué par un effort inspiratoire intense",
            "Le glissement frictionnel de deux feuillets séreux inflammatoires disparaissant lors de l'apnée"
        ],
        correctIndex: 0,
        explanation: "Les crépitants fins sont des bruits adventices discontinus produits par l'ouverture explosive télé-inspiratoire de petites voies aériennes distales et d'alvéoles collées par de l'exsudat (pneumopathie infectieuse à pneumocoque ou mycoplasme) ou par du liquide interstitiel. Bruits de haute fréquence comparés au décollement du Velcro, ils se concentrent en fin d'inspiration et sont totalement insensibles à la toux, ce qui permet de les distinguer des râles bronchiques de sécrétion."
    },
    {
        id: 'auscult_ped_crackles_grossiers',
        type: 'pulmonary',
        title: 'Crépitants Grossiers / Râles Bulleux (Bronchectasies)',
        difficulty: 'intermediaire',
        patient: 'Fillette de 2 ans et 2 mois, suivie pour bronchorrhée chronique purulente, toux grasse quotidienne et dilatation des bronches suspectée.',
        optimalHotspot: 'poumon_base_droite',
        secondaryHotspots: ['poumon_base_gauche', 'poumon_apex_gauche', 'poumon_champs_moyen'],
        audioFiles: {
            'poumon_base_droite': 'assets/audio/auscultation/lung/SPRS_64973610_2.2_1_p3_7138.wav',
            'poumon_base_gauche': 'assets/audio/auscultation/lung/SPRS_64973610_2.2_1_p1_6819.wav',
            'poumon_apex_gauche': 'assets/audio/auscultation/lung/SPRS_64973610_2.2_1_p2_6756.wav',
            'poumon_champs_moyen': 'assets/audio/auscultation/lung/SPRS_64973610_2.2_1_p2_6756.wav'
        },
        semiology: 'Râles crépitants grossiers (ou râles sous-crépitants bulleux), bruits discontinus plus graves et humides (« gargouillis de bulles qui éclatent »), débutant dès le début de l\'inspiration et pouvant persister à l\'expiration, modifiés par la toux.',
        audioParams: {
            respiratoryRate: 26,
            vesicularVolume: 0.55,
            crackles: 0.85,
            cracklesDensity: 12,
            cracklesPitch: 420,
            wheezing: 0,
            rhonchi: 0.3,
            pleuralRub: 0,
            stridor: 0
        },
        question: "Quelle divergence sémiologique majeure permet d'opposer les crépitants grossiers aux crépitants fins ?",
        options: [
            "Les crépitants grossiers sont de plus basse fréquence, de timbre bulleux, présents plus tôt dans l'inspiration et modifiés par la toux",
            "Les crépitants grossiers sont des sifflements musicaux continus perçus exclusivement lors de l'expiration forcée",
            "Les crépitants grossiers sont cantonnés au creux sus-claviculaire et disparaissent à l'orthostatisme",
            "Les crépitants grossiers sont toujours associés à une onde de choc cardiaque perçue à la palpation"
        ],
        correctIndex: 0,
        explanation: "Les crépitants grossiers (autrefois qualifiés de sous-crépitants ou de râles bulleux) naissent dans les bronches de moyen calibre encombrées ou dilatées (dilatation des bronches, mucoviscidose, infections suppuratives récurrentes). Contrairement aux crépitants fins alvéolaires de haute fréquence et strictement télé-inspiratoires, les crépitants grossiers sont plus graves, ont une tonalité liquide de bulles rompues, surviennent plus tôt dans le cycle inspiratoire (voire au début de l'expiration) et sont mobilisés par la toux."
    },
    {
        id: 'auscult_ped_mixte_foyers',
        type: 'pulmonary',
        title: 'Auscultation Comparative Multi-Foyers (Rhonchi et Crépitants)',
        difficulty: 'expert',
        patient: 'Garçon de 3 ans et demi, antécédent d\'infections respiratoires récidivantes, encombrement bronchique asymétrique et polypnée modérée.',
        optimalHotspot: 'poumon_base_droite',
        secondaryHotspots: ['poumon_base_gauche', 'poumon_apex_droit', 'poumon_apex_gauche', 'poumon_champs_moyen'],
        audioFiles: {
            'poumon_base_droite': 'assets/audio/auscultation/lung/SPRS_41090976_3.7_0_p3_7401.wav',
            'poumon_apex_droit': 'assets/audio/auscultation/lung/SPRS_41090976_3.7_0_p4_6964.wav',
            'poumon_base_gauche': 'assets/audio/auscultation/lung/SPRS_41090976_3.7_0_p1_6963.wav',
            'poumon_apex_gauche': 'assets/audio/auscultation/lung/SPRS_41090976_3.7_0_p2_6962.wav',
            'poumon_champs_moyen': 'assets/audio/auscultation/lung/SPRS_41090976_3.7_0_p2_6962.wav'
        },
        semiology: 'Dissociation acoustique topographique chez un même patient pédiatrique : présence de rhonchi (râles bronchiques graves) prédominant nettement à l\'hémithorax gauche (foyers p1 et p2), contrastant avec des crépitants grossiers bulleux à l\'hémithorax droit (foyers p3 et p4).',
        audioParams: {
            respiratoryRate: 28,
            vesicularVolume: 0.5,
            crackles: 0.75,
            cracklesDensity: 14,
            cracklesPitch: 500,
            wheezing: 0,
            rhonchi: 0.75,
            pleuralRub: 0,
            stridor: 0
        },
        question: "En comparant l'auscultation du poumon gauche et du poumon droit chez cet enfant, quelle interprétation clinique est correcte ?",
        options: [
            "Une atteinte bronchique hétérogène associant des sécrétions des gros troncs à gauche (rhonchi) et des sécrétions fluides des bronches moyennes à droite (crépitants grossiers)",
            "Un pneumothorax complet sous tension du côté gauche responsable d'un silence auscultatoire controlatéral",
            "Un rétrécissement mitral congénital responsable d'un roulement diastolique propagé au sommet pulmonaire",
            "Un examen strictement normal traduisant une simple variabilité physiologique des flux aériens chez l'enfant"
        ],
        correctIndex: 0,
        explanation: "L'examen auscultatoire pulmonaire pédiatrique doit obligatoirement être comparatif, méthodique et symétrique. Chez ce patient réel de 3,7 ans du dataset SPRSound, l'écoute démontre l'hétérogénéité des lésions : encombrement proximal prédominant à gauche sous forme de rhonchi ronflants (positions p1 et p2) associé à une composante distale plus fluide de crépitants grossiers à droite (positions p3 et p4). Cela illustre qu'un seul foyer ne suffit jamais à caractériser la clinique respiratoire d'un patient."
    }
];

if (typeof window !== 'undefined') {
    window.AUSCULTATION_DATABASE = AUSCULTATION_DATABASE;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AUSCULTATION_DATABASE };
}
