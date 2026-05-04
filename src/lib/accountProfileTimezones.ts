import { COMMUNITY_CALENDAR_TIMEZONES } from "@/lib/communityCalendarTimezones";

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
