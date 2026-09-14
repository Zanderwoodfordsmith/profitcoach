import { NextResponse } from "next/server";
import {
  ensureDefaultCoachCalendars,
} from "@/lib/booking/bookingService";
import { requireShareCoach } from "@/lib/shareLinks/requireShareCoach";
import { parseSocialLinks } from "@/lib/shareLinks/socials";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const auth = await requireShareCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const [{ data: profile, error: profileError }, { data: coach }, calendars] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("linkedin_url, social_links")
        .eq("id", auth.coachId)
        .maybeSingle(),
      supabaseAdmin
        .from("coaches")
        .select("slug")
        .eq("id", auth.coachId)
        .maybeSingle(),
      ensureDefaultCoachCalendars(auth.coachId),
    ]);

  if (profileError && profileError.code !== "42703") {
    return NextResponse.json({ error: "Could not load profile." }, { status: 500 });
  }

  let linkedinUrl: string | null = null;
  let socialRaw: unknown = {};

  if (profileError?.code === "42703") {
    const fallback = await supabaseAdmin
      .from("profiles")
      .select("linkedin_url")
      .eq("id", auth.coachId)
      .maybeSingle();
    linkedinUrl = fallback.data?.linkedin_url ?? null;
  } else {
    linkedinUrl =
      ((profile as { linkedin_url?: string | null } | null)?.linkedin_url ?? null);
    socialRaw = (profile as { social_links?: unknown } | null)?.social_links;
  }

  const { data: customRows, error: customError } = await supabaseAdmin
    .from("coach_custom_links")
    .select("id, title, url, description, sort_order")
    .eq("coach_id", auth.coachId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (customError && customError.code !== "42P01" && customError.code !== "42703") {
    return NextResponse.json({ error: "Could not load custom links." }, { status: 500 });
  }

  return NextResponse.json({
    coach_slug: coach?.slug ?? null,
    linkedin_url: linkedinUrl,
    social_links: parseSocialLinks(socialRaw),
    custom_links: customRows ?? [],
    calendars: calendars.map((cal) => ({
      id: cal.id,
      slug: cal.slug,
      name: cal.name,
      description: cal.description,
      meeting_duration_minutes: cal.meeting_duration_minutes,
      is_enabled: cal.is_enabled,
      is_public: cal.is_public,
    })),
  });
}
