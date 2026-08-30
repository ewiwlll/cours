# Moteur d’Apprentissage Scientifique & FSRS-5

Le serveur et le module `learning-engine.mjs` constituent la source de vérité pour la planification des révisions, le calcul de la mémoire espacée FSRS-5, l'ancrage contextuel MOC et la hiérarchisation adaptative des priorités d'examen.

---

## 1. Moteur Mathématique FSRS-5 (Free Spaced Repetition Scheduler v5)

L'application implémente fidèlement le standard **FSRS-5** avec calcul adaptatif de la mémoire en trois variables fondamentales :
- **Stabilité ($S$)** : Durée en jours pendant laquelle le souvenir reste au-dessus du seuil de rétention cible.
- **Difficulté ($D$)** : Score intrinsèque de la carte (borné entre 1.0 et 10.0), ajusté avec retour vers la moyenne.
- **Probabilité de Rétention ($R(t)$)** : Décroissance de la mémoire en fonction du temps $t$ écoulé depuis la dernière révision :

$$R(t) = \left(1 + \text{FACTOR} \cdot \frac{t}{S}\right)^{\text{POWER}}$$

*(avec $\text{FACTOR} = 0.19$ et $\text{POWER} = -0.5$)*

### 1.1 Initialisation selon la Note Diagnostique ($S_0, D_0$)
Pour une première révision avec note $G \in \{1, 2, 3, 4\}$ :
- $G = 1$ (*Again*) : $S_0 = 0.4$ jour, $D_0 = 7.0$
- $G = 2$ (*Hard*) : $S_0 = 1.2$ jour, $D_0 = 5.8$
- $G = 3$ (*Good*) : $S_0 = 3.2$ jours, $D_0 = 4.6$
- $G = 4$ (*Easy*) : $S_0 = 8.0$ jours, $D_0 = 3.0$

### 1.2 Évolution de la Difficulté & de la Stabilité
- **Mise à jour de la difficulté** : $D' = D - w_6 \cdot (G - 3)$, amortie avec retour vers la moyenne :
  $$D_{\text{new}} = w_7 \cdot D_0(3) + (1 - w_7) \cdot D' \quad (\text{bornée entre } 1.0 \text{ et } 10.0)$$
- **Mise à jour de la stabilité après rappel réussi ($G \ge 2$)** :
  $$S_{\text{new}} = S \cdot \left(1 + e^{w_8} \cdot (11 - D) \cdot S^{-w_9} \cdot (e^{w_{10} \cdot (1 - R)} - 1)\right)$$
- **Mise à jour de la stabilité après échec ($G = 1$, Lapse)** :
  $$S_{\text{new}} = \min\left(w_{11} \cdot D^{-w_{12}} \cdot \left((S + 1)^{w_{13}} - 1\right) \cdot e^{w_{14} \cdot (1 - R)}, \; S\right)$$

---

## 2. Calage Initial par Sas de Rappel (*Cold Recall Seeding*)

Lorsqu'un cours est déverrouillé par le premier rappel actif :
1. L'évaluation grounded attribue une note $M \in [0, 100]$.
2. Les flashcards du cours sont automatiquement initialisées (*seeded*) :
   - $M \ge 80\%$ : Cartes calibrées en *Easy* ($G=4$, intervalle $7\text{j}+$).
   - $60\% \le M < 80\%$ : Cartes calibrées en *Good* ($G=3$, intervalle $3\text{j}$).
   - $40\% \le M < 60\%$ : Cartes calibrées en *Hard* ($G=2$, intervalle $1\text{j}$).
   - $M < 40\%$ : Cartes calibrées en *Again* ($G=1$, intervalle $< 24\text{h}$).

---

## 3. Ancrage MOC & Cartes « Relier les Concepts »

Pour éviter l'émiettement des connaissances et l'effet de bachotage en silos :
- **Fil d'Ariane MOC** : Chaque flashcard porte son chemin hiérarchique strict (`Matière > Chapitre > Titre du cours`).
- **Cartes Causales (`kind: 'relier'`)** : Testent les relations de cause à effet et les mécanismes d'intégration système.
- **Révélation de la Chaîne Conceptuelle** : Affichage explicite du mécanisme à l'issue de la tentative pour ancrer le raisonnement logique.

---

## 4. Algorithme du « Mode Priorité aux Faiblesses »

Le tri de la file d'entraînement applique la formule de pondération suivante :

$$\text{PriorityScore} = (100 - \text{MasteryScore}) + 50 \cdot (\text{isWeak}) + 100 \cdot (\text{isLocked})$$

- Les cours non encore déverrouillés par rappel actif obtiennent une priorité de **150+ points** (tête de pile).
- Les chapitres et notions avec un taux de maîtrise $< 75\%$ ou ayant subi un échec récent (*lapse*) passent devant les notions maîtrisées.

---

## 5. Compression d'Horizon d'Examen (*Exam Horizon Compression*)

Lorsqu'une épreuve est programmée à une date $T_{\text{exam}}$ :
- Le calendrier prévisionnel (`/api/revision-calendar`) projette la charge sur $N$ jours avec filtres (`7j`, `15j`, `30j`, `📅 Date personnalisée`).
- Si l'intervalle nominal $I$ calculé par FSRS dépasse le temps restant avant l'examen ($D_{\text{left}}$), l'intervalle est comprimé :
  $$I_{\text{compressed}} = \max\left(1, \; \min(I, \; D_{\text{left}} - 3)\right)$$
- Cette compression garantit qu'aucune révision due ne « saute » par-dessus le jour de l'examen et assure un passage de consolidation à J-3 du partiel.

