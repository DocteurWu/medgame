## Objectif
- Ajouter un réglage du temps imparti (Dur 2:30, Normal 4:00, Facile 8:00) dans `index.html`.
- Conserver le choix pour toute la session (par onglet) et l’appliquer au minuteur du jeu.

## Approche
- UI: un modal “Paramètres” dans `index.html` avec 3 options radio et un bouton “Enregistrer”.
- Stockage: `sessionStorage` pour `timeMode` et `timeLimitSeconds` (par onglet, persiste entre pages tant que l’onglet est ouvert).
- Jeu: `js/game.js` lit la valeur au chargement et à chaque nouveau cas, au lieu de valeurs codées en dur.

## Modifications ciblées
- `index.html`:
  - Ajouter le markup du modal et son JS pour ouvrir/fermer, sélectionner et sauvegarder.
  - Initialiser l’état des radios depuis `sessionStorage` au chargement.
  - Conserver le bouton existant `#settings-button` et lui attacher l’ouverture du modal.
- `js/game.js`:
  - Créer une fonction `getTimeLimit()` qui lit `sessionStorage.timeLimitSeconds` et retourne la valeur (par défaut 240 s = 4:00).
  - Initialiser le minuteur avec le réglage:
    - Remplacer l’initialisation: `let timeLeft = 180` → `let timeLeft = getTimeLimit()` (c:\Users\Louaï\Desktop\medgame-main\js\game.js:44).
    - À chaque nouveau cas: remplacer `timeLeft = 150` → `timeLeft = getTimeLimit()` (c:\Users\Louaï\Desktop\medgame-main\js\game.js:238).
  - Éviter le double démarrage du minuteur:
    - Garder le démarrage dans `loadCase()` et supprimer l’appel redondant dans `initializeGame()` (lignes c:\Users\Louaï\Desktop\medgame-main\js\game.js:555–556).

## Stockage et défauts
- Clés: `timeMode` ∈ {`dur`,`normal`,`facile`} et `timeLimitSeconds` ∈ {150, 240, 480}.
- Défaut si aucune valeur: `normal` → 240 s (4:00), pour un équilibre.

## Vérification
- Depuis `index.html`, ouvrir Paramètres et choisir chaque mode; vérifier que `sessionStorage` contient la clé attendue.
- Aller sur `themes.html` puis `game.html`; le timer affiche 2:30 / 4:00 / 8:00 selon le choix.
- Passer au cas suivant; le timer se réinitialise à la même valeur.
- Échéance du temps et validation de diagnostic restent inchangées.

Souhaitez-vous que je applique ce plan maintenant ?