import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  type CommunityLadderEventDTO,
  type LadderAchievementDTO,
  isValidLadderLevelId,
  ladderOrdinal,
} from "@/lib/ladder";

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

function parseOptionalDate(
  v: unknown
):
  | { ok: true; value: string | null | undefined }
  | { ok: false; error: string } {
  if (v === undefined) return { ok: true, value: undefined };
  if (v === null || v === "") return { ok: true, value: null };
  if (typeof v === "string" && ISO_DATE_RE.test(v)) {
    return { ok: true, value: v };
  }
  return { ok: false, error: "Date must be YYYY-MM-DD." };
}

function parseOptionalLevel(
  v: unknown
):
  | { ok: true; value: string | null | undefined }
  | { ok: false; error: string } {
  if (v === undefined) return { ok: true, value: undefined };
  if (v === null || v === "") return { ok: true, value: null };
  if (typeof v === "string" && isValidLadderLevelId(v)) {
    return { ok: true, value: v };
  }
  return { ok: false, error: "Invalid ladder level id." };
}

export async function GET(request: Request) {
  const authCheck = await requireCoach(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const coachId = authCheck.userId;
  const url = new URL(request.url);
  const eventsLimit = Math.min(
    100,
    Math.max(0, Number(url.searchParams.get("eventsLimit") ?? "20") || 0)
  );
  const eventsOffset = Math.max(
    0,
    Number(url.searchParams.get("eventsOffset") ?? "0") || 0
  );
  const kindFilter = url.searchParams.get("kind"); // e.g. level_up

  try {
    const profileSelect =
      "ladder_goal_level, ladder_goal_target_date, full_name, first_name, last_name, avatar_url";

    let profileRes = await supabaseAdmin
      .from("profiles")
      .select(profileSelect)
      .eq("id", coachId)
      .maybeSingle();

    if (profileRes.error?.code === "42703") {
      profileRes = await supabaseAdmin
        .from("profiles")
        .select("full_name, first_name, last_name, avatar_url")
        .eq("id", coachId)
        .maybeSingle();
      if (profileRes.error) {
        return NextResponse.json(
          { error: "Could not load profile" },
          { status: 500 }
        );
      }
      const p = profileRes.data as Record<string, unknown>;
      return NextResponse.json({
        achievements: [] as LadderAchievementDTO[],
        ladder_goal_level: null,
        ladder_goal_target_date: null,
        full_name: (p.full_name as string | null) ?? null,
        first_name: (p.first_name as string | null) ?? null,
        last_name: (p.last_name as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null) ?? null,
        events: [] as CommunityLadderEventDTO[],
        hasMore: false,
        migrationNeeded: true,
      });
    }

    if (profileRes.error) {
      return NextResponse.json(
        { error: "Could not load profile" },
        { status: 500 }
      );
    }

    const prof = profileRes.data as {
      ladder_goal_level: string | null;
      ladder_goal_target_date: string | null;
      full_name: string | null;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
    };

    let achievements: LadderAchievementDTO[] = [];
    let achievementsMigrationNeeded = false;
    {
      const achRes = await supabaseAdmin
        .from("community_ladder_achievements")
        .select("level_id, achieved_on")
        .eq("user_id", coachId);

      if (achRes.error?.code === "42P01") {
        achievementsMigrationNeeded = true;
      } else if (achRes.error) {
        console.error("coach/ladder achievements:", achRes.error);
        return NextResponse.json(
          { error: "Could not load ladder achievements" },
          { status: 500 }
        );
      } else {
        achievements = (achRes.data ?? []).map((row) => ({
          level_id: row.level_id as string,
          achieved_on: (row.achieved_on as string | null) ?? null,
        }));
        achievements.sort(
          (a, b) =>
            (ladderOrdinal(a.level_id) ?? 0) - (ladderOrdinal(b.level_id) ?? 0)
        );
      }
    }

    let events: CommunityLadderEventDTO[] = [];
    let hasMore = false;

    if (eventsLimit > 0) {
      const fetchCount = eventsLimit + 1;
      let q = supabaseAdmin
        .from("community_ladder_events")
        .select(
          `
          id,
          user_id,
          from_level,
          to_level,
          kind,
          created_at,
          profiles (
            full_name,
            first_name,
            last_name,
            avatar_url
          )
        `
        )
        .order("created_at", { ascending: false })
        .range(eventsOffset, eventsOffset + fetchCount - 1);

      if (kindFilter) {
        q = q.eq("kind", kindFilter);
      }

      const evRes = await q;

      if (
        evRes.error?.code === "42703" ||
        evRes.error?.message?.includes("community_ladder_events")
      ) {
        events = [];
        hasMore = false;
      } else if (evRes.error) {
        console.error("coach/ladder events:", evRes.error);
        return NextResponse.json(
          { error: "Could not load ladder events" },
          { status: 500 }
        );
      } else {
        const rows = evRes.data ?? [];
        hasMore = rows.length > eventsLimit;
        const trimmed = rows.slice(0, eventsLimit);

        events = trimmed.map((row: Record<string, unknown>) => {
          const rawProf = row.profiles as
            | {
                full_name?: string | null;
                first_name?: string | null;
                last_name?: string | null;
                avatar_url?: string | null;
              }
            | Array<{
                full_name?: string | null;
                first_name?: string | null;
                last_name?: string | null;
                avatar_url?: string | null;
              }>
            | null;
          const nested = Array.isArray(rawProf) ? rawProf[0] : rawProf;
          return {
            id: row.id as string,
            user_id: row.user_id as string,
            from_level: (row.from_level as string | null) ?? null,
            to_level: row.to_level as string,
            kind: row.kind as string,
            created_at: row.created_at as string,
            full_name: nested?.full_name ?? null,
            first_name: nested?.first_name ?? null,
            last_name: nested?.last_name ?? null,
            avatar_url: nested?.avatar_url ?? null,
          };
        });
      }
    }

    return NextResponse.json({
      achievements,
      ladder_goal_level: prof.ladder_goal_level ?? null,
      ladder_goal_target_date: prof.ladder_goal_target_date ?? null,
      full_name: prof.full_name ?? null,
      first_name: prof.first_name ?? null,
      last_name: prof.last_name ?? null,
      avatar_url: prof.avatar_url ?? null,
      events,
      hasMore,
      migrationNeeded: achievementsMigrationNeeded,
    });
  } catch (e) {
    console.error("coach/ladder GET:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

type PatchBody = {
  mark_achieved?: { level_id?: unknown; achieved_on?: unknown };
  unmark_achieved?: { level_id?: unknown };
  ladder_goal_level?: unknown;
  ladder_goal_target_date?: unknown;
};

export async function PATCH(request: Request) {
  const authCheck = await requireCoach(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const coachId = authCheck.userId;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 1. Mark a level as achieved (upsert).
  if (body.mark_achieved) {
    const levelId = body.mark_achieved.level_id;
    if (typeof levelId !== "string" || !isValidLadderLevelId(levelId)) {
      return NextResponse.json(
        { error: "mark_achieved.level_id is required and must be a valid id." },
        { status: 400 }
      );
    }
    let achievedOn: string | null;
    if (!("achieved_on" in body.mark_achieved)) {
      // Back-compat: omitting the field defaults to today.
      achievedOn = new Date().toISOString().slice(0, 10);
    } else {
      const dateParse = parseOptionalDate(body.mark_achieved.achieved_on);
      if (!dateParse.ok) {
        return NextResponse.json({ error: dateParse.error }, { status: 400 });
      }
      if (dateParse.value === undefined) {
        achievedOn = new Date().toISOString().slice(0, 10);
      } else {
        achievedOn = dateParse.value;
      }
    }

    const { error } = await supabaseAdmin
      .from("community_ladder_achievements")
      .upsert(
        { user_id: coachId, level_id: levelId, achieved_on: achievedOn },
        { onConflict: "user_id,level_id" }
      );

    if (error?.code === "42P01") {
      return NextResponse.json(
        {
          error:
            "Ladder achievements table is missing. Apply the latest database migration.",
        },
        { status: 500 }
      );
    }
    if (error) {
      console.error("coach/ladder mark_achieved:", error);
      return NextResponse.json(
        { error: "Could not save achievement." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  // 2. Untick a level.
  if (body.unmark_achieved) {
    const levelId = body.unmark_achieved.level_id;
    if (typeof levelId !== "string" || !isValidLadderLevelId(levelId)) {
      return NextResponse.json(
        { error: "unmark_achieved.level_id is required and must be a valid id." },
        { status: 400 }
      );
    }
    const { error } = await supabaseAdmin
      .from("community_ladder_achievements")
      .delete()
      .eq("user_id", coachId)
      .eq("level_id", levelId);

    if (error) {
      console.error("coach/ladder unmark_achieved:", error);
      return NextResponse.json(
        { error: "Could not clear achievement." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  // 3. Profile-level updates: goal level, goal target date.
  const profileUpdates: Record<string, unknown> = {};
  if ("ladder_goal_level" in body) {
    const parsed = parseOptionalLevel(body.ladder_goal_level);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    if (parsed.value !== undefined) {
      profileUpdates.ladder_goal_level = parsed.value;
    }
  }
  if ("ladder_goal_target_date" in body) {
    const parsed = parseOptionalDate(body.ladder_goal_target_date);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    if (parsed.value !== undefined) {
      profileUpdates.ladder_goal_target_date = parsed.value;
    }
  }

  if (Object.keys(profileUpdates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update." },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(profileUpdates)
    .eq("id", coachId);

  if (error?.code === "42703") {
    return NextResponse.json(
      {
        error:
          "Ladder columns are not available yet. Apply the latest database migration.",
      },
      { status: 500 }
    );
  }
  if (error?.code === "23514") {
    return NextResponse.json(
      { error: "Invalid ladder level value." },
      { status: 400 }
    );
  }
  if (error) {
    console.error("coach/ladder PATCH profile:", error);
    return NextResponse.json(
      { error: "Could not update ladder settings." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
