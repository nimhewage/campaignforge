"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  X, Upload, FileText, Loader2, Check, AlertTriangle,
  Trash2, BookOpen, Plus, Sparkles, RefreshCw, ChevronDown,
  Settings2, Database, Zap, Clock, Hash, BarChart3,
  Activity, CircleDot, Cpu, FlaskConical,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface KBEntry {
  id: string;
  name: string;
  sampleCount: number;
  addedAt: number;
  text: string;
  wordCount: number;
  charCount: number;
}

type TrainStatus = "idle" | "preparing" | "uploading" | "validating" | "training" | "complete" | "error";

interface TrainEvent {
  time: number;
  type: "info" | "warning" | "success" | "error";
  message: string;
}

interface CheckpointMetric {
  step: number;
  trainLoss?: number;
  validLoss?: number;
  epoch?: number;
}

interface TrainJob {
  status: TrainStatus;
  jobId?: string;
  modelId?: string;
  error?: string;
  progress?: number;
  trainedTokens?: number;
  totalSteps?: number;
  currentStep?: number;
  events: TrainEvent[];
  checkpoints: CheckpointMetric[];
  startedAt?: number;
  estimatedSeconds?: number;
  baseModel?: string;
  sampleCount?: number;
  estimatedTokens?: number;
}

interface HyperParams {
  learningRate: number;
  trainingSteps: number;
  epochs: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onModelReady: (modelId: string | null) => void;
  activeModelId: string | null;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const BASE_MODELS = [
  { id: "open-mistral-7b", name: "Mistral 7B", desc: "Fast, cost-effective", tier: "starter" },
  { id: "open-mistral-nemo", name: "Mistral Nemo", desc: "12B balanced model", tier: "standard" },
  { id: "mistral-small-latest", name: "Mistral Small", desc: "Strong efficiency", tier: "standard" },
  { id: "mistral-large-latest", name: "Mistral Large", desc: "Maximum quality", tier: "premium" },
];

const TIER_COLORS: Record<string, string> = {
  starter: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  standard: "text-brand bg-brand/10 border-brand/20",
  premium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
};

const DEFAULT_HYPER: HyperParams = { learningRate: 0.0001, trainingSteps: 50, epochs: 3 };

const PERSIST_KEY = "cf_knowledge_entries";
const MODEL_KEY = "cf_custom_model";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function countSamples(text: string): number {
  return text.split(/\n\s*\n/).filter((p) => p.trim().length > 40).length || 1;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.8);
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function loadEntries(): KBEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveEntries(entries: KBEntry[]) {
  localStorage.setItem(PERSIST_KEY, JSON.stringify(entries));
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function MetricCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-surface-2/40 border border-edge rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3 h-3 ${color || "text-tx-3"}`} />
        <span className="text-[9px] font-medium text-tx-4 uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-[16px] font-bold tabular-nums ${color || "text-tx-0"}`}>{value}</p>
      {sub && <p className="text-[9px] text-tx-4 mt-0.5">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string; pulse?: boolean }> = {
    QUEUED: { color: "text-tx-3 bg-surface-3/60 border-edge", label: "Queued" },
    STARTED: { color: "text-brand bg-brand/10 border-brand/20", label: "Starting", pulse: true },
    VALIDATING: { color: "text-amber-400 bg-amber-400/10 border-amber-400/20", label: "Validating", pulse: true },
    VALIDATED: { color: "text-ok bg-ok/10 border-ok/20", label: "Validated" },
    RUNNING: { color: "text-brand bg-brand/10 border-brand/20", label: "Training", pulse: true },
    SUCCESS: { color: "text-ok bg-ok/10 border-ok/20", label: "Complete" },
    FAILED: { color: "text-fail bg-fail/10 border-fail/20", label: "Failed" },
    FAILED_VALIDATION: { color: "text-fail bg-fail/10 border-fail/20", label: "Validation Failed" },
    CANCELLED: { color: "text-tx-3 bg-surface-3/60 border-edge", label: "Cancelled" },
  };
  const c = config[status] || config.QUEUED;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full border ${c.color}`}>
      {c.pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {c.label}
    </span>
  );
}

function EventLog({ events }: { events: TrainEvent[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [events]);

  if (!events.length) return null;

  const iconMap = { info: Activity, warning: AlertTriangle, success: Check, error: X };
  const colorMap = { info: "text-tx-3", warning: "text-amber-400", success: "text-ok", error: "text-fail" };

  return (
    <div ref={ref} className="bg-surface-0/80 border border-edge rounded-lg max-h-[140px] overflow-y-auto">
      {events.map((ev, i) => {
        const Icon = iconMap[ev.type];
        return (
          <div key={i} className="flex items-start gap-2 px-3 py-1.5 border-b border-edge last:border-0">
            <Icon className={`w-3 h-3 mt-0.5 flex-shrink-0 ${colorMap[ev.type]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-tx-2 font-mono leading-relaxed">{ev.message}</p>
            </div>
            <span className="text-[9px] text-tx-4 tabular-nums flex-shrink-0 font-mono">
              {new Date(ev.time).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CheckpointChart({ checkpoints }: { checkpoints: CheckpointMetric[] }) {
  if (checkpoints.length < 2) return null;

  const maxLoss = Math.max(...checkpoints.map((c) => c.trainLoss || 0));
  const minLoss = Math.min(...checkpoints.map((c) => c.trainLoss || 0));
  const range = maxLoss - minLoss || 1;
  const h = 60;
  const w = 200;
  const step = w / (checkpoints.length - 1);

  const points = checkpoints.map((c, i) => {
    const y = h - ((((c.trainLoss || 0) - minLoss) / range) * (h - 10) + 5);
    return `${i * step},${y}`;
  }).join(" ");

  return (
    <div className="bg-surface-0/80 border border-edge rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-medium text-tx-4 uppercase tracking-wider">Training Loss</span>
        <span className="text-[10px] text-ok font-mono tabular-nums">
          {checkpoints[checkpoints.length - 1]?.trainLoss?.toFixed(4) || "---"}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[60px]">
        <defs>
          <linearGradient id="lossGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(129,140,248)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(129,140,248)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,${h} ${points} ${w},${h}`}
          fill="url(#lossGrad)"
        />
        <polyline
          points={points}
          fill="none"
          stroke="rgb(129,140,248)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {checkpoints.map((c, i) => (
          <circle
            key={i}
            cx={i * step}
            cy={h - ((((c.trainLoss || 0) - minLoss) / range) * (h - 10) + 5)}
            r="2.5"
            fill="rgb(129,140,248)"
            opacity={i === checkpoints.length - 1 ? 1 : 0.4}
          />
        ))}
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-[8px] text-tx-4">Step {checkpoints[0]?.step}</span>
        <span className="text-[8px] text-tx-4">Step {checkpoints[checkpoints.length - 1]?.step}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function KnowledgeBase({ open, onClose, onModelReady, activeModelId }: Props) {
  const [entries, setEntries] = useState<KBEntry[]>(() => loadEntries());
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteName, setPasteName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [selectedModel, setSelectedModel] = useState(BASE_MODELS[0].id);
  const [hyper, setHyper] = useState<HyperParams>(DEFAULT_HYPER);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeSection, setActiveSection] = useState<"data" | "config" | "monitor">("data");

  const [trainJob, setTrainJob] = useState<TrainJob>({
    status: "idle",
    events: [],
    checkpoints: [],
  });

  useEffect(() => {
    const saved = localStorage.getItem(MODEL_KEY);
    if (saved && !activeModelId) onModelReady(saved);
  }, [activeModelId, onModelReady]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  /* ---------- Computed stats ---------- */

  const totalSamples = entries.reduce((s, e) => s + e.sampleCount, 0);
  const totalWords = entries.reduce((s, e) => s + e.wordCount, 0);
  const totalChars = entries.reduce((s, e) => s + e.charCount, 0);
  const totalTokensEst = entries.reduce((s, e) => s + estimateTokens(e.text), 0);
  const dataQuality = totalSamples >= 50 ? "high" : totalSamples >= 20 ? "medium" : "low";
  const qualityColor = dataQuality === "high" ? "text-ok" : dataQuality === "medium" ? "text-amber-400" : "text-fail";

  /* ---------- Entry management ---------- */

  const addEntry = useCallback((name: string, text: string) => {
    const entry: KBEntry = {
      id: crypto.randomUUID(),
      name,
      sampleCount: countSamples(text),
      addedAt: Date.now(),
      text,
      wordCount: countWords(text),
      charCount: text.length,
    };
    setEntries((prev) => {
      const next = [...prev, entry];
      saveEntries(next);
      return next;
    });
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveEntries(next);
      return next;
    });
  }, []);

  /* ---------- File handling ---------- */

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) continue;
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["txt", "md", "csv", "json", "jsonl"].includes(ext || "")) continue;
      try {
        const text = await readFileAsText(file);
        addEntry(file.name, text);
      } catch { /* skip unreadable files */ }
    }
  }, [addEntry]);

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;
    addEntry(pasteName.trim() || "Pasted content", pasteText.trim());
    setPasteText("");
    setPasteName("");
    setPasteMode(false);
  };

  /* ---------- Add event helper ---------- */

  const addEvent = useCallback((type: TrainEvent["type"], message: string) => {
    setTrainJob((prev) => ({
      ...prev,
      events: [...prev.events, { time: Date.now(), type, message }],
    }));
  }, []);

  /* ---------- Training ---------- */

  const startTraining = async (dryRun = false) => {
    if (entries.length === 0) return;

    const allText = entries.map((e) => e.text).join("\n\n---\n\n");
    const estTokens = estimateTokens(allText);

    setTrainJob({
      status: "preparing",
      progress: 0,
      events: [{ time: Date.now(), type: "info", message: "Preparing training data..." }],
      checkpoints: [],
      baseModel: selectedModel,
      sampleCount: totalSamples,
      estimatedTokens: estTokens,
    });
    setActiveSection("monitor");

    try {
      addEvent("info", `Base model: ${selectedModel}`);
      addEvent("info", `Estimated tokens: ${formatNumber(estTokens)}`);
      addEvent("info", `Training samples: ${totalSamples}`);

      setTrainJob((prev) => ({ ...prev, status: "uploading", progress: 15 }));
      addEvent("info", "Uploading training data to Mistral...");

      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "train",
          text: allText,
          model: selectedModel,
          hyperparameters: {
            learning_rate: hyper.learningRate,
            training_steps: hyper.trainingSteps,
          },
          dryRun,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Training failed");
      }

      const data = await res.json();

      if (dryRun) {
        addEvent("success", `Dry run complete: ${data.sampleCount} samples, ~${formatNumber(data.estimatedTokens)} tokens`);
        addEvent("info", `Estimated training cost: ~$${data.estimatedCost?.toFixed(2) || "4.00"} minimum`);
        setTrainJob((prev) => ({
          ...prev,
          status: "idle",
          progress: 0,
          trainedTokens: data.estimatedTokens,
          sampleCount: data.sampleCount,
        }));
        return;
      }

      if (data.status === "complete") {
        addEvent("success", `Training complete! Model: ${data.modelId}`);
        setTrainJob((prev) => ({
          ...prev,
          status: "complete",
          modelId: data.modelId,
          progress: 100,
          trainedTokens: data.trainedTokens,
        }));
        localStorage.setItem(MODEL_KEY, data.modelId);
        onModelReady(data.modelId);
        return;
      }

      addEvent("success", `File uploaded. Job ID: ${data.jobId?.slice(0, 8)}...`);
      addEvent("info", "Fine-tuning job started. Monitoring progress...");

      setTrainJob((prev) => ({
        ...prev,
        status: "training",
        jobId: data.jobId,
        progress: 30,
        startedAt: Date.now(),
      }));

      let pollCount = 0;
      pollRef.current = setInterval(async () => {
        pollCount++;
        try {
          const pollRes = await fetch("/api/knowledge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "status", jobId: data.jobId }),
          });
          const pollData = await pollRes.json();

          if (pollData.events) {
            for (const ev of pollData.events) {
              addEvent("info", ev.message || ev.name || JSON.stringify(ev));
            }
          }

          if (pollData.checkpoints?.length) {
            setTrainJob((prev) => ({
              ...prev,
              checkpoints: pollData.checkpoints.map((cp: { metrics?: { train_loss?: number; valid_loss?: number }; step_number?: number }) => ({
                step: cp.step_number || 0,
                trainLoss: cp.metrics?.train_loss,
                validLoss: cp.metrics?.valid_loss,
              })),
            }));
          }

          if (pollData.trainedTokens) {
            setTrainJob((prev) => ({ ...prev, trainedTokens: pollData.trainedTokens }));
          }

          const jobStatus = pollData.status?.toUpperCase?.() || pollData.status;

          if (jobStatus === "SUCCESS") {
            if (pollRef.current) clearInterval(pollRef.current);
            addEvent("success", `Training complete! Model ready.`);
            setTrainJob((prev) => ({
              ...prev,
              status: "complete",
              modelId: pollData.modelId,
              progress: 100,
              trainedTokens: pollData.trainedTokens,
            }));
            localStorage.setItem(MODEL_KEY, pollData.modelId);
            onModelReady(pollData.modelId);
          } else if (jobStatus === "FAILED" || jobStatus === "FAILED_VALIDATION") {
            if (pollRef.current) clearInterval(pollRef.current);
            addEvent("error", `Training failed: ${jobStatus}`);
            setTrainJob((prev) => ({ ...prev, status: "error", error: `Training ${jobStatus.toLowerCase()}` }));
          } else if (jobStatus === "RUNNING") {
            setTrainJob((prev) => ({
              ...prev,
              status: "training",
              progress: Math.min(30 + pollCount * 5, 90),
            }));
          } else if (jobStatus === "VALIDATING") {
            setTrainJob((prev) => ({ ...prev, status: "validating", progress: 25 }));
            addEvent("info", "Validating training data...");
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
          addEvent("error", "Lost connection to training job");
          setTrainJob((prev) => ({ ...prev, status: "error", error: "Connection lost" }));
        }
      }, 8000);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Training failed";
      addEvent("error", msg);
      setTrainJob((prev) => ({ ...prev, status: "error", error: msg }));
    }
  };

  const clearModel = () => {
    localStorage.removeItem(MODEL_KEY);
    onModelReady(null);
    setTrainJob({ status: "idle", events: [], checkpoints: [] });
  };

  /* ---------- Render ---------- */

  if (!open) return null;

  const isTraining = trainJob.status !== "idle" && trainJob.status !== "complete" && trainJob.status !== "error";

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[60px]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-3xl mx-4 max-h-[calc(100vh-100px)] flex flex-col rounded-2xl border border-edge bg-surface-0 shadow-2xl shadow-black/40 anim-spawn overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge bg-gradient-to-r from-violet-500/[0.04] to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
              <BookOpen className="w-4.5 h-4.5 text-brand" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-tx-0">Knowledge Base</h2>
              <p className="text-[10px] text-tx-3 mt-0.5">Fine-tune a custom model with your brand knowledge</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {trainJob.status === "training" && (
              <StatusBadge status="RUNNING" />
            )}
            <button onClick={onClose} className="p-2 rounded-lg text-tx-3 hover:text-tx-0 hover:bg-surface-2 transition-all cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Section Tabs ── */}
        <div className="flex border-b border-edge">
          {([
            { id: "data" as const, label: "Training Data", icon: Database },
            { id: "config" as const, label: "Configuration", icon: Settings2 },
            { id: "monitor" as const, label: "Monitor", icon: Activity, badge: isTraining },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-medium transition-all cursor-pointer ${
                activeSection === tab.id ? "text-brand-bright" : "text-tx-3 hover:text-tx-1"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.badge && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
                </span>
              )}
              {activeSection === tab.id && <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-brand" />}
            </button>
          ))}
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Active model badge */}
          {activeModelId && (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-ok/20 bg-ok/[0.04]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-ok/10 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-ok" />
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-ok">Custom Model Active</p>
                  <p className="text-[10px] text-tx-3 font-mono mt-0.5">{activeModelId.slice(0, 40)}...</p>
                </div>
              </div>
              <button onClick={clearModel} className="flex items-center gap-1 text-[10px] text-tx-3 hover:text-fail px-2.5 py-1.5 rounded-lg border border-edge hover:border-fail/30 transition-all cursor-pointer">
                <X className="w-3 h-3" /> Remove
              </button>
            </div>
          )}

          {/* ================================================================ */}
          {/*  TAB: Training Data                                               */}
          {/* ================================================================ */}
          {activeSection === "data" && (
            <>
              {/* Data quality metrics */}
              {entries.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <MetricCard icon={Database} label="Sources" value={entries.length} color="text-brand" />
                  <MetricCard icon={Hash} label="Samples" value={totalSamples} sub={`${dataQuality} quality`} color={qualityColor} />
                  <MetricCard icon={Zap} label="Est. Tokens" value={formatNumber(totalTokensEst)} sub="~$0.01/1K tokens" color="text-amber-400" />
                  <MetricCard icon={FileText} label="Words" value={formatNumber(totalWords)} sub={`${formatNumber(totalChars)} chars`} />
                </div>
              )}

              {/* Data quality indicator */}
              {entries.length > 0 && (
                <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border ${
                  dataQuality === "high" ? "border-ok/20 bg-ok/[0.03]"
                  : dataQuality === "medium" ? "border-amber-400/20 bg-amber-400/[0.03]"
                  : "border-fail/20 bg-fail/[0.03]"
                }`}>
                  <CircleDot className={`w-3.5 h-3.5 ${qualityColor}`} />
                  <div>
                    <p className={`text-[11px] font-medium ${qualityColor}`}>
                      {dataQuality === "high" ? "Excellent data volume" : dataQuality === "medium" ? "Good - more data recommended" : "Low data - add more content for best results"}
                    </p>
                    <p className="text-[9px] text-tx-4 mt-0.5">
                      {dataQuality === "high"
                        ? `${totalSamples} samples exceeds the 50+ threshold for high-quality fine-tuning`
                        : dataQuality === "medium"
                        ? `${totalSamples}/50 samples. Adding more diverse content will improve model quality`
                        : `${totalSamples}/20 minimum samples. Add brand guidelines, product info, past campaigns`
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* Upload zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => fileRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl px-6 py-7 text-center transition-all cursor-pointer ${
                  dragOver ? "border-brand bg-brand/[0.04]" : "border-surface-4 hover:border-tx-4 hover:bg-surface-1/40"
                }`}
              >
                <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json,.jsonl" multiple className="hidden"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)} />
                <Upload className={`w-5 h-5 mx-auto mb-2 ${dragOver ? "text-brand" : "text-tx-4"}`} />
                <p className="text-[12px] text-tx-2 font-medium">
                  Drop files here or <span className="text-brand">browse</span>
                </p>
                <p className="text-[10px] text-tx-4 mt-1">.txt, .md, .csv, .json, .jsonl — up to 5 MB each</p>
              </div>

              {/* Paste toggle */}
              <button onClick={() => setPasteMode(!pasteMode)}
                className="flex items-center gap-1.5 text-[11px] text-tx-3 hover:text-brand transition-colors cursor-pointer">
                <ChevronDown className={`w-3 h-3 transition-transform ${pasteMode ? "rotate-180" : ""}`} />
                Or paste text directly
              </button>

              {pasteMode && (
                <div className="space-y-2 anim-fade-up">
                  <input value={pasteName} onChange={(e) => setPasteName(e.target.value)}
                    placeholder="Label (e.g. Brand Guidelines)"
                    className="w-full text-[12px] bg-surface-1 border border-edge rounded-lg px-3 py-2 text-tx-1 placeholder:text-tx-4 focus:outline-none focus:border-brand/30 transition-colors" />
                  <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Paste your brand content, product descriptions, tone guides, past campaigns..."
                    rows={5}
                    className="w-full text-[12px] bg-surface-1 border border-edge rounded-xl px-4 py-3 text-tx-1 placeholder:text-tx-4 resize-none focus:outline-none focus:border-brand/30 transition-colors" />
                  {pasteText.trim() && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-tx-4">
                        {countWords(pasteText)} words &middot; ~{formatNumber(estimateTokens(pasteText))} tokens &middot; {countSamples(pasteText)} samples
                      </span>
                      <button onClick={handlePasteSubmit} disabled={!pasteText.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:brightness-110 transition-all disabled:opacity-30 cursor-pointer">
                        <Plus className="w-3 h-3" /> Add to Knowledge Base
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Entries list */}
              {entries.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[11px] font-semibold text-tx-2 uppercase tracking-widest">Sources ({entries.length})</h3>
                  </div>
                  <div className="space-y-1.5">
                    {entries.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-edge bg-surface-1 hover:bg-surface-2/60 transition-colors group">
                        <div className="w-7 h-7 rounded-lg bg-surface-3/60 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-3.5 h-3.5 text-tx-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-tx-1 font-medium truncate">{entry.name}</p>
                          <p className="text-[10px] text-tx-4">
                            {entry.sampleCount} samples &middot; {formatNumber(entry.wordCount)} words &middot; ~{formatNumber(estimateTokens(entry.text))} tokens &middot; {formatDate(entry.addedAt)}
                          </p>
                        </div>
                        <button onClick={() => removeEntry(entry.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-tx-4 hover:text-fail hover:bg-fail/10 transition-all cursor-pointer">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ================================================================ */}
          {/*  TAB: Configuration                                               */}
          {/* ================================================================ */}
          {activeSection === "config" && (
            <>
              {/* Base model selector */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Cpu className="w-3.5 h-3.5 text-tx-3" />
                  <h3 className="text-[11px] font-semibold text-tx-2 uppercase tracking-widest">Base Model</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BASE_MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className={`text-left px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                        selectedModel === model.id
                          ? "border-brand/30 bg-brand/[0.04] ring-1 ring-brand/20"
                          : "border-edge bg-surface-1 hover:bg-surface-2/60 hover:border-edge-b"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[12px] font-semibold ${selectedModel === model.id ? "text-tx-0" : "text-tx-2"}`}>
                          {model.name}
                        </span>
                        <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full border ${TIER_COLORS[model.tier]}`}>
                          {model.tier}
                        </span>
                      </div>
                      <p className="text-[10px] text-tx-4">{model.desc}</p>
                      <p className="text-[9px] text-tx-4 font-mono mt-1">{model.id}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hyperparameters */}
              <div>
                <button onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 mb-3 cursor-pointer">
                  <Settings2 className="w-3.5 h-3.5 text-tx-3" />
                  <h3 className="text-[11px] font-semibold text-tx-2 uppercase tracking-widest">Hyperparameters</h3>
                  <ChevronDown className={`w-3 h-3 text-tx-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                </button>

                {showAdvanced && (
                  <div className="space-y-4 anim-fade-up">
                    {/* Learning Rate */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] text-tx-2 font-medium">Learning Rate</label>
                        <span className="text-[11px] text-brand font-mono tabular-nums">{hyper.learningRate.toExponential(1)}</span>
                      </div>
                      <input
                        type="range" min={-6} max={-3} step={0.1}
                        value={Math.log10(hyper.learningRate)}
                        onChange={(e) => setHyper((h) => ({ ...h, learningRate: Math.pow(10, parseFloat(e.target.value)) }))}
                        className="w-full h-1.5 bg-surface-3 rounded-full appearance-none cursor-pointer accent-brand"
                      />
                      <div className="flex justify-between mt-1">
                        <span className="text-[9px] text-tx-4">1e-6 (conservative)</span>
                        <span className="text-[9px] text-tx-4">1e-3 (aggressive)</span>
                      </div>
                    </div>

                    {/* Training Steps */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] text-tx-2 font-medium">Training Steps</label>
                        <span className="text-[11px] text-brand font-mono tabular-nums">{hyper.trainingSteps}</span>
                      </div>
                      <input
                        type="range" min={10} max={200} step={10}
                        value={hyper.trainingSteps}
                        onChange={(e) => setHyper((h) => ({ ...h, trainingSteps: parseInt(e.target.value) }))}
                        className="w-full h-1.5 bg-surface-3 rounded-full appearance-none cursor-pointer accent-brand"
                      />
                      <div className="flex justify-between mt-1">
                        <span className="text-[9px] text-tx-4">10 (quick)</span>
                        <span className="text-[9px] text-tx-4">200 (thorough)</span>
                      </div>
                    </div>

                    {/* Estimated Cost */}
                    <div className="bg-surface-2/40 border border-edge rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="w-3.5 h-3.5 text-tx-3" />
                        <span className="text-[10px] font-medium text-tx-3 uppercase tracking-wider">Estimated Training Cost</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[20px] font-bold text-tx-0">$4.00</span>
                        <span className="text-[11px] text-tx-4">minimum + $2/mo storage</span>
                      </div>
                      <p className="text-[9px] text-tx-4 mt-1">
                        Based on {formatNumber(totalTokensEst)} tokens x {hyper.trainingSteps} steps on {selectedModel}
                      </p>
                    </div>

                    {/* Reset */}
                    <button
                      onClick={() => setHyper(DEFAULT_HYPER)}
                      className="flex items-center gap-1.5 text-[10px] text-tx-4 hover:text-tx-2 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> Reset to defaults
                    </button>
                  </div>
                )}

                {!showAdvanced && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-surface-2/40 border border-edge rounded-lg px-3 py-2">
                      <p className="text-[9px] text-tx-4 uppercase tracking-wider mb-0.5">Learning Rate</p>
                      <p className="text-[12px] text-tx-1 font-mono">{hyper.learningRate.toExponential(1)}</p>
                    </div>
                    <div className="bg-surface-2/40 border border-edge rounded-lg px-3 py-2">
                      <p className="text-[9px] text-tx-4 uppercase tracking-wider mb-0.5">Steps</p>
                      <p className="text-[12px] text-tx-1 font-mono">{hyper.trainingSteps}</p>
                    </div>
                    <div className="bg-surface-2/40 border border-edge rounded-lg px-3 py-2">
                      <p className="text-[9px] text-tx-4 uppercase tracking-wider mb-0.5">Base Model</p>
                      <p className="text-[12px] text-tx-1 font-mono truncate">{selectedModel.replace(/-latest$/, "")}</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ================================================================ */}
          {/*  TAB: Monitor                                                     */}
          {/* ================================================================ */}
          {activeSection === "monitor" && (
            <>
              {/* Job metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <MetricCard
                  icon={Activity}
                  label="Status"
                  value={trainJob.status === "idle" ? "Ready" : trainJob.status.charAt(0).toUpperCase() + trainJob.status.slice(1)}
                  color={trainJob.status === "complete" ? "text-ok" : trainJob.status === "error" ? "text-fail" : isTraining ? "text-brand" : "text-tx-3"}
                />
                <MetricCard
                  icon={Zap}
                  label="Trained Tokens"
                  value={trainJob.trainedTokens ? formatNumber(trainJob.trainedTokens) : "---"}
                  color="text-amber-400"
                />
                <MetricCard
                  icon={Clock}
                  label="Elapsed"
                  value={trainJob.startedAt ? formatDuration(Math.round((Date.now() - trainJob.startedAt) / 1000)) : "---"}
                />
                <MetricCard
                  icon={Cpu}
                  label="Base Model"
                  value={trainJob.baseModel?.replace(/-latest$/, "").replace("open-", "") || "---"}
                  sub={trainJob.sampleCount ? `${trainJob.sampleCount} samples` : undefined}
                />
              </div>

              {/* Progress bar */}
              {isTraining && (
                <div className="anim-fade-up">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-medium text-tx-3 uppercase tracking-widest">Training Progress</span>
                    <span className="text-[10px] text-tx-4 tabular-nums font-mono">{trainJob.progress || 0}%</span>
                  </div>
                  <div className="h-[4px] rounded-full bg-surface-3 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand to-violet-500 transition-all duration-1000 ease-out"
                      style={{ width: `${trainJob.progress || 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Checkpoint chart */}
              <CheckpointChart checkpoints={trainJob.checkpoints} />

              {/* Event log */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-3.5 h-3.5 text-tx-3" />
                  <h3 className="text-[11px] font-semibold text-tx-2 uppercase tracking-widest">Training Events</h3>
                  <span className="text-[10px] text-tx-4">{trainJob.events.length} events</span>
                </div>
                {trainJob.events.length > 0 ? (
                  <EventLog events={trainJob.events} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <FlaskConical className="w-8 h-8 text-tx-4/30 mb-2" />
                    <p className="text-[12px] text-tx-3">No training events yet</p>
                    <p className="text-[10px] text-tx-4 mt-0.5">Start a training job to see live metrics</p>
                  </div>
                )}
              </div>

              {/* Error display */}
              {trainJob.status === "error" && (
                <div className="rounded-xl border border-fail/20 bg-fail/[0.04] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-fail" />
                    <p className="text-[12px] font-medium text-fail">{trainJob.error || "Training failed"}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-edge bg-surface-1/40 flex items-center justify-between">
          <p className="text-[10px] text-tx-4">
            {entries.length === 0
              ? "Add content to get started"
              : `${formatNumber(totalTokensEst)} tokens from ${entries.length} source${entries.length > 1 ? "s" : ""}`}
          </p>
          <div className="flex gap-2">
            {entries.length > 0 && !isTraining && (
              <button
                onClick={() => startTraining(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium text-tx-3 border border-edge hover:border-edge-b hover:bg-surface-2/40 transition-all cursor-pointer"
              >
                <FlaskConical className="w-3 h-3" /> Dry Run
              </button>
            )}
            <button
              onClick={() => startTraining(false)}
              disabled={entries.length === 0 || isTraining}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[12px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 hover:brightness-110 transition-all disabled:opacity-30 disabled:shadow-none cursor-pointer"
            >
              {isTraining ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Training...</>
              ) : trainJob.status === "complete" ? (
                <><RefreshCw className="w-3.5 h-3.5" /> Retrain Model</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> Train Custom Model</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
