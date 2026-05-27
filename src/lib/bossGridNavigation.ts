import { getPlaybookMeta } from "@/lib/bossData";

/** Same-origin app paths only — blocks open redirects via returnTo. */
export function safeAppReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  return trimmed;
}

export function playbookDetailUrl(
  playbookLinkBase: string,
  ref: string,
  returnTo?: string | null
): string {
  const path = `${playbookLinkBase}/${ref}`;
  const safeReturn = safeAppReturnTo(returnTo);
  if (!safeReturn) return path;
  return `${path}?returnTo=${encodeURIComponent(safeReturn)}`;
}

export type BossGridDirection = "up" | "down" | "left" | "right";

export type BossGridNeighbor = {
  ref: string;
  name: string;
};

export type BossGridNeighbors = Partial<Record<BossGridDirection, BossGridNeighbor>>;

function formatPlaybookRef(level: number, area: number): string {
  return `${level}.${area}`;
}

/** Adjacent playbooks in the BOSS grid (up/down = level, left/right = area). */
export function getBossGridNeighbors(ref: string): BossGridNeighbors {
  const meta = getPlaybookMeta(ref);
  if (!meta) return {};

  const neighbors: BossGridNeighbors = {};
  const { level, area } = meta;

  const add = (direction: BossGridDirection, nextLevel: number, nextArea: number) => {
    const nextRef = formatPlaybookRef(nextLevel, nextArea);
    const nextMeta = getPlaybookMeta(nextRef);
    if (!nextMeta) return;
    neighbors[direction] = { ref: nextRef, name: nextMeta.name };
  };

  if (level < 5) add("up", level + 1, area);
  if (level > 1) add("down", level - 1, area);
  if (area < 9) add("right", level, area + 1);
  if (area > 0) add("left", level, area - 1);

  return neighbors;
}
