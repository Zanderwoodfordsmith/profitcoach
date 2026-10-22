"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DirectoryCard } from "@/lib/directoryPage/list";
import { UK_GRID, WORLD_GRID } from "@/lib/directoryPage/mapDots";
import { regionLabel } from "@/lib/directoryPage/places";

export type MapView = "uk" | "world";

type Props = {
  view: MapView;
  /** Coaches that match the search. Pins and counts follow these. */
  cards: DirectoryCard[];
  area: string | null;
  hover: string | null;
  /** The coach whose card the visitor is pointing at. */
  hot: string | null;
  onArea: (area: string | null) => void;
  onHover: (area: string | null) => void;
};

const countryName = new Intl.DisplayNames(["en-GB"], { type: "region" });

export function areaLabel(area: string): string {
  if (area.startsWith("country:")) return countryName.of(area.slice(8)) ?? area.slice(8);
  return regionLabel(area) ?? area;
}

/** The area a coach sits in on each map: a UK region, or a country. */
export function areaOf(card: DirectoryCard, view: MapView): string | null {
  if (!card.place) return null;
  return view === "uk" ? card.place.region : `country:${card.place.country}`;
}

type Pin = { key: string; area: string; x: number; y: number; slugs: string[] };

/** Same-area coaches closer than `gap` (map units) share one pin. */
function clusterPins(points: { area: string; x: number; y: number; slug: string }[], gap: number): Pin[] {
  const pins: (Pin & { n: number })[] = [];
  for (const p of points) {
    const near = pins.find((q) => q.area === p.area && Math.hypot(q.x - p.x, q.y - p.y) < gap);
    if (near) {
      near.x = (near.x * near.n + p.x) / (near.n + 1);
      near.y = (near.y * near.n + p.y) / (near.n + 1);
      near.n += 1;
      near.slugs.push(p.slug);
    } else {
      pins.push({ key: `${p.area}-${pins.length}`, area: p.area, x: p.x, y: p.y, slugs: [p.slug], n: 1 });
    }
  }
  return pins;
}

function dotState(group: string, live: Set<string>, area: string | null, hover: string | null) {
  if (group === area) return "on";
  if (group === hover) return "hover";
  return live.has(group) ? "live" : "base";
}

/* ---------- UK and Ireland: flat dot grid ---------- */

const UK_PATHS = Object.entries(UK_GRID.dots).map(([group, pairs]) => {
  let d = "";
  for (let i = 0; i < pairs.length; i += 2) d += `M${pairs[i] + 0.5} ${pairs[i + 1] + 0.5}h0`;
  return { group, d };
});

const UK_CELLS = new Map<string, string>();
for (const [group, pairs] of Object.entries(UK_GRID.dots)) {
  for (let i = 0; i < pairs.length; i += 2) UK_CELLS.set(`${pairs[i]},${pairs[i + 1]}`, group);
}

function ukPoint(lat: number, lng: number) {
  return {
    x: ((lng - UK_GRID.west) * UK_GRID.k) / UK_GRID.step + 0.5,
    y: (UK_GRID.north - lat) / UK_GRID.step + 0.5,
  };
}

/** The region under a point on the grid, looking one cell around for coastlines. */
function ukGroupAt(col: number, row: number): string | null {
  const c = Math.floor(col);
  const r = Math.floor(row);
  for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const g = UK_CELLS.get(`${c + dc},${r + dr}`);
    if (g) return g;
  }
  return null;
}

/* ---------- World: a dotted globe ---------- */

const RAD = Math.PI / 180;

/** Grid dots thinned towards the poles so the globe reads evenly. */
const GLOBE_DOTS = Object.entries(WORLD_GRID.dots).flatMap(([group, pairs]) => {
  const out: { group: string; lat: number; lng: number }[] = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const lat = WORLD_GRID.north - pairs[i + 1] * WORLD_GRID.step;
    const every = Math.max(1, Math.round(1 / Math.cos(lat * RAD)));
    if (pairs[i] % every) continue;
    let lng = WORLD_GRID.west + pairs[i] * WORLD_GRID.step;
    if (lng > 180) lng -= 360;
    out.push({ group: `country:${group}`, lat, lng });
  }
  return out;
});

type Center = { lat: number; lng: number };

/** Orthographic projection; depth is 1 facing the viewer, 0 at the edge. */
function project(lat: number, lng: number, c: Center) {
  const p = lat * RAD;
  const p0 = c.lat * RAD;
  const dl = (lng - c.lng) * RAD;
  const depth = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(dl);
  return {
    x: Math.cos(p) * Math.sin(dl),
    y: -(Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(dl)),
    depth,
  };
}

/** Opening angle: the UK up and left, the Americas and Europe both in view. */
const HOME: Center = { lat: 34, lng: -32 };
const GLOBE_PAD = 1.06;

function globeCenterFor(area: string | null, cards: DirectoryCard[]): Center {
  if (!area?.startsWith("country:")) return HOME;
  const placed = cards.filter((c) => `country:${c.place?.country}` === area && c.place?.lat != null);
  if (!placed.length) return HOME;
  const lat = placed.reduce((s, c) => s + (c.place!.lat ?? 0), 0) / placed.length;
  const lng = placed.reduce((s, c) => s + (c.place!.lng ?? 0), 0) / placed.length;
  return { lat: Math.max(-30, Math.min(40, lat)), lng };
}

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Turns the globe towards `target` along the short way round. */
function useSpin(target: Center): Center {
  const [center, setCenter] = useState(target);
  const from = useRef(target);
  const live = useRef(target);

  useEffect(() => {
    from.current = live.current;
    let dl = target.lng - from.current.lng;
    if (dl > 180) dl -= 360;
    if (dl < -180) dl += 360;
    const start = performance.now();
    const ms = reducedMotion() ? 0 : 900;
    let frame = 0;
    const tick = (now: number) => {
      const t = ms ? Math.min(1, (now - start) / ms) : 1;
      const e = 1 - Math.pow(1 - t, 4);
      live.current = {
        lat: from.current.lat + (target.lat - from.current.lat) * e,
        lng: from.current.lng + dl * e,
      };
      setCenter(live.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target.lat, target.lng]);

  return center;
}

/* ---------- The map ---------- */

export function DotMap({ view, cards, area, hover, hot, onArea, onHover }: Props) {
  const ukLive = useMemo(() => new Set(cards.map((c) => c.place?.region).filter(Boolean) as string[]), [cards]);
  const worldLive = useMemo(
    () => new Set(cards.map((c) => (c.place ? `country:${c.place.country}` : "")).filter(Boolean)),
    [cards],
  );

  const ukPins = useMemo(
    () =>
      clusterPins(
        cards.flatMap((c) =>
          c.place?.region && c.place.lat != null && c.place.lng != null
            ? [{ area: c.place.region, slug: c.slug, ...ukPoint(c.place.lat, c.place.lng) }]
            : [],
        ),
        3,
      ),
    [cards],
  );

  const globeTarget = useMemo(() => globeCenterFor(area, cards), [area, cards]);
  const center = useSpin(view === "world" ? globeTarget : HOME);

  const globePaths = useMemo(() => {
    const buckets = new Map<string, string>();
    for (const dot of GLOBE_DOTS) {
      const p = project(dot.lat, dot.lng, center);
      if (p.depth <= 0.02) continue;
      const band = p.depth > 0.55 ? 0 : p.depth > 0.25 ? 1 : 2;
      const key = `${dotState(dot.group, worldLive, area, hover)}|${band}`;
      buckets.set(key, (buckets.get(key) ?? "") + `M${p.x.toFixed(3)} ${p.y.toFixed(3)}h0`);
    }
    return [...buckets].map(([key, d]) => {
      const [state, band] = key.split("|");
      return { key, state, band, d };
    });
  }, [center, worldLive, area, hover]);

  const globePins = useMemo(() => {
    const byCountry = new Map<string, DirectoryCard[]>();
    for (const c of cards) {
      if (!c.place || c.place.lat == null) continue;
      const k = `country:${c.place.country}`;
      byCountry.set(k, [...(byCountry.get(k) ?? []), c]);
    }
    return [...byCountry].flatMap(([k, list]) => {
      const lat = list.reduce((s, c) => s + (c.place!.lat ?? 0), 0) / list.length;
      const lng = list.reduce((s, c) => s + (c.place!.lng ?? 0), 0) / list.length;
      const p = project(lat, lng, center);
      if (p.depth < 0.12) return [];
      return [{ key: k, area: k, x: p.x, y: p.y, slugs: list.map((c) => c.slug) }];
    });
  }, [cards, center]);

  // Where the UK sits on the globe, so the zoom between maps lands on it.
  const ukOnGlobe = project(54.5, -3, center);
  const zoomOrigin = `${((ukOnGlobe.x + GLOBE_PAD) / (GLOBE_PAD * 2)) * 100}% ${((ukOnGlobe.y + GLOBE_PAD) / (GLOBE_PAD * 2)) * 100}%`;

  function pickUk(e: React.MouseEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const g = ukGroupAt(
      ((e.clientX - box.left) / box.width) * UK_GRID.cols,
      ((e.clientY - box.top) / box.height) * UK_GRID.rows,
    );
    return g && ukLive.has(g) ? g : null;
  }

  function pickGlobe(e: React.MouseEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * GLOBE_PAD * 2 - GLOBE_PAD;
    const y = ((e.clientY - box.top) / box.height) * GLOBE_PAD * 2 - GLOBE_PAD;
    let best: string | null = null;
    let bestD = 0.004;
    for (const dot of GLOBE_DOTS) {
      if (!worldLive.has(dot.group)) continue;
      const p = project(dot.lat, dot.lng, center);
      if (p.depth <= 0.02) continue;
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = dot.group;
      }
    }
    return best;
  }

  const pinState = (pin: Pin) => ({
    "data-on": pin.area === area || undefined,
    "data-dim": (area && pin.area !== area) || undefined,
    "data-hot": (hot && pin.slugs.includes(hot)) || pin.area === hover || undefined,
  });

  const pinLabel = (pin: Pin) =>
    `${areaLabel(pin.area)}: ${pin.slugs.length} coach${pin.slugs.length === 1 ? "" : "es"}`;

  return (
    <div className="dv1-map" style={{ ["--dv1-zoom-origin" as string]: zoomOrigin }}>
      <div className="dv1-layer dv1-layer--uk" data-on={view === "uk" || undefined} aria-hidden={view !== "uk"}>
        <div className="dv1-box" style={{ ["--dv1-ar" as string]: `${UK_GRID.cols} / ${UK_GRID.rows}` }}>
          <svg
            className="dv1-svg"
            viewBox={`0 0 ${UK_GRID.cols} ${UK_GRID.rows}`}
            role="img"
            aria-label="Map of the UK and Ireland"
            onPointerMove={(e) => {
              const g = pickUk(e);
              e.currentTarget.style.cursor = g ? "pointer" : "";
              if (g !== hover) onHover(g);
            }}
            onPointerLeave={() => onHover(null)}
            onClick={(e) => {
              const g = pickUk(e);
              if (g) onArea(g === area ? null : g);
            }}
          >
            {UK_PATHS.map(({ group, d }) => (
              <path key={group} className="dv1-dots" data-state={dotState(group, ukLive, area, hover)} d={d} />
            ))}
          </svg>
          {ukPins.map((pin) => (
            <button
              key={pin.key}
              type="button"
              className={pin.slugs.length > 1 ? "dv1-pin dv1-pin--group" : "dv1-pin"}
              tabIndex={view === "uk" ? 0 : -1}
              style={{ left: `${(pin.x / UK_GRID.cols) * 100}%`, top: `${(pin.y / UK_GRID.rows) * 100}%` }}
              aria-label={pinLabel(pin)}
              aria-pressed={pin.area === area}
              onClick={() => onArea(pin.area === area ? null : pin.area)}
              onPointerEnter={() => onHover(pin.area)}
              onPointerLeave={() => onHover(null)}
              {...pinState(pin)}
            >
              {pin.slugs.length > 1 ? <span className="dv1-pin__n">{pin.slugs.length}</span> : null}
              <span className="dv1-pin__tip" aria-hidden>
                {pinLabel(pin)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="dv1-layer dv1-layer--world" data-on={view === "world" || undefined} aria-hidden={view !== "world"}>
        <div className="dv1-box" style={{ ["--dv1-ar" as string]: "1 / 1" }}>
          <svg
            className="dv1-svg"
            viewBox={`${-GLOBE_PAD} ${-GLOBE_PAD} ${GLOBE_PAD * 2} ${GLOBE_PAD * 2}`}
            role="img"
            aria-label="Globe showing where coaches are"
            onPointerMove={(e) => {
              const g = pickGlobe(e);
              e.currentTarget.style.cursor = g ? "pointer" : "";
              if (g !== hover) onHover(g);
            }}
            onPointerLeave={() => onHover(null)}
            onClick={(e) => {
              const g = pickGlobe(e);
              if (g) onArea(g === area ? null : g);
            }}
          >
            <defs>
              <radialGradient id="dv1-globe-body" cx="38%" cy="32%" r="75%">
                <stop offset="0%" stopColor="#2c3b4b" />
                <stop offset="100%" stopColor="#18212b" />
              </radialGradient>
            </defs>
            <circle className="dv1-globe__rim" r="1.02" />
            <circle r="1" fill="url(#dv1-globe-body)" />
            {globePaths.map(({ key, state, band, d }) => (
              <path key={key} className="dv1-dots dv1-dots--globe" data-state={state} data-band={band} d={d} />
            ))}
          </svg>
          {globePins.map((pin) => (
            <button
              key={pin.key}
              type="button"
              className={pin.slugs.length > 1 ? "dv1-pin dv1-pin--group" : "dv1-pin"}
              tabIndex={view === "world" ? 0 : -1}
              style={{
                left: `${((pin.x + GLOBE_PAD) / (GLOBE_PAD * 2)) * 100}%`,
                top: `${((pin.y + GLOBE_PAD) / (GLOBE_PAD * 2)) * 100}%`,
              }}
              aria-label={pinLabel(pin)}
              aria-pressed={pin.area === area}
              onClick={() => onArea(pin.area === area ? null : pin.area)}
              onPointerEnter={() => onHover(pin.area)}
              onPointerLeave={() => onHover(null)}
              {...pinState(pin)}
            >
              {pin.slugs.length > 1 ? <span className="dv1-pin__n">{pin.slugs.length}</span> : null}
              <span className="dv1-pin__tip" aria-hidden>
                {pinLabel(pin)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
