import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };

export const apiUrl =
  extra.apiUrl ??
  process.env.EXPO_PUBLIC_BIOMIA_API_URL ??
  "http://192.168.1.54:3002";

export const configured = Boolean(apiUrl);
