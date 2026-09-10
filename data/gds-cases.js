/**
 * data/gds-cases.js — Cas cliniques d'entraînement EDN pour la gazométrie artérielle
 * Conforme au programme EDN / R2C (Items Acido-base, Détresse respiratoire, États de choc, Diabète).
 * Zéro dépendance externe. Compatible navigateur (window.GDS_CASES) et Node.js.
 */

const GDS_CASES = [
    {
        id: 'dka_inaugural',
        title: 'Acidocétose diabétique inaugurale',
        specialty: 'Endocrinologie / Urgences',
        difficulty: 'Intermédiaire',
        patient: {
            age: 21,
            sex: 'M',
            context: 'Jeune homme de 21 ans amené aux urgences par sa famille pour altération de l\'état général, asthénie majeure, syndrome polyuro-polydipsique depuis 15 jours avec amaigrissement de 6 kg. Il est somnolent mais orienté, présente une respiration ample, profonde et rapide (polypnée de Kussmaul), une odeur acétonique de l\'haleine et des douleurs abdominales diffuses sans défense.',
            vitals: { ta: '105/65 mmHg', fc: '115 bpm', fr: '28 /min', spo2: '99% (AA)', temp: '36.8 °C' }
        },
        params: {
            pH: 7.14,
            paCO2: 19,
            hco3: 6.5,
            paO2: 102,
            saO2: 99,
            fiO2: 21,
            lactates: 1.4,
            na: 132,
            cl: 96,
            k: 5.4,
            albumin: 41
        },
        quiz: {
            steps: [
                {
                    id: 'q_ph',
                    question: '1. Quel est l\'état du pH artériel ?',
                    options: [
                        'Acidémie sévère (pH < 7,35)',
                        'Alcalémie (pH > 7,45)',
                        'Équilibre normal du pH'
                    ],
                    correctIndex: 0,
                    explanation: 'Le pH à 7,14 est très inférieur à la limite basse normale (7,35), définissant une acidémie sévère.'
                },
                {
                    id: 'q_primary',
                    question: '2. Quel est le trouble acido-basique primaire ?',
                    options: [
                        'Acidose respiratoire primitive',
                        'Acidose métabolique primitive',
                        'Alcalose métabolique avec hypoventilation',
                        'Trouble respiratoire isolé'
                    ],
                    correctIndex: 1,
                    explanation: 'Les bicarbonates sont effondrés à 6,5 mmol/L (normale 22-26), ce qui explique la baisse majeure du pH. Il s\'agit d\'une acidose métabolique primitive.'
                },
                {
                    id: 'q_compensation',
                    question: '3. Comment évaluez-vous la compensation respiratoire (formule de Winter) ?',
                    options: [
                        'Compensation adaptée (PaCO₂ observée conforme à la formule de Winter)',
                        'Acidose respiratoire surajoutée (hypoventilation inadaptée)',
                        'Alcalose respiratoire surajoutée (hyperventilation excessive)'
                    ],
                    correctIndex: 0,
                    explanation: 'Formule de Winter : PaCO₂ attendue = 1,5 × HCO₃⁻ + 8 ± 2 = 1,5 × 6,5 + 8 = 17,8 ± 2 (soit 15,8 à 19,8 mmHg). La PaCO₂ mesurée est de 19 mmHg, ce qui correspond exactement à une compensation respiratoire physiologique adaptée par hyperventilation alvéolaire (polypnée de Kussmaul).'
                },
                {
                    id: 'q_anion_gap',
                    question: '4. Quelle est la valeur du trou anionique plasmatique et son interprétation ?',
                    options: [
                        'TA normal (10 mmol/L) : perte digestive de bicarbonates',
                        'TA élevé (29,5 mmol/L) : accumulation d\'anions cétoniques non mesurés',
                        'TA diminué (< 6 mmol/L) : erreur de laboratoire'
                    ],
                    correctIndex: 1,
                    explanation: 'TA = Na⁺ - (Cl⁻ + HCO₃⁻) = 132 - (96 + 6,5) = 29,5 mmol/L (normale 8-12). Le TA est très augmenté par accumulation d\'anions organiques acides non mesurés (bêta-hydroxybutyrate et acétoacétate).'
                },
                {
                    id: 'q_delta',
                    question: '5. Que montre le calcul du Delta-Ratio (Δ/Δ) ?',
                    options: [
                        'Δ/Δ < 0,4 : acidose hyperchlorémique dominante associée',
                        'Δ/Δ ≈ 1,0 : acidose métabolique à trou anionique élevé pure',
                        'Δ/Δ > 2,0 : alcalose métabolique préexistante associée'
                    ],
                    correctIndex: 1,
                    explanation: 'Δ/Δ = (TA - 12) / (24 - HCO₃⁻) = (29,5 - 12) / (24 - 6,5) = 17,5 / 17,5 = 1,00. Un ratio compris entre 0,8 et 1,2 confirme une acidose métabolique à TA élevé pure, sans perte excessive de chlorures ni alcalose préexistante.'
                }
            ],
            diagnosis: 'Acidocétose diabétique inaugurale décompensée avec acidose métabolique à trou anionique élevé pure et compensation respiratoire adaptée (polypnée de Kussmaul). Hyperkaliémie de transfert associée.'
        },
        clinicalPearls: [
            'Toujours vérifier la kaliémie avant d\'instaurer l\'insulinothérapie : l\'insuline et la correction du pH font re-rentrer le K⁺ dans les cellules et provoquent une hypokaliémie brutale.',
            'La formule de Winter est la référence pour démasquer une acidose ou alcalose respiratoire surajoutée chez un patient en acidose métabolique.',
            'Sur le diagramme de Davenport, ce cas se projette dans le quadrant inférieur gauche (acidose métabolique), sous l\'isobare 40 mmHg par hypocapnie compensatrice.'
        ]
    },
    {
        id: 'septic_shock_lactate',
        title: 'Acidose lactique sur choc septique pulmonaire',
        specialty: 'Réanimation / Pneumologie',
        difficulty: 'Avancé',
        patient: {
            age: 68,
            sex: 'F',
            context: 'Femme de 68 ans hospitalisée pour pneumopathie aiguë communautaire sévère fébrile (39,4 °C). À l\'admission en réanimation : marbrures cutanées péri-rotuliennes, temps de recoloration cutanée à 4 secondes, oligurie (< 15 mL/h), pression artérielle effondrée à 78/45 mmHg malgré un remplissage de 20 mL/kg, polypnée à 32/min.',
            vitals: { ta: '78/45 mmHg (PAM 56)', fc: '124 bpm', fr: '32 /min', spo2: '89% (AA)', temp: '39.4 °C' }
        },
        params: {
            pH: 7.21,
            paCO2: 27,
            hco3: 11.0,
            paO2: 61,
            saO2: 89,
            fiO2: 21,
            lactates: 7.5,
            na: 138,
            cl: 101,
            k: 4.8,
            albumin: 28
        },
        quiz: {
            steps: [
                {
                    id: 'q_trouble',
                    question: '1. Quel est le trouble acido-basique principal ?',
                    options: [
                        'Acidose respiratoire aiguë hypoxémique',
                        'Acidose métabolique à trou anionique élevé secondaire à une hyperlactatémie',
                        'Alcalose respiratoire réflexe'
                    ],
                    correctIndex: 1,
                    explanation: 'Le pH est à 7,21 (acidémie) avec des bicarbonates à 11 mmol/L. Les lactates sont majeurs à 7,5 mmol/L, caractérisant une acidose métabolique lactique de type A liée à l\'hypoperfusion tissulaire du choc septique.'
                },
                {
                    id: 'q_ta_corrige',
                    question: '2. Quelle est la particularité du trou anionique chez cette patiente dénutrie/inflammatoire (Albumine 28 g/L) ?',
                    options: [
                        'Le TA mesuré (26 mmol/L) est faussé à la baisse par l\'hypoalbuminémie ; le TA corrigé est à 29 mmol/L',
                        'Le TA mesuré est faussé à la hausse par l\'albumine',
                        'L\'albumine ne modifie pas le calcul du trou anionique plasmatique'
                    ],
                    correctIndex: 0,
                    explanation: 'TA mesuré = 138 - (101 + 11) = 26 mmol/L. Formule de correction : TA_corrigé = TA + 0,25 × (40 - Alb) = 26 + 0,25 × 12 = 29 mmol/L. L\'hypoalbuminémie sous-estime le trou anionique réel ; la correction est indispensable.'
                },
                {
                    id: 'q_resp_comp',
                    question: '3. Quelle est l\'interprétation de la PaCO₂ observée (27 mmHg) selon la formule de Winter ?',
                    options: [
                        'Compensation respiratoire parfaitement adaptée',
                        'Acidose respiratoire surajoutée débutante (épuisement respiratoire du sepsis)',
                        'Alcalose respiratoire excessive'
                    ],
                    correctIndex: 1,
                    explanation: 'Winter : PaCO₂ attendue = 1,5 × 11 + 8 = 24,5 ± 2 mmHg (soit 22,5 à 26,5 mmHg). La PaCO₂ observée est de 27 mmHg, légèrement au-dessus de la fourchette : le travail respiratoire ne compense plus totalement l\'acidose métabolique, témoignant d\'un début d\'épuisement musculaire respiratoire.'
                },
                {
                    id: 'q_oxygenation',
                    question: '4. Que révèle l\'analyse du rapport PaO₂/FiO₂ ?',
                    options: [
                        'PaO₂/FiO₂ normal (> 400 mmHg)',
                        'PaO₂/FiO₂ = 290 mmHg : hypoxémie correspondant aux critères de SDRA léger selon Berlin',
                        'PaO₂/FiO₂ < 100 mmHg : SDRA sévère réfractaire'
                    ],
                    correctIndex: 1,
                    explanation: 'PaO₂/FiO₂ = 61 / 0,21 = 290 mmHg. Une valeur entre 200 et 300 mmHg signe un syndrome de détresse respiratoire aiguë (SDRA) léger selon la définition de Berlin, compliquant la pneumopathie septique.'
                }
            ],
            diagnosis: 'Choc septique avec acidose lactique sévère à trou anionique corrigé très augmenté (29 mmol/L), compensation respiratoire insuffisante (acidose respiratoire surajoutée sur début d\'épuisement) et hypoxémie aiguë (SDRA léger, P/F 290).'
        },
        clinicalPearls: [
            'L\'albumine est le principal anion indosé physiologique. Toute baisse de 10 g/L d\'albumine diminue le trou anionique de 2,5 mmol/L.',
            'L\'acidose lactique au cours du choc septique reflète à la fois l\'anoxie tissulaire par défaut de perfusion et une glycolyse aérobie stimulée par l\'orage adrénergique.'
        ]
    },
    {
        id: 'copd_acute_on_chronic',
        title: 'Acidose respiratoire aiguë sur chronique (BPCO décompensée)',
        specialty: 'Pneumologie / Réanimation',
        difficulty: 'Intermédiaire',
        patient: {
            age: 72,
            sex: 'M',
            context: 'Homme de 72 ans, BPCO post-tabagique très sévère (VEMS 32% sous oxygénothérapie de longue durée 1,5 L/min). Admis pour décompensation respiratoire aiguë fébrile avec expectorations purulentes. À l\'examen : patient somnolent, encombré, polypnée superficielle avec tirage intercostal et balancement thoraco-abdominal paradoxal, sueurs et astérixis (flapping tremor).',
            vitals: { ta: '155/92 mmHg', fc: '112 bpm', fr: '30 /min', spo2: '79% (AA)', temp: '38.2 °C' }
        },
        params: {
            pH: 7.24,
            paCO2: 76,
            hco3: 32.5,
            paO2: 46,
            saO2: 78,
            fiO2: 21,
            lactates: 1.3,
            na: 140,
            cl: 94,
            k: 4.6,
            albumin: 40
        },
        quiz: {
            steps: [
                {
                    id: 'q_primary_disorder',
                    question: '1. Quel est le diagnostic gazométrique initial ?',
                    options: [
                        'Acidose métabolique sévère',
                        'Acidose respiratoire décompensée avec hypercapnie majeure',
                        'Alcalose métabolique hypoxémique'
                    ],
                    correctIndex: 1,
                    explanation: 'Le pH est bas à 7,24 (acidémie) et la PaCO₂ est massivement augmentée à 76 mmHg (normale 35-45). Il s\'agit indiscutablement d\'une acidose respiratoire.'
                },
                {
                    id: 'q_chronicity',
                    question: '2. Comment interpréter des bicarbonates à 32,5 mmol/L face à cette hypercapnie ?',
                    options: [
                        'Acidose respiratoire purement aiguë sans aucune compensation',
                        'Acidose respiratoire aiguë surajoutée à une rétention chronique de bicarbonates',
                        'Alcalose métabolique primitive associée par déshydratation'
                    ],
                    correctIndex: 1,
                    explanation: 'En aigu, les tampons cellulaires n\'augmentent le HCO₃⁻ que de 1 mmol/L par 10 mmHg de PaCO₂ au-dessus de 40 (HCO₃⁻ attendu ≈ 24 + 3,6 = 27,6 mmol/L). En chronique, le rein réabsorbe les bicarbonates (+3,5 à 4 mmol/L par 10 mmHg, soit attendu ≈ 37 à 38 mmol/L). La valeur de 32,5 mmol/L confirme une décompensation respiratoire aiguë survenant sur un fond d\'hypercapnie chronique avec réserve alcaline élevée.'
                },
                {
                    id: 'q_anion_gap_copd',
                    question: '3. Quel est le statut du trou anionique plasmatique ?',
                    options: [
                        'Normal : TA = 140 - (94 + 32,5) = 13,5 mmol/L (proche de la normale 8-12)',
                        'Élevé (> 20 mmol/L)',
                        'Négatif'
                    ],
                    correctIndex: 0,
                    explanation: 'Le trou anionique est normal (13,5 mmol/L), confirmant l\'absence de surcroît d\'anions organiques acides et l\'origine purement ventilatoire du trouble.'
                },
                {
                    id: 'q_therapeutic',
                    question: '4. Quelle est la prise en charge ventilatoire d\'urgence indiquée devant ce tableau d\'acidose respiratoire avec encéphalopathie ?',
                    options: [
                        'Oxygène à fort débit au masque à haute concentration 15 L/min sans ventilation',
                        'Ventilation non invasive (VNI) en mode VS-PEP immédiate',
                        'Perfusion rapide de bicarbonate de sodium molaire'
                    ],
                    correctIndex: 1,
                    explanation: 'L\'acidose respiratoire hypercapnique (pH < 7,35, PaCO₂ > 45) compliquant une exacerbation de BPCO est l\'indication reine de la VNI de grade A. L\'administration d\'O₂ pur aggraverait l\'hypercapnie par perte de la commande hypoxique et effet Haldane.'
                }
            ],
            diagnosis: 'Décompensation aiguë d\'une BPCO avec acidose respiratoire sévère aiguë sur chronique (pH 7,24, PaCO₂ 76, HCO₃⁻ 32,5) et hypoxémie profonde (PaO₂ 46 mmHg) justifiant une VNI d\'urgence.'
        },
        clinicalPearls: [
            'Ne jamais administrer d\'oxygène à haut débit sans surveillance chez un BPCO hypoventilant : l\'objectif de SpO₂ cible est de 88 à 92%.',
            'Sur le diagramme de Davenport, le point se situe au-dessus et à gauche de la ligne tampon normale : il traduit la réponse rénale chronique (élévation de HCO₃⁻) submergée par l\'aggravation aiguë de l\'hypercapnie.'
        ]
    },
    {
        id: 'salicylate_mixed',
        title: 'Intoxication aiguë aux salicylés (Aspirine)',
        specialty: 'Toxicologie / Urgences',
        difficulty: 'Expert',
        patient: {
            age: 26,
            sex: 'F',
            context: 'Jeune femme de 26 ans admise 6 heures après une ingestion volontaire de 35 comprimés d\'aspirine 500 mg. Elle signale des bourdonnements d\'oreille intenses (acouphènes), des vertiges, des nausées et des sueurs profuses. Elle est agitée mais lucide. À l\'examen, on constate une hyperventilation isolée très marquée à 34/min sans signe de détresse respiratoire.',
            vitals: { ta: '120/75 mmHg', fc: '108 bpm', fr: '34 /min', spo2: '99% (AA)', temp: '38.1 °C' }
        },
        params: {
            pH: 7.42,
            paCO2: 18,
            hco3: 11.5,
            paO2: 108,
            saO2: 99,
            fiO2: 21,
            lactates: 2.6,
            na: 141,
            cl: 104,
            k: 3.4,
            albumin: 40
        },
        quiz: {
            steps: [
                {
                    id: 'q_ph_trap',
                    question: '1. Le pH est à 7,42 (dans les normes 7,35 - 7,45). Peut-on en déduire que l\'équilibre acido-basique est normal ?',
                    options: [
                        'Oui, le pH normal élimine formellement tout trouble acido-basique',
                        'Non, c\'est un piège classique : les gaz sont profondément anormaux (PaCO₂ et HCO₃⁻ effondrés), révélant un trouble mixte complexe',
                        'Le pH normal montre qu\'il s\'agit simplement d\'un état de stress aigu sans gravité'
                    ],
                    correctIndex: 1,
                    explanation: 'Un pH normal avec des valeurs de PaCO₂ (18 mmHg) et de HCO₃⁻ (11,5 mmol/L) très perturbées signe un trouble acido-basique mixte de directions opposées qui s\'annulent sur le pH.'
                },
                {
                    id: 'q_dual_disorder',
                    question: '2. Quelle est la nature exacte des deux troubles primaires en cause ?',
                    options: [
                        'Acidose respiratoire aiguë compensée par les reins',
                        'Alcalose respiratoire primitive (stimulation centrale) ET Acidose métabolique primitive à trou anionique élevé (salicylisme)',
                        'Alcalose métabolique par vomissements et hypokaliémie'
                    ],
                    correctIndex: 1,
                    explanation: 'Les salicylés provoquent deux effets physiopathologiques simultanés : 1) une stimulation directe des centres respiratoires bulbaires entraînant une alcalose respiratoire précoce ; 2) un découplage de la phosphorylation oxydative mitochondriale et une accumulation d\'acides organiques (lactates, cétones, salicylate) provoquant une acidose métabolique à TA élevé.'
                },
                {
                    id: 'q_winter_check',
                    question: '3. Que révèle le calcul de la formule de Winter chez cette patiente ?',
                    options: [
                        'La PaCO₂ observée (18 mmHg) est bien inférieure à la compensation métabolique attendue (25 mmHg), confirmant une alcalose respiratoire autonome surajoutée',
                        'La PaCO₂ correspond à la compensation normale de l\'acidose métabolique',
                        'La formule de Winter est inapplicable car le pH est normal'
                    ],
                    correctIndex: 0,
                    explanation: 'Pour HCO₃⁻ = 11,5 : Winter = 1,5 × 11,5 + 8 = 25,25 ± 2 mmHg (23,2 à 27,2 mmHg). Or la PaCO₂ mesurée est de 18 mmHg : l\'hypocapnie est beaucoup trop basse pour être une simple compensation, prouvant l\'existence d\'une alcalose respiratoire primaire conjointe !'
                },
                {
                    id: 'q_ta_salicylate',
                    question: '4. Quel est le trou anionique plasmatique ?',
                    options: [
                        'TA = 141 - (104 + 11,5) = 25,5 mmol/L (très augmenté)',
                        'TA = 10 mmol/L (strictement normal)',
                        'TA = 16 mmol/L'
                    ],
                    correctIndex: 0,
                    explanation: 'TA = 141 - (104 + 11,5) = 25,5 mmol/L (> 12), confirmant l\'acidose métabolique à trou anionique élevé.'
                }
            ],
            diagnosis: 'Intoxication aiguë aux salicylés (aspirine) avec trouble acido-basique mixte classique : alcalose respiratoire primitive et acidose métabolique à trou anionique élevé, maintenant un pH faussement rassurant à 7,42.'
        },
        clinicalPearls: [
            'L\'association d\'acouphènes, d\'une hyperventilation inexpliquée et d\'un trouble mixte alcalose respiratoire + acidose métabolique à TA élevé doit faire évoquer l\'intoxication à l\'aspirine jusqu\'à preuve du contraire.',
            'L\'alcalinisation urinaire (bicarbonates IV) favorise l\'ionisation et l\'excrétion rénale des salicylés en piégeant l\'acide acétylsalicylique sous forme ionisée non réabsorbable dans les tubules.'
        ]
    },
    {
        id: 'pyloric_stenosis_vomiting',
        title: 'Alcalose métabolique sur vomissements abondants (sténose du pylore)',
        specialty: 'Gastro-entérologie / Chirurgie viscérale',
        difficulty: 'Intermédiaire',
        patient: {
            age: 51,
            sex: 'M',
            context: 'Homme de 51 ans aux antécédents d\'ulcère bulbaire non traité, consultant pour des vomissements post-prandiaux incoercibles de liquide clair/bileux survenant depuis 5 jours. Il se plaint d\'une soif vive, d\'une faiblesse musculaire diffuse avec crampes. À l\'examen : pli cutané persistant, sécheresse buccale, clapotis gastrique à jeun et hypotension orthostatique.',
            vitals: { ta: '102/60 mmHg', fc: '98 bpm', fr: '13 /min', spo2: '97% (AA)', temp: '36.9 °C' }
        },
        params: {
            pH: 7.56,
            paCO2: 49,
            hco3: 42.5,
            paO2: 84,
            saO2: 96,
            fiO2: 21,
            lactates: 1.1,
            na: 137,
            cl: 79,
            k: 2.7,
            albumin: 44
        },
        quiz: {
            steps: [
                {
                    id: 'q_alkalosis_type',
                    question: '1. Quel est le trouble acido-basique prédominant ?',
                    options: [
                        'Acidose métabolique hypochlorémique',
                        'Alcalose métabolique sévère avec hypochlorémie et hypokaliémie',
                        'Alcalose respiratoire par polypnée'
                    ],
                    correctIndex: 1,
                    explanation: 'Le pH est élevé à 7,56 (alcalémie) et les bicarbonates sont très augmentés à 42,5 mmol/L. Les pertes massives d\'ions H⁺ et Cl⁻ par voie gastrique provoquent une alcalose métabolique hypochlorémique classique.'
                },
                {
                    id: 'q_alkalosis_comp',
                    question: '2. Comment s\'explique la PaCO₂ à 49 mmHg ?',
                    options: [
                        'Acidose respiratoire primitive surajoutée d\'origine pulmonaire',
                        'Compensation respiratoire physiologique adaptée par hypoventilation alvéolaire',
                        'Erreur de mesure du laboratoire'
                    ],
                    correctIndex: 1,
                    explanation: 'Formule de compensation de l\'alcalose métabolique : PaCO₂ attendue = 0,7 × HCO₃⁻ + 20 ± 5 = 0,7 × 42,5 + 20 = 49,7 ± 5 mmHg (soit 44,7 à 54,7 mmHg). L\'organisme compense l\'alcalose métabolique en diminuant la ventilation minute pour retenir du CO₂.'
                },
                {
                    id: 'q_paradoxical_aciduria',
                    question: '3. Quel phénomène rénal paradoxal pérennise cette alcalose métabolique en présence d\'hypovolémie et d\'hypokaliémie ?',
                    options: [
                        'L\'acidurie paradoxale : les reins sécrètent préférentiellement des H⁺ pour réabsorber le sodium et préserver le potassium manquant',
                        'Une polyurie osmotique massive',
                        'Une hyperchlorémie réactionnelle'
                    ],
                    correctIndex: 0,
                    explanation: 'En situation de déshydratation extracellulaire et d\'hypokaliémie sévère, l\'aldostérone est stimulée : pour réabsorber le Na⁺, le tube contourné distal est contraint d\'excréter des protons H⁺ (car le K⁺ fait défaut), ce qui entraîne une acidurie paradoxale et aggrave l\'alcalose sanguine.'
                },
                {
                    id: 'q_treatment_chlorure',
                    question: '4. Quel est le traitement de première intention pour corriger cette anomalie ?',
                    options: [
                        'Perfusion d\'acide chlorhydrique dilué par voie centrale',
                        'Réhydratation avec soluté salé isotonique (NaCl 0,9%) enrichi en chlorure de potassium (KCl)',
                        'Administration d\'acétazolamide à forte dose sans perfusion'
                    ],
                    correctIndex: 1,
                    explanation: 'Il s\'agit d\'une alcalose métabolique chlore-sensible : l\'apport de chlore (NaCl 0,9%) et de potassium (KCl) restaure la volémie, permet l\'excrétion rénale des bicarbonates et corrige l\'alcalose en quelques heures.'
                }
            ],
            diagnosis: 'Sténose du pylore compliquée d\'alcalose métabolique hypochlorémique et hypokaliémique sévère chlore-sensible avec compensation respiratoire adaptée par hypoventilation.'
        },
        clinicalPearls: [
            'L\'alcalose métabolique par perte de suc gastrique acide est dite « chlore-sensible » : le chlore urinaire est typiquement effondré (< 15-20 mmol/L).',
            'Sur le diagramme de Davenport, le point se déplace dans le quadrant supérieur droit (alcalose métabolique), au-dessus de l\'isobare 40 mmHg par rétention compensatrice de CO₂.'
        ]
    },
    {
        id: 'renal_failure_hyperkalemia',
        title: 'Insuffisance rénale aiguë anurique avec hyperkaliémie menaçante',
        specialty: 'Néphrologie / Réanimation',
        difficulty: 'Avancé',
        patient: {
            age: 65,
            sex: 'M',
            context: 'Homme de 65 ans hypertendu sous IEC et diurétique, ayant pris de l\'ibuprofène (AINS) à forte dose pour une sciatique depuis 4 jours dans un contexte de déshydratation estivale. Admis pour anurie complète depuis 24 heures. À l\'ECG : ondes T pointues, symétriques et amples dans toutes les dérivations précordiales, élargissement débutant du complexe QRS.',
            vitals: { ta: '160/95 mmHg', fc: '58 bpm', fr: '24 /min', spo2: '98% (AA)', temp: '37.0 °C' }
        },
        params: {
            pH: 7.23,
            paCO2: 26,
            hco3: 10.5,
            paO2: 94,
            saO2: 97,
            fiO2: 21,
            lactates: 1.2,
            na: 135,
            cl: 103,
            k: 6.6,
            albumin: 38
        },
        quiz: {
            steps: [
                {
                    id: 'q_primary_renal',
                    question: '1. Quel trouble acido-basique caractérise cette gazométrie artérielle ?',
                    options: [
                        'Acidose métabolique à trou anionique modérément élevé par défaut d\'excrétion rénale des acides fixes',
                        'Acidose respiratoire aiguë hypoxémique',
                        'Trouble purement hydro-électrolytique sans perturbation acido-basique'
                    ],
                    correctIndex: 0,
                    explanation: 'Le pH est bas à 7,23 avec des bicarbonates à 10,5 mmol/L. L\'anurie bloque l\'élimination rénale des acides fixes (sulfates, phosphates, urates), provoquant une acidose métabolique à TA élevé.'
                },
                {
                    id: 'q_anion_gap_renal',
                    question: '2. Quelle est la valeur du trou anionique ?',
                    options: [
                        'TA = 135 - (103 + 10,5) = 21,5 mmol/L (élevé)',
                        'TA = 11 mmol/L (strictement normal)',
                        'TA = 32 mmol/L'
                    ],
                    correctIndex: 0,
                    explanation: 'TA = 135 - 113,5 = 21,5 mmol/L (> 12 mmol/L). L\'élévation du trou anionique est due à la rétention des anions non dosés d\'origine endogène (phosphates, sulfates).'
                },
                {
                    id: 'q_winter_renal',
                    question: '3. Quelle est la PaCO₂ attendue selon la formule de Winter ?',
                    options: [
                        'PaCO₂ attendue = 1,5 × 10,5 + 8 = 23,75 ± 2 mmHg (21,8 à 25,8 mmHg) ; la valeur de 26 mmHg est adaptée',
                        'PaCO₂ attendue = 40 mmHg',
                        'PaCO₂ attendue = 15 mmHg'
                    ],
                    correctIndex: 0,
                    explanation: 'La PaCO₂ observée (26 mmHg) est très proche de la cible de Winter (23,8 ± 2 mmHg), montrant une compensation respiratoire quasi optimale par polypnée d\'hyperventilation.'
                },
                {
                    id: 'q_ecg_urgency',
                    question: '4. Face à une kaliémie à 6,6 mmol/L avec anomalies ECG, quel est le geste thérapeutique immédiat le plus urgent ?',
                    options: [
                        'Injection de furosémide à forte dose',
                        'Perfusion intraveineuse directe de gluconate de calcium pour cardioprotection membranaire',
                        'Prise de résine échangeuse d\'ions (Kayexalate) par voie orale'
                    ],
                    correctIndex: 1,
                    explanation: 'Toute hyperkaliémie menaçante avec signes ECG impose l\'injection immédiate de sels de calcium (gluconate ou chlorure) pour stabiliser le potentiel de membrane myocardique et prévenir la fibrillation ventriculaire.'
                }
            ],
            diagnosis: 'Insuffisance rénale aiguë anurique toxique (AINS + IEC) compliquée d\'acidose métabolique à trou anionique élevé (21,5 mmol/L), compensation respiratoire adaptée et hyperkaliémie menaçante (6,6 mmol/L) avec retentissement ECG.'
        },
        clinicalPearls: [
            'L\'acidose métabolique majore l\'hyperkaliémie par sortie du K⁺ intracellulaire en échange de l\'entrée d\'ions H⁺ dans la cellule (shift potassique d\'environ 0,5 mmol/L de K⁺ par 0,1 unité de chute de pH).',
            'Le gluconate de calcium ne baisse pas le potassium sanguin : il empêche l\'arrêt cardiaque en augmentant le seuil d\'excitabilité des cardiomyocytes.'
        ]
    },
    {
        id: 'hyperventilation_acute_alkalosis',
        title: 'Alcalose respiratoire aiguë sur crise de panique / hyperventilation',
        specialty: 'Psychiatrie / Urgences',
        difficulty: 'Débutant',
        patient: {
            age: 23,
            sex: 'F',
            context: 'Étudiante de 23 ans amenée aux urgences en période d\'examens pour sensation d\'étouffement brutal, oppression thoracique, palpitations et vertiges. Elle présente des paresthésies diffuses des quatre membres et de la région péribuccale, avec une contracture involontaire des mains en « main d\'accoucheur » (spasme carpopédal / signe de Trousseau). Pas d\'antécédent respiratoire ou cardiaque.',
            vitals: { ta: '135/85 mmHg', fc: '110 bpm', fr: '36 /min', spo2: '100% (AA)', temp: '36.7 °C' }
        },
        params: {
            pH: 7.55,
            paCO2: 23,
            hco3: 19.5,
            paO2: 112,
            saO2: 100,
            fiO2: 21,
            lactates: 1.1,
            na: 140,
            cl: 106,
            k: 3.5,
            albumin: 42
        },
        quiz: {
            steps: [
                {
                    id: 'q_primary_hypervent',
                    question: '1. Quel est le trouble acido-basique présenté ?',
                    options: [
                        'Alcalose respiratoire aiguë par hyperventilation alvéolaire psychogène',
                        'Acidose métabolique hypoxique',
                        'Alcalose métabolique sur déshydratation'
                    ],
                    correctIndex: 0,
                    explanation: 'Le pH est élevé à 7,55 (alcalémie) et la PaCO₂ est effondrée à 23 mmHg en raison d\'une hyperventilation alvéolaire majeure (36/min), sans signe d\'hypoxémie (PaO₂ 112 mmHg sous air).'
                },
                {
                    id: 'q_hco3_acute_drop',
                    question: '2. Pourquoi les bicarbonates sont-ils abaissés à 19,5 mmol/L ?',
                    options: [
                        'Il existe une acidose métabolique associée',
                        'C\'est la compensation aiguë par les tampons sanguins (baisse de 2 mmol/L de HCO₃⁻ par tranche de 10 mmHg de baisse de PaCO₂)',
                        'Il y a une fuite rénale de bicarbonates'
                    ],
                    correctIndex: 1,
                    explanation: 'En situation aiguë, le rein n\'a pas encore eu le temps d\'adapter son excrétion (délai de 24 à 48 heures). La baisse du HCO₃⁻ est purement physico-chimique via les tampons cellulaires et plasmatiques : ΔPaCO₂ = 40 - 23 = 17 mmHg ; baisse attendue de HCO₃⁻ = 0,2 × 17 = 3,4 mmol/L. HCO₃⁻ attendu = 24 - 3,4 = 20,6 mmol/L, conforme aux 19,5 mmol/L observés.'
                },
                {
                    id: 'q_tetany_mechanism',
                    question: '3. Quel mécanisme biologique explique les paresthésies et la tétanie (mains d\'accoucheur) de la patiente ?',
                    options: [
                        'Une baisse du calcium ionisé circulant (l\'alcalémie favorise la liaison du Ca²⁺ à l\'albumine)',
                        'Une hyperkaliémie aiguë',
                        'Une intoxication au monoxyde de carbone'
                    ],
                    correctIndex: 0,
                    explanation: 'L\'élévation du pH sanguin libère des sites négatifs sur l\'albumine plasmatique, augmentant la fixation du calcium ionisé sur les protéines. L\'hypocalcémie ionisée aiguë résultante augmente l\'excitabilité neuromusculaire et déclenche paresthésies, spasmes carpopédaux et signe de Chvostek.'
                }
            ],
            diagnosis: 'Crise d\'angoisse aiguë / attaque de panique avec hyperventilation alvéolaire responsable d\'une alcalose respiratoire aiguë pure (pH 7,55, PaCO₂ 23) et hypocalcémie ionisée fonctionnelle (tétanie).'
        },
        clinicalPearls: [
            'Avant de retenir l\'origine anxieuse d\'une alcalose respiratoire, toujours éliminer formellement une embolie pulmonaire débutante ou une crise d\'asthme précoce (qui se manifestent aussi par une polypnée avec hypocapnie).',
            'Le traitement repose sur le réconfort, le contrôle du rythme respiratoire et la respiration lente (le sachet de réinhalation n\'est plus recommandé en routine en raison des risques d\'hypoxie en cas de pathologie organique sous-jacente).'
        ]
    },
    {
        id: 'diarrhea_hyperchloremic',
        title: 'Acidose métabolique à trou anionique normal (pertes digestives par diarrhée profuse)',
        specialty: 'Gastro-entérologie / Médecine interne',
        difficulty: 'Intermédiaire',
        patient: {
            age: 58,
            sex: 'M',
            context: 'Homme de 58 ans hospitalisé pour gastro-entérite infectieuse aiguë sévère avec plus de 15 selles liquides profuses par jour depuis 4 jours. Il présente une asthénie intense, des vertiges orthostatiques et une soif inextinguible. À l\'examen : pli cutané sous-claviculaire franc, cernes péri-orbitaires, sécheresse des muqueuses.',
            vitals: { ta: '95/60 mmHg', fc: '104 bpm', fr: '26 /min', spo2: '98% (AA)', temp: '38.4 °C' }
        },
        params: {
            pH: 7.27,
            paCO2: 29,
            hco3: 13.0,
            paO2: 96,
            saO2: 97,
            fiO2: 21,
            lactates: 1.2,
            na: 139,
            cl: 116,
            k: 3.1,
            albumin: 40
        },
        quiz: {
            steps: [
                {
                    id: 'q_primary_diarrhea',
                    question: '1. Quel est le diagnostic gazométrique ?',
                    options: [
                        'Acidose métabolique',
                        'Alcalose métabolique',
                        'Acidose respiratoire pure'
                    ],
                    correctIndex: 0,
                    explanation: 'Le pH est à 7,27 (acidémie) avec des bicarbonates abaissés à 13 mmol/L, caractérisant une acidose métabolique.'
                },
                {
                    id: 'q_ta_diarrhea',
                    question: '2. Quelle est la valeur du trou anionique plasmatique et que signifie-t-elle ?',
                    options: [
                        'TA = 139 - (116 + 13) = 10 mmol/L (normal) : acidose métabolique hyperchlorémique par perte de bicarbonates',
                        'TA = 24 mmol/L : acidose à trou anionique élevé par accumulation de toxiques',
                        'TA incalculable car le chlore est trop haut'
                    ],
                    correctIndex: 0,
                    explanation: 'TA = 139 - (116 + 13) = 10 mmol/L (dans la normale 8-12). Le liquide diarrhéique est riche en bicarbonates : la perte intestinale de HCO₃⁻ est compensée électriquement par une rétention de chlorures (Cl⁻ = 116 mmol/L), maintenant un trou anionique normal.'
                },
                {
                    id: 'q_winter_diarrhea',
                    question: '3. La compensation respiratoire observée (PaCO₂ 29 mmHg) est-elle adaptée ?',
                    options: [
                        'Oui, la formule de Winter donne 1,5 × 13 + 8 = 27,5 ± 2 mmHg (25,5 à 29,5 mmHg), conforme à la mesure',
                        'Non, la PaCO₂ devrait être de 40 mmHg',
                        'La compensation est excessive avec alcalose respiratoire surajoutée'
                    ],
                    correctIndex: 0,
                    explanation: 'La PaCO₂ mesurée (29 mmHg) se situe dans l\'intervalle de Winter (25,5 - 29,5 mmHg), démontrant une compensation respiratoire physiologique adéquate.'
                },
                {
                    id: 'q_trou_urinaire',
                    question: '4. Pour distinguer une perte digestive d\'une cause rénale (acidose tubulaire) devant une acidose à TA normal, quel indice biologique utilise-t-on ?',
                    options: [
                        'Le trou anionique urinaire (TAU = Na_u + K_u - Cl_u) : négatif si perte digestive (sécrétion normale d\'ammonium), positif si tubulopathie',
                        'Le dosage des lactates urinaires',
                        'La clairance de l\'inuline'
                    ],
                    correctIndex: 0,
                    explanation: 'Face à une acidose métabolique à TA normal, le trou anionique urinaire (TAU) est négatif (généralement < -10 mmol/L) en cas de diarrhée car le rein sain élimine massivement des ions ammonium NH₄⁺ accompagnés de Cl⁻. Un TAU positif signerait une acidose tubulaire rénale par défaut d\'excrétion d\'ammonium.'
                }
            ],
            diagnosis: 'Gastro-entérite aiguë sévère responsable d\'une déshydratation extracellulaire et d\'une acidose métabolique à trou anionique normal (hyperchlorémique, TA 10 mmol/L) par spoliation digestive de bicarbonates avec hypokaliémie.'
        },
        clinicalPearls: [
            'Règle d\'or : Acidose métabolique à trou anionique normal = perte de bicarbonates (digestive ou rénale) ou apport excessif de solutés salés riches en chlore (NaCl 0,9%).',
            'La réhydratation doit intégrer du potassium et des solutés balancés (Ringer Lactate ou bicarbonate isotonique à 1,4%) plutôt que du sérum physiologique 0,9% qui aggraverait l\'acidose hyperchlorémique.'
        ]
    }
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GDS_CASES };
}
if (typeof window !== 'undefined') {
    window.GDS_CASES = GDS_CASES;
}
