import React from 'react';
import {
  X,
  Mic,
  BrainCircuit,
  Zap,
  Layers,
  Sparkles,
  Keyboard,
  Lock,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAction?: (action: string) => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({
  isOpen,
  onClose,
  onAction,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Le Contrat Méthodologique Cours</h2>
              <p className="text-xs text-zinc-400">La méthode scientifique en 6 étapes pour réussir tes partiels sans stress</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-surface-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 6 Steps Methodology */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Step 1 */}
          <div className="p-4 rounded-xl bg-surface-elevated border border-border/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center">
                1
              </span>
              <Mic className="w-4 h-4 text-blue-400" />
            </div>
            <h3 className="text-xs font-bold text-white">📱 1. Capture en amphi</h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Sur ton Pixel 8 ou ton Mac : micro en 1 clic, balises rapides (<em>Important, Piège, Définition</em>) et photos du tableau synchronisées.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-xl bg-surface-elevated border border-border/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center">
                2
              </span>
              <BrainCircuit className="w-4 h-4 text-indigo-400" />
            </div>
            <h3 className="text-xs font-bold text-white">🧠 2. Antigravity compile</h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Whisper Metal transcrit en local (0 coût). Antigravity extrait les concepts atomiques, les analogies Feynman et les tableaux comparatifs.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-xl bg-surface-elevated border border-border/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center">
                3
              </span>
              <Lock className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-xs font-bold text-white">🔒 3. Cours verrouillé</h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Pour briser l'illusion de facilité de la simple relecture passive, la fiche reste verrouillée jusqu'à ta première restitution.
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-4 rounded-xl bg-surface-elevated border border-border/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 font-bold text-xs flex items-center justify-center">
                4
              </span>
              <Mic className="w-4 h-4 text-orange-400" />
            </div>
            <h3 className="text-xs font-bold text-white">🎙️ 4. Rappel à froid (1-2 min)</h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Tu dictes ou saisis tout ce dont tu te souviens sans regarder ton cours. C'est cet effort de rappel qui ancre la mémoire.
            </p>
          </div>

          {/* Step 5 */}
          <div className="p-4 rounded-xl bg-surface-elevated border border-border/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center">
                5
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <h3 className="text-xs font-bold text-white">📊 5. Diagnostic & Fiche</h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              La fiche se débloque. Les notions oubliées sont immédiatement marquées comme prioritaires dans ton planning du lendemain.
            </p>
          </div>

          {/* Step 6 */}
          <div className="p-4 rounded-xl bg-surface-elevated border border-border/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 font-bold text-xs flex items-center justify-center">
                6
              </span>
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
            <h3 className="text-xs font-bold text-white">⚡ 6. FSRS quotidien sans chrono</h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Chaque jour, écoule ta pile de cartes dues du jour à ton rythme. Zéro chrono stressant, juste de la répétition espacée optimale.
            </p>
          </div>
        </div>

        {/* Feature Explanations */}
        <div className="space-y-3 pt-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Fonctionnalités Clés & Confort d'Apprentissage
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-surface-muted/50 border border-border-subtle flex gap-3">
              <BrainCircuit className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-white">🌳 Mémoire des Questions & Arbre Vivant</h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Quand tu bloques sur une notion, Antigravity se rappelle de tes questions précédentes, fait évoluer l'explication et crée une flashcard FSRS d'ancrage.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-muted/50 border border-border-subtle flex gap-3">
              <Mic className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-white">📸 Photos & Balises Synchronisées</h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Tes photos de tableau et repères <em>« Pas compris »</em> sont insérés exactement là où le prof en parlait, avec un bilan modifiable en fin d'amphi.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-muted/50 border border-border-subtle flex gap-3">
              <Layers className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-white">Schémas Masqués (Image Occlusion)</h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Masque les légendes des figures d'amphi pour t'entraîner visuellement à les retrouver de mémoire.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-muted/50 border border-border-subtle flex gap-3">
              <Keyboard className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-white">Raccourcis Clavier Rapides</h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Touche <strong className="text-white">Espace</strong> pour retourner une carte, puis <strong className="text-white">1, 2, 3 ou 4</strong> pour noter la facilité.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="pt-4 border-t border-border flex items-center justify-between gap-4">
          <span className="text-xs text-zinc-500">Prêt à réviser intelligemment ?</span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onClose();
                onAction?.('record');
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Enregistrer un cours</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface-muted text-xs font-semibold text-zinc-300 border border-border transition-colors"
            >
              Compris, fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
