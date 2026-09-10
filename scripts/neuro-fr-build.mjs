/**
 * neuro-fr-build.mjs — Assemble les dictionnaires FR curés en content.fr.json v2.
 * Usage : node scripts/neuro-fr-build.mjs [--check-only]
 * Data-only : ne touche jamais au bundle Vite ni aux .bin/.glb.
 * Entrées : neuro-atlas/data/i18n/fr/dict.*.json  (format {entries:{id:{...champs FR}}})
 * Sorties : content.fr.json (régénéré depuis content.json EN + dicts),
 *           search-index.json (aliases FR+latin+sigles), volumes/labels.fr.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'neuro-atlas', 'data');
const DICT_DIR = path.join(DATA, 'i18n', 'fr');
const checkOnly = process.argv.includes('--check-only');

function loadDict(name) {
  const p = path.join(DICT_DIR, name);
  if (!fs.existsSync(p)) return {};
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const base = j.entries || j || {};
  // clés sœurs (ex. dict.ui.json : systems/toolbar/laterality à côté de entries)
  for (const [k, v] of Object.entries(j)) {
    if (k !== 'entries' && base[k] === undefined) base[k] = v;
  }
  return base;
}

const dicts = {
  structures: loadDict('dict.structures.json'),
  pathways: loadDict('dict.pathways.json'),
  syndromes: loadDict('dict.syndromes.json'),
  glossary: loadDict('dict.glossary.json'),
  topicsQuiz: loadDict('dict.topics-quiz.json'),
  anatomy: loadDict('dict.anatomy.json'),
  imaging: loadDict('dict.imaging.json'),
  ui: loadDict('dict.ui.json'),
};

// Applique récursivement les champs FR d'une entrée dict sur un clone de l'entrée EN
function applyFr(enEntry, frEntry) {
  if (!frEntry) return enEntry;
  const out = Array.isArray(enEntry) ? [...enEntry] : { ...enEntry };
  for (const [k, v] of Object.entries(frEntry)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

const en = JSON.parse(fs.readFileSync(path.join(DATA, 'content.json'), 'utf8'));
let prev = {};
try { prev = JSON.parse(fs.readFileSync(path.join(DATA, 'content.fr.json'), 'utf8')); } catch { prev = {}; }

const out = { generated: new Date().toISOString(), lang: 'fr', structures: {}, pathways: {}, syndromes: {}, glossary: {}, quiz: {}, topics: {} };

// 1. structures : EN + dict.structures (name/synonyms/latin/names.fr) + dict.anatomy (summary, anatomy, function, connections notes) + dict.imaging
for (const [id, e] of Object.entries(en.structures || {})) {
  let cur = { ...e };
  // conserve l'existant FR déjà bon (ex. syndromes EDN) sauf noms mot-à-mot cassés
  const old = (prev.structures || {})[id];
  cur = applyFr(cur, dicts.structures[id]);
  cur = applyFr(cur, dicts.anatomy[id]);
  cur = applyFr(cur, dicts.imaging[id]);
  if (dicts.structures[id]?.synonyms) cur.synonyms = dicts.structures[id].synonyms;
  if (dicts.structures[id]?.name) cur.name = dicts.structures[id].name;
  // names.fr pour la recherche
  cur.names = { ...(e.names || {}), ...(old?.names || {}) };
  if (dicts.structures[id]?.name) cur.names.fr = dicts.structures[id].name;
  if (old?.names?.fr && !dicts.structures[id]?.name) cur.names.fr = old.names.fr;
  out.structures[id] = cur;
}
// 2. pathways / syndromes / glossary / topics / quiz
for (const [id, e] of Object.entries(en.pathways || {})) out.pathways[id] = applyFr({ ...e }, dicts.pathways[id]);
for (const [id, e] of Object.entries(en.syndromes || {})) {
  let cur = applyFr({ ...e }, dicts.syndromes[id]);
  const old = (prev.syndromes || {})[id];
  // ne jamais écraser une fiche FR déjà validée (Wallenberg/MCA) par de l'EN
  if (old && /vertige|nystagmus|ataxie|sylvien/i.test(old.presentation || '') && !dicts.syndromes[id]) cur = { ...cur, ...Object.fromEntries(Object.entries(old).filter(([, v]) => typeof v === 'string' && /[éèêàâùûôîç]/i.test(v))) };
  out.syndromes[id] = cur;
}
for (const [id, e] of Object.entries(en.glossary || {})) out.glossary[id] = applyFr({ ...e }, dicts.glossary[id]);
for (const [id, e] of Object.entries(en.topics || {})) out.topics[id] = applyFr({ ...e }, dicts.topicsQuiz[id]);
for (const [id, e] of Object.entries(en.quiz || {})) out.quiz[id] = applyFr({ ...e }, dicts.topicsQuiz[id]);
// conserve la bibliographie EN (pas de traduction demandée)
if (en.bibliography) out.bibliography = en.bibliography;

// 3. search-index.json : id/kind/name FR + aliases (FR + latin + synonymes + EN)
const index = [];
function pushIndex(id, kind, frEntry, enEntry) {
  const name = frEntry?.name || frEntry?.term || enEntry?.name || enEntry?.term || id;
  const aliases = new Set([enEntry?.name, enEntry?.latin, frEntry?.name, ...(frEntry?.synonyms || []), ...(enEntry?.synonyms || [])].filter(Boolean));
  index.push({ id, kind, name, latin: enEntry?.latin || frEntry?.latin, names: { ...(enEntry?.names || {}), fr: frEntry?.name || undefined }, aliases: [...aliases], summary: (frEntry?.summary || enEntry?.summary || '').slice(0, 400) });
}
for (const [id, e] of Object.entries(out.structures)) pushIndex(id, 'structure', e, en.structures[id]);
for (const [id, e] of Object.entries(out.syndromes)) pushIndex(id, 'syndrome', e, en.syndromes[id]);
for (const [id, e] of Object.entries(out.pathways)) pushIndex(id, 'pathway', e, en.pathways[id]);

// 4. volumes/labels.fr.json : LUT FR (structureId -> nom FR) pour tooltips IRM
const lutFr = {};
for (const [id, s] of Object.entries(out.structures)) lutFr[id] = s.name;
const systemsFr = dicts.ui.systems || {};
const manifest = JSON.parse(fs.readFileSync(path.join(DATA, 'manifest.json'), 'utf8'));
const manifestFrNote = { systems: (manifest.systems || []).map((s) => ({ id: s.id, name: systemsFr[s.id] || s.name, colour: s.colour, defaultVisible: s.defaultVisible })) };

if (checkOnly) {
  console.log(`[build] CHECK-ONLY structures=${Object.keys(out.structures).length} pathways=${Object.keys(out.pathways).length} syndromes=${Object.keys(out.syndromes).length} glossary=${Object.keys(out.glossary).length} index=${index.length}`);
  const missing = Object.keys(en.structures).filter((id) => !dicts.structures[id]);
  console.log(`[build] structures sans dict: ${missing.length} ex: ${missing.slice(0, 10).join(', ')}`);
  process.exit(0);
}

fs.writeFileSync(path.join(DATA, 'content.fr.json'), JSON.stringify(out, null, 1), 'utf8');
fs.writeFileSync(path.join(DATA, 'search-index.json'), JSON.stringify(index, null, 1), 'utf8');
fs.writeFileSync(path.join(DATA, 'volumes', 'labels.fr.json'), JSON.stringify({ generated: out.generated, lang: 'fr', structures: lutFr }, null, 1), 'utf8');
fs.writeFileSync(path.join(DICT_DIR, 'systems.fr.json'), JSON.stringify({ generated: out.generated, systems: manifestFrNote.systems }, null, 1), 'utf8');
console.log(`[build] OK content.fr.json (${Object.keys(out.structures).length} structures, ${Object.keys(out.syndromes).length} syndromes) + search-index (${index.length}) + labels.fr.json`);
