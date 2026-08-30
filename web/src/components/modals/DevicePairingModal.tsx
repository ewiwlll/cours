import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Smartphone,
  QrCode,
  Wifi,
  Globe,
  CheckCircle2,
  Copy,
  Trash2,
  RefreshCw,
  Tablet,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useStore } from '../../lib/store';

interface ConnectedDevice {
  id: string;
  deviceName: string;
  platform: string;
  ip: string;
  firstSeenAt: string;
  lastSeenAt: string;
  syncCount: number;
}

export function DevicePairingModal() {
  const { modals, closeModal } = useStore();
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [localIp, setLocalIp] = useState<string>('127.0.0.1');
  const [port, setPort] = useState<number>(3002);
  const [pairingUrl, setPairingUrl] = useState<string>('');
  const [tailscaleUrl, setTailscaleUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'devices' | 'guide'>('qr');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/devices');
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
        setLocalIp(data.localIp || '127.0.0.1');
        setPort(data.port || 3002);
        setPairingUrl(data.pairingUrl || `http://${data.localIp || '127.0.0.1'}:${data.port || 3002}`);
        setTailscaleUrl(data.tailscaleUrl || null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!modals.devicePairing) return;
    fetchDevices();
  }, [modals.devicePairing]);

  useEffect(() => {
    if (!modals.devicePairing || !pairingUrl || !canvasRef.current) return;
    QRCode.toCanvas(
      canvasRef.current,
      pairingUrl,
      {
        width: 240,
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
  }, [modals.devicePairing, pairingUrl, activeTab]);

  if (!modals.devicePairing) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(pairingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRemoveDevice = async (id: string) => {
    try {
      const res = await fetch(`/api/devices/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDevices((prev) => prev.filter((d) => d.id !== id));
      }
    } catch {
      // ignore
    }
  };

  const formatTimeAgo = (iso: string) => {
    try {
      const diffMs = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'À l’instant';
      if (mins < 60) return `Il y a ${mins} min`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `Il y a ${hours} h`;
      return new Date(iso).toLocaleDateString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Appareils & Synchronisation Mobile</h3>
              <p className="text-[11px] text-zinc-400">Connectez vos smartphones et tablettes en 1 scan</p>
            </div>
          </div>

          <button
            onClick={() => closeModal('devicePairing')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-surface-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-border px-6 bg-surface-elevated/20 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('qr')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'qr'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR Code Magique</span>
          </button>

          <button
            onClick={() => setActiveTab('devices')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'devices'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Appareils Connectés</span>
            {devices.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px]">
                {devices.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'guide'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Comment ça marche ?</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">

          {/* TAB 1: QR CODE */}
          {activeTab === 'qr' && (
            <div className="flex flex-col items-center text-center space-y-5">
              <div className="max-w-md space-y-1">
                <h4 className="text-base font-bold text-white">Scannez pour ouvrir Cours sur votre Téléphone</h4>
                <p className="text-zinc-400 text-xs">
                  Ouvrez l'appareil photo de votre iPhone ou Android et visez ce code :
                </p>
              </div>

              {/* High Contrast QR Code Canvas */}
              <div className="p-3 bg-white rounded-2xl shadow-xl shadow-blue-500/10 border-4 border-zinc-800 flex items-center justify-center">
                <canvas ref={canvasRef} className="rounded-lg" />
              </div>

              {/* Connection URL Pill */}
              <div className="w-full max-w-md p-3 rounded-xl bg-surface-elevated/40 border border-border space-y-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Adresse Wi-Fi locale :</span>
                  </span>
                  <button
                    onClick={handleCopyUrl}
                    className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
                  >
                    {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copié !' : 'Copier le lien'}</span>
                  </button>
                </div>
                <div className="p-2 rounded-lg bg-surface border border-border font-mono text-zinc-200 font-bold text-center select-all">
                  {pairingUrl}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] flex items-center gap-2 max-w-md text-left">
                <ShieldCheck className="w-4 h-4 shrink-0 text-blue-400" />
                <span>
                  <strong>Connexion 100% privée et directe :</strong> Vos cours restent sur votre ordinateur sans transiter par aucun serveur tiers.
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: CONNECTED DEVICES */}
          {activeTab === 'devices' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-white">Appareils Appairés ({devices.length})</h4>
                  <p className="text-zinc-400 text-[11px]">Tous les téléphones et tablettes synchronisés avec ce classeur</p>
                </div>
                <button
                  onClick={fetchDevices}
                  disabled={loading}
                  className="px-2.5 py-1 rounded-lg bg-surface-muted hover:bg-zinc-700 text-zinc-300 border border-border flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-blue-400' : ''}`} />
                  <span>Actualiser</span>
                </button>
              </div>

              {devices.length === 0 ? (
                <div className="p-8 rounded-2xl bg-surface-elevated/20 border border-dashed border-border text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 flex items-center justify-center mx-auto text-zinc-500">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-zinc-300">Aucun appareil connecté pour le moment</p>
                    <p className="text-zinc-500 text-[11px] max-w-xs mx-auto">
                      Scannez le QR Code depuis l'onglet précédent avec votre téléphone pour l'associer.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('qr')}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors shadow-lg shadow-blue-500/20 inline-flex items-center gap-1.5"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Afficher le QR Code</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {devices.map((dev) => (
                    <div
                      key={dev.id}
                      className="p-3.5 rounded-xl bg-surface-elevated/40 border border-border flex items-center justify-between hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-300">
                          {dev.platform === 'ios' ? (
                            <Smartphone className="w-5 h-5 text-purple-400" />
                          ) : dev.platform === 'android' ? (
                            <Smartphone className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Tablet className="w-5 h-5 text-blue-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{dev.deviceName}</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />
                              Synchronisé
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 font-mono">
                            IP : {dev.ip} • Vu {formatTimeAgo(dev.lastSeenAt)}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveDevice(dev.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Dissocier cet appareil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-white">Guide Pas-à-Pas d'Appairage</h4>
              
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <span className="font-bold text-purple-400 text-xs flex items-center gap-2">
                    <span>🍏</span> Sur iPhone / iPad (iOS Safari)
                  </span>
                  <ol className="space-y-1.5 text-zinc-400 text-[11px] list-decimal list-inside leading-relaxed">
                    <li>Scannez le QR Code avec l'application <strong>Appareil Photo</strong> d'iOS.</li>
                    <li>Cliquez sur le lien jaune qui s'affiche pour ouvrir Safari.</li>
                    <li>Appuyez sur le bouton <strong>Partager</strong> en bas, puis <strong>« Sur l'écran d'accueil »</strong>.</li>
                    <li>L'icône Cours s'installe comme une vraie application autonome !</li>
                  </ol>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <span className="font-bold text-emerald-400 text-xs flex items-center gap-2">
                    <span>🤖</span> Sur Google Pixel / Android (Chrome)
                  </span>
                  <ol className="space-y-1.5 text-zinc-400 text-[11px] list-decimal list-inside leading-relaxed">
                    <li>Scannez le QR Code avec l'appareil photo ou Google Lens.</li>
                    <li>Chrome s'ouvre : cliquez sur <strong>« Installer l'application »</strong> en bas.</li>
                    <li>Votre téléphone est connecté à votre ordinateur en temps réel !</li>
                  </ol>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <span className="font-bold text-blue-400 text-xs flex items-center gap-2">
                    <span>🌍</span> En 4G à l'extérieur (Amphi, Transports)
                  </span>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    Installez gratuitement <strong>Tailscale</strong> sur votre Mac/PC et votre téléphone. Vous pourrez réviser et synchroniser vos cours même à 500 km de chez vous via un tunnel privé chiffré !
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-elevated/40 flex items-center justify-between text-xs">
          <span className="text-zinc-500 font-mono text-[11px]">Port {port} • Mode Local-First</span>
          <button
            onClick={() => closeModal('devicePairing')}
            className="px-4 py-2 rounded-xl bg-surface-muted hover:bg-zinc-700 text-zinc-200 font-bold transition-colors"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}
