/**
 * Playbook content types. Import from here in client components
 * to avoid pulling in node:fs from playbookContent.ts.
 */

export type WhatItLooksLikeItem = {
  label: string;
  emoji: string;
  content: string;
};

/** One expandable block inside an action (e.g. "What to Do", "Why It Matters"). */
export type ActionDetailSection = {
  title: string;
  content: string;
};

/** Classroom / lesson video (stored on each action in JSON or DB `plays`). */
export type LessonVideo =
  | { provider: "youtube" | "vimeo" | "wistia" | "mux" | "file"; url: string }
  | { embedHtml: string };

export type ActionItem = {
  number: number;
  title: string;
  description: string;
  /** Shown when the user expands the action on the overview. */
  detailSections?: ActionDetailSection[];
  /** Stable id for URLs and completion rows; strongly recommended. */
  lessonKey?: string;
  emoji?: string;
  durationLabel?: string;
  coverImageUrl?: string;
  video?: LessonVideo;
  /** Convenience: plain URL (e.g. YouTube) when not using `video`. */
  videoUrl?: string | null;
  /** Markdown body shown below the video in the lesson player. */
  bodyMarkdown?: string;
};

/** Optional grouped actions: section title, description, and actions. */
export type ActionSection = {
  title: string;
  description: string;
  actions: ActionItem[];
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
  actions: ActionItem[];
  /** Optional intro for "The Actions Inside This Playbook". */
  actionsIntro?: string;
  /** When set, displayed instead of flat actions. */
  actionSections?: ActionSection[];
  /** Course-style presentation (classroom grid, covers). */
  classroom?: {
    coverImageUrl?: string;
    moduleEmojiDefault?: string;
  };
  quickWins: string[];
  /** Each item: ref + optional description for "ref Name Playbook — description". */
  relatedPlaybooks: RelatedPlaybookItem[];
};

export type RelatedPlaybookItem = {
  ref: string;
  description: string;
};

/** List card / API summary for a playbook (client-safe). */
export type PlaybookSummary = {
  ref: string;
  name: string;
  level: number;
  area: number;
  subtitle: string;
  description: string;
  playCount: number;
  /** From `classroom.coverImageUrl` when set. */
  coverImageUrl?: string;
};

/** @deprecated Use ActionItem */
export type PlayItem = ActionItem;
/** @deprecated Use ActionSection */
export type PlaySection = ActionSection;

type RawActionSection = {
  title?: string;
  description?: string;
  actions?: ActionItem[];
  plays?: ActionItem[];
};

/** Normalize legacy `plays` / `playsSections` (and nested `plays`) from JSON or DB. */
export function normalizePlaybookActionsFromPartial(data: {
  actions?: ActionItem[];
  plays?: ActionItem[];
  actionsIntro?: string;
  playsIntro?: string;
  actionSections?: ActionSection[];
  playsSections?: RawActionSection[];
}): {
  actions: ActionItem[];
  actionsIntro?: string;
  actionSections?: ActionSection[];
} {
  const actions =
    data.actions && data.actions.length > 0 ? data.actions : (data.plays ?? []);
  const actionsIntro = data.actionsIntro ?? data.playsIntro;
  let actionSections: ActionSection[] | undefined;
  if (data.actionSections?.length) {
    actionSections = data.actionSections.map((s) => ({
      title: s.title,
      description: s.description,
      actions: s.actions ?? [],
    }));
  } else if (data.playsSections?.length) {
    actionSections = data.playsSections.map((s) => ({
      title: s.title ?? "",
      description: s.description ?? "",
      actions: (s.actions ?? s.plays ?? []) as ActionItem[],
    }));
  }
  return { actions, actionsIntro, actionSections };
}

/** Serialize action sections for DB `plays_sections` (nested array uses `actions` key). */
export function serializeActionSectionsForDb(sections: ActionSection[]): Array<{
  title: string;
  description: string;
  actions: ActionItem[];
}> {
  return sections.map((s) => ({
    title: s.title,
    description: s.description,
    actions: s.actions,
  }));
}

/** Normalize normalizeRelatedPlaybooks: string[] or { ref, description? }[] → { ref, description }[] for backward compat. */
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
