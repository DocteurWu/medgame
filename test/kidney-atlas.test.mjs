/**
 * test/kidney-atlas.test.mjs — Tests unitaires pour le module Rein Détaillé 3D
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectGLB } from './helpers/glb.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Module Rein Détaillé 3D — Intégrité des assets et logique anatomique', () => {

    test('Les 4 fichiers GLB locaux existent et sont structurellement complets', () => {
        const reinDir = path.join(rootDir, 'assets', 'models', 'rein');
        assert.ok(fs.existsSync(reinDir), 'Le dossier assets/models/rein doit exister');

        const files = [
            'VH_M_Kidney_L.glb',
            'VH_M_Kidney_R.glb',
            'VH_F_Kidney_L.glb',
            'VH_F_Kidney_R.glb'
        ];

        let totalBytes = 0;
        for (const file of files) {
            const filePath = path.join(reinDir, file);
            assert.ok(fs.existsSync(filePath), `Le fichier ${file} doit exister en local`);
            const stat = fs.statSync(filePath);

            // Garde-fou bas : un fichier tronqué ou vidé ne passe pas.
            assert.ok(stat.size > 50000, `Le fichier ${file} ne doit pas être vide ou tronqué (taille réelle: ${stat.size})`);
            // Garde-fou haut : le poids est optimisé, il ne doit pas repartir à la hausse.
            assert.ok(stat.size < 1024 * 1024, `Le fichier ${file} doit faire moins de 1 Mo (taille réelle: ${stat.size})`);
            totalBytes += stat.size;

            // Vérification de l'en-tête binaire glTF (magic 0x46546C67 = "glTF")
            const fd = fs.openSync(filePath, 'r');
            const header = Buffer.alloc(12);
            fs.readSync(fd, header, 0, 12, 0);
            fs.closeSync(fd);
            const magic = header.toString('utf8', 0, 4);
            assert.equal(magic, 'glTF', `Le fichier ${file} doit être un conteneur binaire GLB valide`);

            // Complétude réelle : c'est la STRUCTURE qui distingue un rein détaillé d'un stub.
            // Le poids ne le peut plus : les modèles sont optimisés (positions quantifiées),
            // un rein complet pèse ~250 Ko au lieu de ~1,5 Mo, sans perdre un maillage.
            const glb = inspectGLB(filePath);
            assert.ok(glb.meshes >= 10, `Le fichier ${file} doit contenir les mailles anatomiques (trouvé: ${glb.meshes})`);
            assert.ok(glb.vertices >= 20000, `Le fichier ${file} doit être maillé (sommets: ${glb.vertices})`);
            assert.ok(glb.triangles >= 40000, `Le fichier ${file} doit contenir les faces anatomiques (trouvé: ${glb.triangles})`);
        }

        assert.ok(totalBytes < 2 * 1024 * 1024, `Le poids total des modèles doit être < 2 Mo (trouvé: ${(totalBytes / 1024 / 1024).toFixed(2)} Mo)`);
    });

    test('atlas-kidney.js exporte KIDNEY_STRUCTURES et identifyKidneyNode correctement', async () => {
        const kidneyMod = await import('../js/atlas-kidney.js');
        const { KIDNEY_STRUCTURES, identifyKidneyNode } = kidneyMod;

        assert.ok(KIDNEY_STRUCTURES, 'KIDNEY_STRUCTURES doit être défini');
        const requiredRoles = ['capsule', 'hilum', 'outer_cortex', 'renal_column', 'renal_medulla', 'renal_pyramid', 'renal_papilla'];
        for (const role of requiredRoles) {
            assert.ok(KIDNEY_STRUCTURES[role], `La structure ${role} doit exister dans KIDNEY_STRUCTURES`);
            assert.ok(KIDNEY_STRUCTURES[role].nameFr, `nameFr doit exister pour ${role}`);
            assert.ok(KIDNEY_STRUCTURES[role].color, `color doit exister pour ${role}`);
            assert.ok(KIDNEY_STRUCTURES[role].desc, `desc doit exister pour ${role}`);
        }

        // Test de la fonction identifyKidneyNode
        const testCases = [
            { name: 'VH_M_kidney_capsule_L', expectedRole: 'capsule' },
            { name: 'VH_M_hilum_of_kidney_L', expectedRole: 'hilum' },
            { name: 'VH_M_renal_column_L', expectedRole: 'column' },
            { name: 'VH_M_outer_cortex_of_kidney_L', expectedRole: 'cortex' },
            { name: 'VH_M_renal_medulla_L', expectedRole: 'medulla' },
            { name: 'VH_M_renal_pyramid_L_a', expectedRole: 'pyramid' },
            { name: 'VH_M_renal_papilla_L_c', expectedRole: 'papilla' },
            { name: 'VH_F_renal_pyramid_R_j', expectedRole: 'pyramid' },
            { name: 'VH_F_kidney_capsule_R', expectedRole: 'capsule' }
        ];

        for (const tc of testCases) {
            const identified = identifyKidneyNode(tc.name);
            assert.ok(identified, `Le nœud ${tc.name} doit être identifié`);
            assert.equal(identified.role, tc.expectedRole, `Le rôle de ${tc.name} doit être ${tc.expectedRole}`);
        }
    });

    test('atlas.html contient les éléments UI requis pour le module Rein', () => {
        const html = fs.readFileSync(path.join(rootDir, 'atlas.html'), 'utf8');

        assert.ok(html.includes('btn-module-kidney'), 'Le bouton module Rein doit être présent dans la barre de modules');
        assert.ok(html.includes('preset-kidney'), 'Le preset Rein doit être présent');
        assert.ok(html.includes('kidney-mode-panel'), 'Le panneau latéral kidney-mode-panel doit être présent');
        assert.ok(html.includes('btn-kidney-left'), 'Le sélecteur rein gauche doit exister');
        assert.ok(html.includes('btn-kidney-right'), 'Le sélecteur rein droit doit exister');
        assert.ok(html.includes('btn-kidney-male'), 'Le sélecteur homme doit exister');
        assert.ok(html.includes('btn-kidney-female'), 'Le sélecteur femme doit exister');
        assert.ok(html.includes('btn-kidney-view-full'), 'Le bouton Rein entier doit exister');
        assert.ok(html.includes('btn-kidney-view-cut'), 'Le bouton Vue en coupe doit exister');
        assert.ok(html.includes('kidney-clip-slider'), 'Le slider de coupe coronale doit exister');
        assert.ok(html.includes('btn-kidney-clip-toggle'), 'Le bouton toggle de coupe doit exister');
        assert.ok(html.includes('kidney-pyelo-card'), 'La fiche éducative pyélocalicielle doit exister');
        assert.ok(html.includes('nephro_fievre_et_douleur_lombaire_droite_m_ribaucourt'), 'Le lien vers le cas ECOS doit exister');
    });

    test('KidneyModelManager démarre avec le rein entier sans coupe par défaut', async () => {
        const { KidneyModelManager } = await import('../js/atlas-kidney.js');
        const manager = new KidneyModelManager();
        assert.equal(manager.clippingEnabled, false, 'Le plan de coupe doit être désactivé par défaut (rein entier)');
        assert.equal(manager.clipDepthRatio, 0.0, 'Le ratio de profondeur doit être à 0.0 par défaut (rein entier)');

        // Test de la transition dynamique
        manager.setClipDepthRatio(0.5);
        assert.equal(manager.clippingEnabled, true, 'Le plan de coupe doit s\'activer automatiquement quand le curseur avance');
        assert.equal(manager.clipDepthRatio, 0.5, 'Le ratio doit être 0.5');

        manager.setClipDepthRatio(0.0);
        assert.equal(manager.clippingEnabled, false, 'Le plan de coupe doit se désactiver à 0 (rein entier)');
    });

    test('ATTRIBUTIONS.md mentionne HuBMAP / CCF 3D Reference Object Library v1.2 sous licence CC BY 4.0', () => {
        const attributions = fs.readFileSync(path.join(rootDir, 'ATTRIBUTIONS.md'), 'utf8');

        assert.ok(attributions.includes('HuBMAP'), 'ATTRIBUTIONS.md doit mentionner HuBMAP');
        assert.ok(attributions.includes('CCF 3D Reference Object Library'), 'ATTRIBUTIONS.md doit mentionner CCF 3D Reference Object Library');
        assert.ok(attributions.includes('CC BY 4.0'), 'ATTRIBUTIONS.md doit mentionner la licence CC BY 4.0');
        assert.ok(attributions.includes('Visible Human'), 'ATTRIBUTIONS.md doit mentionner Visible Human');
    });

    test('Zéro emoji dans js/atlas-kidney.js et test/kidney-atlas.test.mjs', () => {
        const filesToCheck = [
            'js/atlas-kidney.js',
            'test/kidney-atlas.test.mjs'
        ];

        const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

        for (const file of filesToCheck) {
            const content = fs.readFileSync(path.join(rootDir, file), 'utf8');
            const match = content.match(emojiRegex);
            assert.equal(match, null, `Le fichier ${file} ne doit contenir aucun emoji (trouvé: ${match ? match[0] : ''})`);
        }
    });

});
