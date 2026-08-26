import React, { useState } from 'react';
import {
  Search,
  X,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FolderTree,
  Sparkles,
  Plus,
  Layers,
  GraduationCap,
} from 'lucide-react';
import { useStore } from '../lib/store';
import type { SemesterFilter, Subject } from '../lib/types';

export function Sidebar() {
  const {
    catalog,
    filteredSubjects,
    selectedSubjectId,
    setSelectedSubjectId,
    semesterFilter,
    setSemesterFilter,
    searchQuery,
    setSearchQuery,
    setView,
    openModal,
    totalDueCards,
    studyCourses,
  } = useStore();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const filters: Array<{ id: SemesterFilter; label: string; count: number }> = [
    { id: 'all', label: 'Tous', count: catalog.length },
    { id: 'S1', label: 'S1', count: catalog.filter((s) => s.semester === 'S1').length },
    { id: 'S2', label: 'S2', count: catalog.filter((s) => s.semester === 'S2').length },
  ];

  const handleSubjectClick = (subj: Subject) => {
    if (selectedSubjectId === subj.id) {
      // Toggle off selection if clicked again
      setSelectedSubjectId(null);
    } else {
      setSelectedSubjectId(subj.id);
      setView('subjects');
    }
  };

  return (
    <aside
      className={`hidden lg:flex h-[calc(100vh-3.5rem)] sticky top-14 border-r border-border bg-surface flex-col transition-all duration-200 select-none ${
        isCollapsed ? 'w-16' : 'w-72'
      }`}
    >
      {/* Sidebar Header & Toggle */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-blue-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Matières ({catalog.length})
            </h2>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg hover:bg-surface-elevated text-zinc-400 hover:text-zinc-200 transition-colors mx-auto"
          title={isCollapsed ? 'Déplier la barre latérale' : 'Replier la barre latérale'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded Controls (Search & Semester Filters) */}
      {!isCollapsed && (
        <div className="p-3 space-y-2.5 border-b border-border-subtle bg-surface/50">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Rechercher une matière..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-elevated border border-border rounded-lg pl-8 pr-7 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 p-0.5 text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Semester Filter Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-surface-elevated p-1 rounded-lg border border-border-subtle">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setSemesterFilter(f.id)}
                className={`py-1 rounded text-[11px] font-medium transition-all ${
                  semesterFilter === f.id
                    ? 'bg-zinc-800 text-white font-semibold shadow-xs border border-zinc-700/50'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-muted'
                }`}
              >
                {f.label} <span className="opacity-60 text-[10px]">({f.count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Subjects List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredSubjects.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-400">
            Aucune matière trouvée
          </div>
        ) : (
          filteredSubjects.map((subj) => {
            const isSelected = selectedSubjectId === subj.id;
            const dueCount = subj.dueCardsCount || 0;
            const coursesCount = subj.coursesCount || 0;

            if (isCollapsed) {
              return (
                <button
                  key={subj.id}
                  onClick={() => handleSubjectClick(subj)}
                  title={`${subj.title} (${subj.semester}) - ${dueCount} cartes dues`}
                  className={`relative w-full p-2.5 rounded-lg flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-bold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-elevated'
                  }`}
                >
                  <span className="text-[11px] font-bold">
                    {subj.title.slice(0, 2).toUpperCase()}
                  </span>
                  {dueCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </button>
              );
            }

            return (
              <button
                key={subj.id}
                onClick={() => handleSubjectClick(subj)}
                className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start justify-between gap-2 group ${
                  isSelected
                    ? 'bg-blue-600/15 border border-blue-500/30 text-white shadow-sm'
                    : 'hover:bg-surface-elevated text-zinc-300 border border-transparent'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                        subj.semester === 'S1'
                          ? 'bg-blue-950/40 text-blue-400 border-blue-800/40'
                          : 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                      }`}
                    >
                      {subj.semester}
                    </span>
                    <span className="text-[9px] font-semibold text-zinc-400">
                      {subj.ects} ECTS
                    </span>
                    <span
                      className={`text-[9px] font-mono font-bold px-1 rounded ${
                        subj.priority === 'A'
                          ? 'text-amber-400 bg-amber-950/40'
                          : 'text-zinc-400 bg-zinc-800/40'
                      }`}
                    >
                      Prio {subj.priority}
                    </span>
                  </div>

                  <h3
                    className={`text-xs font-medium leading-snug truncate ${
                      isSelected ? 'text-blue-300 font-semibold' : 'text-zinc-200 group-hover:text-white'
                    }`}
                  >
                    {subj.title}
                  </h3>

                  <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
                    <span>{coursesCount} cours</span>
                    <span>•</span>
                    <span className="truncate">{subj.category}</span>
                  </div>
                </div>

                {/* Due cards indicator badge */}
                {dueCount > 0 ? (
                  <span
                    className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    title={`${dueCount} cartes à réviser aujourd'hui`}
                  >
                    {dueCount}
                  </span>
                ) : coursesCount > 0 ? (
                  <span
                    className="shrink-0 px-1.5 py-0.5 rounded text-[9px] text-zinc-400 bg-surface-muted"
                    title="Cartes à jour"
                  >
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>

      {/* Sidebar Footer Action */}
      {!isCollapsed && (
        <div className="p-3 border-t border-border bg-surface/80">
          <button
            onClick={() => openModal('courseEditor')}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-xs font-semibold text-blue-300 hover:text-white transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-blue-400" />
            <span>Nouveau cours</span>
          </button>
        </div>
      )}
    </aside>
  );
}
