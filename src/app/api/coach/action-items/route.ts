import { dbItemToOutlineLine, outlineLineToDbInsert } from "@/lib/actionPlans/mappers";
import { requireCoachForActions } from "@/lib/actionPlans/requireCoachForActions";
import { syncCoachActionAutoComplete } from "@/lib/actionPlans/syncAutoComplete";
import type { ActionOutlineLine } from "@/lib/actionPlans/types";
import { createOutlineLine } from "@/lib/actionPlans/actionOutlineUtils";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const authCheck = await requireCoachForActions(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    await syncCoachActionAutoComplete(authCheck.userId);

    const { data, error } = await supabaseAdmin
      .from("coach_action_items")
      .select("*")
      .eq("coach_id", authCheck.userId)
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items = (data ?? []).map((row) => dbItemToOutlineLine(row));
    return NextResponse.json({ items });
  } catch (err) {
    console.error("coach/action-items GET error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

function parseItemsPayload(body: unknown): ActionOutlineLine[] | null {
  if (!body || typeof body !== "object") return null;
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  return items as ActionOutlineLine[];
}

export async function PUT(request: Request) {
  const authCheck = await requireCoachForActions(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const incoming = parseItemsPayload(body);
    if (!incoming) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from("coach_action_items")
      .select("*")
      .eq("coach_id", authCheck.userId);
    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    const lockedById = new Map(
      (existingRows ?? [])
        .filter((row) => row.is_locked)
        .map((row) => [row.id as string, row]),
    );

    for (const item of incoming) {
      const locked = lockedById.get(item.id);
      if (!locked) continue;
      if (item.text !== locked.text || item.assignmentId !== locked.assignment_id) {
        return NextResponse.json(
          { error: "Assigned action items cannot be edited." },
          { status: 400 },
        );
      }
    }

    const personalIncoming = incoming.filter((item) => !lockedById.has(item.id));

    const existingPersonalIds = new Set(
      (existingRows ?? [])
        .filter((row) => !row.is_locked)
        .map((row) => row.id as string),
    );
    const keptPersonalIds = new Set(personalIncoming.map((item) => item.id));
    const deletePersonalIds = [...existingPersonalIds].filter((id) => !keptPersonalIds.has(id));

    if (deletePersonalIds.length) {
      const { error: deleteError } = await supabaseAdmin
        .from("coach_action_items")
        .delete()
        .eq("coach_id", authCheck.userId)
        .in("id", deletePersonalIds)
        .eq("is_locked", false);
      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
    }

    const upserts = personalIncoming.map((item) => {
      const index = incoming.findIndex((line) => line.id === item.id);
      return outlineLineToDbInsert(item, authCheck.userId, index >= 0 ? index : 0, {
        isLocked: false,
      });
    });

    for (const item of incoming) {
      if (!lockedById.has(item.id)) continue;
      const index = incoming.findIndex((line) => line.id === item.id);
      const { error: sortError } = await supabaseAdmin
        .from("coach_action_items")
        .update({
          sort_order: index,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .eq("coach_id", authCheck.userId);
      if (sortError) {
        return NextResponse.json({ error: sortError.message }, { status: 500 });
      }
    }

    if (upserts.length) {
      const { error: upsertError } = await supabaseAdmin
        .from("coach_action_items")
        .upsert(upserts, { onConflict: "id" });
      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 500 });
      }
    }

    if (!incoming.length) {
      const first = createOutlineLine("", 0);
      const row = outlineLineToDbInsert(first, authCheck.userId, 0, { isLocked: false });
      await supabaseAdmin.from("coach_action_items").insert(row);
      return NextResponse.json({ items: [first] });
    }

    const { data: refreshed, error: refreshError } = await supabaseAdmin
      .from("coach_action_items")
      .select("*")
      .eq("coach_id", authCheck.userId)
      .order("sort_order", { ascending: true });
    if (refreshError) {
      return NextResponse.json({ error: refreshError.message }, { status: 500 });
    }

    return NextResponse.json({
      items: (refreshed ?? []).map((row) => dbItemToOutlineLine(row)),
    });
  } catch (err) {
    console.error("coach/action-items PUT error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
