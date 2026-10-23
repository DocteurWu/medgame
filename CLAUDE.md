# CLAUDE.md — Medgame

Ce fichier est un point d'entrée court. Les deux références sont :

- **`AGENTS.md`** — instructions du projet : build, architecture, règles
  audio, performance 3D, pièges déjà payés. **À lire en premier.**
- **`CONTEXT.md`** — carte dense de chaque fichier et de son rôle.

## Rappels essentiels

- Pas de build : HTML/CSS/JS vanilla, Three.js `0.163.0` par importmap, aucun
  global `THREE`, aucun jeton `?v=` sur le code applicatif.
- Un seul `AudioContext` (`js/audio-core.js`), jamais `new Audio()`.
- `npm test` doit rester vert ; tout nouveau test va dans la liste de
  `package.json`. Tests navigateur : `npm run test:ui`.
- Écrire les fichiers en UTF-8 avec les outils d'édition ou Node : jamais
  `Set-Content` (PowerShell 5.1 corrompt les accents). Les apostrophes
  françaises cassent `node -e '…'` : passer par un fichier de script.

## Salle 3D (refonte d'octobre 2026)

- Dimensions : `ROOM` / `WINDOW` dans `js/three-room.js` (plafond 2,90 m,
  4 murs, fenêtre réellement percée). S'y caler, ne pas recopier de nombres.
- Lumière : **aucune source hors de `ThreeLightingAgent`** (7 sources, verrouillé
  par `test/room-materials.test.mjs`). Ce qui brille = `MeshBasicMaterial` à
  couleur > 1. IBL = la salle elle-même (`buildRoomProbeScene`), tone mapping
  `Neutral`. Jour/nuit forçable : `?heure=jour` / `?heure=nuit`.
- Équipements hospitaliers : `js/three-room-hospital.js`, une tranche de
  construction par équipement, matériaux partagés.
- Patient allongé : pose semi-assise os par os (`_poseSemiRecumbent`, `BED`
  mesuré par raycast sur le lit GLB). Si le lit change, remesurer.
- Presets caméra : ceux qui servent sont dans `ThreeScene.setCamera()`.
- Mesurer avant/après : `node test/verify-ui-3d.mjs` (noter `programmes=`).

## Serveur de dev

`python -m http.server` n'envoie pas de `Cache-Control` : Chrome peut garder
d'anciens modules ES en cache (symptôme vu : salle neuve, patient ancien).
Utiliser `.claude/launch.json` (port 8791, `Cache-Control: no-store`) ou
recharger avec Ctrl+Maj+R.
