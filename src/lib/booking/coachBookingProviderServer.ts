import {
  PRIMARY_COACH_CALENDAR_EMBED_CODE,
  PRIMARY_COACH_SLUG_FALLBACK,
} from "@/lib/primaryCoach";
import { ensureNativeDiscoveryReady } from "@/lib/booking/bookingService";
import {
  ASSESSMENT_BOOKING_CALENDAR_SLUG,
  getCoachBookingProvider,
  type PublicBookingSurface,
} from "@/lib/booking/coachBookingProvider";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Resolve what a public booking surface should render for a coach slug.
 * Ensures discovery is enabled when provider is native.
 */
export async function resolvePublicBookingSurface(input: {
  slug: string;
}): Promise<PublicBookingSurface | null> {
  const cleanSlug = input.slug?.trim();
  if (!cleanSlug) return null;

  const { data, error } = await supabaseAdmin
    .from("coaches")
    .select("id, slug, calendar_embed_code, booking_calendar_provider")
    .eq("slug", cleanSlug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Could not load calendar.");
  }

  const isPrimaryCoach =
    cleanSlug.toLowerCase() === PRIMARY_COACH_SLUG_FALLBACK.toLowerCase();

  if (!data) {
    if (!isPrimaryCoach) return null;
    return {
      provider: "ghl",
      calendar_embed_code: PRIMARY_COACH_CALENDAR_EMBED_CODE,
      coach_slug: cleanSlug,
      calendar_slug: null,
    };
  }

  const coachId = data.id as string;
  const coachSlug = ((data.slug as string | null) ?? cleanSlug).trim();
  const provider = getCoachBookingProvider({
    booking_calendar_provider: (data as { booking_calendar_provider?: string | null })
      .booking_calendar_provider,
  });

  if (provider === "native") {
    await ensureNativeDiscoveryReady(coachId);
    return {
      provider: "native",
      calendar_embed_code: null,
      coach_slug: coachSlug,
      calendar_slug: ASSESSMENT_BOOKING_CALENDAR_SLUG,
    };
  }

  const storedEmbed =
    (data as { calendar_embed_code?: string | null }).calendar_embed_code ?? null;

  return {
    provider: "ghl",
    calendar_embed_code:
      storedEmbed ?? (isPrimaryCoach ? PRIMARY_COACH_CALENDAR_EMBED_CODE : null),
    coach_slug: coachSlug,
    calendar_slug: null,
  };
}

/** Whether the coach's native discovery calendar is enabled + public. */
export async function isNativeDiscoveryReady(coachId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("coach_calendars")
    .select("is_enabled, is_public")
    .eq("coach_id", coachId)
    .eq("slug", ASSESSMENT_BOOKING_CALENDAR_SLUG)
    .maybeSingle();

  if (!data) return false;
  return Boolean(data.is_enabled) && Boolean(data.is_public);
}

export async function nativeDiscoveryReadyByCoachIds(
  coachIds: string[]
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (coachIds.length === 0) return map;

  const { data } = await supabaseAdmin
    .from("coach_calendars")
    .select("coach_id, is_enabled, is_public")
    .in("coach_id", coachIds)
    .eq("slug", ASSESSMENT_BOOKING_CALENDAR_SLUG);

  for (const row of data ?? []) {
    const id = row.coach_id as string;
    map.set(id, Boolean(row.is_enabled) && Boolean(row.is_public));
  }
  return map;
}
