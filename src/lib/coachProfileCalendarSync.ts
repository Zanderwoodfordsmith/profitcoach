import type { CalendarSyncStatus } from "@/lib/ghlCalendarSync";
import {
  getCalendarSyncStatus,
  hasCalendarEmbed,
  isCalendarSyncReady,
} from "@/lib/ghlCalendarSync";

type CoachCalendarRow = {
  crm_location_id?: string | null;
  calendar_embed_code?: string | null;
  ghl_calendar_id?: string | null;
};

export function buildCoachCalendarSyncFields(coachRow: CoachCalendarRow | null) {
  const crmLocationId = coachRow?.crm_location_id ?? null;
  const calendarEmbedCode = coachRow?.calendar_embed_code ?? null;
  const ghlCalendarId = coachRow?.ghl_calendar_id ?? null;
  const crmLocationConfigured = Boolean(crmLocationId?.trim());

  return {
    calendar_sync_ready: isCalendarSyncReady({
      crmLocationId,
      calendarEmbedCode,
      ghlCalendarId,
    }),
    crm_location_configured: crmLocationConfigured,
    has_calendar_embed: hasCalendarEmbed(calendarEmbedCode, ghlCalendarId),
    calendar_sync_status: getCalendarSyncStatus({
      crmLocationId,
      calendarEmbedCode,
      ghlCalendarId,
      audience: "coach",
    }),
  };
}
