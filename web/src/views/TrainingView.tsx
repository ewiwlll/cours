import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Mic,
  ChevronRight,
  Eye,
  Play,
  Filter,
  Check,
  ShieldAlert,
  RotateCcw,
  Layers,
  Copy,
} from 'lucide-react';
import {
  getSubjects,
  getStudyCourses,
  getReviews,
  getWeaknesses,
  submitCardReview,
  getChapterDefinitions,
  getExamTrapsAndErrors,
  syncPendingReviews,
} from '../lib/api';
import type {
  Subject,
  Course,
  ReviewStatus,
  ReviewCardItem,
  Weakness,
  ChapterDefinition,
} from '../lib/types';

interface TrainingViewProps {
  initialTab?: 'cards' | 'traps' | 'oral';
  initialSubjectId?: string;
  onOpenCourse?: (courseId: string) => void;
}

export const TrainingView: React.FC<TrainingViewProps> = ({
  initialTab = 'cards',
  initialSubjectId,
}) => {
  // 3 Modes d'Entraînement Clairs : 'cards' (Flashcards & QCM), 'traps' (Pièges & Erreurs), 'oral' (Oral Blanc Antigravity)
  const [activeMode, setActiveMode] = useState<'cards' | 'traps' | 'oral'>(
    initialTab === 'traps' ? 'traps' : initialTab === 'oral' ? 'oral' : 'cards'
  );

  // Filtres de portée de révision
  const [selectedSemester, setSelectedSemester] = useState<'ALL' | 'S1' | 'S2'>('ALL');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubjectId || 'ALL');
  const [selectedChapter, setSelectedChapter] = useState<string>('ALL');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('ALL');

  // Données
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
  const [trapCards, setTrapCards] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // État de révision des Flashcards (Mode 1)
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState<boolean>(false);
  const [userDraftAnswer, setUserDraftAnswer] = useState<string>('');
  const [selectedQcmOption, setSelectedQcmOption] = useState<number | null>(null);
  const [reviewedInSessionCount, setReviewedInSessionCount] = useState<number>(0);

  // État du Carnet de Pièges (Mode 2)
  const [trapIndex, setTrapIndex] = useState<number>(0);
  const [isTrapRevealed, setIsTrapRevealed] = useState<boolean>(false);

  // Défi Feynman (Explication avec ses mots)
  const [isFeynmanOpen, setIsFeynmanOpen] = useState<boolean>(false);
  const [feynmanText, setFeynmanText] = useState<string>('');

  // Copie de commande Antigravity
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        syncPendingReviews().catch(() => {});
        const [subList, courseList, reviewData, weakList, chapList, trapsList] = await Promise.all([
          getSubjects(),
          getStudyCourses(),
          getReviews(),
          getWeaknesses(),
          getChapterDefinitions(),
          getExamTrapsAndErrors(),
        ]);
        setSubjects(subList || []);
        setCourses(courseList || []);
        setReviews(
          reviewData || { dueCount: 0, totalCards: 0, todayReviewed: 0, dueCards: [] }
        );
        setWeaknesses(weakList || []);
        setChapterDefs(chapList || []);
        setTrapCards(trapsList || []);

        if (initialSubjectId && subList.some((s) => s.id === initialSubjectId)) {
          setSelectedSubjectId(initialSubjectId);
        }
      } catch (err) {
        console.error('Error loading training data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [initialSubjectId]);

  // Détection si la formation a plusieurs semestres S1 et S2 distincts
  const hasMultipleSemesters = useMemo(() => {
    const hasS1 = subjects.some((s) => s.semester === 'S1');
    const hasS2 = subjects.some((s) => s.semester === 'S2');
    return hasS1 && hasS2;
  }, [subjects]);

  // Matières filtrées
  const filteredSubjects = useMemo(() => {
    if (!hasMultipleSemesters || selectedSemester === 'ALL') return subjects;
    return subjects.filter((s) => s.semester === selectedSemester);
  }, [subjects, selectedSemester, hasMultipleSemesters]);

  // Chapitres disponibles pour la matière sélectionnée
  const availableChapters = useMemo(() => {
    if (selectedSubjectId === 'ALL') return [];
    return chapterDefs.filter((ch) => ch.subjectId === selectedSubjectId);
  }, [chapterDefs, selectedSubjectId]);

  // Séances / Cours individuels disponibles
  const availableCoursesForFilter = useMemo(() => {
    if (selectedSubjectId === 'ALL') return [];
    return courses.filter((c) => {
      if (c.subjectId !== selectedSubjectId) return false;
      if (selectedChapter !== 'ALL' && c.chapter !== selectedChapter) return false;
      return true;
    });
  }, [courses, selectedSubjectId, selectedChapter]);

  // Pile de cartes actives selon le périmètre choisi
  const targetCardsList = useMemo(() => {
    const list: ReviewCardItem[] = [];

    courses.forEach((c) => {
      // Filtres de périmètre
      const sub = subjects.find((s) => s.id === c.subjectId);
      if (hasMultipleSemesters && selectedSemester !== 'ALL' && sub && sub.semester !== selectedSemester) return;
      if (selectedSubjectId !== 'ALL' && c.subjectId !== selectedSubjectId) return;
      if (selectedChapter !== 'ALL' && c.chapter !== selectedChapter) return;
      if (selectedCourseId !== 'ALL' && c.id !== selectedCourseId) return;

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

    return list;
  }, [courses, subjects, selectedSemester, selectedSubjectId, selectedChapter, selectedCourseId, hasMultipleSemesters]);

  // Carte active
  const currentCard = targetCardsList[currentCardIndex] || null;

  // Validation d'une flashcard selon l'algorithme FSRS
  const handleReviewAnswer = async (rating: 'again' | 'hard' | 'good' | 'easy') => {
    if (!currentCard) return;
    try {
      await submitCardReview({
        lessonId: currentCard.lessonId,
        cardId: currentCard.id,
        rating,
        answerLength: userDraftAnswer.length,
        answerSelection: selectedQcmOption !== null ? selectedQcmOption : undefined,
      });

      setReviewedInSessionCount((prev) => prev + 1);
      setIsAnswerRevealed(false);
      setUserDraftAnswer('');
      setSelectedQcmOption(null);
      setIsFeynmanOpen(false);
      setFeynmanText('');

      if (currentCardIndex < targetCardsList.length - 1) {
        setCurrentCardIndex((prev) => prev + 1);
      } else {
        // Fin de la pile
        setCurrentCardIndex(0);
      }
    } catch (err) {
      console.error('Error submitting review:', err);
    }
  };

  // Validation d'une carte piège (Mode 2)
  const handleTrapAnswer = async (rating: 'again' | 'hard' | 'good' | 'easy') => {
    const currentTrap = trapCards[trapIndex];
    if (!currentTrap) return;
    try {
      await submitCardReview({
        lessonId: currentTrap.courseId || currentTrap.lessonId,
        cardId: currentTrap.id,
        rating,
      });
      setIsTrapRevealed(false);
      if (trapIndex < trapCards.length - 1) {
        setTrapIndex((prev) => prev + 1);
      } else {
        setTrapIndex(0);
        getExamTrapsAndErrors().then((t) => setTrapCards(t || []));
      }
    } catch (err) {
      console.error('Error reviewing trap card:', err);
    }
  };

  // Raccourcis Clavier Anki (Espace pour révéler, 1/2/3/4 pour noter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (activeMode === 'cards' && currentCard) {
        if (!isAnswerRevealed) {
          if (e.code === 'Space' || e.key === 'Enter') {
            e.preventDefault();
            setIsAnswerRevealed(true);
          }
        } else {
          if (e.key === '1' || e.key === '&') {
            e.preventDefault();
            handleReviewAnswer('again');
          } else if (e.key === '2' || e.key === 'é') {
            e.preventDefault();
            handleReviewAnswer('hard');
          } else if (e.key === '3' || e.key === '"') {
            e.preventDefault();
            handleReviewAnswer('good');
          } else if (e.key === '4' || e.key === "'") {
            e.preventDefault();
            handleReviewAnswer('easy');
          } else if (e.code === 'Space' || e.key === 'Enter') {
            e.preventDefault();
            handleReviewAnswer('good');
          }
        }
      } else if (activeMode === 'traps' && trapCards[trapIndex]) {
        if (!isTrapRevealed) {
          if (e.code === 'Space' || e.key === 'Enter') {
            e.preventDefault();
            setIsTrapRevealed(true);
          }
        } else {
          if (e.key === '1' || e.key === '&') {
            e.preventDefault();
            handleTrapAnswer('again');
          } else if (e.key === '2' || e.key === 'é') {
            e.preventDefault();
            handleTrapAnswer('hard');
          } else if (e.key === '3' || e.key === '"') {
            e.preventDefault();
            handleTrapAnswer('good');
          } else if (e.key === '4' || e.key === "'") {
            e.preventDefault();
            handleTrapAnswer('easy');
          } else if (e.code === 'Space' || e.key === 'Enter') {
            e.preventDefault();
            handleTrapAnswer('good');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMode, currentCard, isAnswerRevealed, currentCardIndex, targetCardsList.length, trapCards, trapIndex, isTrapRevealed]);

  // Prompt contextualisé selon le périmètre de sélection (Matière -> Chapitre -> Séance)
  const dynamicOralPrompt = useMemo(() => {
    if (selectedCourseId !== 'ALL') {
      const c = courses.find((item) => item.id === selectedCourseId);
      if (c) return `cours oral sur le cours "${c.title}" (${c.subjectTitle || 'Matière'})`;
    }
    if (selectedChapter !== 'ALL') {
      const sub = subjects.find((s) => s.id === selectedSubjectId);
      return `cours oral sur le chapitre "${selectedChapter}" (${sub?.title || 'Matière'})`;
    }
    if (selectedSubjectId !== 'ALL') {
      const sub = subjects.find((s) => s.id === selectedSubjectId);
      return `cours oral sur ${sub?.title || 'mon cours'}`;
    }
    return `cours oral sur l'ensemble de mes cours`;
  }, [selectedSubjectId, selectedChapter, selectedCourseId, subjects, courses]);

  const [isOralPrepared, setIsOralPrepared] = useState<boolean>(false);

  const handlePrepareAndCopyOral = async () => {
    const sub = subjects.find((s) => s.id === selectedSubjectId);
    const course = courses.find((c) => c.id === selectedCourseId);

    try {
      await fetch('/api/oral/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: selectedSubjectId !== 'ALL' ? selectedSubjectId : null,
          subjectTitle: sub?.title || null,
          chapter: selectedChapter !== 'ALL' ? selectedChapter : null,
          courseId: selectedCourseId !== 'ALL' ? selectedCourseId : null,
          courseTitle: course?.title || null,
          prompt: dynamicOralPrompt,
        }),
      });
    } catch (err) {
      console.error('Error preparing oral on server:', err);
    }

    navigator.clipboard.writeText(dynamicOralPrompt);
    setCopiedPrompt(true);
    setIsOralPrepared(true);
    setTimeout(() => {
      setCopiedPrompt(false);
    }, 4000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-fadeIn">
      {/* 1. En-tête Épuré */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-amber-400" />
            <span>Centre d'Entraînement & Répétition Espacée</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Révise à ton rythme jusqu'à maîtrise totale de tes cours, sans chrono stressant.
          </p>
        </div>

        {/* Compteurs de session */}
        <div className="flex items-center gap-3 bg-surface border border-border p-2.5 px-4 rounded-xl text-xs">
          <div>
            <span className="text-zinc-400">Cartes à réviser :</span>{' '}
            <strong className="text-white font-mono">{targetCardsList.length}</strong>
          </div>
          <span className="text-zinc-600">•</span>
          <div>
            <span className="text-zinc-400">Révisées aujourd'hui :</span>{' '}
            <strong className="text-emerald-400 font-mono">{reviewedInSessionCount + (reviews.todayReviewed || 0)}</strong>
          </div>
        </div>
      </div>

      {/* 2. Barre de Ciblage Limpide : Périmètre de Révision */}
      <div className="p-4 rounded-2xl bg-surface border border-border space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
          <span className="font-bold text-zinc-300 flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-purple-400" />
            <span>Périmètre de révision :</span>
          </span>

          <span className="text-zinc-400 font-medium">
            {targetCardsList.length} flashcard{targetCardsList.length > 1 ? 's' : ''} disponible{targetCardsList.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap text-xs">
          {/* Bouton Tout Réviser */}
          <button
            onClick={() => {
              setSelectedSubjectId('ALL');
              setSelectedChapter('ALL');
              setSelectedCourseId('ALL');
              setCurrentCardIndex(0);
              setIsAnswerRevealed(false);
            }}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all border ${
              selectedSubjectId === 'ALL'
                ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                : 'bg-surface-elevated border-border-subtle text-zinc-400 hover:text-zinc-200'
            }`}
          >
            🌐 Toutes les matières ({subjects.length})
          </button>

          {/* Semestre (Affiché UNIQUEMENT si pertinent) */}
          {hasMultipleSemesters && (
            <div className="flex items-center bg-surface-elevated rounded-xl p-0.5 border border-border-subtle">
              <button
                onClick={() => {
                  setSelectedSemester('ALL');
                  setSelectedSubjectId('ALL');
                }}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  selectedSemester === 'ALL' ? 'bg-purple-600 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Tous
              </button>
              <button
                onClick={() => {
                  setSelectedSemester('S1');
                  setSelectedSubjectId('ALL');
                }}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  selectedSemester === 'S1' ? 'bg-purple-600 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                S1
              </button>
              <button
                onClick={() => {
                  setSelectedSemester('S2');
                  setSelectedSubjectId('ALL');
                }}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  selectedSemester === 'S2' ? 'bg-purple-600 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
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
              setCurrentCardIndex(0);
              setIsAnswerRevealed(false);
            }}
            className="bg-surface-elevated border border-border-subtle rounded-xl px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-purple-500 font-medium"
          >
            <option value="ALL">Choisir une matière...</option>
            {filteredSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.ects} ECTS)
              </option>
            ))}
          </select>

          {/* Dropdown Chapitre */}
          {selectedSubjectId !== 'ALL' && availableChapters.length > 0 && (
            <select
              value={selectedChapter}
              onChange={(e) => {
                setSelectedChapter(e.target.value);
                setSelectedCourseId('ALL');
                setCurrentCardIndex(0);
                setIsAnswerRevealed(false);
              }}
              className="bg-surface-elevated border border-border-subtle rounded-xl px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-purple-500 max-w-[220px] truncate font-medium"
            >
              <option value="ALL">Tous les chapitres ({availableChapters.length})</option>
              {availableChapters.map((ch) => (
                <option key={ch.id} value={ch.title}>
                  {ch.title}
                </option>
              ))}
            </select>
          )}

          {/* Dropdown Séance spécifique (Micro-Ancrage) */}
          {selectedSubjectId !== 'ALL' && availableCoursesForFilter.length > 0 && (
            <select
              value={selectedCourseId}
              onChange={(e) => {
                setSelectedCourseId(e.target.value);
                setCurrentCardIndex(0);
                setIsAnswerRevealed(false);
              }}
              className="bg-surface-elevated border border-border-subtle rounded-xl px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-purple-500 max-w-[200px] truncate font-medium"
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
      </div>

      {/* 3. Les 3 Modes d'Entraînement Essentiels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-b border-border pb-4">
        {/* Mode 1 : Flashcards & QCM */}
        <button
          onClick={() => setActiveMode('cards')}
          className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
            activeMode === 'cards'
              ? 'bg-purple-500/10 border-purple-500/50 shadow-md ring-1 ring-purple-500/30'
              : 'bg-surface border-border hover:border-zinc-700'
          }`}
        >
          <div className={`p-2 rounded-xl shrink-0 ${activeMode === 'cards' ? 'bg-purple-600 text-white' : 'bg-surface-elevated text-zinc-400'}`}>
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white">1. Flashcards & QCM</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300">
                {targetCardsList.length}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
              Répétition espacée FSRS-5 pour mémoriser définitions, formules et mécanismes.
            </p>
          </div>
        </button>

        {/* Mode 2 : Carnet de Pièges & Erreurs */}
        <button
          onClick={() => setActiveMode('traps')}
          className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
            activeMode === 'traps'
              ? 'bg-rose-500/10 border-rose-500/50 shadow-md ring-1 ring-rose-500/30'
              : 'bg-surface border-border hover:border-zinc-700'
          }`}
        >
          <div className={`p-2 rounded-xl shrink-0 ${activeMode === 'traps' ? 'bg-rose-600 text-white' : 'bg-surface-elevated text-zinc-400'}`}>
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white">2. Mes Pièges & Erreurs</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">
                {trapCards.length + weaknesses.length}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
              Hypercorrection ciblée des cartes échouées et des confusions fréquentes.
            </p>
          </div>
        </button>

        {/* Mode 3 : Oral Blanc Studio Antigravity */}
        <button
          onClick={() => setActiveMode('oral')}
          className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
            activeMode === 'oral'
              ? 'bg-amber-500/10 border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
              : 'bg-surface border-border hover:border-zinc-700'
          }`}
        >
          <div className={`p-2 rounded-xl shrink-0 ${activeMode === 'oral' ? 'bg-amber-600 text-white' : 'bg-surface-elevated text-zinc-400'}`}>
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white">3. Oral Blanc Antigravity</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                Studio IA
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
              Interrogation orale socratique avec l'Agent Antigravity sur votre Mac.
            </p>
          </div>
        </button>
      </div>

      {/* 4. CONTENU DU MODE 1 : FLASHCARDS & QCM */}
      {activeMode === 'cards' && (
        <div className="space-y-6">
          {targetCardsList.length === 0 ? (
            <div className="p-12 text-center bg-surface rounded-2xl border border-border space-y-4 max-w-xl mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto text-purple-400">
                <BookOpen className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Aucune flashcard dans ce périmètre</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {selectedSubjectId === 'ALL'
                    ? "Vous n'avez pas encore enregistré de cours avec des flashcards. Allez dans l'onglet Matières ou Enregistrer pour créer votre première séance !"
                    : "Cette matière ou ce chapitre ne contient pas encore de cartes. Enregistrez un cours ou importez vos matières pour générer la batterie de cartes."}
                </p>
              </div>

              {selectedSubjectId !== 'ALL' && (
                <button
                  onClick={() => {
                    setSelectedSubjectId('ALL');
                    setSelectedChapter('ALL');
                    setSelectedCourseId('ALL');
                  }}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all"
                >
                  Voir toutes les matières
                </button>
              )}
            </div>
          ) : currentCard ? (
            <div className="max-w-2xl mx-auto p-6 rounded-2xl bg-surface border border-border space-y-6 shadow-xl">
              {/* Header carte */}
              <div className="flex items-center justify-between text-xs pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 font-bold">
                    {currentCard.subjectTitle || 'Matière'}
                  </span>
                  <span className="text-zinc-400 font-medium">
                    Carte {currentCardIndex + 1} / {targetCardsList.length}
                  </span>
                </div>
                <span className="text-[11px] uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                  {currentCard.kind || 'Flashcard FSRS'}
                </span>
              </div>

              {/* Question */}
              <div className="space-y-3">
                <h3 className="text-base md:text-lg font-bold text-white leading-relaxed">
                  {currentCard.question}
                </h3>

                {/* Options QCM */}
                {currentCard.options && currentCard.options.length > 0 && (
                  <div className="space-y-2 pt-2">
                    {currentCard.options.map((opt, i) => {
                      const optText = typeof opt === 'string' ? opt : (opt as any).text || (opt as any).label || '';
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedQcmOption(i)}
                          className={`w-full p-3 rounded-xl text-xs text-left border transition-all flex items-center justify-between ${
                            selectedQcmOption === i
                              ? 'bg-purple-500/20 border-purple-500 text-white'
                              : 'bg-surface-elevated border-border-subtle text-zinc-300 hover:border-zinc-700'
                          }`}
                        >
                          <span>
                            <strong className="mr-2 font-mono text-zinc-500">{String.fromCharCode(65 + i)}.</strong>
                            {optText}
                          </span>
                          {isAnswerRevealed && i === currentCard.correctOption && (
                            <Check className="w-4 h-4 text-emerald-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Zone de brouillon libre */}
                {!currentCard.options && (
                  <textarea
                    value={userDraftAnswer}
                    onChange={(e) => setUserDraftAnswer(e.target.value)}
                    placeholder="Écris mentalement ou saisis ici ta réponse avant de vérifier..."
                    rows={3}
                    className="w-full bg-surface-elevated border border-border rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-purple-500"
                  />
                )}
              </div>

              {/* Barre de progression de la séance */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Progression : Carte {currentCardIndex + 1} sur {targetCardsList.length}</span>
                  <span className="font-mono font-bold text-purple-300">
                    {Math.round(((currentCardIndex + 1) / targetCardsList.length) * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-surface-elevated rounded-full overflow-hidden border border-border-subtle">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${((currentCardIndex + 1) / targetCardsList.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Bouton Révéler la Réponse */}
              {!isAnswerRevealed ? (
                <button
                  onClick={() => setIsAnswerRevealed(true)}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>Afficher la réponse attendue</span>
                  <kbd className="ml-2 px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">Espace</kbd>
                </button>
              ) : (
                <div className="space-y-5 pt-3 border-t border-border animate-fadeIn">
                  {/* Réponse modèle */}
                  <div className="p-4 rounded-xl bg-surface-elevated border border-border-subtle space-y-3">
                    <div>
                      <strong className="text-xs text-emerald-400 uppercase tracking-wider block mb-1">
                        Réponse modèle :
                      </strong>
                      <p className="text-xs text-zinc-100 leading-relaxed">{currentCard.answer}</p>
                    </div>

                    {currentCard.keywords && currentCard.keywords.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-2">
                        <span className="text-[11px] text-zinc-400 font-semibold">Notions clés :</span>
                        {currentCard.keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/20"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}

                    {currentCard.trap && (
                      <div className="text-[11px] text-amber-300 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                        ⚠️ <strong>Piège d'examen fréquent :</strong> {currentCard.trap}
                      </div>
                    )}
                  </div>

                  {/* Boutons d'évaluation FSRS Anki avec raccourcis et intervalles prédictifs */}
                  <div className="space-y-2">
                    <span className="text-[11px] text-zinc-400 font-medium block text-center">
                      Auto-évaluation FSRS-5 (Raccourcis clavier 1, 2, 3, 4) :
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => handleReviewAnswer('again')}
                        className="p-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all text-center group"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <kbd className="px-1 py-0.2 rounded bg-rose-500/20 text-[9px] font-mono">1</kbd>
                          <span>À revoir</span>
                        </div>
                        <div className="text-[10px] text-rose-400 font-mono mt-0.5">&lt; 10 min</div>
                      </button>
                      <button
                        onClick={() => handleReviewAnswer('hard')}
                        className="p-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all text-center group"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <kbd className="px-1 py-0.2 rounded bg-amber-500/20 text-[9px] font-mono">2</kbd>
                          <span>Difficile</span>
                        </div>
                        <div className="text-[10px] text-amber-400 font-mono mt-0.5">1 jour</div>
                      </button>
                      <button
                        onClick={() => handleReviewAnswer('good')}
                        className="p-2.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-xs font-bold transition-all text-center group"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <kbd className="px-1 py-0.2 rounded bg-blue-500/20 text-[9px] font-mono">3</kbd>
                          <span>Correct</span>
                        </div>
                        <div className="text-[10px] text-blue-400 font-mono mt-0.5">3 jours</div>
                      </button>
                      <button
                        onClick={() => handleReviewAnswer('easy')}
                        className="p-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all text-center group"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <kbd className="px-1 py-0.2 rounded bg-emerald-500/20 text-[9px] font-mono">4</kbd>
                          <span>Facile</span>
                        </div>
                        <div className="text-[10px] text-emerald-400 font-mono mt-0.5">7 jours+</div>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* 5. CONTENU DU MODE 2 : CARNET DE PIÈGES (SESSION ACTIVE D'HYPERCORRECTION) */}
      {activeMode === 'traps' && (
        <div className="space-y-6">
          {trapCards.length === 0 ? (
            <div className="p-12 text-center bg-surface rounded-2xl border border-border space-y-3 max-w-xl mx-auto">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">Aucun piège actif détecté ! 🎉</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Toutes vos cartes révisées ont été réussies sans hésitation. Vos erreurs futures ou confusions d'amphi apparaîtront ici sous forme de cartes d'entraînement.
              </p>
            </div>
          ) : trapCards[trapIndex] ? (
            <div className="max-w-2xl mx-auto p-6 rounded-2xl bg-surface border border-rose-500/30 space-y-6 shadow-xl relative">
              {/* Badge supérieur */}
              <div className="flex items-center justify-between text-xs pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Focus Piège & Erreur</span>
                  </span>
                  <span className="text-zinc-400 font-medium">
                    Carte {trapIndex + 1} / {trapCards.length}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-rose-400">
                  {trapCards[trapIndex].subjectTitle || 'Matière'}
                </span>
              </div>

              {/* Barre de progression des pièges */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Désamorçage des pièges : {trapIndex + 1} sur {trapCards.length}</span>
                  <span className="font-mono font-bold text-rose-400">
                    {Math.round(((trapIndex + 1) / trapCards.length) * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-surface-elevated rounded-full overflow-hidden border border-border-subtle">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-300"
                    style={{ width: `${((trapIndex + 1) / trapCards.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question posée */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <span>⚠️ Question à haut risque de piège :</span>
                </div>
                <h3 className="text-base md:text-lg font-bold text-white leading-relaxed">
                  {trapCards[trapIndex].question || trapCards[trapIndex].title}
                </h3>

                {/* Options si QCM */}
                {trapCards[trapIndex].options && trapCards[trapIndex].options.length > 0 && (
                  <div className="space-y-2 pt-2">
                    {trapCards[trapIndex].options.map((opt: any, i: number) => {
                      const optText = typeof opt === 'string' ? opt : opt.text || opt.label || '';
                      return (
                        <div
                          key={i}
                          className="p-3 rounded-xl text-xs bg-surface-elevated border border-border-subtle text-zinc-300 flex items-center justify-between"
                        >
                          <span>
                            <strong className="mr-2 font-mono text-zinc-500">{String.fromCharCode(65 + i)}.</strong>
                            {optText}
                          </span>
                          {isTrapRevealed && i === trapCards[trapIndex].correctOption && (
                            <Check className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bouton Révéler le décodage du piège */}
              {!isTrapRevealed ? (
                <button
                  onClick={() => setIsTrapRevealed(true)}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>Démasquer le piège et vérifier ma réponse</span>
                  <kbd className="ml-2 px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">Espace</kbd>
                </button>
              ) : (
                <div className="space-y-5 pt-3 border-t border-border animate-fadeIn">
                  {/* Décryptage du piège */}
                  {trapCards[trapIndex].trap && (
                    <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200 space-y-1.5">
                      <strong className="text-rose-400 uppercase tracking-wider block font-bold flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4" />
                        <span>Le Piège classique d'examen :</span>
                      </strong>
                      <p className="leading-relaxed">{trapCards[trapIndex].trap}</p>
                    </div>
                  )}

                  {/* Réponse correcte */}
                  <div className="p-4 rounded-xl bg-surface-elevated border border-border-subtle space-y-1.5 text-xs">
                    <strong className="text-emerald-400 uppercase tracking-wider block font-bold">
                      ✅ La Bonne Méthode / Réponse :
                    </strong>
                    <p className="text-zinc-100 leading-relaxed">{trapCards[trapIndex].answer}</p>
                  </div>

                  {/* Boutons d'auto-évaluation pour sortir de la liste des pièges */}
                  <div className="space-y-2">
                    <span className="text-[11px] text-zinc-400 font-medium block text-center">
                      Avez-vous évité le piège cette fois-ci ?
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => handleTrapAnswer('again')}
                        className="p-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all text-center group"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <kbd className="px-1 py-0.2 rounded bg-rose-500/20 text-[9px] font-mono">1</kbd>
                          <span>Piégé</span>
                        </div>
                        <div className="text-[10px] text-rose-400 font-mono mt-0.5">&lt; 10 min</div>
                      </button>
                      <button
                        onClick={() => handleTrapAnswer('hard')}
                        className="p-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all text-center group"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <kbd className="px-1 py-0.2 rounded bg-amber-500/20 text-[9px] font-mono">2</kbd>
                          <span>Hésité</span>
                        </div>
                        <div className="text-[10px] text-amber-400 font-mono mt-0.5">1 jour</div>
                      </button>
                      <button
                        onClick={() => handleTrapAnswer('good')}
                        className="p-2.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-xs font-bold transition-all text-center group"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <kbd className="px-1 py-0.2 rounded bg-blue-500/20 text-[9px] font-mono">3</kbd>
                          <span>Déjoué</span>
                        </div>
                        <div className="text-[10px] text-blue-400 font-mono mt-0.5">2 jours</div>
                      </button>
                      <button
                        onClick={() => handleTrapAnswer('easy')}
                        className="p-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all text-center group"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <kbd className="px-1 py-0.2 rounded bg-emerald-500/20 text-[9px] font-mono">4</kbd>
                          <span>Maîtrisé</span>
                        </div>
                        <div className="text-[10px] text-emerald-400 font-mono mt-0.5">4 jours+</div>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* 6. CONTENU DU MODE 3 : ORAL BLANC STUDIO ANTIGRAVITY */}
      {activeMode === 'oral' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500 text-zinc-950">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Simulation d'Oral & Tuteur Socratique</h3>
                <span className="text-xs text-amber-300 font-medium">Studio Antigravity sur votre Mac</span>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Pour vous faire interroger à voix haute, réciter un chapitre sans chrono et obtenir un feedback approfondi avec des analogies de Feynman, utilisez directement le tuteur dans votre session Antigravity.
            </p>

            {/* Badges de contexte actif */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-zinc-400 font-medium">Cible sélectionnée :</span>
              {selectedSubjectId !== 'ALL' && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  {subjects.find((s) => s.id === selectedSubjectId)?.title}
                </span>
              )}
              {selectedChapter !== 'ALL' && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  📂 {selectedChapter}
                </span>
              )}
              {selectedCourseId !== 'ALL' && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  📄 {courses.find((c) => c.id === selectedCourseId)?.title}
                </span>
              )}
              {selectedSubjectId === 'ALL' && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  🌐 Ensemble des cours
                </span>
              )}
            </div>

            {/* Zone du Prompt Dynamique */}
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-black/60 border border-amber-500/30 flex items-center justify-between gap-3 text-xs font-mono text-amber-300">
                <span className="truncate">{dynamicOralPrompt}</span>
              </div>

              <button
                onClick={handlePrepareAndCopyOral}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                {copiedPrompt ? (
                  <>
                    <Check className="w-4 h-4 text-zinc-950 stroke-[3]" />
                    <span>✨ Session Enregistrée & Prompt Copié !</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-zinc-950" />
                    <span>🚀 Préparer & Lancer l'Oral dans Antigravity</span>
                  </>
                )}
              </button>
            </div>

            {isOralPrepared && (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 animate-fadeIn flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>
                  <strong>Parfait !</strong> La session a été sauvegardée. Ouvre Antigravity et colle le texte ou tape simplement <code className="bg-emerald-500/20 px-1 py-0.5 rounded font-mono font-bold">cours</code> pour démarrer !
                </span>
              </div>
            )}
          </div>

          <div className="p-5 rounded-2xl bg-surface border border-border space-y-3 text-xs text-zinc-400">
            <h4 className="font-bold text-white text-sm">💡 Comment ça fonctionne avec Antigravity ?</h4>
            <ul className="space-y-2 list-disc list-inside leading-relaxed">
              <li>L'agent IA analyse l'historique de vos cours et vos incompréhensions passées (<code className="text-purple-300">clarifications.json</code>).</li>
              <li>Il vous pose une question diagnostique ouverte sans chrono.</li>
              <li>Vous expliquez avec vos mots, et il évalue votre restitution avec bienveillance en vous expliquant le « pourquoi du comment ».</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
