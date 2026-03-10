import { NextRequest } from "next/server";

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

export const maxDuration = 60;

const ANGLES = [
  {
    angle: "Curiosity",
    instruction: "Rewrite using curiosity and intrigue — make the reader feel they're missing a secret or discovery. Use 'What if', 'The surprising truth about', 'Why most people...' patterns.",
  },
  {
    angle: "FOMO",
    instruction: "Rewrite using Fear of Missing Out — create urgency and exclusivity. Reference what they'll lose, miss, or be left behind on if they don't act now.",
  },
  {
    angle: "Authority",
    instruction: "Rewrite using authority and credibility — cite research, use 'proven', 'expert-backed', 'data shows', and position it as the definitive solution endorsed by leaders.",
  },
];

async function generateVariant(
  original: string,
  brief: string,
  angle: (typeof ANGLES)[number]
): Promise<{ text: string; rationale: string; score: number }> {
  const system = `You are an expert copywriter specializing in psychological persuasion.
Generate one headline variant using the specified psychological angle.
Respond with JSON only:
{
  "text": "the new headline (under 80 chars)",
  "rationale": "one sentence explaining why this angle works for this audience (max 80 chars)",
  "score": <predicted engagement score 1-100>
}`;

  const user = `Original headline: "${original}"
Campaign context: ${brief.slice(0, 300)}
Angle: ${angle.angle}
Instruction: ${angle.instruction}

Return ONLY valid JSON.`;

  const res = await fetch(MISTRAL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.85,
      max_tokens: 200,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) throw new Error(`Mistral ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "{}";

  try {
    const parsed = JSON.parse(content);
    return {
      text: parsed.text || original,
      rationale: parsed.rationale || `${angle.angle} angle applied`,
      score: typeof parsed.score === "number" ? Math.min(100, Math.max(10, parsed.score)) : 70,
    };
  } catch {
    return { text: original, rationale: `${angle.angle} angle`, score: 65 };
  }
}

export async function POST(req: NextRequest) {
  if (!MISTRAL_API_KEY) {
    return Response.json({ error: "API key not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { original, brief } = body;

  if (!original || typeof original !== "string") {
    return Response.json({ error: "original required" }, { status: 400 });
  }

  try {
    const variants = await Promise.all(
      ANGLES.map(async (angle) => {
        const v = await generateVariant(original, brief || "", angle);
        return { angle: angle.angle, ...v };
      })
    );

    return Response.json({ variants });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
