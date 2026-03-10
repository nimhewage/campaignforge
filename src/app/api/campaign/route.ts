import { NextRequest } from "next/server";
import { getTrendsData } from "@/lib/trends";
import { checkRateLimit } from "@/lib/rateLimit";
import { stripMd } from "@/lib/stripMd";

/* Vercel streaming timeout — requires Pro plan for 300s */
export const maxDuration = 300;

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const NO_EMOJI = `\nCRITICAL: Never use emojis, emoticons, or unicode symbols. Use only ASCII text and markdown formatting.`;
const NO_MARKDOWN_IN_HEADERS = `\nCRITICAL: Section headers (## headings) must use plain text only — no bold (**text**), no italic (*text*), no backticks, no special formatting inside headings.`;

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

/**
 * Smart extraction: preserves ## section structure while staying under maxChars.
 * Much better than a blind .slice() that can cut mid-sentence or drop entire sections.
 */
function smartExtract(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text || "";

  const sections = text.split(/(?=^## )/m).filter(Boolean);
  const result: string[] = [];
  let total = 0;

  for (const section of sections) {
    const lines = section.split("\n");
    const header = lines[0] || "";
    const body = lines.slice(1).join("\n").trim();
    // Keep header + first 600 chars of body to preserve key insights
    const truncBody = body.length > 600 ? body.slice(0, 600) + "..." : body;
    const chunk = `${header}\n${truncBody}\n\n`;

    if (total + chunk.length > maxChars) {
      // Try to fit the header at least
      if (total + header.length + 30 < maxChars) {
        result.push(`${header}\n[Section truncated for context]\n\n`);
      }
      break;
    }
    result.push(chunk);
    total += chunk.length;
  }

  return result.length > 0 ? result.join("") : text.slice(0, maxChars);
}

/* ------------------------------------------------------------------ */
/*  Mistral streaming                                                  */
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

  // Fallback: retry without tools if they caused an error
  if (!res.ok && tools?.length) {
    delete body.tools;
    res = await fetch(MISTRAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_API_KEY}` },
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) throw new Error(`Mistral ${res.status}: ${await res.text()}`);
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

        const toolCalls = choice?.delta?.tool_calls;
        if (toolCalls) {
          for (const tc of toolCalls) {
            if (tc.function?.name) {
              let query = tc.function?.arguments || "";
              try { const p = JSON.parse(query); query = p.query || p.q || query; } catch { /* raw */ }
              try { ctrl.enqueue(enc.encode(sse({ type: "agent_tool", agent: agentId, tool: tc.function.name, query }))); } catch { /* closed */ }
            }
          }
          continue;
        }

        const delta = choice?.delta?.content;
        if (delta) {
          full += delta;
          const recent = full.slice(Math.max(0, full.length - 200));
          const headerMatch = recent.match(/\n##\s+([^\n]+)\n?$/);
          if (headerMatch && headerMatch[1] !== lastHeader) {
            lastHeader = headerMatch[1];
            const cleanHeader = stripMd(headerMatch[1]);
            try { ctrl.enqueue(enc.encode(sse({ type: "agent_thinking", agent: agentId, message: `Writing: ${cleanHeader}` }))); } catch { /* closed */ }
          }
          if (full.length - lastSent >= 80) {
            try { ctrl.enqueue(enc.encode(sse({ type: "agent_stream", agent: agentId, text: full.slice(-500) }))); } catch { /* closed */ }
            lastSent = full.length;
          }
        }
      } catch { /* skip */ }
    }
  }

  return stripEmojis(full);
}

/* ------------------------------------------------------------------ */
/*  Claude (Anthropic) streaming                                       */
/* ------------------------------------------------------------------ */

async function callClaude(opts: {
  system: string;
  user: string;
  agentId: string;
  ctrl: ReadableStreamDefaultController;
  enc: TextEncoder;
}): Promise<string> {
  const { system, user, agentId, ctrl, enc } = opts;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
      stream: true,
    }),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  if (!res.body) throw new Error("No Anthropic response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let lastSent = 0;
  let lastHeader = "";
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
          const delta: string = json.delta.text || "";
          if (delta) {
            full += delta;
            const recent = full.slice(Math.max(0, full.length - 200));
            const headerMatch = recent.match(/\n##\s+([^\n]+)\n?$/);
            if (headerMatch && headerMatch[1] !== lastHeader) {
              lastHeader = headerMatch[1];
              const cleanHeader = stripMd(headerMatch[1]);
              try { ctrl.enqueue(enc.encode(sse({ type: "agent_thinking", agent: agentId, message: `Writing: ${cleanHeader}` }))); } catch { /* closed */ }
            }
            if (full.length - lastSent >= 80) {
              try { ctrl.enqueue(enc.encode(sse({ type: "agent_stream", agent: agentId, text: full.slice(-500) }))); } catch { /* closed */ }
              lastSent = full.length;
            }
          }
        }
      } catch { /* skip */ }
    }
  }

  return stripEmojis(full);
}

/* ------------------------------------------------------------------ */
/*  OpenAI streaming                                                   */
/* ------------------------------------------------------------------ */

async function callOpenAI(opts: {
  system: string;
  user: string;
  agentId: string;
  ctrl: ReadableStreamDefaultController;
  enc: TextEncoder;
}): Promise<string> {
  const { system, user, agentId, ctrl, enc } = opts;

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      stream: true,
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  if (!res.body) throw new Error("No OpenAI response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let lastSent = 0;
  let lastHeader = "";
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
      try {
        const json = JSON.parse(line.slice(6));
        const delta: string = json.choices?.[0]?.delta?.content || "";
        if (delta) {
          full += delta;
          const recent = full.slice(Math.max(0, full.length - 200));
          const headerMatch = recent.match(/\n##\s+([^\n]+)\n?$/);
          if (headerMatch && headerMatch[1] !== lastHeader) {
            lastHeader = headerMatch[1];
            const cleanHeader = stripMd(headerMatch[1]);
            try { ctrl.enqueue(enc.encode(sse({ type: "agent_thinking", agent: agentId, message: `Writing: ${cleanHeader}` }))); } catch { /* closed */ }
          }
          if (full.length - lastSent >= 80) {
            try { ctrl.enqueue(enc.encode(sse({ type: "agent_stream", agent: agentId, text: full.slice(-500) }))); } catch { /* closed */ }
            lastSent = full.length;
          }
        }
      } catch { /* skip */ }
    }
  }

  return stripEmojis(full);
}

/* ------------------------------------------------------------------ */
/*  Multi-LLM router                                                   */
/*  researcher/report → Claude (if key present), else Mistral          */
/*  content_creator → OpenAI GPT-4o-mini (if key present), else Mistral*/
/*  Everything else → Mistral                                          */
/* ------------------------------------------------------------------ */

const LLM_ROUTING: Record<string, "claude" | "openai" | "mistral"> = {
  researcher: "claude",
  trend_analyst: "mistral",
  content_creator: "openai",
  strategist: "mistral",
  report_generator: "claude",
};

async function callLLM(opts: {
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
  // Custom fine-tuned model always uses Mistral
  if (opts.customModelId) {
    return callMistral(opts);
  }

  // JSON mode must use Mistral (only provider supporting response_format)
  if (opts.jsonMode) {
    return callMistral(opts);
  }

  const preferred = LLM_ROUTING[opts.agentId] || "mistral";

  if (preferred === "claude" && ANTHROPIC_API_KEY) {
    try {
      return await callClaude(opts);
    } catch (err) {
      console.warn(`Claude failed for ${opts.agentId}, falling back to Mistral:`, err);
    }
  }

  if (preferred === "openai" && OPENAI_API_KEY) {
    try {
      return await callOpenAI(opts);
    } catch (err) {
      console.warn(`OpenAI failed for ${opts.agentId}, falling back to Mistral:`, err);
    }
  }

  return callMistral(opts);
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
  jsonMode?: boolean;
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
${NO_EMOJI}${NO_MARKDOWN_IN_HEADERS}`,
  },
  trend_analyst: {
    model: "mistral-large-latest",
    field: "trends",
    tools: [{ type: "web_search", web_search: {} }],
    system: `You are a Trend Analyst with access to REAL-TIME Google Trends data and live SEO insights.
Analyze the provided trends data and web search results to deliver actionable intelligence.

CRITICAL: All data must be REAL and CITED with sources. Format your analysis with these exact headers:

## Real-Time Trend Analysis
Present the actual Google Trends data with:
- Search interest over time (with percentage changes)
- Geographic breakdown showing top regions
- Rising queries with growth percentages
- Related search terms with search volume indicators
**Source: [Cite the data source provided]**

## Current Industry Trends
Top 5 relevant trends with:
- Platform-specific performance data (Instagram, TikTok, LinkedIn engagement rates)
- Actual statistics and percentages from web search
- Competitive intelligence from similar campaigns
**Source: [Cite web search results]**

## Content Formats Performing Now
Based on current data:
- Video lengths with engagement metrics (e.g., "15-30 sec videos: 2.3x higher engagement")
- Post formats with performance data
- UGC patterns with actual examples
- Interactive content ROI
**Source: [Cite sources]**

## Keyword & SEO Strategy
From Google Trends data:
- 10 trending hashtags with search volume/growth
- 5 high-value SEO keywords with search trends
- Rising search terms with "Breakout" or percentage growth
- Long-tail opportunities
**Source: Google Trends (via SerpApi)**

## Cultural Moments & Timing
Upcoming events with specific dates:
- Seasonal hooks (with dates)
- Industry events
- Cultural moments to leverage
**Source: [Cite sources]**

## Competitive Intelligence
Real competitor data:
- Top 3 competitors with actual metrics
- Their content strategies with examples
- Performance gaps to exploit
**Source: [Cite sources]**

REMEMBER: Every section must include **Source:** citations. Use actual numbers, percentages, and dates from the provided data.
${NO_EMOJI}${NO_MARKDOWN_IN_HEADERS}`,
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
${NO_EMOJI}${NO_MARKDOWN_IN_HEADERS}`,
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
${NO_EMOJI}${NO_MARKDOWN_IN_HEADERS}`,
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
${NO_EMOJI}${NO_MARKDOWN_IN_HEADERS}`,
  },

  persona_builder: {
    model: "mistral-large-latest",
    field: "personas",
    jsonMode: true,
    system: `You are a Customer Intelligence Agent. Generate exactly 2-3 vivid audience personas based on the campaign brief and market research.
Return ONLY a valid JSON array with this exact structure (no markdown, no code fences, no extra text):
[
  {
    "name": "Fictional full name",
    "age": "age range e.g. 28-34",
    "job": "Job title",
    "location": "City, Country",
    "income": "e.g. $75,000-$110,000",
    "quote": "A real thing this person would say about this problem (max 15 words)",
    "avatar": "2-letter initials",
    "painPoints": ["pain point 1", "pain point 2", "pain point 3"],
    "motivations": ["motivation 1", "motivation 2", "motivation 3"],
    "mediaHabits": ["e.g. Instagram 2h/day", "LinkedIn 45min", "Podcasts commuting"],
    "buyingTriggers": ["trigger 1", "trigger 2"],
    "objections": ["objection 1", "objection 2"]
  }
]
Return ONLY the JSON array. No additional text.`,
  },

  email_strategist: {
    model: "mistral-large-latest",
    field: "emailSequence",
    system: `You are an Email Marketing Strategist. Create a complete 5-email drip campaign automation sequence.
For each email provide subject line, A/B variant, preview text, timing, opening hook, body, CTA, and PS line.
Structure with these exact headers:
## Email 1: Welcome & First Impression
## Email 2: Education & Value Building
## Email 3: Social Proof & Case Studies
## Email 4: The Offer
## Email 5: Re-engagement & Last Chance
For each email format as:
**Subject Line (A):** ...
**Subject Line (B — A/B test):** ...
**Preview text:** ...
**Send timing:** ...
**Opening hook:** ...
**Body:** [3-4 short paragraphs]
**CTA:** [button text] -> [destination]
**PS:** ...
${NO_EMOJI}${NO_MARKDOWN_IN_HEADERS}`,
  },

  landing_page: {
    model: "mistral-large-latest",
    field: "landingPage",
    system: `You are a Conversion Rate Optimization (CRO) Specialist. Create a complete, detailed landing page brief optimized for conversion.
Structure with these exact headers:
## Hero Section
Primary headline, subheadline, hero CTA button text, secondary CTA, hero visual description.
## Value Propositions
3 value props with: icon type | Headline | One-sentence explanation each.
## Social Proof Section
3 detailed testimonials (realistic, specific, with name/title/company), 3 trust badges, stats bar with 3 key numbers.
## How It Works
3-step process with title and description per step.
## FAQ
5 objection-handling questions with detailed answers.
## Final CTA Section
Urgency statement, CTA headline, CTA button text, risk-reversal/guarantee statement.
## SEO Metadata
Page title (under 60 chars), meta description (under 155 chars), H1, 5 target keywords.
${NO_EMOJI}${NO_MARKDOWN_IN_HEADERS}`,
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
    const output = await callLLM({
      system: agent.system,
      user: userMsg,
      model: agent.model,
      agentId,
      ctrl,
      enc,
      tools: agent.tools,
      jsonMode: agent.jsonMode,
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
/*  Action: Plan                                                       */
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
          const m = output.match(/\{[\s\S]*\}/);
          if (m) { try { plan = JSON.parse(m[0]); } catch { /* give up */ } }
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
/*  Action: Execute                                                    */
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

      // Phase: Research + Trends (parallel)
      try { ctrl.enqueue(enc.encode(sse({ type: "phase_start", phase: "research" }))); } catch { /* */ }

      // Call trends DIRECTLY — no HTTP self-call
      let trendsData = null;
      try {
        trendsData = await getTrendsData(brief);
      } catch (err) {
        console.error("Failed to fetch trends data:", err);
      }

      // Build trends context string
      let trendsContext = baseContext;
      if (trendsData) {
        const simLabel = trendsData.isSimulated ? " [SIMULATED — for reference only]" : "";
        trendsContext += `\n\n=== REAL-TIME GOOGLE TRENDS DATA${simLabel} ===
Keywords Analyzed: ${trendsData.keywords.join(", ")}
Data Source: ${trendsData.source}
Timestamp: ${trendsData.timestamp}

Interest Over Time (Last 12 months):
${trendsData.interestOverTime.map((d) => `${d.date}: ${d.value}%`).join("\n")}

Related Queries (Top 10):
${trendsData.relatedQueries.map((q, i) => `${i + 1}. "${q.query}" - Search Interest: ${q.value}%`).join("\n")}

Rising Queries (Breakout trends):
${trendsData.risingQueries.map((q, i) => `${i + 1}. "${q.query}" - Growth: ${q.growth}`).join("\n")}

Geographic Interest (Top regions):
${trendsData.geoData.map((g, i) => `${i + 1}. ${g.location}: ${g.value}%`).join("\n")}

=== END TRENDS DATA ===`;
      }

      const [resOut, trendOut] = await Promise.all([
        runAgent("researcher", baseContext, ctrl, enc, customModelId),
        (async () => {
          await wait(1500);
          return runAgent("trend_analyst", trendsContext, ctrl, enc, customModelId);
        })(),
      ]);
      if (resOut) outputs.research = resOut;
      if (trendOut) outputs.trends = trendOut;

      try { ctrl.enqueue(enc.encode(sse({ type: "phase_complete", phase: "research" }))); } catch { /* */ }
      await wait(600);

      // Phase: Content + Strategy (parallel)
      try { ctrl.enqueue(enc.encode(sse({ type: "phase_start", phase: "create" }))); } catch { /* */ }

      // Smart extraction — preserves section structure, 5000/4000 char limit (was 2500/2000)
      let createContext = baseContext;
      if (outputs.research) createContext += `\n\nMarket Research:\n${smartExtract(outputs.research, 5000)}`;
      if (outputs.trends) createContext += `\n\nTrend Insights:\n${smartExtract(outputs.trends, 4000)}`;

      const [contentOut, stratOut, personaOut, emailOut, landingOut] = await Promise.all([
        runAgent("content_creator", createContext, ctrl, enc, customModelId),
        (async () => { await wait(800); return runAgent("strategist", createContext, ctrl, enc, customModelId); })(),
        (async () => { await wait(1600); return runAgent("persona_builder", createContext, ctrl, enc, customModelId); })(),
        (async () => { await wait(2400); return runAgent("email_strategist", createContext, ctrl, enc, customModelId); })(),
        (async () => { await wait(3200); return runAgent("landing_page", createContext, ctrl, enc, customModelId); })(),
      ]);
      if (contentOut) outputs.content = contentOut;
      if (stratOut) outputs.strategy = stratOut;
      if (personaOut) outputs.personas = personaOut;
      if (emailOut) outputs.emailSequence = emailOut;
      if (landingOut) outputs.landingPage = landingOut;

      try { ctrl.enqueue(enc.encode(sse({ type: "phase_complete", phase: "create" }))); } catch { /* */ }
      await wait(600);

      // Phase: Report
      try { ctrl.enqueue(enc.encode(sse({ type: "phase_start", phase: "report" }))); } catch { /* */ }

      let reportContext = baseContext;
      if (outputs.research) reportContext += `\n\nMarket Research:\n${smartExtract(outputs.research, 3000)}`;
      if (outputs.trends) reportContext += `\n\nTrend Insights:\n${smartExtract(outputs.trends, 2000)}`;
      if (outputs.content) reportContext += `\n\nCreative Content:\n${smartExtract(outputs.content, 2000)}`;
      if (outputs.strategy) reportContext += `\n\nStrategy:\n${smartExtract(outputs.strategy, 2000)}`;

      await runAgent("report_generator", reportContext, ctrl, enc, customModelId);

      try { ctrl.enqueue(enc.encode(sse({ type: "phase_complete", phase: "report" }))); } catch { /* */ }
      try { ctrl.enqueue(enc.encode(sse({ type: "complete" }))); } catch { /* */ }
      try { ctrl.close(); } catch { /* */ }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

/* ------------------------------------------------------------------ */
/*  Action: Refine                                                     */
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
      if (research) context += `\n\nMarket Research:\n${smartExtract(research, 2500)}`;
      if (trends) context += `\n\nTrend Insights:\n${smartExtract(trends, 2000)}`;
      if (content && agentId !== "content_creator") context += `\n\nContent:\n${smartExtract(content, 1500)}`;
      if (strategy && agentId !== "strategist") context += `\n\nStrategy:\n${smartExtract(strategy, 1500)}`;
      if (currentOutput) context += `\n\nYour previous output:\n${smartExtract(currentOutput, 2500)}`;
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
  if (!MISTRAL_API_KEY) {
    return Response.json({ error: "API key not configured" }, { status: 500 });
  }

  // Rate limiting — 30 requests/minute per IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || "unknown";
  const rateResult = checkRateLimit(ip, 30, 60_000);
  if (!rateResult.ok) {
    return Response.json(
      { error: `Rate limit exceeded. Try again in ${Math.ceil(rateResult.resetIn / 1000)}s.` },
      { status: 429 }
    );
  }

  const body = await req.json();
  const action = body.action as string;

  switch (action) {
    case "plan": {
      const { brief, customModelId } = body;
      if (!brief || typeof brief !== "string") {
        return Response.json({ error: "Brief required" }, { status: 400 });
      }
      if (brief.length > 5000) {
        return Response.json({ error: "Brief must be under 5000 characters" }, { status: 400 });
      }
      return handlePlan(brief, customModelId);
    }

    case "execute": {
      const { brief, planRaw, userNotes, customModelId } = body;
      if (!brief) return Response.json({ error: "Brief required" }, { status: 400 });
      if (brief.length > 5000) {
        return Response.json({ error: "Brief must be under 5000 characters" }, { status: 400 });
      }
      return handleExecute(brief, planRaw || "", userNotes, customModelId);
    }

    case "refine": {
      const { agentId, feedback } = body;
      if (!agentId || !feedback) {
        return Response.json({ error: "agentId and feedback required" }, { status: 400 });
      }
      if (feedback.length > 2000) {
        return Response.json({ error: "Feedback must be under 2000 characters" }, { status: 400 });
      }
      return handleRefine(body);
    }

    default:
      return Response.json({ error: "Invalid action. Use: plan, execute, refine" }, { status: 400 });
  }
}
