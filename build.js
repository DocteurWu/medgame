/**
 * Build Script - MedGame
 * Génère le fichier integrity.json avec les hashes SHA-256 de tous les assets
 * 
 * Usage: node build.js
 * 
 * Ce script doit être exécuté APRÈS chaque mise à jour des fichiers
 * pour générer les hashes utilisés par le Service Worker
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const PROJECT_ROOT = __dirname;
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'integrity.json');

// Extensions de fichiers à inclure
const INCLUDE_EXTENSIONS = [
    '.html',
    '.css',
    '.js',
    '.json',
    '.webp',
    '.png',
    '.jpg',
    '.mp3',
    '.m4a'
];

// Dossiers à inclure
const INCLUDE_DIRS = [
    '',
    'css/',
    'js/',
    'data/',
    'assets/'
];

// Dossiers à exclure
const EXCLUDE_DIRS = [
    'node_modules',
    '.git',
    'dist',
    'coverage'
];

/**
 * Calculer le hash SHA-256 d'un fichier
 */
function calculateFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

/**
 * Récupérer tous les fichiers à hasher
 */
function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const relativePath = path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/');
        
        // Ignorer les dossiers exclus
        if (EXCLUDE_DIRS.some(excluded => relativePath.startsWith(excluded))) {
            return;
        }
        
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            getAllFiles(fullPath, fileList);
        } else {
            // Vérifier l'extension
            const ext = path.extname(file).toLowerCase();
            if (INCLUDE_EXTENSIONS.includes(ext) || ext === '') {
                fileList.push({
                    path: relativePath,
                    fullPath: fullPath
                });
            }
        }
    });
    
    return fileList;
}

/**
 * Générer le fichier integrity.json
 */
function generateIntegrityFile() {
    console.log('🔄 Génération du fichier integrity.json...\n');
    
    const files = getAllFiles(PROJECT_ROOT);
    const hashes = {};
    const version = new Date().toISOString().split('T')[0]; // Format: 2026-03-14
    
    console.log(`📁 ${files.length} fichiers trouvés\n`);
    
    files.forEach(file => {
        try {
            const hash = calculateFileHash(file.fullPath);
            hashes[file.path] = `sha256:${hash.substring(0, 32)}...`; // Version courte pour lisibilité
            hashes[`_${file.path}`] = hash; // Hash complet pour vérification
            
            console.log(`  ✅ ${file.path}`);
        } catch (error) {
            console.log(`  ❌ Erreur pour ${file.path}: ${error.message}`);
        }
    });
    
    const output = {
        version: version,
        generated: new Date().toISOString(),
        files: hashes,
        stats: {
            totalFiles: Object.keys(hashes).filter(k => !k.startsWith('_')).length,
            totalHashes: Object.keys(hashes).length
        }
    };
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    
    console.log(`\n✅ Fichier integrity.json généré avec succès!`);
    console.log(`   Version: ${version}`);
    console.log(`   Fichiers: ${output.stats.totalFiles}`);
    console.log(`   Sortie: ${OUTPUT_FILE}\n`);
    
    console.log('💡 Pour mettre à jour le cache, exécutez ce script après chaque modification des fichiers.');
}

// Exécuter le script
generateIntegrityFile();
