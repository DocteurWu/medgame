# Documentation Complète du Projet MedGame

Ce document détaille l'architecture, le fonctionnement interne et la structure des données du jeu de simulation médicale MedGame. Il est destiné aux développeurs souhaitant comprendre, maintenir ou enrichir le projet.

## 1. Vue d'ensemble du Projet

MedGame est une application web statique conçue pour simuler des cas cliniques médicaux. L'utilisateur incarne un professionnel de santé qui doit, à travers l'anamnèse, l'examen clinique et des examens complémentaires, poser un diagnostic et proposer une prise en charge thérapeutique.

Le jeu se déroule en plusieurs étapes :
1.  **Accueil** : Choix du niveau de difficulté (temps imparti).
2.  **Choix des Thèmes** : Sélection des spécialités médicales (ex: Cardiologie, Endocrinologie).
3.  **Jeu** : Simulation d'un cas clinique tiré au hasard parmi les thèmes choisis.
4.  **Correction** : Après soumission, une correction détaillée est fournie avec un score.

## 2. Structure des Fichiers
... (Identique à la version précédente) ...

## 3. Déroulement du Jeu (Flux de Données)
... (Identique à la version précédente) ...

## 4. Analyse des Composants Clés
... (Identique à la version précédente) ...

## 5. Structure des Données
... (Identique à la version précédente) ...

## 6. Guide du Contributeur : Ajouter un Nouveau Cas
... (Identique à la version précédente) ...

---

## 7. Analyse Technique Détaillée ("Dev Mode")

Cette section plonge dans les détails d'implémentation du code pour une compréhension approfondie.

### a. Initialisation et Gestion d'État (State Management)

Le jeu utilise deux types de stockage web pour des raisons différentes :

*   **`sessionStorage`** :
    *   **Clé :** `timeLimitSeconds`
    *   **Utilisation :** Stocke le temps alloué pour un cas, défini sur `index.html`.
    *   **Raison :** `sessionStorage` est idéal ici car la limite de temps est une configuration propre à une session de jeu. Si l'utilisateur ferme l'onglet, la session est terminée et le réglage est oublié, ce qui est le comportement souhaité.

*   **`localStorage`** :
    *   **Clé :** `selectedThemes`
    *   **Utilisation :** Stocke les thèmes que l'utilisateur a choisis sur `themes.html`.
    *   **Raison :** `localStorage` persiste même après la fermeture du navigateur. Cela permettrait potentiellement de se souvenir des préférences de l'utilisateur sur le long terme, bien que l'application actuelle ne fasse que lire cette valeur au démarrage d'une partie.

*   **Cookies** :
    *   **Clé :** `playedCases`
    *   **Utilisation :** Stocke une liste d'IDs de cas déjà joués.
    *   **Raison :** Permet d'éviter la répétition des cas sur plusieurs sessions de jeu, offrant une meilleure expérience utilisateur. Le cookie a une longue durée de vie (`COOKIE_EXPIRY_DAYS = 365`).

### b. Séquence de Démarrage Détaillée (`js/game.js`)

L'orchestration du démarrage est entièrement gérée par l'événement `DOMContentLoaded`.

1.  **Point d'entrée** : `async () => { ... }` est le wrapper principal. L'utilisation de `async` est cruciale car le chargement des données est asynchrone.

2.  **Appel Initial** : `initializeGame()` est la première fonction appelée.

3.  **`initializeGame()`** :
    *   Marquée `async`, elle attend (`await`) le résultat de `loadCasesData()`.
    *   `cases = await loadCasesData();` : Le tableau `cases` contiendra la totalité des objets de cas cliniques correspondant aux thèmes choisis.
    *   Si le chargement réussit et que des cas sont disponibles (`cases.length > 0`), elle appelle `loadCase()` pour afficher le premier cas.

4.  **`loadCasesData()`** (Fonction la plus critique du démarrage) :
    *   Récupère les thèmes depuis `localStorage`.
    *   Effectue un `fetch` sur `data/case-index.json`. C'est la première requête réseau.
    *   Filtre les noms de fichiers `.json` de l'index qui correspondent aux thèmes sélectionnés.
    *   **Parallélisation** : Le point le plus performant est ici :
        ```javascript
        const casesPromises = caseFiles.map(file =>
            fetch(`data/${file}`).then(res => res.json())
        );
        const cases = await Promise.all(casesPromises);
        ```
        `Promise.all` déclenche **toutes les requêtes `fetch` pour les fichiers de cas en parallèle**. Le jeu n'attend pas que chaque fichier soit téléchargé l'un après l'autre, ce qui réduit considérablement le temps de chargement initial.

5.  **`loadCase()`** (Préparation de l'interface) :
    *   Filtre les cas déjà joués en lisant le cookie `playedCases`.
    *   Sélectionne un cas aléatoire parmi les cas disponibles.
    *   Réinitialise l'état du jeu (variables `selectedTreatments`, `score`, `attempts`).
    *   Peuple l'intégralité du DOM avec les données du `currentCase`. Chaque `document.getElementById(...)` est mis à jour.
    *   Génère dynamiquement les boutons pour les examens (`availableExams`) et les traitements (`possibleTreatments`).
    *   **Point de synchronisation crucial** : Appelle `NurseIntro.show()`. Le minuteur du jeu **n'est pas encore démarré**. La fonction `setInterval(updateTimer, 1000)` est passée en **callback** à `NurseIntro.show()`. Elle ne sera exécutée que lorsque l'utilisateur fermera la modale de l'infirmière, s'assurant que le temps ne défile pas avant que l'utilisateur soit prêt.

### c. La Classe `VitalSignsMonitor` (Plongée en Profondeur)

Cette classe est un composant de rendu autonome qui simule un moniteur de constantes vitales.

*   **`constructor(props, layout)`** :
    *   Il stocke les valeurs initiales des constantes (`props`) dans `this.baseValues`.
    *   Il appelle `calculateVariationRanges()` qui pré-calcule un intervalle de `min` et `max` (valeur de base ± 2.5%) pour chaque constante. Cette optimisation évite de recalculer ces bornes à chaque mise à jour.

*   **Simulation "Live"** :
    *   `startVitalUpdates()` lance un `setInterval` qui s'exécute toutes les 3 à 5 secondes (avec un délai aléatoire pour un effet plus naturel).
    *   À chaque intervalle, `updateVitalsValues()` est appelée. Cette fonction utilise `generateRandomValue()` pour choisir une nouvelle valeur entière pour chaque constante à l'intérieur des `variationRanges` pré-calculés. Cela donne l'illusion que le patient est "vivant" et que ses constantes fluctuent légèrement.

*   **Génération des Ondes SVG (Le cœur visuel)** :
    *   **ECG (`generateECGPath(amp)`)** : Cette fonction n'est pas une simulation physiologique mais une **génération procédurale d'un tracé SVG**. Elle construit une chaîne de caractères qui représente les commandes d'un SVG `<path>`. La forme est une approximation d'un complexe P-QRS-T, créée mathématiquement avec des segments de ligne (`L`) et des courbes de Bézier quadratiques (`Q`).
        *   L'amplitude (`amp`) et la vitesse de défilement (`--ecg-speed`) sont liées à la fréquence cardiaque pour le réalisme : un pouls élevé rendra l'onde plus haute et plus rapide.
    *   **SpO2 (`initAnimatedWaves`)** : Le tracé de la SpO2 est plus simple, généré comme une simple onde sinusoïdale.
    *   **Animation CSS** : Le défilement continu des ondes est purement visuel et géré par CSS. Le JavaScript ne fait que générer le tracé statique. C'est la propriété `animation: ecg-scroll var(--ecg-speed) linear infinite;` qui fait bouger le tracé. Le JS met à jour la variable CSS `--ecg-speed` pour contrôler la vitesse, ce qui est une technique moderne et performante.

### d. Logique de Validation et de Score (`validate-traitement`)

C'est l'unique point de validation final du cas.

*   **Calcul du Score en Pourcentage** : L'ancien système de pénalité par essai (`attemptPenalty`) n'est plus utilisé pour le score final. Le calcul est le suivant :
    1.  Un poids de 50% est alloué au diagnostic (`diagnosticWeight`).
    2.  Un poids de 50% est alloué aux traitements (`treatmentWeight`).
    3.  Si le diagnostic est correct, le score gagne 50 points.
    4.  Pour les traitements, chaque traitement correct vaut `50 / nombre total de traitements corrects`. Le score augmente pour chaque traitement correct que l'utilisateur a sélectionné.
    5.  **Important** : Le code actuel **ne pénalise pas** la sélection de traitements incorrects (la ligne de code pour la pénalité est commentée). Seuls les bons choix rapportent des points.
    6.  Le score final est un pourcentage arrondi, borné entre 0 et 100.

*   **Génération de la Correction HTML** : La modale de correction est construite dynamiquement. Le script génère une chaîne de caractères HTML (`comparisonHtml`) en parcourant les réponses de l'utilisateur et les réponses correctes. Il applique des couleurs de fond `rgba(...)` directement en `style` inline pour indiquer ce qui était correct (vert), incorrect (rouge) ou manquant (jaune), offrant un retour visuel immédiat et détaillé.

### e. Fonctions Utilitaires et Constantes Notables

*   **Constantes** : Situées en haut de `js/game.js`, elles permettent de configurer facilement le jeu.
    *   `EXAM_ANALYSIS_DELAY = 1.5`: Simule le temps d'attente pour un résultat d'examen en utilisant `setTimeout`, ce qui rend l'expérience plus immersive.
    *   `GSAP_*`: Constantes pour la bibliothèque d'animation `gsap`, utilisées pour faire apparaître les "cartes médicales" de manière fluide (`gsap.from(".medical-card", ...)`).
*   **`escapeHtml(str)`** : Fonction de sécurité essentielle. Elle empêche les injections de code (XSS) en s'assurant que toute donnée venant d'un fichier JSON et insérée dans le DOM est traitée comme du simple texte et non comme du HTML interprétable.
*   **`renderCorrectionContent(text)`** : Agit comme un micro-interpréteur. Si le champ `correction` du JSON contient du HTML, il l'insère directement. S'il contient du texte brut, il le transforme en HTML valide en convertissant les sauts de ligne en `<br>` ou `<p>` et les lignes commençant par `-` en listes à puces `<ul><li>...</li></ul>`.
*   **`parseBP(text)`** et **`parseNum(text)`** : Fonctions de nettoyage de données robustes. Elles utilisent des expressions régulières (`.match()`) pour extraire des valeurs numériques de chaînes de caractères formatées (ex: "135/85 mmHg" devient `{systolic: 135, diastolic: 85}`). Cela permet aux auteurs de cas de rédiger les constantes de manière lisible pour un humain.