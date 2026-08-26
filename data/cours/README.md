# Fiches & Cartes de Cours

Ce dossier stocke les fiches structurées en Markdown (`.md`), les photos de tableau (`photos/`) et l'index central des cours révisables (`index.json`).

### Structure d'une entrée dans `index.json` :

```json
{
  "id": "2026-09-15-chimie-atomistique",
  "title": "Chimie 1 — Atomistique — cours du 15 septembre",
  "subjectId": "s1-chimie-1",
  "date": "2026-09-15",
  "kind": "chapitre",
  "status": "ready",
  "transcriptionFilename": "2026-09-15__chimie-1__recorder.txt",
  "summaryFilename": "2026-09-15-chimie-atomistique.md",
  "cards": [
    {
      "id": "2026-09-15-chimie-atomistique-01",
      "question": "Expliquer le modèle de Bohr et ses limites",
      "answer": "...",
      "kind": "expliquer",
      "source": "transcription, 00:12:30",
      "difficulty": 3,
      "keywords": ["spectre d'émission", "niveaux discrets d'énergie", "effet Zeeman"]
    }
  ]
}
```

### Sas de Rappel Actif & Champs Avancés :
- Tout nouveau cours reste verrouillé jusqu'à ce que l'étudiant réalise sa première tentative de rappel libre (écrite ou orale).
- Les champs multimédia (`audioDurationMs`, `recordingMarkers`, `transcriptSections`, `photos[].offsetMs`) conservent l'exactitude temporelle par rapport à l'audio d'origine.
