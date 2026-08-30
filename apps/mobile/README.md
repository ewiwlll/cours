# Cours Mobile (Application & PWA)

Application mobile compagnon de **Cours (Revision OS)** pour Android et iOS. Elle partage 100% du design system sombre zinc et des fonctionnalités d'apprentissage du Mac.

---

## 1. Deux Modes d'Utilisation Mobile

### Mode A : PWA Universelle (Recommandé pour tous, 0 configuration)
Ouvrez simplement **[https://cours-awc.pages.dev](https://cours-awc.pages.dev)** sur Safari (iOS) ou Chrome (Android) :
- **iPhone / iPad** : Bouton *Partager* $\rightarrow$ *« Sur l'écran d'accueil »*.
- **Android** : Cliquez sur *« Installer l'application »*.
- Fonctionne en plein écran, avec WakeLock anti-veille en amphi et révisions 100% hors-ligne.

### Mode B : Application Native Expo / Android (Pixel 8)
Pour installer ou tester l'application native :
```sh
cd apps/mobile
npm install
EXPO_PUBLIC_BIOMIA_API_URL=http://192.168.1.54:3002 npm run dev
```

Installation directe sur votre téléphone Android via ADB sans fil :
```sh
adb connect 192.168.1.12:44155
adb install -r -d android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 2. Fonctionnalités Clés Embarquées

- **Studio Amphi Micro** : Capture audio locale avec balises en direct (*Important, Pas compris, Piège, Définition*) et photos du tableau avec timestamp exact (`offsetMs`).
- **Sas de Rappel Actif** : Restitution vocale ou écrite pour débloquer les fiches verrouillées avec note diagnostique sur 100%.
- **Entraînement FSRS-5 & Fil d'Ariane MOC** : Navigation fluide dans la pile du jour, visualisant toujours `Matière › Chapitre › Cours`.
- **Mode Priorité aux Faiblesses** : Tri automatique des notions et chapitres avec une maîtrise $< 75\%$.
- **Planificateur & Calendrier** : Filtres 7j, 15j, 1 mois et projection de charge jusqu'à l'examen.
- **Mode Hors-Ligne Résilient** : Sauvegarde locale dans le stockage sécurisé et synchronisation automatique au retour du réseau Wi-Fi/4G.

