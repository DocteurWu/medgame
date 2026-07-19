import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Erreur: SUPABASE_URL et SUPABASE_KEY doivent être définis dans un fichier .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateCases() {
    const caseIndexPath = path.join(__dirname, 'data', 'case-index.json');
    console.log(`Lecture de l'index: ${caseIndexPath}`);

    if (!fs.existsSync(caseIndexPath)) {
        console.error("Fichier case-index.json introuvable.");
        return;
    }

    const caseIndexRaw = fs.readFileSync(caseIndexPath, 'utf-8');
    const caseIndex = JSON.parse(caseIndexRaw);

    const allCases = [];

    for (const specialty in caseIndex) {
        const files = caseIndex[specialty];
        for (const filename of files) {
            if (filename === "patient_test_complet.json" || filename === "test_gating.json") continue; // On skip eventuellement les tests purs.

            const filePath = path.join(__dirname, 'data', filename);
            if (fs.existsSync(filePath)) {
                try {
                    const fileContent = fs.readFileSync(filePath, 'utf-8');
                    const caseData = JSON.parse(fileContent);

                    let caseId = filename.replace('.json', '');

                    allCases.push({
                        id: caseId,
                        title: caseData.title || caseId.replace(/_/g, ' '),
                        specialty: specialty,
                        difficulty: caseData.difficulty || 1,
                        content: caseData
                    });

                    console.log(`[OK] Chargé: ${filename} (Spécialité: ${specialty})`);
                } catch (err) {
                    console.error(`[ERREUR] Lecture de ${filename}:`, err.message);
                }
            } else {
                console.warn(`[ATTENTION] Fichier introuvable: ${filename}`);
            }
        }
    }

    console.log(`\nPréparation de l'envoi de ${allCases.length} cas vers Supabase...`);

    // On envoie par lots pour éviter de surcharger (bien que Supabase gère pas mal de requêtes)
    const BATCH_SIZE = 10;
    for (let i = 0; i < allCases.length; i += BATCH_SIZE) {
        const batch = allCases.slice(i, i + BATCH_SIZE);

        // Upsert permet de mettre à jour si l'ID existe déjà (pratique pour relancer le script)
        const { data, error } = await supabase
            .from('cases')
            .upsert(batch, { onConflict: 'id' });

        if (error) {
            console.error(`\n[ERREUR SUPABASE] Lors de l'envoi du lot ${i / BATCH_SIZE + 1}:`, error.message);
        } else {
            console.log(`[SUCCES] Lot ${i / BATCH_SIZE + 1} inséré/mis à jour.`);
        }
    }

    console.log("\nMigration terminée !");
}

migrateCases();
