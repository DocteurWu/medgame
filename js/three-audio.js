/**
 * three-audio.js — Pont entre la couche médicale et le code 3D
 *
 * Ce fichier contenait jusqu'ici une deuxième implémentation du son : sa
 * propre classe `MedicalAudio`, son PROPRE AudioContext, son propre
 * compresseur, et — le vrai bug — les mêmes clés localStorage que
 * js/audio.js avec un défaut différent (0.60 contre 0.30). Les deux modules
 * se marchaient dessus.
 *
 * Il ne reste ici que la forme attendue par le code 3D :
 * js/three-scene.js, js/three-manager.js, js/three-clinical-agent.js,
 * js/clinicalAgentAI.js et js/game.js appellent `medicalAudio.*`.
 *
 * La forme est inchangée, y compris `playAlert()` qui était appelé par
 * js/three-scene.js:115 sans avoir jamais existé sur la classe : l'appel
 * était silencieusement sans effet.
 *
 * Ce module ne crée plus aucun AudioContext : tout passe par
 * window.MedGameSound, ce qui garantit le contexte unique.
 *
 * Note : ce fichier est un module ES (importé par js/three-scene.js) alors
 * que audio-core.js / audio-medical.js sont des scripts classiques. C'est
 * volontaire : les ~100 sites d'appel de jeu utilisent `<script defer>`, il
 * fallait donc un point d'entrée synchrone. Un module lit simplement le
 * global, ce qui évite d'instancier deux fois le moteur.
 */

const medical = (typeof window !== 'undefined' ? window.MedGameMedical : undefined);

if (!medical) {
    console.warn('[three-audio] js/audio-medical.js absent — la couche 3D sera muette');
}

/**
 * Repli neutre, utilisé quand `js/audio-medical.js` n'est pas chargé (page
 * ouverte seule, ordre de script modifié, import anticipé du module 3D).
 *
 * Indispensable : `window.medicalAudio` vaut parfois `undefined` dans ce cas,
 * et `js/game.js` appelle `window.medicalAudio.playSuccessSound()` sans
 * tester. Un stub inerte est sans risque ; un `undefined` provoque une
 * TypeError en plein jeu.
 */
const INERTE = {
    _unavailable: true,
    init: () => false,
    resume() { },
    reset() { },
    destroy() { },
    applyVitals() { },
    getVitals: () => null,
    setStethoscope() { },
    isStethoscopeOn: () => false,
    startHeartbeat: () => false,
    stopHeartbeat() { },
    updateHeartRate() { },
    isHeartbeatRunning: () => false,
    playSingleBeat() { },
    startECGBeep: () => false,
    stopECGBeep() { },
    startBreathing: () => false,
    stopBreathing() { },
    startAlarm: () => false,
    stopAlarm() { },
    getAlarm: () => null,
    setVolume() { },
    mute() { },
    unmute() { },
    playMeasureSound() { },
    playUnlockSound() { },
    playErrorSound() { },
    playSuccessSound() { },
    playAlert() { }
};

const couche = medical || INERTE;

/**
 * @deprecated Préférence : `MedGameMedical` (window.MedGameMedical).
 * Conservé parce que `import { medicalAudio } from './three-audio.js'` est
 * utilisé dans plusieurs modules 3D.
 */
export class MedicalAudio {
    constructor() {
        this._impl = couche;
    }

    init() { return this._impl.init(); }
    resume() { this._impl.resume(); }
    setVolume(v) { this._impl.setVolume(v); }
    mute() { this._impl.mute(); }
    unmute() { this._impl.unmute(); }

    startHeartbeat(bpm) { return this._impl.startHeartbeat(bpm); }
    stopHeartbeat() { this._impl.stopHeartbeat(); }
    updateHeartRate(bpm) { this._impl.updateHeartRate(bpm); }
    isHeartbeatRunning() { return this._impl.isHeartbeatRunning(); }
    playSingleBeat() { this._impl.playSingleBeat(); }

    startECGBeep(bpm) { return this._impl.startECGBeep(bpm); }
    stopECGBeep() { this._impl.stopECGBeep(); }

    startBreathing(rr) { return this._impl.startBreathing(rr); }
    stopBreathing() { this._impl.stopBreathing(); }

    startAlarm(level) { return this._impl.startAlarm(level); }
    stopAlarm() { this._impl.stopAlarm(); }

    applyVitals(v) { this._impl.applyVitals(v); }
    getVitals() { return this._impl.getVitals(); }
    setStethoscope(on) { this._impl.setStethoscope(on); }

    playMeasureSound() { this._impl.playMeasureSound(); }
    playUnlockSound() { this._impl.playUnlockSound(); }
    playErrorSound() { this._impl.playErrorSound(); }
    playSuccessSound() { this._impl.playSuccessSound(); }
    playAlert() { this._impl.playAlert(); }

    /**
     * Réinitialise la couche patient. On ne détruit plus le AudioContext :
     * il est partagé avec le reste du jeu, et js/three-scene.js l'appelait à
     * chaque changement de cas, ce qui fermait le son des autres modules.
     */
    destroy() { this._impl.reset(); }
}

export const medicalAudio = new MedicalAudio();

if (typeof window !== 'undefined') {
    // `window.medicalAudio` pointe sur la couche médicale RÉELLE (et non plus
    // sur cette mince enveloppe), pour que le code qui l'utilise comme global
    // accède à toute l'API. En son absence, on expose le stub inerte.
    window.medicalAudio = couche;
}
