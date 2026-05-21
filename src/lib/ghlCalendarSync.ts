import { extractGhlCalendarIdFromEmbed } from "@/lib/extractGhlCalendarIdFromEmbed";

const CRM_LOCATION_PATH_RE = /\/v2\/location\/([A-Za-z0-9_-]+)/i;
const CRM_LOCATION_ID_RE = /^[A-Za-z0-9_-]{10,64}$/;

export type CalendarSyncStatusTone = "success" | "warning" | "neutral";

export type CalendarSyncStatus = {
  ready: boolean;
  hasCrmLocation: boolean;
  hasCalendarEmbed: boolean;
  tone: CalendarSyncStatusTone;
  message: string;
};

export function normalizeCrmLocationId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(CRM_LOCATION_PATH_RE);
  if (urlMatch?.[1]) return urlMatch[1];

  if (CRM_LOCATION_ID_RE.test(trimmed)) return trimmed;
  return null;
}

export function validateCrmLocationId(
  raw: string
): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };

  const normalized = normalizeCrmLocationId(trimmed);
  if (!normalized) {
    return {
      ok: false,
      error:
        "CRM location ID must be the ID only (e.g. BsRxKtV0lVHcvvZ6qHtu) or a Pro Coach Platform location URL.",
    };
  }

  return { ok: true, value: normalized };
}

export function hasCalendarEmbed(
  calendarEmbedCode: string | null | undefined,
  ghlCalendarId?: string | null,
  calendarEmbedConfigured?: boolean
): boolean {
  if (calendarEmbedConfigured) return true;
  if (ghlCalendarId?.trim()) return true;
  return Boolean(extractGhlCalendarIdFromEmbed(calendarEmbedCode));
}

export function isCalendarSyncReady(input: {
  crmLocationId?: string | null;
  crmLocationConfigured?: boolean;
  calendarEmbedCode?: string | null;
  ghlCalendarId?: string | null;
  calendarEmbedConfigured?: boolean;
}): boolean {
  const hasCrmLocation =
    Boolean(normalizeCrmLocationId(input.crmLocationId ?? "")) ||
    !!input.crmLocationConfigured;
  return (
    hasCrmLocation &&
    hasCalendarEmbed(
      input.calendarEmbedCode,
      input.ghlCalendarId,
      input.calendarEmbedConfigured
    )
  );
}

export function getCalendarSyncStatus(input: {
  crmLocationId?: string | null;
  crmLocationConfigured?: boolean;
  calendarEmbedCode?: string | null;
  ghlCalendarId?: string | null;
  calendarEmbedConfigured?: boolean;
  /** Coach-facing copy omits admin-only steps. */
  audience?: "admin" | "coach";
}): CalendarSyncStatus {
  const audience = input.audience ?? "admin";
  const hasCrmLocation =
    Boolean(normalizeCrmLocationId(input.crmLocationId ?? "")) ||
    !!input.crmLocationConfigured;
  const hasCalendarEmbedFlag = hasCalendarEmbed(
    input.calendarEmbedCode,
    input.ghlCalendarId,
    input.calendarEmbedConfigured
  );
  const ready = hasCrmLocation && hasCalendarEmbedFlag;

  if (ready) {
    return {
      ready: true,
      hasCrmLocation,
      hasCalendarEmbed: hasCalendarEmbedFlag,
      tone: "success",
      message:
        audience === "coach"
          ? "Calendar linked — bookings sync to your prospect list."
          : "Calendar linked — bookings sync to the prospect list.",
    };
  }

  if (hasCrmLocation && !hasCalendarEmbedFlag) {
    return {
      ready: false,
      hasCrmLocation,
      hasCalendarEmbed: hasCalendarEmbedFlag,
      tone: "warning",
      message:
        audience === "coach"
          ? "CRM location is linked. Paste your calendar embed below to finish setup."
          : "CRM location set. Coach still needs to paste their calendar embed in settings.",
    };
  }

  if (!hasCrmLocation && hasCalendarEmbedFlag) {
    return {
      ready: false,
      hasCrmLocation,
      hasCalendarEmbed: hasCalendarEmbedFlag,
      tone: "warning",
      message:
        audience === "coach"
          ? "Calendar embed saved. Booking sync starts once admin links your CRM location."
          : "Calendar embed saved. Add CRM location ID here to enable booking sync.",
    };
  }

  return {
    ready: false,
    hasCrmLocation,
    hasCalendarEmbed: hasCalendarEmbedFlag,
    tone: "neutral",
    message:
      audience === "coach"
        ? "Paste your calendar embed to show booking on scorecard results."
        : "Add CRM location ID and ask the coach to paste their calendar embed.",
  };
}
