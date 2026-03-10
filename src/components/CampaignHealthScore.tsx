"use client";

import { Activity, TrendingUp, PenLine, Target, BarChart3, Award, CheckCircle2 } from "lucide-react";
import type { CampaignData, PlanData } from "@/app/page";

interface Dimension {
  label: string;
  score: number;
  icon: React.ElementType;
  detail: string;
}

function computeScore(campaign: CampaignData, plan: PlanData | null): Dimension[] {
  // Market Opportunity — research depth + trends presence + competitor mentions
  const resWords = (campaign.research || "").split(/\s+/).filter(Boolean).length;
  const hasCompetitors =
    /competitor|competitive|market leader|rival/i.test(campaign.research || "");
  const marketScore = Math.min(100,
    (resWords > 1200 ? 45 : resWords > 700 ? 30 : resWords > 300 ? 20 : 10) +
    (campaign.trends ? 30 : 0) +
    (hasCompetitors ? 25 : 10)
  );

  // Content Readiness — richness and format variety
  const contentText = campaign.content || "";
  const contentWords = contentText.split(/\s+/).filter(Boolean).length;
  const formats = ["Headlines", "Instagram", "TikTok", "LinkedIn", "Twitter", "Email", "Blog", "Ad Copy"]
    .filter((f) => contentText.includes(f)).length;
  const contentScore = Math.min(100,
    (contentWords > 1500 ? 40 : contentWords > 800 ? 25 : contentWords > 300 ? 15 : 5) +
    formats * 8
  );

  // Channel Fit — channels defined, strategy present, objectives measurable
  const channels = plan?.channels?.length || 0;
  const objectives = plan?.objectives?.length || 0;
  const channelScore = Math.min(100,
    Math.min(channels * 18, 50) +
    (campaign.strategy ? 25 : 0) +
    Math.min(objectives * 8, 25)
  );

  // Completeness — section presence
  const sections = [
    campaign.research, campaign.trends, campaign.content,
    campaign.strategy, campaign.report, campaign.personas,
    campaign.emailSequence, campaign.landingPage,
  ].filter(Boolean).length;
  const completenessScore = Math.round((sections / 8) * 100);

  return [
    { label: "Market Opportunity", score: marketScore, icon: TrendingUp, detail: `${resWords.toLocaleString()} research words` },
    { label: "Content Readiness", score: contentScore, icon: PenLine, detail: `${formats} formats generated` },
    { label: "Channel Fit", score: channelScore, icon: Target, detail: `${channels} channels · ${objectives} objectives` },
    { label: "Completeness", score: completenessScore, icon: BarChart3, detail: `${sections}/8 sections complete` },
  ];
}

function confidenceLabel(score: number): string {
  if (score >= 88) return "Campaign-Ready";
  if (score >= 72) return "Strong Foundation";
  if (score >= 55) return "Needs Refinement";
  return "Early Stage";
}

function colorFor(score: number): { text: string; bar: string; ring: string } {
  if (score >= 80) return { text: "text-emerald-400", bar: "bg-emerald-400", ring: "border-emerald-400/20 bg-emerald-400/5" };
  if (score >= 60) return { text: "text-brand", bar: "bg-brand", ring: "border-brand/20 bg-brand/5" };
  if (score >= 40) return { text: "text-amber-400", bar: "bg-amber-400", ring: "border-amber-400/20 bg-amber-400/5" };
  return { text: "text-rose-400", bar: "bg-rose-400", ring: "border-rose-400/20 bg-rose-400/5" };
}

export default function CampaignHealthScore({
  campaign,
  plan,
}: {
  campaign: CampaignData;
  plan: PlanData | null;
}) {
  const dimensions = computeScore(campaign, plan);
  const overall = Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length);
  const oc = colorFor(overall);

  return (
    <div className="glass-card p-5 anim-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-tx-2" />
          <h3 className="text-[12px] font-semibold text-tx-1 uppercase tracking-widest">
            Campaign Health Score
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold tabular-nums ${oc.text}`}>{overall}</span>
          <span className="text-[10px] text-tx-3">/100</span>
          <span className={`hidden sm:flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${oc.ring} ${oc.text}`}>
            {overall >= 80 && <CheckCircle2 className="w-2.5 h-2.5" />}
            {confidenceLabel(overall)}
          </span>
        </div>
      </div>

      {/* Gauge */}
      <div className="mb-5 h-2 rounded-full bg-surface-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${oc.bar}`}
          style={{ width: `${overall}%` }}
        />
      </div>

      {/* Dimensions */}
      <div className="space-y-3">
        {dimensions.map((dim) => {
          const DimIcon = dim.icon;
          const dc = colorFor(dim.score);
          return (
            <div key={dim.label}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <DimIcon className="w-3 h-3 text-tx-3" />
                  <span className="text-[11px] text-tx-2">{dim.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-tx-3 hidden sm:inline">{dim.detail}</span>
                  <span className={`text-[11px] font-semibold tabular-nums w-6 text-right ${dc.text}`}>
                    {dim.score}
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${dc.bar}`}
                  style={{ width: `${dim.score}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Plan chips */}
      {plan && (
        <div className="mt-4 pt-4 border-t border-edge flex flex-wrap gap-2">
          {plan.channels?.slice(0, 4).map((ch) => (
            <span
              key={ch.name}
              className="text-[10px] px-2 py-0.5 rounded-full bg-surface-2/60 border border-edge text-tx-2"
            >
              {ch.name}
              {ch.priority === "primary" && (
                <span className="ml-1 text-brand">•</span>
              )}
            </span>
          ))}
          {plan.timeline && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-2/60 border border-edge text-tx-3">
              {plan.timeline}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
