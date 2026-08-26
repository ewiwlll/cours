# ADR 0003 : Moteur d'Apprentissage FSRS-5 et Sas de Rappel Actif

## Statut
Accepté

## Contexte
La simple relecture passive des cours produit une illusion de compétence sans rétention à long terme. Pour réussir en licence scientifique exigeante (BioMIA L1), l'application doit forcer l'effort de récupération en mémoire et espacer les rappels selon des modèles mathématiques validés.

## Décision
1. **Sas de Rappel Actif initial obligatoire** :
   - À la création d'un cours (enregistrement amphi ou import de texte), la fiche de synthèse complète et les cartes restent **verrouillées**.
   - L'étudiant doit réaliser son premier rappel à blanc (oral ou écrit) sans consulter le cours.
   - Ce n'est qu'après soumission de cette explication initiale que la fiche se déverrouille et que la correction diagnostique IA est générée.
2. **Algorithme de Répétition Espacée FSRS-5 (Free Spaced Repetition Scheduler v5)** :
   - Modélisation de la mémoire par deux composantes principales : Stabilité \(S\) (en jours) et Difficulté \(D\) (de 1 à 10).
   - Calcul dynamique de la rétention prédictive : \(R(t, S) = (1 + \text{factor} \times t / S)^{\text{power}}\).
   - Adaptation automatique des intervalles selon la note de révision : *Again (1), Hard (2), Good (3), Easy (4)*.
3. **Analyse Diagnostique & Erreurs Récurrentes** :
   - Évaluation concept par concept (`mastered`, `partial`, `missing`, `wrong`).
   - Suivi transversal des faiblesses par matière et chapitre dans `data/revisions/weak-concepts.json`.
   - Résolution automatique d'une faiblesse uniquement lors d'un succès explicite sur le concept ciblé.
4. **Séances Adaptatives & Planning Rétroactif de Partiel** :
   - Calcul de sessions sur mesure (5, 15, 30 min) combinant rappels dus, cartes faibles et questions de transfert.
   - Construction d'un rétro-planning optimisé pour les examens basé sur les dates cibles sans modifier le calendrier général de révision.

## Conséquences
- Efficacité d'apprentissage maximale basée sur les sciences cognitives.
- Suivi transparent et quantifiable des acquis de l'étudiant.
