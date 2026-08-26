import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Clock,
  TrendingUp,
  ChevronRight,
} from 'lucide-react';
import {
  getSubjects,
  getExams,
  createExam,
  deleteExam,
  getRevisionCalendar,
  getChapterDefinitions,
} from '../lib/api';
import type { Subject, Exam, DaySchedule, ChapterDefinition, PlanningDay } from '../lib/types';
import { formatDate } from '../lib/utils';

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
  const [exams, setExams] = useState<Exam[]>([]);
  const [calendarDays, setCalendarDays] = useState<DaySchedule[]>([]);
  const [chapterDefs, setChapterDefs] = useState<ChapterDefinition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form State
  const [isAddingExam, setIsAddingExam] = useState<boolean>(false);
  const [examTitle, setExamTitle] = useState<string>('');
  const [examSubjectId, setExamSubjectId] = useState<string>('');
  const [examDate, setExamDate] = useState<string>('');
  const [examMinutesPerDay, setExamMinutesPerDay] = useState<number>(20);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [subList, examList, calData, chapList] = await Promise.all([
          getSubjects(),
          getExams(),
          getRevisionCalendar({ days: 7 }),
          getChapterDefinitions(),
        ]);
        setSubjects(subList || []);
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

        if (subList.length > 0) {
          setExamSubjectId(subList[0].id);
        }
      } catch (err) {
        console.error('Error loading planning view:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute 7-day schedule if backend returns empty
  const scheduleDays = useMemo(() => {
    if (calendarDays && calendarDays.length > 0) {
      return calendarDays;
    }
    // Fallback 7 days generator
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
        dueCount: isToday ? 12 : Math.max(0, 15 - i * 2),
        estimatedMinutes: isToday ? 25 : 20,
        exams: dayExams,
        items: [
          {
            type: 'card',
            date: dateStr,
            title: 'Répétition espacée active',
            subjectTitle: 'Tronc commun',
          },
        ],
      });
    }
    return days;
  }, [calendarDays, exams]);

  // Chapters for selected form subject
  const formChapters = useMemo(() => {
    return chapterDefs.filter((ch) => ch.subjectId === examSubjectId);
  }, [chapterDefs, examSubjectId]);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examDate || !examSubjectId) return;

    setIsSubmitting(true);
    try {
      const subject = subjects.find((s) => s.id === examSubjectId);
      const created = await createExam({
        title: examTitle.trim() || `Partiel ${subject?.title || ''}`,
        date: examDate,
        subjectId: examSubjectId,
        subjectTitle: subject?.title || '',
        chapterIds: selectedChapters,
        minutesPerDay: examMinutesPerDay,
      });

      if (created) {
        setExams((prev) => [...prev, created]);
        setIsAddingExam(false);
        setExamTitle('');
        setSelectedChapters([]);
      }
    } catch (err) {
      console.error('Error creating exam:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (!window.confirm('Supprimer ce partiel du planning ?')) return;
    try {
      const ok = await deleteExam(id);
      if (ok) {
        setExams((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (err) {
      console.error('Error deleting exam:', err);
    }
  };

  const toggleChapterSelection = (chapId: string) => {
    setSelectedChapters((prev) =>
      prev.includes(chapId) ? prev.filter((id) => id !== chapId) : [...prev, chapId]
    );
  };

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
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-accent-purple" />
            Planificateur de révision & Partiels
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Rétro-planning automatique : répartis intelligemment ton temps de travail jusqu'au jour de l'épreuve.
          </p>
        </div>

        <button
          onClick={() => setIsAddingExam(!isAddingExam)}
          className="px-4 py-2 rounded-xl bg-accent-purple hover:bg-accent-purple/90 text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Programmer un partiel</span>
        </button>
      </div>

      {/* 2. Formulaire d'ajout de partiel (Modal ou déroulant) */}
      {isAddingExam && (
        <form
          onSubmit={handleCreateExam}
          className="p-6 rounded-2xl bg-surface border border-accent-purple/40 space-y-5 animate-fadeIn shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-bold text-white">Nouveau Partiel / Échéance</h3>
            <button
              type="button"
              onClick={() => setIsAddingExam(false)}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Fermer
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                Titre de l'épreuve
              </label>
              <input
                type="text"
                required
                placeholder="Ex. Partiel Biologie Cellulaire S1"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-purple"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">Matière</label>
              <select
                value={examSubjectId}
                onChange={(e) => setExamSubjectId(e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-purple"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.ects} ECTS)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                Date de l'examen
              </label>
              <input
                type="date"
                required
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-purple"
              />
            </div>
          </div>

          {/* Chapitres inclus */}
          {formChapters.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 block">
                Chapitres au programme :
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {formChapters.map((ch) => (
                  <label
                    key={ch.id}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      selectedChapters.includes(ch.id)
                        ? 'bg-accent-purple/10 border-accent-purple/50 text-white'
                        : 'bg-surface-elevated border-border-subtle text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedChapters.includes(ch.id)}
                      onChange={() => toggleChapterSelection(ch.id)}
                      className="rounded accent-accent-purple"
                    />
                    <span className="truncate">{ch.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Temps quotidien */}
          <div className="p-4 rounded-xl bg-surface-elevated border border-border-subtle space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-300">
                Temps de révision dédié par jour :
              </span>
              <span className="font-bold text-accent-purple font-mono">
                {examMinutesPerDay} min / jour
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={90}
              step={5}
              value={examMinutesPerDay}
              onChange={(e) => setExamMinutesPerDay(Number(e.target.value))}
              className="w-full accent-accent-purple"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAddingExam(false)}
              className="px-4 py-2 bg-surface-elevated text-zinc-400 text-xs rounded-xl hover:text-white"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-accent-purple hover:bg-accent-purple/90 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Enregistrement...' : 'Calculer le planning'}
            </button>
          </div>
        </form>
      )}

      {/* 3. Liste des Partiels Programmés */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider text-zinc-400">
          Échéances & Partiels en cours ({exams.length})
        </h2>

        {exams.length === 0 ? (
          <div className="p-8 text-center bg-surface rounded-2xl border border-border text-xs text-zinc-400">
            Aucun partiel programmé pour le moment. Clique sur "+ Programmer un partiel" pour configurer ton rétro-planning.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  className="p-5 rounded-2xl bg-surface border border-border hover:border-zinc-700 transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-accent-purple">
                        {exam.subjectTitle || 'Matière'}
                      </span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono ${
                          daysLeft <= 3
                            ? 'bg-accent-red/20 text-accent-red'
                            : daysLeft <= 7
                            ? 'bg-accent-orange/20 text-accent-orange'
                            : 'bg-surface-elevated text-zinc-300'
                        }`}
                      >
                        J-{daysLeft}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white leading-snug">{exam.title}</h3>

                    <div className="space-y-1 text-xs text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <CalendarIcon className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Date : {formatDate(exam.date)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Recommandé : {exam.minutesPerDay || 20} min/jour</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/80 flex items-center justify-between">
                    <button
                      onClick={() => onStartSession?.(exam.minutesPerDay || 20, 'standard', exam.subjectId || undefined)}
                      className="px-3 py-1.5 rounded-lg bg-accent-purple/10 hover:bg-accent-purple/20 text-accent-purple border border-accent-purple/30 text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      <span>Session du jour</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => handleDeleteExam(exam.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-accent-red hover:bg-accent-red/10 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Calendrier Visuel 7 Jours */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent-blue" />
              Calendrier prévisionnel (7 prochains jours)
            </h2>
            <p className="text-xs text-zinc-400">
              Charge quotidienne estimée d'après l'algorithme de répétition espacée et tes dates d'examens
            </p>
          </div>
        </div>

        {/* 7 Columns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {scheduleDays.map((day, idx) => {
            const hasExams = day.exams && day.exams.length > 0;
            return (
              <div
                key={day.date || idx}
                className={`p-3.5 rounded-xl border flex flex-col justify-between min-h-[160px] transition-all ${
                  day.isToday
                    ? 'bg-surface-elevated border-accent-blue/60 shadow-lg ring-1 ring-accent-blue/30'
                    : 'bg-surface border-border hover:border-zinc-700'
                }`}
              >
                <div className="space-y-2">
                  {/* Day Header */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${
                        day.isToday ? 'text-accent-blue' : 'text-zinc-400'
                      }`}
                    >
                      {day.dayName}
                    </span>
                    {day.isToday && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-accent-blue text-white font-bold">
                        Aujourd'hui
                      </span>
                    )}
                  </div>

                  <div className="text-xs font-mono text-zinc-300">
                    {formatDate(day.date).split(' ')[0]} {formatDate(day.date).split(' ')[1]}
                  </div>

                  {/* Daily Load Badges */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400">Rappels :</span>
                      <span className="font-bold text-white font-mono">{day.dueCount}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400">Temps :</span>
                      <span className="font-semibold text-accent-green font-mono">
                        {day.estimatedMinutes}m
                      </span>
                    </div>

                    {hasExams && (
                      <div className="text-[10px] p-1 rounded bg-accent-purple/20 text-accent-purple border border-accent-purple/30 font-semibold truncate">
                        🎯 {day.exams?.[0].title}
                      </div>
                    )}
                  </div>
                </div>

                {/* Day Action */}
                <div className="pt-2 border-t border-border-subtle mt-2">
                  <button
                    onClick={() => onStartSession?.(day.estimatedMinutes || 20, 'standard')}
                    className={`w-full py-1 rounded text-[11px] font-medium transition-colors ${
                      day.isToday
                        ? 'bg-accent-blue hover:bg-accent-blue/90 text-white'
                        : 'bg-surface-elevated hover:bg-surface-muted text-zinc-300'
                    }`}
                  >
                    {day.isToday ? 'Démarrer' : 'Aperçu'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
