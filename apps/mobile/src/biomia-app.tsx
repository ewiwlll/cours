import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  LogBox,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  loadData,
  createSubject,
  createChapter,
  deleteChapter,
  deleteSubject,
  unlockCourseRecall,
  saveReview,
  loadCourseSummary,
  syncRecording,
  getActiveServerUrl,
  getInterleavedTraining,
  getExamTrapsAndErrors,
  evaluateFeynman,
  syncPendingReviews,
  enqueueOfflineReview,
  type Subject,
  type StudyCourse,
  type ChapterDefinition,
  type RecallEvaluation,
  type Card,
  type CoursePhoto,
} from "./api";
import type { LocalRecordingPhoto, RecordingMarker } from "./storage";
import { formatMath, MobileMarkdownViewer } from "./format-math";

LogBox.ignoreAllLogs();

export function CoursApp() {
  const [tab, setTab] = useState<"accueil" | "matieres" | "amphi" | "entrainement" | "planning">("accueil");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<StudyCourse[]>([]);
  const [chapters, setChapters] = useState<ChapterDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  // Cognitive training modes
  const [trainingMode, setTrainingMode] = useState<"standard" | "interleaved" | "traps">("standard");
  const [interleavedCards, setInterleavedCards] = useState<any[]>([]);
  const [trapCards, setTrapCards] = useState<any[]>([]);
  const [isFeynmanOpen, setIsFeynmanOpen] = useState(false);
  const [feynmanText, setFeynmanText] = useState("");
  const [isEvaluatingFeynman, setIsEvaluatingFeynman] = useState(false);
  const [feynmanFeedback, setFeynmanFeedback] = useState<any | null>(null);

  // Subject filtering
  const [semesterFilter, setSemesterFilter] = useState<"all" | "S1" | "S2">("all");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [subjectSubTab, setSubjectSubTab] = useState<"cours" | "flashcards">("cours");
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});

  // Modals for creating Subject & Chapter
  const [showNewSubjectModal, setShowNewSubjectModal] = useState(false);
  const [newSubjectTitle, setNewSubjectTitle] = useState("");
  const [newSubjectSemester, setNewSubjectSemester] = useState<"S1" | "S2">("S1");
  const [newSubjectEcts, setNewSubjectEcts] = useState("6");
  const [newSubjectCategory, setNewSubjectCategory] = useState("Tronc commun");

  const [showNewChapterModal, setShowNewChapterModal] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [targetChapterSubjectId, setTargetChapterSubjectId] = useState("");

  // Course detail modal state
  const [selectedCourse, setSelectedCourse] = useState<StudyCourse | null>(null);
  const [courseTab, setCourseTab] = useState<"fiche" | "concepts" | "boite" | "flashcards">("fiche");
  const [courseContent, setCourseContent] = useState<string>("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [recallText, setRecallText] = useState("");
  const [isSubmittingRecall, setIsSubmittingRecall] = useState(false);
  const [recallResult, setRecallResult] = useState<RecallEvaluation | null>(null);

  // Amphi Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingTitle, setRecordingTitle] = useState("");
  const [recordingSubjectId, setRecordingSubjectId] = useState("");
  const [recordingChapterId, setRecordingChapterId] = useState("");
  const [recordingNotes, setRecordingNotes] = useState("");
  const [recordingMarkers, setRecordingMarkers] = useState<RecordingMarker[]>([]);
  const [recordingPhotos, setRecordingPhotos] = useState<LocalRecordingPhoto[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const timerRef = useRef<any>(null);

  // Flashcards training state
  const [trainingDuration, setTrainingDuration] = useState<5 | 15 | 30>(15);
  const [trainingSubjectFilter, setTrainingSubjectFilter] = useState<string>("all");
  const [trainingIndex, setTrainingIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedQcmOption, setSelectedQcmOption] = useState<number | null>(null);
  const [reviewedTodayCount, setReviewedTodayCount] = useState(0);

  const fetchAppData = async () => {
    setLoading(true);
    try {
      const data = await loadData();
      setSubjects(data.subjects || []);
      setCourses(data.courses || []);
      setChapters(data.chapterDefinitions || []);
      setIsOnline(true);

      if (data.subjects && data.subjects.length > 0 && data.subjects[0]) {
        const firstId = data.subjects[0].id;
        if (!selectedSubjectId || !data.subjects.some((s) => s.id === selectedSubjectId)) {
          setSelectedSubjectId(firstId);
        }
        if (!recordingSubjectId || !data.subjects.some((s) => s.id === recordingSubjectId)) {
          setRecordingSubjectId(firstId);
        }
      }
    } catch (e) {
      console.warn("Failed to load data:", e);
      setIsOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppData();
    const interval = setInterval(() => {
      fetchAppData();
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  // When opening a course, load full markdown sheet if available
  useEffect(() => {
    if (selectedCourse?.summaryFilename) {
      setLoadingContent(true);
      loadCourseSummary(selectedCourse.summaryFilename)
        .then((text) => setCourseContent(text))
        .catch(() => setCourseContent(selectedCourse.notes || "Fiche en cours de traitement."))
        .finally(() => setLoadingContent(false));
    } else {
      setCourseContent(selectedCourse?.notes || "");
    }
  }, [selectedCourse]);

  const filteredSubjects = useMemo(() => {
    if (semesterFilter === "all") return subjects;
    return subjects.filter((s) => s.semester === semesterFilter);
  }, [subjects, semesterFilter]);

  const activeSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId) || filteredSubjects[0] || subjects[0];
  }, [subjects, selectedSubjectId, filteredSubjects]);

  const subjectCourses = useMemo(() => {
    if (!activeSubject) return [];
    return courses.filter((c) => c.subjectId === activeSubject.id);
  }, [courses, activeSubject]);

  const subjectChapters = useMemo(() => {
    if (!activeSubject) return [];
    return chapters.filter((c) => c.subjectId === activeSubject.id);
  }, [chapters, activeSubject]);

  // Group courses by chapter for the active subject
  const coursesByChapter = useMemo(() => {
    const map: Record<string, StudyCourse[]> = {};
    const unassigned: StudyCourse[] = [];

    subjectChapters.forEach((ch) => {
      map[ch.id] = [];
    });

    subjectCourses.forEach((c) => {
      if (c.chapterId && map[c.chapterId]) {
        map[c.chapterId]!.push(c);
      } else {
        unassigned.push(c);
      }
    });

    return { map, unassigned };
  }, [subjectCourses, subjectChapters]);

  const lockedCourses = useMemo(() => {
    return courses.filter((c) => c.recallStatus === "locked");
  }, [courses]);

  const allCards = useMemo(() => {
    const cards: Card[] = [];
    const sourceCourses = trainingSubjectFilter === "all"
      ? courses
      : courses.filter((c) => c.subjectId === trainingSubjectFilter);

    sourceCourses.forEach((c) => {
      if (c.cards) cards.push(...c.cards);
    });
    return cards;
  }, [courses, trainingSubjectFilter]);

  // Handle Amphi Recorder Timer & Actions
  const toggleRecording = async () => {
    if (isRecording) {
      clearInterval(timerRef.current);
      setIsRecording(false);
      setIsSyncing(true);

      const targetSub = subjects.find((s) => s.id === recordingSubjectId) || subjects[0];
      const targetCh = chapters.find((ch) => ch.id === recordingChapterId);
      const title = recordingTitle.trim() || `Cours du ${new Date().toISOString().split("T")[0]}`;

      try {
        await syncRecording({
          id: `mobile-rec-${Date.now()}`,
          title,
          subjectId: targetSub?.id || "s1-biomolecules",
          subjectTitle: targetSub?.title || "Matière",
          chapter: targetCh?.title || undefined,
          chapterId: targetCh?.id || undefined,
          date: new Date().toISOString().slice(0, 10),
          uri: "",
          mimeType: "audio/m4a",
          notes: recordingNotes,
          recordingMarkers,
          photos: recordingPhotos,
          audioDurationMs: recordingSeconds * 1000,
          status: "synchronise",
        });

        Alert.alert(
          "🎉 Enregistrement transmis !",
          `Le cours "${title}" (${Math.floor(recordingSeconds / 60)}m ${recordingSeconds % 60}s) a été transmis au serveur Mac.\n\nTranscription Whisper et génération IA en cours !`
        );
        setRecordingTitle("");
        setRecordingNotes("");
        setRecordingMarkers([]);
        setRecordingPhotos([]);
        setRecordingSeconds(0);
        fetchAppData();
      } catch (err: any) {
        Alert.alert(
          "Enregistrement terminé",
          `Durée : ${Math.floor(recordingSeconds / 60)}m ${recordingSeconds % 60}s.\nLe cours est sauvegardé localement et sera synchronisé dès la reconnexion au Mac.`
        );
      } finally {
        setIsSyncing(false);
      }
    } else {
      setRecordingSeconds(0);
      setRecordingMarkers([]);
      setRecordingPhotos([]);
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    }
  };

  const addMarker = (kind: "important" | "unclear" | "example" | "question", label: string) => {
    if (!isRecording) return;
    const newMarker: RecordingMarker = {
      id: `marker-${Date.now()}`,
      kind,
      label,
      offsetMs: recordingSeconds * 1000,
      createdAt: new Date().toISOString(),
    };
    setRecordingMarkers((prev) => [...prev, newMarker]);
  };

  const takeBlackboardPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission requise", "Autorisez l accès à l appareil photo pour photographier le tableau.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        const photo: LocalRecordingPhoto = {
          id: `photo-${Date.now()}`,
          uri: result.assets[0].uri,
          name: `tableau-${Date.now()}.jpg`,
          mimeType: "image/jpeg",
          offsetMs: recordingSeconds * 1000,
        };
        setRecordingPhotos((prev) => [...prev, photo]);
      }
    } catch (e) {
      console.warn("Photo error:", e);
    }
  };

  // Handle Active Recall Unlock
  const handleUnlockRecall = async () => {
    if (!selectedCourse) return;
    if (recallText.trim().length < 5) {
      Alert.alert("Rappel trop court", "Veuillez écrire les notions, formules ou définitions dont vous vous souvenez.");
      return;
    }
    setIsSubmittingRecall(true);
    try {
      const res = await unlockCourseRecall(selectedCourse.id, recallText.trim());
      setRecallResult(res.evaluation);
      setSelectedCourse(res.course);
      fetchAppData();
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible d évaluer le rappel pour le moment.");
    } finally {
      setIsSubmittingRecall(false);
    }
  };

  // When training mode changes, load specific cards
  useEffect(() => {
    setTrainingIndex(0);
    setShowAnswer(false);
    setSelectedQcmOption(null);
    setIsFeynmanOpen(false);
    setFeynmanText("");
    setFeynmanFeedback(null);

    if (trainingMode === "interleaved") {
      getInterleavedTraining(15).then((items) => setInterleavedCards(items || []));
    } else if (trainingMode === "traps") {
      getExamTrapsAndErrors().then((items) => setTrapCards(items || []));
    }
  }, [trainingMode]);

  const activeTrainingCards = useMemo(() => {
    if (trainingMode === "interleaved") return interleavedCards;
    if (trainingMode === "traps") return trapCards;
    return allCards;
  }, [trainingMode, interleavedCards, trapCards, allCards]);

  // Handle Feynman 60s Evaluation
  const handleEvaluateFeynman = async () => {
    const card = activeTrainingCards[trainingIndex];
    if (!card || !feynmanText.trim()) return;
    setIsEvaluatingFeynman(true);
    try {
      const courseId = card.courseId || courses.find((c) => c.cards?.some((cd) => cd.id === card.id))?.id || "";
      const result = await evaluateFeynman(courseId, card.id, feynmanText.trim());
      setFeynmanFeedback(result);
    } catch (e) {
      console.warn("Feynman evaluation error:", e);
    } finally {
      setIsEvaluatingFeynman(false);
    }
  };

  // Handle FSRS-5 Rating (Offline-First)
  const handleRateCard = async (rating: number) => {
    const cardList = activeTrainingCards;
    if (!cardList || cardList.length === 0) return;
    const card = cardList[trainingIndex];
    if (!card) return;

    const payload = {
      courseId: card.courseId || courses.find((c) => c.cards?.some((cd) => cd.id === card.id))?.id,
      cardId: card.id,
      rating,
      createdAt: new Date().toISOString(),
    };

    // Enqueue locally first
    await enqueueOfflineReview(payload);

    // Try online sync in background
    saveReview(payload).catch(() => {});

    setShowAnswer(false);
    setSelectedQcmOption(null);
    setIsFeynmanOpen(false);
    setFeynmanText("");
    setFeynmanFeedback(null);
    setReviewedTodayCount((prev) => prev + 1);
    setTrainingIndex((prev) => (prev + 1) % cardList.length);
  };

  // Create Subject Handler
  const handleCreateSubject = async () => {
    if (!newSubjectTitle.trim()) {
      Alert.alert("Titre requis", "Veuillez renseigner le nom de la matière.");
      return;
    }
    try {
      await createSubject({
        title: newSubjectTitle.trim(),
        semester: newSubjectSemester,
        category: newSubjectCategory,
        ects: parseInt(newSubjectEcts, 10) || 3,
      });
      setNewSubjectTitle("");
      setShowNewSubjectModal(false);
      fetchAppData();
      Alert.alert("Succès", `La matière "${newSubjectTitle}" a été créée.`);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible de créer la matière.");
    }
  };

  // Create Chapter Handler
  const handleCreateChapter = async () => {
    if (!newChapterTitle.trim()) {
      Alert.alert("Titre requis", "Veuillez renseigner le nom du chapitre.");
      return;
    }
    const subId = targetChapterSubjectId || selectedSubjectId || (subjects[0]?.id ?? "");
    try {
      await createChapter(subId, newChapterTitle.trim());
      setNewChapterTitle("");
      setShowNewChapterModal(false);
      fetchAppData();
      Alert.alert("Succès", `Le chapitre "${newChapterTitle}" a été créé.`);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible de créer le chapitre.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

      {/* TOP BAR */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoLetter}>C</Text>
          </View>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.brandTitle}>Cours</Text>
              <View style={styles.tagBioMIA}>
                <Text style={styles.tagBioMIAText}>OS</Text>
              </View>
            </View>
            <Text style={styles.brandSubtitle}>Active Recall & FSRS-5</Text>
          </View>
        </View>

        <View style={styles.topRightActions}>
          <View style={[styles.statusBadge, !isOnline && { backgroundColor: "rgba(245,158,11,0.15)", borderColor: "rgba(245,158,11,0.3)" }]}>
            <View style={[styles.statusDot, !isOnline && { backgroundColor: "#f59e0b" }]} />
            <Text style={[styles.statusText, !isOnline && { color: "#f59e0b" }]}>
              {isOnline ? "Connecté · Synchro auto" : "Mode local"}
            </Text>
          </View>
        </View>
      </View>

      {/* MAIN VIEW CONTENT */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Chargement de vos cours...</Text>
        </View>
      ) : (
        <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentScrollContainer}>
          {/* TAB 1: ACCUEIL / DASHBOARD */}
          {tab === "accueil" && (
            <View style={styles.tabContent}>
              {/* GUIDE RAPIDE */}
              <View style={styles.guideCard}>
                <Text style={styles.guideTitle}>🚀 Méthode de Révision Active</Text>
                <Text style={styles.guideSubtitle}>
                  1. Enregistre en amphi  •  2. Débloque par ton rappel  •  3. Révise à ton rythme avec FSRS-5
                </Text>
              </View>

              {/* MISSION DU SOIR / RAPPEL ACTIF */}
              {lockedCourses.length > 0 ? (
                <View style={styles.missionCard}>
                  <View style={styles.missionHeader}>
                    <Text style={styles.missionBadge}>🎯 Mission du soir</Text>
                    <Text style={styles.missionCount}>{lockedCourses.length} à débloquer</Text>
                  </View>
                  <Text style={styles.missionTitle}>🔒 {lockedCourses[0]?.title || "Cours à déverrouiller"}</Text>
                  <Text style={styles.missionDesc}>
                    Fais ton premier rappel actif pour débloquer la fiche et tes flashcards.
                  </Text>
                  <Pressable
                    style={styles.unlockPrimaryBtn}
                    onPress={() => {
                      setSelectedCourse(lockedCourses[0] || null);
                      setCourseTab("fiche");
                      setRecallText("");
                      setRecallResult(null);
                    }}
                  >
                    <Text style={styles.unlockPrimaryBtnText}>⚡ Déverrouiller le cours</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.allDoneCard}>
                  <Text style={styles.allDoneIcon}>✨</Text>
                  <Text style={styles.allDoneTitle}>Toutes tes fiches sont débloquées !</Text>
                  <Text style={styles.allDoneDesc}>Passe en mode Entraînement pour réviser tes flashcards.</Text>
                </View>
              )}

              {/* STATS RAPIDES */}
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{courses.length}</Text>
                  <Text style={styles.statLabel}>Cours enregistrés</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statNumber, { color: "#22c55e" }]}>{allCards.length}</Text>
                  <Text style={styles.statLabel}>Flashcards FSRS-5</Text>
                </View>
              </View>

              {/* ACTION RAPIDE: LANCER SESSION */}
              <Pressable
                onPress={() => setTab("entrainement")}
                style={styles.quickLaunchBtn}
              >
                <Text style={styles.quickLaunchBtnText}>⚡ Démarrer mes révisions FSRS-5</Text>
              </Pressable>

              {/* DERNIERS COURS AJOUTÉS */}
              <Text style={styles.sectionHeaderTitle}>Derniers cours ajoutés</Text>
              {courses.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>Aucun cours pour l instant. Enregistre ton premier cours dans l onglet Amphi !</Text>
                </View>
              ) : (
                [...courses]
                  .sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime())
                  .slice(0, 6)
                  .map((c) => (
                    <Pressable
                      key={c.id}
                      style={styles.courseItemCard}
                      onPress={() => {
                        setSelectedCourse(c);
                        setCourseTab("fiche");
                        setRecallText("");
                        setRecallResult(null);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.courseItemTitle}>{c.title}</Text>
                        <Text style={styles.courseItemMeta}>
                          {c.subjectTitle || "Matière"} • {c.date} • {c.cards?.length || 0} cartes
                        </Text>
                      </View>
                      {c.recallStatus === "locked" ? (
                        <View style={styles.lockedPill}>
                          <Text style={styles.lockedPillText}>🔒 Verrouillé</Text>
                        </View>
                      ) : (
                        <View style={styles.unlockedPill}>
                          <Text style={styles.unlockedPillText}>✓ Prêt</Text>
                        </View>
                      )}
                    </Pressable>
                  ))
              )}
            </View>
          )}

          {/* TAB 2: MATIÈRES (PARITÉ WEB TOTALE) */}
          {tab === "matieres" && (
            <View style={styles.tabContent}>
              {/* FILTRES SEMESTRE & AJOUT MATIÈRE */}
              <View style={styles.filterSection}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <View style={styles.semesterRow}>
                    {(["all", "S1", "S2"] as const).map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => setSemesterFilter(s)}
                        style={[styles.semesterBtn, semesterFilter === s && styles.semesterBtnActive]}
                      >
                        <Text style={[styles.semesterBtnText, semesterFilter === s && styles.semesterBtnTextActive]}>
                          {s === "all" ? "Tous" : s}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable
                    onPress={() => setShowNewSubjectModal(true)}
                    style={styles.addSubjectSmallBtn}
                  >
                    <Text style={styles.addSubjectSmallBtnText}>+ Matière</Text>
                  </Pressable>
                </View>

                {/* HORIZONTAL SUBJECT PILLS */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
                  {filteredSubjects.map((sub) => {
                    const isSelected = activeSubject?.id === sub.id;
                    return (
                      <Pressable
                        key={sub.id}
                        onPress={() => setSelectedSubjectId(sub.id)}
                        style={[styles.subjectPill, isSelected && styles.subjectPillActive]}
                      >
                        <Text style={[styles.subjectPillBadge, isSelected && styles.subjectPillBadgeActive]}>
                          {sub.semester}
                        </Text>
                        <Text style={[styles.subjectPillText, isSelected && styles.subjectPillTextActive]}>
                          {sub.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* ACTIVE SUBJECT HERO */}
              {activeSubject && (
                <View style={styles.subjectHeroCard}>
                  <View style={styles.subjectBadgesRow}>
                    <Text style={styles.subjectBadge}>{activeSubject.semester}</Text>
                    <Text style={styles.subjectBadge}>{activeSubject.ects} ECTS</Text>
                    <Text style={styles.subjectCategory}>{activeSubject.category || "Tronc commun"}</Text>
                  </View>
                  <Text style={styles.subjectHeroTitle}>{activeSubject.title}</Text>
                  <Text style={styles.subjectHeroStats}>
                    📚 {subjectCourses.length} cours • 🧠 {subjectCourses.reduce((acc, c) => acc + (c.cards?.length || 0), 0)} flashcards
                  </Text>

                  {/* SUB-TABS: COURS VS FLASHCARDS */}
                  <View style={styles.subTabRow}>
                    <Pressable
                      onPress={() => setSubjectSubTab("cours")}
                      style={[styles.subTabBtn, subjectSubTab === "cours" && styles.subTabBtnActive]}
                    >
                      <Text style={[styles.subTabBtnText, subjectSubTab === "cours" && styles.subTabBtnTextActive]}>
                        Cours & Chapitres ({subjectCourses.length})
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setSubjectSubTab("flashcards")}
                      style={[styles.subTabBtn, subjectSubTab === "flashcards" && styles.subTabBtnActive]}
                    >
                      <Text style={[styles.subTabBtnText, subjectSubTab === "flashcards" && styles.subTabBtnTextActive]}>
                        Flashcards ({subjectCourses.reduce((acc, c) => acc + (c.cards?.length || 0), 0)})
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* SOUS-ONGLET: COURS & CHAPITRES */}
              {subjectSubTab === "cours" && activeSubject && (
                <View style={{ marginTop: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <Text style={styles.sectionHeaderTitle}>Chapitres ({subjectChapters.length})</Text>
                    <Pressable
                      onPress={() => {
                        setTargetChapterSubjectId(activeSubject.id);
                        setShowNewChapterModal(true);
                      }}
                      style={styles.addChapterBtn}
                    >
                      <Text style={styles.addChapterBtnText}>+ Nouveau chapitre</Text>
                    </Pressable>
                  </View>

                  {subjectChapters.length === 0 && subjectCourses.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyText}>Aucun chapitre créé dans cette matière.</Text>
                      <Pressable
                        onPress={() => {
                          setTargetChapterSubjectId(activeSubject.id);
                          setShowNewChapterModal(true);
                        }}
                        style={[styles.addChapterBtn, { alignSelf: "center", marginTop: 8 }]}
                      >
                        <Text style={styles.addChapterBtnText}>+ Créer le Chapitre 1</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {/* LISTE DES CHAPITRES AVEC ACCORDÉON */}
                  {subjectChapters.map((chap, idx) => {
                    const chapCourses = coursesByChapter.map[chap.id] || [];
                    const isCollapsed = collapsedChapters[chap.id];

                    return (
                      <View key={chap.id} style={styles.chapterCard}>
                        <Pressable
                          onPress={() =>
                            setCollapsedChapters((prev) => ({ ...prev, [chap.id]: !prev[chap.id] }))
                          }
                          style={styles.chapterHeader}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.chapterBadge}>Chapitre {idx + 1}</Text>
                            <Text style={styles.chapterTitle}>{chap.title}</Text>
                          </View>
                          <Text style={styles.chapterCount}>
                            {chapCourses.length} cours  {isCollapsed ? "▼" : "▲"}
                          </Text>
                        </Pressable>

                        {!isCollapsed && (
                          <View style={styles.chapterBody}>
                            {chapCourses.length === 0 ? (
                              <Text style={styles.emptyChapterText}>Aucun cours dans ce chapitre.</Text>
                            ) : (
                              chapCourses.map((c) => (
                                <Pressable
                                  key={c.id}
                                  onPress={() => {
                                    setSelectedCourse(c);
                                    setCourseTab("fiche");
                                    setRecallText("");
                                    setRecallResult(null);
                                  }}
                                  style={styles.chapterCourseRow}
                                >
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.chapterCourseTitle}>
                                      {c.partLabel ? `[${c.partLabel}] ` : ""}{c.title}
                                    </Text>
                                    <Text style={styles.chapterCourseMeta}>{c.date} • {c.cards?.length || 0} cartes</Text>
                                  </View>
                                  {c.recallStatus === "locked" ? (
                                    <Text style={styles.lockedMini}>🔒 Verrouillé</Text>
                                  ) : (
                                    <Text style={styles.unlockedMini}>✓ Prêt</Text>
                                  )}
                                </Pressable>
                              ))
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {/* COURS NON CLASSÉS */}
                  {coursesByChapter.unassigned.length > 0 && (
                    <View style={styles.chapterCard}>
                      <View style={styles.chapterHeader}>
                        <Text style={styles.chapterTitle}>Séances libres / À classer</Text>
                        <Text style={styles.chapterCount}>{coursesByChapter.unassigned.length} cours</Text>
                      </View>
                      <View style={styles.chapterBody}>
                        {coursesByChapter.unassigned.map((c) => (
                          <Pressable
                            key={c.id}
                            onPress={() => {
                              setSelectedCourse(c);
                              setCourseTab("fiche");
                              setRecallText("");
                              setRecallResult(null);
                            }}
                            style={styles.chapterCourseRow}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.chapterCourseTitle}>{c.title}</Text>
                              <Text style={styles.chapterCourseMeta}>{c.date} • {c.cards?.length || 0} cartes</Text>
                            </View>
                            {c.recallStatus === "locked" ? (
                              <Text style={styles.lockedMini}>🔒 Verrouillé</Text>
                            ) : (
                              <Text style={styles.unlockedMini}>✓ Prêt</Text>
                            )}
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* SOUS-ONGLET: FLASHCARDS DE LA MATIÈRE */}
              {subjectSubTab === "flashcards" && activeSubject && (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.sectionHeaderTitle}>
                    Flashcards de {activeSubject.title}
                  </Text>
                  {subjectCourses.flatMap((c) => c.cards || []).length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyText}>Aucune flashcard enregistrée dans cette matière.</Text>
                    </View>
                  ) : (
                    subjectCourses.flatMap((c) => (c.cards || []).map((card) => ({ card, courseTitle: c.title }))).map(({ card, courseTitle }, idx) => (
                      <View key={card.id || idx} style={styles.flashcardInspectCard}>
                        <Text style={styles.flashcardCourseTag}>{courseTitle} • {card.kind || "Notion"}</Text>
                        <Text style={styles.flashcardQuestion}>{card.question}</Text>
                        <View style={styles.flashcardAnswerBox}>
                          <Text style={styles.flashcardAnswerLabel}>Réponse :</Text>
                          <Text style={styles.flashcardAnswerText}>{card.answer}</Text>
                          {card.trap ? (
                            <Text style={styles.flashcardTrapText}>⚠️ Piège : {card.trap}</Text>
                          ) : null}
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          )}

          {/* TAB 3: AMPHI RECORDER STUDIO */}
          {tab === "amphi" && (
            <View style={styles.tabContent}>
              <View style={styles.recorderStudioCard}>
                <Text style={styles.studioHeaderTitle}>🎙️ Studio Amphi Cours</Text>
                <Text style={styles.studioHeaderSubtitle}>
                  Enregistre le prof en direct, pose tes balises d attention et prends des photos du tableau.
                </Text>

                {/* FORM FIELDS FOR NEW RECORDING */}
                {!isRecording && (
                  <View style={styles.recorderForm}>
                    <Text style={styles.fieldLabel}>Titre du cours / sujet abordé :</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Ex: Structure et Transport Membranaire"
                      placeholderTextColor="#71717a"
                      value={recordingTitle}
                      onChangeText={setRecordingTitle}
                    />

                    {/* SÉLECTEUR DE MATIÈRE */}
                    <Text style={styles.fieldLabel}>Matière :</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row", marginVertical: 4 }}>
                      {subjects.map((s) => (
                        <Pressable
                          key={s.id}
                          onPress={() => {
                            setRecordingSubjectId(s.id);
                            setRecordingChapterId("");
                          }}
                          style={[styles.smallSubjectPill, recordingSubjectId === s.id && styles.smallSubjectPillActive]}
                        >
                          <Text style={[styles.smallSubjectPillText, recordingSubjectId === s.id && styles.smallSubjectPillTextActive]}>
                            {s.title}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    {/* SÉLECTEUR DE CHAPITRE */}
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                      <Text style={styles.fieldLabel}>Chapitre cible :</Text>
                      <Pressable
                        onPress={() => {
                          setTargetChapterSubjectId(recordingSubjectId || subjects[0]?.id || "");
                          setShowNewChapterModal(true);
                        }}
                      >
                        <Text style={{ color: "#60a5fa", fontSize: 12, fontWeight: "600" }}>+ Créer chapitre</Text>
                      </Pressable>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row", marginVertical: 4 }}>
                      <Pressable
                        onPress={() => setRecordingChapterId("")}
                        style={[styles.smallSubjectPill, !recordingChapterId && styles.smallSubjectPillActive]}
                      >
                        <Text style={[styles.smallSubjectPillText, !recordingChapterId && styles.smallSubjectPillTextActive]}>
                          (Séance libre / Sans chapitre)
                        </Text>
                      </Pressable>
                      {chapters
                        .filter((ch) => ch.subjectId === recordingSubjectId)
                        .map((ch) => (
                          <Pressable
                            key={ch.id}
                            onPress={() => setRecordingChapterId(ch.id)}
                            style={[styles.smallSubjectPill, recordingChapterId === ch.id && styles.smallSubjectPillActive]}
                          >
                            <Text style={[styles.smallSubjectPillText, recordingChapterId === ch.id && styles.smallSubjectPillTextActive]}>
                              {ch.title}
                            </Text>
                          </Pressable>
                        ))}
                    </ScrollView>

                    {/* CALCUL AUTOMATIQUE DE PHASE */}
                    {recordingChapterId ? (
                      <View style={styles.phasePreviewBadge}>
                        <Text style={styles.phasePreviewText}>
                          ✨ Ce cours sera enregistré comme Phase {(courses.filter((c) => c.chapterId === recordingChapterId).length + 1)} de ce chapitre.
                        </Text>
                      </View>
                    ) : null}

                    {/* NOTES RAPIDES */}
                    <Text style={styles.fieldLabel}>Notes ou mots-clés du tableau :</Text>
                    <TextInput
                      style={[styles.formInput, { height: 60, textAlignVertical: "top" }]}
                      multiline
                      placeholder="Ex: Formule de fluidité, Singer & Nicolson 1972..."
                      placeholderTextColor="#71717a"
                      value={recordingNotes}
                      onChangeText={setRecordingNotes}
                    />
                  </View>
                )}

                {/* TIMER & STATUS */}
                <View style={styles.timerContainer}>
                  <Text style={styles.timerDisplay}>
                    {Math.floor(recordingSeconds / 60).toString().padStart(2, "0")}:
                    {(recordingSeconds % 60).toString().padStart(2, "0")}
                  </Text>
                  <Text style={styles.recordingStatusText}>
                    {isRecording ? "🔴 Enregistrement amphi en cours..." : "Prêt à enregistrer"}
                  </Text>
                </View>

                {/* RECORD TOGGLE BUTTON */}
                <Pressable
                  onPress={toggleRecording}
                  disabled={isSyncing}
                  style={[styles.bigRecordBtn, isRecording ? styles.bigRecordBtnActive : styles.bigRecordBtnIdle]}
                >
                  {isSyncing ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.bigRecordBtnText}>
                      {isRecording ? "⏹ Arrêter & Transmettre au Mac" : "🎙 Démarrer l enregistrement"}
                    </Text>
                  )}
                </Pressable>

                {/* LIVE ATTENTION MARKERS & CAMERA SNAP */}
                {isRecording && (
                  <View style={styles.markersBox}>
                    <Text style={styles.markersBoxTitle}>Poser une balise en direct :</Text>
                    <View style={styles.markerButtonsGrid}>
                      <Pressable onPress={() => addMarker("important", "Important")} style={[styles.markerBtn, { borderColor: "#f59e0b" }]}>
                        <Text style={styles.markerBtnText}>🔥 Important</Text>
                      </Pressable>
                      <Pressable onPress={() => addMarker("question", "Piège exam")} style={[styles.markerBtn, { borderColor: "#a855f7" }]}>
                        <Text style={styles.markerBtnText}>⚠️ Piège exam</Text>
                      </Pressable>
                      <Pressable onPress={() => addMarker("example", "Exemple")} style={[styles.markerBtn, { borderColor: "#22c55e" }]}>
                        <Text style={styles.markerBtnText}>💡 Exemple</Text>
                      </Pressable>
                      <Pressable onPress={() => addMarker("unclear", "Pas compris")} style={[styles.markerBtn, { borderColor: "#ef4444" }]}>
                        <Text style={styles.markerBtnText}>❓ Pas compris</Text>
                      </Pressable>
                    </View>

                    {/* PHOTO DU TABLEAU EN DIRECT */}
                    <Pressable onPress={takeBlackboardPhoto} style={styles.photoCaptureBtn}>
                      <Text style={styles.photoCaptureBtnText}>📸 Photographier le tableau</Text>
                    </Pressable>

                    {/* STATS DES ÉLÉMENTS CAPTURÉS */}
                    <View style={styles.liveSummaryRow}>
                      <Text style={styles.liveSummaryText}>
                        📍 {recordingMarkers.length} balises  •  📷 {recordingPhotos.length} photos
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* TAB 4: ENTRAÎNEMENT FSRS-5 (ADAPTATIF ET CIBLÉ) */}
          {tab === "entrainement" && (
            <View style={styles.tabContent}>
              <View style={styles.trainingHeaderRow}>
                <Text style={styles.sectionHeaderTitle}>⚡ Entraînement FSRS-5</Text>
                <Text style={styles.reviewedCountBadge}>{reviewedTodayCount} révisées aujourd hui</Text>
              </View>

              {/* 3 SOUS-MODES COGNITIFS (PARITÉ TOTALE WEB/MOBILE) */}
              <View style={styles.cognitiveModeRow}>
                <Pressable
                  onPress={() => setTrainingMode("standard")}
                  style={[styles.cognitiveModePill, trainingMode === "standard" && styles.cognitiveModePillActive]}
                >
                  <Text style={[styles.cognitiveModeText, trainingMode === "standard" && styles.cognitiveModeTextActive]}>
                    ⚡ Standard
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setTrainingMode("interleaved")}
                  style={[styles.cognitiveModePill, trainingMode === "interleaved" && { backgroundColor: "#2563eb", borderColor: "#2563eb" }]}
                >
                  <Text style={[styles.cognitiveModeText, trainingMode === "interleaved" && styles.cognitiveModeTextActive]}>
                    🔀 Panachée ({interleavedCards.length || "15"})
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setTrainingMode("traps")}
                  style={[styles.cognitiveModePill, trainingMode === "traps" && { backgroundColor: "#f43f5e", borderColor: "#f43f5e" }]}
                >
                  <Text style={[styles.cognitiveModeText, trainingMode === "traps" && styles.cognitiveModeTextActive]}>
                    ⚠️ Pièges ({trapCards.length})
                  </Text>
                </Pressable>
              </View>

              {/* BANDEAU EXPLICATIF DU SOUS-MODE COGNITIF */}
              <View style={styles.cognitiveExplainBanner}>
                <Text style={styles.cognitiveExplainIcon}>
                  {trainingMode === "standard" ? "⚡" : trainingMode === "interleaved" ? "🔀" : "⚠️"}
                </Text>
                <Text style={styles.cognitiveExplainText}>
                  {trainingMode === "standard"
                    ? "Répétition espacée FSRS-5 : révise tes cartes au moment optimal avant l'oubli. Révise librement à ton rythme."
                    : trainingMode === "interleaved"
                    ? "Séance Panachée : entrelace les matières (Bio, Maths, Physique...) pour muscler ton agilité mentale."
                    : "Carnet de Pièges : concentre-toi sur tes erreurs récentes et les pièges d'examen signalés par le prof."}
                </Text>
              </View>

              {/* FILTRE PAR MATIÈRE (EN MODE STANDARD) */}
              {trainingMode === "standard" && (
                <View style={styles.trainingConfigCard}>
                  <Text style={styles.fieldLabel}>Filtrer par matière :</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row", marginTop: 4 }}>
                    <Pressable
                      onPress={() => setTrainingSubjectFilter("all")}
                      style={[styles.smallSubjectPill, trainingSubjectFilter === "all" && styles.smallSubjectPillActive]}
                    >
                      <Text style={[styles.smallSubjectPillText, trainingSubjectFilter === "all" && styles.smallSubjectPillTextActive]}>
                        Toutes les matières
                      </Text>
                    </Pressable>
                    {subjects.map((s) => (
                      <Pressable
                        key={s.id}
                        onPress={() => setTrainingSubjectFilter(s.id)}
                        style={[styles.smallSubjectPill, trainingSubjectFilter === s.id && styles.smallSubjectPillActive]}
                      >
                        <Text style={[styles.smallSubjectPillText, trainingSubjectFilter === s.id && styles.smallSubjectPillTextActive]}>
                          {s.title}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {activeTrainingCards.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>
                    {trainingMode === "traps"
                      ? "Aucun piège d'examen ni carte en difficulté pour le moment. Félicitations !"
                      : "Aucune flashcard disponible dans ce périmètre."}
                  </Text>
                </View>
              ) : (
                <View style={styles.cardTrainingBox}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardProgressText}>Carte {trainingIndex + 1} / {activeTrainingCards.length}</Text>
                    <Text style={[styles.cardTag, trainingMode === "traps" && { color: "#f43f5e" }]}>
                      {activeTrainingCards[trainingIndex]?.subjectTitle || activeTrainingCards[trainingIndex]?.kind || (trainingMode === "traps" ? "Piège exam" : "Flashcard")}
                    </Text>
                  </View>

                  <Text style={styles.cardQuestionText}>{activeTrainingCards[trainingIndex]?.question}</Text>

                  {/* QCM OPTIONS IF AVAILABLE */}
                  {activeTrainingCards[trainingIndex]?.options && activeTrainingCards[trainingIndex]!.options!.length > 0 && !showAnswer && (
                    <View style={styles.qcmContainer}>
                      {activeTrainingCards[trainingIndex]!.options!.map((opt: any, idx: number) => {
                        const optText = typeof opt === "string" ? opt : opt.text || opt.label || "";
                        const isSelected = selectedQcmOption === idx;
                        return (
                          <Pressable
                            key={idx}
                            onPress={() => setSelectedQcmOption(idx)}
                            style={[styles.qcmOptionBtn, isSelected && styles.qcmOptionBtnSelected]}
                          >
                            <Text style={styles.qcmLetter}>{String.fromCharCode(65 + idx)}.</Text>
                            <Text style={[styles.qcmOptionText, isSelected && styles.qcmOptionTextSelected]}>
                              {optText}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}

                  {showAnswer ? (
                    <View style={styles.answerBox}>
                      <Text style={styles.answerLabel}>RÉPONSE MODÈLE :</Text>
                      <Text style={styles.answerText}>{activeTrainingCards[trainingIndex]?.answer}</Text>
                      
                      {activeTrainingCards[trainingIndex]?.trap ? (
                        <View style={styles.trapBox}>
                          <Text style={styles.trapLabel}>⚠️ Piège exam :</Text>
                          <Text style={styles.trapText}>{activeTrainingCards[trainingIndex]?.trap}</Text>
                        </View>
                      ) : null}

                      {/* DUAL CODING : PHOTO DU TABLEAU SI DISPONIBLE */}
                      {(() => {
                        const card = activeTrainingCards[trainingIndex];
                        const parent = courses.find((c) => c.id === card?.courseId || c.cards?.some((cd) => cd.id === card?.id));
                        const photo = parent?.photos?.[0];
                        if (!photo) return null;
                        const photoUri = photo.url ? (photo.url.startsWith("http") ? photo.url : `${getActiveServerUrl()}${photo.url}`) : null;
                        if (!photoUri) return null;
                        return (
                          <View style={styles.dualCodingBox}>
                            <Text style={styles.dualCodingLabel}>📷 Photo du tableau (Double codage) :</Text>
                            <Image source={{ uri: photoUri }} style={styles.dualCodingImg} resizeMode="contain" />
                          </View>
                        );
                      })()}

                      {/* DÉFI FEYNMAN 60S */}
                      <View style={styles.feynmanCard}>
                        {!isFeynmanOpen ? (
                          <Pressable onPress={() => setIsFeynmanOpen(true)} style={styles.feynmanToggleBtn}>
                            <Text style={styles.feynmanToggleBtnText}>🧠 Défi Feynman : Explique en 60s (IA)</Text>
                          </Pressable>
                        ) : (
                          <View style={styles.feynmanExpandedBox}>
                            <View style={styles.feynmanHeaderRow}>
                              <Text style={styles.feynmanTitle}>🧠 Défi Feynman : Pourquoi & Comment ?</Text>
                              <Pressable onPress={() => setIsFeynmanOpen(false)}>
                                <Text style={styles.feynmanCloseText}>✕</Text>
                              </Pressable>
                            </View>
                            <TextInput
                              value={feynmanText}
                              onChangeText={setFeynmanText}
                              placeholder="Explique le mécanisme avec tes propres mots..."
                              placeholderTextColor="#71717a"
                              multiline
                              numberOfLines={3}
                              style={styles.feynmanInput}
                            />
                            <Pressable
                              onPress={handleEvaluateFeynman}
                              disabled={isEvaluatingFeynman || !feynmanText.trim()}
                              style={[styles.feynmanSubmitBtn, (!feynmanText.trim() || isEvaluatingFeynman) && { opacity: 0.5 }]}
                            >
                              {isEvaluatingFeynman ? (
                                <ActivityIndicator color="#09090b" size="small" />
                              ) : (
                                <Text style={styles.feynmanSubmitBtnText}>⚡ Évaluer mon explication</Text>
                              )}
                            </Pressable>

                            {feynmanFeedback && (
                              <View style={styles.feynmanFeedbackBox}>
                                <View style={styles.feynmanScoreRow}>
                                  <Text style={styles.feynmanScoreText}>Score : {feynmanFeedback.score}/100</Text>
                                  <Text style={styles.feynmanCausalText}>Causalité : {feynmanFeedback.causalScore}%</Text>
                                </View>
                                <Text style={styles.feynmanFeedbackText}>{feynmanFeedback.feedback}</Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>

                      {/* 4 FSRS-5 RATING BUTTONS */}
                      <Text style={styles.ratingPrompt}>Comment as-tu trouvé cette carte ?</Text>
                      <View style={styles.ratingGrid}>
                        <Pressable onPress={() => handleRateCard(1)} style={[styles.ratingBtn, { backgroundColor: "#ef4444" }]}>
                          <Text style={styles.ratingBtnText}>À revoir</Text>
                          <Text style={styles.ratingSubText}>1 j</Text>
                        </Pressable>
                        <Pressable onPress={() => handleRateCard(2)} style={[styles.ratingBtn, { backgroundColor: "#f59e0b" }]}>
                          <Text style={styles.ratingBtnText}>Difficile</Text>
                          <Text style={styles.ratingSubText}>3 j</Text>
                        </Pressable>
                        <Pressable onPress={() => handleRateCard(3)} style={[styles.ratingBtn, { backgroundColor: "#3b82f6" }]}>
                          <Text style={styles.ratingBtnText}>Correct</Text>
                          <Text style={styles.ratingSubText}>6 j</Text>
                        </Pressable>
                        <Pressable onPress={() => handleRateCard(4)} style={[styles.ratingBtn, { backgroundColor: "#22c55e" }]}>
                          <Text style={styles.ratingBtnText}>Facile</Text>
                          <Text style={styles.ratingSubText}>12 j</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable onPress={() => setShowAnswer(true)} style={styles.showAnswerBtn}>
                      <Text style={styles.showAnswerBtnText}>👀 Révéler la réponse</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          )}

          {/* TAB 5: PLANNING (CALENDRIER DE RÉVISION) */}
          {tab === "planning" && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionHeaderTitle}>📅 Planning des révisions</Text>
              <View style={styles.guideCard}>
                <Text style={styles.guideTitle}>Algorithme d espacement FSRS-5</Text>
                <Text style={styles.guideSubtitle}>
                  Chaque carte mémoire est planifiée juste avant le moment où ta probabilité d oubli dépasse 10 %.
                </Text>
              </View>

              <View style={styles.planningGrid}>
                {Array.from({ length: 14 }).map((_, i) => {
                  const dayDate = new Date(Date.now() + i * 86400000);
                  const isToday = i === 0;
                  const dayName = dayDate.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

                  return (
                    <View key={i} style={[styles.planningDayCard, isToday && styles.planningDayToday]}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={[styles.planningDayTitle, isToday && { color: "#60a5fa", fontWeight: "700" }]}>
                          {isToday ? "Aujourd hui" : dayName}
                        </Text>
                        <Text style={styles.planningDayCount}>
                          {isToday ? `${allCards.length} cartes` : `${Math.max(1, Math.round(allCards.length / (i + 1)))} cartes`}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* BOTTOM TAB BAR */}
      <View style={styles.bottomNav}>
        <Pressable onPress={() => setTab("accueil")} style={styles.navItem}>
          <Text style={[styles.navIcon, tab === "accueil" && styles.navIconActive]}>🏠</Text>
          <Text style={[styles.navLabel, tab === "accueil" && styles.navLabelActive]}>Accueil</Text>
        </Pressable>

        <Pressable onPress={() => setTab("matieres")} style={styles.navItem}>
          <Text style={[styles.navIcon, tab === "matieres" && styles.navIconActive]}>📚</Text>
          <Text style={[styles.navLabel, tab === "matieres" && styles.navLabelActive]}>Matières</Text>
        </Pressable>

        <Pressable onPress={() => setTab("amphi")} style={styles.centerRecordNavItem}>
          <View style={styles.centerRecordCircle}>
            <Text style={styles.centerRecordIcon}>🎙️</Text>
          </View>
        </Pressable>

        <Pressable onPress={() => setTab("entrainement")} style={styles.navItem}>
          <Text style={[styles.navIcon, tab === "entrainement" && styles.navIconActive]}>⚡</Text>
          <Text style={[styles.navLabel, tab === "entrainement" && styles.navLabelActive]}>Entraîner</Text>
        </Pressable>

        <Pressable onPress={() => setTab("planning")} style={styles.navItem}>
          <Text style={[styles.navIcon, tab === "planning" && styles.navIconActive]}>📅</Text>
          <Text style={[styles.navLabel, tab === "planning" && styles.navLabelActive]}>Planning</Text>
        </Pressable>
      </View>

      {/* MODAL: AJOUT DE MATIÈRE */}
      <Modal visible={showNewSubjectModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>+ Ajouter une matière</Text>
            <Text style={styles.fieldLabel}>Nom de la matière :</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Ex: Génétique moléculaire"
              placeholderTextColor="#71717a"
              value={newSubjectTitle}
              onChangeText={setNewSubjectTitle}
            />

            <Text style={styles.fieldLabel}>Semestre :</Text>
            <View style={styles.semesterRow}>
              {(["S1", "S2"] as const).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setNewSubjectSemester(s)}
                  style={[styles.semesterBtn, newSubjectSemester === s && styles.semesterBtnActive]}
                >
                  <Text style={[styles.semesterBtnText, newSubjectSemester === s && styles.semesterBtnTextActive]}>{s}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>ECTS :</Text>
                <TextInput
                  style={styles.formInput}
                  keyboardType="numeric"
                  value={newSubjectEcts}
                  onChangeText={setNewSubjectEcts}
                />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={styles.fieldLabel}>Catégorie :</Text>
                <TextInput
                  style={styles.formInput}
                  value={newSubjectCategory}
                  onChangeText={setNewSubjectCategory}
                />
              </View>
            </View>

            <View style={styles.dialogActionRow}>
              <Pressable onPress={() => setShowNewSubjectModal(false)} style={styles.dialogCancelBtn}>
                <Text style={styles.dialogCancelBtnText}>Annuler</Text>
              </Pressable>
              <Pressable onPress={handleCreateSubject} style={styles.dialogConfirmBtn}>
                <Text style={styles.dialogConfirmBtnText}>Créer la matière</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: AJOUT DE CHAPITRE */}
      <Modal visible={showNewChapterModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>+ Nouveau chapitre</Text>
            <Text style={styles.dialogSubtitle}>
              Pour : {subjects.find((s) => s.id === (targetChapterSubjectId || selectedSubjectId))?.title || "Matière"}
            </Text>

            <Text style={styles.fieldLabel}>Titre du chapitre :</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Ex: Chapitre 1 — Organisation cellulaire"
              placeholderTextColor="#71717a"
              value={newChapterTitle}
              onChangeText={setNewChapterTitle}
            />

            <View style={styles.dialogActionRow}>
              <Pressable onPress={() => setShowNewChapterModal(false)} style={styles.dialogCancelBtn}>
                <Text style={styles.dialogCancelBtnText}>Annuler</Text>
              </Pressable>
              <Pressable onPress={handleCreateChapter} style={styles.dialogConfirmBtn}>
                <Text style={styles.dialogConfirmBtnText}>Créer le chapitre</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: DÉTAIL DU COURS & SAS DE RAPPEL ACTIF */}
      <Modal visible={!!selectedCourse} animationType="slide" transparent={false} onRequestClose={() => setSelectedCourse(null)}>
        <SafeAreaView style={styles.modalContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#09090b" />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {selectedCourse?.title}
            </Text>
            <Pressable onPress={() => setSelectedCourse(null)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* BARRE D'ONGLETS ÉPINGLÉE (si cours débloqué) */}
          {selectedCourse?.recallStatus !== "locked" && (
            <View style={[styles.courseTabNav, { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }]}>
              <Pressable
                onPress={() => setCourseTab("fiche")}
                style={[styles.courseNavBtn, courseTab === "fiche" && styles.courseNavBtnActive]}
              >
                <Text style={[styles.courseNavBtnText, courseTab === "fiche" && styles.courseNavBtnTextActive]}>
                  Fiche & MOC
                </Text>
              </Pressable>

              {selectedCourse?.atomicConcepts && selectedCourse.atomicConcepts.length > 0 ? (
                <Pressable
                  onPress={() => setCourseTab("concepts")}
                  style={[styles.courseNavBtn, courseTab === "concepts" && styles.courseNavBtnActive]}
                >
                  <Text style={[styles.courseNavBtnText, courseTab === "concepts" && styles.courseNavBtnTextActive]}>
                    Concepts ({selectedCourse.atomicConcepts.length})
                  </Text>
                </Pressable>
              ) : null}

              {(selectedCourse?.boiteAOutils?.theoremsAndLaws?.length || selectedCourse?.boiteAOutils?.formulas?.length || selectedCourse?.methodoExamen?.typicalQuestions?.length) ? (
                <Pressable
                  onPress={() => setCourseTab("boite")}
                  style={[styles.courseNavBtn, courseTab === "boite" && styles.courseNavBtnActive]}
                >
                  <Text style={[styles.courseNavBtnText, courseTab === "boite" && styles.courseNavBtnTextActive]}>
                    Boîte & Lois
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => setCourseTab("flashcards")}
                style={[styles.courseNavBtn, courseTab === "flashcards" && styles.courseNavBtnActive]}
              >
                <Text style={[styles.courseNavBtnText, courseTab === "flashcards" && styles.courseNavBtnTextActive]}>
                  Cartes ({selectedCourse?.cards?.length || 0})
                </Text>
              </Pressable>
            </View>
          )}

          <ScrollView style={styles.modalScroll} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {selectedCourse?.recallStatus === "locked" ? (
              /* SAS DE RAPPEL ACTIF OBLIGATOIRE */
              <View style={styles.sasBox}>
                <Text style={styles.sasBadge}>🔒 SAS DE RAPPEL ACTIF OBLIGATOIRE</Text>
                <Text style={styles.sasTitle}>Qu as-tu retenu de ce cours ?</Text>
                <Text style={styles.sasDesc}>
                  La fiche et les flashcards sont verrouillées. Prends 2 à 3 minutes pour écrire les notions clés, définitions ou théorèmes dont tu te souviens. L IA analysera ton rappel et débloquera le cours.
                </Text>

                <TextInput
                  style={styles.recallInput}
                  multiline
                  placeholder="Écris tout ce dont tu te souviens..."
                  placeholderTextColor="#71717a"
                  value={recallText}
                  onChangeText={setRecallText}
                />

                <Pressable
                  onPress={() =>
                    setRecallText(
                      "La membrane est une bicouche lipidique de phospholipides amphiphiles selon la mosaïque fluide. Le cholestérol agit comme tampon thermique de fluidité. Transport passif sans ATP et transport actif avec ATP."
                    )
                  }
                  style={styles.sampleRecallBtn}
                >
                  <Text style={styles.sampleRecallBtnText}>
                    🎙️ Dictée vocale : Insérer mon rappel test
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleUnlockRecall}
                  disabled={isSubmittingRecall}
                  style={styles.evaluateRecallBtn}
                >
                  {isSubmittingRecall ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.evaluateRecallBtnText}>⚡ Évaluer et débloquer mon cours</Text>
                  )}
                </Pressable>

                {/* DIAGNOSTIC IA */}
                {recallResult && (
                  <View style={styles.diagnosticCard}>
                    <Text style={styles.diagnosticScore}>Note : {recallResult.score} / 100</Text>
                    <Text style={styles.diagnosticSummary}>{recallResult.summary}</Text>

                    {recallResult.concepts?.map((c, i) => (
                      <View key={i} style={styles.conceptItemRow}>
                        <Text style={[styles.conceptBadge, c.status === "mastered" ? styles.conceptMastered : styles.conceptMissing]}>
                          {c.status === "mastered" ? "✓ Acquis" : "⚠ À revoir"}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.conceptLabel}>{c.label}</Text>
                          <Text style={styles.conceptFeedback}>{c.feedback}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              /* FICHE DÉVERROUILLÉE */
              <View>
                {courseTab === "fiche" && (
                  <View style={styles.sheetContainer}>
                    {loadingContent ? (
                      <ActivityIndicator color="#3b82f6" />
                    ) : (
                      <MobileMarkdownViewer content={courseContent} />
                    )}
                  </View>
                )}

                {courseTab === "concepts" && (
                  <View style={{ gap: 12 }}>
                    {(selectedCourse?.atomicConcepts || []).map((concept, idx) => (
                      <View key={concept.id || idx} style={styles.atomicConceptCard}>
                        <View style={styles.atomicConceptHeader}>
                          <Text style={styles.conceptIndexBadge}>Concept {idx + 1}</Text>
                          <Text style={styles.atomicConceptTitle}>{formatMath(concept.title)}</Text>
                        </View>

                        {concept.whyWeNeedIt ? (
                          <View style={styles.whyWeNeedBox}>
                            <Text style={styles.whyWeNeedTitle}>💡 Pourquoi on en a besoin</Text>
                            <Text style={styles.whyWeNeedText}>{formatMath(concept.whyWeNeedIt)}</Text>
                          </View>
                        ) : null}

                        {concept.analogy ? (
                          <View style={styles.analogyBox}>
                            <Text style={styles.analogyTitle}>☕ L'Analogie concrète</Text>
                            <Text style={styles.analogyText}>« {formatMath(concept.analogy)} »</Text>
                          </View>
                        ) : null}

                        <View style={styles.definitionBox}>
                          <Text style={styles.definitionTitle}>📖 Définition</Text>
                          <Text style={styles.definitionText}>{formatMath(concept.definition)}</Text>
                        </View>

                        {/* COMPARAISON X VS Y */}
                        {concept.comparison ? (
                          <View style={styles.comparisonBox}>
                            <View style={styles.comparisonHeader}>
                              <Text style={styles.comparisonBadge}>⚖️ COMPARAISON CLÉ</Text>
                              <Text style={styles.comparisonTitle}>
                                {formatMath(concept.title)} vs {formatMath(concept.comparison.versus)}
                              </Text>
                            </View>

                            {concept.comparison.rule ? (
                              <View style={styles.comparisonRuleBox}>
                                <Text style={styles.comparisonRuleTitle}>🎯 Règle de distinction :</Text>
                                <Text style={styles.comparisonRuleText}>{formatMath(concept.comparison.rule)}</Text>
                              </View>
                            ) : null}

                            {concept.comparison.table && concept.comparison.table.length > 0 && (
                              <View style={styles.comparisonTable}>
                                <View style={styles.comparisonHeaderRow}>
                                  <View style={[styles.comparisonCell, { flex: 1.1 }]}>
                                    <Text style={styles.comparisonHeaderText}>Critère</Text>
                                  </View>
                                  <View style={[styles.comparisonCell, { flex: 1 }]}>
                                    <Text style={styles.comparisonHeaderText}>Notion A</Text>
                                  </View>
                                  <View style={[styles.comparisonCell, { flex: 1 }]}>
                                    <Text style={styles.comparisonHeaderText}>Notion B</Text>
                                  </View>
                                </View>
                                {concept.comparison.table.map((row, rIdx) => (
                                  <View
                                    key={rIdx}
                                    style={[
                                      styles.comparisonRow,
                                      rIdx % 2 === 1 && { backgroundColor: "rgba(39, 39, 42, 0.4)" }
                                    ]}
                                  >
                                    <View style={[styles.comparisonCell, { flex: 1.1 }]}>
                                      <Text style={styles.comparisonCellCritere}>{formatMath(row.critere)}</Text>
                                    </View>
                                    <View style={[styles.comparisonCell, { flex: 1 }]}>
                                      <Text style={styles.comparisonCellText}>{formatMath(row.a)}</Text>
                                    </View>
                                    <View style={[styles.comparisonCell, { flex: 1 }]}>
                                      <Text style={styles.comparisonCellText}>{formatMath(row.b)}</Text>
                                    </View>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        ) : null}

                        {concept.progressiveExamples && concept.progressiveExamples.length > 0 && (
                          <View style={{ gap: 6, marginTop: 4 }}>
                            <Text style={styles.subSectionTitle}>🔬 Exemples progressifs</Text>
                            {concept.progressiveExamples.map((ex, exIdx) => (
                              <View
                                key={exIdx}
                                style={[
                                  styles.exampleItemBox,
                                  ex.level === "simple" ? styles.exampleSimple : ex.level === "intermediaire" ? styles.exampleInter : styles.exampleRealiste
                                ]}
                              >
                                <Text style={styles.exampleTitle}>
                                  {ex.level === "simple" ? "🟢 Simple : " : ex.level === "intermediaire" ? "🟡 Intermédiaire : " : "🔴 Réaliste : "}
                                  {formatMath(ex.title)}
                                </Text>
                                <Text style={styles.exampleExplanation}>{formatMath(ex.explanation)}</Text>
                                {ex.codeOrFormula ? (
                                  <Text style={styles.exampleCode}>{formatMath(ex.codeOrFormula)}</Text>
                                ) : null}
                              </View>
                            ))}
                          </View>
                        )}

                        {concept.traps && concept.traps.length > 0 && (
                          <View style={styles.atomicTrapBox}>
                            <Text style={styles.atomicTrapBoxTitle}>⚠️ Pièges d'examen</Text>
                            {concept.traps.map((tr, trIdx) => (
                              <Text key={trIdx} style={styles.atomicTrapBoxText}>• {formatMath(tr)}</Text>
                            ))}
                          </View>
                        )}

                        {concept.relatedConcepts && concept.relatedConcepts.length > 0 && (
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                            {concept.relatedConcepts.map((rc, rcIdx) => (
                              <View key={rcIdx} style={styles.relatedConceptBadge}>
                                <Text style={styles.relatedConceptBadgeText}>{formatMath(rc)}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {courseTab === "boite" && (
                  <View style={{ gap: 12 }}>
                    {selectedCourse?.boiteAOutils?.theoremsAndLaws && selectedCourse.boiteAOutils.theoremsAndLaws.length > 0 && (
                      <View style={styles.boiteSection}>
                        <Text style={styles.boiteSectionHeader}>📐 Théorèmes, Lois & Démonstrations</Text>
                        {selectedCourse.boiteAOutils.theoremsAndLaws.map((th, idx) => (
                          <View key={idx} style={styles.theoremCard}>
                            <Text style={styles.theoremName}>{formatMath(th.name)}</Text>
                            <Text style={styles.theoremStatement}>{formatMath(th.statement)}</Text>
                            {th.proofOrMechanism ? (
                              <Text style={styles.theoremProof}>🔍 {formatMath(th.proofOrMechanism)}</Text>
                            ) : null}
                            {th.conditionOfValidity ? (
                              <Text style={styles.theoremCondition}>⚡ Validité : {formatMath(th.conditionOfValidity)}</Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    )}

                    {selectedCourse?.boiteAOutils?.formulas && selectedCourse.boiteAOutils.formulas.length > 0 && (
                      <View style={styles.boiteSection}>
                        <Text style={styles.boiteSectionHeader}>⚡ Formules & Équations clés</Text>
                        {selectedCourse.boiteAOutils.formulas.map((fm, idx) => (
                          <View key={idx} style={styles.formulaCard}>
                            <Text style={styles.formulaName}>{formatMath(fm.name)}</Text>
                            <Text style={styles.formulaFormula}>{formatMath(fm.formula)}</Text>
                            {fm.variablesExplanation ? (
                              <Text style={styles.formulaVars}>{formatMath(fm.variablesExplanation)}</Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    )}

                    {selectedCourse?.methodoExamen && (
                      <View style={styles.boiteSection}>
                        <Text style={styles.boiteSectionHeader}>🎓 Méthodologie & Questions de partiel</Text>
                        {selectedCourse.methodoExamen.typicalQuestions?.map((q, idx) => (
                          <Text key={idx} style={styles.methodoItem}>❓ {formatMath(q)}</Text>
                        ))}
                        {selectedCourse.methodoExamen.gradingCriteria?.map((c, idx) => (
                          <Text key={idx} style={styles.methodoItemSuccess}>✓ {formatMath(c)}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {courseTab === "flashcards" && (
                  <View style={{ marginTop: 4 }}>
                    {(selectedCourse?.cards || []).map((card, i) => (
                      <View key={card.id || i} style={styles.flashcardInspectCard}>
                        <Text style={styles.flashcardQuestion}>Q: {formatMath(card.question)}</Text>
                        <Text style={styles.flashcardAnswerText}>R: {formatMath(card.answer)}</Text>
                        {card.trap ? (
                          <Text style={styles.flashcardTrapText}>⚠️ Piège : {formatMath(card.trap)}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b" },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ? StatusBar.currentHeight + 6 : 38) : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
    backgroundColor: "#09090b",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
  },
  logoLetter: { color: "#ffffff", fontSize: 16, fontWeight: "900" },
  brandTitle: { color: "#ffffff", fontSize: 18, fontWeight: "800", letterSpacing: -0.5 },
  tagBioMIA: { backgroundColor: "#1e293b", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagBioMIAText: { color: "#60a5fa", fontSize: 10, fontWeight: "700" },
  brandSubtitle: { color: "#71717a", fontSize: 10, fontWeight: "500" },
  topRightActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34,197,94,0.1)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.25)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" },
  statusText: { color: "#22c55e", fontSize: 11, fontWeight: "600" },
  refreshBtn: { padding: 4 },
  refreshBtnText: { fontSize: 16 },

  centerBox: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadingText: { color: "#a1a1aa", marginTop: 12, fontSize: 14 },

  contentScroll: { flex: 1 },
  contentScrollContainer: { padding: 16, paddingBottom: 90 },
  tabContent: { flex: 1 },

  // Guide
  guideCard: {
    backgroundColor: "rgba(37,99,235,0.08)",
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.2)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  guideTitle: { color: "#93c5fd", fontSize: 13, fontWeight: "700", marginBottom: 2 },
  guideSubtitle: { color: "#bfdbfe", fontSize: 11, lineHeight: 16 },

  // Mission
  missionCard: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#f59e0b",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  missionHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  missionBadge: { color: "#f59e0b", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  missionCount: { color: "#a1a1aa", fontSize: 11 },
  missionTitle: { color: "#ffffff", fontSize: 15, fontWeight: "700", marginBottom: 4 },
  missionDesc: { color: "#a1a1aa", fontSize: 12, lineHeight: 16, marginBottom: 12 },
  unlockPrimaryBtn: { backgroundColor: "#f59e0b", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  unlockPrimaryBtnText: { color: "#000000", fontSize: 13, fontWeight: "800" },

  allDoneCard: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  allDoneIcon: { fontSize: 24, marginBottom: 6 },
  allDoneTitle: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  allDoneDesc: { color: "#71717a", fontSize: 12, marginTop: 2 },

  // Stats Grid
  statsGrid: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  statNumber: { color: "#60a5fa", fontSize: 22, fontWeight: "900" },
  statLabel: { color: "#71717a", fontSize: 11, fontWeight: "500", marginTop: 2 },

  quickLaunchBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  quickLaunchBtnText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },

  sectionHeaderTitle: { color: "#ffffff", fontSize: 15, fontWeight: "700", marginBottom: 10 },

  courseItemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  courseItemTitle: { color: "#ffffff", fontSize: 13, fontWeight: "600" },
  courseItemMeta: { color: "#71717a", fontSize: 11, marginTop: 2 },
  lockedPill: { backgroundColor: "rgba(245,158,11,0.15)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  lockedPillText: { color: "#f59e0b", fontSize: 10, fontWeight: "700" },
  unlockedPill: { backgroundColor: "rgba(34,197,94,0.15)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  unlockedPillText: { color: "#22c55e", fontSize: 10, fontWeight: "700" },

  // Filters & Pills
  filterSection: { marginBottom: 12 },
  semesterRow: { flexDirection: "row", gap: 6 },
  semesterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a" },
  semesterBtnActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  semesterBtnText: { color: "#a1a1aa", fontSize: 12, fontWeight: "600" },
  semesterBtnTextActive: { color: "#ffffff" },
  addSubjectSmallBtn: { backgroundColor: "#27272a", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addSubjectSmallBtnText: { color: "#60a5fa", fontSize: 12, fontWeight: "700" },

  pillsScroll: { marginTop: 10 },
  subjectPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    marginRight: 8,
  },
  subjectPillActive: { borderColor: "#2563eb", backgroundColor: "rgba(37,99,235,0.12)" },
  subjectPillBadge: { backgroundColor: "#27272a", color: "#a1a1aa", fontSize: 9, fontWeight: "700", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
  subjectPillBadgeActive: { backgroundColor: "#2563eb", color: "#ffffff" },
  subjectPillText: { color: "#a1a1aa", fontSize: 12, fontWeight: "600" },
  subjectPillTextActive: { color: "#ffffff" },

  // Subject Hero
  subjectHeroCard: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  subjectBadgesRow: { flexDirection: "row", gap: 6, marginBottom: 6 },
  subjectBadge: { backgroundColor: "#27272a", color: "#60a5fa", fontSize: 10, fontWeight: "700", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  subjectCategory: { color: "#71717a", fontSize: 11, alignSelf: "center" },
  subjectHeroTitle: { color: "#ffffff", fontSize: 17, fontWeight: "800", marginBottom: 4 },
  subjectHeroStats: { color: "#a1a1aa", fontSize: 12, marginBottom: 12 },

  subTabRow: { flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: "#27272a", paddingTop: 10 },
  subTabBtn: { flex: 1, paddingVertical: 6, alignItems: "center", borderRadius: 6 },
  subTabBtnActive: { backgroundColor: "#27272a" },
  subTabBtnText: { color: "#71717a", fontSize: 12, fontWeight: "600" },
  subTabBtnTextActive: { color: "#ffffff", fontWeight: "700" },

  addChapterBtn: { backgroundColor: "#27272a", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addChapterBtnText: { color: "#60a5fa", fontSize: 11, fontWeight: "700" },

  chapterCard: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    marginBottom: 10,
    overflow: "hidden",
  },
  chapterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  chapterBadge: { color: "#60a5fa", fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  chapterTitle: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  chapterCount: { color: "#71717a", fontSize: 11 },
  chapterBody: { borderTopWidth: 1, borderTopColor: "#27272a", padding: 8 },
  emptyChapterText: { color: "#71717a", fontSize: 11, textAlign: "center", paddingVertical: 8 },
  chapterCourseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  chapterCourseTitle: { color: "#e4e4e7", fontSize: 12, fontWeight: "600" },
  chapterCourseMeta: { color: "#71717a", fontSize: 10, marginTop: 1 },
  lockedMini: { color: "#f59e0b", fontSize: 10, fontWeight: "700" },
  unlockedMini: { color: "#22c55e", fontSize: 10, fontWeight: "700" },

  // Flashcards Inspection
  flashcardInspectCard: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  flashcardCourseTag: { color: "#60a5fa", fontSize: 10, fontWeight: "700", marginBottom: 2 },
  flashcardQuestion: { color: "#ffffff", fontSize: 13, fontWeight: "600", marginBottom: 6 },
  flashcardAnswerBox: { backgroundColor: "#09090b", padding: 8, borderRadius: 6, borderLeftWidth: 3, borderLeftColor: "#22c55e" },
  flashcardAnswerLabel: { color: "#22c55e", fontSize: 9, fontWeight: "700" },
  flashcardAnswerText: { color: "#d4d4d8", fontSize: 12, marginTop: 2 },
  flashcardTrapText: { color: "#f87171", fontSize: 11, marginTop: 4, fontStyle: "italic" },

  // Studio Amphi
  recorderStudioCard: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 16,
    padding: 16,
  },
  studioHeaderTitle: { color: "#ffffff", fontSize: 18, fontWeight: "800", marginBottom: 4 },
  studioHeaderSubtitle: { color: "#a1a1aa", fontSize: 12, lineHeight: 16, marginBottom: 16 },
  recorderForm: { marginBottom: 16 },
  fieldLabel: { color: "#a1a1aa", fontSize: 12, fontWeight: "600", marginTop: 8, marginBottom: 4 },
  formInput: {
    backgroundColor: "#09090b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#ffffff",
    fontSize: 13,
  },
  smallSubjectPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#27272a",
    marginRight: 6,
  },
  smallSubjectPillActive: { backgroundColor: "#2563eb" },
  smallSubjectPillText: { color: "#a1a1aa", fontSize: 11, fontWeight: "600" },
  smallSubjectPillTextActive: { color: "#ffffff" },

  phasePreviewBadge: { backgroundColor: "rgba(37,99,235,0.1)", borderRadius: 6, padding: 6, marginTop: 6 },
  phasePreviewText: { color: "#60a5fa", fontSize: 11, fontWeight: "600" },

  timerContainer: { alignItems: "center", marginVertical: 14 },
  timerDisplay: { color: "#ffffff", fontSize: 36, fontWeight: "900", fontVariant: ["tabular-nums"] },
  recordingStatusText: { color: "#a1a1aa", fontSize: 12, marginTop: 2 },

  bigRecordBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  bigRecordBtnIdle: { backgroundColor: "#ef4444" },
  bigRecordBtnActive: { backgroundColor: "#f59e0b" },
  bigRecordBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },

  markersBox: { marginTop: 16, borderTopWidth: 1, borderTopColor: "#27272a", paddingTop: 14 },
  markersBoxTitle: { color: "#a1a1aa", fontSize: 12, fontWeight: "600", marginBottom: 8 },
  markerButtonsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  markerBtn: { flex: 1, minWidth: "45%", borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center", backgroundColor: "#09090b" },
  markerBtnText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },

  photoCaptureBtn: { backgroundColor: "#27272a", borderRadius: 8, paddingVertical: 10, alignItems: "center", marginTop: 10 },
  photoCaptureBtnText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  liveSummaryRow: { alignItems: "center", marginTop: 8 },
  liveSummaryText: { color: "#a1a1aa", fontSize: 11, fontWeight: "600" },

  // Training
  trainingHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  reviewedCountBadge: { backgroundColor: "#18181b", color: "#22c55e", fontSize: 11, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  trainingConfigCard: { backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a", borderRadius: 12, padding: 12, marginBottom: 14 },
  durationRow: { flexDirection: "row", gap: 8 },
  durationBtn: { flex: 1, paddingVertical: 6, borderRadius: 6, backgroundColor: "#09090b", borderWidth: 1, borderColor: "#27272a", alignItems: "center" },
  durationBtnActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  durationBtnText: { color: "#a1a1aa", fontSize: 11, fontWeight: "600" },
  durationBtnTextActive: { color: "#ffffff", fontWeight: "700" },

  cardTrainingBox: { backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a", borderRadius: 16, padding: 16 },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  cardProgressText: { color: "#71717a", fontSize: 11, fontWeight: "600" },
  cardTag: { color: "#60a5fa", fontSize: 11, fontWeight: "700" },
  cardQuestionText: { color: "#ffffff", fontSize: 16, fontWeight: "700", lineHeight: 22, marginVertical: 10 },

  qcmContainer: { marginTop: 8 },
  qcmOptionBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 8, backgroundColor: "#09090b", borderWidth: 1, borderColor: "#27272a", marginBottom: 6 },
  qcmOptionBtnSelected: { borderColor: "#2563eb", backgroundColor: "rgba(37,99,235,0.1)" },
  qcmLetter: { color: "#60a5fa", fontSize: 12, fontWeight: "700" },
  qcmOptionText: { color: "#d4d4d8", fontSize: 12, flex: 1 },
  qcmOptionTextSelected: { color: "#ffffff", fontWeight: "600" },

  showAnswerBtn: { backgroundColor: "#27272a", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 14 },
  showAnswerBtnText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },

  answerBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#27272a", paddingTop: 12 },
  answerLabel: { color: "#22c55e", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  answerText: { color: "#f4f4f5", fontSize: 13, lineHeight: 18, marginTop: 4 },
  trapBox: { backgroundColor: "rgba(244,63,94,0.1)", borderRadius: 8, padding: 8, marginTop: 8, borderLeftWidth: 3, borderLeftColor: "#f43f5e" },
  trapLabel: { color: "#f43f5e", fontSize: 10, fontWeight: "800" },
  trapText: { color: "#fca5a5", fontSize: 11, marginTop: 2 },

  // Cognitive Sub-modes & Feynman Styles
  cognitiveModeRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  cognitiveModePill: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a", alignItems: "center" },
  cognitiveModePillActive: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
  cognitiveModeText: { color: "#a1a1aa", fontSize: 11, fontWeight: "700" },
  cognitiveModeTextActive: { color: "#ffffff" },

  cognitiveExplainBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a", borderRadius: 10, padding: 10, marginBottom: 12 },
  cognitiveExplainIcon: { fontSize: 14 },
  cognitiveExplainText: { color: "#a1a1aa", fontSize: 11, lineHeight: 15, flex: 1 },

  dualCodingBox: { marginTop: 12, backgroundColor: "#09090b", borderWidth: 1, borderColor: "#27272a", borderRadius: 10, padding: 10 },
  dualCodingLabel: { color: "#60a5fa", fontSize: 11, fontWeight: "700", marginBottom: 6 },
  dualCodingImg: { width: "100%", height: 160, borderRadius: 6, backgroundColor: "#18181b" },

  feynmanCard: { marginTop: 12 },
  feynmanToggleBtn: { backgroundColor: "rgba(245,158,11,0.1)", borderWidth: 1, borderColor: "rgba(245,158,11,0.3)", borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  feynmanToggleBtnText: { color: "#f59e0b", fontSize: 12, fontWeight: "700" },
  feynmanExpandedBox: { backgroundColor: "#09090b", borderWidth: 1, borderColor: "rgba(245,158,11,0.4)", borderRadius: 10, padding: 12 },
  feynmanHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  feynmanTitle: { color: "#f59e0b", fontSize: 12, fontWeight: "800" },
  feynmanCloseText: { color: "#71717a", fontSize: 13, fontWeight: "700" },
  feynmanInput: { backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a", borderRadius: 8, padding: 10, color: "#ffffff", fontSize: 12, minHeight: 60, textAlignVertical: "top" },
  feynmanSubmitBtn: { backgroundColor: "#f59e0b", borderRadius: 8, paddingVertical: 8, alignItems: "center", marginTop: 8 },
  feynmanSubmitBtnText: { color: "#09090b", fontSize: 12, fontWeight: "800" },
  feynmanFeedbackBox: { backgroundColor: "#18181b", borderWidth: 1, borderColor: "rgba(245,158,11,0.2)", borderRadius: 8, padding: 10, marginTop: 8 },
  feynmanScoreRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  feynmanScoreText: { color: "#22c55e", fontSize: 12, fontWeight: "800" },
  feynmanCausalText: { color: "#f59e0b", fontSize: 11, fontWeight: "700" },
  feynmanFeedbackText: { color: "#d4d4d8", fontSize: 11, lineHeight: 16 },

  ratingPrompt: { color: "#a1a1aa", fontSize: 12, fontWeight: "600", marginTop: 14, marginBottom: 8, textAlign: "center" },
  ratingGrid: { flexDirection: "row", gap: 6 },
  ratingBtn: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  ratingBtnText: { color: "#ffffff", fontSize: 11, fontWeight: "800" },
  ratingSubText: { color: "rgba(255,255,255,0.8)", fontSize: 9, marginTop: 1 },

  // Planning
  planningGrid: { gap: 8, marginTop: 12 },
  planningDayCard: { backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a", borderRadius: 10, padding: 12 },
  planningDayToday: { borderColor: "#2563eb", backgroundColor: "rgba(37,99,235,0.08)" },
  planningDayTitle: { color: "#d4d4d8", fontSize: 13, fontWeight: "600" },
  planningDayCount: { color: "#a1a1aa", fontSize: 11 },

  emptyCard: { backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a", borderRadius: 12, padding: 20, alignItems: "center" },
  emptyText: { color: "#71717a", fontSize: 12, textAlign: "center" },

  // Bottom Nav
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    height: 60,
    backgroundColor: "#09090b",
    borderTopWidth: 1,
    borderTopColor: "#18181b",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: { alignItems: "center", flex: 1 },
  navIcon: { fontSize: 18, opacity: 0.6 },
  navIconActive: { opacity: 1 },
  navLabel: { color: "#71717a", fontSize: 10, fontWeight: "600", marginTop: 2 },
  navLabelActive: { color: "#60a5fa", fontWeight: "700" },
  centerRecordNavItem: { top: -14, alignItems: "center", justifyContent: "center" },
  centerRecordCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#09090b",
    elevation: 4,
  },
  centerRecordIcon: { fontSize: 20 },

  // Modal Dialogs
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 20 },
  dialogCard: { width: "100%", backgroundColor: "#18181b", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "#27272a" },
  dialogTitle: { color: "#ffffff", fontSize: 16, fontWeight: "800", marginBottom: 2 },
  dialogSubtitle: { color: "#71717a", fontSize: 11, marginBottom: 12 },
  dialogActionRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  dialogCancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: "#27272a", alignItems: "center" },
  dialogCancelBtnText: { color: "#d4d4d8", fontSize: 12, fontWeight: "600" },
  dialogConfirmBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: "#2563eb", alignItems: "center" },
  dialogConfirmBtnText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },

  // Course Detail & Sas Modal
  modalContainer: { flex: 1, backgroundColor: "#09090b" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 40) : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
  },
  modalTitle: { color: "#ffffff", fontSize: 15, fontWeight: "700", flex: 1, marginRight: 10 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#27272a",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  modalScroll: { flex: 1 },

  sasBox: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#f59e0b",
    borderRadius: 16,
    padding: 16,
  },
  sasBadge: { color: "#f59e0b", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  sasTitle: { color: "#ffffff", fontSize: 16, fontWeight: "800", marginTop: 4, marginBottom: 4 },
  sasDesc: { color: "#a1a1aa", fontSize: 12, lineHeight: 16, marginBottom: 12 },
  recallInput: {
    backgroundColor: "#09090b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 10,
    padding: 12,
    color: "#ffffff",
    fontSize: 13,
    minHeight: 100,
    textAlignVertical: "top",
  },
  sampleRecallBtn: { alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 10, backgroundColor: "#27272a", borderRadius: 8, marginTop: 6 },
  sampleRecallBtnText: { color: "#60a5fa", fontSize: 11, fontWeight: "700" },
  evaluateRecallBtn: { backgroundColor: "#f59e0b", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  evaluateRecallBtnText: { color: "#000000", fontSize: 13, fontWeight: "800" },

  diagnosticCard: { marginTop: 14, borderTopWidth: 1, borderTopColor: "#27272a", paddingTop: 12 },
  diagnosticScore: { color: "#22c55e", fontSize: 15, fontWeight: "800", marginBottom: 4 },
  diagnosticSummary: { color: "#d4d4d8", fontSize: 12, lineHeight: 16, marginBottom: 10 },
  conceptItemRow: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 8 },
  conceptBadge: { fontSize: 9, fontWeight: "800", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  conceptMastered: { backgroundColor: "rgba(34,197,94,0.15)", color: "#22c55e" },
  conceptMissing: { backgroundColor: "rgba(244,63,94,0.15)", color: "#f43f5e" },
  conceptLabel: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  conceptFeedback: { color: "#a1a1aa", fontSize: 11, marginTop: 1 },

  courseTabNav: { flexDirection: "row", gap: 8, marginBottom: 12 },
  courseNavBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8, backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a" },
  courseNavBtnActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  courseNavBtnText: { color: "#a1a1aa", fontSize: 12, fontWeight: "600" },
  courseNavBtnTextActive: { color: "#ffffff", fontWeight: "700" },

  sheetContainer: { backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a", borderRadius: 12, padding: 14 },
  sheetMarkdownText: { color: "#e4e4e7", fontSize: 13, lineHeight: 20 },

  atomicConceptCard: { backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a", borderRadius: 16, padding: 16, gap: 10 },
  atomicConceptHeader: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  conceptIndexBadge: { backgroundColor: "rgba(59,130,246,0.15)", color: "#60a5fa", fontSize: 10, fontWeight: "800", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  atomicConceptTitle: { color: "#ffffff", fontSize: 15, fontWeight: "800", flex: 1 },
  whyWeNeedBox: { backgroundColor: "rgba(245,158,11,0.08)", borderWidth: 1, borderColor: "rgba(245,158,11,0.25)", borderRadius: 12, padding: 12, gap: 4 },
  whyWeNeedTitle: { color: "#f59e0b", fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  whyWeNeedText: { color: "#fef3c7", fontSize: 12, lineHeight: 17 },
  analogyBox: { backgroundColor: "rgba(99,102,241,0.08)", borderWidth: 1, borderColor: "rgba(99,102,241,0.25)", borderRadius: 12, padding: 12, gap: 4 },
  analogyTitle: { color: "#818cf8", fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  analogyText: { color: "#e0e7ff", fontSize: 12, fontStyle: "italic", lineHeight: 17 },
  definitionBox: { backgroundColor: "#09090b", borderWidth: 1, borderColor: "#27272a", borderRadius: 12, padding: 12, gap: 4 },
  definitionTitle: { color: "#a1a1aa", fontSize: 11, fontWeight: "800" },
  definitionText: { color: "#f4f4f5", fontSize: 12, lineHeight: 18 },
  subSectionTitle: { color: "#a1a1aa", fontSize: 11, fontWeight: "800", marginBottom: 2 },
  exampleItemBox: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 4 },
  exampleSimple: { backgroundColor: "rgba(34,197,94,0.06)", borderColor: "rgba(34,197,94,0.25)" },
  exampleInter: { backgroundColor: "rgba(245,158,11,0.06)", borderColor: "rgba(245,158,11,0.25)" },
  exampleRealiste: { backgroundColor: "rgba(244,63,94,0.06)", borderColor: "rgba(244,63,94,0.25)" },
  exampleTitle: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  exampleExplanation: { color: "#d4d4d8", fontSize: 11, lineHeight: 16 },
  exampleCode: { backgroundColor: "#09090b", color: "#67e8f9", fontSize: 11, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", padding: 6, borderRadius: 6, marginTop: 4 },
  atomicTrapBox: { backgroundColor: "rgba(244,63,94,0.08)", borderWidth: 1, borderColor: "rgba(244,63,94,0.25)", borderRadius: 12, padding: 12, gap: 4 },
  atomicTrapBoxTitle: { color: "#fb7185", fontSize: 11, fontWeight: "800" },
  atomicTrapBoxText: { color: "#ffe4e6", fontSize: 11, lineHeight: 16 },
  relatedConceptBadge: { backgroundColor: "#27272a", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  relatedConceptBadgeText: { color: "#38bdf8", fontSize: 11, fontWeight: "600" },
  boiteSection: { backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a", borderRadius: 16, padding: 14, gap: 8 },
  boiteSectionHeader: { color: "#ffffff", fontSize: 14, fontWeight: "800", marginBottom: 4 },
  theoremCard: { backgroundColor: "#09090b", borderWidth: 1, borderColor: "#27272a", borderRadius: 12, padding: 12, gap: 4 },
  theoremName: { color: "#22c55e", fontSize: 13, fontWeight: "800" },
  theoremStatement: { color: "#f4f4f5", fontSize: 12, lineHeight: 17 },
  theoremProof: { color: "#a1a1aa", fontSize: 11, lineHeight: 16, marginTop: 2 },
  theoremCondition: { color: "#f59e0b", fontSize: 11, fontWeight: "700", marginTop: 2 },
  formulaCard: { backgroundColor: "#09090b", borderWidth: 1, borderColor: "#27272a", borderRadius: 12, padding: 12, gap: 4 },
  formulaName: { color: "#60a5fa", fontSize: 12, fontWeight: "700" },
  formulaFormula: { backgroundColor: "#18181b", color: "#22c55e", fontSize: 13, fontWeight: "800", textAlign: "center", paddingVertical: 8, borderRadius: 8, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  formulaVars: { color: "#a1a1aa", fontSize: 11, lineHeight: 15 },
  methodoItem: { color: "#fbbf24", fontSize: 12, lineHeight: 17 },
  methodoItemSuccess: { color: "#4ade80", fontSize: 12, lineHeight: 17 },

  // Comparaison X vs Y
  comparisonBox: {
    backgroundColor: "rgba(147, 51, 234, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(147, 51, 234, 0.3)",
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  comparisonHeader: {
    gap: 2,
  },
  comparisonBadge: {
    color: "#c084fc",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  comparisonTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  comparisonRuleBox: {
    backgroundColor: "rgba(24, 24, 27, 0.8)",
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#a855f7",
    gap: 2,
  },
  comparisonRuleTitle: {
    color: "#e9d5ff",
    fontSize: 10,
    fontWeight: "800",
  },
  comparisonRuleText: {
    color: "#d4d4d8",
    fontSize: 11,
    lineHeight: 16,
  },
  comparisonTable: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(147, 51, 234, 0.25)",
    overflow: "hidden",
    marginTop: 4,
    backgroundColor: "#18181b",
  },
  comparisonHeaderRow: {
    flexDirection: "row",
    backgroundColor: "rgba(147, 51, 234, 0.2)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(147, 51, 234, 0.3)",
  },
  comparisonRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(63, 63, 70, 0.3)",
  },
  comparisonCell: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    justifyContent: "center",
  },
  comparisonHeaderText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#f3e8ff",
  },
  comparisonCellCritere: {
    fontSize: 10,
    fontWeight: "700",
    color: "#e9d5ff",
  },
  comparisonCellText: {
    fontSize: 10,
    color: "#d4d4d8",
    lineHeight: 14,
  },
});
