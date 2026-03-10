import { NextRequest } from "next/server";

export const maxDuration = 120;

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

const MARKET_NOTES: Record<string, string> = {
  Germany: "German consumers value quality, engineering, and privacy. Use formal 'Sie' register. Avoid superlatives — they're viewed as hyperbole.",
  France: "French audiences respond to elegance, heritage, and cultural sophistication. Be subtle with direct sales language.",
  Japan: "Japanese market values harmony, quality, and group belonging. Avoid aggressive FOMO tactics. Seasonal references are powerful.",
  India: "Indian market is diverse — focus on value for money, family benefits, and aspiration. Mix of formal and aspirational tone.",
  Brazil: "Brazilian consumers are warm, social, and community-driven. Use enthusiastic, friendly language. Portuguese localization required.",
};

export async function POST(req: NextRequest) {
  if (!MISTRAL_API_KEY) {
    return Response.json({ error: "API key not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { brief, content, strategy, targetMarket, targetLang, currency, planName } = body;

  if (!content && !brief) {
    return Response.json({ error: "content or brief required" }, { status: 400 });
  }

  const marketNote = MARKET_NOTES[targetMarket] || "";
  const isEnglish = targetLang.startsWith("en");

  const system = `You are a market localization expert specializing in ${targetMarket}.
Your job is to adapt a marketing campaign for the ${targetMarket} market.
${marketNote}

Guidelines:
- Currency: Use ${currency} (convert USD amounts proportionally)
- Language: ${isEnglish ? `Use ${targetLang} spelling and idioms` : `Translate to ${targetLang} naturally, not literally`}
- Platform preferences: Adapt channel recommendations for ${targetMarket} (e.g., WeChat for Asia, WhatsApp for India/Brazil)
- Cultural references: Replace any culturally specific references with ${targetMarket}-relevant equivalents
- Pricing: Adjust price points to ${targetMarket} market rates
- Legal: Note any ${targetMarket}-specific regulatory considerations for marketing

Output the adapted campaign content using the same structural headers as the original.`;

  const user = `Campaign to localize for ${targetMarket}:

Original Brief: ${brief?.slice(0, 500) || "See content below"}
Campaign Name: ${planName || "Campaign"}

Content to adapt:
${(content || "").slice(0, 3000)}

${strategy ? `Strategy context:\n${strategy.slice(0, 1000)}` : ""}

Provide the localized version maintaining the same structure. Keep section headers in English for consistency.`;

  try {
    const res = await fetch(MISTRAL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-large-latest",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.6,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) throw new Error(`Mistral ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const localizedContent = data.choices?.[0]?.message?.content || "";

    const notes = marketNote
      ? `${targetMarket} localization note: ${marketNote.split(".")[0]}.`
      : `Adapted for ${targetMarket} market (${currency}).`;

    return Response.json({ content: localizedContent, notes });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Localization failed" },
      { status: 500 }
    );
  }
}
