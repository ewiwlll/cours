import { spawn } from "node:child_process";
import { readFile, writeFile, readdir, stat, mkdir, rename, unlink } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadEnvFile,
  slug,
  localDate,
  normalizeTranscriptForValidation,
  validateTranscription,
  sourceValidationError,
} from "./shared-utils.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(ROOT);

const DATA = path.join(ROOT, "data");
const COURSES_FILE = path.join(DATA, "courses.json");
const LESSONS_FILE = path.join(DATA, "cours", "index.json");
const CHAPTERS_FILE = path.join(DATA, "cours", "chapters.json");
const AUTOMATION_DIR = path.join(DATA, "automation");
const CONFIG_FILE = path.join(AUTOMATION_DIR, "config.json");
const PROCESSED_FILE = path.join(AUTOMATION_DIR, "processed.json");
const LOG_DIR = path.join(AUTOMATION_DIR, "logs");
const RECORDINGS_DIR = path.join(DATA, "enregistrements");
const TRANSCRIPTIONS_DIR = path.join(DATA, "transcriptions");
const TRANSCRIPTIONS_INDEX_FILE = path.join(TRANSCRIPTIONS_DIR, "index.json");
const LOCAL_TRANSCRIPTION_DIR = path.join(AUTOMATION_DIR, "local-transcriptions");
const DEFAULT_INBOX = path.join(ROOT, "inbox");
const API_BASE = process.env.BIOMIA_API_BASE || `http://127.0.0.1:${process.env.BIOMIA_PORT || 4317}`;
const ALLOWED_EXTENSIONS = new Set([".txt", ".md", ".srt", ".vtt", ".json"]);
const DEFAULT_RETRY_BASE_MS = 60_000;
const DEFAULT_RETRY_MAX_MS = 30 * 60_000;
const STALE_ATTEMPT_MS = 30 * 60_000;
const running = new Set();
const queue = [];
let scanRunning = false;
let drainRunning = false;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + "\n", "utf8");
  await rename(temporary, file);
}

async function loadConfig() {
  loadEnvIfPresent(ROOT);
  const stored = await readJson(CONFIG_FILE, {});
  const configuredInbox = process.env.BIOMIA_PHONE_INBOX || stored.inboxPath || DEFAULT_INBOX;
  return {
    inboxPath: path.isAbsolute(configuredInbox) ? configuredInbox : path.resolve(ROOT, configuredInbox),
    scanEveryMs: Number(process.env.BIOMIA_SCAN_EVERY_MS || stored.scanEveryMs || 8000),
    stableWaitMs: Number(process.env.BIOMIA_STABLE_WAIT_MS || stored.stableWaitMs || 1800),
    apiBase: API_BASE,
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || stored.gemini?.apiKey || "",
      model: process.env.GEMINI_MODEL || stored.gemini?.model || "gemini-3.7-flash",
    },
    codex: {
      binary: process.env.BIOMIA_CODEX_BIN || stored.codex?.binary || "/Applications/ChatGPT.app/Contents/Resources/codex",
      model: process.env.GEMINI_MODEL || process.env.BIOMIA_CODEX_MODEL || stored.codex?.model || "gemini-3.7-flash",
      reasoningEffort: process.env.BIOMIA_CODEX_REASONING_EFFORT || stored.codex?.reasoningEffort || "xhigh",
      sandbox: process.env.BIOMIA_CODEX_SANDBOX || stored.codex?.sandbox || "workspace-write",
      approval: process.env.BIOMIA_CODEX_APPROVAL || stored.codex?.approval || "approve-for-me",
    },
    transcription: {
      enabled: process.env.BIOMIA_LOCAL_TRANSCRIPTION !== "0" && stored.transcription?.enabled !== false,
      binary: process.env.BIOMIA_WHISPER_BIN || stored.transcription?.binary || "/opt/homebrew/opt/whisper-cpp/bin/whisper-cli",
      model: process.env.BIOMIA_WHISPER_MODEL || stored.transcription?.model || path.join(ROOT, "models", "whisper", "ggml-large-v3-turbo-q5_0.bin"),
      ffmpeg: process.env.BIOMIA_FFMPEG_BIN || stored.transcription?.ffmpeg || "/opt/homebrew/bin/ffmpeg",
      language: process.env.BIOMIA_WHISPER_LANGUAGE || stored.transcription?.language || "fr",
    },
    retry: {
      baseMs: Number(process.env.BIOMIA_RETRY_BASE_MS || stored.retry?.baseMs || DEFAULT_RETRY_BASE_MS),
      maxMs: Number(process.env.BIOMIA_RETRY_MAX_MS || stored.retry?.maxMs || DEFAULT_RETRY_MAX_MS),
    },
    dryRun: process.env.BIOMIA_AUTOMATION_DRY_RUN === "1",
  };
}

function retryDelayMs(attempt, config = {}) {
  const base = Math.max(1000, Number(config.retry?.baseMs || DEFAULT_RETRY_BASE_MS));
  const maximum = Math.max(base, Number(config.retry?.maxMs || DEFAULT_RETRY_MAX_MS));
  return Math.min(maximum, base * (2 ** Math.max(0, Number(attempt || 1) - 1)));
}

function nextAttemptAt(attempt, config = {}, now = new Date()) {
  return new Date(now.getTime() + retryDelayMs(attempt, config)).toISOString();
}

function retryWindowOpen(record, now = Date.now()) {
  const next = Date.parse(String(record?.nextAttemptAt || ""));
  return !Number.isFinite(next) || next <= now;
}

function retryableProcessed(record) {
  return record?.status !== "error" || record.retryable !== false;
}

function processingStale(record, now = Date.now()) {
  if (record?.status !== "processing") return false;
  const started = Date.parse(String(record.queuedAt || record.startedAt || ""));
  return !Number.isFinite(started) || now - started >= STALE_ATTEMPT_MS;
}

function dateFromFilename(filename, fallbackDate) {
  const match = filename.match(/(?:^|[^0-9])(20\d{2})[-_](\d{2})[-_](\d{2})(?:[^0-9]|$)/);
  if (!match) return fallbackDate;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function cleanTitle(filename, subjectItem, date) {
  let title = path.basename(filename, path.extname(filename));
  title = title.replace(/^20\d{2}[-_]\d{2}[-_]\d{2}[_ -]*/u, "");
  title = title.split("__").filter(Boolean).at(-1) || title;
  if (subjectItem) {
    const aliases = [slug(subjectItem.title), slug(subjectItem.id).replace(/^s\d+-/, "")].filter(Boolean);
    for (const alias of aliases) title = title.replace(new RegExp(alias, "ig"), "");
  }
  title = title.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return title || `Cours du ${date}`;
}

function subjectMatches(subjectItem, value) {
  const candidate = slug(value);
  if (!candidate || candidate === "inbox" || candidate === "transcriptions") return false;
  const compact = (input) => input.replace(/-(?:et|pour|les|la|le|des|du|a|l)-/g, "-").replace(/^(?:et|pour|les|la|le|des|du|a|l)-/, "");
  const compactCandidate = compact(candidate);
  const aliases = [slug(subjectItem.id), slug(subjectItem.title), slug(subjectItem.id).replace(/^s\d+-/, "")].filter(Boolean);
  return aliases.some((alias) => {
    const compactAlias = compact(alias);
    return candidate === alias || candidate.includes(alias) || alias.includes(candidate) || compactCandidate === compactAlias || compactCandidate.includes(compactAlias) || compactAlias.includes(compactCandidate);
  });
}

async function catalog() {
  const value = await readJson(COURSES_FILE, { courses: [] });
  return value.courses || [];
}

async function inferCourse(file, subjects, inboxPath) {
  const relative = path.relative(inboxPath, file);
  const parts = relative.split(path.sep).slice(0, -1).concat(path.basename(file));
  const subjectItem = subjects
    .slice()
    .sort((a, b) => String(b.title).length - String(a.title).length)
    .find((item) => parts.some((part) => subjectMatches(item, part))) || null;
  const fileInfo = await stat(file);
  const date = dateFromFilename(path.basename(file), localDate(fileInfo.mtime));
  const basename = path.basename(file).toLowerCase();
  const isChapter = /(?:chapitre|chapter|^ch[ ._-]?\d)/i.test(basename);
  const chapter = isChapter ? (basename.match(/(?:chapitre|chapter|ch)[ ._-]*([\w-]+)/i)?.[1] || "") : "";
  return {
    subjectId: subjectItem?.id || "unclassified",
    subjectTitle: subjectItem?.title || "À classer",
    title: cleanTitle(file, subjectItem, date),
    date,
    kind: isChapter ? "chapitre" : "cours",
    chapter,
    sourceRelativePath: relative,
  };
}

async function collectFiles(directory) {
  const result = [];
  async function visit(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name.endsWith(".part") || entry.name.endsWith(".tmp")) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(fullPath);
      else if (ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) result.push(fullPath);
    }
  }
  await visit(directory);
  return result;
}

async function fileKey(file) {
  const info = await stat(file);
  return `${path.resolve(file)}::${info.size}::${info.mtimeMs}`;
}

async function stable(file, waitMs) {
  const first = await stat(file);
  await sleep(waitMs);
  const second = await stat(file);
  return first.size === second.size && first.mtimeMs === second.mtimeMs;
}

async function updateCourse(courseId, changes) {
  const courses = await readJson(LESSONS_FILE, []);
  const item = courses.find((course) => course.id === courseId);
  if (!item) throw new Error(`Cours introuvable : ${courseId}`);
  Object.assign(item, changes, { updatedAt: new Date().toISOString() });
  await writeJson(LESSONS_FILE, courses);
  return item;
}

function executable(configured, fallback) {
  return configured || fallback;
}

async function runCommand(command, args, options = {}) {
  const child = spawn(command, args, { cwd: ROOT, ...options });
  const stdout = [];
  const stderr = [];
  child.stdout?.on("data", (chunk) => stdout.push(chunk));
  child.stderr?.on("data", (chunk) => stderr.push(chunk));
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  return {
    exitCode,
    stdout: Buffer.concat(stdout).toString("utf8"),
    stderr: Buffer.concat(stderr).toString("utf8"),
  };
}

async function markTranscriptionFailure(config, course, error, retryable = true) {
  const attempts = Number(course.transcriptionAttempts || 0) + 1;
  const failedAt = new Date().toISOString();
  const next = retryable ? nextAttemptAt(attempts, config) : null;
  const updated = await updateCourse(course.id, {
    status: "transcription-en-attente",
    transcriptionState: retryable ? "failed" : "disabled",
    transcriptionRetryable: retryable,
    transcriptionAttempts: attempts,
    transcriptionLastAttemptAt: failedAt,
    transcriptionNextAttemptAt: next,
    transcriptionProvider: "whisper.cpp-local",
    transcriptionError: error,
    transcriptionFailedAt: failedAt,
  });
  return { ok: false, retryable, error, nextAttemptAt: next, course: updated };
}

async function transcribeLocally(config, course) {
  const audioFilename = path.basename(String(course.recordingFilename || ""));
  const audioPath = path.join(RECORDINGS_DIR, audioFilename);
  const whisper = executable(config.transcription.binary, "whisper-cli");
  const ffmpeg = executable(config.transcription.ffmpeg, "ffmpeg");
  const model = path.resolve(ROOT, config.transcription.model);
  if (!config.transcription.enabled) return markTranscriptionFailure(config, course, "Transcription locale désactivée", false);
  if (!audioFilename || !existsSync(audioPath)) return markTranscriptionFailure(config, course, "Audio local introuvable");
  if (path.isAbsolute(whisper) && !existsSync(whisper)) return markTranscriptionFailure(config, course, `Whisper.cpp introuvable : ${whisper}`);
  if (!existsSync(model)) return markTranscriptionFailure(config, course, `Modèle Whisper introuvable : ${model}`);

  await mkdir(LOCAL_TRANSCRIPTION_DIR, { recursive: true });
  const stem = `${slug(course.id)}-${Date.now()}`;
  const wavPath = path.join(LOCAL_TRANSCRIPTION_DIR, `${stem}.wav`);
  const outputBase = path.join(LOCAL_TRANSCRIPTION_DIR, stem);
  const attempt = Number(course.transcriptionAttempts || 0) + 1;
  const startedAt = new Date().toISOString();
  await updateCourse(course.id, {
    status: "transcription-en-cours",
    transcriptionState: "running",
    transcriptionRetryable: true,
    transcriptionAttempts: attempt,
    transcriptionLastAttemptAt: startedAt,
    transcriptionNextAttemptAt: null,
    transcriptionProvider: "whisper.cpp-local",
    transcriptionError: null,
    transcriptionStartedAt: new Date().toISOString(),
  });
  try {
    const converted = await runCommand(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", audioPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wavPath]);
    if (converted.exitCode !== 0 || !existsSync(wavPath)) {
      throw new Error(`Conversion audio impossible : ${converted.stderr.trim() || `code ${converted.exitCode}`}`);
    }
    const result = await runCommand(whisper, [
      "--model", model,
      "--file", wavPath,
      "--language", config.transcription.language,
      "--output-txt",
      "--output-file", outputBase,
      "--no-timestamps",
      "--split-on-word",
      "--threads", String(Math.min(8, Math.max(2, Number(process.env.BIOMIA_WHISPER_THREADS || 8)))),
    ], { env: process.env });
    const outputPath = `${outputBase}.txt`;
    const content = existsSync(outputPath) ? (await readFile(outputPath, "utf8")).trim() : result.stdout.trim();
    if (result.exitCode !== 0 || !content) {
      throw new Error(`Whisper.cpp n'a pas produit de transcription : ${result.stderr.trim() || `code ${result.exitCode}`}`);
    }
    const sourceValidation = validateTranscription(content);

    const filename = `${course.date}__${slug(course.subjectTitle)}__${slug(course.title)}__${slug(course.externalRecordingId || course.id)}.txt`;
    await mkdir(TRANSCRIPTIONS_DIR, { recursive: true });
    await writeFile(path.join(TRANSCRIPTIONS_DIR, filename), `${content}\n`, "utf8");
    const index = await readJson(TRANSCRIPTIONS_INDEX_FILE, []);
    const next = index.filter((item) => item.filename !== filename);
    next.push({ filename, title: course.title, courseId: course.id, courseTitle: course.title, date: course.date, provider: "whisper.cpp-local", sourceValidation });
    await writeJson(TRANSCRIPTIONS_INDEX_FILE, next);
    const updated = await updateCourse(course.id, {
      transcriptionFilename: filename,
      transcriptionProvider: "whisper.cpp-local",
      transcriptionState: sourceValidation.ok ? "completed" : "invalid",
      transcriptionRetryable: false,
      transcriptionNextAttemptAt: null,
      transcriptionError: null,
      transcriptionCompletedAt: new Date().toISOString(),
      sourceValidation,
      status: sourceValidation.ok ? "a-traiter" : "source-insuffisante",
      automationEligible: sourceValidation.ok,
      automationError: sourceValidation.ok ? null : sourceValidationError(sourceValidation),
    });
    return { ok: true, sourceInsufficient: !sourceValidation.ok, course: updated, filename, sourceValidation };
  } catch (error) {
    return markTranscriptionFailure(config, { ...course, transcriptionAttempts: attempt - 1 }, error.message);
  } finally {
    await Promise.all([
      unlink(wavPath).catch(() => undefined),
      unlink(`${outputBase}.txt`).catch(() => undefined),
    ]);
  }
}

async function callApi(config, endpoint, options) {
  const response = await fetch(`${config.apiBase}${endpoint}`, options);
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error || `API ${response.status}`);
  return payload;
}

function codexExecutable(config) {
  if (config.codex.binary && existsSync(config.codex.binary)) return config.codex.binary;
  return "codex";
}

async function validateCourseSource(course, sourceFilename) {
  const filename = path.basename(String(sourceFilename || ""));
  if (!filename) {
    return {
      ok: false,
      reason: "introuvable",
      message: "La transcription source est introuvable.",
      characters: 0,
      words: 0,
      letters: 0,
      quality: "insuffisante",
      checkedAt: new Date().toISOString(),
    };
  }
  const sourcePath = path.join(TRANSCRIPTIONS_DIR, filename);
  const content = await readFile(sourcePath, "utf8").catch(() => null);
  if (content === null) {
    return {
      ok: false,
      reason: "introuvable",
      message: `La transcription source ${filename} est introuvable.`,
      characters: 0,
      words: 0,
      letters: 0,
      quality: "insuffisante",
      checkedAt: new Date().toISOString(),
    };
  }
  return validateTranscription(content);
}

async function markSourceInsufficient(course, sourceValidation) {
  const message = sourceValidationError(sourceValidation);
  const updated = await updateCourse(course.id, {
    status: "source-insuffisante",
    automationState: "blocked",
    automationRetryable: false,
    automationNextAttemptAt: null,
    sourceValidation,
    automationEligible: false,
    automationError: message,
    automationFinishedAt: new Date().toISOString(),
  });
  return { ok: true, sourceInsufficient: true, course: updated, sourceValidation, error: message };
}

async function markAutomationFailure(config, course, error, attempt = Number(course.automationAttempts || 0) + 1) {
  const failedAt = new Date().toISOString();
  const next = nextAttemptAt(attempt, config);
  const updated = await updateCourse(course.id, {
    status: "a-traiter",
    automationState: "failed",
    automationRetryable: true,
    automationAttempts: attempt,
    automationLastAttemptAt: failedAt,
    automationNextAttemptAt: next,
    automationFinishedAt: failedAt,
    automationError: error,
  });
  return { ok: false, retryable: true, nextAttemptAt: next, error, course: updated };
}

async function recoverStaleCourses() {
  const courses = await readJson(LESSONS_FILE, []);
  const cutoff = Date.now() - STALE_ATTEMPT_MS;
  let changed = false;
  for (const course of courses) {
    const started = course.status === "transcription-en-cours"
      ? Date.parse(String(course.transcriptionLastAttemptAt || course.transcriptionStartedAt || ""))
      : Date.parse(String(course.automationLastAttemptAt || course.automationStartedAt || ""));
    if (!Number.isFinite(started) || started > cutoff) continue;
    if (course.status === "transcription-en-cours") {
      Object.assign(course, {
        status: "transcription-en-attente",
        transcriptionState: "failed",
        transcriptionRetryable: true,
        transcriptionNextAttemptAt: null,
        transcriptionError: "Reprise après une tentative interrompue.",
        transcriptionFailedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      changed = true;
    } else if (course.status === "en-traitement") {
      Object.assign(course, {
        status: "a-traiter",
        automationState: "failed",
        automationRetryable: true,
        automationNextAttemptAt: null,
        automationError: "Reprise après une tentative interrompue.",
        automationFinishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      changed = true;
    }
  }
  if (changed) await writeJson(LESSONS_FILE, courses);
  return changed;
}

async function auditCourseSources() {
  const courses = await readJson(LESSONS_FILE, []);
  let changed = false;
  for (const course of courses) {
    if (!course.transcriptionFilename && course.status !== "ready") continue;
    const sourceValidation = await validateCourseSource(course, course.transcriptionFilename);
    if (!sourceValidation.ok) {
      const message = sourceValidationError(sourceValidation);
      const alreadyBlocked = course.status === "source-insuffisante"
        && course.sourceValidation?.reason === sourceValidation.reason
        && course.automationEligible === false
        && course.automationError === message
        && course.automationState === "blocked"
        && course.automationRetryable === false;
      if (!alreadyBlocked) {
        Object.assign(course, {
          status: "source-insuffisante",
          automationState: "blocked",
          automationRetryable: false,
          automationNextAttemptAt: null,
          sourceValidation,
          automationEligible: false,
          automationError: message,
          updatedAt: new Date().toISOString(),
        });
        changed = true;
      }
      continue;
    }
    if (course.sourceValidation?.ok === false && course.status === "source-insuffisante") {
      Object.assign(course, {
        status: "a-traiter",
        automationState: "pending",
        automationRetryable: true,
        automationNextAttemptAt: null,
        sourceValidation,
        automationEligible: true,
        automationError: null,
        updatedAt: new Date().toISOString(),
      });
      changed = true;
    } else if (course.sourceValidation?.ok !== true) {
      course.sourceValidation = sourceValidation;
      changed = true;
    }
  }
  if (changed) await writeJson(LESSONS_FILE, courses);
  return changed;
}

const COURSE_GENERATION_SCHEMA = {
  type: "object",
  properties: {
    summaryMarkdown: {
      type: "string",
      description: "Le contenu Markdown complet de la fiche de cours approfondie avec frontmatter YAML, MOC, Résumé en 5 points, Concepts atomiques détaillés avec pourquoi on en a besoin, analogies, exemples progressifs, boîte à outils/démonstrations, pièges d'examen et questions d'auto-évaluation.",
    },
    moc: {
      type: "object",
      description: "Map of Content structuré du chapitre",
      properties: {
        problematique: { type: "string" },
        overview: { type: "string" },
        phases: {
          type: "array",
          items: {
            type: "object",
            properties: {
              phaseTitle: { type: "string" },
              conceptsFlow: { type: "string" },
              details: { type: "array", items: { type: "string" } },
              consequence: { type: "string" },
            },
            required: ["phaseTitle", "conceptsFlow"],
          },
        },
      },
    },
    atomicConcepts: {
      type: "array",
      description: "Liste des concepts atomiques clés du cours avec explications pédagogiques profondes",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          whyWeNeedIt: { type: "string" },
          analogy: { type: "string" },
          definition: { type: "string" },
          progressiveExamples: {
            type: "array",
            items: {
              type: "object",
              properties: {
                level: { type: "string", enum: ["simple", "intermediaire", "realiste"] },
                title: { type: "string" },
                explanation: { type: "string" },
                codeOrFormula: { type: "string" },
              },
              required: ["level", "title", "explanation"],
            },
          },
          details: { type: "array", items: { type: "string" } },
          traps: { type: "array", items: { type: "string" } },
          relatedConcepts: { type: "array", items: { type: "string" } },
          flashcardQnA: {
            type: "object",
            properties: {
              question: { type: "string" },
              answer: { type: "string" },
            },
          },
        },
        required: ["id", "title", "whyWeNeedIt", "analogy", "definition"],
      },
    },
    boiteAOutils: {
      type: "object",
      properties: {
        theoremsAndLaws: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              statement: { type: "string" },
              proofOrMechanism: { type: "string" },
              conditionOfValidity: { type: "string" },
            },
            required: ["name", "statement"],
          },
        },
        formulas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              formula: { type: "string" },
              variablesExplanation: { type: "string" },
            },
            required: ["name", "formula"],
          },
        },
      },
    },
    methodoExamen: {
      type: "object",
      properties: {
        typicalQuestions: { type: "array", items: { type: "string" } },
        gradingCriteria: { type: "array", items: { type: "string" } },
        commonMistakes: { type: "array", items: { type: "string" } },
      },
    },
    cards: {
      type: "array",
      description: "Liste complète des cartes de révision vérifiées à partir de la source",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          answer: { type: "string" },
          kind: {
            type: "string",
            enum: ["definition", "raisonner", "comparer", "appliquer", "transfert", "qcm", "exercice"],
          },
          source: { type: "string" },
          difficulty: { type: "integer" },
          keywords: {
            type: "array",
            items: { type: "string" },
          },
          commonMistakes: {
            type: "array",
            items: { type: "string" },
          },
          trap: { type: "string" },
          options: {
            type: "array",
            items: { type: "string" },
          },
          correctOption: { type: "integer" },
          explanation: { type: "string" },
        },
        required: ["id", "question", "answer", "kind", "source", "difficulty", "keywords", "commonMistakes", "trap"],
      },
    },
    status: {
      type: "string",
      enum: ["ready", "source-insuffisante"],
    },
  },
  required: ["summaryMarkdown", "cards", "status"],
};

const CHAPTER_TEST_SCHEMA = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      description: "Test transversal avec rappel libre, QCM, comparaison, application et au moins 3 questions de synthèse/transfert croisant plusieurs cours",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          answer: { type: "string" },
          kind: {
            type: "string",
            enum: ["definition", "raisonner", "comparer", "appliquer", "transfert", "qcm", "exercice"],
          },
          source: { type: "string" },
          difficulty: { type: "integer" },
          keywords: {
            type: "array",
            items: { type: "string" },
          },
          commonMistakes: {
            type: "array",
            items: { type: "string" },
          },
          trap: { type: "string" },
          options: {
            type: "array",
            items: { type: "string" },
          },
          correctOption: { type: "integer" },
          explanation: { type: "string" },
        },
        required: ["id", "question", "answer", "kind", "source", "difficulty", "keywords", "commonMistakes", "trap"],
      },
    },
  },
  required: ["cards"],
};

async function callGeminiApi({ config, systemInstruction, prompt, schema, temperature = 0.1, timeoutMs = 90_000 }) {
  const apiKey = config.gemini?.apiKey || process.env.GEMINI_API_KEY || "";
  const primaryModel = config.gemini?.model || process.env.GEMINI_MODEL || "gemini-3.7-flash";
  const candidateModels = Array.from(new Set([primaryModel, "gemini-2.5-flash", "gemini-2.5-pro", "gemini-flash-latest"]));

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY non configurée dans .env ou l'environnement");
  }

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      ...(schema ? { responseSchema: schema } : {}),
      temperature,
    },
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  let lastError;
  for (const model of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          const isRetryable = response.status === 503 || response.status === 429 || response.status >= 500;
          if (isRetryable && attempt < maxRetries) {
            await sleep(attempt * 2000);
            continue;
          }
          lastError = new Error(`Gemini API HTTP ${response.status} (${model}): ${errorText}`);
          break; // move to next model in candidateModels
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error(`Gemini (${model}) n'a renvoyé aucun contenu`);
        }
        return text;
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries && (err.name === "AbortError" || err.message?.includes("fetch failed") || err.message?.includes("503"))) {
          await sleep(attempt * 2000);
          continue;
        }
        break; // move to next model
      } finally {
        clearTimeout(timer);
      }
    }
  }
  throw lastError;
}

function codexPrompt(course, sourceFilename) {
  return `Tu travailles dans l'application locale BioMIA Revision OS.

Cours à traiter : ${course.title}
Identifiant exact du cours : ${course.id}
Matière : ${course.subjectTitle} (${course.subjectId})
Date : ${course.date}
Fichier transcription : ${sourceFilename}

Objectif : transformer cette transcription en fiche de cours fidèle, hiérarchisée et utilisable, puis créer des questions de rappel actif solides. Mets davantage de développement sur les notions définies, répétées, reliées, démontrées ou appliquées par l'enseignant. Conserve les détails secondaires mais condense-les. Quand un sigle ou acronyme apparaît dans la source, demande sa signification et son rôle ; pour chaque mécanisme, ajoute si la source le permet une question « pourquoi / à quoi ça sert ». Ne développe jamais un sigle ambigu comme GDP sans preuve dans la transcription. Ne complète jamais un passage incertain avec une connaissance générale : marque-le À VÉRIFIER.

Écris le résumé Markdown dans data/cours/. Mets à jour l'entrée existante dont l'id est exactement ${course.id} dans data/cours/index.json : conserve ses métadonnées, renseigne summaryFilename, passe status à ready seulement si la fiche et les cartes sont réellement vérifiées, et ajoute les cartes avec id, question, answer, kind, source, difficulty, keywords, commonMistakes et trap. Pour les QCM, ajoute aussi options, correctOption et une explication de la bonne réponse. Ne crée pas une nouvelle entrée et ne transforme pas le catalogue théorique en faux cours.

Les cartes doivent mélanger définition, mécanisme/raison, comparaison, application, transfert/piège et, si pertinent, un exercice gradué. Pour chaque notion A, crée au moins une question de rappel et une question qui oblige à expliquer ou appliquer. Ajoute des QCM avec distracteurs plausibles mais faux selon la source, pas des absurdités. Chaque réponse doit être corrigible à partir de la transcription ou de la fiche et chaque source doit pointer vers un passage réel. Les keywords doivent représenter les idées indispensables à retrouver dans une réponse libre ; commonMistakes/trap doivent décrire les confusions réellement pertinentes. Ne supprime jamais la transcription source. N'utilise pas Internet pour remplacer la source du cours et ne modifie rien en dehors de ce dossier et des fichiers explicitement demandés.`;
}

async function runCodex(config, course, sourceFilename) {
  const logFile = path.join(LOG_DIR, `${course.id}.log`);
  await mkdir(LOG_DIR, { recursive: true });
  const sourceValidation = await validateCourseSource(course, sourceFilename);
  if (!sourceValidation.ok) {
    const result = await markSourceInsufficient(course, sourceValidation);
    await writeFile(logFile, `Traitement bloqué avant Gemini.\n${JSON.stringify(sourceValidation, null, 2)}\n`, "utf8");
    return result;
  }
  const attempt = Number(course.automationAttempts || 0) + 1;
  await updateCourse(course.id, {
    status: "en-traitement",
    automationState: "running",
    automationRetryable: true,
    automationAttempts: attempt,
    automationLastAttemptAt: new Date().toISOString(),
    automationNextAttemptAt: null,
    sourceValidation,
    automationError: null,
    automationStartedAt: new Date().toISOString(),
  });

  const prompt = codexPrompt(course, sourceFilename);
  if (config.dryRun) {
    await writeFile(logFile, `[simulation] Gemini ne sera pas appelé.\n\n${prompt}\n`, "utf8");
    await updateCourse(course.id, { status: "a-traiter", automationState: "pending", automationRetryable: true, automationNextAttemptAt: null });
    return { ok: true, simulated: true };
  }

  const transcriptionPath = path.join(TRANSCRIPTIONS_DIR, sourceFilename);
  const transcriptionContent = await readFile(transcriptionPath, "utf8").catch(() => "");

  const fullPrompt = [
    `Tu es le moteur de génération pédagogique d'excellence de BioMIA Revision OS.`,
    `Ta mission est de produire un cours ultra-développé, captivant et structuré comme les meilleurs cours d'Obsidian (style tutoriel clair, percutant et progressif).`,
    ``,
    `Cours à traiter : ${course.title}`,
    `Identifiant exact du cours : ${course.id}`,
    `Matière : ${course.subjectTitle} (${course.subjectId})`,
    `Date : ${course.date}`,
    `Fichier transcription : ${sourceFilename}`,
    ``,
    `TRANSCRIPTION SOURCE INTÉGRALE :`,
    `"""`,
    transcriptionContent,
    `"""`,
    ``,
    `Directives pédagogiques et d'explication (STYLE D'EXCELLENCE OBSIDIAN) :`,
    `1. "summaryMarkdown" : Fiche complète, approfondie, aérée et très bien rédigée.`,
    `   Doit contenir :`,
    `   - Frontmatter YAML complet (type: fiche-cours, programme: "${course.subjectTitle}", niveau: "L1", matiere_id: "${course.subjectId}", source_transcription: "${sourceFilename}", date_generation: "${course.date}", statut: "ready")`,
    `   - # ${course.subjectTitle} — ${course.title}`,
    `   - ## 🎯 Vue d'ensemble & Problématique centrale (en 3-4 lignes avec [[wikilinks]])`,
    `   - ## ⚡ Résumé en cinq points indispensables`,
    `   - ## 🧠 Concepts atomiques développés (Pour chaque concept clé : Pourquoi on en a besoin, Analogie concrète de la vie courante, Définition accessible, Exemples progressifs du simple au réaliste, Détails & Boîte à outils, Pièges d'examen)`,
    `   - ## 🛠️ Boîte à outils (formules, équations, théorèmes, lois démontrées pas à pas)`,
    `   - ## 🎓 Méthodologie & Questions types de partiel`,
    `   - ## ⚠️ Pièges & Confusions fréquentes d'examen`,
    `   - ## 🔗 Concepts liés ([[Wikilinks]])`,
    `   - ## 📚 Sources & Repères amphi`,
    ``,
    `2. "moc" : Map of Content du chapitre :`,
    `   - problematique : La question centrale du cours`,
    `   - overview : Résumé synthétique reliant les notions avec [[wikilinks]]`,
    `   - phases : Tableau des phases du cours avec progression chronologique/logique (phaseTitle, conceptsFlow, details, consequence)`,
    ``,
    `3. "atomicConcepts" : Décomposition en notes atomiques (1 concept = 1 objet complet) :`,
    `   - id : identifiant stable (ex: "concept-1")`,
    `   - title : nom exact du concept (ex: "Mosaïque fluide", "Bicouche lipidique", "Transport actif primaire")`,
    `   - whyWeNeedIt : Explique POURQUOI on en a besoin sans jargon (le problème que résout cette notion, ce que l'étudiant ressent)`,
    `   - analogy : Métaphore parlante de la vie quotidienne pour ancrer immédiatement le concept (ex: machine à café, filtre, douane, portillon)`,
    `   - definition : Définition formelle, technique mais accessible avec [[wikilinks]] inline`,
    `   - progressiveExamples : Tableau d'exemples progressifs (au moins 2 : simple et réaliste d'amphi/examen) avec level, title, explanation, codeOrFormula`,
    `   - details : Tableau de propriétés et mécanismes clés`,
    `   - traps : Pièges d'examen et contresens fréquents`,
    `   - relatedConcepts : Liste des concepts liés sous forme de titres pour [[Wikilinks]]`,
    `   - flashcardQnA : Question / Réponse immédiate d'auto-évaluation`,
    ``,
    `4. "boiteAOutils" : Théorèmes, lois ou formules avec statements, mécanismes/démonstrations et conditions de validité.`,
    `5. "methodoExamen" : Questions types du professeur, critères de notation, confusions pénalisées au partiel.`,
    `6. "cards" : 6 à 10 cartes de rappel actif FSRS-5 (définition, raisonner, comparer, appliquer, transfert, QCM avec distracteurs plausibles et explication, pièges et keywords).`,
    `7. Règle absolue de rigueur : Tout concept doit être fondé sur la transcription. N'invente aucun fait non attesté.`,
  ].join("\n");

  const outputFile = path.join(LOG_DIR, `${course.id}.last-message.md`);
  let rawJson;
  try {
    rawJson = await callGeminiApi({
      config,
      systemInstruction: "Tu es le moteur pédagogique d'excellence de BioMIA Revision OS. Tu expliques les cours avec une clarté remarquable, des analogies percutantes et des exemples progressifs, tout en restant rigoureusement fidèle aux sources d'amphi.",
      prompt: fullPrompt,
      schema: COURSE_GENERATION_SCHEMA,
    });
  } catch (error) {
    const reason = `Génération Gemini impossible : ${error.message}`;
    await writeFile(logFile, `${reason}\n`, "utf8");
    return markAutomationFailure(config, { ...course, automationAttempts: attempt - 1 }, reason, attempt);
  }

  await writeFile(outputFile, rawJson, "utf8");
  await writeFile(logFile, `model=${config.gemini?.model || "gemini-3.7-flash"}\nstatus=success\n\n${rawJson}`, "utf8");

  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch (parseError) {
    const reason = `JSON Gemini invalide : ${parseError.message}`;
    return markAutomationFailure(config, { ...course, automationAttempts: attempt - 1 }, reason, attempt);
  }

  const summaryMarkdown = (parsed.summaryMarkdown || "").trim();
  const moc = parsed.moc || null;
  const atomicConcepts = Array.isArray(parsed.atomicConcepts) ? parsed.atomicConcepts : [];
  const boiteAOutils = parsed.boiteAOutils || null;
  const methodoExamen = parsed.methodoExamen || null;
  const rawCards = Array.isArray(parsed.cards) ? parsed.cards : [];
  const normalizedCards = rawCards.map((card, idx) => ({
    id: card.id || `${course.id}-${String(idx + 1).padStart(2, "0")}`,
    question: String(card.question || "").trim(),
    answer: String(card.answer || "").trim(),
    kind: ["definition", "raisonner", "comparer", "appliquer", "transfert", "qcm", "exercice"].includes(card.kind) ? card.kind : "definition",
    source: String(card.source || sourceFilename).trim(),
    difficulty: Number.isInteger(card.difficulty) ? card.difficulty : 1,
    keywords: Array.isArray(card.keywords) ? card.keywords.map((k) => String(k).trim()).filter(Boolean) : [],
    commonMistakes: Array.isArray(card.commonMistakes) ? card.commonMistakes.map((m) => String(m).trim()).filter(Boolean) : [],
    trap: String(card.trap || "").trim(),
    ...(card.kind === "qcm" && Array.isArray(card.options) ? {
      options: card.options.map(String),
      correctOption: Number.isInteger(card.correctOption) ? card.correctOption : 0,
      explanation: String(card.explanation || "").trim(),
    } : {}),
  }));

  // Write markdown fiche to data/cours/<id>.md
  const markdownFilename = `${course.id}.md`;
  const markdownPath = path.join(DATA, "cours", markdownFilename);
  await mkdir(path.dirname(markdownPath), { recursive: true });
  await writeFile(markdownPath, summaryMarkdown + "\n", "utf8");

  if (course.summaryFilename && path.basename(course.summaryFilename) !== markdownFilename) {
    const altPath = path.join(DATA, "cours", path.basename(course.summaryFilename));
    await writeFile(altPath, summaryMarkdown + "\n", "utf8").catch(() => undefined);
  }

  const sourceInsufficient = parsed.status === "source-insuffisante"
    || /source\s+insuffisante|fiche de contrôle de source|statut:\s*["']?source insuffisante/i.test(summaryMarkdown);

  const ready = Boolean(summaryMarkdown && normalizedCards.length > 0 && !sourceInsufficient);

  if (sourceInsufficient) {
    const message = "La source est insuffisante : récupération d’une transcription complète nécessaire.";
    await updateCourse(course.id, {
      summaryFilename: course.summaryFilename || markdownFilename,
      cards: normalizedCards,
      moc,
      atomicConcepts,
      boiteAOutils,
      methodoExamen,
      status: "source-insuffisante",
      automationState: "blocked",
      automationRetryable: false,
      automationNextAttemptAt: null,
      automationFinishedAt: new Date().toISOString(),
      automationError: message,
    });
    return { ok: true, sourceInsufficient: true, retryable: false };
  }

  if (ready) {
    const updated = await updateCourse(course.id, {
      summaryFilename: course.summaryFilename || markdownFilename,
      cards: normalizedCards,
      moc,
      atomicConcepts,
      boiteAOutils,
      methodoExamen,
      status: "ready",
      automationState: "completed",
      automationRetryable: false,
      automationNextAttemptAt: null,
      automationFinishedAt: new Date().toISOString(),
      automationError: null,
    });
    return { ok: true };
  }

  const reason = "Gemini a terminé sans déclarer une fiche et des cartes complètes";
  return markAutomationFailure(config, { ...course, automationAttempts: attempt - 1 }, reason, attempt);
}

function chapterDescriptor(course) {
  const chapter = String(course.chapter || "").trim() || (course.kind === "chapitre" ? String(course.title || "").trim() : "");
  if (!chapter) return null;
  return {
    id: `chapter-${slug(course.subjectId)}-${slug(chapter)}`,
    key: `${course.subjectId}::${chapter.toLocaleLowerCase("fr-FR")}`,
    subjectId: course.subjectId,
    subjectTitle: course.subjectTitle,
    title: chapter,
  };
}

function chapterPrompt(descriptor, courses) {
  const sources = courses.map((course) => ({ id: course.id, title: course.title, date: course.date, transcription: course.transcriptionFilename, summary: course.summaryFilename, cards: course.cards?.length || 0 }));
  return `Tu travailles dans l'application locale BioMIA Revision OS.

Crée ou mets à jour le test transversal du chapitre « ${descriptor.title} » dans ${CHAPTERS_FILE}.
Identifiant stable : ${descriptor.id}
Clé stable : ${descriptor.key}
Matière : ${descriptor.subjectTitle} (${descriptor.subjectId})

Cours qui composent ce chapitre :
${JSON.stringify(sources, null, 2)}

Le test doit porter sur l'ensemble du chapitre, pas sur un seul cours. Ne complète pas un passage incertain avec une connaissance générale.

Génère un mélange de rappel libre, QCM à distracteurs plausibles, comparaison, application et au moins trois questions de synthèse/transfert qui croisent plusieurs cours du chapitre. Les pièges doivent tester une confusion réelle, pas jouer sur une formulation ambiguë. Toutes les réponses doivent être corrigibles à partir des sources ; source doit mentionner le cours et le passage utilisé.`;
}

async function runChapterCodex(config, descriptor, courses) {
  const logFile = path.join(LOG_DIR, `${descriptor.id}.log`);
  await mkdir(LOG_DIR, { recursive: true });
  const prompt = chapterPrompt(descriptor, courses);
  if (config.dryRun) {
    await writeFile(logFile, `[simulation] Gemini ne sera pas appelé.\n\n${prompt}\n`, "utf8");
    return { ok: true, simulated: true };
  }

  const courseSources = [];
  for (const c of courses) {
    let transcriptText = "";
    let summaryText = "";
    if (c.transcriptionFilename) {
      transcriptText = await readFile(path.join(TRANSCRIPTIONS_DIR, c.transcriptionFilename), "utf8").catch(() => "");
    }
    const sumFile = c.summaryFilename || `${c.id}.md`;
    summaryText = await readFile(path.join(DATA, "cours", path.basename(sumFile)), "utf8").catch(() => "");
    courseSources.push({
      id: c.id,
      title: c.title,
      date: c.date,
      summaryText,
      transcriptText: transcriptText.slice(0, 10000),
    });
  }

  const fullPrompt = [
    `Tu travailles dans l'application locale BioMIA Revision OS.`,
    ``,
    `Crée ou mets à jour le test transversal du chapitre « ${descriptor.title} » (${descriptor.subjectTitle}).`,
    `Identifiant stable : ${descriptor.id}`,
    `Clé stable : ${descriptor.key}`,
    `Matière : ${descriptor.subjectTitle} (${descriptor.subjectId})`,
    ``,
    `COURS DU CHAPITRE :`,
    courseSources.map((c, i) => `=== COURS ${i + 1}: ${c.title} (ID: ${c.id}) ===\nFiche:\n${c.summaryText || "(non disponible)"}\nTranscription:\n${c.transcriptText || "(non disponible)"}`).join("\n\n"),
    ``,
    `Instructions pédagogiques strictes :`,
    `1. Le test transversal doit porter sur l'ENSEMBLE du chapitre en croisant les notions des différents cours.`,
    `2. Génère une liste de cartes ("cards") comprenant :`,
    `   - Rappel libre fondamental (définition, mécanismes clés)`,
    `   - Comparaisons entre concepts vus dans différents cours du chapitre`,
    `   - Questions d'application et de raisonnement`,
    `   - Au moins trois questions de synthèse/transfert croisant plusieurs cours`,
    `   - QCM à 4 options avec distracteurs plausibles et explication de la bonne réponse`,
    `3. Chaque carte doit comporter :`,
    `   - id : "${descriptor.id}-01", "${descriptor.id}-02", ...`,
    `   - question, answer, kind, source (mentionnant le cours et le passage), difficulty (1 à 3), keywords, commonMistakes, trap`,
    `   - pour les QCM : options (4 choix), correctOption (0 à 3), explanation`,
    `4. Règle absolue : n'invente rien qui ne soit pas présent dans les sources.`,
  ].join("\n");

  const outputFile = path.join(LOG_DIR, `${descriptor.id}.last-message.md`);
  let rawJson;
  try {
    rawJson = await callGeminiApi({
      config,
      systemInstruction: "Tu es un expert pédagogique de BioMIA Revision OS. Tu crées des tests transversaux de chapitre fondés sur l'ensemble des cours du chapitre sans jamais inventer de données.",
      prompt: fullPrompt,
      schema: CHAPTER_TEST_SCHEMA,
    });
  } catch (error) {
    const reason = `Appel Gemini chapitre impossible : ${error.message}`;
    await writeFile(logFile, `${reason}\n`, "utf8");
    return { ok: false, error: reason };
  }

  await writeFile(outputFile, rawJson, "utf8");
  await writeFile(logFile, `model=${config.gemini?.model || "gemini-3.7-flash"}\nstatus=success\n\n${rawJson}`, "utf8");

  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch (parseError) {
    return { ok: false, error: `JSON Gemini chapitre invalide : ${parseError.message}` };
  }

  const rawCards = Array.isArray(parsed.cards) ? parsed.cards : [];
  const normalizedCards = rawCards.map((card, idx) => ({
    id: card.id || `${descriptor.id}-${String(idx + 1).padStart(2, "0")}`,
    question: String(card.question || "").trim(),
    answer: String(card.answer || "").trim(),
    kind: ["definition", "raisonner", "comparer", "appliquer", "transfert", "qcm", "exercice"].includes(card.kind) ? card.kind : "definition",
    source: String(card.source || descriptor.title).trim(),
    difficulty: Number.isInteger(card.difficulty) ? card.difficulty : 1,
    keywords: Array.isArray(card.keywords) ? card.keywords.map((k) => String(k).trim()).filter(Boolean) : [],
    commonMistakes: Array.isArray(card.commonMistakes) ? card.commonMistakes.map((m) => String(m).trim()).filter(Boolean) : [],
    trap: String(card.trap || "").trim(),
    ...(card.kind === "qcm" && Array.isArray(card.options) ? {
      options: card.options.map(String),
      correctOption: Number.isInteger(card.correctOption) ? card.correctOption : 0,
      explanation: String(card.explanation || "").trim(),
    } : {}),
  }));

  if (normalizedCards.length === 0) {
    return { ok: false, error: "Le test de chapitre est incomplet (aucune carte générée)" };
  }

  const chapterEntry = {
    id: descriptor.id,
    subjectId: descriptor.subjectId,
    subjectTitle: descriptor.subjectTitle,
    chapterKey: descriptor.key,
    title: descriptor.title,
    courseIds: courses.map((c) => c.id),
    generatedAt: new Date().toISOString(),
    status: "ready",
    cards: normalizedCards,
  };

  const chapters = await readJson(CHAPTERS_FILE, []);
  const nextChapters = chapters.filter((c) => c.id !== descriptor.id);
  nextChapters.push(chapterEntry);
  await writeJson(CHAPTERS_FILE, nextChapters);

  return { ok: true };
}

async function ingest(file, key, config, subjects, processed) {
  const source = await inferCourse(file, subjects, config.inboxPath);
  let record = processed.files[key] || { sourcePath: path.resolve(file), discoveredAt: new Date().toISOString() };
  let course;
  if (record.courseId) {
    const courses = await readJson(LESSONS_FILE, []);
    course = courses.find((item) => item.id === record.courseId);
  }
  if (!course) {
    course = await callApi(config, "/api/study-courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(source) });
    record.courseId = course.id;
    record.sourceRelativePath = source.sourceRelativePath;
    processed.files[key] = record;
    await writeJson(PROCESSED_FILE, processed);
  }
  if (!record.transcriptionFilename) {
    const content = await readFile(file, "utf8");
    const transcription = await callApi(config, "/api/transcriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: path.basename(file), title: source.title, content, courseId: course.id, courseTitle: source.title, date: source.date }) });
    record.transcriptionFilename = transcription.filename;
    processed.files[key] = record;
    await writeJson(PROCESSED_FILE, processed);
    if (transcription.status === "source-insuffisante" || transcription.sourceValidation?.ok === false) {
      record.status = "source-insuffisante";
      record.completedAt = new Date().toISOString();
      record.error = transcription.sourceValidation?.message || "Source insuffisante";
      processed.files[key] = record;
      await writeJson(PROCESSED_FILE, processed);
      console.log(`! source insuffisante · ${source.subjectTitle} · ${source.title}`);
      return;
    }
  }
  const result = await runCodex(config, { ...course, ...source }, record.transcriptionFilename);
  const completedAt = result.ok ? new Date().toISOString() : undefined;
  const retryAt = !result.ok && result.retryable !== false ? result.nextAttemptAt || nextAttemptAt(Number(record.attempt || 1), config) : undefined;
  record.status = result.sourceInsufficient ? "source-insuffisante" : (result.ok ? "completed" : "error");
  record.completedAt = completedAt;
  record.failedAt = result.ok ? undefined : new Date().toISOString();
  record.retryable = result.retryable !== false && !result.sourceInsufficient;
  record.nextAttemptAt = retryAt;
  record.error = result.error || null;
  processed.files[key] = record;
  await writeJson(PROCESSED_FILE, processed);
  console.log(`${result.ok ? "✓" : "!"} ${source.subjectTitle} · ${source.title}${result.simulated ? " [simulation]" : ""}`);
}

async function processQueuedCourse(course, key, config, processed) {
  const result = await runCodex(config, course, course.transcriptionFilename);
  const completedAt = result.ok ? new Date().toISOString() : undefined;
  processed.files[key] = {
    ...(processed.files[key] || {}),
    courseId: course.id,
    status: result.sourceInsufficient ? "source-insuffisante" : (result.ok ? "completed" : "error"),
    completedAt,
    failedAt: result.ok ? undefined : new Date().toISOString(),
    retryable: result.retryable !== false && !result.sourceInsufficient,
    nextAttemptAt: result.nextAttemptAt || undefined,
    error: result.error || null,
  };
  await writeJson(PROCESSED_FILE, processed);
  console.log(`${result.ok ? "✓" : "!"} ${course.subjectTitle} · ${course.title}${result.simulated ? " [simulation]" : ""}`);
}

async function processQueuedTranscription(course, key, config, processed) {
  const result = await transcribeLocally(config, course);
  processed.files[key] = {
    ...(processed.files[key] || {}),
    courseId: course.id,
    status: result.sourceInsufficient ? "source-insuffisante" : (result.ok ? "completed" : "error"),
    completedAt: result.ok ? new Date().toISOString() : undefined,
    failedAt: result.ok ? undefined : new Date().toISOString(),
    retryable: result.retryable !== false && !result.sourceInsufficient,
    nextAttemptAt: result.nextAttemptAt || undefined,
    error: result.error || null,
  };
  await writeJson(PROCESSED_FILE, processed);
  console.log(`${result.ok ? "✓" : "!"} transcription locale · ${course.subjectTitle} · ${course.title}${result.error ? ` · ${result.error}` : ""}`);
}

async function processQueuedChapter(descriptor, key, config, processed) {
  const courses = (await readJson(LESSONS_FILE, [])).filter((course) => {
    const current = chapterDescriptor(course);
    return current?.key === descriptor.key && course.status === "ready" && course.summaryFilename && Array.isArray(course.cards) && course.cards.length;
  });
  const result = await runChapterCodex(config, descriptor, courses);
  const previous = processed.files[key] || {};
  const attempt = Number(previous.attempt || 1);
  const retryAt = !result.ok && result.retryable !== false ? nextAttemptAt(attempt, config) : undefined;
  processed.files[key] = { ...previous, chapterId: descriptor.id, status: result.ok ? "completed" : "error", completedAt: result.ok ? new Date().toISOString() : undefined, failedAt: result.ok ? undefined : new Date().toISOString(), retryable: result.retryable !== false, nextAttemptAt: result.nextAttemptAt || retryAt, error: result.error || null };
  await writeJson(PROCESSED_FILE, processed);
  console.log(`${result.ok ? "✓" : "!"} test de chapitre · ${descriptor.subjectTitle} · ${descriptor.title}${result.simulated ? " [simulation]" : ""}`);
}

async function queueEligibleCourses(processed) {
  const courses = await readJson(LESSONS_FILE, []);
  for (const course of courses) {
    if (!course.transcriptionFilename || course.status !== "a-traiter") continue;
    const key = `course::${course.id}`;
    const previous = processed.files[key];
    if (previous?.status === "completed" || (previous?.status === "processing" && !processingStale(previous)) || running.has(key)) continue;
    if (!retryableProcessed(previous) || !retryWindowOpen(previous)) continue;
    running.add(key);
    processed.files[key] = { ...(previous || {}), courseId: course.id, attempt: Number(previous?.attempt || 0) + 1, status: "processing", queuedAt: new Date().toISOString() };
    queue.push({ kind: "course", course, key });
  }
  await writeJson(PROCESSED_FILE, processed);
}

async function queueEligibleTranscriptions(processed) {
  const courses = await readJson(LESSONS_FILE, []);
  for (const course of courses) {
    if (course.status !== "transcription-en-attente" || !course.recordingFilename || running.has(`transcription::${course.id}`)) continue;
    const key = `transcription::${course.id}`;
    const previous = processed.files[key];
    if (previous?.status === "completed" || (previous?.status === "processing" && !processingStale(previous))) continue;
    if (!retryableProcessed(previous) || !retryWindowOpen({ nextAttemptAt: course.transcriptionNextAttemptAt || previous?.nextAttemptAt })) continue;
    running.add(key);
    processed.files[key] = { ...(previous || {}), courseId: course.id, attempt: Number(previous?.attempt || 0) + 1, status: "processing", queuedAt: new Date().toISOString() };
    queue.push({ kind: "transcription", course, key });
  }
  await writeJson(PROCESSED_FILE, processed);
}

async function queueEligibleChapters(processed) {
  const courses = await readJson(LESSONS_FILE, []);
  const chapters = await readJson(CHAPTERS_FILE, []);
  const descriptors = new Map();
  for (const course of courses) {
    const descriptor = chapterDescriptor(course);
    if (descriptor && course.status === "ready" && course.summaryFilename && Array.isArray(course.cards) && course.cards.length) descriptors.set(descriptor.key, descriptor);
  }
  for (const descriptor of descriptors.values()) {
    const chapterCourses = courses.filter((course) => chapterDescriptor(course)?.key === descriptor.key && course.status === "ready");
    const latestCourse = chapterCourses.map((course) => String(course.updatedAt || course.createdAt || "")).sort().at(-1) || "";
    const existing = chapters.find((chapter) => chapter.id === descriptor.id);
    if (existing?.generatedAt && existing.generatedAt >= latestCourse) continue;
    const key = `chapter::${descriptor.id}`;
    const previous = processed.files[key];
    if ((previous?.status === "processing" && !processingStale(previous)) || (previous?.status === "completed" && !existing) || running.has(key)) continue;
    if (!retryableProcessed(previous) || !retryWindowOpen(previous)) continue;
    running.add(key);
    processed.files[key] = { ...(previous || {}), chapterId: descriptor.id, attempt: Number(previous?.attempt || 0) + 1, status: "processing", queuedAt: new Date().toISOString() };
    queue.push({ kind: "chapter", descriptor, key });
  }
  await writeJson(PROCESSED_FILE, processed);
}

async function drain(config, subjects, processed) {
  if (drainRunning) return;
  drainRunning = true;
  try {
    while (queue.length) {
      const job = queue.shift();
      try {
        if (job.kind === "transcription") await processQueuedTranscription(job.course, job.key, config, processed);
        else if (job.kind === "course") await processQueuedCourse(job.course, job.key, config, processed);
        else if (job.kind === "chapter") await processQueuedChapter(job.descriptor, job.key, config, processed);
        else await ingest(job.file, job.key, config, subjects, processed);
      } catch (error) {
        console.error(`Erreur d'import automatique: ${error.message}`);
        const previous = processed.files[job.key] || {};
        const attempt = Number(previous.attempt || 1);
        const failedAt = new Date().toISOString();
        const retryAt = nextAttemptAt(attempt, config);
        processed.files[job.key] = { ...previous, courseId: job.course?.id, sourcePath: job.file ? path.resolve(job.file) : undefined, status: "error", retryable: true, nextAttemptAt: retryAt, error: error.message, failedAt };
        if (job.course?.id && ["course", "transcription"].includes(job.kind)) {
          await updateCourse(job.course.id, job.kind === "transcription" ? {
            status: "transcription-en-attente",
            transcriptionState: "failed",
            transcriptionRetryable: true,
            transcriptionNextAttemptAt: retryAt,
            transcriptionError: error.message,
            transcriptionFailedAt: failedAt,
          } : {
            status: "a-traiter",
            automationState: "failed",
            automationRetryable: true,
            automationNextAttemptAt: retryAt,
            automationError: error.message,
            automationFinishedAt: failedAt,
          }).catch(() => undefined);
        }
        await writeJson(PROCESSED_FILE, processed);
      } finally {
        running.delete(job.key);
      }
    }
  } finally {
    drainRunning = false;
  }
}

async function scan(config, subjects, processed) {
  if (scanRunning) return;
  scanRunning = true;
  try {
    await recoverStaleCourses();
    await auditCourseSources();
    await mkdir(config.inboxPath, { recursive: true });
    const files = await collectFiles(config.inboxPath);
    for (const file of files) {
      let key;
      try {
        key = await fileKey(file);
        const previous = processed.files[key];
        if (previous?.status === "completed" || (previous?.status === "processing" && !processingStale(previous))) continue;
        if (!retryableProcessed(previous) || !retryWindowOpen(previous)) continue;
        if (running.has(key)) continue;
        if (!(await stable(file, config.stableWaitMs))) continue;
      } catch {
        continue;
      }
      running.add(key);
      const previous = processed.files[key] || {};
      processed.files[key] = { ...previous, sourcePath: path.resolve(file), attempt: Number(previous.attempt || 0) + 1, status: "processing", lastSeenAt: new Date().toISOString() };
      await writeJson(PROCESSED_FILE, processed);
      queue.push({ file, key });
    }
    await queueEligibleTranscriptions(processed);
    await queueEligibleCourses(processed);
    await queueEligibleChapters(processed);
    await drain(config, subjects, processed);
  } finally {
    scanRunning = false;
  }
}

async function main() {
  const config = await loadConfig();
  await mkdir(AUTOMATION_DIR, { recursive: true });
  await mkdir(LOG_DIR, { recursive: true });
  await mkdir(config.inboxPath, { recursive: true });
  const processed = await readJson(PROCESSED_FILE, { files: {} });
  processed.files ||= {};
  const subjects = await catalog();
  console.log(`BioMIA automation : ${config.inboxPath}`);
  console.log(`Gemini : ${config.gemini.model}${config.dryRun ? " · simulation" : ""}`);
  console.log("Dépose une transcription .txt/.md dans ce dossier. Ctrl+C pour arrêter.");
  await scan(config, subjects, processed);
  const timer = setInterval(() => scan(config, subjects, processed).catch((error) => console.error(error.message)), config.scanEveryMs);
  const stop = () => { clearInterval(timer); process.exit(0); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.join(ROOT, "automation.mjs");

if (isMainModule) {
  if (process.argv.includes("--check")) {
    loadConfig().then((config) => {
      console.log(JSON.stringify({ root: ROOT, inboxPath: config.inboxPath, gemini: config.gemini, codex: config.codex, transcription: config.transcription, retry: config.retry, dryRun: config.dryRun }, null, 2));
    }).catch((error) => { console.error(error); process.exitCode = 1; });
  } else {
    main().catch((error) => { console.error(error); process.exitCode = 1; });
  }
}

export { normalizeTranscriptForValidation, validateTranscription, retryDelayMs, nextAttemptAt, retryWindowOpen, retryableProcessed, processingStale };
