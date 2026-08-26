const SUCCESS_RATINGS = new Set([3, 4]);
const WEAK_STATUSES = new Set(["partial", "missing", "wrong"]);
const CONCEPT_STATUSES = new Set(["mastered", "partial", "missing", "wrong"]);

export const FSRS_FACTOR = 19 / 81;
export const FSRS_POWER = -0.5;
export const DEFAULT_TARGET_RETENTION = 0.90;
export const MIN_DIFFICULTY = 1.0;
export const MAX_DIFFICULTY = 10.0;
export const MIN_STABILITY = 0.01;
export const MAX_INTERVAL = 36500;

export const DEFAULT_FSRS_WEIGHTS = [
  0.40255, 1.18385, 3.173, 15.69105,
  7.1949, 0.5345,
  1.4604, 0.0046,
  1.54575, 0.1192, 1.01925,
  1.9395, 0.11, 0.29605, 2.2698,
  0.2315, 2.9898,
  0.51655, 0.6621,
];

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function dateValue(value) {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(String(value || ""));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function dateOnlyPlusDays(value, days) {
  const base = new Date(String(value || "").slice(0, 10) + "T12:00:00.000Z");
  if (Number.isNaN(base.getTime())) return null;
  base.setUTCDate(base.getUTCDate() + Number(days || 0));
  return base.toISOString().slice(0, 10);
}

function dateOnly(value, fallback) {
  const parsed = dateValue(value);
  return parsed ? parsed.toISOString().slice(0, 10) : fallback;
}

export function reviewCourseId(review) {
  return text(review && (review.courseId || review.lessonId));
}

export function reviewKey(review) {
  return reviewCourseId(review) + "::" + text(review && review.cardId);
}

export function clampDifficulty(d) {
  const num = Number(d);
  if (Number.isNaN(num)) return 5.0;
  return Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, num));
}

function clampRating(rating) {
  const r = Math.round(Number(rating) || 3);
  return Math.min(4, Math.max(1, r));
}

export function fsrsInitialStability(rating, weights = DEFAULT_FSRS_WEIGHTS) {
  const w = Array.isArray(weights) && weights.length >= 4 ? weights : DEFAULT_FSRS_WEIGHTS;
  const grade = clampRating(rating);
  const s0 = Number(w[grade - 1]);
  return Math.max(MIN_STABILITY, Number.isFinite(s0) ? s0 : DEFAULT_FSRS_WEIGHTS[grade - 1]);
}

export function fsrsInitialDifficulty(rating, weights = DEFAULT_FSRS_WEIGHTS) {
  const w = Array.isArray(weights) && weights.length >= 6 ? weights : DEFAULT_FSRS_WEIGHTS;
  const grade = clampRating(rating);
  const w4 = Number(w[4]);
  const w5 = Number(w[5]);
  const raw = w4 - Math.exp(w5 * (grade - 1)) + 1;
  return clampDifficulty(raw);
}

export function fsrsNextDifficulty(difficulty, rating, weights = DEFAULT_FSRS_WEIGHTS) {
  const w = Array.isArray(weights) && weights.length >= 8 ? weights : DEFAULT_FSRS_WEIGHTS;
  const grade = clampRating(rating);
  const currentD = clampDifficulty(difficulty);
  const d0_3 = fsrsInitialDifficulty(3, w);
  const w6 = Number(w[6]);
  const w7 = Number(w[7]);
  const delta = -w6 * (grade - 3);
  const raw = currentD + delta;
  const reverted = w7 * d0_3 + (1 - w7) * raw;
  return clampDifficulty(reverted);
}

export function fsrsPredictRetrievability(elapsedDays, stability, factor = FSRS_FACTOR, power = FSRS_POWER) {
  const t = Math.max(0, Number(elapsedDays) || 0);
  const s = Math.max(MIN_STABILITY, Number(stability) || MIN_STABILITY);
  if (t === 0) return 1.0;
  const f = Number.isFinite(Number(factor)) ? Number(factor) : FSRS_FACTOR;
  const p = Number.isFinite(Number(power)) ? Number(power) : FSRS_POWER;
  const r = Math.pow(1 + f * (t / s), p);
  return Math.min(1.0, Math.max(0.0, Number.isFinite(r) ? r : 0.0));
}

export function fsrsNextRecallStability(difficulty, stability, retrievability, rating, weights = DEFAULT_FSRS_WEIGHTS) {
  const w = Array.isArray(weights) && weights.length >= 17 ? weights : DEFAULT_FSRS_WEIGHTS;
  const grade = clampRating(rating);
  const safeD = clampDifficulty(difficulty);
  const safeS = Math.max(MIN_STABILITY, Number(stability) || MIN_STABILITY);
  const safeR = Math.min(1.0, Math.max(0.0, Number(retrievability) || 0.0));
  const h = grade === 2 ? Number(w[15]) : grade === 4 ? Number(w[16]) : 1.0;
  const w8 = Number(w[8]);
  const w9 = Number(w[9]);
  const w10 = Number(w[10]);
  const inc = Math.exp(w8) * (11 - safeD) * Math.pow(safeS, -w9) * (Math.exp((1 - safeR) * w10) - 1) * h;
  return Math.max(MIN_STABILITY, safeS * (1 + inc));
}

export function fsrsNextForgetStability(difficulty, stability, retrievability, weights = DEFAULT_FSRS_WEIGHTS) {
  const w = Array.isArray(weights) && weights.length >= 15 ? weights : DEFAULT_FSRS_WEIGHTS;
  const safeD = clampDifficulty(difficulty);
  const safeS = Math.max(MIN_STABILITY, Number(stability) || MIN_STABILITY);
  const safeR = Math.min(1.0, Math.max(0.0, Number(retrievability) || 0.0));
  const w11 = Number(w[11]);
  const w12 = Number(w[12]);
  const w13 = Number(w[13]);
  const w14 = Number(w[14]);
  const sNew = w11 * Math.pow(safeD, -w12) * (Math.pow(safeS + 1, w13) - 1) * Math.exp((1 - safeR) * w14);
  return Math.min(safeS, Math.max(MIN_STABILITY, Number.isFinite(sNew) ? sNew : MIN_STABILITY));
}

export function fsrsShortTermStability(stability, rating, weights = DEFAULT_FSRS_WEIGHTS) {
  const w = Array.isArray(weights) && weights.length >= 19 ? weights : DEFAULT_FSRS_WEIGHTS;
  const grade = clampRating(rating);
  const safeS = Math.max(MIN_STABILITY, Number(stability) || MIN_STABILITY);
  const w17 = Number(w[17]);
  const w18 = Number(w[18]);
  const updated = safeS * Math.exp(w17 * (grade - 3 + w18) * Math.pow(safeS, -0.5));
  return Math.max(MIN_STABILITY, Number.isFinite(updated) ? updated : safeS);
}

export function fsrsNextStability(difficulty, stability, retrievability, rating, weights = DEFAULT_FSRS_WEIGHTS, elapsedDays = null) {
  const grade = clampRating(rating);
  if (typeof elapsedDays === "number" && elapsedDays < 1 && elapsedDays >= 0) {
    return fsrsShortTermStability(stability, grade, weights);
  }
  if (grade === 1) {
    return fsrsNextForgetStability(difficulty, stability, retrievability, weights);
  }
  return fsrsNextRecallStability(difficulty, stability, retrievability, grade, weights);
}

export function fsrsNextInterval(stability, targetRetention = DEFAULT_TARGET_RETENTION, maxInterval = MAX_INTERVAL, factor = FSRS_FACTOR, power = FSRS_POWER) {
  const safeS = Math.max(MIN_STABILITY, Number(stability) || MIN_STABILITY);
  const r = Math.min(0.99, Math.max(0.01, Number(targetRetention) || DEFAULT_TARGET_RETENTION));
  const f = Number.isFinite(Number(factor)) ? Number(factor) : FSRS_FACTOR;
  const p = Number.isFinite(Number(power)) ? Number(power) : FSRS_POWER;
  const maxI = Math.max(1, Number(maxInterval) || MAX_INTERVAL);
  const raw = (safeS / f) * (Math.pow(r, 1 / p) - 1);
  return Math.min(maxI, Math.max(1, Math.round(raw)));
}

export function calculateFsrsSchedule({
  rating,
  previousReviews = [],
  createdAt = new Date(),
  targetRetention = DEFAULT_TARGET_RETENTION,
  weights = DEFAULT_FSRS_WEIGHTS,
  maxInterval = MAX_INTERVAL,
} = {}) {
  const grade = clampRating(rating);
  const base = dateValue(createdAt) || new Date();
  const validPrevious = (Array.isArray(previousReviews) ? previousReviews : [])
    .filter((rev) => rev && rev.createdAt && !Number.isNaN(Date.parse(String(rev.createdAt))))
    .sort((a, b) => Date.parse(String(a.createdAt)) - Date.parse(String(b.createdAt)));

  let s = null;
  let d = null;
  let streak = 0;
  let lapses = 0;
  let lastDate = null;

  for (let i = 0; i < validPrevious.length; i += 1) {
    const rev = validPrevious[i];
    const revGrade = clampRating(rev.rating);
    const revDate = dateValue(rev.createdAt) || new Date();
    if (i === 0) {
      s = fsrsInitialStability(revGrade, weights);
      d = fsrsInitialDifficulty(revGrade, weights);
    } else {
      const elapsedDays = Math.max(0, (revDate.getTime() - lastDate.getTime()) / 86400000);
      const r = fsrsPredictRetrievability(elapsedDays, s);
      d = fsrsNextDifficulty(d, revGrade, weights);
      s = fsrsNextStability(d, s, r, revGrade, weights, elapsedDays);
    }
    lastDate = revDate;
    if (SUCCESS_RATINGS.has(revGrade)) {
      streak += 1;
    } else {
      streak = 0;
    }
    if (revGrade === 1) lapses += 1;
  }

  let currentR = 1.0;
  let elapsedDays = 0;
  if (validPrevious.length === 0) {
    s = fsrsInitialStability(grade, weights);
    d = fsrsInitialDifficulty(grade, weights);
    currentR = 1.0;
  } else {
    elapsedDays = Math.max(0, (base.getTime() - lastDate.getTime()) / 86400000);
    currentR = fsrsPredictRetrievability(elapsedDays, s);
    d = fsrsNextDifficulty(d, grade, weights);
    s = fsrsNextStability(d, s, currentR, grade, weights, elapsedDays);
  }

  if (SUCCESS_RATINGS.has(grade)) {
    streak += 1;
  } else {
    streak = 0;
  }
  if (grade === 1) lapses += 1;

  const intervalDays = grade === 1 ? 1 : fsrsNextInterval(s, targetRetention, maxInterval);
  const nextReviewAt = new Date(base.getTime());
  nextReviewAt.setUTCDate(nextReviewAt.getUTCDate() + intervalDays);

  return {
    intervalDays,
    stability: Number(s.toFixed(5)),
    difficulty: Number(d.toFixed(5)),
    retrievability: Number(currentR.toFixed(5)),
    reviewCount: validPrevious.length + 1,
    successStreak: streak,
    lapses,
    nextReviewAt: nextReviewAt.toISOString(),
    nextReview: nextReviewAt.toISOString().slice(0, 10),
    targetRetention,
    elapsedDays: Number(elapsedDays.toFixed(2)),
  };
}

// -------------------------------------------------------------
// ADAPTIVE TARGET RETENTION BY SUBJECT PRIORITY / ECTS
// -------------------------------------------------------------
export function targetRetentionForPriority(priority = "A") {
  const p = String(priority || "").trim().toUpperCase();
  if (p === "A") return 0.92; // Gros coefficients (Biomolécules, Maths, Tronc commun) -> 92%
  if (p === "B") return 0.90; // Standard 3-4 ECTS -> 90%
  if (p === "C") return 0.85; // Mineures / Options 2 ECTS -> 85%
  return DEFAULT_TARGET_RETENTION;
}

// -------------------------------------------------------------
// EXAM HORIZON COMPRESSION (COURBE D'ATTERRISSAGE PARTIEL)
// -------------------------------------------------------------
export function applyExamHorizonCompression(intervalDays, { daysUntilExam, examDate, currentDate = new Date() } = {}) {
  let remainingDays = typeof daysUntilExam === "number" ? daysUntilExam : null;
  if (remainingDays === null && examDate) {
    const exam = dateValue(examDate);
    const curr = dateValue(currentDate) || new Date();
    if (exam) {
      remainingDays = Math.ceil((exam.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
    }
  }
  if (remainingDays === null || Number.isNaN(remainingDays) || remainingDays <= 0) {
    return { intervalDays, isExamConstrained: false, daysUntilExam: remainingDays };
  }
  // Si le partiel est dans 3 jours ou moins, révision immédiate (1 jour)
  if (remainingDays <= 3) {
    return { intervalDays: 1, isExamConstrained: true, daysUntilExam: remainingDays };
  }
  // Si l'intervalle calculé dépasse la date de l'examen, on compresse pour caler la révision à J-3
  if (intervalDays >= remainingDays) {
    const compressed = Math.max(1, remainingDays - 3);
    return { intervalDays: compressed, isExamConstrained: true, daysUntilExam: remainingDays };
  }
  // Si l'intervalle tombe trop près du partiel (J-2 ou J-1), on ramène à J-3 pour une consolidation sereine
  if (remainingDays - intervalDays < 2) {
    const compressed = Math.max(1, remainingDays - 3);
    return { intervalDays: compressed, isExamConstrained: true, daysUntilExam: remainingDays };
  }
  return { intervalDays, isExamConstrained: false, daysUntilExam: remainingDays };
}

// -------------------------------------------------------------
// COLD RECALL SEEDING (INITIALISATION FSRS DEPUIS LE RAPPEL ACTIF)
// -------------------------------------------------------------
export function seedCardFromRecallStatus(status) {
  const cleanStatus = String(status || "").toLowerCase().trim();
  if (cleanStatus === "mastered") {
    return {
      initialRating: 4, // Facile
      initialStability: fsrsInitialStability(4),
      initialDifficulty: fsrsInitialDifficulty(4),
      initialIntervalDays: 4,
      recallStatus: "mastered",
    };
  }
  if (cleanStatus === "partial") {
    return {
      initialRating: 2, // Difficile
      initialStability: fsrsInitialStability(2),
      initialDifficulty: fsrsInitialDifficulty(2),
      initialIntervalDays: 2,
      recallStatus: "partial",
    };
  }
  if (cleanStatus === "missing" || cleanStatus === "wrong") {
    return {
      initialRating: 1, // À revoir immédiatement
      initialStability: fsrsInitialStability(1),
      initialDifficulty: fsrsInitialDifficulty(1),
      initialIntervalDays: 1,
      recallStatus: cleanStatus,
    };
  }
  return {
    initialRating: 3,
    initialStability: fsrsInitialStability(3),
    initialDifficulty: fsrsInitialDifficulty(3),
    initialIntervalDays: 1,
    recallStatus: "neutral",
  };
}

export function seedCourseCardsFromRecall(course, evaluation) {
  if (!course || !Array.isArray(course.cards)) return [];
  const concepts = Array.isArray(evaluation && evaluation.concepts) ? evaluation.concepts : [];
  const conceptMap = new Map();
  for (const c of concepts) {
    if (c && c.id) conceptMap.set(String(c.id).toLowerCase(), c.status);
    if (c && c.label) conceptMap.set(String(c.label).toLowerCase(), c.status);
  }
  return course.cards.map((card) => {
    const matchedStatus = conceptMap.get(String(card.id).toLowerCase()) ||
                          conceptMap.get(String(card.question).toLowerCase()) ||
                          conceptMap.get(String(card.conceptId || "").toLowerCase());
    const seed = seedCardFromRecallStatus(matchedStatus);
    return {
      ...card,
      seedRating: seed.initialRating,
      seedStability: seed.initialStability,
      seedDifficulty: seed.initialDifficulty,
      seedIntervalDays: seed.initialIntervalDays,
      seedStatus: seed.recallStatus,
    };
  });
}

export function calculateCardSchedule(rating, previousReviews, createdAt = new Date(), options = {}) {
  const safeRating = Number(rating);
  const ordered = [...(Array.isArray(previousReviews) ? previousReviews : [])]
    .sort((a, b) => (Date.parse(String(b.createdAt || "")) || 0) - (Date.parse(String(a.createdAt || "")) || 0));
  const reviewCount = ordered.length + 1;
  let intervalDays = 1;
  let successStreak = 0;
  if (safeRating === 2) intervalDays = 2;
  if (safeRating === 3 || safeRating === 4) {
    for (const previous of ordered) {
      if (!SUCCESS_RATINGS.has(Number(previous.rating))) break;
      successStreak += 1;
    }
    const intervals = safeRating === 3 ? [4, 7, 14, 30, 60, 120, 180] : [7, 14, 30, 60, 120, 180, 240];
    intervalDays = intervals[Math.min(successStreak, intervals.length - 1)];
  }
  const base = dateValue(createdAt) || new Date();
  const nextReviewAt = new Date(base.getTime());
  nextReviewAt.setUTCDate(nextReviewAt.getUTCDate() + intervalDays);

  const targetRetention = options.targetRetention ||
    (options.priority ? targetRetentionForPriority(options.priority) : DEFAULT_TARGET_RETENTION);

  const fsrsSchedule = calculateFsrsSchedule({
    rating: safeRating,
    previousReviews,
    createdAt: base,
    targetRetention,
    weights: options.weights || DEFAULT_FSRS_WEIGHTS,
    maxInterval: options.maxInterval || MAX_INTERVAL,
  });

  const useFsrs = options.algorithm === "legacy" || options.fsrs === false ? false : true;
  let effectiveIntervalDays = useFsrs ? fsrsSchedule.intervalDays : intervalDays;

  // Compression automatique selon l'échéance du partiel
  const examCompression = applyExamHorizonCompression(effectiveIntervalDays, {
    daysUntilExam: options.daysUntilExam,
    examDate: options.examDate,
    currentDate: base,
  });
  if (examCompression.isExamConstrained) {
    effectiveIntervalDays = examCompression.intervalDays;
  }

  const effectiveNextReviewAt = new Date(base.getTime());
  effectiveNextReviewAt.setUTCDate(effectiveNextReviewAt.getUTCDate() + effectiveIntervalDays);

  return {
    intervalDays: effectiveIntervalDays,
    legacyIntervalDays: intervalDays,
    reviewCount,
    successStreak,
    nextReviewAt: effectiveNextReviewAt.toISOString(),
    nextReview: effectiveNextReviewAt.toISOString().slice(0, 10),
    stability: fsrsSchedule.stability,
    difficulty: fsrsSchedule.difficulty,
    retrievability: fsrsSchedule.retrievability,
    lapses: fsrsSchedule.lapses,
    targetRetention: fsrsSchedule.targetRetention,
    fsrs: fsrsSchedule,
    isExamConstrained: examCompression.isExamConstrained,
  };
}

export function normalizeWeakConcepts(value) {
  const candidates = Array.isArray(value) ? value : [];
  const seen = new Set();
  return candidates.map((concept, index) => {
    if (!concept || typeof concept !== "object") return null;
    const status = CONCEPT_STATUSES.has(concept.status) ? concept.status : "missing";
    const id = text(concept.id) || "concept-" + (index + 1);
    const label = text(concept.label) || id;
    const key = id + "::" + label;
    if (seen.has(key)) return null;
    seen.add(key);
    return {
      id,
      label,
      status,
      ...(text(concept.feedback) ? { feedback: text(concept.feedback) } : {}),
      ...(text(concept.source) ? { source: text(concept.source) } : {}),
      ...(text(concept.expected) ? { expected: text(concept.expected) } : {}),
    };
  }).filter(Boolean).slice(0, 32);
}

function signalTime(item, fallbackIndex) {
  return dateValue(item && (item.updatedAt || item.createdAt)) || new Date(fallbackIndex);
}

function applySignal(map, signal) {
  if (!signal.courseId) return;
  const key = [signal.courseId, signal.cardId || "", signal.conceptId || ""].join("::");
  const current = map.get(key);
  if (!current) {
    map.set(key, {
      id: key,
      courseId: signal.courseId,
      ...(signal.cardId ? { cardId: signal.cardId } : {}),
      ...(signal.conceptId ? { conceptId: signal.conceptId } : {}),
      ...(signal.label ? { label: signal.label } : {}),
      active: Boolean(signal.active),
      lastStatus: signal.status || null,
      failureCount: signal.active ? 1 : 0,
      successCount: signal.active ? 0 : 1,
      lastSeenAt: signal.time.toISOString(),
      ...(signal.feedback ? { feedback: signal.feedback } : {}),
      ...(signal.source ? { source: signal.source } : {}),
      ...(signal.expected ? { expected: signal.expected } : {}),
    });
    return;
  }
  current.failureCount += signal.active ? 1 : 0;
  current.successCount += signal.active ? 0 : 1;
  if (signal.time.getTime() >= Date.parse(current.lastSeenAt)) {
    current.active = Boolean(signal.active);
    current.lastStatus = signal.status || null;
    current.lastSeenAt = signal.time.toISOString();
    if (signal.label) current.label = signal.label;
    if (signal.feedback) current.feedback = signal.feedback;
    if (signal.source) current.source = signal.source;
    if (signal.expected) current.expected = signal.expected;
  }
}

function signalsFromRecord(record, index, kind) {
  const courseId = reviewCourseId(record);
  if (!courseId) return [];
  const time = signalTime(record, index);
  const signals = [];
  const rating = Number(record.rating);
  const cardId = text(record.cardId);
  if (cardId && Number.isInteger(rating)) {
    signals.push({ courseId, cardId, active: rating <= 2, status: rating <= 2 ? (rating === 1 ? "wrong" : "partial") : "mastered", time });
  }
  const weakCardIds = Array.isArray(record.weakCardIds) ? record.weakCardIds : [];
  for (const weakCardId of weakCardIds.map(text).filter(Boolean)) {
    signals.push({ courseId, cardId: weakCardId, active: true, status: "partial", time });
  }
  const concepts = normalizeWeakConcepts(record.weakConcepts || (record.evaluation && record.evaluation.concepts) || []);
  for (const concept of concepts) {
    const conceptCardId = cardId || text(record.cardId);
    signals.push({
      courseId,
      cardId: conceptCardId,
      conceptId: concept.id,
      label: concept.label,
      active: WEAK_STATUSES.has(concept.status),
      status: concept.status,
      feedback: concept.feedback,
      source: concept.source,
      expected: concept.expected,
      time,
    });
  }
  const missing = Array.isArray(record.missing) ? record.missing.map(text).filter(Boolean) : [];
  if (!concepts.length && cardId) {
    for (const label of missing) signals.push({ courseId, cardId, conceptId: "missing-" + label, label, active: true, status: "missing", time });
  }
  if (!signals.length && kind === "session" && record.type === "course-recall" && Number.isInteger(rating)) {
    signals.push({ courseId, active: rating <= 2, status: rating <= 2 ? "partial" : "mastered", time });
  }
  return signals;
}

export function aggregateWeaknesses(reviews = [], sessions = [], options = {}) {
  const map = new Map();
  [...(Array.isArray(reviews) ? reviews : [])].forEach((record, index) => {
    for (const signal of signalsFromRecord(record, index + 1, "review")) applySignal(map, signal);
  });
  [...(Array.isArray(sessions) ? sessions : [])].forEach((record, index) => {
    for (const signal of signalsFromRecord(record, index + 1, "session")) applySignal(map, signal);
  });
  const values = [...map.values()].map((item) => ({
    ...item,
    weaknessScore: item.failureCount * 2 - item.successCount,
  }));
  const activeOnly = options.activeOnly !== false;
  return (activeOnly ? values.filter((item) => item.active) : values)
    .sort((a, b) => b.weaknessScore - a.weaknessScore || b.lastSeenAt.localeCompare(a.lastSeenAt) || a.id.localeCompare(b.id));
}

export function latestReviews(reviews = []) {
  const latest = new Map();
  for (const review of Array.isArray(reviews) ? reviews : []) {
    const key = reviewKey(review);
    if (!key.endsWith("::")) {
      const current = latest.get(key);
      if (!current || (Date.parse(String(review.createdAt || "")) || 0) > (Date.parse(String(current.createdAt || "")) || 0)) latest.set(key, review);
    }
  }
  return latest;
}

function cardDueDate(review, startDate) {
  return dateOnly(review && (review.nextReviewAt || review.nextReview), startDate);
}

export function interleaveCards(cards = []) {
  const buckets = new Map();
  for (const card of cards) {
    const key = text(card.interleavingKey) || text(card.subjectId) || text(card.courseId) || "unknown";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(card);
  }
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => String(a.date).localeCompare(String(b.date)) || Number(b.weak) - Number(a.weak) || String(a.cardId).localeCompare(String(b.cardId)));
  }
  const result = [];
  let previousKey = null;
  while ([...buckets.values()].some((bucket) => bucket.length)) {
    const available = [...buckets.entries()].filter(([, bucket]) => bucket.length);
    available.sort((a, b) => {
      const aSame = a[0] === previousKey ? 1 : 0;
      const bSame = b[0] === previousKey ? 1 : 0;
      return aSame - bSame || Number(b[1][0].weak) - Number(a[1][0].weak) || a[0].localeCompare(b[0]);
    });
    const [key, bucket] = available.find(([candidateKey]) => candidateKey !== previousKey) || available[0];
    const item = bucket.shift();
    result.push({ ...item, interleavingKey: key, interleavingIndex: result.length });
    previousKey = key;
  }
  return result;
}

function planningDay(startDate, offset) {
  return dateOnlyPlusDays(startDate, offset);
}

function putInDay(days, item) {
  const target = days.get(item.date);
  if (!target) return;
  target.items.push(item);
  if (item.type === "course") target.courses.push(item);
  if (item.type === "card" || item.type === "chapter-card") target.cards.push(item);
  if (item.type === "chapter") target.chapters.push(item);
}

export function buildLearningPlan({ courses = [], reviews = [], sessions = [], chapters = [], chapterDefinitions = [], startDate, days = 14, subjectId = null } = {}) {
  const safeStart = dateOnly(startDate, new Date().toISOString().slice(0, 10));
  const dayCount = Math.min(60, Math.max(1, Number(days) || 14));
  const grouped = new Map();
  for (let index = 0; index < dayCount; index += 1) {
    const date = planningDay(safeStart, index);
    grouped.set(date, { date, items: [], courses: [], cards: [], chapters: [] });
  }
  const latest = latestReviews(reviews);
  const weaknesses = aggregateWeaknesses(reviews, sessions);
  const weakCardKeys = new Set(weaknesses.filter((item) => item.cardId).map((item) => item.courseId + "::" + item.cardId));
  const eligibleCourses = (Array.isArray(courses) ? courses : []).filter((course) => (!subjectId || course.subjectId === subjectId) && course.status === "ready");
  for (const course of eligibleCourses) {
    const relevant = (Array.isArray(sessions) ? sessions : []).filter((session) => session.type === "course-recall" && session.courseId === course.id).sort((a, b) => (Date.parse(String(b.createdAt || "")) || 0) - (Date.parse(String(a.createdAt || "")) || 0));
    const latestSession = relevant[0];
    const due = latestSession ? dateOnly(latestSession.nextReview || latestSession.nextReviewAt, safeStart) : safeStart;
    if (due <= [...grouped.keys()].at(-1)) {
      putInDay(grouped, {
        type: "course",
        date: due < safeStart ? safeStart : due,
        dueDate: due,
        courseId: course.id,
        title: course.title,
        subjectId: course.subjectId,
        chapterId: course.chapterId || null,
        priority: latestSession && Number(latestSession.rating) <= 2 ? 3 : latestSession ? 1 : 2,
        explanationStatus: latestSession ? "a_revoir" : "a_expliquer",
        attemptCount: relevant.length,
      });
    }
  }
  const cardItems = [];
  for (const course of eligibleCourses) {
    for (const card of Array.isArray(course.cards) ? course.cards : []) {
      const key = course.id + "::" + card.id;
      const review = latest.get(key);
      const due = cardDueDate(review, safeStart);
      if (due > [...grouped.keys()].at(-1)) continue;
      cardItems.push({
        type: "card",
        date: due < safeStart ? safeStart : due,
        dueDate: due,
        courseId: course.id,
        cardId: card.id,
        title: card.question,
        subjectId: course.subjectId,
        chapterId: course.chapterId || null,
        weak: weakCardKeys.has(key),
        targeted: weakCardKeys.has(key),
        reviewCount: review ? Number(review.reviewCount) || 0 : 0,
        nextReviewAt: review && (review.nextReviewAt || review.nextReview) || null,
        interleavingKey: course.subjectId || course.id,
      });
    }
  }
  for (const chapter of Array.isArray(chapters) ? chapters.filter((item) => item.status === "ready" && (!subjectId || item.subjectId === subjectId)) : []) {
    for (const card of Array.isArray(chapter.cards) ? chapter.cards : []) {
      const courseId = "chapter::" + chapter.id;
      const key = courseId + "::" + card.id;
      const review = latest.get(key);
      const due = cardDueDate(review, safeStart);
      if (due > [...grouped.keys()].at(-1)) continue;
      cardItems.push({
        type: "chapter-card",
        date: due < safeStart ? safeStart : due,
        courseId,
        cardId: card.id,
        title: card.question,
        subjectId: chapter.subjectId,
        chapterId: chapter.id,
        weak: weakCardKeys.has(key),
        targeted: weakCardKeys.has(key),
        reviewCount: review ? Number(review.reviewCount) || 0 : 0,
        nextReviewAt: review && (review.nextReviewAt || review.nextReview) || null,
        interleavingKey: chapter.subjectId || chapter.id,
      });
    }
  }
  for (const item of interleaveCards(cardItems)) putInDay(grouped, item);

  const generatedChapterKeys = new Set();
  for (const chapter of Array.isArray(chapters) ? chapters.filter((item) => item.status === "ready") : []) {
    generatedChapterKeys.add(String(chapter.chapterKey || chapter.id));
    const cards = [...grouped.values()].flatMap((day) => day.cards.filter((item) => item.chapterId === chapter.id));
    if (!cards.length) continue;
    const date = cards.map((item) => item.date).sort()[0];
    putInDay(grouped, {
      type: "chapter",
      date,
      dueDate: date,
      chapterId: chapter.id,
      chapterKey: chapter.chapterKey || chapter.id,
      title: chapter.title,
      subjectId: chapter.subjectId,
      courseIds: chapter.courseIds || [],
      dueCount: cards.length,
      weakCount: cards.filter((item) => item.weak).length,
      priority: cards.length + cards.filter((item) => item.weak).length * 2,
      cumulative: (chapter.courseIds || []).length > 1,
    });
  }
  for (const definition of Array.isArray(chapterDefinitions) ? chapterDefinitions : []) {
    if (generatedChapterKeys.has(String(definition.id))) continue;
    const linkedCourses = eligibleCourses.filter((course) => course.chapterId === definition.id);
    const linkedItems = [...grouped.values()].flatMap((day) => day.courses.filter((item) => item.chapterId === definition.id));
    if (!linkedCourses.length || !linkedItems.length) continue;
    const date = linkedItems.map((item) => item.date).sort()[0];
    putInDay(grouped, {
      type: "chapter",
      date,
      dueDate: date,
      chapterId: definition.id,
      chapterKey: definition.id,
      title: definition.title,
      subjectId: definition.subjectId,
      courseIds: linkedCourses.map((course) => course.id),
      dueCount: linkedItems.length,
      weakCount: 0,
      priority: linkedItems.length,
      cumulative: linkedCourses.length > 1,
    });
  }
  const dayList = [...grouped.values()].map((day) => ({
    ...day,
    items: day.items.sort((a, b) => (a.type === "chapter" ? -1 : 0) - (b.type === "chapter" ? -1 : 0) || Number(b.priority || b.weak || 0) - Number(a.priority || a.weak || 0)),
  }));
  return {
    startDate: safeStart,
    endDate: dayList.at(-1).date,
    generatedAt: new Date().toISOString(),
    days: dayList,
    weaknesses,
    summary: {
      totalCourses: dayList.reduce((sum, day) => sum + day.courses.length, 0),
      totalCards: dayList.reduce((sum, day) => sum + day.cards.length, 0),
      totalChapters: dayList.reduce((sum, day) => sum + day.chapters.length, 0),
      weakCards: cardItems.filter((item) => item.weak).length,
      today: dayList[0],
    },
  };
}

export function generateInterleavedSession({ courses = [], reviews = [], count = 15, subjectIds = null }) {
  const latest = latestReviews(reviews);
  const eligibleCourses = (Array.isArray(courses) ? courses : []).filter((c) => {
    if (!subjectIds || !subjectIds.length) return true;
    return subjectIds.includes(c.subjectId);
  });

  const cardsBySubject = new Map();
  for (const course of eligibleCourses) {
    const subId = course.subjectId || "general";
    if (!cardsBySubject.has(subId)) cardsBySubject.set(subId, []);

    const list = Array.isArray(course.cards) ? course.cards : [];
    for (const card of list) {
      const key = reviewKey({ courseId: course.id, cardId: card.id });
      const rev = latest.get(key);
      const daysSince = rev && rev.reviewedAt ? Math.max(0, (Date.now() - new Date(rev.reviewedAt).getTime()) / 86400000) : 1;
      const stability = rev ? Number(rev.stability) || 1.0 : 1.0;
      const retrievability = fsrsPredictRetrievability(daysSince, stability);

      cardsBySubject.get(subId).push({
        ...card,
        courseId: course.id,
        courseTitle: course.title,
        subjectId: course.subjectId,
        chapterId: course.chapterId,
        blackboardPhotos: course.blackboardPhotos || course.boardPhotos || (course.photoUrl ? [course.photoUrl] : []),
        retrievability,
        lastRating: rev ? rev.rating : null,
      });
    }
  }

  const interleaved = [];
  const subjectBuckets = [...cardsBySubject.values()].filter((bucket) => bucket.length > 0);
  if (!subjectBuckets.length) return [];

  subjectBuckets.forEach((bucket) => {
    bucket.sort((a, b) => (a.retrievability || 0) - (b.retrievability || 0));
  });

  let added = true;
  let cycle = 0;
  while (added && interleaved.length < count) {
    added = false;
    for (const bucket of subjectBuckets) {
      if (bucket.length > 0 && interleaved.length < count) {
        interleaved.push(bucket.shift());
        added = true;
      }
    }
    cycle++;
    if (cycle > count * 2) break;
  }

  return interleaved;
}

export function extractExamTrapsAndErrors({ courses = [], reviews = [] }) {
  const latest = latestReviews(reviews);
  const results = [];

  for (const course of Array.isArray(courses) ? courses : []) {
    const cards = Array.isArray(course.cards) ? course.cards : [];
    for (const card of cards) {
      const key = reviewKey({ courseId: course.id, cardId: card.id });
      const rev = latest.get(key);
      const isFailed = rev && (rev.rating === 1 || rev.status === "wrong" || rev.status === "partial");
      const hasTrap = Boolean(card.trap || (card.kind && card.kind.toLowerCase().includes("trap")) || (card.question && card.question.toLowerCase().includes("piège")));

      if (isFailed || hasTrap) {
        results.push({
          ...card,
          courseId: course.id,
          courseTitle: course.title,
          subjectId: course.subjectId,
          chapterId: course.chapterId,
          blackboardPhotos: course.blackboardPhotos || course.boardPhotos || (course.photoUrl ? [course.photoUrl] : []),
          isFailed: Boolean(isFailed),
          hasTrap: Boolean(hasTrap),
          trapText: card.trap || "Attention aux confusions fréquentes sur cette notion.",
          lastRating: rev ? rev.rating : null,
          reviewCount: rev ? rev.reviewCount : 0,
        });
      }
    }
  }

  return results.sort((a, b) => {
    if (a.isFailed && !b.isFailed) return -1;
    if (!a.isFailed && b.isFailed) return 1;
    return (a.reviewCount || 0) - (b.reviewCount || 0);
  });
}

export function evaluateFeynmanExplanation({ card, course, explanationText }) {
  const raw = text(explanationText);
  if (!raw || raw.length < 10) {
    return {
      score: 15,
      causalScore: 10,
      level: "insufficient",
      feedback: "L'explication est trop courte. Essaie d'expliquer le mécanisme complet avec tes propres mots.",
      masteredKeywords: [],
      missingKeywords: Array.isArray(card?.keywords) ? card.keywords : [],
      improvedFeynman: `Pour retenir simplement : ${card?.answer || "Explique le mécanisme étape par étape."}`,
    };
  }

  const normExplanation = raw.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const causalConnectors = ["parce que", "car", "permet", "entraine", "donc", "grace a", "provoque", "structure", "role", "mecanisme", "fonction", "effet", "lie a", "compose de"];
  let causalMatches = 0;
  for (const conn of causalConnectors) {
    if (normExplanation.includes(conn)) causalMatches++;
  }
  const causalScore = Math.min(100, Math.round(30 + causalMatches * 20));

  const targetAnswerTokens = (card?.answer || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3);
  const cardKeywords = (Array.isArray(card?.keywords) ? card.keywords : []).map((k) => String(k).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, ""));
  const userTokens = new Set(normExplanation.split(/[^\p{L}\p{N}]+/u));

  const mastered = [];
  const missing = [];

  // Check card keywords with prefix / stem matching
  for (const kw of cardKeywords) {
    const stem = kw.slice(0, 4);
    const found = [...userTokens].some((ut) => ut === kw || (stem.length >= 3 && ut.startsWith(stem)) || (kw.length >= 4 && ut.includes(kw)));
    if (found) {
      mastered.push(kw);
    } else {
      missing.push(kw);
    }
  }

  // Check answer tokens
  for (const tok of targetAnswerTokens) {
    const stem = tok.slice(0, 4);
    const found = userTokens.has(tok) || [...userTokens].some((ut) => stem.length >= 4 && ut.startsWith(stem));
    if (found && !mastered.includes(tok)) {
      mastered.push(tok);
    } else if (!found && tok.length > 4 && missing.length < 5) {
      missing.push(tok);
    }
  }

  const keywordRatio = (cardKeywords.length > 0)
    ? mastered.filter((m) => cardKeywords.includes(m)).length / cardKeywords.length
    : (targetAnswerTokens.length > 0 ? mastered.length / Math.max(1, targetAnswerTokens.length) : 0.7);

  const rawScore = Math.round(causalScore * 0.45 + keywordRatio * 55);
  const score = Math.max(20, Math.min(100, rawScore));

  let level = "insufficient";
  if (score >= 75) level = "excellent";
  else if (score >= 55) level = "good";
  else if (score >= 35) level = "partial";

  const feedback = score >= 80
    ? "Excellente vulgarisation ! Tu as bien identifié la cause, la structure et le mécanisme."
    : score >= 50
    ? "Bonne intuition, mais renforce la précision sur les termes clés et la chaîne de causalité."
    : "Explication incomplète. Veille à expliciter le *pourquoi* et pas seulement le résultat.";

  return {
    score,
    causalScore,
    level,
    feedback,
    masteredKeywords: [...new Set(mastered)].slice(0, 5),
    missingKeywords: [...new Set(missing)].slice(0, 5),
    improvedFeynman: `Réponse idéale vulgarisée : ${card?.answer || "Mécanisme clé du cours"} (Attention : ${card?.trap || "bien préciser les conditions initiales"}).`,
  };
}

// -------------------------------------------------------------
// QUESTION MEMORY & LIVING CLARIFICATION TREE (ARBRE D'ÉVOLUTION DES QUESTIONS)
// -------------------------------------------------------------

const SCIENTIFIC_STOP_WORDS = new Set([
  "de", "la", "le", "un", "une", "en", "et", "ou", "du", "des", "les", "que", "qui",
  "dans", "pour", "sur", "par", "pas", "est", "sont", "avec", "sans", "ce", "cet",
  "cette", "ces", "je", "tu", "il", "on", "nous", "vous", "ils", "mon", "ton", "son",
  "mes", "tes", "ses", "pourquoi", "comment", "quand", "quel", "quelle", "quels", "quelles",
  "bien", "tout", "tous", "toute", "toutes", "faire", "fait", "dire", "dit"
]);

function extractScientificTokens(str) {
  if (!str || typeof str !== "string") return [];
  const norm = str.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return norm.split(/[^a-z0-9]+/i).filter((w) => w.length >= 2 && !SCIENTIFIC_STOP_WORDS.has(w));
}

export function findClarificationHistory(clarifications = [], queryText = "", subjectId = null) {
  if (!queryText || typeof queryText !== "string") return null;
  const list = Array.isArray(clarifications) ? clarifications : [];
  const queryTokens = new Set(extractScientificTokens(queryText));
  if (!queryTokens.size) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const item of list) {
    if (subjectId && item.subjectId && item.subjectId !== subjectId) continue;
    const itemTokens = extractScientificTokens(item.initialQuestion || item.topic || "");
    if (!itemTokens.length) continue;

    let common = 0;
    for (const tok of itemTokens) {
      if (queryTokens.has(tok)) common++;
    }
    const score = common / itemTokens.length;
    if (score >= 0.30 && score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestMatch;
}

export function recordOrUpdateClarification({
  clarifications = [],
  subjectId,
  courseId,
  chapterId,
  question,
  answer,
  context = "",
  date = new Date().toISOString(),
}) {
  const existing = findClarificationHistory(clarifications, question, subjectId);
  const now = date;

  if (existing) {
    existing.recurrenceCount = (existing.recurrenceCount || 1) + 1;
    existing.lastAskedAt = now;
    if (!Array.isArray(existing.history)) existing.history = [];
    existing.history.push({
      date: now,
      question,
      answer,
      context,
    });
    existing.livingSummary = answer;
    return { item: existing, isNew: false, recurrenceCount: existing.recurrenceCount };
  }

  const newItem = {
    id: `clarif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    subjectId: subjectId || null,
    courseId: courseId || null,
    chapterId: chapterId || null,
    initialQuestion: question,
    topic: question.slice(0, 80),
    firstAskedAt: now,
    lastAskedAt: now,
    recurrenceCount: 1,
    livingSummary: answer,
    history: [
      {
        date: now,
        question,
        answer,
        context,
      },
    ],
  };

  clarifications.push(newItem);
  return { item: newItem, isNew: true, recurrenceCount: 1 };
}
