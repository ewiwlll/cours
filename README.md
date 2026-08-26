# Cours — Revision OS

[![Site Web](https://img.shields.io/badge/Site_Web-cours--awc.pages.dev-blue?style=flat-square)](https://cours-awc.pages.dev)
[![Licence MIT](https://img.shields.io/badge/Licence-MIT-emerald?style=flat-square)](LICENSE)
[![FSRS-5](https://img.shields.io/badge/Moteur-FSRS--5-amber?style=flat-square)](docs/learning-engine.md)
[![Whisper Metal](https://img.shields.io/badge/Voix-Whisper_Metal_Local-cyan?style=flat-square)](docs/adr/0002-moteur-ia-gemini-et-transcription-whisper.md)

> **Pour tous vos cours, amphis et classes.**  
> Enregistrez en 1 clic et concentrez-vous sans le stress d'oublier de prendre des notes : la transcription locale s'occupe de tout capturer. Votre unique mission pendant le cours : **visualiser les concepts dans votre tête** et **être constant**.

---

## ⚡ Installation Rapide en 1 Ligne (macOS & Linux)

```bash
curl -fsSL https://cours-awc.pages.dev/install.sh | bash
```

---

## Principes Fondamentaux

- **Libération de la charge mentale en cours** : Vous n'avez plus besoin de recopier frénétiquement chaque slide. Vous écoutez le professeur, vous visualisez mentalement les mécanismes et vous posez des balises rapides (*Important, Pas compris, Piège, Définition*).
- **Vérité terrain & sources conservées** : Les transcriptions textuelles (`data/transcriptions/`) et les enregistrements audio bruts (`data/enregistrements/`) sont préservés fidèlement sans altération.
- **Sas de Rappel Actif initial** : À la création d'un cours, la fiche de synthèse reste volontairement verrouillée jusqu'à ce que l'étudiant effectue son premier rappel libre (oral ou écrit) sans aide.
- **Répétition espacée FSRS-5 sans chrono** : Algorithme scientifique calculant la stabilité de la mémoire, la difficulté et la probabilité de rétention pour optimiser les révisions de flashcards et QCM sans stress de temps.
- **Correction diagnostique IA grounded** : Évaluation concept par concept par **Gemini** (score sur 100, concepts maîtrisés/partiels/manquants/erronés, explication pédagogique et réponse idéale).
- **Transcription locale Metal** : Traitement audio local gratuit et illimité sur Mac avec **Whisper.cpp** et accélération GPU Metal (`models/whisper/ggml-large-v3-turbo-q5_0.bin`).

---

## Le Contrat Méthodologique Universel

Le système repose sur un flux de travail rigoureux et sans friction entre votre smartphone, votre Mac et Antigravity :

1. **📱 1. Capture en amphi / classe** : Sur votre smartphone ou Mac, micro en 1 clic, balises rapides (*Important, Pas compris, Piège, Définition*) et photos du tableau synchronisées (`offsetMs`).
   * **Bilan de fin d'amphi** : Vérification des balises, suppression des photos floues et validation sereine avant synchronisation.
2. **🧠 2. Antigravity compile** : Whisper Metal transcrit en local (0 coût). Antigravity extrait les concepts atomiques, les analogies Feynman, les tableaux comparatifs « X vs Y » et ancre les photos et repères d'incompréhension exactement là où le professeur en parlait.
3. **🔒 3. Cours verrouillé dans l'App** : Pour briser l'illusion de facilité de la simple relecture passive, la fiche reste verrouillée jusqu'à votre première restitution.
4. **🎙️ 4. Rappel à froid (1-2 min)** : Vous dictez ou saisissez tout ce dont vous vous souvenez sans regarder votre cours. C'est cet effort de rappel actif qui ancre durablement la mémoire.
5. **📊 5. Diagnostic IA & Déblocage** : La fiche se débloque. Les notions oubliées sont immédiatement injectées en priorité dans votre planning FSRS de révision du lendemain.
6. **⚡ 6. FSRS quotidien sans chrono** : Chaque jour, écoulez votre pile de cartes dues du jour à votre rythme, sans compte à rebours stressant.
7. **🌳 7. Mémoire Vivante des Questions** : Quand vous bloquez sur un concept, Antigravity se rappelle de vos questions passées, fait progresser le raisonnement et crée une flashcard FSRS d'ancrage.

---

## Organisation du Travail

`Matière → Chapitre → Séance de cours` est la hiérarchie universelle :
- **Matière** (ex. *Biologie, Droit Constitutionnel, Mathématiques, Histoire, Physique, Économie...*).
- **Chapitre** : Thème pérenne regroupant plusieurs séances.
- **Séance** : Chaque enregistrement rattaché à un chapitre devient automatiquement la Séance n°1, n°2, n°3...
- **Portée (`partScope`)** : Délimite précisément les parties de contenu évaluées afin de ne jamais pénaliser l'étudiant sur des notions non encore abordées.

---

## Lancer l'Application

### Option 1 : Application Native macOS (Recommandé)
Double-cliquez sur **Cours** dans le dossier **Applications** (ou via Spotlight / Launchpad / Dock). L'application se lance instantanément, démarre automatiquement le serveur local en tâche de fond si nécessaire, et gère nativement le microphone.

### Option 2 : Ligne de commande
```bash
cd cours
node start.mjs
```
Puis ouvrez [http://localhost:3002](http://localhost:3002).

---

## Utilisation Mobile (Android / iOS / Pixel)

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
   Renseignez l'URL HTTPS privée dans `apps/mobile/` et lancez l'application mobile.

---

## Architecture & Documentation Technique

- [docs/adr/](docs/adr/) : Architecture Decision Records (Stack unifiée, Moteur IA Gemini, FSRS-5, Apps natives).
- [WORKFLOW_AUTOMATION.md](WORKFLOW_AUTOMATION.md) : Contrat d'automatisation et pipeline complet.
- [docs/advanced-learning-features.md](docs/advanced-learning-features.md) : Spécifications des fonctions d'apprentissage avancé.
- [docs/learning-engine.md](docs/learning-engine.md) : Spécifications du moteur FSRS-5 et du calcul des plannings.
- [docs/backend-automation.md](docs/backend-automation.md) : Contrat d'API REST backend.
