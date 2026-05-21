import { randomUUID } from "crypto";
import { parseRuleFromDb } from "@/lib/actionPlans/autoCompleteRules";
import {
  isMissingEstimateColumnError,
  outlineLineToDbInsert,
  templateItemToOutlineLine,
} from "@/lib/actionPlans/mappers";
import type { ActionOutlineLine, PushActionPlanResult } from "@/lib/actionPlans/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type TemplateItemRow = {
  id: string;
  text: string;
  depth: number;
  sort_order: number;
  estimate?: string | null;
  auto_complete_rule: unknown;
};

export async function loadTemplateItems(templateId: string): Promise<TemplateItemRow[]> {
  const withEstimate = await supabaseAdmin
    .from("action_plan_template_items")
    .select("id, text, depth, sort_order, estimate, auto_complete_rule")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });

  if (!withEstimate.error) {
    return withEstimate.data ?? [];
  }
  if (isMissingEstimateColumnError(withEstimate.error)) {
    const withoutEstimate = await supabaseAdmin
      .from("action_plan_template_items")
      .select("id, text, depth, sort_order, auto_complete_rule")
      .eq("template_id", templateId)
      .order("sort_order", { ascending: true });
    if (withoutEstimate.error) throw withoutEstimate.error;
    return withoutEstimate.data ?? [];
  }
  throw withEstimate.error;
}

export async function coachHasActiveAssignment(
  templateId: string,
  coachId: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("coach_action_plan_assignments")
    .select("id")
    .eq("template_id", templateId)
    .eq("coach_id", coachId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function activateActionPlanForCoach(input: {
  templateId: string;
  coachId: string;
  assignedBy?: string | null;
}): Promise<string> {
  const items = await loadTemplateItems(input.templateId);
  if (!items.length) {
    throw new Error("Template has no items.");
  }

  if (await coachHasActiveAssignment(input.templateId, input.coachId)) {
    throw new Error("Action plan is already active for this coach.");
  }

  const maxSortResult = await supabaseAdmin
    .from("coach_action_items")
    .select("sort_order")
    .eq("coach_id", input.coachId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextSort = (maxSortResult.data?.sort_order ?? -1) + 1;

  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from("coach_action_plan_assignments")
    .insert({
      template_id: input.templateId,
      coach_id: input.coachId,
      assigned_by: input.assignedBy ?? null,
      status: "active",
    })
    .select("id")
    .single();
  if (assignmentError) throw assignmentError;

  const rows = items.map((item) => {
    const line = {
      id: randomUUID(),
      text: item.text,
      done: false,
      depth: item.depth,
      estimate: item.estimate ?? "",
      startAt: "",
      dueAt: "",
      recurrence: "none" as const,
      templateItemId: item.id,
      autoCompleteRule: parseRuleFromDb(item.auto_complete_rule),
    };
    const row = outlineLineToDbInsert(line, input.coachId, nextSort, {
      assignmentId: assignment.id,
      isLocked: true,
    });
    nextSort += 1;
    return row;
  });

  const { error: insertError } = await supabaseAdmin.from("coach_action_items").insert(rows);
  if (insertError) {
    await supabaseAdmin
      .from("coach_action_plan_assignments")
      .delete()
      .eq("id", assignment.id);
    throw insertError;
  }

  return assignment.id as string;
}

export async function inviteCoachesToActionPlan(input: {
  templateId: string;
  coachIds: string[];
  invitedBy: string;
}): Promise<PushActionPlanResult> {
  const result: PushActionPlanResult = {
    assigned: [],
    skipped: [],
    failed: [],
  };

  const { data: template, error: templateError } = await supabaseAdmin
    .from("action_plan_templates")
    .select("id")
    .eq("id", input.templateId)
    .maybeSingle();
  if (templateError) throw templateError;
  if (!template) throw new Error("Template not found.");

  const items = await loadTemplateItems(input.templateId);
  if (!items.length) {
    throw new Error("Template has no items.");
  }

  for (const coachId of input.coachIds) {
    try {
      if (await coachHasActiveAssignment(input.templateId, coachId)) {
        result.skipped.push(coachId);
        continue;
      }

      const { data: pending, error: pendingError } = await supabaseAdmin
        .from("coach_action_plan_invitations")
        .select("id")
        .eq("template_id", input.templateId)
        .eq("coach_id", coachId)
        .eq("status", "pending")
        .maybeSingle();
      if (pendingError) throw pendingError;
      if (pending) {
        result.skipped.push(coachId);
        continue;
      }

      const { error: insertError } = await supabaseAdmin
        .from("coach_action_plan_invitations")
        .insert({
          template_id: input.templateId,
          coach_id: coachId,
          invited_by: input.invitedBy,
          status: "pending",
        });
      if (insertError) throw insertError;

      result.assigned.push(coachId);
    } catch (err) {
      result.failed.push({
        coachId,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return result;
}

export function templateItemsToPreviewLines(items: TemplateItemRow[]): ActionOutlineLine[] {
  return items.map((row) => templateItemToOutlineLine(row));
}
