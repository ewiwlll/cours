export type Semester = 'S1' | 'S2';
export type PriorityLevel = 'A' | 'B' | 'C';

export interface SubjectQuestionTemplate {
  prompt: string;
  criteria: string;
}

export interface Subject {
  id: string;
  title: string;
  semester: Semester;
  category: string;
  ects: number;
  priority: PriorityLevel;
  questions?: SubjectQuestionTemplate[];
  dueCardsCount?: number;
  coursesCount?: number;
}

export interface CurriculumCustomizationOption {
  id: string;
  label: string;
  title: string;
  category?: string;
  ects: number;
  priority: PriorityLevel;
  chapters?: string[];
}

export interface CurriculumCustomizationQuestion {
  id: string;
  question: string;
  type?: 'single' | 'multiple';
  options: CurriculumCustomizationOption[];
}

export interface CurriculumAnalysisResult {
  program: string;
  university?: string;
  semester?: string;
  coreSubjects?: Array<{
    title: string;
    category?: string;
    ects: number;
    priority: PriorityLevel;
    semester?: 'S1' | 'S2';
    chapters?: string[];
  }>;
  customizationQuestions?: CurriculumCustomizationQuestion[];
  subjects: Array<{
    title: string;
    category?: string;
    ects: number;
    priority: PriorityLevel;
    semester?: 'S1' | 'S2';
    chapters?: string[];
    selected?: boolean;
  }>;
}

export type CardKind =
  | 'basic'
  | 'definition'
  | 'raisonner'
  | 'comparer'
  | 'appliquer'
  | 'transfert'
  | 'qcm'
  | 'mcq'
  | 'cloze'
  | 'image-occlusion'
  | 'open'
  | string;

export type FlashcardKind = CardKind;

export interface CardOption {
  id?: string;
  text?: string;
  label?: string;
  isCorrect?: boolean;
}

export interface Card {
  id: string;
  question: string;
  answer: string;
  kind?: CardKind;
  source?: string;
  difficulty?: number;
  keywords?: string[];
  commonMistakes?: string[];
  trap?: string;
  causalLink?: string;
  conceptChain?: string;
  options?: Array<string | CardOption>;
  correctOption?: number;
  explanation?: string;
  intervalDays?: number;
  easeFactor?: number;
  repetitions?: number;
  nextReview?: string;
  lastReview?: string;
  prompt?: string;
  response?: string;
  subjectTitle?: string;
  subjectId?: string;
  chapterTitle?: string;
  chapter?: string;
  courseTitle?: string;
}

export type Flashcard = Card;

export interface OcclusionMask {
  id: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
  label?: string;
  hint?: string;
  color?: string;
  number?: number;
  solution?: string;
  revealed?: boolean;
  order?: number;
}

export interface ImageOcclusionSchema {
  id: string;
  title: string;
  subjectId?: string;
  subjectTitle?: string;
  category?: string;
  description?: string;
  url?: string;
  viewBox?: string;
  svgContent?: string;
  masks: OcclusionMask[];
}

export interface ImageOcclusionDiagram {
  id: string;
  title: string;
  category: string;
  description: string;
  viewBox: string;
  svgContent: string;
  masks: OcclusionMask[];
}

export interface CoursePhoto {
  id: string;
  filename: string;
  name?: string;
  label?: string;
  mimeType?: string;
  bytes?: number;
  contentHash?: string;
  createdAt?: string;
  offsetMs?: number;
  markerId?: string;
  url?: string;
  masks?: OcclusionMask[];
  occlusions?: OcclusionMask[];
}

export interface RecordingMarker {
  id: string;
  label?: string;
  marker?: 'important' | 'unclear' | 'example' | 'question' | string;
  type?: string;
  timestampMs?: number;
  offsetMs?: number;
  note?: string;
}

export interface TranscriptSection {
  id: string;
  title: string;
  startMs: number;
  endMs: number;
}

export interface PartScope {
  type?: string;
  label?: string;
  index?: number;
}

export interface MocPhase {
  phaseTitle: string;
  conceptsFlow?: string;
  details?: string[];
  consequence?: string;
}

export interface MocDefinition {
  problematique?: string;
  overview?: string;
  phases?: MocPhase[];
}

export interface ProgressiveExample {
  level: 'simple' | 'intermediaire' | 'realiste' | string;
  title: string;
  explanation: string;
  codeOrFormula?: string;
}

export interface AtomicComparison {
  versus: string;
  rule: string;
  table?: Array<{ critere: string; a: string; b: string }>;
}

export interface AtomicConcept {
  id: string;
  title: string;
  whyWeNeedIt?: string;
  analogy?: string;
  definition: string;
  comparison?: AtomicComparison;
  progressiveExamples?: ProgressiveExample[];
  details?: string[];
  traps?: string[];
  relatedConcepts?: string[];
  flashcardQnA?: {
    question: string;
    answer: string;
  };
}

export interface TheoremAndLaw {
  name: string;
  statement: string;
  proofOrMechanism?: string;
  conditionOfValidity?: string;
}

export interface FormulaDefinition {
  name: string;
  formula: string;
  variablesExplanation?: string;
}

export interface BoiteAOutils {
  theoremsAndLaws?: TheoremAndLaw[];
  formulas?: FormulaDefinition[];
}

export interface MethodoExamen {
  typicalQuestions?: string[];
  gradingCriteria?: string[];
  commonMistakes?: string[];
}

export interface Course {
  id: string;
  subjectId: string;
  subjectTitle: string;
  title: string;
  date: string;
  kind?: 'cours' | 'chapitre' | string;
  chapter?: string;
  chapterId?: string | null;
  courseNumber?: number | null;
  partLabel?: string | null;
  partScope?: PartScope | string | null;
  status?:
    | 'a-traiter'
    | 'source-insuffisante'
    | 'pret'
    | 'ready'
    | 'en-cours'
    | 'valide'
    | 'a-verifier'
    | string;
  geminiStatus?: 'synced' | 'processing' | 'error' | 'pending';
  recallStatus?: 'locked' | 'unlocked';
  recallScore?: number;
  lastRecalledAt?: string;
  recallDiagnostic?: {
    score?: number;
    level?: 'missing' | 'partial' | 'good' | 'excellent';
    summary?: string;
    concepts?: Array<{
      id: string;
      label: string;
      status: 'mastered' | 'partial' | 'missing' | 'wrong';
      feedback: string;
      expected?: string;
    }>;
    improvedAnswer?: string;
    nextQuestion?: {
      question: string;
      answer: string;
    };
  };
  moc?: MocDefinition;
  atomicConcepts?: AtomicConcept[];
  boiteAOutils?: BoiteAOutils;
  methodoExamen?: MethodoExamen;
  transcriptionFilename?: string | null;
  summaryFilename?: string | null;
  notes?: string;
  tags?: string[];
  photos?: CoursePhoto[];
  cards?: Card[];
  recordingMarkers?: RecordingMarker[];
  transcriptSections?: TranscriptSection[];
  audioDurationMs?: number | null;
  automationEligible?: boolean;
  automationError?: string | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  dueCardsCount?: number;
}

export type StudyCourse = Course;

export interface ChapterDefinition {
  id: string;
  subjectId: string;
  subjectTitle?: string;
  title: string;
  description?: string;
  objectives?: string[];
  order?: number;
  status?: 'manual' | 'auto' | string;
  courseCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FSRSSchedule {
  intervalDays?: number;
  stability?: number;
  difficulty?: number;
  retrievability?: number;
  reviewCount?: number;
  successStreak?: number;
  lapses?: number;
  nextReviewAt?: string;
  nextReview?: string;
  againInterval?: string;
  hardInterval?: string;
  goodInterval?: string;
  easyInterval?: string;
}

export interface ReviewSchedule {
  intervalDays: number;
  reviewCount: number;
  successStreak: number;
  nextReviewAt: string;
  nextReview: string;
  stability?: number;
  difficulty?: number;
  retrievability?: number;
  fsrs?: FSRSSchedule;
}

export interface WeakConceptItem {
  id: string;
  label: string;
  status: 'mastered' | 'partial' | 'missing' | 'wrong';
  feedback?: string;
  source?: string;
  expected?: string;
}

export type CardRating = 'again' | 'hard' | 'good' | 'easy' | 1 | 2 | 3 | 4;
export type ReviewRating = CardRating;

export interface Review {
  id?: string;
  courseId: string;
  lessonId?: string;
  cardId: string;
  rating: ReviewRating;
  intervalDays?: number;
  reviewCount?: number;
  nextReviewAt?: string;
  nextReview?: string;
  schedule?: ReviewSchedule;
  weakCardIds?: string[];
  weakConcepts?: WeakConceptItem[];
  missing?: string[];
  createdAt?: string;
  answerLength?: number;
  answerSelection?: number;
  evaluation?: { score: number; label: string; missing?: string[] } | null;
}

export interface ReviewCardItem extends Card {
  lessonId: string;
  lessonTitle: string;
  subjectId: string;
  subjectTitle: string;
}

export interface ReviewStatus {
  dueCount: number;
  totalCards: number;
  todayReviewed: number;
  accuracyPercent?: number;
  dueCards: ReviewCardItem[];
}

export interface RecallConceptEvaluation {
  id: string;
  label: string;
  status: 'mastered' | 'partial' | 'missing' | 'wrong';
  feedback: string;
  source?: string;
  expected?: string;
}

export interface RecallEvaluation {
  score: number;
  level: 'missing' | 'partial' | 'good' | 'excellent';
  summary: string;
  concepts: RecallConceptEvaluation[];
  improvedAnswer?: string;
  nextQuestion?: {
    question: string;
    answer: string;
    source?: string;
  };
  sourceWarnings?: string[];
}

export interface OralExamConcept {
  id: string;
  label: string;
  status: 'mastered' | 'partial' | 'missing' | 'wrong';
  feedback: string;
  source?: string;
  expected?: string;
}

export interface OralExamQuestion {
  id: string;
  question?: string;
  prompt?: string;
  criteria?: string;
  subjectId?: string;
  subjectTitle?: string;
  chapterTitle?: string;
  keywords?: string[];
  expectedKeyPoints?: string[];
  expectedKeywords?: string[];
  trapsToAvoid?: string[];
  idealAnswer?: string;
  durationSeconds?: number;
}

export interface OralExamEvaluation {
  score: number;
  level?: 'insufficient' | 'average' | 'good' | 'mastered' | string;
  summary?: string;
  feedback?: string;
  masteredPoints?: string[];
  missingPoints?: string[];
  concepts?: OralExamConcept[];
  strengths?: string[];
  areasForImprovement?: string[];
  improvedAnswer?: string;
  terminologyScore?: number;
  completenessScore?: number;
  clarityScore?: number;
}

export interface RevisionSession {
  id: string;
  type?: 'course-recall' | 'chapter-recall' | 'question' | 'oral-exam' | string;
  mode?: string;
  courseId?: string | null;
  courseIds?: string[];
  subjectId?: string | null;
  subjectTitle?: string;
  chapterId?: string | null;
  partLabel?: string;
  rating?: number | null;
  intervalDays?: number | null;
  nextReview?: string | null;
  nextReviewAt?: string | null;
  score?: number | null;
  scorePercent?: number;
  answerText?: string;
  summaryNotes?: string;
  weakCardIds?: string[];
  weakConcepts?: WeakConceptItem[];
  missing?: string[];
  evaluation?: RecallEvaluation | null;
  durationMinutes?: number;
  cardsReviewedCount?: number;
  date?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ExamPlan {
  examId?: string;
  daysRemaining: number;
  minutesPerDay: number;
  totalMinutesNeeded?: number;
  dailyAssignments?: Array<{
    date: string;
    items: PlanningItem[];
    targetMinutes: number;
  }>;
  targetChapters?: string[];
  status?: string;
}

export interface Exam {
  id: string;
  title: string;
  date: string;
  subjectId?: string | null;
  subjectTitle?: string;
  chapterIds?: string[];
  minutesPerDay?: number;
  status?: 'active' | 'archived';
  daysRemaining?: number;
  plan?: ExamPlan;
  planning?: ExamPlan;
  createdAt?: string;
  updatedAt?: string;
}

export interface Weakness {
  id: string;
  courseId: string;
  subjectId?: string;
  subjectTitle?: string;
  concept?: string;
  conceptId?: string;
  label?: string;
  active: boolean;
  lastStatus: string | null;
  failureCount: number;
  failCount?: number;
  successCount: number;
  successRate?: number;
  weaknessScore: number;
  lastSeenAt: string;
  lastErrorDate?: string;
  feedback?: string;
  suggestion?: string;
  source?: string;
  expected?: string;
}

export interface AutomationStatus {
  inboxPath: string;
  codexModel: string;
  codexReasoning: string;
  mode: 'actif' | 'simulation' | string;
}

export interface LearningInsights {
  recurringErrors: Array<{
    id: string;
    label: string;
    courseId: string;
    failureCount: number;
    lastSeenAt: string;
  }>;
  progression: Array<{
    date: string;
    score: number;
    sessionCount: number;
  }>;
  progress?: Array<{
    date: string;
    score: number;
  }>;
  generatedAt: string;
}

export interface PlanningItem {
  type: 'course' | 'card' | 'chapter-card' | 'chapter' | 'flashcard' | 'exam' | 'oral';
  date: string;
  dueDate?: string;
  courseId?: string;
  cardId?: string;
  chapterId?: string | null;
  chapterKey?: string;
  subjectId?: string;
  subjectTitle?: string;
  title: string;
  priority?: number;
  weak?: boolean;
  targeted?: boolean;
  reviewCount?: number;
  dueCount?: number;
  weakCount?: number;
  cumulative?: boolean;
  explanationStatus?: string;
  attemptCount?: number;
  nextReviewAt?: string | null;
  interleavingKey?: string;
  interleavingIndex?: number;
}

export interface PlanningDay {
  date: string;
  dayName?: string;
  isToday?: boolean;
  isPast?: boolean;
  overdueCount?: number;
  items: PlanningItem[];
  courses: PlanningItem[];
  cards: PlanningItem[];
  chapters: PlanningItem[];
}

export interface DaySchedule {
  date: string;
  dayName: string;
  isToday: boolean;
  dueCount: number;
  estimatedMinutes: number;
  exams?: Exam[];
  items?: PlanningItem[];
}

export interface LearningPlan {
  startDate: string;
  endDate: string;
  generatedAt: string;
  days: PlanningDay[];
  calendar?: PlanningDay[];
  weaknesses: Weakness[];
  summary: {
    totalCourses: number;
    totalCards: number;
    totalChapters: number;
    weakCards: number;
    today?: PlanningDay;
  };
  sourceOfTruth?: string;
  serverDate?: string;
  filters?: {
    subjectId?: string | null;
    startDate?: string;
    days?: number;
  };
}

export type ViewType = 'accueil' | 'subjects' | 'anki' | 'planning';
export type SemesterFilter = 'all' | 'S1' | 'S2';

export interface ModalsState {
  recording: boolean;
  courseEditor: boolean;
  subjectEditor: boolean;
  chapterManager: boolean;
  occlusionStudio: boolean;
  examPlanner: boolean;
  howItWorks: boolean;
  settings: boolean;
  devicePairing: boolean;
  onboarding: boolean;
  activeCourseIdForEditor?: string | null;
}

