"use client";

import { useState } from "react";
import { Zap, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { stripMd } from "@/lib/stripMd";

/* ------------------------------------------------------------------ */
/*  Scoring engine                                                     */
/* ------------------------------------------------------------------ */

const POWER_WORDS = [
  "proven", "breakthrough", "exclusive", "guaranteed", "limited", "free",
  "instant", "discover", "secret", "revolutionary", "ultimate", "powerful",
  "essential", "urgent", "now", "today", "save", "boost", "transform",
  "unlock", "achieve", "dominate", "crush", "master", "skyrocket",
];

const TRIGGER_PATTERNS: Record<string, RegExp> = {
  Urgency: /limited|now|today|hurry|deadline|last chance|only \d|expires|act fast|don'?t wait/i,
  FOMO: /don'?t miss|exclusive|members only|insider|secret|rare|before it'?s gone|join .{1,20}people/i,
  "Social Proof": /trusted by|join \d|#1|award.winning|verified|as seen in|used by|loved by|\d+\s*(customers|users|brands)/i,
  Curiosity: /why|discover|what happens|the truth|little.known|surprising|you won't believe|find out/i,
  Authority: /proven|expert|research shows|data.driven|industry.leading|backed by|science|study/i,
  Transformation: /transform|become|achieve|unlock|breakthrough|results|change|level up|upgrade/i,
};

interface ScoredItem {
  text: string;
  score: number;
  triggers: string[];
}

interface ScoredSection {
  title: string;
  items: ScoredItem[];
}

function scoreSingle(text: string): { score: number; triggers: string[] } {
  let score = 50;
  const triggers: string[] = [];

  // Power words
  const lc = text.toLowerCase();
  const pwCount = POWER_WORDS.filter((w) => lc.includes(w)).length;
  score += Math.min(pwCount * 6, 18);

  // Emotional triggers
  for (const [label, pattern] of Object.entries(TRIGGER_PATTERNS)) {
    if (pattern.test(text)) {
      triggers.push(label);
      score += 6;
    }
  }

  // Has number/stat
  if (/\d/.test(text)) score += 8;

  // Has question mark
  if (text.includes("?")) score += 5;

  // Has exclamation
  if (text.includes("!")) score += 3;

  // Length penalty for social (> 200 chars)
  if (text.length > 280) score -= 8;
  if (text.length > 500) score -= 8;

  // Bonus for CTA words
  if (/\b(get|start|join|try|learn|discover|shop|book|download|sign up|buy)\b/i.test(text)) score += 8;

  return { score: Math.min(100, Math.max(10, score)), triggers };
}

function extractSections(content: string): ScoredSection[] {
  const sections: ScoredSection[] = [];

  // Headlines
  const headlineMatch = content.match(/##\s*Campaign Headlines[\s\S]*?(?=##|$)/i);
  if (headlineMatch) {
    const lines = headlineMatch[0]
      .split("\n")
      .slice(1)
      .map((l) => l.replace(/^\d+\.\s*/, "").replace(/\*\*/g, "").trim())
      .filter((l) => l.length > 10 && l.length < 300);
    if (lines.length > 0) {
      sections.push({ title: "Campaign Headlines", items: lines.slice(0, 5).map((t) => ({ text: t, ...scoreSingle(t) })) });
    }
  }

  // Ad Copy
  const adMatch = content.match(/##\s*Ad Copy[\s\S]*?(?=##|$)/i);
  if (adMatch) {
    const headlines = [...adMatch[0].matchAll(/Headline[:\s]+([^\n]+)/gi)].map((m) => m[1].trim());
    if (headlines.length > 0) {
      sections.push({ title: "Ad Headlines", items: headlines.slice(0, 3).map((t) => ({ text: t, ...scoreSingle(t) })) });
    }
  }

  // Twitter posts
  const twitterMatch = content.match(/##\s*Twitter[\s\S]*?(?=##|$)/i);
  if (twitterMatch) {
    const tweets = twitterMatch[0]
      .split("\n")
      .slice(1)
      .map((l) => l.replace(/^\d+\.\s*/, "").replace(/\*\*/g, "").trim())
      .filter((l) => l.length > 15 && l.length < 280 && !l.startsWith("#"));
    if (tweets.length > 0) {
      sections.push({ title: "Tweets", items: tweets.slice(0, 4).map((t) => ({ text: t, ...scoreSingle(t) })) });
    }
  }

  // Subject lines
  const emailMatch = content.match(/Subject\s*Lines?[\s\S]*?(?=##|$)/i);
  if (emailMatch) {
    const lines = emailMatch[0]
      .split("\n")
      .slice(1)
      .map((l) => l.replace(/^\d+\.\s*/, "").replace(/\*\*/g, "").trim())
      .filter((l) => l.length > 5 && l.length < 120 && !l.toLowerCase().startsWith("subject"));
    if (lines.length > 0) {
      sections.push({ title: "Email Subject Lines", items: lines.slice(0, 3).map((t) => ({ text: t, ...scoreSingle(t) })) });
    }
  }

  return sections;
}

/* ------------------------------------------------------------------ */
/*  Score badge                                                        */
/* ------------------------------------------------------------------ */

function ScoreBadge({ score }: { score: number }) {
  const { label, cls } = score >= 85
    ? { label: "Strong", cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" }
    : score >= 70
    ? { label: "Good", cls: "text-brand bg-brand/10 border-brand/20" }
    : score >= 55
    ? { label: "Fair", cls: "text-amber-400 bg-amber-400/10 border-amber-400/20" }
    : { label: "Weak", cls: "text-rose-400 bg-rose-400/10 border-rose-400/20" };
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${cls}`}>
      {score} {label}
    </span>
  );
}

function TriggerTag({ label }: { label: string }) {
  const colors: Record<string, string> = {
    Urgency: "text-rose-400 bg-rose-400/8 border-rose-400/15",
    FOMO: "text-orange-400 bg-orange-400/8 border-orange-400/15",
    "Social Proof": "text-emerald-400 bg-emerald-400/8 border-emerald-400/15",
    Curiosity: "text-violet-400 bg-violet-400/8 border-violet-400/15",
    Authority: "text-blue-400 bg-blue-400/8 border-blue-400/15",
    Transformation: "text-amber-400 bg-amber-400/8 border-amber-400/15",
  };
  return (
    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${colors[label] || "text-tx-3 border-edge"}`}>
      {label}
    </span>
  );
}

function CopyTextBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="opacity-0 group-hover:opacity-100 p-1 rounded text-tx-4 hover:text-tx-2 transition-all cursor-pointer"
    >
      {done ? <Check className="w-3 h-3 text-ok" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ContentScorer({ content }: { content: string }) {
  const [open, setOpen] = useState(true);
  const sections = extractSections(content);
  if (sections.length === 0) return null;

  const allScores = sections.flatMap((s) => s.items.map((i) => i.score));
  const avgScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);

  return (
    <div className="glass-card overflow-hidden anim-fade-up">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-surface-2/20 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-[12px] font-semibold text-tx-1 uppercase tracking-widest">
            Predictive Content Scores
          </span>
          <ScoreBadge score={avgScore} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-tx-2">{allScores.length} pieces scored</span>
          {open ? <ChevronUp className="w-4 h-4 text-tx-4" /> : <ChevronDown className="w-4 h-4 text-tx-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-edge divide-y divide-edge">
          {sections.map((section) => (
            <div key={section.title} className="px-5 py-3">
              <p className="text-[10px] font-semibold text-tx-2 uppercase tracking-wider mb-2.5">
                {section.title}
              </p>
              <div className="space-y-2.5">
                {section.items.map((item, i) => (
                  <div key={i} className="group flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-tx-1 leading-snug mb-1.5">{stripMd(item.text)}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <ScoreBadge score={item.score} />
                        {item.triggers.slice(0, 3).map((t) => (
                          <TriggerTag key={t} label={t} />
                        ))}
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-1 mt-0.5">
                      {/* Score bar */}
                      <div className="w-16 h-1 rounded-full bg-surface-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            item.score >= 80 ? "bg-emerald-400" : item.score >= 65 ? "bg-brand" : item.score >= 50 ? "bg-amber-400" : "bg-rose-400"
                          }`}
                          style={{ width: `${item.score}%` }}
                        />
                      </div>
                      <CopyTextBtn text={item.text} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
