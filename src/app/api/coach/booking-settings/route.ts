import { NextResponse } from "next/server";
import { isValidIanaTimeZone } from "@/lib/booking/bookingTime";
import {
  ensureCoachRowForUser,
  loadBookingSettingsForCoach,
  upsertBookingSettings,
} from "@/lib/booking/bookingService";
import type { AvailabilityRuleRow } from "@/lib/booking/computeBookingSlots";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Booking settings always apply to the signed-in user (admin or coach).
 * Impersonation is ignored so staff can set their own hours without
 * switching into another coach’s account.
 */
async function requireSelfUser(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!token) {
    return { error: "Missing access token." as const, userId: null };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return { error: "Invalid access token." as const, userId: null };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return { error: "Not authorized." as const, userId: null };
  }

  return { error: null, userId: user.id as string };
}

export async function GET(request: Request) {
  const auth = await requireSelfUser(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let coach: { id: string; slug: string };
  try {
    coach = await ensureCoachRowForUser(auth.userId);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not set up coach profile for booking." },
      { status: 500 }
    );
  }

  const { settings, rules } = await loadBookingSettingsForCoach(coach.id);

  return NextResponse.json({
    slug: coach.slug,
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
  location_mode?: "google_meet" | "phone" | "custom";
  location_phone?: string | null;
  location_custom?: string | null;
  rules?: AvailabilityRuleRow[];
};

export async function PATCH(request: Request) {
  const auth = await requireSelfUser(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let coach: { id: string; slug: string };
  try {
    coach = await ensureCoachRowForUser(auth.userId);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not set up coach profile for booking." },
      { status: 500 }
    );
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
  if (body.title !== undefined) {
    patch.title = body.title.trim() || "15-Minute Discovery Call";
  }
  if (body.location_mode !== undefined) {
    if (
      body.location_mode !== "google_meet" &&
      body.location_mode !== "phone" &&
      body.location_mode !== "custom"
    ) {
      return NextResponse.json(
        { error: "Invalid location_mode." },
        { status: 400 }
      );
    }
    patch.location_mode = body.location_mode;
  }
  if (body.location_phone !== undefined) {
    patch.location_phone = body.location_phone?.trim() || null;
  }
  if (body.location_custom !== undefined) {
    patch.location_custom = body.location_custom?.trim() || null;
  }
  if (body.rules !== undefined) patch.rules = body.rules;

  const result = await upsertBookingSettings(coach.id, patch);

  return NextResponse.json({
    slug: coach.slug,
    settings: result.settings,
    rules: result.rules,
  });
}
