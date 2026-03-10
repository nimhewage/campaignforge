"use client";

import { useState } from "react";
import { Shuffle, Copy, Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { stripMd } from "@/lib/stripMd";

interface Variant {
  angle: string;
  text: string;
  rationale: string;
  score?: number;
}

interface GeneratedSet {
  original: string;
  variants: Variant[];
}

/* ------------------------------------------------------------------ */
/*  Extract headlines from content                                     */
/* ------------------------------------------------------------------ */

function extractHeadlines(content: string): string[] {
  const section = content.match(/##\s*Campaign Headlines[\s\S]*?(?=##|$)/i);
  if (!section) return [];
  return section[0]
    .split("\n")
    .slice(1)
    .map((l) => l.replace(/^\d+\.\s*/, "").replace(/\*\*/g, "").trim())
    .filter((l) => l.length > 10 && l.length < 250)
    .slice(0, 5);
}

/* ------------------------------------------------------------------ */
/*  CopyBtn                                                            */
/* ------------------------------------------------------------------ */

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="p-1.5 rounded text-tx-4 hover:text-tx-2 transition-colors cursor-pointer"
    >
      {done ? <Check className="w-3 h-3 text-ok" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  AngleTag                                                           */
/* ------------------------------------------------------------------ */

const ANGLE_COLORS: Record<string, string> = {
  Curiosity: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  FOMO: "text-rose-400 bg-rose-400/10 border-rose-400/20",
  Authority: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  Urgency: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  "Social Proof": "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Transformation: "text-amber-400 bg-amber-400/10 border-amber-400/20",
};

function AngleTag({ angle }: { angle: string }) {
  return (
    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${ANGLE_COLORS[angle] || "text-tx-4 border-edge"}`}>
      {angle}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

export default function ABVariantGenerator({
  content,
  brief,
}: {
  content: string;
  brief: string;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<GeneratedSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOriginal, setSelectedOriginal] = useState<string>("");
  const headlines = extractHeadlines(content);

  const generate = async (original: string) => {
    setSelectedOriginal(original);
    setLoading(true);
    try {
      const res = await fetch("/api/ab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ original, brief }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setResults((prev) => {
        const without = prev.filter((r) => r.original !== original);
        return [...without, { original, variants: data.variants }];
      });
    } catch {
      // silent fail
    } finally {
      setLoading(false);
      setSelectedOriginal("");
    }
  };

  if (headlines.length === 0) return null;

  return (
    <div className="glass-card overflow-hidden anim-fade-up">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-surface-2/20 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Shuffle className="w-4 h-4 text-orange-400" />
          <span className="text-[12px] font-semibold text-tx-1 uppercase tracking-widest">
            A/B Variant Generator
          </span>
          <span className="text-[11px] text-tx-2 bg-surface-2/60 border border-edge rounded-full px-2 py-0.5 hidden sm:inline">
            {headlines.length} headlines · 3 angles each
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-tx-4" /> : <ChevronDown className="w-4 h-4 text-tx-4" />}
      </button>

      {open && (
        <div className="border-t border-edge p-5 space-y-4">
          <p className="text-[12px] text-tx-2">
            Select a headline to generate 3 variants with different psychological angles — Curiosity, FOMO, Authority.
          </p>

          {headlines.map((headline, i) => {
            const result = results.find((r) => r.original === headline);
            const isLoading = loading && selectedOriginal === headline;

            return (
              <div key={i} className="rounded-xl border border-edge overflow-hidden">
                {/* Original */}
                <div className="flex items-start gap-2 px-4 py-3 bg-surface-2/30">
                  <div className="flex-1">
                    <p className="text-[11px] text-tx-2 mb-0.5">Original #{i + 1}</p>
                    <p className="text-[13px] font-medium text-tx-0 leading-snug">{headline}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <CopyBtn text={headline} />
                    <button
                      onClick={() => generate(headline)}
                      disabled={isLoading || loading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white bg-gradient-to-r from-orange-600 to-rose-600 hover:brightness-110 transition-all disabled:opacity-40 cursor-pointer"
                    >
                      {isLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Shuffle className="w-3 h-3" />
                      )}
                      {isLoading ? "Generating..." : result ? "Re-generate" : "Generate Variants"}
                    </button>
                  </div>
                </div>

                {/* Variants */}
                {result && (
                  <div className="divide-y divide-edge">
                    {result.variants.map((v, vi) => (
                      <div key={vi} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2/10 transition-colors">
                        <div className="flex-shrink-0 mt-0.5">
                          <span className="text-[11px] text-tx-2 font-mono">{String.fromCharCode(65 + vi)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <AngleTag angle={v.angle} />
                            {v.score && (
                              <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                                v.score >= 80 ? "text-emerald-400" : v.score >= 65 ? "text-brand" : "text-amber-400"
                              }`}>
                                {v.score}/100
                              </span>
                            )}
                          </div>
                          <p className="text-[13px] font-medium text-tx-0 leading-snug mb-1">{stripMd(v.text)}</p>
                          <p className="text-[11px] text-tx-2 italic">{stripMd(v.rationale)}</p>
                        </div>
                        <CopyBtn text={v.text} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
