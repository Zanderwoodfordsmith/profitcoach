import { NextResponse } from "next/server";
import { loadUnipileBusyForRange } from "@/lib/booking/unipileCalendar";
import {
  requireCoachOrAdmin,
  resolveCoachTarget,
} from "@/lib/booking/resolveCoachTarget";
import type { CalendarBusyBlock } from "@/lib/calls/calendarView";

const MAX_RANGE_MS = 50 * 24 * 60 * 60 * 1000;
const MAX_INTERVALS = 400;

function parseBound(raw: string | null): Date | null {
  const value = raw?.trim();
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function GET(request: Request) {
  const auth = await requireCoachOrAdmin(request);
  if (auth.error || !auth.userId || !auth.role) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const url = new URL(request.url);
  const from = parseBound(url.searchParams.get("from"));
  const to = parseBound(url.searchParams.get("to"));
  if (!from || !to || to.getTime() <= from.getTime()) {
    return NextResponse.json(
      { error: "from and to must be valid ISO datetimes, with to after from." },
      { status: 400 }
    );
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    return NextResponse.json(
      { error: "Date range is too large." },
      { status: 400 }
    );
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

  try {
    const loaded = await loadUnipileBusyForRange({
      coachId: target.coach.id,
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
    });
    const intervals: CalendarBusyBlock[] = loaded.intervals
      .slice(0, MAX_INTERVALS)
      .map((row, index) => ({
        id: row.id || `${row.starts_at}:${row.ends_at}:${index}`,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        title: row.title?.trim() || "Busy",
        all_day: Boolean(row.all_day),
      }));
    return NextResponse.json({
      intervals,
      connected: loaded.connected,
      calendar_error: loaded.calendar_error,
    });
  } catch (error) {
    console.error("calendar-busy GET:", error);
    return NextResponse.json(
      { error: "Could not load busy times." },
      { status: 500 }
    );
  }
}
