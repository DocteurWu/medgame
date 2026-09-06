/**
 * js/auscultation-audio.js — Moteur audio Web Audio API pour le Stéthoscope Virtuel
 *
 * Caractéristiques :
 * - Fonctionne 100% hors-ligne (zéro fichier externe manquant, zéro latence)
 * - Modélisation physique des bruits cardiaques (B1, B2, B3, B4, souffles éjectionnels / régurgitants)
 * - Modélisation des bruits respiratoires (murmure vésiculaire, crépitants, sibilants, stridor)
 * - Filtre stéthoscopique commutable : Cloche (< 150 Hz) vs Membrane (200 - 800 Hz)
 * - Analyseur temps réel pour le Phonocardiogramme synchrone
 */

class AuscultationAudioEngine {
    constructor() {
        this.ctx = null;
        this.isPlaying = false;
        this.currentCase = null;
        this.currentHotspot = 'apex';
        this.filterMode = 'diaphragm'; // 'bell' ou 'diaphragm'

        // Audio Nodes
        this.masterGain = null;
        this.filterNode = null;
        this.analyserNode = null;

        // Loop Timers
        this.heartTimer = null;
        this.lungTimer = null;
        this.nextHeartTime = 0;
        this.nextBreathTime = 0;

        // Noise buffer partagé
        this.noiseBuffer = null;
    }

    _initContext() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            // Master Gain
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.85;

            // Filtre Stéthoscope
            this.filterNode = this.ctx.createBiquadFilter();
            this._updateFilter();

            // Analyseur Phonocardiogramme
            this.analyserNode = this.ctx.createAnalyser();
            this.analyserNode.fftSize = 512;

            this.masterGain.connect(this.filterNode);
            this.filterNode.connect(this.analyserNode);
            this.analyserNode.connect(this.ctx.destination);

            this._generateNoiseBuffer();
        }

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    _updateFilter() {
        if (!this.filterNode) return;
        if (this.filterMode === 'bell') {
            // Cloche : basses fréquences (B3, B4, roulement mitral)
            this.filterNode.type = 'lowpass';
            this.filterNode.frequency.value = 160;
            this.filterNode.Q.value = 1.0;
        } else {
            // Membrane : filtre passe-bande moyennes/hautes fréquences
            this.filterNode.type = 'bandpass';
            this.filterNode.frequency.value = 350;
            this.filterNode.Q.value = 0.8;
        }
    }

    setFilterMode(mode) {
        this.filterMode = mode;
        this._updateFilter();
    }

    setCase(caseData) {
        this.currentCase = caseData;
        if (this.isPlaying) {
            this.stop();
            this.play();
        }
    }

    setHotspot(hotspotId) {
        this.currentHotspot = hotspotId;
    }

    _generateNoiseBuffer() {
        const bufferSize = this.ctx.sampleRate * 2; // 2 secondes de bruit blanc
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
    }

    play() {
        this._initContext();
        if (this.isPlaying) return;
        this.isPlaying = true;

        const now = this.ctx.currentTime + 0.05;
        this.nextHeartTime = now;
        this.nextBreathTime = now;

        this._scheduleLoop();
    }

    stop() {
        this.isPlaying = false;
        if (this.heartTimer) {
            clearTimeout(this.heartTimer);
            this.heartTimer = null;
        }
    }

    _scheduleLoop() {
        if (!this.isPlaying || !this.currentCase) return;

        const now = this.ctx.currentTime;
        const p = this.currentCase.audioParams;

        if (this.currentCase.type === 'cardiac') {
            // Planifier les battements cardiaques
            const hr = p.heartRate || 72;
            const cycleDuration = 60 / hr;

            while (this.nextHeartTime < now + 0.4) {
                this._playCardiacCycle(this.nextHeartTime, p);
                this.nextHeartTime += cycleDuration;
            }
        } else {
            // Planifier les cycles respiratoires
            const rr = p.respiratoryRate || 16;
            const breathDuration = 60 / rr;

            while (this.nextBreathTime < now + 0.5) {
                this._playRespiratoryCycle(this.nextBreathTime, p, breathDuration);
                this.nextBreathTime += breathDuration;
            }
        }

        this.heartTimer = setTimeout(() => this._scheduleLoop(), 100);
    }

    // ==========================================
    // SYNTHÈSE CARDIAQUE (B1, B2, B3, B4, Souffles)
    // ==========================================
    _playCardiacCycle(t, p) {
        // Atténuation selon le foyer (si on écoute loin du foyer optimal)
        const attenuation = this._getHotspotAttenuation();
        if (attenuation <= 0.05) return;

        const systoleDuration = 0.28; // Durée systole ~280ms
        const b1Time = t;
        const b2Time = t + systoleDuration;

        // 1. Bruit B1 (Fermeture AV) : Tonalité grave ~60 Hz
        this._playValveSound(b1Time, p.b1Pitch || 65, 0.08, (p.b1Volume || 0.8) * attenuation);

        // 2. Bruit B2 (Fermeture Sigmoïdes) : Tonalité plus aiguë ~95 Hz
        this._playValveSound(b2Time, p.b2Pitch || 95, 0.06, (p.b2Volume || 0.8) * attenuation);

        // 3. Bruit B3 (Galop protodiastolique) : ~140ms après B2, très sourd (~45 Hz)
        if (p.b3 > 0) {
            this._playValveSound(b2Time + 0.14, p.b3Pitch || 45, 0.07, p.b3 * 0.9 * attenuation);
        }

        // 4. Bruit B4 (Galop présystolique) : ~90ms avant B1
        if (p.b4 > 0) {
            this._playValveSound(b1Time - 0.09, 50, 0.06, p.b4 * 0.8 * attenuation);
        }

        // 5. Souffle Systolique
        if (p.systolicMurmur > 0) {
            this._playMurmur(b1Time + 0.03, systoleDuration - 0.04, p.systolicMurmur * attenuation, p.systolicMurmurType, p.systolicFilter || 500);
        }

        // 6. Souffle Diastolique
        if (p.diastolicMurmur > 0) {
            const diastoleDur = 0.45;
            this._playMurmur(b2Time + 0.02, diastoleDur, p.diastolicMurmur * attenuation, p.diastolicMurmurType || 'decrescendo', p.diastolicFilter || 700);
        }

        // 7. Frottement Péricardique (Va-et-vient systolo-diastolique)
        if (p.rub > 0) {
            this._playPericardialRub(b1Time, systoleDuration, p.rub * attenuation);
            this._playPericardialRub(b2Time + 0.05, 0.25, p.rub * 0.8 * attenuation);
        }
    }

    _playValveSound(time, freq, duration, volume) {
        if (volume <= 0.01) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.6, time + duration);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(time);
        osc.stop(time + duration);
    }

    _playMurmur(time, duration, volume, type, filterFreq) {
        if (!this.noiseBuffer || volume <= 0.01) return;

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = filterFreq;
        filter.Q.value = 1.2;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, time);

        if (type === 'ejection_diamond') {
            // Losange (crescendo - decrescendo)
            const mid = time + duration * 0.45;
            gain.gain.linearRampToValueAtTime(volume * 0.6, mid);
            gain.gain.linearRampToValueAtTime(0.001, time + duration);
        } else if (type === 'holosystolic_plateau') {
            // Plateau holosystolique
            gain.gain.linearRampToValueAtTime(volume * 0.5, time + 0.02);
            gain.gain.setValueAtTime(volume * 0.5, time + duration - 0.03);
            gain.gain.linearRampToValueAtTime(0.001, time + duration);
        } else {
            // Decrescendo (Insuffisance aortique)
            gain.gain.setValueAtTime(volume * 0.55, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        }

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(time);
        noise.stop(time + duration);
    }

    _playPericardialRub(time, duration, volume) {
        if (!this.noiseBuffer || volume <= 0.01) return;

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 450;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume * 0.4, time + duration * 0.3);
        gain.gain.linearRampToValueAtTime(0.001, time + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(time);
        noise.stop(time + duration);
    }

    // ==========================================
    // SYNTHÈSE PULMONAIRE (Murmure, Crépitants, Sibilants, Stridor)
    // ==========================================
    _playRespiratoryCycle(t, p, breathDuration) {
        const attenuation = this._getHotspotAttenuation();
        if (attenuation <= 0.05) return;

        const inspDuration = breathDuration * 0.45; // 45% inspiration
        const expDuration = breathDuration * 0.55;  // 55% expiration

        // 1. Murmure Vésiculaire
        const vol = (p.vesicularVolume || 0.6) * attenuation;
        this._playBreathSound(t, inspDuration, vol, 250); // Inspi
        this._playBreathSound(t + inspDuration, expDuration * 0.5, vol * 0.5, 180); // Début expi

        // 2. Râles Crépitants (fin d'inspiration)
        if (p.crackles > 0) {
            const crackleStart = t + inspDuration * 0.5;
            const crackleDur = inspDuration * 0.5;
            this._playCrackles(crackleStart, crackleDur, p.crackles * attenuation, p.cracklesDensity || 20);
        }

        // 3. Râles Sibilants (expiration prolongée)
        if (p.wheezing > 0) {
            const wheezeStart = t + inspDuration + 0.05;
            const pitches = p.wheezingPitches || [500, 750, 1050];
            this._playWheezes(wheezeStart, expDuration * 0.85, p.wheezing * attenuation, pitches);
        }

        // 4. Stridor Laryngé (inspiration aiguë)
        if (p.stridor > 0) {
            this._playStridor(t, inspDuration, p.stridor * attenuation, p.stridorPitch || 850);
        }
    }

    _playBreathSound(time, duration, volume, freq) {
        if (!this.noiseBuffer || volume <= 0.01) return;

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = freq;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume * 0.35, time + duration * 0.5);
        gain.gain.linearRampToValueAtTime(0.001, time + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(time);
        noise.stop(time + duration);
    }

    _playCrackles(time, duration, volume, density) {
        for (let i = 0; i < density; i++) {
            const clickTime = time + Math.random() * duration;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800 + Math.random() * 600, clickTime);

            gain.gain.setValueAtTime(0, clickTime);
            gain.gain.linearRampToValueAtTime(volume * 0.35, clickTime + 0.002);
            gain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.015);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(clickTime);
            osc.stop(clickTime + 0.02);
        }
    }

    _playWheezes(time, duration, volume, pitches) {
        pitches.forEach((f, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(f + (Math.random() * 20 - 10), time);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = f;
            filter.Q.value = 6.0;

            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(volume * 0.15, time + duration * 0.3);
            gain.gain.linearRampToValueAtTime(0.001, time + duration);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            osc.start(time);
            osc.stop(time + duration);
        });
    }

    _playStridor(time, duration, volume, freq) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = freq;
        filter.Q.value = 4.0;

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume * 0.35, time + duration * 0.4);
        gain.gain.linearRampToValueAtTime(0.001, time + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(time);
        osc.stop(time + duration);
    }

    _getHotspotAttenuation() {
        if (!this.currentCase) return 1.0;
        const opt = this.currentCase.optimalHotspot;
        const cur = this.currentHotspot;

        if (cur === opt) return 1.0; // Intensité maximale
        if (this.currentCase.secondaryHotspots && this.currentCase.secondaryHotspots.includes(cur)) {
            return 0.65; // Irradiation ou foyer secondaire
        }
        return 0.25; // Entendu de loin / foyer éloigné
    }

    /**
     * Récupère le signal audio temporel pour l'oscillogramme / phonocardiogramme
     */
    getWaveform() {
        if (!this.analyserNode || !this.isPlaying) return new Uint8Array(128).fill(128);
        const data = new Uint8Array(this.analyserNode.frequencyBinCount);
        this.analyserNode.getByteTimeDomainData(data);
        return data;
    }
}

if (typeof window !== 'undefined') {
    window.AuscultationAudioEngine = AuscultationAudioEngine;
}
