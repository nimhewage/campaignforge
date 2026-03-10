"use client";

import { User, MapPin, DollarSign, Heart, AlertTriangle, Smartphone, ShoppingBag, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { stripMd } from "@/lib/stripMd";

interface Persona {
  name: string;
  age: string;
  job: string;
  location: string;
  income: string;
  quote: string;
  avatar?: string;
  painPoints: string[];
  motivations: string[];
  mediaHabits: string[];
  buyingTriggers: string[];
  objections: string[];
}

const GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-rose-500 to-pink-600",
  "from-emerald-500 to-teal-600",
];

function parsePersonas(text: string): Persona[] | null {
  const attempt = (s: string) => {
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch { return null; }
  };

  // Direct parse
  const direct = attempt(text);
  if (direct) return direct;

  // Fenced code block
  const fenced = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  if (fenced) { const r = attempt(fenced[1]); if (r) return r; }

  // Raw JSON array in text
  const raw = text.match(/\[[\s\S]*?"name"[\s\S]*?\]/);
  if (raw) { const r = attempt(raw[0]); if (r) return r; }

  return null;
}

function PersonaSection({
  icon: Icon,
  label,
  items,
  color,
}: {
  icon: React.ElementType;
  label: string;
  items: string[];
  color: string;
}) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={`w-3 h-3 ${color} flex-shrink-0`} />
        <span className="text-[10px] font-semibold text-tx-2 uppercase tracking-wide">{label}</span>
      </div>
      <div className="space-y-1">
        {items.slice(0, 3).map((item, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="w-1 h-1 rounded-full bg-tx-4/40 flex-shrink-0 mt-[5px]" />
            <span className="text-[12px] text-tx-1 leading-relaxed">{stripMd(item)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PersonaCard({ persona, gradient }: { persona: Persona; gradient: string }) {
  const initials =
    persona.avatar ||
    persona.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="rounded-2xl border border-edge bg-surface-1 overflow-hidden flex flex-col">
      {/* Header */}
      <div className={`bg-gradient-to-br ${gradient} p-4`}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white text-[15px] font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-[14px] truncate">{stripMd(persona.name)}</p>
            <p className="text-white/80 text-[11px] truncate">{stripMd(persona.job)}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {persona.location && (
                <span className="text-white/70 text-[10px] flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5" />
                  {persona.location}
                </span>
              )}
              {persona.age && (
                <span className="text-white/70 text-[10px] flex items-center gap-1">
                  <User className="w-2.5 h-2.5" />
                  {persona.age}
                </span>
              )}
            </div>
          </div>
        </div>
        {persona.income && (
          <div className="mt-2 flex items-center gap-1 text-white/70 text-[10px]">
            <DollarSign className="w-2.5 h-2.5" />
            {persona.income}
          </div>
        )}
      </div>

      {/* Quote */}
      {persona.quote && (
        <div className="px-4 py-3 bg-surface-2/30 border-b border-edge">
          <div className="flex gap-1.5">
            <MessageSquare className="w-3 h-3 text-tx-4 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-tx-2 italic leading-relaxed">
              &ldquo;{stripMd(persona.quote)}&rdquo;
            </p>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="p-4 space-y-3 flex-1">
        <PersonaSection icon={AlertTriangle} label="Pain Points" items={persona.painPoints} color="text-rose-400" />
        <PersonaSection icon={Heart} label="Motivations" items={persona.motivations} color="text-emerald-400" />
        <PersonaSection icon={Smartphone} label="Media Habits" items={persona.mediaHabits} color="text-blue-400" />
        <PersonaSection icon={ShoppingBag} label="Buying Triggers" items={persona.buyingTriggers} color="text-amber-400" />
        <PersonaSection icon={MessageSquare} label="Objections" items={persona.objections} color="text-violet-400" />
      </div>
    </div>
  );
}

export default function PersonaCards({ text }: { text: string }) {
  const personas = parsePersonas(text);

  if (!personas) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {text}
      </ReactMarkdown>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-4 rounded-full bg-gradient-to-b from-brand to-violet-500" />
        <h3 className="text-[13px] font-semibold text-tx-0">Audience Personas</h3>
        <span className="text-[10px] text-tx-3 bg-surface-2/60 border border-edge rounded-full px-2 py-0.5">
          {personas.length} profiles
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {personas.map((p, i) => (
          <PersonaCard key={i} persona={p} gradient={GRADIENTS[i % GRADIENTS.length]} />
        ))}
      </div>
    </div>
  );
}
