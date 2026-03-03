"use client";

import type { CampaignData } from "@/app/page";
import React, { useState } from "react";
import {
  Search, TrendingUp, PenLine, Target, FileText,
  ClipboardCheck, Clipboard, RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  campaign: CampaignData | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onRefine?: (agentId: string, feedback: string) => void;
  isRefining?: boolean;
}

interface TabDef {
  id: string;
  label: string;
  icon: LucideIcon;
  agentId: string;
}

const TABS: TabDef[] = [
  { id: "research", label: "Research", icon: Search, agentId: "researcher" },
  { id: "trends", label: "Trends", icon: TrendingUp, agentId: "trend_analyst" },
  { id: "content", label: "Content", icon: PenLine, agentId: "content_creator" },
  { id: "strategy", label: "Strategy", icon: Target, agentId: "strategist" },
  { id: "report", label: "Report", icon: FileText, agentId: "report_generator" },
];

/* ---- Inline formatting ---- */

function stripMd(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/`(.*?)`/g, "$1").replace(/[*_~]/g, "");
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return <strong key={i} className="text-tx-0 font-semibold">{p.slice(2, -2)}</strong>;
        if (p.startsWith("`") && p.endsWith("`"))
          return <code key={i} className="text-brand text-[11px] bg-brand-dim/60 px-1 py-0.5 rounded">{p.slice(1, -1)}</code>;
        return <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </>
  );
}

/* ---- Markdown renderer ---- */

function cleanText(raw: string): string {
  return raw
    .replace(/```(?:markdown|json|html|text|csv)?\n?/g, "")
    .replace(/```\n?$/gm, "")
    .replace(/^```$/gm, "")
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "");
}

function Md({ text }: { text: string }) {
  const lines = cleanText(text).split("\n");
  const out: React.ReactNode[] = [];
  let tHead: string[] = [];
  let tRows: string[][] = [];
  let inTable = false;

  const flushTable = () => {
    if (!tHead.length) return;
    out.push(
      <div key={`t${out.length}`} className="my-4 overflow-x-auto rounded-lg border border-edge">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-surface-2/60">
              {tHead.map((h, j) => (
                <th key={j} className="text-left py-2 px-3 text-tx-0 font-semibold border-b border-edge">{stripMd(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tRows.map((row, j) => (
              <tr key={j} className="border-b border-edge last:border-0 hover:bg-surface-2/20 transition-colors">
                {row.map((c, k) => (
                  <td key={k} className="py-2 px-3 text-tx-2"><Inline text={c.trim()} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tHead = [];
    tRows = [];
    inTable = false;
  };

  lines.forEach((raw, i) => {
    const ln = raw.trim();
    if (ln.startsWith("|") && ln.endsWith("|")) {
      const cells = ln.slice(1, -1).split("|").map((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c))) return;
      if (!inTable) { inTable = true; tHead = cells; } else { tRows.push(cells); }
      return;
    }
    if (inTable) flushTable();

    if (ln.startsWith("### ")) {
      out.push(
        <h3 key={i} className="text-[13px] font-semibold text-tx-0 mt-6 mb-1.5 flex items-center gap-2">
          <span className="w-[3px] h-4 rounded-full bg-gradient-to-b from-brand to-violet-500" />
          <Inline text={ln.slice(4)} />
        </h3>
      );
    } else if (ln.startsWith("## ")) {
      out.push(
        <h2 key={i} className="text-[15px] font-bold text-tx-0 mt-7 mb-2 pb-2 border-b border-edge">
          <Inline text={ln.slice(3)} />
        </h2>
      );
    } else if (ln.startsWith("# ")) {
      out.push(
        <h1 key={i} className="text-lg font-bold text-tx-0 mt-8 mb-2">
          <Inline text={ln.slice(2)} />
        </h1>
      );
    } else if (ln.startsWith("- ") || ln.startsWith("* ")) {
      out.push(
        <div key={i} className="flex gap-2.5 ml-1 mb-0.5">
          <span className="mt-[7px] w-1 h-1 rounded-full bg-brand/40 flex-shrink-0" />
          <p className="text-[12.5px] text-tx-2 leading-relaxed"><Inline text={ln.slice(2)} /></p>
        </div>
      );
    } else if (/^\d+\.\s/.test(ln)) {
      const num = ln.match(/^(\d+)\./)?.[1];
      out.push(
        <div key={i} className="flex gap-2.5 ml-1 mb-0.5">
          <span className="text-[11px] font-semibold text-brand min-w-[18px] mt-[1px]">{num}.</span>
          <p className="text-[12.5px] text-tx-2 leading-relaxed"><Inline text={ln.replace(/^\d+\.\s/, "")} /></p>
        </div>
      );
    } else if (ln === "---") {
      out.push(<hr key={i} className="border-edge my-5" />);
    } else if (ln === "") {
      out.push(<div key={i} className="h-2" />);
    } else {
      out.push(
        <p key={i} className="text-[12.5px] text-tx-2 leading-relaxed"><Inline text={ln} /></p>
      );
    }
  });

  if (inTable) flushTable();
  return <>{out}</>;
}

/* ---- Copy / Refine buttons ---- */

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const Icon = done ? ClipboardCheck : Clipboard;
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); }}
      className="flex items-center gap-1 text-[10px] text-tx-4 hover:text-tx-2 transition-colors px-2 py-1 rounded-md border border-edge hover:border-edge-b cursor-pointer"
    >
      <Icon className="w-3 h-3" />
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function RefineBtn({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1 text-[10px] text-brand hover:text-brand-bright transition-colors px-2 py-1 rounded-md border border-brand/20 hover:border-brand/40 disabled:opacity-30 cursor-pointer"
    >
      <RefreshCw className="w-3 h-3" />
      Refine
    </button>
  );
}

/* ---- Main ---- */

export default function CampaignOutput({ campaign, activeTab, onTabChange, onRefine, isRefining }: Props) {
  const [refineInput, setRefineInput] = useState("");
  const [showRefineFor, setShowRefineFor] = useState<string | null>(null);

  if (!campaign) return null;
  const hasAny = campaign.research || campaign.trends || campaign.content || campaign.strategy || campaign.report;
  if (!hasAny) return null;

  const content = campaign[activeTab as keyof CampaignData];
  const effectiveTab = content ? activeTab : TABS.find((t) => !!campaign[t.id as keyof CampaignData])?.id || activeTab;
  const effectiveContent = content || campaign[effectiveTab as keyof CampaignData];
  const activeTabDef = TABS.find((t) => t.id === (content ? activeTab : effectiveTab));

  const handleRefineSubmit = () => {
    if (!activeTabDef || !refineInput.trim() || !onRefine) return;
    onRefine(activeTabDef.agentId, refineInput.trim());
    setRefineInput("");
    setShowRefineFor(null);
  };

  return (
    <div className="glass-card overflow-hidden flex flex-col anim-fade-up">
      {/* Tab bar */}
      <div className="flex items-center border-b border-edge overflow-x-auto">
        {TABS.map((tab) => {
          const hasData = !!campaign[tab.id as keyof CampaignData];
          const isActive = (content ? activeTab : effectiveTab) === tab.id;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => hasData && onTabChange(tab.id)}
              className={`relative flex items-center gap-1.5 px-4 py-3 text-[12px] font-medium whitespace-nowrap transition-all ${
                !hasData ? "text-tx-4/40 cursor-default" : "cursor-pointer"
              } ${
                isActive ? "text-brand-bright" : hasData ? "text-tx-2 hover:text-tx-0" : ""
              }`}
            >
              <TabIcon className="w-3.5 h-3.5" />
              {tab.label}
              {hasData && !isActive && <span className="w-1.5 h-1.5 rounded-full bg-ok" />}
              {isActive && <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-brand" />}
            </button>
          );
        })}

        <div className="ml-auto pr-3 flex-shrink-0 flex items-center gap-1.5">
          {onRefine && activeTabDef && effectiveContent && (
            <RefineBtn
              onClick={() => setShowRefineFor(showRefineFor === effectiveTab ? null : effectiveTab)}
              disabled={!!isRefining}
            />
          )}
          {effectiveContent && <CopyBtn text={effectiveContent} />}
        </div>
      </div>

      {/* Inline refine input */}
      {showRefineFor === effectiveTab && onRefine && (
        <div className="flex gap-2 px-4 py-3 bg-brand/[0.03] border-b border-brand/10">
          <input
            value={refineInput}
            onChange={(e) => setRefineInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRefineSubmit()}
            placeholder={`How should the ${activeTabDef?.label || "content"} be improved?`}
            className="flex-1 text-[12px] bg-surface-0/60 border border-edge rounded-lg px-3 py-1.5 text-tx-1 placeholder:text-tx-4 focus:outline-none focus:border-brand/30"
            autoFocus
          />
          <button
            onClick={handleRefineSubmit}
            disabled={!refineInput.trim() || isRefining}
            className="px-4 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-brand hover:brightness-110 transition-all disabled:opacity-30 cursor-pointer"
          >
            Refine
          </button>
        </div>
      )}

      {/* Content */}
      <div className="p-5 overflow-y-auto max-h-[600px]">
        {effectiveContent && (
          <div className="anim-fade-up" key={effectiveTab}>
            <Md text={effectiveContent} />
          </div>
        )}
      </div>
    </div>
  );
}
