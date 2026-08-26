import test from "node:test";
import assert from "node:assert/strict";
import { calculateCardSchedule } from "../learning-engine.mjs";

test("Simulation E2E FSRS-5 sur 1, 2 et 3 mois : progression active et consolidation", () => {
  // --- J0 : Création du cours & Premier Rappel Actif ---
  const cardId = "card-mosaique-fluide";
  const cardDifficultId = "card-cholesterol-tampon";
  
  const historyCard1 = [];
  const historyCard2 = [];
  const startDay = new Date("2026-08-25T10:00:00.000Z");

  // 1. Premier rappel J0 (Good = 3 pour card 1, Hard = 2 pour card 2)
  const r1_c1 = calculateCardSchedule(3, historyCard1, startDay);
  assert.equal(r1_c1.reviewCount, 1);
  assert.ok(r1_c1.stability >= 3.0, "La stabilité initiale pour Good doit être >= 3 jours");
  assert.ok(r1_c1.intervalDays >= 3);
  historyCard1.push({ cardId, rating: 3, createdAt: startDay.toISOString(), schedule: r1_c1 });

  const r1_c2 = calculateCardSchedule(2, historyCard2, startDay); // Notion difficile
  assert.equal(r1_c2.reviewCount, 1);
  assert.ok(r1_c2.difficulty > r1_c1.difficulty, "La notion difficile a une difficulté intrinsèque plus élevée");
  historyCard2.push({ cardId: cardDifficultId, rating: 2, createdAt: startDay.toISOString(), schedule: r1_c2 });

  // --- MOIS 1 (+30 jours) : 2e et 3e révisions FSRS ---
  // Card 1 : Révisée à J+4 (Good = 3) puis à J+14 (Easy = 4)
  const day4 = new Date(startDay.getTime() + 4 * 86400000);
  const r2_c1 = calculateCardSchedule(3, historyCard1, day4);
  assert.equal(r2_c1.reviewCount, 2);
  assert.ok(r2_c1.stability > r1_c1.stability, "La stabilité doit croître à la 2e révision");
  historyCard1.push({ cardId, rating: 3, createdAt: day4.toISOString(), schedule: r2_c1 });

  const day14 = new Date(startDay.getTime() + 14 * 86400000);
  const r3_c1 = calculateCardSchedule(4, historyCard1, day14); // Easy
  assert.equal(r3_c1.reviewCount, 3);
  assert.ok(r3_c1.intervalDays >= 14, "L'intervalle à 1 mois dépasse 2 semaines");
  historyCard1.push({ cardId, rating: 4, createdAt: day14.toISOString(), schedule: r3_c1 });

  // Card 2 (difficile) : Oubli à J+3 (Again = 1) puis reprise à J+4 (Good = 3)
  const day3 = new Date(startDay.getTime() + 3 * 86400000);
  const r2_c2 = calculateCardSchedule(1, historyCard2, day3); // Oubli
  assert.equal(r2_c2.lapses, 1);
  assert.equal(r2_c2.intervalDays, 1); // Remise immédiate
  historyCard2.push({ cardId: cardDifficultId, rating: 1, createdAt: day3.toISOString(), schedule: r2_c2 });

  const day4_c2 = new Date(startDay.getTime() + 4 * 86400000);
  const r3_c2 = calculateCardSchedule(3, historyCard2, day4_c2);
  historyCard2.push({ cardId: cardDifficultId, rating: 3, createdAt: day4_c2.toISOString(), schedule: r3_c2 });

  // --- MOIS 2 (+60 jours) : Consolidation à long terme ---
  const day45 = new Date(startDay.getTime() + 45 * 86400000);
  const r4_c1 = calculateCardSchedule(3, historyCard1, day45);
  assert.ok(r4_c1.stability > 25.0, "À 2 mois, la stabilité dépasse 25 jours");
  assert.ok(r4_c1.intervalDays >= 25);
  historyCard1.push({ cardId, rating: 3, createdAt: day45.toISOString(), schedule: r4_c1 });

  const day35_c2 = new Date(startDay.getTime() + 35 * 86400000);
  const r4_c2 = calculateCardSchedule(3, historyCard2, day35_c2);
  assert.ok(r4_c2.stability > r3_c2.stability, "La carte difficile récupère de la stabilité");
  historyCard2.push({ cardId: cardDifficultId, rating: 3, createdAt: day35_c2.toISOString(), schedule: r4_c2 });

  // --- MOIS 3 (+90 jours) : Maîtrise totale & Rétention optimale ---
  const day80 = new Date(startDay.getTime() + 80 * 86400000);
  const r5_c1 = calculateCardSchedule(4, historyCard1, day80); // Easy
  assert.ok(r5_c1.stability >= 60.0, "À 3 mois, la stabilité mémoire atteint >= 60 jours");
  assert.ok(r5_c1.intervalDays >= 60, "L'intervalle de révision dépasse 2 mois");
  assert.ok(r5_c1.retrievability <= 1.0 && r5_c1.retrievability >= 0.85, "La probabilité de rappel reste optimale");

  const day75_c2 = new Date(startDay.getTime() + 75 * 86400000);
  const r5_c2 = calculateCardSchedule(3, historyCard2, day75_c2);
  assert.ok(r5_c2.stability >= 30.0, "La carte autrefois difficile est désormais stable à 1 mois");
  assert.ok(r5_c2.intervalDays >= 30);
});
