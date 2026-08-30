import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Key,
  Smartphone,
  BookOpen,
  Wifi,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  X,
  ExternalLink,
  ShieldCheck,
  Bot,
  Zap,
  Globe,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useStore } from '../../lib/store';

export function OnboardingModal() {
  const { modals, closeModal } = useStore();
  const [step, setStep] = useState<number>(1);
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pairingUrl, setPairingUrl] = useState<string>('');
  const [tailscaleUrl, setTailscaleUrl] = useState<string | null>(null);
  const [antigravityStatus, setAntigravityStatus] = useState<{ installed: boolean; running: boolean } | null>(null);
  const [openingAntigravity, setOpeningAntigravity] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [connectedDevicesCount, setConnectedDevicesCount] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const completed = localStorage.getItem('cours_onboarding_completed');
    if (!completed || modals.onboarding) {
      setIsOpen(true);
    }
  }, [modals.onboarding]);

  const fetchSystemData = () => {
    fetch('/api/system/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setPairingUrl(data.mobileConnectUrl || `http://${data.localIp || '127.0.0.1'}:${data.port || 3002}/mobile`);
          setTailscaleUrl(data.tailscale?.url || null);
          setAntigravityStatus(data.antigravity || null);
        }
      })
      .catch(() => {
        fetch('/api/devices')
          .then((res) => res.json())
          .then((data) => {
            setPairingUrl(data.pairingUrl || `http://${data.localIp || '127.0.0.1'}:${data.port || 3002}/mobile`);
            setTailscaleUrl(data.tailscaleUrl || null);
            setConnectedDevicesCount((data.devices || []).length);
          })
          .catch(() => {});
      });
  };

  useEffect(() => {
    if (isOpen) {
      fetchSystemData();
      const interval = setInterval(fetchSystemData, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  useEffect(() => {
    if (step === 4 && pairingUrl && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        pairingUrl,
        {
          width: 210,
          margin: 1.5,
          color: { dark: '#000000', light: '#ffffff' },
        },
        (err) => {
          if (err) console.error(err);
        }
      );
    }
  }, [step, pairingUrl]);

  useEffect(() => {
    if (step === 3) {
      fetch('/api/antigravity/open', { method: 'POST' }).catch(() => {});
      fetchSystemData();
    }
  }, [step]);

  if (!isOpen) return null;

  const handleTestAndSaveKey = async () => {
    if (!apiKey.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/test-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiApiKey: apiKey.trim(), geminiModel: 'gemini-3.7-flash' }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setTestResult({ ok: true, message: 'Clé Gemini API valide et enregistrée !' });
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ geminiApiKey: apiKey.trim(), geminiModel: 'gemini-3.7-flash', port: 3002 }),
        });
      } else {
        setTestResult({ ok: false, message: data.error || 'Clé invalide' });
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || 'Erreur de connexion' });
    } finally {
      setTesting(false);
    }
  };

  const handleOpenAntigravity = async () => {
    setOpeningAntigravity(true);
    try {
      await fetch('/api/antigravity/open', { method: 'POST' });
      setTimeout(() => {
        fetchSystemData();
        setOpeningAntigravity(false);
      }, 1500);
    } catch {
      setOpeningAntigravity(false);
    }
  };

  const handleFinish = () => {
    localStorage.setItem('cours_onboarding_completed', 'true');
    setIsOpen(false);
    closeModal('onboarding');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Step Indicator Top Bar */}
        <div className="px-6 pt-6 pb-2 flex items-center justify-between border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-sm shadow-md shadow-blue-500/20">
              C
            </div>
            <div>
              <span className="font-bold text-white text-sm tracking-tight block">Bienvenue sur Cours</span>
              <span className="text-[10px] text-zinc-400">Configuration rapide en 4 étapes</span>
            </div>
          </div>

          {/* Stepper Dots */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  step === s
                    ? 'w-6 bg-blue-500'
                    : step > s
                    ? 'w-2 bg-emerald-500'
                    : 'w-2 bg-zinc-800'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Modal Content per Step */}
        <div className="p-6 text-xs space-y-5 flex-1 overflow-y-auto">

          {/* STEP 1: WELCOME & METHODOLOGY */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center space-y-1.5 pt-1">
                <span className="text-3xl">🎓</span>
                <h3 className="text-xl font-extrabold text-white">L'OS d'Apprentissage & de Révision</h3>
                <p className="text-zinc-400 text-xs max-w-sm mx-auto leading-relaxed">
                  Prêt à réussir vos examens ? Voici les 3 piliers qui transforment votre manière d'étudier :
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 text-base">
                    🎙️
                  </div>
                  <div>
                    <strong className="text-white block text-xs font-bold">1. En Amphi : Écoute Active & Whisper Metal</strong>
                    <span className="text-zinc-400 text-[11px] leading-tight block">Le micro capture tout sans coupure. Vous visualisez les concepts.</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 text-base">
                    🧠
                  </div>
                  <div>
                    <strong className="text-white block text-xs font-bold">2. Le Sas : Rappel Actif Obligatoire</strong>
                    <span className="text-zinc-400 text-[11px] leading-tight block">Fiche verrouillée jusqu'à 1-2 min de restitution libre (orale ou écrite).</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 text-base">
                    ⚡
                  </div>
                  <div>
                    <strong className="text-white block text-xs font-bold">3. Au Quotidien : Répétition Espacée FSRS-5</strong>
                    <span className="text-zinc-400 text-[11px] leading-tight block">Révisez au moment exact avant l'oubli, sans chrono stressant.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: GEMINI API SETUP */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center space-y-1 pt-1">
                <span className="text-3xl">🔑</span>
                <h3 className="text-lg font-extrabold text-white">Clé IA Gemini (100% Gratuite)</h3>
                <p className="text-zinc-400 text-xs max-w-sm mx-auto leading-relaxed">
                  Cours utilise <strong>Gemini 3.7 Flash</strong> pour diagnostiquer vos rappels et générer vos fiches de cours.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-surface-elevated/40 border border-border space-y-3">
                <label className="block text-xs font-bold text-zinc-200">Collez votre clé API Gemini :</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-surface-muted border border-border rounded-xl pl-3 pr-10 py-2.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-400 hover:text-blue-300 underline font-medium inline-flex items-center gap-1"
                  >
                    <span>Obtenir ma clé gratuite en 1 clic</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    type="button"
                    onClick={handleTestAndSaveKey}
                    disabled={testing || !apiKey.trim()}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs disabled:opacity-40 transition-colors flex items-center gap-1.5 shadow-md shadow-blue-500/20"
                  >
                    {testing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    <span>Tester & Activer</span>
                  </button>
                </div>

                {testResult && (
                  <div
                    className={`p-2.5 rounded-xl text-[11px] flex items-center gap-2 font-medium ${
                      testResult.ok
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                    }`}
                  >
                    {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-zinc-500 text-center">
                Modifiable à tout moment dans les Paramètres ⚙️.
              </p>
            </div>
          )}

          {/* STEP 3: ANTIGRAVITY STUDIO & TAILSCALE */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center space-y-1 pt-1">
                <span className="text-3xl">🧠</span>
                <h3 className="text-lg font-extrabold text-white">Google Antigravity & Tailscale</h3>
                <p className="text-zinc-400 text-xs max-w-sm mx-auto leading-relaxed">
                  Tout est configuré automatiquement : Antigravity analyse vos incompréhensions et Tailscale synchronise vos appareils.
                </p>
              </div>

              <div className="space-y-3">
                {/* Antigravity Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 to-surface border border-purple-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-purple-400" />
                      <span className="font-bold text-white text-xs">Studio Google Antigravity</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Connecté au Projet
                    </span>
                  </div>
                  <p className="text-zinc-300 text-[11px] leading-relaxed">
                    ✨ Le Studio est ouvert directement sur votre dossier. Ouvrez le chat et tapez simplement <code className="text-emerald-400 font-mono font-bold">cours</code> pour que l'IA structure vos fiches et génère vos flashcards !
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-zinc-500 font-mono">Skills : process-course • oral-tutor</span>
                    <button
                      onClick={handleOpenAntigravity}
                      className="text-[11px] text-purple-400 hover:text-purple-300 underline font-semibold"
                    >
                      {openingAntigravity ? 'Ouverture...' : 'Basculer vers Antigravity →'}
                    </button>
                  </div>
                </div>

                {/* Tailscale Card */}
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-white text-xs">Synchronisation Wi-Fi & Tailscale 4G</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                      Automatique
                    </span>
                  </div>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    {tailscaleUrl ? (
                      <>Tunnel 4G sécurisé actif : vos cours se synchronisent en temps réel à l'université et à la maison sans configuration !</>
                    ) : (
                      <>Vos appareils se connectent automatiquement en Wi-Fi local et basculent sur le mode hors-ligne sans coupure.</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: SMARTPHONE PAIRING & NATIVE APP */}
          {step === 4 && (
            <div className="space-y-4 animate-fade-in text-center">
              <div className="space-y-1 pt-1">
                <span className="text-3xl">📱</span>
                <h3 className="text-lg font-extrabold text-white">Connectez votre Smartphone</h3>
                <p className="text-zinc-400 text-xs max-w-sm mx-auto leading-relaxed">
                  Scannez ce QR Code avec votre appareil photo pour installer l'application sur votre téléphone :
                </p>
              </div>

              {/* QR Canvas */}
              <div className="p-3.5 bg-white rounded-3xl shadow-xl shadow-blue-500/10 border-4 border-zinc-800 flex items-center justify-center w-fit mx-auto">
                <canvas ref={canvasRef} className="rounded-xl" />
              </div>

              {/* Native APK & Expo Highlights */}
              <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-left space-y-2 text-[11px]">
                <div className="flex items-center justify-between text-zinc-300 font-bold">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span>🤖</span>
                    <span>Android : Application Standalone (.apk)</span>
                  </span>
                  <a
                    href="/cours.apk"
                    download="cours.apk"
                    className="text-blue-400 hover:text-blue-300 underline font-semibold text-[10px]"
                  >
                    Télécharger APK →
                  </a>
                </div>
                <div className="flex items-center justify-between text-zinc-300 font-bold">
                  <span className="flex items-center gap-1.5 text-purple-400">
                    <span>🍏</span>
                    <span>iPhone & Android : Expo Go (Instantané)</span>
                  </span>
                  <span className="text-zinc-500 text-[10px]">App Native</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-surface-elevated/40 border border-border text-[11px] text-zinc-300 font-mono select-all">
                {pairingUrl}
              </div>
            </div>
          )}

        </div>

        {/* Modal Navigation Buttons */}
        <div className="px-6 py-4 border-t border-border bg-surface-elevated/40 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Précédent</span>
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="text-[11px] text-zinc-500 hover:text-zinc-400"
            >
              Passer l'introduction
            </button>
          )}

          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
            >
              <span>Continuer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Ouvrir mon Cockpit 🎉</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
