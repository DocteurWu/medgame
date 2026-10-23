# CONTEXT.md — Cartographie Dense & Index de Référence Medgame

> **Document d'éveil IA :** Index ultra-dense pour comprendre l'architecture, l'emplacement et la responsabilité de chaque fichier sans requêtes ni lectures exploratoires coûteuses.

---

## 1. Architecture Générale & Règles Vitales

- **Stack :** Vanilla JS (ES6+), HTML5, CSS3. **Zéro bundler, zéro transpiler, zéro build step.**
- **Scripts navigateur :** Scripts classiques en `<script defer>` pour la logique métier ; ES Modules (`importmap`) pour Three.js (`v0.163.0`) et les modules 3D (`js/three-*.js`).
- **Moteur isolé :** `engine/MedGameEngine.js` (simulation pure, sans DOM) + `engine/scoring.js` (source unique du score /100 et /20).
- **Audio :** Un **seul** `AudioContext` pour toute l'app dans `js/audio-core.js`. Zéro fichier audio hors les 246 enregistrements d'auscultation. Synthèse procédurale Web Audio pure (6 bus : `ui`, `sfx`, `medical`, `auscultation`, `ambience`, `music`). Ne jamais appeler `new AudioContext()` ailleurs.
- **Données :** Cas cliniques JSON dans `data/`, indexés par `data/case-index.json` et `data/case-meta.json` (générés par `scripts/generate-case-index.mjs`). Les fetchs `data/` sont relatifs à la racine.
- **Alias de cas :** `js/case-aliases.js` est la source unique des 240 alias (publié sur `globalThis`).
- **Helpers globaux :** `js/utils.js` (`escapeHtml`, `sanitizeHtml`, `showNotification`, `getCookie`, `setCookie`, `speakerDisplayName`, `speakerRoleClass`).
- **Thème clinique (game.html) :** `css/game.css` est chargé EN DERNIER et fait foi (sélecteurs `body.clinic`). Dossier papier + mur vert d'eau, moniteur noir aux couleurs réelles, Atkinson Hyperlegible + Barlow Semi Condensed. L'ancien thème néon vit dans `css/game-legacy.css` (admin.html uniquement). Détails : AGENTS.md, « Direction artistique de game.html ».

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
| `engine/MedGameEngine.js` | Moteur de jeu clinique headless (testable sous Node). Gère l'état du patient, les tours de dialogue, l'alliance thérapeutique (`trust`/`anxiety`), l'extraction d'intentions et l'évaluation finale. |
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
- `clinicalAgentAI.js` : Agent IA 3D/Directeur de réanimation (analyse d'intentions, interventions d'urgence).
- `MedicalGameManager.js` : Maître du jeu LLM (arbitrage des prescriptions libres et réponses patient).
- `patientChat.js` : UI de saisie et affichage du flux de discussion avec le patient.
- `llm-patient.js` / `llm-client.js` / `llm-cache.js` : Client d'inférence LLM côté navigateur, gestion de cache et fallback.
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
- `three-room.js` : Mobilier du cabinet (bureau 0.76m, lit, brancard, scope mural, lecteur Carte Vitale, SHA).
- `three-room-textures.js` : Génération procédurale des textures PBR (bois, inox, carrelage, murs).
- `three-lighting-agent.js` : Gestion dynamique de la lumière. `applyTimeOfDay()` : jour (7 h–21 h) ou garde de nuit selon l'heure du joueur, en re-teintant les mêmes sources (aucune ajoutée).
- `three-camera-director.js` : Mouvements cinématiques et préréglages de caméra (desk, patient, exam, scope). Vue « room » à hauteur d'yeux depuis le seuil du box.
- `three-patient.js` : Modèle 3D du patient, rigging, respiration morphique et expressions faciales.
- `three-hud.js` / `three-hud-agent.js` : Affichage tête-haute 3D projeté (constantes, dialogue flottant).
- `three-scope.js` : Moniteur multiparamétrique 3D avec courbes ECG, pléthysmographie et capnographie.
- `three-tablet.js` : Tablette tactile 3D pour la consultation des résultats d'analyses et radiographies.
- `three-instruments.js` : Objets manipulables (stéthoscope, tensiomètre, otoscope, lampe torche).
- `three-quality-agent.js` : Adaptateur dynamique de qualité graphique selon les FPS (ombres, bloom, post-process).
- `three-loaders.js` / `three-loaders-shared.js` : Chargeurs optimisés glTF/GLB/KTX2 avec cache partagé.
- `three-fps-controller.js` / `character-controller.js` : Déplacement libre vue subjective du soignant.
- `three-highlight.js` / `three-overlays.js` : Effets de surbrillance et contours d'objets interactifs.
- `three-environment-agent.js` / `three-background.js` : Ciel procédural, fenêtres et environnement extérieur.
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

## 5. Scripts d'Outillage & Validation (`scripts/`)

| Script | Rôle |
|---|---|
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
| `mcp-server.js` | Serveur MCP local (port 8081) : proxy LLM sécurisé, WebSocket pour l'arène, health check. |
| `netlify/functions/llm-proxy.js` | Fonction serverless Netlify pour router les requêtes OpenRouter avec rate-limiting. |
| `netlify/functions/jev-proxy.js` | Proxy serverless pour l'API de scoring Jev. |
| `netlify.toml` / `_headers` | CSP stricte, règles de cache (`max-age=0` sur code, cache long sur assets). |
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

- Lancer la suite complète : `npm test` (353+ tests unitaires Node.js).
- Tests UI automatisés dans Chrome headless : `npm run test:ui`.
- Validation stricte des données : `npm run validate:cases`.
- **Fichiers clés :**
  - `test/tooling.test.mjs` : Vérifie que tout fichier de test est bien enregistré dans `package.json`.
  - `test/audio.test.mjs` & `test/verify-ui-audio.mjs` : Audit statique et analyse de forme d'onde réelle du moteur audio.
  - `test/security-headers.test.mjs` : Garantit la stricte parité des headers CSP et sécurité Netlify/Nginx.
  - `test/engine.test.mjs` & `test/engine-integration.test.mjs` : Tests de logique clinique et scoring.
