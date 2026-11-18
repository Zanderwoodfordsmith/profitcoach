import { DateTime } from "luxon";
import type { SupabaseClient } from "@supabase/supabase-js";

import { isRecurringCommunityCalendarEvent } from "@/lib/communityCalendarTypes";

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
/** "00:12:34 From  Pam Smith  to  Everyone:" or "00:12:34\t From Pam Smith : text". */
const SENDER_RE = /^\s*\d{1,2}:\d{2}:\d{2}\s+From\s+(.+?)(?:\s+to\s+.+?)?\s*:/i;

export type ZoomChatLink = { url: string; sender: string | null };

/** Every web link in a Zoom chat file, once each, with who posted it. Zoom's own links are left out. */
export function extractLinksFromZoomChat(chat: string): ZoomChatLink[] {
  const seen = new Set<string>();
  const out: ZoomChatLink[] = [];
  let sender: string | null = null;
  for (const line of chat.split(/\r?\n/)) {
    const from = line.match(SENDER_RE);
    if (from) sender = from[1].replace(/\s+/g, " ").trim() || null;
    for (const raw of line.match(URL_RE) ?? []) {
      const cleaned = raw.replace(/[.,;:!?]+$/, "");
      let url: string;
      try {
        const u = new URL(cleaned);
        if (/(^|\.)zoom\.us$/i.test(u.hostname)) continue;
        url = u.toString();
      } catch {
        continue;
      }
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({ url, sender });
    }
  }
  return out;
}

/**
 * Download the Zoom chat for a recording and add its links to the matched
 * calendar session. Best effort: a missing chat file or failed download is not an error.
 */
export async function importZoomChatLinksToCalendar(
  supabase: SupabaseClient,
  args: {
    chatDownloadUrl: string | null;
    downloadToken: string | null;
    eventId: string;
    occurrenceStartIso: string;
  }
): Promise<{ added: number; reason?: string }> {
  if (!args.chatDownloadUrl) return { added: 0, reason: "no_chat_file" };

  const url = new URL(args.chatDownloadUrl);
  if (args.downloadToken) url.searchParams.set("access_token", args.downloadToken);
  const res = await fetch(url.toString(), { redirect: "follow" });
  if (!res.ok) return { added: 0, reason: `chat_download_${res.status}` };
  const links = extractLinksFromZoomChat(await res.text());
  if (links.length === 0) return { added: 0, reason: "no_links" };

  const { data: event, error: eventError } = await supabase
    .from("community_calendar_events")
    .select("is_recurring, recurrence")
    .eq("id", args.eventId)
    .maybeSingle();
  if (eventError) throw eventError;
  if (!event) return { added: 0, reason: "event_missing" };

  const occurrenceStart = isRecurringCommunityCalendarEvent(event)
    ? DateTime.fromISO(args.occurrenceStartIso, { zone: "utc" }).toISO()
    : null;

  let added = 0;
  for (const link of links) {
    const { error } = await supabase.from("community_calendar_event_links").insert({
      event_id: args.eventId,
      occurrence_start: occurrenceStart,
      label: link.sender
        ? `Shared in the Zoom chat by ${link.sender}`.slice(0, 200)
        : "",
      url: link.url,
      source: "zoom_chat",
    });
    if (!error) added += 1;
    else if (error.code !== "23505") throw error; // already there is fine
  }
  return { added };
}
