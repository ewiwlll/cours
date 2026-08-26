# ADR 0002 : Moteur IA Gemini et Transcription Locale Whisper.cpp

## Statut
Accepté

## Contexte
Le traitement automatique des cours universitaires implique deux opérations lourdes :
1. La transcription de longs fichiers audio d'amphi (jusqu'à 2 heures par séance) et de réponses orales lors des révisions.
2. L'analyse pédagogique, la structuration en fiches et cartes d'entraînement, et la correction diagnostique grounded sans hallucination.

L'utilisation de services tiers payants par abonnement externe ou par token audio augmentait la complexité et les coûts.

## Décision
1. **Transcription audio locale avec Whisper.cpp & Metal** :
   - Déploiement local de `whisper-cli` avec le modèle multilingue français `ggml-large-v3-turbo-q5_0.bin`.
   - Utilisation de l'accélération matérielle Apple Silicon (GPU/Metal) via `ffmpeg` pour convertir l'audio en WAV 16kHz mono et lancer Whisper localement.
   - Zéro dépendance API externe et zéro coût pour le traitement de l'audio.
2. **Génération & Correction IA avec l'API Gemini** :
   - Utilisation de **Gemini 3.7 Flash** (`gemini-3.7-flash`), modèle ultra-rapide doté de fortes capacités de raisonnement et de fidélité aux sources.
   - Utilisation systématique du mode JSON structuré (`responseSchema` avec `RECALL_EVALUATION_SCHEMA`, `CARDS_GENERATION_SCHEMA`, `CHAPTER_TEST_SCHEMA`).
   - Règle de non-hallucination : tout fait non présent dans la transcription ou la fiche source est exclu ou explicitement étiqueté « À VÉRIFIER ».

## Conséquences
- Confidentialité totale et exécution locale rapide pour l'audio.
- Évaluations pédagogiques objectives, précises et reproductibles.
