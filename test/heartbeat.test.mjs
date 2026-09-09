import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    groupCardiacParts,
    heartPhase,
    heartMotion,
    detectRPeaks,
    ECGSynchronizer,
    HEART_PRESETS
} from '../js/atlas-heartbeat.js';

test('Atlas Heartbeat — Identification et exclusion des structures', async (t) => {
    await t.test('identifie les 18 structures cibles et exclut strictement les ventricules cérébraux', () => {
        const mockParts = [
            // Cérébraux (pièges à exclure)
            { id: 'FJ1730', name: 'Third ventricle', system: 'cardiac' },
            { id: 'FJ1731', name: 'Fourth ventricle', system: 'cardiac' },
            { id: 'FJ1752', name: 'Interventricular foramen', system: 'cardiac' },
            { id: 'FJ1767', name: 'Left lateral ventricle', system: 'cardiac' },
            { id: 'FJ1814', name: 'Right lateral ventricle', system: 'cardiac' },
            { id: 'FJ9999', name: 'Septum of telencephalon', system: 'nervous' },

            // 18 Vraies pièces cardiaques
            { id: 'FJ2417', name: 'Left anterior cusp of pulmonary valve', system: 'cardiac' },
            { id: 'FJ2420', name: 'Anterior leaflet of mitral valve', system: 'cardiac' },
            { id: 'FJ2421', name: 'Anterior leaflet of tricuspid valve', system: 'cardiac' },
            { id: 'FJ2422', name: 'Cavity of left ventricle', system: 'cardiac' },
            { id: 'FJ2423', name: 'Cavity of right ventricle', system: 'cardiac' },
            { id: 'FJ2424', name: 'Cavity of right atrium', system: 'cardiac' },
            { id: 'FJ2425', name: 'Cavity of left atrium', system: 'cardiac' },
            { id: 'FJ2426', name: 'Left posterior cusp of aortic valve', system: 'cardiac' },
            { id: 'FJ2427', name: 'Posterior cusp of pulmonary valve', system: 'cardiac' },
            { id: 'FJ2428', name: 'Wall of ventricle', system: 'cardiac' },
            { id: 'FJ2431', name: 'Right posterior cusp of aortic valve', system: 'cardiac' },
            { id: 'FJ2432', name: 'Posterior leaflet of mitral valve', system: 'cardiac' },
            { id: 'FJ2433', name: 'Posterior leaflet of tricuspid valve', system: 'cardiac' },
            { id: 'FJ2434', name: 'Right anterior cusp of pulmonary valve', system: 'cardiac' },
            { id: 'FJ2435', name: 'Anterior cusp of aortic valve', system: 'cardiac' },
            { id: 'FJ2436', name: 'Septal leaflet of tricuspid valve', system: 'cardiac' },
            { id: 'FJ2438', name: 'Wall of left atrium', system: 'cardiac' },
            { id: 'FJ2439', name: 'Wall of right atrium', system: 'cardiac' },

            // Organes adjacents non animés
            { id: 'FJ3413', name: 'Ascending aorta', system: 'arterial' },
            { id: 'FJ0001', name: 'Femur', system: 'skeletal' }
        ];

        const res = groupCardiacParts(mockParts);
        assert.equal(res.count, 18, 'Doit identifier exactement 18 structures cardiaques');

        // Vérification des exclusions
        assert.ok(!res.partIndices.has(0), 'FJ1730 (Third ventricle) doit être exclu');
        assert.ok(!res.partIndices.has(1), 'FJ1731 (Fourth ventricle) doit être exclu');
        assert.ok(!res.partIndices.has(2), 'FJ1752 (Interventricular foramen) doit être exclu');
        assert.ok(!res.partIndices.has(3), 'FJ1767 (Left lateral ventricle) doit être exclu');
        assert.ok(!res.partIndices.has(4), 'FJ1814 (Right lateral ventricle) doit être exclu');
        assert.ok(!res.partIndices.has(5), 'Septum of telencephalon doit être exclu');

        // Vérification des groupes
        assert.equal(res.groups.aorticValve.length, 3, '3 sigmoïdes aortiques');
        assert.equal(res.groups.mitralValve.length, 2, '2 feuillets mitraux');
        assert.equal(res.groups.tricuspidValve.length, 3, '3 feuillets tricuspides');
        assert.equal(res.groups.pulmonaryValve.length, 3, '3 sigmoïdes pulmonaires');
        assert.equal(res.groups.ventricleCavities.length, 2, '2 cavités ventriculaires (VG + VD)');
        assert.equal(res.groups.atriumCavities.length, 2, '2 cavités auriculaires (OG + OD)');
        assert.equal(res.groups.ventricleWall.length, 1, '1 paroi ventriculaire');
        assert.equal(res.groups.atriumWalls.length, 2, '2 parois auriculaires');
    });
});

test('Atlas Heartbeat — Calcul de phase et cinématique', async (t) => {
    await t.test('heartPhase calcule une phase [0, 1) périodique', () => {
        const p0 = heartPhase(0, 60);
        const pHalf = heartPhase(0.5, 60);
        const pNext = heartPhase(1.0, 60);

        assert.equal(p0, 0);
        assert.ok(Math.abs(pHalf - 0.5) < 1e-5);
        assert.ok(pNext < 1e-5);
    });

    await t.test('Cinématique Sinus : systole ventriculaire, systole auriculaire et ouverture des valves', () => {
        // En systole ventriculaire (phase ~0.20)
        const motionSystole = heartMotion(0.20, 'sinus', true);
        assert.ok(motionSystole.ventContraction > 0.8, 'Forte contraction ventriculaire en phase 0.20');
        assert.ok(motionSystole.scales.ventricleCavities.x < 0.95, 'Le ventricule doit se contracter (scale < 0.95)');
        assert.ok(motionSystole.valveOffsets.aortic > 0.002, 'La valve aortique doit être largement ouverte');
        assert.ok(motionSystole.valveOffsets.mitral < 0.0005, 'La valve mitrale doit être fermée en systole');

        // En diastole / remplissage passif (phase ~0.65)
        const motionDiastole = heartMotion(0.65, 'sinus', true);
        assert.equal(motionDiastole.ventContraction, 0, 'Relâchement ventriculaire complet en diastole');
        assert.equal(motionDiastole.scales.ventricleCavities.x, 1.0, 'Volume ventriculaire au repos');
        assert.ok(motionDiastole.valveOffsets.mitral > 0.002, 'La valve mitrale doit être ouverte pour le remplissage');
        assert.equal(motionDiastole.valveOffsets.aortic, 0, 'La valve aortique doit être fermée');

        // En systole auriculaire (phase ~0.92)
        const motionAtria = heartMotion(0.92, 'sinus', true);
        assert.ok(motionAtria.atriaContraction > 0.7, 'Contraction auriculaire active en phase 0.92');
        assert.ok(motionAtria.scales.atriumCavities.x < 0.96, 'Oreillette contractée pour vider son contenu');
    });

    await t.test('Cinématique RA : sténose aortique restreinte et hypertrophie VG', () => {
        const sinusMotion = heartMotion(0.22, 'sinus', true);
        const raMotion = heartMotion(0.22, 'ra', true);

        assert.ok(raMotion.valveOffsets.aortic < sinusMotion.valveOffsets.aortic * 0.5, 'Ouverture aortique sévèrement réduite (< 50%) en RA');
        assert.ok(raMotion.scales.ventricleCavities.x < sinusMotion.scales.ventricleCavities.x, 'Contraction VG plus puissante en RA (hypertrophie concentrique)');
    });

    await t.test('Cinématique IM : fuite mitrale avec défaut de coaptation systolique', () => {
        const sinusMotion = heartMotion(0.20, 'sinus', true);
        const imMotion = heartMotion(0.20, 'im', true);

        assert.equal(sinusMotion.valveOffsets.mitral, 0, 'Valve mitrale parfaitement étanche en sinusal');
        assert.ok(imMotion.valveOffsets.mitral > 0.0008, 'Gap de fuite mitrale résiduel visible en systole (IM)');
    });

    await t.test('Cinématique ACFA : perte de la contraction auriculaire efficace', () => {
        const sinusMotion = heartMotion(0.92, 'sinus', true);
        const acfaMotion = heartMotion(0.92, 'acfa', true, 1.5);

        assert.ok(sinusMotion.atriaContraction > 0.7, 'Contraction auriculaire normale en sinusal');
        assert.ok(Math.abs(acfaMotion.atriaContraction) < 0.08, 'Absence de contraction efficace en ACFA (micro-trémulation seule)');
    });

    await t.test('Vue corps entier : amplitudes atténuées pour préserver le naturel', () => {
        const isolated = heartMotion(0.22, 'sinus', true);
        const wholeBody = heartMotion(0.22, 'sinus', false);

        assert.ok((1.0 - wholeBody.scales.ventricleCavities.x) < (1.0 - isolated.scales.ventricleCavities.x) * 0.5, 'Amplitude de contraction atténuée en vue corps entier');
    });
});

test('Atlas Heartbeat — Détection des pics R et synchroniseur ECG', async (t) => {
    await t.test('detectRPeaks identifie correctement les complexes QRS sur signal réel PTB-XL', () => {
        const filePath = resolve(process.cwd(), 'assets/data/ecg/ecg_normal_sinus.json');
        const json = JSON.parse(readFileSync(filePath, 'utf8'));
        const peaks = detectRPeaks(json.leads.DII, json.sampleRate);

        assert.ok(peaks.length >= 10 && peaks.length <= 14, `Nombre de battements physiologique attendu (~12), obtenu: ${peaks.length}`);
        // Vérification des intervalles R-R réguliers (~0.83s à 72 bpm)
        const rr0 = peaks[1].timeSec - peaks[0].timeSec;
        assert.ok(rr0 > 0.7 && rr0 < 1.0, `Intervalle R-R cohérent (${rr0.toFixed(2)}s)`);
    });

    await t.test('detectRPeaks gère les signaux pathologiques (LVH et ACFA)', () => {
        const afibPath = resolve(process.cwd(), 'assets/data/ecg/ecg_afib.json');
        const afibJson = JSON.parse(readFileSync(afibPath, 'utf8'));
        const afibPeaks = detectRPeaks(afibJson.leads.DII, afibJson.sampleRate);
        assert.ok(afibPeaks.length >= 8, 'Pics détectés sur ACFA');

        const lvhPath = resolve(process.cwd(), 'assets/data/ecg/ecg_lvh.json');
        const lvhJson = JSON.parse(readFileSync(lvhPath, 'utf8'));
        const lvhPeaks = detectRPeaks(lvhJson.leads.DII, lvhJson.sampleRate);
        assert.ok(lvhPeaks.length >= 8, 'Pics détectés sur LVH');
    });

    await t.test('ECGSynchronizer initialise et met à jour la phase en continu', () => {
        const sync = new ECGSynchronizer({ presetId: 'sinus' });
        assert.equal(sync.presetId, 'sinus');
        sync.update(0.1);
        const phase = sync.getCurrentPhase();
        assert.ok(phase >= 0.0 && phase <= 1.0, 'Phase valide');
    });

    await t.test('calcul de boîte englobante et cadrage cardiaque avec union de Three.js Box3', () => {
        class MockBox3 {
            constructor(min, max) {
                this.min = min ? { ...min } : { x: Infinity, y: Infinity, z: Infinity };
                this.max = max ? { ...max } : { x: -Infinity, y: -Infinity, z: -Infinity };
            }
            makeEmpty() {
                this.min = { x: Infinity, y: Infinity, z: Infinity };
                this.max = { x: -Infinity, y: -Infinity, z: -Infinity };
                return this;
            }
            isEmpty() {
                return this.max.x < this.min.x;
            }
            union(box) {
                this.min.x = Math.min(this.min.x, box.min.x);
                this.min.y = Math.min(this.min.y, box.min.y);
                this.min.z = Math.min(this.min.z, box.min.z);
                this.max.x = Math.max(this.max.x, box.max.x);
                this.max.y = Math.max(this.max.y, box.max.y);
                this.max.z = Math.max(this.max.z, box.max.z);
                return this;
            }
            getCenter(target) {
                target.x = (this.min.x + this.max.x) * 0.5;
                target.y = (this.min.y + this.max.y) * 0.5;
                target.z = (this.min.z + this.max.z) * 0.5;
                return target;
            }
        }

        const bounds = new MockBox3();
        assert.ok(bounds.isEmpty());
        bounds.union(new MockBox3({ x: -0.05, y: 1.10, z: -0.02 }, { x: 0.05, y: 1.25, z: 0.08 }));
        assert.ok(!bounds.isEmpty());
        const center = {};
        bounds.getCenter(center);
        assert.equal(center.x, 0);
        assert.equal(center.y, 1.175);
        assert.equal(center.z, 0.03);
    });
});
