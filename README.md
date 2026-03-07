# 🎮 Medgame

Medgame est une plateforme éducative interactive simulant des scénarios médicaux pour tester les connaissances cliniques 🏥. Initialement conçu pour le DFGSM2/DFGSM3, c'est un outil open-source évolutif permettant de transformer l'apprentissage de la sémiologie en une expérience immersive.

---

## 🚀 Fonctionnalités Principales

*   **Cas Cliniques Immersifs** : Scénarios détaillés avec anamnèse interactive, examens physiques et complémentaires.
*   **Système de "Gating" (Verrous)** : Progression conditionnée par la résolution de défis sémiologiques.
*   **Éditeur de Cas Intégré** : Créez et soumettez vos propres cas cliniques directement depuis l'interface.
*   **Gestion de Progression (Supabase)** : Sauvegarde de l'historique, calcul du score (0-100%) et gain d'XP.
*   **Mode Urgence** : Scénarios chronométrés pour simuler la pression des soins critiques.

---

## 🛠 Stack Technique

*   **Frontend** : HTML5, Vanilla CSS3 (Design Verre/Néon), Vanilla JS (ES6+).
*   **Backend & Auth** : [Supabase](https://supabase.com/) (PostgreSQL, Auth, RLS).
*   **Animation** : GSAP pour les effets visuels et les moniteurs de constantes.
*   **Déploiement** : Docker (Nginx Alpine) optimisé pour l'architecture x86 et ARM64 (Orange Pi/Raspberry Pi).

---

## 📈 Roadmap & Système de Niveaux

Le projet évolue vers un système communautaire basé sur le mérite :

*   **Niveau 1 (Externe)** : Accès standard aux cas publiés.
*   **Niveau 2** : Statistiques avancées et badges de spécialité.
*   **Niveau 3 (Interne - 1500 XP)** : **Déblocage de l'Éditeur** pour proposer et éditer des cas.
*   **Niveau 5 (Professeur)** : Pouvoir de validation (Reviewer) sur les cas soumis par la communauté.

---

## 🔧 Installation & Déploiement

### 1. Installation Locale (Développement)
```bash
# Cloner le dépôt
git clone https://github.com/DocteurWu/medgame.git
cd medgame-main

# Lancer un serveur local (ex: port 8888)
npx http-server -p 8888
```

### 2. Déploiement Docker (Auto-hébergement)
Idéal pour un Orange Pi ou un serveur domestique :
```bash
docker build -t medgame .
docker run -d -p 8888:8888 medgame
```

---

## 🔐 Sécurité & RLS

Pour protéger la base de données, le **Row Level Security (RLS)** doit être activé sur Supabase. 
*   Les cas `published` sont visibles par tous.
*   Les cas `pending` ne sont visibles que par l'auteur et les administrateurs.
*   La modification des profils est restreinte à l'utilisateur connecté.

---

## 🤝 Contributions

Le projet est open-source 🚀 ! Tout le monde peut :

*   Améliorer le code 💻 (rendre l'interface plus esthétique, ajouter des fonctionnalités ...)
*   Corriger des bugs 🛠
*   Ajouter de nouveaux cas médicaux 📑 (toute la sémio est la bienvenue)

Si tu veux contribuer, fais une pull request et je regarderai ça avec plaisir 😃 !

## 📄 Licence

🔹 **Code** → GPLv3

Medgame est distribué sous licence GNU General Public License v3.0. Cela signifie que vous pouvez utiliser, étudier, partager et modifier le logiciel librement, à condition de distribuer les modifications sous la même licence.

## 💝 Support

Si tu aimes le jeu, tu peux soutenir le projet en faisant un petit don ici : https://revolut.me/louai2405

MERCI BEAUCOUP POUR TON SOUTIEN ! 💖