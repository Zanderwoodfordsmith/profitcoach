import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/community/members-map
 *
 * Coach/admin-only listing of every member with cached geocoded coordinates.
 * Returns a single payload (no pagination) so the client can render a
 * Leaflet + react-leaflet-cluster map without per-viewport refetches.
 *
 * RLS is enforced via the underlying RPC (security invoker) which only exposes
 * profiles.role in ('coach','admin') — no client locations leak here.
 */

type RpcRow = {
  coach_id: string;
  slug: string | null;
  full_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  directory_listed: boolean | null;
};

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

function bioSnippet(text: string | null, max = 220): string | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (t.length <= max) return t;
  return `${t.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

export async function GET(request: Request) {
  const auth = await requireStaff(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.message },
      { status: auth.status }
    );
  }

  const { data, error } = await supabaseAdmin.rpc("community_members_map");

  if (error) {
    if (
      error.message?.includes("function") &&
      error.message?.includes("does not exist")
    ) {
      return NextResponse.json(
        {
          error:
            "Members map is not available until database migrations are applied.",
        },
        { status: 503 }
      );
    }
    console.error("members-map rpc error:", error);
    return NextResponse.json(
      { error: "Could not load members map." },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as RpcRow[];
  const members = rows
    .filter(
      (r): r is RpcRow & { latitude: number; longitude: number } =>
        typeof r.latitude === "number" && typeof r.longitude === "number"
    )
    .map((r) => ({
      id: r.coach_id,
      slug: r.slug,
      full_name: r.full_name,
      coach_business_name: r.coach_business_name,
      avatar_url: r.avatar_url,
      bio: bioSnippet(r.bio),
      location: r.location,
      lat: r.latitude,
      lng: r.longitude,
      directory_listed: !!r.directory_listed,
    }));

  return NextResponse.json({ members });
}
