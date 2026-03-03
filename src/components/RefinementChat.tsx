"use client";

import { useState } from "react";
import type { AgentState } from "@/app/page";
import { Send, Loader2, Wand2 } from "lucide-react";

interface Props {
  onRefine: (agentId: string, feedback: string) => void;
  isRefining: boolean;
  availableAgents: AgentState[];
}

const QUICK_ACTIONS = [
  { label: "Sharpen headlines", agent: "content_creator", prompt: "Generate stronger, more compelling headlines that grab attention instantly" },
  { label: "Make it edgier", agent: "content_creator", prompt: "Rewrite all content with a bolder, more provocative tone while keeping it professional" },
  { label: "Simplify email copy", agent: "content_creator", prompt: "Simplify the email campaign for clarity and higher conversion. Shorter sentences, stronger CTA" },
  { label: "Tighten budget", agent: "strategist", prompt: "Optimize budget allocation for maximum ROI. Cut low-impact channels and reallocate" },
  { label: "Add more channels", agent: "strategist", prompt: "Expand the channel strategy to include Reddit, YouTube Shorts, and podcast advertising" },
  { label: "Deeper research", agent: "researcher", prompt: "Go deeper on competitor analysis. Include pricing strategies, market share estimates, and SWOT analysis" },
  { label: "Fresher trends", agent: "trend_analyst", prompt: "Focus on the most recent viral content in the last 30 days. What formats are breaking through right now?" },
  { label: "Stronger report", agent: "report_generator", prompt: "Make the executive summary more compelling. Add urgency and clearer ROI projections" },
];

const AGENT_LABELS: Record<string, string> = {
  researcher: "Market Research",
  trend_analyst: "Trend Analyst",
  content_creator: "Content Creator",
  strategist: "Strategist",
  report_generator: "Report Builder",
};

export default function RefinementChat({ onRefine, isRefining, availableAgents }: Props) {
  const [feedback, setFeedback] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");

  const availableIds = new Set(availableAgents.map((a) => a.id));
  const filteredActions = QUICK_ACTIONS.filter((a) => availableIds.has(a.agent));

  const handleSend = () => {
    if (!feedback.trim() || !selectedAgent || isRefining) return;
    onRefine(selectedAgent, feedback.trim());
    setFeedback("");
  };

  const handleQuickAction = (action: typeof QUICK_ACTIONS[number]) => {
    if (isRefining) return;
    onRefine(action.agent, action.prompt);
  };

  return (
    <div className="glass-card overflow-hidden anim-fade-up">
      <div className="p-4 border-b border-edge bg-gradient-to-r from-violet-500/[0.03] to-transparent">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-brand" />
          <h3 className="text-[12px] font-semibold text-tx-1 uppercase tracking-widest">
            Refine Your Campaign
          </h3>
          {isRefining && (
            <span className="flex items-center gap-1 text-[10px] text-brand ml-auto">
              <Loader2 className="w-3 h-3 animate-spin" /> Refining...
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Quick actions */}
        <div className="flex flex-wrap gap-1.5">
          {filteredActions.map((action) => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action)}
              disabled={isRefining}
              className="text-[11px] px-3 py-1.5 rounded-full border border-edge text-tx-3 bg-surface-2/40 hover:bg-surface-3 hover:text-tx-1 hover:border-edge-b transition-all disabled:opacity-30 cursor-pointer"
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Custom refinement */}
        <div className="flex gap-2">
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="text-[12px] bg-surface-2/60 border border-edge rounded-lg px-3 py-2 text-tx-2 focus:outline-none focus:border-brand/30 min-w-[140px] cursor-pointer appearance-none"
          >
            <option value="">Select agent...</option>
            {availableAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {AGENT_LABELS[a.id] || a.name}
              </option>
            ))}
          </select>
          <input
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Describe what you'd like to change..."
            disabled={isRefining}
            className="flex-1 text-[13px] bg-surface-2/40 border border-edge rounded-lg px-3 py-2 text-tx-1 placeholder:text-tx-4 focus:outline-none focus:border-brand/30 disabled:opacity-40 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!feedback.trim() || !selectedAgent || isRefining}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand/10 text-brand hover:bg-brand/20 transition-colors disabled:opacity-20 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
