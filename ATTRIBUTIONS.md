# Attributions des Ressources 3D - Medgame

Ce projet utilise des ressources graphiques 3D gratuites sous licences libres. Nous tenons à remercier chaleureusement les auteurs pour leur travail de qualité.

## 1. Modèles de Personnages 3D (Patients)
* **Auteur** : [Kenney](https://kenney.nl/)
* **Pack** : Mini Characters Pack
* **Ressources** : Fichiers GLB `character-male-a.glb` à `f.glb` et `character-female-a.glb` à `f.glb`
* **Licence** : [CC0 1.0 Universal (Domaine Public)](https://creativecommons.org/publicdomain/zero/1.0/deed.fr)

## 2. Mobilier et Éléments de Décoration 3D
* **Auteur** : majesticmaje
* **Pack** : Coffeehouse Lounge Pack
* **Ressources** : Fichiers GLB `Bar Stool.glb`, `Couch Small.glb`, `Light Desk.glb`, `Book Stack.glb`, `Coffee cup.glb` et `Houseplant.glb`
* **Source** : Téléchargé via [Poly Pizza](https://poly.pizza/)
* **Licence** : [CC-BY (Attribution)](https://creativecommons.org/licenses/by/4.0/deed.fr)

## 3. Atlas anatomique 3D (page Atlas 3D, optionnel, chargé à la demande)
* **Modèle Homme (Standard)** :
  * **Projet** : [Human Atlas](https://github.com/ashemag/human-atlas) par ashemag — code visionneuse sous [MIT](https://github.com/ashemag/human-atlas/blob/main/LICENSE), porté en vanilla JS dans `js/three-atlas-*.js`.
  * **Données anatomiques** : [BodyParts3D 4.0](https://lifesciencedb.jp/bp3d/), © The Database Center for Life Science (DBCLS), licenciées [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.fr). Référence homme adulte, 2 234 meshes / 3 432 concepts / 15 systèmes, ~33 Mo streamés depuis miroir jsDelivr.
* **Modèle Femme (Expérimental ⚠️)** :
  * **Projet** : [Female Atlas](https://github.com/HiMahendraBeniwal/female-atlas) par HiMahendraBeniwal — sous licence [MIT](https://github.com/HiMahendraBeniwal/female-atlas/blob/main/LICENSE).
  * **Données anatomiques** : Human Reference Atlas ([HuBMAP Consortium](https://hubmapconsortium.org/)) & [BodyParts3D](https://lifesciencedb.jp/bp3d/) (DBCLS), sous licence [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.fr). 3 004 meshes / 2 557 concepts / 16 systèmes (incluant appareil reproducteur féminin et gestation), ~54 Mo streamés depuis miroir jsDelivr.
  * **Statut** : Prototype de recherche expérimental. Certaines structures géométriques peuvent être incomplètes ou comporter des approximations.
* **Animation & Synchronisation ECG** :
  * Le battement cardiaque physiologique de l'Atlas 3D en mode isolé est synchronisé avec les tracés cliniques réels du dataset [PhysioNet PTB-XL](https://physionet.org/content/ptb-xl/1.0.3/) (licence [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/)), référencé en section 5 ci-dessous.
* **Usage** : explorateur éducatif uniquement, pas un outil diagnostique ou chirurgical. En cas de redistribution des géométries, conserver cette attribution + lien source.

## 4. Dataset Auscultatoire HLS-CMDS (Stéthoscope Virtuel)
* **Nom** : HLS-CMDS (Heart and Lung Sounds Captured from Clinical Manikin using Digital Stethoscope)
* **Auteurs** : Y. Torabi, S. Shirani, J. P. Reilly (McMaster University)
* **Publication** : IEEE Data Descriptions (2025)
* **DOI** : [10.1109/IEEEDATA.2025.3566012](https://doi.org/10.1109/IEEEDATA.2025.3566012)
* **Code & Données** : [GitHub Torabiy/HLS-CMDS](https://github.com/Torabiy/HLS-CMDS)
* **Licence** : [MIT License](https://github.com/Torabiy/HLS-CMDS/blob/main/LICENSE)
* **Ressources intégrées** : 100 enregistrements audio PCM WAV mono 16-bit 4000 Hz dans `assets/audio/auscultation/` (50 bruits cardiaques, 50 bruits respiratoires).

## 5. Dataset Électrocardiographique PTB-XL (ECG Academy 12 Dérivations)
* **Nom** : PTB-XL, a large publicly available electrocardiography dataset
* **Auteurs** : Patrick Wagner, Nils Strodthoff, Ralf-Dieter Bousseljot, Dieter Kreiseler, Fatima I. Lunze, Wojciech Samek, Tobias Schaeffter (Physikalisch-Technische Bundesanstalt & Charité Universitätsmedizin Berlin)
* **Publication** : Scientific Data (Nature), 2020
* **DOI** : [10.1038/s41597-020-0386-4](https://doi.org/10.1038/s41597-020-0386-4)
* **Dépôt PhysioNet** : [PhysioNet PTB-XL v1.0.3](https://physionet.org/content/ptb-xl/1.0.3/)
* **Licence** : [Creative Commons Attribution 4.0 International (CC-BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
* **Ressources intégrées** : 16 tracés cliniques réels 12 dérivations convertis en JSON 100 Hz (10 secondes, amplitude en mV) dans `assets/data/ecg/` :
  - `ecg_normal_sinus.json` (Record `00001_lr`)
  - `ecg_stemi_ant.json` (Record `00184_lr`)
  - `ecg_stemi_inf.json` (Record `00257_lr`)
  - `ecg_afib.json` (Record `04117_lr`)
  - `ecg_flutter.json` (Record `00018_lr`)
  - `ecg_bav1.json` (Record `00102_lr`)
  - `ecg_bav2_wenckebach.json` (Record `01222_lr`)
  - `ecg_bav3.json` (Record `00959_lr`)
  - `ecg_rbbb.json` (Record `00195_lr`)
  - `ecg_lbbb.json` (Record `00180_lr`)
  - `ecg_lafb.json` (Record `00041_lr`)
  - `ecg_wpw.json` (Record `02145_lr`)
  - `ecg_lvh.json` (Record `00138_lr`)
  - `ecg_rvh.json` (Record `00222_lr`)
  - `ecg_wellens.json` (Record `00260_lr`)
  - `ecg_pacemaker.json` (Record `00144_lr`)

## 6. Atlas Système Nerveux 3D (page Atlas 3D, module Système Nerveux)
* **Nom du projet** : Atlas Système Nerveux (Clinical Neuroanatomy Atlas / `nervous-system-atlas` v1.0.0)
* **Auteur original** : Batuhan Ayci (2026)
* **Dépôt source** : [GitHub nervous-system-atlas](https://github.com/aycibatuhan/nervous-system-atlas)
* **Code applicatif** : [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
  ```
  Clinical Neuroanatomy Atlas
  Copyright 2026 Batuhan Ayci
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
      http://www.apache.org/licenses/LICENSE-2.0
  ```
* **Contenu et Données anatomiques** : [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/deed.fr)
* **Clause ShareAlike (Partage dans les Mêmes Conditions)** : Les traductions françaises, notices cliniques enrichies et cas cliniques EDN/R2C intégrés par MedGame dans `neuro-atlas/data/content.fr.json` sont distribués sous cette même licence CC BY-SA 4.0.
* **Datasets sources de neuro-imagerie et géométrie 3D (Édition publique)** :
  - **MNI152NLin2009cAsym** : Template IRM T1w/T2w & segmentation FreeSurfer aseg, (c) Louis Collins, McGill University (Fonov et al. 2011).
  - **VENAT (Veins and Arteries Template)** : Modèles vasculaires cérébraux haute résolution (Bazin et al., Max Planck Institute).
  - **HCP1065 (Human Connectome Project)** : Faisceaux de substance blanche et tractographie (Yeh et al., CMU / HCP).
  - **BodyParts3D 4.0** : Nerfs périphériques, moelle spinale et méninges, © The Database Center for Life Science (DBCLS), licence CC BY 4.0.
  - **Z-Anatomy** : Éléments squelettiques et crâniens de repère, sous licence CC BY-SA 4.0.
  - **Terminologies** : Terminologia Anatomica (TA2, FIPAT 2019), Terminologia Neuroanatomica (TNA, FIPAT 2017) dans le domaine public ; alignements Wikidata (CC0) et Wikipédia (CC BY-SA 4.0).
* **Usage & Périmètre de licence** : Outil interactif à vocation éducative et pédagogique médicale (EDN/R2C). Le code de MedGame reste sous GPL-3.0, la visionneuse neuro sous Apache-2.0, et le corpus de données/contenus neuro sous CC BY-SA 4.0 sans contamination croisée.



