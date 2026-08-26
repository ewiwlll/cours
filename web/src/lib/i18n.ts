export type Language = 'fr' | 'en';

export const translations = {
  fr: {
    // App Brand & TopBar
    appName: 'Cours',
    appBadge: 'Revision OS',
    navCourses: 'Fiches de Cours',
    navRecall: 'Sas de Rappel',
    navFsrs: 'Flashcards FSRS',
    navQcm: 'QCM Diagnostiques',
    navRecordings: 'Amphi & Audio',
    navOral: 'Simulation Oral',
    navSettings: 'Paramètres',
    navHelp: 'Méthode & Studio',
    recordButton: 'Enregistrer',
    recordButtonShort: 'Micro',
    searchPlaceholder: 'Rechercher un cours, formule, notion...',
    dueCountBadge: 'cartes dues',

    // Subjects & Courses View
    subjectsTitle: 'Matières & Chapitres',
    allSemesters: 'Tous les semestres',
    semester1: 'Semestre 1',
    semester2: 'Semestre 2',
    noCoursesFound: 'Aucun cours trouvé pour cette recherche.',
    courseLocked: 'Fiche Verrouillée',
    courseLockedDesc: 'Pour débloquer cette fiche, effectuez votre premier rappel actif sans regarder vos notes.',
    unlockNow: 'Débloquer par Rappel Actif',
    feynmanTitle: 'Analogie Concrète (Feynman)',
    comparisonTitle: 'Tableau Comparatif « X vs Y »',
    examTrapsTitle: 'Pièges Fréquents d\'Examen',
    courseFormulas: 'Formules & Équations Clés',
    courseFlashcards: 'Flashcards FSRS-5 Liées',
    retentionRate: 'Taux de Rétention',

    // Active Recall Gateway
    recallTitle: 'Sas de Rappel Actif Initial',
    recallSubtitle: 'Restituez ce dont vous vous souvenez sans aide pendant 1 à 2 minutes pour débloquer votre cours.',
    recallPlaceholder: 'Tapez votre explication avec vos propres mots (réactifs, mécanismes, rôles, bilan)...',
    recallStartVoice: 'Dicter ma restitution (Vocal)',
    recallStopVoice: 'Arrêter la dictée',
    recallEvaluate: 'Évaluer mon explication',
    recallEvaluating: 'Évaluation diagnostique en cours...',
    conceptMastered: 'MAÎTRISÉ',
    conceptPartial: 'PARTIEL',
    conceptMissing: 'MANQUANT',
    conceptWrong: 'ERRONÉ',
    scoreLabel: 'Note Diagnostique',
    unlockedSuccess: 'Fiche débloquée avec succès ! Vos cartes FSRS sont prêtes.',
    lockedRetry: 'Score insuffisant. Reformulez votre explication pour débloquer la fiche.',

    // FSRS Player
    fsrsTitle: 'Entraînement FSRS-5 (Sans Chrono)',
    noCardsDue: 'Bravo ! Aucune carte due pour le moment.',
    noCardsDueDesc: 'Toutes vos répétitions espacées sont à jour pour aujourd\'hui.',
    flipCard: 'Afficher la réponse (Espace)',
    againBtn: 'À revoir (1)',
    hardBtn: 'Difficile (2)',
    goodBtn: 'Correct (3)',
    easyBtn: 'Facile (4)',
    stabilityLabel: 'Stabilité S',
    difficultyLabel: 'Difficulté D',
    retentionLabel: 'Rétention R',
    daysUnit: 'jours',

    // Settings Modal
    settingsTitle: 'Paramètres du Système & Moteur IA',
    settingsSubtitle: 'Configurez votre clé Gemini API, le port du serveur et la langue.',
    geminiKeyLabel: 'Clé API Google Gemini',
    geminiKeyPlaceholder: 'Collez votre clé API (AIza...)',
    geminiFreeNotice: 'Gratuit et illimité via Google AI Studio.',
    getKeyLink: 'Obtenir une clé gratuite',
    testKeyBtn: 'Tester',
    testingKey: 'Test...',
    keyValid: '✓ Clé valide et fonctionnelle !',
    keyInvalid: '✗ Clé invalide ou erreur réseau',
    modelLabel: 'Modèle d\'Évaluation IA',
    portLabel: 'Port du Serveur Local',
    languageLabel: 'Langue de l\'Interface (Language)',
    networkTitle: 'Adresses Réseau & Synchronisation Mobile',
    wifiLocal: 'Wi-Fi Local :',
    tailscale4g: 'Tailscale 4G Privé :',
    tailscaleNotice: 'Utilisez Tailscale pour synchroniser à l\'extérieur sans ouvrir de box.',
    saveSettings: 'Enregistrer les modifications',
    settingsSaved: 'Paramètres enregistrés avec succès !',

    // Antigravity & Help Modal
    helpTitle: 'Le Contrat Méthodologique & Studio Antigravity',
    antigravityStudioTitle: 'Le Studio Antigravity : Votre Super-Tuteur IA (0€)',
    antigravityStudioDesc: 'Ouvrez le dossier cours dans Antigravity. En connectant votre compte Google, vous disposez de quotas gratuits généreux avec gemini-3.7-flash.',
    magicPromptsTitle: 'Phrases magiques à taper dans Antigravity :',
    magicPrompt1: '💬 « Traite tous mes enregistrements en attente et génère mes fiches »',
    magicPrompt2: '💬 « Interroge-moi sur la Photosynthèse comme à l\'oral d\'examen »',
    magicPrompt3: '💬 « Je n\'ai pas compris la sève brute vs élaborée, débloque-moi »',
    closeBtn: 'Compris, fermer',
  },

  en: {
    // App Brand & TopBar
    appName: 'Cours',
    appBadge: 'Revision OS',
    navCourses: 'Course Notes',
    navRecall: 'Active Recall',
    navFsrs: 'FSRS Flashcards',
    navQcm: 'Diagnostic Quizzes',
    navRecordings: 'Lectures & Audio',
    navOral: 'Oral Exam Sim',
    navSettings: 'Settings',
    navHelp: 'Methodology & Studio',
    recordButton: 'Record Lecture',
    recordButtonShort: 'Mic',
    searchPlaceholder: 'Search a course, formula, concept...',
    dueCountBadge: 'due cards',

    // Subjects & Courses View
    subjectsTitle: 'Subjects & Chapters',
    allSemesters: 'All semesters',
    semester1: 'Semester 1',
    semester2: 'Semester 2',
    noCoursesFound: 'No course found matching this search.',
    courseLocked: 'Course Locked',
    courseLockedDesc: 'To unlock this course note, perform your initial active recall test without looking at your notes.',
    unlockNow: 'Unlock via Active Recall',
    feynmanTitle: 'Concrete Analogy (Feynman)',
    comparisonTitle: 'Comparative Table "X vs Y"',
    examTrapsTitle: 'Frequent Exam Pitfalls',
    courseFormulas: 'Key Formulas & Equations',
    courseFlashcards: 'Linked FSRS-5 Flashcards',
    retentionRate: 'Retention Rate',

    // Active Recall Gateway
    recallTitle: 'Initial Active Recall Gate',
    recallSubtitle: 'Recall what you remember from memory for 1-2 minutes to unlock your structured course.',
    recallPlaceholder: 'Type your explanation in your own words (reagents, mechanisms, roles, summary)...',
    recallStartVoice: 'Dictate my recall (Voice)',
    recallStopVoice: 'Stop dictation',
    recallEvaluate: 'Evaluate my explanation',
    recallEvaluating: 'Diagnostic evaluation in progress...',
    conceptMastered: 'MASTERED',
    conceptPartial: 'PARTIAL',
    conceptMissing: 'MISSING',
    conceptWrong: 'INCORRECT',
    scoreLabel: 'Diagnostic Score',
    unlockedSuccess: 'Course unlocked successfully! Your FSRS cards are ready.',
    lockedRetry: 'Insufficient score. Reformulate your explanation to unlock the course.',

    // FSRS Player
    fsrsTitle: 'FSRS-5 Training (No Timer)',
    noCardsDue: 'Great job! No cards due right now.',
    noCardsDueDesc: 'All your spaced repetition cards are up to date for today.',
    flipCard: 'Show Answer (Space)',
    againBtn: 'Again (1)',
    hardBtn: 'Hard (2)',
    goodBtn: 'Good (3)',
    easyBtn: 'Easy (4)',
    stabilityLabel: 'Stability S',
    difficultyLabel: 'Difficulty D',
    retentionLabel: 'Retention R',
    daysUnit: 'days',

    // Settings Modal
    settingsTitle: 'System Settings & AI Engine',
    settingsSubtitle: 'Configure your Google Gemini API key, server port, and language.',
    geminiKeyLabel: 'Google Gemini API Key',
    geminiKeyPlaceholder: 'Paste your API key (AIza...)',
    geminiFreeNotice: 'Free & generous quotas via Google AI Studio.',
    getKeyLink: 'Get a free API key',
    testKeyBtn: 'Test Connection',
    testingKey: 'Testing...',
    keyValid: '✓ Key is valid and working!',
    keyInvalid: '✗ Invalid key or network error',
    modelLabel: 'AI Evaluation Model',
    portLabel: 'Local Server Port',
    languageLabel: 'Interface Language',
    networkTitle: 'Network Addresses & Mobile Sync',
    wifiLocal: 'Local Wi-Fi:',
    tailscale4g: 'Private 4G Tailscale:',
    tailscaleNotice: 'Use Tailscale to sync outside without opening router ports.',
    saveSettings: 'Save Changes',
    settingsSaved: 'Settings saved successfully!',

    // Antigravity & Help Modal
    helpTitle: 'Methodology Contract & Antigravity Studio',
    antigravityStudioTitle: 'The Antigravity Studio: Your AI Super-Tutor (Free Quotas)',
    antigravityStudioDesc: 'Open the cours folder in Antigravity. By connecting your Google account, you get generous free quotas with gemini-3.7-flash.',
    magicPromptsTitle: 'Magic prompt phrases to type into Antigravity:',
    magicPrompt1: '💬 "Process all pending lecture recordings and generate my KaTeX notes & flashcards"',
    magicPrompt2: '💬 "Quiz me on Photosynthesis like in an oral exam"',
    magicPrompt3: '💬 "I did not understand xylem vs phloem sap, explain with an analogy"',
    closeBtn: 'Got it, close',
  },
};

export type TranslationKeys = keyof typeof translations.fr;
export type TranslationDict = Record<TranslationKeys, string>;

export function detectDefaultLanguage(): Language {
  if (typeof window === 'undefined') return 'fr';
  const saved = localStorage.getItem('cours_lang');
  if (saved === 'fr' || saved === 'en') return saved;
  const browserLang = navigator.language?.toLowerCase() || 'fr';
  return browserLang.startsWith('en') ? 'en' : 'fr';
}
