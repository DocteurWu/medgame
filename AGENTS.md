# AGENTS.md - Medgame

## Build & Run
- **Dev server**: Open `index.html` in browser or use `npx serve .` / `python -m http.server`
- **Docker**: `docker build -t medgame .` then `docker run -p 8888:8888 medgame`
- **No build step**: Static HTML/CSS/JS app, no bundler or transpiler

## Architecture
- **Frontend**: Vanilla JS, HTML5, CSS3 (no frameworks)
- **Pages**: `index.html` (home), `game.html` (main game), `themes.html` (theme selection), `editor.html` (case editor), `tutorial.html`
- **JS modules**: `js/game.js` (core game logic), `js/themes.js`, `js/editor.js`, `js/loadCases.js`, `js/config.js`
- **CSS**: Per-page stylesheets in `css/` folder
- **Data**: Medical cases as JSON files in `data/`, indexed by `data/case-index.json`
- **Assets**: Images/icons in `assets/`

## Code Style
- Language: French comments and medical content, English code patterns
- Use ES6+ features (const/let, arrow functions, async/await, template literals)
- DOM manipulation via vanilla JS (`document.getElementById`, `querySelector`)
- Case file naming: `{SPECIALTY}_{condition}_{patient}.json` (e.g., `CARDIO_angor_stable.json`)
- Constants defined at top of file with SCREAMING_SNAKE_CASE

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

