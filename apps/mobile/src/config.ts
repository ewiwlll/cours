import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };

export const apiUrl =
  extra.apiUrl ??
  process.env.EXPO_PUBLIC_BIOMIA_API_URL ??
  "http://172.27.241.122:3002";

export const configured = Boolean(apiUrl);
