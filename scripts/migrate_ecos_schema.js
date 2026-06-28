import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json') && f !== 'case-index.json' && f !== 'drugs.json')
    .map(f => path.join(DATA_DIR, f));

console.log(`Analyzing ${files.length} cases for migration...`);

let modifiedCount = 0;

for (const filePath of files) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    let caseData;
    try {
        caseData = JSON.parse(raw);
    } catch (e) {
        console.error(`  ❌ ${path.basename(filePath)} : Invalid JSON`);
        continue;
    }

    if (!caseData.ecos) continue;

    let modified = false;
    const ecos = caseData.ecos;

    // 1. Normalize personnalite/personnalité inside patientStandardise
    if (ecos.patientStandardise) {
        const ps = ecos.patientStandardise;
        if ('personnalité' in ps) {
            ps.personnalite = ps['personnalité'];
            delete ps['personnalité'];
            modified = true;
        }

        // 2. Fix invalid paths in arrays
        const pathFixer = (arr) => {
            if (!Array.isArray(arr)) return arr;
            return arr.map(item => {
                if (typeof item !== 'string') return item;
                let newItem = item;
                if (newItem === 'motifConsultation') {
                    newItem = 'motifHospitalisation';
                    modified = true;
                }
                if (newItem === 'histoireMaladie.symptomesActuels') {
                    // Check if case has symptomesAssocies or descriptionDouleur
                    const hm = caseData.interrogatoire?.histoireMaladie || {};
                    if ('symptomesAssocies' in hm) {
                        newItem = 'histoireMaladie.symptomesAssocies';
                    } else if ('descriptionDouleur' in hm) {
                        newItem = 'histoireMaladie.descriptionDouleur';
                    } else {
                        newItem = 'histoireMaladie.symptomesAssocies';
                    }
                    modified = true;
                }
                if (newItem === 'traitements.actuels') {
                    newItem = 'traitements';
                    modified = true;
                }
                return newItem;
            });
        };

        if (ps.infosVolontaires) {
            ps.infosVolontaires = pathFixer(ps.infosVolontaires);
        }
        if (ps.infosSiDemandees) {
            ps.infosSiDemandees = pathFixer(ps.infosSiDemandees);
        }
        if (ps.infosCachees) {
            ps.infosCachees = pathFixer(ps.infosCachees);
        }
    }

    // 3. Condition typeStation for unconscious patients
    if (ecos.vignette && ecos.patientStandardise) {
        const personality = ecos.patientStandardise.personnalite || '';
        const context = ecos.vignette.contexte || '';
        
        const isUnconscious = /inconscient|comateux|comateuse|aréactif|arrêt cardio|ne répond pas|mannequin haute-fidélité/i.test(personality) || 
                              /inconscient|comateux|comateuse|aréactif|arrêt cardio|ne répond pas/i.test(context);
                              
        if (isUnconscious && ecos.vignette.typeStation !== 'SANS_PS_PSS') {
            console.log(`  Updating typeStation to SANS_PS_PSS for unconscious patient in ${path.basename(filePath)}`);
            ecos.vignette.typeStation = 'SANS_PS_PSS';
            // Clear or update phraseOuverture
            ecos.patientStandardise.phraseOuverture = '';
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, JSON.stringify(caseData, null, 2) + '\n', 'utf-8');
        modifiedCount++;
    }
}

console.log(`Migration complete! Modified ${modifiedCount} cases.`);
