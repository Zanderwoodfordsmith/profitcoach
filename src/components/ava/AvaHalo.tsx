"use client";

import { useCanvasLoop, type AvaState } from "./haloLoop";

/*
 * Ava's symbol: the Halo with a centre. A ring of light dots that builds
 * itself, the star in the middle, and her numbers spinning inside while she
 * works. Chosen 24 Oct 2026 (Admin → Ava → Design). Drawn on a canvas, so
 * it moves; it pauses when off screen and holds still for reduced motion.
 */

export type AvaHaloProps = {
  size: number;
  state?: AvaState;
  dark?: boolean;
  className?: string;
};

function rgba(c: readonly number[], a: number) {
  return `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Digits a coach would recognise: scores, counts, money. Fixed per point.
const FIELD = Array.from({ length: 150 }, (_, i) => {
  const y = 1 - (i / 149) * 2;
  const r = Math.sqrt(1 - y * y);
  const phi = i * 2.399963;
  return {
    x: Math.cos(phi) * r,
    y,
    z: Math.sin(phi) * r,
    d: String((i * 7 + 3) % 10),
  };
});

function canvasStyle() {
  return {
    position: "absolute" as const,
    left: "-25%",
    top: "-25%",
    width: "150%",
    height: "150%",
  };
}

function Wrap({ size, className, children }: { size: number; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={className}
      style={{
        position: "relative",
        display: "inline-block",
        width: size,
        height: size,
        flexShrink: 0,
      }}
      aria-hidden
    >
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- Halo */

const HALO_SEED = Array.from({ length: 40 }, (_, i) => ({
  a: (i * 137.5 * Math.PI) / 180,
  r: 1.6 + ((i * 53) % 17) / 17,
}));

function mix(a: readonly number[], b: readonly number[], t: number) {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
}

/** The Halo's centre: a soft glow and the Orbit's star, with your numbers spinning inside while she works. */
function drawCore(
  ctx: CanvasRenderingContext2D,
  c: number,
  unit: number,
  R: number,
  t: number,
  e: number,
  v: number,
  build: number,
  dark: boolean,
) {
  const ink = dark ? [255, 255, 255] : [12, 82, 144];
  const glow = dark ? [150, 205, 255] : [26, 143, 212];
  const g = ctx.createRadialGradient(c, c, 0, c, c, R * 0.95);
  g.addColorStop(0, rgba(glow, (0.3 + 0.25 * e + 0.2 * v) * build));
  g.addColorStop(0.5, rgba(glow, (0.08 + 0.08 * e) * build));
  g.addColorStop(1, rgba(glow, 0));
  ctx.fillStyle = g;
  ctx.fillRect(c - R, c - R, R * 2, R * 2);

  const field = smooth(0.55, 0.95, e) * build;
  if (field > 0.01 && unit > 70) {
    const spin = t * 0.35;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const p of FIELD) {
      const x = p.x * Math.cos(spin) - p.z * Math.sin(spin);
      const z = p.x * Math.sin(spin) + p.z * Math.cos(spin);
      const depth = (z + 1) / 2;
      ctx.font = `600 ${unit * 0.03 * (0.7 + 0.6 * depth)}px system-ui, sans-serif`;
      ctx.fillStyle = rgba(ink, (0.1 + 0.5 * depth) * field);
      ctx.fillText(p.d, c + x * R * 0.66, c + p.y * R * 0.66);
    }
  }

  const k = unit * (0.1 + 0.025 * Math.sin(t * 1.6) * (0.3 + e) + 0.04 * v) * smooth(0.3, 1, build);
  if (k <= 0) return;
  const w = k * 0.18;
  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(Math.sin(t * 0.3) * 0.08);
  ctx.beginPath();
  ctx.moveTo(0, -k);
  ctx.quadraticCurveTo(w, -w, k, 0);
  ctx.quadraticCurveTo(w, w, 0, k);
  ctx.quadraticCurveTo(-w, w, -k, 0);
  ctx.quadraticCurveTo(-w, -w, 0, -k);
  ctx.closePath();
  ctx.shadowColor = rgba(glow, 0.9);
  ctx.shadowBlur = unit * 0.06;
  ctx.fillStyle = dark ? "#ffffff" : "#0c5290";
  ctx.fill();
  ctx.restore();
}

export function AvaHalo({ size, state = "idle", dark = false, className, core = true }: AvaHaloProps & { core?: boolean }) {
  const from = dark ? [26, 143, 212] : [5, 30, 54];
  const midC = dark ? [140, 205, 250] : [12, 82, 144];
  const to = dark ? [255, 255, 255] : [26, 143, 212];
  const ref = useCanvasLoop((ctx, s, t, e, v) => {
    const c = s / 2;
    const unit = s / 1.5;
    const N = unit < 60 ? 18 : 36;
    const R = unit * 0.38 * (1 + 0.05 * v);
    const build = smooth(0, 1.6, t); // the ring assembles when it first appears
    for (let i = 0; i < N; i++) {
      const f = i / N;
      const a = f * Math.PI * 2 + t * (0.12 + 0.45 * e) - Math.PI / 2;
      const wave = 0.5 + 0.5 * Math.sin(a * 3 - t * (1.1 + 2.6 * e));
      const lift = wave * unit * 0.035 * (0.3 + e) + v * unit * 0.03 * Math.sin(a * 5 + t * 6);
      const local = smooth(f * 0.6, f * 0.6 + 0.4, build);
      const seed = HALO_SEED[i % HALO_SEED.length];
      const rx = c + Math.cos(a) * (R + lift);
      const ry = c + Math.sin(a) * (R + lift);
      const sx = c + Math.cos(seed.a) * R * seed.r;
      const sy = c + Math.sin(seed.a) * R * seed.r;
      const x = sx + (rx - sx) * local;
      const y = sy + (ry - sy) * local;
      const d = unit * (0.045 + 0.04 * wave * (0.35 + e)) * (N === 18 ? 1.6 : 1) * local;
      const tone = (Math.sin(f * Math.PI * 2 + t * 0.4) + 1) / 2;
      const col = tone < 0.5 ? mix(from, midC, tone * 2) : mix(midC, to, (tone - 0.5) * 2);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 4);
      ctx.fillStyle = rgba(col, (0.45 + 0.55 * wave) * local);
      if (dark) {
        ctx.shadowColor = rgba(col, 0.9);
        ctx.shadowBlur = d * 1.2;
      }
      ctx.beginPath();
      ctx.roundRect(-d / 2, -d / 2, d, d, d * 0.32);
      ctx.fill();
      ctx.restore();
    }
    if (core) drawCore(ctx, c, unit, R, t, e, v, build, dark);
  }, state);
  return (
    <Wrap size={size} className={className}>
      <canvas ref={ref} style={canvasStyle()} />
    </Wrap>
  );
}
