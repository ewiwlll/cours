# Enregistrements Audio

Ce dossier reçoit les enregistrements audio synchronisés depuis les applications mobile et macOS.

### Structure :
- `index.json` : Index des enregistrements bruts, durées (`audioDurationMs`) et métadonnées.
- Fichiers `.m4a` / `.wav` originaux conservés pour l'écoute, le rejeu et la transcription locale Whisper.
- Les balises posées en direct (`recordingMarkers`) contiennent un `offsetMs` précis par rapport au début du fichier audio.
