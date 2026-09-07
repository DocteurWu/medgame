#!/usr/bin/env node
/**
 * scripts/sync-supabase.mjs
 * Synchronisation du corpus complet de cas cliniques (90 cas ECOS) vers Supabase.
 *
 * Authentification supportée :
 *   1. Clé Service Role (recommandé pour import de masse) :
 *      - SUPABASE_SERVICE_ROLE_KEY dans .env ou en variable d'environnement
 *   2. Compte Admin Supabase (email + mot de passe) :
 *      - SUPABASE_ADMIN_EMAIL et SUPABASE_ADMIN_PASSWORD
 *
 * Usage :
 *   node scripts/sync-supabase.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, 'data');
const INDEX_PATH = join(DATA_DIR, 'case-index.json');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

// 1. Récupération de l'URL Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jxhzjetxquimmkpzlfyh.supabase.co';

// 2. Détermination de la clé / authentification
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const ANON_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_Nqjp4eF3ytr3VDciqX8dvA_JhdVP0G0';
const ADMIN_EMAIL = process.env.SUPABASE_ADMIN_EMAIL || process.env.SUPABASE_EMAIL;
const ADMIN_PASSWORD = process.env.SUPABASE_ADMIN_PASSWORD || process.env.SUPABASE_PASSWORD;

console.log('====================================================');
console.log('🏥 MedGame — Synchronisation Supabase (Format ECOS)');
console.log('====================================================');
console.log(`🌐 Supabase URL : ${SUPABASE_URL}`);
if (DRY_RUN) console.log('🔍 MODE SIMULATION (--dry-run) : aucune écriture distante');

async function getAuthenticatedClient() {
    if (SERVICE_KEY) {
        console.log('🔑 Authentification : Service Role Key détectée (droits administrateur complets).');
        return createClient(SUPABASE_URL, SERVICE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false }
        });
    }

    const client = createClient(SUPABASE_URL, ANON_KEY);

    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
        console.log(`🔐 Tentative de connexion administrateur pour ${ADMIN_EMAIL}...`);
        const { data: authData, error: authErr } = await client.auth.signInWithPassword({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });

        if (authErr) {
            console.error(`❌ Échec de l'authentification : ${authErr.message}`);
            process.exit(1);
        }

        console.log(`✅ Connecté en tant que ${authData.user.email} (${authData.user.id})`);
        return client;
    }

    console.warn('\n⚠️  ATTENTION : Aucune clé SUPABASE_SERVICE_ROLE_KEY ni compte admin renseigné dans .env');
    console.warn('   La clé publique (anon) est soumise aux règles RLS (Row Level Security).');
    console.warn('   Pour synchroniser en tant qu\'administrateur, ajoutez dans votre fichier .env :');
    console.warn('   SUPABASE_SERVICE_ROLE_KEY=<votre_cle_service_role_supabase>\n');

    return client;
}

async function run() {
    if (!existsSync(INDEX_PATH)) {
        console.error(`❌ Fichier case-index.json introuvable à : ${INDEX_PATH}`);
        process.exit(1);
    }

    const caseIndex = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
    const allCasesToSync = [];
    const seenCaseIds = new Set();

    console.log('\n📦 Chargement des cas locaux validés...');
    for (const [specialty, files] of Object.entries(caseIndex)) {
        for (const filename of files) {
            if (filename.includes('test_gating') || filename.includes('patient_test_complet')) continue;

            const filePath = join(DATA_DIR, filename);
            if (!existsSync(filePath)) {
                console.warn(`  ⚠️ Fichier référencé introuvable : ${filename}`);
                continue;
            }

            try {
                const caseData = JSON.parse(readFileSync(filePath, 'utf8'));
                const caseId = caseData.id || filename.replace(/\.json$/, '');

                if (seenCaseIds.has(caseId)) continue;
                seenCaseIds.add(caseId);

                // Titre non-leak : motif de consultation en priorité
                const title = caseData.motif 
                    || caseData.interrogatoire?.motifHospitalisation 
                    || caseData.ecos?.titre 
                    || caseId.replace(/_/g, ' ');

                allCasesToSync.push({
                    id: caseId,
                    title: title,
                    specialty: specialty,
                    difficulty: caseData.difficulty || 1,
                    content: caseData,
                    status: 'published',
                    author_name: caseData.redacteur || 'MedGame ECOS'
                });
            } catch (e) {
                console.error(`  ❌ Erreur de lecture de ${filename} : ${e.message}`);
            }
        }
    }

    console.log(`✅ ${allCasesToSync.length} cas prêts pour la synchronisation.`);

    if (DRY_RUN) {
        console.log('\n[SIMULATION] Exemples de cas qui seraient synchronisés :');
        allCasesToSync.slice(0, 5).forEach((c, idx) => {
            console.log(`  ${idx + 1}. [${c.specialty}] ${c.id} -> "${c.title}"`);
        });
        console.log(`\n✨ Simulation terminée avec succès (${allCasesToSync.length} cas analysés).`);
        return;
    }

    const supabase = await getAuthenticatedClient();

    console.log(`\n🚀 Synchronisation vers la table 'cases' (${allCasesToSync.length} cas)...`);
    const BATCH_SIZE = 10;
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < allCasesToSync.length; i += BATCH_SIZE) {
        const batch = allCasesToSync.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(allCasesToSync.length / BATCH_SIZE);

        const { error } = await supabase
            .from('cases')
            .upsert(batch, { onConflict: 'id' });

        if (error) {
            console.error(`  ❌ [Lot ${batchNumber}/${totalBatches}] Erreur Supabase :`, error.message);
            failureCount += batch.length;
            if (error.code === '42501') {
                console.error('\n🛑 Blocage de sécurité RLS détecté (code 42501).');
                console.error('   L\'écriture requiert la clé service role dans .env :');
                console.error('   SUPABASE_SERVICE_ROLE_KEY=eyJh...\n');
                process.exit(1);
            }
        } else {
            successCount += batch.length;
            console.log(`  ✅ [Lot ${batchNumber}/${totalBatches}] ${batch.length} cas synchronisés (cumul : ${successCount}/${allCasesToSync.length})`);
        }
    }

    // Archivage des anciens cas orphelins (pour éviter les doublons et les fuites de diagnostic)
    console.log('\n🧹 Nettoyage des anciens cas orphelins dans Supabase...');
    const { data: remoteCases, error: fetchErr } = await supabase
        .from('cases')
        .select('id, status');

    if (!fetchErr && remoteCases) {
        const activeIds = new Set(allCasesToSync.map(c => c.id));
        const toArchive = remoteCases
            .filter(c => !activeIds.has(c.id) && c.status !== 'archived')
            .map(c => c.id);

        if (toArchive.length > 0) {
            console.log(`  📦 ${toArchive.length} anciens cas orphelins détectés, bascule vers status: 'archived'...`);
            const { error: archiveErr } = await supabase
                .from('cases')
                .update({ status: 'archived' })
                .in('id', toArchive);

            if (archiveErr) {
                console.warn('  ⚠️ Erreur lors de l\'archivage des anciens cas :', archiveErr.message);
            } else {
                console.log(`  ✅ ${toArchive.length} anciens cas archivés avec succès.`);
            }
        } else {
            console.log('  ✨ Aucun ancien cas orphelin à archiver.');
        }
    }

    console.log('\n====================================================');
    if (failureCount === 0) {
        console.log(`🎉 SUCCÈS : ${successCount} cas synchronisés avec succès sur Supabase !`);
    } else {
        console.log(`⚠️  Partiellement terminé : ${successCount} succès, ${failureCount} échecs.`);
    }
    console.log('====================================================\n');
}

run().catch(err => {
    console.error('❌ Erreur inattendue :', err);
    process.exit(1);
});
