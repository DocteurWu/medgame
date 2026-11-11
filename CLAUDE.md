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

`lancer_serveur.bat` (tout : MCP + web + navigateur) ou `npm run dev` (web
seul, port 8791, `Cache-Control: no-store`, aussi dans `.claude/launch.json`).
Éviter `python -m http.server` : sans `Cache-Control`, Chrome garde d'anciens
modules ES (symptôme vu : salle neuve, patient ancien).

## Moteur patient (un seul)

- `js/patient-brain.js` porte le prompt (persona, divulgation, voix selon la
  physiologie, alliance, règles du Maître du Jeu) et le schéma de réponse.
  Script classique pur, aussi importé par `engine/MedGameEngine.js`.
- `js/MedicalGameManager.js` est le **seul routeur LLM** : 2D, 3D et ECOS
  l'appellent, un appel par réplique. Le 3D (`three-hud-agent.js`) et
  `clinicalAgentAI.js` n'affichent que ses événements. Ne jamais recréer de
  second chemin vers le patient (`test/patient-brain.test.mjs` le vérifie).
- Schéma : `emotion` puis `dialogue` **en tête** (la voix part en streaming
  dès la première phrase), `vitalChanges` en **valeurs absolues**. Toute
  réponse passe par `PatientBrain.parseReply` (bornes, compatibilité).
- Modifier le comportement du patient = modifier `patient-brain.js`, puis
  vérifier le prompt avec l'outil MCP `get_patient_prompt`.

## Consultation en direct

- `js/patient-live-core.js` (pur, testé), `js/patient-voice.js`,
  `js/patient-live.js`, `css/patient-live.css`. Contrat par événements
  `medgame:*` sur `document` : tableau dans `CONTEXT.md` §4 bis.
- La voix neuronale passe par l'AudioContext unique, bus `medical` ; sans
  `TTS_API_KEY`, repli `speechSynthesis`. Micro : Chrome/Edge seulement.
- Le micro exige `Permissions-Policy: microphone=(self)`, identique dans
  `netlify.toml`, `_headers` et `nginx-security.conf` (parité testée).

## Agents IA (MCP)

`mcp-server.js` : 21 outils (jouer un cas / l'améliorer) et des
`instructions` pour les agents. Les outils d'amélioration vivent dans
`engine/agent-tools.js`. `propose_case_patch` est un essai à blanc par
défaut et journalise toute écriture dans `data/case-patches.jsonl`.

## Pièges payés récemment

- Un `.bat` doit rester en CRLF (règle `.gitattributes`), sinon `goto` et
  `call :label` sautent au mauvais endroit.
- Toute variable d'environnement lue par le code doit figurer dans
  `.env.example` (`test/tooling.test.mjs`), même `PORT`.
- Un nouveau fichier dans `netlify/functions/` est une fonction publique :
  l'ajouter à la liste de `test/security-headers.test.mjs`.
- Sous Git Bash, un heredoc contenant des apostrophes françaises peut casser
  le shell : écrire les scripts de modification dans un fichier.
