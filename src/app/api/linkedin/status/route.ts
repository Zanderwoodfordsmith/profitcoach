import { NextResponse } from "next/server";
import { requireContentPublisher } from "@/lib/linkedinAdminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ComposerSettings = {
  display_headline?: string | null;
  website_label?: string | null;
  website_url?: string | null;
  quote_handle?: string | null;
};

function pick(...values: (string | null | undefined)[]): string | null {
  for (const v of values) if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

/** Content → Settings, whichever way LinkedIn is connected; the older connection's values as a fallback. */
async function loadComposerSettings(userId: string): Promise<ComposerSettings | null> {
  const { data } = await supabaseAdmin
    .from("linkedin_composer_settings")
    .select("display_headline, website_label, website_url, quote_handle")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

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
    .ilike("provider", "linkedin")
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

  const settings = await loadComposerSettings(auth.userId);

  if (outreach?.unipile_account_id) {
    return NextResponse.json({
      connected: true,
      via: "unipile",
      connection: {
        linkedin_sub: outreach.unipile_account_id,
        // A list, as for OAuth connections (a plain string crashed Content → Settings).
        scope: [],
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
        headline: pick(settings?.display_headline),
        photo_url: profileRow?.avatar_url ?? null,
        website_label: pick(settings?.website_label) ?? "Visit my website",
        website_url: pick(settings?.website_url),
        quote_handle: pick(settings?.quote_handle) ?? "Profit Coach",
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
      headline: pick(settings?.display_headline, data?.display_headline, snap?.headline),
      photo_url: profileRow?.avatar_url || snap?.photoUrl || null,
      website_label: pick(settings?.website_label, data?.website_label) ?? "Visit my website",
      website_url: pick(settings?.website_url, data?.website_url),
      quote_handle: pick(settings?.quote_handle, data?.quote_handle) ?? "Profit Coach",
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireContentPublisher(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    display_headline?: string | null;
    website_label?: string | null;
    website_url?: string | null;
    quote_handle?: string | null;
  };

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

  // Saved for every coach, however LinkedIn is connected (Unipile coaches used to get "ok" and nothing stored).
  const { error } = await supabaseAdmin
    .from("linkedin_composer_settings")
    .upsert({ user_id: auth.userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

  if (error) {
    console.error("linkedin composer settings:", error.message);
    return NextResponse.json({ error: "Could not save your settings." }, { status: 500 });
  }

  // Keep the older connection's copy in step for anything that still reads it.
  await supabaseAdmin.from("linkedin_member_connections").update(patch).eq("user_id", auth.userId);

  return NextResponse.json({ ok: true });
}
