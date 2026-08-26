import test from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, parseCorrectionJson, normalizeEvaluation, correctRecall } from "../recall-correction.mjs";

test("limite explicitement la correction aux parties sélectionnées", () => {
  const prompt = buildPrompt(
    { id: "course-1", title: "Organisation du vivant", partScope: { start: 1, end: 3, label: "Parties 1 à 3" } },
    { summary: "Résumé sourcé", transcription: "Transcription sourcée", cards: [] },
    "Mon explication",
    1,
    null,
  );

  assert.match(prompt, /PORTÉE ÉVALUÉE : Parties 1 à 3/u);
  assert.match(prompt, /Ne signale jamais comme oubli un élément situé hors de cette portée/u);
});

test("ne confond pas le numéro automatique de séance avec une portée de contenu", () => {
  const prompt = buildPrompt(
    { id: "course-2", title: "Séance suivante", partLabel: "Phase 2" },
    { summary: "Résumé sourcé", transcription: "", cards: [] },
    "Mon explication",
    1,
    null,
  );

  assert.match(prompt, /PORTÉE ÉVALUÉE : tout le contenu rattaché à ce cours/u);
  assert.doesNotMatch(prompt, /PORTÉE ÉVALUÉE : Phase 2/u);
});

test("parseCorrectionJson gère les blocs markdown et les objets JSON équilibrés", () => {
  const markdownJson = "```json\n{\"score\": 85, \"level\": \"good\", \"summary\": \"Bon rappel\", \"concepts\": []}\n```";
  const parsed = parseCorrectionJson(markdownJson);
  assert.equal(parsed.score, 85);
  assert.equal(parsed.level, "good");

  const noisyText = "Voici mon analyse:\n{\"score\": 40, \"level\": \"partial\", \"summary\": \"Incomplet\", \"concepts\": []}\nMerci.";
  const parsedNoisy = parseCorrectionJson(noisyText);
  assert.equal(parsedNoisy.score, 40);
  assert.equal(parsedNoisy.level, "partial");
});

test("normalizeEvaluation normalise les concepts et le score", () => {
  const source = {
    cards: [
      { id: "c1", question: "Qu'est-ce que l'ARN ?", answer: "Acide ribonucléique", source: "transcription.txt, l.5" },
    ],
  };
  const evalRaw = {
    score: 90,
    level: "excellent",
    summary: "Excellente réponse",
    concepts: [
      { id: "c1", label: "ARN", status: "mastered", feedback: "Validé DANS LA SOURCE", source: "transcription.txt, l.5" },
    ],
  };
  const normalized = normalizeEvaluation(evalRaw, source);
  assert.equal(normalized.score, 90);
  assert.equal(normalized.level, "excellent");
  assert.equal(normalized.concepts.length, 1);
  assert.equal(normalized.concepts[0].status, "mastered");
});

test("correctRecall refuse un cours avec source insuffisante", async () => {
  const course = {
    id: "test-insufficient",
    title: "Test",
    status: "source-insuffisante",
    sourceValidation: { ok: false },
    cards: [],
  };
  const result = await correctRecall({
    root: process.cwd(),
    configPath: "",
    course,
    answer: "Ma tentative",
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "source-insuffisante");
});
