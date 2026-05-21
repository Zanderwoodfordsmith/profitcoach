import { randomUUID } from "crypto";
import { parseRuleFromDb } from "@/lib/actionPlans/autoCompleteRules";
import { outlineLineToDbInsert, isMissingEstimateColumnError } from "@/lib/actionPlans/mappers";
import type { PushActionPlanResult } from "@/lib/actionPlans/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function resolvePushCoachIds(input: {
  mode: "all" | "coaches" | "groups";
  coachIds?: string[];
  groupIds?: string[];
}): Promise<string[]> {
  if (input.mode === "coaches") {
    return [...new Set((input.coachIds ?? []).filter(Boolean))];
  }

  if (input.mode === "groups") {
    const groupIds = [...new Set((input.groupIds ?? []).filter(Boolean))];
    if (!groupIds.length) return [];
    const { data, error } = await supabaseAdmin
      .from("coach_group_members")
      .select("coach_id")
      .in("group_id", groupIds);
    if (error) throw error;
    return [...new Set((data ?? []).map((row) => row.coach_id as string))];
  }

  const { data, error } = await supabaseAdmin
    .from("coaches")
    .select("id")
    .eq("record_kind", "member");
  if (error) throw error;
  return (data ?? []).map((row) => row.id as string);
}

export async function pushActionPlanToCoaches(input: {
  templateId: string;
  coachIds: string[];
  assignedBy: string;
}): Promise<PushActionPlanResult> {
  const result: PushActionPlanResult = {
    assigned: [],
    skipped: [],
    failed: [],
  };

  const { data: template, error: templateError } = await supabaseAdmin
    .from("action_plan_templates")
    .select("id, title")
    .eq("id", input.templateId)
    .maybeSingle();
  if (templateError) throw templateError;
  if (!template) throw new Error("Template not found.");

  type TemplateItemRow = {
    id: string;
    text: string;
    depth: number;
    sort_order: number;
    estimate?: string | null;
    auto_complete_rule: unknown;
  };

  let templateItems: TemplateItemRow[] | null = null;
  let itemsError: { message?: string; code?: string } | null = null;

  const withEstimate = await supabaseAdmin
    .from("action_plan_template_items")
    .select("id, text, depth, sort_order, estimate, auto_complete_rule")
    .eq("template_id", input.templateId)
    .order("sort_order", { ascending: true });
  templateItems = withEstimate.data;
  itemsError = withEstimate.error;

  if (itemsError && isMissingEstimateColumnError(itemsError)) {
    const withoutEstimate = await supabaseAdmin
      .from("action_plan_template_items")
      .select("id, text, depth, sort_order, auto_complete_rule")
      .eq("template_id", input.templateId)
      .order("sort_order", { ascending: true });
    templateItems = withoutEstimate.data;
    itemsError = withoutEstimate.error;
  }
  if (itemsError) throw itemsError;

  const items = templateItems ?? [];
  if (!items.length) {
    throw new Error("Template has no items.");
  }

  for (const coachId of input.coachIds) {
    try {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("coach_action_plan_assignments")
        .select("id")
        .eq("template_id", input.templateId)
        .eq("coach_id", coachId)
        .eq("status", "active")
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        result.skipped.push(coachId);
        continue;
      }

      const maxSortResult = await supabaseAdmin
        .from("coach_action_items")
        .select("sort_order")
        .eq("coach_id", coachId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      let nextSort = (maxSortResult.data?.sort_order ?? -1) + 1;

      const { data: assignment, error: assignmentError } = await supabaseAdmin
        .from("coach_action_plan_assignments")
        .insert({
          template_id: input.templateId,
          coach_id: coachId,
          assigned_by: input.assignedBy,
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
        const row = outlineLineToDbInsert(line, coachId, nextSort, {
          assignmentId: assignment.id,
          isLocked: true,
        });
        nextSort += 1;
        return row;
      });

      const { error: insertError } = await supabaseAdmin
        .from("coach_action_items")
        .insert(rows);
      if (insertError) {
        await supabaseAdmin
          .from("coach_action_plan_assignments")
          .delete()
          .eq("id", assignment.id);
        throw insertError;
      }

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
