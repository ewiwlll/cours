import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Clock,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowRight,
  BrainCircuit,
  Calendar,
  Layers,
  ChevronRight,
  Mic,
  Zap,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import { getSubjects, getStudyCourses, getReviews, getWeaknesses, getExams } from '../lib/api';
import type { Subject, Course, ReviewStatus, Weakness, Exam } from '../lib/types';
import { formatDate } from '../lib/utils';
import { useStore } from '../lib/store';

interface DashboardViewProps {
  onNavigate?: (view: string, payload?: any) => void;
  onStartSession?: (minutes: number, mode?: string, subjectId?: string) => void;
  onOpenCourse?: (courseId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onStartSession,
  onOpenCourse,
}) => {
  const { openModal, setView } = useStore();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [reviews, setReviews] = useState<ReviewStatus>({
    dueCount: 0,
    totalCards: 0,
    todayReviewed: 0,
    dueCards: [],
  });
  const [weaknesses, setWeaknesses] = useState<Weakness[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const [subList, courseList, reviewData, weakList, examList] = await Promise.all([
          getSubjects(),
          getStudyCourses(),
          getReviews(),
          getWeaknesses(),
          getExams(),
        ]);
        setSubjects(subList || []);
        setCourses(courseList || []);
        setReviews(
          reviewData || { dueCount: 0, totalCards: 0, todayReviewed: 0, dueCards: [] }
        );
        setWeaknesses(weakList || []);
        setExams(examList || []);
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const nearestExam = [...exams].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )[0];

  const daysToNearestExam = nearestExam
    ? Math.max(
        0,
        Math.ceil(
          (new Date(nearestExam.date).getTime() - new Date().setHours(0, 0, 0, 0)) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  const lockedCourses = courses.filter((c) => c.recallStatus === 'locked');

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. HERO CARD : TA MISSION DU JOUR / DAILY FOCUS */}
      <div className="rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 border border-zinc-800/80 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800/80 border border-zinc-700 text-xs font-semibold text-zinc-300">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
              <span>🎯 Focus du jour</span>
            </div>

            {lockedCourses.length > 0 ? (
              <>
                <h3 className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight flex items-center gap-2">
                  <span>🔒 {lockedCourses.length} cours à déverrouiller</span>
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-lg leading-relaxed">
                  Le cours <strong className="text-zinc-200">"{lockedCourses[0]?.title}"</strong> attend ton premier rappel actif pour libérer sa fiche de synthèse.
                </p>
              </>
            ) : reviews.dueCount > 0 ? (
              <>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Tu as {reviews.dueCount} notion{reviews.dueCount > 1 ? 's' : ''} à réviser aujourd'hui
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-lg leading-relaxed">
                  Révise-les sans chrono stressant pour ancrer durablement ces notions dans ta mémoire à long terme.
                </p>
              </>
            ) : courses.length > 0 ? (
              <>
                <h3 className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6" />
                  Toutes tes révisions sont à jour ! 🎉
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-lg leading-relaxed">
                  Aucun oubli imminent prévu. Tu peux relire tes fiches ou enregistrer ton prochain amphi.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Bienvenue sur Cours ! Ajoutons ton premier amphi 📚
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-lg leading-relaxed">
                  Enregistre au micro ou tape ton cours. L'IA génère automatiquement la fiche et les flashcards FSRS.
                </p>
              </>
            )}
          </div>

          {/* Action Button */}
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            {lockedCourses.length > 0 ? (
              <button
                onClick={() => lockedCourses[0] && onOpenCourse?.(lockedCourses[0].id)}
                className="px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm shadow-xl shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 fill-black" />
                <span>Déverrouiller le cours</span>
              </button>
            ) : reviews.dueCount > 0 ? (
              <button
                onClick={() => onStartSession?.(15, 'standard')}
                className="px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>Lancer mes révisions FSRS-5 ({reviews.dueCount})</span>
              </button>
            ) : (
              <button
                onClick={() => openModal('recording')}
                className="px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Mic className="w-4 h-4" />
                <span>Enregistrer un cours</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. STATS & KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 : Courses */}
        <div
          onClick={() => {
            setView('subjects');
            onNavigate?.('subjects');
          }}
          className="cursor-pointer p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 hover:border-blue-500/40 hover:bg-zinc-900 transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-medium">Cours enregistrés</span>
            <BookOpen className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">{courses.length}</div>
            <p className="text-[11px] text-zinc-500 mt-0.5">Sur {subjects.length} matières</p>
          </div>
        </div>

        {/* KPI 2 : Due Flashcards */}
        <div
          onClick={() => {
            setView('anki');
            onNavigate?.('training');
          }}
          className="cursor-pointer p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 hover:border-emerald-500/40 hover:bg-zinc-900 transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-medium">Cartes FSRS dues</span>
            <Zap className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white flex items-center gap-2">
              <span>{reviews.dueCount}</span>
              {reviews.dueCount === 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  À jour
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">Algorithme FSRS-5</p>
          </div>
        </div>

        {/* KPI 3 : Exam Countdown */}
        <div
          onClick={() => {
            setView('planning');
            onNavigate?.('planning');
          }}
          className="cursor-pointer p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 hover:border-amber-500/40 hover:bg-zinc-900 transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-medium">Prochain partiel</span>
            <Calendar className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">
              {daysToNearestExam !== null ? (
                daysToNearestExam === 0 ? 'Aujourd\'hui !' : `J-${daysToNearestExam}`
              ) : (
                'Aucun'
              )}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {nearestExam ? nearestExam.title : 'Ajouter une date'}
            </p>
          </div>
        </div>

        {/* KPI 4 : Weaknesses */}
        <div
          onClick={() => {
            setView('anki');
            onNavigate?.('training');
          }}
          className="cursor-pointer p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 hover:border-rose-500/40 hover:bg-zinc-900 transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-medium">Points à consolider</span>
            <AlertTriangle className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-400">{weaknesses.length}</div>
            <p className="text-[11px] text-zinc-500 mt-0.5">Notions où tu as hésité</p>
          </div>
        </div>
      </div>



      {/* 4. LISTE DES COURS RÉCENTS OU GUIDE POUR COMMENCER */}
      {courses.length > 0 ? (
        <div className="rounded-xl bg-surface border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-400" />
              <span>Derniers cours ajoutés</span>
            </h3>
            <button
              onClick={() => {
                setView('subjects');
                onNavigate?.('subjects');
              }}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <span>Voir toutes les matières</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...courses]
              .sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime())
              .slice(0, 6)
              .map((c) => (
                <div
                  key={c.id}
                  onClick={() => onOpenCourse?.(c.id)}
                  className="p-3.5 rounded-xl bg-background border border-border hover:border-zinc-700 hover:bg-surface-elevated cursor-pointer transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-blue-400">{c.subjectTitle || 'Matière'}</span>
                      <span>•</span>
                      <span>📅 {formatDate(c.date)}</span>
                      {c.chapter && (
                        <>
                          <span>•</span>
                          <span className="text-zinc-300">📂 {c.chapter}</span>
                        </>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                      {c.title}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.recallStatus === 'locked' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        🔒 À déverrouiller
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        ✓ Prêt
                      </span>
                    )}
                    <span className="text-xs font-bold text-zinc-400 group-hover:translate-x-0.5 transition-transform">→</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
