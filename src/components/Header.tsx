"use client";

import { useEffect, useState } from "react";
import type { Phase } from "@/app/page";
import { Layers, Wifi, CircleDot, BookOpen, Sparkles, History, Cpu, Volume2 } from "lucide-react";

const PHASE_LABELS: Record<Phase, string> = {
  idle: "",
  planning: "Planning",
  plan_review: "Awaiting Approval",
  executing: "Executing",
  complete: "Complete",
};

const PHASE_COLORS: Record<Phase, string> = {
  idle: "",
  planning: "text-brand",
  plan_review: "text-amber-400",
  executing: "text-brand",
  complete: "text-ok",
};

interface Props {
  phase: Phase;
  onOpenKB: () => void;
  hasCustomModel: boolean;
  onOpenVoice?: () => void;
  hasVoiceProfile?: boolean;
}

interface StatusInfo {
  providers: string[];
  hasSerpApi: boolean;
  hasReplicate: boolean;
}

export default function Header({ phase, onOpenKB, hasCustomModel, onOpenVoice, hasVoiceProfile }: Props) {
  const label = PHASE_LABELS[phase];
  const color = PHASE_COLORS[phase];
  const [status, setStatus] = useState<StatusInfo | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => {});
  }, []);

  const providerLabel = (() => {
    if (!status) return "Mistral";
    const p = status.providers;
    if (p.length === 1) return "Mistral";
    if (p.includes("claude") && p.includes("openai")) return "Multi-LLM";
    if (p.includes("claude")) return "Mistral + Claude";
    if (p.includes("openai")) return "Mistral + GPT-4o";
    return "Mistral";
  })();

  const isMultiLLM = (status?.providers?.length ?? 1) > 1;

  return (
    <header className="sticky top-0 z-50 bg-surface-0/60 backdrop-blur-2xl border-b border-edge/70 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
      <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Layers className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[15px] font-semibold text-tx-0 tracking-tight">
            Campaign<span className="text-brand">Forge</span>
          </span>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* History link */}
          <a
            href="/history"
            className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium rounded-full px-3 py-1.5 border border-edge text-tx-2 bg-surface-2/60 hover:text-brand hover:border-brand/20 hover:bg-brand/[0.04] transition-all cursor-pointer"
          >
            <History className="w-3 h-3" />
            History
          </a>

          {/* Brand Voice button */}
          {onOpenVoice && (
            <button
              onClick={onOpenVoice}
              className={`hidden sm:flex items-center gap-1.5 text-[11px] font-medium rounded-full px-3 py-1.5 border transition-all cursor-pointer ${
                hasVoiceProfile
                  ? "text-violet-400 bg-violet-400/[0.06] border-violet-400/20 hover:bg-violet-400/[0.1]"
                  : "text-tx-2 bg-surface-2/60 border-edge hover:text-brand hover:border-brand/20 hover:bg-brand/[0.04]"
              }`}
            >
              <Volume2 className="w-3 h-3" />
              {hasVoiceProfile ? "Voice Active" : "Brand Voice"}
            </button>
          )}

          {/* Knowledge Base button */}
          <button
            onClick={onOpenKB}
            className={`group flex items-center gap-1.5 text-[11px] font-medium rounded-full px-3 py-1.5 border transition-all cursor-pointer ${
              hasCustomModel
                ? "text-ok bg-ok/[0.06] border-ok/20 hover:bg-ok/[0.1] hover:border-ok/30"
                : "text-tx-2 bg-surface-2/60 border-edge hover:text-brand hover:border-brand/20 hover:bg-brand/[0.04]"
            }`}
          >
            {hasCustomModel ? (
              <Sparkles className="w-3 h-3 text-ok" />
            ) : (
              <BookOpen className="w-3 h-3 group-hover:text-brand transition-colors" />
            )}
            <span className="hidden sm:inline">
              {hasCustomModel ? "Custom Model" : "Knowledge Base"}
            </span>
            <span className="sm:hidden">KB</span>
          </button>

          {/* Phase indicator */}
          {label && (
            <div className={`flex items-center gap-2 text-[11px] font-medium ${color} bg-surface-2/60 border border-edge rounded-full px-3 py-1.5`}>
              {phase === "plan_review" ? (
                <CircleDot className="w-3 h-3 text-amber-400" />
              ) : phase === "complete" ? (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
              ) : (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-400" />
                </span>
              )}
              {label}
            </div>
          )}

          {/* Provider indicator */}
          <div className={`hidden sm:flex items-center gap-2 text-[11px] border rounded-full px-3 py-1.5 transition-colors ${
            isMultiLLM
              ? "text-brand bg-brand/[0.05] border-brand/20"
              : "text-tx-2 bg-surface-2/60 border-edge"
          }`}>
            {isMultiLLM ? (
              <Cpu className="w-3 h-3 text-brand" />
            ) : (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
            )}
            {providerLabel}
          </div>

          {/* Agent count */}
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-tx-3 bg-surface-1 border border-edge rounded-full px-3 py-1.5">
            <Wifi className="w-3 h-3" />
            <span>9 agents</span>
          </div>
        </div>
      </div>
    </header>
  );
}
