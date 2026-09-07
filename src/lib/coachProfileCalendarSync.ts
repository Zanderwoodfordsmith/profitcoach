import type { CalendarSyncStatus } from "@/lib/ghlCalendarSync";
import {
  getCalendarSyncStatus,
  hasCalendarEmbed,
  isCalendarSyncReady,
} from "@/lib/ghlCalendarSync";
import {
  getCoachBookingProvider,
  type BookingCalendarProvider,
} from "@/lib/booking/coachBookingProvider";

type CoachCalendarRow = {
  booking_calendar_provider?: string | null;
  crm_location_id?: string | null;
  calendar_embed_code?: string | null;
  ghl_calendar_id?: string | null;
  lead_webhook_url?: string | null;
};

function nativeCalendarSyncStatus(audience: "admin" | "coach"): CalendarSyncStatus {
  return {
    ready: true,
    hasCrmLocation: true,
    hasCalendarEmbed: true,
    hasLeadWebhook: true,
    tone: "success",
    message:
      audience === "coach"
        ? "Using Profit Coach calendars — manage availability under Settings → Calendar."
        : "Using Profit Coach calendars (native discovery).",
  };
}

export function buildCoachCalendarSyncFields(
  coachRow: CoachCalendarRow | null,
  opts?: {
    audience?: "admin" | "coach";
    /** When provider is native, whether discovery is enabled+public. */
    nativeDiscoveryReady?: boolean;
  }
) {
  const audience = opts?.audience ?? "coach";
  const provider: BookingCalendarProvider = getCoachBookingProvider({
    booking_calendar_provider: coachRow?.booking_calendar_provider,
  });

  if (provider === "native") {
    const ready = opts?.nativeDiscoveryReady !== false;
    const status = ready
      ? nativeCalendarSyncStatus(audience)
      : {
          ready: false,
          hasCrmLocation: true,
          hasCalendarEmbed: false,
          hasLeadWebhook: true,
          tone: "warning" as const,
          message:
            audience === "coach"
              ? "Turn on your Discovery calendar under Settings → Calendar."
              : "Native discovery calendar is not enabled/public yet.",
        };

    return {
      booking_calendar_provider: provider,
      calendar_sync_ready: status.ready,
      crm_location_configured: Boolean(coachRow?.crm_location_id?.trim()),
      has_calendar_embed: false,
      calendar_sync_status: status,
    };
  }

  const crmLocationId = coachRow?.crm_location_id ?? null;
  const calendarEmbedCode = coachRow?.calendar_embed_code ?? null;
  const ghlCalendarId = coachRow?.ghl_calendar_id ?? null;
  const leadWebhookUrl = coachRow?.lead_webhook_url ?? null;
  const crmLocationConfigured = Boolean(crmLocationId?.trim());

  return {
    booking_calendar_provider: provider,
    calendar_sync_ready: isCalendarSyncReady({
      crmLocationId,
      calendarEmbedCode,
      ghlCalendarId,
      leadWebhookUrl,
    }),
    crm_location_configured: crmLocationConfigured,
    has_calendar_embed: hasCalendarEmbed(calendarEmbedCode, ghlCalendarId),
    calendar_sync_status: getCalendarSyncStatus({
      crmLocationId,
      calendarEmbedCode,
      ghlCalendarId,
      leadWebhookUrl,
      audience,
    }),
  };
}
