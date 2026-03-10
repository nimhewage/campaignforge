"use client";

import { useState } from "react";
import {
  Camera,
  Play,
  Briefcase,
  MessageCircle,
  Mail,
  Megaphone,
  BookOpen,
  Type,
  Clipboard,
  ClipboardCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Section {
  title: string;
  content: string;
  type: string;
  color: string;
  borderColor: string;
  icon: LucideIcon;
}

const SECTION_MAP: {
  keywords: string[];
  type: string;
  color: string;
  border: string;
  icon: LucideIcon;
}[] = [
  { keywords: ["headline"], type: "Headlines", color: "text-indigo-400", border: "border-indigo-500/20 bg-indigo-500/[0.03]", icon: Type },
  { keywords: ["instagram"], type: "Instagram", color: "text-fuchsia-400", border: "border-fuchsia-500/20 bg-fuchsia-500/[0.03]", icon: Camera },
  { keywords: ["tiktok"], type: "TikTok", color: "text-cyan-400", border: "border-cyan-500/20 bg-cyan-500/[0.03]", icon: Play },
  { keywords: ["linkedin"], type: "LinkedIn", color: "text-blue-400", border: "border-blue-500/20 bg-blue-500/[0.03]", icon: Briefcase },
  { keywords: ["twitter", "x post"], type: "Twitter / X", color: "text-sky-400", border: "border-sky-500/20 bg-sky-500/[0.03]", icon: MessageCircle },
  { keywords: ["email"], type: "Email", color: "text-amber-400", border: "border-amber-500/20 bg-amber-500/[0.03]", icon: Mail },
  { keywords: ["ad cop", "ad variant"], type: "Ad Copy", color: "text-emerald-400", border: "border-emerald-500/20 bg-emerald-500/[0.03]", icon: Megaphone },
  { keywords: ["blog"], type: "Blog", color: "text-rose-400", border: "border-rose-500/20 bg-rose-500/[0.03]", icon: BookOpen },
];

function parseSections(text: string): Section[] {
  const cleaned = text
    .replace(/```markdown\n?/g, "")
    .replace(/```\n?$/gm, "")
    .replace(/^```$/gm, "");

  const parts = cleaned.split(/(?=^#{2,3} )/m);
  const sections: Section[] = [];

  for (const part of parts) {
    const match = part.match(/^#{2,3} (.+)\n([\s\S]*)/);
    if (!match) continue;
    const title = match[1].trim();
    const content = match[2].trim();
    if (!content) continue;

    const lower = title.toLowerCase();
    const mapped = SECTION_MAP.find((s) => s.keywords.some((k) => lower.includes(k)));

    sections.push({
      title: mapped?.type || title,
      content,
      type: mapped?.type || "generic",
      color: mapped?.color || "text-tx-2",
      borderColor: mapped?.border || "border-edge bg-surface-1",
      icon: mapped?.icon || Type,
    });
  }

  return sections;
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const Icon = done ? ClipboardCheck : Clipboard;
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
      className="flex items-center gap-1 text-[10px] text-tx-3 hover:text-tx-1 transition-colors px-2 py-1 rounded border border-edge hover:border-edge-b cursor-pointer"
    >
      <Icon className="w-3 h-3" />
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function MaterialCard({ section }: { section: Section }) {
  const [expanded, setExpanded] = useState(false);
  const SectionIcon = section.icon;
  const lines = section.content.split("\n").filter((l) => l.trim());
  const preview = lines.slice(0, expanded ? lines.length : 6);
  const hasMore = lines.length > 6;

  return (
    <div className={`rounded-xl border ${section.borderColor} overflow-hidden transition-all`}>
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
        <div className="flex items-center gap-2">
          <SectionIcon className={`w-4 h-4 ${section.color}`} />
          <span className={`text-[12px] font-semibold ${section.color}`}>{section.title}</span>
        </div>
        <CopyBtn text={section.content} />
      </div>

      {/* Card body */}
      <div className="px-4 py-3">
        {preview.map((line, i) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("### "))
            return (
              <p key={i} className="text-[11px] font-semibold text-tx-1 mt-3 mb-1">
                {trimmed.slice(4)}
              </p>
            );
          if (trimmed.startsWith("**") && trimmed.endsWith("**"))
            return (
              <p key={i} className="text-[11px] font-semibold text-tx-1 mt-2">
                {trimmed.slice(2, -2)}
              </p>
            );
          if (trimmed.startsWith("- "))
            return (
              <div key={i} className="flex gap-2 ml-1">
                <span className="mt-[5px] w-1 h-1 rounded-full bg-current opacity-30 flex-shrink-0" />
                <p className="text-[11px] text-tx-2 leading-relaxed">{renderInline(trimmed.slice(2))}</p>
              </div>
            );
          if (/^\d+\./.test(trimmed)) {
            const num = trimmed.match(/^(\d+)\./)?.[1];
            return (
              <div key={i} className="flex gap-2 ml-1">
                <span className={`text-[10px] font-bold min-w-[14px] ${section.color}`}>{num}.</span>
                <p className="text-[11px] text-tx-2 leading-relaxed">{renderInline(trimmed.replace(/^\d+\.\s*/, ""))}</p>
              </div>
            );
          }
          if (trimmed.startsWith("Headline:") || trimmed.startsWith("Description:") || trimmed.startsWith("CTA:")) {
            const [label, ...rest] = trimmed.split(":");
            return (
              <div key={i} className="flex gap-2 mt-1">
                <span className={`text-[10px] font-semibold uppercase ${section.color} min-w-[70px]`}>{label}</span>
                <p className="text-[11px] text-tx-1">{rest.join(":").trim()}</p>
              </div>
            );
          }
          if (trimmed === "---")
            return <hr key={i} className="border-edge my-3" />;
          if (trimmed === "") return null;
          return (
            <p key={i} className="text-[11px] text-tx-2 leading-relaxed">{renderInline(trimmed)}</p>
          );
        })}

        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-[10px] text-brand hover:text-brand-bright transition-colors cursor-pointer"
          >
            {expanded ? "Show less" : `Show ${lines.length - 6} more lines`}
          </button>
        )}
      </div>
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="text-tx-0 font-semibold">
        {p.slice(2, -2)}
      </strong>
    ) : (
      p
    )
  );
}

export default function MaterialGallery({ content }: { content: string }) {
  const sections = parseSections(content);
  if (!sections.length) return null;

  return (
    <div className="anim-fade-up">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[12px] font-semibold text-tx-1 uppercase tracking-widest">
          Campaign Materials
        </h3>
        <span className="text-[11px] text-tx-2">{sections.length} deliverables</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sections.map((section, i) => (
          <MaterialCard key={i} section={section} />
        ))}
      </div>
    </div>
  );
}
