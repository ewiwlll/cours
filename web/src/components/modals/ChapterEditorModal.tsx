import React, { useState, useRef } from 'react';
import {
  X,
  FolderOpen,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Upload,
  FileText,
  Layers,
  Target,
} from 'lucide-react';
import type { ChapterDefinition, Subject } from '../../lib/types';
import { cn, formatBytes, playAudioFeedback } from '../../lib/utils';

interface ChapterEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapter?: Partial<ChapterDefinition>;
  subjects?: Subject[];
  onSave?: (data: Partial<ChapterDefinition>, files: File[]) => void;
}

export const ChapterEditorModal: React.FC<ChapterEditorModalProps> = ({
  isOpen,
  onClose,
  chapter,
  subjects = [
    { id: 'sub-1', title: 'Biologie Cellulaire & Moléculaire' },
    { id: 'sub-2', title: 'Biochimie Structurale & Métabolique' },
    { id: 'sub-3', title: 'Physiologie & Pharmacologie' },
  ],
  onSave,
}) => {
  const [title, setTitle] = useState(chapter?.title || '');
  const [subjectId, setSubjectId] = useState(chapter?.subjectId || subjects[0]?.id || '');
  const [order, setOrder] = useState<number>(chapter?.order || 1);
  const [description, setDescription] = useState(chapter?.description || '');
  const [objectives, setObjectives] = useState<string[]>(
    chapter?.objectives || [
      'Maîtriser les étapes enzymatiques clés',
      'Identifier les mécanismes de régulation allostérique',
    ]
  );
  const [newObjective, setNewObjective] = useState('');

  // Drag & drop file uploads
  const [files, setFiles] = useState<File[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddObjective = () => {
    if (newObjective.trim() && !objectives.includes(newObjective.trim())) {
      setObjectives((prev) => [...prev, newObjective.trim()]);
      setNewObjective('');
      playAudioFeedback('click');
    }
  };

  const handleRemoveObjective = (index: number) => {
    setObjectives((prev) => prev.filter((_, i) => i !== index));
    playAudioFeedback('click');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
      playAudioFeedback('click');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Veuillez entrer un titre pour le chapitre.');
      return;
    }

    const selectedSub = subjects.find((s) => s.id === subjectId);

    const data: Partial<ChapterDefinition> = {
      ...chapter,
      id: chapter?.id || `chap-${Date.now()}`,
      title,
      subjectId,
      subjectTitle: selectedSub?.title,
      order,
      description,
      objectives,
      updatedAt: new Date().toISOString(),
    };

    onSave?.(data, files);
    playAudioFeedback('success');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-surface border border-border shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <header className="h-16 px-6 border-b border-border bg-surface-elevated flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center text-accent-purple font-bold">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">
                {chapter?.id ? 'Modifier le Chapitre' : 'Nouveau Chapitre Thématique'}
              </h2>
              <p className="text-xs text-zinc-400">
                Regroupez vos séances de cours et définissez les objectifs d'apprentissage
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-surface border border-transparent hover:border-border transition"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Modal Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Chapter Title & Order */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-3">
              <label className="text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>Titre du Chapitre</span>
                <span className="text-[10px] text-accent-blue font-normal">Requis</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ex: Bioénergétique et Phosphorylation Oxydative"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-surface-elevated border border-border text-sm text-zinc-100 focus:border-accent-blue focus:outline-none transition"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 mb-1.5 block">
                N° d'Ordre
              </label>
              <input
                type="number"
                value={order}
                min={1}
                onChange={(e) => setOrder(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-elevated border border-border text-xs text-zinc-100 focus:border-accent-blue focus:outline-none"
              />
            </div>
          </div>

          {/* Subject Selector */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 mb-1.5 block">
              Matière / Discipline de Rattachement
            </label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-elevated border border-border text-xs text-zinc-100 focus:border-accent-blue focus:outline-none"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.title}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 mb-1.5 block">
              Synthèse & Cadrage Thématique
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Grandes notions abordées, transversalité avec les autres chapitres..."
              className="w-full p-3.5 rounded-2xl bg-surface-elevated border border-border text-xs text-zinc-200 focus:border-accent-blue focus:outline-none resize-none transition leading-relaxed"
            />
          </div>

          {/* Learning Objectives List */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Target className="w-4 h-4 text-accent-green" />
                Objectifs d'Apprentissage Clés
              </span>
              <span className="text-[10px] text-zinc-500">{objectives.length} objectifs</span>
            </label>

            <div className="flex flex-col gap-2 mb-3">
              {objectives.map((obj, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-surface-elevated border border-border flex items-center justify-between text-xs gap-3"
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-accent-green shrink-0" />
                    <span className="text-zinc-200">{obj}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveObjective(idx)}
                    className="text-zinc-500 hover:text-red-400 p-1 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add objective input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newObjective}
                onChange={(e) => setNewObjective(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddObjective();
                  }
                }}
                placeholder="Ajouter un nouvel objectif pédagogique..."
                className="flex-1 px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-zinc-200 focus:outline-none focus:border-accent-blue"
              />
              <button
                type="button"
                onClick={handleAddObjective}
                className="px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface border border-border text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </button>
            </div>
          </div>

          {/* Drag & Drop Summary Files */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
              <span>Fiche Synthèse / Polycopié de Chapitre</span>
              <span className="text-[10px] text-zinc-500">PDF, Markdown</span>
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'p-5 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition text-center group',
                isDraggingOver
                  ? 'border-accent-purple bg-accent-purple/10'
                  : 'border-border hover:border-zinc-500 bg-surface-elevated/50 hover:bg-surface-elevated'
              )}
            >
              <Upload className="w-6 h-6 text-zinc-400 group-hover:text-accent-purple mb-1.5 transition" />
              <div className="text-xs font-semibold text-zinc-200">
                Déposer une fiche de synthèse ou un résumé
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) =>
                  e.target.files && setFiles((prev) => [...prev, ...Array.from(e.target.files!)])
                }
                className="hidden"
              />
            </div>

            {files.length > 0 && (
              <div className="mt-2.5 flex flex-col gap-1.5">
                {files.map((file, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-surface-elevated border border-border flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-accent-purple" />
                      <span className="text-zinc-200 truncate">{file.name}</span>
                      <span className="text-zinc-500 font-mono text-[10px]">
                        ({formatBytes(file.size)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-zinc-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="submit" className="hidden" />
        </form>

        {/* Modal Footer */}
        <footer className="h-16 px-6 border-t border-border bg-surface-elevated flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-surface text-xs font-semibold transition"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-accent-purple hover:bg-purple-600 text-white text-xs font-bold shadow-md shadow-accent-purple/20 flex items-center gap-2 transition"
          >
            <Save className="w-4 h-4" />
            Enregistrer le Chapitre
          </button>
        </footer>
      </div>
    </div>
  );
};
