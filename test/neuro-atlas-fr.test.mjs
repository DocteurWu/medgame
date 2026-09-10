import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'neuro-atlas', 'data');
const DICT = path.join(DATA, 'i18n', 'fr');

const EN_WORDS = /\b(the|and|with|from|that|which|through|between)\b/i;
const HAS_ACCENT = /[éèêàâùûôîçœæ]/i;
const isEnLike = (s) => typeof s === 'string' && s.length > 20 && EN_WORDS.test(s) && !HAS_ACCENT.test(s);
const isBadName = (n) => typeof n === 'string' && (/\bartère$/i.test(n.trim()) || /^(antérieur|postérieur|ophthalmic|labyrinthine)\s+\w+\s+(artère|faisceau)/i.test(n.trim()));

const fr = JSON.parse(fs.readFileSync(path.join(DATA, 'content.fr.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(DATA, 'content.json'), 'utf8'));

test('Dictionnaire FR neuro — noms structures 391/391 sans mot-à-mot cassé', () => {
  const d = JSON.parse(fs.readFileSync(path.join(DICT, 'dict.structures.json'), 'utf8'));
  assert.equal(Object.keys(d.entries).length, 391, 'dict.structures = 391');
  assert.deepEqual(new Set(Object.keys(d.entries)), new Set(Object.keys(en.structures)), 'mêmes ids que EN');
  const bad = Object.entries(fr.structures).filter(([, v]) => isBadName(v.name));
  assert.equal(bad.length, 0, `noms cassés restants: ${bad.slice(0, 5).map(([k, v]) => `${k}=>${v.name}`).join(' | ')}`);
  assert.equal(fr.structures['anterior-spinal-artery'].name, 'Artère spinale antérieure');
  assert.equal(fr.structures['circle-of-willis'].name, 'Polygone de Willis');
  assert.equal(fr.structures['cn-10-vagus'].name, 'Nerf vague (CN X)');
  assert.equal(fr.structures['caudate-nucleus'].name, 'Noyau caudé');
});

test('Dictionnaire FR neuro — pathways, glossaire, syndromes traduits', () => {
  const pw = JSON.parse(fs.readFileSync(path.join(DICT, 'dict.pathways.json'), 'utf8'));
  assert.equal(Object.keys(pw.entries).length, 25);
  for (const [id, v] of Object.entries(fr.pathways)) {
    assert.ok(!isEnLike(v.summary), `pathway EN restant: ${id}`);
  }
  const g = JSON.parse(fs.readFileSync(path.join(DICT, 'dict.glossary.json'), 'utf8'));
  assert.equal(Object.keys(g.entries).length, 205);
  let gEn = 0;
  for (const v of Object.values(fr.glossary)) if (isEnLike(v.definition || v.html?.definition || '')) gEn++;
  assert.equal(gEn, 0, 'glossaire 100% FR');
  const sy = JSON.parse(fs.readFileSync(path.join(DICT, 'dict.syndromes.json'), 'utf8'));
  assert.equal(Object.keys(sy.entries).length, 125);
  assert.match(fr.syndromes['syn-wallenberg-lateral-medullary'].presentation, /vertige|nystagmus|ataxie/i);
  let syEn = 0;
  for (const v of Object.values(fr.syndromes)) if (isEnLike(v.presentation || '')) syEn++;
  assert.ok(syEn <= 5, `syndromes EN restants: ${syEn} (tolérance 5)`);
});

test('Dictionnaire FR neuro — search-index et LUT FR', () => {
  const idx = JSON.parse(fs.readFileSync(path.join(DATA, 'search-index.json'), 'utf8'));
  assert.ok(idx.length >= 500, 'index >= 500 entrées');
  const mca = idx.find((x) => x.id === 'artery-mca');
  assert.match(mca.name, /cérébrale moyenne/);
  assert.ok(idx.filter((x) => JSON.stringify(x).toLowerCase().includes('sylvien')).length >= 5, 'recherche sylvien');
  const lut = JSON.parse(fs.readFileSync(path.join(DATA, 'volumes', 'labels.fr.json'), 'utf8'));
  assert.equal(lut.lang, 'fr');
  assert.equal(lut.structures['artery-mca'], 'Artère cérébrale moyenne (ACM)');
  const sys = JSON.parse(fs.readFileSync(path.join(DICT, 'systems.fr.json'), 'utf8'));
  const names = Object.fromEntries(sys.systems.map((s) => [s.id, s.name]));
  assert.equal(names['brainstem'], 'Tronc cérébral');
  assert.equal(names['cranial-nerves'], 'Nerfs crâniens');
});

test('Dictionnaire FR neuro — topics/quiz couverts, traçabilité dicts', () => {
  const tq = JSON.parse(fs.readFileSync(path.join(DICT, 'dict.topics-quiz.json'), 'utf8'));
  assert.equal(Object.keys(tq.entries).length, 79, '19 topics + 60 quiz');
  for (const f of ['dict.anatomy.json', 'dict.imaging.json', 'dict.ui.json']) {
    assert.ok(fs.existsSync(path.join(DICT, f)), `${f} présent`);
    JSON.parse(fs.readFileSync(path.join(DICT, f), 'utf8')); // valide
  }
});

test('Neuro-atlas — traduction auto FR navigateur (fiches longues EN)', () => {
  const jsPath = path.join(ROOT, 'neuro-atlas', 'auto-translate-fr.js');
  assert.ok(fs.existsSync(jsPath), 'auto-translate-fr.js doit exister');
  const js = fs.readFileSync(jsPath, 'utf8');
  assert.match(js, /translate\.googleapis\.com/, 'utilise un endpoint gratuit sans clé');
  assert.match(js, /client=gtx&sl=en&tl=fr/, 'demande EN → FR');
  assert.match(js, /localStorage/, 'met en cache (instantané aux visites suivantes)');
  assert.match(js, /MutationObserver/, 'traduit les fiches au fil du rendu');
  assert.match(js, /syndrome-bar/, 'couvre aussi la barre syndromique');
  assert.match(js, /data-no-auto-fr/, 'respecte une exclusion opt-out');
  assert.match(js, /offline/, 'dégrade gracieusement hors ligne (texte EN conservé)');
  const html = fs.readFileSync(path.join(ROOT, 'neuro-atlas', 'index.html'), 'utf8');
  assert.match(html, /auto-translate-fr\.js/, 'index.html charge le module');
});
