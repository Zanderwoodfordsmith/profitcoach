import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { displayNameFromProfile } from "@/lib/communityProfile";
import {
  compareAdminMentionOrder,
  compareMentionSearchResults,
  mentionMatchScore,
} from "@/lib/communityMentionUsers";

async function requireStaff(request: Request): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: number; message: string }
> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return { ok: false, status: 401, message: "Missing access token." };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { ok: false, status: 401, message: "Invalid access token." };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? null;
  if (role !== "coach" && role !== "admin") {
    return { ok: false, status: 403, message: "Staff only." };
  }

  return { ok: true, userId: user.id };
}

async function loadLastSignInByUserId(
  userIds: string[]
): Promise<Record<string, string | null>> {
  if (userIds.length === 0) return {};

  const authUsersRes = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authUsersRes.error) return {};

  const wanted = new Set(userIds);
  const out: Record<string, string | null> = {};
  for (const user of authUsersRes.data.users ?? []) {
    if (!wanted.has(user.id)) continue;
    out[user.id] = user.last_sign_in_at ?? null;
  }
  return out;
}

export async function GET(request: Request) {
  const auth = await requireStaff(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.message },
      { status: auth.status }
    );
  }

  const { searchParams } = new URL(request.url);
  const qRaw = searchParams.get("q") ?? "";
  const q = qRaw.trim();

  if (q.length === 0) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, first_name, last_name, avatar_url, role")
      .eq("role", "admin")
      .limit(30);

    if (error) {
      return NextResponse.json(
        { error: "Could not load users." },
        { status: 500 }
      );
    }

    const sorted = [...(data ?? [])].sort(compareAdminMentionOrder);

    const users = sorted.map((row) => ({
      id: row.id as string,
      display_name: displayNameFromProfile(row),
      avatar_url: row.avatar_url ?? null,
      role: row.role as string,
    }));

    return NextResponse.json({ users });
  }

  const { data: rows, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, first_name, last_name, avatar_url, role")
    .in("role", ["coach", "admin"])
    .limit(400);

  if (error) {
    return NextResponse.json(
      { error: "Could not load users." },
      { status: 500 }
    );
  }

  const coachIds = (rows ?? [])
    .filter((row) => row.role === "coach")
    .map((row) => row.id as string);

  let slugByCoach: Record<string, string> = {};
  if (coachIds.length > 0) {
    const { data: coaches } = await supabaseAdmin
      .from("coaches")
      .select("id, slug")
      .in("id", coachIds);
    slugByCoach = Object.fromEntries(
      (coaches ?? []).map((coach) => [coach.id as string, coach.slug as string])
    );
  }

  const needle = q.toLowerCase();
  const matched = (rows ?? []).filter(
    (row) => mentionMatchScore(row, slugByCoach[row.id as string], needle) > 0
  );

  const lastSignInByUserId = await loadLastSignInByUserId(
    matched.map((row) => row.id as string)
  );

  const data = matched
    .sort((a, b) =>
      compareMentionSearchResults(
        a,
        b,
        slugByCoach,
        needle,
        lastSignInByUserId
      )
    )
    .slice(0, 30);

  const users = data.map((row) => ({
    id: row.id as string,
    display_name: displayNameFromProfile(row),
    avatar_url: row.avatar_url ?? null,
    role: row.role as string,
  }));

  return NextResponse.json({ users });
}
