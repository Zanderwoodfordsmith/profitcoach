import { NextResponse } from "next/server";
import {
  ensureDefaultCoachCalendars,
  loadCoachCalendarBySlug,
} from "@/lib/booking/bookingService";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  SUPPORT_CALL_CALENDAR_SLUG,
  SUPPORT_CALL_HOSTS,
} from "@/lib/support/supportCallHosts";

/** Public list of support-call hosts that are bookable right now. */
export async function GET() {
  const hosts = [];

  for (const host of SUPPORT_CALL_HOSTS) {
    const { data: coach } = await supabaseAdmin
      .from("coaches")
      .select("id, slug")
      .eq("slug", host.slug)
      .maybeSingle();

    if (!coach?.id) {
      hosts.push({
        slug: host.slug,
        display_name: host.displayName,
        enabled: false,
      });
      continue;
    }

    await ensureDefaultCoachCalendars(coach.id as string);
    const calendar = await loadCoachCalendarBySlug(
      coach.id as string,
      SUPPORT_CALL_CALENDAR_SLUG
    );

    hosts.push({
      slug: host.slug,
      display_name: host.displayName,
      enabled: Boolean(calendar?.is_enabled && calendar?.is_public),
    });
  }

  return NextResponse.json({ hosts });
}
