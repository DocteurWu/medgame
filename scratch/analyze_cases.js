import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = './data';
const caseIndex = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'case-index.json'), 'utf8'));

// Get all files in index
const indexedFiles = new Set();
for (const key of Object.keys(caseIndex)) {
    for (const file of caseIndex[key]) {
        indexedFiles.add(file);
    }
}

// Get all files in data directory
const filesInDir = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'case-index.json' && f !== 'drugs.json');

console.log('--- INDEX CHECK ---');
console.log(`Total indexed files: ${indexedFiles.size}`);
console.log(`Total JSON files in data/: ${filesInDir.length}`);

const nonIndexed = filesInDir.filter(f => !indexedFiles.has(f));
console.log('\nJSON files in data/ but not in case-index.json:');
console.log(nonIndexed);

const missingFiles = [];
for (const key of Object.keys(caseIndex)) {
    for (const file of caseIndex[key]) {
        if (!fs.existsSync(path.join(DATA_DIR, file))) {
            missingFiles.push({ specialty: key, file });
        }
    }
}
console.log('\nIndexed files that do not exist in data/:');
console.log(missingFiles);

// Analyze patient states vs typeStation
console.log('\n--- ANALYZING UNCONSCIOUS/COMA PATIENTS & TYPESTATION ---');
for (const file of filesInDir) {
    const filePath = path.join(DATA_DIR, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!content.ecos) continue;
    
    const vignette = content.ecos.vignette || {};
    const typeStation = vignette.typeStation;
    const patientStandardise = content.ecos.patientStandardise || {};
    const personality = patientStandardise.personnalite || patientStandardise.personnalité || '';
    
    const isUnconscious = /inconscient|comateux|comateuse|aréactif|arrêt cardio|ne répond pas|mannequin haute-fidélité/i.test(personality) || 
                          /inconscient|comateux|comateuse|aréactif|arrêt cardio|ne répond pas/i.test(vignette.contexte || '');
                          
    if (isUnconscious && typeStation === 'AVEC_PS') {
        console.log(`[WARN] ${file}: has typeStation 'AVEC_PS' but patient seems unconscious! Personality: "${personality.substring(0, 80)}..."`);
    }
}
