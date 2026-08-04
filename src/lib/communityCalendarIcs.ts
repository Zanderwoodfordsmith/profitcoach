import { DateTime } from "luxon";

import type { CommunityCalendarOccurrence } from "@/lib/communityCalendarTypes";
import { communityCalendarOccurrenceStartMs } from "@/lib/communityCalendarTypes";

const ICS_PROD_ID = "-//Profit Coach//Community Calendar//EN";
export const COMMUNITY_CALENDAR_ICS_NAME = "Profit Coach Calls";
const ICS_CAL_DESC =
  "Live Profit Coach community calls (Win The Week, Profit Coach Training, Monthly Momentum, and more).";

function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let remaining = line;
  parts.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    parts.push(` ${remaining.slice(0, 74)}`);
    remaining = remaining.slice(74);
  }
  return parts.join("\r\n");
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function formatIcsUtc(iso: string): string | null {
  const dt = DateTime.fromISO(iso, { zone: "utc" });
  if (!dt.isValid) return null;
  return dt.toFormat("yyyyMMdd'T'HHmmss'Z'");
}

function occurrenceUid(occurrence: CommunityCalendarOccurrence): string {
  const seriesStart =
    occurrence.seriesOccurrenceStartIso ?? occurrence.startsAtIso;
  const ms = communityCalendarOccurrenceStartMs(seriesStart);
  return `${occurrence.eventId}-${ms}@profitcoach.app`;
}

function occurrenceDescription(occurrence: CommunityCalendarOccurrence): string {
  const parts: string[] = [];
  const desc = occurrence.description?.trim();
  if (desc) parts.push(desc);
  const joinUrl = occurrence.location_url?.trim();
  if (joinUrl) {
    parts.push(parts.length ? `\nJoin: ${joinUrl}` : `Join: ${joinUrl}`);
  }
  return parts.join("\n").trim();
}

export function buildCommunityCalendarIcs(
  occurrences: CommunityCalendarOccurrence[],
  options?: { calendarName?: string; calendarDescription?: string }
): string {
  const calendarName =
    options?.calendarName?.trim() || COMMUNITY_CALENDAR_ICS_NAME;
  const calendarDescription =
    options?.calendarDescription?.trim() || ICS_CAL_DESC;
  const nowStamp = DateTime.utc().toFormat("yyyyMMdd'T'HHmmss'Z'");
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${ICS_PROD_ID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    // NAME (RFC 7986) + X-WR-CALNAME — Google/Outlook/Apple use these for the
    // calendar title. Without them, clients fall back to the URL host
    // (e.g. "Web Local 3000" for localhost:3000).
    `NAME:${escapeIcsText(calendarName)}`,
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    `X-WR-CALDESC:${escapeIcsText(calendarDescription)}`,
    "X-WR-TIMEZONE:UTC",
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];

  for (const occurrence of occurrences) {
    if (occurrence.isCancelled) continue;

    const dtStart = formatIcsUtc(occurrence.startsAtIso);
    const dtEnd = formatIcsUtc(occurrence.endsAtIso);
    if (!dtStart || !dtEnd) continue;

    const summary = escapeIcsText(occurrence.title.trim() || "Community call");
    const description = escapeIcsText(occurrenceDescription(occurrence));
    const location = escapeIcsText(occurrence.location_url?.trim() || "");
    const url = occurrence.location_url?.trim() || "";

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${occurrenceUid(occurrence)}`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${summary}`);
    if (description) lines.push(`DESCRIPTION:${description}`);
    if (location) lines.push(`LOCATION:${location}`);
    if (url) lines.push(`URL:${url}`);
    lines.push("STATUS:CONFIRMED");
    lines.push("TRANSP:OPAQUE");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

export function httpsFeedToWebcal(httpsUrl: string): string {
  return httpsUrl.replace(/^https:/i, "webcal:").replace(/^http:/i, "webcal:");
}

/** True when calendar clients outside this machine cannot fetch the feed. */
export function isLocalCalendarFeedUrl(url: string): boolean {
  try {
    const host = new URL(url.replace(/^webcal:/i, "https:")).hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local")
    );
  } catch {
    return false;
  }
}

/**
 * Google's `cid=` subscribe flow. Prefer HTTPS — webcal:// often becomes the
 * calendar *name* (e.g. "Web Local 3000") when Google cannot read X-WR-CALNAME.
 */
export function googleCalendarSubscribeUrl(httpsUrl: string): string {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(httpsUrl)}`;
}

export function outlookCalendarSubscribeUrl(httpsUrl: string): string {
  return `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(httpsUrl)}`;
}

export function communityCalendarIcsFileName(
  calendarName: string = COMMUNITY_CALENDAR_ICS_NAME
): string {
  const safe = calendarName.replace(/[^\w\s-]+/g, "").trim() || "Profit Coach Calls";
  return `${safe}.ics`;
}
