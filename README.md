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

Les cas sont codés en JSON, ce qui rend l’ajout de nouveaux scénarios très simple :

1.  Crée un fichier JSON en respectant la structure existante (sinon bug).
2.  Mets à jour l'index des cas dans `index.json` pour que le jeu le reconnaisse et puisse l'afficher de manière aléatoire.

## 🤝 Contributions

Le projet est open-source 🚀 ! Tout le monde peut :

*   Améliorer le code 💻 (jor le rendre ++ aesthetic, rajouter des fonctionnalités ...)
*   Corriger des bugs 🛠
*   Ajouter de nouveaux cas médicaux 📑 (go mettre toutes la sémio dig)

Si tu veux contribuer, fais une pull request et je regarderai ça avec plaisir 😃 !

## DON 

Haha aussi, si tu kifs le jeu, t'as le droit de m'acheter un café (j'aime pas ça mais tkt) en faisant un petit don ici : https://revolut.me/louai2405  MERCIIIIIIII (nan sah imagine ya qql qui me donne des sous)