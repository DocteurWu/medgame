/**
 * three-ecos-session.js
 * 
 * Session ECOS : chrono de station, hygiène des mains, journal horodaté
 * → alimente le débriefing et la grille de cotation.
 */
export class EcosSession {
    constructor({ durationSec = 480, warnAtSec = 60, onTick, onPhase, onEvent } = {}) {
        this.durationSec = durationSec;
        this.warnAtSec = warnAtSec;
        this.remaining = durationSec;
        this.running = false;
        this.log = [];
        this.handsClean = false;
        this.contactWithoutHygiene = 0;
        this.completedItems = new Set();
        this._warned = false;
        this.onTick = onTick;
        this.onPhase = onPhase;
        this.onEvent = onEvent;
    }

    start() {
        this.running = true;
        this.remaining = this.durationSec;
        this._warned = false;
        this.record('station_start');
    }

    pause() {
        this.running = false;
    }

    resume() {
        this.running = true;
    }

    update(dt) {
        if (!this.running) return;
        this.remaining = Math.max(0, this.remaining - dt);
        this.onTick?.(this.remaining, this.durationSec);
        if (!this._warned && this.remaining <= this.warnAtSec) {
            this._warned = true;
            this.onPhase?.('warning');
        }
        if (this.remaining === 0) {
            this.running = false;
            this.onPhase?.('timeup');
            this.record('station_end');
        }
    }

    /** Journalise une action (id de point anatomique, instrument, question…). */
    record(action, meta = {}) {
        const entry = {
            t: +(this.durationSec - this.remaining).toFixed(1),
            action,
            ...meta
        };
        this.log.push(entry);
        this.onEvent?.(entry);
        return entry;
    }

    washHands() {
        this.handsClean = true;
        this.record('hygiene_mains');
    }

    /** À appeler avant tout contact patient : renvoie false si faute d'asepsie. */
    requireHygiene(pointId) {
        if (this.handsClean) return true;
        this.contactWithoutHygiene++;
        this.record('faute_asepsie', { pointId });
        return false;
    }

    complete(itemId) {
        this.completedItems.add(itemId);
    }

    /** Score brut et résumé exploitable par la grille d'évaluation. */
    summary() {
        return {
            durationUsed: +(this.durationSec - this.remaining).toFixed(1),
            itemsCompleted: [...this.completedItems],
            hygieneRespected: this.contactWithoutHygiene === 0,
            asepsisFaults: this.contactWithoutHygiene,
            timeline: this.log,
        };
    }
}
