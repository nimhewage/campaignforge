/* ------------------------------------------------------------------ */
/*  Campaign localStorage persistence                                  */
/* ------------------------------------------------------------------ */

const CAMPAIGNS_KEY = "campaignforge_campaigns";
const MODEL_KEY = "campaignforge_model_id";
const MAX_SAVED = 25;

export interface SavedVisual {
  type: string;
  url: string | null;
  format: "image" | "video";
  prompt: string;
  error?: string;
}

export interface SavedPlan {
  campaign_name: string;
  big_idea: string;
  target_audience: { primary: string; secondary: string; location: string };
  objectives: string[];
  channels: { name: string; priority: string; reason: string }[];
  tone: string;
  key_messages: string[];
  timeline: string;
  budget_notes: string;
}

export interface SavedCampaignData {
  brief: string;
  planRaw?: string;
  research?: string;
  trends?: string;
  content?: string;
  strategy?: string;
  report?: string;
  visuals?: SavedVisual[];
}

export interface SavedCampaign {
  id: string;
  campaignName: string;
  bigIdea: string;
  brief: string;
  createdAt: number;
  updatedAt: number;
  campaign: SavedCampaignData;
  plan: SavedPlan | null;
  feedbackRating?: number;
  feedbackNotes?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function load(): SavedCampaign[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CAMPAIGNS_KEY) || "[]");
  } catch {
    return [];
  }
}

function persist(campaigns: SavedCampaign[]) {
  try {
    localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(campaigns));
  } catch {
    // Storage quota exceeded — trim oldest and retry
    const trimmed = campaigns.slice(-10);
    localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(trimmed));
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export function saveCampaign(
  campaign: SavedCampaignData,
  plan: SavedPlan | null
): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: SavedCampaign = {
    id,
    campaignName: plan?.campaign_name || campaign.brief.slice(0, 60),
    bigIdea: plan?.big_idea || "",
    brief: campaign.brief,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    campaign,
    plan,
  };

  const existing = load();
  // Keep newest MAX_SAVED entries
  const updated = [entry, ...existing].slice(0, MAX_SAVED);
  persist(updated);
  return id;
}

export function updateCampaign(id: string, campaign: SavedCampaignData): void {
  const existing = load();
  const updated = existing.map((c) =>
    c.id === id ? { ...c, campaign, updatedAt: Date.now() } : c
  );
  persist(updated);
}

export function loadCampaigns(): SavedCampaign[] {
  return load().sort((a, b) => b.createdAt - a.createdAt);
}

export function loadCampaign(id: string): SavedCampaign | null {
  return load().find((c) => c.id === id) || null;
}

export function deleteCampaign(id: string): void {
  persist(load().filter((c) => c.id !== id));
}

export function saveFeedback(id: string, rating: number, notes?: string): void {
  const existing = load();
  const updated = existing.map((c) =>
    c.id === id ? { ...c, feedbackRating: rating, feedbackNotes: notes } : c
  );
  persist(updated);
}

/* ------------------------------------------------------------------ */
/*  Model ID persistence                                               */
/* ------------------------------------------------------------------ */

export function saveModelId(modelId: string | null): void {
  if (typeof window === "undefined") return;
  if (modelId) {
    localStorage.setItem(MODEL_KEY, modelId);
  } else {
    localStorage.removeItem(MODEL_KEY);
  }
}

export function loadModelId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(MODEL_KEY);
}
