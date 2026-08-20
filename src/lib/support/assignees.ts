import { COMMUNITY_MENTION_ALIAS_RECIPIENT_ID } from "@/lib/communityFormerStaff";

/** Default support assignee (Zander) until routing rules exist. */
export const DEFAULT_SUPPORT_ASSIGNEE_ID = COMMUNITY_MENTION_ALIAS_RECIPIENT_ID;

export type SupportAssignee = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
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

/** Smart-list filter keys for the admin queue. */
export type SupportSmartList =
  | "zander"
  | "pam"
  | "all_open"
  | "from_lessons"
  | "ideas";

export function smartListLabel(list: SupportSmartList): string {
  switch (list) {
    case "zander":
      return "Zander tasks";
    case "pam":
      return "Pam tasks";
    case "all_open":
      return "All open";
    case "from_lessons":
      return "From lessons";
    case "ideas":
      return "Ideas backlog";
  }
}
