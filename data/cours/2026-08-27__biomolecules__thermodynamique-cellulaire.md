# Thermodynamique & Énergie Cellulaire : Enthalpie Libre \(\Delta G\) et Couplage ATP

> [!NOTE]
> 📌 **Carte d'Orientation Active (MOC)**
> Ce cours établit le principe physique universel qui régit toutes les réactions biochimiques de la cellule :
> 1. **Le critère de spontanéité** : L'enthalpie libre de Gibbs \(\Delta G\).
> 2. **L'équation fondamentale** reliant conditions cellulaires réelles et conditions standard \(\Delta G^\circ\).
> 3. **Le moteur universel** : Le couplage énergétique par hydrolyse de l'ATP.

---

## 1. Critère de Spontanéité : L'Enthalpie Libre de Gibbs \(\Delta G\)

Dans une cellule à température \(T\) et pression \(P\) constantes, la faisabilité d'une réaction chimique ne dépend pas uniquement de la libération de chaleur (\(\Delta H\)), mais de la variation d'énergie libre \(\Delta G\) :

\[\Delta G = \Delta H - T \Delta S\]

* \(\Delta G < 0\) : Réaction **exergonique** (spontanée, thermodynamiquement favorable).
* \(\Delta G = 0\) : Système à l'**équilibre chimique** (aucun travail utile ne peut être extrait).
* \(\Delta G > 0\) : Réaction **endergonique** (non spontanée, nécessite un apport d'énergie externe).

---

## 2. Tableau Comparatif « X vs Y » : Exergonique vs Endergonique

| Critère de Comparaison | Réaction Exergonique | Réaction Endergonique |
| :--- | :--- | :--- |
| **Signe de \(\Delta G\)** | \(\Delta G < 0\) (Négatif) | \(\Delta G > 0\) (Positif) |
| **Spontanéité** | Spontanée dans le sens direct | Non spontanée (spontanée en sens inverse) |
| **Bilan Énergétique** | Libère de l'énergie utilisable | Nécessite un apport d'énergie (consomme) |
| **Exemple Biologique** | Hydrolyse de l'ATP (\(\Delta G^\circ' = -30{,}5\text{ kJ/mol}\)) | Synthèse de protéines, phosphorylation du glucose |
| **Équilibre \(K_{eq}\)** | Favorise la formation des produits (\(K_{eq} > 1\)) | Favorise les réactifs (\(K_{eq} < 1\)) |

---

## 3. L'Équation Fondamentale en Milieu Cellulaire

La valeur réelle de \(\Delta G\) dans le cytoplasme dépend des concentrations effectives des réactifs \([R]\) et des produits \([P]\) :

\[\Delta G = \Delta G^\circ' + RT \ln\left(\frac{[P]}{[R]}\right)\]

Où :
* \(\Delta G^\circ'\) : Énergie libre standard transformée (\(pH = 7{,}0\), \(T = 298\text{ K}\), \(1\text{ atm}\)).
* \(R = 8{,}314\text{ J}\cdot\text{mol}^{-1}\cdot\text{K}^{-1}\) : Constante des gaz parfaits.
* \(T\) : Température absolue en Kelvin (\(\text{K}\)).

À l'équilibre (\(\Delta G = 0\) et \(\frac{[P]}{[R]} = K_{eq}\)) :

\[\Delta G^\circ' = -RT \ln(K_{eq})\]

> [!WARNING]
> ⚠️ **PIÈGE D'EXAMEN CRITIQUE : Ne pas confondre \(\Delta G\) et \(\Delta G^\circ'\)**
> * \(\Delta G^\circ'\) est une **constante thermodynamique intrinsèque** tabulée.
> * \(\Delta G\) est une **variable dynamique réelle** qui change à chaque seconde selon les concentrations cytosoliques. Une réaction avec \(\Delta G^\circ' > 0\) peut tout à fait devenir spontanée (\(\Delta G < 0\)) si la cellule maintient un quotient réactionnel \(\frac{[P]}{[R]}\) très faible !

---

## 4. Le Couplage Énergétique par l'ATP

Une réaction endergonique impossible seule (\(\Delta G_1 > 0\)) est rendue spontanée en la couplant mécaniquement à une réaction fortement exergonique (\(\Delta G_2 \ll 0\)) :

\[\Delta G_{\text{global}} = \Delta G_1 + \Delta G_2 < 0\]

### Exemple canonique : Phosphorylation du Glucose
1. \(\text{Glucose} + \text{P}_i \rightarrow \text{Glucose-6-P} + \text{H}_2\text{O}\) \quad (\(\Delta G_1^\circ' = +13{,}8\text{ kJ/mol}\) — *Impossible*)
2. \(\text{ATP} + \text{H}_2\text{O} \rightarrow \text{ADP} + \text{P}_i\) \quad (\(\Delta G_2^\circ' = -30{,}5\text{ kJ/mol}\) — *Très favorable*)

**Réaction couplée catalysée par l'Hexokinase** :
\[\text{Glucose} + \text{ATP} \rightarrow \text{Glucose-6-P} + \text{ADP} \quad (\Delta G_{\text{global}}^\circ' = -16{,}7\text{ kJ/mol} < 0)\]

