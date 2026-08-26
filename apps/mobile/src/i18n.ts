import { Platform, NativeModules } from 'react-native';

export type Language = 'fr' | 'en';

export const translations = {
  fr: {
    dashboard: 'Accueil',
    subjects: 'Matières',
    record: 'Amphi',
    practice: 'Entraînement',
    schedule: 'Planning',
    lockedCourse: 'Fiche Verrouillée',
    unlockActiveRecall: 'Débloquer par Rappel Actif',
    dueCards: 'cartes dues',
    noCardsDue: 'Bravo ! Aucune carte due aujourd\'hui.',
    flipCard: 'Afficher la réponse',
    again: 'À revoir',
    hard: 'Difficile',
    good: 'Correct',
    easy: 'Facile',
    settings: 'Paramètres',
    serverUrl: 'URL Serveur',
    connected: 'Connecté',
    offline: 'Mode Hors-Ligne',
  },
  en: {
    dashboard: 'Dashboard',
    subjects: 'Subjects',
    record: 'Record',
    practice: 'Practice',
    schedule: 'Schedule',
    lockedCourse: 'Course Locked',
    unlockActiveRecall: 'Unlock via Active Recall',
    dueCards: 'due cards',
    noCardsDue: 'Great job! No cards due today.',
    flipCard: 'Show Answer',
    again: 'Again',
    hard: 'Hard',
    good: 'Good',
    easy: 'Easy',
    settings: 'Settings',
    serverUrl: 'Server URL',
    connected: 'Connected',
    offline: 'Offline Mode',
  },
};

export function getDeviceLanguage(): Language {
  try {
    const locale =
      Platform.OS === 'ios'
        ? NativeModules.SettingsManager?.settings?.AppleLocale ||
          NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
        : NativeModules.I18nManager?.localeIdentifier;

    if (locale && locale.toLowerCase().startsWith('en')) {
      return 'en';
    }
  } catch {}
  return 'fr';
}
