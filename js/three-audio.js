/**
 * three-audio.js — Système audio immersif pour MedGame 3D
 * Battements cardiaques synchronisés FC, alarmes urgence, sons d'instruments
 * 
 * Utilise Web Audio API — pas de fichiers externes nécessaires
 */

export class MedicalAudio {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this._initialized = false;
        this._muted = localStorage.getItem('medgame.audio.muted') === 'true';
        this._volume = 0.6;

        // Sources actives
        this._heartbeatInterval = null;
        this._alarmInterval = null;
        this._lastHeartRate = 72;
        this._alarmActive = false;
        this._ecgBeepActive = false;

        // Filtres
        this._lowpassFilter = null;
    }

    /** Initialiser le contexte audio (doit être appelé après un geste utilisateur) */
    init() {
        if (this._initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this._volume;
            this.masterGain.connect(this.ctx.destination);

            // Filtre low-pass pour le warm-up du son
            this._lowpassFilter = this.ctx.createBiquadFilter();
            this._lowpassFilter.type = 'lowpass';
            this._lowpassFilter.frequency.value = 2000;
            this._lowpassFilter.connect(this.masterGain);

            this._initialized = true;
        } catch (e) {
            console.warn('[MedicalAudio] Web Audio API non disponible:', e);
        }
    }

    /** Reprendre le contexte si suspendu (nécessite un geste utilisateur) */
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setVolume(v) {
        this._volume = Math.max(0, Math.min(1, v));
        if (this.masterGain) this.masterGain.gain.value = this._volume;
    }

    mute() { this._muted = true; if (this.masterGain) this.masterGain.gain.value = 0; }
    unmute() { this._muted = false; if (this.masterGain) this.masterGain.gain.value = this._volume; }

    // ==================== BATTEMENTS CARDIAQUES ====================

    /**
     * Démarrer le son de battement cardiaque synchronisé avec la FC
     * @param {number} heartRate — battements par minute
     */
    startHeartbeat(heartRate = 72) {
        this.stopHeartbeat();
        if (!this._initialized) this.init();
        if (!this.ctx) return;

        this._lastHeartRate = heartRate;
        this._scheduleHeartbeat();
    }

    _scheduleHeartbeat() {
        if (this._heartbeatInterval) clearTimeout(this._heartbeatInterval);

        const intervalMs = (60 / this._lastHeartRate) * 1000;
        this._playHeartbeat();

        this._heartbeatInterval = setTimeout(() => {
            this._scheduleHeartbeat();
        }, intervalMs);
    }

    /** Joue un battement cardiaque (bip bip) */
    _playHeartbeat() {
        if (!this.ctx || this._muted) return;
        const now = this.ctx.currentTime;

        // Son 1: "Lub" (basse fréquence)
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.value = 55;
        gain1.gain.setValueAtTime(0.25, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc1.connect(gain1);
        gain1.connect(this._lowpassFilter);
        osc1.start(now);
        osc1.stop(now + 0.15);

        // Son 2: "Dub" (fréquence plus haute, plus faible, légèrement décalé)
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = 80;
        gain2.gain.setValueAtTime(0, now + 0.08);
        gain2.gain.setValueAtTime(0.15, now + 0.09);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
        osc2.connect(gain2);
        gain2.connect(this._lowpassFilter);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.22);
    }

    /** Mettre à jour la fréquence cardiaque en temps réel */
    updateHeartRate(bpm) {
        if (bpm !== this._lastHeartRate && bpm > 0) {
            this._lastHeartRate = bpm;
            // Le prochain battement sera recalé avec la nouvelle FC
        }
    }

    stopHeartbeat() {
        if (this._heartbeatInterval) {
            clearTimeout(this._heartbeatInterval);
            this._heartbeatInterval = null;
        }
    }

    // ==================== BIP ECG ====================

    /**
     * Bip ECG synchronisé — un bip court à chaque battement
     * Plus clinique et discret que le battement cardiaque
     */
    startECGBeep(heartRate = 72) {
        this.stopECGBeep();
        if (!this._initialized) this.init();
        if (!this.ctx) return;

        this._lastHeartRate = heartRate;
        this._ecgBeepActive = true;
        this._scheduleECGBeep();
    }

    _scheduleECGBeep() {
        if (!this._ecgBeepActive) return;
        const intervalMs = (60 / this._lastHeartRate) * 1000;
        this._playECGBeep();
        this._heartbeatInterval = setTimeout(() => {
            this._scheduleECGBeep();
        }, intervalMs);
    }

    _playECGBeep() {
        if (!this.ctx || this._muted) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880; // La4 — bip médical standard
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.08);
    }

    stopECGBeep() {
        this._ecgBeepActive = false;
        if (this._heartbeatInterval) {
            clearTimeout(this._heartbeatInterval);
            this._heartbeatInterval = null;
        }
    }

    // ==================== ALARMES URGENCE ====================

    /**
     * Démarre l'alarme urgence (bip alterné haute/basse fréquence)
     * @param {string} level — 'warning' (bip lent) ou 'critical' (bip rapide)
     */
    startAlarm(level = 'warning') {
        this.stopAlarm();
        if (!this._initialized) this.init();
        if (!this.ctx) return;

        this._alarmActive = true;
        const intervalMs = level === 'critical' ? 400 : 1000;
        const freqLow = level === 'critical' ? 600 : 440;
        const freqHigh = level === 'critical' ? 1200 : 880;
        let highNext = true;

        this._alarmInterval = setInterval(() => {
            if (!this._alarmActive || !this.ctx) return;
            const now = this.ctx.currentTime;
            const freq = highNext ? freqHigh : freqLow;
            highNext = !highNext;

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.18);
        }, intervalMs);
    }

    stopAlarm() {
        this._alarmActive = false;
        if (this._alarmInterval) {
            clearInterval(this._alarmInterval);
            this._alarmInterval = null;
        }
    }

    // ==================== SONS D'INSTRUMENTS ====================

    /** Son de mesure d'instrument (bip court Confirmation) */
    playMeasureSound() {
        if (!this.ctx || this._muted) return;
        const now = this.ctx.currentTime;

        // Double bip de confirmation
        for (let i = 0; i < 2; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 1200 + i * 200;
            gain.gain.setValueAtTime(0.06, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.08);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.1);
        }
    }

    /** Son d'ouverture de cadenas (défi réussi) */
    playUnlockSound() {
        if (!this.ctx || this._muted) return;
        const now = this.ctx.currentTime;

        // Accord ascendant C-E-G
        const freqs = [523, 659, 784];
        freqs.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.1, now + i * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.25);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now + i * 0.12);
            osc.stop(now + i * 0.12 + 0.3);
        });
    }

    /** Son d'erreur (défi échoué) */
    playErrorSound() {
        if (!this.ctx || this._muted) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 200;
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.35);
    }

    /** Son de succès (bon diagnostic/traitement) */
    playSuccessSound() {
        if (!this.ctx || this._muted) return;
        const now = this.ctx.currentTime;

        // Accord majeur ascendant
        const freqs = [440, 554, 659, 880];
        freqs.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.07, now + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now + i * 0.08);
            osc.stop(now + i * 0.08 + 0.25);
        });
    }

    /** Nettoyer tous les sons */
    destroy() {
        this.stopHeartbeat();
        this.stopECGBeep();
        this.stopAlarm();
        if (this.ctx) {
            this.ctx.close();
            this.ctx = null;
        }
        this._initialized = false;
    }
}

// Singleton global
export const medicalAudio = new MedicalAudio();
window.medicalAudio = medicalAudio;