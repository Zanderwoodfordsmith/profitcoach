import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  normalizeManualWeek,
  SCORECARD_MANUAL_KEYS,
  type ScorecardManualWeek,
} from "@/lib/scorecardManual";
import { isMondayIso, mondaySequenceFromStart } from "@/lib/scorecardWeeks";

const VISIBLE_WEEKS = 16;

async function requireCoach(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return { error: "Missing access token." as const, userId: null };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { error: "Invalid access token." as const, userId: null };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const impersonateId = request.headers.get("x-impersonate-coach-id")?.trim();
  const effectiveId =
    profile?.role === "admin" && impersonateId ? impersonateId : user.id;

  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return { error: "Not authorized." as const, userId: null };
  }

  return { error: null, userId: effectiveId as string };
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const authCheck = await requireCoach(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const startMonday = url.searchParams.get("startMonday");
  if (
    !startMonday ||
    !ISO_DATE_RE.test(startMonday) ||
    !isMondayIso(startMonday)
  ) {
    return NextResponse.json(
      {
        error:
          "Query startMonday is required and must be a Monday (YYYY-MM-DD).",
      },
      { status: 400 }
    );
  }

  const sequence = mondaySequenceFromStart(startMonday, VISIBLE_WEEKS);
  if (sequence.length !== VISIBLE_WEEKS) {
    return NextResponse.json(
      { error: "Unable to build week range." },
      { status: 400 }
    );
  }

  const coachId = authCheck.userId;

  try {
    const [weekRes, profileRes] = await Promise.all([
      supabaseAdmin
        .from("coach_scorecard_week")
        .select("week_start_date, manual_values, updated_at")
        .eq("user_id", coachId)
        .in("week_start_date", sequence)
        .order("week_start_date", { ascending: true }),
      supabaseAdmin
        .from("profiles")
        .select("ladder_goal_level, scorecard_period_start_monday")
        .eq("id", coachId)
        .maybeSingle(),
    ]);

    if (weekRes.error) throw weekRes.error;

    const byWeek = new Map<string, Partial<ScorecardManualWeek>>();
    for (const row of weekRes.data ?? []) {
      const iso = row.week_start_date as string;
      byWeek.set(iso, normalizeManualWeek(row.manual_values));
    }

    const weeks = sequence.map((iso) => ({
      week_start_date: iso,
      manual_values: byWeek.get(iso) ?? {},
    }));

    return NextResponse.json({
      weeks,
      ladder_goal_level:
        (profileRes.data?.ladder_goal_level as string | null) ?? null,
      scorecard_period_start_monday:
        (profileRes.data?.scorecard_period_start_monday as string | null) ??
        null,
      period: {
        start_monday: startMonday,
        week_starts: sequence,
        visible_weeks: VISIBLE_WEEKS,
      },
    });
  } catch (e) {
    console.error("coach/scorecard GET:", e);
    return NextResponse.json(
      { error: "Unable to load scorecard." },
      { status: 500 }
    );
  }
}

type PatchBody = {
  updates?: Array<{
    week_start_date?: string;
    manual_values?: unknown;
  }>;
  scorecard_period_start_monday?: string | null;
};

export async function PATCH(request: Request) {
  const authCheck = await requireCoach(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const coachId = authCheck.userId;

  if (
    Object.prototype.hasOwnProperty.call(body, "scorecard_period_start_monday")
  ) {
    const v = body.scorecard_period_start_monday;
    if (
      v !== null &&
      typeof v === "string" &&
      (!ISO_DATE_RE.test(v) || !isMondayIso(v))
    ) {
      return NextResponse.json(
        { error: "scorecard_period_start_monday must be a Monday or null." },
        { status: 400 }
      );
    }
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        scorecard_period_start_monday: v === null ? null : v,
      })
      .eq("id", coachId);
    if (error) throw error;
  }

  const updates = body.updates;
  if (Array.isArray(updates) && updates.length > 0) {
    for (const u of updates) {
      const iso = u.week_start_date;
      if (!iso || !ISO_DATE_RE.test(iso) || !isMondayIso(iso)) {
        return NextResponse.json(
          { error: "Each update needs a valid Monday week_start_date." },
          { status: 400 }
        );
      }
      if (u.manual_values !== undefined && typeof u.manual_values !== "object") {
        return NextResponse.json(
          { error: "manual_values must be an object." },
          { status: 400 }
        );
      }
    }

    try {
      for (const u of updates) {
        const iso = u.week_start_date as string;
        const normalized = normalizeManualWeek(u.manual_values ?? {});

        const payload: Record<string, number> = {};
        for (const k of SCORECARD_MANUAL_KEYS) {
          const v = normalized[k];
          if (typeof v === "number") payload[k] = v;
        }

        const { error } = await supabaseAdmin
          .from("coach_scorecard_week")
          .upsert(
            {
              user_id: coachId,
              week_start_date: iso,
              manual_values: payload,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,week_start_date" }
          );

        if (error) throw error;
      }
    } catch (e) {
      console.error("coach/scorecard PATCH weeks:", e);
      return NextResponse.json(
        { error: "Unable to save scorecard." },
        { status: 500 }
      );
    }
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      body,
      "scorecard_period_start_monday"
    ) &&
    (!Array.isArray(updates) || updates.length === 0)
  ) {
    return NextResponse.json(
      { error: "Nothing to update." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
