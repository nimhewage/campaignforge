"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronLeft, ChevronRight, Download, Maximize2, Minimize2,
  Target, Megaphone, Calendar, DollarSign, BarChart3, ShieldAlert,
  Layers, Presentation,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  strategyText: string;
  campaignName: string;
}

/* ------------------------------------------------------------------ */
/*  Slide data                                                         */
/* ------------------------------------------------------------------ */

interface SlideData {
  title: string;
  body: string;
  icon: LucideIcon;
  accentFrom: string;
  accentTo: string;
}

const SLIDE_ICONS: Record<string, { icon: LucideIcon; from: string; to: string }> = {
  concept:   { icon: Layers,      from: "from-indigo-500", to: "to-violet-500" },
  channel:   { icon: Megaphone,   from: "from-violet-500", to: "to-pink-500" },
  timeline:  { icon: Calendar,    from: "from-cyan-500",   to: "to-blue-500" },
  budget:    { icon: DollarSign,  from: "from-emerald-500", to: "to-teal-500" },
  kpi:       { icon: BarChart3,   from: "from-amber-500",  to: "to-orange-500" },
  risk:      { icon: ShieldAlert, from: "from-rose-500",   to: "to-red-500" },
  default:   { icon: Target,      from: "from-indigo-500", to: "to-violet-500" },
};

function matchSlideStyle(title: string): { icon: LucideIcon; from: string; to: string } {
  const t = title.toLowerCase();
  if (t.includes("concept") || t.includes("positioning") || t.includes("value")) return SLIDE_ICONS.concept;
  if (t.includes("channel")) return SLIDE_ICONS.channel;
  if (t.includes("timeline") || t.includes("phase") || t.includes("schedule")) return SLIDE_ICONS.timeline;
  if (t.includes("budget") || t.includes("allocation") || t.includes("spend")) return SLIDE_ICONS.budget;
  if (t.includes("kpi") || t.includes("metric") || t.includes("performance")) return SLIDE_ICONS.kpi;
  if (t.includes("risk") || t.includes("mitigation")) return SLIDE_ICONS.risk;
  return SLIDE_ICONS.default;
}

/* ------------------------------------------------------------------ */
/*  Parse markdown into slides                                         */
/* ------------------------------------------------------------------ */

function parseSlides(text: string, campaignName: string): SlideData[] {
  const cleaned = text
    .replace(/```(?:markdown|json|html|text|csv)?\n?/g, "")
    .replace(/```\n?$/gm, "")
    .replace(/^```$/gm, "")
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "");

  const slides: SlideData[] = [];

  // Title slide
  const name = campaignName.split("\n")[0].slice(0, 100).replace(/[*_`#]/g, "");
  slides.push({
    title: name || "Campaign Strategy",
    body: `**Strategy Presentation**\n\n${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    icon: Presentation,
    accentFrom: "from-indigo-500",
    accentTo: "to-violet-500",
  });

  // Split on ## headings
  const sections = cleaned.split(/^##\s+/m).filter(Boolean);
  
  for (const section of sections) {
    const lines = section.split("\n");
    const title = (lines[0] || "").replace(/[*_`#]/g, "").trim();
    if (!title) continue;

    const body = lines.slice(1).join("\n").trim();
    if (!body) continue;

    const style = matchSlideStyle(title);
    slides.push({
      title,
      body,
      icon: style.icon,
      accentFrom: style.from,
      accentTo: style.to,
    });
  }

  return slides;
}

/* ------------------------------------------------------------------ */
/*  Slide-specific markdown renderer                                   */
/* ------------------------------------------------------------------ */

function SlideMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h3: ({ children }) => (
          <h3 className="text-[15px] font-semibold text-white/90 mt-5 mb-2 flex items-center gap-2">
            <span className="w-[3px] h-4 rounded-full bg-white/30" />
            <span>{children}</span>
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-[13px] font-semibold text-white/80 mt-3 mb-1">{children}</h4>
        ),
        p: ({ children }) => (
          <p className="text-[13px] text-white/70 leading-relaxed mb-2">{children}</p>
        ),
        ul: ({ children }) => <ul className="space-y-1 mb-3">{children}</ul>,
        ol: ({ children }) => <ol className="space-y-1 mb-3">{children}</ol>,
        li: ({ children }) => (
          <div className="flex gap-2 ml-1">
            <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-white/30 flex-shrink-0" />
            <div className="text-[13px] text-white/70 leading-relaxed">{children}</div>
          </div>
        ),
        strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
        em: ({ children }) => <em className="text-white/60 italic">{children}</em>,
        code: ({ children, className }) => {
          if (className?.includes("language-")) {
            return (
              <pre className="bg-black/30 rounded-lg p-3 my-3 overflow-x-auto">
                <code className="text-[11px] font-mono text-white/80">{children}</code>
              </pre>
            );
          }
          return (
            <code className="text-violet-300 text-[11px] bg-white/10 px-1.5 py-0.5 rounded font-mono">
              {children}
            </code>
          );
        },
        table: ({ children }) => (
          <div className="my-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-[12px]">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-white/10">{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => (
          <tr className="border-b border-white/5 last:border-0">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="text-left py-2.5 px-3 text-white/90 font-semibold border-b border-white/10">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="py-2.5 px-3 text-white/70">{children}</td>
        ),
        hr: () => <hr className="border-white/10 my-4" />,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-white/20 pl-4 my-3 text-white/50 italic">
            {children}
          </blockquote>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

/* ------------------------------------------------------------------ */
/*  PPT Export                                                         */
/* ------------------------------------------------------------------ */

async function exportToPptx(slides: SlideData[], campaignName: string) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();

  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "CampaignForge";
  pptx.subject = campaignName;

  const BG = "0F0F1A";
  const ACCENT = "6366F1";
  const TEXT_PRIMARY = "FFFFFF";
  const TEXT_SECONDARY = "A0A0B8";

  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const slide = pptx.addSlide();
    slide.background = { color: BG };

    // Accent bar at top
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: "100%", h: 0.06,
      fill: { color: ACCENT },
    });

    if (i === 0) {
      // Title slide
      slide.addText(s.title, {
        x: 0.8, y: 1.8, w: 11.5, h: 1.5,
        fontSize: 36, fontFace: "Helvetica Neue",
        color: TEXT_PRIMARY, bold: true, align: "left",
      });
      slide.addText(s.body.replace(/\*\*/g, ""), {
        x: 0.8, y: 3.4, w: 11.5, h: 1,
        fontSize: 16, fontFace: "Helvetica Neue",
        color: TEXT_SECONDARY, align: "left",
      });
      slide.addText("CampaignForge", {
        x: 0.8, y: 6.6, w: 4, h: 0.4,
        fontSize: 10, fontFace: "Helvetica Neue",
        color: "6366F1", align: "left",
      });
    } else {
      // Section title
      slide.addText(s.title, {
        x: 0.8, y: 0.4, w: 11.5, h: 0.7,
        fontSize: 24, fontFace: "Helvetica Neue",
        color: TEXT_PRIMARY, bold: true,
      });

      // Accent underline
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.8, y: 1.1, w: 2, h: 0.04,
        fill: { color: ACCENT },
      });

      // Check for tables in body
      const tableMatch = s.body.match(/\|(.+)\|\n\|[-:\s|]+\|\n([\s\S]*?)(?=\n\n|$)/);
      if (tableMatch) {
        const headers = tableMatch[1].split("|").map((h) => h.trim()).filter(Boolean);
        const rowLines = tableMatch[2].trim().split("\n");
        const rows = rowLines.map((r) =>
          r.split("|").map((c) => c.trim()).filter(Boolean)
        );

        const tableData = [
          headers.map((h) => ({
            text: h.replace(/\*\*/g, ""),
            options: {
              fontSize: 10,
              fontFace: "Helvetica Neue",
              color: TEXT_PRIMARY,
              bold: true,
              fill: { color: "1A1A2E" },
              border: { type: "solid" as const, color: "2A2A40", pt: 0.5 },
              valign: "middle" as const,
            },
          })),
          ...rows.map((row) =>
            row.map((cell) => ({
              text: cell.replace(/\*\*/g, ""),
              options: {
                fontSize: 9,
                fontFace: "Helvetica Neue",
                color: TEXT_SECONDARY,
                fill: { color: "12121E" },
                border: { type: "solid" as const, color: "2A2A40", pt: 0.5 },
                valign: "middle" as const,
              },
            }))
          ),
        ];

        slide.addTable(tableData, {
          x: 0.8, y: 1.4, w: 11.5,
          colW: headers.map(() => 11.5 / headers.length),
          rowH: 0.4,
        });

        // Add remaining non-table text
        const nonTableText = s.body.replace(/\|(.+)\|\n\|[-:\s|]+\|\n([\s\S]*?)(?=\n\n|$)/, "").trim();
        if (nonTableText) {
          slide.addText(nonTableText.replace(/\*\*/g, "").replace(/#+\s*/g, ""), {
            x: 0.8, y: 1.4 + (rows.length + 1) * 0.4 + 0.3, w: 11.5, h: 3,
            fontSize: 11, fontFace: "Helvetica Neue",
            color: TEXT_SECONDARY, valign: "top",
            lineSpacing: 18,
          });
        }
      } else {
        // Plain text content
        const cleanBody = s.body
          .replace(/\*\*/g, "")
          .replace(/#+\s*/g, "")
          .replace(/^[-*]\s/gm, "  - ");

        slide.addText(cleanBody, {
          x: 0.8, y: 1.4, w: 11.5, h: 5.5,
          fontSize: 11, fontFace: "Helvetica Neue",
          color: TEXT_SECONDARY, valign: "top",
          lineSpacing: 18,
        });
      }

      // Slide number
      slide.addText(`${i + 1} / ${slides.length}`, {
        x: 11, y: 6.8, w: 2, h: 0.3,
        fontSize: 8, fontFace: "Helvetica Neue",
        color: "555570", align: "right",
      });
    }
  }

  pptx.writeFile({ fileName: `${campaignName.split("\n")[0].slice(0, 40).replace(/[^\w\s-]/g, "")}_Strategy.pptx` });
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function StrategySlides({ strategyText, campaignName }: Props) {
  const slides = useMemo(() => parseSlides(strategyText, campaignName), [strategyText, campaignName]);
  const [current, setCurrent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const goTo = useCallback((idx: number) => {
    setCurrent(Math.max(0, Math.min(slides.length - 1, idx)));
  }, [slides.length]);

  const prev = useCallback(() => goTo(current - 1), [current, goTo]);
  const next = useCallback(() => goTo(current + 1), [current, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next]);

  if (slides.length <= 1) return null;

  const slide = slides[current];
  const SlideIcon = slide.icon;
  const isTitle = current === 0;
  const progress = ((current + 1) / slides.length) * 100;

  return (
    <div className={`mb-6 ${isFullscreen ? "fixed inset-0 z-50 bg-surface-0 flex flex-col p-4" : ""}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Presentation className="w-4 h-4 text-brand" />
          <h3 className="text-[12px] font-semibold text-tx-0 uppercase tracking-widest">
            Strategy Presentation
          </h3>
          <span className="text-[10px] text-tx-4 ml-1">{slides.length} slides</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToPptx(slides, campaignName)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:brightness-110 shadow-md shadow-indigo-500/15 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Download .pptx
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-md text-tx-3 hover:text-tx-1 hover:bg-surface-2 transition-all cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Slide viewport */}
      <div
        className={`relative rounded-2xl overflow-hidden border border-white/[0.06] shadow-2xl ${
          isFullscreen ? "flex-1" : "aspect-video"
        }`}
        style={{ background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16162a 100%)" }}
      >
        {/* Top accent bar */}
        <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${slide.accentFrom} ${slide.accentTo}`} />

        {/* Slide content */}
        <div className="absolute inset-0 flex flex-col p-8 md:p-12 overflow-y-auto">
          {isTitle ? (
            /* ---- Title Slide ---- */
            <div className="flex-1 flex flex-col justify-center">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${slide.accentFrom} ${slide.accentTo} flex items-center justify-center mb-6 shadow-lg`}>
                <SlideIcon className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">
                {slide.title}
              </h1>
              <SlideMarkdown text={slide.body} />
              <div className="mt-auto pt-8">
                <p className="text-[11px] text-white/30 font-mono tracking-wider">CAMPAIGNFORGE</p>
              </div>
            </div>
          ) : (
            /* ---- Content Slide ---- */
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${slide.accentFrom} ${slide.accentTo} flex items-center justify-center shadow-lg flex-shrink-0`}>
                  <SlideIcon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-white leading-tight">
                  {slide.title}
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto pr-2">
                <SlideMarkdown text={slide.body} />
              </div>
            </div>
          )}
        </div>

        {/* Navigation arrows */}
        {current > 0 && (
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm"
          >
            <ChevronLeft className="w-5 h-5 text-white/80" />
          </button>
        )}
        {current < slides.length - 1 && (
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm"
          >
            <ChevronRight className="w-5 h-5 text-white/80" />
          </button>
        )}

        {/* Slide counter */}
        <div className="absolute bottom-4 right-5 text-[11px] font-mono text-white/30">
          {current + 1} / {slides.length}
        </div>
      </div>

      {/* Progress bar + dot navigation */}
      <div className="mt-3 space-y-2">
        {/* Progress bar */}
        <div className="h-[2px] bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand to-violet-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Dot navigation */}
        <div className="flex items-center justify-center gap-1.5">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`transition-all cursor-pointer rounded-full ${
                i === current
                  ? "w-6 h-2 bg-brand"
                  : "w-2 h-2 bg-white/15 hover:bg-white/30"
              }`}
              title={s.title}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
