---
name: setup-curriculum
description: >-
  Recherche sur le web la maquette officielle, syllabus et modalités de contrôle (MCC)
  d'une formation universitaire, puis génère et configure automatiquement l'intégralité
  du classeur de cours (matières, crédits ECTS réels, priorités d'examen FSRS,
  chapitres fondamentaux et calendrier de partiels).
  Déclencher dès que l'étudiant demande de configurer son cursus, sa fac, sa licence ou son année d'études.
---

# Skill : Setup Curriculum Universitaire (Antigravity Studio)

Ce skill permet à l'agent Antigravity de rechercher la **véritable maquette pédagogique officielle** d'une université ou grande école sur le web (syllabus, plaquette PDF, modalités de contrôle des connaissances MCC, crédits ECTS) et d'initialiser proprement le classeur de cours de l'étudiant.

---

## 1. Déclencheur & Paramètres

Ce skill se déclenche lorsque l'utilisateur fournit le nom de sa formation, son université ou le lien vers sa plaquette pédagogique :
- `cours setup <formation / université / URL>`
- *Exemples* :
  - `cours setup Licence 1 Droit Panthéon-Sorbonne`
  - `cours setup PASS Médecine Université Paris Cité`
  - `cours setup CPGE MPSI Lycée Louis-le-Grand`
  - `cours setup BUT Informatique IUT Lyon 1`
  - `cours setup https://formation.univ-paris1.fr/fr/offre-de-formation/licence-XA/licence-droit-DRO1/`

---

## 2. Protocole de Recherche Web Grounded (Zéro Hallucination)

1. **Recherche ciblée via `search_web`** :
   - Trouver la plaquette officielle de la formation (mots-clés : `maquette enseignement ECTS syllabus programme "nom_formation"`).
2. **Lecture des sources officielles via `read_url_content`** :
   - Extraire les données réelles :
     - Liste officielle des Unités d'Enseignement (UE) et des matières pour le Semestre 1 (et Semestre 2 si demandé).
     - **Crédits ECTS exacts** (la somme du semestre doit faire exactement **30 ECTS**).
     - **Types d'épreuves & coefficients** (Écrit terminal, Oral, Contrôle Continu).
     - **Grands chapitres / thèmes au programme** de chaque matière.
     - **Période des examens** (ex: Session 1 en décembre/janvier).

---

## 2.1 Cadrage & Questions Interactives Obligatoires (Ne jamais deviner à l'aveugle)

Dès qu'une formation comporte des **choix d'options, spécialités ou filières** (ex: Lycée, PASS avec mineures, Licence avec parcours, CPGE) :
1. **L'agent identifie le tronc commun obligatoire**.
2. **L'agent pose des questions claires et ciblées à l'étudiant** pour arbitrer ses options :
   - *Pour le Lycée* : « Quelles sont tes 2 spécialités de Terminale ? », « Quelle est ta LV2 (Espagnol, Allemand, Italien...) ? », « As-tu une option (Maths Expertes, DGEMC...) ? »
   - *Pour le PASS Santé* : « Quelle est ta mineure disciplinaire (Droit, Psychologie, Mathématiques, Éco, SVT...) ? »
   - *Pour une Licence* : « Quel est ton parcours (Classique, International, L.AS Santé) ? »
3. **L'agent n'écrit les matières et chapitres définitifs qu'après confirmation des choix de l'étudiant.**

---

## 3. Calibrage Automatique Pédagogique & FSRS-5

Pour chaque matière extraite :
- **Crédits ECTS** : Coefficient officiel (ex: 6 ECTS = matière majeure, 3 ECTS = matière standard, 1-2 ECTS = mineure/option).
- **Priorité d'examen FSRS-5** :
  - **Priorité A** (Rétention cible 92 %, révisions quotidiennes prioritaires) : Matières à fort coefficient (>= 5 ECTS) ou épreuve éliminatoire.
  - **Priorité B** (Rétention cible 88 %) : Matières standards (3 à 4 ECTS).
  - **Priorité C** (Rétention cible 85 %, rythme espacé) : Options, langues ou mineures (1 à 2 ECTS).
- **Chapitres fondamentaux** : 2 à 4 chapitres clés décrivant le découpage du cours.

---

## 4. Écriture & Persistance des Données

1. **Mettre à jour `data/courses.json`** :
   Écrire le catalogue des matières avec le format officiel :
   ```json
   {
     "program": "Licence 1 Droit",
     "university": "Université Paris 1 Panthéon-Sorbonne",
     "year": "2026-2027",
     "courses": [
       {
         "id": "s1-droit-constitutionnel-1",
         "title": "Droit constitutionnel 1",
         "semester": "S1",
         "category": "Majeure",
         "ects": 6,
         "priority": "A"
       }
     ]
   }
   ```

2. **Mettre à jour `data/cours/chapter-definitions.json`** :
   Créer les définitions des chapitres fondamentaux associés à chaque `subjectId`.

3. **Vérifier l'intégrité** :
   S'assurer que `data/courses.json` totalise 30 ECTS par semestre et que les identifiants `id` sont uniques et stables.

---

## 5. Bilan Chaleureux & Recommandations

Conclure en affichant un tableau récapitulatif clair :
- Nom officiel de la formation et université détectée.
- Tableau des matières : `Matière | ECTS | Priorité FSRS | Chapitres prévus`.
- Message invitant l'étudiant à ouvrir `/Applications/Cours.app` ou son smartphone pour commencer à enregistrer ses amphis en 1 clic !
