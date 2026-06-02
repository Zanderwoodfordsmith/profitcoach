import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapSettingsRow, type TimeTrackerSettingsRow } from "@/lib/timeTracker/mappers";

const VALID_SLOTS = [5, 10, 15, 30, 60];

export async function GET(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim() || authCheck.userId;

  const { data, error } = await supabaseAdmin
    .from("time_tracker_settings")
    .select("user_id, day_start_min, visible_hours, slot_minutes")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("time-tracker settings GET:", error);
    return NextResponse.json({ error: "Unable to load settings." }, { status: 500 });
  }

  return NextResponse.json({
    settings: mapSettingsRow((data as TimeTrackerSettingsRow | null) ?? null),
  });
}

export async function PATCH(request: Request) {
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

  const dayStartMin = Number(body.dayStartMin);
  const visibleHours = Number(body.visibleHours);
  const slotMinutes = Number(body.slotMinutes);

  if (!Number.isInteger(dayStartMin) || dayStartMin < 0 || dayStartMin >= 1440) {
    return NextResponse.json({ error: "Invalid day start." }, { status: 400 });
  }
  if (!Number.isInteger(visibleHours) || visibleHours < 1 || visibleHours > 24) {
    return NextResponse.json({ error: "Invalid visible hours." }, { status: 400 });
  }
  if (!VALID_SLOTS.includes(slotMinutes)) {
    return NextResponse.json({ error: "Invalid slot size." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("time_tracker_settings")
    .upsert(
      {
        user_id: authCheck.userId,
        day_start_min: dayStartMin,
        visible_hours: visibleHours,
        slot_minutes: slotMinutes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("user_id, day_start_min, visible_hours, slot_minutes")
    .single();

  if (error || !data) {
    console.error("time-tracker settings PATCH:", error);
    return NextResponse.json({ error: "Unable to save settings." }, { status: 500 });
  }

  return NextResponse.json({
    settings: mapSettingsRow(data as TimeTrackerSettingsRow),
  });
}
