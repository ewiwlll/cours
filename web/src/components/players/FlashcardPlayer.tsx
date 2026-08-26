import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  RotateCw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  XCircle,
  Trophy,
  Volume2,
  Layers,
  Flame,
  ArrowRight,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { Card, CardRating, FSRSSchedule } from '../../lib/types';
import { cn, playAudioFeedback } from '../../lib/utils';

interface FlashcardPlayerProps {
  cards: Card[];
  deckTitle?: string;
  onClose: () => void;
  onCardReviewed?: (cardId: string, rating: CardRating) => void;
  onSessionComplete?: (summary: {
    total: number;
    againCount: number;
    hardCount: number;
    goodCount: number;
    easyCount: number;
    accuracyPercent: number;
  }) => void;
  fsrsSchedule?: FSRSSchedule;
}

export const FlashcardPlayer: React.FC<FlashcardPlayerProps> = ({
  cards,
  deckTitle = 'Session de Révision Active',
  onClose,
  onCardReviewed,
  onSessionComplete,
  fsrsSchedule = {
    againInterval: '< 10 min',
    hardInterval: '+1 j',
    goodInterval: '+3 j',
    easyInterval: '+7 j',
  },
}) => {
  const [deck, setDeck] = useState<Card[]>(cards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Free text input recall state
  const [userTypedAnswer, setUserTypedAnswer] = useState('');
  const [showTypedEvaluation, setShowTypedEvaluation] = useState(false);

  // MCQ state
  const [selectedOption, setSelectedOption] = useState<string | number | null>(null);

  // Session Statistics
  const [stats, setStats] = useState({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });
  const [isCompleted, setIsCompleted] = useState(false);

  const currentCard: Card | undefined = deck[currentIndex];

  const totalCards = deck.length;
  const progressPercent = totalCards > 0 ? Math.round((currentIndex / totalCards) * 100) : 0;

  // Reset per-card state when index changes
  useEffect(() => {
    setIsFlipped(false);
    setUserTypedAnswer('');
    setShowTypedEvaluation(false);
    setSelectedOption(null);
  }, [currentIndex]);

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => {
      const next = !prev;
      playAudioFeedback('flip');
      return next;
    });
  }, []);

  const handleRating = useCallback(
    (rating: CardRating) => {
      if (!currentCard) return;

      // Play audio feedback based on rating
      if (rating === 1) playAudioFeedback('again');
      else if (rating === 2) playAudioFeedback('hard');
      else if (rating === 3) playAudioFeedback('good');
      else if (rating === 4) playAudioFeedback('easy');

      // Update statistics
      setStats((prev) => ({
        ...prev,
        again: rating === 1 ? prev.again + 1 : prev.again,
        hard: rating === 2 ? prev.hard + 1 : prev.hard,
        good: rating === 3 ? prev.good + 1 : prev.good,
        easy: rating === 4 ? prev.easy + 1 : prev.easy,
      }));

      onCardReviewed?.(currentCard.id, rating);

      // If "Again" (1), optionally re-insert card at end of session for reinforcement
      if (rating === 1 && deck.length > 1) {
        setDeck((prev) => [...prev, currentCard]);
      }

      // Check if finished
      if (currentIndex + 1 >= totalCards) {
        setIsCompleted(true);
        playAudioFeedback('success');
        const finalTotal = totalCards;
        const isCorrectRating = (typeof rating === 'number' && rating >= 3) || rating === 'good' || rating === 'easy';
        const correctCount = stats.good + stats.easy + (isCorrectRating ? 1 : 0);
        const accuracy = Math.round((correctCount / (finalTotal || 1)) * 100);
        onSessionComplete?.({
          total: finalTotal,
          againCount: stats.again + (rating === 1 || rating === 'again' ? 1 : 0),
          hardCount: stats.hard + (rating === 2 || rating === 'hard' ? 1 : 0),
          goodCount: stats.good + (rating === 3 || rating === 'good' ? 1 : 0),
          easyCount: stats.easy + (rating === 4 || rating === 'easy' ? 1 : 0),
          accuracyPercent: accuracy,
        });
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    },
    [currentCard, currentIndex, deck.length, onCardReviewed, onSessionComplete, stats, totalCards]
  );

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in the free text input and hasn't submitted
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        if (e.key === 'Enter' && !isFlipped) {
          e.preventDefault();
          setShowTypedEvaluation(true);
          handleFlip();
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleFlip();
      } else if (isFlipped) {
        if (e.key === '1' || e.key === '&') handleRating(1);
        else if (e.key === '2' || e.key === 'é') handleRating(2);
        else if (e.key === '3' || e.key === '"') handleRating(3);
        else if (e.key === '4' || e.key === "'") handleRating(4);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip, handleRating, isFlipped, onClose]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const restartDifficultCards = () => {
    const difficult = cards.filter((c) => c.difficulty && c.difficulty > 2);
    setDeck(difficult.length > 0 ? difficult : cards);
    setCurrentIndex(0);
    setIsCompleted(false);
    setStats({ again: 0, hard: 0, good: 0, easy: 0 });
  };

  const restartAll = () => {
    setDeck(cards);
    setCurrentIndex(0);
    setIsCompleted(false);
    setStats({ again: 0, hard: 0, good: 0, easy: 0 });
  };

  // Free text similarity check
  const similarityScore = useMemo(() => {
    if (!userTypedAnswer || !currentCard?.answer) return 0;
    const cleanUser = userTypedAnswer.toLowerCase().trim();
    const cleanTarget = currentCard.answer.toLowerCase().trim();
    if (cleanUser === cleanTarget) return 100;
    const userWords = new Set(cleanUser.split(/\s+/));
    const targetWords = cleanTarget.split(/\s+/);
    let matched = 0;
    targetWords.forEach((w) => {
      if (userWords.has(w)) matched++;
    });
    return Math.round((matched / Math.max(1, targetWords.length)) * 100);
  }, [currentCard?.answer, userTypedAnswer]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-xl text-zinc-100 selection:bg-accent-blue/30',
        'animate-in fade-in duration-200'
      )}
    >
      {/* Header bar */}
      <header className="h-16 px-6 border-b border-border flex items-center justify-between shrink-0 bg-surface/50">
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 rounded-xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center text-accent-blue font-bold shadow-inner">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              {deckTitle}
              {currentCard?.subjectTitle && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-elevated text-zinc-400 border border-border">
                  {currentCard.subjectTitle}
                </span>
              )}
            </h2>
            <div className="text-xs text-zinc-400">
              Carte {currentIndex + 1} sur {totalCards} &bull; FSRS-5 Répétition Espacée
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-surface-elevated border border-transparent hover:border-border transition"
            title="Plein écran"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition flex items-center gap-1.5 text-xs font-medium"
            title="Quitter (Échap)"
          >
            <X className="w-5 h-5" />
            <span className="hidden sm:inline">Échap</span>
          </button>
        </div>
      </header>

      {/* Dynamic Progress Bar */}
      <div className="w-full h-1.5 bg-surface-muted relative overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent-blue via-accent-purple to-accent-green transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-4xl w-full mx-auto overflow-y-auto">
        {!isCompleted && currentCard ? (
          <div className="w-full flex flex-col items-center gap-6">
            {/* Tag & Category badge */}
            <div className="flex items-center gap-2 text-xs font-medium">
              {currentCard.chapterTitle && (
                <span className="px-3 py-1 rounded-full bg-surface-elevated text-zinc-300 border border-border">
                  {currentCard.chapterTitle}
                </span>
              )}
              <span className="px-3 py-1 rounded-full bg-accent-purple/10 text-accent-purple border border-accent-purple/20 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                {currentCard.kind === 'mcq'
                  ? 'QCM Interactif'
                  : currentCard.kind === 'open'
                  ? 'Rappel Libre'
                  : 'Flashcard Standard'}
              </span>
            </div>

            {/* 3D Flip Card Container */}
            <div
              className="w-full min-h-[380px] sm:min-h-[420px] [perspective:1400px] cursor-pointer select-none"
              onClick={handleFlip}
            >
              <div
                className={cn(
                  'w-full h-full relative transition-transform duration-500 [transform-style:preserve-3d] rounded-2xl shadow-2xl border',
                  isFlipped ? '[transform:rotateY(180deg)]' : '',
                  isFlipped
                    ? 'border-accent-blue/30 shadow-accent-blue/5'
                    : 'border-border shadow-black/40'
                )}
              >
                {/* FRONT OF CARD (Question) */}
                <div
                  className={cn(
                    'absolute inset-0 w-full h-full [backface-visibility:hidden] rounded-2xl p-6 sm:p-10 flex flex-col justify-between',
                    'bg-surface-elevated/90 backdrop-blur-md border border-white/5'
                  )}
                >
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                    <span className="flex items-center gap-1.5 text-accent-blue font-semibold uppercase tracking-wider">
                      <HelpCircle className="w-4 h-4" />
                      Question
                    </span>
                    <span>Appuyez sur ESPACE pour révéler</span>
                  </div>

                  <div className="my-auto py-6">
                    <p className="text-xl sm:text-2xl font-semibold text-zinc-100 leading-relaxed text-center">
                      {currentCard.question}
                    </p>

                    {/* MCQ Options on Front if card is MCQ */}
                    {currentCard.kind === 'mcq' && currentCard.options && (
                      <div
                        className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {currentCard.options.map((opt, idx) => {
                          const label = typeof opt === 'string' ? opt : opt.text || opt.label || '';
                          const isSelected = selectedOption === idx || selectedOption === label;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setSelectedOption(idx);
                                playAudioFeedback('click');
                              }}
                              className={cn(
                                'text-left px-4 py-3 rounded-xl border text-sm transition font-medium flex items-center gap-3',
                                isSelected
                                  ? 'bg-accent-blue/15 border-accent-blue text-white shadow-lg shadow-accent-blue/10'
                                  : 'bg-surface border-border text-zinc-300 hover:border-zinc-500 hover:bg-surface-muted'
                              )}
                            >
                              <span
                                className={cn(
                                  'w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 border',
                                  isSelected
                                    ? 'bg-accent-blue text-white border-accent-blue'
                                    : 'bg-surface-muted text-zinc-400 border-border'
                                )}
                              >
                                {String.fromCharCode(65 + idx)}
                              </span>
                              <span>{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Free text input recall mode */}
                    {currentCard.kind === 'open' && (
                      <div
                        className="mt-6 max-w-md mx-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="text-xs text-zinc-400 mb-1.5 flex justify-between">
                          <span>Tapez votre réponse pour tester votre mémoire :</span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={userTypedAnswer}
                            onChange={(e) => setUserTypedAnswer(e.target.value)}
                            placeholder="Votre réponse ici..."
                            className="flex-1 px-4 py-2.5 rounded-xl bg-surface border border-border text-sm text-zinc-100 focus:outline-none focus:border-accent-blue"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setShowTypedEvaluation(true);
                              handleFlip();
                            }}
                            className="px-4 py-2.5 rounded-xl bg-accent-blue hover:bg-blue-600 text-white text-sm font-medium flex items-center gap-1 transition"
                          >
                            Vérifier <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-zinc-400 border-t border-border/50 pt-4">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-accent-orange" />
                      Indice disponible après retournement
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFlip();
                      }}
                      className="px-3 py-1 rounded-lg bg-surface hover:bg-surface-muted text-zinc-300 hover:text-white border border-border text-xs flex items-center gap-1.5 transition"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Retourner
                    </button>
                  </div>
                </div>

                {/* BACK OF CARD (Answer & Explanation) */}
                <div
                  className={cn(
                    'absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-2xl p-6 sm:p-10 flex flex-col justify-between',
                    'bg-surface-elevated/95 backdrop-blur-md border border-white/5'
                  )}
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="flex items-center gap-1.5 text-accent-green font-semibold uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4" />
                      Réponse Attendue
                    </span>
                    <span className="text-zinc-400">Raccourcis: 1, 2, 3, 4</span>
                  </div>

                  <div className="my-auto py-4 overflow-y-auto max-h-[260px] pr-2">
                    {/* Free typed similarity banner */}
                    {showTypedEvaluation && userTypedAnswer && (
                      <div
                        className={cn(
                          'mb-4 p-3 rounded-xl border text-xs flex items-center justify-between',
                          similarityScore >= 80
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : similarityScore >= 40
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            : 'bg-red-500/10 border-red-500/30 text-red-300'
                        )}
                      >
                        <div>
                          <div className="font-semibold">Votre réponse : "{userTypedAnswer}"</div>
                          <div className="opacity-80">Similarité sémantique estimée</div>
                        </div>
                        <span className="text-base font-bold">{similarityScore}%</span>
                      </div>
                    )}

                    <h3 className="text-xl sm:text-2xl font-bold text-zinc-100 mb-3 leading-snug">
                      {currentCard.answer}
                    </h3>

                    {/* Explanation */}
                    {currentCard.explanation && (
                      <p className="text-sm text-zinc-300 leading-relaxed mb-3">
                        {currentCard.explanation}
                      </p>
                    )}

                    {/* Keywords */}
                    {currentCard.keywords && currentCard.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {currentCard.keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-0.5 rounded-md bg-accent-blue/10 text-accent-blue border border-accent-blue/20 text-xs font-mono font-medium"
                          >
                            #{kw}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Traps / Common Mistakes */}
                    {currentCard.trap && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-2.5 mt-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-semibold text-red-200">Piège d'examen :</strong>{' '}
                          {currentCard.trap}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-zinc-400 border-t border-border/50 pt-3">
                    <span className="flex items-center gap-1.5 text-zinc-400">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                      Évaluez votre rappel ci-dessous
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFlip();
                      }}
                      className="px-3 py-1 rounded-lg bg-surface hover:bg-surface-muted text-zinc-300 hover:text-white border border-border text-xs flex items-center gap-1.5 transition"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Revoir question
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions: Reveal Button or FSRS-5 Rating Buttons */}
            {!isFlipped ? (
              <div className="w-full flex justify-center items-center gap-4 mt-2">
                <button
                  type="button"
                  onClick={handleFlip}
                  className="px-8 py-3.5 rounded-xl bg-accent-blue hover:bg-blue-600 text-white font-semibold shadow-lg shadow-accent-blue/20 flex items-center gap-2.5 transition active:scale-95"
                >
                  <RotateCw className="w-5 h-5" />
                  Révéler la réponse (Espace)
                </button>
              </div>
            ) : (
              /* FSRS-5 Grading Bar */
              <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {/* 1: ÉCHEC / AGAIN */}
                <button
                  type="button"
                  onClick={() => handleRating(1)}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-surface-elevated hover:bg-red-500/15 border border-border hover:border-red-500/40 text-red-400 transition group active:scale-95 shadow-md"
                >
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 text-xs flex items-center justify-center font-mono">
                      1
                    </span>
                    Échec
                  </div>
                  <span className="text-xs text-zinc-400 group-hover:text-red-300 mt-0.5">
                    {fsrsSchedule.againInterval}
                  </span>
                </button>

                {/* 2: DIFFICILE / HARD */}
                <button
                  type="button"
                  onClick={() => handleRating(2)}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-surface-elevated hover:bg-amber-500/15 border border-border hover:border-amber-500/40 text-amber-400 transition group active:scale-95 shadow-md"
                >
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-mono">
                      2
                    </span>
                    Difficile
                  </div>
                  <span className="text-xs text-zinc-400 group-hover:text-amber-300 mt-0.5">
                    {fsrsSchedule.hardInterval}
                  </span>
                </button>

                {/* 3: BON / GOOD */}
                <button
                  type="button"
                  onClick={() => handleRating(3)}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-surface-elevated hover:bg-accent-blue/15 border border-border hover:border-accent-blue/40 text-accent-blue transition group active:scale-95 shadow-md"
                >
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <span className="w-5 h-5 rounded-full bg-accent-blue/20 text-accent-blue text-xs flex items-center justify-center font-mono">
                      3
                    </span>
                    Bon
                  </div>
                  <span className="text-xs text-zinc-400 group-hover:text-blue-300 mt-0.5">
                    {fsrsSchedule.goodInterval}
                  </span>
                </button>

                {/* 4: FACILE / EASY */}
                <button
                  type="button"
                  onClick={() => handleRating(4)}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-surface-elevated hover:bg-emerald-500/15 border border-border hover:border-emerald-500/40 text-emerald-400 transition group active:scale-95 shadow-md"
                >
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-mono">
                      4
                    </span>
                    Facile
                  </div>
                  <span className="text-xs text-zinc-400 group-hover:text-emerald-300 mt-0.5">
                    {fsrsSchedule.easyInterval}
                  </span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* COMPLETION / CONGRATULATIONS SCREEN */
          <div className="w-full max-w-lg p-8 rounded-3xl bg-surface-elevated border border-border shadow-2xl text-center animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-tr from-accent-blue to-accent-green p-0.5 shadow-lg shadow-accent-green/20">
              <div className="w-full h-full rounded-3xl bg-surface-elevated flex items-center justify-center">
                <Trophy className="w-10 h-10 text-amber-400 animate-bounce" />
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
              Session Terminée ! 🎉
            </h2>
            <p className="text-sm text-zinc-400 mb-8">
              Toutes les cartes ont été révisées selon l'algorithme FSRS-5.
            </p>

            {/* Score Grid */}
            <div className="grid grid-cols-4 gap-2 mb-8 text-center">
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="text-xl font-bold text-red-400">{stats.again}</div>
                <div className="text-[11px] text-zinc-400 uppercase font-semibold">Échecs</div>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="text-xl font-bold text-amber-400">{stats.hard}</div>
                <div className="text-[11px] text-zinc-400 uppercase font-semibold">Difficiles</div>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="text-xl font-bold text-blue-400">{stats.good}</div>
                <div className="text-[11px] text-zinc-400 uppercase font-semibold">Bons</div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-xl font-bold text-emerald-400">{stats.easy}</div>
                <div className="text-[11px] text-zinc-400 uppercase font-semibold">Faciles</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              {stats.again + stats.hard > 0 && (
                <button
                  type="button"
                  onClick={restartDifficultCards}
                  className="w-full py-3 px-4 rounded-xl bg-accent-orange/20 hover:bg-accent-orange/30 text-accent-orange border border-accent-orange/30 font-semibold text-sm transition flex items-center justify-center gap-2"
                >
                  <RotateCw className="w-4 h-4" />
                  Revoir les cartes difficiles ({stats.again + stats.hard})
                </button>
              )}
              <button
                type="button"
                onClick={restartAll}
                className="w-full py-3 px-4 rounded-xl bg-surface-muted hover:bg-surface border border-border text-zinc-200 font-semibold text-sm transition flex items-center justify-center gap-2"
              >
                <Layers className="w-4 h-4" />
                Recommencer le deck entier
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 px-4 rounded-xl bg-accent-blue hover:bg-blue-600 text-white font-semibold text-sm shadow-lg shadow-accent-blue/25 transition"
              >
                Terminer et Enregistrer
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer Navigation Bar */}
      <footer className="h-14 px-6 border-t border-border bg-surface/40 flex items-center justify-between text-xs text-zinc-400 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0 || isCompleted}
            className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition"
          >
            <ChevronLeft className="w-4 h-4" /> Précédent
          </button>
          <span>
            {currentIndex + 1} / {totalCards}
          </span>
          <button
            onClick={() => {
              if (currentIndex + 1 < totalCards) {
                setCurrentIndex((prev) => prev + 1);
              } else {
                setIsCompleted(true);
              }
            }}
            disabled={isCompleted}
            className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition"
          >
            Suivant <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-4">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-[10px] font-mono text-zinc-300">
              Espace
            </kbd>{' '}
            Retourner
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-[10px] font-mono text-zinc-300">
              1-4
            </kbd>{' '}
            Noter
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-[10px] font-mono text-zinc-300">
              Échap
            </kbd>{' '}
            Fermer
          </span>
        </div>
      </footer>
    </div>
  );
};
