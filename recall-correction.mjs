import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ALLOWED_STATUSES = new Set(["mastered", "partial", "missing", "wrong"]);
const DEFAULT_TIMEOUT_MS = 30_000;

import { loadEnvFile } from "./shared-utils.mjs";

const loadEnvIfPresent = (root) => loadEnvFile(root);

const RECALL_EVALUATION_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", description: "Score global de l'étudiant entre 0 et 100" },
    level: { type: "string", enum: ["missing", "partial", "good", "excellent"], description: "Niveau d'acquisition" },
    summary: { type: "string", description: "Synthèse pédagogique bienveillante et précise" },
    concepts: {
      type: "array",
      description: "Évaluation notion par notion par rapport aux cartes et sources",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          status: { type: "string", enum: ["mastered", "partial", "missing", "wrong"] },
          feedback: { type: "string" },
          source: { type: "string" },
          expected: { type: "string" },
        },
        required: ["id", "label", "status", "feedback"],
      },
    },
    improvedAnswer: { type: "string", description: "Exemple de réponse idéale et concise" },
    nextQuestion: {
      type: "object",
      properties: {
        question: { type: "string" },
        answer: { type: "string" },
        source: { type: "string" },
      },
      required: ["question", "answer"],
    },
    sourceWarnings: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["score", "level", "summary", "concepts"],
};

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sourcePath(root, relativeDirectory, filename) {
  const clean = path.basename(String(filename || ""));
  if (!clean) return null;
  const directory = path.resolve(root, relativeDirectory);
  const resolved = path.resolve(directory, clean);
  return resolved.startsWith(directory + path.sep) ? resolved : null;
}

async function readSourceFile(root, relativeDirectory, filename) {
  const resolved = sourcePath(root, relativeDirectory, filename);
  if (!resolved || !existsSync(resolved)) return null;
  return readFile(resolved, "utf8").catch(() => null);
}

function normalize(value) {
  return cleanText(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr-FR").replace(/[’']/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function tokens(value) {
  return new Set(normalize(value).split(/\s+/u).filter((token) => token.length > 2));
}

function meaningfulTokens(value) {
  const stopWords = new Set(["avec", "dans", "pour", "sans", "plus", "cette", "cela", "comme", "dont", "leur", "leurs", "sont", "être", "une", "des", "les", "aux", "sur", "par", "que", "qui", "est", "son", "ses", "the", "and", "from"]);
  return new Set([...tokens(value)].filter((token) => !stopWords.has(token)));
}

function overlap(answerTokens, expectedTokens) {
  if (!expectedTokens.size) return 0;
  let matches = 0;
  for (const token of expectedTokens) if (answerTokens.has(token)) matches += 1;
  return matches / expectedTokens.size;
}

function sourceLabel(card, summaryFilename) {
  return cleanText(card && card.source) || (summaryFilename ? "DANS LA SOURCE : " + summaryFilename : "Fiche de cours");
}

function cardIsUsable(card) {
  return Boolean(card && typeof card === "object" && cleanText(card.question) && cleanText(card.answer));
}

export async function loadRecallSource({ root, course }) {
  const summary = await readSourceFile(root, "data/cours", course && course.summaryFilename);
  const transcription = await readSourceFile(root, "data/transcriptions", course && course.transcriptionFilename);
  const cards = Array.isArray(course && course.cards) ? course.cards.filter(cardIsUsable) : [];
  const warnings = [];
  if (course && ((course.sourceValidation && course.sourceValidation.ok === false) || course.status === "source-insuffisante")) {
    warnings.push(cleanText(course.automationError) || "Source insuffisante : le cours est marqué comme non exploitable.");
  }
  if (!summary && !cards.length) warnings.push("Aucune fiche ou carte utilisable n'est disponible pour ce cours.");
  if (summary && /source\s+insuffisante|fiche de contrôle de source|à vérifier.*transcription complète/iu.test(summary)) {
    warnings.push("La fiche disponible documente une source insuffisante, pas un contenu de cours exploitable.");
  }
  if (!transcription && course && course.transcriptionFilename) warnings.push("La transcription référencée est introuvable.");
  const blocked = Boolean(course && ((course.sourceValidation && course.sourceValidation.ok === false) || course.status === "source-insuffisante")) || (!summary && !cards.length);
  return { usable: !blocked && Boolean(summary || cards.length), summary: summary || "", transcription: transcription || "", cards, warnings: [...new Set(warnings)] };
}

export function buildPrompt(course, source, answer, attempt, previousCorrection) {
  const cards = source.cards.map((card) => ({ id: card.id, question: card.question, expected: card.answer, source: card.source, keywords: Array.isArray(card.keywords) ? card.keywords : [] }));
  const partScope = cleanText(course?.partScope?.label) || cleanText(course?.partScopeLabel) || (cleanText(course?.partLabel) && !/^phase\s+\d+$/iu.test(cleanText(course?.partLabel)) ? cleanText(course?.partLabel) : "");
  return [
    "Tu es le correcteur source-grounded de BioMIA Revision OS.",
    "- N'invente aucun fait et ne complète jamais la source avec tes connaissances.",
    "- Toute information non prouvée doit être « À VÉRIFIER » et ne peut pas être mastered.",
    "- Chaque concept doit avoir une source exacte et un feedback marqué « DANS LA SOURCE » ou « À VÉRIFIER ».",
    partScope ? "- N'évalue que la portée sélectionnée. Ne signale jamais comme oubli un élément situé hors de cette portée." : "- Évalue uniquement le contenu effectivement rattaché à ce cours.",
    "- Utilise exactement les statuts mastered, partial, missing ou wrong.",
    "- Réponds uniquement avec le JSON demandé, sans Markdown.",
    "",
    "COURS : " + (cleanText(course && course.title) || course.id),
    "COURSE ID : " + course.id,
    "PORTÉE ÉVALUÉE : " + (partScope || "tout le contenu rattaché à ce cours"),
    "TENTATIVE : " + (Number.isFinite(attempt) ? attempt : 1),
    "RÉPONSE DE L'ÉTUDIANT :",
    answer,
    "CORRECTION PRÉCÉDENTE (jamais une source) :",
    previousCorrection ? JSON.stringify(previousCorrection) : "null",
    "FICHE SOURCE :",
    source.summary || "(absente)",
    "TRANSCRIPTION SOURCE :",
    source.transcription || "(absente)",
    "CARTES ET ATTENDUS SOURCE :",
    JSON.stringify(cards, null, 2),
    "JSON attendu : " + '{"score":0,"level":"missing|partial|good|excellent","summary":"...","concepts":[{"id":"...","label":"...","status":"mastered|partial|missing|wrong","feedback":"... DANS LA SOURCE ou À VÉRIFIER","source":"...","expected":"..."}],"improvedAnswer":"...","nextQuestion":{"question":"...","answer":"...","source":"..."},"sourceWarnings":["..."]}',
    "Le score est un entier de 0 à 100 ; un champ optionnel peut être omis s'il n'est pas justifié.",
  ].join("\n");
}

async function evaluateWithGemini({ root, prompt, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  loadEnvIfPresent(root);
  const apiKey = process.env.GEMINI_API_KEY || "";
  const model = process.env.GEMINI_MODEL || "gemini-3.7-flash";

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY non configurée");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const payload = {
    systemInstruction: {
      parts: [
        {
          text: "Tu es le correcteur pédagogique source-grounded de BioMIA Revision OS. Tu évalues fidèlement la réponse de l'étudiant à partir des sources fournies (fiche, transcription, cartes) sans jamais inventer de faits non présents dans les sources. Toute information non attestée par la source doit être marquée « À VÉRIFIER ».",
        },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RECALL_EVALUATION_SCHEMA,
      temperature: 0.1,
    },
  };

  let lastError;
  const maxRetries = 3;
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
        const isRetryable = attempt < maxRetries && (response.status === 503 || response.status === 429 || response.status >= 500);
        if (isRetryable) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
          continue;
        }
        throw new Error(`Gemini API HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Gemini n'a renvoyé aucun contenu");
      }
      return text;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && (err.name === "AbortError" || err.message?.includes("fetch failed") || err.message?.includes("503"))) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function balancedJsonCandidates(text) {
  const candidates = [];
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const character = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === "{") depth += 1;
      else if (character === "}" && --depth === 0) {
        candidates.push(text.slice(start, index + 1));
        break;
      }
    }
  }
  return candidates.reverse();
}

export function parseCorrectionJson(raw) {
  const fence = String.fromCharCode(96).repeat(3);
  let text = cleanText(raw);
  if (text.startsWith(fence)) {
    text = text.slice(3);
    if (text.startsWith("json")) text = text.slice(4);
  }
  if (text.endsWith(fence)) text = text.slice(0, -3);
  const candidates = [text.trim(), ...balancedJsonCandidates(text)];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const value = parsed && parsed.evaluation && typeof parsed.evaluation === "object" ? parsed.evaluation : parsed;
      if (value && typeof value === "object" && !Array.isArray(value) && ("score" in value || Array.isArray(value.concepts))) return value;
    } catch {
      // Try the next balanced object.
    }
  }
  throw new Error("Sortie JSON de correction illisible");
}

function levelForScore(score) {
  if (score < 25) return "missing";
  if (score < 60) return "partial";
  if (score < 85) return "good";
  return "excellent";
}

function scoreFromConcepts(concepts) {
  if (!concepts.length) return 0;
  const points = { mastered: 100, partial: 55, missing: 0, wrong: 15 };
  return Math.round(concepts.reduce((sum, concept) => sum + points[concept.status], 0) / concepts.length);
}

function summaryForScore(score) {
  if (score < 25) return "La réponse ne couvre pas encore les éléments attendus dans la source.";
  if (score < 60) return "La réponse reprend une partie de la source, mais plusieurs éléments restent à préciser.";
  if (score < 85) return "La réponse est globalement correcte selon la source, avec quelques points à consolider.";
  return "La réponse reprend fidèlement les éléments attendus dans la source.";
}

function normalizeConcept(concept, index, source) {
  const card = source.cards.find((item) => String(item.id) === String(concept && concept.id)) || source.cards[index];
  const status = ALLOWED_STATUSES.has(concept && concept.status) ? concept.status : "missing";
  const sourceText = cleanText(concept && concept.source) || (card ? sourceLabel(card) : "À VÉRIFIER");
  const feedback = cleanText(concept && concept.feedback) || ((status === "mastered" ? "Élément validé" : "Élément à reprendre") + " — " + sourceText);
  const normalizedFeedback = feedback.includes("DANS LA SOURCE") || feedback.includes("À VÉRIFIER") ? feedback : feedback + " — " + (sourceText.includes("À VÉRIFIER") ? "À VÉRIFIER" : "DANS LA SOURCE");
  const expected = cleanText(concept && concept.expected) || (card && status !== "mastered" ? card.answer : "");
  return {
    id: cleanText(concept && concept.id) || cleanText(card && card.id) || "concept-" + (index + 1),
    label: cleanText(concept && concept.label) || cleanText(card && card.question) || "Concept source",
    status,
    feedback: normalizedFeedback,
    ...(sourceText ? { source: sourceText } : {}),
    ...(expected ? { expected } : {}),
  };
}

export function normalizeEvaluation(raw, source, sourceWarnings = []) {
  const concepts = (Array.isArray(raw && raw.concepts) ? raw.concepts : []).slice(0, 16).map((concept, index) => normalizeConcept(concept, index, source));
  const rawScore = Number(raw && raw.score);
  const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : scoreFromConcepts(concepts);
  const next = raw && raw.nextQuestion && typeof raw.nextQuestion === "object" ? {
    question: cleanText(raw.nextQuestion.question),
    answer: cleanText(raw.nextQuestion.answer),
    source: cleanText(raw.nextQuestion.source) || "À VÉRIFIER",
  } : null;
  const rawWarnings = Array.isArray(raw && raw.sourceWarnings) ? raw.sourceWarnings.map(cleanText).filter(Boolean) : [];
  return {
    score,
    level: ["missing", "partial", "good", "excellent"].includes(raw && raw.level) ? raw.level : levelForScore(score),
    summary: cleanText(raw && raw.summary) || summaryForScore(score),
    concepts,
    ...(cleanText(raw && raw.improvedAnswer) ? { improvedAnswer: raw.improvedAnswer.trim() } : {}),
    ...(next && next.question && next.answer ? { nextQuestion: next } : {}),
    ...(rawWarnings.length || sourceWarnings.length ? { sourceWarnings: [...new Set([...rawWarnings, ...sourceWarnings])] } : {}),
  };
}

function fallbackCorrection(source, answer, reason) {
  const answerTokens = meaningfulTokens(answer);
  const concepts = source.cards.slice(0, 12).map((card) => {
    const expected = meaningfulTokens(card.answer);
    const keywords = Array.isArray(card.keywords) ? meaningfulTokens(card.keywords.join(" ")) : new Set();
    const target = keywords.size ? keywords : expected;
    const ratio = overlap(answerTokens, target);
    const hasMistake = Array.isArray(card.commonMistakes) && card.commonMistakes.some((mistake) => normalize(answer).includes(normalize(mistake)));
    const status = hasMistake ? "wrong" : ratio >= 0.72 ? "mastered" : ratio > 0 ? "partial" : "missing";
    const src = cleanText(card.source) || (source.summary ? "Fiche de cours" : "Support de cours");
    const feedback = status === "mastered"
      ? "Les éléments principaux sont retrouvés. DANS LA SOURCE : " + src
      : status === "partial"
        ? "Une partie des éléments est retrouvée ; compare avec l'attendu. DANS LA SOURCE : " + src
        : status === "wrong"
          ? "Cette formulation correspond à une confusion signalée par la source. DANS LA SOURCE : " + src
          : "Élément non retrouvé dans la réponse. DANS LA SOURCE : " + src;
    return { id: String(card.id), label: card.question, status, feedback, source: src, expected: card.answer };
  });
  const score = scoreFromConcepts(concepts);
  const weakest = concepts.find((concept) => concept.status !== "mastered") || concepts[0];
  const card = source.cards.find((item) => String(item.id) === String(weakest && weakest.id));
  return normalizeEvaluation({
    score,
    level: levelForScore(score),
    summary: score >= 70 ? "Bon rappel ! Les notions fondamentales du cours ont bien été récupérées." : "Rappel partiel. Consulte les concepts et la réponse modèle ci-dessous pour consolider ta mémoire.",
    concepts,
    improvedAnswer: concepts.filter((concept) => concept.status !== "mastered").slice(0, 5).map((concept) => concept.expected).filter(Boolean).join("\n"),
    nextQuestion: card ? { question: card.question, answer: card.answer, source: card.source } : null,
    sourceWarnings: [],
  }, source, source.warnings);
}

export async function correctRecall({ root, configPath, course, answer, attempt = 1, previousCorrection = null }) {
  const source = await loadRecallSource({ root, course });
  if (!source.usable) return { ok: false, reason: "source-insuffisante", sourceWarnings: source.warnings };
  const prompt = buildPrompt(course, source, answer, attempt, previousCorrection);
  try {
    const raw = parseCorrectionJson(await evaluateWithGemini({ root, prompt }));
    return { ok: true, evaluation: normalizeEvaluation(raw, source, source.warnings) };
  } catch (error) {
    return { ok: true, evaluation: fallbackCorrection(source, answer, error.message) };
  }
}
