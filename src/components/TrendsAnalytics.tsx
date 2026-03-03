"use client";

import { useMemo, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, Globe, Hash, Sparkles, 
  ArrowUpRight, Flame, Search, MapPin, Activity,
} from "lucide-react";

interface Props {
  trendsText: string;
}

interface KeywordData {
  text: string;
  value: number;
  growth?: string;
  isRising?: boolean;
}

interface TrendPoint {
  date: string;
  value: number;
  label?: string;
}

interface GeoData {
  location: string;
  value: number;
  rank: number;
}

/* ------------------------------------------------------------------ */
/*  Extract structured data from trends text                          */
/* ------------------------------------------------------------------ */

function extractTrendsData(text: string) {
  const keywords: KeywordData[] = [];
  const risingQueries: KeywordData[] = [];
  const geoData: GeoData[] = [];
  const timeSeriesData: TrendPoint[] = [];
  
  const lines = text.split("\n");
  let inTimeSeriesSection = false;
  let inRisingSection = false;
  let inGeoSection = false;
  let inKeywordSection = false;

  lines.forEach((line) => {
    const trimmed = line.trim();
    
    // Detect sections
    if (/interest over time/i.test(trimmed)) {
      inTimeSeriesSection = true;
      inRisingSection = false;
      inGeoSection = false;
      inKeywordSection = false;
      return;
    }
    if (/rising queries|breakout/i.test(trimmed)) {
      inRisingSection = true;
      inTimeSeriesSection = false;
      inGeoSection = false;
      inKeywordSection = false;
      return;
    }
    if (/geographic|geo_data|top regions/i.test(trimmed)) {
      inGeoSection = true;
      inTimeSeriesSection = false;
      inRisingSection = false;
      inKeywordSection = false;
      return;
    }
    if (/hashtag|keyword strategy|seo keywords/i.test(trimmed)) {
      inKeywordSection = true;
      inTimeSeriesSection = false;
      inRisingSection = false;
      inGeoSection = false;
      return;
    }
    
    // Parse time series: "2025-01: 75%"
    if (inTimeSeriesSection) {
      const tsMatch = trimmed.match(/(\d{4}-\d{2}|\w+ \d{4}).*?(\d+)%/);
      if (tsMatch && timeSeriesData.length < 12) {
        timeSeriesData.push({
          date: tsMatch[1],
          value: parseInt(tsMatch[2]),
        });
      }
    }
    
    // Parse rising queries: "1. "AI marketing" - Growth: +350%"
    if (inRisingSection) {
      const risingMatch = trimmed.match(/["']([^"']+)["'].*?(?:Growth:|:)\s*([+\d]+%|Breakout)/i);
      if (risingMatch && risingQueries.length < 8) {
        risingQueries.push({
          text: risingMatch[1],
          value: 100,
          growth: risingMatch[2],
          isRising: true,
        });
      }
    }
    
    // Parse geo data: "1. United States: 100%"
    if (inGeoSection) {
      const geoMatch = trimmed.match(/\d+\.\s*([^:]+):\s*(\d+)%/);
      if (geoMatch && geoData.length < 10) {
        geoData.push({
          location: geoMatch[1].trim(),
          value: parseInt(geoMatch[2]),
          rank: geoData.length + 1,
        });
      }
    }
    
    // Parse keywords/hashtags
    if (inKeywordSection) {
      const hashMatch = trimmed.match(/#(\w+)/);
      if (hashMatch && keywords.length < 20) {
        keywords.push({
          text: hashMatch[1],
          value: Math.floor(Math.random() * 50) + 50,
        });
      }
      
      // Also match quoted keywords
      const keyMatch = trimmed.match(/["']([^"']+)["']/);
      if (keyMatch && keywords.length < 20 && !keywords.find(k => k.text === keyMatch[1])) {
        keywords.push({
          text: keyMatch[1],
          value: Math.floor(Math.random() * 50) + 50,
        });
      }
    }
  });

  return { keywords, risingQueries, geoData, timeSeriesData };
}

/* ------------------------------------------------------------------ */
/*  Keyword Cloud Component                                            */
/* ------------------------------------------------------------------ */

function KeywordCloud({ keywords }: { keywords: KeywordData[] }) {
  if (keywords.length === 0) return null;

  const sorted = [...keywords].sort((a, b) => b.value - a.value);
  
  return (
    <div className="flex flex-wrap gap-2">
      {sorted.map((kw, i) => {
        const size = kw.value > 80 ? "large" : kw.value > 60 ? "medium" : "small";
        const sizeClasses = {
          large: "text-[16px] px-4 py-2.5",
          medium: "text-[13px] px-3 py-2",
          small: "text-[11px] px-2.5 py-1.5",
        };
        
        return (
          <div
            key={i}
            className={`${sizeClasses[size]} rounded-full bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-brand/20 text-tx-1 font-medium hover:border-brand/40 hover:scale-105 transition-all cursor-default`}
          >
            {kw.isRising && <Flame className="inline w-3 h-3 text-orange-400 mr-1" />}
            {kw.text}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Rising Queries Showcase                                            */
/* ------------------------------------------------------------------ */

function RisingQueriesShowcase({ queries }: { queries: KeywordData[] }) {
  if (queries.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {queries.map((q, i) => {
        const isBreakout = q.growth?.toLowerCase() === "breakout";
        const growthNum = q.growth ? parseInt(q.growth.replace(/[^\d]/g, "")) : 0;
        
        return (
          <div
            key={i}
            className="relative overflow-hidden rounded-xl border border-edge bg-gradient-to-br from-surface-1 to-surface-2/40 p-4 hover:border-brand/30 transition-all group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Search className="w-3.5 h-3.5 text-brand flex-shrink-0" />
                  <p className="text-[13px] font-semibold text-tx-0 truncate">
                    {q.text}
                  </p>
                </div>
                <p className="text-[10px] text-tx-4 uppercase tracking-widest">
                  Rising Query
                </p>
              </div>
              
              <div className="flex flex-col items-end">
                {isBreakout ? (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-orange-500/20 border border-orange-500/30">
                    <Flame className="w-3 h-3 text-orange-400" />
                    <span className="text-[10px] font-bold text-orange-300 uppercase">
                      Breakout
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-ok">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-[14px] font-bold">{q.growth}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Growth indicator bar */}
            <div className="mt-3 h-1 bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand to-ok rounded-full transition-all duration-1000"
                style={{ width: isBreakout ? "100%" : `${Math.min(growthNum, 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Geographic Heatmap                                                 */
/* ------------------------------------------------------------------ */

function GeographicHeatmap({ geoData }: { geoData: GeoData[] }) {
  if (geoData.length === 0) return null;

  const maxValue = Math.max(...geoData.map(g => g.value));
  
  return (
    <div className="space-y-2">
      {geoData.map((geo, i) => {
        const percentage = (geo.value / maxValue) * 100;
        const intensity = geo.value > 80 ? "high" : geo.value > 50 ? "medium" : "low";
        
        return (
          <div key={i} className="group">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-brand w-5">#{geo.rank}</span>
                <MapPin className="w-3 h-3 text-tx-3" />
                <span className="text-[12px] font-medium text-tx-1">{geo.location}</span>
              </div>
              <span className="text-[12px] font-bold text-brand">{geo.value}%</span>
            </div>
            
            <div className="relative h-2 bg-surface-3 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  intensity === "high"
                    ? "bg-gradient-to-r from-brand to-violet-500"
                    : intensity === "medium"
                    ? "bg-gradient-to-r from-indigo-400 to-brand"
                    : "bg-gradient-to-r from-indigo-300 to-indigo-400"
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function TrendsAnalytics({ trendsText }: Props) {
  const data = useMemo(() => extractTrendsData(trendsText), [trendsText]);
  const [activeMetric, setActiveMetric] = useState<"interest" | "growth">("interest");
  
  const hasTimeSeries = data.timeSeriesData.length > 0;
  const hasRising = data.risingQueries.length > 0;
  const hasGeo = data.geoData.length > 0;
  const hasKeywords = data.keywords.length > 0;

  // Calculate trend direction
  const trendDirection = useMemo(() => {
    if (data.timeSeriesData.length < 2) return "neutral";
    const recent = data.timeSeriesData.slice(-3);
    const avg = recent.reduce((sum, d) => sum + d.value, 0) / recent.length;
    const first = data.timeSeriesData[0].value;
    return avg > first * 1.1 ? "up" : avg < first * 0.9 ? "down" : "neutral";
  }, [data.timeSeriesData]);

  if (!hasTimeSeries && !hasRising && !hasGeo && !hasKeywords) {
    return null;
  }

  return (
    <div className="space-y-5 mb-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Trend Direction */}
        <div className="glass-card p-4 anim-fade-up">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-tx-4 uppercase tracking-widest mb-1">
                Trend Direction
              </p>
              <p className="text-[20px] font-bold text-tx-0 flex items-center gap-2">
                {trendDirection === "up" && (
                  <>
                    <TrendingUp className="w-5 h-5 text-ok" />
                    <span className="text-ok">Rising</span>
                  </>
                )}
                {trendDirection === "down" && (
                  <>
                    <TrendingDown className="w-5 h-5 text-fail" />
                    <span className="text-fail">Declining</span>
                  </>
                )}
                {trendDirection === "neutral" && (
                  <>
                    <Activity className="w-5 h-5 text-brand" />
                    <span className="text-brand">Stable</span>
                  </>
                )}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-brand" />
            </div>
          </div>
        </div>

        {/* Rising Queries Count */}
        <div className="glass-card p-4 anim-fade-up" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-tx-4 uppercase tracking-widest mb-1">
                Breakout Keywords
              </p>
              <p className="text-[20px] font-bold text-tx-0">
                {data.risingQueries.length}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Flame className="w-6 h-6 text-orange-400" />
            </div>
          </div>
        </div>

        {/* Geographic Reach */}
        <div className="glass-card p-4 anim-fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-tx-4 uppercase tracking-widest mb-1">
                Top Markets
              </p>
              <p className="text-[20px] font-bold text-tx-0">
                {data.geoData.length}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Globe className="w-6 h-6 text-violet-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Search Interest Over Time */}
      {hasTimeSeries && (
        <div className="glass-card p-5 anim-fade-up" style={{ animationDelay: "0.15s" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand" />
              <h4 className="text-[12px] font-semibold text-tx-0 uppercase tracking-widest">
                Search Interest Over Time
              </h4>
            </div>
            <div className="text-[10px] text-tx-4">Last 12 months</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorInterest" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#9ca3af", fontSize: 10 }}
                axisLine={{ stroke: "#ffffff15" }}
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 10 }}
                axisLine={{ stroke: "#ffffff15" }}
                label={{ value: "Interest", angle: -90, position: "insideLeft", style: { fill: "#9ca3af", fontSize: 10 } }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#colorInterest)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Rising Queries */}
      {hasRising && (
        <div className="glass-card p-5 anim-fade-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-orange-400" />
            <h4 className="text-[12px] font-semibold text-tx-0 uppercase tracking-widest">
              Rising Queries & Breakout Keywords
            </h4>
          </div>
          <RisingQueriesShowcase queries={data.risingQueries} />
        </div>
      )}

      {/* Geographic Distribution */}
      {hasGeo && (
        <div className="glass-card p-5 anim-fade-up" style={{ animationDelay: "0.25s" }}>
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-violet-400" />
            <h4 className="text-[12px] font-semibold text-tx-0 uppercase tracking-widest">
              Geographic Interest
            </h4>
          </div>
          <GeographicHeatmap geoData={data.geoData} />
        </div>
      )}

      {/* Keyword Cloud */}
      {hasKeywords && (
        <div className="glass-card p-5 anim-fade-up" style={{ animationDelay: "0.3s" }}>
          <div className="flex items-center gap-2 mb-4">
            <Hash className="w-4 h-4 text-brand" />
            <h4 className="text-[12px] font-semibold text-tx-0 uppercase tracking-widest">
              Trending Keywords & Hashtags
            </h4>
          </div>
          <KeywordCloud keywords={data.keywords} />
        </div>
      )}
    </div>
  );
}
