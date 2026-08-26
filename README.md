# Cours — BioMIA Revision OS

Plateforme locale d'apprentissage, d'enregistrement d'amphi et de révision active pour la licence BioMIA L1 (Biologie, Mathématiques, Informatique et Applications).

---

## Principes Fondamentaux

- **Vérité terrain & sources conservées** : Les transcriptions textuelles (`data/transcriptions/`) et les enregistrements audio bruts (`data/enregistrements/`) sont préservés fidèlement sans altération.
- **Sas de Rappel Actif initial** : À la création d'un cours, la fiche de synthèse reste verrouillée jusqu'à ce que l'étudiant effectue son premier rappel libre (oral ou écrit) sans aide.
- **Répétition espacée FSRS-5** : Algorithme scientifique calculant la stabilité de la mémoire, la difficulté et la probabilité de rétention pour optimiser les révisions de flashcards et QCM.
- **Correction diagnostique IA grounded** : Évaluation concept par concept par **Gemini 3.7 Flash** (score sur 100, concepts maîtrisés/partiels/manquants/erronés, explication pédagogique et réponse idéale).
- **Transcription locale Metal** : Traitement audio local gratuit et illimité sur Mac avec **Whisper.cpp** et accélération GPU Metal (`models/whisper/ggml-large-v3-turbo-q5_0.bin`).

## Le Contrat Méthodologique en 6 Étapes

Le système repose sur un flux de travail rigoureux et sans friction entre ton smartphone, ton Mac et Antigravity :

1. **📱 1. Capture en amphi** : Sur ton Pixel 8 ou Mac, micro en 1 clic, balises rapides (*Important, Pas compris, Piège, Définition*) et photos du tableau synchronisées (`offsetMs`).
   * **Bilan de fin d'amphi** : Vérification des balises, suppression des photos floues et validation sereine avant synchronisation.
2. **🧠 2. Antigravity compile** : Whisper Metal transcrit en local (0 coût). Antigravity extrait les concepts atomiques, les analogies Feynman, les tableaux comparatifs « X vs Y » et ancre les photos et repères d'incompréhension exactement là où le professeur en parlait.
3. **🔒 3. Cours verrouillé dans l'App** : Pour briser l'illusion de facilité de la simple relecture passive, la fiche reste verrouillée jusqu'à ta première restitution.
4. **🎙️ 4. Rappel à froid (1-2 min)** : Tu dictes ou saisis tout ce dont tu te souviens sans regarder ton cours. C'est cet effort de rappel actif qui ancre durablement la mémoire.
5. **📊 5. Diagnostic IA & Déblocage** : La fiche se débloque. Les notions oubliées sont immédiatement injectées en priorité dans ton planning FSRS de révision du lendemain.
6. **⚡ 6. FSRS quotidien sans chrono** : Chaque jour, écoule ta pile de cartes dues du jour à ton rythme, sans compte à rebours stressant.
7. **🌳 7. Mémoire Vivante des Questions** : Quand tu bloques sur un concept, Antigravity se rappelle de tes questions passées, fait progresser le raisonnement et crée une flashcard FSRS d'ancrage.

---

## Organisation du Travail

`Matière → Chapitre → Séance de cours` est la hiérarchie de référence :
- **Matière** (ex. *Chimie 1, Biologie Cellulaire, Mathématiques Avancées 1*).
- **Chapitre** : Thème pérenne regroupant plusieurs séances (ex. *Structure des biomolécules, Atomistique*).
- **Séance** : Chaque enregistrement rattaché à un chapitre devient automatiquement la Séance n°1, n°2, n°3...
- **Portée (`partScope`)** : Délimite précisément les parties de contenu évaluées afin de ne jamais pénaliser l'étudiant sur des notions non encore abordées.

---

## Lancer l'Application

### Option 1 : Application Native macOS (Recommandé)
Double-cliquez sur **Cours** dans le dossier **Applications** (ou via Spotlight / Launchpad / Dock). L'application se lance instantanément, démarre automatiquement le serveur local en tâche de fond si nécessaire, et gère nativement le microphone.

### Option 2 : Ligne de commande
```bash
cd "/Users/ewilien/Documents/Code/BioMIA Revision OS"
node start.mjs
```
Puis ouvrez [http://localhost:3002](http://localhost:3002).

---

## Utilisation Mobile (Pixel 8 / Android / iOS)

L'application mobile partage le même design system sombre zinc et 100% des fonctionnalités du Mac :

1. **Sur le même Wi-Fi** :
   ```bash
   BIOMIA_HOST=0.0.0.0 node start.mjs
   ```
   Ouvrez `http://<adresse-ip-du-mac>:3002` sur votre smartphone.

2. **En 4G / Extérieur via Tailscale (VPN privé gratuit)** :
   ```bash
   tailscale serve --bg http://127.0.0.1:3002
   ```
   Renseignez l'URL HTTPS privée dans `apps/mobile/` et lancez l'application mobile Expo.

---

## Pipeline d'Automatisation (Audio → Transcription → Synthèse IA)

1. Déposez vos enregistrements ou fichiers textes dans `inbox/` (ex. `inbox/chimie-1/2026-09-09__cours-01.m4a`).
2. `automation.mjs` convertit l'audio en WAV, lance **Whisper.cpp Metal**, écrit la transcription dans `data/transcriptions/`.
3. **Gemini 3.7 Flash** génère la fiche de synthèse structurée (`data/cours/`), les cartes de révision (`data/cours/index.json`) et les tests de chapitre (`data/cours/chapters.json`).
4. Le cours apparaît dans l'application prêt pour le premier rappel actif.

### Commandes d'automatisation :
```bash
# Vérifier la configuration
node automation.mjs --check

# Lancer en mode simulation (Dry-Run)
BIOMIA_AUTOMATION_DRY_RUN=1 node automation.mjs
```

---

## Architecture & Documentation Technique

- [docs/adr/](docs/adr/) : Architecture Decision Records (Stack unifiée, Moteur IA Gemini, FSRS-5, Apps natives).
- [WORKFLOW_AUTOMATION.md](WORKFLOW_AUTOMATION.md) : Contrat d'automatisation et pipeline complet.
- [docs/advanced-learning-features.md](docs/advanced-learning-features.md) : Spécifications des fonctions d'apprentissage avancé.
- [docs/learning-engine.md](docs/learning-engine.md) : Spécifications du moteur FSRS-5 et du calcul des plannings.
- [docs/backend-automation.md](docs/backend-automation.md) : Contrat d'API REST backend.
