import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

export async function GET(request: Request) {
  const authCheck = await requireCoach(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const coachId = authCheck.userId;

  try {
    const profileResult = await supabaseAdmin
      .from("profiles")
      .select(
        "first_name, last_name, full_name, coach_business_name, avatar_url, linkedin_url, bio, location"
      )
      .eq("id", coachId)
      .maybeSingle();

    let profileRow: Record<string, unknown> | null =
      (profileResult.data as Record<string, unknown> | null);
    if (profileResult.error?.code === "42703") {
      let fallback = await supabaseAdmin
        .from("profiles")
        .select("full_name, coach_business_name, avatar_url, linkedin_url")
        .eq("id", coachId)
        .maybeSingle();
      if (fallback.error?.code === "42703") {
        fallback = await supabaseAdmin
          .from("profiles")
          .select("full_name, coach_business_name")
          .eq("id", coachId)
          .maybeSingle();
      }
      if (fallback.error) {
        return NextResponse.json(
          { error: "Could not load profile" },
          { status: 500 }
        );
      }
      profileRow = fallback.data as Record<string, unknown> | null;
    } else if (profileResult.error) {
      return NextResponse.json(
        { error: "Could not load profile" },
        { status: 500 }
      );
    }

    const { data: coachRow, error: coachErr } = await supabaseAdmin
      .from("coaches")
      .select("slug, directory_listed, directory_level")
      .eq("id", coachId)
      .maybeSingle();

    if (coachErr?.code === "42703") {
      const { data: fallbackCoach } = await supabaseAdmin
        .from("coaches")
        .select("slug")
        .eq("id", coachId)
        .maybeSingle();
      const slug = fallbackCoach?.slug ?? null;
      const prof = profileRow as {
        first_name?: string | null;
        last_name?: string | null;
        full_name?: string | null;
        coach_business_name?: string | null;
        avatar_url?: string | null;
        linkedin_url?: string | null;
        bio?: string | null;
        location?: string | null;
      } | null;

      return NextResponse.json({
        first_name: prof?.first_name ?? null,
        last_name: prof?.last_name ?? null,
        full_name: prof?.full_name ?? null,
        coach_business_name: prof?.coach_business_name ?? null,
        avatar_url: prof?.avatar_url ?? null,
        linkedin_url: prof?.linkedin_url ?? null,
        bio: prof?.bio ?? null,
        location: prof?.location ?? null,
        coach_slug: slug,
        directory_listed: false,
        directory_level: null,
      });
    }
    if (coachErr) {
      return NextResponse.json(
        { error: "Could not load profile" },
        { status: 500 }
      );
    }

    const slug = coachRow?.slug ?? null;
    const prof = profileRow as {
      first_name?: string | null;
      last_name?: string | null;
      full_name?: string | null;
      coach_business_name?: string | null;
      avatar_url?: string | null;
      linkedin_url?: string | null;
      bio?: string | null;
      location?: string | null;
    } | null;

    return NextResponse.json({
      first_name: prof?.first_name ?? null,
      last_name: prof?.last_name ?? null,
      full_name: prof?.full_name ?? null,
      coach_business_name: prof?.coach_business_name ?? null,
      avatar_url: prof?.avatar_url ?? null,
      linkedin_url: prof?.linkedin_url ?? null,
      bio: prof?.bio ?? null,
      location: prof?.location ?? null,
      coach_slug: slug,
      directory_listed: coachRow?.directory_listed ?? false,
      directory_level: coachRow?.directory_level ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not load profile" },
      { status: 500 }
    );
  }
}

type PatchBody = {
  first_name?: string | null;
  last_name?: string | null;
  coach_business_name?: string | null;
  linkedin_url?: string | null;
  bio?: string | null;
  location?: string | null;
  avatar_url?: string | null;
  /** Coach may toggle directory visibility; level is admin-only. */
  directory_listed?: boolean;
  directory_level?: unknown;
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

  if (body.directory_level !== undefined) {
    return NextResponse.json(
      { error: "Certification level can only be changed by an admin." },
      { status: 403 }
    );
  }

  const updates: Record<string, unknown> = {};

  if (body.first_name !== undefined) updates.first_name = body.first_name?.trim() ?? null;
  if (body.last_name !== undefined) updates.last_name = body.last_name?.trim() ?? null;
  if (body.coach_business_name !== undefined)
    updates.coach_business_name = body.coach_business_name?.trim() ?? null;
  if (body.linkedin_url !== undefined)
    updates.linkedin_url = body.linkedin_url?.trim() || null;
  if (body.bio !== undefined) updates.bio = body.bio?.trim() ?? null;
  if (body.location !== undefined) updates.location = body.location?.trim() ?? null;
  if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url || null;

  const coachUpdates: Record<string, unknown> = {};
  if (body.directory_listed !== undefined) {
    coachUpdates.directory_listed = !!body.directory_listed;
  }

  if (body.first_name !== undefined || body.last_name !== undefined) {
    const first = (body.first_name ?? "").trim();
    const last = (body.last_name ?? "").trim();
    updates.full_name =
      [first, last].filter(Boolean).join(" ").trim() || null;
  }

  if (Object.keys(updates).length === 0 && Object.keys(coachUpdates).length === 0) {
    return NextResponse.json({ ok: true });
  }

  if (Object.keys(coachUpdates).length > 0) {
    const coachRes = await supabaseAdmin
      .from("coaches")
      .update(coachUpdates)
      .eq("id", coachId);
    if (coachRes.error) {
      const msg =
        coachRes.error.code === "42703"
          ? "Directory settings require a database migration. Ask your team to deploy latest migrations."
          : (coachRes.error as { message?: string }).message ??
            "Could not update directory settings";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true });
  }

  let result = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", coachId);

  if (result.error?.code === "42703") {
    const minimalUpdates: Record<string, unknown> = {};
    if (updates.full_name !== undefined) minimalUpdates.full_name = updates.full_name;
    if (updates.coach_business_name !== undefined)
      minimalUpdates.coach_business_name = updates.coach_business_name;
    if (updates.avatar_url !== undefined) minimalUpdates.avatar_url = updates.avatar_url;
    if (Object.keys(minimalUpdates).length > 0) {
      result = await supabaseAdmin
        .from("profiles")
        .update(minimalUpdates)
        .eq("id", coachId);
    }
    if (result.error?.code === "42703" && minimalUpdates.avatar_url !== undefined) {
      delete minimalUpdates.avatar_url;
      if (Object.keys(minimalUpdates).length > 0) {
        result = await supabaseAdmin
          .from("profiles")
          .update(minimalUpdates)
          .eq("id", coachId);
      }
    }
  }

  if (result.error) {
    const message =
      result.error.code === "42703"
        ? "Some profile fields are not available yet. Run database migrations, or try saving only name and business."
        : (result.error as { message?: string }).message ?? "Could not update profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
