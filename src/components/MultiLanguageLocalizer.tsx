"use client";

import { useState } from "react";
import { Globe, Loader2, Download, X, Copy, Check } from "lucide-react";
import type { CampaignData, PlanData } from "@/app/page";

const MARKETS = [
  { code: "AU", label: "Australia", lang: "en-AU", currency: "AUD", emoji: "AU" },
  { code: "UK", label: "United Kingdom", lang: "en-GB", currency: "GBP", emoji: "UK" },
  { code: "US", label: "United States", lang: "en-US", currency: "USD", emoji: "US" },
  { code: "SG", label: "Singapore", lang: "en-SG", currency: "SGD", emoji: "SG" },
  { code: "CA", label: "Canada", lang: "en-CA", currency: "CAD", emoji: "CA" },
  { code: "IN", label: "India", lang: "en-IN", currency: "INR", emoji: "IN" },
  { code: "DE", label: "Germany", lang: "de", currency: "EUR", emoji: "DE" },
  { code: "FR", label: "France", lang: "fr", currency: "EUR", emoji: "FR" },
  { code: "JP", label: "Japan", lang: "ja", currency: "JPY", emoji: "JP" },
  { code: "BR", label: "Brazil", lang: "pt-BR", currency: "BRL", emoji: "BR" },
];

interface LocalizedCampaign {
  market: string;
  marketCode: string;
  content: string;
  notes: string;
  generatedAt: number;
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="flex items-center gap-1 text-[10px] text-tx-4 hover:text-tx-2 px-2 py-1 rounded border border-edge transition-colors cursor-pointer"
    >
      {done ? <Check className="w-3 h-3 text-ok" /> : <Copy className="w-3 h-3" />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

export default function MultiLanguageLocalizer({
  open,
  onClose,
  campaign,
  plan,
}: {
  open: boolean;
  onClose: () => void;
  campaign: CampaignData | null;
  plan: PlanData | null;
}) {
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [localizedResults, setLocalizedResults] = useState<LocalizedCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeResult, setActiveResult] = useState<string | null>(null);

  const toggleMarket = (code: string) => {
    setSelectedMarkets((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code].slice(0, 4)
    );
  };

  const handleLocalize = async () => {
    if (!campaign || selectedMarkets.length === 0) return;
    setLoading(true);

    try {
      const results: LocalizedCampaign[] = [];
      for (const code of selectedMarkets) {
        const market = MARKETS.find((m) => m.code === code);
        if (!market) continue;

        const res = await fetch("/api/localize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brief: campaign.brief,
            content: campaign.content,
            strategy: campaign.strategy,
            targetMarket: market.label,
            targetLang: market.lang,
            currency: market.currency,
            planName: plan?.campaign_name,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          results.push({
            market: market.label,
            marketCode: code,
            content: data.content,
            notes: data.notes,
            generatedAt: Date.now(),
          });
        }
      }
      setLocalizedResults(results);
      if (results.length > 0) setActiveResult(results[0].marketCode);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  const handleDownload = (result: LocalizedCampaign) => {
    const blob = new Blob([result.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign-${result.marketCode.toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  const activeResult_ = localizedResults.find((r) => r.marketCode === activeResult);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl glass-card rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge flex-shrink-0">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-brand" />
            <h2 className="text-[14px] font-semibold text-tx-0">Multi-Market Localizer</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-tx-4 hover:text-tx-1 hover:bg-surface-2/60 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="p-5 space-y-5">
            {/* Market selector */}
            <div>
              <p className="text-[12px] text-tx-2 mb-3">
                Select up to 4 markets to localize your campaign for. We&apos;ll adapt copy, pricing, cultural references, and platform preferences.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MARKETS.map((m) => {
                  const selected = selectedMarkets.includes(m.code);
                  return (
                    <button
                      key={m.code}
                      onClick={() => toggleMarket(m.code)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        selected
                          ? "border-brand/30 bg-brand/8 text-tx-0"
                          : "border-edge bg-surface-1 text-tx-3 hover:text-tx-1 hover:border-edge-b"
                      }`}
                    >
                      <span className="text-[16px]">{m.emoji}</span>
                      <div>
                        <p className="text-[11px] font-semibold">{m.label}</p>
                        <p className="text-[9px] text-tx-4">{m.currency} · {m.lang}</p>
                      </div>
                      {selected && <div className="ml-auto w-2 h-2 rounded-full bg-brand" />}
                    </button>
                  );
                })}
              </div>
              {selectedMarkets.length >= 4 && (
                <p className="text-[10px] text-amber-400 mt-2">Max 4 markets per run.</p>
              )}
            </div>

            {/* Generate button */}
            <button
              onClick={handleLocalize}
              disabled={loading || selectedMarkets.length === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20 hover:brightness-110 transition-all disabled:opacity-30 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Localizing {selectedMarkets.length} market{selectedMarkets.length > 1 ? "s" : ""}...
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4" />
                  Localize Campaign
                </>
              )}
            </button>

            {/* Results */}
            {localizedResults.length > 0 && (
              <div className="space-y-3">
                {/* Market tabs */}
                <div className="flex gap-1.5 flex-wrap">
                  {localizedResults.map((r) => (
                    <button
                      key={r.marketCode}
                      onClick={() => setActiveResult(r.marketCode)}
                      className={`text-[11px] font-medium px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        activeResult === r.marketCode
                          ? "border-brand/30 bg-brand/10 text-brand-bright"
                          : "border-edge text-tx-3 hover:text-tx-1"
                      }`}
                    >
                      {r.marketCode} — {r.market}
                    </button>
                  ))}
                </div>

                {/* Active result */}
                {activeResult_ && (
                  <div className="rounded-xl border border-edge overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-surface-2/30 border-b border-edge">
                      <p className="text-[11px] font-semibold text-tx-1">{activeResult_.market} Adaptation</p>
                      <div className="flex gap-2">
                        <CopyBtn text={activeResult_.content} />
                        <button
                          onClick={() => handleDownload(activeResult_)}
                          className="flex items-center gap-1 text-[10px] text-tx-4 hover:text-tx-2 px-2 py-1 rounded border border-edge transition-colors cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </button>
                      </div>
                    </div>
                    {activeResult_.notes && (
                      <div className="px-4 py-2.5 bg-amber-500/5 border-b border-amber-500/15">
                        <p className="text-[10px] text-amber-400">{activeResult_.notes}</p>
                      </div>
                    )}
                    <div className="p-4 max-h-80 overflow-y-auto">
                      <pre className="text-[11px] text-tx-2 whitespace-pre-wrap leading-relaxed font-sans">
                        {activeResult_.content}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
