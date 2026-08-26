# Android — enregistrement et synchronisation

## Garantie avec expo-audio SDK 54

La configuration utilise le `AudioRecordingService` foreground fourni par
`expo-audio` avec `enableBackgroundRecording: true` et
`allowsBackgroundRecording: true`.

Pendant un enregistrement, Android peut donc conserver l’audio lorsque
l’application passe en arrière-plan. Le service affiche une notification
persistante. Taper la notification rouvre l’activité Cours, et l’action native
disponible dans cette pile est Arrêter.

Les actions Pause et Reprendre ne sont pas exposées par le service
`expo-audio` utilisé par cette version : son code natif construit la
notification avec une seule action `ACTION_STOP_RECORDING`. Elles restent
disponibles dans l’interface Cours et dans le mini-lecteur via
`AudioRecorder.pause()` et `AudioRecorder.record()`.

Ajouter une fausse action native dans un second service ne piloterait pas
fiablement l’instance `AudioRecorder` détenue par React Native. La solution
sûre retenue est donc : notification persistante → ouverture directe de Cours
→ contrôles Pause/Reprendre/Arrêter visibles immédiatement dans la fenêtre de
session. Cette limite est propre à l’API Expo actuelle, pas à un oubli de
l’interface.

L’action native Arrêter arrête bien le `AudioRecorder`, mais elle ne peut pas
appeler directement le code JavaScript qui assemble la file locale. Tant que le
runtime JS est vivant, l’application détecte cet arrêt, récupère l’URI produite
et conserve l’audio avec les notes, la portée et les photos. Si Android tue
complètement le processus avant cette réconciliation, aucun callback Headless
ne peut créer cette entrée ; il faut rouvrir Cours, et la disponibilité du
fichier temporaire d’`expo-audio` dépend alors encore du système.

## Synchronisation locale

Après l’arrêt, l’audio, les notes et les photos sont conservés dans la file
locale du téléphone. La file principale est le fichier privé
`cours-recordings.v2.json` du stockage documentaire de l’app ; les files
SecureStore de versions précédentes sont migrées automatiquement. Les
écritures sont sérialisées pour éviter qu’une tentative réseau et un nouvel
enregistrement ne s’écrasent mutuellement.

La synchronisation est tentée :

- au lancement de l’application ;
- périodiquement tant que le runtime JS est actif ;
- au retour à l’état active ;
- dès que `expo-network` signale le retour d’une connexion ;
- après une erreur temporaire, avec un backoff progressif jusqu’à cinq minutes.

Une erreur laisse l’élément dans la file avec le statut erreur, son nombre de
tentatives et sa prochaine échéance. Un retour au premier plan ou un retour du
réseau force une nouvelle tentative immédiate. Les enregistrements bloqués en
statut `synchronisation` après une fermeture inattendue sont également repris.

Avant d’être placées dans la file, les photos sélectionnées sont copiées dans
le stockage privé de l’app quand c’est possible. L’audio, les notes, la portée
du cours (par exemple « parties 1 à 3 ») et ces photos sont ensuite envoyés
ensemble dans la même requête `/api/mobile/sync` ; l’ordre automatique des
phases reste porté séparément par `courseNumber`.

## Limites Android à communiquer

- Android peut arrêter ou suspendre le processus JS si l’utilisateur force
  l’arrêt de l’application, si le système manque de mémoire ou si une
  politique constructeur d’économie d’énergie intervient.
- La file ne lance pas de synchronisation Headless JS/WorkManager lorsque le
  processus est mort. La reprise fiable est donc garantie au prochain
  lancement ou retour au premier plan, pas pendant une mort complète du
  processus.
- Android 13 et ultérieur exige l’autorisation POST_NOTIFICATIONS. Si elle est
  refusée, l’enregistrement peut continuer mais la visibilité de la
  notification n’est plus garantie par le système.
- Pour un enregistrement long, l’utilisateur doit éviter le bouton Forcer
  l’arrêt et autoriser l’activité en arrière-plan dans les réglages batterie du
  Pixel si Android le propose.

## Vérification après régénération native

Depuis apps/mobile :

    npx expo config --type public
    npx expo prebuild --platform android
    cd android
    ./gradlew :app:assembleDebug

Sur un Pixel, vérifier : démarrer un cours, verrouiller l’écran, observer la
notification, utiliser Arrêter, puis couper/rétablir le réseau et rouvrir
l’application pour confirmer la synchronisation de l’audio, des notes et des
photos.
