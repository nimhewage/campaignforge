"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  X, Upload, FileText, Loader2, Check, AlertTriangle,
  Trash2, BookOpen, Plus, Sparkles, RefreshCw, ChevronDown,
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
}

type TrainStatus = "idle" | "preparing" | "uploading" | "training" | "complete" | "error";

interface TrainJob {
  status: TrainStatus;
  jobId?: string;
  modelId?: string;
  error?: string;
  progress?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onModelReady: (modelId: string | null) => void;
  activeModelId: string | null;
}

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
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 40);
  return Math.max(paragraphs.length, 1);
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const PERSIST_KEY = "cf_knowledge_entries";
const MODEL_KEY = "cf_custom_model";

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
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function KnowledgeBase({ open, onClose, onModelReady, activeModelId }: Props) {
  const [entries, setEntries] = useState<KBEntry[]>(() => loadEntries());
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteName, setPasteName] = useState("");
  const [trainJob, setTrainJob] = useState<TrainJob>({ status: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(MODEL_KEY);
    if (saved && !activeModelId) onModelReady(saved);
  }, [activeModelId, onModelReady]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const totalSamples = entries.reduce((s, e) => s + e.sampleCount, 0);

  /* ---------- Entry management ---------- */

  const addEntry = useCallback((name: string, text: string) => {
    const entry: KBEntry = {
      id: crypto.randomUUID(),
      name,
      sampleCount: countSamples(text),
      addedAt: Date.now(),
      text,
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

  /* ---------- Training ---------- */

  const startTraining = async () => {
    if (entries.length === 0) return;
    setTrainJob({ status: "preparing", progress: 0 });

    try {
      const allText = entries.map((e) => e.text).join("\n\n---\n\n");

      setTrainJob({ status: "uploading", progress: 20 });

      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "train", text: allText }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Training failed");
      }

      const data = await res.json();

      if (data.status === "complete") {
        setTrainJob({ status: "complete", modelId: data.modelId, progress: 100 });
        localStorage.setItem(MODEL_KEY, data.modelId);
        onModelReady(data.modelId);
        return;
      }

      setTrainJob({ status: "training", jobId: data.jobId, progress: 40 });

      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch("/api/knowledge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "status", jobId: data.jobId }),
          });
          const pollData = await pollRes.json();

          if (pollData.status === "SUCCESS") {
            if (pollRef.current) clearInterval(pollRef.current);
            setTrainJob({ status: "complete", modelId: pollData.modelId, progress: 100 });
            localStorage.setItem(MODEL_KEY, pollData.modelId);
            onModelReady(pollData.modelId);
          } else if (pollData.status === "FAILED" || pollData.status === "FAILED_VALIDATION") {
            if (pollRef.current) clearInterval(pollRef.current);
            setTrainJob({ status: "error", error: "Training failed. Check your data and try again." });
          } else {
            setTrainJob((prev) => ({
              ...prev,
              progress: Math.min((prev.progress || 40) + 5, 90),
            }));
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
          setTrainJob({ status: "error", error: "Lost connection to training job" });
        }
      }, 8000);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Training failed";
      setTrainJob({ status: "error", error: msg });
    }
  };

  const clearModel = () => {
    localStorage.removeItem(MODEL_KEY);
    onModelReady(null);
    setTrainJob({ status: "idle" });
  };

  /* ---------- Render ---------- */

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[60px]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-2xl mx-4 max-h-[calc(100vh-100px)] flex flex-col rounded-2xl border border-edge bg-surface-0 shadow-2xl shadow-black/40 anim-spawn overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge bg-gradient-to-r from-violet-500/[0.04] to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
              <BookOpen className="w-4.5 h-4.5 text-brand" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-tx-0">Knowledge Base</h2>
              <p className="text-[10px] text-tx-3 mt-0.5">
                Add brand content to fine-tune a custom model
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-tx-3 hover:text-tx-0 hover:bg-surface-2 transition-all cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
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
                  <p className="text-[10px] text-tx-3 font-mono mt-0.5">{activeModelId.slice(0, 32)}...</p>
                </div>
              </div>
              <button
                onClick={clearModel}
                className="flex items-center gap-1 text-[10px] text-tx-3 hover:text-fail px-2.5 py-1.5 rounded-lg border border-edge hover:border-fail/30 transition-all cursor-pointer"
              >
                <X className="w-3 h-3" /> Remove
              </button>
            </div>
          )}

          {/* Upload zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl px-6 py-8 text-center transition-all cursor-pointer ${
              dragOver
                ? "border-brand bg-brand/[0.04]"
                : "border-surface-4 hover:border-tx-4 hover:bg-surface-1/40"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.csv,.json,.jsonl"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <Upload className={`w-6 h-6 mx-auto mb-2 ${dragOver ? "text-brand" : "text-tx-4"}`} />
            <p className="text-[13px] text-tx-2 font-medium">
              Drop files here or <span className="text-brand">browse</span>
            </p>
            <p className="text-[10px] text-tx-4 mt-1">
              .txt, .md, .csv, .json, .jsonl — up to 5 MB each
            </p>
          </div>

          {/* Paste toggle */}
          <button
            onClick={() => setPasteMode(!pasteMode)}
            className="flex items-center gap-1.5 text-[11px] text-tx-3 hover:text-brand transition-colors cursor-pointer"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${pasteMode ? "rotate-180" : ""}`} />
            Or paste text directly
          </button>

          {pasteMode && (
            <div className="space-y-2 anim-fade-up">
              <input
                value={pasteName}
                onChange={(e) => setPasteName(e.target.value)}
                placeholder="Label (e.g. Brand Guidelines)"
                className="w-full text-[12px] bg-surface-1 border border-edge rounded-lg px-3 py-2 text-tx-1 placeholder:text-tx-4 focus:outline-none focus:border-brand/30 transition-colors"
              />
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste your brand content, product descriptions, tone guides, past campaigns..."
                rows={6}
                className="w-full text-[12px] bg-surface-1 border border-edge rounded-xl px-4 py-3 text-tx-1 placeholder:text-tx-4 resize-none focus:outline-none focus:border-brand/30 transition-colors"
              />
              <button
                onClick={handlePasteSubmit}
                disabled={!pasteText.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:brightness-110 transition-all disabled:opacity-30 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add to Knowledge Base
              </button>
            </div>
          )}

          {/* Entries list */}
          {entries.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-semibold text-tx-2 uppercase tracking-widest">
                  Sources ({entries.length})
                </h3>
                <span className="text-[10px] text-tx-4">{totalSamples} training samples</span>
              </div>
              <div className="space-y-1.5">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-edge bg-surface-1 hover:bg-surface-2/60 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-surface-3/60 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-3.5 h-3.5 text-tx-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-tx-1 font-medium truncate">{entry.name}</p>
                      <p className="text-[10px] text-tx-4">
                        {entry.sampleCount} samples &middot; {formatDate(entry.addedAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => removeEntry(entry.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-tx-4 hover:text-fail hover:bg-fail/10 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Training status */}
          {trainJob.status !== "idle" && trainJob.status !== "complete" && (
            <div className={`rounded-xl border px-4 py-3 ${
              trainJob.status === "error"
                ? "border-fail/20 bg-fail/[0.04]"
                : "border-brand/20 bg-brand/[0.03]"
            }`}>
              <div className="flex items-center gap-2.5 mb-2">
                {trainJob.status === "error" ? (
                  <AlertTriangle className="w-4 h-4 text-fail" />
                ) : (
                  <Loader2 className="w-4 h-4 text-brand animate-spin" />
                )}
                <p className="text-[12px] font-medium text-tx-1">
                  {trainJob.status === "preparing" && "Preparing training data..."}
                  {trainJob.status === "uploading" && "Uploading to Mistral..."}
                  {trainJob.status === "training" && "Fine-tuning model — this may take a few minutes..."}
                  {trainJob.status === "error" && (trainJob.error || "Training failed")}
                </p>
              </div>
              {trainJob.status !== "error" && (
                <div className="h-[3px] rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand to-violet-500 transition-all duration-1000 ease-out"
                    style={{ width: `${trainJob.progress || 0}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-edge bg-surface-1/40 flex items-center justify-between">
          <p className="text-[10px] text-tx-4">
            {entries.length === 0
              ? "Add content to get started"
              : `${totalSamples} samples from ${entries.length} source${entries.length > 1 ? "s" : ""}`
            }
          </p>
          <div className="flex gap-2">
            {activeModelId && (
              <button
                onClick={startTraining}
                disabled={entries.length === 0 || (trainJob.status !== "idle" && trainJob.status !== "complete" && trainJob.status !== "error")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-medium text-tx-2 border border-edge hover:border-edge-b hover:bg-surface-2/40 transition-all disabled:opacity-30 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Retrain
              </button>
            )}
            <button
              onClick={startTraining}
              disabled={entries.length === 0 || (trainJob.status !== "idle" && trainJob.status !== "complete" && trainJob.status !== "error")}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[12px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 hover:brightness-110 transition-all disabled:opacity-30 disabled:shadow-none cursor-pointer"
            >
              {trainJob.status === "complete" ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Trained
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" /> Train Custom Model
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
