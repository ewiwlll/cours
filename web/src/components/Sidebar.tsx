import React, { useState, useMemo } from 'react';
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

  const groupedSubjects = useMemo(() => {
    const groups: Record<string, Subject[]> = {};
    filteredSubjects.forEach((subj) => {
      const cat = subj.category?.trim() || 'Général';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(subj);
    });
    return groups;
  }, [filteredSubjects]);

  const handleSubjectClick = (subj: Subject) => {
    if (selectedSubjectId === subj.id) {
      // Toggle off selection if clicked again
      setSelectedSubjectId(null);
    } else {
      setSelectedSubjectId(subj.id);
      setView('subjects');
    }
  };

  const categories = Object.keys(groupedSubjects);

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

      {/* Search bar */}
      {!isCollapsed && (
        <div className="p-3 border-b border-border-subtle bg-surface/50">
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
        </div>
      )}

      {/* Subjects List Grouped by Category */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {filteredSubjects.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-400">
            Aucune matière trouvée
          </div>
        ) : isCollapsed ? (
          <div className="space-y-1">
            {filteredSubjects.map((subj) => {
              const isSelected = selectedSubjectId === subj.id;
              const dueCount = subj.dueCardsCount || 0;
              return (
                <button
                  key={subj.id}
                  onClick={() => handleSubjectClick(subj)}
                  title={`${subj.title} - ${dueCount} cartes dues`}
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
            })}
          </div>
        ) : (
          categories.map((categoryName) => {
            const subs = groupedSubjects[categoryName] || [];
            return (
              <div key={categoryName} className="space-y-1">
                {/* Category Header */}
                <div className="px-2 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                  <span>{categoryName}</span>
                  <span className="opacity-60 font-normal">({subs.length})</span>
                </div>

                {subs.map((subj) => {
                  const isSelected = selectedSubjectId === subj.id;
                  const dueCount = subj.dueCardsCount || 0;
                  const coursesCount = subj.coursesCount || 0;

                  return (
                    <button
                      key={subj.id}
                      onClick={() => handleSubjectClick(subj)}
                      className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start justify-between gap-2 group ${
                        isSelected
                          ? 'bg-blue-600/15 border border-blue-500/40 text-white shadow-sm'
                          : 'hover:bg-zinc-900/80 text-zinc-300 border border-transparent hover:border-zinc-800/80'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] text-zinc-400 font-medium bg-zinc-800/80 px-1.5 py-0.2 rounded">
                            {subj.ects} ECTS
                          </span>
                          {subj.priority === 'A' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Priorité A" />
                          )}
                        </div>

                        <h3
                          className={`text-xs font-semibold leading-snug truncate ${
                            isSelected ? 'text-blue-400 font-bold' : 'text-zinc-200 group-hover:text-white'
                          }`}
                        >
                          {subj.title}
                        </h3>

                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-500">
                          <span>{coursesCount} cours</span>
                        </div>
                      </div>

                      {/* Due cards indicator badge */}
                      {dueCount > 0 ? (
                        <span
                          className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30"
                          title={`${dueCount} cartes à réviser aujourd'hui`}
                        >
                          {dueCount}
                        </span>
                      ) : coursesCount > 0 ? (
                        <span
                          className="shrink-0 text-[10px] text-emerald-400/80 font-bold"
                          title="Cartes à jour"
                        >
                          ✓
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
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
