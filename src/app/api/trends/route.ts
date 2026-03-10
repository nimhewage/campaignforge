import { NextRequest } from "next/server";
import { getTrendsData, extractKeywords, getGoogleTrends, generateFallbackTrends } from "@/lib/trends";

export const maxDuration = 60;

/* ------------------------------------------------------------------ */
/*  Route handler — thin wrapper around shared lib                     */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { brief, keywords: providedKeywords } = body;

    if (!brief && !providedKeywords) {
      return Response.json({ error: "Brief or keywords required" }, { status: 400 });
    }

    const keywords: string[] = providedKeywords || extractKeywords(brief);

    let trendsData = await getGoogleTrends(keywords);
    if (!trendsData) {
      trendsData = generateFallbackTrends(keywords);
    }

    return Response.json({
      success: true,
      data: trendsData,
      hasRealData: !trendsData.isSimulated,
      message: trendsData.isSimulated
        ? "Simulated data — add SERPAPI_KEY to .env.local for live Google Trends (serpapi.com)"
        : "Real-time data from Google Trends",
    });
  } catch (err: unknown) {
    // Fallback: still return data even on error
    try {
      const body = await req.json().catch(() => ({}));
      const keywords = body.brief ? extractKeywords(body.brief) : ["marketing"];
      const fallback = generateFallbackTrends(keywords);
      return Response.json({ success: true, data: fallback, hasRealData: false });
    } catch {
      const msg = err instanceof Error ? err.message : "Trends API failed";
      return Response.json({ error: msg }, { status: 500 });
    }
  }
}

/* Also expose GET for direct testing */
export async function GET(req: NextRequest) {
  const brief = req.nextUrl.searchParams.get("brief") || "digital marketing";
  const data = await getTrendsData(brief);
  return Response.json({ success: true, data });
}
