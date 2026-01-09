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
