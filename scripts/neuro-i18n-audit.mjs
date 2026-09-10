/**
 * neuro-i18n-audit.mjs — Audit lecture seule de la couverture FR du module neuro.
 * Usage : node scripts/neuro-i18n-audit.mjs
 * Mesure par champ : names FR vs EN, summaries EN restants, imaging, glossaire, etc.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EN_PATH = path.join(ROOT, 'neuro-atlas', 'data', 'content.json');
const FR_PATH = path.join(ROOT, 'neuro-atlas', 'data', 'content.fr.json');
const DICT_DIR = path.join(ROOT, 'neuro-atlas', 'data', 'i18n', 'fr');

const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
const fr = JSON.parse(fs.readFileSync(FR_PATH, 'utf8'));

// Heuristique : texte EN = contient des mots anglais courants ET aucun accent français
const EN_WORDS = /\b(the|and|with|from|that|which|through|between|parenchyma|nucleus|artery|nerve|tract|lesion|infarct)\b/i;
const HAS_ACCENT = /[éèêàâùûôîçœæ]/i;
const isEnLike = (s) => typeof s === 'string' && s.length > 20 && EN_WORDS.test(s) && !HAS_ACCENT.test(s);
const isBadName = (n) => typeof n === 'string' && (/\bartère$/i.test(n.trim()) || /^(antérieur|postérieur|ophthalmic|labyrinthine|anterior|posterior)\s+\w+\s+(artère|faisceau)/i.test(n.trim()));

function statEntries(entries, fields) {
  const out = {};
  for (const f of fields) out[f] = { total: 0, en: 0, examples: [] };
  for (const e of Object.values(entries)) {
    for (const f of fields) {
      const v = f.split('.').reduce((a, k) => (a && a[k] !== undefined ? a[k] : undefined), e);
      const texts = Array.isArray(v) ? v.flatMap((x) => (typeof x === 'string' ? [x] : x && x.note ? [x.note] : x && x.label ? [x.label] : x && x.finding ? [x.finding] : x && x.sign ? [x.sign] : [])) : (typeof v === 'string' ? [v] : []);
      for (const t of texts) {
        out[f].total++;
        if (isEnLike(t)) { out[f].en++; if (out[f].examples.length < 5) out[f].examples.push(`${e.id} :: ${t.slice(0, 110)}…`); }
      }
    }
  }
  return out;
}

console.log('=== AUDIT FR neuro-atlas ===');
for (const coll of ['structures', 'pathways', 'syndromes', 'glossary', 'topics', 'quiz']) {
  const enN = Object.keys(en[coll] || {}).length;
  const frN = Object.keys(fr[coll] || {}).length;
  console.log(`- ${coll}: EN=${enN} FR=${frN}`);
}
const sStat = statEntries(fr.structures || {}, ['summary', 'anatomy.location', 'function']);
const pStat = statEntries(fr.pathways || {}, ['summary', 'modality']);
const gStat = statEntries(fr.glossary || {}, []);
console.log('\n-- structures --');
for (const [f, s] of Object.entries(sStat)) console.log(`  ${f}: total=${s.total} EN-restant=${s.en}`);
for (const e of sStat.summary?.examples || []) console.log(`    ex: ${e}`);
let bad = 0; const badEx = [];
for (const [id, v] of Object.entries(fr.structures || {})) {
  if (isBadName(v.name)) { bad++; if (badEx.length < 15) badEx.push(`${id} => "${v.name}"`); }
}
console.log(`  noms mot-à-mot cassés (pattern "X artère"): ${bad}`);
badEx.forEach((x) => console.log(`    NOM: ${x}`));
console.log('\n-- pathways --');
for (const [f, s] of Object.entries(pStat)) console.log(`  ${f}: total=${s.total} EN-restant=${s.en}`);
// glossaire : champ definition / html.definition
let gTot = 0, gEn = 0; const gEx = [];
for (const [id, v] of Object.entries(fr.glossary || {})) {
  const t = v.definition || v.html?.definition || '';
  if (t) { gTot++; if (isEnLike(t)) { gEn++; if (gEx.length < 5) gEx.push(`${id} :: ${String(t).slice(0, 110)}…`); } }
}
console.log(`\n-- glossary.definition: total=${gTot} EN-restant=${gEn}`);
gEx.forEach((x) => console.log(`    ex: ${x}`));
// dicts présents ?
if (fs.existsSync(DICT_DIR)) {
  console.log('\n-- dicts i18n/fr --');
  for (const f of fs.readdirSync(DICT_DIR)) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(DICT_DIR, f), 'utf8'));
      const n = Array.isArray(j) ? j.length : Object.keys(j.entries || j).length;
      console.log(`  ${f}: ${n} entrées`);
    } catch { console.log(`  ${f}: ILLISIBLE`); }
  }
} else console.log('\n-- dicts: dossier absent --');
console.log('\nOK audit terminé.');
