import {
  evaluateAutoCompleteRule,
  parseRuleFromDb,
} from "@/lib/actionPlans/autoCompleteRules";
import type { CoachAutoCompleteContext } from "@/lib/actionPlans/autoCompleteRules";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function syncCoachActionAutoComplete(coachId: string): Promise<void> {
  const { data: coachRow, error: coachError } = await supabaseAdmin
    .from("coaches")
    .select(
      "crm_profile_name, crm_location_id, calendar_embed_code, ghl_calendar_id, lead_webhook_url",
    )
    .eq("id", coachId)
    .maybeSingle();
  if (coachError) throw coachError;
  if (!coachRow) return;

  const context: CoachAutoCompleteContext = coachRow;

  const { data: items, error: itemsError } = await supabaseAdmin
    .from("coach_action_items")
    .select("id, done, done_source, auto_complete_rule")
    .eq("coach_id", coachId)
    .not("auto_complete_rule", "is", null);
  if (itemsError) throw itemsError;

  const now = new Date().toISOString();

  for (const item of items ?? []) {
    const ruleKey = parseRuleFromDb(item.auto_complete_rule);
    if (!ruleKey) continue;

    const shouldBeDone = evaluateAutoCompleteRule(ruleKey, context);
    const currentlyDone = Boolean(item.done);

    if (shouldBeDone && !currentlyDone) {
      await supabaseAdmin
        .from("coach_action_items")
        .update({
          done: true,
          done_at: now,
          done_source: "auto",
          updated_at: now,
        })
        .eq("id", item.id);
    } else if (!shouldBeDone && currentlyDone && item.done_source === "auto") {
      await supabaseAdmin
        .from("coach_action_items")
        .update({
          done: false,
          done_at: null,
          done_source: null,
          updated_at: now,
        })
        .eq("id", item.id);
    }
  }
}
