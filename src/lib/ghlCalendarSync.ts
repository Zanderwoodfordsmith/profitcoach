import { extractGhlCalendarIdFromEmbed } from "@/lib/extractGhlCalendarIdFromEmbed";

const CRM_LOCATION_PATH_RE = /\/v2\/location\/([A-Za-z0-9_-]+)/i;
const CRM_LOCATION_ID_RE = /^[A-Za-z0-9_-]{10,64}$/;

export type CalendarSyncStatusTone = "success" | "warning" | "neutral";

export type CalendarSyncStatus = {
  ready: boolean;
  hasCrmLocation: boolean;
  hasCalendarEmbed: boolean;
  hasLeadWebhook: boolean;
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

export function hasLeadWebhookUrl(
  leadWebhookUrl: string | null | undefined
): boolean {
  const trimmed = leadWebhookUrl?.trim();
  return Boolean(trimmed && /^https?:\/\//i.test(trimmed));
}

function formatMissingList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function missingCrmSetupLabels(input: {
  hasCrmLocation: boolean;
  hasCalendarEmbed: boolean;
  hasLeadWebhook: boolean;
}): string[] {
  const missing: string[] = [];
  if (!input.hasCrmLocation) missing.push("CRM location ID");
  if (!input.hasCalendarEmbed) missing.push("calendar embed");
  if (!input.hasLeadWebhook) missing.push("lead webhook URL");
  return missing;
}

export function isCalendarSyncReady(input: {
  crmLocationId?: string | null;
  crmLocationConfigured?: boolean;
  calendarEmbedCode?: string | null;
  ghlCalendarId?: string | null;
  calendarEmbedConfigured?: boolean;
  leadWebhookUrl?: string | null;
}): boolean {
  const hasCrmLocation =
    Boolean(normalizeCrmLocationId(input.crmLocationId ?? "")) ||
    !!input.crmLocationConfigured;
  const hasCalendarEmbedFlag = hasCalendarEmbed(
    input.calendarEmbedCode,
    input.ghlCalendarId,
    input.calendarEmbedConfigured
  );
  const hasLeadWebhook = hasLeadWebhookUrl(input.leadWebhookUrl);
  return hasCrmLocation && hasCalendarEmbedFlag && hasLeadWebhook;
}

export function getCalendarSyncStatus(input: {
  crmLocationId?: string | null;
  crmLocationConfigured?: boolean;
  calendarEmbedCode?: string | null;
  ghlCalendarId?: string | null;
  calendarEmbedConfigured?: boolean;
  leadWebhookUrl?: string | null;
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
  const hasLeadWebhook = hasLeadWebhookUrl(input.leadWebhookUrl);
  const ready = hasCrmLocation && hasCalendarEmbedFlag && hasLeadWebhook;
  const missing = missingCrmSetupLabels({
    hasCrmLocation,
    hasCalendarEmbed: hasCalendarEmbedFlag,
    hasLeadWebhook,
  });

  if (ready) {
    return {
      ready: true,
      hasCrmLocation,
      hasCalendarEmbed: hasCalendarEmbedFlag,
      hasLeadWebhook,
      tone: "success",
      message:
        audience === "coach"
          ? "CRM, calendar, and lead webhook connected — bookings and leads sync to your prospect list."
          : "CRM, calendar, and lead webhook connected — bookings and leads sync to the prospect list.",
    };
  }

  if (missing.length === 3) {
    return {
      ready: false,
      hasCrmLocation,
      hasCalendarEmbed: hasCalendarEmbedFlag,
      hasLeadWebhook,
      tone: "neutral",
      message:
        audience === "coach"
          ? "Add CRM location ID, calendar embed, and lead webhook URL to finish setup."
          : "Add CRM location ID, calendar embed, and lead webhook URL to finish setup.",
    };
  }

  return {
    ready: false,
    hasCrmLocation,
    hasCalendarEmbed: hasCalendarEmbedFlag,
    hasLeadWebhook,
    tone: "warning",
    message: `Still needed: ${formatMissingList(missing)}.`,
  };
}
