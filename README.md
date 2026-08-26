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

## 🏗️ L'Arborescence & Hiérarchie Pédagogique d'un Cours (Pipeline Antigravity)

Chaque cours traité par Antigravity ne se résume pas à un simple résumé textuel. Il est décomposé selon une **hiérarchie cognitive atomique en 9 niveaux** :

```
🎙️ 0. Audio brut & Photos horodatées (offsetMs)
 └── 📝 1. Transcription locale Whisper Metal (0€ API)
      └── 🗺️ 2. MOC (Map of Content / Vue hélicoptère du chapitre)
           └── 💡 3. Concepts Atomiques & Analogies Feynman concrètes
                └── ⚖️ 4. Tableaux Comparatifs « X vs Y » (anti-confusion)
                     └── 📐 5. Formules, équations et bilans KaTeX
                          └── ⚠️ 6. Callouts de Pièges Fréquents d'Examen
                               └── 🔒 7. Grille d'Évaluation du Sas de Rappel Actif
                                    └── 🗂️ 8. Flashcards FSRS-5 & QCM diagnostiques
                                         └── 🌳 9. Arbre de Mémoire Vivante (clarifications.json)
```

### Le Rôle de Chaque Étage :
1. **Niveau 0 & 1 — Ingestion & Ancrage Temporel (`offsetMs`)** : L'audio original et les photos du tableau sont horodatés au millième de seconde près pour réécouter un passage précis.
2. **Niveau 2 — Le MOC (Map of Content)** : Découpage arborescent pour réduire la charge cognitive et visualiser la structure globale du chapitre.
3. **Niveau 3 — Concepts Atomiques & Technique Feynman** : Chaque notion abstraite est vulgarisée avec une analogie concrète du monde réel (*« Une feuille est une usine solaire miniature... »*).
4. **Niveau 4 — Tableaux Comparatifs « X vs Y »** : Mise en opposition systématique des notions qui se confondent aux partiels (*Phase photochimique vs Cycle de Calvin*, *Sève brute vs Sève élaborée*).
5. **Niveau 5 — Bilans Formels KaTeX** : Équations chimiques et formules mathématiques rigoureusement formalisées en LaTeX.
6. **Niveau 6 — Callouts Pièges d'Examen** : Anticipation des erreurs classiques où 80% des étudiants perdent des points.
7. **Niveau 7 — Sas de Rappel Actif** : Verrouillage obligatoire et préparation de la grille diagnostique (notions clés).
8. **Niveau 8 — Piles FSRS-5 & QCM** : Génération de flashcards atomiques calibrées selon la mémoire espacée.
9. **Niveau 9 — Mémoire Vivante (`clarifications.json`)** : Historique des doutes pour contextualiser les futures explications sans répéter les mêmes réponses.

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
