import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

test("E2E complet : Cycle complet BioMIA Revision OS (Web, Sas de rappel, FSRS-5, Planning & Concurrence)", async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), "biomia-e2e-"));
  const data = path.join(fixture, "data");
  await Promise.all([
    mkdir(path.join(data, "cours", "photos"), { recursive: true }),
    mkdir(path.join(data, "transcriptions"), { recursive: true }),
    mkdir(path.join(data, "enregistrements"), { recursive: true }),
    mkdir(path.join(data, "revisions", "audio"), { recursive: true }),
    mkdir(path.join(data, "automation", "logs"), { recursive: true }),
  ]);

  // Initialisation du catalogue des matières
  await writeFile(
    path.join(data, "courses.json"),
    JSON.stringify({
      courses: [
        { id: "s1-biologie-cellulaire", title: "Biologie Cellulaire", semester: "S1", category: "Biologie" },
        { id: "s1-chimie-generale", title: "Chimie Générale", semester: "S1", category: "Chimie" },
      ],
    }, null, 2) + "\n"
  );
  await writeFile(path.join(data, "cours", "chapter-definitions.json"), "[]\n");
  await writeFile(path.join(data, "cours", "chapters.json"), "[]\n");
  await writeFile(path.join(data, "cours", "index.json"), "[]\n");
  await writeFile(path.join(data, "enregistrements", "index.json"), "[]\n");
  await writeFile(path.join(data, "transcriptions", "index.json"), "[]\n");
  await writeFile(path.join(data, "revisions", "reviews.json"), "[]\n");
  await writeFile(path.join(data, "revisions", "sessions.json"), "[]\n");

  const port = 46000 + Math.floor(Math.random() * 1000);
  const serverPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "server.mjs");
  const child = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env: {
      ...process.env,
      GEMINI_API_KEY: "",
      BIOMIA_DATA_DIR: data,
      BIOMIA_PORT: String(port),
      BIOMIA_HOST: "127.0.0.1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(async () => {
    child.kill("SIGTERM");
    await rm(fixture, { recursive: true, force: true });
  });

  const BASE_URL = `http://127.0.0.1:${port}`;

  let started = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE_URL}/`);
      if (res.status === 200) {
        started = true;
        break;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  if (!started) {
    throw new Error("Serveur E2E non joignable après 3s");
  }

  // 1. Test Static Entrypoint
  const staticRes = await fetch(`${BASE_URL}/`);
  assert.equal(staticRes.status, 200);
  assert.ok(staticRes.headers.get("content-type")?.includes("text/html"));

  // 2. Test Catalog
  const catalogRes = await fetch(`${BASE_URL}/api/courses`);
  assert.equal(catalogRes.status, 200);
  const catalogData = await catalogRes.json();
  assert.equal(catalogData.courses.length, 2);
  assert.equal(catalogData.courses[0].id, "s1-biologie-cellulaire");

  // 3. Création de Chapitre
  const createChapterRes = await fetch(`${BASE_URL}/api/chapter-definitions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subjectId: "s1-biologie-cellulaire",
      title: "Structure des Membranes",
      description: "Organisation lipidique et transport membranaire",
    }),
  });
  assert.equal(createChapterRes.status, 201);
  const chapterData = await createChapterRes.json();
  assert.ok(chapterData.id);
  assert.equal(chapterData.title, "Structure des Membranes");

  // 4. Création d'un Cours avec Transcription et Cartes
  const coursePayload = {
    title: "Structure et Transport Membranaire",
    subjectId: "s1-biologie-cellulaire",
    chapterId: chapterData.id,
    date: "2026-08-25",
    transcription: `Le modèle de la mosaïque fluide a été proposé par Singer et Nicolson en 1972.
Les phospholipides forment une bicouche amphiphile fluide avec têtes hydrophiles et queues hydrophobes.
Le cholestérol joue un rôle de tampon thermique régulant la fluidité membranaire.
Le transport passif s'effectue sans dépense d'énergie selon le gradient de concentration.
Le transport actif nécessite l'hydrolyse d'ATP contre le gradient électrochimique.`,
    cards: [
      {
        id: "card-bio-01",
        question: "Quel est le principe du modèle de la mosaïque fluide ?",
        answer: "Proposé par Singer et Nicolson en 1972 : bicouche lipidique fluide de phospholipides amphiphiles intégrant des protéines mobiles.",
        kind: "definition",
        difficulty: 1,
        source: "Transcription du cours",
        keywords: ["mosaïque fluide", "Singer", "Nicolson", "phospholipides", "bicouche"],
      },
      {
        id: "card-bio-02",
        question: "Quel est le rôle du cholestérol dans la membrane plasmique ?",
        answer: "Il agit comme tampon thermique : stabilise à haute température et empêche la gélification à basse température.",
        kind: "definition",
        difficulty: 2,
        source: "Transcription du cours",
        keywords: ["cholestérol", "tampon thermique", "fluidité"],
      },
    ],
  };

  const createCourseRes = await fetch(`${BASE_URL}/api/study-courses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(coursePayload),
  });
  assert.equal(createCourseRes.status, 201);
  const courseData = await createCourseRes.json();
  assert.ok(courseData.id);
  assert.equal(courseData.recallStatus, "locked"); // Sas de rappel verrouillé
  assert.equal(courseData.status, "a-traiter");

  // Ajout des cartes au cours
  const updateRes = await fetch(`${BASE_URL}/api/study-courses/${encodeURIComponent(courseData.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cards: coursePayload.cards }),
  });
  assert.equal(updateRes.status, 200);
  const updatedCourse = await updateRes.json();
  assert.equal(updatedCourse.cards.length, 2);

  // 5. Sas de Rappel Actif : Déverrouillage par restitution active
  // Tentative avec rappel vide -> doit être refusé
  const emptyRecallRes = await fetch(`${BASE_URL}/api/study-courses/${encodeURIComponent(courseData.id)}/unlock-recall`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recallText: "   " }),
  });
  assert.equal(emptyRecallRes.status, 400);

  // Restitution active solide
  const validRecallRes = await fetch(`${BASE_URL}/api/study-courses/${encodeURIComponent(courseData.id)}/unlock-recall`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recallText: "La membrane est une bicouche lipidique de phospholipides amphiphiles selon le modèle de la mosaïque fluide de Singer et Nicolson. Le cholestérol régule la fluidité thermique. Le transport passif suit le gradient alors que le transport actif consomme de l'ATP.",
    }),
  });
  assert.equal(validRecallRes.status, 200);
  const recallUnlockData = await validRecallRes.json();
  assert.equal(recallUnlockData.course.recallStatus, "unlocked");
  assert.ok(recallUnlockData.course.recallScore > 60);
  assert.ok(recallUnlockData.evaluation.concepts.length > 0);

  // 6. Entraînement Espacé FSRS-5 & Cycle de Révision
  // Révision 1 : Good (3)
  const rev1Res = await fetch(`${BASE_URL}/api/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      courseId: courseData.id,
      cardId: "card-bio-01",
      rating: 3,
      weakConcepts: [
        { id: "concept-mosaique", label: "Mosaïque fluide", status: "mastered" },
      ],
    }),
  });
  assert.equal(rev1Res.status, 201);
  const rev1Data = await rev1Res.json();
  assert.equal(rev1Data.rating, 3);
  assert.equal(rev1Data.reviewCount, 1);
  assert.ok(rev1Data.intervalDays >= 2);
  assert.ok(rev1Data.schedule.stability > 2.0);
  assert.ok(rev1Data.schedule.retrievability <= 1.0);

  // Révision 2 : Easy (4) après quelques jours
  const rev2Res = await fetch(`${BASE_URL}/api/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      courseId: courseData.id,
      cardId: "card-bio-01",
      rating: 4,
      createdAt: new Date(Date.now() + 4 * 86400000).toISOString(),
    }),
  });
  assert.equal(rev2Res.status, 201);
  const rev2Data = await rev2Res.json();
  assert.equal(rev2Data.reviewCount, 2);
  assert.ok(rev2Data.schedule.stability > rev1Data.schedule.stability, "La stabilité doit croître");
  assert.ok(rev2Data.intervalDays > rev1Data.intervalDays, "L'intervalle FSRS doit augmenter");

  // Révision 3 : Again (1) -> signal d'oubli
  const rev3Res = await fetch(`${BASE_URL}/api/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      courseId: courseData.id,
      cardId: "card-bio-02",
      rating: 1,
      weakConcepts: [
        { id: "concept-cholesterol", label: "Rôle du cholestérol", status: "partial", feedback: "Préciser le rôle de tampon" },
      ],
    }),
  });
  assert.equal(rev3Res.status, 201);
  const rev3Data = await rev3Res.json();
  assert.equal(rev3Data.intervalDays, 1); // Reset à 1 jour sur Again
  assert.equal(rev3Data.schedule.lapses, 1);

  // 7. Vérification de l'Agrégation des Faiblesses
  const weaknessesRes = await fetch(`${BASE_URL}/api/weaknesses`);
  assert.equal(weaknessesRes.status, 200);
  const weaknessesData = await weaknessesRes.json();
  assert.ok(weaknessesData.weaknesses.some((w) => w.conceptId === "concept-cholesterol" && w.active));

  // Résolution de la faiblesse par une réussite explicite
  await fetch(`${BASE_URL}/api/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      courseId: courseData.id,
      cardId: "card-bio-02",
      rating: 3,
      weakConcepts: [
        { id: "concept-cholesterol", label: "Rôle du cholestérol", status: "mastered" },
      ],
    }),
  });
  const updatedWeaknessesRes = await fetch(`${BASE_URL}/api/weaknesses`);
  const updatedWeaknessesData = await updatedWeaknessesRes.json();
  assert.equal(
    updatedWeaknessesData.weaknesses.some((w) => w.conceptId === "concept-cholesterol" && w.active),
    false,
    "La faiblesse doit être résolue"
  );

  // 8. Session Adaptative & Planning de Révision
  const adaptiveRes = await fetch(`${BASE_URL}/api/adaptive-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ minutes: 15, subjectId: "s1-biologie-cellulaire" }),
  });
  assert.equal(adaptiveRes.status, 200);
  const adaptiveData = await adaptiveRes.json();
  assert.ok(adaptiveData.requestedMinutes === 15);
  assert.ok(Array.isArray(adaptiveData.items));

  const planRes = await fetch(`${BASE_URL}/api/planning?days=14`);
  assert.equal(planRes.status, 200);
  const planData = await planRes.json();
  assert.equal(planData.days.length, 14);
  assert.ok(typeof planData.summary.totalCards === "number");

  // 9. Synchronisation Mobile avec Photos et Marqueurs
  const fakePhotoBase64 = Buffer.from("data-photo-tableau-amphi").toString("base64");
  const mobileSyncRes = await fetch(`${BASE_URL}/api/mobile/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recordingId: `rec-amphi-${Date.now()}`,
      title: "Cours Amphi 2 - Thermorégulation",
      subjectId: "s1-biologie-cellulaire",
      chapterId: chapterData.id,
      strictChapterSelection: true,
      date: "2026-08-25",
      notes: "Points clés abordés en amphi",
      audioDurationMs: 3600000,
      recordingMarkers: [
        { id: "mark-1", kind: "important", offsetMs: 600000, label: "Schéma bilan" },
      ],
      photos: [
        { id: "photo-tableau-1", filename: "tableau.jpg", mimeType: "image/jpeg", dataBase64: fakePhotoBase64, offsetMs: 600000 },
      ],
      transcript: "Voici la transcription complète de la deuxième séance sur la thermorégulation et les transports passifs et actifs de la cellule.",
    }),
  });
  assert.equal(mobileSyncRes.status, 201);
  const syncData = await mobileSyncRes.json();
  assert.equal(syncData.synced, true);
  assert.equal(syncData.course.photos.length, 1);
  assert.equal(syncData.course.recordingMarkers.length, 1);

  // 10. Stress Test Concurrence : 10 reviews parallèles simultanées
  const parallelReviews = Array.from({ length: 10 }, (_, i) =>
    fetch(`${BASE_URL}/api/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId: courseData.id,
        cardId: "card-bio-01",
        rating: 3,
        createdAt: new Date(Date.now() + (i + 1) * 1000).toISOString(),
      }),
    })
  );
  const parallelResponses = await Promise.all(parallelReviews);
  assert.ok(parallelResponses.every((r) => r.status === 201), "Toutes les requêtes concurrentes doivent réussir");

  const finalReviewsRes = await fetch(`${BASE_URL}/api/reviews`);
  const finalReviews = await finalReviewsRes.json();
  // 1 initiale + 1 easy + 1 again + 1 résolution + 10 parallèles = 14 reviews sans aucune perte
  assert.equal(finalReviews.length, 14, "Aucune review ne doit être écrasée lors d'écritures concurrentes");
});
