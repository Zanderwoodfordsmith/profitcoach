import { NextResponse } from "next/server";
import {
  ensureDefaultCoachCalendars,
  listCoachCalendars,
  loadBookingSettingsForCoach,
  loadCoachTimezone,
  upsertBookingSettings,
} from "@/lib/booking/bookingService";
import type { AvailabilityRuleRow } from "@/lib/booking/computeBookingSlots";
import { isValidIanaTimeZone } from "@/lib/booking/bookingTime";
import {
  requireCoachOrAdmin,
  resolveCoachTarget,
} from "@/lib/booking/resolveCoachTarget";

export async function GET(request: Request) {
  const auth = await requireCoachOrAdmin(request);
  if (auth.error || !auth.userId || !auth.role) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const url = new URL(request.url);
  const forSlug = url.searchParams.get("forSlug");

  let target: Awaited<ReturnType<typeof resolveCoachTarget>>;
  try {
    target = await resolveCoachTarget({
      auth: { userId: auth.userId, role: auth.role },
      forSlug,
      impersonateCoachId: auth.impersonateCoachId,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not set up coach profile." },
      { status: 500 }
    );
  }

  if (!target.ok) {
    return NextResponse.json({ error: target.error }, { status: target.status });
  }

  const calendars = await ensureDefaultCoachCalendars(target.coach.id);
  const timezone = await loadCoachTimezone(target.coach.id);
  const { rules } = await loadBookingSettingsForCoach(target.coach.id);

  return NextResponse.json({
    slug: target.coach.slug,
    timezone,
    rules,
    calendars,
    is_self: target.isSelf,
  });
}

type PatchBody = {
  timezone?: string;
  rules?: AvailabilityRuleRow[];
  forSlug?: string;
};

/** Patch shared coach-level timezone / weekly availability. */
export async function PATCH(request: Request) {
  const auth = await requireCoachOrAdmin(request);
  if (auth.error || !auth.userId || !auth.role) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  let target: Awaited<ReturnType<typeof resolveCoachTarget>>;
  try {
    target = await resolveCoachTarget({
      auth: { userId: auth.userId, role: auth.role },
      forSlug: body.forSlug,
      impersonateCoachId: auth.impersonateCoachId,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not set up coach profile." },
      { status: 500 }
    );
  }

  if (!target.ok) {
    return NextResponse.json({ error: target.error }, { status: target.status });
  }

  if (body.timezone !== undefined && !isValidIanaTimeZone(body.timezone)) {
    return NextResponse.json({ error: "Invalid timezone." }, { status: 400 });
  }

  const patch: Parameters<typeof upsertBookingSettings>[1] = {};
  if (body.timezone !== undefined) patch.timezone = body.timezone;
  if (body.rules !== undefined) patch.rules = body.rules;

  if (Object.keys(patch).length > 0) {
    await upsertBookingSettings(target.coach.id, patch);
  }

  const calendars = await listCoachCalendars(target.coach.id);
  const timezone = await loadCoachTimezone(target.coach.id);
  const { rules } = await loadBookingSettingsForCoach(target.coach.id);

  return NextResponse.json({
    slug: target.coach.slug,
    timezone,
    rules,
    calendars,
    is_self: target.isSelf,
  });
}
