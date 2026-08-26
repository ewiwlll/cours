# Automatisation Cours (BioMIA Revision OS)

Le dossier surveillé est configuré dans `config.json` avec `inboxPath`.

### Organisation recommandée de l'Inbox :

```text
inbox/
├── mathematiques-avancees-1/
│   └── 2026-09-08__cours-01.txt
├── chimie-1/
│   └── 2026-09-09__chapitre-01.txt
└── biologie-cellulaire-genetique/
    └── 2026-09-10__cours-01.txt
```

Le sous-dossier permet de déduire automatiquement la matière. La date est déduite du nom du fichier ou de sa date de modification.

Le traitement automatique utilise **Whisper.cpp Metal** pour la transcription locale et **Gemini 3.7 Flash** pour la génération structurée des fiches et des cartes.

### Tester sans consommer l'API :
```bash
BIOMIA_AUTOMATION_DRY_RUN=1 node automation.mjs
```

### Vérifier la configuration :
```bash
node automation.mjs --check
```
