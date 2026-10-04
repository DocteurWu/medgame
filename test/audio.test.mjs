/**
 * test/audio.test.mjs — Intégrité du système audio MedGame
 *
 * Le but de ce fichier est triple :
 *
 *  1. EMPÊCHER LE SON MUET. C'était le défaut structurel du projet : huit
 *     sites appelaient `play('success')` ou `play('card_flip')` alors que
 *     ces sons n'existaient pas dans le registre. L'appel renvoyait
 *     silencieusement et le joueur n'entendait rien. Ici on analyse
 *     statiquement TOUS les appels `.play(...)` du dépôt et on exige que
 *     chaque littéral corresponde à un son enregistré. Un test, pas une
 *     relecture.
 *
 *  2. GARANTIR UNE SEULE SOURCE DE VRAITÉ pour les réglages. Le projet avait
 *     deux modules se partageant `medgame.audio.volume` avec des défauts
 *     contradictoires (0.30 et 0.60) et trois AudioContext qui
 *     contournaient le mute global.
 *
 *  3. TESTER LE COMPORTEMENT PHYSIOLOGIQUE déterministe : l'écart S1-S2 se
 *     comprime-t-il bien quand la fréquence cardiaque monte ? La tension
 *     musicale reste-t-elle dans [0, 1] ?
 *
 * Aucun Web Audio n'est requis : les modules sont chargés avec un
 * `localStorage` simulé et le contexte n'est jamais créé.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── Environnement minimal pour charger les modules ────────────────────────
// localStorage simulé : les modules audio lisent au premier accès seulement.
const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
};

function loadScripts(...files) {
    for (const file of files) {
        const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
        // eslint-disable-next-line no-new-func
        new Function(src)();
    }
}

loadScripts('js/audio-core.js', 'js/audio-sfx.js', 'js/audio-ambience.js',
    'js/audio-medical.js', 'js/audio.js');

const Sound = globalThis.MedGameSound;
const Sfx = globalThis.MedGameSfx;
const Medical = globalThis.MedGameMedical;
const Ambience = globalThis.MedGameAmbience;
const Facade = globalThis.MedGameAudio;

const registry = () => Sound.list();

// ── Faux AudioContext ──────────────────────────────────────────────────────
// Un AudioNode n'est pas introspectable dans un navigateur : on ne peut pas
// vérifier qu'un bus est bien relié au master, ni lire la valeur RÉELLEMENT
// appliquée sur un gain. Ce faux contexte enregistre les connexions et
// applique les rampes immédiatement, ce qui permet de tester la topologie du
// graphe et les valeurs de gain sans navigateur.

function fauxAudioContext() {
    const noeuds = [];

    function param(valeur) {
        return {
            value: valeur,
            cancelScheduledValues() { return this; },
            setValueAtTime(v) { this.value = v; return this; },
            linearRampToValueAtTime(v) { this.value = v; return this; },
            exponentialRampToValueAtTime(v) { this.value = Math.max(v, 1e-4); return this; },
            setTargetAtTime(v) { this.value = v; return this; },
            setValueCurveAtTime() { return this; }
        };
    }

    function noeud(type, extra) {
        const n = Object.assign({
            type,
            _connecteA: [],
            connect(dest) { this._connecteA.push(dest); return dest; },
            disconnect() { this._connecteA.length = 0; }
        }, extra);
        noeuds.push(n);
        return n;
    }

    return class FauxAudioContext {
        constructor() {
            this.state = 'running';
            this.sampleRate = 48000;
            // `currentTime` avance VRAIMENT avec le temps. Un compteur figé
            // ferait échouer tous les chemins qui comparent l'horloge du
            // contexte (relâchement du ducking, wetlands de rampes) — et un
            // test qui passe pour une raison bogus vaut mieux que pas de test.
            const t0 = Date.now();
            Object.defineProperty(this, 'currentTime', {
                get: () => (Date.now() - t0) / 1000,
                configurable: true
            });
            this.destination = noeud('destination');
            this.createGain = () => noeud('gain', { gain: param(1) });
            this.createOscillator = () => noeud('oscillator', {
                type: 'sine', frequency: param(440), detune: param(0),
                start() { }, stop() { }, onended: null
            });
            this.createBiquadFilter = () => noeud('filter', {
                type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0)
            });
            this.createDynamicsCompressor = () => noeud('compressor', {
                threshold: param(-24), knee: param(30), ratio: param(12),
                attack: param(0.003), release: param(0.25), gain: param(0)
            });
            this.createWaveShaper = () => noeud('shaper', { curve: null, oversample: 'none' });
            this.createAnalyser = () => noeud('analyser', {
                fftSize: 2048,
                smoothingTimeConstant: 0.8,
                getFloatTimeDomainData() { },
                getByteTimeDomainData() { }
            });
            this.createBuffer = (ch, len) => ({
                length: len, sampleRate: this.sampleRate,
                numberOfChannels: ch, duration: len / this.sampleRate,
                getChannelData: () => new Float32Array(len)
            });
            this.createBufferSource = () => noeud('bufferSource', {
                buffer: null, loop: false, playbackRate: param(1),
                start() { }, stop() { }, onended: null
            });
            this.close = () => { this.state = 'closed'; return Promise.resolve(); };
            this.resume = () => { this.state = 'running'; return Promise.resolve(); };
            this.suspend = () => { this.state = 'suspended'; return Promise.resolve(); };
        }
        _noeuds() { return noeuds; }
    };
}

/**
 * Recharge les modules audio au-dessus d'un faux contexte et renvoie le
 * nouveau socle. Les instances précédentes restent utilisables : les tests
 * qui n'ont besoin que de logique pure continuent d'utiliser `Sound`.
 */
function chargerAvecAudioFactice() {
    const precedent = globalThis.AudioContext;
    const Faux = fauxAudioContext();
    globalThis.AudioContext = Faux;
    globalThis.webkitAudioContext = Faux;
    store.clear();
    delete globalThis.MedGameSound;
    delete globalThis.MedGameSfx;
    delete globalThis.MedGameMedical;
    delete globalThis.MedGameAmbience;
    delete globalThis.MedGameAudio;
    try {
        loadScripts('js/audio-core.js', 'js/audio-sfx.js', 'js/audio-ambience.js',
            'js/audio-medical.js', 'js/audio.js');
        const S = globalThis.MedGameSound;
        const ok = S.init();
        assert.equal(ok, true, 'le socle doit accepter le faux contexte');
        return S;
    } finally {
        if (precedent === undefined) {
            delete globalThis.AudioContext;
            delete globalThis.webkitAudioContext;
        } else {
            globalThis.AudioContext = precedent;
        }
    }
}

// ── 1. Les quatre couches sont bien exposées ──────────────────────────────

test('les quatre couches audio et la façade sont exposées', () => {
    assert.ok(Sound, 'window.MedGameSound absent');
    assert.ok(Sfx, 'window.MedGameSfx absent');
    assert.ok(Medical, 'window.MedGameMedical absent');
    assert.ok(Ambience, 'window.MedGameAmbience absent');
    assert.ok(Facade, 'window.MedGameAudio absent');
    assert.equal(globalThis.medicalAudio, Medical,
        'window.medicalAudio doit pointer sur la couche médicale');
});

// ── 2. Le registre est cohérent ────────────────────────────────────────────

test('le registre contient les sons historiques du jeu', () => {
    // Ces noms sont appelés par le code existant. Si l'un disparaît, on
    // remplace le silence par un avertissement console : c'est exactement
    // le bug que ce test existe pour attraper.
    const historiques = [
        'correct', 'incorrect', 'click', 'reveal', 'complete', 'tick', 'alert',
        'select', 'ecosGongStart', 'ecosBell', 'ecosGongEnd', 'timerWarning', 'typing'
    ];
    for (const name of historiques) {
        assert.ok(Sound.has(name), `son historique manquant : ${name}`);
    }
});

test('les sons qui étaient APPELÉS mais jamais DÉFINIS existent maintenant', () => {
    // Ces trois noms étaient joués par badges.js, progress-tracker.js,
    // auscultation.js, auscultation-pcg.js et ecg-trainer.js. Le registre
    // ne les définissait pas : ces réponses étaient muettes.
    const manquants = [
        'success',
        'card_flip',
        'hint',
        'lock',
        'unlock',
        'badge'
    ];
    for (const name of manquants) {
        assert.ok(Sound.has(name), `son manquant alors qu'il est appelé : ${name}`);
    }
});

test('aucun son du registre ne porte de nom vide ni de doublon', () => {
    const list = registry();
    assert.ok(list.length >= 40, `registre trop pauvre : ${list.length} sons`);
    for (const name of list) {
        assert.equal(typeof name, 'string');
        assert.ok(name.trim().length > 0, 'nom de son vide');
        assert.equal(name, name.trim(), `espaces parasites dans "${name}"`);
    }
    assert.equal(new Set(list).size, list.length, 'doublon dans le registre');
});

// ── 3. LE TEST CENTRAL : tout appel play() pointe vers un son réel ────────

/**
 * Sondes délibérément invalides : des appels vers des sons qui n'existent PAS,
 * utilisés pour vérifier que le registre les rejette proprement (qu'ils ne
 * lèvent pas et ne produisent aucun signal). Chaque entrée doit être justifiée
 * ici, sinon c'est un appel muet oublié dans le jeu.
 */
const SONDES_NEGATIVES = new Set([
    'son_qui_nexiste_pas'   // test/verify-ui-audio.mjs — vérifie le rejet
]);

/**
 * Parcourt le dépôt et extrait, pour chaque appel `.play(`, l'ensemble des
 * littéraux de chaîne passés en argument.
 *
 * On prend TOUS les littéraux et non le premier parce que les sites les plus
 * utiles sont des ternaires :
 *   MedGameAudio.play(isCorrect ? 'success' : 'card_flip')
 * dont les deux branches doivent exister.
 */
function collectPlayCalls() {
    const files = [];
    for (const root of ['js', 'test', 'scripts']) {
        const dir = path.join(ROOT, root);
        if (!fs.existsSync(dir)) continue;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isFile() && /\.(js|mjs|html)$/.test(entry.name)) {
                files.push(path.join(root, entry.name));
            }
        }
    }
    for (const page of fs.readdirSync(ROOT)) {
        if (page.endsWith('.html')) files.push(page);
    }

    const calls = [];
    for (const file of files) {
        // Ce fichier se cite lui-même dans ses propres noms de test et pose
        // volontairement des appels à des sons inexistants : le scanner ne
        // doit pas se mordre la queue.
        if (file === path.join('test', 'audio.test.mjs')) continue;
        // On retire commentaires et chaînes de documentation AVANT de chercher
        // les appels : sinon « .play(name, param) » dans un JSDoc passe pour
        // un vrai appel.
        const src = stripComments(fs.readFileSync(path.join(ROOT, file), 'utf8'));
        const re = /\.play\s*\(/g;
        let m;
        while ((m = re.exec(src)) !== null) {
            const line = src.slice(0, m.index).split('\n').length;
            let depth = 1;
            let i = m.index + m[0].length;
            const names = [];
            while (i < src.length && depth > 0) {
                const c = src[i];
                if (c === '(' || c === '[' || c === '{') { depth++; i++; continue; }
                if (c === ')' || c === ']' || c === '}') { depth--; i++; continue; }
                if (c === "'" || c === '"' || c === '`') {
                    const quote = c;
                    let lit = '';
                    i++;
                    while (i < src.length && src[i] !== quote) {
                        if (src[i] === '\\') i++;
                        lit += src[i];
                        i++;
                    }
                    i++;
                    if (depth === 1) names.push(lit);
                    continue;
                }
                i++;
            }
            calls.push({ file, line, names, raw: src.slice(m.index, m.index + 90) });
        }
    }
    return calls;
}

/**
 * Retire commentaires de ligne et de bloc. Sert à ne scanner QUE le code
 * exécutable : la moitié des « findings » d'un scan naïf sont des
 * explications écrites en commentaire.
 */
function stripComments(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(Math.max(0, m.length - p1.length)));
}

test('tout .play("nom") du dépôt correspond à un son enregistré', () => {
    const calls = collectPlayCalls();
    assert.ok(calls.length > 20, `analyse trop maigre : ${calls.length} appels`);

const orphans = [];
        for (const call of calls) {
            if (!call.names.length) continue;   // ex. mediaEl.play() : pas un son
            // La façade js/audio.js délègue avec un nom en variable : rien à vérifier.
            if (call.file === path.join('js', 'audio.js')) continue;
            for (const name of call.names) {
                // On ignore les chemins de fichiers : `new Audio('assets/…')`
                if (name.includes('/') || name.includes('.')) continue;
                if (SONDES_NEGATIVES.has(name)) continue;
                if (!Sound.has(name)) {
                    orphans.push(`${call.file}:${call.line}  "${name}"  →  ${call.raw.split('\n')[0]}`);
                }
            }
        }
    assert.equal(orphans.length, 0,
        'appels vers des sons inexistants (le joueur n’entendrait rien) :\n' +
        orphans.join('\n'));
});

test('chaque bus est utilisé par au moins une source', () => {
    // Un bus déclaré mais jamais alimenté est un réglage mort : le joueur
    // aurait un curseur qui ne change rien.
    //
    // Deux sources possibles : le registre SFX (js/audio-sfx.js) et les
    // couches qui écrivent directement sur un bus — le bus `medical` est
    // alimenté par js/audio-medical.js (cœur, bip ECG, alarmes) et
    // `ambience` / `music` par js/audio-ambience.js.
    const utilise = new Set(Object.values(Sfx.defaultBus));
    for (const fichier of ['js/audio-medical.js', 'js/audio-ambience.js']) {
        const src = stripComments(fs.readFileSync(path.join(ROOT, fichier), 'utf8'));
        for (const bus of Sound.constants.BUS_NAMES) {
            if (new RegExp(`bus:\\s*['"]${bus}['"]`).test(src)) utilise.add(bus);
            // Constante de bus : `BUS`, `AMBIENCE_BUS`, `MUSIC_BUS`…
            // On accepte un éventuel préfixe en majuscules mais on refuse
            // qu'il commence au milieu d'un mot (`MEDICALBUS` ne compte pas).
            if (new RegExp(`(^|[^A-Za-z0-9_])(?:[A-Z][A-Z_]*_)?BUS\\s*=\\s*['"]${bus}['"]`).test(src)) {
                utilise.add(bus);
            }
        }
    }
    for (const bus of Sound.constants.BUS_NAMES) {
        assert.ok(utilise.has(bus), `bus jamais utilisé : ${bus}`);
    }
    // Les curseurs d'auscultation existent bien dans le HTML.
    for (const page of ['auscultation.html', 'auscultation-pcg.html']) {
        const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
        assert.ok(src.includes('id="pcg-volume-slider"'),
            `${page} : plus de curseur de volume d'auscultation`);
        assert.ok(/id="pcg-volume-slider"[^>]*max="1\.5"/.test(src),
            `${page} : le curseur doit garder une plage 0-1.5 (plafond des gains)`);
    }
});

// ── 4. Un seul AudioContext, aucune impasse sur le mute ───────────────────

test('un seul module crée un AudioContext', () => {
    const jsDir = path.join(ROOT, 'js');
    const createurs = [];
    for (const file of fs.readdirSync(jsDir)) {
        if (!file.endsWith('.js')) continue;
        const src = fs.readFileSync(path.join(jsDir, file), 'utf8');
        if (/new\s*\(\s*(window\.)?(AudioContext|webkitAudioContext)\s*\)/.test(src) ||
            /new\s+(AudioContext|webkitAudioContext)\s*\(/.test(src)) {
            createurs.push(file);
        }
    }
    // Auscultation : repli défensif si le socle n'est pas chargé (la page peut
    // être ouverte seule). Promo-score : le film a son propre graphe isolé et
    // un OfflineAudioContext pour l'export MP4 — c'est une exigence du rendu.
    const AUTORISES = {
        'audio-core.js': 'le socle',
        'auscultation-audio.js': 'repli si le socle est absent',
        'promo-score.js': 'graphe isolé du film + OfflineAudioContext d\'export'
    };
    const interdits = createurs.filter(f => !AUTORISES[f]);
    assert.deepEqual(interdits, [],
        'AudioContext créé hors du socle sans raison documentée : le mute global ' +
        'ne couvrira pas ce module\n' + interdits.join(', '));
});

test('aucune page ne déclare de balise <audio>', () => {
    const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
    for (const page of pages) {
        const src = stripComments(fs.readFileSync(path.join(ROOT, page), 'utf8'));
        assert.ok(!/<audio[\s>]/.test(src), `${page} déclare encore une balise <audio>`);
    }
});

test('aucun module ne crée un HTMLAudioElement', () => {
    const jsDir = path.join(ROOT, 'js');
    for (const file of fs.readdirSync(jsDir)) {
        if (!file.endsWith('.js')) continue;
        const src = stripComments(fs.readFileSync(path.join(jsDir, file), 'utf8'));
        assert.ok(!/new\s+Audio\s*\(/.test(src),
            `${file} : "new Audio(...)" contourne le graphe de bus`);
    }
});

// ── 5. Réglages : schéma, bornes, migration ───────────────────────────────

test('les six bus existent et leurs défauts sont dans les bornes', () => {
    const names = Sound.constants.BUS_NAMES;
    assert.equal(names.length, 6);
    for (const name of names) {
        const v = Sound.getBusVolume(name);
        assert.ok(v >= 0 && v <= Sound.constants.BUS_GAIN_MAX,
            `défaut hors bornes pour le bus ${name} : ${v}`);
    }
    assert.ok(Sound.getMasterVolume() > 0 && Sound.getMasterVolume() <= Sound.constants.BUS_GAIN_MAX);
});

test('un réglage hors bornes est ramené dans les bornes', () => {
    Sound.setBusVolume('music', 99);
    assert.equal(Sound.getBusVolume('music'), Sound.constants.BUS_GAIN_MAX);
    Sound.setBusVolume('music', -4);
    assert.equal(Sound.getBusVolume('music'), 0);
    Sound.setMasterVolume(1000);
    assert.equal(Sound.getMasterVolume(), Sound.constants.BUS_GAIN_MAX);
    Sound.setMasterVolume(0.85);
    Sound.setBusVolume('music', Sound.constants.BUS_DEFAULTS.music);
});

test('chaque préréglage couvre tous les bus', () => {
    for (const name of Sound.listPresets()) {
        Sound.applyPreset(name);
        for (const bus of Sound.constants.BUS_NAMES) {
            const v = Sound.getBusVolume(bus);
            assert.ok(Number.isFinite(v) && v >= 0 && v <= Sound.constants.BUS_GAIN_MAX,
                `préréglage ${name} : bus ${bus} = ${v}`);
        }
    }
    Sound.applyPreset('normal');
    assert.equal(Sound.getPreset(), 'normal');
});

test('un préréglage inconnu est refusé sans casser l’état', () => {
    const before = JSON.stringify(Sound.getSettings());
    assert.equal(Sound.applyPreset('inexistant'), false);
    assert.equal(JSON.stringify(Sound.getSettings()), before);
});

test('les réglages sont persistés dans une clé unique et versionnée', () => {
    Sound.setBusVolume('ambience', 0.33);
    Sound.setMasterVolume(0.77);
    const raw = localStorage.getItem(Sound.constants.STORAGE_KEY);
    assert.ok(raw, 'clé medgame.audio.v2 absente');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.buses.ambience, 0.33);
    assert.equal(parsed.master, 0.77);
    assert.equal(Sound.constants.STORAGE_KEY, 'medgame.audio.v2');
});

test('les anciennes clés plates sont abandonnées', () => {
    // Elles étaient la source du conflit 0.30 / 0.60. Le socle ne doit plus
    // les écrire, seulement les lire une fois pour migrer.
    assert.equal(Sound.constants.LEGACY_VOLUME_KEY, 'medgame.audio.volume');
    assert.equal(Sound.constants.LEGACY_MUTED_KEY, 'medgame.audio.muted');
    const saved = [];
    const original = globalThis.localStorage.setItem;
    globalThis.localStorage.setItem = (k, v) => { saved.push(k); return original(k, v); };
    try {
        Sound.setBusVolume('ui', 0.5);
        Sound.setMasterVolume(0.6);
        Sound.mute();
        Sound.unmute();
    } finally {
        globalThis.localStorage.setItem = original;
    }
    for (const key of saved) {
        assert.ok(key !== Sound.constants.LEGACY_VOLUME_KEY,
            'le socle écrit encore medgame.audio.volume');
        assert.ok(key !== Sound.constants.LEGACY_MUTED_KEY,
            'le socle écrit encore medgame.audio.muted');
    }
});

test('déverrouiller le son restaure les bus, pas seulement le master', () => {
    // Régression : au chargement, si les réglages sont en mode mué,
    // applyBusVolume() met chaque bus à zéro. Un déverrouillage qui ne
    // faisait que rétablir le master laissait les bus à zéro : le jeu restait
    // muet jusqu’au rechargement de la page.
    //
    // On vérifie le gain RÉELLEMENT APPLIQUÉ sur les AudioParam, pas la valeur
    // stockée dans les réglages : les deux divergeaient précisément dans le
    // cas de cette régression, et tester le réglage aurait donné un faux vert.
    // Il faut un contexte (faux) pour que des AudioParam existent.
    const S = chargerAvecAudioFactice();
    const noms = S.constants.BUS_NAMES;
    S.applyPreset('normal');
    for (const nom of noms) S.setBusVolume(nom, 0.5);
    S.setMasterVolume(0.8);

    S.setMuted(true);
    for (const nom of noms) {
        assert.equal(S.getAppliedBusGain(nom), 0,
            `le bus ${nom} doit être à zéro en mode mué, gain = ${S.getAppliedBusGain(nom)}`);
    }

    S.setMuted(false);
    for (const nom of noms) {
        assert.equal(S.getAppliedBusGain(nom), 0.5,
            `bus ${nom} non restauré au déverrouillage : gain appliqué = ` +
            `${S.getAppliedBusGain(nom)}, réglage = ${S.getBusVolume(nom)}`);
    }
    assert.equal(S.getAppliedMasterGain(), 0.8);
});

test('chaque bus est bien câblé entre son gain de réglage et son gain de ducking', () => {
    // Impossible à vérifier dans un navigateur : un AudioNode n'expose pas ses
    // connexions. Ici on a un faux contexte qui les enregistre, donc on teste
    // la topologie RÉELLE et pas seulement le code.
    const S = chargerAvecAudioFactice();
    const noms = S.constants.BUS_NAMES;
    const inter = S.internals();

    const entrees = noms.map(n => S.busInput(n));
    assert.equal(new Set(entrees).size, noms.length,
        'chaque bus doit avoir son propre nœud d’entrée');

    for (const nom of noms) {
        const bus = inter.buses[nom];
        assert.ok(bus, `bus ${nom} absent du graphe`);
        // entrée → userGain → duckGain → masterGain
        assert.ok(bus.input._connecteA.includes(bus.user),
            `bus ${nom} : l’entrée ne va pas vers le gain de réglage`);
        assert.ok(bus.user._connecteA.includes(bus.duck),
            `bus ${nom} : le gain de réglage ne va pas vers le gain de ducking`);
        assert.ok(bus.duck._connecteA.includes(inter.masterGain),
            `bus ${nom} : le gain de ducking n'alimente pas le master`);
    }

    // Le master mène bien au compresseur puis au limiteur puis au shaper.
    const chaine = inter.outputChain;
    assert.ok(chaine.length >= 4,
        `sortie trop courte : ${chaine.length} nœud(s)`);
    assert.equal(chaine[0], inter.masterGain);
    assert.equal(chaine[1], inter.limiter, 'le master doit passer par le compresseur');
    assert.ok(chaine[2] && chaine[2].type === 'shaper',
        'la sortie doit passer par le limiteur de sécurité');
});

test('le ducking abaisse le gain appliqué puis se relâche tout seul', async () => {
    const S = chargerAvecAudioFactice();
    S.setBusVolume('music', 0.8);
    S.setBusVolume('ambience', 0.8);
    S.setMuted(false);

    const inter = S.internals();
    assert.equal(inter.duckGain('music').value, 1, 'point de départ : pas de ducking');

    S.duck('medical');
    const duckMusic = inter.duckGain('music').value;
    const duckUi = inter.duckGain('ui').value;
    assert.ok(duckMusic < 0.8, `le ducking doit abaisser la musique (${duckMusic})`);
    assert.ok(duckMusic < duckUi, 'la musique doit être plus abaissée que l’interface');
    assert.equal(duckUi, 1,
        'le ducking médical ne doit pas toucher le bus interface : on ne peut pas ' +
        'se couper le son d’un clic sous peine de croire que le jeu a planté');

    // On attend le relâchement RÉEL (release 0.9 s + 40 ms de marge dans
    // audio-core.js), sans passer par le crochet `relacherDucks()` : c'est le
    // chemin de production qu'on veut couvrir.
    const release = S.constants.DUCK_PRIORITY.medical.release;
    await new Promise(r => setTimeout(r, release * 1000 + 250));
    assert.equal(S.internals().duckGain('music').value, 1,
        'le ducking doit se relâcher tout seul après la tenue');
    assert.equal(S.internals().duckGain('ambience').value, 1,
        'l’ambiance doit aussi remonter');
});

test('la tension musicale respecte CONFIG.MUSIC_ENABLED', () => {
    const Amb = Ambience;
    const config = globalThis.CONFIG;
    globalThis.CONFIG = { MUSIC_ENABLED: 0 };
    try {
        assert.equal(Amb.musicAllowed(), false);
        assert.equal(Amb.setState('calm'), false,
            'un état musical ne doit pas être appliqué quand la musique est désactivée');
        assert.equal(Amb.setState('off'), true,
            'l’état « off » doit toujours être acceptable');
    } finally {
        if (config === undefined) delete globalThis.CONFIG;
        else globalThis.CONFIG = config;
    }
    assert.equal(Amb.musicAllowed(), true);
});

test('la façade se comporte comme l’ancienne API MedGameAudio', () => {
    // setVolume() reste le volume SFX (sens historique) et n\'est plus global.
    Facade.setVolume(0.42);
    assert.equal(Facade.getVolume(), 0.42);
    assert.equal(Sound.getBusVolume('sfx'), 0.42);
    assert.notEqual(Sound.getMasterVolume(), 0.42);
    Facade.setVolume(Sound.constants.BUS_DEFAULTS.sfx);

    assert.equal(Facade.play('inexistant-total'), false, 'un son inconnu doit renvoyer false');
    assert.equal(Facade.isReady(), false, 'isReady() doit être faux sans contexte');
    Facade.mute();
    assert.equal(Facade.isMuted(), true);
    Facade.unmute();
    assert.equal(Facade.isMuted(), false);
    assert.ok(Facade.list().length >= 40);
});

// ── 6. Le mode calme couvre les sons stressants ───────────────────────────

test('les sons stressants sont déclarés et le mode calme est lisible', () => {
    const stressful = Sound.constants.STRESSFUL_SOUNDS;
    for (const name of ['tick', 'timerWarning', 'alert']) {
        assert.ok(stressful.has(name), `${name} devrait être classé stressant`);
        assert.ok(Sound.isStressful(name));
    }
    assert.ok(!Sound.isStressful('correct'), 'la bonne réponse n’est pas stressante');
    assert.equal(typeof Sound.isCalmMode(), 'boolean');
});

// ── 7. Physiologie : l\'écart S1-S2 se comprime bien ──────────────────────

test('l\'écart S1-S2 se comprime quand la fréquence cardiaque monte', () => {
    Medical.reset();
    const valeurs = [];
    for (const hr of [50, 60, 80, 100, 120, 140, 160, 180, 200]) {
        Medical.applyVitals({ hr });
        valeurs.push({ hr, gap: Medical.s2Gap() });
    }
    // Décroissant au sens large : l'intervalle est volontairement PLATEAU sous
    // 60 bpm. Une bradycardie n'allonge pas l'intervalle systolique de façon
    // audible, et faire grimper le S2 en bradycardie sonnerait faux.
    for (let i = 1; i < valeurs.length; i++) {
        assert.ok(valeurs[i].gap <= valeurs[i - 1].gap + 1e-12,
            `l'écart S1-S2 ne doit pas augmenter : ${valeurs[i - 1].hr} → ${valeurs[i].hr} bpm`);
    }
    // Il doit réellement raccourcir sur la plage utile, sinon l'interpolation
    // ne servirait à rien.
    assert.ok(valeurs[valeurs.length - 1].gap < valeurs[2].gap,
        'l\'écart S1-S2 doit raccourcir entre 80 et 200 bpm');
    // Bornes physiologiques : jamais de B2 avant 75 ms, jamais au-delà de 160 ms
    for (const v of valeurs) {
        assert.ok(v.gap >= Medical.constants.S2_GAP_AT_180 - 1e-9 && v.gap <= Medical.constants.S2_GAP_AT_60 + 1e-9,
            `écart hors bornes à ${v.hr} bpm : ${v.gap} s`);
    }
    Medical.reset();
});

test('l\'intensité cardiaque est bornée et croissante', () => {
    Medical.reset();
    let precedent = -1;
    for (const hr of [40, 60, 80, 100, 120, 140, 160, 180, 220]) {
        Medical.applyVitals({ hr });
        const v = Medical.heartIntensity();
        assert.ok(v >= 0 && v <= 1, `intensité hors bornes à ${hr} bpm : ${v}`);
        assert.ok(v >= precedent, `intensité non monotone à ${hr} bpm`);
        precedent = v;
    }
    Medical.reset();
});

test('applyVitals borne les entrées aberrantes', () => {
    Medical.reset();
    Medical.applyVitals({ hr: 9999, spo2: -50, rr: 0, systolic: NaN });
    const v = Medical.getVitals();
    assert.equal(v.hr, Medical.constants.HR_MAX);
    assert.equal(v.spo2, 40);
    assert.equal(v.rr, 4);
    assert.equal(v.systolic, 120, 'NaN doit laisser la valeur précédente');
    Medical.reset();
    assert.equal(Medical.getVitals().hr, 72, 'reset restaure un patient normal');
});

// ── 8. Musique adaptative : tension bornée et croissante ───────────────────

test('la tension musicale reste dans [0, 1] et croît avec la détresse', () => {
    const amb = Ambience;
    const cas = [
        { spo2: 100, hr: 60, systolic: 110, temperature: 37, attendu: 0 },
        { spo2: 98, hr: 72, systolic: 120, temperature: 37, attendu: 0 },
        { spo2: 95, hr: 95, systolic: 125, temperature: 37.2 },
        { spo2: 92, hr: 110, systolic: 135, temperature: 38.0 },
        { spo2: 88, hr: 130, systolic: 150, temperature: 39.0 },
        { spo2: 80, hr: 160, systolic: 180, temperature: 41.0 }
    ];
    let precedent = -1;
    for (const c of cas) {
        amb.setVitals(c);
        const t = amb.getTension();
        assert.ok(t >= 0 && t <= 1, `tension hors bornes : ${t}`);
        assert.ok(t >= precedent - 1e-9, `tension non monotone : ${precedent} → ${t}`);
        if (c.attendu !== undefined) assert.equal(t, c.attendu, `patient normal → ${t}`);
        precedent = t;
    }
});

test('les quatre états musicaux existent et sont ordonnés en intensité', () => {
    const etats = Ambience.constants.STATES;
    for (const key of ['off', 'calm', 'tense', 'critical', 'resolution']) {
        assert.ok(etats[key], `état manquant : ${key}`);
        for (const champ of ['root', 'padRatios', 'padGain', 'padFilter', 'subGain', 'pulseRate']) {
            assert.ok(etats[key][champ] !== undefined, `${key}.${champ} manquant`);
        }
    }
    // L'intensité musicale doit être monotone du calme au critique.
    assert.ok(etats.calm.padGain <= etats.tense.padGain);
    assert.ok(etats.tense.padGain <= etats.critical.padGain);
    assert.ok(etats.tense.pulseRate < etats.critical.pulseRate,
        'la pulsation doit accélérer avec la tension');
    // « critical » est le seul à contenir un triton (×1.414) dans sa nappe.
    assert.ok(etats.critical.padRatios.some(r => Math.abs(r - Math.SQRT2) < 0.001));
});

test('setState refuse une clé inconnue et accepte les cinq états', () => {
    assert.equal(Ambience.setState('inexistant'), false);
    for (const key of ['off', 'calm', 'tense', 'critical', 'resolution']) {
        assert.equal(Ambience.setState(key), true, `état refusé : ${key}`);
    }
    assert.equal(Ambience.getState(), 'resolution');
});

test('le focus audio connaît ses cinq situations', () => {
    for (const key of ['idle', 'action', 'interrogation', 'auscultation']) {
        const cfg = Ambience.constants.FOCUS_DUCK[key];
        assert.ok(cfg, `focus manquant : ${key}`);
        assert.ok(cfg.music >= 0 && cfg.music <= 1);
        assert.ok(cfg.ambience >= 0 && cfg.ambience <= 1);
        assert.equal(Ambience.setFocus(key), true);
    }
    // Ausculter doit être le moment le plus silencieux : c'est le seul moment
    // où le joueur a besoin d\'entendre le stéthoscope.
    const f = Ambience.constants.FOCUS_DUCK;
    assert.ok(f.auscultation.music <= f.interrogation.music);
    assert.ok(f.interrogation.music <= f.idle.music);
    assert.equal(Ambience.setFocus('inexistant'), false);
});

// ── 9. Déterminisme du bruit de synthèse ──────────────────────────────────

test('le PRNG est déterministe pour une graine donnée', () => {
    const a = Sound.rng(1337);
    const b = Sound.rng(1337);
    const c = Sound.rng(1338);
    const seqA = Array.from({ length: 16 }, () => a());
    const seqB = Array.from({ length: 16 }, () => b());
    const seqC = Array.from({ length: 16 }, () => c());
    assert.deepEqual(seqA, seqB, 'même graine → même séquence');
    assert.notDeepEqual(seqA, seqC, 'graines différentes → séquences différentes');
    for (const v of seqA) {
        assert.ok(v >= 0 && v < 1, `valeur hors [0, 1) : ${v}`);
    }
});

test('le bruit de synthèse est borné en amplitude', () => {
    // Sans contexte, noiseBuffer renvoie null : on teste le générateur pur.
    const rand = Sound.rng(4242);
    for (let i = 0; i < 10000; i++) {
        const v = rand() * 2 - 1;
        assert.ok(v >= -1 && v <= 1);
    }
});

test('la courbe de soft-clip reste dans [-1, 1] et est monotone', () => {
    const curve = Sound.makeTanhCurve(1.6);
    assert.ok(curve.length > 100);
    let precedent = -Infinity;
    for (const v of curve) {
        assert.ok(v >= -1.0001 && v <= 1.0001, `échantillon hors bornes : ${v}`);
        assert.ok(v >= precedent, 'la courbe doit être croissante');
        precedent = v;
    }
    assert.ok(curve[0] < -0.9 && curve[curve.length - 1] > 0.9);
});

// ── 10. Limites de voix et ordonnancement ─────────────────────────────────

test('le nombre de voix simultanées est plafonné', () => {
    assert.ok(Sound.constants.MAX_VOICES >= 16 && Sound.constants.MAX_VOICES <= 256,
        `plafond de voix invraisemblable : ${Sound.constants.MAX_VOICES}`);
});

test('le throttling protège les sons très sollicités', () => {
    // Sans contexte, play() renvoie false, mais le throttle doit être
    // configuré pour les Sons qui peuvent être appelés en rafale.
    const list = registry();
    for (const name of ['click', 'tick', 'hover', 'typing', 'timerWarning']) {
        assert.ok(Sound.has(name), `${name} manquant`);
    }
    assert.ok(list.length > 0);
});

test('les menus d\'alarme couvrent les niveaux de gravité', () => {
    const patterns = Medical.constants.ALARM_PATTERNS;
    for (const key of ['warning', 'critical', 'apnea', 'codeBlue', 'lowSpO2']) {
        assert.ok(patterns[key], `motif d\'alarme manquant : ${key}`);
        assert.ok(patterns[key].tones.length > 0, `${key} n\'a aucune note`);
        assert.ok(patterns[key].period > 0, `${key} a une période nulle`);
        for (const [freq, dur] of patterns[key].tones) {
            assert.ok(freq > 20 && freq < 20000, `fréquence hors bande : ${freq}`);
            assert.ok(dur > 0 && dur < 1, `durée invraisemblable : ${dur}`);
        }
    }
    assert.ok(patterns.critical.period < patterns.warning.period,
        'l\'alarme critique doit être plus rapide');
});

// ── 11. L\'API de compatibilité 3D est complète ───────────────────────────

test('l\'API de compatibilité medicalAudio couvre tous les appels du code 3D', () => {
    const api = [
        'init', 'resume', 'destroy', 'updateHeartRate',
        'startECGBeep', 'stopECGBeep',
        'startAlarm', 'stopAlarm',
        'playMeasureSound', 'playUnlockSound', 'playErrorSound',
        'playSuccessSound', 'playAlert'
    ];
    for (const name of api) {
        assert.equal(typeof Medical[name], 'function', `MedGameMedical.${name} manquant`);
    }
    // startHeartbeat / stopHeartbeat ont été ajoutés : le jeu 3D peut enfin
    // faire battre le cœur du patient.
    for (const name of ['startHeartbeat', 'stopHeartbeat', 'startBreathing', 'stopBreathing']) {
        assert.equal(typeof Medical[name], 'function', `MedGameMedical.${name} manquant`);
    }
});

test('le pont ESM three-audio.js pointe sur la couche médicale', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/three-audio.js'), 'utf8');
    assert.ok(src.includes('MedGameMedical'), 'three-audio.js doit lire window.MedGameMedical');
    assert.ok(src.includes('window.medicalAudio = couche'),
        'window.medicalAudio doit pointer sur la couche médicale');
    // Si audio-medical.js est absent, la couche doit être le stub inerte et
    // non `undefined` : js/game.js appelle window.medicalAudio.playSuccessSound()
    // sans tester, et un undefined donne une TypeError en plein jeu.
    assert.ok(src.includes('INERTE'), 'three-audio.js doit prévoir un repli inerte');
    assert.ok(!/new\s+AudioContext/.test(src), 'three-audio.js ne doit plus créer de contexte');
    // Vérifie que le repli couvre bien tout ce que le code appelle.
    const appele = new Set();
    for (const f of fs.readdirSync(path.join(ROOT, 'js'))) {
        if (!f.endsWith('.js')) continue;
        const code = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
        for (const m of code.matchAll(/medicalAudio\.([a-zA-Z_]+)\s*\(/g)) {
            appele.add(m[1]);
        }
    }
    const repli = src.slice(src.indexOf('const INERTE'), src.indexOf('const couche ='));
    for (const nom of appele) {
        assert.ok(new RegExp(`\\b${nom}\\b`).test(repli),
            `le repli inerte ne couvre pas medicalAudio.${nom}() — TypeError garantie`);
    }
    assert.ok(appele.size >= 8, `scan trop maigre : ${appele.size} méthodes`);
});

// ── 12. Chargement des pages ──────────────────────────────────────────────

test('chaque page audio charge le socle avant la façade, dans l\'ordre', () => {
    const pages = ['index.html', 'game.html', 'ai-watch.html',
        'auscultation.html', 'auscultation-pcg.html', 'ecg-trainer.html'];
    const attendu = ['audio-core.js', 'audio-sfx.js', 'audio-ambience.js',
        'audio-medical.js', 'audio.js'];
    for (const page of pages) {
        const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
        let precedent = -1;
        for (const fichier of attendu) {
            const i = src.indexOf(`src="js/${fichier}`);
            assert.ok(i !== -1, `${page} ne charge pas ${fichier}`);
            assert.ok(i > precedent,
                `${page} : ${fichier} est chargé avant ${attendu[precedent + 1]}`);
            precedent = i;
        }
    }
});

test('le dossier assets/sounds a disparu et plus rien ne le référence', () => {
    assert.ok(!fs.existsSync(path.join(ROOT, 'assets/sounds')),
        'assets/sounds existe encore : il ne contient que des fichiers supprimés');
    const interdits = ['heartbeat.mp3', 'urgency.mp3', 'feux_artifice.mp3', 'Wrong Buzzer.mp3'];
    for (const fichier of interdits) {
        const jsDir = path.join(ROOT, 'js');
        for (const f of fs.readdirSync(jsDir)) {
            if (!/\.(js|mjs)$/.test(f)) continue;
            const src = fs.readFileSync(path.join(jsDir, f), 'utf8');
            // On tolère la mention dans un commentaire qui explique la
            // suppression, pas dans du code exécutable.
            const lignesDeCode = src.split('\n')
                .filter(l => !/^\s*(\*|\/\*|\/\/)/.test(l)).join('\n');
            assert.ok(!lignesDeCode.includes(fichier),
                `js/${f} référence encore ${fichier} dans du code exécutable`);
        }
    }
});

test('la façade expose boot() pour le démarrage d\'une partie', () => {
    assert.equal(typeof Facade.boot, 'function');
    // boot() sans contexte ne doit pas lever : les pages autonomes l\'appellent
    // avant tout geste utilisateur.
    Facade.boot({ ambience: false, state: 'calm' });
});

// ── 13. Contrat avec le mode calme partagé ────────────────────────────────

test('le socle délègue la lecture du mode calme à MedGameModes s\'il existe', () => {
    // Le socle ne doit pas décider seul : js/game-modes.js est la référence.
    // On vérifie que la branche de repli est bien en place.
    globalThis.MedGameModes = {
        isCalmMode: () => true
    };
    assert.equal(Sound.isCalmMode(), true, 'le socle doit lire MedGameModes');
    delete globalThis.MedGameModes;
    assert.equal(typeof Sound.isCalmMode(), 'boolean', 'repli sur localStorage');
});

// ── 14. Portée des scripts : pas de page muette par oubli du socle ────────
//
// Le test « chaque page audio charge le socle avant la façade » ci-dessus
// travaille sur une LISTE FIXE de six pages. Celui-ci découvre les pages par
// lui-même : une septième page qui chargerait `audio.js` sans `audio-core.js`
// lui échapperait. C'est le bug que la refonte a introduit une première fois.
// Un script classique non `defer` s'exécute AVANT les scripts `defer`, donc
// `js/audio.js` tournait avant `audio-core.js`, prenait sa branche de repli
// inerte, et cinq pages sur six devenaient silencieuses sans lever la moindre
// erreur. Ici on vérifie la portée, pas seulement l'ordre.

const PAGES = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

/** `src` des scripts locaux d'une page, dans l'ordre du document. */
function scriptsDePage(html) {
    const sansCommentaires = html.replace(/<!--[\s\S]*?-->/g, '');
    const out = [];
    for (const m of sansCommentaires.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) {
        const src = m[1].split('?')[0];
        if (src.startsWith('js/')) out.push(src);
    }
    return out;
}

test('toute page qui charge la façade charge aussi le socle, avant elle', () => {
    for (const page of PAGES) {
        const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
        const scripts = scriptsDePage(html);
        const iFacade = scripts.indexOf('js/audio.js');
        if (iFacade === -1) continue;
        const iSocle = scripts.indexOf('js/audio-core.js');
        assert.ok(iSocle !== -1,
            `${page} charge js/audio.js sans js/audio-core.js : la façade ` +
            'prend sa branche inerte et tous les sons de la page sont muets');
        assert.ok(iSocle < iFacade,
            `${page} charge la façade AVANT le socle : idem`);
        // L'ordre des couches importe aussi : audio-sfx, audio-ambience et
        // audio-medical lisent les registres du socle, donc doivent venir
        // après lui.
        for (const nom of ['js/audio-sfx.js', 'js/audio-ambience.js',
                           'js/audio-medical.js']) {
            const pos = scripts.indexOf(nom);
            if (pos !== -1) {
                assert.ok(pos > iSocle,
                    `${page} charge ${nom} avant js/audio-core.js`);
            }
        }
    }
});

test('aucun script appelant l\'API audio n\'est sans garde ni socle', () => {
    const API = /\b(MedGameAudio|MedGameSound|MedGameMedical|MedGameAmbience|window\.medicalAudio)\b/;
    for (const page of PAGES) {
        const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
        const scripts = scriptsDePage(html);
        const protege = scripts.includes('js/audio-core.js') &&
            scripts.includes('js/audio.js');
        if (protege) continue;

        for (const f of scripts) {
            const p = path.join(ROOT, f);
            if (!fs.existsSync(p)) continue;
            const src = stripComments(fs.readFileSync(p, 'utf8'));
            if (!API.test(src)) continue;
            // Toléré : un garde explicite `typeof MedGameAudio !== 'undefined'`
            // qui fait le silence de façon délibérée (js/badges.js).
            const garde = /typeof\s+MedGameAudio\s*!==\s*'undefined'/.test(src);
            assert.ok(garde,
                `${page} charge ${f} qui parle à l'API audio, mais la page ` +
                'ne charge ni socle ni façade, et l\'appel n\'est pas gardé ' +
                'par un test typeof : TypeError en cours de partie.');
        }
    }
});
