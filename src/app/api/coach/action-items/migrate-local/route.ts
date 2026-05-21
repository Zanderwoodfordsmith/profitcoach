import { dbItemToOutlineLine, outlineLineToDbInsert } from "@/lib/actionPlans/mappers";
import { requireCoachForActions } from "@/lib/actionPlans/requireCoachForActions";
import type { ActionOutlineLine } from "@/lib/actionPlans/types";
import { normalizeLegacyStorageLines } from "@/lib/actionPlans/actionOutlineUtils";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function parseLines(body: unknown): ActionOutlineLine[] | null {
  if (!body || typeof body !== "object") return null;
  const lines = (body as { lines?: unknown }).lines;
  if (!Array.isArray(lines)) return null;
  return lines as ActionOutlineLine[];
}

export async function POST(request: Request) {
  const authCheck = await requireCoachForActions(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const { count, error: countError } = await supabaseAdmin
      .from("coach_action_items")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", authCheck.userId);
    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }
    if ((count ?? 0) > 0) {
      return NextResponse.json({ migrated: false, reason: "already_has_items" });
    }

    const body = await request.json();
    let lines = parseLines(body);
    if (!lines?.length) {
      const raw = (body as { raw?: unknown }).raw;
      lines = normalizeLegacyStorageLines(raw) ?? [];
    }
    if (!lines.length) {
      return NextResponse.json({ migrated: false, reason: "empty" });
    }

    const rows = lines.map((line, index) =>
      outlineLineToDbInsert(line, authCheck.userId, index, { isLocked: false }),
    );

    const { error: insertError } = await supabaseAdmin
      .from("coach_action_items")
      .insert(rows);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin
      .from("coach_action_items")
      .select("*")
      .eq("coach_id", authCheck.userId)
      .order("sort_order", { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      migrated: true,
      items: (data ?? []).map((row) => dbItemToOutlineLine(row)),
    });
  } catch (err) {
    console.error("coach/action-items/migrate-local POST error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
