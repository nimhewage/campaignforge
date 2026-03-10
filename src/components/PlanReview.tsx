"use client";

import { useState } from "react";
import type { PlanData } from "@/app/page";
import {
  ClipboardList,
  Users,
  Target,
  Megaphone,
  MessageSquare,
  Calendar,
  DollarSign,
  ChevronRight,
  Sparkles,
  X,
  Plus,
} from "lucide-react";

interface Props {
  plan: PlanData;
  onApprove: (userNotes?: string) => void;
}

export default function PlanReview({ plan, onApprove }: Props) {
  const [notes, setNotes] = useState("");
  const [enabledObjectives, setEnabledObjectives] = useState<boolean[]>(
    () => plan.objectives?.map(() => true) || []
  );
  const [enabledChannels, setEnabledChannels] = useState<boolean[]>(
    () => plan.channels?.map(() => true) || []
  );
  const [customObjective, setCustomObjective] = useState("");

  const toggleObjective = (i: number) => {
    setEnabledObjectives((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };
  const toggleChannel = (i: number) => {
    setEnabledChannels((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };
  const addObjective = () => {
    if (!customObjective.trim()) return;
    plan.objectives = [...(plan.objectives || []), customObjective.trim()];
    setEnabledObjectives((prev) => [...prev, true]);
    setCustomObjective("");
  };

  const handleApprove = () => {
    const parts: string[] = [];

    const disabledObjectives = plan.objectives?.filter((_, i) => !enabledObjectives[i]) || [];
    if (disabledObjectives.length) {
      parts.push(`Remove these objectives: ${disabledObjectives.join("; ")}`);
    }

    const disabledChannels = plan.channels?.filter((_, i) => !enabledChannels[i]).map((c) => c.name) || [];
    if (disabledChannels.length) {
      parts.push(`Skip these channels: ${disabledChannels.join(", ")}`);
    }

    if (notes.trim()) parts.push(notes.trim());

    onApprove(parts.length ? parts.join("\n") : undefined);
  };

  const channelColors: Record<string, string> = {
    primary: "border-brand/30 bg-brand/8 text-brand-bright",
    secondary: "border-ok/25 bg-ok/6 text-ok",
    tertiary: "border-tx-3/20 bg-surface-3/40 text-tx-2",
  };

  return (
    <div className="glass-card overflow-hidden anim-fade-up">
      {/* Header */}
      <div className="p-5 pb-4 border-b border-edge bg-gradient-to-r from-brand/[0.04] to-transparent">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-5 h-5 text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium text-brand uppercase tracking-widest mb-1">
              Campaign Plan — Review & Approve
            </p>
            <h2 className="text-lg font-bold text-tx-0 leading-tight">
              {plan.campaign_name || "Campaign Plan"}
            </h2>
            {plan.big_idea && (
              <p className="mt-1.5 text-sm text-tx-2 leading-relaxed italic">
                &ldquo;{plan.big_idea}&rdquo;
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Target Audience */}
        {plan.target_audience && (
          <Section icon={Users} title="Target Audience">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {plan.target_audience.primary && (
                <InfoPill label="Primary" value={plan.target_audience.primary} />
              )}
              {plan.target_audience.secondary && (
                <InfoPill label="Secondary" value={plan.target_audience.secondary} />
              )}
              {plan.target_audience.location && (
                <InfoPill label="Location" value={plan.target_audience.location} />
              )}
            </div>
          </Section>
        )}

        {/* Objectives (toggleable) */}
        {plan.objectives?.length > 0 && (
          <Section icon={Target} title="Objectives" subtitle="Toggle to include/exclude">
            <div className="space-y-1.5">
              {plan.objectives.map((obj, i) => (
                <button
                  key={i}
                  onClick={() => toggleObjective(i)}
                  className={`w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg border transition-all cursor-pointer ${
                    enabledObjectives[i]
                      ? "border-ok/20 bg-ok/[0.04] text-tx-1"
                      : "border-edge bg-surface-0/40 text-tx-4 line-through opacity-50"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      enabledObjectives[i] ? "border-ok bg-ok" : "border-tx-4/30"
                    }`}
                  >
                    {enabledObjectives[i] && (
                      <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-surface-0">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="text-[12px] leading-snug">{obj}</span>
                </button>
              ))}
              <div className="flex gap-2 mt-2">
                <input
                  value={customObjective}
                  onChange={(e) => setCustomObjective(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addObjective()}
                  placeholder="Add a custom objective..."
                  className="flex-1 text-[12px] bg-surface-0/60 border border-dashed border-edge rounded-lg px-3 py-2 text-tx-2 placeholder:text-tx-4 focus:outline-none focus:border-brand/30"
                />
                <button
                  onClick={addObjective}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg border border-dashed border-edge text-[11px] text-tx-2 hover:text-brand hover:border-brand/30 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
            </div>
          </Section>
        )}

        {/* Channels (toggleable pills) */}
        {plan.channels?.length > 0 && (
          <Section icon={Megaphone} title="Channels" subtitle="Click to toggle">
            <div className="flex flex-wrap gap-2">
              {plan.channels.map((ch, i) => {
                const enabled = enabledChannels[i];
                const colorCls = enabled
                  ? channelColors[ch.priority] || channelColors.tertiary
                  : "border-edge bg-surface-0/40 text-tx-4";
                return (
                  <button
                    key={i}
                    onClick={() => toggleChannel(i)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium transition-all cursor-pointer ${colorCls} ${
                      !enabled ? "opacity-40 line-through" : ""
                    }`}
                  >
                    {ch.name}
                    {enabled && (
                      <span className="text-[9px] opacity-60 font-normal">{ch.priority}</span>
                    )}
                    {!enabled && <X className="w-3 h-3 opacity-50" />}
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {/* Tone & Messages */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {plan.tone && (
            <Section icon={MessageSquare} title="Tone">
              <p className="text-[12px] text-tx-2 leading-relaxed">{plan.tone}</p>
            </Section>
          )}
          {plan.key_messages?.length > 0 && (
            <Section icon={Sparkles} title="Key Messages">
              <div className="space-y-1">
                {plan.key_messages.map((msg, i) => (
                  <p key={i} className="text-[12px] text-tx-2 flex gap-2">
                    <span className="text-brand font-semibold">{i + 1}.</span>
                    {msg}
                  </p>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Timeline & Budget */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {plan.timeline && (
            <Section icon={Calendar} title="Timeline">
              <p className="text-[12px] text-tx-2">{plan.timeline}</p>
            </Section>
          )}
          {plan.budget_notes && (
            <Section icon={DollarSign} title="Budget">
              <p className="text-[12px] text-tx-2">{plan.budget_notes}</p>
            </Section>
          )}
        </div>

        {/* User direction */}
        <div className="pt-3 border-t border-edge">
          <label className="block text-[11px] font-medium text-tx-2 uppercase tracking-widest mb-2">
            Your Direction (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add preferences, constraints, or creative direction that agents should follow..."
            rows={3}
            className="w-full text-[13px] bg-surface-0/60 border border-edge rounded-xl px-4 py-3 text-tx-1 placeholder:text-tx-4 resize-none focus:outline-none focus:border-brand/30 transition-colors"
          />
        </div>

        {/* Approve button */}
        <button
          onClick={handleApprove}
          className="w-full group flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[14px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:brightness-110 transition-all cursor-pointer"
        >
          Approve & Execute Campaign
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-tx-3" />
        <h3 className="text-[12px] font-semibold text-tx-1 uppercase tracking-wide">{title}</h3>
        {subtitle && <span className="text-[10px] text-tx-3 ml-1">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-2/50 border border-edge rounded-lg px-3 py-2">
      <p className="text-[9px] font-medium text-tx-3 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-[12px] text-tx-1 leading-snug">{value}</p>
    </div>
  );
}
