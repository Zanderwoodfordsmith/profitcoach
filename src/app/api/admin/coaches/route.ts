import { NextResponse } from "next/server";
import { deriveCurrentLevelId } from "@/lib/ladder";
import { splitFullName } from "@/lib/splitFullName";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  fullName: string;
  businessName?: string;
  email: string;
  slug: string;
  /**
   * If true, send a Supabase invite email so the coach sets
   * their own password. If false, password must be provided.
   */
  invite: boolean;
  password?: string;
};

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
    console.error("admin/coaches requireAdmin error:", err);
    return { error: "Server error." as const, userId: null };
  }
}

export async function GET(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    const status = authCheck.error === "Server error." ? 500 : 401;
    return NextResponse.json(
      { error: authCheck.error },
      { status }
    );
  }

  try {
    type CoachQueryRow = Record<string, unknown>;
    type QueryResult = {
      data: CoachQueryRow[] | null;
      error: { code?: string } | null;
    };

    const runSelect = async (selectStr: string): Promise<QueryResult> => {
      const r = await supabaseAdmin
        .from("coaches")
        .select(selectStr)
        .order("slug", { ascending: true });
      return {
        data: (r.data as unknown as CoachQueryRow[] | null) ?? null,
        error: r.error as { code?: string } | null,
      };
    };

    let res = await runSelect(
      "id, slug, directory_listed, directory_level, profiles!inner(full_name, coach_business_name, ladder_goal_level, ladder_goal_target_date)"
    );

    let goalDateMissing = false;
    if (res.error?.code === "42703") {
      res = await runSelect(
        "id, slug, directory_listed, directory_level, profiles!inner(full_name, coach_business_name, ladder_goal_level)"
      );
      goalDateMissing = true;
    }

    let directoryMissing = false;
    if (res.error?.code === "42703") {
      res = await runSelect(
        "id, slug, profiles!inner(full_name, coach_business_name, ladder_goal_level)"
      );
      directoryMissing = true;
    }

    let goalLevelMissing = false;
    if (res.error?.code === "42703") {
      res = await runSelect(
        "id, slug, profiles!inner(full_name, coach_business_name)"
      );
      goalLevelMissing = true;
      directoryMissing = true;
    }

    if (res.error) {
      return NextResponse.json(
        { error: "Unable to load coaches." },
        { status: 500 }
      );
    }

    const rows: CoachQueryRow[] = res.data ?? [];
    const ids = rows.map((r) => r.id as string);

    // Pull achievements in one query and group by user.
    const achievementsByUser = new Map<string, Array<{ level_id: string }>>();
    if (ids.length > 0) {
      const achRes = await supabaseAdmin
        .from("community_ladder_achievements")
        .select("user_id, level_id")
        .in("user_id", ids);
      if (achRes.error?.code !== "42P01" && !achRes.error) {
        for (const r of achRes.data ?? []) {
          const list =
            achievementsByUser.get(r.user_id as string) ??
            ([] as Array<{ level_id: string }>);
          list.push({ level_id: r.level_id as string });
          achievementsByUser.set(r.user_id as string, list);
        }
      }
    }

    const coaches = rows.map((row) => {
      const profRaw = row.profiles as
        | Record<string, unknown>
        | Array<Record<string, unknown>>
        | undefined;
      const prof: Record<string, unknown> | undefined = Array.isArray(profRaw)
        ? profRaw[0]
        : profRaw;
      const id = row.id as string;
      const ach = achievementsByUser.get(id) ?? [];
      const currentLevel = deriveCurrentLevelId(ach);
      return {
        id,
        slug: row.slug as string,
        full_name: (prof?.full_name as string | null) ?? null,
        coach_business_name:
          (prof?.coach_business_name as string | null) ?? null,
        directory_listed: directoryMissing ? false : !!row.directory_listed,
        directory_level: directoryMissing
          ? null
          : (row.directory_level as string | null) ?? null,
        ladder_level: currentLevel,
        ladder_goal_level: goalLevelMissing
          ? null
          : (prof?.ladder_goal_level as string | null) ?? null,
        ladder_goal_target_date: goalDateMissing
          ? null
          : (prof?.ladder_goal_target_date as string | null) ?? null,
      };
    });

    return NextResponse.json({ coaches });
  } catch (err) {
    console.error("admin/coaches GET error:", err);
    return NextResponse.json(
      { error: "Unable to load coaches." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    const status = authCheck.error === "Server error." ? 500 : 401;
    return NextResponse.json(
      { error: authCheck.error },
      { status }
    );
  }

  const body = (await request.json()) as Body;

  const fullName = body.fullName?.trim();
  const businessName = body.businessName?.trim() || null;
  const email = body.email?.trim().toLowerCase();
  const slug = body.slug?.toLowerCase().trim();
  const invite = !!body.invite;
  const password = body.password;

  if (!fullName || !email || !slug) {
    return NextResponse.json(
      { error: "Please fill in name, email, and slug." },
      { status: 400 }
    );
  }

  if (!invite && !password) {
    return NextResponse.json(
      {
        error:
          "Password is required when not sending an invite email.",
      },
      { status: 400 }
    );
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      {
        error:
          "Slug can only contain lowercase letters, numbers, and hyphens.",
      },
      { status: 400 }
    );
  }

  try {
    let userId: string | null = null;

    if (invite) {
      const {
        data,
        error: inviteError,
      } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

      if (inviteError || !data?.user) {
        throw new Error(
          inviteError?.message ?? "Unable to send invite email."
        );
      }
      userId = data.user.id;
    } else {
      const {
        data,
        error: createError,
      } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: password!,
        email_confirm: true,
      });

      if (createError || !data.user) {
        throw new Error(
          createError?.message ?? "Unable to create user account."
        );
      }
      userId = data.user.id;
    }

    if (!userId) {
      throw new Error("User id missing after creating coach account.");
    }

    const { first_name, last_name } = splitFullName(fullName);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        role: "coach",
        full_name: fullName,
        first_name,
        last_name,
        coach_business_name: businessName,
      });

    if (profileError) {
      throw new Error("Unable to create coach profile.");
    }

    const { error: coachError } = await supabaseAdmin
      .from("coaches")
      .insert({ id: userId, slug });

    if (coachError) {
      if ((coachError as any).code === "23505") {
        throw new Error(
          "That slug is already in use. Please choose another."
        );
      }
      throw new Error("Unable to create coach record.");
    }

    return NextResponse.json(
      { ok: true, coachUserId: userId, slug },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error." },
      { status: 400 }
    );
  }
}
