import { NextResponse } from "next/server";
import { updateCoachCalendar } from "@/lib/booking/bookingService";
import type { CoachCalendarPatch } from "@/lib/booking/coachCalendars";
import {
  requireCoachOrAdmin,
  resolveCoachTarget,
} from "@/lib/booking/resolveCoachTarget";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireCoachOrAdmin(request);
  if (auth.error || !auth.userId || !auth.role) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing calendar id." }, { status: 400 });
  }

  let body: CoachCalendarPatch & { forSlug?: string };
  try {
    body = (await request.json()) as CoachCalendarPatch & { forSlug?: string };
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

  const { forSlug: _forSlug, ...patch } = body;

  if (
    patch.location_mode !== undefined &&
    patch.location_mode !== "google_meet" &&
    patch.location_mode !== "phone" &&
    patch.location_mode !== "custom"
  ) {
    return NextResponse.json(
      { error: "Invalid location_mode." },
      { status: 400 }
    );
  }

  try {
    const calendar = await updateCoachCalendar(
      target.coach.id,
      id.trim(),
      patch
    );
    if (!calendar) {
      return NextResponse.json({ error: "Calendar not found." }, { status: 404 });
    }
    return NextResponse.json({ calendar });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not update.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
