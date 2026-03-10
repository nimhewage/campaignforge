"use client";

import { useState } from "react";
import { TrendingUp, DollarSign, Users, MousePointer, ChevronDown, ChevronUp } from "lucide-react";
import type { PlanData } from "@/app/page";

/* ------------------------------------------------------------------ */
/*  Industry benchmarks                                                */
/* ------------------------------------------------------------------ */

const BENCHMARKS: Record<string, { ctr: number; cvr: number; cpm: number; label: string }> = {
  ecommerce: { ctr: 0.028, cvr: 0.032, cpm: 9.5, label: "E-Commerce" },
  saas: { ctr: 0.022, cvr: 0.018, cpm: 14.5, label: "SaaS / Tech" },
  fintech: { ctr: 0.018, cvr: 0.012, cpm: 18.0, label: "FinTech" },
  health: { ctr: 0.032, cvr: 0.025, cpm: 8.5, label: "Health & Wellness" },
  fashion: { ctr: 0.035, cvr: 0.028, cpm: 7.5, label: "Fashion & Lifestyle" },
  b2b: { ctr: 0.016, cvr: 0.008, cpm: 22.0, label: "B2B Services" },
  realestate: { ctr: 0.020, cvr: 0.006, cpm: 12.0, label: "Real Estate" },
  food: { ctr: 0.042, cvr: 0.035, cpm: 7.0, label: "Food & Beverage" },
  nonprofit: { ctr: 0.028, cvr: 0.022, cpm: 6.5, label: "Non-Profit" },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return n.toLocaleString();
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${n.toLocaleString()}`;
}

function computeProjection(budget: number, industry: string, aov: number, cvrMulti: number) {
  const bm = BENCHMARKS[industry] || BENCHMARKS.ecommerce;

  // Impressions = (budget / cpm) * 1000, but assume 40% goes to paid, rest to organic amplification
  const paidBudget = budget * 0.55;
  const impressions = Math.round((paidBudget / bm.cpm) * 1000 * 1.8); // 1.8x for organic lift
  const clicks = Math.round(impressions * bm.ctr);
  const adjustedCvr = bm.cvr * cvrMulti;
  const conversions = Math.round(clicks * adjustedCvr);
  const revenue = Math.round(conversions * aov);
  const roas = revenue > 0 ? (revenue / budget).toFixed(1) : "0.0";
  const cpl = conversions > 0 ? Math.round(budget / conversions) : 0;

  return {
    impressions,
    clicks,
    conversions,
    revenue,
    roas,
    cpl,
    conservative: {
      impressions: Math.round(impressions * 0.6),
      clicks: Math.round(clicks * 0.6),
      conversions: Math.round(conversions * 0.6),
      revenue: Math.round(revenue * 0.6),
    },
    optimistic: {
      impressions: Math.round(impressions * 1.5),
      clicks: Math.round(clicks * 1.5),
      conversions: Math.round(conversions * 1.45),
      revenue: Math.round(revenue * 1.45),
    },
  };
}

function detectIndustry(brief: string): string {
  const b = brief.toLowerCase();
  if (/saas|software|startup|app|platform|tech/.test(b)) return "saas";
  if (/fintech|payment|banking|finance|crypto/.test(b)) return "fintech";
  if (/health|wellness|fitness|medical|mental/.test(b)) return "health";
  if (/fashion|clothing|apparel|style|luxury/.test(b)) return "fashion";
  if (/b2b|enterprise|corporate|consulting|agency/.test(b)) return "b2b";
  if (/real estate|property|housing|mortgage/.test(b)) return "realestate";
  if (/food|restaurant|cafe|beverage|snack/.test(b)) return "food";
  if (/non.?profit|charity|ngo|donation/.test(b)) return "nonprofit";
  return "ecommerce";
}

function extractBudget(brief: string): number {
  const m = brief.match(/\$?([\d,]+)\s*[kK]/);
  if (m) return parseInt(m[1].replace(/,/g, "")) * 1000;
  const m2 = brief.match(/budget[:\s]+\$?([\d,]+)/i);
  if (m2) return parseInt(m2[1].replace(/,/g, ""));
  return 50000;
}

/* ------------------------------------------------------------------ */
/*  Slider                                                             */
/* ------------------------------------------------------------------ */

function Slider({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[11px] text-tx-2">{label}</span>
        <span className="text-[11px] font-medium text-tx-0 tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full bg-surface-3 appearance-none cursor-pointer accent-indigo-500"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Metric card                                                        */
/* ------------------------------------------------------------------ */

function Metric({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType; label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-brand/20 bg-brand/5" : "border-edge bg-surface-2/30"}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={`w-3.5 h-3.5 ${accent ? "text-brand" : "text-tx-2"}`} />
        <span className="text-[11px] text-tx-2 uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-[18px] font-bold tabular-nums ${accent ? "text-brand-bright" : "text-tx-0"}`}>{value}</p>
      {sub && <p className="text-[11px] text-tx-2 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

export default function ROIProjector({ plan, brief }: { plan: PlanData | null; brief: string }) {
  const [open, setOpen] = useState(false);
  const detectedIndustry = detectIndustry(brief);
  const detectedBudget = extractBudget(brief);

  const [budget, setBudget] = useState(detectedBudget);
  const [industry, setIndustry] = useState(detectedIndustry);
  const [aov, setAov] = useState(120);
  const [cvrMulti, setCvrMulti] = useState(1.0);
  const [scenario, setScenario] = useState<"conservative" | "expected" | "optimistic">("expected");

  const proj = computeProjection(budget, industry, aov, cvrMulti);
  const data = scenario === "expected" ? proj : proj[scenario];

  return (
    <div className="glass-card overflow-hidden anim-fade-up">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-surface-2/20 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span className="text-[12px] font-semibold text-tx-1 uppercase tracking-widest">
            Campaign ROI Projector
          </span>
          <span className="text-[11px] text-tx-2 bg-surface-2/60 border border-edge rounded-full px-2 py-0.5 hidden sm:inline">
            {BENCHMARKS[industry]?.label || "E-Commerce"} · {fmtMoney(budget)}
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-tx-4" /> : <ChevronDown className="w-4 h-4 text-tx-4" />}
      </button>

      {open && (
        <div className="border-t border-edge p-5 space-y-5">
          {/* Scenario switcher */}
          <div className="flex gap-1 p-1 rounded-xl bg-surface-2/40 border border-edge">
            {(["conservative", "expected", "optimistic"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg capitalize transition-all cursor-pointer ${
                  scenario === s
                    ? "bg-surface-0 text-tx-0 shadow-sm border border-edge"
                    : "text-tx-2 hover:text-tx-1"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Metric icon={Users} label="Impressions" value={fmt(data.impressions)} sub="total reach" />
            <Metric icon={MousePointer} label="Clicks" value={fmt(data.clicks)} sub={`${(proj.impressions > 0 ? (proj.clicks / proj.impressions * 100) : 0).toFixed(1)}% CTR`} />
            <Metric icon={TrendingUp} label="Conversions" value={fmt(data.conversions)} sub={`$${proj.cpl} CPL`} />
            <Metric icon={DollarSign} label="Revenue" value={fmtMoney(data.revenue)} sub={`${proj.roas}x ROAS`} accent />
          </div>

          {/* Sliders */}
          <div className="space-y-4 pt-2 border-t border-edge">
            <p className="text-[11px] text-tx-2 uppercase tracking-widest font-medium">Adjust Assumptions</p>
            <Slider
              label="Campaign Budget"
              value={budget}
              min={5000} max={500000} step={5000}
              format={fmtMoney}
              onChange={setBudget}
            />
            <Slider
              label="Average Order Value"
              value={aov}
              min={20} max={2000} step={10}
              format={(v) => `$${v}`}
              onChange={setAov}
            />
            <Slider
              label="Conversion Rate Multiplier"
              value={cvrMulti}
              min={0.3} max={2.5} step={0.1}
              format={(v) => `${v.toFixed(1)}x`}
              onChange={setCvrMulti}
            />

            {/* Industry selector */}
            <div>
              <p className="text-[11px] text-tx-2 mb-1.5">Industry Benchmark</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(BENCHMARKS).map(([key, bm]) => (
                  <button
                    key={key}
                    onClick={() => setIndustry(key)}
                    className={`text-[10px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                      industry === key
                        ? "border-brand/30 bg-brand/10 text-brand-bright"
                        : "border-edge text-tx-2 hover:text-tx-1"
                    }`}
                  >
                    {bm.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Channels breakdown */}
          {plan?.channels && plan.channels.length > 0 && (
            <div className="pt-3 border-t border-edge">
              <p className="text-[11px] text-tx-2 uppercase tracking-widest font-medium mb-2.5">
                Suggested Budget Allocation
              </p>
              <div className="space-y-2">
                {plan.channels.map((ch, i) => {
                  const pct = ch.priority === "primary" ? 35 : ch.priority === "secondary" ? 25 : 15;
                  const allocated = Math.round(budget * (pct / 100));
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[11px] text-tx-2 w-28 truncate flex-shrink-0">{ch.name}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                        <div className="h-full rounded-full bg-brand/60" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-tx-3 tabular-nums w-14 text-right flex-shrink-0">
                        {pct}% · {fmtMoney(allocated)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
