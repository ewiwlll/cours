import React, { useState, useEffect } from 'react';
import { Share2, PlusSquare, Smartphone, X, Download, Sparkles } from 'lucide-react';

export function MobileInstallBanner() {
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Vérifier si déjà en mode application autonome (standalone)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setShow(false);
      return;
    }

    const dismissed = sessionStorage.getItem('cours_mobile_banner_dismissed');
    if (dismissed === 'true') {
      return;
    }

    const ua = navigator.userAgent || '';
    const ios = /iPhone|iPad|iPod/i.test(ua);
    const android = /Android/i.test(ua);
    const isMobile = ios || android || window.innerWidth < 768;

    setIsIos(ios);
    setIsAndroid(android);

    if (isMobile) {
      setShow(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
        setDeferredPrompt(null);
      }
    }
  };

  const handleDismiss = () => {
    setShow(false);
    try {
      sessionStorage.setItem('cours_mobile_banner_dismissed', 'true');
    } catch {}
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4 animate-slideUp select-none">
      <div className="max-w-md mx-auto bg-zinc-950/95 border-2 border-emerald-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl shadow-emerald-500/20 backdrop-blur-xl relative">
        <button
          onClick={handleDismiss}
          className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
          title="Fermer"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>

          <div className="space-y-1 pr-6 flex-1 text-left">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-xs sm:text-sm font-black text-white">
                {isIos ? '📲 Installer sur iPhone' : '📲 Installer sur l\'Écran'}
              </h3>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">100% Hors-Ligne</span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-snug">
              {isIos
                ? 'Pour avoir l\'application sur votre écran d\'accueil et réviser sans connexion :'
                : 'Installez l\'app sur votre écran d\'accueil pour enregistrer et réviser sans connexion :'}
            </p>
          </div>
        </div>

        {/* Instructions iOS Safari */}
        {isIos && (
          <div className="mt-3 p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-2 text-xs text-left">
            <div className="flex items-center gap-2.5 text-zinc-200">
              <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-[10px] shrink-0">1</span>
              <span>Touchez <strong className="text-white">Partager</strong> (<Share2 className="w-3.5 h-3.5 inline text-blue-400 -mt-0.5" />) en bas de Safari</span>
            </div>
            <div className="flex items-center gap-2.5 text-zinc-200">
              <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center text-[10px] shrink-0">2</span>
              <span>Sélectionnez <strong className="text-white">« Sur l'écran d'accueil »</strong> (<PlusSquare className="w-3.5 h-3.5 inline text-purple-400 -mt-0.5" />)</span>
            </div>
          </div>
        )}

        {/* Action Android / Chromium */}
        {!isIos && (
          <div className="mt-3 flex flex-col gap-2 text-left">
            {deferredPrompt ? (
              <button
                onClick={handleInstallClick}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Ajouter à l'Écran d'Accueil (1-Clic)</span>
              </button>
            ) : (
              <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-1 text-xs">
                <p className="text-zinc-200">
                  Touchez le menu de votre navigateur (<strong>⋮</strong> en haut à droite) puis <strong className="text-white">« Ajouter à l'écran d'accueil »</strong> ou <strong className="text-white">« Installer l'application »</strong>.
                </p>
                <a
                  href="/cours.apk"
                  download="cours.apk"
                  className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-bold text-[11px] pt-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ou télécharger directement le fichier APK Android (67 Mo)</span>
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
