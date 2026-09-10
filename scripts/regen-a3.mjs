/** Regen A3 (nerfs/moelle/ventricules/méninges) perdu dans conflit de fusion. */
import fs from 'node:fs';
const EN = JSON.parse(fs.readFileSync('neuro-atlas/data/content.json', 'utf8'));
const P = 'neuro-atlas/data/i18n/fr/dict.structures.json';
const cur = JSON.parse(fs.readFileSync(P, 'utf8'));
cur.entries = cur.entries || {};

const CN = {
  'cn-01-olfactory': ['Nerf olfactif (CN I)', ['CN I', 'I', 'olfactory nerve'], 'Nervus olfactorius'],
  'cn-02-optic': ['Nerf optique (CN II)', ['CN II', 'II', 'optic nerve'], 'Nervus opticus'],
  'cn-03-oculomotor': ['Nerf oculomoteur (CN III)', ['CN III', 'III', 'oculomotor nerve'], 'Nervus oculomotorius'],
  'cn-04-trochlear': ['Nerf trochléaire (CN IV)', ['CN IV', 'IV', 'trochlear nerve', 'nerf pathétique'], 'Nervus trochlearis'],
  'cn-05-trigeminal': ['Nerf trijumeau (CN V)', ['CN V', 'V', 'trigeminal nerve'], 'Nervus trigeminus'],
  'cn-06-abducens': ['Nerf abducens (CN VI)', ['CN VI', 'VI', 'abducens nerve', 'nerf oculomoteur externe'], 'Nervus abducens'],
  'cn-07-facial': ['Nerf facial (CN VII)', ['CN VII', 'VII', 'facial nerve'], 'Nervus facialis'],
  'cn-08-vestibulocochlear': ['Nerf vestibulocochléaire (CN VIII)', ['CN VIII', 'VIII', 'vestibulocochlear nerve', 'nerf auditif'], 'Nervus vestibulocochlearis'],
  'cn-09-glossopharyngeal': ['Nerf glosso-pharyngien (CN IX)', ['CN IX', 'IX', 'glossopharyngeal nerve'], 'Nervus glossopharyngeus'],
  'cn-10-vagus': ['Nerf vague (CN X)', ['CN X', 'X', 'vagus nerve', 'nerf pneumogastrique'], 'Nervus vagus'],
  'cn-11-accessory': ['Nerf accessoire (CN XI)', ['CN XI', 'XI', 'accessory nerve', 'nerf spinal'], 'Nervus accessorius'],
  'cn-12-hypoglossal': ['Nerf hypoglosse (CN XII)', ['CN XII', 'XII', 'hypoglossal nerve', 'grand hypoglosse'], 'Nervus hypoglossus'],
};
const NERVE = {
  'nerve-sciatic': 'Nerf sciatique', 'nerve-median': 'Nerf médian', 'nerve-ulnar': 'Nerf ulnaire',
  'nerve-radial': 'Nerf radial', 'nerve-femoral': 'Nerf fémoral', 'nerve-tibial': 'Nerf tibial',
  'nerve-common-peroneal': 'Nerf fibulaire commun', 'nerve-sural': 'Nerf sural', 'nerve-phrenic': 'Nerf phrénique',
  'nerve-axillary': 'Nerf axillaire', 'nerve-musculocutaneous': 'Nerf musculo-cutané',
  'nerve-obturator': 'Nerf obturateur', 'nerve-pudendal': 'Nerf pudendal', 'nerve-suprascapular': 'Nerf supra-scapulaire',
  'nerve-long-thoracic': 'Nerf long thoracique', 'nerve-thoracodorsal': 'Nerf thoraco-dorsal',
  'nerve-superficial-radial': 'Nerf radial superficiel', 'nerve-superior-gluteal': 'Nerf glutéal supérieur',
  'nerve-genitofemoral': 'Nerf génito-fémoral', 'nerve-iliohypogastric': 'Nerf ilio-hypogastrique',
  'nerve-ilioinguinal': 'Nerf ilio-inguinal', 'nerve-lateral-femoral-cutaneous': 'Nerf cutané latéral de la cuisse',
  'nerve-lateral-antebrachial-cutaneous': 'Nerf cutané latéral de l\u2019avant-bras',
  'nerve-medial-antebrachial-cutaneous': 'Nerf cutané médial de l\u2019avant-bras',
  'nerve-medial-brachial-cutaneous': 'Nerf cutané médial du bras',
  'nerve-posterior-antebrachial-cutaneous': 'Nerf cutané postérieur de l\u2019avant-bras',
  'nerve-posterior-femoral-cutaneous': 'Nerf cutané postérieur de la cuisse',
  'nerve-dorsal-scapular': 'Nerf dorsal de la scapula', 'nerves-pectoral': 'Nerfs pectoraux',
  'nerves-dorsal-cutaneous-foot': 'Nerfs cutanés dorsaux du pied',
};
const OTHER = {
  'spinal-cord': ['Moelle épinière', ['spinal cord'], 'Medulla spinalis'],
  'cauda-equina': ['Queue de cheval', ['cauda equina'], 'Cauda equina'],
  'conus-medullaris': ['Cône médullaire', ['conus'], 'Conus medullaris'],
  'filum-terminale': ['Filum terminal', ['filum terminale'], 'Filum terminale'],
  'cervical-enlargement': ['Renflement cervical', ['cervical enlargement'], 'Intumescentia cervicalis'],
  'spinal-white-columns': ['Cordons blancs de la moelle', ['white columns', 'funiculi'], 'Funiculi medullae spinalis'],
  'spinal-grey-anterior-horn': ['Corne antérieure (motrice)', ['anterior horn'], 'Cornu anterius'],
  'spinal-grey-posterior-horn': ['Corne postérieure (sensitive)', ['posterior horn'], 'Cornu posterius'],
  'intermediolateral-column': ['Colonne intermédio-latérale', ['IML'], 'Columna intermediolateralis'],
  'dorsal-root-ganglion': ['Ganglion spinal (rachidien)', ['DRG', 'ganglion spinal'], 'Ganglion spinale'],
  'spinal-nerve-root-dermatome': ['Racine spinale et dermatome', ['dermatome'], 'Radix spinalis'],
  'roots-c5-t1': ['Racines C5–T1 (plexus brachial)', ['C5-T1'], ''],
  'roots-l2-s1': ['Racines L2–S1 (plexus lombo-sacré)', ['L2-S1'], ''],
  'segment-vertebral-levels': ['Correspondance segments / vertèbres', ['neurological level'], ''],
  'spinal-segment-cervical': ['Moelle cervicale (C1–C8)', ['cervical cord'], ''],
  'spinal-segment-thoracic': ['Moelle thoracique (T1–T12)', ['thoracic cord'], ''],
  'spinal-segment-lumbar': ['Moelle lombaire (L1–L5)', ['lumbar cord'], ''],
  'spinal-segment-sacral': ['Moelle sacrée et cône (S1–S5)', ['sacral cord'], ''],
  'plexus-brachial': ['Plexus brachial', ['brachial plexus'], 'Plexus brachialis'],
  'plexus-lumbosacral': ['Plexus lombo-sacré', ['lumbosacral plexus'], 'Plexus lumbosacralis'],
  'lumbosacral-trunk': ['Tronc lombo-sacré', ['lumbosacral trunk'], 'Truncus lumbosacralis'],
  'splanchnic-nerves': ['Nerfs splanchniques', ['splanchnic'], 'Nervi splanchnici'],
  'sympathetic-trunk': ['Tronc sympathique et ganglions', ['sympathetic chain'], 'Truncus sympathicus'],
  'cervical-sympathetic-chain': ['Chaîne sympathique cervicale', ['stellate ganglion'], ''],
  'ganglion-superior-cervical': ['Ganglion cervical supérieur', ['SCG'], 'Ganglion cervicale superius'],
  'autonomic-cranial-parasympathetic': ['Parasympathique crânien (III, VII, IX, X)', ['cranial parasympathetic'], ''],
  'autonomic-sacral-parasympathetic': ['Parasympathique sacré (S2–S4)', ['nervi erigentes'], ''],
  'ganglion-ciliary': ['Ganglion ciliaire', ['ciliary ganglion'], 'Ganglion ciliare'],
  'ganglion-pterygopalatine': ['Ganglion ptérygo-palatin', ['sphenopalatine ganglion'], 'Ganglion pterygopalatinum'],
  'ganglion-otic': ['Ganglion otique', ['otic ganglion'], 'Ganglion oticum'],
  'ganglion-submandibular': ['Ganglion sous-mandibulaire', ['submandibular ganglion'], 'Ganglion submandibulare'],
  'ganglion-trigeminal': ['Ganglion trigéminal (de Gasser)', ['Gasser', 'semilunar ganglion'], 'Ganglion trigeminale'],
  'ganglion-geniculate': ['Ganglion géniculé', ['geniculate ganglion'], 'Ganglion geniculi'],
  'motor-unit': ['Unité motrice', ['motor unit'], ''],
  'neuromuscular-junction': ['Jonction neuromusculaire', ['NMJ', 'plaque motrice'], 'Junctio neuromuscularis'],
  'ventricle-lateral': ['Ventricule latéral', ['lateral ventricle'], 'Ventriculus lateralis'],
  'ventricle-lateral-inferior-horn': ['Corne temporale du ventricule latéral', ['temporal horn'], 'Cornu temporale'],
  'ventricle-third': ['Troisième ventricule (V3)', ['V3', 'third ventricle'], 'Ventriculus tertius'],
  'ventricle-fourth': ['Quatrième ventricule (V4)', ['V4', 'fourth ventricle'], 'Ventriculus quartus'],
  'cerebral-aqueduct': ['Aqueduc du mésencéphale (de Sylvius)', ['aqueduct of Sylvius'], 'Aqueductus cerebri'],
  'choroid-plexus': ['Plexus choroïde', ['choroid plexus'], 'Plexus choroideus'],
  'dura-mater': ['Dure-mère', ['dura'], 'Dura mater'],
  'arachnoid-mater': ['Arachnoïde', ['arachnoid'], 'Arachnoidea mater'],
  'pia-mater': ['Pie-mère', ['pia'], 'Pia mater'],
  'arachnoid-granulations': ['Granulations arachnoïdiennes (de Pacchioni)', ['Pacchioni'], 'Granulationes arachnoideae'],
  'meningeal-spaces': ['Espaces méningés', ['epi/subdural'], ''],
  'subarachnoid-space-cisterns': ['Citernes sous-arachnoïdiennes', ['cisterns'], ''],
  'falx-cerebri': ['Faux du cerveau', ['falx'], 'Falx cerebri'],
  'tentorium-cerebelli': ['Tente du cervelet', ['tentorium'], 'Tentorium cerebelli'],
};
let added = 0;
for (const [id, e] of Object.entries(EN.structures)) {
  if (cur.entries[id]) continue;
  if (CN[id]) { const [name, syn, latin] = CN[id]; cur.entries[id] = { name, synonyms: [...new Set([e.name, ...syn])], latin: latin || e.latin || '' }; added++; continue; }
  if (NERVE[id]) { cur.entries[id] = { name: NERVE[id], synonyms: [...new Set([e.name, e.name.replace(/ nerve/i, '')])], latin: e.latin || '' }; added++; continue; }
  if (OTHER[id]) { const [name, syn, latin] = OTHER[id]; cur.entries[id] = { name, synonyms: [...new Set([e.name, ...syn])], latin: latin || e.latin || '' }; added++; continue; }
}
fs.writeFileSync(P, JSON.stringify(cur, null, 1), 'utf8');
console.log(`A3-regen: +${added} total=${Object.keys(cur.entries).length}`);
