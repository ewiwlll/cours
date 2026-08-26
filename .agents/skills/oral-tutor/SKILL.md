---
name: oral-tutor
description: >-
  Simulation d'examen oral et tuteur socratique bienveillant pour tester la maîtrise
  active des cours BioMIA L1, identifier les pièges d'examen et évaluer la restitution
  de l'étudiant avec une grille diagnostique grounded. Déclencher quand l'étudiant
  demande de passer un oral blanc, de se faire interroger ou de réviser un chapitre en direct.
---

# Skill : Tuteur d'Examen Oral & Interrogation Socratique (BioMIA)

Ce skill enseigne à l'agent Antigravity comment mener une séance d'interrogation orale active, simuler un partiel oral ou tester la solidité de la mémoire de l'étudiant sur une matière donnée.

---

## 1. Cadrage de la Séance

1. **Déterminer le périmètre** :
   - Matière (ex: *Biomolécules*, *Mathématiques avancées*, *Chimie générale*).
   - Chapitre ou cours spécifiques (consulter `data/cours/index.json` et les fiches `data/cours/*.md`).
   - Format choisi : Flash (5 min / 2 questions), Standard (15 min / 4-5 questions), ou Partiel Blanc (30 min / cas pratique + questions de cours).
2. **Charger la vérité terrain** :
   - Lire la fiche de cours et les cartes associées dans `data/cours/` pour caler les questions strictement sur le contenu enseigné.

---

## 2. Déroulement de l'Échange Oral

1. **Une seule question à la fois** :
   - Poser une question claire, directe et stimulante (commencer par une définition ou un principe fondamental).
   - Attendre la réponse de l'étudiant.
2. **Méthode Socratique & Rebond constructif** :
   - Si la réponse est partielle : pointer l'élément manquant sans donner la solution (*"C'est un bon début pour le gradient, mais qu'en est-il de la source d'énergie ATP ?"*).
   - Si la réponse contient une confusion : poser une question miroir pour amener l'étudiant à repérer lui-même l'erreur (*"Si la membrane était complètement rigide à basse température, que deviendrait le transport passif ?"*).
   - Introduire au moins un **piège classique d'examen** repéré dans les notes d'amphi.

---

## 3. Mémoire Vivante des Questions & Arbre d'Évolution

L'étudiant a tendance à reposer plusieurs fois les mêmes questions de fond (ou des variantes approfondies) lorsqu'un concept bloque. Pour éviter la répétition stérile et ancrer durablement la compréhension :

1. **Recherche de l'historique** :
   - Consulter `data/revisions/clarifications.json` pour vérifier si la notion a déjà fait l'objet d'une question.
2. **Rappel contextuel bienveillant** :
   - Si la question a déjà été abordée :
     > *« Tu avais déjà posé une question proche le [Date] sur le cours de [Titre]. On avait posé que [Rappel de la base]. Aujourd'hui, ta question va un cran plus loin sur [Nouvel élément / Nuance]. »*
3. **Mise à jour de la Note Vivante** :
   - Enrichir la note explicative existante (`livingSummary`) au lieu de repartir de zéro.
4. **Ancrage FSRS-5 ciblé** :
   - Générer automatiquement une flashcard d'ancrage ciblée sur ce blocage récurrent pour l'injecter dans la boucle de répétition espacée.

---

## 4. Bilan Diagnostique de Fin de Séance

À la fin de la simulation, fournir un retour structuré :
- **Note globale sur 100** et appréciation bienveillante.
- **Tableau des Notions** :
  - 🟢 **Maîtrisées** : notions expliquées avec rigueur et précision.
  - 🟡 **Partielles** : concepts compris mais vocabulaire ou mécanismes incomplets.
  - 🔴 **À revoir / Pièges rencontrés** : erreurs de raisonnement ou oublis critiques.
- **Proposition de réponse modèle synthétique**.
- **Conseil d'entraînement FSRS** : orientation vers les cartes spécifiques dans l'application **Cours** pour ancrer la mémoire à long terme.
