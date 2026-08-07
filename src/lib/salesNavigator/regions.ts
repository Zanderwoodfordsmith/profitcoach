/**
 * LinkedIn Sales Navigator REGION ids.
 *
 * Sales Nav ignores text-only REGION filters (0 results). Always include `id`.
 * Bulk catalog from Ghost Genius typeahead (every hit per search kept as its
 * own row). Curated aliases disambiguate short names (LA, Essex, Georgia, …).
 */

import ghostGeniusLocations from "./data/ghostGeniusLocations.json";

export type SalesNavRegion = { id: string; text: string };

type RegionEntry = SalesNavRegion & { aliases?: string[] };

/** Normalize for matching: lowercase, collapse spaces, strip punctuation noise. */
function normKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.’']/g, "'")
    .replace(/\s+/g, " ");
}

/**
 * Short / ambiguous names that must win over noisy typeahead rows
 * (e.g. Essex CA, Georgia the country, LA the state).
 * Listed before the bulk catalog in the alias index.
 */
const PRIORITY_ALIASES: RegionEntry[] = [
  {
    id: "101165590",
    text: "United Kingdom",
    aliases: ["uk", "u.k.", "great britain", "britain", "gb"],
  },
  { id: "102299470", text: "England, United Kingdom", aliases: ["england"] },
  {
    id: "100752109",
    text: "Scotland, United Kingdom",
    aliases: ["scotland"],
  },
  {
    id: "104238452",
    text: "Northern Ireland, United Kingdom",
    aliases: ["northern ireland", "ni"],
  },
  {
    id: "103644278",
    text: "United States",
    aliases: ["usa", "u.s.", "u.s.a.", "us", "america", "united states of america"],
  },
  {
    id: "90009496",
    text: "London Area, United Kingdom",
    aliases: ["london", "london area", "greater london area"],
  },
  {
    id: "102257491",
    text: "Greater London, England, United Kingdom",
    aliases: ["greater london"],
  },
  {
    id: "90009497",
    text: "Manchester Area, United Kingdom",
    aliases: ["manchester area"],
  },
  {
    id: "108541532",
    text: "Manchester, England, United Kingdom",
    aliases: ["manchester"],
  },
  {
    id: "90000049",
    text: "Los Angeles Metropolitan Area",
    aliases: ["la", "l.a.", "la metro", "los angeles area", "greater los angeles"],
  },
  {
    id: "102448103",
    text: "Los Angeles, California, United States",
    aliases: ["los angeles"],
  },
  {
    id: "90000084",
    text: "San Francisco Bay Area",
    aliases: ["bay area", "sf bay area"],
  },
  {
    id: "102277331",
    text: "San Francisco, California, United States",
    aliases: ["san francisco", "sf"],
  },
  {
    id: "90000070",
    text: "New York City Metropolitan Area",
    aliases: ["nyc", "nyc area", "new york city", "new york metro", "new york city area"],
  },
  {
    id: "105080838",
    text: "New York, United States",
    aliases: ["new york", "ny", "new york state"],
  },
  {
    id: "103950076",
    text: "Georgia, United States",
    aliases: ["georgia", "ga", "georgia us"],
  },
  {
    id: "103977389",
    text: "Washington, United States",
    aliases: ["washington", "washington state", "wa"],
  },
  {
    id: "102095887",
    text: "California, United States",
    aliases: ["california", "ca"],
  },
  {
    id: "102380872",
    text: "Boston, Massachusetts, United States",
    aliases: ["boston"],
  },
  {
    id: "104194190",
    text: "Dallas, Texas, United States",
    aliases: ["dallas"],
  },
  {
    id: "101116121",
    text: "District of Columbia, United States",
    aliases: ["washington dc", "washington d.c.", "dc", "district of columbia"],
  },
  {
    id: "105912292",
    text: "Wales, United Kingdom",
    aliases: ["wales"],
  },
  // UK counties (typeahead often returns US namesakes — keep curated ids)
  { id: "103872123", text: "Hertfordshire", aliases: ["herts"] },
  { id: "102575666", text: "Essex", aliases: ["essex"] },
  { id: "100174442", text: "Surrey", aliases: ["surrey"] },
  { id: "104099753", text: "Kent", aliases: ["kent"] },
  {
    id: "104058239",
    text: "Buckinghamshire",
    aliases: ["bucks", "buckinghamshire"],
  },
  {
    id: "100173647",
    text: "Cambridgeshire",
    aliases: ["cambs", "cambridgeshire"],
  },
  { id: "104058253", text: "Oxfordshire", aliases: ["oxon", "oxfordshire"] },
  { id: "104058234", text: "Bedfordshire", aliases: ["beds", "bedfordshire"] },
  { id: "104099802", text: "Suffolk", aliases: ["suffolk"] },
  { id: "104099762", text: "Norfolk", aliases: ["norfolk"] },
  { id: "104455622", text: "Yorkshire", aliases: ["yorkshire"] },
  {
    id: "101165607",
    text: "Bristol",
    aliases: ["bristol", "bristol uk", "bristol, england"],
  },
  {
    id: "104097009",
    text: "Birmingham",
    aliases: ["birmingham uk", "birmingham, england"],
  },
  {
    id: "100356971",
    text: "Birmingham, England, United Kingdom",
    aliases: [],
  },
];

function loadBulkCatalog(): RegionEntry[] {
  const raw = ghostGeniusLocations as Array<{
    id: string;
    text: string;
    aliases?: string[];
  }>;
  return raw.map((r) => ({
    id: String(r.id),
    text: r.text,
    aliases: r.aliases?.length ? [...r.aliases] : undefined,
  }));
}

/**
 * Flat catalog. Priority alias rows are consulted first via the alias index;
 * bulk Ghost Genius rows fill exact-name coverage (states, metros, cities).
 */
export const SALES_NAV_REGION_CATALOG: RegionEntry[] = [
  ...PRIORITY_ALIASES,
  ...loadBulkCatalog(),
];

/** Legacy export used by postcode helper / older call sites. */
export const SALES_NAV_UK_COUNTIES: Array<SalesNavRegion & { label: string }> =
  PRIORITY_ALIASES.filter((r) =>
    [
      "Hertfordshire",
      "Essex",
      "Surrey",
      "Kent",
      "Buckinghamshire",
      "Cambridgeshire",
      "Oxfordshire",
      "Bedfordshire",
      "Suffolk",
      "Norfolk",
      "Yorkshire",
      "Bristol",
      "Birmingham",
    ].includes(r.text)
  ).map((r) => ({ id: r.id, text: r.text, label: r.text }));

/** Postcode prefix → nearest Sales Nav region (approximate). */
export const SALES_NAV_POSTCODE_REGIONS: Record<string, SalesNavRegion> = {
  AL: { id: "103872123", text: "Hertfordshire" },
  SG: { id: "103872123", text: "Hertfordshire" },
  HP: { id: "104058239", text: "Buckinghamshire" },
  CM: { id: "102575666", text: "Essex" },
  SS: { id: "102575666", text: "Essex" },
  CO: { id: "102575666", text: "Essex" },
  IG: { id: "102575666", text: "Essex" },
  RM: { id: "102575666", text: "Essex" },
  KT: { id: "100174442", text: "Surrey" },
  RH: { id: "100174442", text: "Surrey" },
  GU: { id: "100174442", text: "Surrey" },
  CR: { id: "100174442", text: "Surrey" },
  SM: { id: "100174442", text: "Surrey" },
  TW: { id: "100174442", text: "Surrey" },
  ME: { id: "104099753", text: "Kent" },
  TN: { id: "104099753", text: "Kent" },
  DA: { id: "104099753", text: "Kent" },
  BR: { id: "104099753", text: "Kent" },
  CT: { id: "104099753", text: "Kent" },
  CB: { id: "100173647", text: "Cambridgeshire" },
  OX: { id: "104058253", text: "Oxfordshire" },
  MK: { id: "104058234", text: "Bedfordshire" },
  LU: { id: "104058234", text: "Bedfordshire" },
  IP: { id: "104099802", text: "Suffolk" },
  NR: { id: "104099762", text: "Norfolk" },
  PE: { id: "104099762", text: "Norfolk" },
  E: { id: "90009496", text: "London Area, United Kingdom" },
  N: { id: "90009496", text: "London Area, United Kingdom" },
  NW: { id: "90009496", text: "London Area, United Kingdom" },
  W: { id: "90009496", text: "London Area, United Kingdom" },
  SW: { id: "90009496", text: "London Area, United Kingdom" },
  SE: { id: "90009496", text: "London Area, United Kingdom" },
  EC: { id: "90009496", text: "London Area, United Kingdom" },
  WC: { id: "90009496", text: "London Area, United Kingdom" },
  M: { id: "108541532", text: "Manchester, England, United Kingdom" },
  SK: { id: "108541532", text: "Manchester, England, United Kingdom" },
  WA: { id: "108541532", text: "Manchester, England, United Kingdom" },
  OL: { id: "108541532", text: "Manchester, England, United Kingdom" },
  BL: { id: "108541532", text: "Manchester, England, United Kingdom" },
  B: { id: "100356971", text: "Birmingham, England, United Kingdom" },
  BS: { id: "101165607", text: "Bristol" },
};

export function resolvePostcodeRegion(raw: string): SalesNavRegion | null {
  const compact = raw.trim().toUpperCase().replace(/\s+/g, "");
  // Only treat UK-shaped postcodes (area + district digit), not city names.
  if (!/^[A-Z]{1,2}\d/.test(compact)) return null;
  const area = compact.match(/^([A-Z]{1,2})/)?.[1];
  if (!area) return null;
  return SALES_NAV_POSTCODE_REGIONS[area] ?? null;
}

type IndexHit = { id: string; text: string; score: number };

function scoreRow(
  row: RegionEntry,
  via: "text" | "alias",
  key: string
): number {
  let score = via === "text" ? 100 : 70;
  // Prefer curated priority rows
  if (PRIORITY_ALIASES.some((p) => p.id === row.id && p.text === row.text)) {
    score += 50;
  }
  // Exact admin-area shape: "California, United States"
  if (normKey(row.text) === `${key}, united states`) score += 60;
  if (normKey(row.text) === `${key}, united kingdom`) score += 60;
  // City, State, Country — only mild boost (avoid California MD beating CA)
  const parts = row.text.split(",").map((p) => p.trim());
  if (parts.length === 2 && /United States|United Kingdom/i.test(parts[1]!)) {
    score += 25;
  } else if (parts.length >= 3) {
    score -= 15;
  }
  if (/Metropolitan Area|Metroplex| Area$/i.test(row.text)) score += 12;
  return score;
}

let aliasIndex: Map<string, IndexHit[]> | null = null;

function getAliasIndex(): Map<string, IndexHit[]> {
  if (aliasIndex) return aliasIndex;
  const map = new Map<string, IndexHit[]>();
  const add = (key: string, row: RegionEntry, via: "text" | "alias") => {
    const k = normKey(key);
    if (!k) return;
    const list = map.get(k) ?? [];
    list.push({ id: row.id, text: row.text, score: scoreRow(row, via, k) });
    map.set(k, list);
  };
  for (const row of PRIORITY_ALIASES) {
    add(row.text, row, "text");
    for (const a of row.aliases ?? []) add(a, row, "alias");
  }
  for (const row of loadBulkCatalog()) {
    add(row.text, row, "text");
    for (const a of row.aliases ?? []) add(a, row, "alias");
  }
  aliasIndex = map;
  return map;
}

function matchCatalog(key: string): SalesNavRegion | null {
  const hits = getAliasIndex().get(key);
  if (!hits?.length) return null;
  hits.sort((a, b) => b.score - a.score);
  const best = hits[0]!;
  return { id: best.id, text: best.text };
}

/**
 * Resolve free-text location to a Sales Nav REGION with a LinkedIn id.
 * Text-only REGION filters are ignored by LinkedIn (0 results).
 */
export function resolveSalesNavRegion(
  location: string | null | undefined
): SalesNavRegion | null {
  const raw = location?.trim();
  if (!raw) return null;

  const direct = matchCatalog(normKey(raw));
  if (direct) return direct;

  // "London, England, United Kingdom" → try parts left-to-right (city first)
  if (raw.includes(",")) {
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    for (const part of parts) {
      const hit = matchCatalog(normKey(part));
      if (hit) return hit;
    }
  }

  return resolvePostcodeRegion(raw);
}

/** Merge helper for ingesting typeahead dumps (dedupe by id+text). */
export function mergeRegionEntries(entries: RegionEntry[]): RegionEntry[] {
  const byKey = new Map<string, RegionEntry>();
  for (const e of [...SALES_NAV_REGION_CATALOG, ...entries]) {
    const key = `${e.id}|${normKey(e.text)}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        id: e.id,
        text: e.text,
        aliases: [...(e.aliases ?? [])],
      });
      continue;
    }
    const aliases = new Set([
      ...(existing.aliases ?? []),
      ...(e.aliases ?? []),
    ]);
    byKey.set(key, { ...existing, aliases: [...aliases] });
  }
  return [...byKey.values()];
}
