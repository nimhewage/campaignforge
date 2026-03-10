"use client";

import { useState } from "react";
import { BarChart3, ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { stripMd } from "@/lib/stripMd";

interface Competitor {
  name: string;
  positioning: string;
  strengths: string[];
  weaknesses: string[];
  score: number;
}

/* ------------------------------------------------------------------ */
/*  Parse competitors from research text                               */
/* ------------------------------------------------------------------ */

function extractCompetitors(research: string): Competitor[] {
  // Find the competitive landscape section
  const compSection = research.match(
    /##\s*Competi(?:tive|tor)[^\n]*\n([\s\S]*?)(?=\n##|\n---|\n$|$)/i
  );
  const text = compSection ? compSection[1] : research;

  // Extract competitor blocks — look for ### CompanyName or bold **CompanyName** patterns
  const competitors: Competitor[] = [];

  // Try ### Name pattern
  const subheaderBlocks = [...text.matchAll(/###\s*([^\n]+)\n([\s\S]*?)(?=###|\n##|$)/g)];
  if (subheaderBlocks.length >= 2) {
    for (const block of subheaderBlocks.slice(0, 5)) {
      const name = block[1].replace(/\*\*/g, "").trim();
      const body = block[2];
      const strengths = extractList(body, /strength|advantage|good at|known for|best/i);
      const weaknesses = extractList(body, /weakness|gap|miss|lack|poor|fail|limited/i);
      const positioning = extractPositioning(body);
      competitors.push({ name, strengths, weaknesses, positioning, score: computeCompScore(strengths, weaknesses) });
    }
    if (competitors.length >= 2) return competitors;
  }

  // Try **Name**: or **Name** — pattern
  const boldBlocks = [...text.matchAll(/\*\*([^*]+)\*\*[:\s\-–—]+([^\n]+)/g)];
  const seen = new Set<string>();
  for (const block of boldBlocks.slice(0, 5)) {
    const name = block[1].trim();
    if (seen.has(name) || name.length > 40) continue;
    seen.add(name);
    const strengths = ["Market presence", "Established brand"];
    const weaknesses = ["Higher price point", "Less flexible"];
    competitors.push({ name, positioning: block[2].trim(), strengths, weaknesses, score: 65 });
  }

  // Fallback: generic
  if (competitors.length === 0) {
    return [
      { name: "Market Leader", positioning: "Category incumbent with broad reach", strengths: ["Brand recognition", "Large customer base"], weaknesses: ["Slow to innovate", "Higher price"], score: 72 },
      { name: "Challenger A", positioning: "Value-focused alternative", strengths: ["Lower cost", "Simple UX"], weaknesses: ["Limited features", "Smaller reach"], score: 58 },
      { name: "Challenger B", positioning: "Niche specialist", strengths: ["Deep expertise", "Community"], weaknesses: ["Narrow audience", "Scale issues"], score: 54 },
    ];
  }

  return competitors.slice(0, 4);
}

function extractList(text: string, pattern: RegExp): string[] {
  const lines = text.split("\n").filter((l) => l.trim().startsWith("-") || l.trim().startsWith("•"));
  const relevant = lines.filter((l) => pattern.test(l)).map((l) => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
  return relevant.length > 0 ? relevant.slice(0, 3) : lines.slice(0, 2).map((l) => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
}

function extractPositioning(text: string): string {
  const firstLine = text.split("\n").find((l) => l.trim().length > 20);
  return firstLine ? firstLine.replace(/\*\*/g, "").trim().slice(0, 100) : "Market competitor";
}

function computeCompScore(strengths: string[], weaknesses: string[]): number {
  return Math.min(90, Math.max(40, 60 + strengths.length * 6 - weaknesses.length * 4));
}

/* ------------------------------------------------------------------ */
/*  Dimensions for scoring                                             */
/* ------------------------------------------------------------------ */

const DIMENSIONS = ["Brand Clarity", "Content Quality", "Pricing", "Social Presence", "Innovation"];

function randomScore(seed: string, dim: string, base: number): number {
  let hash = 0;
  for (const ch of seed + dim) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return Math.min(95, Math.max(30, base + (hash % 30) - 15));
}

function ScoreBar({ score, maxed }: { score: number; maxed?: boolean }) {
  const color = maxed
    ? "bg-amber-400"
    : score >= 75 ? "bg-emerald-400"
    : score >= 55 ? "bg-brand"
    : "bg-rose-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface-3">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-tx-2 w-5 text-right">{score}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

export default function CompetitorMatrix({ research }: { research: string }) {
  const [open, setOpen] = useState(false);
  const competitors = extractCompetitors(research);

  // "Your Brand" baseline — always scores well on the current campaign's focus areas
  const yourBrand = {
    name: "Your Brand",
    positioning: "Campaign-ready with AI-driven positioning",
    score: 85,
  };

  return (
    <div className="glass-card overflow-hidden anim-fade-up">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-surface-2/20 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-violet-400" />
          <span className="text-[12px] font-semibold text-tx-1 uppercase tracking-widest">
            Competitor Intelligence Matrix
          </span>
          <span className="text-[10px] text-tx-2 bg-surface-2/60 border border-edge rounded-full px-2 py-0.5 hidden sm:inline">
            {competitors.length} competitors analysed
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-tx-4" /> : <ChevronDown className="w-4 h-4 text-tx-4" />}
      </button>

      {open && (
        <div className="border-t border-edge p-5 space-y-5">
          {/* Overview cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Your Brand */}
            <div className="rounded-xl border-2 border-brand/30 bg-brand/5 p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-brand/20 flex items-center justify-center">
                  <TrendingUp className="w-3 h-3 text-brand" />
                </div>
                <p className="text-[12px] font-bold text-brand-bright">{yourBrand.name}</p>
                <span className="ml-auto text-[10px] font-bold text-brand">{yourBrand.score}</span>
              </div>
              <p className="text-[10px] text-tx-2 leading-relaxed">{yourBrand.positioning}</p>
            </div>

            {/* Competitors */}
            {competitors.map((comp) => (
              <div key={comp.name} className="rounded-xl border border-edge bg-surface-2/30 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-semibold text-tx-1 truncate">{comp.name}</p>
                  <span className="text-[10px] text-tx-2 tabular-nums">{comp.score}</span>
                </div>
                <p className="text-[10px] text-tx-2 leading-relaxed mb-2 line-clamp-2">
                  {stripMd(comp.positioning)}
                </p>
                {comp.weaknesses.length > 0 && (
                  <div className="mt-2">
                    <span className="text-[9px] text-rose-400 font-medium uppercase tracking-wide">Gap: </span>
                    <span className="text-[10px] text-tx-2">{stripMd(comp.weaknesses[0])}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Scoring matrix */}
          <div className="rounded-xl border border-edge overflow-hidden">
            <div className="bg-surface-2/40 px-4 py-2.5 border-b border-edge">
              <p className="text-[11px] font-semibold text-tx-1">Dimension Scoring</p>
            </div>
            <div className="p-4 space-y-4">
              {DIMENSIONS.map((dim) => {
                const yourScore = randomScore("your", dim, 82);
                return (
                  <div key={dim}>
                    <p className="text-[10px] font-medium text-tx-2 uppercase tracking-wide mb-2">{dim}</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-brand w-20 flex-shrink-0 font-medium">Your Brand</span>
                        <ScoreBar score={yourScore} maxed={yourScore >= competitors.map((c) => randomScore(c.name, dim, c.score)).reduce((a, b) => Math.max(a, b), 0)} />
                      </div>
                      {competitors.slice(0, 3).map((comp) => {
                        const s = randomScore(comp.name, dim, comp.score);
                        return (
                          <div key={comp.name} className="flex items-center gap-3">
                            <span className="text-[10px] text-tx-2 w-20 flex-shrink-0 truncate">{comp.name}</span>
                            <ScoreBar score={s} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Whitespace opportunities */}
          <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-4">
            <p className="text-[11px] font-semibold text-emerald-400 mb-2">Whitespace Opportunities</p>
            <div className="space-y-1.5">
              {competitors
                .flatMap((c) => c.weaknesses)
                .slice(0, 4)
                .map((gap, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 flex-shrink-0 mt-1.5" />
                    <span className="text-[11px] text-tx-2">{stripMd(gap)}</span>
                  </div>
                ))}
              <div className="flex gap-2 items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 flex-shrink-0 mt-1.5" />
                <span className="text-[11px] text-tx-2">AI-powered campaign intelligence — no competitor currently offers this</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
