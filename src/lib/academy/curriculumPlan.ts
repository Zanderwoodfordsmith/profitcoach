/**
 * Curriculum plan: what every Classroom lesson becomes, and where each new
 * video is up to. Admin working board (Academy → Curriculum), not coach-facing.
 *
 * Current lessons come from the Classroom hub; a plan row exists only once a
 * lesson has a decision. New lessons are plan rows with no `lesson_id`.
 * Rows from the locked Sep 2026 decisions were copied in as the starting point.
 */

export const CURRICULUM_DECISIONS = [
  "undecided",
  "keep",
  "rename",
  "update",
  "replace",
  "merge",
  "delete",
  "new",
  "later",
  "reference",
] as const;

export type CurriculumDecision = (typeof CURRICULUM_DECISIONS)[number];

export const CURRICULUM_DECISION_LABELS: Record<CurriculumDecision, string> = {
  undecided: "Undecided",
  keep: "Keep",
  rename: "Rename",
  update: "Update",
  replace: "Replace",
  merge: "Merge into",
  delete: "Delete",
  new: "New",
  later: "Later",
  reference: "Reference only",
};

export const CURRICULUM_DECISION_HINTS: Record<CurriculumDecision, string> = {
  undecided: "No call made yet.",
  keep: "Stays as it is.",
  rename: "Same lesson, outcome title.",
  update: "Same lesson, rewritten or re-recorded in place.",
  replace: "Goes away. Another lesson takes its place.",
  merge: "Folded into another lesson.",
  delete: "Goes away. Nothing takes its place.",
  new: "Does not exist yet.",
  later: "Parked until the tool or data exists.",
  reference: "Library, not part of the path.",
};

/** Decisions that point at another row ("goes into …"). */
export const CURRICULUM_DECISIONS_WITH_TARGET: ReadonlySet<CurriculumDecision> =
  new Set(["replace", "merge"]);

/** Decisions that remove the lesson from the path. */
export const CURRICULUM_DECISIONS_LEAVING: ReadonlySet<CurriculumDecision> =
  new Set(["replace", "merge", "delete"]);

/** What a current lesson can be given. New rows use `new` or `later`. */
export const CURRENT_LESSON_DECISIONS: CurriculumDecision[] = [
  "undecided",
  "keep",
  "rename",
  "update",
  "replace",
  "merge",
  "delete",
  "later",
  "reference",
];
export const NEW_LESSON_DECISIONS: CurriculumDecision[] = ["new", "later"];

export const CURRICULUM_STATUSES = [
  "not_started",
  "script",
  "deck",
  "recorded",
  "edited",
  "live",
] as const;

export type CurriculumStatus = (typeof CURRICULUM_STATUSES)[number];

export const CURRICULUM_STATUS_LABELS: Record<CurriculumStatus, string> = {
  not_started: "Not started",
  script: "Scripting",
  deck: "Deck ready",
  recorded: "Recorded",
  edited: "Edited",
  live: "Live",
};

export const CURRICULUM_PLACEMENTS = ["classroom", "in_context", "both"] as const;

export type CurriculumPlacement = (typeof CURRICULUM_PLACEMENTS)[number];

export const CURRICULUM_PLACEMENT_LABELS: Record<CurriculumPlacement, string> = {
  classroom: "Classroom",
  in_context: "In context",
  both: "Both",
};

export const CURRICULUM_LINK_FIELDS = [
  { key: "deckUrl", label: "Deck" },
  { key: "scriptUrl", label: "Script" },
  { key: "videoUrl", label: "Recording" },
  { key: "sourceUrl", label: "Source" },
] as const;

export type CurriculumLinkKey = (typeof CURRICULUM_LINK_FIELDS)[number]["key"];

export type CurriculumPlanItem = {
  id: string;
  /** Current Classroom lesson. Null for a new lesson. */
  lessonId: string | null;
  courseId: string;
  /** Section a new lesson sits under (hub section title, or a new one). */
  sectionTitle: string | null;
  /** Target (outcome) title. Empty = keep the current title. */
  title: string;
  decision: CurriculumDecision;
  /** Row key of the lesson this one goes into (replace / merge). */
  intoKey: string | null;
  status: CurriculumStatus;
  placement: CurriculumPlacement;
  deckUrl: string | null;
  scriptUrl: string | null;
  videoUrl: string | null;
  sourceUrl: string | null;
  note: string;
  sortOrder: number;
  updatedAt: string;
};

export type CurriculumPlanItemDbRow = {
  id: string;
  lesson_id: string | null;
  course_id: string;
  section_title: string | null;
  title: string;
  decision: string;
  into_key: string | null;
  status: string;
  placement: string;
  deck_url: string | null;
  script_url: string | null;
  video_url: string | null;
  source_url: string | null;
  note: string;
  sort_order: number;
  updated_at: string;
};

export function curriculumPlanItemFromDb(row: CurriculumPlanItemDbRow): CurriculumPlanItem {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    courseId: row.course_id,
    sectionTitle: row.section_title,
    title: row.title,
    decision: (CURRICULUM_DECISIONS as readonly string[]).includes(row.decision)
      ? (row.decision as CurriculumDecision)
      : "undecided",
    intoKey: row.into_key,
    status: (CURRICULUM_STATUSES as readonly string[]).includes(row.status)
      ? (row.status as CurriculumStatus)
      : "not_started",
    placement: (CURRICULUM_PLACEMENTS as readonly string[]).includes(row.placement)
      ? (row.placement as CurriculumPlacement)
      : "classroom",
    deckUrl: row.deck_url,
    scriptUrl: row.script_url,
    videoUrl: row.video_url,
    sourceUrl: row.source_url,
    note: row.note,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  };
}

/** Current lessons are keyed by lesson id, new lessons by `new:<uuid>`. */
export function curriculumRowKey(item: Pick<CurriculumPlanItem, "id" | "lessonId">): string {
  return item.lessonId ?? `new:${item.id}`;
}

/** One line on the board: a current lesson (with or without a plan) or a new one. */
export type CurriculumBoardRow = {
  key: string;
  courseId: string;
  courseTitle: string;
  sectionTitle: string;
  /** Current lesson, when there is one. */
  lessonId: string | null;
  currentTitle: string | null;
  /** Set on satellites (optional extras under a parent lesson). */
  parentLessonId: string | null;
  isDraft: boolean;
  hasVideo: boolean;
  adminHref: string | null;
  plan: CurriculumPlanItem | null;
};

export type CurriculumBoardSection = {
  /** Hub section id, or `new:<title>` for a section that only exists in the plan. */
  id: string;
  title: string;
  /** True for a section that only exists in the plan. */
  isNew: boolean;
  rowKeys: string[];
  /** Nested sections, as the Classroom has them. */
  sections: CurriculumBoardSection[];
};

/** Every section in a tree, depth first. */
export function flattenBoardSections(sections: CurriculumBoardSection[]): CurriculumBoardSection[] {
  return sections.flatMap((s) => [s, ...flattenBoardSections(s.sections)]);
}

export type CurriculumBoardCourse = {
  id: string;
  title: string;
  sections: CurriculumBoardSection[];
};

export type CurriculumBoard = {
  courses: CurriculumBoardCourse[];
  rows: CurriculumBoardRow[];
};

export function rowDecision(row: CurriculumBoardRow): CurriculumDecision {
  return row.plan?.decision ?? (row.lessonId ? "undecided" : "new");
}

export function rowDisplayTitle(row: CurriculumBoardRow): string {
  return row.plan?.title.trim() || row.currentTitle || "Untitled lesson";
}

/** Fields an admin can change from the board. */
export type CurriculumPlanPatch = Partial<{
  title: string;
  sectionTitle: string | null;
  decision: CurriculumDecision;
  intoKey: string | null;
  status: CurriculumStatus;
  placement: CurriculumPlacement;
  deckUrl: string | null;
  scriptUrl: string | null;
  videoUrl: string | null;
  sourceUrl: string | null;
  note: string;
  sortOrder: number;
}>;

function cleanUrl(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error("Links must be text.");
  const t = value.trim();
  if (!t) return null;
  // Rendered as hrefs, so only web links and app paths.
  if (/^https?:\/\//i.test(t) || (t.startsWith("/") && !t.startsWith("//"))) {
    return t.slice(0, 2000);
  }
  throw new Error("Links must start with https:// or /.");
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") throw new Error("Expected text.");
  return value.slice(0, max);
}

/** Validates a patch from the client and maps it to DB columns. */
export function curriculumPatchToDb(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") throw new Error("Invalid body.");
  const p = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  if ("title" in p) out.title = cleanText(p.title, 300).trim();
  if ("note" in p) out.note = cleanText(p.note, 4000);
  if ("sectionTitle" in p) {
    out.section_title =
      p.sectionTitle == null ? null : cleanText(p.sectionTitle, 200).trim() || null;
  }
  if ("decision" in p) {
    if (!(CURRICULUM_DECISIONS as readonly unknown[]).includes(p.decision)) {
      throw new Error("Unknown decision.");
    }
    out.decision = p.decision;
  }
  if ("status" in p) {
    if (!(CURRICULUM_STATUSES as readonly unknown[]).includes(p.status)) {
      throw new Error("Unknown status.");
    }
    out.status = p.status;
  }
  if ("placement" in p) {
    if (!(CURRICULUM_PLACEMENTS as readonly unknown[]).includes(p.placement)) {
      throw new Error("Unknown placement.");
    }
    out.placement = p.placement;
  }
  if ("intoKey" in p) {
    out.into_key = p.intoKey == null ? null : cleanText(p.intoKey, 300).trim() || null;
  }
  if ("deckUrl" in p) out.deck_url = cleanUrl(p.deckUrl);
  if ("scriptUrl" in p) out.script_url = cleanUrl(p.scriptUrl);
  if ("videoUrl" in p) out.video_url = cleanUrl(p.videoUrl);
  if ("sourceUrl" in p) out.source_url = cleanUrl(p.sourceUrl);
  if ("sortOrder" in p) {
    if (typeof p.sortOrder !== "number" || !Number.isFinite(p.sortOrder)) {
      throw new Error("sortOrder must be a number.");
    }
    out.sort_order = Math.round(p.sortOrder);
  }
  return out;
}

export const CURRICULUM_RULES = [
  {
    title: "If-then lives in the lesson",
    body: "No separate Decision Desk. The first screen of every lesson is the situation, the action, the script or tool, and the success standard. Chapters hold the branches. Search already finds it.",
  },
  {
    title: "Outcome titles, same lessons",
    body: "Rename toward the job the coach finishes. Do not invent a parallel tree. Connector, Sessions 1–4, Pick Your Path, and Going Pro stay as the product. Generic academy names hide the work.",
  },
  {
    title: "Tools first, then a short explain",
    body: "If a tool can lock the decision, the lesson opens the tool. If it needs judgement (objections, a live session, a rescue conversation), write the if-then, then explain only as far as the skill needs.",
  },
  {
    title: "One search",
    body: "The top-bar search stays the only search. Transcripts and chapters are the retrieval layer. Do not add a second engine or an AI-only front door.",
  },
] as const;

export const LESSON_OPENING_STANDARD = {
  title: "Lesson opening",
  steps: [
    "Title = the outcome or situation",
    "Do this now: one action",
    "Say this / use this: script, checklist, or tool",
    "Success standard: what is true when they are done",
    "Then the video, guide, or short why, only if the skill needs it",
    "Chapters = branches, not extra theory",
  ],
} as const;
