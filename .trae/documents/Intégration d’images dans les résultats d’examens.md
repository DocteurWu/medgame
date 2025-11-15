## Objectif
- Autoriser un chemin d’image dans les résultats d’examens des fichiers JSON et afficher cette image dans une pop‑up large à la demande.
- Ouverture/fermeture illimitées, sans perturber le flux du jeu.

## Schéma JSON
- Élargir `examResults` pour accepter un objet au lieu d’une simple chaîne:
  - `{ text: string, image?: string }`
- Exemple:
  - "examResults": { "Radio thorax": { "text": "Infiltrat basal droit", "image": "assets/images/radio_thorax_001.jpg" } }
- Compatibilité: si la valeur est une chaîne, le comportement actuel est conservé.

## Parcours de rendu existant
- Chargement des cas: `js/game.js:186-233` (`loadCasesData`) puis `initializeGame` `js/game.js:700-708`.
- Sélection et rendu des examens:
  - Génération des boutons: `js/game.js:449-509`.
  - Validation et rendu des résultats dans `#examens-results`: `js/game.js:623-669`.
- Modale existante de correction (référence technique): `game.html:188-199`, logique `js/game.js:60-116`.

## Pop‑up Image (HTML)
- Ajouter dans `game.html` une modale dédiée, proche de la modale de correction:
  - Overlay: `#image-overlay` (plein écran, caché par défaut).
  - Contenu: `#image-modal` avec un `<img id="image-modal-img">`, un titre `#image-modal-caption` et un bouton de fermeture `#image-modal-close`.
- Emplacement: sous les autres sections, à la fin du body pour rester simple.

## Styles (CSS)
- Dans `css/game.css`, ajouter:
  - Styles overlay (position fixe, fond semi‑opaque, z-index au-dessus du jeu).
  - Conteneur modal centré, largeur max ~90% viewport, hauteur max ~90%.
  - Image responsive (object-fit: contain; max-width/height 100%).
  - Bouton fermer accessible (taille, contrastes).

## Logique JS
- Dans `js/game.js`:
  - Créer `showImageModal(src, alt?)` et `hideImageModal()` près de `showCorrectionModal`/`hideCorrectionModal` (`js/game.js:107-116`).
  - Écouter: clic sur `#image-overlay` et `#image-modal-close`; touche `Escape` pour fermer.
  - Dans la validation des examens (`js/game.js:623-669`), lors du rendu de chaque item:
    - Si `result` est `{ text, image }`: afficher `text` comme aujourd’hui et ajouter un bouton "Voir l’image".
    - Au clic, appeler `showImageModal(result.image, 'Résultat: ' + examName)`.
  - Conserver le rendu existant pour les résultats simples (chaînes).

## Ouverture/Fermeture multiples
- `showImageModal` met à jour la `src` et ré‑affiche l’overlay; `hideImageModal` nettoie/masque.
- Aucune restriction de nombre d’ouvertures/fermetures.

## Compatibilité et robustesse
- Tolérer `image` manquant: le bouton n’est pas affiché.
- Tolérer chemins relatifs/absolus; afficher message d’erreur discret si l’image échoue à se charger.
- Ne pas affecter la modale de correction ni le timer.

## Validation
- Ajouter une image d’exemple dans `assets/images/...` et modifier un cas JSON pour inclure `{ text, image }`.
- Vérifier:
  - Rendu texte inchangé pour chaînes.
  - Bouton "Voir l’image" présent pour objets avec `image` et ouvre la pop‑up.
  - Pop‑up se ferme par bouton, clic hors contenu, et `Escape`.
  - Réouvertures successives fonctionnent sans fuite d’état.

Confirmez que ce schéma (`text` + `image`) vous convient; je implémenterai ensuite les modifications correspondantes dans `game.html`, `css/game.css` et `js/game.js`. 