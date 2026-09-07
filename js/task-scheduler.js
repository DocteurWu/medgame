/**
 * task-scheduler.js — Ordonnanceur de tâches coopératif et Time-slicer (requestIdleCallback)
 * Permet de fractionner les initialisations lourdes (maillage, buffers, matériaux)
 * en tranches de temps strictes (< 8ms par frame) pour ne jamais geler l'affichage.
 */

export class TaskScheduler {
    /**
     * Exécute une série de fonctions sous forme de batch time-slicé.
     * @param {Array<Function>} tasks - Liste de fonctions exécutables
     * @param {number} [maxBudgetMs=8] - Temps maximum alloué par frame (ms)
     * @param {Function} [onProgress] - Callback de progression (ratio 0..1)
     * @returns {Promise<void>}
     */
    static runBatched(tasks, maxBudgetMs = 8, onProgress = null) {
        if (!tasks || tasks.length === 0) return Promise.resolve();

        return new Promise((resolve) => {
            let cursor = 0;
            const total = tasks.length;

            function processSlice(deadline) {
                const startTime = performance.now();

                while (cursor < total) {
                    // Vérification de la disponibilité du temps dans la frame courante
                    const hasIdleTime = deadline ? deadline.timeRemaining() > 1 : (performance.now() - startTime < maxBudgetMs);
                    if (!hasIdleTime && (performance.now() - startTime >= maxBudgetMs)) {
                        break;
                    }

                    try {
                        tasks[cursor]();
                    } catch (err) {
                        console.error('[TaskScheduler] Erreur tâche à index ' + cursor, err);
                    }
                    cursor++;

                    if (onProgress) {
                        try { onProgress(cursor / total); } catch {}
                    }
                }

                if (cursor < total) {
                    // Planifie la tranche suivante au prochain intervalle inoccupé
                    if (typeof requestIdleCallback !== 'undefined') {
                        requestIdleCallback(processSlice, { timeout: 100 });
                    } else {
                        setTimeout(() => processSlice(null), 16);
                    }
                } else {
                    resolve();
                }
            }

            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(processSlice, { timeout: 100 });
            } else {
                setTimeout(() => processSlice(null), 16);
            }
        });
    }

    /**
     * Préchauffe et compile les shaders d'une scène sur le GPU de manière non bloquante.
     * Élimine le micro-stutter de 100-250ms à la première frame de rendu.
     * @param {THREE.WebGLRenderer} renderer 
     * @param {THREE.Scene} scene 
     * @param {THREE.Camera} camera 
     * @returns {Promise<void>}
     */
    static async warmupShaders(renderer, scene, camera) {
        if (!renderer || !scene || !camera) return;

        try {
            if (typeof renderer.compileAsync === 'function') {
                await renderer.compileAsync(scene, camera);
            } else if (typeof renderer.compile === 'function') {
                renderer.compile(scene, camera);
            }
        } catch (err) {
            console.warn('[TaskScheduler] Erreur warmup shaders:', err);
        }
    }
}
