#!/usr/bin/env node
/**
 * scripts/dev-server.mjs — Serveur web de développement (fichiers statiques).
 *
 * Pourquoi pas `python -m http.server` : il n'envoie pas de Cache-Control, et
 * Chrome garde alors d'anciens modules ES en cache (symptôme vu : salle 3D
 * neuve, patient ancien). Ici tout part en `no-store`, avec les bons types
 * MIME (.mjs, .glb, .wasm, .ktx2) — et plus besoin de Python.
 *
 * Usage : node scripts/dev-server.mjs [port]   (défaut 8791, ou $PORT)
 * Écoute sur 127.0.0.1 seulement : outil local, jamais exposé.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.argv[2] || process.env.PORT || 8791);

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.bin': 'application/octet-stream',
    '.wasm': 'application/wasm',
    '.ktx2': 'image/ktx2',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8'
};

const server = http.createServer((req, res) => {
    let rel;
    try {
        rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    } catch (e) {
        res.writeHead(400).end('Bad request');
        return;
    }
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(ROOT, rel));
    // Rien hors du dépôt, et jamais les secrets.
    if (!file.startsWith(ROOT + path.sep) || /[\\/]\.(env|git)([\\/]|$)/.test(file) || path.basename(file) === '.env') {
        res.writeHead(403).end('Forbidden');
        return;
    }
    fs.stat(file, (err, st) => {
        if (err || !st.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`404 — ${rel}`);
            return;
        }
        res.writeHead(200, {
            'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
            'Content-Length': st.size,
            'Cache-Control': 'no-store'
        });
        if (req.method === 'HEAD') { res.end(); return; }
        fs.createReadStream(file).pipe(res);
    });
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[dev-server] Le port ${PORT} est déjà utilisé (un serveur tourne peut-être déjà).`);
        process.exit(2);
    }
    throw err;
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`[dev-server] Medgame sur http://localhost:${PORT}  (Cache-Control: no-store)`);
});
