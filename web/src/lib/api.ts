import type {
  Subject,
  Course,
  ChapterDefinition,
  Review,
  Exam,
  Weakness,
  RevisionSession,
  RecallEvaluation,
  LearningPlan,
  LearningInsights,
  AutomationStatus,
  OcclusionMask,
  CoursePhoto,
  ReviewStatus,
  PriorityLevel,
} from './types';

const API_BASE = '';

async function safeFetch<T>(url: string, fallback: T, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${url}`, {
      headers: {
        Accept: 'application/json',
        ...(options?.headers || {}),
      },
      ...options,
    });
    if (!res.ok) {
      console.warn(`API request failed: ${url} (${res.status} ${res.statusText})`);
      return fallback;
    }
    const data = await res.json();
    return data as T;
  } catch (error) {
    console.error(`Fetch error on ${url}:`, error);
    return fallback;
  }
}

/**
 * Subject catalog (15 courses / subjects defined in courses.json)
 */
export async function getSubjects(): Promise<Subject[]> {
  const data = await safeFetch<{ courses?: Subject[] } | Subject[]>('/api/courses', []);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.courses)) return data.courses;
  return [];
}

/**
 * List of study courses created/imported
 */
export async function getStudyCourses(): Promise<Course[]> {
  return safeFetch<Course[]>('/api/study-courses', []);
}

/**
 * Create a new study course
 */
export async function createStudyCourse(payload: {
  subjectId: string;
  subjectTitle?: string;
  title: string;
  date: string;
  chapter?: string;
  chapterId?: string | null;
  partLabel?: string | null;
  notes?: string;
}): Promise<Course | null> {
  try {
    const res = await fetch(`${API_BASE}/api/study-courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error('Error creating study course:', error);
    return null;
  }
}

/**
 * Update an existing course
 */
export async function updateStudyCourse(
  id: string,
  payload: Partial<Course>
): Promise<Course | null> {
  try {
    const res = await fetch(`${API_BASE}/api/study-courses/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error(`Error updating course ${id}:`, error);
    return null;
  }
}

/**
 * Delete an existing study course
 */
export async function deleteStudyCourse(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/study-courses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Unlock a course with active recall evaluation
 */
export async function unlockCourseRecall(
  courseId: string,
  recallText: string
): Promise<{ course: Course; evaluation: any } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/study-courses/${encodeURIComponent(courseId)}/unlock-recall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recallText }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('Error unlocking course recall:', error);
    return null;
  }
}

/**
 * Create a new subject
 */
export async function createSubject(payload: {
  title: string;
  semester?: 'S1' | 'S2';
  category?: string;
  ects?: number;
  priority?: PriorityLevel;
}): Promise<Subject | null> {
  try {
    const res = await fetch(`${API_BASE}/api/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Delete a subject
 */
export async function deleteSubject(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/courses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Propose transcript sections for a course
 */
export async function proposeTranscriptSections(courseId: string): Promise<any> {
  try {
    const res = await fetch(
      `${API_BASE}/api/study-courses/${encodeURIComponent(courseId)}/transcript-sections/propose`,
      { method: 'POST' }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch automation status & configuration
 */
export async function getAutomationStatus(): Promise<AutomationStatus | null> {
  return safeFetch<AutomationStatus | null>('/api/automation', null);
}

/**
 * Fetch chapter definitions
 */
export async function getChapterDefinitions(): Promise<ChapterDefinition[]> {
  return safeFetch<ChapterDefinition[]>('/api/chapter-definitions', []);
}

/**
 * Create a chapter definition
 */
export async function createChapterDefinition(payload: {
  subjectId: string;
  title: string;
}): Promise<ChapterDefinition | null> {
  try {
    const res = await fetch(`${API_BASE}/api/chapter-definitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Delete a chapter definition
 */
export async function deleteChapterDefinition(
  id: string,
  reassignToChapterId?: string | null
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/chapter-definitions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reassignToChapterId: reassignToChapterId || null }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch raw reviews list
 */
export async function getRawReviews(): Promise<Review[]> {
  const data = await safeFetch<any>('/api/reviews', []);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.reviews)) return data.reviews;
  return [];
}

/**
 * Fetch reviews list and status
 */
export async function getReviews(): Promise<ReviewStatus> {
  const data = await safeFetch<any>('/api/reviews', {
    dueCount: 0,
    totalCards: 0,
    todayReviewed: 0,
    dueCards: [],
  });

  if (Array.isArray(data)) {
    return {
      dueCount: data.length,
      totalCards: data.length,
      todayReviewed: 0,
      dueCards: data,
    };
  }

  return {
    dueCount: data.dueCount || (data.dueCards?.length ?? 0),
    totalCards: data.totalCards || 0,
    todayReviewed: data.todayReviewed || 0,
    accuracyPercent: data.accuracyPercent,
    dueCards: data.dueCards || [],
  };
}

/**
 * Submit an Anki / card review
 */
export async function submitCardReview(payload: {
  courseId?: string;
  lessonId?: string;
  cardId: string;
  rating: number | 'again' | 'hard' | 'good' | 'easy';
  answerLength?: number;
  answerSelection?: number;
  evaluation?: { score: number; label: string; missing?: string[] } | null;
  weakCardIds?: string[];
  weakConcepts?: any[];
}): Promise<Review | null> {
  try {
    const numericRating =
      typeof payload.rating === 'number'
        ? payload.rating
        : payload.rating === 'again'
        ? 1
        : payload.rating === 'hard'
        ? 2
        : payload.rating === 'good'
        ? 3
        : 4;

    const res = await fetch(`${API_BASE}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId: payload.courseId || payload.lessonId,
        lessonId: payload.lessonId || payload.courseId,
        cardId: payload.cardId,
        rating: numericRating,
        answerLength: payload.answerLength,
        answerSelection: payload.answerSelection,
        evaluation: payload.evaluation,
        weakCardIds: payload.weakCardIds,
        weakConcepts: payload.weakConcepts,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('Error submitting review:', error);
    return null;
  }
}

/**
 * Fetch exams list with calculated plans
 */
export async function getExams(): Promise<Exam[]> {
  return safeFetch<Exam[]>('/api/exams', []);
}

/**
 * Create a new exam
 */
export async function createExam(exam: {
  title: string;
  date: string;
  subjectId?: string | null;
  subjectTitle?: string;
  chapterIds?: string[];
  minutesPerDay: number;
}): Promise<Exam | null> {
  try {
    const res = await fetch(`${API_BASE}/api/exams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exam),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Update an existing exam
 */
export async function updateExam(id: string, payload: Partial<Exam>): Promise<Exam | null> {
  try {
    const res = await fetch(`${API_BASE}/api/exams/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Delete an exam
 */
export async function deleteExam(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/exams/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Start an adaptive session
 */
export async function startAdaptiveSession(payload: {
  minutes: number;
  mode?: 'adaptive' | 'oral-exam' | string;
  subjectId?: string;
  chapterId?: string;
  chapterIds?: string[];
  courseIds?: string[];
  examId?: string;
}): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/adaptive-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch revision sessions history
 */
export async function getRevisionSessions(): Promise<RevisionSession[]> {
  return safeFetch<RevisionSession[]>('/api/revision-sessions', []);
}

/**
 * Save a revision session (e.g. course recall, oral session)
 */
export async function saveRevisionSession(
  session: Partial<RevisionSession>
): Promise<RevisionSession | null> {
  try {
    const payload = {
      ...session,
      createdAt: session.createdAt || new Date().toISOString(),
    };
    const res = await fetch(`${API_BASE}/api/revision-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch weaknesses and struggling concepts
 */
export async function getWeaknesses(params?: {
  courseId?: string;
  cardId?: string;
}): Promise<Weakness[]> {
  const query = new URLSearchParams();
  if (params?.courseId) query.set('courseId', params.courseId);
  if (params?.cardId) query.set('cardId', params.cardId);
  const qStr = query.toString();
  const res = await safeFetch<{ ok?: boolean; weaknesses?: Weakness[] } | Weakness[]>(
    `/api/weaknesses${qStr ? `?${qStr}` : ''}`,
    []
  );
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.weaknesses)) return res.weaknesses;
  return [];
}

/**
 * Fetch learning insights and error progression
 */
export async function getLearningInsights(courseId?: string): Promise<LearningInsights | null> {
  const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : '';
  return safeFetch<LearningInsights | null>(`/api/learning-insights${query}`, null);
}

/**
 * Fetch learning planning & due items
 */
export async function getPlanning(params?: {
  startDate?: string;
  days?: number;
  subjectId?: string;
}): Promise<LearningPlan | null> {
  const query = new URLSearchParams();
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.days) query.set('days', String(params.days));
  if (params?.subjectId) query.set('subjectId', params.subjectId);
  const qStr = query.toString();
  return safeFetch<LearningPlan | null>(`/api/planning${qStr ? `?${qStr}` : ''}`, null);
}

/**
 * Fetch revision calendar (with day-by-day stats)
 */
export async function getRevisionCalendar(
  params?:
    | {
        startDate?: string;
        days?: number;
        subjectId?: string;
      }
    | number
): Promise<any> {
  const query = new URLSearchParams();
  if (typeof params === 'number') {
    query.set('days', String(params));
  } else if (params) {
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.days) query.set('days', String(params.days));
    if (params.subjectId) query.set('subjectId', params.subjectId);
  }
  const qStr = query.toString();
  return safeFetch<any>(`/api/revision-calendar${qStr ? `?${qStr}` : ''}`, []);
}

/**
 * Evaluate active recall restitution via AI
 */
export async function correctRecall(payload: {
  courseId: string;
  answer: string;
  attempt?: number;
  previousCorrection?: any;
}): Promise<{ ok: boolean; evaluation?: RecallEvaluation; reason?: string; sourceWarnings?: string[] }> {
  try {
    const res = await fetch(`${API_BASE}/api/recall-correction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  } catch (error) {
    return { ok: false, reason: (error as Error).message || 'Erreur de communication' };
  }
}

/**
 * Transcribe audio locally or via backend
 */
export async function transcribeAudio(payload: {
  audioBase64: string;
  mimeType?: string;
  kind?: 'recall' | 'exam' | 'recording';
  courseId?: string;
}): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/audio/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur transcription');
    }
    return await res.json();
  } catch (error) {
    console.error('Audio transcription error:', error);
    return null;
  }
}

/**
 * Get markdown text content for a course summary
 */
export async function getCourseSummaryContent(filename: string): Promise<string> {
  if (!filename) return '';
  try {
    const res = await fetch(`${API_BASE}/api/courses/content?file=${encodeURIComponent(filename)}`);
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

/**
 * Get text content for a transcription
 */
export async function getTranscriptionContent(filename: string): Promise<string> {
  if (!filename) return '';
  try {
    const res = await fetch(
      `${API_BASE}/api/transcriptions/content?file=${encodeURIComponent(filename)}`
    );
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

/**
 * Save manual course notes
 */
export async function saveCourseNotes(courseId: string, notes: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/courses/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, notes }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Upload a photo for a course
 */
export async function uploadCoursePhoto(payload: {
  courseId: string;
  dataBase64: string;
  filename?: string;
  mimeType?: string;
  offsetMs?: number;
  markerId?: string;
}): Promise<CoursePhoto | null> {
  try {
    const res = await fetch(`${API_BASE}/api/courses/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Save image occlusion masks on a course photo
 */
export async function saveOcclusionMasks(
  courseId: string,
  photoId: string,
  masks: OcclusionMask[]
): Promise<boolean> {
  try {
    const courses = await getStudyCourses();
    const course = courses.find((c) => c.id === courseId);
    if (!course || !course.photos) return false;

    const updatedPhotos = course.photos.map((p) => {
      if (p.id === photoId || p.filename === photoId) {
        return { ...p, masks, occlusions: masks };
      }
      return p;
    });

    const updated = await updateStudyCourse(courseId, { photos: updatedPhotos });
    return updated !== null;
  } catch {
    return false;
  }
}

/**
 * Get interleaved multi-subject training session
 */
export async function getInterleavedTraining(
  count: number = 15,
  subjects?: string[]
): Promise<any[]> {
  try {
    const params = new URLSearchParams({ count: String(count) });
    if (subjects && subjects.length > 0) {
      params.set('subjects', subjects.join(','));
    }
    const res = await fetch(`${API_BASE}/api/training/interleaved?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch (e) {
    console.warn('Failed to load interleaved training:', e);
    return [];
  }
}

/**
 * Get exam traps and failed cards
 */
export async function getExamTrapsAndErrors(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/api/training/traps`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch (e) {
    console.warn('Failed to load exam traps:', e);
    return [];
  }
}

/**
 * Evaluate Feynman 60s self-explanation
 */
export async function evaluateFeynman(
  courseId: string,
  cardId: string,
  explanationText: string
): Promise<{
  score: number;
  causalScore: number;
  level: string;
  feedback: string;
  masteredKeywords: string[];
  missingKeywords: string[];
  improvedFeynman: string;
} | null> {
  try {
    const res = await fetch(`${API_BASE}/api/training/feynman-evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, cardId, explanationText }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.evaluation || null;
  } catch (e) {
    console.warn('Feynman evaluation failed:', e);
    return null;
  }
}

/**
 * Offline Sync: flush locally queued reviews to backend
 */
export async function syncPendingReviews(): Promise<number> {
  try {
    const raw = localStorage.getItem('biomia_pending_reviews');
    if (!raw) return 0;
    const pending = JSON.parse(raw);
    if (!Array.isArray(pending) || pending.length === 0) return 0;

    const res = await fetch(`${API_BASE}/api/reviews/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviews: pending }),
    });

    if (res.ok) {
      localStorage.removeItem('biomia_pending_reviews');
      return pending.length;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Enqueue review offline-first
 */
export function enqueueOfflineReview(review: any) {
  try {
    const raw = localStorage.getItem('biomia_pending_reviews');
    const list = raw ? JSON.parse(raw) : [];
    list.push(review);
    localStorage.setItem('biomia_pending_reviews', JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to enqueue review offline:', e);
  }
}

