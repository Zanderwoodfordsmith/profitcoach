import { NextResponse } from "next/server";
import {
  deleteGoogleConnection,
} from "@/lib/booking/googleCalendar";
import {
  loadCoachCalendarStatus,
  upsertUnipileCalendarPrefs,
  type CalendarMailingProvider,
} from "@/lib/booking/unipileCalendar";
import {
  requireCoachOrAdmin,
  resolveCoachTarget,
  canAccessCoachResource,
} from "@/lib/booking/resolveCoachTarget";
import { removeOutreachAccount } from "@/lib/unipile/outreachAccounts";

function parseProvider(raw: string | null): CalendarMailingProvider {
  return raw?.trim().toUpperCase() === "OUTLOOK" ? "OUTLOOK" : "GOOGLE";
}

export async function GET(request: Request) {
  const auth = await requireCoachOrAdmin(request);
  if (auth.error || !auth.userId || !auth.role) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const url = new URL(request.url);
  const forSlug = url.searchParams.get("forSlug");
  const provider = parseProvider(url.searchParams.get("provider"));

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

  try {
    const status = await loadCoachCalendarStatus({
      coachId: target.coach.id,
      provider,
    });
    return NextResponse.json({
      ...status,
      is_self: target.isSelf,
      can_manage: canAccessCoachResource(auth, target.coach.id),
    });
  } catch (error) {
    console.error("unipile calendar GET:", error);
    return NextResponse.json(
      { error: "Could not load calendar status." },
      { status: 500 }
    );
  }
}

type PatchBody = {
  busy_calendar_ids?: string[];
  event_calendar_id?: string;
  provider?: string;
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

  if (!canAccessCoachResource(auth, target.coach.id)) {
    return NextResponse.json(
      {
        error:
          "Sign in as this coach to change calendar preferences.",
      },
      { status: 403 }
    );
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const provider = parseProvider(body.provider ?? null);
  const status = await loadCoachCalendarStatus({
    coachId: target.coach.id,
    provider,
  });
  if (!status.connected || !status.unipile_account_id) {
    return NextResponse.json(
      { error: "Connect Google or Outlook before saving calendar preferences." },
      { status: 400 }
    );
  }

  const busyIds =
    body.busy_calendar_ids !== undefined
      ? body.busy_calendar_ids
      : status.busy_calendar_ids;
  const eventId =
    body.event_calendar_id !== undefined
      ? body.event_calendar_id.trim()
      : status.event_calendar_id;

  if (
    !Array.isArray(busyIds) ||
    busyIds.some((id) => typeof id !== "string" || !id.trim())
  ) {
    return NextResponse.json(
      { error: "busy_calendar_ids must be an array of calendar ids." },
      { status: 400 }
    );
  }
  if (!eventId) {
    return NextResponse.json(
      { error: "event_calendar_id is required." },
      { status: 400 }
    );
  }

  const knownCalendarIds = new Set(
    (status.calendars ?? []).map((cal) => cal.id)
  );
  if (!knownCalendarIds.has(eventId)) {
    return NextResponse.json(
      { error: "event_calendar_id is not a calendar on this account." },
      { status: 400 }
    );
  }
  if (busyIds.some((id) => !knownCalendarIds.has(id.trim()))) {
    return NextResponse.json(
      { error: "busy_calendar_ids must be calendars on this account." },
      { status: 400 }
    );
  }

  const eventCalendar = (status.calendars ?? []).find((cal) => cal.id === eventId);
  if (eventCalendar && eventCalendar.owned === false) {
    return NextResponse.json(
      { error: "Bookings can only be written to a calendar you own." },
      { status: 400 }
    );
  }

  try {
    await upsertUnipileCalendarPrefs({
      coachId: target.coach.id,
      unipileAccountId: status.unipile_account_id,
      busyCalendarIds: busyIds.map((id) => id.trim()),
      eventCalendarId: eventId,
    });
  } catch (error) {
    console.error("unipile calendar PATCH:", error);
    return NextResponse.json({ error: "Could not update." }, { status: 500 });
  }

  const next = await loadCoachCalendarStatus({
    coachId: target.coach.id,
    provider,
  });
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

  if (!canAccessCoachResource(auth, target.coach.id)) {
    return NextResponse.json(
      { error: "Sign in as this coach to disconnect Google." },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const provider = parseProvider(url.searchParams.get("provider"));
  const status = await loadCoachCalendarStatus({
    coachId: target.coach.id,
    provider,
  });
  if (status.outreach_account_id) {
    try {
      await removeOutreachAccount(target.coach.id, status.outreach_account_id);
    } catch (error) {
      console.error("unipile calendar DELETE:", error);
      return NextResponse.json(
        { error: "Could not disconnect." },
        { status: 500 }
      );
    }
  }
  if (provider === "GOOGLE") {
    await deleteGoogleConnection(target.coach.id);
  }
  return NextResponse.json({ connected: false, is_self: true });
}
