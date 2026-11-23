import { listCoachCalendars } from "@/lib/booking/bookingService";
import { ASSESSMENT_BOOKING_CALENDAR_SLUG } from "@/lib/booking/coachBookingProvider";
import { getLeadMagnet, magnetShareCopyUrl } from "@/lib/leadMagnets/catalog";
import { coachBookPath } from "@/lib/shareLinks/bookUrl";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * The coach's three links, as Get Clients → Toolkit → Links shows them, so Ava
 * puts the real links in posts and newsletters instead of a gap.
 */
export async function coachLinkLines(coachId: string): Promise<string[]> {
  const [{ data: coach }, calendars, { data: custom }] = await Promise.all([
    supabaseAdmin.from("coaches").select("slug").eq("id", coachId).maybeSingle(),
    listCoachCalendars(coachId).catch(() => []),
    supabaseAdmin.from("coach_custom_links").select("title, url").eq("coach_id", coachId).order("sort_order", { ascending: true }),
  ]);
  const slug = ((coach?.slug as string | null) ?? "").trim();
  const url = (path: string) => (path ? magnetShareCopyUrl(path, "") : "");

  const live = calendars.filter((c) => c.is_enabled && c.is_public);
  const call = live.find((c) => c.slug === ASSESSMENT_BOOKING_CALENDAR_SLUG) ?? live[0];
  const booking = slug && call ? url(coachBookPath(slug, call.slug)) : "";
  const score = slug ? url(getLeadMagnet("boss-score")?.pathForSlug(slug) ?? "") : "";
  const newsletter = (custom ?? []).find((l) => /newsletter/i.test(`${l.title ?? ""} ${l.url ?? ""}`))?.url ?? "";

  return [
    `## Their links`,
    `Booking link (${call?.name ?? "Constraint Call"}): ${booking || "none yet. Write [calendar link] and tell them to tick Public book link in Get Clients → Calls → Settings."}`,
    `BOSS Score link: ${score || "none yet (no public URL set on the Links page)."}`,
    `Newsletter link: ${newsletter || "none saved under Your links on the Links page."}`,
  ];
}
