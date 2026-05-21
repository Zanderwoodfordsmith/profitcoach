import {
  outlineLineToTemplateItemInsert,
} from "@/lib/actionPlans/mappers";
import type {
  ActionOutlineLine,
  ActionPlanTemplateSummary,
} from "@/lib/actionPlans/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function buildTemplateSummary(template: {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}): Promise<ActionPlanTemplateSummary> {
  const { count: itemCount } = await supabaseAdmin
    .from("action_plan_template_items")
    .select("id", { count: "exact", head: true })
    .eq("template_id", template.id);

  const { data: assignments } = await supabaseAdmin
    .from("coach_action_plan_assignments")
    .select("id, coach_id")
    .eq("template_id", template.id)
    .eq("status", "active");

  const assignedCoachCount = assignments?.length ?? 0;
  let completionPercent: number | null = null;

  const { data: invitations } = await supabaseAdmin
    .from("coach_action_plan_invitations")
    .select("status")
    .eq("template_id", template.id);

  const pendingInviteCount =
    invitations?.filter((row) => row.status === "pending").length ?? 0;
  const acceptedInviteCount =
    invitations?.filter((row) => row.status === "accepted").length ?? 0;

  if (assignedCoachCount > 0) {
    const assignmentIds = (assignments ?? []).map((a) => a.id as string);
    const { data: items } = await supabaseAdmin
      .from("coach_action_items")
      .select("assignment_id, done")
      .in("assignment_id", assignmentIds)
      .eq("is_locked", true);

    const byAssignment = new Map<string, { total: number; done: number }>();
    for (const item of items ?? []) {
      const key = item.assignment_id as string;
      const entry = byAssignment.get(key) ?? { total: 0, done: 0 };
      entry.total += 1;
      if (item.done) entry.done += 1;
      byAssignment.set(key, entry);
    }

    const percents = [...byAssignment.values()]
      .filter((entry) => entry.total > 0)
      .map((entry) => (entry.done / entry.total) * 100);
    if (percents.length) {
      completionPercent = Math.round(
        percents.reduce((sum, value) => sum + value, 0) / percents.length,
      );
    }
  }

  return {
    id: template.id,
    title: template.title,
    description: template.description,
    createdAt: template.created_at,
    updatedAt: template.updated_at,
    itemCount: itemCount ?? 0,
    assignedCoachCount,
    pendingInviteCount,
    acceptedInviteCount,
    completionPercent,
  };
}

export async function GET(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("action_plan_templates")
      .select("id, title, description, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const templates = await Promise.all(
      (data ?? []).map((row) => buildTemplateSummary(row)),
    );
    return NextResponse.json({ templates });
  } catch (err) {
    console.error("admin/action-plans GET error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : null;
    if (!title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("action_plan_templates")
      .insert({
        title,
        description: description || null,
        created_by: authCheck.userId,
      })
      .select("id, title, description, created_at, updated_at")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const defaultLine: ActionOutlineLine = {
      id: randomUUID(),
      text: title,
      done: false,
      depth: 0,
      estimate: "",
      startAt: "",
      dueAt: "",
      recurrence: "none",
    };
    await supabaseAdmin.from("action_plan_template_items").insert(
      outlineLineToTemplateItemInsert(data.id, defaultLine, 0),
    );

    return NextResponse.json({
      template: await buildTemplateSummary(data),
    });
  } catch (err) {
    console.error("admin/action-plans POST error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  return NextResponse.json({ error: "Use /api/admin/action-plans/[id]." }, { status: 405 });
}
