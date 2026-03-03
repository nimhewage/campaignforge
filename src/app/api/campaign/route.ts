import { NextRequest } from "next/server";

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

const NO_EMOJI = `\nCRITICAL: Never use emojis, emoticons, or unicode symbols. Use only ASCII text and markdown formatting.`;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function sse(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function stripEmojis(text: string): string {
  return text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/```(?:markdown|json|html|text|csv)?\n?/g, "")
    .replace(/```\n?$/gm, "")
    .replace(/^```$/gm, "");
}

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
}

/* ------------------------------------------------------------------ */
/*  Mistral streaming call with tool awareness                         */
/* ------------------------------------------------------------------ */

async function callMistral(opts: {
  system: string;
  user: string;
  model: string;
  agentId: string;
  ctrl: ReadableStreamDefaultController;
  enc: TextEncoder;
  tools?: Record<string, unknown>[];
  jsonMode?: boolean;
  customModelId?: string;
}): Promise<string> {
  const { system, user, model, agentId, ctrl, enc, tools, jsonMode, customModelId } = opts;

  const effectiveModel = customModelId || model;

  const body: Record<string, unknown> = {
    model: effectiveModel,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    stream: true,
    temperature: 0.7,
    max_tokens: 4096,
  };

  if (tools?.length) body.tools = tools;
  if (jsonMode) body.response_format = { type: "json_object" };

  let res = await fetch(MISTRAL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_API_KEY}` },
    body: JSON.stringify(body),
  });

  // Fallback: if tools caused an error, retry without them
  if (!res.ok && tools?.length) {
    delete body.tools;
    res = await fetch(MISTRAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_API_KEY}` },
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Mistral ${res.status}: ${t}`);
  }
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let lastSent = 0;
  let lastHeader = "";
  let sseBuffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    sseBuffer += decoder.decode(value, { stream: true });
    const lines = sseBuffer.split("\n");
    sseBuffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ") || trimmed === "data: [DONE]") continue;
      try {
        const json = JSON.parse(trimmed.slice(6));
        const choice = json.choices?.[0];

        // Detect tool calls (if web_search is supported)
        const toolCalls = choice?.delta?.tool_calls;
        if (toolCalls) {
          for (const tc of toolCalls) {
            if (tc.function?.name) {
              let query = tc.function?.arguments || "";
              try {
                const parsed = JSON.parse(query);
                query = parsed.query || parsed.q || query;
              } catch { /* raw string */ }
              try {
                ctrl.enqueue(enc.encode(sse({ type: "agent_tool", agent: agentId, tool: tc.function.name, query })));
              } catch { /* closed */ }
            }
          }
          continue;
        }

        const delta = choice?.delta?.content;
        if (delta) {
          full += delta;

          // Real progress: detect markdown section headers
          const recentChunk = full.slice(Math.max(0, full.length - 200));
          const headerMatch = recentChunk.match(/\n##\s+([^\n]+)\n?$/);
          if (headerMatch && headerMatch[1] !== lastHeader) {
            lastHeader = headerMatch[1];
            try {
              ctrl.enqueue(enc.encode(sse({ type: "agent_thinking", agent: agentId, message: `Writing: ${headerMatch[1]}` })));
            } catch { /* closed */ }
          }

          if (full.length - lastSent >= 80) {
            try {
              ctrl.enqueue(enc.encode(sse({ type: "agent_stream", agent: agentId, text: full.slice(-500) })));
            } catch { /* closed */ }
            lastSent = full.length;
          }
        }
      } catch { /* skip */ }
    }
  }

  return stripEmojis(full);
}

/* ------------------------------------------------------------------ */
/*  Agent definitions                                                  */
/* ------------------------------------------------------------------ */

const PLAN_SYSTEM = `You are a Campaign Orchestrator. Analyze the brief and produce a JSON plan.
Return a JSON object with EXACTLY this structure (no extra keys):
{
  "campaign_name": "short memorable campaign name",
  "big_idea": "one-sentence creative concept that captures the campaign essence",
  "target_audience": {
    "primary": "primary audience description with demographics",
    "secondary": "secondary audience if applicable",
    "location": "geographic focus"
  },
  "objectives": ["measurable objective 1", "measurable objective 2", "measurable objective 3"],
  "channels": [
    {"name": "ChannelName", "priority": "primary", "reason": "why this channel fits"}
  ],
  "tone": "brand voice and tone description",
  "key_messages": ["core message 1", "core message 2", "core message 3"],
  "timeline": "campaign duration estimate",
  "budget_notes": "budget allocation guidance based on brief"
}
Return ONLY valid JSON. No markdown wrapping, no code fences.`;

interface AgentDef {
  model: string;
  field: string;
  system: string;
  tools?: Record<string, unknown>[];
}

const EXEC_AGENTS: Record<string, AgentDef> = {
  researcher: {
    model: "mistral-large-latest",
    field: "research",
    tools: [{ type: "web_search", web_search: {} }],
    system: `You are a Market Research Agent. Search the web for REAL, CURRENT data about the market described.
If web search is available, use it to find actual market data, competitor information, and audience insights.
## Market Overview
Market size, growth trajectory, key dynamics. Cite real sources when possible.
## Target Audience Analysis
Demographics, psychographics, pain points, media habits, buying triggers.
## Competitive Landscape
Top 3-5 competitors with their positioning, messaging, strengths, and gaps.
## Key Insights
5 specific, actionable insights the campaign must leverage. Each backed by data.
${NO_EMOJI}`,
  },
  trend_analyst: {
    model: "mistral-large-latest",
    field: "trends",
    tools: [{ type: "web_search", web_search: {} }],
    system: `You are a Trend Analyst. Search the web for REAL current trends relevant to the campaign.
If web search is available, verify trends with actual data.
## Current Industry Trends
Top 5 relevant trends with platform breakdown.
## Content Formats Performing Now
Video lengths, post formats, UGC patterns, interactive content with engagement data.
## Hashtag and Keyword Strategy
10 hashtags (mix broad + niche), 5 SEO keywords, trending search terms.
## Cultural Moments & Timing
Upcoming events, seasonal hooks, cultural moments to leverage with dates.
${NO_EMOJI}`,
  },
  content_creator: {
    model: "mistral-large-latest",
    field: "content",
    system: `You are a Creative Content Agent. Produce ready-to-use campaign content.
Use the research data, trend insights, and approved plan to create highly targeted content.
Structure with these exact headers:
## Campaign Headlines
5 options: bold, emotional, data-driven, question, action-oriented. Number them 1-5.
## Instagram Posts
2 complete posts with full caption, call-to-action, 5 hashtags. Separate with ---.
## TikTok Concepts
2 video concepts with hook (first 3 seconds), concept, script outline, sound suggestion.
## LinkedIn Posts
2 professional thought-leadership posts with CTAs.
## Twitter Posts
4 punchy tweets under 280 chars.
## Email Campaign
3 subject lines. Full launch email with opening hook, body, CTA, PS line.
## Blog Outline
SEO title, meta description (under 160 chars), 5+ sections with talking points.
## Ad Copy
3 variants: Headline / Description / CTA
${NO_EMOJI}`,
  },
  strategist: {
    model: "mistral-large-latest",
    field: "strategy",
    system: `You are a Campaign Strategy Agent. Deliver a comprehensive, executable strategy.
Incorporate the market research and trend data into a data-informed strategy.
## Campaign Concept
2-3 name options, big idea, unique value proposition, positioning statement.
## Channel Strategy
For each channel: rationale, content type, frequency, estimated reach, budget %.
## Campaign Timeline
Phase 1: Pre-Launch (Week 1-2), Phase 2: Launch (Week 3-4), Phase 3: Sustain (Week 5-8), Phase 4: Optimize (Week 9-12).
## Budget Breakdown
Table: Channel | Allocation % | Spend | Expected ROI
## KPIs
3-5 primary KPIs with targets. Reporting cadence.
## Risk Assessment
Top 3 risks with likelihood, impact, mitigation.
${NO_EMOJI}`,
  },
  report_generator: {
    model: "mistral-large-latest",
    field: "report",
    system: `You are a Report Generator. Produce a CMO-ready executive campaign brief.
Synthesize ALL agent outputs into a cohesive, actionable document.
## Executive Summary
3-4 powerful sentences on the opportunity and approach.
## Campaign at a Glance
Markdown table: Target Audience | Core Message | Channels | Timeline | Budget | Expected ROI
## Top 5 Immediate Actions
Numbered, concrete, assignable actions with owner and deadline placeholders.
## Campaign Scorecard
Rate 1-10 with justification: Market Opportunity, Content Readiness, Channel Fit, Budget Efficiency, Overall Confidence.
## Implementation Checklist
Step-by-step with owners, deadlines, dependencies.
## Why This Campaign Will Succeed
3 evidence-backed reasons from research and trends.
${NO_EMOJI}`,
  },
};

/* ------------------------------------------------------------------ */
/*  Run a single agent                                                 */
/* ------------------------------------------------------------------ */

async function runAgent(
  agentId: string,
  userMsg: string,
  ctrl: ReadableStreamDefaultController,
  enc: TextEncoder,
  customModelId?: string
): Promise<string | null> {
  const agent = EXEC_AGENTS[agentId];
  if (!agent) return null;

  try {
    ctrl.enqueue(enc.encode(sse({ type: "agent_start", agent: agentId, message: `Initializing ${agentId.replace(/_/g, " ")}` })));
  } catch { return null; }

  try {
    const output = await callMistral({
      system: agent.system,
      user: userMsg,
      model: agent.model,
      agentId,
      ctrl,
      enc,
      tools: agent.tools,
      customModelId,
    });

    try {
      ctrl.enqueue(enc.encode(sse({ type: "agent_complete", agent: agentId, field: agent.field, output })));
    } catch { /* closed */ }

    return output;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    try {
      ctrl.enqueue(enc.encode(sse({ type: "agent_error", agent: agentId, message: msg })));
    } catch { /* closed */ }
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Action: Plan (Orchestrator only)                                   */
/* ------------------------------------------------------------------ */

async function handlePlan(brief: string, customModelId?: string): Promise<Response> {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      try {
        ctrl.enqueue(enc.encode(sse({ type: "agent_start", agent: "orchestrator", message: "Analyzing campaign brief" })));

        const output = await callMistral({
          system: PLAN_SYSTEM,
          user: `Campaign Brief:\n${brief}`,
          model: "mistral-small-latest",
          agentId: "orchestrator",
          ctrl,
          enc,
          jsonMode: true,
          customModelId,
        });

        let plan = null;
        try {
          plan = JSON.parse(output);
        } catch {
          // If JSON parse fails, try to extract JSON from the text
          const jsonMatch = output.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try { plan = JSON.parse(jsonMatch[0]); } catch { /* give up */ }
          }
        }

        if (!plan) {
          plan = {
            campaign_name: "Campaign Plan",
            big_idea: "See details below",
            target_audience: { primary: "As described in brief", secondary: "", location: "" },
            objectives: ["Increase brand awareness", "Drive conversions", "Build community"],
            channels: [{ name: "Social Media", priority: "primary", reason: "Broad reach" }],
            tone: "Professional and engaging",
            key_messages: ["Key message from brief"],
            timeline: "12 weeks",
            budget_notes: "Based on brief parameters",
            _raw: output,
          };
        }

        try {
          ctrl.enqueue(enc.encode(sse({ type: "plan_ready", plan })));
          ctrl.enqueue(enc.encode(sse({ type: "agent_complete", agent: "orchestrator", field: "orchestrator", output })));
        } catch { /* closed */ }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        try { ctrl.enqueue(enc.encode(sse({ type: "agent_error", agent: "orchestrator", message: msg }))); } catch { /* */ }
      }
      try { ctrl.close(); } catch { /* */ }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

/* ------------------------------------------------------------------ */
/*  Action: Execute (Research → Create → Report with auto-phasing)     */
/* ------------------------------------------------------------------ */

async function handleExecute(
  brief: string,
  planRaw: string,
  userNotes?: string,
  customModelId?: string
): Promise<Response> {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const outputs: Record<string, string> = {};

      let baseContext = `Campaign Brief:\n${brief}\n\nApproved Plan:\n${planRaw}`;
      if (userNotes) baseContext += `\n\nUser Direction:\n${userNotes}`;

      // ── Phase: Research + Trends (parallel) ──
      try { ctrl.enqueue(enc.encode(sse({ type: "phase_start", phase: "research" }))); } catch { /* */ }

      const [resOut, trendOut] = await Promise.all([
        runAgent("researcher", baseContext, ctrl, enc, customModelId),
        (async () => {
          await wait(1500);
          return runAgent("trend_analyst", baseContext, ctrl, enc, customModelId);
        })(),
      ]);
      if (resOut) outputs.research = resOut;
      if (trendOut) outputs.trends = trendOut;

      try { ctrl.enqueue(enc.encode(sse({ type: "phase_complete", phase: "research" }))); } catch { /* */ }
      await wait(600);

      // ── Phase: Content + Strategy (parallel) ──
      try { ctrl.enqueue(enc.encode(sse({ type: "phase_start", phase: "create" }))); } catch { /* */ }

      let createContext = baseContext;
      if (outputs.research) createContext += `\n\nMarket Research:\n${outputs.research.slice(0, 2500)}`;
      if (outputs.trends) createContext += `\n\nTrend Insights:\n${outputs.trends.slice(0, 2000)}`;

      const [contentOut, stratOut] = await Promise.all([
        runAgent("content_creator", createContext, ctrl, enc, customModelId),
        (async () => {
          await wait(1500);
          return runAgent("strategist", createContext, ctrl, enc, customModelId);
        })(),
      ]);
      if (contentOut) outputs.content = contentOut;
      if (stratOut) outputs.strategy = stratOut;

      try { ctrl.enqueue(enc.encode(sse({ type: "phase_complete", phase: "create" }))); } catch { /* */ }
      await wait(600);

      // ── Phase: Report ──
      try { ctrl.enqueue(enc.encode(sse({ type: "phase_start", phase: "report" }))); } catch { /* */ }

      let reportContext = createContext;
      if (outputs.content) reportContext += `\n\nCreative Content:\n${outputs.content.slice(0, 1500)}`;
      if (outputs.strategy) reportContext += `\n\nStrategy:\n${outputs.strategy.slice(0, 1500)}`;

      await runAgent("report_generator", reportContext, ctrl, enc, customModelId);

      try { ctrl.enqueue(enc.encode(sse({ type: "phase_complete", phase: "report" }))); } catch { /* */ }
      try { ctrl.enqueue(enc.encode(sse({ type: "complete" }))); } catch { /* */ }
      try { ctrl.close(); } catch { /* */ }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

/* ------------------------------------------------------------------ */
/*  Action: Refine (re-run a single agent with feedback)               */
/* ------------------------------------------------------------------ */

async function handleRefine(body: {
  agentId: string;
  feedback: string;
  brief: string;
  planRaw?: string;
  research?: string;
  trends?: string;
  content?: string;
  strategy?: string;
  currentOutput?: string;
  customModelId?: string;
}): Promise<Response> {
  const { agentId, feedback, brief, planRaw, research, trends, content, strategy, currentOutput, customModelId } = body;
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(ctrl) {
      let context = `Campaign Brief:\n${brief}`;
      if (planRaw) context += `\n\nPlan:\n${planRaw}`;
      if (research) context += `\n\nMarket Research:\n${research.slice(0, 2000)}`;
      if (trends) context += `\n\nTrend Insights:\n${trends.slice(0, 1500)}`;
      if (content && agentId !== "content_creator") context += `\n\nContent:\n${content.slice(0, 1000)}`;
      if (strategy && agentId !== "strategist") context += `\n\nStrategy:\n${strategy.slice(0, 1000)}`;

      if (currentOutput) {
        context += `\n\nYour previous output:\n${currentOutput.slice(0, 2000)}`;
      }
      context += `\n\nUSER REFINEMENT REQUEST:\n${feedback}\n\nPlease regenerate your output incorporating this feedback. Keep the same structure but improve based on the user's request.`;

      await runAgent(agentId, context, ctrl, enc, customModelId);
      try { ctrl.enqueue(enc.encode(sse({ type: "complete" }))); } catch { /* */ }
      try { ctrl.close(); } catch { /* */ }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!MISTRAL_API_KEY) {
    return Response.json({ error: "API key not configured" }, { status: 500 });
  }

  const action = body.action as string;

  switch (action) {
    case "plan": {
      const { brief, customModelId } = body;
      if (!brief || typeof brief !== "string") return Response.json({ error: "Brief required" }, { status: 400 });
      return handlePlan(brief, customModelId);
    }

    case "execute": {
      const { brief, planRaw, userNotes, customModelId } = body;
      if (!brief) return Response.json({ error: "Brief required" }, { status: 400 });
      return handleExecute(brief, planRaw || "", userNotes, customModelId);
    }

    case "refine": {
      const { agentId, feedback } = body;
      if (!agentId || !feedback) return Response.json({ error: "agentId and feedback required" }, { status: 400 });
      return handleRefine(body);
    }

    default:
      return Response.json({ error: "Invalid action. Use: plan, execute, refine" }, { status: 400 });
  }
}
