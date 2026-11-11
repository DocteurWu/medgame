/**
 * test/clinical-exam-station.test.mjs — Validation de la Table d'Examen Clinique Interactive
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve('.');

function loadModuleInContext(filePath, extraGlobals = {}) {
    const code = fs.readFileSync(path.join(ROOT, filePath), 'utf8');
    const listeners = {};
    const sandbox = {
        window: { ...extraGlobals },
        document: {
            createElement: () => ({
                setAttribute: () => {},
                addEventListener: () => {},
                querySelector: () => null,
                querySelectorAll: () => [],
                appendChild: () => {},
                classList: { add: () => {}, remove: () => {} }
            }),
            body: { appendChild: () => {} },
            getElementById: () => null,
            addEventListener: (evt, cb) => {
                listeners[evt] = listeners[evt] || [];
                listeners[evt].push(cb);
            },
            dispatchEvent: (evt) => {
                const list = listeners[evt.type] || [];
                list.forEach(cb => cb(evt));
            }
        },
        console,
        ...extraGlobals
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return { sandbox, listeners };
}

describe('Table d’Examen Clinique Interactive (js/clinical-exam-station.js)', () => {
    test('Le module ClinicalExamStation est exposé avec son catalogue d’appareils', () => {
        const { sandbox } = loadModuleInContext('js/clinical-exam-station.js');
        const Station = sandbox.window.ClinicalExamStation;
        assert.ok(Station, 'ClinicalExamStation doit être défini');
        assert.ok(Array.isArray(Station.APPAREILS), 'La liste des appareils doit être un tableau');
        assert.equal(Station.APPAREILS.length, 7, '7 appareils anatomiques complets');

        const cardio = Station.APPAREILS.find(a => a.id === 'examenCardiovasculaire');
        assert.ok(cardio, 'Appareil cardiovasculaire présent');
        assert.equal(cardio.hasAudio, true);

        const neuro = Station.APPAREILS.find(a => a.id === 'examenNeurologique');
        assert.ok(neuro, 'Appareil neurologique présent');
    });

    test('L’auscultation cardiaque initialise le stéthoscope avec souffle si présent', () => {
        let appliedMurmur = null;
        let stethoActive = false;

        const mockMedical = {
            applyVitals: (v) => { if (v && v.murmur) appliedMurmur = v.murmur; },
            setStethoscope: (val) => { stethoActive = val; },
            startHeartbeat: () => {},
            stopHeartbeat: () => {},
            startBreathing: () => {},
            stopBreathing: () => {}
        };

        const mockCase = {
            examenClinique: {
                examenCardiovasculaire: {
                    auscultation: 'Souffle systolique râpeux au foyer aortique'
                }
            }
        };

        const { sandbox } = loadModuleInContext('js/clinical-exam-station.js', {
            MedGameMedical: mockMedical,
            gameState: { currentCase: mockCase }
        });

        const Station = sandbox.window.ClinicalExamStation;
        Station.performExam('examenCardiovasculaire');

        assert.equal(stethoActive, true, 'Le stéthoscope doit être activé');
        assert.equal(appliedMurmur, 'systolique', 'Le souffle systolique doit être transmis au moteur audio');
    });

    test('Le catalogue des foyers HOTSPOTS est complet et branché aux fichiers audio réels', async () => {
        let loopedUrl = null;
        let loopOptions = null;
        let stopped = false;

        const mockSound = {
            loop: async (url, opts) => {
                loopedUrl = url;
                loopOptions = opts;
                return {
                    stop: () => { stopped = true; }
                };
            }
        };

        const mockCase = {
            audioFiles: {
                aortique: 'assets/audio/auscultation/heart/M_ESM_RUSB.wav',
                apex: 'assets/audio/auscultation/heart/F_MSM_A.wav'
            },
            examenClinique: {
                examenCardiovasculaire: {
                    auscultation: 'Souffle systolique au foyer aortique'
                }
            }
        };

        const { sandbox } = loadModuleInContext('js/clinical-exam-station.js', {
            MedGameSound: mockSound,
            gameState: { currentCase: mockCase }
        });

        const Station = sandbox.window.ClinicalExamStation;
        assert.ok(Station.HOTSPOTS, 'HOTSPOTS doit être exposé');
        assert.equal(Station.HOTSPOTS.cardio.length, 4, '4 foyers cardiaques classiques');
        assert.equal(Station.HOTSPOTS.pulmo.length, 2, '2 zones pulmonaires');

        await Station.startStethoscope('cardio', 'aortique');
        assert.equal(loopedUrl, 'assets/audio/auscultation/heart/M_ESM_RUSB.wav', 'Le fichier audio aortique doit être joué');
        assert.equal(loopOptions.bus, 'auscultation', 'Le bus de routage doit être auscultation');

        Station.stopStethoscope();
        assert.equal(stopped, true, 'Le stéthoscope arrêté doit couper la poignée audio');
    });
});
