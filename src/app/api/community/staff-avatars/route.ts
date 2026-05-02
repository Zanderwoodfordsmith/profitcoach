import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_IDS = 150;

/**
 * Returns avatar URLs from profiles (same source as coach settings). Uses the service
 * role so community UI always matches Settings even when client-side profile joins omit
 * avatar_url under RLS.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    data: { user },
    error: authErr,
  } = await supabaseAdmin.auth.getUser(token);

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: roleRow } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !roleRow ||
    (roleRow.role !== "coach" && roleRow.role !== "admin")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawIds =
    body &&
    typeof body === "object" &&
    "userIds" in body &&
    Array.isArray((body as { userIds: unknown }).userIds)
      ? (body as { userIds: unknown[] }).userIds
      : [];

  const userIds = [
    ...new Set(
      rawIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ].slice(0, MAX_IDS);

  if (userIds.length === 0) {
    return NextResponse.json({ avatars: {} as Record<string, string | null> });
  }

  const { data: rows, error } = await supabaseAdmin
    .from("profiles")
    .select("id, avatar_url")
    .in("id", userIds);

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Could not load avatars" },
      { status: 500 }
    );
  }

  const avatars: Record<string, string | null> = {};
  for (const id of userIds) {
    avatars[id] = null;
  }
  for (const r of rows ?? []) {
    avatars[r.id] = r.avatar_url ?? null;
  }

  return NextResponse.json({ avatars });
}
