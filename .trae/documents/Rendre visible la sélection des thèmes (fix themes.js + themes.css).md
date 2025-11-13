## Constat
- La sélection d’un thème se fait sur `themes.html`, pas `index.html`.
- Dans `js/themes.js` (`c:\Users\Louaï\Desktop\medgame-main\js\themes.js:44–64`), le clic applique une couleur inline via `card.style.backgroundColor` selon le texte du thème, mais:
  - La classe `selected` n’est jamais ajoutée/retirée.
  - "Gynécologie" n’a pas de couleur définie → aucun indicateur visuel lors du clic.
  - Le CSS déjà prévu pour `.theme-card.selected` (`c:\Users\Louaï\Desktop\medgame-main\css\themes.css:123–126`) n’est pas utilisé.

## Corrections proposées
1. js/themes.js: basculer vers une classe de sélection
- Remplacer la logique d’inline style par un toggle de classe:
  - `card.classList.toggle('selected')` et maintenir `selectedThemes` en cohérence.
  - Mettre à jour `aria-selected` pour l’accessibilité.
- Supprimer les affectations `card.style.backgroundColor`.

2. css/themes.css: rendre la sélection très visible
- Renforcer `.theme-card.selected`: bordure/ombre/scale léger.
- Ajouter variantes par thème sélectionné, couvrant toutes les cartes présentes:
  - `.theme-card.selected[data-theme="Cardiologie"]`, `[data-theme="Gynécologie"]`, `[data-theme="Endocrinologie"]`, `[data-theme="Hématologie"]`, `[data-theme="Gastro-entérologie"]`, `[data-theme="Immunologie"]`.
- Ajouter un indicateur universel (check) via pseudo-élément:
  - `.theme-card.selected::after { content: '✓'; position: absolute; top: 10px; right: 12px; ... }`.

## Validation
- Ouvrir `themes.html`, cliquer plusieurs cartes:
  - Chaque carte affiche clairement l’état sélectionné/désélectionné.
  - Le compteur "Thèmes sélectionnés"/"Cas disponibles" se met à jour (`js/themes.js` existant).
  - Le bouton "Commencer" s’active seulement si ≥1 thème.

## Livrables
- Patch `js/themes.js`: toggle `selected`, supprimer `backgroundColor`, ajouter `aria-selected`.
- Patch `css/themes.css`: styles `.selected` lisibles + variantes par thème + check overlay.

J’applique ces modifications et vérifie l’affichage, puis je te montre le résultat en live.