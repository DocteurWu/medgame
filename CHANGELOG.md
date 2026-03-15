# 🦀 CHANGELOG Medgame — Session 15/03/2026

## Dernière baseline : commit `83e703f` (14/03 23h)

## Changements depuis la baseline

### 🧹 Cleanup (commit `5bc2bad`)
- ~27 `console.log` de debug supprimés (14 fichiers)
- Code mort nettoyé (commentaires "REMOVED")
- JSDoc ajouté sur fonctions publiques (utils.js, ui.js, lockSystem.js, caseLoader.js, scoring.js)

### 🔒 Sécurité XSS (commits `c73c1e1`, `44de2f3`)
- `escapeHtml()` ajouté sur : antécédents médicaux/chirurgicaux/familiaux, verbatim patient, résultats d'examens, `displayQuestionBtn` avec `isHtml=true`
- `safeSetInnerHTML()` ajouté dans utils.js
- Cookies sécurisés : `encodeURIComponent` + `SameSite=Lax`

### ⚡ Performance (commit `c73c1e1`)
- `Promise.all` → `Promise.allSettled` dans `loadCasesData()` (plus de crash si un cas échoue)
- Spinner Font Awesome pendant chargement des cas

### 🎮 Immersivité (commit `7f85930`)
- Animations CSS : transitions fade, boutons hover/click, score popups
- Feedback visuel correct/incorrect
- Timer warning states
- Card hover effects
- Hook audio (Web Audio API) dans `js/audio.js` pour futurs effets sonores

### ⌨️ BUG FIX — Raccourcis clavier (à tester !)
- **Bug** : les raccourcis clavier et confirmation quitter ne marchaient pas
- **Cause** : `game.js` chargé en bas de `game.html`, le `DOMContentLoaded` ne se déclenchait plus
- **Fix** : wrapper `onDomReady()` qui exécute immédiatement si le DOM est prêt
- **📍 À TESTER** :
  - [ ] Appuyer sur `1` ou `Enter` → valider traitement
  - [ ] Appuyer sur `2` → valider examens
  - [ ] Appuyer sur `3` → aller à la synthèse
  - [ ] Appuyer sur `Escape` → fermer la correction
  - [ ] Cliquer sur quitter → confirmation "Quitter la partie ?" apparait

## 🧪 Plan de test
1. Aller sur `game.html` → lancer un cas clinique
2. Tester chaque raccourci clavier (1, 2, 3, Escape, Enter)
3. Tester le bouton quitter → confirmation obligatoire
4. Vérifier que les examens/traitements n'ont pas de HTML visible (XSS fix)
5. Vérifier le spinner de chargement entre les cas
6. Vérifier les animations sur les boutons de réponse

## ⚠️ Known issues
- Le hook audio est prêt mais aucun son n'est encore implémenté
- Responsive mobile pas encore testé après les changements
