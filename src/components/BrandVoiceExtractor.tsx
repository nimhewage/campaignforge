"use client";

import { useState, useEffect } from "react";
import { X, Mic, Loader2, Check, Trash2, Volume2 } from "lucide-react";

interface VoiceProfile {
  tone: string[];
  vocabulary: string;
  sentenceStyle: string;
  personality: string[];
  avoid: string[];
  extractedAt: number;
}

const STORAGE_KEY = "campaignforge_voice_profile";

export function loadVoiceProfile(): VoiceProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveVoiceProfile(p: VoiceProfile) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* quota */ }
}

function clearVoiceProfile() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
}

/* ------------------------------------------------------------------ */
/*  Local analysis (no API call needed)                                */
/* ------------------------------------------------------------------ */

function analyzeVoice(text: string): VoiceProfile {
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 5);
  const avgSentenceLen = sentences.length > 0
    ? Math.round(words.length / sentences.length)
    : 0;

  // Tone detection
  const tone: string[] = [];
  if (/\b(you|your|we|our|together)\b/i.test(text)) tone.push("Conversational");
  if (/\b(data|research|proven|study|evidence)\b/i.test(text)) tone.push("Data-driven");
  if (/[!]{1,}/.test(text)) tone.push("Energetic");
  if (/\b(luxury|premium|exclusive|sophisticated)\b/i.test(text)) tone.push("Premium");
  if (/\b(fun|playful|laugh|joy|love|amazing)\b/i.test(text)) tone.push("Playful");
  if (/\b(trust|safe|secure|reliable|proven)\b/i.test(text)) tone.push("Trustworthy");
  if (tone.length === 0) tone.push("Professional");

  // Vocabulary level
  const longWords = words.filter((w) => w.length > 8).length;
  const longWordRatio = words.length > 0 ? longWords / words.length : 0;
  const vocabulary =
    longWordRatio > 0.25 ? "Advanced / Technical"
    : longWordRatio > 0.15 ? "Professional"
    : "Accessible / Casual";

  // Sentence style
  const sentenceStyle =
    avgSentenceLen > 25 ? "Long-form, elaborate"
    : avgSentenceLen > 15 ? "Balanced, medium-length"
    : avgSentenceLen > 0 ? "Short and punchy"
    : "Varied";

  // Personality
  const personality: string[] = [];
  if (/\b(innovate|pioneer|disrupt|future)\b/i.test(text)) personality.push("Innovative");
  if (/\b(community|together|family|belong)\b/i.test(text)) personality.push("Community-focused");
  if (/\b(sustainable|green|planet|ethical)\b/i.test(text)) personality.push("Values-led");
  if (/\b(results|achieve|growth|roi|revenue)\b/i.test(text)) personality.push("Results-oriented");
  if (personality.length === 0) personality.push("Authentic", "Reliable");

  // Words to avoid (overused)
  const wordFreq: Record<string, number> = {};
  for (const w of words.map((w) => w.toLowerCase().replace(/[^a-z]/g, ""))) {
    if (w.length > 3) wordFreq[w] = (wordFreq[w] || 0) + 1;
  }
  const avoid = Object.entries(wordFreq)
    .filter(([, count]) => count > 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([w]) => w);

  return { tone, vocabulary, sentenceStyle, personality, avoid, extractedAt: Date.now() };
}

/* ------------------------------------------------------------------ */
/*  Tag chip                                                           */
/* ------------------------------------------------------------------ */

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${color}`}>
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function BrandVoiceExtractor({
  open,
  onClose,
  onVoiceReady,
}: {
  open: boolean;
  onClose: () => void;
  onVoiceReady: (profile: VoiceProfile | null) => void;
}) {
  const [text, setText] = useState("");
  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      const existing = loadVoiceProfile();
      setProfile(existing);
      setSaved(!!existing);
    }
  }, [open]);

  const handleAnalyze = () => {
    if (text.trim().split(/\s+/).length < 30) return;
    setAnalyzing(true);
    setTimeout(() => {
      const p = analyzeVoice(text);
      setProfile(p);
      saveVoiceProfile(p);
      onVoiceReady(p);
      setSaved(true);
      setAnalyzing(false);
    }, 800);
  };

  const handleClear = () => {
    clearVoiceProfile();
    setProfile(null);
    setSaved(false);
    setText("");
    onVoiceReady(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg glass-card rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-brand" />
            <h2 className="text-[14px] font-semibold text-tx-0">Brand Voice Extractor</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-tx-4 hover:text-tx-1 hover:bg-surface-2/60 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Existing profile */}
          {profile && (
            <div className="rounded-xl border border-ok/20 bg-ok/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-ok" />
                  <p className="text-[12px] font-semibold text-ok">Voice Profile Active</p>
                </div>
                <button
                  onClick={handleClear}
                  className="flex items-center gap-1 text-[10px] text-tx-4 hover:text-fail transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              </div>
              <div className="space-y-2.5">
                <ProfileRow label="Tone">
                  {profile.tone.map((t) => <Tag key={t} label={t} color="text-brand bg-brand/10 border-brand/20" />)}
                </ProfileRow>
                <ProfileRow label="Vocabulary">
                  <Tag label={profile.vocabulary} color="text-violet-400 bg-violet-400/10 border-violet-400/20" />
                </ProfileRow>
                <ProfileRow label="Style">
                  <Tag label={profile.sentenceStyle} color="text-blue-400 bg-blue-400/10 border-blue-400/20" />
                </ProfileRow>
                <ProfileRow label="Personality">
                  {profile.personality.map((p) => <Tag key={p} label={p} color="text-amber-400 bg-amber-400/10 border-amber-400/20" />)}
                </ProfileRow>
                {profile.avoid.length > 0 && (
                  <ProfileRow label="Overused words">
                    {profile.avoid.map((w) => <Tag key={w} label={w} color="text-rose-400 bg-rose-400/10 border-rose-400/20" />)}
                  </ProfileRow>
                )}
              </div>
              <p className="text-[9px] text-tx-4">
                Extracted {new Date(profile.extractedAt).toLocaleDateString()} — applied to all future campaigns
              </p>
            </div>
          )}

          {/* Input area */}
          <div>
            <p className="text-[12px] text-tx-2 mb-2">
              Paste 3-5 paragraphs of your existing marketing copy (website, ads, emails). We&apos;ll extract your brand&apos;s unique voice.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              placeholder="Paste your existing brand copy here — website homepage, email newsletter, social posts..."
              className="w-full bg-surface-1 border border-edge rounded-xl px-4 py-3 text-[12px] text-tx-1 placeholder:text-tx-4 focus:outline-none focus:border-brand/30 resize-none transition-colors"
            />
            <p className="text-[10px] text-tx-4 mt-1">
              {text.split(/\s+/).filter(Boolean).length} words · need at least 30
            </p>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={analyzing || text.split(/\s+/).filter(Boolean).length < 30}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20 hover:brightness-110 transition-all disabled:opacity-30 cursor-pointer"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analysing voice...
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                {saved ? "Re-analyse" : "Extract Brand Voice"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[10px] text-tx-4 w-24 flex-shrink-0 pt-0.5">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}
