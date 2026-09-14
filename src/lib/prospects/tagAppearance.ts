export const DEFAULT_PROSPECT_TAGS = [
  "VIP",
  "Referral",
  "Hot",
  "Not now",
  "No-show",
  "Wrong fit",
  "Introducer",
] as const;

export type ProspectTagTone = {
  chip: string;
  swatch: string;
  check: string;
  hover: string;
  remove: string;
};

const DEFAULT_TONES: Record<(typeof DEFAULT_PROSPECT_TAGS)[number], ProspectTagTone> = {
  VIP: {
    chip: "bg-amber-50 text-amber-950 ring-amber-300",
    swatch: "bg-amber-500",
    check: "border-amber-600 bg-amber-500 text-white",
    hover: "hover:bg-amber-100",
    remove: "text-amber-800 hover:bg-amber-100",
  },
  Referral: {
    chip: "bg-violet-50 text-violet-950 ring-violet-200",
    swatch: "bg-violet-500",
    check: "border-violet-600 bg-violet-500 text-white",
    hover: "hover:bg-violet-100",
    remove: "text-violet-800 hover:bg-violet-100",
  },
  Hot: {
    chip: "bg-rose-50 text-rose-950 ring-rose-200",
    swatch: "bg-rose-500",
    check: "border-rose-600 bg-rose-500 text-white",
    hover: "hover:bg-rose-100",
    remove: "text-rose-800 hover:bg-rose-100",
  },
  "Not now": {
    chip: "bg-slate-100 text-slate-800 ring-slate-300",
    swatch: "bg-slate-500",
    check: "border-slate-600 bg-slate-600 text-white",
    hover: "hover:bg-slate-200",
    remove: "text-slate-600 hover:bg-slate-200",
  },
  "No-show": {
    chip: "bg-orange-50 text-orange-950 ring-orange-200",
    swatch: "bg-orange-500",
    check: "border-orange-600 bg-orange-500 text-white",
    hover: "hover:bg-orange-100",
    remove: "text-orange-800 hover:bg-orange-100",
  },
  "Wrong fit": {
    chip: "bg-stone-100 text-stone-800 ring-stone-300",
    swatch: "bg-stone-500",
    check: "border-stone-600 bg-stone-500 text-white",
    hover: "hover:bg-stone-200",
    remove: "text-stone-700 hover:bg-stone-200",
  },
  Introducer: {
    chip: "bg-teal-50 text-teal-950 ring-teal-200",
    swatch: "bg-teal-500",
    check: "border-teal-600 bg-teal-500 text-white",
    hover: "hover:bg-teal-100",
    remove: "text-teal-800 hover:bg-teal-100",
  },
};

const CUSTOM_TONES: ProspectTagTone[] = [
  {
    chip: "bg-sky-50 text-sky-950 ring-sky-200",
    swatch: "bg-sky-500",
    check: "border-sky-600 bg-sky-500 text-white",
    hover: "hover:bg-sky-100",
    remove: "text-sky-800 hover:bg-sky-100",
  },
  {
    chip: "bg-indigo-50 text-indigo-950 ring-indigo-200",
    swatch: "bg-indigo-500",
    check: "border-indigo-600 bg-indigo-500 text-white",
    hover: "hover:bg-indigo-100",
    remove: "text-indigo-800 hover:bg-indigo-100",
  },
  {
    chip: "bg-emerald-50 text-emerald-950 ring-emerald-200",
    swatch: "bg-emerald-500",
    check: "border-emerald-600 bg-emerald-500 text-white",
    hover: "hover:bg-emerald-100",
    remove: "text-emerald-800 hover:bg-emerald-100",
  },
  {
    chip: "bg-cyan-50 text-cyan-950 ring-cyan-200",
    swatch: "bg-cyan-500",
    check: "border-cyan-600 bg-cyan-500 text-white",
    hover: "hover:bg-cyan-100",
    remove: "text-cyan-800 hover:bg-cyan-100",
  },
  {
    chip: "bg-blue-50 text-blue-950 ring-blue-200",
    swatch: "bg-blue-500",
    check: "border-blue-600 bg-blue-500 text-white",
    hover: "hover:bg-blue-100",
    remove: "text-blue-800 hover:bg-blue-100",
  },
];

function hashTag(tag: string): number {
  let hash = 0;
  for (const char of tag.toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash);
}

export function prospectTagTone(tag: string): ProspectTagTone {
  const key = tag.trim() as (typeof DEFAULT_PROSPECT_TAGS)[number];
  if (key in DEFAULT_TONES) return DEFAULT_TONES[key];
  const named = DEFAULT_PROSPECT_TAGS.find(
    (label) => label.toLowerCase() === tag.trim().toLowerCase()
  );
  if (named) return DEFAULT_TONES[named];
  return CUSTOM_TONES[hashTag(tag) % CUSTOM_TONES.length]!;
}

export function mergeProspectTagCatalog(...lists: Array<readonly string[]>): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const list of lists) {
    for (const item of list) {
      const tag = item.trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push(tag);
    }
  }
  return tags;
}

export function sortProspectTagCatalog(
  tags: string[],
  selected: string[] = []
): string[] {
  const selectedKeys = new Set(selected.map((tag) => tag.toLowerCase()));
  const defaultIndex = new Map(
    DEFAULT_PROSPECT_TAGS.map((tag, index) => [tag.toLowerCase(), index])
  );
  return [...tags].sort((a, b) => {
    const aOn = selectedKeys.has(a.toLowerCase());
    const bOn = selectedKeys.has(b.toLowerCase());
    if (aOn !== bOn) return aOn ? -1 : 1;
    const aDefault = defaultIndex.get(a.toLowerCase());
    const bDefault = defaultIndex.get(b.toLowerCase());
    if (aDefault != null && bDefault != null) return aDefault - bDefault;
    if (aDefault != null) return -1;
    if (bDefault != null) return 1;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
}
