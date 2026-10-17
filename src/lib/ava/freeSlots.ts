import { loadCalendarSlotDays } from "@/lib/booking/loadCalendarSlotDays";
import { loadCoachCalendarBySlug, loadCoachTimezone } from "@/lib/booking/bookingService";
import { ASSESSMENT_BOOKING_CALENDAR_SLUG, getCoachBookingProvider } from "@/lib/booking/coachBookingProvider";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FreeSlot } from "@/lib/ava/slotPicker";

/**
 * Real free call times for a coach, from whichever calendar the coach has
 * switched on: ours (native) or GHL. Returns null when the calendar cannot be
 * read, so callers fall back to the booking link instead of guessing.
 *
 * GHL needs an API token. Set GHL_LOCATION_TOKENS to a JSON map of
 * { "<locationId>": "<private integration token>" }, or GHL_API_TOKEN for a
 * token that can read every coach's location.
 */

const LOOKAHEAD_DAYS = 7;
const GHL_BASE = "https://services.leadconnectorhq.com";

export type CoachSlots = {
  provider: "native" | "ghl";
  timeZone: string;
  slots: FreeSlot[];
  bookingUrl: string | null;
};

function appBase(): string {
  return (process.env.APP_BASE_URL || "https://app.theprofitcoach.com").replace(/\/$/, "");
}

export function ghlTokenFor(locationId: string | null | undefined): string | null {
  const map = process.env.GHL_LOCATION_TOKENS?.trim();
  if (map && locationId) {
    try {
      const parsed = JSON.parse(map) as Record<string, unknown>;
      const token = parsed[locationId];
      if (typeof token === "string" && token.trim()) return token.trim();
    } catch {
      console.error("GHL_LOCATION_TOKENS is not valid JSON");
    }
  }
  return process.env.GHL_API_TOKEN?.trim() || null;
}

/** GHL free-slots response: { "2026-10-20": { slots: ["2026-10-20T10:00:00+01:00", ...] }, traceId }. */
export function parseGhlFreeSlots(raw: unknown): FreeSlot[] {
  if (!raw || typeof raw !== "object") return [];
  const out: FreeSlot[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const slots = (value as { slots?: unknown })?.slots;
    if (!Array.isArray(slots)) continue;
    for (const s of slots) {
      const iso = typeof s === "string" ? s : typeof (s as { startTime?: unknown })?.startTime === "string" ? (s as { startTime: string }).startTime : null;
      if (iso && !Number.isNaN(new Date(iso).getTime())) out.push({ startsAt: new Date(iso).toISOString() });
    }
  }
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

async function ghlFreeSlots(input: { calendarId: string; locationId: string | null; timeZone: string }): Promise<FreeSlot[] | null> {
  const token = ghlTokenFor(input.locationId);
  if (!token) return null;
  const start = Date.now();
  const end = start + LOOKAHEAD_DAYS * 86400000;
  const qs = new URLSearchParams({ startDate: String(start), endDate: String(end), timezone: input.timeZone });
  try {
    const res = await fetch(`${GHL_BASE}/calendars/${encodeURIComponent(input.calendarId)}/free-slots?${qs}`, {
      headers: { Authorization: `Bearer ${token}`, Version: "2021-04-15", Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("ghl free-slots:", res.status);
      return null;
    }
    return parseGhlFreeSlots(await res.json());
  } catch (err) {
    console.error("ghl free-slots:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function loadCoachFreeSlots(coachId: string): Promise<CoachSlots | null> {
  const { data: coach } = await supabaseAdmin
    .from("coaches")
    .select("slug, booking_calendar_provider, ghl_calendar_id, crm_location_id")
    .eq("id", coachId)
    .maybeSingle();
  if (!coach) return null;
  const provider = getCoachBookingProvider({ booking_calendar_provider: coach.booking_calendar_provider as string | null });
  const timeZone = await loadCoachTimezone(coachId);
  const bookingUrl = coach.slug ? `${appBase()}/book/${coach.slug}` : null;

  if (provider === "native") {
    const calendar = await loadCoachCalendarBySlug(coachId, ASSESSMENT_BOOKING_CALENDAR_SLUG);
    if (!calendar) return { provider, timeZone, slots: [], bookingUrl };
    try {
      const loaded = await loadCalendarSlotDays({ calendar, displayTimezone: timeZone });
      const slots = loaded.days.flatMap((d) => d.slots.map((s) => ({ startsAt: s.starts_at })));
      return { provider, timeZone: loaded.coachTimezone || timeZone, slots, bookingUrl };
    } catch (err) {
      console.error("native slots:", err instanceof Error ? err.message : err);
      return null;
    }
  }

  const calendarId = (coach.ghl_calendar_id as string | null)?.trim();
  if (!calendarId) return { provider, timeZone, slots: [], bookingUrl };
  const slots = await ghlFreeSlots({ calendarId, locationId: (coach.crm_location_id as string | null) ?? null, timeZone });
  if (slots === null) return { provider, timeZone, slots: [], bookingUrl };
  return { provider, timeZone, slots, bookingUrl };
}
