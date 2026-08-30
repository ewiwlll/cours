# Cours — Revision OS

[![Site Web](https://img.shields.io/badge/Site_Web-cours--awc.pages.dev-blue?style=flat-square)](https://cours-awc.pages.dev)
[![Licence MIT](https://img.shields.io/badge/Licence-MIT-emerald?style=flat-square)](LICENSE)
[![FSRS-5](https://img.shields.io/badge/Moteur-FSRS--5-amber?style=flat-square)](docs/learning-engine.md)
[![PWA Universal](https://img.shields.io/badge/PWA-iOS_Android_Windows_Mac-purple?style=flat-square)](https://cours-awc.pages.dev/docs#universal-pwa)
[![Whisper Metal](https://img.shields.io/badge/Voix-Whisper_Metal_Local-cyan?style=flat-square)](docs/adr/0002-moteur-ia-gemini-et-transcription-whisper.md)

> **L'OS d'apprentissage et de révision active pour tous vos cours, amphis et classes.**  
> Enregistrez en 1 clic et concentrez-vous sans le stress d'oublier de prendre des notes : la transcription locale s'occupe de tout capturer. Votre unique mission pendant le cours : **visualiser les concepts dans votre tête** et **être constant**.

---

## ⚡ Installation Rapide en 1 Ligne (macOS & Linux)

```bash
curl -fsSL https://cours-awc.pages.dev/install.sh | bash
```

---

## 📱 Accès Immédiat Universel (PWA iOS Safari, Android, Windows & Mac)

Ouvrez simplement **[https://cours-awc.pages.dev](https://cours-awc.pages.dev)** sur n'importe quel appareil :
- 🍏 **iPhone / iPad** : Ouvrez Safari $\rightarrow$ bouton *Partager* $\rightarrow$ *« Sur l'écran d'accueil »*.
- 🤖 **Android (Pixel, Samsung)** : Ouvrez Chrome $\rightarrow$ cliquez sur *« Installer l'application »*.
- 🪟 **PC Windows / Linux** : Ouvrez Edge ou Chrome $\rightarrow$ icône *Installer* dans la barre d'adresse.
- 💻 **Mac** : Application native `/Applications/Cours.app` ou PWA Safari.

---

## 🧠 Principes Fondamentaux & Méthode Scientifique

- **Libération de la charge mentale en cours** : Vous n'avez plus besoin de recopier frénétiquement chaque slide. Vous écoutez le professeur, vous visualisez mentalement les mécanismes et vous posez des balises rapides (*Important, Pas compris, Piège, Définition*).
- **Protection Anti-Veille WakeLock API** : L'écran reste actif pendant l'enregistrement d'amphi pour garantir une capture audio continue sans interruption du système.
- **Vérité terrain & sources conservées** : Les transcriptions textuelles (`data/transcriptions/`) et les enregistrements audio bruts (`data/enregistrements/`) sont préservés fidèlement sans altération.
- **Sas de Rappel Actif initial (Active Recall Gating)** : À la création d'un cours, la fiche reste verrouillée jusqu'à la première restitution libre (orale ou écrite) de 1 à 2 minutes.
- **Évaluation Diagnostique Grounded Transparente** : Correction concept par concept basée strictement sur la source (`🟢 Maîtrisé`, `🟡 Partiel`, `🔴 Oublié/Confusion`) avec score sur 100%.
- **Calage FSRS Immédiat (*Cold Recall Seeding*)** : La note initiale règle directement la stabilité $S_0$ et la difficulté $D_0$ des flashcards pour un espacement sur-mesure.
- **Répétition espacée FSRS-5 sans chrono** : Algorithme mathématique d'avant-garde calculant la stabilité de la mémoire $S$, la difficulté intrinsèque $D$ et la probabilité de rétention $R$.
- **Fil d'Ariane MOC & Cartes « 🔗 Relier les Concepts »** : Fin de l'émiettement des connaissances grâce à l'ancrage systématique (`Matière > Chapitre > Cours`) et aux questions de liens causaux.
- **Mode Priorité aux Faiblesses** : L'algorithme priorise automatiquement les chapitres où la maîtrise est $< 75\%$ pour sécuriser vos points d'examen.
- **Planificateur d'Échéances Adaptatif** : Filtres d'horizon temporel (`7j`, `15j`, `1 mois`, `📅 Date personnalisée`) et compression automatique des révisions à l'approche des partiels.

---

## 🏗️ L'Arborescence & Hiérarchie Pédagogique d'un Cours (Pipeline Antigravity)

```
🎙️ 0. Audio brut & Photos horodatées (offsetMs)
 └── 🛡️ 1. Enregistrement protégé WakeLock sans coupure
      └── 📝 2. Transcription locale Whisper Metal (0€ API)
           └── 🗺️ 3. MOC (Map of Content / Vue hélicoptère du chapitre)
                └── 💡 4. Concepts Atomiques & Analogies Feynman concrètes
                     └── ⚖️ 5. Tableaux Comparatifs « X vs Y » (anti-confusion)
                          └── 📐 6. Formules, équations et bilans KaTeX
                               └── ⚠️ 7. Callouts de Pièges Fréquents d'Examen
                                    └── 🔒 8. Sas de Rappel Actif (Oral / Écrit)
                                         └── 🗂️ 9. Flashcards FSRS-5, Cartes Causalité & QCM
                                              └── 🌳 10. Arbre de Mémoire Vivante (clarifications.json)
```

---

## 🚀 Organisation & Lancement

### Ligne de commande universelle
```bash
cours         # Démarre le serveur local et ouvre le cockpit
cours update  # Met à jour les nouveautés depuis GitHub
```

### Architecture & Documentation Technique
- [Documentation Complète en Ligne](https://cours-awc.pages.dev/docs)
- [docs/learning-engine.md](docs/learning-engine.md) : Spécifications mathématiques du moteur FSRS-5 et du calcul des plannings.
- [docs/advanced-learning-features.md](docs/advanced-learning-features.md) : Spécifications des fonctions d'apprentissage avancé.
- [docs/backend-automation.md](docs/backend-automation.md) : Contrat d'API REST backend.
- [docs/adr/](docs/adr/) : Architecture Decision Records (Stack unifiée, PWA universelle, Moteur IA, FSRS-5).

