/* ------------------------------------------------------------------ */
/*  Shared trends logic — called directly from campaign route          */
/*  (avoids the localhost:3000 HTTP self-call bug)                     */
/* ------------------------------------------------------------------ */

const SERPAPI_KEY = process.env.SERPAPI_KEY;

export interface TrendsData {
  keywords: string[];
  interestOverTime: Array<{ date: string; value: number }>;
  relatedQueries: Array<{ query: string; value: number }>;
  relatedTopics: Array<{ topic: string; value: number }>;
  risingQueries: Array<{ query: string; growth: string }>;
  geoData: Array<{ location: string; value: number }>;
  source: string;
  timestamp: string;
  isSimulated: boolean;
}

/* ------------------------------------------------------------------ */
/*  SerpApi – Google Trends                                            */
/* ------------------------------------------------------------------ */

export async function getGoogleTrends(keywords: string[]): Promise<TrendsData | null> {
  if (!SERPAPI_KEY) return null;

  try {
    const query = keywords.slice(0, 5).join(",");
    const params = new URLSearchParams({
      engine: "google_trends",
      q: query,
      data_type: "TIMESERIES",
      api_key: SERPAPI_KEY,
    });

    const res = await fetch(`https://serpapi.com/search?${params}`);
    if (!res.ok) throw new Error(`SerpApi error: ${res.status}`);
    const data = await res.json();

    const interestOverTime =
      data.interest_over_time?.timeline_data?.map((item: Record<string, unknown>) => ({
        date: item.date as string,
        value: (item.values as Array<{ extracted_value?: number }>)?.[0]?.extracted_value || 0,
      })) || [];

    const relatedRes = await fetch(
      `https://serpapi.com/search?${new URLSearchParams({
        engine: "google_trends",
        q: keywords[0],
        data_type: "RELATED_QUERIES",
        api_key: SERPAPI_KEY,
      })}`
    );
    const relatedData = relatedRes.ok ? await relatedRes.json() : {};

    const relatedQueries =
      relatedData.related_queries?.top?.map((item: Record<string, unknown>) => ({
        query: item.query as string,
        value: (item.extracted_value as number) || 0,
      })) || [];

    const risingQueries =
      relatedData.related_queries?.rising?.map((item: Record<string, unknown>) => ({
        query: item.query as string,
        growth: String(item.extracted_value || "Breakout"),
      })) || [];

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
      geoData.interest_by_region?.map((item: Record<string, unknown>) => ({
        location: item.location as string,
        value: (item.extracted_value as number) || 0,
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
      isSimulated: false,
    };
  } catch (err) {
    console.error("Google Trends API error:", err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Fallback — clearly labelled simulated data                         */
/* ------------------------------------------------------------------ */

export function generateFallbackTrends(keywords: string[]): TrendsData {
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
    source: "SIMULATED DATA — Add SERPAPI_KEY to .env.local for real Google Trends",
    timestamp: new Date().toISOString(),
    isSimulated: true,
  };
}

/* ------------------------------------------------------------------ */
/*  Extract keywords from brief                                         */
/* ------------------------------------------------------------------ */

export function extractKeywords(brief: string): string[] {
  const commonWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "should", "could", "may", "might", "must", "can", "campaign",
    "marketing", "create", "launch", "promote", "our", "their", "this",
    "that", "we", "need", "want",
  ]);

  const words = brief
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !commonWords.has(w));

  const unique = Array.from(new Set(words)).slice(0, 3);
  if (unique.length === 0) return ["digital marketing", "social media", "content marketing"];
  return unique;
}

/* ------------------------------------------------------------------ */
/*  Main entry — always returns data (real or simulated)               */
/* ------------------------------------------------------------------ */

export async function getTrendsData(brief: string): Promise<TrendsData> {
  const keywords = extractKeywords(brief);
  const real = await getGoogleTrends(keywords);
  return real ?? generateFallbackTrends(keywords);
}
