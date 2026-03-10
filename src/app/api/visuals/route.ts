import { NextRequest } from "next/server";

export const maxDuration = 120;

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PredictionResponse {
  id: string;
  status: string;
  output?: string | string[] | null;
  error?: string | null;
  urls?: { get: string; cancel: string };
}

/* ------------------------------------------------------------------ */
/*  Replicate API                                                      */
/* ------------------------------------------------------------------ */

async function createModelPrediction(
  owner: string,
  model: string,
  input: Record<string, unknown>
): Promise<PredictionResponse> {
  const res = await fetch(`https://api.replicate.com/v1/models/${owner}/${model}/predictions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${REPLICATE_API_TOKEN}`,
      Prefer: "wait",
    },
    body: JSON.stringify({ input }),
  });

  if (!res.ok) throw new Error(`Replicate error (${res.status}): ${await res.text()}`);
  return res.json();
}

async function getPrediction(id: string): Promise<PredictionResponse> {
  const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Prediction status error: ${await res.text()}`);
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Image generation                                                   */
/* ------------------------------------------------------------------ */

async function generateImage(prompt: string, aspectRatio = "16:9"): Promise<string> {
  let prediction = await createModelPrediction("black-forest-labs", "flux-schnell", {
    prompt,
    aspect_ratio: aspectRatio,
    num_outputs: 1,
    output_format: "webp",
    output_quality: 90,
  });

  // Poll up to 20 attempts × 2s = 40s (safely within maxDuration)
  let attempts = 0;
  while (prediction.status !== "succeeded" && prediction.status !== "failed" && attempts < 20) {
    await new Promise((r) => setTimeout(r, 2000));
    prediction = await getPrediction(prediction.id);
    attempts++;
  }

  if (prediction.status === "failed") throw new Error(prediction.error || "Image generation failed");
  if (!prediction.output) throw new Error("No output from image generation");

  return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
}

/* ------------------------------------------------------------------ */
/*  Video generation — capped at 12 attempts × 5s = 60s               */
/*  Videos often won't complete within serverless timeout;             */
/*  we return a partial error rather than hanging forever.             */
/* ------------------------------------------------------------------ */

async function generateVideo(prompt: string): Promise<string> {
  let prediction = await createModelPrediction("minimax", "video-01", {
    prompt,
    prompt_optimizer: true,
  });

  let attempts = 0;
  while (prediction.status !== "succeeded" && prediction.status !== "failed" && attempts < 12) {
    await new Promise((r) => setTimeout(r, 5000));
    prediction = await getPrediction(prediction.id);
    attempts++;
  }

  if (prediction.status === "failed") throw new Error(prediction.error || "Video generation failed");
  if (!prediction.output) {
    // Timed out — return the prediction ID so the client could poll if needed
    throw new Error(`Video still processing (id: ${prediction.id}). Videos can take 2-5 minutes. Try the direct link: https://replicate.com/p/${prediction.id}`);
  }

  return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
}

/* ------------------------------------------------------------------ */
/*  Extract visual prompts from campaign content                       */
/* ------------------------------------------------------------------ */

interface VisualPrompts {
  images: { type: string; prompt: string; aspectRatio: string }[];
  videos: { type: string; prompt: string }[];
}

function extractVisualPrompts(content: string, campaignName: string): VisualPrompts {
  const images: VisualPrompts["images"] = [];
  const videos: VisualPrompts["videos"] = [];
  const name = campaignName.split("\n")[0].slice(0, 80);

  const headlineMatch = content.match(/##\s*Campaign Headlines([\s\S]*?)(?=##|$)/i);
  if (headlineMatch) {
    const headlines = headlineMatch[1]
      .split(/\n/)
      .filter((l) => /^\d+\./.test(l.trim()))
      .map((l) => l.replace(/^\d+\.\s*/, "").replace(/\*\*/g, "").trim())
      .filter(Boolean);
    if (headlines[0]) {
      images.push({
        type: "Hero Banner",
        prompt: `Professional marketing hero banner. "${headlines[0]}". Modern clean design, vibrant gradient, high-end photography, professional lighting, marketing quality, no text overlay`,
        aspectRatio: "16:9",
      });
    }
  }

  const instaMatch = content.match(/##\s*Instagram Posts?([\s\S]*?)(?=##|$)/i);
  if (instaMatch) {
    const caption = instaMatch[1].slice(0, 200).replace(/[#*_`\n]/g, " ").trim();
    images.push({
      type: "Instagram Post",
      prompt: `Instagram-style square image for social media campaign about ${name}. ${caption}. Vibrant, eye-catching, social media optimized, professional photography, trendy aesthetic`,
      aspectRatio: "1:1",
    });
  }

  const linkedinMatch = content.match(/##\s*LinkedIn Posts?([\s\S]*?)(?=##|$)/i);
  if (linkedinMatch) {
    images.push({
      type: "LinkedIn Banner",
      prompt: `Professional LinkedIn cover image for ${name}. Business-appropriate, clean corporate design, subtle gradient, professional photography, trustworthy feel`,
      aspectRatio: "16:9",
    });
  }

  images.push({
    type: "Brand Showcase",
    prompt: `High-end product photography for ${name}. Premium feel, professional studio lighting, clean background, marketing quality, commercial photography`,
    aspectRatio: "4:3",
  });

  images.push({
    type: "Carousel Slide",
    prompt: `Social media carousel slide design for ${name}. Bold typography, modern gradient background, clean layout, Instagram-ready, professional design`,
    aspectRatio: "1:1",
  });

  const tiktokMatch = content.match(/##\s*TikTok Concepts?([\s\S]*?)(?=##|$)/i);
  if (tiktokMatch) {
    const lines = tiktokMatch[1].split(/\n/).filter((l) => l.trim().length > 30);
    if (lines[0]) {
      const concept = lines[0].slice(0, 300).replace(/[#*_`]/g, "").trim();
      videos.push({
        type: "TikTok/Reels Short",
        prompt: `Short vertical video for TikTok/Instagram Reels about ${name}: ${concept}. Dynamic, engaging, fast-paced, social media style`,
      });
    }
  }

  return { images, videos };
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  if (!REPLICATE_API_TOKEN) {
    return Response.json({ error: "Replicate API token not configured" }, { status: 500 });
  }

  const body = await req.json();
  const action = body.action as string;

  switch (action) {
    case "generate": {
      const { content, campaignName } = body;
      if (!content || !campaignName) {
        return Response.json({ error: "Content and campaign name required" }, { status: 400 });
      }

      try {
        const prompts = extractVisualPrompts(content, campaignName);

        // Generate images in parallel (limit to 5)
        const imagePromises = prompts.images.slice(0, 5).map(async (img) => {
          try {
            const url = await generateImage(img.prompt, img.aspectRatio);
            return { type: img.type, url, format: "image" as const, prompt: img.prompt };
          } catch (err) {
            return { type: img.type, url: null, format: "image" as const, error: err instanceof Error ? err.message : "Failed", prompt: img.prompt };
          }
        });

        // Generate 1 video max (cost + time constraint)
        const videoPromises = prompts.videos.slice(0, 1).map(async (vid) => {
          try {
            const url = await generateVideo(vid.prompt);
            return { type: vid.type, url, format: "video" as const, prompt: vid.prompt };
          } catch (err) {
            return { type: vid.type, url: null, format: "video" as const, error: err instanceof Error ? err.message : "Failed", prompt: vid.prompt };
          }
        });

        const [images, videos] = await Promise.all([
          Promise.all(imagePromises),
          Promise.all(videoPromises),
        ]);

        return Response.json({
          success: true,
          visuals: [...images, ...videos],
          totalGenerated: images.filter((i) => i.url).length + videos.filter((v) => v.url).length,
        });
      } catch (err: unknown) {
        return Response.json({ error: err instanceof Error ? err.message : "Visual generation failed" }, { status: 500 });
      }
    }

    case "single": {
      const { type, prompt, aspectRatio } = body;
      if (!type || !prompt) {
        return Response.json({ error: "Type and prompt required" }, { status: 400 });
      }

      try {
        const url = type === "video"
          ? await generateVideo(prompt)
          : await generateImage(prompt, aspectRatio || "16:9");
        return Response.json({ success: true, url, type });
      } catch (err: unknown) {
        return Response.json({ error: err instanceof Error ? err.message : "Generation failed" }, { status: 500 });
      }
    }

    default:
      return Response.json({ error: "Invalid action. Use: generate, single" }, { status: 400 });
  }
}
