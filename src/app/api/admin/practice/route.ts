import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import { loadDecisionCallBookedAt } from "@/lib/practiceKnowledge/decisionCallBooked";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    const status = auth.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: auth.error }, { status });
  }

  try {
    const { data: rows, error } = await supabaseAdmin
      .from("coach_practice_knowledge")
      .select(
        "coach_id, status, completeness_score, missing_fields, form_completed_at, interview_completed_at, coach_reviewed_at, admin_reviewed_at, report_generated_at, updated_at, payload"
      )
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.coach_id as string);
    const profiles = ids.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, full_name, first_name, last_name, slug, avatar_url, coach_business_name")
          .in("id", ids)
      : { data: [] as Record<string, unknown>[] };

    const sessions = ids.length
      ? await supabaseAdmin
          .from("coach_intake_sessions")
          .select("coach_id, started_at, ended_at, status")
          .in("coach_id", ids)
          .order("started_at", { ascending: false })
      : { data: [] as Record<string, unknown>[] };

    const lastSession = new Map<string, Record<string, unknown>>();
    for (const s of sessions.data ?? []) {
      const id = String((s as { coach_id: string }).coach_id);
      if (!lastSession.has(id)) lastSession.set(id, s as Record<string, unknown>);
    }

    const byId = new Map(
      (profiles.data ?? []).map((p) => [String((p as { id: string }).id), p])
    );
    const bookedAt = await loadDecisionCallBookedAt(ids).catch(
      () => new Map<string, string>()
    );

    const items = (rows ?? []).map((row) => {
      const profile = byId.get(row.coach_id as string) as
        | {
            full_name?: string | null;
            first_name?: string | null;
            last_name?: string | null;
            slug?: string | null;
            avatar_url?: string | null;
            coach_business_name?: string | null;
          }
        | undefined;
      const session = lastSession.get(row.coach_id as string);
      const { payload, ...rest } = row as Record<string, unknown> & {
        payload?: { review?: { decision_call_booked_at?: { value?: string } } };
      };
      return {
        ...rest,
        full_name:
          profile?.full_name ||
          [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
          "Coach",
        slug: profile?.slug ?? row.coach_id,
        avatar_url: profile?.avatar_url ?? null,
        coach_business_name: profile?.coach_business_name ?? null,
        last_session_at: session?.started_at ?? null,
        last_session_status: session?.status ?? null,
        decision_call_booked_at:
          bookedAt.get(row.coach_id as string) ??
          payload?.review?.decision_call_booked_at?.value ??
          null,
      };
    });

    return NextResponse.json({ items });
  } catch (err) {
    console.error("admin practice list:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load practice queue." }, { status: 500 });
  }
}
