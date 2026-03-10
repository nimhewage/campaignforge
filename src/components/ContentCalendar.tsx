"use client";

import { useState } from "react";
import { Calendar, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import type { PlanData } from "@/app/page";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CalendarEntry {
  day: string;
  channel: string;
  type: string;
  description: string;
}

interface CalendarWeek {
  week: number;
  phase: string;
  phaseColor: string;
  entries: CalendarEntry[];
}

/* ------------------------------------------------------------------ */
/*  Channel colors                                                     */
/* ------------------------------------------------------------------ */

const CHANNEL_COLORS: Record<string, string> = {
  Instagram: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  TikTok: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  LinkedIn: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  Twitter: "bg-sky-500/15 text-sky-400 border-sky-500/20",
  Facebook: "bg-blue-600/15 text-blue-400 border-blue-600/20",
  Email: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  YouTube: "bg-red-500/15 text-red-400 border-red-500/20",
  Google: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "Paid Ads": "bg-orange-500/15 text-orange-400 border-orange-500/20",
  Blog: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  PR: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
};

function channelColor(ch: string): string {
  for (const [key, cls] of Object.entries(CHANNEL_COLORS)) {
    if (ch.toLowerCase().includes(key.toLowerCase())) return cls;
  }
  return "bg-surface-3/60 text-tx-3 border-edge";
}

/* ------------------------------------------------------------------ */
/*  Calendar generator                                                 */
/* ------------------------------------------------------------------ */

const DAYS = ["Mon", "Wed", "Fri", "Sat"];

const PHASES: { label: string; weeks: [number, number]; color: string }[] = [
  { label: "Pre-Launch", weeks: [1, 2], color: "text-amber-400" },
  { label: "Launch", weeks: [3, 4], color: "text-brand" },
  { label: "Sustain", weeks: [5, 8], color: "text-emerald-400" },
  { label: "Optimize", weeks: [9, 12], color: "text-violet-400" },
];

function generateCalendar(plan: PlanData, content: string): CalendarWeek[] {
  const channels = plan.channels?.length
    ? plan.channels.map((c) => c.name)
    : ["Instagram", "LinkedIn", "Email"];

  // Content type pool per phase
  const pools: Record<string, string[][]> = {
    "Pre-Launch": [
      ["Teaser post", "Brand story behind the scenes"],
      ["Awareness content", "Problem awareness hook"],
      ["Community building", "Audience poll / survey"],
      ["Email", "Pre-launch waitlist email"],
    ],
    "Launch": [
      ["Hero post", "Full campaign launch announcement"],
      ["Video", "Launch video — big idea"],
      ["Paid ad", "Conversion campaign go-live"],
      ["Email", "Launch email to list"],
      ["PR", "Press release / media pitch"],
    ],
    "Sustain": [
      ["Value post", "Educational content piece"],
      ["Social proof", "Customer story / testimonial"],
      ["Engagement", "UGC prompt / challenge"],
      ["Email", "Nurture sequence email"],
      ["Blog", "SEO long-form article"],
      ["Video", "Tutorial or how-to content"],
    ],
    "Optimize": [
      ["A/B test", "Headline variant test live"],
      ["Retargeting", "Retarget warm audience"],
      ["Email", "Re-engagement sequence"],
      ["Performance review", "Analytics review & pivot"],
      ["Boost", "Boost top-performing post"],
    ],
  };

  const calendar: CalendarWeek[] = [];

  for (let week = 1; week <= 12; week++) {
    const phase = PHASES.find((p) => week >= p.weeks[0] && week <= p.weeks[1]) || PHASES[2];
    const phasePool = pools[phase.label] || pools["Sustain"];
    const entries: CalendarEntry[] = [];

    // 3-4 posts per week
    const numPosts = phase.label === "Launch" ? 4 : phase.label === "Pre-Launch" ? 3 : Math.random() > 0.4 ? 4 : 3;
    const usedDays = new Set<string>();

    for (let i = 0; i < numPosts; i++) {
      const day = DAYS[i % DAYS.length];
      if (usedDays.has(day)) continue;
      usedDays.add(day);

      const ch = channels[i % channels.length];
      const pool = phasePool[i % phasePool.length] || phasePool[0];
      entries.push({
        day,
        channel: ch,
        type: pool[0],
        description: pool[1] || pool[0],
      });
    }

    // Always add email in week 3 and 6
    if ((week === 3 || week === 6 || week === 10) && !entries.some((e) => e.channel === "Email")) {
      entries.push({ day: "Thu", channel: "Email", type: "Email send", description: "Nurture sequence email" });
    }

    calendar.push({ week, phase: phase.label, phaseColor: phase.color, entries });
  }

  return calendar;
}

/* ------------------------------------------------------------------ */
/*  Week row                                                           */
/* ------------------------------------------------------------------ */

function WeekRow({ week }: { week: CalendarWeek }) {
  const isNewPhase = week.week === 1 ||
    PHASES.some((p) => p.weeks[0] === week.week && week.week > 1);

  return (
    <>
      {isNewPhase && (
        <div className="px-4 py-1.5 bg-surface-2/30 border-b border-t border-edge">
          <span className={`text-[9px] font-bold uppercase tracking-widest ${week.phaseColor}`}>
            {week.phase} Phase
          </span>
        </div>
      )}
      <div className="flex border-b border-edge last:border-0 hover:bg-surface-2/10 transition-colors">
        <div className="w-16 flex-shrink-0 flex items-center justify-center border-r border-edge">
          <span className="text-[11px] font-medium text-tx-2">Wk {week.week}</span>
        </div>
        <div className="flex-1 flex flex-wrap gap-1.5 px-3 py-2.5">
          {week.entries.map((entry, i) => (
            <div
              key={i}
              className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg border ${channelColor(entry.channel)}`}
            >
              <span className="font-medium">{entry.day}</span>
              <span className="opacity-60">·</span>
              <span className="font-semibold">{entry.channel}</span>
              <span className="opacity-60">—</span>
              <span>{entry.description}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

export default function ContentCalendar({
  plan,
  content,
}: {
  plan: PlanData | null;
  content: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!plan) return null;

  const calendar = generateCalendar(plan, content);

  const handleCopyCsv = () => {
    const rows = [["Week", "Phase", "Day", "Channel", "Content Type", "Description"]];
    calendar.forEach((w) => {
      w.entries.forEach((e) => {
        rows.push([`Week ${w.week}`, w.phase, e.day, e.channel, e.type, e.description]);
      });
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    navigator.clipboard.writeText(csv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-card overflow-hidden anim-fade-up">
      <div
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-surface-2/20 transition-colors cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-400" />
          <span className="text-[12px] font-semibold text-tx-1 uppercase tracking-widest">
            12-Week Content Calendar
          </span>
          <span className="text-[10px] text-tx-3 bg-surface-2/60 border border-edge rounded-full px-2 py-0.5 hidden sm:inline">
            {calendar.reduce((n, w) => n + w.entries.length, 0)} posts scheduled
          </span>
        </div>
        <div className="flex items-center gap-2">
          {open && (
            <button
              onClick={(e) => { e.stopPropagation(); handleCopyCsv(); }}
              className="flex items-center gap-1 text-[10px] text-tx-3 hover:text-tx-2 px-2 py-1 rounded border border-edge transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-ok" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy CSV"}
            </button>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-tx-4" /> : <ChevronDown className="w-4 h-4 text-tx-4" />}
        </div>
      </div>

      {open && (
        <div className="border-t border-edge">
          {/* Legend */}
          <div className="px-5 py-2.5 border-b border-edge flex flex-wrap gap-2">
            {(plan.channels?.slice(0, 5) || []).map((ch) => (
              <span
                key={ch.name}
                className={`text-[9px] font-medium px-2 py-0.5 rounded border ${channelColor(ch.name)}`}
              >
                {ch.name}
              </span>
            ))}
            <span className={`text-[9px] font-medium px-2 py-0.5 rounded border ${channelColor("Email")}`}>Email</span>
          </div>

          {/* Calendar rows */}
          <div className="divide-y divide-edge">
            {calendar.map((week) => (
              <WeekRow key={week.week} week={week} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
