import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { isValidIanaTimeZone } from "@/lib/booking/bookingTime";
import {
  loadBookingSettingsForCoach,
  upsertBookingSettings,
} from "@/lib/booking/bookingService";
import type { AvailabilityRuleRow } from "@/lib/booking/computeBookingSlots";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { data: coach } = await supabaseAdmin
    .from("coaches")
    .select("slug")
    .eq("id", auth.userId)
    .maybeSingle();

  const { settings, rules } = await loadBookingSettingsForCoach(auth.userId);

  return NextResponse.json({
    slug: (coach?.slug as string | null) ?? null,
    settings,
    rules,
  });
}

type PatchBody = {
  timezone?: string;
  meeting_duration_minutes?: number;
  buffer_minutes?: number;
  min_notice_hours?: number;
  booking_window_days?: number;
  is_enabled?: boolean;
  title?: string;
  rules?: AvailabilityRuleRow[];
};

export async function PATCH(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (body.timezone !== undefined && !isValidIanaTimeZone(body.timezone)) {
    return NextResponse.json({ error: "Invalid timezone." }, { status: 400 });
  }

  if (body.rules) {
    for (const rule of body.rules) {
      if (
        typeof rule.weekday !== "number" ||
        rule.weekday < 0 ||
        rule.weekday > 6 ||
        !rule.start_time ||
        !rule.end_time
      ) {
        return NextResponse.json(
          { error: "Invalid availability rule." },
          { status: 400 }
        );
      }
    }
  }

  const patch: Parameters<typeof upsertBookingSettings>[1] = {};
  if (body.timezone !== undefined) patch.timezone = body.timezone;
  if (body.meeting_duration_minutes !== undefined) {
    patch.meeting_duration_minutes = body.meeting_duration_minutes;
  }
  if (body.buffer_minutes !== undefined) patch.buffer_minutes = body.buffer_minutes;
  if (body.min_notice_hours !== undefined) {
    patch.min_notice_hours = body.min_notice_hours;
  }
  if (body.booking_window_days !== undefined) {
    patch.booking_window_days = body.booking_window_days;
  }
  if (body.is_enabled !== undefined) patch.is_enabled = body.is_enabled;
  if (body.title !== undefined) patch.title = body.title.trim() || "15-Minute Discovery Call";
  if (body.rules !== undefined) patch.rules = body.rules;

  const result = await upsertBookingSettings(auth.userId, patch);

  const { data: coach } = await supabaseAdmin
    .from("coaches")
    .select("slug")
    .eq("id", auth.userId)
    .maybeSingle();

  return NextResponse.json({
    slug: (coach?.slug as string | null) ?? null,
    settings: result.settings,
    rules: result.rules,
  });
}
