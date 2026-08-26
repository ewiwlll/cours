# Fonctions avancées d’apprentissage

Ce document décrit le comportement attendu des fonctions avancées de **Cours**. Il sert à la fois de guide utilisateur et de contrat produit pour les développements web, mobile et backend.

## Règle de base : trois types de données

| Type | Exemples | Règle |
| --- | --- | --- |
| Source | audio, transcription originale, photo, marqueur, section validée | conservée, traçable, jamais réécrite par une planification ou une correction |
| Observation d’apprentissage | réponse orale transcrite, oublis, note, durée de réponse | datée et reliée à une séance ; elle ne devient pas du contenu de cours |
| Calcul | priorités, erreurs récurrentes, planning de partiel, séance adaptative | recomputable à partir des deux catégories précédentes ; il ne doit pas inventer de notions |

Une correction s’appuie uniquement sur la source disponible et sur le périmètre choisi. Une source insuffisante reste signalée comme telle : l’application ne transforme pas une hypothèse en fait de cours.

## 1. Marqueurs pendant l’enregistrement

L’utilisateur peut poser un marqueur sans arrêter l’enregistrement, avec un type canonique (`important`, `unclear`, `example`, `question`) et, facultativement, un libellé.

Le marqueur porte un `offsetMs`, c’est-à-dire le nombre de millisecondes écoulées depuis le début de l’audio. C’est un instant exact au moment de l’action : il est capturé par l’horloge de l’enregistrement, pas déduit de la transcription. Après synchronisation, il permet d’ouvrir ou de relire le passage audio correspondant.

## 2. Photos synchronisées à l’audio

Lorsqu’une photo est prise ou importée pendant un enregistrement, elle reçoit l’`offsetMs` courant et, si applicable, le `markerId` du marqueur posé au même instant. Une photo déjà importée peut être associée manuellement à un instant, mais l’interface doit alors indiquer qu’il s’agit d’une association choisie.

L’offset fait référence au fichier audio de la séance, jamais à l’heure murale du téléphone. Il est exact à la précision de l’horloge et de la capture côté client ; il n’implique pas qu’un mot précis de la transcription soit connu à cet instant.

## 3. Rappel oral et transcription locale

Le rappel oral suit le même ordre que le rappel écrit :

1. l’élève choisit le cours ou la section et parle sans voir la fiche ;
2. le son de la réponse est transcrit localement lorsque le moteur disponible le permet ;
3. la transcription de réponse est présentée pour relecture avant envoi ;
4. seulement ensuite, Cours compare la réponse à la source et explique les manques ;
5. l’élève peut réexpliquer, répondre à des questions ciblées, puis s’auto-évaluer.

L’audio de réponse et sa transcription sont des observations de séance. Ils ne remplacent ni la transcription originale ni la fiche. Si aucune transcription locale fiable n’est disponible, l’utilisateur peut passer au rappel écrit ou conserver l’audio sans fabriquer de texte.

## 4. Sections de transcription proposées puis validées

Après réception d’une transcription, Cours peut proposer des sections titrées. Chaque proposition comporte un titre, un début et une fin. L’élève valide, modifie, fusionne ou supprime ces propositions avant qu’elles ne deviennent des `transcriptSections` utilisables pour le rappel, les questions ou le partiel.

Le timing d’une section peut être **estimé** : une transcription sans timestamps mot-à-mot ne permet pas de prétendre à une frontière audio exacte. La provenance doit donc être explicite : `estimated` pour une proposition déduite du texte ou d’une durée globale, `manual` lorsqu’elle est réglée par l’utilisateur, `timestamped` lorsqu’elle provient de repères temporels fiables. Une section non validée ne restreint aucune correction.

## 5. Erreurs récurrentes entre séances

Une notion devient récurrente lorsqu’elle réapparaît comme oubli, réponse partielle ou erreur dans plusieurs séances distinctes. L’interface présente au minimum : le concept, le nombre de séances concernées, la dernière occurrence et les séances sources.

Une réussite explicite peut faire sortir la notion des priorités actives, mais ne supprime jamais l’historique. Les regroupements doivent privilégier les identifiants de cartes ou de concepts déjà validés ; un rapprochement textuel incertain doit être présenté comme suggestion, pas comme nouvelle connaissance.

## 6. Comparaison de progression

Pour un même cours ou une même portée validée, la comparaison affiche côte à côte :

- la première explication enregistrée ;
- la dernière explication enregistrée ;
- les omissions et notions couvertes pour chacune ;
- l’évolution de la note et de la durée, si elles existent.

Il ne s’agit pas d’une note automatique de compréhension. L’interface doit préserver l’accès aux deux réponses originales et éviter de comparer des périmètres différents (par exemple, parties 1 à 3 contre partie 4).

## 7. Préparation de partiel et planning rétroactif

L’élève renseigne une date de partiel et sélectionne les chapitres ou sections à préparer. Cours calcule ensuite des passages de rappel et de questions avant cette date, en tenant compte des séances dues, des notions faibles et du nombre de jours disponibles.

Le plan n’est pas une preuve sur le cours et ne modifie pas les dates de révision ordinaires sans action explicite. En cas de temps insuffisant, il doit afficher le conflit et prioriser le rappel actif des contenus déjà prêts, plutôt que promettre une couverture totale irréaliste.

## 8. Séance adaptative selon le temps disponible

L’élève choisit une durée, par exemple 5, 15 ou 30 minutes, et peut limiter la séance à une matière, un chapitre ou une date de partiel. Cours renvoie une suite explicite de tâches : rappels de cours, cartes dues, questions sur erreurs récurrentes et éventuellement une courte explication orale.

Le temps annoncé est une estimation. Chaque tâche doit indiquer sa durée prévue et son motif de priorité. La séance ne génère pas de questions si la source est insuffisante, et elle ne mélange pas des sections hors périmètre.

## 9. Mode examen oral

Le mode examen oral choisit uniquement des questions et notions déjà présentes dans des cours prêts et validés. Il propose une durée, un périmètre et un niveau de relance. Pendant l’épreuve, la fiche reste masquée ; la réponse orale est transcrite si possible, puis corrigée après la tentative.

Le bilan distingue les réponses, les relances, les zones à retravailler et une prochaine action. Il ne doit ni enregistrer une note scolaire officielle, ni inventer de question, ni présenter une transcription incertaine comme un verbatim fiable.

## Données de cours attendues

Les nouveaux champs sont facultatifs pour préserver les cours existants. Quand ils existent, ils suivent ce contrat :

```json
{
  "audioDurationMs": 3562000,
  "recordingMarkers": [
    {
      "id": "marker-01",
      "offsetMs": 842000,
      "kind": "important",
      "label": "Définition à retenir",
      "createdAt": "2026-08-19T18:42:00.000Z"
    }
  ],
  "photos": [
    {
      "id": "photo-01",
      "filename": "tableau.jpg",
      "offsetMs": 842000,
      "markerId": "marker-01"
    }
  ],
  "transcriptSections": [
    {
      "id": "section-01",
      "title": "Mécanisme présenté",
      "startOffsetMs": 780000,
      "endOffsetMs": 1180000,
      "timingEstimated": true,
      "status": "validated"
    }
  ]
}
```

Contraintes : `audioDurationMs`, `offsetMs`, `startOffsetMs` et `endOffsetMs` sont des entiers positifs en millisecondes ; un offset ne dépasse pas la durée connue de l’audio ; `startOffsetMs < endOffsetMs`. Les marqueurs et photos peuvent exister sans transcription. Les sections validées sont les seules utilisables comme périmètre de correction.
