import React, { useState } from 'react';
import {
  X,
  GraduationCap,
  Plus,
} from 'lucide-react';
import { createSubject } from '../../lib/api';
import { useStore } from '../../lib/store';
import type { PriorityLevel } from '../../lib/types';

interface SubjectEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (subjectId: string) => void;
}

export const SubjectEditorModal: React.FC<SubjectEditorModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { refreshData, setSelectedSubjectId, setView } = useStore();
  const [title, setTitle] = useState('');
  const [ects, setEcts] = useState<number>(6);
  const [priority, setPriority] = useState<PriorityLevel>('A');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Veuillez entrer le nom de la matière.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const created = await createSubject({
        title: title.trim(),
        ects: Number(ects) || 3,
        priority,
      });

      if (created) {
        await refreshData();
        setSelectedSubjectId(created.id);
        setView('subjects');
        if (onCreated) onCreated(created.id);
        // Reset form
        setTitle('');
        setEcts(6);
        setPriority('A');
        onClose();
      } else {
        setError('Impossible d\'enregistrer la matière. Vérifiez les informations.');
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-md bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-border/80 flex items-center justify-between bg-surface-elevated/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Ajouter une matière</h2>
              <p className="text-xs text-zinc-400">Créez votre matière pour y ranger vos chapitres et cours</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-surface-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* 1. Titre de la Matière */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-200">
              Nom de la matière <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Mathématiques, Biochimie, Droit, Pharmacologie..."
              className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
              autoFocus
            />
          </div>

          {/* 2. ECTS & Priorité */}
          <div className="grid grid-cols-2 gap-4">
            {/* ECTS */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-200">Crédits (ECTS)</label>
              <input
                type="number"
                min={1}
                max={60}
                value={ects}
                onChange={(e) => setEcts(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Priorité */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-200">Priorité examen</label>
              <div className="flex gap-1.5">
                {(['A', 'B', 'C'] as PriorityLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setPriority(lvl)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      priority === lvl
                        ? lvl === 'A'
                          ? 'bg-rose-500 text-white shadow-xs'
                          : lvl === 'B'
                          ? 'bg-amber-500 text-black shadow-xs'
                          : 'bg-blue-500 text-white shadow-xs'
                        : 'bg-surface-elevated text-zinc-400 hover:text-zinc-200 border border-border-subtle'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-border/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-muted text-zinc-300 text-xs font-semibold transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <span>Création...</span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Créer la matière</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
