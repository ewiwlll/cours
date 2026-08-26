# BioMIA mobile

Application Expo personnelle de BioMIA. Elle utilise le même serveur et les
mêmes données que l’application web du Mac, mais elle possède son propre écran
mobile, son enregistrement audio natif et sa file locale.

## Lancer sur le téléphone

Depuis ce dossier :

```sh
npm install
EXPO_PUBLIC_BIOMIA_API_URL=https://adresse-https-de-biomia.example npm run dev
```

Pour un premier essai avec Expo Go, le téléphone et le Mac peuvent être sur le
même réseau. Pour l’utilisation quotidienne en 4G, `EXPO_PUBLIC_BIOMIA_API_URL`
doit être une URL HTTPS joignable depuis Internet et qui pointe vers le serveur
BioMIA du Mac ou vers un serveur distant.

## Installer une vraie app personnelle

Le profil `preview` est une distribution interne EAS : il produit une app
installable, sans serveur de développement. Il faut d’abord lier ce projet à un
compte Expo/EAS, puis définir l’URL publique de l’API dans l’environnement EAS.

```sh
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform ios --profile preview
```

Sur iOS, la distribution interne demande l’enregistrement de l’iPhone et les
signatures Apple ; Android reçoit un APK installable. Une fois installée, l’app
reste la même que tu sois en Wi-Fi ou en 4G : seule l’URL HTTPS de l’API change
par rapport au test local.

## Audio

BioMIA utilise `expo-audio` et un enregistrement haute qualité local dans le
dossier de documents du téléphone. La file conserve l’URI tant que le serveur
n’a pas confirmé la synchronisation. La transcription n’est pas faite par un
faux moteur local : le Mac peut envoyer l’audio au modèle de transcription
configuré côté serveur, sans exposer de clé API dans l’application.
