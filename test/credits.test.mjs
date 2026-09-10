/**
 * test/credits.test.mjs — Suite de tests pour la page de credits et mentions MedGame
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Credits MedGame — Verification de conformite', () => {

    test('package.json declare la licence GPL-3.0', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
        assert.equal(pkg.license, 'GPL-3.0', 'La licence dans package.json doit etre GPL-3.0');
    });

    test('data/credits.js contient le createur avec medecine + Mines Paris et les contributeurs', async () => {
        const creditsModule = await import('../data/credits.js');
        const credits = creditsModule.CREDITS;

        assert.ok(credits, 'CREDITS doit etre defini');
        assert.equal(credits.appName, 'MedGame');
        assert.equal(credits.version, '1.0.0');

        // Createur (Louaï Hamlat, medecine + Mines Paris)
        assert.ok(credits.creator, 'credits.creator doit exister');
        assert.equal(credits.creator.name, 'Louaï Hamlat');
        assert.ok(credits.creator.role.toLowerCase().includes('lead developer') || credits.creator.role.toLowerCase().includes('fondateur'));
        assert.ok(credits.creator.curriculum.toLowerCase().includes('médecine') || credits.creator.curriculum.toLowerCase().includes('medecine'));
        assert.ok(credits.creator.curriculum.toLowerCase().includes('mines paris'));

        // Contributeurs obligatoires
        const contribNames = credits.contributors.map(c => c.name);
        assert.ok(contribNames.includes('La Team'), 'La Team doit figurer dans les contributeurs');
        assert.ok(contribNames.includes('Alexandra Sedes'), 'Alexandra Sedes doit figurer dans les contributeurs');
        assert.ok(contribNames.includes('Juliette Constant'), 'Juliette Constant doit figurer dans les contributeurs');

        // Technologies
        const techList = credits.technologies.map(t => t.toLowerCase());
        assert.ok(techList.some(t => t.includes('three.js')), 'Three.js doit etre mentionne');
        assert.ok(techList.some(t => t.includes('web audio')), 'Web Audio API doit etre mentionnee');
        assert.ok(techList.some(t => t.includes('supabase')), 'Supabase doit etre mentionne');

        // Contact et licence GPL
        assert.ok(credits.contact, 'credits.contact doit exister');
        assert.equal(credits.contact.email, 'hamlat.louai@gmail.com');
        assert.ok(credits.legal.notice.includes('GPL-3.0'));
        assert.ok(credits.legal.notice.includes('hamlat.louai@gmail.com'));
    });

    test('credits.html existe et integre la structure requise', () => {
        const html = fs.readFileSync(path.join(rootDir, 'credits.html'), 'utf8');

        assert.ok(html.includes('credits-roll-overlay'), 'L overlay de generique defilant doit exister');
        assert.ok(html.includes('btn-launch-roll'), 'Le bouton de lancement du generique doit exister');
        assert.ok(html.includes('creator-container'), 'Le conteneur du createur doit exister');
        assert.ok(html.includes('contributors-container'), 'Le conteneur des contributeurs doit exister');
        assert.ok(html.includes('legal-notice'), 'La mention legale doit exister');
        assert.ok(html.includes('data/credits.js'), 'Le script data/credits.js doit etre charge');
        assert.ok(html.includes('js/credits.js'), 'Le script js/credits.js doit etre charge');
        assert.ok(html.includes('css/credits.css'), 'La feuille css/credits.css doit etre chargee');
    });

    test('credits.css prend en charge prefers-reduced-motion et la typographie discrete', () => {
        const css = fs.readFileSync(path.join(rootDir, 'css/credits.css'), 'utf8');

        assert.ok(css.includes('prefers-reduced-motion'), 'prefers-reduced-motion doit etre gere');
        assert.ok(css.includes('rollAnimation') || css.includes('credits-roll-overlay'), 'Les animations de generique doivent exister');
        assert.ok(css.includes('legal-tiny-italic'), 'Le style discret italique pour la licence doit exister');
    });

    test('index.html integre le lien discret vers les credits', () => {
        const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

        assert.ok(indexHtml.includes("transitionTo('credits.html')"), 'Le lien doit appeler transitionTo(credits.html)');
        assert.ok(indexHtml.includes('credits.html'), 'Le lien direct vers credits.html doit figurer dans index.html');
        assert.ok(indexHtml.includes('medgame-footer-link'), 'La classe medgame-footer-link doit etre presente');
    });

    test('Aucun lien GitHub dans credits.html, data/credits.js, js/credits.js, js/footer.js', () => {
        const filesToCheck = [
            'credits.html',
            'data/credits.js',
            'js/credits.js',
            'js/footer.js',
            'css/credits.css',
            'css/footer.css'
        ];

        for (const file of filesToCheck) {
            const content = fs.readFileSync(path.join(rootDir, file), 'utf8');
            const hasGithub = /github\.com/i.test(content);
            assert.equal(hasGithub, false, `Le fichier ${file} ne doit contenir aucun lien GitHub`);
        }
    });

    test('Aucun emoji dans les fichiers des credits (code, commentaires et texte)', () => {
        const filesToCheck = [
            'credits.html',
            'data/credits.js',
            'js/credits.js',
            'js/footer.js',
            'css/credits.css',
            'css/footer.css'
        ];

        const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

        for (const file of filesToCheck) {
            const content = fs.readFileSync(path.join(rootDir, file), 'utf8');
            const match = content.match(emojiRegex);
            assert.equal(match, null, `Le fichier ${file} ne doit contenir aucun emoji (trouve: ${match ? match[0] : ''})`);
        }
    });

});
