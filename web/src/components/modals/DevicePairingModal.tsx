import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Smartphone,
  CheckCircle2,
  Copy,
  Wifi,
  Sparkles,
  Trash2,
  Usb,
  RefreshCw,
  Clock,
  Radio,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useStore } from '../../lib/store';

export function DevicePairingModal() {
  const { modals, closeModal } = useStore();
  const [localIp, setLocalIp] = useState<string>('127.0.0.1');
  const [port, setPort] = useState<number>(3002);
  const [copied, setCopied] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [adbDevice, setAdbDevice] = useState<any>(null);
  const [installingAdb, setInstallingAdb] = useState(false);
  const [adbMessage, setAdbMessage] = useState<string | null>(null);
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

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/devices');
      if (res.ok) {
        const data = await res.json();
        setLocalIp(data.localIp || '127.0.0.1');
        setPort(data.port || 3002);
        setDevices(Array.isArray(data.devices) ? data.devices : []);
        setAdbDevice(data.adbDevice || null);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!modals.devicePairing) return;
    fetchDevices();
    const interval = setInterval(fetchDevices, 2500);
    return () => clearInterval(interval);
  }, [modals.devicePairing]);

  useEffect(() => {
    if (!modals.devicePairing || !activeUrl || !canvasRef.current) return;
    QRCode.toCanvas(
      canvasRef.current,
      activeUrl,
      {
        width: 210,
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

  const handleUnpair = async (deviceId: string) => {
    try {
      await fetch(`/api/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' });
      await fetchDevices();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdbInstall = async () => {
    setInstallingAdb(true);
    setAdbMessage(null);
    try {
      const res = await fetch('/api/devices/adb-install', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setAdbMessage('✓ Application installée avec succès sur le Pixel !');
      } else {
        setAdbMessage(`Erreur : ${data.error || "Impossible d'installer via USB"}`);
      }
    } catch (err: any) {
      setAdbMessage(`Erreur : ${err.message}`);
    } finally {
      setInstallingAdb(false);
    }
  };

  if (!modals.devicePairing) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                <span>Connecter mon Téléphone</span>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">100% Hors-Ligne</span>
              </h3>
              <p className="text-xs text-zinc-400">iPhone & Android • Synchronisation Wi-Fi</p>
            </div>
          </div>

          <button
            onClick={() => closeModal('devicePairing')}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          
          {/* Tab Selector: PWA vs APK */}
          <div className="p-1 bg-zinc-900/80 rounded-2xl border border-zinc-800 flex items-center gap-1.5">
            <button
              onClick={() => setMode('pwa')}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                mode === 'pwa'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>🌐 Web PWA (iPhone & Android)</span>
            </button>
            <button
              onClick={() => setMode('apk')}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                mode === 'apk'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>🤖 Télécharger APK (Pixel)</span>
            </button>
          </div>

          {/* QR Code Section */}
          <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex flex-col items-center text-center space-y-2.5">
            <p className="text-xs text-zinc-300 leading-relaxed max-w-sm">
              {mode === 'pwa'
                ? "Scannez avec l'appareil photo pour synchroniser en direct l'application sur votre smartphone :"
                : "Scannez pour télécharger directement le fichier cours.apk sur votre Google Pixel :"}
            </p>

            {/* Canvas QR Code */}
            <div className="p-2.5 bg-white rounded-2xl shadow-xl shadow-emerald-500/10 border-4 border-zinc-800 flex items-center justify-center">
              <canvas ref={canvasRef} className="rounded-lg" />
            </div>

            {/* Direct Link */}
            <div className="w-full p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1 text-left">
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
              <code className="block font-mono text-[11px] text-emerald-300 truncate bg-black/50 p-1.5 rounded-lg border border-zinc-800/80 select-all">
                {activeUrl}
              </code>
            </div>
          </div>

          {/* ADB USB Detection Banner if connected */}
          {adbDevice && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-zinc-900 border border-emerald-500/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Usb className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">
                    Appareil USB Détecté : {adbDevice.model}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                  Prêt
                </span>
              </div>
              <button
                onClick={handleAdbInstall}
                disabled={installingAdb}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {installingAdb ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Installer l'APK en 1 Clic sur le {adbDevice.model}</span>
              </button>
              {adbMessage && (
                <p className="text-[11px] text-emerald-300 text-center font-medium">{adbMessage}</p>
              )}
            </div>
          )}

          {/* Connected Devices List */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-blue-400" />
                <span>Téléphones Associés</span>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-blue-500/20 text-blue-300 font-bold">
                  {devices.length}
                </span>
              </h4>
              <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Auto-Sync Wi-Fi</span>
              </span>
            </div>

            {devices.length === 0 ? (
              <div className="p-3 rounded-xl bg-black/40 border border-zinc-800/80 text-center space-y-1">
                <p className="text-xs text-zinc-400 font-medium">Aucun smartphone connecté pour l'instant</p>
                <p className="text-[11px] text-zinc-500">
                  Scannez le QR Code ci-dessus avec votre smartphone pour le voir apparaître ici en direct.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {devices.map((device) => {
                  const lastSeen = new Date(device.lastSeenAt || device.firstSeenAt);
                  const isOnline = Date.now() - lastSeen.getTime() < 5 * 60 * 1000;
                  const isIosDevice = device.platform === 'ios' || /iphone|ipad/i.test(device.deviceName || '');

                  return (
                    <div
                      key={device.id}
                      className="p-3 rounded-xl bg-black/40 border border-zinc-800/80 flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isIosDevice
                              ? 'bg-purple-500/20 text-purple-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <strong className="text-xs font-bold text-white block">
                              {device.deviceName || 'Smartphone'}
                            </strong>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold flex items-center gap-1 ${
                                isOnline
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isOnline ? 'bg-emerald-400' : 'bg-zinc-500'
                                }`}
                              />
                              <span>{isOnline ? 'En ligne' : 'Hors-ligne'}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                            <span>IP : {device.ip || '127.0.0.1'}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{isOnline ? 'Actif maintenant' : `Vu à ${lastSeen.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleUnpair(device.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Dissocier cet appareil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-800/80 bg-zinc-900/40 flex justify-end shrink-0">
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
