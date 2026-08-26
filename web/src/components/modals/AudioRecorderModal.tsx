import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mic,
  Square,
  Pause,
  Play,
  Flame,
  HelpCircle,
  Lightbulb,
  AlertTriangle,
  Camera,
  Trash2,
  Bookmark,
  Radio,
  Sparkles,
  Save,
  CheckCircle2,
  ImageIcon,
} from 'lucide-react';
import type { RecordingMarker, Subject, ChapterDefinition } from '../../lib/types';
import { cn, formatTimeWithHours, playAudioFeedback } from '../../lib/utils';

const MARKER_TYPES = [
  {
    type: 'important' as const,
    label: 'Important',
    icon: Flame,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  {
    type: 'confused' as const,
    label: 'Pas compris',
    icon: HelpCircle,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
  },
  {
    type: 'example' as const,
    label: 'Exemple',
    icon: Lightbulb,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  {
    type: 'trap' as const,
    label: 'Piège exam',
    icon: AlertTriangle,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
  },
];

interface CapturedPhoto {
  id: string;
  url: string;
  file?: File;
  timestampSeconds: number;
}

interface AudioRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects?: Subject[];
  chapters?: ChapterDefinition[];
  onSaveRecording?: (data: {
    title: string;
    subjectId: string;
    chapterId?: string;
    kind: string;
    durationMs: number;
    markers: RecordingMarker[];
    liveTranscript: string;
    photos?: CapturedPhoto[];
  }) => void;
}

export const AudioRecorderModal: React.FC<AudioRecorderModalProps> = ({
  isOpen,
  onClose,
  subjects = [],
  chapters = [],
  onSaveRecording,
}) => {
  // Course Metadata Form
  const [courseTitle, setCourseTitle] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id || '');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [courseKind, setCourseKind] = useState<'CM' | 'TD' | 'TP'>('CM');

  // Recorder State
  const [status, setStatus] = useState<'idle' | 'recording' | 'paused' | 'stopped'>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [markers, setMarkers] = useState<RecordingMarker[]>([]);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [micVolume, setMicVolume] = useState(0);
  const [lastAddedMarkerNotice, setLastAddedMarkerNotice] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Available chapters filtered by selected subject
  const filteredChapters = chapters.filter((c) => c.subjectId === selectedSubjectId);

  // Reset or set default subject if none
  useEffect(() => {
    if (!selectedSubjectId && subjects.length > 0) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [selectedSubjectId, subjects]);

  // Cleanup on unmount or close
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  // Set default title when subject/kind changes
  useEffect(() => {
    if (!courseTitle && selectedSubjectId) {
      const sub = subjects.find((s) => s.id === selectedSubjectId);
      const today = new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
      });
      setCourseTitle(`${courseKind} ${sub?.title?.split(' ')[0] || 'Cours'} - ${today}`);
    }
  }, [courseKind, courseTitle, selectedSubjectId, subjects]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const avg = sum / bufferLength;
        setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch {
      // Fallback animated VU-meter
      const iv = window.setInterval(() => {
        setMicVolume(Math.floor(Math.random() * 40) + 25);
      }, 100);
      animFrameRef.current = iv;
    }

    // Try Speech Recognition for real live transcription
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      try {
        const recognition = new SpeechRecognitionClass();
        recognition.lang = 'fr-FR';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event: any) => {
          let text = '';
          for (let i = 0; i < event.results.length; i++) {
            text += event.results[i][0].transcript + ' ';
          }
          setLiveTranscript(text);
        };
        recognition.start();
        recognitionRef.current = recognition;
      } catch {}
    }

    setStatus('recording');
    playAudioFeedback('marker');

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  };

  const pauseRecording = () => {
    if (status === 'recording') {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setStatus('paused');
      playAudioFeedback('click');
    }
  };

  const resumeRecording = () => {
    if (status === 'paused') {
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {}
      }
      setStatus('recording');
      playAudioFeedback('click');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setStatus('stopped');
    playAudioFeedback('success');
  };

  const addMarker = (type: RecordingMarker['type'], label: string) => {
    // If not recording, start recording automatically first!
    if (status === 'idle') {
      startRecording();
    }

    const currentSec = elapsedSeconds;
    const newMarker: RecordingMarker = {
      id: `marker-${Date.now()}`,
      offsetMs: currentSec * 1000,
      type,
      label,
      note: '',
    };
    setMarkers((prev) => [...prev, newMarker]);
    playAudioFeedback('marker');

    setLastAddedMarkerNotice(`Repère "${label}" ajouté à ${formatTimeWithHours(currentSec)}`);
    setTimeout(() => setLastAddedMarkerNotice(null), 3000);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Auto-start recording if idle
    if (status === 'idle') {
      startRecording();
    }

    const currentSec = elapsedSeconds;
    Array.from(files).forEach((file, idx) => {
      const url = URL.createObjectURL(file);
      const photoId = `photo-${Date.now()}-${idx}`;

      setPhotos((prev) => [
        ...prev,
        { id: photoId, url, file, timestampSeconds: currentSec },
      ]);

      // Add a marker for each photo taken
      const newMarker: RecordingMarker = {
        id: `marker-${Date.now()}-${idx}`,
        offsetMs: currentSec * 1000,
        type: 'photo',
        label: `📸 Photo tableau #${photos.length + idx + 1}`,
        note: file.name,
      };
      setMarkers((prev) => [...prev, newMarker]);
    });

    playAudioFeedback('success');
    setLastAddedMarkerNotice(`Photo du tableau enregistrée à ${formatTimeWithHours(currentSec)}`);
    setTimeout(() => setLastAddedMarkerNotice(null), 3000);

    // Reset input
    e.target.value = '';
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    playAudioFeedback('click');
  };

  const updateMarkerNote = (id: string, note: string) => {
    setMarkers((prev) => prev.map((m) => (m.id === id ? { ...m, note } : m)));
  };

  const deleteMarker = (id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
    playAudioFeedback('click');
  };

  const handleSave = () => {
    if (!courseTitle.trim()) {
      alert('Veuillez entrer un titre pour le cours.');
      return;
    }

    onSaveRecording?.({
      title: courseTitle,
      subjectId: selectedSubjectId,
      chapterId: selectedChapterId || undefined,
      kind: courseKind,
      durationMs: Math.max(1000, elapsedSeconds * 1000),
      markers,
      liveTranscript,
      photos,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-surface border border-border shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <header className="h-16 px-6 border-b border-border bg-surface-elevated flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 font-bold">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                Studio d'Enregistrement Amphi
                {status === 'recording' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-mono border border-red-500/30 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    REC
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400">
                Enregistre l'audio, prends des photos du tableau et pose des repères
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-surface border border-transparent hover:border-border transition"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Metadata Section */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-surface-elevated border border-border">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-zinc-300 mb-1 block">
                Titre du cours
              </label>
              <input
                type="text"
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
                placeholder="ex: CM Biologie Cellulaire - Mitose"
                className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 mb-1 block">Matière</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => {
                  setSelectedSubjectId(e.target.value);
                  setSelectedChapterId('');
                }}
                className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 mb-1 block">Type</label>
              <div className="flex rounded-xl bg-surface border border-border p-0.5">
                {(['CM', 'TD', 'TP'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setCourseKind(k)}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-xs font-bold transition',
                      courseKind === k
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Central Recording Console */}
          <div className="p-6 sm:p-8 rounded-3xl bg-surface-elevated/80 border border-border flex flex-col items-center justify-center gap-5 shadow-xl relative overflow-hidden">
            {/* Giant Chrono Display */}
            <div className="flex flex-col items-center">
              <div className="text-6xl sm:text-7xl font-mono font-black tracking-widest text-white drop-shadow-lg tabular-nums">
                {formatTimeWithHours(elapsedSeconds)}
              </div>
              <div className="text-xs font-medium text-zinc-400 mt-2 flex items-center gap-2">
                {status === 'recording' ? (
                  <span className="text-red-400 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    Enregistrement en direct...
                  </span>
                ) : status === 'paused' ? (
                  <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                    <Pause className="w-3.5 h-3.5" /> En pause
                  </span>
                ) : status === 'stopped' ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Séance terminée ({elapsedSeconds}s)
                  </span>
                ) : (
                  <span className="text-zinc-400">Microphone prêt • Clique pour démarrer</span>
                )}
              </div>
            </div>

            {/* Live Audio Waves */}
            <div className="w-full max-w-md h-8 flex items-center justify-center gap-1 px-4 rounded-xl bg-surface border border-border">
              {Array.from({ length: 28 }).map((_, i) => {
                const isActive = status === 'recording';
                const height = isActive
                  ? Math.max(
                      15,
                      Math.min(
                        100,
                        micVolume * (0.4 + Math.sin(i * 0.5 + elapsedSeconds * 3) * 0.6)
                      )
                    )
                  : 10;
                return (
                  <div
                    key={i}
                    style={{ height: `${height}%` }}
                    className={cn(
                      'w-1.5 rounded-full transition-all duration-75',
                      isActive
                        ? 'bg-gradient-to-t from-red-500 to-amber-400'
                        : 'bg-zinc-700'
                    )}
                  />
                );
              })}
            </div>

            {/* Transport Control Buttons */}
            <div className="flex items-center gap-3">
              {status === 'idle' && (
                <button
                  onClick={startRecording}
                  className="px-8 py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-xl shadow-red-500/25 flex items-center gap-2.5 transition active:scale-95"
                >
                  <Mic className="w-5 h-5" />
                  <span>Démarrer l'enregistrement</span>
                </button>
              )}

              {status === 'recording' && (
                <>
                  <button
                    onClick={pauseRecording}
                    className="p-3.5 rounded-2xl bg-surface hover:bg-surface-muted border border-border text-zinc-200 shadow-md transition active:scale-95"
                    title="Mettre en pause"
                  >
                    <Pause className="w-5 h-5" />
                  </button>
                  <button
                    onClick={stopRecording}
                    className="px-6 py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-xl shadow-red-500/25 flex items-center gap-2 transition active:scale-95"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Arrêter l'enregistrement</span>
                  </button>
                </>
              )}

              {status === 'paused' && (
                <>
                  <button
                    onClick={resumeRecording}
                    className="px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-500/25 flex items-center gap-2 transition active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Reprendre</span>
                  </button>
                  <button
                    onClick={stopRecording}
                    className="px-5 py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-xl shadow-red-500/25 flex items-center gap-2 transition active:scale-95"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Terminer</span>
                  </button>
                </>
              )}

              {status === 'stopped' && (
                <div className="w-full space-y-4 text-left">
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-emerald-400" />
                      <div>
                        <div className="text-xs font-black uppercase tracking-wider text-emerald-300">
                          🏁 Récapitulatif de Fin d'Amphi
                        </div>
                        <div className="text-xs text-zinc-300">
                          Durée totale : <strong>{formatTimeWithHours(elapsedSeconds)}</strong> • {photos.length} photos • {markers.length} repères
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setStatus('idle');
                        setElapsedSeconds(0);
                        setMarkers([]);
                        setPhotos([]);
                        setLiveTranscript('');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-muted border border-border text-zinc-400 hover:text-red-400 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Recommencer</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={handleSave}
                      className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition hover:scale-105 active:scale-95"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-200" />
                      <span>✨ Valider et synchroniser pour Antigravity</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Marker Notification Banner */}
            {lastAddedMarkerNotice && status !== 'stopped' && (
              <div className="text-xs px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-in fade-in flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{lastAddedMarkerNotice}</span>
              </div>
            )}
          </div>

          {/* Quick Actions: Markers & Camera Photo */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
              <span>Repères d'amphi (1 Clic)</span>
              <span className="text-[11px] text-zinc-500 font-normal">
                Horodatage en temps réel
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {MARKER_TYPES.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => addMarker(item.type, item.label)}
                    className={cn(
                      'p-3 rounded-2xl border text-left flex flex-col gap-2 transition active:scale-95 cursor-pointer shadow-md hover:brightness-125',
                      item.bg,
                      item.border
                    )}
                  >
                    <Icon className={cn('w-5 h-5', item.color)} />
                    <span className="text-xs font-bold text-zinc-100">{item.label}</span>
                  </button>
                );
              })}

              {/* Real Camera Capture Button */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="p-3 rounded-2xl border text-left flex flex-col gap-2 transition active:scale-95 cursor-pointer shadow-md hover:brightness-125 bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
              >
                <Camera className="w-5 h-5 text-cyan-400" />
                <span className="text-xs font-bold text-zinc-100">📸 Photo tableau</span>
              </button>

              {/* Hidden File / Camera Input */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={handlePhotoCapture}
              />
            </div>
          </div>

          {/* Photos Captured Gallery */}
          {photos.length > 0 && (
            <div className="p-4 rounded-2xl bg-surface-elevated border border-border space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                <span>Photos du tableau prises ({photos.length})</span>
                <ImageIcon className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative group aspect-square rounded-xl overflow-hidden border border-border bg-black"
                  >
                    <img
                      src={photo.url}
                      alt="Photo tableau"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => removePhoto(photo.id)}
                        className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500"
                        title="Supprimer la photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono text-zinc-300">
                      {formatTimeWithHours(photo.timestampSeconds)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline of Recorded Markers */}
          {markers.length > 0 && (
            <div className="p-4 rounded-2xl bg-surface-elevated border border-border">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center justify-between">
                <span>Journal des repères ({markers.length})</span>
                <Bookmark className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
                {markers.map((marker) => {
                  return (
                    <div
                      key={marker.id}
                      className="p-2.5 rounded-xl bg-surface border border-border flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[11px] text-blue-400 font-bold px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                          {formatTimeWithHours(marker.offsetMs / 1000)}
                        </span>
                        <span className="font-bold text-zinc-200">{marker.label}</span>
                      </div>
                      <input
                        type="text"
                        value={marker.note || ''}
                        onChange={(e) => updateMarkerNote(marker.id, e.target.value)}
                        placeholder="Ajouter une note..."
                        className="flex-1 max-w-sm px-2.5 py-1 rounded-lg bg-surface-elevated border border-border text-zinc-200 text-xs focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={() => deleteMarker(marker.id)}
                        className="text-zinc-500 hover:text-red-400 p-1 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Transcription Box */}
          <div className="p-4 rounded-2xl bg-surface-elevated border border-border">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Transcription en direct
              </span>
              <span className="text-[10px] text-zinc-500">Moteur Reconnaissance Vocale</span>
            </div>
            <textarea
              value={liveTranscript}
              onChange={(e) => setLiveTranscript(e.target.value)}
              placeholder="La transcription automatique s'affichera ici au fur et à mesure que le professeur parle..."
              rows={3}
              className="w-full p-3 rounded-xl bg-surface border border-border text-xs text-zinc-300 leading-relaxed focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <footer className="h-16 px-6 border-t border-border bg-surface-elevated flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-400">
            {elapsedSeconds > 0 && `Durée : ${formatTimeWithHours(elapsedSeconds)}`}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-surface text-xs font-semibold transition"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
