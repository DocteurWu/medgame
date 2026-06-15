# Guide de Contribution à Medgame 🚀

Merci de l'intérêt que vous portez à **Medgame** ! Ce projet a pour but de rendre l'apprentissage de la sémiologie médicale interactif, immersif et accessible à tous les étudiants (DFGSM2, DFGSM3 et au-delà).

Pour que la collaboration se déroule au mieux à 3, 4 ou plus, voici les lignes directrices à suivre.

---

## 💡 Vision et Objectifs

Medgame est une plateforme éducative qui simule des scénarios cliniques. Le joueur (externe, interne) doit mener l'anamnèse, réaliser l'examen physique, prescrire des examens complémentaires et poser le bon diagnostic tout en gérant les ressources (XP, temps, etc.).

Nous recherchons des personnes passionnées pour :
*   **Médecine & Game Design** : Rédiger de nouveaux cas cliniques réalistes, drôles et stimulants.
*   **Développement Web** : Optimiser l'interface (Design Verre/Néon, fluidité, GSAP), ajouter de nouvelles fonctionnalités.
*   **Graphisme & UI** : Améliorer l'esthétique générale de l'application.

---

## 🛠️ Stack Technique

Le projet se veut extrêmement léger et accessible :
*   **Frontend** : HTML5, Vanilla CSS3, Vanilla Javascript (ES6+, pas de framework comme React/Vue/Next par défaut pour les pages de jeu standard afin de garder le projet simple à lancer).
*   **Animations** : GSAP.
*   **Backend** : Supabase (PostgreSQL, Auth, RLS).

---

## 📝 Comment contribuer ?

### 1. Proposer un Cas Clinique 🏥
C'est la contribution la plus précieuse !
*   Vous pouvez utiliser l'**Éditeur de cas intégré** (`editor.html`) accessible directement dans l'application pour concevoir vos scénarios.
*   Les cas sont sauvegardés sous forme de fichiers JSON dans le dossier `data/` et indexés dans `data/case-index.json`.
*   Nommez vos fichiers de cas selon la convention : `{SPÉCIALITÉ}_{pathologie}_{patient}.json` (ex: `CARDIO_angor_stable_patient1.json`).

### 2. Contribuer au Code ou au Design 💻
1.  **Forkez** le dépôt et clonez-le en local.
2.  Créez une branche descriptive : `git checkout -b feature/nom-de-la-feature` ou `git checkout -b fix/nom-du-bug`.
3.  Faites vos modifications en respectant le style existant (Vanilla JS, CSS soigné).
4.  Testez vos modifications localement (`npx http-server -p 8888` ou `python -m http.server`).
5.  Soumettez une **Pull Request (PR)** détaillée.

---

## ⚖️ Contrat de Contribution (CLA) et Licence

### La Licence du Projet
Le code de Medgame est sous licence **GNU GPLv3**. Cela garantit que le projet reste Open Source : quiconque modifie le code doit redistribuer ses modifications sous la même licence GPLv3.

### Propriété Intellectuelle et Usage Commercial (CLA)
En soumettant une contribution (Pull Request) à ce projet, vous acceptez les termes suivants :
1.  **Licence des contributions** : Vous acceptez que vos contributions soient intégrées au projet et distribuées sous la licence GPLv3.
2.  **Droits d'exploitation commerciale** : Vous accordez au propriétaire historique du projet (DocteurWu / Louaï Hamlat, hamlat.louai@gmail.com) une licence perpétuelle, libre de redevances, irrévocable et mondiale pour utiliser, copier, modifier, distribuer et concéder sous double licence (y compris commerciale) vos contributions.
3.  **Pourquoi ce choix ?** : Cela permet de protéger le projet tout en gardant la possibilité de créer une structure commerciale ou de proposer des versions dédiées à des institutions (facultés de médecine, hôpitaux) sans blocage juridique, tout en garantissant que la version communautaire reste libre sous GPLv3. Si des revenus significatifs sont générés à l'avenir, la redistribution sera gérée de manière transparente via la structure ou l'entreprise créée.

---

## 💬 Nous Contacter
Pour discuter d'idées de cas, de fonctionnalités ou rejoindre l'équipe activement, n'hésitez pas à :
*   Ouvrir une **Issue** sur GitHub.
*   Contacter le mainteneur par email : **hamlat.louai@gmail.com** ou soutenir le projet via [Revolut](https://revolut.me/louai2405).

Merci encore pour votre aide dans l'amélioration de l'éducation médicale ! 🩺
