## Objectif
Refondre `game.html` pour un layout professionnel, centré sur la simulation clinique: dossier patient + actions médicales, avec un mode "Bureau" et un mode "Lit du patient" cohérents, accessibles et responsives, sans changer la logique métier existante.

## Principes de conception
- Structure sémantique (`header`, `main`, `aside`, `section`) et ARIA claire.
- Conserver les `id` et `data-*` utilisés par `js/game.js` pour limiter l’impact côté JS.
- Responsive et lisible: grille 3 colonnes (dossier / patient / décisions), bascule vers 1–2 colonnes sur mobile.
- Éléments dynamiques isolés: diagnostics, traitements, examens, timer, correction.
- Accessibilité: `aria-pressed`, `role` pour boutons et listes; focus management.
- Performance/UX: pas d’`alert` bloquant côté UI; modaux et toasts; scripts en `defer`.

## Nouveau layout (structure cible)
```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cas Clinique</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/game.css">
  <link rel="preload" href="assets/sounds/urgency.mp3" as="audio">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
</head>
<body>
  <header class="app-header">
    <h1>Cas Clinique</h1>
    <div class="mode-switch" role="tablist">
      <button id="mode-bureau" class="mode-btn" aria-pressed="true">Bureau</button>
      <button id="mode-lit" class="mode-btn" aria-pressed="false">Lit du patient</button>
    </div>
  </header>

  <main id="workspace" class="workspace">
    <aside id="left-panel" class="left-panel">
      <section class="obis-window">
        <div class="obis-titlebar">Dossier Patient</div>
        <div class="obis-content">
          <!-- Informations Patient, Mode de vie, Antécédents, Histoire, Examen Clinique -->
          <!-- Conserver les id existants: patient-*, motif-hospitalisation, activite-physique, etc. -->
        </div>
      </section>

      <section id="examens" class="medical-card2">
        <h2 class="section-title"><i class="fas fa-stethoscope"></i> Examens complémentaires</h2>
        <div class="exam-categories"></div>
        <button id="validate-exams" class="validate-btn">Demander les examens sélectionnés</button>
        <div id="examens-results" class="exam-results"></div>
      </section>
    </aside>

    <section id="patient-stage" class="patient-stage" aria-label="Patient">
      <svg id="patient-svg" viewBox="0 0 200 400" xmlns="http://www.w3.org/2000/svg">
        <rect x="80" y="20" width="40" height="40" data-region="tete" />
        <rect x="60" y="60" width="80" height="100" data-region="thorax" />
        <rect x="60" y="160" width="80" height="80" data-region="abdomen" />
        <rect x="40" y="60" width="20" height="120" data-region="bras-gauche" />
        <rect x="140" y="60" width="20" height="120" data-region="bras-droit" />
        <rect x="70" y="240" width="25" height="120" data-region="jambe-gauche" />
        <rect x="105" y="240" width="25" height="120" data-region="jambe-droit" />
      </svg>
      <div id="exam-context-menu" class="exam-context-menu" hidden></div>
    </section>

    <aside id="decision-panel" class="decision-panel">
      <section class="obis-window">
        <div class="obis-titlebar">Décisions</div>
        <div class="obis-content">
          <div class="medical-card" id="diagnostic">
            <h2 class="section-title"><i class="fas fa-diagnoses"></i> Diagnostic</h2>
            <select id="diagnostic-select"><option value="">Sélectionnez un diagnostic</option></select>
            <button id="validate-diagnostic" class="validate-btn">Valider</button>
            <p id="score"></p>
            <p id="feedback"></p>
            <p id="correctDiagnostic"></p>

            <h2 class="section-title"><i class="fas fa-prescription"></i> Prescription</h2>
            <div id="availableTreatments"></div>
            <button id="validate-traitement" class="validate-btn">Valider</button>
            <p id="treatment-feedback"></p>
          </div>
        </div>
      </section>
    </aside>
  </main>

  <footer class="app-footer">
    <div id="timer" class="timer"></div>
    <div class="footer-actions">
      <a href="index.html" class="back-link-bottom">Retour</a>
      <button id="next-case">Cas Suivant</button>
    </div>
  </footer>

  <audio id="bg-audio" src="assets/sounds/urgency.mp3" loop hidden></audio>
  <div id="fireworks-container"></div>

  <div id="correction-overlay" class="correction-overlay" hidden>
    <div id="correction-modal" class="correction-modal">
      <h2 class="correction-title">Correction du cas</h2>
      <div id="correction-content"></div>
      <button id="toggle-case-review">Revoir le cas</button>
      <div id="case-review" class="case-review"></div>
      <div class="correction-actions">
        <button id="correction-back">Retour</button>
        <button id="correction-next">Suivant</button>
      </div>
    </div>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.9.1/gsap.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/fireworks-js@latest/dist/fireworks.js" defer></script>
  <script src="js/game.js" defer></script>
</body>
</html>
```

## Impacts JS minimisés
- Tous les `id` référencés par `js/game.js` sont conservés: `diagnostic-select`, `validate-exams`, `examens-results`, `mode-bureau`, `mode-lit`, `exam-context-menu`, `patient-stage`, `availableTreatments`, etc.
- `setupWorkspaceModes()` et `setupPatientContextMenu()` continuent de fonctionner (structure des conteneurs inchangée, seulement réorganisée).
- `loadCase()` garde les zones de rendu: examens, traitements, diagnostic, résultats.

## Améliorations UX/UI spécifiques
- Titres normalisés: "Dossier Patient" et "Décisions" au lieu de la répétition d’OBIS.
- Boutons de validation uniformisés via `validate-btn`.
- Timer mis en avant et lisible, actions de navigation en pied.
- Le menu contextuel d’examens (clic droit) fonctionne uniquement en mode Lit, avec filtrage des examens réellement disponibles.
- Correction overlay masqué par défaut via `hidden` et géré par JS.
- Audio préparé mais non auto-lancé; le code existant le contrôle déjà.

## Accessibilité et sémantique
- Sections nommées, rôles sur switch de mode, attributs `aria-pressed` conservés.
- `aria-label` pour la scène patient.
- Navigation via clavier sur boutons et menu contextuel.

## Performance et intégration
- Scripts en `defer` pour un chargement non bloquant.
- `preload` pour l’audio d’urgence.
- Pas d’images lourdes par défaut; la photo patient garde `assets/images/default-patient.jpg` si nécessaire.

## CSS et responsivité
- Réutiliser `css/style.css` et `css/game.css` existants.
- Ajouter une grille à `workspace`: 3 colonnes sur desktop, bascule à 1–2 colonnes sur mobile.
- Harmoniser `.medical-card`, `.obis-window`, `.exam-buttons`, `.validate-btn`.

## Étapes de mise en œuvre
1. Remplacer le markup de `game.html` par la structure ci-dessus en conservant tous les `id` requis.
2. Adapter légèrement `css/game.css` pour la grille (classes `workspace`, `left-panel`, `patient-stage`, `decision-panel`, `app-header`, `app-footer`).
3. Vérifier la continuité des interactions dans `js/game.js` (aucun changement attendu grâce aux `id` conservés).
4. Tests manuels: bascule Bureau/Lit, menu contextuel exams, sélections examens/traitements, validation, timer, correction.
5. Ajustements visuels si nécessaire (espacements, titres, icônes).

## Critères d’acceptation
- La page ressemble à un véritable jeu/simulateur médical: dossier patient clair, zone patient, panneau de décisions.
- Fonctionnalités existantes intactes: chargement des cas, examens, diagnostics, prescriptions, scoring, correction.
- Responsive, propre, sans éléments redondants ni styles en ligne.

Souhaitez-vous que j’applique cette refonte maintenant ?