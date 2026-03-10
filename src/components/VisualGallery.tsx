"use client";

import { useState } from "react";
import {
  Image as ImageIcon,
  Video,
  Download,
  Loader2,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  Play,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Visual {
  type: string;
  url: string | null;
  format: "image" | "video";
  prompt: string;
  error?: string;
}

interface Props {
  visuals: Visual[];
  isGenerating: boolean;
  onGenerate: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function VisualGallery({ visuals, isGenerating, onGenerate }: Props) {
  const [expandedPrompt, setExpandedPrompt] = useState<number | null>(null);

  const images = visuals.filter((v) => v.format === "image");
  const videos = visuals.filter((v) => v.format === "video");
  const successCount = visuals.filter((v) => v.url).length;
  const hasVisuals = visuals.length > 0;

  return (
    <div className="glass-card overflow-hidden anim-fade-up">
      {/* Header */}
      <div className="p-4 border-b border-edge bg-gradient-to-r from-violet-500/[0.03] to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand" />
            <h3 className="text-[12px] font-semibold text-tx-1 uppercase tracking-widest">
              Visual Content
            </h3>
            {hasVisuals && (
              <span className="text-[11px] text-tx-2 ml-1">
                {successCount} / {visuals.length} generated
              </span>
            )}
          </div>
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:brightness-110 shadow-md shadow-indigo-500/15 transition-all disabled:opacity-40 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" /> Generate Visuals
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {!hasVisuals && !isGenerating && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mx-auto mb-3">
              <ImageIcon className="w-8 h-8 text-brand/40" />
            </div>
            <p className="text-[13px] text-tx-2 font-medium">No visuals generated yet</p>
            <p className="text-[12px] text-tx-2 mt-1 max-w-md mx-auto">
              Click "Generate Visuals" to create banners, social media images, and video shorts
              based on your campaign content
            </p>
          </div>
        )}

        {isGenerating && !hasVisuals && (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 text-brand animate-spin mx-auto mb-3" />
            <p className="text-[13px] text-tx-2 font-medium">Creating visual content...</p>
            <p className="text-[11px] text-tx-3 mt-1">
              Generating images and video shorts. This may take 1-2 minutes.
            </p>
          </div>
        )}

        {hasVisuals && (
          <div className="space-y-6">
            {/* Images */}
            {images.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ImageIcon className="w-3.5 h-3.5 text-tx-2" />
                  <h4 className="text-[11px] font-semibold text-tx-2 uppercase tracking-widest">
                    Images ({images.length})
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {images.map((visual, idx) => (
                    <VisualCard
                      key={idx}
                      visual={visual}
                      index={idx}
                      expanded={expandedPrompt === idx}
                      onTogglePrompt={() => setExpandedPrompt(expandedPrompt === idx ? null : idx)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Videos */}
            {videos.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Video className="w-3.5 h-3.5 text-tx-3" />
                  <h4 className="text-[11px] font-semibold text-tx-2 uppercase tracking-widest">
                    Video Shorts ({videos.length})
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {videos.map((visual, idx) => (
                    <VisualCard
                      key={idx + images.length}
                      visual={visual}
                      index={idx + images.length}
                      expanded={expandedPrompt === idx + images.length}
                      onTogglePrompt={() => {
                        const globalIdx = idx + images.length;
                        setExpandedPrompt(expandedPrompt === globalIdx ? null : globalIdx);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Visual Card                                                        */
/* ------------------------------------------------------------------ */

function VisualCard({
  visual,
  index,
  expanded,
  onTogglePrompt,
}: {
  visual: Visual;
  index: number;
  expanded: boolean;
  onTogglePrompt: () => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const isImage = visual.format === "image";
  const hasError = !!visual.error || !visual.url;

  return (
    <div className="rounded-xl border border-edge bg-surface-1 overflow-hidden hover:border-edge-b transition-all">
      {/* Preview */}
      <div className="relative aspect-video bg-surface-2/40 flex items-center justify-center overflow-hidden">
        {hasError ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-fail/40 mb-2" />
            <p className="text-[11px] text-fail/60">{visual.error || "Generation failed"}</p>
          </div>
        ) : visual.url ? (
          <>
            {isImage ? (
              <>
                {!imageLoaded && (
                  <Loader2 className="absolute w-8 h-8 text-brand/40 animate-spin" />
                )}
                <img
                  src={visual.url}
                  alt={visual.type}
                  onLoad={() => setImageLoaded(true)}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    imageLoaded ? "opacity-100" : "opacity-0"
                  }`}
                />
              </>
            ) : (
              <div className="relative w-full h-full group">
                <video
                  src={visual.url}
                  className="w-full h-full object-cover"
                  loop
                  muted
                  playsInline
                  onMouseEnter={(e) => e.currentTarget.play()}
                  onMouseLeave={(e) => e.currentTarget.pause()}
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-100 group-hover:opacity-0 transition-opacity pointer-events-none">
                  <Play className="w-12 h-12 text-white/80" />
                </div>
              </div>
            )}
          </>
        ) : (
          <Loader2 className="w-8 h-8 text-brand/40 animate-spin" />
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {isImage ? (
              <ImageIcon className="w-3.5 h-3.5 text-brand" />
            ) : (
              <Video className="w-3.5 h-3.5 text-brand" />
            )}
            <span className="text-[12px] font-semibold text-tx-1">{visual.type}</span>
          </div>
          {visual.url && (
            <div className="flex gap-1">
              <a
                href={visual.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md text-tx-3 hover:text-tx-1 hover:bg-surface-2 transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href={visual.url}
                download={`${visual.type.replace(/\s+/g, "_")}.${isImage ? "png" : "mp4"}`}
                className="p-1.5 rounded-md text-tx-3 hover:text-tx-1 hover:bg-surface-2 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Prompt toggle */}
        <button
          onClick={onTogglePrompt}
          className="text-[10px] text-tx-3 hover:text-brand transition-colors cursor-pointer"
        >
          {expanded ? "Hide prompt" : "Show prompt"}
        </button>

        {expanded && (
          <p className="mt-2 text-[10px] text-tx-2 leading-relaxed bg-surface-0/60 rounded-lg px-2.5 py-2 font-mono">
            {visual.prompt}
          </p>
        )}
      </div>
    </div>
  );
}
