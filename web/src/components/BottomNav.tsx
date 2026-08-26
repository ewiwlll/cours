import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Zap,
  Calendar,
  Mic,
} from 'lucide-react';
import { useStore } from '../lib/store';
import type { ViewType } from '../lib/types';

export function BottomNav() {
  const {
    view,
    setView,
    openModal,
    totalDueCards,
    setOpenCourseId,
    lang,
  } = useStore();

  const handleNav = (targetView: ViewType) => {
    setOpenCourseId(null);
    setView(targetView);
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 px-2 py-1.5 pb-safe select-none shadow-2xl">
      <div className="max-w-md mx-auto flex items-center justify-around relative">
        {/* 1. Accueil */}
        <button
          onClick={() => handleNav('accueil')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            view === 'accueil'
              ? 'text-blue-400 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <LayoutDashboard className={`w-5 h-5 ${view === 'accueil' ? 'text-blue-400' : 'text-zinc-400'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight">{lang === 'en' ? 'Dashboard' : 'Accueil'}</span>
        </button>

        {/* 2. Matières */}
        <button
          onClick={() => handleNav('subjects')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            view === 'subjects'
              ? 'text-blue-400 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <BookOpen className={`w-5 h-5 ${view === 'subjects' ? 'text-blue-400' : 'text-zinc-400'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight">{lang === 'en' ? 'Subjects' : 'Matières'}</span>
        </button>

        {/* 3. Bouton Central Enregistrer (Amphi) */}
        <div className="relative -top-3">
          <button
            onClick={() => openModal('recording')}
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-rose-600 via-red-500 to-amber-500 p-0.5 shadow-lg shadow-red-500/30 active:scale-95 transition-transform flex items-center justify-center"
            title={lang === 'en' ? 'Start lecture recording' : 'Démarrer un enregistrement en amphi'}
          >
            <div className="w-full h-full rounded-full bg-zinc-950 flex flex-col items-center justify-center gap-0.5 hover:bg-zinc-900 transition-colors">
              <Mic className="w-5 h-5 text-red-400" />
              <span className="text-[8px] font-black uppercase tracking-wider text-red-300">
                {lang === 'en' ? 'Record' : 'Amphi'}
              </span>
            </div>
          </button>
        </div>

        {/* 4. Entraînement */}
        <button
          onClick={() => handleNav('anki')}
          className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            view === 'anki'
              ? 'text-blue-400 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Zap className={`w-5 h-5 ${view === 'anki' ? 'text-blue-400' : 'text-zinc-400'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight">{lang === 'en' ? 'Practice' : 'Entraîner'}</span>
          {typeof totalDueCards === 'number' && totalDueCards > 0 && (
            <span className="absolute top-0 right-1 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-blue-500 text-white shadow">
              {totalDueCards}
            </span>
          )}
        </button>

        {/* 5. Planning */}
        <button
          onClick={() => handleNav('planning')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            view === 'planning'
              ? 'text-blue-400 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Calendar className={`w-5 h-5 ${view === 'planning' ? 'text-blue-400' : 'text-zinc-400'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight">{lang === 'en' ? 'Schedule' : 'Planning'}</span>
        </button>
      </div>
    </nav>
  );
}
