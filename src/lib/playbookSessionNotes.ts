/** Workshop state captured per BOSS playbook ref during live scoring. */

export type WorkshopAuthorRole = "coach" | "client";

export type WorkshopPriority = "urgent" | "high" | "normal" | "low";

export const WORKSHOP_PRIORITIES: WorkshopPriority[] = [
  "urgent",
  "high",
  "normal",
  "low",
];

export const WORKSHOP_PRIORITY_META: Record<
  WorkshopPriority,
  { label: string; dot: string; pill: string; flag: string }
> = {
  urgent: {
    label: "Urgent",
    dot: "bg-red-500",
    pill: "bg-red-100 text-red-700 ring-1 ring-red-200",
    flag: "text-red-500",
  },
  high: {
    label: "High",
    dot: "bg-yellow-500",
    pill: "bg-yellow-100 text-yellow-900 ring-1 ring-yellow-200",
    flag: "text-yellow-500",
  },
  normal: {
    label: "Normal",
    dot: "bg-blue-600",
    pill: "bg-blue-100 text-blue-900 ring-1 ring-blue-200",
    flag: "text-blue-600",
  },
  low: {
    label: "Low",
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    flag: "text-slate-400",
  },
};

export function normalizeWorkshopPriority(value: unknown): WorkshopPriority | undefined {
  return WORKSHOP_PRIORITIES.includes(value as WorkshopPriority)
    ? (value as WorkshopPriority)
    : undefined;
}

/** Urgency points 4→1 map to Urgent / High / Normal / Low. */
export const URGENCY_POINTS: Record<WorkshopPriority, 1 | 2 | 3 | 4> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

export const POINTS_TO_URGENCY: Record<1 | 2 | 3 | 4, WorkshopPriority> = {
  4: "urgent",
  3: "high",
  2: "normal",
  1: "low",
};

export type ProspectImpactLevel = 1 | 2 | 3;
export type ProspectEaseLevel = 1 | 2 | 3;
export type ProspectUrgencyLevel = 1 | 2 | 3 | 4;

export type PlaybookProspectScores = {
  urgency?: ProspectUrgencyLevel;
  impact?: ProspectImpactLevel;
  ease?: ProspectEaseLevel;
};

export const PROSPECT_IMPACT_LEVELS: ProspectImpactLevel[] = [3, 2, 1];

export const PROSPECT_EASE_LEVELS: ProspectEaseLevel[] = [3, 2, 1];

export const WORKSHOP_IMPACT_META: Record<
  ProspectImpactLevel,
  { label: string; pill: string; active: string; idle: string }
> = {
  3: {
    label: "High",
    pill: "bg-blue-900 text-blue-50 ring-1 ring-blue-800",
    active: "border-blue-800 bg-blue-900 text-blue-50 ring-1 ring-blue-700/60",
    idle: "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/40",
  },
  2: {
    label: "Medium",
    pill: "bg-blue-100 text-blue-900 ring-1 ring-blue-200",
    active: "border-blue-400 bg-blue-50 text-blue-950 ring-1 ring-blue-300/60",
    idle: "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/40",
  },
  1: {
    label: "Low",
    pill: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    active: "border-slate-400 bg-slate-50 text-slate-700 ring-1 ring-slate-300/60",
    idle: "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
  },
};

export const WORKSHOP_EASE_META: Record<
  ProspectEaseLevel,
  { label: string; pill: string; active: string; idle: string }
> = {
  3: {
    label: "Easy",
    pill: "bg-green-100 text-green-900 ring-1 ring-green-200",
    active: "border-green-400 bg-green-50 text-green-950 ring-1 ring-green-300/60",
    idle: "border-slate-200 bg-white text-slate-600 hover:border-green-200 hover:bg-green-50/40",
  },
  2: {
    label: "Medium",
    pill: "bg-yellow-100 text-yellow-900 ring-1 ring-yellow-200",
    active: "border-yellow-400 bg-yellow-50 text-yellow-950 ring-1 ring-yellow-300/60",
    idle: "border-slate-200 bg-white text-slate-600 hover:border-yellow-200 hover:bg-yellow-50/40",
  },
  1: {
    label: "Hard",
    pill: "bg-red-100 text-red-900 ring-1 ring-red-200",
    active: "border-red-400 bg-red-50 text-red-950 ring-1 ring-red-300/60",
    idle: "border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:bg-red-50/40",
  },
};

function normalizeProspectLevel(
  value: unknown,
  allowed: readonly number[]
): number | undefined {
  return typeof value === "number" && allowed.includes(value)
    ? value
    : undefined;
}

export function computeProspectImportance(scores: PlaybookProspectScores): number | null {
  const { urgency, impact, ease } = scores;
  if (urgency === undefined || impact === undefined || ease === undefined) {
    return null;
  }
  return urgency + impact + ease;
}

export function isProspectScoreComplete(scores: PlaybookProspectScores): boolean {
  return computeProspectImportance(scores) !== null;
}

export type WorkshopProspectPlotPoint = {
  ref: string;
  scores: PlaybookProspectScores;
  importance: number | null;
  complete: boolean;
};

/** Collect playbook prospect scores from session notes for matrix charts. */
export function collectWorkshopProspectPlotPoints(
  playbookNotes: Record<string, string>
): WorkshopProspectPlotPoint[] {
  const points: WorkshopProspectPlotPoint[] = [];

  for (const [key, raw] of Object.entries(playbookNotes)) {
    if (!key.endsWith("__prospect_scores")) continue;
    const ref = key.slice(0, -"__prospect_scores".length);
    const scores = loadPlaybookProspectScores(
      raw,
      playbookNotes[playbookPriorityKey(ref)]
    );
    if (scores.impact === undefined && scores.urgency === undefined && scores.ease === undefined) {
      continue;
    }
    points.push({
      ref,
      scores,
      importance: computeProspectImportance(scores),
      complete: isProspectScoreComplete(scores),
    });
  }

  return points.sort(compareProspectPlotPoints);
}

function compareProspectPlotPoints(
  a: WorkshopProspectPlotPoint,
  b: WorkshopProspectPlotPoint
): number {
  const importanceDiff = (b.importance ?? -1) - (a.importance ?? -1);
  if (importanceDiff !== 0) return importanceDiff;

  const urgencyDiff = (b.scores.urgency ?? 0) - (a.scores.urgency ?? 0);
  if (urgencyDiff !== 0) return urgencyDiff;

  const easeDiff = (b.scores.ease ?? 0) - (a.scores.ease ?? 0);
  if (easeDiff !== 0) return easeDiff;

  return a.ref.localeCompare(b.ref, undefined, { numeric: true });
}

export type RankedProspectPriorities = {
  complete: WorkshopProspectPlotPoint[];
  incomplete: WorkshopProspectPlotPoint[];
  topPick: WorkshopProspectPlotPoint | null;
};

/** Fully scored playbooks ranked for client focus (importance, then urgency, then ease). */
export function getRankedProspectPriorities(
  playbookNotes: Record<string, string>
): RankedProspectPriorities {
  const all = collectWorkshopProspectPlotPoints(playbookNotes);
  const complete = all.filter((point) => point.complete).sort(compareProspectPlotPoints);
  const incomplete = all.filter((point) => !point.complete);
  return {
    complete,
    incomplete,
    topPick: complete[0] ?? null,
  };
}

function impactPhrase(level: ProspectImpactLevel | undefined): string | null {
  if (level === 3) return "high impact";
  if (level === 2) return "solid impact";
  if (level === 1) return "some impact";
  return null;
}

function urgencyPhrase(level: ProspectUrgencyLevel | undefined): string | null {
  if (level === undefined) return null;
  const priority = POINTS_TO_URGENCY[level];
  if (priority === "urgent") return "urgent";
  if (priority === "high") return "time-sensitive";
  if (priority === "normal") return "moderate urgency";
  return "lower urgency";
}

function easePhrase(level: ProspectEaseLevel | undefined): string | null {
  if (level === 3) return "relatively easy to begin";
  if (level === 2) return "a manageable amount of work";
  if (level === 1) return "more effort required";
  return null;
}

/** Plain-English one-liner for client-facing focus copy. */
export function buildProspectFocusReason(scores: PlaybookProspectScores): string {
  const parts = [
    impactPhrase(scores.impact),
    urgencyPhrase(scores.urgency),
    easePhrase(scores.ease),
  ].filter((part): part is string => Boolean(part));

  if (parts.length === 0) return "Score impact, urgency, and ease to see a recommendation.";
  if (parts.length === 1) return `${parts[0].charAt(0).toUpperCase()}${parts[0].slice(1)}.`;
  if (parts.length === 2) {
    return `${parts[0].charAt(0).toUpperCase()}${parts[0].slice(1)}, and ${parts[1]}.`;
  }
  return `${parts[0].charAt(0).toUpperCase()}${parts[0].slice(1)}, ${parts[1]}, and ${parts[2]}.`;
}

/** Corner label for Impact × Ease matrix cells (client language). */
export function impactEaseQuadrantLabel(
  impact: ProspectImpactLevel,
  ease: ProspectEaseLevel
): string | null {
  if (impact === 3 && ease === 3) return "Do first";
  if (impact === 3 && ease === 1) return "Plan carefully";
  if (impact === 1 && ease === 3) return "Nice to have";
  if (impact === 1 && ease === 1) return "Later";
  return null;
}

/** Corner label for Impact × Urgency matrix cells (client language). */
export function impactUrgencyQuadrantLabel(
  impact: ProspectImpactLevel,
  urgency: ProspectUrgencyLevel
): string | null {
  if (impact === 3 && urgency === 4) return "Act now";
  if (impact === 1 && urgency === 1) return "Revisit later";
  return null;
}

export type CustomWorkshopAction = {
  id: string;
  text: string;
  done?: boolean;
  /** ISO date YYYY-MM-DD */
  startDate?: string;
  /** ISO date YYYY-MM-DD */
  dueDate?: string;
  /** Minutes */
  timeEstimateMinutes?: number;
};

export type WorkshopActionGroup = {
  id: string;
  title: string;
  items: CustomWorkshopAction[];
};

export type PlaybookActionMeta = {
  startDate?: string;
  dueDate?: string;
  timeEstimateMinutes?: number;
};

export type PlaybookAgreedActions = {
  /** Playbook action numbers the coach agreed with the client. */
  playbook: number[];
  /** Per-playbook action scheduling metadata keyed by action number. */
  playbookMeta?: Record<string, PlaybookActionMeta>;
  groups: WorkshopActionGroup[];
};

export type WorkshopCommentReply = {
  id: string;
  author: WorkshopAuthorRole;
  authorName?: string;
  text: string;
  createdAt: string;
};

export type WorkshopComment = {
  id: string;
  author: WorkshopAuthorRole;
  authorName?: string;
  text: string;
  createdAt: string;
  replies: WorkshopCommentReply[];
};

export type WorkshopActivityType =
  | "score_set"
  | "score_cleared"
  | "description_updated"
  | "action_added"
  | "checklist_added"
  | "comment_added"
  | "prospect_scores_updated";

export type WorkshopActivityEvent = {
  id: string;
  type: WorkshopActivityType;
  createdAt: string;
  author?: WorkshopAuthorRole;
  authorName?: string;
  meta?: Record<string, unknown>;
};

const WORKSHOP_SUFFIXES = [
  "__actions",
  "__comments",
  "__activity",
  "__priority",
  "__prospect_scores",
] as const;

export function playbookActionNotesKey(ref: string): string {
  return `${ref}__actions`;
}

export function playbookCommentsKey(ref: string): string {
  return `${ref}__comments`;
}

export function playbookActivityKey(ref: string): string {
  return `${ref}__activity`;
}

export function playbookPriorityKey(ref: string): string {
  return `${ref}__priority`;
}

export function parsePlaybookPriority(raw: string | undefined): WorkshopPriority | undefined {
  return normalizeWorkshopPriority(raw?.trim());
}

export function playbookProspectScoresKey(ref: string): string {
  return `${ref}__prospect_scores`;
}

export function parsePlaybookProspectScores(raw: string | undefined): PlaybookProspectScores {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const record = parsed as Record<string, unknown>;
    const impactRaw = record.impact ?? record.importance;
    return {
      urgency: normalizeProspectLevel(record.urgency, [1, 2, 3, 4]) as
        | ProspectUrgencyLevel
        | undefined,
      impact: normalizeProspectLevel(impactRaw, [1, 2, 3]) as ProspectImpactLevel | undefined,
      ease: normalizeProspectLevel(record.ease, [1, 2, 3]) as ProspectEaseLevel | undefined,
    };
  } catch {
    return {};
  }
}

export function serializePlaybookProspectScores(scores: PlaybookProspectScores): string {
  if (!scores.urgency && !scores.impact && !scores.ease) return "";
  return JSON.stringify(scores);
}

/** Load prospect scores, migrating legacy `{ref}__priority` into urgency when needed. */
export function loadPlaybookProspectScores(
  prospectScoresRaw: string | undefined,
  legacyPriorityRaw: string | undefined
): PlaybookProspectScores {
  const parsed = parsePlaybookProspectScores(prospectScoresRaw);
  if (parsed.urgency !== undefined || parsed.impact !== undefined || parsed.ease !== undefined) {
    return parsed;
  }
  const legacy = parsePlaybookPriority(legacyPriorityRaw);
  if (!legacy) return {};
  return { urgency: URGENCY_POINTS[legacy] };
}

export function playbookRefFromSessionKey(key: string): string | null {
  if (!key.includes("__")) return key;
  for (const suffix of WORKSHOP_SUFFIXES) {
    if (key.endsWith(suffix)) return key.slice(0, -suffix.length);
  }
  return null;
}

export function isPlaybookSessionNotesKey(key: string, validRefs?: Set<string>): boolean {
  const ref = playbookRefFromSessionKey(key);
  if (!ref) return false;
  if (validRefs && !validRefs.has(ref)) return false;
  return !key.includes("__") || WORKSHOP_SUFFIXES.some((suffix) => key.endsWith(suffix));
}

export function emptyAgreedActions(): PlaybookAgreedActions {
  return { playbook: [], groups: [] };
}

function newDefaultGroup(items: CustomWorkshopAction[] = []): WorkshopActionGroup {
  return { id: crypto.randomUUID(), title: "Checklist", items };
}

function normalizeActionItem(raw: unknown): CustomWorkshopAction | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as CustomWorkshopAction;
  if (typeof item.id !== "string" || typeof item.text !== "string") return null;
  return {
    id: item.id,
    text: item.text,
    done: item.done === true,
    startDate: typeof item.startDate === "string" ? item.startDate : undefined,
    dueDate: typeof item.dueDate === "string" ? item.dueDate : undefined,
    timeEstimateMinutes:
      typeof item.timeEstimateMinutes === "number" ? item.timeEstimateMinutes : undefined,
  };
}

function normalizeGroup(raw: unknown): WorkshopActionGroup | null {
  if (!raw || typeof raw !== "object") return null;
  const group = raw as WorkshopActionGroup;
  if (typeof group.id !== "string" || typeof group.title !== "string") return null;
  const items = Array.isArray(group.items)
    ? group.items.map(normalizeActionItem).filter((item): item is CustomWorkshopAction => !!item)
    : [];
  return { id: group.id, title: group.title, items };
}

function normalizePlaybookMetaEntry(raw: unknown): PlaybookActionMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as PlaybookActionMeta;
  return {
    startDate: typeof entry.startDate === "string" ? entry.startDate : undefined,
    dueDate: typeof entry.dueDate === "string" ? entry.dueDate : undefined,
    timeEstimateMinutes:
      typeof entry.timeEstimateMinutes === "number" ? entry.timeEstimateMinutes : undefined,
  };
}

function normalizePlaybookMeta(
  raw: unknown
): PlaybookAgreedActions["playbookMeta"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const meta: Record<string, PlaybookActionMeta> = {};
  for (const [key, value] of Object.entries(record)) {
    const entry = normalizePlaybookMetaEntry(value);
    if (entry) meta[key] = entry;
  }
  return Object.keys(meta).length > 0 ? meta : undefined;
}

export function parseAgreedActions(raw: string | undefined): PlaybookAgreedActions {
  if (!raw?.trim()) return emptyAgreedActions();

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      const playbook = Array.isArray(record.playbook)
        ? record.playbook.filter((n): n is number => typeof n === "number")
        : [];

      const playbookMeta = normalizePlaybookMeta(record.playbookMeta);

      if (Array.isArray(record.groups)) {
        const groups = record.groups
          .map(normalizeGroup)
          .filter((g): g is WorkshopActionGroup => !!g);
        return { playbook, playbookMeta, groups };
      }

      const legacyCustom = Array.isArray(record.custom)
        ? record.custom
            .map(normalizeActionItem)
            .filter((item): item is CustomWorkshopAction => !!item)
        : [];

      return {
        playbook,
        playbookMeta,
        groups: legacyCustom.length ? [newDefaultGroup(legacyCustom)] : [],
      };
    }
  } catch {
    // Legacy plain-text blob
  }

  return {
    playbook: [],
    groups: [{ id: "legacy", title: "Checklist", items: [{ id: "legacy", text: raw.trim() }] }],
  };
}

export function serializeAgreedActions(data: PlaybookAgreedActions): string {
  const hasPlaybook = data.playbook.length > 0;
  const hasGroups = data.groups.some((g) => g.items.some((i) => i.text.trim()));
  const hasMeta = data.playbookMeta && Object.keys(data.playbookMeta).length > 0;
  if (!hasPlaybook && !hasGroups && !hasMeta) return "";
  return JSON.stringify(data);
}

export function agreedActionsCount(data: PlaybookAgreedActions): number {
  const customCount = data.groups.reduce(
    (sum, g) => sum + g.items.filter((c) => c.text.trim()).length,
    0
  );
  return data.playbook.length + customCount;
}

function normalizeReply(raw: unknown): WorkshopCommentReply | null {
  if (!raw || typeof raw !== "object") return null;
  const reply = raw as WorkshopCommentReply;
  if (
    typeof reply.id !== "string" ||
    typeof reply.text !== "string" ||
    typeof reply.createdAt !== "string"
  ) {
    return null;
  }
  return {
    id: reply.id,
    author: reply.author === "client" ? "client" : "coach",
    authorName: typeof reply.authorName === "string" ? reply.authorName : undefined,
    text: reply.text,
    createdAt: reply.createdAt,
  };
}

function normalizeComment(raw: unknown): WorkshopComment | null {
  if (!raw || typeof raw !== "object") return null;
  const comment = raw as WorkshopComment;
  if (
    typeof comment.id !== "string" ||
    typeof comment.text !== "string" ||
    typeof comment.createdAt !== "string"
  ) {
    return null;
  }
  const replies = Array.isArray(comment.replies)
    ? comment.replies.map(normalizeReply).filter((r): r is WorkshopCommentReply => !!r)
    : [];
  return {
    id: comment.id,
    author: comment.author === "client" ? "client" : "coach",
    authorName: typeof comment.authorName === "string" ? comment.authorName : undefined,
    text: comment.text,
    createdAt: comment.createdAt,
    replies,
  };
}

export function parseWorkshopComments(raw: string | undefined): WorkshopComment[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeComment).filter((c): c is WorkshopComment => !!c);
  } catch {
    return [];
  }
}

export function serializeWorkshopComments(comments: WorkshopComment[]): string {
  if (comments.length === 0) return "";
  return JSON.stringify(comments);
}

function normalizeActivity(raw: unknown): WorkshopActivityEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const event = raw as WorkshopActivityEvent;
  if (typeof event.id !== "string" || typeof event.createdAt !== "string") return null;
  if (typeof event.type !== "string") return null;
  return {
    id: event.id,
    type: event.type as WorkshopActivityType,
    createdAt: event.createdAt,
    author: event.author === "client" ? "client" : event.author === "coach" ? "coach" : undefined,
    authorName: typeof event.authorName === "string" ? event.authorName : undefined,
    meta:
      event.meta && typeof event.meta === "object"
        ? (event.meta as Record<string, unknown>)
        : undefined,
  };
}

export function parseWorkshopActivity(raw: string | undefined): WorkshopActivityEvent[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeActivity).filter((e): e is WorkshopActivityEvent => !!e);
  } catch {
    return [];
  }
}

export function serializeWorkshopActivity(events: WorkshopActivityEvent[]): string {
  if (events.length === 0) return "";
  return JSON.stringify(events);
}

export function appendWorkshopActivity(
  events: WorkshopActivityEvent[],
  event: Omit<WorkshopActivityEvent, "id" | "createdAt"> & { id?: string; createdAt?: string }
): WorkshopActivityEvent[] {
  const next: WorkshopActivityEvent = {
    id: event.id ?? crypto.randomUUID(),
    createdAt: event.createdAt ?? new Date().toISOString(),
    type: event.type,
    author: event.author,
    authorName: event.authorName,
    meta: event.meta,
  };
  return [...events, next];
}

export const SCORE_LABELS: Record<0 | 1 | 2, string> = {
  0: "Not in place",
  1: "Partially",
  2: "Fully in place",
};

export function formatActivityMessage(event: WorkshopActivityEvent): string {
  switch (event.type) {
    case "score_set": {
      const score = event.meta?.score;
      const label =
        typeof event.meta?.label === "string"
          ? event.meta.label
          : typeof score === "number"
            ? SCORE_LABELS[score as 0 | 1 | 2]
            : "a score";
      return `Set score to ${label}`;
    }
    case "score_cleared":
      return "Cleared score";
    case "description_updated":
      return "Updated description";
    case "action_added":
      return "Added an action";
    case "checklist_added":
      return "Added a checklist";
    case "comment_added":
      return "Added a comment";
    case "prospect_scores_updated": {
      const total = event.meta?.total;
      return typeof total === "number"
        ? `Updated importance to ${total}/10`
        : "Updated prospect scores";
    }
    default:
      return "Updated playbook";
  }
}

export function formatMinutes(minutes: number | undefined): string {
  if (!minutes || minutes <= 0) return "";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatShortDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
