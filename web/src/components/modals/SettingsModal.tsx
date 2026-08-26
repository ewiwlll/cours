import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Server,
  Globe,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw,
  Save,
} from 'lucide-react';
import { useStore } from '../../lib/store';

export function SettingsModal() {
  const { modals, closeModal, lang, setLang, t } = useStore();
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState('gemini-3.7-flash');
  const [port, setPort] = useState(3002);
  const [localIp, setLocalIp] = useState('127.0.0.1');
  const [tailscaleUrl, setTailscaleUrl] = useState<string | null>(null);
  const [geminiConfigured, setGeminiConfigured] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!modals.settings) return;
    setLoading(true);
    setTestResult(null);
    setSaveSuccess(false);

    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        setGeminiConfigured(Boolean(data.geminiConfigured));
        setModel(data.geminiModel || 'gemini-3.7-flash');
        setPort(data.port || 3002);
        setLocalIp(data.localIp || '127.0.0.1');
        setTailscaleUrl(data.tailscaleUrl || null);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [modals.settings]);

  if (!modals.settings) return null;

  const handleTestGemini = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/test-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiApiKey: apiKey || undefined,
          geminiModel: model,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setTestResult({ ok: true, message: data.message || t.keyValid });
      } else {
        setTestResult({ ok: false, message: data.error || t.keyInvalid });
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || t.keyInvalid });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      const payload: any = {
        geminiModel: model,
        port: Number(port),
      };
      if (apiKey.trim()) {
        payload.geminiApiKey = apiKey.trim();
      }

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setGeminiConfigured(true);
        setApiKey('');
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in select-none">
      <div className="relative w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">{t.settingsTitle}</h2>
              <p className="text-xs text-zinc-400">{t.settingsSubtitle}</p>
            </div>
          </div>
          <button
            onClick={() => closeModal('settings')}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-surface-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mb-2 text-blue-400" />
              <span>Chargement...</span>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-5">
              
              {/* SECTION: LANGUAGE SELECTION */}
              <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border space-y-2">
                <label className="block text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span>{t.languageLabel}</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLang('fr')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      lang === 'fr'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                        : 'bg-surface-muted text-zinc-400 border-border hover:text-white'
                    }`}
                  >
                    <span>🇫🇷 Français</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang('en')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      lang === 'en'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                        : 'bg-surface-muted text-zinc-400 border-border hover:text-white'
                    }`}
                  >
                    <span>🇬🇧 English</span>
                  </button>
                </div>
              </div>

              {/* SECTION 1: GEMINI API KEY */}
              <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-blue-400" />
                    <span>{t.geminiKeyLabel}</span>
                  </label>
                  {geminiConfigured ? (
                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Configurée
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Non renseignée
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={geminiConfigured ? '••••••••••••••••••••••••••••••••' : t.geminiKeyPlaceholder}
                    className="w-full bg-surface-muted border border-border rounded-lg pl-3 pr-10 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300"
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-400 hover:text-blue-300 underline font-medium"
                  >
                    {t.getKeyLink} (Google AI Studio) →
                  </a>

                  <button
                    type="button"
                    onClick={handleTestGemini}
                    disabled={testing}
                    className="px-3 py-1 rounded-lg bg-surface-muted hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-border flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {testing ? <RefreshCw className="w-3 h-3 animate-spin text-blue-400" /> : <Sparkles className="w-3 h-3 text-blue-400" />}
                    <span>{testing ? t.testingKey : t.testKeyBtn}</span>
                  </button>
                </div>

                {testResult && (
                  <div
                    className={`p-2.5 rounded-lg text-xs flex items-center gap-2 font-medium ${
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

              {/* SECTION 2: MODEL & PORT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border space-y-2">
                  <label className="block text-xs font-bold text-zinc-200">{t.modelLabel}</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-surface-muted border border-border rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-blue-500"
                  >
                    <option value="gemini-3.7-flash">gemini-3.7-flash</option>
                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                  </select>
                </div>

                <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border space-y-2">
                  <label className="block text-xs font-bold text-zinc-200">{t.portLabel}</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(parseInt(e.target.value, 10) || 3002)}
                    className="w-full bg-surface-muted border border-border rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* SECTION 3: MOBILE SYNC & TAILSCALE 4G */}
              <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Connexion Mobile & 4G Extérieur</span>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border">
                    <span className="text-zinc-400">Wi-Fi Local :</span>
                    <span className="text-emerald-400 font-bold">http://{localIp}:{port}</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border">
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <Globe className="w-3 h-3 text-blue-400" />
                      <span>4G Tailscale :</span>
                    </div>
                    {tailscaleUrl ? (
                      <span className="text-blue-400 font-bold">{tailscaleUrl}:{port}</span>
                    ) : (
                      <span className="text-zinc-500 text-[11px] font-sans">Non détecté (utilisez Wi-Fi local)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* SAVE BUTTON */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  {saveSuccess && (
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 animate-fade-in">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Paramètres sauvegardés !
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => closeModal('settings')}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-surface-muted transition-colors"
                  >
                    Fermer
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                  >
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Enregistrer</span>
                  </button>
                </div>
              </div>

            </form>
          )}
        </div>
      </div>
    </div>
  );
}
