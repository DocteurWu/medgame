/**
 * atlas-i18n.js — Moteur de traduction anatomique EN → FR (instantané, 100 % local).
 * Les noms BodyParts3D/FMA sont compositionnels : on traduit token par token avec grammaire
 * (tête nominale + adjectifs accordés + chaînes "X of Y" → "X de la/du/de l' Y" + côté en suffixe D/G).
 * Retourne null si un mot est inconnu (l'UI affiche alors le nom EN original, jamais de mixte).
 */

// ---- noms : [français, genre] ----
const NOUN = {
    aorta: ['aorte', 'f'], artery: ['artère', 'f'], vein: ['veine', 'f'], vessel: ['vaisseau', 'm'],
    branch: ['branche', 'f'], trunk: ['tronc', 'm'], arch: ['arc', 'm'], segment: ['segment', 'm'],
    part: ['partie', 'f'], tributary: ['affluent', 'm'], subdivision: ['subdivision', 'f'],
    anastomosis: ['anastomose', 'f'], ventricle: ['ventricule', 'm'], atrium: ['oreillette', 'f'],
    valve: ['valve', 'f'], heart: ['cœur', 'm'], lung: ['poumon', 'm'], liver: ['foie', 'm'],
    kidney: ['rein', 'm'], stomach: ['estomac', 'm'], spleen: ['rate', 'f'], brain: ['encéphale', 'm'],
    trachea: ['trachée', 'f'], bronchus: ['bronche', 'f'], bronchiole: ['bronchiole', 'f'],
    pleura: ['plèvre', 'f'], diaphragm: ['diaphragme', 'm'], bone: ['os', 'm'], muscle: ['muscle', 'm'],
    nerve: ['nerf', 'm'], skin: ['peau', 'f'], eye: ['œil', 'm'], ear: ['oreille', 'f'],
    pancreas: ['pancréas', 'm'], gallbladder: ['vésicule', 'f'], thyroid: ['thyroïde', 'f'],
    bladder: ['vessie', 'f'], ureter: ['uretère', 'm'], urethra: ['urètre', 'm'],
    intestine: ['intestin', 'm'], colon: ['côlon', 'm'], rectum: ['rectum', 'm'],
    appendix: ['appendice', 'm'], duodenum: ['duodénum', 'm'], ileum: ['iléon', 'm'],
    jejunum: ['jéjunum', 'm'], cecum: ['cæcum', 'm'], femur: ['fémur', 'm'], humerus: ['humérus', 'm'],
    tibia: ['tibia', 'm'], fibula: ['fibula', 'f'], pelvis: ['bassin', 'm'], clavicle: ['clavicule', 'f'],
    scapula: ['omoplate', 'f'], mandible: ['mandibule', 'f'], maxilla: ['maxillaire', 'm'],
    skull: ['crâne', 'm'], cranium: ['crâne', 'm'], sternum: ['sternum', 'm'], vertebra: ['vertèbre', 'f'],
    spine: ['rachis', 'm'], cord: ['cordon', 'm'], medulla: ['moelle', 'f'], cortex: ['cortex', 'm'],
    cerebellum: ['cervelet', 'm'], cerebrum: ['cerveau', 'm'], gyrus: ['gyrus', 'm'],
    sulcus: ['sillon', 'm'], thalamus: ['thalamus', 'm'], lobe: ['lobe', 'm'], rib: ['côte', 'f'],
    cartilage: ['cartilage', 'm'], ligament: ['ligament', 'm'], tendon: ['tendon', 'm'],
    joint: ['articulation', 'f'], sacrum: ['sacrum', 'm'], coccyx: ['coccyx', 'm'],
    patella: ['rotule', 'f'], phalanx: ['phalange', 'f'], finger: ['doigt', 'm'], toe: ['orteil', 'm'],
    tooth: ['dent', 'f'], head: ['tête', 'f'], neck: ['cou', 'm'], wall: ['paroi', 'f'],
    foot: ['pied', 'm'], hand: ['main', 'f'], arm: ['bras', 'm'], leg: ['jambe', 'f'],
    thigh: ['cuisse', 'f'], organ: ['organe', 'm'], zone: ['zone', 'f'], limb: ['membre', 'm'],
    tree: ['arbre', 'm'], variant: ['variante', 'f'], septum: ['septum', 'm'], conus: ['cône', 'm'],
    sinus: ['sinus', 'm'], node: ['nœud', 'm'], ganglion: ['ganglion', 'm'], plexus: ['plexus', 'm'],
    duct: ['conduit', 'm'], gland: ['glande', 'f'], capsule: ['capsule', 'f'], membrane: ['membrane', 'f'],
    region: ['région', 'f'], ring: ['anneau', 'm'], symphysis: ['symphyse', 'f'],
    neuraxis: ['névraxe', 'm'], space: ['espace', 'm'], junction: ['jonction', 'f'],
    cavity: ['cavité', 'f'], fossa: ['fosse', 'f'], foramen: ['foramen', 'm'], canal: ['canal', 'm'],
    meatus: ['méat', 'm'], sphincter: ['sphincter', 'm'], papilla: ['papille', 'f'],
    follicle: ['follicule', 'm'], ovary: ['ovaire', 'm'], testis: ['testicule', 'm'],
    uterus: ['utérus', 'm'], prostate: ['prostate', 'f'], penis: ['pénis', 'm'], breast: ['sein', 'm'],
    nipple: ['mamelon', 'm'], elbow: ['coude', 'm'], wrist: ['poignet', 'm'], knee: ['genou', 'm'],
    ankle: ['cheville', 'f'], shoulder: ['épaule', 'f'], hip: ['hanche', 'f'], back: ['dos', 'm'],
    chest: ['poitrine', 'f'], abdomen: ['abdomen', 'm'], thorax: ['thorax', 'm'], face: ['face', 'f'],
    forehead: ['front', 'm'], cheek: ['joue', 'f'], chin: ['menton', 'm'], nose: ['nez', 'm'],
    nostril: ['narine', 'f'], lip: ['lèvre', 'f'], tongue: ['langue', 'f'], palate: ['palais', 'm'],
    throat: ['gorge', 'f'], larynx: ['larynx', 'm'], pharynx: ['pharynx', 'm'],
    esophagus: ['œsophage', 'm'], tonsil: ['amygdale', 'f'], thymus: ['thymus', 'm'],
    adrenal: ['surrénale', 'f'], pituitary: ['hypophyse', 'f'], hypothalamus: ['hypothalamus', 'm'],
    retina: ['rétine', 'f'], cornea: ['cornée', 'f'], lens: ['cristallin', 'm'], iris: ['iris', 'm'],
    pupil: ['pupille', 'f'], cochlea: ['cochlée', 'f'], ossicle: ['osselet', 'm'],
    peritoneum: ['péritoine', 'm'], mesentery: ['mésentère', 'm'], fascia: ['fascia', 'm'],
    sheath: ['gaine', 'f'], hilum: ['hile', 'm'], body: ['corps', 'm'], apex: ['apex', 'm'],
    base: ['base', 'f'], pole: ['pôle', 'm'], border: ['bord', 'm'], surface: ['surface', 'f'],
    layer: ['couche', 'f'], fold: ['pli', 'm'], crest: ['crête', 'f'], tubercle: ['tubercule', 'm'],
    condyle: ['condyle', 'm'], malleolus: ['malléole', 'f'], ramus: ['rameau', 'm'],
    fissure: ['fissure', 'f'], suture: ['suture', 'f'], disc: ['disque', 'm'], nucleus: ['noyau', 'm'],
    aqueduct: ['aqueduc', 'm'], dura: ['dure-mère', 'f'], arachnoid: ['arachnoïde', 'f'],
    cusp: ['cuspide', 'f'], leaflet: ['feuillet', 'm'], set: ['ensemble', 'm'],
    decussation: ['décussation', 'f'], continuity: ['continuité', 'f'], line: ['ligne', 'f'],
    talus: ['talus', 'm'], vomer: ['vomer', 'm'], transversus: ['transverse', 'm'],
    incisor: ['incisive', 'f'], molar: ['molaire', 'f'], bile: ['bile', 'f'],
    portion: ['portion', 'f'], tissue: ['tissu', 'm'], chamber: ['cavité', 'f'],
    opponens: ['opposant', 'm'], supraspinatus: ['supra-épineux', 'm'],
    manubrium: ['manubrium', 'm'], retinaculum: ['rétinaculum', 'm'], component: ['constituant', 'm'],
    pia: ['pie-mère', 'f'], extensor: ['extenseur', 'm'], flexor: ['fléchisseur', 'm'],
    carotid: ['carotide', 'f'], system: ['système', 'm'], compartment: ['loge', 'f'],
    disk: ['disque', 'm'], rectus: ['droit', 'm'], obliquus: ['oblique', 'm'],
    oblique: ['oblique', 'm'], skeleton: ['squelette', 'm'], rhomboid: ['rhomboïde', 'm'],
    scalenus: ['scalène', 'm'], serratus: ['dentelé', 'm'], girdle: ['ceinture', 'f'],
    // Lot vaisseaux (A1)
    bifurcation: ['bifurcation', 'f'], circle: ['cercle', 'm'], arcade: ['arcade', 'f'],
    division: ['division', 'f'], rete: ['réseau', 'm'], vasa: ['vaisseaux', 'm'], twig: ['ramuscule', 'm'],
    // Lot squelette (A2)
    radius: ['radius', 'm'], ulna: ['ulna', 'f'], scaphoid: ['scaphoïde', 'm'], lunate: ['lunatum', 'm'],
    triquetrum: ['triquétrum', 'm'], triquetral: ['triquétrum', 'm'], pisiform: ['pisiforme', 'm'],
    trapezium: ['trapèze', 'm'], trapezoid: ['trapézoïde', 'm'], capitate: ['capitatum', 'm'],
    hamate: ['hamatum', 'm'], calcaneus: ['calcanéus', 'm'], cuboid: ['cuboïde', 'm'],
    navicular: ['naviculaire', 'm'], cuneiform: ['cunéiforme', 'm'], sesamoid: ['sésamoïde', 'm'],
    sphenoid: ['sphénoïde', 'm'], ethmoid: ['ethmoïde', 'm'], hyoid: ['hyoïde', 'm'],
    canine: ['canine', 'f'], premolar: ['prémolaire', 'f'], pedicle: ['pédicule', 'm'],
    lamina: ['lame', 'f'], facet: ['facette', 'f'], process: ['processus', 'm'],
    sac: ['sac', 'm'], thumb: ['pouce', 'm'],
    // Lot muscles (A3)
    gastrocnemius: ['gastrocnémien', 'm'], soleus: ['soléaire', 'm'], lumbrical: ['lombrical', 'm'],
    gracilis: ['gracile', 'm'], sartorius: ['couturier', 'm'], piriformis: ['piriforme', 'm'],
    obturator: ['obturateur', 'm'], gemellus: ['jumeau', 'm'], quadratus: ['carré', 'm'],
    iliacus: ['iliaque', 'm'], psoas: ['psoas', 'm'], platysma: ['platysma', 'm'],
    digastric: ['digastrique', 'm'], mylohyoid: ['mylo-hyoïdien', 'm'], geniohyoid: ['génio-hyoïdien', 'm'],
    biceps: ['biceps', 'm'], triceps: ['triceps', 'm'], quadriceps: ['quadriceps', 'm'],
    vastus: ['vaste', 'm'], semitendinosus: ['semi-tendineux', 'm'], semimembranosus: ['semi-membraneux', 'm'],
    popliteus: ['poplité', 'm'], pronator: ['pronateur', 'm'], supinator: ['supinateur', 'm'],
    coracobrachialis: ['coraco-brachial', 'm'], brachialis: ['brachial', 'm'], anconeus: ['anconé', 'm'],
    infraspinatus: ['infra-épineux', 'm'], subscapularis: ['subscapulaire', 'm'], subclavius: ['sous-clavier', 'm'],
    adductor: ['adducteur', 'm'], abductor: ['abducteur', 'm'], levator: ['élévateur', 'm'],
    tensor: ['tenseur', 'm'], trapezius: ['trapèze', 'm'], splenius: ['splénius', 'm'],
    longissimus: ['longissimus', 'm'], iliocostalis: ['ilio-costal', 'm'], semispinalis: ['semi-épineux', 'm'],
    tibialis: ['tibial', 'm'], fibularis: ['fibulaire', 'm'], palmaris: ['palmaire', 'm'],
    // Lot nerfs/tête/viscères (A4)
    sclera: ['sclérotique', 'f'], choroid: ['choroïde', 'f'], vitreous: ['vitré', 'm'],
    conjunctiva: ['conjonctive', 'f'], eyelid: ['paupière', 'f'], orbit: ['orbite', 'f'],
    malleus: ['marteau', 'm'], incus: ['enclume', 'f'], stapes: ['étrier', 'm'],
    labyrinth: ['labyrinthe', 'm'], epiglottis: ['épiglotte', 'f'], glottis: ['glotte', 'f'],
    omentum: ['épiploon', 'm'], serosa: ['séreuse', 'f'], mucosa: ['muqueuse', 'f'],
    submucosa: ['sous-muqueuse', 'f'], fundus: ['fundus', 'm'], pylorus: ['pylore', 'm'],
    cardia: ['cardia', 'm'], antrum: ['antre', 'm'], mesocolon: ['mésocôlon', 'm'],
    cell: ['cellule', 'f'], cluster: ['amas', 'm'], cricothyroid: ['muscle crico-thyroïdien', 'm'],
    mouth: ['bouche', 'f'], taenia: ['tænia', 'm'],
    pectoralis: ['pectoral', 'm'], gluteus: ['fessier', 'm'],
    subsector: ['sous-secteur', 'm'], sector: ['secteur', 'm'],
    mesoappendix: ['méso-appendice', 'm'], glans: ['gland', 'm'],
    epididymis: ['épididyme', 'm'], clitoris: ['clitoris', 'm'],
    coccygeus: ['coccygien', 'm'], pubococcygeus: ['pubo-coccygien', 'm'],
    puborectalis: ['pubo-rectal', 'm'], iliococcygeus: ['ilio-coccygien', 'm'],
    corpus: ['corps', 'm'], spongiosum: ['spongieux', 'm'], cavernosum: ['caverneux', 'm'],
    constrictor: ['constricteur', 'm'], hemisphere: ['hémisphère', 'm'],
    callosomarginal: ['calloso-marginal', 'm'], tract: ['faisceau', 'm'],
    mediastinum: ['médiastin', 'm'], matter: ['substance', 'f'], content: ['contenu', 'm'],
    hand: ['main', 'f'], forearm: ['avant-bras', 'm'], colliculus: ['colliculus', 'm'],
    corticospinal: ['cortico-spinal', 'cortico-spinale'],
};

// ---- adjectifs : [masculin, féminin] ----
const ADJ = {
    anterior: ['antérieur', 'antérieure'], posterior: ['postérieur', 'postérieure'],
    superior: ['supérieur', 'supérieure'], inferior: ['inférieur', 'inférieure'],
    lateral: ['latéral', 'latérale'], medial: ['médial', 'médiale'], middle: ['moyen', 'moyenne'],
    central: ['central', 'centrale'], dorsal: ['dorsal', 'dorsale'], ventral: ['ventral', 'ventrale'],
    distal: ['distal', 'distale'], proximal: ['proximal', 'proximale'],
    superficial: ['superficiel', 'superficielle'], deep: ['profond', 'profonde'],
    internal: ['interne', 'interne'], external: ['externe', 'externe'],
    common: ['commun', 'commune'], proper: ['propre', 'propre'],
    ascending: ['ascendant', 'ascendante'], descending: ['descendant', 'descendante'],
    transverse: ['transverse', 'transverse'], oblique: ['oblique', 'oblique'],
    circular: ['circulaire', 'circulaire'], frontal: ['frontal', 'frontale'],
    parietal: ['pariétal', 'pariétale'], occipital: ['occipital', 'occipitale'],
    temporal: ['temporal', 'temporale'], nasal: ['nasal', 'nasale'], oral: ['oral', 'orale'],
    lingual: ['lingual', 'linguale'], facial: ['facial', 'faciale'], brachial: ['brachial', 'brachiale'],
    femoral: ['fémoral', 'fémorale'], popliteal: ['poplité', 'poplitée'], tibial: ['tibial', 'tibiale'],
    fibular: ['fibulaire', 'fibulaire'], radial: ['radial', 'radiale'], ulnar: ['ulnaire', 'ulnaire'],
    carpal: ['carpien', 'carpienne'], tarsal: ['tarsien', 'tarsienne'],
    metacarpal: ['métacarpien', 'métacarpienne'], metatarsal: ['métatarsien', 'métatarsienne'],
    costal: ['costal', 'costale'], intercostal: ['intercostal', 'intercostale'],
    sternal: ['sternal', 'sternale'], vertebral: ['vertébral', 'vertébrale'],
    lumbar: ['lombaire', 'lombaire'], sacral: ['sacré', 'sacrée'], cervical: ['cervical', 'cervicale'],
    thoracic: ['thoracique', 'thoracique'], abdominal: ['abdominal', 'abdominale'],
    pelvic: ['pelvien', 'pelvienne'], inguinal: ['inguinal', 'inguinale'], axillary: ['axillaire', 'axillaire'],
    pubic: ['pubien', 'pubienne'], hepatic: ['hépatique', 'hépatique'], cystic: ['cystique', 'cystique'],
    pancreatic: ['pancréatique', 'pancréatique'], splenic: ['splénique', 'splénique'],
    renal: ['rénal', 'rénale'], vesical: ['vésical', 'vésicale'], ovarian: ['ovarien', 'ovarienne'],
    uterine: ['utérin', 'utérine'], testicular: ['testiculaire', 'testiculaire'],
    bronchial: ['bronchique', 'bronchique'], pulmonary: ['pulmonaire', 'pulmonaire'],
    cardiac: ['cardiaque', 'cardiaque'], coronary: ['coronaire', 'coronaire'], aortic: ['aortique', 'aortique'],
    mitral: ['mitral', 'mitrale'], tricuspid: ['tricuspide', 'tricuspide'],
    atrial: ['auriculaire', 'auriculaire'], ventricular: ['ventriculaire', 'ventriculaire'],
    septal: ['septal', 'septale'], marginal: ['marginal', 'marginale'], diagonal: ['diagonal', 'diagonale'],
    circumflex: ['circonflexe', 'circonflexe'], cerebral: ['cérébral', 'cérébrale'],
    basal: ['basal', 'basale'], apical: ['apical', 'apicale'], palmar: ['palmaire', 'palmaire'],
    plantar: ['plantaire', 'plantaire'], digital: ['digital', 'digitale'],
    nasolacrimal: ['naso-lacrymal', 'naso-lacrymale'], suprascapular: ['supra-scapulaire', 'supra-scapulaire'],
    ileocecal: ['iléo-cæcal', 'iléo-cæcale'], tracheobronchial: ['trachéo-bronchique', 'trachéo-bronchique'],
    connective: ['conjonctif', 'conjonctive'], free: ['libre', 'libre'],
    investing: ["d'enveloppe", "d'enveloppe"],
    segmental: ['segmentaire', 'segmentaire'], lobar: ['lobaire', 'lobaire'],
    subclavian: ['sous-clavier', 'sous-clavière'], brachiocephalic: ['brachiocéphalique', 'brachiocéphalique'],
    mesenteric: ['mésentérique', 'mésentérique'], celiac: ['cœliaque', 'cœliaque'],
    phrenic: ['phrénique', 'phrénique'], epigastric: ['épigastrique', 'épigastrique'],
    sural: ['sural', 'surale'], peroneal: ['fibulaire', 'fibulaire'], meningeal: ['méningé', 'méningée'],
    cortical: ['cortical', 'corticale'], medullary: ['médullaire', 'médullaire'],
    optic: ['optique', 'optique'], retinal: ['rétinien', 'rétinienne'], cochlear: ['cochléaire', 'cochléaire'],
    olfactory: ['olfactif', 'olfactive'], auditory: ['auditif', 'auditive'],
    vestibular: ['vestibulaire', 'vestibulaire'], long: ['long', 'longue'], short: ['court', 'courte'],
    great: ['grand', 'grande'], small: ['petit', 'petite'], major: ['grand', 'grande'],
    minor: ['petit', 'petite'], longus: ['long', 'longue'], brevis: ['court', 'courte'],
    magnus: ['grand', 'grande'], minimus: ['petit', 'petite'], rectus: ['droit', 'droite'],
    serratus: ['dentelé', 'dentelée'], deltoid: ['deltoïde', 'deltoïde'],
    gluteal: ['fessier', 'fessière'], pectoral: ['pectoral', 'pectorale'],
    interosseous: ['interosseux', 'interosseuse'], secondary: ['secondaire', 'secondaire'],
    primary: ['primaire', 'primaire'], accessory: ['accessoire', 'accessoire'],
    recurrent: ['récurrent', 'récurrente'], little: ['petit', 'petite'], greater: ['grand', 'grande'],
    lesser: ['petit', 'petite'], upper: ['supérieur', 'supérieure'], lower: ['inférieur', 'inférieure'],
    sigmoid: ['sigmoïde', 'sigmoïde'], basilar: ['basilaire', 'basilaire'],
    oblique: ['oblique', 'oblique'],
    esophageal: ['œsophagien', 'œsophagienne'], subcostal: ['sous-costal', 'sous-costale'],
    costocervical: ['costo-cervical', 'costo-cervicale'], cranial: ['crânien', 'crânienne'],
    autonomic: ['autonome', 'autonome'], parasympathetic: ['parasympathique', 'parasympathique'],
    sympathetic: ['sympathique', 'sympathique'], ciliary: ['ciliaire', 'ciliaire'],
    lacrimal: ['lacrymal', 'lacrymale'], genicular: ['géniculé', 'géniculée'],
    acromial: ['acromial', 'acromiale'], biliary: ['biliaire', 'biliaire'],
    anatomical: ['anatomique', 'anatomique'],
    lingular: ['lingulaire', 'lingulaire'], subsegmental: ['sous-segmentaire', 'sous-segmentaire'],
    salivary: ['salivaire', 'salivaire'], perineal: ['périnéal', 'périnéale'],
    cerebellar: ['cérébelleux', 'cérébelleuse'], arytenoid: ['aryténoïde', 'aryténoïde'],
    radialis: ['radial', 'radiale'], ulnaris: ['ulnaire', 'ulnaire'],
    tibialis: ['tibial', 'tibiale'], fibularis: ['fibulaire', 'fibulaire'],
    peroneus: ['fibulaire', 'fibulaire'], palmaris: ['palmaire', 'palmaire'],
    plantaris: ['plantaire', 'plantaire'], dorsalis: ['dorsal', 'dorsale'],
    anterolateral: ['antéro-latéral', 'antéro-latérale'], anteromedial: ['antéro-médial', 'antéro-médiale'],
    posterolateral: ['postéro-latéral', 'postéro-latérale'], posteromedial: ['postéro-médial', 'postéro-médiale'],
    true: ['vrai', 'vraie'], false: ['faux', 'fausse'], typical: ['typique', 'typique'],
    atypical: ['atypique', 'atypique'], floating: ['flottant', 'flottante'],
    irregular: ['irrégulier', 'irrégulière'], flat: ['plat', 'plate'],
    pneumatized: ['pneumatisé', 'pneumatisée'],
    venous: ['veineux', 'veineuse'], arterial: ['artériel', 'artérielle'],
    vascular: ['vasculaire', 'vasculaire'], lymphatic: ['lymphatique', 'lymphatique'],
    nervous: ['nerveux', 'nerveuse'], muscular: ['musculaire', 'musculaire'],
    skeleton: ['squelettique', 'squelettique'], osseous: ['osseux', 'osseuse'],
    cephalic: ['céphalique', 'céphalique'], innermost: ['le plus profond', 'la plus profonde'],
    infrahyoid: ['infra-hyoïdien', 'infra-hyoïdienne'], caudate: ['caudé', 'caudée'],
    humeral: ['huméral', 'humérale'],
    neural: ['neural', 'neurale'], variant: ['variant', 'variante'],
    segmental: ['segmentaire', 'segmentaire'], interventricular: ['interventriculaire', 'interventriculaire'],
    intervertebral: ['intervertébral', 'intervertébrale'], portal: ['porte', 'porte'],
    iliac: ['iliaque', 'iliaque'], scapular: ['scapulaire', 'scapulaire'],
    clavicular: ['claviculaire', 'claviculaire'], thyrocervical: ['thyro-cervical', 'thyro-cervicale'],
    musculophrenic: ['musculo-phrénique', 'musculo-phrénique'],
    bronchopulmonary: ['broncho-pulmonaire', 'broncho-pulmonaire'],
    papillary: ['papillaire', 'papillaire'], main: ['principal', 'principale'],
    membrane: ['membraneux', 'membraneuse'],
    // Lot vaisseaux (A1)
    median: ['médian', 'médiane'], collateral: ['collatéral', 'collatérale'],
    communicating: ['communicant', 'communicante'], perforating: ['perforant', 'perforante'],
    profunda: ['profond', 'profonde'], subscapular: ['subscapulaire', 'subscapulaire'],
    thoracodorsal: ['thoraco-dorsal', 'thoraco-dorsale'], thoracoacromial: ['thoraco-acromial', 'thoraco-acromiale'],
    thoracoepigastric: ['thoraco-épigastrique', 'thoraco-épigastrique'], thoraco: ['thoraco', 'thoraco'],
    suprarenal: ['suprarénal', 'suprarénale'], saphenous: ['saphène', 'saphène'],
    basilic: ['basilique', 'basilique'], cubital: ['cubital', 'cubitale'],
    obturator: ['obturateur', 'obturatrice'], pudendal: ['pudendal', 'pudendale'],
    gonadal: ['gonadique', 'gonadique'], gastroepiploic: ['gastro-épiploïque', 'gastro-épiploïque'],
    epiploic: ['épiploïque', 'épiploïque'], duodenal: ['duodénal', 'duodénale'],
    jejunal: ['jéjunal', 'jéjunale'], ileal: ['iléal', 'iléale'], cecal: ['cæcal', 'cæcale'],
    appendicular: ['appendiculaire', 'appendiculaire'], ileocolic: ['iléo-colique', 'iléo-colique'],
    pancreaticoduodenal: ['pancréatico-duodénal', 'pancréatico-duodénale'],
    gastroduodenal: ['gastro-duodénal', 'gastro-duodénale'], colic: ['colique', 'colique'],
    rectal: ['rectal', 'rectale'], vaginal: ['vaginal', 'vaginale'], maxillary: ['maxillaire', 'maxillaire'],
    ophthalmic: ['ophtalmique', 'ophtalmique'], atrioventricular: ['atrio-ventriculaire', 'atrio-ventriculaire'],
    sinoatrial: ['sino-atrial', 'sino-atriale'], arcuate: ['arqué', 'arquée'],
    helicine: ['hélicin', 'hélicine'], striate: ['strié', 'striée'], omental: ['omental', 'omentale'],
    // Lot squelette (A2)
    spinous: ['épineux', 'épineuse'], deciduous: ['décidual', 'déciduale'],
    xiphoid: ['xiphoïde', 'xiphoïde'], zygomatic: ['zygomatique', 'zygomatique'],
    palatine: ['palatin', 'palatine'], ethmoidal: ['ethmoïdal', 'ethmoïdale'],
    calcaneal: ['calcanéen', 'calcanéenne'], patellar: ['patellaire', 'patellaire'],
    prefrontal: ['préfrontal', 'préfrontale'],
    // Lot muscles (A3)
    medius: ['moyen', 'moyenne'], lateralis: ['latéral', 'latérale'],
    medialis: ['médial', 'médiale'], intermedius: ['intermédiaire', 'intermédiaire'],
    tertius: ['troisième', 'troisième'], minimi: ['petit', 'petite'],
    maximus: ['grand', 'grande'], minimus: ['petit', 'petite'],
    // Lot nerfs/tête/viscères (A4)
    oculomotor: ['oculomoteur', 'oculomotrice'], trochlear: ['trochléaire', 'trochléaire'],
    abducens: ['abducens', 'abducens'], glossopharyngeal: ['glosso-pharyngien', 'glosso-pharyngienne'],
    hypoglossal: ['hypoglosse', 'hypoglosse'], mandibular: ['mandibulaire', 'mandibulaire'],
    pterygopalatine: ['ptérygo-palatin', 'ptérygo-palatine'], otic: ['otique', 'otique'],
    submandibular: ['sous-mandibulaire', 'sous-mandibulaire'], tympanic: ['tympanique', 'tympanique'],
    choroidal: ['choroïdien', 'choroïdienne'], vitreous: ['vitré', 'vitrée'],
    vocal: ['vocal', 'vocale'], hyoid: ['hyoïdien', 'hyoïdienne'],
    semicircular: ['semi-circulaire', 'semi-circulaire'], orbital: ['orbitaire', 'orbitaire'],
    nasociliary: ['nasociliaire', 'nasociliaire'], thyrohyoid: ['thyro-hyoïdien', 'thyro-hyoïdienne'],
    suprahyoid: ['supra-hyoïdien', 'supra-hyoïdienne'],
    sternocostal: ['sterno-costal', 'sterno-costale'],
    pharyngeal: ['pharyngien', 'pharyngienne'], systemic: ['systémique', 'systémique'],
    white: ['blanc', 'blanche'], gray: ['gris', 'grise'], grey: ['gris', 'grise'],
    large: ['grand', 'grande'], small: ['petit', 'petite'], urinary: ['urinaire', 'urinaire'],
    seminal: ['séminal', 'séminale'], loose: ['lâche', 'lâche'], mucoid: ['mucoïde', 'mucoïde'],
    cavernous: ['caverneux', 'caverneuse'], visceral: ['viscéral', 'viscérale'],
    peritoneal: ['péritonéal', 'péritonéale'], anal: ['anal', 'anale'],
    internus: ['interne', 'interne'], externus: ['externe', 'externe'],
    libera: ['libre', 'libre'], iliolumbar: ['ilio-lombaire', 'ilio-lombaire'],
    deferent: ['déférent', 'déférente'],
    gastric: ['gastrique', 'gastrique'], gastro: ['gastro', 'gastro'],
    coeliac: ['cœliaque', 'cœliaque'], caudal: ['caudal', 'caudale'],
    extrahepatic: ['extra-hépatique', 'extra-hépatique'],
    hepatovenous: ['hépatico-veineux', 'hépatico-veineuse'],
};

// Noms employés comme épithètes devant la tête ("carotid artery" → "artère carotide…")
const NOUN_AS_ADJ = {
    carotid: ['carotidien', 'carotidienne'], thyroid: ['thyroïdien', 'thyroïdienne'],
    conus: ['conal', 'conale'], pituitary: ['hypophysaire', 'hypophysaire'],
    thymic: ['thymique', 'thymique'], adductor: ['adducteur', 'adductrice'],
    abductor: ['abducteur', 'abductrice'], jugular: ['jugulaire', 'jugulaire'],
    bone: ['osseux', 'osseuse'], muscle: ['musculaire', 'musculaire'], nerve: ['nerveux', 'nerveuse'],
    organ: ["d'organe", "d'organe"], cartilage: ['cartilagineux', 'cartilagineuse'],
    ligament: ['ligamenteux', 'ligamenteuse'],
    adrenal: ['surrénalien', 'surrénalienne'], conduit: ['canalaire', 'canalaire'],
    incisor: ['incisif', 'incisive'], molar: ['molaire', 'molaire'], bile: ['biliaire', 'biliaire'],
    azygos: ['azygos', 'azygos'], hemiazygos: ['hémi-azygos', 'hémi-azygos'],
    lobe: ['lobaire', 'lobaire'],
    // Lots A2/A3
    navicular: ['naviculaire', 'naviculaire'], cuboid: ['cuboïde', 'cuboïde'],
    cuneiform: ['cunéiforme', 'cunéiforme'], sesamoid: ['sésamoïde', 'sésamoïde'],
    sphenoid: ['sphénoïde', 'sphénoïde'], hyoid: ['hyoïde', 'hyoïde'],
    canine: ['canine', 'canine'], premolar: ['prémolaire', 'prémolaire'],
    obturator: ['obturateur', 'obturatrice'], thenar: ['thénar', 'thénar'],
    hypothenar: ['hypothénar', 'hypothénar'], teres: ['rond', 'ronde'],
    pronator: ['pronateur', 'pronatrice'],
    // Lot A4 (groupements FMA abstraits)
    component: ['constitutif', 'constitutive'], cavity: ['cavitaire', 'cavitaire'],
    tree: ['arborescent', 'arborescente'], cell: ['cellulaire', 'cellulaire'],
    part: ['partiel', 'partielle'],
};

const ORD = {
    first: ['premier', 'première'], second: ['deuxième', 'deuxième'], third: ['troisième', 'troisième'],
    fourth: ['quatrième', 'quatrième'], fifth: ['cinquième', 'cinquième'],
    sixth: ['sixième', 'sixième'], seventh: ['septième', 'septième'], eighth: ['huitième', 'huitième'],
    ninth: ['neuvième', 'neuvième'], tenth: ['dixième', 'dixième'],
    eleventh: ['onzième', 'onzième'], twelfth: ['douzième', 'douzième'],
};

// Génitifs latins → groupes FR prêts à l'emploi
const GEN = {
    pollicis: 'du pouce', hallucis: 'du gros orteil', digitorum: 'des doigts', digiti: 'du doigt',
    capitis: 'de la tête', oris: 'de la bouche', abdominis: "de l'abdomen", thoracis: 'du thorax',
    brachii: 'du bras', femoris: 'de la cuisse', dorsi: 'du dos', linguae: 'de la langue',
    cordis: 'du cœur', pulmonis: 'du poumon', hepatis: 'du foie', renis: 'du rein',
    oculi: "de l'œil", auris: "de l'oreille", manus: 'de la main', pedis: 'du pied',
    carpi: 'du poignet', colli: 'du cou', faciei: 'de la face', cranii: 'du crâne',
    lumborum: 'des lombes', brachii: 'du bras', vasorum: 'des vaisseaux',
    cervicis: 'du cou', scapulae: "de l'omoplate", ani: "de l'anus", indicis: "de l'index",
    dentis: 'de la dent', tarsi: 'du tarse', iridis: "de l'iris",
    penis: 'du pénis',
    coli: 'du côlon', mesocolica: 'du mésocôlon', omentalis: "de l'épiploon",
};

// Noms propres / expressions consacrées (insensibles à la casse)
const EXC = {
    'pectoralis major': 'Grand pectoral', 'pectoralis minor': 'Petit pectoral',
    'rectus abdominis': "Muscle droit de l'abdomen", 'latissimus dorsi': 'Grand dorsal',
    trapezius: 'Trapèze', sternocleidomastoid: 'Sterno-cléido-mastoïdien', masseter: 'Masséter',
    'biceps brachii': 'Biceps brachial', 'triceps brachii': 'Triceps brachial',
    'quadriceps femoris': 'Quadriceps', 'gluteus maximus': 'Grand fessier',
    'gluteus medius': 'Moyen fessier', 'gluteus minimus': 'Petit fessier',
    'dura mater': 'Dure-mère', 'arachnoid mater': 'Arachnoïde', 'pia mater': 'Pie-mère',
    'corpus callosum': 'Corps calleux', 'circle of willis': 'Polygone de Willis',
    'achilles tendon': "Tendon d'Achille", 'spinal cord': 'Moelle épinière',
    'common carotid artery': 'Artère carotide commune', 'internal carotid artery': 'Artère carotide interne',
    'external carotid artery': 'Artère carotide externe', 'subclavian artery': 'Artère sous-clavière',
    'axillary artery': 'Artère axillaire', 'brachial artery': 'Artère brachiale',
    'femoral artery': 'Artère fémorale', 'popliteal artery': 'Artère poplitée',
    'superior vena cava': 'Veine cave supérieure', 'inferior vena cava': 'Veine cave inférieure',
    'pulmonary trunk': 'Tronc pulmonaire', 'sinoatrial node': 'Nœud sinusal',
    'bundle of his': 'Faisceau de His', 'foramen ovale': 'Foramen ovale',
    'phrenic nerve': 'Nerf phrénique', 'vagus nerve': 'Nerf vague', 'sciatic nerve': 'Nerf sciatique',
    'median nerve': 'Nerf médian', 'ulnar nerve': 'Nerf ulnaire', 'radial nerve': 'Nerf radial',
    'trigeminal nerve': 'Nerf trijumeau', 'facial nerve': 'Nerf facial', 'optic nerve': 'Nerf optique',
    'thyroid cartilage': 'Cartilage thyroïde', 'cricoid cartilage': 'Cartilage cricoïde',
    'index finger': 'Index', stylohyoid: 'Stylo-hyoïdien', atlas: 'Atlas (vertèbre C1)',
    axis: 'Axis (vertèbre C2)', 'linea alba': 'Ligne blanche',
    sternohyoid: 'Sterno-hyoïdien', omohyoid: 'Omo-hyoïdien',
    sternothyroid: 'Sterno-thyroïdien', thyrohyoid: 'Thyro-hyoïdien', eyeball: 'Globe oculaire',
    'azygos vein': 'Veine azygos', 'hemiazygos vein': 'Veine hémi-azygos',
    'accessory hemiazygos vein': 'Veine hémi-azygos accessoire',
    'xiphoid process': 'Processus xiphoïde',
    // Lots A1-A4
    'brachiocephalic trunk': 'Tronc brachio-céphalique', 'celiac trunk': 'Tronc cœliaque',
    'aortic arch': "Crosse de l'aorte", 'thoraco-acromial artery': 'Artère thoraco-acromiale',
    'median cubital vein': 'Veine médiane cubitale', 'great saphenous vein': 'Grande veine saphène',
    'superior ulnar collateral artery': 'Artère collatérale ulnaire supérieure',
    'vasa vasorum': 'Vasa vasorum', 'lamina terminalis': 'Lame terminale',
    'lacrimal sac': 'Sac lacrymal', 'calcaneal tendon': "Tendon calcanéen (tendon d'Achille)",
    'hyoid bone': 'Os hyoïde', 'teres major': 'Grand rond', 'teres minor': 'Petit rond',
    'tensor fasciae latae': 'Tenseur du fascia lata',
    'eustachian tube': "Trompe auditive (d'Eustache)", 'vocal cord': 'Corde vocale',
    'vocal ligament': 'Ligament vocal', 'greater omentum': 'Grand épiploon',
    'lesser omentum': 'Petit épiploon', mylohyoid: 'Mylo-hyoïdien', geniohyoid: 'Génio-hyoïdien',
    vocalis: 'Muscle vocal',     'large intestine': 'Gros intestin', 'small intestine': 'Intestin grêle',
    'hip bone': 'Os coxal',
};

// Chiffres romains (segments hépatiques II-VIII...) : pass-through en capitales
const ROMAN = new Set(['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x']);

function singular(tok) {
    if (NOUN[tok] || ADJ[tok] || ORD[tok] || GEN[tok]) return { tok, plural: false };
    if (tok.endsWith('ies') && tok.length > 4) {
        const s = tok.slice(0, -3) + 'y';
        if (NOUN[s] || ADJ[s]) return { tok: s, plural: true };
    }
    if (tok.endsWith('s') && !tok.endsWith('ss') && tok.length > 3) {
        const s = tok.slice(0, -1);
        if (NOUN[s] || ADJ[s] || ORD[s]) return { tok: s, plural: true };
    }
    return { tok, plural: false };
}

function pluralizeFr(fr, plural, gender) {
    if (!plural) return fr;
    if (/[sxz]$/i.test(fr)) return fr;
    if (fr.endsWith('al')) return fr.slice(0, -2) + 'aux';
    if (fr.endsWith('eau')) return fr + 'x';
    return fr + 's';
}

function agreeAdj(en, gender, plural) {
    const a = ADJ[en];
    if (!a) return null;
    return pluralizeFr(gender === 'f' ? a[1] : a[0], plural, gender);
}

// Traduit un segment sans "of". Retourne {t, g} ou null.
function translateSegment(raw) {
    const toks = raw.toLowerCase().split(/[\s-]+/).filter((t) => t && t !== 'the');
    if (!toks.length) return null;
    let side = '';
    const norm = [];
    for (const t of toks) {
        if (t === 'left') { side = side === '(D)' ? '' : '(G)'; continue; }
        if (t === 'right') { side = side === '(G)' ? '' : '(D)'; continue; }
        norm.push(singular(t));
    }
    const genChunks = [];
    const rest = [];
    for (const n of norm) {
        if (GEN[n.tok]) genChunks.push(GEN[n.tok]);
        else rest.push(n);
    }
    // tête nominale = dernier nom connu
    let headIdx = -1;
    for (let i = rest.length - 1; i >= 0; i--) {
        if (NOUN[rest[i].tok]) { headIdx = i; break; }
    }
    if (headIdx < 0) return null;
    const head = rest[headIdx];
    const [frNoun, gender] = NOUN[head.tok];
    const before = rest.slice(0, headIdx);
    const after = rest.slice(headIdx + 1);
    const out = [];
    const preAdjs = [];
    const pushMod = (n, dest) => {
        if (ORD[n.tok]) { out.push(pluralizeFr(gender === 'f' ? ORD[n.tok][1] : ORD[n.tok][0], n.plural, gender)); return true; }
        if (ROMAN.has(n.tok)) { dest.push(n.tok.toUpperCase()); return true; }
        if (ADJ[n.tok]) { const a = agreeAdj(n.tok, gender, n.plural); if (a === null) return false; dest.push(a); return true; }
        if (NOUN_AS_ADJ[n.tok]) {
            const forms = NOUN_AS_ADJ[n.tok];
            dest.push(pluralizeFr(gender === 'f' ? forms[1] : forms[0], n.plural, gender));
            return true;
        }
        return false;
    };
    // En français les adjectifs épithètes se postposent : "coronary artery" → "artère coronaire".
    // Seuls les ordinaux restent antéposés ("première branche"), ainsi que major/minor
    // devant certains muscles consacrés ("pectoralis major" → "grand pectoral").
    const PRE_MUSCLE = new Set(['pectoralis', 'gluteus']);
    const PREPOSE = new Set(['major', 'minor', 'maximus', 'minimus']);
    const preposed = [];
    const afterRest = [];
    for (const a of after) {
        if (PREPOSE.has(a.tok) && PRE_MUSCLE.has(head.tok) && ADJ[a.tok]) {
            const f = ADJ[a.tok];
            preposed.push(pluralizeFr(gender === 'f' ? f[1] : f[0], a.plural, gender));
        } else afterRest.push(a);
    }
    for (const b of before) { if (!pushMod(b, preAdjs)) return null; }
    out.push(...preposed);
    out.push(pluralizeFr(frNoun, head.plural, gender));
    out.push(...preAdjs);
    for (const a of afterRest) { if (!pushMod(a, out)) return null; }
    let text = out.join(' ');
    if (genChunks.length) text += ' ' + genChunks.join(' ');
    if (side) text += ' ' + side;
    return { t: text, g: gender, head0: out[0] || '' };
}

function connectorFor(next) {
    if (/^[aeiouyhéèêœ]/i.test(next.head0)) return { sep: "de l'", tail: true };
    return { sep: next.g === 'f' ? 'de la ' : 'du ', tail: false };
}

/** Traduit un nom anatomique EN. Retourne le libellé FR ou null (afficher l'EN original). */
export function translateAnatomy(en) {
    if (!en) return null;
    // Les qualificatifs entre parenthèses ("(in-vivo)") ne se traduisent pas
    const raw = String(en).trim().replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const lower = raw.toLowerCase();
    if (EXC[lower]) return EXC[lower];
    // noms propres avec côté ("right pectoralis minor") → EXC sans le côté + suffixe
    const noSide = lower.split(/[\s-]+/).filter((t) => t !== 'left' && t !== 'right').join(' ');
    if (noSide !== lower && EXC[noSide]) {
        const side = /\bright\b/.test(lower) ? ' (D)' : ' (G)';
        return EXC[noSide] + side;
    }
    const parts = lower.split(/\s+of\s+(?:the\s+)?/);
    const segs = parts.map(translateSegment);
    if (segs.some((s) => !s)) return null;
    let acc = segs[segs.length - 1];
    for (let i = segs.length - 2; i >= 0; i--) {
        const c = connectorFor(acc);
        acc = { t: segs[i].t + ' ' + c.sep + acc.t, g: segs[i].g, head0: segs[i].head0 };
    }
    const out = acc.t;
    return out.charAt(0).toUpperCase() + out.slice(1);
}
