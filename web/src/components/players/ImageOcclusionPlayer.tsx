import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Eye,
  RotateCw,
  Trophy,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  Maximize2,
  Minimize2,
  EyeOff,
  Flame,
} from 'lucide-react';
import type { ImageOcclusionDiagram, OcclusionMask, CardRating, FSRSSchedule } from '../../lib/types';
import { BIO_DIAGRAMS } from '../../lib/diagrams';
import { cn, playAudioFeedback } from '../../lib/utils';

interface ImageOcclusionPlayerProps {
  diagram?: ImageOcclusionDiagram;
  onClose: () => void;
  onMaskReviewed?: (maskId: string, rating: CardRating) => void;
  onSessionComplete?: (summary: {
    total: number;
    againCount: number;
    hardCount: number;
    goodCount: number;
    easyCount: number;
  }) => void;
  fsrsSchedule?: FSRSSchedule;
}

export const ImageOcclusionPlayer: React.FC<ImageOcclusionPlayerProps> = ({
  diagram = BIO_DIAGRAMS[0],
  onClose,
  onMaskReviewed,
  onSessionComplete,
  fsrsSchedule = {
    againInterval: '< 10 min',
    hardInterval: '+1 j',
    goodInterval: '+3 j',
    easyInterval: '+7 j',
  },
}) => {
  const [masks, setMasks] = useState<OcclusionMask[]>(diagram.masks || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [hideMode, setHideMode] = useState<'hide-all' | 'hide-one'>('hide-all');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Statistics
  const [stats, setStats] = useState({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });
  const [isCompleted, setIsCompleted] = useState(false);

  const currentMask: OcclusionMask | undefined = masks[currentIndex];
  const totalMasks = masks.length;
  const progressPercent = totalMasks > 0 ? Math.round((currentIndex / totalMasks) * 100) : 0;

  // Reset revealed state on mask change
  useEffect(() => {
    setIsRevealed(false);
  }, [currentIndex]);

  const handleReveal = useCallback(() => {
    setIsRevealed(true);
    playAudioFeedback('flip');
  }, []);

  const handleRating = useCallback(
    (rating: CardRating) => {
      if (!currentMask) return;

      if (rating === 1) playAudioFeedback('again');
      else if (rating === 2) playAudioFeedback('hard');
      else if (rating === 3) playAudioFeedback('good');
      else if (rating === 4) playAudioFeedback('easy');

      setStats((prev) => ({
        ...prev,
        again: rating === 1 ? prev.again + 1 : prev.again,
        hard: rating === 2 ? prev.hard + 1 : prev.hard,
        good: rating === 3 ? prev.good + 1 : prev.good,
        easy: rating === 4 ? prev.easy + 1 : prev.easy,
      }));

      onMaskReviewed?.(currentMask.id, rating);

      // If Again, push to queue end
      if (rating === 1 && masks.length > 1) {
        setMasks((prev) => [...prev, currentMask]);
      }

      if (currentIndex + 1 >= totalMasks) {
        setIsCompleted(true);
        playAudioFeedback('success');
        onSessionComplete?.({
          total: totalMasks,
          againCount: stats.again + (rating === 1 ? 1 : 0),
          hardCount: stats.hard + (rating === 2 ? 1 : 0),
          goodCount: stats.good + (rating === 3 ? 1 : 0),
          easyCount: stats.easy + (rating === 4 ? 1 : 0),
        });
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    },
    [currentIndex, currentMask, masks.length, onMaskReviewed, onSessionComplete, stats, totalMasks]
  );

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!isRevealed) {
          handleReveal();
        }
      } else if (isRevealed) {
        if (e.key === '1' || e.key === '&') handleRating(1);
        else if (e.key === '2' || e.key === 'é') handleRating(2);
        else if (e.key === '3' || e.key === '"') handleRating(3);
        else if (e.key === '4' || e.key === "'") handleRating(4);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRating, handleReveal, isRevealed, onClose]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const restartAll = () => {
    setMasks(diagram.masks || []);
    setCurrentIndex(0);
    setIsRevealed(false);
    setIsCompleted(false);
    setStats({ again: 0, hard: 0, good: 0, easy: 0 });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-xl text-zinc-100 selection:bg-accent-blue/30 animate-in fade-in duration-200">
      {/* Top Header */}
      <header className="h-16 px-6 border-b border-border flex items-center justify-between shrink-0 bg-surface/60">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center text-accent-blue font-bold shadow-inner">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-100">{diagram.title}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-elevated text-zinc-400 border border-border">
                {diagram.category}
              </span>
            </div>
            <div className="text-xs text-zinc-400">
              Masque {currentIndex + 1} sur {totalMasks} &bull; Image Occlusion Active
            </div>
          </div>
        </div>

        {/* Center Mode Switch */}
        <div className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-surface-elevated border border-border">
          <button
            onClick={() => setHideMode('hide-all')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition',
              hideMode === 'hide-all'
                ? 'bg-accent-blue text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <EyeOff className="w-3.5 h-3.5" />
            Masquer Tout (Hide All)
          </button>
          <button
            onClick={() => setHideMode('hide-one')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition',
              hideMode === 'hide-one'
                ? 'bg-accent-blue text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <Eye className="w-3.5 h-3.5" />
            Masquer Un Seul (Hide One)
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-surface-elevated border border-transparent hover:border-border transition"
            title="Plein écran"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition flex items-center gap-1.5 text-xs font-medium"
            title="Quitter (Échap)"
          >
            <X className="w-5 h-5" />
            <span className="hidden sm:inline">Échap</span>
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-surface-muted relative overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent-blue via-accent-purple to-accent-green transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Game Stage */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden max-w-6xl w-full mx-auto">
        {!isCompleted && currentMask ? (
          <div className="w-full h-full flex flex-col items-center justify-between gap-4">
            {/* Top Prompt Card */}
            <div className="w-full max-w-3xl flex items-center justify-between px-6 py-3 rounded-2xl bg-surface-elevated/90 border border-border backdrop-blur-md shadow-lg">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-xl bg-accent-orange/15 border border-accent-orange/30 text-accent-orange text-xs font-bold flex items-center justify-center font-mono">
                  ?
                </span>
                <div>
                  <div className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                    Élément Cible à Identifier
                  </div>
                  <div className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                    <span>Masque #{currentIndex + 1}</span>
                    {currentMask.hint && (
                      <span className="text-xs font-normal text-amber-400/90 flex items-center gap-1 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                        <Lightbulb className="w-3.5 h-3.5" /> {currentMask.hint}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!isRevealed ? (
                <button
                  type="button"
                  onClick={handleReveal}
                  className="px-4 py-2 rounded-xl bg-accent-blue hover:bg-blue-600 text-white font-medium text-xs shadow-md shadow-accent-blue/20 flex items-center gap-1.5 transition active:scale-95"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Révéler (Espace)
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Solution révélée
                  </span>
                </div>
              )}
            </div>

            {/* Interactive Masked Canvas */}
            <div className="flex-1 w-full max-w-4xl flex items-center justify-center relative min-h-0">
              <div className="relative w-full max-h-full aspect-[4/3] rounded-2xl bg-surface-elevated border border-border shadow-2xl overflow-hidden flex items-center justify-center">
                {/* SVG Vector Graphic */}
                <svg
                  viewBox={diagram.viewBox}
                  className="w-full h-full pointer-events-none select-none"
                  dangerouslySetInnerHTML={{ __html: diagram.svgContent }}
                />

                {/* Occlusion Masks Layer */}
                {masks.map((mask, idx) => {
                  const isTarget = currentMask.id === mask.id;

                  // If hideMode is hide-one and not target, show transparent
                  if (hideMode === 'hide-one' && !isTarget) {
                    return null;
                  }

                  // Non-target mask in hide-all mode: opaque generic shield
                  if (!isTarget) {
                    return (
                      <div
                        key={mask.id}
                        style={{
                          left: `${mask.x}%`,
                          top: `${mask.y}%`,
                          width: `${mask.width}%`,
                          height: `${mask.height}%`,
                          backgroundColor: '#3f3f46',
                        }}
                        className="absolute rounded-lg opacity-85 shadow-md flex items-center justify-center p-1 border border-zinc-600/50"
                      >
                        <span className="text-[10px] font-mono font-bold text-zinc-300">
                          #{idx + 1}
                        </span>
                      </div>
                    );
                  }

                  // TARGET MASK (The one to guess)
                  if (isRevealed) {
                    // Target revealed
                    return (
                      <div
                        key={mask.id}
                        style={{
                          left: `${mask.x}%`,
                          top: `${mask.y}%`,
                          width: `${mask.width}%`,
                          height: `${mask.height}%`,
                        }}
                        className="absolute rounded-xl border-2 border-accent-green bg-accent-green/25 backdrop-blur-xs flex items-center justify-center p-1.5 shadow-xl shadow-accent-green/20 animate-in zoom-in-95 duration-200 z-30"
                      >
                        <span className="text-xs sm:text-sm font-extrabold text-emerald-200 text-center drop-shadow-md truncate">
                          {mask.solution}
                        </span>
                      </div>
                    );
                  }

                  // Target hidden (Pulsating glowing active target)
                  return (
                    <div
                      key={mask.id}
                      onClick={handleReveal}
                      style={{
                        left: `${mask.x}%`,
                        top: `${mask.y}%`,
                        width: `${mask.width}%`,
                        height: `${mask.height}%`,
                        backgroundColor: mask.color || '#f59e0b',
                      }}
                      className={cn(
                        'absolute rounded-xl shadow-2xl flex items-center justify-center p-1 cursor-pointer transition z-30',
                        'ring-4 ring-amber-400/80 ring-offset-2 ring-offset-background animate-pulse',
                        'hover:scale-105 active:scale-95'
                      )}
                    >
                      <div className="flex items-center gap-1.5 text-white font-extrabold text-xs drop-shadow-md">
                        <Flame className="w-3.5 h-3.5 animate-bounce" />
                        <span>Cible #{idx + 1}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Grading / Reveal Panel */}
            <div className="w-full max-w-2xl shrink-0 pb-2">
              {!isRevealed ? (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleReveal}
                    className="px-8 py-3.5 rounded-2xl bg-accent-blue hover:bg-blue-600 text-white font-bold text-sm shadow-xl shadow-accent-blue/25 flex items-center gap-2 transition active:scale-95"
                  >
                    <RotateCw className="w-5 h-5" />
                    Cliquer ou Espace pour Révéler le Masque
                  </button>
                </div>
              ) : (
                /* FSRS-5 Grading Buttons */
                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                    Évaluez votre mémorisation (FSRS-5)
                  </div>
                  <div className="grid grid-cols-4 gap-2.5">
                    {/* 1: AGAIN */}
                    <button
                      type="button"
                      onClick={() => handleRating(1)}
                      className="p-3 rounded-xl bg-surface-elevated hover:bg-red-500/20 border border-border hover:border-red-500/40 text-red-400 flex flex-col items-center justify-center transition active:scale-95 shadow-md"
                    >
                      <div className="font-bold text-xs flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full bg-red-500/20 text-red-400 text-[10px] flex items-center justify-center font-mono">
                          1
                        </span>
                        Échec
                      </div>
                      <span className="text-[10px] text-zinc-400 mt-0.5">
                        {fsrsSchedule.againInterval}
                      </span>
                    </button>

                    {/* 2: HARD */}
                    <button
                      type="button"
                      onClick={() => handleRating(2)}
                      className="p-3 rounded-xl bg-surface-elevated hover:bg-amber-500/20 border border-border hover:border-amber-500/40 text-amber-400 flex flex-col items-center justify-center transition active:scale-95 shadow-md"
                    >
                      <div className="font-bold text-xs flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] flex items-center justify-center font-mono">
                          2
                        </span>
                        Difficile
                      </div>
                      <span className="text-[10px] text-zinc-400 mt-0.5">
                        {fsrsSchedule.hardInterval}
                      </span>
                    </button>

                    {/* 3: GOOD */}
                    <button
                      type="button"
                      onClick={() => handleRating(3)}
                      className="p-3 rounded-xl bg-surface-elevated hover:bg-accent-blue/20 border border-border hover:border-accent-blue/40 text-accent-blue flex flex-col items-center justify-center transition active:scale-95 shadow-md"
                    >
                      <div className="font-bold text-xs flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full bg-accent-blue/20 text-accent-blue text-[10px] flex items-center justify-center font-mono">
                          3
                        </span>
                        Bon
                      </div>
                      <span className="text-[10px] text-zinc-400 mt-0.5">
                        {fsrsSchedule.goodInterval}
                      </span>
                    </button>

                    {/* 4: EASY */}
                    <button
                      type="button"
                      onClick={() => handleRating(4)}
                      className="p-3 rounded-xl bg-surface-elevated hover:bg-emerald-500/20 border border-border hover:border-emerald-500/40 text-emerald-400 flex flex-col items-center justify-center transition active:scale-95 shadow-md"
                    >
                      <div className="font-bold text-xs flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-mono">
                          4
                        </span>
                        Facile
                      </div>
                      <span className="text-[10px] text-zinc-400 mt-0.5">
                        {fsrsSchedule.easyInterval}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* COMPLETION VIEW */
          <div className="w-full max-w-md p-8 rounded-3xl bg-surface-elevated border border-border shadow-2xl text-center animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-tr from-accent-blue to-accent-green p-0.5 shadow-lg shadow-accent-green/20">
              <div className="w-full h-full rounded-3xl bg-surface-elevated flex items-center justify-center">
                <Trophy className="w-10 h-10 text-amber-400 animate-bounce" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Schéma Maîtrisé ! 🧬</h2>
            <p className="text-xs text-zinc-400 mb-6">
              Tous les masques de <strong>"{diagram.title}"</strong> ont été révisés.
            </p>

            <div className="grid grid-cols-4 gap-2 mb-6 text-center">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="text-lg font-bold text-red-400">{stats.again}</div>
                <div className="text-[10px] text-zinc-400 font-semibold">Échecs</div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="text-lg font-bold text-amber-400">{stats.hard}</div>
                <div className="text-[10px] text-zinc-400 font-semibold">Difficiles</div>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="text-lg font-bold text-blue-400">{stats.good}</div>
                <div className="text-[10px] text-zinc-400 font-semibold">Bons</div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-lg font-bold text-emerald-400">{stats.easy}</div>
                <div className="text-[10px] text-zinc-400 font-semibold">Faciles</div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={restartAll}
                className="w-full py-3 rounded-xl bg-surface-muted hover:bg-surface border border-border text-zinc-200 font-semibold text-xs transition flex items-center justify-center gap-2"
              >
                <RotateCw className="w-4 h-4" />
                Rejouer ce schéma
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-accent-blue hover:bg-blue-600 text-white font-semibold text-xs shadow-lg shadow-accent-blue/20 transition"
              >
                Terminer la session
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer Navigation */}
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
            {currentIndex + 1} / {totalMasks}
          </span>
          <button
            onClick={() => {
              if (currentIndex + 1 < totalMasks) {
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

        <div className="flex items-center gap-4 text-zinc-400">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-[10px] font-mono text-zinc-300">
              Espace
            </kbd>{' '}
            Révéler
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-[10px] font-mono text-zinc-300">
              1-4
            </kbd>{' '}
            Noter
          </span>
          <span>
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
