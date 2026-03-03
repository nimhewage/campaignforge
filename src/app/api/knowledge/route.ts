import { NextRequest } from "next/server";

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_BASE = "https://api.mistral.ai/v1";

/* ------------------------------------------------------------------ */
/*  Convert raw text into JSONL training samples                       */
/* ------------------------------------------------------------------ */

interface TrainingSample {
  messages: { role: string; content: string }[];
}

function textToSamples(text: string): TrainingSample[] {
  const samples: TrainingSample[] = [];
  const SYS = "You are a marketing expert with deep knowledge of this brand. Use the brand knowledge to create accurate, on-brand marketing content.";

  const chunks = text.split(/\n\s*\n/).filter((p) => p.trim().length > 30);

  for (const chunk of chunks) {
    const trimmed = chunk.trim();

    samples.push({
      messages: [
        { role: "system", content: SYS },
        { role: "user", content: `Based on our brand knowledge, describe: ${trimmed.slice(0, 60)}...` },
        { role: "assistant", content: trimmed },
      ],
    });

    if (trimmed.length > 100) {
      samples.push({
        messages: [
          { role: "system", content: SYS },
          { role: "user", content: "Summarize the following brand information and highlight key marketing angles." },
          { role: "assistant", content: `Key points: ${trimmed.replace(/\n/g, " ").slice(0, 500)}` },
        ],
      });
    }
  }

  if (samples.length < 10) {
    const fullText = chunks.join("\n\n");
    const types = [
      "social media campaign", "email marketing campaign", "brand awareness campaign",
      "product launch campaign", "content marketing strategy",
    ];
    for (const t of types) {
      samples.push({
        messages: [
          { role: "system", content: SYS },
          { role: "user", content: `Create a ${t} based on our brand knowledge.` },
          { role: "assistant", content: `Based on the brand knowledge:\n\n${fullText.slice(0, 800)}\n\nHere is a ${t} approach that aligns with the brand identity and targets the right audience segments.` },
        ],
      });
    }
  }

  return samples;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.8);
}

/* ------------------------------------------------------------------ */
/*  Mistral API helpers                                                */
/* ------------------------------------------------------------------ */

async function uploadFile(jsonlContent: string): Promise<{ fileId: string; fileSize: number }> {
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
  return { fileId: data.id, fileSize: blob.size };
}

interface CreateJobResult {
  jobId: string;
  status: string;
  modelId?: string;
  model: string;
  trainedTokens?: number;
}

async function createFineTuneJob(
  fileId: string,
  model: string,
  hyperparameters: { learning_rate?: number; training_steps?: number }
): Promise<CreateJobResult> {
  const res = await fetch(`${MISTRAL_BASE}/fine_tuning/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      training_files: [fileId],
      hyperparameters: {
        training_steps: hyperparameters.training_steps || 50,
        learning_rate: hyperparameters.learning_rate || 0.0001,
      },
      auto_start: true,
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
    model: data.model,
    trainedTokens: data.trained_tokens,
  };
}

interface DetailedJobStatus {
  status: string;
  modelId?: string;
  trainedTokens?: number;
  events?: { name?: string; message?: string; created_at?: number }[];
  checkpoints?: {
    step_number?: number;
    metrics?: { train_loss?: number; valid_loss?: number; valid_mean_token_accuracy?: number };
    created_at?: number;
  }[];
  hyperparameters?: { learning_rate?: number; training_steps?: number; epochs?: number };
  model?: string;
  createdAt?: number;
  modifiedAt?: number;
}

async function getJobStatus(jobId: string): Promise<DetailedJobStatus> {
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
    trainedTokens: data.trained_tokens,
    events: data.events,
    checkpoints: data.checkpoints,
    hyperparameters: data.hyperparameters,
    model: data.model,
    createdAt: data.created_at,
    modifiedAt: data.modified_at,
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
      const { text, model, hyperparameters, dryRun } = body;
      if (!text || typeof text !== "string") {
        return Response.json({ error: "Text content required" }, { status: 400 });
      }

      try {
        const samples = textToSamples(text);
        const jsonl = samples.map((s) => JSON.stringify(s)).join("\n");
        const estTokens = estimateTokens(jsonl);
        const baseModel = model || "open-mistral-7b";

        if (dryRun) {
          return Response.json({
            status: "dry_run",
            sampleCount: samples.length,
            estimatedTokens: estTokens,
            estimatedCost: Math.max(4, (estTokens / 1000000) * 8),
            model: baseModel,
            jsonlSizeBytes: new Blob([jsonl]).size,
            hyperparameters: hyperparameters || { learning_rate: 0.0001, training_steps: 50 },
          });
        }

        const { fileId, fileSize } = await uploadFile(jsonl);

        const job = await createFineTuneJob(
          fileId,
          baseModel,
          hyperparameters || {}
        );

        if (job.status === "SUCCESS" && job.modelId) {
          return Response.json({
            status: "complete",
            modelId: job.modelId,
            trainedTokens: job.trainedTokens,
          });
        }

        return Response.json({
          status: "training",
          jobId: job.jobId,
          sampleCount: samples.length,
          estimatedTokens: estTokens,
          model: baseModel,
          fileId,
          fileSize,
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
