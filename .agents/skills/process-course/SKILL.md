---
name: process-course
description: >-
  Pipeline de décomposition atomique et de structuration exhaustive des cours
  universitaires (MOC, concepts atomiques Feynman, tableaux comparatifs 'X vs Y',
  fiches exhaustives KaTeX, flashcards FSRS-5, QCM diagnostiques avec analyse des
  distracteurs, callouts de pièges et sas de rappel actif).
  Déclencher dès que l'utilisateur demande de compiler, traiter ou structurer un cours.
---

# Pipeline de Décomposition Atomique & MOC (Cours — Revision OS)

Ce skill enseigne à l'agent Antigravity comment effectuer une **décomposition atomique intégrale et adaptée** d'un cours d'amphi selon le standard d'excellence pédagogique observé dans le vault (MOC, Technique Feynman, Théorie de la Charge Cognitive de Sweller, et **Tableaux Comparatifs « X vs Y »**).

> **Règle d'or de calibrage :** Ne jamais forcer un nombre artificiel de concepts. Extraire **exactement** le nombre réel de concepts atomiques présents dans la séance (selon la densité du cours), en privilégiant la profondeur, la clarté pédagogique et les analogies marquantes plutôt que le remplissage.

---

## 1. Détection & Transcription de la Source

1. **Vérifier les enregistrements ou notes en attente** :
   ```bash
   node scripts/course-helper.mjs pending
   ```
2. **Si audio brut présent** :
   Lancer la transcription Whisper.cpp Metal locale si nécessaire :
   ```bash
   node scripts/course-helper.mjs transcribe <audio-path>
   ```
3. **Charger la source intégrale** : Lire le texte brut complet dans `data/transcriptions/` ou `inbox/`.

---

## 2. Le MOC (Map of Content — Carte d'Orientation Active)

Pour tout cours ou chapitre, concevoir la cartographie conceptuelle :
- **Problématique centrale** : Quelle est la question biologique / mathématique fondamentale que résout ce cours ?
- **Enchaînement causal des phases (`phases`)** : Montrer comment chaque bloc de concepts découle logiquement du précédent ($A \to B \to C \to \text{Conséquence}$).

---

## 3. Décomposition en Concepts Atomiques (`atomicConcepts`)

Pour chaque notion clé identifiée dans le cours, structurer la note atomique :

```json
{
  "id": "concept-01",
  "title": "Nom précis du concept",
  "whyWeNeedIt": "💡 Pourquoi on en a besoin : Le problème concret du vivant ou du calcul que cela résout dans la réalité.",
  "analogy": "☕ L'analogie concrète du quotidien (Technique Feynman : métaphore imagée permettant de comprendre intuitivement le phénomène).",
  "definition": "📖 Définition scientifique et technique rigoureuse, avec formules en LaTeX KaTeX ($...$).",
  "comparison": {
    "versus": "Concept B (le piège ou la variante avec laquelle on hésite souvent)",
    "rule": "La règle simple et infaillible pour ne jamais les confondre",
    "table": [
      { "critere": "Critère 1 (ex: Énergie)", "a": "Sans ATP", "b": "Hydrolyse d'ATP" },
      { "critere": "Critère 2 (ex: Gradient)", "a": "Dans le sens du gradient", "b": "Contre le gradient" }
    ]
  },
  "progressiveExamples": [
    {
      "level": "simple",
      "title": "Cas d'école élémentaire",
      "explanation": "Application directe sur un exemple simple pour ancrer la logique."
    },
    {
      "level": "realiste",
      "title": "Cas d'examen / Partiel BioMIA",
      "explanation": "Exercice ou situation biologique complexe de niveau partiel."
    }
  ],
  "traps": [
    "⚠️ Piège classique d'examen signalé en amphi ou confusion fréquente."
  ],
  "relatedConcepts": ["concept-precedent", "concept-suivant"],
  "flashcardQnA": {
    "question": "Question directe de restitution active.",
    "answer": "Réponse modèle synthétique et chirurgicale."
  }
}
```

---

## 4. Rédaction de la Fiche de Cours Exhaustive (`data/cours/<date>__<matiere>__<titre>.md`)

La fiche Markdown est le document de référence encyclopédique du cours :
1. **Sections numérotées & Démonstrations complètes**.
2. **Tableaux Comparatifs « X vs Y »** intégrés dans le Markdown pour chaque opposition majeure.
3. **Insertion synchronisée des Photos du Tableau & Balises (`offsetMs`)** :
   - Chaque photo prise en amphi est insérée à l'endroit précis du cours correspondant à son timestamp `offsetMs` (`![Tableau - 00:32:15](photos/...)`).
   - Chaque repère **« Pas compris » (`confused`)** est encadré avec un callout explicatif dédié (`> [!TIP] 💡 Éclaircissement sur la notion de 00:14:22...`).
4. **Formules LaTeX KaTeX complètes** avec explication systématique de chaque variable et de son unité SI.
5. **Callouts d'alertes & pièges d'examen (`> [!WARNING]`)**.
6. **Balises de Grounding (`À VÉRIFIER`)** si une notion déduite n'est pas textuellement dans la source.

---

## 5. Flashcards FSRS-5 & QCM Diagnostiques (`cards`)

Générer les cartes de révision espacée associées :
1. **Flashcards unitaires (`kind: "definition"`, `"mecanisme"`, `"formule"`, `"comparer"`)** : 1 carte = 1 fait atomique (pas de cartes surchargées).
2. **Flashcards de vulgarisation Feynman dédiées** pour toute balise « Pas compris » posée en amphi.
3. **QCM diagnostiques (`kind: "qcm"`)** : 4 options + explication pédagogique détaillée démontrant pourquoi la bonne réponse est vraie et pourquoi chaque faux choix est un piège.

---

## 6. Sas de Rappel Actif & Enregistrement

Inscrire dans `data/cours/index.json` :
- `status`: `"traite"`
- `recallStatus`: `"locked"`
- `recallScore`: `0`
- `summaryFilename`: `"<date>__<matiere>__<titre>.md"`
- `atomicConcepts`: liste exhaustive des concepts atomiques générés.
- `cards`: liste des cartes FSRS-5.
- `moc`: définition de la cartographie.

Valider avec :
```bash
node scripts/course-helper.mjs validate <course-id>
```

Restituer à l'étudiant un débriefing de fin de traitement avec le nombre de concepts atomiques isolés, les tableaux de distinction clés et l'invitation au sas de rappel actif.
