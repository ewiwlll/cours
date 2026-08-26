const apiUrl = process.env.EXPO_PUBLIC_BIOMIA_API_URL?.trim() || undefined;
const { withAndroidManifest } = require("@expo/config-plugins");

const withLocalHttpForLanDevelopment = (config) => withAndroidManifest(config, (mod) => {
  const application = mod.modResults.manifest.application?.[0];
  if (application) {
    application.$ = {
      ...(application.$ || {}),
      "android:usesCleartextTraffic": "true"
    };
  }
  return mod;
});

const withRecordingForegroundServicePolicy = (config) => withAndroidManifest(config, (mod) => {
  const manifest = mod.modResults.manifest;
  const application = manifest.application?.[0];
  if (!application) return mod;

  const permissions = manifest["uses-permission"] || [];
  if (!permissions.some((item) => item.$?.["android:name"] === "android.permission.FOREGROUND_SERVICE")) {
    permissions.push({ $: { "android:name": "android.permission.FOREGROUND_SERVICE" } });
  }
  if (!permissions.some((item) => item.$?.["android:name"] === "android.permission.FOREGROUND_SERVICE_MICROPHONE")) {
    permissions.push({ $: { "android:name": "android.permission.FOREGROUND_SERVICE_MICROPHONE" } });
  }
  manifest["uses-permission"] = permissions;

  const recordingService = application.service?.find((item) => item.$?.["android:name"] === "expo.modules.audio.service.AudioRecordingService");
  if (recordingService) {
    recordingService.$ = {
      ...(recordingService.$ || {}),
      "android:exported": "false",
      "android:foregroundServiceType": "microphone",
      "android:stopWithTask": "false",
    };
  }
  return mod;
});

module.exports = {
  expo: {
    name: "Cours",
    slug: "cours-revisions",
    scheme: "cours",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "fr.ewilien.biomia"
    },
    android: {
      package: "fr.ewilien.biomia",
      versionCode: 1,
      usesCleartextTraffic: true
    },
    web: {
      bundler: "metro"
    },
    plugins: [
      withLocalHttpForLanDevelopment,
      "expo-router",
      [
        "expo-audio",
        {
          microphonePermission: "Cours utilise le microphone pour enregistrer tes cours.",
          enableBackgroundRecording: true
        }
      ],
      withRecordingForegroundServicePolicy,
      "expo-secure-store"
    ],
    extra: {
      apiUrl
    }
  }
};
