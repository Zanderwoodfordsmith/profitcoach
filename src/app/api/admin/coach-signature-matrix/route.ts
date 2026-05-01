import { NextResponse } from "next/server";
import { normalizeScores } from "@/lib/signatureModelV2";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

type CoachRow = {
  id: string;
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
};

export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  try {
    const { data: coachesData, error: coachesError } = await supabaseAdmin
      .from("coaches")
      .select("id, slug, profiles!inner(full_name, coach_business_name)")
      .order("slug", { ascending: true });

    if (coachesError) {
      return NextResponse.json(
        { error: "Unable to load coaches." },
        { status: 500 }
      );
    }

    const coaches: CoachRow[] =
      coachesData?.map((row: any) => ({
        id: row.id as string,
        slug: row.slug as string,
        full_name: row.profiles?.full_name ?? null,
        coach_business_name: row.profiles?.coach_business_name ?? null,
      })) ?? [];

    if (coaches.length === 0) {
      return NextResponse.json({ coaches: [] });
    }

    const coachIds = coaches.map((coach) => coach.id);
    const { data: scoreRows, error: scoresError } = await supabaseAdmin
      .from("coach_signature_scores")
      .select("user_id, scores, updated_at")
      .in("user_id", coachIds);

    if (scoresError) {
      return NextResponse.json(
        { error: "Unable to load signature scores." },
        { status: 500 }
      );
    }

    const scoresByCoachId = new Map<
      string,
      { scores: unknown; updated_at: string | null }
    >();
    for (const row of scoreRows ?? []) {
      scoresByCoachId.set(row.user_id as string, {
        scores: row.scores,
        updated_at: (row.updated_at as string | null) ?? null,
      });
    }

    const matrix = coaches.map((coach) => {
      const scoreRow = scoresByCoachId.get(coach.id);
      return {
        ...coach,
        scores: normalizeScores(scoreRow?.scores ?? {}),
        updated_at: scoreRow?.updated_at ?? null,
      };
    });

    return NextResponse.json({ coaches: matrix });
  } catch (error) {
    console.error("admin/coach-signature-matrix GET error:", error);
    return NextResponse.json(
      { error: "Unable to load client success matrix." },
      { status: 500 }
    );
  }
}
