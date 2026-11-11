/**
 * Vue 3D : géométrie d'écran et règles d'interaction.
 *
 * `js/three-view-core.js` est pur (aucun import) : on le teste directement.
 * Les vérifications statiques du bas verrouillent ce que la refonte des
 * interactions a corrigé, parce que chacun de ces défauts était SILENCIEUX
 * (aucune erreur console, aucun test rouge).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    clientToNDC, escapeTarget, dialogueShot, viewShiftFor, placeBubble, avatarTooClose, PANEL_PRIORITY, vitalLevel,
} from '../js/three-view-core.js';

const lire = (f) => fs.readFileSync(path.resolve(f), 'utf8');
const RECT = { left: 100, top: 50, width: 800, height: 400 };

test('clientToNDC : les quatre coins et le centre du canvas', () => {
    assert.deepEqual(clientToNDC(500, 250, RECT), { x: 0, y: 0 });
    assert.deepEqual(clientToNDC(100, 50, RECT), { x: -1, y: 1 }, 'coin haut-gauche');
    assert.deepEqual(clientToNDC(900, 450, RECT), { x: 1, y: -1 }, 'coin bas-droit');
});

test('clientToNDC : tout point du canvas reste dans le champ [-1, 1]', () => {
    for (let y = RECT.top; y <= RECT.top + RECT.height; y += 40) {
        const p = clientToNDC(300, y, RECT);
        assert.ok(p.y >= -1 && p.y <= 1, `y=${p.y} hors champ : le survol ne toucherait plus rien`);
    }
});

test('le raycast de three-scene.js passe par clientToNDC (plus de conversion recopiée)', () => {
    const src = lire('js/three-scene.js');
    assert.match(src, /clientToNDC\(this\._pointerClient\.x, this\._pointerClient\.y/);
    assert.doesNotMatch(src, /rect\.height\) \* 2 - 1/, 'ancienne conversion au signe faux');
});

test('escapeTarget : ferme le panneau du dessus avant tout', () => {
    assert.deepEqual(escapeTarget({ openPanels: ['dialog', 'pc'], cameraMode: 'desk' }), { action: 'close', panel: 'pc' });
    assert.deepEqual(escapeTarget({ openPanels: ['dialog'], cameraMode: 'dialogue' }), { action: 'close', panel: 'dialog' });
    assert.equal(PANEL_PRIORITY[0], 'armoire');
});

test('escapeTarget : puis vue d\'ensemble, et seulement ensuite sortie de la 3D', () => {
    assert.deepEqual(escapeTarget({ openPanels: [], cameraMode: 'patient' }), { action: 'room' });
    assert.deepEqual(escapeTarget({ openPanels: [], cameraMode: 'room' }), { action: 'exit' });
});

test('escapeTarget : ne vole pas Échap à une modale du jeu', () => {
    assert.deepEqual(escapeTarget({ openPanels: [], cameraMode: 'room', modalOpen: true }), { action: 'none' });
});

test('dialogueShot : plan rapproché, à hauteur de visage, côté médecin', () => {
    const head = [4.7, 1.34, -0.16];
    const { pos, target } = dialogueShot(head);
    const d = Math.hypot(pos[0] - head[0], pos[1] - head[1], pos[2] - head[2]);
    assert.ok(d > 1.4 && d < 2.1, `distance ${d.toFixed(2)} m`);
    assert.ok(pos[0] < head[0], 'caméra du côté du médecin (x plus petit que le lit)');
    assert.ok(pos[2] > head[2], 'caméra vers le pied du lit : elle voit le visage');
    assert.ok(Math.abs(pos[1] - head[1]) < 0.4, 'à hauteur de visage, pas en plongée');
    assert.ok(Math.abs(target[1] - head[1]) < 0.15);
});

test('viewShiftFor : le sujet tombe au centre de la zone libre', () => {
    assert.equal(viewShiftFor(1366, null), 0);
    assert.equal(viewShiftFor(600, { left: 280, width: 300 }), 0, 'écran étroit : pas de décalage');
    const s = viewShiftFor(1366, { left: 726, width: 620 });
    // Centre de la zone libre = 363 px ; centre de l'écran = 683 px.
    assert.ok(Math.abs(s - (683 - 363) / 1366) < 1e-9);
    assert.ok(viewShiftFor(1366, { left: 10, width: 1300 }) <= 0.3, 'borné');
});

test('placeBubble : au-dessus de la tête, à l\'écran, hors du panneau', () => {
    const vp = { width: 1366, height: 768 };
    assert.equal(placeBubble({ x: 400, y: 300, visible: false }, vp), null);
    const p = placeBubble({ x: 400, y: 300, visible: true }, vp);
    assert.equal(p.left, 400);
    assert.equal(p.bottom, 768 - 300 + 26);
    const bord = placeBubble({ x: 5, y: 300, visible: true }, vp);
    assert.ok(bord.left >= 150, 'ne déborde pas à gauche');
    const pres = placeBubble({ x: 900, y: 300, visible: true }, vp, { rightLimit: 726 });
    assert.ok(pres.left + 150 <= 726, 'ne passe pas sous le panneau d\'entretien');
    const haut = placeBubble({ x: 400, y: -50, visible: true }, vp);
    assert.ok(haut.bottom <= 768 - 150, 'ne monte pas sous le bandeau du haut');
});

test('vitalLevel : des constantes normales ne sont plus « critiques » (T° et FR rouges en permanence)', () => {
    assert.equal(vitalLevel('hud-temp', 36.9), 'normal');
    assert.equal(vitalLevel('hud-fr', 16), 'normal');
    assert.equal(vitalLevel('hud-hr', 77), 'normal');
    assert.equal(vitalLevel('hud-spo2', 96), 'normal');
});

test('vitalLevel : les vraies alertes restent signalées, dans les deux sens', () => {
    assert.equal(vitalLevel('hud-temp', 38.9), 'warning');
    assert.equal(vitalLevel('hud-temp', 40.2), 'critical');
    assert.equal(vitalLevel('hud-temp', 34.5), 'critical');
    assert.equal(vitalLevel('hud-fr', 27), 'warning');
    assert.equal(vitalLevel('hud-fr', 6), 'critical');
    assert.equal(vitalLevel('hud-hr', 145), 'critical');
    assert.equal(vitalLevel('hud-hr', 45), 'warning');
    assert.equal(vitalLevel('hud-spo2', 90), 'warning');
    assert.equal(vitalLevel('hud-spo2', 84), 'critical');
    assert.equal(vitalLevel('hud-gly', 5), 'normal', 'champ sans seuil');
});

test('avatarTooClose : la vue bureau est posée dans le médecin, la vue salle non', () => {
    assert.equal(avatarTooClose({ x: -3.35, z: 0.52 }, { x: -3.1, z: 0.3 }), true);
    assert.equal(avatarTooClose({ x: 0.3, z: 4.35 }, { x: -2.1, z: 1.3 }), false);
});

test('panneaux 3D : plus de style néon en ligne (le thème clinique fait foi)', () => {
    for (const f of ['js/three-clinical-agent.js', 'js/three-hud.js']) {
        const src = lire(f);
        assert.doesNotMatch(src, /#00f2fe/i, `${f} : cyan néon`);
    }
    assert.doesNotMatch(lire('js/three-clinical-agent.js'), /style\.cssText/, 'menu d\'examen : style en ligne');
    const mgr = lire('js/three-manager.js');
    const pc = mgr.slice(mgr.indexOf('openPCPanel() {'), mgr.indexOf('closePCPanel() {'));
    assert.doesNotMatch(pc, /style="/, 'le dossier médical ne porte plus de style en ligne');
    assert.match(lire('css/game.css'), /\.clin3d-menu\s*\{/);
});

test('un seul contexte d\'interaction : chaque déplacement prend un jeton', () => {
    const mgr = lire('js/three-manager.js');
    for (const m of ['goToPatient(hitObj) {', 'goToPC() {', 'goToTablet() {', 'goToInstrument(instrument) {']) {
        const i = mgr.indexOf(m);
        assert.ok(i > 0, `${m} introuvable`);
        const corps = mgr.slice(i, i + 700);
        assert.match(corps, /_beginContext\(/, `${m} n'ouvre pas de contexte`);
        assert.match(corps, /token !== this\._ctxToken/, `${m} : arrivée périmée non filtrée`);
    }
    assert.match(mgr, /this\._handleEscape\(\)/, 'Échap passe par la règle graduée');
});

test('porte : huisserie mesurée matrices à jour, hauteur sous le faux plafond', () => {
    const room = lire('js/three-room.js');
    const i = room.indexOf("furniture/door.glb'");
    assert.ok(i > 0);
    const bloc = room.slice(i, i + 1400);
    assert.match(bloc, /doorGroup\.updateMatrixWorld\(true\)/);
    const y = Number(bloc.match(/\{ x: [\d.]+, y: ([\d.]+), z: [\d.]+ \}/)[1]);
    // Le GLB mesure 4,2 m de haut à l'échelle 1 (2,94 m à 0,7).
    const hauteur = y * (2.94 / 0.7);
    assert.ok(hauteur >= 2.0 && hauteur <= 2.3, `porte de ${hauteur.toFixed(2)} m`);
});

test('oxygène : la SpO2 vivante est lue dans props.spo2', () => {
    const mgr = lire('js/three-manager.js');
    const o2 = mgr.slice(mgr.indexOf('applyOxygenMask() {'), mgr.indexOf('goToPC() {'));
    assert.match(o2, /props\?\.spo2/);
    assert.doesNotMatch(o2, /props\.saturationO2\s*=/);
});
