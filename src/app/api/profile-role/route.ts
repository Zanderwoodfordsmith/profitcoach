import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  userId: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;

    if (!body?.userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, full_name, coach_business_name, avatar_url")
      .eq("id", body.userId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: "Could not load profile role" },
        { status: 500 }
      );
    }

    let coach_slug: string | null = null;
    const role = profile?.role ?? "coach";
    if (role === "coach" || profile) {
      const { data: coachRow } = await supabaseAdmin
        .from("coaches")
        .select("slug")
        .eq("id", body.userId)
        .maybeSingle();
      coach_slug = coachRow?.slug ?? null;
    }

    return NextResponse.json(
      {
        role,
        full_name: profile?.full_name ?? null,
        coach_business_name: profile?.coach_business_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        coach_slug,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("profile-role error:", err);
    return NextResponse.json(
      { error: "Could not load profile role" },
      { status: 500 }
    );
  }
}

