import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const { searchParams } = new URL(request.url);
  const testId = searchParams.get("test_id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const coachSlug = searchParams.get("coach_slug")?.trim() || null;

  if (!testId) {
    return NextResponse.json({ error: "test_id required" }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("landing_events")
    .select("id, variant, coach_slug, event_type, session_id, created_at")
    .eq("test_id", testId);

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

  const list = (events ?? []) as Array<{
    variant: string;
    coach_slug: string | null;
    event_type: string;
    session_id: string | null;
  }>;

  const totalViews = list.filter((e) => e.event_type === "view").length;
  const uniqueSessions = new Set(
    list.filter((e) => e.event_type === "view" && e.session_id).map((e) => e.session_id)
  );
  const started = list.filter((e) => e.event_type === "start").length;
  const optIns = list.filter((e) => e.event_type === "opt_in").length;
  const finished = list.filter((e) => e.event_type === "finish").length;

  const byVariant = { a: { views: 0, uniqueViews: 0, started: 0, opt_in: 0, finish: 0 }, b: { views: 0, uniqueViews: 0, started: 0, opt_in: 0, finish: 0 } };
  const sessionByVariant = { a: new Set<string>(), b: new Set<string>() };
  for (const e of list) {
    if (e.variant !== "a" && e.variant !== "b") continue;
    const v = e.variant;
    if (e.event_type === "view") {
      byVariant[v].views += 1;
      if (e.session_id) sessionByVariant[v].add(e.session_id);
    } else if (e.event_type === "start") byVariant[v].started += 1;
    else if (e.event_type === "opt_in") byVariant[v].opt_in += 1;
    else if (e.event_type === "finish") byVariant[v].finish += 1;
  }
  byVariant.a.uniqueViews = sessionByVariant.a.size;
  byVariant.b.uniqueViews = sessionByVariant.b.size;

  const coachSlugs = Array.from(new Set(list.map((e) => e.coach_slug).filter(Boolean))) as string[];
  const byCoach: Record<string, { views: number; uniqueViews: number; started: number; opt_in: number; finish: number }> = {};
  for (const slug of coachSlugs) {
    const coachEvents = list.filter((e) => e.coach_slug === slug);
    const sessions = new Set(coachEvents.filter((e) => e.event_type === "view" && e.session_id).map((e) => e.session_id));
    byCoach[slug] = {
      views: coachEvents.filter((e) => e.event_type === "view").length,
      uniqueViews: sessions.size,
      started: coachEvents.filter((e) => e.event_type === "start").length,
      opt_in: coachEvents.filter((e) => e.event_type === "opt_in").length,
      finish: coachEvents.filter((e) => e.event_type === "finish").length,
    };
  }

  return NextResponse.json({
    totals: { totalViews, uniqueViews: uniqueSessions.size, started, optIns, finished },
    byVariant,
    byCoach,
  });
}
