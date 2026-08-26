# Contrat backend mobile et automatisation

## Synchronisation mobile

`POST /api/mobile/sync` identifie un enregistrement par `externalRecordingId` égal au `recordingId` mobile. Le serveur sérialise les synchronisations mobiles, réutilise le cours existant, déduplique l’index audio et conserve les champs déjà présents quand une reprise arrive sans la pièce correspondante. Les photos utilisent leur identifiant mobile ; sans identifiant, leur empreinte de contenu devient l’identifiant stable.

Un chapitre n’est accepté que si son `chapterId` existe dans `chapter-definitions.json` et appartient à la matière. Le numéro du cours est alloué côté serveur parmi les cours du chapitre ; le stockage historique conserve `partLabel: Phase N`, mais l’interface présente ce repère comme `Séance n°N`. Un libellé manuel est converti en `Partie N` ou `Parties N à M`, et une portée et un libellé incohérents sont refusés. Le numéro de séance et la portée de contenu restent deux champs distincts.

## États persistés

La transcription conserve `transcriptionState`, `transcriptionAttempts`, `transcriptionLastAttemptAt`, `transcriptionNextAttemptAt`, `transcriptionError` et `transcriptionRetryable`. L’automatisation de synthèse Gemini conserve les équivalents `automationState`, `automationAttempts`, `automationLastAttemptAt`, `automationNextAttemptAt`, `automationError` et `automationRetryable`.

Whisper et Gemini réessaient les erreurs temporaires avec un backoff exponentiel borné (60 secondes à 30 minutes par défaut). Une source invalide, une transcription désactivée ou une sortie explicitement insuffisante reste bloquée avec un état explicite. Une tentative interrompue depuis plus de 30 minutes est remise dans l’état en attente au prochain scan.

## Contrat des fonctions avancées

Les routes ci-dessous constituent le contrat entre les clients web/mobile et le serveur pour les fonctions avancées. Les corps sont JSON sauf l’audio, transmis en `multipart/form-data` ou encodé suivant le client. Les réponses n’autorisent jamais le client à injecter du contenu de cours : le serveur vérifie toujours le cours, la portée et les sources locales.

### `POST /api/audio/transcribe`

Transcrit localement une réponse orale avec Whisper configuré sur le Mac. Requête JSON : `audioBase64`, `mimeType`, et facultativement `courseId` et `kind` (`recall`, `exam` ou `recording`). Réponse :

```json
{
  "transcript": "…",
  "text": "…",
  "engine": "whisper-local",
  "filename": "recall-….m4a"
}
```

La route retourne une erreur explicite plutôt qu’un texte inventé lorsque Whisper ou ffmpeg ne sont pas configurés, ou lorsque l’audio est inexploitable.

### `POST /api/study-courses/:courseId/transcript-sections/propose`

Propose des sections à partir de la transcription enregistrée d’un cours. Le corps peut être vide. Réponse :

```json
{
  "transcriptSections": [
    {
      "id": "proposal-01",
      "title": "…",
      "startOffsetMs": 780000,
      "endOffsetMs": 1180000,
      "partStart": 1,
      "partEnd": 1,
      "timingEstimated": true,
      "status": "proposed"
    }
  ]
}
```

La réponse expose aussi l’alias `sections` pour les anciens clients. La proposition est enregistrée avec `status: "proposed"`, mais elle ne restreint aucune correction tant que l’utilisateur ne l’a pas renvoyée par `PATCH /api/study-courses/:courseId` avec `status: "validated"`. Sans durée audio fiable, `timingEstimated: true` reste visible.

### `GET /api/learning-insights`

Accepte un `courseId` facultatif et renvoie les erreurs récurrentes actives ainsi que la progression première/dernière explication. Sans filtre, le tableau de bord reçoit l’ensemble des cours.

```json
{
  "recurringErrors": [
    { "label": "…", "count": 3, "lastSeen": "…", "courseIds": ["…"], "active": true }
  ],
  "progression": [{
    "courseId": "…",
    "first": { "createdAt": "…", "score": 0.4 },
    "latest": { "createdAt": "…", "score": 0.8 },
    "delta": 0.4
  }]
}
```

Les valeurs de couverture sont des indicateurs de séance, jamais une nouvelle source pédagogique. Les réponses de portées différentes doivent être séparées.

### `POST /api/adaptive-session`

Compose une séance sans persister de révision. Requête : `minutes` (entre 3 et 240), filtres optionnels `subjectId`, `chapterId`, `chapterIds`, `courseIds`, `examId`, et `mode: "oral-exam"` pour ne retenir que les questions ouvertes existantes. Réponse :

```json
{
  "requestedMinutes": 15,
  "estimatedMinutes": 14,
  "items": [
    { "type": "card", "courseId": "…", "cardId": "…", "estimatedMinutes": 2, "rationale": "révision due" }
  ],
  "cardIds": ["…"],
  "courseIds": ["…"]
}
```

Chaque item porte son motif et ne référence qu’un contenu prêt dans le périmètre demandé. Une liste vide est un résultat valide et n’invente aucune question.

### `/api/exams`

`POST /api/exams` crée un objectif de partiel : `title` facultatif, `date`, `subjectId`, `chapterIds` et `minutesPerDay`. Le serveur refuse une date passée et vérifie la matière ainsi que l’appartenance des chapitres. `GET` liste les objectifs, `GET /:examId` retourne le détail, `PATCH /:examId` le modifie et `DELETE /:examId` le supprime.

```json
{
  "id": "exam-…",
  "title": "Partiel de biologie",
  "date": "2026-09-30",
  "chapterIds": ["…"],
  "minutesPerDay": 20,
  "planning": [{ "date": "2026-09-20", "courseIds": ["…"], "minutes": 20 }]
}
```

Le plan est calculé à partir des cours et faiblesses existants ; il ne crée pas de contenu et ne remplace pas le planning normal. L’alias `plan` est également renvoyé pour les anciens clients.
