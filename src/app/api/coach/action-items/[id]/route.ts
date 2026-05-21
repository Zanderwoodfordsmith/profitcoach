import { dbItemToOutlineLine } from "@/lib/actionPlans/mappers";
import { requireCoachForActions } from "@/lib/actionPlans/requireCoachForActions";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireCoachForActions(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const done = (body as { done?: unknown }).done;
    if (typeof done !== "boolean") {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("coach_action_items")
      .select("*")
      .eq("id", id)
      .eq("coach_id", authCheck.userId)
      .maybeSingle();
    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("coach_action_items")
      .update({
        done,
        done_at: done ? now : null,
        done_source: done ? "manual" : null,
        updated_at: now,
      })
      .eq("id", id)
      .eq("coach_id", authCheck.userId)
      .select("*")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item: dbItemToOutlineLine(data) });
  } catch (err) {
    console.error("coach/action-items/[id] PATCH error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
