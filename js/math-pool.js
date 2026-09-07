/**
 * math-pool.js — Object pooling pour calculs 3D sans allocation
 * Supprime les déclenchements brutaux du Garbage Collector (GC pauses de 15-40ms)
 * en réutilisant les vecteurs, boîtes et matrices pendant les calculs d'animation et de rendu.
 */

import * as THREE from 'three';

export class ObjectPool {
    constructor(factoryFn, resetFn, initialSize = 64) {
        this.factory = factoryFn;
        this.reset = resetFn;
        this.pool = new Array(initialSize);
        for (let i = 0; i < initialSize; i++) {
            this.pool[i] = this.factory();
        }
        this.index = 0;
    }

    /**
     * Récupère une instance pré-allouée du pool
     */
    acquire() {
        if (this.index >= this.pool.length) {
            this.pool.push(this.factory());
        }
        return this.pool[this.index++];
    }

    /**
     * Libère toutes les instances empruntées et les réinitialise
     */
    releaseAll() {
        for (let i = 0; i < this.index; i++) {
            if (this.reset) this.reset(this.pool[i]);
        }
        this.index = 0;
    }
}

export const MathPool = {
    v2: new ObjectPool(
        () => new THREE.Vector2(),
        (v) => v.set(0, 0),
        64
    ),
    v3: new ObjectPool(
        () => new THREE.Vector3(),
        (v) => v.set(0, 0, 0),
        128
    ),
    m4: new ObjectPool(
        () => new THREE.Matrix4(),
        (m) => m.identity(),
        32
    ),
    box3: new ObjectPool(
        () => new THREE.Box3(),
        (b) => b.makeEmpty(),
        16
    )
};
