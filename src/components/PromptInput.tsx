"use client";

import { useState } from "react";
import type { Phase } from "@/app/page";
import { Rocket, Square } from "lucide-react";

interface Props {
  onSubmit: (brief: string) => void;
  onStop: () => void;
  isRunning: boolean;
  phase: Phase;
}

const EXAMPLES = [
  { tag: "Eco Fashion", brief: "Launch a sustainable fashion brand targeting Gen Z in Sydney, budget $50K, Q1 2026. Focus on TikTok and Instagram." },
  { tag: "B2B SaaS", brief: "B2B SaaS product launch for a project management tool targeting Australian SMBs. Emphasize productivity and integrations." },
  { tag: "Local Retail", brief: "Local Sydney coffee chain expanding to 5 new locations. Need a campaign to drive foot traffic and build local community." },
  { tag: "AI Consulting", brief: "AI consulting firm targeting CFOs in financial services across APAC. Position as thought leaders in AI transformation." },
];

export default function PromptInput({ onSubmit, onStop, isRunning, phase }: Props) {
  const [value, setValue] = useState("");

  const fire = () => {
    if (!value.trim() || isRunning) return;
    onSubmit(value.trim());
  };

  const showExamples = phase === "idle";
  const inputDisabled = isRunning || phase === "plan_review" || phase === "complete";

  return (
    <div className="max-w-2xl mx-auto w-full">
      <div className="glass-card p-[3px] transition-shadow focus-within:glow-brand">
        <div className="rounded-[12px] bg-surface-1">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                fire();
              }
            }}
            placeholder="Describe your campaign — product, audience, market, budget, goals..."
            rows={3}
            className="w-full bg-transparent px-4 pt-4 pb-2 text-[14px] leading-relaxed text-tx-0 placeholder:text-tx-4 resize-none focus:outline-none"
            disabled={inputDisabled}
          />
          <div className="flex items-center justify-between px-3 pb-3">
            <span className="text-[10px] text-tx-4 select-none">
              {phase === "plan_review"
                ? "Review the plan below"
                : phase === "complete"
                ? "Campaign complete"
                : isRunning
                ? "Agents working..."
                : "\u2318 + Enter"}
            </span>
            {isRunning ? (
              <button
                onClick={onStop}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-medium text-fail bg-fail-dim border border-fail/20 hover:bg-fail/15 transition-colors cursor-pointer"
              >
                <Square className="w-3 h-3" />
                Stop
              </button>
            ) : (
              <button
                onClick={fire}
                disabled={!value.trim() || inputDisabled}
                className="group flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 hover:brightness-110 transition-all disabled:opacity-20 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer"
              >
                <Rocket className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5" />
                Launch Campaign
              </button>
            )}
          </div>
        </div>
      </div>

      {showExamples && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.tag}
              onClick={() => setValue(ex.brief)}
              className="text-[11px] px-3 py-1.5 rounded-full border border-edge text-tx-3 bg-surface-1 hover:bg-surface-2 hover:text-tx-1 hover:border-edge-b transition-all cursor-pointer"
            >
              {ex.tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
