# ADR 0004 : Applications Clientes macOS Swift et Mobile Expo

## Statut
Accepté

## Contexte
L'utilisation de simples onglets de navigateur présente des limites majeures pour une utilisation intensive :
- Risque de fermeture accidentelle de l'onglet pendant un enregistrement amphi de 2 heures.
- Gestion complexe des autorisations de microphone persistantes.
- Nécessité de lancer manuellement un terminal pour démarrer le serveur Node.js à chaque session.
- Absence d'icône d'application dédiée dans le Dock, Spotlight et le dossier Applications.

## Décision
1. **Application Native Desktop macOS (`/Applications/Cours.app`)** :
   - Application native compilée en Swift (`swiftc`) avec `AppKit` et `WKWebView`.
   - Gestion automatique du cycle de vie du serveur : vérification de l'état de `http://127.0.0.1:3002/` au lancement et démarrage en tâche de fond de `node start.mjs` si le serveur est inactif.
   - Accord natif des permissions micro (`WKUIDelegate.requestMediaCapturePermissionFor`) et déclaration dans `Info.plist`.
   - Fenêtre personnalisée avec barre de titre intégrée sans éléments superflus, respect du thème sombre zinc (`#09090b`), menus complets macOS (<kbd>Cmd+Q</kbd>, <kbd>Cmd+R</kbd>, <kbd>Cmd+Ctrl+F</kbd>) et icône Retina dédiée (`AppIcon.icns`).
2. **Application Mobile Android / iOS (`apps/mobile/`)** :
   - Développée avec React Native & Expo Router.
   - Module `expo-audio` pour capture audio haute fidélité résistant aux mises en veille et interruptions.
   - Synchronisation bidirectionnelle automatique avec le Mac (sur le réseau local ou via tunnel Tailscale privé).

## Conséquences
- Lancement immédiat en 1 clic pour l'utilisateur depuis son dossier Applications ou son Dock.
- Fiabilité totale des enregistrements en amphi et de l'expérience de rappel vocal.
