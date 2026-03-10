"use client";

import { useState } from "react";
import { X, Star, ThumbsUp, BarChart3 } from "lucide-react";
import { saveFeedback } from "@/lib/storage";

interface Props {
  campaignId: string | null;
  onDismiss: () => void;
}

export default function PerformanceFeedback({ campaignId, onDismiss }: Props) {
  const [ran, setRan] = useState<boolean | null>(null);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (campaignId && rating > 0) {
      saveFeedback(campaignId, rating, notes.trim() || undefined);
    }
    setSaved(true);
    setTimeout(onDismiss, 1500);
  };

  return (
    <div className="glass-card overflow-hidden anim-fade-up border-brand/10">
      <div className="p-4 border-b border-edge bg-gradient-to-r from-brand/[0.04] to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand" />
            <h3 className="text-[12px] font-semibold text-tx-1 uppercase tracking-widest">
              Campaign Feedback
            </h3>
            <span className="text-[11px] text-tx-3 ml-1">helps us improve</span>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 rounded-md text-tx-4 hover:text-tx-2 hover:bg-surface-2 transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {saved ? (
        <div className="p-6 text-center">
          <ThumbsUp className="w-8 h-8 text-ok mx-auto mb-2" />
          <p className="text-[13px] font-medium text-tx-1">Thanks for the feedback!</p>
          <p className="text-[12px] text-tx-2 mt-1">It helps make CampaignForge smarter.</p>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Question 1 */}
          <div>
            <p className="text-[12px] font-medium text-tx-1 mb-2">
              Did you actually run or use this campaign?
            </p>
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  onClick={() => setRan(v)}
                  className={`px-4 py-1.5 rounded-lg text-[12px] font-medium border transition-all cursor-pointer ${
                    ran === v
                      ? "bg-brand/10 border-brand/30 text-brand-bright"
                      : "border-edge text-tx-2 hover:border-edge-b hover:text-tx-1"
                  }`}
                >
                  {v ? "Yes" : "Not yet"}
                </button>
              ))}
            </div>
          </div>

          {/* Question 2 */}
          <div>
            <p className="text-[12px] font-medium text-tx-1 mb-2">
              Rate the output quality
            </p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  className="p-0.5 cursor-pointer transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-6 h-6 transition-colors ${
                      star <= (hovered || rating)
                        ? "text-amber-400 fill-amber-400"
                        : "text-surface-4"
                    }`}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-2 text-[11px] text-tx-3 self-center">
                  {["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}
                </span>
              )}
            </div>
          </div>

          {/* Optional notes */}
          {rating > 0 && rating <= 3 && (
            <div>
              <label className="block text-[11px] text-tx-3 mb-1.5">
                What could be better? (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Research was too generic, content lacked specifics..."
                rows={2}
                className="w-full text-[12px] bg-surface-0/60 border border-edge rounded-lg px-3 py-2 text-tx-1 placeholder:text-tx-4 resize-none focus:outline-none focus:border-brand/30"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-[11px] text-tx-3 hover:text-tx-1 transition-colors cursor-pointer"
            >
              Skip
            </button>
            <button
              onClick={handleSave}
              disabled={rating === 0}
              className="px-4 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-brand hover:brightness-110 transition-all disabled:opacity-30 cursor-pointer"
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
