import { NextResponse } from "next/server";
import { requireShareCoach } from "@/lib/shareLinks/requireShareCoach";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Details the Toolkit prints on each coach's graphics: name, business, photo and public slug. */
export async function GET(request: Request) {
  const auth = await requireShareCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const [{ data: profile, error: profileError }, { data: coach }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("full_name, first_name, last_name, coach_business_name, avatar_url")
      .eq("id", auth.coachId)
      .maybeSingle(),
    supabaseAdmin.from("coaches").select("slug").eq("id", auth.coachId).maybeSingle(),
  ]);

  if (profileError) {
    return NextResponse.json({ error: "Could not load your profile." }, { status: 500 });
  }

  const name =
    profile?.full_name?.trim() ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    null;

  return NextResponse.json({
    name,
    first_name: profile?.first_name?.trim() || name?.split(" ")[0] || null,
    business: profile?.coach_business_name?.trim() || null,
    avatar_url: profile?.avatar_url || null,
    coach_slug: coach?.slug ?? null,
  });
}
