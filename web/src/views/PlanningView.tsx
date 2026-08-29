import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Clock,
  TrendingUp,
  ChevronRight,
  Zap,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  Layers,
  Sparkles,
  BookOpen,
  Check,
} from 'lucide-react';
import {
  getSubjects,
  getExams,
  createExam,
  deleteExam,
  getRevisionCalendar,
  getChapterDefinitions,
  getStudyCourses,
} from '../lib/api';
import type { Subject, Exam, DaySchedule, ChapterDefinition, PlanningDay, Course } from '../lib/types';
import { formatDate } from '../lib/utils';

const EXAM_KINDS = [
  { id: 'partiel', label: '🎓 Partiel Universitaire' },
  { id: 'concours', label: '🏆 Concours' },
  { id: 'bac', label: '📝 Baccalauréat' },
  { id: 'ds', label: '🔬 DS / Épreuve Continue' },
  { id: 'oral', label: '🗣️ Grand Oral / Soutenance' },
];

interface PlanningViewProps {
  onStartSession?: (minutes: number, mode?: string, subjectId?: string) => void;
  onNavigate?: (view: string, payload?: any) => void;
  onOpenCourse?: (courseId: string) => void;
  onSelectSubject?: (subjectId: string) => void;
}

export const PlanningView: React.FC<PlanningViewProps> = ({
  onStartSession,
  onNavigate,
  onOpenCourse,
  onSelectSubject,
}) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [calendarDays, setCalendarDays] = useState<DaySchedule[]>([]);
  const [chapterDefs, setChapterDefs] = useState<ChapterDefinition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filtres d'horizon calendrier (7 jours, 15 jours, 1 mois, personnalisé)
  const [horizonFilter, setHorizonFilter] = useState<'7' | '15' | '30' | 'custom'>('7');
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 45);
    return d.toISOString().split('T')[0];
  });
  const [isFetchingCalendar, setIsFetchingCalendar] = useState<boolean>(false);

  // Form State
  const [isAddingExam, setIsAddingExam] = useState<boolean>(false);
  const [examKind, setExamKind] = useState<string>('partiel');
  const [examTitle, setExamTitle] = useState<string>('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [examDate, setExamDate] = useState<string>('');
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchCalendarForHorizon = async (filter: '7' | '15' | '30' | 'custom', customEnd?: string) => {
    setIsFetchingCalendar(true);
    try {
      let daysCount = 7;
      if (filter === '15') daysCount = 15;
      else if (filter === '30') daysCount = 30;
      else if (filter === 'custom') {
        const targetDateStr = customEnd || customEndDate;
        const now = new Date();
        const target = new Date(targetDateStr);
        const diffTime = target.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        daysCount = Math.max(1, Math.min(365, diffDays || 45));
      }

      const calData = await getRevisionCalendar({ days: daysCount });
      if (Array.isArray(calData)) {
        setCalendarDays(calData);
      } else if (calData && (Array.isArray(calData.calendar) || Array.isArray(calData.days))) {
        const list = calData.calendar || calData.days;
        const mapped: DaySchedule[] = list.map((d: any) => ({
          date: d.date,
          dayName: d.dayName || 'Jour',
          isToday: !!d.isToday,
          dueCount: Array.isArray(d.cards) ? d.cards.length : Array.isArray(d.items) ? d.items.length : Number(d.dueCount || 0),
          estimatedMinutes: 20,
          items: d.items || [],
        }));
        setCalendarDays(mapped);
      }
    } catch (err) {
      console.error('Error fetching calendar for horizon:', err);
    } finally {
      setIsFetchingCalendar(false);
    }
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [subList, courseList, examList, calData, chapList] = await Promise.all([
          getSubjects(),
          getStudyCourses(),
          getExams(),
          getRevisionCalendar({ days: 7 }),
          getChapterDefinitions(),
        ]);
        setSubjects(subList || []);
        setCourses(courseList || []);
        setExams(examList || []);
        setChapterDefs(chapList || []);

        if (Array.isArray(calData)) {
          setCalendarDays(calData);
        } else if (calData && (Array.isArray(calData.calendar) || Array.isArray(calData.days))) {
          const list = calData.calendar || calData.days;
          const mapped: DaySchedule[] = list.map((d: any) => ({
            date: d.date,
            dayName: d.dayName || 'Jour',
            isToday: !!d.isToday,
            dueCount: Array.isArray(d.cards) ? d.cards.length : Array.isArray(d.items) ? d.items.length : Number(d.dueCount || 0),
            estimatedMinutes: 20,
            items: d.items || [],
          }));
          setCalendarDays(mapped);
        }

        if (subList && subList.length > 0) {
          setSelectedSubjectIds([subList[0].id]);
        }
      } catch (err) {
        console.error('Error loading planning view:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Chapitres disponibles pour toutes les matières cochées
  const availableChapters = useMemo(() => {
    return chapterDefs.filter((ch) => selectedSubjectIds.includes(ch.subjectId));
  }, [chapterDefs, selectedSubjectIds]);

  // Basculer une matière dans le formulaire
  const toggleSubject = (subId: string) => {
    setSelectedSubjectIds((prev) => {
      const isSelected = prev.includes(subId);
      if (isSelected) {
        if (prev.length === 1) return prev; // Au moins une matière
        const next = prev.filter((id) => id !== subId);
        // Nettoyer les chapitres orphelins
        setSelectedChapterIds((prevCh) => {
          const subChaps = chapterDefs.filter((ch) => ch.subjectId === subId).map((ch) => ch.id);
          return prevCh.filter((id) => !subChaps.includes(id));
        });
        return next;
      } else {
        const next = [...prev, subId];
        // Auto-sélectionner les chapitres de la matière ajoutée
        const subChaps = chapterDefs.filter((ch) => ch.subjectId === subId).map((ch) => ch.id);
        setSelectedChapterIds((prevCh) => [...prevCh, ...subChaps]);
        return next;
      }
    });
  };

  // Tout sélectionner / Tout désélectionner les chapitres
  const toggleAllChapters = () => {
    const allIds = availableChapters.map((ch) => ch.id);
    if (selectedChapterIds.length === allIds.length) {
      setSelectedChapterIds([]);
    } else {
      setSelectedChapterIds(allIds);
    }
  };

  const toggleChapter = (chapId: string) => {
    setSelectedChapterIds((prev) =>
      prev.includes(chapId) ? prev.filter((id) => id !== chapId) : [...prev, chapId]
    );
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examDate || selectedSubjectIds.length === 0) return;

    setIsSubmitting(true);
    try {
      const primarySub = subjects.find((s) => s.id === selectedSubjectIds[0]);
      const defaultTitle = selectedSubjectIds.length > 1
        ? `Épreuve Multi-Matières (${selectedSubjectIds.length} matières)`
        : `Épreuve ${primarySub?.title || ''}`;

      const created = await createExam({
        title: examTitle.trim() || defaultTitle,
        date: examDate,
        subjectId: selectedSubjectIds[0],
        subjectTitle: primarySub?.title || '',
        chapterIds: selectedChapterIds,
        minutesPerDay: 20,
      });

      if (created) {
        setExams((prev) => [...prev, created]);
        setIsAddingExam(false);
        setExamTitle('');
        setSelectedChapterIds([]);
      }
    } catch (err) {
      console.error('Error creating exam:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (!window.confirm('Supprimer cette épreuve du planning ?')) return;
    try {
      const ok = await deleteExam(id);
      if (ok) {
        setExams((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (err) {
      console.error('Error deleting exam:', err);
    }
  };

  // Calendrier des 7 prochains jours
  const scheduleDays = useMemo(() => {
    if (calendarDays && calendarDays.length > 0) {
      return calendarDays;
    }
    const days: DaySchedule[] = [];
    const now = new Date();
    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const isToday = i === 0;
      const dayExams = exams.filter((e) => e.date === dateStr);

      days.push({
        date: dateStr,
        dayName: dayNames[d.getDay()],
        isToday,
        dueCount: 0,
        estimatedMinutes: 0,
        exams: dayExams,
        items: [],
      });
    }
    return days;
  }, [calendarDays, exams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-16 space-y-8 animate-fadeIn">
      {/* 1. Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <CalendarIcon className="w-6 h-6 text-purple-400" />
            <span>Planificateur d'Échéances & Rétro-Planning</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Anticipe sereinement tes partiels, concours, bac et contrôles continus avec l'algorithme de montée en charge.
          </p>
        </div>

        <button
          onClick={() => {
            setIsAddingExam(!isAddingExam);
            if (!isAddingExam && availableChapters.length > 0) {
              setSelectedChapterIds(availableChapters.map((ch) => ch.id));
            }
          }}
          className="px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{isAddingExam ? 'Fermer le formulaire' : '+ Programmer une épreuve'}</span>
        </button>
      </div>

      {/* 2. Formulaire Dynamique d'Ajout d'Épreuve */}
      {isAddingExam && (
        <form
          onSubmit={handleCreateExam}
          className="p-6 rounded-3xl bg-surface border border-purple-500/30 shadow-2xl space-y-5 animate-fadeIn"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Programmer une nouvelle échéance</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsAddingExam(false)}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Annuler
            </button>
          </div>

          {/* Type d'épreuve (Pilules cliquables) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300">Type d'épreuve :</label>
            <div className="flex items-center gap-2 flex-wrap">
              {EXAM_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setExamKind(k.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    examKind === k.id
                      ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                      : 'bg-surface-elevated border-border text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          {/* Titre & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Titre de l'épreuve :</label>
              <input
                type="text"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                placeholder="Ex: Partiel Biologie Cellulaire S1, Écrit Bac Physique..."
                className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Date du partiel / examen :</label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                required
                className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Matières au programme (Multi-sélection avec Priorités ECTS) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span>Matière(s) au programme :</span>
              <span className="text-[11px] text-zinc-400 font-normal">
                {selectedSubjectIds.length} matière{selectedSubjectIds.length > 1 ? 's' : ''} sélectionnée{selectedSubjectIds.length > 1 ? 's' : ''}
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1">
              {subjects.map((sub) => {
                const isChecked = selectedSubjectIds.includes(sub.id);
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => toggleSubject(sub.id)}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 ${
                      isChecked
                        ? 'bg-purple-500/15 border-purple-500 text-white'
                        : 'bg-surface-elevated border-border text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{sub.title}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {sub.ects} ECTS • Coeff {sub.priority || 'A'}
                      </div>
                    </div>
                    {isChecked ? (
                      <Check className="w-4 h-4 text-purple-400 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-zinc-700 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chapitres au programme */}
          {availableChapters.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300">
                  Chapitres spécifiques au programme ({selectedChapterIds.length}/{availableChapters.length}) :
                </label>
                <button
                  type="button"
                  onClick={toggleAllChapters}
                  className="text-xs font-bold text-purple-400 hover:text-purple-300"
                >
                  {selectedChapterIds.length === availableChapters.length ? 'Tout décocher' : '⚡ Tout sélectionner'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1">
                {availableChapters.map((ch) => {
                  const isChecked = selectedChapterIds.includes(ch.id);
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => toggleChapter(ch.id)}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between gap-2 ${
                        isChecked
                          ? 'bg-purple-500/15 border-purple-500 text-white'
                          : 'bg-surface-elevated border-border text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <span className="truncate">{ch.title}</span>
                      {isChecked && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setIsAddingExam(false)}
              className="px-4 py-2.5 rounded-xl bg-surface-elevated text-xs font-bold text-zinc-300 hover:text-white"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !examDate || selectedSubjectIds.length === 0}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all"
            >
              {isSubmitting ? 'Calcul du planning...' : '🚀 Enregistrer l\'épreuve'}
            </button>
          </div>
        </form>
      )}

      {/* 3. ÉCHÉANCES & ÉPREUVES EN COURS (AVEC RÉTRO-PLANNING CONNECTÉ) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <span>Échéances & Épreuves en cours</span>
            <span className="px-2 py-0.5 rounded-full bg-surface-elevated text-zinc-400 font-mono text-xs font-bold">
              {exams.length}
            </span>
          </h2>
        </div>

        {exams.length === 0 ? (
          <div className="p-10 text-center bg-surface rounded-3xl border border-border space-y-3">
            <CalendarIcon className="w-10 h-10 text-purple-400 mx-auto opacity-80" />
            <h3 className="text-base font-bold text-white">Aucune épreuve programmée</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
              Ajoute la date de tes partiels, concours ou bac. Le système calcule automatiquement la montée en charge jusqu'au jour J.
            </p>
            <button
              onClick={() => setIsAddingExam(true)}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition-all inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Programmer ma première épreuve</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exams.map((exam) => {
              const daysLeft = Math.max(
                0,
                Math.ceil(
                  (new Date(exam.date).getTime() - new Date().setHours(0, 0, 0, 0)) /
                    (1000 * 60 * 60 * 24)
                )
              );

              return (
                <div
                  key={exam.id}
                  className="p-5 rounded-3xl bg-surface border border-border hover:border-purple-500/40 transition-all space-y-4 shadow-lg group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold text-[10px] border border-purple-500/30">
                          {exam.subjectTitle || 'Matière'}
                        </span>
                        <span className="text-[11px] text-zinc-400 font-mono">📅 {formatDate(exam.date)}</span>
                      </div>
                      <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">
                        {exam.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className={`text-sm font-black font-mono ${daysLeft <= 3 ? 'text-rose-400' : 'text-purple-400'}`}>
                          {daysLeft === 0 ? 'Aujourd\'hui !' : `J-${daysLeft}`}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {daysLeft === 0 ? 'Jour J' : `${daysLeft} jour${daysLeft > 1 ? 's' : ''}`}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteExam(exam.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-500 hover:text-rose-400 transition-colors"
                        title="Supprimer cette épreuve"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Actions & Rétro-Planning */}
                  <div className="flex items-center justify-between pt-3 border-t border-border text-xs">
                    <span className="text-zinc-400 text-[11px]">
                      {exam.chapterIds?.length
                        ? `${exam.chapterIds.length} chapitre${exam.chapterIds.length > 1 ? 's' : ''} au programme`
                        : 'Tous les chapitres'}
                    </span>

                    <button
                      onClick={() => onStartSession?.(0, 'standard', exam.subjectId || undefined)}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <Zap className="w-3.5 h-3.5 fill-white" />
                      <span>Réviser cette épreuve</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. CALENDRIER PRÉVISIONNEL & FILTRES D'HORIZON */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Calendrier prévisionnel ({scheduleDays.length} jours)</span>
              {isFetchingCalendar && (
                <div className="animate-spin w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full ml-1" />
              )}
            </h2>
            <p className="text-[11px] text-zinc-500">
              Simulation algorithmique de la charge de travail FSRS-5 jour par jour.
            </p>
          </div>

          {/* PILULES DE FILTRES D'HORIZON (7J, 15J, 1 MOIS, DATE PERSONNALISÉE) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => {
                setHorizonFilter('7');
                fetchCalendarForHorizon('7');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                horizonFilter === '7'
                  ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                  : 'bg-surface-elevated border-border-subtle text-zinc-400 hover:text-white'
              }`}
            >
              7 jours
            </button>

            <button
              onClick={() => {
                setHorizonFilter('15');
                fetchCalendarForHorizon('15');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                horizonFilter === '15'
                  ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                  : 'bg-surface-elevated border-border-subtle text-zinc-400 hover:text-white'
              }`}
            >
              15 jours
            </button>

            <button
              onClick={() => {
                setHorizonFilter('30');
                fetchCalendarForHorizon('30');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                horizonFilter === '30'
                  ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                  : 'bg-surface-elevated border-border-subtle text-zinc-400 hover:text-white'
              }`}
            >
              1 mois
            </button>

            <button
              onClick={() => {
                setHorizonFilter('custom');
                fetchCalendarForHorizon('custom');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                horizonFilter === 'custom'
                  ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                  : 'bg-surface-elevated border-border-subtle text-zinc-400 hover:text-white'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Date personnalisée</span>
            </button>
          </div>
        </div>

        {/* DATE PICKER LORSQUE LE FILTRE PERSONNALISÉ EST ACTIF */}
        {horizonFilter === 'custom' && (
          <div className="p-3.5 rounded-2xl bg-surface-elevated border border-purple-500/30 flex items-center justify-between gap-4 flex-wrap animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-300">📅 Projeter jusqu'au :</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  if (e.target.value) {
                    fetchCalendarForHorizon('custom', e.target.value);
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-background border border-border text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
            <span className="text-xs font-medium text-purple-300">
              🎯 Projection calculée sur <strong>{scheduleDays.length} jours</strong> jusqu'au {customEndDate.slice(8, 10)}/{customEndDate.slice(5, 7)}/{customEndDate.slice(0, 4)}
            </span>
          </div>
        )}

        {/* GRILLE ADAPTATIVE DE JOURS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2.5">
          {scheduleDays.map((day, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-2xl border text-center transition-all flex flex-col justify-between ${
                day.isToday
                  ? 'bg-purple-500/15 border-purple-500 shadow-md ring-1 ring-purple-500/30'
                  : 'bg-surface border-border hover:border-zinc-700'
              }`}
            >
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  {day.dayName}
                </div>
                <div className="text-xs font-bold text-white mt-0.5">{day.date.slice(8, 10)}/{day.date.slice(5, 7)}</div>

                {day.isToday && (
                  <span className="inline-block mt-1 px-1.5 py-0.2 rounded bg-purple-500/25 text-purple-300 text-[9px] font-black font-mono">
                    Aujourd'hui
                  </span>
                )}
              </div>

              <div className="mt-2.5 pt-2 border-t border-border/60 space-y-1">
                <div className="text-[11px] text-zinc-300">
                  Cartes : <strong className="text-white font-mono">{day.dueCount}</strong>
                </div>
                {day.exams && day.exams.length > 0 && (
                  <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 truncate max-w-full">
                    🎯 Épreuve !
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
