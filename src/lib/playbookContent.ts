/**
 * Playbook content types and loader for file-based playbook overview content.
 * For types only (client components), import from ./playbookContentTypes.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { AREAS, getPlaybookMeta, LEVELS, PLAYBOOKS, type BossPlaybook } from "./bossData";
import type { PlaybookContent, PlayItem, PlaySection, WhatItLooksLikeItem } from "./playbookContentTypes";
import { normalizeRelatedPlaybooks } from "./playbookContentTypes";
import { supabaseAdmin } from "./supabaseAdmin";

export type { PlaybookContent, PlayItem, PlaySection, RelatedPlaybookItem, WhatItLooksLikeItem } from "./playbookContentTypes";

function getContentPath(ref: string): string {
  return path.join(process.cwd(), "content", "playbooks", `${ref}.json`);
}

function mergeWithMeta(data: Partial<PlaybookContent>, meta: BossPlaybook): PlaybookContent {
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
    plays: data.plays ?? [],
    playsIntro: data.playsIntro,
    playsSections: data.playsSections,
    quickWins: data.quickWins ?? [],
    relatedPlaybooks: normalizeRelatedPlaybooks(data.relatedPlaybooks),
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
    plays: [],
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
    const data = JSON.parse(raw) as Partial<PlaybookContent>;
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
  plays: PlayItem[] | null;
  plays_intro: string | null;
  plays_sections: PlaySection[] | null;
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
    const partial: Partial<PlaybookContent> = {
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
      playsSections: (r.plays_sections?.length ? r.plays_sections : undefined) ?? undefined,
      quickWins: r.quick_wins ?? [],
      relatedPlaybooks: normalizeRelatedPlaybooks(r.related_playbooks),
    };
    return mergeWithMeta(partial, meta);
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
    const data = JSON.parse(raw) as Partial<PlaybookContent>;
    return mergeWithMeta(data, meta);
  } catch {
    return fallbackContent(meta);
  }
}

export { PLAYBOOKS, LEVELS, AREAS };
