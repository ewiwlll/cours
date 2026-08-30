import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Smartphone,
  CheckCircle2,
  Copy,
  Wifi,
  Sparkles,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useStore } from '../../lib/store';

export function DevicePairingModal() {
  const { modals, closeModal } = useStore();
  const [localIp, setLocalIp] = useState<string>('127.0.0.1');
  const [port, setPort] = useState<number>(3002);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const getUniversalUrl = () => {
    if (localIp && localIp !== '127.0.0.1' && localIp !== 'localhost') {
      return `http://${localIp}:${port}/?paired=1`;
    }
    if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('127.0.0.1') && !window.location.origin.includes('localhost')) {
      return `${window.location.origin}/?paired=1`;
    }
    return `http://127.0.0.1:${port}/?paired=1`;
  };

  const [mode, setMode] = useState<'pwa' | 'apk'>('pwa');

  const getApkUrl = () => {
    if (localIp && localIp !== '127.0.0.1' && localIp !== 'localhost') {
      return `http://${localIp}:${port}/cours.apk`;
    }
    return 'https://cours-awc.pages.dev/cours.apk';
  };

  const activeUrl = mode === 'pwa' ? getUniversalUrl() : getApkUrl();

  useEffect(() => {
    if (!modals.devicePairing || !activeUrl || !canvasRef.current) return;
    QRCode.toCanvas(
      canvasRef.current,
      activeUrl,
      {
        width: 230,
        margin: 1.5,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      },
      (error) => {
        if (error) console.error('Erreur QR Code:', error);
      }
    );
  }, [modals.devicePairing, activeUrl, mode]);

  if (!modals.devicePairing) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                <span>Connecter mon Téléphone</span>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">100% Hors-Ligne</span>
              </h3>
              <p className="text-xs text-zinc-400">iPhone & Android • Zéro Configuration</p>
            </div>
          </div>

          <button
            onClick={() => closeModal('devicePairing')}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector: PWA vs APK */}
        <div className="p-3 bg-zinc-900/40 border-b border-zinc-800 flex items-center gap-2">
          <button
            onClick={() => setMode('pwa')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
              mode === 'pwa'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <span>🌐 Web PWA (iPhone & Android)</span>
          </button>
          <button
            onClick={() => setMode('apk')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
              mode === 'apk'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <span>🤖 Télécharger APK (Pixel)</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col items-center text-center space-y-3">
          <p className="text-xs text-zinc-300 leading-relaxed max-w-xs">
            {mode === 'pwa'
              ? "Scannez avec l'appareil photo pour ouvrir et synchroniser l'application en direct sur votre smartphone."
              : "Scannez pour télécharger directement le fichier d'installation cours.apk sur votre Google Pixel."}
          </p>

          {/* High Contrast QR Code Canvas */}
          <div className="p-3 bg-white rounded-3xl shadow-2xl shadow-emerald-500/10 border-4 border-zinc-800 flex items-center justify-center">
            <canvas ref={canvasRef} className="rounded-xl" />
          </div>

          {/* Direct Link Pill */}
          <div className="w-full p-2.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1 text-left">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span className="font-semibold text-zinc-300">
                {mode === 'pwa' ? 'Lien de synchronisation :' : 'Lien direct APK :'}
              </span>
              <button
                onClick={handleCopyUrl}
                className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors"
              >
                {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copié !' : 'Copier'}</span>
              </button>
            </div>
            <code className="block font-mono text-[11px] text-emerald-300 truncate bg-black/40 p-1.5 rounded-lg border border-zinc-800/80 select-all">
              {activeUrl}
            </code>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-800/80 bg-zinc-900/40 flex justify-end">
          <button
            onClick={() => closeModal('devicePairing')}
            className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-colors"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}
