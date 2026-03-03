import { NextRequest } from "next/server";

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
/*  Replicate API - Official Models Endpoint                           */
/* ------------------------------------------------------------------ */

async function createModelPrediction(
  owner: string,
  model: string,
  input: Record<string, unknown>
): Promise<PredictionResponse> {
  const url = `https://api.replicate.com/v1/models/${owner}/${model}/predictions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${REPLICATE_API_TOKEN}`,
      Prefer: "wait",
    },
    body: JSON.stringify({ input }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Replicate error (${res.status}): ${err}`);
  }

  return res.json();
}

async function getPrediction(id: string): Promise<PredictionResponse> {
  const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Prediction status error: ${err}`);
  }

  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Generate image using Flux Schnell                                  */
/* ------------------------------------------------------------------ */

async function generateImage(prompt: string, aspectRatio: string = "16:9"): Promise<string> {
  let prediction = await createModelPrediction("black-forest-labs", "flux-schnell", {
    prompt,
    aspect_ratio: aspectRatio,
    num_outputs: 1,
    output_format: "webp",
    output_quality: 90,
  });

  // If not finished yet (Prefer: wait should handle most cases), poll
  let attempts = 0;
  while (prediction.status !== "succeeded" && prediction.status !== "failed" && attempts < 60) {
    await new Promise((r) => setTimeout(r, 2000));
    prediction = await getPrediction(prediction.id);
    attempts++;
  }

  if (prediction.status === "failed") {
    throw new Error(prediction.error || "Image generation failed");
  }

  if (!prediction.output) throw new Error("No output from image generation");

  const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  return output;
}

/* ------------------------------------------------------------------ */
/*  Generate video using Minimax                                       */
/* ------------------------------------------------------------------ */

async function generateVideo(prompt: string): Promise<string> {
  let prediction = await createModelPrediction("minimax", "video-01", {
    prompt,
    prompt_optimizer: true,
  });

  // Videos take longer - poll until complete
  let attempts = 0;
  while (prediction.status !== "succeeded" && prediction.status !== "failed" && attempts < 120) {
    await new Promise((r) => setTimeout(r, 5000));
    prediction = await getPrediction(prediction.id);
    attempts++;
  }

  if (prediction.status === "failed") {
    throw new Error(prediction.error || "Video generation failed");
  }

  if (!prediction.output) throw new Error("No output from video generation");

  const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  return output;
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

  // Hero banner from headlines
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

  // Instagram post
  const instaMatch = content.match(/##\s*Instagram Posts?([\s\S]*?)(?=##|$)/i);
  if (instaMatch) {
    const caption = instaMatch[1].slice(0, 200).replace(/[#*_`\n]/g, " ").trim();
    images.push({
      type: "Instagram Post",
      prompt: `Instagram-style square image for social media campaign about ${name}. ${caption}. Vibrant, eye-catching, social media optimized, professional photography, trendy aesthetic`,
      aspectRatio: "1:1",
    });
  }

  // LinkedIn professional
  const linkedinMatch = content.match(/##\s*LinkedIn Posts?([\s\S]*?)(?=##|$)/i);
  if (linkedinMatch) {
    images.push({
      type: "LinkedIn Banner",
      prompt: `Professional LinkedIn cover image for ${name}. Business-appropriate, clean corporate design, subtle gradient, professional photography, trustworthy feel`,
      aspectRatio: "16:9",
    });
  }

  // Brand showcase
  images.push({
    type: "Brand Showcase",
    prompt: `High-end product photography for ${name}. Premium feel, professional studio lighting, clean background, marketing quality, commercial photography`,
    aspectRatio: "4:3",
  });

  // Carousel slide
  images.push({
    type: "Carousel Slide",
    prompt: `Social media carousel slide design for ${name}. Bold typography, modern gradient background, clean layout, Instagram-ready, professional design`,
    aspectRatio: "1:1",
  });

  // TikTok/Reels video
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

        // Generate videos (limit to 1 for cost)
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
        const msg = err instanceof Error ? err.message : "Visual generation failed";
        return Response.json({ error: msg }, { status: 500 });
      }
    }

    case "single": {
      const { type, prompt, aspectRatio } = body;
      if (!type || !prompt) {
        return Response.json({ error: "Type and prompt required" }, { status: 400 });
      }

      try {
        let url: string;
        if (type === "image") {
          url = await generateImage(prompt, aspectRatio || "16:9");
        } else if (type === "video") {
          url = await generateVideo(prompt);
        } else {
          return Response.json({ error: "Invalid type. Use: image, video" }, { status: 400 });
        }

        return Response.json({ success: true, url, type });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Generation failed";
        return Response.json({ error: msg }, { status: 500 });
      }
    }

    default:
      return Response.json({ error: "Invalid action. Use: generate, single" }, { status: 400 });
  }
}
