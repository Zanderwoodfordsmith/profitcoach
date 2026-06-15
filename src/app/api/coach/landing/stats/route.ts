import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { countLandingStatActors } from "@/lib/landingActors";
import {
  computeLandingAnalytics,
  type LandingEventRow,
} from "@/lib/landingAnalytics";

export async function GET(request: Request) {
  const auth = await requireCoachRequest(request);
  if (auth.error || !auth.userId) {
    const status =
      auth.error === "Admin must pass x-impersonate-coach-id for this resource."
        ? 400
        : 401;
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status });
  }

  const coachId = auth.userId;

  const { data: coachRow, error: coachError } = await supabaseAdmin
    .from("coaches")
    .select("slug")
    .eq("id", coachId)
    .maybeSingle();

  if (coachError) {
    return NextResponse.json(
      { error: "Unable to load landing analytics." },
      { status: 500 }
    );
  }

  const coachSlug =
    ((coachRow as { slug?: string | null } | null)?.slug as string | null)?.trim() ??
    null;

  // Without a public slug there is no landing traffic to attribute to this coach.
  if (!coachSlug) {
    const empty = computeLandingAnalytics([]);
    return NextResponse.json({ ...empty, coachSlug: null });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Force the slug filter server-side so a coach can only ever read their own numbers.
  let query = supabaseAdmin
    .from("landing_events")
    .select("variant, coach_slug, event_type, session_id")
    .eq("coach_slug", coachSlug);

  if (from) {
    query = query.gte("created_at", from);
  }
  if (to) {
    query = query.lte("created_at", to);
  }

  const { data: events, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Unable to load landing analytics." },
      { status: 500 }
    );
  }

  const analytics = computeLandingAnalytics((events ?? []) as LandingEventRow[]);

  const [optIns, started, finished] = await Promise.all([
    countLandingStatActors(coachSlug, coachId, "opt_in", from, to),
    countLandingStatActors(coachSlug, coachId, "start", from, to),
    countLandingStatActors(coachSlug, coachId, "finish", from, to),
  ]);

  return NextResponse.json({
    ...analytics,
    totals: {
      ...analytics.totals,
      optIns,
      started,
      finished,
    },
    coachSlug,
  });
}
