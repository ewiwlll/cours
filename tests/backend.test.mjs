import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  courseForResponse,
  nextCourseNumber,
  normalizePartFields,
  normalizePartScope,
  normalizeRecordingMarkers,
  normalizeScore,
  normalizeTranscriptSections,
  proposeTranscriptSections,
  recurringErrorsForSessions,
  progressionsForCourses,
} from "../server.mjs";
import {
  nextAttemptAt,
  retryDelayMs,
  retryableProcessed,
  retryWindowOpen,
} from "../automation.mjs";

test("normalise les portées sans accepter un texte ambigu", () => {
  assert.deepEqual(normalizePartScope(" parties 1 à 3 "), { start: 1, end: 3, label: "Parties 1 à 3" });
  assert.deepEqual(normalizePartFields({ partLabel: "partie 2" }), { partScope: { start: 2, end: 2, label: "Partie 2" }, partLabel: "Partie 2", automaticNumber: null });
  assert.throws(() => normalizePartScope("cours 3"), /portée/i);
  assert.throws(() => normalizePartFields({ partLabel: "Phase 0" }), /numéro/i);
  assert.throws(() => normalizePartFields({ partLabel: "partie 1", partScope: { start: 2, end: 2 } }), /correspondent/i);
});

test("conserve le libellé manuel et alloue le numéro dans le chapitre", () => {
  const courses = [
    { id: "a", subjectId: "maths", chapterId: "chapter-1", courseNumber: 1 },
    { id: "b", subjectId: "maths", chapterId: "chapter-1", courseNumber: 3 },
    { id: "c", subjectId: "maths", chapterId: "chapter-2", courseNumber: 1 },
  ];
  assert.equal(nextCourseNumber(courses, "maths", "chapter-1"), 4);
  const response = courseForResponse({
    id: "course-1",
    subjectId: "maths",
    title: "Cours",
    status: "a-traiter",
    partLabel: "partie 2",
    partScope: { start: 2, end: 2, label: "Partie 2" },
    cards: [],
  }, { chapterDefinitions: [], sessions: [], reviews: [] });
  assert.equal(response.partLabel, "Partie 2");
  assert.deepEqual(response.partScope, { start: 2, end: 2, label: "Partie 2" });
});

test("calcule une reprise bornée et respecte la fenêtre d'attente", () => {
  assert.equal(retryDelayMs(1, { retry: { baseMs: 1000, maxMs: 5000 } }), 1000);
  assert.equal(retryDelayMs(4, { retry: { baseMs: 1000, maxMs: 5000 } }), 5000);
  const next = nextAttemptAt(2, { retry: { baseMs: 1000, maxMs: 5000 } }, new Date("2026-08-19T10:00:00.000Z"));
  assert.equal(next, "2026-08-19T10:00:02.000Z");
  assert.equal(retryWindowOpen({ nextAttemptAt: "2026-08-19T10:00:02.000Z" }, Date.parse("2026-08-19T10:00:01.000Z")), false);
  assert.equal(retryableProcessed({ status: "error", retryable: false }), false);
  assert.equal(retryableProcessed({ status: "error", retryable: true }), true);
});

test("normalise les marqueurs, sections et signaux récurrents sans inventer de contenu", () => {
  const marker = normalizeRecordingMarkers([{ id: "m", offsetMs: 12.7, kind: "exemple", label: "schéma" }])[0];
  assert.deepEqual({ id: marker.id, offsetMs: marker.offsetMs, kind: marker.kind, label: marker.label }, { id: "m", offsetMs: 13, kind: "example", label: "schéma" });
  assert.deepEqual(normalizeTranscriptSections([{ id: "s", title: "Partie", startOffsetMs: 0, endOffsetMs: 1000, partStart: 1, partEnd: 1, status: "validated" }])[0].status, "validated");
  const proposed = proposeTranscriptSections({}, "Un texte de cours suffisamment réel.\n\nUne deuxième partie réellement transcrite.");
  assert.equal(proposed.length, 2);
  assert.equal(proposed[0].title, "Section 1");
  const sessions = [
    { id: "a", courseId: "c", rating: 1, missing: ["mitose"], createdAt: "2026-01-01T00:00:00Z" },
    { id: "b", courseId: "c", rating: 2, missing: ["mitose"], createdAt: "2026-01-02T00:00:00Z" },
  ];
  assert.equal(recurringErrorsForSessions(sessions)[0].count, 2);
  assert.equal(normalizeScore(0.8), 80);
  assert.equal(normalizeScore(80), 80);
  const progression = progressionsForCourses([{ id: "c", title: "Cours" }], [{ ...sessions[0], type: "course-recall", score: 20, answerText: "avant" }, { ...sessions[1], type: "course-recall", score: 0.8, answerText: "après" }])[0];
  assert.equal(progression.first.score, 0.2);
  assert.equal(progression.delta, 0.6);
  const differentScopes = [
    { ...sessions[0], type: "course-recall", score: 20, partScope: { start: 1, end: 1 } },
    { ...sessions[1], type: "course-recall", score: 80, partScope: { start: 2, end: 2 } },
  ];
  assert.deepEqual(progressionsForCourses([{ id: "c", title: "Cours" }], differentScopes), []);
  const mastered = [...sessions, { id: "c", courseId: "c", rating: 3, weakConcepts: [{ id: "mitose", label: "Mitose", status: "mastered" }], createdAt: "2026-01-03T00:00:00Z" }];
  assert.deepEqual(recurringErrorsForSessions(mastered), []);
  const sameLabelAnotherCourse = [...sessions, { id: "c", courseId: "other", rating: 3, weakConcepts: [{ id: "mitose", label: "Mitose", status: "mastered" }], createdAt: "2026-01-03T00:00:00Z" }];
  assert.equal(recurringErrorsForSessions(sameLabelAnotherCourse)[0].count, 2);
});

test("synchronise deux reprises concurrentes d'un même enregistrement sans perdre les pièces", async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), "biomia-sync-"));
  const data = path.join(fixture, "data");
  await Promise.all([
    mkdir(path.join(data, "cours"), { recursive: true }),
    mkdir(path.join(data, "transcriptions"), { recursive: true }),
    mkdir(path.join(data, "enregistrements"), { recursive: true }),
    mkdir(path.join(data, "revisions"), { recursive: true }),
    mkdir(path.join(data, "automation"), { recursive: true }),
  ]);
  await writeFile(path.join(data, "courses.json"), JSON.stringify({ courses: [{ id: "s1-maths", title: "Maths" }] }));
  await writeFile(path.join(data, "cours", "chapter-definitions.json"), JSON.stringify([{ id: "chapter-1", subjectId: "s1-maths", title: "Organisation" }]));
  await writeFile(path.join(data, "cours", "index.json"), "[]\n");
  await writeFile(path.join(data, "enregistrements", "index.json"), "[]\n");
  await writeFile(path.join(data, "transcriptions", "index.json"), "[]\n");

  const port = 45000 + Math.floor(Math.random() * 1000);
  const serverPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "server.mjs");
  const child = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env: { ...process.env, BIOMIA_DATA_DIR: data, BIOMIA_PORT: String(port), BIOMIA_HOST: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    child.kill("SIGTERM");
    await rm(fixture, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Serveur de test non démarré")), 5000);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Serveur Cours") || String(chunk).includes("Cours")) { clearTimeout(timeout); resolve(); }
    });
    child.once("error", (error) => { clearTimeout(timeout); reject(error); });
  });

  const audioBase64 = Buffer.from("fake-audio").toString("base64");
  const photoBase64 = Buffer.from("fake-photo").toString("base64");
  const base = { recordingId: "mobile-same-recording", title: "Cours 1", subjectId: "s1-maths", subjectTitle: "Matière falsifiée", chapterId: "chapter-1", strictChapterSelection: true, date: "2026-08-19", mimeType: "audio/m4a", audioBase64, partLabel: "Phase 99" };
  const requests = [
    fetch(`http://127.0.0.1:${port}/api/mobile/sync`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...base, notes: "Note à conserver", photos: [{ id: "photo-1", filename: "schema.jpg", mimeType: "image/jpeg", dataBase64: photoBase64 }] }) }),
    fetch(`http://127.0.0.1:${port}/api/mobile/sync`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...base, notes: "", photos: [{ id: "photo-1", filename: "schema.jpg", mimeType: "image/jpeg", dataBase64: photoBase64 }], transcript: "Cette transcription contient suffisamment de contenu pédagogique pour être acceptée par la validation du serveur." }) }),
  ];
  const responses = await Promise.all(requests);
  assert.ok(responses.every((response) => response.ok));
  const retryResponse = await fetch(`http://127.0.0.1:${port}/api/mobile/sync`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...base, notes: "", audioBase64: undefined }) });
  const retryPayload = await retryResponse.json();
  assert.equal(retryResponse.ok, true);
  assert.equal(retryPayload.transcriptionReceived, true);
  const secondAttachmentResponse = await fetch(`http://127.0.0.1:${port}/api/mobile/sync`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...base, audioBase64: undefined, photos: [{ id: "photo-2", filename: "schema.jpg", mimeType: "image/jpeg", dataBase64: photoBase64, offsetMs: 42 }] }) });
  assert.equal(secondAttachmentResponse.ok, true);
  const courses = await (await fetch(`http://127.0.0.1:${port}/api/study-courses`)).json();
  const matches = courses.filter((course) => course.externalRecordingId === "mobile-same-recording");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].notes, "Note à conserver");
  assert.equal(matches[0].photos.length, 2);
  assert.equal(matches[0].photos.find((photo) => photo.id === "photo-2").offsetMs, 42);
  assert.equal(matches[0].subjectTitle, "Maths");
  assert.equal(matches[0].partLabel, "Phase 1");
  assert.equal(matches[0].chapterId, "chapter-1");
  assert.ok(matches[0].transcriptionFilename);
  const recordings = JSON.parse(await readFile(path.join(data, "enregistrements", "index.json"), "utf8"));
  assert.equal(recordings.filter((item) => item.recordingId === "mobile-same-recording").length, 1);
  const transcriptions = JSON.parse(await readFile(path.join(data, "transcriptions", "index.json"), "utf8"));
  assert.equal(transcriptions.filter((item) => item.courseId === matches[0].id).length, 1);

  const insightsResponse = await fetch(`http://127.0.0.1:${port}/api/learning-insights`);
  const insights = await insightsResponse.json();
  assert.equal(insightsResponse.ok, true);
  assert.ok(Array.isArray(insights.recurringErrors));
  assert.ok(Array.isArray(insights.progression));

  const adaptiveResponse = await fetch(`http://127.0.0.1:${port}/api/adaptive-session`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ minutes: 5 }) });
  const adaptive = await adaptiveResponse.json();
  assert.equal(adaptiveResponse.ok, true);
  assert.deepEqual(adaptive.items, []);
  const oralEmptyResponse = await fetch(`http://127.0.0.1:${port}/api/adaptive-session`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ minutes: 5, mode: "oral-exam" }) });
  const oralEmpty = await oralEmptyResponse.json();
  assert.equal(oralEmptyResponse.ok, true);
  assert.deepEqual(oralEmpty.cardIds, []);

  const pastExamResponse = await fetch(`http://127.0.0.1:${port}/api/exams`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date: "2020-01-01", subjectId: "s1-maths", chapterIds: ["chapter-1"], minutesPerDay: 20 }) });
  assert.equal(pastExamResponse.status, 400);
  const examResponse = await fetch(`http://127.0.0.1:${port}/api/exams`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date: "2099-12-31", subjectId: "s1-maths", chapterIds: ["chapter-1"], minutesPerDay: 20 }) });
  const exam = await examResponse.json();
  assert.equal(examResponse.status, 201);
  assert.deepEqual(exam.planning, []);
  const examDetailResponse = await fetch(`http://127.0.0.1:${port}/api/exams/${encodeURIComponent(exam.id)}`);
  assert.equal(examDetailResponse.ok, true);
  const examDeleteResponse = await fetch(`http://127.0.0.1:${port}/api/exams/${encodeURIComponent(exam.id)}`, { method: "DELETE" });
  assert.equal(examDeleteResponse.ok, true);

  const oralSessionResponse = await fetch(`http://127.0.0.1:${port}/api/revision-sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "oral-exam", courseIds: [matches[0].id], answers: [{ courseId: matches[0].id, cardId: "existing-only", rating: 2 }], completed: false }) });
  const oralSession = await oralSessionResponse.json();
  assert.equal(oralSessionResponse.status, 201);
  assert.deepEqual(oralSession.courseIds, [matches[0].id]);
});
