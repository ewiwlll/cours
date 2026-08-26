import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Zap,
  FolderTree,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Calendar,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import {
  getSubjects,
  getStudyCourses,
  getChapterDefinitions,
  createChapterDefinition,
  deleteChapterDefinition,
  deleteStudyCourse,
  deleteSubject,
  createSubject,
} from '../lib/api';
import type { Subject, Course, ChapterDefinition, Card } from '../lib/types';
import { formatDate } from '../lib/utils';
import { useStore } from '../lib/store';

interface SubjectsViewProps {
  initialSubjectId?: string;
  onOpenCourse?: (courseId: string) => void;
  onStartSession?: (minutes: number, mode?: string, subjectId?: string) => void;
  onAddCourse?: (subjectId: string) => void;
}

export const SubjectsView: React.FC<SubjectsViewProps> = ({
  initialSubjectId,
  onOpenCourse,
  onStartSession,
  onAddCourse,
}) => {
  const { selectedSubjectId, setSelectedSubjectId, openModal } = useStore();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [chapterDefs, setChapterDefs] = useState<ChapterDefinition[]>([]);
  const [activeTab, setActiveTab] = useState<'courses' | 'flashcards' | 'chapters'>('courses');
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});
  const [flashcardFilterChapter, setFlashcardFilterChapter] = useState<string>('ALL');
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [subSemesterFilter, setSubSemesterFilter] = useState<'all' | 'S1' | 'S2'>('all');
  const [loading, setLoading] = useState<boolean>(true);

  // Load initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const [subList, courseList, chDefs] = await Promise.all([
        getSubjects(),
        getStudyCourses(),
        getChapterDefinitions(),
      ]);
      setSubjects(subList || []);
      setCourses(courseList || []);
      setChapterDefs(chDefs || []);

      if (!selectedSubjectId && subList && subList.length > 0) {
        setSelectedSubjectId(initialSubjectId || subList[0].id);
      }
    } catch (err) {
      console.error('Error loading subjects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [initialSubjectId]);

  const filteredSubjectsList = useMemo(() => {
    if (subSemesterFilter === 'all') return subjects;
    return subjects.filter((s) => s.semester === subSemesterFilter);
  }, [subjects, subSemesterFilter]);

  const activeSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId) || filteredSubjectsList[0] || subjects[0];
  }, [subjects, selectedSubjectId, filteredSubjectsList]);

  const subjectCourses = useMemo(() => {
    if (!activeSubject) return [];
    return courses.filter((c) => c.subjectId === activeSubject.id);
  }, [courses, activeSubject]);

  const subjectChapters = useMemo(() => {
    if (!activeSubject) return [];
    return chapterDefs.filter((c) => c.subjectId === activeSubject.id);
  }, [chapterDefs, activeSubject]);

  // Group courses by chapter
  const coursesByChapter = useMemo(() => {
    const map: Record<string, Course[]> = {};
    const unassigned: Course[] = [];

    subjectChapters.forEach((ch) => {
      map[ch.title] = [];
    });

    subjectCourses.forEach((c) => {
      const chName = c.chapter?.trim();
      if (chName) {
        if (!map[chName]) map[chName] = [];
        map[chName].push(c);
      } else {
        unassigned.push(c);
      }
    });

    return { map, unassigned };
  }, [subjectCourses, subjectChapters]);

  // Collect all flashcards for this subject
  const allSubjectFlashcards = useMemo(() => {
    const cards: Array<{ card: Card; courseTitle: string; chapter?: string }> = [];
    subjectCourses.forEach((c) => {
      if (c.cards && c.cards.length > 0) {
        c.cards.forEach((card) => {
          cards.push({ card, courseTitle: c.title, chapter: c.chapter });
        });
      }
    });
    return cards;
  }, [subjectCourses]);

  const filteredFlashcards = useMemo(() => {
    if (flashcardFilterChapter === 'ALL') return allSubjectFlashcards;
    if (flashcardFilterChapter === 'UNASSIGNED') {
      return allSubjectFlashcards.filter((item) => !item.chapter);
    }
    return allSubjectFlashcards.filter((item) => item.chapter === flashcardFilterChapter);
  }, [allSubjectFlashcards, flashcardFilterChapter]);

  const toggleChapterCollapse = (chapName: string) => {
    setCollapsedChapters((prev) => ({
      ...prev,
      [chapName]: !prev[chapName],
    }));
  };

  const toggleCardExpand = (cardId: string) => {
    setExpandedCardIds((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const handleCreateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapterTitle.trim() || !activeSubject) return;
    try {
      const created = await createChapterDefinition({
        subjectId: activeSubject.id,
        title: newChapterTitle.trim(),
      });
      if (created) {
        setChapterDefs((prev) => [...prev, created]);
        setNewChapterTitle('');
      }
    } catch (err) {
      console.error('Error creating chapter:', err);
    }
  };

  // Safe Deletion with Confirmation Modals
  const handleDeleteCourse = async (courseId: string, courseTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `⚠️ Voulez-vous vraiment supprimer définitivement le cours "${courseTitle}" ?\n\nCette action effacera également toutes ses fiches et questions associées.`
    );
    if (!confirmed) return;

    const ok = await deleteStudyCourse(courseId);
    if (ok) {
      setCourses((prev) => prev.filter((c) => c.id !== courseId));
    }
  };

  const handleDeleteChapter = async (chapterId: string, chapterTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `⚠️ Voulez-vous vraiment supprimer le chapitre "${chapterTitle}" ?`
    );
    if (!confirmed) return;

    const ok = await deleteChapterDefinition(chapterId);
    if (ok) {
      setChapterDefs((prev) => prev.filter((ch) => ch.id !== chapterId));
    }
  };

  const handleDeleteSubject = async () => {
    if (!activeSubject) return;
    const confirmed = window.confirm(
      `⚠️ Voulez-vous vraiment supprimer la matière "${activeSubject.title}" ?\n\nCette action effacera la matière de votre classeur.`
    );
    if (!confirmed) return;

    const ok = await deleteSubject(activeSubject.id);
    if (ok) {
      const remaining = subjects.filter((s) => s.id !== activeSubject.id);
      setSubjects(remaining);
      if (remaining.length > 0) {
        setSelectedSubjectId(remaining[0].id);
      }
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-zinc-500 text-sm animate-pulse">
        Chargement de tes matières...
      </div>
    );
  }

  if (!activeSubject) {
    return (
      <div className="p-12 text-center text-zinc-500 text-sm">
        Sélectionne une matière dans la barre latérale pour afficher ses cours.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* BARRE DE SÉLECTION DE MATIÈRE RAPIDE (OPTIMISÉE MOBILE & DESKTOP) */}
      <div className="space-y-3 p-3.5 sm:p-4 rounded-2xl bg-surface/80 border border-border">
        <div className="flex items-center justify-between gap-2">
          {/* Filtres de Semestre */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSubSemesterFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                subSemesterFilter === 'all'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setSubSemesterFilter('S1')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                subSemesterFilter === 'S1'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              S1
            </button>
            <button
              onClick={() => setSubSemesterFilter('S2')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                subSemesterFilter === 'S2'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              S2
            </button>
          </div>

          <button
            onClick={() => openModal('courseEditor', activeSubject?.id)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 border border-zinc-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-blue-400" />
            <span>+ Matière</span>
          </button>
        </div>

        {/* Liste horizontale des pilules de matières */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
          {filteredSubjectsList.map((sub) => {
            const isSelected = activeSubject?.id === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => setSelectedSubjectId(sub.id)}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]'
                    : 'bg-surface-elevated text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-border-subtle'
                }`}
              >
                {sub.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. EN-TÊTE ÉPURÉ ET AÉRÉ DE LA MATIÈRE */}
      <div className="p-7 sm:p-8 rounded-3xl bg-surface border border-border relative overflow-hidden shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            {/* Meta badges discrets */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {activeSubject.semester === 'S1' ? 'Semestre 1' : 'Semestre 2'}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {activeSubject.ects} ECTS
              </span>
              <span className="text-xs text-zinc-400 font-medium">
                {activeSubject.category || 'Tronc commun'} • Priorité {activeSubject.priority}
              </span>
            </div>

            {/* Grand Titre de la Matière */}
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {activeSubject.title}
            </h1>

            {/* Stats simples */}
            <p className="text-xs text-zinc-400 flex items-center gap-3">
              <span>📚 <strong>{subjectCourses.length}</strong> cours enregistrés</span>
              <span>•</span>
              <span>🧠 <strong>{allSubjectFlashcards.length}</strong> flashcards actives</span>
            </p>
          </div>

          {/* Boutons d'action clairs */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={() => onAddCourse ? onAddCourse(activeSubject.id) : openModal('courseEditor')}
              className="px-4 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-muted text-zinc-200 hover:text-white border border-border text-xs font-bold transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4 text-blue-400" />
              <span>+ Nouveau cours</span>
            </button>

            {allSubjectFlashcards.length > 0 && (
              <button
                onClick={() => onStartSession?.(15, 'standard', activeSubject.id)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 hover:scale-105 transition-all flex items-center gap-2"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>S'entraîner ({allSubjectFlashcards.length})</span>
              </button>
            )}

            <button
              onClick={handleDeleteSubject}
              title="Supprimer cette matière"
              className="p-2.5 rounded-xl bg-surface-elevated hover:bg-red-500/20 text-zinc-500 hover:text-red-400 border border-border text-xs transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. ONGLETS CLAIRS (COURS / FLASHCARDS / CHAPITRES) */}
      <div className="space-y-6">
        <div className="flex items-center gap-8 border-b border-border/80 px-2">
          <button
            onClick={() => setActiveTab('courses')}
            className={`pb-3.5 text-sm font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'courses' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookOpen className={`w-4 h-4 ${activeTab === 'courses' ? 'text-blue-400' : 'text-zinc-500'}`} />
            <span>Tous les cours ({subjectCourses.length})</span>
            {activeTab === 'courses' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('flashcards')}
            className={`pb-3.5 text-sm font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'flashcards' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className={`w-4 h-4 ${activeTab === 'flashcards' ? 'text-purple-400' : 'text-zinc-500'}`} />
            <span>Flashcards ({allSubjectFlashcards.length})</span>
            {activeTab === 'flashcards' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('chapters')}
            className={`pb-3.5 text-sm font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'chapters' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FolderTree className={`w-4 h-4 ${activeTab === 'chapters' ? 'text-amber-400' : 'text-zinc-500'}`} />
            <span>Chapitres ({subjectChapters.length})</span>
            {activeTab === 'chapters' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />
            )}
          </button>
        </div>

        {/* ---------------- ONGLET 1 : COURS ---------------- */}
        {activeTab === 'courses' && (
          <div className="space-y-6">
            {subjectCourses.length === 0 ? (
              <div className="p-12 text-center bg-surface rounded-2xl border border-border space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Aucun cours dans cette matière</h3>
                  <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                    Enregistre ton premier cours en amphi ou dépose tes notes pour créer automatiquement la fiche.
                  </p>
                </div>
                <button
                  onClick={() => onAddCourse ? onAddCourse(activeSubject.id) : openModal('courseEditor')}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter un cours</span>
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Par Chapitres */}
                {subjectChapters.map((ch) => {
                  const chCourses = coursesByChapter.map[ch.title] || [];
                  const isCollapsed = !!collapsedChapters[ch.title];

                  return (
                    <div
                      key={ch.id}
                      className="rounded-2xl bg-surface border border-border overflow-hidden shadow-sm transition-all"
                    >
                      <div className="w-full p-5 flex items-center justify-between bg-surface-elevated/40 hover:bg-surface-elevated transition-colors text-left">
                        <button
                          onClick={() => toggleChapterCollapse(ch.title)}
                          className="flex items-center gap-3 flex-1 text-left"
                        >
                          <span className="text-lg">📂</span>
                          <div>
                            <span className="text-sm font-bold text-white">{ch.title}</span>
                            <span className="text-xs text-zinc-400 ml-3">
                              {chCourses.length} cours
                            </span>
                          </div>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => handleDeleteChapter(ch.id, ch.title, e)}
                            title="Supprimer ce chapitre"
                            className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => toggleChapterCollapse(ch.title)}
                            className="p-1 text-zinc-400"
                          >
                            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div className="p-5 space-y-3.5">
                          {chCourses.length === 0 ? (
                            <div className="py-4 text-center text-xs text-zinc-500">
                              Aucun cours rattaché à ce chapitre pour le moment.
                            </div>
                          ) : (
                            [...chCourses]
                              .sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime())
                              .map((c) => (
                                <div
                                  key={c.id}
                                  onClick={() => onOpenCourse?.(c.id)}
                                  className="p-4 rounded-xl bg-background border border-border hover:border-zinc-700 hover:bg-surface-elevated/60 cursor-pointer transition-all flex items-center justify-between gap-4 group"
                                >
                                  <div className="space-y-1.5 min-w-0 flex-1">
                                    <div className="flex items-center gap-2 text-xs text-zinc-400 flex-wrap">
                                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20 text-[10px]">
                                        Phase {c.courseNumber || 1}
                                      </span>
                                      <span className="flex items-center gap-1 text-zinc-400">
                                        <Calendar className="w-3 h-3 text-zinc-500" />
                                        {formatDate(c.date)}
                                      </span>
                                      {c.partLabel && (
                                        <span className="px-2 py-0.5 rounded bg-surface-muted text-zinc-400 text-[10px] font-medium">
                                          {c.partLabel}
                                        </span>
                                      )}
                                      {c.recallStatus === 'locked' ? (
                                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">
                                          🔒 Rappel requis
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                                          ✓ Prêt
                                        </span>
                                      )}
                                    </div>
                                    <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                                      {c.title}
                                    </h4>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    {c.cards && c.cards.length > 0 && (
                                      <span className="text-xs px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 font-bold border border-purple-500/20">
                                        🧠 {c.cards.length} cartes
                                      </span>
                                    )}
                                    <span className="text-xs font-bold text-blue-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                                      Ouvrir <ArrowRight className="w-3.5 h-3.5" />
                                    </span>
                                    <button
                                      onClick={(e) => handleDeleteCourse(c.id, c.title, e)}
                                      title="Supprimer ce cours"
                                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Cours sans chapitre */}
                {coursesByChapter.unassigned.length > 0 && (
                  <div className="rounded-2xl bg-surface border border-border overflow-hidden shadow-sm">
                    <button
                      onClick={() => toggleChapterCollapse('unassigned')}
                      className="w-full p-5 flex items-center justify-between bg-surface-elevated/40 hover:bg-surface-elevated transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">📄</span>
                        <div>
                          <span className="text-sm font-bold text-white">Cours sans chapitre</span>
                          <span className="text-xs text-zinc-400 ml-3">
                            {coursesByChapter.unassigned.length} cours
                          </span>
                        </div>
                      </div>
                      {collapsedChapters['unassigned'] ? (
                        <ChevronRight className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </button>

                    {!collapsedChapters['unassigned'] && (
                      <div className="p-5 space-y-3.5">
                        {coursesByChapter.unassigned.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => onOpenCourse?.(c.id)}
                            className="p-4 rounded-xl bg-background border border-border hover:border-zinc-700 hover:bg-surface-elevated/60 cursor-pointer transition-all flex items-center justify-between gap-4 group"
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 text-xs text-zinc-500">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(c.date)}
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                                {c.title}
                              </h4>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {c.cards && c.cards.length > 0 && (
                                <span className="text-xs px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 font-bold border border-purple-500/20">
                                  {c.cards.length} cartes
                                </span>
                              )}
                              <span className="text-xs font-bold text-blue-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                                Ouvrir <ArrowRight className="w-3.5 h-3.5" />
                              </span>
                              <button
                                onClick={(e) => handleDeleteCourse(c.id, c.title, e)}
                                title="Supprimer ce cours"
                                className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---------------- ONGLET 2 : FLASHCARDS AÉRÉES ---------------- */}
        {activeTab === 'flashcards' && (
          <div className="space-y-6">
            {/* Filter toolbar */}
            <div className="flex items-center justify-between gap-4 flex-wrap bg-surface p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 font-medium">Filtrer par chapitre :</span>
                <select
                  value={flashcardFilterChapter}
                  onChange={(e) => setFlashcardFilterChapter(e.target.value)}
                  className="bg-surface-elevated border border-border rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">Tous les chapitres ({allSubjectFlashcards.length})</option>
                  {subjectChapters.map((ch) => (
                    <option key={ch.id} value={ch.title}>
                      {ch.title}
                    </option>
                  ))}
                  <option value="UNASSIGNED">Sans chapitre</option>
                </select>
              </div>

              {filteredFlashcards.length > 0 && (
                <button
                  onClick={() => onStartSession?.(15, 'standard', activeSubject.id)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 fill-white" />
                  <span>Réviser ces {filteredFlashcards.length} questions</span>
                </button>
              )}
            </div>

            {/* Flashcard list */}
            {filteredFlashcards.length === 0 ? (
              <div className="p-12 text-center bg-surface rounded-2xl border border-border text-xs text-zinc-400">
                Aucune flashcard disponible pour ce filtre.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredFlashcards.map(({ card, courseTitle, chapter }, idx) => {
                  const isExpanded = !!expandedCardIds[card.id || String(idx)];
                  const cardId = card.id || `card-${idx}`;

                  return (
                    <div
                      key={cardId}
                      className="rounded-2xl bg-surface border border-border hover:border-zinc-700 transition-all overflow-hidden shadow-xs"
                    >
                      <div
                        onClick={() => toggleCardExpand(cardId)}
                        className="p-5 cursor-pointer flex items-start justify-between gap-4 select-none hover:bg-surface-elevated/40 transition-colors"
                      >
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                              {card.kind || 'Question clé'}
                            </span>
                            {chapter && (
                              <span className="text-xs text-zinc-400 font-medium">📂 {chapter}</span>
                            )}
                            <span className="text-xs text-zinc-500">• {courseTitle}</span>
                          </div>
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
                })}
              </div>
            )}
          </div>
        )}

        {/* ---------------- ONGLET 3 : CHAPITRES ---------------- */}
        {activeTab === 'chapters' && (
          <div className="space-y-6">
            {/* Create chapter form */}
            <form
              onSubmit={handleCreateChapter}
              className="p-5 rounded-2xl bg-surface border border-border flex items-center gap-3"
            >
              <input
                type="text"
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                placeholder="Nouveau chapitre (ex: Chapitre 3 - Cycle de Krebs)..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shrink-0 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Créer</span>
              </button>
            </form>

            <div className="space-y-3">
              {subjectChapters.map((ch) => {
                const count = (coursesByChapter.map[ch.title] || []).length;
                return (
                  <div
                    key={ch.id}
                    className="p-4 rounded-2xl bg-surface border border-border flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📂</span>
                      <div>
                        <h4 className="text-sm font-bold text-white">{ch.title}</h4>
                        <p className="text-xs text-zinc-500">{count} cours rattachés</p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteChapter(ch.id, ch.title, e)}
                      title="Supprimer ce chapitre"
                      className="p-2 rounded-xl bg-surface-elevated hover:bg-red-500/20 text-zinc-500 hover:text-red-400 border border-border text-xs transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
