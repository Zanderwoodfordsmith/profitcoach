/**
 * Playbook content types. Import from here in client components
 * to avoid pulling in node:fs from playbookContent.ts.
 */

export type WhatItLooksLikeItem = {
  label: string;
  emoji: string;
  content: string;
};

export type PlayItem = {
  number: number;
  title: string;
  description: string;
};

/** Optional grouped plays: section title, description, and plays. */
export type PlaySection = {
  title: string;
  description: string;
  plays: PlayItem[];
};

export type PlaybookContent = {
  ref: string;
  level: number;
  area: number;
  name: string;
  subtitle: string;
  whatThisIs: string;
  whatItLooksLike: {
    broken: WhatItLooksLikeItem;
    ok: WhatItLooksLikeItem;
    working: WhatItLooksLikeItem;
  };
  thingsToThinkAbout: string[];
  plays: PlayItem[];
  /** Optional intro for "The Plays Inside This Playbook" (e.g. "This playbook is organised into three sections..."). */
  playsIntro?: string;
  /** When set, displayed instead of flat plays: sections with title, description, and plays. */
  playsSections?: PlaySection[];
  quickWins: string[];
  /** Each item: ref + optional description for "ref Name Playbook — description". */
  relatedPlaybooks: RelatedPlaybookItem[];
};

export type RelatedPlaybookItem = {
  ref: string;
  description: string;
};

/** Normalize related playbooks: string[] or { ref, description? }[] → { ref, description }[] for backward compat. */
export function normalizeRelatedPlaybooks(
  raw:
    | (string | { ref: string; description?: string })[]
    | null
    | undefined
): RelatedPlaybookItem[] {
  if (!raw?.length) return [];
  return raw.map((x) =>
    typeof x === "string"
      ? { ref: x, description: "" }
      : { ref: x.ref, description: x.description ?? "" }
  );
}
