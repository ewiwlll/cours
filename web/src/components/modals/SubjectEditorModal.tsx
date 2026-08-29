import React, { useState } from 'react';
import {
  X,
  GraduationCap,
  Plus,
  Sparkles,
  Search,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  FolderTree,
  Zap,
} from 'lucide-react';
import { createSubject, generateCurriculum, importCurriculum } from '../../lib/api';
import { useStore } from '../../lib/store';
import type { PriorityLevel, CurriculumAnalysisResult } from '../../lib/types';

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
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');

  // Manual Creation State
  const [title, setTitle] = useState('');
  const [ects, setEcts] = useState<number>(6);
  const [priority, setPriority] = useState<PriorityLevel>('A');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI Curriculum Generator State
  const [aiQuery, setAiQuery] = useState('');
  const [isSearchingAi, setIsSearchingAi] = useState(false);
  const [aiCurriculum, setAiCurriculum] = useState<CurriculumAnalysisResult | null>(null);
  const [isImportingCurriculum, setIsImportingCurriculum] = useState(false);

  if (!isOpen) return null;

  const handleManualSubmit = async (e: React.FormEvent) => {
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

  const handleSearchCurriculum = async (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;

    setIsSearchingAi(true);
    setError(null);
    try {
      const result = await generateCurriculum(q);
      if (result && result.subjects && result.subjects.length > 0) {
        setAiCurriculum({
          ...result,
          subjects: result.subjects.map((s) => ({ ...s, selected: true })),
        });
      } else {
        setError("Aucune maquette trouvée pour cette formation. Essayez avec un intitulé plus précis (ex: 'L1 Droit Panthéon-Sorbonne', 'PASS Médecine').");
      }
    } catch (err: any) {
      setError(err?.message || "Erreur de recherche du cursus");
    } finally {
      setIsSearchingAi(false);
    }
  };

  const handleToggleSubjectSelection = (index: number) => {
    if (!aiCurriculum) return;
    const updated = [...aiCurriculum.subjects];
    updated[index].selected = !updated[index].selected;
    setAiCurriculum({ ...aiCurriculum, subjects: updated });
  };

  const handleImportCurriculum = async () => {
    if (!aiCurriculum) return;
    const selected = aiCurriculum.subjects.filter((s) => s.selected !== false);
    if (!selected.length) {
      setError("Veuillez sélectionner au moins une matière à importer.");
      return;
    }

    setIsImportingCurriculum(true);
    setError(null);
    try {
      const res = await importCurriculum(selected);
      if (res && res.success) {
        await refreshData();
        setView('subjects');
        onClose();
      } else {
        setError("Impossible d'importer le cursus.");
      }
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'import");
    } finally {
      setIsImportingCurriculum(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-xl bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden animate-scaleUp max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-border/80 flex items-center justify-between bg-surface-elevated/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Ajouter des matières</h2>
              <p className="text-xs text-zinc-400">Configurez vos matières ou importez votre cursus universitaire</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-surface-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-border/80 bg-surface px-6 pt-2 shrink-0">
          <button
            onClick={() => setActiveTab('manual')}
            className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 mr-6 ${
              activeTab === 'manual' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookOpen className={`w-4 h-4 ${activeTab === 'manual' ? 'text-blue-400' : 'text-zinc-500'}`} />
            <span>Création manuelle</span>
            {activeTab === 'manual' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'ai' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className={`w-4 h-4 ${activeTab === 'ai' ? 'text-purple-400' : 'text-zinc-500'}`} />
            <span>🪄 Importer mon Cursus avec l'IA</span>
            {activeTab === 'ai' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* ---------------- ONGLET 1 : CRÉATION MANUELLE AVEC EXPLICATIONS CLAIRES ---------------- */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-5">
              {/* 1. Titre de la Matière */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-200">
                  Nom de la matière <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Droit constitutionnel, Pharmacologie, Algorithmique, Microéconomie..."
                  className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
                  autoFocus
                />
              </div>

              {/* 2. Crédits ECTS avec Explication Pédagogique */}
              <div className="space-y-2 p-4 rounded-2xl bg-surface-elevated/40 border border-border/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    <span>Crédits ECTS</span>
                    <span className="text-[11px] font-normal text-blue-400">(Coefficient universitaire)</span>
                  </label>
                  <span className="text-xs font-bold text-white px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30">
                    {ects} ECTS
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Les crédits ECTS représentent le poids de la matière dans votre semestre.
                </p>
                <div className="flex gap-2 pt-1">
                  {[
                    { val: 3, label: '3 ECTS (Standard / Option)' },
                    { val: 6, label: '6 ECTS (Majeure / Gros coeff)' },
                    { val: 8, label: '8 ECTS (Bloc central)' },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setEcts(preset.val)}
                      className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-semibold border transition-all ${
                        ects === preset.val
                          ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 shadow-xs'
                          : 'bg-background text-zinc-400 hover:text-zinc-200 border-border'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Priorité d'examen avec Explication FSRS */}
              <div className="space-y-2 p-4 rounded-2xl bg-surface-elevated/40 border border-border/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    <span>Priorité d'examen FSRS-5</span>
                    <span className="text-[11px] font-normal text-purple-400">(Répétition espacée)</span>
                  </label>
                  <span className="text-xs font-bold text-white px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30">
                    Niveau {priority}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Calibre l'algorithme scientifique FSRS-5 pour fixer la fréquence idéale des révisions selon vos enjeux d'examen :
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPriority('A')}
                    className={`p-2.5 rounded-xl text-left border transition-all ${
                      priority === 'A'
                        ? 'bg-rose-500/15 border-rose-500/50 text-white shadow-xs'
                        : 'bg-background text-zinc-400 hover:text-zinc-200 border-border'
                    }`}
                  >
                    <div className="text-xs font-bold text-rose-400 flex items-center justify-between">
                      <span>Priorité A</span>
                      <span className="text-[10px] bg-rose-500/20 px-1.5 rounded">92%</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">Gros coefficient, révisions quotidiennes prioritaires.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPriority('B')}
                    className={`p-2.5 rounded-xl text-left border transition-all ${
                      priority === 'B'
                        ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-xs'
                        : 'bg-background text-zinc-400 hover:text-zinc-200 border-border'
                    }`}
                  >
                    <div className="text-xs font-bold text-amber-400 flex items-center justify-between">
                      <span>Priorité B</span>
                      <span className="text-[10px] bg-amber-500/20 px-1.5 rounded">88%</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">Matière standard, rythme régulier équilibré.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPriority('C')}
                    className={`p-2.5 rounded-xl text-left border transition-all ${
                      priority === 'C'
                        ? 'bg-blue-500/15 border-blue-500/50 text-white shadow-xs'
                        : 'bg-background text-zinc-400 hover:text-zinc-200 border-border'
                    }`}
                  >
                    <div className="text-xs font-bold text-blue-400 flex items-center justify-between">
                      <span>Priorité C</span>
                      <span className="text-[10px] bg-blue-500/20 px-1.5 rounded">85%</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">Option ou mineure, rythme espacé sans surcharge.</p>
                  </button>
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
          )}

          {/* ---------------- ONGLET 2 : MAGIC CURRICULUM AI IMPORT ---------------- */}
          {activeTab === 'ai' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-1.5">
                <h4 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>Assistant Antigravity Cursus</span>
                </h4>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Tapez le nom de votre formation ou université. L'IA extrait la maquette officielle du semestre avec les crédits ECTS réels, les priorités calculées et les chapitres fondamentaux.
                </p>
              </div>

              {/* Barre de recherche de Cursus */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchCurriculum(aiQuery);
                    }
                  }}
                  placeholder="Ex: Licence 1 Droit Panthéon-Sorbonne, PASS Médecine, L2 Informatique..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => handleSearchCurriculum(aiQuery)}
                  disabled={isSearchingAi || !aiQuery.trim()}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 shrink-0"
                >
                  {isSearchingAi ? (
                    <span>Recherche...</span>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>Générer</span>
                    </>
                  )}
                </button>
              </div>

              {/* Suggestions rapides en 1 clic */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-zinc-500 mr-1">Filières populaires :</span>
                {[
                  { label: '🎒 Terminale Spécialités', q: 'Terminale Maths Physique' },
                  { label: '📖 1ère Bac Français', q: 'Première Bac Français' },
                  { label: '⚖️ L1 Droit', q: 'Licence 1 Droit' },
                  { label: '🩺 PASS Santé', q: 'PASS Médecine' },
                  { label: '💻 L1 Informatique', q: 'Licence 1 Informatique' },
                  { label: '📈 L1 Éco-Gestion', q: 'Licence 1 Économie-Gestion' },
                ].map((sugg) => (
                  <button
                    key={sugg.label}
                    type="button"
                    onClick={() => {
                      setAiQuery(sugg.q);
                      handleSearchCurriculum(sugg.q);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-surface-elevated hover:bg-surface-muted text-zinc-300 hover:text-white border border-border transition-all"
                  >
                    {sugg.label}
                  </button>
                ))}
              </div>

              {/* SÉLECTEUR INTERACTIF LYCÉE PERSONNALISÉ */}
              <div className="p-4 rounded-2xl bg-surface-elevated/40 border border-border/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>🎒 Personnaliser un cursus Lycée (Baccalauréat)</span>
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Choisissez vos 2 spécialités de Terminale, votre LV2 (Espagnol, Allemand...) et vos options pour générer votre classeur exact du Bac.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSearchCurriculum('Terminale Maths Physique Espagnol')}
                    className="p-2.5 rounded-xl text-left bg-background hover:bg-surface border border-border hover:border-purple-500/40 transition-all group"
                  >
                    <div className="text-xs font-bold text-white group-hover:text-purple-300">
                      Terminale : Maths + Physique + Espagnol LV2
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Spécialités Coeff 16 + Philo + Tronc commun</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSearchCurriculum('Terminale Maths SVT Espagnol')}
                    className="p-2.5 rounded-xl text-left bg-background hover:bg-surface border border-border hover:border-purple-500/40 transition-all group"
                  >
                    <div className="text-xs font-bold text-white group-hover:text-purple-300">
                      Terminale : Maths + SVT + Espagnol LV2
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Profil SVT / Médecine / BCPST</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSearchCurriculum('Terminale SES Maths Espagnol')}
                    className="p-2.5 rounded-xl text-left bg-background hover:bg-surface border border-border hover:border-purple-500/40 transition-all group"
                  >
                    <div className="text-xs font-bold text-white group-hover:text-purple-300">
                      Terminale : SES + Maths / HGGSP
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Profil Économie / Sciences Po / Droit</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSearchCurriculum('Première Bac Français')}
                    className="p-2.5 rounded-xl text-left bg-background hover:bg-surface border border-border hover:border-purple-500/40 transition-all group"
                  >
                    <div className="text-xs font-bold text-white group-hover:text-purple-300">
                      Première Générale : Épreuves de Français
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Bac de Français Coeff 10 (Écrit + Oral) + 3 Spés</p>
                  </button>
                </div>
              </div>

              {/* Aperçu du Cursus Détecté */}
              {aiCurriculum && (
                <div className="space-y-4 pt-2 border-t border-border/80 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-2">
                        <span>🎓 {aiCurriculum.program}</span>
                        {aiCurriculum.semester && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
                            {aiCurriculum.semester}
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-zinc-400">
                        {aiCurriculum.subjects.length} matières configurées. Vous pouvez cocher/décocher ou affiner les chapitres ci-dessous :
                      </p>
                    </div>
                  </div>

                  {/* Questions de personnalisation dynamiques si l'IA en a détecté */}
                  {aiCurriculum.customizationQuestions && aiCurriculum.customizationQuestions.length > 0 && (
                    <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/25 space-y-3">
                      <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Options & Spécialités à arbitrer</span>
                      </div>

                      <div className="space-y-3">
                        {aiCurriculum.customizationQuestions.map((q) => (
                          <div key={q.id} className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-zinc-300 block">
                              {q.question}
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {q.options.map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => {
                                    // Replace or add subject in curriculum
                                    const exists = aiCurriculum.subjects.some((s) => s.title.toLowerCase() === opt.title.toLowerCase());
                                    if (!exists) {
                                      setAiCurriculum({
                                        ...aiCurriculum,
                                        subjects: [
                                          ...aiCurriculum.subjects,
                                          {
                                            title: opt.title,
                                            category: opt.category,
                                            ects: opt.ects,
                                            priority: opt.priority,
                                            semester: 'S1',
                                            chapters: opt.chapters,
                                            selected: true,
                                          },
                                        ],
                                      });
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-background hover:bg-surface-elevated text-zinc-300 hover:text-white border border-border transition-all"
                                >
                                  + {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {aiCurriculum.subjects.map((subj, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleToggleSubjectSelection(idx)}
                        className={`p-3 rounded-xl border cursor-pointer select-none transition-all flex items-start justify-between gap-3 ${
                          subj.selected !== false
                            ? 'bg-surface-elevated/80 border-purple-500/40 text-white'
                            : 'bg-background/50 border-border text-zinc-500 opacity-60'
                        }`}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white">{subj.title}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300">
                              {subj.ects} ECTS
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300">
                              Priorité {subj.priority}
                            </span>
                          </div>
                          {subj.chapters && subj.chapters.length > 0 && (
                            <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 truncate">
                              <FolderTree className="w-3 h-3 text-zinc-500 shrink-0" />
                              <span>{subj.chapters.join(' • ')}</span>
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 mt-0.5">
                          <div
                            className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] ${
                              subj.selected !== false
                                ? 'bg-purple-600 border-purple-500 text-white'
                                : 'border-zinc-700 bg-background'
                            }`}
                          >
                            {subj.selected !== false && '✓'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bouton d'import global */}
                  <div className="pt-3 flex items-center justify-end gap-3 border-t border-border/80">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-muted text-zinc-300 text-xs font-semibold transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleImportCurriculum}
                      disabled={isImportingCurriculum}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                    >
                      {isImportingCurriculum ? (
                        <span>Importation en cours...</span>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>
                            Importer {aiCurriculum.subjects.filter((s) => s.selected !== false).length} matières et leurs chapitres
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
