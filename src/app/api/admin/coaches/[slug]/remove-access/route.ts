import { NextResponse } from "next/server";
import { resolveCoachByRef } from "@/lib/admin/resolveCoachRef";
import { removeCoachAccess } from "@/lib/admin/removeCoachAccess";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Remove a departed coach's login and contact details, keeping their name and avatar. */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    const status = authCheck.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: authCheck.error }, { status });
  }

  const { slug: coachRef } = await context.params;
  if (!coachRef?.trim()) {
    return NextResponse.json({ error: "Missing coach slug." }, { status: 400 });
  }
  const resolved = await resolveCoachByRef(coachRef);
  if (!resolved) {
    return NextResponse.json({ error: "Coach not found." }, { status: 404 });
  }
  const coachId = resolved.id;

  if (coachId === authCheck.userId) {
    return NextResponse.json(
      { error: "You cannot remove your own access." },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", coachId)
    .maybeSingle();
  if (profileError) {
    console.error("admin/coaches/[id]/remove-access profile check error:", profileError);
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
      { error: "Only coach profiles can have access removed here." },
      { status: 400 }
    );
  }

  const result = await removeCoachAccess(coachId);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ access_removed_at: result.removedAt });
}
