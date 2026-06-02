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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim();
  const from = url.searchParams.get("from")?.trim();
  const to = url.searchParams.get("to")?.trim();

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json(
      { error: "from and to dates are required (YYYY-MM-DD)." },
      { status: 400 }
    );
  }

  // Confirm the requested user is actually an admin before exposing their data.
  const { data: targetProfile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (!targetProfile || targetProfile.role !== "admin") {
    return NextResponse.json({ error: "Not an admin user." }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("time_tracker_block")
    .select(BLOCK_COLUMNS)
    .eq("user_id", userId)
    .gte("day_date", from)
    .lte("day_date", to)
    .order("day_date", { ascending: true })
    .order("start_min", { ascending: true });

  if (error) {
    console.error("time-tracker blocks GET:", error);
    return NextResponse.json({ error: "Unable to load blocks." }, { status: 500 });
  }

  return NextResponse.json({
    blocks: ((data ?? []) as TimeTrackerBlockRow[]).map(mapBlockRow),
  });
}

export async function POST(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const dayDate = typeof body.dayDate === "string" ? body.dayDate.trim() : "";
  const startMin = clampMin(body.startMin);
  const endMin = clampMin(body.endMin);

  if (!DATE_RE.test(dayDate)) {
    return NextResponse.json({ error: "Invalid dayDate." }, { status: 400 });
  }
  if (startMin === null || endMin === null || endMin <= startMin) {
    return NextResponse.json({ error: "Invalid time range." }, { status: 400 });
  }

  const rating: TimeBlockRating = VALID_RATINGS.includes(
    body.rating as TimeBlockRating
  )
    ? (body.rating as TimeBlockRating)
    : "unset";
  const priority: TimeBlockPriority = VALID_PRIORITIES.includes(
    body.priority as TimeBlockPriority
  )
    ? (body.priority as TimeBlockPriority)
    : "none";

  const { data, error } = await supabaseAdmin
    .from("time_tracker_block")
    .insert({
      user_id: authCheck.userId,
      day_date: dayDate,
      start_min: startMin,
      end_min: endMin,
      title: typeof body.title === "string" ? body.title.slice(0, 280) : "",
      notes: typeof body.notes === "string" ? body.notes.slice(0, 4000) : "",
      rating,
      priority,
      category:
        typeof body.category === "string" ? body.category.slice(0, 120) : "",
    })
    .select(BLOCK_COLUMNS)
    .single();

  if (error || !data) {
    console.error("time-tracker blocks POST:", error);
    return NextResponse.json({ error: "Unable to create block." }, { status: 500 });
  }

  return NextResponse.json({ block: mapBlockRow(data as TimeTrackerBlockRow) });
}
