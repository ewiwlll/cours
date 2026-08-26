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
