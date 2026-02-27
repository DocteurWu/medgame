# 🏥 Documentation Intégration Supabase - MedGame

Cette documentation explique comment Supabase a été intégré au projet MedGame pour transformer un jeu statique en une plateforme dynamique avec comptes utilisateurs et sauvegarde de progression.

---

## 🚀 1. Qu'est-ce que Supabase ?
Supabase est une alternative "Backend-as-a-Service" à Firebase. Pour MedGame, il gère trois piliers essentiels :
1.  **Authentification** : Inscription et connexion des utilisateurs (Email/MDP).
2.  **Base de données (PostgreSQL)** : Stockage des cas cliniques, des profils et des scores.
3.  **Sécurité (RLS)** : Garantie que chaque utilisateur ne peut modifier que ses propres données.

---

## 🛠 2. Structure de la Base de Données

Nous utilisons trois tables principales :

### Table `cases` (Les Cas Cliniques)
*   **Rôle** : Remplace les anciens fichiers JSON locaux.
*   **Colonnes clés** : `id` (ex: cardio_aomi), `title`, `specialty`, `content` (le JSON complet du cas).

### Table `profiles` (Les Utilisateurs)
*   **Rôle** : Stocke les statistiques globales de chaque joueur.
*   **Colonnes clés** : `id` (lié au compte Auth), `username`, `total_xp`, `rank` (Externe, Interne, etc.).

### Table `play_sessions` (L'Historique)
*   **Rôle** : Enregistre chaque partie terminée.
*   **Colonnes clés** : `user_id`, `case_id`, `score` (0-100), `stats` (détails des erreurs).

---

## 🔐 3. Configuration et Sécurité

### Les Clés API (`js/config.js`)
*   **URL** : L'adresse de ton projet Supabase.
*   **Clé ANON (Public)** : Celle utilisée dans le code. Elle est "publique" mais limitée par les règles de sécurité (RLS).
*   **Clé SECRET (Service Role)** : **NE JAMAIS mettre dans le navigateur**. Elle a été utilisée uniquement pour la migration initiale des données.

### Règles RLS (Row Level Security)
C'est le "garde du corps" de ta base de données.
*   *Exemple* : On a configuré une règle qui dit : `auth.uid() = id`. Cela signifie que si je suis connecté en tant que "Louai", la base de données refusera toute tentative de modifier le profil de "Jean".

---

## 💻 4. Comment le code interagit avec Supabase

### Initialisation (`js/config.js`)
Le client est initialisé globalement une seule fois :
```javascript
window.supabase = createClient(URL, ANON_KEY);
```

### Protection des pages (`js/auth.js`)
Chaque page sensible (`game.html`, `editor.html`) commence par appeler :
```javascript
await window.requireAuth(); 
// Si non connecté -> redirection automatique vers login.html
```

### Sauvegarde du Score (`js/game.js`)
À la fin d'un cas, le jeu envoie les données :
```javascript
await supabase.from('play_sessions').insert([{ user_id, case_id, score }]);
```

---

## 📝 5. FAQ pour les nouveaux développeurs

*   **Où sont les cas ?** Ils ne sont plus dans `/data/` (sauf fallback), mais dans l'onglet **Table Editor** de Supabase.
*   **Comment ajouter un administrateur ?** Actuellement, tout utilisateur connecté peut accéder à l'éditeur. Pour restreindre, il faudra ajouter une colonne `role` dans la table `profiles`.
*   **Comment voir les joueurs ?** Va dans l'onglet **Authentication** pour voir les emails inscrits, et **Table Editor > profiles** pour voir leur XP.

---
*Doc rédigée pour l'équipe MedGame - Février 2026*
