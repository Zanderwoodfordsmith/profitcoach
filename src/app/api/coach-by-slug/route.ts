import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Public API: get coach (and profile) by slug for playbook attribution. Uses admin client so RLS is not a barrier. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug")?.trim();
    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const { data: coachRow, error: coachError } = await supabaseAdmin
      .from("coaches")
      .select("id, slug")
      .eq("slug", slug)
      .maybeSingle();

    if (coachError) {
      console.error("coach-by-slug coachError:", coachError);
      return NextResponse.json({ error: "Could not load coach" }, { status: 500 });
    }
    if (!coachRow) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const coachId = coachRow.id as string;
    const coachSlug = coachRow.slug as string;

    let profileRow: unknown = null;
    let linkedinUrl: string | null = null;

    const { data: profileWithLinkedIn, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("full_name, coach_business_name, avatar_url, linkedin_url")
      .eq("id", coachId)
      .maybeSingle();

    if (profileError?.code === "42703") {
      const { data: profileFallback, error: fallbackError } = await supabaseAdmin
        .from("profiles")
        .select("full_name, coach_business_name, avatar_url")
        .eq("id", coachId)
        .maybeSingle();
      if (fallbackError) {
        console.error("coach-by-slug profileError (fallback):", fallbackError);
        return NextResponse.json({ error: "Could not load profile" }, { status: 500 });
      }
      profileRow = profileFallback;
      linkedinUrl = null;
    } else if (profileError) {
      console.error("coach-by-slug profileError:", profileError);
      return NextResponse.json({ error: "Could not load profile" }, { status: 500 });
    } else {
      profileRow = profileWithLinkedIn;
      linkedinUrl = (profileWithLinkedIn as { linkedin_url?: string | null } | null)?.linkedin_url ?? null;
    }

    const prof = profileRow as { full_name?: string | null; coach_business_name?: string | null; avatar_url?: string | null } | null;
    const businessName = prof?.coach_business_name ?? (coachSlug?.toUpperCase() === "BCA" ? "Central (BCA)" : null);

    return NextResponse.json({
      slug: coachSlug,
      full_name: prof?.full_name ?? null,
      coach_business_name: businessName,
      avatar_url: prof?.avatar_url ?? null,
      linkedin_url: linkedinUrl,
    });
  } catch (err) {
    console.error("coach-by-slug catch:", err);
    return NextResponse.json({ error: "Could not load coach" }, { status: 500 });
  }
}
