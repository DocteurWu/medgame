/**
 * three-scope.js — Scope multiparamétrique mural
 *
 * LE SCOPE, C'EST LE JEU
 *
 * Dans une simulation clinique, l'information la plus utile n'est pas le
 * décor : c'est le scope. C'est lui qui montre, en continu et sans que le
 * joueur ait à cliquer, que le patient se dégrade, que la saturation
 * s'effondre, que la pression chute. Un étudiant qui lit un scope sait
 *sur-le-champ qu'il est en train de perdre le patient.
 *
 * La v1 n'avait qu'un « scope » de 256×96 : une bande d'ECG étirée sur un
 * écran mural de 0,44 m, sans chiffres. Le scope mural est désormais un vrai scope
 * multiparamétrique à la place : ECG, courbe de pouls, courbe de respiration
 * et les chiffres.
 *
 * UNE SEULE SOURCE DE VÉRITÉ
 *
 * Tout est lu dans `window.vitalSigns.props` — la source unique du jeu, la
 * même que le HUD 3D et que la boucle vitale du manager. Le scope ne
 * calcule RIEN de clinique : il ne fait que dessiner ce que le jeu sait
 * déjà. Si le joueur voit une saturation à 84 %, c'est que la partie
 * l'a décidé, pas l'écran.
 *
 * CADENCE
 *
 * 15 Hz. Le scope est vu de loin, à travers un écran de 44 cm : au-delà de
 * 15 Hz, on ne voit plus la différence — et chaque rafraîchissement est un
 * ré-upload de texture en VRAM.
 */

import * as THREE from 'three';

const LARGEUR = 640;
const HAUTEUR = 420;
const CADENCE_MS = 1000 / 15;

/** Nombre d'échantillons conservés pour le défilement des tracés. */
const PROFONDEUR = 240;

/**
 * Convertit les constantes du jeu en celles d'un scope.
 *
 * Le jeu utilise `systolic` / `diastolic` / `heartRate` / `spo2` /
 * `temperature` / `respiratoryRate`. Le scope parle PAM, SpO2, FR, T°.
 *
 * @param {object} props
 * @returns {{hr:number, spo2:number, map:number, sys:number, dia:number, rr:number, temp:number, etco2:number}}
 */
export function constantesPourScope(props) {
    const p = props || {};
    const num = (v, defaut) => (Number.isFinite(Number(v)) ? Number(v) : defaut);

    const sys = num(p.systolic, 120);
    const dia = num(p.diastolic, 80);
    const rr = num(p.respiratoryRate, 16);

    return {
        hr: num(p.heartRate, 78),
        spo2: num(p.spo2, 97),
        sys,
        dia,
        // PAM = (systolique + 2 × diastolique) / 3 — la formule de référence.
        map: Math.round((sys + 2 * dia) / 3),
        rr,
        temp: num(p.temperature, 37),
        // etCO2 : MedGame ne suit pas l'EtCO2. On l'ESTIME à partir de la
        // fréquence respiratoire, et on l'affiche avec la mention « est. »
        // pour ne jamais faire passer une estimation pour une mesure.
        etco2: Math.round(35 + (rr - 14) * 1.2)
    };
}

/* ------------------------------------------------------------------ */
/* Tracés                                                              */
/* ------------------------------------------------------------------ */

/**
 * Valeur ECG normalisée pour une phase de cycle cardiaque donnée (0..1).
 * Onde P, QRS, repolarisation ST, onde T.
 */
function ecgPhase(p) {
    let v = 0;
    if (p > 0.08 && p < 0.16) v += Math.sin(((p - 0.08) / 0.08) * Math.PI) * 0.17;
    if (p > 0.20 && p < 0.22) v -= 0.18;
    if (p >= 0.22 && p < 0.26) v += Math.sin(((p - 0.22) / 0.04) * Math.PI) * 1.3;
    if (p >= 0.26 && p < 0.29) v -= 0.34;
    if (p >= 0.29 && p < 0.46) v += 0.06;
    if (p >= 0.46 && p < 0.62) v += Math.sin(((p - 0.46) / 0.16) * Math.PI) * 0.34;
    return v;
}

/** Valeur de la courbe de pouls (oscillogramme) pour une phase donnée. */
function plethPhase(p) {
    if (p < 0.38) return Math.sin((p / 0.38) * Math.PI);
    if (p < 0.55) return 0.32 * Math.sin(((p - 0.38) / 0.17) * Math.PI);
    return 0;
}

/**
 * Crée le scope et l'accroche sur un maillage d'écran.
 *
 * @param {THREE.Mesh} screenMesh maillage de l'écran à habiller
 * @param {object} [options]
 * @param {string} [options.patientLabel] bandeau d'en-tête
 * @returns {{canvas: HTMLCanvasElement, texture: THREE.CanvasTexture, dispose: Function}}
 */
export function creerScope(screenMesh, options = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = LARGEUR;
    canvas.height = HAUTEUR;
    const ctx = canvas.getContext('2d');

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    // On remplace le matériau de l'écran : le « map » ET l'« emissiveMap »
    // (c'est lui qui fait que l'écran est lisible dans une pièce sombre).
    if (screenMesh?.material) {
        const ancien = screenMesh.material;
        const mat = new THREE.MeshStandardMaterial({
            map: texture,
            emissive: 0xffffff,
            emissiveMap: texture,
            // Sous le seuil de bloom : au-delà, l'écran « brûle » et le
            // patient disparaît dans le halo.
            emissiveIntensity: 0.62,
            roughness: 0.06
        });
        screenMesh.material = mat;
        ancien?.dispose?.();
    }

    // Historique des tracés.
    const ecg = new Float32Array(PROFONDEUR);
    const pleth = new Float32Array(PROFONDEUR);
    const resp = new Float32Array(PROFONDEUR);
    let phase = 0;
    let phaseResp = 0;
    let dernierTemps = performance.now();

    function dessiner(valeurs, etiquette) {
        const col = LARGEUR - 168;
        ctx.strokeStyle = 'rgba(56,189,248,0.07)';
        ctx.lineWidth = 1;
        for (let x = 0; x < col; x += 24) {
            ctx.beginPath(); ctx.moveTo(x, 34); ctx.lineTo(x, HAUTEUR); ctx.stroke();
        }
        for (let y = 40; y < HAUTEUR; y += 24) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(col, y); ctx.stroke();
        }
        return col;
    }

    function trace(historique, couleur, baseY, amplitude, etiquette, largeurTrace) {
        ctx.strokeStyle = couleur;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (let i = 0; i < historique.length; i++) {
            const x = (i / historique.length) * largeurTrace;
            const y = baseY - historique[i] * amplitude;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Tête de balayage.
        const dernier = historique[historique.length - 1] || 0;
        ctx.fillStyle = couleur;
        ctx.beginPath();
        ctx.arc(largeurTrace, baseY - dernier * amplitude, 3.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = couleur;
        ctx.font = 'bold 12px monospace';
        ctx.fillText(etiquette, 8, baseY - amplitude - 6);
    }

    function bloc(y, etiquette, valeur, unite, couleur, taille = 40) {
        ctx.fillStyle = '#7c8ea3';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(etiquette, LARGEUR - 160, y);
        ctx.fillStyle = couleur;
        ctx.font = `bold ${taille}px monospace`;
        ctx.fillText(valeur, LARGEUR - 160, y + taille - 4);
        if (unite) {
            ctx.fillStyle = '#64748b';
            ctx.font = '11px monospace';
            ctx.fillText(unite, LARGEUR - 60, y + taille - 8);
        }
    }

    function maj() {
        const maintenant = performance.now();
        const dt = Math.min((maintenant - dernierTemps) / 1000, 0.5);
        dernierTemps = maintenant;

        const v = constantesPourScope(window.vitalSigns?.props);

        // Avance des phases : le rythme ECG suit la fréquence cardiaque.
        phase = (phase + dt * (v.hr / 60)) % 1;
        phaseResp = (phaseResp + dt * (v.rr / 60)) % 1;

        ecg[ecg.length - 1] = ecgPhase(phase);
        pleth[pleth.length - 1] = plethPhase((phase + 0.22) % 1);
        resp[resp.length - 1] = Math.sin(phaseResp * Math.PI * 2) * 0.7;

        // Décalage des historiques (une case par rafraîchissement).
        ecg.copyWithin(0, 1);
        pleth.copyWithin(0, 1);
        resp.copyWithin(0, 1);

        /* --- Fond ---------------------------------------------------- */
        ctx.fillStyle = '#04070c';
        ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

        ctx.fillStyle = '#0d1522';
        ctx.fillRect(0, 0, LARGEUR, 34);
        ctx.fillStyle = '#93a7bd';
        ctx.font = 'bold 15px monospace';
        ctx.fillText(
            `MONITEUR ${options.patientLabel ? options.patientLabel.toUpperCase() : 'PATIENT'}`,
            12, 23
        );
        const critique = v.spo2 < 90 || v.map < 65 || v.hr > 130;
        ctx.fillStyle = critique ? '#ef4444' : '#10b981';
        ctx.fillText(critique ? '!! ALARMES !!' : 'SURVEILLANCE ACTIVE', LARGEUR - 210, 23);

        const largeurTrace = dessiner();

        /* --- Tracés --------------------------------------------------- */
        trace(ecg, critique ? '#ef4444' : '#22e59a', 110, 52, 'II', largeurTrace);
        trace(pleth, '#38bdf8', 230, 42, 'PLETH', largeurTrace);
        trace(resp, '#fbbf24', 330, 28, 'RESP', largeurTrace);

        /* --- Colonne de chiffres --------------------------------------- */
        const col = LARGEUR - 160;
        ctx.fillStyle = '#070c14';
        ctx.fillRect(col, 34, 160, HAUTEUR - 34);
        ctx.strokeStyle = '#16202e';
        ctx.strokeRect(col, 34, 160, HAUTEUR - 34);

        bloc(58, 'FC', String(v.hr), 'bpm', v.hr > 120 ? '#f87171' : '#22e59a');
        bloc(140, 'SpO2', String(v.spo2), '%', v.spo2 < 90 ? '#f87171' : '#38bdf8');
        bloc(222, 'PA', `${v.sys}/${v.dia}`, '', '#e2e8f0', 26);
        ctx.fillStyle = v.map >= 65 ? '#22e59a' : '#f87171';
        ctx.font = 'bold 26px monospace';
        ctx.fillText(`PAM ${v.map}`, col, 278);
        bloc(300, 'FR / etCO2', String(v.rr), `${v.etco2} est.`, '#fbbf24', 30);
        bloc(360, 'T°C', v.temp.toFixed(1), '', '#e2e8f0', 26);

        /* --- Bandeau d'alarme ----------------------------------------- */
        if (critique) {
            const clignote = Math.sin(maintenant * 0.008) > 0;
            ctx.fillStyle = clignote ? 'rgba(239,68,68,0.92)' : 'rgba(127,29,29,0.78)';
            ctx.fillRect(0, HAUTEUR - 26, largeurTrace, 26);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px monospace';
            let message = '** CONSTANTES CRITIQUES — INTERVENTION REQUISE **';
            if (v.spo2 < 90) message = '** DESATURATION — OXYGENE A ADMINISTRER **';
            else if (v.map < 65) message = '** PAM BASSE — HYPOPERFUSION TISSULAIRE **';
            else if (v.hr > 130) message = '** TACHYCARDIE — RECHERCHER LA CAUSE **';
            ctx.fillText(message, 12, HAUTEUR - 8);
        }

        texture.needsUpdate = true;
    }

    maj();
    const minuteur = setInterval(maj, CADENCE_MS);

    function dispose() {
        clearInterval(minuteur);
        texture.dispose();
    }

    return { canvas, texture, dispose };
}
