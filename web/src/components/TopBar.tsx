import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Zap,
  Calendar,
  Mic,
  Settings,
  HelpCircle,
  Globe,
  Download,
  Smartphone,
  Share2,
  PlusSquare,
  X,
} from 'lucide-react';
import { useStore } from '../lib/store';
import type { ViewType } from '../lib/types';

export function TopBar() {
  const {
    view,
    setView,
    openModal,
    totalDueCards,
    lang,
    setLang,
  } = useStore();

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);

  const isLocalOrNative =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
     window.location.hostname === '127.0.0.1' ||
     window.location.protocol === 'file:' ||
     window.navigator.userAgent.includes('Cours'));

  useEffect(() => {
    // 1. Détection mode autonome (déjà installé ou PWA active)
    const isAppStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');
    setIsStandalone(isAppStandalone);

    // 2. Détection iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIos(isIosDevice);

    // 3. Écoute de l'événement natif d'installation PWA
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsStandalone(true);
        setDeferredPrompt(null);
      }
    } else {
      setShowIosGuide(true);
    }
  };

  const tabs: Array<{ id: ViewType; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }> = [
    { id: 'accueil', label: lang === 'en' ? 'Dashboard' : 'Accueil', icon: LayoutDashboard },
    { id: 'subjects', label: lang === 'en' ? 'Subjects' : 'Matières', icon: BookOpen },
    { id: 'anki', label: lang === 'en' ? 'Practice' : 'Entraînement', icon: Zap, badge: totalDueCards },
    { id: 'planning', label: lang === 'en' ? 'Schedule' : 'Planning', icon: Calendar },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 h-14 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80 flex items-center justify-between px-4 sm:px-6 select-none">
        {/* Left: macOS Traffic Lights Margin + Brand */}
        <div className="flex items-center gap-3 pl-16 sm:pl-20 md:pl-0">
          <button
            onClick={() => setView('accueil')}
            className="flex items-center gap-2.5 group transition-transform active:scale-95"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <span className="font-black text-white text-base tracking-tighter">C</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight text-white">Cours</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                OS
              </span>
            </div>
          </button>
        </div>

        {/* Center: Sleek Segmented Nav Control */}
        <nav className="hidden md:flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 shadow-inner">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = view === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-zinc-400'}`} />
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-500 text-white shadow">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Actions: PWA Install + Record Mic + Method + Language + Settings */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* PWA Install Button (visible UNIQUEMENT sur la version Web en ligne hébergée, masqué en local et dans l'app Mac) */}
          {!isStandalone && !isLocalOrNative && (
            <button
              onClick={handleInstallClick}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-bold transition-all shadow-sm active:scale-95"
              title={lang === 'en' ? 'Install App on your device' : 'Installer l\'application Cours sur votre appareil'}
            >
              <Download className="w-3.5 h-3.5 text-purple-400" />
              <span>{lang === 'en' ? 'Install App' : 'Installer l\'App'}</span>
            </button>
          )}

          {/* Record Button */}
          <button
            onClick={() => openModal('recording')}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold shadow-sm transition-all hover:scale-105 active:scale-95"
            title={lang === 'en' ? 'Record lecture (Shortcut: R)' : 'Enregistrer un amphi (Raccourci: Touche R)'}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <Mic className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden sm:inline">{lang === 'en' ? 'Record' : 'Enregistrer'}</span>
          </button>

          {/* Method Guide Button (Desktop / Tablet only) */}
          <button
            onClick={() => openModal('howItWorks')}
            className="hidden sm:flex p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
            title={lang === 'en' ? 'Methodology & Guide' : 'Méthode & Studio Antigravity'}
          >
            <HelpCircle className="w-4 h-4 text-blue-400" />
          </button>

          {/* Language Switcher (Desktop / Tablet only) */}
          <button
            onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono font-bold text-zinc-300 hover:text-white hover:border-zinc-700 transition-all"
            title={lang === 'en' ? 'Switch to French' : 'Basculer en Anglais'}
          >
            <Globe className="w-3.5 h-3.5 text-zinc-400" />
            <span>{lang.toUpperCase()}</span>
          </button>

          {/* Mobile Devices & QR Code Pairing Button (DESKTOP ONLY) */}
          <button
            onClick={() => openModal('devicePairing')}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs font-bold text-emerald-300 hover:text-emerald-200 hover:border-emerald-500/80 hover:bg-emerald-900/60 transition-all shadow-sm shadow-emerald-500/10 hover:scale-105 active:scale-95"
            title={lang === 'en' ? 'Connect Phone & Scan QR Code' : 'Connecter mon téléphone / Scanner QR Code'}
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span className="inline font-semibold">{lang === 'en' ? '📱 Connect Phone' : '📱 Téléphone'}</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={() => openModal('settings')}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
            title={lang === 'en' ? 'Settings' : 'Paramètres'}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Modal Guide d'installation Mobile & Desktop PWA */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700/80 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative text-left">
            <button
              onClick={() => setShowIosGuide(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Smartphone className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-white">
                {isIos ? 'Installer Cours sur iPhone / iPad' : 'Ajouter Cours à votre Dock & Écran'}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Utilisez Cours en mode application 100% autonome, sans barre d'adresse, avec accès direct depuis votre Dock :
              </p>
            </div>

            <div className="space-y-2.5 pt-1 text-xs">
              {isIos ? (
                <>
                  <div className="p-3 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                    <span className="text-zinc-200">
                      Appuyez sur le bouton <strong className="text-white">Partager</strong> (<Share2 className="w-3.5 h-3.5 inline text-blue-400" />) en bas de Safari.
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                    <span className="text-zinc-200">
                      Faites défiler et sélectionnez <strong className="text-white">Sur l'écran d'accueil</strong> (<PlusSquare className="w-3.5 h-3.5 inline text-purple-400" />).
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3.5 rounded-2xl bg-blue-950/30 border border-blue-500/30 space-y-1.5">
                    <div className="flex items-center gap-2 text-blue-400 font-bold">
                      <span>🌐 Sur Google Chrome / Edge (Mac & PC) :</span>
                    </div>
                    <p className="text-zinc-300 text-[11px] leading-relaxed">
                      Regardez en haut à droite dans votre <strong>barre d'adresse</strong> : cliquez sur le bouton bleu <span className="bg-blue-600/30 text-blue-300 px-1.5 py-0.5 rounded font-semibold border border-blue-500/40">Ouvrir dans l'appli</span> ou l'icône d'installation 📥. L'app s'ouvre directement dans votre <strong>Dock</strong> !
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-500/30 space-y-1.5">
                    <div className="flex items-center gap-2 text-purple-300 font-bold">
                      <span>🍏 Sur Safari (macOS Sonoma & Sequoia) :</span>
                    </div>
                    <p className="text-zinc-300 text-[11px] leading-relaxed">
                      Dans la barre des menus en haut de votre écran, cliquez sur <strong className="text-white">Fichier &gt; Ajouter au Dock...</strong> pour créer l'icône de l'app.
                    </p>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition-all shadow-md mt-2"
            >
              Compris !
            </button>
          </div>
        </div>
      )}
    </>
  );
}
