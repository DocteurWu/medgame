/**
 * fetch-atlas.mjs — Vendorisation optionnelle des données Human Atlas pour offline/Docker.
 * Usage : node scripts/fetch-atlas.mjs --out assets/atlas [--base https://cdn.jsdelivr.net/gh/ashemag/human-atlas@main/public/models]
 * Télécharge atlas.json + tous les chunks .bin.gz. Puis mettre ATLAS_BASE_URL='assets/atlas' dans js/env.js.
 * Désactivé par défaut en V1 (streaming CDN lazy-load).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const baseIdx = args.indexOf('--base');
const out = outIdx >= 0 ? args[outIdx + 1] : 'assets/atlas';
const base = (baseIdx >= 0 ? args[baseIdx + 1] : 'https://cdn.jsdelivr.net/gh/ashemag/human-atlas@main/public/models').replace(/\/$/, '');

async function dl(url, dest) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} : ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, buf);
    console.log(`  ✓ ${basename(dest)} (${(buf.length / 1024 / 1024).toFixed(2)} Mo)`);
}

const index = await (await fetch(`${base}/atlas.json`)).json();
await mkdir(out, { recursive: true });
await writeFile(join(out, 'atlas.json'), JSON.stringify(index));
console.log(`[atlas] index : ${index.parts.length} parts, ${index.chunks.length} chunks → ${out}/`);
for (const c of index.chunks) {
    if (c.gzip) await dl(`${base}/${basename(c.gzip)}`, join(out, basename(c.gzip)));
    await dl(`${base}/${basename(c.url)}`, join(out, basename(c.url)));
}
console.log('[atlas] OK. Mettez ATLAS_BASE_URL="assets/atlas" pour le mode offline.');
