import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  computeLandingAnalytics,
  type LandingCoachLabel,
  type LandingEventRow,
} from "@/lib/landingAnalytics";

export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const { searchParams } = new URL(request.url);
  const testId = searchParams.get("test_id")?.trim() || null;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const coachSlug = searchParams.get("coach_slug")?.trim() || null;

  let query = supabaseAdmin
    .from("landing_events")
    .select("id, variant, coach_slug, event_type, session_id, created_at");

  if (testId) {
    query = query.eq("test_id", testId);
  }
  if (from) {
    query = query.gte("created_at", from);
  }
  if (to) {
    query = query.lte("created_at", to);
  }
  if (coachSlug) {
    query = query.eq("coach_slug", coachSlug);
  }

  const { data: events, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = (events ?? []) as LandingEventRow[];
  const analytics = computeLandingAnalytics(list);

  const coachSlugs = Array.from(
    new Set(
      list
        .map((e) => e.coach_slug?.trim())
        .filter((slug): slug is string => Boolean(slug))
    )
  );

  const coachLabels: Record<string, LandingCoachLabel> = {};
  if (coachSlugs.length > 0) {
    const { data: coaches } = await supabaseAdmin
      .from("coaches")
      .select("slug, profiles(full_name, coach_business_name)")
      .in("slug", coachSlugs);

    for (const row of coaches ?? []) {
      const slug = typeof row.slug === "string" ? row.slug : null;
      if (!slug) continue;
      const profiles = row.profiles as
        | { full_name?: string | null; coach_business_name?: string | null }
        | { full_name?: string | null; coach_business_name?: string | null }[]
        | null;
      const profile = Array.isArray(profiles) ? profiles[0] : profiles;
      coachLabels[slug] = {
        slug,
        full_name: profile?.full_name ?? null,
        coach_business_name: profile?.coach_business_name ?? null,
      };
    }
  }

  return NextResponse.json({
    ...analytics,
    coachLabels,
  });
}
