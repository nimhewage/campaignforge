"use client";

import { useEffect, useRef } from "react";

/* ------------------------------------------------------------------ */
/*  Data — deliberately asymmetric, organic layout                     */
/* ------------------------------------------------------------------ */

interface AgentNode {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  glow: string;
  phase: number;
  speed: number;
}

interface SubNode {
  id: string;
  label: string;
  parentId: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  icon: string;
  phase: number;
}

interface Edge {
  from: string;
  to: string;
  type: "core" | "sub";
}

const AGENTS: AgentNode[] = [
  { id: "orch", label: "Orchestrator", x: 430, y: 55, radius: 23, color: "#818cf8", glow: "rgba(129,140,248,0.28)", phase: 0, speed: 0.7 },
  { id: "res", label: "Research Agent", x: 155, y: 185, radius: 20, color: "#a78bfa", glow: "rgba(167,139,250,0.24)", phase: 1.2, speed: 0.9 },
  { id: "trend", label: "Trend Agent", x: 710, y: 155, radius: 19, color: "#c084fc", glow: "rgba(192,132,252,0.24)", phase: 2.4, speed: 0.75 },
  { id: "content", label: "Content Agent", x: 280, y: 365, radius: 18, color: "#f472b6", glow: "rgba(244,114,182,0.22)", phase: 0.6, speed: 1.0 },
  { id: "strat", label: "Strategy Agent", x: 680, y: 330, radius: 18, color: "#34d399", glow: "rgba(52,211,153,0.22)", phase: 1.8, speed: 0.85 },
  { id: "report", label: "Report Builder", x: 500, y: 465, radius: 21, color: "#fbbf24", glow: "rgba(251,191,36,0.24)", phase: 3.0, speed: 0.8 },
];

const SUB_NODES: SubNode[] = [
  // Research — scattered left
  { id: "r_google", label: "Google", parentId: "res", x: 42, y: 105, radius: 11, color: "#60a5fa", icon: "G", phase: 0.3 },
  { id: "r_scholar", label: "Databases", parentId: "res", x: 18, y: 210, radius: 10, color: "#4ade80", icon: "DB", phase: 1.1 },
  { id: "r_market", label: "Market Data", parentId: "res", x: 55, y: 298, radius: 10, color: "#fbbf24", icon: "$", phase: 2.0 },
  { id: "r_compet", label: "Competitors", parentId: "res", x: 110, y: 82, radius: 9, color: "#f87171", icon: "vs", phase: 0.8 },
  { id: "r_news", label: "News APIs", parentId: "res", x: 30, y: 155, radius: 9, color: "#38bdf8", icon: "N", phase: 1.5 },

  // Trends — scattered right & upper
  { id: "t_tiktok", label: "TikTok", parentId: "trend", x: 870, y: 88, radius: 11, color: "#e879f9", icon: "Tk", phase: 0.4 },
  { id: "t_insta", label: "Instagram", parentId: "trend", x: 895, y: 185, radius: 11, color: "#fb923c", icon: "Ig", phase: 1.3 },
  { id: "t_x", label: "X / Twitter", parentId: "trend", x: 850, y: 252, radius: 10, color: "#94a3b8", icon: "X", phase: 2.2 },
  { id: "t_linkedin", label: "LinkedIn", parentId: "trend", x: 810, y: 62, radius: 10, color: "#60a5fa", icon: "in", phase: 0.7 },
  { id: "t_reddit", label: "Reddit", parentId: "trend", x: 915, y: 138, radius: 9, color: "#f97316", icon: "R", phase: 1.9 },

  // Content — scattered lower-left
  { id: "c_copy", label: "Copywriting", parentId: "content", x: 108, y: 340, radius: 10, color: "#f472b6", icon: "Aa", phase: 0.5 },
  { id: "c_seo", label: "SEO Engine", parentId: "content", x: 132, y: 425, radius: 10, color: "#4ade80", icon: "SE", phase: 1.4 },
  { id: "c_templ", label: "Templates", parentId: "content", x: 195, y: 470, radius: 9, color: "#a78bfa", icon: "T", phase: 2.3 },
  { id: "c_tone", label: "Tone Analysis", parentId: "content", x: 165, y: 290, radius: 9, color: "#fbbf24", icon: "~", phase: 0.9 },

  // Strategy — scattered right
  { id: "s_analytics", label: "Analytics", parentId: "strat", x: 845, y: 310, radius: 10, color: "#34d399", icon: "An", phase: 0.6 },
  { id: "s_budget", label: "Budget Calc", parentId: "strat", x: 830, y: 395, radius: 10, color: "#fbbf24", icon: "$", phase: 1.5 },
  { id: "s_channel", label: "Channels", parentId: "strat", x: 770, y: 440, radius: 9, color: "#60a5fa", icon: "Ch", phase: 2.1 },
  { id: "s_roi", label: "ROI Model", parentId: "strat", x: 800, y: 260, radius: 9, color: "#f87171", icon: "%", phase: 0.2 },

  // Report — scattered bottom
  { id: "rp_pdf", label: "PDF Export", parentId: "report", x: 370, y: 510, radius: 10, color: "#f87171", icon: "Pd", phase: 0.4 },
  { id: "rp_dash", label: "Dashboard", parentId: "report", x: 445, y: 535, radius: 9, color: "#60a5fa", icon: "D", phase: 1.6 },
  { id: "rp_kpi", label: "KPI Scores", parentId: "report", x: 570, y: 540, radius: 9, color: "#4ade80", icon: "K", phase: 2.5 },
  { id: "rp_brief", label: "Exec Brief", parentId: "report", x: 640, y: 500, radius: 10, color: "#fbbf24", icon: "Ex", phase: 0.8 },
];

const CORE_EDGES: Edge[] = [
  { from: "orch", to: "res", type: "core" },
  { from: "orch", to: "trend", type: "core" },
  { from: "res", to: "content", type: "core" },
  { from: "res", to: "strat", type: "core" },
  { from: "trend", to: "content", type: "core" },
  { from: "trend", to: "strat", type: "core" },
  { from: "content", to: "report", type: "core" },
  { from: "strat", to: "report", type: "core" },
];

const SUB_EDGES: Edge[] = SUB_NODES.map((sn) => ({ from: sn.parentId, to: sn.id, type: "sub" as const }));
const ALL_EDGES = [...CORE_EDGES, ...SUB_EDGES];

const W = 960;
const H = 570;

/* ------------------------------------------------------------------ */
/*  Particles                                                          */
/* ------------------------------------------------------------------ */

interface Particle {
  progress: number;
  edgeIdx: number;
  speed: number;
  size: number;
  returning: boolean;
}

function initParticles(): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < 14; i++) {
    out.push({ progress: Math.random(), edgeIdx: Math.floor(Math.random() * CORE_EDGES.length), speed: 0.002 + Math.random() * 0.003, size: 3 + Math.random() * 2, returning: false });
  }
  for (let i = 0; i < 30; i++) {
    out.push({ progress: Math.random(), edgeIdx: CORE_EDGES.length + Math.floor(Math.random() * SUB_EDGES.length), speed: 0.003 + Math.random() * 0.005, size: 1.2 + Math.random() * 1.5, returning: Math.random() > 0.5 });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const nodeMap = new Map<string, { x: number; y: number; color: string }>([
  ...AGENTS.map((a) => [a.id, { x: a.x, y: a.y, color: a.color }] as const),
  ...SUB_NODES.map((s) => [s.id, { x: s.x, y: s.y, color: s.color }] as const),
]);

function pos(id: string, sx: number, sy: number): [number, number] {
  const n = nodeMap.get(id);
  return n ? [n.x * sx, n.y * sy] : [0, 0];
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AgentNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const tRef = useRef(0);
  const particles = useRef(initParticles());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const r = canvas.getBoundingClientRect();
      const cw = r.width, ch = r.height;
      const sx = cw / W, sy = ch / H;
      ctx.clearRect(0, 0, cw, ch);
      tRef.current += 0.016;
      const t = tRef.current;

      /* ── Sub edges ── */
      for (const e of SUB_EDGES) {
        const [x1, y1] = pos(e.from, sx, sy);
        const [x2, y2] = pos(e.to, sx, sy);
        const col = nodeMap.get(e.to)?.color || "#818cf8";
        const [cr, cg, cb] = hexToRgb(col);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = "rgba(255,255,255,0.02)";
        ctx.lineWidth = 0.7;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.setLineDash([2, 6]);
        ctx.lineDashOffset = -t * 14;
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.08)`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      /* ── Core edges ── */
      for (let i = 0; i < CORE_EDGES.length; i++) {
        const e = CORE_EDGES[i];
        const [x1, y1] = pos(e.from, sx, sy);
        const [x2, y2] = pos(e.to, sx, sy);
        const cx1 = x1 + (x2 - x1) * 0.3 + (i % 2 === 0 ? -12 : 14) * sx;
        const cy1 = y1 + (y2 - y1) * 0.25 - 20 * sy;
        const cx2 = x1 + (x2 - x1) * 0.7 + (i % 3 === 0 ? 10 : -8) * sx;
        const cy2 = y1 + (y2 - y1) * 0.75 + 8 * sy;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2);
        ctx.strokeStyle = "rgba(255,255,255,0.035)";
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2);
        ctx.setLineDash([5, 8]);
        ctx.lineDashOffset = -(t * 20 + i * 14);
        ctx.strokeStyle = "rgba(129,140,248,0.1)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      /* ── Particles ── */
      for (const p of particles.current) {
        p.progress += p.speed * (p.returning ? -1 : 1);
        if (p.progress > 1 || p.progress < 0) {
          p.returning = !p.returning;
          p.progress = Math.max(0, Math.min(1, p.progress));
          if (!p.returning && p.edgeIdx >= CORE_EDGES.length && Math.random() > 0.55) {
            p.edgeIdx = CORE_EDGES.length + Math.floor(Math.random() * SUB_EDGES.length);
          }
        }

        const edge = ALL_EDGES[p.edgeIdx];
        if (!edge) continue;
        const [x1, y1] = pos(edge.from, sx, sy);
        const [x2, y2] = pos(edge.to, sx, sy);

        let px: number, py: number;
        if (edge.type === "core") {
          const i = CORE_EDGES.indexOf(edge);
          const cx1 = x1 + (x2 - x1) * 0.3 + (i % 2 === 0 ? -12 : 14) * sx;
          const cy1 = y1 + (y2 - y1) * 0.25 - 20 * sy;
          const cx2 = x1 + (x2 - x1) * 0.7 + (i % 3 === 0 ? 10 : -8) * sx;
          const cy2 = y1 + (y2 - y1) * 0.75 + 8 * sy;
          const u = p.progress, v = 1 - u;
          px = v * v * v * x1 + 3 * v * v * u * cx1 + 3 * v * u * u * cx2 + u * u * u * x2;
          py = v * v * v * y1 + 3 * v * v * u * cy1 + 3 * v * u * u * cy2 + u * u * u * y2;
        } else {
          px = x1 + (x2 - x1) * p.progress;
          py = y1 + (y2 - y1) * p.progress;
        }

        const alpha = Math.sin(p.progress * Math.PI) * 0.75;
        const col = nodeMap.get(edge.to)?.color || "#818cf8";
        const [cr, cg, cb] = hexToRgb(col);
        const g = ctx.createRadialGradient(px, py, 0, px, py, p.size * 2.5);
        g.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`);
        g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.beginPath();
        ctx.arc(px, py, p.size * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }

      /* ── Sub nodes ── */
      for (const sn of SUB_NODES) {
        const nx = sn.x * sx, ny = sn.y * sy;
        const rad = sn.radius * Math.min(sx, sy);
        const pulse = 1 + Math.sin(t * 1.3 + sn.phase) * 0.06;
        const pr = rad * pulse;
        const [cr, cg, cb] = hexToRgb(sn.color);

        const g2 = ctx.createRadialGradient(nx, ny, 0, nx, ny, pr * 2.8);
        g2.addColorStop(0, `rgba(${cr},${cg},${cb},0.07)`);
        g2.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(nx, ny, pr * 2.8, 0, Math.PI * 2);
        ctx.fillStyle = g2;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(nx, ny, pr, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(8,8,12,0.88)";
        ctx.fill();
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${0.28 + Math.sin(t * 1.3 + sn.phase) * 0.12})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        const fs = Math.max(7, 7.5 * Math.min(sx, sy));
        ctx.font = `600 ${fs}px "SF Mono","Fira Code",monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = `rgba(${cr},${cg},${cb},0.65)`;
        ctx.fillText(sn.icon, nx, ny + 0.5);
        ctx.textBaseline = "alphabetic";

        const lfs = Math.max(7, 7.5 * Math.min(sx, sy));
        ctx.font = `400 ${lfs}px Inter,system-ui,sans-serif`;
        ctx.fillStyle = `rgba(${cr},${cg},${cb},0.3)`;
        ctx.fillText(sn.label, nx, ny + pr + lfs + 3);
      }

      /* ── Agent nodes ── */
      for (const node of AGENTS) {
        const nx = node.x * sx, ny = node.y * sy;
        const rad = node.radius * Math.min(sx, sy);
        const pulse = 1 + Math.sin(t * node.speed * 2 + node.phase) * 0.07;
        const pr = rad * pulse;
        const [cr, cg, cb] = hexToRgb(node.color);

        // outer glow
        const g1 = ctx.createRadialGradient(nx, ny, pr * 0.3, nx, ny, pr * 3.2);
        g1.addColorStop(0, node.glow);
        g1.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(nx, ny, pr * 3.2, 0, Math.PI * 2);
        ctx.fillStyle = g1;
        ctx.fill();

        // orbit ring
        ctx.beginPath();
        ctx.arc(nx, ny, pr * 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${0.04 + Math.sin(t * 0.4 + node.phase) * 0.02})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // main body
        ctx.beginPath();
        ctx.arc(nx, ny, pr, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(8,8,12,0.85)";
        ctx.fill();
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${0.5 + Math.sin(t * node.speed * 2 + node.phase) * 0.3})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // core dot
        ctx.beginPath();
        ctx.arc(nx, ny, 3.5 * Math.min(sx, sy), 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.globalAlpha = 0.55 + Math.sin(t * node.speed * 3 + node.phase) * 0.45;
        ctx.fill();
        ctx.globalAlpha = 1;

        // label
        const fs = Math.max(9, 10 * Math.min(sx, sy));
        ctx.font = `600 ${fs}px Inter,system-ui,sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(${cr},${cg},${cb},0.7)`;
        ctx.fillText(node.label, nx, ny + pr + fs + 5);
      }

      /* ── Function labels on core edges ── */
      const fnLabels = [
        { idx: 0, label: "brief.analyze()", at: 0.42 },
        { idx: 1, label: "brief.scan()", at: 0.48 },
        { idx: 2, label: "insights.create()", at: 0.5 },
        { idx: 5, label: "trends.plan()", at: 0.45 },
        { idx: 6, label: "assets.compile()", at: 0.48 },
        { idx: 7, label: "strategy.merge()", at: 0.42 },
      ];
      for (const fl of fnLabels) {
        const e = CORE_EDGES[fl.idx];
        const [x1, y1] = pos(e.from, sx, sy);
        const [x2, y2] = pos(e.to, sx, sy);
        const i = fl.idx;
        const cx1 = x1 + (x2 - x1) * 0.3 + (i % 2 === 0 ? -12 : 14) * sx;
        const cy1 = y1 + (y2 - y1) * 0.25 - 20 * sy;
        const cx2 = x1 + (x2 - x1) * 0.7 + (i % 3 === 0 ? 10 : -8) * sx;
        const cy2 = y1 + (y2 - y1) * 0.75 + 8 * sy;
        const u = fl.at, v = 1 - u;
        const fx = v * v * v * x1 + 3 * v * v * u * cx1 + 3 * v * u * u * cx2 + u * u * u * x2;
        const fy = v * v * v * y1 + 3 * v * v * u * cy1 + 3 * v * u * u * cy2 + u * u * u * y2;

        const ffs = Math.max(7, 8 * Math.min(sx, sy));
        ctx.font = `400 ${ffs}px "SF Mono","Fira Code",monospace`;
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(129,140,248,${0.12 + Math.sin(t * 0.7 + fl.idx) * 0.04})`;
        ctx.fillText(fl.label, fx, fy - 8 * sy);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <div className="relative w-full max-w-5xl mx-auto mt-2" style={{ height: "clamp(320px, 50vh, 560px)" }}>
      <canvas ref={canvasRef} className="w-full h-full" style={{ display: "block" }} />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-surface-0 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-surface-0 to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-surface-0 to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-surface-0 to-transparent pointer-events-none" />
    </div>
  );
}
