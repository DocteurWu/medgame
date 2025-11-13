## Mise à jour de la spécification

* Le champ `correction` des cas sera une chaîne de caractères.

* HTML autorisé dans la chaîne (titres, listes, paragraphes). À défaut, texte brut avec sauts de ligne (`\n`).

## Modèle JSON

* Exemple pour `data/cardio_1.json` :

```
"correction": "<h3>Insuffisance cardiaque</h3>\n<p>Dyspnée, œdèmes, crépitants et FE réduite orientent vers IC.</p>\n<h4>Bonnes pratiques</h4>\n<ul><li>Évaluer FE à l’échographie</li><li>Initier diurétiques et IEC</li><li>Surveiller poids, diurèse, ionogramme</li></ul>\n<h4>Erreurs à éviter</h4>\n<ul><li>Oublier adaptation des doses</li><li>Négliger cause ischémique</li></ul>"
```

* Compatibilité avec `data/JSON a copier.json` (déjà au format chaîne HTML).

## Pop‑up de correction (UI/UX)

* Marquage à ajouter dans `game.html` :

  * `#correction-overlay` et `#correction-modal` avec un conteneur `#correction-content` qui rend la chaîne `correction`.

  * Boutons : `Retour`, `Suivant`, `Revoir le cas`.

* Styles à ajouter dans `css/game.css` : overlay fixe, modal centré, titres et listes cohérents avec le design actuel.

## Rendu de la chaîne (JS)

* Fonction `renderCorrectionContent(text)` dans `js/game.js` :

  * Si la chaîne contient du HTML (détection simple `/<[a-z][\s\S]*>/i/`), insérer tel quel.

  * Sinon, transformer les sauts de ligne en paragraphe/`<br>` :

    * Double saut de ligne → nouveau paragraphe.

    * Lignes commençant par `- ` → liste à puces.

* `renderCorrectionModal(correctionText, currentCase)` remplit le modal et gère les boutons.

## Points d’intégration

* Succès du cas : dans le gestionnaire de `validate-traitement` (réf. `js/game.js:318–399`). Afficher la pop‑up au lieu de passer automatiquement au cas suivant.

* Fin de temps : dans `updateTimer` (réf. `js/game.js:54–63`), ouvrir la pop‑up de correction.

## Navigation et révision du cas

* `Retour`: ferme la pop‑up, laisse le cas affiché.

* `Suivant`: appelle `loadCase()` et relance la musique de fond; cookie `playedCases` conservé.

* `Revoir le cas`: panneau interne au modal avec les infos clés du cas (patient, interrogatoire, examens/résultats).

## Validation

* Vérifier cas HTML (existant) et cas texte brut (nouveau) pour la mise en forme automatique.

* Tests manuels: succès, fin de temps, responsive, boutons.

## Étapes d’implémentation

1. Ajouter le markup du modal dans `game.html`.
2. Ajouter les styles dans `css/game.css`.
3. Implémenter `renderCorrectionContent()` et `renderCorrectionModal()` dans `js/game.js`.
4. Intégrer l’ouverture du modal au succès et à la fin de temps.
5. Ajouter `correction` aux cas pilotes; étendre progressivement aux autres cas.
