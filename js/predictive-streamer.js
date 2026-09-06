/**
 * predictive-streamer.js — Moteur de streaming prédictif d'assets en arrière-plan
 * Analyse l'état clinique actuel, anticipe les choix du joueur et charge
 * silencieusement les assets 3D et imageries sans impacter la boucle de rendu.
 */

import { offlineAssetCache } from './offline-asset-cache.js';

export class PredictiveStreamer {
    constructor() {
        this._queue = [];
        this._isProcessing = false;
        this._inFlight = new Set();
        this._prefetchedUrls = new Set();
    }

    /**
     * Enfile une liste d'URLs d'assets à précharger avec priorité.
     * @param {Array<{url: string, priority?: number}>} assets
     */
    enqueue(assets = []) {
        for (const item of assets) {
            if (!item?.url || this._prefetchedUrls.has(item.url) || this._inFlight.has(item.url)) {
                continue;
            }
            this._queue.push({
                url: item.url,
                priority: item.priority ?? 10
            });
        }

        // Tri par priorité décroissante (plus petit chiffre = plus prioritaire)
        this._queue.sort((a, b) => a.priority - b.priority);
        this.processQueue();
    }

    /**
     * Anticipe les assets nécessaires pour un cas clinique donné.
     * @param {Object} caseData - Données JSON du cas clinique
     */
    predictForCase(caseData) {
        if (!caseData) return;
        const candidateAssets = [];

        // 1. Modèle 3D du patient Kenney (Priorité 1)
        const patient = caseData.patient || {};
        if (patient.model3D) {
            candidateAssets.push({ url: `assets/models/patients/${patient.model3D}`, priority: 1 });
        } else {
            const gender = (patient.sexe || 'M').toUpperCase();
            const isFemale = gender === 'F' || gender === 'FEMME';
            const age = patient.age !== undefined ? parseInt(patient.age) : 40;
            let variant = 'a';
            if (age < 30) {
                variant = (patient.prenom || 'Jean').length % 2 === 0 ? 'a' : 'b';
            } else if (age < 60) {
                variant = (patient.prenom || 'Jean').length % 2 === 0 ? 'c' : 'd';
            } else {
                variant = (patient.prenom || 'Jean').length % 2 === 0 ? 'e' : 'f';
            }
            const glbPath = isFemale
                ? `assets/models/patients/character-female-${variant}.glb`
                : `assets/models/patients/character-male-${variant}.glb`;
            candidateAssets.push({ url: glbPath, priority: 1 });
        }

        // 2. Modèle 3D du docteur (Priorité 1)
        try {
            const savedProfile = localStorage.getItem('medgame_profile');
            let docGender = 'M';
            if (savedProfile) {
                const parsed = JSON.parse(savedProfile);
                if (parsed?.sexe) docGender = parsed.sexe;
            }
            const docFile = docGender.toUpperCase() === 'F' ? 'femme.glb' : 'homme.glb';
            candidateAssets.push({ url: `assets/models/doctors/${docFile}`, priority: 1 });
        } catch {}

        // 3. Détecter les images médicales éventuelles (ECG, radios, scanners)
        const caseStr = JSON.stringify(caseData);
        const imageMatches = caseStr.match(/assets\/images\/[^\"]+\.(?:png|jpg|jpeg|webp|svg)/gi) || [];
        for (const imgUrl of imageMatches) {
            candidateAssets.push({ url: imgUrl, priority: 3 });
        }

        this.enqueue(candidateAssets);
    }

    /**
     * Consomme la file de préchargement en arrière-plan sans bloquer le rendu.
     */
    async processQueue() {
        if (this._isProcessing || this._queue.length === 0) return;
        this._isProcessing = true;

        while (this._queue.length > 0) {
            const item = this._queue.shift();
            if (this._prefetchedUrls.has(item.url) || this._inFlight.has(item.url)) continue;

            this._inFlight.add(item.url);
            try {
                // Utilisation du cache persistant
                await offlineAssetCache.getOrFetchBlob(item.url);
                this._prefetchedUrls.add(item.url);
            } catch (err) {
                console.warn(`[PredictiveStreamer] Échec préchargement ${item.url}:`, err);
            } finally {
                this._inFlight.delete(item.url);
            }

            // Yield coopératif pour laisser respirer le thread d'exécution
            await new Promise(resolve => setTimeout(resolve, 60));
        }

        this._isProcessing = false;
    }
}

export const predictiveStreamer = new PredictiveStreamer();
