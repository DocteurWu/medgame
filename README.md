# 🎮 Medgame

Medgame est un jeu "éducatif" simulant des scénarios médicaux pour tester tes connaissances du semestre 🏥. Ce n’est pas une source officielle 📚, mais un outil basé sur les réfs et mis à jour régulièrement.

C'est une version uniquement destiné au DFGSM2 pour le S2 - si t'aimes l'idée et que c'est pas ton année, tu peux changer les UEs et créer tes cas ! c'est ça l'open source

## 📥 Installation

### Cloner le dépôt :

```bash
git clone [URL du dépôt]
```

ou télécharge le ZIP via "Code" > "Download ZIP", puis extrais-le.

### Télécharger et installer Python :

Téléchargez et installez Python depuis [https://www.python.org/downloads/](https://www.python.org/downloads/)

### Lancer le serveur local :

1.  Ouvre un terminal et navigue vers le dossier du jeu :

    ```bash
    cd "chemin/vers/ton/dossier"
    ```
2.  Démarre un serveur local :

    ```bash
    py -m http.server 8000
    ```
3.  Ouvre ton navigateur et va sur :

    👉 [http://localhost:8000](http://localhost:8000)

🎉 Le jeu est prêt, amuse-toi bien !

## 🏥 Utilisation

Medgame te plonge dans des cas médicaux où tu dois poser un diagnostic et choisir le bon traitement. Suis les instructions à l’écran et utilise tes connaissances pour prendre les meilleures décisions 💡.

⚠ Attention : Medgame n’est pas un outil de formation officiel. C’est un jeu basé sur les réfs seulement.

## 📝 Ajouter des cas médicaux

L'ajout de nouveaux cas est simple, mais il faut être rigoureux pour que le cas soit correctement chargé dans le jeu. Voici les étapes à suivre :

### Étape 1 : Créer le fichier du cas

1.  **Créez un nouveau fichier `.json`** pour votre cas clinique. Vous pouvez copier/coller un cas existant depuis le dossier `data/` pour avoir un modèle.
2.  **Nommez votre fichier** de manière descriptive (par exemple, `cardio_infarctus_1.json`).
3.  **Placez ce fichier** dans le dossier `data/`.

### Étape 2 : Mettre à jour l'index des cas

Le fichier `data/case-index.json` est l'index qui répertorie tous les cas disponibles pour chaque thème.

1.  **Ouvrez le fichier `data/case-index.json`**.
2.  **Trouvez le thème** correspondant à votre cas (par exemple, `"cardiologie"`).
3.  **Ajoutez le nom de votre fichier** à la liste des cas pour ce thème.

**Exemple :** Pour ajouter `cardio_infarctus_1.json` au thème cardiologie, modifiez le fichier comme suit :

```json
{
  "cardiologie": ["cardio_1.json", "cardio_infarctus_1.json"],
  "gynécologie": [],
  "endocrinologie": ["EDN_diabetetype2_1.json", ...],
  ...
}
```

**Important :** Le nom du thème dans ce fichier (`"cardiologie"`, `"endocrinologie"`, etc.) doit être en **minuscules**.

### Étape 3 : Ajouter un nouveau thème (si nécessaire)

Si votre cas appartient à une nouvelle spécialité qui n'existe pas encore, vous devez l'ajouter à l'écran de sélection des thèmes.

1.  **Ouvrez le fichier `themes.html`**.
2.  **Copiez un bloc de code `<div class="theme-card">...</div>`** existant.
3.  **Modifiez les informations** pour votre nouveau thème :
    *   `data-theme` : Mettez le nom de votre thème. **Ce nom doit correspondre exactement** à celui que vous utiliserez dans `case-index.json` (la casse est importante ici, par exemple `Cardiologie`).
    *   Le titre `<h2>`, le sous-titre `<p>` et l'emoji `<span>`.

**Exemple :** Pour ajouter un thème "Pneumologie" :

```html
<!-- ... autres thèmes -->
<div class="theme-card" data-theme="Pneumologie">
    <span class="emoji">🫁</span>
    <h2>Pneumologie</h2>
    <p class="theme-subtitle">Cas cliniques de pneumologie</p>
</div>
<!-- ... autres thèmes -->
```

4.  Enfin, n'oubliez pas d'ajouter la nouvelle catégorie et le fichier de cas dans `data/case-index.json` :

```json
{
  "cardiologie": [...],
  "pneumologie": ["pneumo_mon_cas_1.json"],
  ...
}
```


## 🤝 Contributions

Le projet est open-source 🚀 ! Tout le monde peut :

*   Améliorer le code 💻 (jor le rendre ++ aesthetic, rajouter des fonctionnalités ...)
*   Corriger des bugs 🛠
*   Ajouter de nouveaux cas médicaux 📑 (go mettre toutes la sémio dig)

Si tu veux contribuer, fais une pull request et je regarderai ça avec plaisir 😃 !

## DON 

Haha aussi, si tu kifs le jeu, t'as le droit de m'acheter un café (j'aime pas ça mais tkt) en faisant un petit don ici : https://revolut.me/louai2405  MERCIIIIIIII (nan sah imagine ya qql qui me donne des sous)