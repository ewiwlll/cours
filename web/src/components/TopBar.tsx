import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Zap,
  Calendar,
  Mic,
  Settings,
  HelpCircle,
  Globe,
} from 'lucide-react';
import { useStore } from '../lib/store';
import type { ViewType } from '../lib/types';

export function TopBar() {
  const {
    view,
    setView,
    openModal,
    totalDueCards,
    lang,
    setLang,
  } = useStore();

  const tabs: Array<{ id: ViewType; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }> = [
    { id: 'accueil', label: lang === 'en' ? 'Dashboard' : 'Accueil', icon: LayoutDashboard },
    { id: 'subjects', label: lang === 'en' ? 'Subjects' : 'Matières', icon: BookOpen },
    { id: 'anki', label: lang === 'en' ? 'Practice' : 'Entraînement', icon: Zap, badge: totalDueCards },
    { id: 'planning', label: lang === 'en' ? 'Schedule' : 'Planning', icon: Calendar },
  ];

  return (
    <header className="sticky top-0 z-40 h-14 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80 flex items-center justify-between px-4 sm:px-6 select-none">
      {/* Left: macOS Traffic Lights Margin + Brand */}
      <div className="flex items-center gap-3 pl-16 sm:pl-20 md:pl-0">
        <button
          onClick={() => setView('accueil')}
          className="flex items-center gap-2.5 group transition-transform active:scale-95"
        >
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <span className="font-black text-white text-base tracking-tighter">C</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm tracking-tight text-white">Cours</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              OS
            </span>
          </div>
        </button>
      </div>

      {/* Center: Sleek Segmented Nav Control */}
      <nav className="hidden md:flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 shadow-inner">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = view === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-zinc-400'}`} />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-500 text-white shadow">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Right Actions: Record Mic + Method + Language + Settings */}
      <div className="flex items-center gap-2">
        {/* Record Button */}
        <button
          onClick={() => openModal('recording')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold shadow-sm transition-all hover:scale-105 active:scale-95"
          title={lang === 'en' ? 'Record lecture (Shortcut: R)' : 'Enregistrer un amphi (Raccourci: Touche R)'}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <Mic className="w-3.5 h-3.5 text-red-400" />
          <span className="hidden sm:inline">{lang === 'en' ? 'Record' : 'Enregistrer'}</span>
        </button>

        {/* Method Guide Button */}
        <button
          onClick={() => openModal('howItWorks')}
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
          title={lang === 'en' ? 'Methodology & Guide' : 'Méthode & Studio Antigravity'}
        >
          <HelpCircle className="w-4 h-4 text-blue-400" />
        </button>

        {/* Language Switcher */}
        <button
          onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono font-bold text-zinc-300 hover:text-white hover:border-zinc-700 transition-all"
          title={lang === 'en' ? 'Switch to French' : 'Basculer en Anglais'}
        >
          <Globe className="w-3.5 h-3.5 text-zinc-400" />
          <span>{lang.toUpperCase()}</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={() => openModal('settings')}
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
          title={lang === 'en' ? 'Settings' : 'Paramètres'}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
