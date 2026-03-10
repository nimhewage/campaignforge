"use client";

import { useState } from "react";
import type { Phase } from "@/app/page";
import { Rocket, Square, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  onSubmit: (brief: string) => void;
  onStop: () => void;
  isRunning: boolean;
  phase: Phase;
}

const MAX_CHARS = 5000;

/* ------------------------------------------------------------------ */
/*  Template library — grouped by industry                             */
/* ------------------------------------------------------------------ */

interface Template {
  tag: string;
  category: string;
  brief: string;
}

const TEMPLATES: Template[] = [
  // Consumer & Lifestyle
  {
    tag: "Eco Fashion",
    category: "Consumer",
    brief: "Launch a sustainable fashion brand targeting Gen Z in Sydney, budget $50K, Q1 2026. Focus on TikTok and Instagram. Differentiate on radical transparency about supply chain.",
  },
  {
    tag: "Health & Wellness",
    category: "Consumer",
    brief: "Launch a mental health app for burnt-out millennials. Budget $80K. Focus on reducing stigma and driving premium subscriptions. Key markets: Australia and UK.",
  },
  {
    tag: "Food & Beverage",
    category: "Consumer",
    brief: "Plant-based protein snack brand entering Australian supermarkets. $60K budget. Target health-conscious 25-45 year olds. Drive trial, in-store visibility, and repeat purchase.",
  },
  {
    tag: "Luxury Fashion",
    category: "Consumer",
    brief: "Launch a premium Australian leather goods brand into the Asian market. $150K budget. Target high-net-worth consumers in Singapore, Hong Kong, and Tokyo. Instagram and WeChat focus.",
  },
  // B2B & Tech
  {
    tag: "B2B SaaS",
    category: "Tech & B2B",
    brief: "B2B SaaS product launch for a project management tool targeting Australian SMBs. $100K budget. Emphasize productivity and integrations. Focus on LinkedIn and Google Ads.",
  },
  {
    tag: "AI Consulting",
    category: "Tech & B2B",
    brief: "AI consulting firm targeting CFOs in financial services across APAC. $200K budget. Position as thought leaders in AI transformation. LinkedIn, industry events, and whitepapers.",
  },
  {
    tag: "FinTech",
    category: "Tech & B2B",
    brief: "B2B payment processing startup targeting e-commerce merchants. $120K budget. Compete against Stripe and Square. Key message: faster settlements, simpler pricing.",
  },
  {
    tag: "EdTech",
    category: "Tech & B2B",
    brief: "Online coding bootcamp targeting career changers aged 28-42. $90K budget. Focus on job placement rates and employer partnerships. YouTube, LinkedIn, and Google Search.",
  },
  // Local & Service
  {
    tag: "Local Retail",
    category: "Local & Service",
    brief: "Local Sydney coffee chain expanding to 5 new locations. $40K budget. Drive foot traffic and build local community. Instagram, Google My Business, and local influencers.",
  },
  {
    tag: "Real Estate",
    category: "Local & Service",
    brief: "Boutique property development company launching a $50M residential project in Melbourne. Target first-home buyers and investors. $180K campaign budget. Facebook, Instagram, and OOH.",
  },
  // Mission-Driven
  {
    tag: "Gaming / Entertainment",
    category: "Entertainment",
    brief: "Indie mobile game launch targeting casual gamers aged 18-35 globally. $70K budget. Drive downloads and in-app purchase conversion. TikTok, YouTube pre-roll, and Reddit.",
  },
  {
    tag: "Non-profit",
    category: "Mission",
    brief: "Environmental NGO campaign to drive donations and volunteer sign-ups for ocean cleanup. $30K budget. Target environmentally conscious 22-45 year olds. Instagram, email, and earned media.",
  },
];

const CATEGORIES = Array.from(new Set(TEMPLATES.map((t) => t.category)));

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PromptInput({ onSubmit, onStop, isRunning, phase }: Props) {
  const [value, setValue] = useState("");
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const fire = () => {
    if (!value.trim() || isRunning || value.length > MAX_CHARS) return;
    onSubmit(value.trim());
  };

  const showExamples = phase === "idle";
  const inputDisabled = isRunning || phase === "plan_review" || phase === "complete";
  const charCount = value.length;
  const overLimit = charCount > MAX_CHARS;
  const nearLimit = charCount > MAX_CHARS * 0.85 && !overLimit;

  const visibleTemplates = showAllTemplates
    ? (activeCategory ? TEMPLATES.filter((t) => t.category === activeCategory) : TEMPLATES)
    : TEMPLATES.slice(0, 4);

  return (
    <div className="max-w-2xl mx-auto w-full">
      <div className={`glass-card p-[3px] transition-shadow focus-within:glow-brand ${overLimit ? "ring-1 ring-fail/30" : ""}`}>
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
            maxLength={MAX_CHARS + 200}
            className="w-full bg-transparent px-4 pt-4 pb-2 text-[14px] leading-relaxed text-tx-0 placeholder:text-tx-4 resize-none focus:outline-none"
            disabled={inputDisabled}
          />
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-tx-4 select-none">
                {phase === "plan_review"
                  ? "Review the plan below"
                  : phase === "complete"
                  ? "Campaign complete"
                  : isRunning
                  ? "Agents working..."
                  : "\u2318 + Enter"}
              </span>
              {/* Character counter */}
              {charCount > 0 && (
                <span className={`text-[10px] tabular-nums font-mono ${
                  overLimit ? "text-fail" : nearLimit ? "text-amber-400" : "text-tx-4"
                }`}>
                  {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </span>
              )}
            </div>
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
                disabled={!value.trim() || inputDisabled || overLimit}
                className="group flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 hover:brightness-110 transition-all disabled:opacity-20 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer"
              >
                <Rocket className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5" />
                Launch Campaign
              </button>
            )}
          </div>
          {overLimit && (
            <p className="px-4 pb-2 text-[11px] text-fail">
              Brief is {charCount - MAX_CHARS} characters over the {MAX_CHARS.toLocaleString()} limit. Please shorten it.
            </p>
          )}
        </div>
      </div>

      {/* Template gallery */}
      {showExamples && (
        <div className="mt-4">
          {/* Quick pills — first 4 */}
          <div className="flex flex-wrap justify-center gap-2">
            {visibleTemplates.map((ex) => (
              <button
                key={ex.tag}
                onClick={() => setValue(ex.brief)}
                className="text-[11px] px-3 py-1.5 rounded-full border border-edge text-tx-2 bg-surface-1 hover:bg-surface-2 hover:text-tx-1 hover:border-edge-b transition-all cursor-pointer"
              >
                {ex.tag}
              </button>
            ))}
          </div>

          {/* Expand / collapse */}
          <div className="flex items-center justify-center mt-2">
            {!showAllTemplates ? (
              <button
                onClick={() => setShowAllTemplates(true)}
                className="flex items-center gap-1 text-[11px] text-tx-3 hover:text-brand transition-colors cursor-pointer"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                {TEMPLATES.length - 4} more industry templates
              </button>
            ) : (
              <div className="w-full space-y-3 mt-2">
                {/* Category filters */}
                <div className="flex flex-wrap justify-center gap-1.5">
                  <button
                    onClick={() => setActiveCategory(null)}
                    className={`text-[10px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                      activeCategory === null
                        ? "border-brand/30 bg-brand/10 text-brand-bright"
                        : "border-edge text-tx-4 hover:text-tx-2"
                    }`}
                  >
                    All
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                      className={`text-[10px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                        activeCategory === cat
                          ? "border-brand/30 bg-brand/10 text-brand-bright"
                          : "border-edge text-tx-4 hover:text-tx-2"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* All templates as pills */}
                <div className="flex flex-wrap justify-center gap-2">
                  {(activeCategory ? TEMPLATES.filter((t) => t.category === activeCategory) : TEMPLATES).map((ex) => (
                    <button
                      key={ex.tag}
                      onClick={() => setValue(ex.brief)}
                      className="text-[11px] px-3 py-1.5 rounded-full border border-edge text-tx-2 bg-surface-1 hover:bg-surface-2 hover:text-tx-1 hover:border-edge-b transition-all cursor-pointer"
                    >
                      {ex.tag}
                    </button>
                  ))}
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={() => { setShowAllTemplates(false); setActiveCategory(null); }}
                    className="flex items-center gap-1 text-[11px] text-tx-3 hover:text-brand transition-colors cursor-pointer"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                    Show less
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
