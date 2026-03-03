"use client";

import { useState, useRef, useCallback } from "react";
import Header from "@/components/Header";
import PromptInput from "@/components/PromptInput";
import AgentGrid from "@/components/AgentGrid";
import CampaignOutput from "@/components/CampaignOutput";
import MaterialGallery from "@/components/MaterialGallery";
import PlanReview from "@/components/PlanReview";
import RefinementChat from "@/components/RefinementChat";
import ExportPanel from "@/components/ExportPanel";
import KnowledgeBase from "@/components/KnowledgeBase";
import AgentNetwork from "@/components/AgentNetwork";
import VisualGallery from "@/components/VisualGallery";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type Phase = "idle" | "planning" | "plan_review" | "executing" | "complete";

export type AgentStatus = "idle" | "running" | "complete" | "error";

export interface AgentState {
  id: string;
  name: string;
  status: AgentStatus;
  currentStep?: string;
  completedSteps: string[];
  output?: string;
  streamingText?: string;
  toolEvents?: { tool: string; query: string }[];
  startedAt?: number;
  completedAt?: number;
}

export interface PlanData {
  campaign_name: string;
  big_idea: string;
  target_audience: { primary: string; secondary: string; location: string };
  objectives: string[];
  channels: { name: string; priority: string; reason: string }[];
  tone: string;
  key_messages: string[];
  timeline: string;
  budget_notes: string;
}

export interface Visual {
  type: string;
  url: string | null;
  format: "image" | "video";
  prompt: string;
  error?: string;
}

export interface CampaignData {
  brief: string;
  planRaw?: string;
  research?: string;
  trends?: string;
  content?: string;
  strategy?: string;
  report?: string;
  visuals?: Visual[];
}

/* ------------------------------------------------------------------ */
/*  Agent definitions                                                  */
/* ------------------------------------------------------------------ */

const INITIAL_AGENTS: AgentState[] = [
  { id: "orchestrator", name: "Orchestrator", status: "idle", completedSteps: [] },
  { id: "researcher", name: "Market Research", status: "idle", completedSteps: [] },
  { id: "trend_analyst", name: "Trend Analyst", status: "idle", completedSteps: [] },
  { id: "content_creator", name: "Content Creator", status: "idle", completedSteps: [] },
  { id: "strategist", name: "Strategist", status: "idle", completedSteps: [] },
  { id: "report_generator", name: "Report Builder", status: "idle", completedSteps: [] },
];

/* ------------------------------------------------------------------ */
/*  SSE stream consumer                                                */
/* ------------------------------------------------------------------ */

async function consumeStream(
  res: Response,
  handlers: {
    onAgentStart?: (agent: string, message: string) => void;
    onAgentThinking?: (agent: string, message: string) => void;
    onAgentStream?: (agent: string, text: string) => void;
    onAgentTool?: (agent: string, tool: string, query: string) => void;
    onAgentComplete?: (agent: string, field: string, output: string) => void;
    onAgentError?: (agent: string, message: string) => void;
    onPlanReady?: (plan: PlanData) => void;
    onPhaseComplete?: (phase: string) => void;
    onComplete?: () => void;
  },
  signal?: AbortSignal
) {
  const reader = res.body?.getReader();
  if (!reader) return;
  const dec = new TextDecoder();
  let buf = "";

  while (true) {
    if (signal?.aborted) break;
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() || "";

    for (const part of parts) {
      if (!part.startsWith("data: ")) continue;
      try {
        const d = JSON.parse(part.slice(6));
        switch (d.type) {
          case "agent_start": handlers.onAgentStart?.(d.agent, d.message); break;
          case "agent_thinking": handlers.onAgentThinking?.(d.agent, d.message); break;
          case "agent_stream": handlers.onAgentStream?.(d.agent, d.text); break;
          case "agent_tool": handlers.onAgentTool?.(d.agent, d.tool, d.query); break;
          case "agent_complete": handlers.onAgentComplete?.(d.agent, d.field, d.output); break;
          case "agent_error": handlers.onAgentError?.(d.agent, d.message); break;
          case "plan_ready": handlers.onPlanReady?.(d.plan); break;
          case "phase_complete": handlers.onPhaseComplete?.(d.phase); break;
          case "complete": handlers.onComplete?.(); break;
        }
      } catch { /* skip */ }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [agents, setAgents] = useState<AgentState[]>(INITIAL_AGENTS);
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [activeTab, setActiveTab] = useState("research");
  const [isRefining, setIsRefining] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [kbOpen, setKbOpen] = useState(false);
  const [customModelId, setCustomModelId] = useState<string | null>(null);
  const [generatingVisuals, setGeneratingVisuals] = useState(false);

  const updateAgent = useCallback((id: string, patch: Partial<AgentState>) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  const buildStreamHandlers = useCallback(() => ({
    onAgentStart: (agent: string, message: string) => {
      updateAgent(agent, {
        status: "running",
        currentStep: message,
        completedSteps: [],
        streamingText: "",
        toolEvents: [],
        startedAt: Date.now(),
      });
    },
    onAgentThinking: (agent: string, message: string) => {
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agent
            ? {
                ...a,
                completedSteps: a.currentStep ? [...a.completedSteps, a.currentStep] : a.completedSteps,
                currentStep: message,
              }
            : a
        )
      );
    },
    onAgentStream: (agent: string, text: string) => {
      updateAgent(agent, { streamingText: text });
    },
    onAgentTool: (agent: string, tool: string, query: string) => {
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agent
            ? { ...a, toolEvents: [...(a.toolEvents || []), { tool, query }] }
            : a
        )
      );
    },
    onAgentComplete: (agent: string, field: string, output: string) => {
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agent
            ? {
                ...a,
                status: "complete",
                completedSteps: a.currentStep ? [...a.completedSteps, a.currentStep] : a.completedSteps,
                currentStep: undefined,
                streamingText: undefined,
                output,
                completedAt: Date.now(),
              }
            : a
        )
      );
      if (field && field !== "orchestrator") {
        setCampaign((prev) => (prev ? { ...prev, [field]: output } : prev));
        setActiveTab(field);
      }
    },
    onAgentError: (agent: string, message: string) => {
      updateAgent(agent, { status: "error", currentStep: message });
    },
  }), [updateAgent]);

  /* ---------- Phase 1: Plan ---------- */

  const handleSubmit = useCallback(async (brief: string) => {
    setAgents(INITIAL_AGENTS.map((a) => ({ ...a })));
    setCampaign({ brief });
    setPlan(null);
    setPhase("planning");
    setActiveTab("research");
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "plan", brief, customModelId }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);

      await consumeStream(res, {
        ...buildStreamHandlers(),
        onPlanReady: (planData) => {
          setPlan(planData);
          setPhase("plan_review");
        },
      }, abortRef.current.signal);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error(err);
        setPhase("idle");
      }
    }
  }, [buildStreamHandlers]);

  /* ---------- Phase 2: Execute (after plan approval) ---------- */

  const handleApprove = useCallback(async (userNotes?: string) => {
    if (!campaign) return;
    setPhase("executing");
    abortRef.current = new AbortController();

    const planRaw = plan ? JSON.stringify(plan) : "";
    setCampaign((prev) => (prev ? { ...prev, planRaw } : prev));

    try {
      const res = await fetch("/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute",
          brief: campaign.brief,
          planRaw,
          userNotes,
          customModelId,
        }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);

      await consumeStream(res, {
        ...buildStreamHandlers(),
        onComplete: () => setPhase("complete"),
      }, abortRef.current.signal);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error(err);
        setPhase("complete");
      }
    }
  }, [campaign, plan, buildStreamHandlers]);

  /* ---------- Refine ---------- */

  const handleRefine = useCallback(async (agentId: string, feedback: string) => {
    if (!campaign) return;
    setIsRefining(true);
    updateAgent(agentId, {
      status: "running",
      currentStep: "Refining with your feedback",
      completedSteps: [],
      streamingText: "",
      toolEvents: [],
      startedAt: Date.now(),
      completedAt: undefined,
    });

    try {
      const res = await fetch("/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refine",
          agentId,
          feedback,
          brief: campaign.brief,
          planRaw: campaign.planRaw,
          research: campaign.research,
          trends: campaign.trends,
          content: campaign.content,
          strategy: campaign.strategy,
          currentOutput: campaign[agentIdToField(agentId) as keyof CampaignData],
          customModelId,
        }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);

      await consumeStream(res, {
        ...buildStreamHandlers(),
        onComplete: () => setIsRefining(false),
      });
    } catch (err: unknown) {
      if (err instanceof Error) console.error(err);
      setIsRefining(false);
    }
  }, [campaign, buildStreamHandlers, updateAgent]);

  /* ---------- Generate Visuals ---------- */

  const handleGenerateVisuals = useCallback(async () => {
    if (!campaign?.content || !campaign?.brief) return;
    
    setGeneratingVisuals(true);
    try {
      const res = await fetch("/api/visuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          content: campaign.content,
          campaignName: campaign.brief.split("\n")[0] || "Campaign",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate visuals");
      }

      const result = await res.json();
      setCampaign((prev) => (prev ? { ...prev, visuals: result.visuals || [] } : prev));
    } catch (err: unknown) {
      console.error("Visual generation error:", err);
    } finally {
      setGeneratingVisuals(false);
    }
  }, [campaign]);

  /* ---------- Stop ---------- */

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    if (phase === "planning") setPhase("idle");
    else if (phase === "executing") setPhase("complete");
  }, [phase]);

  /* ---------- Derived state ---------- */

  const isRunning = phase === "planning" || phase === "executing" || isRefining;
  const hasOutput = !!(campaign && (campaign.research || campaign.trends || campaign.content || campaign.strategy || campaign.report));
  const completedCount = agents.filter((a) => a.status === "complete").length;
  const showWorkspace = phase !== "idle";

  return (
    <div className="min-h-screen flex flex-col bg-surface-0">
      <Header phase={phase} onOpenKB={() => setKbOpen(true)} hasCustomModel={!!customModelId} />
      <KnowledgeBase
        open={kbOpen}
        onClose={() => setKbOpen(false)}
        onModelReady={setCustomModelId}
        activeModelId={customModelId}
      />

      <section className="border-b border-edge">
        <div className="max-w-5xl mx-auto px-5 py-8 sm:py-10">
          {phase === "idle" && (
            <div className="text-center mb-8 anim-fade-up">
              <h2 className="text-2xl sm:text-3xl font-semibold text-tx-0 tracking-tight">
                Build a complete campaign in minutes
              </h2>
              <p className="mt-2 text-sm text-tx-3 max-w-md mx-auto leading-relaxed">
                Six specialist agents research, analyze, create, and deliver a
                ready-to-execute campaign — with you in control at every step.
              </p>
            </div>
          )}
          <PromptInput onSubmit={handleSubmit} onStop={handleStop} isRunning={isRunning} phase={phase} />

          {phase === "idle" && (
            <div className="anim-fade-up" style={{ animationDelay: "0.15s" }}>
              <AgentNetwork />
            </div>
          )}
        </div>
      </section>

      {showWorkspace && (
        <section className="flex-1">
          <div className="max-w-5xl mx-auto px-5 py-6 space-y-5">

            {/* Progress bar */}
            {(phase === "planning" || phase === "executing") && (
              <div className="anim-fade-up">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium text-tx-3 uppercase tracking-widest">
                    {phase === "planning" ? "Planning" : "Executing"}
                  </span>
                  <span className="text-[11px] text-tx-4 tabular-nums font-mono">
                    {completedCount} / {agents.length}
                  </span>
                </div>
                <div className="h-[3px] rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand to-ok transition-all duration-1000 ease-out"
                    style={{ width: `${(completedCount / agents.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Agent pipeline */}
            <AgentGrid agents={agents} phase={phase} />

            {/* Plan review gate */}
            {phase === "plan_review" && plan && (
              <PlanReview plan={plan} onApprove={handleApprove} />
            )}

            {/* Output tabs */}
            {hasOutput && (
              <CampaignOutput
                campaign={campaign}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onRefine={phase === "complete" ? handleRefine : undefined}
                isRefining={isRefining}
              />
            )}

            {/* Material gallery */}
            {campaign?.content && <MaterialGallery content={campaign.content} />}

            {/* Visual content gallery */}
            {phase === "complete" && campaign?.content && (
              <VisualGallery
                visuals={campaign.visuals || []}
                isGenerating={generatingVisuals}
                onGenerate={handleGenerateVisuals}
              />
            )}

            {/* Post-completion: refinement + export */}
            {phase === "complete" && (
              <>
                <RefinementChat
                  onRefine={handleRefine}
                  isRefining={isRefining}
                  availableAgents={agents.filter((a) => a.status === "complete" && a.id !== "orchestrator")}
                />
                <ExportPanel campaign={campaign} plan={plan} />
              </>
            )}
          </div>
        </section>
      )}

      <footer className="mt-auto py-5 text-center text-[11px] text-tx-4">
        Bottengram &middot; Multi-Agent AI Engine &middot; Powered by Mistral &amp; GetAiReady
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Utils                                                              */
/* ------------------------------------------------------------------ */

function agentIdToField(agentId: string): string {
  const map: Record<string, string> = {
    researcher: "research",
    trend_analyst: "trends",
    content_creator: "content",
    strategist: "strategy",
    report_generator: "report",
  };
  return map[agentId] || agentId;
}
