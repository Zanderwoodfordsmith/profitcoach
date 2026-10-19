export type ActionRecurrence = "none" | "daily" | "weekly" | "monthly";
export type DoneSource = "manual" | "auto";

export type AutoCompleteRuleKey =
  | "crm_configured"
  | "calendar_embed_set"
  | "lead_webhook_set";

export type ActionOutlineLine = {
  id: string;
  text: string;
  done: boolean;
  depth: number;
  estimate: string;
  startAt: string;
  dueAt: string;
  recurrence: ActionRecurrence;
  isLocked?: boolean;
  assignmentId?: string | null;
  templateItemId?: string | null;
  autoCompleteRule?: AutoCompleteRuleKey | null;
  doneSource?: DoneSource | null;
  sortOrder?: number;
  academyCourseId?: string | null;
  academyLessonId?: string | null;
  /** Display-only: resolved on load for academy-linked rows. */
  lessonTitle?: string | null;
  lessonHref?: string | null;
  sectionTitle?: string | null;
};
