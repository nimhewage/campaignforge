import { NextRequest } from "next/server";

const SERPAPI_KEY = process.env.SERPAPI_KEY;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TrendsData {
  keywords: string[];
  interestOverTime: Array<{ date: string; value: number }>;
  relatedQueries: Array<{ query: string; value: number }>;
  relatedTopics: Array<{ topic: string; value: number }>;
  risingQueries: Array<{ query: string; growth: string }>;
  geoData: Array<{ location: string; value: number }>;
  source: string;
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/*  SerpApi - Google Trends                                            */
/* ------------------------------------------------------------------ */

async function getGoogleTrends(keywords: string[]): Promise<TrendsData | null> {
  if (!SERPAPI_KEY) return null;

  try {
    const query = keywords.slice(0, 5).join(","); // Max 5 keywords
    const params = new URLSearchParams({
      engine: "google_trends",
      q: query,
      data_type: "TIMESERIES",
      api_key: SERPAPI_KEY,
    });

    const res = await fetch(`https://serpapi.com/search?${params}`);
    if (!res.ok) throw new Error(`SerpApi error: ${res.status}`);

    const data = await res.json();

    // Extract interest over time
    const interestOverTime =
      data.interest_over_time?.timeline_data?.map((item: any) => ({
        date: item.date,
        value: item.values?.[0]?.extracted_value || 0,
      })) || [];

    // Get related queries
    const relatedQueriesRes = await fetch(
      `https://serpapi.com/search?${new URLSearchParams({
        engine: "google_trends",
        q: keywords[0],
        data_type: "RELATED_QUERIES",
        api_key: SERPAPI_KEY,
      })}`
    );
    const relatedData = relatedQueriesRes.ok ? await relatedQueriesRes.json() : {};

    const relatedQueries =
      relatedData.related_queries?.top?.map((item: any) => ({
        query: item.query,
        value: item.extracted_value || 0,
      })) || [];

    const risingQueries =
      relatedData.related_queries?.rising?.map((item: any) => ({
        query: item.query,
        growth: item.extracted_value || "Breakout",
      })) || [];

    // Get geographic data
    const geoRes = await fetch(
      `https://serpapi.com/search?${new URLSearchParams({
        engine: "google_trends",
        q: keywords[0],
        data_type: "GEO_MAP",
        api_key: SERPAPI_KEY,
      })}`
    );
    const geoData = geoRes.ok ? await geoRes.json() : {};

    const geo =
      geoData.interest_by_region?.map((item: any) => ({
        location: item.location,
        value: item.extracted_value || 0,
      })) || [];

    return {
      keywords,
      interestOverTime,
      relatedQueries: relatedQueries.slice(0, 10),
      relatedTopics: [],
      risingQueries: risingQueries.slice(0, 10),
      geoData: geo.slice(0, 10),
      source: "Google Trends (via SerpApi)",
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Google Trends API error:", err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Fallback - PyTrends style data (when no API key)                  */
/* ------------------------------------------------------------------ */

function generateFallbackTrends(keywords: string[]): TrendsData {
  const now = Date.now();
  const interestOverTime = Array.from({ length: 12 }, (_, i) => ({
    date: new Date(now - (11 - i) * 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    value: Math.floor(Math.random() * 40) + 60,
  }));

  return {
    keywords,
    interestOverTime,
    relatedQueries: [
      { query: `${keywords[0]} tips`, value: 85 },
      { query: `best ${keywords[0]}`, value: 78 },
      { query: `${keywords[0]} guide`, value: 72 },
      { query: `how to ${keywords[0]}`, value: 68 },
      { query: `${keywords[0]} 2026`, value: 65 },
    ],
    relatedTopics: [],
    risingQueries: [
      { query: `${keywords[0]} AI`, growth: "+350%" },
      { query: `${keywords[0]} automation`, growth: "+280%" },
      { query: `${keywords[0]} trends`, growth: "+190%" },
    ],
    geoData: [
      { location: "United States", value: 100 },
      { location: "United Kingdom", value: 78 },
      { location: "Canada", value: 65 },
      { location: "Australia", value: 58 },
      { location: "Germany", value: 52 },
    ],
    source: "Simulated Data (Add SERPAPI_KEY for real trends)",
    timestamp: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  Extract keywords from brief                                        */
/* ------------------------------------------------------------------ */

function extractKeywords(brief: string): string[] {
  // Remove common words and extract meaningful keywords
  const commonWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "as",
    "is",
    "was",
    "are",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "should",
    "could",
    "may",
    "might",
    "must",
    "can",
    "campaign",
    "marketing",
    "create",
    "launch",
    "promote",
  ]);

  const words = brief
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !commonWords.has(w));

  // Get unique words and take top 3
  const unique = Array.from(new Set(words)).slice(0, 3);
  
  // If we have less than 3, add generic marketing terms
  if (unique.length === 0) {
    return ["digital marketing", "social media", "content marketing"];
  }
  
  return unique;
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { brief, keywords: providedKeywords } = body;

    if (!brief && !providedKeywords) {
      return Response.json({ error: "Brief or keywords required" }, { status: 400 });
    }

    const keywords = providedKeywords || extractKeywords(brief);
    
    // Try to get real data from SerpApi
    let trendsData = await getGoogleTrends(keywords);

    // Fallback to simulated data if API fails or no key
    if (!trendsData) {
      trendsData = generateFallbackTrends(keywords);
    }

    return Response.json({
      success: true,
      data: trendsData,
      hasRealData: !!SERPAPI_KEY,
      message: SERPAPI_KEY
        ? "Real-time data from Google Trends"
        : "Add SERPAPI_KEY to .env.local for live trends data (100 free searches/month at serpapi.com)",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Trends API failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
