import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Sparkles,
  Layers,
  FileEdit,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Save,
  Clock,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Music,
  Lock,
  Unlock,
  RotateCcw,
  Mic,
  Send,
  HelpCircle,
} from 'lucide-react';
import {
  getStudyCourses,
  getCourseSummaryContent,
  getTranscriptionContent,
  saveCourseNotes,
  unlockCourseRecall,
  getDiagnosticQuiz,
} from '../lib/api';
import type { Course, CoursePhoto, Card, AtomicConcept, ProgressiveExample } from '../lib/types';
import { formatDate, renderMarkdown } from '../lib/utils';

interface CourseDetailViewProps {
  courseId: string;
  onBack?: () => void;
  onStartSession?: (minutes: number, mode?: string, subjectId?: string) => void;
  onSelectSubject?: (subjectId: string) => void;
}

export const CourseDetailView: React.FC<CourseDetailViewProps> = ({
  courseId,
  onBack,
  onStartSession,
  onSelectSubject,
}) => {
  const [course, setCourse] = useState<Course | null>(null);
  const [activeTab, setActiveTab] = useState<'fiche' | 'concepts' | 'boite' | 'flashcards' | 'schemas' | 'notes' | 'retest'>('fiche');
  const [summaryMarkdown, setSummaryMarkdown] = useState<string>('');
  const [transcriptionText, setTranscriptionText] = useState<string>('');
  const [userNotes, setUserNotes] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [expandedConcepts, setExpandedConcepts] = useState<Record<string, boolean>>({});
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [occlusionRevealed, setOcclusionRevealed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // Sas de Rappel State (Multi-Mode Anti-Friction)
  const [unlockMode, setUnlockMode] = useState<'free' | 'quiz'>('free');
  const [diagnosticQuiz, setDiagnosticQuiz] = useState<any[]>([]);
  const [quizSelections, setQuizSelections] = useState<Record<number, number>>({});
  const [recallInput, setRecallInput] = useState<string>('');
  const [isEvaluatingRecall, setIsEvaluatingRecall] = useState<boolean>(false);
  const [isDictating, setIsDictating] = useState<boolean>(false);
  const [recallError, setRecallError] = useState<string | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<any>(null);

  const toggleDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("La reconnaissance vocale n'est pas supportée par votre navigateur. Vous pouvez écrire directement ou dicter avec Antigravity sur votre Mac !");
      return;
    }

    if (isDictating) {
      setIsDictating(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'fr-FR';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => setIsDictating(true);
      recognition.onend = () => setIsDictating(false);
      recognition.onerror = () => setIsDictating(false);

      recognition.onresult = (event: any) => {
        let text = '';
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
        }
        if (text.trim()) {
          setRecallInput((prev) => (prev.trim() ? prev.trim() + ' ' + text.trim() : text.trim()));
        }
      };

      recognition.start();
    } catch (e) {
      console.warn("Speech recognition error:", e);
      setIsDictating(false);
    }
  };

  // Load course details & diagnostic quiz
  const loadCourse = async () => {
    setLoading(true);
    try {
      const courses = await getStudyCourses();
      const found = courses.find((c) => c.id === courseId);
      if (found) {
        setCourse(found);
        setUserNotes(found.notes || '');

        if (found.summaryFilename) {
          const sumText = await getCourseSummaryContent(found.summaryFilename);
          setSummaryMarkdown(sumText);
        }

        if (found.transcriptionFilename) {
          const transText = await getTranscriptionContent(found.transcriptionFilename);
          setTranscriptionText(transText);
        }

        if (found.recallDiagnostic) {
          setEvaluationResult(found.recallDiagnostic);
        }

        if (found.recallStatus === 'locked') {
          const quiz = await getDiagnosticQuiz(found.id);
          setDiagnosticQuiz(quiz);
          if (quiz.length > 0) {
            setUnlockMode('quiz'); // Favoriser le mode éclair anti-friction par défaut s'il y a des QCMs
          }
        }
      }
    } catch (err) {
      console.error('Error loading course detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourse();
  }, [courseId]);

  const handleUnlockRecall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course || isEvaluatingRecall) return;

    setIsEvaluatingRecall(true);
    setRecallError(null);

    try {
      let res = null;
      if (unlockMode === 'quiz') {
        const answersArray = diagnosticQuiz.map((_, idx) => (quizSelections[idx] !== undefined ? quizSelections[idx] : -1));
        res = await unlockCourseRecall(course.id, { quizAnswers: answersArray });
      } else {
        if (!recallInput.trim()) {
          setIsEvaluatingRecall(false);
          return;
        }
        res = await unlockCourseRecall(course.id, { recallText: recallInput.trim() });
      }

      if (res && res.course) {
        setCourse(res.course);
        setEvaluationResult(res.evaluation);
        setActiveTab('fiche');
      } else {
        setRecallError('Erreur lors de l’évaluation. La fiche a été déverrouillée.');
        setCourse((prev) => prev ? { ...prev, recallStatus: 'unlocked', recallScore: 75 } : null);
        setActiveTab('fiche');
      }
    } catch (err) {
      setRecallError('Impossible de joindre le serveur d’évaluation.');
      setCourse((prev) => prev ? { ...prev, recallStatus: 'unlocked' } : null);
    } finally {
      setIsEvaluatingRecall(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!course) return;
    setIsSavingNotes(true);
    try {
      const ok = await saveCourseNotes(course.id, userNotes);
      if (ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err) {
      console.error('Error saving notes:', err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleConcept = (id: string) => {
    setExpandedConcepts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleMask = (maskId: string) => {
    setOcclusionRevealed((prev) => ({ ...prev, [maskId]: !prev[maskId] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-8 text-center bg-surface rounded-2xl border border-border max-w-xl mx-auto">
        <AlertTriangle className="w-10 h-10 text-accent-orange mx-auto mb-3" />
        <h2 className="text-base font-bold text-white mb-2">Cours introuvable</h2>
        <p className="text-xs text-zinc-400 mb-4">Ce cours a été déplacé ou n'existe plus.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-surface-elevated text-zinc-200 text-xs rounded-xl hover:bg-surface-muted"
        >
          ← Retour aux matières
        </button>
      </div>
    );
  }

  const isLocked = course.recallStatus === 'locked';
  const selectedPhoto = course.photos && course.photos.length > 0 ? course.photos[selectedPhotoIndex] : null;

  return (
    <div className="max-w-4xl mx-auto pb-20 animate-fadeIn space-y-6">
      {/* 1. Breadcrumb style Notion */}
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onBack}
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Matières</span>
          </button>
          <span className="text-zinc-600">/</span>
          <button
            onClick={() => onSelectSubject?.(course.subjectId)}
            className="hover:text-white transition-colors truncate max-w-[150px]"
          >
            {course.subjectTitle}
          </button>
          {course.chapter && (
            <>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-400 truncate max-w-[180px]">📂 {course.chapter}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-500">{formatDate(course.date)}</span>
        </div>
      </div>

      {/* 2. Titre du Cours, Statut de Verrouillage & Métadonnées */}
      <div className="p-6 sm:p-7 rounded-3xl bg-surface border border-border space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {isLocked ? (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 animate-pulse">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Fiche verrouillée (Rappel à faire)</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Fiche déverrouillée {course.recallScore ? `(${course.recallScore}% au rappel)` : ''}</span>
                </span>
              )}

              {course.partLabel && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-elevated text-zinc-300 border border-border">
                  {course.partLabel}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {course.title}
            </h1>
          </div>

          {/* Quick training CTA if unlocked */}
          {!isLocked && course.cards && course.cards.length > 0 && (
            <button
              onClick={() => onStartSession?.(0, 'course', course.subjectId)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 hover:scale-105 transition-all flex items-center gap-2 shrink-0"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Réviser les flashcards ({course.cards.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* ---------------- CAS 1 : SAS DE RAPPEL ACTIF OBLIGATOIRE (VERROUILLAGE) ---------------- */}
      {isLocked ? (
        <div className="rounded-3xl bg-gradient-to-b from-amber-950/20 via-surface to-surface border-2 border-amber-500/40 p-6 sm:p-8 space-y-6 shadow-2xl animate-fadeIn">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black">
              <Lock className="w-3.5 h-3.5" />
              <span>ÉTAPE DE DÉBLOCAGE : RÉCUPÉRATION ACTIVE (CHOISIS TON MODE)</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Active ta mémoire avant de lire la fiche
            </h2>

            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-2xl">
              Pour ancrer ce cours et éviter <strong>l'illusion de facilité</strong>, réponds à 3 questions rapides ou résume ce dont tu te souviens. L'algorithme FSRS-5 calera tes futures révisions.
            </p>
          </div>

          {/* SÉLECTEUR DE MODE DE DÉBLOCAGE (ZÉRO BLOCAGE / ZÉRO FRICTION) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
            {diagnosticQuiz.length > 0 && (
              <button
                type="button"
                onClick={() => setUnlockMode('quiz')}
                className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                  unlockMode === 'quiz'
                    ? 'bg-amber-500/15 border-amber-500 text-white shadow-md ring-1 ring-amber-500/30'
                    : 'bg-surface-elevated border-border-subtle text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="text-xl">⚡</span>
                <div>
                  <div className="text-xs font-bold text-amber-300">1. Déblocage Éclair (30 sec)</div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">3 questions ciblées pour débloquer immédiatement sans page blanche.</p>
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={() => setUnlockMode('free')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                unlockMode === 'free'
                  ? 'bg-amber-500/15 border-amber-500 text-white shadow-md ring-1 ring-amber-500/30'
                  : 'bg-surface-elevated border-border-subtle text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="text-xl">🎙️</span>
              <div>
                <div className="text-xs font-bold text-amber-300">2. Rappel Libre ou Dictée</div>
                <p className="text-[11px] text-zinc-400 mt-0.5">Dis ou écris librement tes souvenirs à la voix ou au clavier.</p>
              </div>
            </button>
          </div>

          {/* FORMULAIRE DE DÉVERROUILLAGE SELON LE MODE CHOISI */}
          <form onSubmit={handleUnlockRecall} className="space-y-5 pt-2">
            {unlockMode === 'quiz' && diagnosticQuiz.length > 0 ? (
              /* MODE 1 : QUIZ ÉCLAIR 3 QUESTIONS */
              <div className="space-y-4">
                {diagnosticQuiz.map((q, qIdx) => (
                  <div key={q.id || qIdx} className="p-4 rounded-2xl bg-surface-elevated border border-border space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                        Question {qIdx + 1}/3
                      </span>
                      <span className="text-xs font-bold text-white">{q.question}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 pt-1">
                      {q.options.map((opt: string, optIdx: number) => {
                        const isSelected = quizSelections[qIdx] === optIdx;
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => setQuizSelections((prev) => ({ ...prev, [qIdx]: optIdx }))}
                            className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-center gap-2.5 ${
                              isSelected
                                ? 'bg-amber-500/20 border-amber-500 text-amber-200 font-semibold shadow-sm'
                                : 'bg-surface border-border hover:border-zinc-600 text-zinc-300'
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              isSelected ? 'bg-amber-500 text-black' : 'bg-surface-elevated text-zinc-400'
                            }`}>
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* MODE 2 : RAPPEL LIBRE / DICTÉE VOCALE */
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 block">
                    ✍️ Ce dont je me rappelle de ce cours :
                  </label>
                  <button
                    type="button"
                    onClick={toggleDictation}
                    className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                      isDictating
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                        : 'bg-surface-elevated border-border-subtle text-zinc-300 hover:text-white'
                    }`}
                  >
                    <Mic className={`w-3.5 h-3.5 ${isDictating ? 'text-rose-400' : 'text-amber-400'}`} />
                    <span>{isDictating ? 'Écoute en cours (parlez)...' : 'Dicter à la voix'}</span>
                  </button>
                </div>
                <textarea
                  value={recallInput}
                  onChange={(e) => setRecallInput(e.target.value)}
                  rows={5}
                  placeholder="Ex: Dans ce cours, on a vu la structure des membranes avec les lipides amphiphiles, les protéines canaux, le gradient de concentration..."
                  className="w-full p-4 rounded-2xl bg-background border border-amber-500/30 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition-colors leading-relaxed"
                />
              </div>
            )}

            {recallError && (
              <p className="text-xs text-amber-400 font-medium">{recallError}</p>
            )}

            <div className="flex items-center justify-between gap-4 flex-wrap pt-2">
              <p className="text-[11px] text-zinc-400">
                🌱 Tout est automatiquement intégré dans ton algorithme FSRS-5 pour tes prochaines révisions.
              </p>

              <button
                type="submit"
                disabled={isEvaluatingRecall || (unlockMode === 'free' && !recallInput.trim())}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black text-xs font-black shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {isEvaluatingRecall ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
                    <span>Calage FSRS-5 en cours...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-black" />
                    <span>⚡ Déverrouiller la fiche & Caler mes flashcards</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* ---------------- CAS 2 : COURS DÉVERROUILLÉ (CHOIX LIBRES) ---------------- */
        <div className="space-y-6 animate-fadeIn">
          {/* DIAGNOSTIC DE CALAGE BIENVEILLANT (PAS D'ANXIÉTÉ DE NOTE) */}
          {evaluationResult && (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/20 to-surface border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <span>🌱</span>
                  <span>Calage Pédagogique FSRS-5 Initialisé</span>
                </span>
                <span className="text-xs font-mono font-bold text-zinc-400">
                  Rétention initiale : {evaluationResult.score || course.recallScore || 75}%
                </span>
              </div>

              {evaluationResult.summary && (
                <p className="text-xs text-zinc-200 leading-relaxed bg-surface/80 p-3 rounded-xl border border-border">
                  {evaluationResult.summary}
                </p>
              )}

              {evaluationResult.concepts && evaluationResult.concepts.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {evaluationResult.concepts.map((c: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                        c.status === 'mastered'
                          ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                          : c.status === 'partial'
                          ? 'bg-amber-500/5 border-amber-500/20 text-amber-300'
                          : 'bg-zinc-800/60 border-zinc-700 text-zinc-300'
                      }`}
                    >
                      <span className="font-bold shrink-0">
                        {c.status === 'mastered' ? '🟢' : c.status === 'partial' ? '🟡' : '🎯'}
                      </span>
                      <div>
                        <span className="font-bold">{c.label} : </span>
                        <span className="opacity-90">{c.feedback}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. NAVIGATION PAR ONGLETS CLAIRS */}
          <div className="flex items-center gap-4 sm:gap-6 border-b border-border px-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab('fiche')}
              className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-1.5 shrink-0 ${
                activeTab === 'fiche' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <BookOpen className={`w-4 h-4 ${activeTab === 'fiche' ? 'text-blue-400' : 'text-zinc-500'}`} />
              <span>📖 Fiche & MOC</span>
              {activeTab === 'fiche' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>

            {course.atomicConcepts && course.atomicConcepts.length > 0 && (
              <button
                onClick={() => setActiveTab('concepts')}
                className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'concepts' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Sparkles className={`w-4 h-4 ${activeTab === 'concepts' ? 'text-amber-400' : 'text-zinc-500'}`} />
                <span>💡 Concepts ({course.atomicConcepts.length})</span>
                {activeTab === 'concepts' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />
                )}
              </button>
            )}

            {(course.boiteAOutils?.theoremsAndLaws?.length || course.boiteAOutils?.formulas?.length || course.methodoExamen?.typicalQuestions?.length) ? (
              <button
                onClick={() => setActiveTab('boite')}
                className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'boite' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Layers className={`w-4 h-4 ${activeTab === 'boite' ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <span>🛠️ Boîte à outils & Lois</span>
                {activeTab === 'boite' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
                )}
              </button>
            ) : null}

            <button
              onClick={() => setActiveTab('flashcards')}
              className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-1.5 shrink-0 ${
                activeTab === 'flashcards' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkles className={`w-4 h-4 ${activeTab === 'flashcards' ? 'text-purple-400' : 'text-zinc-500'}`} />
              <span>🧠 Flashcards ({course.cards?.length || 0})</span>
              {activeTab === 'flashcards' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full" />
              )}
            </button>

            {course.photos && course.photos.length > 0 && (
              <button
                onClick={() => setActiveTab('schemas')}
                className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'schemas' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Layers className={`w-4 h-4 ${activeTab === 'schemas' ? 'text-cyan-400' : 'text-zinc-500'}`} />
                <span>📸 Documents ({course.photos.length})</span>
                {activeTab === 'schemas' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500 rounded-full" />
                )}
              </button>
            )}

            <button
              onClick={() => setActiveTab('retest')}
              className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-1.5 shrink-0 ${
                activeTab === 'retest' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <RotateCcw className={`w-4 h-4 ${activeTab === 'retest' ? 'text-amber-400' : 'text-zinc-500'}`} />
              <span>🔄 Re-tester</span>
              {activeTab === 'retest' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('notes')}
              className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-1.5 shrink-0 ${
                activeTab === 'notes' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileEdit className={`w-4 h-4 ${activeTab === 'notes' ? 'text-zinc-400' : 'text-zinc-500'}`} />
              <span>📝 Notes</span>
              {activeTab === 'notes' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-400 rounded-full" />
              )}
            </button>
          </div>

          {/* --- ONGLET 1 : FICHE & RÉSUMÉ MARKDOWN --- */}
          {activeTab === 'fiche' && (
            <div className="p-6 sm:p-8 rounded-3xl bg-surface border border-border space-y-6 shadow-sm">
              {summaryMarkdown ? (
                <div
                  className="prose prose-invert max-w-none text-zinc-200 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(summaryMarkdown) }}
                />
              ) : (
                <div className="py-12 text-center text-xs text-zinc-500 space-y-2">
                  <p>Aucune fiche synthétique disponible.</p>
                  {course.notes && (
                    <p className="text-zinc-400 bg-background p-4 rounded-xl max-w-xl mx-auto border border-border">
                      {course.notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* --- ONGLET 2 : CONCEPTS ATOMIQUES (STYLE OBSIDIAN PYTHON) --- */}
          {activeTab === 'concepts' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-amber-300">🧠 Concepts Atomiques Pédagogiques</span>
                  <p className="text-[11px] text-zinc-300">
                    Chaque notion est découpée en unité claire : problème concret, analogie quotidienne, définition et exemples gradués.
                  </p>
                </div>
              </div>

              {(!course.atomicConcepts || course.atomicConcepts.length === 0) ? (
                <div className="p-12 text-center bg-surface rounded-2xl border border-border text-xs text-zinc-400">
                  Les concepts atomiques seront générés automatiquement au prochain traitement d'amphi.
                </div>
              ) : (
                course.atomicConcepts.map((concept, idx) => {
                  const conceptId = concept.id || `concept-${idx}`;
                  const isExpanded = expandedConcepts[conceptId] !== false; // expanded by default

                  return (
                    <div
                      key={conceptId}
                      className="rounded-3xl bg-surface border border-border overflow-hidden shadow-sm space-y-0 transition-all hover:border-zinc-700"
                    >
                      {/* Header cliquable */}
                      <div
                        onClick={() => toggleConcept(conceptId)}
                        className="p-5 sm:p-6 cursor-pointer flex items-center justify-between gap-4 bg-surface-elevated/40 hover:bg-surface-elevated transition-colors select-none"
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                            Concept {idx + 1}
                          </span>
                          <h3 className="text-base sm:text-lg font-black text-white">
                            {concept.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-zinc-400">
                            {isExpanded ? 'Réduire' : 'Développer'}
                          </span>
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                        </div>
                      </div>

                      {/* Corps de la note atomique */}
                      {isExpanded && (
                        <div className="p-6 sm:p-7 space-y-6 border-t border-border/60 bg-surface animate-fadeIn">
                          {/* 1. Pourquoi on en a besoin */}
                          {concept.whyWeNeedIt && (
                            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-1.5">
                              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                <span>💡 Pourquoi on en a besoin</span>
                              </span>
                              <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed">
                                {concept.whyWeNeedIt}
                              </p>
                            </div>
                          )}

                          {/* 2. L'Analogie parlante */}
                          {concept.analogy && (
                            <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-1.5">
                              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                                <span>☕ L'Analogie concrète</span>
                              </span>
                              <p className="text-xs sm:text-sm text-indigo-200 italic leading-relaxed">
                                « {concept.analogy} »
                              </p>
                            </div>
                          )}

                          {/* 3. Définition technique */}
                          <div className="space-y-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                              📖 Définition technique
                            </span>
                            <div className="p-4 rounded-2xl bg-background border border-border text-xs sm:text-sm text-zinc-200 leading-relaxed font-sans">
                              {concept.definition}
                            </div>
                          </div>

                          {/* 3. bis : Tableau comparatif X vs Y si présent */}
                          {concept.comparison && (
                            <div className="p-4 rounded-2xl bg-surface-elevated/80 border border-blue-500/20 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5 font-mono">
                                  <span>⚖️ Distinguer : {concept.title} vs {concept.comparison.versus}</span>
                                </span>
                              </div>

                              <p className="text-xs text-blue-200 font-medium leading-relaxed bg-blue-500/10 p-2.5 rounded-xl border border-blue-500/20">
                                <strong>Règle simple :</strong> {concept.comparison.rule}
                              </p>

                              {concept.comparison.table && concept.comparison.table.length > 0 && (
                                <div className="overflow-x-auto rounded-xl border border-border">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b border-border bg-surface text-zinc-300 font-bold">
                                        <th className="p-2.5 text-[11px]">Critère</th>
                                        <th className="p-2.5 text-[11px] text-blue-300">{concept.title}</th>
                                        <th className="p-2.5 text-[11px] text-amber-300">{concept.comparison.versus}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {concept.comparison.table.map((row, rIdx) => (
                                        <tr key={rIdx} className="border-b border-border/40 bg-surface/20">
                                          <td className="p-2.5 font-semibold text-zinc-400">{row.critere}</td>
                                          <td className="p-2.5 text-zinc-200">{row.a}</td>
                                          <td className="p-2.5 text-zinc-200">{row.b}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 4. Exemples progressifs */}
                          {concept.progressiveExamples && concept.progressiveExamples.length > 0 && (
                            <div className="space-y-3">
                              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                                🔬 Exemples progressifs
                              </span>
                              <div className="grid grid-cols-1 gap-3">
                                {concept.progressiveExamples.map((ex, exIdx) => {
                                  const isSimple = ex.level === 'simple';
                                  const isInter = ex.level === 'intermediaire';
                                  return (
                                    <div
                                      key={exIdx}
                                      className={`p-4 rounded-2xl border text-xs space-y-2 ${
                                        isSimple
                                          ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-100'
                                          : isInter
                                          ? 'bg-amber-500/5 border-amber-500/20 text-amber-100'
                                          : 'bg-rose-500/5 border-rose-500/20 text-rose-100'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="font-black text-[11px] px-2 py-0.5 rounded-full bg-surface">
                                          {isSimple ? '🟢 Niveau Simple' : isInter ? '🟡 Niveau Intermédiaire' : '🔴 Niveau Réaliste'}
                                        </span>
                                        <span className="font-bold text-white">{ex.title}</span>
                                      </div>
                                      <p className="text-zinc-200 leading-relaxed opacity-95">
                                        {ex.explanation}
                                      </p>
                                      {ex.codeOrFormula && (
                                        <pre className="p-2.5 rounded-xl bg-black/50 text-[11px] font-mono text-zinc-300 overflow-x-auto">
                                          {ex.codeOrFormula}
                                        </pre>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 5. Détails & Propriétés */}
                          {concept.details && concept.details.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                                📋 Détails & Propriétés clés
                              </span>
                              <ul className="space-y-1.5 pl-2">
                                {concept.details.map((d, dIdx) => (
                                  <li key={dIdx} className="text-xs text-zinc-300 flex items-start gap-2">
                                    <span className="text-blue-400 font-bold">•</span>
                                    <span>{d}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* 6. Pièges fréquents */}
                          {concept.traps && concept.traps.length > 0 && (
                            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2">
                              <span className="text-[11px] font-black uppercase tracking-wider text-rose-400">
                                ⚠️ Pièges & Confusions d'examen
                              </span>
                              <ul className="space-y-1">
                                {concept.traps.map((tr, trIdx) => (
                                  <li key={trIdx} className="text-xs text-rose-200">
                                    ⚠️ {tr}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* 7. Concepts liés */}
                          {concept.relatedConcepts && concept.relatedConcepts.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                                🔗 Concepts associés & liens transversaux
                              </span>
                              <div className="flex items-center gap-2 flex-wrap">
                                {concept.relatedConcepts.map((rc, rcIdx) => (
                                  <span
                                    key={rcIdx}
                                    className="px-2.5 py-1 rounded-lg bg-surface-elevated text-blue-300 border border-border text-xs font-mono"
                                  >
                                    [[{rc}]]
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 8. Fiche de révision Q&A */}
                          {concept.flashcardQnA && (
                            <div className="p-4 rounded-2xl bg-surface-elevated border border-border space-y-2">
                              <span className="text-[11px] font-black uppercase tracking-wider text-purple-400">
                                🎯 Question Flash d'auto-évaluation
                              </span>
                              <p className="text-xs font-bold text-white">
                                ❓ {concept.flashcardQnA.question}
                              </p>
                              <p className="text-xs text-zinc-300 bg-surface p-3 rounded-xl border border-border leading-relaxed">
                                ➔ <strong>Réponse :</strong> {concept.flashcardQnA.answer}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* --- ONGLET 3 : BOÎTE À OUTILS & DÉMONSTRATIONS --- */}
          {activeTab === 'boite' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Théorèmes et Lois */}
              {course.boiteAOutils?.theoremsAndLaws && course.boiteAOutils.theoremsAndLaws.length > 0 && (
                <div className="p-6 rounded-3xl bg-surface border border-border space-y-4">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>📐 Théorèmes, Lois & Démonstrations</span>
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    {course.boiteAOutils.theoremsAndLaws.map((th, idx) => (
                      <div key={idx} className="p-4 rounded-2xl bg-background border border-border space-y-2">
                        <span className="text-sm font-black text-emerald-400">{th.name}</span>
                        <p className="text-xs text-zinc-200 font-medium leading-relaxed">{th.statement}</p>
                        {th.proofOrMechanism && (
                          <div className="text-xs text-zinc-300 bg-surface p-3 rounded-xl border border-border leading-relaxed">
                            <strong>Démonstration / Mécanisme :</strong> {th.proofOrMechanism}
                          </div>
                        )}
                        {th.conditionOfValidity && (
                          <p className="text-[11px] text-amber-300">
                            <strong>Conditions de validité :</strong> {th.conditionOfValidity}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Formules et Équations */}
              {course.boiteAOutils?.formulas && course.boiteAOutils.formulas.length > 0 && (
                <div className="p-6 rounded-3xl bg-surface border border-border space-y-4">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>⚡ Formules & Équations clés</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {course.boiteAOutils.formulas.map((fm, idx) => (
                      <div key={idx} className="p-4 rounded-2xl bg-background border border-border space-y-2">
                        <span className="text-xs font-bold text-blue-400">{fm.name}</span>
                        <div className="p-2.5 rounded-xl bg-black/60 font-mono text-sm text-center text-emerald-300 font-bold border border-border">
                          {fm.formula}
                        </div>
                        {fm.variablesExplanation && (
                          <p className="text-[11px] text-zinc-400 leading-relaxed">{fm.variablesExplanation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Méthodologie Examen */}
              {course.methodoExamen && (
                <div className="p-6 rounded-3xl bg-surface border border-border space-y-4">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>🎓 Méthodologie & Questions types de partiel</span>
                  </h3>
                  {course.methodoExamen.typicalQuestions && course.methodoExamen.typicalQuestions.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-amber-400">❓ Questions récurrentes des enseignants :</span>
                      <ul className="space-y-1.5 pl-2">
                        {course.methodoExamen.typicalQuestions.map((q, idx) => (
                          <li key={idx} className="text-xs text-zinc-200">
                            • {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {course.methodoExamen.gradingCriteria && course.methodoExamen.gradingCriteria.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <span className="text-xs font-bold text-emerald-400">✓ Critères d'excellence au partiel :</span>
                      <ul className="space-y-1.5 pl-2">
                        {course.methodoExamen.gradingCriteria.map((c, idx) => (
                          <li key={idx} className="text-xs text-zinc-200">
                            • {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* --- ONGLET 2 : FLASHCARDS DU COURS --- */}
          {activeTab === 'flashcards' && (
            <div className="space-y-4">
              {(!course.cards || course.cards.length === 0) ? (
                <div className="p-12 text-center bg-surface rounded-2xl border border-border text-xs text-zinc-400">
                  Aucune flashcard enregistrée pour ce cours.
                </div>
              ) : (
                course.cards.map((card, idx) => {
                  const cardId = card.id || `card-${idx}`;
                  const isExpanded = Boolean(expandedCards[cardId]);

                  return (
                    <div
                      key={cardId}
                      className="rounded-2xl bg-surface border border-border hover:border-zinc-700 transition-all overflow-hidden shadow-xs"
                    >
                      <div
                        onClick={() => toggleCard(cardId)}
                        className="p-5 cursor-pointer flex items-start justify-between gap-4 select-none hover:bg-surface-elevated/40 transition-colors"
                      >
                        <div className="space-y-2 flex-1">
                          <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                            {card.kind || 'Question clé'}
                          </span>
                          <h4 className="text-sm sm:text-base font-bold text-zinc-100 leading-snug">
                            {card.question}
                          </h4>
                        </div>

                        <span className="text-xs font-bold text-blue-400 shrink-0 flex items-center gap-1 mt-1">
                          <span>{isExpanded ? 'Masquer' : 'Voir réponse'}</span>
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="px-5 pb-5 pt-2 border-t border-border/60 bg-surface-elevated/30 space-y-4 animate-fadeIn">
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-1 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Réponse attendue</span>
                            </div>
                            <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed bg-surface p-4 rounded-xl border border-border">
                              {card.answer}
                            </p>
                          </div>

                          {card.trap && (
                            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                              <strong>⚠️ Piège fréquent d'examen :</strong> {card.trap}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* --- ONGLET 3 : SCHÉMAS & DOCUMENTS --- */}
          {activeTab === 'schemas' && selectedPhoto && (
            <div className="space-y-6">
              <div className="p-6 rounded-3xl bg-surface border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">📸 {selectedPhoto.name || selectedPhoto.filename}</h3>
                  <div className="flex items-center gap-2">
                    {course.photos && course.photos.length > 1 && (
                      <span className="text-xs text-zinc-500">
                        {selectedPhotoIndex + 1} / {course.photos.length}
                      </span>
                    )}
                  </div>
                </div>

                <div className="relative rounded-2xl overflow-hidden bg-black flex items-center justify-center max-h-[500px]">
                  <img
                    src={selectedPhoto.url || `/api/courses/photos/${encodeURIComponent(selectedPhoto.filename)}`}
                    alt={selectedPhoto.name || 'Photo du tableau'}
                    className="max-h-[500px] w-auto object-contain"
                  />
                </div>
              </div>
            </div>
          )}

          {/* --- ONGLET 4 : RE-TESTER SA MÉMOIRE (RAPPEL ACTIF VOLONTAIRE) --- */}
          {activeTab === 'retest' && (
            <div className="p-6 sm:p-8 rounded-3xl bg-surface border border-border space-y-6 shadow-sm">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-black">
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>ENTRAÎNEMENT LIBRE DE RÉCUPÉRATION ACTIVE</span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  Re-teste ta mémoire sur ce cours
                </h3>
                <p className="text-xs text-zinc-400">
                  Réciter à nouveau ce cours permet de renforcer la trace mnésique. Gemini ré-évaluera tes progrès.
                </p>
              </div>

              <form onSubmit={handleUnlockRecall} className="space-y-4">
                <textarea
                  value={recallInput}
                  onChange={(e) => setRecallInput(e.target.value)}
                  rows={5}
                  placeholder="Raconte à nouveau ce dont tu te souviens..."
                  className="w-full p-4 rounded-2xl bg-background border border-border text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                />

                <button
                  type="submit"
                  disabled={isEvaluatingRecall || !recallInput.trim()}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  <Zap className="w-4 h-4" />
                  <span>Évaluer ma progression</span>
                </button>
              </form>
            </div>
          )}

          {/* --- ONGLET 5 : NOTES PERSONNELLES --- */}
          {activeTab === 'notes' && (
            <div className="p-6 rounded-3xl bg-surface border border-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">📝 Mes notes personnelles</h3>
                <button
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saveSuccess ? 'Enregistré !' : 'Enregistrer'}</span>
                </button>
              </div>

              <textarea
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                rows={8}
                placeholder="Ajoute tes annotations, conseils donnés par le professeur..."
                className="w-full p-4 rounded-2xl bg-background border border-border text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
