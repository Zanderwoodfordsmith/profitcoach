import { NextResponse } from "next/server";
import {
  isExtensionLinkedInAllowedEmail,
  parseExtensionLinkedInAllowedEmails,
  requireExtensionLinkedInAccess,
} from "@/lib/extensionLinkedIn/access";
import {
  coachHasFeature,
  resolveCoachAccessForUserId,
} from "@/lib/coachAccess/resolveCoachAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Entitlement probe + admin coach picker for the Chrome extension.
 */
export async function GET(request: Request) {
  const gated = await requireExtensionLinkedInAccess(request);

  if (!gated.error && gated.userId) {
    return NextResponse.json({
      ok: true,
      allowed: true,
      role: gated.role,
      actingAsCoachId: gated.userId,
      coaches: gated.coaches,
      tier: gated.access.tier,
      features: gated.access.features,
      hasMarketing: true,
      onAllowlist: true,
      allowlistMode: parseExtensionLinkedInAllowedEmails().mode,
      upgradePath: "/coach/membership",
    });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        allowed: false,
        error: "Missing access token.",
        code: "auth",
        upgradePath: "/coach/membership",
      },
      { status: 401 }
    );
  }

  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);
  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        allowed: false,
        error: "Invalid access token.",
        code: "auth",
        upgradePath: "/coach/membership",
      },
      { status: 401 }
    );
  }

  const email = user.email?.trim().toLowerCase() ?? null;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const access = await resolveCoachAccessForUserId(user.id);
  const hasMarketing = coachHasFeature(access, "nav.marketing");
  const onAllowlist = isExtensionLinkedInAllowedEmail(email);

  const code =
    gated.error === "Pick a coach to act as."
      ? "need_coach"
      : gated.error === "Feature not available for your access tier."
        ? "tier_required"
        : gated.error === "Extension not enabled for this account yet."
          ? "allowlist"
          : "auth";

  return NextResponse.json(
    {
      ok: false,
      allowed: false,
      role: profile?.role ?? null,
      coaches: gated.coaches,
      tier: access.tier,
      features: access.features,
      hasMarketing,
      onAllowlist,
      allowlistMode: parseExtensionLinkedInAllowedEmails().mode,
      error: gated.error,
      code,
      upgradePath: "/coach/membership",
    },
    { status: gated.status ?? 403 }
  );
}
