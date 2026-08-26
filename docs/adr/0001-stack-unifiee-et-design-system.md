# ADR 0001 : Stack Unifiée et Design System Sombre Zinc

## Statut
Accepté

## Contexte
Le projet **Cours** (BioMIA Revision OS) est une plateforme de révision et d'enregistrement de cours pour la licence BioMIA L1. Les utilisateurs révisent sur différentes interfaces : ordinateur portable Mac (en amphi, bureau) et smartphone Pixel 8 (transports, bibliothèque, déplacements).

Afin d'éviter la fragmentation de l'expérience utilisateur et les duplications de logique métier, une harmonisation stricte est nécessaire.

## Décision
1. **Design System Unique** :
   - Thème sombre fond zinc (`#09090b`, `#18181b`, `#27272a`).
   - Accents couleur sémantiques : Ambre/Orange pour le rappel actif et les priorités, Émeraude pour la maîtrise, Cyan pour l'entraînement/QCM, Rose/Rouge pour les pièges et erreurs.
   - Typographie soignée, composants visuels identiques (badges de statut, barres de progression de rétention, sélecteurs de matière).
2. **Architecture Web & Backend** :
   - Frontend Web : React 19 + TypeScript + Vite + Tailwind CSS (`web/`), compilé dans `public/`.
   - Backend : Serveur Node.js ESM natif sans surcharge de framework, servant à la fois l'API REST JSON (`/api/*`) et les fichiers statiques de l'application sur le port `3002`.
3. **Parité 100% Web / Mobile / Desktop** :
   - Toutes les fonctionnalités (rappel actif, entraînement FSRS-5, QCM, photos horodatées, examens oraux, planning partiel) sont présentes sur toutes les plateformes.

## Conséquences
- Zéro dérive visuelle ou fonctionnelle entre le Mac et le mobile.
- Maintenance simplifiée : un unique modèle de données dans `data/` partagé par tous les clients.
