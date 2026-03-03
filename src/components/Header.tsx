import type { Phase } from "@/app/page";
import { Layers, Wifi, CircleDot } from "lucide-react";

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

export default function Header({ phase }: { phase: Phase }) {
  const label = PHASE_LABELS[phase];
  const color = PHASE_COLORS[phase];

  return (
    <header className="sticky top-0 z-50 bg-surface-0/70 backdrop-blur-xl border-b border-edge">
      <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Layers className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[15px] font-semibold text-tx-0 tracking-tight">
            Campaign<span className="text-brand">Forge</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
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
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-tx-3 bg-surface-2/60 border border-edge rounded-full px-3 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Mistral Connected
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-tx-4 bg-surface-1 border border-edge rounded-full px-3 py-1.5">
            <Wifi className="w-3 h-3" />
            <span>6 agents</span>
          </div>
        </div>
      </div>
    </header>
  );
}
