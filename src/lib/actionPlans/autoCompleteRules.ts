import type { AutoCompleteRuleKey } from "@/lib/actionPlans/types";

export type CoachAutoCompleteContext = {
  crm_profile_name?: string | null;
  crm_location_id?: string | null;
  calendar_embed_code?: string | null;
  ghl_calendar_id?: string | null;
  lead_webhook_url?: string | null;
};

export function evaluateAutoCompleteRule(
  ruleKey: AutoCompleteRuleKey | null | undefined,
  coach: CoachAutoCompleteContext,
): boolean {
  if (!ruleKey) return false;

  switch (ruleKey) {
    case "crm_configured":
      return Boolean(
        coach.crm_profile_name?.trim() && coach.crm_location_id?.trim(),
      );
    case "calendar_embed_set":
      return Boolean(
        coach.calendar_embed_code?.trim() || coach.ghl_calendar_id?.trim(),
      );
    case "lead_webhook_set":
      return Boolean(coach.lead_webhook_url?.trim());
    default:
      return false;
  }
}

export function parseRuleFromDb(value: unknown): AutoCompleteRuleKey | null {
  if (!value || typeof value !== "object") return null;
  const rule = (value as { rule?: unknown }).rule;
  if (rule === "crm_configured" || rule === "calendar_embed_set" || rule === "lead_webhook_set") {
    return rule;
  }
  return null;
}
