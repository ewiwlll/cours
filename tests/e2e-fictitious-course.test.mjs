import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCardSchedule,
  seedCourseCardsFromRecall,
  applyExamHorizonCompression,
  findClarificationHistory,
  recordOrUpdateClarification,
  targetRetentionForPriority,
} from "../learning-engine.mjs";
import { normalizeEvaluation } from "../recall-correction.mjs";

test("E2E Test Complet : Cycle de vie d'un cours amphi fictif BioMIA L1", async () => {
  // -------------------------------------------------------------
  // 1. ÉTAPE 1 : SIMULATION DE L'ENREGISTREMENT AMPHI & BALISES
  // -------------------------------------------------------------
  const amphiRecording = {
    title: "Transport Membranaire & Pompe Na+/K+ ATPase",
    subjectId: "s1-biomolecules",
    subjectPriority: "A",
    chapterId: "chap-membrane",
    durationSeconds: 5400, // 1h30
    markers: [
      {
        id: "m1",
        type: "confused",
        label: "Pas compris",
        offsetMs: 14200,
        note: "Je comprends pas la différence entre transport actif primaire et secondaire",
      },
      {
        id: "m2",
        type: "trap",
        label: "Piège exam",
        offsetMs: 32500,
        note: "Ne pas inverser : 3 Na+ sortants et 2 K+ entrants",
      },
    ],
    photos: [
      {
        id: "p1",
        url: "/photos/schema-pompe-nernst.jpg",
        timestampSeconds: 1800,
      },
    ],
  };

  assert.equal(amphiRecording.markers.length, 2);
  assert.equal(amphiRecording.photos.length, 1);

  // -------------------------------------------------------------
  // 2. ÉTAPE 2 : COMPILATION PAR ANTIGRAVITY (MOC, ATOMIC, FSRS)
  // -------------------------------------------------------------
  const compiledCourse = {
    id: "2026-09-10__biomolecules__transport-membranaire",
    title: amphiRecording.title,
    subjectId: amphiRecording.subjectId,
    chapterId: amphiRecording.chapterId,
    status: "ready",
    recallStatus: "locked", // Verrouillé à la création
    recallScore: 0,
    atomicConcepts: [
      {
        id: "concept-pompe-nak",
        title: "La Pompe Na+/K+ ATPase",
        whyWeNeedIt: "Maintient le potentiel membranaire de repos sans lequel aucune cellule excitable ne peut fonctionner.",
        analogy: "Un videur de boîte de nuit qui expulse 3 clients agités (Na+) pour 2 clients calmes qu'il fait entrer (K+).",
        definition: "Transporteur actif primaire qui hydrolyse une molécule d'ATP pour transporter 3 Na+ vers l'extérieur et 2 K+ vers le cytosol.",
        comparison: {
          versus: "Transport Actif Secondaire (Symport/Antiport)",
          rule: "Le primaire consomme directement l'ATP ; le secondaire utilise l'énergie du gradient créé par le primaire.",
          table: [
            { critere: "Source d'énergie", a: "Hydrolyse directe de l'ATP", b: "Gradient électrochimique d'un co-ion" },
            { critere: "Exemple clé", a: "Pompe Na+/K+ ATPase", b: "Symport Na+/Glucose (SGLT1)" },
          ],
        },
        progressiveExamples: [
          { level: "simple", title: "Cas du globule rouge", explanation: "Maintien de l'équilibre osmotique." },
          { level: "intermediaire", title: "Cas du neurone", explanation: "Régénération du potentiel de repos." },
          { level: "realiste", title: "Inhibition par la ouabaïne", explanation: "Blocage de la pompe et dépolarisation." },
        ],
        traps: ["Ne pas inverser 3 Na+ sortants et 2 K+ entrants."],
      },
      {
        id: "concept-gradient",
        title: "Le Gradient Électrochimique",
        whyWeNeedIt: "Définit le sens spontané du flux ionique selon concentration et voltage.",
        definition: "Force motrice résultant du gradient chimique de concentration et du potentiel transmembranaire.",
      },
    ],
    cards: [
      {
        id: "card-pompe-nak",
        conceptId: "concept-pompe-nak",
        kind: "mecanisme",
        question: "Quel est le bilan stœchiométrique et énergétique de la pompe Na+/K+ ATPase ?",
        answer: "3 ions Na+ sortants, 2 ions K+ entrants pour 1 molécule d'ATP hydrolysée.",
        trap: "3 Na+ sortent, 2 K+ entrent (jamais l'inverse).",
      },
      {
        id: "card-unblock-actif-passif",
        conceptId: "concept-pompe-nak",
        kind: "comparer",
        question: "Pourquoi la pompe Na+/K+ est-elle un transport actif PRIMAIRE et non secondaire ?",
        answer: "Parce qu'elle hydrolyse directement l'ATP au niveau de son site catalytique pour changer de conformation.",
      },
      {
        id: "card-gradient",
        conceptId: "concept-gradient",
        kind: "definition",
        question: "Quelles sont les deux composantes du gradient électrochimique ?",
        answer: "Le gradient chimique de concentration et le gradient électrique lié au potentiel transmembranaire.",
      },
    ],
  };

  assert.equal(compiledCourse.recallStatus, "locked");
  assert.equal(compiledCourse.atomicConcepts.length, 2);
  assert.equal(compiledCourse.cards.length, 3);

  // -------------------------------------------------------------
  // 3. ÉTAPE 3 : SAS DE RAPPEL ACTIF (RESTITUTION À FROID)
  // -------------------------------------------------------------
  const evaluationRaw = {
    score: 78,
    level: "good",
    concepts: [
      {
        id: "card-pompe-nak",
        label: "Pompe Na+/K+ ATPase",
        status: "mastered",
        feedback: "Parfait sur la stœchiométrie 3 Na+ / 2 K+ et l'ATP.",
      },
      {
        id: "card-gradient",
        label: "Gradient Électrochimique",
        status: "partial",
        feedback: "Notion de concentration comprise mais composante électrique à consolider.",
      },
    ],
  };

  const normalizedEval = normalizeEvaluation(evaluationRaw, compiledCourse);
  assert.equal(normalizedEval.score, 78);
  assert.equal(normalizedEval.concepts.length, 2);

  // Déblocage du cours & Seeding FSRS immédiat
  compiledCourse.recallStatus = "unlocked";
  compiledCourse.recallScore = normalizedEval.score;
  const seededCards = seedCourseCardsFromRecall(compiledCourse, normalizedEval);

  const masteredCard = seededCards.find((c) => c.id === "card-pompe-nak");
  const partialCard = seededCards.find((c) => c.id === "card-gradient");

  assert.equal(masteredCard.seedRating, 4, "La notion maîtrisée reçoit la note 4 (Facile)");
  assert.equal(masteredCard.seedIntervalDays, 4, "Intervalle initialisé à J+4");
  assert.equal(partialCard.seedRating, 2, "La notion partielle reçoit la note 2 (Difficile)");
  assert.equal(partialCard.seedIntervalDays, 2, "Intervalle initialisé à J+2");

  // -------------------------------------------------------------
  // 4. ÉTAPE 4 : CALCUL FSRS-5 & COURBE D'ATTERRISSAGE PARTIEL
  // -------------------------------------------------------------
  const targetRetention = targetRetentionForPriority("A");
  assert.equal(targetRetention, 0.92);

  const reviewSchedule = calculateCardSchedule(3, [], new Date(), {
    priority: "A",
    daysUntilExam: 10,
  });

  assert.ok(reviewSchedule.intervalDays <= 7, "L'intervalle doit être compressé avant le partiel à J-3");
  assert.equal(reviewSchedule.targetRetention, 0.92);

  // -------------------------------------------------------------
  // 5. ÉTAPE 5 : MÉMOIRE VIVANTE DES QUESTIONS (ARBRE D'ÉVOLUTION)
  // -------------------------------------------------------------
  const clarifications = [];

  const q1 = recordOrUpdateClarification({
    clarifications,
    subjectId: compiledCourse.subjectId,
    courseId: compiledCourse.id,
    question: "Pourquoi l'antiport Na+/Ca2+ est un transport actif secondaire ?",
    answer: "Parce qu'il utilise l'énergie du gradient de sodium créé en amont par la pompe Na+/K+ sans hydrolyser d'ATP directement.",
    context: "Amphi 1 Transport",
    date: "2026-09-10T11:00:00.000Z",
  });

  assert.equal(q1.isNew, true);
  assert.equal(q1.recurrenceCount, 1);

  const previousMatch = findClarificationHistory(
    clarifications,
    "Je comprends pas l'énergie de l'antiport Na/Ca",
    compiledCourse.subjectId
  );

  assert.ok(previousMatch, "Antigravity doit identifier la question récurrente");
  assert.ok(previousMatch.livingSummary.includes("gradient de sodium"));

  const q2 = recordOrUpdateClarification({
    clarifications,
    subjectId: compiledCourse.subjectId,
    courseId: compiledCourse.id,
    question: "Je comprends pas l'énergie de l'antiport Na/Ca par rapport à l'ATP",
    answer: "L'entrée de 3 Na+ dans le sens de leur gradient fournit l'énergie libre nécessaire pour expulser 1 Ca2+ contre son gradient sans enzyme ATPase.",
    context: "Révision avant partiel",
    date: "2026-09-24T18:00:00.000Z",
  });

  assert.equal(q2.isNew, false);
  assert.equal(q2.recurrenceCount, 2);
  assert.equal(clarifications.length, 1, "La note est enrichie de manière atomique sans dispersion");
});
