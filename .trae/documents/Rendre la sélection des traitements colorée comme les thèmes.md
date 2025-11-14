## Objectif
Aligner l’UI de sélection des prescriptions (section `Prescription` dans `game.html`) sur le style visuel de la sélection des thèmes (`themes.html`), pour une sélection plus colorée, lisible et attractive.

## Modifications CSS (dans `css/game.css`)
- Ajouter une grille dédiée à `#availableTreatments` pour un affichage en cartes: `display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;`.
- Styliser `#availableTreatments button` comme des cartes (inspiré de `.theme-card` dans `css/themes.css:82`): fond en dégradé léger, coins arrondis, ombre, padding suffisamment large, transition et effet hover.
- État survol: légère élévation (`transform: translateY(-4px)`), surbrillance de bordure.
- État sélectionné: `#availableTreatments button.selected` avec bordure accentuée (`#007bff`), fond en dégradé semblable à `.theme-card.selected` (`css/themes.css:123`), et ajout d’un indicateur ✓ via pseudo‑élément.
- Préserver la signalétique de validation:
  - Garder et prioriser `#availableTreatments button.correct-treatment` (vert) et `#availableTreatments button.incorrect-treatment` (rouge) existants (`css/game.css:283, 288`).
  - Garantir que ces classes surchargent visuellement l’état sélectionné (si besoin en ajustant l’ordre des règles ou en augmentant la spécificité pour les backgrounds).

## Ajustements JS (dans `js/game.js`)
- Conserver la structure en boutons générés dans `loadCase()` (`js/game.js:349–363`). Pas de changement de DOM nécessaire.
- Accessibilité et cohérence:
  - Dans `loadCase()`, définir `button.setAttribute('aria-selected', 'false')` et `role="button"`.
  - Dans `handleTraitementClick(event)` (`js/game.js:394–403`), basculer aussi l’attribut: `aria-selected` à `true/false` selon l’état.
- Ne rien changer à la logique de validation déjà en place (`js/game.js:405–479`) qui applique `correct-treatment` et `incorrect-treatment`.

## Comportement conservé
- Sélection/désélection multi‑traitements inchangée.
- Styles examen (`.exam-btn.selected`), diagnostic et minuteur intacts.
- Rouge/vert de correction après validation reste prioritaire visuellement.

## Vérifications
- Tester: sélection, survol, retour visuel ✓, puis validation pour voir le passage en rouge/vert.
- Confirmer que `.exam-btn.selected` n’est pas affecté.
- Vérifier lisibilité sur mobile (breakpoints existants dans `css/game.css`).

## Références de code
- Génération des traitements: `js/game.js:349–363`.
- Toggling de sélection: `js/game.js:394–403`.
- Application des classes de validation: `js/game.js:463–478`.
- Styles existants pour validation: `css/game.css:283–291`.
- Style source d’inspiration: `css/themes.css:82–146` (cartes et état sélectionné).