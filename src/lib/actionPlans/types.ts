export type ActionRecurrence = "none" | "daily" | "weekly" | "monthly";
export type DoneSource = "manual" | "auto";
export type AssignmentStatus = "active" | "archived";
export type PushMode = "all" | "coaches" | "groups";

export const AUTO_COMPLETE_RULE_KEYS = [
  "crm_configured",
  "calendar_embed_set",
  "lead_webhook_set",
] as const;

export type AutoCompleteRuleKey = (typeof AUTO_COMPLETE_RULE_KEYS)[number];

export const AUTO_COMPLETE_RULE_LABELS: Record<AutoCompleteRuleKey, string> = {
  crm_configured: "CRM configured (name + location ID)",
  calendar_embed_set: "Calendar embed set",
  lead_webhook_set: "Lead webhook set",
};

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
};

export type ActionPlanTemplateItemInput = {
  id?: string;
  text: string;
  depth: number;
  sortOrder: number;
  autoCompleteRule?: AutoCompleteRuleKey | null;
};

export type ActionPlanTemplateSummary = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  assignedCoachCount: number;
  pendingInviteCount: number;
  acceptedInviteCount: number;
  completionPercent: number | null;
};

export type CoachGroupSummary = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PushActionPlanResult = {
  assigned: string[];
  skipped: string[];
  failed: Array<{ coachId: string; error: string }>;
};

export function parseAutoCompleteRule(value: unknown): AutoCompleteRuleKey | null {
  if (typeof value !== "string") return null;
  return AUTO_COMPLETE_RULE_KEYS.includes(value as AutoCompleteRuleKey)
    ? (value as AutoCompleteRuleKey)
    : null;
}

export function serializeAutoCompleteRule(
  rule: AutoCompleteRuleKey | null | undefined,
): { rule: AutoCompleteRuleKey } | null {
  if (!rule) return null;
  return { rule };
}
