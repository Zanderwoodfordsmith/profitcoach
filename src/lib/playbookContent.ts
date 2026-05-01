/**
 * Playbook content types and loader for file-based playbook overview content.
 * For types only (client components), import from ./playbookContentTypes.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { AREAS, getPlaybookMeta, LEVELS, PLAYBOOKS, type BossPlaybook } from "./bossData";
import type {
  ActionItem,
  ActionSection,
  PlaybookContent,
  PlayItem,
  PlaySection,
  PlaybookSummary,
  WhatItLooksLikeItem,
} from "./playbookContentTypes";
import { normalizePlaybookActionsFromPartial, normalizeRelatedPlaybooks } from "./playbookContentTypes";
import { supabaseAdmin } from "./supabaseAdmin";

export type { PlaybookContent, PlayItem, PlaySection, PlaybookSummary, RelatedPlaybookItem, WhatItLooksLikeItem } from "./playbookContentTypes";
export type { ActionItem, ActionSection, ActionDetailSection } from "./playbookContentTypes";

/** Raw JSON may use legacy `plays` / `playsSections` / nested `plays`. */
type FilePartial = Partial<PlaybookContent> & {
  plays?: ActionItem[];
  playsIntro?: string;
  playsSections?: ActionSection[] | Array<{ title?: string; description?: string; plays?: ActionItem[]; actions?: ActionItem[] }>;
};

function getContentPath(ref: string): string {
  return path.join(process.cwd(), "content", "playbooks", `${ref}.json`);
}

function mergeWithMeta(data: FilePartial, meta: BossPlaybook): PlaybookContent {
  const { actions, actionsIntro, actionSections } = normalizePlaybookActionsFromPartial({
    actions: data.actions,
    plays: data.plays,
    actionsIntro: data.actionsIntro,
    playsIntro: data.playsIntro,
    actionSections: data.actionSections,
    playsSections: data.playsSections,
  });

  return {
    ref: data.ref ?? meta.ref,
    level: data.level ?? meta.level,
    area: data.area ?? meta.area,
    name: data.name ?? meta.name,
    subtitle: data.subtitle ?? buildSubtitle(meta.level, meta.area),
    whatThisIs: data.whatThisIs ?? "",
    whatItLooksLike: data.whatItLooksLike ?? {
      broken: { label: "When this is broken", emoji: "🔴", content: "" },
      ok: { label: "When this is OK", emoji: "🟠", content: "" },
      working: { label: "When this is working", emoji: "🟢", content: "" },
    },
    thingsToThinkAbout: data.thingsToThinkAbout ?? [],
    actions,
    actionsIntro,
    actionSections,
    quickWins: data.quickWins ?? [],
    relatedPlaybooks: normalizeRelatedPlaybooks(data.relatedPlaybooks),
    classroom: data.classroom,
  };
}

function fallbackContent(meta: BossPlaybook): PlaybookContent {
  return {
    ref: meta.ref,
    level: meta.level,
    area: meta.area,
    name: meta.name,
    subtitle: buildSubtitle(meta.level, meta.area),
    whatThisIs: "",
    whatItLooksLike: {
      broken: { label: "When this is broken", emoji: "🔴", content: "Content coming soon." },
      ok: { label: "When this is OK", emoji: "🟠", content: "Content coming soon." },
      working: { label: "When this is working", emoji: "🟢", content: "Content coming soon." },
    },
    thingsToThinkAbout: [],
    actions: [],
    quickWins: [],
    relatedPlaybooks: [],
  };
}

export { getPlaybookMeta } from "./bossData";

/** Get level name for a level id */
export function getLevelName(levelId: number): string {
  return LEVELS.find((l) => l.id === levelId)?.name ?? "";
}

/** Get area name for an area id */
export function getAreaName(areaId: number): string {
  return AREAS.find((a) => a.id === areaId)?.name ?? "";
}

/** Build subtitle from level and area */
export function buildSubtitle(levelId: number, areaId: number): string {
  const level = getLevelName(levelId);
  const area = getAreaName(areaId);
  return `Level ${levelId} · ${level} · ${area}`;
}

/** Load playbook content. Returns merged content with bossData, or null if not found. */
export async function loadPlaybookContent(ref: string): Promise<PlaybookContent | null> {
  const meta = getPlaybookMeta(ref);
  if (!meta) return null;

  try {
    const filePath = getContentPath(ref);
    const raw = await fs.promises.readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as FilePartial;
    return mergeWithMeta(data, meta);
  } catch {
    return fallbackContent(meta);
  }
}

type PlaybookContentRow = {
  ref: string;
  what_this_is: string | null;
  what_it_looks_like: {
    broken?: WhatItLooksLikeItem;
    ok?: WhatItLooksLikeItem;
    working?: WhatItLooksLikeItem;
  } | null;
  things_to_think_about: string[] | null;
  plays: ActionItem[] | null;
  plays_intro: string | null;
  plays_sections: FilePartial["playsSections"] | null;
  quick_wins: string[] | null;
  related_playbooks: (string | { ref: string; description?: string })[] | null;
};

/** Load playbook content: DB first, then file, then fallback. Use from API routes. */
export async function loadPlaybookContentWithDb(ref: string): Promise<PlaybookContent | null> {
  const meta = getPlaybookMeta(ref);
  if (!meta) return null;

  const { data: row } = await supabaseAdmin
    .from("playbook_content")
    .select("*")
    .eq("ref", ref)
    .maybeSingle();

  if (row) {
    const r = row as PlaybookContentRow;
    const partial: FilePartial = {
      whatThisIs: r.what_this_is ?? "",
      whatItLooksLike: r.what_it_looks_like
        ? {
            broken: r.what_it_looks_like.broken ?? { label: "When this is broken", emoji: "🔴", content: "" },
            ok: r.what_it_looks_like.ok ?? { label: "When this is OK", emoji: "🟠", content: "" },
            working: r.what_it_looks_like.working ?? { label: "When this is working", emoji: "🟢", content: "" },
          }
        : undefined,
      thingsToThinkAbout: r.things_to_think_about ?? [],
      plays: r.plays ?? [],
      playsIntro: r.plays_intro ?? undefined,
      playsSections: r.plays_sections ?? undefined,
      quickWins: r.quick_wins ?? [],
      relatedPlaybooks: normalizeRelatedPlaybooks(r.related_playbooks),
    };
    const merged = mergeWithMeta(partial, meta);
    try {
      const filePath = getContentPath(ref);
      const raw = await fs.promises.readFile(filePath, "utf-8");
      const data = JSON.parse(raw) as FilePartial;
      if (data.classroom) {
        return { ...merged, classroom: data.classroom };
      }
    } catch {
      /* no file or parse error */
    }
    return merged;
  }

  const fromFile = await loadPlaybookContent(ref);
  return fromFile ?? fallbackContent(meta);
}

/** Load playbook content synchronously (for use in server components) */
export function loadPlaybookContentSync(ref: string): PlaybookContent | null {
  const meta = getPlaybookMeta(ref);
  if (!meta) return null;

  try {
    const filePath = getContentPath(ref);
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as FilePartial;
    return mergeWithMeta(data, meta);
  } catch {
    return fallbackContent(meta);
  }
}

export { PLAYBOOKS, LEVELS, AREAS };

function truncateDescription(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.length <= maxLen) return trimmed;
  const cut = trimmed.slice(0, maxLen).lastIndexOf(" ");
  return (cut > maxLen * 0.6 ? trimmed.slice(0, cut) : trimmed.slice(0, maxLen)) + "…";
}

function countActionItems(data: {
  actions?: ActionItem[] | null;
  plays?: ActionItem[] | null;
  actionSections?: ActionSection[] | null;
  playsSections?: FilePartial["playsSections"] | null;
}): number {
  const { actions, actionSections } = normalizePlaybookActionsFromPartial({
    actions: data.actions ?? undefined,
    plays: data.plays ?? undefined,
    actionSections: data.actionSections ?? undefined,
    playsSections: data.playsSections ?? undefined,
  });
  if (actionSections?.length && actionSections.some((s) => s.actions?.length)) {
    return actionSections.reduce((n, s) => n + (s.actions?.length ?? 0), 0);
  }
  return actions.length;
}

type SummaryRow = {
  ref: string;
  what_this_is: string | null;
  plays: ActionItem[] | null;
  plays_sections: FilePartial["playsSections"] | null;
};

/** Load summaries for all playbooks (description, play count). Uses DB first, then file, then fallback. */
export async function getAllPlaybookSummaries(): Promise<PlaybookSummary[]> {
  const { data: rows } = await supabaseAdmin
    .from("playbook_content")
    .select("ref, what_this_is, plays, plays_sections");

  const byRef = new Map<string, SummaryRow>();
  for (const r of rows ?? []) {
    byRef.set(r.ref, r as SummaryRow);
  }

  const summaries: PlaybookSummary[] = [];
  for (const meta of PLAYBOOKS) {
    const row = byRef.get(meta.ref);
    let description = "";
    let playCount = 0;

    let coverImageUrl: string | undefined;
    if (row) {
      description = truncateDescription(row.what_this_is ?? "", 120);
      playCount = countActionItems({ plays: row.plays, playsSections: row.plays_sections });
    } else {
      description = "";
      playCount = 0;
    }
    try {
      const filePath = path.join(process.cwd(), "content", "playbooks", `${meta.ref}.json`);
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw) as FilePartial;
      if (!row) {
        description = truncateDescription(data.whatThisIs ?? "", 120);
        playCount = countActionItems({
          actions: data.actions,
          plays: data.plays,
          actionSections: data.actionSections,
          playsSections: data.playsSections,
        });
      }
      coverImageUrl = data.classroom?.coverImageUrl;
    } catch {
      if (!row) {
        description = "";
        playCount = 0;
      }
    }

    summaries.push({
      ref: meta.ref,
      name: meta.name,
      level: meta.level,
      area: meta.area,
      subtitle: buildSubtitle(meta.level, meta.area),
      description,
      playCount,
      ...(coverImageUrl ? { coverImageUrl } : {}),
    });
  }
  return summaries;
}
