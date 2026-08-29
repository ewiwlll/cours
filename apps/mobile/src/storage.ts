import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";

const KEY = "biomia.mobile.recordings.v1";
const recordingsFile = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}cours-recordings.v2.json` : null;

export type RecordingPartScope = { start: number; end: number; label: string };
export type RecordingMarker = { id: string; kind: "important" | "unclear" | "example" | "question"; label: string; offsetMs: number; createdAt: string };
export type LocalRecordingPhoto = { id: string; uri: string; name: string; mimeType: string; offsetMs?: number; markerId?: string };

export type LocalRecording = {
  id: string;
  title: string;
  subjectId: string;
  subjectTitle: string;
  chapter?: string;
  chapterId?: string;
  partLabel?: string;
  partScope?: string | RecordingPartScope;
  courseNumber?: number;
  date: string;
  uri: string;
  mimeType: string;
  notes?: string;
  photos?: LocalRecordingPhoto[];
  recordingMarkers?: RecordingMarker[];
  audioDurationMs?: number;
  status: "local" | "synchronisation" | "synchronise" | "synchronise-attente-transcription" | "erreur";
  error?: string;
  syncedAt?: string;
  syncAttemptCount?: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
};

function valid(value: unknown): value is LocalRecording {
  const item = value as Partial<LocalRecording>;
  return Boolean(item && typeof item.id === "string" && typeof item.title === "string" && typeof item.uri === "string" && typeof item.subjectId === "string");
}

export async function readRecordings(): Promise<LocalRecording[]> {
  if (recordingsFile) {
    try {
      const raw = await FileSystem.readAsStringAsync(recordingsFile, { encoding: FileSystem.EncodingType.UTF8 });
      const value: unknown = JSON.parse(raw);
      if (Array.isArray(value)) return value.filter(valid);
    } catch {
      // Migrate the legacy SecureStore queue below, or return an empty queue.
    }
  }

  try {
    const raw = await SecureStore.getItemAsync(KEY);
    const value: unknown = raw ? JSON.parse(raw) : [];
    const items = Array.isArray(value) ? value.filter(valid) : [];
    if (recordingsFile && items.length) {
      try {
        await FileSystem.writeAsStringAsync(recordingsFile, JSON.stringify(items), { encoding: FileSystem.EncodingType.UTF8 });
      } catch {
        // Keep the legacy copy if the migration cannot be completed yet.
      }
    }
    return items;
  } catch {
    return [];
  }
}

export async function writeRecordings(items: LocalRecording[]): Promise<void> {
  const serialized = JSON.stringify(items);
  if (recordingsFile) {
    try {
      await FileSystem.writeAsStringAsync(recordingsFile, serialized, { encoding: FileSystem.EncodingType.UTF8 });
      return;
    } catch {
      // Fall back to SecureStore for devices where the document directory is unavailable.
    }
  }
  await SecureStore.setItemAsync(KEY, serialized);
}

let recordingsWriteQueue = Promise.resolve();

export async function upsertRecording(item: LocalRecording): Promise<LocalRecording[]> {
  const operation = recordingsWriteQueue.then(async () => {
    const items = await readRecordings();
    const next = [item, ...items.filter((candidate) => candidate.id !== item.id)];
    await writeRecordings(next);
    return next;
  });
  recordingsWriteQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

// CORBEILLE LOCALE SÉCURISÉE (RÉTENTION 30 JOURS)
const trashFile = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}cours-trash.v1.json` : null;

export type TrashedCourse = {
  course: any;
  deletedAt: string;
  expiresAt: string;
};

export async function readTrash(): Promise<TrashedCourse[]> {
  if (!trashFile) return [];
  try {
    const raw = await FileSystem.readAsStringAsync(trashFile, { encoding: FileSystem.EncodingType.UTF8 });
    const list: TrashedCourse[] = JSON.parse(raw);
    const now = Date.now();
    // Purge automatique des cours supprimés il y a plus de 30 jours
    const active = list.filter((item) => {
      const deletedTime = new Date(item.deletedAt).getTime();
      return now - deletedTime < 30 * 24 * 60 * 60 * 1000;
    });
    if (active.length !== list.length) {
      await writeTrash(active);
    }
    return active;
  } catch {
    return [];
  }
}

export async function writeTrash(items: TrashedCourse[]): Promise<void> {
  if (!trashFile) return;
  try {
    await FileSystem.writeAsStringAsync(trashFile, JSON.stringify(items), { encoding: FileSystem.EncodingType.UTF8 });
  } catch {}
}

export async function moveToTrash(course: any): Promise<void> {
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const trash = await readTrash();
  const next = [
    { course, deletedAt: now.toISOString(), expiresAt: expires.toISOString() },
    ...trash.filter((t) => t.course.id !== course.id),
  ];
  await writeTrash(next);
}

export async function restoreFromTrash(courseId: string): Promise<any | null> {
  const trash = await readTrash();
  const found = trash.find((t) => t.course.id === courseId);
  if (!found) return null;
  const remaining = trash.filter((t) => t.course.id !== courseId);
  await writeTrash(remaining);
  return found.course;
}
