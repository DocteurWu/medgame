/**
 * compress-models.mjs — Compression Draco one-time des GLB lourds de MedGame.
 *
 * Usage : node scripts/compress-models.mjs
 *
 * Compresse la géométrie (Draco Edgebreaker, speed 5/5) des modèles listés
 * ci-dessous et écrit un fichier `*.draco.glb` à côté de l'original.
 * Les originaux sont conservés comme fallback si le décodeur échoue.
 */

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, DracoMeshCompression } from '@gltf-transform/extensions';
import { dedup, prune, resample } from '@gltf-transform/functions';
import draco3dgltf from 'draco3dgltf';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TARGETS = [
    'assets/models/doctors/homme.glb',
    'assets/models/doctors/femme.glb',
    'assets/3D/stethoscope.glb'
];

const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
        'draco3d.decoder': await draco3dgltf.createDecoderModule(),
        'draco3d.encoder': await draco3dgltf.createEncoderModule()
    });

const fmt = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB';

for (const rel of TARGETS) {
    const inPath = path.join(ROOT, rel);
    const outPath = inPath.replace(/\.glb$/, '.draco.glb');

    if (!fs.existsSync(inPath)) {
        console.warn(`⚠ Introuvable, ignoré : ${rel}`);
        continue;
    }
    if (fs.existsSync(outPath)) {
        console.log(`↷ Déjà compressé, ignoré : ${rel}`);
        continue;
    }

    process.stdout.write(`⏳ Compression ${rel} … `);
    const t0 = Date.now();

    const document = await io.read(inPath);
    await document.transform(dedup(), prune(), resample());

    // Attache la compression Draco requise à l'écriture
    document.createExtension(DracoMeshCompression)
        .setRequired(true)
        .setEncoderOptions({
            method: DracoMeshCompression.EncoderMethod.EDGEBREAKER,
            encodeSpeed: 5,
            decodeSpeed: 5
        });

    await io.write(outPath, document);

    const before = fs.statSync(inPath).size;
    const after = fs.statSync(outPath).size;
    console.log(`✅ ${fmt(before)} → ${fmt(after)} (${Math.round((1 - after / before) * 100)}% — ${Date.now() - t0} ms)`);
}

console.log('Terminé.');
