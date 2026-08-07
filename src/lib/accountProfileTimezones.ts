import { isValidIanaTimeZone } from "@/lib/booking/bookingTime";
import { COMMUNITY_CALENDAR_TIMEZONES } from "@/lib/communityCalendarTimezones";

/** Product default when IP / location cannot infer a zone. */
export const DEFAULT_ACCOUNT_TIMEZONE = "Europe/London";

/** Curated IANA zones for account settings (same core set + a few extras). */
export const ACCOUNT_SETTING_TIMEZONES: readonly string[] = [
  ...COMMUNITY_CALENDAR_TIMEZONES.filter((z) => z !== "UTC"),
  "America/Phoenix",
  "America/Toronto",
  "America/Vancouver",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Pacific/Chatham",
  "UTC",
];

export function accountTimezoneOptionLabel(iana: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: iana,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const off = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return off ? `${off} ${iana}` : iana;
  } catch {
    return iana;
  }
}

/** Vercel edge header from the request IP (production only). */
export function timezoneFromRequestIp(request: Request): string | null {
  const raw = request.headers.get("x-vercel-ip-timezone")?.trim() ?? "";
  if (!raw || !isValidIanaTimeZone(raw)) return null;
  return raw;
}

/**
 * Cheap location → IANA hint for common UK copy.
 * Used when IP is unavailable (e.g. local) or when viewing another coach.
 */
export function timezoneHintFromLocation(
  location: string | null | undefined
): string | null {
  const s = (location ?? "").trim().toLowerCase();
  if (!s) return null;
  if (
    /\b(uk|u\.k\.|united kingdom|great britain|england|wales|scotland|northern ireland|cymru|britain)\b/.test(
      s
    ) ||
    /\b(london|manchester|birmingham|leeds|glasgow|edinburgh|cardiff|belfast|bristol)\b/.test(
      s
    )
  ) {
    return "Europe/London";
  }
  return null;
}

/**
 * Pick a timezone to persist when `profiles.timezone` is empty.
 * Prefer request IP (only when `allowIpInfer`), then location text, then UK.
 */
export function resolveAccountTimezoneToPersist(opts: {
  request: Request;
  location?: string | null;
  allowIpInfer: boolean;
}): string {
  if (opts.allowIpInfer) {
    const fromIp = timezoneFromRequestIp(opts.request);
    if (fromIp) return fromIp;
  }
  return (
    timezoneHintFromLocation(opts.location) ?? DEFAULT_ACCOUNT_TIMEZONE
  );
}
