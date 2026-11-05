import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * When each coach really joined BCA, for Support → Channels "Newest": the
 * earliest of their first payment, their old community join date and their
 * membership start. Profiles were all created on import (4 May 2026), so
 * created_at is only the last resort, and the client falls back to it.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    const status = auth.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: auth.error ?? "Not authorized." }, { status });
  }

  const joined: Record<string, string> = {};
  const keepEarliest = (id: string | null, at: string | null) => {
    if (!id || !at) return;
    if (!joined[id] || at < joined[id]) joined[id] = at;
  };

  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("coach_payments")
      .select("coach_id, paid_at")
      .eq("status", "succeeded")
      .not("coach_id", "is", null)
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const row of data ?? []) keepEarliest(row.coach_id, row.paid_at);
    if (!data || data.length < pageSize) break;
  }

  const [{ data: profiles, error: profilesError }, { data: coaches, error: coachesError }] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, disco_community_joined_on")
        .not("disco_community_joined_on", "is", null)
        .limit(5000),
      supabaseAdmin
        .from("coaches")
        .select("id, membership_started_at")
        .not("membership_started_at", "is", null)
        .limit(5000),
    ]);
  if (profilesError || coachesError) {
    return NextResponse.json(
      { error: (profilesError ?? coachesError)?.message ?? "Could not load." },
      { status: 500 }
    );
  }
  for (const row of profiles ?? []) keepEarliest(row.id, row.disco_community_joined_on);
  for (const row of coaches ?? []) keepEarliest(row.id, row.membership_started_at);

  return NextResponse.json({ joined });
}
