import { NextResponse } from "next/server";
import { requireContentPublisher } from "@/lib/linkedinAdminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const auth = await requireContentPublisher(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const { data: outreach } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select("unipile_account_id, status, display_name, last_synced_at")
    .eq("coach_id", auth.userId)
    .eq("status", "OK")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: profileRow } = await supabaseAdmin
    .from("profiles")
    .select("full_name, first_name, last_name, avatar_url")
    .eq("id", auth.userId)
    .maybeSingle();

  const profileName =
    profileRow?.full_name ||
    [profileRow?.first_name, profileRow?.last_name].filter(Boolean).join(" ").trim() ||
    null;

  if (outreach?.unipile_account_id) {
    return NextResponse.json({
      connected: true,
      via: "unipile",
      connection: {
        linkedin_sub: outreach.unipile_account_id,
        scope: "unipile",
        token_expires_at: null,
        updated_at: outreach.last_synced_at,
      },
      account: {
        sub: outreach.unipile_account_id,
        name: outreach.display_name || profileName,
        first_name: null,
        last_name: null,
        email: null,
        email_verified: null,
        picture: profileRow?.avatar_url ?? null,
      },
      profile: {
        name: outreach.display_name || profileName,
        headline: null,
        photo_url: profileRow?.avatar_url ?? null,
        website_label: "Visit my website",
        website_url: null,
        quote_handle: "Profit Coach",
      },
    });
  }

  const { data, error } = await supabaseAdmin
    .from("linkedin_member_connections")
    .select(
      "linkedin_sub, scope, token_expires_at, updated_at, access_token, display_headline, website_label, website_url, quote_handle"
    )
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not load LinkedIn status." }, { status: 500 });
  }

  const { data: liSnap } = await supabaseAdmin
    .from("coach_linkedin_profiles")
    .select("snapshot")
    .eq("coach_id", auth.userId)
    .maybeSingle();

  const snap = (liSnap?.snapshot ?? null) as {
    fullName?: string | null;
    headline?: string | null;
    photoUrl?: string | null;
  } | null;

  return NextResponse.json({
    connected: !!data,
    via: data ? "oauth" : null,
    connection: data
      ? {
          linkedin_sub: data.linkedin_sub,
          scope: data.scope,
          token_expires_at: data.token_expires_at,
          updated_at: data.updated_at,
        }
      : null,
    account: data
      ? {
          sub: data.linkedin_sub,
          name: profileName,
          first_name: null,
          last_name: null,
          email: null,
          email_verified: null,
          picture: profileRow?.avatar_url ?? null,
        }
      : null,
    profile: {
      name: profileName,
      headline:
        (typeof data?.display_headline === "string" && data.display_headline.trim()) ||
        snap?.headline ||
        null,
      photo_url: profileRow?.avatar_url || snap?.photoUrl || null,
      website_label:
        (typeof data?.website_label === "string" && data.website_label.trim()) ||
        "Visit my website",
      website_url:
        (typeof data?.website_url === "string" && data.website_url.trim()) || null,
      quote_handle:
        (typeof data?.quote_handle === "string" && data.quote_handle.trim()) ||
        "Profit Coach",
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireContentPublisher(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const { data: outreach } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select("id")
    .eq("coach_id", auth.userId)
    .eq("status", "OK")
    .limit(1)
    .maybeSingle();

  if (outreach) {
    return NextResponse.json({ ok: true, via: "unipile" });
  }

  const body = (await request.json().catch(() => ({}))) as {
    display_headline?: string | null;
    website_label?: string | null;
    website_url?: string | null;
    quote_handle?: string | null;
  };

  const { data: existing } = await supabaseAdmin
    .from("linkedin_member_connections")
    .select("user_id")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { error: "Connect LinkedIn in Campaigns before saving settings." },
      { status: 400 }
    );
  }

  const patch: Record<string, string | null> = {};
  if ("display_headline" in body) {
    patch.display_headline = body.display_headline?.trim() || null;
  }
  if ("website_label" in body) {
    patch.website_label = body.website_label?.trim() || null;
  }
  if ("website_url" in body) {
    patch.website_url = body.website_url?.trim() || null;
  }
  if ("quote_handle" in body) {
    patch.quote_handle = body.quote_handle?.trim() || null;
  }

  const { error } = await supabaseAdmin
    .from("linkedin_member_connections")
    .update(patch)
    .eq("user_id", auth.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
