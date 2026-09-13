/**
 * test/lung-atlas.test.mjs - Tests unitaires pour le module Poumon Détaillé 3D
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Module Poumon Détaillé 3D - Intégrité des assets et logique anatomique', () => {

    test('Les 2 fichiers GLB locaux existent et ont un poids conforme (Homme ~6 Mo, Femme ~10,7 Mo)', () => {
        const poumonDir = path.join(rootDir, 'assets', 'models', 'poumon');
        assert.ok(fs.existsSync(poumonDir), 'Le dossier assets/models/poumon doit exister');

        const files = [
            { name: 'VH_M_Lung.glb', minSize: 5 * 1024 * 1024, maxSize: 8 * 1024 * 1024 },
            { name: 'VH_F_Lung.glb', minSize: 9 * 1024 * 1024, maxSize: 13 * 1024 * 1024 }
        ];

        let totalBytes = 0;
        for (const file of files) {
            const filePath = path.join(poumonDir, file.name);
            assert.ok(fs.existsSync(filePath), `Le fichier ${file.name} doit exister en local`);
            const stat = fs.statSync(filePath);
            assert.ok(stat.size > file.minSize, `Le fichier ${file.name} doit faire plus de ${(file.minSize / 1024 / 1024).toFixed(1)} Mo (taille réelle: ${stat.size})`);
            assert.ok(stat.size < file.maxSize, `Le fichier ${file.name} doit faire moins de ${(file.maxSize / 1024 / 1024).toFixed(1)} Mo (taille réelle: ${stat.size})`);
            totalBytes += stat.size;

            // Vérification de l'en-tête binaire glTF (magic 0x46546C67 = "glTF")
            const fd = fs.openSync(filePath, 'r');
            const header = Buffer.alloc(12);
            fs.readSync(fd, header, 0, 12, 0);
            fs.closeSync(fd);
            const magic = header.toString('utf8', 0, 4);
            assert.equal(magic, 'glTF', `Le fichier ${file.name} doit être un conteneur binaire GLB valide`);
        }

        assert.ok(totalBytes > 15 * 1024 * 1024, `Le poids total des 2 modèles doit être > 15 Mo`);
        assert.ok(totalBytes < 20 * 1024 * 1024, `Le poids total des 2 modèles doit être < 20 Mo (trouvé: ${(totalBytes / 1024 / 1024).toFixed(2)} Mo)`);
    });

    test('atlas-lung.js exporte LUNG_STRUCTURES couvrant exactement les 67 structures réelles', async () => {
        const lungMod = await import('../js/atlas-lung.js');
        const { LUNG_STRUCTURES } = lungMod;

        assert.ok(LUNG_STRUCTURES, 'LUNG_STRUCTURES doit être défini');
        const keys = Object.keys(LUNG_STRUCTURES);
        assert.equal(keys.length, 67, `LUNG_STRUCTURES doit contenir exactement 67 maillages répertoriés (trouvé: ${keys.length})`);

        // Vérification des propriétés obligatoires pour chaque structure
        for (const [key, struct] of Object.entries(LUNG_STRUCTURES)) {
            assert.ok(struct.id, `id manquant pour ${key}`);
            assert.ok(struct.nameFr, `nameFr manquant pour ${key}`);
            assert.ok(struct.nameEn, `nameEn manquant pour ${key}`);
            assert.ok(struct.color, `color manquant pour ${key}`);
            assert.ok(struct.desc, `desc manquant pour ${key}`);
            assert.ok(struct.role, `role manquant pour ${key}`);
            assert.ok(struct.subgroup, `subgroup manquant pour ${key}`);
        }

        // Vérification des 20 segments parenchymateux (doivent avoir segmentNumber et lobe)
        const segmentEntries = Object.values(LUNG_STRUCTURES).filter(s => s.role === 'parenchyma_segment');
        assert.equal(segmentEntries.length, 21, 'Il doit y avoir 21 maillages parenchymateux (20 segments + right_posterior_basal)');
        for (const seg of segmentEntries) {
            assert.ok(seg.segmentNumber, `segmentNumber manquant pour ${seg.id}`);
            assert.ok(seg.lobe, `lobe manquant pour ${seg.id}`);
        }
    });

    test('identifyLungNode résout correctement les structures régulières et les 2 noms piégeux', async () => {
        const lungMod = await import('../js/atlas-lung.js');
        const { identifyLungNode } = lungMod;

        // Pièges réels mentionnés dans le cahier des charges
        const tricky1 = identifyLungNode('VH_M_left_posetrior_basal_bronchopulmonary_segment');
        assert.ok(tricky1, 'Le segment basal postérieur gauche (posetrior) doit être identifié');
        assert.equal(tricky1.segmentNumber, 'S10');
        assert.equal(tricky1.lobe, 'Lobe inférieur gauche');

        const tricky2 = identifyLungNode('VH_M_right_posterior_basal');
        assert.ok(tricky2, 'Le maillage sans suffixe right_posterior_basal doit être identifié');
        assert.equal(tricky2.segmentNumber, 'S10');
        assert.equal(tricky2.lobe, 'Lobe inférieur droit');

        // Structures régulières masculines
        const testCasesMale = [
            { name: 'VH_M_trachea', expectedRole: 'tracheobronchial_tree' },
            { name: 'VH_M_carina', expectedRole: 'tracheobronchial_tree' },
            { name: 'VH_M_arytenoid_cartilage_L', expectedRole: 'laryngeal_cartilage' },
            { name: 'VH_M_left_main_bronchus', expectedRole: 'bronchial_tree' },
            { name: 'VH_M_right_intermediate_bronchus', expectedRole: 'bronchial_tree' },
            { name: 'VH_M_left_lingular_bronchus', expectedRole: 'lobar_bronchus' },
            { name: 'VH_M_right_middle_lobar_bronchus', expectedRole: 'lobar_bronchus' },
            { name: 'VH_M_right_apical_bronchopulmonary_segment', expectedRole: 'parenchyma_segment' },
            { name: 'VH_M_left_lingula_superior_bronchopulmonary_segment', expectedRole: 'parenchyma_segment' },
            { name: 'VH_M_hilum_L', expectedRole: 'hilum' }
        ];

        for (const tc of testCasesMale) {
            const identified = identifyLungNode(tc.name);
            assert.ok(identified, `Le nœud ${tc.name} doit être identifié`);
            assert.equal(identified.role, tc.expectedRole, `Le rôle de ${tc.name} doit être ${tc.expectedRole}`);
        }

        // Variantes du modèle féminin
        const testCasesFemale = [
            { name: 'VH_F_lingula_superior_bronchopulmonary_segment', expectedRole: 'parenchyma_segment' },
            { name: 'VH_F_right_lateral_bronchopulmonary_segmennt', expectedRole: 'parenchyma_segment' },
            { name: 'VH_F_right_anterior_bronchopulmonary_segm', expectedRole: 'parenchyma_segment' },
            { name: 'VH_F_epiglotic_cartilage', expectedRole: 'laryngeal_cartilage' },
            { name: 'VH_F_lungs_left_main_bronchus', expectedRole: 'bronchial_tree' }
        ];

        for (const tc of testCasesFemale) {
            const identified = identifyLungNode(tc.name);
            assert.ok(identified, `Le nœud féminin ${tc.name} doit être identifié`);
            assert.equal(identified.role, tc.expectedRole, `Le rôle de ${tc.name} doit être ${tc.expectedRole}`);
        }

        // Sans préfixe
        const direct = identifyLungNode('trachea');
        assert.ok(direct, 'trachea sans préfixe doit être résolu');
        assert.equal(direct.role, 'tracheobronchial_tree');
    });

    test('atlas.html contient tous les éléments UI requis pour le module Poumon (modèle féminin exclusif)', () => {
        const html = fs.readFileSync(path.join(rootDir, 'atlas.html'), 'utf8');

        assert.ok(html.includes('btn-module-lung'), 'Le bouton module Poumon doit être présent dans la barre de modules');
        assert.ok(html.includes('preset-lung'), 'Le preset Poumon doit être présent');
        assert.ok(html.includes('lung-mode-panel'), 'Le panneau latéral lung-mode-panel doit être présent');
        assert.equal(html.includes('btn-lung-male'), false, 'Le sélecteur homme ne doit plus exister car le modèle féminin haute résolution est exclusif');
        assert.equal(html.includes('btn-lung-female'), false, 'Le sélecteur femme ne doit plus exister car le modèle féminin haute résolution est exclusif');
        assert.ok(html.includes('btn-lung-view-full'), 'Le bouton Poumons entiers doit exister');
        assert.ok(html.includes('btn-lung-view-cut'), 'Le bouton Vue en coupe doit exister');
        assert.ok(html.includes('lung-clip-slider'), 'Le slider de coupe coronale doit exister');
        assert.ok(html.includes('btn-lung-clip-toggle'), 'Le bouton toggle de coupe doit exister');
        assert.ok(html.includes('btn-lung-clip-invert'), 'Le bouton inversion de coupe doit exister');
        assert.ok(html.includes('lung-lobe-btn'), 'Les boutons d exploration par lobe doivent exister');
        assert.ok(html.includes('lung-edu-card'), 'La fiche éducative synthétique doit exister');
        assert.ok(html.includes('pneumo_dyspnee_d_effort_et_toux_m_lemoine'), 'Le lien vers le cas ECOS pneumo doit exister');
    });

    test('LungModelManager démarre avec les poumons entiers sans coupe par défaut', async () => {
        const { LungModelManager } = await import('../js/atlas-lung.js');
        const manager = new LungModelManager();
        assert.equal(manager.clippingEnabled, false, 'Le plan de coupe doit être désactivé par défaut (poumons entiers)');
        assert.equal(manager.clipDepthRatio, 0.0, 'Le ratio de profondeur doit être à 0.0 par défaut (poumons entiers)');

        // Test de la transition dynamique
        manager.setClipDepthRatio(0.5);
        assert.equal(manager.clippingEnabled, true, 'Le plan de coupe doit s activer automatiquement quand le curseur avance');
        assert.equal(manager.clipDepthRatio, 0.5, 'Le ratio doit être 0.5');

        manager.setClipDepthRatio(0.0);
        assert.equal(manager.clippingEnabled, false, 'Le plan de coupe doit se désactiver à 0 (poumons entiers)');
    });

    test('ATTRIBUTIONS.md mentionne HuBMAP, CCF 3D Reference Object Library, CC BY 4.0 et Poumon', () => {
        const attributions = fs.readFileSync(path.join(rootDir, 'ATTRIBUTIONS.md'), 'utf8');

        assert.ok(attributions.includes('Module Poumon Détaillé 3D'), 'ATTRIBUTIONS.md doit comporter la section Module Poumon Détaillé 3D');
        assert.ok(attributions.includes('HuBMAP'), 'ATTRIBUTIONS.md doit mentionner HuBMAP');
        assert.ok(attributions.includes('CCF 3D Reference Object Library'), 'ATTRIBUTIONS.md doit mentionner CCF 3D Reference Object Library');
        assert.ok(attributions.includes('CC BY 4.0'), 'ATTRIBUTIONS.md doit mentionner la licence CC BY 4.0');
        assert.ok(attributions.includes('VH_M_Lung.glb'), 'ATTRIBUTIONS.md doit mentionner VH_M_Lung.glb');
        assert.ok(attributions.includes('VH_F_Lung.glb'), 'ATTRIBUTIONS.md doit mentionner VH_F_Lung.glb');
    });

    test('Zéro emoji dans js/atlas-lung.js et test/lung-atlas.test.mjs', () => {
        const filesToCheck = [
            'js/atlas-lung.js',
            'test/lung-atlas.test.mjs'
        ];

        const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

        for (const file of filesToCheck) {
            const content = fs.readFileSync(path.join(rootDir, file), 'utf8');
            const match = content.match(emojiRegex);
            assert.equal(match, null, `Le fichier ${file} ne doit contenir aucun emoji (trouvé: ${match ? match[0] : ''})`);
        }
    });

    test('Zéro tiret cadratin dans les textes rédigés de js/atlas-lung.js et test/lung-atlas.test.mjs', () => {
        const filesToCheck = [
            'js/atlas-lung.js',
            'test/lung-atlas.test.mjs'
        ];

        for (const file of filesToCheck) {
            const content = fs.readFileSync(path.join(rootDir, file), 'utf8');
            assert.equal(content.includes('\u2014'), false, `Le fichier ${file} ne doit contenir aucun tiret cadratin`);
        }
    });

});
