import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateWeaknesses,
  buildLearningPlan,
  calculateCardSchedule,
  calculateFsrsSchedule,
  clampDifficulty,
  DEFAULT_FSRS_WEIGHTS,
  DEFAULT_TARGET_RETENTION,
  FSRS_FACTOR,
  FSRS_POWER,
  fsrsInitialDifficulty,
  fsrsInitialStability,
  fsrsNextDifficulty,
  fsrsNextForgetStability,
  fsrsNextInterval,
  fsrsNextRecallStability,
  fsrsNextStability,
  fsrsPredictRetrievability,
  fsrsShortTermStability,
  interleaveCards,
  generateInterleavedSession,
  extractExamTrapsAndErrors,
  evaluateFeynmanExplanation,
  targetRetentionForPriority,
  applyExamHorizonCompression,
  seedCardFromRecallStatus,
  seedCourseCardsFromRecall,
  findClarificationHistory,
  recordOrUpdateClarification,
} from "../learning-engine.mjs";

test("calcule les intervalles de cartes et le compteur côté serveur", () => {
  // Mode legacy avec algorithm: 'legacy'
  assert.equal(calculateCardSchedule(1, [], new Date(), { algorithm: "legacy" }).intervalDays, 1);
  assert.equal(calculateCardSchedule(2, [], new Date(), { algorithm: "legacy" }).intervalDays, 2);
  assert.equal(calculateCardSchedule(3, [], new Date(), { algorithm: "legacy" }).intervalDays, 4);
  assert.equal(calculateCardSchedule(3, [{ rating: 3 }], new Date(), { algorithm: "legacy" }).intervalDays, 7);
  assert.equal(calculateCardSchedule(4, [{ rating: 3 }, { rating: 4 }, { rating: 3 }, { rating: 4 }, { rating: 3 }, { rating: 4 }], new Date(), { algorithm: "legacy" }).intervalDays, 240);
  assert.equal(calculateCardSchedule(3, [{ rating: 3 }, { rating: 3 }]).reviewCount, 3);
  
  // Vérifie que calculateCardSchedule utilise FSRS-5 par défaut et expose ses métriques
  const res = calculateCardSchedule(3, [{ rating: 3, createdAt: "2026-08-18T10:00:00.000Z" }], "2026-08-22T10:00:00.000Z");
  assert.equal(typeof res.stability, "number");
  assert.equal(typeof res.difficulty, "number");
  assert.equal(typeof res.retrievability, "number");
  assert.equal(res.fsrs !== null && typeof res.fsrs, "object");
  assert.equal(res.intervalDays, res.fsrs.intervalDays);
});

test("FSRS-5: initialise la stabilité S0 et la difficulté D0 selon la note", () => {
  // Stabilité initiale S0 croissante avec la note (Again < Hard < Good < Easy)
  const sAgain = fsrsInitialStability(1);
  const sHard = fsrsInitialStability(2);
  const sGood = fsrsInitialStability(3);
  const sEasy = fsrsInitialStability(4);

  assert.equal(sAgain, DEFAULT_FSRS_WEIGHTS[0]);
  assert.equal(sHard, DEFAULT_FSRS_WEIGHTS[1]);
  assert.equal(sGood, DEFAULT_FSRS_WEIGHTS[2]);
  assert.equal(sEasy, DEFAULT_FSRS_WEIGHTS[3]);
  assert.ok(sAgain < sHard && sHard < sGood && sGood < sEasy, "La stabilité doit croître avec la note");

  // Difficulté initiale D0 décroissante avec la note (Again > Hard > Good > Easy)
  const dAgain = fsrsInitialDifficulty(1);
  const dHard = fsrsInitialDifficulty(2);
  const dGood = fsrsInitialDifficulty(3);
  const dEasy = fsrsInitialDifficulty(4);

  assert.ok(dAgain >= 1 && dAgain <= 10);
  assert.ok(dHard >= 1 && dHard <= 10);
  assert.ok(dGood >= 1 && dGood <= 10);
  assert.ok(dEasy >= 1 && dEasy <= 10);
  assert.ok(dAgain > dHard && dHard > dGood && dGood > dEasy, "La difficulté initiale doit décroître quand la note augmente");
  assert.equal(Math.round(dAgain * 1000) / 1000, 7.195);
});

test("FSRS-5: calcule la rétention prédictive R = (1 + Factor * t / S)^Power", () => {
  const S = 3.173;

  // À t = 0 jour, la rétention est maximale (1.0 = 100%)
  assert.equal(fsrsPredictRetrievability(0, S), 1.0);

  // À t = S (temps égal à la stabilité), la rétention vaut exactement 90% (0.90)
  const rAtS = fsrsPredictRetrievability(S, S);
  assert.ok(Math.abs(rAtS - 0.90) < 1e-9, `R(S, S) doit être égal à 0.90 (obtenu: ${rAtS})`);

  // Décroissance temporelle monotone : R(0) > R(S/2) > R(S) > R(2S)
  const rHalf = fsrsPredictRetrievability(S / 2, S);
  const rDouble = fsrsPredictRetrievability(S * 2, S);
  assert.ok(rHalf > 0.90, "La rétention avant l'échéance doit dépasser 90%");
  assert.ok(rDouble < 0.90, "La rétention après l'échéance doit être inférieure à 90%");
  assert.ok(rHalf > rAtS && rAtS > rDouble, "La rétention doit décroître de façon strictement monotone");

  // Cas limites et robustesse
  assert.equal(fsrsPredictRetrievability(-5, S), 1.0);
  assert.ok(fsrsPredictRetrievability(1000, 0.01) >= 0.0);
});

test("FSRS-5: met à jour la difficulté avec retour vers la moyenne et bornage 1-10", () => {
  const initialD = 5.0;

  // Rating 1 (Again) augmente la difficulté
  const dAfterAgain = fsrsNextDifficulty(initialD, 1);
  assert.ok(dAfterAgain > initialD, "Again doit augmenter la difficulté");

  // Rating 2 (Hard) augmente légèrement la difficulté
  const dAfterHard = fsrsNextDifficulty(initialD, 2);
  assert.ok(dAfterHard > initialD, "Hard doit augmenter la difficulté");
  assert.ok(dAfterAgain > dAfterHard, "Again augmente plus la difficulté que Hard");

  // Rating 3 (Good) maintient la difficulté autour de sa valeur
  const dAfterGood = fsrsNextDifficulty(initialD, 3);
  assert.ok(Math.abs(dAfterGood - initialD) < 0.1, "Good doit préserver la difficulté");

  // Rating 4 (Easy) diminue la difficulté
  const dAfterEasy = fsrsNextDifficulty(initialD, 4);
  assert.ok(dAfterEasy < initialD, "Easy doit diminuer la difficulté");

  // Bornage strict [1, 10]
  assert.equal(clampDifficulty(15), 10.0);
  assert.equal(clampDifficulty(-3), 1.0);
  assert.equal(fsrsNextDifficulty(9.8, 1), 10.0);
  assert.equal(fsrsNextDifficulty(1.2, 4), 1.0);
});

test("FSRS-5: calcule la nouvelle stabilité après rappel réussi ou échec", () => {
  const initialS = 3.173;
  const initialD = 5.28;
  const rTarget = 0.90;

  // Rappel réussi (Good) à l'échéance : la stabilité augmente
  const sAfterGood = fsrsNextRecallStability(initialD, initialS, rTarget, 3);
  assert.ok(sAfterGood > initialS, `Good doit faire croître la stabilité (${sAfterGood} > ${initialS})`);

  // Rappel réussi (Easy) confère un bonus par rapport à Good
  const sAfterEasy = fsrsNextRecallStability(initialD, initialS, rTarget, 4);
  assert.ok(sAfterEasy > sAfterGood, `Easy doit conférer une stabilité supérieure à Good (${sAfterEasy} > ${sAfterGood})`);

  // Rappel réussi (Hard) a une pénalité par rapport à Good
  const sAfterHard = fsrsNextRecallStability(initialD, initialS, rTarget, 2);
  assert.ok(sAfterHard > initialS, "Hard augmente tout de même la stabilité");
  assert.ok(sAfterHard < sAfterGood, "Hard augmente moins la stabilité que Good");

  // Échec (Again) : la stabilité chute mais conserve un socle résiduel
  const sAfterAgain = fsrsNextForgetStability(initialD, initialS, rTarget);
  assert.ok(sAfterAgain < initialS, `Again doit réduire la stabilité (${sAfterAgain} < ${initialS})`);
  assert.ok(sAfterAgain > 0.01, "La stabilité résiduelle doit être strictement positive");

  // Révision le même jour (short-term)
  const sameDayAgain = fsrsShortTermStability(initialS, 1);
  const sameDayGood = fsrsShortTermStability(initialS, 3);
  const sameDayEasy = fsrsShortTermStability(initialS, 4);
  assert.ok(sameDayAgain < initialS, "Un Again intra-journalier doit réduire la stabilité");
  assert.ok(sameDayGood > initialS, "Un Good intra-journalier doit augmenter la stabilité");
  assert.ok(sameDayEasy > sameDayGood, "Un Easy intra-journalier augmente plus la stabilité qu'un Good");
});

test("FSRS-5: calcule l'intervalle optimal selon la stabilité et la rétention cible", () => {
  const S = 10;

  // À rétention cible 90% (par défaut), l'intervalle optimal est égal à S
  const interval90 = fsrsNextInterval(S, 0.90);
  assert.equal(interval90, 10);

  // À rétention cible plus haute (95%), l'intervalle est plus court (sécurité accrue)
  const interval95 = fsrsNextInterval(S, 0.95);
  assert.ok(interval95 < interval90, `Intervalle à 95% (${interval95}) doit être plus court qu'à 90% (${interval90})`);

  // À rétention cible plus basse (80%), l'intervalle est plus long (davantage d'oubli toléré)
  const interval80 = fsrsNextInterval(S, 0.80);
  assert.ok(interval80 > interval90, `Intervalle à 80% (${interval80}) doit être plus long qu'à 90% (${interval90})`);
});

test("FSRS-5: planification séquentielle complète calculateFsrsSchedule", () => {
  const day0 = "2026-08-01T12:00:00.000Z";
  
  // 1ère révision : Good (3)
  const rev1 = calculateFsrsSchedule({
    rating: 3,
    previousReviews: [],
    createdAt: day0,
  });
  assert.equal(rev1.reviewCount, 1);
  assert.equal(rev1.successStreak, 1);
  assert.equal(rev1.lapses, 0);
  assert.equal(rev1.intervalDays, 3);
  assert.ok(rev1.stability > 3.0);

  // 2ème révision à l'échéance (J+3) : Good (3)
  const day3 = "2026-08-04T12:00:00.000Z";
  const rev2 = calculateFsrsSchedule({
    rating: 3,
    previousReviews: [{ rating: 3, createdAt: day0 }],
    createdAt: day3,
  });
  assert.equal(rev2.reviewCount, 2);
  assert.equal(rev2.successStreak, 2);
  assert.ok(rev2.stability > rev1.stability, "La stabilité doit croître après une 2ème réussite");
  assert.ok(rev2.intervalDays > rev1.intervalDays, "L'intervalle doit croître");

  // 3ème révision à l'échéance : Easy (4)
  const day14 = "2026-08-15T12:00:00.000Z";
  const rev3 = calculateFsrsSchedule({
    rating: 4,
    previousReviews: [
      { rating: 3, createdAt: day0 },
      { rating: 3, createdAt: day3 },
    ],
    createdAt: day14,
  });
  assert.equal(rev3.reviewCount, 3);
  assert.equal(rev3.successStreak, 3);
  assert.ok(rev3.difficulty < rev2.difficulty, "Easy doit réduire la difficulté");
  assert.ok(rev3.stability > 50, "Easy après deux Good doit produire une stabilité élevée");

  // 4ème révision avec échec (Again, 1) : lapse et intervalle réinitialisé à 1 jour
  const day200 = "2027-02-15T12:00:00.000Z";
  const rev4 = calculateFsrsSchedule({
    rating: 1,
    previousReviews: [
      { rating: 3, createdAt: day0 },
      { rating: 3, createdAt: day3 },
      { rating: 4, createdAt: day14 },
    ],
    createdAt: day200,
  });
  assert.equal(rev4.intervalDays, 1);
  assert.equal(rev4.successStreak, 0);
  assert.equal(rev4.lapses, 1);
  assert.ok(rev4.stability < rev3.stability, "L'échec doit faire chuter la stabilité");
  assert.ok(rev4.stability > fsrsInitialStability(1), "La stabilité résiduelle dépasse celle d'une carte totalement vierge");

  // calculateCardSchedule avec options { algorithm: 'fsrs' }
  const scheduleFsrsMode = calculateCardSchedule(3, [{ rating: 3, createdAt: day0 }], day3, { algorithm: "fsrs" });
  assert.equal(scheduleFsrsMode.intervalDays, rev2.intervalDays);
});

test("conserve les faiblesses et permet leur résolution explicite", () => {
  const reviews = [
    {
      courseId: "course-1",
      cardId: "card-1",
      rating: 2,
      createdAt: "2026-08-18T10:00:00.000Z",
      weakConcepts: [{ id: "concept-1", label: "Mécanisme", status: "partial", feedback: "À reprendre" }],
    },
    {
      courseId: "course-1",
      cardId: "card-1",
      rating: 3,
      createdAt: "2026-08-19T10:00:00.000Z",
      weakConcepts: [{ id: "concept-1", label: "Mécanisme", status: "mastered" }],
    },
  ];
  const active = aggregateWeaknesses(reviews, []);
  assert.equal(active.some((item) => item.conceptId === "concept-1"), false);
  const history = aggregateWeaknesses(reviews, [], { activeOnly: false });
  const concept = history.find((item) => item.conceptId === "concept-1");
  assert.equal(concept.failureCount, 1);
  assert.equal(concept.successCount, 1);
});

test("interleave les matières sans perdre le ciblage", () => {
  const result = interleaveCards([
    { cardId: "a1", interleavingKey: "maths", weak: true, date: "2026-08-19" },
    { cardId: "a2", interleavingKey: "maths", weak: false, date: "2026-08-19" },
    { cardId: "b1", interleavingKey: "bio", weak: false, date: "2026-08-19" },
  ]);
  assert.deepEqual(result.map((item) => item.cardId), ["a1", "b1", "a2"]);
  assert.deepEqual(result.map((item) => item.interleavingIndex), [0, 1, 2]);
});

test("groupe les cours, cartes dues et tests de chapitre par jour", () => {
  const plan = buildLearningPlan({
    startDate: "2026-08-19",
    days: 3,
    courses: [{
      id: "course-1",
      title: "Cours 1",
      subjectId: "maths",
      chapterId: "chapter-1",
      status: "ready",
      cards: [{ id: "card-1", question: "Question 1", answer: "Réponse 1" }],
    }],
    reviews: [{
      courseId: "course-1",
      cardId: "card-1",
      rating: 1,
      nextReviewAt: "2026-08-18T12:00:00.000Z",
      createdAt: "2026-08-18T12:00:00.000Z",
    }],
    sessions: [],
    chapters: [{
      id: "chapter-1",
      subjectId: "maths",
      title: "Chapitre 1",
      courseIds: ["course-1"],
      status: "ready",
      cards: [{ id: "chapter-card-1", question: "Question cumulative", answer: "Réponse" }],
    }],
    chapterDefinitions: [],
  });
  assert.equal(plan.days[0].date, "2026-08-19");
  assert.equal(plan.days[0].courses.length, 1);
  assert.equal(plan.days[0].cards.length, 2);
  assert.equal(plan.days[0].chapters.length, 1);
  assert.equal(plan.days[0].chapters[0].cumulative, false);
  assert.equal(plan.summary.today.date, "2026-08-19");
});

test("Cognitive: generateInterleavedSession alterne les matières sans répétition de bloc", () => {
  const courses = [
    {
      id: "c-bio",
      title: "Biologie cellulaire",
      subjectId: "bio",
      cards: [
        { id: "b1", question: "Bio 1", answer: "A1" },
        { id: "b2", question: "Bio 2", answer: "A2" },
      ],
    },
    {
      id: "c-math",
      title: "Algèbre linéaire",
      subjectId: "maths",
      cards: [
        { id: "m1", question: "Math 1", answer: "M1" },
        { id: "m2", question: "Math 2", answer: "M2" },
      ],
    },
    {
      id: "c-phys",
      title: "Mécanique du point",
      subjectId: "phys",
      cards: [
        { id: "p1", question: "Phys 1", answer: "P1" },
      ],
    },
  ];

  const session = generateInterleavedSession({ courses, count: 5 });
  assert.equal(session.length, 5);
  // Doit alterner les matières au lieu d'avoir bio, bio, math, math
  assert.equal(session[0].subjectId, "bio");
  assert.equal(session[1].subjectId, "maths");
  assert.equal(session[2].subjectId, "phys");
  assert.equal(session[3].subjectId, "bio");
  assert.equal(session[4].subjectId, "maths");
});

test("Cognitive: extractExamTrapsAndErrors identifie les pièges et les cartes échouées", () => {
  const courses = [
    {
      id: "c1",
      title: "Cours 1",
      subjectId: "bio",
      cards: [
        { id: "card-normal", question: "Normale", answer: "OK" },
        { id: "card-trap", question: "Piège", answer: "Attention", trap: "Ne pas confondre avec X" },
      ],
    },
  ];
  const reviews = [
    { courseId: "c1", cardId: "card-normal", rating: 1, createdAt: "2026-08-20T12:00:00.000Z" },
  ];

  const trapsAndErrors = extractExamTrapsAndErrors({ courses, reviews });
  assert.equal(trapsAndErrors.length, 2);
  assert.equal(trapsAndErrors[0].id, "card-normal");
  assert.equal(trapsAndErrors[0].isFailed, true);
  assert.equal(trapsAndErrors[1].id, "card-trap");
  assert.equal(trapsAndErrors[1].hasTrap, true);
});

test("Cognitive: evaluateFeynmanExplanation évalue la causalité et les notions clés", () => {
  const card = {
    id: "card-1",
    question: "Comment fonctionne la pompe Na+/K+ ATPase ?",
    answer: "La pompe transporte 3 ions Na+ vers l'extérieur et 2 ions K+ vers l'intérieur en hydrolysant l'ATP, ce qui maintient le potentiel de repos membranaire.",
    trap: "Ne pas inverser les proportions 3 Na+ sortants et 2 K+ entrants.",
    keywords: ["atp", "sodium", "potassium", "gradient", "membrane"],
  };

  const goodExplanation = "La pompe hydrolyse l'ATP pour expulser 3 ions sodium hors de la cellule et faire entrer 2 ions potassium, ce qui permet de maintenir le gradient de potentiel membranaire.";
  const evalGood = evaluateFeynmanExplanation({ card, explanationText: goodExplanation });

  assert.ok(evalGood.score >= 70, `Score attendu >= 70, obtenu: ${evalGood.score}`);
  assert.ok(evalGood.causalScore >= 50);
  assert.equal(evalGood.level, "excellent");

  const tooShort = "C'est une pompe.";
  const evalShort = evaluateFeynmanExplanation({ card, explanationText: tooShort });
  assert.ok(evalShort.score <= 20);
  assert.equal(evalShort.level, "insufficient");
});

test("FSRS: targetRetentionForPriority calibre la rétention selon l'importance de la matière", () => {
  assert.equal(targetRetentionForPriority("A"), 0.92, "Priorité A (6 ECTS) doit cibler 92%");
  assert.equal(targetRetentionForPriority("B"), 0.90, "Priorité B doit cibler 90%");
  assert.equal(targetRetentionForPriority("C"), 0.85, "Priorité C doit cibler 85%");
  assert.equal(targetRetentionForPriority("unknown"), DEFAULT_TARGET_RETENTION);
});

test("FSRS: applyExamHorizonCompression compresse les intervalles à l'approche du partiel", () => {
  // Cas 1 : Partiel dans 15 jours, intervalle calculé de 30 jours -> compressé à J-3 (12 jours)
  const comp1 = applyExamHorizonCompression(30, { daysUntilExam: 15 });
  assert.equal(comp1.isExamConstrained, true);
  assert.equal(comp1.intervalDays, 12);

  // Cas 2 : Partiel dans 2 jours -> révision immédiate (1 jour)
  const comp2 = applyExamHorizonCompression(10, { daysUntilExam: 2 });
  assert.equal(comp2.isExamConstrained, true);
  assert.equal(comp2.intervalDays, 1);

  // Cas 3 : Partiel dans 60 jours, intervalle de 10 jours -> non contraint
  const comp3 = applyExamHorizonCompression(10, { daysUntilExam: 60 });
  assert.equal(comp3.isExamConstrained, false);
  assert.equal(comp3.intervalDays, 10);
});

test("FSRS: seedCourseCardsFromRecall initialise les cartes selon la restitution à froid", () => {
  const course = {
    id: "bio-cours-1",
    cards: [
      { id: "c1", question: "Qu'est-ce que la mosaïque fluide ?", answer: "Bicouche..." },
      { id: "c2", question: "Rôle du cholestérol ?", answer: "Tampon thermique..." },
      { id: "c3", question: "Différence actif vs passif ?", answer: "ATP..." },
    ],
  };

  const evaluation = {
    concepts: [
      { id: "c1", label: "Mosaïque fluide", status: "mastered" },
      { id: "c2", label: "Cholestérol", status: "partial" },
      { id: "c3", label: "Transport", status: "wrong" },
    ],
  };

  const seeded = seedCourseCardsFromRecall(course, evaluation);
  assert.equal(seeded.length, 3);

  // Notion maîtrisée -> Facile (4), intervalle J+4
  assert.equal(seeded[0].seedRating, 4);
  assert.equal(seeded[0].seedIntervalDays, 4);
  assert.equal(seeded[0].seedStatus, "mastered");

  // Notion partielle -> Difficile (2), intervalle J+2
  assert.equal(seeded[1].seedRating, 2);
  assert.equal(seeded[1].seedIntervalDays, 2);
  assert.equal(seeded[1].seedStatus, "partial");

  // Notion erronée -> À revoir (1), intervalle J+1 immédiat
  assert.equal(seeded[2].seedRating, 1);
  assert.equal(seeded[2].seedIntervalDays, 1);
  assert.equal(seeded[2].seedStatus, "wrong");
});

test("Clarification Memory: conserve et fait évoluer l'arbre de questions récurrentes", () => {
  const clarifications = [];

  // Question 1 initiale
  const res1 = recordOrUpdateClarification({
    clarifications,
    subjectId: "bio-cell",
    courseId: "cours-1",
    question: "Comment fonctionne le gradient électrochimique ?",
    answer: "C'est la combinaison du gradient de concentration chimique et du potentiel électrique.",
    context: "Amphi 1",
    date: "2026-09-01T10:00:00.000Z",
  });

  assert.equal(res1.isNew, true);
  assert.equal(res1.recurrenceCount, 1);
  assert.equal(clarifications.length, 1);

  // Question 2 reformulée plus tard (même notion mais approfondie)
  const res2 = recordOrUpdateClarification({
    clarifications,
    subjectId: "bio-cell",
    courseId: "cours-3",
    question: "Je comprends pas bien le gradient électrochimique pour la pompe Na/K",
    answer: "La pompe va contre le gradient électrochimique en utilisant l'ATP pour maintenir l'asymétrie.",
    context: "Amphi 3",
    date: "2026-09-15T14:00:00.000Z",
  });

  assert.equal(res2.isNew, false, "Doit reconnaître la question récurrente");
  assert.equal(res2.recurrenceCount, 2, "Le compteur de récurrence passe à 2");
  assert.equal(clarifications.length, 1, "La note est enrichie au lieu d'être dupliquée");
  assert.equal(clarifications[0].history.length, 2);
  assert.ok(clarifications[0].livingSummary.includes("pompe"));
});



