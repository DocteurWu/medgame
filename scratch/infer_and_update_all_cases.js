import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const medgameRoot = path.join(__dirname, '..');

async function updateAllEmergencyCases() {
    const caseIndexPath = path.join(medgameRoot, 'data', 'case-index.json');
    console.log(`Reading index: ${caseIndexPath}`);

    if (!fs.existsSync(caseIndexPath)) {
        console.error("case-index.json not found.");
        return;
    }

    const caseIndex = JSON.parse(fs.readFileSync(caseIndexPath, 'utf-8'));
    const emergencyFiles = caseIndex.urgence || [];
    
    console.log(`Found ${emergencyFiles.length} emergency cases to process.`);

    for (const filename of emergencyFiles) {
        const filePath = path.join(medgameRoot, 'data', filename);
        if (!fs.existsSync(filePath)) {
            console.warn(`File not found: ${filename}`);
            continue;
        }

        try {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const caseData = JSON.parse(fileContent);

            if (!caseData.nodes) {
                console.warn(`[SKIP] ${filename} has no gameplay nodes.`);
                continue;
            }

            let modified = false;

            for (const nodeId in caseData.nodes) {
                const node = caseData.nodes[nodeId];
                
                // If it already has patientVisuel and it looks complete, skip or merge
                if (node.patientVisuel && node.patientVisuel.position && node.patientVisuel.expression) {
                    continue; // Skip already well-defined nodes to respect existing manual designs
                }

                const desc = (node.descriptionClinique || '').toLowerCase();
                const cibles = node.constantesCibles || {};
                const tensionStr = cibles.tension || '';
                const sysTension = parseInt(tensionStr.split('/')[0]) || 120;
                const spo2 = parseInt(cibles.saturationO2) || 98;
                const pouls = parseInt(cibles.pouls) || 72;
                const fr = parseInt(cibles.frequenceRespiratoire) || 16;

                // INFERENCE ENGINE
                let position = 'assis'; // Default position for emergency (often dyspneic or alert)
                let expression = 'normal';
                let couleurPeau = 'normal';
                let respiration = 'normal';
                let sang = false;

                // 1. ARRÊT CARDIAQUE / ACR
                if (
                    desc.includes('arret') || desc.includes('arrêt') || 
                    desc.includes('acr') || desc.includes('mort') || 
                    desc.includes('asystolie') || desc.includes('plat') || 
                    desc.includes('ne respire plus') || desc.includes('plus de pouls') ||
                    pouls === 0 || fr === 0 || tensionStr === '0/0' || tensionStr === '0'
                ) {
                    expression = 'acr';
                    position = 'allonge';
                    couleurPeau = 'gris';
                    respiration = 'agonal';
                }
                // 2. INCONSCIENT / COMATEUX
                else if (
                    desc.includes('inconscient') || desc.includes('ne réagit') || 
                    desc.includes('sans connaissance') || desc.includes('somnolence') || 
                    desc.includes('perte de connaissance') || desc.includes('comateux') ||
                    desc.includes('aréglo') || desc.includes('obnubil')
                ) {
                    expression = 'inconscient';
                    position = 'allonge';
                    couleurPeau = 'pale';
                    respiration = 'bradypnea';
                }
                // 3. PLS
                else if (desc.includes('pls') || desc.includes('position latérale')) {
                    expression = 'pls';
                    position = 'allonge';
                    couleurPeau = 'pale';
                    respiration = 'normal';
                }
                // 4. HÉMORRAGIE
                else if (desc.includes('saign') || desc.includes('hémorrag') || desc.includes('gicle') || desc.includes('sang') || desc.includes('amput')) {
                    expression = 'hemorragie';
                    position = 'allonge'; // Saignement sévère -> coucher
                    couleurPeau = 'pale';
                    respiration = 'tachypnea';
                    sang = true;
                }
                // 5. BRÛLURE
                else if (desc.includes('brûl') || desc.includes('brulure') || desc.includes('flamme')) {
                    expression = 'brulure';
                    couleurPeau = 'rouge';
                    respiration = 'tachypnea';
                    sang = true;
                }
                // 6. CYANOSE / OBSTRUCTION / DYSPNÉE MAJEURE
                else if (
                    desc.includes('bleu') || desc.includes('cyanose') || 
                    desc.includes('étouffe') || desc.includes('obstruction') || 
                    desc.includes('gorge') || desc.includes('wheezing') || 
                    desc.includes('tirage') || desc.includes('sifflement') ||
                    spo2 < 88
                ) {
                    expression = 'cyanose';
                    position = 'assis'; // Asphyxie -> assis pour respirer
                    couleurPeau = 'bleu';
                    respiration = 'dyspnea';
                }
                // 7. CHOC / HYPOTENSION
                else if (
                    desc.includes('choc') || desc.includes('livide') || 
                    desc.includes('pâli') || desc.includes('pale') ||
                    desc.includes('collapsus') || sysTension < 85
                ) {
                    expression = 'choc';
                    position = 'allonge'; // Choc -> jambes surélevées / allongé
                    couleurPeau = 'pale';
                    respiration = 'tachypnea';
                }
                // 8. CONVULSIONS
                else if (desc.includes('convuls') || desc.includes('crise') || desc.includes('secousse')) {
                    expression = 'convulsion';
                    position = 'allonge';
                    couleurPeau = 'normal';
                    respiration = 'dyspnea';
                }
                // 9. SUEURS
                else if (desc.includes('sueur') || desc.includes('suante') || desc.includes('moite') || desc.includes('profuses')) {
                    expression = 'sueur';
                    couleurPeau = 'pale';
                    respiration = 'tachypnea';
                }
                // 10. DOULEUR
                else if (desc.includes('douleur') || desc.includes('oppression') || desc.includes('serre') || desc.includes('mal')) {
                    expression = 'douleur';
                    position = 'assis';
                    couleurPeau = 'normal';
                    respiration = 'normal';
                }
                // 11. ANXIÉTÉ / AGITATION
                else if (desc.includes('anxieu') || desc.includes('angoisse') || desc.includes('panique') || desc.includes('agité')) {
                    expression = 'anxieux';
                    position = 'assis';
                    couleurPeau = 'normal';
                    respiration = 'tachypnea';
                }

                // If SPO2 is very low, force blue face
                if (spo2 < 85 && expression !== 'acr' && expression !== 'inconscient') {
                    expression = 'cyanose';
                    couleurPeau = 'bleu';
                    respiration = 'dyspnea';
                }

                const visuel = {
                    position,
                    expression,
                    couleurPeau,
                    respiration
                };

                if (sang) {
                    visuel.sang = true;
                }

                node.patientVisuel = visuel;
                modified = true;
            }

            if (modified) {
                fs.writeFileSync(filePath, JSON.stringify(caseData, null, 2), 'utf-8');
                console.log(`[UPDATED] ${filename}`);
            } else {
                console.log(`[NO CHANGE] ${filename}`);
            }

        } catch (err) {
            console.error(`[ERROR] Processing ${filename}:`, err.message);
        }
    }

    console.log("\nUpdate of local JSON files complete.");
}

updateAllEmergencyCases();
