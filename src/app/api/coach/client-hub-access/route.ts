import { NextResponse } from "next/server";
import {
  coachHasFeature,
  resolveCoachAccessForUserId,
} from "@/lib/coachAccess/resolveCoachAccess";
import { isCoachClientHubAllowedEmail } from "@/lib/coachClientHubAccess";
import { coachClientHubEmailForUserId } from "@/lib/coachClientHubAccessServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function emailForUserId(userId: string): Promise<string | null> {
  return coachClientHubEmailForUserId(userId);
}

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

  // Admins can open Coach Clients tooling without impersonating (demo client on admin).
  if (profile.role === "admin") {
    return NextResponse.json({ allowed: true, email: null });
  }

  const email = await emailForUserId(user.id);
  const access = await resolveCoachAccessForUserId(user.id);
  const allowed =
    coachHasFeature(access, "nav.delivery") ||
    isCoachClientHubAllowedEmail(email);

  return NextResponse.json({ allowed, email: email ?? null });
}
