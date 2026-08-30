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
    if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('127.0.0.1') && !window.location.origin.includes('localhost')) {
      return `${window.location.origin}/app?paired=1`;
    }
    if (localIp && localIp !== '127.0.0.1' && localIp !== 'localhost') {
      return `http://${localIp}:${port}/app?paired=1`;
    }
    return 'https://cours-awc.pages.dev/app?paired=1';
  };

  const universalUrl = getUniversalUrl();

  useEffect(() => {
    if (!modals.devicePairing) return;
    const fetchInfo = async () => {
      try {
        const res = await fetch('/api/devices');
        if (res.ok) {
          const data = await res.json();
          setLocalIp(data.localIp || '127.0.0.1');
          setPort(data.port || 3002);
        }
      } catch {
        // ignore fallback
      }
    };
    fetchInfo();
  }, [modals.devicePairing]);

  useEffect(() => {
    if (!modals.devicePairing || !universalUrl || !canvasRef.current) return;
    QRCode.toCanvas(
      canvasRef.current,
      universalUrl,
      {
        width: 250,
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
  }, [modals.devicePairing, universalUrl]);

  if (!modals.devicePairing) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(universalUrl);
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

        {/* Body: 1 Grand QR Code Universel */}
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          <p className="text-xs text-zinc-300 leading-relaxed max-w-xs">
            Ouvrez l'<strong>appareil photo</strong> de votre smartphone pour ouvrir l'application et réviser partout sans connexion (métro, amphis, transports).
          </p>

          {/* High Contrast QR Code Canvas */}
          <div className="p-3.5 bg-white rounded-3xl shadow-2xl shadow-emerald-500/10 border-4 border-zinc-800 flex items-center justify-center">
            <canvas ref={canvasRef} className="rounded-xl" />
          </div>

          {/* Feature Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[11px]">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>iPhone & Android</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-emerald-300">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>100% Hors-Ligne</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-blue-300">
              <Wifi className="w-3 h-3 text-blue-400" />
              <span>Sync Automatique</span>
            </span>
          </div>

          {/* Direct Link Pill */}
          <div className="w-full p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1 text-left">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span className="font-semibold text-zinc-300">Lien Direct :</span>
              <button
                onClick={handleCopyUrl}
                className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors"
              >
                {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copié !' : 'Copier'}</span>
              </button>
            </div>
            <code className="block font-mono text-[11px] text-emerald-300 truncate bg-black/40 p-1.5 rounded-lg border border-zinc-800/80 select-all">
              {universalUrl}
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
