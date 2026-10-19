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

    // Independent lookups: run them together.
    const [profileRes, coachRes, contactsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("role, full_name, coach_business_name, avatar_url")
        .eq("id", body.userId)
        .maybeSingle(),
      supabaseAdmin.from("coaches").select("slug").eq("id", body.userId).maybeSingle(),
      supabaseAdmin.from("contacts").select("type").eq("user_id", body.userId).limit(20),
    ]);
    const { data: profile, error: profileError } = profileRes;

    if (profileError) {
      return NextResponse.json(
        { error: "Could not load profile role" },
        { status: 500 }
      );
    }

    const role = profile?.role ?? "coach";
    const coach_slug: string | null = coachRes.data?.slug ?? null;

    /** Contacts linked to this auth user (client portal). Prospects must not use the client app. */
    let linked_contact_type: string | null = null;
    const contactRows = contactsRes.data;
    if (contactRows && contactRows.length > 0) {
      const types = (contactRows as { type: string }[]).map((r) => r.type);
      if (types.includes("prospect")) linked_contact_type = "prospect";
      else if (types.includes("client")) linked_contact_type = "client";
      else linked_contact_type = types[0] ?? null;
    }

    return NextResponse.json(
      {
        role,
        full_name: profile?.full_name ?? null,
        coach_business_name: profile?.coach_business_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        coach_slug,
        linked_contact_type,
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

