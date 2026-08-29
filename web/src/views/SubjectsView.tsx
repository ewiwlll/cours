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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [collapsedSubjects, setCollapsedSubjects] = useState<Record<string, boolean>>({});
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});
  const [newChapterTitles, setNewChapterTitles] = useState<Record<string, string>>({});
  const [showFlashcardsForSubject, setShowFlashcardsForSubject] = useState<string | null>(null);
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
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
    } catch (err) {
      console.error('Error loading subjects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [initialSubjectId]);

  // Categories list
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    subjects.forEach((s) => {
      if (s.category) set.add(s.category.trim());
    });
    return Array.from(set);
  }, [subjects]);

  // Filtered subjects list
  const filteredSubjects = useMemo(() => {
    return subjects.filter((subj) => {
      const matchesCategory =
        selectedCategory === 'all' || subj.category?.trim() === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        subj.title.toLowerCase().includes(q) ||
        subj.category?.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [subjects, selectedCategory, searchQuery]);

  // Group data by subject and chapter
  const dataBySubject = useMemo(() => {
    const map: Record<
      string,
      {
        subjectCourses: Course[];
        subjectChapters: ChapterDefinition[];
        coursesByChapter: Record<string, Course[]>;
        unassignedCourses: Course[];
        allCards: Array<{ card: Card; courseTitle: string; chapter?: string }>;
      }
    > = {};

    subjects.forEach((subj) => {
      const sCourses = courses.filter((c) => c.subjectId === subj.id);
      const sChapters = chapterDefs.filter((ch) => ch.subjectId === subj.id);

      const byChapter: Record<string, Course[]> = {};
      const unassigned: Course[] = [];

      sChapters.forEach((ch) => {
        byChapter[ch.title] = [];
      });

      sCourses.forEach((c) => {
        const chName = c.chapter?.trim();
        if (chName) {
          if (!byChapter[chName]) byChapter[chName] = [];
          byChapter[chName].push(c);
        } else {
          unassigned.push(c);
        }
      });

      // Sort courses inside chapters by Phase / courseNumber
      Object.keys(byChapter).forEach((chName) => {
        byChapter[chName].sort((a, b) => (a.courseNumber || 1) - (b.courseNumber || 1));
      });
      unassigned.sort((a, b) => (a.courseNumber || 1) - (b.courseNumber || 1));

      const cards: Array<{ card: Card; courseTitle: string; chapter?: string }> = [];
      sCourses.forEach((c) => {
        if (c.cards && c.cards.length > 0) {
          c.cards.forEach((card) => {
            cards.push({ card, courseTitle: c.title, chapter: c.chapter });
          });
        }
      });

      map[subj.id] = {
        subjectCourses: sCourses,
        subjectChapters: sChapters,
        coursesByChapter: byChapter,
        unassignedCourses: unassigned,
        allCards: cards,
      };
    });

    return map;
  }, [subjects, courses, chapterDefs]);

  const toggleSubjectCollapse = (subjId: string) => {
    setCollapsedSubjects((prev) => ({
      ...prev,
      [subjId]: !prev[subjId],
    }));
  };

  const toggleChapterCollapse = (chapKey: string) => {
    setCollapsedChapters((prev) => ({
      ...prev,
      [chapKey]: !prev[chapKey],
    }));
  };

  const toggleCardExpand = (cardId: string) => {
    setExpandedCardIds((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const handleCreateChapter = async (subjectId: string, e: React.FormEvent) => {
    e.preventDefault();
    const title = (newChapterTitles[subjectId] || '').trim();
    if (!title) return;

    try {
      const created = await createChapterDefinition({
        subjectId,
        title,
      });
      if (created) {
        setChapterDefs((prev) => [...prev, created]);
        setNewChapterTitles((prev) => ({ ...prev, [subjectId]: '' }));
      }
    } catch (err) {
      console.error('Error creating chapter:', err);
    }
  };

  const handleDeleteSubject = async (subjectId: string, subjectTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `⚠️ Voulez-vous vraiment supprimer définitivement la matière "${subjectTitle}" ?\n\nCette action effacera également tous ses chapitres et cours associés.`
    );
    if (!confirmed) return;

    const ok = await deleteSubject(subjectId);
    if (ok) {
      setSubjects((prev) => prev.filter((s) => s.id !== subjectId));
      if (selectedSubjectId === subjectId) {
        setSelectedSubjectId(null);
      }
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

  const handleDeleteCourse = async (courseId: string, courseTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `⚠️ Voulez-vous vraiment supprimer le cours "${courseTitle}" ?`
    );
    if (!confirmed) return;

    const ok = await deleteStudyCourse(courseId);
    if (ok) {
      setCourses((prev) => prev.filter((c) => c.id !== courseId));
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-zinc-500 text-sm animate-pulse">
        Chargement de vos matières et chapitres...
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn pb-20 max-w-5xl mx-auto">
      {/* 1. EN-TÊTE PRINCIPAL DE LA VUE MATIÈRES */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-surface border border-border shadow-md">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <FolderTree className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Mes Matières ({subjects.length})
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400">
            Créez vos matières, organisez vos chapitres et ajoutez vos cours rangés par phase.
          </p>
        </div>

        <button
          onClick={() => openModal('subjectEditor')}
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-all flex items-center gap-2 shrink-0 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Nouvelle matière</span>
        </button>
      </div>

      {/* 2. BARRE DE FILTRE PAR DOMAINE ET RECHERCHE */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface/80 p-3 rounded-2xl border border-border">
        {/* Filtres de Catégories */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar py-0.5">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-surface-elevated text-zinc-400 hover:text-zinc-200 border border-border-subtle'
            }`}
          >
            Toutes ({subjects.length})
          </button>
          {categoriesList.map((cat) => {
            const count = subjects.filter((s) => s.category?.trim() === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-surface-elevated text-zinc-400 hover:text-zinc-200 border border-border-subtle'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Input de recherche */}
        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Filtrer une matière..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-1.5 rounded-xl bg-background border border-border text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* 3. LISTE DE TOUTES LES MATIÈRES (ARBORESCENCE 3 NIVEAUX) */}
      {filteredSubjects.length === 0 ? (
        <div className="p-16 text-center bg-surface rounded-3xl border border-border space-y-4 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Aucune matière trouvée</h3>
            <p className="text-xs text-zinc-400 mt-1">
              {searchQuery ? 'Aucun résultat pour cette recherche.' : 'Créez votre première matière pour démarrer vos révisions.'}
            </p>
          </div>
          <button
            onClick={() => openModal('subjectEditor')}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Créer une matière</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredSubjects.map((subj) => {
            const data = dataBySubject[subj.id] || {
              subjectCourses: [],
              subjectChapters: [],
              coursesByChapter: {},
              unassignedCourses: [],
              allCards: [],
            };

            const isSubjCollapsed = !!collapsedSubjects[subj.id];
            const isViewingFlashcards = showFlashcardsForSubject === subj.id;

            return (
              <div
                key={subj.id}
                id={`subject-${subj.id}`}
                className="rounded-3xl bg-surface border border-border overflow-hidden shadow-lg transition-all"
              >
                {/* ---------------- NIVEAU 1 : EN-TÊTE DE LA MATIÈRE ---------------- */}
                <div className="p-5 sm:p-7 bg-surface-elevated/40 border-b border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {subj.category || 'Matière'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        {subj.ects} ECTS
                      </span>
                      {subj.priority && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Priorité {subj.priority}
                        </span>
                      )}
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                      {subj.title}
                    </h2>

                    <p className="text-xs text-zinc-400 flex items-center gap-3 flex-wrap">
                      <span>📂 <strong>{data.subjectChapters.length}</strong> {data.subjectChapters.length > 1 ? 'chapitres' : 'chapitre'}</span>
                      <span>•</span>
                      <span>📚 <strong>{data.subjectCourses.length}</strong> {data.subjectCourses.length > 1 ? 'cours' : 'cours'}</span>
                      <span>•</span>
                      <span>🧠 <strong>{data.allCards.length}</strong> flashcards</span>
                    </p>
                  </div>

                  {/* Actions de la matière */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      onClick={() => onAddCourse ? onAddCourse(subj.id) : openModal('courseEditor', subj.id)}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                      title="Ajouter une séance de cours"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Cours</span>
                    </button>

                    {data.allCards.length > 0 && (
                      <button
                        onClick={() => {
                          if (isViewingFlashcards) {
                            setShowFlashcardsForSubject(null);
                          } else {
                            setShowFlashcardsForSubject(subj.id);
                          }
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                          isViewingFlashcards
                            ? 'bg-purple-600 text-white border-purple-500'
                            : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border-purple-500/30'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Flashcards ({data.allCards.length})</span>
                      </button>
                    )}

                    <button
                      onClick={(e) => handleDeleteSubject(subj.id, subj.title, e)}
                      title="Supprimer cette matière"
                      className="p-2 rounded-xl bg-surface-elevated hover:bg-red-500/20 text-zinc-500 hover:text-red-400 border border-border text-xs transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => toggleSubjectCollapse(subj.id)}
                      className="p-2 rounded-xl bg-surface-elevated hover:bg-surface-muted text-zinc-400 hover:text-white border border-border text-xs transition-colors"
                      title={isSubjCollapsed ? 'Déplier la matière' : 'Replier la matière'}
                    >
                      {isSubjCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* ---------------- CONTENU DE LA MATIÈRE (DÉPLIÉ) ---------------- */}
                {!isSubjCollapsed && (
                  <div className="p-5 sm:p-7 space-y-6 bg-surface/40">
                    {/* Vue Flashcards Dépliée si demandée */}
                    {isViewingFlashcards ? (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            <span>Flashcards de {subj.title} ({data.allCards.length})</span>
                          </h4>
                          <button
                            onClick={() => onStartSession?.(15, 'standard', subj.id)}
                            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5"
                          >
                            <Zap className="w-3.5 h-3.5 fill-white" />
                            <span>S'entraîner</span>
                          </button>
                        </div>

                        <div className="space-y-3">
                          {data.allCards.map(({ card, courseTitle, chapter }, idx) => {
                            const isExpanded = !!expandedCardIds[card.id || String(idx)];
                            const cardId = card.id || `card-${subj.id}-${idx}`;

                            return (
                              <div
                                key={cardId}
                                className="rounded-2xl bg-surface border border-border overflow-hidden shadow-xs"
                              >
                                <div
                                  onClick={() => toggleCardExpand(cardId)}
                                  className="p-4 cursor-pointer flex items-start justify-between gap-4 select-none hover:bg-surface-elevated/40 transition-colors"
                                >
                                  <div className="space-y-1.5 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                                        {card.kind || 'Question'}
                                      </span>
                                      {chapter && (
                                        <span className="text-[11px] text-zinc-400 font-medium">📂 {chapter}</span>
                                      )}
                                      <span className="text-[11px] text-zinc-500">• {courseTitle}</span>
                                    </div>
                                    <h5 className="text-sm font-bold text-zinc-100">{card.question}</h5>
                                  </div>

                                  <span className="text-xs font-bold text-blue-400 shrink-0 flex items-center gap-1 mt-1">
                                    <span>{isExpanded ? 'Masquer' : 'Voir réponse'}</span>
                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                  </span>
                                </div>

                                {isExpanded && (
                                  <div className="p-4 pt-2 border-t border-border/60 bg-surface-elevated/20 space-y-3">
                                    <div>
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1 flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Réponse attendue</span>
                                      </div>
                                      <p className="text-xs text-zinc-200 leading-relaxed bg-surface p-3 rounded-xl border border-border">
                                        {card.answer}
                                      </p>
                                    </div>
                                    {card.trap && (
                                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                                        <strong>⚠️ Piège fréquent d'examen :</strong> {card.trap}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      /* ---------------- NIVEAU 2 : LES CHAPITRES DE LA MATIÈRE ---------------- */
                      <div className="space-y-5">
                        {/* Formulaire d'ajout rapide de chapitre */}
                        <form
                          onSubmit={(e) => handleCreateChapter(subj.id, e)}
                          className="p-3 sm:p-4 rounded-2xl bg-surface border border-border flex items-center gap-3 shadow-xs"
                        >
                          <div className="text-zinc-400 text-lg pl-1">📂</div>
                          <input
                            type="text"
                            value={newChapterTitles[subj.id] || ''}
                            onChange={(e) =>
                              setNewChapterTitles((prev) => ({
                                ...prev,
                                [subj.id]: e.target.value,
                              }))
                            }
                            placeholder={`Ajouter un chapitre dans ${subj.title} (ex: Chapitre 1 : Espaces Vectoriels)...`}
                            className="flex-1 px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                          />
                          <button
                            type="submit"
                            disabled={!(newChapterTitles[subj.id] || '').trim()}
                            className="px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface-muted border border-border hover:border-zinc-600 disabled:opacity-40 text-white text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                          >
                            <Plus className="w-4 h-4 text-blue-400" />
                            <span>Créer le chapitre</span>
                          </button>
                        </form>

                        {/* Liste des Chapitres */}
                        {data.subjectChapters.length === 0 && data.unassignedCourses.length === 0 ? (
                          <div className="py-8 text-center bg-background/50 rounded-2xl border border-dashed border-border text-xs text-zinc-500">
                            Aucun chapitre créé dans cette matière. Utilisez le champ ci-dessus pour créer le premier chapitre.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {data.subjectChapters.map((ch) => {
                              const chCourses = data.coursesByChapter[ch.title] || [];
                              const chapKey = `${subj.id}-${ch.id}`;
                              const isChapCollapsed = !!collapsedChapters[chapKey];

                              return (
                                <div
                                  key={ch.id}
                                  className="rounded-2xl bg-surface border border-border overflow-hidden shadow-xs"
                                >
                                  {/* Header du Chapitre */}
                                  <div className="p-4 sm:p-5 flex items-center justify-between bg-surface-elevated/40 hover:bg-surface-elevated transition-colors text-left select-none">
                                    <button
                                      onClick={() => toggleChapterCollapse(chapKey)}
                                      className="flex items-center gap-3 flex-1 text-left"
                                    >
                                      <span className="text-xl">📂</span>
                                      <div>
                                        <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                                          <span>{ch.title}</span>
                                          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-semibold">
                                            {chCourses.length} {chCourses.length > 1 ? 'cours' : 'cours'}
                                          </span>
                                        </h3>
                                      </div>
                                    </button>

                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => openModal('courseEditor', subj.id)}
                                        title="Ajouter une séance à ce chapitre"
                                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-semibold transition-colors flex items-center gap-1"
                                      >
                                        <Plus className="w-3.5 h-3.5 text-blue-400" />
                                        <span className="hidden sm:inline">+ Séance</span>
                                      </button>

                                      <button
                                        onClick={(e) => handleDeleteChapter(ch.id, ch.title, e)}
                                        title="Supprimer ce chapitre"
                                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        onClick={() => toggleChapterCollapse(chapKey)}
                                        className="p-1 text-zinc-400 hover:text-white"
                                      >
                                        {isChapCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                      </button>
                                    </div>
                                  </div>

                                  {/* ---------------- NIVEAU 3 : COURS RANGÉS PAR PHASE ---------------- */}
                                  {!isChapCollapsed && (
                                    <div className="p-4 sm:p-5 space-y-3 bg-surface/30 border-t border-border/60">
                                      {chCourses.length === 0 ? (
                                        <div className="py-6 text-center text-xs text-zinc-500 bg-background/50 rounded-xl border border-border-subtle">
                                          Aucune séance dans ce chapitre. Cliquez sur <strong>« + Séance »</strong> pour enregistrer la <strong>Phase 1</strong>.
                                        </div>
                                      ) : (
                                        chCourses.map((c) => (
                                          <div
                                            key={c.id}
                                            onClick={() => onOpenCourse?.(c.id)}
                                            className="p-4 rounded-xl bg-background border border-border hover:border-blue-500/50 hover:bg-surface-elevated/60 cursor-pointer transition-all flex items-center justify-between gap-4 group shadow-xs"
                                          >
                                            <div className="space-y-1.5 min-w-0 flex-1">
                                              <div className="flex items-center gap-2 text-xs text-zinc-400 flex-wrap">
                                                {/* Phase Badge */}
                                                <span className="px-2.5 py-0.5 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-[11px] shadow-xs">
                                                  Phase {c.courseNumber || 1}
                                                </span>
                                                <span className="flex items-center gap-1 text-zinc-400 text-[11px]">
                                                  <Calendar className="w-3 h-3 text-zinc-500" />
                                                  {formatDate(c.date)}
                                                </span>
                                                {c.partLabel && (
                                                  <span className="px-2 py-0.5 rounded bg-surface-muted text-zinc-400 text-[10px] font-medium">
                                                    {c.partLabel}
                                                  </span>
                                                )}
                                                {c.recallStatus === 'locked' ? (
                                                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20" title="Verrouillé jusqu'au premier rappel actif">
                                                    🔒 Rappel requis
                                                  </span>
                                                ) : (
                                                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                                                    ✓ Fiche prête
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

                            {/* Cours sans chapitre (tout en bas de la matière) */}
                            {data.unassignedCourses.length > 0 && (
                              <div className="mt-6 pt-4 border-t border-border/60 space-y-3">
                                <div className="flex items-center justify-between px-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">📄</span>
                                    <div>
                                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                                        Séances hors chapitre ({data.unassignedCourses.length})
                                      </h4>
                                      <p className="text-[11px] text-zinc-500">
                                        Cours non classés dans un chapitre précis.
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-2.5">
                                  {data.unassignedCourses.map((c) => (
                                    <div
                                      key={c.id}
                                      onClick={() => onOpenCourse?.(c.id)}
                                      className="p-3.5 rounded-xl bg-surface border border-border/80 hover:border-zinc-700 hover:bg-surface-elevated/60 cursor-pointer transition-all flex items-center justify-between gap-4 group"
                                    >
                                      <div className="space-y-1 min-w-0 flex-1">
                                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold text-[10px]">
                                            Phase {c.courseNumber || 1}
                                          </span>
                                          <span className="flex items-center gap-1 text-[11px]">
                                            <Calendar className="w-3 h-3 text-zinc-500" />
                                            {formatDate(c.date)}
                                          </span>
                                        </div>
                                        <h5 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                                          {c.title}
                                        </h5>
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
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
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
  );
};
