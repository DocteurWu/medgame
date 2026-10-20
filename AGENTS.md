# AGENTS.md - Medgame

## Build & Run
- **Dev server**: Open `index.html` in browser or use `npx serve .` / `python -m http.server`
- **MCP server** (LLM proxy + WebSocket) : `npm run mcp` (port 8081)
- **Docker**: `docker build -t medgame .` then `docker run -p 8888:8888 medgame`
- **No build step**: Static HTML/CSS/JS app, no bundler or transpiler

## Architecture
- **Frontend**: Vanilla JS, HTML5, CSS3 (no frameworks, no bundler). Classic `<script defer>` for game logic, ES modules with an `importmap` for Three.js.
- **3D**: Three.js `0.163.0` via importmap (`unpkg`). Aucun global `THREE` : tout le code 3D est en ES modules (`js/three-*.js`).
- **Pages principales**: `index.html` (accueil), `game.html` (jeu, charge aussi le mode ECOS), `editor.html` (éditeur de cas), `atlas.html` (atlas anatomique), `skills.html` / `skills-gds.html` / `skills-echo.html` / `skills-pse.html` / `skills-ventilateur.html`, `auscultation.html` / `auscultation-pcg.html`, `ecg-trainer.html`, `admin.html`, `graph_editor.html`, `profile.html`, `tutorial.html`, `themes.html`, `credits.html`, `ai-watch.html`, `arena_play.html`
- **JS**: `js/game.js` (logique de jeu), `js/ecosMode.js` (mode ECOS), `js/caseLoader.js` (chargement des cas), `js/case-aliases.js` (table des anciens noms de cas), `js/MedicalGameManager.js`, `js/clinicalAgentAI.js` (agent IA), `js/jevClient.js` (notation Jev), `js/utils.js` (helpers globaux : `escapeHtml`, `sanitizeHtml`, `showNotification`, `getCookie`, `setCookie`), plus ~90 modules 3D et specialised
- ** moteur de jeu isole** : `engine/MedGameEngine.js` (logique pure, testable sans DOM) et `engine/scoring.js` (source unique de la notation et des conversions d'échelle, partagée avec le navigateur)
- **Audio** : un contexte unique et 6 bus — voir la section « Sound design » plus bas
- **Serveur MCP** : `mcp-server.js` (proxy LLM local + WebSocket + health check)
- **Netlify** : `netlify/functions/llm-proxy.js`, `netlify/functions/jev-proxy.js` (quotas API côté serveur)
- **CSS**: feuilles par page dans `css/` (plus `css/immersive.css` la plus lourde)
- **Data**: cas cliniques JSON dans `data/`, indexés par `data/case-index.json` + métadonnées par cas dans `data/case-meta.json` (tous deux générés par `scripts/generate-case-index.mjs`)
- **Schemas**: `schemas/case.schema.json` (validation par `scripts/validate-cases.mjs`)
- **Assets**: images et modèles 3D GLB dans `assets/`. Les seuls fichiers audio du dépôt sont les **246 enregistrements d'auscultation** (`assets/audio/auscultation/`) — tout le reste est synthétisé (voir « Sound design »).

## Sound design

**Un seul `AudioContext` pour toute l'application**, six bus mixables, zéro
fichier audio hors auscultation. Le son est intégralement synthétisé à la
volée : zéro octet d'asset, zéro requête réseau, et un contrôle fin sur le
timbre.

```
source ─┬─ bus.ui ─────────┐
        ├─ bus.sfx ────────┤
        ├─ bus.medical ────┼─ master ─ compresseur ─ limiteur ─ destination
        ├─ bus.auscultation┤
        ├─ bus.ambience ───┤
        └─ bus.music ──────┘
```

Chaque bus est deux gains en série : `userGain` (réglage du joueur, persisté)
puis `duckGain` (abaissement automatique quand un son prioritaire parle).

| Fichier | Rôle |
|---|---|
| `js/audio-core.js` | Le contexte, le graphe de bus, le limiteur, les réglages persistés, les primitives de synthèse, le ducking, les boucles avec poignée. **Seul module autorisé à créer un `AudioContext`.** |
| `js/audio-sfx.js` | Le registre des ~60 effets (interface, jeu, ECOS, auscultation, ECG). Une fonction par son, un bus par défaut. |
| `js/audio-medical.js` | Couche patient : cœur S1/S2 piloté par la FC, respiration, souffle, bip ECG, alarmes. Un ordonnanceur à anticipation les pilote tous. |
| `js/audio-ambience.js` | Lieu (ventilation, couloir) et partition adaptative à 5 états, avec modulation continue sur les constantes. |
| `js/audio.js` | Façade de compatibilité : `MedGameAudio.play('correct')` et toute l'API historique. Redirige, ne synthétise rien. |
| `js/three-audio.js` | Pont ESM : `medicalAudio` lit `window.MedGameMedical`. Ne crée plus de contexte. |

**Ordre de chargement obligatoire** (les 6 pages HTML le font, toutes en
`defer`) : `audio-core.js` → `audio-sfx.js` → `audio-ambience.js` →
`audio-medical.js` → `audio.js`. Le socle est un script **classique** et non
un module ESM, parce que les ~100 sites d'appel utilisent `<script defer>` et
doivent rester synchrones ; le code 3D en ESM lit simplement le global.

Piège à connaître : `defer` sur `audio.js` n'est pas facultatif. Un script
classique **bloquant** s'exécute avant les scripts `defer`, donc la façade
tournerait avant le socle, prendrait sa branche de repli inerte, et
`MedGameAudio.play()` ne ferait plus rien sur toute la page. C'est arrivé, et
`test/verify-ui-audio.mjs` vérifie désormais `MedGameAudio._unavailable` — lire
seulement `!!MedGameAudio` ne détecte rien, les deux branches le définissent.

Et le symétrique, qui a coûté 3,9 s de gel au chargement du jeu : **le socle ne
crée le contexte qu'au premier geste.** `getContext()` ne crée plus rien, il
renvoie `null` s'il n'existe pas encore. Une couche qui veut démarrer s'abonne
via `whenReady(cb)`. Voir « Initialisation du jeu », règle 1.

**Règles à respecter :**

- **Ne jamais créer un `AudioContext` hors `js/audio-core.js`.** Un contexte
  parasite se branche généralement sur sa propre destination et contourne le
  mute global, les réglages par bus et le mode calme. C'était le bug de
  `js/nurse.js` et `js/three-hud-agent.js`. `test/audio.test.mjs` le vérifie,
  avec une liste blanche explicite (`auscultation-audio.js` pour son repli).
- **Ne jamais utiliser `new Audio(...)` ni une balise `<audio>`.** Tout passe
  par `MedGameAudio.play()` / `MedGameSound.play()`.
- **Un son appelé doit exister dans le registre.** `test/audio.test.mjs` analyse
  statiquement tous les appels `.play(` du dépôt et échoue si un littéral ne
  correspond à aucun son enregistré. Huit sites appelaient `success`,
  `card_flip` et `playAlert`, qui n'existaient pas : ces réponses étaient
  silencieuses.
- **Réglages : une seule clé**, `medgame.audio.v2` (JSON). Les anciennes clés
  plates `medgame.audio.volume` et `medgame.audio.muted` sont **lues** une
  fois pour migration, jamais écrites. Le socle ne propose plus de volume par
  défaut contradictoire. Le curseur de la page d'auscultation
  (`#pcg-volume-slider`) a sa propre clé, `medgame.auscultation.volume` : les
  deux gains sont en série dans le graphe, écrire la même valeur sur le bus et
  sur le gain local donnerait un volume au carré.
- **Plafond de gain : 1.5, pas 1.0** (`BUS_GAIN_MAX`), parce que le curseur
  d'auscultation (`#pcg-volume-slider`) va déjà jusqu'à 1.5 depuis toujours.
  Le limiteur + le soft-clip `tanh` absorbent le risque de saturation.
- **Le mute est une rampe de 120 ms**, pas une coupure franche : un instantané
  à 0 produirait un claquement. Les tests navigateur attendent la fin de la
  rampe avant de juger.
- **Le mode calme** est lu via `MedGameModes.isCalmMode()` s'il existe, sinon
  via `localStorage`. `Sound.constants.STRESSFUL_SOUNDS` liste ce qui doit
  être coupé (alarmes, tick de timer, chutes de constantes) — le feedback
  pédagogique, lui, reste.
- **`MedGameMedical.applyVitals()` est l'unique entrée de l'état clinique.**
  Le son et la musique ne peuvent pas diverger de l'affichage des
  constantes.

**Le cœur n'est pas un bip.** S1 est un impact grave (58 → 31 Hz) plus un
corps filtré ; S2 est plus court, plus aigu et nettement plus faible. L'écart
S1-S2 **se comprime avec la fréquence cardiaque** (160 ms à 60 bpm, 75 ms à
180 bpm), comme en physiologie. Un ordonnanceur à anticipation (25 ms de tick,
180 ms d'anticipation) programme les événements sur `ctx.currentTime`, donc le
bip ECG tombe sur l'onde R et le tout ne dérive pas sur un onglet en arrière-plan.

**La musique adaptative** utilise des voix permanentes : chaque état est un
ensemble de voix dont on ne bouge que le gain, jamais le fondu croisé entre
sources. Passer de « tendu » à « critique » est donc instantané et sans trou,
et le filtre de la nappe reste modulable pendant la transition. Par-dessus,
une tension continue calculée depuis les constantes (`computeTension()`)
module le filtre, l'accord et la vitesse de pulsation.

**Tests audio :**

- `test/audio.test.mjs` — 42 tests. Cohérence statique (registre, appels,
  topologie du graphe via un faux `AudioContext`, bornes, persistance),
  portée des scripts (une page qui charge la façade doit charger le socle
  avant elle) et comportement physiologique (`s2Gap`, `computeTension`, PRNG).
- `test/verify-ui-audio.mjs` — 49 vérifications dans Chrome, branché sur
  `npm run test:ui`. Il ne vérifie pas la structure du code mais **le signal** :
  il lit la forme d'onde à la sortie. C'est le seul moyen de prouver qu'un son
  est entendu. Cinq pièges sont documentés dans le fichier, tous payés :

  1. un son de 22 ms est manqué par un échantillonnage large ;
  2. B1 émet deux franchissements de seuil par battement — il faut une période
     réfractoire de 240 ms, supérieure à l'écart S1-S2, sinon on compte S1 et
     S2 comme deux battements ;
  3. il faut attendre les **cinq** scripts `defer` avant de tester leur
     présence, sinon on interroge la couche médicale pendant que la façade
     n'est pas encore exécutée et les vérifications tombent au hasard ;
  4. il faut aussi attendre que les **gains appliqués égalent les réglages**
     avant de mesurer : la page pose son préréglage en différé, et une lecture
     en pleine rampe fait échouer « le gain n'a pas bougé » sans aucun défaut
     produit ;
  5. comparer deux amplitudes prises à quelques secondes d'intervalle compare
     aussi l'état du ducking — la priorité `auscultation` abaisse `ui` et
     `sfx` à 20 % pendant 0,6 s. C'est la priorité qu'il faut vérifier : le
     gain appliqué, que le duck ne touche pas.

  Le nettoyage du profil Chrome patit du même EBUSY : `rmSync` est tenté puis,
  en cas d'échec, le répertoire est **renommé** (opération encore autorisée sur
  un répertoire dont des fichiers sont ouverts) et effacé au balayage de
  l'exécution suivante, quand plus personne n'y touche.

## Tests & Validation
- `npm test` : suite `node --test` (fichiers `*.test.mjs` listés explicitement dans `package.json` — **ajouter tout nouveau test à la liste**)
- `npm run test:ui` : tests navigateur via Chrome DevTools Protocol (`test/verify-ui-*.mjs`)
- `npm run validate:cases` : validation schéma + cohérence de tous les cas
- `npm run generate:index` : régénère `data/case-index.json` et `data/case-meta.json`
- CI (`.github/workflows/ci.yml`) : `npm test`, `validate:cases`, `node --check` sur tous les modules

`test/tooling.test.mjs` **applique** la première règle : il compare la liste
de `package.json` aux fichiers réellement présents dans `test/`, vérifie que
chaque script npm pointe vers un fichier existant, que toute dépendance npm
importée est déclarée, et que `.env.example` documente toute variable lue
par le code. Un test nouveau oublié dans `package.json` fait donc échouer le
CI au lieu d'être silencieusement ignoré.

`test/security-headers.test.mjs` compare la CSP des trois points de livraison
(`netlify.toml`, `_headers`, `nginx-security.conf`) **octet pour octet**, les
5 en-têtes de sécurité, les règles de `Cache-Control` entre `netlify.toml` et
`_headers`, et le piège nginx (`add_header` dans un `location` annule ceux
hérités du `server`).

## Nettoyage : ce qui a été supprimé, et ce qui a été laissé

Un passage de grand nettoyage a retiré 15 fichiers morts, `dist/` (29 Mo), et
environ 1 400 lignes de code mort dans les fichiers vivants. Quatre décisions
méritent d'être écrites, parce qu'elles ne se relisent pas dans le code.

**0. L'historique Git a été réécrit.** Les fichiers audio supprimés du dépôt
(`assets/sounds/heartbeat.mp3` 86 Mo, `hospital_ambient.mp3` 24 Mo — le cœur
est synthétisé depuis), le PDF de cours de `data/ref/`, les doublons de
`data/archive/`, `icone.png`/`icone.webp` et les sources PBR des textures de
placard restaient dans l'historique : 130 Mo de blobs morts, dans un dépôt
dont l'arbre de travail ne pesait que 147 Mo. `git filter-repo --invert-paths`
les a retirés de **tous** les commits, sur les 6 branches, et le résultat a
été poussé en force.

> ⚠️ **Tous les SHA ont changé.** Un clone antérieur à cette réécriture
> diverge de `origin` et doit être réaligné (`git fetch origin && git reset
> --hard origin/jev`), pas seulement tiré. Un bundle de sauvegarde de
> l'historique d'origine a été conservé hors du dépôt.
>
> ⚠️ `--path` **sans** `--invert-paths` ne garde que les chemins listés (et
> vide l'arbre s'ils n'existent plus). L'-erreur a été faite ici, puis
> corrigée : l'arbre de travail a été comparé **bit pour bit** avec la
> sauvegarde avant tout push.

**1. Le scoring a une source unique : `engine/scoring.js`.** Avant, le
navigateur notait sur /20 (Jev) et l'engine MCP notait sur /100 avec une
règle parallèle codée en dur — deux algorithmes, deux échelles, aucun pont.
`engine/scoring.js` (pur, sans DOM ni Node) porte désormais la règle /100
historique et les deux conversions. `engine/MedGameEngine.js` délègue à
`computeClassicScore()` et renvoie `scoreOn20` **en plus** de `score` : le
contrat MCP et `ai-watch.html` dépendent de `score` sur /100, il n'a pas été
cassé. Côté navigateur, `js/jevClient.js` ré-exporte `toScore100` et
`game.js` l'utilise au lieu d'un `Math.round` en ligne.

> ⚠️ Le module est dans `engine/`, **pas** dans `js/`. Un ancien
> `js/scoring.js` (moteur de note complet) a été supprimé lors de la bascule
> Jev, et `test/anticheat.test.mjs` interdit son retour. Le navigateur garde
> **un seul noteur**. Ne pas le ressusciter sous un autre nom.

**2. `css/immersive.css` et `css/game.css` dupliquent 40 règles** (5,6 Ko),
et les deux fichiers sont chargés par `game.html` — le HUD est donc parsé et
appliqué deux fois. La mutualisation **n'a pas été faite**, volontairement :
`immersive.css` est aussi chargé par `index.html` (sans `game.css`), 19
sélecteurs ont un corps *différent* entre les deux fichiers, et il n'existe
aucun test de régression visuelle dans la suite. Un « grand nettoyage » qui
casse un rendu pour 5,6 Ko n'est pas un nettoyage. Le même raisonnement vaut
pour `nextQuizQuestion()` (auscultation/ECG) et `resizeCanvas()` (echo/
ventilateur) : extraire ces 12 lignes demanderait de charger `js/utils.js`
sur deux pages de plus, avec ses effets de bord, pour moins de gain que de
risque. En revanche `auscultation.css` / `ecg-trainer.css` **ont** été
mutualisés (`css/skills-common.css`) : pages séparées, règles identiques à
l'octet, cascade vérifiée sélecteur par sélecteur.

**3. Il y a DEUX routeurs LLM, et c'est un bug assumé pour l'instant.**
`js/clinicalAgentAI.js` et `js/MedicalGameManager.js` sont tous deux un
« Maître du Jeu » : même prompt, mémoire d'historique, écriture des
constantes. En mode 3D, **un seul message du joueur déclenche deux appels
LLM** et deux écritures concurrentes sur les constantes — donc le 2D et le
3D ne se comportent pas pareil. `MedicalGameManager.js` est le plus récent et
celui que l'ECOS suppose ; `clinicalAgentAI.js` est réduit au 3D. Les fusionner
est un chantier à part, pas un nettoyage : cela demande de rejouer des
sessions 2D et 3D et de comparer les traces. Le sujet reste ouvert.

**Piège de compilation, payé plusieurs fois :** réécrire un fichier JS avec
`Set-Content` en PowerShell 5.1 (ou tout outil qui relit en ANSI) **corrompt
tous les accents** — le fichier reste du UTF-8 valide, mais `é` devient `Ã©`.
`node --check` ne voit rien, les tests ne voient rien (les chaînes ne sont
pas comparées), et le diff montre 400 lignes changées au lieu de 4. Symptôme :
`Ã`, `â€"` et `Â` en plein milieu d'un fichier qui était correct la veille.
Utiliser `edit`/`write`, ou Node avec `readFileSync(f,'utf8')`.

## Conventions de dépôt

Quatre règles qui ont chacune payé une panne.

**0. Les `fetch()` de `data/` sont relatifs à la RACINE du site, pas au
fichier.** `js/caseLoader.js`, `js/editor.js`, `js/prescription.js`,
`js/profile.js` et `js/themes.js` font `fetch('data/case-index.json')`. Ces
chemins se résolvent contre l'URL du **document**, pas contre celle du
script : ils marchent parce que les 21 pages sont à la racine du dépôt, et
casseraient si l'application etait servie sous un sous-chemin. Le passer en
`new URL('../data/...', import.meta.url)` est la forme robuste, mais elle
impose que ces fichiers soient des modules ES — donc **ne pas le faire a
moitie** : les deux formes doivent changer ensemble, sinon une page perd ses
donnees silencieusement.

**1. Pas de jeton `?v=` sur le code applicatif.** L'identité d'un module ES est
son URL résolue : le même fichier sous deux URL = **deux instances**. Le projet
posait un `?v=` différent sur chaque fichier, et `ai-watch.html` chargeait
ainsi toute la pile 3D deux fois (deux graphes de scène, deux contextes
WebGL). Le cache est désormais géré par `Cache-Control` (`/js/*` et `/css/*` en
`max-age=0, must-revalidate`, cf. `netlify.toml` et `_headers`). Les
binaires sous cache long (`assets/`) peuvent garder un `?v=` : ce ne sont pas
des modules.

**2. Un seul `AudioContext`, un seul `THREE`, une seule table d'alias.**
- `js/case-aliases.js` est la **source unique** de la table des anciens noms
  de cas (240 entrées). Elle était dupliquée à l'identique dans
  `js/caseLoader.js` et `engine/MedGameEngine.js` — et une migration avait
  déjà dû patcher les deux à la main. Elle est publiée sur `globalThis` parce
  qu'elle doit être lisible depuis un script classique (navigateur) **et**
  depuis un module ES (Node).
- `getCookie` / `setCookie` sont définis **uniquement** dans `js/utils.js`.
  Les copies locales qui existaient dans `themes.js` et `profile.js` lisaient
  le cookie brut et ignoraient le miroir `localStorage` : la liste « cas
  joués » était donc tronquée à 30 entrées sur ces deux pages, alors que le
  jeu en voyait la liste complète.
- `window.threeManager.THREE` est l'accès au namespace three.js pour les
  scripts **classiques** (`js/clinicalAgentAI.js`). Il n'existe pas de global
  `THREE` : l'ancien repli `window.THREE || scene.__proto__.constructor`
  résolvait la classe `Scene`, donc `new THREE.Group()` levait un TypeError.

**3. Les fins de ligne sont normalisées par `.gitattributes`.**
`* text=auto eol=lf` + des règles `binary` explicites pour `.glb`, `.mp3`,
`.wav`, `.bin`, `.png`… Sans ce fichier, le dépôt dépend de la machine :
`core.autocrlf=true` vient de la configuration **globale** de Git, pas du
dépôt, donc 97 fichiers étaient en CRLF, 229 en LF et 17 **mixtes**. Le
symptôme le plus coûteux : `js/ecosMode.js` contenait un octet NUL brut
(séparateur de clé de cache), git le classait donc « binary », ne normalisait
rien, et son diff affichait **4308 lignes pour 92 lignes de changement
réel**. Un octet NUL dans un fichier texte : il suffit à tout déstabiliser.

## Initialisation du jeu (entrée dans une partie)

C'est le chemin le plus sensible : c'est là que le joueur décide si le site est
« rapide » ou « ça gèle l'ordinateur ». Mesuré au profileur CPU de Chrome (CDP)
sur `game.html`, thème *urgence*, 25 s de mur. Avant → après :

| Poste | Avant | Après |
|---|---|---|
| `gl.getProgramInfoLog` (compilation de shaders) | 53,9 s | **0 s** |
| dont `renderTransmissionPass` (2ᵉ rendu de la scène, chaque image) | 19,0 s | **0 s** |
| création du contexte audio dans `initializeGame` | 3,9 s | **0 s** |
| `initializeGame` (chargement + rendu du cas) | 1,43 s | **7 ms** |
| tâches longues (> 50 ms) sur l'entrée | 328 (50,7 s cumulées) | **0** |
| thread principal | saturé | **85 % idle** |
| poids réseau de l'entrée | **17,4 Mo** | **4,5 Mo** |

Quatre règles, chacune payée par un défaut observé :

**1. Aucun `AudioContext` avant le premier geste.** `new AudioContext()` ouvre un
flux auprès du système : c'est **synchrone**, et mesuré à **1,3 à 3,6 s de temps
principal**. Or `initializeGame()` appelait `playSound('reveal')`, donc on payait
ce gel avant le moindre clic — pour rien, puisque le navigateur refuse de démarrer
un contexte créé sans geste (« The AudioContext was not allowed to start ») et que
tout ce qu'on y synthétise est muet.

Le socle a donc trois règles :
- `getContext()` **ne crée plus** le contexte, il le renvoie (`null` s'il n'existe
  pas). Tous les appelants testaient déjà `if (!c) return …` : leur garde-fou
  devient le chemin normal ;
- `whenReady(cb)` exécute `cb(ctx)` dès que le contexte existe, immédiatement s'il
  existe déjà — c'est par là que repartent l'ambiance, le cœur, la respiration et
  le bip ECG, qui s'abonnent au lieu d'espérer ;
- `boot()` ne crée plus rien non plus. Il s'abonne.

`bindUnlock()` est posé **au chargement du module**, plus dans `init()` : si on
attendait le premier `init()` pour écouter `pointerdown`, et que `init()` est
précisément retardé au premier geste, aucun son ne jouerait jamais.

**2. Le miroir `localStorage` des cas est borné.** Les 95 fichiers de `data/`
pèsent **3,3 Mo**. Le miroir en faisait un `JSON.stringify` de 3,3 Mo sur le
thread principal, puis un `setItem` qui dépassait le quota de 5 Mo partagé —
donc intercepté, et perdu. Seul l'index des cas est persisté maintenant
(`MIRROR_MAX_BYTES`, 64 Ko) ; le cache HTTP du navigateur fait le reste. Un
miroir écrit par une version antérieure est purgé à la lecture.

**3. Le préchargement d'assets attend le 3D.** `predictive-streamer` téléchargait
le patient (257 Ko) **et** le médecin (1,55 Mo), et les écrivait au CacheStorage,
sur une partie 2D où aucun de ces modèles n'est rendu. `predictiveStreamer
.setArmed(true)` est appelé par `_init3D()` ; en attendant, le cas est mémorisé
pour être servi dès l'activation.

**4. Le poids des images de fond et d'icône.** `icone.webp` — 2,3 Mo, et c'était la
`favicon` de **23 pages** — est remplacé par `favicon-32.png` (3 Ko) /
`favicon-32.webp` (1 Ko), plus `apple-touch-icon.png` (74 Ko) pour iOS.
`icone.webp` a été supprimé : **aucune page ne déclare de `og:image` ni de
`twitter:image`**, donc il ne sert plus à rien. `manifest.json` pointe sur
`icon-192.webp` / `icon-512.webp`. Et `FondAccueil.webp`, le fond de toutes les pages, était un
WebP **VP8L lossless** de 911 Ko : réencodé en lossy q82, **71 Ko**, sans
différence visible (vérifié à l'œil). Attention : 1344×768 n'a rien de spécial —
la conversion lossless arrive quand on force le mode dans un convertisseur.

### Chargement paresseux des cas (fait)

Le 3D ne participe plus à l'entrée ; le poids restant venait des cas eux-mêmes
(`data/` ≈ 4,2 Mo, un thème entier pouvait faire 22 cas / ~930 Ko). Le jeu et la
page « thèmes » téléchargeaient **tous** les JSON d'un thème. C'est corrigé :

| Fichier | Rôle |
|---|---|
| `js/caseLoader.js` | `buildCaseDescriptors()` renvoie des descripteurs légers `{ id, file\|dbId }` (aucun corps). `loadCaseBody()` résout un corps à la demande (cache mémoire/TTL, Supabase ou fichier local). Les branches multi-sélection et repli thème renvoient des descripteurs. |
| `js/gameState.js` | `ensureCaseLoaded(index)` charge le corps du cas courant ; `nextCase()` avance sans charger. |
| `js/game.js` | `loadCase()` est `async` : il résout le corps **une fois** avant de construire l'état/DOM, affiche « Chargement du cas… », et **précharge le cas suivant** en idle (`requestIdleCallback`). |
| `data/case-meta.json` | Métadonnées par cas (motif, patient, difficulté, `examCount`, `lockCount`, `isEcos`, `isUrgence`, vignette), générées par `scripts/generate-case-index.mjs` en même temps que l'index. |

L'`id` d'un cas est par convention la base de son nom de fichier (vérifié sur
tous les cas indexés), donc `SessionSnapshot` — qui compare des listes d'`id` —
reste cohérent sans télécharger les corps.

La page « thèmes » (`js/themes.js`) lit `case-meta.json` et n'appelle plus
`fetch('data/<cas>.json')` pour rendre sa liste (repli sur le fetch complet si
la méta est absente, donc un index non régénéré ne casse rien).

Observable vérifié par `test/verify-ui-game-loading.mjs` (CDP `Network`) : avec
6 cas sélectionnés, l'entrée en partie ne télécharge que **2 corps** (courant +
suivant préchargé), pas 6.

> `data/case-meta.json` est un artefact généré : le régénérer avec
> `npm run generate:index` après tout ajout/renommage de cas.
> `scripts/validate-cases.mjs` et le générateur l'excluent du scan des cas.

## Performance 3D
Cible : **toutes** les machines, du portable sans GPU dédié au PC de jeu. Le 3D
doit démarrer sans jamais figer l'onglet, et tenir la cadence quoi que soit le
matériel.

**0. Le 3D est OPT-IN.** Il ne démarre **que** sur le clic du bouton « Vue 3D »
de `game.html`, plus sur `?render=3d` ou une session où le joueur l'a déjà choisi
(`sessionStorage: use3D`). La condition historique `window.innerWidth >= 768`
lançait tout le pipeline WebGL dès le premier `requestIdleCallback` — donc avant
le moindre clic — et le joueur payait la construction pour une scène qu'il
n'avait pas demandée. Conséquences utiles : le clic est le seul moment qui
compte comme geste utilisateur, ce qui débloque enfin `requestFullscreen()`
(il refusait « API can only be initiated by a user gesture ») et l'audio.

> `sessionStorage` et non `localStorage` : le choix vaut pour l'onglet. Un
> onglet ne se rouvre pas en 3D parce qu'il l'était la veille, et rien ne
> survit au changement de machine.

`initializeGame()` est le seul point d'activation différée : il restaure la 3D
si `sessionStorage.use3D === 'true'`, **ou** si `?render=3d` est présent sur
l'URL (cette dernière prime sur le réglage « mode texte »). `?render=2d` reste
un veto absolu, appliqué par `three-manager.init()`. La station ECOS ne
bascule **jamais** d'elle-même en 3D : elle ne fait que relayer le même opt-in
(`use3D` ou `?render=3d`) — sinon le joueur en pleine anamnèse 2D était projeté
dans la scène WebGL sans l'avoir demandé.

**1. La construction est étalée, jamais bloquante.** `ThreeScene.init()` est
`async` et délègue à `TaskScheduler.runBatched` (`js/task-scheduler.js`), qui
rend la main après `BUILD_BUDGET_MS` (8 ms). `enhanceRoomSteps()` expose la
salle en **vingt tranches** : sans cela `enhanceRoom()` construisait ~110
maillages d'un bloc, qu'aucun budget ne pouvait couper. La boucle de rendu est
démarrée **avant** la construction — la salle se remplit à l'écran.

> Piège dans `runBatched` : **au moins une tâche par tranche**. Un navigateur
> qui ne signale jamais de temps libre (`requestIdleCallback` avec
> `timeRemaining() === 0`, onglet en arrière-plan, headless) ferait boucler la
> tranche indéfiniment sans rien exécuter, et la scène n'aboutirait jamais.
> Vérifié : en headless, `timeRemaining` vaut bien 0.

**1 bis. L'écran de chargement doit être branché.** `initLoadingOverlay()`
(`js/three-loaders.js`) existe depuis longtemps mais n'était appelé **nulle
part** : demander la vue 3D donnait plusieurs secondes de page figée sans la
moindre explication. `_init3D()` l'appelle maintenant, **avant sa première
attente**, et rend un contrôleur `{ setPhase(), finish() }` : la phase affichée
est déclarée par le code (« Chargement du moteur 3D », « Chargement du médecin »,
« Construction de la salle ») donc exacte, et l'écran ne disparaît que sur
`finish()`, c'est-à-dire quand la scène est **réellement** construite. La
minuterie de sécurité de 12 s d'avant est supprimée : elle masquait l'écran
bien avant la fin du travail en rendu logiciel (70 s), laissant une page figée
SANS EXPLICATION — exactement le défaut signalé.

La barre est **indéterminée**, et c'est délibéré : le nombre total d'assets 3D
n'est pas connu quand l'écran s'affiche (les modèles sont découverts pendant la
construction), donc un « 47 % » serait inventé. Une barre qui balaie dit la même
chose honnêtement.

> **PIÈGE — un sélecteur CSS ne peut pas commencer par un chiffre.** L'écran
> s'appelait `#3d-loading`. `#3d-loading { … }` est un sélecteur **invalide** :
> Chrome **jette silencieusement** la règle — `new CSSStyleSheet().replaceSync(
> '#3d-loading{…}').cssRules.length` renvoie `0`, sans lever la moindre erreur.
> Concrètement l'écran s'affichait en texte nu au milieu de la page
> (`display:block`, `position:static`). La feuille est passée de `innerHTML` +
> `<style>` (qui ne s'applique pas sur un nœud détaché) à un vrai
> `css/three-loading.css`, et l'id est devenu `#three-loading`.
>
> ⚠ Ne jamais nommer un sélecteur par un id commençant par un chiffre : `#3d-…`,
> `#2fa-…`, `#0-…` sont tous ignorés, sans avertissement. Écrire `#three-…`, ou
> échapper (`#\33 d-loading`).

**2. Le post-processing est différentiel, donc rare.** `GTAOPass` rend la scène
**une seconde fois** (override normal + profondeur) et `UnrealBloomPass` ajoute
~10 passes plein écran. GTAO est réservé à `gpu-high` ; `medium` et `high`
rendent directement. Le composer n'est construit qu'à `COMPOSER_DELAY_MS`
(2,5 s) après un premier frame stable, jamais pendant le chargement. Palier 3
de `sample()` : le composer est détruit — c'est le plus gros levier possible.

**3. La détection est prudente à l'aller, automatique au retour.**
`detectTier()` traite le rendu logiciel et les GPU intégrés, et **démarre à
`low` quand le nom du GPU est illisible** — Chrome masque
`WEBGL_debug_renderer_info` de plus en plus, et deviner « performant » sur la
seule foi du nombre de cœurs fait tomber à 15 fps un portable. `sample()`
remonte alors d'un cran dès que la cadence le prouve, jusqu'à `_ceiling`. Un
preset choisi au bouton fige tout (`_autoMode = false`) et n'est écrit dans
`localStorage` que s'il vient de l'utilisateur : un preset auto-détecté ne doit
pas survivre au changement de machine.

**4. Le décor d'ambiance suit un palier de détail** (`setDetailLevel`). ~30
objets purement décoratifs sont enregistrés via `_registerDecor` avec leur palier
minimum ; sous `low` ils sont `visible = false`, donc ni dessinés, ni inclus dans
la passe d'ombres, ni testés au raycast. Aucun n'est interactif — les objets
cliquables sont marqués `userData.interactive`, jamais dans cette liste.
`_registerDecor` ne capture que des variables **déclarées dans la portée de la
méthode** : `mkFrame()` dans `_addDaylightWindow` ne renvoyait rien, et référencer
son `m` local a cassé la construction (piège déjà payé).

> **Une lumière n'est JAMAIS du décor.** Une lumière `visible = false` sort de
> la liste des lumières de three.js, et le nombre de lumières entre dans la clé
> de cache du programme de **chaque** matériau. Masquer une lumière par le palier
> de détail ne l'éteint donc pas : three.js **recompile toute la salle** — au
> moment de la détection du GPU, c'est-à-dire quand la machine est déjà à la
> limite. `setDetailLevel` met l'intensité à zéro pour les lumières
> (`userData.baseIntensity`) et ne touche qu'`visible` pour le reste. La
> `RectAreaLight` et la `PointLight` « ciel » ont été supprimées pour cette
> raison, la seconde doublant `windowFill` à 20 cm.

**5. Le travail par frame est proportionné à ce qu'il change.** Les constantes
vitales sont à 12 Hz et n'allouent plus (couleurs réutilisées), la lumière
d'urgence est mémorisée au lieu d'un `getObjectByName` par frame, les ECG
re-rendent leur fond pré-rendu, le scope du HUD tourne à 30 Hz, le raycast est
à 20 Hz avec `getBoundingClientRect` mis en cache et n'écrit dans le DOM que
**quand l'état change**, et le `resize` est coalescé sur une frame (sinon chaque
`setSize` réalloue les render targets du composer).

### Le nombre de programmes de shader est LE coût de la page 3D

Tout le reste est secondaire. Trois.js **ne compile pas les matériaux** : il les
compile paresseusement, **pendant le rendu**, à la première utilisation de chaque
programme. Le coût n'est donc pas la construction de la salle, c'est la
compilation des shaders — et elle est bloquée jusqu'au pilote, sur le thread
principal, en plein jeu. Quatre règles, chacune mesurée :

**a. Aucun matériau `transmission`.** Un seul `MeshPhysicalMaterial` avec
`transmission: 0.72` — le flacon de gel de `three-room.js` — suffisait à faire
exécuter `renderTransmissionPass()` **à chaque image** : un rendu COMPLET de toute
la scène dans une cible de transmission, en plus du rendu normal. Pire : cette
passe rend dans un render target, donc `outputColorSpace` et `toneMapping`
diffèrent, donc **chaque programme de la scène existe en deux exemplaires** et la
salle se compile deux fois. Mesuré : 19 s de CPU sur 60, dont 18 s dans
`getProgramInfoLog`. Un verre simulé (`transparent` + `opacity` + fort
`clearcoat`) est indiscernable à cette échelle. `createMaterial()` ne réaccepte
plus `opts.transmission`.

**b. Le moins de lumières, mieux.** La scène en comptait **12** : ambiante,
hémisphérique, une directionnelle projetant l'ombre, un spot d'examen, et **six**
`PointLight` (2 dalles LED, un fill de fenêtre, un fill de ciel, un fill d'écran,
2 « rebonds » de radiosité à 0,16-0,18 d'intensité). Chacune ajoute un bloc de
calcul dans le fragment shader de **tous** les matériaux, donc dans la **longueur**
de chaque programme à compiler. Les six sources ponctuelles sont maintenant
**trois** (dalle centrale unique, `windowFill`, halo d'écran), l'ambiante et
l'hémisphérique sont relevées, et la restitution que donnaient les rebonds est
prise en charge par l'IBL (`environmentIntensity` 0,72 → 0,9), qui est un simple
échantillonnage de cubemap. **C'est le plancher** : `setClinicalMood` applique
désormais un **ratio** de `userData.baseIntensity`, parce que ses intensités
fixes étaient silencieusement fausses dès que le nombre de lumières changeait.

**c. Ne jamais ajouter ni retirer une lumière en cours de partie.** Même clé de
cache, donc même recompilation complète. Les cadenas 3D en posaient une par verrou
(jusqu'à cinq par cas) et une par déverrouillage (flash *plus* retrait = deux
recompilations au moment précis où le joueur débloque une information) ; la
lumière d'urgence était recréée à chaque changement d'état clinique. Remplacées
par `_ensureFxLight()` — **une** source partagée, jamais détruite — et par des
halos `MeshBasicMaterial` additifs, qui ne coûtent rien.

**d. `renderer.debug.checkShaderErrors = false`.** Le drapeau vaut `true` par
défaut ; `WebGLProgram.onFirstUse()` appelle alors `gl.getProgramInfoLog()` pour
chaque programme, à sa première utilisation. Ce n'est pas une lecture de log
anodine : c'est un aller-retour **synchrone** au pilote, et il absorbe
systématiquement le travail de compilation. `gl.linkProgram()`, lui, ne mesurait
que 3,2 s sur toute la session, contre **60 s** pour la lecture du journal. La
bascule ne supprime que la lecture : une fois `checkShaderErrors` coupé, la même
attente réapparaît dans le constructeur de `WebGLUniforms`
(`getProgramParameter(ACTIVE_UNIFORMS)`), à ~36 s. Ce qui reste est le compilateur
lui-même, qu'aucun drapeau ne fait disparaître : il ne se réduit qu'en supprimant
des programmes et en raccourcissant les shaders, donc avec les règles a, b et c.
three.js fournit le drapeau précisément pour la première moitié ; on ne l'active
que sur `game.html?shaderdebug=1`, pour diagnostiquer un matériau noir.

> Ce qu'il reste : **~90 programmes** pour ~210 matériaux. C'est le produit du
> nombre de combinaisons distinctes de (type de matériau × ensemble de textures ×
> alpha × ombres × sources). Le réduire suppose de consolider les ~200 sites de
> création de matériaux — un chantier à part entière, pas une rustine.

**Ce que coûte la compilation, et quand la payer.** Les programmes se compilent
**pendant le rendu**, jamais à la construction. `renderer.compileAsync()` les
préparerait hors du chemin critique, mais c'est une tâche synchrone de taille
inconnue (mesurée à 1,6 s en rendu logiciel) : elle est donc déclenchée par
`ThreeQualityAgent` après 8 s de cadence confortable, jamais à l'`init` — sur une
machine qui ne suit pas, elle ne peut plus être payée.

**Tests** : `test/verify-ui-3d.mjs` (29 vérifications, dans `npm run test:ui`).
Il n'a aucun test unitaire derrière lui, et c'est nécessaire : `init()` étant
`async`, une étape qui lève ou un ordre faux laisse la page en 2D **sans la
moindre erreur visible**. Le test vérifie donc l'observable — sous-systèmes
construits, LOD cohérent avec le preset, composer absent au lancement, draw calls
> 0, contexte libéré à l'arrêt. Assertions sur la **médiane** de cadence, jamais
sur la queue : sous rasteriseur logiciel, l'arrivée asynchrone d'un modèle
produit un pic unique de plusieurs secondes qui ne dit rien du produit.

> Il note aussi `programmes=` et `lights=` dans son récapitulatif. Ce sont les
> deux compteurs qui bougent quand une règle ci-dessus est violée — les garder à
> l'œil coûte quelques secondes et évite de retrouver un gel à l'aveugle.


## Déploiement
- **Netlify** : headers dans `netlify.toml` **et** `_headers` (les deux doivent rester cohérents — des tests le vérifient)
- **Docker** : `nginx.conf`. Attention : dans nginx, un `add_header` dans un `location` annule ceux hérités du `server`. Les en-têtes de sécurité sont factorisés dans `nginx-security.conf`, inclus dans chaque `location` qui pose un `Cache-Control`.
- Le mp3 de 82 Mo `assets/sounds/heartbeat.mp3` est **résolu** : il a été supprimé, avec `hospital_ambient.mp3` (22,9 Mio), `urgency.mp3` et `feux_artifice.mp3` (orphelins) et `Wrong Buzzer.mp3` (le seul son lu via `new Audio(...)`). Le dossier `assets/sounds/` n'existe plus. Le cœur est synthétisé et piloté par la fréquence cardiaque réelle du patient, ce qu'une boucle figée ne pouvait pas faire. Le dépôt a perdu **105,6 Mio (110,8 Mo)**.

## Code Style
- Language: French comments and medical content, English code patterns
- Use ES6+ features (const/let, arrow functions, async/await, template literals)
- DOM manipulation via vanilla JS (`document.getElementById`, `querySelector`)
- Case file naming: `{SPECIALTY}_{condition}_{patient}.json` (e.g., `CARDIO_angor_stable.json`)
- Constants defined at top of file with SCREAMING_SNAKE_CASE
- Aucun secret côté client : `js/env.js` est servi tel quel au navigateur. Les clés API vivent dans les variables d'environnement serveur (`LLM_API_KEY`, `TYPESAFE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `QUOTA_SALT`) et ne sont jamais écrites dans `js/`.
- Ne pas réintroduire un global `THREE` : le code 3D est en ES modules qui importent `three` via l'importmap.
- Ne pas réintroduire une deuxième source de vérité audio : ni `localStorage` écrit à la main, ni `AudioContext` parallèle, ni `<audio>`. Tout passe par `js/audio-core.js`.

## Modèles 3D Patients (Kenney)
Les modèles de patients sont des fichiers GLB (glTF binaires) situés dans `assets/models/patients/` (variantes `character-male-a` à `f` et `character-female-a` à `f`).
- **Chargement dynamique** : Géré dans `js/three-patient.js` via `GLTFLoader` de façon asynchrone.
- **Sélection automatique** : 
  - Si un paramètre facultatif `"model3D": "nom_du_fichier.glb"` est défini dans le fichier JSON du cas (`patient.model3D`), ce modèle est chargé en priorité.
  - Sinon, le modèle est choisi automatiquement selon le sexe, l'âge et le prénom :
    - `âge < 30` : variantes `a` ou `b` (jeunes).
    - `30 <= âge < 60` : variantes `c` ou `d` (adultes).
    - `âge >= 60` : variantes `e` ou `f` (séniors).
- **Positionnement et Dimensions** : Les modèles sont réduits à 70% de leur taille (cible à `1.155m`) et orientés sur le dos (face vers le haut) si le patient est allongé (`Math.PI / 2` sur X et `Math.PI` sur Y).
- **Vitesse d'animation** : La vitesse d'animation du mixeur est ralentie à 10% (`mixer.timeScale = 0.1`) pour un effet calme et réaliste.
- **Lévitation** : Le déplacement vertical de respiration est désactivé dans `PatientAnimator` pour éviter que le patient ne flotte au-dessus du lit d'examen.

Les licences d'utilisation et attributions de ces modèles ainsi que du mobilier 3D importé sont listées dans [ATTRIBUTIONS.md](file:///c:/Users/Louaï/Desktop/medgame-main/ATTRIBUTIONS.md).


