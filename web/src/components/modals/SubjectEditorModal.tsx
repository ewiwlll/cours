import React, { useState } from 'react';
import {
  X,
  GraduationCap,
  Plus,
  Check,
  Sparkles,
  Layers,
  Award,
} from 'lucide-react';
import { createSubject } from '../../lib/api';
import { useStore } from '../../lib/store';
import type { PriorityLevel } from '../../lib/types';

interface SubjectEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (subjectId: string) => void;
}

const DEFAULT_CATEGORIES = [
  'Tronc commun',
  'Biologie',
  'BioMIA / IA',
  'Informatique',
  'Transversal',
  'Mineure',
];

export const SubjectEditorModal: React.FC<SubjectEditorModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { refreshData, setSelectedSubjectId, setView } = useStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Tronc commun');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
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

    const finalCategory = isCustomCategory ? customCategory.trim() || 'Général' : category;

    setIsSubmitting(true);
    setError(null);
    try {
      const created = await createSubject({
        title: title.trim(),
        category: finalCategory,
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
        setCategory('Tronc commun');
        setCustomCategory('');
        setIsCustomCategory(false);
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
        className="w-full max-w-lg bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-border/80 flex items-center justify-between bg-surface-elevated/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Ajouter une nouvelle matière</h2>
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
              placeholder="Ex: Neurosciences, Mathématiques appliquées, Biophysique..."
              className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
              autoFocus
            />
          </div>

          {/* 2. Pôle / Catégorie */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-200 flex items-center justify-between">
              <span>Domaine / Catégorie</span>
              <button
                type="button"
                onClick={() => setIsCustomCategory(!isCustomCategory)}
                className="text-[11px] text-blue-400 hover:underline font-normal"
              >
                {isCustomCategory ? 'Choisir dans la liste' : '+ Autre domaine'}
              </button>
            </label>

            {isCustomCategory ? (
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Ex: Économie, Droit, Mécanique..."
                className="w-full px-4 py-2 rounded-xl bg-background border border-border text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      category === cat
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-surface-elevated text-zinc-400 hover:text-zinc-200 border border-border-subtle'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. ECTS & Priorité */}
          <div className="grid grid-cols-2 gap-4">
            {/* ECTS */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-200">Crédits ECTS</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={ects}
                  onChange={(e) => setEcts(Number(e.target.value))}
                  className="w-20 px-3 py-2 rounded-xl bg-background border border-border text-xs text-white font-bold text-center focus:outline-none focus:border-blue-500"
                />
                <div className="flex items-center gap-1">
                  {[3, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setEcts(num)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        ects === num
                          ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
                          : 'bg-surface-elevated text-zinc-400 hover:text-zinc-200 border border-border-subtle'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Priorité */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-200">Priorité d'examen</label>
              <div className="grid grid-cols-3 gap-1">
                {(['A', 'B', 'C'] as PriorityLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setPriority(lvl)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      priority === lvl
                        ? lvl === 'A'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                          : lvl === 'B'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-xs'
                          : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                        : 'bg-surface-elevated text-zinc-500 hover:text-zinc-300 border border-border-subtle'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-surface-elevated transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Création...' : 'Créer la matière'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
