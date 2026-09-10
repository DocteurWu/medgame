import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

test('Atlas Système Nerveux — Intégrité des fichiers statiques déployés', async (t) => {
  await t.test('neuro-atlas/index.html existe et référence ses assets en chemins relatifs', () => {
    const indexPath = path.join(ROOT, 'neuro-atlas', 'index.html');
    assert.ok(fs.existsSync(indexPath), 'neuro-atlas/index.html doit exister');
    const html = fs.readFileSync(indexPath, 'utf8');
    assert.match(html, /src="\.\/assets\/index-.*\.js"/, 'Doit importer les scripts JS compilés de façon relative');
    assert.match(html, /href="\.\/assets\/index-.*\.css"/, 'Doit importer les styles CSS compilés de façon relative');
    assert.match(html, /<canvas id="gl"/, 'Doit contenir le canvas WebGL');
  });

  await t.test('neuro-atlas/data contient manifest.json, volumes et meshes', () => {
    const dataDir = path.join(ROOT, 'neuro-atlas', 'data');
    assert.ok(fs.existsSync(dataDir), 'neuro-atlas/data doit exister');

    const manifestPath = path.join(dataDir, 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest.json doit être présent');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.schema, 1, 'Schéma du manifeste = 1');
    assert.ok(Array.isArray(manifest.meshes) && manifest.meshes.length >= 500, 'Doit contenir au moins 500 maillages');

    const volumesDir = path.join(dataDir, 'volumes');
    assert.ok(fs.existsSync(volumesDir), 'Dossier volumes/ doit exister');
    assert.ok(fs.existsSync(path.join(volumesDir, 'labels.json')), 'labels.json doit exister');
  });

  await t.test('neuro-atlas/data contient le bundle français content.fr.json avec les pathologies EDN', () => {
    const frBundlePath = path.join(ROOT, 'neuro-atlas', 'data', 'content.fr.json');
    assert.ok(fs.existsSync(frBundlePath), 'content.fr.json doit exister');
    const bundleFr = JSON.parse(fs.readFileSync(frBundlePath, 'utf8'));

    assert.equal(bundleFr.lang, 'fr', 'La langue du bundle doit être fr');
    assert.ok(bundleFr.syndromes, 'Le bundle doit contenir des syndromes');
    assert.ok(bundleFr.structures, 'Le bundle doit contenir des structures');

    // Vérifier la présence du syndrome de Wallenberg traduit en français
    const wallenberg = bundleFr.syndromes['syn-wallenberg-lateral-medullary'];
    assert.ok(wallenberg, 'Le syndrome de Wallenberg doit être présent');
    assert.match(wallenberg.name, /Wallenberg/, 'Le nom français doit mentionner Wallenberg');
    assert.match(wallenberg.presentation, /vertige|nystagmus|ataxie/i, 'La présentation clinique doit être en français médical');

    // Vérifier un infarctus sylvien
    const mca = bundleFr.syndromes['syn-mca-stem-infarct'];
    assert.ok(mca, 'L’infarctus sylvien total doit être présent');
    assert.match(mca.name, /sylvien|cérébrale moyenne/i, 'Le nom doit être traduit');

    // Vérifier la présence d’au moins une structure anatomique avec son libellé français
    const abducens = bundleFr.structures['abducens-nucleus'];
    assert.ok(abducens, 'Le noyau de l’abducens doit être présent');
    assert.match(abducens.name, /abducens/i, 'Le nom doit être présent');
  });

  await t.test('atlas.html contient le sélecteur de modules et le conteneur du viewer neuro', () => {
    const atlasHtmlPath = path.join(ROOT, 'atlas.html');
    const html = fs.readFileSync(atlasHtmlPath, 'utf8');

    assert.match(html, /id="btn-module-body"/, 'Doit contenir le bouton module corps entier');
    assert.match(html, /id="btn-module-heart"/, 'Doit contenir le bouton module cœur');
    assert.match(html, /id="btn-module-neuro"/, 'Doit contenir le bouton module système nerveux');
    assert.match(html, /id="preset-neuro"/, 'Doit contenir le preset rapide neuro');
    assert.match(html, /id="neuro-atlas-container"/, 'Doit contenir le conteneur neuro-atlas-container');
    assert.match(html, /id="neuro-atlas-frame"/, 'Doit contenir l’iframe neuro-atlas-frame');
    assert.match(html, /id="btn-neuro-exit"/, 'Doit contenir le bouton de retour au corps entier');
    assert.match(html, /id="btn-neuro-nav-body"/, 'Doit contenir le bouton navigation corps entier dans le header neuro');
    assert.match(html, /id="btn-neuro-nav-heart"/, 'Doit contenir le bouton navigation cœur dans le header neuro');
  });

  await t.test('neuro-atlas/medgame-theme.css stylise le viewer aux couleurs de Medgame', () => {
    const themePath = path.join(ROOT, 'neuro-atlas', 'medgame-theme.css');
    assert.ok(fs.existsSync(themePath), 'neuro-atlas/medgame-theme.css doit exister');
    const css = fs.readFileSync(themePath, 'utf8');
    assert.match(css, /--accent2:\s*#00f2fe/, 'Doit définir le cyan néon Medgame');
    assert.match(css, /--accent:\s*#d8b565/, 'Doit définir l’ambre or neuro');

    const indexPath = path.join(ROOT, 'neuro-atlas', 'index.html');
    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    assert.match(indexHtml, /medgame-theme\.css/, 'index.html doit importer medgame-theme.css');
  });

  await t.test('css/atlas.css contient les transitions plein écran et l’effacement de l’Atlas corps entier', () => {
    const atlasCssPath = path.join(ROOT, 'css', 'atlas.css');
    const css = fs.readFileSync(atlasCssPath, 'utf8');
    assert.match(css, /\.atlas-layout\.neuro-mode-active\s+\.atlas-side\.left/, 'Doit animer la disparition du panneau gauche');
    assert.match(css, /\.atlas-layout\.neuro-mode-active\s+\.atlas-side\.right/, 'Doit animer la disparition du panneau droit');
    assert.match(css, /\.neuro-atlas-container\s*\{[^}]*position:\s*fixed/, 'Le conteneur neuro doit être en position fixed plein écran');
  });

  await t.test('js/atlas.js prend en charge les fonctions de module et le deep-link neuro', () => {
    const jsPath = path.join(ROOT, 'js', 'atlas.js');
    const js = fs.readFileSync(jsPath, 'utf8');

    assert.match(js, /function openNeuroMode/, 'Doit définir openNeuroMode');
    assert.match(js, /function closeNeuroMode/, 'Doit définir closeNeuroMode');
    assert.match(js, /neuro-mode-active/, 'Doit basculer la classe neuro-mode-active sur atlas-layout');
    assert.match(js, /openHeartMode/, 'Doit conserver openHeartMode');
    assert.match(js, /closeHeartMode/, 'Doit conserver closeHeartMode');
    assert.match(js, /params\.get\(['"]module['"]\)/, 'Doit analyser le paramètre URL module');
  });

  await t.test('neuro-atlas UX : bouton Masquer interne, pavé de navigation translucide et arbre pliable', () => {
    const themePath = path.join(ROOT, 'neuro-atlas', 'medgame-theme.css');
    const themeCss = fs.readFileSync(themePath, 'utf8');

    // Pavé directionnel discret et translucide
    assert.match(themeCss, /\.neuro-nav-pad\s*\{[^}]*opacity:\s*0\.32/, 'Le pavé de navigation doit être translucide par défaut pour ne pas gâcher la vue 3D');
    assert.match(themeCss, /\.neuro-nav-pad:hover\s*\{[^}]*opacity:\s*0\.95/, 'Le pavé doit devenir net au survol');

    // Bouton de masquage interne au panneau droit
    assert.match(themeCss, /\.right-panel-head/, 'En-tête de fiche présent dans le panneau droit');
    assert.match(themeCss, /\.panel-close-btn/, 'Bouton de fermeture présent dans le panneau');
    assert.match(themeCss, /#app\.no-right\s+\.edge-reopen-tab\s*\{[^}]*display:\s*flex/, 'L’onglet de réouverture ne s’affiche que quand le panneau est masqué');

    // Bundle JS vérification
    const indexPath = path.join(ROOT, 'neuro-atlas', 'index.html');
    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    const scriptMatch = indexHtml.match(/src="\.\/assets\/(index-.*\.js)"/);
    assert.ok(scriptMatch, 'Fichier script index-*.js trouvé dans neuro-atlas/index.html');

    const bundlePath = path.join(ROOT, 'neuro-atlas', 'assets', scriptMatch[1]);
    assert.ok(fs.existsSync(bundlePath), 'Le bundle JS référencé doit exister');
    const bundleJs = fs.readFileSync(bundlePath, 'utf8');

    assert.ok(bundleJs.includes('btn-close-right'), 'Le bouton interne de masquage du panneau droit doit être compilé dans le bundle');
    assert.ok(bundleJs.includes('Masquer ✕'), 'Le libellé Masquer ✕ doit être présent dans le bundle');
    assert.ok(bundleJs.includes('neuro-nav-pad'), 'Le pavé de navigation doit être présent dans le bundle');
    assert.ok(bundleJs.includes('Tout plier'), 'Le bouton Tout plier doit être présent dans le bundle');
    assert.ok(!bundleJs.includes('English (US)'), 'Les options de traduction anglaise/espagnole doivent être retirées du viewer');
  });
});
