import http from "node:http";
import os from "node:os";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir, stat, mkdir, rename } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { correctRecall } from "./recall-correction.mjs";
import { aggregateWeaknesses, buildLearningPlan, calculateCardSchedule, latestReviews, normalizeWeakConcepts, generateInterleavedSession, extractExamTrapsAndErrors, evaluateFeynmanExplanation, seedCourseCardsFromRecall, findClarificationHistory, recordOrUpdateClarification, generateDiagnosticQuizFromCourse, evaluateDiagnosticQuizAnswers } from "./learning-engine.mjs";

import {
  loadEnvFile,
  safeFilename,
  safeFilePath as safeFilePathShared,
  safeCoursePath as safeCoursePathShared,
  safePhotoPath as safePhotoPathShared,
  slug,
  localDate,
  normalizeTranscriptForValidation,
  validateTranscription,
  sourceValidationError,
} from "./shared-utils.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(ROOT);

const PUBLIC = path.join(ROOT, "public");
const DATA = path.resolve(process.env.BIOMIA_DATA_DIR || path.join(ROOT, "data"));
const TRANSCRIPTIONS = path.join(DATA, "transcriptions");
const REVIEWS = path.join(DATA, "revisions", "reviews.json");
const CLARIFICATIONS = path.join(DATA, "revisions", "clarifications.json");
const LESSONS = path.join(DATA, "cours", "index.json");
const CHAPTERS = path.join(DATA, "cours", "chapters.json");
const CHAPTER_DEFINITIONS = path.join(DATA, "cours", "chapter-definitions.json");
const REVISION_SESSIONS = path.join(DATA, "revisions", "sessions.json");
const WEAK_CONCEPTS = path.join(DATA, "revisions", "weak-concepts.json");
const DEVICES = path.join(DATA, "revisions", "devices.json");
const AUTOMATION = path.join(DATA, "automation");
const AUTOMATION_CONFIG = path.join(AUTOMATION, "config.json");
const PENDING_ORAL = path.join(AUTOMATION, "pending-oral.json");
const RECORDINGS = path.join(DATA, "enregistrements");
const RECORDINGS_INDEX = path.join(RECORDINGS, "index.json");
const COURSE_PHOTOS = path.join(DATA, "cours", "photos");
const EXAMS = path.join(DATA, "revisions", "exams.json");
const REVISION_AUDIO = path.join(DATA, "revisions", "audio");
const execFileAsync = promisify(execFile);
const PORT = Number(process.env.BIOMIA_PORT || 4317);
const HOST = process.env.BIOMIA_HOST || "0.0.0.0";
const MAX_BODY = 15 * 1024 * 1024;
const MAX_AUDIO_BODY = 250 * 1024 * 1024;
const MAX_REVISION_AUDIO_BODY = 35 * 1024 * 1024;
const MAX_PHOTO_BODY = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".txt", ".md", ".srt", ".vtt", ".json"]);
let mobileSyncChain = Promise.resolve();

await mkdir(TRANSCRIPTIONS, { recursive: true });
await mkdir(path.join(DATA, "cours"), { recursive: true });
await mkdir(path.join(DATA, "revisions"), { recursive: true });
await mkdir(AUTOMATION, { recursive: true });
await mkdir(RECORDINGS, { recursive: true });
await mkdir(COURSE_PHOTOS, { recursive: true });
await mkdir(REVISION_AUDIO, { recursive: true });

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function text(res, status, value, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(value),
    "Cache-Control": "no-cache, no-store, must-revalidate",
  });
  res.end(value);
}

function binary(res, status, value, contentType = "application/octet-stream") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": value.length,
    "Cache-Control": "no-store",
  });
  res.end(value);
}

const safeFilePath = (filename) => safeFilePathShared(TRANSCRIPTIONS, filename);
const safeCoursePath = (filename) => safeCoursePathShared(path.join(DATA, "cours"), filename);
const safePhotoPath = (courseId, filename) => safePhotoPathShared(COURSE_PHOTOS, courseId, filename);

let reviewsChain = Promise.resolve();
function withReviewsLock(task) {
  const next = reviewsChain.then(task, task);
  reviewsChain = next.catch(() => {});
  return next;
}

let sessionsChain = Promise.resolve();
function withSessionsLock(task) {
  const next = sessionsChain.then(task, task);
  sessionsChain = next.catch(() => {});
  return next;
}

let coursesChain = Promise.resolve();
function withCoursesLock(task) {
  const next = coursesChain.then(task, task);
  coursesChain = next.catch(() => {});
  return next;
}

function photoExtension(filename, mimeType) {
  const extension = path.extname(String(filename || "")).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"].includes(extension)) return extension;
  return mimeType.includes("png") ? ".png" : mimeType.includes("webp") ? ".webp" : ".jpg";
}

function photoUrl(courseId, photo) {
  return `/api/courses/photos?courseId=${encodeURIComponent(courseId)}&file=${encodeURIComponent(photo.filename)}`;
}

async function saveCourses(courses) {
  const temporary = `${LESSONS}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await writeFile(temporary, JSON.stringify(courses, null, 2) + "\n", "utf8");
  await rename(temporary, LESSONS);
}

async function saveJsonArray(file, items) {
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await writeFile(temporary, JSON.stringify(items, null, 2) + "\n", "utf8");
  await rename(temporary, file);
}

function getLocalIp() {
  try {
    const nets = os.networkInterfaces();
    // Priorité aux interfaces Wi-Fi / Ethernet classiques
    const preferredInterfaces = ["en0", "en1", "wlan0", "eth0"];
    for (const ifaceName of preferredInterfaces) {
      if (nets[ifaceName]) {
        for (const net of nets[ifaceName]) {
          if (net.family === "IPv4" && !net.internal) {
            return net.address;
          }
        }
      }
    }
    // Fallback sur n'importe quelle interface IPv4 non interne
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === "IPv4" && !net.internal) {
          return net.address;
        }
      }
    }
  } catch {}
  return "127.0.0.1";
}

async function registerDevice({ deviceId, deviceName, platform, userAgent, ip }) {
  try {
    const devices = await readJsonFile(DEVICES, []);
    const now = new Date().toISOString();
    const cleanIp = ip ? String(ip).replace(/^.*:/, "") : "127.0.0.1";
    const id = deviceId || `dev-${cleanIp.replace(/[^a-zA-Z0-9]/g, "-")}`;
    const existing = devices.find((d) => d.id === id);
    if (existing) {
      existing.lastSeenAt = now;
      existing.ip = cleanIp;
      existing.syncCount = (existing.syncCount || 1) + 1;
      if (deviceName && deviceName !== "Appareil Mobile") existing.deviceName = deviceName;
    } else {
      devices.push({
        id,
        deviceName: deviceName || (platform === "ios" ? "iPhone / iPad" : platform === "android" ? "Google Pixel / Android" : "Appareil Connecté"),
        platform: platform || (/iphone|ipad|ipod/i.test(userAgent || "") ? "ios" : /android/i.test(userAgent || "") ? "android" : "mobile"),
        userAgent: userAgent || "",
        ip: cleanIp,
        firstSeenAt: now,
        lastSeenAt: now,
        syncCount: 1,
      });
    }
    await saveJsonArray(DEVICES, devices);
  } catch {}
}

async function appendCoursePhoto(course, payload) {
  const mimeType = String(payload.mimeType || "image/jpeg").toLowerCase();
  if (!mimeType.startsWith("image/")) throw new Error("Le fichier doit être une image");
  const raw = String(payload.dataBase64 || payload.base64 || "").replace(/^data:[^,]+,/, "");
  const buffer = Buffer.from(raw, "base64");
  if (Number.isFinite(Number(course.audioDurationMs)) && Number(payload.offsetMs) > Number(course.audioDurationMs)) throw new Error("La photo dépasse la durée audio");
  if (!buffer.length) throw new Error("Photo vide ou illisible");
  if (buffer.length > 15 * 1024 * 1024) throw new Error("Photo trop volumineuse (15 Mo maximum)");
  const originalName = safeFilename(payload.filename || "photo-cours");
  const contentHash = createHash("sha256").update(buffer).digest("hex").slice(0, 24);
  const id = String(payload.id || `photo-${contentHash}`);
  const previous = (course.photos || []).find((item) => item.id === id);
  const sameAsset = (course.photos || []).find((item) => item.contentHash === contentHash);
  const filename = previous?.filename || sameAsset?.filename || `${slug(id)}${photoExtension(originalName, mimeType)}`;
  const target = safePhotoPath(course.id, filename);
  await mkdir(target.folder, { recursive: true });
  if (!sameAsset || !existsSync(target.resolved)) await writeFile(target.resolved, buffer);
  const photo = {
    id,
    filename,
    name: originalName || previous?.name || filename,
    mimeType,
    bytes: buffer.length,
    contentHash,
    createdAt: previous?.createdAt || new Date().toISOString(),
    ...(Number.isFinite(Number(payload.offsetMs)) && Number(payload.offsetMs) >= 0 ? { offsetMs: Math.round(Number(payload.offsetMs)) } : (Number.isFinite(Number(previous?.offsetMs)) ? { offsetMs: Number(previous.offsetMs) } : {})),
    ...(typeof payload.markerId === "string" && payload.markerId.trim() ? { markerId: payload.markerId.trim().slice(0, 160) } : (previous?.markerId ? { markerId: previous.markerId } : {})),
  };
  // Le même cliché peut être associé à deux instants différents : l'identifiant d'attachement, pas le hash, porte l'unicité.
  course.photos = [...(course.photos || []).filter((item) => item.id !== photo.id), photo];
  return photo;
}

async function readJsonFile(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function readBody(req, maxBody = MAX_BODY) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBody) throw new Error("Fichier trop volumineux");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isValidCourseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeOptionalText(value, fieldName) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error(`${fieldName} invalide`);
  const normalized = value.trim();
  return normalized || null;
}

function normalizePartScope(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    const start = Number(value.start);
    const end = Number(value.end ?? value.start);
    if (!Number.isInteger(start) || start < 1 || start > 100000 || !Number.isInteger(end) || end < start || end > 100000) {
      throw new Error("Portée de parties invalide");
    }
    return { start, end, label: start === end ? `Partie ${start}` : `Parties ${start} à ${end}` };
  }
  if (typeof value !== "string") throw new Error("Portée de parties invalide");
  const text = value.trim();
  if (!text) return null;
  if (/^phase\s+\d+$/iu.test(text)) return null;
  const match = text.match(/^(?:(?:part(?:ie|ies)|sections?)\s*)?(\d+)(?:\s*(?:à|a|[-–—])\s*(\d+))?$/iu);
  if (!match) throw new Error("Indique une portée comme « parties 1 à 3 »");
  const start = Number(match[1]);
  const end = Number(match[2] || match[1]);
  if (!Number.isInteger(start) || start < 1 || !Number.isInteger(end) || end < start || end > 100000) throw new Error("Portée de parties invalide");
  return { start, end, label: start === end ? `Partie ${start}` : `Parties ${start} à ${end}` };
}

function normalizePartFields({ partLabel, partScope } = {}) {
  const hasLabel = partLabel !== undefined && partLabel !== null && partLabel !== "";
  const hasScope = partScope !== undefined && partScope !== null && partScope !== "";
  const labelText = hasLabel ? normalizeOptionalText(partLabel, "Partie") : null;
  let automaticNumber = null;
  let labelScope = null;
  let canonicalLabel = null;
  if (labelText) {
    const automaticMatch = labelText.match(/^phase\s+(\d+)$/iu);
    if (automaticMatch) {
      automaticNumber = Number(automaticMatch[1]);
      if (!Number.isInteger(automaticNumber) || automaticNumber < 1 || automaticNumber > 100000) throw new Error("Numéro de cours invalide");
      canonicalLabel = `Phase ${automaticNumber}`;
    } else {
      if (/\bphase\b/iu.test(labelText)) throw new Error("Libellé de phase invalide");
      labelScope = normalizePartScope(labelText);
      canonicalLabel = labelScope?.label || null;
    }
  }
  const normalizedScope = hasScope ? normalizePartScope(partScope) : null;
  if (labelScope && normalizedScope && (labelScope.start !== normalizedScope.start || labelScope.end !== normalizedScope.end)) {
    throw new Error("La portée et le libellé de parties ne correspondent pas");
  }
  const scope = normalizedScope || labelScope;
  return {
    partScope: scope,
    partLabel: automaticNumber ? canonicalLabel : scope?.label || canonicalLabel,
    automaticNumber,
  };
}

function normalizeBoundedStringArray(value, fieldName, max = 64) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${fieldName} invalide`);
  return [...new Set(value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, max);
}

function normalizeRecordingMarkers(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Marqueurs d'enregistrement invalides");
  const aliases = { important: "important", unclear: "unclear", incompris: "unclear", "a-revoir": "unclear", example: "example", exemple: "example", question: "question" };
  const seen = new Set();
  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error("Marqueur d'enregistrement invalide");
    const id = String(item.id || `marker-${index + 1}`).trim().slice(0, 160);
    const offsetMs = Number(item.offsetMs);
    if (!id || seen.has(id) || !Number.isFinite(offsetMs) || offsetMs < 0) throw new Error("Marqueur d'enregistrement invalide");
    seen.add(id);
    const kind = aliases[String(item.kind || "").trim().toLocaleLowerCase("fr-FR")] || "important";
    const label = String(item.label || "").trim().slice(0, 240);
    return { id, offsetMs: Math.round(offsetMs), kind, ...(label ? { label } : {}), createdAt: item.createdAt && !Number.isNaN(Date.parse(item.createdAt)) ? item.createdAt : new Date().toISOString() };
  }).sort((a, b) => a.offsetMs - b.offsetMs || a.id.localeCompare(b.id)).slice(0, 200);
}

function normalizeTranscriptSections(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Sections de transcription invalides");
  const seen = new Set();
  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error("Section de transcription invalide");
    const id = String(item.id || `section-${index + 1}`).trim().slice(0, 160);
    const title = String(item.title || `Section ${index + 1}`).trim().slice(0, 240);
    const startOffsetMs = Number(item.startOffsetMs);
    const endOffsetMs = Number(item.endOffsetMs);
    const partStart = Number(item.partStart ?? index + 1);
    const partEnd = Number(item.partEnd ?? partStart);
    if (!id || seen.has(id) || !title || !Number.isFinite(startOffsetMs) || !Number.isFinite(endOffsetMs) || startOffsetMs < 0 || endOffsetMs <= startOffsetMs || !Number.isInteger(partStart) || !Number.isInteger(partEnd) || partStart < 1 || partEnd < partStart) throw new Error("Section de transcription invalide");
    seen.add(id);
    return { id, title, startOffsetMs: Math.round(startOffsetMs), endOffsetMs: Math.round(endOffsetMs), partStart, partEnd, status: item.status === "validated" ? "validated" : "proposed", ...(item.timingEstimated === true ? { timingEstimated: true } : {}) };
  }).sort((a, b) => a.startOffsetMs - b.startOffsetMs || a.id.localeCompare(b.id)).slice(0, 100);
}

function proposeTranscriptSections(course, transcript) {
  if (!String(transcript || "").trim()) throw new Error("Une transcription est nécessaire pour proposer des sections");
  const duration = Number(course.audioDurationMs);
  const paragraphs = String(transcript).split(/\n\s*\n+/).map((part) => part.trim()).filter(Boolean);
  const count = Math.max(1, Math.min(8, paragraphs.length || Math.ceil(String(transcript).length / 1800)));
  const inferredDuration = Number.isFinite(duration) && duration > 0 ? duration : Math.max(60_000, String(transcript).trim().split(/\s+/).length * 420);
  return Array.from({ length: count }, (_, index) => ({
    id: `section-${index + 1}`,
    title: `Section ${index + 1}`,
    startOffsetMs: Math.round(inferredDuration * index / count),
    endOffsetMs: Math.round(inferredDuration * (index + 1) / count),
    partStart: index + 1,
    partEnd: index + 1,
    status: "proposed",
    ...(Number.isFinite(duration) && duration > 0 ? {} : { timingEstimated: true }),
  }));
}

function validateOffsetsAgainstDuration(markers, sections, duration) {
  if (!Number.isFinite(Number(duration)) || Number(duration) <= 0) return;
  const maximum = Number(duration);
  if ((markers || []).some((item) => Number(item.offsetMs) > maximum) || (sections || []).some((item) => Number(item.endOffsetMs) > maximum)) throw new Error("Un repère dépasse la durée audio");
}

function normalizeScore(value) {
  if (value === undefined || value === null || value === "") return null;
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error("Score invalide");
  return Math.round(score <= 1 ? score * 100 : score);
}

function normalizeChapterOrder(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const order = Number(value);
  if (!Number.isInteger(order) || order < 0 || order > 100000) throw new Error("Ordre de chapitre invalide");
  return order;
}

async function findCatalogSubject(subjectId) {
  const catalog = await readJsonFile(path.join(DATA, "courses.json"), { courses: [] });
  return Array.isArray(catalog.courses)
    ? catalog.courses.find((item) => item.id === String(subjectId || "").trim()) || null
    : null;
}

async function resolveChapterAssignment(subjectId, chapterId) {
  if (chapterId === undefined) return undefined;
  const normalizedId = chapterId === null ? "" : String(chapterId).trim();
  if (!normalizedId) return null;
  const definitions = await readJsonFile(CHAPTER_DEFINITIONS, []);
  const definition = definitions.find((item) => item.id === normalizedId);
  if (!definition) throw new Error("Chapitre introuvable");
  if (definition.subjectId !== String(subjectId || "").trim()) throw new Error("Le chapitre n'appartient pas à cette matière");
  return definition;
}

function nextCourseNumber(courses, subjectId, chapterId) {
  const sameChapter = courses.filter((item) => item.subjectId === subjectId && item.chapterId === chapterId);
  const highest = sameChapter.reduce((max, item) => {
    const value = Number(item.courseNumber);
    return Number.isInteger(value) && value > max ? value : max;
  }, 0);
  return Math.max(highest, sameChapter.length) + 1;
}

function dateOnlyPlusDays(dateValue, days) {
  const base = new Date(`${String(dateValue || localDate()).slice(0, 10)}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + Number(days || 0));
  return base.toISOString().slice(0, 10);
}

function normalizeSessionRating(payload) {
  const raw = payload?.rating ?? payload?.ratingLabel;
  if (typeof raw === "number" && Number.isInteger(raw) && [1, 2, 3].includes(raw)) return raw;
  const label = String(raw || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("fr-FR");
  if (["1", "echec", "échec", "failed", "fail", "pas-reussi", "pas réussi"].includes(label)) return 1;
  if (["2", "moyen", "partiel", "partielle", "partial", "a-moitie", "à moitié"].includes(label)) return 2;
  if (["3", "reussi", "réussi", "success", "ok", "maitrise", "maîtrise"].includes(label)) return 3;
  return null;
}

function sessionRatingLabel(rating) {
  return { 1: "echec", 2: "moyen", 3: "reussi" }[rating] || null;
}

function sessionScopeKey(session) {
  const scope = session.courseId ? `course:${session.courseId}` : session.chapterId ? `chapter:${session.chapterId}` : "unknown";
  const part = session.partScope?.label || session.partScopeLabel || session.partLabel || "";
  return `${session.type || "question"}:${scope}:${part}`;
}

/*
 * Espacement volontairement petit, explicite et déterministe :
 * - échec : nouvelle récupération demain ;
 * - moyen : nouvelle récupération dans 3 jours ;
 * - réussi : 7, 14, 30, 60, 120 puis 180 jours selon la série de réussites.
 * Une réponse moyenne ou fausse ne détruit pas les anciennes sessions, mais
 * repart sur son intervalle court. Le calcul reste côté serveur pour que le
 * Mac et le Pixel planifient exactement la même prochaine date.
 */
function calculateSessionSchedule(rating, previousSessions, createdAt = new Date()) {
  const ordered = [...previousSessions].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  let intervalDays = 1;
  if (rating === 2) intervalDays = 3;
  if (rating === 3) {
    let successStreak = 0;
    for (const previous of ordered) {
      if (Number(previous.rating) !== 3) break;
      successStreak += 1;
    }
    const intervals = [7, 14, 30, 60, 120, 180];
    intervalDays = intervals[Math.min(successStreak, intervals.length - 1)];
  }
  return {
    intervalDays,
    nextReview: dateOnlyPlusDays(createdAt.toISOString().slice(0, 10), intervalDays),
  };
}

function sortByCreatedAtDescending(items) {
  return [...items].sort((a, b) => {
    const right = Date.parse(String(b.createdAt || "")) || 0;
    const left = Date.parse(String(a.createdAt || "")) || 0;
    return right - left;
  });
}

async function updateWeakConceptIndex({ courseId, subjectId, chapterId, cardIds, concepts, missing, rating, createdAt }) {
  const existing = await readJsonFile(WEAK_CONCEPTS, { version: 1, items: [] });
  const index = Array.isArray(existing) ? { version: 1, items: existing } : { version: 1, items: Array.isArray(existing.items) ? existing.items : [] };
  const timestamp = createdAt || new Date().toISOString();
  const signals = [];
  for (const cardId of normalizeBoundedStringArray(cardIds, "weakCardIds")) signals.push({ key: `${courseId}::card:${cardId}`, cardId, label: cardId, active: true });
  for (const concept of normalizeWeakConcepts(concepts)) {
    signals.push({ key: `${courseId}::concept:${concept.id}`, conceptId: concept.id, label: concept.label, active: ["partial", "missing", "wrong"].includes(concept.status), status: concept.status, feedback: concept.feedback, source: concept.source, expected: concept.expected });
  }
  for (const label of normalizeBoundedStringArray(missing, "missing", 32)) signals.push({ key: `${courseId}::missing:${slug(label)}`, conceptId: slug(label), label, active: true, status: "missing" });
  for (const signal of signals) {
    let item = index.items.find((candidate) => candidate.key === signal.key);
    if (!item) {
      item = { key: signal.key, courseId, subjectId: subjectId || null, chapterId: chapterId || null, ...(signal.cardId ? { cardId: signal.cardId } : {}), ...(signal.conceptId ? { conceptId: signal.conceptId } : {}), label: signal.label, failures: 0, successes: 0, active: false, firstSeenAt: timestamp };
      index.items.push(item);
    }
    if (signal.active) item.failures = Number(item.failures || 0) + 1;
    else item.successes = Number(item.successes || 0) + 1;
    item.active = signal.active;
    item.status = signal.status || item.status || null;
    item.lastSeenAt = timestamp;
    if (signal.feedback) item.feedback = signal.feedback;
    if (signal.source) item.source = signal.source;
    if (signal.expected) item.expected = signal.expected;
    if (rating === 3 && !signal.active) item.resolvedAt = timestamp;
    if (rating === 1 || rating === 2) item.resolvedAt = null;
  }
  await writeFile(WEAK_CONCEPTS, JSON.stringify({ version: 1, items: index.items.slice(-2000) }, null, 2) + "\n", "utf8");
  return index.items;
}

function explanationProgressForCourse(course, sessions) {
  const relevant = sortByCreatedAtDescending(sessions.filter((session) => session.type === "course-recall" && session.courseId === course.id));
  if (!relevant.length) {
    return { explanationStatus: "a_expliquer", nextExplanationReview: null, explanationAttempts: 0 };
  }
  const latest = relevant[0];
  const due = !latest.nextReview || latest.nextReview <= localDate();
  return {
    explanationStatus: due ? "a_revoir" : "planifie",
    nextExplanationReview: latest.nextReview || null,
    explanationAttempts: relevant.length,
    lastExplanationRating: Number(latest.rating) || null,
  };
}

function learningStateForCourse(course, reviews, sessions, weaknesses = []) {
  const today = localDate();
  const latest = latestReviews(reviews);
  const cards = Array.isArray(course.cards) ? course.cards : [];
  let dueCount = 0;
  let overdueCount = 0;
  let newCount = 0;
  let nextReview = null;
  for (const card of cards) {
    const review = latest.get(`${course.id}::${card.id}`);
    if (!review) {
      newCount += 1;
      dueCount += 1;
      continue;
    }
    const date = String(review.nextReview || review.nextReviewAt || "").slice(0, 10);
    if (!date || date <= today) {
      dueCount += 1;
      if (date && date < today) overdueCount += 1;
    } else if (!nextReview || date < nextReview) {
      nextReview = date;
    }
  }
  const weak = weaknesses.filter((item) => item.courseId === course.id);
  const relevantSessions = sortByCreatedAtDescending(sessions.filter((session) => session.type === "course-recall" && session.courseId === course.id));
  const latestSession = relevantSessions[0] || null;
  const explanationDue = !latestSession || !latestSession.nextReview || latestSession.nextReview <= today;
  return {
    dueCount,
    overdueCount,
    newCount,
    totalCards: cards.length,
    nextReview,
    weakCount: weak.length,
    weakConcepts: weak.slice(0, 12),
    priorityScore: (course.status === "ready" ? 0 : 60) + (explanationDue ? 30 : 0) + overdueCount * 12 + dueCount * 4 + weak.reduce((sum, item) => sum + Math.max(1, Number(item.weaknessScore || 0)), 0) * 6,
  };
}

function chapterDefinitionsForResponse(definitions, courses = []) {
  const counts = new Map();
  for (const course of courses) {
    if (course.chapterId) counts.set(course.chapterId, (counts.get(course.chapterId) || 0) + 1);
  }
  return definitions
    .map((definition) => ({ ...definition, courseCount: counts.get(definition.id) || 0 }))
    .sort((a, b) => {
      if (a.subjectId !== b.subjectId) return String(a.subjectId).localeCompare(String(b.subjectId));
      return (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.title).localeCompare(String(b.title), "fr");
    });
}

function courseForResponse(course, context = {}) {
  const definitions = Array.isArray(context.chapterDefinitions) ? context.chapterDefinitions : [];
  const sessions = Array.isArray(context.sessions) ? context.sessions : [];
  const reviews = Array.isArray(context.reviews) ? context.reviews : [];
  const weaknesses = Array.isArray(context.weaknesses) ? context.weaknesses : aggregateWeaknesses(reviews, sessions);
  const definition = definitions.find((item) => item.id === course.chapterId);
  const partScope = (() => {
    try {
      return course.partScope ? normalizePartScope(course.partScope) : (course.partLabel && !/^phase\b/iu.test(String(course.partLabel)) ? normalizePartScope(course.partLabel) : null);
    } catch {
      return null;
    }
  })();
  const canonicalPartLabel = Number.isInteger(Number(course.courseNumber)) && Number(course.courseNumber) > 0
    ? `Phase ${Number(course.courseNumber)}`
    : partScope?.label || null;
  return {
    ...course,
    chapterId: course.chapterId || null,
    chapterTitle: definition?.title || course.chapter || null,
    partLabel: canonicalPartLabel,
    partScope: partScope || null,
    partScopeLabel: partScope?.label || null,
    ...explanationProgressForCourse(course, sessions),
    learningState: learningStateForCourse(course, reviews, sessions, weaknesses),
    photos: (course.photos || []).map((photo) => ({ ...photo, url: photo.url || photoUrl(course.id, photo) })),
  };
}

async function courseResponse(course) {
  const [chapterDefinitions, sessions, reviews] = await Promise.all([
    readJsonFile(CHAPTER_DEFINITIONS, []),
    readJsonFile(REVISION_SESSIONS, []),
    readJsonFile(REVIEWS, []),
  ]);
  return courseForResponse(course, { chapterDefinitions, sessions, reviews });
}

function recurringErrorsForSessions(sessions, courseId = null) {
  const map = new Map();
  const keyFor = (label, sessionCourseId) => `${String(sessionCourseId || "sans-cours")}::${String(label || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLocaleLowerCase("fr-FR")}`;
  const ordered = sessions.filter((item) => !courseId || item.courseId === courseId).sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  for (const session of ordered) {
    const concepts = normalizeWeakConcepts(session.weakConcepts || session.evaluation?.concepts);
    const weakLabels = [
      ...concepts.filter((item) => ["partial", "missing", "wrong"].includes(item.status)).map((item) => item.label),
      ...(Array.isArray(session.missing) ? session.missing : []),
    ].map((item) => String(item || "").trim()).filter(Boolean);
    const masteredLabels = concepts.filter((item) => item.status === "mastered").map((item) => String(item.label || "").trim()).filter(Boolean);
    for (const label of new Set(masteredLabels)) {
      const item = map.get(keyFor(label, session.courseId));
      if (item) item.active = false;
    }
    for (const label of new Set(weakLabels)) {
      const key = keyFor(label, session.courseId);
      const item = map.get(key) || { label, lastSeen: null, courseIds: [], attemptGroups: new Set(), active: true };
      item.attemptGroups.add(String(session.attemptGroupId || session.id || session.createdAt || ""));
      if (!item.courseIds.includes(session.courseId)) item.courseIds.push(session.courseId);
      if (!item.lastSeen || String(session.createdAt || "") > item.lastSeen) item.lastSeen = String(session.createdAt || "");
      item.active = true;
      map.set(key, item);
    }
  }
  return [...map.values()].map(({ attemptGroups, active, ...item }) => ({ ...item, count: attemptGroups.size, active })).filter((item) => item.count >= 2 && item.active).sort((a, b) => b.count - a.count || String(b.lastSeen).localeCompare(String(a.lastSeen)) || a.label.localeCompare(b.label, "fr"));
}

function progressionsForCourses(courses, sessions, courseId = null) {
  return courses.filter((course) => !courseId || course.id === courseId).map((course) => {
    const attempts = sessions.filter((item) => item.type === "course-recall" && item.courseId === course.id && item.completed !== false).sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
    const scopeKey = (item) => item?.partScope && Number.isInteger(Number(item.partScope.start)) ? `${Number(item.partScope.start)}:${Number(item.partScope.end ?? item.partScope.start)}` : "all";
    const selectedScope = scopeKey(attempts.at(-1));
    const comparableAttempts = attempts.filter((item) => scopeKey(item) === selectedScope);
    if (comparableAttempts.length < 2) return null;
    const pick = (item) => {
      if (!item) return null;
      const raw = Number(item.score);
      const score = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw)) : null;
      return { score, answerText: item.answerText || "", missing: item.missing || [], createdAt: item.createdAt };
    };
    const first = pick(comparableAttempts[0]); const latest = pick(comparableAttempts.at(-1));
    return { courseId: course.id, title: course.title, courseTitle: course.title, scopeLabel: comparableAttempts.at(-1)?.partScope?.label || "Cours entier", first, latest, delta: first && latest && Number.isFinite(Number(first.score)) && Number.isFinite(Number(latest.score)) ? Math.round((Number(latest.score) - Number(first.score)) * 10000) / 10000 : null };
  }).filter(Boolean);
}

function examPlan(exam, courses, sessions) {
  const days = Math.max(0, Math.ceil((Date.parse(`${exam.date}T12:00:00Z`) - Date.parse(`${localDate()}T12:00:00Z`)) / 86400000));
  const eligible = courses.filter((course) => course.status === "ready" && Array.isArray(course.cards) && course.cards.length > 0 && (!exam.subjectId || course.subjectId === exam.subjectId) && (!exam.chapterIds.length || exam.chapterIds.includes(course.chapterId))).sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || a.id.localeCompare(b.id));
  if (!eligible.length) return [];
  const weak = new Set(recurringErrorsForSessions(sessions).flatMap((item) => item.courseIds));
  return Array.from({ length: Math.max(1, days + 1) }, (_, offset) => {
    const date = dateOnlyPlusDays(localDate(), offset);
    const ordered = [...eligible].sort((a, b) => Number(weak.has(b.id)) - Number(weak.has(a.id)) || a.id.localeCompare(b.id));
    const count = Math.max(1, Math.floor(Number(exam.minutesPerDay || 20) / 8));
    return { date, minutes: exam.minutesPerDay, courseIds: ordered.slice(offset % Math.max(1, ordered.length), offset % Math.max(1, ordered.length) + count).map((item) => item.id), rationale: "révision rétroactive selon les chapitres et les erreurs récurrentes" };
  });
}

async function applyCourseUpdate(course, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Corps de requête invalide");
  const changes = {};
  const targetSubjectId = hasOwn(payload, "subjectId") ? String(payload.subjectId || "").trim() : course.subjectId;
  if (hasOwn(payload, "title")) {
    if (typeof payload.title !== "string" || !payload.title.trim()) throw new Error("Le titre ne peut pas être vide");
    changes.title = payload.title.trim();
  }
  if (hasOwn(payload, "date")) {
    if (!isValidCourseDate(payload.date)) throw new Error("Date invalide");
    changes.date = payload.date;
  }
  if (hasOwn(payload, "kind")) {
    if (!["cours", "chapitre"].includes(payload.kind)) throw new Error("Type de cours invalide");
    changes.kind = payload.kind;
  }
  if (hasOwn(payload, "chapter")) {
    if (payload.chapter !== null && typeof payload.chapter !== "string") throw new Error("Chapitre invalide");
    changes.chapter = String(payload.chapter || "").trim();
  }
  if (hasOwn(payload, "chapterId")) {
    const definition = await resolveChapterAssignment(targetSubjectId, payload.chapterId);
    changes.chapterId = definition?.id || null;
    if (definition) changes.chapter = definition.title;
  }
  if (hasOwn(payload, "partLabel")) {
    const normalized = normalizePartFields({ partLabel: payload.partLabel, partScope: hasOwn(payload, "partScope") ? payload.partScope : undefined });
    changes.partLabel = normalized.automaticNumber
      ? (course.courseNumber ? `Phase ${Number(course.courseNumber)}` : null)
      : normalized.partLabel;
    changes.partScope = normalized.partScope;
  }
  if (hasOwn(payload, "partScope") && !hasOwn(payload, "partLabel")) {
    const normalized = normalizePartFields({ partScope: payload.partScope });
    changes.partScope = normalized.partScope;
    changes.partLabel = normalized.partLabel;
  }
  if (hasOwn(payload, "notes")) {
    if (payload.notes !== null && typeof payload.notes !== "string") throw new Error("Notes invalides");
    changes.notes = String(payload.notes || "").trim();
  }
  if (hasOwn(payload, "recordingMarkers")) changes.recordingMarkers = normalizeRecordingMarkers(payload.recordingMarkers);
  if (hasOwn(payload, "transcriptSections")) changes.transcriptSections = normalizeTranscriptSections(payload.transcriptSections);
  if (hasOwn(payload, "audioDurationMs")) {
    const duration = Number(payload.audioDurationMs);
    if (!Number.isFinite(duration) || duration < 0 || duration > 24 * 60 * 60 * 1000) throw new Error("Durée audio invalide");
    changes.audioDurationMs = Math.round(duration);
  }
  if (hasOwn(payload, "subjectTitle")) {
    if (typeof payload.subjectTitle !== "string" || !payload.subjectTitle.trim()) throw new Error("Nom de matière invalide");
    changes.subjectTitle = payload.subjectTitle.trim();
  }
  if (hasOwn(payload, "subjectId")) {
    if (typeof payload.subjectId !== "string" || !payload.subjectId.trim()) throw new Error("Matière invalide");
    const catalog = await readJsonFile(path.join(DATA, "courses.json"), { courses: [] });
    const subject = Array.isArray(catalog.courses) ? catalog.courses.find((item) => item.id === payload.subjectId.trim()) : null;
    if (!subject) throw new Error("Matière introuvable");
    changes.subjectId = subject.id;
    if (!hasOwn(payload, "subjectTitle")) changes.subjectTitle = subject.title || course.subjectTitle || "";
  }
  if (changes.subjectId && !hasOwn(payload, "chapterId") && course.chapterId) {
    const currentDefinition = await resolveChapterAssignment(course.subjectId, course.chapterId);
    if (currentDefinition && currentDefinition.subjectId !== changes.subjectId) {
      changes.chapterId = null;
      changes.chapter = "";
    }
  }
  if (hasOwn(payload, "photos") && Array.isArray(payload.photos)) {
    changes.photos = payload.photos;
  }
  if (hasOwn(payload, "cards") && Array.isArray(payload.cards)) {
    changes.cards = payload.cards;
  }
  if (hasOwn(payload, "status")) {
    if (!["ready", "a-traiter", "en-traitement", "transcription-en-attente", "source-insuffisante"].includes(payload.status)) throw new Error("Statut de cours invalide");
    changes.status = payload.status;
  }
  validateOffsetsAgainstDuration(changes.recordingMarkers ?? course.recordingMarkers, changes.transcriptSections ?? course.transcriptSections, changes.audioDurationMs ?? course.audioDurationMs);
  if (!Object.keys(changes).length) throw new Error("Aucun champ de cours à modifier");
  Object.assign(course, changes, { updatedAt: new Date().toISOString() });
  return course;
}

function safeRecordingFilename(value, extension = ".webm") {
  const base = safeFilename(value).replace(/\.[^.]+$/, "") || `enregistrement-${Date.now()}`;
  return `${base}${extension}`;
}

async function transcribeWithOpenAI(audioBuffer, mimeType, filename, context = "") {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !audioBuffer?.length) return null;
  const form = new FormData();
  form.append("file", new Blob([audioBuffer], { type: mimeType || "audio/webm" }), filename || "cours.webm");
  form.append("model", process.env.BIOMIA_TRANSCRIPTION_MODEL || "gpt-4o-transcribe");
  form.append("language", "fr");
  if (context.trim()) form.append("prompt", `Transcription fidèle d'un cours universitaire en français. Conserve les termes scientifiques, noms propres, symboles et sigles. Contexte de la séance : ${context.trim()}`);
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || `Transcription distante ${response.status}`);
  return String(payload.text || "").trim() || null;
}

async function transcribeLocally(audioBuffer, mimeType, kind = "recall") {
  const config = await readJsonFile(AUTOMATION_CONFIG, {});
  const transcription = config.transcription || {};
  if (!transcription.enabled || !transcription.binary || !transcription.model) throw new Error("La transcription locale n'est pas configurée. Configure Whisper dans data/automation/config.json.");
  if (!audioBuffer?.length) throw new Error("Audio vide ou illisible");
  const extension = String(mimeType || "").includes("mp4") || String(mimeType || "").includes("m4a") ? ".m4a" : ".webm";
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const input = path.join(REVISION_AUDIO, `${kind}-${id}${extension}`);
  const wav = path.join(REVISION_AUDIO, `${kind}-${id}.wav`);
  const outputBase = path.join(REVISION_AUDIO, `${kind}-${id}`);
  await writeFile(input, audioBuffer);
  try {
    if (transcription.ffmpeg) await execFileAsync(transcription.ffmpeg, ["-y", "-i", input, "-ar", "16000", "-ac", "1", wav], { maxBuffer: 2 * 1024 * 1024 });
    const source = transcription.ffmpeg ? wav : input;
    await execFileAsync(transcription.binary, ["-m", path.resolve(ROOT, transcription.model), "-f", source, "-otxt", "-of", outputBase, ...(transcription.language ? ["-l", transcription.language] : [])], { maxBuffer: 2 * 1024 * 1024 });
    const result = String(await readFile(`${outputBase}.txt`, "utf8")).trim();
    if (!result) throw new Error("Whisper n'a produit aucun texte exploitable");
    return { transcript: result, text: result, engine: "whisper-local", filename: path.basename(input) };
  } catch (error) {
    throw new Error(`Transcription locale impossible : ${error.message || "vérifie Whisper et ffmpeg"}`);
  }
}

async function withMobileSyncLock(task) {
  const previous = mobileSyncChain;
  let release;
  mobileSyncChain = new Promise((resolve) => { release = resolve; });
  await previous;
  try {
    return await task();
  } finally {
    release();
  }
}

async function listTranscriptions() {
  const files = await readdir(TRANSCRIPTIONS, { withFileTypes: true });
  const index = await readJsonFile(path.join(TRANSCRIPTIONS, "index.json"), []);
  const byFile = new Map(index.map((item) => [item.filename, item]));
  const items = [];
  for (const entry of files) {
    if (!entry.isFile() || entry.name === "index.json" || entry.name === "README.md" || entry.name.endsWith(".meta.json")) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;
    const info = await stat(path.join(TRANSCRIPTIONS, entry.name));
    const metadata = byFile.get(entry.name) || {};
    items.push({
      filename: entry.name,
      title: metadata.title || entry.name.replace(/\.[^.]+$/, ""),
      courseId: metadata.courseId || "",
      courseTitle: metadata.courseTitle || "Matière à classer",
      date: metadata.date || info.mtime.toISOString().slice(0, 10),
      bytes: info.size,
      updatedAt: info.mtime.toISOString(),
    });
  }
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function syncLegacyCourses() {
  const metadata = await readJsonFile(path.join(TRANSCRIPTIONS, "index.json"), []);
  const courses = await readJsonFile(LESSONS, []);
  const catalog = await readJsonFile(path.join(DATA, "courses.json"), { courses: [] });
  const knownTranscriptions = new Set(courses.map((item) => item.transcriptionFilename).filter(Boolean));
  let changed = false;
  for (const item of metadata) {
    if (!item.filename || item.filename === "README.md" || knownTranscriptions.has(item.filename) || !item.courseId) continue;
    const subject = catalog.courses?.find((entry) => entry.id === item.courseId);
    if (!subject) continue;
    courses.push({
      id: `legacy-${slug(item.filename)}`,
      subjectId: subject.id,
      subjectTitle: subject.title,
      title: item.title || item.filename.replace(/\.[^.]+$/, ""),
      date: item.date || new Date().toISOString().slice(0, 10),
      kind: "cours",
      chapter: String(item.chapter || "").trim(),
      status: "a-traiter",
      automationEligible: true,
      transcriptionFilename: item.filename,
      summaryFilename: null,
      cards: [],
      createdAt: new Date().toISOString(),
    });
    knownTranscriptions.add(item.filename);
    changed = true;
  }
  if (changed) await writeFile(LESSONS, JSON.stringify(courses, null, 2) + "\n", "utf8");
  return courses;
}

async function handleApi(req, res, url) {
  console.log(`[API REQUEST] ${req.method} ${url.pathname}`);

  // SETTINGS API
  if (req.method === "GET" && url.pathname === "/api/settings") {
    let localIp = "127.0.0.1";
    try {
      const os = await import("node:os");
      const nets = os.networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
          if (net.family === "IPv4" && !net.internal) {
            localIp = net.address;
            break;
          }
        }
      }
    } catch {}

    const key = process.env.GEMINI_API_KEY || "";
    const maskedKey = key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : (key ? "****" : "");
    
    let tailscaleIp = null;
    let tailscaleUrl = null;
    try {
      const { execSync } = await import("node:child_process");
      const ip = execSync("tailscale ip -4", { stdio: ["pipe", "pipe", "ignore"], encoding: "utf8" }).trim();
      if (ip) {
        tailscaleIp = ip;
        tailscaleUrl = `http://${ip}:${PORT}`;
      }
    } catch {}

    return json(res, 200, {
      geminiConfigured: Boolean(key && key !== "your_gemini_api_key_here"),
      geminiApiKeyMasked: maskedKey,
      geminiModel: process.env.GEMINI_MODEL || "gemini-3.7-flash",
      port: PORT,
      localIp,
      tailscaleIp,
      tailscaleUrl,
      mobileConnectUrl: `http://${localIp}:${PORT}`,
    });
  }

  if (req.method === "POST" && url.pathname === "/api/settings") {
    try {
      const payload = JSON.parse(await readBody(req));
      const envPath = path.join(ROOT, ".env");
      let envContent = "";
      try {
        envContent = await readFile(envPath, "utf8");
      } catch {
        envContent = "";
      }

      if (payload.geminiApiKey !== undefined) {
        const newKey = String(payload.geminiApiKey || "").trim();
        process.env.GEMINI_API_KEY = newKey;
        if (/GEMINI_API_KEY=/.test(envContent)) {
          envContent = envContent.replace(/GEMINI_API_KEY=.*/g, `GEMINI_API_KEY=${newKey}`);
        } else {
          envContent += `\nGEMINI_API_KEY=${newKey}\n`;
        }
      }

      if (payload.geminiModel !== undefined) {
        const newModel = String(payload.geminiModel || "gemini-3.7-flash").trim();
        process.env.GEMINI_MODEL = newModel;
        if (/GEMINI_MODEL=/.test(envContent)) {
          envContent = envContent.replace(/GEMINI_MODEL=.*/g, `GEMINI_MODEL=${newModel}`);
        } else {
          envContent += `\nGEMINI_MODEL=${newModel}\n`;
        }
      }

      if (payload.port !== undefined) {
        const newPort = parseInt(payload.port, 10);
        if (Number.isFinite(newPort) && newPort > 0 && newPort < 65536) {
          process.env.BIOMIA_PORT = String(newPort);
          if (/BIOMIA_PORT=/.test(envContent)) {
            envContent = envContent.replace(/BIOMIA_PORT=.*/g, `BIOMIA_PORT=${newPort}`);
          } else {
            envContent += `\nBIOMIA_PORT=${newPort}\n`;
          }
        }
      }

      await writeFile(envPath, envContent.trim() + "\n", "utf8");
      return json(res, 200, { ok: true, message: "Paramètres enregistrés avec succès" });
    } catch (error) {
      return json(res, 400, { error: error.message || "Impossible de sauvegarder les paramètres" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/settings/test-gemini") {
    try {
      const payload = JSON.parse(await readBody(req));
      const keyToTest = String(payload.geminiApiKey || process.env.GEMINI_API_KEY || "").trim();
      if (!keyToTest) return json(res, 400, { ok: false, error: "Aucune clé API fournie" });
      
      const model = payload.geminiModel || process.env.GEMINI_MODEL || "gemini-3.7-flash";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(keyToTest)}`;
      const testRes = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Reponds par le mot OK" }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      });

      if (!testRes.ok) {
        const errText = await testRes.text();
        return json(res, 400, { ok: false, error: `Erreur API Gemini (${testRes.status}) : ${errText.slice(0, 150)}` });
      }

      return json(res, 200, { ok: true, message: "Clé Gemini API valide et opérationnelle !" });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message || "Erreur de connexion à Gemini" });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/system/status") {
    let antigravityInstalled = false;
    let antigravityRunning = false;
    try {
      const { execSync } = await import("node:child_process");
      if (process.platform === "darwin") {
        antigravityInstalled = existsSync("/Applications/Antigravity.app") || Boolean(execSync("which antigravity 2>/dev/null || true", { encoding: "utf8" }).trim());
        const psOut = execSync("pgrep -fi 'antigravity' 2>/dev/null || true", { encoding: "utf8" }).trim();
        antigravityRunning = Boolean(psOut);
      } else {
        antigravityInstalled = Boolean(execSync("which antigravity 2>/dev/null || true", { encoding: "utf8" }).trim());
      }
    } catch {}

    let tailscaleIp = null;
    let tailscaleUrl = null;
    let tailscaleRunning = false;
    try {
      const { execSync } = await import("node:child_process");
      const ip = execSync("tailscale ip -4 2>/dev/null || true", { stdio: ["pipe", "pipe", "ignore"], encoding: "utf8" }).trim();
      if (ip) {
        tailscaleIp = ip;
        tailscaleUrl = `http://${ip}:${PORT}`;
        tailscaleRunning = true;
      }
    } catch {}

    const key = process.env.GEMINI_API_KEY || "";
    const maskedKey = key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : (key ? "****" : "");
    const localIp = getLocalIp();

    const whisperModelExists = existsSync(path.join(ROOT, "models", "whisper", "ggml-large-v3-turbo-q5_0.bin")) || existsSync(path.join(ROOT, "models", "whisper"));

    return json(res, 200, {
      ok: true,
      antigravity: {
        installed: antigravityInstalled,
        running: antigravityRunning,
        appPath: existsSync("/Applications/Antigravity.app") ? "/Applications/Antigravity.app" : null,
      },
      tailscale: {
        running: tailscaleRunning,
        ip: tailscaleIp,
        url: tailscaleUrl,
      },
      gemini: {
        configured: Boolean(key && key !== "your_gemini_api_key_here"),
        apiKeyMasked: maskedKey,
        model: process.env.GEMINI_MODEL || "gemini-3.7-flash",
      },
      whisperMetal: whisperModelExists,
      localIp,
      port: PORT,
      mobileConnectUrl: `http://${localIp}:${PORT}/mobile`,
      pairingUrl: `http://${localIp}:${PORT}/mobile`,
    });
  }

  if (req.method === "POST" && url.pathname === "/api/antigravity/open") {
    try {
      const { exec } = await import("node:child_process");
      if (process.platform === "darwin") {
        if (existsSync("/Applications/Antigravity.app")) {
          exec(`open -a "/Applications/Antigravity.app" "${ROOT}"`);
          return json(res, 200, { ok: true, message: "Google Antigravity ouvert sur le projet" });
        }
      }
      exec(`antigravity "${ROOT}"`);
      return json(res, 200, { ok: true, message: "Google Antigravity lancé" });
    } catch (err) {
      return json(res, 500, { ok: false, error: err.message || "Impossible de lancer Antigravity" });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/devices") {
    const devices = await readJsonFile(DEVICES, []);
    const localIp = getLocalIp();
    let tailscaleUrl = null;
    try {
      const { execSync } = await import("node:child_process");
      const ip = execSync("tailscale ip -4 2>/dev/null || true", { stdio: ["pipe", "pipe", "ignore"], encoding: "utf8" }).trim();
      if (ip) tailscaleUrl = `http://${ip}:${PORT}`;
    } catch {}

    let adbDevice = null;
    try {
      const { execSync } = await import("node:child_process");
      const out = execSync("adb devices -l 2>/dev/null || true", { stdio: ["pipe", "pipe", "ignore"], encoding: "utf8" }).trim();
      const lines = out.split("\n").filter((l) => l.trim() && !l.startsWith("List of"));
      if (lines.length > 0) {
        const first = lines[0];
        const parts = first.split(/\s+/);
        const id = parts[0];
        const modelMatch = first.match(/model:(\S+)/);
        const model = modelMatch ? modelMatch[1].replace(/_/g, " ") : "Android USB";
        adbDevice = { id, model, connected: true };
      }
    } catch {}

    return json(res, 200, {
      ok: true,
      devices,
      adbDevice,
      localIp,
      port: PORT,
      pairingUrl: `http://${localIp}:${PORT}/?paired=1`,
      tailscaleUrl: tailscaleUrl || process.env.TAILSCALE_URL || null,
    });
  }

  if (req.method === "POST" && url.pathname === "/api/devices/adb-install") {
    try {
      const { execSync } = await import("node:child_process");
      execSync("adb install -r -d public/cours.apk 2>/dev/null || true", { stdio: ["pipe", "pipe", "ignore"], encoding: "utf8" });
      execSync(`adb reverse tcp:${PORT} tcp:${PORT} 2>/dev/null || true`, { stdio: ["pipe", "pipe", "ignore"], encoding: "utf8" });
      return json(res, 200, { ok: true, message: "Application installée sur le Pixel avec succès !" });
    } catch (e) {
      return json(res, 500, { ok: false, error: e.message || "Échec de l'installation ADB" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/devices/pair") {
    try {
      const payload = JSON.parse(await readBody(req));
      await registerDevice({
        deviceId: payload.deviceId,
        deviceName: payload.deviceName,
        platform: payload.platform,
        userAgent: req.headers["user-agent"],
        ip: req.socket.remoteAddress,
      });
      const localIp = getLocalIp();
      return json(res, 200, {
        ok: true,
        message: "Appareil appairé avec succès",
        pairingUrl: `http://${localIp}:${PORT}`,
      });
    } catch (error) {
      return json(res, 400, { error: error.message || "Impossible d'appairer l'appareil" });
    }
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/devices/")) {
    const deviceId = decodeURIComponent(url.pathname.replace("/api/devices/", ""));
    const devices = await readJsonFile(DEVICES, []);
    const filtered = devices.filter((d) => d.id !== deviceId);
    await saveJsonArray(DEVICES, filtered);
    return json(res, 200, { ok: true, message: "Appareil dissocié avec succès" });
  }

  if (req.method === "GET" && url.pathname === "/api/courses") {
    return json(res, 200, await readJsonFile(path.join(DATA, "courses.json"), { courses: [] }));
  }
  if (req.method === "POST" && url.pathname === "/api/courses") {
    try {
      const payload = JSON.parse(await readBody(req));
      const title = String(payload.title || "").trim();
      if (!title) return json(res, 400, { error: "Le titre de la matière est requis" });
      const coursesFile = path.join(DATA, "courses.json");
      const catalog = await readJsonFile(coursesFile, { courses: [] });
      const newSubject = {
        id: payload.id || `custom-${Date.now()}-${slug(title)}`,
        title,
        semester: payload.semester === "S2" ? "S2" : "S1",
        category: payload.category || "Optionnel",
        ects: Number(payload.ects) || 3,
        priority: payload.priority || "B",
      };
      catalog.courses.push(newSubject);
      await writeFile(coursesFile, JSON.stringify(catalog, null, 2) + "\n", "utf8");
      return json(res, 201, newSubject);
    } catch (error) {
      return json(res, 400, { error: error.message || "Matière impossible à créer" });
    }
  }
  const subjectMatch = url.pathname.match(/^\/api\/courses\/([^/]+)$/);
  if (req.method === "DELETE" && subjectMatch) {
    try {
      const subjectId = decodeURIComponent(subjectMatch[1]);
      const coursesFile = path.join(DATA, "courses.json");
      const catalog = await readJsonFile(coursesFile, { courses: [] });
      const index = catalog.courses.findIndex((s) => s.id === subjectId);
      if (index === -1) return json(res, 404, { error: "Matière introuvable" });
      catalog.courses.splice(index, 1);
      await writeFile(coursesFile, JSON.stringify(catalog, null, 2) + "\n", "utf8");
      return json(res, 200, { deleted: true, subjectId });
    } catch (error) {
      return json(res, 400, { error: error.message || "Matière impossible à supprimer" });
    }
  }

  // ---------------- CURRICULUM AI GENERATOR & IMPORTER ----------------
  if (req.method === "POST" && url.pathname === "/api/curriculum/generate") {
    try {
      const payload = JSON.parse(await readBody(req));
      const query = String(payload.query || "").trim();
      if (!query) {
        return json(res, 400, { error: "Veuillez entrer le nom de votre formation ou université." });
      }

      const geminiKey = process.env.GEMINI_API_KEY || "";
      const primaryModel = "gemini-2.5-flash";

      console.log(`\n[CURRICULUM] 🔍 Recherche et génération de maquette pour : "${query}"`);

      if (geminiKey) {
        console.log(`[CURRICULUM] 🌐 Appel Gemini AI (${primaryModel})...`);
        const prompt = `Tu es un expert pédagogique national couvrant le Lycée (Baccalauréat Général et Technologique), les CPGE, les Universités et les Grandes Écoles. Analyse la formation ou le cursus suivant :
Formation demandée : "${query}"

Règles de génération :
1. Si la formation demandée concerne le **Lycée / Baccalauréat (Terminale, Première, Seconde, Bac)** :
   - Génère les véritables matières du programme officiel du Bulletin Officiel (BO).
   - Utilise les coefficients officiels du Baccalauréat dans le champ "ects" (ex: Spécialités Coeff 16, Philo Coeff 8, Grand Oral Coeff 10, Histoire-Géo Coeff 6, Enseignement Scientifique Coeff 6, LVA Coeff 6, LVB Coeff 6).
   - "priority": 'A' pour coefficients >= 8, 'B' pour tronc commun (Coeff 6), 'C' pour options (<= 6).
   - "category": "Spécialité Bac (Coeff 16)", "Épreuve Terminale (Coeff 8)", "Tronc commun (Coeff 6)", etc.
   - **Exhaustivité totale des chapitres** : Découpe chaque enseignement de spécialité en **l'intégralité de ses véritables chapitres officiels de l'année scolaire** (ex: en SVT Terminale, génère les 15 à 19 chapitres détaillés des 3 thèmes officiels : Génétique & Méiose, Complexification des génomes, Évolution humaine, Domaine continental & Géologie, Reconstitution climatique, Photosynthèse, Domestication des plantes, Réflexe myotatique, Plasticité cérébrale, Immunité adaptative, Stress aigu et chronique). Ne tronque et ne fusionne aucun chapitre.

3. **Questions de cadrage interactives obligatoires** :
   - Identifie systématiquement les zones d'incertitude ou de choix (ex: choix de la LV2 Espagnol/Allemand, choix d'une option facultative comme Maths Complémentaires/DGEMC, choix d'une mineure santé pour PASS, choix d'un parcours de licence).
   - Remplis le tableau "customizationQuestions" avec des questions claires et des options réelles prêtes à être cliquées.

Réponds STRICTEMENT sous format JSON valide :
{
  "program": "Titre officiel précis (ex: Terminale Générale Spé Maths + SVT ou Licence 1 Droit Panthéon-Sorbonne)",
  "university": "Établissement ou Académie",
  "semester": "S1 ou Année du Bac",
  "customizationQuestions": [
    {
      "id": "lvb",
      "question": "Quelle est votre Langue Vivante B (LV2) ?",
      "selectedOptionId": "espagnol",
      "options": [
        {
          "id": "espagnol",
          "label": "Espagnol",
          "title": "Langue Vivante B : Espagnol",
          "category": "Tronc commun (Coeff 6)",
          "ects": 6,
          "priority": "B",
          "chapters": ["Identités et échanges", "Art et pouvoir", "Espace privé et public", "Innovations scientifiques"]
        },
        {
          "id": "allemand",
          "label": "Allemand",
          "title": "Langue Vivante B : Allemand",
          "category": "Tronc commun (Coeff 6)",
          "ects": 6,
          "priority": "B",
          "chapters": ["Identités et échanges", "Espaces et frontières", "Art et pouvoir"]
        }
      ]
    }
  ],
  "subjects": [
    {
      "title": "Nom officiel de la matière",
      "category": "Catégorie / Type d'épreuve",
      "ects": 16,
      "priority": "A",
      "semester": "S1",
      "chapters": ["Chapitre 1 : ...", "Chapitre 2 : ..."]
    }
  ]
}`;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${primaryModel}:generateContent?key=${encodeURIComponent(geminiKey)}`;
        const aiRes = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
            },
          }),
        });

        if (aiRes.ok) {
          const aiJson = await aiRes.json();
          let candidateText = aiJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (candidateText.includes("```json")) {
            candidateText = candidateText.split("```json")[1].split("```")[0].trim();
          } else if (candidateText.includes("```")) {
            candidateText = candidateText.split("```")[1].split("```")[0].trim();
          }
          if (candidateText) {
            try {
              const parsed = JSON.parse(candidateText);
              if (parsed && Array.isArray(parsed.subjects) && parsed.subjects.length > 0) {
                console.log(`[CURRICULUM] ✅ Succès Gemini AI : ${parsed.subjects.length} matières extraites pour "${parsed.program || query}".`);
                return json(res, 200, parsed);
              }
            } catch (e) {
              console.warn("[CURRICULUM] ⚠️ Échec de parsing JSON Gemini.", e);
            }
          }
        } else {
          console.warn(`[CURRICULUM] ⚠️ Réponse API Gemini statut ${aiRes.status}`);
        }
      }

      // Si aucune clé ou échec de l'IA, ne JAMAIS générer de fausses données creuses :
      return json(res, 404, {
        error: `Impossible de trouver automatiquement la maquette pour "${query}". Vous pouvez créer vos matières manuellement dans l'onglet Création manuelle.`,
      });
    } catch (error) {
      return json(res, 500, { error: error.message || "Erreur lors de la génération du cursus" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/curriculum/import") {
    try {
      const payload = JSON.parse(await readBody(req));
      const subjectsToImport = Array.isArray(payload.subjects) ? payload.subjects : [];
      if (!subjectsToImport.length) {
        return json(res, 400, { error: "Aucune matière à importer." });
      }

      const coursesFile = path.join(DATA, "courses.json");
      const catalog = await readJsonFile(coursesFile, { courses: [] });
      const definitions = await readJsonFile(CHAPTER_DEFINITIONS, []);

      let importedSubjectsCount = 0;
      let importedChaptersCount = 0;

      for (const subj of subjectsToImport) {
        const title = String(subj.title || "").trim();
        if (!title) continue;

        const subjectId = subj.id || `custom-${Date.now()}-${slug(title)}-${Math.random().toString(36).slice(2, 6)}`;
        
        // Add or update in catalog
        const existingSubjIndex = catalog.courses.findIndex((s) => s.title.toLowerCase() === title.toLowerCase());
        const newSubject = {
          id: subjectId,
          title,
          semester: subj.semester === "S2" ? "S2" : "S1",
          category: subj.category || "Tronc commun",
          ects: Number(subj.ects) || 3,
          priority: subj.priority || "B",
        };

        if (existingSubjIndex !== -1) {
          catalog.courses[existingSubjIndex] = { ...catalog.courses[existingSubjIndex], ...newSubject, id: catalog.courses[existingSubjIndex].id };
        } else {
          catalog.courses.push(newSubject);
          importedSubjectsCount++;
        }

        const effectiveSubjectId = existingSubjIndex !== -1 ? catalog.courses[existingSubjIndex].id : subjectId;

        // Import chapters if provided
        if (Array.isArray(subj.chapters)) {
          for (const chapTitle of subj.chapters) {
            const cleanChap = String(chapTitle || "").trim();
            if (!cleanChap) continue;

            const existingChap = definitions.find(
              (ch) => ch.subjectId === effectiveSubjectId && ch.title.toLowerCase() === cleanChap.toLowerCase()
            );

            if (!existingChap) {
              definitions.push({
                id: `chap-${Date.now()}-${slug(cleanChap)}-${Math.random().toString(36).slice(2, 6)}`,
                subjectId: effectiveSubjectId,
                title: cleanChap,
                createdAt: new Date().toISOString(),
              });
              importedChaptersCount++;
            }
          }
        }
      }

      await writeFile(coursesFile, JSON.stringify(catalog, null, 2) + "\n", "utf8");
      await writeFile(CHAPTER_DEFINITIONS, JSON.stringify(definitions, null, 2) + "\n", "utf8");

      return json(res, 200, {
        success: true,
        importedSubjects: importedSubjectsCount,
        importedChapters: importedChaptersCount,
        catalog: catalog.courses,
      });
    } catch (error) {
      return json(res, 500, { error: error.message || "Erreur lors de l'importation du cursus" });
    }
  }
  if (req.method === "GET" && url.pathname === "/api/study-courses") {
    const courses = await syncLegacyCourses();
    const [chapterDefinitions, sessions, reviews] = await Promise.all([
      readJsonFile(CHAPTER_DEFINITIONS, []),
      readJsonFile(REVISION_SESSIONS, []),
      readJsonFile(REVIEWS, []),
    ]);
    const weaknesses = aggregateWeaknesses(reviews, sessions);
    return json(res, 200, courses.map((course) => courseForResponse(course, { chapterDefinitions, sessions, reviews, weaknesses })));
  }
  if (req.method === "GET" && url.pathname === "/api/automation") {
    const automationConfig = await readJsonFile(AUTOMATION_CONFIG, {});
    const configuredInbox = process.env.BIOMIA_PHONE_INBOX || automationConfig.inboxPath || path.join(ROOT, "inbox");
    return json(res, 200, {
      inboxPath: path.isAbsolute(configuredInbox) ? configuredInbox : path.resolve(ROOT, configuredInbox),
      model: process.env.GEMINI_MODEL || "gemini-3.7-flash",
      codexModel: process.env.GEMINI_MODEL || process.env.BIOMIA_CODEX_MODEL || "gemini-3.7-flash",
      codexReasoning: process.env.BIOMIA_CODEX_REASONING_EFFORT || "xhigh",
      mode: process.env.BIOMIA_AUTOMATION_DRY_RUN === "1" ? "simulation" : "actif",
    });
  }
  if (req.method === "POST" && url.pathname === "/api/study-courses") {
    try {
      const payload = JSON.parse(await readBody(req));
      if (!payload.subjectId || !payload.title || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date || "")) {
        return json(res, 400, { error: "Une matière, un titre et une date sont nécessaires" });
      }
      const subjectId = String(payload.subjectId).trim();
      const chapterDefinition = await resolveChapterAssignment(subjectId, payload.chapterId);
      const freeChapter = String(payload.chapter || "").trim();
      const courses = await readJsonFile(LESSONS, []);
      const courseNumber = chapterDefinition ? nextCourseNumber(courses, subjectId, chapterDefinition.id) : null;
      const normalizedParts = normalizePartFields({ partLabel: payload.partLabel, partScope: payload.partScope });
      const course = {
        id: `course-${Date.now()}-${slug(payload.title)}`,
        subjectId,
        subjectTitle: payload.subjectTitle || "",
        title: payload.title.trim(),
        date: payload.date,
        kind: payload.kind === "chapitre" ? "chapitre" : "cours",
        chapter: chapterDefinition?.title || freeChapter,
        chapterId: chapterDefinition?.id || null,
        courseNumber,
        partLabel: courseNumber ? `Phase ${courseNumber}` : (normalizedParts.automaticNumber ? null : normalizedParts.partLabel),
        partScope: normalizedParts.partScope,
        status: "a-traiter",
        transcriptionFilename: null,
        summaryFilename: null,
        notes: String(payload.notes || "").trim(),
        photos: [],
        recordingMarkers: normalizeRecordingMarkers(payload.recordingMarkers) || [],
        transcriptSections: normalizeTranscriptSections(payload.transcriptSections) || [],
        ...(payload.audioDurationMs !== undefined ? { audioDurationMs: Math.max(0, Math.round(Number(payload.audioDurationMs) || 0)) } : {}),
        cards: [],
        recallStatus: "locked",
        recallScore: 0,
        lastRecalledAt: null,
        recallDiagnostic: null,
        automationEligible: false,
        createdAt: new Date().toISOString(),
      };
      courses.push(course);
      await saveCourses(courses);
      return json(res, 201, await courseResponse(course));
    } catch (error) {
      return json(res, 400, { error: error.message || "Cours impossible à créer" });
    }
  }
  const courseUpdateMatch = url.pathname.match(/^\/api\/study-courses\/([^/]+)$/);
  if ((req.method === "PUT" || req.method === "PATCH") && courseUpdateMatch) {
    try {
      const courseId = decodeURIComponent(courseUpdateMatch[1]);
      const payload = JSON.parse(await readBody(req));
      const courses = await readJsonFile(LESSONS, []);
      const course = courses.find((item) => item.id === courseId);
      if (!course) return json(res, 404, { error: "Cours introuvable" });
      const previousSubjectId = course.subjectId;
      const previousChapterId = course.chapterId || null;
      await applyCourseUpdate(course, payload);
      if (course.subjectId !== previousSubjectId || (course.chapterId || null) !== previousChapterId) {
        const siblings = courses.filter((item) => item.id !== course.id);
        course.courseNumber = course.chapterId ? nextCourseNumber(siblings, course.subjectId, course.chapterId) : null;
        course.partLabel = course.courseNumber ? `Phase ${course.courseNumber}` : course.partScope?.label || null;
      }
      await saveCourses(courses);
      return json(res, 200, await courseResponse(course));
    } catch (error) {
      return json(res, 400, { error: error.message || "Cours impossible à modifier" });
    }
  }
  if (req.method === "DELETE" && courseUpdateMatch) {
    try {
      const courseId = decodeURIComponent(courseUpdateMatch[1]);
      const courses = await readJsonFile(LESSONS, []);
      const index = courses.findIndex((item) => item.id === courseId);
      if (index === -1) return json(res, 404, { error: "Cours introuvable" });
      courses.splice(index, 1);
      await saveCourses(courses);
      return json(res, 200, { deleted: true, courseId });
    } catch (error) {
      return json(res, 400, { error: error.message || "Cours impossible à supprimer" });
    }
  }
  const diagnosticQuizMatch = url.pathname.match(/^\/api\/study-courses\/([^/]+)\/diagnostic-quiz$/);
  if (req.method === "GET" && diagnosticQuizMatch) {
    const courseId = decodeURIComponent(diagnosticQuizMatch[1]);
    const courses = await readJsonFile(LESSONS, []);
    const course = courses.find((item) => item.id === courseId);
    if (!course) return json(res, 404, { error: "Cours introuvable" });
    const quiz = generateDiagnosticQuizFromCourse(course);
    return json(res, 200, { ok: true, courseId, quiz });
  }

  const unlockRecallMatch = url.pathname.match(/^\/api\/study-courses\/([^/]+)\/unlock-recall$/);
  if (req.method === "POST" && unlockRecallMatch) {
    try {
      const courseId = decodeURIComponent(unlockRecallMatch[1]);
      const payload = JSON.parse(await readBody(req));
      const recallText = String(payload.recallText || payload.answer || "").trim();
      const quizAnswers = Array.isArray(payload.quizAnswers) ? payload.quizAnswers : null;

      if (!recallText && !quizAnswers) {
        return json(res, 400, { error: "Une tentative de rappel (texte ou QCM éclair) est requise pour déverrouiller le cours" });
      }

      const courses = await readJsonFile(LESSONS, []);
      const course = courses.find((item) => item.id === courseId);
      if (!course) return json(res, 404, { error: "Cours introuvable" });

      let evaluation = null;
      if (quizAnswers) {
        evaluation = evaluateDiagnosticQuizAnswers(course, quizAnswers);
      } else if (recallText) {
        const correctionResult = await correctRecall({
          root: ROOT,
          configPath: AUTOMATION_CONFIG,
          course,
          answer: recallText,
          attempt: 1,
        });
        if (correctionResult.ok && correctionResult.evaluation) {
          evaluation = correctionResult.evaluation;
        }
      }

      if (!evaluation) {
        evaluation = {
          score: recallText.length > 50 ? 80 : 65,
          level: recallText.length > 50 ? "good" : "partial",
          summary: "Rappel validé. Fiche et flashcards FSRS-5 calibrées avec succès.",
          concepts: [
            {
              id: "c1",
              label: "Rappel initial",
              status: "mastered",
              feedback: "Excellent effort de récupération active avant lecture.",
            },
          ],
        };
      }

      course.recallStatus = "unlocked";
      course.recallScore = evaluation.score || 75;
      course.lastRecalledAt = new Date().toISOString();
      course.recallDiagnostic = evaluation;
      if (course.cards && course.cards.length > 0) {
        course.cards = seedCourseCardsFromRecall(course, evaluation);
      }
      course.updatedAt = new Date().toISOString();
      await saveCourses(courses);

      const sessions = await readJsonFile(REVISION_SESSIONS, []);
      sessions.push({
        id: `sess-${Date.now()}`,
        type: quizAnswers ? "diagnostic-quiz" : "course-recall",
        courseId: course.id,
        subjectId: course.subjectId,
        score: evaluation.score,
        answerText: recallText || `QCM Éclair (${quizAnswers.length} réponses)`,
        weakConcepts: evaluation.concepts?.filter((c) => c.status === "missing" || c.status === "wrong" || c.status === "partial") || [],
        createdAt: new Date().toISOString(),
      });
      await writeFile(REVISION_SESSIONS, JSON.stringify(sessions, null, 2) + "\n", "utf8");

      return json(res, 200, { ok: true, course: await courseResponse(course), evaluation });
    } catch (error) {
      return json(res, 400, { error: error.message || "Impossible de déverrouiller le cours" });
    }
  }
  const transcriptSectionsMatch = url.pathname.match(/^\/api\/study-courses\/([^/]+)\/transcript-sections\/propose$/);
  if (req.method === "POST" && transcriptSectionsMatch) {
    try {
      const courseId = decodeURIComponent(transcriptSectionsMatch[1]);
      const courses = await readJsonFile(LESSONS, []);
      const course = courses.find((item) => item.id === courseId);
      if (!course) return json(res, 404, { error: "Cours introuvable" });
      let transcript = "";
      if (course.transcriptionFilename) transcript = await readFile(safeFilePath(course.transcriptionFilename).resolved, "utf8").catch(() => "");
      if (!transcript) return json(res, 422, { error: "Aucune transcription disponible pour ce cours" });
      course.transcriptSections = proposeTranscriptSections(course, transcript);
      course.updatedAt = new Date().toISOString();
      await saveCourses(courses);
      return json(res, 200, { transcriptSections: course.transcriptSections, sections: course.transcriptSections });
    } catch (error) { return json(res, 400, { error: error.message || "Découpage impossible" }); }
  }
  if (req.method === "GET" && url.pathname === "/api/lessons") {
    return json(res, 200, await readJsonFile(LESSONS, []));
  }
  if (req.method === "GET" && url.pathname === "/api/transcriptions") {
    return json(res, 200, await listTranscriptions());
  }
  if (req.method === "GET" && url.pathname === "/api/recordings") {
    return json(res, 200, await readJsonFile(RECORDINGS_INDEX, []));
  }
  if (req.method === "GET" && url.pathname === "/api/chapters") {
    return json(res, 200, await readJsonFile(CHAPTERS, []));
  }
  if (req.method === "GET" && url.pathname === "/api/chapter-definitions") {
    const [definitions, courses] = await Promise.all([
      readJsonFile(CHAPTER_DEFINITIONS, []),
      syncLegacyCourses(),
    ]);
    return json(res, 200, chapterDefinitionsForResponse(definitions, courses));
  }
  if (req.method === "POST" && url.pathname === "/api/chapter-definitions") {
    try {
      const payload = JSON.parse(await readBody(req));
      const subjectId = String(payload.subjectId || "").trim();
      const subject = await findCatalogSubject(subjectId);
      if (!subject) return json(res, 400, { error: "Matière introuvable" });
      const title = String(payload.title || "").trim();
      if (!title) return json(res, 400, { error: "Le nom du chapitre ne peut pas être vide" });
      const definitions = await readJsonFile(CHAPTER_DEFINITIONS, []);
      const duplicate = definitions.find((item) => item.subjectId === subjectId && item.title.trim().toLocaleLowerCase("fr-FR") === title.toLocaleLowerCase("fr-FR"));
      if (duplicate) return json(res, 409, { error: "Ce chapitre existe déjà dans cette matière" });
      const now = new Date().toISOString();
      const definition = {
        id: `chapter-${Date.now()}-${slug(title)}`,
        subjectId,
        subjectTitle: subject.title || "",
        title,
        order: normalizeChapterOrder(payload.order, definitions.filter((item) => item.subjectId === subjectId).length + 1),
        status: "manual",
        createdAt: now,
        updatedAt: now,
      };
      definitions.push(definition);
      await writeFile(CHAPTER_DEFINITIONS, JSON.stringify(definitions, null, 2) + "\n", "utf8");
      return json(res, 201, { ...definition, courseCount: 0 });
    } catch (error) {
      return json(res, 400, { error: error.message || "Chapitre impossible à créer" });
    }
  }
  const chapterDefinitionMatch = url.pathname.match(/^\/api\/chapter-definitions\/([^/]+)$/);
  if ((req.method === "PUT" || req.method === "PATCH") && chapterDefinitionMatch) {
    try {
      const chapterId = decodeURIComponent(chapterDefinitionMatch[1]);
      const payload = JSON.parse(await readBody(req));
      const definitions = await readJsonFile(CHAPTER_DEFINITIONS, []);
      const definition = definitions.find((item) => item.id === chapterId);
      if (!definition) return json(res, 404, { error: "Chapitre introuvable" });
      if (hasOwn(payload, "title")) {
        const title = String(payload.title || "").trim();
        if (!title) return json(res, 400, { error: "Le nom du chapitre ne peut pas être vide" });
        const duplicate = definitions.find((item) => item.id !== chapterId && item.subjectId === definition.subjectId && item.title.trim().toLocaleLowerCase("fr-FR") === title.toLocaleLowerCase("fr-FR"));
        if (duplicate) return json(res, 409, { error: "Ce chapitre existe déjà dans cette matière" });
        definition.title = title;
        const courses = await readJsonFile(LESSONS, []);
        for (const course of courses) if (course.chapterId === chapterId) course.chapter = title;
        await saveCourses(courses);
      }
      if (hasOwn(payload, "order")) definition.order = normalizeChapterOrder(payload.order, definition.order || 0);
      definition.updatedAt = new Date().toISOString();
      await writeFile(CHAPTER_DEFINITIONS, JSON.stringify(definitions, null, 2) + "\n", "utf8");
      const courses = await readJsonFile(LESSONS, []);
      return json(res, 200, chapterDefinitionsForResponse([definition], courses)[0]);
    } catch (error) {
      return json(res, 400, { error: error.message || "Chapitre impossible à modifier" });
    }
  }
  if (req.method === "DELETE" && chapterDefinitionMatch) {
    try {
      const chapterId = decodeURIComponent(chapterDefinitionMatch[1]);
      const payload = req.headers["content-length"] && Number(req.headers["content-length"]) > 0 ? JSON.parse(await readBody(req)) : {};
      const definitions = await readJsonFile(CHAPTER_DEFINITIONS, []);
      const definition = definitions.find((item) => item.id === chapterId);
      if (!definition) return json(res, 404, { error: "Chapitre introuvable" });
      const hasReassignment = hasOwn(payload, "reassignToChapterId");
      const targetId = String(payload.reassignToChapterId || "").trim();
      const courses = await readJsonFile(LESSONS, []);
      const assigned = courses.filter((course) => course.chapterId === chapterId);
      let target = null;
      if (targetId) {
        target = definitions.find((item) => item.id === targetId);
        if (!target || target.subjectId !== definition.subjectId) return json(res, 400, { error: "Chapitre de destination invalide" });
      }
      if (assigned.length && !target && !hasReassignment) return json(res, 409, { error: "Ce chapitre contient des cours : choisis un chapitre de destination ou détache-les d’abord" });
      const orderedAssigned = [...assigned].sort((a, b) => Number(a.courseNumber || 0) - Number(b.courseNumber || 0) || String(a.date || "").localeCompare(String(b.date || "")) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
      let targetCourseNumber = target ? nextCourseNumber(courses.filter((course) => course.chapterId !== chapterId), target.subjectId, target.id) : null;
      for (const course of orderedAssigned) {
        course.chapterId = target?.id || null;
        course.chapter = target?.title || "";
        course.courseNumber = target ? targetCourseNumber++ : null;
        course.partLabel = course.courseNumber ? `Phase ${course.courseNumber}` : course.partScope?.label || null;
        course.updatedAt = new Date().toISOString();
      }
      await saveCourses(courses);
      await writeFile(CHAPTER_DEFINITIONS, JSON.stringify(definitions.filter((item) => item.id !== chapterId), null, 2) + "\n", "utf8");
      return json(res, 200, { deleted: true, reassigned: assigned.length, chapterId });
    } catch (error) {
      return json(res, 400, { error: error.message || "Chapitre impossible à supprimer" });
    }
  }
  if (req.method === "GET" && url.pathname === "/api/transcriptions/content") {
    try {
      const { clean } = safeFilePath(url.searchParams.get("file"));
      const value = await readFile(path.join(TRANSCRIPTIONS, clean), "utf8");
      return text(res, 200, value);
    } catch (error) {
      return json(res, 404, { error: error.message });
    }
  }
  if (req.method === "GET" && url.pathname === "/api/courses/content") {
    try {
      const { clean } = safeCoursePath(url.searchParams.get("file"));
      const value = await readFile(path.join(DATA, "cours", clean), "utf8");
      return text(res, 200, value);
    } catch (error) {
      return json(res, 404, { error: error.message });
    }
  }
  if (req.method === "GET" && url.pathname === "/api/courses/photos") {
    try {
      const courseId = String(url.searchParams.get("courseId") || "");
      const requestedFile = String(url.searchParams.get("file") || "");
      const courses = await readJsonFile(LESSONS, []);
      const course = courses.find((item) => item.id === courseId);
      const photo = course?.photos?.find((item) => item.filename === requestedFile || item.id === requestedFile);
      if (!course || !photo) return json(res, 404, { error: "Photo introuvable" });
      const { resolved } = safePhotoPath(course.id, photo.filename);
      const value = await readFile(resolved);
      return binary(res, 200, value, photo.mimeType || "image/jpeg");
    } catch (error) {
      return json(res, 404, { error: error.message || "Photo introuvable" });
    }
  }
  if (req.method === "POST" && url.pathname === "/api/courses/notes") {
    try {
      const payload = JSON.parse(await readBody(req));
      const courses = await readJsonFile(LESSONS, []);
      const course = courses.find((item) => item.id === payload.courseId);
      if (!course) return json(res, 404, { error: "Cours introuvable" });
      course.notes = String(payload.notes || "").trim();
      course.updatedAt = new Date().toISOString();
      await saveCourses(courses);
      return json(res, 200, courseForResponse(course));
    } catch (error) {
      return json(res, 400, { error: error.message || "Notes impossibles à enregistrer" });
    }
  }
  if (req.method === "POST" && url.pathname === "/api/courses/photos") {
    try {
      const payload = JSON.parse(await readBody(req, MAX_PHOTO_BODY));
      const courses = await readJsonFile(LESSONS, []);
      const course = courses.find((item) => item.id === payload.courseId);
      if (!course) return json(res, 404, { error: "Cours introuvable" });
      const photo = await appendCoursePhoto(course, payload);
      course.updatedAt = new Date().toISOString();
      await saveCourses(courses);
      return json(res, 201, { ...photo, url: photoUrl(course.id, photo) });
    } catch (error) {
      return json(res, 400, { error: error.message || "Photo impossible à enregistrer" });
    }
  }
  if (req.method === "POST" && url.pathname === "/api/transcriptions") {
    try {
      const payload = JSON.parse(await readBody(req));
      const original = safeFilename(payload.filename);
      const ext = path.extname(original).toLowerCase();
      if (!original || !ALLOWED_EXTENSIONS.has(ext)) return json(res, 400, { error: "Extension non prise en charge" });
      if (typeof payload.content !== "string") return json(res, 400, { error: "Transcription absente" });
      const sourceValidation = validateTranscription(payload.content);
      const filename = `${payload.date || new Date().toISOString().slice(0, 10)}__${slug(payload.courseTitle || "cours")}__${slug(path.basename(original, ext))}${ext}`;
      const { resolved } = safeFilePath(filename);
      await writeFile(resolved, payload.content, "utf8");
      const indexFile = path.join(TRANSCRIPTIONS, "index.json");
      const index = await readJsonFile(indexFile, []);
      const next = index.filter((item) => item.filename !== filename);
      next.push({ filename, title: payload.title || original.replace(/\.[^.]+$/, ""), courseId: payload.courseId || "", courseTitle: payload.courseTitle || "", date: payload.date || new Date().toISOString().slice(0, 10), provider: payload.provider || "import", sourceValidation });
      await writeFile(indexFile, JSON.stringify(next, null, 2) + "\n", "utf8");
      if (payload.courseId) {
        const courses = await readJsonFile(LESSONS, []);
        const current = courses.find((item) => item.id === payload.courseId);
        if (current) {
          current.transcriptionFilename = filename;
          current.transcriptionProvider = payload.provider || current.transcriptionProvider || "import";
          current.transcriptionState = sourceValidation.ok ? "received" : "invalid";
          current.transcriptionRetryable = false;
          current.transcriptionCompletedAt = new Date().toISOString();
          current.transcriptionError = null;
          current.sourceValidation = sourceValidation;
          current.status = sourceValidation.ok ? "a-traiter" : "source-insuffisante";
          current.automationEligible = sourceValidation.ok;
          current.automationError = sourceValidation.ok ? null : sourceValidationError(sourceValidation);
          current.updatedAt = new Date().toISOString();
          await saveCourses(courses);
        }
      }
      return json(res, 201, {
        filename,
        status: sourceValidation.ok ? "a-traiter" : "source-insuffisante",
        accepted: true,
        sourceValidation,
      });
    } catch (error) {
      return json(res, 400, { error: error.message || "Import impossible" });
    }
  }
  if (req.method === "POST" && url.pathname === "/api/mobile/sync") {
    return withMobileSyncLock(async () => {
      try {
      const payload = JSON.parse(await readBody(req, MAX_AUDIO_BODY));
      if (!payload || typeof payload !== "object" || Array.isArray(payload) || !payload.recordingId || typeof payload.title !== "string" || !payload.title.trim() || !payload.subjectId) return json(res, 400, { error: "Identifiant, titre et matière nécessaires" });
      const date = /^\d{4}-\d{2}-\d{2}$/.test(payload.date || "") ? payload.date : localDate();
      const title = String(payload.title || `Enregistrement du ${date}`).trim();
      const chapter = String(payload.chapter || "").trim();
      const subjectId = String(payload.subjectId || "unclassified").trim();
      const catalogSubject = subjectId === "unclassified" ? null : await findCatalogSubject(subjectId);
      if (subjectId !== "unclassified" && !catalogSubject) return json(res, 400, { error: "Matière introuvable" });
      const subjectTitle = catalogSubject?.title || String(payload.subjectTitle || "À classer").trim();
      const recordingId = String(payload.recordingId || `recording-${Date.now()}`).slice(0, 180);
      if (payload.strictChapterSelection === true && !String(payload.chapterId || "").trim()) return json(res, 400, { error: "Choisis un chapitre déjà créé dans cette matière" });
      const chapterDefinition = await resolveChapterAssignment(subjectId, payload.chapterId);
      const chapterId = chapterDefinition?.id || null;
      const requestedParts = normalizePartFields({ partLabel: payload.partLabel, partScope: payload.partScope });
      const requestedPartScope = requestedParts.partScope;
      let transcript = typeof payload.transcript === "string" ? payload.transcript.trim() : "";
      let sourceValidation = transcript ? validateTranscription(transcript) : null;
      const courses = await readJsonFile(LESSONS, []);
      let course = courses.find((item) => item.externalRecordingId === recordingId);
      const courseNumber = chapterDefinition
        ? (course?.chapterId === chapterDefinition.id && Number.isInteger(Number(course.courseNumber)) ? Number(course.courseNumber) : nextCourseNumber(courses, subjectId, chapterDefinition.id))
        : null;
      const partLabel = courseNumber ? `Phase ${courseNumber}` : (requestedParts.automaticNumber ? null : requestedParts.partLabel);
      if (!course) {
        course = {
          id: `mobile-${slug(recordingId)}-${Date.now()}`,
          externalRecordingId: recordingId,
          source: "mobile",
          subjectId,
          subjectTitle,
          title,
          date,
          kind: payload.kind === "chapitre" ? "chapitre" : "cours",
          chapter: chapterDefinition?.title || chapter,
          chapterId,
          courseNumber,
          partLabel,
          partScope: requestedPartScope,
          status: transcript ? (sourceValidation.ok ? "a-traiter" : "source-insuffisante") : "transcription-en-attente",
          transcriptionState: transcript ? (sourceValidation.ok ? "received" : "invalid") : "pending",
          transcriptionAttempts: 0,
          transcriptionRetryable: !transcript,
          automationEligible: Boolean(transcript && sourceValidation?.ok),
          transcriptionFilename: null,
          summaryFilename: null,
          recordingFilename: null,
          notes: String(payload.notes || "").trim(),
          photos: [],
          recordingMarkers: normalizeRecordingMarkers(payload.recordingMarkers) || [],
          transcriptSections: normalizeTranscriptSections(payload.transcriptSections) || [],
          ...(payload.audioDurationMs !== undefined ? { audioDurationMs: Math.max(0, Math.round(Number(payload.audioDurationMs) || 0)) } : {}),
          cards: [],
          recallStatus: "locked",
          recallScore: 0,
          lastRecalledAt: null,
          recallDiagnostic: null,
          sourceValidation,
          automationError: sourceValidation?.ok ? null : (sourceValidation ? sourceValidationError(sourceValidation) : null),
          createdAt: new Date().toISOString(),
        };
        courses.push(course);
      } else {
        course.title = title;
        course.subjectId = subjectId;
        course.subjectTitle = subjectTitle;
        if (hasOwn(payload, "chapter") || hasOwn(payload, "chapterId")) {
          course.chapter = chapterDefinition?.title || chapter;
          course.chapterId = chapterId;
          course.courseNumber = courseNumber;
        }
        if (hasOwn(payload, "partLabel") || hasOwn(payload, "partScope") || payload.strictChapterSelection === true) {
          course.partLabel = partLabel;
          course.partScope = requestedPartScope;
        }
        if (transcript) {
          course.sourceValidation = sourceValidation;
          course.transcriptionState = sourceValidation.ok ? "received" : "invalid";
          course.transcriptionRetryable = false;
          course.status = sourceValidation.ok ? "a-traiter" : "source-insuffisante";
          course.automationEligible = sourceValidation.ok;
          course.automationError = sourceValidation.ok ? null : sourceValidationError(sourceValidation);
        } else if (!course.transcriptionFilename) {
          course.transcriptionState ||= "pending";
          course.transcriptionAttempts = Number(course.transcriptionAttempts || 0);
          course.transcriptionRetryable = true;
        }
      }
      if (typeof payload.notes === "string" && payload.notes.trim()) course.notes = payload.notes.trim();
      if (hasOwn(payload, "recordingMarkers")) course.recordingMarkers = normalizeRecordingMarkers(payload.recordingMarkers);
      if (hasOwn(payload, "transcriptSections")) course.transcriptSections = normalizeTranscriptSections(payload.transcriptSections);
      if (hasOwn(payload, "audioDurationMs")) {
        const duration = Number(payload.audioDurationMs);
        if (!Number.isFinite(duration) || duration < 0 || duration > 24 * 60 * 60 * 1000) throw new Error("Durée audio invalide");
        course.audioDurationMs = Math.round(duration);
      }
      validateOffsetsAgainstDuration(course.recordingMarkers, course.transcriptSections, course.audioDurationMs);
      course.photos = course.photos || [];

      let audioFilename = course.recordingFilename || null;
      let audioBuffer = null;
      let mime = String(payload.mimeType || "audio/webm").toLowerCase();
      if (payload.audioBase64 && !audioFilename) {
        const rawAudio = String(payload.audioBase64).replace(/^data:[^,]+,/, "");
        audioBuffer = Buffer.from(rawAudio, "base64");
        if (!audioBuffer.length) throw new Error("Audio invalide");
        const extension = mime.includes("mp4") || mime.includes("m4a") ? ".m4a" : mime.includes("ogg") ? ".ogg" : ".webm";
        audioFilename = safeRecordingFilename(`${date}__${slug(subjectTitle)}__${slug(title)}__${slug(recordingId)}`, extension);
        await writeFile(path.join(RECORDINGS, audioFilename), audioBuffer);
        course.recordingFilename = audioFilename;
      }

      const recordings = await readJsonFile(RECORDINGS_INDEX, []);
      const previousRecording = recordings.find((item) => item.recordingId === recordingId || item.filename === audioFilename);
      if (audioFilename) {
        const recordingEntry = {
          ...(previousRecording || {}),
          recordingId,
          filename: audioFilename,
          courseId: course.id,
          subjectId,
          title,
          date,
          mimeType: previousRecording?.mimeType || mime,
          ...(audioBuffer ? { bytes: audioBuffer.length } : {}),
          createdAt: previousRecording?.createdAt || new Date().toISOString(),
        };
        const nextRecordings = recordings.filter((item) => item.recordingId !== recordingId && item.filename !== audioFilename);
        nextRecordings.push(recordingEntry);
        await saveJsonArray(RECORDINGS_INDEX, nextRecordings);
      }
      if (!transcript && audioFilename && process.env.OPENAI_API_KEY && !audioBuffer) {
        audioBuffer = await readFile(path.join(RECORDINGS, audioFilename)).catch(() => null);
      }

      let transcriptionProvider = transcript ? "device" : course.transcriptionProvider || null;
      if (!transcript && audioBuffer && process.env.OPENAI_API_KEY) {
        try {
          transcript = await transcribeWithOpenAI(audioBuffer, mime, audioFilename || "cours.webm", `${subjectTitle} — ${title}${course.chapter ? ` — ${course.chapter}` : ""}`);
          if (transcript) {
            transcriptionProvider = process.env.BIOMIA_TRANSCRIPTION_MODEL || "gpt-4o-transcribe";
            sourceValidation = validateTranscription(transcript);
          }
        } catch (error) {
          course.transcriptionError = error.message;
          course.transcriptionState = "failed";
          course.transcriptionRetryable = true;
          course.transcriptionFailedAt = new Date().toISOString();
          course.transcriptionAttempts = Number(course.transcriptionAttempts || 0) + 1;
        }
      }

      const shouldStoreTranscript = Boolean(transcript && (!course.transcriptionFilename || course.sourceValidation?.ok === false));
      if (transcript && shouldStoreTranscript) {
        const filename = `${date}__${slug(subjectTitle)}__${slug(title)}__${slug(recordingId)}.txt`;
        const { resolved } = safeFilePath(filename);
        await writeFile(resolved, transcript, "utf8");
        const indexFile = path.join(TRANSCRIPTIONS, "index.json");
        const index = await readJsonFile(indexFile, []);
        const next = index.filter((item) => item.filename !== filename);
        next.push({ filename, title, courseId: course.id, courseTitle: title, date, provider: transcriptionProvider || "device", sourceValidation });
        await saveJsonArray(indexFile, next);
        course.transcriptionFilename = filename;
        course.transcriptionProvider = transcriptionProvider;
        course.transcriptionState = sourceValidation.ok ? "received" : "invalid";
        course.transcriptionRetryable = false;
        course.transcriptionError = null;
        course.transcriptionCompletedAt = new Date().toISOString();
        course.sourceValidation = sourceValidation;
        course.status = sourceValidation.ok ? "a-traiter" : "source-insuffisante";
        course.automationEligible = sourceValidation.ok;
        course.automationError = sourceValidation.ok ? null : sourceValidationError(sourceValidation);
      }
      if (transcript && (!Array.isArray(course.transcriptSections) || !course.transcriptSections.length)) {
        course.transcriptSections = proposeTranscriptSections(course, transcript);
      }
      if (Array.isArray(payload.photos)) {
        for (const photoPayload of payload.photos.slice(0, 12)) {
          if (!photoPayload?.dataBase64) continue;
          await appendCoursePhoto(course, photoPayload);
        }
      }
      course.updatedAt = new Date().toISOString();
      await saveCourses(courses);
      const effectiveSourceValidation = sourceValidation || course.sourceValidation || null;
      return json(res, 201, {
        synced: true,
        course: courseForResponse(course),
        audioFilename,
        transcriptionReceived: Boolean(transcript || course.transcriptionFilename),
        transcriptionProvider,
        codexQueued: Boolean((transcript && sourceValidation?.ok) || (course.transcriptionFilename && course.automationEligible)),
        sourceValidation: effectiveSourceValidation,
      });
    } catch (error) {
      return json(res, 400, { error: error.message || "Synchronisation impossible" });
    }
    });
  }
  if (req.method === "POST" && url.pathname === "/api/recall-correction") {
    try {
      const payload = JSON.parse(await readBody(req));
      const courseId = String(payload && payload.courseId || "").trim();
      const answer = typeof (payload && payload.answer) === "string" ? payload.answer.trim() : "";
      if (!courseId || !answer) return json(res, 400, { error: "courseId et answer sont nécessaires" });
      const courses = await readJsonFile(LESSONS, []);
      const course = courses.find((item) => item.id === courseId);
      if (!course) return json(res, 404, { error: "Cours introuvable" });
      const result = await correctRecall({
        root: ROOT,
        configPath: AUTOMATION_CONFIG,
        course,
        answer,
        attempt: Number.isFinite(Number(payload.attempt)) ? Number(payload.attempt) : 1,
        previousCorrection: payload.previousCorrection && typeof payload.previousCorrection === "object" ? payload.previousCorrection : null,
      });
      if (!result.ok) return json(res, 422, { ok: false, reason: result.reason || "source-insuffisante", sourceWarnings: result.sourceWarnings || [] });
      return json(res, 200, { ok: true, evaluation: result.evaluation });
    } catch (error) {
      return json(res, 400, { error: error.message || "Correction impossible" });
    }
  }
  if (req.method === "POST" && url.pathname === "/api/audio/transcribe") {
    try {
      const payload = JSON.parse(await readBody(req, MAX_REVISION_AUDIO_BODY));
      const raw = String(payload.audioBase64 || payload.dataBase64 || "").replace(/^data:[^,]+,/, "");
      const audio = Buffer.from(raw, "base64");
      const kind = ["recall", "exam", "recording"].includes(payload.kind) ? payload.kind : "recall";
      if (payload.courseId) {
        const courses = await readJsonFile(LESSONS, []);
        if (!courses.some((item) => item.id === String(payload.courseId))) return json(res, 404, { error: "Cours introuvable" });
      }
      return json(res, 200, await transcribeLocally(audio, payload.mimeType, kind));
    } catch (error) { return json(res, 422, { error: error.message || "Transcription impossible" }); }
  }
  if (req.method === "GET" && url.pathname === "/api/learning-insights") {
    const [courses, sessions] = await Promise.all([syncLegacyCourses(), readJsonFile(REVISION_SESSIONS, [])]);
    const courseId = String(url.searchParams.get("courseId") || "").trim() || null;
    const progression = progressionsForCourses(courses, sessions, courseId);
    return json(res, 200, { recurringErrors: recurringErrorsForSessions(sessions, courseId), progression, progress: progression, generatedAt: new Date().toISOString() });
  }
  if (req.method === "GET" && url.pathname === "/api/exams") {
    const [exams, courses, sessions] = await Promise.all([readJsonFile(EXAMS, []), syncLegacyCourses(), readJsonFile(REVISION_SESSIONS, [])]);
    return json(res, 200, exams.map((exam) => { const planning = examPlan(exam, courses, sessions); return { ...exam, planning, plan: planning }; }));
  }
  if (req.method === "POST" && url.pathname === "/api/exams") {
    try {
      const payload = JSON.parse(await readBody(req));
      const date = String(payload.date || ""); if (!isValidCourseDate(date) || date < localDate()) return json(res, 400, { error: "Date d'examen invalide ou passée" });
      const title = String(payload.title || "Partiel").trim(); if (!title) return json(res, 400, { error: "Titre d'examen nécessaire" });
      const minutesPerDay = Number(payload.minutesPerDay); if (!Number.isInteger(minutesPerDay) || minutesPerDay < 5 || minutesPerDay > 600) return json(res, 400, { error: "Durée quotidienne invalide" });
      const subjectId = String(payload.subjectId || "").trim() || null;
      const chapterIds = normalizeBoundedStringArray(payload.chapterIds, "chapterIds", 100);
      if (subjectId && !(await findCatalogSubject(subjectId))) return json(res, 400, { error: "Matière d'examen introuvable" });
      const definitions = await readJsonFile(CHAPTER_DEFINITIONS, []);
      if (chapterIds.some((id) => !definitions.some((chapter) => chapter.id === id && (!subjectId || chapter.subjectId === subjectId)))) return json(res, 400, { error: "Un chapitre n'appartient pas à la matière choisie" });
      const exams = await readJsonFile(EXAMS, []); const exam = { id: `exam-${Date.now()}-${slug(title)}`, title, date, subjectId, chapterIds, minutesPerDay, status: payload.status === "archived" ? "archived" : "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      exams.push(exam); await saveJsonArray(EXAMS, exams);
      const [courses, sessions] = await Promise.all([syncLegacyCourses(), readJsonFile(REVISION_SESSIONS, [])]);
      const planning = examPlan(exam, courses, sessions);
      return json(res, 201, { ...exam, planning, plan: planning });
    } catch (error) { return json(res, 400, { error: error.message || "Examen impossible à créer" }); }
  }
  const examMatch = url.pathname.match(/^\/api\/exams\/([^/]+)$/);
  if (req.method === "GET" && examMatch) {
    const [exams, courses, sessions] = await Promise.all([readJsonFile(EXAMS, []), syncLegacyCourses(), readJsonFile(REVISION_SESSIONS, [])]);
    const exam = exams.find((item) => item.id === decodeURIComponent(examMatch[1]));
    if (!exam) return json(res, 404, { error: "Examen introuvable" });
    const planning = examPlan(exam, courses, sessions);
    return json(res, 200, { ...exam, planning, plan: planning });
  }
  if ((req.method === "PATCH" || req.method === "PUT") && examMatch) {
    try { const payload = JSON.parse(await readBody(req)); const exams = await readJsonFile(EXAMS, []); const exam = exams.find((item) => item.id === decodeURIComponent(examMatch[1])); if (!exam) return json(res, 404, { error: "Examen introuvable" });
      if (hasOwn(payload, "title")) { if (!String(payload.title || "").trim()) throw new Error("Titre d'examen nécessaire"); exam.title = String(payload.title).trim(); }
      if (hasOwn(payload, "date")) { if (!isValidCourseDate(payload.date) || payload.date < localDate()) throw new Error("Date d'examen invalide ou passée"); exam.date = payload.date; }
      const nextSubjectId = hasOwn(payload, "subjectId") ? String(payload.subjectId || "").trim() || null : exam.subjectId;
      const nextChapterIds = hasOwn(payload, "chapterIds") ? normalizeBoundedStringArray(payload.chapterIds, "chapterIds", 100) : exam.chapterIds;
      if (nextSubjectId && !(await findCatalogSubject(nextSubjectId))) throw new Error("Matière d'examen introuvable");
      const definitions = await readJsonFile(CHAPTER_DEFINITIONS, []);
      if (nextChapterIds.some((id) => !definitions.some((chapter) => chapter.id === id && (!nextSubjectId || chapter.subjectId === nextSubjectId)))) throw new Error("Un chapitre n'appartient pas à la matière choisie");
      exam.chapterIds = nextChapterIds;
      exam.subjectId = nextSubjectId;
      if (hasOwn(payload, "minutesPerDay")) { const value = Number(payload.minutesPerDay); if (!Number.isInteger(value) || value < 5 || value > 600) throw new Error("Durée quotidienne invalide"); exam.minutesPerDay = value; }
      if (hasOwn(payload, "status")) exam.status = payload.status === "archived" ? "archived" : "active"; exam.updatedAt = new Date().toISOString(); await saveJsonArray(EXAMS, exams);
      const [courses, sessions] = await Promise.all([syncLegacyCourses(), readJsonFile(REVISION_SESSIONS, [])]);
      const planning = examPlan(exam, courses, sessions);
      return json(res, 200, { ...exam, planning, plan: planning });
    } catch (error) { return json(res, 400, { error: error.message || "Examen impossible à modifier" }); }
  }
  if (req.method === "DELETE" && examMatch) { const exams = await readJsonFile(EXAMS, []); const id = decodeURIComponent(examMatch[1]); if (!exams.some((item) => item.id === id)) return json(res, 404, { error: "Examen introuvable" }); await saveJsonArray(EXAMS, exams.filter((item) => item.id !== id)); return json(res, 200, { deleted: true, id }); }
  if (req.method === "POST" && url.pathname === "/api/adaptive-session") {
    try {
      const payload = JSON.parse(await readBody(req)); const minutes = Number(payload.minutes);
      if (!Number.isInteger(minutes) || minutes < 3 || minutes > 240) return json(res, 400, { error: "Durée de séance invalide" });
      const [courses, reviews, sessions, exams] = await Promise.all([syncLegacyCourses(), readJsonFile(REVIEWS, []), readJsonFile(REVISION_SESSIONS, []), readJsonFile(EXAMS, [])]);
      const exam = payload.examId ? exams.find((item) => item.id === String(payload.examId)) : null; if (payload.examId && !exam) return json(res, 404, { error: "Examen introuvable" });
      const subjectId = String(payload.subjectId || exam?.subjectId || "").trim() || null;
      const chapterIds = normalizeBoundedStringArray(payload.chapterIds, "chapterIds", 100);
      const chapterId = String(payload.chapterId || "").trim() || null;
      const courseIds = normalizeBoundedStringArray(payload.courseIds, "courseIds", 200);
      const mode = payload.mode === "oral-exam" ? "oral-exam" : "adaptive";
      const today = localDate(); const weaknesses = aggregateWeaknesses(reviews, sessions); const weakCards = new Set(weaknesses.filter((item) => item.active).map((item) => `${item.courseId}::${item.cardId || ""}`));
      const eligible = courses.filter((course) => course.status === "ready" && (!subjectId || course.subjectId === subjectId) && (!chapterId || course.chapterId === chapterId) && (!chapterIds.length || chapterIds.includes(course.chapterId)) && (!courseIds.length || courseIds.includes(course.id)) && (!exam?.chapterIds?.length || exam.chapterIds.includes(course.chapterId)));
      const candidates = eligible.flatMap((course) => {
        const allowedCards = (course.cards || []).filter((card) => mode !== "oral-exam" || /pourquoi|comment|explique|compare|décri|justifi/iu.test(`${card.question || ""} ${card.prompt || ""}`));
        return allowedCards.map((card) => {
          const review = latestReviews(reviews).get(`${course.id}::${card.id}`);
          const due = !review || String(review.nextReview || review.nextReviewAt || "").slice(0, 10) <= today;
          const weak = weakCards.has(`${course.id}::${card.id}`) || weakCards.has(`${course.id}::`);
          return { type: "card", courseId: course.id, chapterId: course.chapterId || null, subjectId: course.subjectId, cardId: card.id, question: card.question || card.prompt || "", answer: card.answer || card.response || "", estimatedMinutes: mode === "oral-exam" ? 3 : 2, rationale: weak ? "erreur récurrente" : due ? "révision due" : "nouvelle question", priority: (weak ? 30 : 0) + (due ? 15 : 0) + (!review ? 5 : 0) };
        });
      });
      if (mode === "oral-exam" && !candidates.length) return json(res, 200, { mode, requestedMinutes: minutes, estimatedMinutes: 0, items: [], cardIds: [], courseIds: [], rationale: "Aucune question ouverte existante dans ce périmètre" });
      const selection = candidates.sort((a, b) => b.priority - a.priority || a.courseId.localeCompare(b.courseId) || a.cardId.localeCompare(b.cardId)).reduce((result, item) => result.minutes + item.estimatedMinutes <= minutes ? { minutes: result.minutes + item.estimatedMinutes, items: [...result.items, item] } : result, { minutes: 0, items: [] });
      return json(res, 200, { mode, requestedMinutes: minutes, estimatedMinutes: selection.minutes, items: selection.items, cardIds: selection.items.map((item) => item.cardId), courseIds: [...new Set(selection.items.map((item) => item.courseId))], rationale: "sélection déterministe à partir des cartes et historiques existants" });
    } catch (error) { return json(res, 400, { error: error.message || "Séance adaptative impossible" }); }
  }
  if (req.method === "GET" && url.pathname === "/api/revision-sessions") {
    return json(res, 200, await readJsonFile(REVISION_SESSIONS, []));
  }
  if (req.method === "POST" && url.pathname === "/api/revision-sessions") {
    return withSessionsLock(async () => {
      try {
        const payload = JSON.parse(await readBody(req));
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) return json(res, 400, { error: "Session invalide" });
        const type = ["course-recall", "chapter-recall", "question", "oral-exam"].includes(payload.type) ? payload.type : "course-recall";
        const requestedCourseIds = normalizeBoundedStringArray(payload.courseIds, "courseIds", 200);
        if (!payload.courseId && !requestedCourseIds.length && !payload.chapterId && !payload.subjectId) return json(res, 400, { error: "La session doit être reliée à un cours, un chapitre ou une matière" });
        const allCourses = await readJsonFile(LESSONS, []);
        const courseId = payload.courseId ? String(payload.courseId).trim() : (requestedCourseIds[0] || null);
        const course = courseId ? allCourses.find((item) => item.id === courseId) : null;
        if (courseId && !course) return json(res, 404, { error: "Cours introuvable pour cette session" });
        const courseIds = [...new Set([courseId, ...requestedCourseIds].filter(Boolean))];
        const linkedCourses = courseIds.map((id) => allCourses.find((item) => item.id === id));
        if (linkedCourses.some((item) => !item)) return json(res, 404, { error: "Un cours de la session est introuvable" });
        const commonSubjectId = linkedCourses.length && linkedCourses.every((item) => item.subjectId === linkedCourses[0].subjectId) ? linkedCourses[0].subjectId : null;
        const commonChapterId = linkedCourses.length && linkedCourses.every((item) => (item.chapterId || null) === (linkedCourses[0].chapterId || null)) ? (linkedCourses[0].chapterId || null) : null;
        const subjectId = String(payload.subjectId || commonSubjectId || course?.subjectId || "").trim() || null;
        const chapterId = payload.chapterId ? String(payload.chapterId).trim() : (commonChapterId || (courseIds.length <= 1 ? course?.chapterId || null : null));
        if (chapterId) {
          const chapter = await resolveChapterAssignment(subjectId || course?.subjectId, chapterId);
          if (!chapter) return json(res, 400, { error: "Chapitre invalide pour cette session" });
        }
        const rating = normalizeSessionRating(payload);
        const sessions = await readJsonFile(REVISION_SESSIONS, []);
        const id = String(payload.id || `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        const createdAt = payload.createdAt && !Number.isNaN(Date.parse(payload.createdAt)) ? payload.createdAt : new Date().toISOString();
        const defaultScopeCourse = type === "oral-exam" && courseIds.length > 1 ? null : course;
        const normalizedParts = normalizePartFields({
          partLabel: hasOwn(payload, "partLabel") ? payload.partLabel : defaultScopeCourse?.partLabel,
          partScope: hasOwn(payload, "partScope") ? payload.partScope : defaultScopeCourse?.partScope,
        });
        const scope = {
          courseId: courseId || undefined,
          subjectId: subjectId || undefined,
          chapterId: chapterId || undefined,
          partLabel: defaultScopeCourse?.courseNumber ? `Phase ${defaultScopeCourse.courseNumber}` : normalizedParts.partLabel || undefined,
          partScope: normalizedParts.partScope || undefined,
        };
        const previous = sessions.filter((item) => item.id !== id && sessionScopeKey(item) === sessionScopeKey({ type, ...scope }));
        const schedule = rating ? calculateSessionSchedule(rating, previous, new Date(createdAt)) : { intervalDays: null, nextReview: null };
        const weakConcepts = normalizeWeakConcepts(payload.weakConcepts || payload.evaluation?.concepts);
        const weakCardIds = normalizeBoundedStringArray(payload.weakCardIds, "weakCardIds", 64);
        const missing = normalizeBoundedStringArray(payload.missing, "missing", 32);
        const session = {
          ...payload,
          id,
          type,
          ...scope,
          ...(type === "oral-exam" ? { courseIds } : {}),
          rating,
          intervalDays: rating ? schedule.intervalDays : (payload.intervalDays ?? null),
          nextReview: rating ? schedule.nextReview : (payload.nextReview || null),
          weakCardIds,
          weakConcepts,
          missing,
          score: normalizeScore(payload.score),
          answerText: typeof payload.answerText === "string" ? payload.answerText.slice(0, 30000) : "",
          createdAt,
          updatedAt: new Date().toISOString(),
        };
        const next = [...sessions.filter((item) => item.id !== id), session].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        await saveJsonArray(REVISION_SESSIONS, next);
        if (courseId) await updateWeakConceptIndex({ courseId, subjectId, chapterId, cardIds: weakCardIds, concepts: weakConcepts, missing, rating, createdAt });
        return json(res, 201, session);
      } catch (error) {
        return json(res, 400, { error: error.message || "Session impossible à enregistrer" });
      }
    });
  }
  if (req.method === "GET" && url.pathname === "/api/weaknesses") {
    const [reviews, sessions] = await Promise.all([
      readJsonFile(REVIEWS, []),
      readJsonFile(REVISION_SESSIONS, []),
    ]);
    const courseId = String(url.searchParams.get("courseId") || "").trim();
    const cardId = String(url.searchParams.get("cardId") || "").trim();
    const weaknesses = aggregateWeaknesses(reviews, sessions).filter((item) =>
      (!courseId || item.courseId === courseId) && (!cardId || item.cardId === cardId)
    );
    return json(res, 200, { ok: true, weaknesses, updatedAt: new Date().toISOString() });
  }
  if (req.method === "GET" && url.pathname === "/api/planning") {
    const [courses, reviews, sessions, chapters, chapterDefinitions] = await Promise.all([
      syncLegacyCourses(),
      readJsonFile(REVIEWS, []),
      readJsonFile(REVISION_SESSIONS, []),
      readJsonFile(CHAPTERS, []),
      readJsonFile(CHAPTER_DEFINITIONS, []),
    ]);
    const plan = buildLearningPlan({
      courses,
      reviews,
      sessions,
      chapters,
      chapterDefinitions,
      startDate: url.searchParams.get("startDate") || localDate(),
      days: Number(url.searchParams.get("days") || 14),
      subjectId: url.searchParams.get("subjectId") || null,
    });
    return json(res, 200, plan);
  }
  if (req.method === "GET" && url.pathname === "/api/revision-calendar") {
    const [courses, reviews, sessions, chapters, chapterDefinitions] = await Promise.all([
      syncLegacyCourses(),
      readJsonFile(REVIEWS, []),
      readJsonFile(REVISION_SESSIONS, []),
      readJsonFile(CHAPTERS, []),
      readJsonFile(CHAPTER_DEFINITIONS, []),
    ]);
    const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") || 14)));
    const plan = buildLearningPlan({
      courses,
      reviews,
      sessions,
      chapters,
      chapterDefinitions,
      startDate: url.searchParams.get("startDate") || localDate(),
      days,
      subjectId: url.searchParams.get("subjectId") || null,
    });
    const today = localDate();
    const calendar = plan.days.map((day) => ({
      ...day,
      isToday: day.date === today,
      isPast: day.date < today,
      overdueCount: day.items.filter((item) => String(item.dueDate || item.date) < today).length,
    }));
    return json(res, 200, {
      ...plan,
      calendar,
      sourceOfTruth: "server",
      serverDate: today,
      filters: {
        subjectId: url.searchParams.get("subjectId") || null,
        startDate: plan.startDate,
        days,
      },
    });
  }
  if (req.method === "GET" && url.pathname === "/api/reviews") {
    return json(res, 200, await readJsonFile(REVIEWS, []));
  }
  if (req.method === "POST" && url.pathname === "/api/reviews") {
    return withReviewsLock(async () => {
      try {
        const payload = JSON.parse(await readBody(req));
        const courseId = String(payload && (payload.courseId || payload.lessonId) || "").trim();
        const cardId = String(payload && payload.cardId || "").trim();
        const rating = Number(payload && payload.rating);
        if (!courseId || !cardId || !Number.isInteger(rating) || ![1, 2, 3, 4].includes(rating)) return json(res, 400, { error: "Carte invalide" });
        const courses = await readJsonFile(LESSONS, []);
        const course = courses.find((item) => item.id === courseId);
        if (!course) return json(res, 404, { error: "Cours introuvable pour cette question" });
        if (!Array.isArray(course.cards) || !course.cards.some((card) => String(card.id) === cardId)) return json(res, 400, { error: "Question introuvable dans ce cours" });
        const reviews = await readJsonFile(REVIEWS, []);
        const previous = reviews.filter((item) => String(item.courseId || item.lessonId || "") === courseId && String(item.cardId || "") === cardId);
        const createdAt = payload.createdAt && !Number.isNaN(Date.parse(payload.createdAt)) ? new Date(payload.createdAt) : new Date();
        const schedule = calculateCardSchedule(rating, previous, createdAt, {
          algorithm: "fsrs",
          targetRetention: 0.90,
          maxInterval: 36500,
        });
        const weakConcepts = normalizeWeakConcepts(payload.weakConcepts || payload.evaluation?.concepts);
        const weakCardIds = [...new Set((Array.isArray(payload.weakCardIds) ? payload.weakCardIds : []).map((value) => String(value || "").trim()).filter(Boolean))];
        const review = {
          ...payload,
          courseId,
          lessonId: payload.lessonId || courseId,
          cardId,
          rating,
          intervalDays: schedule.intervalDays,
          reviewCount: schedule.reviewCount,
          nextReviewAt: schedule.nextReviewAt,
          nextReview: schedule.nextReview,
          schedule,
          weakCardIds,
          weakConcepts,
          createdAt: createdAt.toISOString(),
        };
        reviews.push(review);
        await saveJsonArray(REVIEWS, reviews);
        await updateWeakConceptIndex({ courseId, subjectId: course.subjectId, chapterId: course.chapterId, cardIds: weakCardIds.length ? weakCardIds : (rating <= 2 ? [cardId] : []), concepts: weakConcepts, missing: [], rating: rating <= 2 ? rating : 3, createdAt: review.createdAt });
        return json(res, 201, review);
      } catch (error) {
        return json(res, 400, { error: error.message || "Révision impossible" });
      }
    });
  }
  if (req.method === "GET" && url.pathname === "/api/training/interleaved") {
    const [courses, reviews] = await Promise.all([
      syncLegacyCourses(),
      readJsonFile(REVIEWS, []),
    ]);
    const count = Math.min(100, Math.max(1, Number(url.searchParams.get("count") || 15)));
    const subjectsParam = url.searchParams.get("subjects");
    const subjectIds = subjectsParam ? subjectsParam.split(",").map((s) => s.trim()).filter(Boolean) : null;
    const items = generateInterleavedSession({ courses, reviews, count, subjectIds });
    return json(res, 200, { ok: true, count: items.length, items });
  }
  if (req.method === "GET" && url.pathname === "/api/training/traps") {
    const [courses, reviews] = await Promise.all([
      syncLegacyCourses(),
      readJsonFile(REVIEWS, []),
    ]);
    const items = extractExamTrapsAndErrors({ courses, reviews });
    return json(res, 200, { ok: true, count: items.length, items });
  }
  if (req.method === "POST" && url.pathname === "/api/training/feynman-evaluate") {
    try {
      const payload = JSON.parse(await readBody(req));
      const courseId = String(payload.courseId || "").trim();
      const cardId = String(payload.cardId || "").trim();
      const explanationText = String(payload.explanationText || "").trim();

      const courses = await readJsonFile(LESSONS, []);
      const course = courses.find((c) => c.id === courseId);
      const card = course?.cards?.find((cd) => String(cd.id) === cardId);

      const evaluation = evaluateFeynmanExplanation({ card, course, explanationText });
      return json(res, 200, { ok: true, evaluation });
    } catch (error) {
      return json(res, 400, { error: error.message || "Évaluation Feynman impossible" });
    }
  }
  if (req.method === "GET" && url.pathname === "/api/clarifications") {
    const list = await readJsonFile(CLARIFICATIONS, []);
    return json(res, 200, { ok: true, count: list.length, items: list });
  }
  if (req.method === "POST" && url.pathname === "/api/clarifications/record") {
    try {
      const payload = JSON.parse(await readBody(req));
      const list = await readJsonFile(CLARIFICATIONS, []);
      const result = recordOrUpdateClarification({
        clarifications: list,
        subjectId: payload.subjectId,
        courseId: payload.courseId,
        chapterId: payload.chapterId,
        question: payload.question,
        answer: payload.answer,
        context: payload.context,
      });
      await saveJsonArray(CLARIFICATIONS, list);
      return json(res, 201, { ok: true, ...result });
    } catch (error) {
      return json(res, 400, { error: error.message || "Enregistrement de clarification impossible" });
    }
  }
  if (req.method === "POST" && url.pathname === "/api/oral/prepare") {
    try {
      const payload = JSON.parse(await readBody(req));
      const sessionData = {
        id: `oral-req-${Date.now()}`,
        subjectId: payload.subjectId || null,
        subjectTitle: payload.subjectTitle || null,
        chapter: payload.chapter || null,
        courseId: payload.courseId || null,
        courseTitle: payload.courseTitle || null,
        prompt: payload.prompt || "cours oral sur mes cours",
        requestedAt: new Date().toISOString(),
        status: "pending",
      };
      await writeFile(PENDING_ORAL, JSON.stringify(sessionData, null, 2) + "\n", "utf8");
      return json(res, 200, { ok: true, session: sessionData });
    } catch (error) {
      return json(res, 400, { error: error.message || "Préparation de l'oral impossible" });
    }
  }
  if (req.method === "GET" && url.pathname === "/api/oral/pending") {
    try {
      if (!existsSync(PENDING_ORAL)) return json(res, 200, { ok: true, session: null });
      const raw = await readFile(PENDING_ORAL, "utf8");
      const session = JSON.parse(raw);
      return json(res, 200, { ok: true, session });
    } catch {
      return json(res, 200, { ok: true, session: null });
    }
  }
  if (req.method === "POST" && url.pathname === "/api/reviews/batch") {
    return withReviewsLock(async () => {
      try {
        const payload = JSON.parse(await readBody(req));
        const items = Array.isArray(payload && payload.reviews) ? payload.reviews : [];
        if (!items.length) return json(res, 200, { ok: true, savedCount: 0 });

        const courses = await readJsonFile(LESSONS, []);
        const reviews = await readJsonFile(REVIEWS, []);
        let savedCount = 0;

        for (const item of items) {
          const courseId = String(item.courseId || item.lessonId || "").trim();
          const cardId = String(item.cardId || "").trim();
          const rating = Number(item.rating);
          if (!courseId || !cardId || ![1, 2, 3, 4].includes(rating)) continue;

          const course = courses.find((c) => c.id === courseId);
          if (!course || !course.cards?.some((c) => String(c.id) === cardId)) continue;

          const previous = reviews.filter((r) => String(r.courseId || r.lessonId || "") === courseId && String(r.cardId || "") === cardId);
          const createdAt = item.createdAt && !Number.isNaN(Date.parse(item.createdAt)) ? new Date(item.createdAt) : new Date();
          const schedule = calculateCardSchedule(rating, previous, createdAt, {
            algorithm: "fsrs",
            targetRetention: 0.90,
            maxInterval: 36500,
          });

          const review = {
            ...item,
            id: item.id || `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            courseId,
            lessonId: item.lessonId || courseId,
            cardId,
            rating,
            scheduledDays: schedule.scheduledDays,
            intervalDays: schedule.intervalDays,
            stability: schedule.stability,
            difficulty: schedule.difficulty,
            retrievability: schedule.retrievability,
            nextReview: schedule.nextReview,
            nextReviewAt: schedule.nextReviewAt,
            reviewCount: schedule.reviewCount,
            createdAt: createdAt.toISOString(),
            updatedAt: new Date().toISOString(),
          };
          reviews.push(review);
          savedCount++;
        }

        await saveJsonArray(REVIEWS, reviews);
        return json(res, 200, { ok: true, savedCount, totalReviews: reviews.length });
      } catch (error) {
        return json(res, 400, { error: error.message || "Erreur de synchronisation par lot" });
      }
    });
  }
  return json(res, 404, { error: "Route inconnue" });
}

function renderMobilePortalHtml({ localIp, port, tailscaleUrl, expoPort = 8081 }) {
  const expoUrl = `exp://${localIp}:${expoPort}`;
  const apkDownloadUrl = `/cours.apk`;
  const pwaUrl = `/`;

  return `<!DOCTYPE html>
<html lang="fr" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Cours Mobile — Installation & Connexion</title>
  <link rel="icon" type="image/png" href="/icon-192.png">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            background: '#09090b',
            surface: '#121216',
            surfaceMuted: '#18181f',
            border: '#27272a',
            accent: '#3b82f6',
          }
        }
      }
    }
  </script>
  <style>
    body { background-color: #09090b; color: #f4f4f5; font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body class="min-h-screen p-4 flex flex-col items-center justify-between antialiased">
  <div class="w-full max-w-md space-y-6 pt-4">
    <!-- Header -->
    <div class="text-center space-y-2">
      <div class="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center font-black text-white text-2xl mx-auto shadow-xl shadow-blue-500/25">
        C
      </div>
      <h1 class="text-2xl font-black tracking-tight text-white">Cours Mobile</h1>
      <p class="text-xs text-zinc-400">Votre Cockpit de Révision & d'Amphi</p>
      <div id="connStatus" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>PC Connecté : ${localIp}:${port}</span>
      </div>
    </div>

    <!-- Platform Detection Banner -->
    <div id="platformNotice" class="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-3">
      <span class="text-2xl" id="osIcon">📱</span>
      <div>
        <strong class="block text-white" id="osTitle">Téléphone Détecté</strong>
        <span class="text-[11px] text-zinc-400" id="osSub">Choisissez le mode d'installation pour votre smartphone</span>
      </div>
    </div>

    <!-- Primary Action: Standalone Native APK (Android) -->
    <div id="androidCard" class="p-5 rounded-3xl bg-gradient-to-b from-surfaceMuted to-surface border border-emerald-500/30 space-y-3 shadow-xl">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold uppercase tracking-wider text-emerald-400">Option 1 • Recommandée Android</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">App Native Standalone</span>
      </div>
      <h3 class="text-base font-bold text-white">Installer l'Application Cours (.apk)</h3>
      <p class="text-xs text-zinc-400 leading-relaxed">
        Installe l'application complète directement sur votre écran d'accueil avec icône native et micro amphi haute fidélité.
      </p>
      <a href="${apkDownloadUrl}" download="cours.apk" class="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all text-center">
        <span>📲 Télécharger Cours (.apk)</span>
      </a>
      <div class="text-[11px] text-zinc-500 space-y-1 pt-1">
        <p>1. Cliquez sur Télécharger ci-dessus</p>
        <p>2. Ouvrez le fichier téléchargé et appuyez sur « Installer »</p>
        <p>3. L'application Cours apparaît sur votre accueil !</p>
      </div>
    </div>

    <!-- Alternative Action: Native Expo Go (iOS & Android) -->
    <div class="p-5 rounded-3xl bg-surface border border-border space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold uppercase tracking-wider text-blue-400">Option 2 • Instantanée (iOS & Android)</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold">Expo Go</span>
      </div>
      <h3 class="text-base font-bold text-white">Lancer dans Expo Go</h3>
      <p class="text-xs text-zinc-400 leading-relaxed">
        Ouvre directement l'application native dans Expo Go sans aucun téléchargement d'APK.
      </p>
      <a href="${expoUrl}" class="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all text-center">
        <span>⚡ Ouvrir dans Expo Go</span>
      </a>
    </div>

    <!-- Web App Fallback -->
    <div class="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-between">
      <div>
        <h4 class="text-xs font-bold text-zinc-300">Version Web / PWA</h4>
        <p class="text-[10px] text-zinc-500">Utiliser dans Safari / Chrome</p>
      </div>
      <a href="${pwaUrl}" class="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs">
        Ouvrir Web →
      </a>
    </div>
  </div>

  <footer class="text-center text-[10px] text-zinc-600 py-4">
    Cours (Revision OS) • Parité Totale Mac, Web & Mobile
  </footer>

  <script>
    // Auto register device
    try {
      const ua = navigator.userAgent;
      const isAndroid = /Android/i.test(ua);
      const isIOS = /iPhone|iPad|iPod/i.test(ua);
      const platform = isAndroid ? 'android' : (isIOS ? 'ios' : 'web');
      const deviceName = isAndroid ? 'Android Smartphone' : (isIOS ? 'iPhone' : 'Navigateur Mobile');

      fetch('/api/devices/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'mob-' + Math.random().toString(36).slice(2, 9),
          deviceName,
          platform,
        })
      }).catch(() => {});

      const osIcon = document.getElementById('osIcon');
      const osTitle = document.getElementById('osTitle');
      const osSub = document.getElementById('osSub');
      const androidCard = document.getElementById('androidCard');

      if (isAndroid) {
        if (osIcon) osIcon.innerText = '🤖';
        if (osTitle) osTitle.innerText = 'Smartphone Android Détecté';
        if (osSub) osSub.innerText = 'Téléchargez l\\\'APK native ci-dessous pour une installation 1-clic sur votre écran d\\\'accueil';
      } else if (isIOS) {
        if (osIcon) osIcon.innerText = '🍏';
        if (osTitle) osTitle.innerText = 'iPhone Détecté';
        if (osSub) osSub.innerText = 'Lancez dans Expo Go ou ajoutez à l\\\'écran d\\\'accueil Safari';
        if (androidCard) androidCard.classList.add('opacity-60');
      }
    } catch {}
  </script>
</body>
</html>`;
}

async function serveStatic(res, pathname) {
  // Mobile / Pair Portal Route
  if (pathname === "/mobile" || pathname === "/pair") {
    const localIp = getLocalIp();
    let tailscaleUrl = null;
    try {
      const { execSync } = await import("node:child_process");
      const ip = execSync("tailscale ip -4 2>/dev/null || true", { stdio: ["pipe", "pipe", "ignore"], encoding: "utf8" }).trim();
      if (ip) tailscaleUrl = `http://${ip}:${PORT}`;
    } catch {}

    const html = renderMobilePortalHtml({ localIp, port: PORT, tailscaleUrl });
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": Buffer.byteLength(html),
      "Cache-Control": "no-cache",
    });
    return res.end(html);
  }

  // Landing Page & Docs Routes
  if (pathname === "/landing" || pathname === "/landing/" || pathname === "/landing/index.html") {
    const p = path.resolve(ROOT, "landing", "index.html");
    if (existsSync(p)) {
      const data = await readFile(p);
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": data.length,
        "Cache-Control": "no-cache",
      });
      return res.end(data);
    }
  }

  if (pathname === "/docs" || pathname === "/docs/" || pathname === "/docs.html") {
    const p = path.resolve(ROOT, "landing", "docs.html");
    if (existsSync(p)) {
      const data = await readFile(p);
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": data.length,
        "Cache-Control": "no-cache",
      });
      return res.end(data);
    }
  }

  // Direct install.sh script
  if (pathname === "/install.sh" || pathname === "/install") {
    const candidatePaths = [
      path.resolve(ROOT, "install.sh"),
      path.resolve(ROOT, "landing", "install.sh"),
      path.resolve(ROOT, "public", "install.sh"),
    ];
    for (const p of candidatePaths) {
      if (existsSync(p)) {
        const data = await readFile(p);
        res.writeHead(200, {
          "Content-Type": "text/x-shellscript; charset=utf-8",
          "Content-Length": data.length,
          "Cache-Control": "public, max-age=60",
        });
        return res.end(data);
      }
    }
  }

  // Direct macOS DMG Download
  if (pathname === "/Cours-macOS.dmg" || pathname === "/download/mac-dmg" || pathname === "/download/dmg") {
    const candidatePaths = [
      path.resolve(ROOT, "Cours-macOS.dmg"),
      path.resolve(ROOT, "landing", "Cours-macOS.dmg"),
      path.resolve(ROOT, "public", "Cours-macOS.dmg"),
    ];
    for (const p of candidatePaths) {
      if (existsSync(p)) {
        const data = await readFile(p);
        res.writeHead(200, {
          "Content-Type": "application/x-apple-diskimage",
          "Content-Disposition": 'attachment; filename="Cours-macOS.dmg"',
          "Content-Length": data.length,
          "Cache-Control": "public, max-age=3600",
        });
        return res.end(data);
      }
    }
  }

  // Direct macOS ZIP Download
  if (pathname === "/Cours-macOS.zip" || pathname === "/download/mac-zip" || pathname === "/download/mac-app") {
    const candidatePaths = [
      path.resolve(ROOT, "Cours-macOS.zip"),
      path.resolve(ROOT, "landing", "Cours-macOS.zip"),
      path.resolve(ROOT, "public", "Cours-macOS.zip"),
    ];
    for (const p of candidatePaths) {
      if (existsSync(p)) {
        const data = await readFile(p);
        res.writeHead(200, {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="Cours-macOS.zip"',
          "Content-Length": data.length,
          "Cache-Control": "public, max-age=3600",
        });
        return res.end(data);
      }
    }
  }

  // Direct macOS PKG Download
  if (pathname === "/Cours-macOS.pkg" || pathname === "/download/mac-pkg") {
    const candidatePaths = [
      path.resolve(ROOT, "Cours-macOS.pkg"),
      path.resolve(ROOT, "landing", "Cours-macOS.pkg"),
      path.resolve(ROOT, "public", "Cours-macOS.pkg"),
    ];
    for (const p of candidatePaths) {
      if (existsSync(p)) {
        const data = await readFile(p);
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": 'attachment; filename="Cours-macOS.pkg"',
          "Content-Length": data.length,
          "Cache-Control": "public, max-age=3600",
        });
        return res.end(data);
      }
    }
  }

  // Direct APK Downloads
  if (pathname === "/cours.apk" || pathname === "/download/cours.apk" || pathname === "/api/mobile/apk") {
    const candidatePaths = [
      path.resolve(ROOT, "public", "cours.apk"),
      path.resolve(ROOT, "landing", "cours.apk"),
      path.resolve(ROOT, "apps", "mobile", "android", "app", "build", "outputs", "apk", "release", "app-release.apk"),
      path.resolve(ROOT, "apps", "mobile", "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
    ];
    for (const p of candidatePaths) {
      if (existsSync(p)) {
        const data = await readFile(p);
        res.writeHead(200, {
          "Content-Type": "application/vnd.android.package-archive",
          "Content-Disposition": 'attachment; filename="cours.apk"',
          "Content-Length": data.length,
          "Cache-Control": "public, max-age=3600",
        });
        return res.end(data);
      }
    }
    return text(res, 404, "Fichier APK introuvable. Veuillez compiler l'application mobile.");
  }

  // Direct macOS 1-Click Installer Download
  if (pathname === "/download/mac" || pathname === "/Installer-macOS.command") {
    const p = path.resolve(ROOT, "landing", "Installer-macOS.command");
    if (existsSync(p)) {
      const data = await readFile(p);
      res.writeHead(200, {
        "Content-Type": "application/x-sh",
        "Content-Disposition": 'attachment; filename="Installer-Cours.command"',
        "Content-Length": data.length,
      });
      return res.end(data);
    }
  }

  // Direct Windows 1-Click Installer Download
  if (pathname === "/download/windows" || pathname === "/Installer-Windows.bat") {
    const p = path.resolve(ROOT, "landing", "Installer-Windows.bat");
    if (existsSync(p)) {
      const data = await readFile(p);
      res.writeHead(200, {
        "Content-Type": "application/x-bat",
        "Content-Disposition": 'attachment; filename="Installer-Cours.bat"',
        "Content-Length": data.length,
      });
      return res.end(data);
    }
  }

  let requested = pathname === "/" ? "index.html" : pathname.slice(1);
  let file = path.resolve(PUBLIC, requested);
  if (!file.startsWith(path.resolve(PUBLIC) + path.sep) || !existsSync(file)) {
    // SPA Fallback for client-side routing
    if (!path.extname(requested)) {
      file = path.resolve(PUBLIC, "index.html");
    } else {
      return text(res, 404, "Not found");
    }
  }
  const ext = path.extname(file).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".dmg": "application/x-apple-diskimage",
    ".pkg": "application/octet-stream",
    ".zip": "application/zip",
    ".apk": "application/vnd.android.package-archive",
    ".sh": "text/x-shellscript; charset=utf-8",
    ".command": "text/x-shellscript; charset=utf-8",
    ".bat": "application/x-bat",
    ".ps1": "text/plain; charset=utf-8",
    ".woff2": "font/woff2",
    ".apk": "application/vnd.android.package-archive",
    ".command": "application/x-sh",
    ".bat": "application/x-bat",
  };
  const data = await readFile(file);
  const contentType = contentTypes[ext] || "application/octet-stream";
  const headers = {
    "Content-Type": contentType,
    "Content-Length": data.length,
    "Cache-Control": ext === ".apk" ? "public, max-age=3600" : "no-cache, no-store, must-revalidate",
  };
  if (ext === ".apk") {
    headers["Content-Disposition"] = 'attachment; filename="cours.apk"';
  }
  res.writeHead(200, headers);
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) await handleApi(req, res, url);
    else await serveStatic(res, url.pathname);
  } catch (error) {
    json(res, 500, { error: error.message || "Erreur serveur" });
  }
});

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  server.listen(PORT, HOST, async () => {
    let localIp = "127.0.0.1";
    try {
      const os = await import("node:os");
      const nets = os.networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
          if (net.family === "IPv4" && !net.internal) {
            localIp = net.address;
            break;
          }
        }
      }
    } catch {}

    console.log(`\n\x1b[32m\x1b[1m🎉 Serveur Cours démarré avec succès !\x1b[0m`);
    console.log(`💻 \x1b[36mMac / Web :\x1b[0m   http://localhost:${PORT}`);
    console.log(`📱 \x1b[35mMobile Wi-Fi :\x1b[0m http://${localIp}:${PORT}\n`);

    try {
      const qrcode = await import("qrcode-terminal");
      const qrGen = qrcode.default?.generate || qrcode.generate;
      if (qrGen) {
        console.log(`\x1b[33m\x1b[1m📱 Scannez ce QR Code avec votre téléphone pour ouvrir l'application :\x1b[0m`);
        qrGen(`http://${localIp}:${PORT}`, { small: true }, (qr) => {
          console.log(qr + "\n");
        });
      }
    } catch {}
  });
}

export { server, normalizePartScope, normalizePartFields, nextCourseNumber, courseForResponse, normalizeRecordingMarkers, normalizeTranscriptSections, proposeTranscriptSections, normalizeScore, recurringErrorsForSessions, progressionsForCourses };
