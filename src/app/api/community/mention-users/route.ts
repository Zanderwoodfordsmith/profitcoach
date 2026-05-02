import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { displayNameFromProfile } from "@/lib/communityProfile";

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
      .order("full_name", { ascending: true, nullsFirst: false })
      .limit(30);

    if (error) {
      return NextResponse.json(
        { error: "Could not load users." },
        { status: 500 }
      );
    }

    const users = (data ?? []).map((row) => ({
      id: row.id as string,
      display_name: displayNameFromProfile(row),
      avatar_url: row.avatar_url ?? null,
      handle: null as string | null,
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

  const needle = q.toLowerCase();
  const data = (rows ?? [])
    .filter((row) => {
      const name = displayNameFromProfile(row).toLowerCase();
      return (
        name.includes(needle) ||
        row.id.toLowerCase().startsWith(needle)
      );
    })
    .sort((a, b) =>
      displayNameFromProfile(a).localeCompare(displayNameFromProfile(b))
    )
    .slice(0, 30);

  const coachIds = (data ?? [])
    .filter((r) => r.role === "coach")
    .map((r) => r.id);

  let slugByCoach: Record<string, string> = {};
  if (coachIds.length > 0) {
    const { data: coaches } = await supabaseAdmin
      .from("coaches")
      .select("id, slug")
      .in("id", coachIds);
    slugByCoach = Object.fromEntries(
      (coaches ?? []).map((c) => [c.id as string, c.slug as string])
    );
  }

  const users = (data ?? []).map((row) => ({
    id: row.id as string,
    display_name: displayNameFromProfile(row),
    avatar_url: row.avatar_url ?? null,
    handle:
      row.role === "coach"
        ? (slugByCoach[row.id] ?? null)
        : row.role === "admin"
          ? "admin"
          : null,
    role: row.role as string,
  }));

  return NextResponse.json({ users });
}
