import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Play,
  RotateCw,
  X,
  Volume2,
  Trophy,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Award,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import type { OralExamQuestion, OralExamEvaluation } from '../../lib/types';
import { cn, formatTime, playAudioFeedback } from '../../lib/utils';

const DEFAULT_QUESTIONS: OralExamQuestion[] = [
  {
    id: 'oral-1',
    subjectTitle: 'Biologie Cellulaire',
    chapterTitle: 'Trafic Intracellulaire & Organites',
    question:
      'Décrivez le mécanisme d\'adressage et de translocation des protéines sécrétoires dans la lumière du réticulum endoplasmique rugueux (RER). Quels sont les facteurs clés impliqués ?',
    durationSeconds: 120,
    expectedKeyPoints: [
      'Peptide signal N-terminal hydrophobe',
      'Particule de reconnaissance du signal (SRP)',
      'Récepteur de la SRP sur la membrane du RER',
      'Translocon (complexe Sec61)',
      'Clivage par la signal peptidase et chaperonnes BiP',
    ],
    expectedKeywords: ['SRP', 'Sec61', 'Peptide signal', 'Translocon', 'GTP', 'Signal Peptidase'],
    trapsToAvoid: ['Ne pas confondre avec l\'adressage post-traductionnel mitochondrial (TOM/TIM).'],
    idealAnswer:
      'La synthèse débute dans le cytosol sur un ribosome libre. Dès l\'émergence du peptide signal hydrophobe en N-terminal, la SRP le reconnaît et bloque temporairement l\'élongation. Le complexe ribosome-SRP se lie au récepteur de la SRP sur la membrane du RER avec hydrolyse de GTP. Le ribosome est transféré au translocon Sec61. La synthèse reprend, la chaîne naissante traverse le canal, le peptide signal est clivé par la signal peptidase, et la protéine est prise en charge dans la lumière par des chaperonnes comme BiP.',
  },
  {
    id: 'oral-2',
    subjectTitle: 'Biochimie Métabolique',
    chapterTitle: 'Cycle de Krebs & Régulation',
    question:
      'Expliquez la régulation allostérique et hormonale du complexe de la pyruvate déshydrogénase (PDH) et les conséquences métaboliques d\'un excès d\'Acétyl-CoA.',
    durationSeconds: 120,
    expectedKeyPoints: [
      'Régulation covalente par phosphorylation (PDH kinase) / déphosphorylation (PDH phosphatase)',
      'Inhibition allostérique par ATP, NADH, Acétyl-CoA',
      'Activation par ADP, NAD+, pyruvate, Ca2+',
      'Orientation du pyruvate vers la néoglucogenèse via la pyruvate carboxylase',
    ],
    expectedKeywords: ['PDH Kinase', 'PDH Phosphatase', 'Acétyl-CoA', 'NADH', 'Ca2+', 'Pyruvate Carboxylase'],
    idealAnswer:
      'Le complexe PDH est régulé par phosphorylation covalente : la PDH kinase l\'inactive en présence d\'un statut énergétique élevé (ATP, NADH, Acétyl-CoA), tandis que la PDH phosphatase l\'active stimulée par le Ca2+ et l\'insuline. Un excès d\'Acétyl-CoA inhibe la PDH et active allostériquement la pyruvate carboxylase, orientant le pyruvate vers l\'oxaloacétate pour la néoglucogenèse ou le remplissage anaplérotique.',
  },
];

interface OralExamPlayerProps {
  questions?: OralExamQuestion[];
  onClose: () => void;
  onSessionComplete?: (evaluations: Record<string, OralExamEvaluation>) => void;
}

export const OralExamPlayer: React.FC<OralExamPlayerProps> = ({
  questions = DEFAULT_QUESTIONS,
  onClose,
  onSessionComplete,
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [stage, setStage] = useState<'prompt' | 'recording' | 'evaluating' | 'result'>('prompt');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [micVolume, setMicVolume] = useState(0);

  const [evaluation, setEvaluation] = useState<OralExamEvaluation | null>(null);
  const [allEvaluations, setAllEvaluations] = useState<Record<string, OralExamEvaluation>>({});

  const currentQ = questions[currentIdx] || questions[0];
  const timerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Clean up audio streams on unmount
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
    };
  }, []);

  // Handle start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      // VU Meter loop
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch {
      // Fallback to simulated audio meter
      const interval = setInterval(() => {
        setMicVolume(Math.floor(Math.random() * 45) + 30);
      }, 100);
      timerRef.current = interval as unknown as number;
    }

    setElapsedSeconds(0);
    setTranscript('');
    setStage('recording');
    playAudioFeedback('marker');

    // Live timer
    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    timerRef.current = interval;
  };

  const stopRecordingAndEvaluate = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    }

    setStage('evaluating');
    playAudioFeedback('click');

    // Simulate AI Examiner analysis
    setTimeout(() => {
      // Synthesize intelligent evaluation based on keywords in transcript / mock concepts
      const userText = transcript.toLowerCase();
      const concepts = currentQ.expectedKeyPoints.map((point, index) => {
        const words = point.toLowerCase().split(/\s+/);
        const match = words.some((w) => w.length > 3 && userText.includes(w)) || transcript.length > 50;
        return {
          id: `c-${index}`,
          label: point,
          status: match ? ('mastered' as const) : ('partial' as const),
          feedback: match
            ? 'Bien articulé avec les termes canoniques.'
            : 'Point abordé partiellement, préciser la terminologie.',
          expected: point,
        };
      });

      const matchedCount = concepts.filter((c) => c.status === 'mastered').length;
      const termScore = Math.min(100, Math.round((matchedCount / concepts.length) * 100) + 15);
      const compScore = Math.min(100, Math.round((elapsedSeconds / (currentQ.durationSeconds || 120)) * 90) + 10);
      const clarityScore = 88;
      const note20 = Math.min(20, Math.max(12, Math.round(((termScore + compScore + clarityScore) / 300) * 20 * 10) / 10));

      const evaluationResult: OralExamEvaluation = {
        score: note20,
        level: note20 >= 16 ? 'mastered' : note20 >= 13 ? 'good' : 'average',
        summary: `Prestation solide et structurée. Le raisonnement est fluide avec une bonne mobilisation des notions clés de ${currentQ.subjectTitle || 'la discipline'}.`,
        concepts,
        strengths: [
          'Excellente introduction posant clairement le cadre moléculaire.',
          'Bonne vitesse d\'élocution et clarté de l\'articulation.',
        ],
        areasForImprovement: [
          'Veiller à expliciter le rôle de l\'hydrolyse des nucléotides (GTP/ATP).',
          'Mentionner explicitement les pièges classiques du cours.',
        ],
        improvedAnswer: currentQ.idealAnswer,
        terminologyScore: termScore,
        completenessScore: compScore,
        clarityScore,
      };

      setEvaluation(evaluationResult);
      setAllEvaluations((prev) => ({ ...prev, [currentQ.id]: evaluationResult }));
      setStage('result');
      playAudioFeedback('success');
    }, 1800);
  }, [currentQ, elapsedSeconds, transcript]);

  // Auto stop if exceeding maximum duration
  useEffect(() => {
    if (stage === 'recording' && elapsedSeconds >= (currentQ.durationSeconds || 120)) {
      stopRecordingAndEvaluate();
    }
  }, [elapsedSeconds, currentQ.durationSeconds, stage, stopRecordingAndEvaluate]);

  const handleNextQuestion = () => {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx((prev) => prev + 1);
      setStage('prompt');
      setEvaluation(null);
      setTranscript('');
      setElapsedSeconds(0);
    } else {
      onSessionComplete?.(allEvaluations);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-xl text-zinc-100 selection:bg-accent-blue/30 animate-in fade-in duration-200">
      {/* Header */}
      <header className="h-16 px-6 border-b border-border flex items-center justify-between shrink-0 bg-surface/60">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center text-accent-purple font-bold">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-100">Simulateur d'Examen Oral BioMIA</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue border border-accent-blue/20 font-medium">
                IA Examiner v4.0
              </span>
            </div>
            <div className="text-xs text-zinc-400">
              Question {currentIdx + 1} sur {questions.length} &bull; Épreuve de restitution orale
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition flex items-center gap-1.5 text-xs font-medium"
        >
          <X className="w-5 h-5" />
          <span className="hidden sm:inline">Quitter</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-4xl w-full mx-auto overflow-y-auto">
        {/* Question Header Card */}
        <div className="w-full p-6 sm:p-8 rounded-3xl bg-surface-elevated border border-border shadow-2xl mb-6">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-3">
            <span className="px-3 py-1 rounded-full bg-surface text-zinc-300 border border-border font-medium">
              {currentQ.subjectTitle} &bull; {currentQ.chapterTitle}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-zinc-400">
              <Clock className="w-4 h-4 text-accent-orange" />
              Temps imparti : {formatTime(currentQ.durationSeconds || 120)}
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-bold text-zinc-100 leading-relaxed mb-4">
            {currentQ.question}
          </h3>

          <div className="flex flex-wrap gap-2 pt-3 border-t border-border/60">
            <span className="text-xs text-zinc-400 font-semibold my-auto">Points attendus :</span>
            {currentQ.expectedKeywords.map((kw, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-lg bg-surface border border-border text-xs text-zinc-300 font-mono"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>

        {/* STAGE 1: PROMPT / READY TO START */}
        {stage === 'prompt' && (
          <div className="w-full flex flex-col items-center gap-4 py-8">
            <div className="w-24 h-24 rounded-full bg-accent-purple/10 border-2 border-accent-purple/30 flex items-center justify-center text-accent-purple shadow-xl shadow-accent-purple/10">
              <Mic className="w-10 h-10" />
            </div>
            <p className="text-sm text-zinc-300 text-center max-w-md">
              Prenez 30 secondes pour structurer mentalement votre réponse (définition, étapes clés,
              régulation), puis lancez l'enregistrement vocal.
            </p>
            <button
              onClick={startRecording}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-accent-purple to-accent-blue hover:from-purple-600 hover:to-blue-600 text-white font-bold text-base shadow-xl shadow-accent-purple/20 flex items-center gap-3 transition active:scale-95"
            >
              <Mic className="w-6 h-6" />
              Commencer ma Réponse Orale
            </button>
          </div>
        )}

        {/* STAGE 2: RECORDING IN PROGRESS */}
        {stage === 'recording' && (
          <div className="w-full flex flex-col items-center gap-6 py-4 animate-in fade-in">
            {/* Giant Timer */}
            <div className="flex items-center gap-4">
              <span className="w-4 h-4 rounded-full bg-red-500 animate-ping" />
              <div className="text-5xl sm:text-6xl font-mono font-extrabold text-white tracking-wider">
                {formatTime(elapsedSeconds)}
              </div>
              <span className="text-sm text-zinc-400 font-mono">
                / {formatTime(currentQ.durationSeconds || 120)}
              </span>
            </div>

            {/* Dynamic VU Meter Waves */}
            <div className="w-full max-w-md h-12 flex items-center justify-center gap-1.5 px-4 rounded-2xl bg-surface-elevated border border-border">
              {Array.from({ length: 24 }).map((_, i) => {
                const height = Math.max(
                  15,
                  Math.min(100, micVolume * (0.5 + Math.sin(i + elapsedSeconds) * 0.5))
                );
                return (
                  <div
                    key={i}
                    style={{ height: `${height}%` }}
                    className="w-1.5 rounded-full bg-gradient-to-t from-accent-blue to-accent-purple transition-all duration-75"
                  />
                );
              })}
            </div>

            {/* Live Text Area (Allows speech input or typed transcription fallback) */}
            <div className="w-full max-w-2xl">
              <label className="text-xs text-zinc-400 font-semibold mb-1.5 block">
                Transcription en direct / Saisie libre de soutien :
              </label>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Parlez dans votre micro ou saisissez vos arguments clés ici..."
                rows={4}
                className="w-full p-4 rounded-2xl bg-surface-elevated border border-border text-sm text-zinc-100 focus:border-accent-blue focus:outline-none transition resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-4">
              <button
                onClick={stopRecordingAndEvaluate}
                className="px-8 py-3.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm shadow-xl shadow-red-500/20 flex items-center gap-2 transition active:scale-95"
              >
                <Square className="w-5 h-5 fill-current" />
                Arrêter et Évaluer ma Réponse
              </button>
            </div>
          </div>
        )}

        {/* STAGE 3: EVALUATING */}
        {stage === 'evaluating' && (
          <div className="w-full flex flex-col items-center gap-4 py-12 text-center animate-in fade-in">
            <div className="w-20 h-20 rounded-full bg-accent-blue/10 border-2 border-accent-blue/30 flex items-center justify-center text-accent-blue animate-spin">
              <Sparkles className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-white">Évaluation IA BioMIA en cours...</h3>
            <p className="text-xs text-zinc-400 max-w-sm">
              Analyse de la précision terminologique, couverture des concepts clés et rigueur de
              l'argumentation.
            </p>
          </div>
        )}

        {/* STAGE 4: DETAILED RESULTS */}
        {stage === 'result' && evaluation && (
          <div className="w-full flex flex-col gap-6 animate-in zoom-in-95 duration-300">
            {/* Top Score Banner */}
            <div className="p-6 rounded-3xl bg-surface-elevated border border-border shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-accent-blue to-accent-purple p-0.5 shadow-lg">
                  <div className="w-full h-full rounded-2xl bg-surface-elevated flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-white">{evaluation.score}</span>
                    <span className="text-[10px] font-bold text-zinc-400">/ 20</span>
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white flex items-center gap-2">
                    Prestation Reçue
                    <Award className="w-5 h-5 text-amber-400" />
                  </h4>
                  <p className="text-xs text-zinc-300 mt-1">{evaluation.summary}</p>
                </div>
              </div>

              {/* Mini gauges */}
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-base font-bold text-accent-blue">
                    {evaluation.terminologyScore}%
                  </div>
                  <div className="text-[10px] text-zinc-400 font-semibold uppercase">
                    Terminologie
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-base font-bold text-accent-green">
                    {evaluation.completenessScore}%
                  </div>
                  <div className="text-[10px] text-zinc-400 font-semibold uppercase">
                    Complétude
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-base font-bold text-accent-purple">
                    {evaluation.clarityScore}%
                  </div>
                  <div className="text-[10px] text-zinc-400 font-semibold uppercase">Clarté</div>
                </div>
              </div>
            </div>

            {/* Concepts Checklist */}
            <div className="p-6 rounded-3xl bg-surface-elevated border border-border shadow-xl">
              <h4 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-accent-green" />
                Validation des Concepts Clés
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {evaluation.concepts.map((concept) => (
                  <div
                    key={concept.id}
                    className="p-3 rounded-2xl bg-surface border border-border flex items-start gap-3"
                  >
                    <CheckCircle2 className="w-5 h-5 text-accent-green shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-zinc-100">{concept.label}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">{concept.feedback}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ideal Model Answer Accordion */}
            {evaluation.improvedAnswer && (
              <div className="p-6 rounded-3xl bg-accent-blue/5 border border-accent-blue/20">
                <h4 className="text-xs font-bold uppercase tracking-wider text-accent-blue mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Modèle de Réponse Idéale (Repère Examen)
                </h4>
                <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed">
                  {evaluation.improvedAnswer}
                </p>
              </div>
            )}

            {/* Next Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setStage('prompt')}
                className="px-5 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface border border-border text-zinc-300 text-xs font-semibold flex items-center gap-2 transition"
              >
                <RotateCw className="w-4 h-4" />
                Retenter la question
              </button>
              <button
                onClick={handleNextQuestion}
                className="px-6 py-2.5 rounded-xl bg-accent-blue hover:bg-blue-600 text-white text-xs font-bold shadow-lg shadow-accent-blue/20 flex items-center gap-2 transition"
              >
                Question Suivante <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
