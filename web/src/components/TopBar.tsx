import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Zap,
  Calendar,
  Mic,
  RotateCw,
  Sparkles,
  Layers,
  Settings,
  Globe,
} from 'lucide-react';
import { useStore } from '../lib/store';
import type { ViewType } from '../lib/types';

export function TopBar() {
  const {
    view,
    setView,
    openModal,
    refreshData,
    isRefreshing,
    totalDueCards,
    automationStatus,
    lang,
    setLang,
    t,
  } = useStore();

  const tabs: Array<{ id: ViewType; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }> = [
    { id: 'accueil', label: lang === 'en' ? 'Dashboard' : 'Accueil', icon: LayoutDashboard },
    { id: 'subjects', label: lang === 'en' ? 'Subjects' : 'Matières', icon: BookOpen },
    { id: 'anki', label: lang === 'en' ? 'Practice' : 'Entraînement', icon: Zap, badge: totalDueCards },
    { id: 'planning', label: lang === 'en' ? 'Schedule' : 'Planning', icon: Calendar },
  ];

  return (
    <header className="sticky top-0 z-40 h-14 bg-surface/90 backdrop-blur-md border-b border-border flex items-center justify-between px-4 select-none">
      {/* Brand Logo & OS Name */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setView('accueil')}
          className="flex items-center gap-2.5 px-2 py-1 -ml-1 rounded-lg hover:bg-surface-elevated transition-colors text-left group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <span className="font-black text-white text-base tracking-tighter">C</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="font-bold text-sm text-zinc-100 tracking-tight">Cours</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                OS
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-mono tracking-tight mt-0.5">Active Recall & FSRS-5</p>
          </div>
        </button>

        {/* Automation Status Badge */}
        {automationStatus && (
          <div
            className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-800/60 border border-border text-[11px] text-zinc-400"
            title={`Modèle: ${automationStatus.codexModel} (${automationStatus.codexReasoning})`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${automationStatus.mode === 'actif' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            <span className="font-mono">{automationStatus.mode === 'actif' ? 'Pipeline actif' : 'Simulation'}</span>
          </div>
        )}
      </div>

      {/* 4 Main View Tabs (Desktop) */}
      <nav className="hidden lg:flex items-center gap-1 bg-surface-elevated/70 p-1 rounded-xl border border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = view === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-muted'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-zinc-400'}`} />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Right Actions: How it works, Occlusion Studio, Record Button, Refresh */}
      <div className="flex items-center gap-2">
        {/* Guide / How It Works Button */}
        <button
          onClick={() => openModal('howItWorks')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-xs font-semibold text-blue-300 border border-blue-500/30 transition-all hover:scale-105"
          title="Comprendre le fonctionnement de Cours en 3 étapes"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Comment ça marche ?</span>
        </button>

        {/* Occlusion Studio Quick Trigger */}
        <button
          onClick={() => openModal('occlusionStudio')}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-muted text-xs font-medium text-purple-300 hover:text-purple-200 border border-purple-500/20 hover:border-purple-500/40 transition-colors"
          title="Ouvrir le Studio de Masquage de Schémas (Image Occlusion)"
        >
          <Layers className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden lg:inline">Schémas</span>
        </button>

        {/* Record Button with R Shortcut */}
        <button
          onClick={() => openModal('recording')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-300 text-xs font-semibold shadow-sm transition-all group"
          title="Enregistrer un cours vocalement (Raccourci: Touche R)"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <Mic className="w-3.5 h-3.5 text-red-400 group-hover:scale-110 transition-transform" />
          <span>Enregistrer</span>
          <span className="key-badge ml-0.5 text-[9px] px-1 py-0.2 bg-red-950/60 border-red-800/40 text-red-300">
            R
          </span>
        </button>

        {/* Auto-Sync Live Indicator */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold select-none"
          title="Synchronisation automatique active"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="hidden sm:inline">Synchro auto</span>
        </div>

        {/* Language Switcher Toggle */}
        <button
          onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-muted text-zinc-300 hover:text-white border border-border text-xs font-mono font-bold transition-all"
          title={lang === 'fr' ? 'Switch to English' : 'Passer en Français'}
        >
          <Globe className="w-3.5 h-3.5 text-blue-400" />
          <span>{lang.toUpperCase()}</span>
        </button>

        {/* Settings Modal Button */}
        <button
          onClick={() => openModal('settings')}
          className="p-2 rounded-lg bg-surface-elevated hover:bg-surface-muted text-zinc-400 hover:text-zinc-100 border border-border transition-colors"
          title="Paramètres (Clé Gemini, Port, Connexion Mobile & 4G)"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
