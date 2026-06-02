import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapBlockRow, type TimeTrackerBlockRow } from "@/lib/timeTracker/mappers";
import type { TimeBlockPriority, TimeBlockRating } from "@/lib/timeTracker/types";

const VALID_RATINGS: TimeBlockRating[] = ["good", "bad", "neutral", "unset"];
const VALID_PRIORITIES: TimeBlockPriority[] = ["high", "medium", "low", "none"];
const BLOCK_COLUMNS =
  "id, user_id, day_date, start_min, end_min, title, notes, rating, priority, category, created_at, updated_at";

function clampMin(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > 1440) return null;
  return rounded;
}

async function loadOwnedBlock(id: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("time_tracker_block")
    .select("id, user_id, start_min, end_min")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { error: "not_found" as const, block: null };
  if (data.user_id !== userId) return { error: "forbidden" as const, block: null };
  return { error: null, block: data };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const owned = await loadOwnedBlock(id, authCheck.userId);
  if (owned.error === "not_found") {
    return NextResponse.json({ error: "Block not found." }, { status: 404 });
  }
  if (owned.error === "forbidden") {
    return NextResponse.json(
      { error: "You can only edit your own blocks." },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.title === "string") update.title = body.title.slice(0, 280);
  if (typeof body.notes === "string") update.notes = body.notes.slice(0, 4000);
  if (typeof body.category === "string") {
    update.category = body.category.slice(0, 120);
  }
  if (VALID_RATINGS.includes(body.rating as TimeBlockRating)) {
    update.rating = body.rating;
  }
  if (VALID_PRIORITIES.includes(body.priority as TimeBlockPriority)) {
    update.priority = body.priority;
  }

  const nextStart =
    body.startMin === undefined ? owned.block!.start_min : clampMin(body.startMin);
  const nextEnd =
    body.endMin === undefined ? owned.block!.end_min : clampMin(body.endMin);
  if (body.startMin !== undefined || body.endMin !== undefined) {
    if (nextStart === null || nextEnd === null || nextEnd <= nextStart) {
      return NextResponse.json({ error: "Invalid time range." }, { status: 400 });
    }
    update.start_min = nextStart;
    update.end_min = nextEnd;
  }

  const { data, error } = await supabaseAdmin
    .from("time_tracker_block")
    .update(update)
    .eq("id", id)
    .select(BLOCK_COLUMNS)
    .single();

  if (error || !data) {
    console.error("time-tracker block PATCH:", error);
    return NextResponse.json({ error: "Unable to update block." }, { status: 500 });
  }

  return NextResponse.json({ block: mapBlockRow(data as TimeTrackerBlockRow) });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const owned = await loadOwnedBlock(id, authCheck.userId);
  if (owned.error === "not_found") {
    return NextResponse.json({ error: "Block not found." }, { status: 404 });
  }
  if (owned.error === "forbidden") {
    return NextResponse.json(
      { error: "You can only delete your own blocks." },
      { status: 403 }
    );
  }

  const { error } = await supabaseAdmin
    .from("time_tracker_block")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("time-tracker block DELETE:", error);
    return NextResponse.json({ error: "Unable to delete block." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
