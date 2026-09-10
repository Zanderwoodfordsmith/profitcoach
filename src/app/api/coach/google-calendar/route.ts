import { NextResponse } from "next/server";
import {
  deleteGoogleConnection,
  getValidGoogleAccessToken,
  listGoogleCalendars,
  loadGoogleConnectionPublic,
} from "@/lib/booking/googleCalendar";
import { isGoogleCalendarConfigured } from "@/lib/booking/googleCalendarOAuth";
import {
  requireCoachOrAdmin,
  resolveCoachTarget,
} from "@/lib/booking/resolveCoachTarget";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

  const status = await loadGoogleConnectionPublic(target.coach.id);
  if (!status?.connected) {
    return NextResponse.json({
      configured: isGoogleCalendarConfigured(),
      connected: false,
      email: null,
      calendars: [],
      busy_calendar_ids: [],
      event_calendar_id: "primary",
      is_self: target.isSelf,
    });
  }

  let calendars: Awaited<ReturnType<typeof listGoogleCalendars>> = [];
  // Use the target coach's stored refresh token (works for view-as + self).
  try {
    const accessToken = await getValidGoogleAccessToken(target.coach.id);
    if (accessToken) {
      calendars = await listGoogleCalendars(accessToken);
    }
  } catch (error) {
    console.error("google calendar GET list:", error);
  }

  return NextResponse.json({
    configured: status.configured,
    connected: true,
    email: status.email,
    calendars,
    busy_calendar_ids: status.busy_calendar_ids,
    event_calendar_id: status.event_calendar_id,
    is_self: target.isSelf,
  });
}

type PatchBody = {
  busy_calendar_ids?: string[];
  event_calendar_id?: string;
};

export async function PATCH(request: Request) {
  const auth = await requireCoachOrAdmin(request);
  if (auth.error || !auth.userId || !auth.role) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let target: Awaited<ReturnType<typeof resolveCoachTarget>>;
  try {
    target = await resolveCoachTarget({
      auth: { userId: auth.userId, role: auth.role },
      forSlug: null,
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

  if (!target.isSelf) {
    return NextResponse.json(
      {
        error:
          "Sign in as this coach to change Google Calendar preferences.",
      },
      { status: 403 }
    );
  }

  const status = await loadGoogleConnectionPublic(target.coach.id);
  if (!status?.connected) {
    return NextResponse.json(
      { error: "Google Calendar is not connected." },
      { status: 400 }
    );
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.busy_calendar_ids !== undefined) {
    if (
      !Array.isArray(body.busy_calendar_ids) ||
      body.busy_calendar_ids.some((id) => typeof id !== "string" || !id.trim())
    ) {
      return NextResponse.json(
        { error: "busy_calendar_ids must be an array of calendar ids." },
        { status: 400 }
      );
    }
    patch.busy_calendar_ids = body.busy_calendar_ids.map((id) => id.trim());
  }
  if (body.event_calendar_id !== undefined) {
    const id = body.event_calendar_id.trim();
    if (!id) {
      return NextResponse.json(
        { error: "event_calendar_id is required." },
        { status: 400 }
      );
    }
    patch.event_calendar_id = id;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("coach_google_calendar_connections")
    .update(patch)
    .eq("coach_id", target.coach.id);

  if (error) {
    console.error("google calendar PATCH:", error);
    return NextResponse.json({ error: "Could not update." }, { status: 500 });
  }

  const next = await loadGoogleConnectionPublic(target.coach.id);
  return NextResponse.json({ ...next, is_self: true });
}

export async function DELETE(request: Request) {
  const auth = await requireCoachOrAdmin(request);
  if (auth.error || !auth.userId || !auth.role) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let target: Awaited<ReturnType<typeof resolveCoachTarget>>;
  try {
    target = await resolveCoachTarget({
      auth: { userId: auth.userId, role: auth.role },
      forSlug: null,
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

  if (!target.isSelf) {
    return NextResponse.json(
      { error: "Sign in as this coach to disconnect Google Calendar." },
      { status: 403 }
    );
  }

  await deleteGoogleConnection(target.coach.id);
  return NextResponse.json({ connected: false, is_self: true });
}
