import { NextRequest } from "next/server";

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const REPLICATE_BASE = "https://api.replicate.com/v1";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface VisualRequest {
  type: "image" | "video";
  prompt: string;
  aspectRatio?: string;
  duration?: number;
}

interface PredictionResponse {
  id: string;
  status: string;
  output?: string | string[];
  error?: string;
  urls?: { get: string; cancel: string };
}

/* ------------------------------------------------------------------ */
/*  Replicate API helpers                                              */
/* ------------------------------------------------------------------ */

async function createPrediction(
  model: string,
  input: Record<string, unknown>
): Promise<PredictionResponse> {
  const res = await fetch(`${REPLICATE_BASE}/predictions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
    },
    body: JSON.stringify({ version: model, input }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Replicate API error: ${err}`);
  }

  return res.json();
}

async function getPrediction(id: string): Promise<PredictionResponse> {
  const res = await fetch(`${REPLICATE_BASE}/predictions/${id}`, {
    headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Prediction status error: ${err}`);
  }

  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Model versions (these are stable version IDs)                      */
/* ------------------------------------------------------------------ */

// Flux Schnell (fast, cheap, high quality)
const FLUX_SCHNELL = "black-forest-labs/flux-schnell";

// Minimax Video (affordable video generation)
const MINIMAX_VIDEO = "minimax/video-01";

/* ------------------------------------------------------------------ */
/*  Generate image using Flux                                          */
/* ------------------------------------------------------------------ */

async function generateImage(prompt: string, aspectRatio: string = "16:9"): Promise<string> {
  const prediction = await createPrediction(FLUX_SCHNELL, {
    prompt,
    aspect_ratio: aspectRatio,
    num_outputs: 1,
    output_format: "png",
    output_quality: 90,
  });

  if (!prediction.id) throw new Error("No prediction ID returned");

  // Poll for completion
  let result = prediction;
  let attempts = 0;
  while (result.status !== "succeeded" && result.status !== "failed" && attempts < 60) {
    await new Promise((r) => setTimeout(r, 2000));
    result = await getPrediction(prediction.id);
    attempts++;
  }

  if (result.status === "failed") {
    throw new Error(result.error || "Image generation failed");
  }

  if (!result.output) throw new Error("No output from image generation");

  const output = Array.isArray(result.output) ? result.output[0] : result.output;
  return output;
}

/* ------------------------------------------------------------------ */
/*  Generate video using Minimax                                       */
/* ------------------------------------------------------------------ */

async function generateVideo(prompt: string): Promise<string> {
  const prediction = await createPrediction(MINIMAX_VIDEO, {
    prompt,
    prompt_optimizer: true,
  });

  if (!prediction.id) throw new Error("No prediction ID returned");

  // Poll for completion (videos take longer)
  let result = prediction;
  let attempts = 0;
  while (result.status !== "succeeded" && result.status !== "failed" && attempts < 120) {
    await new Promise((r) => setTimeout(r, 5000));
    result = await getPrediction(prediction.id);
    attempts++;
  }

  if (result.status === "failed") {
    throw new Error(result.error || "Video generation failed");
  }

  if (!result.output) throw new Error("No output from video generation");

  const output = Array.isArray(result.output) ? result.output[0] : result.output;
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

  // Extract headlines for hero banner
  const headlineMatch = content.match(/##\s*Campaign Headlines([\s\S]*?)(?=##|$)/i);
  if (headlineMatch) {
    const headlines = headlineMatch[1]
      .split(/\n/)
      .filter((l) => /^\d+\./.test(l.trim()))
      .map((l) => l.replace(/^\d+\.\s*/, "").trim())
      .filter(Boolean);

    if (headlines[0]) {
      images.push({
        type: "Hero Banner",
        prompt: `Professional marketing hero banner for campaign "${campaignName}". Bold headline text: "${headlines[0]}". Modern, clean design, vibrant colors, high-end photography style, professional lighting, marketing quality`,
        aspectRatio: "16:9",
      });
    }
  }

  // Instagram post visuals
  const instaMatch = content.match(/##\s*Instagram Posts?([\s\S]*?)(?=##|$)/i);
  if (instaMatch) {
    const posts = instaMatch[1].split(/---/).filter((p) => p.trim().length > 20);
    if (posts[0]) {
      const caption = posts[0].slice(0, 200).replace(/[#*_`]/g, "").trim();
      images.push({
        type: "Instagram Post",
        prompt: `Instagram-style square image for: ${caption}. Vibrant, eye-catching, social media optimized, professional photography, trendy aesthetic`,
        aspectRatio: "1:1",
      });
    }
  }

  // LinkedIn professional image
  const linkedinMatch = content.match(/##\s*LinkedIn Posts?([\s\S]*?)(?=##|$)/i);
  if (linkedinMatch) {
    const post = linkedinMatch[1].slice(0, 200).replace(/[#*_`]/g, "").trim();
    images.push({
      type: "LinkedIn Post",
      prompt: `Professional LinkedIn post image for: ${post}. Business-appropriate, clean design, corporate aesthetic, professional photography, trustworthy feel`,
      aspectRatio: "16:9",
    });
  }

  // Product/brand showcase
  images.push({
    type: "Brand Showcase",
    prompt: `High-end product photography for ${campaignName} campaign. Premium feel, professional studio lighting, clean background, marketing quality, commercial photography`,
    aspectRatio: "4:3",
  });

  // Social media carousel concept
  images.push({
    type: "Carousel Slide",
    prompt: `Social media carousel slide design for ${campaignName}. Bold typography, modern gradient background, clean layout, Instagram-ready, professional design`,
    aspectRatio: "1:1",
  });

  // TikTok/Reels video concepts
  const tiktokMatch = content.match(/##\s*TikTok Concepts?([\s\S]*?)(?=##|$)/i);
  if (tiktokMatch) {
    const concepts = tiktokMatch[1].split(/\n/).filter((l) => l.trim().length > 30);
    if (concepts[0]) {
      const concept = concepts[0].slice(0, 300).replace(/[#*_`]/g, "").trim();
      videos.push({
        type: "TikTok/Reels Short",
        prompt: `Short vertical video for TikTok/Instagram Reels: ${concept}. Dynamic, engaging, fast-paced, vertical format, social media style, attention-grabbing`,
      });
    }
    if (concepts[1]) {
      const concept2 = concepts[1].slice(0, 300).replace(/[#*_`]/g, "").trim();
      videos.push({
        type: "TikTok/Reels Short",
        prompt: `Vertical social media video: ${concept2}. Energetic, trendy, vertical format, engaging visuals, modern aesthetic`,
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
        
        // Generate images in parallel (limit to 5 for cost control)
        const imagePromises = prompts.images.slice(0, 5).map(async (img) => {
          try {
            const url = await generateImage(img.prompt, img.aspectRatio);
            return { type: img.type, url, format: "image", prompt: img.prompt };
          } catch (err) {
            return { type: img.type, url: null, format: "image", error: err instanceof Error ? err.message : "Failed" };
          }
        });

        // Generate videos (limit to 2 for cost control)
        const videoPromises = prompts.videos.slice(0, 2).map(async (vid) => {
          try {
            const url = await generateVideo(vid.prompt);
            return { type: vid.type, url, format: "video", prompt: vid.prompt };
          } catch (err) {
            return { type: vid.type, url: null, format: "video", error: err instanceof Error ? err.message : "Failed" };
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
