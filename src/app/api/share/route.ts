import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

/* ------------------------------------------------------------------ */
/*  In-memory campaign store                                           */
/*  Resets on server restart — sufficient for sharing/review sessions  */
/* ------------------------------------------------------------------ */

interface SharedCampaign {
  id: string;
  campaignName: string;
  bigIdea: string;
  brief: string;
  research?: string;
  trends?: string;
  content?: string;
  strategy?: string;
  report?: string;
  personas?: string;
  emailSequence?: string;
  landingPage?: string;
  createdAt: number;
}

const store = new Map<string, SharedCampaign>();

// Auto-cleanup entries older than 72 hours
setInterval(() => {
  const cutoff = Date.now() - 72 * 60 * 60 * 1000;
  for (const [id, entry] of store) {
    if (entry.createdAt < cutoff) store.delete(id);
  }
}, 60 * 60 * 1000); // run hourly

/* ------------------------------------------------------------------ */
/*  POST /api/share — create shared link                               */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { campaign, plan } = body;

  if (!campaign) {
    return Response.json({ error: "campaign required" }, { status: 400 });
  }

  const id = randomUUID();
  const entry: SharedCampaign = {
    id,
    campaignName: plan?.campaign_name || "Campaign",
    bigIdea: plan?.big_idea || "",
    brief: campaign.brief || "",
    research: campaign.research,
    trends: campaign.trends,
    content: campaign.content,
    strategy: campaign.strategy,
    report: campaign.report,
    personas: campaign.personas,
    emailSequence: campaign.emailSequence,
    landingPage: campaign.landingPage,
    createdAt: Date.now(),
  };

  store.set(id, entry);

  return Response.json({ id, url: `/campaign/${id}` });
}

/* ------------------------------------------------------------------ */
/*  GET /api/share?id=xxx — fetch shared campaign                      */
/* ------------------------------------------------------------------ */

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const entry = store.get(id);
  if (!entry) return Response.json({ error: "Campaign not found or expired" }, { status: 404 });

  return Response.json(entry);
}
