"use client";

import { AvaOrb } from "@/components/ava/AvaKit";
import "@/components/ava/ava.css";

import { PearlOrb } from "./PearlOrb";
import { useCanvasLoop, type AvaState } from "./useLoop";

/*
 * Ava's symbol, five ways. Every mark takes the same props, so any screen
 * can swap one for another: size, state, and whether it sits on a dark room.
 */

export type MarkId = "pearl" | "orbit" | "halo" | "haloCore" | "dawn" | "current";

export const MARKS: { id: MarkId; name: string; line: string }[] = [
  { id: "pearl", name: "Pearl", line: "A liquid drop of light. It ripples when she thinks and swells when she talks." },
  { id: "orbit", name: "Orbit", line: "A star with two orbits. When she works, the orbits open and your numbers spin inside." },
  { id: "halo", name: "Halo", line: "A ring of light dots that builds itself. A wave runs round it as she thinks." },
  { id: "haloCore", name: "Halo with a centre", line: "New, 24 Oct: the Halo with the Orbit's star in the middle, so it never looks empty. When she works, your numbers spin inside the ring." },
  { id: "dawn", name: "Sunrise", line: "A sun coming up over a line. Her light rises when she has something for you." },
  { id: "current", name: "Today's orb", line: "The orb Ava uses now, for comparison." },
];

type MarkProps = { size: number; state?: AvaState; dark?: boolean; className?: string };

export function AvaMark({ id, ...props }: MarkProps & { id: MarkId }) {
  if (id === "pearl") return <PearlOrb {...props} />;
  if (id === "orbit") return <OrbitMark {...props} />;
  if (id === "halo") return <HaloMark {...props} />;
  if (id === "haloCore") return <HaloMark {...props} core />;
  if (id === "dawn") return <DawnMark {...props} />;
  return (
    <span className="ava-ui" style={{ display: "inline-flex" }}>
      <AvaOrb size={props.size} motion={props.size >= 40} state={props.state === "speaking" ? "speaking" : props.state === "listening" ? "listening" : undefined} />
    </span>
  );
}

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
  return { x: Math.cos(phi) * r, y, z: Math.sin(phi) * r, d: String((i * 7 + 3) % 10) };
});

function canvasStyle(_size?: number) {
  return { position: "absolute" as const, left: "-25%", top: "-25%", width: "150%", height: "150%" };
}

function Wrap({ size, className, children }: { size: number; className?: string; children: React.ReactNode }) {
  return (
    <span className={className} style={{ position: "relative", display: "inline-block", width: size, height: size, flexShrink: 0 }} aria-hidden>
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- Orbit */

export function OrbitMark({ size, state = "idle", dark = false, className }: MarkProps) {
  const ink = dark ? [255, 255, 255] : [12, 82, 144];
  const glow = dark ? [150, 205, 255] : [26, 143, 212];
  const ref = useCanvasLoop((ctx, s, t, e, v) => {
    const c = s / 2;
    const unit = s / 1.5; // the drawn mark is the middle two thirds of the canvas
    const R = unit * (0.42 + 0.14 * smooth(0.4, 1, e) + 0.03 * v);
    const thin = Math.max(1, unit / 110);

    // Core glow.
    const g = ctx.createRadialGradient(c, c, 0, c, c, unit * (0.32 + 0.22 * e + 0.15 * v));
    g.addColorStop(0, rgba(glow, 0.55 + 0.3 * e));
    g.addColorStop(0.35, rgba(glow, 0.16 + 0.12 * e));
    g.addColorStop(1, rgba(glow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);

    // Number field, only while she works.
    const field = smooth(0.55, 0.95, e);
    if (field > 0.01 && unit > 70) {
      const spin = t * 0.35;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const p of FIELD) {
        const x = p.x * Math.cos(spin) - p.z * Math.sin(spin);
        const z = p.x * Math.sin(spin) + p.z * Math.cos(spin);
        const depth = (z + 1) / 2;
        const fs = unit * 0.034 * (0.7 + 0.6 * depth);
        ctx.font = `600 ${fs}px system-ui, sans-serif`;
        ctx.fillStyle = rgba(ink, (0.12 + 0.6 * depth) * field);
        ctx.fillText(p.d, c + x * R * 0.78, c + p.y * R * 0.78);
      }
    }

    // Rings: real circles in 3D, tipped and slowly precessing.
    const rings = [
      { tilt: 1.05, yaw: 0.62, spin: 0.22, a: 1 },
      { tilt: 1.05, yaw: -0.62, spin: -0.18, a: 1 },
      { tilt: 1.42, yaw: 0, spin: 0.3, a: smooth(0.5, 1, e) },
    ];
    for (const ring of rings) {
      if (ring.a < 0.02) continue;
      const tilt = ring.tilt - 0.12 * e;
      // A gentle sway, never edge-on, while the whole mark drifts round.
      const prec = Math.sin(t * 0.5) * (0.18 + 0.14 * e);
      const N = 120;
      let px = 0;
      let py = 0;
      for (let i = 0; i <= N; i++) {
        const th = (i / N) * Math.PI * 2;
        let x = Math.cos(th) * R;
        let y = Math.sin(th) * R;
        let z = 0;
        // tip about X
        const y1 = y * Math.cos(tilt) - z * Math.sin(tilt);
        const z1 = y * Math.sin(tilt) + z * Math.cos(tilt);
        y = y1;
        z = z1;
        // precess about Y
        const x2 = x * Math.cos(prec) + z * Math.sin(prec);
        z = -x * Math.sin(prec) + z * Math.cos(prec);
        x = x2;
        // turn about Z
        const ang = ring.yaw + t * 0.06;
        const x3 = x * Math.cos(ang) - y * Math.sin(ang);
        const y3 = x * Math.sin(ang) + y * Math.cos(ang);
        if (i > 0) {
          const depth = (z / R + 1) / 2;
          ctx.strokeStyle = rgba(ink, (0.25 + 0.65 * depth) * ring.a);
          ctx.lineWidth = thin * (0.9 + 0.7 * depth);
          ctx.beginPath();
          ctx.moveTo(c + px, c + py);
          ctx.lineTo(c + x3, c + y3);
          ctx.stroke();
        }
        px = x3;
        py = y3;
      }
    }

    // The star: four soft points, breathing.
    const k = unit * (0.11 + 0.03 * Math.sin(t * 1.6) * (0.3 + e) + 0.05 * v);
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
  }, state);
  return (
    <Wrap size={size} className={className}>
      <canvas ref={ref} style={canvasStyle(size)} />
    </Wrap>
  );
}

/* ----------------------------------------------------------------- Halo */

const HALO_SEED = Array.from({ length: 40 }, (_, i) => ({ a: (i * 137.5 * Math.PI) / 180, r: 1.6 + ((i * 53) % 17) / 17 }));

function mix(a: readonly number[], b: readonly number[], t: number) {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
}

/** The Halo's centre: a soft glow and the Orbit's star, with your numbers spinning inside while she works. */
function drawCore(ctx: CanvasRenderingContext2D, c: number, unit: number, R: number, t: number, e: number, v: number, build: number, dark: boolean) {
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

export function HaloMark({ size, state = "idle", dark = false, className, core = false }: MarkProps & { core?: boolean }) {
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
      <canvas ref={ref} style={canvasStyle(size)} />
    </Wrap>
  );
}

/* ----------------------------------------------------------------- Dawn */

export function DawnMark({ size, state = "idle", dark = false, className }: MarkProps) {
  const ref = useCanvasLoop((ctx, s, t, e, v) => {
    const c = s / 2;
    const unit = s / 1.5;
    const horizon = c + unit * 0.14;
    const R = unit * 0.34;
    const rise = unit * (0.04 + 0.05 * Math.sin(t * 0.5) * 0.5 + 0.08 * e + 0.04 * v);
    const sunY = horizon - rise;

    // Glow on the horizon.
    const hg = ctx.createRadialGradient(c, horizon, 0, c, horizon, Math.min(s / 2 - (horizon - c), unit * (0.6 + 0.1 * e)));
    hg.addColorStop(0, dark ? "rgba(170,220,255,0.55)" : "rgba(26,143,212,0.32)");
    hg.addColorStop(1, "rgba(26,143,212,0)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, s, s);

    // Rays, turning slowly, stronger when she works.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, s, horizon);
    ctx.clip();
    const rays = 14;
    for (let i = 0; i < rays; i++) {
      const a = Math.PI + (i / (rays - 1)) * Math.PI + Math.sin(t * 0.2 + i) * 0.03;
      const len = unit * (0.5 + 0.12 * Math.sin(t * 1.3 + i * 1.7) * (0.3 + e) + 0.1 * v);
      ctx.strokeStyle = dark ? `rgba(220,240,255,${0.18 + 0.25 * e})` : `rgba(12,82,144,${0.12 + 0.2 * e})`;
      ctx.lineWidth = Math.max(1, unit / 120);
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * R * 1.12, sunY + Math.sin(a) * R * 1.12);
      ctx.lineTo(c + Math.cos(a) * len, sunY + Math.sin(a) * len);
      ctx.stroke();
    }
    // The sun.
    const sg = ctx.createLinearGradient(0, sunY - R, 0, horizon);
    if (dark) {
      sg.addColorStop(0, "#ffffff");
      sg.addColorStop(1, "#7cc3f2");
    } else {
      sg.addColorStop(0, "#6fb8ea");
      sg.addColorStop(0.55, "#1a8fd4");
      sg.addColorStop(1, "#0c5290");
    }
    ctx.fillStyle = sg;
    ctx.shadowColor = dark ? "rgba(190,230,255,0.9)" : "rgba(26,143,212,0.5)";
    ctx.shadowBlur = unit * 0.08;
    ctx.beginPath();
    ctx.arc(c, sunY, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // The line.
    ctx.shadowBlur = 0;
    const lg = ctx.createLinearGradient(c - unit * 0.6, 0, c + unit * 0.6, 0);
    const lc = dark ? "255,255,255" : "5,30,54";
    lg.addColorStop(0, `rgba(${lc},0)`);
    lg.addColorStop(0.5, `rgba(${lc},0.95)`);
    lg.addColorStop(1, `rgba(${lc},0)`);
    ctx.fillStyle = lg;
    ctx.fillRect(c - unit * 0.6, horizon - Math.max(1, unit / 70) / 2, unit * 1.2, Math.max(1, unit / 70));

    // A faint reflection under the line.
    const rg = ctx.createLinearGradient(0, horizon, 0, horizon + unit * 0.22);
    rg.addColorStop(0, dark ? "rgba(170,220,255,0.35)" : "rgba(26,143,212,0.18)");
    rg.addColorStop(1, "rgba(26,143,212,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.ellipse(c, horizon, R * 0.9, unit * 0.2, 0, 0, Math.PI);
    ctx.fill();
  }, state);
  return (
    <Wrap size={size} className={className}>
      <canvas ref={ref} style={canvasStyle(size)} />
    </Wrap>
  );
}
