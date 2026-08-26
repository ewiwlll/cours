#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFile, writeFile, readdir, stat, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const INBOX_DIR = path.join(ROOT, "inbox");
const RECORDINGS_DIR = path.join(DATA, "enregistrements");
const TRANSCRIPTIONS_DIR = path.join(DATA, "transcriptions");
const TRANSCRIPTIONS_INDEX = path.join(TRANSCRIPTIONS_DIR, "index.json");
const COURSES_DIR = path.join(DATA, "cours");
const COURSES_INDEX = path.join(COURSES_DIR, "index.json");
const CHAPTERS_INDEX = path.join(COURSES_DIR, "chapters.json");
const SUBJECTS_FILE = path.join(DATA, "courses.json");
const WHISPER_MODEL = path.join(ROOT, "models", "whisper", "ggml-large-v3-turbo-q5_0.bin");

function getWhisperBin() {
  const candidates = [
    "/opt/homebrew/bin/whisper-cli",
    "/opt/homebrew/opt/whisper-cpp/bin/whisper-cli",
    "/usr/local/bin/whisper-cli",
    "whisper-cli",
  ];
  for (const candidate of candidates) {
    if (path.isAbsolute(candidate) && existsSync(candidate)) return candidate;
  }
  return "whisper-cli";
}

async function readJson(file, fallback = []) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function runCmd(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`Command ${command} failed (code ${code}):\n${stderr || stdout}`));
    });
  });
}

// -------------------------------------------------------------
// 1. LIST PENDING COURSES & RECORDINGS
// -------------------------------------------------------------
async function listPending() {
  console.log("🔍 Analyse des enregistrements et fichiers en attente...\n");

  const courses = await readJson(COURSES_INDEX, []);
  const pending = [];

  // A. Check Inbox
  if (existsSync(INBOX_DIR)) {
    const scanDir = async (dir, prefix = "") => {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(prefix, entry.name);
        if (entry.isDirectory()) {
          await scanDir(fullPath, relPath);
        } else if (!entry.name.startsWith(".")) {
          pending.push({
            type: "inbox",
            filename: entry.name,
            relativePath: relPath,
            fullPath,
            sizeBytes: (await stat(fullPath)).size,
          });
        }
      }
    };
    await scanDir(INBOX_DIR);
  }

  // B. Check Enregistrements
  if (existsSync(RECORDINGS_DIR)) {
    const recFiles = await readdir(RECORDINGS_DIR);
    for (const file of recFiles) {
      if (file.endsWith(".m4a") || file.endsWith(".wav") || file.endsWith(".mp3")) {
        const fullPath = path.join(RECORDINGS_DIR, file);
        const alreadyLinked = courses.some(
          (c) => c.id.includes(file.replace(/\.[^.]+$/, "")) || (c.recording && c.recording.filename === file)
        );
        if (!alreadyLinked) {
          pending.push({
            type: "audio-amphi",
            filename: file,
            relativePath: file,
            fullPath,
            sizeBytes: (await stat(fullPath)).size,
          });
        }
      }
    }
  }

  // C. Check Courses still in "a-traiter" status
  for (const course of courses) {
    if (course.status === "a-traiter" || !course.summaryFilename || !course.cards || course.cards.length === 0) {
      pending.push({
        type: "course-draft",
        id: course.id,
        title: course.title,
        status: course.status,
        subjectId: course.subjectId,
        date: course.date,
        cardsCount: (course.cards || []).length,
      });
    }
  }

  if (pending.length === 0) {
    console.log("✅ Aucun cours ni enregistrement en attente. Tout est à jour !");
    return;
  }

  console.log(`📋 ${pending.length} élément(s) en attente de traitement :\n`);
  pending.forEach((item, idx) => {
    if (item.type === "inbox") {
      console.log(`  ${idx + 1}. [INBOX] 📄 ${item.relativePath} (${Math.round(item.sizeBytes / 1024)} Ko)`);
    } else if (item.type === "audio-amphi") {
      console.log(`  ${idx + 1}. [AUDIO AMPHI] 🎙️ ${item.filename} (${(item.sizeBytes / (1024 * 1024)).toFixed(1)} Mo)`);
    } else if (item.type === "course-draft") {
      console.log(`  ${idx + 1}. [COURS EN ATTENTE] 📚 ${item.title} (${item.id}) - Cartes: ${item.cardsCount}`);
    }
  });
  console.log("");
}

// -------------------------------------------------------------
// 2. TRANSCRIBE AUDIO WITH WHISPER METAL
// -------------------------------------------------------------
async function transcribeAudio(audioPath) {
  const fullAudio = path.isAbsolute(audioPath) ? audioPath : path.resolve(ROOT, audioPath);
  if (!existsSync(fullAudio)) {
    console.error(`❌ Fichier audio introuvable : ${fullAudio}`);
    process.exit(1);
  }

  const whisperBin = getWhisperBin();
  if (!existsSync(whisperBin)) {
    console.error(`❌ Binaire whisper-cli introuvable : ${whisperBin}`);
    process.exit(1);
  }

  if (!existsSync(WHISPER_MODEL)) {
    console.error(`❌ Modèle Whisper introuvable : ${WHISPER_MODEL}`);
    process.exit(1);
  }

  console.log(`🎙️ Transcription locale avec Whisper.cpp Metal...`);
  console.log(`   Source : ${fullAudio}`);
  console.log(`   Modèle : ${WHISPER_MODEL}`);

  // Step 1: Convert to WAV 16kHz mono via ffmpeg
  const tempWav = path.join(ROOT, "output", `whisper-temp-${Date.now()}.wav`);
  await mkdir(path.dirname(tempWav), { recursive: true });

  try {
    console.log(`   ⏳ Conversion WAV 16kHz avec ffmpeg...`);
    await runCmd("ffmpeg", ["-y", "-i", fullAudio, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", tempWav]);

    const baseName = path.basename(fullAudio).replace(/\.[^.]+$/, "");
    const outputTxtPath = path.join(TRANSCRIPTIONS_DIR, `${baseName}.txt`);
    await mkdir(TRANSCRIPTIONS_DIR, { recursive: true });

    console.log(`   ⚡ Exécution de Whisper Metal...`);
    await runCmd(whisperBin, [
      "-m", WHISPER_MODEL,
      "-f", tempWav,
      "-l", "fr",
      "-otxt",
      "-of", path.join(TRANSCRIPTIONS_DIR, baseName),
    ]);

    console.log(`✅ Transcription terminée avec succès !`);
    console.log(`   Fichier texte : ${outputTxtPath}`);

    // Register in data/transcriptions/index.json
    const transcriptionsIndex = await readJson(TRANSCRIPTIONS_INDEX, []);
    const existingIdx = transcriptionsIndex.findIndex((t) => t.filename === `${baseName}.txt`);
    const entry = {
      filename: `${baseName}.txt`,
      audioFile: path.basename(fullAudio),
      title: baseName,
      date: new Date().toISOString().slice(0, 10),
      provider: "whisper.cpp-metal",
      createdAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      transcriptionsIndex[existingIdx] = { ...transcriptionsIndex[existingIdx], ...entry };
    } else {
      transcriptionsIndex.push(entry);
    }
    await writeJson(TRANSCRIPTIONS_INDEX, transcriptionsIndex);
    console.log(`   Enregistré dans : data/transcriptions/index.json`);
  } finally {
    if (existsSync(tempWav)) {
      try {
        await unlink(tempWav);
      } catch {}
    }
  }
}

// -------------------------------------------------------------
// 3. VALIDATE COURSES AND FLASHCARDS INTEGRITY
// -------------------------------------------------------------
async function validateCourses(targetCourseId) {
  console.log("🔍 Validation de l'intégrité des cours et flashcards...\n");

  const courses = await readJson(COURSES_INDEX, []);
  const rawSubjects = await readJson(SUBJECTS_FILE, []);
  const subjects = Array.isArray(rawSubjects) ? rawSubjects : (rawSubjects.courses || []);
  const validSubjectIds = new Set(subjects.map((s) => s.id));

  let errors = 0;
  let warnings = 0;

  const targetList = targetCourseId ? courses.filter((c) => c.id === targetCourseId) : courses;

  if (targetList.length === 0) {
    console.error(`❌ Aucun cours trouvé ${targetCourseId ? `avec l'ID : ${targetCourseId}` : ""}`);
    return;
  }

  for (const course of targetList) {
    const prefix = `[${course.id || "SANS-ID"}] "${course.title || "Sans titre"}"`;

    if (!course.id) {
      console.error(`❌ ${prefix}: Champ 'id' manquant`);
      errors++;
    }
    if (!course.title) {
      console.error(`❌ ${prefix}: Champ 'title' manquant`);
      errors++;
    }
    if (!course.subjectId || !validSubjectIds.has(course.subjectId)) {
      console.warn(`⚠️ ${prefix}: 'subjectId' invalide ou inconnu (${course.subjectId})`);
      warnings++;
    }
    if (!course.summaryFilename) {
      console.error(`❌ ${prefix}: 'summaryFilename' manquant`);
      errors++;
    } else {
      const summaryPath = path.join(COURSES_DIR, course.summaryFilename);
      if (!existsSync(summaryPath)) {
        console.error(`❌ ${prefix}: Fiche markdown introuvable (${course.summaryFilename})`);
        errors++;
      }
    }

    const cards = course.cards || [];
    if (cards.length === 0) {
      console.warn(`⚠️ ${prefix}: Aucune flashcard/QCM associée`);
      warnings++;
    } else {
      cards.forEach((card, cIdx) => {
        if (!card.id) {
          console.error(`❌ ${prefix} Card #${cIdx + 1}: Champ 'id' manquant`);
          errors++;
        }
        if (!card.question) {
          console.error(`❌ ${prefix} Card #${cIdx + 1}: Champ 'question' manquant`);
          errors++;
        }
        if (!card.answer) {
          console.error(`❌ ${prefix} Card #${cIdx + 1}: Champ 'answer' manquant`);
          errors++;
        }
      });
    }
  }

  console.log(`\n📊 Résultat : ${targetList.length} cours vérifié(s) | ${errors} erreur(s) | ${warnings} avertissement(s)`);
  if (errors === 0) {
    console.log("✅ Validation réussie !");
  } else {
    process.exitCode = 1;
  }
}

// -------------------------------------------------------------
// MAIN CLI DISPATCHER
// -------------------------------------------------------------
async function main() {
  const [,, cmd, ...args] = process.argv;

  switch (cmd) {
    case "pending":
    case "list-pending":
    case "list":
      await listPending();
      break;

    case "transcribe":
      if (!args[0]) {
        console.error("Usage: node scripts/course-helper.mjs transcribe <audio-path>");
        process.exit(1);
      }
      await transcribeAudio(args[0]);
      break;

    case "validate":
      await validateCourses(args[0]);
      break;

    default:
      console.log(`
📚 BioMIA Course Helper — Studio Antigravity CLI

Usage:
  node scripts/course-helper.mjs pending              Lister les cours et enregistrements en attente
  node scripts/course-helper.mjs transcribe <audio>   Transcrire un fichier audio avec Whisper Metal
  node scripts/course-helper.mjs validate [courseId]  Valider la conformité des fiches et flashcards
`);
  }
}

main().catch((err) => {
  console.error("Erreur d'exécution :", err.message);
  process.exit(1);
});
