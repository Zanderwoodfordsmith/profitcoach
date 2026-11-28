import { defaultNewPlan, NEW_PLAN_DRAFT_ID, parseNewPlan, type NewPlanDoc } from "@/lib/academy/newCurriculumPlan";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** The saved new plan, or the first version if it has never been saved. */
export async function loadNewCurriculumPlan(): Promise<NewPlanDoc> {
  const { data, error } = await supabaseAdmin
    .from("curriculum_drafts")
    .select("plan")
    .eq("id", NEW_PLAN_DRAFT_ID)
    .maybeSingle();
  if (error) console.error("loadNewCurriculumPlan:", error.message);
  return (data ? parseNewPlan(data.plan) : null) ?? defaultNewPlan();
}
