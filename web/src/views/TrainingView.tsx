import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Mic,
  Layers,
  ChevronRight,
  Eye,
  Timer,
  Play,
  Award,
  Filter,
  Check,
  Shuffle,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';
import {
  getSubjects,
  getStudyCourses,
  getReviews,
  getWeaknesses,
  submitCardReview,
  saveRevisionSession,
  getChapterDefinitions,
  getInterleavedTraining,
  getExamTrapsAndErrors,
  evaluateFeynman,
  syncPendingReviews,
  enqueueOfflineReview,
} from '../lib/api';
import type {
  Subject,
  Course,
  ReviewStatus,
  ReviewCardItem,
  Weakness,
  ChapterDefinition,
  CoursePhoto,
} from '../lib/types';

interface TrainingViewProps {
  initialTab?: 'hub' | 'due' | 'interleaved' | 'traps' | 'chapters' | 'schemas' | 'oral' | 'weaknesses';
  initialSubjectId?: string;
  onOpenCourse?: (courseId: string) => void;
}

export const TrainingView: React.FC<TrainingViewProps> = ({
  initialTab = 'hub',
  initialSubjectId,
}) => {
  const [activeTab, setActiveTab] = useState<
    'hub' | 'due' | 'interleaved' | 'traps' | 'chapters' | 'schemas' | 'oral' | 'weaknesses'
  >(initialTab);

  // Filters
  const [selectedSemester, setSelectedSemester] = useState<'ALL' | 'S1' | 'S2'>('ALL');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubjectId || 'ALL');
  const [selectedChapter, setSelectedChapter] = useState<string>('ALL');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('ALL');

  // Data
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [reviews, setReviews] = useState<ReviewStatus>({
    dueCount: 0,
    totalCards: 0,
    todayReviewed: 0,
    dueCards: [],
  });
  const [weaknesses, setWeaknesses] = useState<Weakness[]>([]);
  const [chapterDefs, setChapterDefs] = useState<ChapterDefinition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Cognitive sessions state
  const [interleavedCards, setInterleavedCards] = useState<any[]>([]);
  const [interleavedIndex, setInterleavedIndex] = useState<number>(0);
  const [isInterleavedRevealed, setIsInterleavedRevealed] = useState<boolean>(false);

  const [trapCards, setTrapCards] = useState<any[]>([]);
  const [trapIndex, setTrapIndex] = useState<number>(0);
  const [isTrapRevealed, setIsTrapRevealed] = useState<boolean>(false);

  // Feynman 60s state
  const [isFeynmanOpen, setIsFeynmanOpen] = useState<boolean>(false);
  const [feynmanText, setFeynmanText] = useState<string>('');
  const [isFeynmanEvaluating, setIsFeynmanEvaluating] = useState<boolean>(false);
  const [feynmanFeedback, setFeynmanFeedback] = useState<any | null>(null);

  // Due cards practice state
  const [currentDueIndex, setCurrentDueIndex] = useState<number>(0);
  const [isDueAnswerRevealed, setIsDueAnswerRevealed] = useState<boolean>(false);
  const [userDraftAnswer, setUserDraftAnswer] = useState<string>('');
  const [selectedQcmOption, setSelectedQcmOption] = useState<number | null>(null);
  const [reviewedInSessionCount, setReviewedInSessionCount] = useState<number>(0);

  // Chapter test state
  const [chapterTestIndex, setChapterTestIndex] = useState<number>(0);
  const [isChapterAnswerRevealed, setIsChapterAnswerRevealed] = useState<boolean>(false);

  // Occlusion test state
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [occlusionRevealed, setOcclusionRevealed] = useState<Record<string, boolean>>({});

  // Oral Exam state
  const [oralDuration, setOralDuration] = useState<number>(15);
  const [oralSubjectId, setOralSubjectId] = useState<string>('');
  const [oralStarted, setOralStarted] = useState<boolean>(false);
  const [oralTimerSeconds, setOralTimerSeconds] = useState<number>(15 * 60);
  const [isOralTimerRunning, setIsOralTimerRunning] = useState<boolean>(false);
  const [oralNotes, setOralNotes] = useState<string>('');
  const [oralScore, setOralScore] = useState<number>(80);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        syncPendingReviews().catch(() => {});
        const [subList, courseList, reviewData, weakList, chapList, interList, trapList] = await Promise.all([
          getSubjects(),
          getStudyCourses(),
          getReviews(),
          getWeaknesses(),
          getChapterDefinitions(),
          getInterleavedTraining(15),
          getExamTrapsAndErrors(),
        ]);
        setSubjects(subList || []);
        setCourses(courseList || []);
        setReviews(
          reviewData || { dueCount: 0, totalCards: 0, todayReviewed: 0, dueCards: [] }
        );
        setWeaknesses(weakList || []);
        setChapterDefs(chapList || []);
        setInterleavedCards(interList || []);
        setTrapCards(trapList || []);

        if (initialSubjectId && subList.some((s) => s.id === initialSubjectId)) {
          setSelectedSubjectId(initialSubjectId);
          setOralSubjectId(initialSubjectId);
        } else if (subList.length > 0) {
          setOralSubjectId(subList[0].id);
        }
      } catch (err) {
        console.error('Error loading training data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [initialSubjectId]);

  // Timer effect for oral exam
  useEffect(() => {
    let interval: any = null;
    if (oralStarted && isOralTimerRunning && oralTimerSeconds > 0) {
      interval = setInterval(() => {
        setOralTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (oralTimerSeconds === 0) {
      setIsOralTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [oralStarted, isOralTimerRunning, oralTimerSeconds]);

  // Detection si la formation a plusieurs semestres S1 et S2 distincts
  const hasMultipleSemesters = useMemo(() => {
    const hasS1 = subjects.some((s) => s.semester === 'S1');
    const hasS2 = subjects.some((s) => s.semester === 'S2');
    return hasS1 && hasS2;
  }, [subjects]);

  // Filtered Subjects
  const filteredSubjects = useMemo(() => {
    if (!hasMultipleSemesters || selectedSemester === 'ALL') return subjects;
    return subjects.filter((s) => s.semester === selectedSemester);
  }, [subjects, selectedSemester, hasMultipleSemesters]);

  // Filtered Courses
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const sub = subjects.find((s) => s.id === c.subjectId);
      if (hasMultipleSemesters && selectedSemester !== 'ALL' && sub && sub.semester !== selectedSemester) return false;
      if (selectedSubjectId !== 'ALL' && c.subjectId !== selectedSubjectId) return false;
      if (selectedChapter !== 'ALL' && c.chapter !== selectedChapter) return false;
      if (selectedCourseId !== 'ALL' && c.id !== selectedCourseId) return false;
      return true;
    });
  }, [courses, subjects, selectedSemester, selectedSubjectId, selectedChapter, selectedCourseId, hasMultipleSemesters]);

  // Available chapters for the selected subject
  const availableChapters = useMemo(() => {
    if (selectedSubjectId === 'ALL') return [];
    return chapterDefs.filter((ch) => ch.subjectId === selectedSubjectId);
  }, [chapterDefs, selectedSubjectId]);

  // Available individual courses/séances for the selected subject / chapter
  const availableCoursesForFilter = useMemo(() => {
    if (selectedSubjectId === 'ALL') return [];
    return courses.filter((c) => {
      if (c.subjectId !== selectedSubjectId) return false;
      if (selectedChapter !== 'ALL' && c.chapter !== selectedChapter) return false;
      return true;
    });
  }, [courses, selectedSubjectId, selectedChapter]);

  // Filtered Due Cards
  const dueCardsList = useMemo(() => {
    let list: ReviewCardItem[] = [];
    if (reviews.dueCards && reviews.dueCards.length > 0) {
      list = reviews.dueCards;
    } else {
      courses.forEach((c) => {
        if (c.cards && c.cards.length > 0) {
          c.cards.forEach((card) => {
            list.push({
              ...card,
              lessonId: c.id,
              lessonTitle: c.title,
              subjectId: c.subjectId,
              subjectTitle: c.subjectTitle,
            });
          });
        }
      });
    }

    return list.filter((item) => {
      const sub = subjects.find((s) => s.id === item.subjectId);
      if (hasMultipleSemesters && selectedSemester !== 'ALL' && sub && sub.semester !== selectedSemester) return false;
      if (selectedSubjectId !== 'ALL' && item.subjectId !== selectedSubjectId) return false;
      if (selectedCourseId !== 'ALL' && item.lessonId !== selectedCourseId) return false;
      return true;
    });
  }, [reviews, courses, subjects, selectedSemester, selectedSubjectId, selectedCourseId, hasMultipleSemesters]);

  // Chapter Test cards
  const chapterTestCards = useMemo(() => {
    const list: Array<{ card: any; course: Course }> = [];
    filteredCourses.forEach((c) => {
      c.cards?.forEach((card) => {
        list.push({ card, course: c });
      });
    });
    return list;
  }, [filteredCourses]);

  // Photos with masks
  const schemaPhotos = useMemo(() => {
    const list: Array<{ photo: CoursePhoto; course: Course }> = [];
    filteredCourses.forEach((c) => {
      c.photos?.forEach((photo) => {
        list.push({ photo, course: c });
      });
    });
    return list;
  }, [filteredCourses]);

  // Handlers for Due cards
  const currentDueCard = dueCardsList[currentDueIndex] || null;

  const handleReviewAnswer = async (rating: 'again' | 'hard' | 'good' | 'easy') => {
    if (!currentDueCard) return;
    try {
      await submitCardReview({
        lessonId: currentDueCard.lessonId,
        cardId: currentDueCard.id,
        rating,
        answerLength: userDraftAnswer.length,
        answerSelection: selectedQcmOption !== null ? selectedQcmOption : undefined,
      });

      setReviewedInSessionCount((prev) => prev + 1);
      setIsDueAnswerRevealed(false);
      setUserDraftAnswer('');
      setSelectedQcmOption(null);

      if (currentDueIndex < dueCardsList.length - 1) {
        setCurrentDueIndex((prev) => prev + 1);
      } else {
        // finished batch
        setCurrentDueIndex(0);
      }
    } catch (err) {
      console.error('Error submitting review:', err);
    }
  };

  // Handlers for Oral Exam
  const startOralSession = () => {
    setOralStarted(true);
    setOralTimerSeconds(oralDuration * 60);
    setIsOralTimerRunning(true);
  };

  const finishOralSession = async () => {
    const sub = subjects.find((s) => s.id === oralSubjectId);
    await saveRevisionSession({
      date: new Date().toISOString(),
      durationMinutes: oralDuration,
      type: 'oral-exam',
      subjectId: oralSubjectId,
      subjectTitle: sub?.title || '',
      cardsReviewedCount: 5,
      scorePercent: oralScore,
      summaryNotes: oralNotes,
    });
    setOralStarted(false);
    alert('Session orale enregistrée avec succès dans ton historique !');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 animate-fadeIn">
      {/* 1. Header Hub Anki & Entraînement */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-accent-green" />
            Centre d'entraînement & Répétition espacée
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Optimise ta rétention mnésique via le rappel actif, les flashcards Anki et la simulation orale.
          </p>
        </div>

        {/* Mini stats */}
        <div className="flex items-center gap-3 bg-surface border border-border p-2.5 px-4 rounded-xl text-xs">
          <div>
            <span className="text-zinc-400">Dues aujourd'hui :</span>{' '}
            <strong className="text-white font-mono">{dueCardsList.length}</strong>
          </div>
          <span className="text-zinc-600">•</span>
          <div>
            <span className="text-zinc-400">Révisées en session :</span>{' '}
            <strong className="text-accent-green font-mono">{reviewedInSessionCount}</strong>
          </div>
        </div>
      </div>

      {/* 2. Barre de Filtre Compacte */}
      <div className="p-3.5 rounded-2xl bg-surface border border-border flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 font-medium text-zinc-400">
            <Filter className="w-3.5 h-3.5 text-accent-blue" />
            <span>Filtres :</span>
          </div>

          {/* Semestre (Affiché UNIQUEMENT si le cursus a plusieurs semestres distincts S1/S2) */}
          {hasMultipleSemesters && (
            <div className="flex items-center bg-surface-elevated rounded-lg p-0.5 border border-border-subtle">
              <button
                onClick={() => {
                  setSelectedSemester('ALL');
                  setSelectedSubjectId('ALL');
                  setSelectedCourseId('ALL');
                }}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  selectedSemester === 'ALL'
                    ? 'bg-accent-blue text-white font-medium shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Tous
              </button>
              <button
                onClick={() => {
                  setSelectedSemester('S1');
                  setSelectedSubjectId('ALL');
                  setSelectedCourseId('ALL');
                }}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  selectedSemester === 'S1'
                    ? 'bg-accent-blue text-white font-medium shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                S1
              </button>
              <button
                onClick={() => {
                  setSelectedSemester('S2');
                  setSelectedSubjectId('ALL');
                  setSelectedCourseId('ALL');
                }}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  selectedSemester === 'S2'
                    ? 'bg-accent-blue text-white font-medium shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                S2
              </button>
            </div>
          )}

          {/* Dropdown Matière */}
          <select
            value={selectedSubjectId}
            onChange={(e) => {
              setSelectedSubjectId(e.target.value);
              setSelectedChapter('ALL');
              setSelectedCourseId('ALL');
            }}
            className="bg-surface-elevated border border-border-subtle rounded-lg px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-accent-blue"
          >
            <option value="ALL">Toutes les matières ({subjects.length})</option>
            {filteredSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.ects} ECTS)
              </option>
            ))}
          </select>

          {/* Dropdown Chapitre (si matière sélectionnée) */}
          {selectedSubjectId !== 'ALL' && availableChapters.length > 0 && (
            <select
              value={selectedChapter}
              onChange={(e) => {
                setSelectedChapter(e.target.value);
                setSelectedCourseId('ALL');
              }}
              className="bg-surface-elevated border border-border-subtle rounded-lg px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-accent-blue max-w-[200px] truncate"
            >
              <option value="ALL">Tous les chapitres</option>
              {availableChapters.map((ch) => (
                <option key={ch.id} value={ch.title}>
                  {ch.title}
                </option>
              ))}
            </select>
          )}

          {/* Dropdown Cours / Séance spécifique (Micro-Ancrage) */}
          {selectedSubjectId !== 'ALL' && availableCoursesForFilter.length > 0 && (
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="bg-surface-elevated border border-border-subtle rounded-lg px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-accent-blue max-w-[190px] truncate"
            >
              <option value="ALL">Toutes les séances ({availableCoursesForFilter.length})</option>
              {availableCoursesForFilter.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}
        </div>

        <span className="text-zinc-500 font-medium">
          {filteredCourses.length} cours ciblés
        </span>
      </div>

      {/* 3. Les Sous-Onglets Cognitifs avec Hub de Priorités en 1er */}
      <div className="border-b border-border">
        <nav className="flex items-center gap-5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('hub')}
            className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'hub' ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Mes Priorités du Jour</span>
            {activeTab === 'hub' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('due')}
            className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'due' ? 'text-accent-green' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Questions dues ({dueCardsList.length})</span>
            {activeTab === 'due' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-green rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('interleaved')}
            className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'interleaved' ? 'text-accent-blue' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Shuffle className="w-4 h-4" />
            <span>Séance Panachée ({interleavedCards.length})</span>
            {activeTab === 'interleaved' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('traps')}
            className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'traps' ? 'text-accent-red' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Carnet de Pièges ({trapCards.length})</span>
            {activeTab === 'traps' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-red rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('chapters')}
            className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'chapters' ? 'text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Tests par chapitre</span>
            {activeTab === 'chapters' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-300 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('schemas')}
            className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'schemas' ? 'text-accent-purple' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Schémas masqués ({schemaPhotos.length})</span>
            {activeTab === 'schemas' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-purple rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('oral')}
            className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'oral' ? 'text-accent-orange' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>Examen oral</span>
            {activeTab === 'oral' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-orange rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('weaknesses')}
            className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'weaknesses' ? 'text-accent-red' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Notions fragiles ({weaknesses.length})</span>
            {activeTab === 'weaknesses' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-red rounded-full" />
            )}
          </button>
        </nav>
      </div>

      {/* 4. Contenu des Sous-Onglets */}

      {/* Explication Pédagogique du Mode Actif */}
      <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border-subtle flex items-center gap-2.5 text-xs text-zinc-300">
        <span className="text-base">
          {activeTab === 'hub' ? '🎯' : activeTab === 'due' ? '⚡' : activeTab === 'interleaved' ? '🔀' : activeTab === 'traps' ? '⚠️' : activeTab === 'chapters' ? '📖' : activeTab === 'schemas' ? '🖼️' : activeTab === 'oral' ? '🎙️' : '🚨'}
        </span>
        <div>
          {activeTab === 'hub' && (
            <p><strong>Cockpit des Priorités :</strong> L'algorithme FSRS-5 analyse tes forces, tes cartes arrivées à échéance et tes pièges d'examen pour te guider sans surcharge cognitive.</p>
          )}
          {activeTab === 'due' && (
            <p><strong>Répétition Espacée FSRS-5 :</strong> Révise tes cartes au moment optimal calculé par la courbe de rétention mémoire. Travaille à ton rythme, sans chrono imposé.</p>
          )}
          {activeTab === 'interleaved' && (
            <p><strong>Séance Panachée (Entrelacement) :</strong> Alterne les questions de différentes matières pour stimuler la plasticité et l'agilité mentale.</p>
          )}
          {activeTab === 'traps' && (
            <p><strong>Carnet de Pièges (Hypercorrection) :</strong> Rebalaye de manière ciblée tes erreurs récentes et les pièges d'examen signalés en cours d'amphi.</p>
          )}
          {activeTab === 'chapters' && (
            <p><strong>Tests par Chapitre :</strong> Révise en profondeur l'ensemble des notions associées à un chapitre spécifique.</p>
          )}
          {activeTab === 'schemas' && (
            <p><strong>Schémas Masqués (Double Codage) :</strong> Clique sur les zones masquées pour vérifier la mémorisation des figures d'amphi.</p>
          )}
          {activeTab === 'oral' && (
            <p><strong>Simulation d'Oral :</strong> Tire une question d'examen et structure ta réponse à voix haute en conditions réelles.</p>
          )}
          {activeTab === 'weaknesses' && (
            <p><strong>Notions Fragiles :</strong> Concepts ayant généré des erreurs récurrentes nécessitant une consolidation immédiate.</p>
          )}
        </div>
      </div>

      {/* ONGLET 0 : HUB DES PRIORITÉS DU JOUR */}
      {activeTab === 'hub' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Bannière de lancement rapide */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-blue-500/10 border border-amber-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                  Recommandation IA
                </span>
                <span className="text-xs text-zinc-400 font-medium">Programme d'aujourd'hui</span>
              </div>
              <h2 className="text-lg font-bold text-white">
                {dueCardsList.length > 0
                  ? `Tu as ${dueCardsList.length} carte${dueCardsList.length > 1 ? 's' : ''} FSRS à réviser aujourd'hui`
                  : 'Toutes tes cartes espacées sont à jour !'}
              </h2>
              <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
                Priorise l'ancrage à l'échelle de chaque cours d'amphi, puis consolide au niveau du chapitre complet et de la séance panachée.
              </p>
            </div>

            <button
              onClick={() => {
                if (dueCardsList.length > 0) setActiveTab('due');
                else if (trapCards.length > 0) setActiveTab('traps');
                else setActiveTab('interleaved');
              }}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-zinc-950 text-xs font-bold transition-all shadow-lg flex items-center gap-2 shrink-0"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Démarrer ma séance prioritaire (15 min)</span>
            </button>
          </div>

          {/* Grille des 4 Paliers de Priorité */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Priorité 1 : Pièges & Erreurs */}
            <div className="p-5 rounded-2xl bg-surface border border-rose-500/20 space-y-4 hover:border-rose-500/40 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-rose-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    1. Urgences & Pièges d'Examen
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/20">
                    {trapCards.length + weaknesses.length} points d'attention
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white">Carnet de Pièges & Notions Fragiles</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Revois immédiatement les cartes où tu as hésité ou échoué avant qu'elles ne s'effacent de ta mémoire.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('traps')}
                className="w-full py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <span>Réviser les pièges ({trapCards.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Priorité 2 : Micro-Ancrage par Cours */}
            <div className="p-5 rounded-2xl bg-surface border border-amber-500/20 space-y-4 hover:border-amber-500/40 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-amber-400 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-amber-400" />
                    2. Séances & Amphis Récents
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/20">
                    {courses.length} cours créés
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white">Micro-Ancrage par Séance de Cours</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Révise un cours d'amphi spécifique juste après l'avoir suivi pour ancrer ses 3 à 5 notions fondamentales.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('chapters')}
                className="w-full py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <span>Choisir un cours ou chapitre</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Priorité 3 : Pile FSRS-5 Due */}
            <div className="p-5 rounded-2xl bg-surface border border-emerald-500/20 space-y-4 hover:border-emerald-500/40 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    3. Répétition Espacée FSRS-5
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                    {dueCardsList.length} cartes prêtes
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white">Pile de Cartes Dues Aujourd'hui</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Calculé scientifiquement par l'algorithme FSRS-5 pour réviser juste au moment où la rétention commence à baisser.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('due')}
                className="w-full py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <span>Lancer la pile FSRS ({dueCardsList.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Priorité 4 : Séance Panachée */}
            <div className="p-5 rounded-2xl bg-surface border border-cyan-500/20 space-y-4 hover:border-cyan-500/40 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-cyan-400 flex items-center gap-1.5">
                    <Shuffle className="w-4 h-4 text-cyan-400" />
                    4. Séance Panachée (Interleaving)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">
                    {interleavedCards.length} questions croisées
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white">Entraînement Multi-Matières</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Alterne les matières et les chapitres pour stimuler l'agilité mentale et éviter les faux automatismes de récence.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('interleaved')}
                className="w-full py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <span>Démarrer le panachage</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOUS-ONGLET 1 : QUESTIONS DUES (Hub Anki) */}
      {activeTab === 'due' && (
        <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
          {dueCardsList.length === 0 ? (
            <div className="p-12 text-center bg-surface rounded-2xl border border-border space-y-3">
              <CheckCircle2 className="w-12 h-12 text-accent-green mx-auto" />
              <h3 className="text-base font-bold text-white">Tout est à jour pour aujourd'hui !</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Tu as complété toutes les cartes dues selon l'algorithme de répétition espacée.
              </p>
            </div>
          ) : currentDueCard ? (
            <div className="p-6 rounded-2xl bg-surface border border-border space-y-6 shadow-xl">
              {/* Card Meta Header */}
              <div className="flex items-center justify-between text-xs pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-surface-elevated text-zinc-300 font-medium">
                    {currentDueCard.subjectTitle}
                  </span>
                  <span className="text-zinc-500 font-mono">
                    Carte {currentDueIndex + 1} / {dueCardsList.length}
                  </span>
                </div>
                <span className="text-[11px] uppercase font-bold text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded">
                  {currentDueCard.kind || 'Rappel actif'}
                </span>
              </div>

              {/* Card Question */}
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-white leading-relaxed">
                  {currentDueCard.question}
                </h3>

                {/* QCM Options if available */}
                {currentDueCard.options && currentDueCard.options.length > 0 && (
                  <div className="space-y-2 pt-2">
                    {currentDueCard.options.map((opt, i) => {
                      const optText = typeof opt === 'string' ? opt : opt.text || opt.label || '';
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedQcmOption(i)}
                          className={`w-full p-3 rounded-xl text-xs text-left border transition-all flex items-center justify-between ${
                            selectedQcmOption === i
                              ? 'bg-accent-blue/15 border-accent-blue text-white'
                              : 'bg-surface-elevated border-border-subtle text-zinc-300 hover:border-zinc-700'
                          }`}
                        >
                          <span>
                            <strong className="mr-2 font-mono text-zinc-500">
                              {String.fromCharCode(65 + i)}.
                            </strong>
                            {optText}
                          </span>
                          {isDueAnswerRevealed && i === currentDueCard.correctOption && (
                            <Check className="w-4 h-4 text-accent-green" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Free answer draft textarea */}
                {!currentDueCard.options && (
                  <textarea
                    value={userDraftAnswer}
                    onChange={(e) => setUserDraftAnswer(e.target.value)}
                    placeholder="Écris mentalement ou saisis ici ta réponse avant de vérifier..."
                    rows={3}
                    className="w-full bg-surface-elevated border border-border rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-accent-blue"
                  />
                )}
              </div>

              {/* Reveal / Answer section */}
              {!isDueAnswerRevealed ? (
                <button
                  onClick={() => setIsDueAnswerRevealed(true)}
                  className="w-full py-3 rounded-xl bg-accent-blue hover:bg-accent-blue/90 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>Afficher la réponse attendue</span>
                </button>
              ) : (
                <div className="space-y-5 pt-4 border-t border-border animate-fadeIn">
                  <div className="p-4 rounded-xl bg-surface-elevated border border-border-subtle space-y-3">
                    <div>
                      <strong className="text-xs text-accent-green uppercase tracking-wider block mb-1">
                        Réponse modèle :
                      </strong>
                      <p className="text-xs text-zinc-100 leading-relaxed">
                        {currentDueCard.answer}
                      </p>
                    </div>

                    {currentDueCard.keywords && currentDueCard.keywords.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-2">
                        <span className="text-[11px] text-zinc-400 font-semibold">
                          Mots-clés requis :
                        </span>
                        {currentDueCard.keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}

                    {currentDueCard.trap && (
                      <div className="text-[11px] text-accent-orange bg-accent-orange/10 p-2.5 rounded-lg border border-accent-orange/20">
                        ⚠️ <strong>Piège fréquent :</strong> {currentDueCard.trap}
                      </div>
                    )}

                    {/* DUAL CODING : PHOTO DU TABLEAU SI DISPONIBLE */}
                    {(() => {
                      const course = courses.find((c) => c.id === currentDueCard.lessonId);
                      const photo = course?.photos?.[0];
                      if (!photo?.url) return null;
                      return (
                        <div className="mt-3 p-3 bg-black/40 rounded-xl border border-border-subtle space-y-2">
                          <span className="text-[11px] font-bold text-accent-blue flex items-center gap-1.5">
                            📷 Photo du tableau associée (Double codage)
                          </span>
                          <img src={photo.url} alt="Photo tableau" className="max-h-48 rounded-lg object-contain mx-auto" />
                        </div>
                      );
                    })()}

                    {/* DÉFI FEYNMAN 60S */}
                    <div className="pt-2">
                      {!isFeynmanOpen ? (
                        <button
                          onClick={() => setIsFeynmanOpen(true)}
                          className="text-xs text-accent-orange hover:underline font-semibold flex items-center gap-1.5"
                        >
                          🧠 Défi Feynman (Explique en 60s avec tes mots)
                        </button>
                      ) : (
                        <div className="p-3 bg-surface rounded-xl border border-accent-orange/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-accent-orange">🧠 Défi Feynman : Pourquoi & Comment ?</span>
                            <button onClick={() => setIsFeynmanOpen(false)} className="text-xs text-zinc-400 hover:text-white">✕</button>
                          </div>
                          <textarea
                            value={feynmanText}
                            onChange={(e) => setFeynmanText(e.target.value)}
                            placeholder="Explique le mécanisme causal comme si tu l'expliquais à un débutant..."
                            rows={2}
                            className="w-full bg-black/40 border border-border rounded-lg p-2 text-xs text-white"
                          />
                          <button
                            onClick={async () => {
                              if (!feynmanText.trim()) return;
                              setIsFeynmanEvaluating(true);
                              const res = await evaluateFeynman(currentDueCard.lessonId, currentDueCard.id, feynmanText.trim());
                              setFeynmanFeedback(res);
                              setIsFeynmanEvaluating(false);
                            }}
                            disabled={isFeynmanEvaluating || !feynmanText.trim()}
                            className="px-3 py-1.5 bg-accent-orange text-black font-bold text-xs rounded-lg hover:bg-accent-orange/90 disabled:opacity-50"
                          >
                            {isFeynmanEvaluating ? 'Analyse...' : '⚡ Évaluer mon explication'}
                          </button>
                          {feynmanFeedback && (
                            <div className="p-2.5 bg-black/50 rounded-lg border border-accent-orange/20 text-xs space-y-1">
                              <div className="flex items-center justify-between font-bold text-white">
                                <span>Score : {feynmanFeedback.score}/100</span>
                                <span className="text-[10px] text-accent-orange">Causalité : {feynmanFeedback.causalScore}%</span>
                              </div>
                              <p className="text-zinc-300">{feynmanFeedback.feedback}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4 Boutons Anki FSRS-5 */}
                  <div className="space-y-2">
                    <span className="text-xs text-zinc-400 font-medium block text-center">
                      Auto-évaluation de la restitution :
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <button
                        onClick={() => handleReviewAnswer('again')}
                        className="p-3 rounded-xl bg-accent-red/10 hover:bg-accent-red/20 text-accent-red border border-accent-red/30 transition-all flex flex-col items-center gap-1"
                      >
                        <span className="text-xs font-bold">À revoir</span>
                        <span className="text-[10px] opacity-80">&lt; 1 jour</span>
                      </button>

                      <button
                        onClick={() => handleReviewAnswer('hard')}
                        className="p-3 rounded-xl bg-accent-orange/10 hover:bg-accent-orange/20 text-accent-orange border border-accent-orange/30 transition-all flex flex-col items-center gap-1"
                      >
                        <span className="text-xs font-bold">Difficile</span>
                        <span className="text-[10px] opacity-80">1 jour</span>
                      </button>

                      <button
                        onClick={() => handleReviewAnswer('good')}
                        className="p-3 rounded-xl bg-accent-blue/10 hover:bg-accent-blue/20 text-accent-blue border border-accent-blue/30 transition-all flex flex-col items-center gap-1"
                      >
                        <span className="text-xs font-bold">Bon</span>
                        <span className="text-[10px] opacity-80">3-4 jours</span>
                      </button>

                      <button
                        onClick={() => handleReviewAnswer('easy')}
                        className="p-3 rounded-xl bg-accent-green/10 hover:bg-accent-green/20 text-accent-green border border-accent-green/30 transition-all flex flex-col items-center gap-1"
                      >
                        <span className="text-xs font-bold">Facile</span>
                        <span className="text-[10px] opacity-80">7+ jours</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* SOUS-ONGLET 2 : SÉANCE PANACHÉE (INTERLEAVING) */}
      {activeTab === 'interleaved' && (
        <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
          {interleavedCards.length === 0 ? (
            <div className="p-8 text-center bg-surface rounded-xl border border-border text-xs text-zinc-400">
              Aucune carte disponible pour la séance panachée.
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-surface border border-accent-blue/30 space-y-6 shadow-xl">
              <div className="flex items-center justify-between text-xs pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-accent-blue/20 text-accent-blue font-bold">
                    🔀 Panachage : {interleavedCards[interleavedIndex]?.subjectTitle || 'Matière'}
                  </span>
                  <span className="text-zinc-500 font-mono">
                    Carte {interleavedIndex + 1} / {interleavedCards.length}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-zinc-400">
                  {interleavedCards[interleavedIndex]?.courseTitle}
                </span>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">
                  {interleavedCards[interleavedIndex]?.question}
                </h3>

                {!isInterleavedRevealed ? (
                  <button
                    onClick={() => setIsInterleavedRevealed(true)}
                    className="w-full py-3 rounded-xl bg-accent-blue hover:bg-accent-blue/90 text-white text-xs font-bold transition-all"
                  >
                    Afficher la réponse
                  </button>
                ) : (
                  <div className="space-y-4 pt-4 border-t border-border animate-fadeIn">
                    <div className="p-4 rounded-xl bg-surface-elevated border border-border-subtle">
                      <strong className="text-xs text-accent-green block mb-1">RÉPONSE MODÈLE :</strong>
                      <p className="text-xs text-zinc-100">{interleavedCards[interleavedIndex]?.answer}</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        onClick={async () => {
                          const card = interleavedCards[interleavedIndex];
                          await submitCardReview({ lessonId: card.courseId, cardId: card.id, rating: 'again' });
                          setIsInterleavedRevealed(false);
                          setInterleavedIndex((prev) => (prev + 1) % interleavedCards.length);
                        }}
                        className="p-2.5 rounded-lg bg-accent-red/20 text-accent-red font-bold text-xs"
                      >
                        À revoir
                      </button>
                      <button
                        onClick={async () => {
                          const card = interleavedCards[interleavedIndex];
                          await submitCardReview({ lessonId: card.courseId, cardId: card.id, rating: 'hard' });
                          setIsInterleavedRevealed(false);
                          setInterleavedIndex((prev) => (prev + 1) % interleavedCards.length);
                        }}
                        className="p-2.5 rounded-lg bg-accent-orange/20 text-accent-orange font-bold text-xs"
                      >
                        Difficile
                      </button>
                      <button
                        onClick={async () => {
                          const card = interleavedCards[interleavedIndex];
                          await submitCardReview({ lessonId: card.courseId, cardId: card.id, rating: 'good' });
                          setIsInterleavedRevealed(false);
                          setInterleavedIndex((prev) => (prev + 1) % interleavedCards.length);
                        }}
                        className="p-2.5 rounded-lg bg-accent-blue/20 text-accent-blue font-bold text-xs"
                      >
                        Correct
                      </button>
                      <button
                        onClick={async () => {
                          const card = interleavedCards[interleavedIndex];
                          await submitCardReview({ lessonId: card.courseId, cardId: card.id, rating: 'easy' });
                          setIsInterleavedRevealed(false);
                          setInterleavedIndex((prev) => (prev + 1) % interleavedCards.length);
                        }}
                        className="p-2.5 rounded-lg bg-accent-green/20 text-accent-green font-bold text-xs"
                      >
                        Facile
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SOUS-ONGLET 3 : CARNET DE PIÈGES (HYPERCORRECTION) */}
      {activeTab === 'traps' && (
        <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
          {trapCards.length === 0 ? (
            <div className="p-8 text-center bg-surface rounded-xl border border-border text-xs text-zinc-400">
              Aucun piège identifié ni erreur récente. Félicitations !
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-surface border border-accent-red/30 space-y-6 shadow-xl">
              <div className="flex items-center justify-between text-xs pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-accent-red/20 text-accent-red font-bold">
                    ⚠️ {trapCards[trapIndex]?.isFailed ? 'Erreur récente' : 'Piège exam'}
                  </span>
                  <span className="text-zinc-500 font-mono">
                    Carte {trapIndex + 1} / {trapCards.length}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-zinc-400">
                  {trapCards[trapIndex]?.courseTitle}
                </span>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">
                  {trapCards[trapIndex]?.question}
                </h3>

                {!isTrapRevealed ? (
                  <button
                    onClick={() => setIsTrapRevealed(true)}
                    className="w-full py-3 rounded-xl bg-accent-red hover:bg-accent-red/90 text-white text-xs font-bold transition-all"
                  >
                    Afficher le piège & la réponse
                  </button>
                ) : (
                  <div className="space-y-4 pt-4 border-t border-border animate-fadeIn">
                    {trapCards[trapIndex]?.trap && (
                      <div className="p-3.5 bg-accent-red/10 border border-accent-red/30 rounded-xl text-xs text-accent-red">
                        <strong>⚠️ PIÈGE FRÉQUENT :</strong> {trapCards[trapIndex]?.trap}
                      </div>
                    )}
                    <div className="p-4 rounded-xl bg-surface-elevated border border-border-subtle">
                      <strong className="text-xs text-accent-green block mb-1">RÉPONSE MODÈLE :</strong>
                      <p className="text-xs text-zinc-100">{trapCards[trapIndex]?.answer}</p>
                    </div>

                    <button
                      onClick={async () => {
                        const card = trapCards[trapIndex];
                        await submitCardReview({ lessonId: card.courseId, cardId: card.id, rating: 'good' });
                        setIsTrapRevealed(false);
                        setTrapIndex((prev) => (prev + 1) % trapCards.length);
                      }}
                      className="w-full py-2.5 rounded-lg bg-accent-green/20 text-accent-green font-bold text-xs"
                    >
                      ✓ Marquer comme maîtrisé & passer au piège suivant
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SOUS-ONGLET 2 : TESTS PAR CHAPITRE */}
      {activeTab === 'chapters' && (
        <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
          {chapterTestCards.length === 0 ? (
            <div className="p-8 text-center bg-surface rounded-xl border border-border text-xs text-zinc-400">
              Aucune question disponible pour les filtres sélectionnés.
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-surface border border-border space-y-6">
              <div className="flex items-center justify-between text-xs pb-4 border-b border-border">
                <span className="text-zinc-400">
                  Question {chapterTestIndex + 1} / {chapterTestCards.length}
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-elevated text-zinc-300">
                  {chapterTestCards[chapterTestIndex]?.course.chapter || 'Général'}
                </span>
              </div>

              <div className="space-y-4">
                <h3 className="text-base font-bold text-white">
                  {chapterTestCards[chapterTestIndex]?.card.question}
                </h3>

                {!isChapterAnswerRevealed ? (
                  <button
                    onClick={() => setIsChapterAnswerRevealed(true)}
                    className="w-full py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-muted text-xs font-semibold text-zinc-200 border border-border"
                  >
                    Vérifier la réponse
                  </button>
                ) : (
                  <div className="p-4 rounded-xl bg-surface-elevated text-xs text-zinc-200 space-y-3 animate-fadeIn">
                    <p>{chapterTestCards[chapterTestIndex]?.card.answer}</p>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        onClick={() => {
                          setIsChapterAnswerRevealed(false);
                          if (chapterTestIndex < chapterTestCards.length - 1) {
                            setChapterTestIndex((prev) => prev + 1);
                          } else {
                            setChapterTestIndex(0);
                          }
                        }}
                        className="px-4 py-1.5 rounded-lg bg-accent-blue text-white text-xs font-semibold"
                      >
                        Question suivante →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SOUS-ONGLET 3 : SCHÉMAS MASQUÉS */}
      {activeTab === 'schemas' && (
        <div className="space-y-6 animate-fadeIn">
          {schemaPhotos.length === 0 ? (
            <div className="p-12 text-center bg-surface rounded-2xl border border-border text-xs text-zinc-400">
              Aucun schéma ou photo de tableau pour les matières sélectionnées.
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
              {/* Photo selector */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="text-xs text-zinc-300 font-medium">
                  Schéma {selectedPhotoIndex + 1} / {schemaPhotos.length} :{' '}
                  <strong className="text-white">
                    {schemaPhotos[selectedPhotoIndex]?.photo.label ||
                      schemaPhotos[selectedPhotoIndex]?.photo.name ||
                      'Schéma de cours'}
                  </strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (selectedPhotoIndex > 0) {
                        setSelectedPhotoIndex((prev) => prev - 1);
                        setOcclusionRevealed({});
                      }
                    }}
                    disabled={selectedPhotoIndex === 0}
                    className="px-3 py-1 bg-surface-elevated text-xs rounded-lg border border-border text-zinc-300 disabled:opacity-40"
                  >
                    ← Précédent
                  </button>
                  <button
                    onClick={() => {
                      if (selectedPhotoIndex < schemaPhotos.length - 1) {
                        setSelectedPhotoIndex((prev) => prev + 1);
                        setOcclusionRevealed({});
                      }
                    }}
                    disabled={selectedPhotoIndex === schemaPhotos.length - 1}
                    className="px-3 py-1 bg-surface-elevated text-xs rounded-lg border border-border text-zinc-300 disabled:opacity-40"
                  >
                    Suivant →
                  </button>
                </div>
              </div>

              {/* Photo Display */}
              {schemaPhotos[selectedPhotoIndex] && (
                <div className="relative rounded-xl overflow-hidden border border-border-subtle bg-black/50 flex items-center justify-center min-h-[350px]">
                  <img
                    src={
                      schemaPhotos[selectedPhotoIndex].photo.url ||
                      `/api/courses/photos?courseId=${encodeURIComponent(
                        schemaPhotos[selectedPhotoIndex].course.id
                      )}&file=${encodeURIComponent(
                        schemaPhotos[selectedPhotoIndex].photo.filename
                      )}`
                    }
                    alt="Schéma d'entraînement"
                    className="max-h-[500px] w-auto object-contain select-none"
                  />

                  {schemaPhotos[selectedPhotoIndex].photo.masks?.map((mask) => {
                    const isRev = !!occlusionRevealed[mask.id];
                    return (
                      <div
                        key={mask.id}
                        onClick={() =>
                          setOcclusionRevealed((prev) => ({ ...prev, [mask.id]: !prev[mask.id] }))
                        }
                        style={{
                          left: `${mask.x}%`,
                          top: `${mask.y}%`,
                          width: `${mask.width || mask.w || 10}%`,
                          height: `${mask.height || mask.h || 5}%`,
                        }}
                        className={`absolute cursor-pointer transition-all flex items-center justify-center text-center p-1 rounded ${
                          isRev
                            ? 'bg-accent-green/80 text-white text-xs font-bold backdrop-blur border border-accent-green'
                            : 'bg-accent-orange/90 text-white text-xs font-bold backdrop-blur border border-accent-orange/80'
                        }`}
                      >
                        {isRev ? mask.label || mask.solution || 'Révélé' : '?'}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SOUS-ONGLET 4 : EXAMEN ORAL */}
      {activeTab === 'oral' && (
        <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
          {!oralStarted ? (
            <div className="p-8 rounded-2xl bg-surface border border-border space-y-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent-orange/10 border border-accent-orange/20 flex items-center justify-center text-accent-orange mx-auto">
                <Mic className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Simulation d'Examen Oral</h2>
                <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
                  Tire un sujet au hasard, prends quelques minutes de préparation, puis structure ta réponse à voix haute comme devant le jury.
                </p>
              </div>

              <div className="max-w-md mx-auto text-left">
                <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                  Matière à tester :
                </label>
                <select
                  value={oralSubjectId}
                  onChange={(e) => setOralSubjectId(e.target.value)}
                  className="w-full bg-surface-elevated border border-border rounded-xl px-3 py-2.5 text-xs text-white"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.semester})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 text-left text-xs text-blue-200 leading-relaxed max-w-md mx-auto">
                💡 <strong>Méthode sans stress :</strong> Pas de compte à rebours. Découvre la question, prends le temps de poser tes idées, puis récite ou note ta réponse calmement.
              </div>

              <button
                onClick={startOralSession}
                className="px-6 py-3 rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white text-xs font-bold transition-all shadow-lg inline-flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                <span>Tirer une question & Commencer</span>
              </button>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-surface border border-border space-y-6">
              {/* Oral session live view */}
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent-orange" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Échange Socratique en cours (Sans chrono)
                  </span>
                </div>

                <span className="text-[11px] text-zinc-400 font-mono">
                  Prends ton temps
                </span>
              </div>

              {/* Question prompt */}
              <div className="p-4 rounded-xl bg-surface-elevated border border-border-subtle space-y-2">
                <span className="text-[11px] text-accent-orange font-semibold uppercase">
                  Question d'examen :
                </span>
                <p className="text-sm font-bold text-white">
                  « Expliquez les principes fondamentaux de cette matière, en distinguant les hypothèses centrales et les pièges d'interprétation. »
                </p>
              </div>

              {/* Restitution Notes */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">
                  Notes de structuration & Points abordés :
                </label>
                <textarea
                  value={oralNotes}
                  onChange={(e) => setOralNotes(e.target.value)}
                  rows={5}
                  placeholder="Note le plan suivi (I. Définitions, II. Mécanismes, III. Applications) et les éventuelles hésitations..."
                  className="w-full bg-surface-elevated border border-border rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-accent-orange"
                />
              </div>

              {/* Score slider & Finish */}
              <div className="p-4 rounded-xl bg-surface-elevated/50 border border-border space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-300">Auto-évaluation globale :</span>
                  <span className="font-bold text-accent-orange">{oralScore} / 100</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={oralScore}
                  onChange={(e) => setOralScore(Number(e.target.value))}
                  className="w-full accent-accent-orange"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setOralStarted(false)}
                  className="px-4 py-2 bg-surface-elevated text-zinc-400 text-xs rounded-xl hover:text-white"
                >
                  Annuler
                </button>
                <button
                  onClick={finishOralSession}
                  className="px-5 py-2.5 rounded-xl bg-accent-green hover:bg-accent-green/90 text-white text-xs font-bold transition-all"
                >
                  Terminer et sauvegarder le bilan
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SOUS-ONGLET 5 : NOTIONS FRAGILES */}
      {activeTab === 'weaknesses' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between bg-surface p-4 rounded-xl border border-border">
            <div>
              <h3 className="text-sm font-bold text-white">
                Notions nécessitant un renforcement ({weaknesses.length})
              </h3>
              <p className="text-xs text-zinc-400">
                Détectées automatiquement d'après tes erreurs répétées et tes temps de réponse
              </p>
            </div>
          </div>

          {weaknesses.length === 0 ? (
            <div className="p-12 text-center bg-surface rounded-2xl border border-border space-y-2">
              <Award className="w-10 h-10 text-accent-green mx-auto" />
              <h4 className="text-sm font-bold text-white">Aucune faiblesse critique !</h4>
              <p className="text-xs text-zinc-400">
                Toutes tes notions révisées affichent un taux de maîtrise satisfaisant.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {weaknesses.map((weak) => {
                const conceptLabel = weak.concept || weak.conceptId || weak.label || 'Concept';
                const subTitle = weak.subjectTitle || 'Matière';
                const fails = weak.failCount ?? weak.failureCount ?? 1;
                const successes = weak.successCount ?? 0;
                const rate =
                  weak.successRate !== undefined
                    ? Math.round(weak.successRate * 100)
                    : Math.round((successes / Math.max(1, successes + fails)) * 100);

                return (
                  <div
                    key={weak.id}
                    className="p-5 rounded-2xl bg-surface border border-border space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-accent-blue">
                          {subTitle}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-accent-red/10 text-accent-red font-mono font-bold">
                          {rate}% réussite ({fails} échecs)
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white">{conceptLabel}</h4>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {weak.suggestion || weak.feedback || 'Revoir la définition et les hypothèses.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-border/60 flex items-center justify-end">
                      <button
                        onClick={() => {
                          setActiveTab('due');
                          if (weak.subjectId) setSelectedSubjectId(weak.subjectId);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-accent-orange/10 hover:bg-accent-orange/20 text-accent-orange border border-accent-orange/30 text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <span>Renforcer</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
