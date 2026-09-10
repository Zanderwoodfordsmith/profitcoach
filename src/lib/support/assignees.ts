import { COMMUNITY_MENTION_ALIAS_RECIPIENT_ID } from "@/lib/communityFormerStaff";

/** Default support assignee (Zander) until routing rules exist. */
export const DEFAULT_SUPPORT_ASSIGNEE_ID = COMMUNITY_MENTION_ALIAS_RECIPIENT_ID;

export type SupportAssignee = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url?: string | null;
  role?: string | null;
};

export function assigneeDisplayName(
  assignee: SupportAssignee | null | undefined
): string {
  if (!assignee) return "Unassigned";
  return (
    assignee.full_name?.trim() ||
    [assignee.first_name, assignee.last_name].filter(Boolean).join(" ").trim() ||
    "Team member"
  );
}

function assigneeNameHay(
  assignee: SupportAssignee | null | undefined
): string {
  if (!assignee) return "";
  return [
    assignee.full_name,
    assignee.first_name,
    assignee.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Contractor admin profile — not a ticket assignee or reply author. */
export function isDeltaIqContractor(
  assignee: SupportAssignee | null | undefined
): boolean {
  const hay = assigneeNameHay(assignee);
  if (!hay) return false;
  return hay.includes("delta iq") || hay.replace(/\s/g, "").includes("deltaiq");
}

/** Profiles that may appear in support assignee pickers. */
export function isSupportAssignable(
  assignee: SupportAssignee | null | undefined
): boolean {
  if (!assignee) return false;
  return !isDeltaIqContractor(assignee);
}

/** Profiles that should appear as “send as” authors on support replies. */
export function isSupportMessageSender(
  assignee: SupportAssignee | null | undefined
): boolean {
  if (!assignee) return false;
  return !isDeltaIqContractor(assignee);
}

/** Admin queue: who the ticket is for (assignee or @mention). */
export type SupportAssigneeFilter = "zander" | "pam" | "anyone";

/** Admin queue: active vs closed vs everything. */
export type SupportStatusFilter = "open" | "resolved" | "all";
