import { NextResponse } from "next/server";
import { isValidLadderLevelId } from "@/lib/ladder";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireAdmin(request: Request): Promise<
  | { error: "Missing access token." | "Invalid access token." | "Not authorized." | "Server error."; userId: null }
  | { error: null; userId: string }
> {
  try {
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

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "admin") {
      return { error: "Not authorized." as const, userId: null };
    }

    return { error: null, userId: user.id as string };
  } catch (err) {
    console.error("admin/coaches/[id] requireAdmin error:", err);
    return { error: "Server error." as const, userId: null };
  }
}

const LEVELS = new Set(["certified", "professional", "elite"]);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type PatchBody = {
  directory_listed?: boolean;
  directory_level?: string | null;
  /** Convenience: admin marks the coach's current level. Upserts an achievement. */
  ladder_level?: string | null;
  ladder_goal_level?: string | null;
  ladder_goal_target_date?: string | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    const status = authCheck.error === "Server error." ? 500 : 401;
    return NextResponse.json(
      { error: authCheck.error },
      { status }
    );
  }

  const { id: coachId } = await context.params;
  if (!coachId?.trim()) {
    return NextResponse.json({ error: "Missing coach id." }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const coachUpdates: Record<string, unknown> = {};
  if (body.directory_listed !== undefined) {
    coachUpdates.directory_listed = !!body.directory_listed;
  }
  if (body.directory_level !== undefined) {
    if (body.directory_level === null || body.directory_level === "") {
      coachUpdates.directory_level = null;
    } else if (typeof body.directory_level === "string" && LEVELS.has(body.directory_level)) {
      coachUpdates.directory_level = body.directory_level;
    } else {
      return NextResponse.json(
        { error: "directory_level must be certified, professional, elite, or null." },
        { status: 400 }
      );
    }
  }

  const profileUpdates: Record<string, unknown> = {};
  if (body.ladder_goal_level !== undefined) {
    if (body.ladder_goal_level === null || body.ladder_goal_level === "") {
      profileUpdates.ladder_goal_level = null;
    } else if (
      typeof body.ladder_goal_level === "string" &&
      isValidLadderLevelId(body.ladder_goal_level)
    ) {
      profileUpdates.ladder_goal_level = body.ladder_goal_level;
    } else {
      return NextResponse.json(
        { error: "ladder_goal_level must be a valid ladder id or null." },
        { status: 400 }
      );
    }
  }
  if (body.ladder_goal_target_date !== undefined) {
    if (
      body.ladder_goal_target_date === null ||
      body.ladder_goal_target_date === ""
    ) {
      profileUpdates.ladder_goal_target_date = null;
    } else if (
      typeof body.ladder_goal_target_date === "string" &&
      ISO_DATE_RE.test(body.ladder_goal_target_date)
    ) {
      profileUpdates.ladder_goal_target_date = body.ladder_goal_target_date;
    } else {
      return NextResponse.json(
        { error: "ladder_goal_target_date must be YYYY-MM-DD or null." },
        { status: 400 }
      );
    }
  }

  // Admin can also "mark current level" — upserts an achievement (today's date).
  let currentLevelMark:
    | { kind: "set"; levelId: string }
    | { kind: "clear" }
    | null = null;
  if (body.ladder_level !== undefined) {
    if (body.ladder_level === null || body.ladder_level === "") {
      currentLevelMark = { kind: "clear" };
    } else if (
      typeof body.ladder_level === "string" &&
      isValidLadderLevelId(body.ladder_level)
    ) {
      currentLevelMark = { kind: "set", levelId: body.ladder_level };
    } else {
      return NextResponse.json(
        { error: "ladder_level must be a valid ladder id or null." },
        { status: 400 }
      );
    }
  }

  if (
    Object.keys(coachUpdates).length === 0 &&
    Object.keys(profileUpdates).length === 0 &&
    currentLevelMark === null
  ) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  try {
    if (Object.keys(profileUpdates).length > 0) {
      const { error: pErr } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdates)
        .eq("id", coachId);

      if (pErr?.code === "42703") {
        return NextResponse.json(
          {
            error:
              "Ladder columns are missing. Deploy the latest database migration.",
          },
          { status: 500 }
        );
      }
      if (pErr) {
        console.error("admin/coaches/[id] profile update error:", pErr);
        return NextResponse.json(
          { error: "Unable to update coach ladder fields." },
          { status: 500 }
        );
      }
    }

    if (currentLevelMark) {
      if (currentLevelMark.kind === "set") {
        const today = new Date().toISOString().slice(0, 10);
        const { error: aErr } = await supabaseAdmin
          .from("community_ladder_achievements")
          .upsert(
            {
              user_id: coachId,
              level_id: currentLevelMark.levelId,
              achieved_on: today,
            },
            { onConflict: "user_id,level_id" }
          );
        if (aErr?.code === "42P01") {
          return NextResponse.json(
            {
              error:
                "Ladder achievements table is missing. Deploy the latest database migration.",
            },
            { status: 500 }
          );
        }
        if (aErr) {
          console.error("admin/coaches/[id] mark_achieved error:", aErr);
          return NextResponse.json(
            { error: "Unable to set current ladder level." },
            { status: 500 }
          );
        }
      } else {
        // Clear all achievements for this coach.
        const { error: aErr } = await supabaseAdmin
          .from("community_ladder_achievements")
          .delete()
          .eq("user_id", coachId);
        if (aErr?.code === "42P01") {
          return NextResponse.json(
            {
              error:
                "Ladder achievements table is missing. Deploy the latest database migration.",
            },
            { status: 500 }
          );
        }
        if (aErr) {
          console.error("admin/coaches/[id] clear achievements error:", aErr);
          return NextResponse.json(
            { error: "Unable to clear ladder achievements." },
            { status: 500 }
          );
        }
      }
    }

    if (Object.keys(coachUpdates).length > 0) {
      const { error } = await supabaseAdmin
        .from("coaches")
        .update(coachUpdates)
        .eq("id", coachId);

      if (error?.code === "42703") {
        return NextResponse.json(
          {
            error:
              "Directory columns are missing. Deploy the latest database migration.",
          },
          { status: 500 }
        );
      }
      if (error) {
        console.error("admin/coaches/[id] update error:", error);
        return NextResponse.json(
          { error: "Unable to update coach." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin/coaches/[id] catch:", err);
    return NextResponse.json(
      { error: "Unable to update coach." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    const status = authCheck.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: authCheck.error }, { status });
  }

  const { id: coachId } = await context.params;
  if (!coachId?.trim()) {
    return NextResponse.json({ error: "Missing coach id." }, { status: 400 });
  }

  if (coachId === authCheck.userId) {
    return NextResponse.json(
      { error: "You cannot delete your own admin profile." },
      { status: 400 }
    );
  }

  try {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", coachId)
      .maybeSingle();

    if (profileError) {
      console.error("admin/coaches/[id] delete profile check error:", profileError);
      return NextResponse.json(
        { error: "Unable to verify coach profile." },
        { status: 500 }
      );
    }
    if (!profile) {
      return NextResponse.json({ error: "Coach not found." }, { status: 404 });
    }
    if (profile.role !== "coach") {
      return NextResponse.json(
        { error: "Only coach profiles can be deleted here." },
        { status: 400 }
      );
    }

    const { error: coachDeleteError } = await supabaseAdmin
      .from("coaches")
      .delete()
      .eq("id", coachId);
    if (coachDeleteError) {
      console.error("admin/coaches/[id] delete coach row error:", coachDeleteError);
      return NextResponse.json(
        { error: "Unable to delete coach directory record." },
        { status: 500 }
      );
    }

    const { error: profileDeleteError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", coachId);
    if (profileDeleteError) {
      console.error("admin/coaches/[id] delete profile row error:", profileDeleteError);
      return NextResponse.json(
        { error: "Unable to delete coach profile." },
        { status: 500 }
      );
    }

    const { error: authDeleteError } =
      await supabaseAdmin.auth.admin.deleteUser(coachId);
    if (authDeleteError) {
      console.error("admin/coaches/[id] delete auth user error:", authDeleteError);
      return NextResponse.json(
        { error: "Coach profile deleted, but auth account could not be deleted." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin/coaches/[id] DELETE catch:", err);
    return NextResponse.json(
      { error: "Unable to delete coach profile." },
      { status: 500 }
    );
  }
}
