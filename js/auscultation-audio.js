/**
 * js/auscultation-audio.js — Moteur audio Web Audio API pour le Stéthoscope Virtuel
 *
 * Mode Hybride :
 * - Lecture d'enregistrements réels issus de mannequins cliniques (dataset HLS-CMDS, IEEE 2025)
 * - Normalisation dynamique du volume sonore au décodage
 * - Filtrage stéthoscopique commutable : Cloche (< 160 Hz) vs Membrane (200 - 800 Hz)
 * - Branchement direct dans le graphe Web Audio (MasterGain -> Filter -> Analyser -> Destination)
 * - Fallback instantané et transparent vers la synthèse physique Web Audio en mode hors-ligne
 * - Analyseur temps réel pour le Phonocardiogramme synchrone
 */

class AuscultationAudioEngine {
    constructor() {
        this.ctx = null;
        this.isPlaying = false;
        this.currentCase = null;
        this.currentHotspot = 'apex';
        this.filterMode = 'diaphragm'; // 'bell' ou 'diaphragm'

        // Audio Nodes principaux
        this.masterGain = null;
        this.caseGainNode = null;
        this.filterNode = null;
        this.analyserNode = null;

        // Gestion de l'audio réel
        this.audioBufferCache = new Map(); // url -> AudioBuffer
        this.currentBufferSource = null;
        this.currentLoadedUrl = null;
        this.isRealAudio = false;
        this._playRequestId = 0;
        this.onAudioModeChange = null; // Callback UI (mode: 'real' | 'synth')

        // Timers pour la boucle de synthèse
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

            // Gain spécifique pour les buffers audio réels (permet l'atténuation par foyer)
            this.caseGainNode = this.ctx.createGain();
            this.caseGainNode.gain.value = 1.0;
            this.caseGainNode.connect(this.masterGain);

            // Filtre Stéthoscope
            this.filterNode = this.ctx.createBiquadFilter();
            this._updateFilter();

            // Analyseur Phonocardiogramme
            this.analyserNode = this.ctx.createAnalyser();
            this.analyserNode.fftSize = 512;

            // Graphe audio principal :
            // (Synthèse ou caseGainNode) -> masterGain -> filterNode -> analyserNode -> destination
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

    setVolume(value) {
        if (this.masterGain && this.ctx) {
            const clamped = Math.max(0, Math.min(1.5, Number(value) || 0.85));
            this.masterGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
        }
    }

    playFile(url) {
        this._initContext();
        this._playRequestId++;
        this.isPlaying = true;
        this._startRealAudio(url, this._playRequestId);
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
        if (!this.isPlaying || !this.currentCase) return;

        if (this.isRealAudio) {
            const newUrl = this._getAudioUrlForCase(this.currentCase, hotspotId);
            if (newUrl && newUrl !== this.currentLoadedUrl) {
                // Bascule fluide vers l'enregistrement dédié au foyer
                this._playRequestId++;
                this._startRealAudio(newUrl, this._playRequestId);
            } else {
                // Même fichier en cours : ajuster l'atténuation en douceur
                const isHotspotRecording = !!(this.currentCase?.audioFiles && this.currentCase.audioFiles[hotspotId] === this.currentLoadedUrl);
                const att = isHotspotRecording ? 1.0 : this._getHotspotAttenuation();
                if (this.caseGainNode && this.ctx) {
                    this.caseGainNode.gain.cancelScheduledValues(this.ctx.currentTime);
                    this.caseGainNode.gain.linearRampToValueAtTime(att, this.ctx.currentTime + 0.08);
                }
            }
        }
    }

    hasRealAudio(caseData = this.currentCase) {
        if (!caseData) return false;
        return !!(caseData.audioFiles || caseData.audioFile);
    }

    getAudioMode() {
        return this.isRealAudio ? 'real' : 'synth';
    }

    _getAudioUrlForCase(caseData, hotspotId) {
        if (!caseData) return null;
        if (caseData.audioFiles) {
            if (caseData.audioFiles[hotspotId]) {
                return caseData.audioFiles[hotspotId];
            }
            if (caseData.audioFiles['default']) {
                return caseData.audioFiles['default'];
            }
            if (caseData.optimalHotspot && caseData.audioFiles[caseData.optimalHotspot]) {
                return caseData.audioFiles[caseData.optimalHotspot];
            }
            const values = Object.values(caseData.audioFiles);
            if (values.length > 0) return values[0];
        }
        if (caseData.audioFile) return caseData.audioFile;
        return null;
    }

    /**
     * Charge et décode un fichier WAV de façon asynchrone avec mise en cache et normalisation
     */
    async _loadAudioBuffer(url) {
        if (this.audioBufferCache.has(url)) {
            return this.audioBufferCache.get(url);
        }
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const decodedBuffer = await this.ctx.decodeAudioData(arrayBuffer);

            // Normalisation dynamique du volume sonore
            this._normalizeBuffer(decodedBuffer, 0.85);

            this.audioBufferCache.set(url, decodedBuffer);
            return decodedBuffer;
        } catch (err) {
            console.warn(`[AuscultationAudio] Fichier ${url} inaccessible, bascule synthèse.`, err.message || err);
            return null;
        }
    }

    _normalizeBuffer(buffer, targetPeak = 0.85) {
        const numChannels = buffer.numberOfChannels;
        let maxVal = 0;
        for (let c = 0; c < numChannels; c++) {
            const data = buffer.getChannelData(c);
            for (let i = 0; i < data.length; i++) {
                const abs = Math.abs(data[i]);
                if (abs > maxVal) maxVal = abs;
            }
        }
        if (maxVal > 0.001 && maxVal < 0.7) {
            const factor = Math.min(targetPeak / maxVal, 20.0);
            for (let c = 0; c < numChannels; c++) {
                const data = buffer.getChannelData(c);
                for (let i = 0; i < data.length; i++) {
                    data[i] *= factor;
                }
            }
        }
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
        this._playRequestId++;
        const reqId = this._playRequestId;

        if (this.hasRealAudio(this.currentCase)) {
            const url = this._getAudioUrlForCase(this.currentCase, this.currentHotspot);
            if (url) {
                this._startRealAudio(url, reqId);
                return;
            }
        }

        // Cas sans fichier ou indisponible : démarrage en synthèse
        this._startSynthesis();
    }

    async _startRealAudio(url, requestId) {
        const buffer = await this._loadAudioBuffer(url);
        if (!this.isPlaying || this._playRequestId !== requestId) return;

        if (buffer) {
            this._stopSynthesisLoop();
            this._stopRealAudioSource();

            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;

            const isHotspotRecording = !!(this.currentCase?.audioFiles && this.currentCase.audioFiles[this.currentHotspot] === url);
            const attenuation = isHotspotRecording ? 1.0 : this._getHotspotAttenuation();

            if (this.caseGainNode) {
                this.caseGainNode.gain.cancelScheduledValues(this.ctx.currentTime);
                this.caseGainNode.gain.setValueAtTime(attenuation, this.ctx.currentTime);
                source.connect(this.caseGainNode);
            } else {
                source.connect(this.masterGain);
            }

            source.start(0);
            this.currentBufferSource = source;
            this.currentLoadedUrl = url;
            this.isRealAudio = true;
            if (this.onAudioModeChange) this.onAudioModeChange('real');
        } else {
            // Repli automatique et silencieux sur la synthèse
            this.isRealAudio = false;
            if (this.onAudioModeChange) this.onAudioModeChange('synth');
            this._startSynthesis();
        }
    }

    _stopRealAudioSource() {
        if (this.currentBufferSource) {
            try {
                this.currentBufferSource.stop();
                this.currentBufferSource.disconnect();
            } catch (e) {}
            this.currentBufferSource = null;
        }
        this.currentLoadedUrl = null;
        this.isRealAudio = false;
    }

    _startSynthesis() {
        this._stopSynthesisLoop();
        this._stopRealAudioSource();
        this.isRealAudio = false;
        if (this.onAudioModeChange) this.onAudioModeChange('synth');

        const now = this.ctx.currentTime + 0.05;
        this.nextHeartTime = now;
        this.nextBreathTime = now;
        this._scheduleLoop();
    }

    _stopSynthesisLoop() {
        if (this.heartTimer) {
            clearTimeout(this.heartTimer);
            this.heartTimer = null;
        }
    }

    stop() {
        this.isPlaying = false;
        this._playRequestId++;
        this._stopSynthesisLoop();
        this._stopRealAudioSource();
    }

    _scheduleLoop() {
        if (!this.isPlaying || !this.currentCase) return;

        const now = this.ctx.currentTime;
        const p = this.currentCase.audioParams || {};

        if (this.currentCase.type === 'cardiac') {
            const hr = p.heartRate || 72;
            let cycleDuration = 60 / hr;

            while (this.nextHeartTime < now + 0.4) {
                this._playCardiacCycle(this.nextHeartTime, p);
                // Simulation d'arythmie complète (ACFA) si demandée
                if (p.irregular) {
                    cycleDuration = (60 / hr) * (0.65 + Math.random() * 0.7);
                }
                this.nextHeartTime += cycleDuration;
            }
        } else {
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
        const attenuation = this._getHotspotAttenuation();
        if (attenuation <= 0.05) return;

        const systoleDuration = 0.28;
        const b1Time = t;
        const b2Time = t + systoleDuration;

        let b1Vol = (p.b1Volume || 0.8) * attenuation;
        if (p.irregular) {
            b1Vol *= (0.7 + Math.random() * 0.6); // B1 d'intensité variable en ACFA
        }

        // 1. Bruit B1 (Fermeture AV)
        this._playValveSound(b1Time, p.b1Pitch || 65, 0.08, b1Vol);

        // 2. Bruit B2 (Fermeture Sigmoïdes)
        this._playValveSound(b2Time, p.b2Pitch || 95, 0.06, (p.b2Volume || 0.8) * attenuation);

        // 3. Bruit B3 (Galop protodiastolique)
        if (p.b3 > 0) {
            this._playValveSound(b2Time + 0.14, p.b3Pitch || 45, 0.07, p.b3 * 0.9 * attenuation);
        }

        // 4. Bruit B4 (Galop présystolique)
        if (p.b4 > 0) {
            this._playValveSound(b1Time - 0.09, p.b4Pitch || 50, 0.06, p.b4 * 0.8 * attenuation);
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

        // 7. Frottement Péricardique
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
            const mid = time + duration * 0.45;
            gain.gain.linearRampToValueAtTime(volume * 0.6, mid);
            gain.gain.linearRampToValueAtTime(0.001, time + duration);
        } else if (type === 'holosystolic_plateau') {
            gain.gain.linearRampToValueAtTime(volume * 0.5, time + 0.02);
            gain.gain.setValueAtTime(volume * 0.5, time + duration - 0.03);
            gain.gain.linearRampToValueAtTime(0.001, time + duration);
        } else {
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
    // SYNTHÈSE PULMONAIRE (Murmure, Crépitants, Sibilants, Rhonchi, Frottement, Stridor)
    // ==========================================
    _playRespiratoryCycle(t, p, breathDuration) {
        const attenuation = this._getHotspotAttenuation();
        if (attenuation <= 0.05) return;

        const inspDuration = breathDuration * 0.45;
        const expDuration = breathDuration * 0.55;

        // 1. Murmure Vésiculaire
        const vol = (p.vesicularVolume || 0.6) * attenuation;
        this._playBreathSound(t, inspDuration, vol, 250);
        this._playBreathSound(t + inspDuration, expDuration * 0.5, vol * 0.5, 180);

        // 2. Râles Crépitants (fins ou grossiers)
        if (p.crackles > 0) {
            const crackleStart = t + inspDuration * 0.4;
            const crackleDur = inspDuration * 0.6;
            this._playCrackles(crackleStart, crackleDur, p.crackles * attenuation, p.cracklesDensity || 20, p.cracklesPitch || 1000);
        }

        // 3. Râles Sibilants
        if (p.wheezing > 0) {
            const wheezeStart = t + inspDuration + 0.05;
            const pitches = p.wheezingPitches || [500, 750, 1050];
            this._playWheezes(wheezeStart, expDuration * 0.85, p.wheezing * attenuation, pitches);
        }

        // 4. Stridor Laryngé
        if (p.stridor > 0) {
            this._playStridor(t, inspDuration, p.stridor * attenuation, p.stridorPitch || 850);
        }

        // 5. Râles Bronchiques / Rhonchi (graves, aux 2 temps)
        if (p.rhonchi > 0) {
            this._playRhonchi(t, inspDuration, p.rhonchi * attenuation);
            this._playRhonchi(t + inspDuration, expDuration * 0.7, p.rhonchi * 0.8 * attenuation);
        }

        // 6. Frottement Pleural (va-et-vient)
        if (p.pleuralRub > 0) {
            this._playPleuralRub(t + inspDuration * 0.2, inspDuration * 0.6, p.pleuralRub * attenuation);
            this._playPleuralRub(t + inspDuration + expDuration * 0.1, expDuration * 0.6, p.pleuralRub * 0.75 * attenuation);
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

    _playCrackles(time, duration, volume, density, basePitch = 1000) {
        for (let i = 0; i < density; i++) {
            const clickTime = time + Math.random() * duration;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(basePitch + (Math.random() * 400 - 200), clickTime);

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
        pitches.forEach((f) => {
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

    _playRhonchi(time, duration, volume) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140 + Math.random() * 30, time);
        osc.frequency.linearRampToValueAtTime(125 + Math.random() * 20, time + duration);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 220;
        filter.Q.value = 3.0;

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume * 0.25, time + duration * 0.3);
        gain.gain.linearRampToValueAtTime(0.001, time + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(time);
        osc.stop(time + duration);
    }

    _playPleuralRub(time, duration, volume) {
        if (!this.noiseBuffer || volume <= 0.01) return;

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 420;
        filter.Q.value = 2.0;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume * 0.3, time + duration * 0.4);
        gain.gain.linearRampToValueAtTime(0.001, time + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(time);
        noise.stop(time + duration);
    }

    _getHotspotAttenuation() {
        if (!this.currentCase) return 1.0;
        const opt = this.currentCase.optimalHotspot;
        const cur = this.currentHotspot;

        if (cur === opt) return 1.0;
        if (this.currentCase.secondaryHotspots && this.currentCase.secondaryHotspots.includes(cur)) {
            return 0.65;
        }
        return 0.25;
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
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuscultationAudioEngine };
}
