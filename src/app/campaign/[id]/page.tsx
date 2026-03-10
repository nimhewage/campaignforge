"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Layers, Search, TrendingUp, PenLine, Target, FileText,
  Users, Mail, Layout, Loader2, AlertTriangle, ExternalLink,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PersonaCards from "@/components/PersonaCards";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
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

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

interface Tab { id: string; label: string; icon: LucideIcon; field: keyof SharedCampaign }

const TABS: Tab[] = [
  { id: "research", label: "Research", icon: Search, field: "research" },
  { id: "trends", label: "Trends", icon: TrendingUp, field: "trends" },
  { id: "content", label: "Content", icon: PenLine, field: "content" },
  { id: "strategy", label: "Strategy", icon: Target, field: "strategy" },
  { id: "report", label: "Report", icon: FileText, field: "report" },
  { id: "personas", label: "Personas", icon: Users, field: "personas" },
  { id: "emailSequence", label: "Email Sequence", icon: Mail, field: "emailSequence" },
  { id: "landingPage", label: "Landing Page", icon: Layout, field: "landingPage" },
];

/* ------------------------------------------------------------------ */
/*  Markdown renderer                                                  */
/* ------------------------------------------------------------------ */

function Md({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }) => (
          <h2 className="text-[15px] font-bold text-tx-0 mt-7 mb-2 pb-2 border-b border-edge">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-[13px] font-semibold text-tx-0 mt-5 mb-1.5 flex items-center gap-2">
            <span className="w-[3px] h-4 rounded-full bg-gradient-to-b from-brand to-violet-500" />
            <span>{children}</span>
          </h3>
        ),
        p: ({ children }) => <p className="text-[12.5px] text-tx-2 leading-relaxed mb-3">{children}</p>,
        ul: ({ children }) => <ul className="space-y-0.5 mb-3">{children}</ul>,
        li: ({ children }) => (
          <div className="flex gap-2.5 ml-1">
            <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-brand/40 flex-shrink-0" />
            <div className="text-[12.5px] text-tx-2 leading-relaxed">{children}</div>
          </div>
        ),
        strong: ({ children }) => <strong className="text-tx-0 font-semibold">{children}</strong>,
        table: ({ children }) => (
          <div className="my-4 overflow-x-auto rounded-lg border border-edge">
            <table className="w-full text-[12px]">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-surface-2/60">{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr className="border-b border-edge last:border-0">{children}</tr>,
        th: ({ children }) => <th className="text-left py-2 px-3 text-tx-0 font-semibold border-b border-edge">{children}</th>,
        td: ({ children }) => <td className="py-2 px-3 text-tx-2">{children}</td>,
        hr: () => <hr className="border-edge my-5" />,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-brand/30 pl-4 my-3 text-tx-3 italic">{children}</blockquote>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function SharedCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<SharedCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("report");

  useEffect(() => {
    fetch(`/api/share?id=${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Campaign not found or link has expired.");
        return r.json();
      })
      .then((d) => {
        setCampaign(d);
        // Auto-select first available tab
        const first = TABS.find((t) => !!d[t.field]);
        if (first) setActiveTab(first.id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const availableTabs = TABS.filter((t) => campaign && !!campaign[t.field]);
  const activeContent = campaign ? campaign[TABS.find((t) => t.id === activeTab)?.field as keyof SharedCampaign] as string | undefined : undefined;

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface-0/80 backdrop-blur-xl border-b border-edge">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[14px] font-semibold text-tx-0">
              Botten<span className="text-brand">gram</span>
            </span>
            <span className="hidden sm:inline text-[11px] text-tx-4 bg-surface-2/60 border border-edge rounded-full px-2 py-0.5 ml-1">
              Shared Campaign
            </span>
          </div>
          <a
            href="/"
            className="flex items-center gap-1.5 text-[11px] font-medium text-tx-3 hover:text-brand transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3 h-3" />
            Create your own
          </a>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>
        ) : error ? (
          <div className="glass-card p-10 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h2 className="text-[16px] font-semibold text-tx-1 mb-2">{error}</h2>
            <p className="text-[12px] text-tx-4 mb-6">Shared links expire after 72 hours.</p>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20 hover:brightness-110 transition-all"
            >
              Create a new campaign
            </a>
          </div>
        ) : campaign ? (
          <div className="space-y-5">
            {/* Campaign header */}
            <div className="glass-card p-6 anim-fade-up">
              <p className="text-[10px] font-medium text-brand uppercase tracking-widest mb-1">
                {new Date(campaign.createdAt).toLocaleString()} · Read-only preview
              </p>
              <h1 className="text-2xl font-bold text-tx-0 leading-tight">{campaign.campaignName}</h1>
              {campaign.bigIdea && (
                <p className="mt-2 text-[13px] text-tx-2 italic">&ldquo;{campaign.bigIdea}&rdquo;</p>
              )}
              {campaign.brief && (
                <p className="mt-3 text-[11px] text-tx-4 bg-surface-2/40 rounded-lg px-3 py-2 border border-edge">
                  <span className="text-tx-3 font-medium">Brief: </span>
                  {campaign.brief}
                </p>
              )}
            </div>

            {/* Section grid — quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 anim-fade-up">
              {availableTabs.slice(0, 4).map((tab) => {
                const TabIcon = tab.icon;
                const wordCount = ((campaign[tab.field] as string) || "").split(/\s+/).filter(Boolean).length;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
                      activeTab === tab.id
                        ? "border-brand/30 bg-brand/8"
                        : "border-edge bg-surface-1 hover:border-edge-b"
                    }`}
                  >
                    <TabIcon className={`w-4 h-4 mb-1.5 ${activeTab === tab.id ? "text-brand" : "text-tx-4"}`} />
                    <p className={`text-[11px] font-semibold ${activeTab === tab.id ? "text-brand-bright" : "text-tx-1"}`}>
                      {tab.label}
                    </p>
                    <p className="text-[10px] text-tx-4">{wordCount.toLocaleString()} words</p>
                  </button>
                );
              })}
            </div>

            {/* Content viewer */}
            <div className="glass-card overflow-hidden anim-fade-up">
              <div className="flex items-center border-b border-edge overflow-x-auto">
                {availableTabs.map((tab) => {
                  const TabIcon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative flex items-center gap-1.5 px-4 py-3 text-[12px] font-medium whitespace-nowrap transition-all cursor-pointer ${
                        isActive ? "text-brand-bright" : "text-tx-2 hover:text-tx-0"
                      }`}
                    >
                      <TabIcon className="w-3.5 h-3.5" />
                      {tab.label}
                      {!isActive && <span className="w-1.5 h-1.5 rounded-full bg-ok" />}
                      {isActive && <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-brand" />}
                    </button>
                  );
                })}
              </div>
              <div className="p-5">
                {activeContent ? (
                  activeTab === "personas" ? (
                    <PersonaCards text={activeContent} />
                  ) : (
                    <Md text={activeContent} />
                  )
                ) : (
                  <p className="text-[12px] text-tx-4 text-center py-8">No content for this section.</p>
                )}
              </div>
            </div>

            {/* Footer CTA */}
            <div className="glass-card p-5 text-center">
              <p className="text-[12px] text-tx-3 mb-3">
                Want a full AI-powered campaign like this for your brand?
              </p>
              <a
                href="/"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20 hover:brightness-110 transition-all cursor-pointer"
              >
                Build your campaign free
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
