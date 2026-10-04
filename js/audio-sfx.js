/**
 * audio-sfx.js — Registre des effets sonores MedGame
 *
 * Tous les sons sont synthétisés à la volée : aucun octet d'asset, aucune
 * requête réseau, et surtout un contrôle fin sur le timbre.
 *
 * LANGAGE SONORE
 * --------------
 * Clinique, sobre, jamais « arcade ». Les conventions :
 *   - pas de square ni de sawtooth dans les one-shots (l'ancien `alert` en
 *     square 3x était agressif) : sine et triangle, enveloppes courtes ;
 *   - le clic est un *contact physique* (bruit filtré + transduction courte),
 *     pas une note ;
 *   - le positif est une tierce majeure, le négatif une tierce mineure
 *     descendante — on reconnaît la valence avant de voir l'écran ;
 *   - tout ce qui est « récompense » passe par la cloche additive
 *     (partiels inharmoniques) : une sinus pure ne sonne pas « cadeau » ;
 *   - tout ce qui est « tension » utilise des rapports de triton ou des
 *     demi-tons, jamais une quinte juste.
 *
 * Le bus par défaut de chaque son est fixé ici : les appels
 * `play('click')` n'ont rien à passer.
 *
 * Chargement : script classique, après js/audio-core.js.
 */

(function (global) {
    'use strict';

    const A = global.MedGameSound;
    if (!A) {
        console.warn('[audio-sfx] js/audio-core.js absent — registre non chargé');
        return;
    }

    // ==================== PALIER ====================

    /** Fréquences de référence. Le jeu est accordé en La (le gong ECOS est en La). */
    const N = {
        A1: 55.00, A2: 110.00, A3: 220.00, A4: 440.00, A5: 880.00, A6: 1760.00,
        B2: 123.47, B3: 246.94, B4: 493.88,
        C3: 130.81, C4: 261.63, C5: 523.25, C6: 1046.50, C7: 2093.00,
        D3: 146.83, D4: 293.66, D5: 587.33, D6: 1174.66,
        E3: 164.81, E4: 329.63, E5: 659.25, E6: 1318.51,
        F3: 174.61, F4: 349.23, F5: 698.46, F6: 1396.91,
        G2: 98.00, G3: 196.00, G4: 392.00, G5: 783.99, G6: 1567.98
    };

    /**
     * Ratios de cloche / gong. Une cloche réelle n'a pas de partiels
     * harmoniques : ces rapports légèrement « faux » sont ce qui donne le
     * timbre métallique.
     */
    const BELL_SMALL = [1, 2.76, 5.40, 8.93];
    const BELL_BRIGHT = [1, 2.0, 3.01, 4.17, 5.43, 6.79];
    const GONG_PARTIALS = [1, 1.51, 2.04, 2.71, 3.19, 4.13, 5.72];

    /** Raccourci : attache un bus par défaut à une fonction de son. */
    function on(bus, fn) {
        return (p) => {
            const opts = (p && typeof p === 'object') ? p : {};
            return fn(Object.assign({}, opts, { bus: opts.bus || bus }));
        };
    }

    /** Instant de départ : `at` si fourni, sinon maintenant + 2 ms. */
    function base(p) {
        return (p && p.at !== undefined) ? p.at : A.now() + 0.002;
    }

    // ==================== INTERFACE UTILISATEUR (bus ui) ====================

    const ui = {

        /**
         * Clic de contact. Bruit passe-haut très court + transduction 1.2 kHz.
         * 22 ms au total : un clic plus long devient un « pop ».
         */
        click: on('ui', (p) => {
            const t = base(p);
            A.noise({ dur: 0.022, gain: 0.09, filter: 'highpass', freq: 2600, q: 0.7, seed: 11, bus: p.bus, at: t });
            A.tone({ freq: 1180, glideTo: 900, type: 'sine', dur: 0.03, gain: 0.055, bus: p.bus, at: t });
        }),

        /** Survol de bouton : plus faible et plus court que le clic. */
        hover: on('ui', (p) => {
            const t = base(p);
            A.noise({ dur: 0.012, gain: 0.022, filter: 'highpass', freq: 4200, q: 0.6, seed: 13, bus: p.bus, at: t });
        }),

        /** Sélection : deux notes montantes d'un ton et demi. */
        select: on('ui', (p) => {
            const t = base(p);
            A.tone({ freq: N.G5, type: 'sine', dur: 0.05, gain: 0.07, bus: p.bus, at: t });
            A.tone({ freq: N.B5 || 987.77, type: 'sine', dur: 0.07, gain: 0.06, bus: p.bus, at: t + 0.045 });
        }),

        /** Interrupteur : contact + note dont la hauteur code l'état. */
        toggle: on('ui', (p) => {
            const t = base(p);
            const on_ = p.on !== false;
            A.noise({ dur: 0.018, gain: 0.07, filter: 'highpass', freq: 3000, q: 0.7, seed: 17, bus: p.bus, at: t });
            A.tone({ freq: on_ ? 660 : 520, glideTo: on_ ? 990 : 390, type: 'triangle', dur: 0.07, gain: 0.06, bus: p.bus, at: t });
        }),

        /** Retour / annulation : la sélection à l'envers. */
        back: on('ui', (p) => {
            const t = base(p);
            A.tone({ freq: 620, glideTo: 380, type: 'sine', dur: 0.09, gain: 0.06, bus: p.bus, at: t });
        }),

        /**
         * Refus de saisie (« il faut choisir un examen »). Descente de tierce
         * mineure, corps triangle. L'ancien square à 880 Hz s'enflammait.
         */
        alert: on('ui', (p) => {
            const t = base(p);
            A.tone({ freq: N.A4, type: 'triangle', dur: 0.1, gain: 0.09, bus: p.bus, at: t });
            A.tone({ freq: N.F4, type: 'triangle', dur: 0.16, gain: 0.09, bus: p.bus, at: t + 0.09 });
        }),

        /** Erreur franche : impact + tierce mineure. Réservé à une vraie erreur. */
        error: on('ui', (p) => {
            const t = base(p);
            A.thump({ freq: 160, freqTo: 70, dur: 0.16, gain: 0.16, bus: p.bus, at: t });
            A.tone({ freq: N.F4, type: 'triangle', dur: 0.22, gain: 0.08, bus: p.bus, at: t + 0.02 });
        }),

        /** Frappe de touche : 4 ms, inaudible en flux continu, vraie en fond. */
        typing: on('ui', (p) => {
            const t = base(p);
            A.noise({ dur: 0.01, gain: 0.03, filter: 'bandpass', freq: 3200, q: 1.4, seed: 23, bus: p.bus, at: t });
        }),

        /** Ouverture de panneau : souffle passe-bas qui descend. */
        open: on('ui', (p) => {
            const t = base(p);
            A.noise({ dur: 0.16, gain: 0.05, filter: 'lowpass', freq: 1800, freqTo: 500, q: 0.9, seed: 29, bus: p.bus, at: t });
            A.tone({ freq: 300, glideTo: 460, type: 'sine', dur: 0.12, gain: 0.04, bus: p.bus, at: t });
        }),

        /** Fermeture de panneau : le même souffle à l'envers. */
        close: on('ui', (p) => {
            const t = base(p);
            A.noise({ dur: 0.13, gain: 0.05, filter: 'lowpass', freq: 500, freqTo: 1500, q: 0.9, seed: 31, bus: p.bus, at: t });
            A.tone({ freq: 460, glideTo: 280, type: 'sine', dur: 0.1, gain: 0.04, bus: p.bus, at: t });
        }),

        /** Froissement de papier : la texture des fiches et des ordonnances. */
        paper: on('ui', (p) => {
            const t = base(p);
            A.noise({ dur: 0.11, gain: 0.055, filter: 'highpass', freq: 1900, freqTo: 4200, q: 0.5, seed: 37, bus: p.bus, at: t });
        }),

        /** Retour d'ascenseur / changement de vue : glissement plus long. */
        page: on('ui', (p) => {
            const t = base(p);
            A.noise({ dur: 0.22, gain: 0.05, filter: 'bandpass', freq: 900, freqTo: 2400, q: 0.6, seed: 41, bus: p.bus, at: t });
            A.tone({ freq: 220, glideTo: 330, type: 'sine', dur: 0.18, gain: 0.035, bus: p.bus, at: t });
        })
    };

    // ==================== JEU & PÉDAGOGIE (bus sfx) ====================

    const sfx = {

        /**
         * Validation d'une bonne action. Tierce majeure puis quinte : l'accord
         * C-E-G de l'ancien code tenait 0.45 s et saturait, on resserre à 0.2 s.
         */
        correct: on('sfx', (p) => {
            const t = base(p);
            A.tone({ freq: N.C5, type: 'sine', dur: 0.14, gain: 0.11, bus: p.bus, at: t });
            A.tone({ freq: N.E5, type: 'sine', dur: 0.14, gain: 0.1, bus: p.bus, at: t + 0.055 });
            A.tone({ freq: N.G5, type: 'triangle', dur: 0.2, gain: 0.07, bus: p.bus, at: t + 0.11 });
        }),

        /**
         * Récompense (badge, score, déverrouillage). Cloche courte + accord
         * majeur ouvert. Distingué de `correct` : `correct` valide une action,
         * `success` récompense.
         */
        success: on('sfx', (p) => {
            const t = base(p);
            A.bell({ freq: N.D6, dur: 0.9, gain: 0.09, partials: BELL_BRIGHT, bus: p.bus, at: t });
            A.tone({ freq: N.F5, type: 'sine', dur: 0.22, gain: 0.07, bus: p.bus, at: t + 0.05 });
            A.tone({ freq: N.A5, type: 'sine', dur: 0.26, gain: 0.06, bus: p.bus, at: t + 0.1 });
        }),

        /**
         * Mauvaise réponse. Tierce mineure descendante + un peu de corps.
         * On n'informe pas l'étudiant de l'erreur, on la signale.
         */
        incorrect: on('sfx', (p) => {
            const t = base(p);
            A.tone({ freq: N.A4, type: 'triangle', dur: 0.12, gain: 0.1, bus: p.bus, at: t });
            A.tone({ freq: N.F4, type: 'triangle', dur: 0.26, gain: 0.1, bus: p.bus, at: t + 0.1 });
            A.noise({ dur: 0.07, gain: 0.03, filter: 'lowpass', freq: 900, q: 0.8, seed: 47, bus: p.bus, at: t });
        }),

        /**
         * Échec d'un nœud du mode Urgence. Remplace
         * `assets/sounds/Wrong Buzzer.mp3`, le seul son du jeu lu depuis un
         * fichier. Deux buzzers courts et descendants : on signale l'échec
         * sans crier, et le joueur peut rejouer sans saut dans les oreilles.
         */
        wrongAnswer: on('sfx', (p) => {
            const t = base(p);
            for (let i = 0; i < 2; i++) {
                const at = t + i * 0.16;
                A.tone({ freq: 420 - i * 40, type: 'sawtooth', dur: 0.13, attack: 0.004, gain: 0.075, bus: p.bus, at });
                A.tone({ freq: 210 - i * 20, type: 'square', dur: 0.13, attack: 0.004, gain: 0.03, bus: p.bus, at });
            }
            A.noise({ dur: 0.1, gain: 0.02, filter: 'bandpass', freq: 900, q: 1.2, seed: 151, bus: p.bus, at: t });
        }),

        /** Issue grave (décès, arrêt cardiaque) : impact + quinte mineure. */
        badOutcome: on('sfx', (p) => {
            const t = base(p);
            A.thump({ freq: 120, freqTo: 42, dur: 0.6, gain: 0.24, bus: p.bus, at: t });
            A.tone({ freq: N.D3, type: 'triangle', dur: 0.9, gain: 0.08, bus: p.bus, at: t + 0.05 });
            A.tone({ freq: N.G3, type: 'sine', dur: 0.8, gain: 0.07, bus: p.bus, at: t + 0.05 });
        }),

        /** Fin de cas réussie : fanfare en pentatonique (évite le cliché majeur). */
        complete: on('sfx', (p) => {
            const t = base(p);
            [N.C5, N.D5, N.E5, N.G5, N.A5, N.C6].forEach((f, i) => {
                A.tone({ freq: f, type: 'sine', dur: 0.26, gain: 0.085, bus: p.bus, at: t + i * 0.085 });
            });
            A.bell({ freq: N.C6, dur: 1.4, gain: 0.05, partials: BELL_BRIGHT, bus: p.bus, at: t + 0.51 });
        }),

        /** Révélation d'une information verrouillée : une cloche, rien d'autre. */
        reveal: on('sfx', (p) => {
            const t = base(p);
            A.bell({ freq: N.A5, dur: 0.7, gain: 0.09, partials: BELL_SMALL, bus: p.bus, at: t });
        }),

        /**
         * Retournement de carte (QCM d'auscultation et d'ECG).
         * Ce son était APPELÉ par auscultation.js, auscultation-pcg.js et
         * ecg-trainer.js mais n'existait pas : ces trois réponses étaient
         * totalement muettes.
         */
        card_flip: on('sfx', (p) => {
            const t = base(p);
            A.noise({ dur: 0.07, gain: 0.05, filter: 'bandpass', freq: 2600, freqTo: 1100, q: 0.8, seed: 53, bus: p.bus, at: t });
            A.tone({ freq: 420, glideTo: 260, type: 'sine', dur: 0.06, gain: 0.04, bus: p.bus, at: t });
        }),

        /** Badge débloqué : trois cloches montantes + éclat aigu. */
        badge: on('sfx', (p) => {
            const t = base(p);
            [N.A5, N.C6, N.E6].forEach((f, i) => {
                A.bell({ freq: f, dur: 1.1, gain: 0.07, partials: BELL_BRIGHT, bus: p.bus, at: t + i * 0.11 });
            });
            A.noise({ dur: 0.3, gain: 0.02, filter: 'highpass', freq: 6000, q: 0.5, seed: 59, bus: p.bus, at: t + 0.33 });
        }),

        /** cadenas fermé : cliquet + note grave. */
        lock: on('sfx', (p) => {
            const t = base(p);
            A.noise({ dur: 0.05, gain: 0.06, filter: 'bandpass', freq: 1600, q: 2.2, seed: 61, bus: p.bus, at: t });
            A.thump({ freq: 190, freqTo: 88, dur: 0.12, gain: 0.12, bus: p.bus, at: t });
        }),

        /** cadenas ouvert : cliquet inverse + arpège court (voir aussi unlockSound). */
        unlock: on('sfx', (p) => {
            const t = base(p);
            A.noise({ dur: 0.04, gain: 0.05, filter: 'bandpass', freq: 2200, q: 2.5, seed: 67, bus: p.bus, at: t });
            [N.C5, N.E5, N.G5].forEach((f, i) => {
                A.tone({ freq: f, type: 'sine', dur: 0.18, gain: 0.07, bus: p.bus, at: t + 0.05 + i * 0.06 });
            });
        }),

        /** Indice demandé : cloche inversée (descendante). */
        hint: on('sfx', (p) => {
            const t = base(p);
            A.tone({ freq: N.E5, glideTo: N.A4, type: 'sine', dur: 0.28, gain: 0.07, bus: p.bus, at: t });
        }),

        /** Appel à l'infirmière : bip d'interphone. */
        nurseCall: on('sfx', (p) => {
            const t = base(p);
            A.tone({ freq: N.D5, type: 'sine', dur: 0.14, gain: 0.07, bus: p.bus, at: t });
            A.tone({ freq: N.F5, type: 'sine', dur: 0.2, gain: 0.06, bus: p.bus, at: t + 0.16 });
        }),

        /** Interphone d'annonce urgente : la même, plus vite et plus haut. */
        intercomUrgent: on('sfx', (p) => {
            const t = base(p);
            A.tone({ freq: N.F5, type: 'sine', dur: 0.1, gain: 0.08, bus: p.bus, at: t });
            A.tone({ freq: N.F5, type: 'sine', dur: 0.1, gain: 0.08, bus: p.bus, at: t + 0.13 });
            A.tone({ freq: N.A5, type: 'sine', dur: 0.18, gain: 0.07, bus: p.bus, at: t + 0.26 });
        }),

        /** Téléphone / bip de téléphone portable. */
        phone: on('sfx', (p) => {
            const t = base(p);
            for (let i = 0; i < 2; i++) {
                A.tone({ freq: 1046.5, type: 'sine', dur: 0.09, gain: 0.06, bus: p.bus, at: t + i * 0.14 });
            }
        }),

        /** Portes du couloir : choc sourd + clin d'air. */
        doorOpen: on('sfx', (p) => {
            const t = base(p);
            A.noise({ dur: 0.4, gain: 0.05, filter: 'lowpass', freq: 700, freqTo: 220, q: 0.8, seed: 71, bus: p.bus, at: t });
            A.thump({ freq: 90, freqTo: 55, dur: 0.14, gain: 0.1, bus: p.bus, at: t + 0.3 });
        }),

        doorClose: on('sfx', (p) => {
            const t = base(p);
            A.thump({ freq: 130, freqTo: 50, dur: 0.2, gain: 0.16, bus: p.bus, at: t });
            A.noise({ dur: 0.1, gain: 0.035, filter: 'lowpass', freq: 500, q: 0.7, seed: 73, bus: p.bus, at: t });
        }),

        /** Roues du chariot sur le linoléum. */
        cartRoll: on('sfx', (p) => {
            const t = base(p);
            A.noise({ dur: 0.7, gain: 0.035, filter: 'bandpass', freq: 380, q: 0.9, seed: 79, bus: p.bus, at: t });
            A.tone({ freq: 140, type: 'sawtooth', dur: 0.65, gain: 0.012, bus: p.bus, at: t });
        }),

        /** Pas sur le sol. */
        step: on('sfx', (p) => {
            const t = base(p);
            A.noise({ dur: 0.06, gain: 0.04, filter: 'lowpass', freq: 900, freqTo: 300, q: 0.7, seed: 83, bus: p.bus, at: t });
            A.thump({ freq: 110, freqTo: 60, dur: 0.07, gain: 0.06, bus: p.bus, at: t });
        }),

        /** Lavage des mains : jets d'eau. Remplace le bip de mesure qui faisait
         *  office de placeholder (js/three-manager.js). */
        water: on('sfx', (p) => {
            const t = base(p);
            A.noise({ dur: 0.55, gain: 0.05, filter: 'bandpass', freq: 2600, freqTo: 3800, q: 0.5, seed: 89, bus: p.bus, at: t });
            A.noise({ dur: 0.4, gain: 0.03, filter: 'highpass', freq: 5000, q: 0.5, seed: 97, bus: p.bus, at: t + 0.06 });
        }),

        /** Gants : froissement du matériau. */
        gloves: on('sfx', (p) => {
            const t = base(p);
            A.noise({ dur: 0.28, gain: 0.045, filter: 'highpass', freq: 1500, freqTo: 3600, q: 0.5, seed: 101, bus: p.bus, at: t });
        }),

        /** Seringue : injection du piston. */
        syringe: on('sfx', (p) => {
            const t = base(p);
            A.tone({ freq: 900, glideTo: 1500, type: 'sine', dur: 0.12, gain: 0.045, bus: p.bus, at: t });
            A.noise({ dur: 0.16, gain: 0.025, filter: 'bandpass', freq: 2200, q: 1.2, seed: 103, bus: p.bus, at: t + 0.02 });
        }),

        /** Perfusion : gouttes dans la tubulure + bullier. */
        infusion: on('sfx', (p) => {
            const t = base(p);
            for (let i = 0; i < 3; i++) {
                A.tone({ freq: 1400 - i * 90, type: 'sine', dur: 0.05, gain: 0.04, bus: p.bus, at: t + i * 0.19 });
            }
        }),

        /** Masque à oxygène : mise en place + valve. */
        oxygen: on('sfx', (p) => {
            const t = base(p);
            A.noise({ dur: 0.5, gain: 0.05, filter: 'bandpass', freq: 1600, freqTo: 700, q: 0.6, seed: 107, bus: p.bus, at: t });
            A.tone({ freq: 600, glideTo: 480, type: 'triangle', dur: 0.3, gain: 0.03, bus: p.bus, at: t });
        }),

        /** Scope : connexion des électrodes. */
        ecgConnect: on('sfx', (p) => {
            const t = base(p);
            [N.G5, N.C6, N.E6].forEach((f, i) => {
                A.tone({ freq: f, type: 'sine', dur: 0.09, gain: 0.055, bus: p.bus, at: t + i * 0.07 });
            });
        }),

        /** Prise de sang : ponction puis remplissage du tube. */
        bloodDraw: on('sfx', (p) => {
            const t = base(p);
            A.noise({ dur: 0.1, gain: 0.04, filter: 'bandpass', freq: 1400, q: 1.6, seed: 109, bus: p.bus, at: t });
            A.tone({ freq: 700, glideTo: 1200, type: 'sine', dur: 0.18, gain: 0.035, bus: p.bus, at: t + 0.12 });
        }),

        /** Échantillon d'urine : jet dans le pot. */
        urine: on('sfx', (p) => {
            const t = base(p);
            A.noise({ dur: 0.7, gain: 0.04, filter: 'bandpass', freq: 900, freqTo: 2400, q: 1.1, seed: 113, bus: p.bus, at: t });
        }),

        /** Repas / plateau. */
        tray: on('sfx', (p) => {
            const t = base(p);
            A.noise({ dur: 0.12, gain: 0.05, filter: 'bandpass', freq: 1800, q: 1.8, seed: 127, bus: p.bus, at: t });
            A.tone({ freq: 300, type: 'triangle', dur: 0.1, gain: 0.035, bus: p.bus, at: t });
        }),

        /** Scanner / lecture de badge. */
        scan: on('sfx', (p) => {
            const t = base(p);
            A.tone({ freq: 1800, glideTo: 2600, type: 'sine', dur: 0.09, gain: 0.045, bus: p.bus, at: t });
            A.tone({ freq: 2600, type: 'sine', dur: 0.07, gain: 0.035, bus: p.bus, at: t + 0.1 });
        }),

        /** Prise de notes au dossier. */
        clipboardWrite: on('sfx', (p) => {
            const t = base(p);
            A.noise({ dur: 0.2, gain: 0.03, filter: 'bandpass', freq: 2400, freqTo: 1400, q: 1.1, seed: 131, bus: p.bus, at: t });
        }),

        /** Battement isolé (télétransmission, monitor). */
        heartbeatOne: on('sfx', (p) => {
            const t = base(p);
            A.thump({ freq: 62, freqTo: 34, dur: 0.11, gain: 0.2, bus: p.bus, at: t });
            A.thump({ freq: 48, freqTo: 28, dur: 0.14, gain: 0.13, bus: p.bus, at: t + 0.085 });
        }),

        /** Chute d'une constante vitale : le son dive, on le sent avant de le voir. */
        vitalDrop: on('sfx', (p) => {
            const t = base(p);
            A.tone({ freq: N.A4, glideTo: N.A3, type: 'triangle', dur: 0.5, gain: 0.09, bus: p.bus, at: t });
            A.noise({ dur: 0.4, gain: 0.03, filter: 'lowpass', freq: 1200, freqTo: 300, q: 0.7, seed: 137, bus: p.bus, at: t });
        }),

        /** Perfusion de solution : le patient se stabilise. */
        stabilize: on('sfx', (p) => {
            const t = base(p);
            A.tone({ freq: N.C4, glideTo: N.G4, type: 'sine', dur: 0.5, gain: 0.06, bus: p.bus, at: t });
            A.bell({ freq: N.G5, dur: 0.8, gain: 0.04, partials: BELL_SMALL, bus: p.bus, at: t + 0.25 });
        })
    };

    // ==================== MINUTERIE (bus sfx, filtre par le mode calme) ====================

    const timer = {

        /** Tick du compte à rebours : 1.2 kHz, 25 ms, très faible. */
        tick: on('sfx', (p) => {
            const t = base(p);
            A.tone({ freq: 1200, type: 'sine', dur: 0.025, gain: 0.04, bus: p.bus, at: t });
        }),

        /**
         * Seuils d'avertissement. Le paramètre `secondsLeft` fait monter la
         * fréquence ET la durée : l'urgence s'entend sans regarder l'écran.
         * Supprimé en mode calme.
         */
        timerWarning: on('sfx', (p) => {
            const secondsLeft = (p && typeof p === 'object' && Number.isFinite(p.secondsLeft))
                ? p.secondsLeft
                : (typeof p === 'number' ? p : 60);
            const t = base(typeof p === 'object' ? p : {});
            const urgent = secondsLeft <= 10;
            const soon = secondsLeft <= 30;
            const freq = urgent ? N.C7 : soon ? N.G5 : N.C5;
            const dur = urgent ? 0.12 : 0.2;
            const gain = urgent ? 0.12 : soon ? 0.09 : 0.06;
            A.tone({ freq, type: 'sine', dur, gain, bus: p.bus || 'sfx', at: t });
            if (urgent) A.tone({ freq, type: 'sine', dur, gain, bus: p.bus || 'sfx', at: t + 0.18 });
        }),

        /** Temps écoulé : trois tons descendants, sans alarme. */
        timeUp: on('sfx', (p) => {
            const t = base(p);
            [N.G5, N.E5, N.C5].forEach((f, i) => {
                A.tone({ freq: f, type: 'triangle', dur: 0.28, gain: 0.1, bus: p.bus, at: t + i * 0.16 });
            });
        })
    };

    // ==================== ECOS (bus sfx) ====================

    const ecos = {

        /**
         * Gong de début de station. Le gong ECOS officiel est en La : on garde
         * le fondamentale et on remplace les sinus par des partiels de tam-tam
         * plus un impact grave — un « top départ » qui a du corps.
         */
        ecosGongStart: on('sfx', (p) => {
            const t = base(p);
            A.thump({ freq: 98, freqTo: 46, dur: 0.5, gain: 0.22, bus: p.bus, at: t });
            A.bell({ freq: N.A2, dur: 2.8, gain: 0.13, partials: GONG_PARTIALS, bus: p.bus, at: t + 0.01 });
            A.noise({ dur: 0.7, gain: 0.03, filter: 'bandpass', freq: 700, freqTo: 240, q: 0.7, seed: 139, bus: p.bus, at: t });
        }),

        /**
         * Cloche de jalon (60 s / 30 s restantes). Deux frappes nettes.
         * Ajout de partiels : l'ancienne version (880 + 1760 Hz) sonnait
         * « bip d'horloge » et pas « cloche ».
         */
        ecosBell: on('sfx', (p) => {
            const t = base(p);
            for (let i = 0; i < 2; i++) {
                A.bell({ freq: N.D6, dur: 0.85, gain: 0.1, partials: BELL_BRIGHT, bus: p.bus, at: t + i * 0.26 });
            }
        }),

        /** Fin de station : trois frappes descendantes, la dernière résonne. */
        ecosGongEnd: on('sfx', (p) => {
            const t = base(p);
            A.bell({ freq: N.E5, dur: 0.9, gain: 0.09, partials: BELL_SMALL, bus: p.bus, at: t });
            A.bell({ freq: N.D5, dur: 0.9, gain: 0.09, partials: BELL_SMALL, bus: p.bus, at: t + 0.28 });
            A.bell({ freq: N.A3, dur: 2.4, gain: 0.12, partials: GONG_PARTIALS, bus: p.bus, at: t + 0.56 });
        }),

        /** Jalon ECOS signalé comme critique : la cloche, une tierce plus bas. */
        ecosUrgent: on('sfx', (p) => {
            const t = base(p);
            A.bell({ freq: N.A4, dur: 1.1, gain: 0.11, partials: BELL_BRIGHT, bus: p.bus, at: t });
            A.bell({ freq: N.F4, dur: 1.1, gain: 0.09, partials: BELL_BRIGHT, bus: p.bus, at: t + 0.3 });
        }),

        /** Réponse attendue à l'oral de l'infirmière. */
        ecosListen: on('sfx', (p) => {
            const t = base(p);
            A.tone({ freq: N.C5, type: 'sine', dur: 0.09, gain: 0.05, bus: p.bus, at: t });
            A.tone({ freq: N.G5, type: 'sine', dur: 0.12, gain: 0.04, bus: p.bus, at: t + 0.1 });
        })
    };

    // ==================== AUSCULTATION & ECG (bus auscultation) ====================

    const train = {

        /**
         * Pose de la membrane du stéthoscope. Deux timbres distincts : la
         * membrane (clapot) est plus haute et plus sèche que la cloche.
         */
        stethoscope: on('auscultation', (p) => {
            const t = base(p);
            A.noise({ dur: 0.05, gain: 0.06, filter: 'bandpass', freq: 2400, q: 1.4, seed: 149, bus: p.bus, at: t });
            A.tone({ freq: 720, type: 'sine', dur: 0.07, gain: 0.045, bus: p.bus, at: t });
        }),

        /** Bascule en position « cloche » (basses fréquences, orifice petite). */
        bellMode: on('auscultation', (p) => {
            const t = base(p);
            A.bell({ freq: N.E5, dur: 0.6, gain: 0.07, partials: BELL_SMALL, bus: p.bus, at: t });
        }),

        /** Bascule en position « diaphragme » (hautes fréquences, timbre mat). */
        diaphragmMode: on('auscultation', (p) => {
            const t = base(p);
            A.noise({ dur: 0.12, gain: 0.05, filter: 'bandpass', freq: 1200, q: 1.1, seed: 151, bus: p.bus, at: t });
            A.tone({ freq: 340, type: 'sine', dur: 0.1, gain: 0.04, bus: p.bus, at: t });
        }),

        /** Déplacement du stéthoscope sur la poitrine : frottement. */
        auscultMove: on('auscultation', (p) => {
            const t = base(p);
            A.noise({ dur: 0.16, gain: 0.03, filter: 'bandpass', freq: 1800, freqTo: 900, q: 0.8, seed: 157, bus: p.bus, at: t });
        }),

        /**
         * Bip ECG du scope d'entraînement. Le paramètre `pitch` permet de
         * faire baisser la note quand la SpO2 chute : sur un scope réel la
         * tonalité ne change pas, mais dans un jeu c'est un signal
         * périphérique utile — et le joueur l’attend.
         */
        ecgBeep: on('auscultation', (p) => {
            const t = base(p);
            const pitch = Number.isFinite(p && p.pitch) ? p.pitch : N.A5;
            A.tone({ freq: pitch, type: 'sine', dur: 0.055, gain: 0.055, bus: p.bus, at: t });
        }),

        /** Calibrage de la sonde d'auscultation avant écoute. */
        calibrate: on('auscultation', (p) => {
            const t = base(p);
            A.tone({ freq: 440, type: 'sine', dur: 0.1, gain: 0.05, bus: p.bus, at: t });
            A.tone({ freq: 880, type: 'sine', dur: 0.14, gain: 0.05, bus: p.bus, at: t + 0.12 });
        })
    };

    // ==================== ENREGISTREMENT ====================

    /**
     * Les trois registres ci-dessus sont des tests unitaires audio
     * (test/audio.test.mjs les parcourt) : les conserver nommés.
     */
    const sfxBank = Object.assign({}, ui, sfx, timer, ecos, train);

    A.registerAll(sfxBank);

    /**
     * Throttling : borne le débit d'un son quand il est sollicité en boucle
     * (tick de timer, survol, frappe au clavier). Sans ça, un curseur survolé
     * ou une réponse qui défile déclenche des dizaines de nœuds par seconde.
     */
    A.setThrottles({
        click: 45,
        hover: 30,
        select: 150,
        toggle: 120,
        typing: 55,
        page: 250,
        paper: 120,
        step: 200,
        tick: 90,
        timerWarning: 180,
        alert: 250,
        error: 400,
        correct: 350,
        incorrect: 400,
        wrongAnswer: 500,
        reveal: 200,
        success: 350,
        card_flip: 200,
        hint: 300,
        auscultMove: 300,
        stethoscope: 150,
        ecgBeep: 120,
        badge: 800,
        ecosBell: 900,
        ecosGongStart: 1800,
        ecosGongEnd: 1800,
        ecosUrgent: 900,
        complete: 900
    });

    /** Sons.router vers leur bus naturel quand aucun bus n'est imposé. */
    const DEFAULT_BUS = {};
    for (const name of Object.keys(ui)) DEFAULT_BUS[name] = 'ui';
    for (const name of Object.keys(sfx)) DEFAULT_BUS[name] = 'sfx';
    for (const name of Object.keys(timer)) DEFAULT_BUS[name] = 'sfx';
    for (const name of Object.keys(ecos)) DEFAULT_BUS[name] = 'sfx';
    for (const name of Object.keys(train)) DEFAULT_BUS[name] = 'auscultation';

    A.constants.DEFAULT_BUS = DEFAULT_BUS;
    A.constants.SFX_BANK = sfxBank;

    global.MedGameSfx = {
        bank: sfxBank,
        defaultBus: DEFAULT_BUS,
        notes: N,
        bellPartials: { small: BELL_SMALL, bright: BELL_BRIGHT, gong: GONG_PARTIALS }
    };
})(typeof window !== 'undefined' ? window : globalThis);
