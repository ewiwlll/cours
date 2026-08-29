import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Zap,
  Plus,
  Trash2,
  Move,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Upload,
  Layers,
  Palette,
  Check,
  FileImage,
  ArrowRight,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import type { ImageOcclusionDiagram, OcclusionMask, Card } from '../../lib/types';
import { BIO_DIAGRAMS } from '../../lib/diagrams';
import { cn, playAudioFeedback } from '../../lib/utils';

const MASK_COLORS = [
  { name: 'Ambre', hex: '#f59e0b', bg: 'bg-amber-500', border: 'border-amber-500' },
  { name: 'Émeraude', hex: '#10b981', bg: 'bg-emerald-500', border: 'border-emerald-500' },
  { name: 'Cyan', hex: '#06b6d4', bg: 'bg-cyan-500', border: 'border-cyan-500' },
  { name: 'Bleu', hex: '#3b82f6', bg: 'bg-blue-500', border: 'border-blue-500' },
  { name: 'Violet', hex: '#a855f7', bg: 'bg-purple-500', border: 'border-purple-500' },
  { name: 'Rose', hex: '#ec4899', bg: 'bg-pink-500', border: 'border-pink-500' },
  { name: 'Rouge', hex: '#ef4444', bg: 'bg-red-500', border: 'border-red-500' },
];

interface ImageOcclusionStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDiagramId?: string;
  onExportAnki?: (cards: Card[], diagram: ImageOcclusionDiagram) => void;
}

export const ImageOcclusionStudioModal: React.FC<ImageOcclusionStudioModalProps> = ({
  isOpen,
  onClose,
  initialDiagramId = 'eukaryotic-cell',
  onExportAnki,
}) => {
  const [selectedDiagram, setSelectedDiagram] = useState<ImageOcclusionDiagram>(() => {
    return BIO_DIAGRAMS.find((d) => d.id === initialDiagramId) || BIO_DIAGRAMS[0];
  });

  const [masks, setMasks] = useState<OcclusionMask[]>(() => selectedDiagram.masks || []);
  const [selectedMaskId, setSelectedMaskId] = useState<string | null>(null);
  const [activeColor, setActiveColor] = useState<string>(MASK_COLORS[0].hex);
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(true);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [revealedMaskIds, setRevealedMaskIds] = useState<Set<string>>(new Set());

  // Custom uploaded image
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);

  // Zoom & Pan
  const [zoom, setZoom] = useState<number>(1);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [generatedCardsCount, setGeneratedCardsCount] = useState<number>(0);

  // Drawing state
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDraw, setCurrentDraw] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Switch diagram
  const handleSelectDiagram = (diagram: ImageOcclusionDiagram) => {
    setSelectedDiagram(diagram);
    setMasks(diagram.masks);
    setSelectedMaskId(null);
    setCustomImageUrl(null);
    setRevealedMaskIds(new Set());
    setZoom(1);
    playAudioFeedback('click');
  };

  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setCustomImageUrl(result);
        const customDiag: ImageOcclusionDiagram = {
          id: `custom-${Date.now()}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          category: 'Image Personnalisée',
          description: 'Schéma importé par l\'utilisateur',
          viewBox: '0 0 800 600',
          svgContent: '',
          masks: [],
        };
        setSelectedDiagram(customDiag);
        setMasks([]);
        setSelectedMaskId(null);
        playAudioFeedback('success');
      };
      reader.readAsDataURL(file);
    }
  };

  const selectedMask = masks.find((m) => m.id === selectedMaskId);

  // Coordinate calculations (0 to 100 percentage inside container)
  const getRelativeCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPreviewMode || !isDrawingMode) return;
    // Don't start drawing if clicking directly on an existing mask
    if ((e.target as HTMLElement).closest('.occlusion-mask-handle')) return;

    const coords = getRelativeCoords(e);
    setIsDrawing(true);
    setDrawStart(coords);
    setCurrentDraw({ x: coords.x, y: coords.y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart) return;
    const coords = getRelativeCoords(e);

    const x = Math.min(drawStart.x, coords.x);
    const y = Math.min(drawStart.y, coords.y);
    const w = Math.abs(coords.x - drawStart.x);
    const h = Math.abs(coords.y - drawStart.y);

    setCurrentDraw({ x, y, w, h });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentDraw) return;
    setIsDrawing(false);

    // Filter tiny accidental clicks (width & height > 2%)
    if (currentDraw.w > 2 && currentDraw.h > 2) {
      const newMask: OcclusionMask = {
        id: `mask-${Date.now()}`,
        x: Math.round(currentDraw.x * 10) / 10,
        y: Math.round(currentDraw.y * 10) / 10,
        width: Math.round(currentDraw.w * 10) / 10,
        height: Math.round(currentDraw.h * 10) / 10,
        solution: `Élément #${masks.length + 1}`,
        hint: '',
        color: activeColor,
        order: masks.length + 1,
      };
      setMasks((prev) => [...prev, newMask]);
      setSelectedMaskId(newMask.id);
      playAudioFeedback('click');
    }

    setDrawStart(null);
    setCurrentDraw(null);
  };

  const handleUpdateMask = (id: string, updates: Partial<OcclusionMask>) => {
    setMasks((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const handleDeleteMask = (id: string) => {
    setMasks((prev) => prev.filter((m) => m.id !== id));
    if (selectedMaskId === id) setSelectedMaskId(null);
    playAudioFeedback('click');
  };

  const toggleRevealMask = (id: string) => {
    setRevealedMaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    playAudioFeedback('flip');
  };

  // Convert to Anki cards format
  const handleExportToAnki = () => {
    if (masks.length === 0) {
      alert('Veuillez ajouter au moins un masque pour créer des cartes.');
      return;
    }

    const generatedCards: Card[] = masks.map((mask, idx) => ({
      id: `anki-occ-${selectedDiagram.id}-${mask.id}-${Date.now()}`,
      question: `Identifier la structure masquée [${mask.hint || `Masque #${idx + 1}`}] sur le schéma : ${selectedDiagram.title}`,
      answer: mask.solution,
      kind: 'image-occlusion',
      explanation: `${selectedDiagram.description}. ${mask.hint ? `Indice: ${mask.hint}` : ''}`,
      keywords: [mask.solution, selectedDiagram.category],
      subjectTitle: selectedDiagram.category,
      chapterTitle: selectedDiagram.title,
    }));

    setGeneratedCardsCount(generatedCards.length);
    setIsSuccessModalOpen(true);
    playAudioFeedback('success');

    onExportAnki?.(generatedCards, { ...selectedDiagram, masks });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-zinc-100 selection:bg-accent-blue/30 overflow-hidden animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <header className="h-16 px-6 border-b border-border bg-surface flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-accent-orange/10 border border-accent-orange/20 flex items-center justify-center text-accent-orange font-bold shadow-inner">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-zinc-100">Studio Image Occlusion</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple border border-accent-purple/20 font-medium">
                Anki v5.0 Ready
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Tracez des masques au clic-glisser pour générer des paquets de mémorisation active
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={cn(
              'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition border',
              isPreviewMode
                ? 'bg-accent-green/20 text-accent-green border-accent-green/40 shadow-sm'
                : 'bg-surface-elevated text-zinc-300 border-border hover:bg-surface-muted'
            )}
          >
            {isPreviewMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {isPreviewMode ? 'Mode Test Actif' : 'Aperçu Test'}
          </button>

          <button
            onClick={handleExportToAnki}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-accent-blue to-accent-purple hover:from-blue-600 hover:to-purple-600 text-white font-semibold text-xs shadow-lg shadow-accent-blue/20 flex items-center gap-2 transition active:scale-95"
          >
            <Zap className="w-4 h-4" />
            ⚡ Créer cartes Anki ({masks.length})
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-surface-elevated border border-transparent hover:border-border transition"
            title="Fermer le studio"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Diagram Selector Bar */}
        <aside className="w-64 border-r border-border bg-surface/60 flex flex-col shrink-0 p-4 gap-4 overflow-y-auto">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5 flex items-center justify-between">
              <span>Modèles Intégrés</span>
              <Sparkles className="w-3.5 h-3.5 text-accent-orange" />
            </div>
            <div className="flex flex-col gap-2">
              {BIO_DIAGRAMS.map((diag) => {
                const isSelected = selectedDiagram.id === diag.id && !customImageUrl;
                return (
                  <button
                    key={diag.id}
                    onClick={() => handleSelectDiagram(diag)}
                    className={cn(
                      'text-left p-3 rounded-xl border text-xs transition flex flex-col gap-1',
                      isSelected
                        ? 'bg-accent-blue/15 border-accent-blue text-white shadow-md'
                        : 'bg-surface-elevated border-border text-zinc-300 hover:border-zinc-600 hover:bg-surface-muted'
                    )}
                  >
                    <div className="font-semibold text-zinc-100 flex items-center justify-between">
                      <span>{diag.title}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-accent-blue" />}
                    </div>
                    <div className="text-[11px] text-zinc-400">{diag.category}</div>
                    <div className="text-[10px] text-accent-blue font-mono mt-1">
                      {diag.masks.length} masques prédéfinis
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upload Custom Image */}
          <div className="pt-2 border-t border-border">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Importer Image
            </div>
            <label className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-border hover:border-accent-blue bg-surface-elevated hover:bg-surface-muted cursor-pointer transition text-center group">
              <Upload className="w-6 h-6 text-zinc-400 group-hover:text-accent-blue mb-2 transition" />
              <span className="text-xs font-medium text-zinc-200">Choisir un fichier</span>
              <span className="text-[10px] text-zinc-500 mt-0.5">PNG, JPG, SVG jusqu'à 20Mo</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleCustomImageUpload}
                className="hidden"
              />
            </label>
          </div>
        </aside>

        {/* Center Canvas Area */}
        <main className="flex-1 flex flex-col bg-background/50 relative overflow-hidden">
          {/* Floating Canvas Toolbar */}
          <div className="absolute top-4 left-6 z-20 flex items-center gap-2 p-1.5 rounded-2xl bg-surface-elevated/90 backdrop-blur-md border border-border shadow-xl">
            {/* Mode selection */}
            <button
              onClick={() => setIsDrawingMode(true)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition',
                isDrawingMode
                  ? 'bg-accent-blue text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface'
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              Tracer Masque
            </button>
            <button
              onClick={() => setIsDrawingMode(false)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition',
                !isDrawingMode
                  ? 'bg-accent-blue text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface'
              )}
            >
              <Move className="w-3.5 h-3.5" />
              Sélectionner
            </button>

            <div className="w-px h-4 bg-border my-auto mx-1" />

            {/* Mask color swatches */}
            <div className="flex items-center gap-1 px-1">
              {MASK_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => {
                    setActiveColor(c.hex);
                    if (selectedMaskId) {
                      handleUpdateMask(selectedMaskId, { color: c.hex });
                    }
                  }}
                  className={cn(
                    'w-5 h-5 rounded-full transition transform',
                    c.bg,
                    activeColor === c.hex
                      ? 'ring-2 ring-white scale-110 shadow-sm'
                      : 'opacity-70 hover:opacity-100'
                  )}
                  title={c.name}
                />
              ))}
            </div>

            <div className="w-px h-4 bg-border my-auto mx-1" />

            {/* Zoom Controls */}
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-surface transition"
              title="Zoom +"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-zinc-400 px-1">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-surface transition"
              title="Zoom -"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-surface transition"
              title="Réinitialiser zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Diagram Canvas Viewport */}
          <div className="flex-1 flex items-center justify-center p-8 overflow-auto select-none">
            <div
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
              className="transition-transform duration-150 relative"
            >
              {/* Image / SVG Container */}
              <div
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className={cn(
                  'relative w-[780px] h-[580px] rounded-2xl bg-surface-elevated border border-border shadow-2xl overflow-hidden',
                  isDrawingMode ? 'cursor-crosshair' : 'cursor-default'
                )}
              >
                {/* SVG Vector Render */}
                {customImageUrl ? (
                  <img
                    src={customImageUrl}
                    alt={selectedDiagram.title}
                    className="w-full h-full object-contain pointer-events-none"
                  />
                ) : (
                  <svg
                    viewBox={selectedDiagram.viewBox}
                    className="w-full h-full pointer-events-none select-none"
                    dangerouslySetInnerHTML={{ __html: selectedDiagram.svgContent }}
                  />
                )}

                {/* Existing Occlusion Masks */}
                {masks.map((mask, idx) => {
                  const isSelected = selectedMaskId === mask.id;
                  const isRevealed = revealedMaskIds.has(mask.id);

                  if (isPreviewMode && isRevealed) {
                    // Revealed in preview
                    return (
                      <div
                        key={mask.id}
                        onClick={() => toggleRevealMask(mask.id)}
                        style={{
                          left: `${mask.x}%`,
                          top: `${mask.y}%`,
                          width: `${mask.width}%`,
                          height: `${mask.height}%`,
                        }}
                        className="absolute rounded-lg border-2 border-dashed border-accent-green bg-accent-green/20 backdrop-blur-xs flex items-center justify-center p-1 cursor-pointer transition hover:bg-accent-green/30"
                      >
                        <span className="text-[11px] font-bold text-emerald-300 truncate text-center">
                          {mask.solution}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={mask.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isPreviewMode) {
                          toggleRevealMask(mask.id);
                        } else {
                          setSelectedMaskId(mask.id);
                          playAudioFeedback('click');
                        }
                      }}
                      style={{
                        left: `${mask.x}%`,
                        top: `${mask.y}%`,
                        width: `${mask.width}%`,
                        height: `${mask.height}%`,
                        backgroundColor: mask.color || activeColor,
                      }}
                      className={cn(
                        'absolute rounded-lg shadow-lg flex items-center justify-center p-1 cursor-pointer transition',
                        'occlusion-mask-handle',
                        isSelected && !isPreviewMode
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-background scale-[1.02] z-30'
                          : 'opacity-95 hover:opacity-100 z-20',
                        isPreviewMode ? 'hover:scale-[1.02] active:scale-95' : ''
                      )}
                    >
                      <div className="flex items-center gap-1 text-white font-bold text-xs truncate drop-shadow-md">
                        <span className="w-4 h-4 rounded-full bg-black/30 flex items-center justify-center text-[10px] font-mono shrink-0">
                          {idx + 1}
                        </span>
                        {isPreviewMode ? (
                          <span className="text-[10px] opacity-90">{mask.hint || 'Cliquer'}</span>
                        ) : (
                          <span className="truncate text-[11px]">{mask.solution}</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Active drawing rubber-band preview */}
                {isDrawing && currentDraw && (
                  <div
                    style={{
                      left: `${currentDraw.x}%`,
                      top: `${currentDraw.y}%`,
                      width: `${currentDraw.w}%`,
                      height: `${currentDraw.h}%`,
                      backgroundColor: activeColor,
                    }}
                    className="absolute rounded-lg border-2 border-white opacity-70 pointer-events-none z-40 shadow-2xl"
                  />
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Right Configuration Sidebar */}
        <aside className="w-80 border-l border-border bg-surface/70 flex flex-col shrink-0 p-5 gap-5 overflow-y-auto">
          {selectedMask ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full shadow-sm"
                    style={{ backgroundColor: selectedMask.color || activeColor }}
                  />
                  <h3 className="text-sm font-bold text-zinc-100">
                    Masque #{masks.findIndex((m) => m.id === selectedMask.id) + 1}
                  </h3>
                </div>
                <button
                  onClick={() => handleDeleteMask(selectedMask.id)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition"
                  title="Supprimer ce masque"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Solution keyword input */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                  <span>Mot-clé Solution (Réponse)</span>
                  <span className="text-[10px] text-accent-blue font-normal">Obligatoire</span>
                </label>
                <input
                  type="text"
                  value={selectedMask.solution}
                  onChange={(e) => handleUpdateMask(selectedMask.id, { solution: e.target.value })}
                  placeholder="ex: Mitochondrie, Cα, Citrate..."
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border focus:border-accent-blue text-sm text-zinc-100 focus:outline-none transition"
                />
              </div>

              {/* Hint input */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 mb-1.5 block">
                  Indice optionnel
                </label>
                <input
                  type="text"
                  value={selectedMask.hint || ''}
                  onChange={(e) => handleUpdateMask(selectedMask.id, { hint: e.target.value })}
                  placeholder="ex: Centrale énergétique cellulaire..."
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border focus:border-accent-blue text-sm text-zinc-100 focus:outline-none transition"
                />
              </div>

              {/* Mask Color Selector */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 mb-2 block">
                  Couleur du masque
                </label>
                <div className="flex items-center gap-2">
                  {MASK_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => handleUpdateMask(selectedMask.id, { color: c.hex })}
                      className={cn(
                        'w-7 h-7 rounded-xl transition transform flex items-center justify-center',
                        c.bg,
                        selectedMask.color === c.hex
                          ? 'ring-2 ring-white scale-110 shadow-md'
                          : 'opacity-70 hover:opacity-100'
                      )}
                    >
                      {selectedMask.color === c.hex && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dimension Metrics */}
              <div className="p-3 rounded-xl bg-surface-elevated border border-border text-xs text-zinc-400 font-mono flex flex-col gap-1">
                <div className="flex justify-between">
                  <span>Position X/Y :</span>
                  <span className="text-zinc-200">
                    {selectedMask.x}% , {selectedMask.y}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Taille L/H :</span>
                  <span className="text-zinc-200">
                    {selectedMask.width}% &times; {selectedMask.height}%
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-surface-elevated/40 border border-dashed border-border text-zinc-400">
              <Layers className="w-8 h-8 text-zinc-500 mb-2" />
              <div className="text-sm font-semibold text-zinc-300">Aucun masque sélectionné</div>
              <p className="text-xs text-zinc-500 mt-1">
                Cliquez sur un masque existant ou tracez-en un nouveau sur l'image.
              </p>
            </div>
          )}

          {/* List of all masks */}
          <div className="mt-auto pt-4 border-t border-border">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5 flex items-center justify-between">
              <span>Tous les masques ({masks.length})</span>
            </div>
            <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5 pr-1">
              {masks.map((mask, idx) => {
                const isSelected = selectedMaskId === mask.id;
                return (
                  <button
                    key={mask.id}
                    onClick={() => setSelectedMaskId(mask.id)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between border transition',
                      isSelected
                        ? 'bg-accent-blue/15 border-accent-blue text-white font-medium'
                        : 'bg-surface-elevated border-border text-zinc-300 hover:bg-surface-muted'
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: mask.color || activeColor }}
                      />
                      <span className="font-mono text-zinc-400">#{idx + 1}</span>
                      <span className="truncate">{mask.solution}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMask(mask.id);
                      }}
                      className="text-zinc-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* Success Modal Confirmation */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="max-w-md w-full p-6 rounded-3xl bg-surface-elevated border border-border shadow-2xl text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center text-accent-green">
              <Zap className="w-8 h-8 animate-pulse" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Cartes Anki Générées !</h3>
            <p className="text-xs text-zinc-300 mb-6">
              {generatedCardsCount} cartes d'occlusion d'image ont été créées avec succès pour le
              deck <strong className="text-white">"{selectedDiagram.title}"</strong>.
            </p>
            <button
              onClick={() => {
                setIsSuccessModalOpen(false);
                onClose();
              }}
              className="w-full py-3 rounded-xl bg-accent-blue hover:bg-blue-600 text-white font-semibold text-sm shadow-lg shadow-accent-blue/20 transition"
            >
              Parfait, aller réviser
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
