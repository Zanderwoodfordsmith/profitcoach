/** Unicode icons matching the public /ladder marketing page */
export const ICON_BRONZE = "\u25C8";
export const ICON_METAL = "\u2B31";
export const ICON_GEM = "\u25C6";
export const ICON_DIAMOND = "\u25C7";

export type LadderPhaseKey = "onramp" | "metals" | "gemstones" | "diamonds";

export type LadderLevelId =
  | "bronze_i"
  | "bronze_ii"
  | "bronze_iii"
  | "silver"
  | "gold"
  | "platinum"
  | "emerald"
  | "ruby"
  | "sapphire"
  | "diamond"
  | "blue_diamond"
  | "black_diamond";

export type LadderLevelConfig = {
  id: LadderLevelId;
  /** 1–12 for rank chips and comparisons */
  ordinal: number;
  name: string;
  phase: LadderPhaseKey;
  /** Key for `ladder.module.css` level row (e.g. bronzeI, blueDiamond) */
  cssLevelClass: string;
  iconKind: "bronze" | "metal" | "gem" | "diamond";
  amountText: string;
  clientsText: string;
  /** Tailwind classes for small rank badge in sidebar / coach UI */
  chipClassName: string;
};

export const LADDER_LEVELS: LadderLevelConfig[] = [
  {
    id: "bronze_i",
    ordinal: 1,
    name: "Bronze I",
    phase: "onramp",
    cssLevelClass: "bronzeI",
    iconKind: "bronze",
    amountText: "1st client",
    clientsText: "—",
    chipClassName:
      "border border-amber-200/90 bg-amber-50 text-amber-900 shadow-sm",
  },
  {
    id: "bronze_ii",
    ordinal: 2,
    name: "Bronze II",
    phase: "onramp",
    cssLevelClass: "bronzeIi",
    iconKind: "bronze",
    amountText: "2nd client",
    clientsText: "—",
    chipClassName:
      "border border-amber-200/90 bg-amber-50 text-amber-900 shadow-sm",
  },
  {
    id: "bronze_iii",
    ordinal: 3,
    name: "Bronze III",
    phase: "onramp",
    cssLevelClass: "bronzeIii",
    iconKind: "bronze",
    amountText: "3rd client",
    clientsText: "—",
    chipClassName:
      "border border-amber-200/90 bg-amber-100 text-amber-950 shadow-sm",
  },
  {
    id: "silver",
    ordinal: 4,
    name: "Silver",
    phase: "metals",
    cssLevelClass: "silver",
    iconKind: "metal",
    amountText: "5–10K/mo",
    clientsText: "3–5 clients",
    chipClassName:
      "border border-slate-200 bg-slate-100 text-slate-800 shadow-sm",
  },
  {
    id: "gold",
    ordinal: 5,
    name: "Gold",
    phase: "metals",
    cssLevelClass: "gold",
    iconKind: "metal",
    amountText: "10–15K/mo",
    clientsText: "5–8 clients",
    chipClassName:
      "border border-amber-200 bg-amber-100 text-amber-900 shadow-sm",
  },
  {
    id: "platinum",
    ordinal: 6,
    name: "Platinum",
    phase: "metals",
    cssLevelClass: "platinum",
    iconKind: "metal",
    amountText: "15–20K/mo",
    clientsText: "8–10 clients",
    chipClassName:
      "border border-slate-300 bg-slate-200/80 text-slate-900 shadow-sm",
  },
  {
    id: "emerald",
    ordinal: 7,
    name: "Emerald",
    phase: "gemstones",
    cssLevelClass: "emerald",
    iconKind: "gem",
    amountText: "20–30K/mo",
    clientsText: "10–15 clients",
    chipClassName:
      "border border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm",
  },
  {
    id: "ruby",
    ordinal: 8,
    name: "Ruby",
    phase: "gemstones",
    cssLevelClass: "ruby",
    iconKind: "gem",
    amountText: "30–40K/mo",
    clientsText: "15–20 clients",
    chipClassName:
      "border border-rose-200 bg-rose-50 text-rose-900 shadow-sm",
  },
  {
    id: "sapphire",
    ordinal: 9,
    name: "Sapphire",
    phase: "gemstones",
    cssLevelClass: "sapphire",
    iconKind: "gem",
    amountText: "40–50K/mo",
    clientsText: "20–25 clients",
    chipClassName:
      "border border-blue-200 bg-blue-50 text-blue-900 shadow-sm",
  },
  {
    id: "diamond",
    ordinal: 10,
    name: "Diamond",
    phase: "diamonds",
    cssLevelClass: "diamond",
    iconKind: "diamond",
    amountText: "50–75K/mo",
    clientsText: "25–38 clients",
    chipClassName:
      "border border-sky-200 bg-sky-50 text-sky-900 shadow-sm",
  },
  {
    id: "blue_diamond",
    ordinal: 11,
    name: "Blue Diamond",
    phase: "diamonds",
    cssLevelClass: "blueDiamond",
    iconKind: "diamond",
    amountText: "75–100K/mo",
    clientsText: "38–50 clients",
    chipClassName:
      "border border-blue-300 bg-blue-100 text-blue-950 shadow-sm",
  },
  {
    id: "black_diamond",
    ordinal: 12,
    name: "Black Diamond",
    phase: "diamonds",
    cssLevelClass: "blackDiamond",
    iconKind: "diamond",
    amountText: "100K+/mo",
    clientsText: "50+ clients",
    chipClassName:
      "border border-slate-800 bg-slate-900 text-white shadow-sm",
  },
];

export const LADDER_LEVEL_IDS = LADDER_LEVELS.map((l) => l.id) as LadderLevelId[];

const byId = new Map(LADDER_LEVELS.map((l) => [l.id, l]));

export function getLadderLevel(id: string | null | undefined): LadderLevelConfig | null {
  if (!id) return null;
  return byId.get(id as LadderLevelId) ?? null;
}

export function ladderOrdinal(id: string | null | undefined): number | null {
  return getLadderLevel(id)?.ordinal ?? null;
}

export function isValidLadderLevelId(
  v: unknown
): v is LadderLevelId {
  return typeof v === "string" && byId.has(v as LadderLevelId);
}

/** Admin (and similar) compact selects: milestone first, then tier name */
export function ladderAdminSelectLabel(level: LadderLevelConfig): string {
  return `${level.amountText} — ${level.name}`;
}

/** Phase headers for the marketing / coach ladder UI */
export const LADDER_PHASE_UI: Array<{
  key: LadderPhaseKey;
  label: string;
  jumpLabel: string | null;
  cssPhaseClass: string;
}> = [
  {
    key: "onramp",
    label: "Bronze Onramp",
    /** Parallels “5K JUMPS” etc.: each step is another signed client */
    jumpLabel: "NEW CLIENT JUMPS",
    cssPhaseClass: "onramp",
  },
  {
    key: "metals",
    label: "Promotion",
    jumpLabel: "5K JUMPS",
    cssPhaseClass: "metals",
  },
  {
    key: "gemstones",
    label: "Proof",
    jumpLabel: "10K JUMPS",
    cssPhaseClass: "gemstones",
  },
  {
    key: "diamonds",
    label: "Prestige",
    jumpLabel: "25K JUMPS",
    cssPhaseClass: "diamonds",
  },
];

export function iconForKind(kind: LadderLevelConfig["iconKind"]): string {
  switch (kind) {
    case "bronze":
      return ICON_BRONZE;
    case "metal":
      return ICON_METAL;
    case "gem":
      return ICON_GEM;
    case "diamond":
      return ICON_DIAMOND;
    default:
      return ICON_METAL;
  }
}

/** Levels from current → goal (exclusive of current); negative if goal is below current */
export function stepsToGoal(
  currentId: string | null | undefined,
  goalId: string | null | undefined
): number | null {
  const c = ladderOrdinal(currentId);
  const g = ladderOrdinal(goalId);
  if (c === null || g === null) return null;
  return Math.max(0, g - c);
}

/** Shape returned by GET /api/coach/ladder for each event row */
export type CommunityLadderEventDTO = {
  id: string;
  user_id: string;
  from_level: string | null;
  to_level: string;
  kind: string;
  created_at: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

/** Shape returned by GET /api/coach/ladder for each achievement row */
export type LadderAchievementDTO = {
  level_id: string;
  /** ISO date (YYYY-MM-DD) when set; null if the step is ticked without a recorded date */
  achieved_on: string | null;
};

/** Highest achieved ordinal → its level id, or null if no achievements yet */
export function deriveCurrentLevelId(
  achievements: ReadonlyArray<{ level_id: string }>
): LadderLevelId | null {
  let bestOrd = 0;
  let bestId: LadderLevelId | null = null;
  for (const a of achievements) {
    const lvl = byId.get(a.level_id as LadderLevelId);
    if (!lvl) continue;
    if (lvl.ordinal > bestOrd) {
      bestOrd = lvl.ordinal;
      bestId = lvl.id;
    }
  }
  return bestId;
}

/** Lowest level above the highest achieved ordinal — the natural "next" target */
export function deriveNextLevelId(
  achievements: ReadonlyArray<{ level_id: string }>
): LadderLevelId | null {
  const current = deriveCurrentLevelId(achievements);
  const currentOrd = current ? byId.get(current)?.ordinal ?? 0 : 0;
  for (const lvl of LADDER_LEVELS) {
    if (lvl.ordinal === currentOrd + 1) return lvl.id;
  }
  return null;
}
