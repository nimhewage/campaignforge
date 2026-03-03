import { NextRequest } from "next/server";

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_BASE = "https://api.mistral.ai/v1";
const FINE_TUNE_BASE_MODEL = "open-mistral-7b";

/* ------------------------------------------------------------------ */
/*  Convert raw text into JSONL training samples                       */
/* ------------------------------------------------------------------ */

interface TrainingSample {
  messages: { role: string; content: string }[];
}

function textToSamples(text: string): TrainingSample[] {
  const samples: TrainingSample[] = [];

  const chunks = text.split(/\n\s*\n/).filter((p) => p.trim().length > 30);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].trim();

    samples.push({
      messages: [
        {
          role: "system",
          content:
            "You are a marketing expert with deep knowledge of this brand. Use the brand knowledge to create accurate, on-brand marketing content.",
        },
        {
          role: "user",
          content: `Based on our brand knowledge, describe: ${chunk.slice(0, 60)}...`,
        },
        {
          role: "assistant",
          content: chunk,
        },
      ],
    });

    if (chunk.length > 100) {
      samples.push({
        messages: [
          {
            role: "system",
            content:
              "You are a marketing expert with deep knowledge of this brand. Use the brand knowledge to create accurate, on-brand marketing content.",
          },
          {
            role: "user",
            content: "Summarize the following brand information and highlight key marketing angles.",
          },
          {
            role: "assistant",
            content: `Key points: ${chunk.replace(/\n/g, " ").slice(0, 500)}`,
          },
        ],
      });
    }
  }

  if (samples.length < 10) {
    const fullText = chunks.join("\n\n");
    const campaignTypes = [
      "social media campaign",
      "email marketing campaign",
      "brand awareness campaign",
      "product launch campaign",
      "content marketing strategy",
    ];
    for (const campaignType of campaignTypes) {
      samples.push({
        messages: [
          {
            role: "system",
            content:
              "You are a marketing expert with deep knowledge of this brand. Use the brand knowledge to create accurate, on-brand marketing content.",
          },
          {
            role: "user",
            content: `Create a ${campaignType} based on our brand knowledge.`,
          },
          {
            role: "assistant",
            content: `Based on the brand knowledge:\n\n${fullText.slice(0, 800)}\n\nHere is a ${campaignType} approach that aligns with the brand identity and targets the right audience segments.`,
          },
        ],
      });
    }
  }

  return samples;
}

function samplesToJsonl(samples: TrainingSample[]): string {
  return samples.map((s) => JSON.stringify(s)).join("\n");
}

/* ------------------------------------------------------------------ */
/*  Mistral API helpers                                                */
/* ------------------------------------------------------------------ */

async function uploadFile(jsonlContent: string): Promise<string> {
  const blob = new Blob([jsonlContent], { type: "application/jsonl" });
  const formData = new FormData();
  formData.append("file", blob, "training_data.jsonl");
  formData.append("purpose", "fine-tune");

  const res = await fetch(`${MISTRAL_BASE}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${MISTRAL_API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`File upload failed: ${err}`);
  }

  const data = await res.json();
  return data.id;
}

async function createFineTuneJob(fileId: string): Promise<{ jobId: string; status: string; modelId?: string }> {
  const res = await fetch(`${MISTRAL_BASE}/fine_tuning/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: FINE_TUNE_BASE_MODEL,
      training_files: [fileId],
      hyperparameters: {
        training_steps: 50,
        learning_rate: 1e-5,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fine-tune job creation failed: ${err}`);
  }

  const data = await res.json();
  return {
    jobId: data.id,
    status: data.status,
    modelId: data.fine_tuned_model,
  };
}

async function getJobStatus(jobId: string): Promise<{ status: string; modelId?: string }> {
  const res = await fetch(`${MISTRAL_BASE}/fine_tuning/jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${MISTRAL_API_KEY}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Job status check failed: ${err}`);
  }

  const data = await res.json();
  return {
    status: data.status,
    modelId: data.fine_tuned_model,
  };
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  if (!MISTRAL_API_KEY) {
    return Response.json({ error: "API key not configured" }, { status: 500 });
  }

  const body = await req.json();
  const action = body.action as string;

  switch (action) {
    case "train": {
      const { text } = body;
      if (!text || typeof text !== "string") {
        return Response.json({ error: "Text content required" }, { status: 400 });
      }

      try {
        const samples = textToSamples(text);
        const jsonl = samplesToJsonl(samples);

        const fileId = await uploadFile(jsonl);
        const job = await createFineTuneJob(fileId);

        if (job.status === "SUCCESS" && job.modelId) {
          return Response.json({ status: "complete", modelId: job.modelId });
        }

        return Response.json({
          status: "training",
          jobId: job.jobId,
          sampleCount: samples.length,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Training failed";
        return Response.json({ error: msg }, { status: 500 });
      }
    }

    case "status": {
      const { jobId } = body;
      if (!jobId) {
        return Response.json({ error: "jobId required" }, { status: 400 });
      }

      try {
        const result = await getJobStatus(jobId);
        return Response.json(result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Status check failed";
        return Response.json({ error: msg }, { status: 500 });
      }
    }

    default:
      return Response.json({ error: "Invalid action. Use: train, status" }, { status: 400 });
  }
}
