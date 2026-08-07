import { NextResponse } from "next/server";
import {
  ensureCoachRowForUser,
  ensureDefaultCoachCalendars,
  listCoachCalendars,
  loadBookingSettingsForCoach,
  loadCoachTimezone,
  updateCoachCalendar,
  upsertBookingSettings,
} from "@/lib/booking/bookingService";
import type { AvailabilityRuleRow } from "@/lib/booking/computeBookingSlots";
import { isValidIanaTimeZone } from "@/lib/booking/bookingTime";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireSelfUser(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!token) return { error: "Missing access token." as const, userId: null };

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
  } catch {
    return NextResponse.json(
      { error: "Could not set up coach profile." },
      { status: 500 }
    );
  }

  const calendars = await ensureDefaultCoachCalendars(coach.id);
  const timezone = await loadCoachTimezone(coach.id);
  const { rules } = await loadBookingSettingsForCoach(coach.id);

  return NextResponse.json({
    slug: coach.slug,
    timezone,
    rules,
    calendars,
  });
}

type PatchBody = {
  timezone?: string;
  rules?: AvailabilityRuleRow[];
};

/** Patch shared coach-level timezone / weekly availability. */
export async function PATCH(request: Request) {
  const auth = await requireSelfUser(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let coach: { id: string; slug: string };
  try {
    coach = await ensureCoachRowForUser(auth.userId);
  } catch {
    return NextResponse.json(
      { error: "Could not set up coach profile." },
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

  const patch: Parameters<typeof upsertBookingSettings>[1] = {};
  if (body.timezone !== undefined) patch.timezone = body.timezone;
  if (body.rules !== undefined) patch.rules = body.rules;

  if (Object.keys(patch).length > 0) {
    await upsertBookingSettings(coach.id, patch);
  }

  const calendars = await listCoachCalendars(coach.id);
  const timezone = await loadCoachTimezone(coach.id);
  const { rules } = await loadBookingSettingsForCoach(coach.id);

  return NextResponse.json({
    slug: coach.slug,
    timezone,
    rules,
    calendars,
  });
}
