# Règles Agent — Projet Cours (Revision OS)

## Présentation & Vision du Projet

**Cours** (Revision OS) est une plateforme complète et autonome d'apprentissage, d'enregistrement d'amphi et de révision active pour tous les étudiants, universités et classes préparatoires.

L'application repose sur la science cognitive de la mémoire :
- **Récupération active obligatoire (Active Recall Testing)** : verrouillage de la fiche brute à la création du cours jusqu'à la première tentative d'explication sans aide.
- **Répétition espacée FSRS-5 (Free Spaced Repetition Scheduler v5)** : calcul scientifique de la stabilité de la mémoire, de la difficulté intrinsèque et de la probabilité de rétention pour optimiser les révisions de flashcards et QCM.
- **Correction diagnostique IA grounded** : analyse concept par concept basée uniquement sur la source (maîtrisé, partiel, manquant, erroné), note sur 100, explication pédagogique bienveillante et proposition de réponse modèle.
- **Enregistrement amphi & photos horodatées** : capture audio avec pose de balises rapides (*Important, Définition, Exemple, Piège*) et association temporelle des photos du tableau (`offsetMs`).

## Architecture du Workflow : Studio Antigravity & Cockpit Cours

Le projet repose sur une symbiose claire et sans friction entre deux rôles :

1. **Antigravity = Le Studio de Production & Super-Tuteur** *(sur ton Mac)* :
   - **Ingestion lourde & Intelligence** : Analyse des amphis (audio brut, transcriptions Whisper Metal, photos du tableau `offsetMs`, notes).
   - **Mémoire Vivante des Questions (`data/revisions/clarifications.json`)** : Maintien d'un arbre d'évolution des incompréhensions pour contextualiser les questions récurrentes, approfondir les explications et générer des cartes FSRS de déblocage.
   - **Compétences (Skills)** :
     - `process-course` (`.agents/skills/process-course/SKILL.md`) : Structure la fiche Markdown avec LaTeX KaTeX, tableaux comparatifs « X vs Y », ancre les photos et repères d'incompréhension (`offsetMs`), génère les flashcards FSRS et initialise le sas de rappel actif.
     - `oral-tutor` (`.agents/skills/oral-tutor/SKILL.md`) : Tuteur socratique posé sans chrono et interrogations personnalisées selon l'arbre des questions passées.
   - **Outil d'assistance** : `node scripts/course-helper.mjs` (commandes `pending`, `transcribe`, `validate`).

2. **L'Application Cours = Le Cockpit de Révision Quotidien** *(Mac, Web, Mobile Pixel 8)* :
   - **En amphi** : Enregistrement micro en 1 clic, balises rapides (*Important, Pas compris, Piège, Définition*), photos du tableau synchronisées (`offsetMs`) et **écran récapitulatif de fin d'amphi** pour valider/corriger les repères et supprimer les photos floues.
   - **Au quotidien** : Révisions FSRS de la pile de cartes dues du jour sans chrono stressant, QCM diagnostiques, consultation des fiches synthétiques.
   - **Sas de Rappel Actif** : Déblocage rapide de la fiche via une restitution orale/écrite de 1-2 minutes évaluée instantanément par rapport à la grille préparée par Antigravity.

---

## Modèles & Moteurs IA

- **Moteur d'évaluation & de génération IA** : **Gemini** (`gemini-3.7-flash` par défaut, configurable via `GEMINI_MODEL` et `GEMINI_API_KEY` dans `.env`).
- **Transcription audio locale** : **Whisper.cpp** avec accélération matérielle Apple Silicon Metal (`models/whisper/ggml-large-v3-turbo-q5_0.bin`), zéro coût API externe pour la voix.
- **Transcription web & mobile** : Reconnaissance vocale Web Speech API hors connexion sur navigateur compatible, et capture native haute fidélité via `expo-audio` sur mobile (Pixel 8).

---

## Fiabilité pédagogique & Non-hallucination

- **Vérité terrain** : Ne jamais inventer le contenu d'un cours, une transcription, une matière ou des données d'apprentissage.
- **Traçabilité stricte des sources** : Conserver systématiquement la transcription originale et les fichiers audio bruts. Distinguer strictement ce qui provient de la source originale, les explications ajoutées et les éléments à vérifier.
- **Précautions de validation** : Tout fait ou concept non attesté par la source brute doit être explicitement balisé « À VÉRIFIER ».
- **Correction constructive** : Toute évaluation ou correction doit expliquer *pourquoi* la réponse est correcte ou incorrecte par rapport aux notions clés (`keywords`), sans se limiter à donner la solution brute.
- **Périmètre de contenu (`partScope`)** : Respecter scrupuleusement la portée évaluée (ex. Séance 1, Parties 1 à 3) sans pénaliser l'étudiant sur des notions hors périmètre.

---

## Application — Unité & Parité Totale (Web, macOS, Mobile)

- L'application s'appelle **Cours** dans l'ensemble des interfaces utilisateur.
- **Une seule et même application** : la version Desktop macOS (`/Applications/Cours.app`), la version Web (navigateur) et la version Mobile (Pixel 8 / Expo) partagent le même design system, la même ergonomie et une parité fonctionnelle stricte à 100 %.
- **Design System Unifié** :
  - Thème sombre zinc profond (`#09090b`, `#18181b`, `#27272a`).
  - Accents couleur sémantiques :
    - **Ambre / Orange** (`#f59e0b`) : Rappel actif, cours à expliquer, points d'attention.
    - **Émeraude / Vert** (`#10b981`) : Notions maîtrisées, succès, rétention optimale.
    - **Cyan / Bleu** (`#06b6d4`) : Mode entraînement, révision libre, QCM.
    - **Rose / Rouge** (`#f43f5e`) : Pièges d'examen, erreurs récurrentes, notions manquantes.
  - Typographie nette, pilules de filtrage fluides, cartes soignées avec bordures subtiles et transitions fluides.
- **Parité Fonctionnelle Totale** :
  - **Enregistrement amphi** : Micro natif en 1 clic, balises rapides en direct (*Important, Exemple, Piège exam, Définition*), photos du tableau synchronisées (`offsetMs`) et notes textuelles.
  - **Sas de Rappel Actif initial** : Verrouillage obligatoire de la fiche à la création du cours jusqu'à ce que l'étudiant effectue son premier rappel (vocal ou écrit).
  - **Correction diagnostique IA** : Analyse détaillée des concepts (maîtrisés, partiels, manquants, erronés), note sur 100, explication pédagogique et modèle idéal.
  - **Moteur d'apprentissage FSRS-5** : Entraînement espacé par flashcards, QCM avec analyse de pièges, suivi de la rétention mémoire par matière et chapitre.
  - **Séances adaptatives & Mode Examen Oral** : Composition dynamique de séances chronométrées (5, 15, 30 min) et simulations d'oraux basées sur les faiblesses réelles.
  - **Planning rétroactif de partiel** : Calcul automatique d'un calendrier de montée en charge jusqu'à la date d'examen.

---

## Architecture Technique & Ports

- **Serveur Backend** : Node.js ESM (`server.mjs`, `automation.mjs`, `learning-engine.mjs`, `recall-correction.mjs`).
- **Port d'exécution** : `3002` (défini dans `.env` par `BIOMIA_PORT=3002`).
- **Client Desktop macOS** : Application native Swift AppKit / `WKWebView` (`/Applications/Cours.app`), gestion automatique du daemon serveur et permissions micro.
- **Client Web** : React 19 + TypeScript + Vite + Tailwind CSS (`web/`), servi statiquement depuis `public/`.
- **Client Mobile** : React Native + Expo Router (`apps/mobile/`), synchronisation temps réel Wi-Fi local ou tunnel privé Tailscale.

---

## Interaction Proactive avec l'Étudiant (Le Prompt Magique `cours`)

Pour que l'expérience soit ultra-simple pour n'importe quel étudiant sans compétences techniques :
- **Si l'utilisateur tape un mot simple** (`cours`, `fait tout`, `go`, `aide`, `start`, `interroge-moi`, `débloque`, ou n'importe quelle commande brève) :
  - **Ne jamais lui renvoyer de commandes compliquées**.
  - **1. Analyser immédiatement l'état du workspace** (ex. `node scripts/course-helper.mjs pending` ou inspection de `data/enregistrements/` et `data/cours/`).
  - **2. Afficher un bilan d'accueil chaleureux avec le statut réel** (ex. *« 4 enregistrements audio bruts détectés, 2 cours en attente de flashcards »*).
  - **3. Proposer un menu clair à 4 options guidées** :
    1. 🚀 **« Mode Fait Tout »** : Traiter automatiquement tous les enregistrements audio récents avec Whisper Metal, générer les fiches KaTeX avec tableaux « X vs Y », et créer la batterie de flashcards FSRS-5.
    2. 💡 **« Débloquer une Notion / un Cours »** :
       - L'agent liste directement les cours existants détectés dans `data/courses.json`.
       - L'agent demande où l'étudiant bloque.
       - L'agent explique la notion avec une **analogie concrète de Feynman** et des repères mnémotechniques.
       - L'agent **génère automatiquement la flashcard FSRS de déblocage** et l'ajoute dans `data/courses.json` et `data/revisions/clarifications.json`.
    3. 🎙️ **« Oral Blanc Bienveillant »** : Poser une question diagnostique posée sans chrono sur le chapitre de son choix, évaluer la restitution et encourager.
    4. 🔒 **« Valider le Sas de Rappel Actif »** : Évaluer la restitution d'un cours verrouillé pour en débloquer la fiche.
  - **Conclusion claire & encourageante** : Toujours conclure chaleureusement en disant que tout est prêt et qu'il n'y a plus qu'à ouvrir `/Applications/Cours.app` ou son smartphone pour réviser à son rythme (ex: *« Tout est prêt ! 🎉 Tu n'as plus qu'à ouvrir ton application Cours.app ou ton smartphone pour démarrer tes révisions, tu vas tout déchirer ! »*).

---

## Déploiement Cloudflare Pages & Dépôt GitHub

Pour tous les prochains agents et sessions travaillant sur ce projet :
- **Dépôt GitHub** : `https://github.com/ewiwlll/cours` (Branche `main`).
- **Projet Cloudflare Pages** :
  - `cours` (URL de production : `https://cours-awc.pages.dev`)
- **Documentation Publique** : `https://cours-awc.pages.dev/docs`
- **Procédure de validation et déploiement systématique** :
  1. `cd web && npm run build` (compile le Web React 19 et génère `public/`)
  2. `npx wrangler pages deploy landing --project-name cours --commit-dirty=true`
  3. `git add -A && git commit -m "..." && git push origin main`

---

## Validation & Qualité

- Avant toute modification de code, s'assurer que les builds passent :
  - Côté Web : `cd web && npm run build` (génère `public/`).
  - Tests unitaires backend : `node --test tests/learning-engine.test.mjs tests/recall-correction.test.mjs`.
  - Client macOS : compilation avec `swiftc -O -framework Cocoa -framework WebKit apps/macos/CoursApp.swift`.
- Préserver systématiquement les transcriptions existantes, les audios originaux et l'historique des séances dans `data/`.
- Vérifier les états vides, la gestion des erreurs et l'affichage responsive (grand écran et mobile).
