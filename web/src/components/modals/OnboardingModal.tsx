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
  Copy,
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
  const [copied, setCopied] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isPaired = params.get('paired') === '1' || params.has('token');
    if (isPaired) {
      localStorage.setItem('cours_onboarding_completed', 'true');
      setIsOpen(false);
      return;
    }

    const completed = localStorage.getItem('cours_onboarding_completed');
    if (!completed || modals.onboarding) {
      setIsOpen(true);
    }
  }, [modals.onboarding]);

  const fetchSystemData = () => {
    fetch('/api/system/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.localIp && data.localIp !== '127.0.0.1') {
          setPairingUrl(`http://${data.localIp}:${data.port || 3002}/?paired=1`);
        } else if (data.mobileConnectUrl) {
          setPairingUrl(data.mobileConnectUrl);
        }
      })
      .catch(() => {
        fetch('/api/devices')
          .then((res) => res.json())
          .then((data) => {
            if (data.localIp && data.localIp !== '127.0.0.1') {
              setPairingUrl(`http://${data.localIp}:${data.port || 3002}/?paired=1`);
            } else if (data.pairingUrl) {
              setPairingUrl(data.pairingUrl);
            }
          })
          .catch(() => {
            if (typeof window !== 'undefined' && window.location.origin) {
              setPairingUrl(`${window.location.origin}/?paired=1`);
            }
          });
      });
  };

  useEffect(() => {
    if (isOpen) {
      fetchSystemData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (step === 3 && pairingUrl && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        pairingUrl,
        {
          width: 220,
          margin: 1.5,
          color: { dark: '#000000', light: '#ffffff' },
        },
        (err) => {
          if (err) console.error('Erreur génération QR Code:', err);
        }
      );
    }
  }, [step, pairingUrl]);

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
        setTestResult({ ok: true, message: 'Clé Gemini valide et enregistrée !' });
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

  const handleCopyUrl = () => {
    if (pairingUrl) {
      navigator.clipboard.writeText(pairingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleFinish = () => {
    localStorage.setItem('cours_onboarding_completed', 'true');
    setIsOpen(false);
    closeModal('onboarding');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Stepper */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-sm shadow-md shadow-blue-500/20">
              C
            </div>
            <div>
              <span className="font-bold text-white text-sm tracking-tight block">Bienvenue sur Cours</span>
              <span className="text-[10px] text-zinc-400">Configuration en 3 étapes simples</span>
            </div>
          </div>

          {/* Stepper Dots */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => (
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

        {/* Body Content */}
        <div className="p-6 text-xs space-y-4 flex-1 overflow-y-auto">

          {/* STEP 1: PRESENTATION & METHOD */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center space-y-1.5 pt-1">
                <span className="text-3xl">🎓</span>
                <h3 className="text-xl font-extrabold text-white">L'OS de Révision Active & d'Amphi</h3>
                <p className="text-zinc-400 text-xs max-w-sm mx-auto leading-relaxed">
                  Conçu scientifiquement pour retenir 100% de vos cours sans stress d'examen :
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 text-base">
                    🎙️
                  </div>
                  <div>
                    <strong className="text-white block text-xs font-bold">1. En Amphi : Écoute Active & Photos</strong>
                    <span className="text-zinc-400 text-[11px] leading-tight block">Posez des balises en 1 clic. Le micro capture tout fidèlement.</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 text-base">
                    🧠
                  </div>
                  <div>
                    <strong className="text-white block text-xs font-bold">2. Le Sas : Rappel Actif Obligatoire</strong>
                    <span className="text-zinc-400 text-[11px] leading-tight block">Fiche verrouillée jusqu'à 1-2 min de restitution libre pour ancrer la mémoire.</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 text-base">
                    ⚡
                  </div>
                  <div>
                    <strong className="text-white block text-xs font-bold">3. Au Quotidien : Répétition Espacée FSRS-5</strong>
                    <span className="text-zinc-400 text-[11px] leading-tight block">Révisez les flashcards calculées au moment idéal avant l'oubli.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: GEMINI API KEY */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center space-y-1 pt-1">
                <span className="text-3xl">🔑</span>
                <h3 className="text-lg font-extrabold text-white">Clé IA Gemini (100% Gratuite)</h3>
                <p className="text-zinc-400 text-xs max-w-sm mx-auto leading-relaxed">
                  Cours utilise <strong>Gemini 3.7 Flash</strong> pour évaluer vos rappels actifs et structurer vos cours.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
                <label className="block text-xs font-bold text-zinc-200">Collez votre clé API Gemini :</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-3 pr-10 py-2.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-blue-500"
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

          {/* STEP 3: PHONE QR CODE & OFFLINE PWA */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in text-center">
              <div className="space-y-1 pt-1">
                <span className="text-3xl">📱</span>
                <h3 className="text-lg font-extrabold text-white">Connectez votre Smartphone</h3>
                <p className="text-zinc-400 text-xs max-w-sm mx-auto leading-relaxed">
                  Ouvrez l'<strong>appareil photo</strong> de votre smartphone pour ouvrir l'application et réviser partout sans connexion :
                </p>
              </div>

              {/* High Contrast QR Code Canvas */}
              <div className="p-3 bg-white rounded-3xl shadow-xl shadow-emerald-500/10 border-4 border-zinc-800 flex items-center justify-center w-fit mx-auto">
                <canvas ref={canvasRef} className="rounded-xl" />
              </div>

              {/* Badges */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[11px]">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>iPhone & Android</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-emerald-300 font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>100% Hors-Ligne</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-blue-300">
                  <Wifi className="w-3 h-3 text-blue-400" />
                  <span>Sync Automatique</span>
                </span>
              </div>

              {/* Direct Copy Link */}
              <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-left space-y-1 text-[11px]">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="font-semibold text-zinc-300">Lien Direct Mobile :</span>
                  <button
                    onClick={handleCopyUrl}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors"
                  >
                    {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copié !' : 'Copier'}</span>
                  </button>
                </div>
                <code className="block font-mono text-[11px] text-emerald-300 truncate bg-black/40 p-1.5 rounded-lg border border-zinc-800/80 select-all">
                  {pairingUrl}
                </code>
              </div>
            </div>
          )}

        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between">
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

          {step < 3 ? (
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
