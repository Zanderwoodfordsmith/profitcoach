import {
  isMissingEstimateColumnError,
  outlineLineToTemplateItemInsert,
  templateItemToOutlineLine,
} from "@/lib/actionPlans/mappers";
import type { ActionOutlineLine } from "@/lib/actionPlans/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { randomUUID } from "crypto";

function parseItems(body: unknown): ActionOutlineLine[] | null {
  if (!body || typeof body !== "object") return null;
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  return items as ActionOutlineLine[];
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireAdmin(_request);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const { data: template, error: templateError } = await supabaseAdmin
      .from("action_plan_templates")
      .select("id, title, description, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();
    if (templateError) {
      return NextResponse.json({ error: templateError.message }, { status: 500 });
    }
    if (!template) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("action_plan_template_items")
      .select("*")
      .eq("template_id", id)
      .order("sort_order", { ascending: true });
    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    return NextResponse.json({
      template,
      items: (items ?? []).map((row) => templateItemToOutlineLine(row)),
    });
  } catch (err) {
    console.error("admin/action-plans/[id] GET error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.title === "string") {
      const title = body.title.trim();
      if (!title) {
        return NextResponse.json({ error: "Title is required." }, { status: 400 });
      }
      updates.title = title;
    }
    if (typeof body.description === "string") {
      updates.description = body.description.trim() || null;
    }

    if (Object.keys(updates).length > 1) {
      const { error } = await supabaseAdmin
        .from("action_plan_templates")
        .update(updates)
        .eq("id", id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    const items = parseItems(body);
    if (items) {
      await supabaseAdmin
        .from("action_plan_template_items")
        .delete()
        .eq("template_id", id);

      if (items.length) {
        const rows = items.map((item, index) =>
          outlineLineToTemplateItemInsert(id, { ...item, id: item.id || randomUUID() }, index),
        );
        let { error: insertError } = await supabaseAdmin
          .from("action_plan_template_items")
          .insert(rows);
        if (insertError && isMissingEstimateColumnError(insertError)) {
          const fallbackRows = items.map((item, index) =>
            outlineLineToTemplateItemInsert(
              id,
              { ...item, id: item.id || randomUUID() },
              index,
              { includeEstimate: false },
            ),
          );
          ({ error: insertError } = await supabaseAdmin
            .from("action_plan_template_items")
            .insert(fallbackRows));
        }
        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
      }
    }

    return GET(request, context);
  } catch (err) {
    console.error("admin/action-plans/[id] PATCH error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireAdmin(_request);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const { count } = await supabaseAdmin
      .from("coach_action_plan_assignments")
      .select("id", { count: "exact", head: true })
      .eq("template_id", id)
      .eq("status", "active");
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "Cannot delete a template with active assignments." },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("action_plan_templates")
      .delete()
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin/action-plans/[id] DELETE error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
