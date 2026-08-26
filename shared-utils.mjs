import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

/**
 * Charge un fichier .env de manière sécurisée sans écraser les variables d'environnement existantes.
 * @param {string} rootPath
 */
export function loadEnvFile(rootPath) {
  const envPath = rootPath ? path.join(rootPath, ".env") : path.resolve(".env");
  try {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!(key in process.env)) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {}
}

export function slug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "cours";
}

export function localDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function safeFilename(value) {
  return path.basename(String(value || "")).replace(/[^a-zA-Z0-9À-ÿ._ -]/g, "-").replace(/\s+/g, " ").trim();
}

export function safeFilePath(baseDirectory, filename) {
  const clean = safeFilename(filename);
  const resolved = path.resolve(baseDirectory, clean);
  if (!resolved.startsWith(path.resolve(baseDirectory) + path.sep)) {
    throw new Error("Fichier invalide");
  }
  return { clean, resolved };
}

export function safeCoursePath(coursDirectory, filename) {
  const clean = safeFilename(filename);
  const resolved = path.resolve(coursDirectory, clean);
  if (!resolved.startsWith(path.resolve(coursDirectory) + path.sep)) {
    throw new Error("Fichier de cours invalide");
  }
  return { clean, resolved };
}

export function safePhotoPath(photosDirectory, courseId, filename) {
  const folder = path.resolve(photosDirectory, slug(courseId));
  const clean = safeFilename(filename).replace(/\s+/g, "-");
  const resolved = path.resolve(folder, clean);
  if (!clean || !resolved.startsWith(folder + path.sep)) {
    throw new Error("Photo invalide");
  }
  return { folder, clean, resolved };
}

export function normalizeTranscriptForValidation(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s*(?:WEBVTT|NOTE)\s*$/gim, " ")
    .replace(/^\s*\d+\s*$/gm, " ")
    .replace(/^\s*\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?\s*-->\s*\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?(?:\s+.*)?$/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateTranscription(value) {
  const raw = typeof value === "string" ? value : "";
  const normalized = normalizeTranscriptForValidation(raw);
  const lower = normalized.toLocaleLowerCase("fr-FR").replace(/[’']/g, "'");
  const tokens = normalized.match(/\p{L}[\p{L}\p{M}'’‑-]*|\p{N}+(?:[.,]\p{N}+)*/gu) || [];
  const letterCount = (normalized.match(/\p{L}/gu) || []).length;
  const uniqueTokens = new Set(tokens.map((token) => token.toLocaleLowerCase("fr-FR")));
  const placeholderOnly = new Set([
    "...", "…", "....", ".....", "-", "_", "n/a", "na", "null", "undefined",
    "placeholder", "test", "silence", "inaudible", "incompréhensible", "aucune transcription",
  ]).has(lower);
  const punctuationOnly = normalized.length > 0 && letterCount === 0 && !/\d/u.test(normalized);
  const repeatedNoise = tokens.length >= 4 && uniqueTokens.size === 1;
  const conversationalBoilerplate = normalized.length < 180 && [
    /\b(?:tu m'entends|all[ôo])\b/u,
    /\bbonjour de la part de (?:chatgpt|l'assistant)\b/u,
    /\b(?:vous demandez|je peux le faire)\b/u,
    /\bdirectement sur votre ordinateur\b/u,
    /\btranscription\s+(?:en attente|trop courte|vide)\b/u,
  ].some((pattern) => pattern.test(lower));

  let reason = null;
  let message = null;
  if (!normalized) {
    reason = "vide";
    message = "La transcription est vide.";
  } else if (placeholderOnly || punctuationOnly || repeatedNoise) {
    reason = "placeholder";
    message = "La transcription contient seulement un placeholder ou du bruit.";
  } else if (conversationalBoilerplate) {
    reason = "contenu-conversationnel";
    message = "La source ressemble à un test de micro ou à un message hors cours.";
  } else if (tokens.length <= 3 || letterCount < 16 || (tokens.length < 6 && letterCount < 32)) {
    reason = "trop-courte";
    message = "La transcription est trop courte pour produire une fiche fiable.";
  }

  return {
    ok: !reason,
    reason,
    message,
    characters: normalized.length,
    words: tokens.length,
    letters: letterCount,
    quality: !reason ? (tokens.length < 20 ? "courte" : "normale") : "insuffisante",
    checkedAt: new Date().toISOString(),
  };
}

export function sourceValidationError(validation) {
  return `Source insuffisante : ${validation?.message || "transcription inexploitable"}`;
}
