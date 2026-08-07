import { NextResponse } from "next/server";
import { ensureCoachRowForUser } from "@/lib/booking/bookingService";
import {
  deleteGoogleConnection,
  getValidGoogleAccessToken,
  listGoogleCalendars,
  loadGoogleConnectionPublic,
} from "@/lib/booking/googleCalendar";
import { isGoogleCalendarConfigured } from "@/lib/booking/googleCalendarOAuth";
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

  let coach: { id: string };
  try {
    coach = await ensureCoachRowForUser(auth.userId);
  } catch {
    return NextResponse.json(
      { error: "Could not set up coach profile." },
      { status: 500 }
    );
  }

  const status = await loadGoogleConnectionPublic(coach.id);
  if (!status?.connected) {
    return NextResponse.json({
      configured: isGoogleCalendarConfigured(),
      connected: false,
      email: null,
      calendars: [],
      busy_calendar_ids: [],
      event_calendar_id: "primary",
    });
  }

  let calendars: Awaited<ReturnType<typeof listGoogleCalendars>> = [];
  try {
    const accessToken = await getValidGoogleAccessToken(coach.id);
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
  });
}

type PatchBody = {
  busy_calendar_ids?: string[];
  event_calendar_id?: string;
};

export async function PATCH(request: Request) {
  const auth = await requireSelfUser(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let coach: { id: string };
  try {
    coach = await ensureCoachRowForUser(auth.userId);
  } catch {
    return NextResponse.json(
      { error: "Could not set up coach profile." },
      { status: 500 }
    );
  }

  const status = await loadGoogleConnectionPublic(coach.id);
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
    .eq("coach_id", coach.id);

  if (error) {
    console.error("google calendar PATCH:", error);
    return NextResponse.json({ error: "Could not update." }, { status: 500 });
  }

  const next = await loadGoogleConnectionPublic(coach.id);
  return NextResponse.json(next);
}

export async function DELETE(request: Request) {
  const auth = await requireSelfUser(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let coach: { id: string };
  try {
    coach = await ensureCoachRowForUser(auth.userId);
  } catch {
    return NextResponse.json(
      { error: "Could not set up coach profile." },
      { status: 500 }
    );
  }

  await deleteGoogleConnection(coach.id);
  return NextResponse.json({ connected: false });
}
