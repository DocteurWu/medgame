/**
 * build-fr-names.mjs — Rapport de couverture du moteur atlas-i18n (lecture seule).
 * Usage : node scripts/build-fr-names.mjs [--base <ATLAS_BASE_URL>]
 * Affiche : % de concepts traduisibles, top tokens manquants, exemples intraduits.
 */
import { translateAnatomy } from '../js/atlas-i18n.js';

const args = process.argv.slice(2);
const bi = args.indexOf('--base');
const base = (bi >= 0 ? args[bi + 1] : 'https://cdn.jsdelivr.net/gh/ashemag/human-atlas@main/public/models').replace(/\/$/, '');

const atlas = await (await fetch(`${base}/atlas.json`)).json();
let ok = 0;
const miss = {};
const samples = [];
for (const c of atlas.concepts) {
    if (translateAnatomy(c.name)) ok++;
    else {
        c.name.toLowerCase().split(/[^a-z]+/).forEach((w) => {
            if (w.length > 2 && !['the', 'and', 'for'].includes(w)) miss[w] = (miss[w] || 0) + 1;
        });
        if (samples.length < 25) samples.push(c.name);
    }
}
console.log(`[i18n] concepts=${atlas.concepts.length} traduits=${ok} (${(100 * ok / atlas.concepts.length).toFixed(1)} %)`);
console.log('[i18n] TOP-MISS ' + Object.entries(miss).sort((x, y) => y[1] - x[1]).slice(0, 60).map((e) => e.join(':')).join(' '));
console.log('[i18n] EXEMPLES INTRADUITS :');
samples.forEach((s) => console.log('  - ' + s + '  =>  ' + translateAnatomy(s)));
