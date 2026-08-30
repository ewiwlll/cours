import * as FileSystem from "expo-file-system/legacy";
import { apiUrl } from "./config";
import {
  type LocalRecording,
  type RecordingPartScope,
  type RecordingMarker,
  type LocalRecordingPhoto,
  type TrashedCourse,
  readRecordings,
  upsertRecording,
  moveToTrash,
  readTrash,
  restoreFromTrash,
  readSavedServerHost,
  saveServerHost,
} from "./storage";

export type Subject = { id: string; title: string; semester: string; category: string; ects: number; priority?: string };
export type Card = { id: string; question: string; answer: string; kind?: string; source?: string; options?: Array<string | { id?: string; label?: string; text?: string }>; correctOption?: string | number; keywords?: string[]; trap?: string; commonMistakes?: string[] };
export type CoursePhoto = { id: string; filename: string; name?: string; mimeType?: string; bytes?: number; url?: string; offsetMs?: number; markerId?: string };
export type TranscriptSection = { id?: string; title: string; startOffsetMs?: number; endOffsetMs?: number; partStart?: number; partEnd?: number; status?: "proposed" | "validated"; timingEstimated?: boolean };
export type ChapterDefinition = { id: string; subjectId: string; subjectTitle?: string; title: string; order?: number; status?: string; createdAt?: string; updatedAt?: string };

export type ProgressiveExample = {
  level: "simple" | "intermediaire" | "realiste" | string;
  title: string;
  explanation: string;
  codeOrFormula?: string;
};

export type AtomicConcept = {
  id: string;
  title: string;
  whyWeNeedIt?: string;
  analogy?: string;
  definition: string;
  comparison?: {
    versus: string;
    rule: string;
    table?: Array<{ critere: string; a: string; b: string }>;
  };
  progressiveExamples?: ProgressiveExample[];
  details?: string[];
  traps?: string[];
  relatedConcepts?: string[];
  flashcardQnA?: {
    question: string;
    answer: string;
  };
};

export type TheoremAndLaw = {
  name: string;
  statement: string;
  proofOrMechanism?: string;
  conditionOfValidity?: string;
};

export type FormulaDefinition = {
  name: string;
  formula: string;
  variablesExplanation?: string;
};

export type BoiteAOutils = {
  theoremsAndLaws?: TheoremAndLaw[];
  formulas?: FormulaDefinition[];
};

export type MethodoExamen = {
  typicalQuestions?: string[];
  gradingCriteria?: string[];
  commonMistakes?: string[];
};

export type MocDefinition = {
  problematique?: string;
  overview?: string;
  phases?: Array<{
    phaseTitle: string;
    conceptsFlow?: string;
    details?: string[];
    consequence?: string;
  }>;
};

export type StudyCourse = {
  id: string;
  subjectId: string;
  subjectTitle?: string;
  title: string;
  date: string;
  createdAt?: string;
  kind: string;
  chapter?: string;
  chapterId?: string;
  partLabel?: string;
  partScope?: RecordingPartScope | null;
  partScopeLabel?: string | null;
  courseNumber?: number;
  status: string;
  recallStatus?: "locked" | "unlocked";
  recallScore?: number;
  lastRecalledAt?: string;
  recallDiagnostic?: RecallEvaluation;
  moc?: MocDefinition;
  atomicConcepts?: AtomicConcept[];
  boiteAOutils?: BoiteAOutils;
  methodoExamen?: MethodoExamen;
  notes?: string;
  photos?: CoursePhoto[];
  recordingMarkers?: RecordingMarker[];
  audioDurationMs?: number;
  transcriptSections?: TranscriptSection[];
  transcriptionFilename?: string | null;
  summaryFilename?: string | null;
  automationError?: string | null;
  cards?: Card[];
};

export type Review = { courseId?: string; lessonId?: string; cardId: string; rating: number; nextReview?: string; nextReviewAt?: string; createdAt: string; intervalDays?: number; reviewCount?: number; schedule?: { intervalDays?: number; reviewCount?: number; nextReview?: string; nextReviewAt?: string }; easeFactor?: number; repetitions?: number };
export type RecallConcept = { id: string; label: string; status: "mastered" | "partial" | "missing" | "wrong"; feedback: string; source?: string; expected?: string };
export type RecallEvaluation = {
  score: number;
  level?: "missing" | "partial" | "good" | "excellent";
  label?: string;
  summary: string;
  concepts: RecallConcept[];
  improvedAnswer?: string;
  nextQuestion?: { question: string; answer?: string; source?: string };
  sourceWarnings?: string[];
  missing?: string[];
  weakCardIds?: string[];
};
export type RevisionSession = {
  id: string;
  type: "course-recall" | "chapter-recall" | "question" | "oral-exam";
  courseId?: string;
  subjectId?: string;
  chapterId?: string;
  partLabel?: string;
  partScope?: RecordingPartScope | null;
  partScopeLabel?: string;
  scopeLabel?: string;
  attempt?: number;
  answerText?: string;
  score?: number;
  missing?: string[];
  weakConcepts?: RecallConcept[];
  weakCardIds?: string[];
  improvedAnswer?: string;
  sourceWarnings?: string[];
  completed?: boolean;
  skipped?: boolean;
  rating?: number;
  nextReview?: string;
  createdAt: string;
  persistedLocally?: boolean;
};
export type RevisionCalendarItem = { type: string; date: string; dueDate?: string; title?: string; courseId?: string; cardId?: string; subjectId?: string; chapterId?: string };
export type RevisionCalendarDay = { date: string; items: RevisionCalendarItem[]; courses: RevisionCalendarItem[]; cards: RevisionCalendarItem[]; chapters: RevisionCalendarItem[]; isToday?: boolean; isPast?: boolean; overdueCount?: number };
export type RevisionCalendar = { startDate?: string; endDate?: string; calendar?: RevisionCalendarDay[]; days?: RevisionCalendarDay[]; summary?: { totalCourses?: number; totalCards?: number; totalChapters?: number; weakCards?: number } };
export type LearningInsights = { recurringErrors?: Array<{ label: string; count: number; courseIds?: string[]; courses?: string[]; feedback?: string }>; progress?: Array<{ courseId: string; courseTitle?: string; first?: { score?: number; answerText?: string; createdAt?: string }; latest?: { score?: number; answerText?: string; createdAt?: string }; delta?: number }> };
export type ExamPlan = { id: string; title?: string; date: string; subjectId?: string; chapterIds?: string[]; minutesPerDay?: number; plan?: Array<{ date: string; title?: string; courseId?: string; chapterId?: string; minutes?: number }> };
export type AdaptiveSession = { title?: string; minutes?: number; requestedMinutes?: number; estimatedMinutes?: number; cards?: Card[]; cardIds?: string[]; courseIds?: string[]; items?: Array<{ courseId?: string; cardId?: string; question?: string; title?: string }> };

const localDataCacheFile = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}cours-data-cache.v1.json` : null;

let activeBaseUrl = "http://127.0.0.1:3002";
let hasDiscovered = false;

export function getActiveServerUrl(): string {
  return activeBaseUrl;
}

export async function discoverAndSelectBestHost(): Promise<string> {
  const saved = await readSavedServerHost();
  const params = typeof window !== "undefined" && window.location?.search ? new URLSearchParams(window.location.search) : null;
  const urlHost = params?.get("host");
  const urlPort = params?.get("port") || "3002";
  const urlTailscale = params?.get("tailscale");
  const urlServer = params?.get("server");
  const winOrigin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : null;

  const rawCandidates = [
    urlServer,
    urlHost ? `http://${urlHost}:${urlPort}` : null,
    urlTailscale ? (urlTailscale.startsWith("http") ? urlTailscale : `http://${urlTailscale}:${urlPort}`) : null,
    saved,
    winOrigin && !winOrigin.includes("pages.dev") && !winOrigin.includes("8081") ? winOrigin : null,
    "http://127.0.0.1:3002",
    "http://localhost:3002",
    "http://10.0.2.2:3002", // Android Emulator -> Mac Host
    "http://10.0.3.2:3002", // Genymotion Emulator -> Mac Host
    apiUrl ? apiUrl.replace(/\/$/, "") : null,
    "http://100.123.88.110:3002",
    "http://192.168.1.54:3002",
  ].filter(Boolean) as string[];

  const uniqueCandidates = [...new Set(rawCandidates.map((h) => h.replace(/\/$/, "")))];

  const pingHost = async (host: string): Promise<string> => {
    const res = await fetchWithTimeout(`${host}/api/devices`, { headers: { accept: "application/json" } }, 900);
    if (res.ok) return host;
    throw new Error(`Inaccessible: ${host}`);
  };

  try {
    const winner = await Promise.any(uniqueCandidates.map(pingHost));
    if (winner) {
      activeBaseUrl = winner;
      hasDiscovered = true;
      saveServerHost(winner).catch(() => {});
      return winner;
    }
  } catch {}

  if (saved) activeBaseUrl = saved;
  else if (uniqueCandidates.length > 0 && uniqueCandidates[0]) activeBaseUrl = uniqueCandidates[0];
  hasDiscovered = true;
  return activeBaseUrl;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 3000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function request<T>(path: string, options?: RequestInit, timeoutMs = 12000): Promise<T> {
  if (!hasDiscovered) {
    await discoverAndSelectBestHost().catch(() => {});
  }

  const hostsToTry = [activeBaseUrl];
  let lastError: any = null;

  for (const host of hostsToTry) {
    try {
      const fullUrl = `${host}${path}`;
      const response = await fetchWithTimeout(
        fullUrl,
        {
          ...options,
          headers: {
            accept: "application/json",
            ...(options?.body ? { "content-type": "application/json" } : {}),
            ...options?.headers,
          },
        },
        timeoutMs
      );

      if (response.ok) {
        activeBaseUrl = host;
        saveServerHost(host).catch(() => {});
        const payload: unknown = await response.json().catch(() => undefined);
        return payload as T;
      } else {
        const payload: any = await response.json().catch(() => ({}));
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }
    } catch (err: any) {
      lastError = err;
      if (err.message && !err.message.includes("Network") && !err.message.includes("Abort") && !err.message.includes("fetch")) {
        throw err;
      }
    }
  }

  // If activeBaseUrl failed, try rediscovering once
  try {
    const fallbackHost = await discoverAndSelectBestHost();
    if (fallbackHost && fallbackHost !== activeBaseUrl) {
      const fullUrl = `${fallbackHost}${path}`;
      const response = await fetchWithTimeout(
        fullUrl,
        {
          ...options,
          headers: {
            accept: "application/json",
            ...(options?.body ? { "content-type": "application/json" } : {}),
            ...options?.headers,
          },
        },
        timeoutMs
      );
      if (response.ok) {
        activeBaseUrl = fallbackHost;
        saveServerHost(fallbackHost).catch(() => {});
        const payload: unknown = await response.json().catch(() => undefined);
        return payload as T;
      }
    }
  } catch {}

  throw new Error(lastError?.message || "Cours est hors connexion. L application utilise le cache local.");
}

export async function requestText(path: string, timeoutMs = 12000): Promise<string> {
  if (!hasDiscovered) {
    await discoverAndSelectBestHost().catch(() => {});
  }
  const hostsToTry = [activeBaseUrl];
  for (const host of hostsToTry) {
    try {
      const response = await fetchWithTimeout(`${host}${path}`, { headers: { accept: "text/plain" } }, timeoutMs);
      if (response.ok) {
        activeBaseUrl = host;
        saveServerHost(host).catch(() => {});
        return await response.text();
      }
    } catch {}
  }
  throw new Error("Contenu indisponible hors connexion");
}

async function optionalRequest<T>(path: string, fallback: T): Promise<T> {
  try {
    return await request<T>(path);
  } catch {
    return fallback;
  }
}

function asArray<T>(value: unknown, key: string): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && Array.isArray((value as Record<string, unknown>)[key])) return (value as Record<string, T[]>)[key] ?? [];
  return [];
}

async function readLocalDataCache(): Promise<any | null> {
  if (!localDataCacheFile) return null;
  try {
    const raw = await FileSystem.readAsStringAsync(localDataCacheFile, { encoding: FileSystem.EncodingType.UTF8 });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeLocalDataCache(data: any): Promise<void> {
  if (!localDataCacheFile) return;
  try {
    await FileSystem.writeAsStringAsync(localDataCacheFile, JSON.stringify(data), { encoding: FileSystem.EncodingType.UTF8 });
  } catch {}
}

export async function loadData(): Promise<{ subjects: Subject[]; courses: StudyCourse[]; reviews: Review[]; chapterDefinitions: ChapterDefinition[]; revisionSessions: RevisionSession[]; revisionCalendar: RevisionCalendar }> {
  try {
    const [catalog, courses, reviews, chaptersPayload, sessionsPayload, revisionCalendar] = await Promise.all([
      request<{ courses?: Subject[] }>("/api/courses"),
      request<StudyCourse[]>("/api/study-courses"),
      request<Review[]>("/api/reviews"),
      optionalRequest<ChapterDefinition[] | { chapters?: ChapterDefinition[] }>("/api/chapter-definitions", []),
      optionalRequest<RevisionSession[] | { sessions?: RevisionSession[] }>("/api/revision-sessions", []),
      optionalRequest<RevisionCalendar>("/api/revision-calendar?days=14", { calendar: [] }),
    ]);

    const result = {
      subjects: catalog?.courses || [],
      courses: Array.isArray(courses) ? courses : [],
      reviews: Array.isArray(reviews) ? reviews : [],
      chapterDefinitions: asArray<ChapterDefinition>(chaptersPayload, "chapters").length ? asArray<ChapterDefinition>(chaptersPayload, "chapters") : (Array.isArray(chaptersPayload) ? chaptersPayload : []),
      revisionSessions: asArray<RevisionSession>(sessionsPayload, "sessions"),
      revisionCalendar: revisionCalendar || { calendar: [] },
    };

    await writeLocalDataCache(result);
    return result;
  } catch (netErr) {
    const cached = await readLocalDataCache();
    if (cached && cached.subjects && cached.subjects.length > 0) {
      return cached;
    }
    return {
      subjects: [],
      courses: [],
      reviews: [],
      chapterDefinitions: [],
      revisionSessions: [],
      revisionCalendar: { calendar: [] },
    };
  }
}

export async function createSubject(subject: { title: string; semester: "S1" | "S2"; category?: string; ects?: number }): Promise<Subject> {
  return request<Subject>("/api/courses", {
    method: "POST",
    body: JSON.stringify(subject),
  });
}

export async function deleteSubject(subjectId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/courses/${encodeURIComponent(subjectId)}`, {
    method: "DELETE",
  });
}

export async function createChapter(subjectId: string, title: string): Promise<ChapterDefinition> {
  return request<ChapterDefinition>("/api/chapter-definitions", {
    method: "POST",
    body: JSON.stringify({ subjectId, title }),
  });
}

export async function deleteChapter(id: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/chapter-definitions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function deleteCourse(id: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/study-courses/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function unlockCourseRecall(courseId: string, recallText: string): Promise<{ course: StudyCourse; evaluation: RecallEvaluation }> {
  return request<{ course: StudyCourse; evaluation: RecallEvaluation }>(
    `/api/study-courses/${encodeURIComponent(courseId)}/unlock-recall`,
    {
      method: "POST",
      body: JSON.stringify({ recallText }),
    },
    45000
  );
}

export async function saveReview(payload: { courseId?: string; cardId: string; rating: number; weakConcepts?: any[]; createdAt?: string }): Promise<Review> {
  return request<Review>("/api/reviews", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loadCourseSummary(filename: string): Promise<string> {
  return requestText(`/api/courses/content?file=${encodeURIComponent(filename)}`);
}

export async function syncRecording(recording: LocalRecording): Promise<any> {
  return request(
    "/api/mobile/sync",
    {
      method: "POST",
      body: JSON.stringify({
        recordingId: recording.id,
        title: recording.title,
        subjectId: recording.subjectId,
        subjectTitle: recording.subjectTitle,
        chapter: recording.chapter,
        chapterId: recording.chapterId,
        partLabel: recording.partLabel,
        partScope: recording.partScope,
        date: recording.date,
        notes: recording.notes,
        recordingMarkers: recording.recordingMarkers || [],
        photos: recording.photos || [],
        audioDurationMs: recording.audioDurationMs || 0,
        transcript: "",
      }),
    },
    60000
  );
}

const offlinePendingReviewsFile = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}pending-reviews.v1.json` : null;

export async function enqueueOfflineReview(review: any): Promise<void> {
  if (!offlinePendingReviewsFile) return;
  try {
    let list: any[] = [];
    if (await FileSystem.getInfoAsync(offlinePendingReviewsFile).then((r) => r.exists)) {
      const raw = await FileSystem.readAsStringAsync(offlinePendingReviewsFile);
      list = JSON.parse(raw);
    }
    list.push(review);
    await FileSystem.writeAsStringAsync(offlinePendingReviewsFile, JSON.stringify(list));
  } catch (e) {
    console.warn("Failed to enqueue offline review:", e);
  }
}

export async function syncPendingReviews(): Promise<number> {
  if (!offlinePendingReviewsFile) return 0;
  try {
    const info = await FileSystem.getInfoAsync(offlinePendingReviewsFile);
    if (!info.exists) return 0;
    const raw = await FileSystem.readAsStringAsync(offlinePendingReviewsFile);
    const pending = JSON.parse(raw);
    if (!Array.isArray(pending) || pending.length === 0) return 0;

    const res = await request<{ ok: boolean; savedCount: number }>("/api/reviews/batch", {
      method: "POST",
      body: JSON.stringify({ reviews: pending }),
    });

    if (res && res.ok) {
      await FileSystem.deleteAsync(offlinePendingReviewsFile, { idempotent: true });
      return pending.length;
    }
    return 0;
  } catch (e) {
    console.warn("Failed to sync pending reviews:", e);
    return 0;
  }
}

export async function getInterleavedTraining(count = 15, subjects?: string[]): Promise<any[]> {
  try {
    const params = new URLSearchParams({ count: String(count) });
    if (subjects && subjects.length > 0) {
      params.set("subjects", subjects.join(","));
    }
    const data = await request<{ ok: boolean; count: number; items: any[] }>(`/api/training/interleaved?${params.toString()}`);
    return data.items || [];
  } catch (e) {
    console.warn("Failed to load interleaved training:", e);
    return [];
  }
}

export async function getExamTrapsAndErrors(): Promise<any[]> {
  try {
    const data = await request<{ ok: boolean; count: number; items: any[] }>("/api/training/traps");
    return data.items || [];
  } catch (e) {
    console.warn("Failed to load exam traps:", e);
    return [];
  }
}

export async function evaluateFeynman(courseId: string, cardId: string, explanationText: string): Promise<{
  score: number;
  causalScore: number;
  level: string;
  feedback: string;
  masteredKeywords: string[];
  missingKeywords: string[];
  improvedFeynman: string;
} | null> {
  try {
    const data = await request<{ ok: boolean; evaluation: any }>(
      "/api/training/feynman-evaluate",
      {
        method: "POST",
        body: JSON.stringify({ courseId, cardId, explanationText }),
      },
      45000
    );
    return data.evaluation || null;
  } catch (e) {
    console.warn("Feynman evaluation failed:", e);
    return null;
  }
}

export async function getExams(): Promise<ExamPlan[]> {
  try {
    const data = await request<ExamPlan[]>("/api/exams");
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn("Failed to load exams:", e);
    return [];
  }
}

export async function createExam(payload: {
  title: string;
  date: string;
  subjectId?: string | null;
  subjectTitle?: string;
  chapterIds?: string[];
  minutesPerDay?: number;
}): Promise<ExamPlan | null> {
  try {
    const data = await request<ExamPlan>("/api/exams", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data || null;
  } catch (e) {
    console.warn("Failed to create exam:", e);
    return null;
  }
}

export async function deleteExam(id: string): Promise<boolean> {
  try {
    const data = await request<{ ok: boolean }>(`/api/exams/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return !!(data && data.ok);
  } catch (e) {
    console.warn("Failed to delete exam:", e);
    return false;
  }
}

export async function getRevisionCalendar(days = 7): Promise<any> {
  try {
    const data = await request<any>(`/api/revision-calendar?days=${days}`);
    return data || null;
  } catch (e) {
    console.warn("Failed to load revision calendar:", e);
    return null;
  }
}

export async function prepareOralSession(payload: {
  subjectId?: string | null;
  subjectTitle?: string | null;
  chapter?: string | null;
  courseId?: string | null;
  courseTitle?: string | null;
  prompt: string;
}): Promise<boolean> {
  try {
    const data = await request<{ ok: boolean }>("/api/oral/prepare", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return !!(data && data.ok);
  } catch (e) {
    console.warn("Failed to prepare oral session:", e);
    return false;
  }
}

export async function getWeaknesses(): Promise<any[]> {
  try {
    const data = await request<{ ok: boolean; weaknesses: any[] }>("/api/weaknesses");
    return data.weaknesses || [];
  } catch (e) {
    console.warn("Failed to load weaknesses:", e);
    return [];
  }
}

// SYNCHRONISATION DES ENREGISTREMENTS HORS-LIGNE
export async function syncPendingRecordings(): Promise<number> {
  try {
    const recordings = await readRecordings();
    const pending = recordings.filter((r) => r.status === "local" || r.status === "erreur");
    if (pending.length === 0) return 0;

    let syncedCount = 0;
    for (const rec of pending) {
      try {
        await syncRecording(rec);
        await upsertRecording({ ...rec, status: "synchronise", syncedAt: new Date().toISOString() });
        syncedCount++;
      } catch (err) {
        // Enregistrement préservé localement sur le smartphone
      }
    }
    return syncedCount;
  } catch (e) {
    console.warn("Failed to sync pending recordings:", e);
    return 0;
  }
}

// GESTION DE LA CORBEILLE 30 JOURS (SOFT DELETE)
export async function deleteCourseWithTrash(course: StudyCourse): Promise<boolean> {
  try {
    await moveToTrash(course);
    try {
      await deleteCourse(course.id);
    } catch {}
    return true;
  } catch (e) {
    console.warn("Failed to delete course with trash:", e);
    return false;
  }
}

export async function readTrashCourses(): Promise<TrashedCourse[]> {
  return readTrash();
}

export async function restoreTrashCourse(courseId: string): Promise<StudyCourse | null> {
  return restoreFromTrash(courseId);
}


