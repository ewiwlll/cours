import React, { useState, useRef } from 'react';
import {
  X,
  BookOpen,
  Upload,
  FileText,
  Music,
  Image as ImageIcon,
  Trash2,
  Plus,
  Save,
  Calendar,
  Layers,
  Check,
  Tag,
} from 'lucide-react';
import type { StudyCourse, Subject, ChapterDefinition } from '../../lib/types';
import { cn, formatBytes, playAudioFeedback } from '../../lib/utils';

interface CourseEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  course?: Partial<StudyCourse>;
  subjects?: Subject[];
  chapters?: ChapterDefinition[];
  onSave?: (data: Partial<StudyCourse>, files: File[]) => void;
}

export const CourseEditorModal: React.FC<CourseEditorModalProps> = ({
  isOpen,
  onClose,
  course,
  subjects = [
    { id: 'sub-1', title: 'Biologie Cellulaire & Moléculaire' },
    { id: 'sub-2', title: 'Biochimie Structurale & Métabolique' },
    { id: 'sub-3', title: 'Physiologie & Pharmacologie' },
  ],
  chapters = [
    { id: 'ch-1', subjectId: 'sub-1', title: 'Organisation et Trafic Vésiculaire' },
    { id: 'ch-2', subjectId: 'sub-1', title: 'Cycle Cellulaire et Apoptose' },
    { id: 'ch-3', subjectId: 'sub-2', title: 'Bioénergétique et Cycle de Krebs' },
  ],
  onSave,
}) => {
  const [title, setTitle] = useState(course?.title || '');
  const [subjectId, setSubjectId] = useState(course?.subjectId || subjects[0]?.id || '');
  const [chapterId, setChapterId] = useState(course?.chapterId || '');
  const [date, setDate] = useState(course?.date || new Date().toISOString().split('T')[0]);
  const [kind, setKind] = useState<string>(course?.kind || 'CM');
  const [courseNumber, setCourseNumber] = useState<number>(course?.courseNumber || 1);
  const [notes, setNotes] = useState(course?.notes || '');
  const [tags, setTags] = useState<string[]>(course?.tags || ['CM', 'Amphi']);
  const [tagInput, setTagInput] = useState('');

  // Uploaded files via drag & drop
  const [attachedFiles, setAttachedFiles] = useState<Array<{ id: string; file: File; progress: number }>>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableChapters = chapters.filter((c) => c.subjectId === subjectId);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFiles = (files: File[]) => {
    const newItems = files.map((file) => ({
      id: `file-${Date.now()}-${Math.random()}`,
      file,
      progress: 100,
    }));
    setAttachedFiles((prev) => [...prev, ...newItems]);
    playAudioFeedback('click');
  };

  const removeFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
    playAudioFeedback('click');
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags((prev) => [...prev, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Veuillez spécifier un titre pour le cours.');
      return;
    }

    const selectedSub = subjects.find((s) => s.id === subjectId);
    const selectedChap = chapters.find((c) => c.id === chapterId);

    const updatedData: Partial<StudyCourse> = {
      ...course,
      id: course?.id || `course-${Date.now()}`,
      title,
      subjectId,
      subjectTitle: selectedSub?.title,
      chapterId: chapterId || undefined,
      chapter: selectedChap?.title,
      date,
      kind,
      courseNumber,
      notes,
      tags,
      status: course?.status || 'draft',
    };

    onSave?.(updatedData, attachedFiles.map((f) => f.file));
    playAudioFeedback('success');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-surface border border-border shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <header className="h-16 px-6 border-b border-border bg-surface-elevated flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center text-accent-blue font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">
                {course?.id ? 'Modifier la Fiche de Cours' : 'Créer une Nouvelle Séance de Cours'}
              </h2>
              <p className="text-xs text-zinc-400">
                Structurez les données pédagogiques, métadonnées et supports de révision
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

        {/* Modal Form Content */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Main Title & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-3">
              <label className="text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>Titre du Cours</span>
                <span className="text-[10px] text-accent-blue font-normal">Requis</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ex: Structure & Fonctionnement de la Membrane Plasmique"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-surface-elevated border border-border text-sm text-zinc-100 focus:border-accent-blue focus:outline-none transition"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 mb-1.5 block">Format</label>
              <div className="flex rounded-xl bg-surface-elevated border border-border p-1">
                {(['CM', 'TD', 'TP', 'Synthese'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={cn(
                      'flex-1 py-1 rounded-lg text-xs font-bold transition',
                      kind === k
                        ? 'bg-accent-blue text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Subject & Chapter Linkage */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-zinc-300 mb-1.5 block">
                Matière / Discipline
              </label>
              <select
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setChapterId('');
                }}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-elevated border border-border text-xs text-zinc-100 focus:border-accent-blue focus:outline-none"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 mb-1.5 block">
                Chapitre Associé
              </label>
              <select
                value={chapterId}
                onChange={(e) => setChapterId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-elevated border border-border text-xs text-zinc-100 focus:border-accent-blue focus:outline-none"
              >
                <option value="">-- Sans chapitre spécifique --</option>
                {availableChapters.map((chap) => (
                  <option key={chap.id} value={chap.id}>
                    {chap.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 mb-1.5 block">
                Date de la séance
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-zinc-100 focus:border-accent-blue focus:outline-none"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 mb-1.5 block">Mots-clés / Tags</label>
            <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-surface-elevated border border-border">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-lg bg-surface border border-border text-xs font-mono text-zinc-200 flex items-center gap-1.5"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-zinc-500 hover:text-red-400"
                  >
                    &times;
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Ajouter un tag..."
                className="flex-1 min-w-[120px] bg-transparent text-xs text-zinc-200 focus:outline-none px-1"
              />
            </div>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
              <span>Supports de cours & Schémas (Glisser-Déposer)</span>
              <span className="text-[10px] text-zinc-400">PDF, Audio, Images (jusqu'à 50 Mo)</span>
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition text-center group',
                isDraggingOver
                  ? 'border-accent-blue bg-accent-blue/10 scale-[0.99]'
                  : 'border-border hover:border-zinc-500 bg-surface-elevated/60 hover:bg-surface-elevated'
              )}
            >
              <Upload className="w-8 h-8 text-zinc-400 group-hover:text-accent-blue mb-2 transition" />
              <div className="text-xs font-semibold text-zinc-200">
                Glissez-déposez vos fichiers ici, ou cliquez pour parcourir
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                Polycopiés PDF, enregistrements audio amphi, diapos PowerPoint
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
                className="hidden"
              />
            </div>

            {/* Uploaded File List */}
            {attachedFiles.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {attachedFiles.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-surface-elevated border border-border flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3 truncate">
                      {item.file.type.includes('image') ? (
                        <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : item.file.type.includes('audio') ? (
                        <Music className="w-4 h-4 text-purple-400 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                      )}
                      <div className="truncate">
                        <span className="font-semibold text-zinc-200 truncate">
                          {item.file.name}
                        </span>
                        <span className="text-zinc-500 ml-2 font-mono">
                          {formatBytes(item.file.size)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFile(item.id)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes / Plan */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 mb-1.5 block">
              Notes & Plan de Séance
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Grandes parties abordées, rappels pour l'examen..."
              className="w-full p-3.5 rounded-2xl bg-surface-elevated border border-border text-xs text-zinc-200 focus:border-accent-blue focus:outline-none resize-none transition leading-relaxed"
            />
          </div>

          {/* Hidden submit trigger */}
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
            className="px-6 py-2.5 rounded-xl bg-accent-blue hover:bg-blue-600 text-white text-xs font-bold shadow-md shadow-accent-blue/20 flex items-center gap-2 transition"
          >
            <Save className="w-4 h-4" />
            Enregistrer le Cours
          </button>
        </footer>
      </div>
    </div>
  );
};
