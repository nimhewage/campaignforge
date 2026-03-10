/* ------------------------------------------------------------------ */
/*  GET /api/status — returns which LLM providers are configured       */
/* ------------------------------------------------------------------ */

export async function GET() {
  const providers: string[] = ["mistral"]; // always required
  if (process.env.ANTHROPIC_API_KEY) providers.push("claude");
  if (process.env.OPENAI_API_KEY) providers.push("openai");

  return Response.json({
    providers,
    hasSerpApi: !!process.env.SERPAPI_KEY,
    hasReplicate: !!process.env.REPLICATE_API_TOKEN,
  });
}
