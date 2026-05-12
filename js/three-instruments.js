import * as THREE from 'three';
import { box, createMaterial } from './three-room.js';
import { pulseEmissive } from './three-animations.js';

const INSTRUMENTS = [
    { id: 'tensiometer', label: 'Tensiometre', x: -1.55, z: -0.78, key: 'tension', title: 'TA' },
    { id: 'oximeter', label: 'Oxymetre', x: -1.05, z: -0.78, key: 'saturationO2', title: 'SpO2' },
    { id: 'thermometer', label: 'Thermometre', x: -0.55, z: -0.78, key: 'temperature', title: 'T' },
    { id: 'glucometer', label: 'Glucometre', x: -0.05, z: -0.78, key: 'glycemie', title: 'Glycemie' },
    { id: 'tablet', label: 'Tablette prescription', x: 0.45, z: -0.78, key: 'tablet', title: 'Rx' }
];

export class ThreeInstruments {
    constructor(scene) {
        this.scene = scene;
        this.meshes = new Map();
        this.build();
    }

    build() {
        INSTRUMENTS.forEach((item, index) => {
            const mat = createMaterial(index === 4 ? 0x101820 : 0x1e3555, { emissive: index === 4 ? 0x003366 : 0x000000, emissiveIntensity: index === 4 ? 0.25 : 0 });
            const mesh = box(this.scene, { x: 0.26, y: 0.08, z: 0.18 }, { x: item.x, y: 0.91, z: item.z }, mat, item.label, true);
            mesh.userData.instrument = item;
            this.meshes.set(item.id, mesh);
        });
    }

    getByObject(object) {
        return object?.userData?.instrument || null;
    }

    showMeasurement(instrument, caseData) {
        if (!instrument || instrument.key === 'tablet') return null;
        const constants = caseData?.examenClinique?.constantes || {};
        const aliases = {
            glycemie: constants.glycemie || constants.glycémie || constants.glycemieCapillaire,
            saturationO2: constants.saturationO2 || constants.spo2 || constants.SpO2
        };
        const value = aliases[instrument.key] || constants[instrument.key] || '--';
        const mesh = this.meshes.get(instrument.id);
        pulseEmissive(mesh, 1.5);
        return { label: instrument.title, value };
    }
}

