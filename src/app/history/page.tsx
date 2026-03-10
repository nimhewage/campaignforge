"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft, Trash2, Search, TrendingUp, PenLine,
  Target, FileText, Clock, Star, Download,
  Clipboard, ClipboardCheck, ChevronRight, Shuffle, Link, Check, Loader2,
} from "lucide-react";
import { loadCampaigns, deleteCampaign, type SavedCampaign } from "@/lib/storage";
import { stripMd } from "@/lib/stripMd";

/* ------------------------------------------------------------------ */
/*  Markdown renderer (reused from CampaignOutput)                    */
/* ------------------------------------------------------------------ */

function Md({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }) => (
          <h2 className="text-[14px] font-bold text-tx-0 mt-6 mb-2 pb-2 border-b border-edge">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-[12px] font-semibold text-tx-0 mt-4 mb-1.5 flex items-center gap-2">
            <span className="w-[3px] h-3.5 rounded-full bg-brand" />
            <span>{children}</span>
          </h3>
        ),
        p: ({ children }) => <p className="text-[13px] text-tx-1 leading-relaxed mb-2">{children}</p>,
        ul: ({ children }) => <ul className="space-y-0.5 mb-2">{children}</ul>,
        ol: ({ children }) => <ol className="space-y-0.5 mb-2">{children}</ol>,
        li: ({ children }) => (
          <div className="flex gap-2 ml-1">
            <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-brand/60 flex-shrink-0" />
            <div className="text-[13px] text-tx-1 leading-relaxed">{children}</div>
          </div>
        ),
        strong: ({ children }) => <strong className="text-tx-0 font-semibold">{children}</strong>,
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto rounded-lg border border-edge">
            <table className="w-full text-[11px]">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-surface-2/60">{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr className="border-b border-edge last:border-0">{children}</tr>,
        th: ({ children }) => <th className="text-left py-2 px-3 text-tx-0 font-semibold">{children}</th>,
        td: ({ children }) => <td className="py-2 px-3 text-tx-2">{children}</td>,
        hr: () => <hr className="border-edge my-4" />,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

/* ------------------------------------------------------------------ */
/*  Copy button                                                        */
/* ------------------------------------------------------------------ */

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); }}
      className="flex items-center gap-1 text-[10px] text-tx-4 hover:text-tx-2 px-2 py-1 rounded border border-edge hover:border-edge-b transition-colors cursor-pointer"
    >
      {done ? <ClipboardCheck className="w-3 h-3 text-ok" /> : <Clipboard className="w-3 h-3" />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab definitions                                                    */
/* ------------------------------------------------------------------ */

const TABS = [
  { id: "research", label: "Research", icon: Search },
  { id: "trends", label: "Trends", icon: TrendingUp },
  { id: "content", label: "Content", icon: PenLine },
  { id: "strategy", label: "Strategy", icon: Target },
  { id: "report", label: "Report", icon: FileText },
] as const;

type TabId = typeof TABS[number]["id"];

/* ------------------------------------------------------------------ */
/*  Campaign detail view                                               */
/* ------------------------------------------------------------------ */

function CampaignDetail({ campaign, onBack, onDelete }: {
  campaign: SavedCampaign;
  onBack: () => void;
  onDelete: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("research");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const data = campaign.campaign;

  const handleShare = async () => {
    if (shareUrl) {
      navigator.clipboard.writeText(window.location.origin + shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
      return;
    }
    setShareLoading(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign: data,
          plan: { campaign_name: campaign.campaignName, big_idea: campaign.bigIdea },
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const result = await res.json();
      setShareUrl(result.url);
      navigator.clipboard.writeText(window.location.origin + result.url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch { /* silent */ } finally {
      setShareLoading(false);
    }
  };

  const handleRemix = () => {
    const remixBrief = `[REMIX of "${campaign.campaignName}"]\n\n${campaign.brief}\n\nPlease improve upon the previous campaign strategy. Key learnings: ${campaign.bigIdea || "Apply fresh insights."}`;
    const params = new URLSearchParams({ brief: remixBrief });
    window.location.href = `/?${params}`;
  };

  const getContent = (tab: TabId): string | undefined => {
    return data[tab as keyof typeof data] as string | undefined;
  };

  // Auto-select first available tab
  const firstAvailable = TABS.find((t) => !!getContent(t.id));
  const effectiveTab = getContent(activeTab) ? activeTab : (firstAvailable?.id || "research");
  const content = getContent(effectiveTab);

  const handleDownload = () => {
    const parts: string[] = [
      `# ${campaign.campaignName} — Campaign Brief`,
      `_Generated by CampaignForge | ${new Date(campaign.createdAt).toLocaleDateString()}_\n`,
    ];
    if (campaign.bigIdea) parts.push(`> **Big Idea:** ${campaign.bigIdea}\n`);
    if (data.research) parts.push(`---\n## Market Research\n${data.research}`);
    if (data.trends) parts.push(`\n---\n## Trend Analysis\n${data.trends}`);
    if (data.strategy) parts.push(`\n---\n## Campaign Strategy\n${data.strategy}`);
    if (data.content) parts.push(`\n---\n## Creative Content\n${data.content}`);
    if (data.report) parts.push(`\n---\n## Executive Report\n${data.report}`);

    const blob = new Blob([parts.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${campaign.campaignName.replace(/[^\w\s-]/g, "").slice(0, 40)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[12px] text-tx-3 hover:text-tx-1 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          All campaigns
        </button>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleRemix}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-edge text-[11px] text-tx-3 hover:text-brand hover:border-brand/20 transition-all cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5" />
            Remix
          </button>
          <button
            onClick={handleShare}
            disabled={shareLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-edge text-[11px] text-tx-3 hover:text-tx-1 hover:border-edge-b transition-all cursor-pointer disabled:opacity-50"
          >
            {shareCopied ? <Check className="w-3.5 h-3.5 text-ok" /> : shareLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link className="w-3.5 h-3.5" />}
            {shareCopied ? "Copied!" : shareUrl ? "Copy link" : "Share"}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-edge text-[11px] text-tx-3 hover:text-tx-1 hover:border-edge-b transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-fail/20 text-[11px] text-fail/70 hover:text-fail hover:border-fail/40 hover:bg-fail/5 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>

      {/* Campaign header */}
      <div className="glass-card p-5">
        <p className="text-[10px] font-medium text-brand uppercase tracking-widest mb-1">
          {new Date(campaign.createdAt).toLocaleString()}
          {campaign.feedbackRating && (
            <span className="ml-3 text-amber-400">
              {"★".repeat(campaign.feedbackRating)}{"☆".repeat(5 - campaign.feedbackRating)}
            </span>
          )}
        </p>
        <h2 className="text-xl font-bold text-tx-0 leading-tight">{campaign.campaignName}</h2>
        {campaign.bigIdea && (
          <p className="mt-2 text-[13px] text-tx-2 italic">&ldquo;{stripMd(campaign.bigIdea)}&rdquo;</p>
        )}
        <p className="mt-3 text-[11px] text-tx-4 bg-surface-2/40 rounded-lg px-3 py-2 border border-edge">
          <span className="text-tx-3 font-medium">Brief: </span>
          {campaign.brief}
        </p>
      </div>

      {/* Tabs */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center border-b border-edge overflow-x-auto">
          {TABS.map((tab) => {
            const hasData = !!getContent(tab.id);
            const isActive = effectiveTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => hasData && setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-3 text-[12px] font-medium whitespace-nowrap transition-all ${
                  !hasData ? "text-tx-4/40 cursor-default" : "cursor-pointer"
                } ${isActive ? "text-brand-bright" : hasData ? "text-tx-2 hover:text-tx-0" : ""}`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                {tab.label}
                {hasData && !isActive && <span className="w-1.5 h-1.5 rounded-full bg-ok" />}
                {isActive && <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-brand" />}
              </button>
            );
          })}
          <div className="ml-auto pr-3">
            {content && <CopyBtn text={content} />}
          </div>
        </div>
        <div className="p-5">
          {content ? <Md text={content} /> : (
            <p className="text-[12px] text-tx-4 text-center py-8">No content for this section.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Campaign list item                                                 */
/* ------------------------------------------------------------------ */

function CampaignCard({ campaign, onClick, onDelete }: {
  campaign: SavedCampaign;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const sectionCount = ["research", "trends", "content", "strategy", "report"]
    .filter((k) => !!campaign.campaign[k as keyof typeof campaign.campaign]).length;

  return (
    <div
      onClick={onClick}
      className="glass-card p-4 cursor-pointer hover:border-brand/20 transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[13px] font-semibold text-tx-0 truncate group-hover:text-brand-bright transition-colors">
              {campaign.campaignName}
            </h3>
            {campaign.feedbackRating && (
              <span className="text-amber-400 text-[10px] flex-shrink-0">
                {"★".repeat(campaign.feedbackRating)}
              </span>
            )}
          </div>
          {campaign.bigIdea && (
            <p className="text-[11px] text-tx-2 italic mb-2 truncate">{stripMd(campaign.bigIdea)}</p>
          )}
          <p className="text-[12px] text-tx-2 line-clamp-2">{stripMd(campaign.brief)}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-[10px] text-tx-4">
              <Clock className="w-3 h-3" />
              {new Date(campaign.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <span className="text-[10px] text-tx-4">{sectionCount} sections</span>
            {campaign.feedbackRating && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400/70">
                <Star className="w-3 h-3" />
                {["", "Poor", "Fair", "Good", "Great", "Excellent"][campaign.feedbackRating]}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md text-tx-4 hover:text-fail hover:bg-fail/10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <ChevronRight className="w-4 h-4 text-tx-4 group-hover:text-brand transition-colors" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main history page                                                  */
/* ------------------------------------------------------------------ */

export default function HistoryPage() {
  const [campaigns, setCampaigns] = useState<SavedCampaign[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setCampaigns(loadCampaigns());
  }, []);

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    deleteCampaign(id);
    setCampaigns(loadCampaigns());
    if (selected === id) setSelected(null);
  };

  const filtered = campaigns.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.campaignName.toLowerCase().includes(q) ||
      c.brief.toLowerCase().includes(q) ||
      c.bigIdea?.toLowerCase().includes(q)
    );
  });

  const selectedCampaign = selected ? campaigns.find((c) => c.id === selected) : null;

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface-0/70 backdrop-blur-xl border-b border-edge">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="flex items-center gap-1.5 text-[12px] text-tx-3 hover:text-brand transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to CampaignForge
            </a>
            <span className="text-edge">|</span>
            <span className="text-[14px] font-semibold text-tx-0">Campaign History</span>
          </div>
          <span className="text-[11px] text-tx-4">{campaigns.length} saved</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 py-6">
        {selectedCampaign ? (
          <CampaignDetail
            campaign={selectedCampaign}
            onBack={() => setSelected(null)}
            onDelete={() => handleDelete(selectedCampaign.id)}
          />
        ) : (
          <div className="space-y-4">
            {/* Search */}
            {campaigns.length > 0 && (
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tx-4" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search campaigns..."
                  className="w-full pl-9 pr-4 py-2.5 text-[13px] bg-surface-1 border border-edge rounded-xl text-tx-1 placeholder:text-tx-4 focus:outline-none focus:border-brand/30 transition-colors"
                />
              </div>
            )}

            {/* Empty state */}
            {campaigns.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-brand/40" />
                </div>
                <h2 className="text-[15px] font-semibold text-tx-1 mb-2">No campaigns saved yet</h2>
                <p className="text-[12px] text-tx-4 mb-6">
                  Campaigns are automatically saved when complete.
                </p>
                <a
                  href="/"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20 hover:brightness-110 transition-all cursor-pointer"
                >
                  Create your first campaign
                </a>
              </div>
            ) : filtered.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <p className="text-[13px] text-tx-3">No campaigns match &ldquo;{search}&rdquo;</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((c) => (
                  <CampaignCard
                    key={c.id}
                    campaign={c}
                    onClick={() => setSelected(c.id)}
                    onDelete={(e) => handleDelete(c.id, e)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
