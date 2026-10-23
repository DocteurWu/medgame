/**
 * test/room-materials.test.mjs — Garde-fous de l'habillage de la salle 3D
 *
 * POURQUOI CE TEST EXISTE
 *
 * La salle 3D de MedGame a été relookée (sol PVC, murs à deux tons,
 * plafond à dalles, garde de nuit, scope mural, calques de cinéma). Ces
 *LOOK sont des IMAGES : rien dans les tests fonctionnels ne voit qu'une
 * image soit « belle » ou « cassée ». Ces règles portent donc sur ce qui
 * ne se voit pas à l'œil mais se paie très cher.
 *
 * CE QUE CE TEST PROTÈGE
 *
 *  1. AUCUN MATÉRIAU `transmission`. `renderTransmissionPass()` re-rend
 *     TOUTE la scène à chaque image : 19 s de CPU mesurés sur 60 s de
 *     profil, et le doublement du nombre de programmes de shader. C'est
 *     le piège le plus coûteux du rendu 3D, et il est invisible.
 *  2. LE NOMBRE DE LUMIÈRES NE CHANGE PAS. Chaque source ajoute un bloc
 *     de calcul dans le fragment shader de TOUS les matériaux de la salle,
 *     donc dans la longueur de chaque programme compilé. Passer de 6
 *     sources ponctuelles à 3 avait fait gagner 23,7 s de compilation.
 *  3. LE SCOPE LIT LA SOURCE UNIQUE. `window.vitalSigns.props` est la
 *     seule source des constantes : si le scope se mettait à maintenir sa
 *     propre copie, il afficherait autre chose que le jeu.
 *  4. LES CALQUES NE BLOQUENT PAS LES CLICS. Le grain est posé en
 *     plein écran : sans `pointer-events: none`, on ne pourrait plus
 *     cliquer sur le patient.
 *  5. LE PATIENT RESTE LE MODÈLE GLB. Le relook n'a pas touché au
 *     personnage : le joueur garde le même patient qu'avant.
 *  6. LES OBJETS À DURÉE DE VIE EXTERNE SONT LIBÉRÉS. Le scope tourne sur
 *     un minuteur et les calques sont des nœuds DOM : sans `dispose()`,
 *     ils survivent au retour au 2D.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const MODULES_3D = fs.readdirSync(path.join(ROOT, 'js'))
    .filter((f) => f.startsWith('three-') && f.endsWith('.js'));

/* ------------------------------------------------------------------ */
/* 1. Aucun matériau `transmission`                                    */
/* ------------------------------------------------------------------ */

test('Salle 3D — aucun matériau `transmission` dans les modules 3D', () => {
    // On cherche une PROPRIÉTÉ de matériau, pas le mot dans un commentaire.
    const motif = /transmission\s*:\s*[0-9.]/;
    for (const f of MODULES_3D) {
        const source = lire(path.join('js', f));
        assert.ok(
            !motif.test(source),
            `js/${f} utilise un matériau « transmission » : ` +
            'renderTransmissionPass() re-renderait toute la scène à chaque image'
        );
    }
});

/* ------------------------------------------------------------------ */
/* 2. Le nombre de sources de lumière                                 */
/* ------------------------------------------------------------------ */

test('Salle 3D — l\'agent d\'éclairage crée toujours le même nombre de sources', () => {
    const source = lire('js/three-lighting-agent.js');
    const creations = source.match(/new THREE\.(Point|Spot|Directional|Hemisphere|Ambient)Light/g) || [];
    // 6 sources créées directement + 1 dans l'AIDE `_addPointLight()` (la
    // dalle LED de plafond). Ce nombre est le COSTE du rendu : voir
    // AGENTS.md, « Performance 3D ».
    assert.equal(
        creations.length, 7,
        `l'agent d'éclairage crée ${creations.length} sources au lieu de 7 : ` +
        'chaque source coûte un bloc de calcul dans le shader de tous les matériaux'
    );

    // La dalle de plafond passe par l'AIDE, qui pose `baseIntensity` : c'est
    // cette référence que le réglage d'ambiance clinique proportionnalise.
    assert.ok(
        /_addPointLight\(0, 2\.7/.test(source),
        'la dalle LED de plafond doit être créée via _addPointLight() (baseIntensity)'
    );
});

/* ------------------------------------------------------------------ */
/* 3. Le scope lit la source unique des constantes                    */
/* ------------------------------------------------------------------ */

test('Salle 3D — le scope mural lit window.vitalSigns.props', () => {
    const source = lire('js/three-scope.js');
    assert.ok(
        /window\.vitalSigns\?\.props|window\.vitalSigns\.props/.test(source),
        'le scope doit lire la source unique des constantes (window.vitalSigns.props)'
    );
    // Il ne doit PAS maintenir de copie : la conversion des constantes est
    // une fonction PURE, qui reçoit les constantes et les traduit. Si elle
    // lisait elle-même l'état global, on aurait deux vérités.
    assert.ok(
        /export function constantesPourScope\(props\)/.test(source),
        'la conversion des constantes doit rester une fonction pure (props en argument)'
    );
    assert.ok(
        !/constantesPourScope\(\)/.test(source),
        'constantesPourScope() doit recevoir les constantes en argument'
    );
});

/* ------------------------------------------------------------------ */
/* 4. Les calques ne bloquent pas les clics                            */
/* ------------------------------------------------------------------ */

test('Salle 3D — les calques cinématiques ne bloquent pas les clics', () => {
    const css = lire('css/immersive-cinema.css');
    for (const classe of ['cine-grain', 'cine-scanlines', 'cine-alarm', 'cine-calme']) {
        const bloc = new RegExp(`\\.${classe}\\s*\\{[^}]*\\}`, 's').exec(css);
        assert.ok(bloc, `la classe .${classe} doit exister dans css/immersive-cinema.css`);
        assert.ok(
            /pointer-events\s*:\s*none/.test(bloc[0]),
            `.${classe} doit avoir « pointer-events: none » : sinon on ne peut plus ` +
            'cliquer sur le patient ni sur le bureau'
        );
    }
});

/* ------------------------------------------------------------------ */
/* 5. Le patient reste le modèle GLB                                  */
/* ------------------------------------------------------------------ */

test('Salle 3D — le patient reste le modèle GLB de Kenney', () => {
    const source = lire('js/three-patient.js');
    assert.ok(
        /_loadKenneyModel\(/.test(source),
        'le patient doit toujours être chargé depuis le modèle GLB'
    );
    assert.ok(
        !/three-patient-lying/.test(source),
        'le relook de la salle ne doit pas remplacer le modèle du patient'
    );
    assert.ok(
        !fs.existsSync(path.join(ROOT, 'js/three-patient-lying-v2.js')),
        'le module de patient allongé a été annulé : il ne doit pas revenir'
    );
});

/* ------------------------------------------------------------------ */
/* 6. Les objets à durée de vie externe sont libérés                   */
/* ------------------------------------------------------------------ */

test('Salle 3D — le scope et les calques sont libérés à l\'arrêt de la scène', () => {
    const source = lire('js/three-scene.js');
    assert.ok(
        /this\.scope\?\.dispose\?\.\(\)/.test(source),
        'le scope doit être arrêté dans cleanup() (il tourne sur un minuteur)'
    );
    assert.ok(
        /this\.overlaysCinema\?\.dispose\?\.\(\)/.test(source),
        'les calques doivent être retirés dans cleanup() (ce sont des nœuds DOM)'
    );
});

/* ------------------------------------------------------------------ */
/* 7. La garde de nuit est bien appliquée                              */
/* ------------------------------------------------------------------ */

test('Salle 3D — la garde de nuit est appliquée (ambiance, IBL, exposition)', () => {
    const source = lire('js/three-lighting-agent.js');
    // L'ambiance doit être froide et discrète…
    assert.ok(/AmbientLight\('#7d93b8',\s*0\.13\)/.test(source),
        'l\'ambiance doit être froide et discrète (garde de nuit)');
    // …l'IBL doit être baissé, c'est lui qui décide du « jour ou nuit »…
    assert.ok(/environmentIntensity = 0\.42/.test(source),
        'l\'éclairage d\'environnement doit être baissé pour la garde de nuit');
    // …et l'exposition aussi.
    assert.ok(/toneMappingExposure = 0\.92/.test(source),
        'l\'exposition doit être baissé pour la garde de nuit');
});

/* ------------------------------------------------------------------ */
/* 8. Aucune source de lumière hors de l'agent d'éclairage            */
/* ------------------------------------------------------------------ */

test('Salle 3D — le décor ne crée aucune source de lumière', () => {
    // La lampe de bureau (PointLight) et la lampe d'examen (SpotLight)
    // ajoutaient deux blocs de calcul au shader de TOUS les matériaux, pour
    // un éclairage que les sources de ThreeLightingAgent assuraient déjà.
    // Le décor « brille » par des matériaux à couleur > 1, jamais par une
    // source. Seuls l'agent d'éclairage, le flash partagé des cadenas et la
    // lumière d'urgence (toutes deux créées UNE fois, jamais détruites) en
    // posent.
    const motif = /new THREE\.(Point|Spot|Directional|Hemisphere|Ambient|RectArea)Light\(/;
    for (const f of ['js/three-room.js', 'js/three-environment-agent.js', 'js/three-room-hospital.js', 'js/three-patient.js']) {
        assert.ok(!motif.test(lire(f)), `${f} crée une source de lumière : la porter par ThreeLightingAgent`);
    }
});

/* ------------------------------------------------------------------ */
/* 9. Une pièce à l'échelle, et la caméra dedans                      */
/* ------------------------------------------------------------------ */

test('Salle 3D — hauteur sous plafond réaliste et caméra dans la pièce', () => {
    const room = lire('js/three-room.js');
    const h = Number(/height:\s*([0-9.]+)/.exec(room)?.[1]);
    // 5 m de plafond faisaient de la salle un hall : le mobilier « flottait ».
    assert.ok(h >= 2.5 && h <= 3.2, `hauteur sous plafond ${h} m : un box hospitalier fait 2,5 à 3,2 m`);
    // La vue d'ensemble était posée HORS de la pièce (z = 6,2) : elle ne
    // marche plus dès que la salle a son quatrième mur.
    const scene = lire('js/three-scene.js');
    const m = /room:\s*\{\s*pos:\s*\[([^\]]+)\]/.exec(scene);
    assert.ok(m, 'preset caméra « room » introuvable dans three-scene.js');
    const [x, y, z] = m[1].split(',').map(Number);
    assert.ok(Math.abs(x) < 5.4 && Math.abs(z) < 4.9 && y < h, `la vue d'ensemble (${m[1]}) doit être dans la pièce`);
    assert.ok(/'Mur avant'/.test(room), 'la salle doit avoir son quatrième mur');
});

/* ------------------------------------------------------------------ */
/* 10. L'IBL est celui de la salle                                    */
/* ------------------------------------------------------------------ */

test('Salle 3D — l\'éclairage d\'environnement est construit depuis la salle', () => {
    const source = lire('js/three-lighting-agent.js');
    // `RoomEnvironment` (la pièce générique de three.js) faisait refléter au
    // sol et sur l'inox une autre pièce que celle où l'on se trouve.
    assert.ok(!/new RoomEnvironment\(/.test(source), 'ne plus utiliser RoomEnvironment comme IBL');
    assert.ok(/buildRoomProbeScene\(/.test(source), 'l\'IBL doit être construit par buildRoomProbeScene()');
});
