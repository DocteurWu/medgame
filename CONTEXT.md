# CONTEXT.md — Cartographie Dense & Index de Référence Medgame

> **Document d'éveil IA :** Index ultra-dense pour comprendre l'architecture, l'emplacement et la responsabilité de chaque fichier sans requêtes ni lectures exploratoires coûteuses.

---

## 1. Architecture Générale & Règles Vitales

- **Stack :** Vanilla JS (ES6+), HTML5, CSS3. **Zéro bundler, zéro transpiler, zéro build step.**
- **Scripts navigateur :** Scripts classiques en `<script defer>` pour la logique métier ; ES Modules (`importmap`) pour Three.js (`v0.163.0`) et les modules 3D (`js/three-*.js`).
- **Moteur isolé :** `engine/MedGameEngine.js` (simulation pure, sans DOM) + `engine/scoring.js` (source unique du score /100 et /20).
- **Moteur patient UNIQUE :** `js/patient-brain.js` (prompt + schéma de réponse + analyseur), partagé par le navigateur (2D, 3D, ECOS via `js/MedicalGameManager.js`, seul routeur LLM) et par `engine/MedGameEngine.js` (agents MCP). Un appel LLM par réplique. Ne jamais recréer de second chemin vers le patient (verrouillé par `test/patient-brain.test.mjs`).
- **Consultation en direct :** alliance thérapeutique visible et jouable (jauge, paliers, ultimatum, départ du patient), voix du patient, micro. Contrat par événements DOM, voir §4 bis.
- **Audio :** Un **seul** `AudioContext` pour toute l'app dans `js/audio-core.js`. Zéro fichier audio hors les 246 enregistrements d'auscultation. Synthèse procédurale Web Audio pure (6 bus : `ui`, `sfx`, `medical`, `auscultation`, `ambience`, `music`). Ne jamais appeler `new AudioContext()` ailleurs. La voix neuronale du patient est décodée dans ce contexte et jouée sur le bus `medical` (ducking de l'ambiance) ; seul repli hors Web Audio : `speechSynthesis`.
- **Données :** Cas cliniques JSON dans `data/`, indexés par `data/case-index.json` et `data/case-meta.json` (générés par `scripts/generate-case-index.mjs`). Les fetchs `data/` sont relatifs à la racine.
- **Alias de cas :** `js/case-aliases.js` est la source unique des 240 alias (publié sur `globalThis`).
- **Helpers globaux :** `js/utils.js` (`escapeHtml`, `sanitizeHtml`, `showNotification`, `getCookie`, `setCookie`, `speakerDisplayName`, `speakerRoleClass`).
- **Thème clinique universel (Light / Dark) :** `css/clinical-theme.css` + `js/theme-manager.js`.
  - Mode Clair : « Dossier Médical » papier froid `--paper` #F3F5F2, feuilles `--sheet` blanches, encre `--ink` #17242C, vert d'eau hospitalier `--wall` #D5E5DD, bleu blouse `--scrub` #1C5A78.
  - Mode Sombre : « Garde de Nuit / Box Réa » fond ardoise `--paper` #0E161B, cartes sombres contrastées `--sheet` #17242C, encres claires haute lisibilité `--ink` #EAF0EE, vert de garde `--wall` #16282E, bleu nuit `--scrub` #2B7EA6.
  - Moniteur : seule surface sombre invariante (ECG vert, pléthysmographie cyan, PNI blanc, FR jaune, T° rose).
  - Typographie universelle : Atkinson Hyperlegible (conçue pour la lisibilité clinique) + Barlow Semi Condensed (constantes et chrono). Bouton universel discret de bascule jour/nuit (`.theme-toggle-floating`) persisté dans `localStorage.medgame_theme`. L'ancien thème néon vit dans `css/game-legacy.css` (admin.html uniquement).

---

## 2. Pages HTML (Points d'Entrée)

| Fichier | Rôle & Composants Clés |
|---|---|
| `index.html` | Accueil, sélection de mode, leaderboard, auth Supabase, modale de profil. |
| `game.html` | Consultation 2D & 3D, mode ECOS, dialogue patient, ordonnance, HUD constantes. |
| `editor.html` | Éditeur visuel de cas cliniques (arbres décisionnels, prompt IA, validation schéma). |
| `atlas.html` | Atlas anatomique 3D interactif (cerveau/neuro-atlas, cœur, poumon, rein). |
| `auscultation.html` / `auscultation-pcg.html` | Simulateur de stéthoscope et phonocardiogramme (sons réels annotés). |
| `ecg-trainer.html` | Entraîneur interactif ECG (tracé vectoriel Canvas, calculs d'axes et intervalles). |
| `skills.html` | Hub central des gestes et compétences techniques médicales. |
| `skills-echo.html` | Simulateur d'échographie ultrasons (sondes cardiaque / abdo / FAST-echo). |
| `skills-gds.html` | Interprétation des Gaz du Sang (diagramme Davenport interactif Canvas). |
| `skills-pse.html` | Simulateur de Pousse-Seringue Électrique (dilutions, débits, bolus). |
| `skills-ventilateur.html` | Simulateur de ventilation mécanique (VC/VS, triggers, PEEP, asynchronies). |
| `ai-watch.html` | Observateur d'évaluation IA en temps réel (stream d'actions et scoring ECOS). |
| `arena_play.html` | Mode multijoueur compétitif en temps réel (duels de diagnostic). |
| `graph_editor.html` | Éditeur de graphes conceptuels et liens physiopathologiques. |
| `profile.html` | Statistiques du joueur, historique des cas réussis, badges débloqués. |
| `themes.html` | Navigation et filtres par spécialité médicale (cardiologie, urgences, etc.). |
| `tutorial.html` | Guide de prise en main interactif pour nouveaux externes/internes. |
| `credits.html` | Remerciements, attributions scientifiques et mentions légales. |
| `login.html` | Page d'authentification autonome et récupération de session. |
| `admin.html` | Dashboard d'administration (gestion utilisateurs, métriques, validation). |

---

## 3. Moteur Pur (`engine/`)

| Fichier | Rôle & Responsabilité |
|---|---|
| `engine/MedGameEngine.js` | Moteur de jeu clinique headless (testable sous Node), utilisé par le serveur MCP. Importe `js/patient-brain.js` et `js/patient-live-core.js` : même prompt, même schéma et même alliance (ultimatum, départ) que le navigateur. Constantes en valeurs absolues. Expose `buildSystemPrompt()`, `lastTurn`, `turnLog`, `alliance` dans `getState()`. |
| `engine/agent-tools.js` | Outils des agents testeurs : `auditCase` / `auditAllCases` (qualité statique d'un cas, score /100), `playScriptedConsultation` (entretien complet sur un moteur neuf), `proposeCasePatch` (JSON Merge Patch, essai à blanc par défaut, refus si schéma cassé ou audit dégradé, journal `data/case-patches.jsonl`), `runTests`, `validateCases`, `readFeedback`. |
| `engine/scoring.js` | Source unique de vérité pour le scoring (/100 et /20), pénalités et conversions. Partagé navigateur/Node. |

---

## 4. Scripts Métier (`js/`)

### Audio (Synthèse Procédurale & Bus)
- `audio-core.js` : Singleton `AudioContext`, topologie des 6 bus, limiteur/compresseur, ducking, déverrouillage tactile (`bindUnlock`).
- `audio-sfx.js` : Registre de ~60 effets sonores synthétisés (UI, clics, gong ECOS, validations, erreurs).
- `audio-medical.js` : Synthèse physiologique : B1/B2 (écart variable selon FC), murmures, râles, alarmes scopes, bip ECG.
- `audio-ambience.js` : Ambiance d'hôpital/box d'urgence et musique adaptative à 5 états (calme $\rightarrow$ arrêt).
- `audio.js` : Façade de rétrocompatibilité (`MedGameAudio.play(...)`). Ne synthétise rien directement.
- `three-audio.js` : Pont ESM Three.js vers `window.MedGameMedical` pour la spatialisation 3D.
- `auscultation-audio.js` / `auscultation-pcg.js` / `auscultation.js` : Moteur de lecture et mixage des 246 enregistrements d'auscultation réels.

### Cœur du Gameplay & ECOS
- `game.js` : Chef d'orchestre de `game.html` (initialisation, transitions 2D/3D, routage des actions).
- `gameState.js` : État global de la session (score, inventaire, constantes, historique des questions).
- `caseLoader.js` : Chargement paresseux des cas (descripteurs légers, résolution corps à la demande, cache).
- `case-aliases.js` : Table unique de normalisation des 240 identifiants de cas cliniques.
- `ecosMode.js` : Déroulement de l'épreuve ECOS (chronomètre 7/8 min, grille de critères, débriefing Jev).
- `ecos-dialog.js` : Interface et bulles de discussion spécifiques à la station ECOS.
- `ecos-stats.js` : Calcul et rendu des radars de compétences ECOS (clinique, communication, pertinence).
- `patient-brain.js` : **LE moteur patient, unique** (script classique pur, aussi importé par `engine/MedGameEngine.js`). Prompt unique (incarnation du persona + Maître du Jeu), schéma de réponse unique (`emotion`, `dialogue`, `alliance`, `disclosedInfoFields`, `exams`, `prescriptions`, `vitalChanges` en valeurs ABSOLUES, `narrativeResponse`, `scene`, `gameState`), analyseur tolérant `parseReply`.
- `MedicalGameManager.js` : **seul routeur LLM** du jeu (2D, 3D et ECOS) : 1 appel par réplique, en streaming ; applique le tour (constantes, prescriptions, grille, décès) et émet `medgame:patient-dialogue-progress`, `patient-sentence`, `patient-reply`, `turn-applied`.
- `clinicalAgentAI.js` : effets 3D du tour (bloc `scene` : objet procédural, rythme respiratoire, son). Plus aucun appel LLM.
- `patientChat.js` : UI de saisie et transcript 2D ; le 3D (`three-hud-agent.js`) passe par lui.
- `patient-live-core.js` : logique pure (Node-testable) de l'alliance : paliers Confiant ≥70 / Réservé ≥40 / Fermé ≥20 / Rupture, ultimatum sous 15 (une réplique empathique pour retenir le patient, une seule seconde chance), analyse locale des répliques (jargon + traduction profane, empathie, reformulation, rafale de questions), extraction en flux d'un champ JSON, découpage en phrases, prosodie, relances.
- `patient-voice.js` : micro (`SpeechRecognition` fr-FR, appui maintenu / dictée / mains libres, fin de tour décidée côté jeu) et voix du patient (proxy `CONFIG.TTS_API_URL` décodé dans l'AudioContext unique, sinon `speechSynthesis`) ; amplitude de voix pour la 3D. Réglages : `localStorage['medgame.voice.v1']`.
- `patient-live.js` (+ `css/patient-live.css`) : orchestrateur et interface — jauge « Alliance » (2D et 3D), bouton « En direct », bouton micro (touche V), retour à chaque réplique, relances de silence, pénalité de coupure de parole, bandeau d'ultimatum, verrouillage au départ, débriefing (courbe de confiance). API : `window.PatientLive` (`promptBlock`, `snapshot`, `presence`, `isLocked`).
- `llm-client.js` / `llm-cache.js` : client LLM (proxy, retries, SSE).
- `jevClient.js` : Client API pour la notation Jev et la rétro-action pédagogique.
- `vitalSigns.js` : Moteur de dynamique des constantes vitales (FC, PA, SpO2, FR, Temp) et alertes. Gabarit de moniteur de chevet : tracé fixe + barre d'effacement, PNI/PAM/FR/T°, alarmes en inverse vidéo.
- `prescription.js` : Gestionnaire de l'armoire à pharmacie, posologies, bilans sanguins et imagerie.
- `urgenceMode.js` / `game-modes.js` : Gestionnaires de règles pour le mode Réanimation et mode Consultation standard.
- `nurse.js` : Transmission IAO à l'entrée du cas (fiche datée et signée, API `NurseIntro`). Styles : `css/nurse.css`.
- `timer.js` : Gestionnaire haute précision du temps restant et pénalités chronométriques.
- `badges.js` / `progress-tracker.js` / `sessionSnapshot.js` : Succès débloqués, progression et sauvegarde d'état.
- `lockSystem.js` : Verrouillage des actions en fonction des prérequis cliniques (ex: gants avant geste).
- `quota-guard.js` : Limitation des requêtes LLM côté client contre les abus de tokens.

### Modules 3D (ES Modules — Three.js)
- `three-manager.js` : Point d'entrée du sous-système 3D, boucle de rendu, gestion du canvas WebGL.
- `three-scene.js` : Graphe de scène principal, raycasting des objets interactifs, détection de clics.
- `three-room.js` : Coque de la pièce + mobilier du bureau. Exporte **`ROOM`** (11 × 10 × **2,90 m**, 4 murs) et **`WINDOW`** (ouverture réelle du mur droit) : source unique des dimensions. Murs et plafond portent ombre (soleil découpé par la fenêtre). Porte stratifiée claire, faïence, négatoscope avec radio thoracique.
- `three-room-textures.js` : Textures procédurales canvas à graine fixe (sol PVC en lés, peinture + AO de corniche, lambris vinyle, dalle de plafond 60 cm, rideau, store, couverture, vue extérieure jour/nuit, dégradé d'AO). Mises en cache (`viderCacheTexturesSalle`).
- `three-room-hospital.js` : Équipements hospitaliers en tranches (`hospitalSteps`) : rampe de gaz médicaux, rail + rideau de box, poste de diagnostic mural, SHA/gants/collecteur, faux plafond technique (soufflage, sprinklers, BAES), signalétique, tableau blanc, charte du patient, TV, chaises, bandes d'AO des angles, ombres de contact. Zéro lumière, matériaux partagés.
- `three-lighting-agent.js` : 7 sources (verrouillé par test). IBL construit depuis la salle (`buildRoomProbeScene`, plus de `RoomEnvironment`), tone mapping `Neutral`. `applyTimeOfDay()` jour/garde de nuit, forçable par `?heure=jour|nuit` (`isNightNow`, règle unique).
- `three-camera-director.js` : Mouvements cinématiques. ⚠ Les presets réellement utilisés sont dans `ThreeScene.setCamera()` (`three-scene.js`) ; vue « room » DANS la pièce à 1,65 m, bornes caméra sous le plafond.
- `three-patient.js` : Patient Kenney (GLB). `_updatePresence` : tête qui suit l'amplitude de la voix, regard détourné quand la confiance chute, tremblement d'anxiété, thorax qui respire à la FR du moniteur (lu via `PatientLive.presence()`). Allongé : pose semi-assise à 45° os par os (`_poseSemiRecumbent`, constante `BED` mesurée par raycast sur le lit), échelle sur la carrure, tête réduite, jambes sous la couverture (`_addBedLinen`), foyers d'auscultation `auscultationLocal`. Aucune animation jouée allongé.
- `three-hud.js` / `three-hud-agent.js` : Affichage tête-haute 3D projeté (constantes, dialogue flottant). Le dialogue 3D n'a plus de moteur propre : il passe par `patientChat.ask` et affiche les événements du Maître du Jeu (bulle en streaming, réponse finale via le transcript 2D).
- `three-scope.js` : Moniteur multiparamétrique 3D avec courbes ECG, pléthysmographie et capnographie.
- `three-tablet.js` : Tablette tactile 3D pour la consultation des résultats d'analyses et radiographies.
- `three-instruments.js` : Objets manipulables (stéthoscope, tensiomètre, otoscope, lampe torche).
- `three-quality-agent.js` : Adaptateur dynamique de qualité graphique selon les FPS (ombres, bloom, post-process).
- `three-loaders.js` / `three-loaders-shared.js` : Chargeurs optimisés glTF/GLB/KTX2 avec cache partagé.
- `three-fps-controller.js` / `character-controller.js` : Déplacement libre vue subjective du soignant.
- `three-highlight.js` : Surbrillance des objets interactifs.
- `three-overlays.js` (+ `css/immersive-cinema.css`) : Calques DOM grain / balayage / halo d'alarme / vignettage neutre (`pointer-events: none`).
- `three-environment-agent.js` : Habillage de la salle en tranches (`enhanceRoomSteps`) : dalles LED, lambris + lisse, plinthes à gorge, fenêtre PVC + store + vue extérieure, armoire à pharmacie 2,05 m, lit GLB + lampe d'examen LED, scopes, chariot, horloge ; enchaîne `hospitalSteps`. Paliers de décor (`_registerDecor`, jamais de lumière).
- `three-background.js` : Fond 3D de la page d'accueil.
- `three-ecos-session.js` / `three-clinical-agent.js` : Synchronisation de l'état ECOS dans l'espace 3D.
- `three-urgence-agent.js` / `three-transition-agent.js` : Effets d'urgence (lumière stroboscopique, alertes).
- `scene-disposer.js` : Nettoyage rigoureux de la mémoire GPU (géométries, matériaux, textures).

### Atlas Anatomique 3D (`atlas.html` & modules)
- `atlas.js` : Contrôleur de l'atlas anatomique multi-organes.
- `atlas-heartbeat.js` : Animation cardiaque physiologique 3D synchronisée.
- `atlas-lung.js` / `atlas-kidney.js` : Modules dédiés à la ventilation pulmonaire et néphrologie 3D.
- `atlas-desc-fr.js` / `atlas-i18n.js` : Fiches pédagogiques et descriptions anatomiques multilingues.
- `three-atlas-scene.js` / `three-atlas-loader.js` / `three-atlas-overlay.js` / `three-atlas-data.js` : Pile 3D d'atlas.

### Compétences Médicales Spécialisées (`skills-*`)
- `ecg-trainer.js` / `ecg-canvas.js` : Tracé vectoriel d'électrocardiogramme et quizz de reconnaissance.
- `echo-engine.js` / `echo-ui.js` : Simulation acoustique ultrasonore, plans de coupe et annotations.
- `gds.js` / `gds-diagram.js` / `gds-ui.js` : Calcul d'équilibre acido-basique et tracés de Davenport.
- `pse-engine.js` / `pse-ui.js` : Pharmacocinétique simplifiée et calculs de débit de pousse-seringue.
- `ventilateur-engine.js` / `ventilateur-ui.js` : Équations de mécanique ventilatoire et courbes P/t, V/t, F/t.

### Multijoueur, Éditeurs & UI Générale
- `arena_play.js` / `arena_client.js` / `arena_admin.js` / `player_map.js` : Arène multijoueur via WebSocket.
- `editor.js` / `editor-ai.js` / `editor-3d-preview.js` : Création et prévisualisation de cas cliniques.
- `graph_editor.js` : Éditeur de graphes sémantiques.
- `ui.js` / `footer.js` / `index-*.js` : Contrôles d'interface, modales, classements et profils.
- `utils.js` : Fonctions utilitaires universelles (sécurité, DOM, cookies).
- `config.js` / `env.js` : Configuration des endpoints API, clés publiques et flags d'environnement.

---

## 4 bis. Consultation en direct : contrat d'événements (`document`)

| Événement | Émis par | Détail | Écouté par |
|---|---|---|---|
| `medgame:case-set` | `patientChat.setCase` | `{ caseData }` | `patient-live` (nouvelle alliance, persona `confiance`/`anxiete`) |
| `medgame:student-said` | `patientChat.ask`, `ecosMode` | `{ text }` | `patient-live` (tour en attente, coupure de parole), `three-hud-agent` (indicateur) |
| `medgame:patient-dialogue-progress` | `MedicalGameManager` (flux) | `{ text }` réplique partielle | `patientChat`, `ecosMode`, `three-hud-agent` |
| `medgame:patient-sentence` | `MedicalGameManager` (flux) | `{ text, emotion, turnId }` phrase complète | `patient-live` → voix |
| `medgame:patient-reply` | `MedicalGameManager` | `{ text, emotion, alliance, turnId, source }` | `patient-live` (jauge, fin de voix), `three-hud-agent` (bulle) |
| `medgame:turn-applied` | `MedicalGameManager` | `{ input, parsed, turnId }` | `clinicalAgentAI` (effets 3D `scene`) |
| `medgame:patient-error` | `patientChat`, `ecosMode`, HUD | — | `patient-live`, `three-hud-agent` |
| `medgame:voice-*` | `patient-voice` | `listening`, `speaking`, `sentence`, `interim`, `settings` | `patient-live` |

Production : le micro exige `Permissions-Policy: microphone=(self)` (identique dans `netlify.toml`, `_headers`, `nginx-security.conf`).

---

## 5. Scripts d'Outillage & Validation (`scripts/`)

| Script | Rôle |
|---|---|
| `scripts/dev-server.mjs` | Serveur web local (port 8791 ou `$PORT`, `127.0.0.1`), `Cache-Control: no-store`, types MIME 3D, refuse `.env`/`.git`. `npm run dev`. |
| `scripts/generate-case-index.mjs` | Parcourt `data/` pour générer `case-index.json` et `case-meta.json`. |
| `scripts/validate-cases.mjs` | Valide l'intégrité de tous les cas JSON contre `schemas/case.schema.json`. |
| `scripts/enrich-cases.mjs` | Normalise et enrichit les données des cas (niveaux de difficulté, alias). |
| `scripts/sync-supabase.mjs` | Synchronise la base de cas locale avec la base Supabase distante. |
| `scripts/generate-ecos-feedback.mjs` | Générateur hors-ligne de feedbacks pédagogiques pour l'ECOS. |
| `scripts/generate-medical-props.py` | Générateur procédural d'objets 3D médicaux légers. |

---

## 6. Serveurs & Déploiement

| Fichier | Rôle |
|---|---|
| `mcp-server.js` | Serveur MCP local (port 8081) : proxy LLM et voix (`/llm-proxy`, `/tts-proxy`), WebSocket, health check. 21 outils : 10 pour JOUER un cas, 11 pour l'AMÉLIORER (`audit_case`, `audit_all_cases`, `play_scripted_consultation`, `propose_case_patch`, `run_tests`, `validate_cases`, `get_patient_prompt`, `get_turn_log`, `analyze_utterance`, `get_case`, `list_feedback`). |
| `engine/agent-tools.js` | Logique des outils d'amélioration (audit, patch de cas en essai à blanc + journal `data/case-patches.jsonl`, consultation scriptée, tests). |
| `netlify/functions/tts-proxy.js` | Voix neuronale du patient (`TTS_API_KEY`), 501 sans clé → voix du navigateur. |
| `scripts/dev-server.mjs` | Serveur web local `no-store` (port 8791), utilisé par `lancer_serveur.bat`, `npm run dev` et `.claude/launch.json`. |
| `lancer_serveur.bat` | Lanceur Windows : vérifie Node et `.env`, installe, démarre MCP + web, attend qu'ils répondent, ouvre le navigateur. Modes `jouer`, `ia`, `atlas`, `tests`, `stop`. |
| `netlify/functions/llm-proxy.js` | Proxy LLM serverless (DeepSeek par défaut, Groq/OpenRouter possibles), quotas Supabase, streaming SSE relayé. |
| `netlify/functions/jev-proxy.js` | Proxy serverless pour l'API de scoring Jev. |
| `netlify.toml` / `_headers` | CSP stricte, `Permissions-Policy` (micro autorisé pour le site seul), règles de cache (`max-age=0` sur code, cache long sur assets). |
| `.env.example` | Toutes les variables serveur, dont `TTS_API_KEY` / `TTS_API_URL` / `TTS_MODEL` (voix) et `PORT` (serveur de dev). |
| `nginx.conf` / `nginx-security.conf` | Configuration reverse-proxy Nginx pour conteneurs Docker. |
| `Dockerfile` / `.dockerignore` | Image Docker légère pour déploiement cloud autonome. |

---

## 7. Données & Schémas

- `data/` : 95 cas cliniques en format JSON strict couvrant toutes les spécialités de l'internat.
- `data/case-index.json` : Index léger id/titre/spécialité pour chargement instantané.
- `data/case-meta.json` : Métadonnées de filtrage (difficulté, temps, mots-clés).
- `schemas/case.schema.json` : Schéma JSON Schema v7 décrivant la structure obligatoire d'un cas clinique.
- `neuro-atlas/data/` : Maillages GLB et volumes binaires haute résolution du système nerveux central et périphérique.

---

## 8. Tests de Non-Régression (`test/`)

- Lancer la suite complète : `npm test` (363 tests Node.js), ou `lancer_serveur.bat tests`.
- Tests UI automatisés dans Chrome headless : `npm run test:ui`.
- Serveur de dev : `npm run dev` ou `lancer_serveur.bat` (port 8791, `no-store`). `python -m http.server` n'envoie pas de `Cache-Control` → Chrome peut servir d'anciens modules ES (salle neuve, patient ancien).
- Validation stricte des données : `npm run validate:cases`.
- **Fichiers clés :**
  - `test/tooling.test.mjs` : Vérifie que tout fichier de test est bien enregistré dans `package.json`.
  - `test/audio.test.mjs` & `test/verify-ui-audio.mjs` : Audit statique et analyse de forme d'onde réelle du moteur audio.
  - `test/security-headers.test.mjs` : Garantit la stricte parité des headers CSP et sécurité Netlify/Nginx.
  - `test/engine.test.mjs` & `test/engine-integration.test.mjs` : Tests de logique clinique et scoring.
  - `test/patient-brain.test.mjs` : Moteur patient unique (plus de `LLMPatient`, `clinicalAgentAI` sans réseau, ordre de chargement), prompt, divulgation, normalisation des réponses, audit et patch de cas.
  - `test/patient-live.test.mjs` : Alliance (paliers, ultimatum, départ, bilan), analyse des répliques, extraction en flux, découpage pour la voix, prosodie.
  - `test/mcp.test.mjs` : Les 21 outils MCP, instructions aux agents, essai à blanc des patchs, consultation scriptée sur moteur neuf.
  - `test/room-materials.test.mjs` : Garde-fous de la salle 3D (pas de `transmission`, 7 sources dans l'agent, aucune lumière dans le décor, plafond 2,5–3,2 m et caméra dans la pièce, IBL de la salle, calques non bloquants).
  - `test/verify-ui-3d.mjs` : Construction, rendu, cadence et libération de la scène 3D dans Chrome (note `programmes=` et `lights=`).
