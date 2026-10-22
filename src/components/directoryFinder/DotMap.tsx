"use client";

import { useMemo } from "react";
import type { DirectoryCard } from "@/lib/directoryPage/list";
import { UK_GRID } from "@/lib/directoryPage/mapDots";
import { regionLabel } from "@/lib/directoryPage/places";

/** Coaches outside the UK and Ireland share one area. */
export const ABROAD = "abroad";

type Props = {
  /** Coaches that match the other filters. Pins and counts follow these. */
  cards: DirectoryCard[];
  area: string | null;
  hover: string | null;
  /** The coach whose card the visitor is pointing at. */
  hot: string | null;
  onArea: (area: string | null) => void;
  onHover: (area: string | null) => void;
};

export function areaLabel(area: string): string {
  return area === ABROAD ? "Outside the UK" : (regionLabel(area) ?? area);
}

/** A coach's area: their UK region (or Ireland), else "abroad" outside the UK. */
export function areaOf(card: DirectoryCard): string | null {
  if (!card.place) return null;
  if (card.place.region) return card.place.region;
  return card.place.country === "GB" ? null : ABROAD;
}

type Pin = { area: string; x: number; y: number; slugs: string[] };

/** Where each region's pin sits: inside the region, spaced so pins never overlap. */
const REGION_PIN: Record<string, [lat: number, lng: number]> = {
  scotland: [56.8, -4.2],
  "northern-ireland": [54.6, -6.7],
  ireland: [53.2, -8.0],
  "north-east": [55.0, -1.9],
  "north-west": [54.0, -2.75],
  yorkshire: [54.0, -1.15],
  wales: [52.3, -3.7],
  "west-midlands": [52.5, -2.3],
  "east-midlands": [52.95, -0.9],
  east: [52.4, 0.8],
  london: [51.5, -0.1],
  "south-west": [50.9, -3.6],
  "south-east": [50.95, -1.3],
};

function dotState(group: string, live: Set<string>, area: string | null, hover: string | null) {
  if (group === area) return "on";
  if (group === hover) return "hover";
  return live.has(group) ? "live" : "base";
}

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

/** The UK and Ireland in dots. Regions with coaches light up; one pin per region. */
export function DotMap({ cards, area, hover, hot, onArea, onHover }: Props) {
  const live = useMemo(() => new Set(cards.map((c) => c.place?.region).filter(Boolean) as string[]), [cards]);

  // One pin per region, so its number matches the region's count.
  const pins = useMemo(() => {
    const byRegion = new Map<string, string[]>();
    for (const c of cards) {
      const region = c.place?.region;
      if (region && REGION_PIN[region]) byRegion.set(region, [...(byRegion.get(region) ?? []), c.slug]);
    }
    return [...byRegion].map(([a, slugs]): Pin => ({ area: a, slugs, ...ukPoint(...REGION_PIN[a]) }));
  }, [cards]);

  function pick(e: React.MouseEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const g = ukGroupAt(
      ((e.clientX - box.left) / box.width) * UK_GRID.cols,
      ((e.clientY - box.top) / box.height) * UK_GRID.rows,
    );
    return g && live.has(g) ? g : null;
  }

  const label = (pin: Pin) =>
    `${areaLabel(pin.area)}: ${pin.slugs.length} coach${pin.slugs.length === 1 ? "" : "es"}`;

  return (
    <div className="dd-map">
      <div className="dd-box" style={{ ["--dd-ar" as string]: `${UK_GRID.cols} / ${UK_GRID.rows}` }}>
        <svg
          className="dd-svg"
          viewBox={`0 0 ${UK_GRID.cols} ${UK_GRID.rows}`}
          role="img"
          aria-label="Map of the UK and Ireland"
          onPointerMove={(e) => {
            const g = pick(e);
            e.currentTarget.style.cursor = g ? "pointer" : "";
            if (g !== hover) onHover(g);
          }}
          onPointerLeave={() => onHover(null)}
          onClick={(e) => {
            const g = pick(e);
            if (g) onArea(g === area ? null : g);
          }}
        >
          {UK_PATHS.map(({ group, d }) => (
            <path key={group} className="dd-dots" data-state={dotState(group, live, area, hover)} d={d} />
          ))}
        </svg>
        {pins.map((pin) => (
          <button
            key={pin.area}
            type="button"
            className="dd-pin"
            style={{ left: `${(pin.x / UK_GRID.cols) * 100}%`, top: `${(pin.y / UK_GRID.rows) * 100}%` }}
            aria-label={label(pin)}
            aria-pressed={pin.area === area}
            onClick={() => onArea(pin.area === area ? null : pin.area)}
            onPointerEnter={() => onHover(pin.area)}
            onPointerLeave={() => onHover(null)}
            data-on={pin.area === area || undefined}
            data-dim={(area && pin.area !== area) || undefined}
            data-hot={(hot && pin.slugs.includes(hot)) || pin.area === hover || undefined}
          >
            <span className="dd-pin__n">{pin.slugs.length}</span>
            <span className="dd-pin__tip" aria-hidden>
              {label(pin)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
