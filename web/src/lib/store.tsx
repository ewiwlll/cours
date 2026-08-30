import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type {
  Subject,
  Course,
  ChapterDefinition,
  Review,
  Exam,
  Weakness,
  RevisionSession,
  LearningPlan,
  AutomationStatus,
  ViewType,
  SemesterFilter,
  ModalsState,
} from './types';
import { type Language, type TranslationDict, translations, detectDefaultLanguage } from './i18n';
import {
  getSubjects,
  getStudyCourses,
  getChapterDefinitions,
  getRawReviews,
  getExams,
  getWeaknesses,
  getRevisionSessions,
  getPlanning,
  getAutomationStatus,
} from './api';

interface StoreContextValue {
  // Navigation & selection
  selectedSubjectId: string | null;
  setSelectedSubjectId: (id: string | null) => void;
  openCourseId: string | null;
  setOpenCourseId: (id: string | null) => void;
  view: ViewType;
  setView: (view: ViewType) => void;
  semesterFilter: SemesterFilter;
  setSemesterFilter: (filter: SemesterFilter) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Language & i18n
  lang: Language;
  setLang: (lang: Language) => void;
  t: TranslationDict;

  // Active interactive session (e.g. active review or oral recall)
  activeSession: any | null;
  setActiveSession: (session: any | null) => void;

  // Modals state
  modals: ModalsState;
  openModal: (modal: keyof ModalsState, contextCourseId?: string) => void;
  closeModal: (modal: keyof ModalsState) => void;
  closeAllModals: () => void;

  // Data
  catalog: Subject[];
  studyCourses: Course[];
  chapterDefinitions: ChapterDefinition[];
  reviews: Review[];
  exams: Exam[];
  weaknesses: Weakness[];
  revisionSessions: RevisionSession[];
  learningPlan: LearningPlan | null;
  automationStatus: AutomationStatus | null;

  // Loading & refresh
  isLoading: boolean;
  isRefreshing: boolean;
  lastRefreshedAt: Date | null;
  refreshData: () => Promise<void>;

  // Computed values
  totalDueCards: number;
  dueCardsBySubject: Record<string, number>;
  selectedSubject: Subject | undefined;
  openCourse: Course | undefined;
  filteredSubjects: Subject[];
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

const INITIAL_MODALS: ModalsState = {
  recording: false,
  courseEditor: false,
  subjectEditor: false,
  chapterManager: false,
  occlusionStudio: false,
  examPlanner: false,
  howItWorks: false,
  settings: false,
  devicePairing: false,
  onboarding: false,
  activeCourseIdForEditor: null,
};

export function StoreProvider({ children }: { children: ReactNode }) {
  // Navigation state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);
  const [view, setView] = useState<ViewType>('accueil');
  const [semesterFilter, setSemesterFilter] = useState<SemesterFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Language state & auto-detection
  const [lang, setLangState] = useState<Language>(() => detectDefaultLanguage());
  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem('cours_lang', newLang);
    } catch {}
  }, []);
  const t = useMemo(() => translations[lang] || translations.fr, [lang]);

  // Active session
  const [activeSession, setActiveSession] = useState<any | null>(null);

  // Modals
  const [modals, setModals] = useState<ModalsState>(INITIAL_MODALS);

  // Data states
  const [rawCatalog, setRawCatalog] = useState<Subject[]>([]);
  const [studyCourses, setStudyCourses] = useState<Course[]>([]);
  const [chapterDefinitions, setChapterDefinitions] = useState<ChapterDefinition[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [weaknesses, setWeaknesses] = useState<Weakness[]>([]);
  const [revisionSessions, setRevisionSessions] = useState<RevisionSession[]>([]);
  const [learningPlan, setLearningPlan] = useState<LearningPlan | null>(null);
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus | null>(null);

  // Status
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  // Modal actions
  const openModal = useCallback((modal: keyof ModalsState, contextCourseId?: string) => {
    setModals((prev) => ({
      ...prev,
      [modal]: true,
      activeCourseIdForEditor: contextCourseId || prev.activeCourseIdForEditor || null,
    }));
  }, []);

  const closeModal = useCallback((modal: keyof ModalsState) => {
    setModals((prev) => ({
      ...prev,
      [modal]: false,
      ...(modal === 'courseEditor' ? { activeCourseIdForEditor: null } : {}),
    }));
  }, []);

  const closeAllModals = useCallback(() => {
    setModals(INITIAL_MODALS);
  }, []);

  // Fetch all core backend data
  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [
        fetchedCatalog,
        fetchedCourses,
        fetchedChapters,
        fetchedReviews,
        fetchedExams,
        fetchedWeaknesses,
        fetchedSessions,
        fetchedPlan,
        fetchedAutomation,
      ] = await Promise.all([
        getSubjects(),
        getStudyCourses(),
        getChapterDefinitions(),
        getRawReviews(),
        getExams(),
        getWeaknesses(),
        getRevisionSessions(),
        getPlanning({ days: 14 }),
        getAutomationStatus(),
      ]);

      setRawCatalog(fetchedCatalog);
      setStudyCourses(fetchedCourses);
      setChapterDefinitions(fetchedChapters);
      setReviews(fetchedReviews);
      setExams(fetchedExams);
      setWeaknesses(fetchedWeaknesses);
      setRevisionSessions(fetchedSessions);
      setLearningPlan(fetchedPlan);
      setAutomationStatus(fetchedAutomation);
      setLastRefreshedAt(new Date());
    } catch (error) {
      console.error('Failed to load application data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load and automatic background polling
  useEffect(() => {
    refreshData();
    const interval = setInterval(() => {
      refreshData();
    }, 20000);
    const onFocus = () => refreshData();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshData]);

  // Compute due cards per subject & total
  const { dueCardsBySubject, totalDueCards } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const latestReviewMap = new Map<string, Review>();

    for (const r of reviews) {
      const key = `${r.courseId || r.lessonId}::${r.cardId}`;
      const existing = latestReviewMap.get(key);
      if (!existing || (Date.parse(r.createdAt || '') || 0) > (Date.parse(existing.createdAt || '') || 0)) {
        latestReviewMap.set(key, r);
      }
    }

    const bySubject: Record<string, number> = {};
    let total = 0;

    for (const course of studyCourses) {
      if (course.status === 'source-insuffisante') continue;
      const cards = course.cards || [];
      for (const card of cards) {
        const key = `${course.id}::${card.id}`;
        const rev = latestReviewMap.get(key);
        const nextReviewDate = rev ? (rev.nextReview || (rev.nextReviewAt ? rev.nextReviewAt.slice(0, 10) : '')) : today;
        const isDue = !rev || nextReviewDate <= today;

        if (isDue) {
          total += 1;
          const sId = course.subjectId;
          bySubject[sId] = (bySubject[sId] || 0) + 1;
        }
      }
    }

    return { dueCardsBySubject: bySubject, totalDueCards: total };
  }, [reviews, studyCourses]);

  // Catalog with enhanced metrics (dueCardsCount, coursesCount)
  const catalog = useMemo(() => {
    return rawCatalog.map((subj) => {
      const coursesForSubj = studyCourses.filter((c) => c.subjectId === subj.id);
      return {
        ...subj,
        dueCardsCount: dueCardsBySubject[subj.id] || 0,
        coursesCount: coursesForSubj.length,
      };
    });
  }, [rawCatalog, dueCardsBySubject, studyCourses]);

  // Filtered subjects based on semester and search
  const filteredSubjects = useMemo(() => {
    return catalog.filter((subj) => {
      const matchesSemester =
        semesterFilter === 'all' || subj.semester === semesterFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        subj.title.toLowerCase().includes(q) ||
        subj.id.toLowerCase().includes(q) ||
        subj.category.toLowerCase().includes(q);
      return matchesSemester && matchesSearch;
    });
  }, [catalog, semesterFilter, searchQuery]);

  // Selected subject object
  const selectedSubject = useMemo(() => {
    if (!selectedSubjectId) return undefined;
    return catalog.find((s) => s.id === selectedSubjectId);
  }, [catalog, selectedSubjectId]);

  // Currently opened course object
  const openCourse = useMemo(() => {
    if (!openCourseId) return undefined;
    return studyCourses.find((c) => c.id === openCourseId);
  }, [studyCourses, openCourseId]);

  // Global Keyboard Shortcuts (e.g. 'R' for recording modal toggle, 'Escape' to close modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        closeAllModals();
        return;
      }

      if (!isInput && (e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setModals((prev) => ({ ...prev, recording: !prev.recording }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeAllModals]);

  const value: StoreContextValue = {
    selectedSubjectId,
    setSelectedSubjectId,
    openCourseId,
    setOpenCourseId,
    view,
    setView,
    semesterFilter,
    setSemesterFilter,
    searchQuery,
    setSearchQuery,
    lang,
    setLang,
    t,
    activeSession,
    setActiveSession,
    modals,
    openModal,
    closeModal,
    closeAllModals,
    catalog,
    studyCourses,
    chapterDefinitions,
    reviews,
    exams,
    weaknesses,
    revisionSessions,
    learningPlan,
    automationStatus,
    isLoading,
    isRefreshing,
    lastRefreshedAt,
    refreshData,
    totalDueCards,
    dueCardsBySubject,
    selectedSubject,
    openCourse,
    filteredSubjects,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
