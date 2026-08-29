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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});
  const [newChapterTitle, setNewChapterTitle] = useState<string>('');
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

      // Auto select first subject if none selected
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

  // Filtered subjects by search
  const filteredSubjects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return subjects;
    return subjects.filter((s) => s.title.toLowerCase().includes(q));
  }, [subjects, searchQuery]);

  // Active selected subject
  const activeSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId) || filteredSubjects[0] || subjects[0];
  }, [subjects, selectedSubjectId, filteredSubjects]);

  // Courses and chapters for the active subject
  const activeSubjectCourses = useMemo(() => {
    if (!activeSubject) return [];
    return courses.filter((c) => c.subjectId === activeSubject.id);
  }, [courses, activeSubject]);

  const activeSubjectChapters = useMemo(() => {
    if (!activeSubject) return [];
    return chapterDefs.filter((ch) => ch.subjectId === activeSubject.id);
  }, [chapterDefs, activeSubject]);

  // Group courses by chapter for the active subject
  const { coursesByChapter, unassignedCourses } = useMemo(() => {
    const map: Record<string, Course[]> = {};
    const unassigned: Course[] = [];

    activeSubjectChapters.forEach((ch) => {
      map[ch.title] = [];
    });

    activeSubjectCourses.forEach((c) => {
      const chName = c.chapter?.trim();
      if (chName) {
        if (!map[chName]) map[chName] = [];
        map[chName].push(c);
      } else {
        unassigned.push(c);
      }
    });

    // Sort by courseNumber (Phase)
    Object.keys(map).forEach((chName) => {
      map[chName].sort((a, b) => (a.courseNumber || 1) - (b.courseNumber || 1));
    });
    unassigned.sort((a, b) => (a.courseNumber || 1) - (b.courseNumber || 1));

    return { coursesByChapter: map, unassignedCourses: unassigned };
  }, [activeSubjectCourses, activeSubjectChapters]);

  const toggleChapterCollapse = (chapId: string) => {
    setCollapsedChapters((prev) => ({
      ...prev,
      [chapId]: !prev[chapId],
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

  const handleDeleteSubject = async (subjectId: string, subjectTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `⚠️ Voulez-vous vraiment supprimer définitivement la matière "${subjectTitle}" ?\n\nCette action effacera également tous ses chapitres et cours associés.`
    );
    if (!confirmed) return;

    const ok = await deleteSubject(subjectId);
    if (ok) {
      const remaining = subjects.filter((s) => s.id !== subjectId);
      setSubjects(remaining);
      if (remaining.length > 0) {
        setSelectedSubjectId(remaining[0].id);
      } else {
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

  if (subjects.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center p-8 sm:p-12 rounded-3xl bg-surface border border-border shadow-xl space-y-6 animate-fadeIn my-6">
        <div className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto">
          <BookOpen className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Bienvenue dans votre classeur !
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
            Créez votre première matière pour y ranger vos chapitres et enregistrer vos cours par phase d'apprentissage.
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={() => openModal('subjectEditor')}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-xl shadow-blue-500/20 hover:scale-105 transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>+ Créer ma première matière</span>
          </button>
        </div>

        <div className="pt-6 border-t border-border/80 text-left grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-zinc-400">
          <div className="p-3.5 rounded-xl bg-surface-elevated/40 border border-border space-y-1">
            <span className="font-bold text-white block">1. Matière</span>
            <span>Définissez la matière (ex: Droit, Mathématiques, Anatomie...)</span>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-elevated/40 border border-border space-y-1">
            <span className="font-bold text-white block">2. Chapitres</span>
            <span>Créez les grands thèmes au sein de votre matière.</span>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-elevated/40 border border-border space-y-1">
            <span className="font-bold text-white block">3. Séances par Phase</span>
            <span>Enregistrez vos cours (Phase 1, Phase 2...) avec l'IA.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* 1. EN-TÊTE PRINCIPAL SIMPLE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-surface border border-border shadow-md">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-400" />
            <span>Mes Matières ({subjects.length})</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Sélectionnez une matière pour voir ses chapitres et ses cours rangés par phase.
          </p>
        </div>

        <button
          onClick={() => openModal('subjectEditor')}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Nouvelle matière</span>
        </button>
      </div>

      {/* 2. DISPOSITION 2 COLONNES (MATIÈRES À GAUCHE ➔ CHAPITRES & COURS À DROITE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLONNE GAUCHE : LISTE DES MATIÈRES */}
        <div className="lg:col-span-4 bg-surface rounded-3xl border border-border p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Toutes les matières
            </h2>
            <button
              onClick={() => openModal('subjectEditor')}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter</span>
            </button>
          </div>

          {/* Recherche */}
          <input
            type="text"
            placeholder="Rechercher une matière..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
          />

          {/* Liste des matières cliquables */}
          <div className="space-y-1.5 max-h-[calc(100vh-20rem)] overflow-y-auto pr-1">
            {filteredSubjects.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                Aucune matière trouvée.
              </div>
            ) : (
              filteredSubjects.map((subj) => {
                const isSelected = activeSubject?.id === subj.id;
                const subjCoursesCount = courses.filter((c) => c.subjectId === subj.id).length;
                const subjChaptersCount = chapterDefs.filter((ch) => ch.subjectId === subj.id).length;

                return (
                  <div
                    key={subj.id}
                    onClick={() => setSelectedSubjectId(subj.id)}
                    className={`w-full p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-3 group border select-none ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500/40 text-white shadow-xs'
                        : 'bg-surface-elevated/40 border-transparent hover:border-zinc-700 hover:bg-surface-elevated text-zinc-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className={`text-xs sm:text-sm font-bold truncate ${isSelected ? 'text-blue-400' : 'text-zinc-200 group-hover:text-white'}`}>
                        {subj.title}
                      </h3>
                      <p className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-2">
                        <span>{subjChaptersCount} chapitres</span>
                        <span>•</span>
                        <span>{subjCoursesCount} cours</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleDeleteSubject(subj.id, subj.title, e)}
                        title="Supprimer cette matière"
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-blue-400 translate-x-0.5' : 'text-zinc-600'}`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLONNE DROITE : CHAPITRES & COURS PAR PHASE DE LA MATIÈRE SÉLECTIONNÉE */}
        <div className="lg:col-span-8 space-y-6">
          {!activeSubject ? (
            <div className="p-16 text-center bg-surface rounded-3xl border border-border space-y-3">
              <BookOpen className="w-8 h-8 text-zinc-500 mx-auto" />
              <h3 className="text-sm font-bold text-white">Aucune matière sélectionnée</h3>
              <p className="text-xs text-zinc-400">Cliquez sur une matière à gauche ou créez-en une nouvelle.</p>
            </div>
          ) : (
            <>
              {/* EN-TÊTE DE LA MATIÈRE SÉLECTIONNÉE */}
              <div className="p-6 rounded-3xl bg-surface border border-border shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-xl sm:text-2xl font-black text-white">
                      {activeSubject.title}
                    </h2>
                    <p className="text-xs text-zinc-400 flex items-center gap-2 flex-wrap">
                      <span>📂 <strong>{activeSubjectChapters.length}</strong> {activeSubjectChapters.length > 1 ? 'chapitres' : 'chapitre'}</span>
                      <span>•</span>
                      <span>📚 <strong>{activeSubjectCourses.length}</strong> {activeSubjectCourses.length > 1 ? 'cours' : 'cours'}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      onClick={() => onAddCourse ? onAddCourse(activeSubject.id) : openModal('courseEditor', activeSubject.id)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Nouveau cours</span>
                    </button>

                    {activeSubjectCourses.some((c) => c.cards && c.cards.length > 0) && (
                      <button
                        onClick={() => onStartSession?.(0, 'standard', activeSubject.id)}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5 fill-white" />
                        <span>S'entraîner</span>
                      </button>
                    )}

                    <button
                      onClick={(e) => handleDeleteSubject(activeSubject.id, activeSubject.title, e)}
                      title="Supprimer cette matière"
                      className="p-2 rounded-xl bg-surface-elevated hover:bg-red-500/20 text-zinc-500 hover:text-red-400 border border-border text-xs transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* FORMULAIRE RAPIDE D'AJOUT DE CHAPITRE */}
                <form
                  onSubmit={handleCreateChapter}
                  className="pt-4 border-t border-border/80 flex items-center gap-2.5"
                >
                  <div className="text-zinc-400 text-base pl-1">📂</div>
                  <input
                    type="text"
                    value={newChapterTitle}
                    onChange={(e) => setNewChapterTitle(e.target.value)}
                    placeholder="Nom du nouveau chapitre (ex: Chapitre 1 : Espaces Vectoriels)..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!newChapterTitle.trim()}
                    className="px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface-muted border border-border hover:border-zinc-600 disabled:opacity-40 text-white text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-400" />
                    <span>Créer le chapitre</span>
                  </button>
                </form>
              </div>

              {/* LISTE DES CHAPITRES & COURS RANGÉS PAR PHASE */}
              <div className="space-y-4">
                {activeSubjectChapters.length === 0 && unassignedCourses.length === 0 ? (
                  <div className="p-12 text-center bg-surface rounded-3xl border border-dashed border-border space-y-3">
                    <FolderTree className="w-8 h-8 text-zinc-500 mx-auto" />
                    <h3 className="text-sm font-bold text-white">Aucun chapitre créé</h3>
                    <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                      Créez votre premier chapitre ci-dessus pour y ranger vos cours par phase (Phase 1, Phase 2...).
                    </p>
                  </div>
                ) : (
                  <>
                    {/* 1. LES CHAPITRES */}
                    {activeSubjectChapters.map((ch) => {
                      const chCourses = coursesByChapter[ch.title] || [];
                      const isCollapsed = !!collapsedChapters[ch.id];

                      return (
                        <div
                          key={ch.id}
                          className="rounded-3xl bg-surface border border-border overflow-hidden shadow-sm transition-all"
                        >
                          {/* Header du Chapitre */}
                          <div className="p-4 sm:p-5 flex items-center justify-between bg-surface-elevated/40 hover:bg-surface-elevated transition-colors text-left select-none">
                            <button
                              onClick={() => toggleChapterCollapse(ch.id)}
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
                                onClick={() => openModal('courseEditor', activeSubject.id)}
                                title="Ajouter une séance à ce chapitre"
                                className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 text-xs font-semibold transition-colors flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5 text-blue-400" />
                                <span>+ Séance</span>
                              </button>

                              <button
                                onClick={(e) => handleDeleteChapter(ch.id, ch.title, e)}
                                title="Supprimer ce chapitre"
                                className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => toggleChapterCollapse(ch.id)}
                                className="p-1 text-zinc-400 hover:text-white"
                              >
                                {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                              </button>
                            </div>
                          </div>

                          {/* COURS RANGÉS PAR PHASE DANS LE CHAPITRE */}
                          {!isCollapsed && (
                            <div className="p-4 sm:p-5 space-y-3 bg-surface/30 border-t border-border/60">
                              {chCourses.length === 0 ? (
                                <div className="py-6 text-center text-xs text-zinc-500 bg-background/50 rounded-2xl border border-dashed border-border">
                                  Aucun cours dans ce chapitre pour le moment. Cliquez sur <strong>« + Séance »</strong> pour enregistrer la <strong>Phase 1</strong>.
                                </div>
                              ) : (
                                chCourses.map((c) => (
                                  <div
                                    key={c.id}
                                    onClick={() => onOpenCourse?.(c.id)}
                                    className="p-4 rounded-2xl bg-background border border-border hover:border-blue-500/50 hover:bg-surface-elevated/60 cursor-pointer transition-all flex items-center justify-between gap-4 group shadow-xs"
                                  >
                                    <div className="space-y-1.5 min-w-0 flex-1">
                                      <div className="flex items-center gap-2 text-xs text-zinc-400 flex-wrap">
                                        {/* Badge Phase */}
                                        <span className="px-2.5 py-0.5 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-[11px] shadow-xs">
                                          Phase {c.courseNumber || 1}
                                        </span>
                                        <span className="flex items-center gap-1 text-zinc-400 text-[11px]">
                                          <Calendar className="w-3 h-3 text-zinc-500" />
                                          {formatDate(c.date)}
                                        </span>
                                        {c.recallStatus === 'locked' ? (
                                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">
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

                    {/* 2. SÉANCES SANS CHAPITRE (TOUT EN BAS) */}
                    {unassignedCourses.length > 0 && (
                      <div className="mt-6 pt-4 border-t border-border/80 space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base">📄</span>
                            <div>
                              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                                Séances hors chapitre ({unassignedCourses.length})
                              </h3>
                              <p className="text-[11px] text-zinc-500">
                                Cours non encore classés dans un chapitre précis.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          {unassignedCourses.map((c) => (
                            <div
                              key={c.id}
                              onClick={() => onOpenCourse?.(c.id)}
                              className="p-3.5 rounded-2xl bg-surface border border-border/80 hover:border-zinc-700 hover:bg-surface-elevated/60 cursor-pointer transition-all flex items-center justify-between gap-4 group"
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
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
