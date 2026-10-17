import {
  findOrCreateProspectContact,
  loadBookingSettingsForCoach,
  loadCoachBySlug,
  loadCoachCalendarBySlug,
} from "@/lib/booking/bookingService";
import { createCalendarBooking } from "@/lib/booking/createCalendarBooking";
import { clampBookingDurationMinutes } from "@/lib/booking/directBookingSlot";
import { loadCalendarSlotDays } from "@/lib/booking/loadCalendarSlotDays";
import { addSectionComment } from "@/lib/practiceKnowledge/sectionComments";
import {
  isSupportCallHostSlug,
  SUPPORT_CALL_CALENDAR_SLUG,
  supportCallHostDisplayName,
} from "@/lib/support/supportCallHosts";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { AgentToolDef } from "../types";
import { AgentToolError, coachOf, str } from "./util";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hostFor(input: { host?: unknown }, mode: "admin" | "coach"): string {
  const raw = typeof input.host === "string" ? input.host.trim().toLowerCase() : "zander";
  const host = raw || "zander";
  if (!isSupportCallHostSlug(host)) {
    throw new AgentToolError("Host must be zander (or pam, admin only).");
  }
  if (mode === "coach" && host !== "zander") {
    throw new AgentToolError("Coaches can book Zander. Pam is booked by BCA.");
  }
  return host;
}

async function guestEmail(coachId: string): Promise<{
  email: string;
  firstName: string;
  lastName: string;
}> {
  const [{ data: profile }, { data: userData }] = await Promise.all([
    supabaseAdmin.from("profiles").select("full_name, first_name, last_name").eq("id", coachId).maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(coachId),
  ]);
  const email = userData.user?.email?.trim().toLowerCase() ?? "";
  if (!EMAIL_RE.test(email)) {
    throw new AgentToolError("This coach has no email, so the invite cannot be sent.");
  }
  const firstName =
    (profile?.first_name as string | null)?.trim() ||
    (profile?.full_name as string | null)?.trim().split(/\s+/)[0] ||
    "Coach";
  const lastName =
    (profile?.last_name as string | null)?.trim() ||
    (profile?.full_name as string | null)?.trim().split(/\s+/).slice(1).join(" ") ||
    firstName;
  return { email, firstName, lastName };
}

export const escalateTools: AgentToolDef[] = [
  {
    name: "list_support_slots",
    label: "Looking at support times",
    needsCoach: true,
    description:
      "Open times on a BCA support calendar. Default host is Zander. Use before booking. Extreme cases only.",
    input_schema: {
      type: "object",
      properties: {
        host: { type: "string", enum: ["zander", "pam"], description: "Who they would speak to. Default zander." },
      },
    },
    run: async (input, ctx) => {
      const host = hostFor(input, ctx.mode);
      const hostCoach = await loadCoachBySlug(host);
      if (!hostCoach) throw new AgentToolError(`${supportCallHostDisplayName(host)} is not set up.`);
      const calendar = await loadCoachCalendarBySlug(hostCoach.id, SUPPORT_CALL_CALENDAR_SLUG);
      if (!calendar) throw new AgentToolError("The support calendar is not set up.");
      const { settings } = await loadBookingSettingsForCoach(hostCoach.id);
      const days = await loadCalendarSlotDays({
        calendar,
        displayTimezone: settings.timezone,
      });
      const slots = days.days.flatMap((day) =>
        day.slots.map((slot) => ({
          starts_at: slot.starts_at,
          label: `${day.label} ${slot.label}`,
        }))
      );
      return {
        host,
        host_name: supportCallHostDisplayName(host),
        timezone: days.displayTimezone,
        duration_minutes: days.durationMinutes,
        slots: slots.slice(0, 12),
      };
    },
  },
  {
    name: "book_support_call",
    label: "Booking a support call",
    needsCoach: true,
    description:
      "Book a support call for the active coach with Zander (or Pam, admin only). Always asks for confirmation. Extreme cases only: they asked for a human, they are stuck after two tries, or they want to leave.",
    input_schema: {
      type: "object",
      properties: {
        starts_at: { type: "string", description: "ISO start time from list_support_slots" },
        host: { type: "string", enum: ["zander", "pam"] },
        reason: { type: "string", description: "Why this needs a person, in one sentence" },
      },
      required: ["starts_at"],
    },
    gate: async (input, ctx) => {
      const host = hostFor(input, ctx.mode);
      const startsAt = str(input, "starts_at");
      if (!startsAt || Number.isNaN(Date.parse(startsAt))) {
        return { error: "Pick a start time from list_support_slots." };
      }
      const coach = coachOf(ctx);
      return {
        confirm: true,
        title: `Book a support call with ${supportCallHostDisplayName(host)}`,
        details: [
          { label: "For", value: coach.name },
          { label: "With", value: supportCallHostDisplayName(host) },
          { label: "When", value: new Date(startsAt).toISOString() },
          ...(str(input, "reason") ? [{ label: "Why", value: str(input, "reason") }] : []),
        ],
        warning: "This puts a real time on the calendar and emails them both.",
      };
    },
    run: async (input, ctx) => {
      const host = hostFor(input, ctx.mode);
      const startsAt = str(input, "starts_at");
      const coach = coachOf(ctx);
      const hostCoach = await loadCoachBySlug(host);
      if (!hostCoach) throw new AgentToolError(`${supportCallHostDisplayName(host)} is not set up.`);
      const calendar = await loadCoachCalendarBySlug(hostCoach.id, SUPPORT_CALL_CALENDAR_SLUG);
      if (!calendar) throw new AgentToolError("The support calendar is not set up.");
      const guest = await guestEmail(coach.id);
      const { settings } = await loadBookingSettingsForCoach(hostCoach.id);
      const durationMinutes = clampBookingDurationMinutes(null, calendar.meeting_duration_minutes);
      const contactId = await findOrCreateProspectContact({
        coachId: hostCoach.id,
        email: guest.email,
        firstName: guest.firstName,
        lastName: guest.lastName,
      });
      const result = await createCalendarBooking({
        coach: { id: hostCoach.id, displayName: hostCoach.displayName },
        calendar,
        contactId,
        guest: {
          firstName: guest.firstName,
          lastName: guest.lastName,
          email: guest.email,
          phone: null,
        },
        startsAt,
        prospectTimezone: settings.timezone,
        durationMinutes,
      });
      if (!result.ok) throw new AgentToolError(result.error);
      const when = `${result.data.display.date}, ${result.data.display.time_range} (${result.data.display.timezone})`;
      const reason = str(input, "reason");
      await addSectionComment({
        coachId: coach.id,
        sectionKey: "story:bio",
        authorId: null,
        side: "ava",
        body: `Booked a support call with ${supportCallHostDisplayName(host)} for ${when}.${reason ? ` ${reason}` : ""}`,
      }).catch(() => undefined);
      return {
        booked: true,
        host,
        when,
        _note: `Booked with ${supportCallHostDisplayName(host)} for ${when}`,
      };
    },
  },
];
