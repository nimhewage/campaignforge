"use client";

import type { AgentState, Phase } from "@/app/page";
import { useState, useEffect, useRef } from "react";
import {
  Brain, Search, TrendingUp, PenLine, Target, FileText,
  Loader2, Check, AlertTriangle, Globe, Users, Mail, Layout,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { stripMd } from "@/lib/stripMd";

const ICONS: Record<string, LucideIcon> = {
  orchestrator: Brain, researcher: Search, trend_analyst: TrendingUp,
  content_creator: PenLine, strategist: Target, report_generator: FileText,
  persona_builder: Users, email_strategist: Mail, landing_page: Layout,
};
const META: Record<string, { desc: string; model: string }> = {
  orchestrator: { desc: "Brief analysis & workflow planning", model: "mistral-small" },
  researcher: { desc: "Market sizing & competitor mapping", model: "mistral-large" },
  trend_analyst: { desc: "Social signals & viral patterns", model: "mistral-large" },
  content_creator: { desc: "Copy, posts & ad creative", model: "mistral-large" },
  strategist: { desc: "Channel mix, timeline & budget", model: "mistral-large" },
  report_generator: { desc: "Executive brief & scorecard", model: "mistral-large" },
  persona_builder: { desc: "Audience personas & psychographics", model: "mistral-large" },
  email_strategist: { desc: "5-email drip sequence", model: "mistral-large" },
  landing_page: { desc: "CRO landing page brief", model: "mistral-large" },
};

/* ---- Utilities ---- */

function LiveTimer({ startedAt }: { startedAt: number }) {
  const [s, setS] = useState(0);
  useEffect(() => {
    setS(Math.round((Date.now() - startedAt) / 1000));
    const id = setInterval(() => setS(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <>{s}s</>;
}

function CoTTerminal({ text, toolEvents }: { text: string; toolEvents?: { tool: string; query: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const hasTools = toolEvents && toolEvents.length > 0;
  const hasText = !!text;

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [text, toolEvents]);

  if (!hasText && !hasTools) return null;

  const stripMd = (s: string) =>
    s.replace(/^#+\s*/gm, "").replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
     .replace(/`([^`]+)`/g, "$1").replace(/^[-*>|]\s*/gm, "").replace(/__([^_]+)__/g, "$1").trim();
  const lines = text ? text.split("\n").filter((l) => l.trim()).slice(-6).map(stripMd).filter(Boolean) : [];

  return (
    <div ref={ref} className="mt-2 bg-surface-0/80 border border-edge rounded-lg p-2.5 max-h-[100px] overflow-y-auto">
      {hasTools && toolEvents!.map((te, i) => (
        <div key={`tool-${i}`} className="flex items-center gap-1.5 mb-1">
          <Globe className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />
          <p className="text-[10px] font-mono text-amber-400/80 leading-[1.6] break-words">
            <span className="opacity-60">[{te.tool}]</span> {te.query}
          </p>
        </div>
      ))}
      {lines.map((line, i) => (
        <p key={i} className="text-[10px] font-mono text-tx-2/60 leading-[1.6] break-words">{line}</p>
      ))}
      <span className="inline-block w-[6px] h-[12px] bg-brand/50 animate-pulse ml-0.5" />
    </div>
  );
}

function snippet(output?: string) {
  if (!output) return "";
  return stripMd(output).replace(/\n+/g, " ").slice(0, 120);
}

/* ---- SVG Flow Connector ---- */

type ConnStatus = "idle" | "active" | "complete";

function connStatus(up: AgentState[], down: AgentState[]): ConnStatus {
  if (down.every((a) => a.status === "complete")) return "complete";
  if (up.every((a) => a.status === "complete")) return "active";
  return "idle";
}

function FlowConnector({ type, status }: { type: "split" | "through" | "merge"; status: ConnStatus }) {
  const isActive = status === "active";
  const isDone = status === "complete";
  const color = isDone ? "#34d399" : isActive ? "#818cf8" : "rgba(255,255,255,0.05)";
  const width = isDone || isActive ? 1.5 : 1;
  const cls = isActive ? "flow-path-active" : "";

  const paths: { d: string; id: string }[] = [];
  if (type === "split") {
    paths.push({ d: "M 320 0 C 320 28, 160 20, 160 48", id: "sp1" });
    paths.push({ d: "M 320 0 C 320 28, 480 20, 480 48", id: "sp2" });
  } else if (type === "through") {
    paths.push({ d: "M 160 0 C 160 16, 160 32, 160 48", id: "th1" });
    paths.push({ d: "M 480 0 C 480 16, 480 32, 480 48", id: "th2" });
  } else {
    paths.push({ d: "M 160 0 C 160 20, 320 28, 320 48", id: "mg1" });
    paths.push({ d: "M 480 0 C 480 20, 320 28, 320 48", id: "mg2" });
  }

  return (
    <div className="w-full max-w-[640px] mx-auto h-12">
      <svg viewBox="0 0 640 48" fill="none" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <filter id="glowB" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glowG" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {paths.map((p) => (
          <g key={p.id}>
            <path d={p.d} stroke={color} strokeWidth={width} strokeLinecap="round" className={cls}
              filter={isActive ? "url(#glowB)" : isDone ? "url(#glowG)" : "none"} />
            {isActive && (
              <>
                <circle r="3" fill="#818cf8" filter="url(#glowB)" opacity="0.9">
                  <animateMotion dur="1.8s" repeatCount="indefinite">
                    <mpath xlinkHref={`#${p.id}-ref`} />
                  </animateMotion>
                </circle>
                <path id={`${p.id}-ref`} d={p.d} stroke="none" fill="none" />
              </>
            )}
            {isDone && (
              <>
                <circle r="2" fill="#34d399" filter="url(#glowG)" opacity="0.6">
                  <animateMotion dur="2.5s" repeatCount="indefinite">
                    <mpath xlinkHref={`#${p.id}-ref2`} />
                  </animateMotion>
                </circle>
                <path id={`${p.id}-ref2`} d={p.d} stroke="none" fill="none" />
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ---- Agent Card ---- */

function AgentCard({ agent, anyRunning }: { agent: AgentState; anyRunning: boolean }) {
  const Icon = ICONS[agent.id] || Brain;
  const meta = META[agent.id];
  const isIdle = agent.status === "idle";
  const isRunning = agent.status === "running";
  const isDone = agent.status === "complete";
  const isError = agent.status === "error";
  const isQueued = isIdle && anyRunning;
  const dur = agent.startedAt && agent.completedAt ? `${Math.round((agent.completedAt - agent.startedAt) / 1000)}s` : null;
  const hasToolEvents = agent.toolEvents && agent.toolEvents.length > 0;

  return (
    <div className={`rounded-2xl border transition-all duration-500 overflow-hidden ${
      isRunning ? "border-brand/25 bg-surface-2 glow-brand anim-spawn"
      : isDone ? "border-ok/12 bg-surface-1 anim-spawn"
      : isError ? "border-fail/20 bg-surface-1 anim-spawn"
      : isQueued ? "border-dashed border-surface-4 bg-surface-0/40 opacity-30"
      : "border-dashed border-surface-4 bg-surface-0/40 opacity-20"
    }`}>
      <div className="p-3.5">
        <div className="flex items-start gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
            isRunning ? "bg-brand/12 anim-ring" : isDone ? "bg-ok/8" : isError ? "bg-fail/10" : "bg-surface-3/50"
          }`}>
            {isRunning ? <Loader2 className="w-3.5 h-3.5 text-brand animate-spin" />
            : isDone ? <Check className="w-3.5 h-3.5 text-ok" strokeWidth={2.5} />
            : isError ? <AlertTriangle className="w-3.5 h-3.5 text-fail" />
            : <Icon className="w-3.5 h-3.5 text-tx-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className={`text-[12px] font-semibold leading-tight truncate ${isRunning || isDone ? "text-tx-0" : "text-tx-2"}`}>
                {agent.name}
              </p>
              {isRunning && agent.startedAt && (
                <span className="text-[10px] text-brand tabular-nums font-mono flex-shrink-0">
                  <LiveTimer startedAt={agent.startedAt} />
                </span>
              )}
              {isDone && dur && (
                <span className="text-[10px] text-ok/70 tabular-nums font-mono flex-shrink-0">{dur}</span>
              )}
            </div>
            <p className="text-[10px] text-tx-3 mt-0.5 truncate">
              {isQueued ? "Queued" : isRunning ? (hasToolEvents ? "Searching live data..." : meta.model) : isDone ? `${agent.completedSteps.length} steps` : meta.desc}
            </p>
          </div>
        </div>

        {isRunning && (
          <div className="mt-2.5 pl-[42px] space-y-1">
            {agent.completedSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Check className="w-2.5 h-2.5 text-ok/40 flex-shrink-0" strokeWidth={2.5} />
                <span className="text-[10px] text-tx-2/70">{stripMd(step)}</span>
              </div>
            ))}
            {agent.currentStep && (
              <div className="flex items-center gap-1.5">
                <Loader2 className="w-2.5 h-2.5 text-brand/50 animate-spin flex-shrink-0" />
                <span className="text-[10px] text-brand/60">{stripMd(agent.currentStep)}</span>
              </div>
            )}
            <CoTTerminal text={agent.streamingText || ""} toolEvents={agent.toolEvents} />
          </div>
        )}

        {isDone && agent.output && (
          <p className="mt-2 pl-[42px] text-[10px] text-tx-3 leading-relaxed line-clamp-2">{snippet(agent.output)}</p>
        )}
        {isIdle && !isQueued && <p className="mt-1 pl-[42px] text-[10px] text-tx-3">{meta.desc}</p>}
        {isError && agent.currentStep && <p className="mt-2 pl-[42px] text-[10px] text-fail/60">{stripMd(agent.currentStep)}</p>}
      </div>
    </div>
  );
}

/* ---- Main Layout: Flow Diagram ---- */

export default function AgentGrid({ agents, phase }: { agents: AgentState[]; phase: Phase }) {
  const anyActive = agents.some((a) => a.status !== "idle");
  if (!anyActive && phase === "idle") return null;

  const anyRunning = agents.some((a) => a.status === "running");
  const byId = (id: string) => agents.find((a) => a.id === id)!;

  const orch = byId("orchestrator");
  const res = byId("researcher");
  const trend = byId("trend_analyst");
  const cont = byId("content_creator");
  const strat = byId("strategist");
  const persona = byId("persona_builder");
  const email = byId("email_strategist");
  const landing = byId("landing_page");
  const report = byId("report_generator");

  // During plan_review, only show orchestrator as complete
  if (phase === "plan_review") {
    return (
      <div className="flex flex-col items-center anim-fade-up">
        <div className="w-full max-w-sm">
          <AgentCard agent={orch} anyRunning={false} />
        </div>
      </div>
    );
  }

  // During planning, only show orchestrator
  if (phase === "planning") {
    return (
      <div className="flex flex-col items-center anim-fade-up">
        <div className="w-full max-w-sm">
          <AgentCard agent={orch} anyRunning={anyRunning} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center anim-fade-up">
      {/* Phase 1: Orchestrator */}
      <div className="w-full max-w-sm">
        <AgentCard agent={orch} anyRunning={anyRunning} />
      </div>

      <FlowConnector type="split" status={connStatus([orch], [res, trend])} />

      {/* Phase 2: Research + Trends */}
      <div className="flex gap-3 w-full max-w-[640px]">
        <div className="flex-1"><AgentCard agent={res} anyRunning={anyRunning} /></div>
        <div className="flex-1"><AgentCard agent={trend} anyRunning={anyRunning} /></div>
      </div>

      <FlowConnector type="through" status={connStatus([res, trend], [cont, strat])} />

      {/* Phase 3a: Content + Strategy */}
      <div className="flex gap-3 w-full max-w-[640px]">
        <div className="flex-1"><AgentCard agent={cont} anyRunning={anyRunning} /></div>
        <div className="flex-1"><AgentCard agent={strat} anyRunning={anyRunning} /></div>
      </div>

      {/* Phase 3b: Specialist agents */}
      {(persona || email || landing) && (persona.status !== "idle" || email.status !== "idle" || landing.status !== "idle") && (
        <>
          <div className="flex gap-3 w-full max-w-[640px] mt-3">
            {persona && <div className="flex-1"><AgentCard agent={persona} anyRunning={anyRunning} /></div>}
            {email && <div className="flex-1"><AgentCard agent={email} anyRunning={anyRunning} /></div>}
            {landing && <div className="flex-1"><AgentCard agent={landing} anyRunning={anyRunning} /></div>}
          </div>
        </>
      )}

      <FlowConnector type="merge" status={connStatus([cont, strat, ...[persona, email, landing].filter((a): a is AgentState => !!a)], [report])} />

      {/* Phase 4: Report */}
      <div className="w-full max-w-sm">
        <AgentCard agent={report} anyRunning={anyRunning} />
      </div>
    </div>
  );
}
