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

  // Form State
  const [isAddingExam, setIsAddingExam] = useState<boolean>(false);
  const [examKind, setExamKind] = useState<string>('partiel');
  const [examTitle, setExamTitle] = useState<string>('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [examDate, setExamDate] = useState<string>('');
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
        } else if (calData && Array.isArray(calData.days)) {
          const mapped: DaySchedule[] = calData.days.map((d: PlanningDay) => ({
            date: d.date,
            dayName: d.dayName || 'Jour',
            isToday: !!d.isToday,
            dueCount: d.cards?.length || d.items?.length || 0,
            estimatedMinutes: 20,
            items: d.items,
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
        dueCount: isToday ? 10 : Math.max(0, 12 - i * 2),
        estimatedMinutes: 20,
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

      {/* 4. CALENDRIER PRÉVISIONNEL (7 PROCHAINS JOURS) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Calendrier prévisionnel (7 prochains jours)</span>
          </h2>
          <span className="text-xs text-zinc-500">Montée en charge FSRS</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {scheduleDays.map((day, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col justify-between ${
                day.isToday
                  ? 'bg-purple-500/10 border-purple-500 shadow-md ring-1 ring-purple-500/20'
                  : 'bg-surface border-border'
              }`}
            >
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  {day.dayName}
                </div>
                <div className="text-xs font-bold text-white mt-0.5">{day.date.slice(8, 10)}/{day.date.slice(5, 7)}</div>

                {day.isToday && (
                  <span className="inline-block mt-1 px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[9px] font-bold font-mono">
                    Aujourd'hui
                  </span>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-border space-y-1">
                <div className="text-[11px] text-zinc-400">
                  Cartes : <strong className="text-white font-mono">{day.dueCount}</strong>
                </div>
                {day.exams && day.exams.length > 0 && (
                  <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
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
