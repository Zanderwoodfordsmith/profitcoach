import { NextResponse } from "next/server";
import { resolveCoachAccessForUserId } from "@/lib/coachAccess/resolveCoachAccess";
import { featuresForTier } from "@/lib/coachAccess/tiers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 });
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return NextResponse.json({ error: "Invalid access token." }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const impersonateId = request.headers.get("x-impersonate-coach-id")?.trim();
  const effectiveId =
    profile.role === "admin" && impersonateId ? impersonateId : user.id;

  const access = await resolveCoachAccessForUserId(effectiveId);

  return NextResponse.json({
    tier: access.tier,
    tierLocked: access.tierLocked,
    features: featuresForTier(access.tier),
  });
}
