# Moteur d’apprentissage backend

Le serveur reste la source de vérité pour les cartes et les sessions de rappel.

## Rappels de cartes

POST /api/reviews accepte courseId ou, pour compatibilité, lessonId, ainsi que cardId et rating (1..4). Le serveur ignore tout planning fourni par le client et renvoie :

- Again (1) : 1 jour ;
- Difficile (2) : 2 jours ;
- Bon (3) : 4, 7, 14, 30, 60, 120, 180 jours ;
- Facile (4) : 7, 14, 30, 60, 120, 180, 240 jours.

Les séries de succès sont interrompues par Again ou Difficile. La réponse conserve lessonId et nextReview pour les clients existants et ajoute courseId, nextReviewAt, schedule et reviewCount.

## Faiblesses

POST /api/reviews et POST /api/revision-sessions conservent weakCardIds, weakConcepts et missing après nettoyage. Les anciennes entrées restent valides. GET /api/weaknesses agrège l’historique et ne renvoie par défaut que les faiblesses actives ; ?courseId= et ?cardId= filtrent les résultats.

Une notion est active si son dernier signal est partial, missing ou wrong. Une réussite explicite avec le même identifiant de concept la résout, sans effacer l’historique.

## Planning et interleaving

GET /api/planning?days=14&startDate=YYYY-MM-DD&subjectId=... renvoie toujours des journées groupées dans days. Chaque journée contient courses, cards, chapters et items. Les cartes portent targeted, weak, reviewCount et interleavingIndex.

Les cours sans session de rappel sont planifiés le premier jour (a_expliquer). Les cartes nouvelles ou en retard sont également ramenées au premier jour. Les cartes sont intercalées par matière quand plusieurs files sont disponibles. Les chapitres générés prêts sont inclus comme tests cumulatifs ; leur priorité augmente avec le nombre de cartes dues et de cartes faibles.

Le moteur ne génère aucun contenu pédagogique : il ne planifie que les cours, cartes et chapitres déjà validés présents dans les fichiers locaux.

## Rappel de cours et portée

Une séance `course-recall` suit le cycle rappel à blanc → correction sourcée → réexplication éventuelle → auto-évaluation. La note `Échec` programme le lendemain, `Moyen` dans 3 jours et les réussites suivent 7, 14, 30, 60, 120 puis 180 jours.

Le numéro automatique de séance ne représente pas une partie du contenu. Quand un cours porte un `partScope` (par exemple parties 1 à 3), la correction et l’entraînement filtrent cette portée et ne doivent jamais signaler comme oubli un élément extérieur. La clé de planification inclut cette portée afin de ne pas fusionner deux plages différentes d’un même chapitre.

## Rappels enrichis et priorités

Une réponse orale transcrite est une réponse de séance au même titre qu’une réponse écrite : elle peut alimenter les `weakConcepts`, mais ne devient pas une source de cours. Les erreurs sont considérées comme récurrentes uniquement lorsqu’elles sont observées dans plusieurs séances ; une réussite explicite les retire des priorités actives sans effacer le journal.

La comparaison de progression oppose la première et la dernière séance d’un même cours **et de la même portée**. Elle conserve les réponses d’origine et compare les indicateurs de couverture enregistrés, sans conclure à partir de contenu inventé.

Une séance adaptative est une vue calculée du moteur : elle classe les rappels jamais expliqués, les cartes dues, les erreurs récurrentes et les objectifs de partiel dans la durée demandée. Un planning rétroactif de partiel est également calculé ; ces deux calculs ne changent le planning permanent qu’après une action de l’utilisateur. Le contrat des routes concernées est décrit dans [backend-automation.md](backend-automation.md).
