"use client";

import { useEffect, useRef, useState } from "react";
import { ISLES, WORLD, type DotGrid } from "@/lib/coachSite/mapDots";

type Props = {
  lat: number;
  lng: number;
  place: string;
};

type Layout = { scale: number; ox: number; oy: number };

const NAVY: [number, number, number] = [12, 82, 144];
const SKY: [number, number, number] = [66, 161, 238];
const HOME: [number, number, number] = [196, 207, 220];
const HOME_CSS = "rgb(196,207,220)";
const AWAY_CSS = "rgb(229,234,241)";

/** Grid units from the pin that end up lit. */
const GLOW = 15;
const WAVE_MS = 1700;

function inGrid(grid: DotGrid, lat: number, lng: number): boolean {
  return lat <= grid.north && lat >= grid.south && lng >= grid.west && lng <= grid.east;
}

/** The pin in grid units (column, row). */
function pinCell(grid: DotGrid, lat: number, lng: number): [number, number] {
  return [((lng - grid.west) * grid.k) / grid.step - 0.5, (grid.north - lat) / grid.step - 0.5];
}

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function formatCoord(lat: number, lng: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lng).toFixed(2)}° ${ew}`;
}

/**
 * Dot-matrix map with the coach's town lit outward from a pin. Drawn on canvas
 * (a few thousand dots), animated once on load as a wave from the pin.
 */
export function TerritoryMap({ lat, lng, place }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pinAt, setPinAt] = useState<{ x: number; y: number; side: "left" | "right" } | null>(null);

  const grid = inGrid(ISLES, lat, lng) ? ISLES : WORLD;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const [pc, pr] = pinCell(grid, lat, lng);
    const dots: { x: number; y: number; home: boolean; d: number }[] = [];
    grid.lines.forEach((line, r) => {
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        if (ch === ".") continue;
        dots.push({ x: c, y: r, home: ch === "#" || grid === WORLD, d: Math.hypot(c - pc, r - pr) });
      }
    });

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let layout: Layout = { scale: 1, ox: 0, oy: 0 };
    let frame = 0;
    let start = 0;

    const measure = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const contain = Math.min(w / grid.cols, h / grid.rows);
      const cover = Math.max(w / grid.cols, h / grid.rows);
      // Wide, short boxes (phones) crop in around the pin; tall boxes show the whole map.
      const useCover = w / h > (grid.cols / grid.rows) * 1.05;
      const scale = useCover ? Math.min(cover, contain * 2.2) : contain * 0.96;
      let ox = (w - grid.cols * scale) / 2;
      let oy = (h - grid.rows * scale) / 2;
      if (useCover) {
        ox = Math.min(0, Math.max(w - grid.cols * scale, w * 0.42 - (pc + 0.5) * scale));
        oy = Math.min(0, Math.max(h - grid.rows * scale, h * 0.5 - (pr + 0.5) * scale));
      }
      layout = { scale, ox, oy };
      const x = ox + (pc + 0.5) * scale;
      const y = oy + (pr + 0.5) * scale;
      setPinAt({ x, y, side: x > w * 0.62 ? "left" : "right" });
    };

    const draw = (t: number) => {
      const { scale, ox, oy } = layout;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const front = reduce ? Infinity : (t / WAVE_MS) * (GLOW * 3.2);
      for (const dot of dots) {
        const cx = ox + (dot.x + 0.5) * scale;
        const cy = oy + (dot.y + 0.5) * scale;
        let r = scale * (dot.home ? 0.3 : 0.24);
        let fill = dot.home ? HOME_CSS : AWAY_CSS;
        if (dot.home && dot.d < GLOW) {
          const reached = front >= dot.d;
          if (reached) {
            const k = dot.d / GLOW;
            fill = k < 0.5 ? mix(NAVY, SKY, k * 2) : mix(SKY, HOME, (k - 0.5) * 2);
            // A short swell as the wave passes.
            const since = front - dot.d;
            if (since < 2.4) r *= 1 + 0.55 * (1 - since / 2.4);
          }
        }
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
      }
    };

    const tick = (now: number) => {
      if (!start) start = now;
      const t = now - start;
      draw(t);
      if (t < WAVE_MS * 1.6) frame = requestAnimationFrame(tick);
    };

    measure();
    if (reduce) draw(Infinity);
    else frame = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => {
      measure();
      draw(Infinity);
    });
    ro.observe(wrap);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [grid, lat, lng]);

  return (
    <div className="cs-map" ref={wrapRef} role="img" aria-label={`Map with ${place} marked`}>
      <canvas ref={canvasRef} aria-hidden="true" />
      {pinAt ? (
        <>
          <span className="cs-map__pin" style={{ left: pinAt.x, top: pinAt.y }} aria-hidden="true" />
          <span
            className="cs-map__label"
            data-side={pinAt.side}
            style={{ left: pinAt.x, top: pinAt.y }}
            aria-hidden="true"
          >
            <span>Based in</span>
            <strong>{place}</strong>
            <span>{formatCoord(lat, lng)}</span>
          </span>
        </>
      ) : null}
    </div>
  );
}
