/** Legacy single bucket before path-scoped groups. */
export const ACADEMY_ACTIONS_GROUP_TEXT = "Academy";

/**
 * Classroom hub *path cards* (top-level Classroom tabs).
 * My Actions now groups most paths by section/lesson; these titles remain
 * recognized so older flat headers can be redistributed on reorganize.
 */
export const CLASSROOM_PATH_CARD_GROUPS = [
  { id: "start-here", title: "Start Here" },
  { id: "coach-action-plan", title: "Coach Action Plan" },
  { id: "going-pro", title: "Going Pro" },
  { id: "get-calls", title: "Get Calls" },
  { id: "win-clients", title: "Win Clients" },
  { id: "coach-clients", title: "Coach Clients" },
  { id: "profit-coach-os", title: "Profit Coach OS" },
] as const;

/** @deprecated Prefer CLASSROOM_PATH_CARD_GROUPS — kept for existing imports. */
export const CLASSROOM_ACTION_GROUPS = CLASSROOM_PATH_CARD_GROUPS;

export type ClassroomActionGroupTitle =
  (typeof CLASSROOM_PATH_CARD_GROUPS)[number]["title"];

const PATH_CARD_TITLES = new Set<string>(
  CLASSROOM_PATH_CARD_GROUPS.map((group) => group.title)
);

/**
 * True for legacy path-card headers (Get Calls, Going Pro, …).
 * Section/lesson subgroup titles are recognized separately via hub on the server,
 * or via academy-linked children in the UI.
 */
export function isClassroomActionGroupTitle(text: string): boolean {
  return PATH_CARD_TITLES.has(text) || text === ACADEMY_ACTIONS_GROUP_TEXT;
}

export function classroomActionGroupOrderIndex(title: string): number {
  const index = CLASSROOM_PATH_CARD_GROUPS.findIndex((group) => group.title === title);
  return index >= 0 ? index : CLASSROOM_PATH_CARD_GROUPS.length;
}

/** Assigned / platform-setup plans — hidden from My Actions for now. */
export function isHiddenAssignedActionGroup(item: {
  depth: number;
  text: string;
  isLocked?: boolean;
  assignmentId?: string | null;
}): boolean {
  if (item.depth !== 0) return false;
  if (item.isLocked && item.assignmentId) return true;
  return /boss\s*school\s*platform\s*setup/i.test(item.text);
}

export const TITLE_BY_HUB_ID = new Map<string, string>(
  CLASSROOM_PATH_CARD_GROUPS.map((group) => [group.id, group.title])
);

export const TITLE_BY_PROGRAMME_ID: Record<string, string> = {
  "start-here": "Start Here",
  kickstart: "Start Here",
  "coach-action-plan": "Coach Action Plan",
  "going-pro": "Going Pro",
  "get-calls": "Get Calls",
  "win-clients": "Win Clients",
  "get-clients": "Get Calls",
  "coach-clients": "Coach Clients",
  "profit-coach-system": "Coach Clients",
  "client-delivery": "Coach Clients",
  "client-acquisition": "Get Calls",
  "profit-coach-certification": "Coach Clients",
  "profit-coach-os": "Profit Coach OS",
};

/** Hub cards that group My Actions by top-level Classroom section. */
export const SECTION_GROUPED_HUB_COURSE_IDS = new Set([
  "get-calls",
  "win-clients",
  "coach-clients",
  "profit-coach-system",
]);

/** Hub cards that group My Actions by lesson (e.g. PRO Energy). */
export const LESSON_GROUPED_HUB_COURSE_IDS = new Set(["going-pro"]);
