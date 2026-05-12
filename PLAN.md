# MEDGAME v3D — Plan Directeur

## Architecture des 3 Ateliers

### Atelier 1: Assets 3D & Interactivité/Mouvement
**Fichiers principaux:** `three-animations.js`, `three-instruments.js`, `three-room.js`, `three-environment-agent.js`, `three-asset-agent.js`, `three-scene.js`

**Mission:**
1. Animations personnages (respiration, expressions, mouvements, déplacement fluide)
2. Instruments interactifs détaillés (tensiomètre, oxymètre, thermomètre, glucomètre, tablette)
3. Environnement immersif (perfusion, moniteur ECG, lit détaillé, charriot, particules)
4. Système d'interactionamélioré (hover glow, tooltips riches, caméra fluide)

### Atelier 2: Jouabilité & Fun par Cas
**Fichiers principaux:** `three-manager.js`, `three-hud-agent.js`, `three-transition-agent.js`, `patientChat.js`, `nurse.js`, `lockSystem.js`, `urgenceMode.js`

**Mission:**
1. Synchronisation 2D ↔ 3D (examens, diagnostics, score)
2. Dialogue patient immersif (chat contextuel, expressions)
3. Gating & progression visuels en 3D (cadenas, illuminations)
4. Mode urgence 3D (timer angoissant, constantes dynamiques, alertes)
5. Intégration infirmière 3D

### Atelier 3: Logique du Jeu
**Fichiers principaux:** `game.js`, `gameState.js`, `scoring.js`, `lockSystem.js`, `timer.js`, `vitalSigns.js`, `prescription.js`, `ui.js`, `caseLoader.js`

**Mission:**
1. Scoring composite avancé (Démarche 40%, Diagnostic 30%, Traitement 20%, Vitesse 10%)
2. Gating sémiologique intelligent
3. Feedback post-cas détaillé
4. Constantes vitales dynamiques
5. Prescription réaliste (contre-indications, dosage, voies)
6. Timer adaptatif

## Rotation des Crons
- Chaque atelier tourne 20 min
- Rotation: Assets → Jouabilité → Logique → Review → Assets → ...
- Le reviewer vérifie un atelier à la fois après son tour

## Contraintes Globales
- Pas de modèles externes (GLB/OBJ) — tout procédural Three.js
- Compatibilité 2D préservée
- 60fps visé
- Tout en français
- Chaque amélioration doit marcher indépendamment