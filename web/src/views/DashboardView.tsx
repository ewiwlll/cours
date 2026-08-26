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
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* 1. GUIDE RAPIDE EN 3 ÉTAPES (Toujours visible et rassurant) */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-950/40 via-surface to-surface border border-blue-500/20 p-5 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🚀</span>
            <div>
              <h2 className="text-base font-bold text-white">Comment réviser avec Cours ?</h2>
              <p className="text-xs text-zinc-400">La méthode simple pour réussir tes partiels sans stresser</p>
            </div>
          </div>
          <button
            onClick={() => openModal('howItWorks')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Guide complet</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Étape 1 */}
          <button
            onClick={() => openModal('recording')}
            className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-elevated/70 hover:bg-surface-elevated border border-border hover:border-blue-500/40 transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-black text-sm shrink-0 group-hover:scale-110 transition-transform">
              1
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors flex items-center gap-1">
                <span>🎙️ 1. Enregistre ton cours</span>
                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
              </div>
              <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                En amphi ou chez toi, clique ici pour enregistrer au micro ou déposer un texte.
              </p>
            </div>
          </button>

          {/* Étape 2 */}
          <button
            onClick={() => {
              setView('subjects');
              onNavigate?.('subjects');
            }}
            className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-elevated/70 hover:bg-surface-elevated border border-border hover:border-emerald-500/40 transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-sm shrink-0 group-hover:scale-110 transition-transform">
              2
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-1">
                <span>🧠 2. Fiche & Flashcards IA</span>
                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-400" />
              </div>
              <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                Fais ton rappel de 3 min pour débloquer la fiche et générer tes cartes.
              </p>
            </div>
          </button>

          {/* Étape 3 */}
          <button
            onClick={() => {
              setView('anki');
              onNavigate?.('training');
            }}
            className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-elevated/70 hover:bg-surface-elevated border border-border hover:border-purple-500/40 transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-black text-sm shrink-0 group-hover:scale-110 transition-transform">
              3
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors flex items-center gap-1">
                <span>⚡ 3. Révise à ton rythme avec FSRS-5</span>
                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-purple-400" />
              </div>
              <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                L'algorithme FSRS te présente chaque carte au moment optimal avant l'oubli.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* 2. BANNIÈRE D'ACTION PRINCIPALE (« QUE DOIS-JE FAIRE MAINTENANT ? ») */}
      <div className="rounded-2xl bg-surface border border-border p-6 sm:p-7 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-[11px] font-bold text-zinc-300">
              <span>🎯 Ta mission du moment</span>
            </div>

            {lockedCourses.length > 0 ? (
              <>
                <h3 className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight flex items-center gap-2">
                  <span>🔒 {lockedCourses.length} cours à déverrouiller ce soir</span>
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-lg">
                  Le cours <strong>"{lockedCourses[0]?.title}"</strong> est en attente de ton premier rappel actif pour ouvrir la fiche.
                </p>
              </>
            ) : reviews.dueCount > 0 ? (
              <>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Tu as {reviews.dueCount} notion{reviews.dueCount > 1 ? 's' : ''} à consolider aujourd'hui
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-lg">
                  Révise-les librement pour ancrer ces connaissances dans ta mémoire à long terme.
                </p>
              </>
            ) : courses.length > 0 ? (
              <>
                <h3 className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6" />
                  Toutes tes révisions sont à jour ! 🎉
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-lg">
                  Aucun oubli imminent prévu aujourd'hui. Tu peux relire tes fiches ou tester ta mémoire visuelle sur les schémas de biologie.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Bienvenue sur Cours ! Ajoutons ton premier cours 📚
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-lg">
                  Enregistre au micro ou dépose du texte. L'IA générera automatiquement ta fiche et tes premières flashcards d'entraînement.
                </p>
              </>
            )}
          </div>

          {/* Boutons d'action clairs */}
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            {lockedCourses.length > 0 ? (
              <button
                onClick={() => lockedCourses[0] && onOpenCourse?.(lockedCourses[0].id)}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-sm shadow-xl shadow-amber-500/20 hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 fill-black" />
                <span>Déverrouiller le cours</span>
              </button>
            ) : reviews.dueCount > 0 ? (
              <button
                onClick={() => onStartSession?.(15, 'standard')}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-blue-500/20 hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>Lancer mes révisions FSRS-5 ({reviews.dueCount})</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setView('subjects');
                    onNavigate?.('subjects');
                  }}
                  className="px-5 py-3 rounded-xl bg-surface-elevated hover:bg-surface-muted text-zinc-200 border border-border font-bold text-xs hover:scale-105 transition-all flex items-center justify-center gap-2"
                >
                  <BookOpen className="w-4 h-4 text-blue-400" />
                  <span>📖 Lire mes fiches</span>
                </button>
                <button
                  onClick={() => openModal('recording')}
                  className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 hover:scale-105 transition-all flex items-center justify-center gap-2"
                >
                  <Mic className="w-4 h-4" />
                  <span>🎙️ Enregistrer un cours</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 3. LES 4 CHIFFRES CLÉS (KPI) EXPLIQUÉS */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
          <span>Ton tableau de bord en direct</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1 */}
          <div
            onClick={() => {
              setView('subjects');
              onNavigate?.('subjects');
            }}
            className="cursor-pointer p-4 rounded-xl bg-surface border border-border hover:border-blue-500/40 hover:bg-surface-elevated transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-medium">Cours dans ton classeur</span>
              <BookOpen className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-white">{courses.length}</div>
              <p className="text-[11px] text-zinc-500 mt-0.5">Sur 15 matières BioMIA</p>
            </div>
          </div>

          {/* KPI 2 */}
          <div
            onClick={() => {
              setView('anki');
              onNavigate?.('training');
            }}
            className="cursor-pointer p-4 rounded-xl bg-surface border border-border hover:border-emerald-500/40 hover:bg-surface-elevated transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-medium">Flashcards à revoir</span>
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-white flex items-center gap-2">
                <span>{reviews.dueCount}</span>
                {reviews.dueCount === 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    À jour
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">Calculé par FSRS-5</p>
            </div>
          </div>

          {/* KPI 3 */}
          <div
            onClick={() => {
              setView('planning');
              onNavigate?.('planning');
            }}
            className="cursor-pointer p-4 rounded-xl bg-surface border border-border hover:border-amber-500/40 hover:bg-surface-elevated transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-medium">Prochain partiel</span>
              <Calendar className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-white">
                {daysToNearestExam !== null ? `J-${daysToNearestExam}` : 'Aucun'}
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {nearestExam ? nearestExam.title : 'Ajouter une date'}
              </p>
            </div>
          </div>

          {/* KPI 4 */}
          <div
            onClick={() => {
              setView('anki');
              onNavigate?.('training', { tab: 'weak' });
            }}
            className="cursor-pointer p-4 rounded-xl bg-surface border border-border hover:border-red-500/40 hover:bg-surface-elevated transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-medium">Points à consolider</span>
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-white">{weaknesses.length}</div>
              <p className="text-[11px] text-zinc-500 mt-0.5">Notions où tu as hésité</p>
            </div>
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
